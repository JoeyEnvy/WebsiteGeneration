import express from "express";
import { tempSessions } from "../index.js";
import fetch from "node-fetch";
import dns from "dns/promises";  // Built-in Node.js DNS

const router = express.Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;  // e.g. 'joeyenvy'

/**
 * GET /api/full-hosting/status
 * Polled by frontend to track deployment + domain state
 */
router.get("/status", async (req, res) => {
  try {
    const { sessionId, domain: queryDomain } = req.query;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Missing sessionId" });
    }

    const saved = tempSessions.get(sessionId);
    if (!saved) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: false,
        dnsConfigured: false,
        httpsReady: false,
      });
    }

    // Safety: domain mismatch
    if (queryDomain && saved.domain && saved.domain.toLowerCase() !== String(queryDomain).toLowerCase()) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: Boolean(saved.domainPurchased),
        dnsConfigured: Boolean(saved.dnsConfigured),
        httpsReady: false,
      });
    }

    if (saved.failed) {
      return res.json({
        success: false,
        failed: true,
        error: saved.error || "Deployment failed",
        domain: saved.domain || null,
      });
    }

    let pagesUrl = saved.pagesUrl || null;
    let dnsConfigured = Boolean(saved.dnsConfigured);
    let httpsReady = Boolean(saved.httpsReady);
    let githubStatus = null;

    // GitHub Pages API check (authenticated for reliability)
    if (saved.repoOwner && saved.repoName && saved.deployed) {
      try {
        const headers = {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "website-generator-ai",
        };

        const ghRes = await fetch(
          `https://api.github.com/repos/${saved.repoOwner}/${saved.repoName}/pages`,
          { headers }
        );

        if (ghRes.ok) {
          const ghData = await ghRes.json();
          githubStatus = ghData.status;

          // Update pagesUrl if custom domain is set and enforced
          if (ghData.cname === saved.domain) {
            if (ghData.https_enforced) {
              pagesUrl = `https://${saved.domain}`;
            }
            // Check verification state
            if (ghData.protected_domain_state === "verified" && !ghData.pending_domain_unverified_at) {
              dnsConfigured = true;
            }
          }

          // If build complete and DNS good, mark HTTPS ready
          if (ghData.status === "built" && dnsConfigured) {
            httpsReady = true;
          }
        } else if (ghRes.status === 403) {
          console.warn("GitHub Pages API 403 (auth issue?)", saved.repoName);
        } else if (ghRes.status === 404) {
          console.log("Pages not yet initialized (404)", saved.repoName);
        }
      } catch (apiErr) {
        console.error("GitHub API fetch error:", apiErr.message);
      }
    }

    // Real DNS verification (fallback if API not fully ready)
    if (saved.domain && !dnsConfigured) {
      try {
        const githubIps = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
        const apexIps = await dns.resolve4(saved.domain).catch(() => []);
        const apexOk = apexIps.some(ip => githubIps.includes(ip));

        let cnameOk = false;
        try {
          const cnames = await dns.resolveCname(`www.${saved.domain}`);
          cnameOk = cnames.some(name => name.toLowerCase().includes(`${GITHUB_USERNAME.toLowerCase()}.github.io`));
        } catch {}

        if (apexOk && cnameOk) {
          dnsConfigured = true;
          // If DNS good + Pages built, assume HTTPS will come soon
          if (githubStatus === "built") httpsReady = true;
          console.log(`DNS verified for ${saved.domain}`);
        }
      } catch (dnsErr) {
        console.log(`DNS check failed yet: ${dnsErr.message}`);
      }
    }

    // Update session for persistence (frontend can see progress)
    saved.dnsConfigured = dnsConfigured;
    saved.httpsReady = httpsReady;
    tempSessions.set(sessionId, saved);

    return res.json({
      success: true,
      deployed: Boolean(saved.deployed),
      domain: saved.domain || null,
      pagesUrl,
      repoUrl: saved.repoUrl || null,
      repoName: saved.repoName || null,
      githubUser: saved.githubUser || null,
      domainPurchased: Boolean(saved.domainPurchased),
      dnsConfigured,
      httpsReady,  // New: true when site should be live on custom domain
      githubStatus,  // e.g. "built", "building", null
      durationYears: saved.durationYears || null,
    });
  } catch (err) {
    console.error("FULL HOSTING STATUS ERROR:", err);
    return res.status(500).json({ success: false, error: "Status check failed" });
  }
});

export default router;
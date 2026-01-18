import express from "express";
import { tempSessions } from "../index.js";
import fetch from "node-fetch";

const router = express.Router();

/**
 * GET /api/full-hosting/status
 * Used by fullhosting.html to poll deployment + domain state
 */
router.get("/status", async (req, res) => {
  try {
    const { sessionId, domain } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing sessionId"
      });
    }

    const saved = tempSessions.get(sessionId);

    // Session not created yet
    if (!saved) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: false,
        dnsConfigured: false
      });
    }

    // Optional safety check (do NOT hard-fail)
    if (
      domain &&
      saved.domain &&
      saved.domain.toLowerCase() !== String(domain).toLowerCase()
    ) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: Boolean(saved.domainPurchased),
        dnsConfigured: Boolean(saved.dnsConfigured)
      });
    }

    // 🚨 HARD FAILURE — bubble up real errors
    if (saved.failed) {
      return res.json({
        success: false,
        failed: true,
        error: saved.error || "Deployment failed",
        domain: saved.domain || null
      });
    }

    let dnsConfigured = Boolean(saved.dnsConfigured);
    let pagesUrl = saved.pagesUrl || null;

    // Only check GitHub Pages if repo exists and not yet fully confirmed
    if (saved.repoOwner && saved.repoName && saved.deployed) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${saved.repoOwner}/${saved.repoName}/pages`
        );
        const ghData = await ghRes.json();

        // Check CNAME match
        if (ghData.cname === saved.domain) {
          dnsConfigured = true;
        } else {
          dnsConfigured = false; // keep polling
        }

        // Use HTTPS preview if enforced, else fallback to .github.io
        if (ghData.https_enforced) {
          pagesUrl = `https://${saved.domain}`;
        } else if (saved.pagesUrl) {
          pagesUrl = saved.pagesUrl;
        }
      } catch (err) {
        // Network or GitHub API issue → fallback to .github.io
        pagesUrl = saved.pagesUrl || null;
      }
    }

    return res.json({
      success: true,
      deployed: Boolean(saved.deployed),
      domain: saved.domain || null,

      // GitHub
      pagesUrl,
      repoUrl: saved.repoUrl || null,
      repoName: saved.repoName || null,
      githubUser: saved.githubUser || null,

      // Domain + DNS (polling until live)
      domainPurchased: Boolean(saved.domainPurchased),
      dnsConfigured,

      // Billing
      durationYears: saved.durationYears || null
    });

  } catch (err) {
    console.error("FULL HOSTING STATUS ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Status check failed"
    });
  }
});

export default router;

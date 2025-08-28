// backend/routes/deployFullHostingRoutes.js
import express from "express";
import fetch from "node-fetch";
import Stripe from "stripe";
import { domainToASCII } from "url";
import { createOrReuseRepo, enablePages, pagesUrlFor } from "../utils/githubUtils.js";
import { setGitHubDNS } from "../utils/dnsUtils.js";

const router = express.Router();

["GITHUB_TOKEN","GITHUB_OWNER","GODADDY_API_KEY","GODADDY_API_SECRET","GODADDY_ENV"].forEach(k=>{
  if (!process.env[k]) console.warn(`⚠️  Missing env: ${k}`);
});

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const REQUIRE_STRIPE = String(process.env.REQUIRE_STRIPE || "false").toLowerCase()==="true";

const isValidDomain = d => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || ""));
const clampYears = n => Math.max(1, Math.min(10, parseInt(n, 10) || 1));
const GD_BASE = () => process.env.GODADDY_ENV === "ote-godaddy"
  ? "https://api.ote-godaddy.com"
  : "https://api.godaddy.com";

const gdHeaders = () => ({
  "Content-Type": "application/json",
  "Accept": "application/json",
  "Authorization": `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`
});

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function withRetry(fn, times = 2, delayMs = 800) {
  let lastErr;
  for (let i=0;i<times;i++){
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r=>setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

async function gdCheckAvailable(domain) {
  return withRetry(async () => {
    const url = `${GD_BASE()}/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FAST`;
    const res = await fetchWithTimeout(url, { headers: gdHeaders() });
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  });
}

function buildConsent(ip = "0.0.0.0") {
  return { agreementKeys: ["DNRA"], agreedAt: new Date().toISOString(), agreedBy: ip };
}

function parseContactFromEnv() {
  try {
    const c = JSON.parse(process.env.GODADDY_CONTACT_JSON || "{}");
    if (!c?.email || !c?.nameFirst || !c?.nameLast || !c?.phone || !c?.addressMailing?.country) {
      throw new Error("Incomplete contact");
    }
    return c;
  } catch {
    throw new Error("GODADDY_CONTACT_JSON missing or invalid JSON");
  }
}

async function gdPurchaseDomain({ domain, years, ip }) {
  const contact = parseContactFromEnv();
  const consent = buildConsent(ip);
  const body = {
    consent,
    contactAdmin: contact,
    contactTech: contact,
    contactBilling: contact,
    contactRegistrant: contact,
    period: years,
    renewAuto: true,
    privacy: true
  };
  return withRetry(async () => {
    const url = `${GD_BASE()}/v1/domains/purchase?domain=${encodeURIComponent(domain)}`;
    const res = await fetchWithTimeout(url, { method: "POST", headers: gdHeaders(), body: JSON.stringify(body) });
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  });
}

const inflight = new Set();

router.post("/deploy-full-hosting", async (req, res) => {
  const startedAt = Date.now();
  const {
    sessionId = "",
    domain = "",
    durationYears = 1,
    businessName = "",
    checkoutSessionId
  } = req.body || {};

  try {
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    const cleaned = String(domain || "").trim().toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(cleaned)) return res.status(400).json({ error: "Invalid domain" });

    const asciiDomain = domainToASCII(cleaned) || cleaned;
    const years = Math.max(1, Math.min(10, parseInt(durationYears, 10) || 1));

    if (String(process.env.REQUIRE_STRIPE || "false").toLowerCase()==="true") {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      if (!checkoutSessionId) return res.status(400).json({ error: "Missing checkoutSessionId" });
      const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      if (checkout?.payment_status !== "paid") return res.status(402).json({ error: "Payment not completed" });
      if (checkout?.metadata?.sessionId && checkout.metadata.sessionId !== sessionId) {
        return res.status(400).json({ error: "Session mismatch" });
      }
    }

    if (inflight.has(sessionId)) return res.status(409).json({ error: "Deployment already in progress" });
    inflight.add(sessionId);

    let purchaseNote = "skipped";
    const avail = await gdCheckAvailable(asciiDomain).catch(() => ({ ok:false, status:0, data:{} }));
    if (!avail.ok) {
      purchaseNote = `availability_check_failed_${avail.status}`;
    } else if (avail?.data?.available === true) {
      const p = await gdPurchaseDomain({ domain: asciiDomain, years, ip: req.ip || req.headers["x-forwarded-for"] || "0.0.0.0" });
      if (!p.ok) {
        const msg = JSON.stringify(p.data);
        const probablyOwned = /already.*(registered|owned|purchased)|conflict|duplicate/i.test(msg);
        if (!probablyOwned) return res.status(502).json({ error: "GoDaddy purchase failed", details: p.data, status: p.status });
        purchaseNote = `purchase_conflict_proceed (${p.status})`;
      } else {
        purchaseNote = `purchased (${p.status})`;
      }
    } else {
      purchaseNote = "not_available_proceed";
    }

    const safeRepoBase = asciiDomain.replace(/\./g, "-").toLowerCase();
    const repoName = (safeRepoBase.match(/[a-z0-9-]+/g) || ["site"]).join("-").slice(0, 100);
    const siteTitle = businessName || "Your Site";
    const files = {
      "index.html": `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${siteTitle}</title><link rel="icon" href="data:,"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;background:#0e0e0e;color:#fff;margin:0;display:grid;place-items:center;height:100dvh}.card{max-width:720px;background:#131313;padding:32px 28px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45)}h1{margin:0 0 10px;font-size:28px}p{opacity:.85;line-height:1.55}a{color:#66aaff}</style></head><body><div class="card"><h1>${siteTitle}</h1><p>Deployed via <strong>Full Hosting</strong> 🚀</p><p>Custom domain: <strong>${asciiDomain}</strong></p><p>Edit this site by pushing to the repo.</p></div></body></html>`,
      ".nojekyll": ""
    };

    const { repoUrl, owner, repo } = await createOrReuseRepo({
      repoName,
      files,
      cname: asciiDomain,
      commitMessage: "Initial commit (Full Hosting)"
    });

    await enablePages({ owner, repo, buildType: "static" });
    const ghPagesUrl = pagesUrlFor({ owner, repo });

    await setGitHubDNS({ apexDomain: asciiDomain, wwwCnameTarget: `${owner}.github.io` });

    const elapsedMs = Date.now() - startedAt;
    return res.json({ status: "ok", elapsedMs, domain: asciiDomain, purchaseNote, repoUrl, pagesUrl: ghPagesUrl });
  } catch (err) {
    console.error("❌ deploy-full-hosting error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  } finally {
    inflight.delete(req?.body?.sessionId);
  }
});

export default router;

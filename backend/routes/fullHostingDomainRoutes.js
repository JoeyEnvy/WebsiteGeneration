// routes/fullHostingDomainRoutes.js – FINAL GODADDY AUTO-PURCHASE (2025)
import express from "express";
const router = express.Router();

// Simple domain format check
const isValidDomain = (d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d?.trim());

// GET /api/full-hosting/domain/check → GoDaddy availability
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ available: false, error: "Invalid domain" });
  }

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) {
    return res.status(500).json({ error: "GoDaddy keys missing" });
  }

  try {
    const resp = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${domain}`, {
      headers: { Authorization: `sso-key ${key}:${secret}` }
    });
    const data = await resp.json();
    res.json({ available: data.available === true });
  } catch (err) {
    console.error("GoDaddy check failed:", err);
    res.status(502).json({ available: false, error: "Check failed" });
  }
});

// POST /api/full-hosting/domain/price → fake realistic price
router.post("/domain/price", (req, res) => {
  const { duration = 1 } = req.body;
  const base = 11.99;
  const total = (base * duration).toFixed(2);
  res.json({ domainPrice: parseFloat(total), currency: "GBP" });
});

// POST /api/full-hosting/domain/purchase → REAL GODADDY AUTO BUY + DNS POINT
router.post("/domain/purchase", async (req, res) => {
  const { domain, userEmail = "support@websitegenerator.co.uk", userIP = "127.0.0.1", repoUrl = "joeyenvy.github.io" } = req.body;

  if (!domain || !isValidDomain(domain)) return res.status(400).json({ error: "Bad domain" });

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return res.status(500).json({ error: "GoDaddy not configured" });

  try {
    // 1. Final availability check
    const avail = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${domain}`, {
      headers: { Authorization: `sso-key ${key}:${secret}` }
    }).then(r => r.json());

    if (!avail.available) return res.json({ success: false, message: "Taken" });

    // 2. Purchase
    const purchase = await fetch("https://api.godaddy.com/v1/domains/purchase", {
      method: "POST",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        consent: { agreedAt: new Date().toISOString(), agreedBy: userIP, agreementKeys: ["DNRA"] },
        domain,
        period: 1,
        contactAdmin: { email: userEmail },
        privacy: true,
        renewAuto: true
      })
    }).then(r => r.json());

    if (!purchase.orderId) throw new Error(purchase.message || "Purchase failed");

    // 3. Point DNS to repo
    await fetch(`https://api.godaddy.com/v1/domains/${domain}/records/CNAME/@`, {
      method: "PUT",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ data: repoUrl, ttl: 600 }])
    });

    res.json({ success: true, domain, orderId: purchase.orderId, message: "Bought + connected!" });
  } catch (err) {
    console.error("GoDaddy purchase error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
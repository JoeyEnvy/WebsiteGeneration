// routes/fullHostingDomainRoutes.js – FINAL GODADDY-ONLY VERSION (22 Nov 2025)

import express from "express";
const router = express.Router();

// Simple domain validation
const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(d?.trim());

// ————————————————————————————————
// 1. Check domain availability via GoDaddy
// ————————————————————————————————
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ available: false, error: "Invalid domain format" });
  }

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return res.status(500).json({ available: false, error: "GoDaddy not configured" });

  try {
    try {
      const resp = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `sso-key ${key}:${secret}` }
      });

      const data = await resp.json();

      // GoDaddy returns an object if single domain, or array – handle both
      const result = Array.isArray(data) ? data[0] : data;

      const available = result.available === true;
      const priceUSD = parseFloat(result.price || 1299) / 1000000; // GoDaddy returns price in micro-USD

      res.json({
        available,
        priceUSD: parseFloat(priceUSD.toFixed(2)),
        currency: "USD"
      });
    } catch (err) {
      console.error("GoDaddy availability check failed:", err.message);
      res.status(502).json({ available: false, error: "Check unavailable – try later" });
    }
  }
});

// ————————————————————————————————
// 2. Get price (supports 1 or 3 years + your £150 markup)
// ————————————————————————————————
router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  const years = duration === 3 ? 3 : 1;

  try {
    const check = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `sso-key ${process.env.GODADDY_KEY}:${process.env.GODADDY_SECRET}` }
    }).then(r => r.json());

    const result = Array.isArray(check) ? check[0] : check;
    if (!result.available) return res.json({ domainPrice: 0, totalWithService: 150, note: "Domain taken" });

    const priceUSD = parseFloat(result.price || 1299) / 1000000;
    const domainPriceGBP = (priceUSD * 0.79).toFixed(2); // rough USD→GBP rate (adjust if you want)
    const totalGBP = (parseFloat(domainPriceGBP) * years + 150).toFixed(2); // + your £150 markup

    res.json({
      domainPrice: parseFloat(domainPriceGBP),
      totalWithService: parseFloat(totalGBP),
      years,
      currency: "GBP"
    });
  } catch (err) {
    res.json({ domainPrice: years === 3 ? 35.97 : 11.99, totalWithService: years === 3 ? 185.97 : 161.99 });
  }
});

// ————————————————————————————————
// 3. PURCHASE DOMAIN via GoDaddy + auto-point to GitHub Pages
// ————————————————————————————————
router.post("/domain/purchase", async (req, res) => {
  const {
    domain,
    duration = 1,
    userEmail = "support@websitegeneration.co.uk",
    userIP = "127.0.0.1",
    repoUrl = "joeyenvy.github.io" // change if you use different GitHub Pages URL
  } = req.body;

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) {
    return res.status(500).json({ success: false, error: "GoDaddy API keys missing" });
  }

  try {
    // Final availability check
    const avail = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `sso-key ${key}:${secret}` }
    }).then(r => r.json());
    const result = Array.isArray(avail) ? avail[0] : avail;
    if (!result.available) {
      return res.json({ success: false, message: "Domain no longer available" });
    }

    // Purchase
    const purchaseResp = await fetch("https://api.godaddy.com/v1/domains/purchase", {
      method: "POST",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        domain,
        period: duration === 3 ? 3 : 1,
        consent: {
          agreedAt: new Date().toISOString(),
          agreedBy: userIP,
          agreementKeys: ["DNRA"]
        },
        contactAdmin: { email: userEmail },
        contactBilling: { email: userEmail },
        contactTech: { email: userEmail },
        contactRegistrant: { email: userEmail },
        privacy: true,
        renewAuto: true
      })
    });

    const purchaseData = await purchaseResp.json();

    if (purchaseData.orderId) {
      // Auto-set DNS to point @ → your GitHub Pages
      await fetch(`https://api.godaddy.com/v1/domains/${domain}/records/CNAME/@`, {
        method: "PUT",
        headers: {
          Authorization: `sso-key ${key}:${secret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([{ data: repoUrl, ttl: 600 }])
      });

      res.json({
        success: true,
        domain,
        orderId: purchaseData.orderId,
        message: `Domain purchased (${duration} year${duration > 1 ? 's' : ''}) and pointed to ${repoUrl}`
      });
    } else {
      throw new Error(purchaseData.message || "Purchase failed");
    }
  } catch (err) {
    console.error("GoDaddy purchase error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
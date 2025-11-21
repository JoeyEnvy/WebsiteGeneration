// routes/fullHostingDomainRoutes.js – HYBRID PORKBUN CHECK + GODADDY PURCHASE
import express from "express";
const router = express.Router();

// Domain validation
const isValidDomain = (d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d?.trim());

// GET /api/full-hosting/domain/check → Porkbun availability (fast, no limits)
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ available: false, error: "Invalid domain" });
  }

  try {
    // Porkbun check (POST to api.porkbun.com, 2025 hostname)
    const resp = await fetch("https://api.porkbun.com/api/json/v3/domain/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.PORKBUN_API_KEY || "",
        secretapikey: process.env.PORKBUN_SECRET_KEY || "",
        domain
      })
    });

    if (!resp.ok) throw new Error(`Porkbun error ${resp.status}`);
    const data = await resp.json();

    if (data.status !== "SUCCESS") {
      return res.status(502).json({ available: false, error: data.message || "Check failed" });
    }

    const available = data.available === "yes" || data.available === true;
    console.log(`Porkbun check: ${domain} = ${available ? "AVAILABLE" : "TAKEN"}`);

    res.json({ available });
  } catch (err) {
    console.error("Porkbun check failed:", err);
    res.status(502).json({ available: false, error: "Check unavailable – try again" });
  }
});

// POST /api/full-hosting/domain/price → Porkbun pricing
router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  try {
    const years = parseInt(duration, 10);
    const pricingResp = await fetch("https://api.porkbun.com/api/json/v3/domain/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.PORKBUN_API_KEY || "",
        secretapikey: process.env.PORKBUN_SECRET_KEY || "",
        domain
      })
    });

    const pricingData = await pricingResp.json();
    if (pricingData.status !== "SUCCESS") {
      return res.status(502).json({ error: "Pricing unavailable" });
    }

    // Extract price for TLD (e.g., .co.uk: pricingData.pricing["co.uk"].register)
    const tld = domain.split('.').pop();  // .co.uk
    const tldPrice = pricingData.pricing?.[tld]?.register || 11.99;  // Fallback
    const domainPrice = (tldPrice * years).toFixed(2);

    res.json({ domainPrice: parseFloat(domainPrice), currency: "GBP", period: years });
  } catch (err) {
    console.error("Pricing failed:", err);
    res.status(500).json({ domainPrice: 11.99, currency: "GBP", period: 1 });  // Fallback
  }
});

// POST /api/full-hosting/domain/purchase → GoDaddy auto-buy + DNS (your reseller)
router.post("/domain/purchase", async (req, res) => {
  const { domain, userEmail = "support@websitegenerator.co.uk", userIP = "127.0.0.1", repoUrl = "joeyenvy.github.io" } = req.body;

  if (!domain || !isValidDomain(domain)) return res.status(400).json({ error: "Invalid domain" });

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return res.status(500).json({ error: "GoDaddy not ready" });

  try {
    // Quick Porkbun re-check (optional, for confidence)
    const porkbunResp = await fetch("https://api.porkbun.com/api/json/v3/domain/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.PORKBUN_API_KEY || "",
        secretapikey: process.env.PORKBUN_SECRET_KEY || "",
        domain
      })
    });
    const porkbunData = await porkbunResp.json();
    if (porkbunData.status !== "SUCCESS" || porkbunData.available !== "yes") {
      return res.json({ success: false, message: "Domain no longer available" });
    }

    // GoDaddy purchase
    const purchaseResp = await fetch("https://api.godaddy.com/v1/domains/purchase", {
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
    });
    const purchase = await purchaseResp.json();

    if (!purchase.orderId) throw new Error(purchase.message || "Purchase failed");

    // GoDaddy DNS to repo
    await fetch(`https://api.godaddy.com/v1/domains/${domain}/records`, {
      method: "PUT",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{
        type: "CNAME",
        name: "@",
        data: repoUrl,
        ttl: 3600
      }])
    });

    res.json({ success: true, domain, orderId: purchase.orderId, message: "Purchased via GoDaddy + connected!" });
  } catch (err) {
    console.error("Hybrid purchase error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
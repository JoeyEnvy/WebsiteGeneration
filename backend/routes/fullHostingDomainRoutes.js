// routes/fullHostingDomainRoutes.js – PORKBUN V3 POST FIXED (Nov 2025)
import express from "express";
const router = express.Router();

// Domain validation
const isValidDomain = (d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d?.trim());

// Helper: Porkbun POST request with retry
const porkbunPost = async (endpoint, body, retries = 2) => {
  const apiKey = process.env.PORKBUN_API_KEY || "";
  const secretKey = process.env.PORKBUN_SECRET_KEY || "";
  if (!apiKey || !secretKey) throw new Error("Porkbun keys missing");

  const fullBody = { ...body, apikey: apiKey, secretapikey: secretKey };
  for (let i = 0; i <= retries; i++) {
    const resp = await fetch(`https://api.porkbun.com/api/json/v3/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullBody)
    });

    if (resp.status === 404) {
      throw new Error(`Porkbun endpoint 404: ${endpoint} – API changed?`);
    }
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Porkbun attempt ${i + 1} failed:`, errorText);
      if (i === retries) throw new Error(`Porkbun error ${resp.status}: ${errorText}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Backoff
    } else {
      return resp.json();
    }
  }
};

// GET /api/full-hosting/domain/check → Porkbun availability (NOW POST, ultra-fast)
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ available: false, error: "Invalid domain" });
  }

  try {
    // FIXED: Real v3 POST /domain/available
    const data = await porkbunPost("domain/available", { domain });

    if (data.status !== "SUCCESS") {
      return res.status(502).json({ available: false, error: data.message || "Check failed" });
    }

    const available = data.available === "yes" || data.available === true;
    console.log(`Porkbun check: ${domain} = ${available ? "AVAILABLE" : "TAKEN"}`);

    res.json({ available });
  } catch (err) {
    console.error("Porkbun check failed:", err.message);
    res.status(502).json({ available: false, error: "Check unavailable – try again" });
  }
});

// POST /api/full-hosting/domain/price → Porkbun pricing (POST, unchanged but with helper)
router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  try {
    const years = parseInt(duration, 10);
    const pricingData = await porkbunPost("domain/pricing", { domain });

    if (pricingData.status !== "SUCCESS") {
      return res.status(502).json({ error: "Pricing unavailable" });
    }

    // Extract price (handles .co.uk, .store, etc.)
    const tld = domain.split('.').slice(-2).join('.');
    let tldPrice = pricingData.pricing?.[tld]?.register || pricingData.pricing?.[domain.split('.').pop()]?.register || 11.99;
    if (typeof tldPrice === 'object') tldPrice = tldPrice.current || tldPrice.first || 11.99;
    const domainPrice = (parseFloat(tldPrice) * years).toFixed(2);

    res.json({ domainPrice: parseFloat(domainPrice), currency: "GBP", period: years });
  } catch (err) {
    console.error("Pricing failed:", err.message);
    res.status(500).json({ domainPrice: 11.99, currency: "GBP", period: 1 });
  }
});

// POST /api/full-hosting/domain/purchase → GoDaddy (re-check with new POST, solid)
router.post("/domain/purchase", async (req, res) => {
  const { domain, userEmail = "support@websitegenerator.co.uk", userIP = "127.0.0.1", repoUrl = "joeyenvy.github.io" } = req.body;

  if (!domain || !isValidDomain(domain)) return res.status(400).json({ error: "Invalid domain" });

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return res.status(500).json({ error: "GoDaddy not ready" });

  try {
    // Re-check with FIXED POST endpoint
    const porkbunData = await porkbunPost("domain/available", { domain });
    if (porkbunData.status !== "SUCCESS" || porkbunData.available !== "yes") {
      return res.json({ success: false, message: "Domain no longer available" });
    }

    // GoDaddy purchase + DNS (unchanged, gold)
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
    console.error("Hybrid purchase error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
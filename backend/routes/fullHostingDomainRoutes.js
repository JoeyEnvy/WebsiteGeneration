// routes/fullHostingDomainRoutes.js – PORKBUN V3 POST FIXED (Nov 2025)
import express from "express";
const router = express.Router();

// Domain validation
const isValidDomain = (d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d?.trim());

// Helper: Porkbun POST request with retry
const porkbunPost = async (endpoint, body = {}, retries = 2) => {
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

// GET /api/full-hosting/domain/check → Porkbun availability (NOW CORRECT v3 ENDPOINT, ultra-fast)
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ available: false, error: "Invalid domain" });
  }
  try {
    // FIXED: Real v3 POST /domain/checkDomain/{domain} (domain in path, keys in body only)
    const data = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${domain}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: process.env.PORKBUN_API_KEY, secretapikey: process.env.PORKBUN_SECRET_KEY })
    }).then(r => r.json());
    
    if (data.status !== "SUCCESS") {
      return res.status(502).json({ available: false, error: data.message || "Check failed" });
    }
    const available = data.response.avail === "yes";
    const price = data.response.price || null; // First-year price if available
    console.log(`Porkbun check: ${domain} = ${available ? "AVAILABLE" : "TAKEN"}`);
    res.json({ available, price, raw: data });
  } catch (err) {
    console.error("Porkbun check failed:", err.message);
    res.status(502).json({ available: false, error: "Check unavailable – try again" });
  }
});

// POST /api/full-hosting/domain/price → Porkbun pricing (FIXED: Use global /pricing/get, no auth)
router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body;
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ error: "Invalid domain" });
  }
  try {
    const years = parseInt(duration, 10);
    // FIXED: Real v3 POST /pricing/get (no body, no auth – returns all TLD prices)
    const pricingData = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }).then(r => r.json());
    
    if (pricingData.status !== "SUCCESS") {
      return res.status(502).json({ error: "Pricing unavailable" });
    }
    // Extract price by TLD (e.g., ".store" or ".co.uk")
    const tld = domain.split('.').slice(-2).join('.'); // Handles co.uk etc.
    let tldPrice = pricingData.pricing?.[tld]?.registration || 
                   pricingData.pricing?.[domain.split('.').pop()]?.registration || 11.99;
    if (typeof tldPrice === 'object') tldPrice = tldPrice.current || tldPrice.first || 11.99;
    const domainPrice = (parseFloat(tldPrice) * years).toFixed(2);
    res.json({ domainPrice: parseFloat(domainPrice), currency: "USD", period: years }); // Porkbun uses USD
  } catch (err) {
    console.error("Pricing failed:", err.message);
    res.status(500).json({ domainPrice: 11.99, currency: "USD", period: 1 });
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
    const checkResp = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${domain}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: process.env.PORKBUN_API_KEY, secretapikey: process.env.PORKBUN_SECRET_KEY })
    });
    const porkbunData = await checkResp.json();
    if (porkbunData.status !== "SUCCESS" || porkbunData.response.avail !== "yes") {
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
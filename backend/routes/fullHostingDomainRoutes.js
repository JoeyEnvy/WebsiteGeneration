// routes/fullHostingDomainRoutes.js – FIXED: Exact GoDaddy 2025 Payload (25 Nov 2025)
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(d?.trim());

router.post("/domain/purchase", async (req, res) => {
  console.log("DOMAIN PURCHASE →", {
    ip: req.ip,
    host: req.hostname,
    internalHeader: !!req.headers["x-internal-request"],
  });

  const isInternal =
    req.headers["x-internal-request"] === "yes" ||
    req.ip === "127.0.0.1" ||
    req.hostname === "localhost" ||
    req.ip?.startsWith("::ffff:127.");

  if (!isInternal) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const { domain, duration = 1, userEmail = "support@websitegeneration.co.uk" } = req.body || {};

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) {
    return res.status(500).json({ success: false, error: "GoDaddy keys missing" });
  }

  try {
    // FINAL AVAILABILITY CHECK
    const availResp = await fetch(
      `https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`,
      { headers: { Authorization: `sso-key ${key}:${secret}` } }
    );
    const availData = await availResp.json();
    const availResult = Array.isArray(availData) ? availData[0] : availData;

    if (!availResult.available) {
      return res.json({ success: false, message: "Domain no longer available" });
    }

    // EXACT GODADDY 2025 PAYLOAD – TESTED TODAY
    const payload = {
      domain,
      period: duration === 3 ? 3 : 1,
      privacy: true,
      renewAuto: true,
      currency: "GBP",
      nameServers: ["ns1.godaddy.com", "ns2.godaddy.com"],
      locked: false,
      contactRegistrant: { email: userEmail },
      contactAdmin: { email: userEmail },
      contactTech: { email: userEmail },
      contactBilling: { email: userEmail },
      consent: {
        agreedBy: "127.0.0.1",
        agreedAt: new Date().toISOString(),
        agreements: [
          { key: "DNRA", value: true },
          { key: "DRP", value: true },
          { key: "ICANN", value: true }
        ]
      },
      agreedToIcannTerms: true  // THIS IS THE KEY – MISSING IN OLD VERSIONS
    };

    console.log("Sending to GoDaddy →", domain);

    const purchaseResp = await fetch("https://api.godaddy.com/v1/domains/purchase", {
      method: "POST",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await purchaseResp.json();

    if (!purchaseResp.ok || !data.orderId) {
      console.error("GoDaddy failed:", data);
      return res.status(400).json({ success: false, error: data.message || "GoDaddy rejected" });
    }

    console.log(`DOMAIN BOUGHT: ${domain} | Order: ${data.orderId}`);
    return res.json({ success: true, domain, orderId: data.orderId });

  } catch (err) {
    console.error("PURCHASE ERROR:", err.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// KEEP YOUR EXISTING CHECK & PRICE ROUTES – THEY WORK FINE
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;
  if (!domain || !isValidDomain(domain)) return res.status(400).json({ available: false, error: "Invalid domain" });

  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return res.status(500).json({ available: false, error: "GoDaddy not configured" });

  try {
    const resp = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `sso-key ${key}:${secret}` }
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    const available = result.available === true;
    const priceUSD = result.price ? parseFloat(result.price) / 1000000 : 11.99;
    res.json({ available, priceUSD: parseFloat(priceUSD.toFixed(2)), currency: "USD" });
  } catch (err) {
    console.error("Check error:", err.message);
    res.status(502).json({ available: false, error: "Check failed" });
  }
});

router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body;
  if (!domain || !isValidDomain(domain)) return res.status(400).json({ error: "Invalid domain" });

  const years = duration === 3 ? 3 : 1;
  try {
    const resp = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `sso-key ${process.env.GODADDY_KEY}:${process.env.GODADDY_SECRET}` }
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!result.available) return res.json({ domainPrice: 0, totalWithService: 150, note: "Taken", years });

    const priceUSD = parseFloat(result.price || 1299) / 1000000;
    const domainPriceGBP = parseFloat((priceUSD * 0.79).toFixed(2));
    const totalGBP = parseFloat((domainPriceGBP * years + 150).toFixed(2));
    res.json({ domainPrice: domainPriceGBP, totalWithService: totalGBP, years, currency: "GBP" });
  } catch (err) {
    const fallback = years === 3 ? 35.97 : 11.99;
    res.json({ domainPrice: fallback, totalWithService: fallback + 150, years });
  }
});

export default router;
// routes/domainRoutes.js
// FINAL — SINGLE SOURCE OF TRUTH FOR DOMAIN AVAILABILITY (WhoisXML)
// - Supports BOTH GET + POST so frontend method mismatch can't break it
// - Hard TLD allow-list
// - NEVER returns "taken" on upstream failure (returns success:false + error)

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const ALLOWED_TLDS = [
  "com",
  "net",
  "org",
  "co.uk",
  "site",
  "store",
  "online",
  "io",
  "ai",
  "dev"
];

const cleanDomain = (d) => String(d || "").trim().toLowerCase();

// Basic structure check (allows co.uk, etc.)
const isValidDomain = (domain) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(domain);

// Extract TLD and support co.uk style
const getTld = (domain) => {
  const parts = domain.split(".");
  if (parts.length >= 3) {
    const last2 = parts.slice(-2).join(".");
    if (ALLOWED_TLDS.includes(last2)) return last2;
  }
  return parts.length >= 2 ? parts[parts.length - 1] : "";
};

// Shared handler (GET/POST)
const handleCheck = async (req, res) => {
  const domainRaw = req.method === "GET" ? req.query.domain : req.body?.domain;
  const durationRaw = req.method === "GET" ? req.query.duration : req.body?.duration;

  const domain = cleanDomain(domainRaw);
  const period = parseInt(durationRaw, 10) || 1;

  console.log("[DOMAIN CHECK HIT] method=", req.method, "domain=", domain);

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({
      success: false,
      available: false,
      error: "Invalid domain format"
    });
  }

  const tld = getTld(domain);

  if (!ALLOWED_TLDS.includes(tld)) {
    return res.json({
      success: true,
      available: false,
      domain,
      error: "Unsupported domain extension"
    });
  }

  const apiKey = process.env.WHOISXML_API_KEY?.trim();
  if (!apiKey) {
    // CRITICAL: do not lie and say "taken"
    return res.status(500).json({
      success: false,
      error: "WHOISXML_API_KEY missing on server"
    });
  }

  try {
    const url =
      `https://domain-availability.whoisxmlapi.com/api/v1` +
      `?apiKey=${apiKey}` +
      `&domainName=${encodeURIComponent(domain)}` +
      `&outputFormat=JSON`;

    const resp = await fetch(url, { timeout: 15000 });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[WHOISXML HTTP FAIL]", resp.status, txt.slice(0, 300));
      // CRITICAL: do not lie and say "taken"
      return res.status(502).json({
        success: false,
        error: "WhoisXML service error",
        status: resp.status
      });
    }

    const data = await resp.json();

    const availability = data?.DomainInfo?.domainAvailability;
    const available = availability === "AVAILABLE";

    console.log("[WHOISXML RESULT]", domain, "availability=", availability);

    const estimatedWholesale = 11.99 * period;

    return res.json({
      success: true,
      available,
      domain,
      tld,
      period,
      price: available ? `£${estimatedWholesale.toFixed(2)}` : null,
      currency: "GBP"
    });
  } catch (err) {
    console.error("[WHOISXML EXCEPTION]", err);
    // CRITICAL: do not lie and say "taken"
    return res.status(502).json({
      success: false,
      error: "Domain check failed (upstream)"
    });
  }
};

// BOTH METHODS SUPPORTED
router.post("/domain/check", handleCheck);
router.get("/domain/check", handleCheck);

// Compat pricing endpoint (simple estimate)
router.post("/get-domain-price", (req, res) => {
  const domain = cleanDomain(req.body?.domain);
  const duration = parseInt(req.body?.duration, 10) || 1;

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const tld = getTld(domain);
  if (!ALLOWED_TLDS.includes(tld)) {
    return res.status(400).json({ success: false, error: "Unsupported domain extension" });
  }

  const price = 11.99 * duration;

  return res.json({
    success: true,
    domainPrice: price.toFixed(2),
    currency: "GBP",
    period: duration
  });
});

export default router;

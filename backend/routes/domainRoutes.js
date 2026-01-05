// routes/domainRoutes.js
// FINAL — PUBLIC DOMAIN CHECKER (WhoisXML)
// HARD TLD BLOCK + STRIPE SAFE

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const isValidDomain = (domain) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(domain?.trim());

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

// --------------------------------------------------
// DOMAIN CHECK (PUBLIC)
// --------------------------------------------------
router.post("/domain/check", async (req, res) => {
  const { domain, duration = 1 } = req.body || {};

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({
      available: false,
      error: "Invalid domain format"
    });
  }

  const cleaned = domain.trim().toLowerCase();
  const years = parseInt(duration, 10) || 1;

  // Extract TLD (supports co.uk)
  const parts = cleaned.split(".");
  const tld = parts.length > 2
    ? parts.slice(-2).join(".")
    : parts[1];

  if (!ALLOWED_TLDS.includes(tld)) {
    return res.json({
      available: false,
      error: "Unsupported domain extension"
    });
  }

  try {
    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        available: false,
        error: "Domain service unavailable"
      });
    }

    const resp = await fetch(
      `https://domain-availability.whoisxmlapi.com/api/v1` +
      `?apiKey=${apiKey}` +
      `&domainName=${encodeURIComponent(cleaned)}` +
      `&outputFormat=JSON`
    );

    if (!resp.ok) {
      return res.json({
        available: false,
        error: "Domain lookup failed"
      });
    }

    const data = await resp.json();

    const available =
      data?.DomainInfo?.domainAvailability === "AVAILABLE";

    const price = available ? 11.99 * years : null;

    return res.json({
      available,
      domain: cleaned,
      price: available ? `£${price.toFixed(2)}` : null,
      currency: "GBP",
      period: years
    });

  } catch (err) {
    console.error("DOMAIN CHECK ERROR:", err);
    return res.status(500).json({
      available: false,
      error: "Domain check failed"
    });
  }
});

// --------------------------------------------------
// PRICE (COMPAT)
// --------------------------------------------------
router.post("/get-domain-price", (req, res) => {
  const { domain, duration = 1 } = req.body || {};
  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  const years = parseInt(duration, 10) || 1;
  const price = 11.99 * years;

  res.json({
    domainPrice: price.toFixed(2),
    currency: "GBP",
    period: years
  });
});

export default router;

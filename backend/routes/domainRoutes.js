// routes/domainRoutes.js
// FINAL — WHOISXML DOMAIN CHECK (AXIOS, HARD TIMEOUT, NO HANGS)

import express from "express";
import axios from "axios";

const router = express.Router();

const ALLOWED_TLDS = [
  "com", "net", "org", "co.uk", "site", "store", "online", "io", "ai", "dev"
];

const isValidDomain = (d) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(String(d || "").trim());

const getTld = (domain) => {
  const parts = domain.split(".");
  if (parts.length >= 3) {
    const last2 = parts.slice(-2).join(".");
    if (ALLOWED_TLDS.includes(last2)) return last2;
  }
  return parts.at(-1);
};

// SUPPORT BOTH GET + POST SO FRONTEND CANNOT BREAK IT
router.all("/domain/check", async (req, res) => {
  const domain =
    (req.method === "GET" ? req.query.domain : req.body?.domain)
      ?.toString()
      .trim()
      .toLowerCase();

  console.log("[DOMAIN CHECK HIT]", req.method, domain);

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({
      success: false,
      error: "Invalid domain"
    });
  }

  const tld = getTld(domain);
  if (!ALLOWED_TLDS.includes(tld)) {
    return res.json({
      success: true,
      available: false,
      error: "Unsupported TLD"
    });
  }

  const apiKey = process.env.WHOISXML_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "WHOISXML_API_KEY missing"
    });
  }

  try {
    const response = await axios.get(
      "https://domain-availability.whoisxmlapi.com/api/v1",
      {
        timeout: 7000,
        params: {
          apiKey,
          domainName: domain,
          outputFormat: "JSON"
        }
      }
    );

    const availability =
      response.data?.DomainInfo?.domainAvailability;

    const available = availability === "AVAILABLE";

    console.log("[WHOISXML RESULT]", domain, availability);

    return res.json({
      success: true,
      available,
      domain
    });

  } catch (err) {
    console.error(
      "[WHOISXML FAILED]",
      err.code || err.message
    );

    return res.status(502).json({
      success: false,
      error: "Domain lookup failed"
    });
  }
});

export default router;

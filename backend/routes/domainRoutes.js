// routes/domainRoutes.js
// FINAL — WHOISXML DOMAIN CHECK (HARD FAIL SAFE)

import express from "express";
import fetch from "node-fetch";
import AbortController from "abort-controller";

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

router.post("/domain/check", async (req, res) => {
  const domain = String(req.body?.domain || "").trim().toLowerCase();

  console.log("[DOMAIN CHECK HIT] domain=", domain);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url =
      `https://domain-availability.whoisxmlapi.com/api/v1` +
      `?apiKey=${apiKey}` +
      `&domainName=${encodeURIComponent(domain)}` +
      `&outputFormat=JSON`;

    const response = await fetch(url, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const txt = await response.text();
      console.error("WHOISXML HTTP ERROR:", response.status, txt);
      return res.status(502).json({
        success: false,
        error: "WhoisXML HTTP error"
      });
    }

    const data = await response.json();

    const available =
      data?.DomainInfo?.domainAvailability === "AVAILABLE";

    console.log("WHOISXML RESULT:", domain, available);

    return res.json({
      success: true,
      available,
      domain
    });

  } catch (err) {
    clearTimeout(timeout);

    console.error("WHOISXML FETCH FAILED:", err.name || err);

    return res.status(504).json({
      success: false,
      error: "Domain lookup timed out"
    });
  }
});

export default router;

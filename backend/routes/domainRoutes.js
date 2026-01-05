// routes/domainRoutes.js
// FINAL — WHOISXML DOMAIN CHECK (AXIOS, HARD TIMEOUT, ALLOW ANY TLD)

import express from "express";
import axios from "axios";

const router = express.Router();

// ✅ Allow ANY domain TLD — no whitelist
const isValidDomain = (d) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(String(d || "").trim());

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
    console.error("[WHOISXML FAILED]", err.code || err.message);

    return res.status(502).json({
      success: false,
      error: "Domain lookup failed"
    });
  }
});

export default router;

// routes/fullHostingDomainRoutes.js – FINAL, CORRECT VERSION
// Namecheap domain purchase ONLY
// NO DNS changes, NO nameserver changes
// DNS is handled later once GitHub Pages is LIVE

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    d?.trim()
  );

// -----------------------------------------------------------------------------
// DOMAIN PURCHASE (INTERNAL ONLY)
// -----------------------------------------------------------------------------
router.post("/domain/purchase", async (req, res) => {
  console.log("NAMECHEAP PURCHASE →", req.body?.domain);

  // 🔒 Internal-only guard
  const isInternal =
    req.ip === "127.0.0.1" ||
    req.hostname === "localhost" ||
    req.headers["x-internal-request"] === "yes";

  if (!isInternal) {
    return res.status(403).json({
      success: false,
      error: "Forbidden"
    });
  }

  const { domain, duration = 1 } = req.body || {};

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({
      success: false,
      error: "Invalid domain"
    });
  }

  const API_USER = process.env.NAMECHEAP_API_USER?.trim();
  const API_KEY = process.env.NAMECHEAP_API_KEY?.trim();
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP?.trim();

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.status(500).json({
      success: false,
      error: "Namecheap environment variables missing"
    });
  }

  try {
    // -------------------------------------------------------------------------
    // PURCHASE DOMAIN (WITH FREE WHOIS PRIVACY)
    // -------------------------------------------------------------------------
    const registerUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.create` +
      `&ClientIp=${CLIENT_IP}` +
      `&DomainName=${domain}` +
      `&Years=${Number(duration)}` +
      `&AddFreeWhoisguard=yes` +
      `&WGEnabled=yes`;

    const regResp = await fetch(registerUrl);
    const regText = await regResp.text();
    const regJson = parser.parse(regText);

    // -------------------------------------------------------------------------
    // ERROR HANDLING
    // -------------------------------------------------------------------------
    const errors = regJson?.ApiResponse?.Errors;
    if (errors && errors.Error) {
      const msg =
        errors.Error["#text"] ||
        JSON.stringify(errors.Error);
      console.error("Namecheap registration error:", msg);
      return res.status(400).json({
        success: false,
        error: "Namecheap rejected purchase",
        details: msg
      });
    }

    const result =
      regJson?.ApiResponse?.CommandResponse?.DomainCreateResult;

    if (!result || result["@Registered"] !== "true") {
      console.error("Unexpected Namecheap response:", regText);
      return res.status(400).json({
        success: false,
        error: "Domain registration failed"
      });
    }

    console.log(`✅ NAMECHEAP DOMAIN PURCHASED → ${domain} (${duration} year)`);

    // -------------------------------------------------------------------------
    // SUCCESS (NO DNS / NO NAMESERVERS)
    // -------------------------------------------------------------------------
    return res.json({
      success: true,
      domain,
      duration,
      message: "Domain purchased via Namecheap"
    });

  } catch (err) {
    console.error("NAMECHEAP PURCHASE EXCEPTION:", err);
    return res.status(500).json({
      success: false,
      error: "Server error during domain purchase"
    });
  }
});

// -----------------------------------------------------------------------------
// DOMAIN AVAILABILITY CHECK
// -----------------------------------------------------------------------------
router.get("/domain/check", async (req, res) => {
  const { domain } = req.query;

  if (!domain || !isValidDomain(domain)) {
    return res.json({ available: false, domain });
  }

  const API_USER = process.env.NAMECHEAP_API_USER?.trim();
  const API_KEY = process.env.NAMECHEAP_API_KEY?.trim();
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP?.trim();

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.json({
      available: false,
      error: "API variables missing"
    });
  }

  try {
    const checkUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.check` +
      `&ClientIp=${CLIENT_IP}` +
      `&DomainList=${domain}`;

    const checkResp = await fetch(checkUrl);
    const checkText = await checkResp.text();
    const checkJson = parser.parse(checkText);

    const result =
      checkJson?.ApiResponse?.CommandResponse?.DomainCheckResult;

    const available =
      Array.isArray(result)
        ? result.find(r => r["@Domain"] === domain)?.["@Available"] === "true"
        : result?.["@Available"] === "true";

    console.log(
      `NAMECHEAP CHECK → ${domain} is ${available ? "AVAILABLE" : "UNAVAILABLE"}`
    );

    return res.json({
      available,
      domain
    });

  } catch (err) {
    console.error("NAMECHEAP CHECK ERROR:", err);
    return res.json({
      available: false,
      error: "Check failed"
    });
  }
});

// -----------------------------------------------------------------------------
// DOMAIN PRICE (ESTIMATED – WHOLESALE)
// -----------------------------------------------------------------------------
router.post("/domain/price", async (req, res) => {
  const { domain, duration = 1 } = req.body || {};

  if (!domain || !isValidDomain(domain)) {
    return res.json({
      price: null,
      currency: "GBP",
      error: "Invalid domain"
    });
  }

  const priceMap = {
    store: 11.88,
    com: 10.98,
    net: 12.98,
    io: 39.99,
    co: 24.98
  };

  const tld = domain.split(".").pop().toLowerCase();
  const yearly = priceMap[tld] || 15.0;

  return res.json({
    price: yearly * Number(duration),
    currency: "GBP",
    duration,
    estimated: true
  });
});

export default router;

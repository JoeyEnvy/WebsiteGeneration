// routes/domainPriceRoutes.js
// FINAL — NAMECHEAP REAL PRICING (1–3 YEARS)

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const splitDomainSafe = (domain) => {
  const parts = domain.split(".");
  return {
    sld: parts[0],
    tld: parts.slice(1).join(".") // supports .co.uk, etc
  };
};

router.post("/domain/price", async (req, res) => {
  const domain = String(req.body?.domain || "").trim().toLowerCase();
  const duration = parseInt(req.body?.duration, 10) || 1;

  if (!domain || !domain.includes(".")) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const API_USER = process.env.NAMECHEAP_API_USER;
  const API_KEY = process.env.NAMECHEAP_API_KEY;
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.status(500).json({
      success: false,
      error: "Namecheap env vars missing"
    });
  }

  const { sld, tld } = splitDomainSafe(domain);

  try {
    const pricingUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.getPricing` +
      `&ClientIp=${CLIENT_IP}` +
      `&ProductType=DOMAIN` +
      `&ProductCategory=DOMAINS` +
      `&ActionName=REGISTER` +
      `&TLD=${encodeURIComponent(tld)}`;

    const resp = await fetch(pricingUrl);
    const text = await resp.text();
    const json = parser.parse(text);

    const prices =
      json?.ApiResponse?.CommandResponse?.UserGetPricingResult?.ProductType
        ?.ProductCategory?.Product?.Price;

    if (!prices) {
      throw new Error("Pricing not found");
    }

    const priceRow = Array.isArray(prices)
      ? prices.find(p => Number(p["@Duration"]) === duration)
      : prices["@Duration"] == duration
        ? prices
        : null;

    if (!priceRow) {
      throw new Error("No price for duration");
    }

    const price = Number(priceRow["@Price"]);
    if (!Number.isFinite(price)) {
      throw new Error("Invalid price value");
    }

    return res.json({
      success: true,
      domain,
      duration,
      domainPrice: price
    });

  } catch (err) {
    console.error("[NAMECHEAP PRICE FAILED]", err.message);
    return res.status(502).json({
      success: false,
      error: "Price lookup failed"
    });
  }
});

export default router;

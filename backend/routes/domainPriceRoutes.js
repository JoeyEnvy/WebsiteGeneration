// routes/domainPriceRoutes.js
// NAMECHEAP PRICING — SAFE FALLBACK (DOES NOT BLOCK FLOW)

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const splitDomainSafe = (domain) => {
  const parts = domain.split(".");
  return {
    sld: parts[0],
    tld: parts.slice(1).join(".")
  };
};

router.post("/domain/price", async (req, res) => {
  const domain = String(req.body?.domain || "").trim().toLowerCase();
  const duration = parseInt(req.body?.duration, 10) || 1;

  if (!domain || !domain.includes(".")) {
    return res.json({
      success: true,
      domain,
      duration,
      domainPrice: 0,
      estimated: true
    });
  }

  const API_USER = process.env.NAMECHEAP_API_USER;
  const API_KEY = process.env.NAMECHEAP_API_KEY;
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.json({
      success: true,
      domain,
      duration,
      domainPrice: 0,
      estimated: true
    });
  }

  const { tld } = splitDomainSafe(domain);

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
      json?.ApiResponse?.CommandResponse?.UserGetPricingResult
        ?.ProductType?.ProductCategory?.Product?.Price;

    const priceRow = Array.isArray(prices)
      ? prices.find(p => Number(p["@Duration"]) === duration)
      : prices?.["@Duration"] == duration
        ? prices
        : null;

    if (!priceRow || !priceRow["@Price"]) {
      // 🔑 CRITICAL FIX — DO NOT FAIL
      return res.json({
        success: true,
        domain,
        duration,
        domainPrice: 0,
        estimated: true
      });
    }

    return res.json({
      success: true,
      domain,
      duration,
      domainPrice: Number(priceRow["@Price"]),
      estimated: false
    });

  } catch (err) {
    console.error("[NAMECHEAP PRICE FAILED]", err.message);

    // 🔑 NEVER BLOCK CHECKOUT
    return res.json({
      success: true,
      domain,
      duration,
      domainPrice: 0,
      estimated: true
    });
  }
});

export default router;

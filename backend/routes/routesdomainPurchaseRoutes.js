// routes/domainPurchaseRoutes.js
// INTERNAL ONLY — Namecheap domain purchase
// Called from Stripe webhook

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    String(d || "").trim()
  );

router.post("/domain/purchase", async (req, res) => {
  const internal = req.headers["x-internal-request"] === "yes";
  if (!internal) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const domain = String(req.body?.domain || "").trim().toLowerCase();
  const years = Number(req.body?.years || 1);

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const {
    NAMECHEAP_API_KEY,
    NAMECHEAP_USERNAME,
    NAMECHEAP_CLIENT_IP
  } = process.env;

  if (!NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || !NAMECHEAP_CLIENT_IP) {
    return res
      .status(500)
      .json({ success: false, error: "Namecheap env vars missing" });
  }

  const parts = domain.split(".");
  const sld = parts.shift();
  const tld = parts.join(".");

  try {
    const url =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${NAMECHEAP_USERNAME}` +
      `&ApiKey=${NAMECHEAP_API_KEY}` +
      `&UserName=${NAMECHEAP_USERNAME}` +
      `&ClientIp=${NAMECHEAP_CLIENT_IP}` +
      `&Command=namecheap.domains.create` +
      `&DomainName=${domain}` +
      `&Years=${years}` +
      `&AddFreeWhoisguard=yes` +
      `&WGEnabled=yes`;

    const r = await fetch(url);
    const xml = await r.text();
    const json = parser.parse(xml);

    const ok =
      json?.ApiResponse?.CommandResponse?.DomainCreateResult?.["@Registered"] ===
      "true";

    if (!ok) {
      console.error("NAMECHEAP PURCHASE FAILED:", xml);
      return res.status(400).json({
        success: false,
        error: "Namecheap rejected purchase",
        raw: xml
      });
    }

    console.log("✅ DOMAIN PURCHASED:", domain);

    return res.json({ success: true, domain });

  } catch (err) {
    console.error("NAMECHEAP PURCHASE ERROR:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;

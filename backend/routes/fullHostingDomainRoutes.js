// routes/fullHostingDomainRoutes.js
// FINAL — NAMECHEAP PURCHASE ONLY
// NO AVAILABILITY CHECKS (WhoisXML handles that)

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    d?.trim()
  );

// --------------------------------------------------
// DOMAIN PURCHASE (INTERNAL ONLY)
// --------------------------------------------------
router.post("/domain/purchase", async (req, res) => {
  console.log("NAMECHEAP PURCHASE →", req.body?.domain);

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

  const API_USER = process.env.NAMECHEAP_API_USER;
  const API_KEY = process.env.NAMECHEAP_API_KEY;
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.status(500).json({
      success: false,
      error: "Namecheap env vars missing"
    });
  }

  const [sld, tld] = domain.split(".");

  try {
    const registerUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.create` +
      `&ClientIp=${CLIENT_IP}` +
      `&DomainName=${domain}` +
      `&Years=${duration}` +
      `&AddFreeWhoisguard=yes` +
      `&WGEnabled=yes`;

    const resp = await fetch(registerUrl);
    const text = await resp.text();
    const json = parser.parse(text);

    if (json?.ApiResponse?.Errors) {
      const err =
        json.ApiResponse.Errors.Error?.["#text"] ||
        "Namecheap rejected purchase";
      console.error("NAMECHEAP ERROR:", err);
      return res.status(400).json({
        success: false,
        error: err
      });
    }

    if (
      json?.ApiResponse?.CommandResponse?.DomainCreateResult?.["@Registered"] !== "true"
    ) {
      return res.status(400).json({
        success: false,
        error: "Registration failed"
      });
    }

    console.log(`DOMAIN BOUGHT → ${domain}`);

    // Set nameservers (async)
    const nsUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.dns.setCustom` +
      `&ClientIp=${CLIENT_IP}` +
      `&SLD=${sld}` +
      `&TLD=${tld}` +
      `&NameServers=ns1.vercel-dns.com,ns2.vercel-dns.com`;

    fetch(nsUrl).catch(() => {});

    return res.json({
      success: true,
      domain
    });

  } catch (err) {
    console.error("NAMECHEAP EXCEPTION:", err);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

export default router;

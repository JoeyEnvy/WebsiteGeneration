// routes/fullHostingDomainRoutes.js
// FINAL — NAMECHEAP PURCHASE ONLY (NO /domain/check IN THIS FILE)

import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const router = express.Router();
const parser = new XMLParser();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    String(d || "").trim()
  );

const splitDomainSafe = (domain) => {
  const parts = domain.split(".");
  if (parts.length < 2) return { sld: "", tld: "" };
  const sld = parts[0];
  const tld = parts.slice(1).join("."); // supports co.uk etc
  return { sld, tld };
};

router.post("/domain/purchase", async (req, res) => {
  console.log("[NAMECHEAP PURCHASE HIT]", req.body?.domain);

  const isInternal =
    req.ip === "127.0.0.1" ||
    req.hostname === "localhost" ||
    req.headers["x-internal-request"] === "yes";

  if (!isInternal) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const domain = String(req.body?.domain || "").trim().toLowerCase();
  const duration = parseInt(req.body?.duration, 10) || 1;

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  const API_USER = process.env.NAMECHEAP_API_USER?.trim();
  const API_KEY = process.env.NAMECHEAP_API_KEY?.trim();
  const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP?.trim();

  if (!API_USER || !API_KEY || !CLIENT_IP) {
    return res.status(500).json({ success: false, error: "Namecheap env vars missing" });
  }

  const { sld, tld } = splitDomainSafe(domain);

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

    const regResp = await fetch(registerUrl);
    const regText = await regResp.text();
    const regJson = parser.parse(regText);

    if (regJson?.ApiResponse?.Errors) {
      const err =
        regJson.ApiResponse.Errors.Error?.["#text"] ||
        JSON.stringify(regJson.ApiResponse.Errors);
      console.error("[NAMECHEAP REJECTED]", err);
      return res.status(400).json({ success: false, error: "Namecheap rejected", details: err });
    }

    const registered =
      regJson?.ApiResponse?.CommandResponse?.DomainCreateResult?.["@Registered"] === "true";

    if (!registered) {
      console.error("[NAMECHEAP UNEXPECTED]", regText.slice(0, 500));
      return res.status(400).json({ success: false, error: "Registration failed" });
    }

    // Optional nameserver set (fire and forget)
    const nsUrl =
      `https://api.namecheap.com/xml.response` +
      `?ApiUser=${API_USER}` +
      `&ApiKey=${API_KEY}` +
      `&UserName=${API_USER}` +
      `&Command=namecheap.domains.dns.setCustom` +
      `&ClientIp=${CLIENT_IP}` +
      `&SLD=${encodeURIComponent(sld)}` +
      `&TLD=${encodeURIComponent(tld)}` +
      `&NameServers=ns1.vercel-dns.com,ns2.vercel-dns.com`;

    fetch(nsUrl).catch(() => {});

    return res.json({ success: true, domain, message: "Domain purchased via Namecheap" });
  } catch (err) {
    console.error("[NAMECHEAP EXCEPTION]", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;

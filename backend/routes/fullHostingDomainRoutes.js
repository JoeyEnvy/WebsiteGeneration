// routes/fullHostingDomainRoutes.js
import express from "express";
import fetch from "node-fetch";
import { tempSessions } from "../index.js";

const router = express.Router();

/* ============================================================
   Utility: Validate domain format
   ============================================================ */
export const isValidDomain = (d) =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || "").trim());

/* ============================================================
   Helper: Internal proxy call to Porkbun via /api/proxy/porkbun
   ============================================================ */
async function callPorkbun(endpoint, payload) {
  const proxyUrl = `${process.env.PUBLIC_URL || "https://website-generation.vercel.app"}/api/proxy/porkbun`;
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `https://api.porkbun.com/api/json/v3/${endpoint}`,
      payload
    })
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("⚠️ Invalid JSON from proxy:", text.slice(0, 200));
    throw new Error("Invalid JSON from Porkbun");
  }
}

/* ============================================================
   GET /full-hosting/domain/check → Check availability
   ============================================================ */
router.get("/domain/check", async (req, res) => {
  const { domain = "" } = req.query;
  const cleanedDomain = domain.trim().toLowerCase();

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ available: false, error: "Invalid domain format" });
  }

  try {
    const data = await callPorkbun("domain/check", {
      apikey: process.env.PORKBUN_API_KEY,
      secretapikey: process.env.PORKBUN_SECRET_KEY,
      domain: cleanedDomain
    });

    console.log("🧩 Porkbun check response:", data);

    if (data.status !== "SUCCESS") {
      return res.status(200).json({
        available: false,
        error: data.message || "Check failed",
        code: data.status
      });
    }

    const isAvailable =
      data.available === "yes" || data.available === "1" || data.available === true;

    return res.json({ available: isAvailable });
  } catch (err) {
    console.error("❌ Domain check failed:", err);
    return res.status(502).json({ available: false, error: "Availability check failed" });
  }
});

/* ============================================================
   POST /full-hosting/domain/price → Estimate price
   ============================================================ */
router.post("/domain/price", (req, res) => {
  try {
    const { domain, duration } = req.body || {};
    const cleanedDomain = (domain || "").trim().toLowerCase();

    if (!isValidDomain(cleanedDomain)) {
      return res.status(400).json({ error: "Invalid domain" });
    }

    const years = parseInt(duration || "1", 10);
    const basePrice = 15.99;
    const domainPrice = +(basePrice * years).toFixed(2);

    res.json({ domainPrice, currency: "GBP", period: years });
  } catch (err) {
    console.error("❌ Price estimation failed:", err);
    res.status(500).json({ error: "Price estimation failed" });
  }
});

/* ============================================================
   POST /deploy-full-hosting/domain → Purchase domain
   ============================================================ */
router.post("/deploy-full-hosting/domain", async (req, res) => {
  try {
    const { sessionId = "", domain = "", durationYears, duration = "1" } = req.body || {};
    const cleanedDomain = (domain || "").trim().toLowerCase();
    const years = parseInt(durationYears ?? duration, 10) || 1;

    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    if (!cleanedDomain || !isValidDomain(cleanedDomain)) {
      return res.status(400).json({ error: `Invalid domain: ${cleanedDomain || "(empty)"}` });
    }

    const session = tempSessions[sessionId];
    if (!session?.pages?.length) {
      return res.status(404).json({ error: "Session not found or empty." });
    }

    if (session.lockedDomain && session.lockedDomain !== cleanedDomain) {
      return res.status(409).json({
        error: `Domain mismatch. Locked: ${session.lockedDomain}, Got: ${cleanedDomain}`,
        code: "DOMAIN_MISMATCH"
      });
    }

    /* ---------- 1️⃣ Check availability ---------- */
    const checkData = await callPorkbun("domain/check", {
      apikey: process.env.PORKBUN_API_KEY,
      secretapikey: process.env.PORKBUN_SECRET_KEY,
      domain: cleanedDomain
    });

    const available =
      checkData.status === "SUCCESS" &&
      (checkData.available === "yes" || checkData.available === "1" || checkData.available === true);

    console.log("🔎 Availability check:", checkData);

    if (!available) {
      return res.status(409).json({ error: "Domain unavailable or already registered" });
    }

    /* ---------- 2️⃣ Purchase ---------- */
    const contact = {
      nameFirst: "Website",
      nameLast: "Customer",
      emailAddress: "support@websitegenerator.co.uk",
      phone: "+44.2030000000",
      address: "123 Example Street",
      city: "London",
      state: "London",
      postalcode: "EC1A1AA",
      country: "GB"
    };

    const purchaseData = await callPorkbun("domain/create", {
      apikey: process.env.PORKBUN_API_KEY,
      secretapikey: process.env.PORKBUN_SECRET_KEY,
      domain: cleanedDomain,
      years,
      contact
    });

    console.log("🛒 Purchase response:", purchaseData);

    if (purchaseData.status !== "SUCCESS") {
      throw new Error(purchaseData.message || JSON.stringify(purchaseData));
    }

    /* ---------- 3️⃣ Update session ---------- */
    tempSessions[sessionId] = { ...session, domain: cleanedDomain, domainPurchased: true };

    res.json({ success: true, customDomain: cleanedDomain, years });
  } catch (err) {
    console.error("❌ Domain step failed:", err);
    res.status(500).json({ error: "Domain validation/purchase failed", detail: err.message });
  }
});

export default router;

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
   GET /full-hosting/domain/check → Check availability (Porkbun)
   ============================================================ */
router.get("/domain/check", async (req, res) => {
  const { domain = "" } = req.query;
  const cleanedDomain = domain.trim().toLowerCase();

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ available: false, error: "Invalid domain format" });
  }

  try {
    const response = await fetch(
      // ✅ Use AllOrigins proxy instead of corsproxy.io
      `https://api.allorigins.win/raw?url=${encodeURIComponent("https://api.porkbun.com/api/json/v3/domain/check")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WebsiteGenerator/1.0"
        },
        body: JSON.stringify({
          apikey: process.env.PORKBUN_API_KEY,
          secretapikey: process.env.PORKBUN_SECRET_KEY,
          domain: cleanedDomain
        }),
        timeout: 10000
      }
    );

    const text = await response.text();
    console.log("🧩 Raw response from Porkbun:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("⚠️ Non-JSON response:", text.slice(0, 200));
      return res.status(502).json({
        available: false,
        error: "Invalid response from Porkbun (HTML)",
        raw: text.slice(0, 200)
      });
    }

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
    console.error("❌ Availability check failed:", err);
    return res.status(200).json({ available: false, error: "Availability check failed" });
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
   POST /deploy-full-hosting/domain → Purchase domain (Porkbun)
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

    /* ---------- 1️⃣ Pre-check availability ---------- */
    let available = false;
    try {
      const checkRes = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent("https://api.porkbun.com/api/json/v3/domain/check")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
            domain: cleanedDomain
          })
        }
      );
      const checkData = await checkRes.json();
      available =
        checkData.status === "SUCCESS" &&
        (checkData.available === "yes" || checkData.available === "1" || checkData.available === true);
      console.log("🔎 Pre-check", checkData);
    } catch (e) {
      console.warn("⚠️ Availability pre-check failed:", e.message);
    }

    /* ---------- 2️⃣ Purchase if available ---------- */
    if (available) {
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

      const purchasePayload = {
        apikey: process.env.PORKBUN_API_KEY,
        secretapikey: process.env.PORKBUN_SECRET_KEY,
        domain: cleanedDomain,
        years,
        contact
      };

      const purchaseRes = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent("https://api.porkbun.com/api/json/v3/domain/create")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(purchasePayload)
        }
      );

      const purchaseData = await purchaseRes.json();
      console.log("🛒 Purchase response", purchaseData);

      if (purchaseData.status !== "SUCCESS") {
        throw new Error(purchaseData.message || JSON.stringify(purchaseData));
      }

      console.log(`✅ Domain ${cleanedDomain} purchased successfully.`);
    } else {
      return res.status(409).json({ error: "Domain unavailable or already registered" });
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

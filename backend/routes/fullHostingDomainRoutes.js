import express from "express";
import fetch from "node-fetch";
import { tempSessions } from "../index.js";

const router = express.Router();

/* ============================================================
   Utility: Validate domain format
   ============================================================ */
export const isValidDomain = (d) =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(String(d || "").trim().toLowerCase());

/* ============================================================
   GET /domain/check  →  Check availability (Porkbun)
   ============================================================ */
router.get("/domain/check", async (req, res) => {
  const { domain = "" } = req.query;
  const cleanedDomain = domain.trim().toLowerCase();

  if (!isValidDomain(cleanedDomain)) {
    return res
      .status(400)
      .json({ available: false, error: "Invalid domain format" });
  }

  try {
    const response = await fetch(
      "https://api.porkbun.com/api/json/v3/domain/check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: process.env.PORKBUN_API_KEY,
          secretapikey: process.env.PORKBUN_SECRET_KEY,
          domain: cleanedDomain,
        }),
      }
    );

    const data = await response.json();
    console.log("🧩 Porkbun domain check", cleanedDomain, "→", data);

    if (data.status !== "SUCCESS") {
      return res.status(200).json({
        available: false,
        error: data.message || "Check failed",
        code: data.status,
      });
    }

    return res.json({ available: data.available === "yes" });
  } catch (err) {
    console.error("❌ Availability check failed:", err);
    return res
      .status(200)
      .json({ available: false, error: "Availability check failed" });
  }
});

/* ============================================================
   POST /domain/price  →  Estimate price
   ============================================================ */
router.post("/domain/price", (req, res) => {
  try {
    const { domain, duration } = req.body || {};
    const cleanedDomain = (domain || "").trim().toLowerCase();

    if (!isValidDomain(cleanedDomain)) {
      return res.status(400).json({ error: "Invalid domain" });
    }

    const years = parseInt(duration || "1", 10);
    const basePrice = 15.99; // placeholder
    const domainPrice = basePrice * years;

    res.json({ domainPrice });
  } catch (err) {
    console.error("❌ Price estimation failed:", err);
    res.status(500).json({ error: "Price estimation failed" });
  }
});

/* ============================================================
   POST /deploy-full-hosting/domain  →  Purchase domain (Porkbun)
   ============================================================ */
router.post("/deploy-full-hosting/domain", async (req, res) => {
  try {
    const { sessionId = "", domain = "", durationYears, duration = "1" } =
      req.body || {};
    const cleanedDomain = (domain || "").trim().toLowerCase();
    const years = parseInt(durationYears ?? duration, 10) || 1;

    if (!sessionId)
      return res.status(400).json({ error: "Missing sessionId" });
    if (!cleanedDomain || !isValidDomain(cleanedDomain)) {
      return res
        .status(400)
        .json({ error: `Invalid domain: ${cleanedDomain || "(empty)"}` });
    }

    const session = tempSessions[sessionId];
    if (!session?.pages?.length) {
      return res.status(404).json({ error: "Session not found or empty." });
    }

    if (session.lockedDomain && session.lockedDomain !== cleanedDomain) {
      return res.status(409).json({
        error: `Domain mismatch. Locked: ${session.lockedDomain}, Got: ${cleanedDomain}`,
        code: "DOMAIN_MISMATCH",
      });
    }

    /* ---------- 1️⃣ Pre-check availability ---------- */
    let available = false;
    try {
      const checkRes = await fetch(
        "https://api.porkbun.com/api/json/v3/domain/check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
            domain: cleanedDomain,
          }),
        }
      );
      const checkData = await checkRes.json();
      available = checkData.status === "SUCCESS" && checkData.available === "yes";
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
        country: "GB",
      };

      const purchasePayload = {
        apikey: process.env.PORKBUN_API_KEY,
        secretapikey: process.env.PORKBUN_SECRET_KEY,
        domain: cleanedDomain,
        years,
        contact,
      };

      try {
        const purchaseRes = await fetch(
          "https://api.porkbun.com/api/json/v3/domain/create",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(purchasePayload),
          }
        );

        const purchaseData = await purchaseRes.json();
        console.log("🛒 Purchase response", purchaseData);

        if (purchaseData.status !== "SUCCESS") {
          throw new Error(
            purchaseData.message || JSON.stringify(purchaseData)
          );
        }

        console.log(`✅ Domain ${cleanedDomain} purchased successfully.`);
      } catch (err) {
        console.error("❌ Domain purchase failed:", err);
        return res
          .status(500)
          .json({ error: "Domain purchase failed", detail: err.message });
      }
    } else {
      return res
        .status(409)
        .json({ error: "Domain unavailable or already registered" });
    }

    /* ---------- 3️⃣ Update session ---------- */
    tempSessions[sessionId] = {
      ...session,
      domain: cleanedDomain,
      domainPurchased: true,
    };

    res.json({ success: true, customDomain: cleanedDomain, years });
  } catch (err) {
    console.error("❌ Domain step failed:", err);
    res
      .status(500)
      .json({ error: "Domain validation/purchase failed", detail: err.message });
  }
});

export default router;

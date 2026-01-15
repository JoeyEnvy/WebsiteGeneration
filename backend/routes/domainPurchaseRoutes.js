// routes/domainPurchaseRoutes.js
// INTERNAL ONLY — Domain purchase proxy
// Called from Stripe webhook
// Render → DigitalOcean → Namecheap

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    String(d || "").trim()
  );

router.post("/domain/purchase", async (req, res) => {
  // 🔒 INTERNAL ONLY (Stripe webhook)
  if (req.headers["x-internal-request"] !== "yes") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const domain = String(req.body?.domain || "").trim().toLowerCase();
  const duration = Number(req.body?.duration || req.body?.years || 1);

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({ success: false, error: "Invalid domain" });
  }

  if (![1, 2, 3, 4, 5].includes(duration)) {
    return res.status(400).json({ success: false, error: "Invalid duration" });
  }

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;

  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET) {
    return res.status(500).json({
      success: false,
      error: "Domain buyer service not configured"
    });
  }

  try {
    // 🚀 PROXY TO DIGITALOCEAN (STATIC IP)
    const r = await fetch(
      `${DOMAIN_BUYER_URL}/internal/namecheap/purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET
        },
        body: JSON.stringify({ domain, duration })
      }
    );

    const text = await r.text();

    if (!r.ok) {
      console.error("❌ DOMAIN BUYER FAILED:", text);
      return res.status(400).json({
        success: false,
        error: "Domain buyer rejected purchase",
        raw: text
      });
    }

    const data = JSON.parse(text);

    console.log("✅ DOMAIN PURCHASED VIA DO:", domain, `(${duration} year(s))`);

    return res.json(data);

  } catch (err) {
    console.error("DOMAIN BUYER PROXY ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Domain buyer proxy error"
    });
  }
});

export default router;

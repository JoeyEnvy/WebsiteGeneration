// ========================================================================
// Stripe Checkout Routes (Full Hosting + Porkbun Integration Ready)
// ========================================================================

import express from "express";
import Stripe from "stripe";
import { tempSessions } from "../index.js";

const router = express.Router();

// ========================================================================
// Stripe Init
// ========================================================================
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("❌ STRIPE_SECRET_KEY missing in environment variables");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ========================================================================
// Helpers
// ========================================================================
const isValidDomain = (d) =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || "").trim());

const clampYears = (n) => Math.max(1, Math.min(10, parseInt(n, 10) || 1));

// 💷 Prices in pence (test values)
const priceMap = {
  "zip-download": { price: 50, name: "ZIP File Only (Test Mode)" },
  "github-instructions": {
    price: 50,
    name: "GitHub Self-Deployment (Test Mode)",
  },
  "github-hosted": {
    price: 50,
    name: "GitHub Hosting + Support (Test Mode)",
  },
  "full-hosting": {
    price: 50,
    name: "Full Hosting + Custom Domain (Test Mode)",
  },
  "netlify-hosted": {
    price: 50,
    name: "Netlify Hosted Deployment (Test Mode)",
  },
};

// ========================================================================
// POST /stripe/create-checkout-session
// ========================================================================
router.post("/create-checkout-session", async (req, res) => {
  console.log("🧾 Stripe checkout request:", req.body);

  try {
    const {
      type,
      sessionId,
      businessName,
      domain: domainRaw,
      durationYears,
      duration,
      email,
    } = req.body || {};

    const domain = (domainRaw || "").trim().toLowerCase();
    const years = clampYears(durationYears ?? duration ?? 1);

    if (!type || !sessionId) {
      return res
        .status(400)
        .json({ error: "Missing deployment type or sessionId." });
    }

    if (type === "full-hosting") {
      if (!domain)
        return res
          .status(400)
          .json({ error: "Domain is required for full-hosting." });
      if (!isValidDomain(domain))
        return res
          .status(400)
          .json({ error: `Invalid domain format: ${domain}` });
    }

    // ✅ Store session details
    tempSessions[sessionId] ??= {};
    if (businessName) tempSessions[sessionId].businessName = businessName;
    if (domain) {
      tempSessions[sessionId].domain = domain;
      tempSessions[sessionId].lockedDomain = domain;
    }
    tempSessions[sessionId].domainDuration = String(years);

    const product = priceMap[type];
    if (!product)
      return res.status(400).json({ error: "Invalid deployment option." });

    // ✅ Public URL setup
    const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
    if (!PUBLIC_URL) {
      console.error("❌ PUBLIC_URL is missing!");
      return res
        .status(500)
        .json({ error: "PUBLIC_URL is not set on the server." });
    }

    // ✅ Success redirect mapping
    const successUrlMap = {
      "full-hosting": `${PUBLIC_URL}/fullhosting.html?option=${encodeURIComponent(
        type
      )}&sessionId=${encodeURIComponent(sessionId)}&domain=${encodeURIComponent(
        domain
      )}&duration=${encodeURIComponent(String(years))}&session_id={CHECKOUT_SESSION_ID}`,
      "github-hosted": `${PUBLIC_URL}/payment-success.html?option=${encodeURIComponent(
        type
      )}&sessionId=${encodeURIComponent(
        sessionId
      )}&session_id={CHECKOUT_SESSION_ID}`,
      "netlify-hosted": `${PUBLIC_URL}/netlify-success.html?option=${encodeURIComponent(
        type
      )}&sessionId=${encodeURIComponent(
        sessionId
      )}&session_id={CHECKOUT_SESSION_ID}`,
      default: `${PUBLIC_URL}/payment-success.html?option=${encodeURIComponent(
        type
      )}&sessionId=${encodeURIComponent(
        sessionId
      )}&session_id={CHECKOUT_SESSION_ID}`,
    };

    // ✅ Create checkout session
    const line_items = process.env.STRIPE_PRICE_ID
      ? [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "gbp",
              product_data: { name: product.name },
              unit_amount: product.price,
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      line_items,
      metadata: {
        sessionId,
        type,
        domain,
        durationYears: String(years),
        businessName: businessName || "",
      },
      client_reference_id: sessionId,
      success_url: successUrlMap[type] || successUrlMap.default,
      cancel_url: `${PUBLIC_URL}/payment-cancelled.html`,
    });

    console.log("✅ Stripe session created:", session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe session creation failed:", err);
    const msg =
      err?.raw?.message || err?.message || "Failed to create Stripe session";
    res.status(500).json({ error: msg });
  }
});

export default router;

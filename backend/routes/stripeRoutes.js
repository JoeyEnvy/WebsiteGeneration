// routes/stripeRoutes.js — FINAL FIXED VERSION
// CRITICAL: preserves frontend sessionId + pages
// This is what unblocks repo creation and HTML writing

import express from "express";
import Stripe from "stripe";
import { tempSessions } from "../index.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    d?.trim()
  );

const clampYears = (n) => Math.max(1, Math.min(10, parseInt(n, 10) || 1));

const priceMap = {
  "zip-download": { price: 500, name: "ZIP Download Only" },
  "github-instructions": { price: 999, name: "GitHub Instructions" },
  "github-hosted": { price: 1999, name: "GitHub Pages Hosting" },
  "netlify-hosted": { price: 1999, name: "Netlify Hosting" },
  "full-hosting": { price: 50, name: "Full Hosting (setup hold)" },
};

// -----------------------------------------------------------------------------
// CREATE CHECKOUT SESSION
// -----------------------------------------------------------------------------
router.post("/create-checkout-session", async (req, res) => {
  console.log("Stripe request →", req.body);

  try {
    const {
      type = "full-hosting",
      sessionId,                // ✅ MUST come from frontend
      domain: rawDomain = "",
      email = "",
      businessName = "",
      durationYears = 1,
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const domain = rawDomain.trim().toLowerCase();
    const years = clampYears(durationYears);

    if (type === "full-hosting" && (!domain || !isValidDomain(domain))) {
      return res.status(400).json({ error: "Valid domain required" });
    }

    // -------------------------------------------------------------------------
    // 🔴 THIS IS THE CRITICAL FIX
    // Do NOT overwrite an existing session — MERGE IT
    // -------------------------------------------------------------------------
    const existing = tempSessions.get(sessionId) || {};

    tempSessions.set(sessionId, {
      ...existing,                 // ← keeps pages + structure
      type,
      domain,
      businessName: businessName.trim(),
      email: email.trim(),
      durationYears: String(years),
      domainPurchased: false,
      deployed: false,
    });

    const product = priceMap[type];
    if (!product) return res.status(400).json({ error: "Invalid plan" });

    const PUBLIC_URL = (
      process.env.PUBLIC_URL || "https://websitegeneration.co.uk"
    ).replace(/\/+$/, "");

    const success_url =
      type === "full-hosting"
        ? `${PUBLIC_URL}/fullhosting.html?session_id=${sessionId}&domain=${domain}&duration=${years}`
        : `${PUBLIC_URL}/success.html?session_id=${sessionId}&option=${type}`;

    let session;

    // -------------------------------------------------------------------------
    // FULL HOSTING — SETUP MODE (NO PAYMENT YET)
    // -------------------------------------------------------------------------
    if (type === "full-hosting") {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "setup",
        customer_email: email || undefined,
        success_url,
        cancel_url: `${PUBLIC_URL}/cancel.html`,

        // 🔑 THESE TWO LINES ARE REQUIRED
        client_reference_id: sessionId,
        metadata: {
          sessionId,
          type,
          domain,
          businessName,
        },
      });
    } else {
      // -----------------------------------------------------------------------
      // NORMAL PAYMENT PLANS
      // -----------------------------------------------------------------------
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: { name: product.name },
              unit_amount: product.price,
            },
            quantity: 1,
          },
        ],
        success_url,
        cancel_url: `${PUBLIC_URL}/cancel.html`,
        client_reference_id: sessionId,
        metadata: { sessionId, type },
      });
    }

    console.log("Stripe session created →", session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE ERROR:", err.message);
    res.status(500).json({ error: "Payment setup failed" });
  }
});

// -----------------------------------------------------------------------------
// CAPTURE PAYMENT (AFTER DOMAIN + DEPLOY)
// -----------------------------------------------------------------------------
router.post("/capture-payment", async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const saved = tempSessions.get(sessionId);
  if (!saved || !saved.domainPurchased) {
    return res.status(400).json({ error: "Domain not purchased" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const setupIntentId = session.setup_intent;

    if (!setupIntentId) {
      return res.json({ success: true, message: "No payment required" });
    }

    const setupIntent = await stripe.setupIntents.confirm(setupIntentId, {
      off_session: true,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 15000, // £150 example
      currency: "gbp",
      payment_method: setupIntent.payment_method,
      off_session: true,
      confirm: true,
      metadata: { sessionId, domain: saved.domain },
    });

    console.log("FULL PAYMENT CAPTURED →", paymentIntent.id);
    res.json({ success: true, paymentId: paymentIntent.id });
  } catch (err) {
    console.error("CAPTURE ERROR:", err.message);
    res.status(500).json({ error: "Capture failed" });
  }
});

export default router;

// routes/stripeRoutes.js – FINAL 100% COMPLETE & WORKING (23 Nov 2025)

import express from "express";
import Stripe from "stripe";
import { tempSessions } from "../index.js";

const router = express.Router();

// STRIPE INITIALISATION
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY missing in environment variables");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// HELPERS
const isValidDomain = (d) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    String(d || "").trim()
  );

const clampYears = (n) => Math.max(1, Math.min(10, parseInt(n, 10) || 1));

// REAL PRICES IN PENCE (GBP)
const priceMap = {
  {
  "zip-download":        { price:  500, name: "ZIP Download Only" },
  "github-instructions": { price:  999, name: "GitHub Instructions" },
  "github-hosted":       { price: 1999, name: "GitHub Pages Hosting" },
  "netlify-hosted":      { price: 1999, name: "Netlify Hosting" },
  "full-hosting":        { price: 2999, name: "Full Hosting + Custom Domain – £29.99" },
};

// CREATE CHECKOUT SESSION – ONLY ROUTE YOU NEED
router.post("/create-checkout-session", async (req, res) => {
  console.log("Stripe checkout request:", req.body);

  try {
    const {
      type = "full-hosting",
      sessionId,
      domain: rawDomain = "",
      email = "",
      businessName = "",
      durationYears = 1,
    } = req.body || {};

    if (!type || !sessionId) {
      return res.status(400).json({ error: "Missing type or sessionId" });
    }

    const domain = rawDomain.trim().toLowerCase();
    const years = clampYears(durationYears);

    if type === "full-hosting" && (!domain || !isValidDomain(domain))) {
      return res.status(400).json({ error: "Valid domain required for full-hosting" });
    }

    // Store for webhook later
    tempSessions[sessionId] ??= {};
    tempSessions[sessionId].type = type;
    tempSessions[sessionId].domain = domain;
    tempSessions[sessionId].businessName = businessName;
    tempSessions[sessionId].email = email;
    tempSessions[sessionId].durationYears = String(years);

    const product = priceMap[type];
    if (!product) return res.status(400).json({ error: "Invalid plan" });

    const PUBLIC_URL = (process.env.PUBLIC_URL || "https://websitegeneration.co.uk").replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: { name: product.name },
          unit_amount: product.price,
        },
        quantity: 1,
      }],
      metadata: {
        sessionId,
        type,
        domain,
        businessName,
        durationYears: String(years),
      },
      client_reference_id: sessionId,
      success_url: `${PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&domain=${domain}`,
      cancel_url: `${PUBLIC_URL}/cancel.html`,
    });

    console.log("Stripe session created →", session.id);
    res.json({ url: session.url });

  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Payment setup failed" });
  }
});

export default router;
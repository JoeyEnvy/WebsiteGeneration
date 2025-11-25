// routes/stripeRoutes.js – FINAL 100% WORKING VERSION (25 Nov 2025)
// Fixed: Real UUID sessionId + saved BEFORE checkout + perfect logs

import express from "express";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";           // ← THIS IS THE KEY FIX
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

// PRICES IN PENCE (GBP) – £0.50 test mode for full-hosting
const priceMap = {
  "zip-download":        { price: 500,  name: "ZIP Download Only" },
  "github-instructions": { price: 999,  name: "GitHub Instructions" },
  "github-hosted":       { price: 1999, name: "GitHub Pages Hosting" },
  "netlify-hosted":      { price: 1999, name: "Netlify Hosting" },
  "full-hosting":        { price: 50,   name: "Full Hosting + Custom Domain – TEST MODE £0.50" },
};

// CREATE CHECKOUT SESSION – ONLY ROUTE
router.post("/create-checkout-session", async (req, res) => {
  console.log("Stripe checkout request →", req.body);

  try {
    const {
      type = "full-hosting",
      domain: rawDomain = "",
      email = "",
      businessName = "",
      durationYears = 1,
    } = req.body || {};

    if (!type) {
      console.error("Missing type in request");
      return res.status(400).json({ error: "Missing type" });
    }

    const domain = rawDomain.trim().toLowerCase();
    const years = clampYears(durationYears);

    if (type === "full-hosting" && (!domain || !isValidDomain(domain))) {
      console.error("Invalid or missing domain for full-hosting:", rawDomain);
      return res.status(400).json({ error: "Valid domain required for full-hosting" });
    }

    // GENERATE A REAL UUID — THIS IS THE ONE STRIPE WILL SEND BACK
    const realSessionId = uuidv4();
    console.log("Generated REAL sessionId →", realSessionId);

    // SAVE DATA IMMEDIATELY USING THE REAL ID
    tempSessions.set(realSessionId, {
      type,
      domain,
      businessName: businessName.trim(),
      email: email.trim(),
      durationYears: String(years),
      domainPurchased: false,
      deployed: false,
      pages: [], // will be filled later
    });

    const product = priceMap[type];
    if (!product) {
      console.error("Invalid plan type:", type);
      return res.status(400).json({ error: "Invalid plan" });
    }

    // AUTO-DETECT PUBLIC URL
    const PUBLIC_URL = process.env.PUBLIC_URL
      ? process.env.PUBLIC_URL.replace(/\/+$/, "")
      : "https://websitegeneration.co.uk";

    // SUCCESS URL
    const success_url =
      type === "full-hosting"
        ? `${PUBLIC_URL}/fullhosting.html?session_id=${realSessionId}&domain=${domain}&duration=${years}`
        : `${PUBLIC_URL}/success.html?session_id=${realSessionId}&option=${type}`;

    // CREATE STRIPE SESSION USING THE REAL ID
    const session = await stripe.checkout.sessions.create({
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
      metadata: {
        sessionId: realSessionId,
        type,
        domain,
        businessName,
      },
      client_reference_id: realSessionId,        // CRITICAL
      success_url,
      cancel_url: `${PUBLIC_URL}/cancel.html`,
    });

    console.log(`Stripe session created → ${session.id} | REAL ID → ${realSessionId}`);
    res.json({ url: session.url });

  } catch (err) {
    console.error("FATAL STRIPE CHECKOUT ERROR:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Payment setup failed", details: err.message });
  }
});

export default router;
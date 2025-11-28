// routes/stripeRoutes.js – FIXED: No payment_intent_data error (25 Nov 2025)
import express from "express";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { tempSessions } from "../index.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const isValidDomain = (d) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(d?.trim());

const clampYears = (n) => Math.max(1, Math.min(10, parseInt(n, 10) || 1));

const priceMap = {
  "zip-download": { price: 500, name: "ZIP Download Only" },
  "github-instructions": { price: 999, name: "GitHub Instructions" },
  "github-hosted": { price: 1999, name: "GitHub Pages Hosting" },
  "netlify-hosted": { price: 1999, name: "Netlify Hosting" },
  "full-hosting": { price: 50, name: "Full Hosting Authorization (£0.50 hold)" },
};

// CREATE SETUP INTENT – £0.50 HOLD (No Charge Yet)
router.post("/create-checkout-session", async (req, res) => {
  console.log("Stripe request →", req.body);

  try {
    const {
      type = "full-hosting",
      domain: rawDomain = "",
      email = "",
      businessName = "",
      durationYears = 1,
    } = req.body || {};

    if (!type) return res.status(400).json({ error: "Missing type" });

    const domain = rawDomain.trim().toLowerCase();
    const years = clampYears(durationYears);

    if (type === "full-hosting" && (!domain || !isValidDomain(domain))) {
      return res.status(400).json({ error: "Valid domain required" });
    }

    const sessionId = uuidv4();
    console.log("REAL sessionId →", sessionId);

    tempSessions.set(sessionId, {
      type,
      domain,
      businessName: businessName.trim(),
      email: email.trim(),
      durationYears: String(years),
      domainPurchased: false,
      deployed: false,
      pages: [],
    });

    const product = priceMap[type];
    if (!product) return res.status(400).json({ error: "Invalid plan" });

    const PUBLIC_URL = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, "") : "https://websitegeneration.co.uk";

    const success_url = type === "full-hosting"
      ? `${PUBLIC_URL}/fullhosting.html?session_id=${sessionId}&domain=${domain}&duration=${years}`
      : `${PUBLIC_URL}/success.html?session_id=${sessionId}&option=${type}`;

    let session;
    if (type === "full-hosting") {
      // SETUP MODE – £0.50 HOLD (No payment_intent_data)
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "setup", // FIXED: Setup mode, no payment_intent_data
        customer_email: email || undefined,
        success_url,
        cancel_url: `${PUBLIC_URL}/cancel.html`,
        metadata: { sessionId, type, domain, businessName },
      });
    } else {
      // SIMPLE PAYMENT FOR OTHER PLANS
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

// CAPTURE FULL PAYMENT AFTER SUCCESS
router.post("/capture-payment", async (req, res) => {
  const { sessionId } = req.body || {};

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const saved = tempSessions.get(sessionId);
  if (!saved || !saved.domainPurchased) return res.status(400).json({ error: "Domain not purchased" });

  try {
    // Get the SetupIntent from the session (you'll need to retrieve the session first in frontend)
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const setupIntentId = session.setup_intent;

    if (setupIntentId) {
      const setupIntent = await stripe.setupIntents.confirm(setupIntentId, { off_session: true });
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000, // Full £150 in pence
        currency: "gbp",
        payment_method: setupIntent.payment_method,
        off_session: true,
        confirm: true,
        metadata: { sessionId, domain: saved.domain },
      });

      console.log("FULL PAYMENT CAPTURED →", paymentIntent.id);
      res.json({ success: true, paymentId: paymentIntent.id });
    } else {
      res.json({ success: true, message: "No additional payment needed" });
    }
  } catch (err) {
    console.error("CAPTURE ERROR:", err.message);
    res.status(500).json({ error: "Capture failed" });
  }
});

export default router;
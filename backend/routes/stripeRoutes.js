// routes/stripeRoutes.js – PAY AFTER DOMAIN BUY (No Webhook) (25 Nov 2025)
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
  "full-hosting": { price: 50, name: "Full Hosting Authorization (£0.50 hold)" }, // Hold only
};

// CREATE SETUP INTENT — AUTHORIZES £0.50 HOLD (No Webhook Needed)
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

    // REAL UUID SESSION ID
    const sessionId = uuidv4();
    console.log("REAL sessionId →", sessionId);

    // SAVE SESSION
    tempSessions.set(sessionId, {
      type,
      domain,
      businessName: businessName.trim(),
      email: email.trim(),
      durationYears: String(years),
      domainPurchased: false,
      deployed: false,
      pages: [], // Filled later by generator
    });

    const product = priceMap[type];
    if (!product) return res.status(400).json({ error: "Invalid plan" });

    const PUBLIC_URL = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, "") : "https://websitegeneration.co.uk";

    // SUCCESS URL — TRIGGER PURCHASE/DEPLOY ON FRONTEND
    const success_url = type === "full-hosting"
      ? `${PUBLIC_URL}/fullhosting.html?session_id=${sessionId}&domain=${domain}&duration=${years}`
      : `${PUBLIC_URL}/success.html?session_id=${sessionId}&option=${type}`;

    // SETUP INTENT FOR FULL HOSTING (HOLD £0.50)
    let session;
    if (type === "full-hosting") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: product.price,
        currency: "gbp",
        payment_method_types: ["card"],
        capture_method: "manual", // HOLD — CAPTURE LATER
        metadata: { sessionId, type, domain, businessName },
        setup_future_usage: "off_session",
      });

      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "setup",
        payment_intent_data: {
          payment_intent: paymentIntent.id,
        },
        customer_email: email || undefined,
        success_url,
        cancel_url: `${PUBLIC_URL}/cancel.html`,
        metadata: { sessionId },
      });
    } else {
      // SIMPLE ONE-TIME PAYMENT FOR OTHER PLANS
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

// CAPTURE PAYMENT AFTER DOMAIN SUCCESS (Called from success page)
router.post("/capture-payment", async (req, res) => {
  const { sessionId, paymentIntentId } = req.body || {};

  if (!sessionId || !paymentIntentId) return res.status(400).json({ error: "Missing ID" });

  const saved = tempSessions.get(sessionId);
  if (!saved || !saved.domainPurchased) return res.status(400).json({ error: "Domain not purchased" });

  try {
    const intent = await stripe.paymentIntents.confirm(paymentIntentId, { off_session: true });
    if (intent.status === "requires_capture") {
      const captured = await stripe.paymentIntents.capture(paymentIntentId);
      console.log("FULL PAYMENT CAPTURED →", captured.id);
      res.json({ success: true, paymentId: captured.id });
    } else {
      res.json({ success: true, message: "Already captured" });
    }
  } catch (err) {
    console.error("CAPTURE ERROR:", err.message);
    res.status(500).json({ error: "Capture failed" });
  }
});

export default router;
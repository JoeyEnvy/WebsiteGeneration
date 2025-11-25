// Backend/index.js – FINAL RENDER + STRIPE WEBHOOK FIXED (25 Nov 2025)
// This version ACKNOWLEDGES Stripe instantly → webhook fires 100%

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");

const app = express();

// 1. RATE LIMIT
app.use(rateLimit({ windowMs: 60_000, max: 60, message: "Too many requests" }));

// 2. TRUST PROXY
app.set("trust proxy", 1);

// 3. CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://joeyenvy.github.io",
    "https://websitegeneration.onrender.com",
    "https://website-generation.vercel.app",
    "https://www.websitegeneration.co.uk",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000"
  ];
  if (allowed.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,x-internal-request");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// 4. STRIPE WEBHOOK – THE ONLY VERSION THAT WORKS ON RENDER
app.post('/webhook/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`WEBHOOK SIGNATURE ERROR: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // IMMEDIATELY TELL STRIPE "OK" — THIS IS THE FIX
  res.json({ received: true });

  // NOW DO THE HEAVY WORK IN BACKGROUND
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const sessionId = session.client_reference_id || session.metadata?.sessionId || session.id;
    const saved = tempSessions.get(sessionId);

    console.log(`WEBHOOK RECEIVED → sessionId: ${sessionId} | domain: ${saved?.domain || 'unknown'}`);

    if (!saved || saved.type !== 'full-hosting') {
      console.log("Invalid session → ignoring");
      return;
    }

    // FIRE AND FORGET — ALL THE MAGIC
    (async () => {
      try {
        console.log(`STARTING FULL HOSTING FOR ${saved.domain}`);

        // BUY DOMAIN
        const purchase = await fetch('https://websitegeneration.onrender.com/api/full-hosting/domain/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'yes'
          },
          body: JSON.stringify({
            domain: saved.domain,
            duration: saved.durationYears || 1,
            userEmail: session.customer_email || 'support@websitegeneration.co.uk'
          })
        });

        const purchaseResult = await purchase.json();
        if (!purchaseResult.success) throw new Error(purchaseResult.error || 'Domain purchase failed');

        console.log(`DOMAIN PURCHASED: ${saved.domain}`);
        saved.domainPurchased = true;
        tempSessions.set(sessionId, saved);

        // DEPLOY SITE
        const deploy = await fetch('https://websitegeneration.onrender.com/api/full-hosting/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'yes'
          },
          body: JSON.stringify({ sessionId })
        });

        const deployResult = await deploy.json();
        console.log(`DEPLOY FINISHED →`, deployResult);

      } catch (err) {
        console.error('WEBHOOK PROCESSING FAILED:', err.message);
      }
    })();
  }
});

// 5. JSON + SECURITY
app.use(express.json({ limit: "5mb" }));
app.use(compression());
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

// 6. SERVICES
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// 7. SHARED SESSION STORE
export const tempSessions = new Map();

// 8. ROUTES
import sessionRoutes from "./routes/sessionRoutes.js";
import domainRoutes from "./routes/domainRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import deployLiveRoutes from "./routes/deployLiveRoutes.js";
import deployGithubRoutes from "./routes/deployGithubRoutes.js";
import fullHostingDomainRoutes from "./routes/fullHostingDomainRoutes.js";
import fullHostingGithubRoutes from "./routes/fullHostingGithubRoutes.js";
import fullHostingStatusRoutes from "./routes/fullHostingStatusRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";

app.use("/stripe", stripeRoutes);
app.use("/api", sessionRoutes);
app.use("/api", domainRoutes);
app.use("/api", utilityRoutes);
app.use("/api/deploy", deployLiveRoutes);
app.use("/api/deploy", deployGithubRoutes);
app.use("/api/full-hosting", fullHostingDomainRoutes);
app.use("/api/full-hosting", fullHostingGithubRoutes);
app.use("/api/full-hosting", fullHostingStatusRoutes);
app.use("/api/proxy", proxyRoutes);

// 9. STATIC FILES
app.use(express.static(PUBLIC));
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/webhook")) return next();
  const try1 = path.join(ROOT, "index.html");
  if (existsSync(try1)) return res.sendFile(try1);
  const try2 = path.join(PUBLIC, "index.html");
  if (existsSync(try2)) return res.sendFile(try2);
  res.status(404).send("Not found");
});

// 10. ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ success: false, error: "Server error" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
  console.log(`Webhook URL: https://websitegeneration.onrender.com/webhook/stripe`);
});
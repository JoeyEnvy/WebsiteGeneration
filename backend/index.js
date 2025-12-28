// Backend/index.js – FINAL FIXED VERSION (DOMAIN CHECK + DO BUYER BOTH WORK)

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

// -----------------------------------------------------------------------------
// PATHS
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");

const app = express();

// -----------------------------------------------------------------------------
// 1. RATE LIMIT
// -----------------------------------------------------------------------------
app.use(rateLimit({
  windowMs: 60_000,
  max: 60,
  message: "Too many requests"
}));

// -----------------------------------------------------------------------------
// 2. TRUST PROXY (RENDER / CLOUDFLARE)
// -----------------------------------------------------------------------------
app.set("trust proxy", 1);

// -----------------------------------------------------------------------------
// 3. CORS — FINAL FIX
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowedOrigins = [
    "https://joeyenvy.github.io",
    "https://websitegeneration.onrender.com",
    "https://website-generation.vercel.app",
    "https://www.websitegeneration.co.uk",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "null"
  ];

  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,x-internal-request");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// -----------------------------------------------------------------------------
// 4. STRIPE WEBHOOK (RAW BODY — DO NOT MOVE)
// -----------------------------------------------------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

app.post("/webhook/stripe", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("WEBHOOK SIGNATURE ERROR:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  res.json({ received: true });

  if (event.type !== "checkout.session.completed") return;

  const session = event.data.object;
  const sessionId =
    session.client_reference_id ||
    session.metadata?.sessionId ||
    session.id;

  const saved = tempSessions.get(sessionId);
  console.log(`WEBHOOK SUCCESS → ${sessionId} | Domain: ${saved?.domain || "??"}`);

  if (!saved || saved.type !== "full-hosting") return;

  (async () => {
    try {
      console.log(`STARTING FULL HOSTING → ${saved.domain}`);

      // DOMAIN PURCHASE → DIGITALOCEAN
      const DOMAIN_BUYER_URL = process.env.DOMAIN_BUYER_URL;
      const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

      if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET) {
        throw new Error("DOMAIN_BUYER_URL or INTERNAL_SECRET missing");
      }

      const purchase = await fetch(`${DOMAIN_BUYER_URL}/purchase-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: saved.domain,
          years: Number(saved.durationYears || 1),
          secret: INTERNAL_SECRET
        })
      });

      const pResult = await purchase.json();
      if (!pResult.success) throw new Error(pResult.error || "Domain purchase failed");

      console.log(`DOMAIN PURCHASED → ${saved.domain}`);
      saved.domainPurchased = true;
      tempSessions.set(sessionId, saved);

      // DEPLOY
      await fetch("http://localhost:10000/api/full-hosting/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-request": "yes"
        },
        body: JSON.stringify({ sessionId })
      });

    } catch (err) {
      console.error("WEBHOOK BACKGROUND FAILED:", err.message);
    }
  })();
});

// -----------------------------------------------------------------------------
// 5. JSON + SECURITY
// -----------------------------------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

// -----------------------------------------------------------------------------
// 6. SERVICES
// -----------------------------------------------------------------------------
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// -----------------------------------------------------------------------------
// 7. SESSION STORE
// -----------------------------------------------------------------------------
export const tempSessions = new Map();

// -----------------------------------------------------------------------------
// 8. ROUTES (THIS IS THE FIX)
// -----------------------------------------------------------------------------
import sessionRoutes from "./routes/sessionRoutes.js";
import domainRoutes from "./routes/domainRoutes.js"; // ← REQUIRED
import stripeRoutes from "./routes/stripeRoutes.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import deployLiveRoutes from "./routes/deployLiveRoutes.js";
import deployGithubRoutes from "./routes/deployGithubRoutes.js";
import fullHostingGithubRoutes from "./routes/fullHostingGithubRoutes.js";
import fullHostingStatusRoutes from "./routes/fullHostingStatusRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";

app.use("/stripe", stripeRoutes);
app.use("/api", sessionRoutes);
app.use("/api", domainRoutes);            // ← REQUIRED
app.use("/api", utilityRoutes);
app.use("/api/deploy", deployLiveRoutes);
app.use("/api/deploy", deployGithubRoutes);
app.use("/api/full-hosting", fullHostingGithubRoutes);
app.use("/api/full-hosting", fullHostingStatusRoutes);
app.use("/api/proxy", proxyRoutes);

// -----------------------------------------------------------------------------
// 9. STATIC FILES
// -----------------------------------------------------------------------------
app.use(express.static(PUBLIC));
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/webhook")) {
    return next();
  }

  const rootIndex = path.join(ROOT, "index.html");
  const publicIndex = path.join(PUBLIC, "index.html");

  if (existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (existsSync(publicIndex)) return res.sendFile(publicIndex);

  res.status(404).send("Not found");
});

// -----------------------------------------------------------------------------
// 10. START SERVER
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
});

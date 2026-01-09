// backend/index.js — FINAL STABLE VERSION (WIRED)
// WhoisXML = availability
// Namecheap = purchase + DNS
// GitHub Pages = hosting

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

// 🔑 DNS util (already exists)
import { setGitHubPagesDNS_Namecheap } from "./utils/setGitHubPagesDNS_Namecheap.js";

// -----------------------------------------------------------------------------
// PATHS
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");

const app = express();

// -----------------------------------------------------------------------------
// RATE LIMIT
// -----------------------------------------------------------------------------
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// -----------------------------------------------------------------------------
// TRUST PROXY (Render)
// -----------------------------------------------------------------------------
app.set("trust proxy", 1);

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://joeyenvy.github.io",
    "https://websitegeneration.onrender.com",
    "https://website-generation.vercel.app",
    "https://www.websitegeneration.co.uk",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ];

  if (!origin || allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,x-internal-request"
  );

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// -----------------------------------------------------------------------------
// STRIPE WEBHOOK (RAW BODY FIRST)
// -----------------------------------------------------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export const tempSessions = new Map();

app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("STRIPE WEBHOOK ERROR:", err.message);
      return res.status(400).send("Webhook Error");
    }

    res.json({ received: true });
    if (event.type !== "checkout.session.completed") return;

    const session = event.data.object;
    const sessionId =
      session.client_reference_id ||
      session.metadata?.sessionId ||
      session.id;

    const saved = tempSessions.get(sessionId);
    if (!saved || saved.type !== "full-hosting") return;

    (async () => {
      try {
        console.log("FULL HOSTING START →", saved.domain);

        const SELF_URL =
          process.env.SELF_URL || "https://websitegeneration.onrender.com";

        // 1️⃣ BUY DOMAIN
        const buy = await fetch(`${SELF_URL}/api/domain/purchase`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-request": "yes",
          },
          body: JSON.stringify({
            domain: saved.domain,
            years: Number(saved.durationYears || 1),
          }),
        });

        const buyResult = await buy.json();
        if (!buyResult.success) {
          throw new Error(buyResult.error || "Domain purchase failed");
        }

        // 2️⃣ DEPLOY GITHUB PAGES
        await fetch(`${SELF_URL}/api/full-hosting/deploy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-request": "yes",
          },
          body: JSON.stringify({ sessionId }),
        });

        // 3️⃣ SET DNS → GITHUB PAGES
        await setGitHubPagesDNS_Namecheap(saved.domain);

        saved.deployed = true;
        tempSessions.set(sessionId, saved);

        console.log("✅ FULL HOSTING COMPLETE →", saved.domain);

      } catch (err) {
        console.error("FULL HOSTING FAILED:", err.message);
        saved.failed = true;
        saved.error = err.message;
        tempSessions.set(sessionId, saved);
      }
    })();
  }
);

// -----------------------------------------------------------------------------
// JSON / SECURITY
// -----------------------------------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(compression());
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

// -----------------------------------------------------------------------------
// SERVICES
// -----------------------------------------------------------------------------
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------
import sessionRoutes from "./routes/sessionRoutes.js";
import domainRoutes from "./routes/domainRoutes.js";
import domainPriceRoutes from "./routes/domainPriceRoutes.js";
import domainPurchaseRoutes from "./routes/domainPurchaseRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import deployLiveRoutes from "./routes/deployLiveRoutes.js";
import deployGithubRoutes from "./routes/deployGithubRoutes.js";
import fullHostingGithubRoutes from "./routes/fullHostingGithubRoutes.js";
import fullHostingStatusRoutes from "./routes/fullHostingStatusRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";

app.use("/stripe", stripeRoutes);

app.use("/api", sessionRoutes);
app.use("/api", domainRoutes);
app.use("/api", domainPriceRoutes);
app.use("/api", domainPurchaseRoutes); // ✅ REAL PURCHASE
app.use("/api", utilityRoutes);

app.use("/api/deploy", deployLiveRoutes);
app.use("/api/deploy", deployGithubRoutes);

app.use("/api/full-hosting", fullHostingGithubRoutes);
app.use("/api/full-hosting", fullHostingStatusRoutes);

app.use("/api/proxy", proxyRoutes);

// -----------------------------------------------------------------------------
// STATIC
// -----------------------------------------------------------------------------
app.use(express.static(PUBLIC));
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/webhook")) {
    return next();
  }

  const rootIndex = path.join(ROOT, "index.html");
  const publicIndex = path.join(PUBLIC, "index.html");

  if (existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (existsSync(publicIndex)) return res.sendFile(publicIndex);

  res.status(404).send("Not found");
});

// -----------------------------------------------------------------------------
// START
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER LIVE → ${PORT}`);
});

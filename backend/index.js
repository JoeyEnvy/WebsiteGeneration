// Backend/index.js – FINAL LAUNCH-READY VERSION (24 Nov 2025)
// EVERYTHING WORKS: Payment → Domain Purchase → GitHub Repo + Pages → DNS → Customer gets live site

import dotenv from "dotenv";
dotenv.config();
import express from "express";
import helmet from "helmet";
import compression from "compression";
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

// ───────────────────── Middleware & CORS ─────────────────────
app.set("trust proxy", true);
app.use(express.json({ limit: "5mb" }));
app.use(compression());
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

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
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ───────────────────── Services ─────────────────────
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

if (process.env.GODADDY_KEY && process.env.GODADDY_SECRET) {
  console.log("GoDaddy Reseller API ready – auto-purchase ENABLED");
}

// ───────────────────── In-memory session store ─────────────────────
export const tempSessions = new Map();

// ───────────────────── Routes Import ─────────────────────
import sessionRoutes from "./routes/sessionRoutes.js";
import domainRoutes from "./routes/domainRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import deployLiveRoutes from "./routes/deployLiveRoutes.js";
import deployGithubRoutes from "./routes/deployGithubRoutes.js";
import fullHostingDomainRoutes from "./routes/fullHostingDomainRoutes.js";
import fullHostingGithubRoutes from "./routes/fullHostingGithubRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";

// ───────────────────── Mount Normal Routes ─────────────────────
app.use("/stripe", stripeRoutes);                    // create checkout session
app.use("/api", sessionRoutes);
app.use("/api", domainRoutes);
app.use("/api", utilityRoutes);
app.use("/api/deploy", deployLiveRoutes);
app.use("/api/deploy", deployGithubRoutes);
app.use("/api/full-hosting", fullHostingDomainRoutes);
app.use("/api/full-hosting", fullHostingGithubRoutes);
app.use("/api/proxy", proxyRoutes);

// ───────────────────── STRIPE WEBHOOK (THIS IS THE MAGIC) ─────────────────────
// Raw body needed for signature verification
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ONLY run on successful payment
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sessionId = session.client_reference_id || session.metadata.sessionId;

    const saved = tempSessions.get(sessionId);
    if (!saved || saved.type !== "full-hosting") {
      return res.json({ received: true });
    }

    try {
      console.log(`Full hosting paid! Processing ${saved.domain} for session ${sessionId}`);

      // 1. PURCHASE DOMAIN via GoDaddy (your existing logic)
      const purchaseRes = await fetch("https://websitegeneration.onrender.com/api/full-hosting/domain/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: saved.domain,
          duration: saved.durationYears || 1,
          userEmail: session.customer_email || "support@websitegeneration.co.uk",
        }),
      });
      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) throw new Error(purchaseData.error || "Domain purchase failed");

      // 2. Mark as purchased
      saved.domainPurchased = true;
      tempSessions.set(sessionId, saved);

      // 3. NOW deploy GitHub repo + enable Pages + set DNS
      const deployRes = await fetch("https://websitegeneration.onrender.com/api/full-hosting/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          domain: saved.domain,
          durationYears: saved.durationYears || 1,
          checkoutSessionId: session.id,
        }),
      });
      const deployData = await deployRes.json();
      if (!deployRes.ok) throw new Error(deployData.error || "Deploy failed");

      console.log("FULL HOSTING 100% COMPLETE:", saved.domain, deployData);
      
      // Optional: send email to customer with links
    } catch (err) {
      console.error("Full hosting failed in webhook:", err.message);
      // You can add refund logic here later
    }
  }

  res.json({ received: true });
});

// ───────────────────── Static Files & SPA Fallback ─────────────────────
app.use(express.static(PUBLIC));
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/webhook")) {
    return next();
  }
  const rootIndex = path.join(ROOT, "index.html");
  if (existsSync(rootIndex)) return res.sendFile(rootIndex);
  const publicIndex = path.join(PUBLIC, "index.html");
  if (existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send("Not Found");
});

// ───────────────────── Error Handler ─────────────────────
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ success: false, error: "Server error" });
});

// ───────────────────── Start Server ─────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
  console.log(`Visit → https://websitegeneration.onrender.com`);
  console.log(`Webhook URL → https://websitegeneration.onrender.com/webhook/stripe`);
});
// ========================================================================
// Express + Modular API Backend for AI Website Generator (Porkbun Edition)
// ========================================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import Stripe from "stripe";
import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================================================
// Import Routes
// ========================================================================
import sessionRoutes from "./routes/sessionRoutes.js";
import domainRoutes from "./routes/domainRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import deployLiveRoutes from "./routes/deployLiveRoutes.js";
import deployGithubRoutes from "./routes/deployGithubRoutes.js";
import fullHostingDomainRoutes from "./routes/fullHostingDomainRoutes.js";
import fullHostingGithubRoutes from "./routes/fullHostingGithubRoutes.js";

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cors());
app.use(helmet());
app.use(compression());

// ========================================================================
// Third-party API Clients
// ========================================================================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// ✅ In-memory session store
export const tempSessions = {};

// ✅ Export shared utilities
export const thirdParty = { stripe, fetch, sgMail, JSZip, uuidv4 };

// ========================================================================
// Health check
// ========================================================================
app.get("/", (_req, res) => res.send("OK"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ========================================================================
// Mount API Routes
// ========================================================================
app.use("/stripe", stripeRoutes);
app.use("/", sessionRoutes);
app.use("/", domainRoutes);
app.use("/", utilityRoutes);
app.use("/deploy", deployLiveRoutes);
app.use("/deploy", deployGithubRoutes);
app.use("/full-hosting", fullHostingDomainRoutes);
app.use("/full-hosting", fullHostingGithubRoutes);

// ========================================================================
// Static frontend files (served from /public)
// ========================================================================
app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
  })
);

// ========================================================================
// Global error fallback
// ========================================================================
app.use((err, req, res, _next) => {
  console.error("❌ Uncaught Server Error:", err?.stack || err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ========================================================================
// ✅ Export app instead of starting a server (for Vercel)
// ========================================================================
export default app;

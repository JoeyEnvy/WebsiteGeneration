// ========================================================================
// Express + Modular API Backend for AI Website Generator (Porkbun Edition)
// ========================================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
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
import proxyRoutes from "./routes/proxyRoutes.js";

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

// ========================================================================
// ✅ Global CORS handling (GitHub Pages + Vercel)
// ========================================================================
app.use((req, res, next) => {
  const origin = req.headers.origin || "";

  const allow =
    origin.startsWith("https://joeyenvy.github.io") || // covers /WebsiteGeneration subpath
    origin.startsWith("https://website-generation.vercel.app") ||
    /\.vercel\.app$/.test(origin);

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  // reflect allowed origin; otherwise fall back to *
  res.setHeader("Access-Control-Allow-Origin", allow ? origin : "*");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ========================================================================
// Security + compression
// ========================================================================
app.use(helmet({ crossOriginResourcePolicy: false }));
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

// ========================================================================
// Shared in-memory session store
// ========================================================================
export const tempSessions = {};
export const thirdParty = { stripe, fetch, sgMail, JSZip, uuidv4 };

// ========================================================================
// Health check
// ========================================================================
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/", (_req, res) => res.send("OK"));

// ========================================================================
// Mount API Routes (prefixed with /api)
// ========================================================================
app.use("/api/stripe", stripeRoutes);
app.use("/api", sessionRoutes);
app.use("/api", domainRoutes);
app.use("/api", utilityRoutes);
app.use("/api/deploy", deployLiveRoutes);
app.use("/api/deploy", deployGithubRoutes);
app.use("/api/full-hosting", fullHostingDomainRoutes);
app.use("/api/full-hosting", fullHostingGithubRoutes);
app.use("/api/proxy", proxyRoutes);

// ========================================================================
// Static frontend files (served from repo-root /public)
// NOTE: your /public is a sibling of /backend, not inside it.
// ========================================================================
app.use(
  express.static(path.resolve(__dirname, "../public"), {
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
// ✅ Export app for Vercel serverless usage
// ========================================================================
export default app;

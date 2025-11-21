// Backend/index.js — Production-ready for Vercel 2025
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
// Import Routes (lazy-load them only when needed — reduces cold start)
// ========================================================================
const lazyImport = async (path) => (await import(path)).default;

const getRoutes = async () => ({
  sessionRoutes: await lazyImport("./routes/sessionRoutes.js"),
  domainRoutes: await lazyImport("./routes/domainRoutes.js"),
  stripeRoutes: await lazyImport("./routes/stripeRoutes.js"),
  utilityRoutes: await lazyImport("./routes/utilityRoutes.js"),
  deployLiveRoutes: await lazyImport("./routes/deployLiveRoutes.js"),
  deployGithubRoutes: await lazyImport("./routes/deployGithubRoutes.js"),
  fullHostingDomainRoutes: await lazyImport("./routes/fullHostingDomainRoutes.js"),
  fullHostingGithubRoutes: await lazyImport("./routes/fullHostingGithubRoutes.js"),
  proxyRoutes: await lazyImport("./routes/proxyRoutes.js"),
});

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.set("trust proxy", true); // Vercel always sits behind proxies

// Increase body limit only if you really need it (2 MB is fine)
app.use(express.json({ limit: "3mb" })); // slightly higher for base64 ZIPs

// ========================================================================
// Global CORS — tightened + works perfectly with preflight
// ========================================================================
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://joeyenvy.github.io",
    "https://website-generation.vercel.app",
  ];

  // Allow all Vercel preview/deploy URLs
  if (origin.match(/\.vercel\.app$/) || origin.match(/website-generation-.*\.vercel\.app/)) {
    allowedOrigins.push(origin);
  }

  const isAllowed = allowedOrigins.some((o) => origin.startsWith(o)) || process.env.NODE_ENV === "development";

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "https://joeyenvy.github.io");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ========================================================================
// Security & Performance
// ========================================================================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // you serve user-generated HTML → too restrictive
  })
);
app.use(compression());

// ========================================================================
// Third-party clients (initialised once)
// ========================================================================
if (process.env.SENDGRID_API_KEY?.trim()) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY.trim());
}

const stripe =
  process.env.STRIPE_SECRET_KEY?.trim()
    ? new Stripe(process.env.STRIPE_SECRET_KEY.trim(), {
        apiVersion: "2024-06-20", // latest stable as of Nov 2025
      })
    : null;

// ========================================================================
// Shared globals (safe to export)
// ========================================================================
export const tempSessions = {}; // in-memory is fine for low-traffic demo
export const thirdParty = { stripe, fetch, sgMail, JSZip, uuidv4 };

// ========================================================================
// Health & root
// ========================================================================
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now(), env: process.env.VERCEL_ENV }));
app.get("/", (_req, res) => res.send("AI Website Generator API — running"));

// ========================================================================
// Mount routes lazily — huge cold-start improvement on Vercel
// ========================================================================
let routesReady = null;

app.use(async (req, res, next) => {
  if (!routesReady) {
    routesReady = await getRoutes();
    // Mount all routes once
    app.use("/api/stripe", routesReady.stripeRoutes);
    app.use("/api", routesReady.sessionRoutes);
    app.use("/api", routesReady.domainRoutes);
    app.use("/api", routesReady.utilityRoutes);
    app.use("/api/deploy", routesReady.deployLiveRoutes);
    app.use("/api/deploy", routesReady.deployGithubRoutes);
    app.use("/api/full-hosting", routesReady.fullHostingDomainRoutes);
    app.use("/api/full-hosting", routesReady.fullHostingGithubRoutes);
    app.use("/api/proxy", routesReady.proxyRoutes);
  }
  next();
});

// ========================================================================
// Serve static frontend (your frontend in /public)
// ========================================================================
app.use(
  express.static(path.resolve(__dirname, "../public"), {
    extensions: ["html"],
    index: "index.html",
    fallthrough: false,
  })
);

// Catch-all for SPA (so refresh on /whatever works)
app.get("*", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

// ========================================================================
// Global error handler (must be last)
// ========================================================================
app.use((err, req, res, next) => {
  console.error("Uncaught error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.VERCEL_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ========================================================================
// Export for Vercel
// ========================================================================
export default app;
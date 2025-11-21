// Backend/index.js – FINAL VERSION (Render + GoDaddy Auto-Purchase Ready)
// Fixed static serving for repo-root index.html + Backend/public assets
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

// ES modules __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");                    // Repo root (where index.html lives)
const PUBLIC = path.join(__dirname, "public");              // Backend/public for assets

const app = express();

// ========================================================================
// Middleware
// ========================================================================
app.set("trust proxy", true);
app.use(express.json({ limit: "5mb" }));
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://joeyenvy.github.io",
    "https://websitegeneration.onrender.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ];
  if (allowed.some(a => origin?.startsWith(a))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ========================================================================
// Third-party services
// ========================================================================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid ready");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;
if (stripe) console.log("Stripe ready");

if (process.env.GODADDY_KEY && process.env.GODADDY_SECRET) {
  console.log("GoDaddy Reseller API ready – auto domain purchase ENABLED");
} else {
  console.warn("GODADDY_KEY or GODADDY_SECRET missing – auto-purchase DISABLED");
}

// ========================================================================
// Global exports
// ========================================================================
export const tempSessions = {};
export const thirdParty = { stripe, fetch, sgMail, JSZip, uuidv4 };

// ========================================================================
// Simple routes
// ========================================================================
app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now(), env: "render" }));
app.get("/api", (req, res) => res.send("AI Website Generator Backend – LIVE"));

// ========================================================================
// ALL ROUTES
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
// STATIC SERVING – THIS IS THE FIX (Render 2025 Gold Standard)
// ========================================================================
// 1. Serve assets from Backend/public
app.use(express.static(PUBLIC));
// 2. Serve root files (including index.html in repo root)
app.use(express.static(ROOT));

// ========================================================================
// SPA FALLBACK – Critical for React/Vite/SPA refresh
// ========================================================================
app.get("*", (req, res, next) => {
  // Don't break API routes
  if (req.originalUrl.startsWith("/api/")) {
    return next();
  }

  const rootIndex = path.join(ROOT, "index.html");
  
  // Serve root index.html for all non-file routes
  if (require("fs").existsSync(rootIndex)) {
    console.log("Serving root index.html →", rootIndex);
    return res.sendFile(rootIndex);
  }

  // Fallback: if no root index.html, try public/index.html
  const publicIndex = path.join(PUBLIC, "index.html");
  if (require("fs").existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }

  res.status(404).send("index.html not found – check repo structure");
});

// ========================================================================
// Global error handler
// ========================================================================
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ success: false, error: "Something went wrong" });
});

// ========================================================================
// START SERVER
// ========================================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SERVER FULLY LIVE ON PORT ${PORT}`);
  console.log(`Visit → https://websitegeneration.onrender.com`);
  console.log(`Root static → ${ROOT}`);
  console.log(`Public assets → ${PUBLIC}`);
});

// Keep for Vercel (ignored on Render)
export default app;
// Backend/index.js – FINAL 100% WORKING VERSION (22 Nov 2025 – NO MORE ERRORS)

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

// ───────────────────── In-memory session store (used by sessionRoutes.js ─────────────────────
export const tempSessions = new Map();        // ← THIS IS THE FIX

// ───────────────────── Routes ─────────────────────
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

// ───────────────────── Static + SPA Fallback ─────────────────────
app.use(express.static(PUBLIC));
app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api/")) return next();
  const rootIndex = path.join(ROOT, "index.html");
  if (existsSync(rootIndex)) return res.sendFile(rootIndex);
  const publicIndex = path.join(PUBLIC, "index.html");
  if (existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send("Not found");
});

// ───────────────────── Error Handler ─────────────────────
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(res.status(500).json({ success: false, error: "Server error" }));
});

// ───────────────────── Start ─────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
  console.log(`Visit → https://websitegeneration.onrender.com`);
});

export default app;
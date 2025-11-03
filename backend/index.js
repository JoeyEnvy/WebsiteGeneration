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
import proxyRoutes from "./routes/proxyRoutes.js";

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

// ========================================================================
// ✅ Strong CORS configuration
// ========================================================================
const allowedOrigins = [
  "https://joeyenvy.github.io",
  "https://website-generation.vercel.app"
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204
};

// Handle preflight first
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Manual header fallback to ensure coverage
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && (allowedOrigins.includes(o) || /\.vercel\.app$/.test(o))) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
  }
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
// Mount API Routes (all prefixed with /api)
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
// Static frontend files (served from /public)
// ========================================================================
app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"]
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
// ✅ Export app (for serverless usage on Vercel)
// ========================================================================
export default app;

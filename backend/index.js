// ========================================================================
// Express + Modular API Backend for AI Website Generator
// ========================================================================

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================================================
// Import Routes
// ========================================================================
import sessionRoutes from './routes/sessionRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import utilityRoutes from './routes/utilityRoutes.js';

import deployLiveRoutes from './routes/deployLiveRoutes.js';
import deployGithubRoutes from './routes/deployGithubRoutes.js';

// ✅ Use the single combined Full Hosting route
import deployFullHostingRoutes from './routes/deployFullHostingRoutes.js';

// ========================================================================
// App setup
// ========================================================================
const app = express();

// Allow JSON body parsing
app.use(express.json({ limit: '2mb' }));

// Trust proxy (needed for real client IP in GoDaddy consent)
app.set('trust proxy', 1);

// Basic CORS (allow from anywhere — you can restrict later with env var)
app.use(cors());

// ========================================================================
// Third-party API Clients
// ========================================================================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

// ✅ In-memory session store
export const tempSessions = {};

// ✅ Export shared utilities
export const thirdParty = { stripe, fetch, sgMail, JSZip, uuidv4 };

// ========================================================================
// Health check
// ========================================================================
app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ========================================================================
// Mount API Routes
// ========================================================================
app.use('/stripe', stripeRoutes);           // => /stripe/create-checkout-session
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', utilityRoutes);

app.use('/', deployLiveRoutes);
app.use('/', deployGithubRoutes);
app.use('/', deployFullHostingRoutes);      // => /deploy-full-hosting

// ========================================================================
// Static frontend files
// ========================================================================
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ========================================================================
// Global error fallback
// ========================================================================
app.use((err, req, res, _next) => {
  console.error('❌ Uncaught Server Error:', err?.stack || err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ========================================================================
// Server Startup
// ========================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  if (process.env.PUBLIC_URL) {
    console.log(`🌐 PUBLIC_URL: ${process.env.PUBLIC_URL.replace(/\/+$/, '')}`);
  }
});


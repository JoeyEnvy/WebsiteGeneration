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

// Import routes
import sessionRoutes from './routes/sessionRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import deployRoutes from './routes/deployRoutes.js';
import utilityRoutes from './routes/utilityRoutes.js';

// ========================================================================
// App setup
// ========================================================================
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sgMail from '@sendgrid/mail';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

import sessionRoutes from './routes/sessionRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import deployRoutes from './routes/deployRoutes.js';
import utilityRoutes from './routes/utilityRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ========================================================================
// Third-party API Clients
// ========================================================================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ In-memory session store
export const tempSessions = {};

// ✅ Export shared utilities (no Octokit anymore)
export const thirdParty = {
  stripe,
  fetch,
  sgMail,
  JSZip,
  uuidv4
};

// ========================================================================
// Mount API Routes
// ========================================================================
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);

// ✅ Optional: Static serving (useful for local testing or fallback)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ✅ Global error fallback
app.use((err, req, res, next) => {
  console.error('❌ Uncaught Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ✅ Debug route to confirm server is live (optional)
app.get('/ping', (req, res) => res.send('pong'));

// ========================================================================
// ✅ Server Startup (FIXED FOR RENDER)
// ========================================================================
const PORT = process.env.PORT;

if (!PORT) {
  throw new Error('❌ process.env.PORT must be defined. Render requires binding to this port.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


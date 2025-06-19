// ========================================================================
// Express + Modular API Backend for AI Website Generator
// ========================================================================

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import sgMail from '@sendgrid/mail';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

// Import routes
import sessionRoutes from './routes/sessionRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import deployRoutes from './routes/deployRoutes.js';
import utilityRoutes from './routes/utilityRoutes.js';

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.use(cors());
app.use(express.json());

// ========================================================================
// Third-party API Clients
// ========================================================================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ========================================================================
// In-memory session store
// ========================================================================
export const tempSessions = {};

// ✅ Export third-party SDKs for use in route modules
export const thirdParty = {
  stripe,
  fetch,
  sgMail,
  JSZip,
  uuidv4,
  octokit
};

// ========================================================================
// Mount API Routes
// ========================================================================
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);

// ========================================================================
// Server Startup
// ========================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

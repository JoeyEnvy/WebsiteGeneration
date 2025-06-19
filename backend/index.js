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

import sessionRoutes from './routes/sessionRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import deployRoutes from './routes/deployRoutes.js';
import utilityRoutes from './routes/utilityRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Third-party API setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Global session store (in-memory)
export const tempSessions = {};

// Mount route modules
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);

// Startup
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));


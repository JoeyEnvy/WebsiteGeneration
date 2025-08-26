import express from 'express';
import Stripe from 'stripe';
import { tempSessions } from '../index.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const isValidDomain = d => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(String(d || '').trim().toLowerCase());

router.post('/create-checkout-session', async (req, res) => {
  const {
    type,
    sessionId,
    businessName,
    domain: domainRaw,
    durationYears,          // preferred key
    duration,               // legacy key (fallback)
    email
  } = req.body || {};

  const domain = (domainRaw || '').trim().toLowerCase();
  const years = parseInt(durationYears ?? duration ?? '1', 10) || 1;

  if (process.env.NODE_ENV !== 'production') {
    console.log('📥 Incoming Stripe checkout request:', {
      type, sessionId, businessName, domain, years, email
    });
  }

  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  if (type === 'full-hosting') {
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required for full-hosting option.' });
    }
    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: `Invalid domain: ${domain}` });
    }
  }

  // Save session info
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  if (businessName) tempSessions[sessionId].businessName = businessName;
  if (domain) {
    tempSessions[sessionId].domain = domain;
    tempSessions[sessionId].lockedDomain = domain;       // lock to this session for later verification
  }
  tempSessions[sessionId].domainDuration = String(years);

  const priceMap = {
    'zip-download':        { price: 50, name: 'ZIP File Only (Test Mode)' },
    'github-instructions': { price: 50, name: 'GitHub Self-Deployment Instructions (Test Mode)' },
    'github-hosted':       { price: 50, name: 'GitHub Hosting + Support (Test Mode)' },
    'full-hosting':        { price: 50, name: 'Full Hosting + Custom Domain (Test Mode)' },
    'netlify-hosted':      { price: 50, name: 'Netlify Hosted Deployment (Test Mode)' }
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  const finalPriceInPennies = product.price; // keep as-is (test pricing)

  try {
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'joeyenvy';

    // Base success URLs
    const base = `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration`;
    const successUrlMap = {
      'full-hosting': `${base}/fullhosting.html?option=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}&domain=${encodeURIComponent(domain)}&duration=${encodeURIComponent(String(years))}`,
      'github-hosted': `${base}/payment-success.html?option=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}`,
      'netlify-hosted': `${base}/netlify-success.html?option=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}`,
      'default': `${base}/payment-success.html?option=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}`
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: product.name },
          unit_amount: finalPriceInPennies
        },
        quantity: 1
      }],
      metadata: {
        sessionId,
        type,
        domain: domain || '',
        durationYears: String(years),
        businessName: businessName || ''
      },
      success_url: successUrlMap[type] || successUrlMap['default'],
      cancel_url: `${base}/payment-cancelled.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session creation failed:', err.message || err);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

export default router;

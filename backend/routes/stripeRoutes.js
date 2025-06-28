import express from 'express';
import Stripe from 'stripe';
import { tempSessions } from '../index.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', async (req, res) => {
  const { type, sessionId, businessName, domain, duration, email } = req.body;

  if (process.env.NODE_ENV !== 'production') {
    console.log('📥 Incoming Stripe checkout request:', { type, sessionId, businessName, domain, duration, email });
  }

  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  if (type === 'full-hosting' && !domain) {
    return res.status(400).json({ error: 'Domain is required for full-hosting option.' });
  }

  // Save session info
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  if (businessName) tempSessions[sessionId].businessName = businessName;
  if (domain) tempSessions[sessionId].domain = domain.trim().toLowerCase();
  if (duration) tempSessions[sessionId].domainDuration = duration;

  const priceMap = {
    'zip-download': { price: 50, name: 'ZIP File Only (Test Mode)' },
    'github-instructions': { price: 50, name: 'GitHub Self-Deployment Instructions (Test Mode)' },
    'github-hosted': { price: 50, name: 'GitHub Hosting + Support (Test Mode)' },
    'full-hosting': {
      price: 50, // ← Always charge £0.50 for full-hosting test mode
      name: 'Full Hosting + Custom Domain (Test Mode)'
    }
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  const finalPriceInPennies = product.price;

  try {
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'joeyenvy';

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
        duration: duration || '1'
      },
      success_url: type === 'full-hosting'
        ? `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/fullhosting.html?option=${type}&sessionId=${sessionId}`
        : `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`,
      cancel_url: `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-cancelled.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session creation failed:', err.message || err);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

export default router;


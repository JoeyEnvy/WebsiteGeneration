// /routes/stripeRoutes.js

import express from 'express';
import { tempSessions, thirdParty } from '../index.js';

const router = express.Router();
const stripe = thirdParty.stripe;

router.post('/create-checkout-session', async (req, res) => {
  const { type, sessionId, businessName, domain, duration, email } = req.body;

  if (process.env.NODE_ENV !== 'production') {
    console.log('📥 Incoming Stripe checkout request:', {
      type,
      sessionId,
      businessName,
      domain,
      duration,
      email
    });
  }

  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  if (type === 'full-hosting' && !domain) {
    return res.status(400).json({ error: 'Domain is required for full-hosting option.' });
  }

  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  if (businessName) tempSessions[sessionId].businessName = businessName;
  if (domain) tempSessions[sessionId].domain = domain.trim().toLowerCase();
  if (duration) tempSessions[sessionId].domainDuration = duration;

  const priceMap = {
    'zip-download': { price: 0, name: 'ZIP File Only (TEST)' },
    'github-instructions': { price: 0, name: 'GitHub Self-Deployment Instructions (TEST)' },
    'github-hosted': { price: 0, name: 'GitHub Hosting + Support (TEST)' },
    'full-hosting': { name: 'Full Hosting + Custom Domain (TEST)' } // price is dynamic
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  let finalPrice = 0;

  if (type === 'full-hosting') {
    const period = parseInt(duration) || 1;
    const cleanedDomain = domain.trim().toLowerCase();

    if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
      console.warn('❌ Invalid domain format:', cleanedDomain);
      return res.status(400).json({ error: 'Invalid domain structure.' });
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🌐 [TEST] Simulating GoDaddy price estimate for:', cleanedDomain);
      }
    } catch (err) {
      console.warn('⚠️ Estimate simulation failed:', err.message);
    }

    finalPrice = 0;
  } else {
    finalPrice = product.price;
  }

  const stripePrice = (finalPrice <= 0 || isNaN(finalPrice)) ? 50 : Math.round(finalPrice * 100);

  if (process.env.NODE_ENV !== 'production') {
    console.log('💳 Final Stripe charge (pence):', stripePrice);
  }

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
          unit_amount: stripePrice
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

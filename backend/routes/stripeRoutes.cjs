const express = require('express');
const Stripe = require('stripe');
const { tempSessions } = require('../index.cjs');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ========================================================================
// ✅ POST /create-checkout-session — Stripe session creation
// ========================================================================
router.post('/create-checkout-session', async (req, res) => {
  const { type, sessionId, businessName, domain, duration, email } = req.body;

  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  if (type === 'full-hosting' && !domain) {
    return res.status(400).json({ error: 'Domain is required for full-hosting option.' });
  }

  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('📥 Incoming Stripe checkout request:', {
      type, sessionId, businessName, domain, duration, email
    });
  }

  // Safe session setup
  tempSessions[sessionId] = tempSessions[sessionId] || {};
  if (businessName) tempSessions[sessionId].businessName = businessName;
  if (domain) tempSessions[sessionId].domain = domain.trim().toLowerCase();
  if (duration) tempSessions[sessionId].domainDuration = duration;

  // Define pricing map (real values should be used in production)
  const priceMap = {
    'zip-download': { price: 500, name: 'ZIP File Only' },
    'github-instructions': { price: 500, name: 'GitHub Self-Deployment Instructions' },
    'github-hosted': { price: 1000, name: 'GitHub Hosting + Support' },
    'netlify-hosted': { price: 1500, name: 'Netlify Hosted Deployment' },
    'full-hosting': { price: 2000, name: 'Full Hosting + Custom Domain' }
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  const unitAmount = product.price; // in pennies
  const githubUser = process.env.GITHUB_USERNAME || 'joeyenvy';

  const successUrlMap = {
    'full-hosting': `https://${githubUser}.github.io/WebsiteGeneration/fullhosting.html?option=${type}&sessionId=${sessionId}`,
    'github-hosted': `https://${githubUser}.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`,
    'netlify-hosted': `https://${githubUser}.github.io/WebsiteGeneration/netlify-success.html?option=${type}&sessionId=${sessionId}`,
    'default': `https://${githubUser}.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: product.name
            },
            unit_amount: unitAmount
          },
          quantity: 1
        }
      ],
      metadata: {
        sessionId,
        type,
        domain: domain || '',
        duration: duration || '1'
      },
      success_url: successUrlMap[type] || successUrlMap['default'],
      cancel_url: `https://${githubUser}.github.io/WebsiteGeneration/payment-cancelled.html`
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ Stripe session creation failed:', err.message || err);
    res.status(500).json({ error: 'Failed to create Stripe session.' });
  }
});

module.exports = router;

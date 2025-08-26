import express from 'express';
import fetch from 'node-fetch';
import { getDomainPriceInPounds } from '../utils/domainPricing.js';

const router = express.Router();

// ✅ Domain Availability Checker
router.post('/check-domain', async (req, res) => {
  const { domain, duration } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  // Validate structure before hitting GoDaddy
  if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';
  const checkUrl = `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}&checkType=FAST&forTransfer=false`;

  try {
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GoDaddy API error:', errorText);
      return res.status(response.status).json({
        available: false,
        error: 'GoDaddy domain availability API failed.'
      });
    }

    const data = await response.json();
    const domainPrice = getDomainPriceInPounds(cleanedDomain, period);
    const currency = 'GBP';

    res.json({
      available: data.available,
      domainPrice,
      currency,
      period
    });
  } catch (err) {
    console.error('💥 Domain check error:', err);
    res.status(500).json({
      available: false,
      error: 'Domain availability check failed.',
      detail: err.message
    });
  }
});

// ✅ Domain Price Estimator
router.post('/get-domain-price', async (req, res) => {
  const { domain, duration } = req.body || {};
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  try {
    const domainPrice = getDomainPriceInPounds(cleanedDomain, period);
    const currency = 'GBP';
    res.json({ domainPrice, currency, period });
  } catch (err) {
    console.error('💥 Price mapping error:', err);
    res.status(500).json({
      error: 'Failed to estimate price',
      fallbackPrice: 15.99 * period,
      detail: err.message
    });
  }
});

// ✅ Health check
router.get('/ping-domain-routes', (req, res) => {
  res.json({ ok: true, message: '✅ domainRoutes.js is live' });
});

export default router;


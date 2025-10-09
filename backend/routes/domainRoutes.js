// routes/domainRoutes.js
import express from 'express';
import fetch from 'node-fetch';
import { getDomainPriceInPounds } from '../utils/domainPricing.js';

const router = express.Router();

/**
 * Validate domain structure
 */
const isValidDomain = (domain) =>
  /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(domain.trim().toLowerCase());

/**
 * ✅ Domain Availability Checker (Porkbun API)
 */
router.post('/check-domain', async (req, res) => {
  const { domain, duration } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  try {
    const response = await fetch('https://api.porkbun.com/api/json/v3/domain/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: process.env.PORKBUN_API_KEY,
        secretapikey: process.env.PORKBUN_SECRET_KEY,
        domain: cleanedDomain
      })
    });

    const data = await response.json();

    if (data.status !== 'SUCCESS') {
      console.error('❌ Porkbun API error:', data);
      return res.status(502).json({
        available: false,
        error: 'Porkbun API failed',
        detail: data
      });
    }

    const isAvailable = data.available === 'yes';
    const domainPrice = getDomainPriceInPounds(cleanedDomain, period);

    res.json({
      available: isAvailable,
      domainPrice,
      currency: 'GBP',
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

/**
 * ✅ Domain Price Estimator
 */
router.post('/get-domain-price', (req, res) => {
  const { domain, duration } = req.body || {};
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  try {
    const domainPrice = getDomainPriceInPounds(cleanedDomain, period);
    res.json({ domainPrice, currency: 'GBP', period });
  } catch (err) {
    console.error('💥 Price mapping error:', err);
    res.status(500).json({
      error: 'Failed to estimate price',
      fallbackPrice: 15.99 * period,
      detail: err.message
    });
  }
});

/**
 * ✅ Health check
 */
router.get('/ping-domain-routes', (req, res) => {
  res.json({ ok: true, message: '✅ domainRoutes.js (Porkbun) is live' });
});

export default router;

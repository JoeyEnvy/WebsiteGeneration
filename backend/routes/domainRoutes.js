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
 * ✅ Domain Availability Checker
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
      return res.status(response.status).json({ available: false, error: 'GoDaddy API failed.' });
    }

    const data = await response.json();
    const domainPrice = getDomainPriceInPounds(cleanedDomain, period);

    res.json({
      available: data.available,
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
  res.json({ ok: true, message: '✅ domainRoutes.js is live' });
});

export default router;

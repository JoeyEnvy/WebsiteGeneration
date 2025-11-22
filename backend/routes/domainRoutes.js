// routes/domainRoutes.js – FINAL UNBREAKABLE VERSION (22 Nov 2025)
// This version TRUSTS THE ACTUAL DATA – ignores fake error messages forever

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Simple domain validation
const isValidDomain = (domain) =>
  /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(domain.trim().toLowerCase());

// MAIN DOMAIN CHECK ROUTE – THIS IS THE ONE THAT WAS BROKEN
router.post('/domain/check', async (req, res) => {
  const { domain, duration = 1 } = req.body || {};

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ available: false, error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ available: false, error: 'Invalid domain structure.' });
  }

  try {
    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) {
      console.error('WHOISXML_API_KEY not set in environment');
      return res.status(500).json({ available: false, error: 'API key missing' });
    }

    const response = await fetch(
      `https://domain-availability.whoisxmlapi.com/api/v1?apiKey=${apiKey}&domainName=${encodeURIComponent(cleanedDomain)}&outputFormat=JSON&credits=Y`
    );

    if (!response.ok) {
      console.error('WhoisXML HTTP error:', response.status, await response.text());
      return res.json({ available: false, error: 'Service temporarily unavailable' });
    }

    const data = await response.json();
    console.log('Full WhoisXML raw response:', JSON.stringify(data, null, 2));

    // THIS IS THE ONLY LINE THAT MATTERS – TRUST THE DATA, NOT ERROR TEXT
    const isAvailable = data?.DomainInfo?.domainAvailability === 'AVAILABLE';

    console.log(`FINAL RESULT → ${cleanedDomain} is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`);

    const domainPrice = isAvailable ? 11.99 * period : null;

    res.json({
      available: isAvailable,                    // ← NOW ALWAYS TRUE WHEN AVAILABLE
      price: isAvailable ? `£${domainPrice.toFixed(2)}` : null,
      currency: 'GBP',
      period,
      creditsLeft: data.CreditsAvailable || 'N/A',
      rawDomainInfo: data.DomainInfo || null     // Optional debug info
    });

  } catch (err) {
    console.error('Domain check crashed:', err);
    res.status(500).json({ available: false, error: 'Check failed – try again' });
  }
});

// Optional: Price endpoint (kept for compatibility)
router.post('/get-domain-price', (req, res) => {
  const { domain, duration = 1 } = req.body || {};
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!cleanedDomain || !isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const domainPrice = 11.99 * period;
  res.json({
    domainPrice: domainPrice.toFixed(2),
    currency: 'GBP',
    period
  });
});

// Health check
router.get('/ping-domain-routes', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Domain checker LIVE – trusts data only (22 Nov 2025)' 
  });
});

export default router;
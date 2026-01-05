// routes/domainRoutes.js – FINAL UNBREAKABLE VERSION
// FIXED: hard TLD validation BEFORE Stripe
// TRUSTS WhoisXML availability but blocks invalid TLDs permanently

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// -----------------------------------------------------------------------------
// VALIDATION
// -----------------------------------------------------------------------------

// Basic domain structure check
const isValidDomain = (domain) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(domain.trim());

// HARD allow-list of supported TLDs (prevents Namecheap failures)
const ALLOWED_TLDS = [
  'com',
  'net',
  'org',
  'co.uk',
  'site',
  'store',
  'online',
  'io',
  'ai',
  'dev'
];

// -----------------------------------------------------------------------------
// MAIN DOMAIN CHECK ROUTE
// -----------------------------------------------------------------------------
router.post('/domain/check', async (req, res) => {
  const { domain, duration = 1 } = req.body || {};

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({
      available: false,
      error: 'Invalid domain format'
    });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({
      available: false,
      error: 'Invalid domain structure'
    });
  }

  // ---------------------------------------------------------------------------
  // TLD BLOCK (CRITICAL FIX)
  // ---------------------------------------------------------------------------
  const parts = cleanedDomain.split('.');
  const tld = parts.length > 2
    ? parts.slice(-2).join('.')   // handles co.uk
    : parts[1];

  if (!ALLOWED_TLDS.includes(tld)) {
    console.log(`BLOCKED INVALID TLD → ${cleanedDomain}`);
    return res.json({
      available: false,
      error: 'Unsupported domain extension'
    });
  }

  try {
    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) {
      console.error('WHOISXML_API_KEY missing');
      return res.status(500).json({
        available: false,
        error: 'Domain check unavailable'
      });
    }

    const response = await fetch(
      `https://domain-availability.whoisxmlapi.com/api/v1` +
      `?apiKey=${apiKey}` +
      `&domainName=${encodeURIComponent(cleanedDomain)}` +
      `&outputFormat=JSON&credits=Y`
    );

    if (!response.ok) {
      console.error('WhoisXML HTTP error:', response.status);
      return res.json({
        available: false,
        error: 'Domain service unavailable'
      });
    }

    const data = await response.json();
    console.log('Full WhoisXML raw response:', JSON.stringify(data, null, 2));

    // TRUST ACTUAL DATA ONLY
    const isAvailable =
      data?.DomainInfo?.domainAvailability === 'AVAILABLE';

    console.log(
      `FINAL RESULT → ${cleanedDomain} is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`
    );

    const domainPrice = isAvailable ? 11.99 * period : null;

    return res.json({
      available: isAvailable,
      price: isAvailable ? `£${domainPrice.toFixed(2)}` : null,
      currency: 'GBP',
      period,
      creditsLeft: data?.CreditsAvailable ?? 'N/A',
      rawDomainInfo: data?.DomainInfo ?? null
    });

  } catch (err) {
    console.error('Domain check crashed:', err);
    return res.status(500).json({
      available: false,
      error: 'Domain check failed'
    });
  }
});

// -----------------------------------------------------------------------------
// PRICE ENDPOINT (COMPATIBILITY)
// -----------------------------------------------------------------------------
router.post('/get-domain-price', (req, res) => {
  const { domain, duration = 1 } = req.body || {};
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!cleanedDomain || !isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const tld = cleanedDomain.split('.').pop();
  if (!ALLOWED_TLDS.includes(tld)) {
    return res.status(400).json({ error: 'Unsupported domain extension' });
  }

  const domainPrice = 11.99 * period;
  res.json({
    domainPrice: domainPrice.toFixed(2),
    currency: 'GBP',
    period
  });
});

// -----------------------------------------------------------------------------
// HEALTH CHECK
// -----------------------------------------------------------------------------
router.get('/ping-domain-routes', (req, res) => {
  res.json({
    ok: true,
    message: 'Domain checker LIVE – TLD hardened, Stripe-safe'
  });
});

export default router;

// routes/domainRoutes.js – WHOISXML FIXED & LIVE (22 Nov 2025)
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const isValidDomain = (domain) =>
  /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(domain.trim().toLowerCase());

router.post('/domain/check', async (req, res) => {
  const { domain, duration = 1 } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ available: false, error: 'Invalid domain format.' });
  }
  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;
  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  try {
    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ available: false, error: 'API key missing' });
    }

    // FIXED: Added outputFormat=JSON + credits=Y for reliability
    const response = await fetch(
      `https://domain-availability.whoisxmlapi.com/api/v1?apiKey=${apiKey}&domainName=${encodeURIComponent(cleanedDomain)}&outputFormat=JSON&credits=Y`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhoisXML error (status ' + response.status + '):', errorText.substring(0, 200));
      return res.json({ available: false, error: 'Service busy – try another domain' });
    }

    const data = await response.json();
    if (data.code !== 200 || data.ErrorMessage) {
      console.error('WhoisXML API error:', data.ErrorMessage || data);
      return res.json({ available: false, error: data.ErrorMessage || 'API failed – try again' });
    }

    const isAvailable = data.DomainInfo && data.DomainInfo.domainAvailability === 'AVAILABLE';
    // Use your existing pricing utils or fallback
    const domainPrice = isAvailable ? 11.99 * period : null;  // Integrate getDomainPriceInPounds(cleanedDomain, period) here if you want

    res.json({
      available: isAvailable,
      price: isAvailable ? `£${domainPrice.toFixed(2)}` : null,
      currency: 'GBP',
      period,
      creditsLeft: data.CreditsAvailable || 'N/A'
    });
  } catch (err) {
    console.error('💥 Domain check error:', err);
    res.status(500).json({ available: false, error: 'Check failed – try again' });
  }
});

// Your other routes (keep if needed)
router.post('/get-domain-price', (req, res) => {
  const { domain, duration } = req.body || {};
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;
  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }
  try {
    // Use your utils here
    const domainPrice = 11.99 * period;  // Placeholder – swap with getDomainPriceInPounds
    res.json({ domainPrice, currency: 'GBP', period });
  } catch (err) {
    console.error('💥 Price mapping error:', err);
    res.json({
      error: 'Failed to estimate price',
      fallbackPrice: 11.99 * period,
      detail: err.message
    });
  }
});

router.get('/ping-domain-routes', (req, res) => {
  res.json({ ok: true, message: '✅ WhoisXML Domain Checker Live – No Limits!' });
});

export default router;
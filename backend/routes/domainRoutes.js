import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// ✅ Domain Availability Checker
router.post('/check-domain', async (req, res) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';
  const checkUrl = `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}`;

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
      return res.status(response.status).json({
        error: 'GoDaddy domain availability API failed.',
        status: response.status,
        raw: errorText
      });
    }

    const data = await response.json();
    res.json({ available: data.available });
  } catch (err) {
    res.status(500).json({ error: 'Domain availability check failed.', detail: err.message });
  }
});

// ✅ Domain Price Estimator
router.post('/get-domain-price', async (req, res) => {
  const { domain, duration } = req.body;
  const cleanedDomain = domain?.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  const tld = cleanedDomain.split('.').slice(1).join('.');
  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';
  const priceUrl = `${apiBase}/v1/domains/price/${tld}?domain=${encodeURIComponent(cleanedDomain)}&forTransfer=false`;

  try {
    const estimateRes = await fetch(priceUrl, {
      method: 'GET',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json'
      }
    });

    if (!estimateRes.ok) {
      const errorText = await estimateRes.text();
      return res.status(estimateRes.status).json({
        error: 'GoDaddy pricing API failed',
        fallbackPrice: 15.99,
        status: estimateRes.status,
        raw: errorText
      });
    }

    const priceData = await estimateRes.json();
    const rawPrice = priceData.renew || priceData.current || priceData.price || 1599;
    const currency = priceData.currency || 'GBP';
    const domainPrice = parseFloat(((rawPrice / 100) * period).toFixed(2));

    res.json({ domainPrice, currency });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch domain price',
      fallbackPrice: 15.99,
      detail: err.message
    });
  }
});

export default router;

import express from 'express';
import { thirdParty } from '../index.js';

const router = express.Router();
const fetch = thirdParty.fetch;

// POST /get-domain-price
router.post('/get-domain-price', async (req, res) => {
  const { domain, duration } = req.body;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  const tld = cleanedDomain.split('.').slice(1).join('.');
  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const priceUrl = `${apiBase}/v1/domains/price/${tld}?domain=${encodeURIComponent(cleanedDomain)}&forTransfer=false`;

  console.log('📦 Requesting domain price from GoDaddy');
  console.log('🌐 Domain:', cleanedDomain);
  console.log('🔤 TLD:', tld);
  console.log('📅 Period:', period);
  console.log('🔗 URL:', priceUrl);

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
      console.warn(⚠️ GoDaddy pricing error [${estimateRes.status}]:`, errorText);
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

    if (isNaN(rawPrice)) {
      console.warn('⚠️ Unexpected price structure:', priceData);
      return res.status(502).json({
        error: 'Invalid price format received from GoDaddy',
        fallbackPrice: 15.99
      });
    }

    const pricePerYear = rawPrice / 100;
    const domainPrice = parseFloat((pricePerYear * period).toFixed(2));

    console.log(`💰 Estimated domain price for "${cleanedDomain}": £${domainPrice} (${currency}) for ${period} year(s)`);
    res.json({ domainPrice });

  } catch (err) {
    console.error('❌ Domain price fetch failed:', err.message);
    res.status(500).json({
      error: 'Failed to fetch domain price',
      fallbackPrice: 15.99,
      detail: err.message
    });
  }
});


// POST /check-domain
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
    console.log('🔍 Checking domain availability for:', cleanedDomain);
    console.log('🌍 GoDaddy API URL:', checkUrl);

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GoDaddy /check-domain API error [${response.status}]:`, errorText);
      return res.status(response.status).json({
        error: 'GoDaddy domain availability API failed.',
        status: response.status,
        raw: errorText
      });
    }

    const data = await response.json();
    console.log(`✅ Domain availability for "${cleanedDomain}":`, data.available);
    res.json({ available: data.available });

  } catch (err) {
    console.error('❌ Domain availability check failed:', err.message);
    res.status(500).json({ error: 'Domain availability check failed.', detail: err.message });
  }
});

export default router;

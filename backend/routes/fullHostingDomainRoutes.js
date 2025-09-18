import express from 'express';
import fetch from 'node-fetch';
import { tempSessions } from '../index.js';

const router = express.Router();

// ✅ Utility: Validate domain format
export const isValidDomain = d =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(String(d || '').trim().toLowerCase());

// ===============================
// GET /domain/check → Check availability
// ===============================
router.get('/domain/check', async (req, res) => {
  const { domain = '' } = req.query;
  const cleanedDomain = domain.trim().toLowerCase();

  if (!isValidDomain(cleanedDomain)) {
    return res.status(400).json({ available: false, error: 'Invalid domain format' });
  }

  try {
    const apiBase = process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com';

    const godaddyKey = process.env.GODADDY_API_KEY;
    const godaddySecret = process.env.GODADDY_API_SECRET;
    if (!godaddyKey || !godaddySecret) {
      return res.status(500).json({ available: false, error: 'GoDaddy credentials missing' });
    }

    const resp = await fetch(
      `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}`,
      {
        headers: {
          Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
          Accept: 'application/json'
        }
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ available: false, error: data.message || 'Check failed' });
    }

    return res.json({ available: !!data.available });
  } catch (err) {
    console.error('❌ Availability check failed:', err);
    return res.status(500).json({ available: false, error: 'Availability check failed' });
  }
});

// ===============================
// POST /domain/price → Estimate price
// ===============================
router.post('/domain/price', (req, res) => {
  try {
    const { domain, duration } = req.body || {};
    const cleanedDomain = (domain || '').trim().toLowerCase();

    if (!isValidDomain(cleanedDomain)) {
      return res.status(400).json({ error: 'Invalid domain' });
    }

    const years = parseInt(duration || '1', 10);
    const basePrice = 15.99; // base price per year (example)
    const domainPrice = basePrice * years;

    res.json({ domainPrice });
  } catch (err) {
    console.error('❌ Price estimation failed:', err);
    res.status(500).json({ error: 'Price estimation failed' });
  }
});

// ===============================
// POST /deploy-full-hosting/domain → Purchase domain
// ===============================
router.post('/deploy-full-hosting/domain', async (req, res) => {
  try {
    const { sessionId = '', domain = '', durationYears, duration = '1' } = req.body || {};
    const cleanedDomain = (domain || '').trim().toLowerCase();
    const years = parseInt(durationYears ?? duration, 10) || 1;

    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    if (!cleanedDomain || !isValidDomain(cleanedDomain)) {
      return res.status(400).json({ error: `Invalid domain: ${cleanedDomain || '(empty)'}` });
    }

    const session = tempSessions[sessionId];
    if (!session?.pages?.length) {
      return res.status(404).json({ error: 'Session not found or empty.' });
    }

    // 🔒 Lock check
    if (session.lockedDomain && session.lockedDomain !== cleanedDomain) {
      return res.status(409).json({
        error: `Domain mismatch. Locked: ${session.lockedDomain}, Got: ${cleanedDomain}`,
        code: 'DOMAIN_MISMATCH'
      });
    }

    const apiBase = process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com';

    const godaddyKey = process.env.GODADDY_API_KEY;
    const godaddySecret = process.env.GODADDY_API_SECRET;
    if (!godaddyKey || !godaddySecret) {
      return res.status(500).json({ error: 'GoDaddy credentials missing.' });
    }

    // 1) Pre-check availability
    let available = true;
    try {
      const availRes = await fetch(
        `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}`,
        {
          headers: { Authorization: `sso-key ${godaddyKey}:${godaddySecret}`, Accept: 'application/json' }
        }
      );
      const avail = await availRes.json();
      if (availRes.ok) available = !!avail?.available;
    } catch (e) {
      console.warn('⚠️ Availability check failed:', e.message);
    }

    // 2) Purchase (if available)
    try {
      if (available) {
        const contact = {
          addressMailing: { address1: '123 Example Street', city: 'London', state: 'London', postalCode: 'EC1A1AA', country: 'GB' },
          email: 'support@websitegenerator.co.uk',
          jobTitle: 'Owner',
          nameFirst: 'Website',
          nameLast: 'Customer',
          organization: 'WebsiteGenerator',
          phone: '+44.2030000000'
        };

        const payload = {
          domain: cleanedDomain,
          consent: { agreedAt: new Date().toISOString(), agreedBy: req.ip || '127.0.0.1', agreementKeys: ['DNRA','DNPA'] },
          contactAdmin: contact,
          contactBilling: contact,
          contactRegistrant: contact,
          contactTech: contact,
          period: years,
          privacy: true
        };

        const purchaseRes = await fetch(`${apiBase}/v1/domains/purchase`, {
          method: 'POST',
          headers: { Authorization: `sso-key ${godaddyKey}:${godaddySecret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!purchaseRes.ok) {
          const text = await purchaseRes.text();
          if (!text.includes('UNAVAILABLE_DOMAIN')) {
            throw new Error(`GoDaddy purchase failed: ${purchaseRes.status} ${text}`);
          }
          console.log(`ℹ️ Domain already owned: ${cleanedDomain}`);
        } else {
          console.log(`✅ Domain ${cleanedDomain} purchased successfully.`);
        }
      }
    } catch (err) {
      console.error('❌ Domain purchase failed:', err);
      return res.status(500).json({ error: 'Domain purchase failed', detail: err.message });
    }

    // Save session state
    tempSessions[sessionId] = { ...session, domain: cleanedDomain, domainPurchased: true };

    res.json({ success: true, customDomain: cleanedDomain, years });
  } catch (err) {
    console.error('❌ Domain step failed:', err);
    res.status(500).json({ error: 'Domain validation/purchase failed', detail: err.message });
  }
});

export default router;

import express from 'express';
import fetch from 'node-fetch';
import { tempSessions } from '../index.js';

const router = express.Router();

export const isValidDomain = d =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(String(d || ''));

// ✅ Step 0: Check Availability (GET)
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

// ✅ Step 1: Validate + Purchase Domain
router.post('/deploy-full-hosting/domain', async (req, res) => {
  try {
    const {
      sessionId = '',
      domain = '',
      durationYears,
      duration = '1'
    } = req.body || {};

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

    // 🔒 Enforce locked domain (if checkout already decided it)
    if (session.lockedDomain && session.lockedDomain !== cleanedDomain) {
      return res.status(409).json({
        error: `Domain mismatch. Locked: ${session.lockedDomain}, Got: ${cleanedDomain}`,
        code: 'DOMAIN_MISMATCH'
      });
    }

    // GoDaddy base URL
    const apiBase = process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com';

    const godaddyKey = process.env.GODADDY_API_KEY;
    const godaddySecret = process.env.GODADDY_API_SECRET;
    if (!godaddyKey || !godaddySecret) {
      return res.status(500).json({ error: 'GoDaddy credentials missing.' });
    }

    // 1) Availability pre-check (non-fatal if already owned)
    let available = true;
    try {
      const availRes = await fetch(
        `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}`,
        {
          headers: {
            Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
            Accept: 'application/json'
          }
        }
      );
      const avail = await availRes.json();
      if (availRes.ok) {
        available = !!avail?.available;
      }
    } catch (e) {
      console.warn('⚠️ Availability check failed:', e.message);
    }

    // 2) Purchase domain (idempotent)
    try {
      if (available) {
        const godaddyContact = {
          addressMailing: {
            address1: '123 Example Street',
            city: 'London',
            state: 'London',
            postalCode: 'EC1A1AA',
            country: 'GB'
          },
          email: 'support@websitegenerator.co.uk',
          jobTitle: 'Owner',
          nameFirst: 'Website',
          nameLast: 'Customer',
          organization: 'WebsiteGenerator',
          phone: '+44.2030000000'
        };

        const purchasePayload = {
          domain: cleanedDomain,
          consent: {
            agreedAt: new Date().toISOString(),
            agreedBy: req.ip || '127.0.0.1',
            agreementKeys: ['DNRA', 'DNPA']
          },
          contactAdmin: godaddyContact,
          contactBilling: godaddyContact,
          contactRegistrant: godaddyContact,
          contactTech: godaddyContact,
          period: years,
          privacy: true
        };

        const purchaseRes = await fetch(`${apiBase}/v1/domains/purchase`, {
          method: 'POST',
          headers: {
            Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(purchasePayload)
        });

        if (!purchaseRes.ok) {
          const text = await purchaseRes.text();
          if (!text.includes('UNAVAILABLE_DOMAIN')) {
            throw new Error(`GoDaddy domain purchase failed: ${purchaseRes.status} ${text}`);
          }
          console.log(`ℹ️ Domain already owned: ${cleanedDomain}`);
        } else {
          console.log(`✅ Domain ${cleanedDomain} purchased successfully.`);
        }
      }
    } catch (err) {
      console.error('❌ GoDaddy domain purchase failed:', err);
      return res.status(500).json({ error: 'Domain purchase failed', detail: err.message });
    }

    // save interim state
    tempSessions[sessionId] = {
      ...session,
      domain: cleanedDomain,
      domainPurchased: true
    };

    res.json({ success: true, customDomain: cleanedDomain, years });
  } catch (err) {
    console.error('❌ Domain step failed:', err);
    res.status(500).json({ error: 'Domain validation/purchase failed', detail: err.message });
  }
});

export default router;

import express from 'express';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import Stripe from 'stripe';
import { tempSessions } from '../index.js';
import { retryRequest, sanitizeRepoName, getUniqueRepoName } from '../utils/githubUtils.js';
import { setGitHubDNS } from '../utils/dnsUtils.js';

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/deploy-full-hosting', async (req, res) => {
  const { sessionId = '', domain = '', duration = '1', businessName = '' } = req.body || {};
  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  if (!sessionId || !domain || !businessName) {
    return res.status(400).json({ error: 'Missing session ID, domain, or business name.' });
  }

  const session = tempSessions[sessionId];
  if (!session || !Array.isArray(session.pages) || session.pages.length === 0) {
    return res.status(404).json({ error: 'Session not found or empty.' });
  }

  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const contact = {
    nameFirst: 'Joe',
    nameLast: 'Mort',
    email: 'support@websitegeneration.co.uk',
    phone: '+44.1234567890',
    addressMailing: {
      address1: '123 Web Street',
      city: 'Neath',
      state: 'WLS', // ISO state abbreviation (not "Wales")
      postalCode: 'SA10 6XY',
      country: 'GB'
    }
  };

  try {
    // 🔍 Check availability again
    const availRes = await fetch(`${apiBase}/v1/domains/available?domain=${cleanedDomain}`, {
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`
      }
    });
    const availData = await availRes.json();
    if (!availData.available) {
      return res.status(409).json({ error: 'Domain is no longer available.' });
    }

    // ✅ Get legal agreements
    const tld = cleanedDomain.split('.').pop();
    const agreementRes = await fetch(`${apiBase}/v1/domains/agreements?tlds=${tld}&privacy=false`, {
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`
      }
    });
    const agreements = await agreementRes.json();
    const agreementKeys = agreements.map(a => a.agreementKey);

    // ✅ Attempt domain purchase
    const purchasePayload = {
      domain: cleanedDomain,
      period,
      privacy: false,
      renewAuto: true,
      consent: {
        agreedAt: new Date().toISOString(),
        agreedBy: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1',
        agreementKeys
      },
      contactAdmin: contact,
      contactRegistrant: contact,
      contactTech: contact,
      contactBilling: contact
    };

    const purchaseRes = await fetch(`${apiBase}/v1/domains/purchase`, {
      method: 'POST',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(purchasePayload)
    });

    const purchaseData = await purchaseRes.json();
    if (!purchaseRes.ok) {
      console.warn('❌ Domain purchase failed. GoDaddy response:', purchaseData);
      return res.status(purchaseRes.status).json({
        error: 'Domain purchase failed',
        details: purchaseData?.message || purchaseData
      });
    }

    // ✅ Deploy to GitHub
    const repoName = `site-${Date.now()}`;
    const owner = process.env.GITHUB_USERNAME;

    await octokit.repos.createForAuthenticatedUser({ name: repoName, private: false, auto_init: true });

    for (let i = 0; i < session.pages.length; i++) {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: i === 0 ? 'index.html' : `page${i + 1}.html`,
        message: `Add page ${i + 1}`,
        content: Buffer.from(session.pages[i]).toString('base64'),
        branch: 'main'
      });
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'CNAME',
      message: 'Add CNAME',
      content: Buffer.from(cleanedDomain).toString('base64'),
      branch: 'main'
    });

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: '.github/workflows/static.yml',
      message: 'Add GitHub Pages workflow',
      content: Buffer.from(`name: Deploy static site
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./`).toString('base64'),
      branch: 'main'
    });

    const pagesUrl = `https://${cleanedDomain}`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      domainPurchased: true,
      repo: repoName,
      domain: cleanedDomain
    };

    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('❌ Full hosting failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Full hosting failed', detail: err.message });
  }
});

export default router;

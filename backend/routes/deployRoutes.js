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

// ✅ GitHub-Only Deployment (No Domain)
router.post('/deploy-github', async (req, res) => {
  try {
    const { sessionId = '', businessName = '' } = req.body || {};

    if (!sessionId || !businessName || typeof sessionId !== 'string' || typeof businessName !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID or business name.' });
    }

    const session = tempSessions[sessionId];
    if (!session || !Array.isArray(session.pages) || session.pages.length === 0) {
      return res.status(404).json({ error: 'Session not found or empty.' });
    }

    const owner = process.env.GITHUB_USERNAME?.toLowerCase();
    if (!owner) throw new Error('❌ GITHUB_USERNAME not set');

    const cleanName = sanitizeRepoName(businessName);
    const repoName = await getUniqueRepoName(cleanName, owner, octokit);

    console.log(`🚀 Creating repo: ${repoName}`);
    await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    });

    await new Promise(resolve => setTimeout(resolve, 2000)); // Let GitHub finish initializing

    // Upload pages to main
    for (let i = 0; i < session.pages.length; i++) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: i === 0 ? 'index.html' : `page${i + 1}.html`,
        message: `Add page ${i + 1}`,
        content: Buffer.from(session.pages[i]).toString('base64'),
        branch: 'main'
      });
    }

    // Enable GitHub Pages on main branch
    await octokit.request('PUT /repos/{owner}/{repo}/pages', {
      owner,
      repo: repoName,
      source: {
        branch: 'main',
        path: '/'
      }
    });

    const pagesUrl = `https://${owner}.github.io/${repoName}`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      repo: repoName
    };

    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('❌ GitHub deploy failed:', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'GitHub deployment failed', detail: err?.message || err.toString() });
  }
});

// ✅ Full Hosting + Domain Purchase + GitHub Deployment
router.post('/deploy-full-hosting', async (req, res) => {
  try {
    const { sessionId = '', domain = '', duration = '1', businessName = '' } = req.body || {};
    const cleanedDomain = domain.trim().toLowerCase();
    const period = parseInt(duration, 10) || 1;

    if (!sessionId || !cleanedDomain || !businessName || typeof sessionId !== 'string' || typeof cleanedDomain !== 'string' || typeof businessName !== 'string') {
      return res.status(400).json({ error: 'Invalid input: session ID, domain, or business name.' });
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
        state: 'WLS',
        postalCode: 'SA10 6XY',
        country: 'GB'
      }
    };

    const availRes = await fetch(`${apiBase}/v1/domains/available?domain=${cleanedDomain}`, {
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`
      }
    });
    const availData = await availRes.json();
    if (!availData.available) {
      return res.status(409).json({ error: 'Domain is no longer available.' });
    }

    const tld = cleanedDomain.split('.').pop();
    const agreementRes = await fetch(`${apiBase}/v1/domains/agreements?tlds=${tld}&privacy=false`, {
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`
      }
    });
    const agreements = await agreementRes.json();
    const agreementKeys = agreements.map(a => a.agreementKey);

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

    console.log('📦 Purchasing domain via GoDaddy...');
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
      console.warn('❌ Domain purchase failed:', purchaseData);
      return res.status(purchaseRes.status).json({
        error: 'Domain purchase failed',
        details: purchaseData?.message || purchaseData
      });
    }

    const owner = process.env.GITHUB_USERNAME?.toLowerCase();
    const cleanName = sanitizeRepoName(businessName);
    const repoName = await getUniqueRepoName(cleanName, owner, octokit);

    console.log(`🚀 Creating repo for full hosting: ${repoName}`);
    await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    });

    await new Promise(resolve => setTimeout(resolve, 2000)); // Let GitHub init

    // Upload pages to main
    for (let i = 0; i < session.pages.length; i++) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: i === 0 ? 'index.html' : `page${i + 1}.html`,
        message: `Add page ${i + 1}`,
        content: Buffer.from(session.pages[i]).toString('base64'),
        branch: 'main'
      });
    }

    // Add CNAME
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'CNAME',
      message: 'Add CNAME',
      content: Buffer.from(cleanedDomain).toString('base64'),
      branch: 'main'
    });

    // Enable GitHub Pages
    await octokit.request('PUT /repos/{owner}/{repo}/pages', {
      owner,
      repo: repoName,
      source: {
        branch: 'main',
        path: '/'
      }
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
    console.error('❌ Full hosting failed:', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'Full hosting failed', detail: err?.message || err.toString() });
  }
});

export default router;



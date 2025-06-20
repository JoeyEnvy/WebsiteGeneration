import express from 'express';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { tempSessions } from '../index.js';
import { retryRequest, sanitizeRepoName, getUniqueRepoName } from '../utils/githubUtils.js';
import { setGitHubDNS } from '../utils/dnsUtils.js';

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ✅ DEBUG CHECK
router.get('/debug-check', (req, res) => {
  res.json({ ok: true, message: '✅ deployRoutes.js is working' });
});

// ✅ POST /deploy-github — GitHub Hosted (no domain)
router.post('/deploy-github', async (req, res) => {
  const { sessionId } = req.body;
  const sessionData = tempSessions[sessionId];
  const businessName = sessionData?.businessName;
  const pages = sessionData?.pages || [];

  if (!sessionId || !businessName || !pages.length) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    const repoName = await getUniqueRepoName(businessName, owner);

    await retryRequest(() => octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    }));

    for (const [index, html] of pages.entries()) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: index === 0 ? 'index.html' : `page${index + 1}.html`,
        content: Buffer.from(html).toString('base64'),
        message: `Add page ${index + 1}`,
        branch: 'main'
      }));
    }

    const pagesUrl = `https://${owner}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    console.log('✅ GitHub deployment complete:', { pagesUrl, repoUrl });
    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('❌ GitHub deploy error:', err.message);
    res.status(500).json({ error: 'GitHub deployment failed.', detail: err.message });
  }
});

// ✅ POST /deploy-full-hosting — GoDaddy Domain + GitHub Hosting
router.post('/deploy-full-hosting', async (req, res) => {
  const { sessionId, domain, duration = 1, businessName } = req.body;

  if (!sessionId || !domain || !businessName) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const session = tempSessions[sessionId];
  if (!session || !session.pages || session.pages.length === 0) {
    return res.status(404).json({ error: 'Session not found or empty.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

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
      state: 'Wales',
      postalCode: 'SA10 6XY',
      country: 'GB'
    }
  };

  try {
    const purchaseRes = await fetch(`${apiBase}/v1/domains/purchase`, {
      method: 'POST',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: cleanedDomain,
        consent: {
          agreedAt: new Date().toISOString(),
          agreedBy: '127.0.0.1',
          agreementKeys: ['DNRA']
        },
        period,
        privacy: false,
        autoRenew: true,
        contactAdmin: contact,
        contactRegistrant: contact,
        contactTech: contact,
        contactBilling: contact
      })
    });

    const purchaseData = await purchaseRes.json();

    if (!purchaseRes.ok) {
      console.error(`❌ Domain purchase failed [${purchaseRes.status}]:`, purchaseData);
      return res.status(purchaseRes.status).json({
        error: 'Domain purchase failed',
        details: purchaseData
      });
    }

    console.log(`✅ Domain purchased successfully: ${cleanedDomain}`);

    const repoName = `site-${Date.now()}`;
    const owner = process.env.GITHUB_USERNAME;

    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    });

    for (let index = 0; index < session.pages.length; index++) {
      const filePath = index === 0 ? 'index.html' : `page${index + 1}.html`;
      const content = Buffer.from(session.pages[index] || '').toString('base64');

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: filePath,
        message: `Add page ${index + 1}`,
        content,
        branch: 'main'
      });
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'CNAME',
      message: 'Set custom domain',
      content: Buffer.from(cleanedDomain).toString('base64'),
      branch: 'main'
    });

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: '.github/workflows/static.yml',
      message: 'Enable GitHub Pages',
      content: Buffer.from(`
name: Deploy static site
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

    console.log('✅ Full hosting deployed:', { pagesUrl, repoUrl });

    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('❌ Full hosting deployment failed:', err.message);
    res.status(500).json({ error: 'Full hosting deployment failed', detail: err.message });
  }
});

export default router;


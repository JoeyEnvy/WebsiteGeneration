// /routes/deployRoutes.js

import express from 'express';
import { tempSessions, thirdParty } from '../index.js';
import { retryRequest, sanitizeRepoName, getUniqueRepoName } from '../utils/githubUtils.js';
import { setGitHubDNS } from '../utils/dnsUtils.js';

const router = express.Router();
const octokit = thirdParty.octokit;
const fetch = thirdParty.fetch;

// POST /deploy-github
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

    // If custom domain exists in session, add CNAME
    if (sessionData.domain) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: 'CNAME',
        content: Buffer.from(sessionData.domain).toString('base64'),
        message: 'Add CNAME file',
        branch: 'main'
      }));
    }

    await retryRequest(() => octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'static.yml',
      content: Buffer.from(`publish: index.html\n`).toString('base64'),
      message: 'Add static.yml for deployment',
      branch: 'main'
    }));

    for (const folder of ['images', 'videos']) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: `${folder}/.gitkeep`,
        content: Buffer.from('').toString('base64'),
        message: `Create empty ${folder}/ folder`,
        branch: 'main'
      }));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await retryRequest(() => octokit.request('POST /repos/{owner}/{repo}/pages', {
        owner,
        repo: repoName,
        source: { branch: 'main', path: '/' }
      }));
    } catch (err) {
      if (err.status === 409) {
        await retryRequest(() => octokit.repos.updateInformationAboutPagesSite({
          owner,
          repo: repoName,
          source: { branch: 'main', path: '/' }
        }));
      } else throw err;
    }

    res.json({
      success: true,
      url: `https://${owner}.github.io/${repoName}/`,
      repo: `https://github.com/${owner}/${repoName}`,
      repoName
    });

  } catch (err) {
    console.error('Deployment Error:', err);
    res.status(500).json({ error: 'Deployment failed', details: err.message });
  }
});

// POST /deploy-full-hosting
router.post('/deploy-full-hosting', async (req, res) => {
  const { sessionId, domain, duration } = req.body;
  const session = tempSessions[sessionId];

  if (!session || !session.pages || !session.businessName) {
    return res.status(400).json({ error: 'Invalid session data' });
  }

  const businessName = session.businessName;
  const pages = session.pages;
  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  try {
    const contact = {
      nameFirst: 'Joe',
      nameLast: 'Mort',
      email: 'your@email.com',
      phone: '+441234567890',
      addressMailing: {
        address1: '123 Test St',
        city: 'London',
        state: 'London',
        postalCode: 'SW1A1AA',
        country: 'GB'
      }
    };

    const purchasePayload = {
      consent: {
        agreedAt: new Date().toISOString(),
        agreedBy: req.ip || '127.0.0.1',
        agreementKeys: ['DNRA']
      },
      contactAdmin: contact,
      contactRegistrant: contact,
      contactTech: contact,
      contactBilling: contact,
      period: parseInt(duration, 10),
      privacy: false,
      autoRenew: true
    };

    const headers = {
      Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    const purchaseUrl = `${apiBase}/v1/domains/purchase/${domain}`;
    const response = await fetch(purchaseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(purchasePayload)
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('❌ GoDaddy purchase failed:', errData);
      return res.status(500).json({ error: 'Domain purchase failed', details: errData });
    }

    await setGitHubDNS(domain);

  } catch (err) {
    console.error('❌ Domain purchase/DNS error:', err.message);
    return res.status(500).json({ error: 'GoDaddy API error', details: err.message });
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

    for (let i = 0; i < pages.length; i++) {
      const filePath = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: filePath,
        content: Buffer.from(pages[i]).toString('base64'),
        message: `Add page ${i + 1}`,
        branch: 'main'
      }));
    }

    await retryRequest(() => octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'static.yml',
      content: Buffer.from(`publish: index.html\n`).toString('base64'),
      message: 'Add static.yml',
      branch: 'main'
    }));

    for (const folder of ['images', 'videos']) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: `${folder}/.gitkeep`,
        content: Buffer.from('').toString('base64'),
        message: `Create empty ${folder}/ folder`,
        branch: 'main'
      }));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await retryRequest(() => octokit.request('POST /repos/{owner}/{repo}/pages', {
        owner,
        repo: repoName,
        source: { branch: 'main', path: '/' }
      }));
    } catch (err) {
      if (err.status === 409) {
        await retryRequest(() => octokit.repos.updateInformationAboutPagesSite({
          owner,
          repo: repoName,
          source: { branch: 'main', path: '/' }
        }));
      } else throw err;
    }

    const pagesUrl = `https://${owner}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    res.json({
      success: true,
      domain,
      domainStatus: `✅ Domain purchased and DNS set (${duration} year${duration > 1 ? 's' : ''})`,
      pagesUrl,
      repoUrl
    });

  } catch (err) {
    console.error('❌ GitHub deployment error:', err.message);
    return res.status(500).json({ error: 'GitHub deployment failed', details: err.message });
  }
});

export default router;

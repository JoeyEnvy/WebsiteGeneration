import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import { sanitizeRepoName, getUniqueRepoName } from '../utils/githubUtils.js';

const router = express.Router();

// ✅ GitHub-Only Deployment (No Domain, Simple-Git based)
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

    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing.');

    const cleanName = sanitizeRepoName(businessName);
    const repoName = await getUniqueRepoName(cleanName, owner);
    const repoUrl = `https://${owner}:${token}@github.com/${owner}/${repoName}.git`;
    const localDir = path.join('/tmp', repoName);

    // Step 1: Create the repo via GitHub API (no Octokit needed)
    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: true })
    });

    // Step 2: Prepare local folder
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    // Step 3: Git init + commit + push
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']); // ✅ FIXED
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');
    await git.add('.');
    await git.commit('Initial commit');
    await git.addRemote('origin', repoUrl);
    await git.push('origin', 'main');

    const pagesUrl = `https://${owner}.github.io/${repoName}`;
    const repoUrlPublic = `https://github.com/${owner}/${repoName}`;

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      repo: repoName
    };

    res.json({ success: true, pagesUrl, repoUrl: repoUrlPublic });

  } catch (err) {
    console.error('❌ GitHub CLI deploy failed:', err);
    res.status(500).json({ error: 'GitHub deployment failed', detail: err.message });
  }
});

// ✅ Full Hosting + Domain Purchase + GitHub Push (Simple-Git based)
router.post('/deploy-full-hosting', async (req, res) => {
  try {
    const { sessionId = '', domain = '', duration = '1', businessName = '' } = req.body || {};
    const cleanedDomain = domain.trim().toLowerCase();
    const period = parseInt(duration, 10) || 1;

    if (!sessionId || !cleanedDomain || !businessName) {
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
      return res.status(purchaseRes.status).json({
        error: 'Domain purchase failed',
        details: purchaseData?.message || purchaseData
      });
    }

    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing.');

    const cleanName = sanitizeRepoName(businessName);
    const repoName = await getUniqueRepoName(cleanName, owner);
    const repoUrl = `https://${owner}:${token}@github.com/${owner}/${repoName}.git`;
    const localDir = path.join('/tmp', repoName);

    // Create repo on GitHub
    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: true })
    });

    // Prepare folder
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    // Add CNAME
    await fs.writeFile(path.join(localDir, 'CNAME'), cleanedDomain);

    // Git init + push
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']); // ✅ FIXED
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');
    await git.add('.');
    await git.commit('Initial commit with custom domain');
    await git.addRemote('origin', repoUrl);
    await git.push('origin', 'main');

    const pagesUrl = `https://${cleanedDomain}`;
    const repoUrlPublic = `https://github.com/${owner}/${repoName}`;

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      domainPurchased: true,
      repo: repoName,
      domain: cleanedDomain
    };

    res.json({ success: true, pagesUrl, repoUrl: repoUrlPublic });

  } catch (err) {
    console.error('❌ Full hosting failed:', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'Full hosting failed', detail: err?.message || err.toString() });
  }
});

export default router;


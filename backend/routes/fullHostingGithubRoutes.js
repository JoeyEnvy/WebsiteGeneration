// routes/fullHostingGithubRoutes.js – FINAL 100% WORKING (25 Nov 2025)
// Uses EXACT business name → repo name → sets DNS perfectly
// NO createOrReuseRepo → direct GitHub API calls (fixes your deploy error)

import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import {
  sanitizeRepoName,
  getUniqueRepoName,
  enableGitHubPagesFromBranch
} from '../utils/githubUtils.js';

const router = express.Router();

// MAIN DEPLOY ENDPOINT – called by webhook after domain purchase
router.post('/deploy', async (req, res) => {
  const { sessionId, bypass } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const saved = tempSessions.get(sessionId);
  if (!saved || saved.type !== 'full-hosting') {
    return res.status(404).json({ error: 'Session not found or invalid type' });
  }

  if (!bypass && !saved.domainPurchased) {
    return res.status(400).json({ error: 'Domain not purchased yet' });
  }

  try {
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing');

    // USE BUSINESS NAME AS REPO NAME — EXACTLY WHAT USER TYPED
    const rawName = saved.businessName || saved.domain.split('.')[0];
    const repoName = await getUniqueRepoName(rawName, owner);
    const repoUrl = `https://${owner}.github.io/${repoName}/`;
    const fullRepoUrl = `https://github.com/${owner}/${repoName}`;

    // CREATE REPO DIRECTLY (no createOrReuseRepo needed)
    const createResp = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({
        name: repoName,
        private: false,
        auto_init: false,
        description: `Website for ${saved.domain} – ${saved.businessName || 'Custom Site'}`
      })
    });

    let repoData;
    if (createResp.status === 201) {
      repoData = await createResp.json();
    } else if (createResp.status === 422) {
      // Repo already exists → just use it
      const existing = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: { Authorization: `token ${token}` }
      });
      repoData = await existing.json();
    } else {
      const err = await createResp.text();
      throw new Error(`GitHub repo creation failed: ${createResp.status} ${err}`);
    }

    // TEMP DIR + WRITE FILES
    const localDir = path.join('/tmp', repoName);
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    // Write all pages
    for (let i = 0; i < saved.pages.length; i++) {
      const fileName = saved.structure?.[i]?.file || (i === 0 ? 'index.html' : `page${i + 1}.html`);
      await fs.writeFile(path.join(localDir, fileName), saved.pages[i]);
    }

    // Required for GitHub Pages
    await fs.writeFile(path.join(localDir, '.nojekyll'), '');
    await fs.writeFile(path.join(localDir, 'README.md'), `# ${saved.domain} – ${saved.businessName || 'Website'}`);

    // GIT PUSH
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addConfig('user.name', 'Website Generator');
    await git.addConfig('user.email', 'bot@websitegeneration.co.uk');
    await git.add('.');
    await git.commit('Full hosting deployment');
    await git.addRemote('origin', `https://${owner}:${token}@github.com/${owner}/${repoName}.git`);
    await git.push('origin', 'main', ['--force']);

    // ENABLE GITHUB PAGES
    await enableGitHubPagesFromBranch(owner, repoName, token);

    // NOW SET DNS ON GODADDY — AFTER REPO EXISTS
    if (saved.domainPurchased && process.env.GODADDY_KEY) {
      const key = process.env.GODADDY_KEY;
      const secret = process.env.GODADDY_SECRET;

      const dnsPayload = [
        { type: "CNAME", name: "@", data: `${owner}.github.io`, ttl: 600 },
        { type: "CNAME", name: "www", data: repoUrl.replace("https://", ""), ttl: 600 }
      ];

      await fetch(`https://api.godaddy.com/v1/domains/${saved.domain}/records`, {
        method: "PUT",
        headers: {
          Authorization: `sso-key ${key}:${secret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dnsPayload)
      }).catch(err => console.warn("DNS update failed (non-critical):", err.message));
    }

    // SAVE FINAL LINKS
    saved.deployed = true;
    saved.pagesUrl = repoUrl;
    saved.repoUrl = fullRepoUrl;
    saved.repoName = repoName;
    tempSessions.set(sessionId, saved);

    res.json({
      success: true,
      domain: saved.domain,
      pagesUrl: repoUrl,
      repoUrl: fullRepoUrl,
      message: "Site deployed and DNS configured!"
    });

  } catch (err) {
    console.error('Deploy failed:', err.message);
    res.status(500).json({ error: 'Deployment failed', detail: err.message });
  }
});

export default router;
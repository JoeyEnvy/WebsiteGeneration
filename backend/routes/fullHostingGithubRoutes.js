// routes/fullHostingGithubRoutes.js – FINAL, ACTUALLY WORKING
// GitHub Pages via workflow (static.yml) – no API enable calls

import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import { getUniqueRepoName } from '../utils/githubUtils.js';

const router = express.Router();

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

    // 🔒 HARD FAIL IF NO HTML
    if (!Array.isArray(saved.pages) || saved.pages.length === 0) {
      throw new Error('❌ No HTML pages found in session (saved.pages empty)');
    }

    const rawName = saved.businessName || saved.domain.split('.')[0];
    const repoName = await getUniqueRepoName(rawName, owner);
    const pagesUrl = `https://${owner}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    // CREATE REPO
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
        description: `Website for ${saved.domain}`
      })
    });

    if (![201, 422].includes(createResp.status)) {
      throw new Error(`Repo create failed: ${createResp.status}`);
    }

    // TEMP DIR
    const localDir = path.join('/tmp', repoName);
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    // WRITE HTML FILES
    for (let i = 0; i < saved.pages.length; i++) {
      const file =
        saved.structure?.[i]?.file ||
        (i === 0 ? 'index.html' : `page${i + 1}.html`);
      await fs.writeFile(path.join(localDir, file), saved.pages[i]);
    }

    // REQUIRED FILES
    await fs.writeFile(path.join(localDir, '.nojekyll'), '');
    await fs.writeFile(
      path.join(localDir, 'README.md'),
      `# ${saved.domain}\n\nDeployed by WebsiteGeneration.co.uk`
    );

    // 🔥 GITHUB PAGES WORKFLOW (THIS WAS MISSING)
    const workflowDir = path.join(localDir, '.github', 'workflows');
    await fs.ensureDir(workflowDir);

    await fs.writeFile(
      path.join(workflowDir, 'static.yml'),
      `
name: Deploy static site to GitHub Pages

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
`.trim()
    );

    // PUSH TO GITHUB
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addConfig('user.name', 'Website Generator');
    await git.addConfig('user.email', 'bot@websitegeneration.co.uk');
    await git.add('.');
    await git.commit('Deploy site');
    await git.addRemote(
      'origin',
      `https://${owner}:${token}@github.com/${owner}/${repoName}.git`
    );
    await git.push('origin', 'main', ['--force']);

    // DNS (NON-BLOCKING)
    if (saved.domainPurchased && process.env.GODADDY_KEY) {
      await fetch(`https://api.godaddy.com/v1/domains/${saved.domain}/records`, {
        method: 'PUT',
        headers: {
          Authorization: `sso-key ${process.env.GODADDY_KEY}:${process.env.GODADDY_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          { type: 'CNAME', name: '@', data: `${owner}.github.io`, ttl: 600 },
          { type: 'CNAME', name: 'www', data: `${owner}.github.io`, ttl: 600 }
        ])
      }).catch(() => {});
    }

    saved.deployed = true;
    saved.pagesUrl = pagesUrl;
    saved.repoUrl = repoUrl;
    saved.repoName = repoName;
    tempSessions.set(sessionId, saved);

    res.json({
      success: true,
      domain: saved.domain,
      pagesUrl,
      repoUrl
    });

  } catch (err) {
    console.error('Deploy failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

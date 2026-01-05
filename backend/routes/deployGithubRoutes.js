// routes/deployGithubRoutes.js
// GitHub Pages deploy (non–full-hosting)
// HTML in repo root
// GitHub Pages via Actions (workflow mode ENABLED)

import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import { getUniqueRepoName, sanitizeRepoName } from '../utils/githubUtils.js';

const router = express.Router();

router.post('/github', async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const saved = tempSessions.get(sessionId);
  if (!saved || !Array.isArray(saved.pages)) {
    return res.status(404).json({ error: 'Session not found or empty' });
  }

  try {
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing');

    const repoName = await getUniqueRepoName(
      sanitizeRepoName(saved.businessName || 'site'),
      owner
    );

    const pagesUrl = `https://${owner}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    // CREATE REPO
    const create = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        name: repoName,
        private: false,
        auto_init: false
      })
    });

    if (!create.ok) {
      throw new Error(await create.text());
    }

    const dir = path.join('/tmp', repoName);
    await fs.remove(dir);
    await fs.ensureDir(dir);

    // WRITE HTML FILES TO ROOT
    for (let i = 0; i < saved.pages.length; i++) {
      const p = saved.pages[i];
      const filename =
        typeof p === 'string'
          ? i === 0 ? 'index.html' : `page${i + 1}.html`
          : p.slug === 'home' ? 'index.html' : `${p.slug}.html`;

      const html = typeof p === 'string' ? p : p.html;
      await fs.writeFile(path.join(dir, filename), html);
    }

    await fs.writeFile(path.join(dir, '.nojekyll'), '');

    // WORKFLOW
    const wfDir = path.join(dir, '.github', 'workflows');
    await fs.ensureDir(wfDir);

    await fs.writeFile(
      path.join(wfDir, 'static.yml'),
`name: Deploy GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
`
    );

    // GIT PUSH
    const git = simpleGit(dir);
    await git.init(['--initial-branch=main']);
    await git.addConfig('user.name', 'WebsiteGeneration Bot');
    await git.addConfig('user.email', 'bot@websitegeneration.co.uk');
    await git.add('.');
    await git.commit('Deploy site');
    await git.addRemote(
      'origin',
      `https://${owner}:${token}@github.com/${owner}/${repoName}.git`
    );
    await git.push('origin', 'main', ['--force']);

    // 🔑 ENABLE GITHUB PAGES (THIS WAS MISSING)
    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/pages`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ build_type: 'workflow' })
      }
    );

    saved.pagesUrl = pagesUrl;
    saved.repoUrl = repoUrl;
    tempSessions.set(sessionId, saved);

    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('GitHub deploy failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

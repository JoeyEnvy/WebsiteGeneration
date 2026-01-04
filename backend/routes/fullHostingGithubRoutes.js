// routes/fullHostingGithubRoutes.js
// FULL HOSTING GitHub deploy
// Repo root contains HTML (normal repo)
// GitHub Pages deploy uses Actions workflow that builds /dist and publishes that
// NO Pages API enable

import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import { getUniqueRepoName, sanitizeRepoName } from '../utils/githubUtils.js';

const router = express.Router();

router.post('/deploy', async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const saved = tempSessions.get(sessionId);
  if (!saved || saved.type !== 'full-hosting') {
    return res.status(404).json({ error: 'Invalid session' });
  }

  if (!Array.isArray(saved.pages)) {
    return res.status(400).json({ error: 'No HTML pages found' });
  }

  try {
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing');

    const rawName = saved.businessName || saved.domain?.split('.')?.[0] || 'site';
    const repoName = await getUniqueRepoName(sanitizeRepoName(rawName), owner);

    const pagesUrl = `https://${owner}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    // CREATE REPO
    const createResp = await fetch('https://api.github.com/user/repos', {
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

    if (!createResp.ok) {
      const t = await createResp.text();
      throw new Error(`GitHub repo create failed: ${createResp.status} ${t}`);
    }

    const dir = path.join('/tmp', repoName);
    await fs.remove(dir);
    await fs.ensureDir(dir);

    // WRITE HTML FILES TO REPO ROOT (normal layout)
    for (let i = 0; i < saved.pages.length; i++) {
      const page = saved.pages[i];

      let filename;
      let html;

      if (typeof page === 'string') {
        // legacy
        filename = i === 0 ? 'index.html' : `page${i + 1}.html`;
        html = page;
      } else {
        filename = page.slug === 'home' ? 'index.html' : `${page.slug}.html`;
        html = page.html;
      }

      await fs.writeFile(path.join(dir, filename), html);
    }

    // optional but fine
    await fs.writeFile(path.join(dir, '.nojekyll'), '');

    // Workflow: publish /dist (built in workflow) so artifact excludes .github
    const wfDir = path.join(dir, '.github', 'workflows');
    await fs.ensureDir(wfDir);

    await fs.writeFile(
      path.join(wfDir, 'static.yml'),
`name: Deploy GitHub Pages

on:
  push:
    branches:
      - main

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

      - name: Build publish folder
        run: |
          mkdir -p dist
          rsync -av --delete \
            --exclude=".git" \
            --exclude=".github" \
            --exclude="dist" \
            ./ dist/

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
`
    );

    // GIT PUSH
    const git = simpleGit(dir);
    await git.init(['--initial-branch=main']);
    await git.addConfig('user.name', 'WebsiteGeneration Bot');
    await git.addConfig('user.email', 'bot@websitegeneration.co.uk');

    await git.add('.');
    await git.commit('Full hosting deploy');
    await git.addRemote('origin', `https://${owner}:${token}@github.com/${owner}/${repoName}.git`);
    await git.push('origin', 'main', ['--force']);

    saved.deployed = true;
    saved.pagesUrl = pagesUrl;
    saved.repoUrl = repoUrl;
    saved.repoName = repoName;
    tempSessions.set(sessionId, saved);

    return res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('Full hosting deploy failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

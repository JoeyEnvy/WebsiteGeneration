import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import { sanitizeRepoName, getUniqueRepoName, enableGitHubPagesWorkflow } from '../utils/githubUtils.js';

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

    // Step 1: Create the repo via GitHub API
    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: true })
    });

    // Step 2: Clone, write, commit, and push
    await simpleGit().clone(repoUrl, localDir);
    const git = simpleGit(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    // Write GitHub Pages workflow
    const workflowDir = path.join(localDir, '.github', 'workflows');
    await fs.ensureDir(workflowDir);
    const staticYaml = `
name: Deploy static content to Pages

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
`;
    await fs.writeFile(path.join(workflowDir, 'static.yml'), staticYaml.trim());

    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');
    await git.add('.');
    await git.commit('Initial commit with GitHub Pages workflow');
    await git.push('origin', 'main');

    // Step 3: Enable GitHub Pages via API
    const pagesUrl = await enableGitHubPagesWorkflow(owner, repoName, token);
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
  // (This route remains unchanged for now)
  // No changes here unless you want to enable Pages + workflow in that flow too
});

export default router;


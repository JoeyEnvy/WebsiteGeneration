import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { tempSessions } from '../index.js';
import {
  sanitizeRepoName,
  getUniqueRepoName,
  enableGitHubPagesWorkflow,
  retryRequest
} from '../utils/githubUtils.js';

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

    // Step 1: Create the repo without auto-init
    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: false })
    });

    // Step 2: Prepare local directory manually and init
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    await fs.writeFile(path.join(localDir, '.nojekyll'), '');

    const workflowDir = path.join(localDir, '.github', 'workflows');
    await fs.ensureDir(workflowDir);

    const staticYaml = [
      'name: Deploy static content to Pages',
      '',
      'on:',
      '  push:',
      '    branches: [ "main" ]',
      '',
      'permissions:',
      '  contents: read',
      '  pages: write',
      '  id-token: write',
      '',
      'concurrency:',
      '  group: "pages"',
      '  cancel-in-progress: true',
      '',
      'jobs:',
      '  deploy:',
      '    environment:',
      '      name: github-pages',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: Checkout repository',
      '        uses: actions/checkout@v4',
      '      - name: Setup Pages',
      '        uses: actions/configure-pages@v5',
      '      - name: Upload site artifact',
      '        uses: actions/upload-pages-artifact@v3',
      '        with:',
      "          path: '.'",
      '      - name: Deploy to GitHub Pages',
      '        id: deployment',
      '        uses: actions/deploy-pages@v4'
    ].join('\n');

    await fs.writeFile(path.join(workflowDir, 'static.yml'), staticYaml);

    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');
    await git.add('.');
    await git.commit('Initial commit with GitHub Pages workflow');
    await git.push('origin', 'main');

    await fs.appendFile(path.join(localDir, 'index.html'), '\n<!-- Trigger rebuild -->');
    await git.add('.');
    await git.commit('Trigger GitHub Actions workflow');
    await git.push('origin', 'main');

    let pagesUrl = `https://${owner}.github.io/${repoName}/`;
    try {
      pagesUrl = await retryRequest(() => enableGitHubPagesWorkflow(owner, repoName, token), 3, 2000);
    } catch (err) {
      console.warn('⚠️ GitHub Pages API failed — using fallback link:', err.message);
    }

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

// ✅ Full Hosting + GitHub Pages Support
router.post('/deploy-full-hosting', async (req, res) => {
  try {
    const { sessionId = '', domain = '', duration = '1', businessName = '' } = req.body || {};
    const cleanedDomain = domain.trim().toLowerCase();

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

    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: false })
    });

    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    await fs.writeFile(path.join(localDir, '.nojekyll'), '');
    await fs.writeFile(path.join(localDir, 'CNAME'), cleanedDomain);

    const workflowDir = path.join(localDir, '.github', 'workflows');
    await fs.ensureDir(workflowDir);
    await fs.writeFile(path.join(workflowDir, 'static.yml'), staticYaml);

    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');
    await git.add('.');
    await git.commit('Initial commit with GitHub Pages workflow and CNAME');
    await git.push('origin', 'main');

    await fs.appendFile(path.join(localDir, 'index.html'), '\n<!-- Trigger rebuild -->');
    await git.add('.');
    await git.commit('Trigger GitHub Actions workflow');
    await git.push('origin', 'main');

    let pagesUrl = `https://${cleanedDomain}/`;
    try {
      pagesUrl = await retryRequest(() => enableGitHubPagesWorkflow(owner, repoName, token), 3, 2000);
    } catch (err) {
      console.warn('⚠️ GitHub Pages API failed — using fallback link:', err.message);
    }

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
    console.error('❌ Full hosting deployment failed:', err);
    res.status(500).json({ error: 'Full hosting deployment failed', detail: err.message });
  }
});

export default router;

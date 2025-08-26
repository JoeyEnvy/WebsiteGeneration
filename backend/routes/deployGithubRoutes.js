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

// ✅ GitHub-only deployment (no domain)
router.post('/deploy-github', async (req, res) => {
  try {
    const { sessionId = '', businessName = '' } = req.body || {};
    if (!sessionId || !businessName) {
      return res.status(400).json({ error: 'Invalid session ID or business name.' });
    }

    const session = tempSessions[sessionId];
    if (!session?.pages?.length) {
      return res.status(404).json({ error: 'Session not found or empty.' });
    }

    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing.');

    const repoName = await getUniqueRepoName(sanitizeRepoName(businessName), owner);
    const repoUrl = `https://${owner}:${token}@github.com/${owner}/${repoName}.git`;
    const localDir = path.join('/tmp', repoName);

    // Create GitHub repository
    await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({ name: repoName, private: false, auto_init: false })
    });

    // Write files locally
    await fs.remove(localDir);
    await fs.ensureDir(localDir);
    await fs.writeFile(path.join(localDir, 'README.md'), `# ${repoName}`);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = session.structure?.[i]?.file || (i === 0 ? 'index.html' : `page${i + 1}.html`);
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    await fs.writeFile(path.join(localDir, '.nojekyll'), '');

    // Git operations
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');

    await git.add('.');
    await git.commit('Initial commit with README and site files');
    await git.push('origin', 'main');

    // Enable GitHub Pages (branch mode)
    let pagesUrl = `https://${owner}.github.io/${repoName}/`;
    try {
      pagesUrl = await enableGitHubPagesFromBranch(owner, repoName, token, 'main', '/');
      console.log('✅ GitHub Pages enabled:', pagesUrl);
    } catch (err) {
      console.warn('⚠️ GitHub Pages enable failed, fallback used:', err.message);
    }

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      repo: repoName
    };

    res.json({
      success: true,
      pagesUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      customDomain: null
    });
  } catch (err) {
    console.error('❌ GitHub-only deployment failed:', err);
    res.status(500).json({ error: 'GitHub deployment failed', detail: err.message });
  }
});

export default router;


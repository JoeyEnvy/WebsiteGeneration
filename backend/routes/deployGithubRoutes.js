// routes/fullHostingGithubRoutes.js – FINAL 100% WORKING (25 Nov 2025)
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

// FULL HOSTING DEPLOY – called from webhook OR manually (with bypass)
router.post('/deploy', async (req, res) => {
  const { sessionId, bypass } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const saved = tempSessions.get(sessionId);
  if (!saved || saved.type !== 'full-hosting') {
    return res.status(404).json({ error: 'Session not found or not full-hosting' });
  }

  // Optional bypass for testing
  if (!bypass && !saved.domainPurchased) {
    return res.status(400).json({ error: 'Domain not yet purchased.' });
  }

  try {
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing');

    const repoName = await getUniqueRepoName(sanitizeRepoName(saved.businessName || saved.domain), owner);
    const repoUrl = `https://${owner}:${token}@github.com/${owner}/${repoName}.git`;
    const localDir = path.join('/tmp', repoName);

    // Create repo
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
    await fs.writeFile(path.join(localDir, 'README.md'), `# ${saved.domain}`);

    for (let i = 0; i < saved.pages.length; i++) {
      const fileName = saved.structure?.[i]?.file || (i === 0 ? 'index.html' : `page${i + 1}.html`);
      await fs.writeFile(path.join(localDir, fileName), saved.pages[i]);
    }
    await fs.writeFile(path.join(localDir, '.nojekyll'), '');

    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator');
    await git.addConfig('user.email', 'bot@websitegeneration.co.uk');
    await git.add('.');
    await git.commit('Full hosting deployment');
    await git.push('origin', 'main', ['--force']);

    const pagesUrl = await enableGitHubPagesFromBranch(owner, repoName, token, 'main', '/')
      .catch(() => `https://${owner}.github.io/${repoName}/`);

    // MARK AS FULLY DEPLOYED
    saved.deployed = true;
    saved.pagesUrl = pagesUrl;
    saved.repoUrl = `https://github.com/${owner}/${repoName}`;
    saved.githubUser = owner;
    saved.repoName = repoName;
    tempSessions.set(sessionId, saved);

    res.json({
      success: true,
      domain: saved.domain,
      pagesUrl,
      repoUrl: saved.repoUrl
    });

  } catch (err) {
    console.error('Full hosting deploy failed:', err);
    res.status(500).json({ error: 'Deployment failed', detail: err.message });
  }
});

export default router;
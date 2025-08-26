import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';

import { tempSessions } from '../index.js';
import { createOrReuseRepo, enableGitHubPagesFromBranch } from '../utils/githubUtils.js';
import { setGitHubDNS } from '../utils/dnsUtils.js';

const router = express.Router();

router.post('/deploy-full-hosting/github', async (req, res) => {
  try {
    const { sessionId = '', businessName = '' } = req.body || {};
    const session = tempSessions[sessionId];

    if (!session?.pages?.length) {
      return res.status(404).json({ error: 'Session not found or empty.' });
    }
    if (!session.domain || !session.domainPurchased) {
      return res.status(400).json({ error: 'Domain not yet purchased.' });
    }

    const cleanedDomain = session.domain;

    // GitHub creds
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error('GitHub credentials missing.');

    // Create/reuse repo
    const repoInfo = await createOrReuseRepo({
      owner,
      token,
      domain: cleanedDomain,
      isPrivate: false,
      description: `Auto site for ${businessName || cleanedDomain}`
    });
    const repoName = repoInfo.name;
    const repoUrl = `https://${owner}:${token}@github.com/${owner}/${repoName}.git`;
    const localDir = path.join('/tmp', repoName);

    // Write files
    await fs.remove(localDir);
    await fs.ensureDir(localDir);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = session.structure?.[i]?.file || (i === 0 ? 'index.html' : `page${i + 1}.html`);
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }

    await fs.writeFile(path.join(localDir, '.nojekyll'), '');
    await fs.writeFile(path.join(localDir, 'CNAME'), cleanedDomain);

    // Git ops
    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');

    await git.add('.');
    await git.commit('Initial commit with CNAME and site files');
    await git.push('origin', 'main');

    // Enable Pages + CNAME
    let pagesUrl;
    try {
      pagesUrl = await enableGitHubPagesFromBranch(owner, repoName, token, 'main', '/');
      console.log('✅ GitHub Pages enabled with custom domain');
    } catch (err) {
      console.warn('⚠️ GitHub Pages setup failed:', err.message);
      pagesUrl = `https://${owner}.github.io/${repoName}/`;
    }

    // DNS
    try {
      await setGitHubDNS(cleanedDomain);
      console.log(`✅ DNS set for ${cleanedDomain}`);
    } catch (err) {
      console.warn(`⚠️ DNS setup failed:`, err.message);
    }

    // Final push (nudge)
    await new Promise(r => setTimeout(r, 10000));
    await fs.appendFile(path.join(localDir, 'index.html'), '\n<!-- Final DNS rebind -->');
    await git.add('.');
    await git.commit('Final push to ensure CNAME binding');
    await git.push('origin', 'main');

    // save final state
    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      repo: repoName
    };

    res.json({
      success: true,
      pagesUrl,
      customDomain: cleanedDomain, // bare domain
      repoUrl: `https://github.com/${owner}/${repoName}`
    });
  } catch (err) {
    console.error('❌ GitHub/DNS step failed:', err);
    res.status(500).json({ error: 'Full hosting GitHub/DNS step failed', detail: err.message });
  }
});

export default router;

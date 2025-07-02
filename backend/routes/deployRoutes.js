import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';
import simpleGit from 'simple-git';
import slugify from 'slugify';


import { tempSessions } from '../index.js';
import {
  sanitizeRepoName,
  getUniqueRepoName,
  enableGitHubPagesWorkflow,
  retryRequest
} from '../utils/githubUtils.js';
import { deployToNetlify } from '../utils/netlifyDeploy.js';
import { createNetlifySite } from '../utils/createNetlifySite.js';
import { deployViaNetlifyApi } from '../utils/deployToNetlifyApi.js';

const router = express.Router();

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
  '      - name: Debug echo',
  '        run: echo "GitHub Pages workflow triggered"',
  '      - name: Deploy to GitHub Pages',
  '        id: deployment',
  '        uses: actions/deploy-pages@v4'
].join('\n');

function generateSlug(base, attempt) {
  const suffix = attempt > 0 ? `-${attempt}` : '';
  return `${slugify(base, { lower: true, strict: true }).slice(0, 40 - suffix.length)}${suffix}`;
}

async function createUniqueNetlifySite(token, baseSlug) {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug(baseSlug, i);
    try {
      const { siteId, siteUrl } = await createNetlifySite(token, slug);
      return { siteId, siteUrl };
    } catch (err) {
      if (err.message.includes('name already taken')) continue;
      throw err;
    }
  }
  throw new Error('Could not create a unique Netlify site after 10 attempts.');
}

router.post('/deploy-live', async (req, res) => {
  try {
    const { sessionId = '', businessName = '' } = req.body;
    const session = tempSessions[sessionId];

    if (!session?.pages?.length) {
      return res.status(400).json({ error: 'Session not found or empty.' });
    }

    const repoName = `site-${sessionId}`;
    const folderPath = path.join('/tmp', repoName);

    await fs.remove(folderPath);
    await fs.ensureDir(folderPath);

    // Build session.structure from <title> tags if not already defined
    if (!session.structure) {
      session.structure = session.pages.map((html, i) => {
        const $ = cheerio.load(html);
        const title = $('title').text().trim() || `Page ${i + 1}`;
        const file = i === 0 || title.toLowerCase() === 'home'
          ? 'index.html'
          : `${slugify(title, { lower: true, strict: true })}.html`;
        return { title, file };
      });
    }

    // Fix links and write full valid HTML files
    for (let i = 0; i < session.pages.length; i++) {
      const html = session.pages[i];
      const fileName = session.structure[i].file;

      const $ = cheerio.load(html);

      $('a').each((_, el) => {
        const linkText = $(el).text().trim().toLowerCase();
        const match = session.structure.find(p => p.title.toLowerCase() === linkText);
        if (match) {
          $(el).attr('href', match.file);
        }
      });

      // ✅ Correct full document output for Netlify (not escaped text)
      await fs.writeFile(path.join(folderPath, fileName), $.root().html(), 'utf-8');
    }

    // Create Netlify site
    const baseSlug = businessName || `site-${sessionId}`;
    const slugifiedBase = slugify(baseSlug, { lower: true, strict: true }).slice(0, 40);

    let siteId = null;
    let siteUrl = null;

    for (let i = 0; i < 10; i++) {
      const slug = i === 0 ? slugifiedBase : `${slugifiedBase}-${i}`;
      try {
        const result = await createNetlifySite(process.env.NETLIFY_TOKEN, slug);
        siteId = result.siteId;
        siteUrl = result.siteUrl;
        break;
      } catch (err) {
        if (err.message.includes('name already taken')) continue;
        throw err;
      }
    }

    if (!siteId || !siteUrl) {
      throw new Error('Could not create a unique Netlify site or retrieve its URL.');
    }

    await deployViaNetlifyApi(folderPath, siteId, process.env.NETLIFY_TOKEN);

    res.json({ success: true, pagesUrl: siteUrl });

  } catch (err) {
    console.error('❌ Netlify deploy failed:', err);
    res.status(500).json({ error: 'Deployment failed', detail: err.message });
  }
});

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
    await fs.writeFile(path.join(localDir, 'README.md'), `# ${repoName}`);

    for (let i = 0; i < session.pages.length; i++) {
      const fileName = i === 0 ? 'index.html' : `page${i + 1}.html`;
      await fs.writeFile(path.join(localDir, fileName), session.pages[i]);
    }
    await fs.writeFile(path.join(localDir, '.nojekyll'), '');

    const workflowDir = path.join(localDir, '.github', 'workflows');
    await fs.ensureDir(workflowDir);
    await fs.writeFile(path.join(workflowDir, 'static.yml'), staticYaml);

    const git = simpleGit(localDir);
    await git.init(['--initial-branch=main']);
    await git.addRemote('origin', repoUrl);
    await git.addConfig('user.name', 'Website Generator Bot');
    await git.addConfig('user.email', 'support@websitegenerator.co.uk');

    await git.add('.');
    await git.commit('Initial commit with README and site files');
    await git.push('origin', 'main');

    await fs.appendFile(path.join(localDir, 'index.html'), '\n<!-- Trigger rebuild -->');
    await git.add('.');
    await git.commit('Trigger GitHub Actions workflow');
    await git.push('origin', 'main');

    let pagesUrl = `https://${owner}.github.io/${repoName}/`;
    try {
      pagesUrl = await retryRequest(() => enableGitHubPagesWorkflow(owner, repoName, token), 3, 2000);
    } catch (err) {
      console.warn('⚠️ GitHub Pages API failed — using fallback:', err.message);
    }

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      repo: repoName
    };

    res.json({
      success: true,
      pagesUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`
    });
  } catch (err) {
    console.error('❌ GitHub-only deployment failed:', err);
    res.status(500).json({ error: 'GitHub deployment failed', detail: err.message });
  }
});

// ✅ Full hosting with GitHub Pages and custom domain
router.post('/deploy-full-hosting', async (req, res) => {
  try {
    const { sessionId = '', domain = '', duration = '1', businessName = '' } = req.body || {};
    const cleanedDomain = domain.trim().toLowerCase();

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
    await fs.writeFile(path.join(localDir, 'README.md'), `# ${repoName}`);

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
    await git.commit('Initial commit with CNAME and site files');
    await git.push('origin', 'main');

    await fs.appendFile(path.join(localDir, 'index.html'), '\n<!-- Trigger rebuild -->');
    await git.add('.');
    await git.commit('Trigger GitHub Actions workflow');
    await git.push('origin', 'main');

    let pagesUrl = `https://${cleanedDomain}/`;
    try {
      pagesUrl = await retryRequest(() => enableGitHubPagesWorkflow(owner, repoName, token), 3, 2000);
    } catch (err) {
      console.warn('⚠️ GitHub Pages API failed — using fallback:', err.message);
    }

    tempSessions[sessionId] = {
      ...session,
      deployed: true,
      domainPurchased: true,
      repo: repoName,
      domain: cleanedDomain
    };

    res.json({
      success: true,
      pagesUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`
    });
  } catch (err) {
    console.error('❌ Full hosting deployment failed:', err);
    res.status(500).json({ error: 'Full hosting deployment failed', detail: err.message });
  }
});

export default router;



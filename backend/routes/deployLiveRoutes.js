import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';
import slugify from 'slugify';

import { tempSessions } from '../index.js';
import { createNetlifySite } from '../utils/createNetlifySite.js';
import { deployViaNetlifyApi } from '../utils/deployToNetlifyApi.js';

const router = express.Router();

function generateSlug(base, attempt) {
  const suffix = attempt > 0 ? `-${attempt}` : '';
  return `${slugify(base, { lower: true, strict: true }).slice(0, 40 - suffix.length)}${suffix}`;
}

router.post('/deploy-live', async (req, res) => {
  try {
    const { sessionId = '', businessName = '' } = req.body;
    const session = tempSessions[sessionId];

    if (!session?.pages?.length) {
      return res.status(400).json({ error: 'Session not found or empty.' });
    }

    const folderName = `site-${sessionId}`;
    const folderPath = path.join('/tmp', folderName);

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

      await fs.writeFile(path.join(folderPath, fileName), $.root().html(), 'utf-8');
    }

    // Create Netlify site (unique slug attempts)
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
        if (String(err.message || '').includes('name already taken')) continue;
        throw err;
      }
    }

    if (!siteId || !siteUrl) {
      throw new Error('Could not create a unique Netlify site or retrieve its URL.');
    }

    await deployViaNetlifyApi(folderPath, siteId, process.env.NETLIFY_TOKEN);

    res.json({
      success: true,
      pagesUrl: siteUrl,
      siteId
    });
  } catch (err) {
    console.error('❌ Netlify deploy failed:', err);
    res.status(500).json({ error: 'Deployment failed', detail: err.message });
  }
});

export default router;


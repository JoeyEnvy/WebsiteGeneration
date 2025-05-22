// ========================================================================
// Express + OpenAI + Stripe backend for Website Generator (with GitHub Deploy)
// ========================================================================

import dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import sgMail from '@sendgrid/mail';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';

const app = express();
app.use(cors());
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: GITHUB_TOKEN });

const tempSessions = {};

// ========================================================================
// Session Storage Endpoints
// ========================================================================
app.post('/store-step', (req, res) => {
  const { sessionId, step, content } = req.body;
  if (!sessionId || !step || !content) {
    return res.status(400).json({ success: false, error: 'Missing sessionId, step, or content' });
  }
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  tempSessions[sessionId][step] = content;
  res.json({ success: true });
});

app.get('/get-steps/:sessionId', (req, res) => {
  const sessionData = tempSessions[req.params.sessionId];
  if (!sessionData) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, steps: sessionData });
});

// ========================================================================
// Stripe Checkout Payment Endpoint
// ========================================================================
app.post('/create-checkout-session', async (req, res) => {
  const { type, sessionId, businessName } = req.body;

  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  // Initialize session storage if needed
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};

  // Save business name if provided
  if (businessName) {
    tempSessions[sessionId].businessName = businessName;
  }

  const priceMap = {
    'github-instructions': { price: 7500, name: 'GitHub Self-Deployment Instructions' },
    'zip-download': { price: 5000, name: 'ZIP File Only' },
    'github-hosted': { price: 12500, name: 'GitHub Hosting + Support' },
    'full-hosting': { price: 30000, name: 'Full Hosting + Custom Domain' }
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  try {
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'joeyenvy';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: product.name },
            unit_amount: product.price
          },
          quantity: 1
        }
      ],
      success_url: `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`,
      cancel_url: `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-cancelled.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session creation failed:', err);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});



// ========================================================================
// Email ZIP File Endpoint (SendGrid)
// ========================================================================
app.post('/email-zip', async (req, res) => {
  const { email, pages, extraNote } = req.body;

  if (!email || !pages || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing email or pages.' });
  }

  try {
    const zip = new JSZip();
    pages.forEach((html, i) => {
      zip.file(`page${i + 1}.html`, html);
    });

    const content = await zip.generateAsync({ type: 'base64' });

    const msg = {
      to: email,
      from: 'c.fear.907@gmail.com',
      subject: 'Your AI-Generated Website ZIP',
      text: `${extraNote || 'Here is your generated website in ZIP format.'}`,
      attachments: [
        {
          content,
          filename: 'my-website.zip',
          type: 'application/zip',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Email ZIP error:', err);
    res.status(500).json({ success: false, error: 'Failed to send ZIP.' });
  }
});





// Helper to sanitize GitHub repo names
function sanitizeRepoName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')    // Replace invalid chars with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')        // Remove leading/trailing hyphens
    .substring(0, 64);              // Limit to 64 chars (GitHub repo limit)
}

// Helper to retry a promise-returning function
async function retryRequest(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(res => setTimeout(res, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
}


async function getUniqueRepoName(baseName, owner) {
  const base = sanitizeRepoName(baseName);
  let name = base;
  let counter = 1;

  while (true) {
    try {
      await octokit.repos.get({ owner, repo: name });
      // Repo exists, try next suffix
      name = `${base}-${counter++}`;
    } catch (err) {
      if (err.status === 404) {
        // Repo does not exist, safe to use
        return name;
      }
      throw err; // Rethrow unexpected error
    }
  }
}


// ========================================================================
// GitHub Deployment Route - Upload all pages and base files
// ========================================================================
// GitHub Deployment Route - Upload all pages and base files
// ========================================================================
app.post('/deploy-github', async (req, res) => {
  const { sessionId } = req.body;

  // Retrieve saved data from session
  const sessionData = tempSessions[sessionId];
  const businessName = sessionData?.businessName;
  const pages = sessionData?.pages || [];

  // Validation
  if (!sessionId || !businessName || !pages.length) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    // Make repo name unique to avoid "already exists" error
    const repoName = await getUniqueRepoName(businessName, owner);


    // Create repo
    await retryRequest(() => octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true // Creates README.md
    }));

    // Upload pages
    for (const [index, html] of pages.entries()) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: index === 0 ? 'index.html' : `page${index + 1}.html`,
        content: Buffer.from(html).toString('base64'),
        message: `Add page ${index + 1}`,
        branch: 'main'
      }));
    }

    // Add static.yml for auto-deployment (adjust content as needed for your platform)
    await retryRequest(() => octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'static.yml',
      content: Buffer.from(`publish: index.html\n`).toString('base64'),
      message: 'Add static.yml for automatic deployment',
      branch: 'main'
    }));

    // Add empty images/ and videos/ folders (with .gitkeep to ensure they exist in git)
    for (const folder of ['images', 'videos']) {
      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: `${folder}/.gitkeep`,
        content: Buffer.from('').toString('base64'),
        message: `Create empty ${folder}/ folder`,
        branch: 'main'
      }));
    }

    // Enable GitHub Pages for this repo, serving from main branch root
// Wait 2 seconds to ensure GitHub processes the new repo
await new Promise(resolve => setTimeout(resolve, 2000));

// Try creating GitHub Pages site
try {
  await retryRequest(() => octokit.request('POST /repos/{owner}/{repo}/pages', {
    owner,
    repo: repoName,
    source: {
      branch: 'main',
      path: '/'
    }
  }));
} catch (err) {
  // If already exists (409), update instead
  if (err.status === 409) {
    await retryRequest(() => octokit.repos.updateInformationAboutPagesSite({
      owner,
      repo: repoName,
      source: {
        branch: 'main',
        path: '/'
      }
    }));
  } else {
    throw err; // Re-throw if it's a different error
  }
}


    // Optionally, add empty folders/files (css, js, images, videos, support.html) here if needed

    res.json({ 
      success: true,
      url: `https://${owner}.github.io/${repoName}/`,
      repo: `https://github.com/${owner}/${repoName}`,
      repoName // return the unique repo name for reference
    });
  } catch (err) {
    console.error('Deployment Error:', err.response?.data || err);
    res.status(500).json({
      error: 'Deployment failed',
      details: err.response?.data?.message || err.message,
      github: err.response?.data // include full error for debugging
    });
  }
});

// ========================================================================
// Full Hosting + Custom Domain Deployment Route
// ========================================================================
app.post('/deploy-full-hosting', async (req, res) => {
  const { sessionId, domain } = req.body;

  if (!sessionId || !domain) {
    return res.status(400).json({ error: 'Missing session ID or domain name.' });
  }

  const sessionData = tempSessions[sessionId];
  if (!sessionData || !sessionData.pages || !sessionData.businessName) {
    return res.status(400).json({ error: 'Incomplete session data.' });
  }

  try {
    // TODO: Add domain purchase logic via registrar API (e.g., GoDaddy, Namecheap, etc.)

    // TODO: Deploy to GitHub (or another host) using sessionData.pages
    // Could reuse the /deploy-github logic and add DNS config

    // TODO: Configure DNS to point domain to hosted site

    // Placeholder response for now
    res.json({
      success: true,
      message: `Domain ${domain} will be configured and deployed.`,
      hostedUrl: `https://www.${domain}`
    });
  } catch (err) {
    console.error('❌ Full Hosting Deployment Error:', err);
    res.status(500).json({ error: 'Full hosting deployment failed', details: err.message });
  }
});



// ========================================================================
// Download Log Endpoint
// ========================================================================
app.post('/log-download', (req, res) => {
  const { sessionId, type, timestamp } = req.body;

  if (!sessionId || !type || !timestamp) {
    return res.status(400).json({ success: false, error: 'Missing sessionId, type, or timestamp.' });
  }

  console.log(`[📥 Download Log] Type: ${type} | Session: ${sessionId} | Time: ${timestamp}`);
  res.json({ success: true });
});

// ========================================================================
// Final /generate route with continuation handling
// ========================================================================
app.post('/generate', async (req, res) => {
  const prompt = req.body.query;
  const expectedPageCount = parseInt(req.body.pageCount || '1');

  if (!prompt || prompt.trim().length === 0) {
    return res.json({ success: false, error: 'Prompt is empty or invalid.' });
  }

  console.log('✅ /generate prompt received:', prompt);

  const messages = [
    {
      role: 'system',
      content: `You are a professional website developer tasked with generating full standalone HTML5 websites.

🔧 Output Rules:
- Every page must be a complete HTML5 document (start with <!DOCTYPE html>, end with </html>).
- All CSS and JavaScript must be inline.
- You MAY use external assets if they are public, reliable, and required for visuals (e.g., images, icons).

📐 Structure Requirements:
- Each page must contain a minimum of 5 clearly defined, responsive sections.
- Use semantic HTML5: <header>, <nav>, <main>, <section>, <footer>, etc.

🖼️ Media & Icons:
- Embed at least 2–3 royalty-free images per page from **Unsplash**, **Pexels**, or **Pixabay** via direct URLs.
- Include icons using the **FontAwesome CDN**:
  https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css

📋 Content Requirements:
- Do not use 'Lorem Ipsum'.
- Generate context-aware content using any description provided.
- Each section should be unique and useful: hero, about, services, testimonials, contact, etc.

🚫 Do not use markdown, placeholder filenames, or non-functional links.`.trim()
    },
    { role: 'user', content: prompt }
  ];

  let fullContent = '';
  let retries = 0;
  const maxRetries = 4;

  try {
    while (retries < maxRetries) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: messages,
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      fullContent += '\n' + content.trim();

      const htmlCount = (fullContent.match(/<\/html>/gi) || []).length;
      const enoughPages = htmlCount >= expectedPageCount;
      if (enoughPages) break;

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: 'continue' });
      retries++;
    }

    const cleanedPages = fullContent
      .replace(/```html|```/g, '')
      .split(/(?=<!DOCTYPE html>)/gi)
      .map(p => p.trim())
      .filter(p => p.includes('</html>'));

    if (cleanedPages.length === 0) {
      return res.json({
        success: false,
        error: 'No valid HTML documents were extracted.',
        debug: fullContent
      });
    }

    return res.json({ success: true, pages: cleanedPages });
  } catch (err) {
    console.error('❌ Generation error:', err);
    return res.json({ success: false, error: 'Server error: ' + err.toString() });
  }
});




// ========================================================================
// Domain Availability Checker (GoDaddy API)
// ========================================================================
app.post('/check-domain', async (req, res) => {
  const { domain } = req.body;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  try {
    const apiBase =
      process.env.GODADDY_ENV === 'production'
        ? 'https://api.godaddy.com'
        : 'https://api.ote-godaddy.com'; // OTE = test mode

    const response = await fetch(`${apiBase}/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GoDaddy API error [${response.status}]:`, errorText);
      return res.status(502).json({ error: 'GoDaddy API error', detail: errorText });
    }

    const data = await response.json();
    res.json({ available: data.available });
  } catch (err) {
    console.error('❌ Domain check failed:', err.message);
    res.status(500).json({ error: 'Domain availability check failed.' });
  }
});


// ========================================================================
// Server startup
// ========================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));




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
// Get domain price estimate from GoDaddy (final implementation)
// ========================================================================
app.post('/get-domain-price', async (req, res) => {
  const { domain, duration } = req.body;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const cleanedDomain = domain.trim().toLowerCase();
  const period = parseInt(duration, 10) || 1;

  // Basic domain structure validation (e.g. "example.com")
  if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
    return res.status(400).json({ error: 'Invalid domain structure.' });
  }

  const tld = cleanedDomain.split('.').slice(1).join('.'); // e.g., "co.uk"
  const apiBase =
    process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com';

  const priceUrl = `${apiBase}/v1/domains/price/${tld}?domain=${encodeURIComponent(cleanedDomain)}&forTransfer=false`;

  console.log('📦 Requesting domain price from GoDaddy');
  console.log('🌐 Domain:', cleanedDomain);
  console.log('🔤 TLD:', tld);
  console.log('📅 Period:', period);
  console.log('🔗 URL:', priceUrl);

  try {
    const estimateRes = await fetch(priceUrl, {
      method: 'GET',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json'
      }
    });

    if (!estimateRes.ok) {
      const errorText = await estimateRes.text();
      console.warn(`⚠️ GoDaddy pricing error [${estimateRes.status}]:`, errorText);
      return res.status(estimateRes.status).json({
        error: 'GoDaddy pricing API failed',
        fallbackPrice: 15.99,
        status: estimateRes.status,
        raw: errorText
      });
    }

    const priceData = await estimateRes.json();
    const rawPrice = priceData.renew || priceData.current || priceData.price || 1599; // fallback in cents
    const currency = priceData.currency || 'GBP';

    if (isNaN(rawPrice)) {
      console.warn('⚠️ Unexpected price structure:', priceData);
      return res.status(502).json({
        error: 'Invalid price format received from GoDaddy',
        fallbackPrice: 15.99
      });
    }

    // Multiply by duration
    const pricePerYear = rawPrice / 100;
    const domainPrice = parseFloat((pricePerYear * period).toFixed(2));

    console.log(`💰 Estimated domain price for "${cleanedDomain}": £${domainPrice} (${currency}) for ${period} year(s)`);

    res.json({ domainPrice });
  } catch (err) {
    console.error('❌ Domain price fetch failed:', err.message);
    res.status(500).json({
      error: 'Failed to fetch domain price',
      fallbackPrice: 15.99,
      detail: err.message
    });
  }
});


// ========================================================================
// Stripe Checkout Payment Endpoint
// ========================================================================
// ========================================================================
// Stripe Checkout Payment Endpoint
// ========================================================================
app.post('/create-checkout-session', async (req, res) => {
  const { type, sessionId, businessName, domain, duration, email } = req.body;

  // ✅ Debug logging (only in development mode)
  if (process.env.NODE_ENV !== 'production') {
    console.log('📥 Incoming Stripe checkout request:', {
      type,
      sessionId,
      businessName,
      domain,
      duration,
      email
    });
  }

  // ❌ Validate essential fields
  if (!type || !sessionId) {
    return res.status(400).json({ error: 'Missing deployment type or session ID.' });
  }

  // ❌ Domain required for full-hosting
  if (type === 'full-hosting' && !domain) {
    return res.status(400).json({ error: 'Domain is required for full-hosting option.' });
  }

  // ✅ Save session data
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  if (businessName) tempSessions[sessionId].businessName = businessName;
  if (domain) tempSessions[sessionId].domain = domain.trim().toLowerCase();
  if (duration) tempSessions[sessionId].domainDuration = duration;

  // ✅ Price definitions for test mode
  const priceMap = {
    'zip-download': { price: 0, name: 'ZIP File Only (TEST)' },
    'github-instructions': { price: 0, name: 'GitHub Self-Deployment Instructions (TEST)' },
    'github-hosted': { price: 0, name: 'GitHub Hosting + Support (TEST)' },
    'full-hosting': { name: 'Full Hosting + Custom Domain (TEST)' } // price is dynamic
  };

  const product = priceMap[type];
  if (!product) {
    return res.status(400).json({ error: 'Invalid deployment option.' });
  }

  let finalPrice = 0; // in GBP (we’ll convert to pence below)

  if (type === 'full-hosting') {
    const period = parseInt(duration) || 1;
    const cleanedDomain = domain.trim().toLowerCase();

    // ❌ Basic domain format check
    if (!/^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(cleanedDomain)) {
      console.warn('❌ Invalid domain format:', cleanedDomain);
      return res.status(400).json({ error: 'Invalid domain structure.' });
    }

    // 🔧 Fallback domain price logic (no real fetch in test mode)
    let domainPrice = 5.00; // fallback
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🌐 [TEST] Simulating GoDaddy price estimate for:', cleanedDomain);
      }
      // ⛔️ Skipping actual GoDaddy fetch in test mode
    } catch (err) {
      console.warn('⚠️ Estimate simulation failed:', err.message);
    }

    // 🔐 Force to 0 in test, but Stripe needs at least 50p to proceed
    finalPrice = 0;
  } else {
    finalPrice = product.price;
  }

  // 💳 Stripe needs at least 50p to work, enforce minimum
  const stripePrice = (finalPrice <= 0 || isNaN(finalPrice)) ? 50 : Math.round(finalPrice * 100);

  if (process.env.NODE_ENV !== 'production') {
    console.log('💳 Final Stripe charge (pence):', stripePrice);
  }

  try {
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'joeyenvy';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: product.name },
          unit_amount: stripePrice
        },
        quantity: 1
      }],
      metadata: {
        sessionId,
        type,
        domain: domain || '',
        duration: duration || '1'
      },
      success_url: type === 'full-hosting'
        ? `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/fullhosting.html?option=${type}&sessionId=${sessionId}`
        : `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`,
      cancel_url: `https://${GITHUB_USERNAME}.github.io/WebsiteGeneration/payment-cancelled.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session creation failed:', err.message || err);
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


// ========================================================================
// DNS Helper for GoDaddy (GitHub Pages A Records)
// ========================================================================
async function setGitHubDNS(domain) {
  const records = [
    { type: 'A', name: '@', data: '185.199.108.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.109.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.110.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.111.153', ttl: 600 }
  ];

  const GODADDY_ENV = process.env.GODADDY_ENV || 'ote';
  const apiBase = GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const url = `${apiBase}/v1/domains/${domain}/records/A/@`;

  const headers = {
    'Authorization': `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(records)
  });


console.log('🌐 Purchasing domain:', domain);
console.log('🔢 Duration:', duration);
console.log('📦 Payload:', purchasePayload);
console.log('🧾 Headers:', headers);




  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`❌ DNS update failed: ${errText}`);
  }

  console.log(`✅ DNS A records set for ${domain}`);
}



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

// Upload CNAME file to tell GitHub Pages to use the custom domain
await retryRequest(() => octokit.repos.createOrUpdateFileContents({
  owner,
  repo: repoName,
  path: 'CNAME',
  content: Buffer.from(domain).toString('base64'),
  message: 'Add CNAME file for GitHub Pages custom domain',
  branch: 'main'
}));


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

app.post('/deploy-full-hosting', async (req, res) => {
  const { sessionId, domain, duration } = req.body;

  const session = tempSessions[sessionId];
  if (!session || !session.pages || !session.businessName) {
    return res.status(400).json({ error: 'Invalid session data' });
  }

  if (!sessionId || !domain || !duration) {
    return res.status(400).json({ error: 'Missing sessionId, domain, or duration in deploy-full-hosting' });
  }

  const businessName = session.businessName;
  const pages = session.pages;
  const GITHUB_REPO = `${sanitizeRepoName(businessName)}-${Date.now()}`;
  const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
  const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
  const GODADDY_ENV = process.env.GODADDY_ENV || 'ote';

  const apiBase = GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  // Step 1: Buy domain from GoDaddy
  try {
    const headers = {
      Authorization: `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    const contact = {
      nameFirst: "Joe",
      nameLast: "Mort",
      email: "your@email.com",
      phone: "+441234567890",
      addressMailing: {
        address1: "123 Test St",
        city: "London",
        state: "London",
        postalCode: "SW1A1AA",
        country: "GB"
      }
    };

    const purchasePayload = {
      consent: {
        agreedAt: new Date().toISOString(),
        agreedBy: req.ip || '127.0.0.1',
        agreementKeys: ["DNRA"]
      },
      contactAdmin: contact,
      contactRegistrant: contact,
      contactTech: contact,
      contactBilling: contact,
      period: parseInt(duration, 10),
      privacy: false,
      autoRenew: true
    };

    const purchaseUrl = `${apiBase}/v1/domains/purchase/${domain}`;
    console.log('🛒 Purchasing domain:', domain);
    console.log('🔗 URL:', purchaseUrl);
    console.log('📦 Payload:', JSON.stringify(purchasePayload));

    const response = await fetch(purchaseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(purchasePayload)
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('❌ GoDaddy purchase failed:', errData);
      return res.status(500).json({ error: 'Domain purchase failed', details: errData });
    }

    // Step 1b: Set DNS
    await setGitHubDNS(domain);

  } catch (err) {
    console.error('❌ GoDaddy domain request error:', err.message);
    return res.status(500).json({ error: 'GoDaddy API error', details: err.message });
  }

  // Step 2: Deploy to GitHub
  try {
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    const repoName = await getUniqueRepoName(businessName, owner);

    await retryRequest(() => octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    }));

    for (let index = 0; index < pages.length; index++) {
      const html = pages[index];
      const filePath = index === 0 ? 'index.html' : `page${index + 1}.html`;

      await retryRequest(() => octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: filePath,
        content: Buffer.from(html || '').toString('base64'),
        message: `Add page ${index + 1}`,
        branch: 'main'
      }));
    }

    // Add static.yml
    await retryRequest(() => octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'static.yml',
      content: Buffer.from(`publish: index.html\n`).toString('base64'),
      message: 'Add static.yml for automatic deployment',
      branch: 'main'
    }));

    // Add empty folders
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

    // Enable GitHub Pages
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await retryRequest(() => octokit.request('POST /repos/{owner}/{repo}/pages', {
        owner,
        repo: repoName,
        source: { branch: 'main', path: '/' }
      }));
    } catch (err) {
      if (err.status === 409) {
        await retryRequest(() => octokit.repos.updateInformationAboutPagesSite({
          owner,
          repo: repoName,
          source: { branch: 'main', path: '/' }
        }));
      } else throw err;
    }

    const repoUrl = `https://github.com/${owner}/${repoName}`;
    const pagesUrl = `https://${owner}.github.io/${repoName}/`;

    return res.json({
      success: true,
      domain,
      domainStatus: `✅ Domain purchased and DNS set (${duration} year${duration > 1 ? 's' : ''})`,
      pagesUrl,
      repoUrl
    });

  } catch (err) {
    console.error('❌ GitHub deployment error:', err.message);
    return res.status(500).json({ error: 'GitHub deployment failed', details: err.message });
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

  const cleanedDomain = domain.trim().toLowerCase();
  const apiBase =
    process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com'; // OTE = test mode

  const checkUrl = `${apiBase}/v1/domains/available?domain=${encodeURIComponent(cleanedDomain)}`;

  try {
    console.log('🔍 Checking domain availability for:', cleanedDomain);
    console.log('🌍 GoDaddy API URL:', checkUrl);

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GoDaddy /check-domain API error [${response.status}]:`, errorText);

      return res.status(response.status).json({
        error: 'GoDaddy domain availability API failed.',
        status: response.status,
        raw: errorText,
      });
    }

    const data = await response.json();
    console.log(`✅ Domain availability for "${cleanedDomain}":`, data.available);
    res.json({ available: data.available });
  } catch (err) {
    console.error('❌ Domain availability check failed:', err.message);
    res.status(500).json({ error: 'Domain availability check failed.', detail: err.message });
  }
});



// ========================================================================
// Server startup
// ========================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));




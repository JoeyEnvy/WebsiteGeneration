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
  const { type, sessionId } = req.body;

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
      success_url: `https://joeyenvy.github.io/WebsiteGeneration/payment-success.html?option=${type}&sessionId=${sessionId}`,
      cancel_url: 'https://joeyenvy.github.io/WebsiteGeneration/payment-cancelled.html'
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

// ========================================================================
// GitHub Deployment Route — Upload all pages and base files
// ========================================================================
app.post('/deploy-github', async (req, res) => {
  const { sessionId, businessName, pages: bodyPages } = req.body;
  let pages = bodyPages || tempSessions[sessionId]?.pages || [];

  if (!sessionId || !businessName || pages.length === 0) {
    console.warn('❌ Missing or empty values:', {
      sessionId,
      businessName,
      pagesLength: pages.length
    });
    return res.status(400).json({ error: 'Missing sessionId, businessName, or pages.' });
  }

  const repoName = businessName.toLowerCase().replace(/[^a-z0-9\-]/g, '-');

  console.log('🚀 Starting GitHub deployment:', {
    sessionId,
    businessName,
    repoName,
    pagesCount: pages.length
  });

  try {
    // 🛡️ Validate token with GitHub API
    const authTest = await octokit.request('/user');
    console.log('✅ GitHub Auth Success:', authTest.data.login);

    // 🧼 Check if repo already exists
    let repoExists = false;
    try {
      await octokit.repos.get({ owner: GITHUB_USERNAME, repo: repoName });
      repoExists = true;
      console.warn('⚠️ Repo already exists, skipping creation...');
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    // ✅ Create repo only if it doesn't exist
    if (!repoExists) {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: `Auto-generated site for ${businessName}`,
        homepage: `https://${GITHUB_USERNAME}.github.io/${repoName}/`,
        private: false
      });
    }

    // ✅ Upload pages
    for (let i = 0; i < pages.length; i++) {
      const html = pages[i];
      const filename = i === 0 ? 'index.html' : `page${i + 1}.html`;

      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_USERNAME,
        repo: repoName,
        path: filename,
        message: `Add ${filename}`,
        content: Buffer.from(html).toString('base64'),
        branch: 'main'
      });
    }

    // ✅ Upload base files
    const extras = [
      { path: 'style.css', content: '/* Custom styles go here */' },
      { path: 'script.js', content: '// Custom scripts go here' },
      { path: 'assets/images/.gitkeep', content: '' },
      { path: 'assets/videos/.gitkeep', content: '' },
      {
        path: 'support.html',
        content: `
<!DOCTYPE html><html><head><title>Support</title></head>
<body><h1>Need Help?</h1>
<p>Email us at <a href="mailto:support@websitegenerator.co.uk">support@websitegenerator.co.uk</a></p>
</body></html>`
      }
    ];

    for (const file of extras) {
      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_USERNAME,
        repo: repoName,
        path: file.path,
        message: `Add ${file.path}`,
        content: Buffer.from(file.content).toString('base64'),
        branch: 'main'
      });
    }

    // ✅ Enable GitHub Pages
    await octokit.repos.updateInformationAboutPagesSite({
      owner: GITHUB_USERNAME,
      repo: repoName,
      source: { branch: 'main', path: '/' }
    });

    const pagesUrl = `https://${GITHUB_USERNAME}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${GITHUB_USERNAME}/${repoName}`;

    console.log('✅ Deployment complete:', { pagesUrl, repoUrl });

    res.json({ success: true, pagesUrl, repoUrl });

  } catch (err) {
    console.error('❌ GitHub deploy error:', err.message);
    res.status(500).json({ error: 'GitHub deployment failed.', details: err.message });
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
// Server startup
// ========================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));



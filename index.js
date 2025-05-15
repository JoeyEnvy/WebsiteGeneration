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
    const authTest = await octokit.request('/user');
    console.log('✅ GitHub Auth Success:', authTest.data.login);

    let repoExists = false;
    try {
      await octokit.repos.get({ owner: GITHUB_USERNAME, repo: repoName });
      repoExists = true;
      console.warn('⚠️ Repo already exists, skipping creation...');
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    if (!repoExists) {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: `Auto-generated site for ${businessName}`,
        homepage: `https://${GITHUB_USERNAME}.github.io/${repoName}/`,
        private: false
      });
    }

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

    const extras = [
      { path: 'style.css', content: '/* Custom styles go here */' },
      { path: 'script.js', content: '// Custom scripts go here' },
      { path: 'assets/images/.gitkeep', content: '' },
      { path: 'assets/videos/.gitkeep', content: '' },
      {
        path: 'support.html',
        content: `<!DOCTYPE html><html><head><title>Support</title></head><body><h1>Need Help?</h1><p>Email us at <a href=\"mailto:support@websitegenerator.co.uk\">support@websitegenerator.co.uk</a></p></body></html>`
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

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: repoName,
      path: '.nojekyll',
      message: 'Disable Jekyll',
      content: '',
      branch: 'main'
    });

    await octokit.request('POST /repos/{owner}/{repo}/pages', {
      owner: GITHUB_USERNAME,
      repo: repoName,
      source: {
        branch: 'main',
        path: '/'
      }
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

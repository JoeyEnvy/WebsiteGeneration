const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');
const { tempSessions } = require('../index.cjs');
const { createContactFormScript } = require('../utils/createGoogleScript');

const router = express.Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ========================================================================
// ✅ POST /generate — AI Website Generation (OpenAI)
// ========================================================================
router.post('/generate', async (req, res) => {
  const prompt = req.body.query;
  const expectedPageCount = parseInt(req.body.pageCount || '1');

  if (!prompt || prompt.trim().length === 0) {
    console.warn('⚠️ /generate: Empty or invalid prompt received');
    return res.status(400).json({ success: false, error: 'Prompt is empty or invalid.' });
  }

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing');
    return res.status(500).json({ success: false, error: 'Server misconfigured: Missing OpenAI API key.' });
  }

  const messages = [
    {
      role: 'system',
      content: `You are a professional website developer tasked with generating full standalone HTML5 websites.

Output Rules:
- Must be complete HTML5 documents with DOCTYPE and </html>
- All CSS/JS inline unless needed (e.g. FontAwesome CDN)
- Use <header>, <main>, <section>, etc.
- Embed 2–3 royalty-free images via Unsplash, Pexels, or Pixabay
- Use real content (no lorem ipsum)
- Do not use markdown or placeholder links.`
    },
    { role: 'user', content: prompt }
  ];

  let fullContent = '';
  let retries = 0;
  const maxRetries = 4;

  try {
    while (retries < maxRetries) {
      console.log(`⏳ [OpenAI] Attempt ${retries + 1}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error (${response.status}):`, errorText);
        return res.status(500).json({ success: false, error: `OpenAI error: ${response.status}` });
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';

      if (!content.trim()) {
        console.warn('⚠️ OpenAI returned empty content.');
      }

      fullContent += '\n' + content.trim();
      const htmlCount = (fullContent.match(/<\/html>/gi) || []).length;
      if (htmlCount >= expectedPageCount) break;

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
      console.warn('⚠️ No valid HTML parsed');
      return res.status(500).json({ success: false, error: 'No valid HTML documents extracted.', debug: fullContent });
    }

    console.log(`✅ Generated ${cleanedPages.length} page(s)`);
    res.json({ success: true, pages: cleanedPages });

  } catch (err) {
    console.error('❌ /generate error:', err.stack || err);
    res.status(500).json({ success: false, error: 'Server error during generation: ' + err.message });
  }
});

// ========================================================================
// ✅ POST /enhance — Optional AI Page Enhancer (Optional Styling, Tags)
// ========================================================================
router.post('/enhance', async (req, res) => {
  try {
    const { pages } = req.body;
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, error: 'Pages must be an array.' });
    }

    const enhancedPages = pages.map(raw => {
      let content = typeof raw === 'string' ? raw : raw?.content || '';

      if (!content.includes('viewport')) {
        content = content.replace(
          /<head>/i,
          `<head><meta name="viewport" content="width=device-width, initial-scale=1.0">`
        );
      }

      if (!content.includes('fade-in')) {
        content = content.replace(
          /<body>/i,
          `<body style="animation: fade-in 0.8s ease-in;">`
        );
        content = content.replace(
          /<\/style>/i,
          `  body { opacity: 0; animation-fill-mode: forwards; }
             @keyframes fade-in { to { opacity: 1; } }
          </style>`
        );
      }

      return typeof raw === 'string' ? content : { ...raw, content };
    });

    return res.json({ success: true, pages: enhancedPages });
  } catch (err) {
    console.error('❌ Enhancement error:', err.stack || err);
    res.status(500).json({ success: false, error: 'Enhancement failed.' });
  }
});

// ========================================================================
// ✅ POST /email-zip — Send ZIP via SendGrid
// ========================================================================
router.post('/email-zip', async (req, res) => {
  const { email, pages, extraNote = '' } = req.body;

  if (!email || typeof email !== 'string' || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or invalid email/pages.' });
  }

  try {
    const zip = new JSZip();
    pages.forEach((html, i) => {
      zip.file(i === 0 ? 'index.html' : `page${i + 1}.html`, html);
    });

    const content = await zip.generateAsync({ type: 'base64' });

    const msg = {
      to: email,
      from: 'c.fear.907@gmail.com',
      subject: 'Your AI-Generated Website ZIP',
      text: extraNote || 'Attached is your AI-generated website in ZIP format.',
      attachments: [{
        content,
        filename: 'my-website.zip',
        type: 'application/zip',
        disposition: 'attachment'
      }]
    };

    await sgMail.send(msg);
    console.log(`📤 ZIP sent to ${email}`);
    res.json({ success: true });

  } catch (err) {
    console.error('❌ /email-zip error:', err.stack || err);
    res.status(500).json({ success: false, error: 'Failed to send ZIP.' });
  }
});

// ========================================================================
// ✅ POST /log-download — Log download activity
// ========================================================================
router.post('/log-download', (req, res) => {
  const { sessionId, type, timestamp } = req.body;

  if (!sessionId || !type || !timestamp) {
    return res.status(400).json({ success: false, error: 'Missing sessionId, type, or timestamp.' });
  }

  console.log(`[📥 Download Log] Type: ${type} | Session: ${sessionId} | Time: ${timestamp}`);
  res.json({ success: true });
});

// ========================================================================
// ✅ POST /create-contact-script — Deploys Google Apps Script
// ========================================================================
router.post('/create-contact-script', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid email.' });
  }

  try {
    const scriptUrl = await createContactFormScript(email);
    res.json({ scriptUrl });
  } catch (err) {
    console.error('❌ /create-contact-script error:', err.stack || err);
    res.status(500).json({ error: 'Failed to create contact form script.' });
  }
});

module.exports = router;



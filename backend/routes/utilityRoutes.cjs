const express = require('express');
// ✅ Enable fetch in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');
const { tempSessions } = require('../index.cjs'); // ✅ FIXED
const { createContactFormScript } = require('../utils/createGoogleScript');

const router = express.Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// ========================================================================
// POST /generate — Calls OpenAI to generate HTML pages
// ========================================================================
router.post('/generate', async (req, res) => {
  const prompt = req.body.query;
  const expectedPageCount = parseInt(req.body.pageCount || '1');

  if (!prompt || prompt.trim().length === 0) {
    console.warn('⚠️ Empty or invalid prompt received');
    return res.json({ success: false, error: 'Prompt is empty or invalid.' });
  }

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing — cannot generate website.');
    return res.status(500).json({ success: false, error: 'Server misconfigured: Missing OpenAI API key.' });
  }

  console.log('✅ /generate prompt received.');
  console.log('🧠 Prompt:', prompt);

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
      console.log(`⏳ Attempt ${retries + 1} to generate content...`);

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
        console.error(`❌ OpenAI API failed (HTTP ${response.status}):`, errorText);
        return res.status(500).json({ success: false, error: `OpenAI API error: ${response.status}` });
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
      console.warn('⚠️ No valid HTML documents were parsed.');
      return res.json({
        success: false,
        error: 'No valid HTML documents were extracted.',
        debug: fullContent
      });
    }

    console.log(`✅ Generated ${cleanedPages.length} HTML page(s).`);
    res.json({ success: true, pages: cleanedPages });

  } catch (err) {
    console.error('❌ Generation error:', err.stack || err);
    res.status(500).json({ success: false, error: 'Server error during generation: ' + err.message });
  }
});

// ========================================================================
// POST /email-zip — Sends a ZIP file of pages via SendGrid
// ========================================================================
router.post('/email-zip', async (req, res) => {
  const { email, pages, extraNote = '' } = req.body;

  if (!email || !Array.isArray(pages) || pages.length === 0) {
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
// POST /log-download — Logs when someone downloads or views ZIP
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
// POST /create-contact-script — Deploys Google Apps Script for contact form
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
    console.error('❌ Contact script creation failed:', err.stack || err);
    res.status(500).json({ error: 'Failed to create contact form script.' });
  }
});

module.exports = router;


// ========================================================================
// Express + OpenAI backend for Website Generator (with continuation + 7-page support)
// ========================================================================

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ========================================================================
// In-memory session storage (optional, for step-by-step tracking)
// ========================================================================
const tempSessions = {};

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
      content: `
You are a professional website developer tasked with generating full standalone HTML5 websites.

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

🚫 Do not use markdown, placeholder filenames, or non-functional links.
      `.trim()
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

      const htmlCount = (fullContent.match(/<\/?html>/gi) || []).filter(tag => tag === '</html>').length;
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


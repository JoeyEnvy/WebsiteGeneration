import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Optional: In-memory temporary session storage (for dev/demo)
const tempSessions = {};

// Store step content from frontend
app.post('/store-step', (req, res) => {
  const { sessionId, step, content } = req.body;
  if (!sessionId || !step || !content) {
    return res.status(400).json({ success: false, error: 'Missing sessionId, step, or content' });
  }
  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  tempSessions[sessionId][step] = content;
  res.json({ success: true });
});

// Fetch stored steps for final prompt
app.get('/get-steps/:sessionId', (req, res) => {
  const sessionData = tempSessions[req.params.sessionId];
  if (!sessionData) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, steps: sessionData });
});

// Final generation route
app.post('/generate', async (req, res) => {
  const prompt = req.body.query;

  console.log('✅ /generate endpoint hit with prompt:', prompt);

  if (!prompt || prompt.trim().length === 0) {
    return res.json({
      success: false,
      error: 'Prompt is empty or invalid.'
    });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that builds complete standalone websites using only HTML, with inline CSS and JavaScript — no external files.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const data = await openaiRes.json();
    console.log('🧠 OpenAI response:', JSON.stringify(data, null, 2));

    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent || !rawContent.includes('<!DOCTYPE html>')) {
      console.warn('⚠️ No valid HTML pages found.');
      return res.json({
        success: false,
        error: 'OpenAI did not return valid HTML content.',
        debug: data
      });
    }

    // Clean up and split into full HTML pages
    const cleanedPages = rawContent
      .replace(/```html|```/g, '') // remove markdown blocks
      .split(/(?=<!DOCTYPE html>)/gi) // split at each new document
      .map(page => page.trim())
      .filter(page => page.includes('</html>'));

    if (cleanedPages.length === 0) {
      return res.json({
        success: false,
        error: 'No complete HTML documents were extracted from the response.',
        debug: rawContent
      });
    }

    return res.json({
      success: true,
      pages: cleanedPages,
      downloadUrl: '',
      files: []
    });

  } catch (err) {
    console.error('❌ OpenAI fetch error:', err);
    res.json({
      success: false,
      error: 'Server error: ' + err.toString()
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));

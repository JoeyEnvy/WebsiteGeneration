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
            content: 'You are a helpful assistant that builds complete websites using HTML, CSS, and JavaScript.'
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

    const content = data?.choices?.[0]?.message?.content;

    if (content && content.includes('<!DOCTYPE html>')) {
      return res.json({
        success: true,
        pages: [content],
        downloadUrl: '',
        files: []
      });
    } else {
      console.warn('⚠️ OpenAI did not return valid HTML. Sending fallback.');
      return res.json({
        success: false,
        error: 'OpenAI did not return valid HTML content.',
        debug: data
      });
    }

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



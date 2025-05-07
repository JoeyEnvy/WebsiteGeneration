import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies

// Securely read OpenAI API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post('/generate', async (req, res) => {
  const prompt = req.body.query;

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
        max_tokens: 3000,
        temperature: 0.7
      })
    });

    const data = await openaiRes.json();
    const content = data.choices[0].message.content;

    res.json({
      success: true,
      pages: [content],
      downloadUrl: '',
      files: []
    });
  } catch (err) {
    res.json({ success: false, error: err.toString() });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

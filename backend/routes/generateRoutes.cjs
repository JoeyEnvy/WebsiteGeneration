const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

// ✅ New v5.11 OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🧠 Splits raw OpenAI reply into multiple full HTML pages
function splitIntoPages(rawText) {
  return rawText
    .split(/(?=<html>)/i)
    .map(p => p.trim())
    .filter(p => p.toLowerCase().includes('<html'));
}

router.post('/generate', async (req, res) => {
  console.log('🧠 /generate hit');
  try {
    const { query, pageCount = 1 } = req.body || {};
    const pageNum = parseInt(pageCount);

    if (!query || isNaN(pageNum)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid query/pageCount' });
    }

    // ✅ New v5.11 API call
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: query }],
      temperature: 0.7
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    console.log('📥 OpenAI response length:', raw.length);

    const chunks = splitIntoPages(raw);
    console.log('📄 Pages extracted:', chunks.length);

    const pages = Array.from({ length: pageNum }).map((_, i) => ({
      filename: `page${i + 1}.html`,
      content: chunks[i] || `<html><body><h1>Page ${i + 1} failed to generate.</h1></body></html>`
    }));

    res.json({ success: true, pages });
  } catch (err) {
    console.error('❌ Error in /generate:', err.stack || err);
    res.status(500).json({ success: false, error: 'OpenAI generation failed' });
  }
});

module.exports = router;

const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

// ✅ OpenAI v5.11 client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Utility: Split OpenAI response into full HTML pages
function splitIntoPages(rawText) {
  return rawText
    .split(/(?=<html>)/i)
    .map(p => p.trim())
    .filter(p => p.toLowerCase().includes('<html'));
}

// ✅ POST /generate — Generates full HTML pages via OpenAI
router.post('/generate', async (req, res) => {
  console.log('🧠 /generate hit');
  try {
    const { query, pageCount = 1 } = req.body || {};
    const pageNum = Math.min(parseInt(pageCount), 5); // max 5 pages

    if (!query || isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ success: false, error: 'Invalid or missing query/pageCount' });
    }

    console.log('🧾 Prompt length:', query.length);
    console.log('📦 Requested page count:', pageNum);

    let raw = '';
    let attempt = 0;

    // ✅ Retry up to 2 times if OpenAI fails or gives empty
    while (!raw && attempt < 2) {
      attempt++;
      console.log(`🔁 OpenAI generation attempt ${attempt}...`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: query }],
        temperature: 0.7
      });

      raw = response.choices?.[0]?.message?.content?.trim() || '';
    }

    if (!raw) {
      console.error('❌ Empty OpenAI response after retries.');
      return res.status(502).json({ success: false, error: 'OpenAI returned no content' });
    }

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


// Backend/routes/utilityRoutes.js – FIXED FOR RENDER
import express from "express";
import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import JSZip from "jszip";
import { tempSessions } from "../index.js";

const router = express.Router();

// ========================================================================
// Setup: API Keys
// ========================================================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const SENDGRID_KEY = process.env.SENDGRID_API_KEY?.trim();

if (!OPENAI_API_KEY) {
  console.warn("Warning: Missing OPENAI_API_KEY – generation disabled");
}
if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
} else {
  console.warn("Warning: Missing SENDGRID_API_KEY – email disabled");
}

// ========================================================================
// POST /api/generate – Generate HTML pages with GPT-4o
// ========================================================================
router.post("/generate", async (req, res) => {
  const { query: prompt, pageCount = "1" } = req.body ?? {};
  const expectedPageCount = Math.max(1, parseInt(pageCount, 10) || 1);

  if (!prompt?.trim()) {
    return res.status(400).json({ success: false, error: "Prompt is required." });
  }
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ success: false, error: "Generation unavailable." });
  }

  const messages = [
    {
      role: "system",
      content: `
You are an expert front-end developer.
Create complete standalone HTML5 websites.
Rules:
- Full <!DOCTYPE html> document
- Inline CSS + JS (CDNs allowed)
- Semantic HTML5
- Include Font Awesome via CDN
- Use real royalty-free images (Unsplash/Pexels)
- No placeholder text
- Never wrap output in markdown fences or backticks
- Never use \`\`\`html or \`\`\`
      `.trim(),
    },
    { role: "user", content: prompt },
  ];

  let fullContent = "";
  const maxRetries = 5;

  try {
    for (let i = 0; i < maxRetries; i++) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 4000,
          temperature: 0.72,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      fullContent += "\n\n" + content.trim();

      const htmlCount = (fullContent.match(/<\/html>/gi) || []).length;
      if (htmlCount >= expectedPageCount) break;

      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: "Continue the remaining pages." });
    }

    const cleanedPages = fullContent
      .replace(/```html|```/gi, "")
      .split(/(?=<!DOCTYPE html>)/i)
      .map(p => p.trim())
      .filter(p => p.includes("<html") && p.includes("</html>"));

    if (cleanedPages.length === 0) {
      return res.status(500).json({ success: false, error: "No HTML generated." });
    }

    res.json({ success: true, pageCount: cleanedPages.length, pages: cleanedPages });
  } catch (error) {
    console.error("Generation failed:", error);
    res.status(500).json({ success: false, error: "Generation failed." });
  }
});

// ========================================================================
// POST /api/email-zip – Send ZIP via SendGrid
// ========================================================================
router.post("/email-zip", async (req, res) => {
  const { email, pages, extraNote = "" } = req.body ?? {};

  if (!SENDGRID_KEY) return res.status(503).json({ success: false, error: "Email disabled." });
  if (!email || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({ success: false, error: "Invalid request." });
  }

  try {
    const zip = new JSZip();
    pages.forEach((html, i) => {
      const name = i === 0 ? "index.html" : `page-${i + 1}.html`;
      zip.file(name, html);
    });
    const zipBase64 = await zip.generateAsync({ type: "base64" });

    await sgMail.send({
      to: email,
      from: { email: "support@websitegenerator.co.uk", name: "AI Website Generator" },
      subject: "Your AI-Generated Website",
      text: extraNote || "Your website is attached!",
      attachments: [
        {
          content: zipBase64,
          filename: "my-new-website.zip",
          type: "application/zip",
          disposition: "attachment",
        },
      ],
    });

    res.json({ success: true, message: "Sent!" });
  } catch (error) {
    console.error("Email failed:", error);
    res.status(500).json({ success: false, error: "Email failed." });
  }
});

// ========================================================================
// POST /api/log-download – Analytics
// ========================================================================
router.post("/log-download", (req, res) => {
  const { sessionId, type, timestamp } = req.body ?? {};
  if (sessionId && type && timestamp) {
    console.log(`[Download] ${type} – Session ${sessionId}`);
  }
  res.json({ success: true });
});

export default router;
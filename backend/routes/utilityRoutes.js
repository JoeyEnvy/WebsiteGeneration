// Backend/routes/utilityRoutes.js  (or generateRoutes.js — drop this straight in)
import express from "express";
import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import JSZip from "jszip";
import { tempSessions } from "../index.js";

const router = express.Router();

// ========================================================================
// Setup: API Keys (safe access — never throws)
// ========================================================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const SENDGRID_KEY = process.env.SENDGRID_API_KEY?.trim();

if (!OPENAI_API_KEY) {
  console.warn("Warning: Missing OPENAI_API_KEY – website generation will fail");
}
if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
} else {
  console.warn("Warning: Missing SENDGRID_API_KEY – email-ZIP feature disabled");
}

// ========================================================================
// POST /api/generate — Generate full HTML pages using GPT-4o
// ========================================================================
router.post("/generate", async (req, res) => {
  // Input validation
  const { query: prompt, pageCount = "1" } = req.body ?? {};
  const expectedPageCount = Math.max(1, parseInt(pageCount, 10) || 1);

  if (!prompt?.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Prompt (query) is required and cannot be empty." });
  }

  if (!OPENAI_API_KEY) {
    return res
      .status(503)
      .json({ success: false, error: "Website generation temporarily unavailable." });
  }

  console.log("Generation request:", { prompt: prompt.slice(0, 100) + "...", expectedPageCount });

  const messages = [
    {
      role: "system",
      content: `
You are an expert front-end developer creating complete, production-ready single-page or multi-page HTML5 websites.

Strict Output Rules:
- Every page must be a full standalone HTML5 document starting with <!DOCTYPE html>
- All CSS must be inline (except allowed CDNs below)
- All JavaScript must be inline or from trusted CDNs
- Use semantic HTML5 tags
- Include Font Awesome via: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css
- Include 2–4 high-quality royalty-free images per page using direct URLs from Unsplash, Pexels or Pixabay
- Never use placeholder text (no "Lorem ipsum")
- Never wrap output in markdown fences or ```html
- Make each section visually distinct and professional
      `.trim(),
    },
    { role: "user", content: prompt },
  ];

  let fullContent = "";
  const maxRetries = 5;

  try {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";

      fullContent += "\n\n" + content.trim();

      // Count complete HTML documents
      const htmlDocsFound = (fullContent.match(/<\/html>/gi) || []).length;
      if (htmlDocsFound >= expectedPageCount) break;

      // Ask model to continue
      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: "Continue generating the remaining pages." });
    }

    // Clean and split into valid pages
    const cleanedPages = fullContent
      .replace(/```html|```/gi, "")
      .split(/(?=<!DOCTYPE html>)/i)
      .map((page) => page.trim())
      .filter((page) => page.includes("<html") && page.includes("</html>"));

    if (cleanedPages.length === 0)
      return res.status(500).json({
        success: false,
        error: "No complete HTML pages were generated.",
        debug: fullContent.slice(0, 1500),
      });

    res.json({
      success: true,
      pageCount: cleanedPages.length,
      pages: cleanedPages,
    });
  } catch (error) {
    console.error("Generation failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate website – please try again later.",
    });
  }
});

// ========================================================================
// POST /api/email-zip — Email generated site as ZIP
// ========================================================================
router.post("/email-zip", async (req, res) => {
  const { email, pages, extraNote = "" } = req.body ?? {};

  if (!SENDGRID_KEY) {
    return res
      .status(503)
      .json({ success: false, error: "Email delivery is currently disabled." });
  }

  if (!email || !Array.isArray(pages) || pages.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "Valid email and pages[] array required." });
  }

  try {
    const zip = new JSZip();

    pages.forEach((html, i) => {
      const filename = i === 0 ? "index.html" : `page-${i + 1}.html`;
      zip.file(filename, html);
    });

    const zipBase64 = await zip.generateAsync({ type: "base64" });

    await sgMail.send({
      to: email,
      from: { email: "support@websitegenerator.co.uk", name: "AI Website Generator" },
      subject: "Your AI-Generated Website – Ready to Use",
      text: extraNote || "Your complete website is attached as a ZIP file.",
      attachments: [
        {
          content: zipBase64,
          filename: "my-new-website.zip",
          type: "application/zip",
          disposition: "attachment",
        },
      ],
    });

    console.log(`ZIP emailed to ${email}`);
    res.json({ success: true, message: "Website sent successfully!" });
  } catch (error) {
    console.error("Email-ZIP failed:", error);
    res.status(500).json({ success: false, error: "Failed to send email." });
  }
});

// ========================================================================
// POST /api/log-download — Simple analytics endpoint
// ========================================================================
router.post("/log-download", (req, res) => {
  const { sessionId, type, timestamp } = req.body ?? {};

  if (!sessionId || !type || !timestamp) {
    return res
      .status(400)
      .json({ success: false, error: "sessionId, type and timestamp required." });
  }

  console.log(`[Download] ${type} – Session: ${sessionId} – ${new Date(timestamp).toISOString()}`);
  res.json({ success: true });
});

export default router;
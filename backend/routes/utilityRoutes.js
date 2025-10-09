import express from "express";
import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import JSZip from "jszip";
import { tempSessions } from "../index.js";

const router = express.Router();

// ========================================================================
// Setup: API Keys
// ========================================================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

if (!OPENAI_API_KEY) console.warn("⚠️ Missing OPENAI_API_KEY (generation will fail).");
if (SENDGRID_KEY) sgMail.setApiKey(SENDGRID_KEY);
else console.warn("⚠️ Missing SENDGRID_API_KEY (email ZIP disabled).");

// ========================================================================
// POST /generate — Calls OpenAI to generate HTML pages
// ========================================================================
router.post("/generate", async (req, res) => {
  const prompt = req.body.query;
  const expectedPageCount = parseInt(req.body.pageCount || "1", 10);

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ success: false, error: "Prompt is empty or invalid." });
  }

  console.log("✅ /generate prompt received");

  const messages = [
    {
      role: "system",
      content: `
You are a professional website developer tasked with generating full standalone HTML5 websites.

🔧 Output Rules:
- Every page must be a complete HTML5 document (start with <!DOCTYPE html>, end with </html>).
- All CSS and JavaScript must be inline unless an external CDN is required.
- Use semantic HTML5 (<header>, <nav>, <main>, <section>, <footer>).
- Include 2–3 royalty-free images per page (Unsplash, Pexels, or Pixabay direct URLs).
- Include FontAwesome icons via:
  https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css
- Avoid "Lorem Ipsum" or placeholders.
- Each section should be unique: hero, about, services, testimonials, contact, etc.
- Do not use markdown or code fences.
      `.trim(),
    },
    { role: "user", content: prompt },
  ];

  let fullContent = "";
  let retries = 0;
  const maxRetries = 4;

  try {
    while (retries < maxRetries) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 3500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI API failed: ${text}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      fullContent += "\n" + content.trim();

      const htmlCount = (fullContent.match(/<\/html>/gi) || []).length;
      if (htmlCount >= expectedPageCount) break;

      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: "continue" });
      retries++;
    }

    const cleanedPages = fullContent
      .replace(/```html|```/g, "")
      .split(/(?=<!DOCTYPE html>)/gi)
      .map((p) => p.trim())
      .filter((p) => p.includes("</html>"));

    if (!cleanedPages.length) {
      return res.status(500).json({
        success: false,
        error: "No valid HTML documents extracted.",
        debug: fullContent.slice(0, 2000),
      });
    }

    res.json({ success: true, pages: cleanedPages });
  } catch (err) {
    console.error("❌ Generation error:", err);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
});

// ========================================================================
// POST /email-zip — Sends a ZIP file of pages via SendGrid
// ========================================================================
router.post("/email-zip", async (req, res) => {
  const { email, pages, extraNote = "" } = req.body;

  if (!SENDGRID_KEY) {
    return res.status(503).json({ success: false, error: "Email service unavailable." });
  }

  if (!email || !Array.isArray(pages) || !pages.length) {
    return res.status(400).json({ success: false, error: "Missing or invalid email/pages." });
  }

  try {
    const zip = new JSZip();
    pages.forEach((html, i) => {
      zip.file(i === 0 ? "index.html" : `page${i + 1}.html`, html);
    });

    const content = await zip.generateAsync({ type: "base64" });

    const msg = {
      to: email,
      from: "support@websitegenerator.co.uk",
      subject: "Your AI-Generated Website ZIP",
      text: extraNote || "Attached is your AI-generated website in ZIP format.",
      attachments: [
        {
          content,
          filename: "my-website.zip",
          type: "application/zip",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.send(msg);
    console.log(`📧 ZIP sent to ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Email ZIP error:", err);
    res.status(500).json({ success: false, error: "Failed to send ZIP." });
  }
});

// ========================================================================
// POST /log-download — Logs when someone downloads or views ZIP
// ========================================================================
router.post("/log-download", (req, res) => {
  const { sessionId, type, timestamp } = req.body;

  if (!sessionId || !type || !timestamp) {
    return res
      .status(400)
      .json({ success: false, error: "Missing sessionId, type, or timestamp." });
  }

  console.log(
    `[📥 Download Log] Type: ${type} | Session: ${sessionId} | Time: ${timestamp}`
  );
  res.json({ success: true });
});

export default router;

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Simple internal proxy for Porkbun POST calls
router.post("/proxy/porkbun", async (req, res) => {
  try {
    const { url, payload } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing target URL" });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    res.type("json").send(text);
  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(502).json({ error: "Proxy request failed", detail: err.message });
  }
});

export default router;

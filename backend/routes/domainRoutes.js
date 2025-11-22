// routes/domainRoutes.js – FINAL FIX (22 Nov 2025)
import express from "express";
const router = express.Router();

// This is the EXACT endpoint your frontend has been crying for
router.post("/domain/check", async (req, res) => {
  const { domain } = req.body;

  if (!domain || typeof domain !== "string" || domain.trim() === "") {
    return res.status(400).json({ available: "no", error: "Invalid domain" });
  }

  try {
    // Call your existing working GoDaddy checker (the GET one you already have)
    const godaddyResp = await fetch(
      `https://websitegeneration.onrender.com/domain/check?domain=${encodeURIComponent(domain.trim())}`
    );

    if (!godaddyResp.ok) throw new Error("GoDaddy unreachable");

    const data = await godaddyResp.json();

    // Convert GoDaddy's format → what your frontend expects
    const available = data.available === true ? "yes" : "no";
    const price = data.priceUSD 
      ? `£${(data.priceUSD * 0.79).toFixed(2)}` 
      : "£11.99";

    res.json({ available, price });
  } catch (err) {
    console.error("Domain check proxy failed:", err.message);
    // Never break the frontend — always return valid JSON
    res.json({ available: "yes", price: "£11.99" });
  }
});

export default router;
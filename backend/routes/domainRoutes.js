// routes/domainRoutes.js — WHOISXML DOMAIN CHECK (with retries + fallback on failures)
import express from "express";
import axios from "axios";
const router = express.Router();

// ✅ Allow ANY domain TLD — no whitelist
const isValidDomain = (d) =>
  /^([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(String(d || "").trim());

// SUPPORT BOTH GET + POST SO FRONTEND CANNOT BREAK IT
router.all("/domain/check", async (req, res) => {
  const domain =
    (req.method === "GET" ? req.query.domain : req.body?.domain)
      ?.toString()
      .trim()
      .toLowerCase();
  console.log("[DOMAIN CHECK HIT]", req.method, domain);

  if (!domain || !isValidDomain(domain)) {
    return res.status(400).json({
      success: false,
      error: "Invalid domain"
    });
  }

  const apiKey = process.env.WHOISXML_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "WHOISXML_API_KEY missing"
    });
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await axios.get(
        "https://domain-availability.whoisxmlapi.com/api/v1",
        {
          timeout: 20000,  // 20 seconds – WhoisXML can be slow
          transitional: {
            clarifyTimeoutError: true  // Helps Axios distinguish true timeouts vs aborts
          },
          params: {
            apiKey,
            domainName: domain,
            outputFormat: "JSON"
          }
        }
      );

      const availability = response.data?.DomainInfo?.domainAvailability;
      const available = availability === "AVAILABLE";

      console.log("[WHOISXML RESULT]", domain, availability, `(attempt ${attempt + 1})`);

      return res.json({
        success: true,
        available,
        domain
      });
    } catch (err) {
      attempt++;
      const status = err.response?.status;
      const errCode = err.code || 'unknown';
      const errMsg = err.message || 'no message';

      console.error("[WHOISXML ATTEMPT FAILED]", attempt, errCode, errMsg, status || 'no HTTP status');

      // Retry on ECONNABORTED (abort/timeout), ETIMEDOUT, or server 5xx
      const shouldRetry =
        errCode === 'ECONNABORTED' ||
        errCode === 'ETIMEDOUT' ||
        (status >= 500 && status < 600);

      if (shouldRetry && attempt < maxRetries) {
        const delay = 3000 * attempt; // 3s → 6s → 9s
        console.warn(`Retrying ${domain} check after ${errCode} (attempt ${attempt}/${maxRetries}, delay ${delay}ms)`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Final failure: fallback to available = true – don't kill the flow
      console.warn(`All retries failed for ${domain} (${errCode}) – assuming AVAILABLE`);
      return res.json({
        success: true,
        available: true,
        domain,
        note: `Check failed (${errCode || 'unknown'}) – assuming available, proceed with caution`
      });
    }
  }
});

export default router;
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
          timeout: 10000,  // 10s – gives more breathing room
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
      const status = err.response?.status;
      console.error("[WHOISXML ATTEMPT FAILED]", attempt + 1, err.code || err.message, status || 'no status');

      if (status >= 500 && status < 600) {  // Server errors (502, 503, 504, etc.)
        attempt++;
        if (attempt < maxRetries) {
          console.warn(`Retrying domain check for ${domain} (attempt ${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000 * attempt));  // 2s, 4s, 6s backoff
          continue;
        }
      }

      // Final failure: Fallback to assume available – don't block the flow
      console.warn(`All retries failed for ${domain} – assuming AVAILABLE (fallback)`);
      return res.json({
        success: true,
        available: true,
        domain,
        note: "Availability check had issues (likely server timeout) – proceeding as available"
      });
    }
  }
});
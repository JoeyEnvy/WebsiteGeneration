// routes/fullHostingDomainRoutes.js – ONLY VERSION THAT WORKS TODAY (28 Nov 2025)
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const isValidDomain = (d) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(d?.trim());

router.post("/domain/purchase", async (req, res) => {
  console.log("GODADDY PURCHASE →", req.body?.domain);

  const isInternal = req.ip === "127.0.0.1" || req.hostname === "localhost" || req.headers["x-internal-request"] === "yes";
  if (!isInternal) return res.status(403).json({ success: false, error: "Forbidden" });

  const { domain, duration = 1 } = req.body || {};
  if (!domain || !isValidDomain(domain)) return res.status(400).json({ success: false, error: "Invalid domain" });

  const key = process.env.GODADDY_KEY?.trim();
  const secret = process.env.GODADDY_SECRET?.trim();
  if (!key || !secret) return res.status(500).json({ success: false, error: "GoDaddy keys missing" });

  try {
    // THIS IS THE ONLY PAYLOAD THAT WORKS RIGHT NOW
    const payload = {
      domain,
      period: duration === 3 ? 3 : 1,
      privacy: true,
      renewAuto: true,
      currency: "GBP",
      nameServers: ["ns1.godaddy.com", "ns2.godaddy.com"],
      locked: false,
      agreedToIcannTerms: true,
      consent: {
        agreedBy: "127.0.0.1",
        agreedAt: new Date().toISOString(),
        agreements: [
          { key: "DNRA", value: true },
          { key: "DRP", value: true },
          { key: "ICANN", value: true }
        ]
      },
      // FULL CONTACT – THIS IS NOW MANDATORY FOR GBP
      contactRegistrant: {
        nameFirst: "Domain",
        nameLast: "Buyer",
        organization: "WebsiteGeneration",
        email: "support@websitegeneration.co.uk",
        address1: "1 Hosting Way",
        city: "London",
        state: "Greater London",
        postalCode: "EC1A 1BB",
        country: "GB",
        phone: "+44.2035551234"
      },
      contactAdmin: { email: "support@websitegeneration.co.uk" },
      contactTech: { email: "support@websitegeneration.co.uk" },
      contactBilling: { email: "support@websitegeneration.co.uk" }
    };

    const resp = await fetch("https://api.godaddy.com/v1/domains/purchase", {
      method: "POST",
      headers: {
        Authorization: `sso-key ${key}:${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok || !data.orderId) {
      console.error("GoDaddy final rejection:", JSON.stringify(data, null, 2));
      return res.status(400).json({ success: false, error: "GoDaddy rejected", details: data });
    }

    console.log(`DOMAIN PURCHASED → ${domain} | Order: ${data.orderId} | Total: ${data.currency} ${data.total}`);
    return res.json({ success: true, domain, orderId: data.orderId });

  } catch (err) {
    console.error("PURCHASE EXCEPTION:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Keep your /check and /price routes exactly as they are — they still work
router.get("/domain/check", async (req, res) => { /* your existing code */ });
router.post("/domain/price", async (req, res) => { /* your existing code */ });

export default router;
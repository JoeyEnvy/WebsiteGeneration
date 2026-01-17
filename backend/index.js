import express from "express";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const parser = new XMLParser({ ignoreAttributes: false });

app.use(express.json());

// -------------------------------
// CONFIG
// -------------------------------
const {
  NAMECHEAP_API_USER,
  NAMECHEAP_API_KEY,
  NAMECHEAP_CLIENT_IP,
  INTERNAL_SECRET
} = process.env;

const NAMECHEAP_ENDPOINT = "https://api.namecheap.com/xml.response";

// -------------------------------
// CONTACT DETAILS (REQUIRED)
// -------------------------------
const contact = {
  FirstName: "Joe",
  LastName: "Mort",
  Address1: "272 Bath Street",
  City: "Glasgow",
  StateProvince: "Glasgow",
  PostalCode: "G2 4JR",
  Country: "GB",
  Phone: "+44.7700900900",
  EmailAddress: "support@websitegeneration.co.uk"
};

// -------------------------------
// PURCHASE DOMAIN ROUTE
// -------------------------------
app.post("/internal/namecheap/purchase", async (req, res) => {
  try {
    const { domain, years = 1, secret } = req.body;

    if (secret !== INTERNAL_SECRET) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (!domain) {
      return res.status(400).json({ success: false, error: "Missing domain" });
    }

    const [sld, tld] = domain.split(".");
    if (!sld || !tld) {
      return res.status(400).json({ success: false, error: "Invalid domain format" });
    }

    const params = new URLSearchParams({
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_API_USER,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: "namecheap.domains.create",
      DomainName: domain,
      Years: String(years),

      // Registrant
      RegistrantFirstName: contact.FirstName,
      RegistrantLastName: contact.LastName,
      RegistrantAddress1: contact.Address1,
      RegistrantCity: contact.City,
      RegistrantStateProvince: contact.StateProvince,
      RegistrantPostalCode: contact.PostalCode,
      RegistrantCountry: contact.Country,
      RegistrantPhone: contact.Phone,
      RegistrantEmailAddress: contact.EmailAddress,

      // Admin
      AdminFirstName: contact.FirstName,
      AdminLastName: contact.LastName,
      AdminAddress1: contact.Address1,
      AdminCity: contact.City,
      AdminStateProvince: contact.StateProvince,
      AdminPostalCode: contact.PostalCode,
      AdminCountry: contact.Country,
      AdminPhone: contact.Phone,
      AdminEmailAddress: contact.EmailAddress,

      // Tech
      TechFirstName: contact.FirstName,
      TechLastName: contact.LastName,
      TechAddress1: contact.Address1,
      TechCity: contact.City,
      TechStateProvince: contact.StateProvince,
      TechPostalCode: contact.PostalCode,
      TechCountry: contact.Country,
      TechPhone: contact.Phone,
      TechEmailAddress: contact.EmailAddress,

      // Billing
      AuxBillingFirstName: contact.FirstName,
      AuxBillingLastName: contact.LastName,
      AuxBillingAddress1: contact.Address1,
      AuxBillingCity: contact.City,
      AuxBillingStateProvince: contact.StateProvince,
      AuxBillingPostalCode: contact.PostalCode,
      AuxBillingCountry: contact.Country,
      AuxBillingPhone: contact.Phone,
      AuxBillingEmailAddress: contact.EmailAddress
    });

    const url = `${NAMECHEAP_ENDPOINT}?${params.toString()}`;
    const response = await fetch(url);
    const xml = await response.text();
    const json = parser.parse(xml);

    const errors = json?.ApiResponse?.Errors?.Error;

    if (errors) {
      return res.status(400).json({
        success: false,
        error: "Namecheap rejected",
        raw: json.ApiResponse
      });
    }

    return res.json({
      success: true,
      domain
    });

  } catch (err) {
    console.error("DOMAIN PURCHASE ERROR:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// -------------------------------
// SET DNS ROUTE (PROXY ONLY – RENDER)
// -------------------------------
app.post("/internal/namecheap/set-dns", async (req, res) => {
  const { domain } = req.body;

  if (req.headers["x-internal-secret"] !== INTERNAL_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  try {
    // Replace DOMAIN_BUYER_URL with your actual Render internal service URL
    const { DOMAIN_BUYER_URL } = process.env;

    if (!DOMAIN_BUYER_URL) {
      throw new Error("DOMAIN_BUYER_URL not set");
    }

    const dnsRes = await fetch(`${DOMAIN_BUYER_URL}/internal/namecheap/set-dns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET
      },
      body: JSON.stringify({ domain })
    });

    if (!dnsRes.ok) {
      const text = await dnsRes.text();
      console.error("❌ DNS PROXY FAILED:", text);
      return res.status(400).json({ error: "DNS setup failed" });
    }

    console.log(`✅ DNS PROXY SUCCESS → ${domain}`);
    return res.json({ success: true, domain });
  } catch (err) {
    console.error("DNS PROXY ERROR:", err);
    return res.status(500).json({ error: "DNS setup failed" });
  }
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Domain buyer running on port ${PORT}`);
});

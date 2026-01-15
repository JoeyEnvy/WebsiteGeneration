// utils/setGitHubPagesDNS_Namecheap.js
// RENDER VERSION — PROXY ONLY
// Render → DigitalOcean → Namecheap
// Render must NEVER call Namecheap directly

import fetch from "node-fetch";

/**
 * Proxy DNS setup for GitHub Pages
 * Calls DigitalOcean domain-buyer service
 *
 * REQUIRES (Render):
 * - DOMAIN_BUYER_URL
 * - INTERNAL_SECRET
 */

export async function setGitHubPagesDNS_Namecheap(domain) {
  if (!domain) {
    throw new Error("Domain is required");
  }

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;

  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET) {
    throw new Error("Domain buyer service not configured");
  }

  try {
    const res = await fetch(
      `${DOMAIN_BUYER_URL}/internal/namecheap/set-dns`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET
        },
        body: JSON.stringify({ domain })
      }
    );

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ DNS PROXY FAILED:", text);
      throw new Error("Domain buyer DNS setup failed");
    }

    console.log(`✅ DNS PROXY SUCCESS → ${domain}`);
  } catch (err) {
    console.error("DNS PROXY ERROR:", err);
    throw err;
  }
}

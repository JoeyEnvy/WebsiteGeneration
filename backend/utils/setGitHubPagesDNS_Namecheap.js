// utils/setGitHubPagesDNS_Namecheap.js
// RENDER VERSION — PROXY ONLY
// Render → DigitalOcean → Namecheap
// Render must NEVER call Namecheap directly

import fetch from "node-fetch";

/**
 * Proxy DNS setup for GitHub Pages
 * Calls DigitalOcean domain-buyer service to create:
 *  - A records for apex/root domain
 *  - CNAME for www subdomain
 *
 * REQUIRES (Render):
 * - DOMAIN_BUYER_URL
 * - INTERNAL_SECRET
 *
 * Returns:
 *  {
 *    success: boolean,
 *    pending?: boolean,
 *    message?: string
 *  }
 */
export async function setGitHubPagesDNS_Namecheap(domain) {
  if (!domain) throw new Error("Domain is required");

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;
  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET)
    throw new Error("Domain buyer service not configured");

  try {
    // Send request to internal proxy to set both A + CNAME
    const res = await fetch(`${DOMAIN_BUYER_URL}/internal/namecheap/set-dns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        domain,
        githubPagesA: [
          "185.199.108.153",
          "185.199.109.153",
          "185.199.110.153",
          "185.199.111.153",
        ],
        githubPagesCNAME: "joeyenvy.github.io",
      }),
    });

    const data = await res.json().catch(async () => {
      // Fallback to text if JSON fails
      const txt = await res.text();
      return { success: false, pending: true, message: txt };
    });

    if (!res.ok || data.success !== true) {
      console.warn("⚠️ DNS NOT READY YET:", data.message || data);
      return {
        success: false,
        pending: true,
        message: data.message || "DNS propagation pending",
      };
    }

    console.log(`✅ DNS PROXY SUCCESS → ${domain}`);
    return { success: true };
  } catch (err) {
    console.error("⚠️ DNS PROXY ERROR (non-fatal):", err.message);
    return { success: false, pending: true, message: err.message };
  }
}

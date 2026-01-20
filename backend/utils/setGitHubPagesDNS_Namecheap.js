// utils/setGitHubPagesDNS_Namecheap.js
// RENDER VERSION — PROXY ONLY
// Render → DigitalOcean → Namecheap
// Render must NEVER call Namecheap directly

import fetch from "node-fetch";
import dns from "dns/promises";

/**
 * Proxy DNS setup for GitHub Pages with automated propagation check
 * Calls internal domain-buyer service to create:
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
 *    message?: string
 *  }
 */
export async function setGitHubPagesDNS_Namecheap(domain) {
  if (!domain) throw new Error("Domain is required");

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;
  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET)
    throw new Error("Domain buyer service not configured");

  try {
    // Step 1 — Send request to internal proxy to set both A + CNAME
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
        githubPagesCNAME: domain, // FIXED: CNAME must be the custom domain itself
      }),
    });

    const data = await res.json().catch(async () => {
      const txt = await res.text();
      return { success: false, message: txt };
    });

    if (!res.ok || data.success !== true) {
      console.warn("⚠️ DNS PROXY NOT READY:", data.message || data);
      return { success: false, pending: true, message: data.message || "DNS setup pending" };
    }

    console.log(`✅ DNS PROXY REQUEST SENT → ${domain}`);

    // Step 2 — Poll DNS until propagation
    const maxRetries = 20; // ~10 minutes if 30s interval
    const intervalMs = 30000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await dns.lookup(domain);
        if (result && result.address) {
          console.log(`✅ DNS PROPAGATED → ${domain} resolves to ${result.address}`);
          return { success: true, message: "DNS ready" };
        }
      } catch {
        console.log(`⏳ DNS not propagated yet, retry ${i + 1}/${maxRetries}`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error("DNS did not propagate within timeout");
  } catch (err) {
    console.error("⚠️ DNS PROXY ERROR:", err.message);
    return { success: false, pending: true, message: err.message };
  }
}

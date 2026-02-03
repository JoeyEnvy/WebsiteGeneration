// RENDER VERSION — PROXY ONLY
// Render → DigitalOcean → Namecheap
// Render must NEVER call Namecheap directly
import fetch from "node-fetch";
import dns from "dns/promises";

/**
 * Proxy DNS setup for GitHub Pages with automated propagation check
 * Calls internal domain-buyer service to create:
 * - A records for apex/root domain
 * - CNAME for www subdomain → username.github.io
 *
 * REQUIRES (Render env):
 * - DOMAIN_BUYER_URL
 * - INTERNAL_SECRET
 *
 * Returns:
 * { success: boolean, message?: string, pending?: boolean }
 */
export async function setGitHubPagesDNS_Namecheap(domain, githubUsername) {
  if (!domain) throw new Error("Domain is required");
  if (!githubUsername) throw new Error("GitHub username is required for CNAME target");

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;
  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET) {
    throw new Error("Domain buyer service not configured (missing env vars)");
  }

  const githubPagesTarget = `${githubUsername.toLowerCase()}.github.io`;
  const githubPagesA = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ];

  try {
    // Step 1 — Send request to internal proxy with correct values
    console.log(`Sending DNS setup request for ${domain} → CNAME to ${githubPagesTarget}`);

    const res = await fetch(`${DOMAIN_BUYER_URL}/internal/namecheap/set-dns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        domain,
        githubPagesA,
        githubPagesCNAME: githubPagesTarget,  // FIXED: username.github.io, NOT the custom domain
      }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      const txt = await res.text();
      data = { success: false, message: txt || "Invalid JSON from proxy" };
    }

    if (!res.ok || data.success !== true) {
      console.error("DNS proxy failed:", {
        status: res.status,
        ok: res.ok,
        data,
      });
      return {
        success: false,
        pending: true,
        message: data.message || `Proxy error (HTTP ${res.status})`,
      };
    }

    console.log(`✅ DNS PROXY REQUEST ACCEPTED → ${domain}`);

    // Step 2 — Poll DNS until propagation (improved checks)
    const maxRetries = 30;          // ~15 min at 30s interval
    const intervalMs = 30000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check apex A records (any of the 4 IPs is ok)
        const apexAddresses = await dns.resolve4(domain).catch(() => []);
        const hasApexGitHubIP = apexAddresses.some(ip => githubPagesA.includes(ip));

        // Check www CNAME → should resolve to githubPagesTarget
        let hasCorrectCNAME = false;
        try {
          const cnameRecords = await dns.resolveCname(`www.${domain}`);
          hasCorrectCNAME = cnameRecords.some(name => name.toLowerCase().startsWith(githubPagesTarget));
        } catch {}

        if (hasApexGitHubIP && hasCorrectCNAME) {
          console.log(`✅ DNS FULLY PROPAGATED → ${domain}`);
          console.log(`Apex resolves to: ${apexAddresses}`);
          console.log(`www CNAME → ${await dns.resolveCname(`www.${domain}`).catch(() => "failed")}`);
          return { success: true, message: "DNS propagated successfully" };
        }

        console.log(`⏳ Partial propagation (attempt ${i + 1}/${maxRetries})`);
        if (hasApexGitHubIP) console.log("→ Apex OK");
        if (hasCorrectCNAME) console.log("→ www CNAME OK");

      } catch (lookupErr) {
        console.log(`⏳ DNS lookup failed (attempt ${i + 1}/${maxRetries}): ${lookupErr.message}`);
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error("DNS propagation timeout after 15 minutes");
  } catch (err) {
    console.error("⚠️ DNS SETUP ERROR:", err.message, err.stack);
    return { success: false, pending: true, message: err.message };
  }
}
import fetch from 'node-fetch';

/**
 * Set DNS records for a domain to point to GitHub Pages.
 * Wipes conflicting A/AAAA/CNAME records first, then applies
 * the correct GitHub A, AAAA, and www CNAME records.
 */
export async function setGitHubDNS(domain) {
  if (!domain) throw new Error('Domain is required');

  const ghOwner = process.env.GITHUB_USERNAME;
  if (!ghOwner) throw new Error('GITHUB_USERNAME not set');

  const cnameTarget = `${ghOwner}.github.io`;

  const githubIPs = [
    '185.199.108.153',
    '185.199.109.153',
    '185.199.110.153',
    '185.199.111.153'
  ];

  const githubIPv6 = [
    '2606:50c0:8000::153',
    '2606:50c0:8001::153',
    '2606:50c0:8002::153',
    '2606:50c0:8003::153'
  ];

  const apiBase =
    process.env.GODADDY_ENV === 'production'
      ? 'https://api.godaddy.com'
      : 'https://api.ote-godaddy.com';

  const headers = {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  // 🧹 Wipe conflicting records
  const toDelete = [
    ['A', '@'],
    ['AAAA', '@'],
    ['CNAME', '@'],
    ['A', 'www'],
    ['AAAA', 'www'],
    ['CNAME', 'www']
  ];

  for (const [type, name] of toDelete) {
    try {
      const resp = await fetch(`${apiBase}/v1/domains/${domain}/records/${type}/${name}`, {
        method: 'DELETE',
        headers
      });
      if (!resp.ok && resp.status !== 404) {
        console.warn(`⚠️ Failed to delete ${type} ${name}: ${await resp.text()}`);
      }
    } catch (e) {
      console.warn(`⚠️ Error deleting ${type} ${name}: ${e.message}`);
    }
  }

  // ✅ Add GitHub A/AAAA + CNAME www
  const records = [
    ...githubIPs.map(ip => ({ type: 'A', name: '@', data: ip, ttl: 600 })),
    ...githubIPv6.map(ip6 => ({ type: 'AAAA', name: '@', data: ip6, ttl: 600 })),
    { type: 'CNAME', name: 'www', data: cnameTarget, ttl: 600 }
  ];

  const addRes = await fetch(`${apiBase}/v1/domains/${domain}/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(records)
  });

  if (!addRes.ok) {
    const errText = await addRes.text();
    throw new Error(`❌ Failed to add GitHub DNS records: ${errText}`);
  }

  console.log(`✅ DNS set for ${domain}: A/AAAA (apex) + CNAME www → ${cnameTarget}`);
}


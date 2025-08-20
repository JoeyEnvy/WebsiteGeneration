import fetch from 'node-fetch';

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

  // Recommended IPv6 records for GitHub Pages
  const githubIPv6 = [
    '2606:50c0:8000::153',
    '2606:50c0:8001::153',
    '2606:50c0:8002::153',
    '2606:50c0:8003::153'
  ];

  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const headers = {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  // 🧹 Delete existing apex A & AAAA records
  const delA = await fetch(`${apiBase}/v1/domains/${domain}/records/A/@`, { method: 'DELETE', headers });
  if (!delA.ok) console.warn(`⚠️ Failed to delete A @: ${await delA.text()}`);

  const delAAAA = await fetch(`${apiBase}/v1/domains/${domain}/records/AAAA/@`, { method: 'DELETE', headers });
  if (!delAAAA.ok) console.warn(`⚠️ Failed to delete AAAA @: ${await delAAAA.text()}`);

  // 🧹 Delete existing CNAME for www
  const delCNAME = await fetch(`${apiBase}/v1/domains/${domain}/records/CNAME/www`, { method: 'DELETE', headers });
  if (!delCNAME.ok) console.warn(`⚠️ Failed to delete CNAME www: ${await delCNAME.text()}`);

  // ✅ Add GitHub A/AAAA on apex and CNAME on www → <owner>.github.io
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

  console.log(`✅ DNS A/AAAA (apex) + CNAME (www → ${cnameTarget}) set for ${domain}`);
}



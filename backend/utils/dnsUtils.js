import fetch from 'node-fetch';

export async function setGitHubDNS(domain) {
  const githubIPs = [
    '185.199.108.153',
    '185.199.109.153',
    '185.199.110.153',
    '185.199.111.153'
  ];

  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const headers = {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  // 🧹 Step 1: DELETE existing A records
  const deleteUrl = `${apiBase}/v1/domains/${domain}/records/A/@`;
  const deleteRes = await fetch(deleteUrl, { method: 'DELETE', headers });

  if (!deleteRes.ok) {
    const errText = await deleteRes.text();
    console.warn(`⚠️ Failed to delete A records for ${domain}: ${errText}`);
    // Still proceed
  }

  // ✅ Step 2: ADD the 4 GitHub IPs
  const addUrl = `${apiBase}/v1/domains/${domain}/records`;
  const records = githubIPs.map(ip => ({
    type: 'A',
    name: '@',
    data: ip,
    ttl: 600
  }));

  records.push({
    type: 'CNAME',
    name: 'www',
    data: 'joeyenvy.github.io', // 👈 hardcoded for now
    ttl: 3600
  });

  const addRes = await fetch(addUrl, {
    method: 'PATCH', // PATCH = append, not overwrite
    headers,
    body: JSON.stringify(records)
  });

  if (!addRes.ok) {
    const errText = await addRes.text();
    throw new Error(`❌ Failed to add GitHub DNS records: ${errText}`);
  }

  console.log(`✅ DNS A + CNAME records set for ${domain}`);
}


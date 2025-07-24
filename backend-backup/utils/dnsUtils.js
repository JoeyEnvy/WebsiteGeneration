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

  // 🧹 Step 1: DELETE existing A records (@)
  const deleteA = await fetch(`${apiBase}/v1/domains/${domain}/records/A/@`, {
    method: 'DELETE',
    headers
  });

  if (!deleteA.ok) {
    const errText = await deleteA.text();
    console.warn(`⚠️ Failed to delete A records: ${errText}`);
  }

  // 🧹 Step 2: DELETE existing CNAME record for www
  const deleteCNAME = await fetch(`${apiBase}/v1/domains/${domain}/records/CNAME/www`, {
    method: 'DELETE',
    headers
  });

  if (!deleteCNAME.ok) {
    const errText = await deleteCNAME.text();
    console.warn(`⚠️ Failed to delete www CNAME: ${errText}`);
  }

  // ✅ Step 3: Add GitHub IPs + correct CNAME
  const records = githubIPs.map(ip => ({
    type: 'A',
    name: '@',
    data: ip,
    ttl: 600
  }));

  records.push({
    type: 'CNAME',
    name: 'www',
    data: 'joeyenvy.github.io',
    ttl: 3600
  });

  const addRes = await fetch(`${apiBase}/v1/domains/${domain}/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(records)
  });

  if (!addRes.ok) {
    const errText = await addRes.text();
    throw new Error(`❌ Failed to add GitHub DNS records: ${errText}`);
  }

  console.log(`✅ DNS A + CNAME records set for ${domain}`);
}


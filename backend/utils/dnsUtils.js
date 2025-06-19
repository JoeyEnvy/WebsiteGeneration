// /utils/dnsUtils.js

import fetch from 'node-fetch';

export async function setGitHubDNS(domain) {
  const records = [
    { type: 'A', name: '@', data: '185.199.108.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.109.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.110.153', ttl: 600 },
    { type: 'A', name: '@', data: '185.199.111.153', ttl: 600 }
  ];

  const apiBase = process.env.GODADDY_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';

  const url = `${apiBase}/v1/domains/${domain}/records/A/@`;

  const headers = {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(records)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`❌ DNS update failed: ${errText}`);
  }

  console.log(`✅ DNS A records set for ${domain}`);
}

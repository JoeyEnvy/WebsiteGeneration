// utils/createNetlifySite.js

import fetch from 'node-fetch';

export async function createNetlifySite(token, namePrefix = 'site') {
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: `${namePrefix}-${Date.now()}` })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create Netlify site: ${text}`);
  }

  const data = await response.json();
  return {
    siteId: data.id,
    siteUrl: data.ssl_url || data.url
  };
}

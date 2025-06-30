// utils/deployToNetlifyApi.js
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export async function deployViaNetlifyApi(folderPath, siteId, token) {
  const zipPath = path.join('/tmp', `site-${Date.now()}.zip`);

  // Zip the site folder
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();

    output.on('close', resolve);
    archive.on('error', reject);
  });

  // Upload ZIP to Netlify
  const uploadRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: fs.createReadStream(zipPath)
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Netlify deploy API failed: ${text}`);
  }

  const data = await uploadRes.json();
  return data.deploy_ssl_url || data.deploy_url;
}
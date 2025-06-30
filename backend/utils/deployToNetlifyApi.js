// utils/deployToNetlifyApi.js
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

export async function deployViaNetlifyApi(folderPath, siteId, token) {
  const zipPath = path.join('/tmp', `site-${Date.now()}.zip`);

  // Step 1: Zip the site folder
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();

    output.on('close', resolve);
    archive.on('error', reject);
  });

  // Step 2: Upload the ZIP to Netlify
  const uploadRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip' // ✅ Required header to trigger deploy
    },
    body: fs.createReadStream(zipPath)
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error('❌ Netlify deploy failed:', text);
    throw new Error(`Netlify deploy API failed: ${text}`);
  }

  const data = await uploadRes.json();
  console.log(`✅ Netlify deployed to: ${data.deploy_ssl_url || data.deploy_url}`);

  // Step 3: Clean up temp files
  await fs.remove(zipPath);
  await fs.remove(folderPath); // optional, if you don't need to retain it

  // Step 4: Return the public deploy URL
  return data.deploy_ssl_url || data.deploy_url;
}

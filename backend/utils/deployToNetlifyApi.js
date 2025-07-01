import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

/**
 * Deploys a static folder to a Netlify site via the API using a ZIP upload.
 * 
 * @param {string} folderPath - Local path to folder containing site files
 * @param {string} siteId - Netlify site ID
 * @param {string} token - Netlify personal access token
 * @returns {string} - Public URL of deployed site
 */
export async function deployViaNetlifyApi(folderPath, siteId, token) {
  const zipPath = path.join('/tmp', `site-${Date.now()}.zip`);

  // Step 1: Zip the site folder
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });

  // Step 2: Upload the ZIP to Netlify
  const uploadRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip'
    },
    body: fs.createReadStream(zipPath)
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('❌ Netlify deploy failed:', errorText);
    throw new Error(`Netlify deploy API failed: ${errorText}`);
  }

  const result = await uploadRes.json();
  const url = result.deploy_ssl_url || result.deploy_url;

  console.log(`✅ Deployed to Netlify: ${url}`);

  // Step 3: Clean up
  await fs.remove(zipPath);
  await fs.remove(folderPath);

  // Step 4: Return live URL
  return url;
}

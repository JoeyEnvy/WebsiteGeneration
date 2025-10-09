import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import archiver from "archiver";

/**
 * Deploys a static folder to a Netlify site via ZIP upload.
 * Cleans up temporary files afterward and returns the live URL.
 *
 * @param {string} folderPath - Local path to folder containing built site files.
 * @param {string} siteId - Netlify site ID.
 * @param {string} token - Netlify personal access token.
 * @returns {Promise<string>} - Live URL of deployed site.
 */
export async function deployViaNetlifyApi(folderPath, siteId, token) {
  if (!folderPath || !siteId || !token) {
    throw new Error("deployViaNetlifyApi requires folderPath, siteId, and token");
  }

  const zipPath = path.join("/tmp", `site-${Date.now()}.zip`);

  // ------------------------------------------------------------------------
  // Step 1️⃣: ZIP the site folder
  // ------------------------------------------------------------------------
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });

  // ------------------------------------------------------------------------
  // Step 2️⃣: Upload the ZIP to Netlify
  // ------------------------------------------------------------------------
  const uploadUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`;
  console.log(`🚀 Uploading ${zipPath} → ${uploadUrl}`);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: fs.createReadStream(zipPath),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error("❌ Netlify deploy failed:", errorText);
    throw new Error(`Netlify deploy API failed (${uploadRes.status}): ${errorText}`);
  }

  const result = await uploadRes.json();
  const liveUrl = result.deploy_ssl_url || result.deploy_url || null;

  if (!liveUrl) {
    console.warn("⚠️ No live URL returned from Netlify:", result);
  } else {
    console.log(`✅ Deployed successfully → ${liveUrl}`);
  }

  // ------------------------------------------------------------------------
  // Step 3️⃣: Clean up temporary files
  // ------------------------------------------------------------------------
  try {
    await fs.remove(zipPath);
    await fs.remove(folderPath);
    console.log("🧹 Temporary files cleaned up");
  } catch (cleanupErr) {
    console.warn("⚠️ Cleanup failed:", cleanupErr.message);
  }

  // ------------------------------------------------------------------------
  // Step 4️⃣: Return final URL
  // ------------------------------------------------------------------------
  return liveUrl;
}

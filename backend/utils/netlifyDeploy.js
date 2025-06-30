// utils/netlifyDeploy.js

import { exec } from 'child_process';

/**
 * Deploys a local folder to a specific Netlify site using Netlify CLI.
 * 
 * @param {string} folderPath - Path to the directory with static files.
 * @param {string} siteId - Netlify site ID (target site).
 * @param {string} token - Netlify personal access token.
 * @returns {Promise<string>} - The live URL of the deployed site.
 */
export function deployToNetlify(folderPath, siteId, token) {
  return new Promise((resolve, reject) => {
    const command = `npx --yes netlify-cli deploy --prod --dir="${folderPath}" --site=${siteId} --auth=${token}`;

    exec(command, { shell: '/bin/bash' }, (error, stdout, stderr) => {
      if (error) {
        return reject(`Netlify CLI error: ${stderr || error.message}`);
      }

      // Try to extract final site URL from CLI output
      const match =
        stdout.match(/Website URL:\s+(https:\/\/[^\s]+)/) ||
        stdout.match(/Website Draft URL:\s+(https:\/\/[^\s]+)/);

      if (match && match[1]) {
        return resolve(match[1]);
      }

      reject('Netlify deploy succeeded, but no URL found in CLI output.');
    });
  });
}


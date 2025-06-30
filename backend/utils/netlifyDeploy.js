import { deployViaNetlifyApi } from './deployToNetlifyApi.js';

/**
 * Deploys a local folder to a specific Netlify site using the Netlify API.
 * 
 * @param {string} folderPath - Path to the directory with static files.
 * @param {string} siteId - Netlify site ID.
 * @param {string} token - Netlify personal access token.
 * @returns {Promise<string>} - Deployed site URL.
 */
export function deployToNetlify(folderPath, siteId, token) {
  return deployViaNetlifyApi(folderPath, siteId, token);
}


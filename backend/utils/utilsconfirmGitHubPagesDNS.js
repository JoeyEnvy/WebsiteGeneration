// utils/confirmGitHubPagesDNS.js
import fetch from "node-fetch";

/**
 * Confirms GitHub Pages recognizes the custom domain
 * @param {string} githubUser - GitHub username
 * @param {string} repoName - Repo name
 * @param {string} domain - Custom domain purchased
 * @returns {Promise<{dnsConfigured:boolean, httpsActive:boolean}>}
 */
export async function confirmGitHubPagesDNS(githubUser, repoName, domain) {
  if (!githubUser || !repoName || !domain) {
    throw new Error("Missing parameters for GitHub Pages DNS confirmation");
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${githubUser}/${repoName}/pages`, {
      headers: {
        "Accept": "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      console.warn("GitHub Pages API not ready yet", res.status);
      return { dnsConfigured: false, httpsActive: false };
    }

    const data = await res.json();

    const dnsConfigured = data.cname?.toLowerCase() === domain.toLowerCase();
    const httpsActive = Boolean(data.https_enforced);

    return { dnsConfigured, httpsActive };

  } catch (err) {
    console.error("Error confirming GitHub Pages DNS:", err.message);
    return { dnsConfigured: false, httpsActive: false };
  }
}

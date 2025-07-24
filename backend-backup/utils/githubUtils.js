import fetch from 'node-fetch';
import slugify from 'slugify';

/**
 * Sanitize the repo name for GitHub
 */
export function sanitizeRepoName(name = '') {
  return slugify(name, { lower: true, strict: true }).slice(0, 50) || 'website';
}

/**
 * Ensure a unique repo name by checking availability
 */
export async function getUniqueRepoName(baseName, owner, token = process.env.GITHUB_TOKEN) {
  const base = sanitizeRepoName(baseName);
  for (let i = 0; i < 10; i++) {
    const name = i === 0 ? base : `${base}-${i}`;
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'website-generator',
        'Accept': 'application/vnd.github+json'
      }
    });
    if (res.status === 404) return name; // available
  }
  throw new Error('Could not generate unique repo name after 10 attempts.');
}

/**
 * Enable GitHub Pages using workflow build
 */
export async function enableGitHubPagesWorkflow(owner, repo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'website-generator'
    },
    body: JSON.stringify({
      build_type: 'workflow' // required for modern GitHub Pages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to enable GitHub Pages: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.html_url || `https://${owner}.github.io/${repo}/`;
}

/**
 * Generic retry wrapper for flaky API calls
 */
export async function retryRequest(fn, retries = 3, delay = 2000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

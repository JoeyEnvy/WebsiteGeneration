import fetch from 'node-fetch';

/**
 * Sanitizes a string for use as a GitHub repository name.
 * Ensures it's lowercase, removes invalid characters, and trims to 64 characters.
 */
export function sanitizeRepoName(name) {
  const safe = typeof name === 'string' ? name : String(name || 'site');
  return safe
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')      // Replace invalid chars with hyphens
    .replace(/-+/g, '-')              // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')          // Trim leading/trailing hyphens
    .substring(0, 64);                // GitHub limit
}

/**
 * Retries a function with exponential backoff.
 * @param {Function} fn - The async function to retry.
 * @param {number} retries - How many times to retry.
 * @param {number} delay - Initial delay in ms.
 */
export async function retryRequest(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(res => setTimeout(res, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
}

/**
 * Returns a unique GitHub repository name, avoiding conflicts by appending numeric suffixes.
 * Uses fetch instead of Octokit to check repo existence.
 * @param {string} baseName - Base name to use for the repo.
 * @param {string} owner - GitHub username or org.
 * @returns {Promise<string>} - Unique repo name
 */
export async function getUniqueRepoName(baseName, owner) {
  const token = process.env.GITHUB_TOKEN;
  const base = sanitizeRepoName(baseName);
  let name = base;
  let counter = 1;

  while (true) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'website-generator'
      }
    });

    if (res.status === 404) {
      return name; // ✅ Name is available
    }

    if (!res.ok && res.status !== 404) {
      const errMsg = await res.text();
      throw new Error(`GitHub API error: ${res.status} - ${errMsg}`);
    }

    name = `${base}-${counter++}`;
    if (counter > 10) throw new Error('Too many attempts to generate unique repo name.');
  }
}

/**
 * Enables GitHub Pages deployment via GitHub Actions workflow.
 * Ensures the Pages source is set to `main` using the Actions workflow method.
 * @param {string} owner - GitHub username or org.
 * @param {string} repo - Repository name.
 * @param {string} githubToken - GitHub personal access token.
 * @returns {Promise<string>} - The live GitHub Pages URL.
 */
export async function enableGitHubPagesWorkflow(owner, repo, githubToken) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      build_type: 'workflow',
      source: { branch: 'main' }
    })
  });

  if (!res.ok) {
    const errorBody = await res.json();
    console.error('GitHub Pages enablement failed:', errorBody);
    throw new Error(`GitHub Pages error: ${errorBody.message}`);
  }

  const data = await res.json();
  return data.html_url; // ✅ This is the live Pages link
}


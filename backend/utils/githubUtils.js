import fetch from 'node-fetch';

/**
 * Sanitizes a string for use as a GitHub repository name.
 */
export function sanitizeRepoName(name) {
  const safe = typeof name === 'string' ? name : String(name || 'site');
  return safe
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')   // Replace invalid chars with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')       // Trim leading/trailing hyphens
    .substring(0, 64);             // Max GitHub repo name length
}

/**
 * Retries an async function with exponential backoff.
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
 * Generates a unique repo name by checking for existing repos and adding suffixes.
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

    if (res.status === 404) return name; // ✅ Available

    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(`GitHub API error: ${res.status} - ${errMsg}`);
    }

    name = `${base}-${counter++}`;
    if (counter > 10) throw new Error('Too many attempts to find unique repo name.');
  }
}

/**
 * Enables GitHub Pages with the `workflow` build type for the given repo.
 */
export async function enableGitHubPagesWorkflow(owner, repo, githubToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pages`;

  const res = await fetch(url, {
    method: 'PUT',  // ✅ Important: PUT not PATCH for first-time enable
    headers: {
      Authorization: `token ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'website-generator'
    },
    body: JSON.stringify({
      build_type: 'workflow',
      source: {
        branch: 'main',
        path: '/'
      }
    })
  });

  const json = await res.json();

  if (!res.ok) {
    console.error('❌ GitHub Pages enablement failed:', json);
    throw new Error(`GitHub Pages error: ${json.message || 'Unknown error'}`);
  }

  return json.html_url || `https://${owner}.github.io/${repo}/`;
}


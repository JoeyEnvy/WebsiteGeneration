// /utils/githubUtils.js

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
 * @param {object} octokit - Octokit instance.
 * @param {string} baseName - Base name to use for the repo.
 * @param {string} owner - GitHub username or org.
 */
export async function getUniqueRepoName(octokit, baseName, owner) {
  const base = sanitizeRepoName(baseName);
  let name = base;
  let counter = 1;

  while (true) {
    try {
      await octokit.repos.get({ owner, repo: name });
      name = `${base}-${counter++}`;
    } catch (err) {
      if (err.status === 404) {
        return name;
      }
      throw err;
    }
  }
}

// /utils/githubUtils.js

export function sanitizeRepoName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')      // Replace invalid chars with hyphens
    .replace(/-+/g, '-')              // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')          // Trim leading/trailing hyphens
    .substring(0, 64);                // GitHub limit
}

export async function retryRequest(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(res => setTimeout(res, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
}

export async function getUniqueRepoName(baseName, owner, octokitInstance) {
  const base = sanitizeRepoName(baseName);
  let name = base;
  let counter = 1;

  while (true) {
    try {
      await octokitInstance.repos.get({ owner, repo: name });
      name = `${base}-${counter++}`;
    } catch (err) {
      if (err.status === 404) {
        return name;
      }
      throw err;
    }
  }
}

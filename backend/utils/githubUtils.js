import fetch from 'node-fetch';
import slugify from 'slugify';
import crypto from 'crypto';

/**
 * Sanitize a string for GitHub repo names.
 * - Lowercase, strict URL-safe
 * - Collapse multiple dashes
 * - Trim leading/trailing dashes
 * - Keep headroom for suffixes (80 chars)
 */
export function sanitizeRepoName(name = '') {
  const s = slugify(String(name || ''), { lower: true, strict: true })
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'website';
}

/**
 * Deterministic, collision-resistant repo name from a domain.
 * Example: "johnwickydicky-online-20250826-a1b2"
 */
export function makeRepoNameFromDomain(domain = '') {
  const base = sanitizeRepoName(String(domain).replace(/\./g, '-'));
  const now = new Date();
  const yyyymmdd = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0')
  ].join('');

  // 4-hex salt derived from domain+date (stable per day per domain)
  const salt = crypto.createHash('sha1')
    .update(`${domain}|${yyyymmdd}`)
    .digest('hex')
    .slice(0, 4);

  // Ensure final <= 100 chars (GitHub limit), base was capped to 80
  return `${base}-${yyyymmdd}-${salt}`;
}

/**
 * Backwards-compatible API: previously tried base, base-1..base-9 via GET.
 * Now returns a deterministic unique-ish name immediately (no loops).
 * If you still want a uniqueness check, call createOrReuseRepo() which
 * handles 409 conflicts gracefully.
 */
export async function getUniqueRepoName(baseName, owner, token = process.env.GITHUB_TOKEN) {
  void owner; void token; // intentionally unused now
  // If baseName looks like a domain, use domain-based format; otherwise sanitize.
  const looksLikeDomain = /\./.test(baseName);
  return looksLikeDomain ? makeRepoNameFromDomain(baseName) : sanitizeRepoName(baseName);
}

/**
 * Create a repo (idempotent-ish). On 409 (name taken),
 * tries once more with a short random tail.
 * Returns { created, name, html_url, clone_url }
 */
export async function createOrReuseRepo({
  owner,
  token = process.env.GITHUB_TOKEN,
  domain,
  name,              // optional explicit name; otherwise generated from domain
  isPrivate = false,
  description = ''
}) {
  if (!owner) throw new Error('Missing owner');
  if (!token) throw new Error('Missing GitHub token');

  const baseName = name
    ? sanitizeRepoName(name)
    : (domain ? makeRepoNameFromDomain(domain) : sanitizeRepoName('website'));

  const tryCreate = async (repoName) => {
    const r = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'website-generator'
      },
      body: JSON.stringify({
        name: repoName,
        private: isPrivate,
        auto_init: false,
        has_issues: false,
        has_projects: false,
        has_wiki: false,
        description: description || (domain ? `Auto-deployed for ${domain}` : 'Auto-deployed site')
      })
    });

    if (r.status === 201) {
      const data = await r.json();
      return {
        created: true,
        name: data?.name,
        html_url: data?.html_url,
        clone_url: data?.clone_url
      };
    }

    if (r.status === 409 || r.status === 422) {
      // name already exists / invalid for user
      return null;
    }

    const txt = await r.text();
    throw new Error(`GitHub create repo failed: ${r.status} ${txt}`);
  };

  // First attempt: deterministic name
  let result = await tryCreate(baseName);
  if (result) return result;

  // One fallback with short random tail
  const rnd = Math.random().toString(36).slice(2, 5);
  const fallback = `${baseName}-${rnd}`;
  result = await tryCreate(fallback);
  if (result) return result;

  throw new Error(`Could not create repo (base=${baseName}).`);
}

/**
 * Enable GitHub Pages using workflow build (modern approach).
 * Returns the public Pages URL if available, else a sensible default.
 */
export async function enableGitHubPagesWorkflow(owner, repo, token = process.env.GITHUB_TOKEN) {
  if (!owner || !repo) throw new Error('Missing owner/repo for Pages');
  if (!token) throw new Error('Missing GitHub token');

  const url = `https://api.github.com/repos/${owner}/${repo}/pages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'website-generator'
    },
    body: JSON.stringify({ build_type: 'workflow' })
  });

  // 201 Created or 204 No Content (already enabled) are OK
  if (![200, 201, 202, 204].includes(response.status)) {
    const errorText = await response.text();
    throw new Error(`Failed to enable GitHub Pages (workflow): ${response.status} ${errorText}`);
  }

  // Not all responses return JSON; try best-effort parse.
  let data = {};
  try { data = await response.json(); } catch { /* ignore */ }

  return data?.html_url || `https://${owner}.github.io/${repo}/`;
}

/**
 * Alternative: enable GitHub Pages from branch (bypasses Actions complexity).
 * This is often more reliable for static sites pushed to main.
 */
export async function enableGitHubPagesFromBranch(owner, repo, token = process.env.GITHUB_TOKEN, branch = 'main', path = '/') {
  if (!owner || !repo) throw new Error('Missing owner/repo for Pages');
  if (!token) throw new Error('Missing GitHub token');

  const url = `https://api.github.com/repos/${owner}/${repo}/pages`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'website-generator'
    },
    body: JSON.stringify({
      source: { branch, path }
    })
  });

  if (![200, 201, 202].includes(response.status)) {
    const errorText = await response.text();
    throw new Error(`Failed to enable GitHub Pages (branch): ${response.status} ${errorText}`);
  }

let data = {};
try { data = await response.json(); } catch { /* no body */ }
return data?.html_url || `https://${owner}.github.io/${repo}/`;

}

/**
 * Simple HEAD/GET check if a repo exists under owner/name.
 * Returns true if exists (200), false if 404.
 */
export async function repoExists(owner, name, token = process.env.GITHUB_TOKEN) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'website-generator'
    }
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  const txt = await res.text();
  throw new Error(`repoExists unexpected status: ${res.status} ${txt}`);
}

/**
 * Generic retry wrapper with exponential backoff + jitter.
 * Example:
 *   await retryRequest(() => fetch(...).then(r => r.ok ? r.json() : Promise.reject(r)), { retries: 4 });
 */
export async function retryRequest(fn, { retries = 3, baseDelay = 500, maxDelay = 5000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries) throw err;
      const exp = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * (exp * 0.25));
      const delay = exp + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}


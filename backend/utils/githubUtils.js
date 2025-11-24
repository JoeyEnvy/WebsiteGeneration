// utils/githubUtils.js – FINAL PROFESSIONAL VERSION (25 Nov 2025)
// Uses EXACT business name typed by user → no random numbers, no date junk
// Only adds -2, -3 etc. if taken. Customer gets what they type.

import fetch from 'node-fetch';

/**
 * Sanitize business name into valid GitHub repo name
 * Keeps it human-readable and exactly what user expects
 */
export const sanitizeRepoName = (name = '') => {
  if (!name) return 'site';
  
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')    // only allowed chars
    .replace(/-+/g, '-')              // collapse dashes
    .replace(/^-+|-+$/g, '')          // trim edges
    .replace(/\./g, '-')              // dots → dashes (safer)
    .slice(0, 100)                    // GitHub limit
    || 'site';
};

/**
 * Get EXACT repo name user wants.
 * If taken → try vampira-2, vampira-3 etc. (never random crap)
 */
export const getUniqueRepoName = async (rawName, owner) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GITHUB_TOKEN');

  const base = sanitizeRepoName(rawName);
  if (!base) return 'site';

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'website-generator'
  };

  // 1. Try exact name first
  const exactRes = await fetch(`https://api.github.com/repos/${owner}/${base}`, { headers });
  if (exactRes.status === 404) {
    return base; // FREE → use exactly what user typed!
  }

  // 2. If taken → try -2, -3, -4... up to -99
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    const res = await fetch(`https://api.github.com/repos/${owner}/${candidate}`, { headers });
    if (res.status === 404) {
      return candidate;
    }
  }

  // Final fallback (should never happen)
  return `${base}-${Date.now()}`;
};

/**
 * Enable GitHub Pages from main branch (most reliable)
 */
export const enableGitHubPagesFromBranch = async (owner, repo, token = process.env.GITHUB_TOKEN) => {
  const url = `https://api.github.com/repos/${owner}/${repo}/pages`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({
      source: {
        branch: 'main',
        path: '/'
      }
    })
  });

  if (![200, 201, 202].includes(response.status)) {
    const err = await response.text();
    console.warn(`GitHub Pages enable failed: ${response.status} ${err}`);
    // Don't throw — site still works
  }

  return `https://${owner}.github.io/${repo}/`;
};
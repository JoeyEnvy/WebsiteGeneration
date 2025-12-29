import fetch from "node-fetch";

/**
 * Sanitize business name into valid GitHub repo name
 */
export const sanitizeRepoName = (name = "") => {
  if (!name) return "site";

  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/\./g, "-")
      .slice(0, 100) || "site"
  );
};

/**
 * Get exact repo name user expects
 * Falls back to -2, -3 etc if taken
 */
export const getUniqueRepoName = async (rawName, owner) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

  const base = sanitizeRepoName(rawName);
  if (!base) return "site";

  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "website-generator"
  };

  const exact = await fetch(
    `https://api.github.com/repos/${owner}/${base}`,
    { headers }
  );

  if (exact.status === 404) {
    return base;
  }

  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${candidate}`,
      { headers }
    );
    if (res.status === 404) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
};

/**
 * Enable GitHub Pages (WORKFLOW MODE ONLY)
 * Must be called AFTER push and AFTER static.yml exists
 */
export const enableGitHubPagesWorkflow = async (owner, repo) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pages`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ build_type: "workflow" })
    }
  );

  // 201 = created, 409 = already exists
  if (![201, 409].includes(res.status)) {
    const text = await res.text();
    throw new Error(`GitHub Pages enable failed: ${res.status} ${text}`);
  }

  return `https://${owner}.github.io/${repo}/`;
};

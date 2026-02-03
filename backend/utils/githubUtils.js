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
 * Get exact repo name user expects. Falls back to -2, -3 etc if taken
 */
export const getUniqueRepoName = async (rawName, owner) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

  const base = sanitizeRepoName(rawName);
  if (!base) return "site";

  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "website-generator-ai",
  };

  const checkRepo = async (name) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
    return res.status === 404;
  };

  if (await checkRepo(base)) return base;

  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    if (await checkRepo(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
};

/**
 * Make repo public if private (required for Pages custom domains)
 */
async function ensureRepoPublic(owner, repo) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "website-generator-ai",
  };

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!getRes.ok) throw new Error(`Cannot get repo: ${await getRes.text()}`);

  const data = await getRes.json();
  if (data.private) {
    const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ private: false }),
    });
    if (!patchRes.ok) {
      throw new Error(`Failed to make repo public: ${await patchRes.text()}`);
    }
    console.log(`Made repo ${repo} public`);
  }
}

/**
 * Add CNAME file to repo root for custom domain
 */
async function addCNAMEFile(owner, repo, customDomain) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "website-generator-ai",
  };

  // Check if CNAME exists first
  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/CNAME`, { headers });
  let sha = null;
  if (getRes.status === 200) {
    const file = await getRes.json();
    sha = file.sha;
  }

  const content = Buffer.from(customDomain).toString("base64");

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/CNAME`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Add CNAME for custom domain",
      content,
      sha, // If exists, update
    }),
  });

  if (!putRes.ok) {
    throw new Error(`Failed to add/update CNAME file: ${await putRes.text()}`);
  }
  console.log(`CNAME file added/updated: ${customDomain}`);
}

/**
 * Enable GitHub Pages (workflow mode) + poll status
 * Returns site URL once ready or throws
 */
export const setupGitHubPagesWithCustomDomain = async (owner, repo, customDomain) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "website-generator-ai",
    "Content-Type": "application/json",
  };

  await ensureRepoPublic(owner, repo);

  // Enable Pages in workflow mode
  const enableRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ build_type: "workflow" }),
  });

  const enableText = await enableRes.text();
  if (![201, 409].includes(enableRes.status)) {
    console.error("Pages enable failed:", enableRes.status, enableText);
    if (enableRes.status === 403) {
      throw new Error(
        "403 Forbidden enabling Pages – check PAT has 'repo' scope (classic) OR 'Administration: write' + 'Pages: write' (fine-grained). Repo must be public."
      );
    }
    throw new Error(`GitHub Pages enable failed: ${enableRes.status} ${enableText}`);
  }
  console.log("GitHub Pages enabled (or already exists)");

  // Add CNAME for custom domain
  await addCNAMEFile(owner, repo, customDomain);

  // Poll GET /pages until we get status (not 404/403)
  const maxRetries = 15; // ~15-30 min
  for (let i = 0; i < maxRetries; i++) {
    const statusRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, { headers });
    if (statusRes.status === 403) {
      throw new Error("Persistent 403 on Pages status – fix PAT permissions");
    }
    if (statusRes.status === 200) {
      const data = await statusRes.json();
      console.log("Pages status:", data.status);
      if (data.status === "built") {
        return data.html_url || `https://${owner}.github.io/${repo}/`;
      }
    } else if (statusRes.status === 404) {
      console.log(`Pages not ready yet (404), retry ${i + 1}/${maxRetries}`);
    }
    await new Promise(r => setTimeout(r, 60000 * (i + 1))); // Backoff 1min → longer
  }

  throw new Error("GitHub Pages build timeout after multiple attempts");
};

// Keep original for backward compat if needed
export const enableGitHubPagesWorkflow = async (owner, repo) => {
  console.warn("Using deprecated enableGitHubPagesWorkflow – switch to setupGitHubPagesWithCustomDomain");
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "website-generator-ai",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ build_type: "workflow" }),
  });
  if (![201, 409].includes(res.status)) {
    throw new Error(`GitHub Pages enable failed: ${res.status} ${await res.text()}`);
  }
  return `https://${owner}.github.io/${repo}/`;
};
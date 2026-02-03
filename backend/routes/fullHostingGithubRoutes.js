// FULL HOSTING GitHub deploy
// HTML in repo root
// GitHub Pages via Actions (workflow mode ENABLED)
// slug-based pages + CNAME support + custom domain attach
import express from "express";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import simpleGit from "simple-git";
import { tempSessions } from "../index.js";
import { getUniqueRepoName, sanitizeRepoName, setupGitHubPagesWithCustomDomain } from "../utils/githubUtils.js";
import { setGitHubPagesDNS_Namecheap } from "../utils/setGitHubPagesDNS_Namecheap.js";

const router = express.Router();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

router.post("/deploy", async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const saved = tempSessions.get(sessionId);
  if (!saved || saved.type !== "full-hosting") {
    return res.status(404).json({ error: "Invalid session" });
  }
  if (!Array.isArray(saved.pages)) {
    return res.status(400).json({ error: "No HTML pages found" });
  }

  try {
    const owner = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !token) throw new Error("GitHub credentials missing");

    const repoName = await getUniqueRepoName(
      sanitizeRepoName(saved.businessName || saved.domain?.split(".")[0] || "site"),
      owner
    );

    const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName}/`;
    const repoUrl = `https://github.com/${owner}/${repoName}`;

    console.log(`Starting full hosting deploy → repo: ${repoName}`);

    // CREATE REPO
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "website-generator-ai",
      },
      body: JSON.stringify({
        name: repoName,
        private: false,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Repo create failed: ${createRes.status} - ${errText}`);
    }

    console.log(`Repo created: ${repoUrl}`);

    const dir = path.join("/tmp", repoName);
    await fs.remove(dir);
    await fs.ensureDir(dir);

    // WRITE HTML FILES (SLUG-SAFE)
    for (const p of saved.pages) {
      const filename =
        typeof p === "string"
          ? "index.html"
          : p.slug === "home"
          ? "index.html"
          : `${p.slug}.html`;
      const html = typeof p === "string" ? p : p.html;
      await fs.writeFile(path.join(dir, filename), html);
    }

    await fs.writeFile(path.join(dir, ".nojekyll"), "");

    // WORKFLOW for Actions deploy
    const wfDir = path.join(dir, ".github", "workflows");
    await fs.ensureDir(wfDir);
    await fs.writeFile(
      path.join(wfDir, "static.yml"),
      `name: Deploy GitHub Pages
on:
  push:
    branches: [ main ]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4`
    );

    // GIT PUSH
    const git = simpleGit(dir);
    await git.init(["--initial-branch=main"]);
    await git.addConfig("user.name", "WebsiteGeneration Bot");
    await git.addConfig("user.email", "bot@websitegeneration.co.uk");
    await git.add(".");
    await git.commit("Full hosting deploy");
    await git.addRemote(
      "origin",
      `https://${owner}:${token}@github.com/${owner}/${repoName}.git`
    );
    await git.push("origin", "main", ["--force"]);

    console.log(`Pushed to main → workflow should trigger soon`);
    console.log(`Actions URL: https://github.com/${owner}/${repoName}/actions`);

    // Wait a bit + poll for first Actions run to appear (helps debug stuck queues)
    let workflowRunFound = false;
    for (let i = 0; i < 12; i++) {  // ~60 seconds total
      await sleep(5000);
      try {
        const actionsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/actions/runs?event=push`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "website-generator-ai",
            },
          }
        );
        if (actionsRes.ok) {
          const runs = await actionsRes.json();
          if (runs.total_count > 0) {
            const latestRun = runs.workflow_runs[0];
            console.log(`Actions run detected: ${latestRun.status} - ${latestRun.conclusion || 'in progress'}`);
            workflowRunFound = true;
            break;
          }
        }
      } catch (e) {
        console.warn(`Could not check Actions yet: ${e.message}`);
      }
    }

    if (!workflowRunFound) {
      console.warn(`No Actions run appeared after 60s – check manually: https://github.com/${owner}/${repoName}/actions`);
    }

    // DNS setup first (independent of Pages – GitHub can verify later)
    if (saved.domain) {
      const dnsResult = await setGitHubPagesDNS_Namecheap(saved.domain, owner);
      if (!dnsResult.success) {
        console.warn("DNS setup initiated but not confirmed yet:", dnsResult.message);
      } else {
        console.log("DNS propagated successfully");
      }
    }

    // SETUP PAGES + CUSTOM DOMAIN (enable, poll, handle perms)
    let customUrl = pagesUrl;
    if (saved.domain) {
      console.log(`Setting up Pages with custom domain: ${saved.domain}`);
      customUrl = await setupGitHubPagesWithCustomDomain(owner, repoName, saved.domain);
    }

    // UPDATE SESSION
    saved.deployed = true;
    saved.pagesUrl = pagesUrl;
    saved.customUrl = customUrl; // Final expected URL
    saved.repoUrl = repoUrl;
    saved.repoName = repoName;
    saved.githubUser = owner;
    saved.dnsConfigured = !!saved.domain; // True if attempted
    saved.httpsReady = false; // Poller will update later
    tempSessions.set(sessionId, saved);

    res.json({ success: true, pagesUrl, customUrl, repoUrl });
  } catch (err) {
    console.error("Full hosting deploy failed:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

export default router;
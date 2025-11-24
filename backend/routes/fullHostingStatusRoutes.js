// routes/fullHostingStatusRoutes.js
import express from "express";
const router = express.Router();
import { tempSessions } from "../index.js";  // important: import the shared Map

router.get("/status", (req, res) => {
  const { sessionId, domain } = req.query;
  const saved = tempSessions.get(sessionId);

  if (!saved || saved.domain?.toLowerCase() !== domain.toLowerCase()) {
    return res.json({ deployed: false });
  }

  res.json({
    deployed: !!saved.deployed,
    domain: saved.domain,
    pagesUrl: saved.pagesUrl || "",
    repoUrl: saved.repoUrl || "",
    githubUser: saved.githubUser || "",
    repoName: saved.repoName || ""
  });
});

export default router;
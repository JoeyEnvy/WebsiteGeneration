// routes/fullHostingStatusRoutes.js
import express from "express";
import { tempSessions } from "../index.js";

const router = express.Router();

router.get("/status", (req, res) => {
  try {
    const { sessionId, domain } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing sessionId"
      });
    }

    const saved = tempSessions.get(sessionId);

    // Session not ready yet
    if (!saved) {
      return res.json({
        success: true,
        deployed: false
      });
    }

    // If domain was supplied, validate it safely
    if (
      domain &&
      saved.domain &&
      saved.domain.toLowerCase() !== String(domain).toLowerCase()
    ) {
      return res.json({
        success: true,
        deployed: false
      });
    }

    return res.json({
      success: true,
      deployed: Boolean(saved.deployed),
      domain: saved.domain || null,
      pagesUrl: saved.pagesUrl || null,
      repoUrl: saved.repoUrl || null,
      repoName: saved.repoName || null,
      githubUser: saved.githubUser || null,
      duration: saved.durationYears || null
    });

  } catch (err) {
    console.error("FULL HOSTING STATUS ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Status check failed"
    });
  }
});

export default router;

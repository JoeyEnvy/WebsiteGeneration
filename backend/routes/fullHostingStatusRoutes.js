import express from "express";
import { tempSessions } from "../index.js";

const router = express.Router();

/**
 * GET /api/full-hosting/status
 * Used by fullhosting.html to poll deployment + domain state
 */
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

    // Session not created yet
    if (!saved) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: false,
        dnsConfigured: false
      });
    }

    // Optional safety check (do NOT hard-fail)
    if (
      domain &&
      saved.domain &&
      saved.domain.toLowerCase() !== String(domain).toLowerCase()
    ) {
      return res.json({
        success: true,
        deployed: false,
        domainPurchased: Boolean(saved.domainPurchased),
        dnsConfigured: Boolean(saved.dnsConfigured)
      });
    }

    // 🚨 HARD FAILURE — bubble up real errors
    if (saved.failed) {
      return res.json({
        success: false,
        failed: true,
        error: saved.error || "Deployment failed",
        domain: saved.domain || null
      });
    }

    // ✅ SUCCESS / IN-PROGRESS (single source of truth)
    return res.json({
      success: true,
      deployed: Boolean(saved.deployed),
      domain: saved.domain || null,

      // GitHub
      pagesUrl: saved.pagesUrl || null,
      repoUrl: saved.repoUrl || null,
      repoName: saved.repoName || null,
      githubUser: saved.githubUser || null,

      // Domain + DNS (now exposed cleanly)
      domainPurchased: Boolean(saved.domainPurchased),
      dnsConfigured: Boolean(saved.dnsConfigured),

      // Billing
      durationYears: saved.durationYears || null
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

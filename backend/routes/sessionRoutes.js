import express from "express";
import { tempSessions } from "../index.js";

const router = express.Router();

router.post("/store-step", (req, res) => {
  const { sessionId, step, content } = req.body;

  if (!sessionId || !step || !content) {
    return res.status(400).json({
      success: false,
      error: "Missing sessionId, step, or content",
    });
  }

  const session = tempSessions.get(sessionId) || {};
  session[step] = content;

  tempSessions.set(sessionId, session);

  res.json({ success: true });
});

router.get("/get-steps/:sessionId", (req, res) => {
  const session = tempSessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  res.json({ success: true, steps: session });
});

export default router;

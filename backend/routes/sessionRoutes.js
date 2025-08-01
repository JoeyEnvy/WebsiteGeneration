const express = require('express');
const router = express.Router();

// Import shared session store from index.js
const { tempSessions } = require('../index.cjs');


// ========================================================================
// POST /store-step — Saves generator step progress
// ========================================================================
router.post('/store-step', (req, res) => {
  const { sessionId, step, content } = req.body;

  if (!sessionId || !step || !content) {
    return res.status(400).json({
      success: false,
      error: 'Missing sessionId, step, or content'
    });
  }

  if (!tempSessions[sessionId]) tempSessions[sessionId] = {};
  tempSessions[sessionId][step] = content;

  res.json({ success: true });
});

// ========================================================================
// GET /get-steps/:sessionId — Returns saved steps for the session
// ========================================================================
router.get('/get-steps/:sessionId', (req, res) => {
  const sessionData = tempSessions[req.params.sessionId];
  if (!sessionData) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, steps: sessionData });
});

// ========================================================================
// ✅ NEW: GET /get-status — Returns current statusLog for frontend polling
// ========================================================================
router.get('/get-status', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Missing sessionId.' });
  }

  const session = tempSessions[sessionId];
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  const statusLog = session.statusLog || [];
  res.json({ success: true, statusLog });
});

module.exports = router;


const express = require('express');
const router = express.Router();

// Import shared session store from index.js
const { tempSessions } = require('../index.cjs');

// ========================================================================
// POST /store-step — Saves generator step progress
// ========================================================================
router.post('/store-step', (req, res) => {
  const { sessionId, step, content } = req.body;

  // Log input for debugging
  console.log('📥 Incoming /store-step:', { sessionId, step, content });

  // Validate all fields are present
  if (!sessionId || !step || typeof content === 'undefined') {
    console.error('❌ Missing sessionId, step, or content in request');
    return res.status(400).json({
      success: false,
      error: 'Missing sessionId, step, or content'
    });
  }

  // Initialize session if missing
  if (!tempSessions[sessionId]) {
    console.warn(`⚠️ Creating new tempSession for ${sessionId}`);
    tempSessions[sessionId] = {};
  }

  // Assign step data safely
  tempSessions[sessionId][step] = content;

  console.log(`✅ Stored [${step}] for session ${sessionId}`);
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
// ✅ GET /get-status — Returns current statusLog for frontend polling
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


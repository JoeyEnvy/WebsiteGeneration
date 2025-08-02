const express = require('express');
const router = express.Router();

// Import shared session store from index.js
const { tempSessions } = require('../index.cjs');

// ========================================================================
// POST /store-step — Saves generator step progress
// ========================================================================
router.post('/store-step', (req, res) => {
  try {
    const body = req.body || {};
    const { sessionId, step, content, stepData } = body;

    console.log('📥 RAW BODY:', JSON.stringify(body, null, 2));

    if (!sessionId || typeof sessionId !== 'string') {
      console.error('❌ Missing or invalid sessionId');
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid sessionId'
      });
    }

    // 🔁 Handle shape: { sessionId, stepData: { step1: {...}, step2: {...} } }
    if (stepData && typeof stepData === 'object' && !Array.isArray(stepData)) {
      tempSessions[sessionId] = tempSessions[sessionId] || {};
      Object.assign(tempSessions[sessionId], stepData);
      console.log(`✅ Stored full stepData for session ${sessionId}`);
      return res.json({ success: true });
    }

    // 🔁 Handle shape: { sessionId, step: 'stepX', content: {...} }
    if (step && typeof step === 'string' && typeof content !== 'undefined') {
      tempSessions[sessionId] = tempSessions[sessionId] || {};
      tempSessions[sessionId][step] = content;
      console.log(`✅ Stored [${step}] for session ${sessionId}`);
      return res.json({ success: true });
    }

    // ❌ If nothing matched
    console.error('❌ Invalid structure — step or stepData missing or malformed');
    return res.status(400).json({
      success: false,
      error: 'Missing stepData or content structure'
    });

  } catch (err) {
    console.error('🔥 CRITICAL /store-step error:', err.stack || err.message || err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      detail: err.message || 'Unknown'
    });
  }
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
// GET /get-status — Returns current statusLog for frontend polling
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



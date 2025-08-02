const express = require('express');
const router = express.Router();

// Import shared session store from index.js
const { tempSessions } = require('../index.cjs');

// ========================================================================
// POST /store-step — Saves generator step progress
// ========================================================================
router.post('/store-step', (req, res) => {
  const { sessionId, step, content, stepData } = req.body;

  console.log('📥 Incoming /store-step payload:', req.body);

  // 🧠 Handle shape: { sessionId, stepData: { step1: {...}, step2: {...} } }
  if (sessionId && stepData && typeof stepData === 'object') {
    tempSessions[sessionId] = tempSessions[sessionId] || {};
    Object.assign(tempSessions[sessionId], stepData);
    console.log(`✅ Stored stepData object for session ${sessionId}`);
    return res.json({ success: true });
  }

  // 🧠 Handle shape: { sessionId, step: 'step3', content: { ... } }
  if (sessionId && step && typeof content !== 'undefined') {
    tempSessions[sessionId] = tempSessions[sessionId] || {};
    tempSessions[sessionId][step] = content;
    console.log(`✅ Stored [${step}] for session ${sessionId}`);
    return res.json({ success: true });
  }

  // ❌ If neither shape is valid
  console.error('❌ Invalid /store-step payload:', req.body);
  return res.status(400).json({
    success: false,
    error: 'Missing or invalid sessionId, step, content, or stepData.'
  });
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



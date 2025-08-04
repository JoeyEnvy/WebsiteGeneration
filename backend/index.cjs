// ========================================================================
// ✅ CommonJS Express Backend Entry — AI Website Generator
// ========================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ========================================================================
// ✅ Route Modules
// ========================================================================
const sessionRoutes = require('./routes/sessionRoutes.cjs');
const domainRoutes = require('./routes/domainRoutes.cjs');
const stripeRoutes = require('./routes/stripeRoutes.cjs');
const deployRoutes = require('./routes/deployRoutes.cjs');
const utilityRoutes = require('./routes/utilityRoutes.cjs');
const generateRoutes = require('./routes/generateRoutes.cjs'); // 🧠 OpenAI /generate

// ========================================================================
// ✅ App Setup
// ========================================================================
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ========================================================================
// ✅ Mount Routes
// ========================================================================
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);
app.use('/', generateRoutes);

// ✅ Debug & Health Check Routes
app.get('/ping', (_, res) => res.send('pong'));
app.get('/healthz', (_, res) => res.send('OK'));

// ✅ Serve static for local dev
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ========================================================================
// ✅ Global Error Handler
// ========================================================================
app.use((err, req, res, next) => {
  console.error('❌ Uncaught Error:', err.stack || err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ========================================================================
// ✅ Start Server (Render-compatible)
// ========================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

console.log('✅ Express app fully booted');



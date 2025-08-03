// ========================================================================
// CommonJS Express Backend Entry — AI Website Generator
// ========================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ========================================================================
// Third-Party APIs & Routes
// ========================================================================
const sessionRoutes = require('./routes/sessionRoutes.cjs');
const domainRoutes = require('./routes/domainRoutes.cjs');
const stripeRoutes = require('./routes/stripeRoutes.cjs');
const deployRoutes = require('./routes/deployRoutes.cjs');
const utilityRoutes = require('./routes/utilityRoutes.cjs');
const generateRoutes = require('./routes/generateRoutes.cjs'); // ✅ Add this!

// ========================================================================
// App Setup
// ========================================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ========================================================================
// Mount Routes
// ========================================================================
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);
app.use('/', generateRoutes); // ✅ Make sure this exists

// ✅ Optional: Serve static files (for local testing)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ✅ Debug route
app.get('/ping', (req, res) => res.send('pong'));

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Uncaught Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ========================================================================
// ✅ Start Server (Render-compatible)
// ========================================================================
const PORT = process.env.PORT;

if (!PORT) {
  throw new Error('❌ process.env.PORT must be defined (Render requires it)');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


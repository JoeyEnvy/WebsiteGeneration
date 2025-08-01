// ========================================================================
// Express + Modular API Backend for AI Website Generator (CommonJS)
// ========================================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const fetch = require('node-fetch');
const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Resolve __dirname in CommonJS (already native)

// Import routes (converted modules must use `module.exports`)
const sessionRoutes = require('./routes/sessionRoutes');
const domainRoutes = require('./routes/domainRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const deployRoutes = require('./routes/deployRoutes');
const utilityRoutes = require('./routes/utilityRoutes');

// ========================================================================
// App setup
// ========================================================================
const app = express();
app.use(cors());
app.use(express.json());

// ========================================================================
// Third-party API Clients
// ========================================================================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ In-memory session store
const tempSessions = {};
module.exports.tempSessions = tempSessions;

// ✅ Export shared utilities (no Octokit anymore)
module.exports.thirdParty = {
  stripe,
  fetch,
  sgMail,
  JSZip,
  uuidv4
};

// ========================================================================
// Mount API Routes
// ========================================================================
app.use('/', sessionRoutes);
app.use('/', domainRoutes);
app.use('/', stripeRoutes);
app.use('/', deployRoutes);
app.use('/', utilityRoutes);

// ✅ Optional: Static serving (useful for local testing or fallback)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ✅ Global error fallback
app.use((err, req, res, next) => {
  console.error('❌ Uncaught Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ✅ Debug route to confirm server is live (optional)
app.get('/ping', (req, res) => res.send('pong'));

// ========================================================================
// ✅ Server Startup (FIXED FOR RENDER)
// ========================================================================
const PORT = process.env.PORT;

if (!PORT) {
  throw new Error('❌ process.env.PORT must be defined. Render requires binding to this port.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


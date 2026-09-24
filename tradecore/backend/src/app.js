require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const logger       = require('./lib/logger'); 

const authRoutes     = require('./routes/auth');
const invoiceRoutes  = require('./routes/invoices');
const requestRoutes  = require('./routes/requests');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// ── Security ─────────────────────────────────────────────────────
app.use(helmet());

  // Comma-separated allowlist so Amplify branch URLs can rotate without a code change.
  const origins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
  origin: [...origins, 'http://localhost:3001'],
  credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, try again later.' }
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
}));

// ── Parsing ───────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined', {
  stream: { write: msg => logger.http(msg.trim()) }
}));

// ── Health ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    version: process.env.APP_VERSION || '1.0.0',
    region:  process.env.AWS_REGION  || 'local',
    ts:      new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/invoices',  invoiceRoutes);
app.use('/api/requests',  requestRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Errors ────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  const status  = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'An unexpected error occurred'
    : err.message;
  res.status(status).json({ error: message });
});

module.exports = app;

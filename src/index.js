require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const MatchScheduler     = require('./jobs/matchScheduler');
const matchesRouter      = require('./routes/matches');
const venuesRouter       = require('./routes/venues');
const subscriptionsRouter = require('./routes/subscriptions');
const standingsRouter    = require('./routes/standings');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/matches',   matchesRouter);
app.use('/api/venues',    venuesRouter);
app.use('/api/subscribe', subscriptionsRouter);
app.use('/api/standings', standingsRouter);

// VAPID public key endpoint -- the service worker needs this to build a
// PushSubscription before calling POST /api/subscribe.
app.get('/api/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Health check for Railway / uptime monitors
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve the React PWA in production.
// In development the Vite dev server handles this separately.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Start background scheduler (connects to DB internally)
const scheduler = new MatchScheduler();
scheduler.start();

app.listen(PORT, () => {
  console.log(`[Server] KickoffAI running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;

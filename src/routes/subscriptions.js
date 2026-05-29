const express = require('express');
const router  = express.Router();
const { upsertSubscription, deleteSubscription } = require('../db/queries');

// POST /api/subscribe -- save or refresh a push subscription
router.post('/', async (req, res) => {
  const { endpoint, keys } = req.body || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({
      error: 'endpoint, keys.p256dh, and keys.auth are required',
    });
  }

  try {
    const sub = await upsertSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
    res.status(201).json(sub);
  } catch (err) {
    console.error('[Route] POST /subscribe:', err.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/subscribe -- remove a push subscription
// Accepts endpoint in body or as a query param to support varied client implementations.
router.delete('/', async (req, res) => {
  const endpoint = req.body?.endpoint || req.query?.endpoint;

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required' });
  }

  try {
    await deleteSubscription(endpoint);
    res.status(204).send();
  } catch (err) {
    console.error('[Route] DELETE /subscribe:', err.message);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

module.exports = router;

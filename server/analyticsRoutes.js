const express = require('express');
const { universeIds } = require('../analytics/config');
const { loadData } = require('../analytics/tracker');

const router = express.Router();

router.post('/api/track/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid universe ID' });
  }

  if (universeIds.has(id)) {
    return res.status(409).json({ error: 'Universe is already being tracked' });
  }

  try {
    await beginTracking(id);
    res.status(200).json({ message: `Now tracking universe ${id}` });
  } catch (err) {
    console.error('Failed to start tracking:', err);
    res.status(500).json({ error: 'Failed to start tracking universe' });
  }
});

router.get('/api/data', async (_req, res) => {
  const result = {};
  for (const id of universeIds) {
    result[id] = await loadData(id);
  }
  res.json(result);
});

router.get('/api/data/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!universeIds.includes(id)) return res.status(404).json({ error: `Universe ${id} not tracked.` });
  const data = await loadData(id);
  res.json(data);
});

router.get('/api/growth/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!universeIds.includes(id)) return res.status(404).json({ error: `Universe ${id} not tracked.` });
  const data = await loadData(id);
  res.json(data.map(entry => ({
    timestamp: entry.timestamp,
    visitsGrowth: entry.visitsGrowth,
    playingGrowth: entry.playingGrowth
  })));
});

module.exports = router;

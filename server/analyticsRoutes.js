const express = require('express');
const { universeIds, loadData, beginTracking } = require('../analytics/tracker');

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

router.get('/api/data/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!universeIds.has(id)) {
    return res.status(404).json({ error: `Universe ${id} not tracked.` });
  }
  const data = await loadData(id);

  // ⏳ Filter to only include last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentData = data.filter(entry => new Date(entry.timestamp).getTime() >= sevenDaysAgo);

  res.json(recentData);
});

router.get('/api/data/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!universeIds.has(id)) {
    return res.status(404).json({ error: `Universe ${id} not tracked.` });
  }
  const data = await loadData(id);
  res.json(data);
});

router.get('/api/growth/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!universeIds.has(id)) {
    return res.status(404).json({ error: `Universe ${id} not tracked.` });
  }
  const data = await loadData(id);
  res.json(data.map(entry => ({
    timestamp: entry.timestamp,
    visitsGrowth: entry.visitsGrowth,
    playingGrowth: entry.playingGrowth
  })));
});

module.exports = router;

const express = require('express');
const axios = require('axios');

const router = express.Router();

const gameCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get('/:universeId', async (req, res) => {
  const { universeId } = req.params;

  // Check cache
  const cached = gameCache.get(universeId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return res.json(cached.data);
  }

  try {
    const response = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = response.data.data?.[0];
    if (!data) return res.status(404).json({ error: 'Game not found' });

    const { visits, playing, name } = data;

    // Votes
    let upVotes = 0, downVotes = 0;
    try {
      const votesResp = await axios.get(`https://games.roblox.com/v1/games/${universeId}/votes`);
      upVotes = votesResp.data?.upVotes ?? 0;
      downVotes = votesResp.data?.downVotes ?? 0;
    } catch {}

    const likeRatio = (upVotes + downVotes) > 0 ? upVotes / (upVotes + downVotes) : 0;

    // Icon
    let iconUrl = null;
    try {
      const iconResp = await axios.get('https://thumbnails.roblox.com/v1/games/icons', {
        params: { universeIds: universeId, size: '150x150', format: 'Png', returnPolicy: 'PlaceHolder' }
      });
      const iconData = iconResp.data.data?.[0];
      if (iconData?.state === 'Completed') iconUrl = iconData.imageUrl;
    } catch {}

    // Thumbnail
    let thumbnailUrl = null;
    try {
      const thumbResp = await axios.get('https://thumbnails.roblox.com/v1/games/multiget/thumbnails', {
        params: { universeIds: universeId, size: '768x432', format: 'Png', returnPolicy: 'PlaceHolder' }
      });
      const firstThumb = thumbResp.data.data?.[0]?.thumbnails?.[0];
      if (firstThumb?.state === 'Completed') thumbnailUrl = firstThumb.imageUrl;
    } catch {}

    const result = { name, visits, playing, likeRatio, iconUrl, thumbnailUrl };

    gameCache.set(universeId, { data: result, timestamp: Date.now() });
    res.json(result);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch game data' });
  }
});

module.exports = router;

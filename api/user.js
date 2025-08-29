const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const userResp = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
    const { name, displayName, id } = userResp.data;

    let avatarUrl = null;
    try {
      const headshotResp = await axios.get('https://thumbnails.roblox.com/v1/users/avatar-headshot', {
        params: { userIds: userId, size: '150x150', format: 'Png', isCircular: false }
      });
      const thumbData = headshotResp.data.data?.[0];
      if (thumbData?.state === 'Completed') avatarUrl = thumbData.imageUrl;
    } catch {}

    res.json({ userId: id, username: name, displayName, avatarUrl });
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).json({ error: 'User not found' });
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

module.exports = router;

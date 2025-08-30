const express = require('express');
const axios = require('axios');

const Pool = require('../modules/db');

const router = express.Router();

router.post('/join/:userId', async (req, res) => {
    const { name } = req.body;
  try {
    const result = await Pool.query(
      'INSERT INTO users (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

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

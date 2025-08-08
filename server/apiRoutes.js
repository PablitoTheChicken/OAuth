const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

const router = express.Router();

const CLIENT_ID     = process.env.ROBLOX_CLIENT_ID     || '2502928924991748390';
const CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || 'RBX-bf1Hc1QNDkWZfpWCeSRUvuwB-JdjgBYzny_xX_Wnb-y4PcDVwjYu3BnP8tr6-ixQ';
const REDIRECT_URI  = 'https://cahoots.gg/auth/roblox/callback';

router.get('/', (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.send(`<html><body><h1>Roblox OAuth</h1><a href="/auth/roblox">Log in with Roblox</a></body></html>`);
  } else {
    res.send(`<html><body><h1>Welcome, ${user.preferred_username}</h1><img src="${user.picture || ''}" style="border-radius:50%"><p>ID: ${user.sub}</p><a href="/logout">Log out</a></body></html>`);
  }
});

router.get('/auth/roblox', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const scopes = encodeURIComponent('openid profile');
  const authorizeUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}`;
  res.redirect(authorizeUrl);
});

router.get('/auth/roblox/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!state || state !== req.session.oauthState) return res.status(400).send('Invalid state');
  delete req.session.oauthState;
  if (!code) return res.status(400).send('Missing code');
  try {
    const tokenRes = await axios.post(
      'https://apis.roblox.com/oauth/v1/token',
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;
    req.session.accessToken = accessToken;
    const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    req.session.user = userRes.data;
    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Roblox API endpoints (avatar, user info, game info, etc.)
router.get('/api/fetch-avatar/:userId', async (req, res) => {
  const userId = req.params.userId;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }

  try {
    const response = await axios.get(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot`, {
        params: {
          userIds: userId,
          size: '150x150',
          format: 'Png',
          isCircular: true
        }
      }
    );

    const avatarData = response.data?.data?.[0];
    if (avatarData?.imageUrl) {
      res.json({ imageUrl: avatarData.imageUrl });
    } else {
      res.status(404).json({ error: 'Avatar not found' });
    }
  } catch (error) {
    console.error('Error fetching avatar:', error.message);
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

router.get('/api/fetch-game-info/:placeId', async (req, res) => {
  const placeId = req.params.placeId;

  if (!placeId || isNaN(placeId)) {
    return res.status(400).json({ error: 'Invalid or missing placeId' });
  }

  try {

    const universeIdResponse = await axios.get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    const universeId = universeIdResponse.data?.universeId;

    const response = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`, {
      params: { placeId }
    });

    const gameData = response.data?.data?.[0];

    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }

        const voteResponse = await axios.get(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`);
    const voteData = voteResponse.data?.data?.[0];

    const upVotes = voteData?.upVotes || 0;
    const downVotes = voteData?.downVotes || 0;
    const totalVotes = upVotes + downVotes;
    const likeRatio = totalVotes > 0 ? (upVotes / totalVotes) * 100 : null;

    const { name, creator, playing, visits, maxPlayers, created, updated, description } = gameData;

    res.json({
      name,
      universeId,
      description: description || 'No description available',
      creatorName: creator?.name,
      creatorType: creator?.type,
      playing,
      visits,
      likeRatio: likeRatio !== null ? parseFloat(likeRatio.toFixed(1)) : null,
      maxPlayers,
      created,
      updated,

    });
  } catch (error) {
    console.error('Error fetching game info:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch game info' });
  }
});



router.get('/api/fetch-user-info/:userId', async (req, res) => {
  const userId = req.params.userId;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }

  try {
    const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`);

    const { name: username, displayName, hasVerifiedBadge } = response.data;
    res.json({ username, displayName, hasVerifiedBadge });
  } catch (error) {
    console.error('Error fetching user info:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

router.post('/api/fetch-user-id', async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required and must be a string' });
  }

  try {
    const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const userId = response.data?.data?.[0]?.id || null;

    res.json({ userId });
  } catch (error) {
    console.error('Error fetching user ID:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user ID' });
  }
});

module.exports = router;

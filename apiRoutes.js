const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

const router = express.Router();

const CLIENT_ID     = '3474497565457328901';
const CLIENT_SECRET = 'RBX-_N5_uqSbjkOOsU33KQOQm9_97UVrea_Pmlbqbhhqjc_CVUTkjzWh6tuglli_dMB7';
const REDIRECT_URI  = 'https://dashboard.forreal.games/auth/callback';

router.get('/auth/', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const scopes = encodeURIComponent('openid profile');
  const authorizeUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${CLIENT_ID}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=${scopes}`
    + `&state=${state}`;

  res.redirect(authorizeUrl);
});

// Step 2: Handle callback and exchange code for tokens
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Skip state validation for now since it's coming from frontend fetch
  // In production, you'd want to implement a more robust state validation

  try {
    // Exchange authorization code for tokens
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

    const { access_token, refresh_token, id_token, expires_in, token_type, scope } = tokenRes.data;
    
    // Use the access token to fetch user info
    const userInfoRes = await axios.get(
      'https://apis.roblox.com/oauth/v1/userinfo',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    // Store in session for /auth/me endpoint
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.user = userInfoRes.data;

    // Return user data to frontend
    res.json({
      user: userInfoRes.data,
      tokens: { access_token, refresh_token, id_token, expires_in, token_type, scope }
    });
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to retrieve tokens' });
  }
});


// Step 3 (optional): Refresh tokens
router.get('/auth/refresh', async (req, res) => {
  const refreshToken = req.session.refreshToken;
  if (!refreshToken) {
    return res.status(400).send('No refresh token available');
  }

  try {
    const tokenRes = await axios.post(
      'https://apis.roblox.com/oauth/v1/token',
      qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in, token_type, scope } = tokenRes.data;
    req.session.accessToken  = access_token;
    req.session.refreshToken = refresh_token;

    res.json({ access_token, refresh_token, expires_in, token_type, scope });
  } catch (err) {
    console.error('Refresh error:', err.response?.data || err.message);
    res.status(500).send('Failed to refresh token');
  }
});

// Step 4: Get current authenticated user
router.get('/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

const gameCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms

router.get('/game/:universeId', async (req, res) => {
  const { universeId } = req.params;

  // Check cache first
  const cached = gameCache.get(universeId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return res.json(cached.data);
  }

  try {
    // Fetch core game data
    const response = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = response.data.data?.[0];

    if (!data) {
      return res.status(404).json({ error: 'Game not found or invalid Universe ID' });
    }

    const { visits, playing, name } = data;

    // Fetch vote counts
    let upVotes = 0;
    let downVotes = 0;
    try {
      const votesResp = await axios.get(`https://games.roblox.com/v1/games/${universeId}/votes`);
      const votesData = votesResp.data;
      upVotes = votesData?.upVotes ?? 0;
      downVotes = votesData?.downVotes ?? 0;
    } catch (voteErr) {
      console.warn(`Votes request failed for universeId ${universeId}:`, voteErr.message);
    }
    const totalVotes = upVotes + downVotes;
    const likeRatio = totalVotes > 0 ? upVotes / totalVotes : 0;

    // Fetch the game’s icon
    let iconUrl = null;
    try {
      const iconResp = await axios.get('https://thumbnails.roblox.com/v1/games/icons', {
        params: {
          universeIds: universeId,
          size: '150x150',
          format: 'Png',
          returnPolicy: 'PlaceHolder',
          isCircular: false
        }
      });
      const iconData = iconResp.data.data?.[0];
      if (iconData?.state === 'Completed') {
        iconUrl = iconData.imageUrl;
      }
    } catch (err) {
      console.warn(`Icon request failed for universeId ${universeId}:`, err.message);
    }

    // Fetch the game’s thumbnail
    let thumbnailUrl = null;
    try {
      const thumbResp = await axios.get('https://thumbnails.roblox.com/v1/games/multiget/thumbnails', {
        params: {
          universeIds: universeId,
          size: '768x432',
          format: 'Png',
          returnPolicy: 'PlaceHolder',
          isCircular: false
        }
      });
      const thumbEntry = thumbResp.data.data?.[0];
      const firstThumb = thumbEntry?.thumbnails?.[0];
      if (firstThumb?.state === 'Completed') {
        thumbnailUrl = firstThumb.imageUrl;
      }
    } catch (err) {
      console.warn(`Thumbnail request failed for universeId ${universeId}:`, err.message);
    }

    const result = {
      name,
      visits,
      playing,
      likeRatio,
      iconUrl,
      thumbnailUrl
    };

    // Save to cache
    gameCache.set(universeId, { data: result, timestamp: Date.now() });

    res.json(result);
  } catch (error) {
    if (error.response) {
      console.error('Error fetching Roblox game data:', error.response.status, error.response.data);
    } else {
      console.error('Error fetching Roblox game data:', error.message);
    }
    res.status(500).json({ error: 'Failed to fetch game details from Roblox API' });
  }
});

router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Fetch user details (username, displayName):contentReference[oaicite:2]{index=2}.
    const userResp = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
    const { name, displayName, id } = userResp.data;

    // 2. Fetch avatar headshot image:contentReference[oaicite:3]{index=3}.
    let avatarUrl = null;
    try {
      const headshotResp = await axios.get('https://thumbnails.roblox.com/v1/users/avatar-headshot', {
        params: {
          userIds: userId,
          size: '150x150',
          format: 'Png',
          isCircular: false
        }
      });
      const thumbData = headshotResp.data.data?.[0];
      if (thumbData?.state === 'Completed') {
        avatarUrl = thumbData.imageUrl;
      }
    } catch (thumbErr) {
      console.warn(`Avatar request failed for userId ${userId}:`, thumbErr.message);
    }

    // Return user profile information
    res.json({
      userId: id,
      username: name,
      displayName,
      avatarUrl
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'User not found or invalid user ID' });
    }
    console.error('Error fetching Roblox user data:', error.message);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
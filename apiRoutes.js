const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

const router = express.Router();

const CLIENT_ID     = '3474497565457328901';
const CLIENT_SECRET = 'RBX-_N5_uqSbjkOOsU33KQOQm9_97UVrea_Pmlbqbhhqjc_CVUTkjzWh6tuglli_dMB7';
const REDIRECT_URI  = 'https://forrealdashboard.lovable.app/auth/callback';

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

module.exports = router;
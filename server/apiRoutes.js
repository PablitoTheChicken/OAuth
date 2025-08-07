const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

const router = express.Router();

const CLIENT_ID     = process.env.ROBLOX_CLIENT_ID     || '2502928924991748390';
const CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || 'RBX-bf1Hc1QNDkWZfpWCeSRUvgwFhsaJv0Mej-QfVuFboHcUILqdCkvUmvWoOUs89G3I';
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
router.get('/api/fetch-avatar/:userId', async (req, res) => { /* ...same code... */ });
router.get('/api/fetch-user-info/:userId', async (req, res) => { /* ...same code... */ });
router.post('/api/fetch-user-id', async (req, res) => { /* ...same code... */ });
router.get('/api/fetch-game-info/:placeId', async (req, res) => { /* ...same code... */ });

module.exports = router;

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const qs = require('querystring');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

// === Configuration ===
const CLIENT_ID     = process.env.ROBLOX_CLIENT_ID     || '2502928924991748390';
const CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || 'RBX-bf1Hc1QNDkWZfpWCeSRUvgwFhsaJv0Mej-QfVuFboHcUILqdCkvUmvWoOUs89G3I';
const REDIRECT_URI  = 'https://cahoots.gg/auth/roblox/callback';
const PORT          = 443; // HTTPS default

// === TLS Certificate Files (make sure these paths are correct) ===
const privateKey  = fs.readFileSync('/etc/letsencrypt/live/cahoots.gg/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/cahoots.gg/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// === Express App Setup ===
const app = express();
app.use(session({
  secret: 'roblox-oauth-example',
  resave: false,
  saveUninitialized: true
}));

// === Routes ===
app.get('/', (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.send(`
      <html><head><title>Roblox OAuth Example</title></head><body>
      <h1>Roblox OAuth 2.0 Example</h1>
      <a href="/auth/roblox">Log in with Roblox</a>
      </body></html>`);
  } else {
    res.send(`
      <html><head><title>Welcome</title></head><body>
      <h1>Welcome, ${user.preferred_username}</h1>
      <img src="${user.picture || ''}" width="96" height="96" style="border-radius:50%">
      <p>Roblox ID: ${user.sub}</p>
      <p>Display name: ${user.name}</p>
      <a href="/logout">Log out</a>
      </body></html>`);
  }
});

app.get('/auth/roblox', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const scopes = encodeURIComponent('openid profile');
  const authorizeUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${scopes}` +
    `&state=${state}`;
  res.redirect(authorizeUrl);
});

app.get('/auth/roblox/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid state');
  }
  delete req.session.oauthState;
  if (!code) {
    return res.status(400).send('Missing code');
  }
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
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// === HTTPS Server ===
https.createServer(credentials, app).listen(PORT, () => {
  console.log(`✅ HTTPS server running at https://cahoots.gg`);
});
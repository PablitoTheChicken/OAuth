// Example Express.js website demonstrating Roblox OAuth 2.0 integration.
//
// This single file acts as both the server and the front‑end.  It serves
// a simple HTML page at the root path (/) that either displays a
// “Log in with Roblox” link or, once authenticated, shows basic user
// information returned by the /v1/userinfo endpoint.  The server also
// implements the OAuth 2.0 Authorization Code flow as described in
// Roblox’s documentation【190603315623368†screenshot】【368226039298607†screenshot】.

const express = require('express');
const session = require('express-session');
const axios    = require('axios');
const qs       = require('querystring');
const crypto   = require('crypto');

const CLIENT_ID     = process.env.ROBLOX_CLIENT_ID     || '2502928924991748390';
const CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || 'RBX-bf1Hc1QNDkWZfpWCeSRUvgwFhsaJv0Mej-QfVuFboHcUILqdCkvUmvWoOUs89G3I';
const REDIRECT_URI  = process.env.ROBLOX_REDIRECT_URI  || 'https://cahoots.gg/auth/roblox/callback';
const PORT          = process.env.PORT || 3000;

const app = express();
app.use(session({
  secret: 'roblox-oauth-example',
  resave: false,
  saveUninitialized: true
}));

// Render a simple page.  If the user is authenticated (i.e., session
// contains user info), show their display name, user ID and avatar.
// Otherwise show a “Log in with Roblox” link.
app.get('/', (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.send(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Roblox OAuth Example</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          a.button { display: inline-block; padding: 1rem 2rem; background: #0064d3; color: #fff; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Roblox OAuth 2.0 Example</h1>
        <p><a class="button" href="/auth/roblox">Log in with Roblox</a></p>
      </body>
      </html>`);
  } else {
    res.send(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Welcome ${user.preferred_username}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          img { border-radius: 50%; width: 96px; height: 96px; }
          a { color: #0064d3; }
        </style>
      </head>
      <body>
        <h1>Welcome, ${user.preferred_username}</h1>
        <p><img src="${user.picture || ''}" alt="Avatar"></p>
        <p><strong>Roblox ID:</strong> ${user.sub}</p>
        <p><strong>Display name:</strong> ${user.name}</p>
        <p><a href="/logout">Log out</a></p>
      </body>
      </html>`);
  }
});

// Initiate the OAuth flow – same as in the standalone server example
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

// OAuth callback handler.  Exchanges the authorization code for tokens
// and stores the user info in the session, then redirects to the home page.
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
    const refreshToken = tokenRes.data.refresh_token;
    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;
    const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    req.session.user = userRes.data;
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).send('Failed to complete OAuth flow');
  }
});

// Log the user out by clearing the session
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, '45.143.196.245', () => {
    console.log(`Server is running on Cahoots.gg`);
});
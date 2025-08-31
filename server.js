const express = require('express');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./api');

// TLS certs
const privateKey = fs.readFileSync('/etc/letsencrypt/live/api.forreal.games/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/api.forreal.games/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Express app
const app = express();
app.use(cors({
  origin: ['https://dashboard.forreal.games', 'https://forreal.games', "https://*.forreal.games", "https://preview--forreal-games.lovable.app/", "https://forreal-games.lovable.app/"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // for legacy browser support
}));
app.use(express.json());
app.set('trust proxy', 1); // if behind a reverse proxy (like Vercel, Heroku, or Lovable)
app.use(session({
  secret: 'roblox-oauth-example',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // force HTTPS
    sameSite: 'lax'    // or 'none' if you’re doing cross-domain OAuth
  }
}));

// API routes
app.use('/', apiRoutes);

// Start HTTPS server
const PORT = 443;
https.createServer(credentials, app).listen(PORT, () => {
  console.log(`✅ HTTPS server running at https://api.forreal.games`);
});

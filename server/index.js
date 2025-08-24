const express = require('express');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// TLS certs
const privateKey  = fs.readFileSync('/etc/letsencrypt/live/cahoots.gg/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/cahoots.gg/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: 'roblox-oauth-example',
  resave: false,
  saveUninitialized: true
}));

// Static dashboard
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/', require('./apiRoutes'));

// Start HTTPS server
const PORT = 443;
https.createServer(credentials, app).listen(PORT, () => {
  console.log(`✅ HTTPS server running at https://cahoots.gg`);
});

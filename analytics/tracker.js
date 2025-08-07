/*
 * Roblox Game Analytics Tracker
 *
 * This Node.js application monitors one or more Roblox games, recording
 * the total number of visits and current concurrent users (players)
 * periodically using Roblox’s public Games API.  The tracker stores
 * each sample as a JSON object along with growth percentages between
 * successive samples.  An Express.js server exposes the collected
 * data through a RESTful API and serves a simple dashboard that
 * visualises the history with charts.
 *
 * How it works:
 *   1. `config.js` defines the universe IDs to track and the polling
 *      interval.  Universe IDs correspond to games on Roblox and can
 *      be obtained from the Creator Hub or via the universes API.
 *   2. On startup the tracker fetches the current stats for each
 *      configured universe and writes them to a JSON file in the
 *      `data/` directory.  Each universe has its own file named
 *      `<universeId>.json` containing an array of samples.
 *   3. A timer schedules repeated polls at the configured interval.
 *   4. An Express server exposes endpoints at `/api/data` and
 *      `/api/data/:id` to retrieve the raw samples, as well as
 *      `/api/growth/:id` to get just the growth metrics.  The root
 *      path serves a small web app that uses Chart.js to display
 *      graphs.
 */

// node-fetch v3 exports a namespace with a default async function.  When
// imported via CommonJS require you must access the `.default` property
// to get the actual fetch function.  See the module’s README for
// details.
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');

const universeIds = new Set(require('./config').universeIds);
const fetchIntervalMinutes = require('./config').fetchIntervalMinutes;

const timers = new Map();

const DATA_DIR = path.join(__dirname, 'data');
const API_URL = 'https://games.roblox.com/v1/games?universeIds=';

/**
 * Ensure the data directory exists.  If it doesn’t, create it.
 */
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Fetch current game data for a given universe ID from Roblox’s Games API.
 * The returned object includes the total visit count and the current
 * number of players (CCU).  If the API returns an error or the data
 * structure isn’t as expected, an exception will be thrown.
 *
 * @param {number} universeId The numeric universe ID.
 * @returns {Promise<{visits: number, playing: number}>}
 */
async function fetchGameData(universeId) {
  const response = await fetch(`${API_URL}${universeId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch game data for ${universeId}: ${response.status}`);
  }
  const body = await response.json();
  const game = body.data && body.data[0];
  if (!game) {
    throw new Error(`No data returned for universe ${universeId}`);
  }
  const visits = typeof game.visits === 'number' ? game.visits : 0;
  const playing = typeof game.playing === 'number' ? game.playing : 0;
  const favorites = typeof game.favoritedCount === 'number' ? game.favoritedCount : 0;
  return { visits, playing, favorites };
}

/**
 * Fetch vote data (upVotes and downVotes) for a given universe.  The
 * Games API provides a `/v1/games/votes?universeIds=<id>` endpoint that
 * returns an object containing the counts of upvotes and downvotes for
 * each universe ID【445672972853798†L161-L173】.  These counts are used to
 * compute the like ratio.
 *
 * @param {number} universeId
 * @returns {Promise<{upVotes: number, downVotes: number}>}
 */
async function fetchGameVotes(universeId) {
  const votesUrl = `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`;
  const response = await fetch(votesUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch vote data for ${universeId}: ${response.status}`);
  }
  const body = await response.json();
  const info = body.data && body.data[0];
  const upVotes = info && typeof info.upVotes === 'number' ? info.upVotes : 0;
  const downVotes = info && typeof info.downVotes === 'number' ? info.downVotes : 0;
  return { upVotes, downVotes };
}

/**
 * Load the existing samples for a universe from disk.  Returns an array
 * of sample objects; if the file doesn’t exist or can’t be parsed
 * correctly, an empty array is returned.
 *
 * @param {number} universeId
 * @returns {Promise<any[]>}
 */
async function loadData(universeId) {
  const filePath = path.join(DATA_DIR, `${universeId}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return [];
  }
}

/**
 * Save the array of samples for a universe to disk.  Data is serialised
 * as formatted JSON for readability.
 *
 * @param {number} universeId
 * @param {any[]} data
 */
async function saveData(universeId, data) {
  const filePath = path.join(DATA_DIR, `${universeId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Compute the percentage growth between two values.  If there is no
 * previous value (undefined or zero), the growth defaults to 0 to avoid
 * division by zero.  Negative growth is possible when the current
 * value is lower than the previous value.
 *
 * @param {number} current
 * @param {number|undefined} previous
 * @returns {number}
 */
function computeGrowth(current, previous) {
  if (!previous || previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Record a new sample for the given universe ID.  This function
 * fetches the latest stats from Roblox, compares them to the most
 * recent sample on disk to compute growth percentages, and appends
 * the new sample to the universe’s data file.
 *
 * @param {number} universeId
 */
async function recordData(universeId) {
  try {
    const { visits, playing } = await fetchGameData(universeId);
    const { upVotes, downVotes } = await fetchGameVotes(universeId);
    const now = new Date().toISOString();
    const data = await loadData(universeId);
    const last = data[data.length - 1];
    // Compute growth percentages relative to the previous sample
    const visitsGrowth = last ? computeGrowth(visits, last.visits) : 0;
    const playingGrowth = last ? computeGrowth(playing, last.playing) : 0;
    // Compute like ratio: percentage of upvotes out of total votes
    const totalVotes = upVotes + downVotes;
    const likeRatio = totalVotes > 0 ? (upVotes / totalVotes) * 100 : 0;
    const likeRatioGrowth = last ? computeGrowth(likeRatio, last.likeRatio) : 0;

    const favorites = last ? last.favorites : 0; // Use previous favorites if available
    const favoritesGrowth = last ? computeGrowth(favorites, last.favorites) : 0;
    // Estimate session time in minutes based on the difference in visits and players
    let sessionTimeEstimate = 0;
    if (last) {
      const lastTime = new Date(last.timestamp);
      const nowTime = new Date(now);
      const minutesDiff = (nowTime - lastTime) / 1000 / 60;
      const avgPlayers = (last.playing + playing) / 2;
      const newVisits = visits - last.visits;
      if (newVisits > 0 && avgPlayers > 0) {
        sessionTimeEstimate = (avgPlayers * minutesDiff) / newVisits;
      }
    }

    const avgSessionTime =
  data.length > 0
    ? (data.reduce((sum, s) => sum + (s.sessionTimeEstimate ?? 0), 0) + sessionTimeEstimate) / (data.length + 1)
    : sessionTimeEstimate;

    const sample = {
      timestamp: now,
      visits,
      playing,
      upVotes,
      downVotes,
      likeRatio,
      visitsGrowth,
      playingGrowth,
      likeRatioGrowth,
      sessionTimeEstimate,
      avgSessionTime,
      favorites,
      favoritesGrowth
    };
    data.push(sample);
    await saveData(universeId, data);
    console.log(
      `[${now}] Recorded data for universe ${universeId}: visits=${visits}, playing=${playing}, ` +
        `likes=${upVotes}, dislikes=${downVotes}, ratio=${likeRatio.toFixed(2)}%`
    );
  } catch (err) {
    console.error(`Error recording data for universe ${universeId}:`, err);
  }
}

async function beginTracking(universeId) {
  if (timers.has(universeId)) return; // already tracking
  universeIds.add(universeId);
  await recordData(universeId);
  const interval = setInterval(() => recordData(universeId), fetchIntervalMinutes * 60 * 1000);
  timers.set(universeId, interval);
  console.log(`🔁 Started tracking universe ${universeId}`);
}

/**
 * Start the periodic polling for each universe ID defined in config.js.
 * The initial call is made immediately on startup and then repeated
 * according to the configured interval.  Each universe is polled
 * independently so a slow request won’t delay others.
 */
async function startTracking() {
  await ensureDataDir();
  for (const id of universeIds) {
    await beginTracking(id);
  }
}

// Kick off tracking.  If the initial call fails, it still sets up
// the Express server; errors are logged but won’t halt execution.
module.exports = {
  universeIds,
  loadData,
  beginTracking,
  startTracking
};

startTracking().catch(console.error);
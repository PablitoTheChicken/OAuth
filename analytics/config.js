/**
 * List of Roblox universe IDs to track and the polling interval.
 *
 * Universe IDs identify a game on Roblox.  You can find a game’s
 * universe ID in the Roblox Creator Hub, or by converting a place ID
 * using the universes API.  See the discussion in the developer forum
 * for details【698823226887793†L118-L125】.
 *
 * The application will poll the Roblox Games API on a fixed schedule
 * (default: every 10 minutes) to record the current visit count and
 * number of concurrent players for each universe.  Polling more
 * frequently increases the resolution of your analytics but will make
 * more requests to Roblox’s servers.
 */

module.exports = {
  /**
   * Array of universe IDs to track.  Replace the sample IDs below with
   * the universe IDs for the games you care about.  You can specify one
   * or many IDs.  Universe IDs are numeric.
   */
  universeIds: [
    // Example: the universe ID for "ForeverDab987's Place" (just a demo)
    6705549208,
    7436755782,
    // Add additional universe IDs here
  ],

  /**
   * Polling interval in minutes.  The tracker will fetch fresh data for
   * each universe at this interval.  A value of 10 means the tracker
   * runs every 10 minutes.
   */
  fetchIntervalMinutes: 10,
};
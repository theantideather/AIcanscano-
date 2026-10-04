// Wraps the Express app (server.js) for Netlify Functions, so the same
// /analyze, /teleconsult, and /health routes that run locally via
// `node server.js` also run in production behind Netlify's redirects
// (see netlify.toml). No route logic lives here; this is purely an adapter.
const serverless = require('serverless-http');
const app = require('../../server');

module.exports.handler = serverless(app);

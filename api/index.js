// Vercel entry point: every request is rewritten here (see vercel.json) and handled by the Express app.
const app = require('../server/index.js');

module.exports = async (req, res) => {
  try {
    await app.ready;
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server is not ready: ' + e.message });
  }
  return app(req, res);
};

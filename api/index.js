// Vercel entry point: every request is rewritten here (see vercel.json) and handled by the Express app.
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_PASSWORD'];

let app;
module.exports = async (req, res) => {
  // Check first: the app exits immediately when these are missing, which Vercel only reports as a bare 500.
  const missing = REQUIRED.filter((k) => !(process.env[k] || '').trim());
  if (missing.length) {
    return res.status(500).json({ error: 'Missing environment variables in Vercel: ' + missing.join(', ') });
  }
  try {
    app ||= require('../server/index.js');
    await app.ready;
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server is not ready: ' + e.message });
  }
  return app(req, res);
};

const path = require('node:path');
const express = require('express');
const compression = require('compression');
const auth = require('./auth');
const { publicRouter, adminRouter } = require('./routes');
const { HttpError } = require('./validate');
const { init } = require('./db');
const storage = require('./storage');

if (process.env.NODE_ENV === 'production' && auth.usingDemoPassword) {
  console.error('Refusing to start: set ADMIN_PASSWORD to something private before running in production (the demo password is public).');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(compression());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
  next();
});
app.use(express.json({ limit: '4mb' }));

// Writes must be JSON (blocks plain cross-site form posts; the cookie is also SameSite=Strict)
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'DELETE' && !req.is('application/json')) return res.status(415).json({ error: 'JSON only.' });
  next();
});

app.post('/api/auth/login', auth.login);
app.post('/api/auth/logout', auth.logout);
app.get('/api/auth/me', (req, res) => res.json({ admin: auth.isAdmin(req), demoPassword: auth.usingDemoPassword }));

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use('/vendor', express.static(path.join(__dirname, '..', 'public', 'vendor'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: 0 }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Resolves once the tables are confirmed to exist (Vercel awaits this on each cold start).
const ready = init();

module.exports = app;
module.exports.ready = ready;

// Locally / on a normal host: start listening. On Vercel the exported app is used instead.
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  ready.then(() => {
    app.listen(port, () => {
      console.log(`Gurukrupa Electrical running on http://localhost:${port}`);
      if (!storage.enabled) console.log('NOTE: photo uploads are off (SUPABASE_URL / SUPABASE_ANON_KEY not set).');
      if (auth.usingDemoPassword) console.log('NOTE: using the DEMO admin password. Set ADMIN_PASSWORD before going public.');
    });
  }, (e) => {
    console.error('Could not start:', e.message);
    process.exit(1);
  });
}

const crypto = require('node:crypto');

// Demo password from the brief. Set ADMIN_PASSWORD in the environment to change it.
// In production the server refuses to start with the demo password (see index.js).
const DEMO_PASSWORD = '87654321';
const PASSWORD = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
const usingDemoPassword = PASSWORD === DEMO_PASSWORD;

const COOKIE = 'gk_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
// Sessions are signed tokens (expiry + HMAC of the password), so they work across serverless instances.
// Changing ADMIN_PASSWORD logs every admin out.
function sign(exp) {
  return crypto.createHmac('sha256', PASSWORD).update('gk-session:' + exp).digest('hex');
}

const attempts = new Map(); // ip -> { n, until }
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function isAdmin(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(exp));
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Please log in as admin.' });
  res.set('Cache-Control', 'no-store');
  next();
}

function login(req, res) {
  const ip = req.ip;
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) {
    return res.status(429).json({ error: 'Too many wrong attempts. Wait a minute and try again.' });
  }
  if (!safeEqual(req.body?.password ?? '', PASSWORD)) {
    const n = (a && a.until > Date.now() - LOCK_MS ? a.n : 0) + 1;
    attempts.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return res.status(401).json({ error: 'Wrong password.' });
  }
  attempts.delete(ip);
  const exp = Date.now() + SESSION_MS;
  const token = `${exp}.${sign(exp)}`;
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`);
  res.json({ ok: true });
}

function logout(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
}

module.exports = { isAdmin, requireAdmin, login, logout, usingDemoPassword };

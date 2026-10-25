class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

const UNITS = ['Nos', 'Pkt', 'Mtr', 'Box', 'Set', 'Coil', 'Roll', 'Kg'];
const WHOLE_UNITS = new Set(['Nos', 'Pkt', 'Box', 'Set', 'Coil', 'Roll']);
const MAX_NUM = 10_000_000;

function text(v, label, { max = 120, required = false } = {}) {
  const s = v == null ? '' : String(v).trim().replace(/\s+/g, ' ');
  if (required && !s) throw bad(`${label} is required.`);
  if (s.length > max) throw bad(`${label} is too long (max ${max} characters).`);
  return s;
}

// '' / null / undefined -> null (means "not set"). Otherwise a number >= 0 with at most 2 decimals.
function num(v, label, { whole = false } = {}) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw bad(`${label} must be a number.`);
  if (n < 0) throw bad(`${label} cannot be negative.`);
  if (n > MAX_NUM) throw bad(`${label} is too large.`);
  if (whole && !Number.isInteger(n)) throw bad(`${label} must be a whole number for this unit.`);
  return Math.round(n * 100) / 100;
}

// Strictly positive number (for quantities in sales / receipts)
function positive(v, label, { whole = false } = {}) {
  const n = num(v, label, { whole });
  if (n == null || n <= 0) throw bad(`${label} must be greater than zero.`);
  return n;
}

function dateStr(v) {
  if (v == null || v === '') return today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad('Date is not valid.');
  return v;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = { HttpError, bad, text, num, positive, dateStr, today, UNITS, WHOLE_UNITS };

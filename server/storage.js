// Product photos live in a public Supabase Storage bucket. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';

const enabled = !!(BASE && KEY);
const headers = (extra = {}) => ({ Authorization: `Bearer ${KEY}`, apikey: KEY, ...extra });

async function ensureBucket() {
  if (!enabled) return;
  const res = await fetch(`${BASE}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (!/already exists|Duplicate/i.test(text)) throw new Error(`Could not prepare the photo bucket (${res.status}): ${text}`);
  }
}

async function upload(file, buffer, contentType) {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${file}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer,
  });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status}).`);
}

async function remove(file) {
  if (!enabled || !file) return;
  await fetch(`${BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [file] }),
  }).catch(() => {});
}

const publicUrl = (file) => (file ? `${BASE}/storage/v1/object/public/${BUCKET}/${file}` : null);

module.exports = { enabled, ensureBucket, upload, remove, publicUrl };

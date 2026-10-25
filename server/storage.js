// Product photos live in the public Supabase Storage bucket "product-images" (created by supabase/schema.sql).
const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';

const enabled = !!(BASE && KEY);
const headers = (extra = {}) => ({ Authorization: `Bearer ${KEY}`, apikey: KEY, ...extra });

async function upload(file, buffer, contentType) {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${file}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Photo upload failed (${res.status}). ${/bucket not found/i.test(text) ? 'Run supabase/schema.sql to create the photo bucket.' : ''}`.trim());
  }
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

module.exports = { enabled, upload, remove, publicUrl };

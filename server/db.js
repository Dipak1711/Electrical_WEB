// Supabase, reached through its normal REST API with just SUPABASE_URL + SUPABASE_ANON_KEY (server side only).
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are not set. Copy .env.example to .env and fill them in.');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Throws a readable error (with the Postgres error code on .pg) instead of returning { error }
async function unwrap(query) {
  const { data, error, count } = await query;
  if (error) {
    const e = new Error(error.message || 'Database error');
    e.pg = error.code;
    throw e;
  }
  return count != null && data == null ? count : data;
}
const countOf = async (query) => {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
};

// Supabase returns at most 1000 rows per request, so read big tables page by page.
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await unwrap(build().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const isUniqueViolation = (e) => e && e.pg === '23505';

async function nextCode() {
  const rows = await unwrap(sb.from('products').select('code').like('code', 'GK-%').order('code', { ascending: false }).limit(1));
  const n = rows.length ? parseInt(rows[0].code.slice(3), 10) + 1 : 1;
  return 'GK-' + String(n).padStart(4, '0');
}

// Called at startup: tells the owner clearly if the tables have not been created yet.
async function init() {
  const { error } = await sb.from('products').select('id').limit(1);
  if (error) {
    if (/relation|does not exist|schema cache|Could not find/i.test(error.message)) {
      throw new Error('The tables are not created yet. Open Supabase > SQL Editor and run the file supabase/schema.sql.');
    }
    throw new Error(error.message);
  }
}

module.exports = { sb, unwrap, countOf, fetchAll, nextCode, init, isUniqueViolation };

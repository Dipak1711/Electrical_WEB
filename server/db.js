// Postgres (Supabase). The connection string comes from DATABASE_URL.
const { Pool, types } = require('pg');

types.setTypeParser(20, (v) => parseInt(v, 10)); // COUNT(*) etc. arrive as numbers

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase details.');
  process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false }, max: 5 });
pool.on('error', (e) => console.error('Database connection error:', e.message));

// "?" placeholders are written in the SQL and turned into $1, $2... here
const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
};
const api = (client) => ({
  all: async (sql, ...args) => (await client.query(toPg(sql), args)).rows,
  get: async (sql, ...args) => (await client.query(toPg(sql), args)).rows[0],
  run: async (sql, ...args) => {
    const r = await client.query(toPg(sql), args);
    return { changes: r.rowCount, rows: r.rows };
  },
});
const D = api(pool);

// Runs fn(d) in one transaction; d has the same all/get/run helpers bound to that transaction.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(api(client));
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function nextCode(d = D) {
  const row = await d.get("SELECT code FROM products WHERE code ~ '^GK-[0-9]+$' ORDER BY substr(code, 4)::int DESC LIMIT 1");
  const n = row ? parseInt(row.code.slice(3), 10) + 1 : 1;
  return 'GK-' + String(n).padStart(4, '0');
}

const TABLES = ['categories', 'subcategories', 'products', 'stock_movements'];

async function init() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'box',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq ON categories (lower(name));
CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_name_uq ON subcategories (category_id, lower(name));
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code TEXT,                                -- our own code, e.g. GK-0001
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  subcategory_id INTEGER REFERENCES subcategories(id),
  unit TEXT NOT NULL DEFAULT 'Nos',
  cost_price DOUBLE PRECISION,              -- private
  sell_price DOUBLE PRECISION,
  stock DOUBLE PRECISION,                   -- NULL = not set
  min_stock DOUBLE PRECISION,
  target_stock DOUBLE PRECISION,
  reorder_qty DOUBLE PRECISION,
  supplier TEXT NOT NULL DEFAULT '',
  last_purchase_price DOUBLE PRECISION,
  image TEXT,                               -- file name inside the Supabase Storage bucket
  keywords TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_code_uq ON products (lower(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_cat ON products (category_id, subcategory_id);
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('received','sold','adjustment')),
  qty_change DOUBLE PRECISION NOT NULL,
  balance_after DOUBLE PRECISION NOT NULL,
  unit_price DOUBLE PRECISION,
  supplier TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,                       -- YYYY-MM-DD
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON stock_movements (product_id, id);
CREATE INDEX IF NOT EXISTS idx_mov_date ON stock_movements (date, id);
`);
  // Supabase exposes tables to the public "anon" key through its own API. Row level security with no policies
  // means that key can read nothing, so purchase prices stay private. This server connects as the owner and is not affected.
  for (const t of TABLES) await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
  await pool.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON ${TABLES.join(', ')} FROM anon, authenticated';
    END IF; END $$;`);
}

const isUniqueViolation = (e) => e && e.code === '23505';

module.exports = { pool, D, tx, nextCode, init, isUniqueViolation, TABLES };

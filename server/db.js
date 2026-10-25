const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'gurukrupa.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  icon TEXT NOT NULL DEFAULT 'box',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL COLLATE NOCASE,
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE COLLATE NOCASE,          -- our own code, e.g. GK-0001
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',           -- model number / product code from the maker
  spec TEXT NOT NULL DEFAULT '',            -- specification shown to customers
  category_id INTEGER REFERENCES categories(id),
  subcategory_id INTEGER REFERENCES subcategories(id),
  unit TEXT NOT NULL DEFAULT 'Nos',
  cost_price REAL,                          -- private
  sell_price REAL,
  stock REAL,                               -- NULL = not set
  min_stock REAL,                           -- private
  target_stock REAL,                        -- private
  reorder_qty REAL,                         -- private, manual override of the suggestion
  supplier TEXT NOT NULL DEFAULT '',        -- private
  last_purchase_price REAL,                 -- private
  image TEXT,
  keywords TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',           -- private
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id, subcategory_id);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('received','sold','adjustment')),
  qty_change REAL NOT NULL,                 -- + in, - out
  balance_after REAL NOT NULL,
  unit_price REAL,                          -- selling price for sales, purchase price for receipts
  supplier TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,                       -- YYYY-MM-DD, chosen by the user
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON stock_movements(product_id, id);
CREATE INDEX IF NOT EXISTS idx_mov_date ON stock_movements(date, id);
`);

// Run fn inside a transaction; rolls back on any error.
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function nextCode() {
  const row = db.prepare("SELECT code FROM products WHERE code GLOB 'GK-[0-9]*' ORDER BY CAST(SUBSTR(code, 4) AS INTEGER) DESC LIMIT 1").get();
  const n = row ? parseInt(row.code.slice(3), 10) + 1 : 1;
  return 'GK-' + String(n).padStart(4, '0');
}

module.exports = { db, tx, nextCode, DATA_DIR };

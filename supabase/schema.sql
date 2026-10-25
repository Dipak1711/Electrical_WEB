-- Gurukrupa Electrical: Supabase schema.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run more than once.

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

-- Lock the tables: Supabase's public "anon"/"authenticated" keys get NO access, so purchase prices and stock stay private.
-- (Our server connects with the database owner login, which is not affected by this.)
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON categories, subcategories, products, stock_movements FROM anon, authenticated;

-- Public bucket for product photos (reading is public, uploading only happens from our server).
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

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
  cost_price DOUBLE PRECISION,              -- private (purchase price)
  sell_price DOUBLE PRECISION,
  stock DOUBLE PRECISION,                   -- NULL = not set
  min_stock DOUBLE PRECISION,
  target_stock DOUBLE PRECISION,
  reorder_qty DOUBLE PRECISION,
  supplier TEXT NOT NULL DEFAULT '',
  last_purchase_price DOUBLE PRECISION,
  image TEXT,                               -- file name inside the product-images bucket
  keywords TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_code_uq ON products (lower(code)) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_identity_uq ON products (lower(name), lower(brand), lower(model), lower(spec));
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

-- Stock changes happen inside the database in one step, so two sales at the same moment can never sell the same stock twice.
CREATE OR REPLACE FUNCTION gk_move_stock(
  p_id integer, p_type text, p_qty double precision, p_price double precision,
  p_supplier text, p_note text, p_date text, p_update_cost boolean, p_target double precision
) RETURNS products LANGUAGE plpgsql AS $$
DECLARE r products; bal double precision; chg double precision;
BEGIN
  SELECT * INTO r FROM products WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GK_NOT_FOUND'; END IF;
  IF p_type = 'sold' THEN
    IF r.stock IS NULL THEN RAISE EXCEPTION 'GK_STOCK_UNSET'; END IF;
    IF p_qty > r.stock THEN RAISE EXCEPTION 'GK_INSUFFICIENT:%', r.stock; END IF;
    chg := -p_qty;
    bal := round((r.stock - p_qty)::numeric, 2);
    UPDATE products SET stock = bal, updated_at = now() WHERE id = p_id;
    INSERT INTO stock_movements (product_id, type, qty_change, balance_after, unit_price, supplier, note, date)
      VALUES (p_id, 'sold', chg, bal, p_price, '', p_note, p_date);
  ELSIF p_type = 'received' THEN
    chg := p_qty;
    bal := round((coalesce(r.stock, 0) + p_qty)::numeric, 2);
    UPDATE products SET stock = bal, supplier = p_supplier,
      last_purchase_price = coalesce(p_price, last_purchase_price),
      cost_price = CASE WHEN p_update_cost AND p_price IS NOT NULL THEN p_price ELSE cost_price END,
      updated_at = now() WHERE id = p_id;
    INSERT INTO stock_movements (product_id, type, qty_change, balance_after, unit_price, supplier, note, date)
      VALUES (p_id, 'received', chg, bal, p_price, p_supplier, p_note, p_date);
  ELSIF p_type = 'adjustment' THEN
    bal := round(p_target::numeric, 2);
    chg := round((bal - coalesce(r.stock, 0))::numeric, 2);
    UPDATE products SET stock = bal, updated_at = now() WHERE id = p_id;
    INSERT INTO stock_movements (product_id, type, qty_change, balance_after, unit_price, supplier, note, date)
      VALUES (p_id, 'adjustment', chg, bal, NULL, '', p_note, p_date);
  ELSE
    RAISE EXCEPTION 'GK_BAD_TYPE';
  END IF;
  SELECT * INTO r FROM products WHERE id = p_id;
  RETURN r;
END $$;

-- used once by the data migration so new rows get fresh ids (runs with owner rights because moving a counter needs them)
CREATE OR REPLACE FUNCTION gk_reset_sequences() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('categories', 'id'), coalesce((SELECT max(id) FROM categories), 1));
  PERFORM setval(pg_get_serial_sequence('subcategories', 'id'), coalesce((SELECT max(id) FROM subcategories), 1));
  PERFORM setval(pg_get_serial_sequence('products', 'id'), coalesce((SELECT max(id) FROM products), 1));
  PERFORM setval(pg_get_serial_sequence('stock_movements', 'id'), coalesce((SELECT max(id) FROM stock_movements), 1));
END $$;

-- Access: the server talks to Supabase with the anon key, so the anon role needs access to these tables.
-- IMPORTANT: that means anyone who has your anon key can read/write them. Keep the key only in the server's .env file
-- and never put it in website code or share it. The website itself never receives it; customers only get data through our server.
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gk_anon_all ON categories;
DROP POLICY IF EXISTS gk_anon_all ON subcategories;
DROP POLICY IF EXISTS gk_anon_all ON products;
DROP POLICY IF EXISTS gk_anon_all ON stock_movements;
CREATE POLICY gk_anon_all ON categories      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY gk_anon_all ON subcategories   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY gk_anon_all ON products        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY gk_anon_all ON stock_movements FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON categories, subcategories, products, stock_movements TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION gk_move_stock(integer, text, double precision, double precision, text, text, text, boolean, double precision) TO anon;
GRANT EXECUTE ON FUNCTION gk_reset_sequences() TO anon;

-- Photos: public bucket (anyone can view a photo by its link); our server uploads and deletes with the same key.
DO $$ BEGIN
  IF to_regnamespace('storage') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
    DROP POLICY IF EXISTS gk_images_anon ON storage.objects;
    CREATE POLICY gk_images_anon ON storage.objects FOR ALL TO anon
      USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

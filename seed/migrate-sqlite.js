// One-time copy of the old local database (data/gurukrupa.db) into Supabase/Postgres, keeping ids, prices, stock and history.
//   node --env-file=.env seed/migrate-sqlite.js [path/to/gurukrupa.db]
// Only runs into an EMPTY database, and never changes or deletes the local file.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { D, tx, init, pool, TABLES } = require('../server/db');

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'gurukrupa.db');

(async () => {
  if (!fs.existsSync(file)) throw new Error('Local database not found: ' + file);
  await init();
  const have = (await D.get('SELECT COUNT(*) AS n FROM products')).n + (await D.get('SELECT COUNT(*) AS n FROM categories')).n;
  if (have > 0) throw new Error('Supabase already has data - nothing copied (existing data is never overwritten).');

  const src = new DatabaseSync(file, { readOnly: true });
  const rows = (t) => src.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
  const insert = async (t, table, list, cols) => {
    for (const r of list) await t.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((c) => r[c] ?? null));
  };
  const counts = {};
  await tx(async (t) => {
    const cats = rows('categories');
    await insert(t, 'categories', cats, ['id', 'name', 'icon', 'sort']);
    const subs = rows('subcategories');
    await insert(t, 'subcategories', subs, ['id', 'category_id', 'name', 'sort']);
    const prods = rows('products').map((p) => ({ ...p, image: null })); // local photos are not copied; re-upload them in Admin
    await insert(t, 'products', prods, ['id', 'code', 'name', 'brand', 'model', 'spec', 'category_id', 'subcategory_id', 'unit', 'cost_price', 'sell_price', 'stock', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'image', 'keywords', 'notes', 'active']);
    const mov = rows('stock_movements');
    await insert(t, 'stock_movements', mov, ['id', 'product_id', 'type', 'qty_change', 'balance_after', 'unit_price', 'supplier', 'note', 'date']);
    Object.assign(counts, { categories: cats.length, subcategories: subs.length, products: prods.length, stock_movements: mov.length });
    for (const table of TABLES) await t.run(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
  });
  console.log('Copied to Supabase:', counts);
  const photos = src.prepare('SELECT COUNT(*) AS n FROM products WHERE image IS NOT NULL').get().n;
  if (photos) console.log(`Note: ${photos} product photo(s) were not copied - upload them again in Admin.`);
  console.log('You can now stop using the local data/ folder (it was not changed or deleted).');
})()
  .catch((e) => {
    console.error('Migration stopped:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

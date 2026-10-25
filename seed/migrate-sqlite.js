// One-time copy of the old local database (data/gurukrupa.db) into Supabase, keeping ids, prices, stock and history.
//   npm run migrate            (or: node --env-file=.env seed/migrate-sqlite.js [path/to/gurukrupa.db])
// Only runs into an EMPTY Supabase, and never changes or deletes the local file.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { sb, unwrap, countOf, init } = require('../server/db');

const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'gurukrupa.db');
const chunks = (arr, n = 100) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

(async () => {
  await init();
  if (process.argv.includes('--sequences-only')) {
    await unwrap(sb.rpc('gk_reset_sequences'));
    console.log('Id counters reset.');
    return;
  }
  if (!fs.existsSync(file)) throw new Error('Local database not found: ' + file);
  const have = (await countOf(sb.from('products').select('id', { count: 'exact', head: true }))) + (await countOf(sb.from('categories').select('id', { count: 'exact', head: true })));
  if (have > 0) throw new Error('Supabase already has data - nothing copied (existing data is never overwritten).');

  const src = new DatabaseSync(file, { readOnly: true });
  const rows = (t) => src.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
  const copy = async (table, list, cols) => {
    const clean = list.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
    for (const part of chunks(clean)) await unwrap(sb.from(table).insert(part));
    return list.length;
  };
  const counts = {};
  counts.categories = await copy('categories', rows('categories'), ['id', 'name', 'icon', 'sort']);
  counts.subcategories = await copy('subcategories', rows('subcategories'), ['id', 'category_id', 'name', 'sort']);
  // local photos are not copied; re-upload them in Admin
  const prods = rows('products').map((p) => ({ ...p, image: null }));
  counts.products = await copy('products', prods, ['id', 'code', 'name', 'brand', 'model', 'spec', 'category_id', 'subcategory_id', 'unit', 'cost_price', 'sell_price', 'stock', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'image', 'keywords', 'notes', 'active']);
  counts.stock_movements = await copy('stock_movements', rows('stock_movements'), ['id', 'product_id', 'type', 'qty_change', 'balance_after', 'unit_price', 'supplier', 'note', 'date']);
  try {
    await unwrap(sb.rpc('gk_reset_sequences'));
  } catch (e) {
    console.log('Data was copied, but the id counters could not be reset (' + e.message + ').\nRun supabase/schema.sql again in the SQL Editor, then: npm run migrate -- --sequences-only');
    process.exitCode = 1;
  }
  console.log('Copied to Supabase:', counts);
  const photos = src.prepare('SELECT COUNT(*) AS n FROM products WHERE image IS NOT NULL').get().n;
  if (photos) console.log(`Note: ${photos} product photo(s) were not copied - upload them again in Admin.`);
  console.log('You can now stop using the local data/ folder (it was not changed or deleted).');
})().catch((e) => {
  console.error('Migration stopped:', e.message);
  process.exitCode = 1;
});

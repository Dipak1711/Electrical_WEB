// Imports the starting catalogue. Safe to run repeatedly: it refuses to touch a database that already has products.
//   node seed/run.js          import (only if the products table is empty)
//   node seed/run.js --report print the import report only
const fs = require('node:fs');
const path = require('node:path');
const { taxonomy, build } = require('./data');

const items = build();

function report() {
  const noCost = items.filter((i) => i.cost_price == null).length;
  const noSell = items.filter((i) => i.sell_price == null).length;
  const review = items.filter((i) => i.review);
  const keyCount = new Map();
  items.forEach((i) => {
    const k = [i.name, i.brand, i.spec].join('|').toLowerCase();
    keyCount.set(k, (keyCount.get(k) || 0) + 1);
  });
  const dups = [...keyCount].filter(([, n]) => n > 1);
  const lines = [
    `Products: ${items.length}`,
    `Categories: ${taxonomy.length}, subcategories: ${taxonomy.reduce((a, c) => a + c.subs.length, 0)}`,
    `Without purchase price: ${noCost}`,
    `Without selling price: ${noSell}`,
    `Stock quantity / minimum stock / supplier: not in the sheet, left unset for all`,
    `Exact duplicates (same name+brand+spec): ${dups.length}`,
    '',
    'Entries to double-check:',
    ...review.map((i) => `  - ${i.name}: ${i.review}`),
  ];
  return lines.join('\n');
}

if (process.argv.includes('--report')) {
  console.log(report());
  process.exit(0);
}

const { sb, unwrap, countOf, init } = require('../server/db');

const chunks = (arr, n = 100) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

(async () => {
  await init();
  const existing = await countOf(sb.from('products').select('id', { count: 'exact', head: true }));
  if (existing > 0) {
    console.log(`Database already has ${existing} products - nothing imported (existing data is never overwritten).`);
    return;
  }
  const catIds = new Map();
  const subIds = new Map();
  for (const [ci, c] of taxonomy.entries()) {
    const cat = await unwrap(sb.from('categories').insert({ name: c.name, icon: c.icon, sort: ci }).select('id').single());
    catIds.set(c.name, cat.id);
    for (const [si, s] of c.subs.entries()) {
      const sub = await unwrap(sb.from('subcategories').insert({ category_id: cat.id, name: s, sort: si }).select('id').single());
      subIds.set(c.name + '|' + s, sub.id);
    }
  }
  const rows = items.map((i, n) => ({
    code: 'GK-' + String(n + 1).padStart(4, '0'), name: i.name, brand: i.brand, spec: i.spec,
    category_id: catIds.get(i.category), subcategory_id: subIds.get(i.category + '|' + i.subcategory),
    unit: i.unit, cost_price: i.cost_price, sell_price: i.sell_price, notes: i.notes,
  }));
  for (const part of chunks(rows)) await unwrap(sb.from('products').insert(part));
  const text = report();
  fs.writeFileSync(path.join(__dirname, '..', 'IMPORT_REPORT.txt'), text + '\n');
  console.log('Import complete.\n' + text);
})().catch((e) => {
  console.error('Import failed:', e.message);
  process.exitCode = 1;
});

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

const { D, tx, nextCode, init, pool } = require('../server/db');

(async () => {
  await init();
  const existing = (await D.get('SELECT COUNT(*) AS n FROM products')).n;
  if (existing > 0) {
    console.log(`Database already has ${existing} products - nothing imported (existing data is never overwritten).`);
    return;
  }
  await tx(async (t) => {
    const catIds = new Map();
    const subIds = new Map();
    for (const [ci, c] of taxonomy.entries()) {
      const cat = await t.get('INSERT INTO categories (name, icon, sort) VALUES (?,?,?) RETURNING id', c.name, c.icon, ci);
      catIds.set(c.name, cat.id);
      for (const [si, s] of c.subs.entries()) {
        const sub = await t.get('INSERT INTO subcategories (category_id, name, sort) VALUES (?,?,?) RETURNING id', cat.id, s, si);
        subIds.set(c.name + '|' + s, sub.id);
      }
    }
    for (const i of items) {
      await t.run(
        `INSERT INTO products (code, name, brand, spec, category_id, subcategory_id, unit, cost_price, sell_price, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        await nextCode(t), i.name, i.brand, i.spec, catIds.get(i.category), subIds.get(i.category + '|' + i.subcategory), i.unit, i.cost_price, i.sell_price, i.notes
      );
    }
  });
  const text = report();
  fs.writeFileSync(path.join(__dirname, '..', 'IMPORT_REPORT.txt'), text + '\n');
  console.log('Import complete.\n' + text);
})()
  .catch((e) => {
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

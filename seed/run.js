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

const { db, tx, nextCode } = require('../server/db');
const existing = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (existing > 0) {
  console.log(`Database already has ${existing} products - nothing imported (existing data is never overwritten).`);
  process.exit(0);
}

tx(() => {
  const catIds = new Map();
  const subIds = new Map();
  taxonomy.forEach((c, ci) => {
    const { lastInsertRowid } = db.prepare('INSERT INTO categories (name, icon, sort) VALUES (?,?,?)').run(c.name, c.icon, ci);
    catIds.set(c.name, Number(lastInsertRowid));
    c.subs.forEach((s, si) => {
      const r = db.prepare('INSERT INTO subcategories (category_id, name, sort) VALUES (?,?,?)').run(Number(lastInsertRowid), s, si);
      subIds.set(c.name + '|' + s, Number(r.lastInsertRowid));
    });
  });
  const ins = db.prepare(`INSERT INTO products (code, name, brand, spec, category_id, subcategory_id, unit, cost_price, sell_price, notes, last_purchase_price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const i of items) {
    ins.run(nextCode(), i.name, i.brand, i.spec, catIds.get(i.category), subIds.get(i.category + '|' + i.subcategory), i.unit, i.cost_price, i.sell_price, i.notes, null);
  }
});

const text = report();
fs.writeFileSync(path.join(__dirname, '..', 'IMPORT_REPORT.txt'), text + '\n');
console.log('Import complete.\n' + text);

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { db, tx, nextCode, DATA_DIR } = require('./db');
const { requireAdmin } = require('./auth');
const V = require('./validate');

const { bad, HttpError } = V;
const UPLOADS = path.join(DATA_DIR, 'uploads');

// ---------------------------------------------------------------- public (customers)
// Only fields meant for customers, and only active products (priced or not). Purchase price, minimum stock, supplier and notes never leave the admin routes.
const publicRouter = express.Router();

function categoriesTree() {
  const cats = db.prepare('SELECT id, name, icon FROM categories ORDER BY sort, name').all();
  const subs = db.prepare('SELECT id, category_id, name FROM subcategories ORDER BY sort, name').all();
  return cats.map((c) => ({ ...c, subcategories: subs.filter((s) => s.category_id === c.id).map(({ id, name }) => ({ id, name })) }));
}

publicRouter.get('/catalog', (req, res) => {
  const products = db
    .prepare(
      `SELECT id, name, brand, model, spec, category_id, subcategory_id, unit, sell_price, stock, image, keywords
       FROM products WHERE active = 1 ORDER BY name COLLATE NOCASE`
    )
    .all();
  res.json({ categories: categoriesTree(), products });
});

// ---------------------------------------------------------------- admin
const admin = express.Router();
admin.use(requireAdmin);

const PRODUCT_COLS = `id, code, name, brand, model, spec, category_id, subcategory_id, unit, cost_price, sell_price,
  stock, min_stock, target_stock, reorder_qty, supplier, last_purchase_price, image, keywords, notes, active, updated_at`;

function getProduct(id) {
  const p = db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).get(id);
  if (!p) throw new HttpError(404, 'Product not found.');
  return p;
}

admin.get('/catalog', (req, res) => {
  const products = db.prepare(`SELECT ${PRODUCT_COLS} FROM products ORDER BY name COLLATE NOCASE`).all();
  res.json({ categories: categoriesTree(), products });
});

function cleanProduct(b, existing) {
  const unit = V.text(b.unit ?? existing?.unit ?? 'Nos', 'Unit', { max: 10 });
  if (!V.UNITS.includes(unit)) throw bad(`Unit must be one of: ${V.UNITS.join(', ')}.`);
  const whole = V.WHOLE_UNITS.has(unit);
  const p = {
    code: V.text(b.code, 'Product code', { max: 30 }),
    name: V.text(b.name, 'Product name', { required: true }),
    brand: V.text(b.brand, 'Brand', { max: 60 }),
    model: V.text(b.model, 'Model / code', { max: 60 }),
    spec: V.text(b.spec, 'Specification', { max: 200 }),
    unit,
    cost_price: V.num(b.cost_price, 'Purchase price'),
    sell_price: V.num(b.sell_price, 'Selling price'),
    stock: V.num(b.stock, 'Stock', { whole }),
    min_stock: V.num(b.min_stock, 'Minimum stock', { whole }),
    target_stock: V.num(b.target_stock, 'Target stock', { whole }),
    reorder_qty: V.num(b.reorder_qty, 'Reorder quantity', { whole }),
    supplier: V.text(b.supplier, 'Supplier', { max: 80 }),
    last_purchase_price: V.num(b.last_purchase_price, 'Last purchase price'),
    keywords: V.text(b.keywords, 'Search keywords', { max: 200 }),
    notes: V.text(b.notes, 'Notes', { max: 500 }),
    active: b.active === false || b.active === 0 ? 0 : 1,
    category_id: b.category_id ? Number(b.category_id) : null,
    subcategory_id: b.subcategory_id ? Number(b.subcategory_id) : null,
  };
  if (p.target_stock != null && p.min_stock != null && p.target_stock < p.min_stock) throw bad('Target stock cannot be lower than minimum stock.');
  if (p.category_id && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(p.category_id)) throw bad('Category not found.');
  if (p.subcategory_id) {
    const s = db.prepare('SELECT category_id FROM subcategories WHERE id = ?').get(p.subcategory_id);
    if (!s) throw bad('Subcategory not found.');
    if (s.category_id !== p.category_id) throw bad('That subcategory does not belong to the chosen category.');
  }
  return p;
}

// Same code, or same name + brand + model + specification, counts as a duplicate.
function assertNotDuplicate(p, selfId) {
  const self = selfId || -1;
  if (p.code) {
    const d = db.prepare('SELECT name FROM products WHERE code = ? AND id != ?').get(p.code, self);
    if (d) throw new HttpError(409, `Product code ${p.code} is already used by "${d.name}".`);
  }
  const d = db
    .prepare('SELECT code FROM products WHERE lower(name)=lower(?) AND lower(brand)=lower(?) AND lower(model)=lower(?) AND lower(spec)=lower(?) AND id != ?')
    .get(p.name, p.brand, p.model, p.spec, self);
  if (d) throw new HttpError(409, `This product already exists (${d.code}). Edit it instead, or change the brand / model / specification.`);
}

admin.post('/products', (req, res) => {
  const p = cleanProduct(req.body || {});
  const created = tx(() => {
    if (!p.code) p.code = nextCode();
    assertNotDuplicate(p);
    const r = db
      .prepare(
        `INSERT INTO products (code,name,brand,model,spec,category_id,subcategory_id,unit,cost_price,sell_price,min_stock,target_stock,reorder_qty,supplier,last_purchase_price,keywords,notes,active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(p.code, p.name, p.brand, p.model, p.spec, p.category_id, p.subcategory_id, p.unit, p.cost_price, p.sell_price, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.keywords, p.notes, p.active);
    const id = Number(r.lastInsertRowid);
    // Opening stock is recorded as a movement so the history always adds up.
    if (p.stock != null) {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(p.stock, id);
      if (p.stock > 0) addMovement(id, 'adjustment', p.stock, p.stock, null, '', 'Opening stock', V.today());
    }
    return id;
  });
  res.status(201).json(getProduct(created));
});

admin.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getProduct(id);
  const p = cleanProduct({ ...req.body, code: req.body?.code || existing.code }, existing);
  tx(() => {
    assertNotDuplicate(p, id);
    // Stock is changed through Receive / Sale / Adjust so the history stays correct; edits here never touch it.
    db.prepare(
      `UPDATE products SET code=?, name=?, brand=?, model=?, spec=?, category_id=?, subcategory_id=?, unit=?, cost_price=?, sell_price=?,
        min_stock=?, target_stock=?, reorder_qty=?, supplier=?, last_purchase_price=?, keywords=?, notes=?, active=?, updated_at=datetime('now') WHERE id=?`
    ).run(p.code, p.name, p.brand, p.model, p.spec, p.category_id, p.subcategory_id, p.unit, p.cost_price, p.sell_price, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.keywords, p.notes, p.active, id);
  });
  res.json(getProduct(id));
});

// ---- images (the browser shrinks the photo first; we still verify type and size here)
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function removeImageFile(name) {
  if (name && /^[\w.-]+$/.test(name)) fs.rm(path.join(UPLOADS, name), { force: true }, () => {});
}

admin.post('/products/:id/image', (req, res) => {
  const id = Number(req.params.id);
  const p = getProduct(id);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) throw bad('Please choose a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw bad('Image is too large (max 2 MB).');
  const file = `p${id}-${Date.now()}.${IMG_TYPES[m[1]]}`;
  fs.writeFileSync(path.join(UPLOADS, file), buf);
  db.prepare("UPDATE products SET image=?, updated_at=datetime('now') WHERE id=?").run(file, id);
  removeImageFile(p.image);
  res.json(getProduct(id));
});

admin.delete('/products/:id/image', (req, res) => {
  const id = Number(req.params.id);
  const p = getProduct(id);
  db.prepare("UPDATE products SET image=NULL, updated_at=datetime('now') WHERE id=?").run(id);
  removeImageFile(p.image);
  res.json(getProduct(id));
});

// ---- categories
admin.post('/categories', (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  try {
    const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM categories').get().n;
    const r = db.prepare('INSERT INTO categories (name, icon, sort) VALUES (?,?,?)').run(name, icon, sort);
    res.status(201).json({ id: Number(r.lastInsertRowid), name, icon });
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'A category with this name already exists.');
    throw e;
  }
});
admin.put('/categories/:id', (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  try {
    const r = db.prepare('UPDATE categories SET name=?, icon=? WHERE id=?').run(name, icon, Number(req.params.id));
    if (!r.changes) throw new HttpError(404, 'Category not found.');
    res.json({ ok: true });
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'A category with this name already exists.');
    throw e;
  }
});
admin.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT COUNT(*) n FROM products WHERE category_id=?').get(id).n;
  if (used) throw new HttpError(409, `${used} product(s) use this category. Move them first.`);
  db.prepare('DELETE FROM subcategories WHERE category_id=?').run(id);
  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  res.json({ ok: true });
});
admin.post('/subcategories', (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  const cid = Number(req.body?.category_id);
  if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(cid)) throw bad('Choose a category.');
  try {
    const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM subcategories WHERE category_id=?').get(cid).n;
    const r = db.prepare('INSERT INTO subcategories (category_id, name, sort) VALUES (?,?,?)').run(cid, name, sort);
    res.status(201).json({ id: Number(r.lastInsertRowid), category_id: cid, name });
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'This subcategory already exists in that category.');
    throw e;
  }
});
admin.put('/subcategories/:id', (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  try {
    const r = db.prepare('UPDATE subcategories SET name=? WHERE id=?').run(name, Number(req.params.id));
    if (!r.changes) throw new HttpError(404, 'Subcategory not found.');
    res.json({ ok: true });
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'This subcategory already exists in that category.');
    throw e;
  }
});
admin.delete('/subcategories/:id', (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT COUNT(*) n FROM products WHERE subcategory_id=?').get(id).n;
  if (used) throw new HttpError(409, `${used} product(s) use this subcategory. Move them first.`);
  db.prepare('DELETE FROM subcategories WHERE id=?').run(id);
  res.json({ ok: true });
});

// ---- stock: receive / sale / adjust. All three run in one transaction with the movement row.
function addMovement(productId, type, change, balance, price, supplier, note, date) {
  db.prepare('INSERT INTO stock_movements (product_id,type,qty_change,balance_after,unit_price,supplier,note,date) VALUES (?,?,?,?,?,?,?,?)').run(
    productId, type, change, balance, price, supplier, note, date
  );
}
const unitIsWhole = (p) => V.WHOLE_UNITS.has(p.unit);

admin.post('/stock/receive', (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = tx(() => {
    const p = getProduct(id);
    const qty = V.positive(b.qty, 'Quantity received', { whole: unitIsWhole(p) });
    const price = V.num(b.price, 'Purchase price');
    const supplier = V.text(b.supplier, 'Supplier', { max: 80 }) || p.supplier;
    const note = V.text(b.note, 'Note', { max: 200 });
    const date = V.dateStr(b.date);
    const balance = Math.round(((p.stock ?? 0) + qty) * 100) / 100;
    db.prepare(
      `UPDATE products SET stock=?, supplier=?, last_purchase_price=COALESCE(?, last_purchase_price),
         cost_price = CASE WHEN ? = 1 AND ? IS NOT NULL THEN ? ELSE cost_price END, updated_at=datetime('now') WHERE id=?`
    ).run(balance, supplier, price, b.update_cost ? 1 : 0, price, price, id);
    addMovement(id, 'received', qty, balance, price, supplier, note, date);
    return getProduct(id);
  });
  res.status(201).json(out);
});

admin.post('/sales', (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = tx(() => {
    const p = getProduct(id);
    if (!p.active) throw new HttpError(409, 'This product is marked inactive.');
    const qty = V.positive(b.qty, 'Quantity sold', { whole: unitIsWhole(p) });
    const price = V.num(b.price ?? p.sell_price, 'Selling price');
    if (price == null) throw bad('Enter the selling price for this sale (the product has none set).');
    if (p.stock == null) throw new HttpError(409, 'Stock for this product is not set yet. Set the current stock first (Stock > Adjust).');
    if (qty > p.stock) throw new HttpError(409, `Only ${p.stock} ${p.unit} in stock. Fix the quantity, or correct the stock with an adjustment first.`);
    const balance = Math.round((p.stock - qty) * 100) / 100;
    db.prepare("UPDATE products SET stock=?, updated_at=datetime('now') WHERE id=?").run(balance, id);
    addMovement(id, 'sold', -qty, balance, price, '', V.text(b.note, 'Note', { max: 200 }), V.dateStr(b.date));
    return getProduct(id);
  });
  res.status(201).json(out);
});

admin.post('/stock/adjust', (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = tx(() => {
    const p = getProduct(id);
    const target = Number(b.new_stock);
    if (b.new_stock === '' || b.new_stock == null || !Number.isFinite(target)) throw bad('Enter the correct stock quantity.');
    if (target < 0 && !b.allow_negative) throw bad('Stock cannot go below zero. Tick "allow negative" only if you really mean it.');
    if (unitIsWhole(p) && !Number.isInteger(target)) throw bad('Stock must be a whole number for this unit.');
    if (Math.abs(target) > 10_000_000) throw bad('Quantity is too large.');
    const note = V.text(b.note, 'Reason', { required: true, max: 200 });
    const balance = Math.round(target * 100) / 100;
    const change = Math.round((balance - (p.stock ?? 0)) * 100) / 100;
    db.prepare("UPDATE products SET stock=?, updated_at=datetime('now') WHERE id=?").run(balance, id);
    addMovement(id, 'adjustment', change, balance, null, '', note, V.dateStr(b.date));
    return getProduct(id);
  });
  res.status(201).json(out);
});

admin.get('/movements', (req, res) => {
  const where = [];
  const args = [];
  if (req.query.product_id) { where.push('m.product_id = ?'); args.push(Number(req.query.product_id)); }
  if (['received', 'sold', 'adjustment'].includes(req.query.type)) { where.push('m.type = ?'); args.push(req.query.type); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { where.push('m.date >= ?'); args.push(req.query.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { where.push('m.date <= ?'); args.push(req.query.to); }
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const rows = db
    .prepare(
      `SELECT m.id, m.product_id, p.name, p.brand, p.spec, p.unit, m.type, m.qty_change, m.balance_after, m.unit_price, m.supplier, m.note, m.date, m.created_at
       FROM stock_movements m JOIN products p ON p.id = m.product_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.date DESC, m.id DESC LIMIT ${limit}`
    )
    .all(...args);
  res.json(rows);
});

// ---- backup / export
function stamp() {
  return V.today();
}
admin.get('/export/json', (req, res) => {
  res.set('Content-Disposition', `attachment; filename="gurukrupa-backup-${stamp()}.json"`);
  res.json({
    exported_at: new Date().toISOString(),
    categories: db.prepare('SELECT * FROM categories').all(),
    subcategories: db.prepare('SELECT * FROM subcategories').all(),
    products: db.prepare('SELECT * FROM products').all(),
    stock_movements: db.prepare('SELECT * FROM stock_movements').all(),
  });
});

const csvCell = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+@-]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
admin.get('/export/csv', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.code, p.name, p.brand, p.model, p.spec, c.name AS category, s.name AS subcategory, p.unit, p.cost_price, p.sell_price,
        p.stock, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.active, p.notes
       FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN subcategories s ON s.id=p.subcategory_id ORDER BY c.sort, s.sort, p.name`
    )
    .all();
  const cols = ['code', 'name', 'brand', 'model', 'spec', 'category', 'subcategory', 'unit', 'cost_price', 'sell_price', 'stock', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'active', 'notes'];
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="gurukrupa-products-${stamp()}.csv"` });
  res.send(csv);
});

module.exports = { publicRouter, adminRouter: admin };

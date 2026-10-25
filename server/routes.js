const express = require('express');
const { D, tx, nextCode, isUniqueViolation } = require('./db');
const storage = require('./storage');
const { requireAdmin } = require('./auth');
const V = require('./validate');

const { bad, HttpError } = V;
// photos are stored in Supabase Storage; the database keeps only the file name, the API hands out the full public URL
const withImage = (p) => (p ? { ...p, image: storage.publicUrl(p.image) } : p);

// ---------------------------------------------------------------- public (customers)
// Only fields meant for customers, and only active products (priced or not). Purchase price, minimum stock, supplier and notes never leave the admin routes.
const publicRouter = express.Router();

async function categoriesTree() {
  const cats = await D.all('SELECT id, name, icon FROM categories ORDER BY sort, name');
  const subs = await D.all('SELECT id, category_id, name FROM subcategories ORDER BY sort, name');
  return cats.map((c) => ({ ...c, subcategories: subs.filter((s) => s.category_id === c.id).map(({ id, name }) => ({ id, name })) }));
}

publicRouter.get('/catalog', async (req, res) => {
  const products = await D.all(
    `SELECT id, name, brand, model, spec, category_id, subcategory_id, unit, sell_price, stock, image, keywords
     FROM products WHERE active = 1 ORDER BY lower(name)`
  );
  res.json({ categories: await categoriesTree(), products: products.map(withImage) });
});

// ---------------------------------------------------------------- admin
const admin = express.Router();
admin.use(requireAdmin);

const PRODUCT_COLS = `id, code, name, brand, model, spec, category_id, subcategory_id, unit, cost_price, sell_price,
  stock, min_stock, target_stock, reorder_qty, supplier, last_purchase_price, image, keywords, notes, active, updated_at`;

// raw = true keeps the stored file name (needed when deleting a photo)
async function getProduct(id, d = D, raw = false) {
  const p = await d.get(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`, id);
  if (!p) throw new HttpError(404, 'Product not found.');
  return raw ? p : withImage(p);
}

admin.get('/catalog', async (req, res) => {
  const products = await D.all(`SELECT ${PRODUCT_COLS} FROM products ORDER BY lower(name)`);
  res.json({ categories: await categoriesTree(), products: products.map(withImage) });
});

async function cleanProduct(b, existing, d = D) {
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
  if (p.category_id && !(await d.get('SELECT 1 AS x FROM categories WHERE id = ?', p.category_id))) throw bad('Category not found.');
  if (p.subcategory_id) {
    const s = await d.get('SELECT category_id FROM subcategories WHERE id = ?', p.subcategory_id);
    if (!s) throw bad('Subcategory not found.');
    if (s.category_id !== p.category_id) throw bad('That subcategory does not belong to the chosen category.');
  }
  return p;
}

// Same code, or same name + brand + model + specification, counts as a duplicate.
async function assertNotDuplicate(d, p, selfId) {
  const self = selfId || -1;
  if (p.code) {
    const x = await d.get('SELECT name FROM products WHERE lower(code) = lower(?) AND id != ?', p.code, self);
    if (x) throw new HttpError(409, `Product code ${p.code} is already used by "${x.name}".`);
  }
  const x = await d.get(
    'SELECT code FROM products WHERE lower(name)=lower(?) AND lower(brand)=lower(?) AND lower(model)=lower(?) AND lower(spec)=lower(?) AND id != ?',
    p.name, p.brand, p.model, p.spec, self
  );
  if (x) throw new HttpError(409, `This product already exists (${x.code}). Edit it instead, or change the brand / model / specification.`);
}

admin.post('/products', async (req, res) => {
  const created = await tx(async (t) => {
    const p = await cleanProduct(req.body || {}, undefined, t);
    if (!p.code) p.code = await nextCode(t);
    await assertNotDuplicate(t, p);
    const r = await t.get(
      `INSERT INTO products (code,name,brand,model,spec,category_id,subcategory_id,unit,cost_price,sell_price,min_stock,target_stock,reorder_qty,supplier,last_purchase_price,keywords,notes,active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      p.code, p.name, p.brand, p.model, p.spec, p.category_id, p.subcategory_id, p.unit, p.cost_price, p.sell_price, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.keywords, p.notes, p.active
    );
    // Opening stock is recorded as a movement so the history always adds up.
    if (p.stock != null) {
      await t.run('UPDATE products SET stock = ? WHERE id = ?', p.stock, r.id);
      if (p.stock > 0) await addMovement(t, r.id, 'adjustment', p.stock, p.stock, null, '', 'Opening stock', V.today());
    }
    return r.id;
  });
  res.status(201).json(await getProduct(created));
});

admin.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  await tx(async (t) => {
    const existing = await getProduct(id, t);
    const p = await cleanProduct({ ...req.body, code: req.body?.code || existing.code }, existing, t);
    await assertNotDuplicate(t, p, id);
    // Stock is changed through Receive / Sale / Adjust so the history stays correct; edits here never touch it.
    await t.run(
      `UPDATE products SET code=?, name=?, brand=?, model=?, spec=?, category_id=?, subcategory_id=?, unit=?, cost_price=?, sell_price=?,
        min_stock=?, target_stock=?, reorder_qty=?, supplier=?, last_purchase_price=?, keywords=?, notes=?, active=?, updated_at=now() WHERE id=?`,
      p.code, p.name, p.brand, p.model, p.spec, p.category_id, p.subcategory_id, p.unit, p.cost_price, p.sell_price, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.keywords, p.notes, p.active, id
    );
  });
  res.json(await getProduct(id));
});

// ---- images (the browser shrinks the photo first; we still verify type and size here)
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

admin.post('/products/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const old = await getProduct(id, D, true);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) throw bad('Please choose a JPG, PNG or WebP image.');
  if (!storage.enabled) throw new HttpError(503, 'Photo storage is not set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw bad('Image is too large (max 2 MB).');
  const file = `p${id}-${Date.now()}.${IMG_TYPES[m[1]]}`;
  try {
    await storage.upload(file, buf, m[1]);
  } catch (e) {
    throw new HttpError(502, e.message);
  }
  await D.run('UPDATE products SET image=?, updated_at=now() WHERE id=?', file, id);
  await storage.remove(old.image);
  res.json(await getProduct(id));
});

admin.delete('/products/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const old = await getProduct(id, D, true);
  await D.run('UPDATE products SET image=NULL, updated_at=now() WHERE id=?', id);
  await storage.remove(old.image);
  res.json(await getProduct(id));
});

// ---- categories
const uniqueOr409 = (msg) => (e) => {
  throw isUniqueViolation(e) ? new HttpError(409, msg) : e;
};

admin.post('/categories', async (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  const sort = (await D.get('SELECT COALESCE(MAX(sort),0)+1 AS n FROM categories')).n;
  const r = await D.get('INSERT INTO categories (name, icon, sort) VALUES (?,?,?) RETURNING id', name, icon, sort).catch(uniqueOr409('A category with this name already exists.'));
  res.status(201).json({ id: r.id, name, icon });
});
admin.put('/categories/:id', async (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  const r = await D.run('UPDATE categories SET name=?, icon=? WHERE id=?', name, icon, Number(req.params.id)).catch(uniqueOr409('A category with this name already exists.'));
  if (!r.changes) throw new HttpError(404, 'Category not found.');
  res.json({ ok: true });
});
admin.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const used = (await D.get('SELECT COUNT(*) AS n FROM products WHERE category_id=?', id)).n;
  if (used) throw new HttpError(409, `${used} product(s) use this category. Move them first.`);
  await tx(async (t) => {
    await t.run('DELETE FROM subcategories WHERE category_id=?', id);
    await t.run('DELETE FROM categories WHERE id=?', id);
  });
  res.json({ ok: true });
});
admin.post('/subcategories', async (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  const cid = Number(req.body?.category_id);
  if (!(await D.get('SELECT 1 AS x FROM categories WHERE id=?', cid))) throw bad('Choose a category.');
  const sort = (await D.get('SELECT COALESCE(MAX(sort),0)+1 AS n FROM subcategories WHERE category_id=?', cid)).n;
  const r = await D.get('INSERT INTO subcategories (category_id, name, sort) VALUES (?,?,?) RETURNING id', cid, name, sort).catch(uniqueOr409('This subcategory already exists in that category.'));
  res.status(201).json({ id: r.id, category_id: cid, name });
});
admin.put('/subcategories/:id', async (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  const r = await D.run('UPDATE subcategories SET name=? WHERE id=?', name, Number(req.params.id)).catch(uniqueOr409('This subcategory already exists in that category.'));
  if (!r.changes) throw new HttpError(404, 'Subcategory not found.');
  res.json({ ok: true });
});
admin.delete('/subcategories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const used = (await D.get('SELECT COUNT(*) AS n FROM products WHERE subcategory_id=?', id)).n;
  if (used) throw new HttpError(409, `${used} product(s) use this subcategory. Move them first.`);
  await D.run('DELETE FROM subcategories WHERE id=?', id);
  res.json({ ok: true });
});

// ---- stock: receive / sale / adjust. All three run in one transaction with the movement row.
async function addMovement(t, productId, type, change, balance, price, supplier, note, date) {
  await t.run('INSERT INTO stock_movements (product_id,type,qty_change,balance_after,unit_price,supplier,note,date) VALUES (?,?,?,?,?,?,?,?)', productId, type, change, balance, price, supplier, note, date);
}
const unitIsWhole = (p) => V.WHOLE_UNITS.has(p.unit);
// lock the product row so two simultaneous sales cannot both pass the stock check
const lockProduct = (t, id) => t.get(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ? FOR UPDATE`, id).then((p) => {
  if (!p) throw new HttpError(404, 'Product not found.');
  return p;
});

admin.post('/stock/receive', async (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = await tx(async (t) => {
    const p = await lockProduct(t, id);
    const qty = V.positive(b.qty, 'Quantity received', { whole: unitIsWhole(p) });
    const price = V.num(b.price, 'Purchase price');
    const supplier = V.text(b.supplier, 'Supplier', { max: 80 }) || p.supplier;
    const note = V.text(b.note, 'Note', { max: 200 });
    const date = V.dateStr(b.date);
    const balance = Math.round(((p.stock ?? 0) + qty) * 100) / 100;
    const cost = b.update_cost && price != null ? price : p.cost_price;
    await t.run('UPDATE products SET stock=?, supplier=?, last_purchase_price=?, cost_price=?, updated_at=now() WHERE id=?', balance, supplier, price ?? p.last_purchase_price, cost, id);
    await addMovement(t, id, 'received', qty, balance, price, supplier, note, date);
    return getProduct(id, t);
  });
  res.status(201).json(out);
});

admin.post('/sales', async (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = await tx(async (t) => {
    const p = await lockProduct(t, id);
    if (!p.active) throw new HttpError(409, 'This product is marked inactive.');
    const qty = V.positive(b.qty, 'Quantity sold', { whole: unitIsWhole(p) });
    const price = V.num(b.price ?? p.sell_price, 'Selling price');
    if (price == null) throw bad('Enter the selling price for this sale (the product has none set).');
    if (p.stock == null) throw new HttpError(409, 'Stock for this product is not set yet. Set the current stock first (Stock > Adjust).');
    if (qty > p.stock) throw new HttpError(409, `Only ${p.stock} ${p.unit} in stock. Fix the quantity, or correct the stock with an adjustment first.`);
    const balance = Math.round((p.stock - qty) * 100) / 100;
    await t.run('UPDATE products SET stock=?, updated_at=now() WHERE id=?', balance, id);
    await addMovement(t, id, 'sold', -qty, balance, price, '', V.text(b.note, 'Note', { max: 200 }), V.dateStr(b.date));
    return getProduct(id, t);
  });
  res.status(201).json(out);
});

admin.post('/stock/adjust', async (req, res) => {
  const b = req.body || {};
  const id = Number(b.product_id);
  const out = await tx(async (t) => {
    const p = await lockProduct(t, id);
    const target = Number(b.new_stock);
    if (b.new_stock === '' || b.new_stock == null || !Number.isFinite(target)) throw bad('Enter the correct stock quantity.');
    if (target < 0 && !b.allow_negative) throw bad('Stock cannot go below zero. Tick "allow negative" only if you really mean it.');
    if (unitIsWhole(p) && !Number.isInteger(target)) throw bad('Stock must be a whole number for this unit.');
    if (Math.abs(target) > 10_000_000) throw bad('Quantity is too large.');
    const note = V.text(b.note, 'Reason', { required: true, max: 200 });
    const balance = Math.round(target * 100) / 100;
    const change = Math.round((balance - (p.stock ?? 0)) * 100) / 100;
    await t.run('UPDATE products SET stock=?, updated_at=now() WHERE id=?', balance, id);
    await addMovement(t, id, 'adjustment', change, balance, null, '', note, V.dateStr(b.date));
    return getProduct(id, t);
  });
  res.status(201).json(out);
});

admin.get('/movements', async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.product_id) { where.push('m.product_id = ?'); args.push(Number(req.query.product_id)); }
  if (['received', 'sold', 'adjustment'].includes(req.query.type)) { where.push('m.type = ?'); args.push(req.query.type); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { where.push('m.date >= ?'); args.push(req.query.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { where.push('m.date <= ?'); args.push(req.query.to); }
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  res.json(
    await D.all(
      `SELECT m.id, m.product_id, p.name, p.brand, p.spec, p.unit, m.type, m.qty_change, m.balance_after, m.unit_price, m.supplier, m.note, m.date, m.created_at
       FROM stock_movements m JOIN products p ON p.id = m.product_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.date DESC, m.id DESC LIMIT ${limit}`,
      ...args
    )
  );
});

// ---- backup / export
admin.get('/export/json', async (req, res) => {
  res.set('Content-Disposition', `attachment; filename="gurukrupa-backup-${V.today()}.json"`);
  res.json({
    exported_at: new Date().toISOString(),
    categories: await D.all('SELECT * FROM categories ORDER BY id'),
    subcategories: await D.all('SELECT * FROM subcategories ORDER BY id'),
    products: await D.all('SELECT * FROM products ORDER BY id'),
    stock_movements: await D.all('SELECT * FROM stock_movements ORDER BY id'),
  });
});

const csvCell = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+@-]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
admin.get('/export/csv', async (req, res) => {
  const rows = await D.all(
    `SELECT p.code, p.name, p.brand, p.model, p.spec, c.name AS category, s.name AS subcategory, p.unit, p.cost_price, p.sell_price,
      p.stock, p.min_stock, p.target_stock, p.reorder_qty, p.supplier, p.last_purchase_price, p.active, p.notes
     FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN subcategories s ON s.id=p.subcategory_id ORDER BY c.sort, s.sort, p.name`
  );
  const cols = ['code', 'name', 'brand', 'model', 'spec', 'category', 'subcategory', 'unit', 'cost_price', 'sell_price', 'stock', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'active', 'notes'];
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="gurukrupa-products-${V.today()}.csv"` });
  res.send(csv);
});

module.exports = { publicRouter, adminRouter: admin };

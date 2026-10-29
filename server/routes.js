const express = require('express');
const { sb, unwrap, countOf, fetchAll, nextCode, isUniqueViolation } = require('./db');
const storage = require('./storage');
const { requireAdmin } = require('./auth');
const V = require('./validate');

const { bad, HttpError } = V;

// photos are stored in Supabase Storage; the database keeps only the file name, the API hands out the full public URL
const withImage = (p) => (p ? { ...p, image: storage.publicUrl(p.image) } : p);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- public (customers)
// Only fields meant for customers, and only active products (priced or not). Purchase price, minimum stock, supplier and notes never leave the admin routes.
const publicRouter = express.Router();

async function categoriesTree() {
  const cats = await unwrap(sb.from('categories').select('id,name,icon').order('sort').order('name'));
  const subs = await unwrap(sb.from('subcategories').select('id,category_id,name').order('sort').order('name'));
  return cats.map((c) => ({ ...c, subcategories: subs.filter((s) => s.category_id === c.id).map(({ id, name }) => ({ id, name })) }));
}

publicRouter.get('/catalog', async (req, res) => {
  const cols = 'id,name,brand,model,spec,category_id,subcategory_id,unit,sell_price,stock,image,keywords';
  const products = await fetchAll(() => sb.from('products').select(cols).eq('active', 1).order('id'));
  res.json({ categories: await categoriesTree(), products: products.sort(byName).map(withImage) });
});

// ---------------------------------------------------------------- admin
const admin = express.Router();
admin.use(requireAdmin);

const PRODUCT_COLS = 'id,code,name,brand,model,spec,category_id,subcategory_id,unit,cost_price,sell_price,stock,min_stock,target_stock,reorder_qty,supplier,last_purchase_price,image,keywords,notes,active,updated_at';

// raw = true keeps the stored file name (needed when deleting a photo)
async function getProduct(id, raw = false) {
  const p = await unwrap(sb.from('products').select(PRODUCT_COLS).eq('id', id).maybeSingle());
  if (!p) throw new HttpError(404, 'Product not found.');
  return raw ? p : withImage(p);
}

admin.get('/catalog', async (req, res) => {
  const products = await fetchAll(() => sb.from('products').select(PRODUCT_COLS).order('id'));
  res.json({ categories: await categoriesTree(), products: products.sort(byName).map(withImage) });
});

async function cleanProduct(b, existing) {
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
  const [cat, sub] = await Promise.all([
    p.category_id ? unwrap(sb.from('categories').select('id').eq('id', p.category_id).maybeSingle()) : null,
    p.subcategory_id ? unwrap(sb.from('subcategories').select('category_id').eq('id', p.subcategory_id).maybeSingle()) : null,
  ]);
  if (p.category_id && !cat) throw bad('Category not found.');
  if (p.subcategory_id) {
    if (!sub) throw bad('Subcategory not found.');
    if (sub.category_id !== p.category_id) throw bad('That subcategory does not belong to the chosen category.');
  }
  return p;
}

// The database refuses a repeated code, or a repeated name + brand + model + specification (unique indexes).
function duplicateError(e) {
  if (!isUniqueViolation(e)) return e;
  if (/products_code_uq/.test(e.message)) return new HttpError(409, 'That product code is already used by another product.');
  return new HttpError(409, 'This product already exists. Edit it instead, or change the brand / model / specification.');
}

const PRODUCT_FIELDS = ['code', 'name', 'brand', 'model', 'spec', 'category_id', 'subcategory_id', 'unit', 'cost_price', 'sell_price', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'keywords', 'notes', 'active'];
const pick = (p) => Object.fromEntries(PRODUCT_FIELDS.map((k) => [k, p[k]]));

admin.post('/products', async (req, res) => {
  const p = await cleanProduct(req.body || {});
  const autoCode = !p.code;
  let created;
  for (let attempt = 0; ; attempt++) {
    if (autoCode) p.code = await nextCode();
    try {
      created = await unwrap(sb.from('products').insert(pick(p)).select('id').single());
      break;
    } catch (e) {
      if (autoCode && attempt < 3 && isUniqueViolation(e) && /products_code_uq/.test(e.message)) continue; // two people created at the same moment
      throw duplicateError(e);
    }
  }
  // Opening stock is recorded as a movement so the history always adds up.
  if (p.stock != null && p.stock > 0) await moveStock({ id: created.id, type: 'adjustment', target: p.stock, note: 'Opening stock', date: V.today() });
  res.status(201).json(await getProduct(created.id));
});

admin.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = await cleanProduct(req.body || {});
  const fields = pick(p);
  if (!fields.code) delete fields.code; // blank means keep the current code
  // Stock is changed through Receive / Sale / Adjust so the history stays correct; edits here never touch it.
  let rows;
  try {
    rows = await unwrap(sb.from('products').update({ ...fields, updated_at: now() }).eq('id', id).select(PRODUCT_COLS));
  } catch (e) {
    throw duplicateError(e);
  }
  if (!rows.length) throw new HttpError(404, 'Product not found.');
  res.json(withImage(rows[0]));
});

// ---- images (the browser shrinks the photo first; we still verify type and size here)
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

admin.post('/products/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) throw bad('Please choose a JPG, PNG or WebP image.');
  if (!storage.enabled) throw new HttpError(503, 'Photo storage is not set up. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw bad('Image is too large (max 2 MB).');
  const file = `p${id}-${Date.now()}.${IMG_TYPES[m[1]]}`;
  const [old] = await Promise.all([
    getProduct(id, true),
    storage.upload(file, buf, m[1]).catch((e) => {
      throw new HttpError(502, e.message);
    }),
  ]);
  const [rows] = await Promise.all([
    unwrap(sb.from('products').update({ image: file, updated_at: now() }).eq('id', id).select(PRODUCT_COLS)),
    storage.remove(old.image),
  ]);
  res.json(withImage(rows[0]));
});

admin.delete('/products/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const old = await getProduct(id, true);
  const [rows] = await Promise.all([
    unwrap(sb.from('products').update({ image: null, updated_at: now() }).eq('id', id).select(PRODUCT_COLS)),
    storage.remove(old.image),
  ]);
  res.json(withImage(rows[0]));
});

// ---- categories
const uniqueOr409 = (msg) => (e) => {
  throw isUniqueViolation(e) ? new HttpError(409, msg) : e;
};
const nextSort = async (table, filter) => {
  let q = sb.from(table).select('sort').order('sort', { ascending: false }).limit(1);
  if (filter) q = q.eq(...filter);
  const rows = await unwrap(q);
  return (rows[0]?.sort ?? 0) + 1;
};

admin.post('/categories', async (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  const r = await unwrap(sb.from('categories').insert({ name, icon, sort: await nextSort('categories') }).select('id').single()).catch(uniqueOr409('A category with this name already exists.'));
  res.status(201).json({ id: r.id, name, icon });
});
admin.put('/categories/:id', async (req, res) => {
  const name = V.text(req.body?.name, 'Category name', { required: true, max: 60 });
  const icon = V.text(req.body?.icon || 'box', 'Icon', { max: 20 });
  const rows = await unwrap(sb.from('categories').update({ name, icon }).eq('id', Number(req.params.id)).select('id')).catch(uniqueOr409('A category with this name already exists.'));
  if (!rows.length) throw new HttpError(404, 'Category not found.');
  res.json({ ok: true });
});
admin.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const used = await countOf(sb.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id));
  if (used) throw new HttpError(409, `${used} product(s) use this category. Move them first.`);
  await unwrap(sb.from('subcategories').delete().eq('category_id', id));
  await unwrap(sb.from('categories').delete().eq('id', id));
  res.json({ ok: true });
});
admin.post('/subcategories', async (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  const cid = Number(req.body?.category_id);
  if (!(await unwrap(sb.from('categories').select('id').eq('id', cid).maybeSingle()))) throw bad('Choose a category.');
  const r = await unwrap(sb.from('subcategories').insert({ category_id: cid, name, sort: await nextSort('subcategories', ['category_id', cid]) }).select('id').single()).catch(uniqueOr409('This subcategory already exists in that category.'));
  res.status(201).json({ id: r.id, category_id: cid, name });
});
admin.put('/subcategories/:id', async (req, res) => {
  const name = V.text(req.body?.name, 'Subcategory name', { required: true, max: 60 });
  const rows = await unwrap(sb.from('subcategories').update({ name }).eq('id', Number(req.params.id)).select('id')).catch(uniqueOr409('This subcategory already exists in that category.'));
  if (!rows.length) throw new HttpError(404, 'Subcategory not found.');
  res.json({ ok: true });
});
admin.delete('/subcategories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const used = await countOf(sb.from('products').select('id', { count: 'exact', head: true }).eq('subcategory_id', id));
  if (used) throw new HttpError(409, `${used} product(s) use this subcategory. Move them first.`);
  await unwrap(sb.from('subcategories').delete().eq('id', id));
  res.json({ ok: true });
});

// ---- stock: receive / sale / adjust. The database function changes the stock and writes the history row in one step.
const unitIsWhole = (p) => V.WHOLE_UNITS.has(p.unit);

async function moveStock({ id, type, qty = null, price = null, supplier = '', note = '', date, updateCost = false, target = null, unit = 'Nos' }) {
  const { data, error } = await sb.rpc('gk_move_stock', {
    p_id: id, p_type: type, p_qty: qty, p_price: price, p_supplier: supplier, p_note: note, p_date: date, p_update_cost: updateCost, p_target: target,
  });
  if (error) {
    const m = error.message || '';
    if (m.includes('GK_INSUFFICIENT')) throw new HttpError(409, `Only ${m.split(':')[1]?.trim()} ${unit} in stock. Fix the quantity, or correct the stock with an adjustment first.`);
    if (m.includes('GK_STOCK_UNSET')) throw new HttpError(409, 'Stock for this product is not set yet. Set the current stock first (Stock > Adjust).');
    if (m.includes('GK_NOT_FOUND')) throw new HttpError(404, 'Product not found.');
    if (/Could not find the function|schema cache/i.test(m)) throw new Error('Stock function missing. Run supabase/schema.sql in the Supabase SQL Editor.');
    throw new Error(m);
  }
  return withImage(Array.isArray(data) ? data[0] : data);
}

admin.post('/stock/receive', async (req, res) => {
  const b = req.body || {};
  const p = await getProduct(Number(b.product_id));
  const qty = V.positive(b.qty, 'Quantity received', { whole: unitIsWhole(p) });
  const price = V.num(b.price, 'Purchase price');
  const supplier = V.text(b.supplier, 'Supplier', { max: 80 }) || p.supplier;
  const note = V.text(b.note, 'Note', { max: 200 });
  const date = V.dateStr(b.date);
  res.status(201).json(await moveStock({ id: p.id, type: 'received', qty, price, supplier, note, date, updateCost: !!b.update_cost }));
});

admin.post('/sales', async (req, res) => {
  const b = req.body || {};
  const p = await getProduct(Number(b.product_id));
  if (!p.active) throw new HttpError(409, 'This product is marked inactive.');
  const qty = V.positive(b.qty, 'Quantity sold', { whole: unitIsWhole(p) });
  const price = V.num(b.price ?? p.sell_price, 'Selling price');
  if (price == null) throw bad('Enter the selling price for this sale (the product has none set).');
  const note = V.text(b.note, 'Note', { max: 200 });
  const date = V.dateStr(b.date);
  res.status(201).json(await moveStock({ id: p.id, type: 'sold', qty, price, note, date, unit: p.unit }));
});

admin.post('/stock/adjust', async (req, res) => {
  const b = req.body || {};
  const p = await getProduct(Number(b.product_id));
  const target = Number(b.new_stock);
  if (b.new_stock === '' || b.new_stock == null || !Number.isFinite(target)) throw bad('Enter the correct stock quantity.');
  if (target < 0 && !b.allow_negative) throw bad('Stock cannot go below zero. Tick "allow negative" only if you really mean it.');
  if (unitIsWhole(p) && !Number.isInteger(target)) throw bad('Stock must be a whole number for this unit.');
  if (Math.abs(target) > 10_000_000) throw bad('Quantity is too large.');
  const note = V.text(b.note, 'Reason', { required: true, max: 200 });
  const date = V.dateStr(b.date);
  res.status(201).json(await moveStock({ id: p.id, type: 'adjustment', target, note, date }));
});

admin.get('/movements', async (req, res) => {
  let q = sb
    .from('stock_movements')
    .select('id,product_id,type,qty_change,balance_after,unit_price,supplier,note,date,created_at,products(name,brand,spec,unit)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Number(req.query.limit) || 100, 1000));
  if (req.query.product_id) q = q.eq('product_id', Number(req.query.product_id));
  if (['received', 'sold', 'adjustment'].includes(req.query.type)) q = q.eq('type', req.query.type);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) q = q.gte('date', req.query.from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) q = q.lte('date', req.query.to);
  const rows = await unwrap(q);
  res.json(rows.map(({ products, ...m }) => ({ ...m, name: products?.name, brand: products?.brand, spec: products?.spec, unit: products?.unit })));
});

// ---- backup / export
admin.get('/export/json', async (req, res) => {
  res.set('Content-Disposition', `attachment; filename="gurukrupa-backup-${V.today()}.json"`);
  res.json({
    exported_at: now(),
    categories: await fetchAll(() => sb.from('categories').select('*').order('id')),
    subcategories: await fetchAll(() => sb.from('subcategories').select('*').order('id')),
    products: await fetchAll(() => sb.from('products').select('*').order('id')),
    stock_movements: await fetchAll(() => sb.from('stock_movements').select('*').order('id')),
  });
});

const csvCell = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+@-]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
admin.get('/export/csv', async (req, res) => {
  const [cats, subs, prods] = await Promise.all([
    fetchAll(() => sb.from('categories').select('*').order('id')),
    fetchAll(() => sb.from('subcategories').select('*').order('id')),
    fetchAll(() => sb.from('products').select('*').order('id')),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const sub = new Map(subs.map((s) => [s.id, s]));
  const rows = prods
    .map((p) => ({ ...p, category: cat.get(p.category_id)?.name, subcategory: sub.get(p.subcategory_id)?.name, _c: cat.get(p.category_id)?.sort ?? 999, _s: sub.get(p.subcategory_id)?.sort ?? 999 }))
    .sort((a, b) => a._c - b._c || a._s - b._s || byName(a, b));
  const cols = ['code', 'name', 'brand', 'model', 'spec', 'category', 'subcategory', 'unit', 'cost_price', 'sell_price', 'stock', 'min_stock', 'target_stock', 'reorder_qty', 'supplier', 'last_purchase_price', 'active', 'notes'];
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="gurukrupa-products-${V.today()}.csv"` });
  res.send(csv);
});

module.exports = { publicRouter, adminRouter: admin };

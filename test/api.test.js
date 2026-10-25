const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const http = require('node:http');
const { execFileSync } = require('node:child_process');

const PORT = 3900 + Math.floor(Math.random() * 90);
const PGPORT = 54000 + Math.floor(Math.random() * 900);
const STORE_PORT = 55000 + Math.floor(Math.random() * 900);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-test-'));
let server, storeServer;
let cookie = '';
const stored = new Set(); // file names the fake Supabase Storage currently holds

async function call(method, url, body, { auth = true } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

before(async () => {
  // throwaway local Postgres (same engine as Supabase) + a fake Supabase Storage endpoint
  const bin = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/lib/postgresql/16/bin'].find((d) => fs.existsSync(d + '/initdb'));
  if (!bin) throw new Error('Postgres (initdb) not found - install it to run the tests');
  const pgdir = path.join(dir, 'pg');
  execFileSync(bin + '/initdb', ['-D', pgdir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C'], { stdio: 'ignore', env: { ...process.env, LC_ALL: 'C', LANG: 'C' } });
  execFileSync(bin + '/pg_ctl', ['-D', pgdir, '-o', `-p ${PGPORT} -c unix_socket_directories= -c listen_addresses=127.0.0.1`, '-w', '-l', path.join(dir, 'pg.log'), 'start'], { stdio: 'ignore', env: { ...process.env, LC_ALL: 'C', LANG: 'C' } });
  after.pgStop = () => execFileSync(bin + '/pg_ctl', ['-D', pgdir, '-m', 'immediate', 'stop'], { stdio: 'ignore' });

  storeServer = http.createServer((req, res) => {
    const m = /^\/storage\/v1\/object\/product-images\/(.+)$/.exec(req.url);
    let body = '';
    req.on('data', (d) => (body += d.length > 0 && req.method === 'DELETE' ? d : ''));
    req.on('end', () => {
      if (m && req.method === 'POST') stored.add(m[1]);
      if (req.method === 'DELETE') try { JSON.parse(body).prefixes.forEach((f) => stored.delete(f)); } catch {}
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    });
  });
  await new Promise((r) => storeServer.listen(STORE_PORT, '127.0.0.1', r));

  server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT, ADMIN_PASSWORD: 'test-pass-1', DATABASE_URL: `postgres://postgres@127.0.0.1:${PGPORT}/postgres`, SUPABASE_URL: `http://127.0.0.1:${STORE_PORT}`, SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 80; i++) {
    try { await fetch(BASE + '/api/catalog'); return; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  throw new Error('server did not start');
});
after(() => {
  server?.kill();
  storeServer?.close();
  try { after.pgStop?.(); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
});

let catId, subId, prodId;

test('admin routes are locked, wrong password rejected, right password opens them', async () => {
  assert.equal((await call('GET', '/api/admin/catalog', null, { auth: false })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { password: '87654321' })).status, 401);
  const ok = await call('POST', '/api/auth/login', { password: 'test-pass-1' });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await call('GET', '/api/admin/catalog')).status, 200);
});

test('create category + product, validate input, block duplicates', async () => {
  catId = (await call('POST', '/api/admin/categories', { name: 'Lights', icon: 'bulb' })).json.id;
  subId = (await call('POST', '/api/admin/subcategories', { category_id: catId, name: 'LED Bulbs' })).json.id;
  assert.equal((await call('POST', '/api/admin/categories', { name: 'lights' })).status, 409);

  const base = { name: 'LED Bulb 9W', brand: 'Panasonic', category_id: catId, subcategory_id: subId, unit: 'Nos', cost_price: '40', sell_price: '55', min_stock: 5, target_stock: 20 };
  assert.equal((await call('POST', '/api/admin/products', { ...base, sell_price: '-1' })).status, 400);
  assert.equal((await call('POST', '/api/admin/products', { ...base, cost_price: 'abc' })).status, 400);
  assert.equal((await call('POST', '/api/admin/products', { ...base, name: '' })).status, 400);
  assert.equal((await call('POST', '/api/admin/products', { ...base, unit: 'Bogus' })).status, 400);
  assert.equal((await call('POST', '/api/admin/products', { ...base, target_stock: 2 })).status, 400);

  const created = await call('POST', '/api/admin/products', base);
  assert.equal(created.status, 201);
  prodId = created.json.id;
  assert.match(created.json.code, /^GK-\d{4}$/);
  assert.equal(created.json.stock, null);
  assert.equal((await call('POST', '/api/admin/products', base)).status, 409);
});

test('customers never receive private fields', async () => {
  await call('PUT', `/api/admin/products/${prodId}`, { ...(await call('GET', '/api/admin/catalog')).json.products.find((p) => p.id === prodId), supplier: 'Secret Supplier', notes: 'secret note' });
  const pub = await call('GET', '/api/catalog', null, { auth: false });
  assert.equal(pub.status, 200);
  assert.ok(pub.json.products.some((p) => p.id === prodId));
  for (const secret of ['cost_price', 'min_stock', 'target_stock', 'supplier', 'notes', 'last_purchase_price', 'reorder_qty']) {
    assert.ok(!pub.text.includes(`"${secret}"`), `${secret} leaked`);
  }
  assert.ok(!pub.text.includes('Secret Supplier'));
});

test('products without a selling price are listed but have no price', async () => {
  const mk = await call('POST', '/api/admin/products', { name: 'No Price Item', category_id: catId, unit: 'Nos', cost_price: 10 });
  assert.equal(mk.status, 201);
  const pub = (await call('GET', '/api/catalog', null, { auth: false })).json.products.find((x) => x.id === mk.json.id);
  assert.equal(pub.sell_price, null);
  assert.ok(!('cost_price' in pub));
});

test('inactive products disappear from the customer catalogue', async () => {
  const p = (await call('GET', '/api/admin/catalog')).json.products.find((x) => x.id === prodId);
  await call('PUT', `/api/admin/products/${prodId}`, { ...p, active: false });
  assert.ok(!(await call('GET', '/api/catalog', null, { auth: false })).json.products.some((x) => x.id === prodId));
  await call('PUT', `/api/admin/products/${prodId}`, { ...p, active: true });
});

test('sales: need stock set, cannot oversell, deduct stock and log history', async () => {
  const noStock = await call('POST', '/api/admin/sales', { product_id: prodId, qty: 1 });
  assert.equal(noStock.status, 409);

  assert.equal((await call('POST', '/api/admin/stock/adjust', { product_id: prodId, new_stock: 10, note: 'Opening stock' })).json.stock, 10);
  assert.equal((await call('POST', '/api/admin/stock/adjust', { product_id: prodId, new_stock: -1, note: 'x' })).status, 400);

  const sale = await call('POST', '/api/admin/sales', { product_id: prodId, qty: 3 });
  assert.equal(sale.status, 201);
  assert.equal(sale.json.stock, 7);

  assert.equal((await call('POST', '/api/admin/sales', { product_id: prodId, qty: 8 })).status, 409);
  assert.equal((await call('POST', '/api/admin/sales', { product_id: prodId, qty: 0 })).status, 400);
  assert.equal((await call('POST', '/api/admin/sales', { product_id: prodId, qty: 1.5 })).status, 400); // Nos must be whole
  const after = (await call('GET', '/api/admin/catalog')).json.products.find((p) => p.id === prodId);
  assert.equal(after.stock, 7);

  const mv = (await call('GET', `/api/admin/movements?product_id=${prodId}`)).json;
  assert.deepEqual(mv.map((m) => [m.type, m.qty_change, m.balance_after]).reverse(), [['adjustment', 10, 10], ['sold', -3, 7]]);
  assert.equal(mv.find((m) => m.type === 'sold').unit_price, 55); // defaults to the selling price
});

test('browsing the customer catalogue does not change stock', async () => {
  for (let i = 0; i < 3; i++) await call('GET', '/api/catalog', null, { auth: false });
  const pub = (await call('GET', '/api/catalog', null, { auth: false })).json.products.find((p) => p.id === prodId);
  assert.equal(pub.stock, 7);
});

test('receiving stock adds quantity and records supplier and price', async () => {
  const r = await call('POST', '/api/admin/stock/receive', { product_id: prodId, qty: 5, price: 42, supplier: 'Shah Traders', date: '2026-01-15', update_cost: true });
  assert.equal(r.status, 201);
  assert.equal(r.json.stock, 12);
  assert.equal(r.json.supplier, 'Shah Traders');
  assert.equal(r.json.last_purchase_price, 42);
  assert.equal(r.json.cost_price, 42);
  assert.equal((await call('POST', '/api/admin/stock/receive', { product_id: prodId, qty: 0 })).status, 400);
  assert.equal((await call('POST', '/api/admin/stock/receive', { product_id: prodId, qty: 1, date: 'nonsense' })).status, 400);
  const filtered = (await call('GET', '/api/admin/movements?type=received&from=2026-01-01&to=2026-01-31')).json;
  assert.equal(filtered.length, 1);
});

test('editing a product never changes its stock', async () => {
  const p = (await call('GET', '/api/admin/catalog')).json.products.find((x) => x.id === prodId);
  const out = await call('PUT', `/api/admin/products/${prodId}`, { ...p, stock: 999, sell_price: 60 });
  assert.equal(out.json.stock, 12);
  assert.equal(out.json.sell_price, 60);
});

test('image upload accepts pictures only and can be removed', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await call('POST', `/api/admin/products/${prodId}/image`, { dataUrl: 'data:text/html;base64,PGI+' })).status, 400);
  const up = await call('POST', `/api/admin/products/${prodId}/image`, { dataUrl: png });
  assert.equal(up.status, 200);
  assert.ok(up.json.image.endsWith('.png'));
  assert.match(up.json.image, new RegExp(`^http://127\\.0\\.0\\.1:${STORE_PORT}/storage/v1/object/public/product-images/p${prodId}-`));
  assert.equal(stored.size, 1); // the photo went to storage, not to local disk
  assert.equal((await call('DELETE', `/api/admin/products/${prodId}/image`)).json.image, null);
  assert.equal(stored.size, 0);
});

test('categories in use cannot be deleted; exports work', async () => {
  assert.equal((await call('DELETE', `/api/admin/categories/${catId}`)).status, 409);
  const csv = await call('GET', '/api/admin/export/csv');
  assert.match(csv.text, /LED Bulb 9W/);
  const json = await call('GET', '/api/admin/export/json');
  assert.equal(json.json.products.length, 2);
  assert.equal((await call('GET', '/api/admin/export/csv', null, { auth: false })).status, 401);
});

test('logout ends the session', async () => {
  assert.equal((await call('POST', '/api/auth/logout', {})).status, 200);
  assert.equal((await call('GET', '/api/admin/catalog')).status, 401);
});

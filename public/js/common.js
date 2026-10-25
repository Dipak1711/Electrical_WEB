// Shared by the customer site and the admin panel.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (n) => (n == null ? '' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
export const qtyText = (n) => (n == null ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));

export async function api(url, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      // every write is JSON (the server rejects anything else), even when there is nothing to send
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body ?? {}),
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('No connection to the server. Check your internet and try again.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3200);
}

// ---------------------------------------------------------------- icons
const I = {
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C12 6 10 3 7.5 3.5S6 8 12 10.2zM13.8 12c4.2 0 7.2-2 6.7-4.5S16 6 13.8 12zM12 13.8c0 4.2 2 7.2 4.5 6.7S18 16 12 13.8zM10.2 12c-4.2 0-7.2 2-6.7 4.5S8 18 10.2 12z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  switch: '<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="10" y="7" width="4" height="6" rx="1"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3"/>',
  breaker: '<rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M10 8h4M12 8v5"/>',
  wire: '<path d="M3 8c4 0 4 8 9 8s5-8 9-8"/><circle cx="3" cy="8" r="1"/><circle cx="21" cy="8" r="1"/>',
  pipe: '<path d="M3 9h18v6H3zM7 9v6M17 9v6"/>',
  clamp: '<path d="M5 17a7 7 0 0 1 14 0M3 17h4M17 17h4M12 4v6"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.7-.7-2.6z"/>',
  battery: '<rect x="3" y="8" width="16" height="9" rx="1.5"/><path d="M21 11v3M7 12h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.6L21 7H6.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  rupee: '<path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8h-.5L16 20"/>',
  stock: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
};
export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.box}</svg>`;

// Picture for a product: its uploaded photo, else a drawn illustration of the product type, else nothing (no faded placeholder).
const TYPE_RULES = [
  [/ceiling fan/i, 'ceiling-fan'], [/table fan|pedestal|wall fan/i, 'table-fan'], [/exhaust/i, 'exhaust-fan'],
  [/fan pipe/i, 'fan-rod'], [/clamp fan|fan clamp|fan hook/i, 'fan-clamp'], [/capacitor/i, 'capacitor'],
  [/charging bulb/i, 'charging-bulb'], [/tube light/i, 'led-tube'], [/panel light|surface light/i, 'led-panel'], [/led bulb/i, 'led-bulb'],
  [/holder/i, 'lamp-holder'], [/regulator/i, 'regulator'], [/extension board/i, 'extension-board'],
  [/bell push/i, 'switch'], [/bell|ding dong|bull bull/i, 'door-bell'],
  [/pvc board/i, 'pvc-board'], [/ss combine/i, 'combine'], [/^casing junction/i, 'casing-fitting'],
  [/mcb box|^gi /i, 'gi-box'], [/dummy plate|round plate|round button|plate angle|plate button|angle regular|button regular/i, 'plate'],
  [/surface box/i, 'surface-box'], [/^mcb /i, 'mcb'], [/socket/i, 'socket'], [/switch|indicator/i, 'switch'],
  [/plug|male female|^2 pin|round 2 pin|adapter/i, 'plug'], [/stripper|cutter/i, 'stripper'],
  [/rg-6|speaker wire/i, 'coax'], [/wire/i, 'wire-coil'],
  [/pica/i, 'pica-pipe'], [/pvc (elbow|tee|junction)/i, 'pipe-fitting'], [/pvc.*pipe|grey pipe/i, 'pvc-pipe'],
  [/casing patti/i, 'casing'], [/^casing/i, 'casing-fitting'],
  [/c-clamp|saddle/i, 'c-clamp'], [/cable tie/i, 'cable-tie'], [/tape/i, 'tape'], [/connector strip/i, 'connector-strip'],
  [/line tester/i, 'tester'], [/plier/i, 'plier'], [/screw ?driver/i, 'screwdriver'],
  [/pencil cell|battery|cell 2032/i, 'battery'], [/hdmi|rca/i, 'av-cable'],
];
export function productType(p) {
  for (const [re, t] of TYPE_RULES) if (re.test(p.name)) return t;
  return null;
}
export function thumb(p) {
  if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;
  const t = productType(p);
  return t ? `<img class="illus" src="/img/types/${t}.svg" alt="${esc(p.name)} (illustration)" loading="lazy" decoding="async" title="Illustration - not a photo of this exact item">` : '';
}

// ---------------------------------------------------------------- search
// Everything is searched in the browser over the loaded catalogue, so results appear as you type.
function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[“”″]/g, '"')
    .replace(/(\d+(?:\.\d+)?)\s*(?:"|inch(?:es)?|in\b)/g, '$1inch ')
    .replace(/(\d+(?:\.\d+)?)\s*(?:watts?|w)\b/g, '$1w ')
    .replace(/(\d+(?:\.\d+)?)\s*(?:amps?|a)\b/g, '$1a ')
    .replace(/(\d+(?:\.\d+)?)\s*(sqmm|mm|mtr|ft|yard|core|m|v)\b/g, '$1$2 ')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// related words: searching the left word also finds items that mention the right words
const SYN = {
  wire: ['cable'], cable: ['wire'], bulb: ['lamp', 'led'], lamp: ['bulb'], led: ['bulb', 'light'],
  light: ['led', 'bulb', 'lamp', 'tube', 'panel'], lights: ['led', 'bulb', 'tube', 'panel'], tubelight: ['tube'],
  tube: ['tubelight'], mcb: ['breaker'], breaker: ['mcb'], plier: ['pliers'], pliers: ['plier'], tape: ['insulation'],
  regulator: ['dimmer'], battery: ['cell'], cell: ['battery'], bell: ['doorbell'], doorbell: ['bell'],
  pipe: ['conduit', 'pica'], conduit: ['pipe', 'pica'], plug: ['top'], extension: ['board'], screwdriver: ['screw'],
  tester: ['line'], chargeable: ['charging'], emergency: ['charging'],
};

export function buildIndex(products, categories, { withCode = false } = {}) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const subName = new Map(categories.flatMap((c) => c.subcategories.map((s) => [s.id, s.name])));
  return products.map((p) => ({
    p,
    name: norm(p.name),
    brand: norm(p.brand),
    hay: norm([p.name, p.brand, p.model, p.spec, withCode ? p.code : '', catName.get(p.category_id), subName.get(p.subcategory_id), p.keywords].join(' ')),
  }));
}

export function runSearch(index, query, filter = () => true) {
  const tokens = norm(query).split(' ').filter(Boolean);
  const out = [];
  for (const e of index) {
    if (!filter(e.p)) continue;
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      let s = 0;
      if (e.name.startsWith(t) || e.name.includes(' ' + t)) s = 6;
      else if (e.name.includes(t)) s = 4;
      else if (e.brand.includes(t)) s = 3;
      else if (e.hay.includes(t)) s = 1;
      else if ((SYN[t] || []).some((alt) => e.hay.includes(alt))) s = 0.5;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (ok) out.push({ p: e.p, score });
  }
  if (tokens.length) out.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return out.map((x) => x.p);
}

// ---------------------------------------------------------------- misc helpers
export const debounce = (fn, ms = 60) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export function stockLabel(p) {
  if (p.stock == null) return { text: 'Stock: ask', cls: 'unk' };
  if (p.stock <= 0) return { text: 'Out of stock', cls: 'out' };
  return { text: `${qtyText(p.stock)} ${p.unit} in stock`, cls: 'ok' };
}

export function openModal(html, { onClose, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(wrap);
  document.body.classList.add('noscroll');
  const close = () => {
    wrap.remove();
    if (!document.querySelector('.modal-wrap')) document.body.classList.remove('noscroll');
    onClose?.();
  };
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) close();
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const first = wrap.querySelector('[autofocus]') || wrap.querySelector('input,select,textarea,button');
  first?.focus();
  return { el: wrap.firstElementChild, close };
}

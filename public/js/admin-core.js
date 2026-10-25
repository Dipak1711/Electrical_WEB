// State and helpers shared by every admin screen.
import { $, esc, money, qtyText, api, thumb, buildIndex, runSearch, debounce, icon } from './common.js';

export const S = { categories: [], products: [], index: [], demoPassword: false };
// screens register their openers here so they can call each other without circular imports
export const actions = {};
export const views = {}; // tab name -> { render(root), refresh?() }
export let currentTab = 'products';
export const setCurrentTab = (t) => (currentTab = t);

export async function load() {
  const d = await api('/api/admin/catalog');
  S.categories = d.categories;
  S.products = d.products;
  S.index = buildIndex(d.products, d.categories, { withCode: true });
}
export async function reloadAndRender() {
  await load();
  views[currentTab]?.render($('#view'));
  updateBadge();
}
export function updateBadge() {
  const n = S.products.filter(isLow).length;
  const b = $('#stockBadge');
  if (b) {
    b.textContent = n;
    b.hidden = !n;
  }
}

export const round2 = (n) => Math.round(n * 100) / 100;
export const byId = (id) => S.products.find((p) => p.id === id);
export const catOf = (id) => S.categories.find((c) => c.id === id);
export const subOf = (id) => S.categories.flatMap((c) => c.subcategories).find((s) => s.id === id);

// low = tracked product that is at/below zero or under its minimum
export const isLow = (p) => !!p.active && p.stock != null && (p.stock <= 0 || (p.min_stock != null && p.stock < p.min_stock));
// suggested reorder = bring stock up to the target (or to the minimum if no target is set)
export function suggested(p) {
  const target = p.target_stock ?? p.min_stock;
  if (target == null || p.stock == null) return null;
  return Math.max(0, round2(target - p.stock));
}
export const reorderQty = (p) => p.reorder_qty ?? suggested(p);

export const priceCell = (label, v, cls) =>
  `<div class="${cls}"><small>${label}</small>${v == null ? '<span class="notset">Not set</span>' : `<b>${money(v)}</b>`}</div>`;

export function nums(p) {
  const stockCls = p.stock != null && p.stock <= 0 ? 'out' : isLow(p) ? 'low' : '';
  return `<div class="nums">
    ${priceCell('Buy', p.cost_price, 'buy')}
    ${priceCell('Sell', p.sell_price, 'sell')}
    <div class="${stockCls}"><small>Stock</small>${p.stock == null ? '<span class="notset">Not set</span>' : `<b>${qtyText(p.stock)} <span style="font-size:12px;font-weight:500">${esc(p.unit)}</span></b>`}</div>
  </div>`;
}

export function productTitle(p) {
  return [p.brand, p.model, p.spec].filter(Boolean).join(' · ');
}

export function prowHtml(p) {
  const meta = productTitle(p);
  const pic = thumb(p);
  return `<button class="prow ${pic ? '' : 'nopic'}" data-id="${p.id}">
    ${pic ? `<div class="pic">${pic}</div>` : ''}
    <div><div class="nm">${esc(p.name)} ${p.active ? '' : '<span class="pill gray">Inactive</span>'}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}${nums(p)}</div></button>`;
}

// Product card in the same look as the customer site. Sell price is the big number; buy price and stock are small.
export function adminCardHtml(p) {
  const pic = thumb(p);
  const meta = [p.model, p.spec].filter(Boolean).join(' · ');
  let stock;
  if (p.stock == null) stock = '<span class="stock unk">Stock not counted</span>';
  else if (p.stock <= 0) stock = '<span class="stock out">Out of stock</span>';
  else stock = `<span class="stock ${isLow(p) ? 'low' : 'ok'}">${isLow(p) ? 'Low: ' : ''}${qtyText(p.stock)} ${esc(p.unit)}</span>`;
  return `<article class="card acard" data-id="${p.id}" tabindex="0" role="button" aria-label="Edit ${esc(p.name)}">
    ${pic ? `<div class="img">${pic}</div>` : ''}
    <div class="body">
      <h3>${esc(p.name)} ${p.active ? '' : '<span class="pill gray">Inactive</span>'}</h3>
      <div class="brand ${p.brand ? '' : 'none'}">${p.brand ? esc(p.brand) : 'Brand not listed'}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
      <div class="afoot">
        ${p.sell_price != null ? `<div class="price">${money(p.sell_price)} <small>sell</small></div>` : '<div class="need">+ Add price</div>'}
        <div class="buysm">Buy ${p.cost_price != null ? money(p.cost_price) : '—'}</div>
      </div>
      ${stock}
    </div></article>`;
}

export function search(q, filter) {
  return runSearch(S.index, q, filter);
}

// Small search-as-you-type picker used by Sell / Receive / Adjust
export function picker(root, { onPick, filter = () => true, placeholder = 'Search product…', autofocus = true }) {
  root.innerHTML = `<div class="picker"><div class="searchbar" style="margin:0"><span>${icon('search')}</span>
    <input type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(placeholder)}" ${autofocus ? 'autofocus' : ''}
      style="height:50px;font-size:17px"></div><div class="results"></div></div>`;
  const input = root.querySelector('input');
  const results = root.querySelector('.results');
  const run = debounce(() => {
    if (!input.value.trim()) return (results.innerHTML = '');
    const list = search(input.value, filter).slice(0, 8);
    results.innerHTML = list.length
      ? list.map((p) => `<button type="button" data-pick="${p.id}"><b>${esc(p.name)}</b><br><span class="meta">${esc(productTitle(p))}${productTitle(p) ? ' · ' : ''}${p.stock == null ? 'stock not set' : `${qtyText(p.stock)} ${esc(p.unit)} in stock`}${p.sell_price != null ? ' · ' + money(p.sell_price) : ''}</span></button>`).join('')
      : '<div class="empty" style="padding:12px">Nothing found</div>';
  });
  input.addEventListener('input', run);
  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) onPick(byId(Number(b.dataset.pick)));
  });
  return input;
}

export function showError(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
  if (msg) el.scrollIntoView({ block: 'nearest' });
}

export const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

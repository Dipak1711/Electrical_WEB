import { $, $$, esc, money, qtyText, api, toast, icon, thumb, buildIndex, runSearch, debounce, stockLabel, openModal } from './common.js';
import { makePdf, printHtml, lineLabel } from './pdf.js';

const PAGE = 48;
const state = { categories: [], products: [], index: [], q: '', cat: null, sub: null, shown: PAGE, cart: new Map() };

// ---------------------------------------------------------------- cart (kept only in this browser; never sent to the server)
const CART_KEY = 'gk_cart_v1';
const NAME_KEY = 'gk_cart_name';
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    for (const [id, q] of Object.entries(raw)) if (Number(q) > 0) state.cart.set(Number(id), Number(q));
  } catch {}
}
function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(state.cart)));
  } catch {}
}
const byId = (id) => state.products.find((p) => p.id === id);
const whole = (p) => p.unit !== 'Mtr' && p.unit !== 'Kg';
function cartLines() {
  const out = [];
  for (const [id, qty] of state.cart) {
    const p = byId(id);
    if (p && p.sell_price != null) out.push({ p, qty });
  }
  return out;
}
const cartTotal = () => cartLines().reduce((s, l) => s + l.qty * l.p.sell_price, 0);
function setQty(id, qty) {
  const p = byId(id);
  if (!p) return;
  qty = Number(qty);
  if (!Number.isFinite(qty) || qty <= 0) state.cart.delete(id);
  else state.cart.set(id, Math.min(whole(p) ? Math.round(qty) : Math.round(qty * 100) / 100, 99999));
  saveCart();
  refreshCard(id);
  refreshBar();
}

// ---------------------------------------------------------------- rendering
function actHtml(p) {
  if (p.sell_price == null) return `<span class="meta">Ask in shop for price</span>`;
  const q = state.cart.get(p.id);
  if (!q) return `<button class="btn primary" data-add="${p.id}">${icon('plus')} Add</button>`;
  return `<div class="step"><button data-dec="${p.id}" aria-label="Decrease">${icon('minus')}</button>
    <input data-qty="${p.id}" type="number" inputmode="decimal" min="0" value="${q}" aria-label="Quantity">
    <button data-inc="${p.id}" aria-label="Increase">${icon('plus')}</button></div>`;
}

function cardHtml(p) {
  const st = stockLabel(p);
  const meta = [p.model, p.spec].filter(Boolean).join(' · ');
  return `<article class="card" data-card="${p.id}" style="cursor:pointer">
    ${thumb(p) ? `<div class="img">${thumb(p)}</div>` : ''}
    <div class="body">
      <h3>${esc(p.name)}</h3>
      <div class="brand ${p.brand ? '' : 'none'}">${p.brand ? esc(p.brand) : 'Brand not listed'}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
      ${p.sell_price != null ? `<div class="price">${money(p.sell_price)} <small>/ ${esc(p.unit)}</small></div>` : `<div class="price none">Price on request</div>`}
      <span class="stock ${st.cls}">${esc(st.text)}</span>
      <div class="act">${actHtml(p)}</div>
    </div></article>`;
}

function refreshCard(id) {
  const act = $(`[data-card="${id}"] .act`);
  const p = byId(id);
  if (act && p) act.innerHTML = actHtml(p);
}

function openProductDetails(p) {
  const cat = state.categories.find((c) => c.id === p.category_id);
  const sub = cat?.subcategories?.find((s) => s.id === p.subcategory_id);
  const st = stockLabel(p);
  const q = state.cart.get(p.id) || 0;
  
  const { el, close } = openModal(`
    <div class="head">
      <h2>Product Details</h2>
      <button class="close" data-close aria-label="Close">${icon('close')}</button>
    </div>
    <div class="pdetails">
      ${thumb(p) ? `<div class="pic-wrap">${thumb(p)}</div>` : ''}
      <div class="pinfo">
        <div class="phead">
          <div>
            <h2>${esc(p.name)}</h2>
            <div class="pbadges">
              ${p.brand ? `<span class="pbadge brand">${esc(p.brand)}</span>` : ''}
              ${cat ? `<span class="pbadge">${esc(cat.name)}</span>` : ''}
              ${sub ? `<span class="pbadge">${esc(sub.name)}</span>` : ''}
            </div>
          </div>
          <span class="stock ${st.cls}">${esc(st.text)}</span>
        </div>
        <div class="specs">
          ${p.model ? `<div class="specs-row"><span class="specs-label">Model</span><span class="specs-val">${esc(p.model)}</span></div>` : ''}
          ${p.spec ? `<div class="specs-row"><span class="specs-label">Specification</span><span class="specs-val">${esc(p.spec)}</span></div>` : ''}
          <div class="specs-row"><span class="specs-label">Unit</span><span class="specs-val">${esc(p.unit)}</span></div>
          <div class="specs-row"><span class="specs-label">Price</span><span class="specs-val" style="color:var(--brand-dark);font-size:16px">${p.sell_price != null ? money(p.sell_price) + ' / ' + esc(p.unit) : 'Price on request'}</span></div>
        </div>
        <div class="pact" style="margin-top:12px">
          ${p.sell_price != null ? `
            <div class="step" style="flex:1;max-width:160px">
              <button data-mdec="${p.id}" aria-label="Decrease">${icon('minus')}</button>
              <input data-mqty="${p.id}" type="number" inputmode="decimal" min="0" value="${q}" aria-label="Quantity">
              <button data-minc="${p.id}" aria-label="Increase">${icon('plus')}</button>
            </div>
            <button class="btn primary" style="flex:1" data-madd="${p.id}">${q > 0 ? 'Update in List' : icon('plus') + ' Add to List'}</button>
          ` : `
            <div class="note" style="margin:0;flex:1">Contact shop for pricing & availability.</div>
          `}
        </div>
      </div>
    </div>
  `);
  
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.minc) {
      setQty(p.id, (state.cart.get(p.id) || 0) + 1);
      const inp = $('[data-mqty]', el);
      if (inp) inp.value = state.cart.get(p.id) || 0;
    } else if (b.dataset.mdec) {
      setQty(p.id, Math.max(0, (state.cart.get(p.id) || 0) - 1));
      const inp = $('[data-mqty]', el);
      if (inp) inp.value = state.cart.get(p.id) || 0;
    } else if (b.dataset.madd) {
      if ((state.cart.get(p.id) || 0) === 0) setQty(p.id, 1);
      toast('List updated', 'ok');
      close();
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.dataset.mqty) setQty(p.id, Number(e.target.value) || 0);
  });
}


function filtered() {
  const list = runSearch(state.index, state.q, (p) => (!state.cat || p.category_id === state.cat) && (!state.sub || p.subcategory_id === state.sub));
  // browsing without a search: products that have a price come first
  if (!state.q.trim()) list.sort((a, b) => (b.sell_price != null) - (a.sell_price != null));
  return list;
}

function render() {
  const list = filtered();
  const slice = list.slice(0, state.shown);
  $('#grid').innerHTML = slice.map(cardHtml).join('');
  $('#count').textContent = list.length ? `${list.length} product${list.length === 1 ? '' : 's'}` : '';
  $('#more').hidden = list.length <= state.shown;
  if (!list.length) $('#grid').innerHTML = `<div class="empty" style="grid-column:1/-1">No products found${state.q ? ` for “${esc(state.q)}”` : ''}.<br>Try a shorter word or another spelling.</div>`;
}

const subsOf = (cat) => cat.subcategories.filter((s) => state.products.some((p) => p.subcategory_id === s.id));

function renderChips() {
  $('#cats').innerHTML =
    `<button class="chip ${state.cat ? '' : 'on'}" data-cat="">All</button>` +
    state.categories.map((c) => `<button class="chip ${state.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  const cat = state.categories.find((c) => c.id === state.cat);
  const subs = $('#subs');
  subs.hidden = !cat || subsOf(cat).length < 2;
  if (!subs.hidden) {
    subs.innerHTML =
      `<button class="chip ${state.sub ? '' : 'on'}" data-sub="">All ${esc(cat.name)}</button>` +
      subsOf(cat).map((s) => `<button class="chip ${state.sub === s.id ? 'on' : ''}" data-sub="${s.id}">${esc(s.name)}</button>`).join('');
  }
}

function refreshBar() {
  const lines = cartLines();
  const bar = $('#cartbar');
  bar.hidden = !lines.length;
  $('#cartLabel').textContent = `View list (${lines.length} item${lines.length === 1 ? '' : 's'})`;
  $('#cartTotal').textContent = money(cartTotal());
  if (cartModal) renderCart();
}

// ---------------------------------------------------------------- cart sheet
let cartModal = null;
function renderCart() {
  const lines = cartLines();
  if (!lines.length) {
    cartModal.el.innerHTML = `<div class="head"><h2>Your list</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="empty">Your list is empty.<br>Add products to prepare a quotation PDF.</div>`;
    return;
  }
  const saved = $('#custName', cartModal.el)?.value ?? (localStorage.getItem(NAME_KEY) || '');
  cartModal.el.innerHTML = `
    <div class="head"><h2>Your list</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    ${lines
      .map(
        ({ p, qty }) => `<div class="line" data-line="${p.id}">
        <div><div class="nm">${esc(p.name)}</div><div class="meta">${esc(lineLabel(p))}${lineLabel(p) ? ' · ' : ''}${money(p.sell_price)} / ${esc(p.unit)}</div>
          ${p.stock != null && qty > p.stock ? `<div class="warn">Only ${qtyText(p.stock)} ${esc(p.unit)} in stock right now</div>` : ''}</div>
        <div class="tot">${money(qty * p.sell_price)}</div>
        <div class="ctl"><div class="step"><button data-cdec="${p.id}" aria-label="Decrease">${icon('minus')}</button>
          <input data-cqty="${p.id}" type="number" inputmode="decimal" min="0" value="${qty}" aria-label="Quantity">
          <button data-cinc="${p.id}" aria-label="Increase">${icon('plus')}</button></div>
          <span class="meta">${esc(p.unit)}</span></div>
        <button class="btn sm danger" data-crem="${p.id}" aria-label="Remove ${esc(p.name)}">${icon('trash')} Remove</button></div>`
      )
      .join('')}
    <div class="totals"><span>Total</span><span>${money(cartTotal())}</span></div>
    <label class="f"><span>Your name <small class="hint">(optional, printed on the PDF)</small></span><input id="custName" maxlength="60" value="${esc(saved)}" autocomplete="name"></label>
    <div class="actions two">
      <button class="btn primary" id="dlPdf">${icon('download')} Download PDF</button>
      <button class="btn" id="prPdf">${icon('print')} Print</button>
    </div>
    <p class="note">Download the PDF and send it to the shop on WhatsApp. This is only a price list for you - it does not place an order.</p>
    <button class="btn sm danger" id="clearCart" style="margin:0 auto;display:flex">Clear list</button>`;
}

function openCart() {
  cartModal = openModal('', { onClose: () => (cartModal = null) });
  renderCart();
  const m = cartModal.el;
  m.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-close')) return cartModal?.close();
    const id = Number(t.dataset.cdec || t.dataset.cinc || t.dataset.crem);
    if (t.dataset.cdec) setQty(id, Math.max(1, (state.cart.get(id) || 1) - 1));
    else if (t.dataset.cinc) setQty(id, (state.cart.get(id) || 0) + 1);
    else if (t.dataset.crem) setQty(id, 0);
    else if (t.id === 'clearCart') {
      if (confirm('Remove everything from your list?')) {
        state.cart.clear();
        saveCart();
        $$('[data-card]').forEach((c) => refreshCard(Number(c.dataset.card)));
        refreshBar();
      }
    } else if (t.id === 'dlPdf' || t.id === 'prPdf') {
      const customer = $('#custName', m).value.trim();
      try { localStorage.setItem(NAME_KEY, customer); } catch {}
      const payload = { lines: cartLines(), customer };
      if (t.id === 'dlPdf') {
        t.disabled = true;
        try {
          const { doc, filename } = await makePdf(payload);
          doc.save(filename);
        } catch (err) {
          console.error(err);
          toast('Could not create the PDF. Try Print instead.', 'err');
        }
        t.disabled = false;
      } else {
        $('#printArea').innerHTML = printHtml(payload, esc);
        setTimeout(() => window.print(), 50);
      }
    }
  });
  m.addEventListener('change', (e) => {
    const id = Number(e.target.dataset.cqty);
    if (id) setQty(id, e.target.value || 1);
  });
}

// ---------------------------------------------------------------- admin login
async function openAdmin() {
  try {
    const me = await api('/api/auth/me');
    if (me.admin) return (location.href = '/admin');
  } catch {}
  const { el, close } = openModal(`
    <div class="head"><h2>Admin login</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    <form id="loginForm"><div class="err-msg" id="loginErr" hidden></div>
      <label class="f"><span>Password</span><input id="pw" type="password" autocomplete="current-password" inputmode="numeric" autofocus required></label>
      <button class="btn primary block" type="submit">Open admin</button></form>`);
  $('#loginForm', el).onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#loginErr', el);
    err.hidden = true;
    try {
      await api('/api/auth/login', { method: 'POST', body: { password: $('#pw', el).value } });
      location.href = '/admin';
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      $('#pw', el).select();
    }
  };
  return close;
}

// ---------------------------------------------------------------- events
function bind() {
  const q = $('#q');
  const onInput = debounce(() => {
    state.q = q.value;
    state.shown = PAGE;
    $('#clearQ').hidden = !q.value;
    render();
  });
  q.addEventListener('input', onInput);
  q.addEventListener('keydown', (e) => e.key === 'Enter' && q.blur());
  $('#clearQ').onclick = () => {
    q.value = '';
    onInput();
    q.focus();
  };
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat ? Number(b.dataset.cat) : null;
    state.sub = null;
    state.shown = PAGE;
    renderChips();
    render();
  });
  $('#subs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sub]');
    if (!b) return;
    state.sub = b.dataset.sub ? Number(b.dataset.sub) : null;
    state.shown = PAGE;
    renderChips();
    render();
  });
  $('#more').onclick = () => {
    state.shown += PAGE;
    render();
  };
  $('#grid').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) {
      if (b.dataset.add) setQty(Number(b.dataset.add), 1);
      else if (b.dataset.inc) setQty(Number(b.dataset.inc), (state.cart.get(Number(b.dataset.inc)) || 0) + 1);
      else if (b.dataset.dec) setQty(Number(b.dataset.dec), (state.cart.get(Number(b.dataset.dec)) || 0) - 1);
      return;
    }
    if (e.target.closest('input')) return;
    const card = e.target.closest('[data-card]');
    if (card) {
      const p = byId(Number(card.dataset.card));
      if (p) openProductDetails(p);
    }
  });
  $('#grid').addEventListener('change', (e) => {
    if (e.target.dataset.qty) setQty(Number(e.target.dataset.qty), e.target.value);
  });
  $('#openCart').onclick = openCart;
  $('#adminBtn').onclick = openAdmin;
}

async function init() {
  $('#adminBtn').innerHTML = icon('user');
  $('#searchIcon').innerHTML = icon('search');
  $('#clearQ').innerHTML = icon('close');
  $('#cartIcon').innerHTML = icon('cart');
  loadCart();
  bind();
  $('#grid').innerHTML = '<div class="skeleton" style="grid-column:1/-1">Loading products…</div>';
  try {
    const data = await api('/api/catalog');
    state.categories = data.categories.filter((c) => data.products.some((p) => p.category_id === c.id));
    state.products = data.products;
    state.index = buildIndex(data.products, data.categories);
  } catch (e) {
    $('#grid').innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(e.message)}<br><button class="btn" style="margin-top:12px" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  // drop cart items that are no longer sold or no longer have a price
  for (const id of [...state.cart.keys()]) if (!byId(id) || byId(id).sell_price == null) state.cart.delete(id);
  saveCart();
  renderChips();
  render();
  refreshBar();
  if (new URLSearchParams(location.search).has('login')) openAdmin();
}
init();

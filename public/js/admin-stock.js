// Admin: Stock tab (reorder list + history), Sell tab, Receive / Adjust dialogs.
import { $, $$, esc, money, qtyText, api, toast, openModal, icon } from './common.js';
import { S, actions, views, reloadAndRender, byId, isLow, suggested, reorderQty, prowHtml, nums, picker, productTitle, showError, today } from './admin-core.js';

const stockState = { mode: 'reorder', list: 'low', histType: '', histDays: '7' };

// ---------------------------------------------------------------- Stock tab
views.stock = {
  render(root) {
    root.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="recv">${icon('plus')} Receive stock</button><button class="btn" id="adj">Set stock</button></div>
      <div class="seg" style="margin-bottom:12px"><button data-mode="reorder" class="${stockState.mode === 'reorder' ? 'on' : ''}">Reorder list</button>
        <button data-mode="history" class="${stockState.mode === 'history' ? 'on' : ''}">History</button></div>
      <div id="stockbody"></div>`;
    $('#recv').onclick = () => actions.receive();
    $('#adj').onclick = () => actions.adjust();
    root.querySelector('.seg').onclick = (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) { stockState.mode = b.dataset.mode; views.stock.render(root); }
    };
    if (stockState.mode === 'reorder') renderReorder($('#stockbody'));
    else renderHistory($('#stockbody'));
  },
};

function renderReorder(body) {
  const active = S.products.filter((p) => p.active);
  const low = active.filter(isLow);
  const unset = active.filter((p) => p.stock == null);
  const ok = active.filter((p) => p.stock != null && !isLow(p));
  const shown = { low, unset, ok }[stockState.list];
  body.innerHTML = `
    <div class="stats">
      <button data-list="low" class="${stockState.list === 'low' ? 'on' : ''}"><b style="color:${low.length ? '#9a5b00' : 'inherit'}">${low.length}</b><span>Low / out</span></button>
      <button data-list="ok" class="${stockState.list === 'ok' ? 'on' : ''}"><b>${ok.length}</b><span>Stock OK</span></button>
      <button data-list="unset" class="${stockState.list === 'unset' ? 'on' : ''}"><b>${unset.length}</b><span>Stock not set</span></button>
    </div>
    ${stockState.list === 'low'
      ? `<p class="note">Items that are out or below their alert level. You decide what to order - nothing is ordered automatically.</p>`
      : stockState.list === 'unset' ? `<p class="note">Tap a product, then <b>Set stock</b>, to enter how many you have.</p>` : ''}
    ${stockState.list === 'low' && low.length ? `<div class="toolbar"><button class="btn sm" id="copyList">Copy reorder list</button></div>` : ''}
    <div class="${stockState.list === 'low' ? 'reorder' : 'rows'}" id="slist"></div>`;
  const list = $('#slist');
  if (!shown.length) list.innerHTML = `<div class="empty">${stockState.list === 'low' ? 'Nothing is low on stock. 👍' : 'Nothing here.'}</div>`;
  else if (stockState.list === 'low') {
    list.innerHTML = shown
      .map((p) => {
        const sug = suggested(p);
        return `<div class="rrow" data-id="${p.id}">
          <div><b>${esc(p.name)}</b> <span class="pill ${p.stock <= 0 ? 'err' : 'warn'}">${p.stock <= 0 ? 'Out' : 'Low'}</span><div class="meta">${esc(productTitle(p))}</div></div>
          <div class="nums"><div><small>Stock</small><b>${qtyText(p.stock)} ${esc(p.unit)}</b></div><div><small>Minimum</small><b>${p.min_stock == null ? '—' : qtyText(p.min_stock)}</b></div>
            <div><small>Last buy ₹</small><b>${p.last_purchase_price == null ? '—' : money(p.last_purchase_price)}</b></div></div>
          <div class="meta">Supplier: ${p.supplier ? esc(p.supplier) : '<i>not set</i>'}</div>
          <div class="ctl"><label class="f"><span>Order qty <small class="hint">${sug == null ? '(set a minimum/target)' : `(suggested ${qtyText(sug)})`}</small></span>
            <input data-reorder="${p.id}" inputmode="decimal" value="${reorderQty(p) ?? ''}" placeholder="—"></label>
            <button class="btn sm" data-recv="${p.id}">Receive</button></div></div>`;
      })
      .join('');
  } else list.innerHTML = shown.map(prowHtml).join('');

  body.onclick = (e) => {
    const l = e.target.closest('[data-list]');
    if (l) { stockState.list = l.dataset.list; renderReorder(body); return; }
    const r = e.target.closest('[data-recv]');
    if (r) return actions.receive(byId(Number(r.dataset.recv)));
    const row = e.target.closest('.prow');
    if (row) return actions.quick(byId(Number(row.dataset.id)));
    if (e.target.id === 'copyList') {
      const lines = low.map((p) => `${p.name}${productTitle(p) ? ' (' + productTitle(p) + ')' : ''} - ${reorderQty(p) ?? '?'} ${p.unit}${p.supplier ? ' [' + p.supplier + ']' : ''}`);
      const text = 'Reorder list - Gurukrupa Electrical\n' + lines.join('\n');
      navigator.clipboard?.writeText(text).then(() => toast('Reorder list copied', 'ok'), () => toast('Could not copy', 'err'));
    }
  };
  body.onchange = async (e) => {
    const id = Number(e.target.dataset.reorder);
    if (!id) return;
    const p = byId(id);
    try {
      await api(`/api/admin/products/${id}`, { method: 'PUT', body: { ...p, reorder_qty: e.target.value.trim() } });
      toast('Order quantity saved', 'ok');
      await reloadAndRender();
    } catch (ex) {
      toast(ex.message, 'err');
      e.target.value = reorderQty(p) ?? '';
    }
  };
}

const TYPE = { received: ['Received', 'ok'], sold: ['Sold', 'err'], adjustment: ['Adjusted', 'gray'] };
function movementRows(rows) {
  if (!rows.length) return '<div class="empty">No movements yet.</div>';
  return `<table class="hist"><thead><tr><th>Date</th><th>Product</th><th class="r">Qty</th></tr></thead><tbody>${rows
    .map((m) => `<tr><td>${esc(m.date.slice(5).split('-').reverse().join('/'))}<br><span class="pill ${TYPE[m.type][1]}">${TYPE[m.type][0]}</span></td>
      <td><b>${esc(m.name)}</b><div class="meta">${esc([m.brand, m.spec].filter(Boolean).join(' · '))}</div>
        <div class="meta">${m.unit_price != null ? (m.type === 'sold' ? 'Sold at ' : 'Bought at ') + money(m.unit_price) : ''}${m.supplier ? ' · ' + esc(m.supplier) : ''}${m.note ? ' · ' + esc(m.note) : ''}</div></td>
      <td class="r"><span class="${m.qty_change >= 0 ? 'in-q' : 'out-q'}">${m.qty_change > 0 ? '+' : ''}${qtyText(m.qty_change)}</span> ${esc(m.unit)}<div class="meta">balance ${qtyText(m.balance_after)}</div></td></tr>`)
    .join('')}</tbody></table>`;
}

async function renderHistory(body) {
  body.innerHTML = `<div class="toolbar">
    <select class="in" id="ht">${[['', 'All movements'], ['received', 'Stock received'], ['sold', 'Stock sold'], ['adjustment', 'Adjustments']].map(([v, l]) => `<option value="${v}" ${stockState.histType === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="in" id="hd">${[['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['0', 'All time']].map(([v, l]) => `<option value="${v}" ${stockState.histDays === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div id="hbody"><div class="skeleton">Loading…</div></div>`;
  $('#ht').onchange = (e) => { stockState.histType = e.target.value; renderHistory(body); };
  $('#hd').onchange = (e) => { stockState.histDays = e.target.value; renderHistory(body); };
  try {
    const q = new URLSearchParams({ limit: 300 });
    if (stockState.histType) q.set('type', stockState.histType);
    if (stockState.histDays !== '0') {
      const d = new Date();
      d.setDate(d.getDate() - (Number(stockState.histDays) - 1));
      q.set('from', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    $('#hbody').innerHTML = movementRows(await api('/api/admin/movements?' + q));
  } catch (ex) {
    $('#hbody').innerHTML = `<div class="empty">${esc(ex.message)}</div>`;
  }
}

// ---------------------------------------------------------------- Receive stock
actions.receive = (preset) => {
  const { el, close } = openModal(`<div class="head"><h2>Receive stock</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div><div id="rbody"></div>`);
  const show = (p) => {
    $('#rbody', el).innerHTML = `<div class="panel" style="background:#f6f6f3"><b>${esc(p.name)}</b><div class="meta">${esc(productTitle(p))}</div>
        <div class="meta">Current stock: <b>${p.stock == null ? 'not set' : qtyText(p.stock) + ' ' + esc(p.unit)}</b></div>
        ${preset ? '' : '<button class="btn sm" id="rchg" style="margin-top:6px">Change product</button>'}</div>
      <form id="rf" novalidate><div class="err-msg" id="rerr" hidden></div>
        <div class="row2"><label class="f"><span>Quantity received *</span><input id="r_qty" inputmode="decimal" autofocus required></label>
          <label class="f"><span>Buy price ₹ / ${esc(p.unit)}</span><input id="r_price" inputmode="decimal" value="${p.last_purchase_price ?? p.cost_price ?? ''}"></label></div>
        <div class="row2"><label class="f"><span>Supplier</span><input id="r_sup" maxlength="80" value="${esc(p.supplier)}"></label>
          <label class="f"><span>Date</span><input id="r_date" type="date" value="${today()}" max="${today()}"></label></div>
        <label class="f"><span>Note</span><input id="r_note" maxlength="200" placeholder="Bill no., remarks…"></label>
        <label class="check"><input type="checkbox" id="r_upd" checked> Also make this the product's purchase price</label>
        <div class="actions"><button class="btn primary block" type="submit">Add to stock</button></div></form>`;
    $('#rchg', el)?.addEventListener('click', pick);
    $('#rf', el).onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#rerr', el);
      showError(err, '');
      try {
        const out = await api('/api/admin/stock/receive', { method: 'POST', body: { product_id: p.id, qty: $('#r_qty', el).value, price: $('#r_price', el).value, supplier: $('#r_sup', el).value, date: $('#r_date', el).value, note: $('#r_note', el).value, update_cost: $('#r_upd', el).checked } });
        toast(`Stock updated: ${qtyText(out.stock)} ${out.unit} of ${out.name}`, 'ok');
        close();
        await reloadAndRender();
      } catch (ex) {
        showError(err, ex.message);
      }
    };
  };
  const pick = () => picker($('#rbody', el), { onPick: show, filter: (p) => p.active });
  preset ? show(preset) : pick();
};

// ---------------------------------------------------------------- Set stock (manual adjustment)
actions.adjust = (preset) => {
  const { el, close } = openModal(`<div class="head"><h2>Set stock</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div><div id="abody"></div>`);
  const show = (p) => {
    $('#abody', el).innerHTML = `<div class="panel" style="background:#f6f6f3"><b>${esc(p.name)}</b><div class="meta">${esc(productTitle(p))}</div>
        <div class="meta">System says: <b>${p.stock == null ? 'not set' : qtyText(p.stock) + ' ' + esc(p.unit)}</b></div>
        ${preset ? '' : '<button class="btn sm" id="achg" style="margin-top:6px">Change product</button>'}</div>
      <form id="af" novalidate><div class="err-msg" id="aerr" hidden></div>
        <label class="f"><span>Actual quantity on the shelf *</span><input id="a_qty" inputmode="decimal" value="${p.stock ?? ''}" autofocus required></label>
        <label class="f"><span>Reason *</span><input id="a_note" maxlength="200" placeholder="${p.stock == null ? 'Opening stock' : 'Stock count / damaged / returned…'}" value="${p.stock == null ? 'Opening stock' : ''}" required></label>
        <label class="f"><span>Date</span><input id="a_date" type="date" value="${today()}" max="${today()}"></label>
        <label class="check"><input type="checkbox" id="a_neg"> Allow negative stock <small class="hint">(only if you really mean it)</small></label>
        <div class="actions"><button class="btn primary block" type="submit">Save stock</button></div></form>`;
    $('#achg', el)?.addEventListener('click', pick);
    $('#af', el).onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#aerr', el);
      showError(err, '');
      try {
        const out = await api('/api/admin/stock/adjust', { method: 'POST', body: { product_id: p.id, new_stock: $('#a_qty', el).value, note: $('#a_note', el).value, date: $('#a_date', el).value, allow_negative: $('#a_neg', el).checked } });
        toast(`${out.name}: stock is now ${qtyText(out.stock)} ${out.unit}`, 'ok');
        close();
        await reloadAndRender();
      } catch (ex) {
        showError(err, ex.message);
      }
    };
  };
  const pick = () => picker($('#abody', el), { onPick: show });
  preset ? show(preset) : pick();
};

// ---------------------------------------------------------------- Sell tab
let sellProduct = null;
views.sell = {
  async render(root) {
    root.innerHTML = `<div class="panel"><h3>Record a sale</h3><p class="note" style="margin-top:0">Use this when a customer actually buys something. It reduces your stock.</p><div id="sellbody"></div></div>
      <div class="panel"><h3>Today's sales <span id="todayTotal" class="pill ok" hidden></span></h3><div id="todaylist"><div class="skeleton" style="padding:20px 0">Loading…</div></div></div>`;
    drawSell();
    loadToday();
  },
};

function drawSell() {
  const body = $('#sellbody');
  if (!body) return;
  if (!sellProduct) return picker(body, { onPick: (p) => { sellProduct = p; drawSell(); }, filter: (p) => p.active, placeholder: 'Search product to sell…', autofocus: false });
  const p = byId(sellProduct.id) || sellProduct;
  sellProduct = p;
  const noStock = p.stock == null;
  body.innerHTML = `<div class="panel" style="background:#f6f6f3;margin-bottom:12px"><b>${esc(p.name)}</b><div class="meta">${esc(productTitle(p))}</div>${nums(p)}
      <button class="btn sm" id="schg" style="margin-top:8px">Change product</button></div>
    ${noStock
      ? `<div class="err-msg">Stock for this product is not set yet. Enter the stock you have first.</div><button class="btn primary block" id="setStock">Set stock now</button>`
      : `<form id="sf" novalidate><div class="err-msg" id="serr" hidden></div>
        <div class="row2"><label class="f"><span>Quantity sold (${esc(p.unit)}) *</span><input id="s_qty" inputmode="decimal" value="1" style="font-size:22px;font-weight:700;text-align:center" required></label>
          <label class="f"><span>Price ₹ / ${esc(p.unit)} *</span><input id="s_price" inputmode="decimal" value="${p.sell_price ?? ''}" style="font-size:22px;font-weight:700;text-align:center" ${p.sell_price == null ? 'placeholder="enter"' : ''} required></label></div>
        <div class="totals" style="padding-top:0"><span>Total</span><span id="s_total">—</span></div>
        <label class="f"><span>Note <small class="hint">(optional)</small></span><input id="s_note" maxlength="200"></label>
        <button class="btn primary block" type="submit" style="min-height:54px;font-size:17px">Confirm sale</button></form>`}`;
  $('#schg', body).onclick = () => { sellProduct = null; drawSell(); };
  $('#setStock', body)?.addEventListener('click', () => actions.adjust(p));
  const sf = $('#sf', body);
  if (!sf) return;
  const upd = () => {
    const t = parseFloat($('#s_qty', body).value) * parseFloat($('#s_price', body).value);
    $('#s_total', body).textContent = Number.isFinite(t) ? money(t) : '—';
  };
  upd();
  $('#s_qty', body).oninput = $('#s_price', body).oninput = upd;
  sf.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#serr', body);
    showError(err, '');
    const qty = $('#s_qty', body).value;
    if (!confirm(`Sell ${qty} ${p.unit} of ${p.name}?`)) return;
    try {
      const out = await api('/api/admin/sales', { method: 'POST', body: { product_id: p.id, qty, price: $('#s_price', body).value, note: $('#s_note', body).value, date: today() } });
      toast(`Sold ${qty} ${out.unit}. Stock left: ${qtyText(out.stock)} ${out.unit}`, 'ok');
      sellProduct = null;
      await reloadAndRender();
    } catch (ex) {
      showError(err, ex.message);
    }
  };
}
actions.sell = (p) => {
  sellProduct = p;
  actions.goto('sell');
};

async function loadToday() {
  const box = $('#todaylist');
  try {
    const rows = await api(`/api/admin/movements?type=sold&from=${today()}&to=${today()}&limit=200`);
    if (!$('#todaylist')) return;
    const total = rows.reduce((s, m) => s + -m.qty_change * (m.unit_price || 0), 0);
    const pill = $('#todayTotal');
    pill.hidden = !rows.length;
    pill.textContent = money(total);
    box.innerHTML = rows.length ? movementRows(rows) : '<div class="empty" style="padding:16px">No sales recorded today.</div>';
  } catch (ex) {
    if (box) box.innerHTML = `<div class="empty">${esc(ex.message)}</div>`;
  }
}

// Admin: Products tab, product dialog, categories.
import { $, esc, api, toast, openModal, icon, debounce, thumb } from './common.js';
import { S, actions, views, reloadAndRender, adminCardHtml, search, catOf, showError } from './admin-core.js';

const PAGE = 60;
const f = { q: '', status: 'all', cat: '', shown: PAGE };
const UNITS = ['Nos', 'Pkt', 'Mtr', 'Box', 'Set', 'Coil', 'Roll', 'Kg'];

const FILTERS = {
  all: (p) => p.active,
  nosell: (p) => p.active && p.sell_price == null,
  nostock: (p) => p.active && p.stock == null,
  inactive: (p) => !p.active,
};
const countOf = (k) => S.products.filter(FILTERS[k]).length;

function renderList() {
  const list = search(f.q, (p) => FILTERS[f.status](p) && (!f.cat || p.category_id === Number(f.cat)));
  $('#plist').innerHTML = list.slice(0, f.shown).map(adminCardHtml).join('') || '<div class="empty" style="grid-column:1/-1">No products found.</div>';
  $('#pcount').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
  $('#pmore').hidden = list.length <= f.shown;
}

views.products = {
  render(root) {
    const chips = [['all', 'All'], ['nosell', 'No selling price'], ['nostock', 'No stock count'], ['inactive', 'Inactive']];
    root.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="addP">${icon('plus')} Add product</button><button class="btn" id="manageCats">Categories</button></div>
      <div class="searchbar" style="margin-top:0"><span>${icon('search')}</span><input id="pq" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search a product…" value="${esc(f.q)}" autofocus></div>
      <div class="chips" id="pchips">${chips.map(([k, l]) => `<button class="chip ${f.status === k ? 'on' : ''}" data-st="${k}">${l}${k === 'all' ? '' : ` (${countOf(k)})`}</button>`).join('')}
        <select class="chip" id="pcat" aria-label="Category" style="padding-right:8px"><option value="">All categories</option>
          ${S.categories.map((c) => `<option value="${c.id}" ${String(c.id) === String(f.cat) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="count" id="pcount"></div><div class="grid" id="plist"></div><button class="btn more" id="pmore" hidden>Show more</button>`;
    renderList();
    $('#pq').addEventListener('input', debounce((e) => { f.q = e.target.value; f.shown = PAGE; renderList(); }));
    $('#pchips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      f.status = b.dataset.st; f.shown = PAGE;
      $('#pchips').querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('on', x === b));
      renderList();
    });
    $('#pcat').onchange = (e) => { f.cat = e.target.value; f.shown = PAGE; renderList(); };
    $('#pmore').onclick = () => { f.shown += PAGE; renderList(); };
    $('#addP').onclick = () => openProductForm(null);
    $('#manageCats').onclick = openCategories;
    const openCard = (e) => {
      const r = e.target.closest('[data-id]');
      if (r) openProductForm(S.products.find((p) => p.id === Number(r.dataset.id)));
    };
    $('#plist').onclick = openCard;
    $('#plist').onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openCard(e));
  },
};

// ---------------------------------------------------------------- image helpers
function shrinkImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('That file is not a picture we can read.'));
    img.src = url;
  });
}

// ---------------------------------------------------------------- product dialog
const v = (el) => el.value.trim();

export function openProductForm(p) {
  const isNew = !p;
  const d = { ...(p || { unit: 'Nos', active: 1, category_id: '', subcategory_id: '', name: '', brand: '', model: '', spec: '', keywords: '', notes: '', supplier: '' }) };
  let pendingImage = null; // dataURL to upload on save
  let removeImage = false;
  const catOpts = `<option value="">Choose…</option>` + S.categories.map((c) => `<option value="${c.id}" ${c.id === d.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const { el, close } = openModal(
    `<div class="head"><h2>${isNew ? 'Add product' : esc(d.name)}</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    <form id="pf" novalidate><div class="err-msg" id="pferr" hidden></div>
      <div class="photo"><div class="pic" id="pfpic" role="button" tabindex="0" aria-label="Change photo"></div>
        <button type="button" class="cam" id="pickImg" aria-label="Take or choose a photo">${icon('camera')}</button>
        <input type="file" id="pfile" accept="image/*" hidden></div>
      <div class="photo-note"><span id="photoNote"></span><button type="button" class="btn sm danger" id="rmImg">Remove photo</button></div>

      <label class="f"><span>Product name *</span><input id="f_name" maxlength="120" value="${esc(d.name)}" required></label>
      <div class="row2"><label class="f"><span>Brand / company</span><input id="f_brand" maxlength="60" value="${esc(d.brand)}"></label>
        <label class="f"><span>Size / details</span><input id="f_spec" maxlength="200" value="${esc(d.spec)}" placeholder="e.g. 9W, 1.5 sqmm"></label></div>
      <div class="row2"><label class="f"><span>Category *</span><select id="f_cat">${catOpts}</select></label>
        <label class="f"><span>Subcategory</span><select id="f_sub"></select></label></div>

      <div class="row3 pricebox">
        <label class="f"><span>Selling ₹</span><input id="f_sell" inputmode="decimal" value="${d.sell_price ?? ''}" placeholder="—"></label>
        <label class="f"><span>Buying ₹</span><input id="f_cost" inputmode="decimal" value="${d.cost_price ?? ''}" placeholder="—"></label>
        <label class="f"><span>Per</span><select id="f_unit">${UNITS.map((u) => `<option ${u === d.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
      <div class="hint" id="marginWarn" style="margin:-6px 0 10px;color:#b3261e" hidden>Selling price is lower than the buying price.</div>

      ${isNew
        ? `<label class="f"><span>Stock you have now <small class="hint">(optional)</small></span><input id="f_stock" inputmode="decimal" placeholder="—"></label>`
        : `<div class="stockline"><span>Stock: <b>${d.stock == null ? 'not counted yet' : d.stock + ' ' + esc(d.unit)}</b></span>
            <span class="stockbtns"><button type="button" class="btn sm" id="fSell" ${d.active ? '' : 'disabled'}>Sold</button> <button type="button" class="btn sm" id="fRecv">+ Received</button> <button type="button" class="btn sm" id="goAdjust">Set stock</button></span></div>`}

      <details class="more-details"><summary>More details</summary>
        <div class="row2"><label class="f"><span>Model / code</span><input id="f_model" maxlength="60" value="${esc(d.model)}"></label>
          <label class="f"><span>Supplier</span><input id="f_supplier" maxlength="80" value="${esc(d.supplier)}"></label></div>
        <div class="row2"><label class="f"><span>Alert when stock below</span><input id="f_min" inputmode="decimal" value="${d.min_stock ?? ''}" placeholder="—"></label>
          <label class="f"><span>Refill up to</span><input id="f_target" inputmode="decimal" value="${d.target_stock ?? ''}" placeholder="—"></label></div>
        <label class="f"><span>Other names customers use <small class="hint">(helps search)</small></span><input id="f_kw" maxlength="200" value="${esc(d.keywords)}"></label>
        <label class="f"><span>Private note <small class="hint">(customers never see this)</small></span><textarea id="f_notes" maxlength="500">${esc(d.notes)}</textarea></label>
        <label class="f"><span>Our code</span><input id="f_code" maxlength="30" value="${esc(d.code || '')}" placeholder="Automatic"></label>
        <label class="check"><input type="checkbox" id="f_active" ${d.active ? 'checked' : ''}> Still selling this product</label>
      </details>

      <div class="actions sticky"><button class="btn primary block" type="submit" id="pfsave" style="min-height:52px;font-size:17px">Save</button></div></form>`,
    { wide: true }
  );

  const refreshPic = () => {
    const pic = $('#pfpic', el);
    if (pendingImage) pic.innerHTML = `<img src="${pendingImage}" alt="">`;
    else if (d.image && !removeImage) pic.innerHTML = `<img src="${esc(d.image)}" alt="">`;
    else pic.innerHTML = thumb(d) || `<div class="ph">${icon('camera')}<span>No photo</span></div>`;
    const own = pendingImage || (d.image && !removeImage);
    $('#photoNote', el).textContent = own ? (pendingImage ? 'New photo - press Save to keep it' : 'Your photo') : 'Drawing shown - tap the camera to add your own photo';
    $('#rmImg', el).hidden = !own;
  };
  const refreshSubs = () => {
    const cat = catOf(Number($('#f_cat', el).value));
    $('#f_sub', el).innerHTML = `<option value="">—</option>` + (cat?.subcategories || []).map((s) => `<option value="${s.id}" ${s.id === d.subcategory_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  };
  const refreshMargin = () => {
    const c = parseFloat($('#f_cost', el).value);
    const s = parseFloat($('#f_sell', el).value);
    $('#marginWarn', el).hidden = !(c > 0 && s >= 0 && s < c);
  };
  refreshPic();
  refreshSubs();
  refreshMargin();
  $('#f_cat', el).onchange = () => { d.subcategory_id = ''; refreshSubs(); };
  $('#f_cost', el).oninput = $('#f_sell', el).oninput = refreshMargin;
  $('#pickImg', el).onclick = $('#pfpic', el).onclick = () => $('#pfile', el).click();
  $('#pfile', el).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingImage = await shrinkImage(file);
      removeImage = false;
      refreshPic();
    } catch (err) {
      showError($('#pferr', el), err.message);
    }
  };
  $('#rmImg', el).onclick = () => { pendingImage = null; removeImage = true; refreshPic(); };
  $('#goAdjust', el)?.addEventListener('click', () => { close(); actions.adjust(p); });
  $('#fRecv', el)?.addEventListener('click', () => { close(); actions.receive(p); });
  $('#fSell', el)?.addEventListener('click', () => { close(); actions.sell(p); });

  $('#pf', el).onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#pferr', el);
    showError(err, '');
    const body = {
      name: v($('#f_name', el)), brand: v($('#f_brand', el)), model: v($('#f_model', el)), spec: v($('#f_spec', el)),
      category_id: $('#f_cat', el).value, subcategory_id: $('#f_sub', el).value, unit: $('#f_unit', el).value,
      cost_price: v($('#f_cost', el)), sell_price: v($('#f_sell', el)),
      min_stock: v($('#f_min', el)), target_stock: v($('#f_target', el)), supplier: v($('#f_supplier', el)),
      keywords: v($('#f_kw', el)), notes: v($('#f_notes', el)), code: v($('#f_code', el)), active: $('#f_active', el).checked,
    };
    if (!body.name) return showError(err, 'Please type the product name.');
    if (!body.category_id) return showError(err, 'Please choose a category.');
    if (isNew) body.stock = v($('#f_stock', el));
    else { body.stock = d.stock; body.reorder_qty = d.reorder_qty; body.last_purchase_price = d.last_purchase_price; }
    const btn = $('#pfsave', el);
    btn.disabled = true;
    try {
      const saved = isNew ? await api('/api/admin/products', { method: 'POST', body }) : await api(`/api/admin/products/${p.id}`, { method: 'PUT', body });
      if (pendingImage) await api(`/api/admin/products/${saved.id}/image`, { method: 'POST', body: { dataUrl: pendingImage } });
      else if (removeImage && d.image) await api(`/api/admin/products/${saved.id}/image`, { method: 'DELETE' });
      toast(isNew ? 'Product added' : 'Saved', 'ok');
      close();
      await reloadAndRender();
    } catch (ex) {
      showError(err, ex.message);
      btn.disabled = false;
    }
  };
}
actions.edit = openProductForm;

// ---------------------------------------------------------------- categories (two simple screens: list -> one category)
function openCategories() {
  const { el } = openModal('<div id="catbody"></div>', { wide: true });
  const body = () => $('#catbody', el);
  const closeBtn = `<button class="close" data-close aria-label="Close">${icon('close')}</button>`;
  const used = (key, id) => S.products.filter((p) => p[key] === id).length;
  let openId = null;

  const run = async (fn, okMsg) => {
    try {
      await fn();
      await reloadAndRender();
      draw();
      if (okMsg) toast(okMsg, 'ok');
    } catch (ex) {
      showError($('#caterr', el), ex.message);
    }
  };

  function draw() {
    const cat = openId && catOf(openId);
    if (!cat) { openId = null; return drawList(); }
    drawOne(cat);
  }

  function drawList() {
    body().innerHTML = `<div class="head"><h2>Categories</h2>${closeBtn}</div><div class="err-msg" id="caterr" hidden></div>
      <div class="rows">${S.categories.map((c) => `<button class="catrow" data-open="${c.id}"><span><b>${esc(c.name)}</b><br><small>${used('category_id', c.id)} products · ${c.subcategories.length} subcategories</small></span><span class="go">›</span></button>`).join('')}</div>
      <form id="newcat" class="addline"><input class="in" id="nc_name" maxlength="60" placeholder="New category name" aria-label="New category name"><button class="btn primary" type="submit">Add</button></form>`;
    $('#newcat', el).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#nc_name', el).value.trim();
      if (name) run(() => api('/api/admin/categories', { method: 'POST', body: { name, icon: 'box' } }), 'Category added');
    };
  }

  function drawOne(c) {
    const n = used('category_id', c.id);
    body().innerHTML = `<div class="head"><button class="btn sm" id="back">‹ All categories</button>${closeBtn}</div><div class="err-msg" id="caterr" hidden></div>
      <div class="panel"><div style="display:flex;gap:8px;align-items:center"><h3 style="flex:1;margin:0">${esc(c.name)}</h3><button class="btn sm" id="renCat">Rename</button></div></div>
      <h3 style="margin:12px 0 8px;font-size:15px">Subcategories</h3>
      <div class="rows">${c.subcategories.map((s) => `<div class="subrow"><span>${esc(s.name)}<br><small>${used('subcategory_id', s.id)} products</small></span>
        <span><button class="btn sm" data-rensub="${s.id}">Rename</button> <button class="btn sm danger" data-delsub="${s.id}" aria-label="Delete ${esc(s.name)}">Delete</button></span></div>`).join('') || '<div class="empty" style="padding:12px">No subcategories yet.</div>'}</div>
      <form id="newsub" class="addline"><input class="in" id="ns_name" maxlength="60" placeholder="New subcategory name" aria-label="New subcategory name"><button class="btn primary" type="submit">Add</button></form>
      <button class="btn danger block" id="delCat" style="margin-top:16px" ${n ? 'disabled' : ''}>${n ? `Can't delete: ${n} products use it` : 'Delete this category'}</button>`;
    $('#back', el).onclick = () => { openId = null; drawList(); };
    $('#renCat', el).onclick = () => {
      const name = prompt('Category name', c.name);
      if (name?.trim()) run(() => api(`/api/admin/categories/${c.id}`, { method: 'PUT', body: { name, icon: c.icon } }));
    };
    $('#newsub', el).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#ns_name', el).value.trim();
      if (name) run(() => api('/api/admin/subcategories', { method: 'POST', body: { category_id: c.id, name } }), 'Subcategory added');
    };
    $('#delCat', el).onclick = () => {
      if (confirm(`Delete the category "${c.name}"?`)) run(async () => { await api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }); openId = null; }, 'Category deleted');
    };
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-close')) return el.closest('.modal-wrap').remove(), document.body.classList.remove('noscroll');
    if (t.dataset.open) { openId = Number(t.dataset.open); draw(); }
    else if (t.dataset.rensub) {
      const s = catOf(openId).subcategories.find((x) => x.id === Number(t.dataset.rensub));
      const name = prompt('Subcategory name', s.name);
      if (name?.trim()) run(() => api(`/api/admin/subcategories/${s.id}`, { method: 'PUT', body: { name } }));
    } else if (t.dataset.delsub) {
      if (confirm('Delete this subcategory?')) run(() => api(`/api/admin/subcategories/${t.dataset.delsub}`, { method: 'DELETE' }), 'Subcategory deleted');
    }
  });
  drawList();
}
actions.categories = openCategories;

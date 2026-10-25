// Admin: Products tab, product form, category manager.
import { $, $$, esc, api, toast, openModal, icon, debounce, thumb } from './common.js';
import { S, actions, views, reloadAndRender, prowHtml, search, catOf, showError } from './admin-core.js';

const PAGE = 60;
const f = { q: '', status: 'active', cat: '', shown: PAGE };
const UNITS = ['Nos', 'Pkt', 'Mtr', 'Box', 'Set', 'Coil', 'Roll', 'Kg'];
const ICONS = ['fan', 'bulb', 'switch', 'box', 'breaker', 'wire', 'pipe', 'clamp', 'tools', 'battery'];

const FILTERS = {
  active: (p) => p.active,
  all: () => true,
  inactive: (p) => !p.active,
  nosell: (p) => p.active && p.sell_price == null,
  nocost: (p) => p.active && p.cost_price == null,
  nostock: (p) => p.active && p.stock == null,
};

function renderList() {
  const list = search(f.q, (p) => FILTERS[f.status](p) && (!f.cat || p.category_id === Number(f.cat)));
  $('#plist').innerHTML = list.slice(0, f.shown).map(prowHtml).join('') || '<div class="empty">No products match.</div>';
  $('#pcount').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
  $('#pmore').hidden = list.length <= f.shown;
}

views.products = {
  render(root) {
    root.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="addP">${icon('plus')} Add product</button><button class="btn" id="manageCats">Categories</button></div>
      <div class="searchbar" style="margin-top:0"><span>${icon('search')}</span><input id="pq" type="search" autocomplete="off" placeholder="Search products…" value="${esc(f.q)}"></div>
      <div class="toolbar">
        <select class="in" id="pstatus" aria-label="Show">
          ${[['active', 'Active products'], ['all', 'All products'], ['inactive', 'Inactive'], ['nosell', 'No selling price'], ['nocost', 'No purchase price'], ['nostock', 'Stock not set']]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select class="in" id="pcat" aria-label="Category"><option value="">All categories</option>
          ${S.categories.map((c) => `<option value="${c.id}" ${String(c.id) === String(f.cat) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="count" id="pcount"></div><div class="rows" id="plist"></div><button class="btn more" id="pmore" hidden>Show more</button>`;
    renderList();
    $('#pq').addEventListener('input', debounce((e) => { f.q = e.target.value; f.shown = PAGE; renderList(); }));
    $('#pstatus').onchange = (e) => { f.status = e.target.value; f.shown = PAGE; renderList(); };
    $('#pcat').onchange = (e) => { f.cat = e.target.value; f.shown = PAGE; renderList(); };
    $('#pmore').onclick = () => { f.shown += PAGE; renderList(); };
    $('#addP').onclick = () => openProductForm(null);
    $('#manageCats').onclick = openCategories;
    $('#plist').onclick = (e) => {
      const r = e.target.closest('[data-id]');
      if (r) openProductForm(S.products.find((p) => p.id === Number(r.dataset.id)));
    };
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

// ---------------------------------------------------------------- product form
const v = (el) => el.value.trim();

export function openProductForm(p) {
  const isNew = !p;
  const d = { ...(p || { unit: 'Nos', active: 1, category_id: '', subcategory_id: '', name: '', brand: '', model: '', spec: '', keywords: '', notes: '', supplier: '' }) };
  let pendingImage = null; // dataURL to upload on save
  let removeImage = false;
  const catOpts = `<option value="">- choose -</option>` + S.categories.map((c) => `<option value="${c.id}" ${c.id === d.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const { el, close } = openModal(
    `<div class="head"><h2>${isNew ? 'Add product' : 'Edit product'}</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    <form id="pf" novalidate><div class="err-msg" id="pferr" hidden></div>
      <div class="row2" style="align-items:center;margin-bottom:12px">
        <div class="bigcard"><div class="pic" id="pfpic"></div></div>
        <div style="display:grid;gap:8px"><input type="file" id="pfile" accept="image/*" hidden>
          <button type="button" class="btn sm" id="pickImg">${icon('camera')} Choose photo</button>
          <button type="button" class="btn sm danger" id="rmImg">Remove photo</button></div></div>
      <label class="f"><span>Product name *</span><input id="f_name" maxlength="120" value="${esc(d.name)}" required></label>
      <div class="row2"><label class="f"><span>Brand</span><input id="f_brand" maxlength="60" value="${esc(d.brand)}"></label>
        <label class="f"><span>Model / code</span><input id="f_model" maxlength="60" value="${esc(d.model)}"></label></div>
      <label class="f"><span>Specification <small class="hint">(shown to customers)</small></span><input id="f_spec" maxlength="200" value="${esc(d.spec)}"></label>
      <div class="row2"><label class="f"><span>Category *</span><select id="f_cat">${catOpts}</select></label>
        <label class="f"><span>Subcategory</span><select id="f_sub"></select></label></div>
      <fieldset><legend>Prices</legend><div class="row3">
        <label class="f"><span>Unit</span><select id="f_unit">${UNITS.map((u) => `<option ${u === d.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="f"><span>Buy ₹</span><input id="f_cost" inputmode="decimal" value="${d.cost_price ?? ''}" placeholder="Not set"></label>
        <label class="f"><span>Sell ₹</span><input id="f_sell" inputmode="decimal" value="${d.sell_price ?? ''}" placeholder="Not set"></label></div>
        <div class="hint" id="marginWarn" style="margin:-4px 0 10px;color:#b3261e" hidden>Selling price is below the purchase price.</div></fieldset>
      <fieldset><legend>Stock</legend>
        ${isNew
          ? `<label class="f"><span>Opening stock</span><input id="f_stock" inputmode="decimal" placeholder="Not set"></label>`
          : `<div class="check" style="justify-content:space-between"><span>Current: <b>${d.stock == null ? 'Not set' : d.stock + ' ' + esc(d.unit)}</b></span><button type="button" class="btn sm" id="goAdjust">Change stock</button></div>`}
        <div class="row2"><label class="f"><span>Minimum stock</span><input id="f_min" inputmode="decimal" value="${d.min_stock ?? ''}" placeholder="Not set"></label>
          <label class="f"><span>Target stock <small class="hint">(reorder up to)</small></span><input id="f_target" inputmode="decimal" value="${d.target_stock ?? ''}" placeholder="Not set"></label></div>
        <label class="f"><span>Supplier</span><input id="f_supplier" maxlength="80" value="${esc(d.supplier)}"></label></fieldset>
      <label class="f"><span>Extra search words <small class="hint">(e.g. other names customers use)</small></span><input id="f_kw" maxlength="200" value="${esc(d.keywords)}"></label>
      <label class="f"><span>Private notes <small class="hint">(never shown to customers)</small></span><textarea id="f_notes" maxlength="500">${esc(d.notes)}</textarea></label>
      <label class="f"><span>Our product code</span><input id="f_code" maxlength="30" value="${esc(d.code || '')}" placeholder="Auto (GK-0001…)"></label>
      <label class="check"><input type="checkbox" id="f_active" ${d.active ? 'checked' : ''}> Active (sold and visible to customers)</label>
      <div class="actions"><button class="btn primary block" type="submit" id="pfsave">Save product</button></div></form>`,
    { wide: true }
  );

  const refreshPic = () => {
    const pic = $('#pfpic', el);
    if (pendingImage) pic.innerHTML = `<img src="${pendingImage}" alt="">`;
    else if (d.image && !removeImage) pic.innerHTML = `<img src="${esc(d.image)}" alt="">`;
    else pic.innerHTML = thumb(d) || `<div class="ph">${icon('camera')}<span>No photo</span></div>`;
  };
  const refreshSubs = () => {
    const cat = catOf(Number($('#f_cat', el).value));
    $('#f_sub', el).innerHTML = `<option value="">- none -</option>` + (cat?.subcategories || []).map((s) => `<option value="${s.id}" ${s.id === d.subcategory_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  };
  const refreshMargin = () => {
    const c = parseFloat($('#f_cost', el).value);
    const s = parseFloat($('#f_sell', el).value);
    $('#marginWarn', el).hidden = !(c > 0 && s >= 0 && s < c);
  };
  refreshPic();
  refreshSubs();
  refreshMargin();
  $('#f_cat', el).onchange = () => { d.subcategory_id = ''; refreshSubs(); refreshPic(); };
  $('#f_cost', el).oninput = $('#f_sell', el).oninput = refreshMargin;
  $('#pickImg', el).onclick = () => $('#pfile', el).click();
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
    if (!body.name) return showError(err, 'Product name is required.');
    if (!body.category_id) return showError(err, 'Please choose a category.');
    if (isNew) body.stock = v($('#f_stock', el));
    else { body.stock = d.stock; body.reorder_qty = d.reorder_qty; body.last_purchase_price = d.last_purchase_price; }
    const btn = $('#pfsave', el);
    btn.disabled = true;
    try {
      const saved = isNew ? await api('/api/admin/products', { method: 'POST', body }) : await api(`/api/admin/products/${p.id}`, { method: 'PUT', body });
      if (pendingImage) await api(`/api/admin/products/${saved.id}/image`, { method: 'POST', body: { dataUrl: pendingImage } });
      else if (removeImage && d.image) await api(`/api/admin/products/${saved.id}/image`, { method: 'DELETE' });
      toast(isNew ? 'Product added' : 'Product saved', 'ok');
      close();
      await reloadAndRender();
    } catch (ex) {
      showError(err, ex.message);
      btn.disabled = false;
    }
  };
}
actions.edit = openProductForm;

// ---------------------------------------------------------------- categories
function openCategories() {
  const { el, close } = openModal(`<div class="head"><h2>Categories</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    <div id="catbody"></div>`, { wide: true });
  const draw = () => {
    $('#catbody', el).innerHTML = `<div class="err-msg" id="caterr" hidden></div>
      <div class="catlist">${S.categories.map((c) => `<div class="cat" data-cat="${c.id}">
        <div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${esc(c.name)}</b>
          <button class="btn sm" data-rencat="${c.id}">Rename</button><button class="btn sm danger" data-delcat="${c.id}">Delete</button></div>
        <div class="sub">${c.subcategories.map((s) => `<span class="chip"><span data-rensub="${s.id}" role="button" tabindex="0">${esc(s.name)}</span><span data-delsub="${s.id}" role="button" aria-label="Delete ${esc(s.name)}" style="color:#b3261e">×</span></span>`).join('')}
          <button class="chip" data-addsub="${c.id}">+ Subcategory</button></div></div>`).join('')}</div>
      <fieldset style="margin-top:14px"><legend>New category</legend>
        <div class="row2"><label class="f"><span>Name</span><input id="nc_name" maxlength="60"></label>
          <label class="f"><span>Picture</span><select id="nc_icon">${ICONS.map((i) => `<option>${i}</option>`).join('')}</select></label></div>
        <button class="btn primary" id="addcat" style="margin-bottom:12px">Add category</button></fieldset>`;
  };
  draw();
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
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-rensub],[data-delsub]');
    if (!t) return;
    if (t.id === 'addcat') {
      const name = $('#nc_name', el).value.trim();
      if (name) run(() => api('/api/admin/categories', { method: 'POST', body: { name, icon: $('#nc_icon', el).value } }), 'Category added');
    } else if (t.dataset.rencat) {
      const c = catOf(Number(t.dataset.rencat));
      const name = prompt('Rename category', c.name);
      if (name?.trim()) run(() => api(`/api/admin/categories/${c.id}`, { method: 'PUT', body: { name, icon: c.icon } }));
    } else if (t.dataset.delcat) {
      if (confirm('Delete this category? (Only possible when no product uses it.)')) run(() => api(`/api/admin/categories/${t.dataset.delcat}`, { method: 'DELETE' }), 'Category deleted');
    } else if (t.dataset.addsub) {
      const name = prompt('New subcategory name');
      if (name?.trim()) run(() => api('/api/admin/subcategories', { method: 'POST', body: { category_id: Number(t.dataset.addsub), name } }), 'Subcategory added');
    } else if (t.dataset.rensub) {
      const s = S.categories.flatMap((c) => c.subcategories).find((x) => x.id === Number(t.dataset.rensub));
      const name = prompt('Rename subcategory', s.name);
      if (name?.trim()) run(() => api(`/api/admin/subcategories/${s.id}`, { method: 'PUT', body: { name } }));
    } else if (t.dataset.delsub) {
      if (confirm('Delete this subcategory? (Only possible when no product uses it.)')) run(() => api(`/api/admin/subcategories/${t.dataset.delsub}`, { method: 'DELETE' }), 'Subcategory deleted');
    }
  });
}
actions.categories = openCategories;

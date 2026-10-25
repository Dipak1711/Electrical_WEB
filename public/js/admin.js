import { $, $$, esc, api, toast, openModal, icon, thumb, debounce, money } from './common.js';
import { S, actions, views, load, setCurrentTab, currentTab, updateBadge, prowHtml, search, nums, productTitle, byId, catOf, subOf } from './admin-core.js';
import './admin-products.js';
import './admin-stock.js';

const TABS = [
  ['find', 'Find', 'search'],
  ['products', 'Products', 'box'],
  ['stock', 'Stock', 'stock'],
  ['sell', 'Sell', 'rupee'],
  ['more', 'More', 'dots'],
];

// ---------------------------------------------------------------- Find (the main screen)
const find = { q: '', shown: 40 };
function renderFindList() {
  const list = search(find.q, () => true);
  const out = find.q.trim() ? list : list.filter((p) => p.active);
  $('#fcount').textContent = find.q.trim() ? `${out.length} found` : `${out.length} products — start typing to search`;
  $('#flist').innerHTML = out.slice(0, find.shown).map(prowHtml).join('') || '<div class="empty">Nothing found. Try fewer letters or another word.</div>';
  $('#fmore').hidden = out.length <= find.shown;
}
views.find = {
  render(root) {
    root.innerHTML = `<div class="searchbar"><span>${icon('search')}</span>
        <input id="fq" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Name, brand, model, type…" value="${esc(find.q)}" autofocus>
        <button class="clear" id="fclear" aria-label="Clear" ${find.q ? '' : 'hidden'}>${icon('close')}</button></div>
      <div class="count" id="fcount"></div><div class="rows" id="flist"></div><button class="btn more" id="fmore" hidden>Show more</button>`;
    renderFindList();
    const q = $('#fq');
    q.addEventListener('input', debounce(() => { find.q = q.value; find.shown = 40; $('#fclear').hidden = !q.value; renderFindList(); }, 40));
    $('#fclear').onclick = () => { q.value = ''; find.q = ''; $('#fclear').hidden = true; renderFindList(); q.focus(); };
    $('#fmore').onclick = () => { find.shown += 40; renderFindList(); };
    $('#flist').onclick = (e) => {
      const r = e.target.closest('[data-id]');
      if (r) actions.quick(byId(Number(r.dataset.id)));
    };
  },
};

// Quick view: the numbers at a glance + shortcuts
actions.quick = (p) => {
  const cat = catOf(p.category_id);
  const sub = subOf(p.subcategory_id);
  const { el, close } = openModal(`<div class="head"><h2 style="font-size:18px">${esc(p.name)}</h2><button class="close" data-close aria-label="Close">${icon('close')}</button></div>
    <div class="bigcard">${thumb(p) ? `<div class="pic">${thumb(p)}</div>` : ''}
      <div class="meta">${esc(productTitle(p))}${p.active ? '' : ' · <b>Inactive</b>'}</div>${nums(p)}
      <div class="meta">${esc([cat?.name, sub?.name].filter(Boolean).join(' › '))} · Code ${esc(p.code || '')}${p.supplier ? ' · Supplier: ' + esc(p.supplier) : ''}</div>
      ${p.min_stock != null ? `<div class="meta">Minimum stock: ${p.min_stock}${p.target_stock != null ? ', target ' + p.target_stock : ''}</div>` : ''}
      ${p.notes ? `<div class="meta">📝 ${esc(p.notes)}</div>` : ''}
      <div class="actions two"><button class="btn primary" id="qsell" ${p.active ? '' : 'disabled'}>Record sale</button><button class="btn" id="qrecv">Receive stock</button>
        <button class="btn" id="qedit">Edit product</button><button class="btn" id="qadj">Correct stock</button></div></div>`);
  $('#qsell', el).onclick = () => { close(); actions.sell(p); };
  $('#qrecv', el).onclick = () => { close(); actions.receive(p); };
  $('#qedit', el).onclick = () => { close(); actions.edit(p); };
  $('#qadj', el).onclick = () => { close(); actions.adjust(p); };
};

// ---------------------------------------------------------------- More
views.more = {
  render(root) {
    root.innerHTML = `
      ${S.demoPassword ? `<div class="panel" style="background:#fff2d9"><b>Demo password in use.</b><div class="meta" style="color:#7a4a00">Before putting this website online, set a private <code>ADMIN_PASSWORD</code> on the server. The server refuses to start in production with the demo password.</div></div>` : ''}
      <div class="panel"><h3>Backup &amp; export</h3><p class="note" style="margin-top:0">Download a copy of all products, prices, stock and history.</p>
        <div class="actions two"><a class="btn" href="/api/admin/export/json">${icon('download')} Full backup (JSON)</a><a class="btn" href="/api/admin/export/csv">${icon('download')} Product list (CSV / Excel)</a></div></div>
      <div class="panel"><h3>Categories</h3><p class="note" style="margin-top:0">Add, rename or remove categories and subcategories.</p><button class="btn" id="mcat">Manage categories</button></div>
      <div class="panel"><h3>Session</h3><div class="actions two"><a class="btn" href="/">View customer website</a><button class="btn danger" id="logout">Log out</button></div></div>`;
    $('#mcat').onclick = () => actions.categories();
    $('#logout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      location.href = '/';
    };
  },
};

// ---------------------------------------------------------------- shell
function goto(tab) {
  setCurrentTab(tab);
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  views[tab].render($('#view'));
  window.scrollTo(0, 0);
}
actions.goto = goto;

async function boot() {
  let me;
  try {
    me = await api('/api/auth/me');
  } catch (e) {
    $('#view').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  if (!me.admin) return location.replace('/?login=1');
  S.demoPassword = me.demoPassword;
  $('#tabs').innerHTML = TABS.map(([k, label, ic]) => `<button data-tab="${k}">${icon(ic)}<span>${label}</span>${k === 'stock' ? '<span class="badge" id="stockBadge" hidden></span>' : ''}</button>`).join('');
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) goto(b.dataset.tab);
  };
  try {
    await load();
  } catch (e) {
    if (e.status === 401) return location.replace('/?login=1');
    $('#view').innerHTML = `<div class="empty">${esc(e.message)}<br><button class="btn" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  updateBadge();
  goto('find');
}
boot();

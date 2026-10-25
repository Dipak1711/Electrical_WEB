import { $, $$, esc, api, toast, openModal, icon, thumb, debounce, money } from './common.js';
import { S, actions, views, load, setCurrentTab, currentTab, updateBadge, prowHtml, search, nums, productTitle, byId, catOf, subOf } from './admin-core.js';
import './admin-products.js';
import './admin-stock.js';

const TABS = [
  ['products', 'Products', 'box'],
  ['stock', 'Stock', 'stock'],
  ['sell', 'Sell', 'rupee'],
  ['more', 'More', 'dots'],
];

// tapping a product anywhere (stock lists, etc.) opens the same edit dialog
actions.quick = (p) => actions.edit(p);

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
  goto('products');
}
boot();

// Builds the customer's quotation / order-list PDF in the browser. Nothing here talks to the server.
const SHOP = 'Gurukrupa Electrical & Services';

const pad = (n) => String(n).padStart(2, '0');
// the standard PDF fonts have no rupee sign, so amounts are written as "Rs."
const rs = (n) => 'Rs. ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function docRef(d = new Date()) {
  return `GE-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

let logoCache;
async function loadLogo() {
  if (logoCache !== undefined) return logoCache;
  try {
    const blob = await (await fetch('/logo.png')).blob();
    const url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    logoCache = { url, ratio: img.width / img.height };
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export const lineLabel = (p) => [p.brand, p.spec].filter(Boolean).join(' - ');

export async function makePdf({ lines, customer = '' }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const now = new Date();
  const ref = docRef(now);
  const dateText = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const logo = await loadLogo();
  let y = 14;
  if (logo) {
    const h = 20;
    doc.addImage(logo.url, 'PNG', 14, y - 4, h * logo.ratio, h);
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(163, 32, 31).text(SHOP, 14, y + 4);
  }
  doc.setTextColor(163, 32, 31).setFont('helvetica', 'bold').setFontSize(13).text(SHOP, W - 14, y, { align: 'right' });
  doc.setTextColor(30).setFontSize(11).text('QUOTATION / ORDER LIST', W - 14, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90);
  doc.text(`Ref: ${ref}`, W - 14, y + 12, { align: 'right' });
  doc.text(`Date: ${dateText}`, W - 14, y + 17, { align: 'right' });
  if (customer) doc.text(`For: ${customer}`, W - 14, y + 22, { align: 'right' });

  doc.setDrawColor(163, 32, 31).setLineWidth(0.6).line(14, 40, W - 14, 40);

  const total = lines.reduce((s, l) => s + l.qty * l.p.sell_price, 0);
  doc.autoTable({
    startY: 46,
    head: [['#', 'Item', 'Unit', 'Qty', 'Rate', 'Amount']],
    body: lines.map((l, i) => [
      i + 1,
      l.p.name + (lineLabel(l.p) ? '\n' + lineLabel(l.p) : ''),
      l.p.unit,
      Number(l.qty.toFixed(2)).toString(),
      rs(l.p.sell_price),
      rs(l.qty * l.p.sell_price),
    ]),
    foot: [[{ content: 'Grand Total', colSpan: 5, styles: { halign: 'right' } }, rs(total)]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, lineColor: [220, 220, 215], lineWidth: 0.2, textColor: 30 },
    headStyles: { fillColor: [163, 32, 31], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 240, 240], textColor: [125, 23, 22], fontStyle: 'bold', fontSize: 11 },
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 14 }, 3: { cellWidth: 16, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 32, halign: 'right' } },
    showFoot: 'lastPage',
    margin: { left: 14, right: 14, bottom: 22 },
    didDrawPage: () => {
      doc.setFontSize(8).setTextColor(120).setFont('helvetica', 'normal');
      doc.text('This is a customer-prepared quotation / order list, not a confirmed order or tax invoice. Prices and availability are subject to confirmation by the shop.', 14, H - 14, { maxWidth: W - 28 });
    },
  });
  // page count is only known now
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(120).text(`${SHOP}  |  ${ref}  |  Page ${i} of ${pages}`, W - 14, H - 6, { align: 'right' });
  }
  return { doc, ref, filename: `Gurukrupa-Quotation-${ref}.pdf` };
}

// Print-friendly HTML version (browser print dialog; also lets people "Save as PDF" on desktop)
export function printHtml({ lines, customer = '' }, esc) {
  const now = new Date();
  const total = lines.reduce((s, l) => s + l.qty * l.p.sell_price, 0);
  const rows = lines
    .map(
      (l, i) => `<tr><td>${i + 1}</td><td><b>${esc(l.p.name)}</b>${lineLabel(l.p) ? `<br><small>${esc(lineLabel(l.p))}</small>` : ''}</td>
      <td>${esc(l.p.unit)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${rs(l.p.sell_price)}</td><td style="text-align:right">${rs(l.qty * l.p.sell_price)}</td></tr>`
    )
    .join('');
  return `<div style="font-family:Arial,sans-serif;color:#222;padding:8mm">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #a3201f;padding-bottom:8px">
      <img src="/logo.png" style="height:64px"><div style="text-align:right"><div style="font-size:20px;font-weight:700">QUOTATION / ORDER LIST</div>
      <div>Ref: ${docRef(now)}</div><div>Date: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>${customer ? `<div>For: ${esc(customer)}</div>` : ''}</div></div>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead><tr style="background:#a3201f;color:#fff"><th style="padding:6px">#</th><th style="text-align:left">Item</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows.replace(/<td/g, '<td style="border-bottom:1px solid #ddd;padding:6px"')}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;font-size:15px;padding:8px">Grand Total</td><td style="text-align:right;font-weight:700;font-size:15px;padding:8px">${rs(total)}</td></tr></tfoot></table>
    <p style="font-size:11px;color:#666;margin-top:16px">This is a customer-prepared quotation / order list, not a confirmed order or tax invoice. Prices and availability are subject to confirmation by the shop. - ${SHOP}</p></div>`;
}

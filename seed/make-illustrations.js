// Draws one flat vector illustration per product type into public/img/types/.  Run: node seed/make-illustrations.js
// These are generic drawings, not photos of a specific brand or model.
const fs = require('node:fs');
const path = require('node:path');

const C = { white: '#f7f7f4', light: '#e4e4df', mid: '#b9bcc0', grey: '#8c9094', dark: '#3a3e44', red: '#a3201f', yellow: '#f2b705', blue: '#2f6fb0', green: '#2e9a5a', copper: '#c9772b', black: '#26282b', cream: '#efe6d2' };
const svg = (inner, shadow = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" role="img">${shadow ? '<ellipse cx="120" cy="160" rx="70" ry="7" fill="#000" opacity=".08"/>' : ''}${inner}</svg>\n`;
const s = (f, st = C.dark, w = 2) => `fill="${f}" stroke="${st}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const rrect = (x, y, w, h, r, f, st = C.dark) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${s(f, st)}/>`;
const circ = (cx, cy, r, f, st = C.dark) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${s(f, st)}/>`;
const line = (x1, y1, x2, y2, col = C.dark, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
const path_ = (d, f, st = C.dark, w = 2) => `<path d="${d}" ${s(f, st, w)}/>`;
const screw = (cx, cy) => circ(cx, cy, 3, C.mid, C.grey) + line(cx - 2, cy, cx + 2, cy, C.grey, 1);

// reusable modular switch plate
const plate = (x, y, w, h) => rrect(x, y, w, h, 6, C.white) + screw(x + w / 2, y + 9) + screw(x + w / 2, y + h - 9);
const coil = (cx, cy, rx, ry, col, turns = 5) => {
  let o = '';
  for (let i = 0; i < turns; i++) o += `<ellipse cx="${cx}" cy="${cy - i * 3}" rx="${rx - i * 1}" ry="${ry}" fill="none" stroke="${col}" stroke-width="7"/>`;
  return o;
};

const T = {};

T['ceiling-fan'] = svg(
  rrect(110, 6, 20, 14, 4, C.mid) + `<rect x="116" y="18" width="8" height="30" fill="${C.grey}" stroke="${C.dark}" stroke-width="1.5"/>` +
  path_('M14 88 Q4 76 18 70 L100 64 Q112 68 108 82 Z', C.cream) + path_('M226 88 Q236 76 222 70 L140 64 Q128 68 132 82 Z', C.cream) +
  path_('M96 54 Q96 46 120 46 Q144 46 144 54 L144 72 Q144 84 120 84 Q96 84 96 72 Z', C.white) +
  `<ellipse cx="120" cy="54" rx="24" ry="6" fill="${C.light}" stroke="${C.dark}" stroke-width="1.5"/>` + `<ellipse cx="120" cy="86" rx="12" ry="5" fill="${C.mid}" stroke="${C.dark}" stroke-width="1.5"/>` +
  path_('M104 92 Q120 100 136 92 L140 112 Q120 120 100 112 Z', 'none', 'none', 0)
);

T['table-fan'] = svg(
  `<ellipse cx="120" cy="150" rx="40" ry="8" fill="${C.dark}"/>` + rrect(112, 100, 16, 50, 4, C.grey) +
  circ(120, 66, 44, 'none', C.dark) + circ(120, 66, 34, 'none', C.mid) + circ(120, 66, 22, 'none', C.mid) +
  path_('M120 66 Q100 40 118 30 Q130 46 120 66Z', C.blue, C.dark) + path_('M120 66 Q148 58 152 76 Q134 86 120 66Z', C.blue, C.dark) + path_('M120 66 Q96 80 88 64 Q100 54 120 66Z', C.blue, C.dark) +
  circ(120, 66, 7, C.dark) + rrect(110, 106, 20, 10, 3, C.dark)
);

T['exhaust-fan'] = svg(
  rrect(48, 20, 144, 130, 10, C.white) + circ(120, 85, 52, C.light) + circ(120, 85, 46, C.white, C.mid) +
  [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a} 120 85)" d="M120 85 Q104 56 120 40 Q140 52 120 85Z" fill="${C.blue}" stroke="${C.dark}" stroke-width="1.5"/>`).join('') +
  circ(120, 85, 8, C.dark) + [60, 180].map((x) => screw(x < 100 ? 58 : 182, x < 100 ? 30 : 140)).join('')
);

T['fan-rod'] = svg(
  rrect(112, 18, 16, 8, 3, C.mid) + `<rect x="114" y="26" width="12" height="118" fill="${C.light}" stroke="${C.dark}" stroke-width="2"/>` +
  `<rect x="117" y="26" width="3" height="118" fill="#fff" opacity=".7"/>` + rrect(108, 144, 24, 10, 3, C.mid)
);

T['fan-clamp'] = svg(
  path_('M70 130 L70 70 Q70 40 120 40 Q170 40 170 70 L170 130', 'none', C.dark, 12) + path_('M70 130 L70 70 Q70 40 120 40 Q170 40 170 70 L170 130', 'none', C.grey, 8) +
  rrect(54, 126, 32, 12, 3, C.mid) + rrect(154, 126, 32, 12, 3, C.mid) + screw(62, 132) + screw(178, 132) + circ(120, 40, 5, C.mid)
);

T['capacitor'] = svg(
  rrect(78, 50, 84, 82, 8, C.dark) + `<rect x="78" y="70" width="84" height="40" fill="${C.cream}" stroke="${C.dark}" stroke-width="2"/>` +
  `<text x="120" y="96" font-family="Arial" font-weight="700" font-size="16" text-anchor="middle" fill="${C.dark}">µF</text>` +
  line(100, 50, 100, 22, C.black, 3) + line(140, 50, 140, 22, C.black, 3) + circ(100, 20, 3, C.copper) + circ(140, 20, 3, C.copper)
);

const bulbShape = (fill) => path_('M120 18 C86 18 74 46 88 72 C96 86 100 92 100 104 L140 104 C140 92 144 86 152 72 C166 46 154 18 120 18Z', fill, C.dark);
T['led-bulb'] = svg(
  bulbShape('#fff6c8') + `<path d="M104 40 Q100 56 110 70" stroke="#fff" stroke-width="4" fill="none" opacity=".8" stroke-linecap="round"/>` +
  rrect(98, 104, 44, 14, 3, C.white) + rrect(100, 118, 40, 28, 4, C.mid) + [124, 132, 140].map((y) => line(100, y - 2, 140, y + 4, C.grey, 2)).join('') + path_('M108 146 L132 146 L126 156 L114 156Z', C.dark)
);
T['charging-bulb'] = svg(
  bulbShape('#fff6c8') + rrect(98, 104, 44, 22, 3, C.white) + circ(120, 115, 4, C.green, C.dark) + rrect(100, 126, 40, 22, 4, C.mid) + path_('M108 148 L132 148 L126 156 L114 156Z', C.dark)
);

T['led-tube'] = svg(
  rrect(14, 74, 212, 32, 16, '#fbfbf6') + `<rect x="30" y="80" width="180" height="8" rx="4" fill="#fff" opacity=".9"/>` + rrect(8, 78, 20, 24, 4, C.mid) + rrect(212, 78, 20, 24, 4, C.mid) +
  line(8, 84, 2, 84, C.grey, 3) + line(8, 96, 2, 96, C.grey, 3) + line(232, 84, 238, 84, C.grey, 3) + line(232, 96, 238, 96, C.grey, 3)
);

T['led-panel'] = svg(
  `<path d="M40 60 L200 60 L214 124 L26 124Z" fill="${C.light}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M50 68 L190 68 L202 116 L38 116Z" fill="#fffdf0" stroke="${C.mid}" stroke-width="1.5"/>` +
  `<path d="M60 76 L120 76" stroke="#fff" stroke-width="5" opacity=".9" stroke-linecap="round"/>` + rrect(100, 40, 40, 20, 4, C.mid)
);

T['lamp-holder'] = svg(
  line(120, 6, 120, 52, C.dark, 3) + rrect(104, 50, 32, 22, 4, C.white) + `<path d="M100 72 L140 72 L136 92 L104 92Z" fill="${C.light}" stroke="${C.dark}" stroke-width="2"/>` +
  rrect(106, 92, 28, 40, 6, C.mid) + [100, 108, 116, 124].map((y) => line(106, y, 134, y + 3, C.grey, 2)).join('') + rrect(110, 132, 20, 8, 3, C.dark)
);

T['switch'] = svg(
  plate(86, 28, 68, 108) + rrect(100, 52, 40, 58, 6, C.light, C.mid) + rrect(106, 58, 28, 22, 4, '#fff', C.grey) + `<rect x="110" y="86" width="20" height="3" fill="${C.grey}"/>`
);
T['socket'] = svg(
  plate(76, 34, 88, 100) + circ(120, 84, 34, C.light, C.mid) +
  rrect(104, 68, 6, 18, 2, C.dark, C.dark) + rrect(130, 68, 6, 18, 2, C.dark, C.dark) + rrect(117, 92, 6, 14, 2, C.dark, C.dark)
);
T['regulator'] = svg(
  plate(86, 28, 68, 108) + circ(120, 82, 24, C.light, C.mid) + circ(120, 82, 15, C.white, C.grey) + line(120, 82, 128, 66, C.red, 4) +
  [-50, -25, 0, 25, 50].map((a) => `<line x1="120" y1="46" x2="120" y2="52" transform="rotate(${a} 120 82)" stroke="${C.dark}" stroke-width="2"/>`).join('')
);
T['combine'] = svg(
  plate(60, 34, 120, 100) + rrect(76, 50, 32, 36, 5, C.light, C.mid) + rrect(81, 55, 22, 14, 3, '#fff', C.grey) + circ(146, 70, 20, C.light, C.mid) +
  rrect(137, 60, 4, 12, 1.5, C.dark) + rrect(151, 60, 4, 12, 1.5, C.dark) + rrect(144, 76, 4, 10, 1.5, C.dark)
);
T['plug'] = svg(
  rrect(78, 40, 84, 80, 16, C.white) + circ(120, 80, 28, C.light, C.mid) + line(120, 120, 120, 156, C.dark, 7) +
  rrect(104, 6, 8, 36, 2, C.mid, C.grey) + rrect(128, 6, 8, 36, 2, C.mid, C.grey) + rrect(112, 18, 16, 4, 1, C.dark)
);
T['extension-board'] = svg(
  rrect(26, 46, 188, 66, 10, C.white) + [0, 1, 2, 3].map((i) => circ(58 + i * 44, 79, 15, C.light, C.mid) + rrect(53 + i * 44, 70, 3, 9, 1, C.dark) + rrect(61 + i * 44, 70, 3, 9, 1, C.dark)).join('') +
  rrect(196, 52, 12, 10, 3, C.red, C.dark) + path_('M214 80 Q236 80 232 120 Q228 150 200 150', 'none', C.dark, 6)
);
T['door-bell'] = svg(
  path_('M50 130 Q50 52 120 52 Q190 52 190 130 Z', C.white) + rrect(44, 128, 152, 14, 6, C.mid) + circ(120, 46, 8, C.red, C.dark) + circ(120, 98, 22, C.light, C.mid) + `<path d="M108 98 h24 M120 86 v24" stroke="${C.grey}" stroke-width="2"/>`
);

T['gi-box'] = svg(
  rrect(48, 30, 144, 110, 6, '#c3c7cb') + rrect(62, 44, 116, 82, 4, '#dfe2e5', C.grey) + circ(76, 58, 5, C.dark) + circ(164, 58, 5, C.dark) + circ(76, 112, 5, C.dark) + circ(164, 112, 5, C.dark) +
  circ(120, 20, 7, 'none', C.grey) + circ(120, 150, 7, 'none', C.grey) + circ(38, 85, 7, 'none', C.grey) + circ(202, 85, 7, 'none', C.grey)
);
T['plate'] = svg(
  rrect(60, 28, 120, 112, 12, C.white) + circ(120, 84, 38, C.light, C.mid) + circ(120, 84, 24, C.white, C.grey) + screw(78, 44) + screw(162, 44) + screw(78, 124) + screw(162, 124)
);
T['surface-box'] = svg(
  rrect(34, 44, 172, 88, 8, C.white) + rrect(46, 56, 148, 64, 5, C.light, C.mid) + screw(44, 50) + screw(196, 50) + screw(44, 126) + screw(196, 126) +
  [0, 1, 2].map((i) => rrect(56 + i * 48, 64, 40, 48, 4, '#fff', C.grey)).join('')
);
T['pvc-board'] = svg(
  rrect(40, 22, 160, 124, 8, '#b3322f') + rrect(52, 34, 136, 100, 5, '#c9514d', '#7d1716') + rrect(66, 50, 30, 36, 4, C.light, C.dark) + rrect(106, 50, 30, 36, 4, C.light, C.dark) + circ(160, 68, 14, C.light, C.dark) +
  circ(60, 40, 3, C.mid) + circ(180, 40, 3, C.mid) + circ(60, 126, 3, C.mid) + circ(180, 126, 3, C.mid) + rrect(66, 100, 108, 18, 3, C.light, C.dark)
);

T['mcb'] = svg(
  rrect(88, 14, 64, 140, 5, C.white) + rrect(88, 14, 64, 20, 5, C.light) + rrect(100, 52, 40, 56, 6, C.dark) + rrect(108, 58, 24, 22, 3, C.red, C.dark) +
  rrect(96, 126, 48, 14, 3, C.mid, C.grey) + `<text x="120" y="42" font-family="Arial" font-weight="700" font-size="9" text-anchor="middle" fill="${C.dark}">MCB</text>`
);

const wireColors = [C.red, C.black, C.green];
T['wire-coil'] = svg(
  coil(120, 130, 70, 22, C.red, 5) + coil(120, 108, 70, 22, C.black, 3).replace(/stroke-width="7"/g, 'stroke-width="7"') +
  `<ellipse cx="120" cy="100" rx="40" ry="10" fill="${C.bg || '#f5f5f2'}" stroke="${C.mid}" stroke-width="1.5"/>` + path_('M188 126 Q214 120 220 142', 'none', C.red, 5), true
);
T['coax'] = svg(
  coil(120, 128, 66, 20, C.dark, 5) + `<ellipse cx="120" cy="104" rx="36" ry="9" fill="#f5f5f2" stroke="${C.mid}" stroke-width="1.5"/>` +
  path_('M184 124 Q214 120 218 140', 'none', C.dark, 6) + rrect(212, 138, 14, 18, 2, C.mid, C.grey) + circ(219, 147, 3, C.copper)
);

T['pica-pipe'] = svg(
  `<g>${Array.from({ length: 12 }, (_, i) => rrect(20 + i * 17, 70, 12, 40, 4, i % 2 ? '#8fa1b3' : '#a7b6c4', C.dark)).join('')}</g>` + line(20, 90, 220, 90, '#5b6c7c', 0.5)
);
T['pvc-pipe'] = svg(
  rrect(16, 66, 208, 44, 8, '#f4f4f1') + `<rect x="24" y="72" width="192" height="8" rx="4" fill="#fff"/>` + ellipse_(224, 88)
);
function ellipse_(cx, cy) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="22" fill="#e4e4df" stroke="${C.dark}" stroke-width="2"/><ellipse cx="${cx}" cy="${cy}" rx="3" ry="15" fill="#c8c8c3"/>`;
}
T['pipe-fitting'] = svg(
  path_('M40 70 L40 110 L100 110 L100 150 L140 150 L140 70 Z', '#f4f4f1') + `<ellipse cx="40" cy="90" rx="6" ry="20" fill="#e4e4df" stroke="${C.dark}" stroke-width="2"/>` + `<ellipse cx="120" cy="150" rx="20" ry="5" fill="#e4e4df" stroke="${C.dark}" stroke-width="2"/>` +
  `<path d="M60 76 L130 76" stroke="#fff" stroke-width="5" opacity=".9" stroke-linecap="round"/>`
);
T['casing'] = svg(
  `<path d="M20 70 L200 70 L220 100 L40 100Z" fill="${C.white}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M40 100 L220 100 L220 112 L40 112Z" fill="${C.light}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M20 70 L40 100 L40 112 L20 82Z" fill="${C.mid}" stroke="${C.dark}" stroke-width="2"/>` +
  `<path d="M70 82 L190 82" stroke="${C.mid}" stroke-width="2"/>`
);
T['casing-fitting'] = svg(
  `<path d="M50 60 L110 60 L110 120 L170 120 L170 140 L90 140 L90 80 L50 80Z" fill="${C.white}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M62 70 L100 70" stroke="${C.mid}" stroke-width="2"/>`
);
T['c-clamp'] = svg(
  [0, 1, 2].map((i) => `<g transform="translate(${28 + i * 62} ${i % 2 ? 30 : 40})">` + path_('M0 90 Q0 22 28 22 Q56 22 56 90', 'none', C.mid, 12) + path_('M0 90 Q0 22 28 22 Q56 22 56 90', 'none', '#fff', 5) + rrect(-8, 86, 22, 10, 2, C.mid) + rrect(42, 86, 22, 10, 2, C.mid) + `</g>`).join('')
);
T['cable-tie'] = svg(
  [0, 1, 2].map((i) => `<g transform="rotate(${-8 + i * 8} 120 90)">` + rrect(40, 70 + i * 14, 150, 8, 3, i === 1 ? C.black : C.white) + rrect(184, 66 + i * 14, 18, 16, 3, i === 1 ? C.dark : C.light) + `</g>`).join('')
);
T['tape'] = svg(
  `<ellipse cx="120" cy="96" rx="62" ry="40" fill="${C.black}" stroke="${C.dark}" stroke-width="2"/>` + `<ellipse cx="120" cy="86" rx="62" ry="40" fill="#34373c" stroke="${C.dark}" stroke-width="2"/>` +
  `<ellipse cx="120" cy="86" rx="26" ry="16" fill="#f5f5f2" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M62 92 Q56 122 40 130 L70 128Z" fill="${C.black}" stroke="${C.dark}" stroke-width="2"/>`
);
T['connector-strip'] = svg(
  rrect(40, 62, 160, 56, 6, C.white) + [0, 1, 2, 3, 4, 5].map((i) => rrect(50 + i * 25, 70, 17, 40, 3, C.light, C.mid) + circ(58.5 + i * 25, 80, 4, C.copper, C.dark)).join('')
);

T['tester'] = svg(
  `<g transform="rotate(-30 120 90)"><rect x="30" y="86" width="96" height="9" rx="2" fill="${C.mid}" stroke="${C.dark}" stroke-width="2"/><rect x="126" y="76" width="84" height="28" rx="10" fill="#e9483f" stroke="${C.dark}" stroke-width="2"/>` +
  `<rect x="140" y="82" width="26" height="16" rx="4" fill="#ffd9d5" stroke="${C.dark}" stroke-width="1.5"/><circle cx="196" cy="90" r="5" fill="${C.yellow}" stroke="${C.dark}" stroke-width="1.5"/></g>`
);
T['plier'] = svg(
  path_('M78 20 L120 84 L162 20 L150 18 L120 62 L90 18Z', C.grey) + `<path d="M104 84 L96 154 Q90 162 80 156 L76 100 Z" fill="${C.red}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M136 84 L144 154 Q150 162 160 156 L164 100 Z" fill="${C.red}" stroke="${C.dark}" stroke-width="2"/>` + circ(120, 80, 7, C.mid)
);
T['stripper'] = T['plier'].replace(new RegExp(C.red, 'g'), C.yellow);
T['screwdriver'] = svg(
  `<rect x="112" y="20" width="16" height="86" rx="4" fill="${C.mid}" stroke="${C.dark}" stroke-width="2"/>` + `<path d="M108 4 h24 v28 h-24z" fill="${C.red}" stroke="${C.dark}" stroke-width="2" transform="translate(0 100)"/>` +
  `<rect x="108" y="104" width="24" height="52" rx="8" fill="${C.red}" stroke="${C.dark}" stroke-width="2"/>`
);
T['screwdriver'] = svg(
  `<rect x="116" y="12" width="8" height="70" rx="2" fill="${C.mid}" stroke="${C.dark}" stroke-width="2"/><path d="M116 12 L124 12 L122 4 L118 4Z" fill="${C.grey}" stroke="${C.dark}" stroke-width="1.5"/>` +
  `<rect x="104" y="80" width="32" height="70" rx="12" fill="${C.red}" stroke="${C.dark}" stroke-width="2"/><rect x="104" y="104" width="32" height="14" fill="${C.yellow}" stroke="${C.dark}" stroke-width="1.5"/>`
);

T['battery'] = svg(
  rrect(54, 48, 36, 96, 6, C.copper) + rrect(60, 40, 24, 10, 2, C.mid) + rrect(54, 84, 36, 36, 0, C.dark) +
  rrect(104, 60, 34, 84, 6, C.blue) + rrect(110, 52, 22, 10, 2, C.mid) + circ(184, 100, 30, C.mid, C.dark) + circ(184, 100, 22, C.light, C.grey)
);
T['av-cable'] = svg(
  path_('M40 120 Q100 40 140 110 T210 80', 'none', C.dark, 6) + rrect(24, 108, 30, 28, 4, C.mid, C.dark) + rrect(200, 66, 28, 28, 4, C.mid, C.dark) + rrect(28, 114, 22, 12, 2, C.dark) + circ(214, 80, 6, C.yellow, C.dark)
);

const dir = path.join(__dirname, '..', 'public', 'img', 'types');
fs.mkdirSync(dir, { recursive: true });
for (const [name, body] of Object.entries(T)) fs.writeFileSync(path.join(dir, name + '.svg'), body);
console.log(Object.keys(T).length + ' illustrations written to ' + dir);

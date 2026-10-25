// ===================== shop signs: chain stores on the ground floors, night-market stalls, landmark signs =====================
// The chains are the ones on every Taipei street, under the nicknames and puns people use for them; no real logos.
const FOOD_SIGNS = [
  ['鹽酥雞', '#d9312b'], ['地瓜球', '#f2a33a'], ['烤香腸', '#d9312b'], ['豆花', '#2f9e6b'], ['大雞排', '#e0602a'],
  ['蚵仔煎', '#3a7fd5'], ['臭豆腐', '#6a7a3a'], ['大腸包小腸', '#c0322b'], ['珍珠奶茶', '#8a5a3a'], ['生煎包', '#d98a1f'],
];
const LANDMARK_SIGNS = [
  { id: 'market', text: '士林夜市', bg: '#c0221c', fg: '#ffe9a8', ring: '#ffd23a' },
  { id: 'hall', text: '士林市場', bg: '#2f6fb8', fg: '#ffffff', ring: '#ffffff' },
  { id: 'amuse', text: '兒童新樂園', bg: '#ff8a3c', fg: '#ffffff', ring: '#ffe08a' },
  { id: 'npm', text: '天下為公', bg: '#24508f', fg: '#f6e3a0', ring: '#e8c04a' },
  { id: 'astro', text: '天文館', bg: '#ffffff', fg: '#2c4f8a', ring: '#2c4f8a' },
  { id: 'ningxia', text: '寧夏夜市', bg: '#c0221c', fg: '#ffe9a8', ring: '#ffd23a' },
  { id: 'raohe', text: '饒河街夜市', bg: '#1f5fa8', fg: '#ffe9a8', ring: '#ffd23a' },
  { id: 'shida', text: '師大夜市', bg: '#2f8a5a', fg: '#ffffff', ring: '#ffe08a' },
  { id: 'ximen', text: '西門町', bg: '#e0457a', fg: '#ffffff', ring: '#ffe08a' },
  { id: 'xingtian', text: '行天宮', bg: '#1d3f7a', fg: '#f6d36a', ring: '#e8c04a' },
  { id: 'baoan', text: '保安宮', bg: '#1d3f7a', fg: '#f6d36a', ring: '#e8c04a' },
  { id: 'ciyou', text: '慈祐宮', bg: '#1d3f7a', fg: '#f6d36a', ring: '#e8c04a' },
  { id: 'confucius', text: '萬世師表', bg: '#1d3f7a', fg: '#f6d36a', ring: '#e8c04a' },
  { id: 'martyrs', text: '忠烈祠', bg: '#8a2a22', fg: '#f6d36a', ring: '#e8c04a' },
  { id: 'huashan', text: '華山1914', bg: '#5a3a2a', fg: '#ffffff', ring: '#d9a273' },
  { id: 'miramar', text: '美麗華', bg: '#ffffff', fg: '#d9312b', ring: '#d9312b' },
  { id: 'tzuchi', text: '靜思堂', bg: '#f4f1ea', fg: '#3a4a5c', ring: '#8a96a3' },
  { id: 'daai', text: '大愛電視', bg: '#2f6fb8', fg: '#ffffff', ring: '#ffffff' },
  { id: 'costco', text: '好事多', bg: '#2f7d4f', fg: '#ffffff', ring: '#f2c14e' },
  { id: 'hotdog', text: '熱狗套餐', bg: '#f2c14e', fg: '#b8352c', ring: '#ffffff' },
  { id: 'guandu', text: '關渡自然公園', bg: '#3f7f4a', fg: '#ffffff', ring: '#d9c27a' },
  { id: 'lotP', text: 'P 收費停車場', bg: '#2f6fb8', fg: '#ffffff', ring: '#ffffff' },
  { id: 'kidpark', text: '兒童遊戲場', bg: '#3f8a4a', fg: '#ffffff', ring: '#f2c14e' },
  { id: 'gas', text: '加油站', bg: '#2f9e6b', fg: '#ffffff', ring: '#ffffff' },
  { id: 'shrine', text: '福德宮', bg: '#8a2a22', fg: '#f6d36a', ring: '#e8c04a' },
];
const LSIGN = Object.fromEntries(LANDMARK_SIGNS.map((L) => [L.id, L]));
function landmarkSignDraw(L) {
  return (g, w, h) => {
    w *= 2; // two cells wide
    g.fillStyle = L.bg; roundRect(g, 6, 6, w - 12, h - 12, 18); g.fill();
    g.strokeStyle = L.ring; g.lineWidth = 6; roundRect(g, 16, 16, w - 32, h - 32, 12); g.stroke();
    g.fillStyle = L.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${L.text.length > 5 ? 58 : L.text.length > 4 ? 66 : 74}px ${FONT_CJK}`;
    g.fillText(L.text.split('').join(L.text.length > 5 ? '' : L.text.length > 4 ? ' ' : '  '), w / 2, h / 2 + 4);
  };
}
// kind: conv (convenience store), drink (tea stand), cafe, food, claw (claw machines), lotto, betel
const BRANDS = [
  { id: 'c7', name: '小七', sub: '便利商店', kind: 'conv', wt: 3.2, band: 0xffffff, bg: '#ffffff', fg: '#e8711c', stripes: [0xf08a24, 0x2f9e6b] },
  { id: 'fm', name: '全家福', sub: '便利商店', kind: 'conv', wt: 2.2, band: 0xffffff, bg: '#ffffff', fg: '#1f8f5f', stripes: [0x2f7fd5, 0x3fae5a] },
  { id: 'd49', name: '49嵐', kind: 'drink', wt: 2, band: 0x2a5aa8, bg: '#2a5aa8', fg: '#ffffff' },
  { id: 'mkd', name: '迷客冬', kind: 'drink', wt: 1.1, band: 0xf3efe2, bg: '#f3efe2', fg: '#3f7f4a' },
  { id: 'dkk', name: '都可可', kind: 'drink', wt: 1.1, band: 0xe8711c, bg: '#e8711c', fg: '#ffffff' },
  { id: 'sbb', name: '星爸爸', sub: '咖啡', kind: 'cafe', wt: 1, band: 0x1f6f4a, bg: '#1f6f4a', fg: '#ffffff' },
  { id: '84c', name: '84度C', sub: '咖啡蛋糕', kind: 'cafe', wt: 0.9, band: 0x8a3a2a, bg: '#8a3a2a', fg: '#ffffff' },
  { id: 'mdd', name: '麥當當', kind: 'food', wt: 0.9, band: 0xd9312b, bg: '#d9312b', fg: '#ffd23a' },
  { id: 'mym', name: '美又美', sub: '早餐', kind: 'food', wt: 1, band: 0xf3efe2, bg: '#ffffff', fg: '#e0602a' },
  { id: 'chk', name: '好大雞排', kind: 'food', wt: 0.8, band: 0xf2c14e, bg: '#f2c14e', fg: '#c0322b' },
  { id: 'claw', name: '夾娃娃', sub: '選物販賣機', kind: 'claw', wt: 1.2, band: 0xff6fae, bg: '#ff6fae', fg: '#ffffff' },
  { id: 'lot', name: '彩券', sub: '公益彩券', kind: 'lotto', wt: 0.8, band: 0xd9312b, bg: '#d9312b', fg: '#ffe24a' },
  { id: 'btl', name: '檳榔', sub: '香菸・飲料', kind: 'betel', wt: 1, band: 0x2b2f35, bg: '#2b2f35', fg: '#3fe07a' },
];
const BRAND_WT = BRANDS.reduce((a, b) => a + b.wt, 0);
function brandSignDraw(B) {
  return (g, w, h) => {
    w *= 2;
    g.fillStyle = B.bg; roundRect(g, 4, 6, w - 8, h - 12, 14); g.fill();
    if (B.stripes) {
      // two coloured bands under the name, the way the convenience stores do it
      B.stripes.forEach((c, i) => { g.fillStyle = '#' + new THREE.Color(c).getHexString(); g.fillRect(14, h - 34 + i * 11, w - 28, 9); });
    }
    if (B.kind === 'betel') {
      // the neon tube frame of a betel-nut stand
      for (const [c, o] of [['#ff4fa0', 12], ['#4fb3ff', 22]]) { g.strokeStyle = c; g.lineWidth = 4; roundRect(g, o, o, w - o * 2, h - o * 2, 12); g.stroke(); }
    }
    g.fillStyle = B.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const big = B.stripes ? 64 : 76;
    g.font = `${B.name.length > 3 ? big - 8 : big}px ${FONT_CJK}`;
    if (B.sub) {
      const tw = g.measureText(B.name).width;
      g.fillText(B.name, w / 2 - 46, B.stripes ? h / 2 - 8 : h / 2 + 2);
      g.font = `30px ${FONT_CJK}`; g.textAlign = 'left';
      g.fillText(B.sub, w / 2 - 46 + tw / 2 + 14, B.stripes ? h / 2 - 2 : h / 2 + 8);
    } else g.fillText(B.name, w / 2, h / 2 + 2);
  };
}
// what you see through the glass, by kind of shop (512 x 128, shown on a ~9 x 2.7 window)
const SHOP_INTERIORS = { conv: {}, drink: {}, cafe: {}, food: {}, claw: {}, lotto: {}, betel: {} };
function interiorDraw(kind) {
  return (g, w, h) => {
    w *= 2;
    const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    let r = 7;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const prod = ['#e23b33', '#f2c14e', '#3a7fd5', '#2f9e6b', '#f08a3c', '#8b6fd6', '#ffffff', '#ff6fae'];
    if (kind === 'conv') {
      R(0, 0, w, h, '#fbfaf3');
      R(0, 0, w, 10, '#ffffff');
      for (let i = 0; i < 6; i++) R(20 + i * 80, 4, 50, 5, '#fffbe0'); // ceiling lights
      // shelves of products
      for (let row = 0; row < 3; row++) {
        const y = 30 + row * 26;
        R(10, y + 18, 330, 4, '#c9ccd0');
        for (let x = 14; x < 336; x += 9) R(x, y + 18 - 8 - rnd() * 8, 7, 18, prod[Math.floor(rnd() * prod.length)]);
      }
      // drinks fridge with glass doors and the till
      R(352, 18, 150, 96, '#cfe6f2');
      for (let i = 0; i < 4; i++) { R(356 + i * 37, 22, 33, 88, '#e6f4fb'); for (let k = 0; k < 4; k++) R(360 + i * 37, 30 + k * 20, 25, 10, prod[(i + k) % prod.length]); }
      R(250, 92, 100, 36, '#d6d0c2'); R(262, 84, 22, 10, '#2b2f35');
    } else if (kind === 'drink') {
      R(0, 0, w, h, '#f6efe0');
      R(0, 0, w, 44, '#2b2f35'); // menu board
      for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) R(24 + c * 120, 8 + k * 9, 70 + rnd() * 20, 4, '#f6efe0');
      R(0, 82, w, 46, '#c9a77a'); R(0, 80, w, 6, '#8a6a4a'); // counter
      for (let i = 0; i < 9; i++) { const x = 30 + i * 52; R(x, 58, 20, 24, i % 3 ? '#e8cfa4' : '#d6a46a'); R(x, 54, 20, 4, '#ffffff'); R(x + 9, 40, 3, 16, '#e23b33'); }
      R(400, 50, 70, 30, '#bfc6cc'); // sealing machine
    } else if (kind === 'cafe') {
      R(0, 0, w, h, '#6b4a34');
      R(0, 0, w, h * 0.5, '#7d5a40');
      for (let i = 0; i < 5; i++) { const x = 40 + i * 100; R(x + 18, 0, 3, 24, '#2b2f35'); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x + 20, 30, 12, Math.PI, 0); g.fill(); }
      R(0, 84, w, 44, '#3b2a1e'); R(0, 80, w, 6, '#c9a77a');
      for (let i = 0; i < 6; i++) R(30 + i * 78, 64, 26, 18, ['#f3e6cf', '#e8c7a0', '#f6d0d8'][i % 3]); // cakes in the case
    } else if (kind === 'food') {
      R(0, 0, w, h, '#fff1d6');
      R(0, 0, w, 40, '#d9312b');
      for (let i = 0; i < 5; i++) { R(20 + i * 98, 6, 80, 28, '#ffffff'); R(28 + i * 98, 12, 30, 16, prod[i % prod.length]); }
      R(0, 86, w, 42, '#e8e2d6'); R(0, 82, w, 6, '#f2c14e');
      for (let i = 0; i < 4; i++) R(60 + i * 110, 60, 50, 22, '#f08a3c');
    } else if (kind === 'claw') {
      R(0, 0, w, h, '#3a2450');
      for (let i = 0; i < 5; i++) {
        const x = 12 + i * 100;
        R(x, 8, 84, 112, '#ff6fae'); R(x + 6, 14, 72, 64, '#ffd6ec');
        for (let k = 0; k < 9; k++) { g.fillStyle = prod[Math.floor(rnd() * prod.length)]; g.beginPath(); g.arc(x + 14 + (k % 5) * 14, 66 - Math.floor(k / 5) * 12, 8, 0, TAU); g.fill(); }
        R(x + 38, 14, 3, 22, '#7a8088'); R(x + 32, 36, 15, 5, '#7a8088');
        R(x + 6, 84, 72, 30, '#ff8ac0'); R(x + 30, 92, 24, 14, '#2b2f35');
      }
    } else if (kind === 'lotto') {
      R(0, 0, w, h, '#fff3d0');
      R(0, 0, w, 36, '#d9312b');
      g.fillStyle = '#ffe24a'; g.font = `600 26px ${FONT_NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(50 + i * 82, 18, 14, 0, TAU); g.fill(); }
      g.fillStyle = '#d9312b';
      for (let i = 0; i < 6; i++) g.fillText(String((i * 7 + 3) % 49 + 1), 50 + i * 82, 19);
      for (let i = 0; i < 4; i++) R(30 + i * 120, 50, 90, 40, ['#f2c14e', '#ff6fae', '#3a7fd5', '#2f9e6b'][i]);
      R(0, 96, w, 32, '#c9b38a');
    } else {
      // betel nuts: a dim booth, green packets, a neon strip
      R(0, 0, w, h, '#1f2a24');
      R(0, 0, w, 6, '#ff4fa0'); R(0, h - 6, w, 6, '#4fb3ff');
      for (let i = 0; i < 12; i++) R(20 + i * 40, 50, 30, 20, '#3fae5a');
      R(0, 80, w, 48, '#e8e2d6');
      for (let i = 0; i < 5; i++) R(40 + i * 92, 18, 60, 22, prod[(i + 2) % prod.length]);
    }
    // a little glare on the glass
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(60, h); g.lineTo(110, 0); g.lineTo(150, 0); g.lineTo(100, h); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(300, h); g.lineTo(340, 0); g.lineTo(356, 0); g.lineTo(316, h); g.closePath(); g.fill();
  };
}
// a chain shop for this street building, now and then (fewer in the old quarters)
function pickBrand(zone) {
  if (rng() > (zone === 'old' ? 0.08 : 0.2)) return null;
  let r = rng() * BRAND_WT;
  for (const B of BRANDS) { r -= B.wt; if (r <= 0) return B; }
  return BRANDS[0];
}
// the ground floor of a street building (local frame: facade at +d/2): lit window, fascia, the sign
function addShopfront(P, w, d, B) {
  const A = STREET.plate, z0 = d / 2;
  const glassW = w - 1.1, signW = Math.min(w * 0.82, 5.6);
  addStatic(atlasQuad(glassW, 2.75, A, SHOP_INTERIORS[B.kind].k, false, 2), 0xffffff, P(0, 1.45, z0 + 0.06), { mat: 'plate', uv: true, noShadow: true });
  for (const sx of [-1, 1]) addStatic(box(0.55, 3.0, 0.4), B.kind === 'betel' ? 0x2b2f35 : 0xe8e4dc, P(sx * (w / 2 - 0.27), 1.5, z0 + 0.1), { mat: 'city' });
  addStatic(box(w + 0.1, 1.3, 0.5), B.band, P(0, 3.6, z0 + 0.18), { mat: 'city' });
  if (B.stripes) B.stripes.forEach((c, i) => addStatic(box(w + 0.12, 0.16, 0.52), c, P(0, 2.98 + i * 0.17, z0 + 0.18), { mat: 'city' }));
  addStatic(atlasQuad(signW, signW / 4, A, B.k, false, 2), 0xffffff, P(0, 3.6, z0 + 0.45), { mat: 'plate', uv: true, noShadow: true });
  if (B.kind === 'drink' || B.kind === 'food') {
    // the order counter out on the arcade, with its own little sign
    addStatic(box(Math.min(3.4, w * 0.4), 1.05, 0.7), 0xf3efe6, P(-w * 0.18, 0.53, z0 + 0.5), { mat: 'city' });
    addStatic(box(Math.min(3.5, w * 0.4) + 0.1, 0.14, 0.8), B.band === 0xf3efe2 ? 0x3f7f4a : B.band, P(-w * 0.18, 1.1, z0 + 0.5), { mat: 'city' });
  }
  if (B.kind === 'betel') {
    // neon tubes round the window
    for (const [c, y] of [[0xff4fa0, 2.95], [0x3fe07a, 0.12]]) addStatic(box(w - 0.9, 0.1, 0.12), c, P(0, y, z0 + 0.2), { mat: 'city', noShadow: true });
    for (const sx of [-1, 1]) addStatic(box(0.1, 2.85, 0.12), 0x4fb3ff, P(sx * (w / 2 - 0.6), 1.5, z0 + 0.2), { mat: 'city', noShadow: true });
  }
  if (B.kind === 'conv' && w > 10) {
    // the automatic door
    addStatic(box(2.0, 2.5, 0.08), 0xd9eef7, P(w * 0.28, 1.27, z0 + 0.12), { mat: 'city', noShadow: true });
  }
}

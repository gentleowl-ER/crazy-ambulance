// ===================== alleys and street details =====================
// Texture atlases for the small street things that carry words: lane signs, bus stop plates, road text.
function makeAtlas(cols, rows, cw, ch, draws) {
  const tex = textTexture(cols * cw, rows * ch, (g) => {
    draws.forEach((fn, k) => { if (fn) { g.save(); g.translate((k % cols) * cw, Math.floor(k / cols) * ch); fn(g, cw, ch); g.restore(); } });
  });
  return { tex, cols, rows, uv: (k) => { const c = k % cols, r = Math.floor(k / cols); return [c / cols, 1 - (r + 1) / rows, (c + 1) / cols, 1 - r / rows]; } };
}
// span: how many cells of the row the quad covers (wide shop signs take two)
function atlasQuad(w, h, A, k, flat, span = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  if (flat) g.rotateX(-Math.PI / 2);
  const U = g.attributes.uv, [u0, v0, u1a, v1] = A.uv(k), u1 = u0 + (u1a - u0) * span;
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) < 0.5 ? u0 : u1, U.getY(i) < 0.5 ? v0 : v1);
  return g;
}
// Taipei lane sign: white on blue, the street on top, the lane number big
function laneSignDraw(street, lane) {
  return (g, w, h) => {
    g.fillStyle = '#1f4f9e'; roundRect(g, 4, 4, w - 8, h - 8, 10); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; roundRect(g, 10, 10, w - 20, h - 20, 7); g.stroke();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `30px ${FONT_CJK}`; g.fillText(street, w / 2, h * 0.33);
    g.font = `46px ${FONT_CJK}`; g.fillText(lane, w / 2, h * 0.68);
  };
}
const STREET = { plate: null, road: null, barsTex: null, laneK: [], ready: false };
const BUS_BAYS = [];
// where traffic stops at a signal, measured past the junction's half width: scooters in the box, cars behind it
const STOP_SCOOT = 5.4, STOP_CAR = 8.7;
// painted lane arrows (flat, tip toward -z before rotation): straight, and straight-or-right
const ARROW_GEO = (() => {
  const shaft = (x0, y0, x1, y1, w) => { const sh = new THREE.Shape(); const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = (-dy / l) * w, ny = (dx / l) * w; sh.moveTo(x0 + nx, y0 + ny); sh.lineTo(x1 + nx, y1 + ny); sh.lineTo(x1 - nx, y1 - ny); sh.lineTo(x0 - nx, y0 - ny); sh.closePath(); return sh; };
  const head = (x, y, ax, ay, L, W) => { const sh = new THREE.Shape(); sh.moveTo(x + ax * L, y + ay * L); sh.lineTo(x - ay * W, y + ax * W); sh.lineTo(x + ay * W, y - ax * W); sh.closePath(); return sh; };
  const flat = (shapes) => { const gb = new GB(true); for (const sh of shapes) { const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); gb.add(g, 0xffffff, null); } return gb.build(); };
  return {
    s: flat([shaft(0, -2.4, 0, 0.7, 0.2), head(0, 0.7, 0, 1, 1.6, 0.7)]),
    sr: flat([shaft(0, -2.4, 0, 0.7, 0.2), head(0, 0.7, 0, 1, 1.6, 0.7), shaft(0, -0.9, 0.9, -0.1, 0.18), head(0.9, -0.1, 0.78, 0.62, 1.0, 0.5)]),
  };
})();
function initStreetMaterials() {
  if (STREET.ready) return;
  STREET.ready = true;
  // plates: lane signs (one per alley) + a few generic ones
  const draws = ALLEYS.map((a) => { const m = a.n.match(/^(.*?)\s*(\d+巷)$/); return laneSignDraw(m ? m[1] : a.n, m ? m[2] : ''); });
  const K = { bus: draws.length, work: draws.length + 1, slow: draws.length + 2, post: draws.length + 3, site: draws.length + 4, bike: draws.length + 5 };
  draws[K.site] = (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 4, 4, w - 8, h - 8, 8); g.fill();
    g.fillStyle = '#d9312b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT_CJK}`; g.fillText('施工中', w / 2, h * 0.36);
    g.fillStyle = '#2b2f35'; g.font = `28px ${FONT_CJK}`; g.fillText('注意安全・閒人勿進', w / 2, h * 0.74);
  };
  // food stalls in the alleys and the night market
  K.food = ALLEYS.length + 6;
  FOOD_SIGNS.forEach(([t, bg], i) => {
    draws[K.food + i] = (g, w, h) => {
      g.fillStyle = bg; roundRect(g, 4, 4, w - 8, h - 8, 10); g.fill();
      g.fillStyle = '#fff6d8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${t.length > 3 ? 44 : 56}px ${FONT_CJK}`; g.fillText(t, w / 2, h / 2 + 3);
    };
  });
  draws[K.bike] = (g, w, h) => {
    g.fillStyle = '#f2a33a'; roundRect(g, 4, 4, w - 8, h - 8, 10); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `34px ${FONT_CJK}`; g.fillText('公共自行車', w / 2, h * 0.4);
    g.font = `22px ${FONT_CJK}`; g.fillText('租賃站', w / 2, h * 0.74);
  };
  draws[K.bus] = (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 4, 4, w - 8, h - 8, 10); g.fill();
    g.fillStyle = '#1f4f9e'; roundRect(g, 4, 4, w - 8, 46, 10); g.fill(); g.fillRect(4, 30, w - 8, 20);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `30px ${FONT_CJK}`; g.fillText('公車站', w / 2, 28);
    g.fillStyle = '#d9473d'; g.font = `600 30px ${FONT_NUM}`;
    ['235', '262', '307'].forEach((t, i) => g.fillText(t, w * (0.22 + i * 0.28), 88));
  };
  draws[K.work] = (g, w, h) => {
    g.fillStyle = '#f2c14e'; roundRect(g, 4, 4, w - 8, h - 8, 10); g.fill();
    g.strokeStyle = '#2b2f35'; g.lineWidth = 5; roundRect(g, 10, 10, w - 20, h - 20, 7); g.stroke();
    g.fillStyle = '#2b2f35'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `40px ${FONT_CJK}`; g.fillText('道路施工', w / 2, h * 0.38); g.font = `26px ${FONT_CJK}`; g.fillText('請減速慢行', w / 2, h * 0.72);
  };
  draws[K.slow] = (g, w, h) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w - 70, h - 10); g.lineTo(70, h - 10); g.closePath(); g.fill();
    g.strokeStyle = '#d9312b'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#2b2f35'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT_CJK}`; g.fillText('慢', w / 2, h * 0.62);
  };
  draws[K.post] = (g, w, h) => {
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `40px ${FONT_CJK}`; g.fillText('郵　政', w / 2, h / 2 + 2);
  };
  // road paint shares the atlas (one material for every sign and every painted word: fewer draw calls)
  K.rSlow = K.food + FOOD_SIGNS.length; K.rBox = K.rSlow + 1; K.rBus = K.rSlow + 2;
  const paint = (text, col, px, sx, lines) => (g, w, h) => {
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${px}px ${FONT_CJK}`;
    g.save(); g.translate(w / 2, h / 2); g.scale(sx, 1);
    if (lines) lines.forEach((t, i) => g.fillText(t, 0, (i - (lines.length - 1) / 2) * px * 1.02 + 4)); else g.fillText(text, 0, 6);
    g.restore();
  };
  draws[K.rSlow] = paint('慢', '#ffffff', 108, 1.96);
  draws[K.rBox] = paint('', '#ffffff', 50, 1, ['機車', '停等區']);
  draws[K.rBus] = paint('公車', '#f2c24a', 92, 1);
  // after these: wide (two-cell) signs for the 士林 landmarks and the chain shops, and the shop interiors
  let next = K.rBus + 1;
  const alloc = (span) => { if (span === 2 && next % 2) next++; const k = next; next += span; return k; };
  // 公車專用 for the bus lanes: the characters one after another along the lane, the first one farthest ahead
  K.rBusL = alloc(2);
  draws[K.rBusL] = (g, w, h) => {
    w *= 2;
    g.fillStyle = '#f2c24a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `104px ${FONT_CJK}`;
    '公車專用'.split('').forEach((ch, i) => { g.save(); g.translate(w * (i + 0.5) / 4, h / 2); g.rotate(-Math.PI / 2); g.scale(1, 1.15); g.fillText(ch, 0, 6); g.restore(); });
  };
  K.lantern = alloc(1);
  draws[K.lantern] = (g, w, h) => {
    // drawn squashed: it is shown on a square quad
    g.save(); g.translate(w / 2, h / 2); g.scale(0.5, 1);
    g.fillStyle = '#5a3a24'; g.fillRect(-26, -60, 52, 10); g.fillRect(-26, 50, 52, 10);
    const gr = g.createRadialGradient(-12, -14, 6, 0, 0, 62);
    gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.35, '#ff6a3c'); gr.addColorStop(1, '#c0221c');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 62, 52, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,20,10,0.55)'; g.lineWidth = 4;
    for (const k of [-36, 0, 36]) { g.beginPath(); g.ellipse(0, 0, Math.abs(k) * 1.2 + 6, 52, 0, 0, TAU); g.stroke(); }
    g.restore();
  };
  for (const L of LANDMARK_SIGNS) { L.k = alloc(2); draws[L.k] = landmarkSignDraw(L); }
  for (const B of BRANDS) { B.k = alloc(2); draws[B.k] = brandSignDraw(B); }
  for (const kind of Object.keys(SHOP_INTERIORS)) { const k = alloc(2); SHOP_INTERIORS[kind].k = k; draws[k] = interiorDraw(kind); }
  STREET.plateK = K;
  STREET.plate = makeAtlas(4, Math.ceil(next / 4), 256, 128, draws);
  MAT.plate = new THREE.MeshBasicMaterial({ map: STREET.plate.tex, side: THREE.DoubleSide, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // the same signs, for gates over the road: they fade out once nearer the chase camera than the ambulance (see addCut)
  MAT.plateCut = addCut(new THREE.MeshBasicMaterial({ map: STREET.plate.tex, side: THREE.DoubleSide, alphaTest: 0.4 }), 'platecut');
  // iron window grilles (鐵窗): bars and a frame, see-through between
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 128);
  g.fillStyle = '#ffffff';
  for (let x = 4; x < 64; x += 12) g.fillRect(x, 0, 4, 128);
  g.fillRect(0, 0, 64, 8); g.fillRect(0, 60, 64, 5); g.fillRect(0, 120, 64, 8);
  g.beginPath(); g.arc(32, 60, 14, Math.PI, 0); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
  STREET.barsTex = new THREE.CanvasTexture(c);
  STREET.barsTex.wrapS = STREET.barsTex.wrapT = THREE.RepeatWrapping;
  MAT.bars = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, map: STREET.barsTex, alphaTest: 0.5, side: THREE.DoubleSide });
}
// a plane whose texture repeats every `rep` units across (for the grilles)
function repQuad(w, h, rep) {
  const g = new THREE.PlaneGeometry(w, h);
  const U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * (w / rep), U.getY(i));
  return g;
}

// ---------- the walk-up apartments along an alley ----------
const ALLEY_WALLS = [0xe8e2d4, 0xd9d2c4, 0xcfd7d0, 0xe6d0bf, 0xd4d9de, 0xf0e6cf, 0xe3d9c9, 0xc9cfd6];
function alleyBuildings(e) {
  for (const side of [1, -1]) {
    let s = 2;
    while (s < e.len - 2) {
      const w = rand(7, 11);
      const [px, pz, tx, tz] = edgePoint(e, s + w / 2);
      const nx = -tz * side, nz = tx * side;
      const d = rand(9, 13);
      const off = e.hw + 1.0 + d / 2;
      const x = px + nx * off, z = pz + nz * off, rot = Math.atan2(-nx, -nz);
      if (footprintOK(x, z, w, d, rot, 4.9, 0.7)) { addAlleyBuilding(x, z, rot, w, d); s += w + rand(0.15, 0.8); }
      else s += 2.5;
    }
  }
}
function addAlleyBuilding(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  const floors = rng() < 0.55 ? 4 : 5, fh = 3.0, h = floors * fh + 0.5;
  const col = pick(ALLEY_WALLS);
  addStatic(windowBox(w, h, d, 2.8, fh), col, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w + 0.25, 0.45, d + 0.25), shade(col, 0.82), P(0, h + 0.2, 0), { mat: 'city' });
  // 頂樓加蓋: a sheet-metal room on the roof
  if (rng() < 0.55) {
    const rw = w * rand(0.5, 0.85), rd = d * rand(0.45, 0.75), ox = rand(-(w - rw) / 2, (w - rw) / 2);
    addStatic(box(rw, 2.4, rd), pick([0xd8d6cf, 0xc9c4b8, 0xe2ddd0]), P(ox, h + 1.4, -d * 0.12), { mat: 'city' });
    addStatic(box(rw + 0.6, 0.22, rd + 0.6), pick([0x4f8fb3, 0x3f9e8f, 0x8a95a0, 0xc96a4a]), P(ox, h + 2.7, -d * 0.12, 0.05, 0, 0), { mat: 'city' });
  }
  // a grey water tank
  if (rng() < 0.5) addStatic(new THREE.CylinderGeometry(0.7, 0.7, 1.3, 8), 0xdfe3e6, P(rand(-w / 3, w / 3), h + 1.1, d * 0.25), { mat: 'city' });
  // ground floor: red iron door, a rolling shutter, an awning
  addStatic(box(1.1, 2.3, 0.18), pick([0xb5413a, 0x2f7a5a, 0x8a5a3a]), P(-w / 2 + 1.4, 1.15, d / 2 + 0.06), { mat: 'city' });
  addStatic(box(Math.min(3.6, w - 3.6), 2.6, 0.14), 0xaab0b5, P(w / 2 - 2.4, 1.3, d / 2 + 0.05), { mat: 'city' });
  addStatic(box(w - 0.3, 0.14, 1.0), pick([0x4f8fb3, 0x6aa84f, 0xe0a33b, 0xc96a4a]), P(0, 2.85, d / 2 + 0.5, 0.18, 0, 0), { mat: 'city' });
  // 鐵窗 on the floors above, sticking out over the lane
  for (let f = 1; f < floors; f++) {
    if (rng() < 0.18) continue;
    const y = f * fh + 1.35, cw = w - 1.2;
    addStatic(repQuad(cw, 2.0, 0.55), 0x4a5058, P(0, y, d / 2 + 0.55), { mat: 'bars', uv: true, noShadow: true });
    addStatic(box(cw + 0.2, 0.1, 0.65), 0x6d747c, P(0, y + 1.05, d / 2 + 0.3), { mat: 'city' });
    if (rng() < 0.35) addStatic(box(1.0, 0.7, 0.55), 0xd5d8da, P(rand(-cw / 2 + 1, cw / 2 - 1), y - 0.55, d / 2 + 0.3), { mat: 'city' });
  }
  boxCollider(x, z, w + 0.3, d + 0.3, rot);
  BUILDINGS.push({ x, z, w, d, rot, h });
}

// ---------- lane furniture: signs at the mouths, 慢 on the asphalt, speed bumps ----------
const ALLEY_RUNS = []; // { e, a: [x, z], b: [x, z] } the open stretch of each alley, mouth to mouth
function buildAlleyDetails() {
  initStreetMaterials();
  const alleyEdges = edges.filter((e) => e.flags.alley);
  // the park paths count as shortcuts too
  for (const P of PARK_PATHS) ALLEY_RUNS.push({ e: { name: P.n + '步道' }, a: P.pts[0], b: P.pts[1], park: true });
  ALLEYS.forEach((A, k) => {
    const list = alleyEdges.filter((e) => e.name === A.n);
    for (const e of list) {
      const hwA = nodeMaxHwStreet(e.a), hwB = nodeMaxHwStreet(e.b);
      ALLEY_RUNS.push({ e, a: edgePoint(e, hwA), b: edgePoint(e, e.len - hwB) });
      // speed bumps, painted yellow and black
      const open = e.len - hwA - hwB;
      // the night market: stalls down both sides, lanterns overhead, a gate at each end
      if (A.market) marketStalls(e, hwA, hwB, LSIGN[A.sign || 'market']);
      // every third alley has a food stall set up against one wall: it narrows the way through
      else if (k % 3 === 1 && open > 50) {
        const sd = k % 2 ? 1 : -1;
        const [x0, z0, tx, tz] = edgePoint(e, hwA + open * 0.42);
        const x = x0 - tz * sd * (e.hw - 1.0), z = z0 + tx * sd * (e.hw - 1.0);
        const rot = Math.atan2(tz * sd, -tx * sd), P = placer(x, z, rot);
        addStatic(box(2.4, 0.9, 1.1), 0xd9d6cf, P(0, 0.75, 0));
        addStatic(box(2.5, 0.12, 1.2), 0x9aa0a6, P(0, 1.24, 0));
        for (const wx of [-0.9, 0.9]) { const wg = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8); wg.rotateZ(Math.PI / 2); addStatic(wg, 0x34363c, P(wx, 0.22, 0.45)); }
        addStatic(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), 0x7a8088, P(0, 2.2, -0.3));
        addStatic(new THREE.ConeGeometry(1.7, 0.7, 10), k % 2 ? 0xe9524a : 0x3a7fd5, P(0, 3.25, -0.3));
        addStatic(atlasQuad(1.6, 0.6, STREET.plate, STREET.plateK.food + (k % 4)), 0xffffff, P(0, 1.65, 0.62), { mat: 'plate', uv: true, noShadow: true });
        addStatic(box(0.5, 0.06, 0.5), 0xf2c14e, P(-0.5, 1.33, 0.1));
        boxCollider(x, z, 2.5, 1.2, rot);
      }
      const nb = open > 90 ? 2 : open > 30 ? 1 : 0;
      for (let i = 1; i <= nb; i++) {
        const [x, z, tx, tz] = edgePoint(e, hwA + (open * i) / (nb + 1));
        addRampShape({ x, z, ux: tx, uz: tz, len: 2.8, hw: e.hw, h: 0.3, hump: true, cols: [0xf2c14e, 0x2b2f35] });
      }
      // at both mouths: 慢 on the asphalt facing out, and the blue lane sign on the corner
      for (const end of [0, 1]) {
        const node = end ? e.b : e.a, hwN = end ? hwB : hwA;
        if (!isMouth(node)) continue;
        const s = end ? e.len - hwN - 5 : hwN + 5;
        const [x, z, tx, tz] = edgePoint(e, s);
        const ox = end ? tx : -tx, oz = end ? tz : -tz; // out of the alley
        addStatic(atlasQuad(2.6, 3.8, STREET.plate, STREET.plateK.rSlow, true), 0xffffff, M(x, 0.05, z, 0, Math.atan2(ox, oz) + Math.PI, 0), { mat: 'plate', uv: true, noShadow: true });
        // the corner: just outside the lane, on the street's sidewalk
        const [cx, cz] = edgePoint(e, end ? e.len - hwN - 1.2 : hwN + 1.2);
        const rx = -oz, rz = ox;
        const px = cx + rx * (e.hw + 1.1), pz = cz + rz * (e.hw + 1.1);
        if (blockedAt(px, pz, 0.6)) continue;
        addStatic(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 6), 0x7a8088, M(px, 1.8, pz));
        addStatic(atlasQuad(2.4, 1.2, STREET.plate, k), 0xffffff, M(px + rx * 1.15, 3.1, pz + rz * 1.15, 0, Math.atan2(ox, oz) + Math.PI / 2, 0), { mat: 'plate', uv: true, noShadow: true });
        addCollider({ t: 0, x: px, z: pz, r: 0.3 });
      }
    }
  });
}
// widest street (not alley) at a node
function nodeMaxHwStreet(id) { let m = 0; for (const o of nodeEdges[id] || []) if (!o.e.flags.alley) m = Math.max(m, o.e.hw); return m; }

// ---------- shortcut tracking: in one mouth, out of the other ----------
const ALLEY_RUN = { cur: null, from: 0, t: 0, done: 0 };
function alleyStep(dt) {
  if (G.state !== 'play' || G.mode === 'dispatch' || car.sinking) { ALLEY_RUN.cur = null; return; }
  if ((ALLEY_RUN.t -= dt) > 0) return;
  ALLEY_RUN.t = 0.1;
  const inside = (alleyDist(car.x, car.z) < 0.6 || (plazaVal(car.x, car.z) > 0 && parkVal(car.x, car.z) > 0)) && roadDist(car.x, car.z) > 0.5;
  if (!inside) {
    const R = ALLEY_RUN.cur;
    if (R) {
      // left the lane: through the far mouth counts as a shortcut
      const end = hypot(car.x - R.b[0], car.z - R.b[1]) < hypot(car.x - R.a[0], car.z - R.a[1]) ? 1 : 0;
      if (end !== ALLEY_RUN.from && Math.min(hypot(car.x - R.a[0], car.z - R.a[1]), hypot(car.x - R.b[0], car.z - R.b[1])) < 16) shortcutDone(R);
      ALLEY_RUN.cur = null;
    }
    return;
  }
  if (ALLEY_RUN.cur) return;
  let best = null, bd = 1e9;
  for (const R of ALLEY_RUNS) {
    const d = Math.sqrt(segDist2(car.x, car.z, R.a[0], R.a[1], R.b[0], R.b[1]));
    if (d < bd) { bd = d; best = R; }
  }
  if (!best || bd > (best.park ? 6 : 5)) return;
  ALLEY_RUN.cur = best;
  ALLEY_RUN.from = hypot(car.x - best.b[0], car.z - best.b[1]) < hypot(car.x - best.a[0], car.z - best.a[1]) ? 1 : 0;
  if (!SHIFT.alleyTip) { SHIFT.alleyTip = true; toast(best.park ? `抄近路穿過${best.e.name}！小心散步的人` : `鑽進${best.e.name}！小心減速丘和機車`, ''); }
}
function shortcutDone(R) {
  const n = tally('alley', 3, 'alley');
  const pts = riding ? 40 : 15;
  addScore(pts);
  toast(n === 1 ? '抄捷徑！' : `抄捷徑！第 ${n} 條巷子`, `+${pts}`);
  sfx.coin();
}

// ---------- sidewalk things: mailboxes, utility boxes, hydrants, public bikes ----------
function sidewalkSpot(e, s, sd, off, r) {
  const [px, pz, tx, tz] = edgePoint(e, s);
  const x = px - tz * sd * (e.hw + off), z = pz + tx * sd * (e.hw + off);
  if (landF(x, z) < 8 || plazaVal(x, z) > -1 || alleyDist(x, z) < 3 || hillH(x, z) > 0.2 || roadDist(x, z) < 0.3 || roadDist(x, z) > 5) return null;
  if (blockedAt(x, z, r)) return null;
  // facing the street
  return { x, z, rot: Math.atan2(tz * sd, -tx * sd), tx, tz };
}
function addMailboxes(x, z, rot) {
  const P = placer(x, z, rot);
  [[0xd9312b, -0.42], [0x2f9e6b, 0.42]].forEach(([col, ox]) => {
    addStatic(box(0.6, 0.3, 0.5), 0x5a6068, P(ox, 0.15, 0));
    addStatic(box(0.66, 1.0, 0.54), col, P(ox, 0.8, 0));
    addStatic(box(0.72, 0.16, 0.6), shade(col, 0.8), P(ox, 1.36, 0, 0.12, 0, 0));
    addStatic(box(0.4, 0.06, 0.04), 0x2b2f35, P(ox, 1.12, 0.28));
    addStatic(atlasQuad(0.56, 0.28, STREET.plate, STREET.plateK.post), 0xffffff, P(ox, 0.8, 0.285), { mat: 'plate', uv: true, noShadow: true });
  });
  addCollider({ t: 0, x, z, r: 0.85 });
}
function addUtilityBox(x, z, rot) {
  const P = placer(x, z, rot);
  addStatic(box(1.5, 1.2, 0.8), pick([0x6f9a78, 0x7fa486, 0x8a9a8c]), P(0, 0.6, 0));
  addStatic(box(1.6, 0.12, 0.9), 0x5d7a63, P(0, 1.26, 0));
  addStatic(box(0.5, 0.35, 0.02), 0xf2c14e, P(0.35, 0.85, 0.41));
  boxCollider(x, z, 1.6, 0.9, rot);
}
function addHydrant(x, z) {
  addStatic(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 8), 0xd9312b, M(x, 0.35, z));
  addStatic(new THREE.SphereGeometry(0.22, 8, 6, 0, TAU, 0, Math.PI / 2), 0xf2c14e, M(x, 0.7, z));
  addStatic(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), 0xd9312b, M(x, 0.45, z, 0, 0, Math.PI / 2));
  addCollider({ t: 0, x, z, r: 0.35 });
}
let BIKE_GEO = null;
function bikeGeo() {
  if (BIKE_GEO) return BIKE_GEO;
  const gb = new GB();
  for (const zz of [-0.55, 0.55]) { const w = new THREE.TorusGeometry(0.32, 0.05, 5, 12); w.rotateY(Math.PI / 2); gb.add(w, 0x2b2f35, M(0, 0.37, zz)); }
  gb.add(box(0.07, 0.07, 1.0), 0xf2a33a, M(0, 0.62, 0, 0.25, 0, 0));
  gb.add(box(0.07, 0.6, 0.07), 0xf2a33a, M(0, 0.62, -0.25));
  gb.add(box(0.07, 0.6, 0.07), 0xf2a33a, M(0, 0.62, 0.5, -0.25, 0, 0));
  gb.add(box(0.26, 0.08, 0.36), 0x2b2f35, M(0, 0.95, -0.28));
  gb.add(box(0.5, 0.05, 0.05), 0x2b2f35, M(0, 1.02, 0.52));
  gb.add(box(0.36, 0.22, 0.28), 0xf2a33a, M(0, 0.86, 0.72));
  BIKE_GEO = gb.build();
  return BIKE_GEO;
}
function addBikeStation(e, s, sd) {
  const n = 7, gap = 0.95;
  const spots = [];
  for (let i = 0; i < n; i++) {
    const q = sidewalkSpot(e, s + i * gap, sd, 1.6, 0.5);
    if (!q) return false;
    spots.push(q);
  }
  for (const q of spots) {
    addStatic(bikeGeo(), 0xffffff, M(q.x, 0, q.z, 0, q.rot, 0), { keep: true });
    addStatic(box(0.12, 0.8, 0.12), 0x8a9096, M(q.x - Math.sin(q.rot) * 0.95, 0.4, q.z - Math.cos(q.rot) * 0.95));
  }
  const a = spots[0], b = spots[n - 1];
  const kx = b.x + b.tx * 1.3, kz = b.z + b.tz * 1.3;
  addStatic(box(0.6, 1.8, 0.45), 0xf2a33a, M(kx, 0.9, kz, 0, a.rot, 0));
  addStatic(atlasQuad(1.2, 0.6, STREET.plate, STREET.plateK.bike), 0xffffff, M(kx + Math.sin(a.rot) * 0.24, 1.45, kz + Math.cos(a.rot) * 0.24, 0, a.rot, 0), { mat: 'plate', uv: true, noShadow: true });
  addCollider({ t: 2, ax: a.x, az: a.z, bx: kx, bz: kz, r: 0.75 });
  return true;
}
function buildSidewalkStuff() {
  const main = edges.filter((e) => !e.flags.ring && !e.flags.campus && !e.flags.alley && e.len > 40);
  let bikes = 0;
  for (const e of main) {
    const padA = nodeMaxHw(e.a) + 8, padB = nodeMaxHw(e.b) + 8;
    for (let s = padA + rand(0, 40); s < e.len - padB; s += rand(110, 190)) {
      const sd = rng() < 0.5 ? 1 : -1, r = rng();
      if (r < 0.28 && e.hw >= 6) { const q = sidewalkSpot(e, s, sd, 0.95, 1.0); if (q) addMailboxes(q.x, q.z, q.rot); }
      else if (r < 0.62) { const q = sidewalkSpot(e, s, sd, 4.55, 1.1); if (q) addUtilityBox(q.x, q.z, q.rot); }
      else if (r < 0.86) { const q = sidewalkSpot(e, s, sd, 0.7, 0.6); if (q) addHydrant(q.x, q.z); }
      else if (bikes < 14 && e.hw >= 7 && addBikeStation(e, s, sd)) bikes++;
    }
  }
}

// ---------- building sites: hoardings, a concrete frame in green netting, a tower crane ----------
function buildSites() {
  const cands = edges.filter((e) => !e.flags.ring && !e.flags.campus && !e.flags.alley && e.len > 90 && e.hw >= 6);
  let made = 0;
  for (let tries = 0; tries < 80 && made < 4; tries++) {
    const e = pick(cands), side = rng() < 0.5 ? 1 : -1;
    const w = rand(22, 30), d = rand(16, 22);
    const s = rand(nodeMaxHw(e.a) + 14 + w / 2, e.len - nodeMaxHw(e.b) - 14 - w / 2);
    if (!(s > 0)) continue;
    const [px, pz, tx, tz] = edgePoint(e, s);
    const nx = -tz * side, nz = tx * side, off = e.hw + 6.6 + d / 2;
    const x = px + nx * off, z = pz + nz * off, rot = Math.atan2(-nx, -nz);
    if (zoneOf(x, z) === 'old' || HOSPITALS.some((H) => hypot(H.anchor[0] - x, H.anchor[1] - z) < 70)) continue;
    if (Object.values(LANDMARKS).some((v) => hypot(v[0] - x, v[1] - z) < 60)) continue;
    if (!footprintOK(x, z, w + 2, d + 2, rot, 4.9, 3)) continue;
    addSite(x, z, rot, w, d);
    made++;
  }
}
function addSite(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  // hoarding: blue and white panels with a yellow stripe, a grey gate on the street side
  const panel = (lx, lz, len, ry) => {
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * (len / n);
      const cx = lx + Math.cos(ry) * u, cz = lz - Math.sin(ry) * u;
      if (Math.abs(cx) < 2.2 && lz > 0 && ry === 0) continue; // the gate
      addStatic(box(len / n - 0.08, 2.4, 0.12), i % 2 ? 0xffffff : 0x3a6fb8, P(cx, 1.2, cz, 0, ry, 0), { mat: 'city' });
      addStatic(box(len / n - 0.08, 0.3, 0.14), 0xf2c14e, P(cx, 2.1, cz, 0, ry, 0), { mat: 'city' });
    }
  };
  panel(0, d / 2, w, 0); panel(0, -d / 2, w, 0); panel(-w / 2, 0, d, Math.PI / 2); panel(w / 2, 0, d, Math.PI / 2);
  addStatic(box(4.2, 2.6, 0.16), 0x8f979c, P(0, 1.3, d / 2 + 0.05), { mat: 'city' });
  addStatic(atlasQuad(2.6, 1.3, STREET.plate, STREET.plateK.site), 0xffffff, P(3.8, 2.9, d / 2 + 0.12), { mat: 'plate', uv: true, noShadow: true });
  // the concrete frame, four floors up, netting on the street side
  const fw = w - 5, fd = d - 5, floors = randi(4, 6), fh = 3.3;
  for (let f = 1; f <= floors; f++) addStatic(box(fw, 0.35, fd), 0xbfbcb4, P(0, f * fh, -0.5), { mat: 'city' });
  for (const cx of [-fw / 2 + 0.4, 0, fw / 2 - 0.4]) for (const cz of [-fd / 2 + 0.4, fd / 2 - 0.4]) addStatic(box(0.55, floors * fh, 0.55), 0xa9a69e, P(cx, (floors * fh) / 2, cz - 0.5), { mat: 'city' });
  addStatic(repQuad(fw + 0.6, floors * fh - 1.5, 0.45), 0x3f9e5a, P(0, (floors * fh) / 2 + 1.6, fd / 2 - 0.1), { mat: 'bars', uv: true, noShadow: true });
  addStatic(repQuad(fd + 0.6, floors * fh - 1.5, 0.45), 0x3f9e5a, P(fw / 2 + 0.1, (floors * fh) / 2 + 1.6, -0.5, 0, Math.PI / 2, 0), { mat: 'bars', uv: true, noShadow: true });
  // tower crane
  const H = floors * fh + rand(12, 18), mx = -fw / 2 + 2, mz = -fd / 2 + 2;
  for (const face of [0, 1, 2, 3]) {
    const a = (face * Math.PI) / 2;
    addStatic(repQuad(1.4, H, 0.7), 0xf2b134, P(mx + Math.sin(a) * 0.7, H / 2, mz + Math.cos(a) * 0.7, 0, a, 0), { mat: 'bars', uv: true, noShadow: true });
  }
  addStatic(box(1.6, 1.6, 1.6), 0xf2b134, P(mx, H + 0.8, mz), { mat: 'city' });
  const jl = rand(18, 24), ja = rand(0, TAU);
  const jx = Math.sin(ja), jz = Math.cos(ja);
  addStatic(box(1.0, 0.9, jl), 0xf2b134, P(mx + jx * (jl / 2 - 1), H + 2.0, mz + jz * (jl / 2 - 1), 0, ja, 0), { mat: 'city' });
  addStatic(box(1.0, 0.9, 7), 0xf2b134, P(mx - jx * 4, H + 2.0, mz - jz * 4, 0, ja, 0), { mat: 'city' });
  addStatic(box(1.6, 1.4, 2.0), 0x8a9096, P(mx - jx * 6.5, H + 1.2, mz - jz * 6.5, 0, ja, 0), { mat: 'city' });
  addStatic(box(1.4, 1.2, 1.4), 0xe9ecef, P(mx + jx * 1.5, H + 0.9, mz + jz * 1.5, 0, ja, 0), { mat: 'city' });
  addStatic(new THREE.CylinderGeometry(0.04, 0.04, 9, 4), 0x2b2f35, P(mx + jx * (jl - 4), H + 2 - 4.5, mz + jz * (jl - 4)));
  addStatic(box(1.2, 0.6, 1.2), 0x6d747c, P(mx + jx * (jl - 4), H + 2 - 9.2, mz + jz * (jl - 4)), { mat: 'city' });
  boxCollider(x, z, w + 0.4, d + 0.4, rot);
  BUILDINGS.push({ x, z, w, d, rot, h: 2.4 });
}

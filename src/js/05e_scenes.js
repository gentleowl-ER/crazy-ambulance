// ===================== classic Taipei scenes: temples, 華山, 忠烈祠, the wheel on 美麗華 =====================
// Each one stands where it is in the real city (see LANDMARKS); the buildings are simplified, toy-sized versions.

// a temple roof: glazed tiles, the eave corners swept up, a ridge with swallowtail ends and coloured 剪黏 figures
function templeRoof(P, w, d, y, col, h = 3, ridgeCol = 0xf2c14e) {
  addStatic(hipRoofGeo(w, d, h, 0.62), col, P(0, y, 0), { flat: true });
  eaveHorns(P, w, d, y, col);
  const rl = w * 0.62;
  addStatic(box(rl, 0.5, 0.6), ridgeCol, P(0, y + h + 0.1, 0));
  for (const sx of [-1, 1]) {
    // the swallowtail (燕尾): the ridge ends split and curl up
    const rotM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0, sx * 0.55));
    addStatic(box(1.8, 0.4, 0.5), ridgeCol, P(sx * (rl / 2 + 0.55), y + h + 0.45, 0).multiply(rotM));
  }
  // dragons and flowers in cut porcelain along the ridge: a few bright blocks
  const cols = [0x2f9e6b, 0x3a7fd5, 0xd9473d, 0xf2c14e, 0xffffff];
  for (let i = 0; i < 5; i++) addStatic(box(0.7, 0.9, 0.4), cols[i], P(-rl * 0.36 + i * rl * 0.18, y + h + 0.75, 0));
  addStatic(new THREE.SphereGeometry(0.75, 10, 8), 0xe9a638, P(0, y + h + 1.2, 0));
}
// a hall: a stone base, red columns along the front, walls, its roof
function templeHall(P, w, d, wh, wall, roof, opts = {}) {
  const lz = opts.z || 0;
  const Q = (x, y, z, ...r) => P(x, y, z + lz, ...r);
  addStatic(box(w + 2, 1.0, d + 2), 0xd8d0c2, Q(0, 0.5, 0));
  addStatic(box(w, wh, d - 2), wall, Q(0, 1 + wh / 2, -1));
  const n = Math.max(2, Math.round(w / 4));
  for (let i = 0; i <= n; i++) addStatic(new THREE.CylinderGeometry(0.35, 0.35, wh, 8), 0xb8352c, Q(-w / 2 + (i * w) / n, 1 + wh / 2, d / 2 - 0.5));
  // doors: dark wood with gold studs
  addStatic(box(Math.min(5, w * 0.3), wh * 0.75, 0.2), 0x6a2a1e, Q(0, 1 + wh * 0.375, d / 2 - 1.9));
  templeRoof(Q, w + 3.5, d + 3, 1 + wh, roof, opts.rh || 3, opts.ridge);
  if (opts.second) {
    // a second, smaller roof stacked above (重簷)
    addStatic(box(w * 0.6, 2.2, d * 0.5), wall, Q(0, 1 + wh + 3.6, 0));
    templeRoof(Q, w * 0.72, d * 0.66, 1 + wh + 4.7, roof, 2.6, opts.ridge);
  }
}
// a gate plaque (from the landmark sign atlas) on a building face at local (x, y, z)
function plaque(P, k, w, x, y, z, ry = 0) {
  addStatic(atlasQuad(w, w / 4, STREET.plate, LSIGN[k].k, false, 2), 0xffffff, P(x, y, z, 0, ry, 0), { mat: 'plate', uv: true, noShadow: true });
}
// a cast iron incense burner (香爐) on a stone step
function incenseBurner(x, z, s = 1) {
  addStatic(new THREE.CylinderGeometry(1.4 * s, 1.6 * s, 0.6, 10), 0xcfc8ba, M(x, 0.3, z));
  addStatic(new THREE.CylinderGeometry(1.15 * s, 0.85 * s, 1.5 * s, 10), 0x4a3f36, M(x, 0.6 + 0.75 * s, z));
  addStatic(hipRoofGeo(2.2 * s, 2.2 * s, 0.9 * s, 0), 0x4a3f36, M(x, 1.35 + 1.5 * s, z), { flat: true });
  addCollider({ t: 0, x, z, r: 1.5 * s });
}
// red paper lanterns strung along a facade
function lanternRow(P, w, y, z) {
  for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 2.2) {
    addStatic(new THREE.SphereGeometry(0.42, 8, 6), 0xd9312b, P(x, y, z, 0, 0, 0, 1, 1.2, 1), { noShadow: true });
  }
}

// ---------- 行天宮: no incense since 2014, a plain grey-green hall and a courtyard of worshippers ----------
function buildXingtian() {
  const [x, z] = LANDMARKS.xingtian;
  const P = placer(x, z, 0); // the gate looks south onto 民權東路
  const wall = 0xe9dfcc, roof = 0x6f8d7a;
  templeHall(P, 30, 10, 5.6, wall, roof, { z: 18 });
  plaque(P, 'xingtian', 6, 0, 6.0, 23.15);
  templeHall(P, 40, 16, 7.4, wall, roof, { z: -12, second: true, rh: 3.4 });
  for (const sx of [-1, 1]) {
    addStatic(box(4, 4.6, 26), wall, P(sx * 23, 2.3, 4));
    addStatic(hipRoofGeo(5.6, 27.4, 1.6, 0.85), roof, P(sx * 23, 4.6, 4), { flat: true });
    boxCollider(x + sx * 23, z + 4, 4.4, 26.4, 0);
  }
  boxCollider(x, z + 18, 32, 10.4, 0);
  boxCollider(x, z - 12, 42, 16.4, 0);
  // the worshippers' tables in the courtyard, laid with offerings
  for (const sx of [-6, 0, 6]) {
    addStatic(box(4, 1.0, 1.4), 0xb8352c, P(sx, 0.5, 4));
    for (let k = 0; k < 3; k++) addStatic(box(0.6, 0.35, 0.5), [0xf2c14e, 0xe0602a, 0x3fae5a][k], P(sx - 1.2 + k * 1.2, 1.2, 4));
    boxCollider(x + sx, z + 4, 4.2, 1.6, 0);
  }
  BUILDINGS.push({ x, z: z - 12, w: 42, d: 16, rot: 0, h: 16 }, { x, z: z + 18, w: 32, d: 10, rot: 0, h: 10 });
}

// ---------- 大龍峒保安宮: bright 剪黏 on every ridge, a big bronze burner in front ----------
function buildBaoan() {
  const [x, z] = LANDMARKS.baoan;
  const P = placer(x, z, 0);
  const wall = 0xb8352c, roof = 0xd9842c;
  templeHall(P, 26, 9, 5.2, wall, roof, { z: 14, ridge: 0x2f9e6b });
  plaque(P, 'baoan', 5.6, 0, 5.6, 18.65);
  templeHall(P, 30, 14, 6.6, wall, roof, { z: -10, second: true, ridge: 0x3a7fd5 });
  lanternRow(P, 24, 5.4, 18.9);
  incenseBurner(x, z + 25, 1.1);
  boxCollider(x, z + 14, 28, 9.4, 0);
  boxCollider(x, z - 10, 32, 14.4, 0);
  BUILDINGS.push({ x, z: z - 10, w: 32, d: 14, rot: 0, h: 15 }, { x, z: z + 14, w: 28, d: 9, rot: 0, h: 9 });
}

// ---------- 臺北孔廟: red walls, a quiet courtyard, no burner, the 大成殿 with its double roof ----------
function buildConfucius() {
  const [x, z] = LANDMARKS.confucius;
  const P = placer(x, z, 0);
  const wall = 0xa8382c, roof = 0xd4a033;
  // the courtyard wall all round, a gate in the south side
  for (const [lx, lz, w, d] of [[-17, 0, 1.2, 36], [17, 0, 1.2, 36], [-10.5, 18, 13, 1.2], [10.5, 18, 13, 1.2], [0, -18, 35, 1.2]]) {
    addStatic(box(w, 3.6, d), wall, P(lx, 1.8, lz));
    addStatic(box(w + 0.6, 0.5, d + 0.6), 0x5d5a55, P(lx, 3.8, lz));
    boxCollider(x + lx, z + lz, w + 0.2, d + 0.2, 0);
  }
  addStatic(box(8, 5, 2.4), wall, P(0, 2.5, 18));
  templeRoof(P, 9.6, 3.6, 5, 0x5d5a55, 1.4, 0x5d5a55);
  plaque(P, 'confucius', 5, 0, 3.4, 19.25);
  templeHall(P, 22, 12, 6.2, wall, roof, { z: -8, second: true, ridge: 0xd4a033 });
  addStatic(box(12, 0.6, 9), 0xd8d0c2, P(0, 0.3, 7)); // the 月台 terrace in front of the hall
  BUILDINGS.push({ x, z: z - 8, w: 24, d: 12, rot: 0, h: 15 });
}

// ---------- 忠烈祠: the gate on 北安路, the hall against 劍潭山, and two guards who never blink ----------
const GUARDS = [];
function guardFigure(x, z, ry) {
  const P = placer(x, z, ry);
  addStatic(box(0.9, 0.3, 0.7), 0x1d1f24, P(0, 0.15, 0));                      // boots
  addStatic(box(0.75, 1.2, 0.5), 0x1d1f24, P(0, 0.9, 0));                       // trousers
  addStatic(box(0.95, 1.1, 0.6), 0x2c4f8a, P(0, 2.05, 0));                      // tunic
  addStatic(box(1.0, 0.12, 0.62), 0xffffff, P(0, 1.55, 0));                     // white belt
  addStatic(new THREE.SphereGeometry(0.32, 10, 8), 0xf2c9a0, P(0, 2.85, 0));    // face
  addStatic(new THREE.SphereGeometry(0.4, 10, 6, 0, TAU, 0, Math.PI / 2), 0xf4f4f0, P(0, 3.0, 0)); // white helmet
  const [g, m] = cylBetween(0, 0, 0, 0, 1.9, 0, 0.06, 0.06, 5);
  addStatic(g, 0x6d4a2a, P(0.42, 1.4, 0.15).multiply(m));                       // rifle, shouldered
  addCollider({ t: 0, x, z, r: 0.6 });
  GUARDS.push([x, z]);
}
function buildMartyrs() {
  const [x, z] = LANDMARKS.martyrs;
  const P = placer(x, z, 0); // the gate faces south, down to 北安路 and the river
  const wall = 0xc2402f, roof = 0xe2b13a, white = 0xf1ece2;
  // 山門: a three-bay gate
  addStatic(box(26, 1, 8), 0xe6e1d8, P(0, 0.5, 21));
  for (const sx of [-1, 0, 1]) {
    if (sx) addStatic(box(6, 6.4, 6), wall, P(sx * 9, 3.7, 21));
    boxCollider(x + sx * 9, z + 21, sx ? 6.2 : 1, 6.2, 0);
  }
  addStatic(box(26, 2.0, 6.4), wall, P(0, 7.6, 21));
  templeRoof(P, 29, 9, 8.6, roof, 2.8, 0xe2b13a);
  plaque(P, 'martyrs', 6.4, 0, 7.6, 24.25);
  // the long white terrace and the main hall
  addStatic(box(44, 1.6, 22), white, P(0, 0.8, -12));
  addStatic(box(36, 1.4, 18), white, P(0, 2.3, -12));
  for (let i = 0; i < 4; i++) addStatic(box(10, 0.75 * (i + 1), 1.4), white, P(0, 0.37 * (i + 1), -0.4 - i * 1.4 + 0.0));
  templeHall(P, 32, 14, 7.6, wall, roof, { z: -13, second: true, rh: 3.6, ridge: 0xe2b13a });
  boxCollider(x, z - 12, 44.4, 22.4, 0);
  // the guards on duty at the gate, and the sentry boxes beside them
  for (const sx of [-1, 1]) {
    guardFigure(x + sx * 4.2, z + 26.5, 0);
    addStatic(box(2.4, 0.3, 2.4), white, P(sx * 4.2, 0.15, 26.5));
  }
  BUILDINGS.push({ x, z: z - 12, w: 44, d: 22, rot: 0, h: 18 }, { x, z: z + 21, w: 26, d: 6, rot: 0, h: 11 });
}

// ---------- 松山慈祐宮: four storeys of temple at the gate of 饒河夜市 ----------
function buildCiyou() {
  const [x, z] = LANDMARKS.ciyou;
  const P = placer(x, z, 0);
  const wall = 0xb8352c, roof = 0xd9842c;
  templeHall(P, 24, 9, 5.2, wall, roof, { z: 12, ridge: 0x2f9e6b });
  plaque(P, 'ciyou', 5.6, 0, 5.6, 16.65);
  lanternRow(P, 22, 5.4, 16.9);
  // the tall rear building: floor upon floor, each with its own eaves
  for (let f = 0; f < 4; f++) {
    const w = 28 - f * 4, d = 14 - f * 2, y0 = 1 + f * 6.2;
    addStatic(windowBox(w, 5.2, d, 3, 5.2), wall, P(0, y0 + 2.6, -9), { mat: 'city', uv: true });
    templeRoof((lx, ly, lz, ...r) => P(lx, ly, lz - 9, ...r), w + 3, d + 3, y0 + 5.2, roof, f === 3 ? 3 : 1.2, 0xf2c14e);
  }
  incenseBurner(x, z + 21, 0.9);
  boxCollider(x, z + 12, 26, 9.4, 0);
  boxCollider(x, z - 9, 28.4, 14.4, 0);
  BUILDINGS.push({ x, z: z - 9, w: 28, d: 14, rot: 0, h: 27 }, { x, z: z + 12, w: 26, d: 9, rot: 0, h: 9 });
}

// ---------- 華山1914: the old brewery's red-brick warehouses and its chimney ----------
function buildHuashan() {
  const [x, z] = LANDMARKS.huashan;
  const brick = 0xb5583f, roof = 0x6d6a66, white = 0xe9e4d8;
  for (const [lx, lz, w, d, h] of [[-26, -10, 34, 12, 7], [14, -12, 30, 11, 8], [-28, 12, 26, 10, 6.4], [6, 13, 22, 11, 6.4]]) {
    const P = placer(x + lx, z + lz, 0);
    addStatic(windowBox(w, h, d, 4, h), brick, P(0, h / 2, 0), { mat: 'city', uv: true });
    addStatic(hipRoofGeo(w + 1, d + 1.6, 3.2, 0.95), roof, P(0, h, 0), { flat: true });
    addStatic(box(w + 0.2, 0.5, d + 0.2), white, P(0, h - 0.3, 0));
    boxCollider(x + lx, z + lz, w + 0.4, d + 0.4, 0);
    BUILDINGS.push({ x: x + lx, z: z + lz, w, d, rot: 0, h });
  }
  // the brewery chimney
  const cx = x + 36, cz = z + 12;
  addStatic(new THREE.CylinderGeometry(1.1, 1.9, 26, 10), brick, M(cx, 13, cz));
  for (const y of [8, 17, 25.4]) addStatic(new THREE.CylinderGeometry(1.75 - y * 0.026, 1.75 - y * 0.026, 0.6, 10), white, M(cx, y, cz));
  addCollider({ t: 0, x: cx, z: cz, r: 2.1 });
  // a banner for the show on, and a few market tents on the square
  const P = placer(x, z, 0);
  plaque(P, 'huashan', 7, 14, 5.4, -6.4);
  for (const [lx, lz, c] of [[36, -14, 0xffffff], [44, -14, 0xf2c14e], [40, -4, 0x3a7fd5]]) {
    addStatic(new THREE.ConeGeometry(2.6, 1.6, 4), c, M(x + lx, 3.4, z + lz, 0, Math.PI / 4, 0), { flat: true });
    for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) addStatic(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), 0x7a8088, M(x + lx + ox, 1.3, z + lz + oz));
    addStatic(box(2.6, 0.9, 1.2), 0xe2e4e6, M(x + lx, 0.45, z + lz));
    boxCollider(x + lx, z + lz, 2.8, 1.4, 0);
  }
}

// a parked car for lots and roofs (static, no traffic logic)
const LOT_CARS = [0xffffff, 0xd9dde0, 0x2b2f35, 0x8a9096, 0xb8352c, 0x2f5f9e, 0xf2f0ea, 0x3a6b4a];
function lotCar(x, y, z, ry, col) {
  const P = placer(x, z, ry, y);
  addStatic(box(1.9, 0.75, 4.1), col, P(0, 0.6, 0), { mat: 'city' });
  addStatic(box(1.7, 0.62, 2.1), 0x9fc4d8, P(0, 1.28, -0.2), { mat: 'city', noShadow: true });
  addStatic(box(1.72, 0.12, 2.0), col, P(0, 1.62, -0.2), { mat: 'city', noShadow: true });
}
// a taxi (yellow, with the roof light) waiting at a stand
function taxiProp(x, z, ry) {
  lotCar(x, 0, z, ry, 0xf2c230);
  addStatic(box(0.7, 0.3, 0.35), 0xffffff, M(x, 1.86, z, 0, ry, 0), { noShadow: true });
  addCollider({ t: 0, x, z, r: 1.3 });
}

// ---------- 美麗華: the shopping mall in 大直, its Ferris wheel up on the roof, the plaza on 北安路 ----------
function buildMiramar(scene) {
  const [x, z] = LANDMARKS.miramar;
  const P = placer(x, z, Math.PI); // the front (+z) looks north, onto 北安路
  const w = 72, d = 38, h = 20;
  addStatic(windowBox(w, h, d, 4, 5), 0xece7dc, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w - 0.6, 0.2, d - 0.6), 0xa3a9ab, P(0, h + 0.1, 0), { mat: 'city' });
  for (const sz of [-1, 1]) addStatic(box(w + 0.4, 1.4, 0.6), 0xd9312b, P(0, h + 0.5, sz * (d / 2 - 0.1)), { mat: 'city' });
  for (const sx of [-1, 1]) addStatic(box(0.6, 1.4, d + 0.4), 0xd9312b, P(sx * (w / 2 - 0.1), h + 0.5, 0), { mat: 'city' });
  // the glass atrium over the main doors, a red band and the big name on the front
  addStatic(box(22, h - 2, 3), 0x8fd0ea, P(-4, (h - 2) / 2, d / 2 + 1.2), { mat: 'city' });
  addStatic(box(23, 0.8, 3.4), 0xffffff, P(-4, h - 1.6, d / 2 + 1.2), { mat: 'city' });
  addStatic(box(w + 0.2, 1.1, 0.4), 0xd9312b, P(0, 6.2, d / 2 + 0.2), { mat: 'city' });
  plaque(P, 'miramar', 16, -4, h - 5.2, d / 2 + 2.95);
  plaque(P, 'miramar', 9, 26, 9.6, d / 2 + 0.25);
  // a canopy over the doors
  addStatic(box(18, 0.5, 5), 0xf4f1ea, P(-4, 4.4, d / 2 + 4.2), { mat: 'city' });
  for (const sx of [-8, 0]) addStatic(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 8), 0xe0e0e0, P(sx, 2.1, d / 2 + 6.2));
  boxCollider(x, z, w + 0.6, d + 3.4, 0);
  BUILDINGS.push({ x, z, w, d, rot: 0, h });
  // the cinema block at the east end, a big screen on its face
  const cx = -24, ch = 30;
  addStatic(windowBox(22, ch - h, 26, 4, 5), 0xd8d2c6, P(cx, h + (ch - h) / 2, -2), { mat: 'city', uv: true });
  addStatic(box(14, 7, 0.4), 0x2b2f35, P(cx, h + 5.5, 11.2), { mat: 'city' });
  addStatic(box(13, 6, 0.2), 0x4fb3ff, P(cx, h + 5.5, 11.45), { noShadow: true });
  addStatic(box(13, 2, 0.22), 0xff6fae, P(cx, h + 3.5, 11.5), { noShadow: true });
  // the wheel stands on the roof at the west end, by the road: it faces 北安路 and the hills
  const R = 18, hub = h + R + 4.5;
  addStatic(box(14, 1.2, 10), 0xbdb6a8, P(18, h + 1.2, 6));
  const [wx, wz] = localToWorld(x, z, Math.PI, 18, 6);
  buildWheel(scene, wx, hub, wz, R, Math.PI / 2, { y0: h + 1.6, n: 18, spokes: [0xff4f8a, 0xffd23a, 0x4fb3ff], rim: 0xf8f6f2, speed: 0.08 });
  // the plaza: a round fountain, palms, benches, and the taxi stand along the curb
  const [fx, fz] = localToWorld(x, z, Math.PI, 22, d / 2 + 9);
  addStatic(new THREE.CylinderGeometry(4.6, 4.8, 0.7, 24), 0xcfc8ba, M(fx, 0.35, fz));
  addStatic(new THREE.CylinderGeometry(4.1, 4.1, 0.1, 24), 0x6fd0e0, M(fx, 0.72, fz), { noShadow: true });
  addStatic(new THREE.CylinderGeometry(0.25, 0.7, 3.2, 10), 0xdff6fb, M(fx, 1.9, fz), { noShadow: true });
  addCollider({ t: 0, x: fx, z: fz, r: 4.9 });
  for (const lx of [-30, -18, 8, 32]) {
    const [px, pz] = localToWorld(x, z, Math.PI, lx, d / 2 + 8);
    VEG.palm.push({ x: px, y: 0, z: pz, ry: rand(0, TAU), s: rand(1.0, 1.15), color: 0xffffff });
    addCollider({ t: 0, x: px, z: pz, r: 0.6 });
  }
  for (let k = 0; k < 3; k++) {
    const [tx, tz] = localToWorld(x, z, Math.PI, -10 - k * 5.2, d / 2 + 13.2);
    taxiProp(tx, tz, Math.PI / 2);
  }
}

// ---------- 慈濟關渡園區: the grey-roofed 靜思堂 on 立德路, the TV station behind it, a lotus pond in front ----------
function buildTzuchi() {
  const [x, z] = LANDMARKS.tzuchi;
  const rot = -Math.PI / 2, P = placer(x, z, rot); // the front (+z) looks west, onto 立德路
  const white = 0xf3f1ec, grey = 0x5b636c, stone = 0xd8d3c8;
  addStatic(box(40, 1.2, 26), stone, P(0, 0.6, -2));
  // the hall: white walls behind a long row of slim columns, two tiers of grey roof
  addStatic(windowBox(34, 10, 18, 3.4, 5), white, P(0, 6.2, -3), { mat: 'city', uv: true });
  for (let i = 0; i <= 10; i++) addStatic(new THREE.CylinderGeometry(0.38, 0.38, 9.6, 8), 0xe9e6de, P(-16 + i * 3.2, 6, 7.2));
  addStatic(box(35, 0.6, 2.4), white, P(0, 11.1, 7.0));
  addStatic(hipRoofGeo(39, 24, 3.4, 0.86), grey, P(0, 11.2, -2), { flat: true });
  addStatic(box(22, 2.6, 10), white, P(0, 15.6, -3));
  addStatic(hipRoofGeo(26, 14, 3.0, 0.8), grey, P(0, 16.9, -3), { flat: true });
  for (let i = 0; i < 4; i++) addStatic(box(9, 0.5 * (i + 1), 1.3), stone, P(0, 0.25 * (i + 1), 10 + 1.3 * (3 - i)));
  plaque(P, 'tzuchi', 7.2, 0, 9.4, 8.45);
  boxCollider(x + 2, z, 26.4, 40.4, 0);
  BUILDINGS.push({ x: x + 2, z, w: 24, d: 40, rot: 0, h: 18 });
  // 大愛電視: a plain office block behind, a dish on its roof
  const [bx, bz] = localToWorld(x, z, rot, 0, -19);
  const Q = placer(bx, bz, rot);
  addStatic(windowBox(26, 16, 10, 3.4, 3.4), 0xe6e4de, Q(0, 8, 0), { mat: 'city', uv: true });
  addStatic(box(26.4, 0.8, 10.4), 0x2f6fb8, Q(0, 16.2, 0), { mat: 'city' });
  plaque(Q, 'daai', 6, 7, 13, 5.25);
  addStatic(new THREE.SphereGeometry(2, 12, 6, 0, TAU, 0, Math.PI / 2), 0xf4f4f0, Q(-7, 17.2, 0, Math.PI * 0.75, 0, 0), { mat: 'double' });
  addStatic(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 6), 0x9aa3a9, Q(-7, 17.4, 0));
  boxCollider(bx, bz, 10.4, 26.4, 0);
  BUILDINGS.push({ x: bx, z: bz, w: 10, d: 26, rot: 0, h: 17 });
  // the garden between the hall and the street: a lotus pond and a few trimmed trees
  const [ox, oz] = localToWorld(x, z, rot, -9, 18);
  addStatic(new THREE.CylinderGeometry(1, 1, 0.5, 24), 0xcfc8ba, M(ox, 0.25, oz, 0, 0, 0, 6.5, 1, 4.4));
  addStatic(new THREE.CylinderGeometry(1, 1, 0.1, 24), 0x5fb3a8, M(ox, 0.52, oz, 0, 0, 0, 6, 1, 3.9), { noShadow: true });
  for (let i = 0; i < 9; i++) VEG.lily.push({ x: ox + rand(-4, 4), y: 0.6, z: oz + rand(-2.6, 2.6), ry: rand(0, TAU), s: rand(0.7, 1.1) });
  boxCollider(ox, oz, 13.4, 9.2, 0);
  for (const lx of [-17, 10, 17]) { const [tx, tz] = localToWorld(x, z, rot, lx, 17); addTree(tx, tz, 0.8); }
}

// ---------- 好事多: the warehouse store on 立德路, its car park on the roof and a ramp up the side ----------
function buildCostco() {
  const [x, z] = LANDMARKS.costco;
  const rot = Math.PI / 2, P = placer(x, z, rot); // the front (+z) looks east, onto 立德路
  const w = 36, d = 32, h = 10.5, wall = 0xd9d4c8;
  addStatic(box(w, h, d), wall, P(0, h / 2, 0), { mat: 'city' });
  addStatic(box(w + 0.3, 1.6, d + 0.3), 0x2f7d4f, P(0, h - 1.2, 0), { mat: 'city' });
  addStatic(box(w + 0.3, 0.5, d + 0.3), 0xf2c14e, P(0, h - 2.25, 0), { mat: 'city' });
  // roof deck with parking bays, lamp posts and the cars of the weekend crowd
  addStatic(box(w - 0.4, 0.2, d - 0.4), 0x8a8f94, P(0, h + 0.1, 0), { mat: 'city' });
  for (const sz of [-1, 1]) addStatic(box(w, 1.1, 0.5), 0xbfc4c6, P(0, h + 0.55, sz * (d / 2 - 0.25)), { mat: 'city' });
  for (const sx of [-1, 1]) addStatic(box(0.5, 1.1, d), 0xbfc4c6, P(sx * (w / 2 - 0.25), h + 0.55, 0), { mat: 'city' });
  for (const row of [-9, 9]) for (let i = 0; i < 12; i++) {
    const lx = -w / 2 + 3 + i * 2.75;
    addStatic(box(0.12, 0.04, 4.6), 0xffffff, P(lx - 1.37, h + 0.23, row), { noShadow: true });
    if (rng() < 0.72) {
      const [cx, cz] = localToWorld(x, z, rot, lx, row);
      lotCar(cx, h + 0.2, cz, rot + (row < 0 ? 0 : Math.PI) + rand(-0.04, 0.04), pick(LOT_CARS));
    }
  }
  for (const lx of [-12, 0, 12]) {
    addStatic(new THREE.CylinderGeometry(0.14, 0.14, 6, 6), 0x9aa3a9, P(lx, h + 3.2, 0));
    addStatic(box(1.4, 0.3, 0.6), 0x2b2f35, P(lx, h + 6.2, 0));
  }
  // the ramp up the north side
  const rl = 30, rw = 6.5;
  const ramp = box(rw, 0.6, rl);
  const tilt = Math.atan2(h, rl), rx0 = -w / 2 - rw / 2 - 0.2;
  addStatic(ramp, 0x9a9fa4, P(rx0, h / 2 - 0.2, -1, tilt, 0, 0), { mat: 'city' });
  // pillars under it, each as tall as the deck is high there (the low end is at +z, by the entrance)
  for (const lz of [-12, 0, 8]) { const yh = Math.max(0.6, h / 2 - lz * Math.sin(tilt)); addStatic(box(0.7, yh, 0.7), 0xbfc4c6, P(rx0, yh / 2, lz - 1)); }
  // the entrance: a canopy, the sign, trolleys lined up, and a few tables of hot-dog eaters
  addStatic(box(16, 4.4, 0.3), 0x8fd0ea, P(4, 2.2, d / 2 + 0.1), { mat: 'city' });
  addStatic(box(20, 0.5, 5), 0x2f7d4f, P(4, 4.8, d / 2 + 2.5), { mat: 'city' });
  for (const lx of [-5.5, 13.5]) addStatic(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 8), 0xe0e0e0, P(lx, 2.3, d / 2 + 4.6));
  plaque(P, 'costco', 14, 2, h - 4.4, d / 2 + 0.25);
  plaque(P, 'hotdog', 4.2, -11.5, 3.6, d / 2 + 0.25);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
    const Q = (lx, ly, lz) => P(-6 + i * 0.85 + lx, ly, d / 2 + 2.2 + r * 1.6 + lz);
    addStatic(box(0.75, 0.9, 1.3), 0xc9ced2, Q(0, 0.75, 0), { noShadow: true });
    addStatic(box(0.08, 0.3, 1.4), 0x2f7d4f, Q(0, 1.4, 0), { noShadow: true });
  }
  for (const [lx, lz] of [[-14, 5], [-10.5, 7.5], [-15.5, 9]]) {
    const [tx, tz] = localToWorld(x, z, rot, lx, d / 2 + lz);
    addStatic(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 12), 0xffffff, M(tx, 1.0, tz));
    addStatic(new THREE.CylinderGeometry(0.08, 0.08, 1, 6), 0x9aa3a9, M(tx, 0.5, tz));
    addStatic(new THREE.ConeGeometry(1.9, 0.8, 8), Math.round(lx) % 2 === 0 ? 0xd9312b : 0xf2c14e, M(tx, 2.9, tz), { flat: true });
    addStatic(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), 0x9aa3a9, M(tx, 1.9, tz));
    addCollider({ t: 0, x: tx, z: tz, r: 1.1 });
  }
  boxCollider(x, z, d + 0.6, w + 0.6, 0);
  const [rx, rz] = localToWorld(x, z, rot, -w / 2 - rw / 2 - 0.2, -1);
  boxCollider(rx, rz, rl, rw + 0.4, 0);
  BUILDINGS.push({ x, z, w: d, d: w, rot: 0, h: h + 1 }, { x: rx, z: rz, w: rl, d: rw, rot: 0, h: 4 });
}

// ---------- 關渡自然公園: ponds and reed beds, boardwalks, bird hides, egrets and the visitor centre ----------
function buildWetland() {
  const pk = PARKS.find((p) => p.wetland);
  const ponds = [[-830, -1290, 13, 8], [-800, -1316, 10, 6.5], [-760, -1284, 15, 7], [-728, -1312, 9, 6], [-842, -1326, 8, 5.5], [-806, -1338, 8, 4.2]];
  for (const [px, pz, rx, rz] of ponds) {
    addStatic(new THREE.CylinderGeometry(1, 1, 0.16, 28), 0x9c8a6a, M(px, 0.06, pz, 0, 0, 0, rx + 1.4, 1, rz + 1.4), { noShadow: true });
    addStatic(new THREE.CylinderGeometry(1, 1, 0.12, 28), 0x5fb0b8, M(px, 0.12, pz, 0, 0, 0, rx, 1, rz), { noShadow: true });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), k = rand(0.95, 1.25);
      VEG.tuft.push({ x: px + Math.cos(a) * rx * k, y: 0.1, z: pz + Math.sin(a) * rz * k, ry: rand(0, TAU), s: rand(1.1, 1.7) });
    }
    for (let i = 0; i < 3; i++) VEG.lily.push({ x: px + rand(-rx, rx) * 0.5, y: 0.2, z: pz + rand(-rz, rz) * 0.5, ry: rand(0, TAU), s: rand(0.7, 1.1) });
    // egrets wading at the edge
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU), bx = px + Math.cos(a) * rx * 0.8, bz = pz + Math.sin(a) * rz * 0.8, Q = placer(bx, bz, rand(0, TAU));
      addStatic(box(0.35, 0.35, 0.7), 0xffffff, Q(0, 0.75, 0), { noShadow: true });
      addStatic(box(0.12, 0.55, 0.12), 0xffffff, Q(0, 1.15, 0.3), { noShadow: true });
      addStatic(box(0.08, 0.08, 0.35), 0xf2c14e, Q(0, 1.4, 0.48), { noShadow: true });
      addStatic(box(0.05, 0.6, 0.05), 0x3b2a1e, Q(0, 0.3, 0), { noShadow: true });
    }
  }
  // 水筆仔: the low mangroves 關渡 is known for, in clumps along the water
  for (let i = 0; i < 70; i++) {
    const [px, pz, rx, rz] = pick(ponds), a = rand(0, TAU), k = rand(1.15, 1.6);
    VEG.bush.push({ x: px + Math.cos(a) * rx * k, y: 0, z: pz + Math.sin(a) * rz * k, ry: rand(0, TAU), s: rand(0.9, 1.5), color: pick([0x3f7a3a, 0x4f8a3f, 0x5a9446]) });
  }
  // reeds everywhere else
  for (let i = 0; i < 160; i++) {
    const tx = rand(pk.x0 + 6, pk.x1 - 6), tz = rand(pk.z0 + 6, pk.z1 - 6);
    if (ponds.some(([px, pz, rx, rz]) => ((tx - px) / (rx + 2)) ** 2 + ((tz - pz) / (rz + 2)) ** 2 < 1)) continue;
    VEG.tuft.push({ x: tx, y: 0, z: tz, ry: rand(0, TAU), s: rand(1.0, 1.6) });
  }
  // boardwalks between the ponds
  for (const [ax, az, bx, bz] of [[-850, -1302, -720, -1300], [-790, -1340, -790, -1268], [-760, -1300, -735, -1332]]) {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    addStatic(box(2.2, 0.3, len), 0x9a6b42, M((ax + bx) / 2, 0.25, (az + bz) / 2, 0, ry, 0), { noShadow: true });
  }
  // two bird hides: wooden huts with a slot to look through
  for (const [hx, hz, ry] of [[-818, -1306, 0.3], [-742, -1296, -0.4]]) {
    const Q = placer(hx, hz, ry);
    addStatic(box(5, 2.6, 3.4), 0x8a5a36, Q(0, 1.3, 0));
    addStatic(box(4.2, 0.4, 0.1), 0x2b1e14, Q(0, 1.9, 1.72), { noShadow: true });
    addStatic(hipRoofGeo(5.8, 4.2, 1.1, 0.7), 0x5a3a24, Q(0, 2.6, 0), { flat: true });
    boxCollider(hx, hz, 5.4, 5.4, 0);
  }
  // the visitor centre by 大度路, with its glass lookout on top
  const vx = -756, vz = -1334, Q = placer(vx, vz, Math.PI);
  addStatic(windowBox(20, 6.6, 9, 3.4, 3.3), 0xefe9dc, Q(0, 3.3, 0), { mat: 'city', uv: true });
  addStatic(box(12, 3.2, 7), 0x8fd0ea, Q(-3, 8.2, 0), { mat: 'city' });
  addStatic(box(13, 0.5, 8), 0x6d4a2a, Q(-3, 10.05, 0), { mat: 'city' });
  addStatic(box(20.6, 0.5, 9.6), 0x6d4a2a, Q(0, 6.85, 0), { mat: 'city' });
  plaque(Q, 'guandu', 9, 0, 5.2, 4.75);
  boxCollider(vx, vz, 20.4, 9.4, 0);
  BUILDINGS.push({ x: vx, z: vz, w: 20, d: 9, rot: 0, h: 10 });
}

function buildScenes(scene) {
  buildXingtian();
  buildBaoan();
  buildConfucius();
  buildMartyrs();
  buildCiyou();
  buildHuashan();
  buildMiramar(scene);
  buildTzuchi();
  buildCostco();
  buildWetland();
}

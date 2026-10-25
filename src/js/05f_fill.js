// ===================== the gaps between buildings: what fills them in a real Taipei block =====================
// After the street fronts and block interiors are built, the leftover ground is filled the way it is in the city:
// 公寓 walk-ups with sheet-metal rooms on the roof, open-air car parks with a pay booth, a pocket park with a slide
// and an exercise corner, a fenced basketball court, a little 土地公 shrine, a gas station on a main road, sheet-metal
// sheds and recycling yards, a vegetable patch on an empty lot, and scooter parks. Low-poly boxes, merged per chunk.
const FILL = { n: {}, occ: null, C: 2.5, NX: 0, NZ: 0 };
function occInit() {
  FILL.NX = Math.ceil(WXS / FILL.C); FILL.NZ = Math.ceil(WZS / FILL.C);
  FILL.occ = new Uint8Array(FILL.NX * FILL.NZ);
}
// run fn over the cells under a rotated rectangle
function occCells(x, z, w, d, rot, fn) {
  const c = Math.cos(rot), s = Math.sin(rot), C = FILL.C;
  for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += C * 0.8) for (let lz = -d / 2; lz <= d / 2 + 0.01; lz += C * 0.8) {
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    const i = Math.floor((wx - WX0) / C), j = Math.floor((wz - WZ0) / C);
    if (i < 0 || j < 0 || i >= FILL.NX || j >= FILL.NZ) continue;
    if (fn(j * FILL.NX + i) === false) return false;
  }
  return true;
}
const occFree = (x, z, w, d, rot) => occCells(x, z, w, d, rot, (k) => (FILL.occ[k] ? false : true));
const occMark = (x, z, w, d, rot) => occCells(x, z, w, d, rot, (k) => { FILL.occ[k] = 1; });
const fillCount = (k) => { FILL.n[k] = (FILL.n[k] || 0) + 1; };
const pad = (P, w, d, col, y = 0.05) => addStatic(box(w, 0.08, d), col, P(0, y, 0), { noShadow: true });

// ---------- 公寓: a four- or five-storey walk-up, iron window grilles, a sheet-metal room on the roof ----------
const WALKUP_WALLS = [0xe8e2d4, 0xd9d2c4, 0xcfd7d0, 0xe6d0bf, 0xd4d9de, 0xf0e6cf, 0xe3d9c9, 0xc9cfd6, 0xd8c3a5, 0xc7744f];
const TIN = [0x4f8fb3, 0x3f9e8f, 0x8a95a0, 0x5a86b8, 0xe9eef0, 0x6aa84f];
function fillWalkup(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  const floors = rng() < 0.6 ? 4 : 5, fh = 3.1, h = floors * fh + 0.5, col = pick(WALKUP_WALLS);
  addStatic(windowBox(w, h, d, 2.9, fh), col, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w + 0.25, 0.45, d + 0.25), shade(col, 0.82), P(0, h + 0.2, 0), { mat: 'city' });
  // 頂樓加蓋 (almost always), the corrugated roof sloping a little
  const rw = w * rand(0.6, 0.95), rd = d * rand(0.55, 0.85), ox = rand(-(w - rw) / 2, (w - rw) / 2);
  addStatic(box(rw, 2.5, rd), pick([0xd8d6cf, 0xc9c4b8, 0xe2ddd0]), P(ox, h + 1.45, -d * 0.08), { mat: 'city' });
  addStatic(hipRoofGeo(rw + 0.8, rd + 0.8, 0.7, 0.95), pick(TIN), P(ox, h + 2.7, -d * 0.08), { flat: true });
  addStatic(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 8), rng() < 0.5 ? 0xdfe3e6 : 0x4a86c8, P(rand(-w / 3, w / 3), h + 1.15, d * 0.3), { mat: 'city' });
  // grilles on the front, floors 2 and up, and an air conditioner here and there
  for (let f = 1; f < floors; f++) {
    if (rng() < 0.2) continue;
    const y = f * fh + 1.35, cw = w - 1.4;
    addStatic(repQuad(cw, 2.0, 0.55), 0x4a5058, P(0, y, d / 2 + 0.45), { mat: 'bars', uv: true, noShadow: true });
    if (rng() < 0.3) addStatic(box(1.0, 0.7, 0.55), 0xd5d8da, P(rand(-cw / 2 + 1, cw / 2 - 1), y - 0.55, d / 2 + 0.3), { mat: 'city' });
  }
  // the ground floor: an iron door and a rolling shutter (a garage or a little shop)
  addStatic(box(1.1, 2.3, 0.18), pick([0xb5413a, 0x2f7a5a, 0x8a5a3a]), P(-w / 2 + 1.4, 1.15, d / 2 + 0.06), { mat: 'city' });
  addStatic(box(Math.min(3.6, w - 3.6), 2.6, 0.14), 0xaab0b5, P(w / 2 - 2.4, 1.3, d / 2 + 0.05), { mat: 'city' });
  boxCollider(x, z, w + 0.3, d + 0.3, rot);
  BUILDINGS.push({ x, z, w, d, rot, h });
}

// ---------- 透天厝: a narrow three- or four-storey house, a shop shutter below, a balcony and a tin room on top ----------
function fillRow(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  const floors = rng() < 0.55 ? 3 : 4, fh = 3.2, h = floors * fh + 0.4, col = pick(WALKUP_WALLS);
  addStatic(windowBox(w, h, d, w / 2, fh), col, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w + 0.2, 0.4, d + 0.2), shade(col, 0.8), P(0, h + 0.2, 0), { mat: 'city' });
  addStatic(box(w - 0.6, 2.7, 0.14), pick([0xaab0b5, 0x9aa3a9, 0xb8bec4]), P(0, 1.35, d / 2 + 0.05), { mat: 'city' });
  addStatic(box(w - 0.2, 0.14, 1.2), pick(AWNINGS), P(0, 3.0, d / 2 + 0.6, 0.15, 0, 0), { mat: 'city' });
  addStatic(repQuad(w - 0.8, 1.8, 0.55), 0x4a5058, P(0, fh + 1.3, d / 2 + 0.5), { mat: 'bars', uv: true, noShadow: true });
  if (rng() < 0.7) {
    addStatic(box(w - 0.4, 2.3, d * 0.6), pick([0xd8d6cf, 0xc9c4b8]), P(0, h + 1.3, -d * 0.15), { mat: 'city' });
    addStatic(hipRoofGeo(w + 0.4, d * 0.6 + 0.6, 0.6, 0.95), pick(TIN), P(0, h + 2.45, -d * 0.15), { flat: true });
  }
  boxCollider(x, z, w + 0.2, d + 0.2, rot);
  BUILDINGS.push({ x, z, w, d, rot, h });
}
// ---------- 小綠地: a scrap of green with a tree, a bench and some shrubs ----------
function fillGreen(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0x8cc46f, 0.04);
  const [tx, tz] = localToWorld(x, z, rot, rand(-w / 4, w / 4), rand(-d / 4, 0));
  addTree(tx, tz, rand(0.75, 1.0));
  for (let i = 0; i < 3; i++) { const [bx, bz] = localToWorld(x, z, rot, rand(-w / 2 + 0.8, w / 2 - 0.8), rand(-d / 2 + 0.8, d / 2 - 0.8)); VEG.bush.push({ x: bx, y: 0, z: bz, ry: rand(0, TAU), s: rand(0.5, 0.8), color: pick([0x63b445, 0x4f9d3a, 0xd3a640]) }); }
  if (w > 4.5) addStatic(box(1.8, 0.45, 0.5), 0x8a5a36, P(0, 0.45, d / 2 - 0.8));
}

// ---------- 平面停車場: an open-air car park, stall lines, a pay booth and the blue P sign ----------
function fillParking(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0x5d6168);
  // a low kerb round three sides (the street side is open)
  for (const sx of [-1, 1]) addStatic(box(0.35, 0.3, d), 0xbfbcb4, P(sx * (w / 2 - 0.18), 0.15, 0), { noShadow: true });
  addStatic(box(w, 0.3, 0.35), 0xbfbcb4, P(0, 0.15, -d / 2 + 0.18), { noShadow: true });
  const rows = d >= 15 ? [[-d / 2 + 2.9, 0], [d / 2 - 2.9 - 5.5, Math.PI]] : [[-d / 2 + 2.9, 0]];
  const sw = 2.7, n = Math.floor((w - 2) / sw);
  for (const [rz, flip] of rows) for (let i = 0; i < n; i++) {
    const lx = -w / 2 + 1 + sw * (i + 0.5);
    addStatic(box(0.12, 0.03, 5), 0xf4f2ea, P(lx - sw / 2, 0.11, rz), { noShadow: true });
    if (i === n - 1) addStatic(box(0.12, 0.03, 5), 0xf4f2ea, P(lx + sw / 2, 0.11, rz), { noShadow: true });
    if (rng() < 0.72) {
      const [cx, cz] = localToWorld(x, z, rot, lx, rz), ry = rot + flip + rand(-0.05, 0.05);
      lotCar(cx, 0.1, cz, ry, pick(LOT_CARS));
      boxCollider(cx, cz, 2.0, 4.2, ry);
    }
  }
  // the pay booth by the gate, and the sign on a pole
  const [bx, bz] = localToWorld(x, z, rot, w / 2 - 1.6, d / 2 - 1.6);
  addStatic(box(1.7, 2.3, 1.7), 0xf4f2ea, P(w / 2 - 1.6, 1.2, d / 2 - 1.6), { mat: 'city' });
  addStatic(box(1.6, 0.9, 0.1), 0x8fd0ea, P(w / 2 - 1.6, 1.6, d / 2 - 0.72), { mat: 'city', noShadow: true });
  addStatic(box(2.1, 0.2, 2.1), 0x2f6fb8, P(w / 2 - 1.6, 2.45, d / 2 - 1.6), { mat: 'city' });
  addCollider({ t: 0, x: bx, z: bz, r: 1.2 });
  addStatic(box(0.16, 4.2, 0.16), 0x9aa3a9, P(-w / 2 + 0.8, 2.1, d / 2 - 0.4));
  addStatic(atlasQuad(4.4, 1.1, STREET.plate, LSIGN.lotP.k, false, 2), 0xffffff, P(-w / 2 + 0.8, 4.2, d / 2 - 0.3), { mat: 'plate', uv: true, noShadow: true });
}

// ---------- 兒童遊戲場: a pocket park with trees, a slide, swings, a pavilion and the exercise corner ----------
function fillPark(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0x86c56f, 0.04);
  addStatic(box(w * 0.18, 0.06, d), 0xd9ccb2, P(0, 0.09, 0), { noShadow: true }); // a path through the middle
  // the playground: a red slide off a platform, a blue frame of swings
  const Q = (lx, lz) => [localToWorld(x, z, rot, lx, lz), (a, b, c, ...r) => P(lx + a, b, lz + c, ...r)];
  {
    const [[sx, sz], S] = Q(-w * 0.25, -d * 0.18);
    addStatic(box(0.8, 0.06, 2.4), 0xe9c6a0, S(0, 0.08, 0), { noShadow: true });
    for (const [a, c] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) addStatic(box(0.15, 1.8, 0.15), 0xf2c14e, S(a, 0.9, c - 1.6));
    addStatic(box(1.6, 0.2, 1.6), 0x3a7fd5, S(0, 1.8, -1.6));
    addStatic(box(0.9, 0.12, 3.2), 0xe23b33, S(0, 1.0, 0.5, -0.55, 0, 0));
    addCollider({ t: 0, x: sx, z: sz - 0.6, r: 1.6 });
  }
  {
    const [[sx, sz], S] = Q(w * 0.25, -d * 0.18);
    for (const a of [-1.6, 1.6]) { addStatic(box(0.14, 2.6, 0.14), 0x3a7fd5, S(a, 1.3, -0.6, 0.25)); addStatic(box(0.14, 2.6, 0.14), 0x3a7fd5, S(a, 1.3, 0.6, -0.25)); }
    addStatic(box(3.4, 0.14, 0.14), 0x3a7fd5, S(0, 2.55, 0));
    for (const a of [-0.7, 0.7]) addStatic(box(0.6, 0.08, 0.4), 0xf2c14e, S(a, 0.6, 0));
    addCollider({ t: 0, x: sx, z: sz, r: 1.8 });
  }
  // the pavilion (涼亭) and the old folks' exercise bars
  if (d > 12) {
    const [[px, pz], S] = Q(-w * 0.25, d * 0.22);
    for (const [a, c] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) addStatic(box(0.22, 2.4, 0.22), 0xb8352c, S(a, 1.2, c));
    addStatic(hipRoofGeo(3.8, 3.8, 1.2, 0), 0x2f7a5a, S(0, 2.4, 0), { flat: true });
    addStatic(box(2.2, 0.45, 0.6), 0x8a5a36, S(0, 0.45, 0));
    addCollider({ t: 0, x: px, z: pz, r: 2.1 });
    const [[ex, ez], E] = Q(w * 0.25, d * 0.22);
    for (const [a, c, col] of [[-1, 0, 0xf2c14e], [0.2, 0.6, 0x3fae5a], [1.2, -0.4, 0xe9524a]]) {
      addStatic(box(0.12, 1.5, 0.12), col, E(a, 0.75, c)); addStatic(box(0.12, 1.5, 0.12), col, E(a + 0.7, 0.75, c)); addStatic(box(0.82, 0.1, 0.1), col, E(a + 0.35, 1.45, c));
    }
    addCollider({ t: 0, x: ex, z: ez, r: 1.7 });
  }
  // trees round the edge, a hedge along the street
  for (const [a, c] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42], [0, -0.44]]) {
    if (rng() < 0.25) continue;
    const [tx, tz] = localToWorld(x, z, rot, a * w, c * d);
    addTree(tx, tz, rand(0.8, 1.1));
  }
  for (let lx = -w / 2 + 1; lx < w / 2 - 1; lx += 1.6) {
    if (Math.abs(lx) < w * 0.1) continue;
    const [hx, hz] = localToWorld(x, z, rot, lx, d / 2 - 0.5);
    VEG.bush.push({ x: hx, y: 0, z: hz, ry: rand(0, TAU), s: rand(0.55, 0.75), color: 0x4f9d3a });
  }
  addStatic(atlasQuad(4.2, 1.05, STREET.plate, LSIGN.kidpark.k, false, 2), 0xffffff, P(w * 0.12 + 2.4, 1.6, d / 2 - 0.2), { mat: 'plate', uv: true, noShadow: true });
  addStatic(box(0.12, 1.1, 0.12), 0x9aa3a9, P(w * 0.12 + 0.4, 0.55, d / 2 - 0.25));
}

// ---------- 籃球場: a fenced half court ----------
function fillCourt(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0x3f7f6a);
  addStatic(box(w - 3, 0.03, d - 3), 0x4f9a7e, P(0, 0.1, 0), { noShadow: true });
  for (const [lw, ld, lx, lz] of [[w - 3, 0.12, 0, -(d - 3) / 2], [w - 3, 0.12, 0, (d - 3) / 2], [0.12, d - 3, -(w - 3) / 2, 0], [0.12, d - 3, (w - 3) / 2, 0], [w - 3, 0.12, 0, 0]]) addStatic(box(lw, 0.04, ld), 0xffffff, P(lx, 0.13, lz), { noShadow: true });
  for (const sz of [-1, 1]) {
    addStatic(box(0.18, 3.2, 0.18), 0x9aa3a9, P(0, 1.6, sz * (d / 2 - 1.2)));
    addStatic(box(1.8, 1.1, 0.1), 0xffffff, P(0, 3.3, sz * (d / 2 - 1.4)));
    addStatic(new THREE.TorusGeometry(0.3, 0.04, 5, 12), 0xe0602a, P(0, 2.9, sz * (d / 2 - 1.75), Math.PI / 2, 0, 0));
    const [hx, hz] = localToWorld(x, z, rot, 0, sz * (d / 2 - 1.2)); addCollider({ t: 0, x: hx, z: hz, r: 0.4 });
  }
  // chain-link fence on three sides, a gap on the street side
  const fence = (lx, lz, len, ry) => addStatic(repQuad(len, 3, 0.4), 0x2f6f4a, P(lx, 1.5, lz, 0, ry, 0), { mat: 'bars', uv: true, noShadow: true });
  fence(0, -d / 2, w, 0); fence(-w / 2, 0, d, Math.PI / 2); fence(w / 2, 0, d, Math.PI / 2);
  fence(-w / 4 - 1, d / 2, w / 2 - 2, 0);
  for (const [cx, cz, cw, cd] of [[0, -d / 2, w, 0.3], [-w / 2, 0, 0.3, d], [w / 2, 0, 0.3, d], [-w / 4 - 1, d / 2, w / 2 - 2, 0.3]]) { const [qx, qz] = localToWorld(x, z, rot, cx, cz); boxCollider(qx, qz, cw, cd, rot); }
}

// ---------- 土地公廟: a little red shrine with an incense burner and lanterns ----------
function fillShrine(x, z, rot) {
  const P = placer(x, z, rot);
  pad(P, 7, 7, 0xcfc8ba);
  addStatic(box(4.4, 0.5, 4), 0xd8d0c2, P(0, 0.25, -0.8));
  addStatic(box(3.4, 2.4, 3), 0xb8352c, P(0, 1.7, -1));
  addStatic(box(1.4, 1.6, 0.12), 0x6a2a1e, P(0, 1.3, 0.52));
  addStatic(hipRoofGeo(4.6, 4.2, 1.3, 0.62), 0xd9842c, P(0, 2.9, -1), { flat: true });
  addStatic(box(2.6, 0.3, 0.4), 0xf2c14e, P(0, 4.3, -1));
  plaque(P, 'shrine', 2.2, 0, 2.55, 0.56);
  for (const sx of [-1, 1]) addStatic(new THREE.SphereGeometry(0.32, 8, 6), 0xd9312b, P(sx * 1.4, 2.4, 0.7, 0, 0, 0, 1, 1.25, 1), { noShadow: true });
  const [ix, iz] = localToWorld(x, z, rot, 0, 2.2);
  addStatic(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 10), 0x4a3f36, M(ix, 0.45, iz));
  addCollider({ t: 0, x: ix, z: iz, r: 0.6 });
  const [cx, cz] = localToWorld(x, z, rot, 0, -0.8);
  boxCollider(cx, cz, 4.6, 4.2, rot);
}

// ---------- 加油站: a canopy over two pump islands on a main road, the shop behind ----------
function fillGas(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0xc9ccce);
  const cw = w - 4, cd = d * 0.5, cz = d * 0.08;
  addStatic(box(cw, 0.8, cd), 0xf4f4f0, P(0, 5.4, cz), { mat: 'city' });
  addStatic(box(cw + 0.1, 0.35, cd + 0.1), 0x2f9e6b, P(0, 5.0, cz), { mat: 'city' });
  for (const sx of [-1, 1]) {
    addStatic(box(0.5, 5, 0.5), 0xe9eef0, P(sx * cw * 0.25, 2.5, cz), { mat: 'city' });
    addStatic(box(1.2, 0.3, cd * 0.7), 0xbfbcb4, P(sx * cw * 0.25, 0.15, cz), { noShadow: true });
    for (const o of [-1, 1]) {
      addStatic(box(0.8, 1.6, 0.6), 0xf4f4f0, P(sx * cw * 0.25, 0.95, cz + o * cd * 0.2), { mat: 'city' });
      addStatic(box(0.82, 0.3, 0.62), 0x2f9e6b, P(sx * cw * 0.25, 1.6, cz + o * cd * 0.2), { mat: 'city' });
    }
    const [ix, iz] = localToWorld(x, z, rot, sx * cw * 0.25, cz); boxCollider(ix, iz, 1.4, cd * 0.7, rot);
  }
  // the shop and the tall price sign
  const sd = Math.min(6, d * 0.28);
  addStatic(windowBox(cw * 0.8, 3.6, sd, 3, 3.6), 0xf4f4f0, P(0, 1.8, -d / 2 + sd / 2 + 0.4), { mat: 'city', uv: true });
  addStatic(box(cw * 0.8 + 0.2, 0.6, sd + 0.2), 0x2f9e6b, P(0, 3.8, -d / 2 + sd / 2 + 0.4), { mat: 'city' });
  const [shx, shz] = localToWorld(x, z, rot, 0, -d / 2 + sd / 2 + 0.4); boxCollider(shx, shz, cw * 0.8 + 0.4, sd + 0.4, rot);
  addStatic(box(0.4, 7, 0.4), 0x9aa3a9, P(w / 2 - 1, 3.5, d / 2 - 1));
  addStatic(box(2.6, 2.2, 0.4), 0xf4f4f0, P(w / 2 - 1, 7.4, d / 2 - 1), { mat: 'city' });
  addStatic(atlasQuad(2.4, 0.6, STREET.plate, LSIGN.gas.k, false, 2), 0xffffff, P(w / 2 - 1, 8.1, d / 2 - 0.78), { mat: 'plate', uv: true, noShadow: true });
  for (let i = 0; i < 3; i++) addStatic(box(1.9, 0.32, 0.05), [0xe9524a, 0xf2c14e, 0x3a7fd5][i], P(w / 2 - 1, 7.45 - i * 0.45, d / 2 - 0.78), { noShadow: true });
  const [px, pz] = localToWorld(x, z, rot, w / 2 - 1, d / 2 - 1); addCollider({ t: 0, x: px, z: pz, r: 0.5 });
  addStatic(atlasQuad(cw * 0.5, cw * 0.125, STREET.plate, LSIGN.gas.k, false, 2), 0xffffff, P(0, 5.4, cz + cd / 2 + 0.06), { mat: 'plate', uv: true, noShadow: true });
}

// ---------- 鐵皮屋: a sheet-metal shed or a recycling yard with its bales ----------
function fillShed(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  const recycle = rng() < 0.4;
  if (recycle) {
    pad(P, w, d, 0x9a9488);
    const sw = w * 0.55;
    addStatic(box(sw, 3.4, d * 0.7), pick([0x8a95a0, 0x5a86b8, 0xb0b5b8]), P(-w / 2 + sw / 2 + 0.3, 1.7, -d * 0.12), { mat: 'city' });
    addStatic(hipRoofGeo(sw + 0.6, d * 0.7 + 0.6, 0.6, 0.95), pick(TIN), P(-w / 2 + sw / 2 + 0.3, 3.4, -d * 0.12), { flat: true });
    const [bx, bz] = localToWorld(x, z, rot, -w / 2 + sw / 2 + 0.3, -d * 0.12); boxCollider(bx, bz, sw, d * 0.7, rot);
    // bales of cardboard and a heap of bottles out front
    for (let i = 0; i < 4; i++) {
      const lx = w * 0.18 + (i % 2) * 1.6, lz = -d * 0.2 + Math.floor(i / 2) * 1.6;
      addStatic(box(1.3, 1.1, 1.3), pick([0xb08a5a, 0x9c7a4f, 0xc49a66]), P(lx, 0.55 + (i > 1 ? 0 : 0), lz));
    }
    const [hx, hz] = localToWorld(x, z, rot, w * 0.18 + 0.8, -d * 0.2 + 0.8); addCollider({ t: 0, x: hx, z: hz, r: 1.8 });
    addStatic(new THREE.ConeGeometry(1.2, 1.0, 7), 0x5fae6b, P(w * 0.3, 0.5, d * 0.25), { flat: true });
  } else {
    const h = rand(3.2, 4.5);
    addStatic(box(w, h, d), pick([0x8a95a0, 0x5a86b8, 0xb0b5b8, 0x6aa84f, 0xd8d6cf]), P(0, h / 2, 0), { mat: 'city' });
    addStatic(hipRoofGeo(w + 0.8, d + 0.8, 0.8, 0.95), pick(TIN), P(0, h, 0), { flat: true });
    addStatic(box(Math.min(4, w - 2), h * 0.7, 0.12), 0xaab0b5, P(0, h * 0.35, d / 2 + 0.07), { mat: 'city' });
    for (let k = 0; k < 4; k++) addStatic(box(Math.min(4, w - 2), 0.06, 0.14), 0x8a9096, P(0, 0.5 + k * h * 0.16, d / 2 + 0.08), { noShadow: true });
    boxCollider(x, z, w + 0.2, d + 0.2, rot);
    BUILDINGS.push({ x, z, w, d, rot, h });
  }
}

// ---------- 空地菜園: an empty lot turned vegetable patch, behind a low green fence ----------
function fillGarden(x, z, rot, w, d) {
  const P = placer(x, z, rot);
  pad(P, w, d, 0x8a6a4a, 0.04);
  for (let lz = -d / 2 + 1.5; lz < d / 2 - 1.5; lz += 2.2) {
    addStatic(box(w - 3, 0.25, 1.1), 0x6a4f36, P(0, 0.15, lz), { noShadow: true });
    for (let lx = -w / 2 + 2; lx < w / 2 - 2; lx += 1.1) addStatic(new THREE.IcosahedronGeometry(0.42, 0), pick([0x5fae40, 0x7cc45a, 0x4f9d3a]), P(lx + rand(-0.2, 0.2), 0.45, lz), { noShadow: true, flat: true });
  }
  for (const [lx, lz, len, ry] of [[0, -d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2], [0, d / 2, w, 0]]) addStatic(repQuad(len, 1.2, 0.5), 0x3f8a4a, P(lx, 0.6, lz, 0, ry, 0), { mat: 'bars', uv: true, noShadow: true });
  addStatic(box(1.8, 1.8, 1.4), pick(TIN), P(w / 2 - 1.6, 0.9, -d / 2 + 1.4), { mat: 'city' });
  const [sx, sz] = localToWorld(x, z, rot, w / 2 - 1.6, -d / 2 + 1.4); addCollider({ t: 0, x: sx, z: sz, r: 1.2 });
  addStatic(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8), 0x3a7fd5, P(-w / 2 + 1.2, 0.4, -d / 2 + 1.2));
}

// ---------- 機車停車場: rows of parked scooters ----------
let SCOOT_GEOS = null;
function fillScooters(x, z, rot, w, d) {
  if (!SCOOT_GEOS) { const K = knockGeos(); SCOOT_GEOS = SCOOTER_COLS.map((c) => { const g = K.scooter.geo.clone(); const C = g.attributes.color; const col = new THREE.Color(c); for (let i = 0; i < C.count; i++) if (C.getX(i) > 0.9 && C.getY(i) > 0.9 && C.getZ(i) > 0.9) C.setXYZ(i, col.r, col.g, col.b); return g; }); }
  const P = placer(x, z, rot);
  pad(P, w, d, 0x8a8f94);
  for (let lz = -d / 2 + 1.2; lz < d / 2 - 1; lz += 2.6) {
    for (let lx = -w / 2 + 0.6; lx < w / 2 - 0.4; lx += 0.95) {
      if (rng() < 0.18) continue;
      addStatic(pick(SCOOT_GEOS), 0xffffff, P(lx, 0, lz, 0, (lz > 0 ? Math.PI : 0) + rand(-0.12, 0.12), 0), { keep: true });
    }
    const [rx, rz] = localToWorld(x, z, rot, 0, lz); boxCollider(rx, rz, w - 0.6, 1.9, rot);
  }
}

// ---------- the filler pass ----------
// candidate spots on a grid; at each free spot, try the kinds of filler that suit it (biggest first)
// gap: how far apart two of a kind must be; max: how many in the whole city
const FILLERS = {
  walkup: { f: fillWalkup, sizes: [[16, 13], [13, 11], [10, 9], [8, 8]], road: 5.2, gap: 0, max: 1e9 },
  parking: { f: fillParking, sizes: [[24, 17], [19, 15], [15, 11], [12, 8.6]], road: 5.2, gap: 45, max: 260 },
  park: { f: fillPark, sizes: [[20, 16], [15, 13], [12, 11]], road: 5.4, gap: 60, max: 110 },
  court: { f: fillCourt, sizes: [[15, 18], [13, 15]], road: 5.4, gap: 110, max: 40 },
  shrine: { f: (x, z, rot) => fillShrine(x, z, rot), sizes: [[7, 7]], road: 5.2, gap: 130, max: 40 },
  gas: { f: fillGas, sizes: [[20, 16], [17, 14]], road: 4.6, main: true, gap: 170, max: 22 },
  shed: { f: fillShed, sizes: [[12, 9], [8, 7], [6, 5]], road: 5.2, gap: 30, max: 220 },
  garden: { f: fillGarden, sizes: [[16, 12], [11, 9]], road: 5.4, gap: 90, max: 60 },
  scooter: { f: fillScooters, sizes: [[9, 5.6], [6, 5.6]], road: 5.2, gap: 70, max: 70 },
  row: { f: fillRow, sizes: [[7, 12], [5.6, 10], [4.6, 8]], road: 5.2, gap: 0, max: 1e9 },
  green: { f: fillGreen, sizes: [[6, 6], [4.4, 4.4]], road: 5.2, gap: 0, max: 1e9 },
};
const FILL_AT = {}; // kind -> placed centres (for the spacing rule)
function fillRoom(k, x, z) {
  const F = FILLERS[k], L = FILL_AT[k] || (FILL_AT[k] = []);
  if (L.length >= F.max) return false;
  if (F.gap) for (const [px, pz] of L) if (Math.abs(px - x) < F.gap && Math.abs(pz - z) < F.gap && hypot(px - x, pz - z) < F.gap) return false;
  return true;
}
// a quicker footprint test than footprintOK (nine samples, the hills only at the centre)
function fillFootOK(x, z, w, d, rot, roadMin) {
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const [ix, iz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const lx = ix * w / 2, lz = iz * d / 2, px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
    if (roadDist(px, pz) < roadMin || alleyDist(px, pz) < 1.5 || landF(px, pz) < 30 || parkVal(px, pz) > -3 || plazaVal(px, pz) > -2.5) return false;
    if (px < WX0 + 14 || px > WX0 + WXS - 14 || pz < WZ0 + 14 || pz > WZ0 + WZS - 14) return false;
  }
  return hillH(x, z) < 0.25 && !rectOverlaps(x, z, w + 1.0, d + 1.0, rot);
}
// what a spot suits: near a street or deep in a block, which part of the city
function fillMenu(zone, near, pass) {
  if (pass === 'big') return near
    ? [['parking', 3], ['gas', 1.4], ['park', zone === 'xinyi' || zone === 'east' ? 1.6 : 1], ['court', 0.3]]
    : [['park', 3], ['parking', 2], ['court', 1.2], ['garden', zone === 'shilin' ? 1.6 : 0.5]];
  if (near) return zone === 'xinyi' || zone === 'east'
    ? [['parking', 3], ['walkup', 2], ['gas', 1.1], ['scooter', 1.2], ['park', 0.8]]
    : [['walkup', 4], ['parking', 2.2], ['gas', 0.8], ['scooter', 1.4], ['shrine', zone === 'old' ? 1.2 : 0.5], ['shed', zone === 'shilin' ? 1 : 0.4]];
  return zone === 'xinyi' || zone === 'east'
    ? [['parking', 2], ['park', 2], ['court', 1], ['walkup', 2]]
    : [['walkup', 4], ['parking', 1.8], ['park', 2.4], ['court', 1.1], ['shed', zone === 'shilin' || zone === 'old' ? 1.6 : 0.8], ['garden', zone === 'shilin' ? 1.4 : 0.5], ['shrine', zone === 'old' ? 1 : 0.4], ['scooter', 0.6]];
}
function fillGaps(pass) {
  const t0 = performance.now();
  if (!FILL.occ) occInit();
  const big = pass === 'big', step = big ? 11 : 6;
  const C = 40, NX = Math.ceil(WXS / C), NZ = Math.ceil(WZS / C), near = new Uint8Array(NX * NZ);
  for (const e of edges) for (const [px, pz] of e.pts) {
    const ci = Math.floor((px - WX0) / C), cj = Math.floor((pz - WZ0) / C);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < NX && j < NZ) near[j * NX + i] = 1;
    }
  }
  const cand = [];
  for (let gz = WZ0 + 20; gz < WZ0 + WZS - 20; gz += step) for (let gx = WX0 + 20; gx < WX0 + WXS - 20; gx += step) {
    if (!near[Math.floor((gz - WZ0) / C) * NX + Math.floor((gx - WX0) / C)]) continue;
    if (!groundOK(gx, gz, 5.2, 1.5) || blockedAt(gx, gz, 2.2)) continue;
    cand.push([gx + rand(-1.5, 1.5), gz + rand(-1.5, 1.5)]);
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  const ldm = Object.values(LANDMARKS);
  for (const [x, z] of cand) {
    if (blockedAt(x, z, 2.2) || FILL.occ[Math.floor((z - WZ0) / FILL.C) * FILL.NX + Math.floor((x - WX0) / FILL.C)]) continue;
    if (ldm.some((v) => Math.abs(v[0] - x) < 26 && Math.abs(v[1] - z) < 26)) continue;
    const rd = roadDist(x, z), nearSt = rd < 22;
    const gxr = roadDist(x + 1, z) - roadDist(x - 1, z), gzr = roadDist(x, z + 1) - roadDist(x, z - 1);
    const rot = Math.atan2(-gxr, -gzr);
    const pr = nearSt ? nearestOnRoads(x, z) : null;
    const main = pr && pr.e.hw >= 7 && !pr.e.flags.alley;
    if (big && rng() > 0.4) continue; // a few open spaces per block, not one on every free spot
    let menu = fillMenu(zoneOf(x, z), nearSt, pass).filter(([k]) => (!FILLERS[k].main || main) && fillRoom(k, x, z));
    // the narrow fallbacks, for gaps too small for anything else: a 透天厝 (on a street mostly), or a scrap of green
    const tail = big ? [] : [['row', 1], ['green', 1]];
    for (let tries = 0; tries < 5 && (menu.length || tail.length); tries++) {
      const pickK = tries < 3 && menu.length ? gwpickR(menu, (m) => m[1]) : tail.shift();
      if (!pickK) break;
      const F = FILLERS[pickK[0]];
      menu = menu.filter((m) => m !== pickK);
      let done = false;
      for (const [w0, d0] of F.sizes) {
        const w = w0 * rand(0.9, 1.05), d = d0 * rand(0.9, 1.05);
        // slide the footprint back from the street so its front sits at the building line
        let cx = x, cz = z;
        if (nearSt) { const back = Math.max(0, (pr.e.hw + F.road + d / 2) - rd); cx = x - Math.sin(rot) * back; cz = z - Math.cos(rot) * back; }
        if (!occFree(cx, cz, w + 1, d + 1, rot) || !fillFootOK(cx, cz, w, d, rot, F.road)) continue;
        const tb = performance.now();
        F.f(cx, cz, rot, w, d);
        FILL.tb = (FILL.tb || 0) + performance.now() - tb;
        if (F.gap || F.max < 1e9) (FILL_AT[pickK[0]] || (FILL_AT[pickK[0]] = [])).push([cx, cz]);
        occMark(cx, cz, w + 0.6, d + 0.6, rot);
        fillCount(pickK[0]);
        done = true;
        break;
      }
      if (done) break;
    }
  }
  FILL.cand = (FILL.cand || 0) + cand.length; FILL.ms = (FILL.ms || 0) + Math.round(performance.now() - t0);
}
// weighted pick with the build's seeded random (the city must come out the same every visit)
function gwpickR(arr, wf) {
  let t = 0;
  for (const a of arr) t += wf(a);
  let r = rng() * t;
  for (const a of arr) { r -= wf(a); if (r <= 0) return a; }
  return arr[arr.length - 1];
}

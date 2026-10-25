// ===================== vegetation & rock props =====================
function blobGeo(r, detail, noise, seed, squashY = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (vnoise(x * 1.9 / r + seed, z * 1.9 / r + y * 1.4 / r - seed) - 0.5) * 2 * noise;
    p.setXYZ(i, x * k, y * k * squashY, z * k);
  }
  return g;
}
function makeFluffyTree(variant) {
  const gb = new GB();
  const trunk = 0x8a5a3a;
  let [g, m] = cylBetween(0, 0, 0, 0.15, 3.8, 0.1, 0.55, 0.32, 7);
  gb.add(g, trunk, m);
  [g, m] = cylBetween(0.05, 2.4, 0, 1.3, 3.7, 0.45, 0.22, 0.13, 6);
  gb.add(g, trunk, m);
  const greens = variant === 0 ? [0x6cbf45, 0x7acb4e] : [0x55a83c, 0x63b544];
  const blobs = variant === 0
    ? [[0, 5.4, 0, 2.8], [1.8, 4.5, 0.7, 2.0], [-1.6, 4.6, -0.8, 2.1], [-0.3, 6.7, 0.4, 1.9], [0.2, 4.4, -1.8, 1.7]]
    : [[0, 5.1, 0, 3.0], [1.6, 4.1, -1.0, 1.9], [-1.5, 4.4, 1.1, 2.0], [0.6, 6.5, 0.3, 1.9]];
  blobs.forEach(([x, y, z, r], i) => {
    gb.add(blobGeo(r, 1, 0.24, i * 3.1 + variant * 7), greens[i % 2], M(x, y, z), { grad: [0.7, 1.12], gradY: [2.6, 8.4], center: [x, y, z] });
  });
  return gb.build();
}
function makePine(variant) {
  const gb = new GB();
  const [g, m] = cylBetween(0, 0, 0, 0, 2.2, 0, 0.42, 0.3, 6);
  gb.add(g, 0x7a4f32, m);
  const tiers = variant === 0 ? [[1.3, 2.9, 3.4], [3.0, 2.35, 3.0], [4.5, 1.8, 2.6], [5.9, 1.15, 2.2]] : [[1.2, 2.5, 3.0], [2.8, 2.0, 2.8], [4.3, 1.45, 2.4], [5.6, 0.9, 2.0]];
  const cols = variant === 0 ? [0x3d8746, 0x45944b, 0x51a252, 0x5cae58] : [0x357a40, 0x3d8746, 0x47924b, 0x52a052];
  tiers.forEach(([y, r, h], i) => {
    const cg = new THREE.ConeGeometry(r, h, 10, 1);
    const p = cg.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const py = p.getY(k);
      if (py < -h / 2 + 0.01) {
        const x = p.getX(k), z = p.getZ(k);
        if (Math.hypot(x, z) > 0.01) {
          const a = Math.atan2(z, x);
          const spike = ((Math.round(a / (TAU / 10)) % 2) + 2) % 2 === 0;
          const sp = spike ? 1.14 : 0.76;
          p.setXYZ(k, x * sp, py - (spike ? 0.38 : 0), z * sp);
        }
      }
    }
    cg.computeVertexNormals();
    gb.add(cg, cols[i], M(0, y + h / 2, 0, 0, i * 0.37), { grad: [0.8, 1.08] });
  });
  return gb.build();
}
function frondGeo(L, W) {
  const n = 9, pos = [];
  const C = (t) => [L * t, 0.9 * t - 2.3 * t * t, 0];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
    const c0 = C(t0), c1 = C(t1);
    const env = Math.sin(Math.PI * Math.min(1, tm * 1.05 + 0.06)) * W;
    for (const side of [1, -1]) {
      const tip = C(Math.min(1, tm + 0.7 / n));
      tip[1] -= env * 0.32; tip[2] = side * env;
      if (side > 0) pos.push(...c0, ...c1, ...tip); else pos.push(...c1, ...c0, ...tip);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function makePalm(variant) {
  const gb = new GB();
  const H = 7.4 + variant * 1.1, lean = 1.6 + variant * 0.9;
  const seg = 6;
  let prev = [0, 0, 0];
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const cur = [lean * t * t, H * t, 0];
    const [g, m] = cylBetween(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2], lerp(0.52, 0.3, (i - 1) / seg), lerp(0.52, 0.3, t), 7);
    gb.add(g, i % 2 ? 0x9a6a42 : 0x7f5434, m);
    prev = cur;
  }
  const top = prev;
  for (let k = 0; k < 3; k++) {
    const a = (k * TAU) / 3;
    gb.add(new THREE.SphereGeometry(0.36, 7, 5), 0x6a4a2b, M(top[0] + Math.cos(a) * 0.45, top[1] - 0.35, top[2] + Math.sin(a) * 0.45));
  }
  const fr = frondGeo(5.4, 1.2);
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8 + (k % 2) * 0.22;
    gb.add(fr, k % 2 ? 0x6fc24b : 0x5cb143, M(top[0], top[1], top[2], 0, a, k % 2 ? 0.08 : -0.1), { grad: [0.85, 1.1] });
  }
  return gb.build();
}
function makeBush(kind) {
  const gb = new GB();
  const c = kind === 9 ? [0xffffff, 0xeaeaea] : kind === 1 ? [0x4f9d3a, 0x5aa841] : kind === 2 ? [0xd3a640, 0xe0b850] : [0x63b445, 0x72c04d];
  [[0, 0.95, 0, 1.4], [1.1, 0.7, 0.3, 1.05]].forEach(([x, y, z, r], i) => {
    gb.add(blobGeo(r, 1, 0.22, i * 5.3 + kind), c[i % 2], M(x, y, z), { grad: [0.72, 1.1], gradY: [0, 2.2], center: [x, y, z] });
  });
  if (kind === 3) {
    for (let k = 0; k < 9; k++) {
      const a = rand(0, TAU), r = rand(0.6, 1.3);
      gb.add(new THREE.IcosahedronGeometry(0.2, 0), k % 2 ? 0xf6a3c0 : 0xfff3d6, M(Math.cos(a) * r, rand(1.2, 2.1), Math.sin(a) * r));
    }
  }
  return gb.build();
}
function makeRock(seed) {
  const gb = new GB();
  gb.add(blobGeo(1.25, 1, 0.3, seed, 0.62), 0xaab0b8, M(0, 0.28, 0), { flat: true, grad: [0.8, 1.12], jitter: 0.035 });
  return gb.build();
}
function makeTuft() {
  const pos = [], col = [], nor = [], out = [];
  const c0 = new THREE.Color(0x4f9a36), c1 = new THREE.Color(0x9ad85e);
  for (let k = 0; k < 5; k++) {
    const a = (k * TAU) / 5 + rand(-0.3, 0.3), h = rand(0.55, 1.05), lean = rand(0.15, 0.4);
    const dx = Math.cos(a), dz = Math.sin(a), w = 0.13;
    // both windings with upward normals so blades never light as back faces
    pos.push(-dz * w, 0, dx * w, dz * w, 0, -dx * w, dx * lean, h, dz * lean);
    pos.push(dz * w, 0, -dx * w, -dz * w, 0, dx * w, dx * lean, h, dz * lean);
    for (let q = 0; q < 2; q++) col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
    for (let q = 0; q < 6; q++) { nor.push(0, 1, 0); out.push(0, 0, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aOut', new THREE.Float32BufferAttribute(out, 3));
  return g;
}
function makeLily() {
  const gb = new GB();
  const g = new THREE.CylinderGeometry(1, 1, 0.08, 12, 1, false, 0.5, TAU - 0.9);
  gb.add(g, 0x5fb848, M(0, 0, 0));
  return gb.build();
}

// all vegetation instances are collected here (landmark builders push into it too)
const VEG = { fluffy: [], pine: [], palm: [], bush: [], rock: [], tuft: [], lily: [] };
const TREE_TINT = [0xffffff, 0xf0f7e6, 0xdcead0, 0xcfe2c4];
function addTree(x, z, s, opt = {}) {
  const y = opt.y !== undefined ? opt.y : baseHeight(x, z);
  VEG.fluffy.push({ x, y, z, ry: rand(0, TAU), s, color: pick(TREE_TINT) });
  if (opt.collide !== false) addCollider({ t: 0, x, z, r: 0.6 * s + 0.1 });
}
function nearNode(e, s, pad) {
  return s < pad || s > e.len - pad;
}
function scatterCity() {
  // street trees on sidewalks, median trees on boulevards
  for (const e of edges) {
    if (e.flags.ring || e.flags.alley) continue;
    const pad = e.hw + 10;
    if (e.flags.campus) {
      for (let s = 8; s < e.len - 4; s += 9) {
        const [px, pz, tx, tz] = edgePoint(e, s);
        for (const sd of [1, -1]) {
          const x = px - tz * sd * (e.hw + 2.2), z = pz + tx * sd * (e.hw + 2.2);
          if (blockedAt(x, z, 1)) continue;
          VEG.palm.push({ x, y: 0, z, ry: rand(0, TAU), s: rand(1.0, 1.15), color: 0xffffff });
          addCollider({ t: 0, x, z, r: 0.6 });
        }
      }
      continue;
    }
    // spaced out like real Taipei street trees: one every 25-30 units, gaps, none at alley mouths
    const step = e.flags.blvd ? 22 : 28;
    let k = 0;
    for (let s = pad; s < e.len - pad; s += step + rand(-3, 3), k++) {
      const [px, pz, tx, tz] = edgePoint(e, s);
      for (const sd of [1, -1]) {
        if (rng() < 0.3) continue;
        const x = px - tz * sd * (e.hw + 2.3), z = pz + tx * sd * (e.hw + 2.3);
        if (landF(x, z) < 8 || plazaVal(x, z) > -1 || roadDist(x, z) < 1.4 || hillH(x, z) > 0.3 || alleyDist(x, z) < 3) continue;
        if (blockedAt(x, z, 1.4)) continue;
        addTree(x, z, rand(0.72, 0.9));
      }
      if (e.flags.blvd && k % 2 === 0 && !nearNode(e, s, pad + 2)) addTree(px, pz, rand(0.62, 0.78));
    }
  }
  // parks
  for (const pk of PARKS) {
    if (pk.airport || pk.school || pk.farm) continue;
    for (let z = pk.z0 + 3; z < pk.z1 - 3; z += 6.5) for (let x = pk.x0 + 3; x < pk.x1 - 3; x += 6.5) {
      const px = x + rand(-2.6, 2.6), pz = z + rand(-2.6, 2.6);
      if (parkVal(px, pz) < 2.5 || roadDist(px, pz) < 4 || plazaVal(px, pz) > -1) continue;
      const r = rng();
      if (r < pk.trees) { if (!blockedAt(px, pz, 1.4)) addTree(px, pz, rand(0.85, 1.3)); }
      else if (r < pk.trees + 0.1) VEG.bush.push({ x: px, y: 0, z: pz, ry: rand(0, TAU), s: rand(0.8, 1.2), color: pick([0x63b445, 0x4f9d3a, 0xd3a640, 0x6cbc4a]) });
    }
  }
  // hills: dense forest, riverside: a few trees and rocks, lots: occasional trees
  for (let z = WZ0 + 6; z < WZ0 + WZS - 6; z += 7) for (let x = WX0 + 6; x < WX0 + WXS - 6; x += 7) {
    const px = x + rand(-3, 3), pz = z + rand(-3, 3);
    const hh = hillH(px, pz);
    if (hh > 2.5) {
      // the big mountains north of the river: a little sparser, and mostly the cheaper pines
      const north = pz < -540, r = rng();
      if (north && r > 0.72) continue;
      if (r < (north ? 0.6 : 0.55)) VEG.pine.push({ x: px, y: hh - 0.3, z: pz, ry: rand(0, TAU), s: rand(0.9, 1.4) * (north ? 1.15 : 1), sy: rand(0.9, 1.2), color: pick([0xffffff, 0xe2eedc, 0xd0e2c8]) });
      else if (r < (north ? 0.68 : 0.8)) addTree(px, pz, rand(0.9, 1.3) * (north ? 1.2 : 1), { y: hh - 0.3, collide: false });
      continue;
    }
    const F = landF(px, pz);
    if (F < -1) {
      if (F > -8 && rng() < 0.012) VEG.lily.push({ x: px, y: WATER_Y + 0.03, z: pz, ry: rand(0, TAU), s: rand(0.7, 1.3) });
      continue;
    }
    if (roadDist(px, pz) < 5) continue;
    if (F < 26) {
      const r = rng();
      if (F > 6 && r < 0.1) { if (!blockedAt(px, pz, 1.4)) addTree(px, pz, rand(0.9, 1.25)); }
      else if (r < 0.15) VEG.bush.push({ x: px, y: 0, z: pz, ry: rand(0, TAU), s: rand(0.7, 1.1), color: pick([0x63b445, 0x4f9d3a]) });
      else if (F < 7 && r < 0.2) VEG.rock.push({ x: px, y: terrainH(F), z: pz, ry: rand(0, TAU), s: rand(0.6, 1.4), sy: rand(0.7, 1.1), color: 0xffffff });
      continue;
    }
    if (parkVal(px, pz) < -3 && plazaVal(px, pz) < -3 && alleyDist(px, pz) > 4 && rng() < 0.035 && !blockedAt(px, pz, 2.2)) addTree(px, pz, rand(0.8, 1.15));
  }
  // grass tufts in parks, riverside and hills
  for (let z = WZ0 + 4; z < WZ0 + WZS - 4; z += 3.6) for (let x = WX0 + 4; x < WX0 + WXS - 4; x += 3.6) {
    if (rng() > 0.2) continue;
    const px = x + rand(-1.6, 1.6), pz = z + rand(-1.6, 1.6);
    const F = landF(px, pz);
    if (F < 3 || roadDist(px, pz) < 5.2) continue;
    const grassy = parkVal(px, pz) > 1 || F < 24 || hillH(px, pz) > 0.8;
    if (!grassy || plazaVal(px, pz) > -1) continue;
    VEG.tuft.push({ x: px, y: baseHeight(px, pz), z: pz, ry: rand(0, TAU), s: rand(0.8, 1.4) });
  }
}

function buildPropMeshes(scene) {
  const G = {
    fluffy: makeFluffyTree(0), pine: makePine(0), palm: makePalm(0), bush: makeBush(9),
    rock: makeRock(3.3), tuft: makeTuft(), lily: makeLily(),
  };
  addInstanced(scene, G.fluffy, MAT.toon, VEG.fluffy, { outline: MAT.olTree });
  addInstanced(scene, G.pine, MAT.toon, VEG.pine, { outline: MAT.olTree });
  addInstanced(scene, G.palm, MAT.double, VEG.palm, {});
  SMALLVEG.list = [
    ...addInstanced(scene, G.bush, MAT.toon, VEG.bush, { outline: MAT.olTree, cast: false }),
    ...addInstanced(scene, G.rock, MAT.toon, VEG.rock, { outline: MAT.olRock, cast: false }),
    ...addInstanced(scene, G.tuft, MAT.toon, VEG.tuft, { cast: false }),
    ...addInstanced(scene, G.lily, MAT.toon, VEG.lily, { cast: false }),
  ].map((m) => ({ m, ol: m.userData.ol || null, x: m.geometry.boundingSphere.center.x, z: m.geometry.boundingSphere.center.z, r: m.geometry.boundingSphere.radius }));
  return G;
}
// Bushes, rocks, grass tufts and lilies are lost in the haze past ~220 units, where only the street-level
// chase views can see them: skip those chunks' draw calls there (the overhead view never sees that far).
const SMALLVEG = { list: [], on: false, n: 0 };
function smallVegCull(on, cx, cz) {
  if (!on && !SMALLVEG.on) return;
  if (on && SMALLVEG.n-- > 0) return;
  SMALLVEG.n = 8; SMALLVEG.on = on;
  for (const v of SMALLVEG.list) {
    const vis = !on || hypot(v.x - cx, v.z - cz) - v.r < 220;
    if (v.m.visible !== vis) { v.m.visible = vis; if (v.ol) v.ol.visible = vis; }
  }
}

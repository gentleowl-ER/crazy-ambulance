// ===================== characters, traffic, pedestrians, knockables =====================
const SKINS = [0xf6d2b4, 0xe9b98f, 0xc98f63, 0xf3c9a5];
const HAIRS = [0x3b2a20, 0x5a3b26, 0x1f1a17, 0x8a5a33, 0x2b2420];
const SHIRTS = [0xd9573b, 0x3aa6b9, 0xf2c14e, 0x7cc4a0, 0xf28fb0, 0x6d8fd6, 0xffffff, 0x4b4f58, 0xb9a3e3];
const PANTS = [0x4d6a9a, 0x5a5f6b, 0x8a6a4a, 0x3f7f6a, 0x2f3540];

function buildCharacterGeo(o) {
  const gb = new GB();
  const skin = o.skin, hair = o.elder ? 0xd9d6d0 : o.hair;
  for (const sx of [-1, 1]) {
    gb.add(new THREE.CylinderGeometry(0.21, 0.23, 0.78, 7), o.pants, M(sx * 0.25, 0.39, 0));
    gb.add(new THREE.SphereGeometry(0.25, 7, 5), 0x4a3a2e, M(sx * 0.25, 0.08, 0.06, 0, 0, 0, 1, 0.6, 1.3));
  }
  gb.add(new THREE.CylinderGeometry(0.56, 0.64, 1.0, 10), o.shirt, M(0, 1.22, 0));
  if (o.preg) gb.add(new THREE.SphereGeometry(0.5, 10, 8), o.shirt, M(0, 1.12, 0.38, 0, 0, 0, 1, 0.95, 0.9));
  gb.add(new THREE.SphereGeometry(0.62, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2), o.shirt, M(0, 1.72, 0, Math.PI, 0, 0, 1, 0.35, 1));
  if (o.cpr) {
    // arms straight out, hands stacked in front of the chest (chest compressions)
    for (const sx of [-1, 1]) { const [g, m] = cylBetween(sx * 0.52, 1.62, 0.12, sx * 0.12, 1.02, 0.98, 0.15, 0.14, 6); gb.add(g, skin, m); }
    gb.add(new THREE.SphereGeometry(0.2, 7, 5), skin, M(0, 1.0, 1.02));
  } else {
    gb.add(new THREE.CylinderGeometry(0.15, 0.15, 0.85, 6), skin, M(0.72, 1.25, 0, 0, 0, 0.22));
    if (!o.wave) gb.add(new THREE.CylinderGeometry(0.15, 0.15, 0.85, 6), skin, M(-0.72, 1.25, 0, 0, 0, -0.22));
  }
  gb.add(new THREE.SphereGeometry(0.58, 12, 9), skin, M(0, 2.18, 0));
  gb.add(new THREE.SphereGeometry(0.61, 12, 9, 0, TAU, 0, 1.45), hair, M(0, 2.22, -0.06, -0.35, 0, 0));
  for (const sx of [-1, 1]) {
    gb.add(new THREE.SphereGeometry(0.075, 6, 5), 0x2a211c, M(sx * 0.2, 2.2, 0.53));
    gb.add(new THREE.SphereGeometry(0.1, 6, 5), 0xf2a0a0, M(sx * 0.34, 2.04, 0.46, 0, 0, 0, 1, 0.6, 0.4));
  }
  if (o.hat === 'helmet') {
    gb.add(new THREE.SphereGeometry(0.68, 12, 8, 0, TAU, 0, Math.PI / 2), o.hatColor, M(0, 2.3, 0));
    gb.add(box(1.0, 0.1, 0.4), 0x3a3f46, M(0, 2.28, 0.55));
  } else if (o.hat === 'bucket') {
    gb.add(new THREE.CylinderGeometry(0.52, 0.62, 0.42, 12), o.hatColor, M(0, 2.72, 0));
    gb.add(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 14), o.hatColor, M(0, 2.52, 0));
  } else if (o.hat === 'cap') {
    gb.add(new THREE.SphereGeometry(0.62, 12, 6, 0, TAU, 0, Math.PI / 2), o.hatColor, M(0, 2.42, 0));
    gb.add(box(0.8, 0.06, 0.55), o.hatColor, M(0, 2.45, 0.6));
  } else if (o.hat === 'straw') {
    gb.add(new THREE.ConeGeometry(1.1, 0.6, 18), 0xdcab5e, M(0, 2.86, 0));
  } else if (o.hat === 'flower') {
    gb.add(new THREE.IcosahedronGeometry(0.2, 0), 0xf6a3c0, M(0.42, 2.6, 0.2));
  }
  return gb.build();
}
function randomLook(extra) {
  return Object.assign({
    skin: gpick(SKINS), hair: gpick(HAIRS), shirt: gpick(SHIRTS), pants: gpick(PANTS),
    hat: gpick(['none', 'none', 'cap', 'bucket', 'flower', 'straw']), hatColor: gpick([0xf2efe6, 0x3aa6b9, 0xe9524a, 0xf2c14e, 0x6d8fd6]),
  }, extra || {});
}
function makeCharacter(scene, look, scale) {
  const geo = buildCharacterGeo(look);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const m = new THREE.Mesh(geo, MAT.toon); m.castShadow = true;
  body.add(m, new THREE.Mesh(geo, MAT.olInk));
  let arm = null;
  if (look.wave) {
    arm = new THREE.Group();
    const am = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 6).translate(0, 0.42, 0), new THREE.MeshToonMaterial({ color: look.skin, gradientMap: gradTex }));
    am.castShadow = true;
    arm.add(am);
    arm.position.set(-0.6, 1.62, 0);
    body.add(arm);
  }
  g.scale.setScalar(scale || 1);
  scene.add(g);
  return { g, body, arm, geo };
}
// lying = on the back, sitting = crouched; applied to the inner body group
function setPose(ch, pose) {
  const b = ch.body;
  b.rotation.set(0, 0, 0); b.position.set(0, 0, 0); b.scale.set(1, 1, 1);
  if (pose === 'lie') { b.rotation.x = -Math.PI / 2; b.position.set(0, 0.62, 1.1); }
  else if (pose === 'sit') { b.scale.set(1, 0.78, 1); b.rotation.x = -0.12; }
  else if (pose === 'kneel') { b.scale.set(1, 0.74, 1); b.rotation.x = 0.55; }
}

// ---------- traffic: cars, Taipei yellow taxis, buses, scooters ----------
// A fixed pool of vehicles is kept around the player: ones that drift far away are moved back
// to roads nearby, so the city always feels busy without simulating thousands of cars.
const traffic = [];
let TRAFFIC_EDGES = [];
function buildVehicleGeo(kind, color) {
  const gb = new GB();
  const dark = 0x34363c, glass = 0x9fd6ec;
  let L = 1.35;
  if (kind === 'car' || kind === 'taxi') {
    gb.add(box(2.3, 0.95, 4.0), color, M(0, 0.95, 0));
    gb.add(box(2.0, 0.85, 2.2), color, M(0, 1.85, -0.2));
    gb.add(box(1.9, 0.62, 0.1), glass, M(0, 1.88, 0.9, -0.2, 0, 0));
    gb.add(box(1.9, 0.6, 0.1), glass, M(0, 1.86, -1.32, 0.2, 0, 0));
    for (const sx of [-1, 1]) gb.add(box(0.08, 0.5, 1.7), glass, M(sx * 1.0, 1.9, -0.2));
    if (kind === 'taxi') { gb.add(box(0.9, 0.35, 0.45), 0xffffff, M(0, 2.45, -0.2)); gb.add(box(2.34, 0.18, 4.02), 0x2b2f35, M(0, 1.1, 0)); }
  } else if (kind === 'van') {
    gb.add(box(2.4, 2.2, 5.2), color, M(0, 1.6, 0));
    gb.add(box(2.2, 0.8, 0.1), glass, M(0, 2.0, 2.62));
    gb.add(box(2.44, 0.4, 3.2), 0xffffff, M(0, 1.8, -0.8));
    L = 1.9;
  } else if (kind === 'garbage') {
    // a Taipei garbage truck: cab, compactor body, rear hopper, and the loudspeaker that plays "Für Elise"
    gb.add(box(2.2, 0.5, 7.6), dark, M(0, 0.78, 0));
    gb.add(box(2.4, 2.1, 1.9), color, M(0, 1.75, 3.05));
    gb.add(box(2.2, 0.85, 0.1), glass, M(0, 2.2, 4.01));
    for (const sx of [-1, 1]) gb.add(box(0.08, 0.66, 1.0), glass, M(sx * 1.21, 2.2, 3.1));
    gb.add(box(2.5, 2.7, 5.0), color, M(0, 2.0, -0.5));
    gb.add(box(2.54, 0.36, 5.02), 0x2f9e6b, M(0, 1.55, -0.5));
    gb.add(box(2.4, 2.3, 1.0), 0xd9a21c, M(0, 1.65, -3.5, -0.12, 0, 0));
    gb.add(box(1.9, 0.5, 0.12), 0x34363c, M(0, 1.2, -4.02));
    const horn = new THREE.CylinderGeometry(0.34, 0.18, 0.6, 8); horn.rotateX(Math.PI / 2);
    gb.add(horn, 0xf4f4f0, M(0, 3.05, 3.4));
    gb.add(box(0.5, 0.25, 0.5), 0x2b2f35, M(0, 2.85, 3.0));
    L = 2.6;
  } else if (kind === 'bus') {
    gb.add(box(2.6, 2.6, 9.6), color, M(0, 1.75, 0));
    gb.add(box(2.66, 0.8, 8.6), glass, M(0, 2.35, -0.2));
    gb.add(box(2.3, 1.0, 0.1), glass, M(0, 2.2, 4.81));
    gb.add(box(2.68, 0.35, 9.62), 0x2f9e6b, M(0, 1.0, 0));
    gb.add(box(2.7, 0.2, 9.7), 0xf4f4f0, M(0, 3.1, 0));
    L = 3.6;
  }
  if (kind !== 'scooter') {
    const wz = kind === 'bus' ? 3.2 : kind === 'garbage' ? 2.6 : kind === 'van' ? 1.8 : 1.35;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10); wg.rotateZ(Math.PI / 2);
      gb.add(wg, dark, M(sx * 1.12, 0.5, sz * wz));
    }
    const fz = kind === 'bus' ? 4.82 : kind === 'garbage' ? 4.03 : kind === 'van' ? 2.62 : 2.02;
    for (const sx of [-1, 1]) gb.add(box(0.4, 0.25, 0.08), 0xfff1bf, M(sx * 0.75, 1.0, fz));
    for (const sx of [-1, 1]) gb.add(box(0.4, 0.25, 0.08), 0xd83a33, M(sx * 0.8, 1.05, -fz));
  } else {
    // scooter with its rider (helmet on)
    gb.add(box(0.75, 0.55, 1.9), color, M(0, 0.75, 0));
    gb.add(box(0.7, 1.0, 0.35), color, M(0, 1.15, 0.8));
    gb.add(box(0.62, 0.22, 0.9), 0x2b2f35, M(0, 1.12, -0.35));
    for (const z of [-0.75, 0.82]) { const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10); wg.rotateZ(Math.PI / 2); gb.add(wg, dark, M(0, 0.34, z)); }
    gb.add(box(0.9, 0.08, 0.08), 0x3a3f46, M(0, 1.7, 0.75));
    const look = randomLook({ hat: 'helmet', hatColor: gpick([0xffffff, 0xe9524a, 0x3a7fd5, 0xf2c14e, 0x2b2f35]) });
    gb.add(new THREE.CylinderGeometry(0.42, 0.5, 0.9, 8), look.shirt, M(0, 1.75, -0.25));
    gb.add(new THREE.SphereGeometry(0.42, 10, 8), look.skin, M(0, 2.45, -0.15));
    gb.add(new THREE.SphereGeometry(0.5, 10, 6, 0, TAU, 0, Math.PI * 0.62), look.hatColor, M(0, 2.5, -0.17));
    for (const sx of [-1, 1]) gb.add(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), look.skin, M(sx * 0.34, 1.9, 0.25, 1.1, 0, 0));
    for (const sx of [-1, 1]) gb.add(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), look.pants, M(sx * 0.2, 1.12, 0.2, 1.2, 0, 0));
    L = 0.6;
  }
  return { geo: gb.build(), L };
}
const VEH_MIX = [
  ['taxi', 0xf2c230, 15], ['car', 0xf4f4f2, 7], ['car', 0xb8bec4, 6], ['car', 0xd9473d, 3], ['car', 0x3a5f8f, 4], ['car', 0x8fd3b5, 2], ['car', 0x2f3540, 3],
  ['bus', 0xf4f4f0, 4], ['van', 0xffffff, 3], ['garbage', 0xf2c230, 1], ['scooter', 0xe9524a, 4], ['scooter', 0xf4f4f2, 5], ['scooter', 0x3a7fd5, 4], ['scooter', 0x2f3540, 4], ['scooter', 0x8fd3b5, 3], ['scooter', 0xf2c14e, 3],
];
function spawnTraffic(scene) {
  TRAFFIC_EDGES = edges.filter((e) => !e.flags.campus && !e.flags.alley && e.len > 30);
  for (const [kind, color, n] of VEH_MIX) for (let k = 0; k < n; k++) {
    const { geo, L } = buildVehicleGeo(kind, color);
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, MAT.toon); m.castShadow = true;
    g.add(m, new THREE.Mesh(geo, MAT.olInk));
    scene.add(g);
    const scoot = kind === 'scooter';
    traffic.push({
      e: TRAFFIC_EDGES[0], dir: 1, s: 10, kind, scoot,
      base: kind === 'bus' ? grand(8, 10) : kind === 'garbage' ? grand(5.5, 7) : kind === 'taxi' ? grand(12, 15) : scoot ? grand(11, 14) : grand(10, 13),
      cur: 6, lane: 3, g, len: L, rad: scoot ? 0.8 : kind === 'bus' ? 1.45 : kind === 'garbage' ? 1.4 : 1.3, stubborn: 0, stopT: 0, goT: grand(6, 12),
      x: 0, z: 0, y: 0, h: 0, stun: 0, kvx: 0, kvz: 0, spin: 0, nearT: 0, stuckT: 0, init: true,
    });
  }
  // the jam pool (08e_jam.js): parked until a jam near the ambulance needs filling
  for (const [kind, color, n] of JAM_MIX) for (let k = 0; k < n; k++) {
    const { geo, L } = buildVehicleGeo(kind, color);
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, MAT.toon); m.castShadow = true;
    g.add(m, new THREE.Mesh(geo, MAT.olInk));
    scene.add(g);
    const scoot = kind === 'scooter';
    const v = {
      e: TRAFFIC_EDGES[0], dir: 1, s: 10, kind, scoot, jamOnly: true,
      base: kind === 'bus' ? grand(8, 10) : kind === 'taxi' ? grand(12, 15) : scoot ? grand(11, 14) : grand(10, 13),
      cur: 1, lane: 3, g, len: L, rad: scoot ? 0.8 : kind === 'bus' ? 1.45 : 1.3, stubborn: 0, stopT: 0, goT: 9,
      x: 0, z: 0, y: 0, h: 0, stun: 0, kvx: 0, kvz: 0, spin: 0, nearT: 0, stuckT: 0, init: false,
    };
    traffic.push(v);
    parkVehicle(v);
  }
}
function laneOf(v) { return v.e.hw * (v.scoot ? 0.8 : 0.5); }
function snapVehicle(v) {
  const [px, pz, tx, tz] = edgePoint(v.e, v.s);
  const dxr = tx * v.dir, dzr = tz * v.dir;
  v.lane = laneOf(v);
  v.x = px - dzr * v.lane; v.z = pz + dxr * v.lane; v.h = Math.atan2(dxr, dzr);
  v.y = groundHeight(v.x, v.z);
}
// chase cameras look far down the street: new cars and people appear where the camera isn't looking, or deep in the haze
let VIEWCONE = null; // { x, z, dx, dz, near }
function inView(x, z) {
  const V = VIEWCONE;
  if (!V) return false;
  const ox = x - V.x, oz = z - V.z, d = Math.hypot(ox, oz);
  return d < V.near && ox * V.dx + oz * V.dz > d * 0.5;
}
// move one vehicle to a free spot on a road r0..r1 away from (fx, fz)
function placeVehicle(v, fx, fz, r0, r1) {
  for (let tries = 0; tries < (VIEWCONE ? 30 : 18); tries++) {
    const e = gpick(TRAFFIC_EDGES);
    if (e.len < 30) continue;
    const s = grand(12, e.len - 12);
    const [px, pz] = edgePoint(e, s);
    const d = hypot(px - fx, pz - fz);
    if (d < r0 || d > r1 || inView(px, pz)) continue;
    if (traffic.some((o) => o !== v && Math.abs(o.x - px) < 14 && Math.abs(o.z - pz) < 14)) continue;
    v.e = e; v.s = s; v.dir = Math.random() < 0.5 ? 1 : -1;
    v.cur = v.base * 0.7; v.stun = 0; v.stuckT = 0; v.init = false; v.stubborn = 0;
    snapVehicle(v);
    return true;
  }
  return false;
}
function populateTraffic(fx, fz, r1) {
  const vc = VIEWCONE; VIEWCONE = null; // a fresh start fills the streets everywhere, in view or not
  for (const v of traffic) { v.x = 1e5; v.z = 1e5; }
  for (const v of traffic) if (!v.jamOnly) placeVehicle(v, fx, fz, 22, r1);
  for (const v of traffic) if (v.jamOnly) placeJamVehicle(v, fx, fz, 18, r1);
  VIEWCONE = vc;
}
let recycleI = 0;
function recycleTraffic(fx, fz, keep, r0, r1) {
  for (let k = 0; k < 3; k++) {
    recycleI = (recycleI + 1) % traffic.length;
    const v = traffic[recycleI];
    if (v.jamOnly) {
      // jam cars stay on jammed streets; a parked one comes back when a jam is near
      if (!JAM.list.length) { if (!v.off) parkVehicle(v); continue; }
      const dj = hypot(v.x - fx, v.z - fz);
      if (v.off || dj > keep || ((!v.e.jam || v.stuckT > 30) && dj > 70)) placeJamVehicle(v, fx, fz, 72, r1);
      continue;
    }
    const d = hypot(v.x - fx, v.z - fz);
    if (d > keep || (v.stuckT > 22 && d > 80)) placeVehicle(v, fx, fz, r0, r1);
  }
}
function nextEdge(v, node) {
  let opts = (nodeEdges[node] || []).filter((o) => o.e !== v.e && !o.e.flags.campus && !o.e.flags.alley);
  // keep out of closed streets
  const open = opts.filter((o) => !(o.e.rev && (o.e.rev.T.block || o.e.rev.type === 'parade')));
  if (open.length) opts = open;
  const o = opts.length ? gpick(opts) : (nodeEdges[node] || []).find((q) => q.e === v.e);
  v.e = o.e;
  if (o.dir === 1) { v.dir = 1; v.s = 0; } else { v.dir = -1; v.s = o.e.len; }
}
// ambs: ambulances on the road, each { x, z, h, siren }
// signal pre-emption: the junction a sirened ambulance is driving into, and the street it comes from.
// Cross traffic there is held; traffic on the ambulance's own street may go, so a queue in front of it clears.
const PREEMPT = new Map();
function sirenPreempt(ambs) {
  PREEMPT.clear();
  for (const a of ambs) {
    if (!a.siren) continue;
    const pr = nearestOnRoads(a.x, a.z);
    if (!pr || pr.d > pr.e.hw + 6) continue;
    const q = edgePoint(pr.e, pr.s);
    const fwd = Math.sin(a.h || 0) * q[2] + Math.cos(a.h || 0) * q[3];
    const node = fwd >= 0 ? pr.e.b : pr.e.a;
    if ((fwd >= 0 ? pr.e.len - pr.s : pr.s) < 90 * (a.player ? DRV.siren : 1)) PREEMPT.set(node, pr.e.idx);
  }
}
function sirenNear(ambs, x, z, r) {
  for (const a of ambs) if (a.siren && Math.abs(a.x - x) < r && Math.abs(a.z - z) < r && hypot(a.x - x, a.z - z) < r) return true;
  return false;
}
function trafficStep(dt, ambs, fx, fz, keep, r0, r1) {
  sigClock += dt;
  updateSignalLamps();
  sirenPreempt(ambs);
  for (const v of traffic) {
    if (v.off) continue;
    v.nearT = Math.max(0, v.nearT - dt);
    if (v.stun > 0) {
      v.stun -= dt;
      v.x += v.kvx * dt; v.z += v.kvz * dt;
      v.kvx *= 1 - 2.6 * dt; v.kvz *= 1 - 2.6 * dt;
      v.h += v.spin * dt; v.spin *= 1 - 2.2 * dt;
      v.y = groundHeight(v.x, v.z);
      if (v.stun <= 0) {
        let best = 0, bd = 1e9;
        for (let k = 0; k < v.e.pts.length; k++) { const d = hypot(v.e.pts[k][0] - v.x, v.e.pts[k][1] - v.z); if (d < bd) { bd = d; best = v.e.cum[k]; } }
        v.s = best; v.cur = 2;
      }
      continue;
    }
    const fwx = Math.sin(v.h), fwz = Math.cos(v.h);
    let target = Math.min(v.base * WX.cur.traffic, jamLimit(v));
    let laneT = laneOf(v);
    // in a jam there is little room to pull over: cars squeeze aside only part of the way, and slowly
    const jj = jamAt(v), kerb = v.e.hw * lerp(0.9, 0.68, jj);
    v.yield = false;
    let blocked = false;
    for (const a of ambs) {
      const dx = a.x - v.x, dz = a.z - v.z, sr = a.player ? DRV.siren : 1;
      if (dx > 60 * sr || dx < -60 * sr || dz > 60 * sr || dz < -60 * sr) continue;
      const aheadA = dx * fwx + dz * fwz, latA = Math.abs(-dx * fwz + dz * fwx);
      // never drive into an ambulance; one without its siren on gets honked at for cutting in or blocking the lane
      if (aheadA > 0 && aheadA < 12 && latA < 3.4) {
        target = 0;
        if (a.player && !a.siren) {
          blocked = true;
          if (v.cur > 6 && aheadA < 9) hornAt(v, 'cut');
          else if ((v.blockT = (v.blockT || 0) + dt) > 2.6) { v.blockT = 0; hornAt(v, 'block'); }
        }
      }
      // siren: cars near it pull over to the kerb and slow right down (all but the odd stubborn one)
      if (a.siren && !(v.stubborn > 0) && dx * dx + dz * dz < 2500 * sr * sr && latA < 10) { laneT = kerb; target = Math.min(target, aheadA < 0 ? 3 : 1); v.yield = true; }
    }
    // shouted at through the loudspeaker: pull over for a few seconds
    if (v.scold > 0) { v.scold -= dt; laneT = v.e.hw * 0.9; target = Math.min(target, 2); v.yield = true; }
    // the garbage truck stops every block or so while people bring out their bags
    if (v.kind === 'garbage') {
      if (v.stopT > 0) { v.stopT -= dt; target = 0; }
      else if ((v.goT -= dt) <= 0) { v.stopT = grand(5, 8); v.goT = grand(9, 15); }
    }
    if (!blocked) v.blockT = 0;
    // road works, a crash, a closure or a procession on this street
    if (v.e.rev) {
      const RV = v.e.rev;
      target = Math.min(target, revTrafficLimit(RV, v));
      // the lane with the works or the wreck in it squeezes past on the other side of the centre line
      if ((RV.type === 'works' || RV.type === 'crash') && v.dir === RV.side && v.s > RV.s0 - 26 && v.s < RV.s1 + 26) laneT = -v.e.hw * 0.2;
    }
    // traffic signal at the end of this block (and junctions held by the siren)
    const node = v.dir === 1 ? v.e.b : v.e.a;
    const sig = SIGNALS.get(node);
    v.red = false;
    if (sig) {
      const dEnd = v.dir === 1 ? v.e.len - v.s : v.s;
      const room = dEnd - (sig.hw + (v.scoot ? STOP_SCOOT : STOP_CAR)) - v.len; // front bumper to the stop line (scooters go to the front box)
      if (room > -1.5) {
        const ph = sigPhase(sig, sig.groups.get(v.e.idx) || 0);
        let stop = ph === 'R' || (ph === 'Y' && room > v.cur * 0.8);
        if (sirenNear(ambs, sig.x, sig.z, 66)) stop = PREEMPT.get(node) !== v.e.idx;
        if (stop) { target = Math.min(target, room < 0.35 ? 0 : Math.sqrt(12 * Math.max(0, room - 0.3))); v.red = true; }
      }
    }
    // keep a safe gap to whatever is ahead in our lane (works across junctions too)
    for (const o of traffic) {
      if (o === v) continue;
      const ox = o.x - v.x, oz = o.z - v.z;
      if (ox > 22 || ox < -22 || oz > 22 || oz < -22) continue;
      const ah = ox * fwx + oz * fwz;
      if (ah <= 0 || ah > 22) continue;
      if (Math.abs(-ox * fwz + oz * fwx) > (v.scoot || o.scoot ? 1.5 : 2.4)) continue;
      if (Math.sin(o.h) * fwx + Math.cos(o.h) * fwz < -0.5) continue; // oncoming lane
      target = Math.min(target, Math.max(0, (ah - v.len - o.len - 1.8) * 1.2));
    }
    // people on the zebra crossing in front
    for (const p of peds) {
      if (p.state !== 'cross' && p.state !== 'hop') continue;
      const ox = p.x - v.x, oz = p.z - v.z;
      const ah = ox * fwx + oz * fwz;
      if (ah <= 0 || ah > 15 || Math.abs(-ox * fwz + oz * fwx) > 2.8) continue;
      target = Math.min(target, Math.max(0, (ah - v.len - 2.2) * 1.2));
    }
    if (target < v.cur) v.cur = Math.max(target, v.cur - 16 * dt); else v.cur = Math.min(target, v.cur + 4.5 * dt);
    v.stuckT = v.cur < 0.3 && !v.red && !v.yield ? v.stuckT + dt : 0;
    v.lane = damp(v.lane, laneT, jj > 0 ? 1.4 : 3, dt);
    v.s += v.cur * dt * v.dir;
    if (v.s > v.e.len) nextEdge(v, v.e.b);
    else if (v.s < 0) nextEdge(v, v.e.a);
    const [px, pz, tx, tz] = edgePoint(v.e, v.s);
    const dxr = tx * v.dir, dzr = tz * v.dir;
    const txp = px - dzr * v.lane, tzp = pz + dxr * v.lane;
    if (v.init) { v.x = txp; v.z = tzp; v.h = Math.atan2(dxr, dzr); v.init = false; }
    v.x = damp(v.x, txp, 9, dt); v.z = damp(v.z, tzp, 9, dt);
    v.h = dampAngle(v.h, Math.atan2(dxr, dzr), 7, dt);
    v.y = damp(v.y, groundHeight(v.x, v.z), 14, dt);
    // nose up and down with the bridge ramps
    const fxh = Math.sin(v.h) * 1.8, fzh = Math.cos(v.h) * 1.8;
    v.p = damp(v.p || 0, -Math.atan((groundHeight(v.x + fxh, v.z + fzh) - groundHeight(v.x - fxh, v.z - fzh)) / 3.6), 10, dt);
  }
  recycleTraffic(fx, fz, keep, r0, r1);
}
function trafficRender() {
  for (const v of traffic) { v.g.position.set(v.x, v.y, v.z); v.g.rotation.order = 'YXZ'; v.g.rotation.y = v.h; v.g.rotation.x = v.p || 0; }
}
function trafficCollide(ev) {
  for (const v of traffic) {
    if (Math.abs(v.x - car.x) > 14 || Math.abs(v.z - car.z) > 14) continue;
    const vfx = Math.sin(v.h), vfz = Math.cos(v.h);
    let minD = 1e9;
    for (const co of [1.35, -1.35]) {
      const cx = car.x + Math.sin(car.h) * co, cz = car.z + Math.cos(car.h) * co;
      for (const vo of [v.len, -v.len]) {
        const ox = v.x + vfx * vo, oz = v.z + vfz * vo;
        const dx = cx - ox, dz = cz - oz, d = hypot(dx, dz);
        minD = Math.min(minD, d);
        const rr = 1.38 + v.rad;
        if (d < rr && Math.abs(car.y - v.y) < 2.2) {
          const nx = dx / (d || 1), nz = dz / (d || 1), pen = rr - d;
          car.x += nx * pen * 0.75; car.z += nz * pen * 0.75;
          const vn = car.vx * nx + car.vz * nz;
          if (vn < 0) {
            car.vx -= 1.3 * vn * nx; car.vz -= 1.3 * vn * nz;
            if (v.stun <= 0 && -vn > 3) {
              v.stun = 1.4; v.kvx = -nx * Math.min(22, -vn * 0.9); v.kvz = -nz * Math.min(22, -vn * 0.9); v.spin = grand(-4, 4);
              ev.hitCar(-vn, ox + nx * 1.3, oz + nz * 1.3, v);
            }
          }
        }
      }
    }
    if (minD < 3.6 + v.rad && minD > 1.6 + v.rad && car.speed > 17 && v.nearT <= 0 && v.stun <= 0) { v.nearT = 3; ev.nearMiss(v); }
  }
}

// ---------- pedestrians: walk the sidewalks, turn corners, cross at the zebras on the walk signal ----------
const peds = [];
let PED_EDGES = [];
const PED_OFF = 3.1;    // sidewalk line, measured from the road edge
const KERB_OFF = 1.3;   // where people wait to cross
function sidePt(e, s, sd, off) {
  const [px, pz, tx, tz] = edgePoint(e, s);
  return [px - tz * sd * (e.hw + off), pz + tx * sd * (e.hw + off), tx, tz];
}
function spawnPeds(scene, n) {
  PED_EDGES = edges.filter((e) => !e.flags.ring && !e.flags.alley && e.len > 44);
  for (let i = 0; i < n; i++) {
    const look = randomLook({ kid: Math.random() < 0.18, elder: Math.random() < 0.12 });
    const ch = makeCharacter(scene, look, look.kid ? 0.72 : 0.92);
    peds.push({ e: PED_EDGES[0], s: 20, sd: 1, dir: 1, speed: grand(2.0, 2.9), x: 1e5, z: 1e5, y: 0, h: 0, state: 'walk', t: 0, voice: look.kid ? 'k' : look.elder ? 'e' : Math.random() < 0.5 ? 'f' : 'm',
      gx: 0, gz: 0, after: null, ax: 0, az: 0, bx: 0, bz: 0, u: 0, node: null, hop: 0, hx0: 0, hz0: 0, hx1: 0, hz1: 0, resume: null, ch, ph: grand(0, TAU), s0: look.kid ? 0.72 : 0.92 });
  }
}
function placePed(p, fx, fz, r0, r1) {
  for (let tries = 0; tries < (VIEWCONE ? 26 : 16); tries++) {
    const e = JAM.pedEdges.length && Math.random() < 0.45 ? gpick(JAM.pedEdges) : gpick(PED_EDGES);
    const s = grand(16, e.len - 16);
    const sd = Math.random() < 0.5 ? 1 : -1;
    const [x, z] = sidePt(e, s, sd, PED_OFF);
    const d = hypot(x - fx, z - fz);
    if (d < r0 || d > r1 || inView(x, z)) continue;
    if (landF(x, z) < 6 || plazaVal(x, z) > 6) continue;
    Object.assign(p, { e, s, sd, dir: Math.random() < 0.5 ? 1 : -1, x, z, y: 0, state: 'walk', t: 0, hop: 0, resume: null });
    return true;
  }
  return false;
}
function populatePeds(fx, fz, r1) {
  const vc = VIEWCONE; VIEWCONE = null;
  for (const p of peds) { p.x = 1e5; p.z = 1e5; }
  for (const p of peds) placePed(p, fx, fz, 10, r1);
  VIEWCONE = vc;
}
let pedRecycleI = 0;
function goTo(p, x, z, after) { p.state = 'goto'; p.gx = x; p.gz = z; p.after = after; }
// the stretch from a to b stays off the carriageway
function offRoad(ax, az, bx, bz) {
  for (const t of [0.25, 0.5, 0.75]) if (roadDist(lerp(ax, bx, t), lerp(az, bz, t)) < 0.6) return false;
  return true;
}
function pedAtCorner(p, node) {
  const hwN = nodeMaxHw(node);
  const sig = SIGNALS.get(node);
  const r = Math.random();
  // cross this street at the zebra, then walk back on the other side
  if (sig && r < 0.5) {
    const sz = node === p.e.b ? p.e.len - (hwN + 2.6) : hwN + 2.6;
    if (sz > 6 && sz < p.e.len - 6) {
      const A = sidePt(p.e, sz, p.sd, KERB_OFF), B = sidePt(p.e, sz, -p.sd, KERB_OFF), C = sidePt(p.e, sz, -p.sd, PED_OFF);
      if (landF(C[0], C[1]) > 6) {
        p.node = node; p.ax = A[0]; p.az = A[1]; p.bx = B[0]; p.bz = B[1];
        p.cross = { s: sz, sd: -p.sd, dir: node === p.e.b ? -1 : 1, cx: C[0], cz: C[1] };
        goTo(p, A[0], A[1], { state: 'wait' });
        return;
      }
    }
  }
  // turn the corner onto the next street on this side
  if (r < 0.88) {
    const opts = (nodeEdges[node] || []).filter((o) => o.e !== p.e && !o.e.flags.ring && !o.e.flags.alley && o.e.len > 30);
    const padN = isMouth(node) ? ALLEY_HW + 1.6 : hwN; // across an alley mouth the sidewalk simply carries on
    for (let k = 0; k < opts.length; k++) {
      const o = opts[(k + Math.floor(Math.random() * opts.length)) % opts.length];
      const s2 = o.dir === 1 ? padN + 4.8 : o.e.len - padN - 4.8;
      if (s2 < 8 || s2 > o.e.len - 8) continue;
      let best = null;
      for (const sd2 of [1, -1]) {
        const q = sidePt(o.e, s2, sd2, PED_OFF);
        const d = hypot(q[0] - p.x, q[1] - p.z);
        if (!best || d < best.d) best = { sd2, q, d };
      }
      if (best.d < 2.6 * (hwN + 7) && offRoad(p.x, p.z, best.q[0], best.q[1]) && landF(best.q[0], best.q[1]) > 6) {
        goTo(p, best.q[0], best.q[1], { state: 'walk', e: o.e, s: s2, sd: best.sd2, dir: o.dir === 1 ? 1 : -1 });
        return;
      }
    }
  }
  p.dir = -p.dir; // turn around
}
function pedStep(dt, ev, ambs, fx, fz, keep, r0, r1) {
  for (const p of peds) {
    p.t += dt;
    if (p.state === 'hop') {
      p.hop -= dt;
      const t = clamp(1 - p.hop / 0.5, 0, 1);
      p.x = lerp(p.hx0, p.hx1, t); p.z = lerp(p.hz0, p.hz1, t); p.y = Math.sin(t * Math.PI) * 1.7;
      if (p.hop <= 0) { p.y = 0; p.state = 'back'; }
      continue;
    }
    // jump out of the way of a speeding ambulance
    const dx = p.x - car.x, dz = p.z - car.z, d = hypot(dx, dz);
    if (d < 12) {
      const toward = -(dx * car.vx + dz * car.vz) / (d || 1);
      if ((d < 10 && toward > 5 && car.speed > 6) || d < 3.3) {
        const vx = car.vx / (car.speed || 1), vz = car.vz / (car.speed || 1);
        let sx = -vz, sz = vx;
        if (sx * dx + sz * dz < 0) { sx = -sx; sz = -sz; }
        let tx = p.x + sx * 4.5, tz = p.z + sz * 4.5;
        if (landF(tx, tz) < 2 || blockedAt(tx, tz, 0.7)) { tx = p.x - sx * 4.5; tz = p.z - sz * 4.5; }
        if (landF(tx, tz) < 2 || blockedAt(tx, tz, 0.7)) { tx = p.x + (dx / (d || 1)) * 4; tz = p.z + (dz / (d || 1)) * 4; }
        if (p.state !== 'back') p.resume = { state: p.state, x: p.x, z: p.z };
        p.hx0 = p.x; p.hz0 = p.z; p.hx1 = tx; p.hz1 = tz; p.hop = 0.5; p.state = 'hop';
        p.h = Math.atan2(-dx, -dz);
        ev.pedDodge(p);
        continue;
      }
    }
    if (p.state === 'back') {
      const R = p.resume || { state: 'walk', x: p.x, z: p.z };
      const ddx = R.x - p.x, ddz = R.z - p.z, dd = hypot(ddx, ddz);
      if (dd < 0.35) { p.state = R.state === 'goto' || R.state === 'cross' || R.state === 'wait' ? R.state : 'walk'; p.resume = null; }
      else { const st = Math.min(dd, 3 * dt); p.x += (ddx / dd) * st; p.z += (ddz / dd) * st; p.h = Math.atan2(ddx, ddz); }
      continue;
    }
    if (p.state === 'walk') {
      p.s += p.dir * p.speed * dt;
      const node = p.dir === 1 ? p.e.b : p.e.a;
      const dEnd = p.dir === 1 ? p.e.len - p.s : p.s;
      if (dEnd < (isMouth(node) ? ALLEY_HW + 1.6 : nodeMaxHw(node)) + 4.6) { pedAtCorner(p, node); continue; }
      const [x, z, tx, tz] = sidePt(p.e, p.s, p.sd, PED_OFF);
      p.h = dampAngle(p.h, Math.atan2(tx * p.dir, tz * p.dir), 8, dt);
      p.x = x; p.z = z;
    } else if (p.state === 'goto') {
      const ddx = p.gx - p.x, ddz = p.gz - p.z, dd = hypot(ddx, ddz);
      if (dd < 0.3) { const a = p.after || { state: 'walk' }; Object.assign(p, a); p.t = 0; }
      else { const st = Math.min(dd, p.speed * dt); p.x += (ddx / dd) * st; p.z += (ddz / dd) * st; p.h = dampAngle(p.h, Math.atan2(ddx, ddz), 10, dt); }
    } else if (p.state === 'wait') {
      const sig = SIGNALS.get(p.node);
      p.h = dampAngle(p.h, Math.atan2(p.bx - p.ax, p.bz - p.az), 6, dt);
      const held = !!p.node && sirenNear(ambs, NODES[p.node][0], NODES[p.node][1], 75);
      if (sig && !held && sigRedLeft(sig, sig.groups.get(p.e.idx) || 0) > 6) { p.state = 'cross'; p.u = 0; }
      else if (p.t > 35) { p.state = 'walk'; p.dir = -p.dir; }
    } else if (p.state === 'cross') {
      const L = hypot(p.bx - p.ax, p.bz - p.az) || 1;
      p.u += (p.speed * (sirenNear(ambs, p.x, p.z, 90) ? 1.9 : 1.15) * dt) / L;
      const u = Math.min(1, p.u);
      p.x = lerp(p.ax, p.bx, u); p.z = lerp(p.az, p.bz, u);
      p.h = Math.atan2(p.bx - p.ax, p.bz - p.az);
      if (p.u >= 1) { const c = p.cross; goTo(p, c.cx, c.cz, { state: 'walk', s: c.s, sd: c.sd, dir: c.dir }); }
    }
  }
  for (let k = 0; k < 3; k++) {
    pedRecycleI = (pedRecycleI + 1) % peds.length;
    const p = peds[pedRecycleI];
    if (p.state !== 'hop' && hypot(p.x - fx, p.z - fz) > keep) placePed(p, fx, fz, r0, r1);
  }
}
function pedRender(t) {
  for (const p of peds) {
    const g = p.ch.g;
    const moving = p.state === 'walk' || p.state === 'goto' || p.state === 'cross' || p.state === 'back';
    // on a bridge the sidewalk is the deck
    const dy = DECKS.length ? bridgeY(p.x, p.z) : -100, by = dy > -50 ? dy + 0.33 - 0.25 * (1 - clamp(dy / 0.8, 0, 1)) : 0;
    g.position.set(p.x, p.y + by + (moving ? Math.abs(Math.sin(t * 7 + p.ph)) * 0.12 : 0), p.z);
    g.rotation.y = p.h;
    g.rotation.z = moving ? Math.sin(t * 7 + p.ph) * 0.06 : 0;
  }
}

// ---------- knockables: parked scooters, cones, plant pots, crates ----------
const knock = [];
function knockGeos() {
  const scooter = (col) => {
    const gb = new GB();
    gb.add(box(0.7, 0.5, 1.8), col, M(0, 0.62, 0));
    gb.add(box(0.66, 0.9, 0.32), col, M(0, 1.0, 0.75));
    gb.add(box(0.6, 0.2, 0.85), 0x2b2f35, M(0, 0.98, -0.3));
    for (const z of [-0.72, 0.78]) { const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10); wg.rotateZ(Math.PI / 2); gb.add(wg, 0x34363c, M(0, 0.32, z)); }
    gb.add(box(0.85, 0.07, 0.07), 0x3a3f46, M(0, 1.5, 0.72));
    return gb.build();
  };
  return {
    scooter: { r: 0.85, geo: scooter(0xffffff) },
    cone: { r: 0.5, geo: (() => { const gb = new GB(); gb.add(box(0.9, 0.12, 0.9), 0xf08a3c, M(0, 0.06, 0)); gb.add(new THREE.ConeGeometry(0.36, 1.1, 10), 0xf08a3c, M(0, 0.66, 0)); gb.add(new THREE.CylinderGeometry(0.22, 0.27, 0.2, 10), 0xffffff, M(0, 0.66, 0)); return gb.build(); })() },
    pot: { r: 0.62, geo: (() => { const gb = new GB(); gb.add(new THREE.CylinderGeometry(0.6, 0.45, 0.9, 10), 0xc8693f, M(0, 0.45, 0)); gb.add(blobGeo(0.62, 1, 0.25, 2.2), 0x5fae40, M(0, 1.15, 0)); gb.add(new THREE.IcosahedronGeometry(0.16, 0), 0xf6d36b, M(0.3, 1.6, 0.2)); return gb.build(); })() },
    crate: { r: 0.8, geo: (() => { const gb = new GB(); gb.add(box(1.4, 1.0, 1.0), 0x4a86c8, M(0, 0.5, 0)); gb.add(box(1.2, 0.3, 0.8), 0xf28f3c, M(0, 1.12, 0)); return gb.build(); })() },
  };
}
const SCOOTER_COLS = [0xffffff, 0xe9524a, 0x3a7fd5, 0x2f3540, 0x8fd3b5, 0xf2c14e, 0xb9a3e3, 0xb8bec4];
function buildKnockables(scene) {
  const defs = knockGeos();
  const spots = [];
  const ok = (x, z, r) => landF(x, z) > 8 && roadDist(x, z) > 0.5 && roadDist(x, z) < 5.0 && alleyDist(x, z) > 1.6 && !blockedAt(x, z, r) && !spots.some((s) => hypot(s.x - x, s.z - z) < 1.3);
  const cand = edges.filter((e) => !e.flags.ring && !e.flags.campus && !e.flags.alley && e.len > 50);
  // rows of parked scooters, Taipei style
  for (let k = 0; k < 120; k++) {
    const e = pick(cand);
    const s0 = rand(12, e.len - 20), sd = rng() < 0.5 ? 1 : -1;
    const n = randi(3, 8);
    for (let i = 0; i < n; i++) {
      const [px, pz, tx, tz] = edgePoint(e, s0 + i * 1.35);
      const x = px - tz * sd * (e.hw + 4.35), z = pz + tx * sd * (e.hw + 4.35);
      if (ok(x, z, 0.9)) spots.push({ type: 'scooter', x, z, ry: Math.atan2(-tz * sd, tx * sd) + rand(-0.15, 0.15), color: pick(SCOOTER_COLS) });
    }
  }
  for (let k = 0; k < 12; k++) {
    const e = pick(cand);
    const s0 = rand(15, e.len - 25), sd = rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const [px, pz, tx, tz] = edgePoint(e, s0 + i * 2.2);
      const x = px - tz * sd * (e.hw + 0.9), z = pz + tx * sd * (e.hw + 0.9);
      if (ok(x, z, 0.6)) spots.push({ type: 'cone', x, z, ry: rand(0, TAU), color: 0xffffff });
    }
  }
  for (let k = 0; k < 40; k++) {
    const e = pick(cand);
    const [px, pz, tx, tz] = edgePoint(e, rand(10, e.len - 10));
    const sd = rng() < 0.5 ? 1 : -1;
    const x = px - tz * sd * (e.hw + 4.1), z = pz + tx * sd * (e.hw + 4.1);
    const old = zoneOf(x, z) === 'old';
    if (ok(x, z, 0.8)) spots.push({ type: old && rng() < 0.6 ? 'crate' : 'pot', x, z, ry: rand(0, TAU), color: 0xffffff });
  }
  // alleys: scooters parked nose-in along the walls (alternating sides, leaving a way through), pots by the doors
  for (const R of ALLEY_RUNS) {
    if (R.park) continue;
    const e = R.e;
    const sA = nodeMaxHwStreet(e.a) + 8, sB = e.len - nodeMaxHwStreet(e.b) - 8;
    let sv = sA + rand(0, 6), side = rng() < 0.5 ? 1 : -1;
    while (sv < sB) {
      const n = randi(2, 5);
      for (let i = 0; i < n && sv < sB; i++, sv += 1.2) {
        const [px, pz, tx, tz] = edgePoint(e, sv);
        if (RAMP_SHAPES.some((r) => hypot(r.x - px, r.z - pz) < 3.4)) continue;
        const x = px - tz * side * (e.hw - 0.8), z = pz + tx * side * (e.hw - 0.8);
        if (!blockedAt(x, z, 0.5)) spots.push({ type: 'scooter', x, z, ry: Math.atan2(tx, tz) + (Math.PI / 2) * side + rand(-0.12, 0.12), color: pick(SCOOTER_COLS) });
      }
      sv += rand(6, 14); side = -side;
    }
    for (let k = 0; k < 3; k++) {
      const [px, pz, tx, tz] = edgePoint(e, rand(sA, sB));
      const sd = rng() < 0.5 ? 1 : -1;
      const x = px - tz * sd * (e.hw - 0.45), z = pz + tx * sd * (e.hw - 0.45);
      if (!blockedAt(x, z, 0.7) && !spots.some((q) => hypot(q.x - x, q.z - z) < 1.7)) spots.push({ type: 'pot', x, z, ry: rand(0, TAU), color: 0xffffff });
    }
  }
  for (const H of HOSPITALS) for (let k = 0; k < 3; k++) {
    const [x, z] = localToWorld(H.bld.x, H.bld.z, H.bld.rot, rand(-H.bld.w / 2 + 2, H.bld.w / 2 - 2), H.bld.d / 2 + 1.6);
    if (!blockedAt(x, z, 0.7)) spots.push({ type: 'pot', x, z, ry: 0, color: 0xffffff });
  }
  for (const type of Object.keys(defs)) {
    const list = spots.filter((s) => s.type === type);
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(defs[type].geo, MAT.toon, list.length);
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    const ol = new THREE.InstancedMesh(defs[type].geo, MAT.olWood, list.length);
    ol.instanceMatrix = im.instanceMatrix; ol.frustumCulled = false;
    scene.add(ol);
    list.forEach((s, i) => {
      im.setColorAt(i, _col.set(s.color));
      knock.push({ type, idx: i, im, r: defs[type].r, x0: s.x, z0: s.z, ry0: s.ry, x: s.x, y: 0, z: s.z, vx: 0, vy: 0, vz: 0, rx: 0, ry: s.ry, rz: 0, wx: 0, wy: 0, wz: 0, st: 0, t: 0, sc: 1, dirty: true });
    });
  }
}
function knockStep(dt, ev) {
  for (const k of knock) {
    if (k.st === 0) {
      const dx = k.x - car.x, dz = k.z - car.z;
      if (Math.abs(dx) < 4.5 && Math.abs(dz) < 4.5) {
        for (const co of [1.35, -1.35]) {
          const cx = car.x + Math.sin(car.h) * co, cz = car.z + Math.cos(car.h) * co;
          const ex = k.x - cx, ez = k.z - cz, d = hypot(ex, ez);
          if (d < 1.38 + k.r && car.speed > 2 && car.y < 2.5) {
            const nx = ex / (d || 1), nz = ez / (d || 1);
            k.st = 1; k.t = 0;
            k.vx = car.vx * 1.1 + nx * 4; k.vz = car.vz * 1.1 + nz * 4; k.vy = 5 + car.speed * 0.25;
            k.wx = grand(-9, 9); k.wy = grand(-6, 6); k.wz = grand(-9, 9);
            car.vx *= 0.97; car.vz *= 0.97;
            ev.knock(k);
            break;
          }
        }
      }
      continue;
    }
    k.t += dt;
    k.dirty = true;
    if (k.st === 1) {
      k.vy -= GRAV * dt;
      k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
      k.rx += k.wx * dt; k.ry += k.wy * dt; k.rz += k.wz * dt;
      const gh = groundHeight(k.x, k.z);
      if (k.y < gh) {
        k.y = gh; k.vy = -k.vy * 0.35; k.vx *= 0.6; k.vz *= 0.6; k.wx *= 0.6; k.wz *= 0.6; k.wy *= 0.6;
        if (Math.abs(k.vy) < 1.2) k.vy = 0;
      }
      if (k.t > 5.5) { k.st = 2; k.t = 0; }
    } else if (k.st === 2) {
      k.sc = Math.max(0, 1 - k.t / 0.4);
      if (k.t > 0.4 && hypot(car.x - k.x0, car.z - k.z0) > 6) {
        k.x = k.x0; k.z = k.z0; k.y = 0; k.rx = k.rz = 0; k.ry = k.ry0; k.vx = k.vy = k.vz = 0; k.st = 3; k.t = 0;
      }
    } else if (k.st === 3) {
      k.sc = Math.min(1, k.t / 0.4);
      if (k.t >= 0.4) { k.sc = 1; k.st = 0; }
    }
  }
}
function knockRender() {
  const touched = new Set();
  for (const k of knock) {
    if (!k.dirty) continue;
    _m4.compose(_v.set(k.x, k.y, k.z), _q.setFromEuler(_e.set(k.rx, k.ry, k.rz)), _s.set(k.sc || 0.0001, k.sc || 0.0001, k.sc || 0.0001));
    k.im.setMatrixAt(k.idx, _m4);
    touched.add(k.im);
    k.dirty = k.st !== 0;
  }
  for (const im of touched) im.instanceMatrix.needsUpdate = true;
}

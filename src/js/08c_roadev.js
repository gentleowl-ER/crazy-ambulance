// ===================== road events: works, crashes, closures, temple processions, fallen trees =====================
// Now and then a stretch of street changes: road works close a lane, a crash backs the traffic up, a marathon or a
// parade closes a block (the police move the barriers for an ambulance with its siren on), a temple procession
// (遶境) walks down the middle of the road, and on a typhoon night a tree comes down across a street. Routes
// (the player's guide, the dispatch desk's ETAs and the self-driving units) all steer round them.
const REV_TYPES = {
  works: { name: '道路施工', icon: 'cone', css: '#e0812a', k: 1.8, dur: [100, 150], half: 20, tv: 6, uv: 14, w: 3,
    say: '封閉一個車道，車流變慢，小心三角錐。' },
  crash: { name: '車禍事故', icon: 'car', css: '#d9473d', k: 2.6, dur: [70, 110], half: 14, tv: 2.5, uv: 9, w: 2.5,
    say: '事故處理中，車子回堵；警察在現場指揮。' },
  closed: { name: '道路管制', icon: 'siren', css: '#c0322b', k: 6, dur: [90, 140], block: true, tv: 0, uv: 11, w: 1.5,
    say: '這段路封起來辦活動，拒馬擋路；鳴笛靠近，警察會移開拒馬讓你過。' },
  parade: { name: '廟會遶境', icon: 'person', css: '#c0221c', k: 3.2, dur: [80, 120], moving: true, tv: 1.6, uv: 6, w: 1.5,
    say: '神轎和陣頭走在路中間，鞭炮聲不斷；鳴笛他們會讓到路邊。' },
  tree: { name: '颱風倒樹', icon: 'wind', css: '#4f7a3a', k: 40, dur: [120, 180], block: true, hard: true, half: 4, tv: 0, uv: 4, w: 0,
    say: '大樹倒下擋住整條路，消防隊正在鋸樹，只能繞路。' },
};
const ROADEV = { list: [], t: 30, n: 0 };
function clearRoadEvents() {
  for (const R of ROADEV.list.slice()) endRoadEvent(R, true);
  ROADEV.list.length = 0;
  ROADEV.t = grand(26, 40);
}
function revEdges() {
  const bad = new Set();
  for (const H of HOSPITALS) if (H.proj) bad.add(H.proj.e);
  for (const S of STATIONS) if (S.proj) bad.add(S.proj.e);
  for (const d of DECKS) bad.add(d.e);
  return edges.filter((e) => !e.flags.alley && !e.flags.ring && !e.flags.campus && e.len >= 70 && !e.rev && !bad.has(e));
}
function pickRevType() {
  const W = WX.id, opts = [['works', 3], ['crash', W === 'rain' || W === 'typhoon' ? 4.5 : 2.4], ['closed', W === 'typhoon' ? 0.4 : 1.4], ['parade', W === 'day' ? 1.6 : W === 'night' ? 0.8 : 0.2]];
  if (W === 'typhoon') opts.push(['tree', 4]);
  return gwpick(opts, (o) => o[1])[0];
}
function spawnRoadEvent(type, near, onEdge) {
  type = type || pickRevType();
  const T = REV_TYPES[type], cand = revEdges();
  const [fx, fz] = near || (G.mode === 'dispatch' ? [0, 0] : [car.x, car.z]);
  for (let tries = 0; tries < 60; tries++) {
    const e = onEdge || gpick(cand);
    const whole = (T.block && !T.hard) || T.moving;
    const half = whole ? Math.min(e.len / 2 - 12, 34) : T.half;
    if (half < 4 || (!whole && e.len < 2 * half + 30)) continue;
    const s = whole ? e.len / 2 : grand(half + 14, e.len - half - 14);
    const [x, z] = edgePoint(e, s);
    if (!near && G.mode !== 'dispatch') { const d = hypot(x - fx, z - fz); if (d < 170 || d > 680 || inView(x, z)) continue; }
    if (G.mode === 'dispatch' && (x < DMAP_VIEW.x0 || x > DMAP_VIEW.x1 || z < DMAP_VIEW.z0 || z > DMAP_VIEW.z1)) continue;
    if (ROADEV.list.some((R) => hypot(R.x - x, R.z - z) < 160)) continue;
    const R = { id: ++ROADEV.n, type, T, e, s, s0: s - half, s1: s + half, x, z, t: 0, dur: grand(...T.dur), objs: [], cols: [], parts: [], open: 0, side: Math.random() < 0.5 ? 1 : -1, said: false };
    e.rev = R; e.evk = T.k;
    buildRoadEvent(R);
    ROADEV.list.push(R);
    for (const v of traffic) if (v.e === e && (T.block || T.moving) && hypot(v.x - car.x, v.z - car.z) > 90) v.stuckT = 99;
    routesChanged();
    const where = `${e.name.replace('東西', '').replace('南北', '')}`;
    if (G.state === 'play') toast(`${iconSVG(T.icon, '#ffffff', 15)} 路況：${where}${T.name}`, '', false, T.css);
    R.where = where;
    return R;
  }
  return null;
}
function endRoadEvent(R, quiet) {
  for (const o of R.objs) { sceneRef.remove(o); if (o.geometry) o.geometry.dispose(); }
  for (const c of R.cols) c.dead = true;
  if (R.e.rev === R) { R.e.rev = null; R.e.evk = 1; }
  const i = ROADEV.list.indexOf(R);
  if (i >= 0) ROADEV.list.splice(i, 1);
  if (!quiet) { routesChanged(); if (G.state === 'play' && G.mode !== 'free') toast(`路況解除：${R.where}${R.T.name}`, '', false, '#2f9e6b'); }
}
// the cached hospital routes and the guide go stale whenever a street opens or closes
function routesChanged() {
  hospDJ.clear();
  if (G.mode !== 'dispatch' && (G.state === 'play' || G.state === 'countdown')) updateGuide(true);
}
// a point on the event's street: s along it, o across it (positive: the R.side kerb)
function revPt(R, s, o) {
  const [px, pz, tx, tz] = edgePoint(R.e, clamp(s, 0, R.e.len));
  return [px - tz * o, pz + tx * o, Math.atan2(tx, tz), tx, tz];
}
function revMesh(gb, x, z, rot) {
  const m = new THREE.Mesh(gb.build(), MAT.toon);
  m.position.set(x, groundHeight(x, z), z); m.rotation.y = rot || 0;
  m.castShadow = true;
  sceneRef.add(m);
  return m;
}
// ---------- the pieces ----------
function coneGeo(gb, x, z) {
  gb.add(box(0.75, 0.12, 0.75), 0x2b2f35, M(x, 0.06, z));
  gb.add(new THREE.ConeGeometry(0.33, 0.95, 10), 0xf06a1f, M(x, 0.58, z));
  gb.add(new THREE.CylinderGeometry(0.2, 0.25, 0.16, 10), 0xffffff, M(x, 0.62, z));
}
function barrierGeo(gb, x, z, w, rot = 0) {
  const P = (lx, ly, lz) => M(x + lx * Math.cos(rot), ly, z - lx * Math.sin(rot), 0, rot, 0);
  const n = Math.max(2, Math.round(w / 0.8));
  for (let i = 0; i < n; i++) gb.add(box(w / n, 0.42, 0.18), i % 2 ? 0xffffff : 0xd9312b, P(-w / 2 + (i + 0.5) * (w / n), 0.95, 0));
  for (const sx of [-1, 1]) { gb.add(box(0.12, 1.1, 0.12), 0x6d747c, P(sx * (w / 2 - 0.2), 0.55, 0)); gb.add(box(0.12, 0.08, 0.9), 0x6d747c, P(sx * (w / 2 - 0.2), 0.04, 0)); }
}
function figureGeo(gb, x, z, ry, shirt, opt = {}) {
  const P = (lx, ly, lz, rx = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z).multiply(M(lx, ly, lz, rx));
  const s = opt.s || 1;
  gb.add(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.85 * s, 6), opt.pants || 0x2b3a55, P(-0.13 * s, 0.43 * s, 0));
  gb.add(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.85 * s, 6), opt.pants || 0x2b3a55, P(0.13 * s, 0.43 * s, 0));
  gb.add(new THREE.CylinderGeometry(0.3 * s, 0.36 * s, 0.85 * s, 8), shirt, P(0, 1.27 * s, 0));
  gb.add(new THREE.SphereGeometry(0.27 * s, 10, 8), opt.skin || 0xf2c9a0, P(0, 1.95 * s, 0));
  if (opt.hat) gb.add(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.14 * s, 10), opt.hat, P(0, 2.2 * s, 0));
  if (opt.vest) gb.add(new THREE.CylinderGeometry(0.33 * s, 0.38 * s, 0.4 * s, 8), 0xd7f03a, P(0, 1.35 * s, 0));
}
function buildRoadEvent(R) {
  const e = R.e, hw = e.hw, sd = R.side;
  const gb = new GB();
  const cx = R.x, cz = R.z;
  const L = (s, o) => { const p = revPt(R, s, o); return [p[0] - cx, p[1] - cz, p[2]]; };
  const addCol = (c) => { R.cols.push(addCollider(c)); };
  if (R.type === 'works') {
    // the closed lane: cones along the lane line, barriers at each end, a digger and a sign
    for (let s = R.s0; s <= R.s1; s += 3.2) { const [x, z] = L(s, sd * hw * 0.3); coneGeo(gb, x, z); const [wx, wz] = revPt(R, s, sd * hw * 0.3); addCol({ t: 0, x: wx, z: wz, r: 0.4 }); }
    for (const s of [R.s0 - 2, R.s1 + 2]) {
      const [x, z, a] = L(s, sd * (hw * 0.63)); barrierGeo(gb, x, z, hw * 0.66, a);
      const [wx, wz] = revPt(R, s, sd * (hw * 0.63)); addCol({ t: 1, x: wx, z: wz, hw: hw * 0.33, hd: 0.3, c: Math.cos(a), s: Math.sin(a) });
    }
    const [dx, dz, a] = L(R.s, sd * hw * 0.6);
    const D = (lx, ly, lz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationY(a).setPosition(dx, 0, dz).multiply(M(lx, ly, lz, rx, ry, rz));
    gb.add(box(2.4, 1.0, 4.2), 0x3a3f46, D(0, 0.5, 0));
    gb.add(box(2.6, 1.3, 3.2), 0xf2b134, D(0, 1.6, 0.2));
    gb.add(box(1.6, 1.4, 1.5), 0xf2b134, D(0.4, 2.9, -0.6));
    gb.add(box(1.4, 1.1, 1.3), 0x8fd3ee, D(0.4, 2.95, -0.6));
    gb.add(box(0.5, 0.5, 4.2), 0xf2b134, D(-0.6, 3.2, 2.6, -0.5));
    gb.add(box(0.5, 0.5, 2.6), 0xf2b134, D(-0.6, 2.4, 5.0, 0.9));
    gb.add(box(1.3, 0.7, 1.0), 0x3a3f46, D(-0.6, 1.2, 5.6));
    const [wx, wz] = revPt(R, R.s, sd * hw * 0.6); addCol({ t: 0, x: wx, z: wz, r: 2.2 });
    for (const k of [-1, 1]) { const [fx, fz] = L(R.s + k * 7, sd * (hw * 0.45)); figureGeo(gb, fx, fz, rand(0, TAU), 0xf06a1f, { vest: true, hat: 0xf2c14e }); }
    signPlate(R, ...revPt(R, R.s0 - 6, sd * (hw - 0.6)));
  } else if (R.type === 'crash') {
    // two cars locked together across the lane, a police car with its lights going, cones behind
    const [x1, z1, a] = L(R.s + 2, sd * hw * 0.45);
    for (const [ox, oz, ry, col] of [[0, 0, 0.5, 0xf4f4f2], [1.6, 4.0, -0.9, 0xf2c230]]) {
      const C = (lx, ly, lz) => new THREE.Matrix4().makeRotationY(a + ry).setPosition(x1 + ox * Math.cos(a) + oz * Math.sin(a), 0, z1 - ox * Math.sin(a) + oz * Math.cos(a)).multiply(M(lx, ly, lz));
      gb.add(box(1.9, 0.9, 4.2), col, C(0, 0.75, 0)); gb.add(box(1.7, 0.75, 2.2), col, C(0, 1.5, -0.2)); gb.add(box(1.6, 0.6, 2.0), 0x5f7f93, C(0, 1.55, -0.2));
      for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) gb.add(box(0.3, 0.6, 0.6), 0x2b2f35, C(wx, 0.3, wz));
      const [cwx, cwz] = [cx + x1 + ox * Math.cos(a) + oz * Math.sin(a), cz + z1 - ox * Math.sin(a) + oz * Math.cos(a)];
      addCol({ t: 1, x: cwx, z: cwz, hw: 1.0, hd: 2.2, c: Math.cos(a + ry), s: Math.sin(a + ry) });
    }
    const [px, pz] = L(R.s - 9, sd * hw * 0.5);
    const Pc = (lx, ly, lz) => new THREE.Matrix4().makeRotationY(a).setPosition(px, 0, pz).multiply(M(lx, ly, lz));
    gb.add(box(1.9, 0.9, 4.4), 0xf4f4f2, Pc(0, 0.75, 0)); gb.add(box(1.94, 0.3, 4.44), 0x2f5fa8, Pc(0, 0.9, 0)); gb.add(box(1.7, 0.7, 2.2), 0xf4f4f2, Pc(0, 1.5, -0.2));
    { const [wx, wz] = revPt(R, R.s - 9, sd * hw * 0.5); addCol({ t: 1, x: wx, z: wz, hw: 1.0, hd: 2.3, c: Math.cos(a), s: Math.sin(a) }); }
    R.light = flashBar(cx + px, cz + pz, a, 2.0);
    for (let k = 0; k < 4; k++) { const [x, z] = L(R.s - 14 - k * 2.6, sd * (hw * 0.32 + k * 0.5)); coneGeo(gb, x, z); }
    const [ox, oz] = L(R.s - 4, sd * hw * 0.3); figureGeo(gb, ox, oz, a, 0x2c4f8a, { vest: true, hat: 0xffffff });
    const [vx, vz] = L(R.s + 1, sd * (hw + 1.6)); figureGeo(gb, vx, vz, a + 1.5, 0xe9524a);
  } else if (R.type === 'closed') {
    // barriers across the whole street at both ends, a police officer at each, runners or marchers in between
    R.march = Math.random() < 0.5;
    R.gates = [];
    for (const s of [R.s0, R.s1]) {
      const gg = new GB();
      const [x, z, a] = L(s, 0);
      barrierGeo(gg, 0, 0, hw * 2 - 0.4, 0);
      const m = revMesh(gg, cx + x, cz + z, a);
      R.objs.push(m);
      const c = addCollider({ t: 1, x: cx + x, z: cz + z, hw: hw - 0.2, hd: 0.35, c: Math.cos(a), s: Math.sin(a) });
      R.cols.push(c);
      const [fx, fz] = L(s + (s === R.s0 ? -2.2 : 2.2), sd * (hw - 1.2));
      figureGeo(gb, fx, fz, a, 0x2c4f8a, { vest: true, hat: 0xffffff });
      R.gates.push({ m, c, s, a, x: cx + x, z: cz + z, open: 0 });
    }
    signPlate(R, ...revPt(R, R.s0 - 7, sd * (hw - 0.6)));
    // the event: marathon runners in coloured shirts, or a parade with flags
    const cols = R.march ? [0xd9312b, 0xf2c14e, 0x2f9e6b] : [0x3a7fd5, 0xff6fae, 0xf2c14e, 0x3fae5a, 0xf08a3c, 0xffffff];
    for (let i = 0; i < (R.march ? 10 : 14); i++) {
      const pg = new GB();
      figureGeo(pg, 0, 0, 0, cols[i % cols.length], { pants: R.march ? 0x2b2f35 : 0x2b3a55 });
      if (R.march && i % 3 === 0) { pg.add(box(0.06, 3.2, 0.06), 0x6d4a2a, M(0.42, 1.8, 0)); pg.add(box(1.3, 0.8, 0.04), cols[(i + 1) % 3], M(1.05, 3.0, 0)); }
      else if (!R.march) pg.add(box(0.5, 0.36, 0.04), 0xffffff, M(0, 1.35, 0.33));
      const m = revMesh(pg, cx, cz, 0);
      R.objs.push(m);
      R.parts.push({ m, s: grand(R.s0 + 4, R.s1 - 4), o: grand(-hw + 1.5, hw - 1.5), v: R.march ? grand(1.0, 1.4) : grand(3.2, 4.6), dir: Math.random() < 0.5 ? 1 : -1, ph: rand(0, TAU) });
    }
  } else if (R.type === 'parade') {
    // the procession: gongs and a drum cart in front, flag bearers, two tall puppet gods, the sedan chair with its bearers
    R.ps = 6; R.pdir = 1;
    if (Math.random() < 0.5) { R.ps = R.e.len - 6; R.pdir = -1; }
    const pg = new GB();
    const red = 0xc0221c, gold = 0xe8b83a;
    // sedan chair (神轎) at the back
    pg.add(box(1.6, 1.7, 1.8), red, M(0, 1.9, -7));
    pg.add(hipRoofGeo(2.4, 2.6, 1.0, 0.3), gold, M(0, 2.75, -7), { flat: true });
    pg.add(new THREE.SphereGeometry(0.3, 8, 6), gold, M(0, 3.9, -7));
    for (const sx of [-1, 1]) pg.add(box(0.12, 0.12, 5.4), 0x6d4a2a, M(sx * 0.95, 1.5, -7));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) figureGeo(pg, sx * 1.15, -7 + sz * 2.2, 0, 0xffffff, { pants: 0x2b2f35, hat: 0xf2c14e });
    // the two tall gods (千里眼, 順風耳)
    for (const [sx, robe, face] of [[-1, 0x2f9e6b, 0x3a7fd5], [1, 0xd9312b, 0x2f9e6b]]) {
      pg.add(new THREE.CylinderGeometry(0.7, 1.1, 3.4, 10), robe, M(sx * 1.3, 1.9, -1.5));
      pg.add(box(2.4, 0.5, 0.6), gold, M(sx * 1.3, 3.5, -1.5));
      pg.add(new THREE.SphereGeometry(0.62, 10, 8), face, M(sx * 1.3, 4.2, -1.5));
      pg.add(new THREE.ConeGeometry(0.5, 0.7, 8), gold, M(sx * 1.3, 4.9, -1.5));
    }
    // flags and the drum cart
    for (const [sx, c] of [[-1.2, 0xf2c14e], [1.2, 0xd9312b]]) { figureGeo(pg, sx, 2.6, 0, 0xf4f4f0); pg.add(box(0.07, 3.6, 0.07), 0x6d4a2a, M(sx + 0.35, 2.0, 2.6)); pg.add(box(0.04, 1.6, 1.1), c, M(sx + 0.35, 3.1, 3.2)); }
    pg.add(box(1.8, 0.7, 2.2), 0x8a5a3a, M(0, 0.8, 6.2));
    pg.add(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 14), red, M(0, 1.7, 6.2, Math.PI / 2));
    for (const sx of [-1, 1]) pg.add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), 0x2b2f35, M(sx * 1.0, 0.4, 5.6, 0, 0, Math.PI / 2));
    figureGeo(pg, 0, 4.4, 0, 0xffffff, { pants: 0x2b2f35 });
    const m = new THREE.Mesh(pg.build(), MAT.toon); m.castShadow = true;
    sceneRef.add(m);
    R.objs.push(m);
    R.pm = m; R.po = 0; R.pfire = 2; R.px = cx; R.pz = cz;
  } else if (R.type === 'tree') {
    // a big roadside tree down across the street, its roots in the air, two firefighters with a chainsaw
    const [bx, bz, a] = L(R.s, -sd * (hw + 2.4)), [tx2, tz2] = L(R.s + 2, sd * (hw + 1.5));
    const rx0 = cx + bx, rz0 = cz + bz, rx1 = cx + tx2, rz1 = cz + tz2;
    const [tg, tm] = cylBetween(bx, 0.6, bz, tx2, 0.9, tz2, 0.7, 0.45, 8);
    gb.add(tg, 0x7a5236, tm);
    gb.add(new THREE.SphereGeometry(1.6, 8, 6), 0x7a5236, M(bx, 0.8, bz, 0, 0, 0, 1, 0.8, 1));
    for (let k = 0; k < 6; k++) { const u = 0.45 + k * 0.11; const x = lerp(bx, tx2, u) + rand(-1.5, 1.5), z = lerp(bz, tz2, u) + rand(-1.5, 1.5); gb.add(new THREE.IcosahedronGeometry(rand(1.6, 2.4), 0), gpick([0x4f9d3a, 0x3d8a30, 0x63b445]), M(x, rand(1.0, 2.0), z)); }
    addCol({ t: 2, ax: rx0, az: rz0, bx: rx1, bz: rz1, r: 1.6 });
    for (const k of [-1, 1]) { const [fx, fz] = L(R.s + k * 4, sd * 1.2); figureGeo(gb, fx, fz, a + k, 0xb5803a, { hat: 0xf2c14e, pants: 0x3a3f46 }); }
    R.light = flashBar(...(() => { const p = revPt(R, R.s - 10, sd * hw * 0.5); return [p[0], p[1], p[2], 2.2]; })());
  }
  const m = new THREE.Mesh(gb.build(), MAT.toon);
  m.position.set(cx, 0, cz); m.castShadow = true;
  sceneRef.add(m);
  R.objs.push(m);
  if (R.light) R.objs.push(R.light);
}
// the 道路施工 / 道路管制 sign on a stand at the kerb
function signPlate(R, x, z, a) {
  const g = atlasQuad(2.6, 1.3, STREET.plate, STREET.plateK.work);
  const m = new THREE.Mesh(g, MAT.plate);
  m.position.set(x, 1.7, z); m.rotation.y = a + Math.PI;
  sceneRef.add(m);
  R.objs.push(m);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), MAT.toon);
  const pc = new Float32Array(pole.geometry.attributes.position.count * 3).fill(0.42);
  pole.geometry.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  pole.position.set(x, 0.6, z);
  sceneRef.add(pole);
  R.objs.push(pole);
}
// a police or fire light bar: red and blue, flashing
function flashBar(x, z, a, y) {
  const g = new THREE.Group();
  const r = new THREE.Mesh(box(0.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  const b = new THREE.Mesh(box(0.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0x3a7fff }));
  r.position.x = -0.35; b.position.x = 0.35;
  g.add(r, b); g.position.set(x, y, z); g.rotation.y = a;
  sceneRef.add(g);
  g.userData = { r, b };
  return g;
}

// ---------- the events over time ----------
function roadEventsStep(dt) {
  const disp = G.mode === 'dispatch';
  ROADEV.t -= dt;
  const max = (disp ? 3 : 2) + (WX.id === 'typhoon' ? 1 : 0);
  if (ROADEV.t <= 0) {
    ROADEV.t = grand(38, 66) * (WX.id === 'typhoon' ? 0.7 : 1);
    if (ROADEV.list.length < max) spawnRoadEvent();
  }
  const amb = ambList();
  for (const R of ROADEV.list.slice()) {
    R.t += dt;
    if (R.light) { const on = Math.floor(G.t * 5) % 2; R.light.userData.r.visible = !!on; R.light.userData.b.visible = !on; }
    // a parade walks the length of its street and then it is over
    if (R.type === 'parade') paradeStep(R, dt, amb);
    if (R.type === 'closed') closedStep(R, dt, amb);
    if (R.t > R.dur || (R.type === 'parade' && (R.ps < -4 || R.ps > R.e.len + 4))) endRoadEvent(R);
  }
}
// barriers: the police slide them aside for an ambulance with its siren on, and back once it has gone through
function closedStep(R, dt, amb) {
  for (const g of R.gates) {
    const near = amb.some((a) => a.siren && hypot(a.x - g.x, a.z - g.z) < 30);
    const close = amb.some((a) => hypot(a.x - g.x, a.z - g.z) < 9);
    if (near) {
      if (!g.open && G.mode !== 'dispatch' && !R.said) { R.said = true; toast('警察移開拒馬，讓救護車通過！', '', false, '#2c4f8a'); }
      g.open = 6;
    } else if (!close) g.open = Math.max(0, g.open - dt);
    g.c.dead = g.open > 0;
    // slide the barrier to the kerb
    const k = damp(g.k || 0, g.open > 0 ? 1 : 0, 3, dt); g.k = k;
    const nx = Math.cos(g.a), nz = -Math.sin(g.a);
    g.m.position.set(g.x + nx * k * R.e.hw * 1.6 * R.side, groundHeight(g.x, g.z), g.z + nz * k * R.e.hw * 1.6 * R.side);
  }
  // runners and marchers: up and down the closed block; to the kerbs when a siren comes
  const sir = amb.some((a) => a.siren && hypot(a.x - R.x, a.z - R.z) < R.s1 - R.s0 + 40);
  for (const p of R.parts) {
    p.s += p.v * p.dir * dt;
    if (p.s > R.s1 - 3) p.dir = -1; else if (p.s < R.s0 + 3) p.dir = 1;
    const to = sir ? Math.sign(p.o || 1) * (R.e.hw - 1.2) : p.o0 !== undefined ? p.o0 : (p.o0 = p.o);
    p.ox = damp(p.ox === undefined ? p.o : p.ox, to, 2.5, dt);
    const [x, z, a] = revPt(R, p.s, p.ox);
    p.m.position.set(x, groundHeight(x, z) + Math.abs(Math.sin(G.t * 9 + p.ph)) * 0.18 * (R.march ? 0.4 : 1), z);
    p.m.rotation.y = a + (p.dir > 0 ? 0 : Math.PI);
    bumpPeople(R, x, z);
  }
}
function paradeStep(R, dt, amb) {
  const near = amb.some((a) => a.siren && hypot(a.x - R.px, a.z - R.pz) < 45);
  R.po = damp(R.po, near ? R.side * R.e.hw * 0.55 : 0, 1.6, dt);
  R.ps += R.T.tv * R.pdir * dt;
  const [x, z, a] = revPt(R, R.ps, R.po);
  R.px = x; R.pz = z;
  R.pm.position.set(x, groundHeight(x, z) + Math.abs(Math.sin(G.t * 3.2)) * 0.12, z);
  R.pm.rotation.y = a + (R.pdir > 0 ? 0 : Math.PI);
  R.s0 = R.ps - 12; R.s1 = R.ps + 12;
  // firecrackers in front of the procession
  R.pfire -= dt;
  if (R.pfire <= 0) {
    R.pfire = grand(1.2, 3.4);
    const [fx, fz] = revPt(R, R.ps + R.pdir * 10, R.po + rand(-2, 2));
    for (let k = 0; k < 7; k++) puff(fx + rand(-1, 1), 0.4, fz + rand(-1, 1), rand(-3, 3), rand(3, 7), rand(-3, 3), rand(0.25, 0.5), 0.6, gpick([0xff3b30, 0xffffff, 0xf2c14e]), -6, 1.2);
    if (G.mode !== 'dispatch' && hypot(car.x - fx, car.z - fz) < 120) for (let k = 0; k < 5; k++) setTimeout(() => noiseHit(0.05, 0.12, 3200, 900, 'highpass'), k * 70 + Math.random() * 40);
  }
  // the procession is solid: the ambulance cannot plough through it
  if (G.mode !== 'dispatch') {
    const fx = Math.sin(a) * R.pdir, fz = Math.cos(a) * R.pdir, dx = car.x - x, dz = car.z - z;
    const along = dx * fx + dz * fz, across = -dx * fz + dz * fx;
    if (Math.abs(along) < 10 && Math.abs(across) < 3.6) {
      const push = 3.6 - Math.abs(across), sgn = Math.sign(across) || 1;
      car.x += -fz * sgn * push; car.z += fx * sgn * push;
      car.vx *= 0.6; car.vz *= 0.6;
      if (!(R.hitT > G.t)) { R.hitT = G.t + 3; toast('撞進遶境隊伍！要鳴笛請他們讓路', '−20', true); addScore(-20); tally('peds', 6, 'peds'); }
    }
  }
}
// people in a closed street jump out of the ambulance's way (and the shift remembers)
function bumpPeople(R, x, z) {
  if (G.mode === 'dispatch' || car.speed < 4) return;
  if (Math.abs(car.x - x) > 2 || Math.abs(car.z - z) > 2 || hypot(car.x - x, car.z - z) > 1.7) return;
  car.vx *= 0.7; car.vz *= 0.7;
  if (!(R.hitT > G.t)) { R.hitT = G.t + 2.5; toast('差點撞到人！', '−10', true); addScore(-10); tally('peds', 6, 'peds'); }
}
// how fast traffic may go on a street with an event (Infinity: no limit here)
function revTrafficLimit(R, v) {
  const ahead = v.dir === 1 ? R.s0 - v.s : v.s - R.s1;          // to the start of the stretch, along our way
  const inside = v.s >= R.s0 && v.s <= R.s1;
  if (R.T.block || R.type === 'parade') {
    if (inside) return R.type === 'parade' ? R.T.tv : 4;
    if (ahead >= 0 && ahead < 22) return Math.max(0, (ahead - 4) * 1.2);
    return Infinity;
  }
  if (inside || (ahead >= 0 && ahead < 18)) return R.T.tv;
  return Infinity;
}
// maps: the affected stretch in the event's colour, and its icon
function drawRoadEvents(g, P, px, big) {
  for (const R of ROADEV.list) {
    g.lineCap = 'round';
    g.strokeStyle = R.T.css; g.lineWidth = px * (big ? 5 : 3.5); g.globalAlpha = 0.85;
    g.setLineDash([px * 4, px * 3]);
    g.beginPath();
    for (let s = Math.max(0, R.s0), k = 0; s <= Math.min(R.e.len, R.s1) + 0.01; s += 3, k++) { const [x, z] = edgePoint(R.e, s); const [qx, qy] = P(x, z); if (k) g.lineTo(qx, qy); else g.moveTo(qx, qy); }
    g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    const c = R.type === 'parade' ? [R.px, R.pz] : [R.x, R.z];
    const [qx, qy] = P(c[0], c[1]), r = px * (big ? 9 : 7);
    g.fillStyle = R.T.css; g.beginPath(); g.arc(qx, qy, r, 0, TAU); g.fill();
    g.lineWidth = px * 1.8; g.strokeStyle = '#ffffff'; g.stroke();
    drawIcon(g, R.T.icon, qx, qy, r * 1.3, '#ffffff');
  }
}

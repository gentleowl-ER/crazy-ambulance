// ===================== 士林・北投: bridges over the 基隆河, and the landmarks north of it =====================
// yaw first, then pitch (for parts laid along a sloping bridge deck or a coaster track)
function MY(x, y, z, yaw, pitch = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}

// ---------- bridges: any street that crosses a river gets a low arched deck with sidewalks and railings ----------
const DECKS = []; // { x0, z0, x1, z1, hw, P: [[x, z, y], ...] }
function bridgeY(x, z) {
  let best = -100;
  for (const d of DECKS) {
    if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
    const P = d.P, r2 = d.hw * d.hw;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1);
      const qx = a[0] + dx * t - x, qz = a[1] + dz * t - z;
      if (qx * qx + qz * qz <= r2) { const y = a[2] + (b[2] - a[2]) * t; if (y > best) best = y; }
    }
  }
  return best;
}
const DECK_Y = 1.7, DECK_RAMP = 14, DECK_SIDE = 4.2;
function buildBridges() {
  for (const e of edges) {
    if (e.flags.alley || e.flags.ring) continue;
    let w0 = -1, w1 = -1;
    for (let s = 0; s <= e.len; s += 1.5) { const [x, z] = edgePoint(e, s); if (landF(x, z) < 2) { if (w0 < 0) w0 = s; w1 = s; } }
    if (w0 < 0) continue;
    const s0 = Math.max(0, w0 - DECK_RAMP), s1 = Math.min(e.len, w1 + DECK_RAMP), hwD = e.hw + DECK_SIDE;
    const yAt = (s) => DECK_Y * smoothstep(w0 - DECK_RAMP, w0 - 2, s) * (1 - smoothstep(w1 + 2, w1 + DECK_RAMP, s));
    const n = Math.max(2, Math.ceil((s1 - s0) / 3));
    const P = [];
    for (let i = 0; i <= n; i++) { const s = lerp(s0, s1, i / n); const q = edgePoint(e, s); P.push([q[0], q[1], yAt(s), s]); }
    const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]);
    DECKS.push({ x0: Math.min(...xs) - hwD, x1: Math.max(...xs) + hwD, z0: Math.min(...zs) - hwD, z1: Math.max(...zs) + hwD, hw: hwD, P, e });
    const ASPH = 0x676d75, WALK = 0xd7d1c4, BEAM = 0xc6c0b4, RAIL = 0xf3f1ea, POST = 0x4f86b8;
    let lampS = s0 + 10, side = 1;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      if (Math.max(a[2], b[2]) < 0.06) continue; // flush with the road: the street itself carries on
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), dy = b[2] - a[2];
      const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, L), segL = Math.hypot(L, dy) + 0.08;
      const base = MY((a[0] + b[0]) / 2, (a[2] + b[2]) / 2 + 0.02, (a[1] + b[1]) / 2, yaw, pitch);
      const at = (lx, ly) => base.clone().multiply(M(lx, ly, 0));
      addStatic(box(e.hw * 2, 0.3, segL), ASPH, at(0, -0.15), { noShadow: true });
      for (const sx of [-1, 1]) {
        addStatic(box(DECK_SIDE, 0.46, segL), WALK, at(sx * (e.hw + DECK_SIDE / 2), 0.08 - 0.25 * (1 - clamp((a[2] + b[2]) / 1.6, 0, 1))), { noShadow: true });
        if (Math.min(a[2], b[2]) > 0.3) {
          addStatic(box(0.2, 0.16, segL), RAIL, at(sx * (hwD - 0.15), 1.32));
          addStatic(box(0.12, 0.1, segL), RAIL, at(sx * (hwD - 0.15), 0.8));
          if (k % 2 === 0) addStatic(box(0.16, 1.1, 0.16), POST, at(sx * (hwD - 0.15), 0.82));
        }
      }
      addStatic(box(hwD * 2 + 0.2, 1.1, segL), BEAM, at(0, -0.85));
      // railings the ambulance cannot climb
      if (Math.min(a[2], b[2]) > 0.3) for (const sx of [-1, 1]) {
        const ox = Math.cos(yaw) * sx * (hwD - 0.1), oz = -Math.sin(yaw) * sx * (hwD - 0.1);
        addCollider({ t: 2, ax: a[0] + ox, az: a[1] + oz, bx: b[0] + ox, bz: b[1] + oz, r: 0.25 });
      }
      // piers down into the river
      if (k % 6 === 3 && landF(a[0], a[1]) < -2) {
        const hp = a[2] - 1.4 + 4.6;
        for (const ox of e.hw >= 7 ? [-e.hw * 0.55, e.hw * 0.55] : [0]) addStatic(box(2.0, hp, 2.6), 0xb3ada2, MY(a[0] + Math.cos(yaw) * ox, a[2] - 1.4 - hp / 2, a[1] - Math.sin(yaw) * ox, yaw));
      }
      // lamps on alternate sides
      if (a[3] >= lampS && a[2] > 0.5) {
        lampS = a[3] + 22; side = -side;
        const rx = Math.cos(yaw) * side, rz = -Math.sin(yaw) * side;
        const lx = a[0] + rx * (hwD - 0.45), lz = a[1] + rz * (hwD - 0.45), ly = a[2];
        addStatic(new THREE.CylinderGeometry(0.13, 0.17, 6.2, 6), 0x5d6670, M(lx, ly + 3.1, lz));
        const head = [lx - rx * 2.0, ly + 6.05, lz - rz * 2.0];
        const lp = { mat: 'sig', piv: head };
        addStatic(box(0.22, 0.2, 2.2), 0x5d6670, M(lx - rx * 1.0, ly + 6.2, lz - rz * 1.0, 0, Math.atan2(rx, rz), 0), lp);
        addStatic(box(0.7, 0.28, 0.9), 0xfff1c2, M(head[0], head[1], head[2], 0, yaw, 0), lp);
        LAMPS.push(head);
      }
    }
  }
}

// ---------- 故宮: the National Palace Museum against the hills, its archway at the end of 至善路 ----------
function buildNPM() {
  const [x, z] = LANDMARKS.npm, [gx, gz] = LANDMARKS.npmGate;
  const rot = Math.atan2(gx - x, gz - z); // the facade looks down the road
  const P = placer(x, z, rot);
  const wall = 0xf3e7cb, roof = 0x2f8a68, ridge = 0xe6bf48, stone = 0xe4ded2, col = 0xd8c08c;
  addStatic(box(66, 2.2, 32), stone, P(0, 1.1, -3));
  addStatic(box(58, 2.2, 26), stone, P(0, 3.3, -5));
  for (let i = 0; i < 6; i++) addStatic(box(20, (i + 1) * 0.74, 2.1), stone, P(0, (i + 1) * 0.37, 22 - i * 2));
  // main hall, its green roof with the yellow ridge, a pavilion on top
  addStatic(windowBox(46, 11, 18, 3.4, 3.7), wall, P(0, 9.9, -6), { mat: 'city', uv: true });
  for (let i = 0; i <= 10; i++) addStatic(new THREE.CylinderGeometry(0.5, 0.5, 9.5, 8), col, P(-20 + i * 4, 9.15, 3.6));
  addStatic(hipRoofGeo(52, 25, 4.6, 0.55), roof, P(0, 15.4, -6), { flat: true });
  addStatic(box(28, 0.7, 0.9), ridge, P(0, 20.1, -6));
  eaveHorns(P, 52, 25, 15.4, roof);
  addStatic(box(20, 3.6, 9), wall, P(0, 21.6, -6));
  addStatic(hipRoofGeo(26, 14, 3.6, 0.45), roof, P(0, 23.4, -6), { flat: true });
  addStatic(box(12, 0.6, 0.8), ridge, P(0, 27.1, -6));
  eaveHorns(P, 26, 14, 23.4, roof);
  for (const sx of [-1, 1]) {
    addStatic(windowBox(13, 8, 17, 3.4, 3.7), wall, P(sx * 29, 8.4, -5), { mat: 'city', uv: true });
    addStatic(hipRoofGeo(17, 21, 3, 0.5), roof, P(sx * 29, 12.4, -5), { flat: true });
  }
  const [cx, cz] = localToWorld(x, z, rot, 0, -3);
  boxCollider(cx, cz, 66.4, 32.4, rot);
  const [sx0, sz0] = localToWorld(x, z, rot, 0, 17);
  boxCollider(sx0, sz0, 20.4, 12, rot);
  // the archway (牌樓): white columns, a blue roof, 天下為公 in the middle
  const G = placer(gx, gz, rot), top = { mat: 'sig', piv: [gx, 10, gz] };
  for (const px of [-9.5, -3.4, 3.4, 9.5]) {
    addStatic(box(1.4, 9.2, 1.4), 0xf6f4ee, G(px, 4.6, 0), top);
    addStatic(box(2.0, 0.8, 2.0), 0xd9d4c8, G(px, 0.4, 0));
    const [wx, wz] = localToWorld(gx, gz, rot, px, 0);
    addCollider({ t: 0, x: wx, z: wz, r: 1.0 });
  }
  addStatic(box(22, 1.3, 1.6), 0xf6f4ee, G(0, 9.6, 0), top);
  addStatic(box(6.4, 2.6, 1.7), 0xf6f4ee, G(0, 11.2, 0), top);
  addStatic(hipRoofGeo(9, 3.2, 1.8, 0.6), 0x2c5aa0, G(0, 12.5, 0), Object.assign({ flat: true }, top));
  for (const sx of [-1, 1]) addStatic(hipRoofGeo(8, 2.8, 1.4, 0.6), 0x2c5aa0, G(sx * 7, 10.25, 0), Object.assign({ flat: true }, top));
  for (const fz of [0.87, -0.87]) addStatic(atlasQuad(5.4, 1.35, STREET.plate, LSIGN.npm.k, false, 2), 0xffffff, G(0, 11.2, fz, 0, fz > 0 ? 0 : Math.PI, 0), { mat: 'plateCut', piv: top.piv, uv: true, noShadow: true });
}

// ---------- 臺北美國學校: a campus with a red running track round a football field ----------
function ringGeo(rx, rz, w, seg = 56) {
  const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, TAU, false, 0);
  const h = new THREE.Path(); h.absellipse(0, 0, rx - w, rz - w, 0, TAU, true, 0); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, seg); g.rotateX(-Math.PI / 2);
  return g;
}
function buildTAS() {
  const pk = PARKS.find((p) => p.school);
  // the track in the middle, a classroom block along the north side, a wing at the east end, the gate on 中山北路
  const tx = pk.x0 + 50, tz = pk.z0 + 56, cx = pk.x0 + 60;
  const flat = (geo, c, y) => addStatic(geo, c, M(tx, y, tz), { noShadow: true });
  const disc = new THREE.CircleGeometry(1, 48); disc.rotateX(-Math.PI / 2);
  addStatic(disc, 0x57a843, M(tx, 0.08, tz, 0, 0, 0, 29.5, 1, 15.5), { noShadow: true });
  flat(ringGeo(34, 20, 4.6), 0xc8553f, 0.1);
  for (const o of [1.15, 2.3, 3.45]) flat(ringGeo(34 - o + 0.07, 20 - o + 0.07, 0.14), 0xf3efe6, 0.13);
  addStatic(box(0.22, 0.02, 30), 0xf3efe6, M(tx, 0.1, tz), { noShadow: true });
  flat(ringGeo(4.6, 4.6, 0.2, 32), 0xf3efe6, 0.1);
  for (const sx of [-1, 1]) {
    addStatic(box(0.2, 0.02, 14), 0xf3efe6, M(tx + sx * 22, 0.1, tz), { noShadow: true });
    for (const sz of [-1, 1]) addStatic(box(5, 0.02, 0.2), 0xf3efe6, M(tx + sx * 24.5, 0.1, tz + sz * 7), { noShadow: true });
    addStatic(box(0.2, 2.4, 6), 0xffffff, M(tx + sx * 28.6, 1.2, tz));
  }
  // classroom blocks: white walls, red-brick ends, a covered walkway
  const brick = 0xb5583f, white = 0xf1eee6;
  addStatic(windowBox(64, 12, 13, 3.4, 3.6), white, M(cx, 6, pk.z0 + 9), { mat: 'city', uv: true });
  for (const sx of [-1, 1]) addStatic(box(6, 12.6, 13.4), brick, M(cx + sx * 32, 6.3, pk.z0 + 9), { mat: 'city' });
  addStatic(box(76, 0.6, 14.4), 0x8f979c, M(cx, 12.3, pk.z0 + 9), { mat: 'city' });
  boxCollider(cx, pk.z0 + 9, 76.4, 13.6, 0);
  addStatic(windowBox(15, 10, 40, 3.4, 3.6), white, M(pk.x1 - 10, 5, tz + 2), { mat: 'city', uv: true });
  addStatic(box(15.6, 0.6, 40.6), brick, M(pk.x1 - 10, 10.2, tz + 2), { mat: 'city' });
  boxCollider(pk.x1 - 10, tz + 2, 15.4, 40.4, 0);
  BUILDINGS.push({ x: cx, z: pk.z0 + 9, w: 76, d: 13, rot: 0, h: 12 }, { x: pk.x1 - 10, z: tz + 2, w: 15, d: 40, rot: 0, h: 10 });
  // the brick gate on 中山北路
  for (const sz of [-1, 1]) { addStatic(box(1.8, 3.6, 1.8), brick, M(pk.x0 + 1.5, 1.8, tz + sz * 6)); addCollider({ t: 0, x: pk.x0 + 1.5, z: tz + sz * 6, r: 1.2 }); }
  addStatic(box(1.2, 0.9, 13.8), white, M(pk.x0 + 1.5, 3.9, tz));
}

// ---------- 兒童新樂園: a Ferris wheel, a carousel and a little coaster, all running ----------
const AMUSE = { wheels: [], carou: null, train: null, path: [], u: 0, t: 0 };
// A Ferris wheel whose hub stands at (x, y, z). yaw 0: it turns about the x axis (its face looks east and west);
// yaw PI/2: it faces north and south. The gondolas hang level: one instanced mesh.
function buildWheel(scene, x, y, z, R, yaw, opts = {}) {
  const N = opts.n || 16, cols = opts.spokes || [0xff6fae, 0x4fb3ff];
  const gb = new GB();
  const rim = new THREE.TorusGeometry(R, R > 16 ? 0.42 : 0.32, 6, 48); rim.rotateY(Math.PI / 2);
  const off = R > 16 ? 1.4 : 1.0;
  for (const ox of [-off, off]) gb.add(rim, opts.rim || 0xffffff, M(ox, 0, 0));
  const rim2 = new THREE.TorusGeometry(R * 0.55, 0.22, 6, 32); rim2.rotateY(Math.PI / 2);
  gb.add(rim2, opts.inner || 0xf2c14e, null);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    for (const ox of [-off, off]) gb.add(box(0.14, R, 0.14), cols[i % cols.length], M(ox, Math.cos(a) * R / 2, Math.sin(a) * R / 2, a, 0, 0));
  }
  const hub = new THREE.CylinderGeometry(1.2, 1.2, off * 2 + 0.6, 12); hub.rotateZ(Math.PI / 2);
  gb.add(hub, 0xe23b33, null);
  const holder = new THREE.Group();
  holder.position.set(x, y, z); holder.rotation.y = yaw;
  const mesh = new THREE.Mesh(gb.build(), MAT.toon);
  mesh.castShadow = true;
  holder.add(mesh);
  scene.add(holder);
  // A-frames either side, down to y0
  const y0 = opts.y0 || 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [fx, fz] = W(sx * (off + 1.6), sz * R * 0.6), [tx, tz] = W(sx * (off + 0.5), 0);
    const [g2, m2] = cylBetween(fx, y0, fz, tx, y, tz, 0.45, 0.32, 8);
    addStatic(g2, 0xd9d6cf, m2);
    if (!y0) addCollider({ t: 0, x: fx, z: fz, r: 0.8 });
  }
  const cab = new GB();
  cab.add(box(1.5, 1.4, 1.7), 0xffffff, M(0, -1.2, 0));
  cab.add(box(1.7, 0.25, 1.9), 0xffffff, M(0, -0.38, 0));
  cab.add(box(1.52, 0.5, 1.72), 0x8fd3ee, M(0, -1.0, 0));
  const gond = new THREE.InstancedMesh(cab.build(), MAT.toon, N);
  const gc = opts.cabs || [0xff6fae, 0xf2c14e, 0x4fb3ff, 0x3fae5a, 0xf08a3c, 0x8b6fd6];
  for (let i = 0; i < N; i++) gond.setColorAt(i, _col.set(gc[i % gc.length]));
  gond.frustumCulled = false;
  gond.castShadow = true;
  scene.add(gond);
  const W0 = { mesh, gond, x, y, z, R, N, c, s, speed: opts.speed || 0.12 };
  AMUSE.wheels.push(W0);
  return W0;
}
function buildAmusement(scene) {
  const [wx, wz] = LANDMARKS.wheel, WH = 19, R = 15;
  // the wheel turns about the x axis, so it faces the road (承德路) to the east
  buildWheel(scene, wx, WH, wz, R, 0);
  addStatic(box(9, 0.8, 22), 0xbdb6a8, M(wx, 0.4, wz));
  // carousel: a turning deck of horses under a striped tent roof
  const [cx, cz] = LANDMARKS.carousel;
  addStatic(new THREE.CylinderGeometry(7.4, 7.6, 0.6, 24), 0xe8e2d6, M(cx, 0.3, cz));
  const cg = new GB();
  cg.add(new THREE.CylinderGeometry(6.8, 6.8, 0.35, 24), 0xf2c14e, M(0, 0.78, 0));
  cg.add(new THREE.CylinderGeometry(1.1, 1.1, 4.6, 12), 0xd9473d, M(0, 3.2, 0));
  const hc = [0xffffff, 0xff9ec8, 0x9ad6f2, 0xffe08a];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, r = i % 2 ? 4.6 : 5.6, x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = -a;
    cg.add(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 5), 0xf2c14e, M(x, 3.0, z));
    cg.add(box(0.5, 0.7, 1.5), hc[i % 4], MY(x, 1.9 + (i % 3) * 0.3, z, yaw));
    cg.add(box(0.4, 0.75, 0.45), hc[i % 4], MY(x + Math.sin(yaw) * 0.75, 2.45 + (i % 3) * 0.3, z + Math.cos(yaw) * 0.75, yaw, -0.5));
  }
  AMUSE.carou = new THREE.Mesh(cg.build(), MAT.toon);
  AMUSE.carou.position.set(cx, 0, cz);
  AMUSE.carou.castShadow = true;
  scene.add(AMUSE.carou);
  addStatic(new THREE.ConeGeometry(8.2, 3.4, 16), 0xe23b33, M(cx, 7.1, cz), { flat: true });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; addStatic(box(3.0, 0.7, 0.2), i % 2 ? 0xffffff : 0xf2c14e, M(cx + Math.cos(a) * 7.9, 5.05, cz + Math.sin(a) * 7.9, 0, Math.PI / 2 - a, 0)); }
  addStatic(new THREE.SphereGeometry(0.6, 8, 6), 0xf2c14e, M(cx, 9.0, cz));
  addCollider({ t: 0, x: cx, z: cz, r: 7.5 });
  // the coaster: an oval with two hills on white trestles, a three-car train going round
  const [ox, oz] = LANDMARKS.coaster;
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    AMUSE.path.push([ox + Math.cos(a) * 33, 4.2 + 2.8 * Math.sin(2 * a + 0.4) + 1.6 * Math.sin(3 * a), oz + Math.sin(a) * 12]);
  }
  for (let i = 0; i < N; i++) {
    const a = AMUSE.path[i], b = AMUSE.path[(i + 1) % N];
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), dy = b[1] - a[1];
    const base = MY((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz), -Math.atan2(dy, L));
    const seg = Math.hypot(L, dy) + 0.05;
    for (const sx of [-0.7, 0.7]) addStatic(box(0.18, 0.18, seg), 0xe23b33, base.clone().multiply(M(sx, 0, 0)));
    addStatic(box(1.7, 0.12, 0.3), 0x8a6a4a, base.clone().multiply(M(0, -0.12, 0)));
    if (i % 3 === 0) {
      addStatic(new THREE.CylinderGeometry(0.16, 0.2, a[1], 6), 0xf3f1ea, M(a[0], a[1] / 2, a[2]));
      addCollider({ t: 0, x: a[0], z: a[2], r: 0.4 });
    }
  }
  const car3 = new GB();
  car3.add(box(1.5, 0.8, 2.0), 0xffffff, M(0, 0.55, 0));
  car3.add(box(1.3, 0.5, 0.3), 0x2b2f35, M(0, 1.05, 0.7));
  AMUSE.train = new THREE.InstancedMesh(car3.build(), MAT.toon, 3);
  [0xf2c14e, 0x4fb3ff, 0x3fae5a].forEach((c, i) => AMUSE.train.setColorAt(i, _col.set(c)));
  AMUSE.train.frustumCulled = false;
  AMUSE.train.castShadow = true;
  scene.add(AMUSE.train);
  // the gate on 承德路 and a few ticket booths
  const [gx, gz] = LANDMARKS.amuse;
  const G = placer(gx, gz, Math.PI / 2); // facing east
  for (const sx of [-1, 1]) {
    addStatic(new THREE.CylinderGeometry(0.9, 1.0, 7.6, 10), sx < 0 ? 0xff6fae : 0x4fb3ff, G(sx * 6, 3.8, 0));
    addStatic(new THREE.SphereGeometry(1.2, 10, 8), 0xf2c14e, G(sx * 6, 8.2, 0));
    const [px, pz] = localToWorld(gx, gz, Math.PI / 2, sx * 6, 0);
    addCollider({ t: 0, x: px, z: pz, r: 1.1 });
    addStatic(box(2.6, 2.6, 2.4), 0xffffff, G(sx * 9.8, 1.3, -2));
    addStatic(hipRoofGeo(3.2, 3.0, 1.2, 0.3), sx < 0 ? 0xff6fae : 0x4fb3ff, G(sx * 9.8, 2.6, -2), { flat: true });
  }
  const gtop = { mat: 'plateCut', piv: [gx, 7.6, gz], uv: true, noShadow: true };
  for (const fz of [0.08, -0.08]) addStatic(atlasQuad(10, 2.5, STREET.plate, LSIGN.amuse.k, false, 2), 0xffffff, G(0, 7.6, fz, 0, fz > 0 ? 0 : Math.PI, 0), gtop);
  addStatic(box(12.6, 0.4, 0.3), 0xffffff, G(0, 6.2, 0), { mat: 'sig', piv: gtop.piv });
  // 天文館 next door: a white drum under a dome
  const [ax, az] = LANDMARKS.astro;
  addStatic(new THREE.CylinderGeometry(11, 11.5, 8, 28), 0xf4f3ef, M(ax, 4, az), { mat: 'city' });
  addStatic(new THREE.CylinderGeometry(11.6, 11.6, 0.6, 28), 0xc9d3dc, M(ax, 8.2, az), { mat: 'city' });
  addStatic(new THREE.SphereGeometry(10, 22, 10, 0, TAU, 0, Math.PI / 2), 0xe2e9ef, M(ax, 8.4, az));
  addStatic(windowBox(16, 6, 9, 3.4, 3.2), 0xf4f3ef, M(ax + 14, 3, az + 3), { mat: 'city', uv: true });
  addStatic(atlasQuad(6, 1.5, STREET.plate, LSIGN.astro.k, false, 2), 0xffffff, M(ax + 14, 4.6, az + 7.56), { mat: 'plate', uv: true, noShadow: true });
  addCollider({ t: 0, x: ax, z: az, r: 11.6 });
  boxCollider(ax + 14, az + 3, 16.4, 9.4, 0);
  BUILDINGS.push({ x: ax, z: az, w: 22, d: 22, rot: 0, h: 18 }, { x: ax + 14, z: az + 3, w: 16, d: 9, rot: 0, h: 6 });
}
const _amQ = new THREE.Quaternion(), _amE = new THREE.Euler();
function amuseStep(dt) {
  if (!AMUSE.carou) return;
  AMUSE.t += dt;
  for (const W of AMUSE.wheels) {
    const a0 = AMUSE.t * W.speed;
    W.mesh.rotation.x = a0;
    for (let i = 0; i < W.N; i++) {
      const a = a0 + (i / W.N) * TAU, lz = Math.sin(a) * W.R;
      _m4.makeTranslation(W.x + lz * W.s, W.y + Math.cos(a) * W.R, W.z + lz * W.c);
      W.gond.setMatrixAt(i, _m4);
    }
    W.gond.instanceMatrix.needsUpdate = true;
  }
  AMUSE.carou.rotation.y = -AMUSE.t * 0.55;
  // the train: quicker downhill
  const P = AMUSE.path, N = P.length;
  const i0 = Math.floor(AMUSE.u) % N, nx = P[(i0 + 1) % N];
  const slope = nx[1] - P[i0][1];
  AMUSE.u = (AMUSE.u + dt * clamp(9 - slope * 9, 4, 16)) % N;
  for (let c = 0; c < 3; c++) {
    const u = (AMUSE.u - c * 0.75 + N) % N, k = Math.floor(u), f = u - k;
    const a = P[k], b = P[(k + 1) % N];
    const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f), z = lerp(a[2], b[2], f);
    const dx = b[0] - a[0], dz = b[2] - a[2];
    _amQ.setFromEuler(_amE.set(-Math.atan2(b[1] - a[1], Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ'));
    _m4.compose(_v.set(x, y, z), _amQ, _s.set(1, 1, 1));
    AMUSE.train.setMatrixAt(c, _m4);
  }
  AMUSE.train.instanceMatrix.needsUpdate = true;
}

// ---------- 士林官邸: the old residence in its rose garden ----------
function buildResidence() {
  const [x, z] = LANDMARKS.residence;
  const P = placer(x, z, 0);
  addStatic(windowBox(18, 7, 11, 3.2, 3.5), 0xd3dcc4, P(0, 3.5, 0), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(20, 13, 2.8, 0.5), 0x7c8288, P(0, 7, 0), { flat: true });
  addStatic(box(6, 0.4, 3), 0xf1eee6, P(0, 3.2, 7));
  for (const sx of [-1, 1]) addStatic(new THREE.CylinderGeometry(0.2, 0.2, 3.2, 6), 0xf1eee6, P(sx * 2.6, 1.6, 8.2));
  boxCollider(x, z, 18.4, 11.4, 0);
  BUILDINGS.push({ x, z, w: 18, d: 11, rot: 0, h: 7 });
  // rose beds in rows
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
    const bx = x - 20 + i * 4.6, bz = z + 13 + r * 3.4;
    if (parkVal(bx, bz) < 2 || blockedAt(bx, bz, 0.8)) continue;
    VEG.bush.push({ x: bx, y: 0, z: bz, ry: rand(0, TAU), s: rand(0.55, 0.75), color: pick([0xe5577a, 0xf28fb0, 0xd9312b, 0xfff2f2, 0xf2c14e]) });
  }
}

// ---------- 士林夜市: the market hall on the lane, stalls, lanterns, a gate at each mouth ----------
function buildMarketHall() {
  const [x, z] = LANDMARKS.market;
  // its facade (+z) looks west onto the market lane
  const rot = -Math.PI / 2, P = placer(x, z, rot), w = 30, d = 16;
  addStatic(windowBox(w, 8, d, 3.6, 4), 0xe9e2d2, P(0, 4, 0), { mat: 'city', uv: true });
  addStatic(box(w + 1, 0.6, d + 1), 0x9aa0a6, P(0, 8.3, 0), { mat: 'city' });
  addStatic(box(w, 2.1, 0.4), 0x51606b, P(0, 1.1, d / 2 + 0.1), { mat: 'city' });
  addStatic(box(w + 0.4, 0.3, 1.6), 0xe0602a, P(0, 2.6, d / 2 + 0.8), { mat: 'city' });
  addStatic(atlasQuad(10, 2.5, STREET.plate, LSIGN.hall.k, false, 2), 0xffffff, P(0, 5.4, d / 2 + 0.08), { mat: 'plate', uv: true, noShadow: true });
  boxCollider(x, z, w + 0.4, d + 0.4, rot);
  BUILDINGS.push({ x, z, w, d, rot, h: 8.3 });
}
function marketStalls(e, hwA, hwB, sign = LSIGN.market) {
  const A = STREET.plate, K = STREET.plateK;
  const s0 = hwA + 6, s1 = e.len - hwB - 6;
  const tops = [0xd9312b, 0x3a7fd5, 0xf2c14e, 0x2f9e6b, 0xf08a3c, 0xffffff];
  let i = 0;
  for (let s = s0 + 2; s < s1 - 2; s += 4.4, i++) {
    if (i % 5 === 3) continue; // a gap here and there
    const sd = i % 2 ? 1 : -1;
    const [x0, z0, tx, tz] = edgePoint(e, s);
    const x = x0 - tz * sd * (e.hw - 0.7), z = z0 + tx * sd * (e.hw - 0.7);
    const rot = Math.atan2(tz * sd, -tx * sd), P = placer(x, z, rot);
    addStatic(box(3.0, 0.95, 1.1), 0xe2e4e6, P(0, 0.48, 0));
    addStatic(box(3.1, 0.1, 1.2), 0x9aa0a6, P(0, 0.98, 0));
    for (let k = 0; k < 3; k++) addStatic(box(0.6, 0.18, 0.5), pick([0xf2c14e, 0xe0602a, 0xf3e6cf, 0x8a5a3a]), P(-0.9 + k * 0.9, 1.12, 0.05));
    for (const px of [-1.45, 1.45]) addStatic(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), 0x7a8088, P(px, 1.3, 0.55));
    addStatic(box(3.4, 0.1, 1.9), tops[(i * 7) % tops.length], P(0, 2.62, 0.35, 0.12, 0, 0));
    addStatic(atlasQuad(1.9, 0.72, A, K.food + ((i * 3) % FOOD_SIGNS.length)), 0xffffff, P(0, 2.1, 0.62), { mat: 'plate', uv: true, noShadow: true });
    boxCollider(x, z, 3.1, 1.2, rot);
  }
  // strings of lanterns across the lane
  for (let s = s0; s < s1; s += 6.5) {
    const [x, z, tx, tz] = edgePoint(e, s);
    const ang = Math.atan2(tx, tz);
    addStatic(box(e.hw * 2 + 1.6, 0.05, 0.05), 0x3b2a1e, M(x, 5.0, z, 0, ang + Math.PI / 2, 0), { noShadow: true });
    for (const o of [-2, 0, 2]) {
      const lx = x - tz * o, lz = z + tx * o, ly = 4.45 + (o === 0 ? -0.15 : 0);
      for (const r of [0, Math.PI / 2]) addStatic(atlasQuad(0.75, 0.75, A, K.lantern), 0xffffff, M(lx, ly, lz, 0, ang + r, 0), { mat: 'plate', uv: true, noShadow: true });
    }
  }
  // the gates: two poles and a sign across the mouth
  for (const end of [0, 1]) {
    const [x, z, tx, tz] = edgePoint(e, end ? e.len - hwB - 1.5 : hwA + 1.5);
    const ang = Math.atan2(tx, tz);
    const cut = { mat: 'sig', piv: [x, 7.6, z] };
    for (const sx of [-1, 1]) {
      const px = x - tz * sx * (e.hw + 0.5), pz = z + tx * sx * (e.hw + 0.5);
      addStatic(new THREE.CylinderGeometry(0.22, 0.22, 8.2, 8), 0xc0221c, M(px, 4.1, pz), cut);
      addCollider({ t: 0, x: px, z: pz, r: 0.3 });
    }
    for (const r of [0, Math.PI]) addStatic(atlasQuad(6.4, 1.6, A, sign.k, false, 2), 0xffffff, M(x + tx * (r ? 0.05 : -0.05), 7.6, z + tz * (r ? 0.05 : -0.05), 0, ang + r + (end ? 0 : Math.PI), 0), { mat: 'plateCut', piv: cut.piv, uv: true, noShadow: true });
  }
}

// ---------- 關渡平原: a farmhouse and egrets in the paddies ----------
function buildFarm() {
  const pk = PARKS.find((p) => p.farm);
  // 三合院: a U-shaped brick farmhouse round a yard
  const x = pk.x1 - 16, z = pk.z1 - 18, P = placer(x, z, Math.PI);
  const brick = 0xc0674a, roof = 0x9a4a35;
  addStatic(box(16, 4, 5), brick, P(0, 2, -5));
  addStatic(hipRoofGeo(17, 6, 1.8, 0.7), roof, P(0, 4, -5), { flat: true });
  for (const sx of [-1, 1]) {
    addStatic(box(4.5, 3.6, 9), brick, P(sx * 6, 1.8, 2));
    addStatic(hipRoofGeo(5.5, 10, 1.5, 0.7), roof, P(sx * 6, 3.6, 2), { flat: true });
  }
  boxCollider(x, z, 16.4, 16, 0);
  // egrets standing in the fields
  for (let i = 0; i < 26; i++) {
    const bx = rand(pk.x0 + 10, pk.x1 - 10), bz = rand(pk.z0 + 10, pk.z1 - 30);
    if (landF(bx, bz) < 14) continue;
    const ry = rand(0, TAU), Q = placer(bx, bz, ry);
    addStatic(box(0.35, 0.35, 0.7), 0xffffff, Q(0, 0.75, 0), { noShadow: true });
    addStatic(box(0.12, 0.55, 0.12), 0xffffff, Q(0, 1.15, 0.3), { noShadow: true });
    addStatic(box(0.08, 0.08, 0.35), 0xf2c14e, Q(0, 1.4, 0.48), { noShadow: true });
    addStatic(box(0.05, 0.6, 0.05), 0x3b2a1e, Q(0, 0.3, 0), { noShadow: true });
  }
}

// ---------- 捷運劍潭站: the station whose roof is a long upturned boat ----------
function buildJiantan() {
  const [x, z] = LANDMARKS.jiantan;
  const P = placer(x, z, 0);
  addStatic(windowBox(40, 5.6, 12, 3.4, 3.2), 0xe9ecef, P(0, 2.8, 0), { mat: 'city', uv: true });
  addStatic(box(40.4, 0.5, 12.4), 0xc23a33, P(0, 5.85, 0));
  // the hull: a flattened half pipe along the building, its two ends swept up like a dragon boat
  const hull = new THREE.CylinderGeometry(7.5, 7.5, 44, 18, 8, true, 0, Math.PI);
  hull.rotateZ(Math.PI / 2); // axis along x, the arch on top
  const hp = hull.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const u = Math.abs(hp.getX(i)) / 22;
    hp.setY(i, hp.getY(i) * 0.42 + 2.6 * u * u * u);
  }
  hull.computeVertexNormals();
  addStatic(hull, 0xdfe5ea, P(0, 9.4, 0), { mat: 'double', flat: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addStatic(box(1.0, 3.6, 1.0), 0xc23a33, P(sx * 19, 7.6, sz * 5.4));
  boxCollider(x, z, 40.4, 12.4, 0);
  BUILDINGS.push({ x, z, w: 40, d: 12, rot: 0, h: 9 });
}

function buildShilin(scene) {
  buildJiantan();
  buildNPM();
  buildTAS();
  buildAmusement(scene);
  buildResidence();
  buildMarketHall();
  buildFarm();
  buildScenes(scene);
}

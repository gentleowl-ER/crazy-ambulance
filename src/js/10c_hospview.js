// ===================== briefing: what each hospital looks like, and where it is =====================
// The exterior is a real render of the hospital in the 3D city (one per frame, cached for the visit); the location is
// a crisp street map around it with the street names and nearby landmarks.
const HV = { queue: [], cam: null, rt: null, buf: null };

// from (e, s), go `dist` along the street in direction dir (+1 toward e.b), straight on through junctions
function roadWalk(e, s, dir, dist) {
  for (let guard = 0; guard < 8; guard++) {
    const room = dir > 0 ? e.len - s : s;
    if (dist <= room) return edgePoint(e, s + dir * dist);
    dist -= room;
    const end = edgePoint(e, dir > 0 ? e.len : 0), hx = end[2] * dir, hz = end[3] * dir;
    let nb = null, bd = 0.8;
    for (const o of nodeEdges[dir > 0 ? e.b : e.a] || []) {
      if (o.e === e || o.e.flags.campus) continue;
      const q = edgePoint(o.e, o.dir === 1 ? 0 : o.e.len);
      const dot = q[2] * o.dir * hx + q[3] * o.dir * hz;
      if (dot > bd) { bd = dot; nb = o; }
    }
    if (!nb) return end;
    e = nb.e; dir = nb.dir; s = dir > 0 ? 0 : e.len;
  }
  return edgePoint(e, s);
}
// stand on the street some way along from the entrance and look back at it, so the facade, the ER canopy, one side
// of the building and its floating name sign are all in the picture
const _hv = new THREE.Vector3(), _hm = new THREE.Matrix4();
function hospShotPose(H, aspect) {
  const B = H.bld, e = H.proj.e, s0 = H.proj.s;
  const [px, pz, tx0, tz0] = edgePoint(e, s0);
  let nx = B.x - px, nz = B.z - pz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; // street -> building
  // what has to fit: the building box and the name sign above it
  const pts = [];
  for (const lx of [-B.w / 2, B.w / 2]) for (const lz of [-B.d / 2, B.d / 2 + 7]) {
    const [wx, wz] = localToWorld(B.x, B.z, B.rot, lx, lz);
    pts.push([wx, 0, wz], [wx, B.h + 1.2, wz]);
  }
  pts.push([B.x, B.h + 13, B.z]);
  const tx = B.x - nx * B.d * 0.25, tz = B.z - nz * B.d * 0.25, ty = (B.h + 12) * 0.42;
  const cam = HV.cam;
  let pose = null;
  for (let k = 0; k < 4; k++) {
    const along = B.w / 2 + 30 + k * 16;
    let best = null;
    for (const dir of [1, -1]) {
      const q = roadWalk(e, s0, dir, along);
      const got = Math.abs((q[0] - px) * tx0 + (q[1] - pz) * tz0);
      const lit = (tx0 * dir * SUN_OFF.x + tz0 * dir * SUN_OFF.z) > 0 ? 6 : 0; // the side wall we see faces the sun
      const score = Math.min(got, along) + lit;
      if (!best || score > best.score) best = { q, score };
    }
    const cx = best.q[0] - nx * e.hw * 0.55, cz = best.q[1] - nz * e.hw * 0.55;
    const cy = groundHeight(cx, cz) + 7 + B.h * 0.42;
    cam.position.set(cx, cy, cz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld();
    _hm.copy(cam.matrixWorld).invert();
    let m = 0;
    for (const [x, y, z] of pts) {
      _hv.set(x, y, z).applyMatrix4(_hm);
      const dz = -_hv.z;
      if (dz > 1) m = Math.max(m, Math.abs(_hv.y) / dz, Math.abs(_hv.x) / dz / aspect);
    }
    const fov = (2 * Math.atan(m * 1.06) * 180) / Math.PI;
    pose = { cx, cy, cz, tx, ty, tz, fov: clamp(fov, 30, 66) };
    if (fov <= 62) break;
  }
  return pose;
}
function renderHospShot(H, cv) {
  const W = cv.width, Hh = cv.height;
  if (!HV.cam) {
    HV.cam = new THREE.PerspectiveCamera(45, W / Hh, 1, 820);
    HV.rt = new THREE.WebGLRenderTarget(W, Hh, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    HV.buf = new Uint8Array(W * Hh * 4);
  }
  const P = hospShotPose(H, W / Hh), cam = HV.cam;
  cam.fov = P.fov; cam.aspect = W / Hh; cam.updateProjectionMatrix();
  cam.position.set(P.cx, P.cy, P.cz); cam.lookAt(P.tx, P.ty, P.tz); cam.updateMatrixWorld();
  const fogN = scene.fog.near, fogF = scene.fog.far, cut = CUT.value;
  const sp = sun.position.clone(), st = sun.target.position.clone();
  const carVis = car.group.visible;
  const wid = WX.id;
  if (wid !== 'day') setLights('day');
  scene.fog.near = 300; scene.fog.far = 780; CUT.value = 0; car.group.visible = false;
  focusShadow(P.tx, P.tz);
  skyRender(cam);
  renderer.setRenderTarget(HV.rt);
  renderer.render(scene, cam);
  renderer.readRenderTargetPixels(HV.rt, 0, 0, W, Hh, HV.buf);
  renderer.setRenderTarget(null);
  scene.fog.near = fogN; scene.fog.far = fogF; CUT.value = cut; car.group.visible = carVis;
  if (wid !== 'day') setLights(wid);
  sun.position.copy(sp); sun.target.position.copy(st);
  skyRender(camera);
  const g = cv.getContext('2d'), img = g.createImageData(W, Hh), row = W * 4;
  for (let y = 0; y < Hh; y++) img.data.set(HV.buf.subarray((Hh - 1 - y) * row, (Hh - y) * row), y * row);
  g.putImageData(img, 0, 0);
}
// the street map around one hospital: north is up
function drawHospLoc(cv, H) {
  if (!mapImg || !H.bld) return;
  const W = cv.width, Hh = cv.height, g = cv.getContext('2d');
  const span = 440, sc = W / span, spanZ = Hh / sc;
  const cx = H.bld.x, cz = H.bld.z;
  const x0 = cx - span / 2, z0 = cz - spanZ / 2;
  const P = (x, z) => [(x - x0) * sc, (z - z0) * sc];
  const inside = (x, z, m) => x > x0 - m && x < x0 + span + m && z > z0 - m && z < z0 + spanZ + m;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#ddd7ca'; g.fillRect(0, 0, W, Hh);
  g.imageSmoothingEnabled = true;
  g.drawImage(mapImg, (x0 - WX0) * MAP_SCALE, (z0 - WZ0) * MAP_SCALE, span * MAP_SCALE, spanZ * MAP_SCALE, 0, 0, W, Hh);
  // streets, drawn sharp over the soft base map
  const near = edges.filter((e) => e.pts.some(([x, z]) => inside(x, z, 30)));
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const pass of [0, 1]) for (const e of near) {
    g.strokeStyle = pass ? '#fffdf7' : '#c4b9a6';
    g.lineWidth = e.hw * 2 * sc + (pass ? 0 : 2.4);
    g.beginPath();
    e.pts.forEach(([x, z], k) => { const [a, b] = P(x, z); if (k) g.lineTo(a, b); else g.moveTo(a, b); });
    g.stroke();
  }
  for (const bd of BUILDINGS) {
    if (!inside(bd.x, bd.z, 40)) continue;
    const [a, b] = P(bd.x, bd.z);
    g.save(); g.translate(a, b); g.rotate(-bd.rot);
    g.fillStyle = bd.hosp ? bd.hosp.css : bd.station ? '#d9312b' : bd.h > 30 ? '#b7b0a3' : '#c8c0b2';
    g.fillRect((-bd.w / 2) * sc, (-bd.d / 2) * sc, bd.w * sc, bd.d * sc);
    if (bd.hosp === H) { g.lineWidth = 2.5; g.strokeStyle = '#ffffff'; g.strokeRect((-bd.w / 2) * sc, (-bd.d / 2) * sc, bd.w * sc, bd.d * sc); }
    g.restore();
  }
  const fs = Math.round(W / 14);
  const boxes = [];
  const free = (x, y, w, h) => x - w / 2 > 2 && x + w / 2 < W - 2 && y - h / 2 > 2 && y + h / 2 < Hh - 2
    && !boxes.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < (q.h + h) / 2);
  // keep clear of the hospital's own marker, the north arrow and the "位置" tag in the corner
  const [hx, hy] = P(cx, cz);
  const nxp = W - fs * 1.2, nyp = fs * 1.3;
  boxes.push({ x: hx, y: hy, w: fs * 2, h: fs * 2 }, { x: nxp, y: nyp, w: fs * 1.9, h: fs * 1.9 }, { x: W * 0.12, y: Hh * 0.09, w: W * 0.24, h: Hh * 0.18 });
  // nearby landmarks
  for (const [name, lx, lz] of LANDMARK_LABELS) {
    if (!inside(lx, lz, -8)) continue;
    const [a, b] = P(lx, lz);
    g.font = `${fs}px ${FONT_CJK}`;
    const tw = g.measureText(name).width;
    if (!free(a, b, fs * 1.1, fs * 1.1)) continue;
    // the name under the star, over it, or beside it: wherever it stays on the map and clear of the rest
    let la = 0, ly = 0, ok = false;
    for (const [ox, oy] of [[0, 1.15], [0, -1.15], [1, 0], [-1, 0]]) {
      la = a + ox * (tw / 2 + fs * 0.9); ly = b + oy * fs;
      if (free(la, ly, tw + 12, fs * 1.5)) { ok = true; break; }
    }
    if (!ok) continue;
    boxes.push({ x: la, y: ly, w: tw + 12, h: fs * 1.5 }, { x: a, y: b, w: fs * 1.1, h: fs * 1.1 });
    starPath(g, a, b, fs * 0.55); g.fillStyle = LM_GOLD; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)'; roundRect(g, la - tw / 2 - 6, ly - fs * 0.72, tw + 12, fs * 1.44, fs * 0.72); g.fill();
    g.fillStyle = '#6d5a49'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, la, ly + 1);
  }
  // street names written along the street: the hospital's own street first, then the widest
  const own = roadLabel(H.proj.e, H.drop[0], H.drop[1]);
  const spots = new Map(); // name -> places it could go
  for (const e of near) {
    if (!e.name || e.flags.campus || e.flags.alley) continue;
    for (let sv = 6; sv < e.len - 6; sv += 6) {
      const q = edgePoint(e, sv);
      if (!inside(q[0], q[1], -fs / sc)) continue;
      const nm = roadLabel(e, q[0], q[1]);
      if (!spots.has(nm)) spots.set(nm, { hw: 0, list: [] });
      const S = spots.get(nm); S.hw = Math.max(S.hw, e.hw); S.list.push(q);
    }
  }
  const names = [...spots.keys()].sort((p, q) => (q === own) - (p === own) || spots.get(q).hw - spots.get(p).hw);
  g.font = `${Math.round(fs * 0.92)}px ${FONT_CJK}`;
  let placed = 0;
  for (const nm of names) {
    if (placed >= 5) break;
    const tw = g.measureText(nm).width;
    // the own street: a little way from the marker; others: toward the middle of the map
    const want = nm === own ? (q) => Math.abs(Math.hypot(q[0] - cx, q[1] - cz) - 85) : (q) => Math.hypot(q[0] - cx, q[1] - cz);
    for (const q of spots.get(nm).list.sort((p, r) => want(p) - want(r))) {
      const [a, b] = P(q[0], q[1]);
      let ang = Math.atan2(q[3], q[2]);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      const bw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * fs, bh = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * fs;
      if (!free(a, b, bw + 6, bh + 6)) continue;
      boxes.push({ x: a, y: b, w: bw + 6, h: bh + 6 });
      placed++;
      g.save(); g.translate(a, b); g.rotate(ang);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,253,247,0.95)'; g.lineJoin = 'round'; g.strokeText(nm, 0, 1);
      g.fillStyle = nm === own ? '#4b3424' : '#7d6a58'; g.fillText(nm, 0, 1);
      g.restore();
      break;
    }
  }
  // the hospital: its number on the building, with a halo so it stands out
  const r = fs * 0.78;
  g.fillStyle = 'rgba(60,38,20,0.28)'; g.beginPath(); g.arc(hx, hy + 3, r, 0, TAU); g.fill();
  g.globalAlpha = 0.28; g.fillStyle = H.css; g.beginPath(); g.arc(hx, hy, r * 1.55, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.fillStyle = H.css; g.beginPath(); g.arc(hx, hy, r, 0, TAU); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff'; g.font = `600 ${Math.round(r * 1.2)}px ${FONT_NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(HOSPITALS.indexOf(H) + 1), hx, hy + 1);
  // north arrow
  g.fillStyle = 'rgba(255,255,255,0.88)'; g.beginPath(); g.arc(nxp, nyp, fs * 0.85, 0, TAU); g.fill();
  g.fillStyle = '#e23b33'; g.beginPath(); g.moveTo(nxp, nyp - fs * 0.62); g.lineTo(nxp + fs * 0.36, nyp + fs * 0.1); g.lineTo(nxp - fs * 0.36, nyp + fs * 0.1); g.closePath(); g.fill();
  g.fillStyle = '#6d5a49'; g.font = `600 ${Math.round(fs * 0.62)}px ${FONT_NUM}`; g.fillText('N', nxp, nyp + fs * 0.42);
}
// called when the briefing opens: maps right away, renders one per frame
function queueHospViews() {
  if (!UI.hcards) return;
  HOSPITALS.forEach((H, i) => {
    const loc = UI.hcards.querySelector(`.hc-loc[data-i="${i}"]`);
    if (loc) drawHospLoc(loc, H);
    const shot = UI.hcards.querySelector(`.hc-shot[data-i="${i}"]`);
    if (shot && !shot.dataset.done && !HV.queue.includes(i)) HV.queue.push(i);
  });
}
function hospViewStep() {
  if (!HV.queue.length || !renderer || UI.brief.hidden) return;
  const i = HV.queue.shift(), H = HOSPITALS[i];
  const cv = UI.hcards.querySelector(`.hc-shot[data-i="${i}"]`);
  if (!cv || !H.bld) return;
  try { renderHospShot(H, cv); cv.dataset.done = '1'; cv.classList.add('ready'); } catch (err) { console.warn('[ambulance] hospital view', err); }
}

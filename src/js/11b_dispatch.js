// ===================== dispatch mode: you run the 119 desk, six ambulances drive themselves =====================
const DISPATCH_MARK = { css: '#3a86e0', hex: 0x3a86e0 };
const DSHIFT = 300;
const units = [];
const dcalls = [];
let dsel = null;     // the unit the camera follows
const DQ = [];       // decisions waiting for the dispatcher
let dcur = null;     // decision on screen
let dcallSeq = 0;
const D = { plan: [], t: DSHIFT, callT: 0, score: 0, calls: 0, dec: 0, ok: 0, resp: [], saved: 0, dead: 0, speed: 1, recent: [], hold: 0, waitSum: 0, waitN: 0, hn: 0, xdN: 0 };
const U_CSS = { idle: '#2fae6b', toScene: '#e0413a', onScene: '#f0a12a', wait: '#f0a12a', boarding: '#f0a12a', linger: '#f0a12a', toHosp: '#d63384', atHosp: '#8b6fd6', return: '#1fa3a0' };
const U_TXT = { idle: '待命', toScene: '前往現場', onScene: '現場評估', wait: '等待指示', boarding: '病人上車', linger: '現場處理', toHosp: '送醫中', atHosp: '醫院交接', return: '返隊中' };
const UNIT_SPEED = 22; // average route speed to a scene, for the ETA shown to the dispatcher
const HOSP_SPEED = 18;  // transports are a little slower (boarding, pulling into the bay)
const dEta = (len, v, extra = 0) => `<b>${Math.max(1, Math.round(len / v + extra))} 秒</b><small>車程</small>`;
const unitFree = (u) => u.state === 'idle' || u.state === 'return';
// follow a unit with the camera; after a long jump, gather the street life around it at once
function focusUnit(u) {
  if (!u) return;
  const far = !dsel || hypot(dsel.x - u.x, dsel.z - u.z) > 180;
  dsel = u;
  if (far && G.mode === 'dispatch') populateAround(u.x, u.z, false);
}
const fmtT = (t) => { const s = Math.max(0, Math.floor(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- units ----------
function makeUnits(scene) {
  STATIONS.forEach((S, i) => {
    const m = makeAmbulanceModel({ roof: S.unit.slice(-2), side: S.type === 'ALS' ? '高級救護' : '救護車', stripe: S.type === 'ALS' ? 0xf08a1c : 0xe23b33 });
    m.g.visible = false;
    scene.add(m.g);
    const label = unitLabelSprite(S);
    label.visible = false;
    scene.add(label);
    units.push({ i, S, name: S.unit, type: S.type, m, label, state: 'idle', x: S.park.x, z: S.park.z, h: S.park.h, v: 0, route: null, s: 0,
      call: null, dest: null, siren: false, t: 0, wheel: 0, stuck: 0, ghost: 0, red: false, sceneT: 0 });
  });
}
function unitLabelSprite(S) {
  const css = UNIT_TYPES[S.type].css;
  const tex = textTexture(320, 104, (g, W) => {
    g.font = `46px ${FONT_CJK}`;
    const tw = g.measureText(S.unit).width;
    const bw = Math.min(W - 6, tw + 44), bx = (W - bw) / 2;
    g.fillStyle = 'rgba(60,38,20,0.3)'; roundRect(g, bx, 18, bw, 70, 35); g.fill();
    g.fillStyle = '#ffffff'; roundRect(g, bx, 10, bw, 70, 35); g.fill();
    g.lineWidth = 7; g.strokeStyle = css; roundRect(g, bx, 10, bw, 70, 35); g.stroke();
    g.fillStyle = '#4b3424'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.unit, W / 2, 47);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
  sp.scale.set(10, 3.25, 1);
  sp.renderOrder = 7;
  return sp;
}

// ---------- routes the units follow (with the edge of every stretch, for traffic lights) ----------
function buildRoute(from, to) {
  const DJ = dijkstra(from, true); // the self-driving units keep to the streets
  const r = routeEnds(DJ, to);
  const pieces = [];
  if (r.len === Infinity || r.direct <= r.len) pieces.push({ e: from.e, s0: from.s, s1: to.s, end: null });
  else {
    const endNode = r.viaA <= r.viaB ? to.e.a : to.e.b;
    const chain = [];
    for (let n = endNode; n !== undefined;) { chain.unshift(n); const p = DJ.prev.get(n); if (!p) break; n = p.n; }
    pieces.push({ e: from.e, s0: from.s, s1: chain[0] === from.e.a ? 0 : from.e.len, end: chain[0] });
    for (let i = 1; i < chain.length; i++) {
      const e = DJ.prev.get(chain[i]).e;
      const fwd = e.a === chain[i - 1];
      pieces.push({ e, s0: fwd ? 0 : e.len, s1: fwd ? e.len : 0, end: chain[i] });
    }
    pieces.push({ e: to.e, s0: endNode === to.e.a ? 0 : to.e.len, s1: to.s, end: null });
  }
  const pts = [], seg = [];
  pieces.forEach((P, i) => {
    const n = Math.max(1, Math.ceil(Math.abs(P.s1 - P.s0) / 4));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) { const q = edgePoint(P.e, lerp(P.s0, P.s1, k / n)); pts.push([q[0], q[1]]); seg.push(i); }
    P.endIdx = pts.length - 1;
  });
  if (pts.length < 2) { pts.push([pts[0][0] + 0.05, pts[0][1]]); seg.push(0); }
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  for (const P of pieces) P.endS = cum[Math.min(P.endIdx, cum.length - 1)];
  // corner speed limits
  const vmax = new Float32Array(pts.length).fill(32);
  for (let k = 1; k < pts.length - 1; k++) {
    const ax = pts[k][0] - pts[k - 1][0], az = pts[k][1] - pts[k - 1][1], bx = pts[k + 1][0] - pts[k][0], bz = pts[k + 1][1] - pts[k][1];
    const la = hypot(ax, az), lb = hypot(bx, bz);
    if (la < 1e-3 || lb < 1e-3) continue;
    const ang = Math.acos(clamp((ax * bx + az * bz) / (la * lb), -1, 1));
    vmax[k] = lerp(32, 8, clamp(ang / 1.3, 0, 1));
  }
  return { pts, cum, len: cum[cum.length - 1], pieces, seg, vmax };
}
function routeAt(R, s) {
  s = clamp(s, 0, R.len);
  let lo = 0, hi = R.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.cum[m] <= s) lo = m; else hi = m; }
  const a = R.pts[lo], b = R.pts[hi], L = R.cum[hi] - R.cum[lo] || 1, t = (s - R.cum[lo]) / L;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), (b[0] - a[0]) / L, (b[1] - a[1]) / L, lo];
}
// sideways offset of (x, z) from the route line at distance s (positive = the driving side)
function laneAt(R, s, x, z) { const q = routeAt(R, s); return (x - q[0]) * -q[3] + (z - q[1]) * q[2]; }
// endPt: where to pull in at the end (the kerb by the patient, the hospital bay, the station apron)
function sendUnit(u, to, siren, endPt) {
  const R = buildRoute(nearestOnRoads(u.x, u.z, (e) => !e.flags.campus && !e.flags.alley), to);
  R.l0 = laneAt(R, 0, u.x, u.z);
  if (endPt) R.l1 = laneAt(R, R.len, endPt[0], endPt[1]);
  u.route = R;
  u.s = 0; u.siren = siren; u.stuck = 0; u.ghost = 0;
}
const sceneKerb = (sp) => [sp.x + sp.nx * (sp.e.hw - 2.3), sp.z + sp.nz * (sp.e.hw - 2.3)];
function hospBay(H) {
  const [x, z] = H.drop, b = H.bld || { x, z: z + 1 };
  const L = hypot(b.x - x, b.z - z) || 1, k = H.proj.e.hw - 2.3;
  return [x + ((b.x - x) / L) * k, z + ((b.z - z) / L) * k];
}
// returns true once the unit has stopped at the end of its route
function unitDrive(u, dt) {
  const R = u.route;
  const k0 = routeAt(R, u.s)[4];
  // wet roads and gales slow everybody, the crews too
  let vt = (u.siren ? 30 : 19) * (0.55 + 0.45 * WX.cur.grip);
  const pe = R.pieces[R.seg[k0]].e, RV = pe.rev;
  if (RV && hypot(u.x - (RV.type === 'parade' ? RV.px : RV.x), u.z - (RV.type === 'parade' ? RV.pz : RV.z)) < (RV.s1 - RV.s0) / 2 + 16) vt = Math.min(vt, RV.T.uv);
  // a jam: even with the siren a unit only creeps through
  if (pe.jam) vt = Math.min(vt, lerp(vt, u.siren ? 9.5 : 4, pe.jam.j));
  for (let k = k0 + 1; k < R.pts.length; k++) {
    const dd = R.cum[k] - u.s;
    if (dd > 50) break;
    vt = Math.min(vt, Math.sqrt(R.vmax[k] * R.vmax[k] + 20 * Math.max(0, dd - 1)));
  }
  vt = Math.min(vt, Math.sqrt(18 * Math.max(0, R.len - u.s - 0.4)));
  // without the siren a unit waits at red lights like everybody else
  u.red = false;
  if (!u.siren) {
    const P = R.pieces[R.seg[Math.min(k0 + 1, R.seg.length - 1)]];
    const sig = P && P.end ? SIGNALS.get(P.end) : null;
    if (sig) {
      const room = P.endS - u.s - (sig.hw + 5.4) - 2.6;
      if (room > -1.5 && sigPhase(sig, sig.groups.get(P.e.idx) || 0) !== 'G') { vt = Math.min(vt, room < 0.4 ? 0 : Math.sqrt(12 * Math.max(0, room - 0.3))); u.red = room < 8; }
    }
  }
  if (u.ghost > 0) u.ghost -= dt;
  else {
    const fx = Math.sin(u.h), fz = Math.cos(u.h);
    for (const v of traffic) {
      const ox = v.x - u.x, oz = v.z - u.z;
      if (ox > 16 || ox < -16 || oz > 16 || oz < -16) continue;
      const ah = ox * fx + oz * fz;
      if (ah <= 0 || ah > 16 || Math.abs(-ox * fz + oz * fx) > 2.5) continue;
      vt = Math.min(vt, Math.max(0, (ah - 2.6 - v.len - 1.4) * 1.3));
    }
  }
  if (vt < u.v) u.v = Math.max(vt, u.v - 20 * dt); else u.v = Math.min(vt, u.v + 9 * dt);
  // boxed in for a while (not at a light): squeeze past
  u.stuck = u.v < 0.3 && !u.red && R.len - u.s > 2 ? u.stuck + dt : 0;
  if (u.stuck > 4) { u.ghost = 2.5; u.stuck = 0; }
  u.s = Math.min(R.len, u.s + u.v * dt);
  const q = routeAt(R, u.s);
  // with the siren: down the middle (clear of boulevard medians); without: the normal lane
  const e = R.pieces[R.seg[q[4]]].e;
  let lane = u.siren ? (e.flags.blvd ? 3.1 : Math.min(1.5, e.hw * 0.3)) : e.hw * 0.5;
  lane = lerp(R.l0, lane, smoothstep(0, 18, u.s));
  if (R.l1 !== undefined) lane = lerp(lane, R.l1, smoothstep(0, 24, 24 - (R.len - u.s)));
  u.x = damp(u.x, q[0] - q[3] * lane, 10, dt); u.z = damp(u.z, q[1] + q[2] * lane, 10, dt);
  u.h = dampAngle(u.h, Math.atan2(q[2], q[3]), 8, dt);
  return R.len - u.s < 0.5 && u.v < 0.6;
}
function startReturn(u) {
  u.call = null; u.dest = null; u.siren = false; u.t = 0;
  u.state = 'return';
  sendUnit(u, u.S.proj, false, [u.S.park.x, u.S.park.z]);
  // a unit is free again: bring back the call that has waited longest for one
  let pend = null;
  for (const c of dcalls) if (c.status === 'pending' && (!pend || c.t > pend.t)) pend = c;
  if (pend && G.state !== 'ending') queueDecision({ type: 'call', c: pend });
}
function unitStep(u, dt) {
  u.t += dt;
  u.wheel += (u.v * dt) / 0.58;
  switch (u.state) {
    case 'idle':
      u.v = 0;
      u.x = damp(u.x, u.S.park.x, 3, dt); u.z = damp(u.z, u.S.park.z, 3, dt); u.h = dampAngle(u.h, u.S.park.h, 3, dt);
      break;
    case 'toScene': if (unitDrive(u, dt)) arriveScene(u); break;
    case 'onScene': u.v = 0; if (u.t > u.sceneT) sceneReady(u); break;
    case 'boarding': u.v = 0; if (u.t > 0.9) {
      if (isDiverted(u.dest)) { u.state = 'wait'; queueDecision({ type: 'scene', c: u.call, u, divertedAt: u.dest }); break; }
      u.state = 'toHosp'; u.t = 0; sendUnit(u, u.dest.proj, true, hospBay(u.dest));
    } break;
    case 'toHosp': if (unitDrive(u, dt)) arriveHosp(u); break;
    case 'atHosp': u.v = 0; if (u.t > 4 + (u.handoff || 0)) startReturn(u); break;
    case 'linger': u.v = 0; if (u.t > 3.5) startReturn(u); break;
    case 'return': if (unitDrive(u, dt)) { u.state = 'idle'; u.route = null; } break;
    default: u.v = 0;
  }
}

// ---------- 119 calls ----------
const DPOOL = (() => {
  const w = [], kind = (c) => (c.tri === 'green' ? ((SCENE[c.id] || {}).act === 'minor' ? 'minor' : 'green') : c.tri);
  // each kind of call keeps the same share of a shift, however many different cases it has
  const share = { red: 15, yellow: 12.8, green: 6, minor: 4.8 }, n = {};
  for (const c of CASES) n[kind(c)] = (n[kind(c)] || 0) + 1;
  for (const c of CASES) w.push([c, share[kind(c)] / n[kind(c)]]);
  for (const c of DISPATCH_CASES) w.push([c, c.id === 'obvdeath' ? 2.6 : 1.6]);
  for (const n of NOCALLS) w.push([n, 1.4]);
  return w;
})();
const DPOOL_W = DPOOL.reduce((a, b) => a + b[1], 0);
// the first calls of a shift cover each kind of decision once: critical, no ambulance needed, minor, obvious death
const dCat = (c) => (c.ref ? 'none' : c.id === 'obvdeath' ? 'dead' : (SCENE[c.id] || {}).act === 'minor' ? 'minor' : c.tri === 'red' ? 'red' : 'other');
function pickDCase() {
  const cat = D.plan.shift();
  if (cat) {
    const list = DPOOL.map((q) => q[0]).filter((c) => dCat(c) === cat && !D.recent.includes(c.id));
    if (list.length) { const it = gpick(list); D.recent.push(it.id); return it; }
  }
  for (let k = 0; k < 30; k++) {
    let r = Math.random() * DPOOL_W, it = DPOOL[0][0];
    for (const [c, w] of DPOOL) { r -= w; if (r <= 0) { it = c; break; } }
    if (D.recent.includes(it.id)) continue;
    // the weather makes some calls likelier (rejection sampling against the weather's weights)
    if (WX.cur.bias && Math.random() > (WX.cur.bias[it.id] || 1) / WX.biasMax && k < 24) continue;
    // don't let critical calls pile up beyond what six units can cover
    if (it.tri === 'red' && dcalls.filter((c) => c.status !== 'done' && c.c.tri === 'red' && !c.arrivedAt).length >= (D.t < DSHIFT * 0.55 ? 4 : 3)) continue;
    D.recent.push(it.id);
    if (D.recent.length > 6) D.recent.shift();
    return it;
  }
  return gpick(NOCALLS);
}
// every district gets about the same share of calls (each has roughly as many people), the long northern ones included
function pickSpot() {
  const want = Math.floor(Math.random() * STATIONS.length);
  for (const pool of [DIST_PTS[want], spawnPts]) {
    for (let tries = 0; tries < 120; tries++) {
      const sp = gpick(pool);
      if (sp.px < DMAP_VIEW.x0 || sp.px > DMAP_VIEW.x1 || sp.pz < DMAP_VIEW.z0 || sp.pz > DMAP_VIEW.z1) continue;
      if (dcalls.some((c) => c.status !== 'done' && hypot(c.x - sp.px, c.z - sp.pz) < 70)) continue;
      if (units.some((u) => hypot(u.x - sp.px, u.z - sp.pz) < 30)) continue;
      return sp;
    }
  }
  return gpick(spawnPts);
}
// the caller waiting at the scene (a relative for an obvious death, a passer-by for calls that need no ambulance)
function makeBystander(sp, mark) {
  const ch = makeCharacter(scene, randomLook({ wave: true }), 0.95);
  ch.g.position.set(sp.px, groundHeight(sp.px, sp.pz), sp.pz);
  ch.g.rotation.y = Math.atan2(-sp.nx, -sp.nz);
  const rx = sp.x + sp.nx * Math.max(0, sp.e.hw - 3.2), rz = sp.z + sp.nz * Math.max(0, sp.e.hw - 3.2);
  const ring = makeRing(scene, mark.hex, 6.4, 0.85);
  ring.position.set(rx, groundHeight(rx, rz) + 0.08, rz);
  const beam = makeBeam(scene, mark.hex, 0.9, 30, 0.3);
  beam.position.set(sp.px, 0, sp.pz);
  const bubble = makeTimerSprite(mark.css, 'phone');
  bubble.userData.draw(1);
  bubble.position.set(sp.px, 4.8, sp.pz);
  scene.add(bubble);
  return { ch, ring, beam, bubble, ph: grand(0, TAU) };
}
function removeBystander(b) {
  if (!b) return;
  scene.remove(b.ch.g);
  if (b.ring) { scene.remove(b.ring); b.ring.geometry.dispose(); }
  if (b.beam) scene.remove(b.beam);
  if (b.bubble) { scene.remove(b.bubble); b.bubble.material.map.dispose(); b.bubble.material.dispose(); }
}
// The clock is set from the best plan open when the call comes in: the right crew from the nearest station and the
// nearest hospital that can treat them, with a margin. A basic crew for a critical patient, a far unit, a wrong
// hospital or a call left waiting will usually cost the patient. Never more than the case's old fixed time.
const DBUDGET = { red: [1.4, 8, 35], yellow: [1.7, 10, 50], green: [2.5, 10, 60] }; // margin, seconds, minimum
function fitDBudget(c) {
  const B = DBUDGET[c.c.tri];
  if (!B) return;
  const red = c.c.tri === 'red', dists = unitDistances(c.proj), free = units.filter(unitFree);
  let tA, als = red;
  if (free.length) {
    const pool = idealUnits(c, dists);
    const u = (pool.length ? pool : free).reduce((a, b) => (dists[b.i] < dists[a.i] ? b : a));
    tA = dists[u.i] / UNIT_SPEED; als = u.type === 'ALS';
  } else tA = Math.min(...dists) / UNIT_SPEED + 30; // everyone is out: wait for the first crew to clear
  const tH = hospEtaFrom(c.proj, c.c) * ETA_SPEED / HOSP_SPEED + 1;
  const care = red ? (als ? CARE.alsRed : CARE.blsRed) : CARE.other;
  const need = tA + (5 + tH) * care - (red && als ? CARE.alsBack : 0);
  if (!(need < 1e6)) return;
  c.life0 = c.life = clamp(B[0] * need + B[1], B[2], c.life0);
}
function spawnDCall(force) {
  const it = force || pickDCase();
  const sp = pickSpot();
  const c = { id: ++dcallSeq, t: 0, sp, x: sp.px, z: sp.pz, proj: { e: sp.e, s: sp.s, px: sp.x, pz: sp.z }, status: 'new', unit: null,
    rejected: new Set(), place: placeName(sp.x, sp.z) || '市區巷弄', c: it, dist: sp.dist };
  if (it.ref) { c.kind = 'none'; c.name = it.who; c.bys = makeBystander(sp, TRIAGE.none); }
  else {
    c.kind = 'patient';
    if (it.id === 'obvdeath') { c.name = patientName(it); c.life0 = c.life = 0; c.bys = makeBystander(sp, DISPATCH_MARK); }
    else { c.p = makePatient(scene, it, sp, { neutral: true }); c.name = c.p.name; c.cpr = c.p.cpr; c.life0 = c.life = c.p.life0; fitDBudget(c); }
  }
  dcalls.push(c);
  D.calls++;
  sfx.call();
  queueDecision({ type: 'call', c });
}
function cleanupCall(c) {
  if (c.p && patients.includes(c.p)) removePatient(scene, c.p);
  removeBystander(c.bys); c.bys = null;
}
function finishCall(c, outcome, extra = {}) {
  c.status = 'done'; c.doneT = 0; c.outcome = outcome;
  logCase({ c: c.c, name: c.name, cpr: c.cpr }, outcome, extra.hosp || null, extra);
  removeBystander(c.bys); c.bys = null;
}
const dScore = (n) => { D.score = Math.max(0, D.score + n); };
const dDecision = (ok) => { D.dec++; if (ok) D.ok++; };

// ---------- decisions ----------
// now: the player asked for it (opens at once); otherwise wait a moment after the last one closed
function queueDecision(d, front, now) {
  if (DQ.some((q) => q.c === d.c && q.type === d.type)) return;
  if (front) DQ.unshift(d); else DQ.push(d);
  if (!dcur && (now || D.hold <= 0)) nextDecision();
}
function nextDecision() {
  dcur = DQ.shift() || null;
  if (!dcur) { UI.dpanel.hidden = true; return; }
  if (dcur.c.status === 'done' || (dcur.type === 'call' && dcur.c.status !== 'new' && dcur.c.status !== 'pending')) { nextDecision(); return; }
  if (G.state === 'play') G.state = 'dchoose';
  if (dcur.type === 'call') renderCallDecision(dcur); else renderSceneDecision(dcur);
  UI.dpanel.hidden = false;
  UI.dpanel.scrollTop = 0;
  UI.dpanel.classList.remove('pop'); void UI.dpanel.offsetWidth; UI.dpanel.classList.add('pop');
  applyViewOffset();
  sfx.panel();
}
// real-time mode: the open decision keeps up with the world (waiting time, free units, a call that ended)
function refreshDecision() {
  if (!dcur) return;
  if (dcur.c.status === 'done') { closeDecision(); return; }
  const st = UI.dpanel.scrollTop;
  if (dcur.type === 'call') renderCallDecision(dcur); else renderSceneDecision(dcur);
  UI.dpanel.scrollTop = st;
}
function closeDecision() {
  UI.dpanel.hidden = true; dcur = null;
  D.hold = 1.3; // a moment to read the feedback before the next system-raised decision
  if (G.state === 'dchoose') G.state = 'play';
  applyViewOffset();
}
function unitDistances(to) { return units.map((u) => { const D0 = dijkstra(nearestOnRoads(u.x, u.z, (e) => !e.flags.campus && !e.flags.alley), true); return routeCost(D0, to); }); }
function idealUnits(c, dists) {
  const avail = units.filter(unitFree);
  if (!avail.length) return [];
  const L = (u) => dists[u.i];
  const minL = Math.min(...avail.map(L));
  let pool;
  if (c.c.tri === 'red') { const als = avail.filter((u) => u.type === 'ALS' && L(u) <= minL * 1.35 + 70); pool = als.length ? als : avail; }
  else { const bls = avail.filter((u) => u.type === 'BLS' && L(u) <= minL * 1.25 + 50); pool = bls.length ? bls : avail; }
  const m = Math.min(...pool.map(L));
  return pool.filter((u) => L(u) <= m * 1.12 + 25);
}
function unitNote(c, u) {
  const best = c.idealU[0];
  if (!best || c.idealU.includes(u)) return '';
  if (c.c.tri === 'red' && u.type === 'BLS' && best.type === 'ALS') return `危急病人優先派高級救護車，${best.name}也趕得到。`;
  if (c.c.tri !== 'red' && u.type === 'ALS' && best.type === 'BLS') return `這位不是危急病人，派一般救護車 ${best.name} 就好，把高級救護留給危急的人。`;
  return `${best.name}離得比較近。`;
}
function dispatchUnit(c, u) {
  if (!unitFree(u) || c.status === 'done') return;
  if (c.kind === 'patient') {
    const ideal = c.idealU.includes(u);
    // choosing the unit is part of the judgement: the right type, close enough
    dDecision(ideal || !c.idealU.length);
    dScore(40 + (ideal ? 30 : 0));
    c.unitNote = unitNote(c, u);
    c.missedALS = c.c.tri === 'red' && u.type === 'BLS' && c.idealU.some((q) => q.type === 'ALS');
    // a cardiac arrest with nobody doing CPR: the dispatcher should have coached CPR on the phone
    if (c.c.id === 'ohca' && !c.cpr) { c.missedDA = true; dDecision(false); }
    toast(`${u.name} ${u.i !== c.dist ? '跨區' : ''}出勤！`, `+${40 + (ideal ? 30 : 0)}`, false, UNIT_TYPES[u.type].css);
  } else {
    dDecision(false);
    toast(`${u.name} 出勤！`, '', false, UNIT_TYPES[u.type].css);
  }
  u.call = c; c.unit = u; c.status = 'assigned'; c.sentAt = c.t;
  // another district's crew: the call's own one was busy (or the dispatcher chose so)
  const homeU = units[c.dist];
  if (c.kind === 'patient' && homeU && homeU !== u) {
    D.xdN++;
    if (!unitFree(homeU)) c.xdNote = `${distName(c.dist)}的${homeU.name}正在${U_TXT[homeU.state]}，只能跨區調派${u.name}，路程比較遠。`;
  }
  u.state = 'toScene'; u.t = 0;
  sendUnit(u, c.proj, true, sceneKerb(c.sp));
  focusUnit(u);
  sfx.choose();
  closeDecision();
}
function noDispatch(c, ref) {
  if (c.kind === 'none') {
    const right = c.c.ref === ref;
    dDecision(true);
    dScore(40 + (right ? 30 : 0));
    sfx.choose();
    showCaseCard({ chip: TRIAGE.none, title: '不需派車', pts: `+${40 + (right ? 30 : 0)}`, name: c.c.short, dx: REFERRALS[c.c.ref].name, why: c.c.why,
      note: right ? '' : `這通應該選「${REFERRALS[c.c.ref].name}」。`, plus: right ? '判斷正確，也轉介給對的單位！' : '' }, 0);
    finishCall(c, 'nodispatch', { ideal: right, note: right ? '' : `應該${REFERRALS[c.c.ref].name}。` });
    closeDecision();
  } else {
    dDecision(false);
    dScore(-60);
    sfx.reject();
    c.mustDispatch = true;
    showCaseCard({ chip: { name: '需要派車', css: '#e0413a' }, title: '這通要派救護車！', pts: '−60', name: c.c.short, dx: '民眾描述有緊急狀況',
      why: c.c.id === 'obvdeath' ? '民眾沒辦法自己確認是否已經死亡，還是要派救護人員到場判斷。' : `「${c.c.signs.join('、')}」需要救護人員到場評估。有疑慮時，一律派車。`, bad: true }, 0);
    renderCallDecision(dcur);
  }
}
function later(c) { c.status = 'pending'; closeDecision(); }
// the first two questions of every 119 call: conscious? breathing normally?
function askCall(c) {
  if (c.asked) return;
  c.asked = true;
  sfx.pop();
  renderCallDecision(dcur);
}
// "press hard and fast in the centre of the chest": a bystander starts CPR under the dispatcher's guidance
function phoneCPR(c) {
  if (c.daDone) return;
  c.daDone = true;
  if (c.c.id === 'obvdeath') {
    dScore(-10);
    showCaseCard({ chip: TRIAGE.black, title: '不需要線上 CPR', pts: '−10', name: c.c.short, dx: '已有明顯死亡徵象',
      why: '身體已經冰冷、僵硬，是明顯死亡的徵象，不需要指導 CPR；但民眾無法確認死亡，仍要派救護人員到場判斷。', bad: true }, 0);
    renderCallDecision(dcur);
    return;
  }
  dDecision(true); dScore(40); sfx.choose();
  const p = c.p;
  c.cpr = true; c.daCPR = true;
  if (p && !p.cpr) {
    p.cpr = true; c.life += 25; c.life0 += 25;
    // the caller kneels down and starts compressions
    if (p.comp) {
      const cm = p.comp;
      cm.kind = 'cpr'; setPose(cm.ch, 'kneel');
      cm.x = p.x - p.tx * 0.7 + p.nx * 1.7; cm.z = p.z - p.tz * 0.7 + p.nz * 1.7; cm.h = Math.atan2(-p.nx, -p.nz);
    }
  }
  toast('線上 CPR 指導：民眾開始壓胸！', '+40', false, '#3a86e0');
  award('dacpr');
  renderCallDecision(dcur);
}
// how fast a patient's clock runs once a crew is with them (1 = no better than waiting), and the penalty for a wrong hospital
const CARE = { alsRed: 0.6, blsRed: 1, other: 0.75, alsBack: 15, reject: 20 };
function arriveScene(u) {
  const c = u.call;
  u.state = 'onScene'; u.t = 0; u.siren = false;
  c.status = 'onscene'; c.arrivedAt = c.t;
  u.sceneT = c.kind === 'none' ? 2.5 : 5;
  if (c.kind === 'patient') {
    D.resp.push(c.t);
    // treatment on scene slows the clock, but only so much: a critical patient needs the drugs and airway care
    // only ALS carries; with a basic crew they keep getting worse at full speed
    const red = c.c.tri === 'red', als = u.type === 'ALS';
    c.care = red ? (als ? CARE.alsRed : CARE.blsRed) : CARE.other;
    if (red && als) c.life = Math.min(c.life0, c.life + CARE.alsBack); // ALS buys back a little time, up to how they were at the call
  }
  if (dsel === u) toast(`${u.name} 到達現場`, '', false, UNIT_TYPES[u.type].css);
}
function sceneReady(u) {
  const c = u.call;
  if (c.kind === 'none') {
    dScore(-50);
    showCaseCard({ chip: TRIAGE.none, title: '救護車白跑一趟', pts: '−50', name: c.c.short, dx: REFERRALS[c.c.ref].name, why: c.c.why,
      note: '這通不需要派救護車。車子被佔用時，真正危急的人可能等不到車。', bad: true }, 0);
    finishCall(c, 'wasted', { note: '不需要派車的電話卻派了車。' });
    startReturn(u);
    return;
  }
  u.state = 'wait';
  c.evalH = evaluateChoices({ c: c.c, proj: c.proj }, u.i);
  queueDecision({ type: 'scene', c, u });
}
function chooseTransport(c, u, H) {
  const act = (SCENE[c.c.id] || {}).act || 'go';
  if (c.rejected.has(H.id) || isDiverted(H)) return;
  if (act === 'dead') {
    dDecision(false); dScore(-60); sfx.reject();
    showCaseCard({ chip: TRIAGE.black, title: '明顯死亡不需送醫', pts: '−60', name: c.name, dx: c.c.dx, why: c.c.why, bad: true }, 0);
    finishCall(c, 'deadscene', { note: '明顯死亡不送醫，應通報警方。' });
    u.state = 'linger'; u.t = 0;
    closeDecision();
    return;
  }
  if (!c.decidedGo) {
    if (act === 'minor') { dDecision(false); c.minorNote = '這位是明顯輕症，可以現場處置、建議自行就醫，把救護車留給危急的人。'; }
    else { dDecision(true); dScore(40); }
    c.decidedGo = true;
  }
  c.dest = H; u.dest = H; c.status = 'transport';
  focusUnit(u);
  const p = c.p;
  if (p && p.state === 'wait') {
    removePatientVisuals(scene, p);
    p.state = 'board'; p.t = 0; p.bx = p.x; p.bz = p.z; p.boardTo = u;
    if (p.comp) { p.comp.bx = p.comp.x; p.comp.bz = p.comp.z; }
    u.state = 'boarding'; u.t = 0;
  } else { u.state = 'toHosp'; u.t = 0; sendUnit(u, H.proj, true, hospBay(H)); }
  sfx.choose();
  closeDecision();
}
function chooseNoTransport(c, u, kind) {
  const act = (SCENE[c.c.id] || {}).act || 'go';
  if (act === 'go') {
    dDecision(false); dScore(-100); sfx.reject();
    c.mustGo = true;
    showCaseCard({ chip: { name: '需要送醫', css: '#e0413a' }, title: '這位病人需要送醫！', pts: '−100', name: c.name, dx: c.c.dx, why: (SCENE[c.c.id] || {}).rep || c.c.why, bad: true }, 0);
    renderSceneDecision(dcur);
    return;
  }
  const right = act === kind;
  dDecision(right); dScore(right ? 60 : -40);
  sfx.choose();
  if (act === 'dead') {
    showCaseCard({ chip: TRIAGE.black, title: '明顯死亡，不送醫', pts: right ? '+60' : '−40', name: c.name, dx: c.c.dx, why: c.c.why,
      plus: right ? '判斷正確，救護人員陪伴家屬並通報警方。' : '', note: right ? '' : '這位已明顯死亡，應選「明顯死亡：通報警方」。' }, 0);
    finishCall(c, 'deadscene', { ideal: right });
  } else {
    showCaseCard({ chip: TRIAGE.green, title: '現場處置，不需送醫', pts: right ? '+60' : '−40', name: c.name, dx: c.c.dx, why: c.c.why,
      plus: right ? '判斷正確！救護車可以馬上去幫下一個人。' : '', note: right ? '' : '這位是明顯輕症，不是明顯死亡。' }, 0);
    if (c.p) { removePatientVisuals(scene, c.p); c.p.state = 'gone'; c.p.t = 0; }
    D.saved++;
    finishCall(c, 'notransport', { ideal: right });
  }
  u.state = 'linger'; u.t = 0;
  closeDecision();
}
function arriveHosp(u) {
  const c = u.call, H = u.dest;
  u.siren = false;
  if (!c || c.status === 'done') { u.state = 'atHosp'; u.t = 0; u.handoff = 0; return; }
  if (isDiverted(H)) { u.state = 'wait'; queueDecision({ type: 'scene', c, u, divertedAt: H }); return; }
  if (!accepts(H, c.c)) {
    c.rejected.add(H.id);
    dDecision(false); dScore(-20); sfx.reject();
    tally('reject', 3, 'transfer');
    c.life -= CARE.reject; // transfer delay on top of the extra drive
    toast(H.noER ? `${H.name}：不收 119 急診！病人 −${CARE.reject} 秒` : `${H.name}：需要轉院！病人 −${CARE.reject} 秒`, '−20', true);
    if (H.noER) award('pilgrim');
    u.state = 'wait';
    if (c.c.tri !== 'green' && c.life <= 0) { dLifeStep(c, 0); return; }
    queueDecision({ type: 'scene', c, u, rejectedAt: H });
    return;
  }
  // a crowded ER keeps the crew waiting with the patient until a bed frees up
  const wait = erWait(H);
  D.waitSum += wait;
  if (wait >= 2) D.waitN++;
  D.hn++;
  const first = c.rejected.size === 0, minor = !!c.minorNote;
  const ideal = first && !minor && !!c.evalH && c.evalH.ideal.includes(HOSPITALS.indexOf(H));
  if (first && !minor) dDecision(ideal);
  const fast = !minor && c.arrivedAt !== undefined && c.arrivedAt < 30;
  // how the patient arrives counts: time left on their clock, which fast response and ALS care protect.
  // An unnecessary transport earns little: the ambulance was tied up for nothing.
  const cond = c.c.tri === 'green' ? 1 : clamp(c.life / c.life0, 0, 1);
  const pts = Math.round((minor ? 20 : 50 + Math.round(100 * cond) + (ideal ? 40 : 0) + (fast ? 20 : 0)) * WX.cur.bonus * JAM.T.bonus);
  dScore(pts);
  D.saved++;
  let note = c.minorNote || (first ? (ideal ? '' : idealNote({ c: c.c, eval: c.evalH }, H)) : '第一次送錯醫院，轉院浪費了寶貴的時間。');
  if (c.unitNote) note = (note ? note + ' ' : '') + c.unitNote;
  if (c.missedDA) note = (note ? note + ' ' : '') + '心跳停止的報案，要先確認意識和呼吸，並在電話中指導民眾 CPR。';
  if (wait >= 4) note = (note ? note + ' ' : '') + `${H.name}急診壅塞，${u.name}要等床 ${wait} 秒才能離開，這段時間沒辦法出勤。`;
  if (c.xdNote && c.arrivedAt > 30) note = (note ? note + ' ' : '') + c.xdNote;
  showCaseCard({ chip: TRIAGE[c.c.tri], title: minor ? '送達（其實不需送醫）' : `順利送達・病人狀況 ${Math.round(cond * 100)}%`, pts: `+${pts}`, name: c.name, dx: c.c.dx, why: c.c.why, note,
    plus: fast ? `報案後 ${Math.round(c.arrivedAt)} 秒就到場，非常快！` : ideal ? '選得好！這是最適合的醫院。' : '' }, 0);
  if (c.p) addWalker(scene, c.p.look, H.signPos[0], H.signPos[2], !!c.c.kid, u);
  if (dsel === u) confetti(H.drop[0], 3, H.drop[1], [H.css, '#ffffff', '#f2c14e', '#7cc4e8'], 50);
  sfx.deliver(1);
  if (c.c.id === 'ohca' && !minor) award('ohca');
  finishCall(c, minor ? 'overtx' : 'saved', { hosp: H, ideal, note, wait });
  erAdmit(H, c.c);
  if (c.c.tri === 'green' && H.level === 'severe') tally('greenSevere', 3, 'bigname');
  u.state = 'atHosp'; u.t = 0; u.handoff = wait;
}
function dLifeStep(c, dt) {
  if (c.kind !== 'patient' || c.status === 'done' || !c.life0) return;
  // until a crew is there: an arrest with nobody doing CPR uses its time up 1.5x as fast (phone CPR fixes that)
  c.life -= dt * (c.care || (c.c.id === 'ohca' && !c.cpr ? 1.5 : 1));
  if (c.life > 0) return;
  const u = c.unit;
  if (c.c.tri === 'green') {
    toast(`#${c.id} ${c.name}：家屬自行送醫了`, '');
    if (c.p && c.p.state === 'wait') { removePatientVisuals(scene, c.p); c.p.state = 'gone'; c.p.t = 0; }
    finishCall(c, 'left', { note: '輕症病人等太久，家屬自行送醫了。' });
    if (u && u.state === 'toScene') startReturn(u);
    return;
  }
  D.dead++; dScore(-60); sfx.sad();
  let note = !u ? '這通一直沒有派車。危急的報案要優先處理！' : c.status === 'assigned' ? '救護車還在路上。危急病人要派最近、有空的車。'
    : c.rejected.size ? '送到不能處理的醫院，轉院耽誤了太多時間。' : '送醫途中來不及了。要選近又能處理的醫院。';
  if (c.xdNote && (!u || c.status === 'assigned' || c.arrivedAt > 30)) note += ' ' + c.xdNote;
  if (c.missedDA) note += ' 也別忘了在電話中指導民眾 CPR，能多爭取時間。';
  else if (c.missedALS) note += ' 危急病人優先派高級救護，到院前就能給藥、處理呼吸道。';
  showCaseCard({ chip: TRIAGE[c.c.tri], title: '不幸過世', pts: '−60', name: c.name, dx: c.c.dx, why: c.c.why, note, bad: true }, 0);
  if (c.p && c.p.state === 'wait') { removePatientVisuals(scene, c.p); c.p.state = 'gone'; c.p.t = 0; }
  finishCall(c, 'dead', { note });
  if (u && (u.state === 'toScene' || u.state === 'onScene' || u.state === 'wait')) startReturn(u);
}

// ---------- per frame ----------
// calls come faster as the shift goes on: a quiet start, then rush hour
function nextCallGap() {
  const prog = clamp((DSHIFT - D.t) / DSHIFT, 0, 1);
  return lerp(13, 7, smoothstep(0.2, 0.75, prog)) + grand(-2, 2);
}
function dispatchStep(dt) {
  D.hold -= dt / D.speed;
  if (!dcur && DQ.length && D.hold <= 0) { nextDecision(); if (G.state !== 'play') return; }
  D.t -= dt;
  D.callT -= dt;
  const elapsed = DSHIFT - D.t;
  if (!D.rushSaid && elapsed > DSHIFT * 0.3) { D.rushSaid = true; toast('下班尖峰時段：報案越來越多了！', '', true); }
  // several calls at once (a crash with two injured, a busy evening): someone will have to wait
  if (D.bursts.length && elapsed >= D.bursts[0]) {
    D.bursts.shift();
    const open = dcalls.filter((c) => c.status !== 'done').length;
    if (open < 9) { bigMsg('同時湧入多通報案！', '先處理最危急的', 1.6); D.plan.unshift('red'); spawnDCall(); spawnDCall(); D.callT = Math.max(D.callT, 7); }
  }
  if (D.callT <= 0) {
    const open = dcalls.filter((c) => c.status !== 'done');
    if (open.length < 10) spawnDCall();
    D.callT = nextCallGap() + open.filter((c) => c.status === 'pending').length * 2;
  }
  erStep(dt, onDivertDispatch);
  for (const c of dcalls) {
    c.t += dt;
    if (c.status === 'done') { c.doneT += dt; continue; }
    dLifeStep(c, dt);
    if (c.kind === 'none' && c.status === 'pending' && c.t > 50) { dDecision(false); finishCall(c, 'hungup', { note: '這通沒有及時處理，民眾掛斷了。' }); }
  }
  for (let i = dcalls.length - 1; i >= 0; i--) if (dcalls[i].status === 'done' && dcalls[i].doneT > 8) dcalls.splice(i, 1);
  for (const u of units) unitStep(u, dt);
  if (D.t <= 0 && (G.state === 'play' || G.state === 'dchoose')) { D.t = 0; endGame(); }
}
// a hospital went on diversion: every ambulance driving there needs a new destination
function onDivertDispatch(H) {
  for (const u of units) {
    if (u.state !== 'toHosp' || u.dest !== H) continue;
    u.state = 'wait'; u.route = null; u.siren = false;
    queueDecision({ type: 'scene', c: u.call, u, divertedAt: H });
  }
}
function dispatchRender(t) {
  const on = G.mode === 'dispatch' && G.state !== 'title' && G.state !== 'brief';
  if (!on && !units.some((u) => u.m.g.visible)) return;
  for (const u of units) {
    const m = u.m;
    m.g.visible = on; u.label.visible = on;
    if (!on) continue;
    m.g.position.set(u.x, groundHeight(u.x, u.z), u.z);
    m.g.rotation.y = u.h;
    for (const w of m.wheels) w.rotation.x = u.wheel;
    u.label.position.set(u.x, 7.6, u.z);
    const busy = u.state !== 'idle' && u.state !== 'return';
    const ph = Math.floor(t * 6 + u.i * 0.5) % 2;
    m.lights[0].color.setHex(busy ? (ph ? 0xff4a3d : 0x7a2020) : 0x8a2a24);
    m.lights[1].color.setHex(busy ? (ph ? 0x23409a : 0x4f8dff) : 0x2a4588);
  }
  if (!on) return;
  for (const c of dcalls) if (c.bys) {
    const b = c.bys;
    if (b.ch.arm) b.ch.arm.rotation.z = 0.5 + Math.sin(t * 8 + b.ph) * 0.45;
    const s = 1 + Math.sin(t * 3 + b.ph) * 0.05;
    b.ring.scale.set(s, s, 1);
    b.bubble.position.y = 4.8 + Math.sin(t * 2.4 + b.ph) * 0.25;
  }
}
function clearDispatch() {
  for (const c of dcalls) cleanupCall(c);
  dcalls.length = 0; DQ.length = 0; dcur = null;
  if (UI.dpanel) UI.dpanel.hidden = true;
  for (const u of units) { u.m.g.visible = false; u.label.visible = false; u.state = 'idle'; u.call = null; u.dest = null; u.route = null; u.siren = false; u.v = 0; u.x = u.S.park.x; u.z = u.S.park.z; u.h = u.S.park.h; }
}
function resetDispatch() {
  clearDispatch();
  const mix = Math.random() < 0.5 ? ['none', 'minor'] : ['minor', 'none'];
  Object.assign(D, { plan: ['red', mix[0], 'other', mix[1], 'dead'], t: DSHIFT, callT: 3.6, score: 0, calls: 0, dec: 0, ok: 0, resp: [], saved: 0, dead: 0, speed: 1, recent: [], hold: 0,
    bursts: [grand(100, 120), grand(200, 225)], rushSaid: false, refreshT: 0, waitSum: 0, waitN: 0, hn: 0, xdN: 0, fqN: 0, prioN: 0, prioOk: 0 });
  resetER(60);
  Object.assign(DVIEW, DMAP_VIEW);
  dsel = units[0];
}

// ---------- dispatch console: decision panel ----------
function initDispatchUI() {
  for (const id of ['dhud', 'dtop', 'dsheet', 'dTime', 'dScore', 'dTally', 'dSpeed', 'dPause', 'dmap', 'dUnits', 'dCalls', 'dpanel', 'dpTag', 'dpTitle', 'dpSub', 'dpAlert',
    'dpQuote', 'dpSigns', 'dpPre', 'dpQ', 'dpRows', 'dpAlt', 'dpFoot', 'dispBtn', 'dbrief', 'dUnitsBrief', 'briefTitle', 'briefLead', 'briefMapTitle', 'rtMode']) UI[id] = $(id);
  UI.rtMode.checked = !!G.rt;
  UI.rtMode.addEventListener('change', () => { G.rt = UI.rtMode.checked; saveState(); });
  UI.dispBtn.addEventListener('click', () => showBriefing('dispatch'));
  UI.dUnitsBrief.innerHTML = STATIONS.map((S, i) => {
    const T = UNIT_TYPES[S.type];
    return `<div class="bunit" style="--uc:${T.css}"><span class="un">${i + 1}</span><div><b>${S.unit}</b><span class="ty">${T.name}</span><small>${S.name}救護站</small></div></div>`;
  }).join('');
  UI.dpRows.addEventListener('click', (e) => {
    const b = e.target.closest('.drow');
    if (!b || b.disabled || !dcur) return;
    if (dcur.type === 'call' && b.dataset.u !== undefined) dispatchUnit(dcur.c, units[+b.dataset.u]);
    else if (dcur.type === 'scene' && b.dataset.h !== undefined) chooseTransport(dcur.c, dcur.u, HOSPITALS[+b.dataset.h]);
  });
  UI.dpanel.addEventListener('click', (e) => {
    const b = e.target.closest('.altb');
    if (!b || !dcur) return;
    if (b.dataset.ref) noDispatch(dcur.c, b.dataset.ref);
    else if (b.dataset.ask) askCall(dcur.c);
    else if (b.dataset.da) phoneCPR(dcur.c);
    else if (b.dataset.fq) askFollow(dcur.c, +b.dataset.fq);
    else if (b.dataset.prio) judgePriority(dcur.c, b.dataset.prio);
    else if (b.dataset.later) later(dcur.c);
    else if (b.dataset.nt) chooseNoTransport(dcur.c, dcur.u, b.dataset.nt);
  });
  UI.dUnits.addEventListener('click', (e) => { const b = e.target.closest('.ucard'); if (b) focusUnit(units[+b.dataset.u]); });
  UI.dCalls.addEventListener('click', (e) => {
    const b = e.target.closest('.crow[data-c]');
    if (!b || G.state !== 'play') return;
    const c = dcalls.find((q) => q.id === +b.dataset.c);
    if (!c) return;
    if (c.status === 'pending') queueDecision({ type: 'call', c }, true, true);
    else if (c.unit) focusUnit(c.unit);
  });
  UI.dmap.addEventListener('click', onDMapClick);
  UI.dSpeed.addEventListener('click', () => { D.speed = D.speed >= 3 ? 1 : D.speed + 1; UI.dSpeed.textContent = `速度 ×${D.speed}`; });
  UI.dPause.addEventListener('click', () => pauseGame());
}
function dispatchKey(n) {
  if (!dcur) return;
  if (dcur.type === 'call' && n <= units.length) { const u = units[n - 1]; if (unitFree(u)) dispatchUnit(dcur.c, u); }
  else if (dcur.type === 'scene' && n <= HOSPITALS.length) chooseTransport(dcur.c, dcur.u, HOSPITALS[n - 1]);
}
function renderCallDecision(d) {
  const c = d.c;
  UI.dpTag.textContent = `119 報案 #${c.id}`;
  UI.dpTag.style.background = '#e23b33';
  UI.dpTitle.textContent = c.place;
  UI.dpSub.textContent = `${distName(c.dist)} · ${c.c.who}來電 · 已等候 ${fmtT(c.t)}`;
  // the call's own district may have no free crew left (空窗): help has to come from further away
  const gap = c.kind === 'patient' && !c.mustDispatch && !districtCovered(c.dist) && units.some(unitFree);
  UI.dpAlert.hidden = !c.mustDispatch && !gap;
  UI.dpAlert.textContent = c.mustDispatch ? '這通電話需要派救護車，請選一台有空的車出勤。' : `${distName(c.dist)}的救護車都在忙（空窗），只能從別區調車。`;
  UI.dpQuote.innerHTML = `<span class="who">${c.c.who}：</span>「${c.c.say}」`;
  UI.dpSigns.innerHTML = c.kind === 'patient' ? c.c.signs.map((s) => `<span>${s}</span>`).join('') : '';
  UI.dpSigns.hidden = c.kind !== 'patient';
  UI.dpQ.textContent = '要派哪一台救護車？';
  const dists = unitDistances(c.proj);
  c.idealU = c.kind === 'patient' ? idealUnits(c, dists) : [];
  UI.dpRows.innerHTML = units.map((u, i) => {
    const free = unitFree(u), T = UNIT_TYPES[u.type];
    const dist = free ? dEta(dists[i], UNIT_SPEED) : '<b>忙碌中</b><small>無法派遣</small>';
    return `<button class="drow urow${free ? '' : ' no'}" type="button" data-u="${i}" style="--hc:${T.css}"${free ? '' : ' disabled'}>`
      + `<span class="num">${i + 1}</span><span class="hn"><b>${u.name}</b><em>${T.name}${c.prio && free && (c.prio === 'red') === (u.type === 'ALS') ? '・建議' : ''}</em></span>`
      + `<span class="meta"><span class="lv" style="--lc:${U_CSS[u.state]}">${U_TXT[u.state]}</span>${u.call ? `<small class="mini">報案 #${u.call.id}</small>` : free && u.i !== c.dist ? '<small class="mini xd">跨區</small>' : ''}</span>`
      + `<span class="dist">${dist}</span></button>`;
  }).join('');
  const anyFree = units.some(unitFree);
  UI.dpPre.innerHTML = c.kind === 'patient' ? askHTML(c) : '';
  UI.dpAlt.innerHTML = (c.mustDispatch ? '' : `<div class="alt-h">不需要派救護車？</div><div class="alt-g">${Object.entries(REFERRALS).map(([k, r]) => `<button class="altb" type="button" data-ref="${k}">${r.name}</button>`).join('')}</div>`)
    + `<button class="altb later" type="button" data-later="1">${anyFree ? '稍後再派（先處理別的事）' : '目前沒有空車，稍後再派'}</button>`;
  UI.dpFoot.textContent = D.realtime ? '即時模式：時間仍在流逝（0.3 倍）' : isTouch ? '遊戲暫停中，慢慢判斷' : `遊戲暫停中 · 按 1–${units.length} 派車`;
}
// "有沒有意識？有沒有正常呼吸？" — and when the answer is no and no, coach CPR over the phone
function askHTML(c) {
  const A = ASK[c.c.id] || ['清醒', '正常'];
  if (!c.asked) return '<div class="alt-h">先問兩個關鍵問題</div><button class="altb ask" type="button" data-ask="1">問：病人有沒有意識？有沒有正常呼吸？</button>';
  const bad = (t) => /沒有|不清|想睡|混亂|昏/.test(t);
  let h = `<div class="alt-h">民眾回答</div><div class="answers"><span class="${bad(A[0]) ? 'bad' : ''}">意識：${A[0]}</span><span class="${bad(A[1]) ? 'bad' : ''}">呼吸：${A[1]}</span>`;
  const arrest = c.c.id === 'ohca' || c.c.id === 'obvdeath';
  if (arrest && c.p && c.p.cpr && !c.daCPR) h += '<span class="ok">旁邊的路人正在做 CPR</span>';
  h += '</div>';
  if (arrest && !(c.p && c.p.cpr && !c.daCPR)) {
    h += c.daDone ? (c.daCPR ? '<div class="da-on">線上 CPR 指導中：民眾正在用力、快速地壓胸</div>' : '')
      : '<button class="altb da" type="button" data-da="1">開始線上 CPR 指導（在電話中教民眾壓胸）</button>';
  }
  return h + followHTML(c);
}
// ---------- the follow-up questions for the complaint, then the dispatcher's call: how urgent is it? ----------
function followHTML(c) {
  const F = FOLLOW[c.c.id];
  if (!F || !c.asked) return '';
  const P = PROTOCOLS[F[0]];
  c.fq = c.fq || [];
  let h = `<div class="alt-h">追問（${P.name}）</div><div class="fqs">`;
  P.q.forEach((q, i) => {
    if (c.fq.includes(i)) { const a = F[i + 1], bad = a[0] === '!'; h += `<div class="fqa${bad ? ' bad' : ''}"><i>${q}</i><b>${bad ? a.slice(1) : a}</b></div>`; }
    else h += `<button class="altb fq" type="button" data-fq="${i}">問：${q}</button>`;
  });
  h += '</div>';
  // the judgement: red goes to an advanced crew; yellow and green to the nearest basic one
  const P3 = [['red', '危急'], ['yellow', '緊急'], ['green', '輕症']];
  if (!c.prio) h += `<div class="alt-h">判斷緊急程度</div><div class="alt-g prio">${P3.map(([k, n]) => `<button class="altb pr" type="button" data-prio="${k}" style="--pc:${TRIAGE[k].css}">${n}</button>`).join('')}</div>`;
  else {
    const ok = c.prio === c.c.tri;
    h += `<div class="prio-res ${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✘'} 你判斷「${TRIAGE[c.prio].name}」${ok ? '' : `，其實是「${TRIAGE[c.c.tri].name}」`}：${c.c.tri === 'red' ? '優先派高級救護（ALS）' : '派最近的一般救護（BLS）就好'}。</div>`;
  }
  return h;
}
function askFollow(c, i) {
  c.fq = c.fq || [];
  if (c.fq.includes(i)) return;
  c.fq.push(i);
  D.fqN = (D.fqN || 0) + 1;
  sfx.pop();
  renderCallDecision(dcur);
}
// the priority, judged from what the caller said: a few points for the right call, a lesson for the wrong one
function judgePriority(c, k) {
  if (c.prio) return;
  c.prio = k;
  const ok = k === c.c.tri, asked = (c.fq || []).length;
  D.prioN = (D.prioN || 0) + 1;
  if (ok) { D.prioOk = (D.prioOk || 0) + 1; dScore(asked ? 30 : 20); toast(`判斷正確：${TRIAGE[k].name}`, `+${asked ? 30 : 20}`, false, TRIAGE[k].css); sfx.choose(); }
  else {
    dScore(-20);
    const flags = (FOLLOW[c.c.id] || []).slice(1).filter((a) => a[0] === '!').map((a) => a.slice(1));
    toast(`其實是「${TRIAGE[c.c.tri].name}」${flags.length ? `：${flags[0]}` : ''}`, '−20', true);
    sfx.wrong();
  }
  if (D.prioOk >= 8 && D.prioOk === D.prioN) award('askwell');
  renderCallDecision(dcur);
}
function renderSceneDecision(d) {
  const c = d.c, u = d.u, sc = SCENE[c.c.id] || { rep: c.c.say, vit: [], act: 'go' };
  UI.dpTag.textContent = `現場回報 · ${u.name}`;
  UI.dpTag.style.background = UNIT_TYPES[u.type].css;
  UI.dpTitle.textContent = c.name;
  UI.dpSub.textContent = `報案 #${c.id} · ${c.place}`;
  const alert = d.rejectedAt ? `<b>${d.rejectedAt.name}</b>：${rejectReason(d.rejectedAt, c.c)}請改送其他醫院。`
    : d.divertedAt ? `<b>${d.divertedAt.name}</b> 急診滿床，暫停收治。請改送其他醫院。` : c.mustGo ? '這位病人需要送醫，請選擇醫院。' : '';
  UI.dpAlert.hidden = !alert;
  UI.dpAlert.innerHTML = alert;
  UI.dpQuote.innerHTML = `<span class="who">救護人員：</span>「${sc.rep}」`;
  const vit = (sc.vit || []).slice();
  if (c.c.cpr) vit.push(c.cpr ? '路人有先做 CPR' : '沒有人做 CPR');
  UI.dpSigns.innerHTML = vit.map((v) => `<span>${v}</span>`).join('');
  UI.dpSigns.hidden = !vit.length;
  UI.dpQ.textContent = c.decidedGo ? '改送哪一家醫院？' : '需要送醫的話，送哪一家醫院？';
  const D0 = dijkstra(nearestOnRoads(u.x, u.z, (e) => !e.flags.campus && !e.flags.alley), true);
  const dists = HOSPITALS.map((H) => routeCost(D0, H.proj));
  const shut = (H) => c.rejected.has(H.id) || isDiverted(H);
  const order = HOSPITALS.map((H, i) => i).sort((a, b) => shut(HOSPITALS[a]) - shut(HOSPITALS[b]) || dists[a] - dists[b]);
  UI.dpRows.innerHTML = order.map((i) => {
    const H = HOSPITALS[i], lv = LEVELS[H.level], full = isDiverted(H), no = c.rejected.has(H.id) || full;
    const note = [hospNote(H), farFromHome(H, u.i) ? '跨區' : ''].filter(Boolean).join('・');
    const dist = full ? '<b>滿床</b><small>暫停收治</small>' : no ? '<b>拒收</b><small>需要轉院</small>' : etaWaitHTML(dists[i] / HOSP_SPEED + 1, H);
    return `<button class="drow${no ? ' no' : ''}" type="button" data-h="${i}" style="--hc:${H.css}"${no ? ' disabled' : ''}>`
      + `<span class="num">${i + 1}</span><span class="hn"><b>${H.name}</b>${note ? `<em>${note}</em>` : ''}</span>`
      + `<span class="meta"><span class="lv" style="--lc:${lv.color}">${lv.name}</span>${no ? '' : erChipHTML(H)}${capIconsHTML(H)}</span>`
      + `<span class="dist">${dist}</span></button>`;
  }).join('');
  // first question: does this patient need to go to hospital at all?
  UI.dpPre.innerHTML = (c.mustGo || c.decidedGo) ? '' : '<div class="alt-h">不需要送醫嗎？</div><div class="alt-g">'
    + '<button class="altb" type="button" data-nt="dead">明顯死亡：不送醫，通報警方</button>'
    + '<button class="altb" type="button" data-nt="minor">明顯輕症：現場處置，建議自行就醫</button></div>';
  UI.dpAlt.innerHTML = '';
  UI.dpFoot.textContent = D.realtime ? '即時模式：時間仍在流逝（0.3 倍）' : isTouch ? '遊戲暫停中，慢慢判斷' : `遊戲暫停中 · ${HOSP_KEYS}`;
}

// ---------- dispatch console: units, calls, map ----------
function buildDispatchHUD() {
  UI.dUnits.innerHTML = units.map((u, i) => `<button class="ucard" type="button" data-u="${i}" style="--uc:${UNIT_TYPES[u.type].css}">`
    + `<span class="un">${i + 1}</span><span class="ut"><b>${u.name}</b><em>${UNIT_TYPES[u.type].short}</em></span><span class="us"><i></i><span></span></span></button>`).join('');
  UI.uEls = [...UI.dUnits.querySelectorAll('.ucard')].map((el) => ({ el, dot: el.querySelector('.us i'), txt: el.querySelector('.us span'), k: '' }));
  UI.dSpeed.textContent = '速度 ×1';
  UI.dsheet.querySelector('.dcalls-h span').textContent = isTouch ? '點「待派車」的報案可以派車' : `點報案派車 · 1–${units.length} 切換鏡頭 · F 速度`;
  UI.dCalls.innerHTML = '';
  dhudCache.calls = null;
}
const dhudCache = {};
const OUT_TXT = { overtx: '送醫（不需要）', saved: '送醫完成', notransport: '現場處置', deadscene: '明顯死亡', dead: '不幸過世', left: '家屬自行送醫', nodispatch: '不需派車', wasted: '白跑一趟', hungup: '民眾掛斷', handover: '交接下一班' };
// status text for the call list, plus the unit handling it (shown as its number badge)
function callStatus(c) {
  if (c.status === 'done') return [OUT_TXT[c.outcome] || '結案', c.outcome === 'dead' || c.outcome === 'wasted' || c.outcome === 'hungup' ? '#a3221c' : '#2f7d4f', null];
  if (c.status === 'new' || c.status === 'pending') return ['待派車', '#e0413a', null];
  const u = c.unit;
  if (c.status === 'assigned') return ['前往現場', '#d6372f', u];
  if (c.status === 'onscene') return ['現場處理', '#c97d0e', u];
  if (c.status === 'transport') return ['送醫中', '#c22c78', u];
  return ['', '#888', null];
}
function updateDispatchHUD() {
  if (dhudCache.t !== Math.ceil(D.t)) { dhudCache.t = Math.ceil(D.t); UI.dTime.textContent = fmtT(D.t); UI.dTime.parentNode.classList.toggle('low', D.t < 30); UI.dTime.previousElementSibling.textContent = WX.id === 'day' ? '值班' : `值班・${WX.cur.name}`; }
  const sc = `${D.score.toLocaleString('en-US')} 分`;
  if (dhudCache.sc !== sc) { dhudCache.sc = sc; UI.dScore.textContent = sc; }
  const tl = `救活 ${D.saved} · 過世 ${D.dead}`;
  if (dhudCache.tl !== tl) { dhudCache.tl = tl; UI.dTally.textContent = tl; }
  units.forEach((u, i) => {
    const o = UI.uEls && UI.uEls[i];
    if (!o) return;
    let txt = U_TXT[u.state];
    if (u.route && (u.state === 'toScene' || u.state === 'toHosp' || u.state === 'return')) txt += ` · ${Math.max(1, Math.round((u.route.len - u.s) / UNIT_SPEED))} 秒`;
    else if (u.state === 'atHosp' && u.handoff >= 2) txt = `等床交接 · ${Math.max(1, Math.ceil(4 + u.handoff - u.t))} 秒`;
    const k = txt + (dsel === u ? '*' : '');
    if (o.k !== k) { o.k = k; o.txt.textContent = txt; o.dot.style.background = U_CSS[u.state] || '#888'; o.el.classList.toggle('sel', dsel === u); }
  });
  const list = dcalls.slice().reverse();
  const key = list.map((c) => c.id + c.status + (c.outcome || '')).join(',');
  if (dhudCache.calls !== key) {
    dhudCache.calls = key;
    UI.dCalls.innerHTML = list.length ? list.map((c) => {
      const [st, col, u] = callStatus(c);
      const tri = c.status === 'done' ? TRIAGE[c.c.tri] : null;
      const ub = u ? `<em class="ub" style="background:${UNIT_TYPES[u.type].css}">${u.i + 1}</em>` : '';
      return `<button class="crow${c.status === 'pending' || c.status === 'new' ? ' pend' : ''}${c.status === 'done' ? ' done' : ''}" type="button" data-c="${c.id}">`
        + `<i style="background:${tri ? tri.css : c.kind === 'none' ? '#8f8a84' : '#3a86e0'}"></i><span class="cn">#${c.id} ${c.c.short}</span>`
        + `<span class="cs" style="color:${col}">${ub}${st}</span><b class="ct"></b></button>`;
    }).join('') : '<div class="cempty">目前沒有報案，等待 119 來電…</div>';
    dhudCache.ctEls = [...UI.dCalls.querySelectorAll('.crow')].map((el) => ({ el, b: el.querySelector('.ct'), id: +el.dataset.c, s: '' }));
  }
  for (const o of dhudCache.ctEls || []) {
    const c = dcalls.find((q) => q.id === o.id);
    if (!c) continue;
    const s = c.status === 'done' ? '' : fmtT(c.t);
    if (o.s !== s) { o.s = s; o.b.textContent = s; }
  }
}
const DMAP_VIEW = { x0: -860, z0: -1470, x1: 1120, z1: 680 };
// a district is uncovered (空窗) when no free crew is anywhere near its station
const COVER_R = 260;
function districtCovered(i) {
  const S = STATIONS[i];
  return units.some((u) => unitFree(u) && hypot(u.x - S.park.x, u.z - S.park.z) < COVER_R);
}
// The map frames what the dispatcher is deciding about (the caller and the nearest free crews, or the crew on scene
// and the hospitals near it), otherwise the whole city; it glides between the two.
const DVIEW = Object.assign({}, DMAP_VIEW);
function dmapTarget(cw, ch) {
  const V = DMAP_VIEW;
  let pts = null;
  if (dcur && dcur.c && dcur.c.status !== 'done') {
    const near = (x, z) => (a, b) => hypot(a[0] - x, a[1] - z) - hypot(b[0] - x, b[1] - z);
    if (dcur.type === 'call') {
      const c = dcur.c;
      pts = [[c.x, c.z], ...units.filter(unitFree).map((u) => [u.x, u.z]).sort(near(c.x, c.z)).slice(0, 2)];
    } else if (dcur.u) {
      const u = dcur.u;
      pts = [[u.x, u.z], ...HOSPITALS.filter((H) => accepts(H, dcur.c.c) && !isDiverted(H)).map((H) => H.drop).sort(near(u.x, u.z)).slice(0, 3)];
    }
  }
  if (!pts) return V;
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const [x, z] of pts) { bx0 = Math.min(bx0, x - 90); bx1 = Math.max(bx1, x + 90); bz0 = Math.min(bz0, z - 90); bz1 = Math.max(bz1, z + 90); }
  let w = Math.max(bx1 - bx0, 640), h = Math.max(bz1 - bz0, 640);
  if (w / h < cw / ch) w = h * (cw / ch); else h = w / (cw / ch);
  if (w >= V.x1 - V.x0 || h >= V.z1 - V.z0) return V; // as big as the city anyway
  const cx = clamp((bx0 + bx1) / 2, V.x0 + w / 2, V.x1 - w / 2), cz = clamp((bz0 + bz1) / 2, V.z0 + h / 2, V.z1 - h / 2);
  return { x0: cx - w / 2, z0: cz - h / 2, x1: cx + w / 2, z1: cz + h / 2 };
}
function drawDMap(t) {
  const cv = UI.dmap;
  if (!mapImg || !cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = cv.clientWidth, ch = cv.clientHeight;
  if (!cw || !ch) return;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const T = dmapTarget(cw, ch);
  for (const k of ['x0', 'z0', 'x1', 'z1']) DVIEW[k] = lerp(DVIEW[k], T[k], 0.16);
  // then widen the view to fill the canvas
  let { x0, z0, x1, z1 } = DVIEW;
  if (cw / ch > (x1 - x0) / (z1 - z0)) {
    const nw = Math.min(WXS, (z1 - z0) * (cw / ch)), cx = clamp((x0 + x1) / 2, WX0 + nw / 2, WX0 + WXS - nw / 2);
    x0 = cx - nw / 2; x1 = cx + nw / 2;
  } else {
    const nh = Math.min(WZS, (x1 - x0) / (cw / ch)), cz = clamp((z0 + z1) / 2, WZ0 + nh / 2, WZ0 + WZS - nh / 2);
    z0 = cz - nh / 2; z1 = cz + nh / 2;
  }
  const sc = Math.min(cw / (x1 - x0), ch / (z1 - z0));
  const ox = (cw - (x1 - x0) * sc) / 2, oz = (ch - (z1 - z0) * sc) / 2;
  UI.dmapT = { x0, z0, sc, ox, oz };
  g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, cw, ch);
  g.imageSmoothingEnabled = true;
  g.drawImage(mapImg, (x0 - WX0) * MAP_SCALE, (z0 - WZ0) * MAP_SCALE, (x1 - x0) * MAP_SCALE, (z1 - z0) * MAP_SCALE, ox, oz, (x1 - x0) * sc, (z1 - z0) * sc);
  const P = (x, z) => [ox + (x - x0) * sc, oz + (z - z0) * sc];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const tag = (px, py, txt, bg) => {
    g.font = `9.5px ${FONT_CJK}`;
    const w = g.measureText(txt).width + 8;
    g.fillStyle = bg; roundRect(g, px - w / 2, py - 19, w, 12, 6); g.fill();
    g.fillStyle = '#ffffff'; g.fillText(txt, px, py - 12.5);
  };
  drawJams(g, P, 0.8, false);
  drawRoadEvents(g, P, 0.8, false);
  STATIONS.forEach((S, i) => {
    const [px, py] = P(S.pos[0], S.pos[1]);
    // no free crew near: a dashed ring, pulsing while a call in that district is still waiting for a unit
    const gap = G.state !== 'title' && !districtCovered(i);
    if (gap) {
      const waiting = dcalls.some((c) => c.dist === i && (c.status === 'new' || c.status === 'pending') && c.kind === 'patient');
      g.strokeStyle = '#d9312b'; g.lineWidth = waiting ? 2.4 : 1.6; g.globalAlpha = waiting ? 1 : 0.6; g.setLineDash([3, 3]);
      g.beginPath(); g.arc(px, py, waiting ? 12 + Math.sin(t * 5) * 1.6 : 11, 0, TAU); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    g.fillStyle = '#ffffff'; roundRect(g, px - 7, py - 7, 14, 14, 3); g.fill();
    drawIcon(g, 'station', px, py, 12, '#d9312b');
  });
  HOSPITALS.forEach((H, i) => {
    const [px, py] = P(H.drop[0], H.drop[1]), lv = erLevel(H), full = lv === 3;
    if (lv === 1 || lv === 2) { g.strokeStyle = ER_CSS[lv]; g.lineWidth = lv === 2 ? 3 : 2; g.beginPath(); g.arc(px, py, 9.6, 0, TAU); g.stroke(); }
    g.fillStyle = full ? '#9a948c' : H.css; g.beginPath(); g.arc(px, py, 6.5, 0, TAU); g.fill();
    g.lineWidth = 1.8; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff'; g.font = `600 8.5px ${FONT_NUM}`; g.fillText(String(i + 1), px, py + 0.5);
    if (full) tag(px, py, '滿床', 'rgba(122,115,107,0.92)');
    else if (lv === 2) tag(px, py, '壅塞', 'rgba(214,88,34,0.92)');
  });
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const u of units) {
    if (!u.route || !(u.state === 'toScene' || u.state === 'toHosp' || u.state === 'return')) continue;
    const R = u.route, k0 = routeAt(R, u.s)[4];
    g.strokeStyle = U_CSS[u.state]; g.lineWidth = u.state === 'return' ? 1.6 : 2.6; g.globalAlpha = u.state === 'return' ? 0.55 : 0.9;
    g.setLineDash(u.state === 'return' ? [4, 4] : []);
    g.beginPath();
    const [sx, sy] = P(u.x, u.z); g.moveTo(sx, sy);
    for (let k = k0 + 1; k < R.pts.length; k += 2) { const [px, py] = P(R.pts[k][0], R.pts[k][1]); g.lineTo(px, py); }
    const [ex, ey] = P(R.pts[R.pts.length - 1][0], R.pts[R.pts.length - 1][1]); g.lineTo(ex, ey);
    g.stroke();
  }
  g.setLineDash([]); g.globalAlpha = 1;
  if (dcur) {
    const [px, py] = dcur.type === 'call' ? P(dcur.c.x, dcur.c.z) : P(dcur.u.x, dcur.u.z);
    g.strokeStyle = '#e0413a'; g.lineWidth = 2.5; g.setLineDash([5, 4]);
    g.beginPath(); g.arc(px, py, 17 + Math.sin(t * 5) * 2, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  for (const c of dcalls) {
    if (c.status === 'done') continue;
    const [px, py] = P(c.x, c.z);
    const pend = c.status === 'pending' || c.status === 'new';
    const col = c.kind === 'none' ? '#8f8a84' : pend ? '#e0413a' : '#f0a12a';
    const pulse = pend ? 1 + Math.sin(t * 6 + c.id) * 0.25 : 1;
    g.fillStyle = col; g.globalAlpha = 0.25; g.beginPath(); g.arc(px, py, 11 * pulse, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.arc(px, py, 6.5, 0, TAU); g.fill();
    g.lineWidth = 1.6; g.strokeStyle = '#ffffff'; g.stroke();
    drawIcon(g, 'phone', px, py, 8, '#ffffff');
    g.font = `600 9px ${FONT_NUM}`; g.fillStyle = '#4b3424'; g.fillText(`#${c.id}`, px, py - 12);
  }
  // units: rounded tags with a heading pointer, so they don't read as the round hospital markers
  for (const u of units) {
    const [px, py] = P(u.x, u.z);
    const sel = dsel === u, w = sel ? 21 : 18, hh = sel ? 15 : 13;
    if (u.state !== 'idle') {
      const fx = Math.sin(u.h), fz = Math.cos(u.h);
      g.fillStyle = UNIT_TYPES[u.type].css;
      g.beginPath(); g.moveTo(px + fx * (w * 0.5 + 6), py + fz * (w * 0.5 + 6));
      g.lineTo(px - fz * 4.5 + fx * w * 0.32, py + fx * 4.5 + fz * w * 0.32); g.lineTo(px + fz * 4.5 + fx * w * 0.32, py - fx * 4.5 + fz * w * 0.32); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(60,38,20,0.3)'; roundRect(g, px - w / 2, py - hh / 2 + 1.5, w, hh, 4); g.fill();
    g.fillStyle = UNIT_TYPES[u.type].css; roundRect(g, px - w / 2, py - hh / 2, w, hh, 4); g.fill();
    g.lineWidth = sel ? 2.6 : 1.8; g.strokeStyle = sel ? '#4b3424' : '#ffffff'; roundRect(g, px - w / 2, py - hh / 2, w, hh, 4); g.stroke();
    g.fillStyle = '#ffffff'; g.font = `600 ${sel ? 10.5 : 9.5}px ${FONT_NUM}`; g.fillText(String(u.i + 1), px, py + 0.5);
  }
}
function onDMapClick(e) {
  const T = UI.dmapT;
  if (!T || (G.state !== 'play' && G.state !== 'dchoose')) return;
  const r = UI.dmap.getBoundingClientRect();
  const wx = T.x0 + (e.clientX - r.left - T.ox) / T.sc, wz = T.z0 + (e.clientY - r.top - T.oz) / T.sc;
  let best = null, bd = 16 / T.sc;
  for (const u of units) { const d = hypot(u.x - wx, u.z - wz); if (d < bd) { bd = d; best = u; } }
  if (best) { focusUnit(best); return; }
  if (G.state !== 'play') return;
  for (const c of dcalls) if (c.status === 'pending' && hypot(c.x - wx, c.z - wz) < 18 / T.sc) { queueDecision({ type: 'call', c }, true, true); return; }
}

// ===================== game logic: 119 calls, triage, hospital choice, scoring =====================
const START_TIME = 180;
const MAX_WAIT = 4;
const G = {
  state: 'loading', mode: 'mission', time: START_TIME, score: 0, saved: 0, dead: 0, left: 0, ideal: 0, rejects: 0, fast: 0, bestAir: 0,
  combo: 0, comboT: 0, best: 0, muted: false, t: 0, countdown: 0, overT: 0, lowBeepT: 0, callT: 0, crashT: 0, recent: [],
};
// the siren: 4 s per press, kept on while the key/button is held
const SIREN = { t: 0 };
const sirenOn = () => SIREN.t > 0;
// ambulances the traffic has to watch out for: the player's, or the dispatch units
const NO_AMBS = [];
const PLAYER_AMB = [{ x: 0, z: 0, h: 0, siren: false, player: true }];
function ambList() {
  if (G.mode === 'dispatch') return units;
  const a = PLAYER_AMB[0];
  a.x = car.x; a.z = car.z; a.h = car.h; a.siren = sirenOn();
  return PLAYER_AMB;
}
let spawnPts = [];
const patients = [];   // waiting at the roadside (or boarding / fading)
let riding = null;     // patient on board
let selCall = null;    // call the arrow points to (null = nearest)
const caseLog = [];    // every finished case, for the results review
const walkers = [];    // delivered patients walking into the hospital
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '周', '賴'];

function buildSpawnPoints() {
  spawnPts = [];
  for (const e of edges) {
    if (e.flags.ring || e.flags.campus || e.flags.alley) continue;
    const pad = Math.max(nodeMaxHw(e.a), nodeMaxHw(e.b)) + 14;
    for (let s = pad; s < e.len - pad; s += 9) {
      const [x, z, tx, tz] = edgePoint(e, s);
      if (HOSPITALS.some((h) => hypot(h.drop[0] - x, h.drop[1] - z) < 60)) continue;
      if (STATIONS.some((st) => hypot(st.proj.px - x, st.proj.pz - z) < 45)) continue;
      if (RAMP_SHAPES.some((r) => hypot(r.x - x, r.z - z) < r.len + 10)) continue;
      for (const sd of [1, -1]) {
        const nx = -tz * sd, nz = tx * sd;
        const px = x + nx * (e.hw + 2.2), pz = z + nz * (e.hw + 2.2);
        if (landF(px, pz) < 6 || blockedAt(px, pz, 1.4) || plazaVal(px, pz) > 3 || alleyDist(px, pz) < 3) continue;
        if (blockedAt(px + tx * 1.9, pz + tz * 1.9, 0.9)) continue;
        if (knock.some((k) => Math.abs(k.x0 - px) < 3 && Math.abs(k.z0 - pz) < 3)) continue;
        spawnPts.push({ x, z, tx, tz, nx, nz, e, s, px, pz });
      }
    }
  }
}

// ---------- districts (轄區): every street belongs to the station whose crew reaches it first ----------
let STATION_DJ = [];
const DIST_PTS = [];    // call spots per district
const DIST_NB = [];     // each district's neighbours, nearest first (for cross-district support)
function districtOf(proj) {
  let best = 0, bd = Infinity;
  STATION_DJ.forEach((D, i) => { const c = routeCost(D, proj); if (c < bd) { bd = c; best = i; } });
  return best;
}
const distName = (i) => `${STATIONS[i].name}轄區`;
function buildDistricts() {
  STATION_DJ = STATIONS.map((S) => dijkstra(S.proj, true));
  DIST_PTS.length = 0;
  STATIONS.forEach(() => DIST_PTS.push([]));
  for (const sp of spawnPts) { sp.dist = districtOf({ e: sp.e, s: sp.s, px: sp.x, pz: sp.z }); DIST_PTS[sp.dist].push(sp); }
  for (const H of HOSPITALS) H.dist = districtOf(H.proj);
  DIST_NB.length = 0;
  STATIONS.forEach((S, i) => DIST_NB.push(STATIONS.map((T, j) => j).filter((j) => j !== i).sort((a, b) => routeCost(STATION_DJ[i], STATIONS[a].proj) - routeCost(STATION_DJ[i], STATIONS[b].proj))));
}

// ---------- routing over the road graph ----------
// edge cost = length x e.k (alleys count a little longer); noAlley keeps a route on the streets
function dijkstra(from, noAlley) {
  const dist = new Map(), prev = new Map(), done = new Set();
  const relax = (n, d, p) => { const o = dist.get(n); if (o === undefined || d < o) { dist.set(n, d); prev.set(n, p); } };
  const k0 = (from.e.k || 1) * (from.e.evk || 1) * jamF(from.e);
  relax(from.e.a, from.s * k0, null);
  relax(from.e.b, (from.e.len - from.s) * k0, null);
  for (;;) {
    let u = null, ud = Infinity;
    for (const [n, d] of dist) if (d < ud && !done.has(n)) { ud = d; u = n; }
    if (u === null) break;
    done.add(u);
    for (const { e, dir } of nodeEdges[u] || []) {
      if (noAlley && e.flags.alley) continue;
      const v = dir === 1 ? e.b : e.a;
      if (!done.has(v)) relax(v, ud + e.len * (e.k || 1) * (e.evk || 1) * jamF(e), { n: u, e });
    }
  }
  return { from, dist, prev };
}
function routeEnds(D, to) {
  const da = D.dist.get(to.e.a), db = D.dist.get(to.e.b), k = (to.e.k || 1) * (to.e.evk || 1) * jamF(to.e);
  const viaA = da === undefined ? Infinity : da + to.s * k, viaB = db === undefined ? Infinity : db + (to.e.len - to.s) * k;
  const direct = to.e === D.from.e ? Math.abs(to.s - D.from.s) * k : Infinity;
  return { viaA, viaB, direct, len: Math.min(viaA, viaB, direct) };
}
const routeCost = (D, to) => routeEnds(D, to).len;
function sliceEdge(e, s0, s1) {
  const out = [];
  const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 6));
  for (let i = 0; i <= n; i++) { const p = edgePoint(e, lerp(s0, s1, i / n)); out.push([p[0], p[1]]); }
  return out;
}
function routePath(D, to) {
  const r = routeEnds(D, to);
  if (r.len === Infinity) return { len: hypot(to.px - D.from.px, to.pz - D.from.pz), pts: [[D.from.px, D.from.pz], [to.px, to.pz]], es: [] };
  if (r.direct <= r.len) return { len: r.direct, pts: sliceEdge(D.from.e, D.from.s, to.s), es: [to.e] };
  const endNode = r.viaA <= r.viaB ? to.e.a : to.e.b;
  const chain = [];
  for (let n = endNode; n !== undefined;) { chain.unshift(n); const p = D.prev.get(n); if (!p) break; n = p.n; }
  const from = D.from;
  const pts = sliceEdge(from.e, from.s, chain[0] === from.e.a ? 0 : from.e.len);
  const es = [from.e];
  for (let i = 1; i < chain.length; i++) {
    const e = D.prev.get(chain[i]).e;
    es.push(e);
    pts.push(...(e.a === chain[i - 1] ? e.pts : e.pts.slice().reverse()));
  }
  pts.push(...sliceEdge(to.e, endNode === to.e.a ? 0 : to.e.len, to.s));
  es.push(to.e);
  return { len: r.len, pts, es };
}
const route = (from, to) => routePath(dijkstra(from), to);

// ---------- guidance arrow / minimap route ----------
const guide = { pts: [], len: 0, target: null, color: '#f8f1de', t: 0, kind: null };
function waitingCalls() { return patients.filter((p) => p.state === 'wait'); }
const TRI_RANK = { red: 0, yellow: 1, green: 2 };
// dispatch order: most critical first, then whoever has the least time left
function callsByPriority() { return waitingCalls().sort((a, b) => TRI_RANK[a.c.tri] - TRI_RANK[b.c.tri] || secLeft(a) - secLeft(b)); }
// real seconds a waiting patient has left (an unattended cardiac arrest uses its time up faster)
const secLeft = (p) => p.life / (p.rate || 1);
function currentCall() {
  const w = callsByPriority();
  if (selCall && w.includes(selCall)) return selCall;
  selCall = null;
  // the most critical patient we can still get to hospital in time; if nobody, the most critical one
  return w.find((p) => p.reach !== false) || w[0] || null;
}
// ---------- can we still save them? drive to the patient (after the current delivery) and on to a hospital ----------
const hospDJ = new Map();
function hospDijkstra(H) { let D = hospDJ.get(H.id); if (!D) { D = dijkstra(H.proj); hospDJ.set(H.id, D); } return D; }
function hospEtaFrom(proj, c) {
  const D = dijkstra(proj);
  let m = Infinity;
  for (const H of HOSPITALS) if (accepts(H, c)) m = Math.min(m, routeCost(D, H.proj));
  return m / ETA_SPEED;
}
function updateReach(Dcar) {
  const w = waitingCalls();
  if (!w.length) return;
  let base = 0, D = Dcar;
  if (riding) {
    if (riding.dest) { base = (guide.kind === 'hosp' ? guide.len : 0) / ETA_SPEED + 3; D = hospDijkstra(riding.dest); } else base = 25;
  }
  if (G.hold) base += G.hold.t;
  for (const p of w) {
    if (p.hospEta === undefined) p.hospEta = hospEtaFrom(p.proj, p.c);
    p.eta = base + routeCost(D, p.proj) / ETA_SPEED + 2;
    p.reach = (p.eta * (p.rate || 1) + p.hospEta) * 1.1 < p.life;
  }
}

// ---------- emergency departments fill up (急診壅塞) ----------
// Every patient brought in keeps a bed for a while, and walk-ins keep the big hospitals busy anyway (most ER patients
// come by themselves, many straight to a medical centre). A crowded ER has no free bed to move the patient onto, so
// the crew waits with them on the ambulance stretcher; a full one stops taking ambulances (滿床) until beds free up.
const ER_CAP = { severe: 10, moderate: 7, general: 5, momkid: 5 };
const ER_BASE = { severe: 0.62, moderate: 0.42, general: 0.36, momkid: 0.4 }; // usual share of beds taken by walk-ins
const ER_TAU = 110;                                  // seconds a bed stays taken (game time runs fast)
const ER_LOAD = { red: 1.4, yellow: 1.15, green: 1 }; // a critical patient ties up the resuscitation room longer
const ER_FULL = 1.04, ER_OPEN = 0.86;                // goes on diversion / takes ambulances again
const ER_TXT = ['順暢', '忙碌', '壅塞', '滿床'];
const ER_CSS = ['#2f9e5a', '#d3920f', '#e0612a', '#7a736b'];
const SURGE_WHY = ['附近發生連環車禍', '遊覽車旅客集體食物中毒', '流感病人大排長龍', '工地發生意外'];
const ER = { surgeT: 1e9, t: 0, protect: null };
function resetER(firstSurge) {
  for (const H of HOSPITALS) {
    if (H.noER) { H.er = null; continue; }
    const cap = ER_CAP[H.level] || 6;
    H.er = { n: cap * ER_BASE[H.level] * grand(0.86, 1.12), cap, full: false, ph: grand(0, TAU), mine: 0, fulls: 0 };
  }
  ER.surgeT = firstSurge; ER.t = 0;
}
const erRatio = (H) => (H && H.er ? H.er.n / H.er.cap : 0);
// 0 順暢 · 1 忙碌 · 2 壅塞 · 3 滿床
function erLevel(H) {
  if (!H || !H.er) return 0;
  if (H.er.full) return 3;
  const r = erRatio(H);
  return r >= 0.9 ? 2 : r >= 0.72 ? 1 : 0;
}
// seconds the crew waits with the patient before the ER has a bed for them
function erWait(H) { return Math.round(Math.pow(clamp((erRatio(H) - 0.66) / 0.4, 0, 1), 1.5) * 16); }
// a patient handed over takes a bed; `mine` counts the player's recent ones (for the 大醫院迷思 medal)
function erAdmit(H, c) {
  if (!H || !H.er) return;
  H.er.n += ER_LOAD[c.tri] || 1;
  H.er.mine += 1;
}
const isDiverted = (H) => !!H && !!H.er && H.er.full;
// an ER only stops taking ambulances while somebody else still offers everything it does
function canDivert(H) {
  return H.caps.every((k) => HOSPITALS.some((o) => o !== H && !isDiverted(o) && o.caps.includes(k)))
    && HOSPITALS.some((o) => o !== H && o.er && !o.er.full && o.level !== 'momkid');
}
function setFull(H, on, onFull) {
  if (!H.er || H.er.full === on) return;
  H.er.full = on;
  if (on) {
    H.er.fulls++;
    sfx.reject();
    toast(`${H.name} 急診滿床，暫停收治`, '', true);
    if (H.er.mine >= 2.5 && G.mode !== 'free') award('bigname');
    if (onFull) onFull(H);
  } else toast(`${H.name} 恢復收治`, '', false, H.css);
}
function erStep(dt, onFull) {
  ER.t += dt;
  for (const H of HOSPITALS) {
    const E = H.er;
    if (!E) continue;
    // walk-ins and discharges pull the ER back to its usual level, which rises and falls through the evening
    const usual = ER_BASE[H.level] * E.cap * (1 + 0.07 * Math.sin(ER.t / 41 + E.ph));
    const k = dt / ER_TAU;
    E.n += (usual - E.n) * k;
    E.mine -= E.mine * k;
    const r = E.n / E.cap;
    // never right in front of the crew that is just pulling in
    if (!E.full && r >= ER_FULL && canDivert(H) && !(ER.protect && ER.protect(H))) setFull(H, true, onFull);
    else if (E.full && r < ER_OPEN) setFull(H, false);
  }
  // now and then a crowd arrives at once
  ER.surgeT -= dt;
  if (ER.surgeT <= 0) {
    ER.surgeT = grand(70, 100);
    const opts = HOSPITALS.filter((H) => H.er && !H.er.full);
    if (!opts.length) return;
    const H = gwpick(opts, (Hh) => (Hh.level === 'severe' ? 2.4 : 1) * (0.3 + erRatio(Hh)));
    H.er.n += H.er.cap * grand(0.2, 0.3);
    if (erLevel(H) >= 2) toast(`${gpick(SURGE_WHY)}，${H.name}急診湧入大批病人`, '', false, H.css);
  }
}

function cycleCall(dir = 1) {
  const w = callsByPriority();
  if (!w.length) return;
  const cur = currentCall();
  const i = w.indexOf(cur);
  selCall = w[(i + dir + w.length) % w.length];
  updateGuide(true);
}
function updateGuide(force) {
  guide.t -= 1;
  if (guide.t > 0 && !force) return;
  guide.t = 20;
  const from = nearestOnRoads(car.x, car.z), Dc = dijkstra(from);
  if (G.mode === 'mission') updateReach(Dc);
  let to = null, color = '#f8f1de', kind = null;
  if (G.mode === 'free' && G.addr) { guide.pts = []; guide.target = null; guide.len = 0; guide.kind = 'addr'; return; }
  if (G.mode === 'free' && G.trial) { to = G.trial.H.proj; color = G.trial.H.css; kind = 'trial'; }
  else if (G.mode === 'free') { const L = nextLandmark(); if (L) { to = L.proj; color = LM_GOLD; kind = 'lm'; } }
  else if (riding) { if (riding.dest) { to = riding.dest.proj; color = riding.dest.css; kind = 'hosp'; } }
  else { const p = currentCall(); if (p) { to = p.proj; color = TRIAGE[p.c.tri].css; kind = 'call'; } }
  if (!to) { guide.pts = []; guide.target = null; guide.len = 0; guide.kind = null; return; }
  const r = routePath(Dc, to);
  guide.pts = [[car.x, car.z], ...r.pts];
  guide.len = r.len + from.d;
  guide.target = to; guide.color = color; guide.kind = kind;
  guide.jam = jamWarn(r.es || [], kind, to);
  if (riding && kind === 'hosp' && riding.legJam === undefined) riding.legJam = guide.jam;
  if (G.mode !== 'dispatch') lostStep(kind, to);
}
function guidePoint(ahead) {
  const P = guide.pts;
  if (!P.length) return null;
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    const L = hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (acc + L >= ahead) { const t = (ahead - acc) / (L || 1); return [lerp(P[i - 1][0], P[i][0], t), lerp(P[i - 1][1], P[i][1], t)]; }
    acc += L;
  }
  return P[P.length - 1];
}
// route lengths from the car to every hospital (for the destination panel)
function hospitalDistances() {
  const D = dijkstra(nearestOnRoads(car.x, car.z));
  return HOSPITALS.map((H) => routeCost(D, H.proj));
}

// ---------- medical rules ----------
// who a hospital takes at all, before its capabilities count
function admits(H, c) {
  if (H.noER) return false;
  if (H.only === 'momkid') return !!(c.kid || c.preg);
  return true;
}
function accepts(H, c) {
  if (!admits(H, c)) return false;
  if (c.needs === 'er') return true;
  return H.caps.includes(c.needs);
}
function rejectReason(H, c) {
  if (H.noER) return '我們是癌症專科醫院，不是急救責任醫院，不收 119 送來的急診病人。';
  if (H.only === 'momkid' && !admits(H, c)) return '這裡是婦幼專科醫院，只收兒童和孕產婦。';
  return CAPS[c.needs].rej;
}
// the short note after a hospital's name in the choice lists
function hospNote(H) {
  if (H.only === 'momkid') return '只收婦幼';
  return H.caps.length || H.noER ? '' : '一般急診';
}
// a hospital beyond the crew's own and neighbouring districts: taking a patient there leaves home uncovered for long
function farFromHome(H, home) {
  return home !== undefined && home >= 0 && H.dist !== undefined && H.dist !== home && !DIST_NB[home].slice(0, 2).includes(H.dist);
}
// number keys for the choice lists: 1-9, then 0 for the 10th, - for the 11th and = for the 12th
function hospKey(e) {
  if (e.key === '0') return 10;
  if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') return 11;
  if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') return 12;
  const n = parseInt(e.key, 10);
  return n >= 1 && n <= 9 ? n : 0;
}
const HOSP_KEYS = '按醫院號碼選擇（0 = 10、- = 11、= = 12）';
// Which hospitals count as the best choice, judged from where the patient was picked up: the drive, the wait for a bed
// at a crowded ER, and for a minor patient the medical-centre bed they would take from someone sicker.
const GREEN_SEVERE = 14; // seconds' worth
const FAR_HOME = 6;       // seconds' worth: the drive back to an uncovered district
function evaluateChoices(p, home) {
  const D = dijkstra(p.proj);
  const costs = HOSPITALS.map((H) => routeCost(D, H.proj));
  const waits = HOSPITALS.map((H) => erWait(H));
  let pool = HOSPITALS.map((H, i) => i).filter((i) => accepts(HOSPITALS[i], p.c) && !isDiverted(HOSPITALS[i]));
  if (!pool.length) pool = HOSPITALS.map((H, i) => i).filter((i) => accepts(HOSPITALS[i], p.c));
  const cost = (i) => costs[i] + ETA_SPEED * (waits[i] + (p.c.tri === 'green' && HOSPITALS[i].level === 'severe' ? GREEN_SEVERE : 0)
    + (farFromHome(HOSPITALS[i], home) ? FAR_HOME : 0));
  const m = Math.min(...pool.map(cost));
  return { costs, waits, ideal: pool.filter((i) => cost(i) <= m * 1.15 + 30), best: pool.find((i) => cost(i) === m) };
}

// ---------- 119 calls ----------
function chooseCase() {
  const redWaiting = waitingCalls().filter((p) => p.c.tri === 'red').length + (riding && riding.c.tri === 'red' ? 1 : 0);
  const r = Math.random();
  let tri = r < 0.34 ? 'red' : r < 0.76 ? 'yellow' : 'green';
  if (tri === 'red' && redWaiting >= 2) tri = 'yellow';
  // now and then a "minor" call is a guest who only wants a free ride (once a shift)
  if (tri === 'green' && !SHIFT.fake && Math.random() < 0.3) { SHIFT.fake = true; return TW_CASES[0]; }
  let list = CASES.filter((c) => c.tri === tri && !G.recent.includes(c.id));
  if (!list.length) list = CASES.filter((c) => c.tri === tri);
  const c = weatherPick(list);
  G.recent.push(c.id);
  if (G.recent.length > 6) G.recent.shift();
  return c;
}
function patientName(c) {
  const s = gpick(SURNAMES);
  if (c.nm) return s + c.nm;
  if (c.kid) return s + gpick(['小弟弟', '小妹妹']);
  if (c.preg) return s + '太太';
  if (c.elder) return s + gpick(['阿伯', '阿姨']);
  return s + gpick(['先生', '小姐']);
}
// Each patient's time: what a decent driver needs to finish the current delivery, reach them and take them on to the
// nearest hospital that can treat them, with a margin by severity. Going straight there always works; a detour,
// a wrong hospital or a string of crashes does not. Never more than the case's old fixed time.
const BUDGET = { red: [1.5, 8, 30], yellow: [2, 10, 45], green: [2.5, 10, 60] }; // margin, seconds for stopping and boarding, minimum
const BUDGET_SPEED = 20; // units/s: a little under the ETA the player is shown
function fitBudget(p, grace = 1) {
  const [k, add, min] = BUDGET[p.c.tri];
  let base = 0, D;
  if (riding && riding.dest) { base = (guide.kind === 'hosp' ? guide.len : 0) / BUDGET_SPEED + 3; D = hospDijkstra(riding.dest); }
  else { if (riding) base = 25; D = dijkstra(nearestOnRoads(car.x, car.z)); }
  if (G.hold) base += G.hold.t; // still handing a patient over at a crowded ER
  // whoever the arrow will send the ambulance to first (as critical or more, still savable): a pickup and a delivery each
  for (const q of waitingCalls()) {
    if (q === p || TRI_RANK[q.c.tri] > TRI_RANK[p.c.tri] || q.reach === false) continue;
    base += (q.hospEta || 15) * ETA_SPEED / BUDGET_SPEED + 20;
  }
  p.hospEta = hospEtaFrom(p.proj, p.c);
  const need = base + routeCost(D, p.proj) / BUDGET_SPEED + p.hospEta * ETA_SPEED / BUDGET_SPEED;
  if (!(need < 1e6)) return;
  p.life0 = p.life = clamp(k * grace * need + add, min, p.life0);
}
let callSeq = 0;
// Mission calls come mostly from the crew's own district, now and then from a neighbour with no free ambulance
// (跨區支援). Out of the district (a patient taken to a far hospital), the next calls still tend to be back home.
const W_HOME = 5, W_NB = 1, W_OTHER = 0.15;
function spawnCall(scene, opt = {}) {
  const c = opt.c || chooseCase();
  const byDist = G.mode === 'mission' && G.home !== undefined && !opt.free;
  const home = byDist ? G.home : -1;
  const dmin = opt.dmin !== undefined ? opt.dmin : byDist ? 110 : 90;
  // a critical call has to be one the crew can still reach in time
  const dmax = opt.dmax || (c.tri === 'red' ? (byDist ? 400 : 360) : c.tri === 'yellow' ? 560 : byDist ? 640 : 560);
  const far = c.tri === 'red' ? dmax : opt.dmax || (c.tri === 'yellow' ? 900 : 1100); // home calls may come from further away
  const nb = byDist ? DIST_NB[home].slice(0, 2) : [];
  const free = (sp) => !patients.some((q) => hypot(q.x - sp.px, q.z - sp.pz) < 60);
  for (const [lo, k] of [[dmin, 1], [40, 1.4]]) {
    let sum = 0;
    const cand = [];
    for (const sp of spawnPts) {
      const d = hypot(sp.px - car.x, sp.pz - car.z);
      if (d < lo) continue;
      // a district weight, and a preference for a real drive over a call round the corner
      const w = (!byDist ? 1 : sp.dist === home ? W_HOME : nb.includes(sp.dist) ? W_NB : W_OTHER) * clamp((d - 90) / 220, 0.08, 1);
      if (d > (byDist && sp.dist === home ? far : dmax) * k || (opt.home && sp.dist !== home)) continue;
      cand.push([sp, w]); sum += w;
    }
    for (let tries = 0; tries < 40 && cand.length; tries++) {
      let r = Math.random() * sum, sp = cand[cand.length - 1][0];
      for (const [q, w] of cand) { r -= w; if (r <= 0) { sp = q; break; } }
      if (!free(sp)) continue;
      const p = makePatient(scene, c, sp);
      p.dist = sp.dist; p.xd = byDist && sp.dist !== home;
      fitBudget(p, opt.grace);
      return p;
    }
  }
  return null;
}
// where a mission starts: in the lane outside the station, facing the longer stretch of road
function stationStart(S) {
  const { e, s } = S.proj;
  const [px, pz, tx, tz] = edgePoint(e, s);
  const f = s < e.len / 2 ? 1 : -1, dx = tx * f, dz = tz * f;
  return { x: px - dz * 3, z: pz + dx * 3, h: Math.atan2(dx, dz) };
}
// the duty station for this shift: the one picked in the briefing, or a random one
function homeStation() {
  const i = STATIONS.findIndex((S) => S.id === G.homePick);
  return i >= 0 ? i : Math.floor(Math.random() * STATIONS.length);
}
// opt.neutral: dispatch mode, where the dispatcher only knows what the caller said
function makePatient(scene, c, sp, opt = {}) {
  const { nx, nz, tx, tz } = sp;
  const cpr = !!c.cpr && Math.random() < 0.5;
  const life0 = c.life + (cpr ? 25 : 0);
  const extra = { kid: !!c.kid, preg: !!c.preg, elder: !!c.elder, wave: !c.pose };
  if (c.pose === 'lie' || c.elder) extra.hat = 'none';
  const look = randomLook(extra);
  const ch = makeCharacter(scene, look, c.kid ? 0.74 : 0.95);
  setPose(ch, c.pose);
  if (c.fake) { // the tell-tale suitcase
    const sm = new THREE.MeshToonMaterial({ color: 0x3a7fd5, gradientMap: gradTex });
    const suit = new THREE.Mesh(box(0.75, 1.0, 0.38), sm); suit.position.set(1.05, 0.55, 0.1); suit.castShadow = true;
    const hd = new THREE.Mesh(box(0.08, 0.5, 0.08), new THREE.MeshToonMaterial({ color: 0x4b4f58, gradientMap: gradTex })); hd.position.set(1.05, 1.3, 0.1);
    ch.g.add(suit, hd);
  }
  const p = {
    id: ++callSeq, c, name: patientName(c), look, ch, cpr, life: life0, life0, t: 0, state: 'wait', ph: grand(0, TAU),
    rate: !opt.neutral && c.cpr && !cpr ? 1.5 : 1, // nobody doing CPR: the clock runs 1.5x until the crew takes over
    x: sp.px, z: sp.pz, y: 0, h: c.pose === 'lie' ? Math.atan2(tx, tz) : Math.atan2(-nx, -nz),
    rx: sp.x + nx * Math.max(0, sp.e.hw - 3.2), rz: sp.z + nz * Math.max(0, sp.e.hw - 3.2),
    proj: { e: sp.e, s: sp.s, px: sp.x, pz: sp.z }, nx, nz, tx, tz, rejected: new Set(), dest: null, tips: 0, drawT: 0,
  };
  // someone with the patient: a family member waving, a bystander doing CPR, or a passer-by calling for help
  let kind = null;
  if (c.cpr) kind = cpr ? 'cpr' : 'caller';
  else if (c.comp === 'family' || c.kid) kind = 'family';
  if (kind) {
    const cl = randomLook({ wave: kind !== 'cpr', cpr: kind === 'cpr', kid: false });
    const cc = makeCharacter(scene, cl, 0.95);
    let x, z, h;
    if (kind === 'cpr') {
      setPose(cc, 'kneel');
      x = p.x - tx * 0.7 + nx * 1.7; z = p.z - tz * 0.7 + nz * 1.7; h = Math.atan2(-nx, -nz);
    } else { x = p.x + tx * 1.9; z = p.z + tz * 1.9; h = Math.atan2(-nx, -nz); }
    p.comp = { ch: cc, kind, x, z, h, y: 0 };
  }
  const T = opt.neutral ? DISPATCH_MARK : TRIAGE[c.tri];
  p.neutral = !!opt.neutral;
  p.ring = makeRing(scene, T.hex, 6.4, 0.85);
  p.ring.position.set(p.rx, groundHeight(p.rx, p.rz) + 0.08, p.rz);
  p.beam = makeBeam(scene, T.hex, 0.9, 30, 0.38);
  p.beam.position.set(p.x, 0, p.z);
  p.bubble = makeTimerSprite(T.css, opt.neutral ? 'phone' : 'cross');
  p.bubble.userData.draw(1);
  scene.add(p.bubble);
  patients.push(p);
  if (G.state === 'play' && !opt.neutral) sfx.call();
  return p;
}
function removePatientVisuals(scene, p) {
  if (p.ring) { scene.remove(p.ring); p.ring.geometry.dispose(); p.ring = null; }
  if (p.beam) { scene.remove(p.beam); p.beam = null; }
  if (p.bubble) { scene.remove(p.bubble); p.bubble.material.map.dispose(); p.bubble.material.dispose(); p.bubble = null; }
}
function removePatient(scene, p) {
  removePatientVisuals(scene, p);
  scene.remove(p.ch.g);
  if (p.comp) scene.remove(p.comp.ch.g);
  const i = patients.indexOf(p);
  if (i >= 0) patients.splice(i, 1);
  if (selCall === p) selCall = null;
}
function patientsStep(dt, scene, ev) {
  const live = G.state === 'play';
  for (let i = patients.length - 1; i >= 0; i--) {
    const p = patients[i];
    p.t += dt;
    if (p.state === 'wait') {
      if (p.neutral) continue; // dispatch mode runs these patients itself
      if (live) p.life -= dt * p.rate;
      p.drawT -= dt;
      if (p.drawT <= 0 && p.bubble) { p.drawT = 0.25; p.bubble.userData.draw(clamp(p.life / p.life0, 0, 1)); }
      const d = hypot(car.x - p.rx, car.z - p.rz);
      if (!p.c.pose) p.h = dampAngle(p.h, Math.atan2(car.x - p.x, car.z - p.z), d < 40 ? 3 : 0.5, dt);
      if (p.life <= 0) { ev.callLost(p); continue; }
      if (p.mciLead) { if (live && d < 16 && car.speed < 4.5 && !car.airborne && !riding && !G.boarding) mciArrive(p); continue; }
      if (!riding && !G.boarding && live && d < 7 && car.speed < 3.8 && !car.airborne) {
        p.state = 'board'; p.t = 0;
        p.bx = p.x; p.bz = p.z;
        removePatientVisuals(scene, p);
        if (p.comp) { p.comp.bx = p.comp.x; p.comp.bz = p.comp.z; }
        ev.boarding(p);
      }
    } else if (p.state === 'board') {
      const bt = p.boardTo || car; // the player's ambulance, or a dispatch unit
      const tx = bt.x - Math.sin(bt.h) * 2.4, tz = bt.z - Math.cos(bt.h) * 2.4;
      const t = clamp(p.t / 0.55, 0, 1);
      p.x = lerp(p.bx, tx, t); p.z = lerp(p.bz, tz, t);
      p.y = Math.sin(t * Math.PI) * 2.2 + t * 1.2;
      if (p.comp) {
        const cm = p.comp;
        if (cm.kind === 'family') {
          const u = clamp((p.t - 0.2) / 0.55, 0, 1);
          cm.x = lerp(cm.bx, tx, u); cm.z = lerp(cm.bz, tz, u); cm.y = Math.sin(u * Math.PI) * 2.2 + u * 1.2;
          if (u > 0) cm.h = Math.atan2(tx - cm.bx, tz - cm.bz);
        } else cm.fade = Math.max(0, 1 - p.t / 0.5);
      }
      if (p.t >= 0.8) {
        scene.remove(p.ch.g);
        if (p.comp) scene.remove(p.comp.ch.g);
        patients.splice(i, 1);
        if (!p.boardTo) ev.boarded(p);
      }
    } else if (p.state === 'gone') {
      if (p.t > 1.1) removePatient(scene, p);
    }
  }
}
function patientsRender(t) {
  for (const p of patients) {
    const g = p.ch.g;
    const gone = p.state === 'gone' ? Math.max(0.001, 1 - p.t / 1.1) : 1;
    g.position.set(p.x, (p.y || 0) + groundHeight(p.x, p.z), p.z);
    g.rotation.y = p.h;
    g.scale.setScalar((p.c.kid ? 0.74 : 0.95) * gone);
    if (p.ch.arm) p.ch.arm.rotation.z = 0.5 + Math.sin(t * 9 + p.ph) * 0.4;
    if (p.state === 'wait') {
      if (!p.c.pose) g.position.y += Math.abs(Math.sin(t * 4 + p.ph)) * 0.18;
      const urgent = secLeft(p) < 20;
      const s = 1 + Math.sin(t * (urgent ? 9 : 3) + p.ph) * (urgent ? 0.09 : 0.05);
      p.ring.scale.set(s, s, 1);
      p.bubble.position.set(p.x, (p.c.pose === 'lie' ? 3.6 : 4.8) + Math.sin(t * 2.4 + p.ph) * 0.25, p.z);
      p.beam.material.uniforms.uOpacity.value = (urgent ? 0.42 : 0.32) + Math.sin(t * (urgent ? 8 : 3) + p.ph) * 0.07;
    }
    const cm = p.comp;
    if (cm) {
      const cg = cm.ch.g;
      cg.position.set(cm.x, (cm.y || 0) + groundHeight(cm.x, cm.z), cm.z);
      cg.rotation.y = cm.h;
      cg.scale.setScalar(0.95 * gone * (cm.fade !== undefined ? Math.max(0.001, cm.fade) : 1));
      if (cm.ch.arm) cm.ch.arm.rotation.z = 0.5 + Math.sin(t * 8 + p.ph + 1) * 0.45;
      if (cm.kind === 'cpr' && p.state === 'wait') {
        const k = Math.max(0, Math.sin(t * TAU * 1.8));
        cm.ch.body.rotation.x = 0.55 + k * 0.1;
        cm.ch.body.position.y = -k * 0.12;
      }
    }
  }
}

// ---------- hospitals on the map ----------
const hospMarks = [];
function buildHospitalMarkers(scene) {
  for (const H of HOSPITALS) {
    const [x, z] = H.drop;
    const ring = makeRing(scene, H.hex, 9.5, 1.0);
    ring.position.set(x, groundHeight(x, z) + 0.09, z);
    const beam = makeBeam(scene, H.hex, 3.2, 80, 0);
    beam.position.set(x, 0, z);
    const label = makeLabelSprite(H);
    label.position.set(H.top[0], H.top[1], H.top[2]);
    scene.add(label);
    const pin = makeIconSprite('cross', H.css);
    pin.scale.set(5.5, 5.5, 1);
    pin.visible = false;
    scene.add(pin);
    hospMarks.push({ H, ring, beam, label, pin, x, z });
  }
}
function hospitalsRender(t) {
  // dispatch mode: light up the hospitals the units are heading to
  const dt = G.mode === 'dispatch' ? units.filter((u) => u.state === 'toHosp' || u.state === 'boarding').map((u) => u.dest) : null;
  for (const m of hospMarks) {
    const target = dt ? dt.includes(m.H) : !!riding && riding.dest === m.H;
    const no = (!!riding && riding.rejected.has(m.H.id)) || isDiverted(m.H);
    m.ring.material.opacity = target ? 0.75 + Math.sin(t * 6) * 0.2 : no ? 0.12 : riding ? 0.3 : 0.45;
    const s = target ? 1 + Math.sin(t * 4) * 0.06 : 1;
    m.ring.scale.set(s, s, 1);
    m.beam.visible = target;
    if (target) m.beam.material.uniforms.uOpacity.value = 0.55 + Math.sin(t * 5) * 0.1;
    m.pin.visible = target;
    if (target) m.pin.position.set(m.x, 9 + Math.sin(t * 3) * 0.6, m.z);
  }
}

// ---------- delivered patients walk into the hospital ----------
function addWalker(scene, look, tx, tz, kid, from) {
  if (!look) return;
  const src = from || car;
  const ch = makeCharacter(scene, Object.assign({}, look, { wave: false }), kid ? 0.74 : 0.95);
  const x = src.x - Math.sin(src.h) * 3.2, z = src.z - Math.cos(src.h) * 3.2;
  walkers.push({ ch, x, z, tx, tz, t: 0, s0: ch.g.scale.x, fade: 0 });
}
function walkersStep(scene, dt, t) {
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i];
    w.t += dt;
    const dx = w.tx - w.x, dz = w.tz - w.z, d = hypot(dx, dz);
    if (d > 0.6) { const sp = Math.min(d, 5.5 * dt); w.x += (dx / d) * sp; w.z += (dz / d) * sp; }
    const g = w.ch.g;
    g.position.set(w.x, groundHeight(w.x, w.z) + Math.abs(Math.sin(t * 10)) * 0.25, w.z);
    if (d > 0.6) g.rotation.y = Math.atan2(dx, dz);
    if (d < 0.8 || w.t > 3.4) {
      w.fade += dt;
      g.scale.setScalar(w.s0 * Math.max(0.001, 1 - w.fade / 0.35));
      if (w.fade > 0.35) { scene.remove(g); walkers.splice(i, 1); }
    }
  }
}

// ---------- scoring ----------
function addScore(n) { G.score = Math.max(0, G.score + n); }
function addStunt(name, base) {
  // stunts only pay with a patient on board; without one they would just be noise on screen
  if (G.state !== 'play' || !riding) return;
  G.combo = G.comboT > 0 ? G.combo + 1 : 1;
  G.comboT = 3.5;
  const mult = Math.min(3, 1 + 0.5 * (G.combo - 1));
  const amt = Math.round(base * mult * 0.5);
  addScore(amt);
  riding.tips += amt;
  toast(name + (G.combo > 1 ? ` ×${mult.toFixed(1).replace('.0', '')}` : ''), `+${amt}`);
  sfx.coin();
}
function rankFor(s) {
  // fast deliveries now extend the shift and smooth rides add points, so the bar is a little higher
  if (s >= 1800) return ['S', '傳說救護王'];
  if (s >= 1200) return ['A', '王牌救護員'];
  if (s >= 700) return ['B', '可靠救護員'];
  if (s >= 300) return ['C', '菜鳥救護員'];
  return ['D', '見習生'];
}
const SEEN = new Set(); // case ids met at least once (the case collection)
function logCase(p, outcome, H, extra) {
  if (p.c && !SEEN.has(p.c.id)) { SEEN.add(p.c.id); saveState(); }
  caseLog.push(Object.assign({ c: p.c, name: p.name, outcome, hosp: H || null, cpr: p.cpr }, extra || {}));
}

// ---------- free mode: landmarks to find, hospitals to visit ----------
const LM_GOLD = '#e0a419';
const FOUND = new Set();    // landmark names found (kept between visits)
const VISITED = new Set();  // hospitals stopped at in this free-mode drive
let LM = [];
function buildLandmarkTargets() {
  LM = LANDMARK_LABELS.map(([name, x, z, h, desc, r]) => ({ name, x, z, h, desc, r: r || 48, proj: nearestOnRoads(x, z, (e) => !e.flags.ring && !e.flags.alley) }));
}
function nextLandmark() {
  let best = null, bd = Infinity;
  for (const L of LM) { if (FOUND.has(L.name)) continue; const d = hypot(L.x - car.x, L.z - car.z); if (d < bd) { bd = d; best = L; } }
  return best;
}

// ---------- street names for the road sign ----------
let ZX_PTS = null;
function zhongxiaoZ(x) { // the north/south dividing line (Zhongxiao Road) at x
  if (!ZX_PTS) ZX_PTS = ROADS.find((r) => r.n === '忠孝東西路').pts;
  const P = ZX_PTS;
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return lerp(P[i - 1][1], P[i][1], (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
  return P[P.length - 1][1];
}
function roadLabel(e, x, z) {
  if (e.flags.ring) return '景福門圓環';
  let n = e.name;
  // east/west halves are split at Zhongshan Road, north/south halves at Zhongxiao Road
  if (n.endsWith('東西路')) n = n.slice(0, -3) + (x > (/^(和平|愛國)/.test(n) ? 30 : 92) ? '東路' : '西路');
  else if (n.endsWith('南北路')) n = n.slice(0, -3) + (z > zhongxiaoZ(x) ? '南路' : '北路');
  return n;
}
const PLACE_NAMES = { 凱道: '凱達格蘭大道', 小巨蛋: '臺北小巨蛋', 市政府: '臺北市政府', 臺大圖書館: '臺灣大學', 故宮: '國立故宮博物院', 美麗華: '美麗華百樂園' };
function placeName(x, z) {
  const pr = nearestOnRoads(x, z);
  if (pr.d < pr.e.hw + 1.2) return roadLabel(pr.e, x, z);
  for (const p of PLAZAS) if (sdRoundRect(x, z, p) < 0) return PLACE_NAMES[p.name] || p.name;
  for (const p of PARKS) if (sdRoundRect(x, z, p) < 0) return p.name;
  if (landF(x, z) < 26) { for (const r of RIVERS) if (r.pts.some((q, i) => i && segDist2(x, z, r.pts[i - 1][0], r.pts[i - 1][1], q[0], q[1]) < 75 * 75)) return r.name + '畔'; }
  return pr.d < pr.e.hw + 7 ? roadLabel(pr.e, x, z) : '';
}

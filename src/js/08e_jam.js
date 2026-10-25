// ===================== traffic jams: the weekday evening rush and the weekend crowds =====================
// Every shift happens at a time of the week. On a weekday evening (下班尖峰) the big arterials crawl and the bridges
// home to 士林 back up; at the weekend (週末假日) it is the places people go: 好事多 in 關渡, 美麗華, the night
// markets, 信義 and 西門町. A jammed street is red on the maps and slow in the city. The navigation does not know
// about jams unless the ambulance has the 即時路況 upgrade (the dispatch desk always does), so a crew learns to
// read the map and go round: side streets and alleys never jam.
const TIMES = {
  off: { name: '平日離峰', short: '離峰', icon: 'sun', bonus: 1,
    desc: '平日白天：路上車不多，只有台北車站附近比較擠。' },
  rush: { name: '下班尖峰', short: '尖峰', icon: 'car', bonus: 1.15,
    desc: '平日傍晚下班：忠孝東路、基隆路、建國南北路這些幹道大塞車，回士林的橋頭也塞。走小路、鑽巷子比較快。' },
  weekend: { name: '週末假日', short: '假日', icon: 'person', bonus: 1.1,
    desc: '週末大家出門玩：好事多、美麗華、士林夜市、信義商圈、西門町一帶人車擠成一團，市區幹道反而比較順。' },
};
const TIME_ORDER = ['off', 'rush', 'weekend'];
const JAM_K = 3;      // a fully jammed street costs three times its length, for the routes that know about it
const NAV_W = [0, 0.5, 0.8, 1]; // how much of that the navigation knows, by 即時路況 upgrade level
// the weekday rush: these arterials, in the city south of the 基隆河 (each block jams or not, a little differently every day)
const RUSH_ROADS = [
  ['忠孝東西路', 0.85], ['基隆路', 0.9], ['建國南北路', 0.8], ['南京東西路', 0.75], ['信義路', 0.8], ['民權東西路', 0.7],
  ['復興南北路', 0.65], ['羅斯福路', 0.75], ['中山北路', 0.7], ['承德路', 0.65], ['敦化南北路', 0.55], ['仁愛路', 0.5],
  ['新生南北路', 0.6], ['和平東西路', 0.55],
];
const RUSH_SPOTS = [
  { name: '台北車站', x: 0, z: -3, r: 75, j: 0.75, why: '下班搭車的人潮' },
  { name: '士林橋頭', x: 62, z: -515, r: 72, j: 0.85, why: '過基隆河回士林、北投的車' },
];
const OFF_SPOTS = [{ name: '台北車站', x: 0, z: -3, r: 55, j: 0.45, why: '轉乘的人潮' }];
const WEEKEND_SPOTS = [
  { name: '好事多', x: -806, z: -1446, r: 118, j: 1, kind: 'mall', why: '大家都來推大推車，等停車的車排到大度路上' },
  { name: '美麗華', x: 672, z: -652, r: 100, j: 0.9, kind: 'mall', why: '逛街、看電影、坐摩天輪的人' },
  { name: '士林夜市', x: 110, z: -735, r: 92, j: 0.9, kind: 'market', why: '夜市人潮擠到馬路上' },
  { name: '信義商圈', x: 800, z: 190, r: 108, j: 0.8, kind: 'mall', why: '百貨公司和 101 的人潮' },
  { name: '西門町', x: -185, z: 48, r: 72, j: 0.75, kind: 'mall', why: '看電影、逛街的年輕人' },
  { name: '饒河街夜市', x: 950, z: -100, r: 62, j: 0.7, kind: 'market', why: '排隊買胡椒餅的人' },
  { name: '寧夏夜市', x: -25, z: -127, r: 48, j: 0.6, kind: 'market', why: '攤子擺到路邊' },
  { name: '故宮', x: 553, z: -1002, r: 72, j: 0.55, kind: 'sight', why: '遊覽車一台接一台' },
  { name: '兒童新樂園', x: -95, z: -925, r: 66, j: 0.6, kind: 'sight', why: '帶小孩出來玩的家庭' },
  { name: '花博公園', x: 195, z: -412, r: 60, j: 0.5, kind: 'sight', why: '週末市集' },
];
const JAM = { id: 'off', T: TIMES.off, list: [], spots: [], w: 0, pedEdges: [], warnKey: null, warnT: -99, seen: {}, cur: null, stuck: 0, tick: 0 };
const jamCss = (j) => (j > 0.72 ? '#d9312b' : j > 0.45 ? '#e8712a' : '#e9a92a');

// the shift's time of the week: the player's pick, or a draw
function pickTime() {
  const p = G.tpPick || 'rand';
  if (TIMES[p]) return p;
  const r = Math.random();
  return r < 0.3 ? 'off' : r < 0.68 ? 'rush' : 'weekend';
}
function clearJams() {
  for (const J of JAM.list) { if (J.e.jam === J) J.e.jam = null; J.e.jx = 1; }
  JAM.list.length = 0; JAM.spots.length = 0; JAM.pedEdges.length = 0;
  JAM.cur = null; JAM.stuck = 0; JAM.warnKey = null; JAM.warnT = -99; JAM.seen = {};
  for (const v of traffic) if (v.jamOnly) parkVehicle(v);
}
const jamOK = (e) => !e.flags.alley && !e.flags.campus;
// put a stretch [s0, s1] of e at level j on the list (a street in two zones keeps the worse one)
function addJam(e, s0, s1, j, name, why, kind) {
  if (!jamOK(e) || s1 - s0 < 10 || j < 0.15) return;
  const o = e.jam;
  if (o && o.j >= j) return;
  if (o) JAM.list.splice(JAM.list.indexOf(o), 1);
  const J = { e, s0, s1, j: Math.min(1, j), name, why, kind };
  e.jam = J;
  e.jx = 1 + (JAM_K - 1) * J.j * ((s1 - s0) / e.len);
  JAM.list.push(J);
}
// a zone: every street within r of its centre, worst near the middle
function jamZone(Z, k) {
  for (const e of edges) {
    if (!jamOK(e)) continue;
    let s0 = -1, s1 = -1, jm = 0;
    for (let s = 0; s <= e.len; s += 5) {
      const [x, z] = edgePoint(e, Math.min(s, e.len));
      const d = hypot(x - Z.x, z - Z.z);
      if (d > Z.r) continue;
      const j = Z.j * k * (d < Z.r * 0.5 ? 1 : smoothstep(Z.r, Z.r * 0.5, d));
      if (s0 < 0) s0 = s;
      s1 = Math.min(s, e.len); jm = Math.max(jm, j);
    }
    if (s0 >= 0) addJam(e, Math.max(0, s0 - 4), Math.min(e.len, s1 + 4), jm, Z.name, Z.why, Z.kind || 'spot');
  }
  JAM.spots.push(Object.assign({}, Z, { j: Z.j * k }));
}
function applyTime(id) {
  clearJams();
  if (!TIMES[id]) id = 'off';
  JAM.id = id; JAM.T = TIMES[id];
  const storm = WX.id === 'typhoon' ? 0.55 : 1;
  if (id === 'rush') {
    for (const [name, j0] of RUSH_ROADS) for (const e of edges) {
      if (e.name !== name || !jamOK(e)) continue;
      const [mx, mz] = edgePoint(e, e.len / 2);
      if (mz < -470 || Math.random() < 0.28) continue; // in the city only; some blocks keep moving
      addJam(e, 0, e.len, j0 * grand(0.75, 1.1) * storm, roadLabel(e, mx, mz), '下班車潮', 'rush');
    }
    for (const Z of RUSH_SPOTS) jamZone(Z, storm);
  } else if (id === 'weekend') {
    const night = WEATHERS[WX.id].night > 0;
    for (const Z of WEEKEND_SPOTS) jamZone(Z, (Z.kind === 'market' ? (night ? 1.12 : 0.7) : Z.kind === 'sight' && night ? 0.5 : 1) * storm * grand(0.88, 1.08));
  } else for (const Z of OFF_SPOTS) jamZone(Z, 1);
  // more people on the pavements round the weekend crowds
  JAM.pedEdges = id === 'weekend' ? PED_EDGES.filter((e) => e.jam && e.jam.kind !== 'rush') : [];
  JAM.w = G.mode === 'dispatch' ? 1 : NAV_W[lv('nav')];
  routesChanged();
}
// the route-cost factor of a street (only as much as the navigation knows about)
const jamF = (e) => (e.jx > 1 ? 1 + (e.jx - 1) * JAM.w : 1);
// how slowly traffic on a jammed stretch moves: stop and go, in waves along the street
function jamLimit(v) {
  const J = v.e.jam;
  if (!J || v.s < J.s0 - 8 || v.s > J.s1 + 8) return Infinity;
  const wave = 0.25 + 0.75 * Math.max(0, Math.sin(G.t * 0.55 - v.s * 0.07 + v.e.idx * 1.7));
  return lerp(v.base, 0.8 + 4.6 * wave, J.j);
}
const jamAt = (v) => { const J = v.e.jam; return J && v.s >= J.s0 - 8 && v.s <= J.s1 + 8 ? J.j : 0; };

// ---------- the extra cars that pack the jams (a separate pool, parked when no jam is near) ----------
const JAM_MIX = [['taxi', 0xf2c230, 12], ['car', 0xf4f4f2, 10], ['car', 0xb8bec4, 8], ['car', 0x2f3540, 6], ['car', 0x3a5f8f, 4], ['car', 0xd9473d, 3], ['van', 0xffffff, 3], ['bus', 0xf4f4f0, 2], ['scooter', 0xf4f4f2, 5], ['scooter', 0x2f3540, 4], ['scooter', 0xe9524a, 3], ['scooter', 0x3a7fd5, 2]];
function parkVehicle(v) { v.off = true; v.x = 1e5; v.z = 1e5; v.g.visible = false; v.yield = false; }
function placeJamVehicle(v, fx, fz, r0, r1) {
  // the stretches near the ambulance get most of the pool, so the jam it is in (or heading into) is packed
  const near = [];
  for (const J of JAM.list) {
    const [x, z] = edgePoint(J.e, (J.s0 + J.s1) / 2), d = hypot(x - fx, z - fz);
    if (d < r1 + (J.s1 - J.s0) / 2) near.push({ J, w: J.j * J.j * (J.s1 - J.s0) / (1 + (d / 70) * (d / 70)) });
  }
  if (!near.length) { parkVehicle(v); return false; }
  for (let tries = 0; tries < 14; tries++) {
    const J = gwpick(near, (q) => q.w).J;
    const s = grand(J.s0 + 3, J.s1 - 3);
    if (!(s > 2 && s < J.e.len - 2)) continue;
    const [px, pz] = edgePoint(J.e, s);
    const d = hypot(px - fx, pz - fz);
    if (d < r0 || d > r1 || inView(px, pz)) continue;
    const dir = Math.random() < 0.5 ? 1 : -1;
    v.e = J.e; v.s = s; v.dir = dir;
    snapVehicle(v);
    if (traffic.some((o) => o !== v && !o.off && Math.abs(o.x - v.x) < 6.4 && Math.abs(o.z - v.z) < 6.4)) continue;
    v.cur = 1; v.stun = 0; v.stuckT = 0; v.init = false; v.stubborn = 0; v.off = false; v.g.visible = true;
    return true;
  }
  parkVehicle(v);
  return false;
}

// ---------- the shift: entering a jam, the navigation warning, time lost in traffic ----------
function jamStep(dt) {
  if (G.mode === 'dispatch' || !JAM.list.length || G.state !== 'play') return;
  if ((JAM.tick -= dt) > 0) return;
  JAM.tick = 0.2;
  const pr = nearestOnRoads(car.x, car.z);
  const J = pr && pr.d < pr.e.hw + 1.5 && pr.e.jam && pr.s >= pr.e.jam.s0 - 4 && pr.s <= pr.e.jam.s1 + 4 ? pr.e.jam : null;
  if (J && J !== JAM.cur && !(JAM.seen[J.name] > G.t)) {
    JAM.seen[J.name] = G.t + 45;
    toast(`${iconSVG('car', '#ffffff', 15)} ${J.kind === 'rush' ? '下班車潮' : JAM.id === 'weekend' ? '假日人潮' : '車多'}：${J.name}・${J.why}`, '', false, jamCss(J.j));
    if (!SHIFT.jamTip && G.mode === 'mission') {
      SHIFT.jamTip = true;
      setTimeout(() => { if (G.state === 'play') bubble('調度中心', `陷在車陣裡了！鳴笛時車子會<b>慢慢</b>往兩邊擠，從中間鑽過去；或看地圖上的<b>紅色路段</b>，改走旁邊的小路、巷子。`, '#d9312b', 6, 'car'); }, 400);
    }
  }
  JAM.cur = J;
  // time lost: crawling in a jam with a patient on board, or on the way to one
  if (J && car.speed < 5 && G.mode === 'mission' && (riding || guide.kind === 'call')) {
    JAM.stuck += 0.2;
    if (riding) riding.jamT = (riding.jamT || 0) + 0.2;
    if (JAM.stuck >= 90) award('gridlock');
  }
}
// the guide's route goes through a jam: say so once for each new destination
function jamWarn(es, kind, to) {
  let len = 0;
  const names = [];
  for (const e of es) {
    const J = e.jam;
    if (!J || J.j < 0.4) continue;
    len += (J.s1 - J.s0) * J.j;
    if (!names.includes(J.name)) names.push(J.name);
  }
  if (G.mode === 'dispatch' || !kind || kind === 'lm') return len;
  const key = `${kind}:${to.e.idx}:${Math.round(to.s / 20)}`;
  if (len > 35 && key !== JAM.warnKey && G.state === 'play' && G.t > JAM.warnT) {
    JAM.warnKey = key; JAM.warnT = G.t + 14;
    const nav = JAM.w >= 1 ? '這已經是最快的路了，' : JAM.w > 0 ? '導航只知道一部分路況，' : '導航不知道哪裡塞車，';
    bubble('調度中心', `導航路線會經過<b>${names.slice(0, 2).join('、')}</b>的車陣（${JAM.T.name}）。${nav}看看地圖上的紅色路段，從旁邊的路或巷子繞過去可能比較快。`, '#d9312b', 6.5, 'car');
  }
  return len;
}
// the time-of-week buttons: on the briefing (mission and dispatch) and on the free-mode start screen
function renderTpPick() {
  const show = G.briefMode === 'start' || G.briefMode === 'dispatch';
  UI.tpPick.hidden = !show;
  const cur = TIMES[G.tpPick] ? G.tpPick : 'rand';
  const html = [['rand', '隨機'], ...TIME_ORDER.map((k) => [k, TIMES[k].name])]
    .map(([id, n]) => `<button class="hp${id === cur ? ' on' : ''}" type="button" data-tp="${id}" aria-pressed="${id === cur}">${id !== 'rand' ? iconSVG(TIMES[id].icon, id === cur ? '#ffffff' : INK, 14) : ''}${n}</button>`).join('');
  const T = TIMES[cur];
  const note = T ? T.desc + (T.bonus > 1 ? `得分 ×${T.bonus}。` : '') : '每一班隨機：平日離峰、下班尖峰或週末假日。塞車的地方不一樣，要學會看地圖繞路。';
  UI.tpRow.innerHTML = html; UI.tpNote.textContent = note;
  UI.tpRow2.innerHTML = html; UI.tpNote2.textContent = T ? T.desc : '每次出發隨機：平日離峰、下班尖峰或週末假日，塞車的地方不一樣。';
}
// a new shift: its time of week, and the crew is told
function beginShiftTime() {
  applyTime(pickTime());
  if (JAM.id === 'off' || G.mode === 'free') return;
  setTimeout(() => {
    if (G.state !== 'play' && G.state !== 'countdown' && G.state !== 'dchoose') return;
    const top = JAM.spots.slice().sort((a, b) => b.j - a.j).slice(0, 3).map((Z) => Z.name);
    const where = JAM.id === 'rush' ? '忠孝東路、基隆路、建國南北路等幹道' : top.join('、');
    bubble('交通資訊', `<b>${JAM.T.name}</b>：${where}一帶塞車。${G.mode === 'dispatch' ? '派車時看清楚預估車程，最近的車不一定最快到。' : '地圖上紅色的路段是車陣。'}${JAM.T.bonus > 1 ? `（得分 ×${JAM.T.bonus}）` : ''}`, '#c0392b', 7, 'car');
  }, G.mode === 'mission' ? 8600 : 6000);
}
// maps: jammed stretches in orange to red, under everything else
function drawJams(g, P, px, big) {
  if (!JAM.list.length) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const w0 = px * (big ? 6 : 4.4);
  const path = (J) => { g.beginPath(); for (let s = J.s0, k = 0; s <= J.s1 + 0.01; s += 4, k++) { const [x, z] = edgePoint(J.e, Math.min(s, J.s1)); const [qx, qy] = P(x, z); if (k) g.lineTo(qx, qy); else g.moveTo(qx, qy); } };
  // a dark casing first, so the colour reads on the pale map
  g.strokeStyle = '#5a1f14'; g.globalAlpha = 0.35;
  for (const J of JAM.list) { g.lineWidth = w0 * (0.75 + 0.25 * J.j) + px * 1.6; path(J); g.stroke(); }
  g.globalAlpha = 0.92;
  for (const J of JAM.list) { g.strokeStyle = jamCss(J.j); g.lineWidth = w0 * (0.75 + 0.25 * J.j); path(J); g.stroke(); }
  g.globalAlpha = 1;
}

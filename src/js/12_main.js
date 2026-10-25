// ===================== boot, events, game flow, camera, main loop =====================
let renderer = null, scene = null, camera = null, sun = null, hemi = null;
const SUN_OFF = new THREE.Vector3(-70, 120, 55);
const SKY = 0x9fd3e3;
const camState = { yaw: Math.PI / 2, shake: 0, attract: 0.6, px: 0, pz: 0 };
let START = { x: 60, z: 36, h: Math.PI / 2 };
let quality = { pr: 1, slowT: 0, frames: 0, acc: 0 };
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function loadSaved() { try { return JSON.parse(localStorage.getItem('crazy-ambulance-v1') || '{}') || {}; } catch (e) { return {}; } }
const persisted = () => ({ best: G.best, bestD: G.bestD || 0, muted: G.muted, music: G.music !== false, city: 1, found: [...FOUND], rt: !!G.rt, trials: TRIALS, seen: [...SEEN], view: G.view || 'top', medals: MEDAL_WON, intro: !!G.introSeen, home: G.homePick || 'rand', wx: G.wxPick || 'rand', tp: G.tpPick || 'rand', bank: G.bank || 0, upg: UPG_LV, addr: ADDR_BEST });
function saveState() { try { localStorage.setItem('crazy-ambulance-v1', JSON.stringify(persisted())); } catch (e) { /* storage unavailable */ } }

function init(data) {
  const saved = loadSaved();
  // scores from the island version used a different scale, so only keep a city best
  G.best = Math.max(data.city ? data.best || 0 : 0, saved.city ? saved.best || 0 : 0);
  G.muted = data.muted !== undefined ? !!data.muted : !!saved.muted;
  for (const n of [...(saved.found || []), ...(data.found || [])]) FOUND.add(n);
  G.bestD = Math.max(saved.bestD || 0, data.bestD || 0);
  G.rt = data.rt !== undefined ? !!data.rt : !!saved.rt;
  G.music = (data.music !== undefined ? data.music : saved.music) !== false;
  G.view = data.view || saved.view || 'top';
  if (!VIEWS[G.view]) G.view = 'top';
  Object.assign(TRIALS, saved.trials || {}, data.trials || {});
  for (const src of [saved.medals || {}, data.medals || {}]) for (const k in src) if (MEDAL_BY[k]) MEDAL_WON[k] = Math.max(MEDAL_WON[k] || 0, src[k] | 0);
  G.introSeen = !!(saved.intro || data.intro);
  G.homePick = data.home || saved.home || 'rand';
  G.wxPick = data.wx || saved.wx || 'rand';
  G.tpPick = data.tp || saved.tp || 'rand';
  Object.assign(ADDR_BEST, saved.addr || {}, data.addr || {});
  G.bank = Math.max(saved.bank || 0, data.bank || 0);
  for (const src of [saved.upg || {}, data.upg || {}]) for (const k in src) if (UPG_BY[k]) UPG_LV[k] = Math.max(UPG_LV[k] || 0, Math.min(3, src[k] | 0));
  for (const id of [...(saved.seen || []), ...(data.seen || [])]) SEEN.add(id);
  initUI();
  initDispatchUI();
  updateViewButtons();
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(persisted); } catch (e) { /* no hot reload */ }
  setTimeout(buildWorld, 40);
}

function buildWorld() {
  try {
    const t0 = performance.now();
    const canvas = $('gl');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    quality.pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(quality.pr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    initMaterials();
    buildRoadGraph();
    buildFields();
    buildFieldTexture();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, 420, 780);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1200);
    hemi = new THREE.HemisphereLight(0xfff8ec, 0x8f9a70, 0.64);
    sun = new THREE.DirectionalLight(0xfff0d8, 0.52);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -64; sc.right = 64; sc.top = 64; sc.bottom = -64; sc.near = 20; sc.far = 340;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    scene.add(hemi, sun, sun.target);
    const marks = [];
    const mark = (n) => marks.push(n + ':' + Math.round(performance.now() - t0));
    buildSky(scene);
    buildTerrain(scene); mark('terrain');
    buildCity(scene); mark('city');
    flushStatic(scene); mark('flush');
    buildPropMeshes(scene);
    buildAmbulance(scene);
    makeUnits(scene);
    spawnTraffic(scene); mark('traffic');
    buildKnockables(scene);
    spawnPeds(scene, 54); mark('peds');
    buildFX(scene);
    buildNightFX(scene);
    applyWeather('day');
    buildSpawnPoints();
    buildDistricts();
    buildHospitalMarkers(scene);
    buildLandmarkLabels(scene);
    buildMinimapImage();
    buildLandmarkTargets();
    for (const n of [...FOUND]) if (!LM.some((L) => L.name === n)) FOUND.delete(n);
    // start on Zhongxiao West Road in front of Taipei Main Station, heading east
    const sp = nearestOnRoads(60, 34, (e) => e.name === '忠孝東西路');
    const [px, pz, tx, tz] = edgePoint(sp.e, sp.s);
    const dx = tx >= 0 ? tx : -tx, dz = tx >= 0 ? tz : -tz;
    START = { x: px - dz * 3, z: pz + dx * 3, h: Math.atan2(dx, dz) };
    carReset(START.x, START.z, START.h);
    camState.yaw = START.h;
    if (document.fonts && document.fonts.load) {
      Promise.all([
        // every string drawn into canvas textures, so all the CJK font subsets arrive before the redraw
        document.fonts.load('52px "Huninn"', [...HOSPITALS.map((h) => h.name), ...Object.values(LEVELS).map((l) => l.full), ...LANDMARK_LABELS.map((l) => l[0]), ...SIGN_H, ...SIGN_V, ...STATIONS.map((S) => S.unit + S.name), '急診救護車站高級出發點・空窗壅塞滿床分隊',
          ...ALLEYS.map((a) => a.n), '公車站慢郵政道路施工請減速慢行中注意安全閒人勿進共自行租賃機停等區門診', ...FOOD_SIGNS.map((f) => f[0]), ...LANDMARK_SIGNS.map((L) => L.text),
          ...BRANDS.map((B) => B.name + (B.sub || '')), ...SAY_PED, '叭逼—', ...ROADS.map((r) => r.n)].join('')),
        document.fonts.load('700 92px "Fredoka"', '119H'),
      ]).then(() => fontTextures.forEach((f) => f.redraw())).catch(() => {});
    }
    window.addEventListener('resize', onResize);
    onResize();
    console.log('[ambulance] city built in', Math.round(performance.now() - t0), 'ms;', marks.join(' '), '; colliders', colliders.length, 'signals', SIGNALS.size, 'heads', lampHeads.length);
    UI.loading.hidden = true;
    introGate();
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    UI.loadingText.textContent = '這台裝置無法載入 3D 畫面，請換一個瀏覽器再試一次。';
  }
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  applyViewOffset();
  VIEW.ox = VIEW.tx; VIEW.oy = VIEW.ty;
  const mm = UI.minimap;
  const px = Math.round((mm.clientWidth || 120) * Math.min(window.devicePixelRatio || 1, 3));
  if (mm.width !== px) { mm.width = px; mm.height = px; }
  if (!UI.bigmap.hidden) drawBigMap();
}

// ---------- who talks from the back of the ambulance ----------
const RIDE_LINES = {
  medic: ['開穩一點！後面在急救！', '點滴差點掉了啦！', '我們是要救人，不是要撞車！'],
  patient: ['哎喲！好痛…', '慢一點啦，我還想活著到醫院！', '司機！你有駕照嗎！', '這比我的病還可怕…'],
  kid: ['嗚哇——好可怕！', '叔叔開慢一點啦！'],
};
function rideSay() {
  if (!riding || G.state !== 'play') return;
  const p = riding, c = p.c;
  const [who, k] = c.pose === 'lie' ? ['隨車救護員', 'medic'] : c.kid ? [p.name, 'kid'] : [p.name, 'patient'];
  bubble(who, gpick(RIDE_LINES[k]), TRIAGE[c.tri].css, 1.8);
}

// ---------- events from the simulation ----------
// a hard hit with a patient on board shakes them up and costs them time
function jolt(k) {
  if (!riding || G.state !== 'play' || k < 12 || G.joltT > G.t) return;
  G.joltT = G.t + 0.6;
  const loss = k > 24 ? 7 : 4;
  riding.life -= Math.max(1, Math.round(loss * DRV.bump));
  riding.bumps = (riding.bumps || 0) + 1;
  toast(`撞擊！病人 −${Math.max(1, Math.round(loss * DRV.bump))} 秒`, '', true);
  if (riding.bumps >= 4) award('carsick');
}
const ev = {
  crash(k, x, z) {
    if (G.crashT > 0) return;
    G.crashT = 0.3;
    jolt(k);
    sfx.crash(k);
    if (!reduceMotion) camState.shake = Math.min(1, k / 22);
    for (let i = 0; i < 6; i++) puff(x, 1 + Math.random(), z, grand(-4, 4), grand(1, 4), grand(-4, 4), grand(0.5, 0.9), grand(0.5, 0.8), 0xf3efe6, -2);
    if (k > 11 && Math.random() < 0.7) rideSay();
  },
  land(airT, impact) {
    if (impact > 4) sfx.land(impact);
    if (impact > 14) jolt(impact);
    if (impact > 6) for (let i = 0; i < 8; i++) puff(car.x + grand(-2, 2), 0.4, car.z + grand(-2, 2), grand(-5, 5), grand(1, 3), grand(-5, 5), grand(0.5, 0.9), grand(0.4, 0.7), 0xe7dfcf, -1);
    if (!reduceMotion) camState.shake = Math.max(camState.shake, Math.min(0.6, impact / 30));
    if (airT > 0.55) {
      G.bestAir = Math.max(G.bestAir, airT);
      addStunt(airT > 1.1 ? '飛越天際！' : '飛起來了！', 15 + airT * 70);
    }
  },
  sink() {
    sfx.splash();
    for (let i = 0; i < 26; i++) puff(car.x + grand(-2, 2), WATER_Y + 0.5, car.z + grand(-2, 2), grand(-6, 6), grand(6, 14), grand(-6, 6), grand(0.4, 0.9), grand(0.6, 1.1), Math.random() < 0.5 ? 0xffffff : 0xbff1ee, -22, 0.6);
    if (G.state === 'play') { G.time -= 3; flashTimerPlus(-3); bigMsg('噗通！', '救護車掉進河裡　−3 秒', 1.6); award('river'); }
  },
  drift(t) { if (t > 0.7) addStunt(t > 1.8 ? '超級甩尾！' : '甩尾！', 10 + t * 28); },
  hitCar(k, x, z, v) {
    jolt(k);
    if (v) hornAt(v, 'hit');
    if (G.state === 'play' && G.mode !== 'dispatch') { tally('hit', 10, 'bumper'); crashAfterRed(k); }
    sfx.crash(k * 0.8);
    for (let i = 0; i < 6; i++) puff(x, 1.2, z, grand(-4, 4), grand(1, 4), grand(-4, 4), grand(0.5, 0.9), grand(0.5, 0.8), 0xf3efe6, -2);
    if (!reduceMotion) camState.shake = Math.min(0.8, k / 22);
    rideSay();
  },
  nearMiss(v) { addStunt('好險擦過！', 20); if (v) hornAt(v, 'near'); },
  knock(k) {
    sfx.bump();
    if (G.state === 'play' && G.mode !== 'dispatch') tally('knock', 12, 'bowling');
    for (let i = 0; i < 4; i++) puff(k.x, 0.8, k.z, grand(-3, 3), grand(1, 3), grand(-3, 3), grand(0.4, 0.7), 0.5, 0xf3efe6, -1);
  },
  pedDodge(p) {
    if (Math.random() < 0.5) sfx.pop();
    pedYelp(p);
    // a close call at speed: someone had to dive out of the way
    if (G.state === 'play' && G.mode !== 'dispatch' && car.speed > 13 && hypot(p.x - car.x, p.z - car.z) < 4.6) tally('peds', 6, 'peds');
  },
  boarding(p) {
    G.boarding = true;
    p.eval = evaluateChoices(p, G.home);
    sfx.pickup();
  },
  boarded(p) {
    G.boarding = false;
    if (G.state !== 'play') { logCase(p, 'handover', null, {}); return; }
    riding = p;
    if (selCall === p) selCall = null;
    if (p.rate > 1) { p.rate = 1; toast('救護員接手 CPR，時間不再流逝得那麼快', ''); }
    G.callT = Math.min(G.callT, 7);
    updateGuide(true);
    openDest(p.c.fake ? 'fake' : 'board');
  },
  callLost(p) {
    if (p.mciLead) { mciMissed(p); return; }
    removePatientVisuals(scene, p);
    p.state = 'gone'; p.t = 0;
    if (selCall === p) selCall = null;
    if (p.c.tri === 'green') {
      G.left++;
      toast(`${p.name}：家屬自行送醫了`, '');
      logCase(p, 'left', null, { note: '輕症病人可以自行就醫，把救護車留給危急的人。' });
    } else {
      G.dead++;
      addScore(-30);
      sfx.sad();
      toast(`${p.name}（${p.c.short}）沒等到救護車…`, '−30', true);
      // the crew was out of its own district (a far hospital, cross-district help) while this call waited at home
      const away = G.home !== undefined && p.dist === G.home && districtOf(nearestOnRoads(car.x, car.z, (e) => !e.flags.campus && !e.flags.alley)) !== G.home;
      logCase(p, 'dead', null, { note: p.rate > 1 ? '沒有人做 CPR 的心跳停止，時間流逝得特別快，要最優先趕過去。'
        : away ? `救護車跨區送醫，還沒回到${distName(G.home)}，轄區裡的病人只能乾等。選醫院時也要想想回程。` : '同時有好幾通 119 時，要先救最危急、又來得及的人。' });
    }
    updateGuide(true);
  },
};

// ---------- arriving at a hospital ----------
const dwell = { m: null, t: 0 };
function checkArrival(dt) {
  if (car.speed > 4.2 || car.airborne || car.sinking) { dwell.m = null; return; }
  let here = null;
  for (const m of hospMarks) if (hypot(car.x - m.x, car.z - m.z) < 9.6) { here = m; break; }
  if (here && isDiverted(here.H)) {
    if ((G.divToastT || 0) < G.t) { G.divToastT = G.t + 4; toast(`${here.H.name}：急診滿床，請改送其他醫院`, '', true); }
    dwell.m = null; return;
  }
  if (!here || riding.rejected.has(here.H.id)) { dwell.m = null; return; }
  if (dwell.m !== here) { dwell.m = here; dwell.t = 0; }
  dwell.t += dt;
  // the chosen hospital accepts at once; others need a deliberate stop
  if (riding.dest === here.H || dwell.t > 0.6) {
    dwell.m = null;
    if (accepts(here.H, riding.c)) deliverAt(here);
    else rejectAt(here);
  }
}
const REJECT_LOSS = 15;
function rejectAt(m) {
  const p = riding, H = m.H;
  p.rejected.add(H.id);
  G.rejects++;
  tally('reject', 3, 'transfer');
  addScore(-20);
  sfx.reject();
  if (p.dest === H) p.dest = null;
  p.life -= REJECT_LOSS; // the detour is on top of this: paperwork, handover and back on the road
  toast(H.noER ? `${H.name}：不收 119 急診！病人 −${REJECT_LOSS} 秒` : `${H.name}：需要轉院！病人 −${REJECT_LOSS} 秒`, '−20', true);
  if (H.noER) award('pilgrim');
  if (p.life <= 0) { riderDied(); return; }
  openDest('reject', H);
}
// after a turn-away: what went wrong (a cancer hospital is not an emergency hospital at all)
function wrongNote(p) {
  const K = HOSPITALS.find((Hh) => Hh.noER && p.rejected.has(Hh.id));
  if (K) return `${K.name}是癌症專科醫院，不是急救責任醫院，119 不會把急診病人送去那裡；送醫前先看清楚醫院的分級。`;
  return '第一次送錯醫院就得轉院，會浪費寶貴的時間。';
}
function idealNote(p, H) {
  const best = HOSPITALS[p.eval.best];
  if (!best || best === H) return '';
  const W = p.eval.waits || [], w = W[HOSPITALS.indexOf(H)] || 0, wb = W[p.eval.best] || 0;
  if (p.c.tri === 'green' && H.level === 'severe' && best.level !== 'severe') return `輕症送${best.name}這類區域或地區醫院就好，把醫學中心的急診留給重症病人。`;
  if (w >= 4 && w > wb + 2) return `${H.name}急診壅塞，要等床才能交接；${best.name}${wb < 2 ? '比較順暢' : '等得比較短'}，也能處理這種病人。`;
  if (G.mode === 'mission' && farFromHome(H, G.home) && !farFromHome(best, G.home)) return `${H.name}離${distName(G.home)}很遠（跨區），回程要很久；${best.name}比較近，也能處理這種病人。`;
  return `${best.name}比較近，也能處理這種病人。`;
}
// a crowded ER: the crew waits with the patient on the stretcher until a bed frees up (the world runs fast meanwhile)
const HOLD_FF = 4;
const BONUS_CAP = 0.55;
function startHandoff(H, wait) {
  G.hold = { H, t: wait, t0: wait };
  car.vx = car.vz = 0;
  toast(`${H.name}急診壅塞：等床交接 ${wait} 秒`, '', true);
}
function handoffStep(dt) {
  const h = G.hold;
  if (!h) return;
  car.vx = car.vz = 0;
  h.t -= dt;
  if (h.t <= 0) { G.hold = null; toast('交接完成，可以出發了！', ''); updateGuide(true); }
}
function deliverAt(m) {
  const p = riding, H = m.H, c = p.c;
  if (c.fake) { deliverFake(m); return; }
  const wait = erWait(H);
  G.waitSum = (G.waitSum || 0) + wait;
  if (wait >= 2) G.waitN = (G.waitN || 0) + 1;
  if (p.xd) G.xdN = (G.xdN || 0) + 1;
  const first = p.rejected.size === 0;
  const ideal = first && p.eval.ideal.includes(HOSPITALS.indexOf(H));
  const frac = p.life / p.life0;
  const rating = frac >= 0.45 ? 2 : frac >= 0.2 ? 1 : 0;
  const smooth = !p.bumps;
  // rain, night and typhoon shifts pay more
  const pts = Math.round((100 + [0, 20, 50][rating] + (ideal ? 50 : 0) + (smooth ? 40 : 0)) * WX.cur.bonus * JAM.T.bonus);
  addScore(pts);
  G.saved++;
  if (ideal) G.ideal++;
  if (rating === 2) G.fast++;
  if (first) G.firstTry++;
  if (smooth) G.smooth = (G.smooth || 0) + 1;
  // skill buys time: a fast, well-chosen delivery adds up to 24 s to the shift, but never more than about half the
  // time the call took (so a run of calls round the corner cannot stretch a shift forever)
  const cycle = (G.cycleT !== undefined ? G.cycleT : START_TIME) - G.time;
  const bonus = Math.max(4, Math.min(8 + (ideal ? 4 : 0) + [0, 4, 12][rating], Math.round(cycle * BONUS_CAP)));
  G.time += bonus; flashTimerPlus(bonus);
  G.cycleT = G.time;
  bigMsg(['好險送到！', '順利送達！', '神速送達！'][rating], `+${pts} 分　+${bonus} 秒`);
  sfx.deliver(rating);
  confetti(m.x, 3, m.z, [H.css, '#ffffff', '#f2c14e', '#7cc4e8', '#f28fb0'], 70);
  addWalker(scene, p.look, H.signPos[0], H.signPos[2], c.kid);
  let note = first ? (ideal ? '' : idealNote(p, H)) : wrongNote(p);
  if (p.overNote) note = (note ? note + ' ' : '') + p.overNote;
  let plus = [c.cpr && p.cpr ? '路人立刻做了 CPR，幫病人多爭取了時間！' : ideal ? '選得好！這是最適合的醫院。' : '', smooth ? '一路平穩沒有碰撞 +40' : ''].filter(Boolean).join(' ');
  // medals
  if (c.id === 'ohca') {
    award('ohca');
    plus += '　救心英雄！真實世界裡，被救回的病人康復出院後，常回到消防分隊向救護員道謝。';
    if (p.cpr) note = (note ? note + ' ' : '') + '怕壓斷肋骨被告？2013 年《緊急醫療救護法》修法保障善意施救的民眾，「救人不受罰」。';
  }
  if (c.id === 'choke') award('heimlich');
  // the navigation's route went through a jam, but the crew found a way round it
  if (p.legJam > 35 && (p.jamT || 0) < 4) { tally('detour', 2, 'detour'); plus += (plus ? ' ' : '') + '繞過車陣，沒被塞住！'; }
  if (p.legEta > 10 && p.legT - G.time + bonus < p.legEta * 0.8) award('fast');
  SHIFT.streak = first && ideal ? SHIFT.streak + 1 : 0;
  if (SHIFT.streak >= 4) award('triage');
  if (smooth && ++SHIFT.smooth >= 3) award('smooth');
  if (G.saved >= 6) award('busy');
  if (wait >= 4 && !note.includes('壅塞')) note = (note ? note + ' ' : '') + `${H.name}急診壅塞，等床 ${wait} 秒才交接完；這段時間救護車哪裡都去不了。`;
  showCaseCard({ tri: c.tri, title: '救活了！', pts: `+${pts}`, name: p.name, dx: c.dx, why: c.why, note, plus });
  logCase(p, 'saved', H, { ideal, note, wait });
  riding = null;
  erAdmit(H, c);
  if (c.tri === 'green' && H.level === 'severe') tally('greenSevere', 3, 'bigname');
  G.combo = 0; G.comboT = 0;
  if (wait >= 2) startHandoff(H, wait);
  updateGuide(true);
  G.callT = Math.min(G.callT, 3);
}
function riderDied() {
  const p = riding, c = p.c;
  riding = null;
  dwell.m = null;
  if (c.tri === 'green') {
    G.left++;
    bubble(p.name, '等太久了…我自己去診所好了！', TRIAGE.green.css, 2.6);
    toast('病人自己下車了', '');
    addWalker(scene, p.look, car.x + Math.cos(car.h) * 30, car.z - Math.sin(car.h) * 30, c.kid);
    logCase(p, 'left', null, {});
  } else {
    G.dead++;
    addScore(-50);
    sfx.sad();
    bigMsg('病人不幸過世…', '', 2.2);
    let note = '下次試著更快抵達，或選更近又能處理的醫院。';
    if (p.rejected.size) note = HOSPITALS.some((Hh) => Hh.noER && p.rejected.has(Hh.id)) ? wrongNote(p) : '送錯醫院、轉院花掉了太多時間。';
    else if (c.cpr && !p.cpr) note = '沒有人做 CPR 的心跳停止，存活時間非常短。學會「叫叫壓電」，你也能救人！';
    else if ((p.bumps || 0) >= 2) note = `一路上撞了 ${p.bumps} 次，每次撞擊都讓病人更危險。開穩一點也是在救人。`;
    else if (p.dest && p.eval && !p.eval.ideal.includes(HOSPITALS.indexOf(p.dest))) note = `${HOSPITALS[p.eval.best].name}比較近，也能處理這種病人。`;
    showCaseCard({ tri: c.tri, title: '不幸過世', pts: '−50', name: p.name, dx: c.dx, why: c.why, note, bad: true });
    logCase(p, 'dead', p.dest, { note });
  }
  updateGuide(true);
  G.callT = Math.min(G.callT, 3);
}
// "I'm stuck": put the ambulance back on the nearest road, facing along the route
let resetCD = 0;
function resetCar() {
  if (G.mode === 'dispatch' || (G.state !== 'play' && G.state !== 'countdown') || car.sinking || G.t < resetCD) return;
  resetCD = G.t + 1.5;
  respawnCar();
  toast('救護車放回路上了', '');
}
function respawnCar() {
  const from = nearestOnRoads(car.x, car.z);
  const [x, z, tx, tz] = edgePoint(from.e, clamp(from.s, 4, from.e.len - 4));
  let h = Math.atan2(tx, tz);
  const gp = guidePoint(30);
  if (gp && (gp[0] - x) * tx + (gp[1] - z) * tz < 0) h += Math.PI;
  carReset(x, z, h);
  camState.yaw = h;
  for (let i = 0; i < 10; i++) puff(x + grand(-2, 2), 1, z + grand(-2, 2), grand(-3, 3), grand(2, 5), grand(-3, 3), grand(0.6, 1), 0.7, 0xffffff, -1);
}

// an ER does not go on diversion right in front of an ambulance that is just pulling in
ER.protect = (H) => (G.mode === 'dispatch'
  ? units.some((u) => u.state === 'toHosp' && u.dest === H && u.route && u.route.len - u.s < 90)
  : !!riding && riding.dest === H && hypot(car.x - H.drop[0], car.z - H.drop[1]) < 140);
// the hospital we were driving to just went on diversion: pick another one
function onDivertMission(H) {
  if (!riding || riding.dest !== H) return;
  riding.dest = null;
  updateGuide(true);
  openDest('divert', H);
}

// ---------- game flow ----------
function clearRun() {
  for (const p of patients.slice()) removePatient(scene, p);
  patients.length = 0;
  for (const w of walkers) scene.remove(w.ch.g);
  walkers.length = 0;
  riding = null; selCall = null; dwell.m = null;
  G.boarding = false; G.hold = null;
  SIREN.t = 0;
  if (UI.dest) UI.dest.hidden = true;
  clearDispatch();
  clearRoadEvents();
  clearMCI();
  resetShift();
  if (car.group) car.group.visible = true;
}
// the point the camera and the traffic pools follow
function focusPoint() {
  if (G.mode === 'dispatch' && dsel) return [dsel.x, dsel.z];
  return [car.x, car.z];
}
const CAM_T = { x: 0, z: 0, y: 0, h: 0, speed: 0, vF: 0, airborne: false };
function camTarget() {
  if (G.mode !== 'dispatch' || !dsel) return car;
  // while a 119 call is on screen, look at the caller; otherwise follow the selected unit
  const c = G.state === 'dchoose' && dcur && dcur.type === 'call' ? dcur.c : null;
  const u = G.state === 'dchoose' && dcur && dcur.type === 'scene' ? dcur.u : dsel;
  if (c) Object.assign(CAM_T, { x: c.x, z: c.z, h: camState.yaw, speed: 0, vF: 0 });
  else Object.assign(CAM_T, { x: u.x, z: u.z, h: u.h, speed: u.v, vF: u.v });
  return CAM_T;
}
// dispatch mode keeps the 3D view centred in the part of the screen the console (and an open decision) leaves free
const VIEW = { ox: 0, oy: 0, tx: 0, ty: 0 };
function applyViewOffset() {
  VIEW.tx = VIEW.ty = 0;
  if (!camera || G.mode !== 'dispatch' || !UI.dhud || UI.dhud.hidden) return;
  const w = window.innerWidth, h = window.innerHeight;
  let x0 = 0, y0 = 0, x1 = w, y1 = h;
  const con = UI.dsheet.getBoundingClientRect(), bar = UI.dtop.getBoundingClientRect();
  const side = con.left > w * 0.3;
  if (side) x1 = con.left;
  else { y0 = bar.bottom; y1 = con.top; }
  if (!UI.dpanel.hidden) {
    const P = UI.dpanel.getBoundingClientRect();
    if (side && P.right < x1 - 160) x0 = P.right;
    else if (!side && P.top > y0 + 90) y1 = Math.min(y1, P.top);
  }
  VIEW.tx = w / 2 - (x0 + x1) / 2;
  VIEW.ty = h / 2 - (y0 + y1) / 2;
}
function startDispatch() {
  audioInit();
  clearRun();
  G.mode = 'dispatch';
  resetDispatch();
  beginShiftWeather();
  beginShiftTime();
  D.realtime = !!G.rt;
  caseLog.length = 0;
  car.group.visible = false;
  car.x = car.z = 1e5; car.vx = car.vz = 0; car.speed = 0;
  camState.yaw = dsel.h; camState.px = dsel.x; camState.pz = dsel.z;
  populateAround(dsel.x, dsel.z, false);
  G.state = 'play';
  for (const k in hudCache) delete hudCache[k];
  for (const k in dhudCache) delete dhudCache[k];
  buildDispatchHUD();
  showScreen('play');
  applyViewOffset();
  UI.bubble.hidden = true; hideCaseCard();
  bigMsg('派遣模式', '你是 119 派遣員：派哪台車、送哪家醫院，由你決定', 2.6);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
// where the traffic and pedestrian pools gather: around the ambulance, or around 101 on the title screen
const POOL = { play: [235, 140, 205, 230, 110, 200], title: [520, 160, 430, 430, 40, 380], chase: [330, 150, 310, 260, 90, 230] };
function populateAround(x, z, title) {
  populateTraffic(x, z, title ? POOL.title[2] : POOL.play[2]);
  populatePeds(x, z, title ? POOL.title[5] : POOL.play[5]);
}
function startGame() {
  audioInit();
  clearRun();
  G.mode = 'mission';
  Object.assign(G, { time: START_TIME, score: 0, saved: 0, dead: 0, left: 0, ideal: 0, rejects: 0, fast: 0, firstTry: 0, bestAir: 0, combo: 0, comboT: 0, lowBeepT: 0, crashT: 0, callT: 16, recent: [], sirenTip: false,
    hold: null, waitSum: 0, waitN: 0, xdN: 0, cycleT: START_TIME });
  caseLog.length = 0;
  resetER(60);
  beginShiftWeather();
  beginShiftTime();
  mciReset(); G.mciDone = false;
  // the shift starts at the duty station; its calls come from that district
  G.home = homeStation();
  const P0 = stationStart(STATIONS[G.home]);
  carReset(P0.x, P0.z, P0.h);
  camState.yaw = P0.h; camState.px = P0.x; camState.pz = P0.z;
  populateAround(P0.x, P0.z, false);
  // opening calls: a critical one nearby that needs a special team, then two more in the district
  // (the very first patient gets a little extra time while the player finds their feet)
  spawnCall(scene, { c: gpick(CASES.filter((c) => c.tri === 'red' && c.needs !== 'er')), home: true, dmin: 90, dmax: 260, grace: 1.3 });
  spawnCall(scene, { c: gpick(CASES.filter((c) => c.tri === 'yellow')), home: true, dmin: 120 });
  spawnCall(scene, { c: gpick(CASES.filter((c) => c.tri === 'green')), home: true, dmin: 120 });
  G.recent = patients.map((p) => p.c.id);
  updateGuide(true);
  G.state = 'countdown';
  G.countdown = 3.4;
  G.cdShown = 4;
  for (const k in hudCache) delete hudCache[k];
  showScreen('play');
  UI.bubble.hidden = true; hideCaseCard();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function startFree(at) {
  audioInit();
  clearRun();
  G.mode = 'free';
  Object.assign(G, { time: 0, score: 0, combo: 0, comboT: 0, crashT: 0, bestAir: 0, lmT: 0, hospCD: {}, sirenTip: false, trial: null, addr: null });
  VISITED.clear();
  resetER(1e9);
  beginShiftWeather();
  beginShiftTime();
  const P0 = at || START;
  G.freeAt = at || null;
  carReset(P0.x, P0.z, P0.h);
  camState.yaw = P0.h; camState.px = P0.x; camState.pz = P0.z;
  populateAround(P0.x, P0.z, false);
  G.state = 'play';
  for (const k in hudCache) delete hudCache[k];
  showScreen('play');
  UI.bubble.hidden = true; hideCaseCard();
  updateGuide(true);
  bigMsg('自由模式', '沒有時間限制，開車逛台北、找出所有地標！', 2.4);
  camState.sight = null;
  if (at) startSight(at.look, at.x, at.z);
  setTimeout(() => { if (G.mode === 'free' && G.state === 'play') bubble('調度中心', `${isTouch ? '按左下角的「鳴笛」' : '按 <b>E</b> 鳴笛'}，附近路口的車會停下來讓你先過。停在醫院門口，可以看看這家醫院能處理哪些急症。`, '#2f9e8f', 6, 'siren'); }, 2600);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
// ---------- free mode: start (or jump) anywhere — a hospital, a landmark, a station ----------
// a pose on the street in front of a place: a little way back along the road, facing it
function poseAt(proj, back = 18) {
  const e = proj.e, s = clamp(proj.s, 0, e.len);
  const dir = s > back + 4 ? -1 : 1, s0 = clamp(s + dir * back, 2, e.len - 2);
  const [x, z, tx, tz] = edgePoint(e, s0);
  const fx = -dir * tx, fz = -dir * tz;
  // in the right-hand lane (Taiwan drives on the right)
  return { x: x - fz * e.hw * 0.45, z: z + fx * e.hw * 0.45, h: Math.atan2(fx, fz) };
}
function spotList() {
  const lm = (L) => ({ name: L.name, sub: placeName(L.proj.px, L.proj.pz), pose: () => Object.assign(poseAt(L.proj, 30), { look: lookOf(L) }) });
  return [
    ['醫院', HOSPITALS.map((H) => ({ name: H.name, sub: H.hint, css: H.css, pose: () => Object.assign(poseAt(H.proj, 22), { look: { x: H.bld.x, z: H.bld.z, h: H.bld.h + 8, face: Math.atan2(H.drop[0] - H.bld.x, H.drop[1] - H.bld.z) } }) }))],
    ['救護站', STATIONS.map((S) => ({ name: `${S.name}救護站`, sub: S.unit, css: '#d9312b', pose: () => stationStart(S) }))],
    ['地標', LM.map(lm)],
  ];
}
function showSpots(jump) {
  G.spotJump = !!jump;
  if (!jump) G.state = 'title';
  UI.spotsList.innerHTML = `<button class="spot main" type="button" data-g="-1" data-k="0"><b>台北車站（預設）</b><span>忠孝西路</span></button>`
    + spotList().map(([g, list], gi) => `<h3>${g}</h3><div class="spotg">${list.map((s, k) => `<button class="spot" type="button" data-g="${gi}" data-k="${k}"${s.css ? ` style="--sc:${s.css}"` : ''}><b>${s.name}</b><span>${s.sub || ''}</span></button>`).join('')}</div>`).join('');
  UI.spotsNote.textContent = jump ? '換個地方繼續開：救護車會直接移到那裡。' : '選一個地方出發，開車看看地圖和景物。之後也可以在暫停選單換地點。';
  renderTpPick();
  UI.tpPick2.hidden = !!jump;
  showScreen('spots');
  UI.spots.scrollTop = 0;
}
function pickSpot0(gi, k) {
  const pose = gi < 0 ? START : spotList()[gi][1][k].pose();
  if (!G.spotJump) { startFree(pose); return; }
  // jump: same free-mode drive, new place
  G.freeAt = pose;
  carReset(pose.x, pose.z, pose.h);
  camState.yaw = pose.h; camState.px = pose.x; camState.pz = pose.z; camState.arm = 0; camState.cy = car.y;
  populateAround(pose.x, pose.z, false);
  G.addr = null; G.trial = null;
  G.state = 'play';
  showScreen('play');
  for (const k in hudCache) delete hudCache[k];
  updateGuide(true);
  if (AU.ctx) AU.ctx.resume();
  last = performance.now();
  toast(`移到：${placeName(pose.x, pose.z) || '這裡'}`, '');
  camState.sight = null;
  startSight(pose.look, pose.x, pose.z);
}
function showTitle(keepStreets) {
  clearRun();
  clearJams(); JAM.id = 'off'; JAM.T = TIMES.off; routesChanged();
  if (WX.id !== 'day') applyWeather('day');
  G.state = 'title';
  applyViewOffset();
  if (!keepStreets) populateAround(TITLE_C.x, TITLE_C.z, true);
  updateBestLines();
  showScreen('title');
}
// free mode: discover landmarks and read hospital capabilities
// ---------- free mode: hospital time trials ----------
const TRIALS = {};   // best time per hospital id
const TRIAL_TIERS = [['金牌', '#e0a419'], ['銀牌', '#9aa5ad'], ['銅牌', '#c07a45']];
const fmtTrial = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function startTrial() {
  if (G.mode !== 'free' || G.state !== 'play') return;
  if (G.trial) { G.trial = null; toast('計時賽取消了', ''); updateGuide(true); return; }
  G.addr = null;
  const D0 = dijkstra(nearestOnRoads(car.x, car.z));
  const opts = HOSPITALS.map((H) => ({ H, L: routeCost(D0, H.proj) })).filter((o) => o.L > 330 && o.L < 950);
  const pick = opts.length ? gpick(opts) : HOSPITALS.map((H) => ({ H, L: routeCost(D0, H.proj) })).sort((a, b) => b.L - a.L)[0];
  const L = pick.L;
  // medal times: gold needs a fast, clean line; bronze is a steady drive
  G.trial = { H: pick.H, L, t: 0, lim: [L / 27 + 3, L / 22 + 3, L / 17 + 3] };
  updateGuide(true);
  sfx.beep(true);
  bigMsg('計時賽開始！', `送往 ${pick.H.name}・金牌 ${fmtTrial(G.trial.lim[0])}`, 1.8);
}
function trialStep(dt) {
  const T = G.trial;
  T.t += dt;
  const m = hospMarks.find((q) => q.H === T.H);
  if (!m || car.speed > 4.2 || car.airborne || hypot(car.x - m.x, car.z - m.z) > 9.6) return false;
  G.trial = null;
  const tier = T.lim.findIndex((x) => T.t <= x);
  const best = TRIALS[T.H.id], isBest = !best || T.t < best;
  if (isBest) { TRIALS[T.H.id] = +T.t.toFixed(1); saveState(); }
  G.hospCD[T.H.id] = G.t + 25; VISITED.add(T.H.id);
  if (tier >= 0) { sfx.deliver(tier === 0 ? 2 : 1); confetti(car.x, 3, car.z, [TRIAL_TIERS[tier][1], '#ffffff', T.H.css], 60); } else sfx.wrong();
  bigMsg(tier >= 0 ? `${TRIAL_TIERS[tier][0]}！` : '完成！', `${fmtTrial(T.t)}・${T.H.name}`, 1.8);
  showCaseCard({ chip: { name: '計時賽', css: tier >= 0 ? TRIAL_TIERS[tier][1] : '#8f8a84' }, title: tier >= 0 ? `${TRIAL_TIERS[tier][0]}・${fmtTrial(T.t)}` : `用時 ${fmtTrial(T.t)}`,
    name: T.H.name, dx: `最佳紀錄 ${fmtTrial(TRIALS[T.H.id])}`,
    why: `金牌 ${fmtTrial(T.lim[0])}・銀牌 ${fmtTrial(T.lim[1])}・銅牌 ${fmtTrial(T.lim[2])}。鳴笛讓路口車流停下、甩尾過彎，可以更快。`,
    plus: isBest && best ? '新紀錄！' : '' }, 1.7);
  updateGuide(true);
  return true;
}
function freeStep(dt) {
  if (G.addr && addrStep(dt)) return;
  if (G.trial && trialStep(dt)) return;
  G.lmT -= dt;
  if (G.lmT <= 0) {
    G.lmT = 0.25;
    for (const L of LM) if (!FOUND.has(L.name) && !(G.addr && G.addr.name === L.name) && hypot(L.x - car.x, L.z - car.z) < L.r) { discover(L); break; }
  }
  if (car.speed < 4.2 && !car.airborne && !car.sinking) {
    for (const m of hospMarks) {
      if (hypot(car.x - m.x, car.z - m.z) > 9.6) continue;
      const H = m.H;
      if ((G.hospCD[H.id] || 0) < G.t) { G.hospCD[H.id] = G.t + 25; VISITED.add(H.id); showHospitalCard(H); sfx.choose(); }
      break;
    }
  }
}
function discover(L) {
  FOUND.add(L.name);
  saveState();
  sfx.deliver(1);
  confetti(car.x, 3, car.z, [LM_GOLD, '#ffffff', '#7cc4e8', '#f28fb0', '#8fd3b5'], 55);
  const all = FOUND.size === LM.length;
  bigMsg(all ? '全部地標都找到了！' : '發現地標！', `${L.name}　${FOUND.size}/${LM.length}`, 1.6);
  startSight(lookOf(L), car.x, car.z);
  showCaseCard({ chip: { name: '地標', css: LM_GOLD }, title: L.name, name: `第 ${FOUND.size} 個地標`, dx: all ? '全部找到了！' : `還有 ${LM.length - FOUND.size} 個`, why: L.desc }, 1.7);
  updateGuide(true);
}
function showHospitalCard(H) {
  const lv = LEVELS[H.level];
  const caps = H.caps.length ? H.caps.map((k) => CAPS[k].name).join('、') : '一般急診（輕症、需要先穩定的急症）';
  const why = H.noER ? '專門治療癌症的醫院，來這裡的都是門診和住院的癌症病人。' : `可以處理：${caps}。${H.only === 'momkid' ? '這裡只收兒童和孕產婦。' : ''}`;
  showCaseCard({ chip: { name: lv.name, css: lv.color }, title: H.name, name: lv.full, dx: H.hint,
    why, plus: G.mode === 'free' ? `去過的醫院 ${VISITED.size}/${HOSPITALS.length}` : '' }, 0);
}
function pauseGame() {
  if (G.state !== 'play' && G.state !== 'countdown' && G.state !== 'dchoose') return;
  G.prevState = G.state; G.state = 'paused';
  showScreen('pause');
  UI.restartBtn.textContent = G.mode === 'free' ? '回到出發點' : '重新開始';
  UI.briefBtn2.textContent = G.mode === 'dispatch' ? '派遣簡介' : '醫院簡介';
  UI.viewBtn2.hidden = G.mode === 'dispatch'; // the dispatcher always watches from above
  UI.spotBtn2.hidden = G.mode !== 'free';
  if (AU.ctx) AU.ctx.suspend();
}
function resumeGame() { if (G.state !== 'paused') return; G.state = G.prevState || 'play'; showScreen('play'); if (AU.ctx) AU.ctx.resume(); last = performance.now(); }
function endGame() {
  G.state = 'ending';
  G.overT = 2.0;
  if (riding) { logCase(riding, 'handover', riding.dest, {}); riding = null; }
  if (G.mode === 'dispatch') {
    for (const c of dcalls) if (c.status !== 'done') { c.status = 'done'; logCase({ c: c.c, name: c.name, cpr: c.cpr }, 'handover', null, {}); }
    DQ.length = 0; dcur = null; UI.dpanel.hidden = true;
  }
  // a whole shift of deliveries without ever waiting for a bed
  if (G.mode === 'dispatch' ? D.hn >= 5 && !D.waitN : G.saved >= 5 && !G.waitN) award('flow');
  if (G.mode === 'dispatch') bigMsg('交班時間到！', '辛苦了，派遣員', 1.9);
  else bigMsg('下班時間到！', '辛苦了', 1.9);
  sfx.over();
}
function showResults() {
  G.state = 'over';
  if (G.mode === 'dispatch') { showDispatchResults(); return; }
  setStatLabels(['救活', '不幸過世', '一次就送對', '最佳選擇']);
  const [letter, name] = rankFor(G.score);
  if (letter === 'S') award('topemt');
  UI.rankLetter.textContent = letter;
  UI.rankName.textContent = name;
  UI.stSaved.textContent = `${G.saved} 人`;
  UI.stDead.textContent = `${G.dead} 人`;
  UI.stFirst.textContent = G.saved ? `${Math.round((G.firstTry / G.saved) * 100)}%` : '—';
  UI.stIdeal.textContent = `${G.ideal} 次`;
  UI.stScore.textContent = G.score.toLocaleString('en-US');
  const isNew = G.score > G.best;
  if (isNew) { G.best = G.score; saveState(); }
  UI.newBest.hidden = !isNew || G.score === 0;
  UI.overTitle.textContent = G.saved >= 3 && G.dead === 0 ? '完美的一班！' : G.saved ? '下班了！' : '下班了…';
  showERLine((G.home !== undefined ? `${distName(G.home)} · ` : '') + erLineHTML(G.waitSum || 0, G.xdN || 0, '跨區支援') + fundHTML(payFund(G.score, false)));
  UI.againBtn.textContent = '再出勤一次';
  renderMedalRow();
  renderReview();
  updateBestLines();
  showScreen('over');
  UI.over.scrollTop = 0;
}

// the shift in numbers the ER and the districts care about
function erLineHTML(wait, xd, xdLabel) {
  const fulls = HOSPITALS.reduce((a, H) => a + (H.er ? H.er.fulls : 0), 0);
  return `急診等床 <b>${Math.round(wait)} 秒</b> · 醫院滿床 <b>${fulls} 次</b> · ${xdLabel} <b>${xd} 次</b>`;
}
// the weather and what the shift paid into the garage fund
function fundHTML(n) {
  const W = WX.cur;
  return `<br>${iconSVG(W.icon, '#80614a', 14)} ${W.name}${W.bonus > 1 ? `（得分 ×${W.bonus}）` : ''} · 救護基金 <b>+${n.toLocaleString('en-US')}</b>（共 ${(G.bank || 0).toLocaleString('en-US')}，可到車庫升級）`;
}
function showERLine(html) { const el = $('erLine'); el.innerHTML = html; el.hidden = false; }
function setStatLabels(l) { ['stL1', 'stL2', 'stL3', 'stL4'].forEach((id, i) => { $(id).textContent = l[i]; }); }
function showDispatchResults() {
  setStatLabels(['處理案件', '不幸過世', '判斷正確率', '平均到場']);
  const s = D.score, acc = D.dec ? D.ok / D.dec : 0;
  // the rank needs both points and sound judgement
  const [letter, name] = s >= 5400 && acc >= 0.93 && D.dead === 0 ? ['S', '傳奇派遣員'] : s >= 4300 && acc >= 0.85 ? ['A', '王牌派遣員']
    : s >= 2900 && acc >= 0.75 ? ['B', '可靠派遣員'] : s >= 1500 ? ['C', '新手派遣員'] : ['D', '見習派遣員'];
  UI.rankLetter.textContent = letter;
  UI.rankName.textContent = name;
  UI.stSaved.textContent = `${D.calls} 件`;
  UI.stDead.textContent = `${D.dead} 人`;
  UI.stFirst.textContent = D.dec ? `${Math.round((D.ok / D.dec) * 100)}%` : '—';
  const avg = D.resp.length ? D.resp.reduce((a, b) => a + b, 0) / D.resp.length : 0;
  UI.stIdeal.textContent = D.resp.length ? `${Math.round(avg)} 秒` : '—';
  UI.stScore.textContent = s.toLocaleString('en-US');
  const isNew = s > (G.bestD || 0);
  if (isNew) { G.bestD = s; saveState(); }
  UI.newBest.hidden = !isNew || s === 0;
  UI.overTitle.textContent = letter === 'S' ? '完美的值班！' : D.dead === 0 ? '值班結束，沒有人過世' : '值班結束！';
  showERLine(erLineHTML(D.waitSum, D.xdN, '跨區出勤') + (D.prioN ? `<br>判斷緊急程度 <b>${D.prioOk}/${D.prioN}</b> 正確 · 追問 <b>${D.fqN}</b> 題` : '') + fundHTML(payFund(D.score, true)));
  UI.againBtn.textContent = '再值一班';
  renderMedalRow();
  renderReview();
  updateBestLines();
  showScreen('over');
  UI.over.scrollTop = 0;
}

// ---------- per-frame simulation ----------
let acc = 0, last = performance.now();
const FROZEN = { gas: false, brake: false, drift: false, steer: 0 };
function simulate(dt) {
  const inp = readInput();
  const live = G.state === 'play';
  if (G.mode === 'dispatch') {
    const PP = POOL.play, F = focusPoint();
    if (live || (G.state === 'dchoose' && D.realtime)) { dispatchStep(dt); roadEventsStep(dt); }
    trafficStep(dt, units, F[0], F[1], PP[0], PP[1], PP[2]);
    pedStep(dt, ev, units, F[0], F[1], PP[3], PP[4], PP[5]);
    patientsStep(dt, scene, ev);
    walkersStep(scene, dt, G.t);
    if (G.state === 'ending') { G.overT -= dt; if (G.overT <= 0) showResults(); }
    fxStep(dt);
    return;
  }
  // waiting for a bed at a crowded ER: the ambulance stays put
  const held = live && !!G.hold;
  const useInp = live && !held ? inp : FROZEN;
  G.crashT = Math.max(0, (G.crashT || 0) - dt);
  acc += dt;
  const STEP = 1 / 120;
  let n = 0;
  while (acc >= STEP && n < 10) {
    if ((!live || held) && !car.airborne && !car.sinking) { car.vx *= 1 - 6 * STEP; car.vz *= 1 - 6 * STEP; }
    carStep(STEP, useInp, ev);
    trafficCollide(ev);
    acc -= STEP; n++;
  }
  if (n === 10) acc = 0;
  if (car.sinking) {
    car.sinking -= dt;
    if (car.sinking <= 0) respawnCar();
  }
  // siren: each press sounds it for 4 s; holding the key keeps it going
  if (live && inp.siren) {
    SIREN.t = Math.max(SIREN.t, 4);
    if (!G.sirenTip) { G.sirenTip = true; setTimeout(() => { if (G.state === 'play') bubble('調度中心', '鳴笛中！前方車輛會靠邊、路口車流會停下。<b>從道路中間超車</b>通過，別停在車陣後面等。', '#e23b33', 5, 'siren'); }, 300); }
  }
  SIREN.t = Math.max(0, SIREN.t - dt);
  // chase views see far down the street: gather traffic and people ahead of the ambulance
  const chase = chaseOn(), PP = chase ? POOL.chase : POOL.play, AM = ambList();
  const F = chase ? [car.x + Math.sin(camState.yaw) * 70, car.z + Math.cos(camState.yaw) * 70] : focusPoint();
  trafficStep(dt, AM, F[0], F[1], PP[0], PP[1], PP[2]);
  pedStep(dt, ev, AM, F[0], F[1], PP[3], PP[4], PP[5]);
  knockStep(dt, ev);
  patientsStep(dt, scene, ev);
  walkersStep(scene, dt, G.t);
  if (live) {
    weatherStep(dt);
    roadEventsStep(dt);
    jamStep(dt);
    alleyStep(dt);
    redLightStep();
    stubbornStep(dt);
    // 摩西分紅海: the siren has a whole row of cars pulled over at once
    if (sirenOn() && !SHIFT.medals.includes('moses')) { let n = 0; for (const v of traffic) if (v.yield && !v.scoot) n++; if (n >= 5) award('moses'); }
  }
  if (G.state === 'countdown') {
    G.countdown -= dt;
    const shown = Math.ceil(G.countdown - 0.4);
    if (shown !== G.cdShown) {
      G.cdShown = shown;
      if (shown > 0) { bigMsg(String(shown), shown === 3 ? '準備出勤' : '', 0.9); sfx.beep(false); }
      else { bigMsg('出發！', '', 1.0); sfx.beep(true); G.state = 'play'; }
    }
  } else if (G.state === 'play' && G.mode === 'free') {
    G.comboT = Math.max(0, G.comboT - dt);
    freeStep(dt);
  } else if (G.state === 'play') {
    G.time -= dt;
    G.comboT = Math.max(0, G.comboT - dt);
    handoffStep(dt);
    mciStep(dt);
    erStep(dt, onDivertMission);
    if (G.time < 10 && G.time > 0) {
      const s = Math.ceil(G.time);
      if (s !== G.lowBeepT) { G.lowBeepT = s; sfx.tick(); }
    }
    // 119 dispatch
    const w = waitingCalls().length;
    if (!w && !riding && !G.boarding) G.callT = Math.min(G.callT, 1.5);
    G.callT -= dt;
    if (G.callT <= 0) {
      // the 119 centre sends the other calls elsewhere while the crew works a mass-casualty scene
      if (w < MAX_WAIT && !(MCI.cur && MCI.cur.phase !== 'backup' && !MCI.cur.ended)) {
        const p = spawnCall(scene);
        if (p) toast(`119 ${p.xd ? `跨區支援・${distName(p.dist)}` : '派遣'}：${p.c.short}${p.rate > 1 ? '・沒人做 CPR！' : ''}`, '', false, TRIAGE[p.c.tri].css);
      }
      G.callT = grand(13, 19) + w * 3;
    }
    if (riding) {
      riding.life -= dt * DRV.care;
      if (riding.life <= 0) riderDied();
      else checkArrival(dt);
    }
    if (G.time <= 0) { G.time = 0; endGame(); }
  } else if (G.state === 'ending') {
    G.overT -= dt;
    if (G.overT <= 0) showResults();
  }
  // car particles
  const fx = Math.sin(car.h), fz = Math.cos(car.h), rxv = -Math.cos(car.h), rzv = Math.sin(car.h);
  if (!car.airborne && !car.sinking) {
    const rearX = car.x - fx * 1.75, rearZ = car.z - fz * 1.75;
    if (car.slip > 4.2 && car.speed > 8) {
      G.skidT = (G.skidT || 0) - dt;
      if (G.skidT <= 0) {
        G.skidT = 0.028;
        for (const sd of [-1.2, 1.2]) skidMark(rearX + rxv * sd, rearZ + rzv * sd, car.h);
      }
      // tyre smoke; smaller in the chase views, where it billows up between the camera and the ambulance
      const sm = chaseOn() ? 0.55 : 1;
      if (Math.random() < 0.6) puff(rearX + rxv * grand(-1.2, 1.2), 0.5, rearZ + rzv * grand(-1.2, 1.2), grand(-1, 1), grand(0.5, 1.5) * sm, grand(-1, 1), grand(0.5, 0.8) * sm, grand(0.5, 0.8), 0xf1ede4, 0.6, sm < 1 ? 1.2 : 1.8);
    }
    if (car.surface === 'grass' && car.speed > 11 && Math.random() < 0.35) {
      puff(rearX + rxv * grand(-1.2, 1.2), 0.4, rearZ + rzv * grand(-1.2, 1.2), -car.vx * 0.08, grand(0.8, 2), -car.vz * 0.08, grand(0.35, 0.6) * (chaseOn() ? 0.6 : 1), 0.6, 0xb7c98a, 0.2);
    }
    if (car.surface === 'water' && car.speed > 2 && Math.random() < 0.7) {
      puff(car.x + rxv * grand(-1.5, 1.5) + fx * 2, WATER_Y + 0.3, car.z + rzv * grand(-1.5, 1.5) + fz * 2, rxv * grand(-5, 5), grand(3, 7), rzv * grand(-5, 5), grand(0.3, 0.6), 0.6, 0xffffff, -16, 0.4);
    }
  }
  if (car.sinking && Math.random() < 0.4) puff(car.x + grand(-1.5, 1.5), WATER_Y + 0.2, car.z + grand(-1.5, 1.5), 0, grand(1, 2), 0, grand(0.2, 0.4), 0.6, 0xe9fbff, 0);
  fxStep(dt);
}

// ---------- camera ----------
const TITLE_C = { x: 813, z: 236, R: 300, H: 130 };
function updateCamera(dt) {
  const a = camera.aspect;
  let fov, h, back, ahead;
  if (a < 1) { const t = clamp((a - 0.45) / 0.55, 0, 1); fov = lerp(60, 52, t); h = lerp(50, 41, t); back = lerp(21, 18, t); ahead = lerp(13, 10, t); }
  else { fov = 50; h = 42; back = 19; ahead = 11; }
  if (G.state === 'gate' || G.state === 'intro') { introCamera(dt); return; }
  if (G.state === 'title' || G.state === 'loading' || G.state === 'brief') {
    // slow orbit around Taipei 101, keeping the tower off to the side of the title card
    camState.attract += dt * 0.035;
    const { x: cx, z: cz } = TITLE_C;
    const TP = titleCamPose(camState.attract, a);
    camera.position.set(TP.p[0], TP.p[1], TP.p[2]);
    camera.lookAt(TP.l[0], TP.l[1], TP.l[2]);
    if (Math.abs(camera.fov - 50) > 0.01) { camera.fov = 50; camera.updateProjectionMatrix(); }
    if (Math.abs(camera.far - 780) > 1) { camera.far = 780; camera.updateProjectionMatrix(); }
    if (camera.view && camera.view.enabled) camera.clearViewOffset();
    VIEW.ox = VIEW.oy = 0;
    plainCamera();
    focusShadow(cx, cz);
    camState.yaw = Math.atan2(cx - camera.position.x, cz - camera.position.z);
    return;
  }
  if (chaseOn()) { chaseCamera(dt); applySight(dt); return; }
  plainCamera();
  const T = camTarget();
  if (G.mode === 'dispatch') {
    // higher and further back: the dispatcher watches the unit from above
    if (a < 1) { fov = 60; h = 100; back = 30; ahead = 8; } else { fov = 46; h = 82; back = 26; ahead = 10; }
    VIEW.ox = damp(VIEW.ox, VIEW.tx, 6, dt); VIEW.oy = damp(VIEW.oy, VIEW.ty, 6, dt);
    if (Math.abs(VIEW.ox) > 0.5 || Math.abs(VIEW.oy) > 0.5) camera.setViewOffset(window.innerWidth, window.innerHeight, VIEW.ox, VIEW.oy, window.innerWidth, window.innerHeight);
  } else if (camera.view && camera.view.enabled) { camera.clearViewOffset(); VIEW.ox = VIEW.oy = 0; }
  const sp = T.speed;
  h += sp * 0.22; back += sp * 0.07; ahead += sp * 0.24;
  if (T.vF > 2 || T.airborne) camState.yaw = dampAngle(camState.yaw, T.h, 3.0, dt);
  camState.px = damp(camState.px, T.x, 14, dt);
  camState.pz = damp(camState.pz, T.z, 14, dt);
  if (hypot(camState.px - T.x, camState.pz - T.z) > 30) { camState.px = T.x; camState.pz = T.z; camState.yaw = T.h; }
  const fx = Math.sin(camState.yaw), fz = Math.cos(camState.yaw);
  const ty = Math.max(0, T.y) * 0.5;
  let sx = 0, sy = 0;
  if (camState.shake > 0) {
    sx = (Math.random() - 0.5) * camState.shake * 1.6; sy = (Math.random() - 0.5) * camState.shake * 1.2;
    camState.shake = Math.max(0, camState.shake - dt * 2.5);
  }
  camera.position.set(camState.px - fx * back + sx, ty + h + sy, camState.pz - fz * back);
  camera.lookAt(camState.px + fx * ahead + sx * 0.5, ty, camState.pz + fz * ahead);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  fitFar(h + sy, back + ahead);
  focusShadow(T.x + fx * 20, T.z + fz * 20);
  applySight(dt);
}
// ---------- the sightseeing shot (free mode): a slow swing round a place just found or jumped to, then back ----------
const lookOf = (L) => ({ x: L.x, z: L.z, h: L.h, face: Math.atan2(L.proj.px - L.x, L.proj.pz - L.z) });
function startSight(look, fromX, fromZ) {
  if (!look || G.mode !== 'free' || G.addr || G.trial) return;
  // one at a time: a landmark found during the swing does not cut it off
  const S0 = camState.sight;
  if (S0 && S0.t < S0.dur - 1) return;
  const y = look.h || 20;
  // sweep across the side facing the street (where the front door and the signs are)
  const face = look.face !== undefined ? look.face : Math.atan2(fromX - look.x, fromZ - look.z);
  camState.sight = { x: look.x, z: look.z, y, t: 0, dur: 4.8, a0: face - 0.75, r: clamp(y * 1.5 + 30, 52, 120) };
}
const _sl = new THREE.Vector3(), _sd = new THREE.Vector3();
function applySight(dt) {
  const S = camState.sight;
  if (!S) return;
  if (G.mode !== 'free') { camState.sight = null; return; }
  if (G.state !== 'play') return;
  // any steering or throttle ends it early (it eases back over half a second)
  if (keys.gas || keys.brake || keys.left || keys.right) S.t = Math.max(S.t, S.dur - 0.5);
  S.t += dt;
  if (S.t >= S.dur) { camState.sight = null; return; }
  const w = smoothstep(0, 0.9, S.t) * (1 - smoothstep(S.dur - 0.9, S.dur, S.t));
  const a = S.a0 + (S.t / S.dur) * 1.5;
  camera.getWorldDirection(_sd);
  _sl.copy(camera.position).addScaledVector(_sd, 40);
  const px = S.x + Math.sin(a) * S.r, py = S.y * 0.55 + S.r * 0.38, pz = S.z + Math.cos(a) * S.r;
  camera.position.set(lerp(camera.position.x, px, w), lerp(camera.position.y, py, w), lerp(camera.position.z, pz, w));
  camera.lookAt(lerp(_sl.x, S.x, w), lerp(_sl.y, S.y * 0.4, w), lerp(_sl.z, S.z, w));
  const far = Math.max(camera.far, S.r * 3.2);
  if (far > camera.far + 1) { camera.far = far; camera.updateProjectionMatrix(); }
}
// the title view: on a circle around Taipei 101, the tower kept to one side of the title card
function titleCamPose(att, aspect) {
  const { x: cx, z: cz, R, H } = TITLE_C;
  const sa = Math.sin(att), ca = Math.cos(att);
  const hfov = 2 * Math.atan(Math.tan((25 * Math.PI) / 180) * aspect);
  const k = R * Math.tan(0.55 * hfov / 2);
  return { p: [cx + sa * R, H, cz + ca * R], l: [cx + ca * k, 22, cz - sa * k] };
}
// ---------- camera views: overhead, or chasing the ambulance from three heights ----------
const VIEWS = {
  top: { name: '俯視' },
  high: { name: '高角度追車', h: 12.5, back: 17, ahead: 9, lookY: 1, fov: 56, fog: [220, 520] },
  chase: { name: '追車', h: 7.6, back: 13.5, ahead: 13, lookY: 1.6, fov: 58, fog: [200, 490] },
  low: { name: '低角度', h: 4.6, back: 10.5, ahead: 20, lookY: 2.1, fov: 62, fog: [200, 480] },
};
const VIEW_ORDER = ['top', 'high', 'chase', 'low'];
const chaseOn = () => G.mode !== 'dispatch' && G.view !== 'top' && !!VIEWS[G.view];
function setFog(n, f) { n *= WX.fogK; f = Math.max(n + 80, f * WX.fogK); if (scene.fog.near !== n) scene.fog.near = n; if (scene.fog.far !== f) scene.fog.far = f; }
// overhead and title views: the original fog, near plane, and no view cone for traffic
function plainCamera() {
  VIEWCONE = null;
  CUT.value = 0;
  smallVegCull(false);
  setFog(420, 780);
  if (camera.near !== 1) { camera.near = 1; camera.updateProjectionMatrix(); }
}
function cycleView() {
  const i = VIEW_ORDER.indexOf(G.view || 'top');
  G.view = VIEW_ORDER[(i + 1) % VIEW_ORDER.length];
  camState.arm = 0; camState.cy = car.y;
  saveState();
  updateViewButtons();
  if (G.state === 'play' || G.state === 'countdown') toast(`視角：${VIEWS[G.view].name}`, '');
  // switched from the pause menu: show the new view behind it straight away
  else if (G.state === 'paused' && G.mode !== 'dispatch') { updateCamera(0); placeArrow(); skyRender(camera); }
}
// spring arm: how far back the camera can sit before a building comes between it and the ambulance
const ARM_BUF = [];
function armClear(px, pz, dx, dz, len) {
  for (let t = 3; t <= len; t += 1.25) {
    const x = px + dx * t, z = pz + dz * t;
    for (const c of queryColliders(x, z, 1.5, ARM_BUF)) {
      if (c.t !== 1 || c.minY !== undefined || Math.min(c.hw, c.hd) < 1.6) continue;
      if (collide(c, x, z, 0.8)) return Math.max(3, t - 1.5);
    }
  }
  return len;
}
const VC = { x: 0, z: 0, dx: 0, dz: 1, near: 360 };
function chaseCamera(dt) {
  const V = VIEWS[G.view], port = camera.aspect < 1;
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  // follow the heading; in a slide, swing part of the way toward where the ambulance is really going
  let want = car.h;
  if (car.speed > 8 && car.vF > 2) want = car.h + angDiff(car.h, Math.atan2(car.vx, car.vz)) * 0.45;
  // stopped or reversing (a three-point turn): drift round behind the ambulance slowly instead of holding still
  camState.yaw = dampAngle(camState.yaw, want, car.airborne ? 2 : car.vF > 1.5 ? 4.2 : 1.4, dt);
  if (!(camState.cy > -50)) camState.cy = car.y;
  camState.cy = damp(camState.cy, car.y, 5, dt);
  const fx = Math.sin(camState.yaw), fz = Math.cos(camState.yaw);
  const sp = clamp(car.speed / 38, 0, 1.25);
  const back = V.back * (port ? 1.12 : 1) + sp * 2.4, lift = V.h - 2.3 + sp * 0.6;
  const px = car.x, py = camState.cy + 2.3, pz = car.z;
  const free = armClear(px, pz, -fx, -fz, back);
  camState.arm = !(camState.arm > 0) || free < camState.arm ? free : damp(camState.arm, free, 2.5, dt);
  const k = camState.arm / back;
  const cx = px - fx * camState.arm, cz = pz - fz * camState.arm;
  const cy = Math.max(py + lift * (0.6 + 0.4 * k), groundHeight(cx, cz) + 1.4);
  let sx = 0, sy = 0;
  if (camState.shake > 0) {
    sx = (Math.random() - 0.5) * camState.shake * 0.9; sy = (Math.random() - 0.5) * camState.shake * 0.7;
    camState.shake = Math.max(0, camState.shake - dt * 2.5);
  }
  camera.position.set(cx + sx, cy + sy, cz);
  camera.lookAt(px + fx * V.ahead, camState.cy + V.lookY, pz + fz * V.ahead);
  // a wider lens at speed; phones in portrait need a wider one to see the road ahead
  const fov = V.fov + (port ? 12 : 0) + sp * 7;
  const far = (port ? V.fog[1] - 40 : V.fog[1]) + 25;
  if (Math.abs(camera.fov - fov) > 0.05 || Math.abs(camera.far - far) > 1 || camera.near !== 1.5) { camera.fov = fov; camera.far = far; camera.near = 1.5; camera.updateProjectionMatrix(); }
  setFog(V.fog[0], far - 25);
  camState.px = car.x; camState.pz = car.z;
  focusShadow(px + fx * 30, pz + fz * 30);
  // new traffic must not pop up inside this view
  VC.x = cx; VC.z = cz; VC.dx = fx; VC.dz = fz; VC.near = far - 120;
  VIEWCONE = VC;
  // signal heads and lamp arms nearer than the ambulance's nose vanish (see addCut)
  CUT.value = camState.arm + 2;
  smallVegCull(true, cx, cz);
}
// pull the far plane in to just past the farthest visible ground so off-screen chunks get culled
function fitFar(height, horiz) {
  const pitch = Math.atan2(height, horiz);
  const edge = pitch - (camera.fov * Math.PI / 180) / 2;
  const far = edge > 0.06 ? Math.min(1200, height / Math.sin(edge) + 45) : 1200;
  if (Math.abs(camera.far - far) > 4) { camera.far = far; camera.updateProjectionMatrix(); }
}
function focusShadow(x, z) {
  const texel = 128 / 2048;
  const sx = Math.round(x / texel) * texel, sz = Math.round(z / texel) * texel;
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + SUN_OFF.x, SUN_OFF.y, sz + SUN_OFF.z);
}
// Taipei 101 turns see-through when it stands between the camera and the ambulance
function towerFade(dt) {
  if (!MAT.tower) return;
  const [tx, tz] = LANDMARKS.tp101;
  let target = 1;
  if (G.state !== 'title' && G.state !== 'brief' && G.state !== 'loading') {
    const T = camTarget();
    const d = Math.sqrt(segDist2(tx, tz, camera.position.x, camera.position.z, T.x, T.z));
    if (d < 16) target = 0.22;
  }
  const o = damp(MAT.tower.opacity, target, 6, dt);
  MAT.tower.opacity = o;
  MAT.tower.depthWrite = o > 0.98;
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0.016;
  dt = Math.min(dt, 0.05);
  G.t += dt;
  uTime.value = G.t;
  const disp = G.mode === 'dispatch';
  // real-time dispatch: the world keeps moving, slowly, while a decision is open
  const rtChoose = disp && G.state === 'dchoose' && D.realtime;
  const active = G.state === 'play' || G.state === 'countdown' || G.state === 'ending' || rtChoose;
  const titleish = G.state === 'title' || G.state === 'brief';
  if (rtChoose) {
    simulate(dt * 0.3);
    D.refreshT -= dt;
    if (D.refreshT <= 0) { D.refreshT = 0.5; refreshDecision(); }
  } else if (active) {
    // dispatch mode can fast-forward: several simulation steps per frame; so does the wait for an ER bed
    const n = disp && G.state === 'play' ? D.speed : G.hold && G.state === 'play' ? HOLD_FF : 1;
    for (let i = 0; i < n && (i === 0 || G.state === 'play'); i++) simulate(dt);
  } else if (G.state === 'gate' || G.state === 'intro') {
    introStep(dt);
  } else if (titleish || G.state === 'over') {
    const PL = titleish ? POOL.title : POOL.play, F = titleish ? [TITLE_C.x, TITLE_C.z] : focusPoint();
    trafficStep(dt, NO_AMBS, F[0], F[1], PL[0], PL[1], PL[2]);
    pedStep(dt, ev, NO_AMBS, F[0], F[1], PL[3], PL[4], PL[5]);
    fxStep(dt);
  }
  hospViewStep();
  if (G.state !== 'paused') {
    if (!disp) carVisual(dt, (sirenOn() || !!riding) && (active || G.state === 'choose' || G.state === 'map' || G.state === 'intro'), G.t);
    trafficRender();
    eventsRender(G.t);
    sayRender(dt);
    pedRender(G.t);
    knockRender();
    patientsRender(G.t);
    hospitalsRender(G.t);
    dispatchRender(G.t);
    updatePlane(dt);
    amuseStep(dt);
    weatherRender(dt, camera);
    mciRender(dt);
    if (disp) {
      FX.on = false;
      if (active || G.state === 'dchoose') {
        updateDispatchHUD();
        if ((G.frameN = (G.frameN || 0) + 1) % 2 === 0) drawDMap(G.t);
      }
    } else if (active) {
      updateGuide(false);
      updateArrow(dt);
      updateHUD(dt);
      caseCardStep(dt);
      if ((G.frameN = (G.frameN || 0) + 1) % 2 === 0) drawMinimap(G.t);
    } else if (G.state !== 'choose' && G.state !== 'map') FX.on = false;
    updateCamera(dt);
    placeArrow();
    skyRender(camera);
    towerFade(dt);
    const F = titleish ? [TITLE_C.x, TITLE_C.z] : focusPoint();
    landmarkLabelsRender(F[0], F[1]);
    audioUpdate(dt, (active && G.state !== 'ending') || G.state === 'intro');
    garbageSound(active && G.state !== 'ending');
    introRender();
  }
  renderFrame();
  adaptQuality(dt, active);
}
// the world, then (chase views only) the guidance arrow on top of it with a fresh depth buffer
function renderFrame() {
  renderer.render(scene, camera);
  if (!FX.hud || !FX.hud.visible) return;
  renderer.autoClear = false; renderer.info.autoReset = false;
  renderer.clearDepth();
  renderer.render(FX.ovl, camera);
  renderer.autoClear = true; renderer.info.autoReset = true;
}
// which way the arrow points (FX.on says whether it shows at all)
function updateArrow(dt) {
  const tgt = guide.target;
  FX.on = false;
  if (!tgt || G.state !== 'play' || car.sinking) return;
  const gp = guidePoint(22);
  if (!gp || hypot(tgt.px - car.x, tgt.pz - car.z) < 13) return;
  FX.on = true;
  FX.yaw = dampAngle(FX.yaw, Math.atan2(gp[0] - car.x, gp[1] - car.z), 9, dt);
  FX.arrowMat.color.set(guide.color);
  FX.hudMat.color.set(guide.color);
}
// where the arrow sits, once the camera has moved this frame: over the roof in the overhead view;
// in the chase views pinned under the mission banner, where it never hides the road ahead
const _af = new THREE.Vector3(), _au = new THREE.Vector3(), _ar = new THREE.Vector3();
function placeArrow() {
  const chase = chaseOn(), a = FX.arrow, hud = FX.hud;
  a.visible = FX.on && !chase;
  hud.visible = FX.on && chase;
  if (a.visible) {
    a.userData.spin.rotation.y = FX.yaw;
    a.position.set(car.x, car.y + 6.6 + Math.sin(G.t * 3.2) * 0.3, car.z);
  }
  if (!hud.visible) return;
  if (!(FX.hudN-- > 0)) { FX.hudN = 30; const r = UI.mission.getBoundingClientRect(); FX.hudTop = r.height ? r.bottom : 70; }
  const W = window.innerWidth, H = window.innerHeight, D = 10, narrow = W < 520;
  const th = Math.tan((camera.fov * Math.PI) / 360), ppu = H / 2 / (D * th);
  const L = clamp(Math.min(H * 0.15, W * (narrow ? 0.2 : 0.22)), 56, 104); // on-screen length in px
  const yc = Math.min(FX.hudTop + 10 + L * 0.5, H * 0.4) + (reduceMotion ? 0 : Math.sin(G.t * 3.2) * 3);
  // on a phone the call list runs down the left edge: nudge the arrow right so it never tucks under it
  const xn = narrow ? 0.08 : 0;
  camera.getWorldDirection(_af);
  _au.set(0, 1, 0).applyQuaternion(camera.quaternion);
  _ar.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const uo = D * th * (1 - yc / (H / 2));
  hud.position.copy(camera.position).addScaledVector(_af, D).addScaledVector(_au, uo).addScaledVector(_ar, D * th * camera.aspect * xn);
  hud.scale.setScalar(L / (3.7 * ppu));
  // laid on a dial tipped toward the camera: up the screen is straight ahead, down the screen is behind
  const e = Math.asin(clamp((hud.position.y - camera.position.y) / Math.hypot(D, uo), -1, 1));
  hud.rotation.set(-clamp(0.96 + e, 0.55, 1.3), camState.yaw, 0);
  hud.userData.spin.rotation.y = FX.yaw - camState.yaw;
}
function adaptQuality(dt, active) {
  if (!active) return;
  quality.acc += dt; quality.frames++;
  if (quality.acc > 2.5) {
    const avg = quality.acc / quality.frames;
    if (avg > 0.026 && quality.pr > 1) {
      quality.pr = Math.max(1, quality.pr - 0.25);
      renderer.setPixelRatio(quality.pr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    } else if (avg > 0.03 && sun.shadow.mapSize.x > 1024) {
      sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    quality.acc = 0; quality.frames = 0;
  }
}

/*__DEBUG__*/
// boot (supports live-update handoff when the page is republished)
(function boot() {
  const start = (data) => init(data || {});
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();

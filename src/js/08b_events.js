// ===================== medals and Taiwan news events =====================
// Medals: the good ones reward safe, fast, medically sound work; the "bad" ones (in good humour) name the habits a
// real ambulance crew must avoid. Each can be won once per shift; how often you have won each is kept between visits.
const MEDALS = [
  { id: 'ohca', name: '救心英雄', good: true, icon: 'heart', desc: '把心跳停止的病人救回來' },
  { id: 'fast', name: '最速傳說', good: true, icon: 'bolt', desc: '送醫比預估車程快兩成以上' },
  { id: 'heimlich', name: '哈姆立克', good: true, icon: 'person', desc: '救回吃東西噎到的病人' },
  { id: 'triage', name: '神準分流', good: true, icon: 'cross', desc: '連續 4 位病人第一次就送到最適合的醫院' },
  { id: 'start', name: '神準檢傷', good: true, icon: 'cross', desc: '大量傷患事件中，每一位傷患的檢傷卡都掛對' },
  { id: 'flow', name: '急診不塞車', good: true, icon: 'bolt', desc: '一班送醫 5 次以上，一次都不用等床' },
  { id: 'smooth', name: '穩如泰山', good: true, icon: 'star', desc: '一班有 3 位病人一路沒有碰撞' },
  { id: 'moses', name: '摩西分紅海', good: true, icon: 'siren', desc: '鳴笛讓 5 台車同時靠邊讓道' },
  { id: 'noride', name: '不當計程車', good: true, icon: 'phone', desc: '識破裝病想搭便車的乘客' },
  { id: 'busy', name: '救人無數', good: true, icon: 'heart', desc: '一班救活 6 位病人' },
  { id: 'alley', name: '巷弄達人', good: true, icon: 'bolt', desc: '一班抄捷徑穿過 3 條巷子' },
  { id: 'topemt', name: '十大傑出救護員', good: true, icon: 'medal', desc: '出勤任務拿到 S 級' },
  { id: 'askwell', name: '問診高手', good: true, icon: 'phone', desc: '派遣時連續 8 通都判斷對緊急程度' },
  { id: 'roadwise', name: '活地圖', good: true, icon: 'pin', desc: '路名挑戰不看地圖就拿到金牌' },
  { id: 'dacpr', name: '電話 CPR 教練', good: true, icon: 'cpr', desc: '派遣時在電話中指導民眾 CPR' },
  { id: 'detour', name: '繞路高手', good: true, icon: 'pin', desc: '導航路線會塞車，兩次自己繞路把病人送到' },
  { id: 'lost', name: '迷路大師', good: false, icon: 'pin', desc: '一班開錯路 4 次' },
  { id: 'peds', name: '衝撞路人高手', good: false, icon: 'person', desc: '一班逼得路人跳開閃避 6 次' },
  { id: 'redrun', name: '闖紅燈達人', good: false, icon: 'light', desc: '沒鳴笛就闖紅燈 5 次' },
  { id: 'sued', name: '被告了', good: false, icon: 'gavel', desc: '闖紅燈撞車，被移送法辦' },
  { id: 'bumper', name: '碰碰車王', good: false, icon: 'car', desc: '一班撞到別的車 10 次' },
  { id: 'carsick', name: '暈車製造機', good: false, icon: 'person', desc: '同一位病人在車上被撞了 4 次' },
  { id: 'bowling', name: '保齡球冠軍', good: false, icon: 'bowl', desc: '一班撞倒 12 個路邊的東西' },
  { id: 'transfer', name: '轉院專家', good: false, icon: 'cross', desc: '一班送錯醫院 3 次' },
  { id: 'pilgrim', name: '雙聖朝聖團', good: false, icon: 'pin', desc: '帶著 119 病人去雙聖醫院「朝聖」' },
  { id: 'bigname', name: '大醫院迷思', good: false, icon: 'cross', desc: '輕症也往醫學中心送，或把急診送到滿床' },
  { id: 'roadrage', name: '救護車路怒', good: false, icon: 'siren', desc: '一班拿大聲公罵了 8 次人' },
  { id: 'taxi', name: '免費計程車', good: false, icon: 'car', desc: '把裝病搭便車的乘客載去醫院' },
  { id: 'river', name: '水上救護車', good: false, icon: 'wave', desc: '把救護車開進河裡' },
  { id: 'gridlock', name: '塞好塞滿', good: false, icon: 'car', desc: '一班卡在車陣裡超過 90 秒' },
];
const MEDAL_BY = Object.fromEntries(MEDALS.map((m) => [m.id, m]));
const MEDAL_WON = {}; // id -> times won, kept in localStorage
const SHIFT = { medals: [], n: {}, streak: 0, smooth: 0, lostKey: null, lostMin: Infinity, sued: false, redHint: false, stubT: 60, stub: null, fake: false, trash: false, alleyTip: false, hornTip: false };
function resetShift() {
  Object.assign(SHIFT, { medals: [], n: {}, streak: 0, smooth: 0, lostKey: null, lostMin: Infinity, sued: false, redHint: false, stubT: grand(35, 60), stub: null, fake: false, trash: false, alleyTip: false, hornTip: false, jamTip: false });
  REDL.sig = null; REDL.t = -99;
}
const medalHTML = (M, size = 34) => `<i class="medal ${M.good ? 'good' : 'bad'}" style="--ms:${size}px">${iconSVG(M.icon, '#ffffff', Math.round(size * 0.5))}</i>`;
function award(id) {
  const M = MEDAL_BY[id];
  if (!M || SHIFT.medals.includes(id)) return;
  SHIFT.medals.push(id);
  MEDAL_WON[id] = (MEDAL_WON[id] || 0) + 1;
  saveState();
  const el = document.createElement('div');
  el.className = 'toast medaltoast ' + (M.good ? 'good' : 'bad');
  el.innerHTML = `${medalHTML(M, 30)}<span><small>${M.good ? '獲得獎牌' : '獲得「獎牌」'}</small>${M.name}</span>`;
  UI.toasts.appendChild(el);
  while (UI.toasts.children.length > 3) UI.toasts.firstChild.remove();
  setTimeout(() => el.remove(), 2600);
  if (M.good) sfx.medal(); else sfx.wrong();
}
// count something that happened this shift; at `at` it earns `medal`
function tally(k, at, medal) {
  const n = (SHIFT.n[k] = (SHIFT.n[k] || 0) + 1);
  if (medal && n >= at) award(medal);
  return n;
}
// a "news" card: real Taiwanese cases behind the game's events
function newsCard(o) {
  showCaseCard(Object.assign({ chip: { name: o.good ? '好消息' : '社會新聞', css: o.good ? '#2f9e6b' : '#5b6b7d' } }, o), o.delay === undefined ? 1.2 : o.delay);
}

// ---------- red lights ----------
// Driving into a signalled junction against the red: legal for an ambulance on a call with the siren on (it should
// still slow down and look), a violation without it. A crash right after it is the Chiayi case of 2025.
const REDL = { sig: null, t: -99, siren: false };
function redLightStep() {
  if (G.state !== 'play' || G.mode === 'dispatch' || car.airborne || car.sinking) { REDL.sig = null; return; }
  let inside = null;
  for (const sig of SIGNALS.values()) {
    const r = sig.hw + 2.5;
    if (Math.abs(sig.x - car.x) < r && Math.abs(sig.z - car.z) < r) { inside = sig; break; }
  }
  if (inside && inside !== REDL.sig && car.speed > 6 && car.vF > 0) {
    // the street we came in on is the one pointing back along our track
    const vx = car.vx / car.speed, vz = car.vz / car.speed;
    let best = null, bd = 0.35;
    for (const { e, dir } of nodeEdges[inside.id] || []) {
      const q = edgePoint(e, dir === 1 ? Math.min(e.len, 10) : Math.max(0, e.len - 10));
      const ox = q[0] - inside.x, oz = q[1] - inside.z, ol = Math.hypot(ox, oz) || 1;
      const back = -(ox * vx + oz * vz) / ol;
      if (back > bd) { bd = back; best = e; }
    }
    if (best && inside.groups.has(best.idx) && sigPhase(inside, inside.groups.get(best.idx)) === 'R') {
      REDL.t = G.t; REDL.siren = sirenOn();
      if (!REDL.siren) { tally('red', 5, 'redrun'); addScore(-10); toast('闖紅燈！沒鳴笛就要停紅燈', '−10', true); }
      else if (car.speed > 24 && !SHIFT.redHint) { SHIFT.redHint = true; toast('鳴笛可以闖紅燈，但要減速、看清楚路口', ''); }
    }
  }
  REDL.sig = inside;
}
// a hard hit on another car just after running a red light
function crashAfterRed(k) {
  if (G.mode === 'dispatch' || G.state !== 'play' || SHIFT.sued || k < 9 || G.t - REDL.t > 2.5) return;
  SHIFT.sued = true;
  addScore(-150);
  award('sued');
  bigMsg('被告了！', '闖紅燈撞車　−150', 2);
  newsCard({ title: '闖紅燈撞車，被移送法辦', pts: '−150', name: '救護車有優先權', dx: '但沒有「絕對路權」', bad: true, delay: 2.1,
    why: '執行勤務鳴笛時可以闖紅燈，但還是要減速、確認橫向來車。2025 年嘉義太保就有救護車闖紅燈、沒有減速，撞上轎車，車上 88 歲的病人不幸過世，駕駛被移送法辦。',
    note: '鳴笛不是免死金牌：路口先減速，確定車子都停了再過。' });
}

// ---------- getting lost: the route to the target keeps getting longer ----------
function lostStep(kind, to) {
  if (G.state !== 'play' || (kind !== 'call' && kind !== 'hosp' && kind !== 'trial')) { SHIFT.lostKey = null; return; }
  const key = kind + ':' + to.e.idx + ':' + Math.round(to.s);
  if (SHIFT.lostKey !== key) { SHIFT.lostKey = key; SHIFT.lostMin = guide.len; return; }
  if (guide.len < SHIFT.lostMin) SHIFT.lostMin = guide.len;
  else if (guide.len > SHIFT.lostMin + 70) {
    SHIFT.lostMin = guide.len;
    tally('lost', 4, 'lost');
    toast('走錯路了！跟著箭頭走', '', true);
  }
}

// ---------- a car that will not pull over for the siren ----------
// Taichung, June 2026: an SUV sat in front of a sirened ambulance and would not move; not yielding now costs
// NT$6,000 to 30,000 and the driving licence.
function stubbornStep(dt) {
  if (G.mode === 'dispatch' || G.state !== 'play') return;
  const v0 = SHIFT.stub;
  if (v0) {
    v0.stubborn -= dt;
    if (v0.stubborn <= 0) { SHIFT.stub = null; toast('不讓救護車可罰 6 千到 3 萬元，還會吊銷駕照', ''); }
    return;
  }
  SHIFT.stubT -= dt;
  if (SHIFT.stubT > 0 || !sirenOn() || car.speed < 8) return;
  const fx = Math.sin(car.h), fz = Math.cos(car.h);
  let pick = null, bd = 1e9;
  for (const v of traffic) {
    if (v.scoot || v.kind === 'bus' || v.kind === 'garbage' || v.stun > 0) continue;
    const ox = v.x - car.x, oz = v.z - car.z, ah = ox * fx + oz * fz;
    if (ah < 14 || ah > 48 || Math.abs(-ox * fz + oz * fx) > 4.5) continue;
    if (Math.sin(v.h) * fx + Math.cos(v.h) * fz < 0.8) continue; // same way as us
    if (ah < bd) { bd = ah; pick = v; }
  }
  SHIFT.stubT = pick ? grand(90, 140) : 4;
  if (!pick) return;
  pick.stubborn = 7; SHIFT.stub = pick;
  toast(`前方${pick.kind === 'van' ? '休旅車' : '轎車'}不讓救護車！繞過去，或${isTouch ? '按「罵人」' : '按 Q'}用大聲公罵他`, '', true);
}

// 大聲公: the crew leans out with the loudspeaker. The stubborn driver gives in at once; the cars just ahead pull over.
const SHOUT_LINES = ['救護車！讓一下啦！', '前面的！靠邊停！', '閃啦！我們在救人啦！', '你是沒聽到警笛喔？', '後面有病人，拜託讓一下！', '靠右！靠右！'];
const SHOUT_REPLY = ['好啦好啦…', '歹勢歹勢！', '兇屁喔…', '我讓我讓！', '啊我沒聽到啦！'];
const SHOUT = { t: -9 };
function shout() {
  if (G.mode === 'dispatch' || G.state !== 'play' || G.t < SHOUT.t) return;
  SHOUT.t = G.t + 1.4;
  sayAt(gpick(SHOUT_LINES), car.x, car.y + 5.2, car.z);
  yelp(1, 'm');
  const fx = Math.sin(car.h), fz = Math.cos(car.h);
  let n = 0;
  for (const v of traffic) {
    const ox = v.x - car.x, oz = v.z - car.z, ah = ox * fx + oz * fz;
    if (ah < 2 || ah > 45 || Math.abs(-ox * fz + oz * fx) > 6) continue;
    v.scold = 4; n++;
    if (v === SHIFT.stub) {
      v.stubborn = 0; SHIFT.stub = null;
      setTimeout(() => sayAt(gpick(SHOUT_REPLY), v.x, v.y + 4.6, v.z, true), 500);
      toast('罵醒了！那台車乖乖讓路', '');
    }
  }
  if (!n) toast('前面沒有車擋路啦，別亂罵人', '');
  tally('shout', 8, 'roadrage');
}
// the stubborn car gets a "!" over its roof
let STUB_FX = null;
function eventsRender(t) {
  const v = G.mode !== 'dispatch' && G.state === 'play' ? SHIFT.stub : null;
  if (!STUB_FX) {
    if (!v) return;
    STUB_FX = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.exclaimTex, depthTest: false, transparent: true }));
    STUB_FX.scale.setScalar(2.6); STUB_FX.renderOrder = 4;
    scene.add(STUB_FX);
  }
  STUB_FX.visible = !!v;
  if (v) STUB_FX.position.set(v.x, v.y + (v.kind === 'van' ? 4.9 : 4.0) + Math.sin(t * 7) * 0.3, v.z);
}

// ---------- the garbage truck ----------
// Taiwan's garbage trucks have played "Für Elise" since the 1960s (the first ones came from Germany with the tune
// built in); when it sounds, the whole street comes out with its rubbish bags.
const TRUCK = { v: null };
function garbageSound(active) {
  if (TRUCK.v === null) TRUCK.v = traffic.find((v) => v.kind === 'garbage') || false;
  const v = TRUCK.v;
  let vol = 0;
  if (v && active && G.mode !== 'dispatch' && G.state === 'play') {
    const d = Math.hypot(v.x - car.x, v.z - car.z);
    if (d < 95) {
      vol = 0.05 * Math.pow(1 - d / 95, 1.6);
      if (d < 55 && !SHIFT.trash) { SHIFT.trash = true; toast('〈給愛麗絲〉響起：垃圾車來了！', ''); }
    }
  }
  eliseUpdate(vol);
}

// ---------- the fake ride ----------
// Liuqiu, March 2025: a guesthouse guest was suspected of faking an illness to ride an ambulance to the pier.
function refuseRide() {
  const p = riding;
  if (!p || !p.c.fake) return;
  riding = null; dwell.m = null;
  closeDest();
  addWalker(scene, p.look, car.x + Math.cos(car.h) * 28, car.z - Math.sin(car.h) * 28, false);
  addScore(60);
  award('noride');
  sfx.choose();
  logCase(p, 'refused', null, { note: '意識清楚、能走路、只想搭便車的人，請他自行搭車。' });
  newsCard({ title: '識破裝病搭便車', pts: '+60', name: p.name, dx: '救護車不是計程車', delay: 0.4,
    why: p.c.why, plus: '判斷正確！救護車馬上可以去救下一位病人。',
    note: '真實新聞：2025 年小琉球一名民宿旅客疑似裝病叫救護車，想搭到碼頭；到了衛生所拒絕問診，坐了 20 分鐘就自行離開。' });
  updateGuide(true);
  G.callT = Math.min(G.callT, 3);
}
function deliverFake(m) {
  const p = riding, H = m.H;
  riding = null; dwell.m = null;
  addScore(-40);
  award('taxi');
  sfx.wrong();
  addWalker(scene, p.look, H.signPos[0] + 20, H.signPos[2], false);
  logCase(p, 'fakeride', H, { note: '到了急診就說不痛了。遇到只想搭便車的人，要勸他自行搭車。' });
  bigMsg('被當成計程車了…', '−40', 1.8);
  newsCard({ title: '被當成免費計程車', pts: '−40', name: p.name, dx: '一到急診就說肚子不痛了', bad: true, delay: 1.9,
    why: '他拎著行李箱自己走出急診，直奔捷運站。救護車白跑一趟，這段時間附近的危急病人就少了一台車。',
    note: '意識清楚、能走路、只想搭便車的人，要勸他自行搭車；臺北市濫用救護車每趟收費 1,800 元。' });
  updateGuide(true);
  G.callT = Math.min(G.callT, 3);
}

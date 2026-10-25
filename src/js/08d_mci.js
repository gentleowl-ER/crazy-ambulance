// ===================== 大量傷患事件 (mass-casualty incident): START triage =====================
// Once a shift, a gas explosion, a pile-up or a bus crash leaves six or seven people hurt in one place. The first
// ambulance there does the triage: each casualty gets a START tag (walking: green; not breathing even with the
// airway opened: black; breathing over 30, no radial pulse or not following commands: red; everyone else: yellow).
// The player then takes one red patient; the crews arriving after them take the rest, reds first by the tags the
// player gave, and spread them over several hospitals so no one ER is swamped.
const MCI_TYPES = [
  { id: 'gas', name: '餐廳氣爆', say: '一家火鍋店瓦斯氣爆，店裡店外倒了好多人！', mix: ['walk', 'walk', 'okY', 'rr', 'burn', 'cmd', 'dead'] },
  { id: 'pileup', name: '連環車禍', say: '好幾台汽機車在路口撞成一團，很多人受傷！', mix: ['walk', 'okY', 'okY', 'airway', 'pulse', 'cmd', 'dead'] },
  { id: 'bus', name: '公車擦撞翻覆', say: '公車在路口被撞翻，乘客受傷、有人被困住！', mix: ['walk', 'walk', 'okY', 'rr', 'pulse', 'airway', 'dead'] },
];
// what the crew finds, START style: walk / breathing rate (0 = not breathing) / breathing once the airway is opened /
// radial pulse / follows simple commands
const MCI_KINDS = {
  walk: { tag: 'green', walk: true, rr: 18, pulse: true, cmd: true, pose: null, desc: '手臂擦傷流血，自己走到路邊', cas: 'mciG' },
  okY: { tag: 'yellow', walk: false, rr: 22, pulse: true, cmd: true, pose: 'sit', desc: '小腿明顯變形、站不起來，但回答問題清楚', cas: 'mciY' },
  rr: { tag: 'red', walk: false, rr: 36, pulse: true, cmd: true, pose: 'lie', desc: '胸口被撞，一直喘，話說不完整', cas: 'mciR' },
  pulse: { tag: 'red', walk: false, rr: 24, pulse: false, cmd: true, pose: 'lie', desc: '臉色蒼白、冒冷汗，手腳冰冷，腹部瘀青', cas: 'mciR' },
  cmd: { tag: 'red', walk: false, rr: 20, pulse: true, cmd: false, pose: 'lie', desc: '頭部撞傷流血，叫他握手沒有反應', cas: 'mciH' },
  airway: { tag: 'red', walk: false, rr: 0, airway: true, pulse: true, cmd: false, pose: 'lie', desc: '倒在地上沒有呼吸；壓額抬下巴打開呼吸道後，開始自己呼吸', cas: 'mciR' },
  burn: { tag: 'red', walk: false, rr: 32, pulse: false, cmd: true, pose: 'lie', desc: '臉和雙手大面積燒傷，呼吸很快、脈搏摸不到', cas: 'mciB' },
  dead: { tag: 'black', walk: false, rr: 0, airway: false, pulse: false, cmd: false, pose: 'lie', desc: '倒地沒有呼吸；打開呼吸道後，仍然沒有呼吸', cas: null },
};
const MCI_WHY = 'START 檢傷：①能自己走 → 綠；②沒有呼吸，打開呼吸道後仍沒有 → 黑，開始呼吸 → 紅；③呼吸每分鐘超過 30 次 → 紅；④摸不到橈動脈脈搏（或微血管回填超過 2 秒）→ 紅；⑤不能聽從簡單指令 → 紅；⑥以上皆非 → 黃。每位傷患只花 30 秒左右，先分類、後治療。';
const MCI_CASES = {
  mciR: { id: 'mciR', short: '多處外傷', tri: 'red', who: '檢傷官', say: '紅色檢傷卡：呼吸、循環或意識有問題，要第一批後送！', signs: ['大量傷患', '紅色檢傷'], needs: 'trauma', life: 95,
    dx: '多重創傷（大量傷患・紅）', why: MCI_WHY + ' 紅色傷患要送重度級醫院的外傷團隊。' },
  mciH: { id: 'mciH', short: '頭部外傷', tri: 'red', who: '檢傷官', say: '紅色檢傷卡：頭部撞傷、叫不太醒，要第一批後送！', signs: ['大量傷患', '不能聽從指令'], needs: 'trauma', life: 95,
    dx: '頭部外傷（大量傷患・紅）', why: MCI_WHY + ' 不能聽從指令代表意識受影響，要送有神經外科的重度級醫院。' },
  mciB: { id: 'mciB', short: '大面積燒傷', tri: 'red', who: '檢傷官', say: '紅色檢傷卡：大面積燒傷、休克，要第一批後送！', signs: ['大量傷患', '大面積燒傷'], needs: 'burn', life: 100,
    dx: '大面積燒燙傷併休克（大量傷患・紅）', why: MCI_WHY + ' 大面積燒傷要送有燒燙傷中心的醫院。' },
  mciY: { id: 'mciY', short: '骨折不能走', tri: 'yellow', who: '檢傷官', say: '黃色檢傷卡：骨折走不動，但呼吸、脈搏和意識都穩定。', signs: ['大量傷患', '黃色檢傷'], needs: 'er', life: 150,
    dx: '下肢骨折（大量傷患・黃）', why: MCI_WHY + ' 黃色傷患可以稍等，等紅色傷患都送走了再後送。' },
  mciG: { id: 'mciG', short: '輕傷', tri: 'green', who: '檢傷官', say: '綠色檢傷卡：能自己走，只是擦傷。', signs: ['大量傷患', '可以走路'], needs: 'er', life: 170,
    dx: '擦挫傷（大量傷患・綠）', why: MCI_WHY + ' 能走的傷患先集中到一旁，最後再送。' },
};
const MCI_CALL = { id: 'mci', short: '大量傷患', tri: 'red', who: '路人', say: '好多人受傷倒在路上，快派救護車來！', signs: ['多人受傷', '你是第一台到場的車'], needs: 'trauma', life: 150,
  dx: '大量傷患事件', why: MCI_WHY };
const TAGS = { green: { name: '綠', full: '輕傷', css: '#3fae5a' }, yellow: { name: '黃', full: '延遲', css: '#f0b323' }, red: { name: '紅', full: '立即', css: '#e0413a' }, black: { name: '黑', full: '死亡', css: '#4a4450' } };
const TAG_ORDER = ['red', 'yellow', 'green', 'black'];
const MCI = { cur: null };

// the reason a casualty gets their tag, step by step
function startReason(k) {
  if (k.walk) return '能自己走 → 綠';
  if (!k.rr) return k.airway ? '沒有呼吸，打開呼吸道後開始呼吸 → 紅' : '打開呼吸道後仍沒有呼吸 → 黑';
  if (k.rr > 30) return `呼吸每分鐘 ${k.rr} 次，超過 30 → 紅`;
  if (!k.pulse) return '摸不到橈動脈脈搏 → 紅';
  if (!k.cmd) return '不能聽從簡單指令 → 紅';
  return '能呼吸、有脈搏、能聽指令，但不能走 → 黃';
}
function startFindings(k) {
  const breath = k.rr ? `${k.rr} 次/分` : k.airway ? '沒有 → 打開呼吸道後有' : '沒有 → 打開呼吸道後仍沒有';
  return [['行走', k.walk ? '能' : '不能'], ['呼吸', breath], ['橈動脈', k.rr || k.airway ? (k.pulse ? '摸得到' : '摸不到') : '—'], ['聽指令', k.rr || k.airway ? (k.cmd ? '能' : '不能') : '—']];
}
// time to the shift's incident (once a shift, not in the first minute)
function mciReset() {
  MCI.cur = null;
  G.mciT = grand(55, 85);
}
function mciStep(dt) {
  const M = MCI.cur;
  if (!M) {
    if (G.mode !== 'mission' || G.mciDone || G.time < 40) return;
    G.mciT -= dt;
    if (G.mciT <= 0 && !G.boarding && waitingCalls().length < 4) spawnMCI();
    return;
  }
  M.t += dt;
  // smoke over the scene
  if ((M.smokeT = (M.smokeT || 0) - dt) <= 0) { M.smokeT = 0.35; puff(M.x + rand(-3, 3), 2, M.z + rand(-3, 3), rand(-1, 1), rand(2, 4), rand(-1, 1), rand(1.4, 2.4), 2.4, M.type.id === 'gas' ? 0x5d5a58 : 0xb9b4ac, -0.4, 2.2); }
  if (M.light) { const on = Math.floor(G.t * 5) % 2; M.light.userData.r.visible = !!on; M.light.userData.b.visible = !on; }
  if (M.phase !== 'backup') return;
  // the other crews take the casualties one by one, reds first (by the player's tags)
  for (const c of M.cas) {
    if (c.done || c.mine) continue;
    if (M.t < c.due) continue;
    c.done = true;
    fadeCasualty(c);
    if (c.k.tag === 'black') { logCase({ c: MCI_CASES.mciR, name: c.name }, 'expectant', null, { note: '打開呼吸道後仍沒有呼吸：黑色檢傷，先把人力留給救得活的人。' }); continue; }
    const cs = MCI_CASES[c.k.cas];
    // under-triaged: a red casualty given a yellow or green card waited too long
    if (c.k.tag === 'red' && c.tag !== 'red') {
      M.lost++;
      logCase({ c: cs, name: c.name }, 'mcidead', null, { note: `你掛了${TAGS[c.tag].name}色卡，他排在後面等太久。${startReason(c.k)}。` });
      toast(`${c.name}（檢傷卡${TAGS[c.tag].name}色）等不到後送…`, '', true);
      continue;
    }
    const H = backupHospital(cs, M);
    M.sent[H.id] = (M.sent[H.id] || 0) + 1;
    erAdmit(H, cs);
    logCase({ c: cs, name: c.name }, 'backup', H, { note: c.tag !== c.k.tag ? `你掛了${TAGS[c.tag].name}色卡，正確是${TAGS[c.k.tag].name}色：${startReason(c.k)}。` : '' });
    toast(`後送：${c.name}（${TAGS[c.tag].name}）→ ${H.name}`, '', false, TAGS[c.tag].css);
  }
  if (M.cas.every((c) => c.done || c.mine) && !M.ended) endMCI();
}
// the other crews share the casualties out: of the nearest hospitals that can treat them, the least crowded
function backupHospital(cs, M) {
  const D = dijkstra(M.proj);
  const ok = HOSPITALS.filter((H) => accepts(H, cs) && !isDiverted(H)).map((H) => ({ H, d: routeCost(D, H.proj) })).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!ok.length) return HOSPITALS[0];
  ok.sort((a, b) => (erRatio(a.H) + (M.sent[a.H.id] || 0) * 0.12) - (erRatio(b.H) + (M.sent[b.H.id] || 0) * 0.12) || a.d - b.d);
  return ok[0].H;
}
function spawnMCI() {
  const type = gpick(MCI_TYPES);
  const cand = spawnPts.filter((sp) => sp.e.hw >= 6 && sp.e.len > 60 && (G.home === undefined || sp.dist === G.home) && hypot(sp.px - car.x, sp.pz - car.z) > 170 && hypot(sp.px - car.x, sp.pz - car.z) < 430 && !sp.e.rev);
  if (!cand.length) { G.mciT = 20; return; }
  const sp = gpick(cand);
  const lead = makePatient(scene, Object.assign({}, MCI_CALL, { say: type.say }), sp);
  lead.mciLead = true;
  lead.name = `${placeName(sp.x, sp.z) || '路口'}`;
  lead.dist = sp.dist;
  fitBudget(lead, 1.25);
  lead.life = lead.life0 = Math.max(lead.life, 70);
  scene.remove(lead.ch.g); // the people at the scene stand in for the caller
  G.mciDone = true;
  const I = { type, x: sp.px, z: sp.pz, proj: lead.proj, lead, cas: [], t: 0, phase: 'drive', sent: {}, lost: 0, ok: 0, objs: [] };
  // the casualties around the spot: on the pavement and out in the road
  const [px, pz, tx, tz] = edgePoint(sp.e, sp.s);
  const mix = type.mix.slice().sort(() => Math.random() - 0.5);
  mix.forEach((kid, i) => {
    const k = MCI_KINDS[kid];
    const along = (i - (mix.length - 1) / 2) * 3.4 + rand(-0.6, 0.6);
    const off = i % 2 ? sp.e.hw + 1.6 : sp.e.hw * 0.3;
    const x = px + tx * along + sp.nx * off, z = pz + tz * along + sp.nz * off;
    const look = randomLook({ hat: 'none', wave: !k.pose });
    const ch = makeCharacter(scene, look, 0.95);
    setPose(ch, k.pose);
    const c = { k, kid, ch, look, x, z, h: rand(0, TAU), tag: null, name: gpick(SURNAMES) + gpick(['先生', '小姐', '伯伯', '阿姨', '同學']) };
    ch.g.position.set(x, groundHeight(x, z), z); ch.g.rotation.y = c.h;
    I.cas.push(c);
  });
  // what happened: wrecked cars, the bus on its side, or the burnt-out shopfront; a police car with its lights
  const gb = new GB(), a = Math.atan2(tx, tz);
  // lx: across the street (+ toward the casualties' kerb), lz: along it
  const W = (lx, lz, ry = 0) => new THREE.Matrix4().makeRotationY(a + ry).setPosition(px + sp.nx * lx + tx * lz, 0, pz + sp.nz * lx + tz * lz);
  if (type.id === 'bus') {
    gb.add(box(2.6, 3.0, 11), 0xf4f4f0, W(-sp.e.hw * 0.35, 0).multiply(M(0, 1.3, 0, 0, 0, Math.PI / 2 - 0.05)));
    gb.add(box(2.66, 0.9, 11.06), 0x3a7fd5, W(-sp.e.hw * 0.35, 0).multiply(M(-0.9, 1.3, 0, 0, 0, Math.PI / 2 - 0.05)));
  } else if (type.id === 'pileup') {
    for (const [lx, lz, ry, col] of [[-2, -5, 0.6, 0xd9473d], [1.5, 0, -0.4, 0xf4f4f2], [-1, 5, 1.2, 0x3a5f8f]]) {
      gb.add(box(1.9, 0.9, 4.2), col, W(lx, lz, ry).multiply(M(0, 0.75, 0))); gb.add(box(1.7, 0.75, 2.2), col, W(lx, lz, ry).multiply(M(0, 1.5, -0.2)));
    }
  } else {
    gb.add(box(8, 0.2, 1.2), 0x2b2f35, W(sp.e.hw + 5.2, 0).multiply(M(0, 3.2, 0)));
    for (let i = 0; i < 5; i++) gb.add(new THREE.ConeGeometry(rand(0.5, 0.9), rand(1.4, 2.6), 6), i % 2 ? 0xff7a2a : 0xffc23a, W(sp.e.hw + 4.6 + rand(-0.6, 0.6), rand(-3, 3)).multiply(M(0, 0.9, 0)));
  }
  gb.add(box(1.9, 0.9, 4.4), 0xf4f4f2, W(sp.e.hw * 0.4, -14).multiply(M(0, 0.75, 0)));
  gb.add(box(1.94, 0.3, 4.44), 0x2f5fa8, W(sp.e.hw * 0.4, -14).multiply(M(0, 0.9, 0)));
  const mesh = new THREE.Mesh(gb.build(), MAT.toon); mesh.castShadow = true; scene.add(mesh); I.objs.push(mesh);
  const lp = W(sp.e.hw * 0.4, -14).elements;
  I.light = flashBar(lp[12], lp[14], a, 2.0); I.objs.push(I.light);
  MCI.cur = I;
  selCall = lead;
  updateGuide(true);
  sfx.call(); setTimeout(() => sfx.call(), 350);
  bigMsg('大量傷患事件！', `${lead.name}・${type.name}`, 2.4);
  bubble('119 勤務指揮中心', `${lead.name}${type.name}：${type.say}你是第一台到場的救護車，請擔任<b>檢傷官</b>，用 START 幫每位傷患分類。`, '#e0413a', 7, 'siren');
}
// arriving at the scene: the triage panel
function mciArrive(p) {
  const M = MCI.cur;
  if (!M || M.phase !== 'drive') return;
  M.phase = 'triage';
  removePatient(scene, p);
  if (selCall === p) selCall = null;
  car.vx = car.vz = 0;
  G.prevState = G.state;
  G.state = 'mci';
  renderMCI();
  UI.mci.hidden = false;
  hideCaseCard(); UI.bubble.hidden = true;
  touchState.clear(); refreshTouch();
  for (const k in keys) keys[k] = false;
  UI.touch.hidden = true;
  sfx.panel();
}
// too late: other crews got there first and did the triage
function mciMissed(p) {
  const M = MCI.cur;
  removePatient(scene, p);
  if (!M) return;
  G.dead++;
  addScore(-60);
  sfx.sad();
  toast('大量傷患現場：救護車太晚到，其他分隊接手了', '−60', true);
  logCase({ c: MCI_CALL, name: p.name }, 'dead', null, { note: '大量傷患事件時，第一台到場的車要負責檢傷分類；太晚到，紅色傷患的黃金時間就過去了。' });
  for (const c of M.cas) fadeCasualty(c);
  endMCI(true);
}
function renderMCI() {
  const M = MCI.cur, done = M.phase !== 'triage';
  UI.mciTitle.textContent = `${M.lead.name}・${M.type.name}`;
  UI.mciSub.textContent = done ? '檢傷完成：選一位紅色傷患上你的車，其餘交給陸續到場的救護車' : `${M.cas.length} 位傷患・你是檢傷官`;
  UI.mciLead.innerHTML = done
    ? `檢傷正確 <b>${M.ok}/${M.cas.length}</b>${M.ok === M.cas.length ? '，全部正確！' : '。錯的地方看下面的說明。'}`
    : '用 <b>START</b> 檢傷，每位傷患只花幾秒：看完下面四項，掛上一張檢傷卡。全部掛完再按「完成檢傷」。';
  UI.mciList.innerHTML = M.cas.map((c, i) => {
    const F = startFindings(c.k).map(([a, b]) => `<span><i>${a}</i>${b}</span>`).join('');
    const btns = TAG_ORDER.map((t) => `<button type="button" class="tagb${c.tag === t ? ' on' : ''}" data-i="${i}" data-t="${t}" style="--tc:${TAGS[t].css}"${done ? ' disabled' : ''}>${TAGS[t].name}</button>`).join('');
    const res = done ? `<div class="mres ${c.tag === c.k.tag ? 'ok' : 'bad'}">${c.tag === c.k.tag ? '✔' : `✘ 應為${TAGS[c.k.tag].name}色`}・${startReason(c.k)}</div>` : '';
    return `<div class="mcard" style="--tc:${c.tag ? TAGS[c.tag].css : '#cfc6b8'}"><div class="mh"><b>${i + 1}. ${c.name}</b><span>${c.k.desc}</span></div><div class="mf">${F}</div><div class="mtags">${btns}</div>${res}</div>`;
  }).join('');
  const all = M.cas.every((c) => c.tag);
  UI.mciGo.hidden = done;
  UI.mciGo.disabled = !all;
  UI.mciGo.textContent = all ? '完成檢傷' : `還有 ${M.cas.filter((c) => !c.tag).length} 位沒掛卡`;
  // the transport choice: the casualties the player tagged red (or yellow, if none)
  if (done) {
    const pool = M.cas.filter((c) => c.tag === 'red').length ? M.cas.filter((c) => c.tag === 'red') : M.cas.filter((c) => c.tag === 'yellow');
    UI.mciTake.innerHTML = '<div class="dest-q">你的救護車要先載誰？</div>' + pool.map((c) => `<button class="drow" type="button" data-take="${M.cas.indexOf(c)}" style="--hc:${TAGS[c.tag].css}"><span class="num">${M.cas.indexOf(c) + 1}</span><span class="hn"><b>${c.name}</b><em>${c.k.desc}</em></span><span class="dist"><b>${TAGS[c.tag].name}卡</b><small>上車</small></span></button>`).join('');
  } else UI.mciTake.innerHTML = '';
}
function mciTag(i, t) {
  const M = MCI.cur;
  if (!M || M.phase !== 'triage') return;
  M.cas[i].tag = t;
  sfx.choose();
  renderMCI();
}
function mciConfirm() {
  const M = MCI.cur;
  if (!M || M.phase !== 'triage' || !M.cas.every((c) => c.tag)) return;
  M.phase = 'take';
  M.ok = M.cas.filter((c) => c.tag === c.k.tag).length;
  const wrong = M.cas.length - M.ok;
  const pts = M.ok * 20 - wrong * 20;
  addScore(pts);
  if (!wrong) award('start');
  if (!SEEN.has('mci')) { SEEN.add('mci'); saveState(); }
  // a coloured card on each casualty
  for (const c of M.cas) {
    const m = new THREE.Mesh(box(0.5, 0.36, 0.06), new THREE.MeshBasicMaterial({ color: TAGS[c.tag].css }));
    m.position.set(0.25, c.k.pose === 'lie' ? 0.5 : 1.5, 0.36);
    c.ch.g.add(m);
  }
  toast(`檢傷 ${M.ok}/${M.cas.length} 正確`, `${pts >= 0 ? '+' : ''}${pts}`, pts < 0);
  sfx[wrong ? 'wrong' : 'medal']();
  renderMCI();
}
// one casualty into the player's ambulance, the rest to the backup crews (when, by the card each got)
function mciTake(i) {
  const M = MCI.cur;
  if (!M || M.phase !== 'take') return;
  const c = M.cas[i];
  c.mine = true;
  const cs = MCI_CASES[c.k.cas] || MCI_CASES.mciR;
  const pr = nearestOnRoads(c.x, c.z, (e) => !e.flags.campus && !e.flags.alley);
  const p = { id: ++callSeq, c: cs, name: c.name, look: c.look, cpr: false, life: cs.life, life0: cs.life, t: 0, state: 'ride', rate: 1,
    x: c.x, z: c.z, proj: { e: pr.e, s: pr.s, px: pr.px, pz: pr.pz }, rejected: new Set(), dest: null, tips: 0, mci: true, mciTag: c.tag };
  // over-triage: the player took someone who did not need to go first
  if (c.k.tag !== 'red') p.overNote = `你先載了${TAGS[c.k.tag].name}色的傷患（${startReason(c.k)}），紅色傷患只能等下一台車。`;
  p.eval = evaluateChoices(p, G.home);
  fadeCasualty(c);
  M.phase = 'backup';
  M.t = 0;
  const due = { red: [8, 22], yellow: [30, 55], green: [60, 90], black: [20, 40] };
  let n = 0;
  for (const q of M.cas) if (!q.mine) { const [a, b] = due[q.tag]; q.due = grand(a, b) + n * 2; n++; }
  UI.mci.hidden = true;
  G.state = 'play';
  riding = p;
  sfx.pickup();
  updateGuide(true);
  openDest('board');
  if (G.home !== undefined) {
    const aux = STATIONS.filter((S, k) => k !== G.home).slice(0, 3).map((S) => S.unit).join('、');
    setTimeout(() => { if (G.state === 'play') bubble('119 勤務指揮中心', `支援的救護車（${aux}）陸續到場，會依你的檢傷卡<b>紅→黃→綠</b>的順序後送，並分送到不同醫院。`, '#e0413a', 6, 'siren'); }, 1200);
  }
}
function fadeCasualty(c) {
  if (c.gone) return;
  c.gone = true;
  c.fade = 0;
}
function mciRender(dt) {
  const M = MCI.cur;
  if (!M) return;
  for (const c of M.cas) {
    if (!c.gone) continue;
    c.fade += dt;
    c.ch.g.scale.setScalar(0.95 * Math.max(0.001, 1 - c.fade / 0.6));
    if (c.fade > 0.6 && c.ch.g.parent) c.ch.g.parent.remove(c.ch.g);
  }
}
function endMCI(quiet) {
  const M = MCI.cur;
  if (!M || M.ended) return;
  M.ended = true;
  const hs = Object.keys(M.sent).length, sent = Object.values(M.sent).reduce((a, b) => a + b, 0);
  if (!quiet) {
    showCaseCard({ tri: 'red', title: '大量傷患事件結束', pts: '', name: M.type.name, dx: `檢傷 ${M.ok}/${M.cas.length} 正確・其他車後送 ${sent} 人到 ${hs} 家醫院${M.lost ? `・${M.lost} 人沒等到` : ''}`,
      why: MCI_WHY, note: hs >= 3 ? '大量傷患要分送到好幾家醫院，不要全塞進最近的醫學中心，每家急診才撐得住。' : '傷患集中在少數醫院時，那幾家急診很快就會滿床。', bad: M.lost > 0 }, 0.5);
  }
  setTimeout(() => clearMCI(), quiet ? 0 : 20000);
}
function clearMCI() {
  const M = MCI.cur;
  if (!M) return;
  for (const c of M.cas) if (c.ch.g.parent) c.ch.g.parent.remove(c.ch.g);
  for (const o of M.objs) { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); }
  if (M.lead && patients.includes(M.lead)) removePatient(scene, M.lead);
  MCI.cur = null;
}

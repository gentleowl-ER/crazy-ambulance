// ===================== HUD, briefing, destination panel, minimap, input =====================
const UI = {};
const input = { gas: false, brake: false, left: false, right: false, drift: false, steer: 0 };
const keys = {};
let isTouch = false;
const ETA_SPEED = 22; // average route speed in units/s, for the ETA shown to the player
const INK = '#4b3424', FAINT = '#b9a88f';

function initUI() {
  for (const id of ['hud', 'touch', 'title', 'brief', 'pause', 'over', 'dest', 'loading', 'loadingText', 'timer', 'timerNum', 'timerPlus',
    'calls', 'mission', 'missionIcon', 'missionTitle', 'missionSub', 'pbar', 'minimap', 'score', 'tally', 'bubble', 'bubbleIcon', 'bubbleWho',
    'bubbleText', 'casecard', 'toasts', 'bigmsg', 'keys', 'pauseBtn', 'ctlHelp', 'startBtn', 'soundBtn', 'soundBtn2', 'bestLine', 'bestLine2',
    'resumeBtn', 'restartBtn', 'briefBtn2', 'againBtn', 'homeBtn', 'overTitle', 'rankLetter', 'rankName', 'stSaved', 'stDead', 'stFirst',
    'stIdeal', 'stScore', 'newBest', 'review', 'hcards', 'caplist', 'trilist', 'briefMap', 'goBtn', 'briefBack', 'destTri', 'destName',
    'destLife', 'destClose', 'destAlert', 'destQuote', 'destSigns', 'destRows', 'destLegend', 'destFoot', 'freeBtn', 'quitBtn', 'roadSign',
    'timerLbl', 'bigmap', 'mapCanvas', 'mapClose', 'mapNote', 'tSiren', 'keySiren', 'rules', 'resetBtn', 'trialBtn', 'codex', 'codexBtn', 'codexBack',
    'codexList', 'codexCount', 'musicBtn', 'musicBtn2', 'viewBtn', 'viewBtn2', 'keyView', 'medals', 'medalsBtn', 'medalsBack', 'medalList', 'medalCount', 'medalRow', 'medalTitle',
    'intro', 'introCap', 'introLogo', 'introGo', 'introSkip0', 'introSkip', 'introFade', 'ckWheel', 'ckNeedle', 'introReplay', 'homePick', 'homeRow', 'homeNote', 'erList', 'wxPick', 'wxRow', 'wxNote', 'garage', 'garageBtn', 'garageBack', 'garageBank', 'garageList', 'mci', 'mciTitle', 'mciSub', 'mciLead', 'mciList', 'mciGo', 'mciTake', 'addrBtn', 'spots', 'spotsList', 'spotsNote', 'spotsBack', 'spotBtn2', 'tpPick', 'tpRow', 'tpNote', 'tpPick2', 'tpRow2', 'tpNote2']) UI[id] = $(id);
  UI.homeRow.addEventListener('click', (e) => {
    const b = e.target.closest('.hp');
    if (!b) return;
    G.homePick = b.dataset.st;
    saveState();
    renderHomePick();
    drawBriefMap();
  });
  UI.wxRow.addEventListener('click', (e) => {
    const b = e.target.closest('.hp');
    if (!b) return;
    G.wxPick = b.dataset.wx;
    saveState();
    renderWxPick();
  });
  for (const row of [UI.tpRow, UI.tpRow2]) row.addEventListener('click', (e) => {
    const b = e.target.closest('.hp');
    if (!b) return;
    G.tpPick = b.dataset.tp;
    saveState();
    renderTpPick();
  });
  UI.mm = UI.minimap.getContext('2d');
  isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  UI.ctlHelp.innerHTML = isTouch
    ? '<span><span class="key">◀ ▶</span>轉向</span><span><span class="key">油門</span>加速</span><span><span class="key">煞車</span>停車／倒車</span><span><span class="key">鳴笛</span>路口車流停下</span><span><span class="key">地圖</span>點小地圖</span><span><span class="key">相機</span>切換視角</span><span><span class="key">↺</span>卡住重置</span>'
    : '<span><span class="key">W A S D</span>駕駛</span><span><span class="key">Space</span>甩尾</span><span><span class="key">E</span>鳴笛</span><span><span class="key">M</span>地圖</span><span><span class="key">V</span>視角</span><span><span class="key">1–9 0 -</span>選醫院</span><span><span class="key">R</span>重置</span><span><span class="key">P</span>暫停</span>';
  UI.keys.hidden = isTouch;
  buildBriefingContent();
  UI.destLegend.innerHTML = CAP_ORDER.map((k) => `<span>${iconSVG(CAP_ICON[k], INK, 14)}${CAPS[k].name}</span>`).join('');
  // keyboard
  const map = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift', KeyE: 'siren', KeyH: 'siren' };
  window.addEventListener('keydown', (e) => {
    if (G.state === 'gate' || G.state === 'intro') {
      const onBody = document.activeElement === document.body || !document.activeElement;
      if (e.code === 'Escape') { endIntro(); e.preventDefault(); }
      else if (G.state === 'gate' && onBody && (e.code === 'Enter' || e.code === 'Space')) { startIntro(); e.preventDefault(); }
      return;
    }
    if (G.state === 'map') {
      if (e.code === 'KeyM' || e.code === 'Escape') { closeMap(); e.preventDefault(); }
      return;
    }
    if (G.state === 'choose') {
      const n = hospKey(e);
      if (n >= 1 && n <= HOSPITALS.length) { chooseDest(n - 1); e.preventDefault(); return; }
      if ((e.code === 'Escape' || e.code === 'KeyC') && riding && riding.dest) { closeDest(); e.preventDefault(); }
      return;
    }
    if (G.mode === 'dispatch' && (G.state === 'dchoose' || G.state === 'play')) {
      const n = G.state === 'dchoose' ? hospKey(e) : parseInt(e.key, 10);
      if (n >= 1 && n <= 12) { if (G.state === 'dchoose') dispatchKey(n); else if (n <= units.length) focusUnit(units[n - 1]); e.preventDefault(); return; }
      if (e.code === 'KeyF' && G.state === 'play') { UI.dSpeed.click(); e.preventDefault(); return; }
      if (e.code === 'KeyP' || e.code === 'Escape') { pauseGame(); e.preventDefault(); }
      return;
    }
    if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') { if (G.state === 'play' || G.state === 'countdown') pauseGame(); else if (G.state === 'paused' && UI.brief.hidden) resumeGame(); }
    if (e.code === 'KeyM' && (G.state === 'play' || G.state === 'countdown') && G.mode !== 'dispatch') { openMap(); e.preventDefault(); }
    if (e.code === 'Tab' && G.state === 'play') { e.preventDefault(); if (!riding && G.mode === 'mission') cycleCall(e.shiftKey ? -1 : 1); }
    if (e.code === 'KeyC' && G.state === 'play' && riding) openDest('change');
    if (e.code === 'KeyR' && (G.state === 'play' || G.state === 'countdown')) { resetCar(); e.preventDefault(); }
    if (e.code === 'KeyT' && G.state === 'play' && G.mode === 'free') { startTrial(); e.preventDefault(); }
    if (e.code === 'KeyG' && G.state === 'play' && G.mode === 'free') { startAddr(); e.preventDefault(); }
    if (e.code === 'KeyQ' && G.state === 'play') { shout(); e.preventDefault(); }
    if (e.code === 'KeyV' && G.mode !== 'dispatch' && (G.state === 'play' || G.state === 'countdown')) { cycleView(); e.preventDefault(); }
    if ((e.code === 'Enter' || e.code === 'Space') && document.activeElement === document.body) {
      if (G.state === 'title' && !UI.title.hidden) { e.preventDefault(); showBriefing('start'); }
      else if (G.state === 'brief') { e.preventDefault(); if (G.briefMode === 'dispatch') startDispatch(); else startGame(); }
    }
  });
  window.addEventListener('keyup', (e) => { if (map[e.code]) { keys[map[e.code]] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; touchState.clear(); refreshTouch(); });
  // touch buttons (a finger can slide between buttons)
  const btns = [...document.querySelectorAll('.tbtn[data-k]')];
  const hitBtn = (x, y) => {
    let best = null, bd = Infinity;
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      const d = hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < r.width * 0.72 && d < bd) { bd = d; best = b.dataset.k; }
    }
    return best;
  };
  const layer = $('app');
  layer.addEventListener('pointerdown', (e) => {
    if (UI.touch.hidden || e.pointerType === 'mouse') return;
    const k = hitBtn(e.clientX, e.clientY);
    if (k) { touchState.set(e.pointerId, k); refreshTouch(); e.preventDefault(); }
  }, { passive: false });
  layer.addEventListener('pointermove', (e) => {
    if (!touchState.has(e.pointerId)) return;
    const k = hitBtn(e.clientX, e.clientY);
    if (k && k !== touchState.get(e.pointerId)) { touchState.set(e.pointerId, k); refreshTouch(); }
    e.preventDefault();
  }, { passive: false });
  const onUp = (e) => { if (touchState.delete(e.pointerId)) refreshTouch(); };
  layer.addEventListener('pointerup', onUp);
  layer.addEventListener('pointercancel', onUp);
  for (const b of btns) {
    b.addEventListener('mousedown', () => { touchState.set('m', b.dataset.k); refreshTouch(); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  window.addEventListener('mouseup', () => { if (touchState.delete('m')) refreshTouch(); });
  UI.startBtn.addEventListener('click', () => showBriefing('start'));
  UI.introGo.addEventListener('click', startIntro);
  UI.introSkip0.addEventListener('click', () => { audioInit(); endIntro(); });
  UI.introSkip.addEventListener('click', endIntro);
  UI.introReplay.addEventListener('click', () => { audioInit(); introGate(); startIntro(); });
  UI.freeBtn.addEventListener('click', () => showSpots(false));
  UI.spotsList.addEventListener('click', (e) => { const b = e.target.closest('.spot'); if (b) pickSpot0(+b.dataset.g, +b.dataset.k); });
  UI.spotsBack.addEventListener('click', () => { if (G.spotJump) { G.state = 'paused'; showScreen('pause'); } else showScreen('title'); });
  UI.spotBtn2.addEventListener('click', () => showSpots(true));
  UI.quitBtn.addEventListener('click', () => showTitle());
  UI.minimap.addEventListener('click', () => { if (G.state === 'play' || G.state === 'countdown') openMap(); });
  UI.mapClose.addEventListener('click', () => closeMap());
  UI.bigmap.addEventListener('click', (e) => { if (e.target === UI.bigmap) closeMap(); });
  UI.goBtn.addEventListener('click', () => { if (G.briefMode === 'pause') resumeGame(); else if (G.briefMode === 'dispatch') startDispatch(); else startGame(); });
  UI.briefBack.addEventListener('click', () => hideBriefing());
  UI.briefBtn2.addEventListener('click', () => showBriefing('pause'));
  UI.againBtn.addEventListener('click', () => (G.mode === 'dispatch' ? startDispatch() : startGame()));
  UI.homeBtn.addEventListener('click', () => showTitle());
  UI.resumeBtn.addEventListener('click', () => resumeGame());
  UI.restartBtn.addEventListener('click', () => (G.mode === 'free' ? startFree(G.freeAt) : G.mode === 'dispatch' ? startDispatch() : startGame()));
  UI.pauseBtn.addEventListener('click', () => pauseGame());
  UI.resetBtn.addEventListener('click', () => resetCar());
  UI.viewBtn.addEventListener('click', () => cycleView());
  UI.viewBtn2.addEventListener('click', () => cycleView());
  UI.trialBtn.addEventListener('click', () => startTrial());
  UI.addrBtn.addEventListener('click', () => startAddr());
  $('tShout').addEventListener('pointerdown', (e) => { shout(); e.preventDefault(); });
  UI.codexBtn.addEventListener('click', () => showCodex());
  UI.codexBack.addEventListener('click', () => showScreen('title'));
  UI.medalsBtn.addEventListener('click', () => showMedals());
  UI.medalsBack.addEventListener('click', () => showScreen('title'));
  UI.garageBtn.addEventListener('click', () => showGarage());
  UI.mciList.addEventListener('click', (e) => { const b = e.target.closest('.tagb'); if (b) mciTag(+b.dataset.i, b.dataset.t); });
  UI.mciGo.addEventListener('click', () => mciConfirm());
  UI.mciTake.addEventListener('click', (e) => { const b = e.target.closest('[data-take]'); if (b) mciTake(+b.dataset.take); });
  UI.garageBack.addEventListener('click', () => showScreen('title'));
  UI.garageList.addEventListener('click', (e) => { const b = e.target.closest('[data-up]'); if (b && buyUpgrade(b.dataset.up)) renderGarage(); });
  UI.musicBtn.addEventListener('click', () => toggleMusic());
  UI.musicBtn2.addEventListener('click', () => toggleMusic());
  UI.soundBtn.addEventListener('click', () => toggleMute());
  UI.soundBtn2.addEventListener('click', () => toggleMute());
  UI.mission.addEventListener('click', () => {
    if (G.state !== 'play') return;
    if (G.mode === 'free' && G.trial) startTrial();
    else if (G.mode === 'free') openMap();
    else if (riding) openDest('change');
    else cycleCall(1);
  });
  UI.destClose.addEventListener('click', () => closeDest());
  UI.destRows.addEventListener('click', (e) => { const b = e.target.closest('.drow'); if (!b) return; if (b.dataset.act === 'refuse') refuseRide(); else chooseDest(+b.dataset.i); });
  UI.calls.addEventListener('click', (e) => {
    const b = e.target.closest('.call[data-id]');
    if (!b || G.state !== 'play' || riding) return;
    const p = patients.find((q) => q.id === +b.dataset.id);
    if (p) { selCall = p; updateGuide(true); }
  });
  UI.casecard.addEventListener('click', caseCardClick);
  document.addEventListener('visibilitychange', () => { if (document.hidden && (G.state === 'play' || G.state === 'countdown')) pauseGame(); });
  updateSoundButtons();
}
const touchState = new Map();
function refreshTouch() {
  const on = new Set(touchState.values());
  for (const b of document.querySelectorAll('.tbtn')) b.classList.toggle('on', on.has(b.dataset.k));
  input.tGas = on.has('gas'); input.tBrake = on.has('brake'); input.tLeft = on.has('left'); input.tRight = on.has('right'); input.tDrift = on.has('drift'); input.tSiren = on.has('siren');
}
function readInput() {
  input.gas = !!(keys.gas || input.tGas);
  input.brake = !!(keys.brake || input.tBrake);
  input.drift = !!(keys.drift || input.tDrift);
  input.siren = !!(keys.siren || input.tSiren);
  const l = !!(keys.left || input.tLeft), r = !!(keys.right || input.tRight);
  input.steer = (r ? 1 : 0) - (l ? 1 : 0);
  return input;
}

// ---------- messages ----------
function toast(text, amount, bad, color) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '') + (color ? ' tc' : '');
  if (color) el.style.setProperty('--tc', color);
  el.innerHTML = `${text}${amount ? ` <b>${amount}</b>` : ''}`;
  UI.toasts.appendChild(el);
  while (UI.toasts.children.length > 3) UI.toasts.firstChild.remove();
  setTimeout(() => el.remove(), 1950);
}
let bigTimer = 0;
function bigMsg(text, small, dur) {
  const el = UI.bigmsg;
  el.innerHTML = text + (small ? `<small>${small}</small>` : '');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  el.style.animationDuration = (dur || 1.7) + 's';
  clearTimeout(bigTimer);
  bigTimer = setTimeout(() => el.classList.remove('show'), (dur || 1.7) * 1000 + 50);
}
let bubbleTimer = 0;
function bubble(who, text, color, dur, icon) {
  if (!UI.casecard.hidden && !CARD.mini) return;
  UI.bubbleWho.textContent = who;
  UI.bubbleText.innerHTML = text;
  UI.bubbleIcon.style.background = color || 'var(--tan)';
  UI.bubbleIcon.innerHTML = iconSVG(icon || 'person', color ? '#ffffff' : INK, 20);
  UI.bubble.hidden = false;
  UI.bubble.classList.remove('pop'); void UI.bubble.offsetWidth; UI.bubble.classList.add('pop');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { UI.bubble.hidden = true; }, (dur || 3) * 1000);
}
function flashTimerPlus(n) {
  UI.timerPlus.textContent = (n > 0 ? '+' : '') + n;
  UI.timerPlus.style.color = n > 0 ? 'var(--good)' : 'var(--red-deep)';
  UI.timerPlus.classList.remove('show'); void UI.timerPlus.offsetWidth; UI.timerPlus.classList.add('show');
}
let caseTimer = 0, caseDelay = 0;
// While the ambulance is moving the card folds down to a one-line chip (out of the way of the road ahead);
// it opens again when the ambulance stops, or when the player taps it.
const CARD = { mini: false, pin: false, slowT: 0 };
function hideCaseCard() { UI.casecard.hidden = true; setCardMini(false); }
function setCardMini(on) {
  CARD.mini = on;
  UI.casecard.classList.toggle('mini', on);
  UI.hud.classList.toggle('cardmini', on && !UI.casecard.hidden);
}
// o: {tri, title, pts, name, dx, why, note, plus, bad}; appears once the big message has faded
function showCaseCard(o, delay = 1.5) {
  clearTimeout(caseDelay);
  if (delay > 0) { caseDelay = setTimeout(() => showCaseCard(o, 0), delay * 1000); return; }
  if (G.state !== 'play' && G.state !== 'dchoose') return;
  const T = o.chip || TRIAGE[o.tri];
  UI.casecard.className = o.bad ? 'bad' : '';
  UI.casecard.innerHTML = `<div class="cc-head"><span class="tri" style="background:${T.css}">${T.name}</span><b>${o.title}</b>${o.pts ? `<span class="pts">${o.pts}</span>` : ''}<span class="cc-more" aria-hidden="true">說明</span><span class="cc-x" aria-hidden="true">×</span></div>`
    + `<div class="cc-body"><div class="cc-dx">${o.name} <span>·</span> ${o.dx}</div><p>${o.why}</p>`
    + (o.plus ? `<p class="plus">${o.plus}</p>` : '') + (o.note ? `<p class="note">${o.note}</p>` : '') + '</div>';
  UI.bubble.hidden = true;
  UI.casecard.hidden = false;
  CARD.pin = false; CARD.slowT = 0;
  setCardMini(G.mode !== 'dispatch' && car.speed > 6);
  UI.casecard.classList.remove('pop'); void UI.casecard.offsetWidth; UI.casecard.classList.add('pop');
  clearTimeout(caseTimer);
  caseTimer = setTimeout(hideCaseCard, 12000);
}
function caseCardClick(e) {
  if (CARD.mini && !(e.target.closest && e.target.closest('.cc-x'))) {
    // open it up and keep it open while driving, for a while
    CARD.pin = true; setCardMini(false);
    clearTimeout(caseTimer); caseTimer = setTimeout(hideCaseCard, 14000);
    return;
  }
  hideCaseCard();
}
function caseCardStep(dt) {
  if (UI.casecard.hidden || G.mode === 'dispatch') { if (CARD.mini || UI.hud.classList.contains('cardmini')) setCardMini(false); return; }
  if (CARD.pin) return;
  if (car.speed > 7) { CARD.slowT = 0; if (!CARD.mini) setCardMini(true); }
  else if (car.speed < 2.5) { CARD.slowT += dt; if (CARD.mini && CARD.slowT > 0.6) setCardMini(false); }
}

// ---------- HUD ----------
const hudCache = {};
function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
function setHTML(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.innerHTML = v; } }
function discHTML(css, icon) {
  return `<span style="display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:${css}">${iconSVG(icon, '#ffffff', 20)}</span>`;
}
let roadT = 0;
function updateHUD(dt = 0.016) {
  const free = G.mode === 'free';
  if (free && G.addr) {
    setText(UI.timerNum, 'time', String(Math.floor(G.addr.t)));
    setText(UI.timerLbl, 'tl', '路名');
    if (hudCache.low) { hudCache.low = false; UI.timer.classList.remove('low'); }
    setText(UI.score, 'score', `路名挑戰 ${fmtTrial(G.addr.t)}`);
    setText(UI.tally, 'tally', ADDR_BEST[G.addr.name] ? `最佳 ${fmtTrial(ADDR_BEST[G.addr.name])}` : '第一次挑戰');
  } else if (free && G.trial) {
    setText(UI.timerNum, 'time', String(Math.floor(G.trial.t)));
    setText(UI.timerLbl, 'tl', '計時');
    if (hudCache.low) { hudCache.low = false; UI.timer.classList.remove('low'); }
    setText(UI.score, 'score', `計時賽 ${fmtTrial(G.trial.t)}`);
    setText(UI.tally, 'tally', TRIALS[G.trial.H.id] ? `最佳 ${fmtTrial(TRIALS[G.trial.H.id])}` : '第一次挑戰');
  } else if (free) {
    setText(UI.timerNum, 'time', String(FOUND.size));
    setText(UI.timerLbl, 'tl', `/${LM.length} 地標`);
    if (hudCache.low) { hudCache.low = false; UI.timer.classList.remove('low'); }
    setText(UI.score, 'score', `地標 ${FOUND.size}/${LM.length}`);
    setText(UI.tally, 'tally', `去過的醫院 ${VISITED.size}/${HOSPITALS.length}`);
  } else {
    setText(UI.timerNum, 'time', String(Math.max(0, Math.ceil(G.time))));
    setText(UI.timerLbl, 'tl', ['值班', WX.id === 'day' ? '' : WX.cur.short, JAM.id === 'off' ? '' : JAM.T.short].filter(Boolean).join('・'));
    const low = G.time < 10.5 && G.state === 'play';
    if (hudCache.low !== low) { hudCache.low = low; UI.timer.classList.toggle('low', low); }
    setText(UI.score, 'score', G.score.toLocaleString('en-US') + ' 分');
    setText(UI.tally, 'tally', `救活 ${G.saved} · 過世 ${G.dead}`);
  }
  // street-name sign under the minimap
  roadT -= dt;
  if (roadT <= 0) {
    roadT = 0.35;
    const n = placeName(car.x, car.z);
    setText(UI.roadSign, 'road', n);
    if (hudCache.rs !== !!n) { hudCache.rs = !!n; UI.roadSign.hidden = !n; }
  }
  if (free) {
    const tl = G.trial ? '取消計時賽' : '送醫計時賽';
    if (hudCache.trial !== tl) { hudCache.trial = tl; UI.trialBtn.textContent = tl; UI.trialBtn.classList.toggle('on', !!G.trial); }
    const al = G.addr ? '取消路名挑戰' : '路名挑戰';
    if (hudCache.addr !== al) { hudCache.addr = al; UI.addrBtn.textContent = al; UI.addrBtn.classList.toggle('on', !!G.addr); }
  }
  const sOn = sirenOn();
  if (hudCache.siren !== sOn) { hudCache.siren = sOn; UI.tSiren.classList.toggle('live', sOn); UI.keySiren.classList.toggle('live', sOn); }
  const dist = guide.len ? `約 ${etaSec(guide.len)} 秒車程` : '';
  let frac = 0, barCol = 'var(--good)';
  if (free && G.addr) {
    const A = G.addr, tier = A.lim.findIndex((x) => A.t <= x);
    setHTML(UI.missionIcon, 'mi', discHTML(A.css, 'pin'));
    setText(UI.missionTitle, 'mt', `路名挑戰：${A.full}`);
    setText(UI.missionSub, 'ms', `${A.clue} · ${tier >= 0 ? `${TRIAL_TIERS[tier][0]}剩 ${Math.ceil(A.lim[tier] - A.t)} 秒` : '沒有獎牌了'}`);
    frac = tier >= 0 ? clamp(1 - A.t / A.lim[tier], 0, 1) : 0;
    barCol = tier >= 0 ? TRIAL_TIERS[tier][1] : 'var(--ink-faint)';
  } else if (free && G.trial) {
    const T = G.trial, tier = T.lim.findIndex((x) => T.t <= x);
    setHTML(UI.missionIcon, 'mi', discHTML(T.H.css, 'cross'));
    setText(UI.missionTitle, 'mt', `計時賽：送往 ${T.H.name}`);
    setText(UI.missionSub, 'ms', tier >= 0 ? `${TRIAL_TIERS[tier][0]}還剩 ${Math.ceil(T.lim[tier] - T.t)} 秒 · 點我取消` : '沒有獎牌了，還是開到終點吧 · 點我取消');
    frac = tier >= 0 ? clamp(1 - T.t / T.lim[tier], 0, 1) : 0;
    barCol = tier >= 0 ? TRIAL_TIERS[tier][1] : 'var(--ink-faint)';
  } else if (free) {
    const L = nextLandmark();
    setHTML(UI.missionIcon, 'mi', discHTML(LM_GOLD, 'star'));
    if (L) {
      setText(UI.missionTitle, 'mt', `下一個地標：${L.name}`);
      setText(UI.missionSub, 'ms', `${dist} · 點我看大地圖`);
    } else {
      setText(UI.missionTitle, 'mt', '全部地標都找到了！');
      setText(UI.missionSub, 'ms', '繼續兜風，或回標題出勤');
    }
    frac = FOUND.size / Math.max(1, LM.length);
    barCol = LM_GOLD;
  } else if (G.hold) {
    const h = G.hold;
    setHTML(UI.missionIcon, 'mi', discHTML(h.H.css, 'cross'));
    setText(UI.missionTitle, 'mt', `等床交接中・${h.H.name}`);
    setText(UI.missionSub, 'ms', `急診壅塞，還要 ${Math.max(1, Math.ceil(h.t))} 秒才能離開`);
    frac = clamp(1 - h.t / h.t0, 0, 1);
    barCol = ER_CSS[2];
  } else if (riding) {
    const T = TRIAGE[riding.c.tri], H = riding.dest;
    setHTML(UI.missionIcon, 'mi', discHTML(H ? H.css : T.css, 'cross'));
    setText(UI.missionTitle, 'mt', H ? `送往 ${H.name}` : '選擇醫院');
    setText(UI.missionSub, 'ms', `${dist} · ${riding.name}剩 ${Math.max(0, Math.ceil(riding.life))} 秒 · 點我改送`);
    frac = clamp(riding.life / riding.life0, 0, 1);
    barCol = frac < 0.25 ? 'var(--red)' : T.css;
  } else {
    const p = currentCall();
    if (p) {
      const T = TRIAGE[p.c.tri];
      setHTML(UI.missionIcon, 'mi', discHTML(T.css, 'person'));
      setText(UI.missionTitle, 'mt', `前往 ${p.name}・${p.c.short}`);
      setText(UI.missionSub, 'ms', `${dist} · 剩 ${Math.max(0, Math.ceil(secLeft(p)))} 秒${p.reach === false ? ' · 可能來不及' : ''}`);
      frac = clamp(p.life / p.life0, 0, 1);
      barCol = frac < 0.25 ? 'var(--red)' : T.css;
    } else {
      setHTML(UI.missionIcon, 'mi', iconSVG('person', INK, 20));
      setText(UI.missionTitle, 'mt', '待命中');
      setText(UI.missionSub, 'ms', '等待 119 派遣…');
    }
  }
  const w = (frac * 100).toFixed(1) + '%';
  if (hudCache.pw !== w) { hudCache.pw = w; UI.pbar.style.width = w; }
  if (hudCache.pc !== barCol) { hudCache.pc = barCol; UI.pbar.style.background = barCol; }
  updateCalls();
}
// dispatch list under the shift timer
let callEls = new Map();
function updateCalls() {
  const w = riding ? [] : callsByPriority();
  const key = w.map((p) => p.id).join(',') + (riding ? 'r' : '');
  if (hudCache.calls !== key) {
    hudCache.calls = key;
    callEls = new Map();
    UI.calls.innerHTML = (w.length ? `<div class="call head">119 派遣 · ${isTouch ? '點選切換' : 'Tab 切換'}</div>` : '') + w.map((p) => `<button class="call" type="button" data-id="${p.id}" style="--tc:${TRIAGE[p.c.tri].css}"><i></i><span class="cl">${p.xd ? '跨區・' : ''}${p.c.short}</span><em>來不及</em><b></b></button>`).join('');
    for (const el of UI.calls.querySelectorAll('.call[data-id]')) callEls.set(+el.dataset.id, { el, b: el.querySelector('b'), s: '', sel: null, low: null, late: null });
  }
  const cur = riding ? null : currentCall();
  for (const p of w) {
    const o = callEls.get(p.id);
    if (!o) continue;
    const s = String(Math.max(0, Math.ceil(secLeft(p))));
    if (o.s !== s) { o.s = s; o.b.textContent = s; }
    const sel = p === cur, low = secLeft(p) < 20, late = p.reach === false;
    if (o.sel !== sel) { o.sel = sel; o.el.classList.toggle('sel', sel); }
    if (o.low !== low) { o.low = low; o.el.classList.toggle('low', low); }
    if (o.late !== late) { o.late = late; o.el.classList.toggle('late', late); o.el.title = late ? '照目前距離估計，可能來不及送醫' : ''; }
  }
}

// ---------- destination panel ----------
// how busy the ER is right now (the real-time ER status Taiwan publishes for its big hospitals)
function erChipHTML(H) {
  if (!H.er) return '';
  const k = erLevel(H);
  return k === 3 ? '' : `<span class="erc${k >= 2 ? ' hot' : k === 0 ? ' ok' : ''}" style="--ec:${ER_CSS[k]}" title="急診${ER_TXT[k]}">${ER_TXT[k]}</span>`;
}
// drive time, plus the wait for a bed when the ER is crowded
function etaWaitHTML(sec, H) {
  const w = erWait(H);
  return `<b>${Math.max(1, Math.round(sec))} 秒</b>${w >= 2 ? `<small class="wait">等床 ${w} 秒</small>` : '<small>車程</small>'}`;
}
function capIconsHTML(H) {
  return `<span class="capicons" style="--hc:${H.css}">` + CAP_ORDER.map((k) => {
    const on = H.caps.includes(k);
    return `<i class="${on ? 'on' : 'off'}" title="${CAPS[k].name}${on ? '' : '：沒有'}">${iconSVG(CAP_ICON[k], on ? INK : FAINT, 15)}</i>`;
  }).join('') + '</span>';
}
function openDest(mode, rejectedAt) {
  if (!riding) return;
  if (G.state !== 'choose') G.prevState = G.state;
  G.state = 'choose';
  renderDest(mode, rejectedAt);
  UI.dest.hidden = false;
  hideCaseCard(); UI.bubble.hidden = true;
  updateHUD();
  touchState.clear(); refreshTouch();
  for (const k in keys) keys[k] = false;
  UI.touch.hidden = true;
  sfx.panel();
}
function renderDest(mode, H0) {
  const p = riding, c = p.c, T = TRIAGE[c.tri];
  UI.destTri.textContent = T.name; UI.destTri.style.background = T.css;
  UI.destName.textContent = p.name;
  UI.destLife.textContent = p.mci ? `剩 ${Math.max(0, Math.ceil(p.life))} 秒 · 大量傷患・${TAGS[p.mciTag].name}色檢傷卡` : `剩 ${Math.max(0, Math.ceil(p.life))} 秒 · ${c.who}打 119`;
  UI.destQuote.innerHTML = `<span class="who">${c.who}：</span>「${c.say}」`;
  const signs = c.signs.slice();
  if (c.cpr) signs.push(p.cpr ? '路人正在 CPR' : '沒有人做 CPR');
  UI.destSigns.innerHTML = signs.map((s) => `<span>${s}</span>`).join('');
  UI.destAlert.hidden = mode !== 'reject' && mode !== 'divert' && !c.fake;
  if (c.fake) UI.destAlert.innerHTML = '<b>乘客說</b>：「其實沒那麼痛啦～直接載我去台北車站就好，我要趕高鐵！」他意識清楚、可以自己走路。';
  if (mode === 'reject' && H0) UI.destAlert.innerHTML = `<b>${H0.name}</b>：${rejectReason(H0, c)}請改送其他醫院。`;
  if (mode === 'divert' && H0) UI.destAlert.innerHTML = `<b>${H0.name}</b> 急診滿床，暫停收治。救護車要分流到其他醫院。`;
  UI.destClose.hidden = !p.dest;
  UI.destFoot.textContent = isTouch ? '遊戲暫停中，慢慢判斷' : `遊戲暫停中，慢慢判斷 · ${HOSP_KEYS}`;
  const dists = hospitalDistances();
  // nearest first; the number stays the hospital's own, as on the maps
  const shut = (H) => p.rejected.has(H.id) || isDiverted(H);
  const order = HOSPITALS.map((H, i) => i).sort((a, b) => shut(HOSPITALS[a]) - shut(HOSPITALS[b]) || dists[a] - dists[b]);
  UI.destRows.innerHTML = order.map((i) => {
    const H = HOSPITALS[i], lv = LEVELS[H.level];
    const full = isDiverted(H), no = p.rejected.has(H.id) || full;
    const note = [hospNote(H), G.mode === 'mission' && farFromHome(H, G.home) ? '跨區' : ''].filter(Boolean).join('・');
    const dist = full ? '<b>滿床</b><small>暫停收治</small>' : no ? '<b>拒收</b><small>需要轉院</small>' : etaWaitHTML(etaSec(dists[i]), H);
    return `<button class="drow${no ? ' no' : ''}${p.dest === H ? ' cur' : ''}" type="button" data-i="${i}" style="--hc:${H.css}"${no ? ' disabled' : ''}>`
      + `<span class="num">${i + 1}</span>`
      + `<span class="hn"><b>${H.name}</b>${note ? `<em>${note}</em>` : ''}</span>`
      + `<span class="meta"><span class="lv" style="--lc:${lv.color}">${lv.name}</span>${no ? '' : erChipHTML(H)}${capIconsHTML(H)}</span>`
      + `<span class="dist">${dist}</span></button>`;
  }).join('');
  // a passenger who only wants a ride: the right answer is not a hospital at all
  if (c.fake) UI.destRows.insertAdjacentHTML('afterbegin', `<button class="drow refuse" type="button" data-act="refuse"><span class="num">${iconSVG('car', '#ffffff', 16)}</span>`
    + '<span class="hn"><b>請他自行搭車</b></span><span class="meta"><em>不是急症・救護車不是計程車</em></span><span class="dist"><b>拒載</b><small>不送醫</small></span></button>');
  const first = UI.destRows.querySelector('.drow:not(.no)');
  if (first && !isTouch) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* focus unsupported */ } }, 0);
}
function closeDest() {
  if (G.state !== 'choose') return;
  UI.dest.hidden = true;
  G.state = 'play';
  UI.touch.hidden = !isTouch;
  last = performance.now();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
// drive time, the number that matters in the game (city distances are compressed)
const etaSec = (len) => Math.max(1, Math.round(len / ETA_SPEED));
function chooseDest(i) {
  const H = HOSPITALS[i];
  if (!riding || !H || riding.rejected.has(H.id) || isDiverted(H)) return;
  const changed = riding.dest && riding.dest !== H;
  riding.dest = H;
  if (!riding.firstDest) riding.firstDest = H;
  // for 最速傳說: the clock and the drive the ETA promises from here
  riding.legT = G.time; riding.legEta = hospitalDistances()[i] / ETA_SPEED;
  closeDest();
  sfx.choose();
  toast(`${changed ? '改送' : '送往'} ${H.name}`, '', false, H.css);
  updateGuide(true);
  if (!G.sirenHinted) {
    G.sirenHinted = true;
    setTimeout(() => { if (riding && G.state === 'play') bubble('調度中心', `${isTouch ? '按左下角的「鳴笛」' : '按 <b>E</b> 鳴笛'}，路口的車才會停下來讓你先過！`, '#e23b33', 4.5, 'siren'); }, 700);
  }
}

// ---------- briefing ----------
function buildBriefingContent() {
  UI.hcards.innerHTML = HOSPITALS.map((H, i) => {
    const lv = LEVELS[H.level];
    let chips = H.caps.map((k) => `<span class="chip">${iconSVG(CAP_ICON[k], INK, 15)}${CAPS[k].name}</span>`).join('');
    if (H.only === 'momkid') chips += '<span class="chip plain">只收兒童和孕產婦</span>';
    if (H.noER) chips = '<span class="chip plain">癌症治療</span><span class="chip plain">門診・住院</span>';
    else if (!H.caps.length) chips = `<span class="chip">${iconSVG('cross', INK, 15)}一般急診</span><span class="chip plain">適合輕症與先穩定的急症</span>`;
    return `<div class="hcard" style="--hc:${H.css}"><div class="hc-top"><span class="num">${i + 1}</span><b>${H.name}</b><span class="lv" style="--lc:${lv.color}">${lv.full}</span></div>`
      + `<div class="hc-pics"><span class="hc-pic"><canvas class="hc-shot" data-i="${i}" width="400" height="300" role="img" aria-label="${H.name}外觀"></canvas><i>外觀</i></span>`
      + `<span class="hc-pic"><canvas class="hc-loc" data-i="${i}" width="400" height="300" role="img" aria-label="${H.name}位置：${H.hint}"></canvas><i>位置</i></span></div>`
      + `<div class="hc-caps">${chips}</div><div class="hc-hint">${iconSVG('pin', '#8a7560', 13)}${H.hint}</div></div>`;
  }).join('');
  const where = (k) => HOSPITALS.filter((H) => H.caps.includes(k)).length;
  UI.caplist.innerHTML = CAP_ORDER.map((k) => `<div class="capi"><span class="ci">${iconSVG(CAP_ICON[k], INK, 19)}</span><div><b>${CAPS[k].name}・${CAPS[k].desc}</b><span>${CAPS[k].sym}（${where(k)} 家有）</span></div></div>`).join('')
    + `<div class="capi"><span class="ci">${iconSVG('cross', INK, 19)}</span><div><b>${ER_INFO.name}・${ER_INFO.desc}</b><span>${ER_INFO.sym}</span></div></div>`;
  UI.rules.innerHTML = [
    ['light', '紅綠燈', '一般車輛會停紅燈，行人會等綠燈走斑馬線過馬路。救護車沒鳴笛闖紅燈會扣分；鳴笛可以通過，但要減速、看清楚路口。'],
    ['siren', '鳴笛', `${isTouch ? '按左下角的「鳴笛」' : '按 <b>E</b> 鳴笛'}：路口的橫向車流會停下，前方車輛會靠邊讓道，從道路中間超車通過。沒鳴笛時，被你擋到的車會按喇叭。`],
    ['phone', '大聲公', `遇到不讓路的車，${isTouch ? '按「罵人」' : '按 <b>Q</b>'}拿大聲公喊話，前面的車會靠邊；但罵太多次會得到「救護車路怒」獎牌。`],
    ['pin', '巷弄捷徑', '有些街區中間有巷子可以穿過去，大安森林公園也有步道，比繞路快；但巷子窄，有減速丘、攤販和停著的機車。'],
    ['heart', '平穩駕駛', '載著病人撞車，病人會少 4–7 秒；一路沒有碰撞，送達再加 40 分。'],
    ['cross', '送錯醫院', '醫院沒有需要的急救能力就會拒收；轉院讓病人再少 15 秒，加上多開的路，危急病人常常撐不住。'],
    ['person', '沒人做 CPR', '倒地沒呼吸、旁邊又沒人壓胸的病人，時間會流逝得特別快；救護員接手 CPR 後才恢復正常。'],
    ['station', '轄區', '119 大多派你去自己分隊的轄區；鄰近分隊沒車時，會請你跨區支援。醫院列表上標「跨區」的離轄區很遠，送去那裡，回來接下一位就要更久。'],
    ['cross', '急診壅塞', '每送一位病人進急診，就佔一張床一段時間。壅塞時要陪病人等床，值班時間照樣在跑；滿床時暫停收治，要改送其他醫院。'],
    ['person', '大量傷患', '每一班可能遇到一次氣爆、連環車禍或公車翻覆。第一台到場的你是檢傷官：用 START 幫每位傷患掛上紅、黃、綠、黑的檢傷卡，再載走一位紅色傷患；其他人由支援的救護車依你的檢傷卡順序後送。'],
    ['cone', '路況', '路上會出現道路施工、車禍、道路管制、廟會遶境，颱風夜還會倒樹。地圖上的虛線就是受影響的路段，導航會自動繞路；道路管制時鳴笛靠近，警察會移開拒馬讓你過。'],
    ['rain', '天氣', '雨天路滑、車流慢；夜班視線差，靠路燈和車燈；颱風夜陣風會把車吹偏。越難開的天氣，送醫得分越高。'],
    ['wrench', '車庫升級', '每一班的得分會存進救護基金，在標題畫面的「車庫升級」幫救護車換引擎、輪胎、避震、警笛和急救箱。'],
    ['medal', '獎牌', '救回心跳停止的病人、開得又快又穩可以拿獎牌；迷路、撞人、闖紅燈也會得到不太光榮的「獎牌」。'],
    ['reset', '卡住了？', `${isTouch ? '按右上角的 ↺' : '按 <b>R</b>'}，把救護車放回路上。`],
  ].map(([ic, t, d]) => `<div class="rule"><span class="ri">${iconSVG(ic, INK, 19)}</span><div><b>${t}</b>　${d}</div></div>`).join('');
  renderTriage(false);
}
const ER_LEGEND = ['到了馬上交接', '要稍等一下', '沒有空床，救護車要陪病人等床', '暫停收治，要改送別家'];
function renderERBrief(disp) {
  UI.erList.innerHTML = ER_TXT.map((t, k) => `<div class="trow"><span class="erc${k >= 2 ? ' hot' : ''}" style="--ec:${ER_CSS[k]}">${t}</span>${ER_LEGEND[k]}</div>`).join('')
    + '<div class="trnote">每送一位病人進急診，就會佔一張床一段時間。醫學中心平常就很擠（很多民眾直接去大醫院），<b>輕症也往那裡送</b>，急診就會越來越塞；其實中度級醫院就能處理九成五以上的急重症。'
    + (disp ? '等床的救護車不能出勤，它的轄區就會出現<b>空窗</b>。' : '等床的時候，值班時間照樣在跑。') + '</div>';
}
function renderTriage(disp) {
  renderERBrief(disp);
  const rows = disp ? ['red', 'yellow', 'green', 'black', 'none'] : ['red', 'yellow', 'green'];
  UI.trilist.innerHTML = rows.map((k) => `<div class="trow"><span class="tri" style="background:${TRIAGE[k].css}">${TRIAGE[k].name}</span>${TRIAGE[k].examples}</div>`).join('')
    + (disp
      ? '<div class="trnote"><b>危急</b>和<b>緊急</b>的病人等太久會不幸過世，輕症病人則會由家屬自行送醫。救護人員到場後病人能撐得久一點，但<b>危急</b>病人要靠<b>高級救護</b>才穩得住，一般救護車止不住惡化。送到不能處理的醫院，轉院會讓病人再少 20 秒。</div>'
      : '<div class="trnote">病人頭上的圓圈是剩下的時間。<b>危急</b>和<b>緊急</b>的病人時間到就會不幸過世；輕症病人則會由家屬自行送醫。同時有好幾通 119 時，先救最危急的人！</div>');
}
function showBriefing(mode) {
  G.briefMode = mode;
  if (mode !== 'pause') { G.state = 'brief'; showScreen('brief'); }
  else { UI.pause.hidden = true; UI.brief.hidden = false; }
  const disp = mode === 'dispatch' || (mode === 'pause' && G.mode === 'dispatch');
  UI.brief.classList.toggle('dispatch', disp);
  UI.dbrief.hidden = !disp;
  UI.briefTitle.textContent = disp ? '派遣前簡報' : '出勤前簡報';
  UI.briefMapTitle.textContent = disp ? '醫院與救護站在哪裡' : '醫院在哪裡';
  renderTriage(disp);
  UI.briefLead.innerHTML = disp
    ? '你是 119 救護派遣員。電話進來後，先判斷<em>要不要派車、派哪一台</em>；救護車到場回報後，再決定<em>送哪一家醫院，或是不需要送醫</em>。'
    : '病人上車後會說出症狀。先判斷他需要<em>哪一種急救能力</em>，再挑一家<em>有這種能力、又最近</em>的醫院。時間只比直接開過去多一點，<em>繞路、送錯醫院、撞車</em>都會讓病人來不及。';
  UI.goBtn.textContent = mode === 'pause' ? '回到遊戲' : disp ? '開始值班' : '開始出勤';
  UI.briefBack.hidden = false;
  UI.brief.scrollTop = 0;
  renderHomePick();
  renderWxPick();
  renderTpPick();
  drawBriefMap();
  queueHospViews();
}
// the mission briefing: which station the shift works from (its calls come from that district)
const HOME_NOTE = {
  rand: '每一班隨機分到一個分隊，每個分隊的轄區、醫院和路況都不一樣。',
  zq: '台北車站、西門町、萬華一帶：醫院多，路口和巷子也多。',
  zs: '中山北路、民權東路到大直、內湖一帶：巧克力、塑膠醫院就在轄區，過了基隆河就是士林。',
  da: '大安森林公園、師大、公館一帶：醫學中心近，急診也常常很擠。',
  xy: '台北101、市政府到松山一帶：大路寬，但離多數醫院都有一段距離。',
  sn: '士林夜市、故宮、天文館到社子：百貨醫院在轄區中間，重症也可以往北送頂好。',
  bt: '石牌、天母、關渡平原：頂好、開心醫院就在附近，但關渡很遠，跨區送醫要很久才回得來。',
};
function renderWxPick() {
  const show = G.briefMode === 'start' || G.briefMode === 'dispatch';
  UI.wxPick.hidden = !show;
  if (!show) return;
  const cur = WEATHERS[G.wxPick] ? G.wxPick : 'rand';
  UI.wxRow.innerHTML = [['rand', '隨機'], ...WX_ORDER.map((k) => [k, WEATHERS[k].name])]
    .map(([id, n]) => `<button class="hp${id === cur ? ' on' : ''}" type="button" data-wx="${id}" aria-pressed="${id === cur}">${id !== 'rand' ? iconSVG(WEATHERS[id].icon, id === cur ? '#ffffff' : INK, 14) : ''}${n}</button>`).join('');
  const W = WEATHERS[cur];
  UI.wxNote.textContent = W ? W.desc + (W.bonus > 1 ? `得分 ×${W.bonus}。` : '') : '每一班的天氣隨機：多半是晴天，也可能下雨、值夜班，或碰上颱風夜。越難開，得分越高。';
}
function renderHomePick() {
  const show = G.briefMode === 'start';
  UI.homePick.hidden = !show;
  if (!show) return;
  const cur = STATIONS.some((S) => S.id === G.homePick) ? G.homePick : 'rand';
  UI.homeRow.innerHTML = [['rand', '隨機'], ...STATIONS.map((S) => [S.id, S.name])]
    .map(([id, n]) => `<button class="hp${id === cur ? ' on' : ''}" type="button" data-st="${id}" aria-pressed="${id === cur}">${n}</button>`).join('');
  UI.homeNote.textContent = HOME_NOTE[cur] || '';
}
function hideBriefing() {
  if (G.briefMode === 'pause') { UI.brief.hidden = true; UI.pause.hidden = false; return; }
  showTitle();
}
// the whole playable city, and the big map's framing: all of it if the screen is tall enough, else the part
// around the ambulance and its route
const CITY_VIEW = { x0: -860, z0: -1470, x1: 1120, z1: 680 };
function bigMapView(cw, ch) {
  const V = CITY_VIEW, W = V.x1 - V.x0, H = V.z1 - V.z0;
  if (Math.min(cw / W, ch / H) * W >= cw * 0.72) return V;
  let bx0 = car.x - 240, bx1 = car.x + 240, bz0 = car.z - 240, bz1 = car.z + 240;
  for (const [x, z] of guide.pts) { bx0 = Math.min(bx0, x - 60); bx1 = Math.max(bx1, x + 60); bz0 = Math.min(bz0, z - 60); bz1 = Math.max(bz1, z + 60); }
  // match the screen's shape, inside the city
  let w = bx1 - bx0, h = bz1 - bz0;
  if (w / h < cw / ch) w = h * (cw / ch); else h = w / (cw / ch);
  w = Math.min(w, W); h = Math.min(h, H);
  const cx = clamp((bx0 + bx1) / 2, V.x0 + w / 2, V.x1 - w / 2), cz = clamp((bz0 + bz1) / 2, V.z0 + h / 2, V.z1 - h / 2);
  return { x0: cx - w / 2, z0: cz - h / 2, x1: cx + w / 2, z1: cz + h / 2 };
}
function drawBriefMap() {
  const cv = UI.briefMap;
  if (!mapImg) return;
  const W = cv.width, H = cv.height;
  const g = cv.getContext('2d');
  // crop to the playable city, 關渡 to 公館
  const { x0, z0, x1, z1 } = CITY_VIEW;
  const sc = Math.min(W / (x1 - x0), H / (z1 - z0));
  const ox = (W - (x1 - x0) * sc) / 2, oz = (H - (z1 - z0) * sc) / 2;
  g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.drawImage(mapImg, (x0 - WX0) * MAP_SCALE, (z0 - WZ0) * MAP_SCALE, (x1 - x0) * MAP_SCALE, (z1 - z0) * MAP_SCALE, ox, oz, (x1 - x0) * sc, (z1 - z0) * sc);
  const P = (x, z) => [ox + (x - x0) * sc, oz + (z - z0) * sc];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [name, lx, lz] of [['台北車站', -10, -40], ['中正紀念堂', 108, 250], ['台北101', 813, 236], ['松山機場', 640, -400], ['臺灣大學', 400, 590], ['士林', 120, -790], ['故宮', 560, -1060], ['石牌', -60, -1180], ['天母', 330, -1250], ['關渡', -560, -1250], ['社子', -260, -760], ['大直', 560, -640], ['內湖', 1010, -380]]) {
    const [px, py] = P(lx, lz);
    g.font = `22px ${FONT_CJK}`;
    const tw = g.measureText(name).width;
    g.fillStyle = 'rgba(255,255,255,0.86)'; roundRect(g, px - tw / 2 - 8, py - 15, tw + 16, 30, 15); g.fill();
    g.fillStyle = '#6d5a49'; g.fillText(name, px, py + 1);
  }
  const disp = UI.brief.classList.contains('dispatch');
  // the stations; on a mission briefing the chosen duty station is where the shift starts
  const sel = disp ? -1 : G.briefMode === 'pause' && G.mode === 'mission' ? G.home : STATIONS.findIndex((S) => S.id === G.homePick);
  drawBriefStations(g, P, sel === undefined ? -1 : sel);
  HOSPITALS.forEach((Hh, i) => {
    const [px, py] = P(Hh.bld ? Hh.bld.x : Hh.anchor[0], Hh.bld ? Hh.bld.z : Hh.anchor[1]);
    g.fillStyle = 'rgba(60,38,20,0.3)'; g.beginPath(); g.arc(px, py + 3, 17, 0, TAU); g.fill();
    g.fillStyle = Hh.css; g.beginPath(); g.arc(px, py, 17, 0, TAU); g.fill();
    g.lineWidth = 3.5; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff'; g.font = `600 20px ${FONT_NUM}`; g.fillText(String(i + 1), px, py + 1);
  });
}
// the six stations; `sel` (a station index) is drawn as the shift's starting point and the rest fade back
function drawBriefStations(g, P, sel = -1) {
  STATIONS.forEach((S, i) => {
    const [px, py] = P(S.pos[0], S.pos[1]);
    const css = sel < 0 ? UNIT_TYPES[S.type].css : '#d9312b', on = sel < 0 || sel === i;
    g.globalAlpha = on ? 1 : 0.45;
    const r = on ? 15 : 11;
    g.fillStyle = 'rgba(60,38,20,0.3)'; roundRect(g, px - r, py - r + 3, r * 2, r * 2, 8); g.fill();
    g.fillStyle = css; roundRect(g, px - r, py - r, r * 2, r * 2, 8); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#ffffff'; roundRect(g, px - r, py - r, r * 2, r * 2, 8); g.stroke();
    drawIcon(g, 'station', px, py, on ? 20 : 15, '#ffffff');
    if (on) {
      g.font = `19px ${FONT_CJK}`; g.textAlign = 'left';
      const label = sel === i ? `出發點・${S.name}` : sel < 0 && G.briefMode === 'start' ? S.name : S.unit, tw = g.measureText(label).width;
      g.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(g, px + 19, py - 13, tw + 14, 26, 13); g.fill();
      g.fillStyle = sel === i ? '#a3221c' : css; g.fillText(label, px + 26, py + 1);
      g.textAlign = 'center';
    }
    g.globalAlpha = 1;
  });
}

// ---------- minimap ----------
let mapImg = null;
const MAP_SCALE = 0.6; // px per world unit in the base image
function buildMinimapImage() {
  const SW = Math.round(WXS * MAP_SCALE), SH = Math.round(WZS * MAP_SCALE);
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  const img = g.createImageData(SW, SH);
  const D = img.data;
  for (let j = 0; j < SH; j++) {
    const z = WZ0 + (j + 0.5) / MAP_SCALE;
    for (let i = 0; i < SW; i++) {
      const x = WX0 + (i + 0.5) / MAP_SCALE;
      const F = landF(x, z), rd = roadDist(x, z);
      let r, gg, b;
      if (F < 0 && rd > -1) { r = 120; gg = 196; b = 214; }
      else if (rd < 0 || alleyDist(x, z) < 0.4) { r = 255; gg = 253; b = 247; }
      else if (hillH(x, z) > 0.6) { r = 128; gg = 176; b = 104; }
      else if (parkVal(x, z) > 0 || F < 24) { r = 166; gg = 207; b = 128; }
      else if (plazaVal(x, z) > 0) { r = 236; gg = 231; b = 220; }
      else { r = 221; gg = 215; b = 202; }
      const o = (j * SW + i) * 4;
      D[o] = r; D[o + 1] = gg; D[o + 2] = b; D[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.save();
  g.scale(MAP_SCALE, MAP_SCALE);
  g.translate(-WX0, -WZ0);
  for (const bd of BUILDINGS) {
    g.save();
    g.translate(bd.x, bd.z);
    g.rotate(-bd.rot);
    g.fillStyle = bd.hosp ? bd.hosp.css : bd.station ? '#d9312b' : bd.h > 30 ? '#b7b0a3' : '#c8c0b2';
    g.fillRect(-bd.w / 2, -bd.d / 2, bd.w, bd.d);
    g.restore();
  }
  g.restore();
  mapImg = c;
}
function drawMinimap(t) {
  const ctx = UI.mm;
  const cw = UI.minimap.width;
  const rect = UI.minimap.clientWidth || 98;
  const k = cw / rect;            // device px per css px
  const sc = cw / 430;            // device px per world unit
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, cw);
  ctx.save();
  ctx.beginPath(); ctx.arc(cw / 2, cw / 2, cw / 2, 0, TAU); ctx.clip();
  ctx.fillStyle = '#d9d4c7'; ctx.fillRect(0, 0, cw, cw);
  const yaw = camState.yaw;
  ctx.translate(cw / 2, cw / 2);
  ctx.rotate(yaw + Math.PI);
  ctx.scale(sc, sc);
  ctx.translate(-car.x, -car.z);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mapImg, WX0, WZ0, WXS, WZS);
  if (!G.addr) drawJams(ctx, (x, z) => [x, z], k / sc, false);
  if (guide.pts.length > 1) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 5 / sc * k; ctx.globalAlpha = 0.5;
    ctx.beginPath(); guide.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); ctx.stroke();
    ctx.strokeStyle = guide.color; ctx.lineWidth = 3.2 / sc * k; ctx.globalAlpha = 0.95;
    ctx.beginPath(); guide.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const dot = (x, z, r, fill, stroke) => { ctx.beginPath(); ctx.arc(x, z, r / sc * k, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 2 / sc * k; ctx.strokeStyle = stroke; ctx.stroke(); } };
  // the address challenge: no markers, only the streets
  if (!G.addr) for (const m of hospMarks) {
    const tgt = riding && riding.dest === m.H;
    dot(m.x, m.z, tgt ? 7 + Math.sin(t * 6) * 1.2 : 5.2, isDiverted(m.H) ? '#9a948c' : m.H.css, erLevel(m.H) === 2 ? ER_CSS[2] : '#ffffff');
  }
  for (const p of patients) if (p.state === 'wait') dot(p.rx, p.rz, 4.6 + Math.sin(t * 5 + p.ph) * 0.7, TRIAGE[p.c.tri].css, INK);
  if (G.mode === 'free' && !G.addr) for (const L of LM) { const f = FOUND.has(L.name); starPath(ctx, L.x, L.z, (f ? 5 : 6) / sc * k); ctx.fillStyle = f ? LM_GOLD : '#ffffff'; ctx.fill(); ctx.lineWidth = 1.6 / sc * k; ctx.strokeStyle = f ? '#ffffff' : LM_GOLD; ctx.stroke(); }
  for (const v of traffic) dot(v.x, v.z, 1.8, '#7d746b');
  drawRoadEvents(ctx, (x, z) => [x, z], k / sc, false);
  ctx.restore();
  // player arrow (always points up = camera forward)
  const carRel = angDiff(yaw, car.h);
  ctx.save();
  ctx.translate(cw / 2, cw / 2);
  ctx.rotate(-carRel);
  ctx.scale(k, k);
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
  ctx.fillStyle = '#e23b33'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.restore();
}

function starPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}

// ---------- full-screen map ----------
function openMap() {
  if (G.state !== 'play' && G.state !== 'countdown') return;
  G.mapPrev = G.state;
  G.state = 'map';
  if (G.mode === 'free' && G.addr) addrPeek();
  UI.mapNote.textContent = (G.mode === 'free' ? `地標 ${FOUND.size}/${LM.length} · 暫停中` : '遊戲暫停中') + (JAM.list.length ? ` · 紅色路段：${JAM.T.name}車陣` : '');
  UI.bigmap.hidden = false;
  hideCaseCard();
  touchState.clear(); refreshTouch();
  for (const k in keys) keys[k] = false;
  UI.touch.hidden = true;
  requestAnimationFrame(drawBigMap);
}
function closeMap() {
  if (G.state !== 'map') return;
  UI.bigmap.hidden = true;
  G.state = G.mapPrev || 'play';
  UI.touch.hidden = !isTouch;
  last = performance.now();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function drawBigMap() {
  if (UI.bigmap.hidden || !mapImg) return;
  const cv = UI.mapCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = cv.clientWidth || 600, ch = cv.clientHeight || 500;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { x0, z0, x1, z1 } = bigMapView(cw, ch);
  const sc = Math.min(cw / (x1 - x0), ch / (z1 - z0));
  const ox = (cw - (x1 - x0) * sc) / 2, oz = (ch - (z1 - z0) * sc) / 2;
  g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, cw, ch);
  g.imageSmoothingEnabled = true;
  g.drawImage(mapImg, (x0 - WX0) * MAP_SCALE, (z0 - WZ0) * MAP_SCALE, (x1 - x0) * MAP_SCALE, (z1 - z0) * MAP_SCALE, ox, oz, (x1 - x0) * sc, (z1 - z0) * sc);
  const P = (x, z) => [ox + (x - x0) * sc, oz + (z - z0) * sc];
  const big = cw > 520;
  const fs = big ? 13 : 10.5;
  drawJams(g, P, 1, big);
  if (guide.pts.length > 1) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [col, w, a] of [[INK, 6, 0.45], [guide.color, 3.6, 1]]) {
      g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = a;
      g.beginPath(); guide.pts.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = (text, px, py, col) => {
    g.font = `${fs}px ${FONT_CJK}`;
    const tw = g.measureText(text).width;
    g.fillStyle = 'rgba(255,255,255,0.88)'; roundRect(g, px - tw / 2 - 5, py - fs * 0.75, tw + 10, fs * 1.5, fs * 0.75); g.fill();
    g.fillStyle = col; g.fillText(text, px, py + 0.5);
  };
  for (const L of LM) {
    const [px, py] = P(L.x, L.z);
    const known = G.mode !== 'free' || FOUND.has(L.name);
    starPath(g, px, py, big ? 8 : 6); g.fillStyle = known ? LM_GOLD : '#ffffff'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = known ? '#ffffff' : LM_GOLD; g.stroke();
    if (big || known) label(known ? L.name : '？', px, py + (big ? 17 : 13), known ? '#6d5a49' : '#a08a4a');
  }
  // the duty station the shift works from
  if (G.mode === 'mission' && G.home !== undefined && STATIONS[G.home]) {
    const S = STATIONS[G.home], [px, py] = P(S.pos[0], S.pos[1]), r = big ? 10 : 8;
    g.fillStyle = '#d9312b'; roundRect(g, px - r, py - r, r * 2, r * 2, 4); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#ffffff'; roundRect(g, px - r, py - r, r * 2, r * 2, 4); g.stroke();
    drawIcon(g, 'station', px, py, r * 1.4, '#ffffff');
    label(`${S.name}分隊`, px, py + r + (big ? 10 : 8), '#a3221c');
  }
  HOSPITALS.forEach((Hh, i) => {
    const [px, py] = P(Hh.drop[0], Hh.drop[1]);
    const r = big ? 11 : 8.5;
    g.fillStyle = 'rgba(60,38,20,0.3)'; g.beginPath(); g.arc(px, py + 2, r, 0, TAU); g.fill();
    const full = isDiverted(Hh), lv = erLevel(Hh);
    // a crowded ER gets a warm ring around its marker
    if (lv === 1 || lv === 2) { g.lineWidth = lv === 2 ? 4 : 2.6; g.strokeStyle = ER_CSS[lv]; g.beginPath(); g.arc(px, py, r + 3.5, 0, TAU); g.stroke(); }
    g.fillStyle = full ? '#9a948c' : Hh.css; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = (riding && riding.dest === Hh) ? INK : '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff'; g.font = `600 ${big ? 13 : 10.5}px ${FONT_NUM}`; g.fillText(String(i + 1), px, py + 0.5);
    if (big || full || lv === 2) label(full ? `${Hh.name}・滿床` : lv === 2 ? `${Hh.name}・壅塞` : Hh.name, px, py - (big ? 20 : 15), full ? '#7a736b' : lv === 2 ? ER_CSS[2] : Hh.css);
  });
  drawRoadEvents(g, P, 1, big);
  for (const p of patients) if (p.state === 'wait') {
    const [px, py] = P(p.rx, p.rz);
    g.fillStyle = TRIAGE[p.c.tri].css; g.beginPath(); g.arc(px, py, big ? 7 : 5.5, 0, TAU); g.fill();
    g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  }
  const [cx, cy] = P(car.x, car.z);
  g.save(); g.translate(cx, cy); g.rotate(Math.PI - car.h);
  const s = big ? 1.4 : 1.1;
  g.beginPath(); g.moveTo(0, -10 * s); g.lineTo(7.5 * s, 7.5 * s); g.lineTo(0, 3.5 * s); g.lineTo(-7.5 * s, 7.5 * s); g.closePath();
  g.fillStyle = '#e23b33'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#ffffff'; g.stroke();
  g.restore();
}

// ---------- screens ----------
function showScreen(name) {
  UI.codex.hidden = name !== 'codex';
  UI.medals.hidden = name !== 'medals';
  if (UI.mci) UI.mci.hidden = true;
  UI.garage.hidden = name !== 'garage';
  UI.spots.hidden = name !== 'spots';
  UI.title.hidden = name !== 'title';
  UI.brief.hidden = name !== 'brief';
  UI.pause.hidden = name !== 'pause';
  UI.over.hidden = name !== 'over';
  UI.dest.hidden = true;
  UI.bigmap.hidden = true;
  UI.hud.classList.toggle('free', G.mode === 'free');
  const disp = G.mode === 'dispatch';
  UI.hud.classList.toggle('dispatch', disp);
  const playing = name === 'play';
  UI.hud.hidden = !(playing || name === 'pause');
  UI.dhud.hidden = !(disp && (playing || name === 'pause'));
  UI.touch.hidden = !(playing && isTouch && !disp);
  if (!playing) { touchState.clear(); refreshTouch(); }
  applyViewOffset();
}
function updateViewButtons() {
  const t = `視角：${VIEWS[G.view || 'top'].name}`;
  if (UI.viewBtn2) UI.viewBtn2.textContent = t;
  if (UI.keyView) UI.keyView.textContent = t;
  if (UI.viewBtn) UI.viewBtn.title = `${t}（按一下切換，V）`;
}
function updateSoundButtons() {
  const t = G.muted ? '音效：關' : '音效：開', m = G.music === false ? '音樂：關' : '音樂：開';
  if (UI.soundBtn) UI.soundBtn.textContent = t;
  if (UI.soundBtn2) UI.soundBtn2.textContent = t;
  if (UI.musicBtn) UI.musicBtn.textContent = m;
  if (UI.musicBtn2) UI.musicBtn2.textContent = m;
}
// ---------- case collection ----------
function showCodex() {
  const all = [...CASES, MCI_CALL, ...TW_CASES, ...DISPATCH_CASES, ...NOCALLS];
  const groups = [['危急', (c) => c.tri === 'red'], ['緊急', (c) => c.tri === 'yellow'], ['輕症', (c) => c.tri === 'green'], ['明顯死亡', (c) => c.tri === 'black'], ['不需要派救護車的電話', (c) => c.tri === 'none']];
  const dispOnly = new Set([...DISPATCH_CASES, ...NOCALLS].map((c) => c.id));
  const needTxt = (c) => (c.needs === 'er' ? '一般急診（最近的急救責任醫院）' : `${CAPS[c.needs].name}（${CAPS[c.needs].desc}）`) + (c.kid ? '，兒童病人' : '');
  const actTxt = { minor: '明顯輕症：可以現場處置、建議自行就醫', dead: '明顯死亡：不送醫，陪伴家屬並通報警方', go: '需要送醫' };
  UI.codexList.innerHTML = groups.map(([title, f]) => {
    const list = all.filter(f);
    return `<h3>${title}</h3>` + list.map((c) => {
      const seen = SEEN.has(c.id), T = TRIAGE[c.tri];
      const where = dispOnly.has(c.id) ? '派遣模式' : c.fake || c.id === 'mci' ? '出勤任務' : '出勤・派遣';
      if (!seen) return `<details class="locked"><summary><span class="tri" style="background:${T.css}">${T.name}</span><b>？？？</b><span class="where">${where}</span></summary><div class="cx-body">還沒遇到這個病例，去${where === '出勤・派遣' ? '出勤任務或派遣模式' : where}找找看。</div></details>`;
      const body = c.ref ? `<b>應該：</b>${REFERRALS[c.ref].name}<br>${c.why}`
        : `<b>民眾說：</b>「${c.say}」<br><b>診斷：</b>${c.dx}<br>${c.why}<br><b>送醫：</b>${c.fake ? '不需要：請他自行搭車' : SCENE[c.id] && SCENE[c.id].act !== 'go' ? actTxt[SCENE[c.id].act] : needTxt(c)}`;
      return `<details><summary><span class="tri" style="background:${T.css}">${T.name}</span><b>${c.short}</b><span class="where">${where}</span></summary><div class="cx-body">${body}</div></details>`;
    }).join('');
  }).join('');
  UI.codexCount.textContent = `${all.filter((c) => SEEN.has(c.id)).length}/${all.length}`;
  showScreen('codex');
  UI.codex.scrollTop = 0;
}
function updateBestLines() {
  const f = (n) => `<b>${n.toLocaleString('en-US')} 分</b>`;
  const parts = [];
  if (G.best > 0) parts.push(`出勤最佳 ${f(G.best)}`);
  if (G.bestD > 0) parts.push(`派遣最佳 ${f(G.bestD)}`);
  UI.bestLine.innerHTML = parts.length ? parts.join('<span class="sep">·</span>') : '還沒有紀錄，第一次出勤吧';
  const b = G.mode === 'dispatch' ? G.bestD || 0 : G.best;
  UI.bestLine2.innerHTML = b > 0 ? `最佳紀錄 ${f(b)}` : '';
}
// medals won this shift, on the results screen
function renderMedalRow() {
  const ids = SHIFT.medals;
  UI.medalTitle.hidden = UI.medalRow.hidden = !ids.length;
  UI.medalRow.innerHTML = ids.map((id) => { const M = MEDAL_BY[id]; return `<div class="mrow ${M.good ? 'good' : 'bad'}">${medalHTML(M, 38)}<span><b>${M.name}</b><small>${M.desc}</small></span></div>`; }).join('');
}
// the medal cabinet (title screen)
function showMedals() {
  const won = MEDALS.filter((M) => MEDAL_WON[M.id]).length;
  UI.medalCount.textContent = `${won}/${MEDALS.length}`;
  const sec = (good) => MEDALS.filter((M) => M.good === good).map((M) => {
    const n = MEDAL_WON[M.id] || 0;
    return `<div class="mcell ${n ? '' : 'locked'} ${M.good ? 'good' : 'bad'}">${n ? medalHTML(M, 46) : `<span class="mlock">${medalHTML(M, 46)}</span>`}<b>${n ? M.name : '？？？'}</b><small>${M.desc}</small>${n ? `<em>×${n}</em>` : ''}</div>`;
  }).join('');
  UI.medalList.innerHTML = `<h3>榮譽獎牌</h3><div class="mgrid">${sec(true)}</div><h3>不太光榮的「獎牌」</h3><div class="mgrid">${sec(false)}</div>`;
  showScreen('medals');
  UI.medals.scrollTop = 0;
}
const OUTCOME = { refused: ['識破搭便車', 'saved'], fakeride: ['被當計程車', 'dead'], saved: ['救活', 'saved'], dead: ['不幸過世', 'dead'], left: ['家屬自行送醫', 'left'], handover: ['交接下一班', 'left'],
  overtx: ['其實不需送醫', 'left'], nodispatch: ['不需派車', 'saved'], wasted: ['白跑一趟', 'dead'], notransport: ['現場處置', 'saved'], deadscene: ['明顯死亡・不送醫', 'left'], hungup: ['民眾掛斷', 'dead'],
  backup: ['他隊後送', 'saved'], mcidead: ['檢傷延誤過世', 'dead'], expectant: ['黑色檢傷', 'left'] };
function renderReview() {
  if (!caseLog.length) { UI.review.innerHTML = '<div class="empty">這一班還沒有處理任何病例</div>'; return; }
  UI.review.innerHTML = caseLog.map((r) => {
    const T = TRIAGE[r.c.tri];
    const [ot, oc] = OUTCOME[r.outcome] || ['結案', 'left'];
    const hosp = r.hosp ? `<br><b>送往：</b>${r.hosp.name}${r.ideal ? '（最佳選擇）' : ''}` : '';
    const note = r.note ? `<br><b>小提醒：</b>${r.note}` : '';
    return `<details><summary><span class="tri" style="background:${T.css}">${T.name}</span><span class="rn">${r.name}・${r.c.short}</span><span class="oc ${oc}">${ot}</span></summary>`
      + `<div class="rv-body"><b>診斷：</b>${r.c.dx}<br>${r.c.why}${hosp}${note}</div></details>`;
  }).join('');
}

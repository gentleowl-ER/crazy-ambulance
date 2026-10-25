// ===================== street voices: shouts from people the ambulance nearly hits, horns from cars =====================
// Both are synthesized: a shout is a buzzy voice through formant filters gliding from "u" to "a" (哇!), a horn is two
// detuned square waves. A speech balloon pops up over whoever made the noise.
const VOICE = { m: [135, 1.0], f: [255, 1.17], k: [370, 1.32], e: [118, 0.96] }; // pitch, formant scale
function yelp(vol, kind) {
  if (!AU.ctx || G.muted || AU.ctx.state !== 'running') return;
  const ctx = AU.ctx, t0 = ctx.currentTime + 0.01;
  const [p0, fs] = VOICE[kind] || VOICE.m;
  const f0 = p0 * (0.92 + Math.random() * 0.16), dur = 0.42 + Math.random() * 0.12;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.82, t0);
  o.frequency.linearRampToValueAtTime(f0 * 1.3, t0 + 0.08);
  o.frequency.exponentialRampToValueAtTime(f0 * (kind === 'e' ? 0.85 : 0.72), t0 + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = kind === 'e' ? 9 : 6.5; lg.gain.value = f0 * (kind === 'e' ? 0.06 : 0.03);
  lfo.connect(lg); lg.connect(o.frequency);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(vol, t0 + 0.025);
  out.gain.setValueAtTime(vol, t0 + dur * 0.45); out.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  // "u" -> "a": F1 300->730, F2 870->1090, F3 2240->2440 (scaled up for women and children)
  for (const [fa, fb, g, q] of [[300, 730, 1.0, 7], [870, 1090, 0.6, 9], [2240, 2440, 0.22, 10]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(fa * fs, t0); bp.frequency.linearRampToValueAtTime(fb * fs, t0 + 0.1);
    const gg = ctx.createGain(); gg.gain.value = g * 2.6;
    o.connect(bp); bp.connect(gg); gg.connect(out);
  }
  out.connect(AU.master);
  o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
}
function horn(vol, kind) {
  if (!AU.ctx || G.muted || AU.ctx.state !== 'running') return;
  const ctx = AU.ctx;
  const [f1, f2, dur, n] = kind === 'bus' ? [220, 262, 0.55, 1] : kind === 'scooter' ? [700, 880, 0.11, 2] : [392, 494, 0.24, Math.random() < 0.55 ? 2 : 1];
  for (let k = 0; k < n; k++) {
    const t0 = ctx.currentTime + 0.01 + k * (dur + 0.08);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    out.gain.setValueAtTime(vol, t0 + dur - 0.03); out.gain.linearRampToValueAtTime(0, t0 + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'scooter' ? 3200 : 2100;
    for (const f of [f1, f2]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    lp.connect(out); out.connect(AU.master);
  }
}

// ---------- speech balloons over people and cars ----------
const SAY_PED = ['哇！', '小心啦！', '嚇死人！', '開慢一點！', '救命喔！', '看路啦！', '欸欸欸！'];
const SAY = { tex: {}, pool: [], last: 0 };
function sayTexture(text, horn) {
  if (SAY.tex[text]) return SAY.tex[text];
  const t = textTexture(256, 128, (g, w, h) => {
    if (horn) {
      // a yellow burst
      g.beginPath();
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, r = i % 2 ? 44 : 60; g.lineTo(w / 2 + Math.cos(a) * r * 1.9, h / 2 + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#4b3424'; g.stroke();
    } else {
      g.fillStyle = '#ffffff'; g.strokeStyle = '#4b3424'; g.lineWidth = 5;
      roundRect(g, 8, 8, w - 16, h - 40, 26); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(w / 2 - 14, h - 33); g.lineTo(w / 2, h - 8); g.lineTo(w / 2 + 14, h - 33); g.fill(); g.stroke();
      g.fillRect(w / 2 - 12, h - 38, 24, 8);
    }
    g.fillStyle = horn ? '#a3221c' : '#4b3424'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${text.length > 3 ? 40 : 50}px ${FONT_CJK}`;
    g.fillText(text, w / 2, horn ? h / 2 + 2 : (h - 32) / 2 + 6);
  });
  SAY.tex[text] = t;
  return t;
}
function sayAt(text, x, y, z, hornish) {
  if (!scene) return;
  let s = SAY.pool.find((q) => q.t <= 0);
  if (!s) {
    if (SAY.pool.length >= 8) s = SAY.pool.reduce((a, b) => (a.t < b.t ? a : b));
    else {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sayTexture(text, hornish), transparent: true, depthWrite: false }));
      sp.renderOrder = 5;
      scene.add(sp);
      s = { sp, t: 0 };
      SAY.pool.push(s);
    }
  }
  s.sp.material.map = sayTexture(text, hornish);
  s.sp.material.needsUpdate = true;
  Object.assign(s, { t: 1.25, x, y, z });
  s.sp.visible = true;
}
function sayRender(dt) {
  const big = !chaseOn() && G.mode !== 'dispatch';
  for (const s of SAY.pool) {
    if (s.t <= 0) { if (s.sp.visible) s.sp.visible = false; continue; }
    s.t -= dt;
    const u = 1 - s.t / 1.25;
    const k = (big ? 1.5 : 1) * (u < 0.12 ? 0.6 + (u / 0.12) * 0.45 : 1.05 - Math.min(0.05, (u - 0.12) * 0.2));
    s.sp.scale.set(3.4 * k, 1.7 * k, 1);
    s.sp.position.set(s.x, s.y + u * 1.2, s.z);
    s.sp.material.opacity = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
  }
}

// ---------- who makes the noise ----------
const VOICE_T = { ped: 0, car: 0 };
function listenerDist(x, z) { return hypot(x - car.x, z - car.z); }
function pedYelp(p) {
  if (G.state !== 'play' && G.state !== 'intro') return;
  if (G.t < VOICE_T.ped || G.t < (p.yelpT || 0)) return;
  const d = listenerDist(p.x, p.z);
  if (d > 14 || car.speed < 8) return;
  VOICE_T.ped = G.t + 0.45; p.yelpT = G.t + 4;
  yelp(0.11 * clamp(1.2 - d / 16, 0.3, 1), p.voice || 'm');
  sayAt(gpick(SAY_PED), p.x, (p.y || 0) + 3.4, p.z, false);
}
// a car honks at an ambulance that drives at it without the siren
function hornAt(v, why) {
  // no honking at an ambulance loading or unloading a patient (its lights would be flashing)
  if (G.state !== 'play' || G.mode === 'dispatch' || sirenOn() || G.boarding || dwell.m) return;
  if (G.t < VOICE_T.car || G.t < (v.hornT || 0)) return;
  const d = listenerDist(v.x, v.z);
  if (d > 60) return;
  VOICE_T.car = G.t + 0.3; v.hornT = G.t + (why === 'block' ? 3.5 : 5);
  const kind = v.scoot ? 'scooter' : v.kind === 'bus' || v.kind === 'garbage' ? 'bus' : 'car';
  horn(0.075 * clamp(1.15 - d / 60, 0.25, 1), kind);
  sayAt(kind === 'scooter' ? '逼逼！' : kind === 'bus' ? '叭——！' : Math.random() < 0.5 ? '叭叭！' : '叭！', v.x, v.y + (v.kind === 'bus' ? 4.6 : 3.4), v.z, true);
  if (!SHIFT.hornTip) { SHIFT.hornTip = true; toast('沒鳴笛，別的車不知道你在出勤，會對你按喇叭', ''); }
}

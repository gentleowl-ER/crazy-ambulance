// ===================== synthesized audio =====================
const AU = { ctx: null, master: null, engine: null, engGain: null, engFilt: null, siren: null, sirenGain: null, noise: null, sirenPhase: 0 };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    AU.ctx = ctx;
    AU.master = ctx.createGain(); AU.master.gain.value = G.muted ? 0 : 0.8; AU.master.connect(ctx.destination);
    // engine: two detuned oscillators through a low-pass
    AU.engFilt = ctx.createBiquadFilter(); AU.engFilt.type = 'lowpass'; AU.engFilt.frequency.value = 520; AU.engFilt.Q.value = 2;
    AU.engGain = ctx.createGain(); AU.engGain.gain.value = 0;
    AU.engFilt.connect(AU.engGain); AU.engGain.connect(AU.master);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 30.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    o1.connect(AU.engFilt); o2.connect(g2); g2.connect(AU.engFilt);
    o1.start(); o2.start();
    AU.engine = [o1, o2];
    // siren
    AU.sirenGain = ctx.createGain(); AU.sirenGain.gain.value = 0;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2400;
    AU.siren = ctx.createOscillator(); AU.siren.type = 'triangle'; AU.siren.frequency.value = 960;
    const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = 960;
    const sqg = ctx.createGain(); sqg.gain.value = 0.18;
    AU.siren.connect(sf); sq.connect(sqg); sqg.connect(sf); sf.connect(AU.sirenGain); AU.sirenGain.connect(AU.master);
    AU.siren.start(); sq.start();
    AU.sirenSq = sq;
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = nb;
  } catch (e) { AU.ctx = null; }
}
function setMuted(m) {
  G.muted = m;
  if (AU.master) AU.master.gain.setTargetAtTime(m ? 0 : 0.8, AU.ctx.currentTime, 0.05);
  updateSoundButtons();
  saveState();
}
function toggleMute() { audioInit(); setMuted(!G.muted); }
function toggleMusic() { audioInit(); G.music = G.music === false; updateSoundButtons(); saveState(); }
// ---------- background music ----------
// Two procedural pieces that crossfade with the situation. While someone is waiting for the ambulance or on board
// (or a time trial is running, or calls are open on the dispatch desk): driving rock in E minor, 152 BPM, with
// drums, palm-muted power chords through an overdrive, a pumping bass and a lead riff every other phrase.
// When the city is quiet (cruising in free mode, a lull between calls): an easy lo-fi loop of major-seventh
// chords in C, 88 BPM and swung, with brushed drums, a round bass and a vibraphone tune.
const MUSIC = { mood: null, calmT: 0, rock: { next: 0, step: 0, until: 0 }, chill: { next: 0, step: 0, until: 0 } };
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MIX = { rock: 0.75, chill: 0.72 }; // a little under the engine and the siren
function musicBus() {
  if (AU.music) return;
  const ctx = AU.ctx, G2 = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const F = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; };
  AU.music = G2(0, AU.master);
  AU.mRock = G2(0, AU.music);
  AU.mChill = G2(0, AU.music);
  // overdriven guitar: a soft clipper, then a speaker-cabinet-ish band
  const sh = ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 5) / Math.tanh(5); }
  sh.curve = curve; sh.oversample = '2x';
  AU.gtr = G2(1); AU.gtr.connect(sh);
  sh.connect(F('highpass', 90, 0.7, F('lowpass', 2900, 0.8, G2(0.11, AU.mRock))));
  AU.bassR = F('lowpass', 650, 1.1, G2(1, AU.mRock));
  // lead with a dotted-eighth echo
  const lead = G2(1, AU.mRock), dl = ctx.createDelay(1), fb = G2(0.3), wet = G2(0.28, AU.mRock);
  dl.delayTime.value = (60 / 152) * 0.75;
  AU.lead = F('lowpass', 2600, 0.7, lead); AU.lead.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet);
  // the quiet loop: a warm low-pass over everything (a little "lo-fi")
  AU.chillIn = F('lowpass', 3400, 0.6, AU.mChill);
}
function mosc(type, midi, t, dur, vol, dest, a = 0.01, detune = 0) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = mf(midi); if (detune) o.detune.value = detune;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function mnoise(t, dur, vol, dest, type, f, q = 0.8) {
  const ctx = AU.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = AU.noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.02);
}
function mkick(t, vol, dest, f0 = 150) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.32);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
}
// rock: E5 – C5 – G5 – D5; bars 5–8 add the lead riff ([eighth, note, length in eighths])
const ROCK_BPM = 152, ROCK_ROOT = [40, 36, 43, 38];
const RIFF = [
  [[0, 64, 2], [2, 67, 1], [3, 69, 1], [4, 71, 2], [6, 69, 1], [7, 67, 1]],
  [[0, 64, 3], [4, 67, 1], [5, 64, 1], [6, 62, 2]],
  [[0, 67, 2], [2, 71, 1], [3, 74, 1], [4, 71, 2], [6, 69, 1], [7, 67, 1]],
  [[0, 69, 3], [4, 66, 1], [5, 69, 1], [6, 74, 2]],
];
function rockStep(s, t) {
  const D = AU.mRock, e8 = 60 / ROCK_BPM / 2, bar = Math.floor(s / 8) % 8, k = s % 8, root = ROCK_ROOT[bar % 4], chorus = bar >= 4;
  // drums: crash on each phrase, kick on 1 and 3 (and a push), snare on 2 and 4, eighth hats, a fill into the top
  if (k === 0 && bar % 4 === 0) mnoise(t, 1.4, 0.055, D, 'highpass', 5200, 0.5);
  if (k === 0 || k === 4 || (k === 5 && bar % 2 === 1)) mkick(t, 0.22, D);
  if (k === 2 || k === 6) { mnoise(t, 0.17, 0.11, D, 'bandpass', 1900, 0.7); mosc('triangle', 55, t, 0.07, 0.05, D, 0.002); }
  if (bar === 7 && k >= 6) mnoise(t + e8 / 2, 0.09, 0.08, D, 'bandpass', 2300, 0.8);
  mnoise(t, k % 2 ? 0.03 : 0.045, k % 2 ? 0.011 : 0.018, D, 'highpass', 8200, 0.6);
  // bass: eighths on the root, jumping the octave on the last one
  mosc('sawtooth', root + (k === 7 ? 12 : 0), t, e8 * 0.85, 0.055, AU.bassR, 0.006);
  // guitar: a ringing chord on the downbeat (and the "and" of 2 in the chorus), palm-muted chugs between
  const acc = k === 0 || (chorus && k === 3);
  if (k !== 7 || chorus) for (const iv of [12, 19, 24]) mosc('sawtooth', root + iv, t, acc ? e8 * 1.8 : e8 * 0.42, acc ? 0.09 : 0.06, AU.gtr, 0.004, (iv - 12) * 1.2);
  if (chorus) for (const [st, m, l] of RIFF[bar % 4]) if (st === k) mosc('square', m, t, e8 * l * 0.95, 0.024, AU.lead, 0.008);
}
// chill: Fmaj9 – Em7 – Dm9 – Cmaj9, a vibraphone tune over bars 5–8
const CHILL_BPM = 88, CHILL_ROOT = [41, 40, 38, 36];
const CHILL_KEYS = [[57, 60, 64, 67], [55, 59, 62, 64], [53, 57, 60, 64], [52, 55, 59, 62]];
const TUNE = [
  [[1, 69, 1], [2, 72, 1], [3, 76, 3], [6, 74, 2]],
  [[0, 71, 2], [3, 67, 1], [4, 69, 2], [6, 71, 2]],
  [[1, 69, 1], [2, 72, 1], [3, 74, 3], [6, 76, 2]],
  [[0, 71, 2], [2, 67, 2], [4, 72, 4]],
];
const chillLen = (s) => (60 / CHILL_BPM) * (s % 2 ? 0.38 : 0.62); // swung eighths
function chillStep(s, t) {
  const D = AU.chillIn, beat = 60 / CHILL_BPM, bar = Math.floor(s / 8) % 8, k = s % 8, b = bar % 4, root = CHILL_ROOT[b];
  // brushed kit: soft kick, a rim click on 2 and 4, quiet swung hats
  if (k === 0) mkick(t, 0.13, D, 110);
  if (k === 5) mkick(t, 0.07, D, 100);
  if (k === 2 || k === 6) { mnoise(t, 0.05, 0.035, D, 'bandpass', 3200, 1.4); mosc('sine', 84, t, 0.03, 0.012, D, 0.001); }
  mnoise(t, 0.035, k % 2 ? 0.006 : 0.009, D, 'highpass', 7500, 0.6);
  // round bass: root, fifth, and a passing note into the next bar
  if (k === 0) { mosc('sine', root, t, beat * 1.8, 0.1, D, 0.02); mosc('triangle', root + 12, t, beat * 0.6, 0.012, D, 0.02); }
  if (k === 4) mosc('sine', root + 7, t, beat * 0.9, 0.075, D, 0.02);
  if (k === 6) mosc('sine', root + 12, t, beat * 0.4, 0.05, D, 0.02);
  // a soft pad holds the chord under the whole bar, so the groove never drops to silence
  if (k === 0) for (const m of CHILL_KEYS[b]) mosc('triangle', m - 12, t, beat * 4.3, 0.011, D, 0.35);
  // electric piano: the chord on the downbeat, softer pushes on the "and" of 2 and on 4
  if (k === 0 || k === 3 || k === 6) {
    const v = k === 0 ? 0.03 : k === 3 ? 0.018 : (b % 2 ? 0.016 : 0.01), len = k === 0 ? beat * 3.2 : beat * 0.9;
    for (const m of CHILL_KEYS[b]) { mosc('sine', m, t, len, v, D, 0.012); mosc('triangle', m + 12, t, len * 0.3, v * 0.12, D, 0.004); }
  }
  // vibraphone: two slightly detuned sines shimmer against each other
  if (bar >= 4) for (const [st, m, l] of TUNE[b]) if (st === k) { const len = beat * l * 0.7 + 0.35; mosc('sine', m, t, len, 0.032, D, 0.005, -4); mosc('sine', m, t, len, 0.032, D, 0.005, 4); }
}
// rock as soon as someone needs the ambulance; back to the easy loop only after a few quiet seconds
function musicMood() {
  if (G.state === 'intro') return 'rock';
  if (G.mode === 'free') return G.trial ? 'rock' : 'chill';
  if (G.mode === 'dispatch') return dcalls.some((c) => c.status !== 'done' && c.kind === 'patient' && c.life0) ? 'rock' : 'chill';
  return riding || waitingCalls().length ? 'rock' : 'chill';
}
function musicUpdate(play, duck, dt = 0.016) {
  if (!AU.ctx) return;
  musicBus();
  const want = play && G.music !== false && !G.muted && AU.ctx.state === 'running';
  const now = AU.ctx.currentTime;
  AU.music.gain.setTargetAtTime(want ? (duck ? 0.5 : 1) * (1 - Math.min(0.6, ELISE_T.vol * 14)) : 0, now, 0.25);
  if (!want) { MUSIC.mood = null; MUSIC.rock.until = MUSIC.chill.until = 0; return; }
  const m = musicMood();
  MUSIC.calmT = m === 'rock' ? 0 : MUSIC.calmT + dt;
  const target = m === 'rock' || (MUSIC.mood === 'rock' && MUSIC.calmT < 4) ? 'rock' : 'chill';
  if (target !== MUSIC.mood) {
    const tc = MUSIC.mood ? 0.55 : 0.05;
    if (MUSIC.mood) MUSIC[MUSIC.mood].until = now + 3; // let the old piece play on while it fades
    MUSIC.mood = target;
    AU.mRock.gain.setTargetAtTime(target === 'rock' ? MIX.rock : 0, now, tc);
    AU.mChill.gain.setTargetAtTime(target === 'chill' ? MIX.chill : 0, now, tc);
    const P = MUSIC[target]; P.until = Infinity; P.next = 0; P.step = 0; // the new piece starts from the top
  }
  for (const k of ['rock', 'chill']) {
    const P = MUSIC[k];
    if (!(P.until > now)) continue;
    if (!P.next || P.next < now) P.next = now + 0.06;
    while (P.next < now + 0.3) {
      if (k === 'rock') { rockStep(P.step, P.next); P.next += 60 / ROCK_BPM / 2; }
      else { chillStep(P.step, P.next); P.next += chillLen(P.step); }
      P.step++;
    }
  }
}
function audioUpdate(dt, active) {
  if (!AU.ctx) return;
  const now = AU.ctx.currentTime;
  // dispatch mode: hear the unit the camera follows, from a distance
  const disp = G.mode === 'dispatch', u = disp ? dsel : null;
  const sp = active ? (u ? u.v : car.speed) : 0;
  const thr = active && !disp && input.gas ? 1 : 0;
  AU.engine[0].frequency.setTargetAtTime(52 + sp * 2.6 + thr * 14, now, 0.08);
  AU.engine[1].frequency.setTargetAtTime(26 + sp * 1.3 + thr * 7, now, 0.08);
  AU.engFilt.frequency.setTargetAtTime(380 + sp * 22 + thr * 200, now, 0.1);
  AU.engGain.gain.setTargetAtTime(active ? (0.05 + thr * 0.025 + sp * 0.0007) * (disp ? 0.45 : 1) : 0, now, 0.15);
  const sirenOn = active && (G.state === 'play' || G.state === 'intro') && (u ? u.siren : SIREN.t > 0);
  AU.sirenGain.gain.setTargetAtTime(sirenOn ? (disp ? 0.028 : 0.045) : 0, now, 0.08);
  const playing = active || G.state === 'choose' || G.state === 'map' || G.state === 'dchoose' || G.state === 'intro';
  musicUpdate(playing, sirenOn, dt);
  if (sirenOn) {
    AU.sirenPhase += dt;
    const hi = Math.floor(AU.sirenPhase / 0.62) % 2 === 0;
    const f = hi ? 960 : 770;
    AU.siren.frequency.setTargetAtTime(f, now, 0.01);
    AU.sirenSq.frequency.setTargetAtTime(f, now, 0.01);
  }
}
function tone(freq, dur, type = 'square', vol = 0.12, when = 0, slide = 0) {
  if (!AU.ctx || G.muted) return;
  const ctx = AU.ctx, t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(AU.master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noiseHit(dur, vol, f0, f1, type = 'lowpass') {
  if (!AU.ctx || G.muted) return;
  const ctx = AU.ctx, t0 = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = AU.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  s.connect(f); f.connect(g); g.connect(AU.master);
  s.start(t0); s.stop(t0 + dur + 0.05);
}
const sfx = {
  pickup() { tone(660, 0.12, 'square', 0.08); tone(990, 0.18, 'square', 0.08, 0.1); },
  deliver(r) { const n = r === 2 ? [523, 659, 784, 1046, 1318] : [523, 659, 784, 1046]; n.forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.085)); },
  wrong() { tone(220, 0.22, 'square', 0.09); tone(180, 0.3, 'square', 0.09, 0.16); },
  coin() { tone(1320, 0.07, 'square', 0.06); tone(1760, 0.12, 'square', 0.06, 0.06); },
  crash(k) { noiseHit(0.28, Math.min(0.5, 0.12 + k * 0.015), 1400, 120); tone(90, 0.2, 'sine', 0.2, 0, 0.5); },
  bump() { noiseHit(0.12, 0.18, 900, 200); },
  splash() { noiseHit(0.7, 0.35, 3000, 300, 'bandpass'); tone(300, 0.4, 'sine', 0.12, 0, 0.3); },
  land(k) { noiseHit(0.16, Math.min(0.35, 0.08 + k * 0.012), 600, 90); },
  beep(hi) { tone(hi ? 1175 : 784, hi ? 0.4 : 0.14, 'square', 0.08); },
  tick() { tone(1500, 0.05, 'square', 0.045); },
  over() { [784, 659, 523, 392].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.16)); },
  pop() { tone(520, 0.08, 'sine', 0.1, 0, 2); },
  call() { noiseHit(0.14, 0.09, 2600, 1500, 'bandpass'); [0.12, 0.34].forEach((w) => { tone(880, 0.12, 'square', 0.05, w); tone(1175, 0.12, 'square', 0.05, w + 0.1); }); },
  panel() { tone(700, 0.08, 'sine', 0.08, 0, 1.4); },
  choose() { tone(784, 0.1, 'triangle', 0.1); tone(1046, 0.16, 'triangle', 0.1, 0.08); },
  sad() { [440, 415, 349, 262].forEach((f, i) => tone(f, 0.42, 'triangle', 0.1, i * 0.24)); },
  reject() { tone(330, 0.18, 'square', 0.08); tone(262, 0.34, 'square', 0.08, 0.16); },
  medal() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i === 3 ? 0.4 : 0.14, 'triangle', 0.11, i * 0.075)); tone(2093, 0.3, 'sine', 0.05, 0.3); },
};
// Taiwan's garbage trucks announce themselves with Beethoven's "Für Elise" (the opening, as a tinny music box)
const ELISE = [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 2], [0, 1], [60, 1], [64, 1], [69, 1], [71, 2], [0, 1], [64, 1], [68, 1], [71, 1],
  [72, 2], [0, 1], [64, 1], [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 2], [0, 1], [60, 1], [64, 1], [69, 1], [71, 2], [0, 1], [64, 1], [72, 1], [71, 1], [69, 4], [0, 6]];
const ELISE_T = { next: 0, i: 0, vol: 0 };
function eliseUpdate(vol) {
  if (!AU.ctx || G.muted || AU.ctx.state !== 'running') { ELISE_T.next = 0; ELISE_T.vol = 0; return; }
  ELISE_T.vol = vol;
  const now = AU.ctx.currentTime;
  if (vol < 0.004) { ELISE_T.next = 0; return; }
  if (!ELISE_T.next || ELISE_T.next < now) ELISE_T.next = now + 0.05;
  const s16 = 0.15;
  while (ELISE_T.next < now + 0.25) {
    const [m, l] = ELISE[ELISE_T.i % ELISE.length];
    if (m) {
      const t = ELISE_T.next;
      for (const [type, mul, v] of [['triangle', 1, 1], ['square', 2, 0.18]]) {
        const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
        o.type = type; o.frequency.value = mf(m) * mul;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0004, t + s16 * l * 1.6 + 0.12);
        o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + s16 * l * 1.6 + 0.2);
      }
    }
    ELISE_T.next += s16 * l; ELISE_T.i++;
  }
}

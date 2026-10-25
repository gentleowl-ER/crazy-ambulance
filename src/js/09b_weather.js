// ===================== weather and night shifts =====================
// Each shift has its weather: a clear day, rain (wet roads, slower traffic, more crashes), a night shift (street
// lamps, lit windows, headlights; more drunks and heart attacks) or a typhoon night (all of that, a gale that
// shoves the ambulance sideways, and trees down across the streets). Harder shifts score more.
const WEATHERS = {
  day: { name: '晴天', short: '晴', icon: 'sun', rain: 0, night: 0, wind: 0, grip: 1, traffic: 1, bonus: 1, fog: 1,
    desc: '天氣晴朗，視線良好。', bias: null },
  rain: { name: '雨天', short: '雨', icon: 'rain', rain: 1, night: 0, wind: 0, grip: 0.8, traffic: 0.84, bonus: 1.1, fog: 0.8,
    desc: '路面濕滑，轉彎要提早減速；車流變慢，車禍和跌倒的病人變多。', bias: { trauma: 2, scrape: 2.2, headinj: 1.8, hipfx: 1.8, wrist: 1.4 } },
  night: { name: '夜班', short: '夜', icon: 'moon', rain: 0, night: 1, wind: 0, grip: 1, traffic: 0.9, bonus: 1.15, fog: 0.88,
    desc: '天黑了，路燈和車燈亮起，看遠一點才看得清楚；酒醉路倒、心臟病和一氧化碳中毒變多。', bias: { drunk: 3, stemi: 1.6, ohca: 1.5, co: 1.8, chf: 1.5 } },
  typhoon: { name: '颱風夜', short: '颱', icon: 'wind', rain: 1.7, night: 1, wind: 1, grip: 0.72, traffic: 0.72, bonus: 1.3, fog: 0.66,
    desc: '強風豪雨：救護車會被陣風吹偏，路上可能有倒樹擋路；外傷病人很多。', bias: { trauma: 3, headinj: 2.6, scrape: 2.2, hipfx: 1.6 } },
};
const WX_ORDER = ['day', 'rain', 'night', 'typhoon'];
const WX = { id: 'day', cur: WEATHERS.day, fogK: 1, gx: 0, gz: 0, gust: 0, gustT: 4, dir: 0, flash: 0, thunderT: 9, biasMax: 1 };
const WXU = { night: { value: 0 }, wet: { value: 0 } };
const LIGHT_SET = {
  day: { hemi: [0xfff8ec, 0x8f9a70, 0.64], sun: [0xfff0d8, 0.52], hor: 0x9fd3e3, top: 0x4f9fd1, fog: 0x9fd3e3, hills: 0xffffff },
  rain: { hemi: [0xe4ebf0, 0x7d8a78, 0.56], sun: [0xe8eef2, 0.2], hor: 0xa3aeb6, top: 0x75838f, fog: 0xa3aeb6, hills: 0xb9c4cb },
  night: { hemi: [0x8796d0, 0x3a3a48, 0.5], sun: [0xa9bbff, 0.16], hor: 0x2b3a5e, top: 0x0c1433, fog: 0x26324f, hills: 0x45507a },
  typhoon: { hemi: [0x7c8aa8, 0x333844, 0.44], sun: [0x9fb0d0, 0.08], hor: 0x2a3344, top: 0x121826, fog: 0x2a3344, hills: 0x3b4458 },
};
// the shift's weather: the player's pick, or a draw (mostly fine days)
function pickWeather() {
  const p = G.wxPick || 'rand';
  if (WEATHERS[p]) return p;
  const r = Math.random();
  return r < 0.42 ? 'day' : r < 0.67 ? 'rain' : r < 0.9 ? 'night' : 'typhoon';
}
function applyWeather(id) {
  if (!WEATHERS[id]) id = 'day';
  WX.id = id; WX.cur = WEATHERS[id];
  const W = WX.cur;
  WX.fogK = W.fog;
  WX.biasMax = W.bias ? Math.max(...Object.values(W.bias)) : 1;
  WX.gx = WX.gz = WX.gust = 0; WX.flash = 0; WX.dir = rand(0, TAU); WX.gustT = 4;
  if (!scene) return;
  setLights(id);
  rainSound(W.rain);
  updateDrive();
}
// the look of a weather: lights, sky, fog, wet roads, the night's lamps (also used for the daylight hospital photos)
function setLights(id) {
  const W = WEATHERS[id], L = LIGHT_SET[id];
  hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
  sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
  WX.hemiI = L.hemi[2];
  scene.background.setHex(L.hor);
  scene.fog.color.setHex(L.fog);
  if (SKYFX.dome) { SKYFX.dome.material.uniforms.hor.value.setHex(L.hor); SKYFX.dome.material.uniforms.top.value.setHex(L.top); }
  if (SKYFX.hills) SKYFX.hills.material.color.setHex(L.hills);
  WXU.night.value = W.night;
  WXU.wet.value = W.rain ? 1 : 0;
  for (const m of NIGHTFX.meshes) m.visible = W.night > 0;
  if (NIGHTFX.rain) NIGHTFX.rain.visible = W.rain > 0;
  if (car.headlight) car.headlight.visible = W.night > 0;
}
// lit windows at night: about half the windows of every building glow, picked by a hash of their position
function nightWindows() {
  MAT.city.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = WXU.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPosN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPosN = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying vec3 vWPosN;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uNight > 0.0) {
          vec4 wtx = texture2D(map, vUv);
          float glass = step(0.12, wtx.b - wtx.r);
          vec2 cell = floor(vec2(vWPosN.x * 0.29 + vWPosN.z * 0.29, vWPosN.y * 0.31));
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float lit = step(0.45, h);
          totalEmissiveRadiance += uNight * glass * lit * mix(vec3(1.0, 0.8, 0.48), vec3(0.85, 0.92, 1.0), step(0.85, h)) * 0.85;
        }`);
  };
  MAT.city.needsUpdate = true;
}

// ---------- the night's lights: lamp bulbs and their pools of light, headlights, tail lights ----------
const LAMPS = [];        // [x, y, z] of each street lamp head (filled while the street furniture is built)
const NIGHTFX = { meshes: [], rain: null, rainPos: null, tail: null, head: null };
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,236,190,0.95)'); gr.addColorStop(0.35, 'rgba(255,214,140,0.45)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function buildNightFX(scene) {
  nightWindows();
  const tex = glowTexture();
  const add = (geo, mat, items) => { for (const m of addInstanced(scene, geo, mat, items, { cast: false, receive: false })) { m.visible = false; m.renderOrder = 2; NIGHTFX.meshes.push(m); } };
  // pools of lamplight on the road
  const pool = new THREE.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
  pool.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pool.attributes.position.count * 3).fill(1), 3));
  const poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, polygonOffset: true, polygonOffsetFactor: -4 });
  add(pool, poolMat, LAMPS.map(([x, y, z]) => ({ x, y: Math.max(0.09, bridgeY(x, z) + 0.12), z, s: 13, color: 0xc89a5a })));
  // the bulbs themselves, bright in the dark
  const bulb = new THREE.SphereGeometry(0.55, 8, 6);
  add(bulb, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), LAMPS.map(([x, y, z]) => ({ x, y: y - 0.25, z, color: 0xffe2a0 })));
  // car lights: one instanced quad set for every car's headlamps and one for the tail lamps (moved every frame)
  const n = Math.max(1, traffic.length);
  const lamp = new THREE.PlaneGeometry(1.5, 0.45);
  NIGHTFX.head = new THREE.InstancedMesh(lamp, new THREE.MeshBasicMaterial({ color: 0xfff6d8, side: THREE.DoubleSide, fog: true }), n);
  NIGHTFX.tail = new THREE.InstancedMesh(lamp, new THREE.MeshBasicMaterial({ color: 0xff3424, side: THREE.DoubleSide, fog: true }), n);
  for (const m of [NIGHTFX.head, NIGHTFX.tail]) { m.frustumCulled = false; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); NIGHTFX.meshes.push(m); }
  // car headlight pools on the road ahead of each car (and a long one for the ambulance)
  const hp = new THREE.PlaneGeometry(1, 1); hp.rotateX(-Math.PI / 2);
  NIGHTFX.hpool = new THREE.InstancedMesh(hp, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9a8a6a, fog: true }), n);
  NIGHTFX.hpool.frustumCulled = false; NIGHTFX.hpool.visible = false; NIGHTFX.hpool.instanceMatrix.setUsage(THREE.DynamicDrawUsage); NIGHTFX.hpool.renderOrder = 2;
  scene.add(NIGHTFX.hpool); NIGHTFX.meshes.push(NIGHTFX.hpool);
  const beam = new THREE.Mesh(hp, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xd8c89a, fog: true }));
  beam.scale.set(9, 1, 17); beam.position.set(0, 0.14, 10.5); beam.renderOrder = 2; beam.visible = false;
  car.group.add(beam);
  car.headlight = beam;
  // rain: streaks round the camera, one draw call
  const NR = 1100, pos = new Float32Array(NR * 6);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  NIGHTFX.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xd6e4f0, transparent: true, opacity: 0.55, fog: true }));
  NIGHTFX.rain.frustumCulled = false; NIGHTFX.rain.visible = false; NIGHTFX.rain.renderOrder = 3;
  NIGHTFX.rainPos = pos; NIGHTFX.drops = [];
  for (let i = 0; i < NR; i++) NIGHTFX.drops.push({ x: rand(-70, 70), y: rand(0, 60), z: rand(-70, 70), v: rand(38, 50) });
  scene.add(NIGHTFX.rain);
}
const _wq = new THREE.Quaternion(), _wv = new THREE.Vector3(), _ws = new THREE.Vector3(1, 1, 1), _we = new THREE.Euler();
function weatherRender(dt, cam) {
  const W = WX.cur;
  if (W.night && NIGHTFX.head) {
    let k = 0;
    for (const v of traffic) {
      const fx = Math.sin(v.h), fz = Math.cos(v.h), L = v.len + 0.15, y = v.y + (v.scoot ? 0.9 : 0.75);
      const vis = Math.abs(v.x - cam.position.x) < 260 && Math.abs(v.z - cam.position.z) < 260;
      const sc = vis ? (v.scoot ? 0.45 : 1) : 0;
      _ws.set(sc, sc, sc);
      _wq.setFromEuler(_we.set(0, v.h, 0));
      _m4.compose(_wv.set(v.x + fx * L, y, v.z + fz * L), _wq, _ws); NIGHTFX.head.setMatrixAt(k, _m4);
      _m4.compose(_wv.set(v.x - fx * L, y, v.z - fz * L), _wq, _ws); NIGHTFX.tail.setMatrixAt(k, _m4);
      _ws.set(sc * 5.5, 1, sc * 8);
      _m4.compose(_wv.set(v.x + fx * (L + 4.5), v.y + 0.12, v.z + fz * (L + 4.5)), _wq, _ws); NIGHTFX.hpool.setMatrixAt(k, _m4);
      k++;
    }
    NIGHTFX.head.instanceMatrix.needsUpdate = NIGHTFX.tail.instanceMatrix.needsUpdate = NIGHTFX.hpool.instanceMatrix.needsUpdate = true;
  }
  if (W.rain && NIGHTFX.rain) {
    const P = NIGHTFX.rainPos, cx = cam.position.x, cz = cam.position.z, cy = cam.position.y;
    const top = cy + 12, bot = Math.max(-0.5, cy - 70);
    const sx = WX.gx * 0.05 + 0.08, sz = WX.gz * 0.05 + 0.04, len = 2.4;
    const n = Math.round(NIGHTFX.drops.length * Math.min(1, 0.55 + W.rain * 0.3));
    for (let i = 0; i < NIGHTFX.drops.length; i++) {
      const d = NIGHTFX.drops[i], o = i * 6;
      if (i >= n) { P[o] = P[o + 3] = cx; P[o + 1] = P[o + 4] = -50; P[o + 2] = P[o + 5] = cz; continue; }
      d.y -= d.v * dt;
      d.x += WX.gx * dt * 0.6; d.z += WX.gz * dt * 0.6;
      if (d.y < bot - cy || d.y > top - cy) d.y = top - cy - Math.random() * 6;
      // keep each drop in a box round the camera
      if (d.x < -70) d.x += 140; else if (d.x > 70) d.x -= 140;
      if (d.z < -70) d.z += 140; else if (d.z > 70) d.z -= 140;
      const x = cx + d.x, y = cy + d.y, z = cz + d.z;
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      P[o + 3] = x - sx * len * 4; P[o + 4] = y + len; P[o + 5] = z - sz * len * 4;
    }
    NIGHTFX.rain.geometry.attributes.position.needsUpdate = true;
  }
  // lightning on a typhoon night: a flash over the whole sky, the thunder a moment later
  if (WX.id === 'typhoon') {
    WX.thunderT -= dt;
    if (WX.thunderT <= 0) { WX.thunderT = grand(9, 20); WX.flash = 0.22; setTimeout(() => thunder(), 500 + Math.random() * 900); }
    if (WX.flash > 0) { WX.flash -= dt; hemi.intensity = WX.hemiI + (WX.flash > 0 ? 1.1 * (WX.flash / 0.22) : 0); }
  }
}
// the gale: gusts that come and go, from roughly one direction
function weatherStep(dt) {
  if (!WX.cur.wind) return;
  WX.gustT -= dt;
  if (WX.gustT <= 0) { WX.gustT = grand(2.5, 6); WX.gust = Math.random() < 0.55 ? grand(0.6, 1) : grand(0, 0.3); WX.dir += grand(-0.5, 0.5); }
  const s = WX.gust * 11;
  WX.gx = damp(WX.gx, Math.sin(WX.dir) * s, 1.2, dt);
  WX.gz = damp(WX.gz, Math.cos(WX.dir) * s, 1.2, dt);
}
// a case for this weather: the usual pick, weighted toward what the weather brings
function weatherPick(list) {
  const B = WX.cur.bias;
  return B ? gwpick(list, (c) => B[c.id] || 1) : gpick(list);
}

// ---------- sound: rain on the roof, thunder ----------
function rainSound(level) {
  if (!AU.ctx) { WX.rainLevel = level; return; }
  const ctx = AU.ctx;
  if (!AU.rain) {
    const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(AU.master); s.start();
    AU.rain = g;
  }
  AU.rain.gain.setTargetAtTime(level ? 0.05 + 0.03 * level : 0, ctx.currentTime, 0.6);
}
function thunder() {
  if (G.state === 'title' || !AU.ctx) return;
  noiseHit(2.2, 0.32, 380, 60);
  tone(48, 1.6, 'sine', 0.16, 0.05, 0.6);
}
// a new shift: draw its weather, and tell the crew
function beginShiftWeather() {
  applyWeather(pickWeather());
  const W = WX.cur;
  if (WX.id === 'day') return;
  setTimeout(() => {
    if (G.state !== 'play' && G.state !== 'countdown') return;
    bubble('中央氣象署', `<b>${W.name}</b>：${W.desc}${W.bonus > 1 ? `（得分 ×${W.bonus}）` : ''}`, WX.id === 'rain' ? '#4f7fa8' : '#3b4a7a', 7, W.icon);
  }, G.mode === 'mission' ? 4200 : 2800);
}

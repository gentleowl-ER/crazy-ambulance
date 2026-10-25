// ===================== markers, sprites, particles, guidance arrow =====================
function makeRing(scene, hex, r, w) {
  const g = new THREE.RingGeometry(r - w, r, 48, 1);
  g.rotateX(-Math.PI / 2);
  const inner = new THREE.CircleGeometry(r - w, 48); inner.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  const fill = new THREE.Mesh(inner, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.add(fill);
  m.renderOrder = 4;
  scene.add(m);
  return m;
}
const beamVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const beamFS = 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * uOpacity; gl_FragColor = vec4(uColor, a); }';
function makeBeam(scene, hex, r, h, op) {
  const g = new THREE.CylinderGeometry(r, r, h, 20, 1, true);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(hex) }, uOpacity: { value: op } },
    vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.renderOrder = 5;
  scene.add(m);
  return m;
}
function makeIconSprite(icon, css) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(60,38,20,0.28)'; g.beginPath(); g.arc(64, 70, 54, 0, TAU); g.fill();
  g.fillStyle = '#f8f1de'; g.beginPath(); g.arc(64, 62, 54, 0, TAU); g.fill();
  g.lineWidth = 8; g.strokeStyle = css; g.beginPath(); g.arc(64, 62, 49, 0, TAU); g.stroke();
  drawIcon(g, icon, 64, 62, 58, css);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.renderOrder = 6;
  return s;
}
function makeLabelSprite(H) {
  const w = 512, h = 160;
  const lv = LEVELS[H.level];
  const tex = textTexture(w, h, (g) => {
    g.font = `50px ${FONT_CJK}`;
    const tw = Math.max(g.measureText(H.name).width, 150);
    const bw = Math.min(w - 8, tw + 126), bx = (w - bw) / 2;
    g.fillStyle = 'rgba(60,38,20,0.3)';
    roundRect(g, bx, 24, bw, 118, 28); g.fill();
    g.fillStyle = '#f8f1de';
    roundRect(g, bx, 14, bw, 118, 28); g.fill();
    g.lineWidth = 6; g.strokeStyle = H.css; roundRect(g, bx, 14, bw, 118, 28); g.stroke();
    g.fillStyle = H.css; g.beginPath(); g.arc(bx + 56, 73, 36, 0, TAU); g.fill();
    drawIcon(g, 'cross', bx + 56, 73, 42, '#ffffff');
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#4b3424'; g.fillText(H.name, bx + 104, 56);
    g.font = `32px ${FONT_CJK}`; g.fillStyle = lv.color;
    g.fillText(lv.full, bx + 106, 103);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(19, 5.94, 1);
  s.renderOrder = 6;
  return s;
}
// round timer above a waiting patient: the coloured wedge shrinks as time runs out
function makeTimerSprite(css, icon = 'cross') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
  s.renderOrder = 7;
  s.scale.set(3.8, 3.8, 1);
  s.userData.draw = (frac) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(60,38,20,0.28)'; g.beginPath(); g.arc(64, 69, 56, 0, TAU); g.fill();
    g.fillStyle = '#f8f1de'; g.beginPath(); g.arc(64, 62, 56, 0, TAU); g.fill();
    g.fillStyle = 'rgba(141,108,77,0.28)'; g.beginPath(); g.arc(64, 62, 51, 0, TAU); g.fill();
    if (frac > 0) { g.fillStyle = css; g.beginPath(); g.moveTo(64, 62); g.arc(64, 62, 51, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.closePath(); g.fill(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 62, 35, 0, TAU); g.fill();
    drawIcon(g, icon, 64, 62, icon === 'cross' ? 42 : 40, frac < 0.25 ? '#c0322b' : css);
    tex.needsUpdate = true;
  };
  return s;
}
// floating names over landmarks
const landmarkLabels = [];
function buildLandmarkLabels(scene) {
  for (const [name, x, z, hgt] of LANDMARK_LABELS) {
    const tex = textTexture(512, 112, (g, W, Hh) => {
      g.font = `46px ${FONT_CJK}`;
      const tw = g.measureText(name).width;
      const bw = Math.min(W - 6, tw + 54), bx = (W - bw) / 2;
      g.fillStyle = 'rgba(60,38,20,0.28)'; roundRect(g, bx, 18, bw, 80, 40); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(g, bx, 10, bw, 80, 40); g.fill();
      g.lineWidth = 4; g.strokeStyle = '#8d6c4d'; roundRect(g, bx, 10, bw, 80, 40); g.stroke();
      g.fillStyle = '#4b3424'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, W / 2, 53);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(16, 3.5, 1);
    s.position.set(x, baseHeight(x, z) + hgt + 4, z);
    s.renderOrder = 6;
    scene.add(s);
    landmarkLabels.push(s);
  }
}
function landmarkLabelsRender(fx, fz) {
  for (const s of landmarkLabels) {
    const d = hypot(s.position.x - fx, s.position.z - fz);
    const a = 1 - smoothstep(230, 330, d);
    s.visible = a > 0.02;
    s.material.opacity = a;
  }
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

// ---------- sky: a gradient dome and a ring of distant mountains, both following the camera ----------
const SKYFX = { dome: null, hills: null };
function buildSky(scene) {
  const hor = new THREE.Color(SKY), top = new THREE.Color(0x4f9fd1);
  SKYFX.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({
    uniforms: { top: { value: top }, hor: { value: hor } },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main() { float t = clamp(normalize(vP).y * 1.7, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(t, 0.75)), 1.0); }',
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  }));
  SKYFX.dome.renderOrder = -10; SKYFX.dome.frustumCulled = false;
  scene.add(SKYFX.dome);
  // the basin's rim: tallest to the north (Yangmingshan), lower hills east and south, low tableland west
  const N = 160, pos = [], col = [], idx = [];
  const far = new THREE.Color(0x7fa7a4).lerp(hor, 0.35), near = new THREE.Color(0x5f8f7c).lerp(hor, 0.2);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU, cx = Math.cos(a), cz = Math.sin(a);
    const north = Math.max(0, -cz) ** 1.6, east = Math.max(0, cx) ** 2, south = Math.max(0, cz) ** 2;
    const jag = 0.75 + 0.14 * Math.sin(a * 7 + 1.3) + 0.08 * Math.sin(a * 17 + 0.4) + 0.05 * Math.sin(a * 31 + 2.2);
    const h = (0.035 + 0.09 * north + 0.04 * east + 0.035 * south) * jag;
    pos.push(cx, -0.02, cz, cx, h, cz);
    col.push(far.r, far.g, far.b, near.r, near.g, near.b);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  SKYFX.hills = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  SKYFX.hills.renderOrder = -9; SKYFX.hills.frustumCulled = false;
  scene.add(SKYFX.hills);
}
function skyRender(cam) {
  if (!SKYFX.dome) return;
  const r = cam.far * 0.92;
  SKYFX.dome.position.copy(cam.position); SKYFX.dome.scale.setScalar(r);
  SKYFX.hills.position.set(cam.position.x, 0, cam.position.z); SKYFX.hills.scale.setScalar(r);
}

// ---------- particles ----------
const FX = { puffs: null, puffData: [], conf: null, confData: [], skid: null, skidI: 0, arrow: null, arrowMat: null, hud: null, hudMat: null, ovl: null, exclaim: null };
function buildFX(scene) {
  const N = 260;
  FX.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex }), N);
  FX.puffs.frustumCulled = false;
  FX.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < N; i++) { FX.puffData.push({ life: 0 }); FX.puffs.setMatrixAt(i, _m4.makeScale(0, 0, 0)); FX.puffs.setColorAt(i, _col.set(0xffffff)); }
  scene.add(FX.puffs);
  const NC = 160;
  FX.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 0.32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), NC);
  FX.conf.frustumCulled = false;
  FX.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < NC; i++) { FX.confData.push({ life: 0 }); FX.conf.setMatrixAt(i, _m4.makeScale(0, 0, 0)); FX.conf.setColorAt(i, _col.set(0xffffff)); }
  scene.add(FX.conf);
  const NS = 420;
  const sg = new THREE.PlaneGeometry(0.42, 0.9); sg.rotateX(-Math.PI / 2);
  FX.skid = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x4a3f36, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), NS);
  FX.skid.frustumCulled = false;
  for (let i = 0; i < NS; i++) FX.skid.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  FX.skid.renderOrder = 1;
  scene.add(FX.skid);
  // guidance arrow
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.9); sh.lineTo(1.35, 0.25); sh.lineTo(0.55, 0.25); sh.lineTo(0.55, -1.5); sh.lineTo(-0.55, -1.5); sh.lineTo(-0.55, 0.25); sh.lineTo(-1.35, 0.25); sh.closePath();
  const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 2 });
  ag.rotateX(Math.PI / 2);
  ag.translate(0, 0.3, 0);
  // outer group: placement and tilt; inner "spin" group: the direction it points
  const mkArrow = (mat) => {
    const g = new THREE.Group(), spin = new THREE.Group();
    const am = new THREE.Mesh(ag, mat);
    const ol = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0x2a211c, side: THREE.BackSide }));
    ol.scale.setScalar(1.09);
    am.renderOrder = 3; ol.renderOrder = 3; // after the ambulance x-ray pass
    spin.add(am, ol); g.add(spin);
    g.rotation.order = 'YXZ'; // yaw first, then the tilt toward the camera
    g.userData.spin = spin;
    g.visible = false;
    return g;
  };
  // overhead view: the arrow floats over the ambulance's roof
  FX.arrowMat = new THREE.MeshToonMaterial({ color: 0xf8f1de, gradientMap: gradTex });
  FX.arrow = mkArrow(FX.arrowMat);
  FX.arrow.scale.setScalar(1.25);
  scene.add(FX.arrow);
  // chase views: the same arrow pinned under the mission banner like Crazy Taxi's, drawn in its own pass so
  // nothing in the street can cut through it (own scene, lights and material, so no shader is ever swapped)
  FX.hudMat = new THREE.MeshToonMaterial({ color: 0xf8f1de, gradientMap: gradTex, fog: false });
  FX.hud = mkArrow(FX.hudMat);
  FX.ovl = new THREE.Scene();
  const osun = new THREE.DirectionalLight(0xfff0d8, 0.52);
  osun.position.set(-70, 120, 55);
  FX.ovl.add(new THREE.HemisphereLight(0xfff8ec, 0x8f9a70, 0.64), osun, FX.hud);
  FX.on = false; FX.yaw = 0; FX.hudTop = 0; FX.hudN = 0;
  // "!" exclamation sprite for dodging villagers
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fill();
  g.lineWidth = 4; g.strokeStyle = '#4b3424'; g.stroke();
  g.fillStyle = '#e23b33'; g.font = '700 44px Fredoka, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 34);
  FX.exclaimTex = new THREE.CanvasTexture(c);
}
function puff(x, y, z, vx, vy, vz, size, life, color, grav = -1.5, grow = 1.8) {
  const d = FX.puffData;
  for (let i = 0; i < d.length; i++) {
    const p = d[(FX.pi = ((FX.pi || 0) + 1) % d.length)];
    if (p.life > 0 && i < d.length - 1) continue;
    Object.assign(p, { x, y, z, vx, vy, vz, s0: size, life, max: life, grav, grow, rot: Math.random() * 6 });
    FX.puffs.setColorAt(FX.pi, _col.set(color));
    FX.puffs.instanceColor.needsUpdate = true;
    return;
  }
}
function confetti(x, y, z, cols, n) {
  const d = FX.confData;
  for (let k = 0; k < n; k++) {
    FX.ci = ((FX.ci || 0) + 1) % d.length;
    const p = d[FX.ci];
    const a = Math.random() * TAU, sp = grand(4, 11);
    Object.assign(p, { x, y, z, vx: Math.cos(a) * sp, vy: grand(9, 17), vz: Math.sin(a) * sp, life: grand(1.6, 2.4), rx: grand(0, 6), ry: grand(0, 6), wx: grand(-12, 12), wy: grand(-12, 12) });
    FX.conf.setColorAt(FX.ci, _col.set(gpick(cols)));
  }
  FX.conf.instanceColor.needsUpdate = true;
}
function skidMark(x, z, h) {
  FX.skidI = (FX.skidI + 1) % 420;
  _m4.compose(_v.set(x, groundHeight(x, z) + 0.06, z), _q.setFromEuler(_e.set(0, h, 0)), _s.set(1, 1, 1));
  FX.skid.setMatrixAt(FX.skidI, _m4);
  FX.skid.instanceMatrix.needsUpdate = true;
}
function fxStep(dt) {
  let any = false;
  FX.puffData.forEach((p, i) => {
    if (p.life <= 0) return;
    p.life -= dt;
    if (p.life <= 0) { FX.puffs.setMatrixAt(i, _m4.makeScale(0, 0, 0)); any = true; return; }
    p.vy += p.grav * dt;
    p.vx *= 1 - 2.2 * dt; p.vz *= 1 - 2.2 * dt; p.vy *= 1 - 1.2 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = 1 - p.life / p.max;
    const s = p.s0 * (1 + t * p.grow) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
    _m4.compose(_v.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rot, p.rot * 0.7, 0)), _s.set(s, s, s));
    FX.puffs.setMatrixAt(i, _m4);
    any = true;
  });
  if (any) FX.puffs.instanceMatrix.needsUpdate = true;
  let anyC = false;
  FX.confData.forEach((p, i) => {
    if (p.life <= 0) return;
    p.life -= dt;
    anyC = true;
    if (p.life <= 0) { FX.conf.setMatrixAt(i, _m4.makeScale(0, 0, 0)); return; }
    p.vy -= 18 * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; p.vy = Math.max(p.vy, -5);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.rx += p.wx * dt; p.ry += p.wy * dt;
    _m4.compose(_v.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rx, p.ry, 0)), _s.set(1, 1, 1));
    FX.conf.setMatrixAt(i, _m4);
  });
  if (anyC) FX.conf.instanceMatrix.needsUpdate = true;
}

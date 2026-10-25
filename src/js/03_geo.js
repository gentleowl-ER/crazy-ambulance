// ===================== materials, geometry builders, colliders =====================
const MAT = {};
let gradTex = null;
function makeOutlineMat(color, width) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aOut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aOut * ' + width.toFixed(3) + ';');
  };
  m.customProgramCacheKey = () => 'outline' + width.toFixed(3);
  return m;
}
// Chase views: street furniture hanging over the lanes (signal arms and heads, lamp arms) vanishes once it is
// nearer the camera than the ambulance's nose, so a signal never sweeps across the junction you are driving into.
// CUT.value is that depth in view space (0 = off: overhead and title cameras). Each piece is tested at its own
// pivot (attribute aPiv, world space), so a head goes as a whole instead of being sliced by a plane.
const CUT = { value: 0 };
function addCut(m, key) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = CUT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPiv;\nvarying float vCutZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutZ = -(viewMatrix * vec4(aPiv, 1.0)).z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCut;\nvarying float vCutZ;')
      .replace('#include <clipping_planes_fragment>', 'if (vCutZ < uCut) { float k = (uCut - vCutZ) * 3.0; if (k >= 1.0 || k > fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))))) discard; }\n#include <clipping_planes_fragment>');
  };
  m.customProgramCacheKey = () => key;
  return m;
}
const SIGN_H = ['牛肉麵', '珍珠奶茶', '藥局', '診所', '便利商店', '滷肉飯', '眼鏡', '麵包', '豆漿', '水餃', '書局', '咖啡', '鞋店', '電信', '早餐', '火鍋'];
const SIGN_V = ['中醫診所', '牙醫', '鐘錶', '銀樓', '旅社', '冰果室', '小吃', '理髮'];
const SIGN_BG = ['#d9473d', '#f2c14e', '#3a7fd5', '#2f9e6b', '#f08a3c', '#ffffff', '#8b6fd6', '#1fa3a0'];
function makeCityTextures() {
  // window grid (one floor x one bay per repeat; bottom 22% is plain wall)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f1efea'; g.fillRect(0, 100, 128, 28);
  const gr = g.createLinearGradient(0, 15, 0, 92);
  gr.addColorStop(0, '#b9dbea'); gr.addColorStop(1, '#7eaec6');
  g.fillStyle = '#5f6973'; g.fillRect(16, 13, 96, 81);
  g.fillStyle = gr; g.fillRect(20, 17, 88, 73);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.moveTo(30, 90); g.lineTo(52, 17); g.lineTo(64, 17); g.lineTo(42, 90); g.closePath(); g.fill();
  g.fillStyle = '#5f6973'; g.fillRect(62, 17, 4, 73);
  g.fillStyle = '#d9d6cf'; g.fillRect(12, 92, 104, 6);
  const win = new THREE.CanvasTexture(c);
  win.wrapS = win.wrapT = THREE.RepeatWrapping;
  win.anisotropy = 4;
  // signboard atlas: top half 4x4 horizontal signs, bottom half 8 vertical signs
  const sign = textTexture(512, 512, (s) => {
    s.textAlign = 'center'; s.textBaseline = 'middle';
    SIGN_H.forEach((t, k) => {
      const x = (k % 4) * 128, y = Math.floor(k / 4) * 64;
      const bg = SIGN_BG[k % SIGN_BG.length];
      s.fillStyle = bg; s.fillRect(x + 2, y + 2, 124, 60);
      s.strokeStyle = 'rgba(0,0,0,0.25)'; s.lineWidth = 3; s.strokeRect(x + 3.5, y + 3.5, 121, 57);
      s.fillStyle = bg === '#ffffff' ? '#d9473d' : bg === '#f2c14e' ? '#3b2a1e' : '#ffffff';
      s.font = `${t.length > 3 ? 26 : 34}px ${FONT_CJK}`;
      s.fillText(t, x + 64, y + 34);
    });
    SIGN_V.forEach((t, k) => {
      const x = k * 64, y = 256;
      const bg = SIGN_BG[(k + 3) % SIGN_BG.length];
      s.fillStyle = bg; s.fillRect(x + 3, y + 3, 58, 250);
      s.strokeStyle = 'rgba(0,0,0,0.25)'; s.lineWidth = 3; s.strokeRect(x + 4.5, y + 4.5, 55, 247);
      s.fillStyle = bg === '#ffffff' ? '#d9473d' : bg === '#f2c14e' ? '#3b2a1e' : '#ffffff';
      const n = t.length, fs = Math.min(44, 230 / n - 6);
      s.font = `${fs}px ${FONT_CJK}`;
      for (let i = 0; i < n; i++) s.fillText(t[i], x + 32, y + 128 + (i - (n - 1) / 2) * (fs + 8));
    });
  });
  return { win, sign };
}
function initMaterials() {
  const d = new Uint8Array([108, 108, 108, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  gradTex = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
  gradTex.generateMipmaps = false;
  gradTex.needsUpdate = true;
  const tx = makeCityTextures();
  MAT.toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex });
  MAT.double = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, side: THREE.DoubleSide });
  MAT.city = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, map: tx.win });
  MAT.sign = new THREE.MeshBasicMaterial({ vertexColors: true, map: tx.sign, side: THREE.DoubleSide });
  MAT.decal = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.sig = addCut(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex }), 'sigcut');
  MAT.olTree = makeOutlineMat(0x24411f, 0.11);
  MAT.olRock = makeOutlineMat(0x4b525d, 0.08);
  MAT.olInk = makeOutlineMat(0x2a211c, 0.07);
  MAT.olWood = makeOutlineMat(0x3a2618, 0.06);
}

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4(), _col = new THREE.Color();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function cylBetween(ax, ay, az, bx, by, bz, r0, r1, seg = 8) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 1);
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const len = dir.length(); dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(1, len, 1));
  return [g, m];
}
// box whose side faces repeat the window texture once per bay/floor; top & bottom use plain wall
function windowBox(w, h, d, bay = 3.4, floor = 3.2, v0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i);
    if (Math.abs(ny) > 0.5) U.setXY(i, 0.02, 0.02);
    else if (Math.abs(nx) > 0.5) U.setXY(i, (z + d / 2) / bay, (y + h / 2) / floor + v0);
    else U.setXY(i, (x + w / 2) / bay, (y + h / 2) / floor + v0);
  }
  return g;
}
// quad mapped to a cell of the signboard atlas
function signQuad(w, h, kind, k) {
  const g = new THREE.PlaneGeometry(w, h);
  const U = g.attributes.uv;
  let u0, u1, va, vb;
  if (kind === 'h') { const col = k % 4, row = Math.floor(k / 4); u0 = col / 4; u1 = (col + 1) / 4; vb = 1 - (row * 64) / 512; va = 1 - (row * 64 + 64) / 512; }
  else { u0 = k / 8; u1 = (k + 1) / 8; va = 0; vb = 0.5; }
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) < 0.5 ? u0 : u1, U.getY(i) < 0.5 ? va : vb);
  return g;
}

// Merges coloured parts into one geometry with vertex colours, uvs and outline directions
const _gbN = new THREE.Matrix3(), _gbC = new THREE.Color();
// a growable float buffer (much cheaper than pushing into plain arrays when a city is millions of vertices)
class FBuf {
  constructor(cap = 768) { this.a = new Float32Array(cap); this.n = 0; }
  room(k) { if (this.n + k > this.a.length) { let c = this.a.length * 2; while (c < this.n + k) c *= 2; const b = new Float32Array(c); b.set(this.a.subarray(0, this.n)); this.a = b; } }
  get length() { return this.n; }
  view() { return this.a.subarray(0, this.n); }
}
class GB {
  constructor(noOut, piv) { this.p = new FBuf(); this.n = new FBuf(); this.c = new FBuf(); this.o = new FBuf(); this.u = new FBuf(); this.v = new FBuf(); this.noOut = !!noOut; this.piv = !!piv; }
  add(geo, color, m, opt = {}) {
    if (opt.flat) {
      // flat shading needs the faces split first
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (m) g.applyMatrix4(m);
      g.computeVertexNormals();
      this.addGeo(g, color, null, opt);
      g.dispose();
      return this;
    }
    return this.addGeo(geo, color, m, opt);
  }
  // transform the vertices once, then walk the index (or the plain triangle list)
  addGeo(geo, color, m, opt) {
    const pa = geo.attributes.position.array, na = geo.attributes.normal.array, nv = pa.length / 3;
    const ia = geo.index ? geo.index.array : null, nt = ia ? ia.length : nv;
    const TP = m ? new Float32Array(nv * 3) : pa, TN = m ? new Float32Array(nv * 3) : na;
    let x0 = Infinity, yb0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    if (m) {
      const e = m.elements;
      _gbN.getNormalMatrix(m);
      const q = _gbN.elements;
      for (let k = 0; k < nv; k++) {
        const k3 = k * 3, x = pa[k3], y = pa[k3 + 1], z = pa[k3 + 2];
        TP[k3] = e[0] * x + e[4] * y + e[8] * z + e[12]; TP[k3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; TP[k3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const a = na[k3], b = na[k3 + 1], c = na[k3 + 2];
        let nx = q[0] * a + q[3] * b + q[6] * c, ny = q[1] * a + q[4] * b + q[7] * c, nz = q[2] * a + q[5] * b + q[8] * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        TN[k3] = nx / l; TN[k3 + 1] = ny / l; TN[k3 + 2] = nz / l;
      }
    }
    for (let k = 0; k < nv; k++) {
      const X = TP[k * 3], Y = TP[k * 3 + 1], Z = TP[k * 3 + 2];
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < yb0) yb0 = Y; if (Y > y1) y1 = Y; if (Z < z0) z0 = Z; if (Z > z1) z1 = Z;
    }
    const cx = opt.center ? opt.center[0] : (x0 + x1) / 2;
    const cy = opt.center ? opt.center[1] : (yb0 + y1) / 2;
    const cz = opt.center ? opt.center[2] : (z0 + z1) / 2;
    const UV = opt.uv && geo.attributes.uv ? geo.attributes.uv.array : null;
    const KC = opt.keep && geo.attributes.color ? geo.attributes.color.array : null; // a prebuilt multi-coloured part
    _gbC.set(color);
    const cr = _gbC.r, cg = _gbC.g, cb = _gbC.b;
    const jit = opt.jitter || 0, grad = opt.grad;
    const y0 = opt.gradY ? opt.gradY[0] : yb0;
    const yr = opt.gradY ? (opt.gradY[1] - opt.gradY[0]) : ((y1 - yb0) || 1);
    const out = !this.noOut, piv = this.piv;
    const P = this.p, N = this.n, C = this.c, O = this.o, U = this.u, V = this.v;
    P.room(nt * 3); N.room(nt * 3); C.room(nt * 3); U.room(nt * 2);
    if (out) O.room(nt * 3);
    if (piv) V.room(nt * 3);
    const pA = P.a, nA = N.a, cA = C.a, uA = U.a, oA = O.a, vA = V.a;
    let pn = P.n, un = U.n;
    const px = opt.piv ? opt.piv[0] : cx, py = opt.piv ? opt.piv[1] : cy, pz = opt.piv ? opt.piv[2] : cz;
    for (let t = 0; t < nt; t += 3) {
      const j = jit ? 1 + (rng() - 0.5) * 2 * jit : 1;
      for (let w = 0; w < 3; w++) {
        const k = ia ? ia[t + w] : t + w, k3 = k * 3;
        const x = TP[k3], y = TP[k3 + 1], z = TP[k3 + 2];
        pA[pn] = x; pA[pn + 1] = y; pA[pn + 2] = z;
        nA[pn] = TN[k3]; nA[pn + 1] = TN[k3 + 1]; nA[pn + 2] = TN[k3 + 2];
        let mul = j;
        if (grad) mul *= lerp(grad[0], grad[1], clamp((y - y0) / yr, 0, 1));
        if (KC) { cA[pn] = KC[k3] * mul; cA[pn + 1] = KC[k3 + 1] * mul; cA[pn + 2] = KC[k3 + 2] * mul; } else { cA[pn] = cr * mul; cA[pn + 1] = cg * mul; cA[pn + 2] = cb * mul; }
        if (out) { const dx = x - cx, dy = y - cy, dz = z - cz, l = Math.hypot(dx, dy, dz) || 1; oA[pn] = dx / l; oA[pn + 1] = dy / l; oA[pn + 2] = dz / l; }
        if (piv) { vA[pn] = px; vA[pn + 1] = py; vA[pn + 2] = pz; }
        if (UV) { uA[un] = UV[k * 2]; uA[un + 1] = UV[k * 2 + 1]; } else { uA[un] = 0.02; uA[un + 1] = 0.02; }
        pn += 3; un += 2;
      }
    }
    P.n = pn; N.n = pn; C.n = pn; U.n = un;
    if (out) O.n = pn;
    if (piv) V.n = pn;
    return this;
  }
  get count() { return this.p.n / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    const fa = (b, k) => new THREE.BufferAttribute(b.a.slice(0, b.n), k);
    g.setAttribute('position', fa(this.p, 3));
    g.setAttribute('normal', fa(this.n, 3));
    g.setAttribute('color', fa(this.c, 3));
    if (this.o.n) g.setAttribute('aOut', fa(this.o, 3));
    if (this.v.n) g.setAttribute('aPiv', fa(this.v, 3));
    g.setAttribute('uv', fa(this.u, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- chunked instancing (keeps frustum culling working) ----------
const CHUNK = 150;
const chunkKey = (x, z) => Math.floor((x - WX0) / CHUNK) + Math.floor((z - WZ0) / CHUNK) * 100;
function addInstanced(scene, geo, mat, items, opt = {}) {
  if (!items.length) return [];
  const groups = new Map();
  for (const it of items) {
    const k = chunkKey(it.x, it.z);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  geo.computeBoundingSphere();
  const gr = geo.boundingSphere.radius + geo.boundingSphere.center.length();
  const out = [];
  for (const list of groups.values()) {
    const g = new THREE.BufferGeometry();
    for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
    if (geo.index) g.setIndex(geo.index); // without it an indexed quad collapses to one back-facing triangle
    let cx = 0, cy = 0, cz = 0;
    for (const it of list) { cx += it.x; cy += it.y || 0; cz += it.z; }
    cx /= list.length; cy /= list.length; cz /= list.length;
    let r = 0;
    for (const it of list) r = Math.max(r, Math.hypot(it.x - cx, (it.y || 0) - cy, it.z - cz) + gr * (it.s || 1) * Math.max(1, it.sy || 1, it.sx || 1, it.sz || 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r + 1);
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((it, i) => {
      const s = it.s || 1;
      _m4.compose(_v.set(it.x, it.y || 0, it.z), _q.setFromEuler(_e.set(it.rx || 0, it.ry || 0, it.rz || 0, it.ord || 'XYZ')), _s.set(s * (it.sx || 1), s * (it.sy || 1), s * (it.sz || 1)));
      im.setMatrixAt(i, _m4);
      // always set a colour: r149 shares one program per material, mixing meshes with/without instanceColor reads black
      im.setColorAt(i, _col.set(it.color !== undefined ? it.color : 0xffffff));
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = true; // r149 InstancedMesh defaults to false; our per-chunk sphere makes culling valid
    im.castShadow = opt.cast !== false;
    im.receiveShadow = opt.receive !== false;
    scene.add(im);
    out.push(im);
    if (opt.outline) {
      const o = new THREE.InstancedMesh(g, opt.outline, list.length);
      o.instanceMatrix = im.instanceMatrix;
      o.frustumCulled = true;
      o.castShadow = false; o.receiveShadow = false;
      scene.add(o);
      im.userData.ol = o;
    }
  }
  return out;
}

// ---------- static batches merged per chunk ----------
const staticGB = new Map();
function addStatic(geo, color, m, opt = {}) {
  const matName = opt.mat || 'toon';
  const x = m ? m.elements[12] : 0, z = m ? m.elements[14] : 0;
  const key = matName + '|' + (opt.outline || '') + '|' + (opt.noShadow ? 'n' : 's') + '|' + chunkKey(x, z);
  let gb = staticGB.get(key);
  if (!gb) { gb = new GB(!opt.outline, matName === 'sig' || matName === 'plateCut'); gb.mat = matName; gb.outline = opt.outline; gb.noShadow = opt.noShadow; staticGB.set(key, gb); }
  gb.add(geo, color, m, opt);
}
function flushStatic(scene) {
  for (const gb of staticGB.values()) {
    if (!gb.count) continue;
    const g = gb.build();
    const mesh = new THREE.Mesh(g, MAT[gb.mat]);
    mesh.castShadow = !gb.noShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (gb.outline) scene.add(new THREE.Mesh(g, MAT[gb.outline]));
  }
  staticGB.clear();
}

// ---------- colliders + spatial hash ----------
// t:0 circle {x,z,r}; t:1 box {x,z,hw,hd,c,s}; t:2 capsule {ax,az,bx,bz,r}
const colliders = [];
const CGRID = 16;
const cgrid = new Map();
let cstamp = 1;
function addCollider(c) {
  let x0, z0, x1, z1;
  if (c.t === 0) { x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r; }
  else if (c.t === 1) {
    const ex = Math.abs(c.c) * c.hw + Math.abs(c.s) * c.hd, ez = Math.abs(c.s) * c.hw + Math.abs(c.c) * c.hd;
    x0 = c.x - ex; x1 = c.x + ex; z0 = c.z - ez; z1 = c.z + ez;
  } else { x0 = Math.min(c.ax, c.bx) - c.r; x1 = Math.max(c.ax, c.bx) + c.r; z0 = Math.min(c.az, c.bz) - c.r; z1 = Math.max(c.az, c.bz) + c.r; }
  c.stamp = 0;
  colliders.push(c);
  for (let i = Math.floor((x0 + 700) / CGRID); i <= Math.floor((x1 + 700) / CGRID); i++)
    for (let j = Math.floor((z0 + 700) / CGRID); j <= Math.floor((z1 + 700) / CGRID); j++) {
      const k = i * 1000 + j;
      let l = cgrid.get(k);
      if (!l) { l = []; cgrid.set(k, l); }
      l.push(c);
    }
  return c;
}
const boxCollider = (x, z, w, d, rot, extra) => addCollider(Object.assign({ t: 1, x, z, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot) }, extra || {}));
function queryColliders(x, z, r, out) {
  out.length = 0;
  cstamp++;
  const i0 = Math.floor((x - r + 700) / CGRID), i1 = Math.floor((x + r + 700) / CGRID);
  const j0 = Math.floor((z - r + 700) / CGRID), j1 = Math.floor((z + r + 700) / CGRID);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const l = cgrid.get(i * 1000 + j);
    if (!l) continue;
    for (const c of l) if (c.stamp !== cstamp) { c.stamp = cstamp; out.push(c); }
  }
  return out;
}
const _hit = { nx: 0, nz: 0, pen: 0 };
function collide(c, px, pz, R) {
  if (c.dead) return null; // a road event's barrier that has been moved or taken away
  if (c.t === 0) {
    const dx = px - c.x, dz = pz - c.z, rr = R + c.r, d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) return null;
    const d = Math.sqrt(d2) || 1e-4;
    _hit.nx = dx / d; _hit.nz = dz / d; _hit.pen = rr - d; return _hit;
  }
  if (c.t === 1) {
    const dx = px - c.x, dz = pz - c.z;
    const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
    const qx = clamp(lx, -c.hw, c.hw), qz = clamp(lz, -c.hd, c.hd);
    const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
    if (d2 >= R * R) return null;
    let nlx, nlz, pen;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = ex / d; nlz = ez / d; pen = R - d; }
    else {
      const ox = c.hw - Math.abs(lx), oz = c.hd - Math.abs(lz);
      if (ox < oz) { nlx = lx < 0 ? -1 : 1; nlz = 0; pen = ox + R; } else { nlx = 0; nlz = lz < 0 ? -1 : 1; pen = oz + R; }
    }
    _hit.nx = nlx * c.c + nlz * c.s; _hit.nz = -nlx * c.s + nlz * c.c; _hit.pen = pen; return _hit;
  }
  const q = segClosest(px, pz, c.ax, c.az, c.bx, c.bz);
  const dx = px - q[0], dz = pz - q[1], rr = R + c.r, d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 1e-4;
  _hit.nx = dx / d; _hit.nz = dz / d; _hit.pen = rr - d; return _hit;
}
const _qbuf = [];
function blockedAt(x, z, r) {
  const list = queryColliders(x, z, r + 2, _qbuf);
  for (const c of list) if (collide(c, x, z, r)) return true;
  return false;
}
// rectangle footprint test against colliders (centre + corners + edge midpoints)
function rectBlocked(x, z, w, d, rot, pad = 0.6) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const hw = w / 2, hd = d / 2;
  for (const [lx, lz] of [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0]]) {
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    if (blockedAt(wx, wz, pad)) return true;
  }
  return blockedAt(x, z, Math.min(hw, hd));
}

// does a rotated rectangle overlap any collider?
function rectOverlaps(x, z, w, d, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
  const list = queryColliders(x, z, Math.hypot(hw, hd) + 6, _qbuf);
  const inRect = (px, pz, r) => {
    const dx = px - x, dz = pz - z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const qx = clamp(lx, -hw, hw), qz = clamp(lz, -hd, hd);
    return (lx - qx) ** 2 + (lz - qz) ** 2 < r * r;
  };
  for (const k of list) {
    if (k.t === 0) { if (inRect(k.x, k.z, k.r)) return true; }
    else if (k.t === 2) { for (let i = 0; i <= 6; i++) if (inRect(lerp(k.ax, k.bx, i / 6), lerp(k.az, k.bz, i / 6), k.r)) return true; }
    else {
      // separating axis test between two oriented boxes
      const ax = [[c, -s], [s, c], [k.c, -k.s], [k.s, k.c]];
      const cornersA = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
      const cornersB = [[-k.hw, -k.hd], [k.hw, -k.hd], [k.hw, k.hd], [-k.hw, k.hd]].map(([lx, lz]) => [k.x + lx * k.c + lz * k.s, k.z - lx * k.s + lz * k.c]);
      let sep = false;
      for (const [axx, axz] of ax) {
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of cornersA) { const v = p[0] * axx + p[1] * axz; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
        for (const p of cornersB) { const v = p[0] * axx + p[1] * axz; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
        if (a1 < b0 || b1 < a0) { sep = true; break; }
      }
      if (!sep) return true;
    }
  }
  return false;
}

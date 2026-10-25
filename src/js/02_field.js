// ===================== road graph, distance fields, terrain =====================
const FN = FNX * FNZ;
const fieldF = new Float32Array(FN);     // land(+)/water(-) signed distance to rivers
const fieldRoad = new Float32Array(FN);  // signed distance to road edge (- inside road)
const fieldPark = new Float32Array(FN);  // + inside parks
const fieldPlaza = new Float32Array(FN); // + inside paved squares
const fieldAlley = new Float32Array(FN); // signed distance to the edge of an alley (- inside)
const edges = [];
const nodeEdges = {};
const NODES = {};
const graphNodes = [];

function sampleArr(arr, x, z) {
  let fx = (x - WX0) / CELL - 0.5, fz = (z - WZ0) / CELL - 0.5;
  fx = clamp(fx, 0, FNX - 1.001); fz = clamp(fz, 0, FNZ - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  const k = j * FNX + i;
  return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - tz) + (arr[k + FNX] * (1 - tx) + arr[k + FNX + 1] * tx) * tz;
}
const landF = (x, z) => sampleArr(fieldF, x, z);
const roadDist = (x, z) => sampleArr(fieldRoad, x, z);
const parkVal = (x, z) => sampleArr(fieldPark, x, z);
const plazaVal = (x, z) => sampleArr(fieldPlaza, x, z);
const alleyDist = (x, z) => sampleArr(fieldAlley, x, z);
const ALLEY_COST = 1.35; // routing: an alley counts as this much longer (narrow, speed bumps, scooters)
// a node where an alley meets a street that simply carries on (no signal, no zebra, sidewalks run across)
function isMouth(id) {
  const list = nodeEdges[id] || [];
  return list.some((o) => o.e.flags.alley) && list.filter((o) => !o.e.flags.alley).length <= 2;
}
const terrainH = (F) => clamp(WATER_Y + F * 0.11, -4.2, 0);
function hillH(x, z) {
  let h = 0;
  for (const hl of HILLS) {
    const dx = (x - hl.x) / hl.rx, dz = (z - hl.z) / hl.rz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 1) continue;
    const b = (1 - d2) * (1 - d2);
    h = Math.max(h, hl.h * b * (0.85 + 0.3 * vnoise(x * 0.03 + hl.x, z * 0.03)));
  }
  return h;
}
const baseHeight = (x, z) => Math.max(terrainH(landF(x, z)), hillH(x, z));

function forBox(x0, z0, x1, z1, fn) {
  const i0 = clamp(Math.floor((x0 - WX0) / CELL), 0, FNX - 1), i1 = clamp(Math.ceil((x1 - WX0) / CELL), 0, FNX - 1);
  const j0 = clamp(Math.floor((z0 - WZ0) / CELL), 0, FNZ - 1), j1 = clamp(Math.ceil((z1 - WZ0) / CELL), 0, FNZ - 1);
  for (let j = j0; j <= j1; j++) {
    const z = WZ0 + (j + 0.5) * CELL;
    for (let i = i0; i <= i1; i++) fn(j * FNX + i, WX0 + (i + 0.5) * CELL, z);
  }
}
function distPolyline(arr, pts, hwOf, R) {
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1];
    const hw = hwOf(s);
    const ax = a[0], az = a[1], bx = b[0], bz = b[1];
    forBox(Math.min(ax, bx) - R, Math.min(az, bz) - R, Math.max(ax, bx) + R, Math.max(az, bz) + R, (k, x, z) => {
      const d = Math.sqrt(segDist2(x, z, ax, az, bx, bz)) - hw;
      if (d < arr[k]) arr[k] = d;
    });
  }
}
function sdRoundRect(x, z, r) {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hx = (r.x1 - r.x0) / 2 - r.r, hz = (r.z1 - r.z0) / 2 - r.r;
  const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r.r;
}

// ---------- road graph: crossings are discovered automatically ----------
function segIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1z = p2[1] - p1[1], d2x = p4[0] - p3[0], d2z = p4[1] - p3[1];
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const ex = p3[0] - p1[0], ez = p3[1] - p1[1];
  const t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return { t: clamp(t, 0, 1), u: clamp(u, 0, 1), x: p1[0] + d1x * t, z: p1[1] + d1z * t };
}
function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const L = hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
function buildRoadGraph() {
  const all = [...ROADS, ...ALLEYS.map((a) => ({ n: a.n, hw: ALLEY_HW, pts: a.pts, alley: true }))];
  const defs = all.map((r, idx) => {
    let pts;
    if (r.ring) {
      pts = [];
      const n = 20;
      for (let k = 0; k <= n; k++) { const a = (k / n) * TAU; pts.push([r.ring.x + Math.cos(a) * r.ring.r, r.ring.z + Math.sin(a) * r.ring.r]); }
    } else pts = r.pts.map((p) => [p[0], p[1]]);
    return { r, idx, pts, cuts: [] };
  });
  // T-junctions: snap road ends that stop on another road
  for (const A of defs) {
    if (A.r.ring) continue;
    for (const endIdx of [0, A.pts.length - 1]) {
      const p = A.pts[endIdx];
      for (const B of defs) {
        if (B === A) continue;
        for (let j = 0; j < B.pts.length - 1; j++) {
          const q = segClosest(p[0], p[1], B.pts[j][0], B.pts[j][1], B.pts[j + 1][0], B.pts[j + 1][1]);
          if (hypot(q[0] - p[0], q[1] - p[1]) < 3.5) { p[0] = q[0]; p[1] = q[1]; B.cuts.push({ seg: j, t: q[2], x: q[0], z: q[1] }); }
        }
      }
    }
  }
  // crossings
  for (let a = 0; a < defs.length; a++) for (let b = a + 1; b < defs.length; b++) {
    const A = defs[a], B = defs[b];
    for (let i = 0; i < A.pts.length - 1; i++) for (let j = 0; j < B.pts.length - 1; j++) {
      const hit = segIntersect(A.pts[i], A.pts[i + 1], B.pts[j], B.pts[j + 1]);
      if (hit) { A.cuts.push({ seg: i, t: hit.t, x: hit.x, z: hit.z }); B.cuts.push({ seg: j, t: hit.u, x: hit.x, z: hit.z }); }
    }
  }
  const nodeAt = (x, z) => {
    for (const n of graphNodes) if (hypot(n.x - x, n.z - z) < 3.4) return n;
    const n = { x, z, id: 'n' + graphNodes.length };
    graphNodes.push(n);
    NODES[n.id] = [x, z];
    return n;
  };
  for (const A of defs) {
    const L = A.pts.length - 1;
    const cuts = A.cuts.slice();
    if (!A.r.ring) {
      cuts.push({ seg: 0, t: 0, x: A.pts[0][0], z: A.pts[0][1] });
      cuts.push({ seg: L - 1, t: 1, x: A.pts[L][0], z: A.pts[L][1] });
    }
    cuts.sort((p, q) => p.seg + p.t - (q.seg + q.t));
    const uniq = [];
    for (const c of cuts) if (!uniq.length || hypot(c.x - uniq[uniq.length - 1].x, c.z - uniq[uniq.length - 1].z) > 3.4) uniq.push(c);
    const pairs = [];
    for (let k = 0; k + 1 < uniq.length; k++) pairs.push([uniq[k], uniq[k + 1], false]);
    if (A.r.ring && uniq.length > 1) pairs.push([uniq[uniq.length - 1], uniq[0], true]);
    for (const [c0, c1, wrap] of pairs) {
      const poly = [[c0.x, c0.z]];
      if (!wrap) { for (let v = c0.seg + 1; v <= c1.seg; v++) poly.push(A.pts[v]); }
      else { for (let v = c0.seg + 1; v <= L; v++) poly.push(A.pts[v]); for (let v = 1; v <= c1.seg; v++) poly.push(A.pts[v]); }
      poly.push([c1.x, c1.z]);
      const pts = resample(poly, 3);
      const na = nodeAt(c0.x, c0.z), nb = nodeAt(c1.x, c1.z);
      if (na === nb) continue;
      pts[0] = [na.x, na.z]; pts[pts.length - 1] = [nb.x, nb.z];
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const e = { idx: edges.length, a: na.id, b: nb.id, pts, cum, len: cum[cum.length - 1], flags: A.r, hw: A.r.hw, name: A.r.n, k: A.r.alley ? ALLEY_COST : A.r.campus ? 4 : 1 };
      if (e.len < 1) continue;
      edges.push(e);
      (nodeEdges[na.id] = nodeEdges[na.id] || []).push({ e, dir: 1 });
      (nodeEdges[nb.id] = nodeEdges[nb.id] || []).push({ e, dir: -1 });
    }
  }
}
function edgePoint(e, s) {
  s = clamp(s, 0, e.len);
  let lo = 0, hi = e.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (e.cum[m] <= s) lo = m; else hi = m; }
  const a = e.pts[lo], b = e.pts[hi];
  const seg = e.cum[hi] - e.cum[lo] || 1;
  const t = (s - e.cum[lo]) / seg;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
}
// a grid over the road segments, so finding the nearest street does not scan the whole city
const NR = { C: 40, map: null, n: -1, st: 0 };
function roadGrid() {
  NR.map = new Map(); NR.n = edges.length;
  for (const e of edges) {
    const P = e.pts;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1], rec = { e, k, st: 0 };
      const i0 = Math.floor((Math.min(a[0], b[0]) - WX0) / NR.C), i1 = Math.floor((Math.max(a[0], b[0]) - WX0) / NR.C);
      const j0 = Math.floor((Math.min(a[1], b[1]) - WZ0) / NR.C), j1 = Math.floor((Math.max(a[1], b[1]) - WZ0) / NR.C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i * 4096 + j; let l = NR.map.get(key); if (!l) NR.map.set(key, (l = [])); l.push(rec); }
    }
  }
}
function nearestOnRoads(x, z, filter) {
  if (NR.n !== edges.length) roadGrid();
  const ci = Math.floor((x - WX0) / NR.C), cj = Math.floor((z - WZ0) / NR.C), st = ++NR.st;
  let best = null, bd = Infinity;
  for (let r = 0; r < 90; r++) {
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
      const l = NR.map.get(i * 4096 + j);
      if (!l) continue;
      for (const rec of l) {
        if (rec.st === st) continue;
        rec.st = st;
        const e = rec.e;
        if (filter && !filter(e)) continue;
        const a = e.pts[rec.k], b = e.pts[rec.k + 1];
        const q = segClosest(x, z, a[0], a[1], b[0], b[1]);
        const d = (q[0] - x) ** 2 + (q[1] - z) ** 2;
        if (d < bd) { bd = d; best = { e, s: e.cum[rec.k] + q[2] * (e.cum[rec.k + 1] - e.cum[rec.k]), px: q[0], pz: q[1] }; }
      }
    }
    // everything not yet looked at is at least r cells away
    if (best && Math.sqrt(bd) <= r * NR.C) break;
  }
  if (!best) return nearestOnRoadsScan(x, z, filter);
  best.d = Math.sqrt(bd);
  return best;
}
function nearestOnRoadsScan(x, z, filter) {
  let best = null, bd = Infinity;
  for (const e of edges) {
    if (filter && !filter(e)) continue;
    const P = e.pts;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      const minx = Math.min(a[0], b[0]) - 1, maxx = Math.max(a[0], b[0]) + 1, minz = Math.min(a[1], b[1]) - 1, maxz = Math.max(a[1], b[1]) + 1;
      const ox = x < minx ? minx - x : x > maxx ? x - maxx : 0, oz = z < minz ? minz - z : z > maxz ? z - maxz : 0;
      if (ox * ox + oz * oz > bd) continue;
      const q = segClosest(x, z, a[0], a[1], b[0], b[1]);
      const d = (q[0] - x) ** 2 + (q[1] - z) ** 2;
      if (d < bd) { bd = d; best = { e, s: e.cum[k] + q[2] * (e.cum[k + 1] - e.cum[k]), px: q[0], pz: q[1] }; }
    }
  }
  best.d = Math.sqrt(bd);
  return best;
}

function buildFields() {
  // rivers
  fieldF.fill(46);
  for (const rv of RIVERS) {
    const pts = catmull(rv.pts, false, 4);
    distPolyline(fieldF, pts, (s) => rv.hw + (vnoise(pts[s][0] * 0.04, pts[s][1] * 0.04) - 0.5) * 6, 46);
  }
  // roads
  fieldRoad.fill(16);
  fieldAlley.fill(16);
  for (const e of edges) distPolyline(e.flags.alley ? fieldAlley : fieldRoad, e.pts, () => e.hw, e.hw + 18);
  // parks & plazas (positive inside)
  fieldPark.fill(-32);
  for (const p of PARKS) forBox(p.x0 - 33, p.z0 - 33, p.x1 + 33, p.z1 + 33, (k, x, z) => { const v = -sdRoundRect(x, z, p); if (v > fieldPark[k]) fieldPark[k] = v; });
  fieldPlaza.fill(-32);
  for (const p of PLAZAS) forBox(p.x0 - 33, p.z0 - 33, p.x1 + 33, p.z1 + 33, (k, x, z) => { const v = -sdRoundRect(x, z, p); if (v > fieldPlaza[k]) fieldPlaza[k] = v; });
  for (const P of PARK_PATHS) {
    const [a, b] = P.pts;
    forBox(Math.min(a[0], b[0]) - 33, Math.min(a[1], b[1]) - 33, Math.max(a[0], b[0]) + 33, Math.max(a[1], b[1]) + 33, (k, x, z) => {
      const v = P.hw - Math.sqrt(segDist2(x, z, a[0], a[1], b[0], b[1]));
      if (v > fieldPlaza[k]) fieldPlaza[k] = v;
    });
  }
}

let fieldTex = null, fieldTex2 = null;
function buildFieldTexture() {
  const data = new Uint8Array(FN * 4);
  for (let k = 0; k < FN; k++) {
    const o = k * 4;
    data[o] = clamp(Math.round(128 + fieldRoad[k] * 8), 0, 255);
    data[o + 1] = clamp(Math.round(128 + fieldF[k] * 3), 0, 255);
    data[o + 2] = clamp(Math.round(128 + fieldPark[k] * 4), 0, 255);
    data[o + 3] = clamp(Math.round(128 + fieldPlaza[k] * 4), 0, 255);
  }
  fieldTex = new THREE.DataTexture(data, FNX, FNZ, THREE.RGBAFormat);
  fieldTex.magFilter = THREE.LinearFilter;
  fieldTex.minFilter = THREE.LinearFilter;
  fieldTex.generateMipmaps = false;
  fieldTex.needsUpdate = true;
  // second field: alleys (r) and farmland (g, 0 outside .. 255 well inside the paddies)
  const d2 = new Uint8Array(FN * 4);
  for (let k = 0; k < FN; k++) { d2[k * 4] = clamp(Math.round(128 + fieldAlley[k] * 8), 0, 255); d2[k * 4 + 3] = 255; }
  for (const pk of PARKS) if (pk.farm) forBox(pk.x0, pk.z0, pk.x1, pk.z1, (k, x, z) => { d2[k * 4 + 1] = clamp(Math.round(smoothstep(0.5, 4, -sdRoundRect(x, z, pk)) * 255), 0, 255); });
  fieldTex2 = new THREE.DataTexture(d2, FNX, FNZ, THREE.RGBAFormat);
  fieldTex2.magFilter = THREE.LinearFilter;
  fieldTex2.minFilter = THREE.LinearFilter;
  fieldTex2.generateMipmaps = false;
  fieldTex2.needsUpdate = true;
}

const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }
vec3 voro(vec2 x, float t){
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d2) - sqrt(d1), hash12(id), sqrt(d1));
}
`;

const uTime = { value: 0 };
const uBounds = { value: new THREE.Vector4(WX0, WZ0, WXS, WZS) };
let terrainMesh = null, waterMesh = null;
function buildTerrain(scene) {
  const TX = 12, TZ = 14, SEG = 46;
  const tsx = WXS / TX, tsz = WZS / TZ;
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uField = { value: fieldTex };
    sh.uniforms.uField2 = { value: fieldTex2 };
    sh.uniforms.uTime = uTime;
    sh.uniforms.uBounds = uBounds;
    sh.uniforms.uWet = WXU.wet;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;\nvarying float vWY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wpT = modelMatrix * vec4(transformed, 1.0); vWXZ = wpT.xz; vWY = wpT.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uField;\nuniform sampler2D uField2;\nuniform float uTime;\nuniform float uWet;\nuniform vec4 uBounds;\nvarying vec2 vWXZ;\nvarying float vWY;\n' + GLSL_NOISE + TERRAIN_GLSL)
      .replace('#include <map_fragment>', 'diffuseColor.rgb = terrainColor(vWXZ, vWY);');
  };
  terrainMesh = new THREE.Group();
  for (let tj = 0; tj < TZ; tj++) for (let ti = 0; ti < TX; ti++) {
    const cx = WX0 + (ti + 0.5) * tsx, cz = WZ0 + (tj + 0.5) * tsz;
    const geo = new THREE.PlaneGeometry(tsx, tsz, SEG, Math.round(SEG * tsz / tsx));
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0, cz);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, baseHeight(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    terrainMesh.add(m);
  }
  terrainMesh.add(buildSkirt());
  scene.add(terrainMesh);
  const wgeo = new THREE.PlaneGeometry(WXS, WZS, 1, 1);
  wgeo.rotateX(-Math.PI / 2);
  wgeo.translate(WX0 + WXS / 2, 0, WZ0 + WZS / 2);
  const wmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vWXZ; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWXZ = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    uniforms: { uField: { value: fieldTex }, uTime, uBounds, uNight: WXU.night },
    fragmentShader: `uniform sampler2D uField; uniform float uTime; uniform float uNight; uniform vec4 uBounds; varying vec2 vWXZ;\n` + GLSL_NOISE + WATER_GLSL,
  });
  waterMesh = new THREE.Mesh(wgeo, wmat);
  waterMesh.position.y = WATER_Y;
  waterMesh.renderOrder = 2;
  waterMesh.frustumCulled = false;
  scene.add(waterMesh);
}

// Beyond the edge of the map: the hills that ring the Taipei basin (tallest to the north, low to the west), with the
// rivers running on out of sight. A coarse grid around the map, its inner row tucked just under the map's own edge.
function skirtMountain(x, z) {
  const n = vnoise(x * 0.006, z * 0.006) * 0.65 + vnoise(x * 0.017 + 9, z * 0.017) * 0.35;
  const north = smoothstep(WZ0 + 200, WZ0 - 150, z), west = smoothstep(WX0 + 40, WX0 - 120, x);
  return lerp(30 + 34 * n, 14 + 16 * n, west) + 34 * north * (0.6 + 0.6 * n);
}
function buildSkirt() {
  const OUT = 560, nx = 80, nz = 96, sx = WXS / nx, sz = WZS / nz;
  const ex = Math.ceil(OUT / sx), ez = Math.ceil(OUT / sz);
  const cols = nx + 2 * ex + 1, rows = nz + 2 * ez + 1;
  const pos = new Float32Array(cols * rows * 3), col = new Float32Array(cols * rows * 3);
  const green = new THREE.Color(0x4f8a3a), dark = new THREE.Color(0x3d6f30), city = new THREE.Color(0xcac4b8), water = new THREE.Color(0x4fb8b8), c = new THREE.Color();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = WX0 + (i - ex) * sx, z = WZ0 + (j - ez) * sz;
    const ax = clamp(x, WX0 + 1, WX0 + WXS - 1), az = clamp(z, WZ0 + 1, WZ0 + WZS - 1);
    const d = Math.hypot(x - ax, z - az), F = landF(ax, az), he = baseHeight(ax, az);
    const s = smoothstep(0, 280, d), wet = smoothstep(6, -2, F);
    let h = lerp(he, skirtMountain(x, z), s);
    // a river keeps going, flat, all the way out
    h = lerp(h, WATER_Y - 0.4, wet);
    if (d < 0.5) h = he - 1.2; // inside the map: hidden under its own terrain
    const k = (j * cols + i) * 3;
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    const hilly = clamp(Math.max(he / 2, F < 24 ? 1 : 0, parkVal(ax, az) > 0 ? 1 : 0), 0, 1);
    c.copy(city).lerp(green, Math.max(hilly, smoothstep(0, 50, d))).lerp(dark, s * 0.6 * vnoise(x * 0.02, z * 0.02)).lerp(water, wet);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    // skip the cells well inside the map
    if (i > ex && i < ex + nx - 1 && j > ez && j < ez + nz - 1) continue;
    const a = j * cols + i, b = a + 1, cc = a + cols, dd = cc + 1;
    idx.push(a, cc, b, b, cc, dd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex }));
  m.frustumCulled = false;
  return m;
}

const TERRAIN_GLSL = `
vec3 terrainColor(vec2 p, float wy) {
  vec4 fld = texture2D(uField, (p - uBounds.xy) / uBounds.zw);
  float roadD = (fld.r * 255.0 - 128.0) / 8.0;
  float F = (fld.g * 255.0 - 128.0) / 3.0;
  float park = (fld.b * 255.0 - 128.0) / 4.0;
  float plaza = (fld.a * 255.0 - 128.0) / 4.0;
  float alleyD = (texture2D(uField2, (p - uBounds.xy) / uBounds.zw).r * 255.0 - 128.0) / 8.0;
  float n1 = vnoise(p * 0.03);
  float n2 = vnoise(p * 0.13 + 17.0);
  float n3 = vnoise(p * 0.5 + 3.0);
  vec3 col;
  if (F < 0.0) {
    float depth = clamp(-F / 30.0, 0.0, 1.0);
    col = mix(vec3(0.50, 0.88, 0.80), vec3(0.20, 0.74, 0.72), smoothstep(0.0, 0.3, depth));
    col = mix(col, vec3(0.10, 0.56, 0.62), smoothstep(0.3, 1.0, depth));
    col = mix(col, vec3(0.70, 0.80, 0.66), (1.0 - smoothstep(0.0, 0.1, depth)) * 0.45);
    vec3 v = voro(p * 0.15, uTime * 0.7);
    col += (1.0 - smoothstep(0.0, 0.075, v.x)) * (0.12 - 0.07 * depth);
    col *= 0.96 + 0.06 * n2;
  } else {
    col = vec3(0.80, 0.78, 0.73) * (0.95 + 0.07 * n2);
    float riverside = 1.0 - smoothstep(24.0 + n1 * 12.0, 30.0 + n1 * 12.0, F);
    float hill = smoothstep(0.4, 1.6, wy);
    float grassT = max(max(smoothstep(-0.6, 0.8, park), riverside), hill);
    if (grassT > 0.001) {
      vec3 g = mix(vec3(0.53, 0.78, 0.30), vec3(0.42, 0.70, 0.25), smoothstep(0.3, 0.7, n1 * 0.65 + n2 * 0.35));
      g *= 0.95 + 0.08 * hash12(floor(p * 1.7));
      g = mix(g, vec3(0.33, 0.55, 0.22), hill * 0.65);
      vec2 fc = floor(p * 0.9);
      float fpatch = smoothstep(0.42, 0.75, vnoise(p * 0.045 + 5.0)) * (1.0 - hill);
      if (hash12(fc) > 1.0 - 0.30 * fpatch) {
        vec2 fp = fract(p * 0.9) - 0.5 - (hash22(fc) - 0.5) * 0.5;
        float k = hash12(fc + 7.7);
        vec3 flc = k < 0.55 ? vec3(0.99, 0.98, 0.93) : (k < 0.82 ? vec3(0.98, 0.70, 0.80) : vec3(1.0, 0.86, 0.36));
        g = mix(g, flc, 1.0 - smoothstep(0.13, 0.2, length(fp)));
      }
      g = mix(g, vec3(0.74, 0.69, 0.52), (1.0 - smoothstep(0.0, 3.0, F)) * (1.0 - hill));
      // paddy fields: plots of young rice, flooded plots that shine, stubble; earth dikes between
      float farm = texture2D(uField2, (p - uBounds.xy) / uBounds.zw).g;
      if (farm > 0.01) {
        vec2 q = (p + vec2(3.0, 7.0)) / vec2(17.0, 11.0);
        vec2 cell = floor(q), f = fract(q);
        float hc = hash12(cell + 3.1);
        vec3 pd = hc < 0.42 ? vec3(0.47, 0.73, 0.31) : hc < 0.68 ? vec3(0.58, 0.78, 0.36) : hc < 0.86 ? vec3(0.50, 0.70, 0.66) : vec3(0.80, 0.73, 0.45);
        pd *= 0.93 + 0.1 * step(0.5, fract(p.x * 0.85 + hc * 3.0)) * step(hc, 0.68);
        float dike = 1.0 - smoothstep(0.88, 0.93, max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2.0);
        pd = mix(vec3(0.63, 0.58, 0.42), pd, dike);
        g = mix(g, pd, farm);
      }
      col = mix(col, g, grassT);
    }
    float pz = smoothstep(-0.5, 0.5, plaza);
    if (pz > 0.001) {
      vec2 tp = fract(p * 0.25);
      float grout = step(0.93, max(tp.x, tp.y));
      vec3 pc = mix(vec3(0.93, 0.91, 0.87), vec3(0.86, 0.84, 0.80), hash12(floor(p * 0.25)) * 0.7);
      pc = mix(pc, vec3(0.75, 0.73, 0.69), grout);
      col = mix(col, pc, pz);
    }
    float sw = 1.0 - smoothstep(4.4, 5.0, roadD);
    if (sw > 0.001) {
      vec2 tp = fract(p * 0.6);
      float grout = step(0.88, max(tp.x, tp.y));
      vec3 sc = mix(vec3(0.87, 0.84, 0.80), vec3(0.78, 0.76, 0.72), grout);
      sc = mix(sc, vec3(0.80, 0.56, 0.47), step(0.62, hash12(floor(p * 0.6))) * 0.35);
      sc = mix(sc, vec3(0.94, 0.93, 0.90), 1.0 - smoothstep(0.0, 0.6, roadD));
      col = mix(col, sc, sw * (1.0 - pz * 0.6));
    }
    // alleys: a thin kerb strip against the walls, asphalt that cuts through the sidewalk at the mouth
    float inA = 1.0 - smoothstep(-0.12, 0.18, alleyD);
    col = mix(col, vec3(0.86, 0.84, 0.80), (1.0 - smoothstep(0.5, 0.9, alleyD)) * (1.0 - inA) * step(0.6, roadD));
    float inR = max(1.0 - smoothstep(-0.12, 0.18, roadD), inA);
    vec3 asph = vec3(0.41, 0.44, 0.48) * (0.94 + 0.07 * n3 + 0.05 * n2);
    // manhole covers here and there in the asphalt
    vec2 mc = floor(p / 21.0);
    vec2 mo = (mc + 0.5) * 21.0 + (hash22(mc + 7.3) - 0.5) * 13.0;
    float md = length(p - mo);
    float mh = step(0.55, hash12(mc + 1.7)) * (1.0 - smoothstep(0.52, 0.62, md));
    asph = mix(asph, vec3(0.33, 0.35, 0.38) - 0.05 * step(0.36, md) * step(md, 0.42), mh);
    // rain: dark, wet asphalt with puddles that shine with the sky, pavements a shade darker
    if (uWet > 0.0) {
      float pud = smoothstep(0.6, 0.68, vnoise(p * 0.07 + 3.1)) * (0.6 + 0.4 * n3);
      float ring = 0.5 + 0.5 * sin(length(fract(p * 0.35) - 0.5) * 40.0 - uTime * 9.0);
      asph = mix(asph * 0.74, vec3(0.52, 0.58, 0.66) + 0.05 * ring, pud * 0.62 * uWet);
      col *= 1.0 - 0.1 * uWet;
    }
    col = mix(col, asph, inR);
    // red no-parking lines along the alley walls (not on the street the alley opens onto)
    float redl = (1.0 - smoothstep(0.07, 0.16, abs(alleyD + 0.55))) * inA * smoothstep(0.4, 1.4, roadD);
    col = mix(col, vec3(0.80, 0.27, 0.22), redl);
  }
  float cl = vnoise(p * 0.006 + vec2(uTime * 0.012, uTime * 0.005));
  col *= 1.0 - 0.09 * smoothstep(0.58, 0.78, cl);
  return col;
}
`;

const WATER_GLSL = `
void main(){
  vec4 fld = texture2D(uField, (vWXZ - uBounds.xy) / uBounds.zw);
  float F = (fld.g * 255.0 - 128.0) / 3.0;
  if (F > 0.35) discard;
  vec2 p = vWXZ;
  float n = vnoise(p * 0.33 + vec2(uTime * 0.25, -uTime * 0.18));
  float n2 = vnoise(p * 0.85 + vec2(-uTime * 0.4, uTime * 0.3));
  float wob = sin(uTime * 1.25 + p.x * 0.045 + p.y * 0.037) * 0.45;
  float edge = -1.25 - wob - n * 1.1;
  float foam = smoothstep(edge - 0.3, edge + 0.05, F);
  foam *= smoothstep(0.18, 0.42, n2 + (F - edge) * 0.35);
  float l2 = -3.8 - 1.3 * sin(uTime * 0.6 + p.x * 0.021 + p.y * 0.013);
  float line2 = (1.0 - smoothstep(0.08, 0.42, abs(F - l2 + (n - 0.5) * 0.8))) * smoothstep(0.35, 0.65, n2);
  float f = max(foam, line2 * 0.8);
  vec2 sc = floor(p * 1.25);
  float sh = hash12(sc);
  float tw = sin(uTime * (1.6 + sh * 3.0) + sh * 40.0);
  vec2 sp = fract(p * 1.25) - 0.5;
  float spark = step(0.982, sh) * smoothstep(0.55, 1.0, tw) * (1.0 - smoothstep(0.04, 0.2, length(sp))) * smoothstep(-2.0, -7.0, F);
  vec3 col = mix(vec3(0.32, 0.84, 0.82), vec3(1.0), max(f, spark));
  col *= 1.0 - 0.62 * uNight;
  float a = max(0.14, max(f * 0.96, spark * 0.9));
  gl_FragColor = vec4(col, a);
}
`;

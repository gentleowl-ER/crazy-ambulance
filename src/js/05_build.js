// ===================== city: buildings, landmarks, hospitals, street furniture =====================
const BRIDGES = [];      // flat drivable decks (the river bridges are DECKS, in 05c_shilin.js)
const RAMP_SHAPES = [];  // jump humps {x,z,ux,uz,len,hw,h,hump}
const BUILDINGS = [];    // footprints for the minimap {x,z,w,d,rot,h}
const DYN = { plane: null, planeT: 0, parkedPlanes: [] };
let sceneRef = null;
let tower101 = null;

const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };
function placer(x, z, rot, y0 = 0) {
  const m0 = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y0, z);
  return (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => m0.clone().multiply(M(lx, ly, lz, rx, ry, rz, sx, sy, sz));
}
const localToWorld = (x, z, rot, lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];

// hip roof: ridge along the longer side; ridgeFrac 0 gives a pyramid
function hipRoofGeo(w, d, h, ridgeFrac = 0.4) {
  const swap = d > w;
  const W = swap ? d : w, D = swap ? w : d;
  const rl = Math.max(0, (W - D) / 2 + D * ridgeFrac * 0.5);
  const A = [-W / 2, 0, -D / 2], B = [W / 2, 0, -D / 2], C = [W / 2, 0, D / 2], Dv = [-W / 2, 0, D / 2], R1 = [-rl, h, 0], R2 = [rl, h, 0];
  const tris = [Dv, C, R2, Dv, R2, R1, B, A, R1, B, R1, R2, C, B, R2, A, Dv, R1, A, B, C, A, C, Dv];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  if (swap) g.rotateY(Math.PI / 2);
  return g;
}
// upturned eave tips at the four roof corners (Chinese-style roofs)
function eaveHorns(P, w, d, y, col) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // pitch the tip upward first, then yaw it along the roof diagonal
    const rotM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.45, Math.atan2(sx * w, sz * d), 0, 'YXZ'));
    addStatic(box(0.55, 0.45, 2.6), col, P(sx * (w / 2 - 0.5), y + 0.45, sz * (d / 2 - 0.5)).multiply(rotM));
  }
}
function iconDiscTexture(icon, css) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fill();
  g.fillStyle = css; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.stroke(); g.setLineDash([]);
  drawIcon(g, icon, 128, 128, 120, '#ffffff');
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function helipadTexture() {
  return textTexture(256, 256, (g) => {
    g.strokeStyle = '#f2c94c'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 110, 0, TAU); g.stroke();
    g.fillStyle = '#ffffff'; g.font = `700 150px ${FONT_NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136);
  });
}
function flatDecal(tex, size, x, y, z, rot) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
  m.position.set(x, y, z);
  sceneRef.add(m);
  return m;
}

// ---------- generic city buildings ----------
const FACADES = {
  mid: [0xece4d6, 0xf3efe7, 0xdcd3c7, 0xe8cdb9, 0xc9d5d8, 0xd8bc9e, 0xe3dccd, 0xcfc6ba, 0xf1e2c4, 0xd6dfe6, 0xe9d3d0],
  old: [0xc7744f, 0xb5643f, 0xd9a273, 0xe0c39a, 0xb98263, 0xd8c3a5],
  glass: [0xa9c8d8, 0x9fbfcf, 0xb6d0dc, 0x8fb2c4, 0xc3d3db],
};
const AWNINGS = [0x2f9e6b, 0xd9473d, 0x3a7fd5, 0xf2c14e, 0x8a5a3a, 0xf08a3c, 0x6a7a86, 0x8b6fd6];
function zoneOf(x, z) {
  // north of the 基隆河 (士林, 北投, 大直, 內湖) and 社子: lower, older streets
  if (z < -560 || (z < -470 && x < 100) || (x > 900 && z < -150)) return 'shilin';
  if (x < -100 && z < 330) return 'old';
  if (x > 700 && z > 60 && z < 330) return 'xinyi';
  if (x > 420 && x < 760 && z < 330 && z > -300) return 'east';
  return 'mid';
}
function styleFor(x, z, street) {
  const zone = zoneOf(x, z);
  let h, cols = FACADES.mid, bay = rand(3.0, 3.8);
  if (zone === 'old') { h = rand(8, 13); cols = FACADES.old; bay = rand(2.6, 3.2); }
  else if (zone === 'xinyi') { h = street ? rand(18, 30) : rand(26, 42); cols = rng() < 0.6 ? FACADES.glass : FACADES.mid; }
  else if (zone === 'east') h = street ? rand(14, 25) : rand(18, 32);
  else if (zone === 'shilin') { h = street ? rand(9, 19) : rand(10, 22); if (rng() < 0.18) cols = FACADES.old; }
  else h = street ? rand(10, 21) : rand(12, 26);
  return { h: Math.max(2, Math.round(h / 3.2)) * 3.2 + 0.4, color: pick(cols), bay, zone };
}
function addBuilding(x, z, rot, w, d, st, street) {
  const P = placer(x, z, rot);
  const h = st.h;
  addStatic(windowBox(w, h, d, st.bay, 3.2), st.color, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w + 0.3, 0.5, d + 0.3), shade(st.color, 0.8), P(0, h + 0.25, 0), { mat: 'city' });
  addStatic(box(w - 0.7, 0.12, d - 0.7), 0xa3a9ab, P(0, h + 0.52, 0), { mat: 'city' });
  const brand = street && w >= 8.5 ? pickBrand(st.zone) : null;
  if (brand) addShopfront(P, w, d, brand);
  if (street) {
    const old = st.zone === 'old';
    if (!brand) addStatic(box(w - 0.5, 3.0, 0.3), old ? 0x4a3b33 : 0x51606b, P(0, 1.55, d / 2 + 0.1), { mat: 'city' });
    if (old) for (const sx of [-1, 1]) addStatic(box(0.9, 3.2, 0.9), shade(st.color, 0.9), P(sx * (w / 2 - 0.6), 1.6, d / 2 + 1.2), { mat: 'city' });
    if (!brand) addStatic(box(w - 0.2, 0.25, 1.6), pick(AWNINGS), P(0, 3.25, d / 2 + 0.8), { mat: 'city' });
    if (!brand && rng() < 0.7) addStatic(signQuad(Math.min(w * 0.72, 7.5), 1.9, 'h', randi(0, SIGN_H.length - 1)), 0xffffff, P(rand(-w * 0.12, w * 0.12), 4.75, d / 2 + 0.07), { mat: 'sign', uv: true, noShadow: true });
    if (h > 9 && rng() < 0.45) {
      const sx = rng() < 0.5 ? -1 : 1;
      addStatic(signQuad(1.5, 5.8, 'v', randi(0, SIGN_V.length - 1)), 0xffffff, P(sx * (w / 2 - 1.3), Math.min(h - 3.4, 8.2), d / 2 + 0.95, 0, Math.PI / 2, 0), { mat: 'sign', uv: true, noShadow: true });
    }
    for (let k = 0; k < 3; k++) if (rng() < 0.45 && h > 7) addStatic(box(1.0, 0.7, 0.55), 0xd5d8da, P(rand(-w / 2 + 1.5, w / 2 - 1.5), 3.2 * randi(brand ? 2 : 1, Math.max(brand ? 2 : 1, Math.floor(h / 3.2) - 1)) + 0.45, d / 2 + 0.28), { mat: 'city' });
  }
  if (rng() < 0.65) {
    const tx = rand(-w / 4, w / 4), tz = rand(-d / 4, d / 4);
    addStatic(box(1.8, 0.8, 1.8), 0x8f979c, P(tx, h + 0.9, tz), { mat: 'city' });
    addStatic(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8), rng() < 0.5 ? 0xdfe3e6 : 0x4a86c8, P(tx, h + 2.1, tz), { mat: 'city' });
  }
  if (rng() < 0.32 && w > 10) {
    const ox = rand(-w * 0.2, w * 0.2), oz = rand(-d * 0.18, d * 0.18);
    addStatic(box(w * 0.42, 2.4, d * 0.4), 0xe7e1d6, P(ox, h + 1.7, oz), { mat: 'city' });
    addStatic(box(w * 0.42 + 0.7, 0.26, d * 0.4 + 0.7), rng() < 0.6 ? 0x5a86b8 : 0xe9eef0, P(ox, h + 3.05, oz), { mat: 'city' });
  }
  boxCollider(x, z, w + 0.3, d + 0.3, rot);
  BUILDINGS.push({ x, z, w, d, rot, h });
}
function groundOK(x, z, roadMin, alleyMin = 1.2) {
  if (x < WX0 + 14 || x > WX0 + WXS - 14 || z < WZ0 + 14 || z > WZ0 + WZS - 14) return false;
  if (roadDist(x, z) < roadMin) return false;
  if (alleyDist(x, z) < alleyMin) return false;
  if (landF(x, z) < 30) return false;
  if (parkVal(x, z) > -3) return false;
  if (plazaVal(x, z) > -2.5) return false;
  if (hillH(x, z) > 0.25) return false;
  return true;
}
function footprintOK(x, z, w, d, rot, roadMin, alleyMin) {
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {
    const lx = (ix / 2) * (w / 2), lz = (iz / 2) * (d / 2);
    if (!groundOK(x + lx * c + lz * s, z - lx * s + lz * c, roadMin, alleyMin)) return false;
  }
  // the open spaces kept by the filler pass (car parks, pocket parks, courts) stay open
  if (FILL.occ && !occFree(x, z, w + 1, d + 1, rot)) return false;
  return !rectOverlaps(x, z, w + 1.0, d + 1.0, rot);
}
function generateBuildings() {
  // the walk-up apartments that line the alleys go first, right against the lane
  for (const e of edges) if (e.flags.alley) alleyBuildings(e);
  for (const e of edges) {
    if (e.flags.ring || e.flags.campus || e.flags.alley) continue;
    for (const side of [1, -1]) {
      let s = 4;
      while (s < e.len - 4) {
        const w = rand(9, 18);
        const [px, pz, tx, tz] = edgePoint(e, s + w / 2);
        const nx = -tz * side, nz = tx * side;
        const d = rand(10, 19);
        const off = e.hw + 5.4 + d / 2;
        const x = px + nx * off, z = pz + nz * off;
        const rot = Math.atan2(-nx, -nz);
        if (footprintOK(x, z, w, d, rot, 4.9)) {
          addBuilding(x, z, rot, w, d, styleFor(x, z, true), true);
          s += w + rand(0.4, 2);
        } else s += 3.5;
      }
    }
  }
  // the open spaces a block keeps: pocket parks, car parks, courts, gas stations, vegetable patches (05f_fill.js)
  fillGaps('big');
  // fill block interiors: solid within a few blocks of a street, only a scattering of houses further out (the far
  // banks of the rivers and the fields, where no street of the game goes)
  const C = 40, NX = Math.ceil(WXS / C), NZ = Math.ceil(WZS / C), near = new Uint8Array(NX * NZ);
  for (const e of edges) for (const [px, pz] of e.pts) {
    const ci = Math.floor((px - WX0) / C), cj = Math.floor((pz - WZ0) / C);
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < NX && j < NZ && di * di + dj * dj <= 10) near[j * NX + i] = 1;
    }
  }
  for (let gz = WZ0 + 20; gz < WZ0 + WZS - 20; gz += 22) for (let gx = WX0 + 20; gx < WX0 + WXS - 20; gx += 22) {
    const x = gx + rand(-6, 6), z = gz + rand(-6, 6);
    if (!near[Math.floor((z - WZ0) / C) * NX + Math.floor((x - WX0) / C)] && rng() > 0.28) continue;
    if (!groundOK(x, z, 14)) continue;
    const gxr = roadDist(x + 1, z) - roadDist(x - 1, z), gzr = roadDist(x, z + 1) - roadDist(x, z - 1);
    const rot = Math.atan2(-gxr, -gzr);
    const w = rand(12, 22), d = rand(12, 20);
    if (footprintOK(x, z, w, d, rot, 9, 2.5)) addBuilding(x, z, rot, w, d, styleFor(x, z, false), false);
  }
}

// ---------- landmarks ----------
function build101() {
  const [x, z] = LANDMARKS.tp101;
  const P = placer(x, z, 0);
  addStatic(windowBox(40, 10, 30, 3.4, 3.4), 0xa7c3c9, P(0, 5, 2), { mat: 'city', uv: true });
  addStatic(box(40.4, 0.6, 30.4), 0x8aa9af, P(0, 10.3, 2), { mat: 'city' });
  boxCollider(x, z + 2, 41, 31, 0);
  const gb = new GB(true);
  const glassA = 0x6f9ea3, glassB = 0x86b5b7, trim = 0xd7ecec;
  const frustum = (y0, h, w0, w1, col) => {
    const g = new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, h, 4, 1);
    g.rotateY(Math.PI / 4);
    gb.add(g, col, M(0, y0 + h / 2, 0), { flat: true });
  };
  frustum(10, 24, 19, 16.5, glassA);
  for (let i = 0; i < 8; i++) {
    const y0 = 34 + i * 8.2;
    frustum(y0, 8.2, 14.5, 17.6, i % 2 ? glassB : glassA);
    gb.add(box(14.9, 0.5, 14.9), trim, M(0, y0 + 0.25, 0));
  }
  frustum(99.6, 6, 9.2, 8, glassB);
  frustum(105.6, 4, 6.2, 5, glassA);
  const [sg, sm] = cylBetween(0, 109.6, 0, 0, 127, 0, 0.75, 0.15, 6);
  gb.add(sg, 0xdfe7e8, sm);
  for (const [ox, oz, rx, rz] of [[0, 9.4, Math.PI / 2, 0], [0, -9.4, Math.PI / 2, 0], [9.4, 0, 0, Math.PI / 2], [-9.4, 0, 0, Math.PI / 2]]) gb.add(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 14), 0xe0b84a, M(ox, 30, oz, rx, 0, rz));
  MAT.tower = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, transparent: true, opacity: 1 });
  tower101 = new THREE.Mesh(gb.build(), MAT.tower);
  tower101.position.set(x, 0, z);
  tower101.castShadow = true; tower101.receiveShadow = true;
  sceneRef.add(tower101);
}
function palaceHall(x, z, w, d, roofCol, wallCol, rot = 0) {
  const P = placer(x, z, rot);
  addStatic(box(w + 4, 2, d + 4), 0xe8e4dc, P(0, 1, 0));
  addStatic(box(w, 8, d), wallCol, P(0, 6, 0));
  for (let i = 0; i <= 8; i++) for (const sz of [-1, 1]) addStatic(new THREE.CylinderGeometry(0.45, 0.45, 8, 8), 0xc23a2e, P(-w / 2 + (i * w) / 8, 6, sz * (d / 2 + 1.1)));
  addStatic(hipRoofGeo(w + 6, d + 6, 4.4, 0.55), roofCol, P(0, 10, 0), { flat: true });
  addStatic(box(w * 0.62, 2.2, d * 0.5), wallCol, P(0, 15.2, 0));
  addStatic(hipRoofGeo(w * 0.72, d * 0.66, 3.4, 0.45), roofCol, P(0, 16.3, 0), { flat: true });
  eaveHorns(P, w + 6, d + 6, 10, roofCol);
  const c = Math.cos(rot), s = Math.sin(rot);
  addCollider({ t: 1, x, z, hw: (w + 4) / 2, hd: (d + 4) / 2, c, s });
}
function buildCKS() {
  const [hx, hz] = LANDMARKS.cksHall;
  const P = placer(hx, hz, 0);
  const white = 0xf3f0ea, blue = 0x2c5aa0, gold = 0xe0b84a;
  addStatic(box(32, 1.6, 32), 0xe4e0d8, P(0, 0.8, 0));
  addStatic(box(27, 1.6, 27), white, P(0, 2.4, 0));
  addStatic(box(22, 1.6, 22), white, P(0, 4.0, 0));
  for (let i = 0; i < 6; i++) { const top = 4.8 - i * 0.8; addStatic(box(1.5, top, 10), white, P(-11.6 - i * 1.4, top / 2, 0)); }
  addStatic(new THREE.CylinderGeometry(9.6, 9.6, 13, 8), white, P(0, 11.3, 0, 0, Math.PI / 8, 0), { flat: true });
  addStatic(box(0.4, 6, 3.6), 0x2e3f5e, P(-9.0, 7.8, 0));
  addStatic(new THREE.CylinderGeometry(7.6, 12.8, 3, 8), blue, P(0, 19.3, 0, 0, Math.PI / 8, 0), { flat: true });
  addStatic(new THREE.CylinderGeometry(7.2, 7.2, 3, 8), white, P(0, 22.2, 0, 0, Math.PI / 8, 0), { flat: true });
  addStatic(new THREE.ConeGeometry(9.8, 6.2, 8), blue, P(0, 26.8, 0, 0, Math.PI / 8, 0), { flat: true });
  addStatic(new THREE.ConeGeometry(1, 2.6, 8), gold, P(0, 31.2, 0));
  boxCollider(hx, hz, 32, 32, 0);
  boxCollider(hx - 15.6, hz, 9, 10, 0);
  // Liberty Square gate: five openings you can drive through
  const [gx, gz] = LANDMARKS.cksGate;
  const G = placer(gx, gz, 0);
  for (const pz of [-16, -9.6, -3.2, 3.2, 9.6, 16]) { addStatic(box(4, 9, 2.4), white, G(0, 4.5, pz)); boxCollider(gx, gz + pz, 4.2, 2.6, 0); }
  addStatic(box(4.4, 3.4, 35), white, G(0, 10.7, 0));
  addStatic(hipRoofGeo(6.4, 15, 3.0, 0.55), blue, G(0, 12.4, 0), { flat: true });
  for (const sz of [-1, 1]) addStatic(hipRoofGeo(5.6, 11, 2.4, 0.5), blue, G(0, 12.4, sz * 12), { flat: true });
  // National Theater and Concert Hall
  palaceHall(LANDMARKS.theater[0], LANDMARKS.theater[1], 30, 12, 0xe8a33a, 0xf0e3c8);
  palaceHall(LANDMARKS.concert[0], LANDMARKS.concert[1], 30, 12, 0xe8a33a, 0xf0e3c8);
  // garden trees along the edges of the square
  for (let x = 44; x <= 124; x += 8) for (const z of [209, 291]) if (Math.abs(x - 80) > 18) addTree(x, z, rand(0.75, 0.95));
  for (let z = 225; z <= 275; z += 9) addTree(126, z, rand(0.75, 0.95));
}
function buildPresidential() {
  const [x, z] = LANDMARKS.presidential;
  const rot = Math.PI / 2; // facade faces east toward Ketagalan Boulevard
  const P = placer(x, z, rot);
  const brick = 0xb5523b, white = 0xf1ece2;
  addStatic(windowBox(46, 12, 7, 3, 3.2), brick, P(0, 6, 9.5), { mat: 'city', uv: true });
  addStatic(windowBox(46, 12, 7, 3, 3.2), brick, P(0, 6, -9.5), { mat: 'city', uv: true });
  for (const sx of [-1, 1]) addStatic(windowBox(7, 12, 12, 3, 3.2), brick, P(sx * 19.5, 6, 0), { mat: 'city', uv: true });
  for (const y of [4.1, 8.1, 12.1]) {
    addStatic(box(46.4, 0.5, 7.4), white, P(0, y, 9.5));
    addStatic(box(46.4, 0.5, 7.4), white, P(0, y, -9.5));
  }
  addStatic(windowBox(8, 30, 8, 2.6, 3.4), brick, P(0, 15, 11), { mat: 'city', uv: true });
  for (const y of [12.4, 22, 29.6]) addStatic(box(8.6, 0.7, 8.6), white, P(0, y, 11));
  addStatic(new THREE.ConeGeometry(6.4, 4.4, 4), 0x6f8f7f, P(0, 32.2, 11, 0, Math.PI / 4, 0), { flat: true });
  addStatic(box(4, 4.4, 0.3), 0x4a3a30, P(0, 2.2, 15.1));
  addStatic(box(48, 0.4, 28), 0x9e9a92, P(0, 12.3, 0));
  boxCollider(x, z, 47, 27, rot);
}
function buildEastGate() {
  const [x, z] = LANDMARKS.eastGate;
  addStatic(new THREE.CylinderGeometry(9, 9.5, 0.8, 24), 0xbdb6a8, M(x, 0.4, z));
  addStatic(new THREE.CylinderGeometry(8.4, 8.4, 0.2, 24), 0x6cb446, M(x, 0.85, z));
  const P = placer(x, z, 0);
  addStatic(box(10, 5, 6), 0xe0dbd0, P(0, 3.4, 0));
  addStatic(box(3.2, 3.4, 6.2), 0x5a4a3e, P(0, 2.6, 0));
  addStatic(box(8, 3.4, 4.6), 0xc2402f, P(0, 7.6, 0));
  addStatic(hipRoofGeo(11, 7.4, 2.4, 0.5), 0xe9a638, P(0, 9.3, 0), { flat: true });
  addStatic(hipRoofGeo(7, 4.6, 2.0, 0.4), 0xe9a638, P(0, 11.4, 0), { flat: true });
  eaveHorns(P, 11, 7.4, 9.3, 0xe9a638);
  addCollider({ t: 0, x, z, r: 9.4 });
}
function buildStation() {
  const [x, z] = LANDMARKS.station;
  const P = placer(x, z, 0);
  addStatic(windowBox(40, 12, 28, 3.6, 4), 0xdcd3c1, P(0, 6, 0), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(46, 34, 5, 0.45), 0x58665c, P(0, 12, 0), { flat: true });
  addStatic(windowBox(26, 3.2, 18, 3, 3.2), 0xdcd3c1, P(0, 18.6, 0), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(30, 22, 4, 0.4), 0x58665c, P(0, 20.2, 0), { flat: true });
  boxCollider(x, z, 41, 29, 0);
}
function buildNorthGate() {
  const [x, z] = LANDMARKS.northGate;
  const P = placer(x, z, 0);
  addStatic(box(9, 6, 7), 0xa59d92, P(0, 3, 0));
  addStatic(box(3, 4, 7.2), 0x4e433b, P(0, 2, 0));
  addStatic(box(6.4, 2.6, 4.8), 0xb9b1a5, P(0, 7.3, 0));
  addStatic(hipRoofGeo(8.6, 6.4, 2.2, 0.45), 0x5d5a55, P(0, 8.6, 0), { flat: true });
  boxCollider(x, z, 9.4, 7.4, 0);
}
function build228() {
  const [x, z] = LANDMARKS.monument228;
  addStatic(box(6, 1, 6), 0xd9d4ca, M(x, 0.5, z));
  addStatic(box(2.6, 10, 2.6), 0xf4f2ee, M(x, 6, z));
  const [g, m] = cylBetween(x, 11, z, x, 22, z, 0.95, 0.12, 4);
  addStatic(g, 0xf4f2ee, m);
  addCollider({ t: 0, x, z, r: 3.4 });
  const px = x - 18, pz = z + 16;
  addStatic(new THREE.CylinderGeometry(7.4, 7.6, 0.5, 20), 0xc9c2b4, M(px, 0.25, pz));
  addStatic(new THREE.CylinderGeometry(6.7, 6.7, 0.1, 20), 0x5fc7cf, M(px, 0.52, pz), { noShadow: true });
  addCollider({ t: 0, x: px, z: pz, r: 7.4 });
}
function buildRedHouse() {
  const [x, z] = LANDMARKS.redHouse;
  const brick = 0xb84a32;
  addStatic(new THREE.CylinderGeometry(7.4, 7.6, 9, 8), brick, M(x, 4.5, z, 0, Math.PI / 8, 0), { flat: true });
  for (const y of [3.2, 9.2]) addStatic(new THREE.CylinderGeometry(7.9, 7.9, 0.6, 8), 0xf1ece2, M(x, y, z, 0, Math.PI / 8, 0), { flat: true });
  addStatic(new THREE.ConeGeometry(8.6, 3.2, 8), 0x585c63, M(x, 11.1, z, 0, Math.PI / 8, 0), { flat: true });
  addStatic(new THREE.CylinderGeometry(1.4, 1.4, 2, 8), brick, M(x, 13.5, z));
  addStatic(windowBox(14, 8, 10, 3, 4), brick, M(x - 13.5, 4, z), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(15, 11, 2.6, 0.5), 0x585c63, M(x - 13.5, 8, z), { flat: true });
  addCollider({ t: 0, x, z, r: 8 });
  boxCollider(x - 13.5, z, 14.4, 10.4, 0);
}
function buildLongshan() {
  const [x, z] = LANDMARKS.longshan;
  const P = placer(x, z, 0);
  const red = 0xb8352c, roof = 0xd65a2c, gold = 0xf2c14e;
  addStatic(box(26, 1, 8), 0xd8d0c2, P(0, 0.5, 9));
  addStatic(box(24, 6, 6), red, P(0, 4, 9));
  addStatic(hipRoofGeo(28, 10, 3, 0.7), roof, P(0, 7, 9), { flat: true });
  addStatic(box(19, 0.6, 0.6), gold, P(0, 10.2, 9));
  eaveHorns(P, 28, 10, 7, roof);
  addStatic(box(20, 1.2, 14), 0xd8d0c2, P(0, 0.6, -6));
  addStatic(box(18, 7, 12), red, P(0, 4.7, -6));
  addStatic(hipRoofGeo(24, 18, 3.4, 0.6), roof, P(0, 8.2, -6), { flat: true });
  addStatic(box(13, 2, 8), red, P(0, 12.4, -6));
  addStatic(hipRoofGeo(16, 11, 3, 0.5), roof, P(0, 13.4, -6), { flat: true });
  addStatic(box(11, 0.6, 0.6), gold, P(0, 16.6, -6));
  eaveHorns(P, 24, 18, 8.2, roof);
  for (const sx of [-1, 1]) {
    addStatic(box(4, 5, 20), red, P(sx * 12, 2.5, 1));
    addStatic(hipRoofGeo(6, 22, 1.8, 0.8), roof, P(sx * 12, 5, 1), { flat: true });
    boxCollider(x + sx * 12, z + 1, 4.4, 20.4, 0);
  }
  addStatic(new THREE.CylinderGeometry(1.2, 1.5, 2.2, 8), 0x8a6a3a, P(0, 1.1, 3));
  boxCollider(x, z + 9, 26, 8, 0);
  boxCollider(x, z - 6, 20, 14, 0);
  addCollider({ t: 0, x, z: z + 3, r: 1.6 });
}
function buildDaan() {
  const [ax, az] = LANDMARKS.daanAmph;
  addStatic(new THREE.SphereGeometry(9, 16, 8, 0, Math.PI, 0, Math.PI / 2), 0xf6f4ef, M(ax, 0, az, 0, 0, 0, 1, 0.8, 1));
  addStatic(box(16, 1, 7), 0xd9d3c8, M(ax, 0.5, az - 3));
  boxCollider(ax, az + 2, 18, 10, 0);
  const [px, pz] = LANDMARKS.daanPond;
  addStatic(new THREE.CylinderGeometry(1, 1, 0.5, 24), 0xc9c2b4, M(px, 0.25, pz, 0, 0, 0, 13, 1, 9));
  addStatic(new THREE.CylinderGeometry(1, 1, 0.1, 24), 0x5fc7cf, M(px, 0.52, pz, 0, 0, 0, 12.2, 1, 8.2), { noShadow: true });
  boxCollider(px, pz, 24, 16, 0);
}
function buildSunYatSen() {
  const [x, z] = LANDMARKS.sunYatSen;
  const P = placer(x, z, 0);
  addStatic(box(34, 2, 26), 0xe6e1d8, P(0, 1, 0));
  addStatic(box(28, 9, 20), 0xf4f0e6, P(0, 6.5, 0));
  for (let i = 0; i <= 10; i++) addStatic(new THREE.CylinderGeometry(0.5, 0.5, 9, 8), 0xc9a86a, P(-14 + i * 2.8, 6.5, 10.8));
  addStatic(hipRoofGeo(37, 29, 3.2, 0.55), 0xe9b440, P(0, 11, 0), { flat: true });
  addStatic(box(18, 2.4, 12), 0xf4f0e6, P(0, 15.2, 0));
  addStatic(hipRoofGeo(24, 17, 3.6, 0.4), 0xe9b440, P(0, 16.4, 0), { flat: true });
  eaveHorns(P, 37, 29, 11, 0xe9b440);
  boxCollider(x, z, 34, 26, 0);
}
function buildArena() {
  const [x, z] = LANDMARKS.arena;
  addStatic(new THREE.CylinderGeometry(1, 1, 10, 28), 0xe8e9ec, M(x, 5, z, 0, 0, 0, 20, 1, 14));
  addStatic(new THREE.CylinderGeometry(1, 1, 1.4, 28), 0x3a7fd5, M(x, 8.6, z, 0, 0, 0, 20.3, 1, 14.3));
  addStatic(new THREE.SphereGeometry(1, 24, 8, 0, TAU, 0, Math.PI / 2), 0xcfd6dc, M(x, 10, z, 0, 0, 0, 20, 4, 14));
  boxCollider(x, z, 38, 26, 0);
}
function buildCityHall() {
  const [x, z] = LANDMARKS.cityHall;
  addStatic(windowBox(44, 14, 16, 3.2, 3.5), 0xc9c4b8, M(x, 7, z), { mat: 'city', uv: true });
  addStatic(windowBox(16, 14, 40, 3.2, 3.5), 0xc9c4b8, M(x, 7, z), { mat: 'city', uv: true });
  addStatic(box(18, 4, 18), 0xb8b2a6, M(x, 16, z));
  boxCollider(x, z, 44.4, 16.4, 0);
  boxCollider(x, z, 16.4, 40.4, 0);
}
function buildNTU() {
  const [gx, gz] = LANDMARKS.ntuGate;
  const brick = 0xb0603f, trim = 0xf1ece2;
  for (const sz of [-1, 1]) {
    addStatic(box(2.6, 6, 2.6), brick, M(gx, 3, gz + sz * 8.6));
    addStatic(box(3.4, 0.8, 3.4), trim, M(gx, 6.4, gz + sz * 8.6));
    addCollider({ t: 0, x: gx, z: gz + sz * 8.6, r: 1.8 });
  }
  const [lx, lz] = LANDMARKS.ntuLib;
  addStatic(windowBox(18, 11, 24, 3, 3.6), brick, M(lx, 5.5, lz), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(20, 26, 3, 0.5), 0x8a4a35, M(lx, 11, lz), { flat: true });
  addStatic(windowBox(7, 22, 7, 2.4, 3.6), brick, M(lx - 9.4, 11, lz), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(8, 8, 3, 0), 0x8a4a35, M(lx - 9.4, 22, lz), { flat: true });
  boxCollider(lx, lz, 18.4, 24.4, 0);
  boxCollider(lx - 9.4, lz, 7.4, 7.4, 0);
  for (const bx of [340, 378, 414]) for (const sz of [-1, 1]) {
    const bz = 570 + sz * 24;
    if (!footprintOK(bx, bz, 20, 12, 0, 6) && parkVal(bx, bz) < 0) continue;
    addStatic(windowBox(20, 9, 12, 3, 3.4), brick, M(bx, 4.5, bz), { mat: 'city', uv: true });
    addStatic(hipRoofGeo(22, 14, 2.6, 0.5), 0x8a4a35, M(bx, 9, bz), { flat: true });
    boxCollider(bx, bz, 20.4, 12.4, 0);
  }
}
function makePlaneGeo(stripe) {
  const gb = new GB();
  const [fg, fm] = cylBetween(-11, 0, 0, 11, 0, 0, 1.6, 1.5, 12);
  gb.add(fg, 0xf6f7f8, fm);
  const [ng, nm] = cylBetween(11, 0, 0, 14.5, 0, 0, 1.5, 0.3, 12);
  gb.add(ng, 0xf6f7f8, nm);
  gb.add(box(22, 0.5, 0.6), stripe, M(0, -0.2, 1.55));
  gb.add(box(22, 0.5, 0.6), stripe, M(0, -0.2, -1.55));
  gb.add(box(5, 0.35, 26), 0xe9ecef, M(1, -0.5, 0));
  gb.add(box(3.4, 5, 0.4), stripe, M(-10.5, 2.6, 0));
  gb.add(box(3, 0.3, 9), 0xe9ecef, M(-10.5, 0.4, 0));
  for (const sz of [-1, 1]) { const [eg, em] = cylBetween(-1, -1.5, sz * 5.5, 3, -1.5, sz * 5.5, 0.8, 0.8, 10); gb.add(eg, 0x9aa3ab, em); }
  return gb.build();
}
function buildAirport() {
  const A = PARKS.find((p) => p.airport);
  const corners = [[A.x0, A.z0], [A.x1, A.z0], [A.x1, A.z1], [A.x0, A.z1]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    addCollider({ t: 2, ax: a[0], az: a[1], bx: b[0], bz: b[1], r: 0.6 });
    const L = hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= L; s += 9) {
      const px = lerp(a[0], b[0], s / L), pz = lerp(a[1], b[1], s / L);
      if (landF(px, pz) < 2) continue;
      addStatic(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5), 0x7d868c, M(px, 1.3, pz));
    }
    const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    addStatic(box(0.08, 1.6, L), 0x9aa5ab, M((a[0] + b[0]) / 2, 1.6, (a[1] + b[1]) / 2, 0, ang, 0));
  }
  const [rx, rz] = LANDMARKS.runway;
  addStatic(box(320, 0.1, 18), 0x4a4f55, M(rx, 0.05, rz), { noShadow: true });
  for (let x = rx - 150; x <= rx + 150; x += 12) addStatic(box(6, 0.04, 0.6), 0xf4f4f0, M(x, 0.12, rz), { noShadow: true });
  for (const ex of [-1, 1]) for (let k = -3; k <= 3; k++) addStatic(box(6, 0.04, 1.0), 0xf4f4f0, M(rx + ex * 150, 0.12, rz + k * 2.2), { noShadow: true });
  addStatic(box(280, 0.08, 8), 0x575c62, M(rx - 10, 0.04, rz + 40), { noShadow: true });
  const [tx, tz] = LANDMARKS.terminal;
  addStatic(windowBox(64, 10, 18, 3.6, 3.4), 0xdfe7ec, M(tx, 5, tz), { mat: 'city', uv: true });
  addStatic(box(66, 0.8, 21), 0xf4f6f7, M(tx, 10.4, tz));
  boxCollider(tx, tz, 64.4, 18.4, 0);
  const [cx, cz] = LANDMARKS.tower;
  addStatic(new THREE.CylinderGeometry(2.2, 2.7, 26, 10), 0xf2f3f4, M(cx, 13, cz));
  addStatic(new THREE.CylinderGeometry(4.4, 3.4, 4, 10), 0x7fb0c8, M(cx, 28, cz));
  addStatic(new THREE.CylinderGeometry(4.8, 4.8, 0.6, 10), 0xe8e9ea, M(cx, 30.3, cz));
  addCollider({ t: 0, x: cx, z: cz, r: 3 });
  const pg = makePlaneGeo(0x3a7fd5), pg2 = makePlaneGeo(0x2f9e6b);
  for (const [px, pz, rot, g] of [[520, -340, Math.PI / 2, pg], [600, -342, Math.PI / 2, pg2]]) {
    const m = new THREE.Mesh(g, MAT.toon); m.castShadow = true;
    m.position.set(px, 2.6, pz); m.rotation.y = rot;
    sceneRef.add(m);
    boxCollider(px, pz, 26, 30, 0);
  }
  const fly = new THREE.Mesh(pg, MAT.toon); fly.castShadow = true;
  fly.position.set(rx - 160, 2.6, rz);
  sceneRef.add(fly);
  DYN.plane = fly;
}
function updatePlane(dt) {
  const p = DYN.plane;
  if (!p) return;
  DYN.planeT = (DYN.planeT + dt) % 46;
  const t = DYN.planeT;
  const [rx, rz] = LANDMARKS.runway;
  if (t < 8) { p.visible = true; p.position.set(rx - 155, 2.6, rz); p.rotation.set(0, 0, 0); }
  else if (t < 20) { const u = (t - 8) / 12; p.position.set(rx - 155 + u * u * 300, 2.6, rz); }
  else if (t < 32) { const u = (t - 20) / 12; p.position.set(rx + 145 + u * 280, 2.6 + u * u * 90, rz); p.rotation.z = Math.min(0.22, u * 0.6); }
  else p.visible = false;
}
function buildGrandHotel() {
  const [x, z] = LANDMARKS.grandHotel;
  const y0 = hillH(x, z) - 3;
  const red = 0xc0392b, roof = 0xe9a638;
  addStatic(windowBox(62, 16, 16, 3.2, 3.2), red, M(x, y0 + 8, z), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(68, 22, 5, 0.6), roof, M(x, y0 + 16, z), { flat: true });
  addStatic(windowBox(40, 10, 12, 3.2, 3.2), red, M(x, y0 + 23.5, z), { mat: 'city', uv: true });
  addStatic(hipRoofGeo(46, 17, 4.4, 0.55), roof, M(x, y0 + 28.5, z), { flat: true });
  for (const sx of [-1, 1]) {
    addStatic(windowBox(14, 12, 20, 3.2, 3.2), red, M(x + sx * 37, y0 + 6, z + 2), { mat: 'city', uv: true });
    addStatic(hipRoofGeo(18, 24, 4, 0.4), roof, M(x + sx * 37, y0 + 12, z + 2), { flat: true });
  }
}

// ---------- hospitals ----------
function placeHospital(H) {
  const pr = nearestOnRoads(H.anchor[0], H.anchor[1], (e) => !e.flags.ring && !e.flags.campus && !e.flags.alley);
  const [px, pz, tx, tz] = edgePoint(pr.e, pr.s);
  let nx = -tz, nz = tx;
  if (nx * H.dir[0] + nz * H.dir[1] < 0) { nx = -nx; nz = -nz; }
  const lv = H.level;
  const w = lv === 'severe' ? 40 : lv === 'moderate' ? 34 : 28;
  const d = lv === 'severe' ? 26 : 22;
  const h = lv === 'severe' ? 25.9 : lv === 'moderate' ? 19.6 : 13.2;
  const off = pr.e.hw + 7.5 + d / 2;
  const bx = px + nx * off, bz = pz + nz * off;
  const rot = Math.atan2(-nx, -nz);
  H.proj = { e: pr.e, s: pr.s, px, pz };
  H.drop = [px, pz];
  const P = placer(bx, bz, rot);
  addStatic(windowBox(w, h, d, 3.4, 3.25), 0xf7f4ee, P(0, h / 2, 0), { mat: 'city', uv: true });
  addStatic(box(w + 0.3, 2.2, d + 0.3), H.hex, P(0, 1.1, 0), { mat: 'city' });
  for (const [ww, dd, zz, xx] of [[w + 0.5, 0.5, d / 2, 0], [w + 0.5, 0.5, -d / 2, 0], [0.5, d + 0.5, 0, w / 2], [0.5, d + 0.5, 0, -w / 2]]) addStatic(box(ww, 1.2, dd), H.hex, P(xx, h + 0.6, zz), { mat: 'city' });
  addStatic(box(w - 0.6, 0.15, d - 0.6), 0xcfd2d0, P(0, h + 0.1, 0), { mat: 'city' });
  addStatic(box(16, 0.6, 7), 0xffffff, P(0, 4.4, d / 2 + 3.5), { mat: 'city' });
  addStatic(box(16.2, 0.5, 0.4), H.noER ? 0x4f6d8a : 0xd9312b, P(0, 4.4, d / 2 + 7.0), { mat: 'city' });
  for (const sx of [-1, 1]) {
    addStatic(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 8), 0xe8e8e8, P(sx * 7.4, 2.1, d / 2 + 6.4), { mat: 'city' });
    const [wx, wz] = localToWorld(bx, bz, rot, sx * 7.4, d / 2 + 6.4);
    addCollider({ t: 0, x: wx, z: wz, r: 0.45 });
  }
  addStatic(box(8, 3.2, 0.3), 0x8fd0ea, P(0, 2.0, d / 2 + 0.1), { mat: 'city' });
  // "急診" sign over the canopy and the hospital emblem on the facade
  // (a cancer hospital has no emergency entrance: its canopy says 門診, outpatients)
  const erTex = textTexture(256, 112, (g, W, Hh) => {
    g.fillStyle = H.noER ? '#4f6d8a' : '#d9312b'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#ffffff'; g.font = `76px ${FONT_CJK}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(H.noER ? '門診' : '急診', W / 2, Hh / 2 + 4);
  });
  const er = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.8), new THREE.MeshBasicMaterial({ map: erTex }));
  const [ex, ez] = localToWorld(bx, bz, rot, 0, d / 2 + 0.35);
  er.position.set(ex, 6.6, ez); er.rotation.y = rot;
  sceneRef.add(er);
  const emb = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: iconDiscTexture('cross', H.css), transparent: true }));
  const [mx, mz] = localToWorld(bx, bz, rot, w * 0.3, d / 2 + 0.2);
  emb.position.set(mx, h - 4.5, mz); emb.rotation.y = rot;
  sceneRef.add(emb);
  flatDecal(iconDiscTexture('cross', H.css), Math.min(w, d) * 0.55, ...(() => { const [a, b] = localToWorld(bx, bz, rot, -w * 0.2, 0); return [a, h + 0.22, b]; })(), rot);
  if (H.helipad) { const [a, b] = localToWorld(bx, bz, rot, w * 0.26, 0); flatDecal(helipadTexture(), d * 0.62, a, h + 0.22, b, rot); }
  boxCollider(bx, bz, w + 0.6, d + 0.6, rot);
  const [sx0, sz0] = localToWorld(bx, bz, rot, 0, d / 2 + 0.6);
  H.signPos = [sx0, 0, sz0];
  H.top = [bx, h + 9, bz];
  H.bld = { x: bx, z: bz, w, d, rot, h };
  BUILDINGS.push({ x: bx, z: bz, w, d, rot, h, hosp: H });
}

// ---------- ambulance stations (dispatch mode) ----------
function placeStation(S) {
  const pr = nearestOnRoads(S.anchor[0], S.anchor[1], (e) => !e.flags.ring && !e.flags.campus && !e.flags.alley);
  const [px, pz, tx, tz] = edgePoint(pr.e, pr.s);
  let nx = -tz, nz = tx;
  if (nx * S.dir[0] + nz * S.dir[1] < 0) { nx = -nx; nz = -nz; }
  const w = 22, d = 14, h = 9.9;
  const off = pr.e.hw + 6.2 + d / 2;
  const bx = px + nx * off, bz = pz + nz * off, rot = Math.atan2(-nx, -nz);
  S.proj = { e: pr.e, s: pr.s, px, pz };
  // parked on the apron in front of the garage, between the sidewalk and the doors
  S.park = { x: px + nx * (pr.e.hw + 5.0), z: pz + nz * (pr.e.hw + 5.0), h: Math.atan2(tx, tz) };
  S.pos = [bx, bz];
  const P = placer(bx, bz, rot);
  addStatic(windowBox(w, h, d, 3.4, 3.3), 0xf4f1ea, P(0, h / 2, 0), { mat: 'city', uv: true });
  // red parapet around a pale roof with "119" painted on it, so stations read clearly from above
  for (const sz of [-1, 1]) addStatic(box(w + 0.4, 1.3, 0.6), 0xd9312b, P(0, h + 0.15, sz * (d / 2 - 0.1)), { mat: 'city' });
  for (const sx of [-1, 1]) addStatic(box(0.6, 1.3, d + 0.4), 0xd9312b, P(sx * (w / 2 - 0.1), h + 0.15, 0), { mat: 'city' });
  addStatic(box(w + 0.34, 0.55, d + 0.34), 0xd9312b, P(0, 5.1, 0), { mat: 'city' });
  flatDecal(textTexture(256, 256, (g) => {
    g.strokeStyle = '#d9312b'; g.lineWidth = 12; roundRect(g, 14, 14, 228, 228, 34); g.stroke();
    g.fillStyle = '#d9312b'; g.font = `700 112px ${FONT_NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('119', 128, 138);
  }), d * 0.66, bx, h + 0.02, bz, rot);
  for (const sx of [-1, 1]) {
    addStatic(box(7.6, 4.4, 0.3), 0xc3cbd0, P(sx * 5, 2.2, d / 2 + 0.1), { mat: 'city' });
    for (let k = 0; k < 4; k++) addStatic(box(7.6, 0.12, 0.34), 0x9aa3a9, P(sx * 5, 0.8 + k * 1.05, d / 2 + 0.1), { mat: 'city', noShadow: true });
  }
  addStatic(box(w + 4, 0.08, 6), 0xbfc4c6, P(0, 0.04, d / 2 + 3), { noShadow: true });
  const tex = textTexture(512, 104, (g, W, Hh) => {
    g.fillStyle = '#d9312b'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#ffffff'; g.font = `60px ${FONT_CJK}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${S.name}救護站`, W / 2, Hh / 2 + 4);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.05), new THREE.MeshBasicMaterial({ map: tex }));
  const [sx0, sz0] = localToWorld(bx, bz, rot, 0, d / 2 + 0.36);
  sign.position.set(sx0, 6.6, sz0); sign.rotation.y = rot;
  sceneRef.add(sign);
  boxCollider(bx, bz, w + 0.6, d + 0.6, rot);
  BUILDINGS.push({ x: bx, z: bz, w, d, rot, h, station: S });
}

// ---------- humps, street furniture, road markings ----------
function rampHeightLocal(r, u) {
  if (!r.hump) return r.h * clamp(u / r.len, 0, 1);
  const a = r.len * 0.42;
  return u < a ? r.h * (u / a) : r.h * (1 - (u - a) / (r.len - a));
}
function addRampShape(r) {
  RAMP_SHAPES.push(r);
  const rot = Math.atan2(r.ux, r.uz);
  const P = placer(r.x, r.z, rot);
  const L = r.len, W = r.hw * 2 - 0.6, n = 10;
  for (let i = 0; i < n; i++) {
    const u0 = (i / n) * L, u1 = ((i + 1) / n) * L;
    const h0 = rampHeightLocal(r, u0), h1 = rampHeightLocal(r, u1);
    const seg = Math.hypot(u1 - u0, h1 - h0), ang = Math.atan2(h1 - h0, u1 - u0);
    const cols = r.cols || [0xd9473d, 0xf4f0e6];
    addStatic(box(W, 0.28, seg + 0.05), i % 2 ? cols[1] : cols[0], P(0, (h0 + h1) / 2 - 0.12, -L / 2 + (u0 + u1) / 2, -ang, 0, 0));
  }
}
function setupHumps() {
  for (const [hx, hz] of HUMP_SPOTS) {
    const pr = nearestOnRoads(hx, hz, (e) => !e.flags.ring && !e.flags.campus && !e.flags.alley && e.len > 40);
    const s = clamp(pr.s, 20, pr.e.len - 20);
    const [x, z, tx, tz] = edgePoint(pr.e, s);
    addRampShape({ x, z, ux: tx, uz: tz, len: 15, hw: pr.e.hw, h: 1.9, hump: true });
  }
}
function nodeMaxHw(id) { let m = 0; for (const o of nodeEdges[id] || []) m = Math.max(m, o.e.hw); return m; }
function buildStreetFurniture() {
  // lamps and bus stops along roads
  for (const e of edges) {
    if (e.flags.ring || e.flags.campus || e.flags.alley) continue;
    const padA = nodeMaxHw(e.a) + 6, padB = nodeMaxHw(e.b) + 6;
    let side = 1, bus = rand(40, 120);
    for (let s = padA; s < e.len - padB; s += 30) {
      const [px, pz, tx, tz] = edgePoint(e, s);
      const x = px - tz * side * (e.hw + 1.1), z = pz + tx * side * (e.hw + 1.1);
      if (roadDist(x, z) > 0.4 && landF(x, z) > 6 && alleyDist(x, z) > 1.5 && !blockedAt(x, z, 1.2) && plazaVal(x, z) < -2) {
        const rot = Math.atan2(tx, tz);
        addStatic(new THREE.CylinderGeometry(0.14, 0.2, 6.4, 6), 0x5d6670, M(x, 3.2, z));
        const lp = { mat: 'sig', piv: [x + tz * side * 2.0, 6.15, z - tx * side * 2.0] }; // arm and lamp go together
        addStatic(box(0.25, 0.22, 2.2), 0x5d6670, M(x + tz * side * 1.0, 6.3, z - tx * side * 1.0, 0, rot + Math.PI / 2, 0), lp);
        addStatic(box(0.7, 0.3, 0.9), 0xfff1c2, M(x + tz * side * 2.0, 6.15, z - tx * side * 2.0, 0, rot, 0), lp);
        LAMPS.push([x + tz * side * 2.0, 6.15, z - tx * side * 2.0]);
        addCollider({ t: 0, x, z, r: 0.35 });
      }
      side = -side;
      if (e.hw >= 7 && s > bus && s > padA + 20 && s < e.len - padB - 20) {
        bus = s + rand(150, 240);
        const sd = rng() < 0.5 ? 1 : -1;
        const bxp = px - tz * sd * (e.hw + 3.2), bzp = pz + tx * sd * (e.hw + 3.2);
        if (roadDist(bxp, bzp) > 2.2 && alleyDist(bxp, bzp) > 5 && !blockedAt(bxp, bzp, 3)) {
          const rot = Math.atan2(-(-tz * sd), -(tx * sd));
          const P = placer(bxp, bzp, rot);
          addStatic(box(5.4, 0.25, 2.2), 0x7d9fb8, P(0, 3.0, 0.2));
          addStatic(box(5.2, 2.6, 0.12), 0xbfd8e6, P(0, 1.5, -0.8));
          addStatic(box(4, 0.4, 0.8), 0x8a6a4a, P(0, 0.6, -0.3));
          for (const ex of [-1, 1]) addStatic(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), 0x5d6670, P(ex * 2.5, 1.5, -0.8));
          addStatic(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 5), 0x5d6670, P(2.9, 1.7, 1.2));
          addStatic(atlasQuad(1.5, 0.75, STREET.plate, STREET.plateK.bus), 0xffffff, P(2.9, 3.3, 1.26), { mat: 'plate', uv: true, noShadow: true });
          boxCollider(bxp, bzp, 5.6, 2.6, rot);
          // its painted bay on the kerb lane
          const cx = px - tz * sd * (e.hw - 1.4), cz = pz + tx * sd * (e.hw - 1.4);
          BUS_BAYS.push({ x: cx, z: cz, tx, tz, nx: tz * sd, nz: -tx * sd, ux: tx * sd, uz: tz * sd, ang: Math.atan2(tx, tz) });
        }
      }
    }
  }
  // planted medians on boulevards
  for (const e of edges) {
    if (!e.flags.blvd) continue;
    const padA = nodeMaxHw(e.a) + 5, padB = nodeMaxHw(e.b) + 5;
    for (let k = 0; k < e.pts.length - 1; k++) {
      if (e.cum[k] < padA || e.cum[k + 1] > e.len - padB) continue;
      const a = e.pts[k], b = e.pts[k + 1];
      const L = hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
      addStatic(box(2.6, 0.34, L + 0.05), 0xd6d3cc, M((a[0] + b[0]) / 2, 0.17, (a[1] + b[1]) / 2, 0, ang, 0), { noShadow: true });
      addStatic(box(2.0, 0.08, L + 0.05), 0x6aa84f, M((a[0] + b[0]) / 2, 0.36, (a[1] + b[1]) / 2, 0, ang, 0), { noShadow: true });
    }
  }
}
// ---------- traffic signals ----------
// Every junction of three or more streets gets a two-phase signal: the streets lined up with the
// widest road share one phase, the cross streets the other. Cars stop at the line on red, and
// pedestrians cross a street while its cars have red.
const SIGNALS = new Map(); // node id -> { x, z, hw, groups: Map(edge idx -> 0|1), offset, heads, ph }
const SIG_G = 9, SIG_Y = 2.2, SIG_AR = 1.3, SIG_C = 2 * (SIG_G + SIG_Y + SIG_AR);
let sigClock = 0;
function sigTime(sig, g) { const t = (sigClock + sig.offset) % SIG_C; return g === 1 ? (t + SIG_C / 2) % SIG_C : t; }
function sigPhase(sig, g) { const t = sigTime(sig, g); return t < SIG_G ? 'G' : t < SIG_G + SIG_Y ? 'Y' : 'R'; }
function sigRedLeft(sig, g) { const t = sigTime(sig, g); return t < SIG_G + SIG_Y ? 0 : SIG_C - t; }
const LAMP_COL = { R: 0xff3b30, Y: 0xffc21a, G: 0x34d36a };
const LAMP_X = { R: -1.0, Y: 0, G: 1.0 };
let lampMesh = null;
const lampHeads = [];
let SIG_GEO = null;
function buildSignals(scene) {
  SIG_GEO = { pole: new THREE.CylinderGeometry(0.17, 0.21, 6.9, 6), arm: box(0.22, 0.22, 6), head: box(3.1, 1.0, 0.6), visor: box(3.3, 0.14, 0.8), lamp: new THREE.CylinderGeometry(0.36, 0.36, 0.12, 10) };
  for (const n of graphNodes) {
    const list = nodeEdges[n.id] || [];
    if (list.length < 3 || list.some((o) => o.e.flags.ring) || isMouth(n.id)) continue;
    const hwN = nodeMaxHw(n.id);
    const ang = list.map(({ e, dir }) => { const q = edgePoint(e, dir === 1 ? Math.min(e.len, 8) : Math.max(0, e.len - 8)); return Math.atan2(q[0] - n.x, q[1] - n.z); });
    let k0 = 0;
    list.forEach((o, i) => { if (o.e.hw > list[k0].e.hw) k0 = i; });
    const groups = new Map();
    list.forEach((o, i) => { let d = Math.abs(angDiff(ang[k0], ang[i])); d = Math.min(d, Math.PI - d); groups.set(o.e.idx, d < Math.PI / 4 ? 0 : 1); });
    const sig = { id: n.id, x: n.x, z: n.z, hw: hwN, groups, offset: rand(0, SIG_C), heads: [], ph: ['', ''] };
    SIGNALS.set(n.id, sig);
    // one horizontal signal head per approach, on a pole at the right-hand kerb with an arm over the lanes
    for (const { e, dir } of list) {
      if (e.len < hwN + 14 || e.flags.alley) continue;
      const s0 = dir === 1 ? hwN + 3.6 : e.len - hwN - 3.6;
      const [px, pz, tx, tz] = edgePoint(e, s0);
      const ux = dir === 1 ? -tx : tx, uz = dir === 1 ? -tz : tz; // travel direction into the junction
      const rx = -uz, rz = ux;                                     // driver's right
      const ox = px + rx * (e.hw + 1.3), oz = pz + rz * (e.hw + 1.3);
      if (landF(ox, oz) < 4) continue;
      const arm = Math.min(e.hw * 0.72, 6);
      addStatic(SIG_GEO.pole, 0x4a5058, M(ox, 3.45, oz));
      const hx = ox - rx * arm, hz = oz - rz * arm, face = Math.atan2(-ux, -uz);
      const P = placer(hx, hz, face, 6.25);
      // arm, head and lamps over the lanes vanish together in the chase views (MAT.sig, pivot = the head)
      const sp = { mat: 'sig', piv: [hx, 6.25, hz] };
      addStatic(SIG_GEO.arm, 0x4a5058, M(ox - rx * arm / 2, 6.75, oz - rz * arm / 2, 0, Math.atan2(rx, rz), 0, 1, 1, (arm + 0.3) / 6), sp);
      addStatic(SIG_GEO.head, 0x2b2f35, P(0, 0, 0), sp);
      addStatic(SIG_GEO.visor, 0x2b2f35, P(0, 0.56, 0.14), sp);
      for (const k of ['R', 'Y', 'G']) addStatic(SIG_GEO.lamp, 0x474c54, P(LAMP_X[k], 0, 0.3, Math.PI / 2, 0, 0), sp);
      addCollider({ t: 0, x: ox, z: oz, r: 0.35 });
      const head = { g: groups.get(e.idx), x: hx, z: hz, face, i: lampHeads.length };
      sig.heads.push(head);
      lampHeads.push(head);
    }
  }
  const g = new THREE.SphereGeometry(0.5, 12, 8);
  // the lit lamp vanishes with its head: same pivot, one per instance
  const piv = new Float32Array(Math.max(1, lampHeads.length) * 3);
  lampHeads.forEach((hd, i) => { piv[i * 3] = hd.x; piv[i * 3 + 1] = 6.25; piv[i * 3 + 2] = hd.z; });
  g.setAttribute('aPiv', new THREE.InstancedBufferAttribute(piv, 3));
  lampMesh = new THREE.InstancedMesh(g, addCut(new THREE.MeshBasicMaterial({ color: 0xffffff }), 'lampcut'), Math.max(1, lampHeads.length));
  lampMesh.frustumCulled = false;
  lampMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const hd of lampHeads) { lampMesh.setMatrixAt(hd.i, _m4.makeScale(0, 0, 0)); lampMesh.setColorAt(hd.i, _col.set(0xffffff)); }
  scene.add(lampMesh);
}
const _lampM = new THREE.Matrix4();
function updateSignalLamps() {
  if (!lampMesh) return;
  let dirty = false;
  for (const sig of SIGNALS.values()) for (let g = 0; g < 2; g++) {
    const ph = sigPhase(sig, g);
    if (sig.ph[g] === ph) continue;
    sig.ph[g] = ph;
    for (const hd of sig.heads) {
      if (hd.g !== g) continue;
      const c = Math.cos(hd.face), sn = Math.sin(hd.face), lx = LAMP_X[ph], lz = 0.22;
      _lampM.makeRotationY(hd.face).setPosition(hd.x + lx * c + lz * sn, 6.3, hd.z - lx * sn + lz * c);
      lampMesh.setMatrixAt(hd.i, _lampM);
      lampMesh.setColorAt(hd.i, _col.set(LAMP_COL[ph]));
      dirty = true;
    }
  }
  if (dirty) { lampMesh.instanceMatrix.needsUpdate = true; lampMesh.instanceColor.needsUpdate = true; }
}
function buildRoadMarkings(scene) {
  const items = [];
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  quad.setAttribute('color', new THREE.Float32BufferAttribute(new Array(quad.attributes.position.count * 3).fill(1), 3));
  const WHITE = 0xf6f5f0, YEL = 0xf2c24a, RED = 0xd8473d;
  const put = (x, z, ang, w, l, col) => {
    const by = bridgeY(x, z);
    if (by < -50) { items.push({ x, y: 0.04, z, ry: ang, sx: w, sz: l, color: col }); return; }
    // on a bridge deck: up on the asphalt, tilted with the ramp
    const tx = Math.sin(ang), tz = Math.cos(ang), ya = bridgeY(x + tx, z + tz), yb = bridgeY(x - tx, z - tz);
    const slope = ya > -50 && yb > -50 ? (ya - yb) / 2 : 0;
    items.push({ x, y: by + 0.06, z, rx: -Math.atan(slope), ry: ang, ord: 'YXZ', sx: w, sz: l, color: col });
  };
  for (const e of edges) {
    if (e.flags.campus || e.flags.alley) continue;
    // lane lines run straight past an alley mouth
    const padA = isMouth(e.a) ? 0.5 : nodeMaxHw(e.a) + 4.5, padB = isMouth(e.b) ? 0.5 : nodeMaxHw(e.b) + 4.5;
    const lanes = e.flags.blvd ? [e.hw * 0.55, -e.hw * 0.55] : e.hw >= 7 ? [e.hw * 0.5, -e.hw * 0.5] : e.flags.ring ? [] : [0];
    for (let s = padA; s < e.len - padB; s += 7) {
      const [px, pz, tx, tz] = edgePoint(e, s + 1.5);
      const ang = Math.atan2(tx, tz);
      for (const off of lanes) put(px - tz * off, pz + tx * off, ang, 0.32, 3, WHITE);
    }
    if (!e.flags.blvd && !e.flags.ring && e.hw >= 7) {
      for (let s = padA; s < e.len - padB; s += 3) {
        const [px, pz, tx, tz] = edgePoint(e, s + 1.5);
        const ang = Math.atan2(tx, tz);
        for (const off of [0.25, -0.25]) put(px - tz * off, pz + tx * off, ang, 0.16, 3.05, YEL);
      }
    }
    // red kerb lines: no stopping along the main streets (broken where an alley opens off)
    if (!e.flags.ring && e.hw >= 6) {
      const pa = nodeMaxHw(e.a) + 1, pb = nodeMaxHw(e.b) + 1;
      for (let s = pa; s < e.len - pb; s += 3) {
        const [px, pz, tx, tz] = edgePoint(e, s + 1.5);
        const ang = Math.atan2(tx, tz);
        for (const sd of [1, -1]) {
          const off = (e.hw - 0.4) * sd, x = px - tz * off, z = pz + tx * off;
          if (alleyDist(x, z) > 0.8 && !BUS_BAYS.some((b) => hypot(b.x - x, b.z - z) < 8)) put(x, z, ang, 0.2, 3.05, RED);
        }
      }
    }
  }
  // 公車專用道: the median bus lanes of the big arterials, a solid line each side and 公車專用 painted in them
  for (const e of edges) {
    if (!BUS_LANE_ROADS.has(e.name) || e.hw < 7 || e.flags.blvd || e.len < 40) continue;
    if (edgePoint(e, e.len / 2)[1] < -470) continue;
    const padA = nodeMaxHw(e.a) + 4.5, padB = nodeMaxHw(e.b) + 4.5, lo = e.hw * 0.32;
    for (let s = padA; s < e.len - padB; s += 3) {
      const [px, pz, tx, tz] = edgePoint(e, s + 1.5);
      const ang = Math.atan2(tx, tz);
      for (const off of [lo, -lo]) put(px - tz * off, pz + tx * off, ang, 0.2, 3.05, WHITE);
    }
    for (let s = padA + 10; s < e.len - padB - 6; s += 46) {
      for (const sd of [1, -1]) {
        const [px, pz, tx, tz] = edgePoint(e, sd > 0 ? s : e.len - s);
        const off = e.hw * 0.17 * sd;
        const fx = tx * sd, fz = tz * sd;
        addStatic(atlasQuad(6.6, e.hw * 0.27, STREET.plate, STREET.plateK.rBusL, true, 2), 0xffffff, M(px - tz * off, 0.05, pz + tx * off, 0, Math.atan2(fz, -fx), 0), { mat: 'plate', uv: true, noShadow: true });
      }
    }
  }
  // the yellow bus bays in front of the bus stops, with 公車 painted in them
  for (const b of BUS_BAYS) {
    for (const o of [-1, 1]) put(b.x + b.tx * o * 6.5, b.z + b.tz * o * 6.5, b.ang + Math.PI / 2, 0.22, 2.6, YEL);
    for (const o of [0, 2.6]) put(b.x + b.nx * (o - 1.3), b.z + b.nz * (o - 1.3), b.ang, 0.22, 13.2, YEL);
    addStatic(atlasQuad(3.2, 1.6, STREET.plate, STREET.plateK.rBus, true), 0xffffff, M(b.x, 0.05, b.z, 0, Math.atan2(-b.ux, -b.uz), 0), { mat: 'plate', uv: true, noShadow: true });
  }
  // at the signals: the car stop line, and ahead of it the 機車停等區 box where the scooters gather on red
  for (const sig of SIGNALS.values()) {
    for (const { e, dir } of nodeEdges[sig.id] || []) {
      if (e.len < sig.hw + 14 || e.flags.alley) continue;
      const at = (d) => { const s = dir === 1 ? sig.hw + d : e.len - sig.hw - d; return edgePoint(e, s); };
      const [px, pz, tx, tz] = at(STOP_CAR - 0.3);
      const ux = dir === 1 ? -tx : tx, uz = dir === 1 ? -tz : tz;
      const rx = -uz, rz = ux, mid = e.hw / 2;
      put(px + rx * mid, pz + rz * mid, Math.atan2(rx, rz), 0.55, e.hw - 0.6, WHITE);
      const [qx, qz] = at(STOP_SCOOT - 0.3);
      put(qx + rx * mid, qz + rz * mid, Math.atan2(rx, rz), 0.3, e.hw - 0.6, WHITE);
      const [bx, bz] = at((STOP_CAR + STOP_SCOOT) / 2 - 0.3);
      for (const o of [0.35, e.hw - 0.3]) put(bx + rx * o, bz + rz * o, Math.atan2(ux, uz), 0.22, STOP_CAR - STOP_SCOOT, WHITE);
      if (e.hw >= 6) addStatic(atlasQuad(Math.min(4.6, e.hw - 1.2), 2.3, STREET.plate, STREET.plateK.rBox, true), 0xffffff, M(bx + rx * mid, 0.05, bz + rz * mid, 0, Math.atan2(-ux, -uz), 0), { mat: 'plate', uv: true, noShadow: true });
      // lane arrows a little way back
      if (e.len > sig.hw + 34) {
        const [ax, az] = at(STOP_CAR + 9);
        const lanes = e.hw >= 7 ? [e.hw * 0.25, e.hw * 0.75] : [e.hw * 0.5];
        lanes.forEach((o, i) => addStatic(i === lanes.length - 1 && lanes.length > 1 ? ARROW_GEO.sr : ARROW_GEO.s, WHITE, M(ax + rx * o, 0.045, az + rz * o, 0, Math.atan2(-ux, -uz), 0), { mat: 'decal', noShadow: true }));
      }
    }
  }
  // zebra crossings at junctions
  for (const n of graphNodes) {
    const list = nodeEdges[n.id] || [];
    if (list.length < 3 || isMouth(n.id)) continue;
    const hwN = nodeMaxHw(n.id);
    for (const { e, dir } of list) {
      if (e.flags.ring || e.flags.campus || e.flags.alley || e.len < hwN + 10) continue;
      const s = dir === 1 ? hwN + 2.6 : e.len - hwN - 2.6;
      const [px, pz, tx, tz] = edgePoint(e, s);
      const ang = Math.atan2(tx, tz);
      for (let o = -e.hw + 1; o <= e.hw - 1; o += 1.7) put(px - tz * o, pz + tx * o, ang, 0.85, 3.4, WHITE);
    }
  }
  addInstanced(scene, quad, MAT.decal, items, { cast: false });
}

// ---------- assemble the city ----------
function buildCity(scene) {
  sceneRef = scene;
  build101(); buildCKS(); buildPresidential(); buildEastGate(); buildStation(); buildNorthGate(); build228();
  buildRedHouse(); buildLongshan(); buildDaan(); buildSunYatSen(); buildArena(); buildCityHall(); buildNTU(); buildAirport(); buildGrandHotel();
  initStreetMaterials();
  buildShilin(scene);
  for (const H of HOSPITALS) placeHospital(H);
  for (const S of STATIONS) placeStation(S);
  buildBridges();
  // hills block driving at their base
  for (const hl of HILLS) {
    const pts = [];
    for (let k = 0; k <= 28; k++) { const a = (k / 28) * TAU; pts.push([hl.x + Math.cos(a) * hl.rx * 0.8, hl.z + Math.sin(a) * hl.rz * 0.8]); }
    for (let k = 0; k < 28; k++) addCollider({ t: 2, ax: pts[k][0], az: pts[k][1], bx: pts[k + 1][0], bz: pts[k + 1][1], r: 2 });
  }
  // invisible world edge
  const E = [[WX0 + 12, WZ0 + 12], [WX0 + WXS - 12, WZ0 + 12], [WX0 + WXS - 12, WZ0 + WZS - 12], [WX0 + 12, WZ0 + WZS - 12]];
  for (let k = 0; k < 4; k++) addCollider({ t: 2, ax: E[k][0], az: E[k][1], bx: E[(k + 1) % 4][0], bz: E[(k + 1) % 4][1], r: 2 });
  setupHumps();
  buildAlleyDetails();
  buildStreetFurniture();
  buildSidewalkStuff();
  buildSignals(scene);
  buildSites();
  generateBuildings();
  fillGaps('small');
  scatterCity();
  buildRoadMarkings(scene);
}

// ===================== utilities =====================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
const hypot = Math.hypot;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(20261015);
const rand = (a = 0, b = 1) => a + (b - a) * rng();
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const grand = (a = 0, b = 1) => a + (b - a) * Math.random();      // gameplay randomness
const gpick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// gameplay pick weighted by wf(item)
function gwpick(arr, wf) {
  let s = 0;
  for (const a of arr) s += Math.max(0, wf(a));
  let r = Math.random() * s;
  for (const a of arr) { r -= Math.max(0, wf(a)); if (r <= 0) return a; }
  return arr[arr.length - 1];
}

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
function fbm(x, z, oct = 3) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}

// Catmull-Rom through points [[x,z],...], sampled roughly every `step` units
function catmull(pts, closed, step) {
  const out = [];
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const len = hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}
function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}
function segClosest(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + dx * t, az + dz * t, t];
}
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ===================== icons =====================
const ICON_PATHS = {
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  reset: 'M12 4a8 8 0 1 1-7.6 5.5l2.3.8A5.6 5.6 0 1 0 12 6.4V9L7.5 5.2 12 1.4z',
  heart: 'M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 3 4.4 6.8 4.4c2.1 0 3.6 1.2 5.2 3.2 1.6-2 3.1-3.2 5.2-3.2 3.8 0 6 3.9 4.5 7.4-2.1 4.7-9.7 9.4-9.7 9.4z',
  star: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z',
  person: 'M12 3.2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2zM4.6 20.8c.4-4.6 3.5-8 7.4-8s7 3.4 7.4 8z',
  brain: 'M9 3.4a3 3 0 0 0-3 2.6A3.2 3.2 0 0 0 3.4 9.5a3 3 0 0 0 .7 4.9A3.2 3.2 0 0 0 7 19.2a3 3 0 0 0 4.2 1.5V4.4A3 3 0 0 0 9 3.4zm6 0a3 3 0 0 1 3 2.6 3.2 3.2 0 0 1 2.6 3.5 3 3 0 0 1-.7 4.9 3.2 3.2 0 0 1-2.9 4.8 3 3 0 0 1-4.2 1.5V4.4A3 3 0 0 1 15 3.4z',
  flame: 'M12 2c1 3.5 6 6 6 11.5a6 6 0 0 1-12 0c0-2.6 1.2-4.4 2.6-5.8.2 2 1 3.2 2.4 3.8C10.4 7.5 11 4.8 12 2z',
  kid: 'M12 2.6a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7.6 21v-5.4L5.5 12.9a1.25 1.25 0 0 1 2.1-1.4l1.7 2.3h5.4l1.7-2.3a1.25 1.25 0 0 1 2.1 1.4l-2.1 2.7V21h-2.7v-4h-2.4v4z',
  bottle: 'M10 2h4v2.2l1.4 1.6V7.2H8.6V5.8L10 4.2zM8.4 8.4h7.2v11.4A2.2 2.2 0 0 1 13.4 22h-2.8a2.2 2.2 0 0 1-2.2-2.2z',
  cpr: 'M12 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM4 21l3.2-7.4c.4-.9 1.2-1.4 2.2-1.4h5.2c1 0 1.8.5 2.2 1.4L20 21h-3l-2.2-5.2V21H9.2v-5.2L7 21z',
  light: 'M8.5 1.5h7a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2H13v4.5h-2V18H8.5a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2zM12 3.4a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zm0 4.9a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zm0 4.9a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z',
  siren: 'M7 17.5v-5a5 5 0 0 1 10 0v5zM4.5 17.5h15v3.2h-15zM11 1.6h2v3.2h-2zM3.6 5.7l1.4-1.4 2.3 2.3-1.4 1.4zM20.4 5.7L19 4.3l-2.3 2.3 1.4 1.4z',
  phone: 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
  station: 'M12 2.5l9 6.2V21h-6.5v-6.2h-5V21H3V8.7zM10.2 8h3.6v2.2H16v3.6h-2.2V16h-3.6v-2.2H8v-3.6h2.2z',
  bolt: 'M13.5 2 4.5 13.6h6.2L9.6 22l9.6-12.4h-6.3z',
  wave: 'M2 10.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v3.2c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2zm0 6c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v3.2c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2z',
  pin: 'M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.1a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8z',
  car: 'M5.2 10.6l1.5-3.9A2 2 0 0 1 8.6 5.4h6.8a2 2 0 0 1 1.9 1.3l1.5 3.9h.7a1.5 1.5 0 0 1 1.5 1.5V17h-2v1.6a1.4 1.4 0 0 1-2.8 0V17H7.8v1.6a1.4 1.4 0 0 1-2.8 0V17H3v-4.9a1.5 1.5 0 0 1 1.5-1.5zm2.5-.4h8.6l-1-2.8H8.7z',
  bowl: 'M12 2.2c1.5 0 2.3 1.2 2.3 2.7 0 1.3-.7 2.1-.7 3.1 0 .8 2.6 2.6 2.6 6.6 0 3.6-1.7 6.5-4.2 7.8-2.5-1.3-4.2-4.2-4.2-7.8 0-4 2.6-5.8 2.6-6.6 0-1-.7-1.8-.7-3.1 0-1.5.8-2.7 2.3-2.7z',
  gavel: 'M13.6 2.6l7.8 7.8-2.3 2.3-1.2-1.2-3.4 3.4 1.2 1.2-2.3 2.3-7.8-7.8 2.3-2.3 1.2 1.2 3.4-3.4-1.2-1.2zM2.6 19.3l6.2-6.2 2.1 2.1-6.2 6.2z',
  medal: 'M7 2h4l1 3.2L13 2h4l-3.2 7.4a6.5 6.5 0 1 1-3.6 0zm5 9.2a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z',
  sun: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM11 1h2v3.4h-2zM11 19.6h2V23h-2zM1 11h3.4v2H1zM19.6 11H23v2h-3.4zM4.2 5.6l1.4-1.4 2.4 2.4-1.4 1.4zM16 17.4l1.4-1.4 2.4 2.4-1.4 1.4zM4.2 18.4l2.4-2.4 1.4 1.4-2.4 2.4zM16 6.6l2.4-2.4 1.4 1.4-2.4 2.4z',
  rain: 'M6.5 15A4.5 4.5 0 0 1 6 6.1 6 6 0 0 1 17.6 7.4 3.8 3.8 0 0 1 18 15zM7.2 17.2l1.6.8-1.6 3.6-1.6-.8zM11.6 17.2l1.6.8-1.6 3.6-1.6-.8zM16 17.2l1.6.8-1.6 3.6-1.6-.8z',
  moon: 'M14.6 2.4A9.6 9.6 0 1 0 21.6 15 7.6 7.6 0 0 1 14.6 2.4z',
  wind: 'M2 8.2h11.5a2.6 2.6 0 1 0-2.5-3.3l-2-.5A4.6 4.6 0 1 1 13.5 10.2H2zM2 12.4h16a3.2 3.2 0 1 1-3 4.3l1.9-.7a1.2 1.2 0 1 0 1.1-1.6H2zM2 16.4h7.5v2H2z',
  cone: 'M10.4 2h3.2l1.3 5H9.1zM8.6 9h6.8l1 4H7.6zM7.1 15h9.8l1.1 4.4H21V22H3v-2.6h3z',
  wrench: 'M21.5 6.4a5.6 5.6 0 0 1-7.3 6.3L6.4 20.5a2.4 2.4 0 0 1-3.4-3.4l7.8-7.8a5.6 5.6 0 0 1 6.3-7.3l-3.4 3.4.6 2.9 2.9.6z',
};
const EVENODD_ICONS = new Set(['light', 'station', 'pin', 'car', 'medal']);
const CAP_ICON = { trauma: 'bone', stroke: 'brain', heart: 'heart', burn: 'flame', kids: 'kid', ob: 'bottle', er: 'cross' };
function iconSVG(kind, color, size) {
  const s = size || 22;
  if (kind === 'bone') {
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><g transform="rotate(-38 12 12)" fill="${color}"><rect x="6" y="10" width="12" height="4" rx="1"/><circle cx="6" cy="9.6" r="2.7"/><circle cx="6" cy="14.4" r="2.7"/><circle cx="18" cy="9.6" r="2.7"/><circle cx="18" cy="14.4" r="2.7"/></g></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${ICON_PATHS[kind]}" fill="${color}"${EVENODD_ICONS.has(kind) ? ' fill-rule="evenodd"' : ''}/></svg>`;
}
// draw icon into a 2D canvas context, centred at (cx,cy), fitting `size`
function drawIcon(ctx, kind, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  if (kind === 'bone') {
    ctx.translate(12, 12); ctx.rotate(-38 * Math.PI / 180); ctx.translate(-12, -12);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(6, 10, 12, 4, 1); else ctx.rect(6, 10, 12, 4);
    ctx.fill();
    for (const [x, y] of [[6, 9.6], [6, 14.4], [18, 9.6], [18, 14.4]]) { ctx.beginPath(); ctx.arc(x, y, 2.7, 0, TAU); ctx.fill(); }
  } else {
    ctx.fill(new Path2D(ICON_PATHS[kind]), EVENODD_ICONS.has(kind) ? 'evenodd' : 'nonzero');
  }
  ctx.restore();
}
const $ = (id) => document.getElementById(id);

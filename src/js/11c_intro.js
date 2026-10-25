// ===================== opening: a 119 call, seen from the driver's seat =====================
// After loading, the player sits in the cab of 信義 94 at its station. One tap and the radio calls it out: the siren
// starts, the ambulance pulls into Xinyi Road traffic toward Taipei 101, then the camera cuts outside and rises
// into the title view.
const IT = { radio: 0.5, reply: 2.4, go: 2.6, out: 8.6, rise: 10.2, title: 12.8 };
const INTRO_CAPS = [
  [0.5, 2.4, '119 勤務指揮中心', '信義 94，信義路五段有人倒地、沒有呼吸，請立即出勤！'],
  [2.4, 4.3, '信義 94', '收到！鳴笛出勤！'],
  [4.5, 6.5, '小提醒', '鳴笛時，前方車輛會靠邊讓道'],
  [6.6, 8.5, '小提醒', '路口的車流也會停下，讓救護車先過'],
];
const INTRO = { t: 0, pts: null, cum: null, len: 0, s: 0, k: 1, v: 0, fx: {}, cap: -1, built: false };

// the drive: out of the 信義 station and along the streets toward Taipei 101, a little right of the centre line
function introPath() {
  const S = STATIONS.find((q) => q.id === 'xy') || STATIONS[0];
  const from = nearestOnRoads(S.park.x, S.park.z, (e) => !e.flags.ring && !e.flags.campus && !e.flags.alley);
  const goal = (HOSPITALS.find((H) => H.id === 'xs') || HOSPITALS[0]).proj;
  const raw = routePath(dijkstra(from, true), goal).pts;
  // even 2-unit spacing
  const pts = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const [ax, az] = pts[pts.length - 1], [bx, bz] = raw[i], d = Math.hypot(bx - ax, bz - az);
    for (let k = 2; k <= d; k += 2) pts.push([ax + ((bx - ax) * k) / d, az + ((bz - az) * k) / d]);
    if (d % 2 > 0.5) pts.push([bx, bz]);
  }
  // keep to the right of the centre line, where an ambulance overtakes
  const off = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return [p[0] - tz * 2.4, p[1] + tx * 2.4];
  });
  // pull out of the station apron onto the lane
  let i0 = 0;
  while (i0 < off.length - 2 && Math.hypot(off[i0][0] - S.park.x, off[i0][1] - S.park.z) < 13) i0++;
  let path = [[S.park.x, S.park.z], ...off.slice(i0)];
  // round the corners
  for (let pass = 0; pass < 4; pass++) {
    path = path.map((p, i) => {
      if (i < 1 || i > path.length - 2) return p;
      const a = path[Math.max(0, i - 3)], b = path[Math.min(path.length - 1, i + 3)];
      return [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4];
    });
  }
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  Object.assign(INTRO, { pts: path, cum, len: cum[cum.length - 1] });
}
// a point and heading `s` along the drive
function introAt(s) {
  const P = INTRO.pts, C = INTRO.cum;
  s = clamp(s, 0, INTRO.len);
  let k = INTRO.k;
  while (k > 1 && C[k - 1] > s) k--;
  while (k < C.length - 1 && C[k] < s) k++;
  INTRO.k = k;
  const a = P[k - 1], b = P[k], u = (s - C[k - 1]) / (C[k] - C[k - 1] || 1);
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.atan2(b[0] - a[0], b[1] - a[1])];
}
function introHeading(s, ahead) {
  const k0 = INTRO.k, p = introAt(s), q = introAt(s + ahead);
  INTRO.k = k0;
  return Math.atan2(q[0] - p[0], q[1] - p[1]);
}

// ---------- the waiting screen: in the cab, engine idling, the street outside ----------
function introGate() {
  if (!INTRO.built) { introPath(); INTRO.built = true; }
  G.mode = 'mission';
  clearRun();
  Object.assign(INTRO, { t: 0, s: 0, k: 1, v: 0, fx: {}, cap: -1 });
  const [x, z] = introAt(0);
  carReset(x, z, introHeading(0, 14));
  car.group.visible = false;
  // the title view will open on the same side of Taipei 101 as the end of the drive
  const [ex, ez] = introAt(INTRO.len - 30);
  camState.attract = Math.atan2(ex - TITLE_C.x, ez - TITLE_C.z);
  INTRO.k = 1;
  populateAround(x, z, false);
  G.state = 'gate';
  showScreen('none');
  UI.intro.hidden = false;
  UI.intro.className = 'gate';
  UI.introCap.className = 'ck-cap';
  UI.introLogo.classList.remove('show');
  UI.introGo.textContent = G.introSeen ? '開場動畫' : '出勤！';
  UI.introSkip0.textContent = G.introSeen ? '直接進入' : '跳過開場';
  UI.introFade.className = 'ck-fade';
  try { (G.introSeen ? UI.introSkip0 : UI.introGo).focus({ preventScroll: true }); } catch (e) { /* focus unsupported */ }
}
function startIntro() {
  if (G.state !== 'gate') return;
  audioInit();
  G.state = 'intro';
  INTRO.t = 0;
  UI.intro.className = 'play';
  // a blink of black, as the radio crackles
  UI.introFade.className = 'ck-fade on';
  requestAnimationFrame(() => requestAnimationFrame(() => { UI.introFade.className = 'ck-fade'; }));
  try { UI.introSkip.focus({ preventScroll: true }); } catch (e) { /* focus unsupported */ }
}
function endIntro() {
  if (G.state !== 'intro' && G.state !== 'gate') return;
  const early = G.state === 'gate' || INTRO.t < IT.rise;
  G.introSeen = true;
  saveState();
  UI.intro.hidden = true;
  UI.intro.className = '';
  VIEWCONE = null;
  if (car.xray) car.xray.visible = true;
  // the ambulance goes back to its usual spot in front of Taipei Main Station, out of the title view
  carReset(START.x, START.z, START.h);
  showTitle(!early);
}
const easeIO = (u) => u * u * (3 - 2 * u);

function introStep(dt) {
  const play = G.state === 'intro';
  if (play) {
    INTRO.t += dt;
    const t = INTRO.t, F = INTRO.fx;
    if (t >= IT.radio && !F.radio) { F.radio = 1; sfx.call(); }
    if (t >= IT.reply && !F.siren) { F.siren = 1; UI.intro.classList.add('siren'); sfx.beep(true); }
    if (F.siren) SIREN.t = 5;
    // captions
    let ci = -1;
    INTRO_CAPS.forEach((c, i) => { if (t >= c[0] && t < c[1]) ci = i; });
    if (ci !== INTRO.cap) {
      INTRO.cap = ci;
      if (ci >= 0) {
        const [, , who, text] = INTRO_CAPS[ci];
        UI.introCap.innerHTML = `<span class="ck-ic">${iconSVG(ci === 0 ? 'phone' : ci === 1 ? 'siren' : 'star', '#ffffff', 18)}</span><span><b>${who}</b>${text}</span>`;
        UI.introCap.className = 'ck-cap show' + (ci === 0 ? ' radio' : ci === 1 ? ' crew' : '');
      } else UI.introCap.className = 'ck-cap';
    }
    // the cut outside, then up into the sky
    if (t >= IT.out && !F.out) {
      F.out = 1;
      UI.intro.classList.add('out');
      car.group.visible = true;
      UI.introFade.className = 'ck-fade flash';
      requestAnimationFrame(() => requestAnimationFrame(() => { UI.introFade.className = 'ck-fade q'; }));
    }
    if (t >= IT.rise + 0.5 && !F.logo) { F.logo = 1; UI.introLogo.classList.add('show'); }
    // from high up, the see-through silhouette of the ambulance would only be a pink blot between the roofs
    if (car.xray) car.xray.visible = t < IT.rise + 0.3;
    if (t >= IT.title) { endIntro(); return; }
    // speed: away from the kerb, ease off for the corners and at the end of the drive
    if (t >= IT.go) {
      const turn = Math.abs(angDiff(introHeading(INTRO.s, 2), introHeading(INTRO.s + 10, 8)));
      const vmax = Math.min(22 - clamp(turn * 16, 0, 10), Math.sqrt(Math.max(0, 2 * 5 * (INTRO.len - INTRO.s - 4))));
      INTRO.v = INTRO.v < vmax ? Math.min(vmax, INTRO.v + 6.5 * dt) : Math.max(vmax, INTRO.v - 12 * dt);
      INTRO.s = Math.min(INTRO.len, INTRO.s + INTRO.v * dt);
    }
  }
  const [x, z] = introAt(INTRO.s);
  const want = introHeading(INTRO.s, 5);
  car.h = dampAngle(car.h, want, 9, dt);
  car.steer = damp(car.steer, clamp(angDiff(car.h, introHeading(INTRO.s + 3, 8)) * 3, -1, 1), 6, dt);
  car.x = x; car.z = z; car.y = groundHeight(x, z);
  car.speed = car.vF = INTRO.v; car.slip = 0;
  car.vx = Math.sin(car.h) * INTRO.v; car.vz = Math.cos(car.h) * INTRO.v;
  // the city around it
  const AM = ambList(), PP = POOL.chase;
  const fx = Math.sin(car.h), fz = Math.cos(car.h);
  trafficStep(dt, AM, car.x + fx * 60, car.z + fz * 60, PP[0], PP[1], PP[2]);
  pedStep(dt, ev, AM, car.x + fx * 40, car.z + fz * 40, PP[3], PP[4], PP[5]);
  fxStep(dt);
}

// ---------- camera: the driver's eyes, then a chase shot, then up to the title orbit ----------
const _ie = [0, 0, 0], _il = [0, 0, 0];
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
function introCamera(dt) {
  const t = INTRO.t, port = camera.aspect < 1;
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
  let P, T, fov, near = 0.3;
  if (G.state === 'gate' || t < IT.out) {
    // the driver sits on the left
    const bob = reduceMotion ? 0 : Math.sin(G.t * 11) * 0.03 * Math.min(1, car.speed / 14);
    _ie[0] = car.x + fx * 0.3 + lx * 0.55; _ie[1] = car.y + 2.55 + bob; _ie[2] = car.z + fz * 0.3 + lz * 0.55;
    _il[0] = car.x + fx * 30 + lx * 0.4; _il[1] = car.y + 1.25; _il[2] = car.z + fz * 30 + lz * 0.4;
    P = _ie; T = _il; fov = port ? 84 : 66;
  } else {
    // outside: close behind, easing back to a chase view
    const u = easeIO(clamp((t - IT.out) / (IT.rise - IT.out), 0, 1));
    const back = lerp(8.5, 16, u), up = lerp(3.2, 7.2, u), side = lerp(port ? 0.6 : 1.6, 0, u);
    const C = [car.x - fx * back - lx * side, car.y + up, car.z - fz * back - lz * side];
    const CL = [car.x + fx * 10, car.y + 1.7, car.z + fz * 10];
    P = C; T = CL; fov = port ? 72 : 58; near = 1;
    if (t > IT.rise) {
      const w = easeIO(clamp((t - IT.rise) / (IT.title - IT.rise), 0, 1));
      const TP = titleCamPose(camState.attract, camera.aspect);
      P = lerp3(C, TP.p, w); T = lerp3(CL, TP.l, w); fov = lerp(fov, 50, w);
    }
  }
  camera.position.set(P[0], P[1], P[2]);
  camera.lookAt(T[0], T[1], T[2]);
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  VIEW.ox = VIEW.oy = 0;
  const far = 640;
  if (Math.abs(camera.fov - fov) > 0.05 || camera.near !== near || camera.far !== far) { camera.fov = fov; camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
  setFog(260, 620);
  CUT.value = 0;
  smallVegCull(true, P[0], P[2]);
  focusShadow(car.x + fx * 26, car.z + fz * 26);
  camState.yaw = car.h; camState.px = car.x; camState.pz = car.z;
  // new traffic must not appear in front of the windscreen
  VC.x = P[0]; VC.z = P[2]; VC.dx = fx; VC.dz = fz; VC.near = far - 100;
  VIEWCONE = VC;
}
// the cab's moving parts: the wheel turns with the road, the needle with the speed
function introRender() {
  if (UI.intro.hidden) return;
  UI.ckWheel.setAttribute('transform', `rotate(${(car.steer * -70).toFixed(1)} 300 340)`);
  UI.ckNeedle.setAttribute('transform', `rotate(${(-120 + clamp(car.speed / 26, 0, 1) * 240).toFixed(1)})`);
}

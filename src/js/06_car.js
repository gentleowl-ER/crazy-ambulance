// ===================== ground, ambulance model & physics =====================
const GRAV = 28;
function deckHeight(x, z) {
  let best = -100;
  for (const b of BRIDGES) {
    const dx = x - b.x, dz = z - b.z;
    const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    if (Math.abs(lx) <= b.hw && Math.abs(lz) <= b.hl) {
      let y = b.y;
      if (b.rampBoth) y *= smoothstep(0, 3.5, b.hl - Math.abs(lz));
      else if (b.landEnd) y *= smoothstep(0, 4, lz * b.landEnd * -1 + b.hl);
      if (y > best) best = y;
    }
  }
  for (const r of RAMP_SHAPES) {
    const dx = x - r.x, dz = z - r.z;
    const u = dx * r.ux + dz * r.uz + r.len / 2;
    const v = -dx * r.uz + dz * r.ux;
    if (u >= 0 && u <= r.len && Math.abs(v) <= r.hw) {
      const y = rampHeightLocal(r, u);
      if (y > best) best = y;
    }
  }
  return Math.max(best, bridgeY(x, z));
}
function groundHeight(x, z) { return Math.max(baseHeight(x, z), deckHeight(x, z)); }

const fontTextures = []; // {redraw()} re-rendered once web fonts arrive
function textTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  const redraw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  redraw();
  fontTextures.push({ redraw });
  return t;
}
const FONT_CJK = '"Huninn", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const FONT_NUM = 'Fredoka, "Huninn", "Arial Rounded MT Bold", Arial, sans-serif';

const car = {
  x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, vy: 0, gvy: 0, steer: 0, yawRate: 0,
  airborne: false, airT: 0, surface: 'road', speed: 0, vF: 0, slip: 0,
  driftT: 0, sinking: 0, wheelRot: 0, roll: 0, pitch: 0, squash: 0, lastImpact: 0,
  group: null, body: null, wheels: [], lights: [], frontWheels: [],
};

// opt: { stripe, side, roof } — the dispatch-mode units reuse this with their own markings
function makeAmbulanceModel(opt = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const gb = new GB();
  const W = 2.6, white = 0xf8f6f1, red = 0xe23b33, stripe = opt.stripe || red, glass = 0x8fd3ee, dark = 0x3a3d44;
  gb.add(box(W, 0.95, 5.5), white, M(0, 0.98, 0));
  gb.add(box(W + 0.06, 0.34, 5.52), stripe, M(0, 1.22, 0));
  gb.add(box(W, 1.62, 3.4), white, M(0, 2.26, -1.0));
  gb.add(box(W + 0.06, 0.26, 3.42), stripe, M(0, 2.74, -1.0));
  gb.add(box(W - 0.1, 1.06, 1.55), white, M(0, 1.98, 1.47));
  gb.add(box(W - 0.32, 0.96, 0.12), glass, M(0, 2.0, 2.2, -0.38, 0, 0));
  for (const sx of [-1, 1]) {
    gb.add(box(0.1, 0.6, 1.02), glass, M(sx * (W / 2 - 0.08), 2.06, 1.42));
    gb.add(box(0.1, 0.55, 1.1), glass, M(sx * (W / 2 + 0.01), 2.3, -1.9));
    gb.add(box(0.3, 0.36, 0.16), dark, M(sx * (W / 2 + 0.16), 2.0, 1.98));
    gb.add(box(0.5, 0.32, 0.1), 0xfff1bf, M(sx * 0.88, 1.12, 2.77));
    gb.add(box(0.36, 0.5, 0.1), 0xff4436, M(sx * 1.0, 1.18, -2.77));
    // rear doors: windows and handles, seen from the chase cameras
    gb.add(box(0.78, 0.42, 0.06), glass, M(sx * 0.56, 2.32, -2.73));
    gb.add(box(0.16, 0.07, 0.07), dark, M(sx * 0.17, 2.08, -2.75));
    gb.add(box(0.42, 0.42, 0.1), 0xf2a33a, M(sx * 1.05, 3.12, -2.55));
  }
  gb.add(box(W - 0.16, 0.34, 0.66), white, M(0, 1.6, 2.42));
  gb.add(box(W + 0.12, 0.42, 0.36), 0x80838b, M(0, 0.68, 2.83));
  gb.add(box(W + 0.12, 0.42, 0.36), 0x80838b, M(0, 0.68, -2.83));
  gb.add(box(W - 0.5, 0.12, 0.42), 0x6f727a, M(0, 0.44, -3.05));
  gb.add(box(1.2, 0.36, 0.08), dark, M(0, 1.05, 2.78));
  gb.add(box(0.06, 1.42, 0.06), 0xb8bbc2, M(0, 2.22, -2.72));
  gb.add(box(2.1, 0.1, 0.62), red, M(0, 3.11, -1.0));
  gb.add(box(0.62, 0.1, 2.1), red, M(0, 3.11, -1.0));
  gb.add(box(2.0, 0.22, 0.56), dark, M(0, 2.62, 1.2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.add(box(0.2, 0.7, 1.45), 0x4a4d55, M(sx * (W / 2 - 0.02), 0.62, sz * 1.75));
  const geo = gb.build();
  const bm = new THREE.Mesh(geo, MAT.toon);
  bm.castShadow = true;
  body.add(bm, new THREE.Mesh(geo, MAT.olInk));
  // x-ray silhouette: drawn in the opaque pass after the city but before the ambulance itself,
  // and only where something already in the depth buffer (a building, a tree) hides it
  const xr = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xff6b5e, opacity: 0.62, depthWrite: false, depthFunc: THREE.GreaterDepth,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  body.add(xr);
  const lm1 = new THREE.MeshBasicMaterial({ color: 0x7a2020 }), lm2 = new THREE.MeshBasicMaterial({ color: 0x1f3a7a });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.34, 0.46), lm1), l2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.34, 0.46), lm2);
  l1.position.set(-0.5, 2.86, 1.2); l2.position.set(0.5, 2.86, 1.2);
  body.add(l1, l2);
  // side lettering + roof number
  const sideCss = '#' + new THREE.Color(stripe).getHexString();
  const sideTex = textTexture(512, 128, (c, w, h) => {
    c.fillStyle = sideCss; c.font = `64px ${FONT_CJK}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(opt.side || '救護車', w / 2, h / 2 + 4);
  });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: sideTex, transparent: true, depthWrite: false }));
    p.position.set(sx * (W / 2 + 0.035), 2.08, -1.05);
    p.rotation.y = sx * Math.PI / 2;
    body.add(p);
  }
  const roofTex = textTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#e23b33'; c.font = `700 92px ${FONT_NUM}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(opt.roof || '119', w / 2, h / 2 + 6);
  });
  const rp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: roofTex, transparent: true, depthWrite: false }));
  rp.rotation.x = -Math.PI / 2; rp.rotation.z = Math.PI;
  rp.position.set(0, 3.08, -2.3);
  body.add(rp);
  // number on the back doors
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.58), new THREE.MeshBasicMaterial({ map: roofTex, transparent: true, depthWrite: false }));
  back.rotation.y = Math.PI;
  back.position.set(0, 1.74, -2.765);
  body.add(back);
  // wheels (tyre + hub + spoke stripe merged so each wheel is one draw call)
  const wgb = new GB();
  const wg = new THREE.CylinderGeometry(0.58, 0.58, 0.5, 14); wg.rotateZ(Math.PI / 2);
  const hg = new THREE.CylinderGeometry(0.28, 0.28, 0.52, 10); hg.rotateZ(Math.PI / 2);
  wgb.add(wg, 0x2e2f35, null); wgb.add(hg, 0xd9dbe0, null); wgb.add(box(0.54, 0.12, 0.8), 0xd9dbe0, null);
  const wheelGeo = wgb.build();
  const wheels = [], frontWheels = [];
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 1.2, 0.58, sz * 1.75);
    const spin = new THREE.Mesh(wheelGeo, MAT.toon); spin.castShadow = true;
    piv.add(spin);
    g.add(piv);
    wheels.push(spin);
    if (sz > 0) frontWheels.push(piv);
  }
  g.traverse((o) => { if (o.isMesh) o.renderOrder = o === xr ? 1 : 2; });
  return { g, body, wheels, frontWheels, lights: [lm1, lm2], xray: xr };
}
function buildAmbulance(scene) {
  const m = makeAmbulanceModel();
  scene.add(m.g);
  car.group = m.g; car.body = m.body; car.wheels = m.wheels; car.frontWheels = m.frontWheels; car.lights = m.lights; car.xray = m.xray;
}

function carReset(x, z, h) {
  car.x = x; car.z = z; car.h = h; car.vx = car.vz = car.vy = car.gvy = 0; car.speed = car.vF = car.slip = 0;
  car.y = groundHeight(x, z); car.airborne = false; car.airT = 0; car.sinking = 0; car.steer = 0; car.driftT = 0;
}
const _cbuf = [];
function carStep(dt, inp, ev) {
  const c = car;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vF = c.vx * fx + c.vz * fz, vR = c.vx * rx + c.vz * rz;
  const F = landF(c.x, c.z);
  const th = baseHeight(c.x, c.z), dh = deckHeight(c.x, c.z);
  const onDeck = dh > th + 0.02 && Math.abs(c.y - dh) < 1.0;
  let surf;
  if (onDeck) surf = 'wood';
  else if (F < 0) surf = 'water';
  else if (roadDist(c.x, c.z) < 0.3 || alleyDist(c.x, c.z) < 0.3) surf = 'road';
  else if (plazaVal(c.x, c.z) > 0.3) surf = 'paved';
  else if (parkVal(c.x, c.z) > 0.5 || F < 26 || th > 0.4) surf = 'grass';
  else surf = 'paved';
  c.surface = surf;
  const maxV = (surf === 'road' ? 38 : surf === 'wood' ? 36 : surf === 'paved' ? 33 : surf === 'grass' ? 30 : 13) * DRV.top;
  const target = inp.steer;
  c.steer += clamp(target - c.steer, -(Math.abs(target) > Math.abs(c.steer) ? 5.5 : 9) * dt, (Math.abs(target) > Math.abs(c.steer) ? 5.5 : 9) * dt);
  const drifting = inp.drift && Math.abs(vF) > 9 && !c.airborne;
  if (!c.airborne && !c.sinking) {
    if (inp.gas) {
      if (vF < -0.5) vF += 40 * dt;
      else vF += 26 * DRV.acc * Math.max(0.08, 1 - vF / maxV) * dt * (surf === 'water' ? 0.6 : 1);
    }
    if (inp.brake) {
      if (vF > 0.8) vF -= 46 * dt;
      else if (!inp.gas) vF = Math.max(vF - 18 * dt, -12);
    }
    if (!inp.gas && !inp.brake) {
      // lifting off keeps some momentum for the next corner
      const dec = (1.6 + 0.0065 * vF * vF) * dt;
      vF = Math.abs(vF) <= dec ? 0 : vF - Math.sign(vF) * dec;
    }
    if (vF > maxV) vF = damp(vF, maxV, 2.4, dt);
    if (inp.drift) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 1.6 * dt);
    // the tyres turn part of the sideways slide back into forward speed, but never add speed overall:
    // turning or weaving must not make the ambulance faster than driving straight
    const s0 = Math.hypot(vF, vR);
    const grip = (drifting ? 1.45 : surf === 'grass' ? 7.5 : surf === 'paved' ? 9.5 : surf === 'water' ? 3.5 : 10.5) * (drifting ? 1 : DRV.grip);
    const keep = Math.exp(-grip * dt);
    const lost = vR * (1 - keep);
    vR *= keep;
    if (vF > 0) {
      vF += Math.abs(lost) * (drifting ? 0.85 : 0.6);
      if (vF * vF + vR * vR > s0 * s0) vF = Math.sqrt(Math.max(0, s0 * s0 - vR * vR));
    }
    c.vx = fx * vF + rx * vR; c.vz = fz * vF + rz * vR;
    // a typhoon gust shoves the ambulance sideways (the high box body catches the wind)
    if (WX.gust) { c.vx += WX.gx * 0.55 * DRV.wind * dt; c.vz += WX.gz * 0.55 * DRV.wind * dt; }
    const sp = Math.abs(vF);
    const steerEff = clamp(sp / 6, 0, 1) * (1 - 0.36 * clamp(sp / 40, 0, 1));
    let yaw = -c.steer * 2.45 * steerEff * (vF >= -0.2 ? 1 : -1);
    if (drifting) yaw *= 1.55;
    c.h += yaw * dt;
    c.yawRate = yaw;
  } else if (c.airborne) {
    c.h += -c.steer * 0.8 * dt;
    c.yawRate = -c.steer * 0.8;
  }
  c.vF = vF; c.slip = Math.abs(vR);
  const px = c.x, pz = c.z;
  c.x += c.vx * dt; c.z += c.vz * dt;
  // vertical motion
  const gh = groundHeight(c.x, c.z);
  if (c.sinking) {
    c.vx *= 1 - 3 * dt; c.vz *= 1 - 3 * dt;
    c.y -= 2.4 * dt;
  } else if (!c.airborne) {
    if (gh > c.y + 0.85) {
      c.x = px; c.z = pz;
      const sp = hypot(c.vx, c.vz);
      c.vx *= -0.25; c.vz *= -0.25;
      if (sp > 6) ev.crash(sp, c.x + fx * 2.5, c.z + fz * 2.5);
    } else {
      const proj = c.y + c.gvy * dt - 0.5 * GRAV * dt * dt;
      if ((gh < proj - 0.015 && c.gvy > 1.2) || gh < c.y - 0.5) {
        c.airborne = true; c.vy = Math.max(0, c.gvy); c.airT = 0;
      } else {
        c.gvy = damp(c.gvy, (gh - c.y) / dt, 30, dt);
        c.y = gh;
      }
    }
  }
  if (c.airborne && !c.sinking) {
    c.vy -= GRAV * dt;
    c.y += c.vy * dt;
    c.airT += dt;
    if (c.y <= gh) {
      const impact = -c.vy;
      c.y = gh; c.airborne = false; c.gvy = 0;
      c.squash = Math.min(0.35, impact * 0.025);
      ev.land(c.airT, impact);
      c.airT = 0;
    }
  }
  // water
  if (!c.sinking && !c.airborne && !onDeck && dh < th + 0.02 && F < -2.6) {
    c.sinking = 1.4;
    ev.sink();
  }
  if (!c.sinking) {
    // static collisions (two circles along the body)
    let impact = 0, hx = 0, hz = 0;
    for (const off of [1.35, -1.35]) {
      for (let it = 0; it < 2; it++) {
        const cx = c.x + Math.sin(c.h) * off, cz = c.z + Math.cos(c.h) * off;
        const list = queryColliders(cx, cz, 3.2, _cbuf);
        let any = false;
        for (const col of list) {
          if (col.minY !== undefined && c.y > col.minY) continue;
          const hit = collide(col, cx, cz, 1.38);
          if (!hit) continue;
          any = true;
          c.x += hit.nx * hit.pen; c.z += hit.nz * hit.pen;
          const vn = c.vx * hit.nx + c.vz * hit.nz;
          if (vn < 0) {
            c.vx -= 1.3 * vn * hit.nx; c.vz -= 1.3 * vn * hit.nz;
            c.vx *= 0.93; c.vz *= 0.93;
            if (-vn > impact) { impact = -vn; hx = cx - hit.nx * 1.38; hz = cz - hit.nz * 1.38; }
            c.h += (off > 0 ? 1 : -1) * (hit.nx * Math.cos(c.h) - hit.nz * Math.sin(c.h)) * Math.min(0.12, -vn * 0.01);
          }
        }
        if (!any) break;
      }
    }
    if (impact > 7) ev.crash(impact, hx, hz);
  }
  c.speed = hypot(c.vx, c.vz);
  // drift tracking
  if (drifting && c.slip > 4) c.driftT += dt;
  else if (c.driftT > 0 && (c.slip < 2.5 || c.airborne)) { ev.drift(c.driftT); c.driftT = 0; }
  else if (!inp.drift && c.slip < 2.5) c.driftT = 0;
}

function carVisual(dt, carrying, t) {
  const c = car;
  const g = c.group;
  g.position.set(c.x, c.y, c.z);
  // follow the slope of a bridge ramp (level out in the air)
  const fx = Math.sin(c.h) * 1.7, fz = Math.cos(c.h) * 1.7;
  const gp = c.airborne || c.sinking ? 0 : -Math.atan((groundHeight(c.x + fx, c.z + fz) - groundHeight(c.x - fx, c.z - fz)) / 3.4);
  c.gpitch = damp(c.gpitch || 0, gp, c.airborne ? 3 : 12, dt);
  g.rotation.order = 'YXZ';
  g.rotation.y = c.h;
  g.rotation.x = c.gpitch;
  const sp = c.vF;
  c.wheelRot += (sp / 0.58) * dt;
  for (const w of c.wheels) w.rotation.x = c.wheelRot;
  for (const fw of c.frontWheels) fw.rotation.y = -c.steer * 0.5;
  const rollT = clamp(-c.steer * clamp(Math.abs(sp) / 30, 0, 1) * 0.09 + (c.slip > 4 ? Math.sign(c.yawRate) * 0.04 : 0), -0.14, 0.14);
  c.roll = damp(c.roll, rollT, 8, dt);
  c.pitch = damp(c.pitch, c.airborne ? -c.vy * 0.012 : 0, 6, dt);
  c.squash = damp(c.squash, 0, 7, dt);
  const b = c.body;
  b.rotation.z = c.roll;
  b.rotation.x = c.pitch;
  b.scale.set(1 + c.squash * 0.4, 1 - c.squash, 1 + c.squash * 0.3);
  b.position.y = c.surface === 'grass' && c.speed > 4 && !c.airborne ? Math.sin(t * 38) * 0.04 : 0;
  // siren lights
  const [m1, m2] = c.lights;
  if (carrying) {
    const ph = Math.floor(t * 6) % 2;
    m1.color.setHex(ph ? 0xff4a3d : 0x7a2020);
    m2.color.setHex(ph ? 0x23409a : 0x4f8dff);
  } else { m1.color.setHex(0x8a2a24); m2.color.setHex(0x2a4588); }
}

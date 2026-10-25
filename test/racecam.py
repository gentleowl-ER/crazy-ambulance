"""Evaluation only (no game changes): render the city from a low racing-style chase camera and measure the cost."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

JS = r'''
window.__view = function (spec) {
  const d = window.__dbg, cam = d.camera, car = d.car;
  // freeze the game loop's camera: in the paused state the loop only re-renders whatever camera we set
  d.G.state = 'paused';
  d.carReset(spec.x, spec.z, spec.h);
  d.carVisual(0.016, false, d.G.t);
  d.trafficRender(); d.pedRender(d.G.t); d.knockRender(); d.patientsRender(d.G.t); d.hospitalsRender(d.G.t);
  const fx = Math.sin(spec.h), fz = Math.cos(spec.h);
  if (spec.mode === 'race') {
    cam.fov = spec.fov || 62;
    cam.position.set(car.x - fx * spec.back, spec.hgt, car.z - fz * spec.back);
    cam.lookAt(car.x + fx * spec.ahead, spec.lookY, car.z + fz * spec.ahead);
    cam.far = spec.far; d.scene.fog.near = spec.fogN; d.scene.fog.far = spec.fogF;
  } else {
    d.G.state = 'play'; d.camState.yaw = spec.h; d.camState.px = car.x; d.camState.pz = car.z;
    for (let i = 0; i < 10; i++) d.updateCamera(0.1);
    d.G.state = 'paused';
    d.scene.fog.near = 420; d.scene.fog.far = 780;
  }
  cam.updateProjectionMatrix();
  const r = d.renderer;
  r.info.autoReset = true;
  const t0 = performance.now();
  r.render(d.scene, cam);
  const ms = performance.now() - t0;
  return { mode: spec.mode, calls: r.info.render.calls, tris: r.info.render.triangles, ms: Math.round(ms), far: Math.round(cam.far) };
};
// how often would a low chase camera end up inside a building while driving?
window.__clip = function (steps) {
  const d = window.__dbg, car = d.car, buf = [];
  let inside = 0, near = 0, n = 0;
  for (let i = 0; i < steps; i++) {
    if (d.G.state === 'choose') d.chooseDest(d.riding.eval.best);
    const k = d.keys; k.gas = true; k.brake = k.left = k.right = false;
    const gp = d.guidePoint(11);
    if (gp) { const want = Math.atan2(gp[0] - car.x, gp[1] - car.z); const diff = (((want - car.h) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; if (diff > 0.05) k.left = true; else if (diff < -0.05) k.right = true; if (Math.abs(diff) > 0.6 && car.speed > 12) { k.gas = false; k.brake = true; } }
    d.simulate(1 / 60);
    if (i % 10 === 0) d.updateGuide(true);
    if (i % 6) continue;
    // camera 9 units behind along the heading, 3.5 up
    const cx = car.x - Math.sin(car.h) * 9, cz = car.z - Math.cos(car.h) * 9;
    n++;
    let hit = false, close = false;
    for (const c of d.queryColliders(cx, cz, 3, buf)) {
      if (c.minY !== undefined) continue;
      const h1 = d.collide(c, cx, cz, 0.6); if (h1) hit = true;
      const h2 = d.collide(c, cx, cz, 2.2); if (h2) close = true;
    }
    if (hit) inside++; if (close) near++;
  }
  return { samples: n, insideGeometry: +(inside / n).toFixed(3), within2units: +(near / n).toFixed(3) };
};
0;
'''

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 1280, 720)
        await page.evaluate(JS)
        await page.evaluate('window.__dbg.startFree()')
        await page.evaluate('() => { const d = window.__dbg; for (let i = 0; i < 120; i++) d.simulate(1 / 60); }')
        S = await page.evaluate('window.__dbg.START')
        spots = {
            'zhongxiao': {'x': S['x'] + 30, 'z': S['z'] + 7, 'h': S['h']},
            'xinyi101': {'x': 700, 'z': 237, 'h': 1.5708},
        }
        # a narrow street
        nar = await page.evaluate('''() => { const d = window.__dbg; const e = d.edges.filter((e) => e.hw < 5.5 && e.len > 90 && !e.flags.campus && !e.flags.ring)[0];
          const a = e.pts[1], b = e.pts[2]; return { x: a[0], z: a[1], h: Math.atan2(b[0] - a[0], b[1] - a[1]), hw: e.hw, name: e.name }; }''')
        print('narrow street', nar)
        spots['narrow'] = {'x': nar['x'], 'z': nar['z'], 'h': nar['h']}
        for name, sp in spots.items():
            top = await page.evaluate('(s) => window.__view(s)', dict(sp, mode='top'))
            await page.wait_for_timeout(400); await shot(page, f'rc_{name}_top')
            race = await page.evaluate('(s) => window.__view(s)', dict(sp, mode='race', back=9, hgt=3.6, ahead=30, lookY=2.2, far=780, fogN=420, fogF=780))
            await page.wait_for_timeout(400); await shot(page, f'rc_{name}_race')
            raceNear = await page.evaluate('(s) => window.__view(s)', dict(sp, mode='race', back=9, hgt=3.6, ahead=30, lookY=2.2, far=470, fogN=220, fogF=460))
            await page.wait_for_timeout(400); await shot(page, f'rc_{name}_race_fog')
            print(name, 'TOP', top, '| RACE far 780', race, '| RACE fog 460', raceNear)
        # camera clipping while driving a mission route
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.startGame(); for (let i = 0; i < 240; i++) d.simulate(1 / 60); }')
        clip = await page.evaluate('window.__clip(60 * 90)')
        print('CLIP', clip)
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'built' not in l)[-800:])
        await browser.close()

asyncio.run(main())

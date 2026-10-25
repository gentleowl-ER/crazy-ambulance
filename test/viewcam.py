"""Chase camera views: screenshots of every view, draw calls, camera clipping, camera lag in turns, traffic ahead,
the HUD arrow pointing ahead / left / behind, and driving under a signal head (dissolve on / off).
usage: python3 viewcam.py [w] [h]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot as _shot

AUTO = open(__file__.replace('viewcam.py', 'play.py')).read().split("AUTO = r'''")[1].split("'''")[0]
JS = r'''
// n camera updates, then one full frame (world + HUD arrow pass); keepYaw leaves the arrow direction alone
window.__frameV = function (n, keepYaw, noCut) {
  const d = window.__dbg;
  for (let i = 0; i < n; i++) { d.G.t += 0.016; d.updateCamera(0.016); }
  if (noCut) d.CUT.value = 0;
  d.skyRender(d.camera);
  d.carVisual(0.016, !!d.riding, d.G.t); d.trafficRender(); d.pedRender(d.G.t); d.knockRender(); d.patientsRender(d.G.t); d.hospitalsRender(d.G.t);
  d.updateGuide(true);
  if (!keepYaw) for (let i = 0; i < 12; i++) d.updateArrow(0.1);
  d.placeArrow(); d.towerFade(1);
  const r = d.renderer; d.renderFrame();
  return { calls: r.info.render.calls, tris: r.info.render.triangles, far: Math.round(d.camera.far), fov: Math.round(d.camera.fov), cam: [Math.round(d.camera.position.x), +d.camera.position.y.toFixed(1), Math.round(d.camera.position.z)], arm: d.camState.arm && +d.camState.arm.toFixed(1), cut: +d.CUT.value.toFixed(1), hud: d.FX.hud.visible, world: d.FX.arrow.visible };
};
(() => { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); })();
0;
'''

async def main():
    w = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
    h = int(sys.argv[2]) if len(sys.argv) > 2 else 720
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, w, h)
        await page.evaluate('localStorage.clear()')
        await page.evaluate(AUTO)
        await page.evaluate(JS)
        await page.evaluate('window.__dbg.startFree()')
        S = await page.evaluate('window.__dbg.START')
        only = sys.argv[3] if len(sys.argv) > 3 else ''
        for view in ([] if only else ['top', 'high', 'chase', 'low']):
            r = await page.evaluate('''([v, S]) => { const d = window.__dbg; d.G.view = v; d.updateViewButtons(); d.camState.arm = 0;
              d.carReset(S.x, S.z, S.h); d.camState.yaw = S.h; d.G.state = 'play';
              for (let i = 0; i < 100; i++) { d.keys.gas = i < 70; d.simulate(1 / 60); d.updateCamera(1 / 60); }
              d.keys.gas = false; return window.__frameV(30); }''', [view, S])
            await page.wait_for_timeout(300)
            await _shot(page, f'v{w}_{view}')
            print(view, json.dumps(r))
        # the HUD arrow pointing left and behind (chase view)
        for name, rel in ([] if only else [('left', 1.5708), ('back', 3.0)]):
            await page.evaluate('''(rel) => { const d = window.__dbg; d.G.view = 'chase'; d.updateViewButtons(); d.FX.yaw = d.camState.yaw + rel; d.FX.on = true; window.__frameV(1, true); }''', rel)
            await page.wait_for_timeout(250)
            await _shot(page, f'v{w}_arrow_{name}')
        # just past a signal head over our lane: with the dissolve, and with it switched off
        for view in ['chase', 'high']:
            for tag, off in [('cut', False), ('nocut', True)]:
                r = await page.evaluate('''([v, off, S]) => { const d = window.__dbg; d.G.view = v; d.updateViewButtons(); d.G.state = 'play';
                  let best = null, bd = 1e9;
                  for (const sig of d.SIGNALS.values()) for (const hd of sig.heads) { const dd = Math.hypot(hd.x - S.x, hd.z - S.z); if (dd < bd && d.roadDist(hd.x, hd.z) < 1) { bd = dd; best = hd; } }
                  const hh = best.face + Math.PI, x = best.x + Math.sin(hh) * 1.5, z = best.z + Math.cos(hh) * 1.5;
                  d.carReset(x, z, hh); d.car.vx = d.car.vz = d.car.vF = d.car.speed = 0; d.camState.yaw = hh; d.camState.arm = 0; d.camState.cy = d.car.y;
                  const r = window.__frameV(90, false, off); r.head = [Math.round(best.x), Math.round(best.z)];
                  d.G.state = 'paused'; // keep the game's own loop from moving the camera (and re-enabling the cut) before the screenshot
                  return r; }''', [view, off, S])
                await page.wait_for_timeout(250)
                await _shot(page, f'v{w}_signal_{view}_{tag}')
                print('signal', view, tag, json.dumps(r))
        if only == 'signal':
            await browser.close(); return
        # drive a mission in the chase view, camera updated every step like the real loop; pause on the first sharp turn for a picture
        await page.evaluate('''() => { const d = window.__dbg; d.showTitle(); d.G.view = 'chase'; d.updateViewButtons(); d.startGame(); for (let i = 0; i < 240; i++) d.simulate(1 / 60);
          const L = window.__lag = { n: 0, sum: 0, max: 0, big: 0, shot: false, S: { n: 0, inside: 0, pulled: 0, ahead: 0, aheadFar: 0, minArm: 99 } };
          const wrap = (a) => Math.abs(((((a) % 6.2832) + 9.4248) % 6.2832) - 3.1416);
          window.__afterStep = () => { d.updateCamera(1 / 60);
            if (d.car.vF > 6) { const a = wrap(d.camState.yaw - d.car.h); L.n++; L.sum += a; L.max = Math.max(L.max, a); if (a > 0.6) L.big++;
              if (!L.shot && a > 0.42 && d.car.vF > 10) { L.shot = true; L.at = { lagDeg: +(a * 57.3).toFixed(1), vF: +d.car.vF.toFixed(1), slipDeg: +(wrap(d.car.h - Math.atan2(d.car.vx, d.car.vz)) * 57.3).toFixed(1) }; d.G.state = 'paused'; } } };
          window.__sample = () => { const S = L.S, buf = [], c = d.camera.position; S.n++;
            for (const col of d.queryColliders(c.x, c.z, 2, buf)) if (col.t === 1 && col.minY === undefined && Math.min(col.hw, col.hd) >= 1.6 && d.collide(col, c.x, c.z, 0.3)) { S.inside++; S.insideAt = { arm: +d.camState.arm.toFixed(1), vF: +d.car.vF.toFixed(1), speed: +d.car.speed.toFixed(1) }; break; }
            if (d.camState.arm < d.VIEWS[d.G.view].back - 1) S.pulled++;
            S.minArm = Math.min(S.minArm, d.camState.arm);
            const fx = Math.sin(d.camState.yaw), fz = Math.cos(d.camState.yaw);
            for (const v of d.traffic) { const ox = v.x - c.x, oz = v.z - c.z, dd = Math.hypot(ox, oz); if (ox * fx + oz * fz > dd * 0.7) { if (dd < 200) S.ahead++; else if (dd < 400) S.aheadFar++; } } };
          0; }''')
        for k in range(90):
            st = await page.evaluate('() => { window.__auto(60, 0); window.__sample(); return window.__dbg.G.state; }')
            if st == 'paused':
                at = await page.evaluate("() => { const d = window.__dbg; d.G.state = 'play'; window.__frameV(0); return window.__lag.at; }")
                await page.wait_for_timeout(250)
                await _shot(page, f'v{w}_turn')
                print('turn shot', json.dumps(at))
            elif st not in ('play', 'choose', 'countdown'):
                break
        stats = await page.evaluate('''() => { const d = window.__dbg, L = window.__lag, S = L.S, n = S.n;
          return { samples: n, cameraInsideBuilding: S.inside, insideAt: S.insideAt, armPulledIn: +(S.pulled / n).toFixed(2), minArm: +S.minArm.toFixed(1), carsAheadWithin200: +(S.ahead / n).toFixed(1), carsAhead200to400: +(S.aheadFar / n).toFixed(1),
            lagMeanDeg: +(L.sum / Math.max(1, L.n) * 57.3).toFixed(1), lagMaxDeg: +(L.max * 57.3).toFixed(1), lagOver34deg: +(L.big / Math.max(1, L.n)).toFixed(3), state: d.G.state, saved: d.G.saved }; }''')
        print('DRIVE chase', json.dumps(stats))
        await page.evaluate('() => { window.__afterStep = null; }')
        r = await page.evaluate('window.__frameV(4)')
        await page.wait_for_timeout(300)
        await _shot(page, f'v{w}_drive')
        print('drive frame', json.dumps(r))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'built' not in l)[-1500:])
        await browser.close()

asyncio.run(main())

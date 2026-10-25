"""Load the game in headless Chromium, capture screenshots and console output.
usage: python3 shot.py <scenario> [w h]
"""
import asyncio, sys, json, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()
OUT = ROOT / 'out'
OUT.mkdir(exist_ok=True)

async def main():
    scenario = sys.argv[1] if len(sys.argv) > 1 else 'title'
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 430
    h = int(sys.argv[3]) if len(sys.argv) > 3 else 932
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=(w < 700), is_mobile=False)
        page = await ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
        page.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        async def handle(route):
            url = route.request.url
            if 'three.min.js' in url:
                await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
            elif url.startswith('file://'):
                await route.continue_()
            else:
                await route.abort()
        await page.route('**/*', handle)
        await page.goto('file://' + str(ROOT / 'test.html'))
        try:
            await page.wait_for_function('window.__dbg && window.__dbg.G.state === "title"', timeout=60000)
        except Exception as e:
            logs.append('TIMEOUT waiting for title: ' + str(e))
        await page.wait_for_timeout(1500)
        page.set_default_timeout(150000)
        if scenario == 'title':
            await page.screenshot(path=str(OUT / f'{scenario}_title.png'))
        if scenario != 'title':
            await page.evaluate('window.__dbg.startGame()')
            await page.wait_for_timeout(4200)
            if scenario in ('drive', 'start'):
                await page.screenshot(path=str(OUT / f'{scenario}_start.png'))
            if scenario == 'tour':
                spots = [('harbor', 100, 168, 0.0), ('falls', -112, -96, -2.47), ('ramp', -62, 63, -1.5708),
                         ('lighthouse', 214, -178, 2.34), ('bridge', -52, 176, -1.45), ('eastbeach', 236, 70, 1.5708),
                         ('north', 40, -184, 1.5708), ('west', -210, 40, 3.0)]
                for name, x, z, hh in spots:
                    await page.evaluate(f'(() => {{ const d = window.__dbg; d.carReset({x}, {z}, {hh}); d.camState.yaw = {hh}; d.G.time = 60; for (let i = 0; i < 40; i++) d.simulate(1/60); }})()')
                    await page.wait_for_timeout(700)
                    await page.screenshot(path=str(OUT / f'tour_{name}.png'))
            if scenario == 'photo':
                cams = [('falls', (-120, 40, -110), (-162, 0, -146)), ('lighthouse', (240, 45, -180), (275, 0, -240)),
                        ('genroof', (20, 70, -40), (54, 0, -76)), ('overview', (60, 260, 260), (0, 0, 0)),
                        ('plaza', (0, 45, 40), (0, 0, 0)), ('rampside', (-80, 30, 90), (-110, 0, 60))]
                await page.evaluate('window.__dbg.G.state = "paused"')
                for name, pos, look in cams:
                    await page.evaluate(f'(() => {{ const c = window.__dbg.camera; c.position.set({pos[0]}, {pos[1]}, {pos[2]}); c.lookAt({look[0]}, {look[1]}, {look[2]}); }})()')
                    await page.wait_for_timeout(700)
                    await page.screenshot(path=str(OUT / f'photo_{name}.png'))
            if scenario == 'over':
                await page.evaluate('(() => { const d = window.__dbg; d.G.state = "play"; d.G.money = 1880; d.G.saved = 7; d.G.fast = 3; d.G.bestAir = 1.4; d.G.time = 0.2; for (let i = 0; i < 260; i++) d.simulate(1/60); })()')
                await page.wait_for_timeout(1200)
                await page.screenshot(path=str(OUT / 'over.png'))
            if scenario == 'pickup':
                # drive the car onto the nearest waiting patient and capture the boarding bubble + arrow
                await page.evaluate('''(() => { const d = window.__dbg; d.G.state = "play"; const p = d.patients[0]; d.carReset(p.rx, p.rz, Math.atan2(p.proj.e.pts[1][0]-p.proj.e.pts[0][0], p.proj.e.pts[1][1]-p.proj.e.pts[0][1])); d.camState.yaw = d.car.h; for (let i = 0; i < 90; i++) d.simulate(1/60); d.updateGuide(true); })()''')
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(OUT / 'pickup.png'))
            if scenario == 'near':
                # stand 35 units before a waiting patient, then carry one toward its hospital
                await page.evaluate('''(() => { const d = window.__dbg; d.G.state = "play"; const p = d.patients[0]; const e = p.proj.e; const s0 = Math.max(0, p.proj.s - 35);
                  const a = e.pts, k = Math.max(1, Math.min(a.length - 1, Math.round(s0 / 3)));
                  const h = Math.atan2(a[k][0] - a[k-1][0], a[k][1] - a[k-1][1]);
                  d.carReset(a[k-1][0], a[k-1][1], h); d.camState.yaw = h; for (let i = 0; i < 30; i++) d.simulate(1/60); d.updateGuide(true); })()''')
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(OUT / f'near_{w}.png'))
                await page.evaluate('''(() => { const d = window.__dbg; const p = d.patients.find(q => q.state === "wait"); d.carReset(p.rx, p.rz, d.car.h); for (let i = 0; i < 60; i++) d.simulate(1/60);
                  const m = d.hospMarks.find(m => d.riding && m.H === d.riding.hosp); const n = m.n; const e = d.nearestOnRoads(n[0], n[1]);
                  const P = e.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(e.s / 3) - 12)); const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
                  d.carReset(P[k][0], P[k][1], h); d.camState.yaw = h; for (let i = 0; i < 30; i++) d.simulate(1/60); d.updateGuide(true); })()''')
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(OUT / f'carry_{w}.png'))
            if scenario == 'drive':
                await page.keyboard.down('KeyW')
                await page.wait_for_timeout(2500)
                await page.screenshot(path=str(OUT / f'{scenario}_drive1.png'))
                await page.keyboard.down('KeyA')
                await page.keyboard.down('Space')
                await page.wait_for_timeout(900)
                await page.screenshot(path=str(OUT / f'{scenario}_drift.png'))
                await page.keyboard.up('Space')
                await page.keyboard.up('KeyA')
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(OUT / f'{scenario}_drive2.png'))
                await page.keyboard.up('KeyW')
        info = await page.evaluate('''() => { const d = window.__dbg; if (!d) return null; const r = d.renderer.info; return { state: d.G.state, car: [d.car.x, d.car.z, d.car.speed, d.car.surface], patients: d.patients.length, calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, colliders: d.colliders.length, spawn: d.spawnPts.length }; }''')
        print(json.dumps(info))
        print('\n'.join(logs[-40:]))
        await browser.close()

asyncio.run(main())

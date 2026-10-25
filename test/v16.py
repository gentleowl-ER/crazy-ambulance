"""v16: 關渡 (慈濟, 好事多, 關渡自然公園), 美麗華 on the real 北安路, the sightseeing camera."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

PICK = '''(name) => { const b = [...document.querySelectorAll("#spotsList .spot")].find((b) => b.querySelector("b").textContent === name); b.click(); }'''

async def sight_shots(page, tag):
    for t in [0.2, 1.6, 3.0]:
        await page.evaluate(f'() => {{ const S = window.__dbg.camState.sight; if (S) S.t = {t}; }}')
        await page.wait_for_timeout(1400)
        await shot(page, f'v16_{tag}_{int(t * 10)}_{W}')

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        r = await page.evaluate('''() => { const d = window.__dbg;
          const names = ['慈濟關渡園區', '好事多', '關渡自然公園', '美麗華摩天輪'];
          const lm = names.map((n) => { const L = d.LM.find((L) => L.name === n); return L && [n, Math.round(L.proj.d), d.placeName(L.proj.px, L.proj.pz)]; });
          const kf = d.HOSPITALS.find((h) => h.id === 'kf');
          return { lm, n: d.LM.length, kf: [Math.round(kf.bld.x), Math.round(kf.bld.z), d.placeName(kf.drop[0], kf.drop[1])],
            route: Math.round(d.routeCost(d.dijkstra(kf.proj), d.HOSPITALS.find((h) => h.id === "vg").proj)) }; }''')
        print('world', json.dumps(r, ensure_ascii=False))
        # every spot on a road, still
        r = await page.evaluate('''() => { const d = window.__dbg; const bad = [];
          d.spotList().forEach(([g, list]) => list.forEach((s) => { const P = s.pose(); const rd = d.roadDist(P.x, P.z); if (!(rd < 0.5) || !(P.h > -10)) bad.push([s.name, Math.round(rd * 10) / 10]); }));
          return { bad, n: d.spotList().reduce((a, g) => a + g[1].length, 0) }; }''')
        print('poses', json.dumps(r, ensure_ascii=False))
        # start at 好事多: the sightseeing swing
        await page.click('#freeBtn')
        await page.wait_for_timeout(400)
        await page.evaluate(PICK, '好事多')
        await page.wait_for_timeout(1200)
        r = await page.evaluate('() => { const d = window.__dbg, S = d.camState.sight; return { state: d.G.state, road: d.placeName(d.car.x, d.car.z), sight: S && [Math.round(S.x), Math.round(S.z), Math.round(S.r)] }; }')
        print('costco', json.dumps(r, ensure_ascii=False))
        await sight_shots(page, 'costco')
        # pressing the throttle cuts it short
        r = await page.evaluate('''() => { const d = window.__dbg; const S = d.camState.sight; if (S) S.t = 1; d.keys.gas = true; for (let i = 0; i < 25; i++) { d.simulate(1 / 30); d.updateCamera(1 / 30); } d.keys.gas = false; return { cleared: !d.camState.sight }; }''')
        print('cut', json.dumps(r))
        # jump to 美麗華 and 慈濟 from the pause menu
        for nm, tag in [('美麗華摩天輪', 'miramar'), ('慈濟關渡園區', 'tzuchi'), ('雙聖醫院', 'kf'), ('關渡自然公園', 'wetland')]:
            await page.evaluate('() => window.__dbg.showSpots(true)')
            await page.wait_for_timeout(300)
            await page.evaluate(PICK, nm)
            await page.wait_for_timeout(900)
            r = await page.evaluate('() => { const d = window.__dbg, S = d.camState.sight; return { state: d.G.state, road: d.placeName(d.car.x, d.car.z), car: [Math.round(d.car.x), Math.round(d.car.z)], sight: !!S }; }')
            print(tag, json.dumps(r, ensure_ascii=False))
            await page.evaluate('() => { const S = window.__dbg.camState.sight; if (S) S.t = 2.0; }')
            await page.wait_for_timeout(1500)
            await shot(page, f'v16_{tag}_{W}')
        # after the swing: back on the ambulance
        r = await page.evaluate('''() => { const d = window.__dbg; const S = d.camState.sight; if (S) S.t = S.dur - 0.05; for (let i = 0; i < 4; i++) d.updateCamera(1 / 30);
          return { cleared: !d.camState.sight, camToCar: Math.round(Math.hypot(d.camera.position.x - d.car.x, d.camera.position.z - d.car.z)) }; }''')
        print('end', json.dumps(r))
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

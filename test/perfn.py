"""Triangles and draw calls in a few north and south views (fixed poses), plus vegetation counts."""
import asyncio, json, sys
from playwright.async_api import async_playwright
from harness import open_page, shot
W, H = 1280, 760
POSES = [('chase', 95, -560, 0), ('high', 95, -560, 3.14159), ('high', 8, -790, 3.14159), ('high', 300, -830, 2.0), ('chase', 150, -900, 3.14159), ('high', 40, -1033, 1.5708), ('chase', 60, 34, 1.5708), ('high', 500, 160, 0)]
async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        print([l for l in logs if 'city built' in l])
        print(await page.evaluate('''(() => { const d = window.__dbg; return { fluffy: d.VEG.fluffy.length, pine: d.VEG.pine.length, bush: d.VEG.bush.length, tuft: d.VEG.tuft.length, bld: d.BUILDINGS.length }; })()'''))
        await page.evaluate('window.__dbg.startGame()')
        for i, (view, x, z, h) in enumerate(POSES):
            r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play'; d.G.view = '{view}'; const pr = d.nearestOnRoads({x}, {z}); d.carReset(pr.px, pr.pz, {h});
                d.camState.yaw = d.car.h; d.camState.px = d.car.x; d.camState.pz = d.car.z; d.camState.arm = 0; d.populateAround(d.car.x, d.car.z);
                for (let k = 0; k < 30; k++) d.simulate(1/60); return 1; }})()''')
            await page.wait_for_timeout(1200)
            r = await page.evaluate('''(() => { const d = window.__dbg; const i = d.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, pos: [Math.round(d.car.x), Math.round(d.car.z)] }; })()''')
            print(view, x, z, r)
            await shot(page, f'perfn_{i}')
        await browser.close()
asyncio.run(main())

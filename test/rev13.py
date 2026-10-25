"""v13 road events: spawn each type next to the ambulance, look at it, check the routing and the traffic limits."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 900, 560)
        await page.evaluate('() => { const d = window.__dbg; d.G.wxPick = "day"; d.G.homePick = "zq"; d.startGame(); d.G.countdown = 0.01; }')
        await page.wait_for_timeout(1200)
        for t in (sys.argv[1:] or ['works', 'crash', 'closed', 'parade', 'tree']):
            r = await page.evaluate(f'''() => {{ const d = window.__dbg;
              for (const R of d.ROADEV.list.slice()) d.endRoadEvent(R, true);
              const R = d.spawnRoadEvent("{t}", [d.car.x, d.car.z]);
              if (!R) return null;
              // put the ambulance 30 m before the stretch, facing it, and frame it from above
              const [x, z, a] = d.revPt(R, Math.max(0, R.s0 - 26), -R.e.hw * 0.4);
              d.carReset(x, z, a); d.camState.yaw = a; d.camState.px = x; d.camState.pz = z;
              d.populateAround(x, z, false);
              return {{ type: R.type, edge: R.e.name, s0: Math.round(R.s0), s1: Math.round(R.s1), len: Math.round(R.e.len), evk: R.e.evk, objs: R.objs.length, cols: R.cols.length }}; }}''')
            print(t, json.dumps(r, ensure_ascii=False))
            await page.wait_for_timeout(2500)
            await shot(page, f'rev_{t}_top')
            await page.evaluate('() => { const d = window.__dbg; d.G.view = "chase"; }')
            await page.wait_for_timeout(1600)
            await shot(page, f'rev_{t}_chase')
            await page.evaluate('() => { window.__dbg.G.view = "top"; }')
        # a siren run at the closure: do the barriers open?
        r = await page.evaluate('''() => { const d = window.__dbg; for (const R of d.ROADEV.list.slice()) d.endRoadEvent(R, true);
          const R = d.spawnRoadEvent("closed", [d.car.x, d.car.z]); const [x, z, a] = d.revPt(R, R.s0 - 20, 0); d.carReset(x, z, a);
          return !!R; }''')
        await page.evaluate('() => { const d = window.__dbg; d.keys.siren = true; d.keys.gas = true; }')
        await page.wait_for_timeout(3000)
        r = await page.evaluate('() => { const d = window.__dbg; const R = d.ROADEV.list[0]; return { gates: R.gates.map((g) => [+g.open.toFixed(1), g.c.dead]), car: [Math.round(d.car.x), Math.round(d.car.z), +d.car.speed.toFixed(1)], s: Math.round(d.nearestOnRoads(d.car.x, d.car.z).s), s0: Math.round(R.s0) }; }')
        print('siren run', json.dumps(r))
        await page.evaluate('() => { const d = window.__dbg; d.keys.siren = false; d.keys.gas = false; }')
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

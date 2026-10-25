"""Screenshots of the new streets: an alley from above and from the street, the park path, a junction box."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

PLACE = {
  'alley_top': ('top', '''const R = d.ALLEY_RUNS.find(R => R.e.name === '南京東路 23巷'); const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax + (bx - ax) * 0.45, az + (bz - az) * 0.45, h);'''),
  'alley_mouth': ('high', '''const R = d.ALLEY_RUNS.find(R => R.e.name === '民權東路 233巷'); const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax - Math.sin(h) * 12, az - Math.cos(h) * 12, h);'''),
  'stall': ('chase', '''const R = d.ALLEY_RUNS.filter(R => !R.park)[1]; const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax + (bx - ax) * 0.22, az + (bz - az) * 0.22, h);'''),
  'park_top': ('top', '''const P = d.ALLEY_RUNS.find(R => R.park); const [ax, az] = P.a, [bx, bz] = P.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax + (bx - ax) * 0.4, az + (bz - az) * 0.4, h);'''),
  'park_chase': ('high', '''const P = d.ALLEY_RUNS.find(R => R.park); const [ax, az] = P.a, [bx, bz] = P.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax + (bx - ax) * 0.1, az + (bz - az) * 0.1, h);'''),
  'junction_top': ('top', '''const sig = [...d.SIGNALS.values()].find(s => s.hw >= 8 && s.x > 100); const { e, dir } = d.nodeEdges[sig.id].find(o => o.e.len > 60 && !o.e.flags.alley);
      const s0 = dir === 1 ? sig.hw + 24 : e.len - sig.hw - 24; const q = d.edgePoint(e, s0); const h = dir === 1 ? Math.atan2(-q[2], -q[3]) : Math.atan2(q[2], q[3]); d.carReset(q[0] - Math.cos(h) * 2.5, q[1] + Math.sin(h) * 2.5, h);'''),
}

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        for name, (view, js) in PLACE.items():
            r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play'; d.G.view = '{view}'; d.SIREN.t = 0; {js}
                d.camState.yaw = d.car.h; d.camState.px = d.car.x; d.camState.pz = d.car.z; d.camState.arm = 0; d.populateAround(d.car.x, d.car.z);
                for (let k = 0; k < 40; k++) d.simulate(1/60);
                return {{ place: d.placeName(d.car.x, d.car.z), surf: d.car.surface }}; }})()''')
            print(name, r)
            await page.wait_for_timeout(1600)
            await shot(page, f'ns_{name}_{W}')
        # drive the park path end to end: shortcut bonus
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play'; const P = d.ALLEY_RUNS.find(R => R.park); const [ax, az] = P.a, [bx, bz] = P.b; const h = Math.atan2(bx - ax, bz - az);
            d.carReset(ax - Math.sin(h) * 8, az - Math.cos(h) * 8, h); const n0 = d.SHIFT.n.alley || 0; const s0 = d.G.score; let surf = {};
            for (let i = 0; i < 900; i++) { d.car.vx = Math.sin(h) * 20; d.car.vz = Math.cos(h) * 20; d.car.h = h; d.simulate(1/60); surf[d.car.surface] = (surf[d.car.surface] || 0) + 1; if ((d.car.x - bx) * Math.sin(h) + (d.car.z - bz) * Math.cos(h) > 12) break; }
            for (let i = 0; i < 30; i++) d.simulate(1/60);
            return { runs: (d.SHIFT.n.alley || 0) - n0, gained: d.G.score - s0, surf, end: [Math.round(d.car.x), Math.round(d.car.z)] }; })()''')
        print('park run', r)
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-2000:])
        await browser.close()
asyncio.run(main())

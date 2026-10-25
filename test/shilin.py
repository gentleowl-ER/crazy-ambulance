"""v11: 士林 / 北投. Build time, bridges, landmarks, new hospitals, shopfronts: screenshots + checks."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 760
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None

def at(x, z, h):
    return f'd.carReset({x}, {z}, {h});'
def on_road(name, frac, rev=False):
    return f'''const es = d.edges.filter(e => e.name === '{name}'); const e = es[Math.floor(es.length * {frac})]; const q = d.edgePoint(e, e.len * 0.5); const h = Math.atan2(q[2], q[3]) + ({'Math.PI' if rev else 0}); d.carReset(q[0] - q[3] * 2.5, q[1] + q[2] * 2.5, h);'''

PLACE = {
  'bridge_chase': ('chase', '''const D = d.DECKS.find(D => D.e.name === '中山北路'); const p = D.P[2]; const q = D.P[3]; d.carReset(p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1]));'''),
  'bridge_high': ('high', '''const D = d.DECKS.find(D => D.e.name === '承德路'); const p = D.P[1]; const q = D.P[2]; d.carReset(p[0] + 3, p[1], Math.atan2(q[0] - p[0], q[1] - p[1]));'''),
  'market_chase': ('chase', '''const R = d.ALLEY_RUNS.find(R => R.e.name === '士林夜市'); const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax + (bx - ax) * 0.12, az + (bz - az) * 0.12, h);'''),
  'market_high': ('high', '''const R = d.ALLEY_RUNS.find(R => R.e.name === '士林夜市'); const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az); d.carReset(ax - Math.sin(h) * 10, az - Math.cos(h) * 10, h);'''),
  'npm_high': ('high', '''const e = d.edges.find(e => e.name === '至善路'); const q = d.edgePoint(e, e.len - 50); d.carReset(q[0], q[1], Math.atan2(q[2], q[3]));'''),
  'amuse_high': ('high', at(8, -827, '-Math.PI / 2')),
  'tas_high': ('high', at(158, -944, 'Math.PI / 2')),
  'north_hosp': ('high', at(78, -1037, 'Math.PI / 2 - 0.12')),
  'kf_high': ('high', at(-70, -1028, '-Math.PI / 2 + 0.25')),
  'farm_high': ('high', at(-150, -701, 'Math.PI')),
  'shops_chase': ('chase', on_road('南京東西路', 0.4)),
  'shops_chase2': ('chase', on_road('中正路', 0.5)),
}

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        built = [l for l in logs if 'city built' in l]
        print(built)
        r = await page.evaluate('''(() => { const d = window.__dbg; return { decks: d.DECKS.map(D => [D.e.name, D.P.length, Math.round(D.P[0][3]), Math.round(D.P[D.P.length-1][3])]), hosp: d.HOSPITALS.map(H => [H.id, H.name, Math.round(H.drop[0]), Math.round(H.drop[1])]),
          brands: d.BRANDS.length, lm: d.LM.filter(L => Math.hypot(L.proj.px - L.x, L.proj.pz - L.z) > L.r - 4).map(L => [L.name, Math.round(Math.hypot(L.proj.px - L.x, L.proj.pz - L.z)), L.r]) }; })()''')
        print(json.dumps(r, ensure_ascii=False))
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        for name, (view, js) in PLACE.items():
            if ONLY and name not in ONLY: continue
            r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play'; d.G.view = '{view}'; d.SIREN.t = 0; {js}
                d.camState.yaw = d.car.h; d.camState.px = d.car.x; d.camState.pz = d.car.z; d.camState.arm = 0; d.populateAround(d.car.x, d.car.z);
                for (let k = 0; k < 40; k++) d.simulate(1/60);
                return {{ place: d.placeName(d.car.x, d.car.z), surf: d.car.surface, y: +d.car.y.toFixed(2), pos: [Math.round(d.car.x), Math.round(d.car.z)] }}; }})()''')
            await page.wait_for_timeout(1500)
            print(name, r, await info(page))
            await shot(page, f'sl_{name}_{W}')
        # anything standing in the river that should not be?
        r = await page.evaluate('''(() => { const d = window.__dbg; const D = d.DECKS.find(D => D.e.name === '承德路'); const p = D.P[1];
            d.G.state = 'play'; d.carReset(p[0] + 3, p[1], Math.PI); d.populateAround(d.car.x, d.car.z);
            const bad = { traffic: [], peds: [] };
            for (let k = 0; k < 900; k++) { d.simulate(1/60);
              if (k % 30) continue;
              for (const v of d.traffic) if (d.landF(v.x, v.z) < -1 && d.bridgeY(v.x, v.z) < -50) bad.traffic.push([v.kind, Math.round(v.x), Math.round(v.z), v.e && v.e.name]);
              for (const q of d.peds) if (q.x < 1e4 && d.landF(q.x, q.z) < -1 && d.bridgeY(q.x, q.z) < -50) bad.peds.push([q.state, Math.round(q.x), Math.round(q.z), q.e && q.e.name]); }
            return { traffic: bad.traffic.slice(0, 8), nT: bad.traffic.length, peds: bad.peds.slice(0, 8), nP: bad.peds.length }; })()''')
        print('in the river', json.dumps(r, ensure_ascii=False))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-3000:])
        await browser.close()
asyncio.run(main())

"""Play-test: driving feel measured with scripted inputs (physics only, 120 Hz, no traffic)."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

JS = r'''
window.__phys = function (spec) {
  // spec: { x, z, h, steps: [[seconds, {gas, brake, drift, steer}], ...], v0 }
  const d = window.__dbg, c = d.car;
  d.carReset(spec.x, spec.z, spec.h);
  if (spec.v0) { c.vx = Math.sin(spec.h) * spec.v0; c.vz = Math.cos(spec.h) * spec.v0; }
  const out = [], ev = { crash: (k) => out.push(['crash', +k.toFixed(1)]), land() {}, sink() { out.push(['sink']); }, drift(t) { out.push(['drift', +t.toFixed(2)]); }, hitCar() {}, nearMiss() {}, knock() {}, pedDodge() {} };
  let t = 0, dist = 0, px = c.x, pz = c.z;
  const rec = [];
  for (const [secs, inp] of spec.steps) {
    const I = Object.assign({ gas: false, brake: false, drift: false, steer: 0 }, inp);
    const n = Math.round(secs * 120);
    for (let i = 0; i < n; i++) {
      d.carStep(1 / 120, I, ev);
      t += 1 / 120;
      dist += Math.hypot(c.x - px, c.z - pz); px = c.x; pz = c.z;
      if (i % 12 === 0) rec.push([+t.toFixed(2), +c.speed.toFixed(1), +c.vF.toFixed(1), +c.slip.toFixed(1), +(c.h * 180 / Math.PI).toFixed(0), Math.round(c.x), Math.round(c.z), c.surface]);
    }
  }
  return { rec, events: out, dist: +dist.toFixed(1), end: [Math.round(c.x), Math.round(c.z), +c.speed.toFixed(1), +(c.h * 180 / Math.PI).toFixed(0)] };
};
0;
'''

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate('localStorage.clear()')
        await page.evaluate(JS)
        await page.evaluate('window.__dbg.startFree()')
        S = await page.evaluate('window.__dbg.START')
        print('START', S)
        def run(spec):
            return page.evaluate('(s) => window.__phys(s)', spec)
        # 1. acceleration on Zhongxiao Road, then braking
        r = await run({'x': S['x'], 'z': S['z'], 'h': S['h'], 'steps': [[7, {'gas': True}], [1.6, {'brake': True}]]})
        print('ACCEL+BRAKE', json.dumps(r['rec'][::2]), r['events'], 'dist', r['dist'])
        # 2. coasting from top speed
        r = await run({'x': S['x'], 'z': S['z'], 'h': S['h'], 'v0': 38, 'steps': [[4, {}]]})
        print('COAST', json.dumps(r['rec'][::3]))
        # 3. reverse from rest
        r = await run({'x': S['x'], 'z': S['z'], 'h': S['h'], 'steps': [[2.5, {'brake': True}]]})
        print('REVERSE', json.dumps(r['rec'][-1]))
        # 4. turning circles in the open (Songshan airport field)
        for v in (12, 20, 30):
            r = await run({'x': 640, 'z': -330, 'h': 0, 'v0': v, 'steps': [[0.4, {'gas': True}], [2.0, {'gas': True, 'steer': 1}]]})
            rec = r['rec']
            dh = rec[-1][4] - rec[3][4]
            print(f'TURN v0={v}', 'surface', rec[-1][7], 'speed', rec[-1][1], 'heading change over 1.6s', dh, 'slip max', max(q[3] for q in rec))
        # 5. drift: 30 u/s, drift + full steer for 1.2 s, then release
        r = await run({'x': 640, 'z': -330, 'h': 0, 'v0': 30, 'steps': [[0.3, {'gas': True}], [1.2, {'gas': True, 'drift': True, 'steer': 1}], [1.0, {'gas': True}]]})
        print('DRIFT', json.dumps(r['rec'][::2]), r['events'])
        # 6. head-on into a building wall from 45 units away
        res = await page.evaluate('''() => {
          const d = window.__dbg;
          const B = d.BUILDINGS.find((b) => !b.hosp && !b.station && b.w > 14 && b.d > 12 && d.roadDist(b.x + Math.sin(b.rot) * (b.d / 2 + 14), b.z + Math.cos(b.rot) * (b.d / 2 + 14)) < 3);
          if (!B) return null;
          const nx = Math.sin(B.rot), nz = Math.cos(B.rot);
          const x = B.x + nx * (B.d / 2 + 45), z = B.z + nz * (B.d / 2 + 45);
          return { x, z, h: Math.atan2(-nx, -nz), b: [Math.round(B.x), Math.round(B.z)] };
        }''')
        if res:
            r = await run({'x': res['x'], 'z': res['z'], 'h': res['h'], 'steps': [[3.0, {'gas': True}], [1.5, {'brake': True}], [2.0, {'gas': True, 'steer': 1}]]})
            print('WALL', res['b'], json.dumps(r['rec'][::2]), r['events'])
        # 7. U-turn on Zhongxiao Road at 20 u/s: full steer + drift
        r = await run({'x': S['x'] + 80, 'z': S['z'], 'h': S['h'], 'v0': 20, 'steps': [[1.6, {'gas': True, 'drift': True, 'steer': 1}], [0.8, {'gas': True}]]})
        print('UTURN', json.dumps(r['rec'][::2]), r['events'])
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-1200:])
        await browser.close()

asyncio.run(main())

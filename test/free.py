"""Free mode: start, drive toward the next landmark with the autopilot, check discoveries, signals and pedestrians."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

AUTO = r'''
window.__drive = function (steps, siren) {
  const d = window.__dbg, st = window.__st || (window.__st = { stuck: 0, rev: 0 });
  for (let i = 0; i < steps; i++) {
    const car = d.car, k = d.keys;
    k.gas = k.brake = k.left = k.right = k.drift = false; k.siren = !!siren;
    const gp = d.guidePoint(11), t = d.guide.target;
    if (gp && t && d.G.state === 'play') {
      const want = Math.atan2(gp[0] - car.x, gp[1] - car.z);
      const diff = (((want - car.h) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      if (diff > 0.05) k.left = true; else if (diff < -0.05) k.right = true;
      const endD = Math.hypot(t.px - car.x, t.pz - car.z);
      const vt = endD < 4 ? 0 : endD < 22 ? 9 : Math.abs(diff) > 0.8 ? 9 : Math.abs(diff) > 0.35 ? 18 : 30;
      if (car.speed < vt) k.gas = true; else if (car.speed > vt + 3) k.brake = true;
      st.stuck = (car.speed < 1.2 && vt > 0 && !st.rev) ? st.stuck + 1 : 0;
      if (st.stuck > 50) { st.rev = 75; st.stuck = 0; }
      if (st.rev > 0) { st.rev--; k.gas = false; k.brake = true; k.left = k.right = false; if (diff > 0.05) k.right = true; else if (diff < -0.05) k.left = true; }
    }
    d.simulate(1 / 60);
    if (i % 10 === 0) d.updateGuide(true);
  }
  const reds = d.traffic.filter((v) => v.red).length, yields = d.traffic.filter((v) => v.yield).length;
  const near = d.traffic.filter((v) => Math.hypot(v.x - d.car.x, v.z - d.car.z) < 120).length;
  const states = {}; for (const p of d.peds) states[p.state] = (states[p.state] || 0) + 1;
  const pnear = d.peds.filter((p) => Math.hypot(p.x - d.car.x, p.z - d.car.z) < 120).length;
  return { found: [...d.FOUND], car: [Math.round(d.car.x), Math.round(d.car.z)], place: d.placeName(d.car.x, d.car.z), reds, yields, near, pnear, states, siren: +d.SIREN.t.toFixed(1) };
};
'''

async def main():
    secs = float(sys.argv[1]) if len(sys.argv) > 1 else 60
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate('localStorage.clear()')
        await page.evaluate(AUTO)
        await page.click('#freeBtn')
        await page.wait_for_timeout(300)
        r = await page.evaluate('window.__drive(30, false)')
        print('start', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, 'free_start')
        done, n = 0, 0
        while done < secs * 60:
            r = await page.evaluate(f'window.__drive(600, {str(n % 3 == 1).lower()})')
            done += 600; n += 1
            print(round(done / 60), json.dumps(r, ensure_ascii=False))
            if n in (2, 5):
                await page.wait_for_timeout(500)
                await shot(page, f'free_{n}')
        await page.evaluate('window.__dbg.openMap()')
        await page.wait_for_timeout(600)
        await shot(page, 'free_map')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-2500:])
        await browser.close()
asyncio.run(main())

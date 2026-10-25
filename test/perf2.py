import asyncio, json
from playwright.async_api import async_playwright
from harness import open_page
async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate('window.__dbg.startFree()')
        r = await page.evaluate('''(() => { const d = window.__dbg;
          const T = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t0) / n).toFixed(3); };
          for (let i = 0; i < 120; i++) d.simulate(1/60);
          const tr = T(() => d.trafficStep(1/60, false, d.car.x, d.car.z, 235, 140, 205), 300);
          const trS = T(() => d.trafficStep(1/60, true, d.car.x, d.car.z, 235, 140, 205), 300);
          const pd = T(() => d.pedStep(1/60, { pedDodge() {} }, false, d.car.x, d.car.z, 230, 110, 200), 300);
          const sim = T(() => d.simulate(1/60), 300);
          return { traffic: tr, trafficSiren: trS, peds: pd, sim };
        })()''')
        print(json.dumps(r))
        await browser.close()
asyncio.run(main())

import asyncio, json
from playwright.async_api import async_playwright
from harness import open_page
async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 800, 600)
        r = await page.evaluate('''(() => { const d = window.__dbg; const out = [];
          for (const [x, z] of [[-60, -920], [-40, -950], [-80, -990], [-110, -900], [-30, -900], [460, -870], [480, -900]]) {
            out.push({ x, z, ok: d.groundOK(x, z, 14), road: +d.roadDist(x, z).toFixed(1), alley: +d.alleyDist(x, z).toFixed(1), F: +d.landF(x, z).toFixed(1), park: +d.parkVal(x, z).toFixed(1), plaza: +d.plazaVal(x, z).toFixed(1), hill: +d.hillH(x, z).toFixed(2),
              blds: d.BUILDINGS.filter(b => Math.hypot(b.x - x, b.z - z) < 30).length });
          }
          return out; })()''')
        print(json.dumps(r, ensure_ascii=False, indent=0))
        await browser.close()
asyncio.run(main())

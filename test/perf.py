import asyncio, json
from playwright.async_api import async_playwright
from harness import open_page

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate('window.__dbg.startGame()')
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
          const T = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t0) / n).toFixed(3); };
          d.keys.gas = true;
          const sim = T(() => d.simulate(1/60), 600);
          d.keys.gas = false;
          const guide = T(() => d.updateGuide(true), 100);
          const dij = T(() => d.dijkstra(d.nearestOnRoads(d.car.x, d.car.z)), 100);
          const near = T(() => d.nearestOnRoads(d.car.x, d.car.z), 100);
          const dists = T(() => d.hospitalDistances(), 50);
          const t0 = performance.now(); d.renderer.render(d.scene, d.camera); const rend = performance.now() - t0;
          return { sim, guide, dij, near, dists, renderOnce: +rend.toFixed(1), nodes: Object.keys(d.NODES).length, edges: d.edges.length, peds: d.peds.length, traffic: d.traffic.length, knock: d.knock.length };
        })()''')
        print(json.dumps(r))
        await browser.close()
asyncio.run(main())

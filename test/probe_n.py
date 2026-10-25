import asyncio, json
from playwright.async_api import async_playwright
from harness import open_page
async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 800, 600)
        r = await page.evaluate('''(() => { const d = window.__dbg;
          const es = d.edges.filter(e => ['立德路','石牌路','承德路','中正路','文林路'].includes(e.name)).map(e => [e.name, e.a, e.b, e.pts[0].map(Math.round), e.pts[e.pts.length-1].map(Math.round), Math.round(e.len)]);
          const pr = d.nearestOnRoads(-40, -1029); return { es, near: [pr.e.name, Math.round(pr.d)], decks: d.DECKS.map(D => D.e.name) }; })()''')
        print(json.dumps(r, ensure_ascii=False, indent=0))
        await browser.close()
asyncio.run(main())

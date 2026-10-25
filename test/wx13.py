"""v13 weather: one shot per weather from the overhead and the chase view."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 900, 560)
        for wx in (sys.argv[1:] or ['day', 'rain', 'night', 'typhoon']):
            await page.evaluate(f'() => {{ const d = window.__dbg; d.showTitle(); d.G.wxPick = "{wx}"; d.G.homePick = "zq"; d.startGame(); d.G.countdown = 0.01; }}')
            await page.wait_for_timeout(1500)
            await page.evaluate('() => { const d = window.__dbg; d.keys.gas = true; }')
            await page.wait_for_timeout(2500)
            await page.evaluate('() => { const d = window.__dbg; d.keys.gas = false; }')
            await shot(page, f'wx_{wx}_top')
            await page.evaluate('() => { const d = window.__dbg; d.G.view = "chase"; }')
            await page.wait_for_timeout(1500)
            await shot(page, f'wx_{wx}_chase')
            r = await page.evaluate('() => { const d = window.__dbg; d.G.view = "top"; const r = d.renderer.info.render; return { wx: d.G.state, calls: r.calls, tris: r.triangles }; }')
            print(wx, json.dumps(r))
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

"""Big map screenshot (landscape). usage: python3 mapshot.py name [w h]"""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import open_page, shot
async def main():
    name = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1400; H = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('() => { const d = window.__dbg; d.G.wxPick = "day"; d.startFree(); d.openMap(); }')
        await page.wait_for_timeout(1500)
        await shot(page, f'map_{name}')
        print('\n'.join(l for l in logs if 'pageerror' in l)[-1500:])
        await browser.close()
asyncio.run(main())

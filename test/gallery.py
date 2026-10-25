"""Aerial views of the new district, from the title camera moved over each spot (UI hidden)."""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 760
SPOTS = [(a[0], *a[1:]) for a in [('market', 110, -730, 120, 70, 0.4), ('npm', 540, -990, 140, 70, 2.2), ('amuse', -90, -915, 120, 60, 1.2), ('tas', 323, -1107, 140, 80, 3.4), ('beitou', 60, -1270, 190, 100, 0.8), ('bridges', 60, -560, 220, 120, 5.6), ('st_sn', 160, -830, 75, 45, 0.6), ('st_bt', -100, -1250, 75, 45, 2.2), ('grand', 200, -540, 150, 70, 3.0), ('martyrs', 262, -560, 80, 45, 3.2), ('miramar', 667, -660, 140, 80, 3.0), ('xingtian', 335, -300, 80, 50, 3.6), ('baoan', -5, -480, 100, 55, 2.8), ('ciyou', 1000, -80, 110, 60, 3.4), ('huashan', 167, 30, 90, 50, 2.8), ('ningxia', -25, -127, 90, 50, 1.6), ('guandu', -520, -1240, 260, 130, 3.0), ('neihu', 980, -330, 200, 110, 4.0), ('shezi', -260, -780, 220, 120, 1.0)]]
import os
if os.environ.get('ONLY'): SPOTS = [s for s in SPOTS if s[0] in os.environ['ONLY'].split(',')]

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        if os.environ.get('WXG'): await page.evaluate(f'() => window.__dbg.applyWeather("{os.environ["WXG"]}")')
        await page.evaluate('''(() => { for (const id of ['title', 'hud']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; } })()''')
        for name, x, z, R, Hh, att in SPOTS:
            await page.evaluate(f'''(() => {{ const d = window.__dbg; Object.assign(d.TITLE_C, {{ x: {x}, z: {z}, R: {R}, H: {Hh} }}); d.camState.attract = {att}; d.populateAround({x}, {z}, true); }})()''')
            await page.wait_for_timeout(1800)
            await shot(page, f'gal_{name}_{W}')
            print(name)
        print('\n'.join(l for l in logs if 'pageerror' in l or 'error' in l.lower())[-1500:])
        await browser.close()
asyncio.run(main())

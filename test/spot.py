"""Place the car somewhere and screenshot. usage: python3 spot.py name x z heading [w h] [js]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

async def main():
    name, x, z, hh = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
    W = int(sys.argv[5]) if len(sys.argv) > 5 else 430
    H = int(sys.argv[6]) if len(sys.argv) > 6 else 932
    js = sys.argv[7] if len(sys.argv) > 7 else ''
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play'; d.carReset({x}, {z}, {hh}); d.camState.yaw = {hh}; d.camState.px = {x}; d.camState.pz = {z};
           for (let i = 0; i < 30; i++) d.simulate(1/60); {js} }})()''')
        await page.wait_for_timeout(1200)
        await shot(page, f'spot_{name}')
        print(json.dumps(await info(page)))
        print(json.dumps(await page.evaluate('(() => { const c = window.__dbg.camera; return [c.position.x, c.position.y, c.position.z, c.far]; })()')))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-2000:])
        await browser.close()
asyncio.run(main())

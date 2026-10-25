"""Aerial screenshot of a spot. usage: python3 aerial.py name x z [height] [w h] [tilt]
The camera hangs `height` above (x, z), looking straight down (north up) or tilted from the south."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def main():
    name, x, z = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    hgt = float(sys.argv[4]) if len(sys.argv) > 4 else 160
    W = int(sys.argv[5]) if len(sys.argv) > 5 else 900
    H = int(sys.argv[6]) if len(sys.argv) > 6 else 900
    tilt = float(sys.argv[7]) if len(sys.argv) > 7 else 0
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.wxPick = 'day'; d.startFree(); d.G.state = 'play';
          d.carReset({x}, {z}, 0); d.camState.px = {x}; d.camState.pz = {z};
          for (let i = 0; i < 20; i++) d.simulate(1 / 30);
          const c = d.camera; c.far = 3000; c.fov = 50; c.updateProjectionMatrix();
          c.up.set(0, 0, -1); c.position.set({x}, {hgt}, {z} + {tilt}); c.lookAt({x}, 0, {z});
          d.FX.hud && (d.FX.hud.visible = false); d.FX.arrow && (d.FX.arrow.visible = false);
          for (const k of [0, 1]) d.renderFrame();
          return d.placeName ? d.placeName({x}, {z}) : '' }})()''')
        await page.evaluate("() => { for (const e of document.querySelectorAll('#hud, .hud, #touch, #tbar')) e.style.display = 'none'; }")
        await page.wait_for_timeout(300)
        # one more render after the DOM settles (the game loop may have moved the camera back)
        await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'paused'; const c = d.camera; c.up.set(0, 0, -1); c.position.set({x}, {hgt}, {z} + {tilt}); c.lookAt({x}, 0, {z}); d.renderFrame(); }})()''')
        await shot(page, f'aerial_{name}')
        print(r)
        print('\n'.join(l for l in logs if 'pageerror' in l)[-1500:])
        await browser.close()
asyncio.run(main())

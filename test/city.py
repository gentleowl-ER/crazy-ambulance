"""City screenshots. usage: python3 city.py <scenario> [w h]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

SC = sys.argv[1] if len(sys.argv) > 1 else 'title'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 430
H = int(sys.argv[3]) if len(sys.argv) > 3 else 932


async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.wait_for_timeout(1200)
        if SC == 'title':
            await shot(page, f'title_{W}')
        elif SC == 'brief':
            await page.evaluate('window.__dbg.showBriefing("start")')
            await page.wait_for_timeout(600)
            await shot(page, f'brief_{W}')
            await page.evaluate('document.getElementById("brief").scrollTop = 900')
            await page.wait_for_timeout(300)
            await shot(page, f'brief2_{W}')
            await page.evaluate('document.getElementById("brief").scrollTop = 2400')
            await page.wait_for_timeout(300)
            await shot(page, f'brief3_{W}')
        elif SC == 'start':
            await page.evaluate('window.__dbg.startGame()')
            await page.wait_for_timeout(4300)
            await shot(page, f'start_{W}')
        elif SC == 'tour':
            spots = json.loads(sys.argv[4]) if len(sys.argv) > 4 else [
                ['station', 60, 36, 1.5708], ['cks', 30, 250, 3.1416], ['xinyi101', 780, 300, 3.1416], ['ntu', 300, 590, 1.5708],
                ['ximen', -141, 90, 0], ['longshan', -200, 230, -1.5708], ['daan', 283, 330, 0], ['dihua', -186, -200, 3.1416]]
            await page.evaluate('window.__dbg.startGame()')
            await page.wait_for_timeout(4000)
            for name, x, z, hh in spots:
                await page.evaluate(f'(() => {{ const d = window.__dbg; d.carReset({x}, {z}, {hh}); d.camState.yaw = {hh}; d.camState.px = {x}; d.camState.pz = {z}; d.G.time = 90; for (let i = 0; i < 40; i++) d.simulate(1/60); }})()')
                await page.wait_for_timeout(900)
                await shot(page, f'tour_{name}_{W}')
                print(name, json.dumps(await info(page)))
        elif SC == 'photo':
            cams = json.loads(sys.argv[4])
            await page.evaluate('window.__dbg.startGame()')
            await page.wait_for_timeout(500)
            await page.evaluate('window.__dbg.G.state = "paused"')
            for name, pos, look in cams:
                await page.evaluate(f'(() => {{ const c = window.__dbg.camera; c.far = 1500; c.updateProjectionMatrix(); c.position.set({pos[0]}, {pos[1]}, {pos[2]}); c.lookAt({look[0]}, {look[1]}, {look[2]}); }})()')
                await page.wait_for_timeout(900)
                await shot(page, f'photo_{name}_{W}')
        print(json.dumps(await info(page)))
        print('\n'.join(logs[-40:]))
        await browser.close()

asyncio.run(main())

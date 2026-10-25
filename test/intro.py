"""The opening: the gate in the cab, then the drive, the cut outside, the rise to the title."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 720
STEPS = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else [1.2, 3.0, 4.9, 6.9, 8.4, 9.0, 10.0, 11.2, 12.3]

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H, skip_intro=False)
        r = await page.evaluate('''(() => { const d = window.__dbg; return { state: d.G.state, len: Math.round(d.INTRO.len), pts: d.INTRO.pts.length,
            start: d.INTRO.pts[0].map(Math.round), end: d.INTRO.pts[d.INTRO.pts.length - 1].map(Math.round) }; })()''')
        print('gate', r)
        await page.wait_for_timeout(800)
        await shot(page, f'intro_gate_{W}')
        await page.click('#introGo', force=True)
        for th in STEPS:
            await page.wait_for_function(f'window.__dbg.INTRO.t >= {th} || window.__dbg.G.state !== "intro"', timeout=240000)
            r = await page.evaluate('''(() => { const d = window.__dbg; return { t: +d.INTRO.t.toFixed(2), s: Math.round(d.INTRO.s), v: +d.INTRO.v.toFixed(1), car: [Math.round(d.car.x), Math.round(d.car.z)],
                state: d.G.state, siren: d.SIREN.t > 0, yielding: d.traffic.filter(v => v.yield).length, cls: document.getElementById('intro').className,
                cap: document.getElementById('introCap').textContent.slice(0, 30) }; })()''')
            print(th, r)
            await shot(page, f'intro_{W}_{str(th).replace(".", "_")}')
        await page.wait_for_function('window.__dbg.G.state === "title"', timeout=240000)
        await page.wait_for_timeout(1200)
        await shot(page, f'intro_title_{W}')
        r = await page.evaluate('''(() => ({ seen: JSON.parse(localStorage.getItem('crazy-ambulance-v1') || '{}').intro, state: window.__dbg.G.state }))()''')
        print('end', r)
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-2500:])
        await browser.close()
asyncio.run(main())

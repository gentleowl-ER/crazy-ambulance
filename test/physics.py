"""Physics checks in virtual time: river ramp jump, hump jump, pier drop, wall collision."""
import asyncio, json, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()

CASES = r'''
window.__phys = function (name, x, z, h, v, secs, steer, drift) {
  const d = window.__dbg, c = d.car;
  d.G.state = "play";
  d.carReset(x, z, h);
  c.vx = Math.sin(h) * v; c.vz = Math.cos(h) * v;
  const trace = []; let maxAir = 0, maxY = 0, sank = false, landed = null;
  for (let i = 0; i < secs * 60; i++) {
    d.keys.gas = true; d.keys.left = steer < 0; d.keys.right = steer > 0; d.keys.drift = !!drift;
    const wasAir = c.airborne;
    d.simulate(1 / 60);
    if (c.airborne) maxAir = Math.max(maxAir, c.airT);
    maxY = Math.max(maxY, c.y);
    if (c.sinking) sank = true;
    if (wasAir && !c.airborne && !landed) landed = [Math.round(c.x), Math.round(c.z), d.landF(c.x, c.z).toFixed(1)];
    if (i % 15 === 0) trace.push([Math.round(c.x), Math.round(c.z), +c.y.toFixed(2), +c.speed.toFixed(1), c.surface, c.airborne ? 'AIR' : '']);
  }
  for (const k in d.keys) d.keys[k] = false;
  return { name, maxAir: +maxAir.toFixed(2), maxY: +maxY.toFixed(2), sank, landed, end: trace[trace.length - 1], trace: trace.slice(0, 14) };
};
'''

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await (await browser.new_context(viewport={'width': 430, 'height': 932})).new_page()
        logs = []
        page.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        async def handle(route):
            url = route.request.url
            if 'three.min.js' in url: await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
            elif url.startswith('file://'): await route.continue_()
            else: await route.abort()
        await page.route('**/*', handle)
        await page.goto('file://' + str(ROOT / 'test.html'))
        await page.wait_for_function('window.__dbg && window.__dbg.G.state === "title"', timeout=60000)
        await page.evaluate(CASES)
        await page.evaluate('window.__dbg.startGame()')
        cases = [
            ('river jump fast', -45, 61.5, -1.5708, 37, 3.2, 0, 0),
            ('river jump slow', -60, 61.5, -1.5708, 22, 3.2, 0, 0),
            ('pier drop', 100, 200, 0, 25, 3.5, 0, 0),
            ('drift on town road', 30, 4, 1.5708, 34, 2.0, 1, 1),
            ('house wall', 60, 20, 0, 30, 1.5, 0, 0),
        ]
        for c in cases:
            r = await page.evaluate(f'window.__phys({json.dumps(c[0])}, {c[1]}, {c[2]}, {c[3]}, {c[4]}, {c[5]}, {c[6]}, {c[7]})')
            print(json.dumps(r, ensure_ascii=False))
        # hump: find hump 0 and drive over it
        r = await page.evaluate('''(() => { const d = window.__dbg; const e = d.edges[7]; return null; })()''')
        print('\n'.join(logs))
        await browser.close()

asyncio.run(main())

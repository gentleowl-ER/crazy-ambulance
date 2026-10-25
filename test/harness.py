"""Shared Playwright harness: opens test.html in headless Chromium (SwiftShader WebGL),
serves three.js locally and blocks every other network request."""
import pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()
OUT = ROOT / 'out'
OUT.mkdir(exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']


async def open_page(p, w=430, h=932, touch=None, wait_title=True, skip_intro=True):
    browser = await p.chromium.launch(args=ARGS)
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=(w < 700) if touch is None else touch)
    page = await ctx.new_page()
    logs = []
    page.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    page.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))

    async def handle(route):
        url = route.request.url
        if 'three.min.js' in url:
            await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
        elif url.startswith('file://'):
            await route.continue_()
        else:
            await route.abort()
    await page.route('**/*', handle)
    page.set_default_timeout(180000)
    await page.goto('file://' + str(ROOT / 'test.html'))
    if wait_title:
        try:
            # the game opens in the ambulance cab (the intro gate); most tests go straight to the title
            await page.wait_for_function('window.__dbg && (window.__dbg.G.state === "title" || window.__dbg.G.state === "gate")', timeout=120000)
            if skip_intro:
                await page.evaluate('window.__dbg.G.state === "gate" && window.__dbg.endIntro()')
                await page.wait_for_function('window.__dbg.G.state === "title"', timeout=30000)
        except Exception as e:
            logs.append('TIMEOUT waiting for title: ' + str(e))
    return browser, page, logs


async def shot(page, name):
    await page.screenshot(path=str(OUT / f'{name}.png'))


async def info(page):
    return await page.evaluate('''() => { const d = window.__dbg; if (!d) return null; const r = d.renderer.info;
      return { state: d.G.state, car: [Math.round(d.car.x), Math.round(d.car.z), +d.car.speed.toFixed(1), d.car.surface], patients: d.patients.length,
        calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, colliders: d.colliders.length, spawn: d.spawnPts.length, far: Math.round(d.camera.far) }; }''')

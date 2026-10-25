import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await (await b.new_context(viewport={'width': 430, 'height': 932})).new_page()
        async def handle(route):
            url = route.request.url
            if 'three.min.js' in url: await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
            elif url.startswith('file://'): await route.continue_()
            else: await route.abort()
        await page.route('**/*', handle)
        await page.goto('file://' + str(ROOT / 'test.html'))
        await page.wait_for_function('window.__dbg && window.__dbg.G.state === "title"', timeout=60000)
        await page.evaluate('window.__dbg.startGame()')
        setup = '''(() => { const d = window.__dbg; d.G.state = "play"; d.carReset(236, 70, 1.5708); d.camState.yaw = 1.5708; for (let i = 0; i < 40; i++) d.simulate(1/60); })()'''
        await page.evaluate(setup)
        await page.wait_for_timeout(1500)
        await page.screenshot(path='out/probe_a.png')
        await page.evaluate('''(() => { const d = window.__dbg; d.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.position.count === 30) { o.receiveShadow = false; o.material = o.material.clone(); } }); })()''')
        await page.wait_for_timeout(1500)
        await page.screenshot(path='out/probe_b.png')
        await b.close()
asyncio.run(main())

import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()
async def main():
    js = sys.argv[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await (await b.new_context(viewport={'width': 430, 'height': 932})).new_page()
        logs = []
        page.on('console', lambda m: logs.append(m.text))
        page.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        async def handle(route):
            url = route.request.url
            if 'three.min.js' in url: await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
            elif url.startswith('file://'): await route.continue_()
            else: await route.abort()
        await page.route('**/*', handle)
        await page.goto('file://' + str(ROOT / 'test.html'))
        await page.wait_for_function('window.__dbg && window.__dbg.G.state === "title"', timeout=60000)
        r = await page.evaluate(js)
        print(json.dumps(r, ensure_ascii=False, indent=1))
        print('\n'.join(l for l in logs if 'Failed to load' not in l)[-3000:])
        await b.close()
asyncio.run(main())

import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot
async def main():
    W = int(sys.argv[1]); H = int(sys.argv[2])
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.wait_for_timeout(500)
        await shot(page, f'ui2_title_{W}')
        await page.click('#startBtn'); await page.wait_for_timeout(400)
        await page.evaluate('''(() => { const r = document.getElementById('rules'); r.scrollIntoView({ block: 'center' }); })()''')
        await page.wait_for_timeout(300)
        await shot(page, f'ui2_rules_{W}')
        await page.click('#briefBack'); await page.wait_for_timeout(300)
        await page.click('#freeBtn'); await page.wait_for_timeout(300)
        await page.evaluate('(() => { const d = window.__dbg; for (let i = 0; i < 240; i++) d.simulate(1/60); })()')
        await page.evaluate('window.__dbg.openMap()'); await page.wait_for_timeout(700)
        await shot(page, f'ui2_map_{W}')
        await page.click('#mapClose'); await page.wait_for_timeout(200)
        await page.evaluate('window.__dbg.G.state') 
        await page.click('#pauseBtn'); await page.wait_for_timeout(300)
        await shot(page, f'ui2_pause_{W}')
        await page.click('#quitBtn'); await page.wait_for_timeout(300)
        print(await page.evaluate('window.__dbg.G.state'))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-1500:])
        await browser.close()
asyncio.run(main())

"""Real-time UI walkthrough with clicks and keys; reports errors and state transitions."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def st(page):
    return await page.evaluate('(() => { const d = window.__dbg; return { s: d.G.state, riding: d.riding && d.riding.c.id, dest: d.riding && d.riding.dest && d.riding.dest.id, t: +d.G.time.toFixed(1) }; })()')

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 1280, 800, touch=False)
        await page.click('#startBtn'); await page.wait_for_timeout(500)
        print('after start', await st(page))
        await page.click('#goBtn'); await page.wait_for_timeout(300)
        await page.evaluate('(() => { const d = window.__dbg; for (let i = 0; i < 240 && d.G.state === "countdown"; i++) d.simulate(1/60); })()')
        print('after go', await st(page))
        await page.keyboard.down('KeyW'); await page.wait_for_timeout(300)
        await page.evaluate('(() => { const d = window.__dbg; for (let i = 0; i < 90; i++) d.simulate(1/60); })()')
        await page.keyboard.up('KeyW')
        await page.keyboard.press('Tab'); await page.wait_for_timeout(300)
        print('sel after tab', await page.evaluate('window.__dbg.selCall && window.__dbg.selCall.c.id'))
        # teleport onto the selected call
        await page.evaluate('''(() => { const d = window.__dbg; const p = d.selCall || d.waitingCalls()[0]; d.carReset(p.rx, p.rz, d.car.h); for (let i = 0; i < 90 && d.G.state === 'play'; i++) d.simulate(1/60); })()''')
        await page.wait_for_timeout(600)
        print('after pickup', await st(page))
        await shot(page, 'ui_panel')
        await page.keyboard.press('Digit1'); await page.wait_for_timeout(400)
        print('after key 1', await st(page))
        await page.keyboard.press('KeyP'); await page.wait_for_timeout(300)
        print('after P', await st(page))
        await page.click('#briefBtn2'); await page.wait_for_timeout(500)
        await shot(page, 'ui_pausebrief')
        await page.click('#goBtn'); await page.wait_for_timeout(400)
        print('after brief resume', await st(page))
        await page.keyboard.press('KeyC'); await page.wait_for_timeout(300)
        print('after C', await st(page))
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        print('after Esc', await st(page))
        await page.click('#mission'); await page.wait_for_timeout(300)
        print('after mission click', await st(page))
        await page.click('.drow[data-i="2"]'); await page.wait_for_timeout(300)
        print('after row click', await st(page))
        await page.wait_for_timeout(1000)
        await shot(page, 'ui_driving')
        # finish the shift quickly
        await page.evaluate('(() => { const d = window.__dbg; d.G.time = 1.2; for (let i = 0; i < 260; i++) d.simulate(1/60); })()')
        await page.wait_for_timeout(600)
        print('end', await st(page))
        await shot(page, 'ui_over')
        await page.click('#againBtn'); await page.wait_for_timeout(500)
        await page.evaluate('(() => { const d = window.__dbg; for (let i = 0; i < 240 && d.G.state === "countdown"; i++) d.simulate(1/60); })()')
        print('again', await st(page))
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        await page.click('#restartBtn'); await page.wait_for_timeout(300)
        print('restart', await st(page))
        await page.keyboard.press('KeyP'); await page.wait_for_timeout(200)
        await page.click('#resumeBtn'); await page.wait_for_timeout(200)
        print('resume', await st(page))
        errs = [l for l in logs if 'ERR_FAILED' not in l]
        print('\n'.join(errs[-30:]))
        await browser.close()
asyncio.run(main())

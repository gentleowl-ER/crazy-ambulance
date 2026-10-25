"""v13 UI: the garage, the weather picker on the briefing, road events on the maps, the 12th hospital key."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        # garage: some money, buy two levels
        await page.evaluate('() => { const d = window.__dbg; d.G.bank = 4000; d.showGarage(); }')
        await page.wait_for_timeout(500)
        await shot(page, f'u13_garage0_{W}')
        await page.click('#garageList [data-up="engine"]')
        await page.click('#garageList [data-up="tyre"]')
        await page.wait_for_timeout(300)
        r = await page.evaluate('() => { const d = window.__dbg; return { bank: d.G.bank, lv: Object.assign({}, d.UPG_LV), drv: Object.assign({}, d.DRV), saved: JSON.parse(localStorage.getItem("crazy-ambulance-v1") || "{}").upg }; }')
        print('garage', json.dumps(r))
        await shot(page, f'u13_garage1_{W}')
        await page.click('#garageBack')
        # briefing with the weather row
        await page.click('#startBtn')
        await page.wait_for_timeout(800)
        await page.click('#wxRow [data-wx="typhoon"]')
        await page.wait_for_timeout(300)
        r = await page.evaluate('() => ({ pick: window.__dbg.G.wxPick, note: document.getElementById("wxNote").textContent, hcards: document.querySelectorAll(".hcard").length, real: [...document.querySelectorAll(".hcard .real")].map((e) => e.textContent) })')
        print('brief', json.dumps(r, ensure_ascii=False))
        await page.evaluate('() => document.getElementById("wxPick").scrollIntoView()')
        await shot(page, f'u13_brief_wx_{W}')
        await page.evaluate('() => document.getElementById("briefMap").scrollIntoView()')
        await page.wait_for_timeout(300)
        await shot(page, f'u13_brief_map_{W}')
        # into the shift: a road event, the big map
        await page.click('#goBtn')
        await page.wait_for_timeout(1500)
        r = await page.evaluate('''() => { const d = window.__dbg; d.G.countdown = 0.01; for (let i = 0; i < 4; i++) d.simulate(1 / 30);
          const out = []; for (const t of ['works', 'crash', 'closed']) { const R = d.spawnRoadEvent(t, [d.car.x + 120, d.car.z]); if (R) out.push([t, R.e.name]); }
          return { wx: d.WX.id, timer: document.getElementById('timerLbl').textContent, ev: out }; }''')
        print('shift', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1200)
        await shot(page, f'u13_hud_{W}')
        await page.evaluate('() => window.__dbg.openMap()')
        await page.wait_for_timeout(800)
        await shot(page, f'u13_bigmap_{W}')
        await page.evaluate('() => window.__dbg.closeMap()')
        # the 12th hospital by keyboard: "=" picks 雙聖 (and is refused)
        r = await page.evaluate('''() => { const d = window.__dbg; const e = new KeyboardEvent('keydown', { key: '=', code: 'Equal' }); return d.HOSPITALS.length; }''')
        print('hospitals', r)
        # the results line with the fund
        await page.evaluate('() => { const d = window.__dbg; d.G.score = 1234; d.endGame(); }')
        await page.wait_for_timeout(3500)
        r = await page.evaluate('() => ({ state: window.__dbg.G.state, er: document.getElementById("erLine").textContent, bank: window.__dbg.G.bank })')
        print('results', json.dumps(r, ensure_ascii=False))
        await shot(page, f'u13_over_{W}')
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

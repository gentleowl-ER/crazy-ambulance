"""v14 mass-casualty incident: spawn it, drive up, triage (one card deliberately wrong), take a red, watch the backup."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('() => { const d = window.__dbg; d.G.wxPick = "day"; d.G.homePick = "da"; d.startGame(); d.G.countdown = 0.01; for (let i = 0; i < 3; i++) d.simulate(1 / 30); }')
        r = await page.evaluate('''() => { const d = window.__dbg; d.spawnMCI(); const M = d.MCI.cur; if (!M) return null;
          return { type: M.type.id, n: M.cas.length, lead: M.lead.name, kinds: M.cas.map((c) => c.kid), guide: d.guide.kind, sel: d.selCall === M.lead, calls: d.waitingCalls().length }; }''')
        print('spawn', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1500)
        await shot(page, f'mci_alert_{W}')
        # drive up: put the ambulance next to the scene and let the sim notice
        r = await page.evaluate('''() => { const d = window.__dbg, M = d.MCI.cur, L = M.lead;
          d.carReset(L.rx + 3, L.rz, 0); d.camState.px = L.rx; d.camState.pz = L.rz;
          for (let i = 0; i < 20 && d.G.state === 'play'; i++) d.simulate(1 / 30);
          return { state: d.G.state, phase: M.phase, cards: document.querySelectorAll('#mciList .mcard').length, go: document.getElementById('mciGo').textContent }; }''')
        print('arrive', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, f'mci_triage_{W}')
        # tag all correctly but one red as yellow (under-triage)
        r = await page.evaluate('''() => { const d = window.__dbg, M = d.MCI.cur; let wrong = -1;
          M.cas.forEach((c, i) => { let t = c.k.tag; if (wrong < 0 && t === 'red') { t = 'yellow'; wrong = i; } d.mciTag(i, t); });
          const go = document.getElementById('mciGo'); const en = !go.disabled; d.mciConfirm();
          return { wrong, goEnabled: en, ok: M.ok, phase: M.phase, score: d.G.score, take: [...document.querySelectorAll('#mciTake [data-take]')].map((b) => +b.dataset.take),
            res: [...document.querySelectorAll('.mres')].map((e) => e.textContent) }; }''')
        print('triage', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, f'mci_graded_{W}')
        await page.evaluate('() => { document.querySelector("#mciTake [data-take]").click(); }')
        await page.wait_for_timeout(500)
        r = await page.evaluate('() => { const d = window.__dbg; return { state: d.G.state, riding: d.riding && d.riding.c.id, rows: document.querySelectorAll("#destRows .drow").length, best: d.riding && d.HOSPITALS[d.riding.eval.best].name }; }')
        print('take', json.dumps(r, ensure_ascii=False))
        await shot(page, f'mci_dest_{W}')
        # choose the best hospital and let the backup run for 100 s of game time
        r = await page.evaluate('''() => { const d = window.__dbg; d.chooseDest(d.riding.eval.best); d.G.time = 999;
          for (let i = 0; i < 3000; i++) { d.riding && (d.riding.life = 99); d.simulate(1 / 30); }
          return { state: d.G.state, ended: !d.MCI.cur || d.MCI.cur.ended, log: d.caseLog.map((r) => [r.c.id, r.outcome, r.hosp ? r.hosp.name : '']), medals: d.SHIFT.medals.slice() }; }''')
        print('backup', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1200)
        await shot(page, f'mci_end_{W}')
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

"""v14: dispatch follow-up questions + priority, and the free-mode address challenge."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        # ---- dispatch: a stroke call, ask, follow up, judge ----
        await page.evaluate('() => { const d = window.__dbg; d.G.wxPick = "day"; d.startDispatch(); }')
        await page.wait_for_timeout(800)
        r = await page.evaluate('''() => { const d = window.__dbg;
          d.D.hold = 0; d.DQ.length = 0; const c = d.spawnDCall(d.CASES.find((x) => x.id === 'stroke'));
          for (let i = 0; i < 6 && !d.dcur; i++) d.simulate(1 / 30);
          return { state: d.G.state, cur: d.dcur && d.dcur.c.c.id, pre: document.getElementById('dpPre').textContent.slice(0, 80) }; }''')
        print('call', json.dumps(r, ensure_ascii=False))
        await page.click('[data-ask]')
        await page.wait_for_timeout(200)
        r = await page.evaluate('() => [...document.querySelectorAll("[data-fq]")].map((b) => b.textContent)')
        print('follow-ups', json.dumps(r, ensure_ascii=False))
        await page.click('[data-fq="0"]'); await page.click('[data-fq="1"]')
        await page.wait_for_timeout(200)
        await page.evaluate('() => document.getElementById("dpanel").scrollTop = 9999')
        await shot(page, f'v14_follow_{W}')
        await page.click('[data-prio="red"]')
        await page.wait_for_timeout(300)
        r = await page.evaluate('''() => { const d = window.__dbg; return { score: d.D.score, prio: d.dcur.c.prio, res: document.querySelector('.prio-res') && document.querySelector('.prio-res').textContent,
          suggest: [...document.querySelectorAll('#dpRows .drow em')].map((e) => e.textContent) }; }''')
        print('judge', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v14_judge_{W}')
        # a minor call judged wrong
        r = await page.evaluate('''() => { const d = window.__dbg; const u = d.units.find((u) => d.unitFree(u)); d.dispatchUnit(d.dcur.c, u);
          d.D.hold = 0; d.DQ.length = 0; d.spawnDCall(d.CASES.find((x) => x.id === 'sprain')); for (let i = 0; i < 6 && !d.dcur; i++) d.simulate(1 / 30);
          const c = d.dcur.c; c.asked = true; d.askFollow(c, 2); d.judgePriority(c, 'red');
          return { prio: c.prio, tri: c.c.tri, score: d.D.score, res: document.querySelector('.prio-res') && document.querySelector('.prio-res').textContent }; }''')
        print('wrong', json.dumps(r, ensure_ascii=False))
        # ---- free mode: the address challenge ----
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.startFree(); }')
        await page.wait_for_timeout(600)
        r = await page.evaluate('''() => { const d = window.__dbg; const T = d.addrTargets(); return { n: T.length, clues: T.slice(10, 22).map((t) => t.full + '：' + t.clue) }; }''')
        print('targets', json.dumps(r, ensure_ascii=False))
        await page.click('#addrBtn')
        await page.wait_for_timeout(1500)
        r = await page.evaluate('''() => { const d = window.__dbg, A = d.G.addr; return { name: A && A.full, clue: A && A.clue, L: A && Math.round(A.L), lim: A && A.lim.map(Math.round), guide: d.guide.pts.length,
          title: document.getElementById('missionTitle').textContent, sub: document.getElementById('missionSub').textContent, btn: document.getElementById('addrBtn').textContent }; }''')
        print('addr', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v14_addr_{W}')
        await page.evaluate('() => window.__dbg.openMap()')
        await page.wait_for_timeout(500)
        await page.evaluate('() => window.__dbg.closeMap()')
        r = await page.evaluate('''() => { const d = window.__dbg, A = d.G.addr; const t0 = A.t;
          d.carReset(A.x, A.z, 0); for (let i = 0; i < 10 && d.G.addr; i++) d.simulate(1 / 30);
          return { peeks: A.peeks, t: +A.t.toFixed(1), done: !d.G.addr, best: d.ADDR_BEST[A.name], card: document.getElementById('casecard').textContent.slice(0, 90) }; }''')
        print('finish', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(2000)
        await shot(page, f'v14_addr_done_{W}')
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

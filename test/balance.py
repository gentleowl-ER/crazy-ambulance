"""Mission-mode difficulty: run whole shifts with the autopilot at several skill levels and report who dies.
usage: python3 balance.py profile [runs]   profile: pro | good | casual | novice"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page

AUTO = open(__file__.replace('balance.py', 'play.py')).read().split("AUTO = r'''")[1].split("'''")[0]
PROFILES = {  # siren, wrong-hospital probability, cruising speed (ambulance tops out at 38), cornering speed, approach speed
    'ace': (True, 0.0, 38, 26, 14), 'pro': (True, 0.0, 38, 18, 9), 'good': (True, 0.1, 33, 18, 9), 'casual': (True, 0.3, 26, 16, 8), 'novice': (False, 0.45, 22, 14, 7),
}
HOOK = r'''
window.__bal = { board: [], deliver: [], lost: [], prev: null, prevLife: 0, saved: 0, t: 0, mt: 0, md: 0, seen: new Set(), budgets: [] };
window.__afterStep = () => { const d = window.__dbg, B = window.__bal, r = d.riding;
  for (const q of d.patients) if (!B.seen.has(q.id)) { B.seen.add(q.id); B.budgets.push({ tri: q.c.tri, life0: Math.round(q.life0), old: q.c.life + (q.cpr ? 25 : 0), rate: q.rate || 1 }); }
  if (d.G.state === 'play') { B.t += 1 / 60; if (d.car.speed > 3) { B.mt += 1 / 60; B.md += d.car.speed / 60; } }
  if (r && r !== B.prev) B.board.push({ tri: r.c.tri, id: r.c.id, waited: +(r.life0 - r.life).toFixed(1), left: +r.life.toFixed(1), life0: r.life0 });
  if (d.G.saved > B.saved && B.prev) B.deliver.push({ tri: B.prev.c.tri, id: B.prev.c.id, total: +(B.prev.life0 - B.prevLife).toFixed(1), margin: +B.prevLife.toFixed(1), frac: +(B.prevLife / B.prev.life0).toFixed(2) });
  B.saved = d.G.saved; B.prev = r; B.prevLife = r ? r.life : 0; };
0;
'''

async def main():
    prof = sys.argv[1] if len(sys.argv) > 1 else 'good'
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    siren, wrong, vmax, vturn, vnear = PROFILES[prof]
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate(AUTO)
        for run in range(runs):
            await page.evaluate(f'window.__useSiren = {str(siren).lower()}; window.__vmax = {vmax}; window.__vturn = {vturn}; window.__vnear = {vnear}; window.__log = []; window.__st = null;')
            await page.evaluate(HOOK)
            await page.evaluate('window.__dbg.showTitle(); window.__dbg.startGame()')
            st, n = 'countdown', 0
            while st in ('play', 'countdown', 'choose') and n < 60:
                res = await page.evaluate(f'window.__auto(1200, {wrong})')
                st = res['state']; n += 1
            out = await page.evaluate('''() => { const d = window.__dbg, B = window.__bal, L = window.__log;
              const by = {}; for (const r of d.caseLog) { const k = r.c.tri; by[k] = by[k] || {}; by[k][r.outcome] = (by[k][r.outcome] || 0) + 1; }
              const deadWait = L.filter((e) => e.ev === 'dead' && !e.riding).map((e) => e.case), deadRide = L.filter((e) => e.ev === 'dead' && e.riding).map((e) => e.case);
              const avg = (a, f) => a.length ? +(a.reduce((s, x) => s + f(x), 0) / a.length).toFixed(2) : null;
              const tri = (t) => B.deliver.filter((x) => x.tri === t);
              return { score: d.G.score, shift: 'over', saved: d.G.saved, dead: d.G.dead, left: d.G.left, rejects: d.G.rejects, outcomes: by, deadWaiting: deadWait, deadOnBoard: deadRide,
                deliveries: B.deliver.length, avgWaitBeforePickup: avg(B.board, (x) => x.waited), avgCallToHospital: avg(B.deliver, (x) => x.total),
                marginFrac: { red: avg(tri('red'), (x) => x.frac), yellow: avg(tri('yellow'), (x) => x.frac), green: avg(tri('green'), (x) => x.frac) },
                minMarginSec: B.deliver.length ? Math.min(...B.deliver.map((x) => x.margin)) : null, unstuck: (window.__st && window.__st.unstuck) || 0,
                playSec: Math.round(B.t), movingSpeed: +(B.md / Math.max(1, B.mt)).toFixed(1), movingShare: +(B.mt / Math.max(1, B.t)).toFixed(2), calls: d.caseLog.length,
                budgetVsOld: ['red', 'yellow', 'green'].map((t) => { const a = B.budgets.filter((x) => x.tri === t); return t + ' ' + (a.length ? Math.round(a.reduce((s, x) => s + x.life0, 0) / a.length) + '/' + Math.round(a.reduce((s, x) => s + x.old, 0) / a.length) : '-'); }).join(', ') }; }''')
            print(prof, run, json.dumps(out, ensure_ascii=False), flush=True)
        errs = [l for l in logs if 'error' in l.lower() and 'ERR_FAILED' not in l]
        if errs: print('\n'.join(errs[-10:]))
        await browser.close()

asyncio.run(main())

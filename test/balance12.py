"""v12 mission balance: whole shifts from a given duty station with a hospital policy.
usage: python3 balance12.py station policy [runs]
  station: zq zs da xy sn bt   policy: ideal (crowding-aware best) | center (nearest medical centre) | nearest (nearest that can treat)"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
from harness import open_page

AUTO = open(__file__.replace('balance12.py', 'play.py')).read().split("AUTO = r'''")[1].split("'''")[0]
AUTO = AUTO.replace('let pickI = ev.best;', 'let pickI = window.__hpick ? window.__hpick(r) : ev.best;')
assert '__hpick' in AUTO
# a better driver for balance runs: siren on all the time, down the middle of the road, past cars that pull over
AUTO = AUTO.replace("k.siren = !!d.riding && window.__useSiren;", "k.siren = window.__useSiren;")
AUTO = AUTO.replace("gp = [gp[0] - (uz / ul) * 3, gp[1] + (ux / ul) * 3];", "gp = [gp[0] - (uz / ul) * 0.6, gp[1] + (ux / ul) * 0.6];")
AUTO = AUTO.replace("for (const v of d.traffic) { const ox = v.x - car.x", "for (const v of d.traffic) { if (v.yield) continue; const ox = v.x - car.x")
assert AUTO.count('v.yield') == 1 and 'k.siren = window.__useSiren;' in AUTO and '* 0.6' in AUTO
# not stuck while waiting for an ER bed; stuck twice in the same spot: press R like a player would
AUTO = AUTO.replace("st.stuck = (car.speed < 1.2 && vt > 0 && !st.rev)", "st.stuck = (car.speed < 1.2 && vt > 0 && !st.rev && !d.hold)")
AUTO = AUTO.replace("st.rev = 75; st.stuck = 0; st.unstuck = (st.unstuck || 0) + 1;",
  "st.rev = 75; st.stuck = 0; st.unstuck = (st.unstuck || 0) + 1; const sp0 = st.sp || [1e9, 1e9]; if (Math.hypot(car.x - sp0[0], car.z - sp0[1]) < 4) { (window.__rs = window.__rs || []).push([Math.round(car.x), Math.round(car.z), d.riding ? 'r' : '-', d.guide && d.guide.kind]); d.respawnCar(); st.rev = 0; st.resets = (st.resets || 0) + 1; } st.sp = [car.x, car.z];")
assert '!d.hold' in AUTO and 'd.respawnCar()' in AUTO and '__rs' in AUTO

PICK = r'''
window.__hpick = function (r) {
  const d = window.__dbg, pol = window.__hpol, ev = r.eval;
  if (pol === 'ideal') return ev.best;
  const dist = d.hospitalDistances();
  const ok = d.HOSPITALS.map((H, i) => i).filter((i) => d.accepts(d.HOSPITALS[i], r.c) && !d.isDiverted(d.HOSPITALS[i]) && !r.rejected.has(d.HOSPITALS[i].id));
  let pool = ok;
  if (pol === 'center') { const sev = ok.filter((i) => d.HOSPITALS[i].level === 'severe'); if (sev.length) pool = sev; }
  return pool.length ? pool.sort((a, b) => dist[a] - dist[b])[0] : ev.best;
};
window.__erTrack = { peak: {}, samples: 0, sum: {} };
window.__afterStep = () => { const d = window.__dbg, T = window.__erTrack;
  if (d.G.state !== 'play') return;
  T.samples++;
  for (const H of d.HOSPITALS) if (H.er) { const r = H.er.n / H.er.cap; T.peak[H.name] = Math.max(T.peak[H.name] || 0, r); T.sum[H.name] = (T.sum[H.name] || 0) + r; } };
0;
'''

async def main():
    station = sys.argv[1] if len(sys.argv) > 1 else 'sn'
    pol = sys.argv[2] if len(sys.argv) > 2 else 'ideal'
    runs = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate(AUTO)
        for run in range(runs):
            await page.evaluate(f'window.__useSiren = true; window.__vmax = 33; window.__vturn = 18; window.__vnear = 9; window.__log = []; window.__st = null; window.__hpol = "{pol}";')
            await page.evaluate(PICK)
            await page.evaluate(f'() => {{ const d = window.__dbg; d.showTitle(); d.G.wxPick = "{os.environ.get('WX', 'day')}"; d.G.homePick = "{station}"; d.startGame(); }}')
            if os.environ.get('NOREV'):
                await page.evaluate('() => { window.__dbg.ROADEV.t = 1e9; }')
            if os.environ.get('LEGACY'):
                # v11 rules for comparison: calls around the ambulance, no ER crowding, no cap on the time bonus
                await page.evaluate('''() => { const d = window.__dbg; d.G.home = undefined; for (const H of d.HOSPITALS) H.er = null;
                  const prev = window.__afterStep; window.__afterStep = () => { d.G.cycleT = 1e9; if (prev) prev(); }; }''')
            st, n = 'countdown', 0
            while st in ('play', 'countdown', 'choose', 'mci') and n < 80:
                if st == 'mci':
                    # a mass-casualty scene: tag by START (the bot gets them right), take the first red
                    await page.evaluate('() => { const d = window.__dbg, M = d.MCI.cur; M.cas.forEach((c, i) => d.mciTag(i, c.k.tag)); d.mciConfirm(); d.mciTake(M.cas.findIndex((c) => c.tag === "red")); }')
                res = await page.evaluate('window.__auto(1200, 0)')
                st = res['state']; n += 1
            out = await page.evaluate('''() => { const d = window.__dbg, T = window.__erTrack, L = window.__log, G = d.G;
              const sev = d.HOSPITALS.filter((H) => H.level === 'severe');
              const by = {}; for (const r of d.caseLog) { by[r.outcome] = (by[r.outcome] || 0) + 1; }
              const hosp = {}; for (const r of d.caseLog) if (r.outcome === 'saved' && r.hosp) hosp[r.hosp.name] = (hosp[r.hosp.name] || 0) + 1;
              return { wx: d.WX.id, rev: d.ROADEV.n, mci: d.caseLog.filter((r) => /^mci/.test(r.c.id)).length, home: G.home !== undefined ? d.STATIONS[G.home].name : 'v11', score: G.score, saved: G.saved, dead: G.dead, left: G.left, rejects: G.rejects, ideal: G.ideal, waitSum: Math.round(G.waitSum), waitN: G.waitN, xd: G.xdN,
                fulls: d.HOSPITALS.reduce((a, H) => a + (H.er ? H.er.fulls : 0), 0), outcomes: by, hosp,
                peak: Object.fromEntries(Object.entries(T.peak).filter(([k, v]) => v > 0.75).map(([k, v]) => [k, +v.toFixed(2)])),
                sevAvg: +(sev.reduce((a, H) => a + T.sum[H.name] / T.samples, 0) / sev.length).toFixed(2), medals: d.SHIFT.medals, unstuck: (window.__st && window.__st.unstuck) || 0, resets: (window.__st && window.__st.resets) || 0 }; }''')
            print(station, pol, run, json.dumps(out, ensure_ascii=False), flush=True)
            if os.environ.get('RS'): print('resets at', await page.evaluate('JSON.stringify((window.__rs || []).slice(0, 40))'))
            if os.environ.get('LOG'):
                for e in await page.evaluate('window.__log || []'):
                    if e.get('ev') != 'choose' or os.environ.get('LOG') == '2': print('   ', json.dumps(e, ensure_ascii=False))
        errs = [l for l in logs if ('error' in l.lower() or 'pageerror' in l) and 'ERR_FAILED' not in l]
        if errs: print('\n'.join(errs[-10:]))
        await browser.close()

asyncio.run(main())

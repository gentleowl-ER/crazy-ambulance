"""v12 dispatch balance: whole shifts with a sound dispatcher and a hospital policy.
usage: python3 balance12d.py policy [runs]
  policy: ideal (crowding-aware best) | center (nearest medical centre) | nearest (nearest that can treat)"""
import os, asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page

JS = r'''
window.__pol = function (policy) {
  const d = window.__dbg, x = d.dcur;
  if (!x) return;
  const c = x.c, M = window.__m;
  const free = d.units.filter(d.unitFree);
  if (x.type === 'call') {
    if (c.kind === 'none') { d.noDispatch(c, c.c.ref); return; }
    if (!free.length) { d.later(c); return; }
    if (c.kind === 'patient' && !c.asked) d.askCall(c);
    if (c.c.id === 'ohca' && !c.cpr && !c.daDone) d.phoneCPR(c);
    const u = (c.idealU || []).find(d.unitFree) || free[0];
    M.disp.push({ c, dist: c.dist, sentAt: c.t });
    d.dispatchUnit(c, u);
    return;
  }
  const act = (d.SCENE[c.c.id] || {}).act || 'go';
  if (act !== 'go' && !c.decidedGo) { d.chooseNoTransport(c, x.u, act); return; }
  const D0 = d.dijkstra(d.nearestOnRoads(x.u.x, x.u.z, (e) => !e.flags.campus && !e.flags.alley), true);
  const cand = d.HOSPITALS.map((H, i) => ({ H, i, L: d.routeCost(D0, H.proj) })).filter((q) => !c.rejected.has(q.H.id) && !d.isDiverted(q.H) && d.accepts(q.H, c.c));
  let pick;
  if (policy === 'ideal') pick = cand.find((q) => q.i === c.evalH.best) || cand.find((q) => c.evalH.ideal.includes(q.i)) || cand.sort((a, b) => a.L - b.L)[0];
  else if (policy === 'center') { const sev = cand.filter((q) => q.H.level === 'severe'); pick = (sev.length ? sev : cand).sort((a, b) => a.L - b.L)[0]; }
  else pick = cand.sort((a, b) => a.L - b.L)[0];
  d.chooseTransport(c, x.u, pick.H);
};
window.__shift = function (policy, steps) {
  const d = window.__dbg, M = window.__m || (window.__m = { disp: [], resp: [], busy: 0, gapT: 0, peak: {}, samples: 0, sum: {} });
  for (let i = 0; i < steps; i++) {
    if (d.G.state === 'dchoose') { window.__pol(policy); continue; }
    if (d.G.state !== 'play') break;
    d.simulate(1 / 60);
    M.busy += d.units.filter((u) => !d.unitFree(u)).length / 60;
    M.samples++;
    for (const H of d.HOSPITALS) if (H.er) { const r = H.er.n / H.er.cap; M.peak[H.name] = Math.max(M.peak[H.name] || 0, r); M.sum[H.name] = (M.sum[H.name] || 0) + r; }
    if (M.samples % 30 === 0) for (let k = 0; k < d.STATIONS.length; k++) if (!d.districtCovered(k)) M.gapT += 0.5;
    for (let k = M.disp.length - 1; k >= 0; k--) { const r = M.disp[k]; if (r.c.arrivedAt !== undefined) { M.resp.push({ dist: r.dist, t: r.c.arrivedAt, xd: r.c.unit && r.c.unit.i !== r.dist }); M.disp.splice(k, 1); } else if (r.c.status === 'done') M.disp.splice(k, 1); }
  }
  return d.G.state;
};
window.__report = function () {
  const d = window.__dbg, M = window.__m, D = d.D;
  const outcomes = {}; for (const r of d.caseLog) outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
  const hosp = {}; for (const r of d.caseLog) if ((r.outcome === 'saved' || r.outcome === 'overtx') && r.hosp) hosp[r.hosp.name] = (hosp[r.hosp.name] || 0) + 1;
  const byDist = {}; for (const r of M.resp) { const k = d.STATIONS[r.dist].name; const g = byDist[k] || (byDist[k] = { n: 0, t: 0, xd: 0 }); g.n++; g.t += r.t; if (r.xd) g.xd++; }
  for (const k in byDist) byDist[k].t = Math.round(byDist[k].t / byDist[k].n);
  const deadBy = {}; for (const r of d.caseLog) if (r.outcome === 'dead') deadBy[r.c.tri] = (deadBy[r.c.tri] || 0) + 1;
  const sev = d.HOSPITALS.filter((H) => H.level === 'severe');
  const deadNotes = d.caseLog.filter((r) => r.outcome === 'dead').map((r) => r.c.id + ':' + (r.note || '').slice(0, 60));
  return { deadNotes, score: D.score, calls: D.calls, saved: D.saved, dead: D.dead, deadBy, acc: D.dec ? +(D.ok / D.dec).toFixed(2) : null, outcomes, hosp,
    avgResp: D.resp.length ? +(D.resp.reduce((a, b) => a + b, 0) / D.resp.length).toFixed(1) : null, respByDistrict: byDist,
    waitSum: Math.round(D.waitSum), waitN: D.waitN, hn: D.hn, xd: D.xdN, gapSec: Math.round(M.gapT), unitUtil: +(M.busy / d.units.length / 300).toFixed(2),
    fulls: d.HOSPITALS.reduce((a, H) => a + (H.er ? H.er.fulls : 0), 0),
    peak: Object.fromEntries(Object.entries(M.peak).filter(([k, v]) => v > 0.75).map(([k, v]) => [k, +v.toFixed(2)])),
    sevAvg: +(sev.reduce((a, H) => a + M.sum[H.name] / M.samples, 0) / sev.length).toFixed(2), medals: d.SHIFT.medals };
};
0;
'''

async def main():
    policy = sys.argv[1] if len(sys.argv) > 1 else 'ideal'
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate('localStorage.clear()')
        for run in range(runs):
            await page.evaluate(JS)
            await page.evaluate('window.__m = null; window.__dbg.G.wxPick = "' + os.environ.get('WX', 'day') + '"; window.__dbg.startDispatch()')
            st = 'play'
            while st in ('play', 'dchoose'):
                st = await page.evaluate(f'window.__shift("{policy}", 1500)')
            r = await page.evaluate('window.__report()')
            print(policy, run, json.dumps(r, ensure_ascii=False), flush=True)
            await page.evaluate('window.__dbg.showTitle()')
        errs = [l for l in logs if ('error' in l.lower() or 'pageerror' in l) and 'ERR_FAILED' not in l]
        if errs: print('\n'.join(errs[-10:]))
        await browser.close()

asyncio.run(main())

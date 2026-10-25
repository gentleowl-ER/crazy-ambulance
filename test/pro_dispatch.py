"""Play-test dispatch mode: compare strategies, measure ETA accuracy and idle time.
usage: python3 pro_dispatch.py policy [runs]   policy: ideal | nearest | lazy | random"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page

JS = r'''
window.__pol = function (policy) {
  const d = window.__dbg, x = d.dcur;
  if (!x) return;
  const c = x.c, M = window.__m;
  const free = d.units.filter(d.unitFree);
  if (x.type === 'call') {
    if (c.kind === 'none' && policy !== 'lazy') { d.noDispatch(c, c.c.ref); return; }
    if (!free.length) { d.later(c); return; }
    // a good dispatcher asks the two key questions and coaches CPR on a cardiac arrest
    if (policy === 'ideal' && c.kind === 'patient' && !c.asked) { d.askCall(c); }
    if (policy === 'ideal' && c.c.id === 'ohca' && !c.cpr && !c.daDone) { d.phoneCPR(c); }
    const dist = d.unitDistances(c.proj);
    let u;
    if (policy === 'ideal') u = (c.idealU || []).find(d.unitFree) || free[0];
    else if (policy === 'random') u = free[Math.floor(Math.random() * free.length)];
    else u = free.slice().sort((a, b) => dist[a.i] - dist[b.i])[0];
    M.disp.push({ c, u: u.name, eta: dist[u.i] / 22, ideal: (c.idealU || []).includes(u), tri: c.c.tri });
    if (c.kind === 'patient' && c.life0) M.track.push({ c, tri: c.c.tri, id: c.c.id, type: u.type, life0: Math.round(c.life0), old: c.c.life + (c.p && c.p.cpr ? 25 : 0), last: c.life });
    d.dispatchUnit(c, u);
    return;
  }
  const act = (d.SCENE[c.c.id] || {}).act || 'go';
  if (act !== 'go' && !c.decidedGo && policy !== 'lazy') { d.chooseNoTransport(c, x.u, act); return; }
  const D0 = d.dijkstra(d.nearestOnRoads(x.u.x, x.u.z, (e) => !e.flags.campus));
  const cand = d.HOSPITALS.map((H, i) => ({ H, i, L: d.routeCost(D0, H.proj) })).filter((q) => !c.rejected.has(q.H.id) && !d.isDiverted(q.H) && (policy === 'random' || d.accepts(q.H, c.c)));
  let pick;
  if (policy === 'ideal') pick = cand.find((q) => c.evalH && c.evalH.ideal.includes(q.i)) || cand.sort((a, b) => a.L - b.L)[0];
  else if (policy === 'random') pick = cand[Math.floor(Math.random() * cand.length)];
  else pick = cand.sort((a, b) => a.L - b.L)[0];
  M.hosp.push({ c, eta: pick.L / 18 + 1, t0: d.D.t });
  d.chooseTransport(c, x.u, pick.H);
};
window.__shift = function (policy, steps) {
  const d = window.__dbg, M = window.__m || (window.__m = { disp: [], hosp: [], resp: [], hresp: [], prompts: [], lastPrompt: null, idle: 0, busy: 0, pendT: 0, track: [] });
  for (let i = 0; i < steps; i++) {
    if (d.G.state === 'dchoose') {
      const now = 300 - d.D.t;
      if (M.lastPrompt !== null) M.prompts.push(now - M.lastPrompt);
      M.lastPrompt = now;
      window.__pol(policy);
      continue;
    }
    if (d.G.state !== 'play') break;
    d.simulate(1 / 60);
    const open = d.dcalls.filter((q) => q.status !== 'done');
    if (open.some((q) => q.status === 'pending')) M.pendT += 1 / 60;
    const busyUnits = d.units.filter((u) => !d.unitFree(u)).length;
    M.busy += busyUnits / 60;
    for (const r of M.track) if (r.c.status !== 'done') r.last = r.c.life; else if (!r.out) r.out = r.c.outcome;
    for (let k = M.disp.length - 1; k >= 0; k--) { const r = M.disp[k]; if (r.c.arrivedAt !== undefined) { M.resp.push({ eta: r.eta, act: r.c.arrivedAt - r.c.sentAt, u: r.u, tri: r.tri }); M.disp.splice(k, 1); } else if (r.c.status === 'done') M.disp.splice(k, 1); }
    for (let k = M.hosp.length - 1; k >= 0; k--) { const r = M.hosp[k]; if (r.c.status === 'done') { if (r.c.outcome === 'saved') M.hresp.push({ eta: r.eta, act: r.t0 - d.D.t }); M.hosp.splice(k, 1); } }
  }
  return d.G.state;
};
window.__report = function () {
  const d = window.__dbg, M = window.__m, D = d.D;
  const err = (a) => a.length ? { n: a.length, meanEta: +(a.reduce((s, r) => s + r.eta, 0) / a.length).toFixed(1), meanAct: +(a.reduce((s, r) => s + r.act, 0) / a.length).toFixed(1),
    ratio: +(a.reduce((s, r) => s + r.act / Math.max(1, r.eta), 0) / a.length).toFixed(2), worst: +Math.max(...a.map((r) => r.act - r.eta)).toFixed(1) } : null;
  const gaps = M.prompts.slice().sort((a, b) => a - b);
  const outcomes = {}; for (const r of d.caseLog) outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
  const T = M.track.filter((r) => r.out), grp = {};
  for (const r of T) { const k = r.tri + '/' + r.type; const g = grp[k] || (grp[k] = { n: 0, dead: 0, margin: [], budget: 0, old: 0 }); g.n++; g.budget += r.life0; g.old += r.old; if (r.out === 'dead') g.dead++; else if (r.out === 'saved') g.margin.push(Math.round(r.last)); }
  for (const k in grp) { const g = grp[k]; g.budget = Math.round(g.budget / g.n); g.old = Math.round(g.old / g.n); g.margin = g.margin.sort((a, b) => a - b).join(' '); }
  return { byTriageCrew: grp, score: D.score, calls: D.calls, saved: D.saved, dead: D.dead, acc: D.dec ? +(D.ok / D.dec).toFixed(2) : null, dec: D.dec, outcomes,
    sceneETA: err(M.resp), hospETA: err(M.hresp), promptGapMedian: gaps.length ? +gaps[Math.floor(gaps.length / 2)].toFixed(1) : null, promptGapMax: gaps.length ? +gaps[gaps.length - 1].toFixed(1) : null,
    prompts: M.prompts.length + 1, unitUtil: +(M.busy / 4 / 300).toFixed(2), pendingTime: Math.round(M.pendT), avgResp: D.resp.length ? +(D.resp.reduce((a, b) => a + b, 0) / D.resp.length).toFixed(1) : null };
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
            await page.evaluate('window.__m = null; window.__dbg.startDispatch()')
            st = 'play'
            while st in ('play', 'dchoose'):
                st = await page.evaluate(f'window.__shift("{policy}", 1200)')
            r = await page.evaluate('window.__report()')
            print(policy, run, json.dumps(r, ensure_ascii=False))
            await page.evaluate('window.__dbg.showTitle()')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'built' not in l)[-1500:])
        await browser.close()

asyncio.run(main())

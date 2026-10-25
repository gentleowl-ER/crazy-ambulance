"""Automated playtest in virtual time: an autopilot follows the route guidance, picks a hospital
when the destination panel opens (the ideal one, or a deliberately wrong one with probability WRONG),
and logs every pickup / rejection / delivery / death.
usage: python3 play.py [seconds] [wrong_prob] [shots]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, OUT

AUTO = r'''
window.__auto = function (steps, wrongP) {
  const d = window.__dbg, log = window.__log || (window.__log = []);
  const st = window.__st || (window.__st = { saved: 0, dead: 0, rejects: 0, left: 0, rid: null, stuck: 0 });
  for (let i = 0; i < steps; i++) {
    const car = d.car, k = d.keys;
    k.gas = k.brake = k.left = k.right = k.drift = false; k.siren = !!d.riding && window.__useSiren;
    if (d.G.state === 'choose') {
      const r = d.riding, ev = r.eval;
      let pickI = ev.best;
      const bad = d.HOSPITALS.map((H, j) => j).filter((j) => !d.accepts(d.HOSPITALS[j], r.c) && !r.rejected.has(d.HOSPITALS[j].id));
      if (!r.rejected.size && bad.length && Math.random() < wrongP) pickI = bad[Math.floor(Math.random() * bad.length)];
      if (r.rejected.has(d.HOSPITALS[pickI].id)) pickI = d.HOSPITALS.findIndex((H) => d.accepts(H, r.c) && !r.rejected.has(H.id));
      log.push({ ev: 'choose', case: r.c.id, tri: r.c.tri, pick: d.HOSPITALS[pickI].id, ok: d.accepts(d.HOSPITALS[pickI], r.c), ideal: ev.ideal.map((j) => d.HOSPITALS[j].id), life: Math.round(r.life), t: +d.G.time.toFixed(1) });
      d.chooseDest(pickI);
      continue;
    }
    let gp = d.guidePoint(11);
    const t = d.guide.target;
    // keep to the right-hand lane: offset the aim point to the right of the route direction
    const ga = d.guidePoint(8), gb = d.guidePoint(14);
    if (gp && ga && gb) { const ux = gb[0] - ga[0], uz = gb[1] - ga[1], ul = Math.hypot(ux, uz) || 1; gp = [gp[0] - (uz / ul) * 3, gp[1] + (ux / ul) * 3]; }
    if (gp && t && d.G.state === 'play') {
      const want = Math.atan2(gp[0] - car.x, gp[1] - car.z);
      const diff = (((want - car.h) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      if (diff > 0.05) k.left = true; else if (diff < -0.05) k.right = true;
      const endD = Math.hypot(t.px - car.x, t.pz - car.z);
      const vm = window.__vmax || 33, vtn = window.__vturn || 18, vnr = window.__vnear || 9, vt = endD < (d.riding ? 5 : 3.5) ? 0 : endD < 22 ? vnr : Math.abs(diff) > 0.8 ? vnr : Math.abs(diff) > 0.35 ? Math.min(vtn, vm) : vm;
      // a car stopped in front of us: wait for it (and sound the siren if allowed)
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      let blocked = false;
      for (const v of d.traffic) { const ox = v.x - car.x, oz = v.z - car.z, ah = ox * fx + oz * fz; if (ah > 0 && ah < 13 && Math.abs(-ox * fz + oz * fx) < 2.8) { blocked = true; break; } }
      let vt2 = vt;
      if (blocked) { vt2 = 0; if (window.__useSiren) k.siren = true; }
      if (car.speed < vt2) k.gas = true; else if (car.speed > vt2 + 3) k.brake = true;
      st.stuck = (car.speed < 1.2 && vt > 0 && !st.rev) ? st.stuck + (blocked ? 0.25 : 1) : 0;
      if (st.stuck > 50) {
        st.rev = 75; st.stuck = 0; st.unstuck = (st.unstuck || 0) + 1;
        let nv = null, nd = 1e9; for (const v of d.traffic) { const dd = Math.hypot(v.x - car.x, v.z - car.z); if (dd < nd) { nd = dd; nv = v; } }
        const cols = []; d.colliders.forEach((c) => { const cx = c.t === 2 ? (c.ax + c.bx) / 2 : c.x, cz = c.t === 2 ? (c.az + c.bz) / 2 : c.z; if (Math.hypot(cx - car.x, cz - car.z) < 5) cols.push(c.t + (c.r ? ':' + c.r.toFixed(2) : ':' + (c.hw||0).toFixed(1))); });
        log.push({ ev: 'stuck', at: [Math.round(car.x), Math.round(car.z)], road: d.roadDist(car.x, car.z).toFixed(1), veh: nv ? [nv.kind, Math.round(nd), +nv.cur.toFixed(1), nv.red] : null, cols: cols.slice(0, 5), target: [Math.round(t.px), Math.round(t.pz)], diff: +diff.toFixed(2) });
      }
      if (st.rev > 0) {
        st.rev--;
        k.gas = false; k.brake = true; k.left = k.right = false;
        if (diff > 0.05) k.right = true; else if (diff < -0.05) k.left = true;
      }
    }
    const before = d.riding;
    d.simulate(1 / 60);
    if (window.__afterStep) window.__afterStep();
    if (i % 10 === 0) d.updateGuide(true);
    const G = d.G;
    if (!before && d.riding) log.push({ ev: 'board', case: d.riding.c.id, tri: d.riding.c.tri, life: Math.round(d.riding.life), at: [Math.round(car.x), Math.round(car.z)], t: +G.time.toFixed(1) });
    if (G.rejects > st.rejects) { log.push({ ev: 'reject', t: +G.time.toFixed(1) }); st.rejects = G.rejects; }
    if (G.saved > st.saved) { const c = d.caseLog[d.caseLog.length - 1]; log.push({ ev: 'saved', case: c.c.id, at: c.hosp.id, ideal: c.ideal, score: G.score, t: +G.time.toFixed(1) }); st.saved = G.saved; }
    if (G.dead > st.dead) { const c = d.caseLog[d.caseLog.length - 1]; log.push({ ev: 'dead', case: c.c.id, riding: !!(before && !d.riding), score: G.score, t: +G.time.toFixed(1) }); st.dead = G.dead; }
    if (G.left > st.left) { log.push({ ev: 'left', t: +G.time.toFixed(1) }); st.left = G.left; }
    if (G.state !== 'play' && G.state !== 'countdown' && G.state !== 'choose') break;
  }
  const d2 = window.__dbg;
  return { state: d2.G.state, time: +d2.G.time.toFixed(1), saved: d2.G.saved, dead: d2.G.dead, score: d2.G.score, waiting: d2.waitingCalls().length,
    car: [Math.round(d2.car.x), Math.round(d2.car.z), +d2.car.speed.toFixed(1), d2.car.surface], unstuck: (window.__st || {}).unstuck || 0 };
};
'''


async def main():
    seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 120
    wrong = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
    nshots = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 430, 932)
        await page.evaluate(AUTO)
        await page.evaluate(f'window.__useSiren = {str(len(sys.argv) > 4 and sys.argv[4] == "siren").lower()}')
        await page.evaluate('window.__dbg.startGame()')
        steps = int(seconds * 60)
        done, shots, res = 0, 0, None
        while done < steps:
            res = await page.evaluate(f'window.__auto(600, {wrong})')
            done += 600
            if shots < nshots and done % 2400 == 0:
                await page.wait_for_timeout(250)
                await shot(page, f'play_{shots}')
                shots += 1
            if res['state'] not in ('play', 'countdown', 'choose'):
                break
        log = await page.evaluate('window.__log || []')
        for e in log:
            print(json.dumps(e, ensure_ascii=False))
        print('RESULT', json.dumps(res, ensure_ascii=False))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-3000:])
        await browser.close()

asyncio.run(main())

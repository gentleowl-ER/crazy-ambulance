"""Dispatch mode: start a shift, let an automated dispatcher answer every decision, check units, outcomes and screens.
usage: python3 dispatch.py [seconds] [wrong_prob] [w] [h] [shots]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot as _shot

async def shot(page, name):
    await page.evaluate('window.__frame && window.__frame()')
    await _shot(page, name)

AUTO = r'''
window.__dlog = [];
window.__frame = function (n) {
  const d = window.__dbg;
  d.applyViewOffset();
  for (let i = 0; i < (n || 14); i++) { d.G.t += 0.05; d.updateCamera(0.12); }
  d.trafficRender(); d.pedRender(d.G.t); d.knockRender(); d.patientsRender(d.G.t); d.hospitalsRender(d.G.t); d.dispatchRender(d.G.t);
  if (d.G.mode === 'dispatch') { d.updateDispatchHUD(); d.drawDMap(d.G.t); }
  d.towerFade(1);
  d.renderer.render(d.scene, d.camera);
};
(() => { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); })();
window.__decide = function (wrong) {
  const d = window.__dbg, x = d.dcur;
  if (!x) return null;
  const c = x.c, bad = Math.random() < wrong;
  if (x.type === 'call') {
    if (c.kind === 'none') {
      if (bad) { const u = d.units.find(d.unitFree); if (u) { d.dispatchUnit(c, u); return 'WRONG sent unit to non-emergency #' + c.id; } }
      d.noDispatch(c, c.c.ref); return 'referral #' + c.id + ' ' + c.c.id;
    }
    if (bad && !c.mustDispatch) { d.noDispatch(c, 'nonurgent'); return 'WRONG no-dispatch #' + c.id; }
    const u = (c.idealU || []).find(d.unitFree) || d.units.find(d.unitFree);
    if (!u) { d.later(c); return 'later #' + c.id; }
    d.dispatchUnit(c, u); return 'dispatch #' + c.id + ' ' + c.c.id + ' -> ' + u.name + (c.idealU.includes(u) ? ' (ideal)' : '');
  }
  const act = (d.SCENE[c.c.id] || {}).act || 'go';
  if (act !== 'go' && !c.decidedGo) {
    if (bad) { d.chooseTransport(c, x.u, d.HOSPITALS[0]); return 'WRONG transport ' + act + ' #' + c.id; }
    d.chooseNoTransport(c, x.u, act); return 'no-transport ' + act + ' #' + c.id;
  }
  if (bad && !c.mustGo && !c.decidedGo) { d.chooseNoTransport(c, x.u, 'minor'); return 'WRONG no-transport #' + c.id; }
  let ids = (c.evalH ? c.evalH.ideal : []).filter((i) => !c.rejected.has(d.HOSPITALS[i].id));
  if (bad || !ids.length) ids = d.HOSPITALS.map((H, i) => i).filter((i) => !c.rejected.has(d.HOSPITALS[i].id));
  const i = ids[Math.floor(Math.random() * ids.length)];
  d.chooseTransport(c, x.u, d.HOSPITALS[i]);
  return 'transport #' + c.id + ' ' + c.c.id + ' -> ' + d.HOSPITALS[i].name + (bad ? ' (random)' : '');
};
window.__run = function (steps, wrong) {
  const d = window.__dbg, out = [];
  for (let i = 0; i < steps; i++) {
    if (d.G.state === 'dchoose') { const r = window.__decide(wrong); if (r) out.push(Math.round(300 - d.D.t) + 's ' + r); continue; }
    if (d.G.state !== 'play' && d.G.state !== 'ending') break;
    d.simulate(1 / 60);
  }
  const u = d.units.map((q) => q.name + ':' + q.state + (q.route ? '@' + Math.round(q.route.len - q.s) : '') + (q.v ? ' v' + q.v.toFixed(0) : ''));
  const open = d.dcalls.filter((c) => c.status !== 'done').map((c) => '#' + c.id + ' ' + c.c.id + ' ' + c.status + ' ' + Math.round(c.t) + 's' + (c.life0 ? ' life ' + Math.round(c.life) : ''));
  return { t: Math.round(d.D.t), state: d.G.state, score: d.D.score, calls: d.D.calls, saved: d.D.saved, dead: d.D.dead, dec: d.D.dec, ok: d.D.ok, units: u, open, out,
    traffic: d.traffic.filter((v) => Math.hypot(v.x - d.dsel.x, v.z - d.dsel.z) < 150).length, sel: d.dsel.name };
};
0;
'''

async def main():
    secs = float(sys.argv[1]) if len(sys.argv) > 1 else 120
    wrong = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 430
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 932
    shots = (sys.argv[5] if len(sys.argv) > 5 else 'y') == 'y'
    tag = f'd{w}'
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, w, h)
        await page.evaluate('localStorage.clear()')
        await page.evaluate(AUTO)
        await page.click('#dispBtn')
        await page.wait_for_timeout(500)
        if shots: await shot(page, f'{tag}_brief')
        await page.evaluate("document.getElementById('brief').scrollTop = 99999")
        await page.wait_for_timeout(200)
        if shots: await shot(page, f'{tag}_brief2')
        await page.click('#goBtn')
        await page.wait_for_timeout(700)
        if shots: await shot(page, f'{tag}_start')
        # run until the first call decision appears and photograph it
        r = await page.evaluate('''() => { const d = window.__dbg; for (let i = 0; i < 600 && d.G.state === 'play'; i++) d.simulate(1 / 60); return d.G.state; }''')
        print('first decision state', r)
        await page.wait_for_timeout(700)
        if shots: await shot(page, f'{tag}_call')
        done, n, scene_shot = 0, 0, False
        while done < secs * 60:
            r = await page.evaluate(f'window.__run(300, {wrong})')
            done += 300; n += 1
            for line in r.pop('out'):
                print('   ', line)
            print(round(done / 60), json.dumps(r, ensure_ascii=False))
            if r['state'] in ('over', 'ending', 'title'):
                break
            if shots and n in (3, 8):
                await page.wait_for_timeout(500)
                await shot(page, f'{tag}_play{n}')
            if shots and not scene_shot:
                # stop at the next scene report for a picture
                st = await page.evaluate('''() => { const d = window.__dbg; for (let i = 0; i < 1200; i++) {
                    if (d.G.state === 'dchoose') { if (d.dcur && d.dcur.type === 'scene') return 'scene'; window.__decide(0); continue; }
                    if (d.G.state !== 'play') break; d.simulate(1 / 60); } return d.G.state; }''')
                if st == 'scene':
                    await page.wait_for_timeout(700)
                    await shot(page, f'{tag}_scene')
                    scene_shot = True
        # finish the shift quickly
        await page.evaluate('() => { window.__dbg.D.t = 0.5; }')
        r = await page.evaluate(f'window.__run(400, {wrong})')
        print('end', json.dumps({k: r[k] for k in ('state', 'score', 'calls', 'saved', 'dead', 'dec', 'ok')}, ensure_ascii=False))
        await page.wait_for_timeout(2600)
        st = await page.evaluate('window.__dbg.G.state')
        print('final state', st)
        if shots:
            await shot(page, f'{tag}_over')
            rv = await page.evaluate("[...document.querySelectorAll('#review summary')].map((s) => s.textContent).join(' | ')")
            print('review:', rv[:1500])
            print('stats:', await page.evaluate("[...document.querySelectorAll('.stat')].map((s) => s.textContent).join(' | ')"))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-2500:])
        await browser.close()
asyncio.run(main())

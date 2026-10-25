"""Screenshots and checks for the new features: questioning + phone CPR, diversion, time trial, case collection, real-time dispatch."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot as _shot

FR = r'''
window.__frame = function (n) {
  const d = window.__dbg;
  d.applyViewOffset();
  for (let i = 0; i < (n || 14); i++) { d.G.t += 0.05; d.updateCamera(0.12); }
  if (d.G.mode !== 'dispatch') d.carVisual(0.016, !!d.riding, d.G.t);
  d.trafficRender(); d.pedRender(d.G.t); d.knockRender(); d.patientsRender(d.G.t); d.hospitalsRender(d.G.t); d.dispatchRender(d.G.t);
  if (d.G.mode === 'dispatch' && d.G.state !== 'title') { d.updateDispatchHUD(); d.drawDMap(d.G.t); }
  d.towerFade(1);
  d.renderer.render(d.scene, d.camera);
};
(() => { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); })();
0;
'''

async def main():
    w = int(sys.argv[1]) if len(sys.argv) > 1 else 390
    h = int(sys.argv[2]) if len(sys.argv) > 2 else 844
    tag = f'n{w}'
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, w, h)
        await page.evaluate('localStorage.clear()')
        await page.evaluate(FR)

        async def shot(name):
            await page.evaluate('window.__frame && window.__frame()')
            await page.wait_for_timeout(250)
            await _shot(page, f'{tag}_{name}')

        await shot('title')
        # ---- dispatch: a cardiac arrest with nobody doing CPR ----
        got = None
        for attempt in range(8):
            got = await page.evaluate('''() => { const d = window.__dbg; d.showTitle(); d.startDispatch();
              d.D.plan = ['red']; d.D.recent = d.CASES.filter((c) => c.tri === 'red' && c.id !== 'ohca').map((c) => c.id);
              for (let i = 0; i < 600 && d.G.state === 'play'; i++) d.simulate(1 / 60);
              const c = d.dcur && d.dcur.c; return c ? { id: c.c.id, cpr: !!c.cpr } : null; }''')
            if got and got['id'] == 'ohca' and not got['cpr']:
                break
        print('ohca call', got)
        await shot('d_call')
        await page.click('#dpPre .altb.ask')
        await shot('d_asked')
        da = await page.evaluate("!!document.querySelector('#dpPre .altb.da')")
        print('phone CPR button shown', da)
        if da:
            await page.click('#dpPre .altb.da')
            await shot('d_cpr')
            print('after CPR', await page.evaluate('''() => { const c = window.__dbg.dcur.c; return { cpr: c.cpr, da: c.daCPR, life: Math.round(c.life), comp: c.p && c.p.comp && c.p.comp.kind, score: window.__dbg.D.score }; }'''))
        # dispatch the first free unit, run to the scene report, divert a hospital and look at the panel
        await page.evaluate('''() => { const d = window.__dbg; const u = (d.dcur.c.idealU || []).find(d.unitFree) || d.units.find(d.unitFree); d.dispatchUnit(d.dcur.c, u);
          for (let i = 0; i < 6000; i++) { if (d.G.state === 'dchoose') { if (d.dcur.type === 'scene') break; const c = d.dcur.c; if (c.kind === 'none') d.noDispatch(c, c.c.ref); else d.dispatchUnit(c, d.units.find(d.unitFree) || d.units[0]); continue; } d.simulate(1 / 60); }
          const X = d.HOSPITALS.find((q) => q.id === 'xs'); X.er.n = X.er.cap * 1.1; X.er.full = true; d.refreshDecision(); }''')
        await shot('d_scene_divert')
        rows = await page.evaluate("[...document.querySelectorAll('#dpRows .drow')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30) + (b.disabled ? ' [off]' : ''))")
        print('scene rows', rows)
        # real-time mode: while the panel is open the world keeps moving
        rt = await page.evaluate('''() => { const d = window.__dbg; d.D.realtime = true; for (const H of d.HOSPITALS) if (H.er) H.er.full = false;
          const t0 = d.D.t, calls0 = d.D.calls, u0 = d.units.map((u) => Math.round(u.s || 0));
          for (let i = 0; i < 900; i++) { d.simulate(0.3 / 60); if (i % 30 === 0) d.refreshDecision(); }
          return { state: d.G.state, dt: +(t0 - d.D.t).toFixed(1), newCalls: d.D.calls - calls0, panel: !document.getElementById('dpanel').hidden, foot: document.getElementById('dpFoot').textContent }; }''')
        print('real-time', rt)
        await page.evaluate('() => { window.__dbg.D.realtime = false; }')
        # ---- mission: diversion while driving to a hospital ----
        await page.evaluate('''() => { const d = window.__dbg; d.showTitle(); d.startGame(); for (let i = 0; i < 240; i++) d.simulate(1 / 60); }''')
        m = await page.evaluate('''() => { const d = window.__dbg; const p = d.patients.find((q) => q.state === 'wait'); if (!p) return null;
          d.carReset(p.rx - p.tx * 6, p.rz - p.tz * 6, Math.atan2(p.tx, p.tz)); d.car.vx = d.car.vz = 0;
          for (let i = 0; i < 200 && !d.riding; i++) d.simulate(1 / 60);
          if (d.G.state === 'choose') { const H = d.HOSPITALS[d.riding.eval.best]; d.chooseDest(d.HOSPITALS.indexOf(H)); }
          if (!d.riding) return 'no pickup';
          const H = d.riding.dest; H.er.n = H.er.cap * 1.1; H.er.full = true; d.riding.dest = null; d.openDest('divert', H); return H.name; }''')
        print('mission diversion of', m)
        await shot('m_divert')
        # reachability flags in the call list
        reach = await page.evaluate('''() => { const d = window.__dbg; d.closeDest(); for (const H of d.HOSPITALS) if (H.er) { H.er.full = false; H.er.n = H.er.cap * 0.5; } if (d.riding && !d.riding.dest) d.chooseDest(d.riding.eval.best); d.updateGuide(true);
          return d.patients.filter((p) => p.state === 'wait').map((p) => [p.c.short, Math.round(p.life), p.eta && Math.round(p.eta), p.hospEta && Math.round(p.hospEta), p.reach]); }''')
        print('reach', json.dumps(reach, ensure_ascii=False))
        # jolt: a hard hit with the patient on board
        j = await page.evaluate('''() => { const d = window.__dbg; if (!d.riding) return null; const l0 = d.riding.life; d.ev.crash(20, d.car.x, d.car.z); return { lost: +(l0 - d.riding.life).toFixed(1), bumps: d.riding.bumps }; }''')
        print('jolt', j)
        await shot('m_play')
        # ---- free mode: time trial ----
        tr = await page.evaluate('''() => { const d = window.__dbg; d.showTitle(); d.startFree(); for (let i = 0; i < 30; i++) d.simulate(1 / 60); d.startTrial(); const T = d.trial; return T ? { to: T.H.name, L: Math.round(T.L), lim: T.lim.map((x) => +x.toFixed(1)) } : null; }''')
        print('trial', tr)
        await page.evaluate('() => { const d = window.__dbg; for (let i = 0; i < 300; i++) d.simulate(1 / 60); d.updateGuide(true); }')
        await shot('f_trial')
        fin = await page.evaluate('''() => { const d = window.__dbg, T = d.trial; const m = d.hospMarks.find((q) => q.H === T.H);
          d.carReset(m.x, m.z, 0); d.car.vx = d.car.vz = 0; T.t = T.lim[0] - 2; for (let i = 0; i < 5; i++) d.simulate(1 / 60); return { done: !d.trial, best: d.TRIALS[T.H.id] }; }''')
        print('trial finish', fin)
        await page.wait_for_timeout(1900)
        await shot('f_trial_done')
        # ---- case collection ----
        cx = await page.evaluate('''() => { const d = window.__dbg; d.showTitle(); d.showCodex(); return document.getElementById('codexCount').textContent; }''')
        print('codex', cx, 'seen', await page.evaluate('[...window.__dbg.SEEN]'))
        await page.evaluate("document.querySelector('#codexList details:not(.locked)') && (document.querySelector('#codexList details:not(.locked)').open = true)")
        await shot('codex')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'built' not in l)[-2000:])
        await browser.close()

asyncio.run(main())

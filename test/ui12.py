"""v12 screens: duty-station picker, ER chips in the hospital list, the ER-bed wait, the six-unit dispatch console."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 760

DRIVE_TO = '''(m) => { const d = window.__dbg; const H = m.H; const P = H.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(H.proj.s / 3)));
  const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]); d.carReset(m.x, m.z, h); d.camState.yaw = h; d.camState.px = m.x; d.camState.pz = m.z; d.populateAround(m.x, m.z); }'''

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('window.__dbg.showBriefing("start")')
        await page.wait_for_timeout(1500)
        await shot(page, f'u12_brief_{W}')
        await page.click('#homeRow .hp[data-st="sn"]')
        await page.wait_for_timeout(300)
        await page.evaluate('document.getElementById("erList").scrollIntoView()')
        await page.wait_for_timeout(600)
        await shot(page, f'u12_brief_er_{W}')
        await page.evaluate('document.getElementById("briefMap").scrollIntoView()')
        await page.wait_for_timeout(400)
        await shot(page, f'u12_brief_map_{W}')
        # a 士林 shift: make 百貨 crowded, pick up the red patient and look at the list
        r = await page.evaluate('''() => { const d = window.__dbg; d.startGame(); d.G.state = 'play';
          const sk = d.HOSPITALS.find((q) => q.id === 'sk'); sk.er.n = sk.er.cap * 0.97;
          const p = d.patients.find((q) => q.state === 'wait');
          d.carReset(p.rx - p.tx * 6, p.rz - p.tz * 6, Math.atan2(p.tx, p.tz)); d.car.vx = d.car.vz = 0;
          for (let i = 0; i < 200 && !d.riding; i++) d.simulate(1 / 60);
          return { home: d.STATIONS[d.G.home].name, state: d.G.state, riding: d.riding && d.riding.c.id, ideal: d.riding && d.riding.eval.ideal.map((i) => d.HOSPITALS[i].name),
            waits: d.HOSPITALS.map((H) => H.name + ':' + d.erWait(H)).join(' ') }; }''')
        print('pickup', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(500)
        await shot(page, f'u12_dest_{W}')
        rows = await page.evaluate("[...document.querySelectorAll('#destRows .drow')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40))")
        print('rows', json.dumps(rows, ensure_ascii=False))
        # deliver to the crowded 百貨 anyway: the crew waits for a bed
        r = await page.evaluate('() => { const d = window.__dbg; const i = d.HOSPITALS.findIndex((q) => q.id === "sk"); d.chooseDest(i); return d.hospMarks[i] ? 1 : 0; }')
        await page.evaluate('(f) => { const d = window.__dbg; const i = d.HOSPITALS.findIndex((q) => q.id === "sk"); (eval(f))(d.hospMarks[i]); }', DRIVE_TO)
        r = await page.evaluate('''() => { const d = window.__dbg; const t0 = d.G.time; for (let i = 0; i < 90 && d.riding; i++) d.simulate(1 / 60);
          const h = d.hold; return { riding: !!d.riding, hold: h && { H: h.H.name, t: +h.t.toFixed(1) }, time: +(t0 - d.G.time).toFixed(1), mt: document.getElementById('missionTitle').textContent, ms: document.getElementById('missionSub').textContent }; }''')
        print('deliver', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(700)
        await shot(page, f'u12_hold_{W}')
        r = await page.evaluate('''() => { const d = window.__dbg; const t0 = d.G.time, x0 = d.car.x; let n = 0; while (d.hold && n < 3000) { d.simulate(1 / 60); n++; }
          return { frames: n, shift: +(t0 - d.G.time).toFixed(1), moved: +Math.abs(d.car.x - x0).toFixed(2), er: d.erRatio(d.HOSPITALS.find((q) => q.id === 'sk')).toFixed(2) }; }''')
        print('after hold', json.dumps(r, ensure_ascii=False))
        # dispatch console with six units
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.startDispatch(); }')
        r = await page.evaluate('''() => { const d = window.__dbg; for (let i = 0; i < 600 && d.G.state !== 'dchoose'; i++) d.simulate(1 / 60);
          return { state: d.G.state, type: d.dcur && d.dcur.type, sub: document.getElementById('dpSub').textContent }; }''')
        print('dispatch call', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, f'u12_dcall_{W}')
        # play on with a simple dispatcher until a scene report is up, with two hospitals crowded
        r = await page.evaluate('''() => { const d = window.__dbg; let n = 0;
          for (let i = 0; i < 20000; i++) { if (d.G.state === 'dchoose') { const x = d.dcur, c = x.c;
              if (x.type === 'scene' && n > 2) break;
              if (x.type === 'call') { if (c.kind === 'none') d.noDispatch(c, c.c.ref); else { const u = (c.idealU || []).find(d.unitFree) || d.units.find(d.unitFree); if (u) d.dispatchUnit(c, u); else d.later(c); } }
              else { n++; const act = (d.SCENE[c.c.id] || {}).act || 'go'; if (act !== 'go' && !c.decidedGo) d.chooseNoTransport(c, x.u, act); else d.chooseTransport(c, x.u, d.HOSPITALS[c.evalH.best]); }
              continue; } if (d.G.state !== 'play') break; d.simulate(1 / 60); }
          for (const id of ['cz', 'xs']) { const H = d.HOSPITALS.find((q) => q.id === id); H.er.n = H.er.cap * (id === 'cz' ? 0.98 : 0.8); }
          d.refreshDecision();
          return { state: d.G.state, type: d.dcur && d.dcur.type, t: Math.round(d.D.t), gaps: d.STATIONS.map((S, i) => d.districtCovered(i) ? '' : S.name).filter(Boolean) }; }''')
        print('dispatch scene', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, f'u12_dscene_{W}')
        rows = await page.evaluate("[...document.querySelectorAll('#dpRows .drow')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40))")
        print('drows', json.dumps(rows, ensure_ascii=False))
        print('\n'.join(l for l in logs if ('error' in l.lower() or 'pageerror' in l) and 'ERR_FAILED' not in l)[-2000:] or 'no errors')
        await browser.close()
asyncio.run(main())

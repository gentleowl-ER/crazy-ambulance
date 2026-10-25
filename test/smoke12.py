"""v12 smoke: districts, stations, ER model, both modes start and run."""
import asyncio, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 1280, 760)
        r = await page.evaluate('''() => { const d = window.__dbg;
          return { distN: d.DIST_PTS.map((a) => a.length), nb: d.DIST_NB, stations: d.STATIONS.map((S) => [S.name, Math.round(S.pos[0]), Math.round(S.pos[1]), S.proj.e.name || '', Math.round(S.park.x), Math.round(S.park.z)]),
            hospDist: d.HOSPITALS.map((H) => H.name + ':' + d.STATIONS[H.dist].name), spawn: d.spawnPts.length, north: d.spawnPts.filter((s) => s.pz < -450).length }; }''')
        print(json.dumps(r, ensure_ascii=False))
        # mission from every station
        for i in range(6):
            m = await page.evaluate('''(i) => { const d = window.__dbg; d.showTitle(); d.G.homePick = d.STATIONS[i].id; d.startGame();
              const out = { home: d.STATIONS[d.G.home].name, car: [Math.round(d.car.x), Math.round(d.car.z)], calls: d.patients.map((p) => [p.c.tri, d.STATIONS[p.dist].name, Math.round(Math.hypot(p.x - d.car.x, p.z - d.car.z)), Math.round(p.life0)]) };
              for (let k = 0; k < 400; k++) d.simulate(1 / 60);
              out.state = d.G.state; out.er = d.HOSPITALS.filter((H) => H.er).map((H) => H.name + ' ' + d.erRatio(H).toFixed(2));
              return out; }''', i)
            print('mission', json.dumps(m, ensure_ascii=False))
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.startDispatch(); }')
        for k in range(6):
            r = await page.evaluate('''() => { const d = window.__dbg; let n = 0;
              for (let i = 0; i < 1200; i++) { if (d.G.state === 'dchoose') { const x = d.dcur, c = x.c; n++;
                if (x.type === 'call') { if (c.kind === 'none') d.noDispatch(c, c.c.ref); else { const u = (c.idealU || []).find(d.unitFree) || d.units.find(d.unitFree); if (u) d.dispatchUnit(c, u); else d.later(c); } }
                else { const act = (d.SCENE[c.c.id] || {}).act || 'go'; if (act !== 'go' && !c.decidedGo) d.chooseNoTransport(c, x.u, act); else { const ev = c.evalH; d.chooseTransport(c, x.u, d.HOSPITALS[ev.best]); } }
                continue; } if (d.G.state !== 'play') break; d.simulate(1 / 60); }
              return { t: Math.round(d.D.t), calls: d.D.calls, dist: d.dcalls.map((c) => d.STATIONS[c.dist].name), units: d.units.map((u) => u.name + ':' + u.state), dec: n, saved: d.D.saved, dead: d.D.dead, wait: d.D.waitSum, xd: d.D.xdN,
                er: d.HOSPITALS.filter((H) => H.er).map((H) => H.name + ' ' + d.erRatio(H).toFixed(2) + (H.er.full ? '滿' : '')), gaps: d.STATIONS.map((S, i) => d.districtCovered(i) ? '' : S.name).filter(Boolean) }; }''')
            print('dispatch', json.dumps(r, ensure_ascii=False))
        await shot(page, 'v12_dispatch')
        errs = [l for l in logs if 'error' in l.lower() and 'ERR_FAILED' not in l]
        print('\n'.join(errs[-10:]) or 'no errors')
        await browser.close()
asyncio.run(main())

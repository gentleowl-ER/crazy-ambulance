"""v17: weekday rush and weekend crowds: jams on the map, packed traffic, the navigation warning, the 即時路況 upgrade."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

STATS = '''() => { const d = window.__dbg, J = d.JAM;
  const on = d.traffic.filter((v) => !v.off), jamv = d.traffic.filter((v) => v.jamOnly && !v.off);
  const inJ = on.filter((v) => v.e.jam && v.s >= v.e.jam.s0 && v.s <= v.e.jam.s1), outJ = on.filter((v) => !v.e.jam && !v.scoot);
  const avg = (a) => a.length ? +(a.reduce((s, v) => s + v.cur, 0) / a.length).toFixed(1) : null;
  return { id: J.id, n: J.list.length, w: J.w, spots: J.spots.map((s) => s.name), jamCars: jamv.length, inJam: inJ.length, vJam: avg(inJ), vFree: avg(outJ),
    car: [Math.round(d.car.x), Math.round(d.car.z)], road: d.placeName(d.car.x, d.car.z), tl: document.getElementById('timerLbl').textContent }; }'''

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        # free mode: the time-of-week row on the start screen, then 好事多 on a weekend
        await page.click('#freeBtn')
        await page.wait_for_timeout(400)
        await page.click('#tpRow2 [data-tp="weekend"]')
        r = await page.evaluate('() => ({ pick: window.__dbg.G.tpPick, note: document.getElementById("tpNote2").textContent, btns: [...document.querySelectorAll("#tpRow2 .hp")].map((b) => b.textContent) })')
        print('spots row', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v17_spots_{W}')
        await page.evaluate('''() => { const b = [...document.querySelectorAll("#spotsList .spot")].find((b) => b.querySelector("b").textContent === "好事多"); b.click(); }''')
        await page.wait_for_timeout(800)
        await page.evaluate('() => { const d = window.__dbg; d.camState.sight = null; d.G.wxPick = "day"; for (let i = 0; i < 240; i++) d.simulate(1 / 30); }')
        r = await page.evaluate(STATS)
        print('costco weekend', json.dumps(r, ensure_ascii=False))
        r = await page.evaluate('() => { const d = window.__dbg; return d.JAM.list.filter((J) => J.name === "好事多").map((J) => [J.e.name, Math.round(J.s1 - J.s0), +J.j.toFixed(2)]); }')
        print('costco jams', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1200)
        await shot(page, f'v17_costco_{W}')
        await page.evaluate('() => window.__dbg.openMap()')
        await page.wait_for_timeout(900)
        await shot(page, f'v17_bigmap_weekend_{W}')
        await page.evaluate('() => window.__dbg.closeMap()')
        # the briefing row, then a rush-hour mission
        await page.evaluate('() => window.__dbg.showTitle()')
        await page.wait_for_timeout(300)
        await page.click('#startBtn')
        await page.wait_for_timeout(600)
        await page.click('#tpRow [data-tp="rush"]')
        r = await page.evaluate('() => ({ shown: !document.getElementById("tpPick").hidden, pick: window.__dbg.G.tpPick, note: document.getElementById("tpNote").textContent })')
        print('brief row', json.dumps(r, ensure_ascii=False))
        await page.evaluate('() => document.getElementById("tpPick").scrollIntoView()')
        await shot(page, f'v17_brief_{W}')
        await page.evaluate('() => { const d = window.__dbg; d.G.wxPick = "day"; d.G.homePick = "da"; d.startGame(); d.G.countdown = 0.01; for (let i = 0; i < 4; i++) d.simulate(1 / 30); }')
        r = await page.evaluate('''() => { const d = window.__dbg, J = d.JAM; const names = {}; for (const q of J.list) names[q.name] = (names[q.name] || 0) + 1;
          return { id: J.id, w: J.w, names, f: d.jamF(J.list[0].e) }; }''')
        print('rush', json.dumps(r, ensure_ascii=False))
        # a route along 忠孝東路 (station -> 101): the guide warns about the jam
        r = await page.evaluate('''() => { const d = window.__dbg; const J = d.JAM.list.find((q) => q.name === '忠孝東路' && q.j > 0.5) || d.JAM.list.find((q) => q.kind === 'rush' && q.j > 0.5);
          const [x, z, tx, tz] = d.edgePoint(J.e, 4); d.carReset(x, z, Math.atan2(tx, tz)); d.camState.px = x; d.camState.pz = z;
          const p = d.patients.find((p) => p.state === 'wait'); const far = d.edgePoint(J.e, J.e.len - 2);
          // move the waiting call to the far end of the jammed block
          p.proj = d.nearestOnRoads(far[0], far[1]); d.selCall = p; d.JAM.warnKey = null; d.JAM.warnT = -99; d.updateGuide(true);
          return { block: J.e.name, j: +J.j.toFixed(2), guideJam: Math.round(d.guide.jam || 0), bubble: document.getElementById('bubble').hidden ? '' : document.getElementById('bubble').textContent.slice(0, 120) }; }''')
        print('warn', json.dumps(r, ensure_ascii=False))
        await page.evaluate('''() => { const d = window.__dbg; const J = d.JAM.list.filter((q) => q.kind === 'rush' && q.j > 0.7 && q.e.len > 120).sort((a, b) => b.e.len - a.e.len)[0];
          const [x, z, tx, tz] = d.edgePoint(J.e, J.e.len / 2); const h = Math.atan2(tx, tz), lx = x - Math.cos(h) * J.e.hw * 0.45, lz = z + Math.sin(h) * J.e.hw * 0.45;
          d.carReset(lx, lz, h); d.camState.px = lx; d.camState.pz = lz; d.camState.yaw = h; d.populateAround(lx, lz, false);
          for (let k = 0; k < 8; k++) { for (let i = 0; i < 30; i++) d.simulate(1 / 30); d.carReset(lx, lz, h); } window.__rushBlock = d.placeName(lx, lz); }''')
        r = await page.evaluate(STATS)
        print('rush traffic', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1300)
        await shot(page, f'v17_rush_{W}')
        # the 即時路況 upgrade: the navigation weighs jams
        r = await page.evaluate('''() => { const d = window.__dbg; const e = d.JAM.list.find((q) => q.j > 0.6).e; const before = d.jamF(e);
          d.UPG_LV.nav = 3; d.applyTime('rush'); const e2 = d.JAM.list.find((q) => q.j > 0.6).e; const after = d.jamF(e2); d.UPG_LV.nav = 0;
          return { before: +before.toFixed(2), after: +after.toFixed(2), w: d.JAM.w, garage: d.upgrades.map((u) => u.name) }; }''')
        print('nav', json.dumps(r, ensure_ascii=False))
        # dispatch on a weekend: the desk always knows
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.G.tpPick = "weekend"; d.startDispatch(); for (let i = 0; i < 6; i++) d.simulate(1 / 30); }')
        r = await page.evaluate('() => { const d = window.__dbg; return { id: d.JAM.id, w: d.JAM.w, n: d.JAM.list.length }; }')
        print('dispatch', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(1500)
        await shot(page, f'v17_dispatch_{W}')
        # back to the title: no jams left
        await page.evaluate('() => window.__dbg.showTitle()')
        r = await page.evaluate('() => { const d = window.__dbg; return { n: d.JAM.list.length, jamCars: d.traffic.filter((v) => v.jamOnly && !v.off).length, edgesJam: d.edges.filter((e) => e.jam).length }; }')
        print('title', json.dumps(r))
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

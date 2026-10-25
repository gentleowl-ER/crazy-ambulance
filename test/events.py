"""Medals and Taiwan events: fake ride (refuse / deliver), red light, getting lost, stubborn car,
garbage truck, medal toasts, results medal row and the medal cabinet."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

BOARD = '''((id) => { const d = window.__dbg; d.G.state = 'play';
    const c = id === 'fakeride' ? d.TW_CASES[0] : d.CASES.find(c => c.id === id);
    const p = d.spawnCall(d.scene, { c, dmin: 60, dmax: 400 });
    d.selCall = p;
    const e = p.proj.e; const P = e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(p.proj.s / 3)));
    const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
    d.carReset(p.rx, p.rz, h); d.camState.yaw = h; d.camState.px = p.rx; d.camState.pz = p.rz;
    for (let i = 0; i < 160 && d.G.state === 'play' && !d.riding; i++) d.simulate(1/60);
    return { state: d.G.state, riding: d.riding && d.riding.c.id, panel: !document.getElementById('dest').hidden,
      refuse: !!document.querySelector('#destRows .drow.refuse') }; })'''


async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        # 1. fake ride, refused
        r = await page.evaluate(BOARD + "('fakeride')")
        print('fake board', r)
        await page.wait_for_timeout(600)
        await shot(page, f'ev_fake_panel_{W}')
        await page.click('#destRows .drow.refuse')
        await page.wait_for_timeout(1700)
        r = await page.evaluate('''(() => { const d = window.__dbg; return { riding: !!d.riding, score: d.G.score, medals: d.SHIFT.medals.slice(),
            card: !document.getElementById('caseCard')?.hidden, log: d.caseLog.slice(-1).map(x => x.outcome) }; })()''')
        print('after refuse', r)
        await shot(page, f'ev_fake_refused_{W}')
        await page.evaluate('''(() => { const b = document.querySelector('#caseCard button, #caseOk'); if (b) b.click(); })()''')
        await page.wait_for_timeout(300)
        # 2. fake ride, driven to hospital
        await page.evaluate('''(() => { const d = window.__dbg; d.SHIFT.fake = false; })()''')
        r = await page.evaluate(BOARD + "('fakeride')")
        print('fake board 2', r)
        r = await page.evaluate('''(() => { const d = window.__dbg; const rd = d.riding; if (!rd) return 'no rider';
            d.chooseDest(0); const H = d.HOSPITALS[0]; const m = d.hospMarks[0];
            const P = H.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(H.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(m.x, m.z, h); d.camState.yaw = h; d.camState.px = m.x; d.camState.pz = m.z;
            for (let i = 0; i < 90 && d.G.state === 'play' && d.riding; i++) d.simulate(1/60);
            return { riding: !!d.riding, score: d.G.score, medals: d.SHIFT.medals.slice(), log: d.caseLog.slice(-1).map(x => x.outcome) }; })()''')
        print('after fake delivered', r)
        await page.wait_for_timeout(900)
        await shot(page, f'ev_fake_taxi_{W}')
        await page.wait_for_timeout(1500)
        await shot(page, f'ev_fake_taxi_card_{W}')
        await page.evaluate('''(() => { const b = document.querySelector('#caseCard button, #caseOk'); if (b) b.click(); })()''')
        # 3. red light without the siren
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play'; d.SIREN.t = 0;
            const out = [];
            for (const sig of d.SIGNALS.values()) {
              for (const { e, dir } of d.nodeEdges[sig.id] || []) {
                if (e.len < 50 || !sig.groups.has(e.idx)) continue;
                if (d.sigPhase(sig, sig.groups.get(e.idx)) !== 'R' || d.sigRedLeft && d.sigRedLeft(sig, sig.groups.get(e.idx)) < 4) continue;
                const s0 = dir === 1 ? 34 : e.len - 34, s1 = dir === 1 ? 0 : e.len;
                const a = d.edgePoint(e, s0), b = d.edgePoint(e, s1);
                const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
                // drive on the right-hand lane
                const lx = -Math.cos(h) * 2.5, lz = Math.sin(h) * 2.5;
                d.carReset(a[0] + lx, a[1] + lz, h); d.camState.yaw = h;
                for (const v of d.traffic) if (Math.hypot(v.x - sig.x, v.z - sig.z) < 60) { v.x += 400; v.z += 400; }
                const n0 = d.SHIFT.n.red || 0;
                for (let i = 0; i < 200; i++) { d.car.vx = Math.sin(d.car.h) * 15; d.car.vz = Math.cos(d.car.h) * 15; d.simulate(1/60); if ((d.SHIFT.n.red || 0) > n0) break; }
                out.push({ sig: sig.id, red: d.SHIFT.n.red || 0 });
                if (out.length >= 5) return out;
              }
            }
            return out; })()''')
        print('red runs', r)
        await page.wait_for_timeout(300)
        await shot(page, f'ev_red_{W}')
        r = await page.evaluate('() => ({ medals: window.__dbg.SHIFT.medals.slice(), score: window.__dbg.G.score })')
        print('after red', r)
        # 4. getting lost: the route to the call keeps getting longer
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
            const p = d.spawnCall(d.scene, { c: d.CASES.find(c => c.id === 'stroke'), dmin: 80, dmax: 200 }); d.selCall = p;
            d.carReset(p.rx + 2, p.rz + 2, 0); d.updateGuide(true);
            const lens = [d.guide.len];
            // walk away from the call along the roads
            for (let k = 1; k <= 8; k++) {
              let best = null, bd = -1;
              for (const e of d.edges) { const q = d.edgePoint(e, e.len / 2); const dd = Math.hypot(q[0] - p.rx, q[1] - p.rz); if (dd > 90 * k && dd < 90 * k + 60) { best = q; break; } }
              if (!best) break;
              d.carReset(best[0], best[1], 0); d.updateGuide(true); lens.push(Math.round(d.guide.len));
            }
            return { lens, lost: d.SHIFT.n.lost || 0, medals: d.SHIFT.medals.slice() }; })()''')
        print('lost', r)
        # 5. stubborn car: siren on, the car ahead does not yield
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play'; d.SHIFT.stubT = 0;
            const edges = d.edges.filter(e => e.len > 160 && e.hw > 6 && !e.flags.campus);
            const e = edges[0]; const a = d.edgePoint(e, 20), b = d.edgePoint(e, 30);
            const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
            const lx = -Math.cos(h) * e.hw * 0.5, lz = Math.sin(h) * e.hw * 0.5;
            d.carReset(a[0] + lx, a[1] + lz, h); d.camState.yaw = h;
            // park a sedan 30 units ahead in our lane
            const v = d.traffic.find(v => v.kind === 'car');
            v.e = e; v.dir = 1; v.s = 50; v.stun = 0; v.init = true; v.cur = 10;
            d.SIREN.t = 6;
            const res = [];
            for (let i = 0; i < 240; i++) { d.SIREN.t = 6; d.car.vx = Math.sin(h) * 12; d.car.vz = Math.cos(h) * 12; d.simulate(1/60); if (d.SHIFT.stub) break; }
            const s = d.SHIFT.stub;
            for (let i = 0; i < 60; i++) { d.SIREN.t = 6; d.simulate(1/60); }
            const others = d.traffic.filter(o => o !== s && o.yield).length;
            return { stub: s ? s.kind : null, stubYield: s ? s.yield : null, stubborn: s ? +s.stubborn.toFixed(1) : 0, othersYield: others }; })()''')
        print('stubborn', r)
        await page.evaluate('''(() => { const d = window.__dbg; d.G.view = 'high'; d.updateViewButtons && d.updateViewButtons(); })()''')
        await page.wait_for_timeout(700)
        await shot(page, f'ev_stubborn_{W}')
        # 6. garbage truck nearby
        r = await page.evaluate('''(() => { const d = window.__dbg; const v = d.traffic.find(v => v.kind === 'garbage');
            if (!v) return 'no truck';
            const fx = Math.sin(v.h), fz = Math.cos(v.h);
            d.carReset(v.x - fx * 16 - Math.cos(v.h) * 0, v.z - fz * 16, v.h); d.camState.yaw = v.h; d.SIREN.t = 0;
            return { truck: [Math.round(v.x), Math.round(v.z)], base: +v.base.toFixed(1) }; })()''')
        print('truck', r)
        await page.wait_for_timeout(2500)
        r = await page.evaluate('''(() => { const d = window.__dbg; return { vol: +d.ELISE_T.vol.toFixed(4), i: d.ELISE_T.i, trash: d.SHIFT.trash,
            ctx: d.AU && d.AU.ctx ? d.AU.ctx.state : 'none' }; })()''')
        print('elise', r)
        await shot(page, f'ev_truck_{W}')
        # 7. a good medal toast
        await page.evaluate('''(() => { const d = window.__dbg; d.award('ohca'); d.award('fast'); })()''')
        await page.wait_for_timeout(250)
        await shot(page, f'ev_medal_toast_{W}')
        # 8. end the shift: results with the medal row
        await page.evaluate('''(() => { const d = window.__dbg; d.G.view = 'top'; d.G.state = 'play'; d.G.time = 0.1; for (let i = 0; i < 200; i++) d.simulate(1/60); })()''')
        await page.wait_for_timeout(1200)
        r = await page.evaluate('''(() => ({ state: window.__dbg.G.state, row: document.getElementById('medalRow').children.length, hidden: document.getElementById('medalRow').hidden }))()''')
        print('results', r)
        await shot(page, f'ev_over_{W}')
        await page.evaluate('''(() => { const el = document.getElementById('medalRow'); el.scrollIntoView(); })()''')
        await page.wait_for_timeout(300)
        await shot(page, f'ev_over_medals_{W}')
        # 9. the medal cabinet
        await page.evaluate('''(() => { const d = window.__dbg; d.showTitle(); })()''')
        await page.wait_for_timeout(500)
        await page.click('#medalsBtn')
        await page.wait_for_timeout(600)
        r = await page.evaluate('''(() => ({ state: window.__dbg.G.state, count: document.getElementById('medalCount').textContent, cells: document.querySelectorAll('#medalList .mcell').length,
            saved: JSON.parse(localStorage.getItem('crazy-ambulance-v1') || '{}').medals }))()''')
        print('cabinet', r)
        await shot(page, f'ev_cabinet_{W}')
        print(json.dumps(await info(page)))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-3000:])
        await browser.close()
asyncio.run(main())

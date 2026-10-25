"""Street life: shortcuts through alleys, horns without the siren, people shouting at a near miss,
scooters in the box at a red light, and a look at the new street details."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
H = int(sys.argv[2]) if len(sys.argv) > 2 else 640

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.add_style_tag(content='#casecard.pop, #bubble.pop { animation: none !important; } .toast { animation: none !important; opacity: 1 !important; }')
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        # 1. drive through an alley end to end
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
            const R = d.ALLEY_RUNS.find(R => R.e.name === '民生東路 61巷');
            const [ax, az] = R.a, [bx, bz] = R.b; const h = Math.atan2(bx - ax, bz - az);
            d.carReset(ax - Math.sin(h) * 10, az - Math.cos(h) * 10, h);
            const score0 = d.G.score; let inside = 0, air = 0;
            for (let i = 0; i < 900; i++) {
              d.car.vx = Math.sin(d.car.h) * 16; d.car.vz = Math.cos(d.car.h) * 16; d.car.h = h;
              d.simulate(1/60);
              if (d.ALLEY_RUN.cur) inside++;
              if (d.car.airborne) air++;
              if (Math.hypot(d.car.x - bx, d.car.z - bz) > Math.hypot(ax - bx, az - bz) + 30) break;
              if (Math.hypot(d.car.x - bx, d.car.z - bz) < 1 || (d.car.x - bx) * Math.sin(h) + (d.car.z - bz) * Math.cos(h) > 14) break;
            }
            for (let i = 0; i < 30; i++) d.simulate(1/60);
            return { inside, air, gained: d.G.score - score0, n: d.SHIFT.n.alley || 0, surf: d.car.surface }; })()''')
        print('alley run', r)
        # 2. horns: stop in front of a moving car with the siren off
        r = await page.evaluate('''(() => { const d = window.__dbg; d.SIREN.t = 0; d.G.state = 'play';
            const v = d.traffic.find(v => v.kind === 'car' && !v.scoot && v.cur > 5) || d.traffic.find(v => v.kind === 'car');
            const fx = Math.sin(v.h), fz = Math.cos(v.h);
            d.carReset(v.x + fx * 8, v.z + fz * 8, v.h); v.cur = 10; v.hornT = 0;
            let n0 = d.SAY.pool.filter(s => s.t > 0).length;
            for (let i = 0; i < 20; i++) d.simulate(1/60);
            const shown = d.SAY.pool.filter(s => s.t > 0).length;
            return { hornT: +(v.hornT || 0).toFixed(1), Gt: +d.G.t.toFixed(1), balloons: shown - n0, tip: d.SHIFT.hornTip }; })()''')
        print('horn', r)
        await page.wait_for_timeout(500)
        await shot(page, f'street_horn_{W}')
        # 3. a pedestrian dives out of the way
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
            const p = d.peds.find(p => p.state === 'walk' && Math.hypot(p.x - d.car.x, p.z - d.car.z) < 200) || d.peds[0];
            const h = d.car.h; d.carReset(p.x - Math.sin(h) * 9, p.z - Math.cos(h) * 9, Math.atan2(p.x - (p.x - Math.sin(h) * 9), p.z - (p.z - Math.cos(h) * 9)));
            d.car.vx = Math.sin(d.car.h) * 18; d.car.vz = Math.cos(d.car.h) * 18; d.car.speed = 18;
            const n0 = d.SAY.pool.filter(s => s.t > 0).length;
            for (let i = 0; i < 25; i++) { d.car.vx = Math.sin(d.car.h) * 18; d.car.vz = Math.cos(d.car.h) * 18; d.simulate(1/60); }
            return { state: p.state, voice: p.voice, balloons: d.SAY.pool.filter(s => s.t > 0).length - n0, yelpT: +(p.yelpT || 0).toFixed(1) }; })()''')
        print('yelp', r)
        await page.wait_for_timeout(500)
        await shot(page, f'street_yelp_{W}')
        # 4. scooters gather in the box at a red light
        r = await page.evaluate('''(() => { const d = window.__dbg; let best = null;
            for (const sig of d.SIGNALS.values()) for (const { e, dir } of d.nodeEdges[sig.id] || []) {
              if (e.flags.alley || e.len < sig.hw + 40) continue;
              const ph = d.sigPhase(sig, sig.groups.get(e.idx) || 0);
              if (ph !== 'R') continue;
              const near = d.traffic.filter(v => v.e === e && v.red && (v.dir === 1 ? e.len - v.s : v.s) < sig.hw + 25);
              if (near.some(v => v.scoot) && near.some(v => !v.scoot)) { best = { sig, e, dir, near }; break; }
            }
            if (!best) return 'no red with scooters right now';
            const { sig, e, dir, near } = best;
            return near.map(v => ({ kind: v.kind, gap: +((dir === 1 ? e.len - v.s : v.s) - sig.hw).toFixed(1) })); })()''')
        print('stop box', r)
        # 5. look at the details: a signal junction from the high chase view, a bus bay, a building site
        for name, js in [('junction', '''const sig = [...d.SIGNALS.values()].find(s => s.hw >= 8); const { e, dir } = d.nodeEdges[sig.id].find(o => o.e.len > 60 && !o.e.flags.alley);
                const s0 = dir === 1 ? sig.hw + 30 : e.len - sig.hw - 30; const q = d.edgePoint(e, s0); const h = dir === 1 ? Math.atan2(-q[2], -q[3]) : Math.atan2(q[2], q[3]);
                d.carReset(q[0] - Math.cos(h) * 2, q[1] + Math.sin(h) * 2, h);'''),
                         ('busbay', '''const b = d.BUS_BAYS[3]; const h = Math.atan2(b.ux, b.uz); d.carReset(b.x - b.ux * 22 + b.nx * 3, b.z - b.uz * 22 + b.nz * 3, h);''')]:
            await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.view = 'high'; d.G.state = 'play'; d.SIREN.t = 0; {js} d.camState.yaw = d.car.h; d.camState.arm = 0; for (let k = 0; k < 20; k++) d.simulate(1/60); }})()''')
            await page.wait_for_timeout(1200)
            await shot(page, f'street_{name}_{W}')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-2000:])
        await browser.close()
asyncio.run(main())

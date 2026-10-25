"""Walk through pickup -> destination panel -> wrong hospital -> reject panel -> delivery card -> results."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932
CASE = sys.argv[3] if len(sys.argv) > 3 else 'stemi'

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(200)
        # replace the first call with the requested case and drive onto it
        r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play';
            const c = d.CASES.find(c => c.id === '{CASE}');
            const p = d.spawnCall(d.scene, {{ c, dmin: 60, dmax: 400 }});
            d.selCall = p;
            const e = p.proj.e; const [x, z, tx, tz] = [p.rx, p.rz, 0, 0];
            const P = e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(p.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(p.rx, p.rz, h); d.camState.yaw = h; d.camState.px = p.rx; d.camState.pz = p.rz;
            for (let i = 0; i < 120 && d.G.state === 'play'; i++) d.simulate(1/60);
            return {{ state: d.G.state, riding: d.riding && d.riding.c.id, ideal: d.riding && d.riding.eval.ideal }}; }})()''')
        print('after pickup', r)
        await page.wait_for_timeout(700)
        await shot(page, f'flow_panel_{W}')
        # choose a hospital that cannot treat the patient, then teleport there
        r = await page.evaluate('''(() => { const d = window.__dbg; const rd = d.riding;
            const i = d.HOSPITALS.findIndex(H => !d.accepts(H, rd.c)); if (i < 0) return 'all accept';
            d.chooseDest(i); const H = d.HOSPITALS[i]; const m = d.hospMarks[i];
            const P = H.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(H.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(m.x, m.z, h); d.camState.yaw = h; d.camState.px = m.x; d.camState.pz = m.z;
            for (let i = 0; i < 90 && d.G.state === 'play'; i++) d.simulate(1/60);
            return { state: d.G.state, at: H.id, rejects: d.G.rejects }; })()''')
        print('after wrong', r)
        await page.wait_for_timeout(700)
        await shot(page, f'flow_reject_{W}')
        r = await page.evaluate('''(() => { const d = window.__dbg; const rd = d.riding; const i = rd.eval.best;
            d.chooseDest(i); const H = d.HOSPITALS[i]; const m = d.hospMarks[i];
            const P = H.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(H.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(m.x, m.z, h); d.camState.yaw = h; d.camState.px = m.x; d.camState.pz = m.z;
            for (let i = 0; i < 60 && d.G.state === 'play'; i++) d.simulate(1/60);
            return { state: d.G.state, saved: d.G.saved, score: d.G.score }; })()''')
        print('after deliver', r)
        await page.wait_for_timeout(500)
        await shot(page, f'flow_deliver_{W}')
        await page.wait_for_timeout(1500)
        await shot(page, f'flow_card_{W}')
        # end the shift
        await page.evaluate('''(() => { const d = window.__dbg; d.G.time = 0.1; for (let i = 0; i < 200; i++) d.simulate(1/60); })()''')
        await page.wait_for_timeout(800)
        await shot(page, f'flow_over_{W}')
        await page.evaluate('''(() => { const det = document.querySelector('#review details'); if (det) det.open = true; })()''')
        await page.evaluate('document.getElementById("over").scrollTop = 600')
        await page.wait_for_timeout(300)
        await shot(page, f'flow_over2_{W}')
        print(json.dumps(await info(page)))
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-2000:])
        await browser.close()
asyncio.run(main())

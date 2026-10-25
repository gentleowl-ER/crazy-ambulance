"""v11 hospitals: the destination list (sorted, 11 rows), the 雙聖 rejection, the briefing with eleven cards and the big map."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 760

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        # briefing first: eleven cards, pictures rendering one per frame
        await page.evaluate('window.__dbg.showBriefing("mission")')
        await page.wait_for_timeout(2500)
        await shot(page, f'h11_brief_{W}')
        await page.evaluate('document.getElementById("brief").scrollTop = 99999')
        await page.wait_for_timeout(1500)
        await shot(page, f'h11_brief_end_{W}')
        r = await page.evaluate('''(() => [...document.querySelectorAll('.hcard')].map(c => c.querySelector('b').textContent + ':' + [...c.querySelectorAll('.chip')].map(x => x.textContent).join('/')))()''')
        print('cards', json.dumps(r, ensure_ascii=False))
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(200)
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
            const c = d.CASES.find(c => c.id === 'stemi');
            const p = d.spawnCall(d.scene, { c, dmin: 60, dmax: 400 });
            d.selCall = p;
            const e = p.proj.e, P = e.pts, k = Math.max(1, Math.min(P.length - 1, Math.round(p.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(p.rx, p.rz, h); d.camState.yaw = h; d.camState.px = p.rx; d.camState.pz = p.rz;
            for (let i = 0; i < 120 && d.G.state === 'play'; i++) d.simulate(1/60);
            const rows = [...document.querySelectorAll('#destRows .drow')].map(b => b.querySelector('.num').textContent + b.querySelector('.hn b').textContent + ' ' + b.querySelector('.dist').textContent);
            return { state: d.G.state, riding: d.riding && d.riding.c.id, rows, foot: document.getElementById('destFoot').textContent }; })()''')
        print('panel', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(600)
        await shot(page, f'h11_panel_{W}')
        # the key for #11 is '-'
        await page.keyboard.press('Equal')
        await page.wait_for_timeout(200)
        r = await page.evaluate('''(() => { const d = window.__dbg; const rd = d.riding; const H = rd.dest; const i = d.HOSPITALS.indexOf(H); const m = d.hospMarks[i];
            const P = H.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(H.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(m.x, m.z, h); d.camState.yaw = h; d.camState.px = m.x; d.camState.pz = m.z; d.populateAround(m.x, m.z);
            for (let i = 0; i < 90 && d.G.state === 'play'; i++) d.simulate(1/60);
            return { dest: H.name, state: d.G.state, rejects: d.G.rejects, medals: d.SHIFT.medals, alert: document.getElementById('destAlert').textContent }; })()''')
        print('at 雙聖', json.dumps(r, ensure_ascii=False))
        await page.wait_for_timeout(800)
        await shot(page, f'h11_reject_{W}')
        # close the panel, look at 雙聖 from the street, then the big map
        r = await page.evaluate('''(() => { const d = window.__dbg; const i = d.riding.eval.best; d.chooseDest(i); d.G.state = 'play'; d.G.view = 'high';
            const H = d.HOSPITALS.find(H => H.id === 'kf'); const m = d.hospMarks[d.HOSPITALS.indexOf(H)];
            d.carReset(m.x + 30, m.z - 6, -Math.PI / 2 + 0.3); d.camState.yaw = d.car.h; d.camState.px = d.car.x; d.camState.pz = d.car.z; d.camState.arm = 0;
            for (let i = 0; i < 30; i++) d.simulate(1/60); return d.G.state; })()''')
        await page.wait_for_timeout(1400)
        await shot(page, f'h11_kf_{W}')
        await page.evaluate('window.__dbg.openMap()')
        await page.wait_for_timeout(800)
        await shot(page, f'h11_map_{W}')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-2500:])
        await browser.close()
asyncio.run(main())

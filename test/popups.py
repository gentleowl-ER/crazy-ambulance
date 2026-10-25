"""Pop-up placement: the case card opened while stopped, folded while driving; speech bubble and toasts."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932
VIEW = sys.argv[3] if len(sys.argv) > 3 else 'top'

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        await page.add_style_tag(content='#casecard.pop, #bubble.pop { animation: none !important; }')
        await page.evaluate(f'window.__dbg.G.view = "{VIEW}"; window.__dbg.startGame()')
        await page.wait_for_timeout(300)
        r = await page.evaluate('''(() => { const d = window.__dbg; d.G.state = 'play';
            const c = d.CASES.find(c => c.id === 'stemi');
            const p = d.spawnCall(d.scene, { c, dmin: 60, dmax: 400 }); d.selCall = p;
            const P = p.proj.e.pts; const k = Math.max(1, Math.min(P.length - 1, Math.round(p.proj.s / 3)));
            const h = Math.atan2(P[k][0] - P[k-1][0], P[k][1] - P[k-1][1]);
            d.carReset(p.rx, p.rz, h); d.camState.yaw = h;
            for (let i = 0; i < 160 && d.G.state === 'play' && !d.riding; i++) d.simulate(1/60);
            const rd = d.riding; const i = rd.eval.best; d.chooseDest(i); const Hh = d.HOSPITALS[i]; const m = d.hospMarks[i];
            const Q = Hh.proj.e.pts; const k2 = Math.max(1, Math.min(Q.length - 1, Math.round(Hh.proj.s / 3)));
            const h2 = Math.atan2(Q[k2][0] - Q[k2-1][0], Q[k2][1] - Q[k2-1][1]);
            d.carReset(m.x, m.z, h2); d.camState.yaw = h2;
            for (let j = 0; j < 90 && d.G.state === 'play' && d.riding; j++) d.simulate(1/60);
            return { saved: d.G.saved }; })()''')
        print('delivered', r)
        await page.wait_for_function('!document.getElementById("casecard").hidden', timeout=60000)
        await page.wait_for_timeout(600)
        st = '''(() => { const c = document.getElementById('casecard'); const b = c.getBoundingClientRect(); return { cls: c.className, box: [b.x|0, b.y|0, b.width|0, b.height|0] }; })()'''
        print('stopped', await page.evaluate(st))
        await shot(page, f'pop_stopped_{W}_{VIEW}')
        # drive off: the card folds to a chip
        await page.evaluate('''(() => { const d = window.__dbg; for (let i = 0; i < 40; i++) { d.car.vx = Math.sin(d.car.h) * 20; d.car.vz = Math.cos(d.car.h) * 20; d.simulate(1/60); } d.caseCardStep(0.1); })()''')
        await page.wait_for_timeout(300)
        print('driving', await page.evaluate(st), await page.evaluate('(() => { const d = window.__dbg; return { state: d.G.state, riding: !!d.riding, dest: !document.getElementById("dest").hidden, speed: +d.car.speed.toFixed(1), mini: document.getElementById("hud").className }; })()'))
        await page.evaluate('''(() => { const d = window.__dbg; d.toast('闖紅燈！沒鳴笛就要停紅燈', '−10', true); })()''')
        await page.evaluate('''(() => { const el = document.querySelector('#toasts .toast'); if (el) { el.style.animation = 'none'; el.style.opacity = 1; } })()''')
        await shot(page, f'pop_driving_{W}_{VIEW}')
        # tap the chip: it opens and stays open
        await page.evaluate('''(() => { const d = window.__dbg; d.showCaseCard({ tri: 'red', title: '救活了！', pts: '+260', name: '王先生', dx: '急性心肌梗塞', why: '心肌梗塞要送有心導管室的醫院，越快打通阻塞的血管，心肌壞死就越少。', plus: '送對醫院！' }, 0); d.caseCardStep(0.1); })()''')
        print('before tap', await page.evaluate('(() => { const d = window.__dbg; return { mini: d.CARD.mini, pin: d.CARD.pin, hidden: document.getElementById("casecard").hidden, speed: +d.car.speed.toFixed(1) }; })()'))
        await page.evaluate('document.getElementById("casecard").click()')
        await page.wait_for_timeout(300)
        print('tapped', await page.evaluate(st))
        await shot(page, f'pop_tapped_{W}_{VIEW}')
        await page.evaluate('window.__dbg.hideCaseCard()')
        # a speech bubble from the back of the ambulance
        await page.evaluate('''(() => { const d = window.__dbg; d.bubble('隨車救護員', '開穩一點！後面在急救！', '#e0413a', 5); const b = document.getElementById('bubble'); b.classList.remove('pop'); })()''')
        await page.wait_for_timeout(300)
        await shot(page, f'pop_bubble_{W}_{VIEW}')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l and 'GPU stall' not in l)[-1500:])
        await browser.close()
asyncio.run(main())

"""Watch a signalised junction: traffic queues at red, pedestrians cross, then the siren holds everything."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

async def main():
    jx, jz = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (92, -77)
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 900, 700, touch=False)
        await page.evaluate('window.__dbg.startFree()')
        await page.evaluate(f'''(() => {{ const d = window.__dbg; d.carReset({jx} + 1, {jz} + 40, Math.PI); d.populateAround({jx}, {jz}, false);
            for (let i = 0; i < 60 * 14; i++) d.simulate(1/60); }})()''')
        async def photo(name):
            await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'paused'; const c = d.camera; c.far = 600; c.updateProjectionMatrix();
                c.position.set({jx} + 38, 58, {jz} + 52); c.lookAt({jx}, 0, {jz}); d.trafficRender(); d.pedRender(d.G.t); }})()''')
            await page.wait_for_timeout(700)
            await shot(page, name)
            await page.evaluate("window.__dbg.G.state = 'play'")
        r = await page.evaluate(f'''(() => {{ const d = window.__dbg; const sig = [...d.SIGNALS.values()].sort((a, b) => Math.hypot(a.x - {jx}, a.z - {jz}) - Math.hypot(b.x - {jx}, b.z - {jz}))[0];
            return {{ node: sig.id, ph: [d.sigPhase(sig, 0), d.sigPhase(sig, 1)], heads: sig.heads.length, near: d.traffic.filter(v => Math.hypot(v.x - {jx}, v.z - {jz}) < 70).map(v => [v.kind, Math.round(v.cur), v.red]) }}; }})()''')
        print('before', json.dumps(r, ensure_ascii=False))
        await photo('junction_a')
        await page.evaluate('(() => { const d = window.__dbg; for (let i = 0; i < 60 * 7; i++) d.simulate(1/60); })()')
        await photo('junction_b')
        # siren on, ambulance close to the junction
        await page.evaluate(f'''(() => {{ const d = window.__dbg; d.carReset({jx} + 1, {jz} + 22, Math.PI); d.keys.siren = true;
            for (let i = 0; i < 60 * 5; i++) d.simulate(1/60); d.keys.siren = false; }})()''')
        r = await page.evaluate(f'''(() => {{ const d = window.__dbg; return {{ siren: d.SIREN.t, near: d.traffic.filter(v => Math.hypot(v.x - {jx}, v.z - {jz}) < 70).map(v => [v.kind, +v.cur.toFixed(1), v.red, v.yield]),
            peds: d.peds.filter(p => Math.hypot(p.x - {jx}, p.z - {jz}) < 40).map(p => p.state) }}; }})()''')
        print('siren', json.dumps(r, ensure_ascii=False))
        await photo('junction_siren')
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-1500:])
        await browser.close()
asyncio.run(main())

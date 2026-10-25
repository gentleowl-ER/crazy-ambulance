"""Close-ups of waiting patients for several cases."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot, info

CASES = sys.argv[1].split(',') if len(sys.argv) > 1 else ['ohca', 'stroke', 'preecl', 'seizure']

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 900, 700, touch=False)
        await page.evaluate('window.__dbg.startGame()')
        await page.wait_for_timeout(200)
        for cid in CASES:
            r = await page.evaluate(f'''(() => {{ const d = window.__dbg; d.G.state = 'play';
              let p = null;
              for (let k = 0; k < 20 && !(p && (cid => true)('x') && (p.c.id !== 'ohca' || p.cpr)); k++) {{
                const c = d.CASES.find(c => c.id === '{cid}');
                p = d.spawnCall(d.scene, {{ c, dmin: 60, dmax: 900 }});
                if (c.id === 'ohca' && !p.cpr) {{ /* keep trying for the CPR variant */ }}
              }}
              const cx = p.x - p.nx * 14, cz = p.z - p.nz * 14;
              d.carReset(cx - p.tx * 8, cz - p.tz * 8, Math.atan2(p.tx, p.tz));
              d.G.state = 'paused';
              const cam = d.camera; cam.far = 600; cam.updateProjectionMatrix();
              cam.position.set(p.x - p.nx * 15 + p.tx * 4, 9, p.z - p.nz * 15 + p.tz * 4);
              cam.lookAt(p.x, 1.2, p.z);
              d.patientsRender(d.G.t);
              return {{ id: p.c.id, cpr: p.cpr, comp: p.comp && p.comp.kind, name: p.name }}; }})()''')
            # keep rendering a few frames with the paused state (frame() still renders)
            await page.wait_for_timeout(900)
            await shot(page, f'patient_{cid}')
            print(r)
        print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-2000:])
        await browser.close()
asyncio.run(main())

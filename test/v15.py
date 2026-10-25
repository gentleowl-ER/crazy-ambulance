"""v15: nicknames only, the loudspeaker, free mode from any spot."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot

W = int(sys.argv[1]) if len(sys.argv) > 1 else 430
H = int(sys.argv[2]) if len(sys.argv) > 2 else 932

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, W, H)
        r = await page.evaluate('() => ({ real: window.__dbg.HOSPITALS.some((h) => h.real), html: ["臺大醫院", "國泰醫院", "榮總"].filter((n) => document.documentElement.innerHTML.includes(n)) })')
        print('names', json.dumps(r, ensure_ascii=False))
        # free mode: the start picker
        await page.click('#freeBtn')
        await page.wait_for_timeout(500)
        r = await page.evaluate('() => ({ shown: !document.getElementById("spots").hidden, n: document.querySelectorAll("#spotsList .spot").length, groups: [...document.querySelectorAll("#spotsList h3")].map((h) => h.textContent) })')
        print('spots', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v15_spots_{W}')
        # start at 頂好醫院 (北投)
        await page.evaluate('() => { const b = [...document.querySelectorAll("#spotsList .spot")].find((b) => b.textContent.includes("頂好醫院")); b.click(); }')
        await page.wait_for_timeout(1500)
        r = await page.evaluate('() => { const d = window.__dbg, H = d.HOSPITALS.find((h) => h.id === "vg"); return { state: d.G.state, mode: d.G.mode, car: [Math.round(d.car.x), Math.round(d.car.z)], toHosp: Math.round(Math.hypot(d.car.x - H.drop[0], d.car.z - H.drop[1])), road: d.placeName(d.car.x, d.car.z) }; }')
        print('start', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v15_start_{W}')
        # every spot gives a pose on a road
        r = await page.evaluate('''() => { const d = window.__dbg; const bad = [];
          d.spotList().forEach(([g, list]) => list.forEach((s) => { const P = s.pose(); const rd = d.roadDist(P.x, P.z); if (!(rd < 0.5) || !(P.h > -10)) bad.push([s.name, Math.round(rd * 10) / 10]); }));
          return { bad }; }''')
        print('poses', json.dumps(r, ensure_ascii=False))
        # jump from the pause menu
        await page.evaluate('() => window.__dbg.showSpots(true)')
        await page.wait_for_timeout(300)
        await page.evaluate('() => { const b = [...document.querySelectorAll("#spotsList .spot")].find((b) => b.textContent.includes("美麗華")); b.click(); }')
        await page.wait_for_timeout(1500)
        r = await page.evaluate('() => { const d = window.__dbg; return { state: d.G.state, road: d.placeName(d.car.x, d.car.z), car: [Math.round(d.car.x), Math.round(d.car.z)] }; }')
        print('jump', json.dumps(r, ensure_ascii=False))
        await shot(page, f'v15_jump_{W}')
        # the loudspeaker: a mission, a stubborn car in front
        await page.evaluate('() => { const d = window.__dbg; d.showTitle(); d.G.wxPick = "day"; d.startGame(); d.G.countdown = 0.01; for (let i = 0; i < 3; i++) d.simulate(1 / 30); }')
        r = await page.evaluate('''() => { const d = window.__dbg; const e = d.edges.filter((e) => e.len > 160 && e.hw > 6 && !e.flags.campus)[0];
          const a = d.edgePoint(e, 20), b = d.edgePoint(e, 30), h = Math.atan2(b[0] - a[0], b[1] - a[1]);
          d.carReset(a[0] - Math.cos(h) * e.hw * 0.5, a[1] + Math.sin(h) * e.hw * 0.5, h);
          const v = d.traffic.find((v) => v.kind === 'car'); v.e = e; v.dir = 1; v.s = 45; v.stun = 0; v.init = true; v.cur = 8;
          for (let i = 0; i < 4; i++) d.simulate(1 / 30);
          v.stubborn = 7; d.SHIFT.stub = v;
          d.shout();
          for (let i = 0; i < 30; i++) d.simulate(1 / 30);
          return { stub: !!d.SHIFT.stub, stubborn: v.stubborn, scold: +(v.scold || 0).toFixed(1), yield: v.yield, n: d.SHIFT.n.shout }; }''')
        print('shout', json.dumps(r))
        await page.wait_for_timeout(700)
        await shot(page, f'v15_shout_{W}')
        print('\n'.join(l for l in logs if 'pageerror' in l or ('error' in l.lower() and 'ERR_FAILED' not in l))[-2500:])
        await browser.close()
asyncio.run(main())

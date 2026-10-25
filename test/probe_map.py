"""Dump a part of the city map with a coordinate grid (for placing things by hand).
usage: python3 probe_map.py x0 z0 x1 z1 [px_per_unit] [name]"""
import asyncio, sys, base64
from playwright.async_api import async_playwright
from harness import open_page, OUT

x0, z0, x1, z1 = (float(a) for a in sys.argv[1:5])
k = float(sys.argv[5]) if len(sys.argv) > 5 else 1.4
name = sys.argv[6] if len(sys.argv) > 6 else 'map'

JS = r'''([x0, z0, x1, z1, k]) => {
  const d = window.__dbg, img = d.mapImg, S = d.MAP_SCALE;
  const W = Math.round((x1 - x0) * k), H = Math.round((z1 - z0) * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.drawImage(img, (x0 - d.WX0) * S, (z0 - d.WZ0) * S, (x1 - x0) * S, (z1 - z0) * S, 0, 0, W, H);
  const P = (x, z) => [(x - x0) * k, (z - z0) * k];
  g.font = '10px sans-serif'; g.textBaseline = 'top';
  for (let x = Math.ceil(x0 / 50) * 50; x <= x1; x += 50) { const [px] = P(x, 0); g.strokeStyle = x % 100 ? 'rgba(0,0,255,0.18)' : 'rgba(0,0,255,0.4)'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); if (x % 100 === 0) { g.fillStyle = '#0018a8'; g.fillText(String(x), px + 2, 2); } }
  for (let z = Math.ceil(z0 / 50) * 50; z <= z1; z += 50) { const [, py] = P(0, z); g.strokeStyle = z % 100 ? 'rgba(0,0,255,0.18)' : 'rgba(0,0,255,0.4)'; g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke(); if (z % 100 === 0) { g.fillStyle = '#0018a8'; g.fillText(String(z), 2, py + 2); } }
  const DC = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080'];
  for (const sp of d.spawnPts) { if (sp.dist === undefined) continue; const [px, py] = P(sp.px, sp.pz); g.fillStyle = DC[sp.dist % 6]; g.fillRect(px - 1.5, py - 1.5, 3, 3); }
  g.font = 'bold 11px sans-serif';
  for (const H of d.HOSPITALS) { const [px, py] = P(H.drop[0], H.drop[1]); g.fillStyle = H.css; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText(H.name, px + 7, py - 6); }
  for (const S of d.STATIONS) { const [px, py] = P(S.pos[0], S.pos[1]); g.fillStyle = '#d9312b'; g.fillRect(px - 5, py - 5, 10, 10); g.fillStyle = '#000'; g.fillText(S.name + '站', px + 7, py - 6); }
  g.font = '10px sans-serif'; g.fillStyle = '#7a1f00';
  for (const r of d.ROADS) { const pts = r.pts || []; for (let i = 0; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, mz = (pts[i][1] + pts[i + 1][1]) / 2; if (mx < x0 || mx > x1 || mz < z0 || mz > z1) continue; const [px, py] = P(mx, mz); g.fillText(r.n, px + 3, py + 3); break; } }
  return cv.toDataURL('image/png');
}'''

async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 800, 600)
        url = await page.evaluate(JS, [x0, z0, x1, z1, k])
        (OUT / f'{name}.png').write_bytes(base64.b64decode(url.split(',')[1]))
        print('saved', name)
        await browser.close()
asyncio.run(main())

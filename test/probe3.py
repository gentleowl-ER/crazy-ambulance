import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_page, shot
async def main():
    async with async_playwright() as p:
        browser, page, logs = await open_page(p, 900, 700, touch=False)
        r = await page.evaluate('''(() => { const d = window.__dbg; const out = [];
          d.scene.traverse((o) => { if (o.isInstancedMesh && o.material === d.MAT.decal) out.push({ n: o.count, attrs: Object.keys(o.geometry.attributes), vis: o.visible, bs: o.geometry.boundingSphere && [Math.round(o.geometry.boundingSphere.center.x), Math.round(o.geometry.boundingSphere.center.z), Math.round(o.geometry.boundingSphere.radius)] }); });
          return { decalMeshes: out.length, sample: out.slice(0, 4), total: out.reduce((a, b) => a + b.n, 0) }; })()''')
        print(json.dumps(r))
        await page.evaluate('''(() => { const d = window.__dbg; d.startFree(); d.G.state = 'paused'; const c = d.camera; c.far = 600; c.updateProjectionMatrix(); c.position.set(92 + 10, 22, -77 + 25); c.lookAt(92, 0, -77); })()''')
        await page.wait_for_timeout(800)
        await shot(page, 'probe_markings')
        r = await page.evaluate('''(() => { const d = window.__dbg; let first = null;
          d.scene.traverse((o) => { if (o.isInstancedMesh && o.material === d.MAT.decal) { first = first || o; } });
          const m = new THREE.Matrix4(); first.getMatrixAt(0, m); const p = new THREE.Vector3().setFromMatrixPosition(m);
          const sc = new THREE.Vector3().setFromMatrixScale(m);
          const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
          d.scene.traverse((o) => { if (o.isInstancedMesh && o.material === d.MAT.decal) o.material = mat; });
          return { pos: [p.x, p.y, p.z], scale: [sc.x, sc.y, sc.z], ic: !!first.instanceColor, frustum: first.frustumCulled }; })()''')
        print(json.dumps(r))
        await page.wait_for_timeout(800)
        await shot(page, 'probe_markings2')
        print('\\n'.join(l for l in logs if 'ERR_FAILED' not in l)[-1500:])
        await browser.close()
asyncio.run(main())

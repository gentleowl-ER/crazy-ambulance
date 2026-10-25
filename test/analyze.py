import asyncio, json, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).parent
THREE = pathlib.Path('/home/claude/deps/node_modules/three/build/three.min.js').read_bytes()
JS = r'''(async () => {
  const d = window.__dbg, cam = d.camera, scene = d.scene;
  d.G.state = "play"; d.carReset(30, 4, 1.5708); d.camState.yaw = 1.5708; for (let i = 0; i < 30; i++) d.simulate(1/60); await new Promise(r => setTimeout(r, 1500));
  const THREE_ = window.THREE;
  cam.updateMatrixWorld(); const fr = new THREE_.Frustum().setFromProjectionMatrix(new THREE_.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const rows = {}; let total = 0, calls = 0;
  scene.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    if (!o.visible) return;
    let vis = true; let p = o; while (p) { if (!p.visible) vis = false; p = p.parent; }
    if (!vis) return;
    if (o.frustumCulled !== false && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(s)) return; }
    const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const inst = o.isInstancedMesh ? o.count : 1;
    const key = (o.isInstancedMesh ? 'I:' : 'M:') + (o.material.type) + (o.material.side === 1 ? ':back' : '') + ':' + Math.round(n);
    rows[key] = rows[key] || { n: 0, tris: 0 }; rows[key].n++; rows[key].tris += n * inst; total += n * inst; calls++;
  });
  const top = Object.entries(rows).sort((a, b) => b[1].tris - a[1].tris).slice(0, 18);
  let fl = []; scene.traverse((o) => { if (o.isInstancedMesh && o.geometry.attributes.position.count === 452*3 && o.material.type === 'MeshToonMaterial') fl.push([Math.round(o.geometry.boundingSphere.center.x), Math.round(o.geometry.boundingSphere.center.z), Math.round(o.geometry.boundingSphere.radius), o.count, o.frustumCulled]); });
  return { total: Math.round(total), calls, top, cam: [cam.position.x, cam.position.y, cam.position.z, cam.far, cam.fov, d.G.state], fluffyChunks: fl };
})()'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await (await b.new_context(viewport={'width': 430, 'height': 932})).new_page()
        async def handle(route):
            url = route.request.url
            if 'three.min.js' in url: await route.fulfill(status=200, body=THREE, headers={'content-type': 'application/javascript'})
            elif url.startswith('file://'): await route.continue_()
            else: await route.abort()
        await page.route('**/*', handle)
        await page.add_init_script('window.__keepThree = true;')
        await page.goto('file://' + str(ROOT / 'test.html'))
        await page.wait_for_function('window.__dbg && window.__dbg.G.state === "title"', timeout=60000)
        await page.evaluate('window.__dbg.startGame()')
        r = await page.evaluate(JS)
        print(json.dumps(r, indent=1))
        await b.close()
asyncio.run(main())

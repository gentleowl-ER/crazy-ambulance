// ===================== free mode: 路名挑戰 — find the place from its address, no navigation =====================
// A hospital or a landmark, given only the way a dispatcher would read it out ("吳興街，象山腳下"; "至善路，靠近中正路口").
// The guide arrow, the route line and the map markers go away: the street sign under the minimap is all there is.
// The big map still opens, for ten seconds on the clock. Medal times come from the length of the best route.
const ADDR_BEST = {}; // target name -> best time (kept between visits)
// "road, near the cross street": from the street a place stands on and the nearest junction along it
function addrClue(proj) {
  const e = proj.e, road = roadLabel(e, proj.px, proj.pz);
  const base = (n) => n.replace(/(東西|南北|東|西|南|北)?路.*$/, '').replace(/街.*$/, '');
  let cross = '', bd = Infinity;
  for (const [id, s] of [[e.a, 0], [e.b, e.len]]) {
    const d = Math.abs(proj.s - s);
    if (d > bd) continue;
    const [nx, nz] = NODES[id];
    for (const o of nodeEdges[id] || []) {
      if (o.e === e || o.e.flags.alley || o.e.flags.ring || o.e.flags.campus) continue;
      const n = roadLabel(o.e, nx, nz);
      if (base(n) === base(road)) continue;
      cross = n; bd = d;
      break;
    }
  }
  return cross ? `${road}，靠近${cross}口` : road;
}
function addrTargets() {
  const T = HOSPITALS.map((H) => ({ name: `${H.name}`, full: H.name, clue: H.hint, x: H.drop[0], z: H.drop[1], proj: H.proj, css: H.css, r: 11, hosp: H }));
  for (const L of LM) if (L.proj.d < 45) T.push({ name: L.name, full: L.name, clue: addrClue(L.proj), x: L.proj.px, z: L.proj.pz, proj: L.proj, css: LM_GOLD, r: 16 });
  return T;
}
function startAddr() {
  if (G.mode !== 'free' || G.state !== 'play') return;
  if (G.addr) { G.addr = null; toast('路名挑戰取消了', ''); updateGuide(true); return; }
  G.trial = null;
  const D0 = dijkstra(nearestOnRoads(car.x, car.z));
  const all = addrTargets().map((t) => ({ t, L: routeCost(D0, t.proj) }));
  let opts = all.filter((o) => o.L > 260 && o.L < 900 && o.t.name !== G.addrLast);
  if (!opts.length) opts = all.filter((o) => o.L > 120);
  const { t, L } = gpick(opts);
  G.addrLast = t.name;
  // medal times: a little slower than the timed run (finding the way takes thinking)
  G.addr = Object.assign({}, t, { L, t: 0, peeks: 0, lim: [L / 23 + 6, L / 18 + 8, L / 13 + 10] });
  updateGuide(true);
  sfx.beep(true);
  bigMsg('路名挑戰！', `${t.full}・${t.clue}`, 2.4);
  setTimeout(() => {
    if (G.addr && G.state === 'play') bubble('調度中心', `不看導航，請開到 <b>${t.full}</b>：${t.clue}。看小地圖下面的<b>路名牌</b>找路；打開大地圖要加 10 秒。`, '#2f9e8f', 7, 'pin');
  }, 900);
}
function addrPeek() {
  if (!G.addr) return;
  G.addr.t += 10; G.addr.peeks++;
  toast('偷看地圖 +10 秒', '', true);
}
function addrStep(dt) {
  const A = G.addr;
  A.t += dt;
  if (car.speed > 6 || car.airborne || car.sinking || hypot(car.x - A.x, car.z - A.z) > A.r) return false;
  G.addr = null;
  const tier = A.lim.findIndex((x) => A.t <= x);
  const best = ADDR_BEST[A.name], isBest = !best || A.t < best;
  if (isBest) { ADDR_BEST[A.name] = +A.t.toFixed(1); saveState(); }
  if (tier === 0 && !A.peeks) award('roadwise');
  if (A.hosp) { G.hospCD[A.hosp.id] = G.t + 25; VISITED.add(A.hosp.id); }
  // a landmark found this way goes into the collection too (without a second card on top of this one)
  const newLM = !A.hosp && !FOUND.has(A.name);
  if (newLM) { FOUND.add(A.name); saveState(); }
  if (tier >= 0) { sfx.deliver(tier === 0 ? 2 : 1); confetti(car.x, 3, car.z, [TRIAL_TIERS[tier][1], '#ffffff', A.css], 60); } else sfx.wrong();
  bigMsg(tier >= 0 ? `${TRIAL_TIERS[tier][0]}！` : '找到了！', `${fmtTrial(A.t)}・${A.full}`, 1.8);
  showCaseCard({ chip: { name: '路名挑戰', css: tier >= 0 ? TRIAL_TIERS[tier][1] : '#8f8a84' }, title: tier >= 0 ? `${TRIAL_TIERS[tier][0]}・${fmtTrial(A.t)}` : `用時 ${fmtTrial(A.t)}`,
    name: A.full, dx: `${A.clue}・最佳紀錄 ${fmtTrial(ADDR_BEST[A.name])}`,
    why: `金牌 ${fmtTrial(A.lim[0])}・銀牌 ${fmtTrial(A.lim[1])}・銅牌 ${fmtTrial(A.lim[2])}。${A.peeks ? `偷看地圖 ${A.peeks} 次（每次 +10 秒）。` : '一次都沒看地圖！'}救護員要熟記轄區的路：報案的人往往只說得出路名和路口。`,
    plus: [isBest && best ? '新紀錄！' : '', newLM ? `也收進地標圖鑑了（${FOUND.size}/${LM.length}）。` : ''].filter(Boolean).join(' ') }, 1.7);
  updateGuide(true);
  return true;
}

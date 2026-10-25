// ===================== the garage: ambulance upgrades =====================
// Points from every shift go into the station's fund (救護基金); the fund buys upgrades for the ambulance you drive
// (mission and free mode). Three levels each, kept between visits.
const UPGRADES = [
  { id: 'engine', name: '引擎', icon: 'bolt', desc: '加速更快、極速更高', lv: ['極速 +4%・加速 +10%', '極速 +8%・加速 +20%', '極速 +12%・加速 +30%'] },
  { id: 'tyre', name: '輪胎', icon: 'car', desc: '抓地力更好，雨天颱風不打滑', lv: ['抓地 +4%・雨天少滑三成', '抓地 +8%・雨天少滑六成', '抓地 +12%・雨天幾乎不滑'] },
  { id: 'susp', name: '避震', icon: 'wave', desc: '撞擊和陣風對病人、車子的影響變小', lv: ['撞擊傷害 −20%・陣風 −20%', '撞擊傷害 −40%・陣風 −40%', '撞擊傷害 −60%・陣風 −60%'] },
  { id: 'siren', name: '警笛', icon: 'siren', desc: '更遠的車聽得到，提早讓道', lv: ['讓道範圍 +15%', '讓道範圍 +30%', '讓道範圍 +45%'] },
  { id: 'nav', name: '即時路況', icon: 'pin', desc: '導航知道哪裡塞車，幫你避開車陣', lv: ['導航避開一半的車陣影響', '導航避開大部分車陣', '導航完全掌握路況'] },
  { id: 'kit', name: '急救箱', icon: 'cross', desc: '車上照護更好，病人撐得更久', lv: ['病人時間流失 −8%', '病人時間流失 −16%', '病人時間流失 −24%'] },
];
const UPG_COST = [1000, 2500, 4500];
const UPG_BY = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
const UPG_LV = {}; // id -> 0..3
const DRV = { grip: 1, top: 1, acc: 1, wind: 1, siren: 1, care: 1, bump: 1 };
const lv = (id) => UPG_LV[id] || 0;
// what the ambulance can do now: its upgrades, in this shift's weather
function updateDrive() {
  const wg = WX.cur.grip;
  DRV.grip = (wg + (1 - wg) * 0.3 * lv('tyre')) * (1 + 0.04 * lv('tyre'));
  DRV.top = 1 + 0.04 * lv('engine');
  DRV.acc = 1 + 0.1 * lv('engine');
  DRV.wind = 1 - 0.2 * lv('susp');
  DRV.bump = 1 - 0.2 * lv('susp');
  DRV.siren = 1 + 0.15 * lv('siren');
  DRV.care = 1 - 0.08 * lv('kit');
}
// the end of a shift pays into the fund
function payFund(score, disp) {
  const n = Math.max(0, Math.round(disp ? score * 0.35 : score));
  G.bank = (G.bank || 0) + n;
  saveState();
  return n;
}
function buyUpgrade(id) {
  const L = lv(id);
  if (L >= 3) return false;
  const cost = UPG_COST[L];
  if ((G.bank || 0) < cost) return false;
  G.bank -= cost;
  UPG_LV[id] = L + 1;
  updateDrive();
  saveState();
  sfx.medal();
  return true;
}
function showGarage() {
  showScreen('garage');
  renderGarage();
}
function renderGarage() {
  UI.garageBank.textContent = `${(G.bank || 0).toLocaleString('en-US')}`;
  UI.garageList.innerHTML = UPGRADES.map((u) => {
    const L = lv(u.id), cost = UPG_COST[L], can = L < 3 && (G.bank || 0) >= cost;
    const pips = [0, 1, 2].map((i) => `<i class="${i < L ? 'on' : ''}"></i>`).join('');
    const btn = L >= 3 ? '<span class="gmax">已滿級</span>'
      : `<button class="btn small${can ? '' : ' ghost'}" type="button" data-up="${u.id}"${can ? '' : ' disabled'}>升級 ${cost.toLocaleString('en-US')}</button>`;
    return `<div class="gitem"><span class="gi">${iconSVG(u.icon, '#ffffff', 22)}</span><div class="gt"><b>${u.name}<span class="pips">${pips}</span></b>`
      + `<span>${u.desc}</span><small>${L ? `目前：${u.lv[L - 1]}` : '尚未升級'}${L < 3 ? `　下一級：${u.lv[L]}` : ''}</small></div>${btn}</div>`;
  }).join('');
}

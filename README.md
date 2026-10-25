# 瘋狂救護車

一款在台北街頭開救護車的網頁遊戲。接 119 派遣、判斷病人需要哪一種急救能力、挑對的醫院，
在真實比例的台北地圖上穿越車陣把病人送到。

**直接玩：** 打開 `index.html`，或啟用 GitHub Pages 後從 Pages 網址進入。

## 三種模式

- **出勤任務**：開救護車接病人，選擇有能力處理的醫院；會遇到急診壅塞、大量傷患事件（START 檢傷）、天氣、路況事件與尖峰／假日塞車。
- **派遣模式**：當 119 派遣員，追問病情、判斷緊急程度、決定派哪一台車、送哪一家醫院，必要時電話指導 CPR。
- **自由模式**：從任何醫院、救護站或地標出發，逛台北、收集地標、挑戰路名與送醫計時賽。

## 免責聲明

- 本遊戲為教育與娛樂用途，**不能取代正式的急救或救護訓練**。遇到緊急狀況請撥 **119**。
- 本作品**非台北市政府消防局或任何醫療機構的官方作品**。
- 遊戲中的醫院一律使用虛構暱稱，與真實醫院的能力、規模與營運狀況無關。
- 地圖依真實道路與地標位置簡化繪製，比例與細節不保證精確。

## 專案結構

```
src/head.html, src/body.html   頁面骨架與樣式
src/js/*.js                    遊戲程式（依檔名順序串接）
build.py                       組合成單一 HTML：dist/crazy-ambulance.html 與 test/test.html
index.html                     可直接開啟的完整頁面（給 GitHub Pages 用）
test/*.py                      Playwright 自動測試（無頭 Chromium）
```

## 建置

```bash
python3 build.py   # 同時產生 dist/crazy-ambulance.html、index.html 與 test/test.html
```

遊戲是單一 HTML 檔，執行時從 jsDelivr 載入 three.js r149，從 Google Fonts 載入字型。

## 測試

測試使用 Python Playwright，在無頭 Chromium（SwiftShader）中開啟 `test/test.html`，並從本機提供 three.js。
`test/harness.py` 內的 three.js 路徑需改成你本機的 `node_modules/three/build/three.min.js`。

```bash
cd test && python3 v17.py   # 或其他任一測試
```

## 使用的開放原始碼

- [three.js](https://threejs.org/)（MIT License）
- 字型 [jf open 粉圓（Huninn）](https://github.com/justfont/open-huninn-font)（SIL Open Font License 1.1）
- 字型 [Fredoka](https://fonts.google.com/specimen/Fredoka)（SIL Open Font License 1.1）

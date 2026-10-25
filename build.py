import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"

head = (SRC / "head.html").read_text()
body = (SRC / "body.html").read_text()
js_parts = sorted((SRC / "js").glob("*.js"))
js = "\n".join(p.read_text() for p in js_parts)

page = (
    head
    + "\n"
    + body
    + f'\n<script src="{THREE_URL}"></script>\n'
    + "<script>\n(function () {\n'use strict';\n"
    + js
    + "\n})();\n</script>\n"
)
dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "crazy-ambulance.html").write_text(page)

# local test wrapper that mimics the artifact skeleton (plus a debug handle for automated playtests)
DEBUG = (
    "window.__dbg = { G, car, patients, keys, edges, NODES, HOSPITALS, CASES, TRIAGE, traffic, peds, knock, guide, guidePoint, startGame, carReset, landF, roadDist,"
    " groundHeight, hospMarks, colliders, BUILDINGS, LANDMARKS, caseLog, get riding() { return riding; }, get scene() { return scene; }, get renderer() { return renderer; },"
    " get camera() { return camera; }, nearestOnRoads, route, dijkstra, routeCost, evaluateChoices, accepts, get spawnPts() { return spawnPts; }, spawnCall,"
    " simulate, updateGuide, readInput, input, camState, openDest, closeDest, chooseDest, showBriefing, showResults, endGame, waitingCalls, get selCall() { return selCall; },"
    " set selCall(v) { selCall = v; }, cycleCall, hospitalDistances, get START() { return START; }, MAT, TITLE_C, updateCamera, patientsRender, hospitalsRender, landmarkLabelsRender, towerFade, carVisual, SIGNALS, sigPhase, sigRedLeft, SIREN, startFree, FOUND, VISITED, get LM() { return LM; }, openMap, closeMap, drawBigMap, placeName, trafficStep, pedStep, showTitle, populateAround, get sigClock() { return sigClock; }, lampHeads, trafficRender, pedRender, knockRender,"
    " units, dcalls, D, DQ, get dcur() { return dcur; }, get dsel() { return dsel; }, set dsel(v) { dsel = v; }, startDispatch, dispatchUnit, noDispatch, later, chooseTransport, chooseNoTransport,"
    " SCENE, NOCALLS, REFERRALS, STATIONS, UNIT_TYPES, unitDistances, idealUnits, unitFree, dispatchStep, dispatchRender, drawDMap, updateDispatchHUD, applyViewOffset, VIEW, spawnDCall, pickDCase, buildRoute, unitStep, camTarget, focusPoint, carStep, ev, trafficCollide, groundHeight, roadDist, sendUnit, routeAt, CAPS, LEVELS,"
    " startTrial, TRIALS, SEEN, showCodex, isDiverted, ER, erWait, erLevel, erRatio, erStep, resetER, erAdmit, districtOf, distName, DIST_PTS, DIST_NB, stationStart, homeStation, get hold() { return G.hold; }, districtCovered, askCall, phoneCPR, refreshDecision, resetCar, respawnCar, get trial() { return G.trial; }, callsByPriority, currentCall, PREEMPT, musicUpdate, MUSIC, get AU() { return AU; }, rockStep, chillStep, chillLen, musicBus, musicMood, ROCK_BPM, queryColliders, collide, CHUNK, SKY, VIEWS, cycleView, skyRender, updateArrow, placeArrow, renderFrame, FX, CUT, updateViewButtons, chaseOn, get VIEWCONE() { return VIEWCONE; },"
    " SHIFT, MEDALS, MEDAL_WON, award, tally, resetShift, refuseRide, deliverFake, redLightStep, crashAfterRed, lostStep, stubbornStep, renderMedalRow, showMedals, TW_CASES, chooseCase, TRUCK, ELISE_T, eliseUpdate, garbageSound, REDL, sfx, logCase, showScreen, nodeEdges, edgePoint, toast, bigMsg, introGate, startIntro, endIntro, INTRO, IT, introPath, queueHospViews, HV, drawHospLoc, renderHospShot, hospShotPose, titleCamPose, hillH, PARKS, PLAZAS, HUMP_SPOTS, sdRoundRect, segDist2, segIntersect, ROADS, graphNodes, roadLabel, parkVal, plazaVal, caseCardStep, hideCaseCard, CARD, bubble, showCaseCard, yelp, horn, hornAt, pedYelp, sayAt, SAY, ALLEY_RUNS, ALLEY_RUN, alleyStep, BUS_BAYS, alleyDist, isMouth, STREET, footprintOK, groundOK, zoneOf, rectOverlaps, DECKS, bridgeY, AMUSE, BRANDS, VEG, admits, hospNote, bigMapView, CITY_VIEW, drawBriefMap, rejectAt: (m) => rejectAt(m), checkArrival, get mapImg() { return mapImg; }, MAP_SCALE, WX0, WZ0, WXS, WZS, ROADEV, spawnRoadEvent, endRoadEvent, revPt, WX, WEATHERS, applyWeather, DRV, UPG_LV, buyUpgrade, updateDrive, showGarage, LAMPS, NIGHTFX, MCI, spawnMCI, mciTag, mciConfirm, mciTake, mciArrive, startAddr, addrTargets, addrClue, ADDR_BEST, askFollow, judgePriority, FOLLOW, shout, showSpots, startSight, applySight, LANDMARK_LABELS, JAM, TIMES, FILL, FILL_AT, applyTime, clearJams, jamStep, jamLimit, jamF, placeJamVehicle, renderTpPick, upgrades: UPGRADES, pickSpot0, spotList, poseAt };"
)
page_dbg = page.replace("/*__DEBUG__*/", DEBUG)
skeleton = (
    "<!doctype html><html lang=\"zh-Hant\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">"
    "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}"
    "body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>"
    "</head><body>\n" + page_dbg + "\n</body></html>"
)
(ROOT / "test" / "test.html").write_text(skeleton)
print("built", len(page), "bytes;", len(js_parts), "js parts")

#!/usr/bin/env node
// alien-face-run.js — headless proof for the ANIMATED FACE RIG in
// app/starcruise/alien.js (the "puppeteer" pass). Imports THREE + the alien/traits
// modules in a headless page (same offline harness as alien-run) and asserts the
// face is a MOVING rig, not a frozen mask:
//
//   A. RIG EXISTS + CONTIGUOUS — every alien carries eyes (with pupils + eyelids)
//      and brows on the head, and the whole rig is ONE connected cluster (face parts
//      are attached to the head, nothing floats).
//   B. EYES LIVE — over several beats the pupils MOVE (the gaze target wanders) and a
//      real eyelid BLINK occurs (closedness peaks high, opens back to ~0).
//   C. LIP-SYNC — the LEAD vocalist's mouth OPENS on its OWN note onsets and opens
//      WIDER on higher-velocity notes; a BASS player's mouth stays ~closed; the
//      DRUMMER grimaces on hard hits; a dancer's mouth bobs with loudness.
//   D. PERSONALITY — two SAME-seed aliens are byte-identical (gaze/blink/mouth trace);
//      DIFFERENT-seed aliens differ in gaze rhythm + blink rate (individuals).
//   E. PRESERVED — the arm still CONTACTS the instrument at the onset (play-the-score
//      law intact) even with the face rig driving every frame.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/alien-face-run.js
"use strict";
const path = require("path");
const { serve, installOfflineRoute } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8816;

async function launchGL() {
  const fs = require("fs");
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--enable-webgl"];
  const opts = { headless: true, args };
  if (fs.existsSync(exe)) opts.executablePath = exe;
  return chromium.launch(opts);
}

async function inPage() {
  let THREE = await import("/vendor/three/three.module.min.js");
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const traitsMod = await import("/app/starcruise/traits.js");
  const alienMod = await import("/app/starcruise/alien.js");
  const makeAlien = alienMod.makeAlien;
  const K = window.GenreKernel, V = window.GenreVerifier;

  const genre = (K && K.GENRES && Object.keys(K.GENRES)[0]) || "vaporwave";
  const traits = traitsMod.traitsFromGenre(K, V, genre, 7);
  const out = {};

  const leadM = { role: "lead", voice: "melody", instrument: { family: "bladder-horn", playStyle: "blow", appendage: 2, hitsPerBeat: 1 } };
  const bassM = { role: "bass", voice: "bass", instrument: { family: "coiled-gut", playStyle: "pluck", appendage: 1, hitsPerBeat: 1 } };
  const drumM = { role: "drum", voice: "drums", instrument: { family: "membrane-sac", playStyle: "drum", appendage: 0, hitsPerBeat: 4 } };

  // ---- A: rig exists + is CONTIGUOUS (face parts attached to the head) -----------
  function contiguity(al, inflFrac) {
    al.group.updateMatrixWorld(true);
    const boxes = []; let maxDim = 0;
    al.group.traverse((o) => {
      if (o.isMesh && o.geometry) {
        const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return;
        const s = new THREE.Vector3(); b.getSize(s); maxDim = Math.max(maxDim, s.x, s.y, s.z); boxes.push(b);
      }
    });
    const infl = maxDim * inflFrac;
    const bb = boxes.map((b) => b.clone().expandByScalar(infl));
    const n = bb.length, parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (bb[i].intersectsBox(bb[j])) parent[find(i)] = find(j);
    const roots = new Set(); for (let i = 0; i < n; i++) roots.add(find(i));
    return { meshes: n, components: roots.size };
  }
  const lead = makeAlien(THREE, traits, leadM, 314);
  lead.update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0 }] });
  const fd = lead.faceDebug();
  out.rig = { eyes: fd.eyes, brows: fd.brows, hasLids: fd.hasLids };
  out.contig = contiguity(lead, 0.05);

  // ---- drive an alien over ~11s, capturing the live face trace -------------------
  // barDur cycles the bar; notes carry the voice's onsets. dt accumulates the clock so
  // gaze wandering + blinking actually happen over the window.
  function driveTrace(al, notes, loudness, N, dt, barDur) {
    const gaze = [], pupilX = [], blink = [], mouth = [], reach = [], contactAt = {};
    for (let i = 0; i < N; i++) {
      const t = i * dt;
      const bp = (t / barDur) % 1;
      al.update(dt, { barPhase: bp, playing: true, level: 1, loudness, notes });
      const f = al.faceDebug(), d = al.debug();
      gaze.push(f.gaze.x); pupilX.push(f.pupil ? f.pupil.x : 0);
      blink.push(f.blink); mouth.push(f.mouth); reach.push(d.reachDist);
      // record the closest-to-onset mouth/reach for each onset time.
      for (const nt of notes) {
        const dd = Math.min(Math.abs(bp - nt.t), 1 - Math.abs(bp - nt.t));
        const key = nt.t.toFixed(3);
        if (!contactAt[key] || dd < contactAt[key].dd) contactAt[key] = { dd, mouth: f.mouth, reach: d.reachDist, contact: d.contactness };
      }
    }
    const rng = (a) => Math.max(...a) - Math.min(...a);
    return { gaze, pupilX, blink, mouth, reach, contactAt,
      gazeRange: +rng(gaze).toFixed(4), pupilRange: +rng(pupilX).toFixed(4),
      blinkMax: +Math.max(...blink).toFixed(4), blinkMin: +Math.min(...blink).toFixed(4),
      mouthMax: +Math.max(...mouth).toFixed(4) };
  }

  // ---- B: EYES LIVE — pupils move + a blink happens ------------------------------
  const leadTrace = makeAlien(THREE, traits, leadM, 314);
  const LT = driveTrace(leadTrace, [{ t: 0.0, vel: 0.9 }, { t: 0.5, vel: 0.35 }], 1.0, 660, 1 / 60, 1.5);
  out.eyes = { gazeRange: LT.gazeRange, pupilRange: LT.pupilRange, blinkMax: LT.blinkMax, blinkMin: LT.blinkMin };
  out.pupilsMove = LT.gazeRange > 0.08 && LT.pupilRange > 0.004;
  out.blinkOccurs = LT.blinkMax > 0.6 && LT.blinkMin < 0.12;

  // ---- C: LIP-SYNC — lead opens on its onsets, bass stays ~closed ----------------
  const bass = makeAlien(THREE, traits, bassM, 315);
  const BT = driveTrace(bass, [{ t: 0.25 }, { t: 0.75 }], 1.0, 300, 1 / 60, 1.5);
  // mouth AT each onset (closest phase sample).
  out.leadMouthAtOnsets = Object.values(LT.contactAt).map((v) => +v.mouth.toFixed(3));
  out.bassMouthMax = BT.mouthMax;
  out.leadMouthMax = LT.mouthMax;
  out.leadLipSyncs = out.leadMouthAtOnsets.every((m) => m > 0.5);
  out.bassStaysClosed = BT.mouthMax < 0.3;
  out.lipSyncGap = out.leadMouthMax > BT.mouthMax + 0.3;

  // velocity -> mouth WIDTH: a hard note opens WIDER than a soft one (same phase).
  const velA = makeAlien(THREE, traits, leadM, 314);
  velA.update(0.016, { barPhase: 0.0, playing: true, level: 1, loudness: 1, notes: [{ t: 0.0, vel: 0.95 }] });
  const mouthHi = velA.faceDebug().mouth;
  velA.update(0.016, { barPhase: 0.0, playing: true, level: 1, loudness: 1, notes: [{ t: 0.0, vel: 0.30 }] });
  const mouthLo = velA.faceDebug().mouth;
  out.velWidens = { hi: +mouthHi.toFixed(3), lo: +mouthLo.toFixed(3), ok: mouthHi > mouthLo + 0.02 };

  // DRUMMER grimaces on hard hits (mouth opens AT its onset).
  const drum = makeAlien(THREE, traits, drumM, 316);
  const DT = driveTrace(drum, [{ t: 0.0, vel: 1.0 }, { t: 0.375, vel: 0.9 }], 1.0, 300, 1 / 60, 1.5);
  out.drummerGrimaces = Object.values(DT.contactAt).some((v) => v.mouth > 0.35);

  // DANCER mouth bobs with loudness (louder groove -> more mouth movement).
  const dinst = { role: "dancer" };
  function mouthTravel(al, loud) {
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 180; i++) { al.update(1 / 60, { barPhase: (i / 30) % 1, playing: true, level: loud, loudness: loud, notes: [] }); const m = al.faceDebug().mouth; lo = Math.min(lo, m); hi = Math.max(hi, m); }
    return +(hi - lo).toFixed(4);
  }
  out.dancerMouthLoud = mouthTravel(makeAlien(THREE, traits, dinst, 909), 1.0);
  out.dancerMouthQuiet = mouthTravel(makeAlien(THREE, traits, dinst, 909), 0.08);
  out.dancerMouthBobs = out.dancerMouthLoud > out.dancerMouthQuiet + 0.02;

  // ---- D: PERSONALITY — same seed identical, different seeds differ --------------
  const a1 = makeAlien(THREE, traits, leadM, 777);
  const a2 = makeAlien(THREE, traits, leadM, 777);
  const T1 = driveTrace(a1, [{ t: 0.0, vel: 0.8 }, { t: 0.6, vel: 0.5 }], 1.0, 240, 1 / 60, 1.5);
  const T2 = driveTrace(a2, [{ t: 0.0, vel: 0.8 }, { t: 0.6, vel: 0.5 }], 1.0, 240, 1 / 60, 1.5);
  const eqArr = (x, y) => x.length === y.length && x.every((v, k) => Math.abs(v - y[k]) < 1e-9);
  out.sameSeedIdentical = eqArr(T1.gaze, T2.gaze) && eqArr(T1.blink, T2.blink) && eqArr(T1.mouth, T2.mouth);
  const pA = makeAlien(THREE, traits, leadM, 111).faceDebug().personality;
  const pB = makeAlien(THREE, traits, leadM, 222).faceDebug().personality;
  const pC = makeAlien(THREE, traits, leadM, 111).faceDebug().personality;
  out.persA = pA; out.persB = pB;
  out.diffSeedsDiffer = (pA.blinkInterval !== pB.blinkInterval) && (pA.gazePeriod !== pB.gazePeriod);
  out.personalityDeterministic = JSON.stringify(pA) === JSON.stringify(pC);

  // ---- E: PRESERVED — the arm still lands ON the instrument at the onset ---------
  // drive the drummer to its onset phase and read the appendage contact trace.
  const dr2 = makeAlien(THREE, traits, drumM, 316);
  let onReach = 1e9, onContact = 0;
  for (let s = 0; s < 400; s++) {
    const bp = s / 400;
    dr2.update(0.016, { barPhase: bp, playing: true, level: 1, notes: [{ t: 0.0 }, { t: 0.375 }] });
    const d = dr2.debug();
    if (Math.min(Math.abs(bp - 0.375), 1 - Math.abs(bp - 0.375)) < 0.01) { onReach = Math.min(onReach, d.reachDist); onContact = Math.max(onContact, d.contactness); }
  }
  out.armContact = { reach: +onReach.toFixed(4), contact: +onContact.toFixed(3) };
  out.armStillLands = onReach < 0.03 && onContact > 0.82;

  // ---- F: HINGED JAW + DARK CAVITY — the mouth is a real upper+lower jaw pair opening on
  // lip-sync around a RECESSED DARK CAVITY (not a single flat black disc). Drive the lead to
  // a loud onset (open) and to a silent gap (closed) and compare the jaw rig.
  {
    const ja = makeAlien(THREE, traits, leadM, 314);
    ja.update(0.016, { barPhase: 0.0, playing: true, level: 1, loudness: 1, notes: [{ t: 0.0, vel: 1.0 }] });
    const open = ja.faceDebug().mouthRig;
    ja.update(0.016, { barPhase: 0.3, playing: true, level: 1, loudness: 1, notes: [{ t: 0.0, vel: 1.0 }] });   // between onsets -> shut
    const shut = ja.faceDebug().mouthRig;
    const cx = new THREE.Color("#" + (open.cavityHex || "000000"));
    const cavLum = 0.2126 * cx.r + 0.7152 * cx.g + 0.0722 * cx.b;
    out.jaw = {
      hasUpper: open.hasUpper, hasLower: open.hasLower, hasCavity: open.hasCavity,
      cavityRecessed: open.cavityRecessed, cavityLum: +cavLum.toFixed(3),
      openAtOnset: open.open, openAtRest: shut.open,
      lowerRotOpen: open.lowerRotX, lowerRotShut: shut.lowerRotX,
      upperRotOpen: open.upperRotX, upperRotShut: shut.upperRotX,
      jawDropOpen: open.jawDropY, jawDropShut: shut.jawDropY,
    };
    out.jawIsHingedPair = open.hasUpper && open.hasLower;
    out.jawHasDarkCavity = open.hasCavity && open.cavityRecessed && cavLum < 0.12;
    out.jawOpensOnLipSync = (open.open > shut.open + 0.2)
      && (Math.abs(open.lowerRotX) > Math.abs(shut.lowerRotX) + 0.05)
      && (Math.abs(open.upperRotX) > Math.abs(shut.upperRotX) + 0.02);
  }

  // ---- H: BIG CUTE EYES — a bright WHITE sclera + coloured IRIS + DARK PUPIL + bright
  // CATCHLIGHT, sized LARGE relative to the head, on the camera-facing (+Z) side. Sample the
  // three built members (lead/bass/drum) so the read holds across face families.
  out.eyeSpec = lead.faceDebug().eyeSpec;
  const eyeSpecs = [lead, bass, drum].map((a) => a.faceDebug().eyeSpec);
  out.eyeSpecs = eyeSpecs.map((s) => ({ eyeToHead: s.eyeToHead, scleraLum: s.scleraLum, pupilLum: s.pupilLum, catchLum: s.catchLum, avgEyeZ: s.avgEyeZ }));
  out.eyesBig = eyeSpecs.every((s) => s && s.eyeToHead >= 0.18);
  out.eyesWhiteScleraDarkPupil = eyeSpecs.every((s) => s && s.scleraLum > 0.6 && s.pupilLum != null && s.pupilLum < 0.12);
  out.eyesHaveCatchlight = eyeSpecs.every((s) => s && s.hasCatchlight && s.catchLum != null && s.catchLum > 0.9 && s.hasIris);
  out.eyesCamFacing = eyeSpecs.every((s) => s && s.camFacing && s.avgEyeZ > 0);

  // ---- I: FACE ON THE BODY'S FRONT-OUTER SURFACE (the "buried apple" fix) ---------
  // On the DOMINANT body plans — the big APPLE/superquadric hub (radial) and the round
  // marching-cubes blob core — the face used to be a tiny head BURIED inside the mass, so
  // the alien rendered as a smooth featureless apple. Force those plans (with a FAT body so
  // the core dwarfs the little head, the exact regression) and prove the eyes now sit PROUD
  // of the body surface (eye centre Z > body front-surface Z), CAMERA-FACING (+Z), still
  // BIG, and still sclera+pupil+catchlight. Sweep every plan so the law holds catalog-wide.
  const PLANS = ["radial", "blob", "cephalopod", "insectoid", "stalk", "crystalline", "gas"];
  out.placement = {};
  for (const plan of PLANS) {
    const tr = { ...traits, body: { ...(traits.body || {}), plan, massH: 2.2, height: 1.7 } };
    const al = makeAlien(THREE, tr, leadM, 314);
    al.update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0 }] });
    const fp = al.facePlacement(), es = al.faceDebug().eyeSpec;
    out.placement[plan] = {
      allProud: fp.allProud, allCamFacing: fp.allCamFacing, minProud: fp.minProud,
      headZ: fp.headZ, eyeCount: fp.eyes.length,
      eyeToHead: es && es.eyeToHead, scleraLum: es && es.scleraLum, pupilLum: es && es.pupilLum,
      catchLum: es && es.catchLum, hasCatchlight: es && es.hasCatchlight, hasIris: es && es.hasIris,
      cavityOutside: fp.cavity ? fp.cavity.outside : null,
    };
  }
  // the APPLE/superquadric hub (radial) + the round marching-cubes blob are the plans the
  // bug reported as featureless — call them out explicitly, plus require ALL plans to pass.
  const P = out.placement;
  out.applePlansFaceOutside = P.radial.allProud && P.radial.allCamFacing && P.blob.allProud && P.blob.allCamFacing;
  out.everyPlanFaceOutside = PLANS.every((p) => P[p].allProud && P[p].allCamFacing);
  out.everyPlanEyesBig = PLANS.every((p) => P[p].eyeToHead >= 0.18);
  out.everyPlanEyeParts = PLANS.every((p) => P[p].scleraLum > 0.6 && P[p].pupilLum < 0.12 && P[p].hasCatchlight && P[p].catchLum > 0.9 && P[p].hasIris);
  out.appleMinProud = Math.min(P.radial.minProud, P.blob.minProud);

  return out;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
  const perr = [];
  page.on("pageerror", (e) => perr.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") perr.push("console:" + m.text()); });
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 20000 });
  await page.waitForTimeout(300);

  let R;
  try { R = await page.evaluate(inPage); }
  catch (e) { console.error("in-page eval threw:", e); await browser.close(); srv.close(); process.exit(1); }

  console.log("\n  RESULT:", JSON.stringify(R, null, 2), "\n");

  ok(R.rig.eyes >= 1 && R.rig.brows >= 1 && R.rig.hasLids, `A1. FACE RIG exists (eyes=${R.rig.eyes}, brows=${R.rig.brows}, eyelids=${R.rig.hasLids})`);
  ok(R.contig.components === 1, `A2. face rig CONTIGUOUS with the head — ONE connected cluster (${JSON.stringify(R.contig)})`);

  ok(R.pupilsMove, `B1. EYES LIVE — pupils DART/track a wandering gaze (gazeRange=${R.eyes.gazeRange}, pupilRange=${R.eyes.pupilRange})`);
  ok(R.blinkOccurs, `B2. eyelids BLINK — closedness peaks then reopens (max=${R.eyes.blinkMax}, min=${R.eyes.blinkMin})`);

  ok(R.leadLipSyncs, `C1. LEAD vocalist LIP-SYNCS — mouth opens at every onset (${JSON.stringify(R.leadMouthAtOnsets)} all > 0.5)`);
  ok(R.bassStaysClosed, `C2. BASS mouth stays ~closed (max=${R.bassMouthMax} < 0.3)`);
  ok(R.lipSyncGap, `C3. lead mouth >> bass mouth (lead ${R.leadMouthMax} > bass ${R.bassMouthMax} + 0.3)`);
  ok(R.velWidens.ok, `C4. higher VELOCITY opens the mouth WIDER (hiVel=${R.velWidens.hi} > loVel=${R.velWidens.lo})`);
  ok(R.drummerGrimaces, "C5. DRUMMER grimaces (mouth opens) on hard hits");
  ok(R.dancerMouthBobs, `C6. DANCER mouth bobs with loudness (loud=${R.dancerMouthLoud} > quiet=${R.dancerMouthQuiet})`);

  ok(R.sameSeedIdentical, "D1. DETERMINISTIC — two same-seed faces are byte-identical (gaze/blink/mouth trace)");
  ok(R.diffSeedsDiffer, `D2. INDIVIDUALS — different seeds differ in gaze rhythm + blink rate (A blink=${R.persA.blinkInterval}/gaze=${R.persA.gazePeriod} vs B blink=${R.persB.blinkInterval}/gaze=${R.persB.gazePeriod})`);
  ok(R.personalityDeterministic, "D3. personality is deterministic per seed");

  ok(R.armStillLands, `E1. PRESERVED — the arm still CONTACTS the instrument at the onset (reach=${R.armContact.reach}, contact=${R.armContact.contact})`);

  ok(R.jawIsHingedPair, `F1. MOUTH is a HINGED upper+lower JAW pair (${JSON.stringify(R.jaw)})`);
  ok(R.jawHasDarkCavity, `F2. the mouth opening is a RECESSED DARK CAVITY, not a flat black disc (recessed=${R.jaw.cavityRecessed}, cavityLum=${R.jaw.cavityLum})`);
  ok(R.jawOpensOnLipSync, `F3. the jaw OPENS on lip-sync — both jaws rotate + the mouth gapes at the onset vs between (open=${R.jaw.openAtOnset} vs shut=${R.jaw.openAtRest})`);

  ok(R.eyesBig, `H1. BIG eyes — sized LARGE vs the head (eyeToHead across members ${JSON.stringify(R.eyeSpecs.map((s) => s.eyeToHead))} all >= 0.18)`);
  ok(R.eyesWhiteScleraDarkPupil, `H2. WHITE sclera + DARK pupil (sclera lum ${JSON.stringify(R.eyeSpecs.map((s) => s.scleraLum))} > 0.6, pupil lum ${JSON.stringify(R.eyeSpecs.map((s) => s.pupilLum))} < 0.12)`);
  ok(R.eyesHaveCatchlight, `H3. bright CATCHLIGHT + coloured IRIS present on every eye (catch lum ${JSON.stringify(R.eyeSpecs.map((s) => s.catchLum))} > 0.9)`);
  ok(R.eyesCamFacing, `H4. eyes are CAMERA-FACING (front/+Z side of the head; avgEyeZ ${JSON.stringify(R.eyeSpecs.map((s) => s.avgEyeZ))} > 0)`);

  ok(R.applePlansFaceOutside, `I1. APPLE/superquadric hub (radial) + round marching-cubes BLOB carry the face on the FRONT-OUTER surface — eyes PROUD + camera-facing, not buried (radial ${JSON.stringify({ proud: R.placement.radial.allProud, cam: R.placement.radial.allCamFacing, minProud: R.placement.radial.minProud })}, blob ${JSON.stringify({ proud: R.placement.blob.allProud, cam: R.placement.blob.allCamFacing, minProud: R.placement.blob.minProud })})`);
  ok(R.everyPlanFaceOutside, `I2. EVERY body plan seats the face OUTSIDE the body surface + camera-facing (${JSON.stringify(Object.fromEntries(Object.entries(R.placement).map(([k, v]) => [k, { proud: v.allProud, cam: v.allCamFacing, min: v.minProud }])))})`);
  ok(R.appleMinProud > 0.02, `I3. eye centres sit clearly PROUD of the body (apple/blob minProud=${R.appleMinProud} > 0.02, i.e. eye centre Z > body front-surface Z)`);
  ok(R.everyPlanEyesBig, `I4. eyes stay BIG on every plan (eyeToHead ${JSON.stringify(Object.fromEntries(Object.entries(R.placement).map(([k, v]) => [k, v.eyeToHead])))} all >= 0.18)`);
  ok(R.everyPlanEyeParts, "I5. sclera+iris+dark-pupil+catchlight present on the surface-seated face for every plan");

  ok(perr.length === 0, "G1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close(); srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

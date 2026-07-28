// probes.js — THE HEADLESS DEBUG SURFACE: everything hung off window.__STARCRUISE.
//
// makeProbes(deps) builds the object the controller publishes on the window; it is a
// pure FORMATTING layer over handles the controller hands it plus the read-only
// getters ./scene.js, ./camera.js and ./bridge.js already expose. Nothing in here
// changes state except the four deliberate TEST INJECTIONS (__injectTravel /
// __injectBeat / __injectFill and the stepping helpers), which are null/no-ops in
// production — the gates in test/starcruise/*.test.js are the only callers.
//
// It is separated out for one reason: the probes read EVERY part of the cruise, so
// keeping them beside the code they inspect would smear the debug surface across all
// four modules. Here the whole contract the gates depend on is one readable list.
//
// CONTRACT
//   makeProbes(deps) -> the window.__STARCRUISE object (see the controller's tail)

import * as Scene from "./scene.js";
import * as Cam from "./camera.js";
import * as Bridge from "./bridge.js";

export function makeProbes(deps) {
  const {
    start, stop, toggle, update, isRunning,
    three, renderer, scene, camera, ps1, lowResTarget, lowRes, canvas, loaded, state,
    vhsEl, hudEl, step, stepNoRender, pauseLoop, resumeLoop,
  } = deps;

  // sampleLowRes() — read back the low-res target's pixels (works under headless
  // WebGL regardless of preserveDrawingBuffer, unlike canvas.toDataURL). Returns a
  // flat RGBA Uint8Array + a quick "is it non-blank / not all one colour" summary.
  // Headless-proof hook; harmless in production (only called by the test).
  function sampleLowRes() {
    const r = renderer(), tgt = lowResTarget();
    if (!isRunning() || !r || !tgt) return null;
    update(0);   // ensure a fresh render into the target
    const { w, h } = lowRes(), buf = new Uint8Array(w * h * 4);
    try { r.readRenderTargetPixels(tgt, 0, 0, w, h, buf); } catch (e) { return { error: String(e) }; }
    // summarize: count distinct-ish colours + max channel spread.
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, nonBg = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const r2 = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (r2 < minR) minR = r2; if (r2 > maxR) maxR = r2;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
      if (r2 > 20 || g > 20 || b > 30) nonBg++;   // brighter than the ~#0a0410 clear
    }
    const spread = Math.max(maxR - minR, maxG - minG, maxB - minB);
    return { w, h, pixels: buf.length / 4, spread, nonBg, blank: spread < 8, allOneColor: spread === 0 };
  }

  // frameSignature(gx,gy) — render the current frame and reduce it to a coarse gx*gy
  // grid of average luminance (0..1). A CONTINUITY probe: the L1 distance between two
  // consecutive frame signatures is a cheap "how much did the picture change" scalar,
  // so a SCENE SWAP / teleport (a whole-frame content jump) shows a large signature
  // delta while a smooth cruise/descent stays bounded. Headless-proof; only the test
  // calls it (it forces a render), harmless + unused in production.
  function frameSignature(gx, gy) {
    const r = renderer(), tgt = lowResTarget();
    if (!isRunning() || !r || !tgt) return null;
    gx = gx || 24; gy = gy || 18;
    update(0);   // ensure a fresh render into the low-res target
    const { w, h } = lowRes(), buf = new Uint8Array(w * h * 4);
    try { r.readRenderTargetPixels(tgt, 0, 0, w, h, buf); } catch (e) { return { error: String(e) }; }
    const sig = new Float32Array(gx * gy);
    const cnt = new Uint32Array(gx * gy);
    for (let y = 0; y < h; y++) {
      const cy = Math.min(gy - 1, (y * gy / h) | 0);
      for (let x = 0; x < w; x++) {
        const cx = Math.min(gx - 1, (x * gx / w) | 0);
        const i = (y * w + x) * 4;
        // Rec.601 luma, normalized 0..1
        const lum = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
        const ci = cy * gx + cx; sig[ci] += lum; cnt[ci]++;
      }
    }
    for (let i = 0; i < sig.length; i++) if (cnt[i]) sig[i] /= cnt[i];
    return { gx, gy, sig: Array.from(sig, (v) => +v.toFixed(4)) };
  }

  // debug / headless-probe hook (mirrors window.__X).
  return { start, stop, toggle, update, isRunning, getTravel: Bridge.getTravel, getBeat: Bridge.getBeat, running: false,
    canvas, band: Scene.getBand, loaded, sampleLowRes, frameSignature,
    hasThree: () => { const T = three(); return !!(T && T.WebGLRenderer); },
    // exit affordance + resolution probes (headless-proof; harmless in production).
    // no ✕ EXIT button any more — the star-cruise is a VIEW (left via the ✦ chip). These
    // probes stay for the run-test: hasExit is false; "clickExit" now just stops the mode.
    hasExit: () => false,
    hasVHS: () => { const el = vhsEl(); return !!(el && el.parentNode); },
    clickExit: () => { stop(); return !isRunning(); },
    lowRes,
    orbit: () => ({ yaw: Cam.orbit.yaw, pitch: Cam.orbit.pitch, dist: Cam.orbit.dist, fov: Cam.orbit.fov,
      target: Cam.orbit.target ? { x: Cam.orbit.target.x, y: Cam.orbit.target.y, z: Cam.orbit.target.z } : null }),
    // camera pose probe — proves drag actually MOVES the view + the landed framing.
    cam: () => { const c = camera(); return (c ? { x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov,
      tx: Scene.bandCentroid.x, ty: Scene.bandCentroid.y, tz: Scene.bandCentroid.z } : null); },
    centroid: () => ({ x: Scene.bandCentroid.x, y: Scene.bandCentroid.y, z: Scene.bandCentroid.z }),
    // transit FREE-LOOK probes: the current look-offset + the camera's world forward
    // direction (proves a drag in transit turns the view without moving the flight path).
    transitLook: () => ({ yaw: +Cam.transitLook.yaw.toFixed(4), pitch: +Cam.transitLook.pitch.toFixed(4) }),
    camDir: () => { const c = camera(); if (!c) return null; const v = new (three()).Vector3(); c.getWorldDirection(v); return { x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) }; },
    // dispatch a synthetic drag on the canvas (headless nav proof).
    __drag: (dx, dy) => Cam.drag(dx, dy),
    // ---- FIDELITY-CAMERA + STAR-MAP + MUSIC-VIDEO probes (headless-proof) -------------
    // fidelity(): the dominant-weight -> zoom signal driving the camera (higher weight ->
    // closer/landed; low -> up in space with the viewport visible).
    fidelity: () => {
      const lastState = state();
      if (!lastState) return null;
      const cp = lastState.cameraPose;
      const c = camera();
      // the flight's INTENDED zoom (pose position -> look target) — monotonic with the
      // dominant weight, independent of the auto-cam's roaming shots.
      const poseDist = cp ? Math.hypot(cp.position.x - cp.lookAt.x, cp.position.y - cp.lookAt.y, cp.position.z - cp.lookAt.z) : null;
      return {
        dominantWeight: lastState.dominantWeight, imm: lastState.imm, landed: lastState.landed,
        landProgress: lastState.landProgress, spaceProgress: lastState.spaceProgress,
        viewportFade: lastState.viewportFade, fullZoom: lastState.fullZoom, phase: lastState.phase,
        camDist: poseDist, camY: c ? c.position.y : null,
      };
    },
    // planetField(): proof the star-map planets sit AT their GENRE_COORDS. Returns the
    // count + a few genres' marker world-positions vs the flight projection of their coord.
    planetField: (genres) => {
      const pf = Scene.getPlanetField();
      if (!pf) return null;
      const list = (genres && genres.length ? genres : Object.keys(Scene.getPlanetIndex()).slice(0, 4));
      const checks = list.map((g) => {
        const w = Scene.planetWorldOf(g);
        return { g, marker: w ? { x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) } : null };
      });
      return { count: pf.count, field: Scene.getFIELD(), checks };
    },
    // autoCam(): the music-video camera state (active when landed + no recent input;
    // shot index advances on beat cuts; userActive = manual override in effect).
    autoCam: () => ({ active: Cam.autoCam.active, shot: Cam.autoCam.shot, shots: Cam.autoShots().length,
      cuts: Cam.autoCam.cuts, userActive: Cam.userActive(),
      onDrummer: !!Cam.autoCam.onDrummer, drummerShot: Cam.autoCam.drummerShot,
      kind: Cam.autoShots()[Cam.autoCam.shot] ? Cam.autoShots()[Cam.autoCam.shot].kind : null }),
    // autoShotList(): the built cinematic shots with each shot's RESOLVED camera eye height
    // (target.y + clamped-dist*sin(pitch)) — proves NO shot frames the band from below the
    // eye level (Fix 3). camY is the raw eye height; clampedY applies the ground floor clamp.
    autoShotList: () => Cam.autoShots().map((s) => {
      const d = Math.max(Cam.orbit.minDist, Math.min(Cam.orbit.maxDist, s.dist));
      const camY = s.target.y + d * Math.sin(s.pitch);
      return { kind: s.kind, pitch: +s.pitch.toFixed(3), dist: +d.toFixed(2),
        targetY: +s.target.y.toFixed(2), camY: +camY.toFixed(3),
        clampedY: +Math.max(Cam.FLOOR_Y, camY).toFixed(3) };
    }),
    // bandPositions(): each spawned alien's staging position (proves the SPREAD).
    bandPositions: () => Scene.getBand().map((a) => { const g = a.stage || a.group;
      return { voice: a._voice, x: +g.position.x.toFixed(2), y: +g.position.y.toFixed(2), z: +g.position.z.toFixed(2) }; }),
    // ---- GALAXY (SUNS) + HUD + FILL probes (headless-proof; harmless in production) ----
    // suns(): the colored cluster SUNS — count + each sun's marker world-pos/color/label,
    // to prove they sit AT their cluster.star projection with the cluster's color.
    suns: (n) => {
      const sf = Scene.getSunField(), si = Scene.getSunIndex();
      if (!sf || !si) return null;
      const list = si.slice(0, n || 6).map((w, i) => ({
        id: w.id, label: w.label, color: w.color,
        marker: { x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) } }));
      return { count: sf.count, field: Scene.getFIELD(), suns: list };
    },
    // sunGlow(): proves the suns render as EMISSIVE glowing STARS — a self-lit core
    // (toneMapped:false == drawn at full brightness, not shaded down) PLUS an additive
    // corona/halo shell. Used by the galaxy-spread probe to assert "suns are emissive".
    sunGlow: () => {
      const sf = Scene.getSunField(), gf = Scene.getSunGlowField(), sbr = Scene.getSunBaseR();
      if (!sf) return null;
      const cm = sf.material, gm = gf && gf.material;
      return {
        cores: sf.count,
        coreToneMapped: !!cm.toneMapped,        // false => self-lit at full brightness (glowing star)
        glowMesh: !!gf,
        glows: gf ? gf.count : 0,
        glowAdditive: !!(gm && gm.blending === three().AdditiveBlending),
        glowTransparent: !!(gm && gm.transparent),
        coreR: sbr ? Array.from(sbr).slice(0, 6).map((r) => +r.toFixed(2)) : null,
      };
    },
    // hud(): the 2D cockpit HUD — mounted? + its current label/genre text (proves the
    // 3D cockpit was replaced by a DOM label overlay).
    hud: () => { const el = hudEl(); return (el ? { mounted: true,
      sys: (el.querySelector("#sc-hud-sys") || {}).textContent,
      label: (el.querySelector("#sc-hud-label") || {}).textContent,
      genre: (el.querySelector("#sc-hud-genre") || {}).textContent } : { mounted: false }); },
    // shipMeshCount(): how many DRAWN meshes the (now-empty) ship + cockpit groups hold —
    // proves the obstructing 3D ship/cockpit shell is GONE (should be 0).
    shipMeshCount: () => {
      let n = 0;
      const scan = (g) => g && g.group && g.group.traverse((o) => { if (o.isMesh) n++; });
      scan(Scene.getShip()); scan(Scene.getCockpit());
      return n;
    },
    // fill()/__injectFill(): the per-bar drum-FILL flag the auto-camera cuts to the drummer
    // on. __injectFill(bool|null) forces it for the headless drummer-cam proof (null=real).
    fill: () => { const plan = Bridge.getPlan();
      return { now: Bridge.currentFill(), fillBars: plan ? plan.fillBars : null, curBar: Bridge.curBar() }; },
    __injectFill: (b) => { Bridge.injectFill(b); },
    // dancers + cockpit/space + shadow probes (headless-proof; harmless in production).
    dancers: () => Scene.getDancers().length,
    space: () => { const lastState = state(), pl = Scene.getPlanet();
      return { hasCockpit: !!Scene.getCockpit(), hasPlanet: !!pl,
        spaceProgress: lastState ? lastState.spaceProgress : null,
        genres: Bridge.genreLabels().slice(0, 6), planetY: pl ? pl.group.position.y : null }; },
    shadows: () => { const r = renderer(), sun = Scene.getSun();
      return { enabled: !!(r && r.shadowMap && r.shadowMap.enabled),
        type: r && r.shadowMap ? r.shadowMap.type : null,
        sunCast: !!(sun && sun.castShadow), mapSize: sun ? sun.shadow.mapSize.x : null,
        bandCasters: Scene.countCasters() }; },
    // __step(dt): advance one frame and return the flight state (phase probe).
    __step: step,
    // __stepNoRender(dt): advance ALL logic (flight, auto-cam, band, spawn/despawn) but
    // SKIP the GL render — for long headless probe runs that only read state/camera/orbit
    // (fidelity, music-video, re-lands), so they don't accumulate SwiftShader GPU load.
    __stepNoRender: stepNoRender,
    // __pauseLoop/__resumeLoop: headless-only — stop the RAF render loop so scripted
    // __step()s are the SOLE renderer (halves GL load + makes long probe runs deterministic
    // under headless SwiftShader). Harmless in production; only the test calls it.
    __pauseLoop: pauseLoop,
    __resumeLoop: resumeLoop,
    state,
    // ---- SCORE-BRIDGE probes (headless-proof; harmless in production) ----------------
    // eventPlan(): a summary of the cached per-bar note plan + how many times
    // buildEvents ran (proves it is built PER GENRE, never per frame).
    eventPlan: () => { const plan = Bridge.getPlan(); return (plan ? {
      numBars: plan.numBars, cbeats: plan.cbeats, bpm: plan.bpm,
      buildCount: Bridge.buildCount(), curBar: Bridge.curBar(),
      // per-voice: total onsets across the whole plan + how many bars each voice sounds in.
      voices: (() => {
        const agg = {};
        plan.bars.forEach((bar) => { for (const v in bar) {
          agg[v] = agg[v] || { onsets: 0, barsPlaying: 0 };
          agg[v].onsets += bar[v].notes.length; if (bar[v].playing) agg[v].barsPlaying++;
        } });
        return agg;
      })(),
    } : null); },
    buildCount: Bridge.buildCount,
    // bandVoices(): the engine voice id each spawned alien is in charge of.
    bandVoices: () => Scene.getBand().map((a) => a._voice || null),
    // voiceCtx(voice): the LAST ctx the bridge passed that voice this frame
    // ({barPhase, playing, level, notes:count}) — proves real per-voice notes flow.
    voiceCtx: (v) => Bridge.lastCtx(v),
    // barAt(barIdx, voice): the raw note list a voice plays in a given bar (onset t,
    // pitch, dur, vel) — proves the bucketing produced ACTUAL onsets, not beat ticks.
    barAt: (barIdx, voice) => {
      const plan = Bridge.getPlan();
      if (!plan) return null;
      const bi = ((barIdx | 0) % plan.numBars + plan.numBars) % plan.numBars;
      const slot = plan.bars[bi] && plan.bars[bi][voice];
      return slot ? { playing: slot.playing, level: +slot.level.toFixed(3), notes: slot.notes.slice(0, 12) } : { playing: false, level: 0, notes: [] };
    },
    // ---- headless-probe: scene inspection + deterministic travel/beat injection ----
    hasBackdrop: () => !!Scene.getBackdrop(),
    // hasGround(): is the procedural PLANET ground present under the band? + a couple of
    // planted heights (proves the band sits ON real terrain, not a flat stage that popped in).
    hasGround: () => !!Scene.getGroundPlanet(),
    ground: () => { const gp = Scene.getGroundPlanet();
      return (gp ? { radius: +Scene.getGroundRadius().toFixed(2), h0: +Scene.getGroundH0().toFixed(3),
        y00: +Scene.groundYAt(0, 0).toFixed(3), yEdge: +Scene.groundYAt(9, 0).toFixed(3),
        smallWorld: Scene.getSmallWorldGround(), terrain: gp.userData && gp.userData.terrainType,
        posY: +gp.position.y.toFixed(2) } : null); },
    // ---- LITTLE-PRINCE (small-world landing) probes (headless-proof; harmless in production) ----
    // smallWorld(): is the landed ground a SMALL curved world? + its radius/terrain/offset. The
    // curvatureDrop across a band half-span proves the horizon visibly bends away.
    smallWorld: () => {
      const gp = Scene.getGroundPlanet();
      if (!gp) return null;
      const radius = Scene.getGroundRadius();
      let drop = 0;
      try { drop = Scene.groundYAt(0, 0) - Scene.groundYAt(Math.min(radius * 0.4, 9), 0); } catch (e) {}
      return { small: Scene.getSmallWorldGround(), radius: +radius.toFixed(2),
        terrain: gp.userData && gp.userData.terrainType,
        offsetY: +gp.position.y.toFixed(2), curveDrop: +drop.toFixed(3) };
    },
    // bandOnSurface(): each band member's distance from the planet CENTRE (≈ the surface radius,
    // proving they sit ON the curved terrain) and how closely its local +Y aligns to the outward
    // surface normal (≈ 1 => standing UPRIGHT on the little world, oriented to the normal).
    bandOnSurface: () => {
      const gp = Scene.getGroundPlanet(), band = Scene.getBand(), T = three();
      if (!gp || !band.length) return null;
      const c = new T.Vector3(0, gp.position.y, 0);   // planet centre in world space
      const YA = new T.Vector3(0, 1, 0), up = new T.Vector3(), P = new T.Vector3();
      return band.map((a) => {
        const g = a.stage || a.group;
        P.copy(g.position);
        up.copy(YA).applyQuaternion(g.quaternion);
        const nrm = P.clone().sub(c); const r = nrm.length(); nrm.normalize();
        return { voice: a._voice, r: +r.toFixed(2), upDotN: +up.dot(nrm).toFixed(3),
          y: +P.y.toFixed(2) };
      });
    },
    // backdropOnSurface(): sample the city/landscape INSTANCES' world positions and report how
    // many sit ON the planet's sphere (distance-from-centre ≈ the surface radius) — proves the
    // city WRAPPED the curved surface rather than composing flat.
    backdropOnSurface: () => {
      const gp = Scene.getGroundPlanet(), bd = Scene.getBackdrop(), T = three();
      if (!gp || !bd || !bd.group) return null;
      const groundRadius = Scene.getGroundRadius();
      const c = new T.Vector3(0, gp.position.y, 0);
      const M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
      bd.group.updateMatrixWorld(true);
      let cnt = 0, onSphere = 0, minR = 1e9, maxR = 0;
      bd.group.traverse((o) => {
        if (!o.isInstancedMesh) return;
        if (o.name === "orbs" || o.name === "beacons") return;   // point-lights; radius irrelevant
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M); M.premultiply(o.matrixWorld); M.decompose(P, Q, S);
          const r = P.distanceTo(c);
          cnt++; if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (r > groundRadius - 5) onSphere++;
        }
      });
      return { curved: !!(bd.group.userData && bd.group.userData.scOnSurface),
        count: cnt, onSphere, minR: +minR.toFixed(2), maxR: +maxR.toFixed(2), radius: +groundRadius.toFixed(2) };
    },
    // bg(): the scene background + renderer clear colour hex — proves SPACE IS TRUE BLACK.
    bg: () => { const sc = scene(), r = renderer();
      return {
        scene: sc && sc.background && sc.background.isColor ? sc.background.getHex() : null,
        clear: r ? r.getClearColor(new (three()).Color()).getHex() : null,
      }; },
    hasShip: () => !!Scene.getShip(),
    hasCockpit: () => !!Scene.getCockpit(),
    hasPlanet: () => !!Scene.getPlanet(),
    sceneChildren: () => { const sc = scene(); return (sc ? sc.children.length : 0); },
    traits: Scene.getCurTraits,
    // renderStyle probes: the active genre's derived style + the LIVE post-fx uniforms
    // it pushed into the PS1 pass (proves the pass changes by genre + updates on land).
    renderStyle: Scene.getCurRenderStyle,
    postStyle: () => { const p = ps1(); return (p && p.getStyle ? p.getStyle() : null); },
    // __injectTravel/__injectBeat(obj|null): OVERRIDE the real hooks with a scripted
    // stream so the probe can force a clean FLY->APPROACH->LAND cycle and park the
    // beatPhase exactly on a hit. Pass null to restore the real app hooks. Null in
    // production — this only fires when the probe sets it.
    __injectTravel: (o) => { Bridge.injectTravel(o); },
    __injectBeat: (o) => { Bridge.injectBeat(o); },
    // __beatProbe(beatPhase): drive EVERY alien to a given beatPhase (0..1) and read
    // back each playing hand's distance to its instrument contact. dist~0 == the hand
    // is ON the contact (a hit). Used to prove hits land ON the beat and the whole
    // band shares one phase.
    __beatProbe: (beatPhase) => Scene.getBand().map((a) => {
      if (a.update) a.update(0, beatPhase);
      const d = a.debug ? a.debug() : null;
      return d ? { role: (d && d.playStyle) || "?", playStyle: d.playStyle, hitsPerBeat: d.hitsPerBeat, dist: d.dist } : null;
    }) };
}

#!/usr/bin/env node
// explorer-ui-test.js — headless UI gate for three explorer product laws:
//   1. DEFAULT 3-STEP CLOSED LOOP (a triangle), waypoint 1 always at the map
//      centre (the two outer stars stay deterministic).
//   2. Genres laid out DYNAMICALLY at load (computeGenreLayout, deterministic) —
//      every K.GENRES genre placed, no two stars within a comfortable on-screen
//      distance AND no two NAME LABELS overlap at the default zoom; zoomable.
//   3. the DEMOSCENE background is ALWAYS ON as ambient wallpaper (there is no
//      ▢/▦ chip; ?bg=off is the escape hatch).
// Drives explorer.html headless and asserts (all must PASS):
//   A. exactly 3 default waypoints on a fresh load;
//   B. waypoint[0] sits at the computed map centre (within ~1 logical px);
//   C. the path is a CLOSED loop — pathClosed() true, the drawn constellation
//      polyline repeats point 1 (n+1 points), and travelStep() wraps seg
//      0→1→2→0 seamlessly, the traveller returning to waypoint[0];
//   D. min pairwise star distance in SCREEN space (default zoom) exceeds the
//      comfort threshold;
//   D2. every K.GENRES genre has a computed position AND no two DRAWN genre NAME
//      LABELS overlap at the default zoom (the real SVG text rects — drawMap culls
//      names by level-of-detail, since 274 labels cannot fit a viewport; active
//      genres are never culled); fugue lands near prelude;
//   E. zoom in (k up to 4) and back to fit; k stays in range, k===1 recentres;
//   F. DemoLayer up on load with NO interaction (mode 2, enabled);
//   G. no console/page errors on load, nor after starting playback (a short
//      live ride: engine boots, real audio comes out, then STOP).
//   H. the demoscene wallpaper: on at boot, cart rotates on the musical clock
//      + the wall-clock backstop, #bgChip is GONE, ?bg=off boots it off.
//   node faust/explorer-ui-test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8799;

const SCREEN_SEP_MIN = 40;   // px between any two stars at DEFAULT zoom (1200x850 viewport); the
                             // computed layout enforces a hard 72px dot floor (computeGenreLayout
                             // MIN_DOT) and the baked POS lands ~47px min, so this is a floor with
                             // real slack — a star under it was placed by LOGICAL distance and
                             // forgot that drawMap compresses Y ~14x (see the world.js nudge note)
const LABELS_DRAWN_MIN = 90; // names actually drawn at the default zoom. 274 labels need ~2.4x the
                             // viewport's area, so drawMap culls by design (LOD); ~120 draw today.
                             // This floor catches "the map went blank", not the culling itself.

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html?bgAltMs=1200`);   // fast idle bg-alt clock for the H test
  await page.waitForFunction(() => window.__X && window.__S && window.__LOOP, { timeout: 20000 });
  await page.waitForTimeout(500);
  const loadErrs = errs.slice();

  // ---- A/B: 3 waypoints, waypoint[0] at the map centre ----
  const seed = await page.evaluate(() => ({
    n: __S.waypoints.length,
    wp0: { x: __S.waypoints[0].x, y: __S.waypoints[0].y },
    center: __X.mapCenter(),
    loop: window.__LOOP,
    world: __X.world(),
    closed: __X.pathClosed(),
  }));
  ok(seed.n === 3, `A: default waypoints = ${seed.n} (want exactly 3 — the default triangle)`);
  const cErr = Math.hypot(seed.wp0.x - seed.center.x, seed.wp0.y - seed.center.y);
  ok(cErr <= 2, `B: waypoint[0] off map centre by ${cErr.toFixed(2)} logical px (want <=2)`);
  console.log(`\n=== SEED ===`);
  console.log(`  waypoints=${seed.n}  loop.genres=[${(seed.loop.genres||[]).join(", ")}]`);
  console.log(`  centre=(${seed.center.x.toFixed(0)},${seed.center.y.toFixed(0)})  wp0=(${seed.wp0.x.toFixed(0)},${seed.wp0.y.toFixed(0)})  offBy=${cErr.toFixed(2)}px`);
  console.log(`  world=${seed.world.w}x${seed.world.h}  loop.closed=${seed.loop.closed}`);

  // ---- C: closed-loop rendering + travelStep wrap ----
  const poly = await page.evaluate(() => {
    const pls = [...document.querySelectorAll("#map polyline")];
    if (!pls.length) return { pts: 0 };
    const pts = pls[0].getAttribute("points").trim().split(/\s+/).length;
    return { pts };
  });
  const nWp = seed.n;
  ok(poly.pts === nWp + 1, `C1: constellation polyline has ${poly.pts} points (want n+1=${nWp + 1} — closing leg drawn)`);
  // drive travelStep deterministically (no audio). CONSTANT PACE:
  // every bar advances the SAME distance (paceSpeed units) along the perimeter,
  // regardless of leg length — so we no longer land on waypoints at fixed step
  // counts. Instead drive one full loop (loopBars) plus a little, and prove the
  // motion is SEAMLESS: it visits every leg, wraps the closing leg back to 0, and
  // never TELEPORTS (the biggest single-step chord stays ≤ the per-bar speed; a
  // discontinuity at the seam would spike it to a map-crossing jump).
  const wrap = await page.evaluate(() => {
    __S.pace = 32;
    const segs = [], n = __S.waypoints.length, v = __X.paceSpeed();
    const loop = __X.loopBars();
    let prev = { x: __S.cursor.x, y: __S.cursor.y }, maxStep = 0;
    for (let i = 0; i < loop + 6; i++) {
      __X.travelStep(); segs.push(__S.travel.seg);
      const c = __S.cursor, d = Math.hypot(c.x - prev.x, c.y - prev.y);
      if (i > 0) maxStep = Math.max(maxStep, d);
      prev = { x: c.x, y: c.y };
    }
    return { segs, n, v, loop, maxStep };
  });
  // seg must visit every leg 0..n-1 and then wrap back to 0 (a decrease event).
  const segSet = new Set(wrap.segs);
  let sawAllLegs = true; for (let s = 0; s < wrap.n; s++) if (!segSet.has(s)) sawAllLegs = false;
  let wrapped = false; for (let i = 1; i < wrap.segs.length; i++) if (wrap.segs[i] < wrap.segs[i - 1]) wrapped = true;
  ok(sawAllLegs, `C2: travelStep visited legs [${[...segSet].sort().join(",")}], want 0..${wrap.n - 1}`);
  ok(wrapped, `C3: seg never wrapped back to 0 (closing leg not seamless)`);
  // seamless = constant speed with no seam teleport: the largest single-bar chord
  // never exceeds the per-bar speed by more than a hair (chord <= arc = v; a jump
  // at the wrap would be orders of magnitude larger).
  ok(wrap.maxStep <= wrap.v * 1.05, `C4: constant pace not seamless — biggest step ${wrap.maxStep.toFixed(2)} px vs speed ${wrap.v.toFixed(2)} px/bar (a seam teleport would spike this)`);
  console.log(`\n=== CLOSED LOOP (constant pace) ===`);
  console.log(`  polylinePoints=${poly.pts} (n+1=${nWp + 1})  loopBars=${wrap.loop}  speed=${wrap.v.toFixed(2)}px/bar  segSequence sample=[${wrap.segs.slice(0, 12).join(",")}…]`);
  console.log(`  visitedAllLegs=${sawAllLegs}  wrappedTo0=${wrapped}  maxStep=${wrap.maxStep.toFixed(2)}px (<= speed => no teleport)`);

  // ---- D: min pairwise SCREEN separation at the DEFAULT zoom (what you see) ----
  // Projected at k = default zoom; overlap/separation is pan-invariant so offsets
  // are ignored. Both axes scale independently (X uses width/WORLD_W, Y height/H).
  const sep = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const W = __X.world().w, H = __X.world().h, P = __X.POS, k = window.__ZOOM.k;
    const gs = Object.keys(P);
    const S = gs.map(g => ({ g, x: (P[g][0] * r.width / W) * k, y: (P[g][1] * r.height / H) * k }));
    let mn = Infinity, pr = "";
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const d = Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y);
      if (d < mn) { mn = d; pr = S[i].g + "/" + S[j].g; }
    }
    return { mn, pr, logical: __X.minPairDist(), count: gs.length, k };
  });
  ok(sep.mn >= SCREEN_SEP_MIN, `D: min pairwise SCREEN distance ${sep.mn.toFixed(1)}px (${sep.pr}) < ${SCREEN_SEP_MIN}px floor`);
  console.log(`\n=== SPREAD (default zoom k=${sep.k}) ===`);
  console.log(`  ${sep.count} stars  minScreenDist=${sep.mn.toFixed(1)}px (${sep.pr})  minLogicalDist=${sep.logical.toFixed(1)}`);

  // ---- D2: EVERY genre present + NO DRAWN NAME LABEL overlaps another ----
  // The core of the dynamic-layout change: genre names must not overlap into
  // unreadability.
  //
  // WHAT THIS MEASURES. D2c must NOT build a
  // hypothetical box for ALL 274 genre IDS and assert none of the 37,401 pairs
  // intersect. That is unsatisfiable BY ARITHMETIC, not by layout: at the default
  // zoom the label font is 28.8px, so 274 name boxes need ~2.4 MILLION px² of a
  // 1,020,000px² viewport. It also measured the wrong strings (the id, e.g.
  // "citypop") where drawMap draws the kernel LABEL, and the wrong set (every
  // genre) where drawMap draws a NAME ONLY IF ITS BOX IS CLEAR — the label
  // level-of-detail pass in starmap.js drawMap, which is the app's deliberate
  // answer to exactly this arithmetic (active genres always get a name, the rest
  // fill greedily; zoom in and more appear). So the old gate reported 27 "overlaps"
  // that no user can see, and could never go green.
  //
  // We now assert the CONTRACT THE APP ACTUALLY MAKES, on the real DOM:
  //   D2c: no two DRAWN labels (#map text.anchor, real client rects) overlap;
  //   D2f: every ACTIVE (weighted) genre gets a drawn name — culling never hides
  //        the genres you are currently hearing;
  //   D2g: the map is still legible — a healthy number of names actually draw
  //        (a bug that culls everything would otherwise pass D2c trivially).
  // Also asserts fugue is present and lands near prelude (its most-similar genre).
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;   // VT323 in: measure what the user reads, not the fallback
    __X.retarget({ x: __S.cursor.x, y: __S.cursor.y });                       // store write -> drawMap redraws with the real font
  });
  await page.waitForTimeout(150);
  const lab = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const P = __X.POS;
    const ALL = Object.keys(GenreKernel.GENRES);
    const missing = ALL.filter(g => !P[g]);
    // the labels the app DREW (text.anchor == a genre name; .wlabel percentages and
    // .region watermarks are other layers), measured as real on-screen rectangles.
    const drawn = [...svg.querySelectorAll("text.anchor")].map(t => {
      const b = t.getBoundingClientRect();
      return { name: t.textContent, l: b.left - r.left, rr: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top };
    });
    let overlaps = 0, worst = "", worstPen = 0;
    for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
      const A = drawn[i], C = drawn[j];
      const ox = Math.min(A.rr, C.rr) - Math.max(A.l, C.l);
      const oy = Math.min(A.b, C.b) - Math.max(A.t, C.t);
      if (ox > 0 && oy > 0) { overlaps++; const pen = Math.min(ox, oy); if (pen > worstPen) { worstPen = pen; worst = A.name + "/" + C.name; } }
    }
    // every ACTIVE genre must carry a drawn name (drawMap gives them a slot first)
    const shown = new Set(drawn.map(d => d.name));
    const glabel = g => (GenreKernel.GENRES[g] && GenreKernel.GENRES[g].label) || g;
    const active = __S.weights.filter(w => w.w > 0.01).map(w => w.g);
    // labels are drawn in the session's ALIEN ALPHABET (app/glyphs.js alienize:
    // 1-2 homoglyph swaps per name, re-rolled each load) — so match on the
    // de-glyphed, case-folded form, never the raw literal.
    const plain = t => (window.__GLYPHS ? window.__GLYPHS.deglyph(t) : t).toLowerCase();
    const shownPlain = new Set([...shown].map(plain));
    const activeUnlabelled = active.filter(g => !shownPlain.has(plain(glabel(g))));
    // fugue nearest-neighbour rank (by dot distance)
    const near = t => Object.keys(P).filter(g => g !== t).map(g => ({ g, d: Math.hypot(P[t][0] - P[g][0], P[t][1] - P[g][1]) }))
      .sort((a, b) => a.d - b.d).slice(0, 4).map(x => x.g);
    return { total: ALL.length, placed: ALL.filter(g => P[g]).length, missing, overlaps, worst, worstPen,
      drawn: drawn.length, active, activeUnlabelled,
      fugue: P.fugue ? near("fugue") : null, afrobeat: P.afrobeat ? near("afrobeat") : null };
  });
  ok(lab.missing.length === 0, `D2a: ${lab.missing.length} K.GENRES genres have NO computed position: ${lab.missing.slice(0, 8).join(", ")}`);
  ok(lab.placed === lab.total, `D2b: placed ${lab.placed}/${lab.total} genres (want all)`);
  ok(lab.overlaps === 0, `D2c: ${lab.overlaps} pairs of DRAWN genre labels overlap at default zoom (worst ${lab.worst} pen ${lab.worstPen.toFixed(1)}px)`);
  ok(lab.activeUnlabelled.length === 0, `D2f: active genres with no drawn name: ${lab.activeUnlabelled.join(", ")} (the LOD pass must never cull what you are hearing)`);
  ok(lab.drawn >= LABELS_DRAWN_MIN, `D2g: only ${lab.drawn} of ${lab.total} names drew at default zoom (want >=${LABELS_DRAWN_MIN} — the map has gone unreadable)`);
  ok(!!lab.fugue, `D2d: fugue has no computed position`);
  ok(lab.fugue && lab.fugue.slice(0, 3).includes("prelude"), `D2e: fugue's 3 nearest are [${(lab.fugue || []).slice(0, 3).join(", ")}] — want prelude among them`);
  console.log(`\n=== LABELS (drawn, no-overlap @ default zoom) ===`);
  console.log(`  genres placed=${lab.placed}/${lab.total}  missing=[${lab.missing.join(", ")}]`);
  console.log(`  names drawn=${lab.drawn}/${lab.total} (the rest are culled by the LOD pass — zoom in to read them)  overlaps=${lab.overlaps}`);
  console.log(`  active=[${lab.active.join(", ")}]  unlabelled=[${lab.activeUnlabelled.join(", ")}]`);
  console.log(`  fugue nearest=[${(lab.fugue || []).join(", ")}]  afrobeat nearest=[${(lab.afrobeat || []).join(", ")}]`);

  // ---- E: zoom reaches in and recentres out ----
  const zoom = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    __X.zoomAround(cx, cy, 4);            // zoom in hard
    const zin = { k: window.__ZOOM.k };
    __X.zoomAround(cx, cy, 1);            // back to fit
    const zout = { k: window.__ZOOM.k, ox: window.__ZOOM.ox, oy: window.__ZOOM.oy };
    return { zin, zout };
  });
  ok(zoom.zin.k > 1 && zoom.zin.k <= 4, `E1: zoom-in clamped to ${zoom.zin.k} (want in (1,4])`);
  ok(zoom.zout.k === 1 && zoom.zout.ox === 0 && zoom.zout.oy === 0, `E2: zoom-out to fit left k=${zoom.zout.k} ox=${zoom.zout.ox} oy=${zoom.zout.oy} (want 1/0/0)`);
  console.log(`\n=== ZOOM ===\n  zoomIn k=${zoom.zin.k}  zoomOut k=${zoom.zout.k} ox=${zoom.zout.ox} oy=${zoom.zout.oy}`);

  // ---- F: demoscene background ALWAYS ON (ambient wallpaper) ----
  // no interaction: the layer must come up on its own (init is async — wait for it)
  await page.waitForFunction(() => window.DemoLayer && DemoLayer.enabled(), { timeout: 15000 }).catch(() => {});
  const bg = await page.evaluate(() => ({
    present: !!window.DemoLayer,
    enabled: window.DemoLayer ? DemoLayer.enabled() : null,
    mode: window.__BGALT ? window.__BGALT.state().mode : null,
  }));
  ok(bg.enabled === true, `F: DemoLayer.enabled() === ${bg.enabled} on load (want true — ambient wallpaper)`);
  ok(bg.mode === 2, `F: background mode ${bg.mode} on load (want 2 = demoscene)`);
  console.log(`\n=== BACKGROUND ===\n  present=${bg.present} enabled=${bg.enabled} mode=${bg.mode}`);

  // ---- F2: the ? chip opens the ABOUT layer (what/how-to-play/provenance) ----
  // ? is a real modal on the shared chip
  // plumbing, holding links to how.html (the pipeline explainer), the GitHub
  // repo, and Aboard. Open it, assert visibility + links, close via Escape.
  const about = await page.evaluate(() => {
    const btn = document.getElementById("helpChip");
    if (!btn) return { btn: false };
    btn.click();
    const wrap = document.getElementById("aboutWrap"), card = document.getElementById("about");
    const open = !!wrap && wrap.classList.contains("open") && getComputedStyle(wrap).display !== "none";
    const hrefs = card ? [...card.querySelectorAll("a")].map(a => a.getAttribute("href")) : [];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const closed = !wrap.classList.contains("open");
    return { btn: true, open, hrefs, closed };
  });
  ok(about.btn, `F2a: no #helpChip (?) button in the DOM`);
  ok(about.open, `F2b: clicking ? did not open the about layer (#aboutWrap.open)`);
  const hasLink = s => (about.hrefs || []).some(h => h && h.includes(s));
  ok(hasLink("how.html"), `F2c: about layer has no link to how.html (links: ${(about.hrefs || []).join(", ")})`);
  // F2d asserts the SOURCE link exists, not a specific owner — the repo has
  // moved owners before and a hardcoded literal outlives the fact
  // (same stale-literal class as GX1 and F2e).
  ok(hasLink("github.com/") && hasLink("/stellate"), `F2d: about layer has no link to the GitHub source repo`);
  // ATTRIBUTION, not a domain: the about layer's credit line names an author
  // and a publisher, and both the names and the domains have changed before.
  // What the gate is for is that the page CREDITS its
  // author/publisher with a live outbound link — assert that, so the next rebrand
  // doesn't strand the gate on a dead literal.
  ok(hasLink("ftrain.com") || hasLink("aboard.com") || hasLink("aboardresearch.com"),
    `F2e: about layer carries no outbound author/publisher credit link (links: ${(about.hrefs || []).join(", ")})`);
  ok(about.closed, `F2f: Escape did not close the about layer`);
  console.log(`\n=== ABOUT (?) ===\n  open=${about.open} closedOnEsc=${about.closed} links=[${(about.hrefs || []).join(", ")}]`);

  // ---- F3: how.html serves (200) and carries the canonical genre count ----
  // (read LIVE from K.GENRES, not a 178 literal — the count grows as genres land,
  // and this gate exists to catch how.html going stale against it)
  const how = await page.evaluate(async () => {
    const r = await fetch("how.html");
    const txt = await r.text();
    const n = Object.keys(GenreKernel.GENRES).length;
    return { status: r.status, n, hasCount: txt.includes(String(n)), bytes: txt.length };
  });
  ok(how.status === 200, `F3a: how.html fetch status ${how.status} (want 200)`);
  ok(how.hasCount, `F3b: how.html does not contain the live genre count "${how.n}"`);
  console.log(`  how.html: status=${how.status} bytes=${how.bytes} hasCount(${how.n})=${how.hasCount}`);

  // ---- G: no console errors on load ----
  ok(loadErrs.length === 0, `G0: ${loadErrs.length} console/page errors on load: ${loadErrs.slice(0, 3).join(" | ")}`);

  // ---- G: start playback briefly — engine boots, real audio, no new errors ----
  // re-seed a clean default loop (travelStep above advanced the traveller) so the
  // ride starts from a sane centre, then LIVE.
  await page.evaluate(() => __X.seedLoop());
  const errsBeforeRide = errs.length;
  await page.evaluate(() => { __S.pace = 8; });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 2, { timeout: 40000 }).catch(() => {});
  // sample RMS for a few bars to confirm real sound (not just a booted graph)
  let maxRms = 0;
  const rideDeadline = Date.now() + 40000;
  while (Date.now() < rideDeadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { bar: __S.barCount, rms: h ? +h.rms() : 0, seg: __S.travel.seg };
    });
    maxRms = Math.max(maxRms, s.rms);
    if (s.bar >= 5 && maxRms > 0.0008) break;
    await page.waitForTimeout(400);
  }
  const engineErrs = await page.evaluate(() => { const h = window.FaustLive && FaustLive.lastHandle; return h ? h.errors.slice() : []; });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);
  // partition ride errors: archive.org found-sound streaming is CORS-blocked in
  // the sandbox (environmental on main for ANY headless ride) — ignore those.
  const isEnv = e => /archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|found/i.test(e);
  const rideErrs = errs.slice(errsBeforeRide);
  const realRide = rideErrs.filter(e => !isEnv(e));
  const envRide = rideErrs.filter(isEnv);
  ok(maxRms > 0.0008, `G1: no real audio during ride (maxRms=${maxRms.toFixed(5)})`);
  ok(realRide.length === 0, `G2: ${realRide.length} real console/page errors after starting playback: ${realRide.slice(0, 3).join(" | ")}`);
  ok(engineErrs.length === 0, `G3: ${engineErrs.length} engine errors during ride`);
  console.log(`\n=== PLAYBACK ===`);
  console.log(`  maxRms=${maxRms.toFixed(5)}  realRideErrors=${realRide.length}  envFoundSoundErrors=${envRide.length}  engineErrors=${engineErrs.length}`);
  if (realRide.length) console.log(`  REAL:\n   ${realRide.slice(0, 20).join("\n   ")}`);

  // ---- H: the demoscene background — ALWAYS ON as ambient wallpaper (the
  // there is no ▢/▦ chip; ?bg=off is the escape hatch, probed in H6).
  // Page loaded with ?bgAltMs=1200 so the idle wall-clock backstop rotates
  // fast. Assert: the layer is up at BOOT with no interaction (mode 2,
  // enabled + DOM visible), DemoLayer.next() cycles the cart, the idle
  // backstop rotates the cart on its own, and #bgChip is GONE from the DOM.
  const alt = await page.evaluate(async () => {
    const startMode = window.__BGALT.state().mode;
    // wait for the layer to materialize (setEnabled pre-ready is recorded by init)
    for (let i = 0; i < 100 && !(window.DemoLayer && DemoLayer.enabled()); i++) await new Promise(r => setTimeout(r, 100));
    const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== "none"; };
    const up = window.DemoLayer && DemoLayer.enabled(), domUp = vis("demolayer");
    const n0 = DemoLayer.currentName && DemoLayer.currentName();
    DemoLayer.next(); const n1 = DemoLayer.currentName && DemoLayer.currentName();
    // idle backstop rotation: sample the cart over the same 6s window the old
    // alternation test used (40 × 150ms)
    const seen = new Set([n1]);
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); seen.add(DemoLayer.currentName()); }
    const chipGone = !document.getElementById("bgChip");
    return { startMode, up, domUp, cartCycles: n0 !== n1, rotations: seen.size - 1, chipGone };
  });
  ok(alt.startMode === 2, `H0: demoscene mode at boot with no interaction (got ${alt.startMode})`);
  ok(alt.up && alt.domUp, `H1: demo layer up at boot (enabled=${alt.up} visible=${alt.domUp})`);
  ok(alt.cartCycles, `H2: DemoLayer.next() changes the cart`);
  ok(alt.rotations >= 1, `H3: idle backstop rotates the cart (fresh carts seen=${alt.rotations})`);
  ok(alt.chipGone, `H5: #bgChip is gone from the DOM (there is no background chip)`);
  console.log(`\n=== BACKGROUND WALLPAPER ===`);
  console.log(`  mode=${alt.startMode} cartCycles=${alt.cartCycles} backstopRotations=${alt.rotations} chipGone=${alt.chipGone}`);

  // H4: the MUSICAL driver counts BEATS, not chord-bar ticks. The period is now
  // 64 BARS = 256 beats, and the
  // incoming cart CROSSFADES IN over the last 8 bars (32 beats) — so the FADE
  // starts at beat 224 (tick 28 at cbeats=8) and the cart only becomes current
  // when the fade completes. We assert the fade START, which is the musical
  // event; promotion is wall-clock and belongs to the demo-layer gate.
  const beat = await page.evaluate(async () => {
    const wasLive = window.__S.live; window.__S.live = true;
    window.__BGALT.flip();                       // reset the beat counter to a known 0
    const st = () => window.__BGALT.state();
    let fadeTick = 0;
    for (let i = 1; i <= 40 && !fadeTick; i++) {
      window.__BGALT.tick({ cbeats: 8 });
      if (st().fading) fadeTick = i;
    }
    window.__S.live = wasLive;
    return { fadeTick, beats: st().beats };
  });
  ok(beat.fadeTick === 28, `H4: the 8-bar crossfade arms at beat 224 of a 64-bar period = tick 28 at cbeats 8 (got tick ${beat.fadeTick})`);

  // I: plain mouse-wheel zooms the map (desktop), no ctrl needed.
  const wheel = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const k0 = window.__ZOOM.k;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -240, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    const kUp = window.__ZOOM.k;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    const kDn = window.__ZOOM.k;
    return { k0, kUp, kDn };
  });
  ok(wheel.kUp > wheel.k0, `I1: wheel up zooms IN (k ${wheel.k0.toFixed(2)}→${wheel.kUp.toFixed(2)})`);
  ok(wheel.kDn < wheel.kUp, `I2: wheel down zooms OUT (k ${wheel.kUp.toFixed(2)}→${wheel.kDn.toFixed(2)})`);
  console.log(`  wheel-zoom: ${wheel.k0.toFixed(2)} →in ${wheel.kUp.toFixed(2)} →out ${wheel.kDn.toFixed(2)}`);

  // ---- H6: ?bg=off is the escape hatch — a FRESH load boots mode 0, layer
  // disabled (goes last: it navigates away from the main probe page).
  await page.goto(`http://localhost:${PORT}/index.html?bg=off`);
  await page.waitForFunction(() => window.__BGALT && window.DemoLayer, { timeout: 20000 });
  await page.waitForTimeout(1200);   // past init — the layer must STAY off
  const off = await page.evaluate(() => ({
    mode: window.__BGALT.state().mode,
    enabled: window.DemoLayer ? DemoLayer.enabled() : null,
  }));
  ok(off.mode === 0 && off.enabled === false, `H6: ?bg=off boots off (mode=${off.mode} enabled=${off.enabled} — want 0/false)`);
  console.log(`  ?bg=off: mode=${off.mode} enabled=${off.enabled}`);

  await browser.close(); srv.close();

  console.log(`\n=== GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  const pass = fails.length === 0;
  console.log(`EXPLORER-UI GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });

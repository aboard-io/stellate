#!/usr/bin/env node
// test/browser/daw-rack.test.js — THE /daw RACK GATE (docs/DAW.md stage 2).
//
// The rack's whole promise is that each row shows what THAT machine writes, and
// that touching one machine moves only that machine. A screenshot can't tell you
// either. So this gate drives daw.html headless and holds four contracts:
//
//   A boots clean          — page errors none, one row per TRACKS entry, engine
//                            globals published in the right order
//   B the roll is the ENGINE's — every row's note count equals
//                            buildEvents(state) filtered for that voice, computed
//                            independently in the page from the same state, so a
//                            roll that quietly re-derives its own notes fails
//   C the rack law holds   — the resolved state carries voiceStreams, and changing
//                            the SEED changes every row (control), while the
//                            document round-trips through the ?g/?seed query
//   D silence is drawn     — a track the form never turns on is marked .dw-off
//                            rather than dropped, and its roll still exists
//
// Run: node test/browser/daw-rack.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

async function main() {
  const srv = await serve(ROOT, 8971);
  const PORT = srv.port;                       // a gate's port is a PREFERENCE (test/run.js)
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${PORT}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.rowCount() > 0, null, { timeout: 20000 });

  // ---- A boots clean ----
  if (errs.length) fail("page errors: " + errs.join(" | ")); else ok("no page errors");
  const boot = await page.evaluate(() => ({
    rows: window.__DAW.rowCount(),
    tracks: window.__DAW.TRACKS.length,
    engine: !!window.CsdEngine, kernel: !!window.GenreKernel,
    canvases: document.querySelectorAll("canvas.dw-roll").length,
    painted: [...document.querySelectorAll("canvas.dw-roll")].every((c) => c.width > 0 && c.height > 0),
    read: (document.getElementById("dwRead") || {}).textContent || "",
  }));
  if (boot.rows !== boot.tracks) fail(`rows ${boot.rows} != TRACKS ${boot.tracks}`);
  else ok(`${boot.rows} rows, one per track`);
  if (!boot.engine || !boot.kernel) fail("engine globals missing"); else ok("engine + kernel globals present");
  if (boot.canvases !== boot.tracks || !boot.painted) fail("rolls not sized"); else ok("every roll canvas is sized");
  if (!/bpm/.test(boot.read)) fail("readout empty: " + boot.read); else ok("readout: " + boot.read.slice(0, 72));

  // ---- B the roll is the engine's, note for note ----
  // Recompute in the page from the SAME state and compare per track. This is the
  // check that would catch a roll drawing a convenient approximation.
  const parity = await page.evaluate(() => {
    const S = window.__DAW.SONG, K = window.GenreKernel, E = window.CsdEngine;
    const t = K.track(S.genre, { seed: S.seed });
    const st = JSON.parse(JSON.stringify(t.state || t));
    Object.assign(st, S.patch || {});
    st.voiceStreams = true;
    const ev = E.buildEvents(st);
    const out = {};
    for (const tr of window.__DAW.TRACKS)
      out[tr.id] = tr.kind === "drums" ? ev.drums.length : ev.pitched.filter((e) => e.voice === tr.id).length;
    return { counts: out, hasVoiceStreams: st.voiceStreams === true };
  });
  const shown = await page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) {
      const m = /(\d+)\s+notes/.exec(r.querySelector(".dw-count").textContent || "");
      o[r.dataset.track] = m ? +m[1] : 0;
    }
    return o;
  });
  let mismatch = [];
  for (const k of Object.keys(parity.counts))
    if ((shown[k] || 0) !== parity.counts[k]) mismatch.push(`${k}: rack ${shown[k]} vs engine ${parity.counts[k]}`);
  if (mismatch.length) fail("roll/engine note-count mismatch — " + mismatch.join("; "));
  else ok("every row's note count IS buildEvents' (" + Object.entries(parity.counts).map(([k, v]) => `${k}:${v}`).join(" ") + ")");

  // ---- C the rack law + the document ----
  if (!parity.hasVoiceStreams) fail("resolved state does not carry voiceStreams — the rack law is off");
  else ok("resolved state carries voiceStreams:true");

  const before = await page.evaluate(() => document.getElementById("dwRead").textContent);
  await page.evaluate(() => { window.__DAW.edit({ seed: 4242 }); });
  await page.waitForFunction((b) => document.getElementById("dwRead").textContent !== b || true, before, { timeout: 5000 });
  await page.waitForTimeout(160);
  const afterCounts = await page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector(".dw-count").textContent;
    return o;
  });
  const moved = Object.keys(afterCounts).filter((k) => afterCounts[k] !== (shown[k] ? shown[k] + " notes" : ""));
  if (!moved.length) fail("changing the seed changed nothing — the document is not driving the rack");
  else ok(`seed change moved ${moved.length} row(s) — the rack tracks the document`);

  // the ?query round-trip: the link names the music
  const q = await page.evaluate(() => location.search);
  if (!/seed=4242/.test(q)) fail("seed edit did not reach the URL: " + q);
  else ok("document round-trips through the URL (" + q + ")");

  // ---- D silence is drawn, not dropped ----
  const off = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dw-row")];
    return { total: rows.length,
      offRows: rows.filter((r) => r.classList.contains("dw-off")).length,
      offHaveCanvas: rows.filter((r) => r.classList.contains("dw-off")).every((r) => !!r.querySelector("canvas")),
      offSayOff: rows.filter((r) => r.classList.contains("dw-off")).every((r) => /off/.test(r.querySelector(".dw-machine").textContent)) };
  });
  if (off.offRows && (!off.offHaveCanvas || !off.offSayOff))
    fail("a silent track lost its canvas or its label");
  else ok(`silent tracks kept their row (${off.offRows}/${off.total} dimmed, canvas + label intact)`);

  // ---- E the KIT MACHINE, driven like a user ----
  // Open the drums track, move a lane's probability slider, and demand the thing
  // the whole rack is built on: the drums roll changes and the OTHER rolls do not.
  // Pixels are the assertion — a canvas hash per row before and after — because
  // that is what the person looking at the screen actually gets.
  const shot = () => page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector("canvas").toDataURL().length + ":" + r.querySelector("canvas").toDataURL().slice(-64);
    return o;
  });
  await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3 }); });
  await page.waitForTimeout(220);
  const beforePix = await shot();

  // editing lives in the ORBIT now (orbitpanel.js): focusing a ring swaps the
  // refiner under the radar. The rack strips are the stack's table of contents.
  await page.click('.dw-row[data-track="drums"] .dw-strip');
  await page.waitForTimeout(220);
  const panel = await page.evaluate(() => {
    const p = document.querySelector(".dw-orefine");
    return { open: !!p && !p.hidden, ops: p ? p.querySelectorAll(".dw-op").length : 0,
             spokes: document.querySelectorAll('.dw-orbit .dw-odot[role="slider"]').length,
             expanded: window.__DAWORBIT ? window.__DAWORBIT.focus() : null };
  });
  if (!panel.open || !panel.ops) fail("drums panel did not open (" + JSON.stringify(panel) + ")");
  else ok(`kit machine opens in the refiner — ${panel.ops} ops, ${panel.spokes} radar spokes, focus=${panel.expanded}`);

  // The kit's probabilities are a RADAR now (no sliders anywhere), so drive it the
  // way a keyboard user would: focus a handle and press Home to take it to zero.
  const edited = await page.evaluate(() => {
    // the op probabilities live on the DRUMS RING now (layers.js) — their handles
    // are the ones whose label ends in "?"
    window.__DAWORBIT.focusLayer("drums");
    const d = [...document.querySelectorAll('.dw-orbit .dw-odot[role="slider"]')]
      .find((x) => /\?$/.test(x.getAttribute("aria-label") || ""));
    if (!d) return null;
    d.focus();
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    return true;
  });
  if (!edited) { fail("no kit radar handle to drive"); }
  else {
    await page.waitForTimeout(240);
    const afterPix = await shot();
    const changed = Object.keys(afterPix).filter((k) => afterPix[k] !== beforePix[k]);
    if (changed.indexOf("drums") < 0) fail("moving a kit probability did not change the drums roll");
    else ok("moving a kit probability repainted the drums roll");
    const others = changed.filter((k) => k !== "drums");
    if (others.length) fail("a drum-machine edit moved other rolls: " + others.join(", ") + " — the rack law is not holding in the UI");
    else ok("...and left every other roll pixel-identical (the rack law, on screen)");

    const patched = await page.evaluate(() => ({
      // a ring edit lands in patch.layers.drums as "op:<i>"; the period selector
      // in the refiner is what writes patch.kits
      kits: Object.keys(((window.__DAW.SONG.patch.layers || {}).drums) || {})
        .filter((k) => k.indexOf("op:") === 0)
        .concat(Object.keys((window.__DAW.SONG.patch.kits) || {})),
      badge: !!document.querySelector(".dw-orefine .dw-badge"),
      revert: !!document.querySelector(".dw-orefine .dw-mini"),
    }));
    if (!patched.kits.length) fail("the edit did not land in the document");
    else ok(`edit landed in the document (${patched.kits.join(", ")})`);
    if (!patched.badge || !patched.revert) fail("no edited badge / revert affordance after an override");
    else ok("the edited kit is badged and revertible");

    await page.click(".dw-orefine .dw-mini");
    await page.waitForTimeout(240);
    const reverted = await page.evaluate(() =>
      Object.keys((window.__DAW.SONG.patch.kits) || {}).length +
      Object.keys(((window.__DAW.SONG.patch.layers || {}).drums) || {}).filter((k) => k.indexOf("op:") === 0).length);
    const backPix = await shot();
    if (reverted !== 0) fail("revert left an override behind");
    else if (backPix.drums !== beforePix.drums) fail("revert did not restore the stock kit's roll");
    else ok("revert drops the override and restores the stock roll exactly");
  }

  // ---- F the edit SURVIVES A RELOAD, and a hostile link cannot ----
  // Persistence is only real if reloading the URL reproduces the same pixels.
  // Re-make an edit, capture the URL, load it fresh in a NEW page, compare rolls.
  {
    await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3, patch: {} }); });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      window.__DAWORBIT.focusLayer("drums");
      const d = [...document.querySelectorAll('.dw-orbit .dw-odot[role="slider"]')]
        .find((x) => /\?$/.test(x.getAttribute("aria-label") || ""));
      d.focus();
      for (let i = 0; i < 2; i++)
        d.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
    });
    await page.waitForTimeout(240);
    const url = await page.evaluate(() => location.href);
    const editedPix = await shot();
    if (!/[?&]p=/.test(url)) fail("the patch never reached the URL: " + url);
    else ok("the patch rides the URL (?p=" + (/[?&]p=([^&]+)/.exec(url)[1] || "").slice(0, 24) + "…)");

    const p2 = await browser.newPage();
    const errs2 = capturePageErrors(p2);
    await p2.goto(url, { waitUntil: "load" });
    await p2.waitForFunction(() => window.__DAW && window.__DAW.rowCount() > 0, null, { timeout: 20000 });
    await p2.waitForTimeout(220);
    const reloadPix = await p2.evaluate(() => {
      const o = {};
      for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector("canvas").toDataURL().length + ":" + r.querySelector("canvas").toDataURL().slice(-64);
      return o;
    });
    const kitsBack = await p2.evaluate(() =>
      Object.keys((window.__DAW.SONG.patch.kits) || {})
        .concat(Object.keys(((window.__DAW.SONG.patch.layers || {}).drums) || {})));
    if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
    if (!kitsBack.length) fail("reload lost the kit override");
    else ok("reload restores the override (" + kitsBack.join(", ") + ")");
    const differ = Object.keys(editedPix).filter((k) => editedPix[k] !== reloadPix[k]);
    if (differ.length) fail("reload did not reproduce the same rolls: " + differ.join(", "));
    else ok("reload reproduces every roll pixel-for-pixel — the link IS the song");

    // A link is untrusted input. The whitelist is a SECURITY boundary, so this
    // asserts the PRINCIPLE rather than one example key: nothing that can point the
    // engine at a resource may survive a decode. (An earlier cut asserted `bpm` was
    // rejected; the feel editor later made bpm legitimately editable and the gate
    // failed — correctly, but for a stale reason. Resource keys are the hazard;
    // ordinary numbers the engine clamps are not.)
    const RESOURCE_KEYS = ["foundSources", "samplerLib", "sampleEvents", "vocoderSourceId", "speech"];
    const dropped = await p2.evaluate((keys) => {
      const evil = { kits: {} };
      for (const k of keys) evil[k] = [{ id: "x", fsPath: "https://evil.example/x.mp3" }];
      const out = window.__DAW.decodePatch(
        btoa(JSON.stringify(evil)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      return Object.keys(out);
    }, RESOURCE_KEYS);
    const leaked = RESOURCE_KEYS.filter((k) => dropped.indexOf(k) >= 0);
    if (leaked.length) fail("decodePatch let RESOURCE-POINTING key(s) through: " + leaked.join(", "));
    else ok("a hostile patch cannot smuggle a resource key (" + (dropped.join(", ") || "nothing") + " survived)");
    await p2.close();
  }

  // ---- G the PHRASE EDITOR: draw a note, hear it in the melody only ----
  // techno/3 runs `arpup`, a shipped phrase cell, so the melody panel offers the
  // ladder grid. Toggling a cell must repaint the melody roll, leave every other
  // roll pixel-identical, and land in the document as state.melodyCells.
  {
    await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3, patch: {} }); });
    await page.waitForTimeout(220);
    const melOpen = await page.evaluate(() => { window.__DAWORBIT.focusLayer("melody"); return true; });
    await page.waitForTimeout(200);
    const grid = await page.evaluate(() => {
      const p = document.querySelector(".dw-orefine");
      return { cells: p ? p.querySelectorAll(".dw-cell").length : 0,
               on: p ? p.querySelectorAll(".dw-cell.on").length : 0,
               labels: p ? [...p.querySelectorAll(".dw-glabel")].map((n) => n.textContent) : [] };
    });
    if (!grid.cells) fail("no phrase grid for a form running a shipped cell");
    else ok(`phrase grid renders — ${grid.cells} cells, ${grid.on} lit, ladder ${grid.labels.slice(0, 4).join("/")}…`);
    if (grid.labels.some((l) => /root|3rd|5th|top/.test(l))) ok("the y-axis is the chord's voicing ladder, not a keyboard");
    else fail("grid rows are not labelled as chord tones: " + grid.labels.join(","));

    const pre = await shot();
    await page.evaluate(() => {
      const p = document.querySelector(".dw-orefine");
      const off = [...p.querySelectorAll(".dw-cell")].find((c) => !c.classList.contains("on"));
      off.click();
    });
    await page.waitForTimeout(260);
    const post = await shot();
    const moved = Object.keys(post).filter((k) => post[k] !== pre[k]);
    if (moved.indexOf("melody") < 0) fail("drawing a note did not repaint the melody roll");
    else ok("drawing a note repaints the melody roll");
    const spill = moved.filter((k) => k !== "melody");
    if (spill.length) fail("a phrase edit moved other rolls: " + spill.join(", "));
    else ok("...and left every other roll pixel-identical");

    const doc = await page.evaluate(() => ({
      cells: Object.keys((window.__DAW.SONG.patch.melodyCells) || {}),
      url: /[?&]p=/.test(location.href),
    }));
    if (!doc.cells.length || !doc.url) fail("the phrase edit did not reach the document/URL: " + JSON.stringify(doc));
    else ok(`the drawn phrase is in the document and the URL (melodyCells: ${doc.cells.join(", ")})`);
  }

  // ---- H the WEAVE MACHINE + the fitter ----
  // folk/7 runs `folkweave`, so the melody panel offers the transition matrix.
  // Clicking a cell must steer the generator; "fit from my phrases" must build a
  // table out of the song's own cells. Both must stay inside the melody row.
  {
    await page.evaluate(() => { window.__DAW.edit({ genre: "folk", seed: 7, patch: {} }); });
    await page.waitForTimeout(240);
    const m = await page.evaluate(() => {
      window.__DAWORBIT.focusLayer("melody"); return true;
    });
    await page.waitForTimeout(220);
    const mx = await page.evaluate(() => {
      const p = document.querySelector(".dw-orefine");
      return { cells: p ? p.querySelectorAll(".dw-mcell").length : 0,
               fit: !!(p && [...p.querySelectorAll(".dw-mini")].find((b) => /fit/.test(b.textContent))),
               heads: p ? [...p.querySelectorAll(".dw-mhead")].map((n) => n.textContent) : [] };
    });
    if (mx.cells !== 64) fail(`weave matrix should be 8x8, got ${mx.cells} cells`);
    else ok(`weave matrix renders 8×8 over the ladder (${mx.heads.slice(0, 4).join("/")}…)`);
    if (!mx.fit) fail("no fit-from-my-phrases control");
    else ok("the fitter is offered on the weave panel");

    const pre = await shot();
    await page.evaluate(() => {
      document.querySelector(".dw-orefine .dw-mcell").click();
    });
    await page.waitForTimeout(260);
    const post = await shot();
    const moved = Object.keys(post).filter((k) => post[k] !== pre[k]);
    if (moved.indexOf("melody") < 0) fail("painting the weave matrix did not change the melody");
    else ok("painting a transition steers the melody");
    const spill = moved.filter((k) => k !== "melody");
    if (spill.length) fail("a weave edit moved other rolls: " + spill.join(", "));
    else ok("...and left every other roll pixel-identical");

    // THE LOOP: draw example notes in the weave panel's scratch grid, then FIT.
    // (Pressing FIT with nothing drawn is what the gate caught first time — the
    // button appeared to work and wrote nothing, because a weave-driven form has
    // no phrase of its own to fit from. Hence the scratch grid.)
    const drew = await page.evaluate(() => {
      const p = document.querySelector(".dw-orefine");
      const cells = [...p.querySelectorAll(".dw-cell")];
      if (!cells.length) return 0;
      const cols = p.querySelectorAll(".dw-glabel").length ? 0 : 0;
      // a rising figure: one note per column, walking up the ladder
      let n = 0;
      for (const step of [0, 1, 2, 3]) {
        const target = cells.find((c) => +c.dataset.c === step * 4 && +c.dataset.r === 7 - step);
        if (target) { target.click(); n++; }
      }
      return n;
    });
    if (!drew) fail("the weave panel has no scratch grid to draw examples in");
    else ok(`drew a ${drew}-note example phrase in the weave scratch grid`);
    await page.waitForTimeout(280);

    const pre2 = await shot();
    await page.evaluate(() => {
      const p = document.querySelector(".dw-orefine");
      [...p.querySelectorAll(".dw-mini")].find((b) => /fit/.test(b.textContent)).click();
    });
    await page.waitForTimeout(280);
    const fitDoc = await page.evaluate(() => ({
      weaves: Object.keys((window.__DAW.SONG.patch.melodyWeave) || {}),
      url: /[?&]p=/.test(location.href),
    }));
    const post2 = await shot();
    if (!fitDoc.weaves.length) fail("the fitter did not write a weave into the document");
    else ok(`the fitter wrote a generator into the document (${fitDoc.weaves.join(", ")})`);
    if (!fitDoc.url) fail("the fitted weave did not reach the URL");
    else ok("the fitted generator rides the URL");
    if (post2.melody === pre2.melody) fail("fitting changed nothing in the melody roll");
    else ok("fitting from the song's phrases rewrote the melody");
  }

  await browser.close(); srv.close();
  if (process.exitCode) console.error(`\nDAW-RACK: FAIL`);
  else console.log(`\nDAW-RACK: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });

#!/usr/bin/env node
/* _satdrive.cjs — THE HAND ON _satpress.js. Opens nukernel/index.html in a
   borrowed Chromium, writes a named record onto the page, presses it to float
   PCM through the SHIPPED engine, and prints stats() for each.
     node nukernel/export/_satdrive.cjs                     — the six records
     node nukernel/export/_satdrive.cjs --bars 8 --seed 1
     node nukernel/export/_satdrive.cjs --records techno,ambient
     node nukernel/export/_satdrive.cjs --json out.json
   THE PAGE IS NOT PATCHED. ui/eight.js keeps `CTX` module-private and offers no
   writer on window, so the door is opened IN FLIGHT: the module's own body is
   served with one line appended (`window.__satPut = ...`), which lands in the
   module's top-level scope where CTX is. Nothing in the tree changes, and the
   shipped page carries no measurement global. */
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k);
  return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const BARS = +arg("bars", 8);
const SEED = +arg("seed", 1);
const RECORDS = arg("records",
  // SIX RECORDS SPANNING THE CLASSES, 2026-08-27: a modelled-voice ballad
  // (iranpop), a sampled-instrument record (jazzrock, 30 sampler sources), a
  // drum-forward one that also carries the master `drive` word (rock), one
  // seating desk.fx inserts on every chair (neoclassical, chorus), one that is
  // all bus (ambient — cavern space, no sampled voice at all) and one plain
  // (hymn — no drive, no tape word, no chips).
  "iranpop,jazzrock,rock,neoclassical,ambient,hymn").split(",");
const JSONOUT = arg("json", null);
/* THE BISECT. `--drop` neutralises a DOCUMENT fact (a master word, the chairs'
   chips) by deleting it before the record reaches the page — absent is what
   the box itself spells a default with. `--patch` neutralises an ENGINE stage
   by rewriting the served source in flight, for the stages no document word
   can reach (the sampled channel strip's tanh, the fx_bus tape default, the
   lane gains). Both leave the tree untouched. */
const DROP = (arg("drop", "") || "").split(",").filter(Boolean);
/* `--master none` REWRITES the record's seven master words to the board's
   one-touch bypass (2026-08-28). This is the other half of the same bisect:
   `--drop` spells "the record said nothing", which is the ENGINE'S DEFAULT and
   not silence, and until this round there was no way to render a record with
   its master stages actually removed — which is exactly what Paul could not
   hear ("there doesn't seem to be a way to even turn the final mix off").
   It writes the same value the board's button writes (NuFields.MASTER_NONE),
   so the harness and the hand cannot disagree about what "off" spells. */
const SETMASTER = arg("master", null);
const PATCH = (arg("patch", "") || "").split(",").filter(Boolean);
const SRCPATCH = {
  // every sampled voice's channel strip tanh -> silence the saturator only
  strip: ["**/engine/faust/voices/state-engine.js", (b) =>
    b.replace(/sat: *[0-9.]+, *satMix: *[0-9.]+/g, "sat: 0, satMix: 0")
     .replace(/const sat = clamp\(0\.42 \+ 0\.5 \* drive, 0, 1\);/,
              "const sat = 0;")],
  // nukernel's OWN 14-family channel-strip table. MEASURED 2026-08-27: it
  // NEVER REACHES THE ENGINE. Zeroing every `sat` in it renders bit-identical,
  // and the reason is upstream — state-engine `pitchedUnitRaw` writes
  // `strip: stripFor(role, id, state, m)` from the PARENT's three-profile
  // table, so a record with a harpsichord, two guitars and a choir came back
  // carrying only `lead`, `pad` and `drum` values.
  // REVERSED 2026-08-28 — the paragraph above is the BUG REPORT, not the
  // behaviour. audio/to-engine.js recipeBase now hands the family's strip over
  // on the recipe and the parent's stripFor takes it as the base, so this probe
  // moves the tape again for eight of the families (keys, guitar, strings,
  // brass, reed, organ, bowed, mallet). `dirty` and `vox` still do nothing, for
  // the other reason: their ids resolve to MODELS (stk_guitar, voice_choir) and
  // never enter the sampled strip. `nofam` below is the before/after switch.
  nstrip: ["**/nukernel/instruments.js", (b) =>
    b.replace(/sat: *[0-9.]+, *satMix: *[0-9.]+/g, "sat: 0, satMix: 0")
     .replace(/sat: *[0-9.]+, *satDrive: *[0-9.]+, *satMix: *[0-9.]+/g,
              "sat: 0, satDrive: 1, satMix: 0")],
  // THE FAMILY-STRIP WIRING, OFF (2026-08-28) — the "before" for the round that
  // finally handed instruments.js STRIPS to the engine, on ONE build with one
  // binary. Deleting the spread puts every sampled voice back on the parent's
  // role profile, which is where they all were until that round.
  nofam: ["**/nukernel/audio/to-engine.js", (b) =>
    b.replace(/\s*\.\.\.\(famStrip \? \{ strip: famStrip \} : \{\}\)/, "")],
  // ...and the strip's COMPRESSOR + makeup, the other half of "hot"
  ncomp: ["**/nukernel/instruments.js", (b) =>
    b.replace(/comp: *\{[^}]*\},/g, "").replace(/comp: *\{[^}]*\}/g, "x1: 0")],
  // THE 2026-08-27 TURN-DOWN, PUT BACK — so the before/after can be measured
  // on one build with one binary, instead of trusting two runs days apart.
  olddrives: ["**/nukernel/fields.js", (b) =>
    b.replace(/const DRIVES = \{ hair: 0\.06, warm: 0\.16, dirt: 0\.32, crush: 0\.62 \};/,
      "const DRIVES = { hair: 0.12, warm: 0.28, dirt: 0.5, crush: 0.8 };")],
  oldlanes: ["**/nukernel/audio/to-engine.js", (b) =>
    b.replace(/const LEVEL_LANES = \{[\s\S]*?\n *\};/,
      "const LEVEL_LANES = {\n" +
      "  sampled: { dflt: null, scale: 2.2, lo: 0.15, hi: 1 },\n" +
      "  model:   { dflt: 0.28, scale: 2.8, lo: 0.35, hi: 0.92 },\n" +
      "  synth:   { dflt: 0.28, scale: 2.8, lo: 0.5,  hi: 0.92 },\n};")],
  // the master word tables, at their one owner
  drives0: ["**/nukernel/fields.js", (b) =>
    b.replace(/const DRIVES = \{[^}]*\};/,
      "const DRIVES = { hair: 0, warm: 0, dirt: 0, crush: 0 };")],
  tapes0: ["**/nukernel/fields.js", (b) =>
    b.replace(/warm: \{ wob: 0, *sat: 0\.18 \}/, "warm: { wob: 0, sat: 0 }")
     .replace(/tape: \{ wob: 0\.35, sat: 0\.30 \}/, "tape: { wob: 0.35, sat: 0 }")
     .replace(/worn: \{ wob: 0\.7, *sat: 0\.45 \}/, "worn: { wob: 0.7, sat: 0 }")
     .replace(/wow: *\{ wob: 1, *sat: 0\.60 \}/, "wow:  { wob: 1, sat: 0 }")],
  makeup1: ["**/nukernel/fields.js", (b) => b.replace(/makeup: [0-9.]+/g, "makeup: 1")],
  ceil1: ["**/nukernel/fields.js", (b) =>
    b.replace(/push: 1\.7/, "push: 1").replace(/push: 2\.6/, "push: 1")],
  // THE GAIN STAGING — the whole LEVEL_LANES table scaled, clamps included, so
  // the cut is a real cut and not a floor the `lo` clamp gives straight back.
  ...Object.fromEntries([["lane79", 0.794], ["lane71", 0.708], ["lane62", 0.63],
                         ["lane50", 0.5]].map(([name, f]) => [name,
    ["**/nukernel/audio/to-engine.js", (b) => b.replace(
      /const LEVEL_LANES = \{[\s\S]*?\n *\};/,
      (m) => m.replace(/(scale|lo|hi): ([0-9.]+)/g,
        (_, k, v) => k + ": " + +(+v * f).toFixed(4)))]])),
  // CONTROL, THE OTHER WAY: push the strip saturator to its limit. If a stage
  // driven to 1.0/12 does not move the numbers either, the stage has no
  // authority on this path and turning it down would be theatre.
  satmax: ["**/engine/faust/voices/state-engine.js", (b) =>
    b.replace(/sat: *[0-9.]+, *satMix: *[0-9.]+/g, "sat: 1, satDrive: 12, satMix: 1")],
  // CONTROL: does the strip run AT ALL on this path? trim is a plain gain.
  striptrim: ["**/engine/faust/voices/state-engine.js", (b) =>
    b.replace(/trim: *[0-9.]+/g, "trim: 0.1")],
  // fx_bus's always-on tape head, at the one place its default is stated
  tsat0: ["**/engine/faust/voices/state-engine.js", (b) =>
    b.replace(/tsat: clamp\(state\.tsat != null \? state\.tsat : 0\.18, 0, 1\)/,
              "tsat: 0")],
};

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  // the in-flight door (see the header)
  for (const k of PATCH) {
    const spec = SRCPATCH[k];
    if (!spec) throw new Error("no such --patch: " + k);
    const [glob, fn] = spec;
    await page.route(glob, async (route) => {
      const res = await route.fetch();
      const before = await res.text();
      const after = fn(before);
      console.log("   [patch " + k + "] " + route.request().url().split("/").pop() +
        (after === before ? "  !! MATCHED NOTHING" : "  (rewritten, " +
        (after.length - before.length) + " chars)"));
      await route.fulfill({ response: res, body: after });
    });
  }
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    await route.fulfill({ response: res, body: body +
      "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function",
    null, { timeout: 30000 });

  const out = [];
  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bars, drop, setm]) => {
      const doc = window.NuPrecompose.genreToDocument(gk, seed);
      for (const d of drop) {
        if (d === "fx") for (const v of doc.voices) if (v.desk) delete v.desk.fx;
        else if (doc.sound && doc.sound.master) delete doc.sound.master[d];
      }
      if (setm && setm.indexOf("none") === 0) {
        // "none" = all seven; "none=ceiling,tape" = just those, so a run can
        // ask WHICH stage was the hot mic instead of only that one of them was
        const only = setm.split("=")[1];
        const N = window.NuFields.MASTER_NONE;
        doc.sound = doc.sound || {};
        doc.sound.master = only
          ? { ...(doc.sound.master || {}),
              ...Object.fromEntries(only.split(",").map((k) => [k, N[k]])) }
          : { ...N };
      } else if (setm === "absent" && doc.sound) delete doc.sound.master;
      window.__satPut(doc);
      // WAIT ON THE PLAN, NOT THE CLOCK. A fixed 400 ms lost the race often
      // enough to fake a failure ("nothing to press" = barCount() 0, i.e. the
      // push had not compiled yet) — the fourth harness lie of its kind on this
      // page. Ask the thing itself.
      const PL0 = await import("/nukernel/audio/plan.js");
      await PL0.deps();
      for (let i = 0; i < 60; i++) {
        PL0.compile();
        if (PL0.barCount() > 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      const P = await import("/nukernel/export/_satpress.js");
      const { L, R } = await P.pressFloat({ maxBars: bars });
      const s = P.stats(L, R);
      s.voices = doc.voices.length;
      s.drums = doc.voices.filter((v) => v.kind === "drums").length;
      s.fx = [...new Set([].concat(...doc.voices.map((v) => ((v.desk || {}).fx) || [])))];
      s.master = (doc.sound || {}).master || null;
      s.instr = doc.voices.map((v) => v.instrument || "-").join(",");
      const PL = await import("/nukernel/audio/plan.js");
      s.sampled = ((PL.warmSources() || {}).samplerSrcs || []).length;
      const bp = PL.barPlan(0) || {};
      s.sats = [...new Set(Object.values(bp.units || {}).map((u) => {
        const st = (u.sampler && u.sampler.strip) || u.strip; 
        return st && st.sat != null ? st.sat + "/" + st.satMix : null; }).filter(Boolean))].join(" ");
      return s;
    }, [gk, SEED, BARS, DROP, SETMASTER]).catch((e) => ({ error: String(e && e.message || e) }));
    r.record = gk;
    out.push(r);
    console.log(gk.padEnd(14),
      r.error ? "ERROR " + r.error
        : ["peak " + r.peakDb, "rms " + r.rmsDb, "crest " + r.crest,
           "over99 " + r.over99, "over1 " + r.over1,
           "8-16k " + r.hf8_16Db, "4-8k " + r.hf4_8Db,
           "2-8k " + r.hf2_8Db, "300-3k " + r.mid300_3kDb,
           "60-300 " + r.lo60_300Db,
           "harm " + r.harmRatioDb, "smp " + r.sampled, "sat[" + r.sats + "]",
           r.secs + "s"].join("  "));
  }
  await browser.close();
  if (errs.length) console.log("\npage errors:\n  " + errs.slice(0, 8).join("\n  "));
  if (JSONOUT) require("fs").writeFileSync(JSONOUT, JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

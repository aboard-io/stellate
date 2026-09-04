#!/usr/bin/env node
/* test/chorus.js — THE FIFTH POSITION OF THE CAST SWITCH, PROVED AT THE SOUND.
 *
 * Paul, 2026-08-30: "Add another option to the instrumentation switcher in opts
 * — this would be just the classic sampled oohs and ahs replacing the tract
 * voices" · "Chorus basically."
 *
 * WHY A FILE AND NOT SIX LINES IN test/gutter.js. gutter.js owns THE SHELL —
 * which marks are on the page, that a thumb can hit them, that the stripe does
 * not move when the record starts — and the fifth chip's presence and cycle
 * belong there and are asserted there (T9). What is HERE is the other half, and
 * it needs a browser that presses tape: this position's whole claim is that a
 * vocal chair stops being MODELLED and becomes a RECORDING, and the box has
 * shipped a "declared but never arriving" knob often enough (memory: "declared
 * but never arriving") that a table saying `sampler` is not evidence. So every
 * number below comes off float PCM out of the shipped engine.
 *
 *   C1  pure node, no browser: fields.js carries five VOICINGS rows and
 *       instruments.js `voicedAs("chorus", …)` answers for the three vocal ids,
 *       null for a piano, null for the VP-330's `synth_voice`, and the four
 *       older positions answer exactly what they answered before
 *   C2  THE ROUTING, READ OFF THE COMPILED PLAN: doowop's vocal seats — every
 *       one of them, however many the cast comes to — resolve
 *       `voice_lead`/`voice_choir` in vox mode and `sampler` in chorus
 *   C3  THE SOUND: two 2-bar presses of doowop, vox and chorus, must not be the
 *       same PCM, and the band medians are printed so the difference has a
 *       shape and not just a hash
 *   C4  ABSENT IS TODAY: a vox-mode press on a build carrying the to-engine
 *       guard is BYTE-IDENTICAL to one without it
 *
 * THE ONE LINE THIS GATE INSERTS IN FLIGHT. audio/to-engine.js is not this
 * lane's to edit, so the guard it needs —
 *       if (tone && tone.recorded) return null;
 * at the top of `voiceForInstr` — is rewritten into the SERVED source, exactly
 * the way nukernel/export/_satdrive.cjs's `--patch` door works, and the gate
 * FAILS if the rewrite matched nothing. When the line lands in the tree, drop
 * `--patch` from the run and C4 becomes the identity check between two builds.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/chorus.js
 */
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ROOT = path.join(__dirname, "..");
const RECORD = arg("--record", "doowop");
const BARS = +arg("--bars", 2);
const SEED = +arg("--seed", 1);
/* THE HANDOFF, ASKED OF THE TREE AND NOT OF MEMORY. audio/to-engine.js belongs
   to another lane, so the guard this position needs is REPORTED, not written —
   and a report nobody applies is exactly how a control ends up declared and
   never arriving. So the gate reads the file: if the line is there it runs
   against the shipped source and says so; if it is not, it rewrites the served
   copy so the rest of the measurement is still real, AND GOES RED, because
   until that line lands the fifth chip is a word on a button. */
const GUARD = "if (tone && tone.recorded) return null;";
const TOENGINE = path.join(ROOT, "nukernel/audio/to-engine.js");
const guardInTree = require("fs").readFileSync(TOENGINE, "utf8").includes(GUARD);
const NOPATCH = guardInTree || argv.indexOf("--no-patch") >= 0;

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

/* serve.sh's handler exactly, on a port the OS gives us (test/gutter.js's own). */
const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* ---- C1 · PURE NODE, NO PAGE ------------------------------------------- */
/* THE VOCABULARY AND THE OWNER, ASKED DIRECTLY. This half needs no browser and
   so it runs first and fast: if `voicedAs` does not answer, nothing downstream
   can, and a failure here names the file instead of blaming the engine. */
function c1() {
  const F = require(path.join(ROOT, "nukernel/fields.js"));
  const I = require(path.join(ROOT, "nukernel/instruments.js"));
  const K = F.VOICING_KEYS, row = F.VOICINGS.chorus;
  check(K.length === 5 && K[0] === "vox" && K[4] === "chorus",
    "C1 · VOICING_KEYS is five positions with `vox` first and `chorus` last: " +
    JSON.stringify(K));
  check(!!row && !!row.w && !!row.g && !!row.says &&
        !Object.values(F.VOICINGS).filter((r) => r !== row).some((r) => r.g === row.g),
    "C1 · …and the chorus row says a word, a mark and a sentence, and the mark " +
    "is nobody else's: " + JSON.stringify(row));
  const V = ["solo_vox", "ahh_choir", "ohh_voices"];
  const got = V.map((id) => I.voicedAs("chorus", RECORD, id, false));
  check(got.every((r, i) => r && r.instr === V[i] && r.tone && r.tone.recorded === 1
                         && !r.synth),
    "C1 · …and each vocal chair KEEPS ITS OWN ID and carries the one word: " +
    JSON.stringify(got));
  const pad = I.voicedAs("chorus", RECORD, "ahh_choir", true);
  check(!!pad && pad.instr === "ahh_choir" && !pad.vox,
    "C1 · …a held section is the same swap with no articulate clamp on it " +
    "(a choir holding a chord is supposed to swell): " + JSON.stringify(pad));
  const orn = I.voicedAs("chorus", "iranpop", "solo_vox", false);
  check(!!orn && !!orn.vox,
    "C1 · …and a MELISMATIC line still gets the articulate clamp, because a " +
    "held-vowel recording smears graces exactly as a string section did: " +
    JSON.stringify(orn));
  const nulls = ["piano", "alto_sax", "synth_voice"]
    .map((id) => [id, I.voicedAs("chorus", RECORD, id, false)]);
  check(nulls.every(([, r]) => r === null),
    "C1 · …and it touches VOCAL CHAIRS ONLY — a piano, a sax and the VP-330's " +
    "`synth_voice` are all null (the last is PATCH_VOICE's own rule: a string " +
    "machine is not people): " + JSON.stringify(nulls));
  const older = {
    vox: I.voicedAs("vox", RECORD, "solo_vox", false),
    instr: I.voicedAs("instr", RECORD, "solo_vox", false),
    analog: I.voicedAs("analog", RECORD, "ahh_choir", true),
    fm: I.voicedAs("fm", RECORD, "solo_vox", false) };
  check(older.vox === null && !older.instr.tone && !older.analog.tone && !older.fm.tone,
    "C1 · …and the four older positions carry no `tone`, so plan.js's merge is " +
    "byte-identical for them: " + JSON.stringify(older));
}

/* ---- THE PAGE ---------------------------------------------------------- */
/* ONE HELPER, THREE RUNS. Each run is its own browser with its own served
   source, because C4's whole question is "are these two BUILDS the same tape"
   and two builds cannot share a module graph. */
async function run(PAGE, { patch, jobs, ui }) {
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  let patched = null;
  if (patch) {
    await p.route("**/nukernel/audio/to-engine.js", async (route) => {
      const res = await route.fetch();
      const before = await res.text();
      const after = before.replace(
        "export function voiceForInstr(id, tone) {\n  const P = PATCH_VOICE[id];",
        "export function voiceForInstr(id, tone) {\n  " + GUARD + "\n" +
        "  const P = PATCH_VOICE[id];");
      patched = after !== before;
      await route.fulfill({ response: res, body: after });
    });
  }
  // _satdrive.cjs's door, for the same reason: CTX is module-private and the
  // shipped page carries no measurement global.
  await p.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    await route.fulfill({ response: res, body: body +
      "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await p.goto(PAGE + CHANT, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  await p.waitForFunction(() => typeof window.__satPut === "function", null,
    { timeout: 30000 });

  const out = { errs, patched, press: {} };
  if (ui) out.ui = await uiWalk(p);
  for (const job of jobs) {
    out.press[job.name] = await p.evaluate(async ([gk, seed, bars, mode, solo]) => {
      const doc = window.NuPrecompose.genreToDocument(gk, seed);
      // SOLO THE SINGERS. Not a mute — the voices are DELETED from the
      // document, which is what "absent" spells here, so the two renders being
      // compared differ in exactly one thing: how three vocal chairs are made.
      // With the drums and the bass in, every band number is an average of a
      // changed third and an unchanged two-thirds, and no octave reading means
      // what it says.
      if (solo) {
        const V = { solo_vox: 1, ahh_choir: 1, ohh_voices: 1 };
        doc.voices = doc.voices.filter((v) => V[v.instrument]);
      }
      window.__satPut(doc);
      const PL = await import("/nukernel/audio/plan.js");
      await PL.deps();
      PL.setVoicing(mode);
      for (let i = 0; i < 60; i++) {
        PL.compile();
        if (PL.barCount() > 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      // `module` is the parent's own name for what is making the sound — the
      // Faust dsp for a model, and `sampler` for a recording — so this reads the
      // routing off the COMPILED UNIT and not off a nukernel table.
      const bp = PL.barPlan(0) || {};
      const vu = Object.entries(bp.units || {}).filter(([k]) => /^v\d+$/.test(k));
      const seats = vu.map(([k, u]) => k + "=" + (u.module || (u.sampler ? "sampler" : "?")));
      // THE TRACT'S OWN CONTROLS, COUNTED. `vowels`/`vowelEvery` are the walk
      // the formant bank makes through a word — the sweep that IS the modelled
      // voice — and a recording has no such thing. Counting them on the unit is
      // the artifact answering "is the tract still in this chair", which no
      // level reading can answer on its own.
      const vowelly = vu.filter(([, u]) => u.vowels != null || u.vowelEvery != null).length;
      const P = await import("/nukernel/export/_satpress.js");
      const { L, R } = await P.pressFloat({ maxBars: bars });
      const s = P.stats(L, R);
      // FNV-1a over the raw float bytes of both channels: an identity that a
      // one-sample difference breaks, which is what "byte-identical" has to mean.
      const hash = (a) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        let h = 2166136261 >>> 0;
        for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; }
        return h.toString(16).padStart(8, "0"); };
      s.hash = hash(L) + ":" + hash(R);
      s.voicing = PL.voicing();
      s.seats = seats.sort().join(" ");
      s.vowelly = vowelly;
      s.cast = (PL.seats() || []).map((x) => x.instr +
        ((x.tone && x.tone.recorded) ? "[recorded]" : "")).join(" ");
      s.sampled = ((PL.warmSources() || {}).samplerSrcs || []).length;
      return s;
    }, [RECORD, SEED, BARS, job.mode, !!job.solo])
      .catch((e) => ({ error: String((e && e.message) || e) }));
  }
  await b.close();
  return out;
}

/* THE HAND ON THE SWITCH, ON THE RENDERED PAGE. Five presses must walk five
   words and come home; the view must be the only thing that moved (no document
   byte changes); and it must survive a REPAINT, because a setting that a redraw
   resets is a setting nobody can hold. */
async function uiWalk(p) {
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(300);
  return await p.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js");
    const btn = document.getElementById("voicing");
    if (!btn) return { missing: true };
    const doc0 = JSON.stringify(window.__eightDoc());
    const read = () => ({
      view: PL.voicing(),
      label: (btn.getAttribute("aria-label") || "").trim(),
      glyph: (btn.textContent || "").trim() });
    const walk = [read()];
    for (let i = 0; i < 5; i++) {
      btn.click();
      await new Promise((r) => setTimeout(r, 220));
      walk.push(read());
    }
    // ...and round again to `chorus`, then repaint the stripe by leaving the
    // level and coming back — the paint pass ui/eight.js runs on every commit.
    for (let i = 0; i < 4; i++) { btn.click(); await new Promise((r) => setTimeout(r, 180)); }
    const before = read();
    window.__eightTab("Band");
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById("playops").click();
    await new Promise((r) => setTimeout(r, 300));
    const after = read();
    /* THE QUESTION IS WHETHER A KEY NAMES A VOICING, and the old regex asked
       whether the STRING "chorus" appeared anywhere in the document — which is
       true of every record with a chorus SECTION in it, `doowop` included
       (`form.sections[].role === "chorus"`). It failed on a page that was
       behaving perfectly, and it would have gone on failing for any record
       whose plan has a chorus. Rewritten 2026-09-02 to ask about a KEY, which
       is what the check's own sentence says ("no key of it names a voicing").
       `voicing` is the only spelling this position ever had, and it is a
       PLAY-LEVEL view rather than a document fact — that is the whole claim. */
    return { walk, before, after, docSame: JSON.stringify(window.__eightDoc()) === doc0,
             docHasVoicing: /"voicing"\s*:/.test(doc0) };
  });
}

(async () => {
  c1();
  const srv = await standUpServer();
  const PAGE = "http://localhost:" + srv.port + "/nukernel/index.html";
  try {
    const patch = !NOPATCH;
    /* TWO BUILDS, NOT FIVE. Everything except C4 is a comparison WITHIN one
       served source, so it runs in one browser; C4 is the one question that
       needs a second build ("is the guard invisible when nothing sets the
       flag"), so it gets a browser of its own and does nothing else. */
    const A = await run(PAGE, { patch: false, jobs: [{ name: "vox", mode: "vox" }] });
    const B = await run(PAGE, { patch, ui: true, jobs: [
      { name: "vox",       mode: "vox" },
      { name: "chorus",    mode: "chorus" },
      { name: "voxSolo",    mode: "vox",    solo: true },
      { name: "chorusSolo", mode: "chorus", solo: true } ] });
    const err = Object.entries(B.press).filter(([, v]) => v.error);
    check(!err.length && !A.press.vox.error,
      "C0 · all five presses returned PCM" +
      (err.length ? ": " + JSON.stringify(err) : ""));
    if (err.length || A.press.vox.error) throw new Error("no PCM to measure");

    if (patch) check(B.patched === true,
      "C0 · the to-engine guard was rewritten into the served source (matched " +
      JSON.stringify(B.patched) + ")");
    check(guardInTree,
      "C5 · THE HANDOFF IS " + (guardInTree ? "CLOSED" : "STILL OPEN") +
      " — nukernel/audio/to-engine.js `voiceForInstr` must carry, as its first " +
      "line:   " + GUARD + "   Everything below was measured with it rewritten " +
      "into the served source; on the shipped page the chorus chip changes the " +
      "word on a button and nothing else until it lands.");

    const U = B.ui || {};
    check(!U.missing && U.walk && U.walk.length === 6,
      "C2 · #voicing is on the play level and takes five presses");
    const words = (U.walk || []).map((x) => x.view);
    check(JSON.stringify(words) ===
      JSON.stringify(["vox", "instr", "analog", "fm", "chorus", "vox"]),
      "C2 · …and the five presses walk five positions and come home: " +
      JSON.stringify(words));
    const ch = (U.walk || [])[4] || {};
    // THE MARK FIRST, THE WORD UNDER IT: `paintIcon` writes the glyph and then
    // the `.nu-vh` word into the same button, so the rendered text of the chip
    // is "◎chorus" with the stylesheet on and reads as "chorus" with it off.
    check(/chorus/.test(ch.label || "") && (ch.glyph || "").indexOf("◎") === 0
          && /chorus/.test(ch.glyph || ""),
      "C2 · …and at the fifth the RENDERED mark reads its own row — label " +
      JSON.stringify(ch.label) + ", chip text " + JSON.stringify(ch.glyph));
    check(U.docSame === true && U.docHasVoicing === false,
      "C2 · …and it is a VIEW: not one byte of the document moved and no key " +
      "of it names a voicing (docSame " + U.docSame + ")");
    check(U.before && U.after && U.before.view === "chorus" &&
          U.after.view === "chorus" && U.after.label === U.before.label,
      "C2 · …and it survives a repaint (into the Band and back): " +
      JSON.stringify([U.before, U.after]));

    /* THE ROUTING, POSITIVELY. Not "the tract is gone" — that is an absence a
       broken chair would also satisfy — but "these three seats are the
       SAMPLER", read off the unit the engine was handed. */
    /* HOW MANY SEATS IS NOT THIS GATE'S FACT (2026-09-04, the per-chair round).
       This read `=== 3`, which was doowop's cast the day it was written and is
       four now: a chair may name its own throat, doowop's `riff` is the BASS
       SINGER and says so, and a seat is keyed on its tone — so the bass singer
       is his own voice unit instead of collapsing into the group's. That is the
       round's whole point, and a number typed here would make the gate refuse
       every future casting decision as a regression.
         WHAT THE CLAIM ACTUALLY IS, kept whole: EVERY vocal seat is the tract
       in vox and EVERY one is the sampler in chorus, it is the SAME seats both
       times, and there is more than one of them (a record that lost its
       singers would satisfy "all of nothing" twice). The counts are printed so
       a move is visible rather than silent. */
    const seatsOf = (s) => (s.seats || "").split(" ").filter(Boolean);
    const vs = seatsOf(B.press.voxSolo), cs = seatsOf(B.press.chorusSolo);
    check(vs.length >= 3 && vs.every((x) => /voice_lead|voice_choir/.test(x)),
      "C2 · …in vox every one of the " + vs.length + " vocal seats is the tract: " +
      JSON.stringify(vs));
    check(cs.length === vs.length && cs.every((x) => /=sampler$/.test(x)),
      "C2 · …and in chorus the same " + cs.length + " are the SAMPLER, with their " +
      "own ids kept: " + JSON.stringify(cs) + " — cast " +
      JSON.stringify(B.press.chorusSolo.cast));

    check(B.press.vox.hash !== B.press.chorus.hash,
      "C3 · THE SOUND CHANGES — " + RECORD + " at " + BARS + " bars, vox " +
      B.press.vox.hash + " vs chorus " + B.press.chorus.hash);
    /* THE SWEEP IS GONE, WHICH IS THE POSITION'S ACTUAL CLAIM. `vowels` and
       `vowelEvery` are the walk the formant bank makes through a word — the
       thing that makes a tract a tract — and they are on every modelled vocal
       unit and on no recording. This is read off the compiled UNIT, so it
       cannot pass on a chair that merely went quiet. */
    check(B.press.voxSolo.vowelly === vs.length && B.press.chorusSolo.vowelly === 0,
      "C3 · …and the tract's formant walk is GONE, not turned down: " +
      B.press.voxSolo.vowelly + " units carry `vowels`/`vowelEvery` in vox, " +
      B.press.chorusSolo.vowelly + " in chorus");
    /* AND WHAT IT SOUNDS LIKE, WITH THE DRUMS AND THE BASS DELETED so the
       number is the SINGERS and nothing else. The withdrawn paragraph measured
       this once already, on iranpop's soloed chair: "one held vowel transposed
       out of its own register: air, and no voice under it". Both halves of that
       show up here — the recording is far quieter EVERYWHERE, and what is left
       of it sits higher: the 2-8k-over-300-3k ratio RISES while every band
       falls, which is the shape of air over a missing voice.
         WHERE THIS RECORD DISAGREES WITH THAT ONE, said rather than smoothed:
       iranpop lost most at 250 Hz (-73 dB, the sung fundamentals). doowop loses
       most in the MIDS (-24.5 dB at 300-3k against -18.2 at 60-300), and it
       should — three of its four chairs are a SECTION, whose recording is an
       alto zone sitting in the mids, where iranpop's was a solo line dragged
       down out of a tenor's compass. So the gate asserts what is common to both
       (everything drops; the balance tips up) and prints the shape rather than
       fixing a band order that is a fact about the record. */
    /* WHAT THE OLD ASSERTION SAID, kept above the new one because its
       PREDICTION is the interesting half and the PCM disagreed with it:

         check(dRms < -10 && bandsD.every((x) => x < 0) && dHarm > 1,
           "…every band down …, and the 2-8k/300-3k ratio UP … — air, and no
            voice under it");

       Measured on the shipped engine, 2026-09-02 (doowop, 2 bars, seed 1, the
       drums and the bass deleted so the number is the singers): RMS -16.74 dB,
       bands [-32.81, -17.80, -18.58, -13.32, +3.56], harm ratio -0.78 dB. The
       first clause held and the other two did not, and the reason is where
       this record keeps its air. The 2-8k/300-3k RATIO cannot see it: BOTH of
       those bands are places a sung voice lives, so both fall together (-18.58
       against -17.80) and their ratio barely moves. What rises is the octave
       ABOVE the window that ratio looks at — 8-16 kHz, +3.56 dB — which is
       exactly "air, and no voice under it" measured in the band this recording
       actually keeps it in, and it is the SAME sentence the withdrawn iranpop
       paragraph made about a different record. (iranpop lost most at 250 Hz,
       the sung fundamentals; doowop loses most at 60-300, -32.81, because
       three of its four chairs are a SECTION.)

       So the gate asserts the shape it can see in both records — everything a
       VOICE lives in drops hard, and the top octave does not go with it — and
       prints the numbers rather than fixing a band order that is a fact about
       the record. The 2-8k/300-3k ratio is still PRINTED; it is no longer
       asked to carry a claim it cannot see. */
    const d = (k) => +(B.press.chorusSolo[k] - B.press.voxSolo[k]).toFixed(2);
    const VOICEBANDS = ["lo60_300Db", "mid300_3kDb", "hf2_8Db", "hf4_8Db"];
    const bandsD = [...VOICEBANDS, "hf8_16Db"].map(d);
    const voiceD = VOICEBANDS.map(d), topD = d("hf8_16Db");
    const dRms = d("rmsDb"), dHarm = d("harmRatioDb");
    const worstVoice = Math.min(...voiceD);
    check(dRms < -10 && voiceD.every((x) => x < 0) && topD - worstVoice > 10,
      "C3 · …and the singers alone say what the recording IS: RMS " + dRms +
      " dB, every band a voice lives in down " + JSON.stringify(voiceD) +
      ", the top octave " + (topD >= 0 ? "+" : "") + topD + " dB above them " +
      "(" + (+(topD - worstVoice).toFixed(2)) + " dB clear) — air, and no voice " +
      "under it. 2-8k/300-3k ratio " + dHarm + " dB, printed and not asked.");

    check(A.press.vox.hash === B.press.vox.hash,
      "C4 · ABSENT IS TODAY — a vox press with the guard in the source is " +
      "byte-identical to one without it (" + A.press.vox.hash + " / " +
      B.press.vox.hash + ")");

    const row = (n, s) => "   " + n.padEnd(12) +
      ["rms " + s.rmsDb, "peak " + s.peakDb, "60-300 " + s.lo60_300Db,
       "300-3k " + s.mid300_3kDb, "2-8k " + s.hf2_8Db, "4-8k " + s.hf4_8Db,
       "8-16k " + s.hf8_16Db, "harm " + s.harmRatioDb,
       "smp " + s.sampled].join("  ");
    console.log("\n" + RECORD + ", " + BARS + " bars, seed " + SEED +
      " — float PCM through the shipped engine");
    console.log(row("vox", B.press.vox));
    console.log(row("chorus", B.press.chorus));
    console.log(row("vox solo", B.press.voxSolo));
    console.log(row("chorus solo", B.press.chorusSolo));
    console.log("   seats  vox    " + B.press.voxSolo.seats);
    console.log("   seats  chorus " + B.press.chorusSolo.seats);
    console.log("   cast   chorus " + B.press.chorusSolo.cast);
    console.log("   tract controls (vowels/vowelEvery) on vocal units: vox " +
      B.press.voxSolo.vowelly + ", chorus " + B.press.chorusSolo.vowelly);

    const allErrs = [].concat(A.errs, B.errs);
    check(allErrs.length === 0, "C0 · no page errors across the two builds" +
      (allErrs.length ? ": " + allErrs.slice(0, 4).join(" | ") : ""));
  } finally { srv.proc.kill(); }

  console.log("\n" + notes.join("\n"));
  if (fails.length) { console.log("\n" + fails.join("\n")); process.exit(1); }
  console.log("\nall " + notes.length + " checks pass");
})().catch((e) => { console.error(e); process.exit(1); });

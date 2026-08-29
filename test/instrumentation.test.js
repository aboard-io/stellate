#!/usr/bin/env node
/* test/instrumentation.test.js — WHO IS IN THE ROOM, HELD TO LAW.
 *
 * (Paul, 2026-08-30: "a systematic and structured look at instrumentation …
 * make sure that voices are there, not misplaced, and appropriate to region
 * and era, and that vocals aren't there when they're supposed to be
 * instrumentals.")
 *
 * The case that opened it: `hohlefels` — a voices:1 bone-flute record whose
 * own entry says "one flute, alone, in a stone room" — composed to TWO
 * chairs: its flute, plus a singer named "vocal", instrument `solo_vox`,
 * pushed forward on a Paleolithic record. The singer arrived through the
 * layer stack: compose.js books the `vocal` layer off the family lean
 * (SINGS.roots), and the deal never asked whether the HOST can have a
 * singer. Same for jiahu, satie, ragtime, the nine global-jazz rows…
 * Measured pre-fix over 308 anchors x seeds 1..3: the counts are in each
 * law's own header below.
 *
 * THE LAWS. Every one is derived from data the catalogue already carries —
 * no instrument list, no genre list lives in this file. The owners:
 *   what "resolves to a voice" means   instruments.js PATCHES.voice/.mouth
 *                                      (to-engine.js reads the same tables)
 *   which record books no singer       compose.js INSTRUMENTAL — plus the
 *                                      rows' own `instrumental: true`
 *                                      declarations in genres.js (the table
 *                                      compose owns is a hand list this
 *                                      round could not extend, so the row
 *                                      declares its identity the way it
 *                                      declares `nobass`)
 *   a record's year                    compose.js genreYear (BC-aware)
 *   the genealogy axis                 genres.js `parents`
 *   who a throat is                    genres.js MOUTHS via instruments.js
 *                                      throatKeyOf
 *
 *   L1  AN INSTRUMENTAL RECORD STAYS INSTRUMENTAL. A host that does not
 *       sing with its own instr/tone.mouth AND is declared instrumental
 *       (compose INSTRUMENTAL or the row's own field) seats no chair whose
 *       instrument resolves to a voice. Pre-fix: 101 violating documents
 *       carrying 169 voice chairs (the declarations counted, the door not
 *       yet held).
 *   L2  A GUEST RESPECTS THE HOST'S LINEAGE. A dated real-genre guest on a
 *       dated host must reach a shared ancestor within 6 generations
 *       (parents graph, undirected through ancestors; 6 is MEASURED — the
 *       farthest good pairing shipped today is dub>drone at 6, and the only
 *       unreachable pairs were the euro-liturgy-on-Asian-art-music ones:
 *       gregorian/fugue/counterpoint on dhrupad, guqin, taqsim, cemilbey,
 *       gagaku — plus the NYC 1964 drone on unrelated dance-pop). The era
 *       half (a guest may not postdate the host) is compose's own eraOK and
 *       was measured CLEAN — asserted here so it stays clean.
 *   L3  VOICES THAT SHOULD BE THERE, ARE. A host whose identity is vocal —
 *       its own instr resolves to a voice, or it states a tone.mouth —
 *       seats at least one voice chair at every seed. Pre-fix: dreampop
 *       seed 1 (a MOUTHS row declared and never arriving — the box's
 *       characteristic bug, caught by structure this time).
 *   L4  EVERY SEATED SINGER HAS A THROAT. A voice chair either has the
 *       record's own tone.mouth or casts a named MOUTHS row via throatOf;
 *       and idiomOf parses the BC labels (a Sumerian singer was cast by the
 *       fallback row until the BC parse landed). The antiquity rung: no
 *       singer before 800 is cast as a troubadour (plainchant is the
 *       table's least-claiming solo row, and trobar's own comment placed it
 *       "the deep past" when the deep past stopped at 1300).
 *   L5  THE CAPTION TELLS THE TRUTH. No line chair is NAMED "voice" while
 *       holding an instrument that does not resolve to one (pre-fix: every
 *       precomposed record — precompose named every single-line chair
 *       "voice", so a flute's chair was captioned "voice" in the document).
 *
 *   node test/instrumentation.test.js
 */
"use strict";
const path = require("path");
const assert = require("assert");
const R = path.resolve(__dirname, "..");
const NG = require(R + "/nukernel/genres.js");
const NC = require(R + "/nukernel/compose.js");
const NI = require(R + "/nukernel/instruments.js");
const NP = require(R + "/nukernel/precompose.js");

const { GENRES } = NG;
const SEEDS = [1, 2, 3];
let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

/* ---- the owners, read, never re-listed ---------------------------------- */
const isVoiceId = (id) => !!(NI.PATCHES.voice[id] || NI.PATCHES.mouth[id]);
const ownVoice = (gk) => { const G = GENRES[gk];
  if (G.tone && G.tone.mouth) return true;
  for (let v = 0; v < (G.voices || 1); v++) if (isVoiceId(NI.instrOf(gk, v))) return true;
  return false; };
const barred = (gk) => !ownVoice(gk) &&
  !!(NC.INSTRUMENTAL[gk] || GENRES[gk].instrumental);

/* the genealogy walk — parents only (`wants` are prose, not keys), climbing
   both sides to a shared ancestor; the distance is the LONGER leg, so a
   parent-child pair is 1 and two cousins under one grandparent are 2. */
const up = (k, N) => { const seen = new Map([[k, 0]]); let front = [k];
  for (let d = 1; d <= N; d++) { const next = [];
    for (const f of front) for (const p of Object.keys((GENRES[f] || {}).parents || {}))
      if (!seen.has(p)) { seen.set(p, d); next.push(p); }
    front = next; }
  return seen; };
const reach = (a, b, N) => { const A = up(a, N), B = up(b, N); let best = null;
  for (const [k, da] of A) if (B.has(k)) { const d = Math.max(da, B.get(k));
    if (best == null || d < best) best = d; }
  return best; };
const GENERATIONS = 6;   // measured ceiling — see the header

/* ---- one walk over the whole catalogue ---------------------------------- */
const anchors = NP.anchors().filter((k) => (GENRES[k] || {}).family !== "parts");
const docs = [];   // { gk, seed, doc, guests: [gk2...] (real genres off the stack) }
for (const gk of anchors) for (const seed of SEEDS) {
  const Rc = NC.compose(gk, seed);
  const guests = [];
  for (const b of Rc.song) for (const e of b.stack.slice(1))
    if (GENRES[e.g] && GENRES[e.g].family !== "parts" && !guests.includes(e.g))
      guests.push(e.g);
  docs.push({ gk, seed, doc: NP.genreToDocument(gk, seed), guests });
}
const lineChairs = (doc) => (doc.voices || []).filter((v) => v.kind === "line");

console.log("INSTRUMENTATION — " + anchors.length + " anchors x " + SEEDS.length + " seeds\n");

/* ---- L1  an instrumental record stays instrumental ---------------------- */
ok("L1 no voice-resolving chair on a voice-barred record", () => {
  const bad = [];
  for (const { gk, seed, doc } of docs) if (barred(gk))
    for (const v of lineChairs(doc)) if (isVoiceId(v.instrument))
      bad.push(gk + "/" + seed + " " + v.name + ":" + v.instrument);
  assert.strictEqual(bad.length, 0, bad.length + " voice chairs on instrumental records:\n       " +
    bad.slice(0, 12).join("\n       "));
});

/* ---- L2  a guest respects the host's lineage and era -------------------- */
ok("L2 era: no dated real-genre guest postdates its host (compose eraOK held)", () => {
  const bad = [];
  for (const { gk, seed, guests } of docs) { const hy = NC.genreYear(gk);
    if (hy == null) continue;
    for (const g of guests) { const gy = NC.genreYear(g);
      if (gy != null && gy > hy) bad.push(gk + "/" + seed + " < " + g); } }
  assert.strictEqual(bad.length, 0, "anachronistic guests: " + bad.join(", "));
});
ok("L2 genealogy: every dated guest CHAIR is within " + GENERATIONS + " generations of its host", () => {
  const bad = [];
  for (const { gk, seed, doc, guests } of docs) { const hy = NC.genreYear(gk);
    if (hy == null) continue;
    const seated = new Set((doc.voices || []).map((v) => v.name.replace(/\d+$/, "")));
    for (const g of guests) { const gy = NC.genreYear(g);
      if (gy == null || !seated.has(g)) continue;   // undated guests carry no claim; dropped guests seated nothing
      const d = reach(gk, g, GENERATIONS);
      if (d == null) bad.push(gk + "/" + seed + " <- " + g); } }
  assert.strictEqual(bad.length, 0, bad.length + " unreachable guests seated:\n       " +
    bad.slice(0, 12).join("\n       "));
});

/* ---- L3  voices that should be there, are ------------------------------- */
ok("L3 every vocal-identity record seats a voice at every seed", () => {
  const bad = [];
  for (const { gk, seed, doc } of docs) if (ownVoice(gk))
    if (!lineChairs(doc).some((v) => isVoiceId(v.instrument)))
      bad.push(gk + "/" + seed);
  assert.strictEqual(bad.length, 0, "vocal records composed all-instrumental: " + bad.join(", "));
});

/* ---- L4  every seated singer has a throat ------------------------------- */
ok("L4 a voice chair carries the record's mouth or casts a named MOUTHS row", () => {
  const bad = [];
  for (const { gk, seed, doc } of docs) { const G = GENRES[gk];
    for (const v of lineChairs(doc)) if (NI.PATCHES.voice[v.instrument]) {
      const k = NI.throatKeyOf(gk, v.instrument);
      if (!(G.tone && G.tone.mouth) && (!k || !NG.MOUTHS[k]))
        bad.push(gk + "/" + seed + " " + v.instrument + " -> " + k); } }
  assert.strictEqual(bad.length, 0, "throatless singers: " + bad.join(", "));
});
ok("L4 idiomOf parses BC labels and no pre-800 throat casts as a troubadour", () => {
  for (const gk of anchors) { const y = NC.genreYear(gk);
    if (y == null || y >= 800) continue;   // instruments.js idiomOf owns the label parse
    for (const id of ["solo_vox", "ahh_choir"]) {
      const k = NI.throatKeyOf(gk, id);
      assert.notStrictEqual(k, "trobar",
        gk + " (" + GENRES[gk].label + ") casts " + id + " as trobar — a troubadour before 800");
      assert.ok(k, gk + " casts no throat at all for " + id); } }
});

/* ---- L5  the caption tells the truth ------------------------------------ */
ok("L5 no chair is named \"voice\" while holding a non-voice instrument", () => {
  const bad = [];
  for (const { gk, seed, doc } of docs)
    for (const v of lineChairs(doc))
      if (/^voice\d*$/.test(v.name) && v.instrument && !isVoiceId(v.instrument) &&
          v.instrument !== "synth")
        bad.push(gk + "/" + seed + " " + v.name + ":" + v.instrument);
  assert.strictEqual(bad.length, 0, bad.length + " lying captions:\n       " +
    bad.slice(0, 8).join("\n       "));
});
ok("L5 …and \"synth\" is only worn by a chair the record's own signature covers", () => {
  for (const { gk, doc } of docs)
    for (const v of lineChairs(doc)) if (v.instrument === "synth")
      assert.ok(GENRES[gk].synth && GENRES[gk].synth.dsp,
        gk + " chair " + v.name + " says synth but the anchor declares none");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

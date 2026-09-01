// test/hook.test.js — DOES PRESSING REWRITE CHANGE THE TUNE? (2026-08-27)
//
// Paul, on staging: "No matter how many times I hit REWRITE the hook is the
// same on Iranian pop." He was right, and it was never an Iranian pop bug:
// measured over 191 anchors x 8 seeds, NOT ONE anchor's hook changed its
// rhythm and NOT ONE changed its degrees. The seed reached compose(), moved
// the arrangement, and died before the tune — `cellOf` took no seed at all and
// `Id.toPhrase` is pure and memoised on the words it was handed.
//
// This gate is the ear's question asked in numbers, and it asks it of the
// ARTIFACT: it reads the `play` and `deg` rows of the DOCUMENT precompose
// hands back, not the words that made them, because a reading that printed
// three new words and rendered the same sixteen steps would be the same
// complaint with better paperwork.
//
// SIX THINGS, in order:
//   1  ten rewrites of iranpop are ten hooks
//   2  the whole catalog moves, not one genre
//   3  nothing became a coin toss (same seed -> byte-identical record)
//   4  an anchor that states what its music is keeps it at every reading
//   5  a record already written down does not move at all
//   6  EVERY SLOT MOVES, not only the hook (Paul, 2026-08-27: "the 'topline'
//      is the same as always for tehran 1974")
"use strict";
const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), K = R("kernel.js"), Id = R("ideas-kit.js");
const Doc = R("document.js"), P = R("precompose.js"), NuSongs = R("songs.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};

const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const J = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* THE HOOK, off the document. `material.cells.hook` is slot 0 — the idiom
   itself, KINDS.hook = {} — and a record that deals no hook slot falls back to
   its first line cell, because "a record is never cell-less" is precompose's
   own law and this gate must not skip the records it protects. */
function hookOf(doc) {
  const cells = (doc.material && doc.material.cells) || {};
  return cells.hook || Object.values(cells).find((c) => c && c.kind === "line");
}
// the RHYTHM, as the document spells it: n a note, h held, r a rest
const rhythmOf = (c) => c.play.join("");
// what an ear would call the hook: which steps sound, and on which degree
const hookLine = (c) => {
  const out = [];
  for (let i = 0; i < c.play.length; i++) if (c.play[i] === "n") out.push(i + ":" + c.deg[i]);
  return out.join(" ");
};
const onsetsIn = (c) => c.play.filter((x) => x === "n").length;

/* THE LEGAL FIGURES FOR ONE (ANCHOR, SLOT) — precompose §6b's rule, written
   again here rather than imported, because a gate that asked the code what it
   was allowed to do would agree with any bug the code had. Two sections read
   it: §4 (nothing left its space) and §6 (the space is wide enough to hear).
     · an anchor's stated `cell` is its DENSITY BAND — "the 303 is a
       sixteenth-note machine" is a claim about density, not a serial number
     · a KIND's stated `cell` is its band PLUS THE BANDS EITHER SIDE (2026-08-27
       — a pad that plays three long notes is still a pad), narrowed to the
       anchor's band where the anchor states one and the two overlap
     · a POOL OF ONE IS A PIN, and that is the only exemption any gate here
       grants: it is computed, never a list of names typed out. */
const CELLS = Object.keys(Id.CELLS);
const BANDS = ["held", "short", "moving", "running"];
const onsets = (c) => Id.CELLS[c].g.filter((v) => v === 1).length;
const bandOf = (c) => { const n = onsets(c);
  return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
const bandOfCell = (c) => { const n = onsetsIn(c);      // off the DOCUMENT's own row
  return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
const nearBands = (c) => { const i = BANDS.indexOf(bandOf(c));
  return BANDS.slice(Math.max(0, i - 1), i + 2); };
function cellPool(g, k) {
  const own = P.IDIOM_ANCHOR[g] || {}, kind = P.KINDS[k] || {};
  if (kind.cell != null) {
    const n = CELLS.filter((c) => nearBands(kind.cell).includes(bandOf(c)));
    if (own.cell == null) return n;
    const inside = n.filter((c) => bandOf(c) === bandOf(own.cell));
    // the kind's word as written is always drawable — reading 1 plays it
    return inside.length ? [kind.cell].concat(inside.filter((c) => c !== kind.cell)) : n;
  }
  return own.cell == null ? CELLS : CELLS.filter((c) => bandOf(c) === bandOf(own.cell));
}

console.log("hook — " + ANCHORS.length + " anchors, seeds " + SEEDS.join(",") + "\n");

/* ======================================================================
   1 · TEN REWRITES OF IRANIAN POP ARE TEN HOOKS
   ====================================================================== */
ok("iranpop: 10 rewrites, >= 8 distinct hooks and >= 5 distinct rhythms", () => {
  const lines = [], rhythms = [];
  console.log("\n  the ten readings of iranpop — rhythm, then step:degree\n");
  for (let s = 1; s <= 10; s++) {
    const d = P.genreToDocument("iranpop", s);
    const c = hookOf(d);
    lines.push(hookLine(c)); rhythms.push(rhythmOf(c));
    console.log("    seed " + String(s).padStart(2) + "  key " +
                String(d.alphabet.key).padStart(3) + "  " +
                rhythmOf(c).replace(/r/g, ".") + "   " + hookLine(c));
  }
  console.log("");
  const dh = new Set(lines).size, dr = new Set(rhythms).size;
  console.log("    distinct hooks " + dh + "/10   distinct rhythms " + dr + "/10\n");
  assert(dh >= 8, "only " + dh + " distinct hooks in ten rewrites");
  assert(dr >= 5, "only " + dr + " distinct rhythms in ten rewrites — the ear " +
                  "names the rhythm, and half of ten is the floor");
});

/* ======================================================================
   2 · THE WHOLE CATALOG MOVES
   ======================================================================
   Not iranpop: every anchor in the box, across eight readings. The FRACTION
   is the number, because the bug was universal and a fix that reached one
   family would be the same bug on a shorter list.

   THE FIVE THAT DO NOT MOVE THEIR RHYTHM ARE NAMED, and named here rather
   than counted, because they are a DECISION: drone, dub, ambient, enka and
   arabesk each state `cell: "long"` on their own IDIOM_ANCHOR row, `long` is
   alone in its density band (two onsets in the bar — precompose §6b), and a
   band of one is a pin. A drone is a drone. They move on contour, landing and
   key like everything else. */
/* ...AND THE TWO GENEALOGY ROUNDS OF 2026-08-29 GREW THE BAND. The list below
   was five when the catalogue was 201; the rounds that took it to 282 seated
   ten more rows whose IDIOM_ANCHOR states `cell: "long"` BY ARGUMENT — a
   gagaku is a held court line, satie's refusal to develop IS the idiom,
   dubstep and gqom are the drone against the broken kick, modaljazz is
   bebop's opposite (space), triphop and chopped are dub's row at other
   tempos, cemilbey's taksim rises through a held line, gothicrock and
   psychrock carry the journey-out line. Same pin, same reason: `long` is a
   band of one. They move on contour, landing and key like everything else —
   the degree and key asserts below still hold them to that. The ratio assert
   also changed from a typed 0.95 to the DERIVED complement of this list,
   because a threshold that has to be re-typed every time the catalogue grows
   is a number waiting to be wrong. */
/* ...AND DEEP TIME ADDED FOUR (2026-08-30, measured, not guessed — the round's
   own candidate list named jiahu, seikilos and oxyrhynchus, and all three
   VARY: a three-note cell deals like any other however old the tune is. What
   freezes is what always freezes, the long cell: hohlefels (a bone flute's
   held tone in a cave), hurrian (the contested line held long), dreampop and
   doom (the two forward rows that argue for the drone's band). */
/* ...AND THE GOTH-AND-GLOBE ROUND ADDED TWO (2026-08-30) — and for once the
   round PREDICTED its own freezes: its handoff table warned that adopting
   nordicjazz's held ECM line and witchhouse's chopped-an-octave-darker row
   "will likely freeze its hook rhythm", and the measurement agreed exactly:
   those two froze, gypsyjazz and japanjazz (gallop, hang) did not. */
/* ...AND THE DOWNTEMPO ROUND ADDED THREE (2026-08-30): the round predicted
   kruderdorfmeister ("dub's own row — likely freeze") and it froze; tricky
   and lamb joined on the same law — the long cell is the freeze, whatever
   the contour and sentence do around it. massiveattack and djshadow, the
   two the prediction watched, did NOT freeze: riff and even deal on. */
/* ...AND THE HEARTH-AND-SCREEN ROUND ADDED TWO (2026-08-30), both predicted
   by the round itself, both long-cell: seannos (Joe Heaney's unmetered line)
   and miamivice (the mood synth is long-cell country, as the ask said). */
/* 26 -> 28, 2026-09-01, MEASURED and not guessed: `radiohead` and `fairuz`
   joined when the ten named acts got idioms of their own. Both take a two-
   onset figure — Radiohead's long falling line and Fairuz's long hovering one
   — and a hook with two onsets has no rhythm left to vary, which is exactly
   the property this list records. Measured the way the gate measures: eight
   seeds each, the document's own `play` string, and only these two changed.
   Nothing fell OUT of the list, which is the other half of the check. */
const FROZEN_RHYTHM = ["ambient", "arabesk", "cemilbey", "chopped", "doom",
                       "dreampop", "drone", "dub", "dubstep", "enka",
                       "fairuz", "gagaku", "gothicrock", "gqom", "hohlefels",
                       "hurrian", "kruderdorfmeister", "lamb", "miamivice",
                       "modaljazz", "nordicjazz", "psychrock", "radiohead",
                       "satie", "seannos", "tricky", "triphop", "witchhouse"];
ok("catalog: hook rhythm and degrees vary at nearly every anchor", () => {
  let rv = 0, dv = 0, kv = 0; const frozen = [];
  for (const g of ANCHORS) {
    const rs = new Set(), ds = new Set(), ks = new Set();
    for (const s of SEEDS) {
      const d = P.genreToDocument(g, s), c = hookOf(d);
      rs.add(rhythmOf(c)); ds.add(c.deg.join(",")); ks.add(d.alphabet.key);
    }
    if (rs.size > 1) rv++; else frozen.push(g);
    if (ds.size > 1) dv++;
    if (ks.size > 1) kv++;
  }
  const n = ANCHORS.length;
  console.log("\n    " + n + " anchors x " + SEEDS.length + " seeds");
  console.log("      hook RHYTHM varies   " + rv + "/" + n + "  " + (rv / n).toFixed(3));
  console.log("      hook DEGREES vary    " + dv + "/" + n + "  " + (dv / n).toFixed(3));
  console.log("      record KEY varies    " + kv + "/" + n + "  " + (kv / n).toFixed(3));
  console.log("      rhythm-frozen: " + (frozen.join(" ") || "none") + "\n");
  assert(n >= 50, "the sweep must cover at least 50 anchors, covered " + n);
  assert(rv === n - FROZEN_RHYTHM.length, "hook rhythm varies at " + rv +
         " of " + n + " anchors; expected all but the " + FROZEN_RHYTHM.length +
         " decided long-cell rows");
  assert(dv === n, "hook degrees frozen at " + (n - dv) + " anchors");
  assert(kv === n, "key frozen at " + (n - kv) + " anchors");
  assert.deepStrictEqual(frozen.slice().sort(), FROZEN_RHYTHM,
    "the rhythm-frozen list is a DECISION and it changed: " + frozen.join(" "));
});

/* ======================================================================
   3 · NOTHING BECAME A COIN TOSS
   ======================================================================
   The determinism law, asserted on the SERIALIZED document because that is
   what gets saved, shared and reloaded. Twice through, INTERLEAVED — the
   second pass runs after every other anchor has been composed, so a phrase
   cache keyed on too little (ideas-kit PHCACHE) fails here instead of in a
   browser three weeks from now. */
ok("determinism: same seed, byte-identical document, 20 anchors x 8 seeds", () => {
  const twenty = ANCHORS.filter((_, i) => i % Math.floor(ANCHORS.length / 20) === 0).slice(0, 20);
  const first = new Map();
  for (const g of twenty) for (const s of SEEDS) first.set(g + "/" + s, J(P.genreToDocument(g, s)));
  let n = 0;
  for (const g of twenty) for (const s of SEEDS) {
    const again = J(P.genreToDocument(g, s));
    assert.strictEqual(again, first.get(g + "/" + s), g + " seed " + s + " is not deterministic");
    n++;
  }
  console.log("    " + twenty.length + " anchors, " + n + " documents, all byte-identical on re-composition");
});

/* ======================================================================
   4 · AN ANCHOR KEEPS WHAT IT SAID ABOUT ITSELF
   ======================================================================
   IDIOM_ANCHOR is 54 rows of an anchor stating what ITS music is, and §6b
   binds each word differently: a stated `contour` is PINNED (the gesture),
   a stated `cell` binds its DENSITY BAND (the figure — "the 303 is a
   sixteenth-note machine" is a claim about density, not a serial number),
   a stated `land` is OPEN (a bop head that resolves to the root is still a
   bop head), and a stated `len`, `sent` or `reg` cannot reach a one-bar cell
   at all.

   READ BACK OFF THE ARTIFACT. This does not ask precompose what it drew: it
   builds every cell the anchor is ALLOWED to produce — the legal space —
   and asserts the cell in the document is one of them. A contour that leaked
   past its pin, or a cell that left its band, lands outside that space. The
   space is reported next to the full 10 x 8 x 5 = 400 so it is visible that
   the gate is constraining something. */
ok("idiom respect: every stated axis holds in every slot at every reading", () => {
  assert.strictEqual(P.CELL_BAR_CEILING, 1, "this gate reads one-bar cells");
  const cb = 1, steps = 16;
  const CONT = Object.keys(Id.CONTOURS), LAND = Object.keys(Id.LANDINGS);
  const rows = Object.keys(P.IDIOM_ANCHOR).filter((g) => ANCHORS.includes(g));
  // EVERY SLOT, not only the hook: a KIND's own word pins every axis it
  // states, so `riff`, `pad` and `climb` are the tightest cases in the box
  // and skipping them would leave the pin untested where it matters most.
  const spaceCache = new Map();
  const spaceFor = (g, k) => {
    const ck = g + "/" + k;
    if (spaceCache.has(ck)) return spaceCache.get(ck);
    const own = P.IDIOM_ANCHOR[g], G = GENRES[g], row = P.idiomOf(g).row;
    const kind = P.KINDS[k] || {};
    // THE FIGURE is `cellPool` above — a kind's word bands as wide as the
    // bands either side of it since 2026-08-27, an anchor's word as wide as
    // its own. What still PINS a slot is its GESTURE: a `contour` stated by
    // the kind is one value, always, which is what keeps a pad a pad.
    /* ...AND THE SEQUENCER'S GESTURE IS A BAND, NOT A VALUE (2026-08-31).
       Paul: "arps should do different arp things and have little exceptions.
       Not just up and down." So `seq` may draw any of the arpeggio contours
       and an anchor says which with `seqArp` — moroder pedals the octave
       because that is I Feel Love, acid leaps because that is a 303,
       berlinschool turns because those cycles are long.

       THIS IS THE SAME SHAPE THE `cell` CASE ABOVE ALREADY HAS, and it is not
       a hole: the pin exists so that "a pad stays a pad", and every member of
       this band climbs a CHORD rather than walking the scale, so a sequencer
       stays a sequencer under all six. What would break the pin is `seq`
       drawing `fall` or `hover`, and this still fails that. The list is
       ideas-kit's own export, not a copy — the fence cannot drift from the
       vocabulary it fences. */
    const pool = (f, all) => f === "cell" ? cellPool(g, k)
      : (k === "seq" && f === "contour") ? Id.ARP_CONTOURS
      : kind[f] != null ? [kind[f]]
      : own[f] == null ? all
      : f === "contour" ? [own[f]]
      : all;                                          // `land` is open
    // ...AND THE RELEASE IS AN AXIS OF THE COMPOSED CELL (2026-08-28,
    // precompose §6c). The last onset of a figure has no next onset, so its
    // length was the whole rest of the bar and 84.7% of the catalogue ended on
    // its longest note. `RELEASE` is the word for how that note stops — `ring`
    // is that old law and still the commonest draw, `clip` and `lean` are the
    // two ways a figure ends short — and a record deals it per part on its own
    // stream. It is NOT a claim an IDIOM_ANCHOR row makes about itself (no
    // anchor states one), so it is unconstrained here: every anchor may draw
    // every word, and the space this gate fences has to contain all three or it
    // is fencing the day before the deal landed.
    const legal = new Set();
    const RELS = [null].concat(Object.keys(P.RELEASE).map((w) => ({ rel: w })));
    for (const c of pool("cell", CELLS))
      for (const ct of pool("contour", CONT))
        for (const l of pool("land", LAND))
          for (const rl of RELS)
            legal.add(J(P.cellOf(row, k, cb, G, steps,
                                 { cell: c, contour: ct, land: l }, rl).cell));
    spaceCache.set(ck, legal);
    return legal;
  };
  let checked = 0, spaceSum = 0, spaces = 0;
  const bandBust = [];
  for (const g of rows) {
    const own = P.IDIOM_ANCHOR[g];
    for (const s of SEEDS) {
      const cells = P.genreToDocument(g, s).material.cells;
      for (const k of Object.keys(cells)) {
        const c = cells[k];
        if (c.kind !== "line") continue;              // the kit is not a phrase
        // ...AND A DEVELOPED RETURN IS NOT A SLOT (2026-08-28, precompose §6c).
        // A record now carries the part's figure AS STATED under the slot's own
        // name and, beside it, the figure as it comes back — "hook stretched
        // out", "riff cut short" — which is BY CONSTRUCTION outside the space a
        // reading may draw from: development is what happens to a figure after
        // the reading has chosen it, and a return that stayed inside the draw
        // would not be a development. The claim this gate makes is about the
        // SLOT, and the slot is the statement; the developed cells are fenced
        // where they are made (`keepsIts`: two onsets or more, a rest left in
        // the bar, and a density within a doubling of the statement's).
        if (!P.KINDS[k]) continue;
        const legal = spaceFor(g, k);
        assert(legal.has(J(c)), g + " seed " + s + " slot " + k + " composed a cell " +
               "outside what its IDIOM_ANCHOR row allows (" + J(own) + ")");
        // ...and the DENSITY claim, said in the document's own units. It is a
        // SET of bands now and not one word: a kind's figure may sit in the
        // band either side of its own, and the anchor's band is the fence
        // around that when the anchor has one.
        const want = new Set(cellPool(g, k).map(bandOf));
        const got = bandOfCell(c);
        if (!want.has(got)) bandBust.push(g + "/" + s + "/" + k + " " + got +
          " not in " + [...want].join("|"));
        checked++;
      }
    }
  }
  for (const v of spaceCache.values()) { spaceSum += v.size; spaces++; }
  assert.deepStrictEqual(bandBust.slice(0, 6), [], "cells left their density band");
  console.log("    " + rows.length + " anchor rows x " + SEEDS.length + " seeds = " +
              checked + " line cells, every one inside its own row's legal space");
  console.log("    mean legal space " + (spaceSum / spaces).toFixed(1) +
              " distinct cells per (anchor, slot), against 400 unconstrained\n");
});

/* ======================================================================
   5 · A RECORD ALREADY WRITTEN DOWN DOES NOT MOVE
   ======================================================================
   Reading variation happens at COMPOSE time. songs.js TERMS is the shipped
   chant — a document somebody wrote down, not a genre somebody composed —
   and no seed exists anywhere on its path. The risk is not that precompose
   edits it; the risk is the SHARED PHRASE CACHE: `Id.toPhrase` is memoised
   across the whole process, so a reading that composed a phrase under a key
   too narrow to tell two readings apart would hand the saved record somebody
   else's tune. So the saved record is rendered BEFORE any composition, then
   again after 199 anchors x 4 readings have gone through the same cache, and
   the two renders must be the same bytes. */
ok("old records: songs.js TERMS renders byte-identical before and after 796 readings", () => {
  const doc = NuSongs.TERMS;
  const render = () => {
    const out = [];
    doc.form.sections.forEach((sec, i) => {
      const g = Doc.toGenre(doc, i, GENRES);
      const lines = doc.voices.filter((v) => v.kind === "line");
      for (const c of lines) {
        const ph = Doc.toPhrase(doc, Doc.materialAt(c, sec.id));
        out.push(sec.id + "/" + c.name + "/" + J(ph));
      }
      out.push(sec.id + "/genre/" + J(g.mode) + "/" + g.bpm);
    });
    return out.join("\n");
  };
  const before = render(), beforeDoc = J(doc);
  let n = 0;
  for (const g of ANCHORS) for (const s of [1, 2, 3, 4]) { P.genreToDocument(g, s); n++; }
  const after = render();
  assert.strictEqual(sha(after), sha(before),
    "the shipped chant rendered differently after " + n + " compositions");
  assert.strictEqual(J(doc), beforeDoc, "composition mutated a saved document");
  console.log("    chant render " + sha(before) + " before, " + sha(after) +
              " after " + n + " compositions; the saved document is unmoved");
  // ...and a precomposed record, SAVED, is the same when it is loaded again:
  // a document is a value, and a reading is not stored inside it anywhere.
  const saved = J(P.genreToDocument("iranpop", 7));
  const reloaded = JSON.parse(saved);
  assert.strictEqual(J(reloaded), saved, "a saved document did not survive a round trip");
});

/* ======================================================================
   6 · EVERY SLOT MOVES, NOT ONLY THE HOOK
   ======================================================================
   Paul, on staging, the day §1 shipped: *"I clicked rewrite multiple times and
   never saw a different seed, and the 'topline' is the same as always for
   tehran 1974."* Measured, and he was right twice: over four presses the
   topline's RHYTHM never moved and exactly one degree changed. §1 asks the
   question of slot 0 only, and the answer for the other eight slots was no —
   six of the nine KINDS state a `cell`, `cell` is the only idiom word that
   reaches the play row at a one-bar cell, and a stated word was a pin.

   THE FLOOR IS THREE DISTINCT RHYTHMS IN EIGHT READINGS, per generated slot,
   and it is a floor and not a count: what an ear is owed is that a second
   press is a second tune, and three different figures in eight presses is the
   smallest number that cannot be one figure with an accident in it.

   UNLESS ITS ANCHOR PINS IT — and a pin here is a POOL OF ONE, computed the
   same way §4 computes the legal space, never a name typed into a list. A
   drone's pad is `long` at every reading because "a drone is a drone", and
   this gate must say that in the same units the code does. */
ok("iranpop: every generated slot shows >= 3 distinct rhythms in 8 readings", () => {
  // the per-slot table, off the ARTIFACT: the document's own `play` rows
  const table = (g) => {
    const seen = new Map(), n = new Map();
    for (const s of SEEDS) {
      const cells = P.genreToDocument(g, s).material.cells;
      for (const k of Object.keys(cells)) {
        const c = cells[k];
        if (c.kind !== "line") continue;
        if (!seen.has(k)) seen.set(k, new Set());
        seen.get(k).add(rhythmOf(c));
        n.set(k, (n.get(k) || 0) + 1);
      }
    }
    return { seen, n };
  };

  const { seen, n } = table("iranpop");
  console.log("\n  iranpop, 8 readings — distinct RHYTHMS per slot\n");
  console.log("    slot        readings  pool  distinct   the rhythms");
  const short = [];
  for (const k of Object.keys(P.KINDS)) {
    if (!seen.has(k)) continue;
    const ps = cellPool("iranpop", k).length, d = seen.get(k).size;
    console.log("    " + k.padEnd(11) + String(n.get(k)).padStart(6) +
                String(ps).padStart(6) + String(d).padStart(8) + "     " +
                [...seen.get(k)].map((r) => r.replace(/r/g, ".")).join("  "));
    if (ps > 1 && d < 3) short.push(k + " " + d);
  }
  console.log("");
  assert.deepStrictEqual(short, [], "slots stuck on one or two rhythms: " + short.join(", "));
  // ...and the slot Paul named, by name, so this cannot pass on the others
  assert(seen.has("topline"), "iranpop stopped dealing a topline — this gate is about that slot");
  assert(seen.get("topline").size >= 3,
    "the topline moved to only " + seen.get("topline").size + " rhythms in eight readings");

  /* AND THE WHOLE CATALOG, as a fraction. A pool of three drawn eight times
     misses one of its three about four times in a hundred, so this is a
     fraction and not a floor — an honest number, measured at 0.975 the day it
     was written (1610 slots over 199 anchors; 22 pinned by an anchor row, 114
     dealt in fewer than six of the eight readings and therefore too thin to
     judge). */
  let pairs = 0, bad = 0, pinned = 0, thin = 0;
  const byKind = new Map();
  for (const g of ANCHORS) {
    const t = table(g);
    for (const k of t.seen.keys()) {
      if (cellPool(g, k).length < 2) { pinned++; continue; }
      if (t.n.get(k) < 6) { thin++; continue; }
      pairs++;
      if (t.seen.get(k).size < 3) { bad++; byKind.set(k, (byKind.get(k) || 0) + 1); }
    }
  }
  const frac = 1 - bad / pairs;
  console.log("    " + ANCHORS.length + " anchors: " + pairs + " judgeable slots, " +
              bad + " under three rhythms — " + frac.toFixed(3));
  console.log("      pinned by an anchor " + pinned + ", dealt too rarely to judge " + thin);
  console.log("      short by kind: " + (JSON.stringify(Object.fromEntries(byKind)) || "{}") + "\n");
  assert(frac >= 0.95, "only " + frac.toFixed(3) + " of slots reach three rhythms in eight readings");
});

console.log("\n" + (fail ? "FAIL " + fail + " / " : "") + pass + " passed");
process.exit(fail ? 1 : 0);

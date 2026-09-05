// nukernel/export/smf.js — the record's score, written out as a Standard MIDI
// File. SMF type 1, one track per voice.
//
// ITS ONE IMPORT IS A NUMBER AND A FALLBACK, NOT A LIBRARY (2026-09-05, the
// portamento-to-MIDI round). This file said "dependency-free" and that was a
// claim about bytes rather than about arithmetic: writing the chair's
// portamento means knowing the row's own fence (0..500 ms) and the one line
// that resolves `tone.slide` against `tone.glide`, and both of those already
// have an owner in audio/to-engine.js. A second copy here would be the drift
// this repo has a law against, so `glideSeconds` is imported. ui/eight.js
// already imports both modules statically, so the page pays nothing, and
// to-engine.js itself imports nothing at all.
//
// THE .MID IS THE PLAYED RECORD NOW — A REVERSAL, DATED 2026-08-30. This
// header read: *"over the page's OWN score note list (ui/eight.js
// buildScore() → toScore().voices — the same fold the engraving and the piano
// roll draw, so the .mid can never disagree with the staff; attribute-grammar
// law, one owner per note)"*. That was true and it was the wrong record to
// ship: Paul, listening to the export against the speakers — "My guess is
// you're not capturing these timing subtleties with MIDI export" — and the
// measurement agreed: iranpop's hook holds 112 played events, 23 of them
// ornaments, 74 on fractional onsets, and the notated fold carried none of
// the ornaments and quantized every onset to the step grid. The .als round
// had already ruled on this exact question, in export/als-page.js pageScore:
// *"`buildScore()` is the NOTATED record — what the staff draws …
// `plan.timeline()` is the PLAYED record: register home applied, groove and
// swing and humanize already warped into `off` … A Live set is a session you
// press play on, so it takes the played one."* A .mid is a session another
// DAW presses play on, so it takes the played one too — ONE fold
// (export/score.js scoreOf), two writers (als.js and smfFromScore below), the
// .als precedent verbatim. Ornaments are real notes at their real offsets and
// TPQ 480 carries a tenth of a bar without rounding it away. The staff keeps
// buildScore() — engraving is what notation is FOR — and `writeSmf` still
// takes a step-grid score, so a notated export remains one call away; the
// BUTTON's default is played, because the button is next to the speakers.
//
// THE TOM FIX LIVES HERE, IN THE EXPORT LAYER, ON PURPOSE. FUTURE.md names the
// defect: audio/to-engine.js folds the three tom lanes t/m/l onto the parent's
// ONE `tom` unit (distinguished only by pitch in Hz), so a naive export
// through the engine's own mapping would write every tom as the same GM key —
// "tomHi/tom/tomLo all mapping to GM 47". The ENGINE's mapping is not touched
// this wave (it is how the record sounds); the EXPORT maps each lane to its
// own General MIDI key below, so the file a DAW opens has three toms where the
// record has three lanes: t → 50 (High Tom), m → 47 (Low-Mid Tom),
// l → 45 (Low Tom).
//
// EXTRACTION, NEVER BY HAND. The score writes a drum hit as a NOTEHEAD string
// (ui/eight.js SCOREHEAD: lane letter → staff position), so the caller hands
// that table in and `headGM` FOLDS it against LANE_GM — notehead → GM key —
// rather than anyone typing a second copy of the staff. Where two lanes share
// a notehead (snare/rim/clap are all written at the snare; closed and open hat
// share the x-head) the score itself has already merged them, and the first
// lane in the score's own table order wins — the file says what the staff
// says, which is the contract.

import { glideSeconds, GLIDE_MAX } from "../audio/to-engine.js";

/* ---------- THE PORTAMENTO CONTROLLERS (2026-09-05) -----------------------
   Paul, of the round that put the slide in the box: "We are missing a big
   thing: Portamento. Everywhere, voices, synths, and so forth… Think TB 303!"
   The box got it — `sld` on the phrase, `tone.glide`/`tone.slide` on the row,
   twenty modules that slew, a knob on the sheet — and the .mid, which is the
   file a 303 line actually travels in, said nothing. MEASURED before this:
   thumri (glide 20 ms, slide 160 ms, 188 slid events of 1556) exported 12,938
   bytes carrying ZERO control changes.

   MIDI HAS THE THREE WORDS ALREADY, and they are the three the box says:

     CC65  portamento ON/OFF     — >= 64 is on. WHICH notes slide.
     CC5   portamento TIME       — HOW LONG.
     CC84  portamento CONTROL    — WHERE FROM: the value is the source key,
                                   and the next note-on glides from it. This
                                   is `e.prev` and nothing else.

   CC5 HAS NO UNIT IN THE SPEC — every synth reads its own curve off 0..127 —
   so this file states the one it writes rather than leaving a reader to
   guess: CC5 is LINEAR over the ROW'S OWN FENCE, 0 = instant and 127 =
   `GLIDE_MAX` (500 ms, audio/to-engine.js, which is state-engine GLIDE_MAP's
   own ceiling said in seconds). A record that writes any portamento byte also
   writes that sentence into a 0x01 text meta, the way the any-meter round
   states a signature the format cannot spell.

   WHY A STATE AND NOT A FLAG PER NOTE. CC65 is a channel state, so the file
   says it the way the tempo map and the level lane already do — at tick 0,
   and again only where it CHANGES. A chair whose `slide` equals its `glide`
   (which is what a row that names only `glide` resolves to) therefore writes
   two bytes at the top and nothing else, and a 303 line writes one pair per
   slid run. */
export const PORTA_CC = { on: 65, time: 5, from: 84 };

/** Seconds -> CC5. Linear over the row's own 0..GLIDE_MAX fence; see above. */
export const ccOfSeconds = (sec) => Math.max(0, Math.min(127,
  Math.round((127 * Math.max(0, +sec || 0)) / GLIDE_MAX)));

/**
 * A voice's portamento control changes, from its notes and its chair's tone.
 *
 * `notes` are writeSmf's own — `{at, len, midi, sld?, from?}`, in score steps.
 * `tone` is the genre's tone block (export/score.js puts it on the lane).
 * Returns `[]` for a chair whose row declares NEITHER `glide` nor `slide`,
 * which is the absent-law: such a record's bytes are the bytes it had
 * yesterday, and every row in the catalogue but the 24 the portamento round
 * wrote is in that case.
 */
export function portamentoCCs(notes, tone) {
  const G = glideSeconds(tone);
  if (!G.any) return [];
  const base = { on: G.glide > 0 ? 127 : 0, time: ccOfSeconds(G.glide) };
  const slid = { on: 127, time: ccOfSeconds(G.slide) };
  // THE SLID RUNS, MERGED. Two slid notes back to back are one state, not two
  // — a restore between them would be a byte that turns the gesture off inside
  // itself. Adjacency is measured on the notes' own spans.
  const runs = [];
  // SORTED HERE RATHER THAN ASSUMED. The fold hands these over in time order
  // today, and an upbeat is a negative time riding in the previous box
  // (document.js formWalk), so "in order" is a property of the caller and not
  // of the shape. A merge over an unsorted list would leave a state switched
  // the wrong way round once writeSmf sorts the events by tick.
  const marked = (notes || []).filter((n) => n.sld).sort((x, y) => x.at - y.at);
  for (const n of marked) {
    const a = n.at, b = n.at + Math.max(1 / 32, n.len);
    const last = runs[runs.length - 1];
    if (last && a <= last[1] + 1e-9) last[1] = Math.max(last[1], b);
    else runs.push([a, b]);
  }
  // the chair's own knob, said outright at the top of the track
  const out = [{ at: 0, cc: PORTA_CC.on, val: base.on },
               { at: 0, cc: PORTA_CC.time, val: base.time }];
  let cur = base;
  const state = (at, want) => {
    if (want.on !== cur.on) out.push({ at, cc: PORTA_CC.on, val: want.on });
    if (want.time !== cur.time) out.push({ at, cc: PORTA_CC.time, val: want.time });
    cur = want;
  };
  for (const [a, b] of runs) { state(a, slid); state(b, base); }
  // ...AND WHERE THE RECORD KNOWS WHAT THE NOTE SLID FROM, IT SAYS SO. CC84 is
  // a one-shot addressed to the note-on after it, so it is written at the slid
  // note's own tick and never coalesced. `ord` puts it last of the three, so a
  // reader has the time and the switch before it is told the source key.
  for (const n of marked) {
    if (n.from == null) continue;
    const from = Math.round(n.from);
    if (!isFinite(from) || from < 0 || from > 127 || from === Math.round(n.midi)) continue;
    out.push({ at: n.at, cc: PORTA_CC.from, val: from, ord: 1.7 });
  }
  return out;
}

/** The sentence a file with portamento in it carries, so CC5 has a unit. */
export const PORTA_SAY = "portamento: CC65 on/off, CC5 time 0..127 linear over " +
  "0.." + Math.round(GLIDE_MAX * 1000) + " ms, CC84 the key the note slides from";

/* ---------- the export layer's drum map (GM percussion key numbers) ------- */
export const LANE_GM = {
  k: 36,   // Bass Drum 1
  s: 38,   // Acoustic Snare
  p: 37,   // Side Stick (rim)
  c: 39,   // Hand Clap
  h: 42,   // Closed Hi-Hat
  o: 46,   // Open Hi-Hat
  f: 44,   // Pedal Hi-Hat
  r: 51,   // Ride Cymbal 1
  x: 49,   // Crash Cymbal 1
  t: 50,   // High Tom      — DISTINCT (the engine folds these three onto one
  m: 47,   // Low-Mid Tom   —  unit; the export does not: FUTURE.md, the toms)
  l: 45,   // Low Tom
};

/** Fold the score's own notehead table (lane → head string) against LANE_GM:
 *  head string → GM key. First lane wins a shared head, in the table's own
 *  order — exactly the merge the engraving already made. */
export function headGM(scorehead) {
  const out = {};
  for (const [lane, head] of Object.entries(scorehead || {})) {
    if (LANE_GM[lane] != null && !(head in out)) out[head] = LANE_GM[lane];
  }
  return out;
}

/* ---------- the writer ---------------------------------------------------- */
const TPQ = 480;                       // ticks per quarter note (the division)

const vlq = (n) => {                   // variable-length quantity
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const str = (s) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];

// one note's pitches, as GM key numbers. A score note's `midi` is a number,
// a chord (number[]), or — on the percussion staff — notehead strings the
// drum map resolves. Unmappable heads are dropped and counted, never guessed.
function keysOf(midi, perc, drumMap, dropped) {
  const list = Array.isArray(midi) ? midi : [midi];
  const out = [];
  for (const m of list) {
    // NEAREST, not truncated (2026-08-30, the pitch wall): a microtonal note
    // (fractional MIDI, cents carried in the record) quantizes HONESTLY to the
    // nearest GM key — `| 0` floored 62.6 to 62, a wrong note, not a rounding.
    // Integers round to themselves, so every existing .mid is byte-identical.
    // Deliberately NO pitch-bend lane: one bend wheel per channel cannot say
    // per-note cents on chords, and the .mid is a 12-TET creature by contract.
    if (typeof m === "number" && isFinite(m)) out.push(Math.max(0, Math.min(127, Math.round(m))));
    else if (typeof m === "string" && perc && drumMap && drumMap[m] != null) out.push(drumMap[m]);
    else if (m != null) dropped.push(m);
  }
  return out;
}

/**
 * writeSmf(score, opts) -> Uint8Array — SMF type 1.
 *   score: { bpm, beatsPerBar, stepsPerBar, voices: [{ name, clef,
 *            notes: [{ at, len, midi }] }] }   (at/len in score steps)
 *          + timesig: [nn, dd]      — the declared signature (3/4, 6/8); absent
 *            = the old bpb/4 meta, byte for byte (2026-08-30, the tempo map:
 *            twelve steps reduce to 3/4 and only ever to 3/4, so a 6/8 record
 *            must SAY so — the same argument as ui/abc.js meterOf)
 *          + tempos: [{ at, bpm }]  — set-tempo metas at `at` (score steps),
 *            for the paced record; absent = the one conductor tempo, byte for
 *            byte. A tempo at step 0 lands AFTER the base tempo on the same
 *            tick, so a record whose first section is paced starts at its own
 *            pace and a DAW still sees the record's one bpm behind it.
 *          + exprs: [{ at, val }]   — expression CCs (CC11, 0..127) at `at`
 *            (score steps), written on EVERY voice's channel because the
 *            section level they carry is a whole-section gain
 *            (audio/desk.js sectionOf — one multiplier over the section, not
 *            a per-voice trim). Off before on at the same tick, so the level
 *            lands under the downbeat and never clips the note leaving.
 *            Absent = no bytes, byte for byte (2026-08-30, the dynamics
 *            round: velocities carry `env`, this lane carries `lvl` — the
 *            half the file never spoke).
 *          + texts: [string]        — extra 0x01 text metas at tick 0, after
 *            the signature and before the tempo. The portamento sentence
 *            (PORTA_SAY) rides one, because CC5 has no unit in the spec.
 *            Absent = no bytes, byte for byte.
 *          + voices[].ccs: [{ at, cc, val, ord? }] — control changes on THAT
 *            voice's own channel, `at` in score steps. `ord` defaults to 1.6,
 *            which is after the note-offs (1) and the section level (1.5) and
 *            before the note-ons (2): a portamento switch has to be standing
 *            before the note it is about arrives. Absent = no bytes.
 *   opts:  { drumMap }  — head string → GM key (see headGM)
 */
export function writeSmf(score, opts = {}) {
  const bpm = Math.max(1, +score.bpm || 120);
  /* THE BEATS ARE NOT ROUNDED (2026-09-05, the any-meter round). This read
     `Math.round(+score.beatsPerBar)`, which is the identity on 4, 3 and every
     signature whose bar is a whole number of quarters — and a 7/8 bar is 3.5
     quarters and a 21/17 bar is 4.941, so rounding put every tick in the file
     1.2% to 14% out. `tickPerStep` takes the true number; the SIGNATURE
     fallback below still needs a whole one and takes its own. */
  const bpb = Math.max(0.0625, +score.beatsPerBar || 4);
  const bpbInt = Math.max(1, Math.round(bpb));
  /* ...AND NEITHER ARE THE STEPS (2026-09-05, the second half of the round).
     This read `Math.round(+score.stepsPerBar || 16)` and every page caller
     passes the bar's QUARTERS for both numbers (ui/eight.js:
     `beatsPerBar: beatsPerBar()`, and smfFromScore hands the same number
     down as stepsPerBar) — so a 7/8 bar arrived as 3.5 quarters over
     round(3.5) = 4 steps and every note in the file landed 12.5% early.
     MEASURED, before: a 7/8 record's last note ended at 33.85 s where the
     record puts it at 38.68 s. A step count is a count wherever a caller
     really has one (16 steps, 12 steps) and rounding never touched those. */
  const spb = Math.max(0.0625, +score.stepsPerBar || 16);
  // a bar is `spb` steps AND `bpb` quarters, so one step is this many ticks:
  let tickPerStep = (TPQ * bpb) / spb;
  const drumMap = opts.drumMap || {};
  const dropped = [];

  const track = (events) => {
    // events: [{ tick, bytes:[...] }] — sorted, then delta-encoded
    events.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
    const body = [];
    // ROUND THE TICK, THEN DELTA (2026-08-30). This encoded
    // `round(e.tick - last)` with `last = round(e.tick)`, which is exact on an
    // integer grid and drifts ±1 tick on the played record's fractional
    // onsets (the sum of rounded deltas is not the rounded sum). Rounding the
    // absolute tick first makes every parsed position exactly
    // `round(e.tick)`, which is what the parse-back gate compares.
    let last = 0;
    for (const e of events) {
      const tk = Math.max(last, Math.round(e.tick));
      body.push(...vlq(tk - last), ...e.bytes);
      last = tk;
    }
    body.push(0x00, 0xff, 0x2f, 0x00);                       // end of track
    return [...str("MTrk"), ...u32(body.length), ...body];
  };

  // conductor track: time signature + tempo, at tick 0 — and the tempo MAP
  // after them, when the record has one (2026-08-30). The signature is the
  // DECLARED one where a caller declares it (nn over dd, dd as its power of
  // two the way 0x58 spells it) and the old bpb/4 otherwise, so every record
  // written before this line is byte-identical.
  const tempoBytes = (b) => { const u = Math.round(60e6 / Math.max(1, b));
    return [0xff, 0x51, 0x03, (u >> 16) & 255, (u >> 8) & 255, u & 255]; };
  const ts = Array.isArray(score.timesig) && score.timesig.length === 2 &&
             score.timesig[0] > 0 && score.timesig[1] > 0 ? score.timesig : null;
  /* A SIGNATURE THIS FORMAT CANNOT SPELL, AND A TEMPO IT CANNOT HOLD
     (2026-09-05, rewritten in the second half of the round). Two walls, one
     answer, and the answer is that THE BAR KEEPS ITS SECONDS:

       0x58 stores the denominator as its LOG — one byte meaning 2^dd — so 17
       is not a number this format has;
       0x51 stores microseconds per quarter in THREE bytes — 16.78 s is the
       longest quarter — so 1 BPM in four-four (a 60 s quarter) is not a
       number it has either. MEASURED, before: a 4/4 record at 1 BPM came out
       of the writer implying 38.7 s bars where it means 240.

     Both are walls on WHAT A QUARTER IS, so both come down the same way: the
     file gets to call a different note value "the quarter". We write the
     nearest power of two to the true denominator, halving it (and, if that
     runs out at 1/1, doubling the numerator) until the tempo fits — and then
     scale BOTH the tick length and the tempo by the same factor, so the bar
     a DAW draws off the file lasts exactly n × (240/d) / bpm seconds and
     every note inside it lands at the second the record puts it.

     A 21/17 record at 76 BPM is written 21/16 at 80.75 BPM; a 4/4 record at
     1 BPM is written 4/1 at 4 BPM. Neither is a lie the file tells silently:
     a 0x01 text meta at tick 0 states the true signature and the true tempo.
     WHERE THE FORMAT CAN SAY IT — every power-of-two denominator up to 32 at
     any tempo down to about 4 BPM, which is every record ever exported — the
     scale is exactly 1, no text meta is written, and the bytes are the old
     bytes. */
  const pow2Near = (d) => Math.pow(2, Math.max(0, Math.round(Math.log2(Math.max(1, d)))));
  const USPQ_MAX = 0xffffff;                 // three bytes of microseconds
  // the numerator as it is, for now — the byte it has to fit in is a fence at
  // the END of this, after halving has had its chance (see below)
  let sigN = ts ? Math.max(1, ts[0] | 0) : bpbInt;
  let sigD = ts ? pow2Near(ts[1]) : 4;
  // how many file quarters the bar is drawn as, over how many it truly lasts
  const trueQ = ts ? (4 * ts[0]) / ts[1] : bpbInt;
  const scaleOf = () => ((4 * sigN) / sigD) / trueQ;
  while (60e6 / Math.max(1e-9, bpm * scaleOf()) > USPQ_MAX && sigD > 1) sigD /= 2;
  while (60e6 / Math.max(1e-9, bpm * scaleOf()) > USPQ_MAX && sigN * 2 <= 255) sigN *= 2;
  // ...and the numerator is ONE BYTE. Halving both numbers is the identity on
  // what the bar means (12/8 drawn as 6/4 is the same length), so a numerator
  // past 255 comes down that way before anything is given up.
  while (sigN > 255 && sigD > 1 && sigN % 2 === 0) { sigN /= 2; sigD /= 2; }
  const scale = scaleOf();
  tickPerStep *= scale;
  const drawN = Math.min(255, Math.round(sigN));
  const sig = [drawN, Math.round(Math.log2(sigD)) & 255, 24, 8];
  const trueSig = ts ? ts[0] + "/" + ts[1] : null;
  const said = scale !== 1 || drawN !== sigN || (ts && (sigN !== ts[0] || sigD !== ts[1]));
  // ASCII ONLY, because a 0x01 meta is bytes and a reader may take them as
  // Latin-1: anything else is dropped rather than written as half a character.
  // ...AND THE SENTENCE SAYS WHICH OF THE TWO THINGS IS TRUE. A numerator past
  // 255 with an odd count (999/1) cannot be halved into the byte and cannot be
  // drawn at all: the notes still land at the second the record puts them, and
  // the file says that rather than claiming a bar it did not keep.
  const kept = Math.abs((4 * drawN) / sigD - trueQ * scale) < 1e-9;
  const textMeta = (txt) => { const b = txt.split("")
      .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127)
      .map((c) => c.charCodeAt(0));
    return [0xff, 0x01, ...vlq(b.length), ...b]; };
  const sayBytes = () => { const txt = ("meter " + (trueSig || bpbInt + "/4") +
      " at " + (Math.round(bpm * 1000) / 1000) + " BPM - written " + drawN + "/" + sigD +
      " at " + (Math.round(bpm * scale * 1000) / 1000) + " BPM" +
      (kept ? " so the bar keeps its length"
            : "; the numerator does not fit one byte, so the bar lines are short " +
              "and only the note times are the record's"));
    return textMeta(txt); };
  const t0 = track([
    { tick: 0, ord: 0, bytes: [0xff, 0x58, 0x04, ...sig] },
    ...(said ? [{ tick: 0, ord: 0.5, bytes: sayBytes() }] : []),
    ...(score.texts || []).map((t, i) => (
      { tick: 0, ord: 0.6 + i * 1e-3, bytes: textMeta(String(t)) })),
    { tick: 0, ord: 1, bytes: tempoBytes(bpm * scale) },
    ...(score.tempos || []).map((t, i) => (
      { tick: t.at * tickPerStep, ord: 2 + i, bytes: tempoBytes(t.bpm * scale) })),
  ]);

  const tracks = [t0];
  let chan = 0;
  for (const v of score.voices || []) {
    const perc = /^perc/.test(v.clef || "");
    let ch;                                    // perc lives on 10 (0-indexed 9);
    if (perc) ch = 9;                          // everyone else takes the next
    else { if (chan === 9) chan++; ch = chan % 16; chan++; }   // free channel

    const evs = [{ tick: 0, ord: 0, bytes: [0xff, 0x03, String(v.name || "").length,
                                            ...str(String(v.name || ""))] }];
    // the record's section levels, said on this channel too — ord 1.5 sits
    // between the note-offs (1) and the note-ons (2) on the boundary tick
    for (const x of score.exprs || [])
      evs.push({ tick: x.at * tickPerStep, ord: 1.5,
                 bytes: [0xb0 | ch, 11, Math.max(0, Math.min(127, x.val | 0))] });
    // ...and this voice's own control changes (the portamento lane, above)
    for (const c of v.ccs || [])
      evs.push({ tick: c.at * tickPerStep, ord: c.ord == null ? 1.6 : c.ord,
                 bytes: [0xb0 | ch, c.cc & 0x7f, Math.max(0, Math.min(127, c.val | 0))] });
    for (const n of v.notes || []) {
      const on = n.at * tickPerStep;
      // THE FLOOR MOVED WITH THE PLAYED RECORD (2026-08-30): it was
      // `Math.max(1, n.len)` — one whole STEP, right on a grid where a step
      // is the shortest thing the staff writes, and a lie on the played
      // record, where a grace lasts a fraction of a step and flooring it to
      // one would hold every ornament into its principal. 1/32 step is under
      // any audible note and above a zero-length that some players drop.
      // A notated caller's integer lens (always >= 1) pass through untouched.
      const off = (n.at + Math.max(1 / 32, n.len)) * tickPerStep;
      // the played record carries its written velocity (score.js
      // velOfWritten); a score without one keeps the old flat 96.
      const vel = Math.max(1, Math.min(127, Math.round(n.vel || 96)));
      for (const key of keysOf(n.midi, perc, drumMap, dropped)) {
        evs.push({ tick: on, ord: 2, bytes: [0x90 | ch, key, vel] });
        evs.push({ tick: off, ord: 1, bytes: [0x80 | ch, key, 0] });
      }
    }
    tracks.push(track(evs));
  }

  const head = [...str("MThd"), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(TPQ)];
  const bytes = new Uint8Array(head.length + tracks.reduce((s, t) => s + t.length, 0));
  let o = 0;
  bytes.set(head, o); o += head.length;
  for (const t of tracks) { bytes.set(t, o); o += t.length; }
  bytes.dropped = dropped.length;      // how many heads had no key (a gate reads it)
  return bytes;
}

/* ---------- the PLAYED record's writer (2026-08-30) ------------------------
   ONE FOLD, TWO WRITERS — the .als precedent (see the header's reversal).
   Takes export/score.js scoreOf()'s Score — the same value als.js splices
   into the donor — and flattens its boxes onto writeSmf's own dialect: one
   track per LANE (a lane's name is the cast's seat key, "v0"/"bass"/"drums",
   stable across boxes, so the same seat is the same track for the whole
   record), `at` in quarter-note beats made absolute against the first box,
   and stepsPerBar set equal to beatsPerBar so one writeSmf "step" IS one
   quarter — 480 ticks — and a played offset of a tenth of a bar lands on its
   own tick instead of a grid line. The drums lane's notes already carry GM
   key numbers (score.js put them through als.js GM_DRUM), so no drumMap; it
   is marked `perc` for channel 10. */
export function smfFromScore(score, { beatsPerBar = 4, timesig = null, levels = null } = {}) {
  const boxes = (score && score.boxes) || [];
  const beat0 = boxes.length ? boxes[0].beat0 : 0;
  const lanes = new Map();
  /* THE SECTION LEVEL LANE (2026-08-30, the dynamics round). MEASURED FIRST:
     of the two section dynamics the composer deals, `env` is already IN this
     file — kernel envelope multiplies the written velocities before the bar
     list exists, so every note arrives pre-shaped — and `lvl` never was: it
     is a desk gain (audio/desk.js sectionOf), and the header of
     export/score.js has always warned that folding a desk gain into velocity
     counts the fader twice. So the file gains the missing half AS a fader:
     one CC11 (expression) per boundary where the dealt level CHANGES, on
     every channel, because the desk's multiplier is section-wide. The WORD
     rides the Score (box.lvl, extracted by ui/derive.js from the composed
     section); the PRICE is the caller's copy of fields.js LEVELS — the same
     words/numbers split the desk itself keeps, and no second table here. GM's
     own expression law is gain ≈ (cc/ref)², inverted about ref 100 —
     cc = 100·√gain — so norm sits at 100 with headroom for fwd (+2.6 dB →
     116) instead of clipping at 127: hush 63 · back 84 · norm 100 · fwd 116.
     A record that deals no `lvl` word anywhere computes no lane and the
     bytes are the old bytes. */
  const worded = !!(levels && boxes.some((b) => b.lvl));
  const exprs = [];
  let curE = null;
  /* THE TEMPO MAP (2026-08-30, the five-walls follow-up). A paced section
     arrives from export/score.js scoreOf STRETCHED — audio/plan.js paceTL
     moved its beats so the SECONDS come out right at a constant tempo — and a
     .mid can say the truer thing: the notes at their written beat values and
     a set-tempo of bpm/k at the section's door (half a `half` bar's tempo,
     which is bpm × PACE_RATE[word], the ratio measured off the timeline as
     box.k rather than remembered from the table). So where any box carries a
     stretch, every box's beats are UN-stretched (÷k — exact where k is 1) and
     a set-tempo meta lands at each boundary where the pace CHANGES, the
     return to steady included. An unpaced record takes the old spelling of
     the old arithmetic, byte for byte — `paced` is false, no division, no
     walk, no tempo list. */
  const paced = boxes.some((b) => b.k > 0 && b.k !== 1);
  const tempos = [];
  let tb = 0, curK = 1;
  for (const box of boxes) {
    const off = box.beat0 - beat0;
    const k = paced && box.k > 0 ? box.k : 1;
    if (paced && k !== curK) {
      tempos.push({ at: tb, bpm: Math.max(1, +score.bpm || 120) / k });
      curK = k;
    }
    if (worded) {
      // absent is the record's own level — gain 1, cc 100 — and it is SAID
      // when the record deals levels at all, because a reader coming off a
      // fwd chorus has to be told the floor came back
      const g = box.lvl != null && levels[box.lvl] > 0 ? levels[box.lvl] : 1;
      const val = Math.max(0, Math.min(127, Math.round(100 * Math.sqrt(g))));
      if (val !== curE) { exprs.push({ at: tb, val }); curE = val; }
    }
    for (const l of box.lanes) {
      let v = lanes.get(l.name);
      if (!v) lanes.set(l.name, v = {
        key: l.name,
        name: l.name + (l.instr ? " " + l.instr : ""),
        clef: l.name === "drums" ? "perc" : "",
        notes: [] });
      // THE CHAIR'S TONE IS THE CHAIR'S, NOT THE BOX'S (2026-09-05). A lane is
      // one seat for the whole record — that is why a lane is a TRACK — so the
      // first box that carries a tone answers for the portamento, and an
      // unwarmed export (no cast, no tone anywhere) writes nothing.
      if (v.tone == null && l.tone) v.tone = l.tone;
      for (const n of l.notes)
        v.notes.push(paced
          ? { at: tb + n.beat / k, len: n.dur / k, midi: n.midi, vel: n.vel,
              ...(n.sld ? { sld: 1 } : {}), ...(n.from != null ? { from: n.from } : {}) }
          : { at: off + n.beat, len: n.dur, midi: n.midi, vel: n.vel,
              ...(n.sld ? { sld: 1 } : {}), ...(n.from != null ? { from: n.from } : {}) });
    }
    tb += (box.beats || 0) / k;
  }
  // v0, v1, … then bass, then drums — scoreOf's own rank, so the .mid's track
  // order and the .als's lane order are one order.
  const rank = (n) => (n === "drums" ? 2 : n === "bass" ? 1 : 0);
  const voices = [...lanes.values()]
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
  /* THE PORTAMENTO LANE, PER VOICE (2026-09-05). The notes are already in
     time order — export/score.js sorts each box's lane and the boxes are
     walked in order — which is what `portamentoCCs` merges the slid runs
     against. A voice whose row declares neither `glide` nor `slide` comes
     back with nothing and writes no key at all, so every .mid this box has
     ever exported is byte-identical. */
  let porta = 0;
  for (const v of voices) {
    const cc = portamentoCCs(v.notes, v.tone);
    if (cc.length) { v.ccs = cc; porta += cc.length; }
  }
  // …and the declared signature rides the Score itself (export/score.js
  // stamps `meterAbc` off the timeline's own genre — one owner); a caller may
  // still say `timesig: [nn, dd]` outright. Absent both, nothing is added and
  // the bytes are the old bytes.
  const sigM = !timesig && score.meterAbc ? /^(\d+)\/(\d+)$/.exec(score.meterAbc) : null;
  const sig = timesig || (sigM ? [+sigM[1], +sigM[2]] : null);
  return writeSmf({ bpm: score.bpm, beatsPerBar,
                    stepsPerBar: beatsPerBar,
                    ...(porta ? { texts: [PORTA_SAY] } : {}),
                    ...(tempos.length ? { tempos } : {}),
                    ...(sig ? { timesig: sig } : {}),
                    ...(exprs.length ? { exprs } : {}),
                    voices });
}

/* ---------- the reader — OUR OWN, for the parse-back gate ----------------- */
// Not a general MIDI parser: exactly the subset the writer above emits plus
// running status, so the gate proves the FILE (bytes on disk) and not the
// writer's intermediate state.
export function parseSmf(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let o = 0;
  const rd32 = () => (b[o++] << 24 | b[o++] << 16 | b[o++] << 8 | b[o++]) >>> 0;
  const rd16 = () => (b[o++] << 8 | b[o++]);
  const tag = () => String.fromCharCode(b[o++], b[o++], b[o++], b[o++]);
  const rvlq = () => { let n = 0, c; do { c = b[o++]; n = (n << 7) | (c & 0x7f); } while (c & 0x80); return n; };

  if (tag() !== "MThd") throw new Error("not an SMF: no MThd");
  const hlen = rd32(), format = rd16(), ntrks = rd16(), division = rd16();
  o += hlen - 6;
  const tracks = [];
  for (let t = 0; t < ntrks; t++) {
    if (tag() !== "MTrk") throw new Error("track " + t + ": no MTrk");
    const len = rd32(), end = o + len;
    let tick = 0, status = 0, tempo = null, timesig = null, name = "";
    const open = new Map();            // "ch:key" -> [{tick}]
    const ccs = [];                    // every control change, with its tick —
                                       // the writer emits CC11 for the section
                                       // levels (2026-08-30) and the parse-back
                                       // gate walks them like the tempo map
    const texts = [];                  // every 0x01 text meta, in file order —
                                       // the writer states a signature the
                                       // format cannot spell in one of these
                                       // (2026-09-05, the any-meter round)
    const notes = [], tempos = [];     // tempos: EVERY 0x51, in file order,
                                       // with its tick — the tempo MAP the
                                       // parse-back gate walks (2026-08-30);
                                       // `tempo` stays the last one seen, as
                                       // deck.test D4b has always read it
    while (o < end) {
      tick += rvlq();
      let s = b[o];
      if (s & 0x80) { status = s; o++; } else s = status;
      if (s === 0xff) {
        const type = b[o++], mlen = rvlq(), at = o;
        if (type === 0x03) name = String.fromCharCode(...b.slice(at, at + mlen));
        if (type === 0x51) { tempo = (b[at] << 16) | (b[at + 1] << 8) | b[at + 2];
                             tempos.push({ tick, uspq: tempo }); }
        if (type === 0x58) timesig = [b[at], 1 << b[at + 1]];
        if (type === 0x01) texts.push(String.fromCharCode(...b.slice(at, at + mlen)));
        o = at + mlen;
      } else if ((s & 0xf0) === 0x90 || (s & 0xf0) === 0x80) {
        const ch = s & 0x0f, key = b[o++], vel = b[o++];
        const on = (s & 0xf0) === 0x90 && vel > 0;
        const k = ch + ":" + key;
        if (on) { const q = open.get(k) || []; q.push({ tick }); open.set(k, q); }
        else {
          const q = open.get(k);
          if (q && q.length) { const st = q.shift(); notes.push({ tick: st.tick, key, ch, dur: tick - st.tick }); }
        }
      } else if ((s & 0xf0) === 0xb0) {
        const cc = b[o++], val = b[o++];
        ccs.push({ tick, ch: s & 0x0f, cc, val });
      } else if ((s & 0xf0) >= 0xa0 && (s & 0xf0) <= 0xe0) {
        o += ((s & 0xf0) === 0xc0 || (s & 0xf0) === 0xd0) ? 1 : 2;
      } else throw new Error("unexpected byte 0x" + s.toString(16) + " at " + o);
    }
    notes.sort((a, b2) => a.tick - b2.tick || a.key - b2.key);
    tracks.push({ name, notes, tempo, tempos, timesig, ccs, texts });
  }
  return { format, division, tracks };
}

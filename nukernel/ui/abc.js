// abc.js — the theme, written down. Compiles a nukernel PHRASE (the five
// parallel vectors — deg/oct/gate/vel, sixteen steps a bar) plus the record's
// own facts (key, mode, bpm) into an ABC string, so vendor/abcjs can draw it
// as a staff. Pure ES module, no DOM, no abcjs import: this file only SAYS the
// music; whoever holds the page hands the string to abcjs and gets the SVG.
//
// WHY ABC AND NOT SVG DIRECTLY: notation is a four-hundred-year-old layout
// problem (beams, stems, accidental collisions, dotted values) and abcjs is a
// whole solved instance of it, vendored under the same-origin CSP the way
// vendor/three is. Our half of the deal is small and provable: degrees →
// pitches through the mode (the KERNEL's own arithmetic, copied here so the
// staff can never disagree with the sound), gates → notes and rests, spans →
// durations, key + mode → a signature a musician would actually write.
//
// THE PITCH MATH IS THE KERNEL'S, BYTE FOR BYTE. kernel.js render() plays a
// melodic step at 60 + key + degPitch(deg, mode) + 12*oct (before register
// leans and chord following, which belong to the SECTION, not the theme).
// The staff prints the theme as the theme owns it: same three terms, nothing
// else. If the two files ever compute a different semitone for the same
// degree, the notation lies — which is why degPitch below is a transcription
// of kernel.js, not an improvisation on it.

// ---- the kernel's own arithmetic, restated ---------------------------------
// degree -> semitones through a cyclic alphabet, carrying whole octaves
// (kernel.js degPitch). Signed and unbounded, like `deg` itself.
const degPitch = (d, a) =>
  a[((d % a.length) + a.length) % a.length] + 12 * Math.floor(d / a.length);
// the canonical pitch-class wrap that survives negatives (kernel.js pcw)
const pcw = (n) => ((n % 12) + 12) % 12;

// kernel.js MODE — natural minor, the default alphabet everywhere in the box.
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// ---- the key signature -----------------------------------------------------
// A MODE IS SPELLED, NOT JUST SOUNDED. The seven church modes each carry a
// standard signature (the relative major's), and ABC says them by name —
// K:ADor is A dorian, one sharp. The box's alphabets that are NOT church
// modes split two ways: subsets (the pentatonics) borrow the signature of a
// church mode that contains them, and supersets-with-alterations (harmonic,
// melodic minor) take the plain minor signature and let the raised steps ride
// as accidentals — which is exactly how hand engravers have always written
// them. Order matters: minor is tried before major so the minor pentatonic
// lands on the minor signature, not dorian's.
const CHURCH = [
  { name: "m",    iv: [0, 2, 3, 5, 7, 8, 10], rel: 9 },  // aeolian
  { name: "",     iv: [0, 2, 4, 5, 7, 9, 11], rel: 0 },  // ionian
  { name: "Dor",  iv: [0, 2, 3, 5, 7, 9, 10], rel: 2 },
  { name: "Mix",  iv: [0, 2, 4, 5, 7, 9, 10], rel: 7 },
  { name: "Phr",  iv: [0, 1, 3, 5, 7, 8, 10], rel: 4 },
  { name: "Lyd",  iv: [0, 2, 4, 6, 7, 9, 11], rel: 5 },
  { name: "Loc",  iv: [0, 1, 3, 5, 6, 8, 10], rel: 11 },
];

// sharps (+) / flats (-) in the signature, by RELATIVE-MAJOR pitch class.
// Each pc has two spellings; this table is the one a working copyist picks
// (Db over C#'s seven sharps, F# over Gb by convention).
const SIG_OF_MAJOR = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

// the seven letters, their natural pitch classes, and the order sharps and
// flats enter a signature (F C G D A E B / B E A D G C F)
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATPC   = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];

// which letters the signature alters, as letter -> -1|0|+1
const sigAlters = (sig) => {
  const alt = {};
  if (sig > 0) for (let i = 0; i < sig; i++) alt[SHARP_ORDER[i]] = 1;
  if (sig < 0) for (let i = 0; i < -sig; i++) alt[SHARP_ORDER[6 - i]] = -1;
  return alt;
};

// Choose the signature for (key, mode): find the church mode that contains
// every pitch class the alphabet uses; failing that, fall back on the third —
// a minor third means the minor signature, a major third the major one, and
// the outliers ride as accidentals. Returns everything the spelling pass
// needs: the ABC K: text, the sharp/flat count, and the per-letter alteration.
function keySig(key, mode) {
  const tonicPc = pcw(key);
  const pcs = mode.map(pcw);
  let church = CHURCH.find((c) => c.iv.length === pcs.length &&
                                  c.iv.every((v, i) => v === pcs[i]));
  if (!church) church = CHURCH.find((c) => pcs.every((p) => c.iv.includes(p)));
  if (!church) church = pcs.includes(3) ? CHURCH[0] : CHURCH[1];
  const majorPc = pcw(tonicPc - church.rel);
  const sig = SIG_OF_MAJOR[majorPc];
  const alt = sigAlters(sig);
  // the tonic is diatonic to its own signature by construction, so it has an
  // exact letter: the one whose altered natural pc is the tonic's
  const letter = LETTERS.find((L) => pcw(NATPC[L] + (alt[L] || 0)) === tonicPc);
  const acc = alt[letter] || 0;
  const tonicName = letter + (acc === 1 ? "#" : acc === -1 ? "b" : "");
  return { k: tonicName + church.name, sig, alt, tonicName };
}

// ---- spelling one pitch ----------------------------------------------------
// A midi number becomes letter + accidental + octave marks, spelled INSIDE the
// signature: diatonic notes go bare, chromatic ones sharpen the letter below
// in sharp keys and flatten the letter above in flat keys (the direction a
// reader of that key expects). `state` is the bar's accidental memory —
// in ABC, as on paper, an accidental holds to the barline, so a mark is
// written only when it CHANGES what the letter currently means, and a natural
// is written when the letter must come back.
function spellPitch(midi, sigInfo, state) {
  const pc = pcw(midi);
  const alt = sigInfo.alt;
  // candidate spellings: (letter, accidental) with accidental in -1..1
  const cands = [];
  for (const L of LETTERS) {
    const d = pc - NATPC[L];
    const a = d > 6 ? d - 12 : d < -6 ? d + 12 : d;  // nearest wrap
    if (a >= -1 && a <= 1) cands.push({ L, a });
  }
  // prefer the letter the signature already provides; then the key's own
  // accidental direction; naturals beat new accidentals on a tie
  const dir = sigInfo.sig < 0 ? -1 : 1;
  cands.sort((x, y) => {
    const xs = (alt[x.L] || 0) === x.a ? 0 : 1, ys = (alt[y.L] || 0) === y.a ? 0 : 1;
    if (xs !== ys) return xs - ys;
    if (x.a === 0 && y.a !== 0) return -1;
    if (y.a === 0 && x.a !== 0) return 1;
    return x.a === dir ? -1 : y.a === dir ? 1 : 0;
  });
  const { L, a } = cands[0];
  // octave: ABC's C is middle C (midi 60); k counts octaves above it
  const k = (midi - a - NATPC[L] - 60) / 12;
  const octMark = k >= 1 ? "'".repeat(k - 1) : k < 0 ? ",".repeat(-k) : "";
  const body = (k >= 1 ? L.toLowerCase() : L) + octMark;
  // the bar's memory: write a mark only when this letter+octave means
  // something else right now
  const skey = L + ":" + k;
  const current = skey in state ? state[skey] : (alt[L] || 0);
  let mark = "";
  if (current !== a) {
    mark = a === 1 ? "^" : a === -1 ? "_" : "=";
    state[skey] = a;
  }
  return mark + body;
}

// ---- durations -------------------------------------------------------------
// A value a reader can see at a glance: whole/half/quarter/eighth/sixteenth
// and their dots. Anything else (a five-step note) is said as tied pieces,
// largest first — which is how it would be engraved by hand.
const GOOD = [16, 12, 8, 6, 4, 3, 2, 1];
const pieces = (n) => {
  const out = [];
  while (n > 0) { const p = GOOD.find((g) => g <= n); out.push(p); n -= p; }
  return out;
};
const durStr = (n) => (n === 1 ? "" : String(n));

// ---- ottava: 8va / 8vb, so the noteheads stay on the staff -----------------
// WHAT AN ENGRAVER DOES WITH A HIGH PASSAGE (2026-08-22, Paul: "rather than
// move notes all over the place use 8va and 8vo on the staff?"). A melody
// living above the treble staff was drawn where it sounds — five, six, seven
// ledger lines a note — and a stack of ledger lines is the one thing on a
// staff that is genuinely hard to read. The fix is four centuries old: write
// the passage an octave closer to the staff and mark the clef, so the reader
// transposes instead of counting lines.
//
// WHAT THE VENDORED abcjs ACTUALLY SUPPORTS — measured, not assumed
// (chromium, vendor/abcjs/abcjs-basic-min.js):
//   * `K:C clef=treble+8` / `clef=treble-8` WORK. The clef glyph grows the
//     little 8 above/below (one extra path in the .abcjs-clef group, and the
//     group's bbox grows 57 -> 74 px), and — the part that matters — the
//     NOTEHEADS do not move: the octave clefs carry the same `mid` as plain
//     treble, so `c8` under clef=treble+8 draws at staff position 7 with ZERO
//     ledger lines where `c'8` under plain treble draws at 14 with five
//     ledger elements. The clef is a word to the reader; the placement is
//     ours. Bare `K:C treble+8` parses identically, and a real signature
//     (`K:Ebm clef=treble+8`) keeps all six flats.
//   * `!8va(!` … `!8va)!` DOES NOT. There is no "8va" and no "ottava" string
//     anywhere in the build; abcjs answers "Unknown decoration: 8va(" and
//     draws the passage unchanged. REJECTED — a bracket we cannot draw is a
//     lie either way.
//   * `K:C clef=treble octave=1` parses without complaint and moves nothing
//     on the page (staff position 14, unchanged). REJECTED for the same reason.
// So the marking is a WHOLE-STAFF clef, which is also the simpler thing to be
// right about: it cannot straddle a barline, cannot half-open, and one look at
// the clef tells the reader what octave the whole line is in.
//
// THE RULE, in a sentence: a staff earns an ottava when its MIDDLE note sits
// two ledger lines or more clear of the staff — C6 and up, A3 and down — and
// then it is written in whichever octave costs the fewest ledger lines,
// provided that saves at least two of them.
//   * THE MEDIAN, not the extremes, is what decides. One high note in an
//     otherwise ordinary phrase is a note, not a register; a phrase whose
//     middle is up at C6 is genuinely living up there. Measured: C5..C6 and
//     G3..G4 stay plain (both are ordinary treble writing), A5..A6 takes 8va
//     and C3..C4 takes 8vb.
//   * TWO LEDGER LINES is the ordinary reach of a treble staff — A5/C6 above,
//     C4/A3 below are read at a glance by anybody. Past that they stack.
//   * THE SAVING GUARD stops a clef change that buys one line, and ties go to
//     no marking, so the plain staff is always the default.
//   * IT DEGRADES HONESTLY. A theme spanning four octaves has a median in the
//     middle and no octave rescues its ends: it stays plain, keeps its ledger
//     lines, and reports `wide` so the caption can SAY the staff runs wide
//     rather than pretend otherwise.
//
// THE SOUND DOES NOT MOVE. This is presentation and only presentation: the
// shift is applied where the pitch is SPELLED and nowhere else, so toNotes'
// midi numbers — what the piano audition plays, and what the engine was handed
// — are untouched, and the glyph map is computed by the same loop as before,
// so the lit note index still rides it. What the reader infers (written pitch
// + the clef's octave) equals what the engine plays, by construction.

// diatonic staff position of a midi number: 0 = middle C, +1 per letter, so
// the treble staff itself is 2 (bottom line E4) .. 10 (top line F5). This is
// abcjs's own `abcjs-p<n>` number, which is what lets
// test/probes/staff-ottava.probe.js check this against the drawing itself
// rather than against a second copy of our arithmetic.
const DIA = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const staffPos = (m) => 7 * Math.floor(m / 12) + DIA[pcw(m)] - 35;
// every ledger line BETWEEN the staff and the note gets drawn, so a space
// note beyond the first ledger costs that ledger too (B3 costs one, A3 two)
const ledgers = (p) => Math.max(0, Math.floor((p - 10) / 2)) +
                       Math.max(0, Math.floor((2 - p) / 2));
// +1 = "sounds an octave ABOVE the staff" (8va, clef=treble+8, written down);
// -1 = "sounds an octave BELOW" (8vb, clef=treble-8, written up)
const OTT_CLEF = { "1": "treble+8", "-1": "treble-8" };
function chooseOttava(notes) {
  if (!notes.length) return { ott: 0, wide: false };
  const ps = notes.map((x) => staffPos(x.midi)).sort((a, b) => a - b);
  const mid = ps[ps.length >> 1];             // the phrase's own register
  let ott = 0;
  if (ledgers(mid) >= 2) {
    const cost = (s) =>
      notes.reduce((a, x) => a + ledgers(staffPos(x.midi - 12 * s)), 0);
    let best = cost(0);
    for (const s of [1, -1]) {
      const c = cost(s);
      if (c < best - 1) { best = c; ott = s; } // must save two lines, at least
    }
  }
  // ...and WHETHER IT WORKED. The staff plus two ledger lines each way holds
  // sixteen diatonic steps (A3 up to C6); a theme wider than that fits in no
  // octave at all, and one that still stacks four ledger lines on a note has
  // not been rescued either. Either way the page should SAY the staff runs
  // wide rather than imply the marking fixed it.
  const lo = ps[0] - 7 * ott, hi = ps[ps.length - 1] - 7 * ott;  // as written
  const wide = hi - lo > 16 ||
               notes.some((x) => ledgers(staffPos(x.midi - 12 * ott)) >= 4);
  return { ott, wide };
}

// meter from steps-per-bar: sixteenths, reduced, denominator kept >= 4 so
// sixteen steps say 4/4 rather than 1/1
function meterOf(steps) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let num = steps, den = 16;
  const g = gcd(num, den); num /= g; den /= g;
  while (den < 4) { num *= 2; den *= 2; }
  return num + "/" + den;
}
// ...AND WHY A SIGNATURE CAN BE DECLARED. Twelve steps reduce to 3/4 and
// only ever to 3/4 — a 6/8 bar is the SAME twelve sixteenths heard in two
// dotted-quarter beats, and no arithmetic on the step count can tell the two
// apart (kernel.js METERS says the same thing one layer down). So `opts.abc`
// names the signature outright when the record has one, and `opts.beam` says
// how far apart the beam breaks go: four sixteenths to a beat in simple time,
// six (three eighths) in compound. Both absent = the derived 3/4-or-4/4 and
// beaming by the quarter, which is every staff this file has ever drawn.
//
// ---- BEAMS ARE WHITESPACE (2026-08-23, Paul: "can you connect eighth notes
// and so forth?") -----------------------------------------------------------
// In ABC, notes written ADJACENT are drawn under one beam and a SPACE breaks
// it. So beaming is not a renderer option we can ask for; it is a property of
// the string this file emits, and the only question is where the spaces go.
//
// THE RULE IS METRICAL, AND IT IS THE BEAT: notes are grouped by which
// `beam`-step beat of the bar their ONSET falls in, and a space is written
// only where that beat CHANGES. In 4/4 and 3/4 the beat is the quarter (four
// sixteenths, `beam` 4 — chair.js METS); in 6/8 it is the dotted quarter
// (six sixteenths, `beam` 6), which draws the two groups of three a 6/8 bar
// is heard in. The beat is read off the ONSET rather than off every step
// boundary, so a note that STRADDLES a beat carries its group along with it
// (an eighth on the "and" of two beams with the two before it, and the next
// note — landing in beat three — starts a new group), which is what a hand
// engraver does and what "one long run per bar" and "a flag on every note"
// both get wrong.
//
// THE BUG THIS REPLACES, written down so it cannot come back: the break test
// used to be `Math.max(1, opts.beam | 0) || 4`, and `Math.max(1, 0)` is 1 —
// truthy, so the `|| 4` fallback NEVER RAN and every staff without an
// explicit meter beamed in groups of ONE. Groups of one step are a space
// between every note, which is exactly a page of loose flags. The default is
// now taken by asking whether the option is positive, not by asking whether
// the clamp is falsy.
//
// TIES SURVIVE IT. A tie is a mark on a note (`-`), not a token of its own,
// so a tied pair that happens to span a group boundary is still one note in
// two places; ties across a barline and across a line break are unchanged.

// ---- TWO BARS A LINE, BECAUSE A PHONE IS 390 PX WIDE ----------------------
// (2026-08-23, Paul: "make the music no wider than two measures on a phone
// it's hard to read".) The page engraves with abcjs `responsive: "resize"`,
// which scales a system to the container's width — so a long system does not
// overflow, it SHRINKS, and four bars of sixteenths on a phone arrive as a
// grey smear. The line break is the fix, and in ABC a newline in the tune
// body IS a line break, so it is this file's job like the beams are.
//
// TWO EVERYWHERE, not two-on-a-phone: this module is pure — no DOM, no
// window, no measurement — which is what lets the pure-node gates compile a
// staff and what keeps one string the single source of the glyph map. A
// viewport-derived count would have to come IN as a number (`opts.barsPerLine`
// below takes one, and re-engraving on resize is the caller's business), or
// out of the renderer's own `wrap`/`staffwidth` options, which live in the
// renderAbc call and not here. So the default is the number that reads on the
// narrow screen, and the knob is there for a caller that knows better.
const BARS_PER_LINE = 2;

// ---- the compiler ----------------------------------------------------------
// toABC(phrase, opts) -> ABC string.
//   phrase  { deg[], oct[], gate[], vel[], hold[]?, midi[]? }  equal lengths;
//           `midi` is present-only and outranks the degree math (see
//           toNotes below: as written, or as played); vel is
//           carried by the phrase but not drawn — dynamics belong to the
//           SECTION's performance layer (stress/touch), not to the theme's
//           identity, and a staff full of per-note marks says less, not
//           more. `hold` is present-only: a note's explicit length in steps
//           (the tie mark / a sentence's carry), outranking maxHold below.
//   opts    { key, mode, bpm, label, maxHold, stepsPerBar, reg,
//             abc, beam, barsPerLine }
//     key         signed semitone offset from C (band-kit B.KEYS)   [0]
//     mode        interval array (genres.js MODES / kernel MODE)    [minor]
//     bpm         quarter-note tempo for Q:                         [omitted]
//     label       T: title                                          [omitted]
//     maxHold     cap a note's steps; the remainder becomes REST —
//                 the kernel's own "maxHold makes rests real" law   [none]
//     stepsPerBar sixteenths per bar                                [16]
//     reg         whole-octave shift for display                    [0]
//     abc         the M: signature said outright ("6/8")            [derived]
//     beam        steps to a beam group — the BEAT                  [4]
//     barsPerLine bars before the line breaks                       [2]
//
// ---- the note timeline, shared -------------------------------------------
// toNotes(phrase, opts) -> { n, spb, notes: [{ at, len, midi }] } — the same
// onsets/spans/pitch arithmetic toABC folds into bars, exported on its own so
// the piano audition (audio/audition.js) plays EXACTLY the notes the staff
// prints: one function computes the midi numbers, two surfaces read them.
// A note lasts to the NEXT onset (kernel spans()), the last one to the end of
// the phrase — the loop's wrap shows as the note holding out its bar, which
// is what it does in the air.
// AS WRITTEN, OR AS PLAYED. A phrase may carry `midi` — an absolute MIDI
// number per step, present-only — and when it does that number IS the pitch:
// the degree math, the key offset and the register shift are all already
// inside it. That is the seam the band page re-engraves a sounding section
// through (ui/band.js): the notes the ENGINE was handed for that section, so
// "up a step" visibly moves the staff and the bar's own chord shows in the
// spelling. `key`/`mode` still choose the SIGNATURE (spellPitch reads them),
// which is why they stay opts and not part of the pitch. A phrase without
// `midi` takes exactly the old branch, byte for byte.
export function toNotes(phrase, opts = {}) {
  const { deg = [], oct = [], gate = [] } = phrase || {};
  const mid = phrase && phrase.midi;
  const n = gate.length;
  const key = opts.key | 0;
  const mode = (opts.mode && opts.mode.length ? opts.mode : MINOR).slice();
  const spb = opts.stepsPerBar || 16;
  const regShift = (opts.reg | 0) * 12;
  const onsets = [];
  for (let i = 0; i < n; i++) if (gate[i]) onsets.push(i);
  const notes = [];
  onsets.forEach((at, k) => {
    let span = k + 1 < onsets.length ? onsets[k + 1] - at : n - at;
    // an explicit per-note hold (phrase.hold — the hand's tie, or a
    // sentence's carry across the barline) outranks the maxHold clamp the
    // same way it does in the kernel: the cap makes rests only where
    // nobody said, and never past the next onset either way
    const hd = phrase && phrase.hold && phrase.hold[at];
    if (hd) span = Math.min(span, hd);
    else if (opts.maxHold) span = Math.min(span, opts.maxHold);
    notes.push({ at, len: span,
      midi: mid ? mid[at] | 0
                : 60 + key + regShift + degPitch(deg[at] | 0, mode) + 12 * (oct[at] | 0) });
  });
  return { n, spb, notes };
}

export function toABC(phrase, opts = {}) { return engrave(phrase, opts).abc; }

// ---- the engraving, with its glyph map ------------------------------------
// toEngraving(phrase, opts) -> { abc, glyphs, notes, n, spb }. `glyphs` maps
// every pitched GLYPH the staff will draw, in engraving order, to the index
// of the toNotes() note it belongs to — a note split at a barline or said as
// tied pieces (a five-step value) is SEVERAL glyphs of one note, and they
// share an index. Rests are not in the map (abcjs classes them .abcjs-rest,
// never .abcjs-note), so `svg.querySelectorAll(".abcjs-note")[g]` is glyph g
// exactly. This is what lets the page light the SOUNDING note on the
// engraved staff without re-deriving the fold: one loop computes the ABC
// and the map together, so they cannot disagree. `ottava` (+1 = 8va, -1 =
// 8vb, 0 = as it sounds) and `wide` come out with it, so the page can put the
// octave into WORDS under the staff — a reader who does not know the marking
// still learns what is happening — and can admit a staff no octave rescues.
export function toEngraving(phrase, opts = {}) { return engrave(phrase, opts); }

function engrave(phrase, opts = {}) {
  const key = opts.key | 0;
  const mode = (opts.mode && opts.mode.length ? opts.mode : MINOR).slice();
  const sigInfo = keySig(key, mode);

  // the step timeline: for every step, a note that STARTS there (with its
  // held length and its pitch) or a rest — toNotes's own, folded into bars.
  const { n, spb, notes } = toNotes(phrase, opts);
  // ...and, before a single pitch is spelled, WHICH OCTAVE THIS STAFF IS IN.
  // One decision for the whole staff, taken off the sounding pitches; every
  // spelling below is written `12 * ott` away from the sound and the clef
  // says so, which is the only place the shift exists.
  const { ott, wide } = chooseOttava(notes);
  const kind = new Array(n).fill(0);          // 0 rest, 1 note-start, 2 held
  const len = new Array(n).fill(0);
  const midiAt = new Array(n).fill(0);
  for (const note of notes) {
    kind[note.at] = 1; len[note.at] = note.len; midiAt[note.at] = note.midi;
    for (let j = 1; j < note.len; j++) kind[note.at + j] = 2;
  }

  // Fold the timeline into bars. A note crossing a barline splits and TIES;
  // a rest just splits; a duration that is not one engravable value (a
  // five-step note) is said as tied pieces, largest first. Spaces land where
  // the BEAT changes (see "BEAMS ARE WHITESPACE" above) so abcjs draws one
  // beam per beat instead of a flag on every note, and the accidental memory
  // resets at each barline exactly as a reader's does.
  const out = [];
  const glyphs = [];                          // pitched glyph -> toNotes index
  let cur = "", accState = {}, pos = 0, ni = -1;

  // steps to a beam group: the quarter in simple time, the dotted quarter in
  // compound. `(x | 0) > 0` and not `Math.max(1, x | 0) || 4` — the clamp is
  // never falsy, so that spelling silently beamed everything in ones.
  const beam = (opts.beam | 0) > 0 ? (opts.beam | 0) : 4;
  let group = -1;               // which beam group the last token in `cur` is in
  const push = (tok) => {
    // the group is read off the token's ONSET, so a note straddling a beat
    // stays with the notes it began among and the next onset opens the
    // next beam
    const g = Math.floor((pos % spb) / beam);
    if (cur && g !== group) cur += " ";
    cur += tok;
    group = g;
  };
  const advance = (steps) => {
    pos += steps;
    if (pos % spb === 0 || pos === n) {
      out.push(cur); cur = ""; accState = {}; group = -1;
    }
  };

  let i = 0;
  while (i < n) {
    if (kind[i] === 1) {
      const midi = midiAt[i] - 12 * ott;   // as WRITTEN; midiAt is the sound
      let remain = len[i];
      ni++;                                   // the next toNotes note, in order
      while (remain > 0) {
        const room = spb - (pos % spb);
        const chunk = Math.min(remain, room);
        const crossesBar = remain > chunk;
        const ps = pieces(chunk);
        ps.forEach((p, k) => {
          // spelled per piece: the tied restatement after a barline needs its
          // accidental said again, and the bar-scoped accState knows when
          const name = spellPitch(midi, sigInfo, accState);
          const tie = k < ps.length - 1 || crossesBar ? "-" : "";
          push(name + durStr(p) + tie);
          glyphs.push(ni);                    // every tied piece is this note's
          advance(p);
        });
        remain -= chunk;
      }
      i += len[i];
    } else {
      let run = 0, j = i;
      while (j < n && kind[j] === 0) { run++; j++; }
      while (run > 0) {
        const room = spb - (pos % spb);
        const chunk = Math.min(run, room);
        for (const p of pieces(chunk)) { push("z" + durStr(p)); advance(p); }
        run -= chunk;
      }
      i = j;
    }
  }
  if (cur) out.push(cur);

  const head = ["X:1"];
  if (opts.label) head.push("T:" + String(opts.label).replace(/[\r\n]+/g, " "));
  head.push("M:" + (opts.abc || meterOf(spb)));
  head.push("L:1/16");
  if (opts.bpm) head.push("Q:1/4=" + Math.round(opts.bpm));
  // the signature, and — when the staff moved — the octave clef that puts it
  // back: `clef=treble+8` is the little 8 above the G, "sounds an octave
  // higher than written" (verified rendering above)
  head.push("K:" + sigInfo.k + (ott ? " clef=" + OTT_CLEF[String(ott)] : ""));

  // TWO bars a line (see above — a phone is 390 px and abcjs shrinks rather
  // than overflows), the last bar closed with a final barline; an empty
  // phrase is still a bar of rest, so the staff always draws
  const per = (opts.barsPerLine | 0) > 0 ? (opts.barsPerLine | 0) : BARS_PER_LINE;
  const lines = [];
  for (let b = 0; b < out.length; b += per)
    lines.push(out.slice(b, b + per).join(" | ") +
               (b + per >= out.length ? " |]" : " |"));
  const abc = head.join("\n") + "\n" + (lines.join("\n") || "z" + spb + " |]") + "\n";
  return { abc, glyphs, notes, n, spb, ottava: ott, wide };
}

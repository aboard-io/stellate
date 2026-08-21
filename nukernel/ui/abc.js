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

// meter from steps-per-bar: sixteenths, reduced, denominator kept >= 4 so
// sixteen steps say 4/4 rather than 1/1
function meterOf(steps) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let num = steps, den = 16;
  const g = gcd(num, den); num /= g; den /= g;
  while (den < 4) { num *= 2; den *= 2; }
  return num + "/" + den;
}

// ---- the compiler ----------------------------------------------------------
// toABC(phrase, opts) -> ABC string.
//   phrase  { deg[], oct[], gate[], vel[] }  equal lengths; vel is carried by
//           the phrase but not drawn — dynamics belong to the SECTION's
//           performance layer (stress/touch), not to the theme's identity,
//           and a staff full of per-note marks says less, not more.
//   opts    { key, mode, bpm, label, maxHold, stepsPerBar, reg }
//     key         signed semitone offset from C (band-kit B.KEYS)   [0]
//     mode        interval array (genres.js MODES / kernel MODE)    [minor]
//     bpm         quarter-note tempo for Q:                         [omitted]
//     label       T: title                                          [omitted]
//     maxHold     cap a note's steps; the remainder becomes REST —
//                 the kernel's own "maxHold makes rests real" law   [none]
//     stepsPerBar sixteenths per bar                                [16]
//     reg         whole-octave shift for display                    [0]
//
// ---- the note timeline, shared -------------------------------------------
// toNotes(phrase, opts) -> { n, spb, notes: [{ at, len, midi }] } — the same
// onsets/spans/pitch arithmetic toABC folds into bars, exported on its own so
// the piano audition (audio/audition.js) plays EXACTLY the notes the staff
// prints: one function computes the midi numbers, two surfaces read them.
// A note lasts to the NEXT onset (kernel spans()), the last one to the end of
// the phrase — the loop's wrap shows as the note holding out its bar, which
// is what it does in the air.
export function toNotes(phrase, opts = {}) {
  const { deg = [], oct = [], gate = [] } = phrase || {};
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
    if (opts.maxHold) span = Math.min(span, opts.maxHold);
    notes.push({ at, len: span,
      midi: 60 + key + regShift + degPitch(deg[at] | 0, mode) + 12 * (oct[at] | 0) });
  });
  return { n, spb, notes };
}

export function toABC(phrase, opts = {}) {
  const key = opts.key | 0;
  const mode = (opts.mode && opts.mode.length ? opts.mode : MINOR).slice();
  const sigInfo = keySig(key, mode);

  // the step timeline: for every step, a note that STARTS there (with its
  // held length and its pitch) or a rest — toNotes's own, folded into bars.
  const { n, spb, notes } = toNotes(phrase, opts);
  const kind = new Array(n).fill(0);          // 0 rest, 1 note-start, 2 held
  const len = new Array(n).fill(0);
  const midiAt = new Array(n).fill(0);
  for (const note of notes) {
    kind[note.at] = 1; len[note.at] = note.len; midiAt[note.at] = note.midi;
    for (let j = 1; j < note.len; j++) kind[note.at + j] = 2;
  }

  // Fold the timeline into bars. A note crossing a barline splits and TIES;
  // a rest just splits; a duration that is not one engravable value (a
  // five-step note) is said as tied pieces, largest first. Spaces land on
  // beat boundaries (every four sixteenths) so abcjs beams by the beat
  // instead of one run per bar, and the accidental memory resets at each
  // barline exactly as a reader's does.
  const out = [];
  let cur = "", accState = {}, pos = 0;

  const push = (tok) => {
    const inBar = pos % spb;
    if (inBar !== 0 && inBar % 4 === 0 && cur && !cur.endsWith(" ")) cur += " ";
    cur += tok;
  };
  const advance = (steps) => {
    pos += steps;
    if (pos % spb === 0 || pos === n) { out.push(cur); cur = ""; accState = {}; }
  };

  let i = 0;
  while (i < n) {
    if (kind[i] === 1) {
      const midi = midiAt[i];
      let remain = len[i];
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
  head.push("M:" + meterOf(spb));
  head.push("L:1/16");
  if (opts.bpm) head.push("Q:1/4=" + Math.round(opts.bpm));
  head.push("K:" + sigInfo.k);

  // four bars a line, the last bar closed with a final barline; an empty
  // phrase is still a bar of rest, so the staff always draws
  const lines = [];
  for (let b = 0; b < out.length; b += 4)
    lines.push(out.slice(b, b + 4).join(" | ") +
               (b + 4 >= out.length ? " |]" : " |"));
  return head.join("\n") + "\n" + (lines.join("\n") || "z" + spb + " |]") + "\n";
}

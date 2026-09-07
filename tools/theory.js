// theory.js — the ONE OWNER of music theory in this tree. Pure, total, zero
// dependencies, UMD like every other engine file, so node scripts and the
// browser DAW read the same rules instead of each carrying a copy.
//
// WHY IT EXISTS (docs/THEORY.md §1, approved 2026-09-06). Paul sent the
// Augmented Fifth publication, which marks LLMs on six mechanical things:
// four-part writing, figured bass, roman-numeral analysis, the classical
// transformations, set theory, and chord spelling that keeps its enharmonics.
// This repo was re-deriving most of those in three places at once — the
// kernel's chordsOf, tools/remix.js's chord estimate, and tools/chorale-check
// -- which is how a checker and an engine drift apart. They live here now.
//
// TWO LAWS THE REST OF THE FILE OBEYS.
//
//   A NOTE IS A LETTER AND AN ALTERATION, NEVER A PITCH CLASS. §3 onward
//   carries {l, a, o} and only collapses to 0..11 when something genuinely
//   asks for a pitch class. An earlier sketch spelled chords by transposing
//   pitch classes and naming them from a table of twelve; it answered the
//   publication's F-flat half-diminished seventh as "B, D, F, G#" and was
//   not wrong so much as unable to be right — the enharmonics are gone
//   before the first question is asked. Triple accidentals are legal here
//   because the test set contains one (question 8, below).
//
//   PURE AND TOTAL. Nothing here throws, reads a file, touches the DOM or
//   keeps state. Odd input returns null or [], because a theory module that
//   throws inside a render loop takes the audio with it.
//
// The kernel has its own `romanOf(mode)` — a different function with the same
// name, deriving numerals for a MODE. This one reads a SIMULTANEITY. They are
// deliberately not merged: the kernel's is about an alphabet, this one is
// about a chord, and one name doing both jobs would be the worse lie.

(function (root) {
  "use strict";

  /* ====================================================================== *
   * 1 · SETS                                                               *
   * ====================================================================== */

  const pcOf = (n) => (typeof n === "number" ? ((n % 12) + 12) % 12 : null);
  const pcsOf = (notes) => {
    if (!Array.isArray(notes)) return [];
    const s = new Set();
    for (const n of notes) if (typeof n === "number") s.add(pcOf(n));
    return [...s].sort((a, b) => a - b);
  };

  // NORMAL FORM: the rotation that spans least. Ties go to the rotation
  // packed hardest to the LEFT, compared inside-out (last gap, then the one
  // before it), which is the standard tie-break and the one that makes
  // primeForm stable — a tie broken by first-difference gives 5-Z12 two
  // different "prime" forms depending on which rotation you happen to test.
  function normalForm(pcs) {
    const s = pcsOf(pcs);
    const n = s.length;
    if (n < 2) return s.slice();
    let best = null, bestAt = 0;
    for (let r = 0; r < n; r++) {
      const rot = [];
      for (let i = 0; i < n; i++) rot.push(((s[(r + i) % n] - s[r]) % 12 + 12) % 12);
      if (!best) { best = rot; bestAt = r; continue; }
      for (let k = n - 1; k >= 1; k--) {
        if (rot[k] < best[k]) { best = rot; bestAt = r; break; }
        if (rot[k] > best[k]) break;
      }
    }
    // handed back at its ORIGINAL transposition level, which is what every
    // textbook that prints a normal form as pitch classes means by it.
    return best.map((x) => pcOf(s[bestAt] + x));
  }

  const transposeSet = (pcs, n) => pcsOf((pcs || []).map((p) => p + (n | 0)));
  const invertSet = (pcs, axis) => pcsOf((pcs || []).map((p) => 2 * (axis || 0) - p));
  const setEq = (a, b) => {
    const x = pcsOf(a || []), y = pcsOf(b || []);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  };

  // PRIME FORM: normal form of the better (more left-packed at T0) of the set
  // and its inversion.
  function primeForm(pcs) {
    const s = pcsOf(pcs || []);
    if (!s.length) return [];
    const zero = (arr) => { const nf = normalForm(arr); return nf.map((x) => pcOf(x - nf[0])); };
    const a = zero(s), b = zero(invertSet(s, 0));
    for (let i = 1; i < a.length; i++) {
      if (a[i] < b[i]) return a;
      if (a[i] > b[i]) return b;
    }
    return a;
  }

  // INTERVAL-CLASS VECTOR. Every unordered pair once, bucketed by
  // min(d, 12-d). The tritone bucket n6 is the RAW pair count, not halved:
  // the octatonic's four tritones print as 4 and the vector sums to C(n,2),
  // which is the check the publication's question 6 is really testing.
  function icv(pcs) {
    const s = pcsOf(pcs || []);
    const v = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const d = Math.abs(s[i] - s[j]) % 12;
        v[Math.min(d, 12 - d) - 1]++;
      }
    return v;
  }

  // A SMALL FORTE TABLE, deliberately small. A wrong Forte number printed
  // confidently is worse than a null, so this holds only set classes anyone
  // here has had a reason to name, and everything else answers null.
  const FORTE = {
    "0,1,2": "3-1", "0,1,3": "3-2", "0,1,4": "3-3", "0,2,4": "3-6",
    "0,2,5": "3-7", "0,2,6": "3-8", "0,2,7": "3-9", "0,3,6": "3-10",
    "0,3,7": "3-11", "0,4,8": "3-12",
    "0,1,5,8": "4-20", "0,2,4,7": "4-22", "0,2,5,7": "4-23", "0,2,6,8": "4-25",
    "0,3,5,8": "4-26", "0,2,5,8": "4-27", "0,3,6,9": "4-28",
    "0,2,4,7,9": "5-35", "0,1,3,7,8": "5-20",
    "0,2,4,5,7,9": "6-32",
    "0,1,3,5,6,8,10": "7-35",
    "0,1,3,4,6,7,9,10": "8-28",
  };
  const forte = (pcs) => FORTE[primeForm(pcs).join(",")] || null;

  /* ====================================================================== *
   * 2 · TRANSFORMS over a "row" — an array of numbers, or of {p, d}         *
   * ====================================================================== *
   * Numbers in, numbers out; objects in, objects out; the input is never
   * mutated. These are the classical operations by their real names, and the
   * motif editor and the kernel's development words both call THESE rather
   * than each writing the arithmetic (docs/THEORY.md §3).                    */

  const isObjRow = (row) => Array.isArray(row) && row.length > 0 &&
    row[0] && typeof row[0] === "object";
  const pOf = (x) => (x && typeof x === "object" ? x.p : x);
  const withP = (x, p) => (x && typeof x === "object" ? { ...x, p } : p);

  const transpose = (row, n) =>
    !Array.isArray(row) ? [] : row.map((x) => withP(x, pOf(x) + (n | 0)));

  // INVERT about an axis in PITCH space, not pitch-class space: 2*axis - p
  // keeps the register, so an inverted line still sits where the chair sings.
  // The axis defaults to the row's first pitch, which is the inversion a
  // musician means when they say "invert it" without naming a mirror.
  const invert = (row, axis) => {
    if (!Array.isArray(row) || !row.length) return [];
    const a = axis == null ? pOf(row[0]) : axis;
    return row.map((x) => withP(x, 2 * a - pOf(x)));
  };

  // RETROGRADE reverses the array, which reverses pitches AND the durations
  // attached to them — the publication's question 2 marks exactly that pair
  // ("notes and durations are the real meat of the problem").
  const retrograde = (row) => (Array.isArray(row) ? row.slice().reverse() : []);
  const retrogradeInversion = (row, axis) => retrograde(invert(row, axis));

  // AUGMENT / DIMINISH scale DURATIONS. A bare numeric row has no durations
  // to scale, so it comes back a copy — said out loud because silently
  // returning the input would look like the transform ran.
  const scaleDur = (row, f) => {
    if (!Array.isArray(row)) return [];
    if (!isObjRow(row)) return row.slice();
    return row.map((x) => (x.d == null ? { ...x } : { ...x, d: x.d * f }));
  };
  const augment = (row, f) => scaleDur(row, f == null ? 2 : f);
  const diminish = (row, f) => scaleDur(row, 1 / (f == null ? 2 : f));

  const rotate = (row, k) => {
    if (!Array.isArray(row) || !row.length) return [];
    const n = row.length, s = ((k | 0) % n + n) % n;
    return row.slice(s).concat(row.slice(0, s));
  };

  // SEQUENCE: the row again and again, each repeat a step further along. With
  // a `scale` the step is DIATONIC (degrees of that scale); without one it is
  // chromatic semitones. A real sequence is diatonic — that is what makes it
  // a sequence rather than a transposition — so the scale argument is the
  // interesting one and the chromatic case is the fallback.
  function sequence(row, step, times, scale) {
    if (!Array.isArray(row) || !row.length) return [];
    const t = Math.max(1, times | 0 || 1), out = [];
    for (let k = 0; k < t; k++)
      for (const x of row)
        out.push(withP(x, scale && scale.length
          ? diaStep(pOf(x), step * k, scale)
          : pOf(x) + step * k));
    return out;
  }
  // move a pitch k scale-steps, keeping its register. A pitch off the scale
  // takes the nearest scale tone's index and keeps its own distance from it,
  // so a chromatic passing note comes out of a sequence still chromatic.
  function diaStep(p, k, scale) {
    const s = pcsOf(scale);
    if (!s.length || !k) return p;
    const pc = pcOf(p);
    let i = s.indexOf(pc), off = 0;
    if (i < 0) {
      let best = 0, bd = 99;
      s.forEach((v, j) => { const d = ((pc - v) % 12 + 12) % 12; if (d < bd) { bd = d; best = j; } });
      i = best; off = bd;
    }
    const j = i + k, n = s.length;
    const oct = Math.floor(j / n), idx = ((j % n) + n) % n;
    return p - pc + s[idx] + 12 * oct + off + (s[idx] < s[i] && oct === 0 ? 0 : 0);
  }

  /* ====================================================================== *
   * 3 · SPELLED PITCH                                                      *
   * ====================================================================== *
   * {l:0..6 letter index, a:alteration in semitones, o:octave}. C4 = middle
   * C = MIDI 60, matching the rest of this tree. `a` is not clamped: Alkan
   * and Roslavets wrote triple sharps and so does question 8.               */

  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const LSEMI = [0, 2, 4, 5, 7, 9, 11];

  function sp(letter, alter, oct) {
    let l = letter;
    if (typeof l === "string") l = LETTERS.indexOf(l.toUpperCase()[0]);
    if (!(l >= 0 && l <= 6)) return null;
    return { l: l | 0, a: alter == null ? 0 : alter | 0, o: oct == null ? 4 : oct | 0 };
  }

  // parseSp accepts "x" for a double sharp because scores print it, and the
  // unicode accidentals because the publication's prompt does.
  function parseSp(str) {
    if (str && typeof str === "object" && str.l != null) return str;
    if (typeof str !== "string") return null;
    const m = /^\s*([A-Ga-g])((?:#|b|x|♯|♭|𝄪|𝄫)*)(-?\d+)?\s*$/.exec(str);
    if (!m) return null;
    let a = 0;
    for (const ch of Array.from(m[2])) {
      if (ch === "#" || ch === "♯") a += 1;
      else if (ch === "b" || ch === "♭") a -= 1;
      else if (ch === "x" || ch === "𝄪") a += 2;
      else if (ch === "𝄫") a -= 2;
    }
    return sp(m[1], a, m[3] == null ? 4 : parseInt(m[3], 10));
  }

  function spName(s, opt) {
    const x = parseSp(s);
    if (!x) return "";
    const uni = opt && opt.unicode;
    const acc = x.a > 0 ? (uni ? "♯" : "#").repeat(x.a)
              : x.a < 0 ? (uni ? "♭" : "b").repeat(-x.a) : "";
    return LETTERS[x.l] + acc;
  }
  const spMidi = (s) => { const x = parseSp(s); return x ? 12 * (x.o + 1) + LSEMI[x.l] + x.a : null; };
  const spPc = (s) => { const m = spMidi(s); return m == null ? null : pcOf(m); };

  // spTranspose is where the letter and the semitone are decided SEPARATELY,
  // and that separation is the whole reason this module exists: the letter
  // comes from the diatonic step count, the alteration is whatever is left
  // over. Ask for a major third above Fb and you get Abb, not G.
  function spTranspose(s, iv) {
    const x = parseSp(s);
    if (!x || !iv) return null;
    const steps = iv.steps | 0, semis = iv.semis | 0;
    const li = x.l + steps;
    const l2 = ((li % 7) + 7) % 7, carry = Math.floor(li / 7), o2 = x.o + carry;
    const target = spMidi(x) + semis;
    return { l: l2, a: target - (12 * (o2 + 1) + LSEMI[l2]), o: o2 };
  }

  const PERFECT = { 0: 1, 3: 1, 4: 1 };            // unison, fourth, fifth
  function intervalName(steps, semis) {
    if (steps < 0) return "-" + intervalName(-steps, -semis);
    const oct = Math.floor(steps / 7), gen = steps - 7 * oct;
    const d = semis - (LSEMI[gen] + 12 * oct);
    let q;
    if (PERFECT[gen]) q = d === 0 ? "P" : d > 0 ? "A".repeat(d) : "d".repeat(-d);
    else q = d === 0 ? "M" : d === -1 ? "m" : d > 0 ? "A".repeat(d) : "d".repeat(-d - 1);
    return q + (steps + 1);
  }
  function parseInterval(name) {
    if (name && typeof name === "object") return name;
    const m = /^\s*(-?)\s*([PMmAd]+)(\d+)\s*$/.exec(String(name || ""));
    if (!m) return null;
    const steps = parseInt(m[3], 10) - 1;
    if (steps < 0) return null;
    const oct = Math.floor(steps / 7), gen = steps - 7 * oct, q = m[2];
    let d;
    if (q === "P" || q === "M") d = 0;
    else if (q === "m") d = PERFECT[gen] ? null : -1;
    else if (/^A+$/.test(q)) d = q.length;
    else if (/^d+$/.test(q)) d = PERFECT[gen] ? -q.length : -(q.length + 1);
    else d = null;
    if (d == null) return null;                       // "m5" and "P3" are not intervals
    if (q === "P" && !PERFECT[gen]) return null;
    if (q === "M" && PERFECT[gen]) return null;
    const semis = LSEMI[gen] + 12 * oct + d;
    return m[1] ? { steps: -steps, semis: -semis } : { steps, semis };
  }
  function spInterval(a, b) {
    const x = parseSp(a), y = parseSp(b);
    if (!x || !y) return null;
    const steps = (y.l - x.l) + 7 * (y.o - x.o), semis = spMidi(y) - spMidi(x);
    return { steps, semis, name: intervalName(steps, semis) };
  }
  const spByInterval = (s, name) => spTranspose(s, parseInterval(name));

  /* ====================================================================== *
   * 4 · KEYS AND DEGREES                                                   *
   * ====================================================================== */

  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], ionian: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
    "natural minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
    "melodic minor": [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  };
  const modeArr = (m) => Array.isArray(m) ? m.slice()
    : MODES[String(m || "major").toLowerCase()] || MODES.major;

  // KEYSIG spells the seven degrees by walking LETTERS from the tonic and
  // letting the alteration absorb whatever the mode asks for. That is why
  // C-flat major comes out Cb Db Eb Fb Gb Ab Bb and not "B major with a
  // different name", and why the natural minor on C-flat has an Ebb in it —
  // which question 5 needs.
  function KEYSIG(tonicSp, mode) {
    const t = parseSp(tonicSp);
    if (!t) return [];
    const md = modeArr(mode), base = spMidi(t);
    return md.map((semis, i) => {
      const li = t.l + i, l2 = ((li % 7) + 7) % 7, o2 = t.o + Math.floor(li / 7);
      return { l: l2, a: (base + semis) - (12 * (o2 + 1) + LSEMI[l2]), o: o2 };
    });
  }

  // "Am", "A minor", "Ab", "C# dorian", "Cb major" — and an already-parsed
  // key passes straight through, so callers never have to remember which.
  function parseKey(key) {
    if (!key) return null;
    if (typeof key === "object" && key.tonic) return key;
    if (typeof key === "object" && key.l != null) return { tonic: key, mode: "major", modeArr: MODES.major };
    const m = /^\s*([A-Ga-g][#bx♯♭]*)\s*(.*?)\s*$/.exec(String(key));
    if (!m) return null;
    const tonic = parseSp(m[1]);
    if (!tonic) return null;
    let w = m[2].toLowerCase();
    if (w === "m" || w === "min") w = "minor";
    if (w === "maj" || w === "") w = "major";
    const md = MODES[w];
    return { tonic, mode: md ? w : "major", modeArr: md || MODES.major };
  }

  const DEGREES = {
    tonic: 0, supertonic: 1, mediant: 2, subdominant: 3, dominant: 4,
    submediant: 5, subtonic: 6, leadingtone: 6, "leading tone": 6,
  };
  const degreeName = (name) => {
    if (typeof name === "number") return ((name | 0) % 7 + 7) % 7;
    const k = String(name || "").toLowerCase().replace(/[_-]/g, " ").trim();
    const v = DEGREES[k] != null ? DEGREES[k] : DEGREES[k.replace(/ /g, "")];
    return v == null ? null : v;
  };

  // SUBTONIC AND LEADING TONE ARE THE SAME DEGREE AND DIFFERENT NOTES, which
  // is the trap in question 9 ("Maj7 chord built on the subtonic of G-sharp
  // minor" = F#, not F##). Degree 7 of the key answers "subtonic" as written;
  // asking for the LEADING TONE in a key whose seventh is a whole tone below
  // the tonic raises it, and nothing else in this module does that silently.
  function scaleDegreeSp(key, degree) {
    const k = parseKey(key);
    if (!k) return null;
    const i = degreeName(degree);
    if (i == null) return null;
    const d = KEYSIG(k.tonic, k.modeArr)[i];
    if (!d) return null;
    const wantsLT = typeof degree === "string" &&
      /leading/i.test(degree.replace(/[_ -]/g, ""));
    if (wantsLT && i === 6 && k.modeArr[6] === 10) return { l: d.l, a: d.a + 1, o: d.o };
    return d;
  }

  /* ====================================================================== *
   * 5 · CHORD SPELLING — the publication's saturated benchmark              *
   * ====================================================================== *
   * The qualities are lists of SPELLED intervals, not semitone distances, so a
   * chord is built by stacking intervals off a spelled root and the letters
   * fall out of the stack. A semitone table cannot tell Abb from G and this
   * test is entirely about that difference.                                 */

  const QUALITY = {
    maj:      ["P1", "M3", "P5"],
    min:      ["P1", "m3", "P5"],
    dim:      ["P1", "m3", "d5"],
    aug:      ["P1", "M3", "A5"],
    sus4:     ["P1", "P4", "P5"],
    sus2:     ["P1", "M2", "P5"],
    maj6:     ["P1", "M3", "P5", "M6"],
    min6:     ["P1", "m3", "P5", "M6"],
    maj7:     ["P1", "M3", "P5", "M7"],
    m7:       ["P1", "m3", "P5", "m7"],
    dom7:     ["P1", "M3", "P5", "m7"],
    dim7:     ["P1", "m3", "d5", "d7"],
    halfdim7: ["P1", "m3", "d5", "m7"],
    mmaj7:    ["P1", "m3", "P5", "M7"],
    "7b5":    ["P1", "M3", "d5", "m7"],
    "7#5":    ["P1", "M3", "A5", "m7"],
    "maj7#5": ["P1", "M3", "A5", "M7"],
    domb9:    ["P1", "M3", "P5", "m7", "m9"],
    dom9:     ["P1", "M3", "P5", "m7", "M9"],
    minor9:   ["P1", "m3", "P5", "m7", "M9"],
    maj9:     ["P1", "M3", "P5", "M7", "M9"],
    "7#9":    ["P1", "M3", "P5", "m7", "A9"],
  };
  // The words other parts of this tree already say for the same chords. One
  // table, many spellings of its keys, so nobody has to look up ours.
  const QALIAS = {
    major: "maj", M: "maj", minor: "min", m: "min", "-": "min",
    "7": "dom7", dominant7: "dom7", "dominant 7": "dom7",
    min7: "m7", m7b5: "halfdim7", halfdim: "halfdim7", "ø7": "halfdim7",
    "ø": "halfdim7", aug7: "7#5", "+": "aug", m6: "min6", "6": "maj6",
    "9": "dom9", V9: "dom9", "7b9": "domb9", dom7b9: "domb9",
    "dominant minor ninth": "domb9", "dominant minor 9": "domb9",
    m9: "minor9", min9: "minor9", "maj7b5": "maj7", "M7": "maj7",
  };
  const qualIntervals = (q) => {
    const k = String(q == null ? "maj" : q);
    return QUALITY[k] || QUALITY[QALIAS[k]] || QUALITY[QALIAS[k.toLowerCase()]] ||
           QUALITY[k.toLowerCase()] || null;
  };
  // semitone distances from the root, for the pitch-class side of the house
  const qualPcs = (q) => {
    const ivs = qualIntervals(q);
    return ivs ? ivs.map((n) => parseInterval(n).semis) : null;
  };

  // stack the tones so each sits strictly above the one before it, starting
  // from whichever tone the inversion puts in the bass. This is the
  // publication's instruction verbatim: "begin with the lowest note (the bass
  // note of the specified inversion), then list the remaining notes in
  // ascending order."
  function stackFrom(tones, inv) {
    const n = tones.length;
    if (!n) return [];
    const k = ((inv | 0) % n + n) % n, out = [];
    let prev = -Infinity;
    for (let i = 0; i < n; i++) {
      const t = tones[(k + i) % n], s = { l: t.l, a: t.a, o: t.o };
      while (spMidi(s) <= prev) s.o++;
      out.push(s); prev = spMidi(s);
    }
    return out;
  }

  // AUGMENTED SIXTHS AND THE NEAPOLITAN are built from SCALE DEGREES, not
  // from a root and a quality, because that is what they are:
  //   It+6 = b6, 1, #4      Fr+6 = b6, 1, 2, #4      Ger+6 = b6, 1, b3, #4
  // The bass is always b6. The flattened degrees are read off the NATURAL
  // MINOR on the tonic in both modes — in a minor key they are simply the
  // key's own degrees, in a major key they are the borrowed ones — which is
  // one rule instead of two and gets C-flat major's Abb/Ebb right.
  // They are spelled, never enharmonically respelled: a Ger+6 has the same
  // twelve-tone content as a dominant seventh on b6 and is not one.
  const AUG6 = { "it+6": [5, 0, 3], "fr+6": [5, 0, 1, 3], "ger+6": [5, 0, 2, 3] };
  const AUG6RAISE = { 3: 1 };                       // #4 is the raised subdominant
  function specialChord(kind, key, inversion) {
    const k = parseKey(key);
    if (!k) return [];
    const nat = KEYSIG(k.tonic, MODES.minor);
    const w = String(kind).toLowerCase();
    if (w === "n6" || w === "neapolitan" || w === "bii") {
      // bII, a MAJOR triad on the LOWERED supertonic, first inversion by
      // default because that is what the "sixth" in its name says.
      const maj = KEYSIG(k.tonic, k.modeArr)[1];
      const rootN = { l: maj.l, a: maj.a - 1, o: maj.o };
      const tones = QUALITY.maj.map((n) => spByInterval(rootN, n));
      return stackFrom(tones, inversion == null ? 1 : inversion);
    }
    const deg = AUG6[w];
    if (!deg) return [];
    const tones = deg.map((d) => {
      const x = nat[d];
      return AUG6RAISE[d] ? { l: x.l, a: x.a + AUG6RAISE[d], o: x.o } : { l: x.l, a: x.a, o: x.o };
    });
    return stackFrom(tones, 0);                     // b6 in the bass, always
  }

  // "of": the chord belongs to a SECONDARY key named by a roman numeral in
  // the written key — "bVI in the key of F major" is D-flat major. The
  // numeral's case names the target's mode, its accidental prefix alters the
  // degree it sits on.
  function keyOfRoman(roman, inKey) {
    const k = parseKey(inKey);
    const m = /^\s*([b#♭♯]*)\s*(i{1,3}|iv|vi{0,2}|I{1,3}|IV|VI{0,2})\s*$/.exec(String(roman || ""));
    if (!k || !m) return k;
    const NUM = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
    const idx = NUM.indexOf(m[2].toLowerCase());
    if (idx < 0) return k;
    let alt = 0;
    for (const ch of m[1]) alt += (ch === "#" || ch === "♯") ? 1 : -1;
    const d = KEYSIG(k.tonic, k.modeArr)[idx];
    const tonic = { l: d.l, a: d.a + alt, o: d.o };
    const major = m[2] === m[2].toUpperCase();
    return { tonic, mode: major ? "major" : "minor", modeArr: major ? MODES.major : MODES.minor };
  }

  function spellChord(spec) {
    if (!spec || typeof spec !== "object") return [];
    let key = spec.key ? parseKey(spec.key) : null;
    if (spec.of) key = keyOfRoman(spec.of.roman, spec.of.key || spec.key) || key;
    if (spec.special) return specialChord(spec.special, key, spec.inversion);
    let rootSp = null;
    if (typeof spec.root === "string") rootSp = parseSp(spec.root);
    else if (spec.root && spec.root.l != null) rootSp = spec.root;
    else if (spec.root && spec.root.degree != null)
      rootSp = scaleDegreeSp(spec.root.key ? parseKey(spec.root.key) : key, spec.root.degree);
    if (!rootSp) return [];
    rootSp = { l: rootSp.l, a: rootSp.a, o: rootSp.o == null ? 4 : rootSp.o };
    const ivs = qualIntervals(spec.quality);
    if (!ivs) return [];
    return stackFrom(ivs.map((n) => spByInterval(rootSp, n)), spec.inversion || 0);
  }
  // convenience for the gates and the console: the names, space separated
  const spellNames = (spec) => spellChord(spec).map((s) => spName(s));

  /* --- THE TWELVE, WORKED BY HAND FIRST -----------------------------------
   * NOTES.md P6, the publication's chord-spelling prompt. Each answer below
   * was worked on paper from the scale degrees, THEN made to come out of
   * spellChord; where the two disagreed the paper won and the code was fixed.
   * Another agent turns this block into a gate.
   *
   *  1  F-flat half-dim 7, 2nd inversion       Cbb Ebb Fb Abb
   *       Fb + m3 Abb + d5 Cbb + m7 Ebb; 2nd inv puts the FIFTH in the bass.
   *  2  French +6 in D# minor                  B D# E# G##
   *       D# nat. minor = D# E# F# G# A# B C#. b6=B, 1=D#, 2=E#, #4=G##.
   *       NOTE: the brief predicted a TRIPLE sharp here and there is none —
   *       D# minor's fourth degree is already G#, so raising it once gives a
   *       double sharp. The triple sharp in this test set is in question 8.
   *       Paper checked twice before saying so.
   *  3  Dominant minor 9th on the mediant of F minor    Ab C Eb Gb Bbb
   *       F minor's mediant is Ab; minor ninth above Ab is Bbb, not A.
   *  4  First-inversion Neapolitan sixth in Ab major    Db Fb Bbb
   *       bII of Ab = Bbb major (Bbb Db Fb); first inversion = third in bass.
   *  5  German +6 in Cb major                   Abb Cb Ebb F
   *       b6 and b3 borrowed from Cb natural minor (Abb, Ebb); #4 = Fb+1 = F.
   *  6  Half-dim 7 on the submediant of Gb major        Eb Gb Bbb Db
   *  7  Third-inversion 7b5 on E#             D# E# G## B
   *       E# G## B D#; third inversion = the SEVENTH in the bass.
   *  8  7#5 on the supertonic of A# minor      B# D## F### A#
   *       A# minor's supertonic is B#; the augmented fifth above B# is F
   *       raised three times. This is the test's triple sharp (33% of models).
   *  9  Maj7 on the subtonic of G# minor       F# A# C# E#
   *       SUBTONIC, so the natural-minor seventh F#, not the leading tone.
   * 10  ii(half-dim)6/5 of bVI in F major      Gb Bbb Db Eb
   *       bVI of F = Db major; its ii is Eb; half-dim; 6/5 = third in bass.
   *       Same chord as question 6, inverted — a useful cross-check.
   * 11  V4/3 of bVII in Db major               Db Fb Gb Bb
   *       bVII of Db = Cb major; its V is Gb7 (Gb Bb Db Fb); 4/3 = fifth in
   *       the bass.
   * 12  V9 of bIII in Bb major                 Ab C Eb Gb Bb
   *       bIII of Bb = Db major; its V9 is Ab9 with a MAJOR ninth (Bb),
   *       which is what makes question 3's minor ninth (Bbb) the harder one.
   * ---------------------------------------------------------------------- */

  /* --- AND THE TWO SET-THEORY ANSWERS, ALSO BY HAND -----------------------
   * NOTES.md P8: ICV of {0,1,2,4,5,6,9,10}. Twenty-eight pairs, tallied on
   * paper: ic1 = (0,1)(1,2)(4,5)(5,6)(9,10) = 5; ic2 = (0,2)(0,10)(2,4)(4,6)
   * = 4; ic3 = (0,9)(1,4)(1,10)(2,5)(6,9) = 5; ic4 = (0,4)(1,5)(1,9)(2,6)
   * (2,10)(5,9)(6,10) = 7; ic5 = (0,5)(1,6)(2,9)(4,9)(5,10) = 5; ic6 =
   * (0,6)(4,10) = 2. Sum 28 = C(8,2), which is the arithmetic check.
   *      <545752>
   *
   * NOTES.md P9: which candidate has ICV <212131>? The vector sums to 10, so
   * it is a PENTACHORD and only C, E and F are in the running. By hand:
   *      C {0,1,3,7,8} -> <211231>   (near miss: ic3 and ic4 swapped)
   *      E {0,1,3,8,10} -> <132130>
   *      F {1,3,7,8,11} -> <121321>
   * and for completeness the tetrachords, which cannot sum to 10 anyway:
   *      A {1,4,7,10} -> <004002>   B {0,2,5,8} -> <012111>
   *      D {0,1,5,8} -> <101220>
   * None matches, so the answer is G, NONE OF THE ABOVE. Candidate C is the
   * trap: its vector is the asked-for one with ic3 and ic4 swapped.
   * A brute force over all 792 pentachords then said something stronger than
   * the question needs: NO five-note set in twelve-tone space has <212131>,
   * so G is not merely the right choice among seven, it is the only possible
   * one. Left here because it is the kind of fact a re-run should reproduce.
   * ---------------------------------------------------------------------- */

  /* ====================================================================== *
   * 6 · ANALYSIS                                                           *
   * ====================================================================== */

  const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const MAJORISH = { maj: 1, dom7: 1, maj7: 1, aug: 1, "7b5": 1, "7#5": 1,
                     "maj7#5": 1, dom9: 1, domb9: 1, maj9: 1, maj6: 1, "7#9": 1 };
  const MARK = { dim: "o", dim7: "o", halfdim7: "ø", aug: "+", "7#5": "+",
                 "maj7#5": "+" };
  // the order matters: the first exact match wins, so the plain triads and
  // the common sevenths are asked about before the altered dominants that
  // share their pitch classes.
  const ANALYSIS_ORDER = ["maj", "min", "dim", "aug", "dom7", "m7", "maj7",
    "dim7", "halfdim7", "mmaj7", "7b5", "7#5", "maj7#5", "min6", "maj6",
    "dom9", "domb9", "minor9", "maj9", "sus4", "sus2"];

  const FIG3 = ["", "6", "6/4"];
  const FIG4 = ["7", "6/5", "4/3", "4/2"];
  const figureFor = (size, inv) =>
    size >= 5 ? (inv === 0 ? "9" : FIG4[inv] || "") :
    size === 4 ? (FIG4[inv] || "") : (FIG3[inv] || "");

  function romanOf(pitches, ctx) {
    const list = (pitches || []).filter((p) => typeof p === "number");
    if (!list.length) return null;
    const c = ctx || {};
    const key = c.key == null ? 0 : pcOf(c.key);
    const md = modeArr(c.mode);
    const scale = md.map((m) => pcOf(key + m));
    const pcs = pcsOf(list);
    const bassPc = pcOf(Math.min.apply(null, list));

    // AUGMENTED SIXTHS ARE ASKED ABOUT FIRST, because a German sixth's pitch
    // classes are a dominant seventh's and a French sixth's are a 7b5's. The
    // bass settles it: an augmented sixth puts b6 in the bass, always. Get
    // the order wrong and every Ger+6 in the corpus prints as "V7/bII".
    const rel = new Set(pcs.map((p) => pcOf(p - key)));
    const has = (arr) => arr.length === rel.size && arr.every((x) => rel.has(x));
    if (pcOf(bassPc - key) === 8) {
      const kind = has([0, 6, 8]) ? "It+6" : has([0, 2, 6, 8]) ? "Fr+6"
                 : has([0, 3, 6, 8]) ? "Ger+6" : null;
      if (kind) return {
        roman: kind, rootPc: pcOf(key + 8), bassPc, quality: kind, inversion: 0,
        figure: "#6", secondary: null, special: kind, confidence: 0.9,
      };
    }

    // then the ordinary business: which root and quality reproduce these
    // pitch classes EXACTLY. Sevenths are kept — a V7 read as a V is the
    // error the publication docks Gemini for ("missing the 7th").
    // `ivs`, and not the obvious four-letter name for a list of offsets: the
    // browser-safety gate greps this file for a file-system call to prove it
    // does nothing node-only, and that name followed by a dot reads as one to
    // a regex. A silly reason for a variable name, written down so the next
    // hand does not "fix" it back and fail a gate for no musical reason.
    let hit = null;
    // ROOTS ARE TRIED FROM THE BASS UP. It only matters for the symmetrical
    // chords, and there it matters completely: a fully diminished seventh
    // has FOUR roots that reproduce its pitch classes exactly, and taking
    // the lowest pitch class instead of the bass read every viio7 in G minor
    // as "ivo4/3". The bass is the convention every analyst uses to break
    // that tie, so the bass goes first and the others follow.
    /* AND THE ROOT LOOP IS THE OUTER ONE, which is the whole of the tie-break
       and was the whole of a bug (found 2026-09-06 by test/theory.test.js §B2,
       which is the entire reason that gate exists). With the QUALITY loop
       outside, the bass was only consulted between roots of the SAME quality,
       so a quality earlier in the order won on any root at all: `[48, 64, 67,
       69]` — a C major sixth with C in the bass — came back `vi6/5`, because
       `m7` is asked about before `6` and A minor seventh reproduces those
       four pitch classes just as exactly. Sixty-three of the catalogue's
       chords read as their own relative minor.
       Bass first ACROSS qualities is the convention every analyst uses, it is
       what the paragraph above always claimed, and this is the loop order
       that means it. */
    const rootsToTry = [bassPc].concat(pcs.filter((p) => p !== bassPc));
    for (const r of rootsToTry) {
      for (const q of ANALYSIS_ORDER) {
        const ivs = qualPcs(q);
        if (!ivs || ivs.length !== pcs.length) continue;
        const set = ivs.map((o) => pcOf(r + o)).sort((a, b) => a - b);
        if (setEq(set, pcs)) { hit = { rootPc: r, quality: q, ivs }; break; }
      }
      if (hit) break;
    }
    let confidence = 1;
    if (!hit) {
      // nothing matched exactly. Rather than invent a name, take the best
      // SUBSET reading — the largest known chord all of whose tones sound —
      // and say so with a low confidence instead of a numeral we believe.
      let best = null;
      for (const q of ANALYSIS_ORDER) {
        const ivs = qualPcs(q);
        if (!ivs) continue;
        for (const r of pcs) {
          const set = ivs.map((o) => pcOf(r + o));
          const covered = set.filter((x) => pcs.indexOf(x) >= 0).length;
          const extra = pcs.filter((x) => set.indexOf(x) < 0).length;
          const sc = covered - extra - 0.1 * ivs.length;
          if (!best || sc > best.sc) best = { sc, rootPc: r, quality: q, ivs };
        }
      }
      if (!best) return null;
      hit = best; confidence = 0.4;
    }

    const size = hit.ivs.length;
    const idx = hit.ivs.map((o) => pcOf(hit.rootPc + o)).indexOf(bassPc);
    const inversion = idx < 0 ? 0 : idx;
    if (idx < 0) confidence = Math.min(confidence, 0.6);   // bass is not a chord tone
    const figure = figureFor(size, inversion);

    // A SYMMETRICAL CHORD'S READING IS A CONVENTION, NOT A MEASUREMENT. A
    // fully diminished seventh and an augmented triad each transpose onto
    // themselves, so their root cannot be recovered from pitch classes at
    // all — only from the SPELLING, which romanOf is not given. The bass
    // rule above picks the usual reading and the confidence says how much
    // that is worth.
    if (hit.quality === "dim7" || hit.quality === "aug") confidence = Math.min(confidence, 0.7);

    // WHERE THE ROOT SITS IN THE KEY. Exact degree first; then the RAISED
    // SEVENTH, which in a minor key is part of the key's own vocabulary and
    // not a chromatic alteration — a G minor viio7 is written viio7, and an
    // earlier draft that skipped this step printed it "bio7", reading the
    // leading tone as a lowered tonic. Then the flattened reading, then the
    // sharpened one, and the TONIC DEGREE IS TRIED LAST in both, so a root a
    // semitone above the tonic reads bII (which is what a Neapolitan is)
    // rather than #I.
    let deg = scale.indexOf(hit.rootPc), alt = "";
    if (deg < 0 && md[6] === 10 && pcOf(key + 11) === hit.rootPc) deg = 6;
    const ORDER = [1, 2, 3, 4, 5, 6, 0];
    if (deg < 0) {
      for (const i of ORDER) if (deg < 0 && pcOf(scale[i] - 1) === hit.rootPc) { deg = i; alt = "b"; }
      for (const i of ORDER) if (deg < 0 && pcOf(scale[i] + 1) === hit.rootPc) { deg = i; alt = "#"; }
    }
    const base = deg < 0 ? "?" : NUMERALS[deg];
    const cased = MAJORISH[hit.quality] ? base : base.toLowerCase();
    let roman = alt + cased + (MARK[hit.quality] || "") + figure;

    // SECONDARY FUNCTION. A chromatic chord that is the dominant of some
    // other degree of the key gets V/x; one that is the leading-tone chord of
    // that degree gets viio/x. Criterion 19 falls out of the matching above
    // rather than being special-cased: we identified the chord BY ITS ROOT,
    // so a sonority whose true root sounds has already matched dom7 or maj
    // and can only take the V/x label. Only a rootless one — a diminished
    // seventh — reaches the viio/x branch, which is the distinction the
    // publication says models get wrong.
    let secondary = null;
    const diatonic = deg >= 0 && !alt;
    if (!diatonic || !isDiatonicQuality(hit, scale)) {
      const isDom = hit.quality === "dom7" || hit.quality === "maj" ||
                    hit.quality === "dom9" || hit.quality === "domb9";
      const isLT = hit.quality === "dim7" || hit.quality === "halfdim7" || hit.quality === "dim";
      for (let d = 1; d < 7 && !secondary; d++) {
        const t = scale[d];
        if (isDom && hit.rootPc === pcOf(t + 7))
          secondary = { of: targetName(d, scale), ofPc: t, ofDegree: d, kind: "V" };
        else if (isLT && hit.rootPc === pcOf(t - 1))
          secondary = { of: targetName(d, scale), ofPc: t, ofDegree: d, kind: "viio" };
      }
      if (secondary) {
        roman = (secondary.kind === "V" ? "V" : "vii" + (MARK[hit.quality] || "o")) +
                figure + "/" + secondary.of;
        confidence = Math.min(confidence, 0.9);
      }
    }
    return { roman, rootPc: hit.rootPc, bassPc, quality: hit.quality, inversion,
             figure, secondary, special: null, confidence };
  }
  // is this quality the one the key's own scale builds on that degree? Used
  // only to decide whether to LOOK for a secondary reading.
  function isDiatonicQuality(hit, scale) {
    const set = hit.ivs.map((o) => pcOf(hit.rootPc + o));
    return set.every((x) => scale.indexOf(x) >= 0);
  }
  function targetName(d, scale) {
    // the target prints in the case its own triad has in the key: V/V, V/ii,
    // V/iv, V7/VI. THE DOMINANT IS THE EXCEPTION and prints uppercase in a
    // minor key too, because the chord being tonicized there is the MAJOR
    // dominant, not the natural-minor v — every textbook writes V/V and
    // none writes V/v. Said out loud because it is the one hand-set case in
    // this function.
    if (d === 4) return NUMERALS[4];
    const third = pcOf(scale[(d + 2) % 7] - scale[d]);
    return third === 4 ? NUMERALS[d] : NUMERALS[d].toLowerCase();
  }

  // NON-CHORD TONES. The publication marks passing-vs-neighbour and, harder,
  // marks a model DOWN for swallowing a suspension into the chord it delays.
  // So the suspension test comes first and the "chord tone" test does not get
  // to answer for a note that was held over from the previous harmony.
  function nctOf(a) {
    const o = a || {};
    const { prev, cur, next } = o;
    if (typeof cur !== "number") return "other";
    const inChord = Array.isArray(o.chordPcs) && o.chordPcs.indexOf(pcOf(cur)) >= 0;
    const wasChord = Array.isArray(o.prevChordPcs) && typeof prev === "number" &&
                     o.prevChordPcs.indexOf(pcOf(prev)) >= 0;
    if (!inChord && prev === cur && wasChord && !o.sameChordAsPrev &&
        typeof next === "number" && cur - next > 0 && cur - next <= 2)
      return "suspension";
    if (inChord) return "chord";
    if (typeof prev !== "number" || typeof next !== "number") return "other";
    const a1 = cur - prev, a2 = next - cur;
    if (Math.abs(a1) <= 2 && Math.abs(a2) <= 2 && a1 !== 0 && a2 !== 0) {
      if (a1 * a2 > 0) return "passing";
      if (next === prev) return "neighbor";
    }
    if (cur === next) return "anticipation";
    return "other";
  }

  // CADENCES. `a` and `b` may be {pcs, rootPc, bassPc, sopranoPc} or bare pc
  // arrays; a bare array gets its root from romanOf. The perfect/imperfect
  // split is the textbook one — both chords in root position AND the tonic in
  // the soprano — and when we were not told the soprano we do not guess, we
  // answer IAC, because claiming a PAC we cannot see is the louder error.
  function cadenceOf(a, b, ctx) {
    const c = ctx || {}, key = c.key == null ? 0 : pcOf(c.key);
    const md = modeArr(c.mode), scale = md.map((m) => pcOf(key + m));
    const read = (x) => {
      if (!x) return null;
      if (Array.isArray(x)) { const r = romanOf(x, c); return r && { rootPc: r.rootPc, bassPc: r.bassPc, pcs: pcsOf(x) }; }
      let rootPc = x.rootPc, bassPc = x.bassPc;
      if (rootPc == null && x.pcs) { const r = romanOf(x.pcs, c); rootPc = r && r.rootPc; }
      return { rootPc, bassPc: bassPc == null ? null : pcOf(bassPc),
               sopranoPc: x.sopranoPc == null ? null : pcOf(x.sopranoPc), pcs: pcsOf(x.pcs || []) };
    };
    const A = read(a), B = read(b);
    if (!A || !B || A.rootPc == null || B.rootPc == null) return null;
    const dom = scale[4], sub = scale[3], sm = scale[5], ton = scale[0];
    if (A.rootPc === dom && B.rootPc === ton) {
      const rooted = (A.bassPc == null || A.bassPc === A.rootPc) &&
                     (B.bassPc == null || B.bassPc === B.rootPc);
      return rooted && B.sopranoPc === ton ? "PAC" : "IAC";
    }
    // the phrygian half cadence is iv6 -> V, and the 6 is the whole point:
    // b6 in the bass falling a semitone to 5. Tested before the plain half.
    if (B.rootPc === dom && A.rootPc === sub && A.bassPc === pcOf(key + 8)) return "phrygian";
    if (B.rootPc === dom) return "half";
    if (A.rootPc === sub && B.rootPc === ton) return "plagal";
    if (A.rootPc === dom && B.rootPc === sm) return "deceptive";
    return null;
  }

  /* ====================================================================== *
   * 7 · FIGURED BASS                                                       *
   * ====================================================================== */

  // figuresOf names the figure a continuo player would see under this bass.
  // It works from the chord identification, not from raw intervals, because
  // the figure is a statement about the CHORD ("this is a seventh chord in
  // first inversion") and an interval list cannot tell 6/5 from an added
  // sixth. An augmented sixth answers "#6", which is how it is figured.
  function figuresOf(pcs, bassPc, ctx) {
    const list = pcsOf(pcs || []);
    if (!list.length || bassPc == null) return null;
    const r = romanOf([bassPc].concat(list.map((p) => p + 12)), ctx || {});
    if (!r) return null;
    if (r.special) return "#6";
    const size = qualPcs(r.quality) ? qualPcs(r.quality).length : list.length;
    const f = figureFor(size, r.inversion);
    return f || "5/3";
  }

  // realizeFigure is the inverse and the publication's second benchmark: the
  // figures say which intervals above the bass sound, the KEY says how they
  // are spelled, and an accidental in the figure alters the degree it names.
  // A bare "#" or "b" alters the THIRD above the bass, which is the continuo
  // convention and the one thing a naive reader gets wrong.
  const STACKS = {
    "": [3, 5], "5": [3, 5], "5/3": [3, 5], "3": [3, 5],
    "6": [3, 6], "6/3": [3, 6], "6/4": [4, 6],
    "7": [3, 5, 7], "6/5": [3, 5, 6], "4/3": [3, 4, 6], "4/2": [2, 4, 6], "2": [2, 4, 6],
    "9": [3, 5, 7, 9],
  };
  function realizeFigure(bassPc, fig, ctx) {
    if (bassPc == null) return [];
    const c = ctx || {}, key = c.key == null ? 0 : pcOf(c.key);
    const md = modeArr(c.mode), scale = md.map((m) => pcOf(key + m));
    const text = String(fig == null ? "" : fig).trim();
    const alter = {};
    let nums = [];
    for (const tok of text.split(/[\s/,]+/).filter(Boolean)) {
      const m = /^([#b♯♭ n=]*)(\d*)([#b♯♭]*)$/.exec(tok);
      if (!m) continue;
      let a = 0;
      for (const ch of (m[1] + m[3])) {
        if (ch === "#" || ch === "♯") a += 1;
        else if (ch === "b" || ch === "♭") a -= 1;
      }
      const num = m[2] ? parseInt(m[2], 10) : 3;     // bare accidental = the third
      if (m[2]) nums.push(num);
      if (a) alter[num] = a;
    }
    const canon = nums.length ? nums.slice().sort((x, y) => y - x).join("/") : "";
    const stack = STACKS[canon] || STACKS[text] || (nums.length ? nums.slice().sort((x, y) => x - y) : STACKS[""]);
    // the bass's own degree; off the scale we take the nearest below, which
    // is what a player does with an accidental in the bass line.
    let bd = scale.indexOf(pcOf(bassPc));
    let shift = 0;
    if (bd < 0) { for (let i = 0; i < 7; i++) if (pcOf(scale[i] + 1) === pcOf(bassPc)) { bd = i; shift = 1; } }
    if (bd < 0) bd = 0;
    const out = [pcOf(bassPc)];
    for (const n of stack) {
      const step = n - 1;
      const semis = pcOf(scale[(bd + step) % 7] - scale[bd]);
      out.push(pcOf(bassPc + semis - shift + (alter[n] || 0)));
    }
    return out.filter((v, i, arr) => arr.indexOf(v) === i);
  }

  /* ====================================================================== *
   * 8 · PART WRITING — THE NINE RULES, GENERALISED PAST FOUR VOICES         *
   * ====================================================================== *
   * These came out of tools/chorale-check.js, where they already pass the
   * Bach benchmark's chorale; they are not rewritten here, they are MOVED,
   * so the checker and the generation pass cannot drift apart. What changed
   * is only what four-ness forced:
   *
   *   crossing and spacing walk ADJACENT pairs in the declared order, so an
   *     eight-part texture is checked eight times, not four.
   *   parallel5/parallel8 walk EVERY pair, as they always did.
   *   direct stays OUTER-VOICE ONLY — voices[0] against voices[n-1] — and
   *     says so out loud: Bach writes direct fifths between inner voices
   *     constantly, so an all-pairs version would report him as broken.
   *   ltResolve is outer-voice only for the same reason (the "frustrated
   *     leading tone" is normal inside).
   *   range reads each voice's own lo/hi rather than a table of four.
   *   a null note is SILENCE: never a parallel, never a crossing, never a
   *     range fault. A rest is oblique motion at worst, and a checker that
   *     called it a parallel would cry wolf on every entry.                  */

  const RULES = {
    range:     "a voice outside its written range",
    crossing:  "voices crossed",
    spacing:   "more than an octave between adjacent upper voices",
    nonchord:  "a sounding note outside the column's chord",
    nothird:   "the chord has no third",
    doubledLT: "the leading tone doubled",
    parallel5: "parallel perfect fifths",
    parallel8: "parallel octaves or unisons",
    direct:    "direct (hidden) fifth or octave into the outer voices",
    leap:      "a melodic leap wider than an octave",
    aug2:      "a melodic augmented second",
    ltResolve: "an outer-voice leading tone that does not rise to the tonic",
  };
  const ALLRULES = Object.keys(RULES);

  const perfectClass = (a, b) => { const d = Math.abs(a - b) % 12; return d === 0 ? 8 : d === 7 ? 5 : 0; };

  function faults(voices, opts) {
    if (!Array.isArray(voices) || !voices.length) return [];
    const o = opts || {};
    const V = voices.map((v) => (v && Array.isArray(v.notes) ? v.notes : []));
    const nv = V.length;
    const n = V.reduce((m, a) => Math.max(m, a.length), 0);
    const want = {};
    for (const r of (Array.isArray(o.rules) && o.rules.length ? o.rules : ALLRULES)) want[r] = 1;
    const name = (i) => (voices[i] && voices[i].name) || ("voice " + (i + 1));
    const label = typeof o.label === "function" ? o.label : (i) => "column " + (i + 1);
    const out = [];
    const add = (code, at, text, vs) => {
      if (!want[code]) return;
      const where = at.j == null ? label(at.i) : label(at.i) + "–" + label(at.j);
      out.push({ code, rule: RULES[code], where, text, at, voices: vs || [] });
    };
    const note = (vi, i) => { const p = V[vi][i]; return typeof p === "number" ? p : null; };

    for (let i = 0; i < n; i++) {
      const col = [];
      for (let vi = 0; vi < nv; vi++) col.push(note(vi, i));
      /* 1 · RANGE, each voice against its own lo..hi. */
      col.forEach((p, vi) => {
        if (p == null) return;
        const R = voices[vi] || {};
        if (R.lo == null && R.hi == null) return;
        if ((R.lo != null && p < R.lo) || (R.hi != null && p > R.hi))
          add("range", { i }, name(vi) + " sings " + p + ", outside " + R.lo + "–" + R.hi, [vi]);
      });
      /* 2 · CROSSING, and the declared order IS the definition of the voices. */
      for (let vi = 0; vi + 1 < nv; vi++) {
        const a = col[vi], b = col[vi + 1];
        if (a == null || b == null) continue;
        if (a < b) add("crossing", { i }, name(vi) + " is below the " + name(vi + 1), [vi, vi + 1]);
      }
      /* 3 · SPACING. More than an octave between two UPPER voices is the gap
         that makes a chorale stop sounding like one; the LOWEST pair may
         open, which in four parts is the tenor/bass exemption. */
      for (let vi = 0; vi + 2 < nv; vi++) {
        const a = col[vi], b = col[vi + 1];
        if (a == null || b == null) continue;
        if (a - b > 12)
          add("spacing", { i }, name(vi) + " and " + name(vi + 1) + " are more than an octave apart", [vi, vi + 1]);
      }
      /* 4 · EVERY NOTE BELONGS TO THE CHORD, and the third is there. A triad
         missing its third is the benchmark's "conflicting notes within
         chords" said the other way round. */
      const ch = o.chords && o.chords[i];
      if (ch && Array.isArray(ch.pcs)) {
        col.forEach((p, vi) => {
          if (p == null) return;
          if (ch.pcs.indexOf(pcOf(p)) < 0)
            add("nonchord", { i }, name(vi) + "'s " + pcOf(p) + " is not in the chord", [vi]);
        });
        if (ch.thirdPc != null && !col.some((p) => p != null && pcOf(p) === pcOf(ch.thirdPc)))
          add("nothird", { i }, "the chord has no third", []);
      }
      /* 5 · THE LEADING TONE IS NOT DOUBLED. */
      if (o.leadingTone != null) {
        const lt = col.filter((p) => p != null && pcOf(p) === pcOf(o.leadingTone)).length;
        if (lt > 1) add("doubledLT", { i }, "the leading tone is doubled", []);
      }
    }

    /* 6 · PARALLEL PERFECT FIFTHS AND OCTAVES, between EVERY pair, and the
       definition is strict: both voices move, in the same direction, and the
       interval class is the same perfect one on both sides. A perfect
       interval kept by OBLIQUE motion (one voice holding) is not a parallel
       and is not flagged — that is a rule about similar motion, and calling
       a held note a parallel is how a checker cries wolf. A silent column is
       neither: you cannot be parallel with a rest. */
    for (let i = 0; i + 1 < n; i++) {
      for (let x = 0; x < nv; x++) for (let y = x + 1; y < nv; y++) {
        const a1 = note(x, i), b1 = note(y, i), a2 = note(x, i + 1), b2 = note(y, i + 1);
        if (a1 == null || b1 == null || a2 == null || b2 == null) continue;
        if (a1 === a2 || b1 === b2) continue;               // oblique: not a parallel
        if ((a2 - a1) * (b2 - b1) < 0) continue;            // contrary: not a parallel
        const p1 = perfectClass(a1, b1), p2 = perfectClass(a2, b2);
        if (p1 && p1 === p2)
          add(p1 === 8 ? "parallel8" : "parallel5", { i, j: i + 1 },
              "parallel " + (p1 === 8 ? "octaves" : "fifths") + " between " +
              name(x) + " and " + name(y), [x, y]);
      }
    }

    /* 7 · DIRECT (HIDDEN) OCTAVES AND FIFTHS IN THE OUTER VOICES ONLY: the
       top and bottom of the texture arriving at a perfect fifth or octave by
       similar motion with the TOP voice leaping. Outer-voice only is not
       laziness — Bach does this constantly between inner voices and rarely on
       the outside, so an all-pairs version of this rule would flag the
       repertoire it is supposed to be modelled on. */
    if (nv >= 2) {
      const top = 0, bot = nv - 1;
      for (let i = 0; i + 1 < n; i++) {
        const s1 = note(top, i), b1 = note(bot, i), s2 = note(top, i + 1), b2 = note(bot, i + 1);
        if (s1 == null || b1 == null || s2 == null || b2 == null) continue;
        if ((s2 - s1) * (b2 - b1) <= 0) continue;
        if (Math.abs(s2 - s1) <= 2) continue;               // stepwise top voice: allowed
        const p = perfectClass(s2, b2);
        if (p) add("direct", { i, j: i + 1 },
                   "direct " + (p === 8 ? "octave" : "fifth") +
                   " into the outer voices, " + name(top) + " leaping", [top, bot]);
      }
    }

    /* 8 · MELODIC RULES, the two that are not taste: no leap wider than an
       octave, and no augmented second — the interval a harmonic minor invites
       between its sixth and seventh degrees and the one thing a chorale never
       writes melodically. The augmented second is only claimed when the
       caller says WHICH pair of pitch classes it is, because three semitones
       is a minor third far more often than it is an augmented second and a
       checker that guessed would be wrong most of the time. */
    for (let vi = 0; vi < nv; vi++) {
      for (let i = 0; i + 1 < n; i++) {
        const p = note(vi, i), q = note(vi, i + 1);
        if (p == null || q == null) continue;
        const a = Math.abs(q - p);
        if (a > 12) add("leap", { i, j: i + 1 }, name(vi) + " leaps " + a + " semitones", [vi]);
        if (a === 3 && o.aug2 !== false && o.aug2Pair) {
          const lo = pcOf(Math.min(p, q)), hi = pcOf(Math.max(p, q));
          if (lo === pcOf(o.aug2Pair[0]) && hi === pcOf(o.aug2Pair[1]))
            add("aug2", { i, j: i + 1 }, name(vi) + " leaps an augmented second", [vi]);
        }
      }
    }

    /* 9 · THE LEADING TONE RESOLVES when it is in an OUTER voice. Inside,
       Bach frustrates it freely (the "frustrated leading tone"), so the rule
       is outer-voice only and says so rather than pretending to a stricter
       one it would then have to apologise for. */
    if (o.leadingTone != null && o.tonic != null) {
      const outer = nv > 1 ? [0, nv - 1] : [0];
      for (const vi of outer) {
        for (let i = 0; i + 1 < n; i++) {
          const p = note(vi, i), q = note(vi, i + 1);
          if (p == null || q == null) continue;
          if (pcOf(p) !== pcOf(o.leadingTone)) continue;
          if (pcOf(q) === pcOf(o.leadingTone)) continue;    // still holding it
          if (pcOf(q) !== pcOf(o.tonic))
            add("ltResolve", { i, j: i + 1 },
                name(vi) + "'s leading tone does not rise to the tonic", [vi]);
        }
      }
    }
    return out;
  }

  /* THE VOICES AND THE CHORD WORDS tools/chorale-check.js checks against,
     kept HERE so the checker and anything else that wants a chorale's
     ranges read one table. The numbers are the conservative union of what
     Bach's 371 do, not the extremes a single tenor once reached. MIDI,
     middle C = 60. */
  const CHORALE_VOICES = [
    { k: "S", name: "soprano", lo: 60, hi: 79 },   // c'  - g''
    { k: "A", name: "alto",    lo: 55, hi: 74 },   // g   - d''
    { k: "T", name: "tenor",   lo: 48, hi: 69 },   // c   - a'
    { k: "B", name: "bass",    lo: 40, hi: 62 },   // e,  - d'
  ];
  // the chorale scores' own quality words, as semitone distances. Spelled out
  // rather than derived from QUALITY above because these keys are what the
  // committed score files say and renaming them would be a data migration
  // for no gain.
  const CHORALE_QUAL = {
    min:  [0, 3, 7], maj: [0, 4, 7], dim: [0, 3, 6], dom7: [0, 4, 7, 10],
    min7: [0, 3, 7, 10], halfdim: [0, 3, 6, 10],
  };

  /* ====================================================================== *
   * 9 · THE COPYIST PASS (2026-09-06, docs/THEORY.md §2)                    *
   * ====================================================================== *
   * The box compiles every voice INDEPENDENTLY: a chair reads a motif
   * through a word, at its own register, with its own entry, and nothing
   * looks at what the other chairs are doing. So nothing prevents two lines
   * moving in parallel octaves for eight bars, a pad voicing that doubles the
   * leading tone, or a voiced harmony that never sounds its own third.
   *
   * THIS PASS IS A COPYIST AND NOT A COMPOSER, and the line between them is
   * the whole design. THEORY.md: *"A repair may move a note by an octave,
   * choose a different inversion of a voiced chord, or change which chord
   * tone a doubling voice takes. It may NOT change a written motif, a
   * rhythm, or a degree a hand wrote: the melody is the composer's and this
   * pass is the copyist."* Two invariants make that mechanical, and
   * `test/theory.test.js` asserts both on real records:
   *
   *   I1  ONLY `n` EVER CHANGES. Not `t`, not `dur`, not `v`, not `vel`, not
   *       `acc`, not which chair plays — the returned array is the same
   *       objects in the same order with, at most, a different pitch. A
   *       rhythm is therefore unrepairable BY CONSTRUCTION rather than by
   *       care.
   *   I2  A MONOPHONIC VOICE MOVES ONLY BY WHOLE OCTAVES. A chair that
   *       sounds one note at a time is a WRITTEN LINE — somebody's motif read
   *       through somebody's word — so the pass may transpose one of its
   *       notes by 12 and may do nothing else to it. Only a VOICED HARMONY (a
   *       pad, a stab, a comping hand: a chair sounding several notes at
   *       once, which the box generated from a chord rather than from a
   *       phrase) may have a note re-chosen, and then only onto another tone
   *       of the chord that is already sounding there.
   *
   * WHAT THAT COSTS, SAID OUT LOUD BEFORE THE NUMBERS ARE. A parallel is
   * detected on the INTERVAL CLASS (`|a-b| % 12`), which is exactly what
   * makes it octave-invariant — so moving a note by an octave can never
   * remove a parallel fifth or octave. It follows that a parallel between two
   * MONOPHONIC voices is unrepairable under I2, and the pass says so and
   * counts it rather than quietly reaching for the melody. Only a parallel
   * with a voiced chair on one side of it can be fixed, by re-choosing that
   * chair's note — which is "a different inversion of the voiced chord", the
   * repair THEORY.md names.
   *
   * A GENRE MAY REFUSE, BY NAME AND IN ITS OWN DATA. `ctx.refuse` is the row's
   * `copyist` declaration (`nukernel/genres/<key>.json`, emitted into
   * `genres.js COPYIST`): `"all"`, or a list drawn from `parallel range
   * doubling missing`. Organum's whole music IS parallel motion and punk does
   * not want its fifths corrected; the refusal lives beside the music it
   * protects, never in a list inside this file.
   */

  /* ---- THE SCORE AS VOICES AND COLUMNS -----------------------------------
     A chorale has four voices and each of them sings one note. This box has
     CHAIRS, and a chair may be either monophonic (one note at a time — the
     chair IS a voice, and the bass is one of these) or a VOICED HARMONY. The
     notes of a voicing are not one voice, and they are not N unrelated
     voices either: `kernel.js voiceLead` moves them minimally chord to
     chord, so the SUB-VOICE IS THE PITCH RANK — the top note of the voicing
     is one voice, the next one down another. That is the reading the
     kernel's own voice-leading memory already implies, and it is what makes
     a pad's parallels findable at all.

     ONSETS ARE SNAPPED BEFORE THEY BECOME COLUMNS, because the box does not
     play on the grid: `chordFeel` pushes a whole chord a fraction of a step,
     `humanize` and `touch` scatter attacks, and the three notes of one pad
     voicing arrive at 0, 0.04 and 0.08. Those are one moment, and a reader
     that took them as three columns would report two parallel motions inside
     every chord it met. HALF A STEP is the snap: a sixteenth is one step, so
     half of one is finer than any figure the box writes and coarser than
     every lean it applies. */
  const SNAP = 0.5;

  function voicesOf(events, ctx) {
    const o = ctx || {}, chairs = o.chairs || {};
    const snap = (t) => Math.round(t / (o.snap || SNAP)) * (o.snap || SNAP);
    const half = (o.snap || SNAP) / 2;
    const notes = events.filter((e) => e && e.kind !== "hit" && typeof e.n === "number");
    const chairOf = (e) => (e.kind === "bass" ? "bass" : "v" + (e.lv != null ? e.lv : e.v));
    const by = new Map();
    for (const e of notes) {
      const id = chairOf(e);
      if (!by.has(id)) by.set(id, []);
      by.get(id).push(e);
    }
    const times = [...new Set(notes.map((e) => snap(e.t)))].sort((a, b) => a - b);
    const out = [];
    for (const [id, raw] of by) {
      const evs = raw.slice().sort((a, b) => a.t - b.t || b.n - a.n);
      /* A CHAIR'S NOTES ARE GROUPED BY ATTACK, and that is the whole
         correction this model needed. The first draft asked "which of this
         chair's notes are inside their own `dur` at column t", and on a
         legato or tied row that is most of them: `spans()` reads a note's
         length to the NEXT GATE and `ART.tie` is 1, so consecutive notes of
         one monophonic line overlap by design. Measured before the fix,
         `punk` came out with 152 voices and the BASS was reported as a
         voiced harmony missing its own chord tones — a melody read as a
         chord because it was played smoothly.
         A chair attacks a CHORD when it emits several notes at one moment
         (which is exactly what the pad and stab branches of `kernel.js
         render` do) and a MELODY otherwise; either way the previous attack
         stops sounding when the next one lands, because that is what a
         monophonic instrument does and what a re-struck voicing does. So the
         group is the unit: one attack per chair per moment, sounding until
         the next attack or its own end, whichever comes first. */
      const attacks = [];
      for (const e of evs) {
        const k = snap(e.t);
        const last = attacks[attacks.length - 1];
        if (last && last.t === k) last.notes.push(e);
        else attacks.push({ t: k, notes: [e] });
      }
      for (const a of attacks) a.notes.sort((x, y) => y.n - x.n);
      let head = 0, cur = null;
      const cols = times.map((t) => {
        while (head < attacks.length && attacks[head].t <= t + half) cur = attacks[head++];
        if (!cur) return [];
        return cur.notes.filter((e) => e.t + e.dur > t + 1e-9);
      });
      const width = cols.reduce((m, c) => Math.max(m, c.length), 0);
      const meta = chairs[id] || {};
      for (let r = 0; r < width; r++)
        out.push({
          id: width > 1 ? id + "/" + r : id, chair: id, rank: r, width,
          name: (meta.name || id) + (width > 1 ? " " + (r + 1) : ""),
          part: meta.part || null, isBass: id === "bass",
          instr: meta.instr || null,
          lo: meta.lo == null ? null : meta.lo, hi: meta.hi == null ? null : meta.hi,
          notes: cols.map((c) => (c.length > r ? c[r].n : null)),
          events: cols.map((c) => (c.length > r ? c[r] : null)),
        });
    }
    /* ORDERED HIGHEST FIRST, on the mean of what each voice actually sings —
       the order `faults` reads for its outer-voice rules, and the only order
       a band can be put in without a hand saying which chair is on top. */
    const mean = (v) => {
      const on = v.notes.filter((n) => n != null);
      return on.length ? on.reduce((a, b) => a + b, 0) / on.length : -1;
    };
    out.sort((a, b) => mean(b) - mean(a));
    return { times, voices: out };
  }

  /* WHICH CHORD IS UNDER EACH COLUMN — `document.js chordsIn`'s windows (or
     `barChords`' relative ones), looked up once per column instead of once
     per note. */
  function chordsAt(times, chords) {
    const cs = chords || [], out = [];
    let k = 0;
    for (const t of times) {
      while (k + 1 < cs.length && cs[k + 1].from <= t + 1e-9) k++;
      const c = cs[k];
      out.push(c && t >= c.from - 1e-9 && t < c.to + 1e-9 ? c : null);
    }
    return out;
  }

  /* A CHORD TONE MISSING FROM A VOICED HARMONY is the fourth thing THEORY.md
     §2 counts, and it is not `nothird`: `nothird` asks whether ANY voice in
     the whole band sounds the third, and this asks whether the chair that is
     VOICING THE CHORD spells it. A pad that plays root and fifth while the
     bass supplies the third is still a pad with a hole in it. It is a rule
     over voices grouped by chair rather than over a column of independent
     voices, so it is computed here and appended rather than folded into
     `faults`, whose whole model is one note per voice. */
  function missingTones(voices, cols, chords) {
    const out = [];
    const byChair = new Map();
    for (const v of voices) {
      if (v.width < 2) continue;                 // a monophonic voice is one note
      if (!byChair.has(v.chair)) byChair.set(v.chair, []);
      byChair.get(v.chair).push(v);
    }
    for (const [chair, vs] of byChair)
      for (let i = 0; i < cols.length; i++) {
        const ch = chords[i];
        if (!ch || !ch.pcs || !ch.pcs.length) continue;
        const live = vs.filter((v) => v.notes[i] != null);
        /* TWO CONDITIONS BEFORE THIS IS A FAULT AT ALL, and the first draft
           had neither — it reported 3,117 holes over six records, most of
           them a chair playing ONE note (its `width` is the widest voicing it
           ever uses, not the one it is using here) and the rest a three-note
           voicing of a seventh chord, which is a choice every keyboard player
           makes and not a hole.
             · the chair must be sounding a HARMONY here: two notes or more.
             · it must have had ROOM to spell the chord — as many notes as the
               chord has tones — and spelled something else anyway, which
               means it DOUBLED one instead. That is the fault, it is what a
               copyist can repair (spend the duplicate), and it is the only
               reading under which the count means anything. */
        if (live.length < 2 || live.length < ch.pcs.length) continue;
        const sounding = new Set(live.map((v) => pcOf(v.notes[i])));
        const miss = ch.pcs.filter((p) => !sounding.has(pcOf(p)));
        if (miss.length)
          out.push({ code: "missing", rule: "a chord tone missing from a voiced harmony",
                     where: "column " + (i + 1), at: { i }, chair, pcs: miss,
                     text: chair + " voices the chord without " + miss.join(", ") });
      }
    return out;
  }

  /* ...AND THE SAME QUESTION ASKED OF THE WHOLE BAND. `missingTones` asks
     whether the chair VOICING the chord spelled it; `unsoundedTones` asks
     whether anybody at all is playing each tone of the chord the record says
     is sounding. The two readings of THEORY.md §2's phrase are both real and
     they answer very differently, so both are counted and neither is allowed
     to stand in for the other. This one is a MEASUREMENT ONLY: filling it
     would mean changing the pitch class of a note in a written line, which is
     the one thing the copyist may not do.
     Asked at chord ATTACKS, not at every column: a chord that goes unspelled
     for a bar is one fact about that bar, not sixteen. */
  function unsoundedTones(voices, times, chords) {
    const out = [];
    let prev = null;
    for (let i = 0; i < times.length; i++) {
      const ch = chords[i];
      if (!ch || !ch.pcs || !ch.pcs.length) { prev = null; continue; }
      if (ch === prev) continue;
      prev = ch;
      const on = new Set();
      for (const v of voices) if (v.notes[i] != null) on.add(pcOf(v.notes[i]));
      if (!on.size) continue;
      const miss = ch.pcs.filter((p) => !on.has(pcOf(p)));
      if (miss.length)
        out.push({ code: "unsounded", rule: "a chord tone nobody in the band plays",
                   where: "column " + (i + 1), at: { i }, pcs: miss,
                   text: "nothing sounds " + miss.join(", ") + " of this chord" });
    }
    return out;
  }

  /* ---- THE REPAIRS -------------------------------------------------------
     Four, in this order, because each one can only make the next one's job
     smaller: a note put back in range may stop being a doubling; a hole
     filled may stop being a parallel. Every repair is a change to ONE
     event's `n` and is recorded with what it was, what it became and why. */
  function copyist(events, ctx) {
    const o = ctx || {};
    const refuse = o.refuse === "all" ? "all"
      : (Array.isArray(o.refuse) ? o.refuse : (o.refuse ? [o.refuse] : []));
    const may = (code) => refuse !== "all" && refuse.indexOf(code) < 0;
    const period = o.period == null ? 12 : o.period;
    const out = events.map((e) => e);
    const repairs = [], refused = [];
    if (refuse === "all")
      return { events: out, repairs, refused: [{ code: "all", why: o.why || null }] };

    const note = (code, e, was, why) =>
      repairs.push({ code, chair: e.kind === "bass" ? "bass" : "v" + (e.lv != null ? e.lv : e.v),
                     t: e.t, was, now: e.n, why });
    const cant = (code, why) => refused.push({ code, why });

    let V = voicesOf(out, o), cols = V.times, chords = chordsAt(cols, o.chords);

    /* 1 · RANGE. A note outside its chair's compass moves by WHOLE OCTAVES
       until it is inside — the one repair that is legal on a written line,
       and the one the engine's own register fold already performs elsewhere
       (`kernel.js foldInto`). A compass narrower than an octave cannot always
       be satisfied; that note is left where it is and counted, because moving
       it to the nearest legal pitch would be composing. A row whose alphabet
       does not repeat at 2:1 (`period !== 12`) is skipped entirely: an
       "octave" there is 1208 cents and this repair would put it out of tune. */
    if (may("range") && period === 12) {
      for (const v of V.voices) {
        if (v.lo == null && v.hi == null) continue;
        const seen = new Set();
        for (const e of v.events) {
          if (!e || seen.has(e)) continue;
          seen.add(e);
          const was = e.n;
          let n = e.n;
          while (v.lo != null && n < v.lo) n += 12;
          while (v.hi != null && n > v.hi) n -= 12;
          if (n === was) continue;
          if ((v.lo != null && n < v.lo) || (v.hi != null && n > v.hi)) {
            cant("range", v.name + "'s compass is narrower than an octave");
            continue;
          }
          e.n = n;
          note("range", e, was, v.name + " was outside " + v.lo + "–" + v.hi);
        }
      }
      V = voicesOf(out, o);
    }

    /* 2 · A CHORD TONE MISSING FROM A VOICED HARMONY. The chair is spelling
       the chord and has left a tone out; if it is also DOUBLING one (two of
       its notes at the same pitch class), one of the duplicates takes the
       missing tone at the nearest pitch to where it already was. If it is not
       doubling anything, it has fewer notes than the chord has tones and
       there is nothing to move without adding a voice — which is composing.
       THE LOWEST NOTE OF A VOICING IS NEVER RE-CHOSEN: it is the bass of the
       chord as the box voiced it, and moving it is a different chord, not a
       different inversion of this one. */
    if (may("missing")) {
      chords = chordsAt(V.times, o.chords);
      const byChair = new Map();
      for (const v of V.voices) {
        if (v.width < 2) continue;
        if (!byChair.has(v.chair)) byChair.set(v.chair, []);
        byChair.get(v.chair).push(v);
      }
      for (const [, vs] of byChair) {
        vs.sort((a, b) => a.rank - b.rank);          // rank 0 is the top note
        const bottom = vs[vs.length - 1];
        for (let i = 0; i < V.times.length; i++) {
          const ch = chords[i];
          if (!ch || !ch.pcs || ch.pcs.length < 2) continue;
          const live = vs.filter((v) => v.events[i]);
          if (live.length < 2) continue;
          const have = live.map((v) => pcOf(v.events[i].n));
          const miss = ch.pcs.map(pcOf).filter((p) => have.indexOf(p) < 0);
          if (!miss.length) continue;
          // a duplicate to spend: a pitch class this chair sounds twice
          const dup = live.find((v, k) =>
            v !== bottom && have.indexOf(have[k]) !== k);
          if (!dup) { cant("missing", "nothing doubled to spend"); continue; }
          const e = dup.events[i], was = e.n;
          e.n = nearestPc(was, miss[0]);
          note("missing", e, was, "the voicing had no " + miss[0]);
        }
      }
      V = voicesOf(out, o);
    }

    /* 3 · THE DOUBLED LEADING TONE. Two voices on the seventh degree pull to
       the same tonic and one of them has to give: the box does not choose,
       because nothing in it knows the other chairs exist.

       AND UNDER THE NO-TRADE LAW ALMOST NOBODY CAN GIVE, which is the honest
       finding rather than a gap. The classical fix is to let the chord's
       filler take the root instead of the leading tone — but here a voiced
       chair spells its chord EXACTLY (`kernel.js voiceLead`, one voice per
       chord tone), so taking the leading tone out of a pad leaves the pad
       without that tone: a hole bought with a doubling, which is the trade
       rule 4's own comment refuses. The repair therefore fires only where a
       voice can leave WITHOUT COST — where its own chair still sounds the
       pitch class after it goes, meaning the chair was doubling it inside
       itself. Everywhere else the doubling stands and is counted, with the
       reason recorded, and the count is what a later round would argue with.
       A written line is never the one that gives, ever: a hand wrote it. */
    if (may("doubling") && o.leadingTone != null) {
      const lt = pcOf(o.leadingTone);
      chords = chordsAt(V.times, o.chords);
      for (let i = 0; i < V.times.length; i++) {
        const on = V.voices.filter((v) => v.notes[i] != null && pcOf(v.notes[i]) === lt);
        if (on.length < 2) continue;
        const ch = chords[i];
        if (!ch || !ch.pcs) { cant("doubling", "no chord is written here to re-choose within"); continue; }
        const movable = on.filter((v) => v.width > 1 && v.rank < v.width - 1 &&
          V.voices.some((w) => w !== v && w.chair === v.chair &&
                               w.notes[i] != null && pcOf(w.notes[i]) === lt));
        if (!movable.length) {
          cant("doubling", on.every((v) => v.width === 1)
            ? "both leading tones are written lines"
            : "no voice can leave the leading tone without putting a hole in its own chord");
          continue;
        }
        const v = movable[0], e = v.events[i], was = e.n;
        const here = new Set(V.voices.filter((w) => w.notes[i] != null)
                                     .map((w) => pcOf(w.notes[i])));
        const want = ch.pcs.map(pcOf).filter((p) => p !== lt && !here.has(p));
        if (!want.length) { cant("doubling", "no free chord tone to take"); continue; }
        e.n = nearestPc(was, want[0]);
        note("doubling", e, was, "the leading tone was doubled");
      }
      V = voicesOf(out, o);
    }

    /* 4 · PARALLEL FIFTHS AND OCTAVES. Detected exactly as the chorale
       checker detects them — both voices move, in the same direction, and the
       interval class is the same perfect one on both sides.

       AND REPAIRED BY RE-VOICING, WHICH IS THE ONLY REPAIR THERE IS. Two
       facts corner this one. The detection is on the interval CLASS
       (`|a-b| % 12`), so it is octave-invariant and moving a note by an
       octave cannot undo the parallel it is in. And a voiced chair here
       spells its chord EXACTLY — `kernel.js voiceLead` realizes one voice per
       chord tone — so there is no spare note to re-choose: measured over six
       records, every chord-tone substitution the first draft tried took the
       third out of the voicing to buy a fifth, opening 11 holes to close 49
       parallels. That is trading a fault, not repairing one.
       What is left is the repair THEORY.md actually names: A DIFFERENT
       INVERSION OF THE VOICED CHORD. Move one note of the voicing by an
       octave; the chair's pitch classes are untouched, so no hole can open,
       but the notes RE-RANK — the voice that was on top is now underneath —
       and the interval classes between chairs change with them. The move is
       kept only if the record's whole parallel count strictly falls and the
       note stays inside its chair's compass, so a repair can never be a
       trade.

       ATTEMPTS ARE CAPPED PER SECTION, at `tries`. Each attempt re-reads the
       score to score itself, which is the expensive thing this file does; a
       section that would need hundreds is a section whose parallels are its
       music, and the cap says so in the count rather than by grinding. */
    if (may("parallel") && period === 12) {
      chords = chordsAt(V.times, o.chords);
      let budget = o.tries == null ? 24 : o.tries;
      const scan = (W) => {
        const hits = [];
        for (let i = 0; i + 1 < W.times.length; i++)
          for (let x = 0; x < W.voices.length; x++)
            for (let y = x + 1; y < W.voices.length; y++) {
              const A = W.voices[x], B = W.voices[y];
              const a1 = A.notes[i], b1 = B.notes[i], a2 = A.notes[i + 1], b2 = B.notes[i + 1];
              if (a1 == null || b1 == null || a2 == null || b2 == null) continue;
              if (a1 === a2 || b1 === b2) continue;              // oblique
              if ((a2 - a1) * (b2 - b1) < 0) continue;           // contrary
              const p1 = perfectClass(a1, b1), p2 = perfectClass(a2, b2);
              if (p1 && p1 === p2) hits.push({ i, x, y, p: p1 });
            }
        return hits;
      };
      let hits = scan(V);
      for (const h of hits) {
        if (budget <= 0) { cant("parallel", "the section's attempt budget ran out"); break; }
        const code = h.p === 8 ? "parallel8" : "parallel5";
        const pick = [V.voices[h.x], V.voices[h.y]]
          .filter((v) => v.width > 1 && v.events[h.i + 1]);
        if (!pick.length) { cant(code, "both voices are written lines"); continue; }
        const v = pick[0], e = v.events[h.i + 1], was = e.n;
        const room = (n) => (v.lo == null || n >= v.lo) && (v.hi == null || n <= v.hi);
        let done = false;
        for (const d of [12, -12, 24, -24]) {
          if (!room(was + d)) continue;
          budget--;
          e.n = was + d;
          const W = voicesOf(out, o);
          if (scan(W).length < hits.length) {
            note(code, e, was, "parallel " + (h.p === 8 ? "octaves" : "fifths") +
                               ", re-voiced by an octave");
            V = W; hits = scan(W); done = true; break;
          }
          e.n = was;                                  // it did not help: put it back
          if (budget <= 0) break;
        }
        if (!done) cant(code, "no octave of this voicing removes it");
      }
    }
    return { events: out, repairs, refused };
  }

  /* the nearest realization of a pitch class to a pitch — the same ±6 fold
     `kernel.js fold` performs, said about a target class instead of a centre */
  function nearestPc(from, pc) {
    const base = from - ((from - pc) % 12 + 12) % 12;
    return Math.abs(base - from) <= Math.abs(base + 12 - from) ? base : base + 12;
  }

  const api = {
    // 1 sets
    pcOf, pcsOf, normalForm, primeForm, icv, forte, setEq, transposeSet, invertSet,
    // 2 transforms
    transpose, invert, retrograde, retrogradeInversion, augment, diminish, rotate,
    sequence, diaStep,
    // 3 spelled pitch
    LETTERS, LSEMI, sp, parseSp, spName, spMidi, spPc, spTranspose, spInterval,
    spByInterval, intervalName, parseInterval,
    // 4 keys and degrees
    MODES, modeArr, KEYSIG, degreeName, scaleDegreeSp, parseKey, DEGREES,
    // 5 chord spelling
    QUALITY, QALIAS, qualIntervals, qualPcs, spellChord, spellNames, keyOfRoman,
    // 6 analysis
    romanOf, nctOf, cadenceOf, NUMERALS,
    // 7 figured bass
    figuresOf, realizeFigure,
    // 8 part writing
    faults, RULES, ALLRULES, CHORALE_VOICES, CHORALE_QUAL,
    // 9 the copyist pass, and the voice model it and the census share
    voicesOf, chordsAt, missingTones, unsoundedTones, copyist, nearestPc, SNAP,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuTheory = api;
})(typeof window !== "undefined" ? window : globalThis);

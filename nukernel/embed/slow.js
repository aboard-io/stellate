// nukernel/embed/slow.js — SLOW AMBIENT, AS A PROFILE OF THE BOX (2026-11-23).
//
// Paul: *"Adjust stellate to play slow ambient."* The embedded radio
// (./radio.js) plays records one after another for a page that wants music to
// sit under something else — a clock, a breath, a sky. This file is what "slow
// ambient" MEANS, said once and in the box rather than in each page that
// embeds it: which rows of the catalogue, and what is done to a record the
// composer wrote before it is played.
//
// NOTHING HERE COMPOSES. A record is still `NuPrecompose.genreToDocument`'s,
// whole; the profile only chooses the genre and then takes things OUT:
//   · no drums — a kit under a meditation is a metronome nobody asked for;
//   · nothing sung — Paul, the same day: *"Get rid of the vocal synths … the
//     formant synths are just too disruptive."* A choir, a vowel or a formant
//     voice is re-seated on strings, glass or a pad, in turn, so the LINE the
//     composer wrote is still played;
//   · nothing faster than SLOW beats a minute, through the record's own tempo
//     (the engine never learns a second one);
//   · the key moved by the plan, kept within a tritone of C so no record
//     jumps an octave against the one before it.
//
// PURE, and the same plan for the same seed: `planAt` is a hash of where it is
// asked, never a stream, so a host can ask for record 7 without having asked
// for records 0..6. test/embed.test.js holds every sentence above.

/** The slow rows of the catalogue (nukernel/genres/<key>.json). */
export const GENRES = ["ambient", "drone", "chorale", "hymn", "impressionism",
                       "furnituremusic", "nocturne", "neoclassical"];
/** The rows of each part of the day. */
export const PARTS = {
  morning: ["neoclassical", "furnituremusic", "impressionism"],
  day: ["furnituremusic", "neoclassical", "chorale"],
  evening: ["nocturne", "chorale", "hymn"],
  night: ["ambient", "drone", "nocturne"],
};
/** The part of the day an hour (0..23, local) is in. */
export const partOf = (hour) => (hour >= 5 && hour < 11 ? "morning"
  : hour >= 11 && hour < 17 ? "day" : hour >= 17 && hour < 22 ? "evening" : "night");
/** The most beats a minute a record is played at. */
export const SLOW = 72;
/** Instruments that sing, and what takes their place, in turn. */
export const SINGS = /choir|voice|vox|vocal|formant|ahh|ohh|tract|sing/i;
export const UNSUNG = ["slow_strings", "bowed_glass", "halo_pad"];

/** A number in [0, 1) from a seed and a place. */
export function hash01(seed, ...at) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const n of at) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h / 0x100000000;
}
const pick = (xs, r) => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))];

/** The n-th record of a seed, after `prev` (a genre): the part of the day's
 *  rows, never the same row twice running. `{ n, genre, seed, key, seats }`. */
export function planAt(seed, n, part, prev) {
  const r = (i) => hash01(seed, 11, n, i);
  const from = PARTS[part] || PARTS.night, pool = from.filter((g) => g !== prev);
  return { n, genre: pick(pool.length ? pool : from, r(0)),
           seed: Math.floor(r(1) * 65535) + 1, key: Math.floor(r(2) * 7) - 3, seats: [] };
}

/** The composer's record, made slow ambient (in place, and returned). `plan`
 *  may move the key (`key`, semitones) and seat instruments on the first line
 *  voices (`seats`); both are optional. */
export function slowRecord(doc, plan) {
  const p = plan || {};
  doc.voices = doc.voices.filter((v) => v.kind !== "drums" && v.kind !== "kit");
  const key = doc.alphabet.key + (p.key || 0);
  doc.alphabet.key = key > 6 ? key - 12 : key < -6 ? key + 12 : key;
  const seats = p.seats || [];
  let i = 0, u = 0;
  for (const v of doc.voices) if (v.kind === "line" && i < seats.length) v.instrument = seats[i++];
  for (const v of doc.voices)
    if (v.instrument && SINGS.test(v.instrument)) v.instrument = UNSUNG[u++ % UNSUNG.length];
  if (doc.time && doc.time.bpm > SLOW) doc.time.bpm = SLOW;
  return doc;
}

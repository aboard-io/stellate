// nukernel/export/smf.js — the record's score, written out as a Standard MIDI
// File. ~200 dependency-free lines: SMF type 1, one track per voice, over the
// page's OWN score note list (ui/eight.js buildScore() → toScore().voices —
// the same fold the engraving and the piano roll draw, so the .mid can never
// disagree with the staff; attribute-grammar law, one owner per note).
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
    if (typeof m === "number" && isFinite(m)) out.push(Math.max(0, Math.min(127, m | 0)));
    else if (typeof m === "string" && perc && drumMap && drumMap[m] != null) out.push(drumMap[m]);
    else if (m != null) dropped.push(m);
  }
  return out;
}

/**
 * writeSmf(score, opts) -> Uint8Array — SMF type 1.
 *   score: { bpm, beatsPerBar, stepsPerBar, voices: [{ name, clef,
 *            notes: [{ at, len, midi }] }] }   (at/len in score steps)
 *   opts:  { drumMap }  — head string → GM key (see headGM)
 */
export function writeSmf(score, opts = {}) {
  const bpm = Math.max(1, +score.bpm || 120);
  const bpb = Math.max(1, Math.round(+score.beatsPerBar || 4));
  const spb = Math.max(1, Math.round(+score.stepsPerBar || 16));
  // a bar is `spb` steps AND `bpb` quarters, so one step is this many ticks:
  const tickPerStep = (TPQ * bpb) / spb;
  const drumMap = opts.drumMap || {};
  const dropped = [];

  const track = (events) => {
    // events: [{ tick, bytes:[...] }] — sorted, then delta-encoded
    events.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
    const body = [];
    let last = 0;
    for (const e of events) {
      body.push(...vlq(Math.max(0, Math.round(e.tick - last))), ...e.bytes);
      last = Math.round(e.tick);
    }
    body.push(0x00, 0xff, 0x2f, 0x00);                       // end of track
    return [...str("MTrk"), ...u32(body.length), ...body];
  };

  // conductor track: time signature + tempo, at tick 0
  const uspq = Math.round(60e6 / bpm);
  const t0 = track([
    { tick: 0, ord: 0, bytes: [0xff, 0x58, 0x04, bpb, 2, 24, 8] },  // bpb/4
    { tick: 0, ord: 1, bytes: [0xff, 0x51, 0x03, (uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255] },
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
    for (const n of v.notes || []) {
      const on = n.at * tickPerStep;
      const off = (n.at + Math.max(1, n.len)) * tickPerStep;
      for (const key of keysOf(n.midi, perc, drumMap, dropped)) {
        evs.push({ tick: on, ord: 2, bytes: [0x90 | ch, key, 96] });
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
    const notes = [];
    while (o < end) {
      tick += rvlq();
      let s = b[o];
      if (s & 0x80) { status = s; o++; } else s = status;
      if (s === 0xff) {
        const type = b[o++], mlen = rvlq(), at = o;
        if (type === 0x03) name = String.fromCharCode(...b.slice(at, at + mlen));
        if (type === 0x51) tempo = (b[at] << 16) | (b[at + 1] << 8) | b[at + 2];
        if (type === 0x58) timesig = [b[at], 1 << b[at + 1]];
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
      } else if ((s & 0xf0) >= 0xa0 && (s & 0xf0) <= 0xe0) {
        o += ((s & 0xf0) === 0xc0 || (s & 0xf0) === 0xd0) ? 1 : 2;
      } else throw new Error("unexpected byte 0x" + s.toString(16) + " at " + o);
    }
    notes.sort((a, b2) => a.tick - b2.tick || a.key - b2.key);
    tracks.push({ name, notes, tempo, timesig });
  }
  return { format, division, tracks };
}

// audio/sing.js — THE SINGING VOICE. sing.js decided which syllable lands on
// which note; this file synthesizes it, measures what came back, bends it onto
// the note and plays it. It has no opinions about music.
//
// Layer graph: deps -> state -> derive -> graph -> assets -> voices -> THIS
// FILE -> mixer -> transport. It imports graph (for the live ctx) and nothing
// above it; transport and bounce call warm() and playSyllable().
//
// ============================ WHAT IS BORROWED, AND WHERE IT DIVERGES =======
//
// engine/speech.js (CsdSpeech) — the SPEECH ORGAN, used verbatim, including
//   THE LAW: a fresh wasm instance per utterance, because espeak's wavegen
//   consumes libc rand() and only a fresh instance replaying the same call
//   sequence is byte-identical. Nothing here re-implements any part of that;
//   we call synth() and get deterministic PCM in node and chromium alike.
//   ONE ADDITIVE CHANGE was needed upstream and is documented there: set_voice
//   was being handed lang "en", which MEASURABLY overrides the voice name, so
//   the `variant` field was dead on all 230 registry rows that declare one.
//   The organ now takes an optional `lang`, defaulted to "en" so every
//   existing caller is byte-identical, and sing.js passes "" to reach f3.
//   It also now KEEPS the synthesize callback's event stream as `marks` —
//   phoneme positions in ms — which it previously discarded. That is the whole
//   reason a line can be cut into syllables at all.
//
// engine/faust/voices/found-player.js — the DETERMINISTIC CLIP-SNAP, used as
//   the pitching mechanism exactly as the brief describes it: f0Profile()
//   measures the clip's own median F0 offline (a pure function of the buffer,
//   cached per buffer) and autoTuneRate() bends playbackRate so the HEARD
//   median lands on a target. The parent's target is "the nearest tone of the
//   song's scale, in any octave"; ours is "the note this syllable sits on",
//   which is a strictly stronger requirement, so we compute the ratio directly
//   rather than through autoTuneRate's pitch-class search — same law, one less
//   degree of freedom. The parent's purity ceiling (isWhistle -> no bend) is
//   deliberately NOT applied: speech is exactly the material auto-tune was
//   built for, and a syllable that reads as pure IS a sung vowel.
//
// engine/faust/dsp/robot_choir.dsp — the VOCODER, ported to the buffer domain.
//   Its parameters are copied literally (32 bands, attack 0.005, release
//   0.025, BWRatio 0.5, the three detuned saws plus a quiet octave double,
//   tanh saturation) INCLUDING its documented intelligibility law: the carrier
//   sits an OCTAVE BELOW the note, because a lower carrier packs more
//   harmonics into the 200 Hz-3 kHz formant band and the words actually read.
//   WHERE IT DIVERGES, twice. (1) Faust's own filterbank source is not vendored
//   here (engine/faust/ ships .dsp and compiled wasm, no .lib), so the per-band
//   filters below are plain RBJ two-pole bandpasses of my own rather than
//   fi.filterbank's — same topology, not the same phase response. (2) The
//   octave-down is RE-FLOORED (vocMidiOf): robot_choir is driven by a lead line
//   and our lead singer is a bass-baritone, so an octave under its fold is
//   27-46 Hz — inaudible on a phone and, measured, below the found layer's own
//   65 Hz detection floor. The carrier is synthetic and owes the singer's
//   ladder nothing, so it takes the note's own octave in a real singing
//   register and drops from there.
//
// ============================ WHAT IT COSTS ================================
//
// PER NOTE: one AudioBufferSourceNode and one GainNode — two graph nodes, plus
// one createBuffer, which allocates Float32s and joins no graph. COUNTED, on
// the context the note is built on, by nukernel-drums (H): three create* calls
// and not one more. That is CHEAPER than a played note — audio/bounce.js
// measured the sampled path at ~7.5 nodes per note (2919 nodes for 386 buffer
// sources, the per-note channel strips) and the same probe reads 14 for a
// sampled note on this page. There is no per-note filter, no strip and no send
// gain: the voice lands on the section channel input, so the box's own fx,
// sends, level and place treat it like everything else.
// THE VOCODER ADDS NOTHING AT ALL, which is why it is done in the buffer
// domain at warm time rather than as a graph: a 32-band channel vocoder as
// live nodes would be 64 biquads PER NOTE, and the whole point of the
// 2026-08-15 bus rebuild is that the graph stopped growing per voice.
// SHARED: nothing. This file adds no permanent node to the graph at all, so
// mixer.js BUDGET {chan:24, part:8, shared:220} is untouched and __nuMix.nodes
// does not move.
// WHEN NOTHING SINGS IT COSTS ZERO: `sing` defaults to null, singPlan returns
// [], warm() is never called, and no wasm is fetched. The ~1.7 MB espeak
// artifact is behind engine/speech.js's own lazy dynamic import(), so a page
// that never sings never downloads it.
import { SING, FP, CS } from "../ui/deps.js";
import { ctx } from "./graph.js";

// AN EAR SEAM, the ?dryroom / ?flatvel shape: ?nosing renders the page with
// the singer switched off and everything else identical, which is the A/B that
// decides whether a sung line helps a given song.
const NOSING = typeof location !== "undefined" && /[?&]nosing\b/.test(location.search);
export const singOff = () => NOSING;

// WHAT ACTUALLY HAPPENED, for the gates and for a person with the console
// open. Counters only; nothing reads them back into the sound.
export const singStats = { utterances: 0, slices: 0, notes: 0, vocoded: 0,
                           stretched: 0, failed: 0, unavailable: 0 };
window.__nuSing = () => ({ ...singStats, off: NOSING,
                           lines: LINES.size, sliceCache: SLICES.size,
                           fitCache: FITS.size });

/* ---------- the vowel test, on espeak's own phoneme ids ------------------- */
// espeak's phoneme marks carry IPA (see the sample in engine/speech.js's marks
// comment: "h", "ˈəʊ", "l", "d"). A mark is a NUCLEUS when, with the stress and
// length diacritics stripped, its first character is a vowel letter — which
// covers the diphthongs too, because they are written vowel-first. This is the
// only place the syllable boundaries come from; nukernel/sing.js's letter rule
// is the PLAN's estimate and the gate holds the two against each other.
const IPA_VOWELS = new Set([..."aeiouyəɐɛɪɔʊʌɜæɑɒɘɵøɤɯɨʉœɶɞ"]);
const isNucleus = (id) => {
  const s = String(id == null ? "" : id).replace(/[ˈˌː%_'|\-]/g, "");
  return s.length > 0 && IPA_VOWELS.has(s[0]);
};

/* ---------- one utterance, cut into syllables ----------------------------- */
// LINES: "vi:pitch:text" -> Promise<[slice]>, one entry per espeak instance.
// SLICES are the cut result and are what everything downstream reads.
const LINES = new Map();
const SLICES = new Map();                      // "vi:pitch:text:i" -> slice

// trailing/leading silence trim, in the same spirit as the sample-CD recipe's
// ffmpeg silenceremove: a threshold RELATIVE to the clip's own peak, so it is
// scale-invariant and cannot depend on the peak-normalize gain speech.js
// already applied.
const TRIM_REL = 0.02;
function trimBounds(x, from, to) {
  let peak = 0;
  for (let i = from; i < to; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; }
  const thr = peak * TRIM_REL;
  let a = from, b = to;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b - 1]) < thr) b--;
  return [a, b];
}

// CUT AN UTTERANCE AT ITS NUCLEI. Syllable k runs from just before its own
// onset consonant to just before the NEXT syllable's onset consonant — the
// same single-consonant-onset rule nukernel/sing.js's letter version uses
// (V|CV), applied to real phonemes with real timestamps instead of letters.
// The vowel REGION is recorded separately because a held note stretches the
// vowel and nothing else.
const SRC_FENCE = 6;                           // semitones; see the fence note below
function cutSyllables(pcm, sr, marks, want, base) {
  const ph = (marks || []).filter(m => m.type === "phoneme");
  const nuc = [];
  for (let i = 0; i < ph.length; i++) if (isNucleus(ph[i].id)) nuc.push(i);
  if (!nuc.length) return null;
  const S = (ms) => Math.max(0, Math.min(pcm.length, Math.round(ms * sr / 1000)));
  const out = [];
  for (let k = 0; k < nuc.length; k++) {
    // start: one consonant of onset, or the head of the utterance
    const onset = k === 0 ? 0 : Math.max(nuc[k - 1] + 1, nuc[k] - 1);
    const from = k === 0 ? 0 : S(ph[onset].ms);
    // end: where the NEXT syllable's onset begins, or the end of the audio
    let to = pcm.length;
    if (k + 1 < nuc.length) {
      const nOnset = Math.max(nuc[k] + 1, nuc[k + 1] - 1);
      to = S(ph[nOnset].ms);
    }
    if (to <= from + 8) continue;
    const [a, b] = trimBounds(pcm, from, to);
    if (b <= a + 8) continue;
    // the vowel region, clamped into the trimmed slice
    const vFrom = Math.max(a, Math.min(b - 1, S(ph[nuc[k]].ms)));
    const vTo = Math.max(vFrom + 1, Math.min(b,
      nuc[k] + 1 < ph.length ? S(ph[nuc[k] + 1].ms) : b));
    const data = pcm.slice(a, b);
    // THE CLIP'S OWN MEDIAN, measured rather than assumed — found-player's
    // whole point. The ladder in sing.js only chose the rung; this is what the
    // bend is actually computed from, so an espeak build whose pitch response
    // drifts cannot silently detune the singing.
    //
    // ...WITH A FENCE, AND THE FENCE IS THE MEASUREMENT. Over all 996
    // (bank line x rung x voice) syllables, |measured - ladder| has median
    // 1.18 and p90 3.09 semitones — and then 68 of them (6.8%) return NO F0
    // at all, because a 49 ms slice does not give the autocorrelation detector
    // enough frames to be confident. There is nothing in between: not one
    // syllable lands between 4 semitones and the no-F0 sentinel. So a
    // measurement further than SRC_FENCE from the rung's own ladder value is
    // not a strange voice, it is a failed detection, and the honest recovery
    // is the MODEL — the ladder, which is the median of exactly this
    // population. Playing those unbent (the first version) sang them at the
    // rung's pitch instead of the note's, which is a real tuning error on one
    // syllable in fifteen.
    const hz = FP ? FP.detectMedianHz(data, sr) : 0;
    const m = hz > 0 ? 69 + 12 * Math.log2(hz / 440) : NaN;
    const srcMidi = (hz > 0 && Math.abs(m - base) <= SRC_FENCE) ? m : base;
    out.push({ data, sr, hz, srcMidi, measured: srcMidi === m,
               vFrom: vFrom - a, vTo: vTo - a });
  }
  // A LINE THAT CAME BACK THE WRONG LENGTH IS NOT USED HALFWAY. The plan
  // assigned syllable i of the bank to note i; if espeak produced a different
  // number of nuclei the mapping is off by an unknown amount and every note
  // after the divergence sings the wrong word. Refuse the line instead — the
  // notes fall back to silence and the counter says so. (Measured today: zero
  // of the twenty shipped bank lines diverge; the gate holds them.)
  if (want != null && out.length !== want) return null;
  return out;
}

/* ---------- warm: everything a plan needs, before a note is due ----------- */
// EVERY SYNTHESIS HAPPENS HERE AND NOWHERE ELSE. scheduleBar runs on the audio
// clock and the offline render runs synchronously inside one walk; neither can
// await a 210 ms wasm boot. So the transport warms before it starts (see
// transport.ensureAssets) and the bounce warms before it renders windows
// (audio/bounce.js renderSong) — and playSyllable() is a pure cache read that
// returns false when the cupboard is bare, exactly like playSampled does with
// an undecoded zone.
// IS THERE ANYTHING LEFT TO DO? transport.ensureAssets uses this to decide
// whether it has WORK, and the distinction matters: warm() is idempotent and
// returns from cache in microseconds, but ensureAssets announces "loading…" and
// reports a load whenever it has anything at all — so without this a song that
// sings would announce a load on every single start.
export function needsWarm(plan, text) {
  if (NOSING || !plan || !plan.length || !text || !CS || !SING) return false;
  return SING.warmSpecs(plan).some(sp => !LINES.has(sp.vi + ":" + sp.pitch + ":" + text));
}
export async function warm(plan, text) {
  if (NOSING || !plan || !plan.length || !text || !CS || !SING) return false;
  let ok = false;
  const want = text.split(" ").filter(Boolean).length;
  for (const spec of SING.warmSpecs(plan)) {
    const V = SING.VOICES[spec.vi];
    const key = spec.vi + ":" + spec.pitch + ":" + text;
    if (LINES.has(key)) { ok = true; continue; }
    const job = (async () => {
      // SPEED IS FIXED AND FAST. Measured on the vendored artifact over 276
      // real bank syllables: 0.224 s each at espeak speed 150, and 0.049 to
      // 0.331 s (median 0.143) at 260. A note at 126 bpm runs 0.119 s (a
      // sixteenth) to 0.476 s (a half), so 260 is the setting that puts the
      // natural syllable at the SHORT end of the note range — which is the
      // right side to be on, because lengthening a vowel is a loop and
      // shortening one throws the vowel away.
      const r = await CS.synth(text, { variant: V.variant, lang: V.lang,
                                       pitch: spec.pitch, speed: SPEED });
      singStats.utterances++;
      const cut = cutSyllables(r.pcm, r.sr, r.marks, want,
                               SING.ladderMidi(V.ladder, spec.pitch));
      if (!cut) { singStats.failed++; return null; }
      cut.forEach((s, i) => SLICES.set(key + ":" + i, s));
      singStats.slices += cut.length;
      return cut;
    })().catch(() => { singStats.failed++; return null; });
    LINES.set(key, job);
    if (await job) ok = true;
  }
  if (!ok && !CS) singStats.unavailable++;
  return ok;
}
const SPEED = 260;

/* ---------- fitting a slice to a note ------------------------------------- */
// THE THREE THINGS THAT HAPPEN BETWEEN A SLICE AND A NOTE, in this order:
//
//   1. BEND. playbackRate = targetHz / hz(srcMidi). This is resampling, so it
//      moves the FORMANTS and the DURATION with the pitch, and there is no
//      pretending otherwise. The number, MEASURED end to end over 655 (bank
//      line x rung x note) combinations rather than argued: the real bend has
//      median 1.39 semitones, p90 2.99 and a hard ceiling of 4.88 (the rung
//      choice bounds the nominal at 2.07 and the syllable's own intonation
//      spreads it). A 1.4-semitone formant shift is 8% and reads as the same
//      singer leaning; the 4.9 tail is a different, smaller person for one
//      word. Four rungs per voice is what keeps the median there — three would
//      put the nominal at 3.3 before the spread.
//   2. LENGTH, and the first version of this had the direction backwards. The
//      heard length is natural/rate, and MEASURED at espeak speed 260 a
//      syllable is 0.10-0.12 s while a quarter note at 126 bpm is 0.476 s — so
//      the common case is not truncation, it is a 0.11 s blip followed by
//      three-quarters of a beat of silence, which reads as a stutter and not
//      as singing. Every sung note therefore SUSTAINS to its own length by
//      looping the vowel, bounded by MAX_STRETCH; the plan's `hold` flag
//      raises that bound rather than switching the behaviour on, because the
//      difference between a quarter note and a held whole note is how far a
//      singer is willing to go on one breath. Truncation still happens (a
//      sixteenth under a slow voice) and is free: the envelope release cuts
//      it, which is what a singer does with a clipped word.
//   3. COLOUR. `vocoder` replaces the bend entirely: the carrier is built AT
//      the target frequency, so the result is in tune by construction and
//      plays at rate 1 with its formants exactly where espeak put them.
const FITS = new Map();                        // fit key -> Float32Array
// bounded in SAMPLES for the reason bounce.js's window cache is: these are
// Float32 seconds, and what matters is total memory rather than entry count.
const FIT_MAX = 12 * 44100;
let fitSamples = 0;
function fitPut(k, buf) {
  FITS.set(k, buf); fitSamples += buf.length;
  for (const kk of FITS.keys()) {
    if (fitSamples <= FIT_MAX) break;
    const e = FITS.get(kk); FITS.delete(kk); fitSamples -= e.length;
  }
}

// STRETCH BY LOOPING THE VOWEL, which is what the word "sing" means here: the
// consonants keep their real length and the vowel carries the note. A
// crossfaded loop of the sustained centre, exactly the trick a sampler plays
// on a looped zone (engine/faust/voices/sampler.js ls/le) — and for the same
// reason the parent is careful about zone loop points, the crossfade is what
// stops the wrap being an audible click.
const XFADE = 0.012;                           // seconds, both sides of a wrap
// HOW FAR ONE BREATH GOES. A 0.11 s syllable filling a quarter note is already
// 4.3x, so the ordinary ceiling has to be well above that; a note the plan
// marked `hold` (a dotted quarter of the phrase grid or longer) gets three
// times as much rope. Past that the vowel is a drone rather than a sung note
// and the rest of the note is simply silence — which is also what a singer
// runs out of air and does.
const MAX_STRETCH = 8, MAX_STRETCH_HOLD = 24;
// how many output frames a note wants, given the natural slice and the bend
const fitFrames = (s, ev, dur, rate) => Math.min(
  Math.ceil(dur * rate * s.sr),
  Math.ceil(s.data.length * (ev.hold ? MAX_STRETCH_HOLD : MAX_STRETCH)));
function stretchVowel(s, outFrames) {
  const nat = s.data.length;
  if (outFrames <= nat) return s.data;
  const vLen = s.vTo - s.vFrom;
  if (vLen < 64) return s.data;                // no vowel worth looping
  const xf = Math.min(Math.floor(XFADE * s.sr), (vLen / 2) | 0);
  const tailLen = nat - s.vTo;
  const out = new Float32Array(outFrames);
  out.set(s.data.subarray(0, s.vFrom), 0);
  // fill the middle with crossfaded copies of the vowel until the coda fits
  let w = s.vFrom;
  const bodyEnd = Math.max(w, outFrames - tailLen);
  let first = true;
  while (w < bodyEnd) {
    const n = Math.min(vLen, bodyEnd - w);
    for (let i = 0; i < n; i++) {
      const v = s.data[s.vFrom + i];
      if (!first && i < xf) out[w + i] += v * (i / xf);      // fade in over the tail
      else out[w + i] = v;
    }
    // fade the copy's own tail down so the next wrap lands on a ramp
    if (n === vLen && w + vLen < bodyEnd)
      for (let i = 0; i < xf; i++) out[w + vLen - xf + i] *= 1 - i / xf;
    first = false;
    w += Math.max(1, vLen - xf);
  }
  for (let i = 0; i < tailLen && bodyEnd + i < outFrames; i++)
    out[bodyEnd + i] = s.data[s.vTo + i];
  singStats.stretched++;
  return out;
}

/* ---------- the vocoder (robot_choir.dsp, in the buffer domain) ----------- */
// Parameters are robot_choir's own; see the header for what diverges.
const VB_N = 32, VB_LO = 110, VB_HI = 7500, VB_BW = 0.5;
const VB_ATT = 0.005, VB_REL = 0.025, VB_MAKEUP = 5;
// RBJ two-pole bandpass (constant skirt gain), applied in one forward pass.
// dst += src filtered, so the band sum is built in place.
function bandpassInto(dst, src, sr, f0, q, gain) {
  const w0 = 2 * Math.PI * f0 / sr, cs = Math.cos(w0), sn = Math.sin(w0);
  const alpha = sn / (2 * q), a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0;
  const a1 = -2 * cs / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    dst[i] += y * gain;
  }
}
function bandpass(src, sr, f0, q) {
  const out = new Float32Array(src.length);
  bandpassInto(out, src, sr, f0, q, 1);
  return out;
}
function vocode(mod, sr, hz) {
  const n = mod.length, out = new Float32Array(n);
  // THE CARRIER, literally robot_choir's: three saws detuned +-0.4% plus a
  // quiet octave double, and the whole thing an OCTAVE BELOW the note because
  // that is where the words become legible (its own comment, Paul 2026-07).
  const cf = hz * 0.5;
  const car = new Float32Array(n);
  const saw = (f, amp) => {
    let p = 0; const inc = f / sr;
    for (let i = 0; i < n; i++) { car[i] += (2 * p - 1) * amp; p += inc; if (p >= 1) p -= 1; }
  };
  saw(cf * 0.996, 0.3); saw(cf, 0.3); saw(cf * 1.004, 0.3); saw(cf * 2, 0.18);
  const aC = Math.exp(-1 / (VB_ATT * sr)), rC = Math.exp(-1 / (VB_REL * sr));
  const ratio = Math.pow(VB_HI / VB_LO, 1 / (VB_N - 1));
  const q = 1 / (VB_BW * (ratio - 1) / Math.sqrt(ratio));   // BWRatio -> Q per band
  for (let b = 0; b < VB_N; b++) {
    const f = VB_LO * Math.pow(ratio, b);
    if (f >= sr / 2 - 100) break;
    const mb = bandpass(mod, sr, f, q), cb = bandpass(car, sr, f, q);
    let env = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(mb[i]);
      env = a > env ? aC * env + (1 - aC) * a : rC * env + (1 - rC) * a;
      out[i] += cb[i] * env;
    }
  }
  // ma.tanh(x * makeup) * 0.8, robot_choir's own output stage
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * VB_MAKEUP) * 0.8;
  singStats.vocoded++;
  return out;
}

/* ---------- the one function the schedulers call -------------------------- */
export const hzOf = m => 440 * Math.pow(2, (m - 69) / 12);

// WHERE THE VOCODER'S CARRIER SITS, and it is NOT the singer's ladder fold.
// robot_choir.dsp puts the carrier an octave below the note "because a lower
// carrier packs more harmonics into the 200 Hz-3 kHz formant band and the
// words actually read" — written for a LEAD line. Our lead singer is a
// bass-baritone whose ladder folds every target into MIDI 39.6..52.8, and an
// octave below THAT is 27-46 Hz: sub-bass, under the low corner of any phone
// speaker and, MEASURED, under the found layer's own F0 detector (f0Profile
// searches 65..520 Hz, so it reported a note-46 carrier as 65 Hz flat, which
// is what caught this).
//
// The carrier is synthetic, so it owes the ladder nothing: it takes the note's
// own octave folded into a real singing register and drops from there, with a
// floor. The formants still come entirely from the modulator, so the words are
// unaffected — only the pitch the carrier sings moves, and it moves back to
// where robot_choir meant it to be.
const VOC_LO = 48, VOC_HI = 72, VOC_FLOOR = 36;
export function vocMidiOf(midi) {
  let m = midi;
  while (m < VOC_LO) m += 12;
  while (m > VOC_HI) m -= 12;
  let c = m - 12;                                // robot_choir's octave-down law
  while (c < VOC_FLOOR) c += 12;
  return c;
}

// THE LINE CYCLES, AND THE CACHE MUST FOLD WITH IT. singPlan hands syllable i
// of the section the word words[i % words.length] (sing.js singPlan) — `si` is
// the NOTE's index and grows past the line — while warm() slices ONE utterance
// of the line, exactly one entry per word. Reading the raw si here left every
// syllable past the first cycle of the lyric silent: measured on a composed
// verse, a sixteen-note line over a six-word lyric sang six notes and dropped
// ten (nukernel-drums (H) caught it on a random compose seed). One fold, the
// plan's own modulus, shared by the player and the probe below.
const sylIx = (ev, text) => {
  const n = text.split(" ").filter(Boolean).length;
  return n > 0 ? ev.si % n : ev.si;
};
// PLAY ONE SYLLABLE. Returns false when there is nothing warmed for it, which
// the caller treats exactly as it treats an undecoded zone: be silent, never
// substitute something else. `ev` is a singPlan entry; `text` is the utterance
// it was planned against (the cache coordinate).
export function playSyllable(ev, text, when, durSec, chan, colour, barSec) {
  if (NOSING || !SING || !chan) return false;
  const c = chan.input ? chan.input.context : ctx;
  if (!c) return false;
  const r = SING.rungFor(ev.vi, ev.n);
  const si = sylIx(ev, text);
  const s = SLICES.get(ev.vi + ":" + r.pitch + ":" + text + ":" + si);
  if (!s || !s.data.length) return false;
  const sr = s.sr;
  // ONE BAR IS THE CEILING, and it is a BOUNCE law rather than a musical one.
  // audio/bounce.js renders the tape in windows with exactly ONE BAR of
  // pre-roll: a note that starts in the pre-roll bar and rings across the seam
  // is produced correctly, because the pre-roll really plays and only its own
  // output is discarded — but a note that would need TWO bars of lead-in is
  // never scheduled at all and would simply vanish at every window boundary.
  // Held sung notes are the only thing on this page long enough to reach that,
  // so the cap lives here, is the SOUNDING BAR's own length (a half-time
  // genre's bar is twice a normal one's), and is gated by
  // test/browser/nukernel-bounce.test.js at the seam rather than believed.
  const dur = Math.max(0.05, Math.min(durSec, barSec || 4));
  const targetHz = hzOf(r.midi);
  let data, rate;
  if (colour === "vocoder") {
    // IN TUNE BY CONSTRUCTION: the carrier is SYNTHESIZED at a known pitch, so
    // there is no bend at all — rate stays exactly 1 and the formants espeak
    // produced survive untouched. That is the whole reason the vocoder is
    // offered as a colour rather than as an effect.
    rate = 1;
    const vm = vocMidiOf(ev.n);
    const want = fitFrames(s, ev, dur, 1);
    const key = "v:" + ev.vi + ":" + r.pitch + ":" + text + ":" + si + ":" +
                want + ":" + vm.toFixed(2);
    data = FITS.get(key);
    // vocode() builds the carrier at freq*0.5 (robot_choir's own line), so it
    // is handed the octave ABOVE the carrier we want to hear
    if (!data) { data = vocode(stretchVowel(s, want), sr, hzOf(vm + 12)); fitPut(key, data); }
  } else {
    // THE CLIP-SNAP: bend the MEASURED median onto the note. A slice with no
    // detectable F0 (an unvoiced fricative that swallowed its vowel) plays
    // unbent rather than being multiplied by infinity.
    rate = targetHz / hzOf(s.srcMidi);
    if (!(rate > 0.25 && rate < 4)) rate = 1;
    const want = fitFrames(s, ev, dur, rate);
    if (want > s.data.length) {
      const key = "n:" + ev.vi + ":" + r.pitch + ":" + text + ":" + si + ":" + want;
      data = FITS.get(key);
      if (!data) { data = stretchVowel(s, want); fitPut(key, data); }
    } else data = s.data;
  }
  const buf = c.createBuffer(1, data.length, sr);
  buf.getChannelData(0).set(data);
  const src = c.createBufferSource();
  src.buffer = buf; src.playbackRate.value = rate;
  // ONE GAIN, WHICH IS ALSO THE ENVELOPE. A short ramp in (a hard start on a
  // vowel clicks) and a ramp out at the note's end, which is what makes a
  // truncated syllable read as a clipped word instead of as a cut tape.
  const g = c.createGain();
  const heard = Math.min(dur, data.length / rate / sr);
  const atk = Math.min(0.012, heard * 0.25), rel = Math.min(0.05, heard * 0.4);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(LEVEL, when + atk);
  g.gain.setValueAtTime(LEVEL, when + Math.max(atk, heard - rel));
  g.gain.linearRampToValueAtTime(0, when + heard);
  src.connect(g);
  // THE SECTION CHANNEL, not a chair and not a private rack. The box's fx,
  // sends, level and place then treat the singer like everything else in the
  // box, which is the point of the 2026-08-15 bus rebuild: a voice that
  // carried its own reverb would be a second opinion about the room.
  g.connect(chan.input);
  src.start(when);
  src.stop(when + heard + 0.02);
  // LET GO WHEN THE NOTE DOES — ON THE LIVE CONTEXT ONLY, which is voices.js's
  // countFb two-ledgers law applied to teardown. `ended` is delivered AFTER
  // startRendering resolves, so offline it would only keep a closure alive for
  // a context that is about to be thrown away whole; and a gain with no input
  // computes nothing, so a disconnect is the whole of the cleanup (ZERO-STATIC
  // is about worklets, which compute forever).
  if (!ctx || c === ctx) src.onended = () => { try { g.disconnect(); } catch (e) {} };
  singStats.notes++;
  return true;
}
const LEVEL = 0.5;

// TEST SEAM. The gates need to prove a sung line's pitch tracks the melody
// without decoding a whole bounce, so the measured facts about a warmed slice
// are readable: what espeak produced, what we measured, what we will bend to.
window.__nuSingProbe = (ev, text) => {
  if (!SING) return null;
  const r = SING.rungFor(ev.vi, ev.n);
  const s = SLICES.get(ev.vi + ":" + r.pitch + ":" + text + ":" + sylIx(ev, text));
  if (!s) return null;
  const rate = hzOf(r.midi) / hzOf(s.srcMidi);
  return { rung: r.pitch, foldedMidi: r.midi, vocMidi: vocMidiOf(ev.n),
           nominalBend: r.bend,
           rungBase: r.base, measuredHz: s.hz, measured: s.measured,
           srcMidi: s.srcMidi, realBend: r.midi - s.srcMidi,
           rate, heardHz: hzOf(s.srcMidi) * rate,
           natSec: s.data.length / s.sr,
           vowelSec: (s.vTo - s.vFrom) / s.sr };
};

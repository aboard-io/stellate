// nukernel/audio/audition.js — HEAR THE MOTIF, IN THE VOICE THAT READS IT.
// The seventh audio module, and like the other six it is small on purpose: it
// plays the THEME ALONE, without booting the band engine — a musician leaning
// over and playing the tune once so you can hear what the staff says. It must
// therefore not touch FaustLive or the audio tier's state at all: it holds its
// own little AudioContext (made on the tap, which is the gesture the autoplay
// policy wants), fetches and decodes the few zones it needs once, and
// schedules plain AudioBufferSourceNodes.
//
// WHAT THIS FILE USED TO SAY, AND WHY IT CHANGED. Its title was "HEAR IT ON
// THE PIANO" and it named one instrument: *"the GM acoustic grand … the
// registry's: window.GenreKernel.SAMPLERS names the FluidR3 Yamaha grand"*.
// Paul, 2026-08-25: *"If I tap the motif play the motif in an associated
// voice."* A motif's associated voice is the chair that READS it — the page's
// own name line has said so all along ("psalm — read by cantor") — so the
// piano is now one row of a table rather than the answer, and which row is
// picked is decided by the document, not here.
//
// THE OTHER SENTENCE THAT CHANGED IS ABOUT THE BAND. It read: *"If the band is
// playing, the piano simply plays over it — the honest behaviour: the band is
// the record, this is somebody at the piano in the same room."* That was
// written when the only way to start an audition was to press a button that
// said so. The tap is now the TAB — navigation makes sound — and a motif
// sounding over a running record at its own tempo, in its own key, with no
// relation to the bar, is two musics at once and the page cannot mix them. So
// the audition REFUSES while the transport runs and the caller says so in
// words (ui/eight.js). `auditioning()` is exported for exactly that kind of
// question; `playAudition` refuses nothing on its own — a module that cannot
// see the transport must not pretend to police it, and the one refusal lives
// where the sentence is printed.
//
// THE NOTES ARE THE STAFF'S OWN: the caller hands in ui/abc.js toNotes()
// output — the same {at, len, midi} timeline toABC folds into bars — so the
// audition and the engraving can never disagree about a pitch or a length.
// A DRUM CELL has no such timeline (a grid is not a line, document.js:230), so
// it arrives as `hits` — {at, lane, vel} — straight off the same `lanes` the
// drum grid draws and the kernel plays.
//
// WHAT IT CAN AND CANNOT VOICE, SAID OUT LOUD. Everything here is a RECORDING:
// SAMPLERS zones under found/samples/instruments/, kit one-shots under
// found/samples/drums/. A voice whose throat is a Faust model — tract_voice,
// the singer, the organ, every synth in audio/to-engine.js SYNTH — cannot be
// synthesised in this module and must not be silently replaced either, so
// `auditionVoice` returns the NEAREST RECORDING together with the sentence
// that says it is a stand-in, and the page prints that sentence. VOICE.md §8
// settled the general question and this does not reopen it: *"a second way to
// hear one voice is a second engine on the page"* — the real throat is heard
// by pressing play, and this is a reading, not the record.

const PIANO = "yamaha_grand_piano";
const SITE = new URL("../../", import.meta.url).href;   // the site root

/* WHERE THE ZONE TABLE COMES FROM, AND WHY THERE ARE TWO PLACES TO LOOK.
   `window.GenreKernel` is the parent engine's own api and it is the right
   answer — but it does not exist until the engine has been built, and this
   module is asked its question by a TAP, which can land before that. Measured
   2026-08-25 on nukernel/index.html: `__REGISTRY.SAMPLERS` (the classic script
   index.html loads before anything else) is on the page at 505ms and
   `GenreKernel.SAMPLERS` only at 1.9s — so for the first second and a half the
   audition resolved every instrument to a sampler it could not find and would
   have played nothing at all, and the offline warm that runs at boot filed
   nothing. They are the SAME TABLE (engine/genre-kernel.js: `const SAMPLERS =
   DATA.SAMPLERS`), so the fallback is not a second opinion. */
const samplersNow = () => ((window.GenreKernel || {}).SAMPLERS) ||
                          ((window.__REGISTRY || {}).SAMPLERS) || {};
const samplerNow = (id) => samplersNow()[id || PIANO] || null;

/* ---------- WHICH RECORDING READS THIS MOTIF ------------------------------
   A voice's `instrument` is one of three things (nukernel/document.js
   nativeOf): a SAMPLERS id (a recording), a Faust model name from the fleet,
   or the literal "synth", which means the record's own signature synth. Only
   the first can be played here.

   THE STAND-INS ARE A TABLE, NOT A GUESS (determinism, tables not generation).
   One row per fleet voice — audio/to-engine.js SYNTH is the list — and each
   row is the nearest thing anybody recorded: a Kelly-Lochbaum tube is read by
   a solo voice, a chorale by the choir, the pipe organ by the pipe organ. Two
   people who tap the same motif hear the same reading, forever, and the page
   says which. */
const STANDIN = {
  // the throats
  tract_voice: "solo_vox", voice_lead: "solo_vox", voice_choir: "ahh_choir",
  choir: "ahh_choir",
  // the keyboards
  organ: "church_organ", hammond: "drawbarorgan", stk_piano: "yamaha_grand_piano",
  dx7_alg5: "rhodes_ep", fm2op: "electric_piano", bell: "tubular_bells",
  mallet: "marimba",
  // the strings that are played by hand
  stk_guitar: "clean_guitar", gtr_amp: "overdrive_guitar",
  lead_fuzz: "distortion_guitar",
  // the machines
  modeld: "saw_wave", tb303: "saw_wave", supersaw: "saw_wave",
  pad_saw: "warm_pad", juno60: "polysynth", oberheim: "polysynth",
  ppg: "polysynth", solina: "synth_strings_1", vp330: "synth_voice",
  casiocz: "square_lead", synclead: "square_lead",
};

/**
 * The recording that will read a motif for a voice with this `instrument`.
 * Returns { id, real, why } — `real` is false when the instrument is a Faust
 * model this module cannot synthesise, and `why` is then the sentence the page
 * has to print. A voice with no instrument at all (a motif nobody reads, so
 * the caller passes the record's own default) falls to the piano, which is
 * what this module played for everything until 2026-08-25.
 */
export function auditionVoice(instrument) {
  const S = samplersNow();
  const id = String(instrument || "");
  if (id && S[id]) return { id, real: true, why: "" };
  const stand = STANDIN[id];
  if (stand && S[stand])
    return { id: stand, real: false,
             why: id + " is synthesised by the engine — this reads it on " +
                  stand + ", the nearest recording" };
  if (!id) return { id: PIANO, real: true, why: "" };
  return { id: PIANO, real: false,
           why: id + " has no recording here — this reads it on the piano" };
}

// THE KIT, ON THE SAME TERMS. Six of the ten kit names are directories of
// recorded one-shots; the other four are DRUM MACHINES the parent engine
// synthesises (audio/to-engine.js MACHINE_KIT), and there is nothing on disk
// to fetch for them. So a machine kit auditions on the `electronic`
// recordings and the page says so — the substitute is never quiet, which is
// the same law audio/to-engine.js `laneRefusal` states from the other side
// ("never a quiet substitute").
const KITDIRS = ["acoustic", "brush", "electronic", "jazz", "power", "room"];
const KITFILE = { k: "kick.wav", s: "snare.wav", h: "hatClosed.wav",
                  o: "hatOpen.wav", c: "clap.wav", p: "rim.wav",
                  f: "hatPedal.wav", r: "ride.wav", x: "crash.wav",
                  t: "tomHi.wav", m: "tomMid.wav", l: "tomLo.wav" };
export function auditionKit(kit) {
  const k = String(kit || "");
  if (KITDIRS.includes(k)) return { dir: k, real: true, why: "" };
  return { dir: "electronic", real: false,
           why: (k || "this kit") + " is a drum machine the engine " +
                "synthesises — this reads it on the electronic kit's recordings" };
}

// which zone plays a midi note — the span first, nearest root otherwise
function zoneFor(sm, midi) {
  const zs = (sm && sm.zones) || [];
  let hit = zs.find((z) => midi >= z.lo && midi <= z.hi);
  if (!hit) for (const z of zs)
    if (!hit || Math.abs(midi - z.root) < Math.abs(midi - hit.root)) hit = z;
  return hit || null;
}

// THE WARM LIST'S HALF: the zone files this theme's notes would pull, as
// site-relative paths, so audio/offline.js can file them with the record and a
// warmed record can audition with the wire cut. Only the span's own zones — a
// two-octave tune on this map is one or two files, never six.
//
// `instr` ARRIVES SINCE 2026-08-25 and defaults to the piano, which is what
// every existing caller warmed. A caller that knows which voice reads the tune
// should pass its instrument (auditionVoice first), or the record will be
// warmed for a piano and audition, with the wire cut, in silence.
export function zoneFilesFor(midis, instr) {
  const sm = samplerNow(instr);
  if (!sm || !sm.dir) return [];
  const files = new Set();
  for (const m of midis || []) {
    const z = zoneFor(sm, m);
    if (z) files.add("found/samples/instruments/" + sm.dir + "/" + z.file);
  }
  return [...files];
}
// …and the kit's half, which is twelve files at most and usually four.
export function kitFilesFor(lanes, kit) {
  const K = auditionKit(kit);
  const out = new Set();
  for (const lane of lanes || []) if (KITFILE[lane])
    out.add("found/samples/drums/" + K.dir + "/" + KITFILE[lane]);
  return [...out];
}

/* ---------- the player ---------- */
let ctx = null;                       // this module's own context — never FaustLive's
const bufs = new Map();               // file href -> Promise<AudioBuffer>
let live = null;                      // { master, timers, onEnd } while sounding

function decode(href) {
  let p = bufs.get(href);
  if (!p) {
    p = fetch(href).then((r) => {
      if (!r.ok) throw new Error(href + " " + r.status);
      return r.arrayBuffer();
    }).then((ab) => ctx.decodeAudioData(ab));
    p.catch(() => bufs.delete(href));  // a failed fetch retries next press
    bufs.set(href, p);
  }
  return p;
}

export const auditioning = () => !!live;
// WHICH motif is sounding, so a page with several of them can say so without
// keeping a second copy of the answer. Null when nothing is.
export const auditioningKey = () => (live ? live.key : null);

export function stopAudition() {
  if (!live) return;
  const { master, timer, onEnd, noteTimers } = live;
  live = null;
  clearTimeout(timer);
  for (const t of noteTimers || []) clearTimeout(t);
  try {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.01);   // 10 ms out, no click
    setTimeout(() => { try { master.disconnect(); } catch (e) {} }, 60);
  } catch (e) {}
  if (onEnd) onEnd();
}

/* Play a motif once — or round and round.
 *
 *   notes   ui/abc.js toNotes() output ({at, len, midi} in sixteenth steps)
 *   hits    a drum cell instead: [{ at, lane, vel }], same steps
 *   bpm     the record's own tempo
 *   voice   { id }  from auditionVoice()  — a SAMPLERS id
 *   kit     { dir } from auditionKit()    — a directory of one-shots
 *   steps   the cell's METRICAL length in steps, so a loop comes round in
 *           time rather than at the last note's tail
 *   key     which motif this is, for auditioningKey()
 *   loop    keep going until stopAudition()
 *   again   called at the top of each lap AFTER the first; returns a fresh
 *           { notes, hits, bpm } read off the document, so a step changed
 *           while the loop runs is heard on the next pass. That is the whole
 *           reason the loop exists (Paul: "Give me a loop button to loop the
 *           motif") — you turn it on, change a step, and hear the change come
 *           round — and it is why the lap re-reads instead of re-scheduling
 *           the same buffers.
 *   onNote  fires as note `i` starts sounding; the caller's own highlight
 *           rides it. Plain JS timers laid against the same t0 the buffers are
 *           scheduled from: a lit note may drift a few ms from the sample,
 *           never a step.
 *
 * Returns true when it is now sounding, false when nothing could sound.
 * `onEnd` fires once, when the phrase runs out or stop is pressed — never
 * between laps.
 */
export function playAudition(spec, onEnd) {
  stopAudition();
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
  }
  if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const mine = { master, timer: 0, onEnd, noteTimers: [], key: spec.key || null };
  live = mine;
  if (!lap(mine, spec, true)) { live = null; try { master.disconnect(); } catch (e) {} return false; }
  return true;
}

// ONE PASS THROUGH THE MOTIF, scheduled from now. Returns false when there is
// nothing to sound at all, which on the FIRST lap is a refusal and on a later
// one is a loop that has been edited down to silence — it keeps going round,
// because a cell of rests is still sixteen steps long and the next lap may
// have notes in it again.
function lap(mine, spec, first) {
  const { bpm, voice, kit, onNote, loop, again } = spec;
  const src = first ? spec : (again ? again() : spec);
  if (!src) return false;
  const notes = (src.notes || []).map((x, i) => x && { ...x, i })
    .filter((x) => x && x.len > 0);
  const hits = (src.hits || []).filter((h) => h && KITFILE[h.lane]);
  const stepSec = 60 / Math.max(30, src.bpm || bpm || 96) / 4;   // a sixteenth
  const steps = Math.max(1, (src.steps || spec.steps || 16) | 0);
  if (first && !notes.length && !hits.length) return false;

  // WHERE THE SOUND COMES FROM, resolved before anything is scheduled so the
  // set of files is known and fetched once per lap (they are cached by href,
  // so a loop fetches nothing after its first pass).
  const sm = notes.length ? samplerNow(voice && voice.id) : null;
  const hrefs = new Set();
  const zoneOf = new Map();
  if (sm) for (const x of notes) {
    const z = zoneFor(sm, x.midi);
    if (!z) continue;
    const h = new URL("found/samples/instruments/" + sm.dir + "/" + z.file, SITE).href;
    zoneOf.set(x.i, { z, h });
    hrefs.add(h);
  }
  const kdir = (kit && kit.dir) || "electronic";
  const hitOf = new Map();
  hits.forEach((h, i) => {
    const href = new URL("found/samples/drums/" + kdir + "/" + KITFILE[h.lane], SITE).href;
    hitOf.set(i, href);
    hrefs.add(href);
  });

  const lapSec = steps * stepSec;
  Promise.all([...hrefs].map((h) => decode(h).then((b) => [h, b]).catch(() => [h, null])))
    .then((pairs) => {
      if (live !== mine) return;                        // stopped while decoding
      const byHref = new Map(pairs);
      const t0 = ctx.currentTime + 0.05;
      let end = 0;
      // the highlight's timers, one per note — laid whether or not the note's
      // buffer arrived, because the TIMELINE continues either way
      if (onNote) for (const x of notes)
        mine.noteTimers.push(setTimeout(() => {
          if (live === mine) onNote(x.i);
        }, Math.max(0, (t0 - ctx.currentTime + x.at * stepSec) * 1000)));
      for (const x of notes) {
        const zh = zoneOf.get(x.i);
        const buf = zh && byHref.get(zh.h);
        if (!buf) continue;
        const at = t0 + x.at * stepSec;
        const dur = Math.max(0.06, x.len * stepSec);
        one(buf, at, dur, Math.pow(2, (x.midi - zh.z.root) / 12), 1, mine.master);
        end = Math.max(end, x.at * stepSec + dur);
      }
      hits.forEach((h, i) => {
        const buf = byHref.get(hitOf.get(i));
        if (!buf) return;
        const at = t0 + h.at * stepSec;
        // A HIT IS ITS OWN LENGTH. A kick rings for as long as the recording
        // does and a step is not a gate on it, so the one-shot plays whole —
        // which is what the kit grid means and what the kernel does.
        one(buf, at, buf.duration, 1,
            Math.max(0.1, (h.vel == null ? 5 : h.vel) / 9), mine.master);
        end = Math.max(end, h.at * stepSec + Math.min(buf.duration, lapSec));
      });
      // THE LAP IS METRICAL, NOT THE LAST NOTE'S TAIL. A cell that ends in
      // rests still lasts its sixteen steps, so a loop comes round in time; a
      // note held past the barline is left to ring into the next pass, which
      // is what an instrument does.
      const wait = loop ? lapSec : Math.max(end, lapSec) + 0.3;
      mine.timer = setTimeout(() => {
        if (live !== mine) return;
        if (!loop) { stopAudition(); return; }
        mine.noteTimers = [];
        lap(mine, spec, false);
      }, wait * 1000);
    })
    .catch(() => { if (live === mine) stopAudition(); });
  return true;
}

// one recording, once: the envelope this module has always used (10 ms in,
// 10 ms out, no click) around a plain buffer source.
function one(buf, at, dur, rate, gain, master) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.setValueAtTime(gain, at + Math.max(0.01, dur - 0.01));
  g.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(g); g.connect(master);
  src.start(at);
  src.stop(at + dur + 0.02);
}

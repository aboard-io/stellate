// nukernel/audio/audition.js — HEAR IT ON THE PIANO. The seventh audio
// module, and like the other six it is small on purpose: it plays the THEME
// ALONE, on the GM acoustic grand, without booting the band engine — a
// musician leaning over and playing the tune once so you can hear what the
// staff says. It must therefore not touch FaustLive or the audio tier's
// state at all: it holds its own little AudioContext (made on the button's
// own click, which is the gesture the autoplay policy wants), fetches and
// decodes the few piano zones it needs once, and schedules plain
// AudioBufferSourceNodes. If the band is playing, the piano simply plays
// over it — the honest behaviour: the band is the record, this is somebody
// at the piano in the same room.
//
// THE NOTES ARE THE STAFF'S OWN: the caller hands in ui/abc.js toNotes()
// output — the same {at, len, midi} timeline toABC folds into bars — so the
// audition and the engraving can never disagree about a pitch or a length.
//
// THE INSTRUMENT IS THE REGISTRY'S: window.GenreKernel.SAMPLERS names the
// FluidR3 Yamaha grand (six zones, wavs under found/samples/instruments/),
// exactly as audio/offline.js already reads it for the warm list. A zone is
// picked for a note by its lo..hi span (nearest root as the fallback) and
// pitched by playbackRate = 2^((midi-root)/12); decodeAudioData resamples
// to the context rate, so the ratio is pure semitones.

const PIANO = "yamaha_grand_piano";
const SITE = new URL("../../", import.meta.url).href;   // the site root

const samplerNow = () =>
  (((window.GenreKernel || {}).SAMPLERS) || {})[PIANO] || null;

// which zone plays a midi note — the span first, nearest root otherwise
function zoneFor(sm, midi) {
  const zs = (sm && sm.zones) || [];
  let hit = zs.find((z) => midi >= z.lo && midi <= z.hi);
  if (!hit) for (const z of zs)
    if (!hit || Math.abs(midi - z.root) < Math.abs(midi - hit.root)) hit = z;
  return hit || null;
}

// THE WARM LIST'S HALF: the zone files this theme's notes would pull, as
// site-relative paths, so audio/offline.js can file them with the record
// and a warmed record can audition with the wire cut. Only the span's own
// zones — a two-octave tune on this map is one or two files, never six.
export function zoneFilesFor(midis) {
  const sm = samplerNow();
  if (!sm || !sm.dir) return [];
  const files = new Set();
  for (const m of midis || []) {
    const z = zoneFor(sm, m);
    if (z) files.add("found/samples/instruments/" + sm.dir + "/" + z.file);
  }
  return [...files];
}

/* ---------- the player ---------- */
let ctx = null;                       // this module's own context — never FaustLive's
const bufs = new Map();               // file href -> Promise<AudioBuffer>
let live = null;                      // { master, timer, onEnd } while sounding

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

export function stopAudition() {
  if (!live) return;
  const { master, timer, onEnd } = live;
  live = null;
  clearTimeout(timer);
  try {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.01);   // 10 ms out, no click
    setTimeout(() => { try { master.disconnect(); } catch (e) {} }, 60);
  } catch (e) {}
  if (onEnd) onEnd();
}

// play the theme once. `notes` is toNotes() output ({at, len, midi} in
// sixteenth steps); `bpm` the record's own tempo. Returns true when it is
// now sounding, false when nothing could sound (no sampler, no notes).
// `onEnd` fires once, when the phrase runs out or stop is pressed.
export function playAudition({ notes, bpm }, onEnd) {
  stopAudition();
  const sm = samplerNow();
  const list = (notes || []).filter((x) => x && x.len > 0);
  if (!sm || !list.length) return false;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
  }
  if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const stepSec = 60 / Math.max(30, bpm || 96) / 4;     // a sixteenth
  const mine = { master, timer: 0, onEnd };
  live = mine;
  const hrefs = new Set();
  for (const x of list) {
    const z = zoneFor(sm, x.midi);
    if (z) hrefs.add(new URL("found/samples/instruments/" + sm.dir + "/" + z.file, SITE).href);
  }
  Promise.all([...hrefs].map((h) => decode(h).then((b) => [h, b])))
    .then((pairs) => {
      if (live !== mine) return;                        // stopped while decoding
      const byHref = new Map(pairs);
      const t0 = ctx.currentTime + 0.05;
      let end = 0;
      for (const x of list) {
        const z = zoneFor(sm, x.midi);
        const buf = z && byHref.get(new URL("found/samples/instruments/" +
          sm.dir + "/" + z.file, SITE).href);
        if (!buf) continue;
        const at = t0 + x.at * stepSec;
        const dur = Math.max(0.06, x.len * stepSec);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = Math.pow(2, (x.midi - z.root) / 12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(1, at + 0.01);   // 10 ms in
        g.gain.setValueAtTime(1, at + Math.max(0.01, dur - 0.01));
        g.gain.linearRampToValueAtTime(0, at + dur);    // 10 ms out
        src.connect(g); g.connect(master);
        src.start(at);
        src.stop(at + dur + 0.02);
        end = Math.max(end, x.at * stepSec + dur);
      }
      mine.timer = setTimeout(() => { if (live === mine) stopAudition(); },
        (end + 0.3) * 1000);
    })
    .catch(() => { if (live === mine) stopAudition(); });
  return true;
}

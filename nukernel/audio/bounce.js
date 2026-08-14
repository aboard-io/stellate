// audio/bounce.js — the background carrier. The song is a CLOSED FINITE LOOP
// (a seeded, deterministic bar list that wraps), which dissolves the parent
// app's hardest problem entirely: it never needed segment A/B swapping, MSE
// append pipelines or fMP4 timestamp surgery here, because the whole song can
// be rendered ONCE into a buffer and played in a loop=true <audio> element.
//
// The element is created and unlocked INSIDE the play gesture, then kept
// PLAYING, MUTED and PHASE-LOCKED for the whole session — so backgrounding is
// a volume swap with no play() for iOS to refuse, no seek to be late, and the
// parent's known race (ctx statechange arriving before visibilitychange) is
// harmless because the carrier is already running. survival.js does the
// swapping; this file owns the element, the offline render and the phase.
//
// NOT MediaStreamDestination -> <audio srcObject>. That is the route that
// looks cheapest and the parent PROVED cannot work: the audible path still
// mirrors a live graph, so when iOS freezes audio I/O the last quantum loops
// at the CoreAudio boundary in a window JS cannot close (docs/WAV-FIRST.md
// §"the founding failure", live.js goHidden's mute+pause of exactly that
// element). The carrier here plays RENDERED BYTES, below no live graph.
//
// Layer graph: deps -> state -> derive -> graph -> assets -> voices -> mixer
// -> transport -> THIS FILE -> survival -> ui views. It renders through the
// same parameterized builders the live graph uses (graph.buildMasterChain /
// mixer.buildChannel / transport.scheduleBar), so the carrier is the same
// mix — a fork of any of those walks is how it would drift out of tune.
import { GENRES, BASSSYNTH, DTIMES } from "../ui/deps.js";
import { SONG, SLOTS, loopOnly, bpm, on } from "../ui/state.js";
import { stackOf, kitOf, boxBars } from "../ui/derive.js";
import { buildMasterChain, buildEchoBus, makeVerb, masterVol, barSec } from "./graph.js";
import { FONT, isSynthFont, fontDef } from "./assets.js";
import { makeSynthNode, driveSynth, offFallback } from "./voices.js";
import { chanSpec, buildChannel, armAutomation } from "./mixer.js";
import { buildTimeline, scheduleBar, stepDur, playing, getPosition,
         onGesture } from "./transport.js";

/* ---------- the carrier element ---------- */
let el = null, armed = false, carrying = false;
let gen = 0;                                       // bumped per render request; stale renders discard
const urls = [];                                   // blob URLs, at most 2 kept alive
const st = { state: "idle", durSec: 0, gen: 0, sampledOnly: false,
             lastRenderMs: 0, url: null, fallbacks: 0 };
// the machine-readable truth for test/browser/nukernel-survival.test.js — the
// gate reads the RENDERED BLOB through st.url, because an analyser on the
// live graph is structurally blind to an element playing bytes
window.__nuBounce = () => ({ ...st, carrying, armed,
  elVolume: el ? el.volume : null, elTime: el ? el.currentTime : null,
  // el.paused is a RENDERED consequence (play() rejected, decode failed) —
  // carrying/elVolume are flags this module SET, and a gate that polls only
  // what the code assigned proves the assignment, not the playback
  elPaused: el ? el.paused : null });

// tiny silent-WAV data URI — the parent's unlock trick: a muted play() of this
// inside the gesture is what permits every later programmatic play()
function silentWav(ms) {
  const sr = 8000, n = Math.max(1, Math.round(sr * (ms || 120) / 1000)), dataLen = n * 2;
  const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
  let o = 0;
  const w = s => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, 1, true); o += 2;
  dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * 2, true); o += 4; dv.setUint16(o, 2, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, dataLen, true); o += 4;      // zeros = silence
  const bytes = new Uint8Array(buf); let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}
function armCarrier() {
  if (armed) return;
  armed = true;
  el = new Audio();
  el.autoplay = false; el.loop = true; el.preload = "auto";
  el.setAttribute("playsinline", ""); el.playsInline = true;
  el.style.display = "none";
  // BEFORE any attach, the parent's hard-won order: ManagedMediaSource-era
  // WebKit wants remote playback disabled up front or media plumbing hangs
  // silently — and a background carrier must never be an AirPlay target anyway
  try { el.disableRemotePlayback = true; } catch (e) {}
  el.setAttribute("x-webkit-airplay", "deny");
  el.muted = true; el.volume = 0;
  el.src = silentWav(150);
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  document.body.appendChild(el);
}
onGesture(armCarrier);                             // rides startAt's synchronous prefix

/* ---------- render scheduling ---------- */
// the musical identity of what a render would capture: song + phrases + tempo
// + font + loop selection. Volume is deliberately absent — the carrier renders
// at unity and the element's own volume does the placing on handoff.
const sig = () => JSON.stringify({ s: SONG, sl: SLOTS, bpm, f: FONT, lo: loopOnly });
let renderedSig = null, timer = null, rendering = false, dirty = false;
function schedule(delayMs) {
  clearTimeout(timer);
  // debounced and DEFERRED: the first render waits ~3 bars past play (the
  // precache rule — never compete with the boot or the first sound), edits
  // wait 4 s of quiet so a scrub does not queue thirty renders
  timer = setTimeout(maybeRender, delayMs == null ? 4000 : delayMs);
}
async function maybeRender() {
  if (!armed || !playing) return;
  if (rendering) { dirty = true; return; }         // one render at a time
  const want = sig();
  if (want === renderedSig && st.state === "ready") return;
  rendering = true;
  st.state = "rendering";
  const myGen = ++gen;
  const t0 = performance.now();
  try {
    const res = await renderSong();
    if (myGen !== gen) { /* stale: a newer request superseded this render */ }
    else if (!res) st.state = "idle";              // nothing to render
    else {
      st.lastRenderMs = Math.round(performance.now() - t0);
      adopt(res, want, myGen);
    }
  } catch (e) {
    if (myGen === gen) { st.state = "failed"; console.warn("[nukernel] bounce render failed:", e); }
  }
  rendering = false;
  if (dirty) { dirty = false; schedule(1500); }
}

/* ---------- the offline render ---------- */
async function renderSong() {
  const TL = buildTimeline();
  if (!TL.length) return null;
  const sd = stepDur(), SR = 44100, LEAD = 0.05, TAIL = 1.5;
  const durSec = TL.reduce((s, b) => s + b.barSteps, 0) * sd;
  const octx = new OfflineAudioContext(2, Math.ceil((LEAD + durSec + TAIL) * SR), SR);
  // the same room: master numbers, echo topology, cached reverb impulses —
  // all built by the graph's own parameterized builders
  const master = buildMasterChain(octx);           // out stays at unity
  const echo = buildEchoBus(octx, master.input);
  const verbs = new Map();
  const verb = name => {
    let v = verbs.get(name); if (!v) verbs.set(name, v = makeVerb(octx, name, master.input));
    return v;
  };
  const env = { master: master.input, verb, echoIn: echo.input };
  const chans = new Map();
  const chanOf = sec => {
    const spec = chanSpec(sec), k = JSON.stringify(spec);
    let c = chans.get(k);
    if (!c) { c = buildChannel(octx, spec, env); c.key = k; chans.set(k, c); }
    return c;
  };

  // ---- the offline Faust pool ----
  // Worklets on an OfflineAudioContext are a per-browser fact, not a given
  // (addModule from a blob URL is a CSP question in production). ATTEMPT the
  // real voices; on any failure degrade to sampled-only — the synth genres
  // play their sampled instrument instead — and COUNT it. Never silently.
  st.sampledOnly = false;
  const pool = new Map();                          // "dsp#v" -> node
  const routes = new Map();                        // node -> Map(chanKey -> gain)
  const specs = [...new Set([
    ...(isSynthFont() ? [fontDef().synth] : []),
    ...SONG.flatMap(x => stackOf(x).filter(e => GENRES[e.g] && GENRES[e.g].synth).map(e => GENRES[e.g].synth)),
    ...SONG.filter(x => BASSSYNTH[x.bassop]).map(x => BASSSYNTH[x.bassop])])];
  if (specs.length) {
    const depth = Math.min(8, Math.max(1, ...SONG.map(sec =>
      stackOf(sec).reduce((n, e) => n + (GENRES[e.g] ? GENRES[e.g].voices : 0), 0))));
    try {
      for (const sp of specs)
        for (let v = 0; v < depth; v++)
          pool.set(sp.dsp + "#" + v, await makeSynthNode(octx, sp));
    } catch (e) {
      pool.clear();
      st.sampledOnly = true;
    }
  }
  const routeTo = (node, chan) => {
    let m = routes.get(node);
    if (!m) routes.set(node, m = new Map());
    let g = m.get(chan.key);
    if (!g) {
      g = octx.createGain(); g.gain.setValueAtTime(0, 0);
      node.connect(g); g.connect(chan.input); m.set(chan.key, g);
    }
    return g;
  };
  // the offline focusSynths: at each section start, exactly one route is open
  const focusAt = (chan, when) => {
    for (const node of pool.values()) {
      routeTo(node, chan);
      for (const [k, g] of routes.get(node))
        try { g.gain.setValueAtTime(k === chan.key ? 1 : 0, when); } catch (e) {}
    }
  };
  const offSynth = (sp, midi, when, durSec2, acc, sld, vel, v, chan, vox) => {
    const node = pool.get(sp.dsp + "#" + (v || 0));
    if (!node) return false;                       // degrades to the sampled voice
    routeTo(node, chan);
    driveSynth(node, sp, midi, when, durSec2, acc, sld, vel, vox);
    return true;
  };

  // ---- the walk: the live tick's bar loop against offline time ----
  offFallback.n = 0;
  let t = LEAD, cur = null;
  for (const bar of TL) {
    const sec = SONG[bar.si];
    if (!sec) continue;
    if (!cur || cur.si !== bar.si || bar.first)
      cur = { si: bar.si, chan: chanOf(sec), kit: kitOf(sec) };
    if (bar.first) {
      echo.setTime(DTIMES[sec.dtime || "d8"], t);
      // the SAME walker the live tick arms — the carrier honors automation
      // (mot included, since mot compiles into the same list in chanSpec)
      armAutomation(cur.chan, t, bar.barSteps * sd * boxBars(sec), sd * 4);
      focusAt(cur.chan, t);
    }
    scheduleBar(bar, sec, cur.chan, cur.kit, t, sd, offSynth);
    t += bar.barSteps * sd;
  }
  const buf = await octx.startRendering();
  st.fallbacks = offFallback.n;
  return { buf, durSec, lead: LEAD, sr: SR };
}

/* ---------- fold + encode ---------- */
// The loop wrap is a DOWNBEAT, so the seam law's hardest rule (never cut on
// one) is satisfied by construction: the render is continuous through sample
// N into the tail, and folding that ring-out additively onto the head is what
// a DAW's "bounce loop with tail" does — the reverb and releases of the last
// bar arrive under the first bar of the next pass, exactly as they do live.
// The last ~10 ms of the folded tail is eased to zero so the fold itself
// cannot step.
function foldAndEncode(res) {
  const { buf, durSec, lead, sr } = res;
  const N = Math.round(durSec * sr), lead0 = Math.round(lead * sr);
  const tailN = Math.max(0, Math.min(buf.length - lead0 - N, N));
  const fade = Math.max(1, Math.round(0.01 * sr));
  const chs = [new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
    const o = chs[c];
    for (let i = 0; i < N; i++) o[i] = d[lead0 + i];
    for (let i = 0; i < tailN; i++) {
      let v = d[lead0 + N + i];
      if (i > tailN - fade) v *= (tailN - i) / fade;
      o[i] += v;
    }
  }
  // 16-bit stereo WAV — the blob is same-origin bytes, decodable by the gate
  const dataLen = N * 4;
  const ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
  let p = 0;
  const w = s => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(p, 36 + dataLen, true); p += 4; w("WAVE");
  w("fmt "); dv.setUint32(p, 16, true); p += 4; dv.setUint16(p, 1, true); p += 2; dv.setUint16(p, 2, true); p += 2;
  dv.setUint32(p, sr, true); p += 4; dv.setUint32(p, sr * 4, true); p += 4; dv.setUint16(p, 4, true); p += 2; dv.setUint16(p, 16, true); p += 2;
  w("data"); dv.setUint32(p, dataLen, true); p += 4;
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, chs[c][i]));
      dv.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true); p += 2;
    }
  return new Blob([ab], { type: "audio/wav" });
}
function adopt(res, want, myGen) {
  const url = URL.createObjectURL(foldAndEncode(res));
  urls.push(url);
  while (urls.length > 2) { try { URL.revokeObjectURL(urls.shift()); } catch (e) {} }
  st.url = url; st.durSec = res.durSec; st.gen = myGen; st.state = "ready";
  renderedSig = want;
  // the no-stall cutover: never yank the source out from under a carrying
  // element — uncarry() swaps to the newest blob when the graph takes back
  // over. And only while the transport still RUNS: a render finishing after
  // stop() must not restart the element the transport:state(false) handler
  // just paused (an unmuted volume-0 loop decodes forever — worse than the
  // muted loop that handler's own comment forbids). The render stays
  // adopted; the next play's transport:state handler attaches it.
  if (el && !carrying && playing) attachCurrent();
}
function attachCurrent() {
  if (!el || !st.url) return;
  el.src = st.url; el.loop = true;
  el.muted = false; el.volume = 0;                 // audible only by volume, never by unmute
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  syncEl();
}

/* ---------- phase lock ---------- */
function phase() {
  const p = getPosition();
  if (!(st.durSec > 0)) return 0;
  return (((p.now - p.loopStart) % st.durSec) + st.durSec) % st.durSec;
}
function syncEl() {
  if (!el || !st.url) return;
  try {
    const ph = phase();
    if (Math.abs((el.currentTime || 0) - ph) > 0.03) el.currentTime = ph;
  } catch (e) {}
}
// kept in phase at 1 Hz while the graph is the audible source, so the hide
// handoff is a volume swap with NO seek in the throttled window
setInterval(() => {
  if (el && !carrying && playing && st.state === "ready") syncEl();
}, 1000);

/* ---------- the handoff (called by survival.js) ---------- */
export function carry() {
  if (!el || !playing || st.state !== "ready" || !st.url) return false;
  // IDEMPOTENT: goHidden is reachable twice while carrying (ctx statechange
  // fires before the late visibilitychange on an iOS app switch, and
  // pagehide doubles visibilitychange on backgrounding). A second carry()
  // must not re-run syncEl — phase() reads the ctx clock, FROZEN since the
  // first handoff, so the seek rewinds the audibly-playing element.
  if (carrying) return true;
  syncEl();                                        // one last correction while the clock still runs
  el.muted = false;
  el.volume = Math.max(0, Math.min(1, masterVol()));
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  carrying = true;
  return true;
}
export function uncarry() {
  if (!carrying) return null;
  carrying = false;
  const ph = el ? (el.currentTime || 0) : null;
  if (el) {
    el.volume = 0;
    // a render that landed while we were carrying waits here — swap now
    if (st.url && el.src !== st.url) attachCurrent();
  }
  return ph;
}
export const isCarrying = () => carrying;

/* ---------- subscriptions ---------- */
on("transport:state", d => {
  if (d.playing) {
    // keep the (possibly stale-phased) carrier rolling and re-lock it; first
    // render waits ~3 bars so it never competes with the first sound
    if (el && st.url) attachCurrent();
    schedule(Math.max(2000, barSec() * 3 * 1000));
  } else {
    clearTimeout(timer);
    if (carrying) uncarry();
    if (el) { try { el.pause(); } catch (e) {} }   // a muted loop still costs battery
  }
});
// a musical edit makes the rendered blob stale; re-render after the dust
// settles. "transport" includes volume moves, but sig() ignores them, so
// maybeRender no-ops those.
const changed = () => { if (playing) schedule(); };
on("box", changed);
on("phrase", changed);
on("transport", changed);
on("song", () => {
  // a whole new song: whatever is rendered is the WRONG music — invalidate
  // rather than carry a ghost (the "song" event also stops the transport)
  gen++;                                           // cancels any in-flight render
  renderedSig = null;
  st.state = "idle"; st.url = null; st.durSec = 0;
  while (urls.length) { try { URL.revokeObjectURL(urls.shift()); } catch (e) {} }
  if (el) { try { el.pause(); el.removeAttribute("src"); } catch (e) {} }
});

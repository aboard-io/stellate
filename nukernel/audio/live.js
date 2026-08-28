// audio/live.js — nukernel plays through THE PARENT ENGINE. All of it.
//
// WHAT THIS FILE REPLACED, and why it is a hundredth of the size: nukernel had
// grown a second engine beside engine/faust/ — a scheduler (transport.js, 735
// lines), channel strips (mixer.js, 1,184), a master chain and three reverbs
// (graph.js, 1,395), a voice router (voices.js, 1,204) and an offline render
// (bounce.js, 2,165). Every one of them is something engine/faust/ already does,
// and every bug of the two days before this round was a SEAM between the two:
// the desk absent from the tape (8.7 dB down, no sends, no automation), drums
// playing a different 606 on each path, velocity meaning a filter on one side
// and a fader on the other, and a render that never completed on WebKit — which
// killed the tab on iOS, because an OfflineAudioContext there cannot build a
// Faust worklet and nothing bounded the retry.
//
// So there is one engine now. FaustLive.exploreLive does the scheduling, the
// voice pools, the ring, the buses, the master chain, the reverbs and — on a
// phone — the WAV-first media element that is the reason audio survives a
// pocket. What arrives from nukernel is NOTES: `opts.events` hands the walk one
// bar of audio/plan.js's translation, and `opts.barBeats` tells it how long that
// bar is, because nukernel's tempo map warps every bar by its own ratio.
//
// THERE IS NO SECOND PATH AND NO FLAG THAT MAKES ONE. A dormant engine is what
// this round exists to end; the only thing below that resembles a fallback is
// the parent's OWN route demotion (ring -> wav-first), which is the parent
// choosing between two of its own outputs, bounded to one attempt and reported.
//
// Layer graph: deps -> state -> derive -> plan/desk -> THIS FILE -> ui views.
// It publishes ("transport:state", "transport:section", "status", "refresh")
// and never imports a view.
import { SONG, MASTER, BUSES, bpm, vol, on, emit, pendingStart, setPendingStart } from "../ui/state.js";
import { GENRES } from "../ui/deps.js";
import { stackOf } from "../ui/derive.js";
import { compile, timeline, barCount, barBeatsAt, barPlan, parentState,
         stepDur, songDurSec, warmEngine, firstBarOfBox,
         unrouted, warmSources } from "./plan.js";
import { FONT, setFont } from "./fonts.js";
import { masterState } from "./desk.js";
// THE HOLD'S OWN SENTENCE. audio/offline.js counts what this record needs and
// what the worker actually has; the words land in engineLine below, because the
// engine sentence is the page's one live region about "what the ear is getting"
// and a second status line is how two answers come to disagree.
import { holdLine } from "./offline.js";

const FAUSTDIR = new URL("../../engine/faust/", import.meta.url).href;

export let playing = false;
export let playingSec = -1;

let handle = null;                 // the parent's live handle
let barBase = 0;                   // which nukernel bar the walk's serial 0 is
let passStart = 0, passBar = 0, loopStart = 0, lastBar = -1;
let deps = null;

/* ---------- the position + pending feeds' state ---------- */
let curBar = null;                 // the SOUNDING bar: { n, serial, when, beats, spb }
let posTimer = null;               // the one ticker under both feeds
let lastPos = null;                // last emitted { bar, beat }, so "pos" only fires on change
let lastAsked = -1;                // the last serial the walk asked events() for
const pendings = new Map();        // label -> { label, landsSerial, landsBar, lastLeft }

/* ---------- the failure is BOUNDED ---------- */
// THIS IS THE iOS BUG'S FIX, in three numbers. What killed the tab was not a
// slow render — it was an UNBOUNDED one: a walk that could not finish kept
// allocating, kept retrying, and nothing could tell the difference between "still
// going" and "never going to finish". So: a DEADLINE (the engine has this long to
// make a sound), a CEILING (two starts, ever — the ring and then the parent's own
// media route) and a DEMOTION that is written down rather than retried.
const DEADLINE_MS = 45000;         // generous: a cold phone decodes a GM bank first
const MAX_TRIES = 2;               // ring, then wav-first. There is no third.
const st = {
  state: "idle",                   // idle | starting | ready | failed
  stage: "",                       // "" | "full" — the engine is sounding the song
  route: "",                       // the parent's own outputRoute
  tries: 0,
  capped: null,                    // { why, rate, gotSec, wantSec } — the give-up, in writing
  deadlineMs: DEADLINE_MS,
  lastError: null,
  startedAt: 0,
};
let deadlineTimer = null;
// THE REPORT. The hooks hang off `window` in a browser and off globalThis in a
// pure-node gate, so this module can be imported and read without a DOM — which
// is what lets the one-engine contract be gated without launching chromium.
// `window.__nuBounce` is the name the gates already call, and it
// still answers the same question — "is there sound, and if not will there ever
// be" — about a live engine instead of a rendered tape. `stage:"full"` used to
// mean the whole song had been pressed; it now means the engine is sounding the
// whole song, which is the same promise kept by a shorter route.
const W = typeof window !== "undefined" ? window : globalThis;
W.__nuBounce = () => ({ ...st, durSec: songDurSec(), playing,
  pressRate: st.route ? 1 : 0, unrouted: unrouted().length });
W.__nuRender = () => ({ chunks: lastBar + 1, bars: barCount(),
  route: st.route, errors: handle ? (handle.errors || []).slice(0, 6) : [] });
// THE MIX, AS THE ENGINE WAS ACTUALLY HANDED IT. `window.__nuMix` used to
// report the nodes audio/mixer.js had built — the second engine's own graph. It
// now reports the numbers the desk wrote onto the parent's voice units for the
// bar that is sounding, which is the same question asked of the thing that
// makes the sound rather than of a copy beside it: what is this voice's level,
// where is it placed, how much of it goes to the reverb and the delay, and what
// tone is on its strip. A gate that reads this is reading the artifact.
W.__nuMix = () => {
  const p = barPlan(Math.max(0, lastBar));
  if (!p) return null;
  const units = {};
  for (const [k, u] of Object.entries(p.units)) {
    if (!u || k.slice(0, 2) === "__") continue;
    units[k] = { module: u.module || null, sampler: u.sampler ? u.sampler.id : null,
      drum: !!u.drum, role: u.role || null,
      lvl: +(u.lvl != null ? u.lvl : 1).toFixed(4), pan: +(u.pan || 0).toFixed(4),
      rev: +(u.rev || 0).toFixed(4), del: +(u.del || 0).toFixed(4),
      // ...AND THE GENRE SEND (series-bus round, 2026-08-27): the fourth send
      // the strips carry now. The renderer reads u.genre at the same three
      // sites as u.rev/u.del; a window that shows two of a strip's three
      // sends is showing a strip that does not exist.
      genre: +(u.genre || 0).toFixed(4),
      // ...AND THE TONE ON A MODELLED VOICE TOO. This read was
      // `(u.sampler && u.sampler.strip) || null`, so it reported `null` for every
      // Faust-modelled chair — which was accurate while desk.js dropped the EQ on
      // one, and would have gone on being a lie the moment it stopped. The strip
      // now rides at `u.strip` when the voice has no sampler (audio/desk.js), and
      // a window that calls itself "the artifact" has to show both carriers.
      strip: (u.sampler && u.sampler.strip) || u.strip || null };
  }
  return { si: playingSec, bar: lastBar, route: st.route, units,
           notes: p.ev.pitched.length, hits: p.ev.drums.length,
           sweeps: p.ev.sfx.length, master: engineReport() };
};
// WHAT THE EAR IS ACTUALLY GETTING. `__nuEngine` used to answer six fields —
// route, state, rms, load, bars, units — while the handle it was holding
// exposed underrunShape(), runwaySec(), ringDeficit(), __producer(),
// clickMon() and auditStats(), and none of them reached the page, the console
// or a gate. For two days the only thing this page could say about a 583 ms
// hole in its own output was "load: 1" (measured 2026-08-24, 10 min 51 s into a
// twelve-minute soak). health() is the same question asked of the instruments
// that can answer it, folded into the hook so there is still one report.
W.__nuEngine = () => ({ route: st.route, state: st.state,
  rms: handle ? safeRms() : 0, load: loadRatio, bars: barCount(),
  units: Object.keys((barPlan(Math.max(0, lastBar)) || { units: {} }).units).length,
  ...health() });
// the readout's own sentence, so a gate can read it before ui/eight.js paints it
W.__nuEngineLine = () => engineLine();

function settle(stage, why, extra) {
  clearTimeout(deadlineTimer); deadlineTimer = null;
  if (stage === "full") { st.state = "ready"; st.stage = "full"; return; }
  // GIVEN UP ON, IN WRITING. A cap carries its reason and, where one was
  // measured, its rate — a cap for slowness with no number is a guess.
  st.state = handle ? "ready" : "failed";
  st.capped = { why, rate: (extra && extra.rate) || 0,
                gotSec: (extra && extra.gotSec) || 0, wantSec: songDurSec() };
}

/* ---------- the state the parent walks ---------- */
// ONE SECTION, ONE CYCLE, forever. The parent's walk uses `sections` to shape
// ITS composer's form — fills on the last cycle, sweeps at the edges, the swell
// a voice gets on its first entrance. nukernel's composer has already decided all
// of that, bar by bar, so the walk is handed a single flat section and its form
// machinery becomes inert. What it keeps doing — and what it is here for — is the
// clock, the runway, the ring, the buses and the master stage.
const LIVE_SECTION = { name: "nukernel", drums: "full", bass: "root", pads: true,
                       melody: "lead", cycles: 1, fill: "off", sweep: "off" };
// THE WALK IS NEVER HANDED NULL. The parent's stepWalk reads the state's
// progression the moment it is asked for a bar, and a recompile can leave
// `parentState()` momentarily empty (a song mid-edit, a jump landing between
// compiles) — which surfaced as "FaustLive pump TypeError: reading
// 'progression'" and a dead pump, on the drum machine's every other word.
// The last good state stands in until the next one exists.
let lastState = null;
function getState() {
  const base = parentState() || lastState;
  if (!base) return null;
  lastState = base;
  // THE MASTER STRIP AND THE RACK ARE PART OF THE STATE, not a chain of their
  // own — the parent resolves fx_bus, master_mb, reverbColor and the delay from
  // exactly these fields, so a board move lands on the next bar the walk asks
  // for (audio/desk.js masterState says which field is which, and which three
  // have no home).
  //
  // THIS SPREAD IS WHY audio/plan.js NEEDED NO EDIT. `base` is the compiled
  // state and it carries plan.js's deliberate `reverb: 0`; the spread lands
  // OVER it, per stream, so the rack's return is what the engine reads and the
  // compiled default stands whenever the document says nothing.
  // `deps.SE` rides along (series-bus round, 2026-08-27) so the genre bus's
  // chain chips are finished through insertChain — the same clamp door every
  // section chip takes. Before deps resolve, masterState still answers; the
  // chain simply arrives in the raw fields dialect, which mkChain builds.
  return { ...base, bpm, sections: [LIVE_SECTION], vapor: 0,
           ...(masterState(MASTER, BUSES, deps && deps.SE) || {}) };
}

/* ---------- the two hooks: notes in, bar lengths in ---------- */
const barOfSerial = (serial) => {
  const n = barCount();
  return n ? (((barBase + serial) % n) + n) % n : 0;
};
const events = (one, meta) => {
  // WHEN THE ENGINE ASKS, AND FOR WHICH BAR — the only honest way to measure
  // how far ahead of the ear an edit has to land (a page can compare the bar
  // it was on when a word was said to the first bar the engine asked for
  // afterwards). Costs one assignment per bar. The module keeps its own copy
  // (`lastAsked`) rather than reading the window global back, because the
  // pending-change feed below computes with it on every announce.
  lastAsked = meta.serial;
  try { if (typeof window !== "undefined") window.__nuAsk = meta.serial; } catch (e) {}
  const p = barPlan(barOfSerial(meta.serial));
  // `fx` (2026-08-28) is the third thing a bar may say, and the seam takes it
  // the same way it takes the cast: audio/plan.js barFx writes the section's own
  // echo time in the parent's own units, and the walk merges it over
  // SE.fxParams for THIS bar only (engine/faust/live/live.js, the foreign-
  // composer seam). Absent on every record that has never named one, so the key
  // is simply not there and the parent's own fxParams stands untouched.
  if (p) return p.fx ? { ev: p.ev, units: p.units, fx: p.fx }
                     : { ev: p.ev, units: p.units };
  // NEVER NULL. The parent reads a null as "this caller has nothing to say
  // about this bar, compose it yourself" — and it cannot compose a foreign
  // state (no progression), so a bar asked for mid-recompile killed the pump
  // with "unknown progression 'undefined'". A bar we have no plan for is a
  // bar of silence, which is the truth.
  return { ev: { pitched: [], drums: [], found: [], sfx: [], srcById: {}, totalBeats: 4 },
           units: {} };
};
const barBeats = ({ serial }) => barBeatsAt(barOfSerial(serial));

/* ---------- the playhead ---------- */
// The parent tells us when each bar actually SOUNDS (live.js onBar fires off the
// read cursor on the ring path and off the element's own currentTime on the
// media one). That instant is the only clock the UI needs: everything the old
// transport computed from its own lookahead is arithmetic on it.
let loadRatio = 0;
function onBar(info) {
  const n = barOfSerial(info.serial);
  const TL = timeline();
  const bar = TL[n];
  if (!bar) return;
  lastBar = n;
  // the position feed's anchor: this bar's downbeat on the engine's own clock.
  // `when` is exact on the ring route (and still exact while hidden, where the
  // parent fires early); on the media routes it is the poll instant — either
  // way it is the one clock the beat math below may honestly ride.
  curBar = { n, serial: info.serial, when: info.when,
             beats: barBeatsAt(n), spb: info.spb || 60 / bpm };
  // A COUNTDOWN THAT LANDED IS OVER, whatever the arithmetic said. On the
  // crossfade path the parent prunes queued bars and jumps serials, so a
  // change can sound EARLIER than the serial rule predicted — the honest
  // detector on every route is the first heard bar at or past the landing.
  for (const p of [...pendings.values()])
    if (info.serial >= p.landsSerial) {
      pendings.delete(p.label);
      emit("pending", { label: p.label, beatsLeft: 0,
                        who: p.who, role: p.role, si: p.si, round: p.round,
                        landsBar: p.landsBar, landsSerial: p.landsSerial });
    }
  if (st.state === "starting") settle("full");
  if (bar.first) {
    passStart = info.when; passBar = n;
    if (bar.si !== playingSec) {
      // The playhead marks which box is SOUNDING; it must not move the SELECTION,
      // or a click lands on whatever bar happened to be playing.
      playingSec = bar.si;
      emit("transport:section", { si: playingSec });
    }
  }
  if (n === 0) loopStart = info.when;
  // A QUEUED JUMP LANDS ON A BAR LINE. The parent schedules a runway ahead, so
  // the jump takes effect as soon as the walk reaches it rather than on the very
  // next bar the ear hears — which is the honest cost of one engine with a
  // runway, and it is bars, not seconds.
  if (pendingStart != null && bar.first) {
    const at = firstBarOfBox(pendingStart);
    setPendingStart(null);
    if (at >= 0) barBase = (at - info.serial - 1 + barCount() * 2) % Math.max(1, barCount());
  }
}
const safeRms = () => { try { return handle && handle.rms ? handle.rms() : 0; } catch (e) { return 0; } };
export const rmsNow = () => (playing ? safeRms() : 0);
export const lastLoadReport = () => ({ ratio: loadRatio, eco: 0,
  route: st.route, gapMs: 0, budgetMs: 0 });
export const engineHandle = () => handle;
// WHICH OUTPUT THE EAR IS ON. There is no carrier and no tape any more — there
// is one engine with two of its own outputs, and this is which one it opened.
// The readout used to say "tape" or "live" about two different engines; it now
// says which route the ONE engine took, which is the fact that was actually
// wanted (the parent's own `outputRoute`, verbatim).
export const onMedia = () => /^(mms|mse|segAB|media)/.test(st.route || "");
// WHAT THE MASTER STAGE ACTUALLY IS, for the board's readouts. It used to be
// read off nodes this page had built (graph.masterReport / busReport); the
// stages are the parent's now, so the answer comes from the parent's own
// resolvers over the same state the stream was opened with. Same question, one
// engine's answer instead of a second engine's.
export function engineReport() {
  const base = parentState();
  if (!base || !deps) return null;
  const { SE } = deps;
  const fx = SE.fxParams(base) || {};
  const rc = SE.reverbColor(base);
  const mb = SE.masterMb(base);
  const stages = [];
  if (rc) stages.push(rc.module.replace(/^reverb_/, "") + " " + rc.rgain.toFixed(2));
  if (mb) stages.push(mb.module.replace(/^master_/, "") + " " + mb.mbdrive.toFixed(2));
  stages.push("limit");
  return { stages,
    rev: rc ? { [rc.module.replace(/^reverb_/, "")]: rc.rgain.toFixed(2) } : {},
    echo: fx.dtime != null ? { ret: (fx.dgain || 0).toFixed(2),
                               fb: (fx.dfb || 0).toFixed(2),
                               tone: Math.round(fx.dcut || 0) } : null,
    room: rc ? rc.rtone.toFixed(2) : null };
}

/* ---------- the health report, and the one sentence it prints ---------- */
// WHY THIS EXISTS. On 2026-08-24 the page dropped 583 ms of audio at 10:51 and
// another 447 ms at 7:53 on a contended box, and there was no way to ask it
// what had happened: __nuEngine() answered six fields, none of them a counter,
// and the handle's own instruments — underrunShape(), runwaySec(),
// ringDeficit(), __producer(), clickMon(), auditStats() — reached nobody. A
// defect that takes eleven minutes to appear once cannot be chased through a
// readout that cannot see it.
//
// PRIOR ART, AND WHY IT WAS NOT ENOUGH. The parent already reads these
// instruments — `main:app/audio/live.js:187-212` polls runwaySec/underruns/
// rms/decode every 500 ms and logs a `snap …` line. But it is behind
// `?wavDebug`, it prints a JSON blob, and it never came across to nukernel. A
// diagnostic you have to know the query string for is a diagnostic that is off
// on the day it matters, so this one is always on and says an English sentence.
//
// EVERY FIELD IS GUARDED AND EVERY ROUTE ANSWERS. The wav-first route stubs
// most of these (engine/faust/live/live.js:3574-3576 returns null for
// clickMon/workletTruth/sentinel), so `g` swallows a missing method, a throw
// and a null alike and hands back the default. A readout that can crash is a
// readout nobody leaves on, and this one is read once a second forever.
export function health() {
  const g = (f, d) => {
    try { const v = handle && handle[f] && handle[f](); return v == null ? d : v; }
    catch (e) { return d; }
  };
  const sh = g("underrunShape", null) ||
    { episodes: 0, quanta: 0, maxRun: 0, totalMs: 0, worstMs: 0, lastAt: 0 };
  const cm = g("clickMon", null);
  return {
    route: st.route || "",
    isolated: typeof self !== "undefined" && !!self.crossOriginIsolated,
    // "ring" is nukernel's word; the engine calls its own desktop graph
    // "direct" (live.js:2247's handle.outputRoute), which is why
    // `st.route || "ring"` at the open never fires and the route string alone
    // reads as an unfamiliar noun. What matters to the ear is which of the two
    // engines is playing, so ask THAT: a route the media matcher claims is the
    // <audio> element, anything else is the ring.
    ring: !!st.route && !onMedia(),
    runwaySec: +(+g("runwaySec", 0)).toFixed(2),
    keepUp: +(+g("loadRatio", 0)).toFixed(3),
    starve: { episodes: sh.episodes | 0, quanta: sh.quanta | 0,
              maxRun: sh.maxRun | 0,
              worstMs: +sh.worstMs || 0, totalMs: +sh.totalMs || 0,
              // lastAt is an output-FRAME number (a 30,507,136 in the 2026-08-24
              // capture); seconds is the only form a person can place against
              // "it crackled about eleven minutes in".
              lastAtSec: +((sh.lastAt || 0) / 44100).toFixed(1) },
    producer: g("__producer", null),          // { mean, peak, worst[] } or null
    ringDeficit: g("ringDeficit", 0) | 0,
    clicks: cm ? cm.clicks : null,
    // WHETHER THE DETECTOR IS EVEN LOOKING. `rms` is a bargraph of the signal
    // the DSP itself sees, so 0 means the readback is dead, not that the music
    // is quiet, and `clicks: 0` off a dead readback is a gate reading a
    // disconnected wire. REVERSED FROM THE DESIGN NOTE, which measured rms 0
    // through every sample of two soaks and called the detector blind: on an
    // UNINSTRUMENTED page it reads 0.08-0.27 and clicks 0 (soak of 2026-08-24,
    // 18 samples, `--load 2`). The zero was almost certainly the probe's own
    // doing — it replaced window.AudioWorkletNode with a plain function, which
    // is the class faustwasm's generated node extends. The detector is alive;
    // F6 in the engine is the alarm for the day it is not.
    clickMonAlive: !!(cm && cm.rms > 0),
    anomalies: (g("auditStats", { anomalies: 0 }).anomalies) | 0,
    errors: handle ? (handle.errors || []).slice(0, 4) : [],
  };
}

// THE SENTENCE ITSELF LIVES HERE, not in the view. The design note wrote this
// template inline in ui/eight.js; it is here instead because the wording is a
// claim about the ENGINE, a gate must be able to read it before any view is
// wired, and eight.js is an integration file that a dozen slices queue behind.
// The view's whole job becomes: $("engine").textContent = engineLine().
//
// ...AND WHETHER THIS RECORD CAN LEAVE THE PLATFORM (Paul, 2026-08-27, from a
// train). The hold's clause rides the same sentence rather than a second line:
// "stream · runway 8.0s · no dropouts · held — plays offline" is one claim
// about the engine, made in one place, and a hand reading it before a tunnel is
// reading the same words a hand reads during one. When the engine has nothing
// to say yet, the hold's clause is the whole sentence.
export function engineLine() {
  const s = engineWords(), h = holdLine();
  return h ? (s ? s + " · " + h : h) : s;
}
function engineWords() {
  // THE THREE STATES BEFORE THERE IS A ROUTE come from `routeNote()`, which
  // used to live above this and which NOTHING IMPORTED — a whole second
  // sentence about the engine, written and never read (the design note found
  // it: "routeNote() — which would have said 'media mse-opus' — is not
  // imported by ui/eight.js at all"). Two functions answering "what is the
  // engine doing" is how the two answers come to disagree, so there is one
  // now, and it keeps routeNote's words for the states it alone covered: a
  // page that goes silent the moment the engine is capped is the F2 complaint
  // all over again.
  if (st.capped) return "capped: " + st.capped.why;
  if (st.state === "starting") return "starting…";
  if (st.state === "failed") return "no engine";
  const H = health();
  if (!H.route) return "";
  if (!H.ring) {
    return "media (" + H.route + ")" + (H.isolated ? "" :
      " — this page is not cross-origin isolated, so the streaming engine could"
      + " not start. Serve it with COOP/COEP (serve.sh).");
  }
  const s = H.starve;
  return "stream · runway " + H.runwaySec.toFixed(1) + "s"
    + (s.episodes
        ? " · " + s.episodes + " dropout" + (s.episodes > 1 ? "s" : "")
          + ", worst " + Math.round(s.worstMs) + " ms, last at "
          + Math.round(s.lastAtSec / 60) + " min"
        : " · no dropouts");
}

/* ---------- the OS-facing identity ---------- */
// WHAT THE LOCK SCREEN SAYS is the app's to say and the engine's to set — the
// parent takes it as a callback (live.js setMediaMeta) precisely so a host does
// not have to fight a 1 Hz re-assert. nukernel's whole audio/survival.js (296
// lines of resume hooks, revive-on-gesture, playbackState and positionState)
// existed because the page had no engine that did any of that; the parent has
// done all of it since WAV-FIRST, so what is left of that file is these four
// lines and the action handlers below.
const mediaMeta = () => {
  const names = [...new Set(SONG.flatMap(b =>
    stackOf(b).map(e => GENRES[e.g] && GENRES[e.g].label).filter(Boolean)))];
  return { title: names.length ? names.join(" + ") : "song boxes",
           artist: "stellate nukernel", album: "song boxes" };
};
if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
  const set = (n, fn) => { try { navigator.mediaSession.setActionHandler(n, fn); } catch (e) {} };
  set("play", () => { if (!playing) startAt(0); });
  set("pause", () => stop());
  set("stop", () => stop());
  on("transport:state", (d) => {
    try { navigator.mediaSession.playbackState = d.playing ? "playing" : "paused"; } catch (e) {}
  });
}

/* ---------- start / stop ---------- */
// The parent's scripts arrive here, by dynamic import, in its own order. A guard
// skips anything the page already defined (kernel-daw.html carries three of
// them) so nothing is re-executed under the app's feet.
const need = async (g, url) => { if (!window[g]) await import(url); return window[g]; };
async function loadEngine() {
  deps = await warmEngine();
  await need("FoundPlayer", FAUSTDIR + "voices/found-player.js");
  await need("FaustSampler", FAUSTDIR + "voices/sampler.js");
  await need("FaustLive", FAUSTDIR + "live/live.js");
  return window.FaustLive;
}

// THE GESTURE HOOKS. Some machinery is only ALLOWED to exist inside a user
// gesture — the parent's media element must be created and unlocked there or iOS
// refuses every later play(). exploreLive does that itself; what registers here
// is anything the page wants to do in the same call stack.
const gestureFns = [];
export const onGesture = fn => gestureFns.push(fn);

// THE IN-GESTURE UNLOCK. iOS grants media playback to a page whose user
// gesture successfully started an <audio>; the parent's own element is born
// several awaits after the tap (engine fetch, font, compile), which on a cold
// boot outlives the transient activation and gets its play() refused — the
// stripe moves, no sound. So the tap's SYNCHRONOUS frame plays a one-sample
// silent wav first: cheap, kept on a module ref, and it makes the page one
// that has played media before the parent's element ever asks.
let unlockEl = null;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
function gestureUnlock() {
  try {
    if (typeof document === "undefined" || typeof Audio === "undefined") return;
    if (!unlockEl) { unlockEl = new Audio(SILENT_WAV); unlockEl.setAttribute("playsinline", ""); }
    const pr = unlockEl.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (e) { /* the parent's own revival is the second net */ }
}

// THE IDLE WARM-UP: fetch the engine and the font before anyone presses play,
// so the tap's awaits resolve in microtasks and the parent's media element is
// created while the gesture's transient activation is still live. Fired by
// ui/main.js after boot; costless on repeat (loadEngine memoises).
export function warmup() {
  const kick = () => { loadEngine().then((FL) => setFont(FONT, deps.K)).then(armPrerender).catch(() => {}); };
  try { (typeof requestIdleCallback === "function" ? requestIdleCallback(kick, { timeout: 4000 }) : setTimeout(kick, 1500)); }
  catch (e) { setTimeout(kick, 1500); }
}

/* ---------- THE IDLE PRE-RENDER (PHASE 0 — THE TAPE, 2026-08-27) ---------- */
// Measured on the deployed page before this change: press play → engine RMS > 0
// at 7,075 ms, and nearly all of it was work a gesture never needed to own —
// compile, worker boot, sample decode, and an 8 s prefill render. So the whole
// open now happens ONCE at page idle with the parent's reader frozen
// (exploreLive opts.hold); the play gesture only adopts the held handle and
// calls release(), which is ctx.resume() plus one Atomics store.
//
// The laws it keeps:
//   · [data-live] / no UI writes at idle — the held engine's status line is
//     swallowed until the handle is adopted by a real gesture (`statusOn`).
//   · battery sanity — ONE pre-render, at page idle only; the pump's own
//     backpressure stops the render at the prefill depth, and nothing re-arms
//     on a timer. An edit INVALIDATES the hold (below) and does not re-arm:
//     the next play simply takes the ordinary gesture path.
//   · one owner per fact — staleness is defined by exactly the events the
//     playing engine itself treats as "the document changed" (the changed-law
//     block at the foot of this file) plus "song"; there is no second
//     signature or shadow copy of the document here.
//   · the media-element law — a phone's output element must be born inside a
//     user gesture (the parent's canMediaEl), so the hold is desktop-only;
//     mobile keeps the gesture path and spends no battery rendering at idle.
let pre = null;      // { handle, barBase, statusOn } — held engine: ring full, reader frozen
let preGen = 0;      // bumped by every invalidation/adoption; an in-flight open checks it
function discardPre() {
  preGen++;
  if (!pre) return;
  const h = pre.handle; pre = null;
  try { h.stop(); } catch (e) {}
}
function armPrerender() {
  const kick = () => { prerender().catch(() => {}); };
  try { (typeof requestIdleCallback === "function" ? requestIdleCallback(kick, { timeout: 6000 }) : setTimeout(kick, 2500)); }
  catch (e) { setTimeout(kick, 2500); }
}
async function prerender() {
  if (pre || playing || st.state === "starting") return;
  // the parent's own mobile/Safari sniff (live.js canMediaEl): those routes need
  // an in-gesture media element, so they never pre-render
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const mobileish = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || "")) ||
    (/^((?!chrome|crios|chromium|android|fxios|edg).)*safari/i.test(ua) &&
      /Apple/.test((typeof navigator !== "undefined" && navigator.vendor) || ""));
  if (mobileish) return;
  const gen = preGen;
  try {
    const FL = await loadEngine();
    await setFont(FONT, deps.K);
    if (gen !== preGen || playing || st.state === "starting") return;
    compile();
    if (!barCount()) return;
    const at = firstBarOfBox(0);
    barBase = at < 0 ? 0 : at;
    FL.deepRunway = true;
    const statusOn = { on: false };   // flipped by adoption; until then the engine is mute to the page
    const h = await FL.exploreLive(getState,
      (m) => { if (statusOn.on) emit("status", { text: m }); }, {
      prefillSec: 8, hold: true,
      events, barBeats, onBar,
      warmSrcs: () => warmSources(),
      onLoad: (r) => { loadRatio = r; },
      masterVol: vol / 100,
      mediaMeta,
    });
    // an edit or a play raced the open: this hold is stale the moment it exists
    if (gen !== preGen || playing || st.state === "starting") { try { h.stop(); } catch (e) {} return; }
    pre = { handle: h, barBase, statusOn };
  } catch (e) { /* a failed idle warm is silence, not an error — the gesture keeps its own bounded open */ }
}

export async function startAt(boxIndex) {
  gestureUnlock();
  for (const fn of gestureFns) { try { fn(); } catch (e) {} }
  if (playing) { setPendingStart(boxIndex); return; }
  // ...AND A SECOND PRESS WHILE THE FIRST IS STILL OPENING IS NOT A SECOND
  // ENGINE. `playing` only goes true after the compile, so two quick taps used to
  // race two exploreLive calls into the same page — two rings, two contexts, and
  // a `tries` count that walked straight past its own ceiling. The opening press
  // owns the gesture; the second one queues a jump like any other.
  if (st.state === "starting") { setPendingStart(boxIndex); return; }
  st.state = "starting"; st.capped = null; st.lastError = null;
  st.startedAt = Date.now();
  emit("status", { text: "starting the engine…" });

  // ── ADOPT THE IDLE PRE-RENDER, if one is fresh and starts where this press
  // does. The document has not changed since it was held (any edit calls
  // discardPre below), so compile/setFont are already done and the ring already
  // holds the prefill: the gesture's entire cost is release(). A hold for a
  // DIFFERENT start bar is honestly wrong audio and is discarded instead.
  if (pre) {
    compile();   // idempotent on an unchanged document; keeps barCount/firstBarOfBox honest
    const at0 = firstBarOfBox(boxIndex);
    const wantBase = at0 < 0 ? 0 : at0;
    if (pre.handle && wantBase === pre.barBase) {
      const h = pre.handle, statusOn = pre.statusOn;
      pre = null; preGen++;
      barBase = wantBase;
      handle = h;
      st.tries = 1;
      st.route = h.outputRoute || "ring";
      playing = true; playingSec = -1; lastBar = -1;
      emit("transport:state", { playing });
      startPosFeed();
      clearTimeout(deadlineTimer);
      deadlineTimer = setTimeout(() => {
        if (st.state !== "starting") return;
        settle(null, "the engine made no sound within " + Math.round(DEADLINE_MS / 1000) + "s",
               { gotSec: 0 });
        emit("status", { text: "the engine did not start in time — " + st.capped.why, sticky: true });
      }, DEADLINE_MS);
      statusOn.on = true;              // the engine is live now — it may talk to the page
      try { h.setMasterVol(vol / 100); } catch (e) {}   // the fader may have moved while held
      h.release();
      return;
    }
    discardPre();                      // wrong start bar: the hold is honest silence, not a jump
  }
  preGen++;                            // a fresh gesture open owns the engine; kill any in-flight hold
  const FL = await loadEngine();
  // the chosen soundfont has to be REGISTERED AND ACTIVE on the kernel before the
  // first compile resolves an instrument through it — a font that is merely
  // fetched is a font the translation never sees
  await setFont(FONT, deps.K);
  compile();
  if (!barCount()) {
    st.state = "idle";
    emit("status", { text: "nothing to play — click a genre to fill a box first", sticky: true });
    return;
  }
  const at = firstBarOfBox(boxIndex);
  barBase = at < 0 ? 0 : at;
  playing = true; playingSec = -1; lastBar = -1;
  emit("transport:state", { playing });
  startPosFeed();

  // the deadline is armed BEFORE the engine is asked for anything, because the
  // failure it bounds is "the ask never returns"
  clearTimeout(deadlineTimer);
  deadlineTimer = setTimeout(() => {
    if (st.state !== "starting") return;
    settle(null, "the engine made no sound within " + Math.round(DEADLINE_MS / 1000) + "s",
           { gotSec: 0 });
    emit("status", { text: "the engine did not start in time — " + st.capped.why, sticky: true });
  }, DEADLINE_MS);

  await open(FL, false);
}

async function open(FL, forceMedia) {
  st.tries++;
  // A SONG BOX BUYS RUNWAY WITH LATENCY, AND IT SHOULD. The parent keeps 3 s
  // ahead of the ear (engine/faust/live/live.js TARGET_SEC) because the
  // explorer is a STEERING instrument — you are dragging through genre space
  // and a deep buffer is a stiff wheel. This is not one. The one control that
  // must be instant is the fader, and it rides the engine's master gain
  // outside the ring (live.js:2068); a desk move already lands on the next bar
  // the walk asks for, which is seconds anyway.
  //
  // MEASURED, 2026-08-24, on a contended four-core box: one 583 ms hole at
  // 10 min 51 s and one 447 ms hole at 7 min 53 s with the 3 s target — and
  // the engine's OWN response to both was to go to 8 s (its sticky
  // C_UNDER_EPI branch, live.js:1392-1394) and never starve again. The
  // response works; it is armed exactly one audible defect too late.
  // `deepRunway` is the parent's own hint for this trade (it feeds
  // targetFrames() beside the hidden-tab case), so ask for the 8 s BEFORE the
  // hole instead of after it.
  //
  // THE COST, STATED: anything fed through the walk — a genre change, a tempo
  // edit, a section rewrite — is heard up to ~5 s later than it was. That is a
  // taste call and Paul is the judge of it. If the lag is wrong the retreat is
  // 5 s, NOT 3 s: 3 s is the number that dropped the audio twice today.
  FL.deepRunway = true;
  // ── AND THE RING STARTS EMPTY, WHICH deepRunway CANNOT FIX ────────────────
  // The line above buys a DEEP runway and the box still dropped audio — 2 to 5
  // holes, worst 961 ms, ALL of them inside the first 8 to 31 seconds of a
  // playthrough and none in the eleven minutes after (STATE.md item 16; the
  // 12-minute soak of 2026-08-24). A target is a depth the ring is filled
  // TOWARD; at t=0 the ring is empty and the reader is released the moment the
  // FIRST chord bar lands, so for the first twenty seconds the producer — which
  // measures 1.04x budget while the worklet instantiates, the samples decode
  // and the first bars compile — renders each bar a fraction slower than the ear
  // eats the last one. The ring can never get more than one bar ahead, and every
  // bar's shortfall is a hole.
  //
  // So ask the engine to FILL BEFORE IT PLAYS: hold the reader silent until the
  // ring holds the same 8 s the pump is aiming at (engine/faust/live/live.js
  // "THE PREFILL"). A song box is the right place to spend this — you pressed
  // play on a record, you are not dragging a fader through genre space — which
  // is the same argument the paragraph above makes for the deep runway itself.
  //
  // THE COST, STATED, BECAUSE IT IS THE PART PAUL FEELS: the page is silent for
  // TWO AND A THIRD SECONDS LONGER after the tap. That is an A/B, not an
  // estimate — the same gate, the same box, the same two busy cores, `prefillSec`
  // 0 then 8, one minute each: first heard sample at **7.50 s** with 1 dropout
  // of 853 ms at t=4.1, and at **9.78 s** with ZERO dropouts. The wait itself
  // measured 3.48 s (handle.__prefill()), and it is cheaper than the 8 s of
  // audio it buys because the producer is not competing with the ear yet.
  //
  // AND IT IS NOT PAID TWICE: those bars are what warm the producer up, so it
  // crosses into the run already at 0.88x budget instead of 1.04x, and the
  // steady-state trough of the runway sawtooth rose with it — 1.4-2.7 s without
  // the prefill, 3.2-4.8 s with it, over the same minute. The engine says
  // "filling the buffer… n/8s" while it waits and the soak gate prints "first
  // note at …s", so the trade can be re-judged rather than remembered. If 2.3 s
  // is too long the retreat is a SMALLER prefill, not none: 5 s still covers the
  // measured startup deficit (one 3.1 s bar plus ~0.6 s of producer shortfall)
  // with about a second to spare.
  try {
    handle = await FL.exploreLive(getState, (m) => emit("status", { text: m }), {
      // the prefill is an OPT-IN on the engine: a caller that says nothing gets
      // the old start-on-primed, so the explorer next door is untouched by this.
      prefillSec: 8,
      events, barBeats, onBar,
      // the caller's own warm set (plan.js warmSources): the stream routes
      // bake bars against the buffers held at bake time, so the zones this
      // cast plays must be named BEFORE the open — the parent cannot derive
      // them from a state it did not compose
      warmSrcs: () => warmSources(),
      onLoad: (r) => { loadRatio = r; },
      masterVol: vol / 100,
      mediaMeta,
      ...(forceMedia ? { wavOut: true } : {}),
    });
    st.route = handle.outputRoute || (forceMedia ? "media" : "ring");
  } catch (e) {
    st.lastError = String((e && e.message) || e).slice(0, 160);
    handle = null;
    // THE CEILING. One demotion — to the parent's own media route, which needs
    // no SharedArrayBuffer and no worklet in an offline context — and then the
    // give-up is written down. It is never tried a third time and never retried
    // on a timer: an unbounded retry is what turned a WebKit quirk into a dead
    // tab, and a loop nobody can see is worse than a silence somebody can read.
    if (st.tries < MAX_TRIES && !forceMedia) {
      emit("status", { text: "the streaming route would not open — trying the media route" });
      return open(FL, true);
    }
    settle(null, "the engine would not open: " + st.lastError, { gotSec: 0 });
    playing = false;
    stopPosFeed();                 // no engine, no clock — the ticker goes too
    emit("transport:state", { playing });
    emit("status", { text: "no engine — " + st.lastError, sticky: true });
  }
}

export function stop() {
  playing = false; playingSec = -1; setPendingStart(null);
  stopPosFeed();
  clearTimeout(deadlineTimer); deadlineTimer = null;
  if (handle) { try { handle.stop(); } catch (e) {} handle = null; }
  st.state = "idle"; st.stage = ""; st.tries = 0;
  emit("transport:state", { playing });
}

export function resetBar() { barBase = 0; }
// THE FADER RIDES THE ENGINE'S OWN MASTER. It used to ride a gain node this page
// built, which meant it existed only while that graph did; the parent's handle
// takes the same number and smooths it on the audio thread. Subscribed rather
// than exported-and-forgotten: "transport" is what every volume writer commits
// (ui/chrome.js's slider), and a slider that only writes
// localStorage is a slider that does nothing until the next play.
on("transport", () => { try { if (handle) handle.setMasterVol(vol / 100); } catch (e) {} });

/* ---------- what the UI is allowed to know ---------- */
const nowSec = () => { try { return handle && handle.ctx ? handle.ctx.currentTime : 0; } catch (e) { return 0; } };
export const getPosition = () => ({
  playing, si: playingSec, passStart, now: nowSec(), stepDur: stepDur(),
  loopStart, durSec: songDurSec(),
});
// WHERE THE EAR IS IN THE SOUNDING BOX — the fraction through it and the bar it
// is in, measured off the bar list's OWN durations. Under the tempo map every bar
// of a box is a different length, so `sec.len × 16 / rate × stepDur` is a lie
// worth up to a beat by the end of an outro.
export function passAt(now) {
  const TL = timeline();
  if (!TL.length) return { f: 0, bar: 1, bars: 1 };
  const sd = stepDur(), b0 = TL[passBar] || TL[0];
  const bars = b0.boxBars || 1, tot = (b0.boxSteps || b0.barSteps) * sd;
  const e = Math.max(0, now - passStart);
  let acc = 0, i = 0;
  for (; i < bars - 1; i++) {
    const d = (TL[(passBar + i) % TL.length] || b0).barSteps * sd;
    if (acc + d > e) break;
    acc += d;
  }
  return { f: tot > 0 ? Math.max(0, Math.min(1, e / tot)) : 0, bar: i + 1, bars };
}

/* ---------- the position feed ---------- */
// A BEAT COUNTER OFF THE ENGINE'S OWN CLOCK. onBar hands us each downbeat's
// exact `when`; the beat within the bar is arithmetic on it, because spb is
// constant for the whole record (the rubato lives in fractional barBeats, not
// in the second-per-beat). One setInterval rather than rAF, on purpose: the
// counter must keep ticking in a hidden tab, where rAF stops but the parent's
// clock — and a phone in a pocket — do not. 60 ms is well under a beat (536 ms
// at 112 bpm) and it emits only when the number changes, so subscribers redraw
// per beat, not per tick.
function tickPos() {
  if (!curBar) return;
  const beats = Math.max(1, Math.ceil(curBar.beats));
  const beat = 1 + Math.min(beats - 1,
    Math.max(0, Math.floor((nowSec() - curBar.when) / curBar.spb)));
  if (!lastPos || lastPos.bar !== curBar.n || lastPos.beat !== beat) {
    lastPos = { bar: curBar.n, beat };
    emit("pos", { bar: curBar.n, beat, beats: curBar.beats, bpm,
                  si: playingSec, serial: curBar.serial });
  }
  // ...and the countdowns ride the same tick: beats left = the rest of this
  // bar plus every whole bar between here and the landing. (The in-flight
  // bars were fed at the OLD lengths, so after a tempo edit the sum can be
  // off by fractions of a beat — the onBar landing clamp is the truth.)
  for (const p of pendings.values()) {
    let left = Math.max(0, curBar.beats - (nowSec() - curBar.when) / curBar.spb);
    for (let s = curBar.serial + 1; s < p.landsSerial; s++)
      left += barBeatsAt(barOfSerial(s));
    const whole = Math.max(1, Math.ceil(left));   // 0 is the landing's to say
    // A COUNTDOWN NEVER TICKS UP BY ONE. Bar anchors ride the engine's own
    // clock, so a downbeat can land a hair later than the last bar's
    // arithmetic promised and the ceil wobbles 12 -> 13 -> 12 at the bar
    // line. Hold the shown number through a one-beat blip; a real stall
    // (two beats or more — the ring starving under load) re-syncs honestly,
    // because a countdown that lies for minutes is worse than one that
    // jumps up once.
    if (p.lastLeft != null && whole === p.lastLeft + 1) continue;
    if (p.lastLeft !== whole) {
      p.lastLeft = whole;
      emit("pending", { label: p.label, beatsLeft: whole,
                        who: p.who, role: p.role, si: p.si, round: p.round,
                        landsBar: p.landsBar, landsSerial: p.landsSerial });
    }
  }
}
function startPosFeed() {
  stopPosFeed();
  posTimer = setInterval(tickPos, 60);
}
function stopPosFeed() {
  clearInterval(posTimer); posTimer = null;
  curBar = null; lastPos = null; lastAsked = -1;
  pendings.clear();
}

/* ---------- the pending-change feed ---------- */
// WHERE AN EDIT ACTUALLY LANDS. The walk runs a runway ahead of the ear, and
// every serial it has already asked events() for is baked with the old score
// — so a change committed now first sounds at `lastAsked + 1` (the serial
// rule; events() records the ask for exactly this measurement). A
// section-scoped answer can only be HEARD when that section next comes round,
// so its landing advances to the first future serial whose bar belongs to the
// box. The UI calls this right after push(); everything after that is the
// ticker's countdown and the onBar clamp — including the crossfade path,
// where the parent prunes bars and the change arrives early.
export function announceChange(label, si, info) {
  if (!playing || !label) return;
  const n = barCount();
  if (!n) return;
  let lands = Math.max(lastAsked + 1, curBar ? curBar.serial + 1 : 0);
  // DOES THE EAR WAIT FOR THE BOX TO COME ROUND? If the first unbaked serial
  // is already inside the target box, the change lands THIS pass (imminent);
  // if the scan had to advance past it, the landing is the section's next
  // occurrence — which is the fact the page's phrasing hangs the big number
  // on ("when the drop comes round — 21"). `round` says which.
  let round = false;
  if (si != null) {
    const TL = timeline();
    for (let k = 0; k < n; k++)
      if (TL[barOfSerial(lands + k)] && TL[barOfSerial(lands + k)].si === si) {
        lands += k; round = k > 0; break;
      }
  }
  pendings.set(label, { label, landsSerial: lands,
                        landsBar: barOfSerial(lands), lastLeft: null,
                        // the words the page phrases the countdown with —
                        // carried beside the old fields, never instead of them
                        who: (info && info.who) || label,
                        role: (info && info.role) || null,
                        si: si != null ? si : null, round });
  tickPos();                       // say it now, not a tick later
}

/* ---------- the "something changed" law ---------- */
// A musical change recompiles the score; the parent picks the new bars up on the
// next walk step, because `events` reads the compiled result rather than a copy
// of it. There is nothing to rebuild, re-arm or re-fetch — which is the whole
// difference between one engine and two.
// …and while STOPPED, the same events are the one definition of "the document
// changed", so they are exactly where the idle pre-render is invalidated: a
// held ring baked from the old score must never play under the new one
// (PHASE 0 — THE TAPE; no re-arm here, on purpose — the next play just takes
// the ordinary gesture path).
const changed = () => { if (playing) compile(); else discardPre(); };
on("phrase", changed);
on("box", changed);
on("groove", changed);            // the groove is baked into the events
on("swing", changed);             // ...and so is the swing
on("pool", changed);              // the band changed: register homes and zones with it
on("mix", changed);               // a board offset moved: next bar carries it
on("song", () => { if (playing) stop(); else discardPre(); });

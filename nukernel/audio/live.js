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
         stepDur, songDurSec, warmEngine, firstBarOfBox, addrOf,
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
/* THE SERIAL THE RECORD COMES ROUND ON — THE END-OF-RECORD SEAM (2026-08-30).
   Paul: *"There are three play modes possible—loop, once, and album which
   keeps making new songs."*

   THIS FILE ANNOUNCES A FACT AND MAKES NO POLICY. Nothing in here knows what
   `loop`, `once` or `album` mean: the walk wraps for ever (`barOfSerial` is a
   modulo and always has been, which is why LOOP is what the box already did),
   and the one thing the transport can honestly say is WHEN THE RECORD CAME
   ROUND. `emit("transport:round")` says it; ui/eight.js — which owns the
   transport's buttons and its views — is what stops on `once` and rewrites on
   `album`. A mode enum in here would be a second owner of a control this file
   cannot draw.

   THE DETECTOR IS THE PENDINGS' OWN, WORD FOR WORD: "the honest detector on
   every route is the first heard bar at or past the landing". A count of
   `onBar` calls would drift the first time the media route's poll missed one;
   a serial is the parent's own monotonic number for a baked bar, so `>=` a
   target serial is right on the ring route and on the media routes alike.
   `null` until the first bar of a start is heard — that bar is where the
   record's own clock begins, whichever box `startAt` was given. */
let roundAt = null;                // serial at which the record next comes round
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
/* THE KIT THE ENGINE WAS HANDED, DRUM BY DRUM (2026-09-03).
   `__nuMix` counts hits and `__nuBounce` counts refusals; neither can say WHICH
   drum sounded, and the drum editor's lane offer is a claim that needs exactly
   that — a lane a hand adds on the page has to turn up in the parent's own
   event list or it is this repo's characteristic bug (a lane declared, drawn,
   costed and never arriving). The lane LETTER is already gone by here on
   purpose: audio/to-engine.js resolves twelve lanes onto nine parent units, so
   what identifies a drum at this depth is the unit plus the two flags and the
   pitch that separate the three hats and the three toms. That is what this
   hands out, per bar, off the same `barPlan` every other probe in this family
   reads — the artifact, not a copy of the arithmetic. */
W.__nuHits = (bar) => {
  const p = barPlan(bar == null ? Math.max(0, lastBar) : bar);
  if (!p) return null;
  return p.ev.drums.map((d) => ({ drum: d.drum, amp: +(d.amp || 0).toFixed(4),
    beat: +(d.beat || 0).toFixed(4),
    ...(d.open != null ? { open: !!d.open } : {}),
    ...(d.pedal ? { pedal: 1 } : {}),
    ...(d.pitch ? { pitch: Math.round(d.pitch) } : {}) }));
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
// WHO IS SOUNDING AND HOW LOUD, for the gate — the same two readers the views
// use, hung on the window in the __nu* family so test/meter-reach.browser.js
// can read the ARTIFACT rather than a copy of the arithmetic. (Defined here,
// beside the other probes, rather than at the readers below, so the whole
// reportable surface of this module is in one place.)
W.__nuSounding = () => soundingChans();
W.__nuVoiceLevels = () => voiceLevels();
/* HOW LONG EACH BAR IS, IN SECONDS, OFF THE PLAN (2026-09-02, slice 2a).
   Paul, B7: *"The tempo editor does not reflect the richness of our tempo
   options."* The richest of them is the per-section PACE, and until today
   there was no way to read what it did without rendering audio — which this
   box's own law forbids a gate from doing unless the render is the subject.
   `compile()` is the plan's one entry and it is pure over the adopted song, so
   this asks for the timeline the transport would play and reports the two
   numbers a pace moves: which section each bar belongs to, and how many
   seconds it takes. `paceTL` has already multiplied `barSteps` by 1/rate by
   the time `timeline()` answers, so a `push` section's bars really are shorter
   here — at the plan, before a sample is asked for.
   IT IS SAFE TO CALL WHILE PLAYING: `compile()` is idempotent on an unchanged
   document (see its second caller below, which says so) and writes only this
   module's own tables. */
W.__nuBarSecs = () => { compile(); const d = stepDur();
  return timeline().map((b) => ({ si: b.si, sec: b.barSteps * d })); };

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
  /* ...AND THE RECORD CAME ROUND, IF IT DID (2026-08-30 — see `roundAt`). This
     is the whole of the end-of-record seam: the bar now beginning is the first
     bar of another pass, so what a listener is told is that the pass that just
     finished is over. `once` stops here, `album` writes the next record here,
     `loop` does nothing and is what happens if nobody is listening — which is
     what makes this an addition to the transport rather than a change to it.
     ONE BAR OF THE REPEAT IS ALREADY SOUNDING when this fires, and that is
     stated rather than smoothed: `onBar` fires at the bar's own instant (the
     parent's read-cursor→ctx-clock scheduler, engine/faust/live/live.js), the
     engine bakes one continuous ring, and there is no way to ask it to end at
     a bar line it has already passed the runway for. So `once` is heard as
     "the record, and then the seam", not as a fade. */
  if (barCount() > 0) {
    if (roundAt == null) roundAt = info.serial + barCount();
    else if (info.serial >= roundAt) {
      roundAt = info.serial + barCount();
      emit("transport:round", { bar: n, serial: info.serial, when: info.when });
    }
  }
  /* A QUEUED JUMP LANDS ON THE NEXT BAR LINE.
     ---- REVERSED IN PLACE, 2026-09-02 ------------------------------------
     WHAT STOOD HERE, and it was the second half of the "100 beats" bug:
     *"A QUEUED JUMP LANDS ON A BAR LINE. The parent schedules a runway ahead,
     so the jump takes effect as soon as the walk reaches it rather than on the
     very next bar the ear hears — which is the honest cost of one engine with
     a runway, and it is bars, not seconds."* Every word of that is true and
     the CODE under it said something else: the branch was gated on
     `bar.first`, so a jump did not land on the next bar line at all, it waited
     for the next BOX — up to a whole section of somebody else's music.
     Paul, on the deployed composer: *"When I change a setting it's often
     telling me I'm 100 beats out from a change."*
     So the gate comes off. `barBase` is re-based on WHATEVER bar is beginning,
     the walk's very next serial is the target box's first bar, and the wait is
     the runway — which is the honest cost of one engine with a runway, and it
     is bars, not seconds. MEASURED over the catalogue's own timelines (the
     arithmetic in `announceChange` below): house's MEAN wait went 111 beats
     (54 s) to 12 (5.8 s) and its worst 236 (114 s) to 12; acid's worst 252
     (120 s) to 12 (5.7 s); softfolk's 160 (109 s) to 12 (8.2 s). */
  if (pendingStart != null) {
    const at = firstBarOfBox(pendingStart);
    setPendingStart(null);
    if (at >= 0) barBase = (at - info.serial - 1 + barCount() * 2) % Math.max(1, barCount());
    // ...AND THE SEAM IS RE-ANCHORED WITH THE WALK. A queued jump re-bases the
    // record under the serial, so a `roundAt` measured from the old base names
    // a bar that is no longer the record's last. `null` makes the next heard
    // bar the new beginning, which is the same rule the first bar of a start
    // obeys.
    roundAt = null;
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
// ...AND "the same state the stream was opened with" IS getState(), NOT
// parentState() — FIXED 2026-08-30 (the volume-census round). parentState()
// is the COMPILED base and carries plan.js's deliberate `reverb: 0`; the
// stream is opened over getState(), which spreads masterState(MASTER, BUSES)
// on top, so this readout was blind to the whole rack and the whole master
// strip. desk-gate check 4 measured it and left the recipe: with
// `buses.echo.fb = "more"` (0.62) and `tone = "bright"` (5600) in the
// document, `__nuMix().master.echo` still answered the engine's own defaults
// `{ ret: "1.00", fb: "0.25", tone: 2600 }`, and with `buses.rev.color =
// "plate"` set, `master.rev` was `{}`. The SOUND was right the whole time
// (getState folds the rack in per bar); the REPORT — the board's own model
// line — said the knob you had just turned did not exist, which is the
// "writes the store, moves nothing you can see" bug in readout form.
// test/vol-reach.browser.js V5 now drags `bus|rev|ret` for real and asserts
// this report follows.
export function engineReport() {
  const base = getState();
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
    // THE DEFAULT REVERB IS A STAGE TOO (2026-08-30, the volume-census round).
    // `rc` names only a COLORED room (reverbColor returns null for the
    // default => fx_bus's internal zita, whose return is fxParams `rgain`) —
    // so this field answered `{}` for every record with a hand on the rack's
    // `ret` knob and no hand on `color`, and the knob read as unwired. The
    // zita's own return is printed under its own name; `rgain` 0 prints
    // "0.00", because a return turned OFF is a fact and not an absence.
    rev: rc ? { [rc.module.replace(/^reverb_/, "")]: rc.rgain.toFixed(2) }
            : (fx.rgain != null ? { zita: fx.rgain.toFixed(2) } : {}),
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
    /* WHAT THE ENGINE HAS HAD TO REPAY (2026-09-03). Paul: *"after five minutes
       on safari desktop a little static creeps in … it happens on loop."* The
       measured cause is the reader's output ledger running away from the ring's
       consumed count by exactly the frames a hole swallowed — after which the
       native lane (every sampled voice and the whole kit) is scheduled against a
       cursor that is seconds ahead of the audio, and every bar's notes clump at
       `now` instead of spreading across the bar. `ringDeficit` above is what is
       still owed, and it self-clears now; `healedSec` is the total the engine has
       absorbed since the start, which is the number that says a session HAS been
       drifting even though it currently reads clean. Zero on an engine that has
       never starved. (engine/faust/live/live.js "THE DEFICIT HEALS".) */
    healedSec: (g("__healed", null) || { sec: 0 }).sec,
    heals: (g("__healed", null) || { heals: 0 }).heals,
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
  if (playing) { setPendingStart(boxIndex); announceJump(boxIndex); return; }
  // ...AND A SECOND PRESS WHILE THE FIRST IS STILL OPENING IS NOT A SECOND
  // ENGINE. `playing` only goes true after the compile, so two quick taps used to
  // race two exploreLive calls into the same page — two rings, two contexts, and
  // a `tries` count that walked straight past its own ceiling. The opening press
  // owns the gesture; the second one queues a jump like any other.
  if (st.state === "starting") { setPendingStart(boxIndex); announceJump(boxIndex); return; }
  st.state = "starting"; st.capped = null; st.lastError = null;
  st.startedAt = Date.now();
  // A START BEGINS ITS OWN PASS (2026-08-30). `stop()` clears this too; it is
  // cleared HERE as well because a start is not always preceded by a stop —
  // the engine's own give-up path (`settle(null, …)` below) drops `playing`
  // without going through it, and a stale seam would announce the end of a
  // record that is not the one now playing.
  roundAt = null;
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
  /* ONE LIVE ENGINE, ENFORCED AT THE ONLY LINE THAT CAN BREAK IT (2026-09-01).
     Paul: "Sometimes two streams play at once."

     `handle = await FL.exploreLive(...)` ASSIGNS OVER WHATEVER `handle` HELD,
     and the assignment is the last reference to the old engine — so if one was
     live, it keeps sounding and nothing can ever stop it again. Two paths reach
     here with a live handle:

       · THE DEMOTION. The catch below retries once on the media route
         (`forceMedia`), and it reaches that retry from a THROW — which can be a
         throw AFTER the engine opened its graph (a start deadline, a worklet
         that came up late). The old ring engine is then sounding, `handle` has
         been set to null by the catch, and the media route opens on top of it.
         That is the doubled stream, and the null is what makes it permanent.
       · A stale hold whose `h.stop()` in `discardPre` did not take.

     So the invariant is stated here rather than assumed: whatever is live stops
     before anything new is installed. Idempotent — `stop()` on a dead handle is
     already wrapped everywhere in this file — and a no-op on every start that
     was already correct, which is every start that has ever worked. */
  const takeOver = (why) => {
    if (!handle) return;
    try { handle.stop(); } catch (e) {}
    try { console.warn("live.js: stopped a live engine before " + why +
                       " — one engine at a time"); } catch (e) {}
    handle = null;
  };
  takeOver("opening a new one");
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
    // ...AND A THROW MAY HAVE LEFT AN ENGINE SOUNDING. This read `handle = null`,
    // which drops the only reference to a graph that may already be running —
    // the demotion below then opens a SECOND one beside it. Stop it first; the
    // null is what `takeOver` does last anyway.
    takeOver("giving up on it");
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

/* A STOP IS A FLUSH, AND IT SAYS SO IN FULL (2026-09-03).
   Paul: *"i think when you restart a song you should basically flush everything
   and start again."*

   THE ENGINE HALF WAS ALREADY TRUE AND IS NOW MEASURED. `handle.stop()` tears
   the whole graph down — the pump, the bar scheduler, both stream workers
   terminated, every sampler strip and meter tap, the click monitor's output
   handler (the retaining edge Blink will not collect), the ring reader, and
   `ctx.close()` — so the next `startAt` builds a NEW AudioContext, NEW workers,
   NEW ring SharedArrayBuffers and NEW voice pools. Measured over a 7-minute run
   with a stop/start in the middle (test/loop-flush.browser.js C1/C2): standing
   audio nodes 119 -> 2 while stopped, live rings a flat 20.2 MB across three
   generations (15 allocated, 5 alive), contexts closed n-1 of n, and the restart
   coming back at runway 9.05 s with zero dropouts against a starved 0.0-0.6 s
   before it. So "flush everything and start again" is what the door already
   does, and there is deliberately no second one.

   WHAT DID NOT FLUSH WAS THIS FILE'S OWN REPORT. `st.route`, `st.capped`,
   `st.lastError` and `loadRatio` are the four fields `health()` and
   `engineLine()` answer from, and they survived the stop that made them false —
   so a stopped page went on printing "stream · runway 0.0s · no dropouts" about
   an engine that no longer existed, and a cap from the last attempt outlived the
   attempt. That is the "declared but never arriving" bug in readout form and it
   is the half a person actually sees. They go with the engine.

   `lastState` goes too: it is the last compiled state held ONLY so the parent's
   walk is never handed null mid-recompile, and the next start compiles before it
   opens anything. Holding a stopped record's state across a flush is a copy
   waiting to be stale. */
export function stop() {
  playing = false; playingSec = -1; setPendingStart(null);
  roundAt = null;                  // the next start begins its own pass
  stopPosFeed();
  clearTimeout(deadlineTimer); deadlineTimer = null;
  if (handle) { try { handle.stop(); } catch (e) {} handle = null; }
  st.state = "idle"; st.stage = ""; st.tries = 0;
  st.route = ""; st.capped = null; st.lastError = null;
  loadRatio = 0; lastState = null; lastBar = -1;
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

/* ---------- WHO IS SOUNDING, AND HOW LOUD (2026-09-01) ----------------------
   Paul, of the Mix deck: *"Light up which instrument is playing, make a little
   volume meter INSIDE the heading."* And of the nav: *"I need you to light them
   up when playing them actively."*

   THESE ARE PURE READERS. They subscribe to nothing, install no clock and emit
   nothing — a view calls them from inside the one playhead it already rides
   ("a view never installs its own rAF/clock; it reads the position feed").
   They are HERE and not in a view because both answers are about the engine's
   own sounding bar, and `curBar`, `barBase` and the handle are this file's.

   NEITHER OF THEM DECIDES ANYTHING. `soundingChans` is the SCHEDULE after the
   desk — barPlan has already dropped every event whose automation or mute
   gain is 0 (plan.js: "so 'has an event in this bar' already means 'will be
   heard'") — so it is a playhead, `--clock`, never a measurement.
   `voiceLevels` is the MEASUREMENT and nothing else: a chair with no tap and
   no audit is ABSENT from the map rather than reported as 0, because 0 is a
   claim of silence about a voice nobody measured. */

// The sounding bar's plan, so a reader never has to recompute `barOfSerial`
// (module-private) or duplicate `barBase`. null while stopped.
export const barPlanNow = () => (curBar ? barPlan(curBar.n) : null);

/* THE SAMPLING GRAIN. A reader looks at this four times a beat (lightStep's
   own cadence). An event shorter than that grain — a 1/32 grace note, a closed
   hat with dur 0.06 — would fall between two looks and light NOTHING, on every
   look, for ever: a lit lamp that can never be seen is the "declared but never
   arriving" bug in its smallest form. So an event is counted as covering the
   grain it starts in. This is a fact about the SAMPLING, not a claim about
   decay: nothing here says a hat rings for a sixteenth. */
const GRAIN = 0.25;                // beats — one sixteenth

// where the ear is inside the sounding bar, in that bar's own beats
function barBeatNow() {
  if (!curBar) return -1;
  return Math.max(0, Math.min(curBar.beats, (nowSec() - curBar.when) / curBar.spb));
}

/* WHICH CHAIRS HAVE AN EVENT COVERING THIS INSTANT — chair keys ("lead",
   "schola", "bass", "drums"), the same spelling the board's columns and the
   nav's band rows use, joined through plan.js addrOf. */
export function soundingChans() {
  if (!playing || !curBar) return [];
  const p = barPlan(curBar.n);
  if (!p) return [];
  const A = addrOf(playingSec);
  const t = barBeatNow();
  const out = new Set();
  const covers = (e) => e.beat <= t && t < e.beat + Math.max(+e.dur || 0, GRAIN);
  for (const e of p.ev.pitched) { if (covers(e)) { const c = A[e.voice]; if (c) out.add(c); } }
  for (const e of p.ev.drums) { if (covers(e)) out.add(A.drums || "drums"); }
  return [...out];
}

/* HOW LOUD EACH CHAIR ACTUALLY IS — `{ chairKey: rms }`, measured, in two
   lanes because the engine has two:
     · NATIVE (sampled/found chairs, the default sound): the live per-unit tap
       engine/faust/live/live.js samplerOf builds, read through
       `handle.voiceRms(unit)`. Per frame.
     · STREAM (Faust-modelled chairs): those units are rendered in a worker and
       own no node, so their only honest number is the bar audit's own rms,
       `handle.auditFor(serial).voices[unit].rms` — measured at the instant the
       bar was heard, and therefore PER BAR. A view showing both must say so.
   A chair present in neither is ABSENT from the returned map. Guarded the way
   health()'s `g` is guarded: a handle route that lacks the method, throws, or
   answers null must not take a readout down. */
export function voiceLevels() {
  if (!handle || !curBar) return {};
  const g = (f, a) => {
    try { const v = handle[f] && handle[f](a); return v == null ? null : v; }
    catch (e) { return null; }
  };
  const p = barPlan(curBar.n);
  const units = (p && p.units) || {};
  const A = addrOf(playingSec);
  const audit = g("auditFor", curBar.serial);
  const voices = (audit && audit.voices) || null;
  const out = {};
  for (const [unit, u] of Object.entries(units)) {
    if (!u || unit.slice(0, 2) === "__") continue;
    // THE ADDRESS RULE IS THE DESK'S, read the same way here: audio/desk.js
    // deskUnits — `const chan = addr[key] || (isDrum ? "drums" : "")`. A unit
    // with no seat and no drum flag answers to no channel and is skipped.
    const isDrum = !!u.drum || !!(u.__meta && u.__meta.drum);
    const chan = A[unit] || (isDrum ? "drums" : "");
    if (!chan) continue;
    let r = g("voiceRms", unit);
    if (r == null && voices && voices[unit]) r = voices[unit].rms;
    if (r == null) continue;                    // no tap and no audit = no measurement
    // several units can answer to one chair (a kit's nine lanes are all
    // "drums"; a chair that changes instrument mid-song seats twice) — the
    // channel's level is the loudest thing on it, not their sum, because the
    // sum of two dry taps is not a measurement of anything.
    out[chan] = Math.max(out[chan] || 0, +r || 0);
  }
  return out;
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
// rule; events() records the ask for exactly this measurement). That serial is
// the LANDING: the next bar line the walk has not already baked. The UI calls
// this right after push(); everything after that is the ticker's countdown and
// the onBar clamp — including the crossfade path, where the parent prunes bars
// and the change arrives early.
//
// ---- THE SECTION ADVANCE, REVERSED IN PLACE, 2026-09-02 -------------------
// WHAT STOOD HERE: *"A section-scoped answer can only be HEARD when that
// section next comes round, so its landing advances to the first future serial
// whose bar belongs to the box."* — and the scan under it did exactly that,
// walking the timeline forward to the box's next pass and counting every beat
// of somebody else's music on the way.
//   Paul, on the deployed composer: *"When I change a setting it's often
// telling me I'm 100 beats out from a change."* He was reading this number and
// it was correct and it was useless. MEASURED over the catalogue's own
// timelines, every (sounding bar x edited box) pair: house at 124 bpm and 60
// bars printed a MEAN of 111 beats and a worst of 236 (114 s); acid 116 and
// 252 (120 s); softfolk 78 and 160 (109 s); rock 75 and 152. A hundred beats
// is not a slip in this arithmetic, it is its centre — and the thing being
// waited for, the score the walk plays, is different from the NEXT BAR LINE.
//   THE SENTENCE THAT REPLACES IT. An edit lands when the walk next asks for a
// bar, because that is when the new score is read; whether the EAR notices at
// that bar is a fact about the music and not about the transport, and it is
// not a number to hold a hand still for. `round` stays on the feed — it is
// still true that a box-scoped edit is not audible until the box comes round,
// and the page may still say so in WORDS — but the COUNTDOWN counts to the
// landing, which is the runway. Measured after: 12 beats on every record in
// the catalogue, 5.1 to 8.2 s — the runway said honestly, in bars.
export function announceChange(label, si, info) {
  if (!playing || !label) return;
  const n = barCount();
  if (!n) return;
  const lands = Math.max(lastAsked + 1, curBar ? curBar.serial + 1 : 0);
  // ...and whether the ear has to wait for the box to come round anyway, kept
  // as a WORD and never as the number: true when the landing bar is not in the
  // box the edit was scoped to.
  let round = false;
  if (si != null) {
    const TL = timeline();
    const b = TL[barOfSerial(lands)];
    round = !(b && b.si === si);
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

/* WHEN A JUMP LANDS (2026-09-02, slice 2e). Paul, B11: *"I need to be able to
   jump to a section somehow, by clicking on them when in automation."*

   A QUEUED JUMP HAD NO COUNTDOWN, which made it the quietest gesture on the
   page: `startAt(si)` while playing calls `setPendingStart` and returns, the
   walk is a runway ahead of the ear, and nothing at all happens for up to a
   whole box. That is this repo's characteristic bug wearing a transport — a
   gesture that is costed, queued and correct, and reaches no reader — and it
   was already true of the Structure form's section number before a board
   column ever asked for it, which is why the fix is HERE and not in a view.

   THE ARITHMETIC IS THE LANDING RULE'S OWN.
   ---- REWRITTEN IN PLACE, 2026-09-02 -------------------------------------
   WHAT STOOD HERE: *"An EDIT lands when its section next comes round
   (announceChange walks the timeline to `si`); a JUMP lands on the next
   bar-line of ANY box, because that is literally what `onBar` does with
   `pendingStart` above — 'if (pendingStart != null && bar.first)'. Announcing
   it with the edit rule would have counted a whole record's worth of beats for
   a wait of four. So this walks forward to the next `first` bar and says
   that."* It named the bug and then implemented it: `bar.first` is a BOX's
   first bar, not a bar line, so both halves — the landing and the countdown —
   waited for the next section.
   Paul, on the deployed composer: *"When I change a setting it's often telling
   me I'm 100 beats out from a change."*
   A jump lands on the NEXT BAR LINE, full stop, which is what `onBar` now does
   with `pendingStart`, and this says that number and no other. The same
   `onBar` line that applies the jump is the one that clears the countdown (a
   countdown that landed is over, whatever the arithmetic said).

   ONE LABEL, so a second tap replaces the first rather than stacking: two
   queued jumps are not two waits, they are one wait with a new destination —
   which is exactly what `pendingStart` itself is. */
export function announceJump(si) {
  if (!playing || !curBar) return;
  const n = barCount();
  if (!n) return;
  const lands = Math.max(lastAsked + 1, curBar.serial + 1);
  pendings.set("jump", { label: "jump", landsSerial: lands,
                         landsBar: barOfSerial(lands), lastLeft: null,
                         who: "the jump", role: null, si, round: false });
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

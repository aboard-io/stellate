// nukernel/export/als.js — a nukernel score becomes an Ableton Live set, by
// SPLICING A DONOR the target application itself wrote. Pure functions over
// strings: no I/O, no gzip, no zip, no node builtins, so the P4 browser button
// imports this exact file and only swaps zlib for CompressionStream.
//
// WHY A DONOR AND NOT A SPECIFICATION. `main:docs/ABLETON-EXPORT.md` settled
// this a week before the donor arrived: "An .als is gzipped XML, version-
// stamped, undocumented but stable. We do NOT write it from a spec; we splice
// a DONOR set saved from Paul's own Live 12 … which converts 'reverse engineer
// Ableton' into 'string-surgery on a file Ableton itself wrote.'" Every element
// this file emits therefore has to exist in the donor already, and als-gate.js
// Gate 2 is what enforces that — see the `<Locator>` paragraph there.
//
// THE ONE THING P0 RESTS ON THAT THE DONOR DID NOT GIVE US A TRACK-LEVEL
// EXAMPLE OF. `grep MidiClip` over the donor finds exactly ONE clip and it is
// not on a track: it is the GroovePool's groove template, "Swing 16ths 66"
// (Generic.xml:22544-22675). It is nonetheless a complete, ordinary MidiClip
// written by Live 12.4.3 — CurrentStart/CurrentEnd, Loop, Name, TimeSignature,
// Envelopes, GrooveSettings, FollowAction, Grid, ScaleInformation, and a full
// KeyTracks/MidiNoteEvent block with 16 events on MidiKey 36. So the NOTE
// GRAMMAR is ground truth (pitch on the KeyTrack, time and velocity on the
// event) and it is reused verbatim; what is NOT ground truth is that Live
// accepts a groove-pool clip as a Session or Arrangement clip. That single
// unknown is what Ask #1 closes, and it is why P0 ships one clip and not fifty.
//
// 2026-08-28 — THAT UNKNOWN IS CLOSED, AND THE PARAGRAPH ABOVE IS KEPT AS THE
// HISTORY OF IT. A second donor arrived (`tools/ableton/donor/Ableton2.als`,
// Live 12.4.5, same MinorVersion/SchemaChangeCount stamp as 12.4.3) and it has
// six Session clips ON TRACKS as well as the same GroovePool clip. Diffed
// inside that one file, a Session ClipSlot MidiClip and the GroovePool MidiClip
// are the SAME SHAPE: both open `<MidiClip Id="0" Time="0">`, both have exactly
// 42 direct children, the same tags in the same order, and nothing appears on
// one and not the other in either direction — all seven clips in the file agree.
// A groove-pool clip IS an ordinary Session clip in this schema, so copying one
// onto a track is not a guess any more. Read out of the file, not remembered:
// tools/ableton/donor/README.md carries the 42-tag list and the method. Live
// still has to open the whole set (Gate 4); this particular fear is retired.
//
// STILL OPEN, and narrower than it was: an ARRANGEMENT clip. Ableton2 has 16
// `<ArrangerAutomation>` and every one is `<Events />`, so `CurrentStart` for a
// clip in the arrangement (below, `arrangement ? time : 0`) is still inferred.
// That plus `<Locator>` — zero in both donors — is the whole remaining ask.
//
// VELOCITY, AND THE MIGRATION P3 MUST NOT FORGET. P0 reads plan.timeline(),
// whose events carry the WRITTEN velocity 0..9, so vel is the composer's mark
// and nothing else. P1+ read plan.barPlan(), whose `amp` is
// pitchAmp(vel,acc) x the desk's automation gain (plan.js:520-527,
// to-engine.js:97-99) and is therefore the HEARD loudness with the fader
// already in it. The day P3 writes real volume envelopes, velocity must go back
// to the written value or the fader ride is counted twice; the one-line move is
// exposing the pre-desk bar out of plan.js (`export const rawBar = (n) =>
// BARS[n]`). Written here because a comment in the gate would be read too late.

// 2026-09-03 — P3 LANDED AND THE PARAGRAPH ABOVE IS ITS OWN ANSWER. Paul:
// "the midi shifts aren't showing up in ableton, like the envelope settings
// that would tweak the sound and filters and so forth … it makes the mix so
// unexpressive." The migration this file has warned about since P0 turns out
// to need NO migration: the velocities here are still plan.timeline()'s
// written 0..9 and always were, so the volume envelope nukernel/export/
// live-devices.js now writes is the FIRST desk gain in the file and is not a
// double count. The instrument parameters, the automation envelopes and the
// effect devices all live in that file; this one calls it. The warning above
// is kept because it is what made the check cheap.

// P3's own half is nukernel/export/live-devices.js, imported here and nowhere
// else. The two modules import each other — this one for the balanced-tag
// scanner below, that one for the parameter grammar — which is legal and safe
// in ES modules because every binding either side uses is a HOISTED function
// declaration or is read at call time, never during evaluation. Said out loud
// because a cycle that is fine is still a cycle somebody will worry about.
import { deviceLibrary, deviceOf, instrumentTagOf, setInstrument, buildFx,
         chipParams, kitTakes, wetPathOf, targetIdOf, getParam, automationEnvelope,
         stitchEnvelope, putEnvelopes, setParam, paramRange, FILTER_OPEN,
         AF_HIGHPASS, masterDevices, delaySixteenthsAt } from "./live-devices.js";

/* ---------- the balanced-tag scanner ---------- */
// Regexes over XML are a bad idea in general and a fine idea here: the file was
// written by one program with one formatter, and the two things we must not do
// are assume literal whitespace and assume attribute order. Every anchor below
// is attribute-anchored with `\s*` between tags. (The prototype matched literal
// tab runs and worked — and was one Live re-save from breaking.)
const TOKEN = /<(\/?)([A-Za-z0-9._]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;

/** The [start,end) of the balanced element whose open tag begins at `from`. */
export function balancedAt(xml, from) {
  TOKEN.lastIndex = from;
  const first = TOKEN.exec(xml);
  if (!first || first.index !== from) throw new Error("no tag at " + from);
  if (first[4] === "/") return [from, TOKEN.lastIndex];
  const name = first[2];
  let depth = 1, m;
  while ((m = TOKEN.exec(xml))) {
    if (m[2] !== name) continue;
    if (m[1] === "/") { if (--depth === 0) return [from, TOKEN.lastIndex]; }
    else if (m[4] !== "/") depth++;
  }
  throw new Error("unbalanced <" + name + "> from " + from);
}

/** The whole text of the first `<tag …>` element at or after `from`. */
export function elementAfter(xml, tag, from = 0) {
  const open = new RegExp("<" + tag + "(?=[\\s/>])", "g");
  open.lastIndex = from;
  const m = open.exec(xml);
  if (!m) return null;
  const [a, b] = balancedAt(xml, m.index);
  return { start: a, end: b, text: xml.slice(a, b) };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Live's own number spelling: JS default float printing, which is what wrote
// `0.333333333333333315` into the donor. NO ROUNDING — the groove micro-timing
// IS the music, and a 3-decimal round would quantise the swing out of it.
const num = (x) => String(x);

/* ---------- the donor ---------- */

/** Read the donor once: its tracks, its pointee ceiling, its scene count. */
export function parseDonor(xml) {
  const tracks = [];
  const re = /<(MidiTrack|AudioTrack|ReturnTrack) (?:[^>]*?)Id="(\d+)"[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [start, end] = balancedAt(xml, m.index);
    const text = xml.slice(start, end);
    const nm = /<EffectiveName Value="([^"]*)"/.exec(text);
    tracks.push({ tag: m[1], id: +m[2], name: nm ? nm[1] : "", start, end });
    re.lastIndex = end;
  }
  const np = /<NextPointeeId Value="(\d+)"/.exec(xml);
  const scenes = elementAfter(xml, "Scenes");
  const nScenes = scenes ? (scenes.text.match(/<Scene Id="\d+"/g) || []).length : 0;
  const drift = tracks.find((t) => t.name === "2-Drift");
  // how many returns a track's sends have to land on — the number Live counts
  // when it says "more send knobs than set has return tracks"
  const nReturns = tracks.filter((t) => t.tag === "ReturnTrack").length;
  /* nSlots COUNTED BOTH LISTS AND SAID 16 (corrected 2026-08-31). A MidiTrack
     carries TWO ClipSlotLists — walked with a tag stack: `MidiTrack >
     DeviceChain > MainSequencer` (the session grid) and `MidiTrack >
     DeviceChain > FreezeSequencer` (its freeze mirror) — each EIGHT long,
     ids 0..7 twice. Counting the flat matches doubled it, which is what let
     the scene fence move to 12 and then fail on "track has no ClipSlot 8":
     the scenes were cloned and the rows to hold them were not. The count is
     the MAIN sequencer's list alone, which is the one a clip goes into. */
  const mainOf = (t) => {
    const seg = xml.slice(t.start, t.end);
    const ms = seg.indexOf("<MainSequencer>");
    if (ms < 0) return null;
    const fs = seg.indexOf("<FreezeSequencer>");
    return seg.slice(ms, fs > ms ? fs : seg.length);
  };
  const dm = drift ? mainOf(drift) : null;
  const nSlots = dm ? (dm.match(/<ClipSlot Id="\d+"/g) || []).length : 0;
  return { xml, nextPointeeId: np ? +np[1] : 0, tracks, nScenes, nSlots, nReturns };
}

/** The whole `<MidiTrack>…</MidiTrack>` of the donor track with this name. */
export function trackTemplate(donor, effectiveName) {
  const t = donor.tracks.find((x) => x.name === effectiveName);
  if (!t) throw new Error("donor has no track named " + effectiveName +
    " (it has: " + donor.tracks.map((x) => x.name).join(", ") + ")");
  return donor.xml.slice(t.start, t.end);
}

/** The GroovePool MidiClip with its `<Notes>` block emptied — the note grammar. */
export function clipTemplate(donor) {
  const pool = elementAfter(donor.xml, "GroovePool");
  if (!pool) throw new Error("donor has no GroovePool");
  const clip = elementAfter(donor.xml, "MidiClip", pool.start);
  if (!clip || clip.start > pool.end) throw new Error("donor has no MidiClip to copy");
  return clip.text;
}

/* ---------- the pointee space ---------- */
// Measured on the donor: 3,061 `Id=` attributes, 51 of them duplicated — and
// every duplicate is small and structural (ClipSlot 0..15, TrackSendHolder 0/1,
// device Id, MidiTrack Id, AutomationLane 0). The POINTEE space — the five tag
// families below — is globally unique, 2,646 ids reaching 24,321 under a
// NextPointeeId of 24,322, and it is the only space a clone may not duplicate.
// Get this wrong and Live still opens the set: it just points an automation
// lane at somebody else's knob, which is the worst kind of bug because it is
// silent. Gate 0 is the whole defence.
export const POINTEE_TAGS = /<(AutomationTarget|Pointee|[A-Za-z]*ModulationTarget|ControllerTargets\.\d+)(\s[^>]*?)Id="(\d+)"/g;

/** Every pointee id in `xml`, in document order. */
export function pointeeIds(xml) {
  const out = [];
  POINTEE_TAGS.lastIndex = 0;
  let m;
  while ((m = POINTEE_TAGS.exec(xml))) out.push({ tag: m[1], id: +m[3] });
  return out;
}

/** Rewrite every pointee id in a cloned track to a fresh one from `next`. */
export function renumber(xml, next) {
  POINTEE_TAGS.lastIndex = 0;
  return xml.replace(POINTEE_TAGS, (whole, tag, mid, id) =>
    "<" + tag + mid + 'Id="' + next() + '"');
}

/* ---------- the note block ---------- */

/**
 * One MidiClip, spliced out of the donor's own clip.
 *
 * The note order is the donor's order (Generic.xml:22622-22642): one KeyTrack
 * per distinct pitch ascending, MidiNoteEvents inside it ascending by Time,
 * `<MidiKey Value="…" />` LAST. OffVelocity is always 64 — the donor's value,
 * and nukernel has no release velocity to say anything else with.
 */
export function midiClip(tpl, { name, beats, time = 0, notes, id = 0, arrangement = false, sig = null, color = null }) {
  const byKey = new Map();
  for (const n of notes) {
    const k = Math.round(n.midi);
    // THIS USED TO CLAMP, AND THE CLAMP WAS A LIE. `Math.min(127, …)` turned
    // hymn's choir line — register home +2 over a part written up to MIDI 110,
    // so 134 — into five notes silently retuned to 127, and only gate 1's
    // multiset noticed ("want 134, got 127"). Deciding what a too-high note
    // becomes is the SCORE's business, where a whole line can move together
    // (score-node.fitMidi); by the time a note reaches the clip writer the
    // decision has been made and anything out of range is a bug upstream.
    if (k < 0 || k > 127) throw new Error("note out of MIDI range: " + k +
      " in clip \"" + name + "\" — the score should have folded it");
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(n);
  }
  let noteId = 1;
  const keys = [...byKey.keys()].sort((a, b) => a - b);
  const tracks = keys.map((k, i) => {
    const evs = byKey.get(k).slice().sort((a, b) => a.beat - b.beat);
    const body = evs.map((n) =>
      '<MidiNoteEvent Time="' + num(n.beat) + '" Duration="' + num(n.dur) +
      '" Velocity="' + num(Math.max(1, Math.min(127, Math.round(n.vel)))) +
      '" OffVelocity="64" NoteId="' + (noteId++) + '" />').join("");
    return '<KeyTrack Id="' + i + '"><Notes>' + body + "</Notes>" +
           '<MidiKey Value="' + k + '" /></KeyTrack>';
  }).join("");
  const block = "<Notes><KeyTracks>" + tracks + "</KeyTracks>" +
    "<PerNoteEventStore><EventLists /></PerNoteEventStore>" +
    "<NoteProbabilityGroups />" +
    '<ProbabilityGroupIdGenerator><NextId Value="1" /></ProbabilityGroupIdGenerator>' +
    '<NoteIdGenerator><NextId Value="' + noteId + '" /></NoteIdGenerator></Notes>';

  let x = tpl;
  x = x.replace(/^<MidiClip Id="\d+" Time="[^"]*"/, '<MidiClip Id="' + id + '" Time="' + num(time) + '"');
  // An ARRANGEMENT clip sits at an absolute song position; a SESSION clip
  // always starts at 0. The donor's only clip is at 0, so the arrangement case
  // is the one shape here with no ground truth behind it — see the header. Note
  // times stay relative to the clip's own start in both cases, which is what
  // LoopStart 0 says.
  const start = arrangement ? time : 0;
  x = x.replace(/<CurrentStart Value="[^"]*" \/>/, '<CurrentStart Value="' + num(start) + '" />');
  x = x.replace(/<CurrentEnd Value="[^"]*" \/>/, '<CurrentEnd Value="' + num(start + beats) + '" />');
  x = x.replace(/<LoopStart Value="[^"]*" \/>/, '<LoopStart Value="0" />');
  x = x.replace(/<LoopEnd Value="[^"]*" \/>/, '<LoopEnd Value="' + num(beats) + '" />');
  x = x.replace(/<OutMarker Value="[^"]*" \/>/, '<OutMarker Value="' + num(beats) + '" />');
  x = x.replace(/<Name Value="[^"]*" \/>/, '<Name Value="' + esc(name) + '" />');
  /* THE CLIP WEARS ITS TRACK'S COLOUR (2026-09-03). Paul, of the exported set:
     "all of the clips are the same color -- they should be the color of the
     track." They were: every clip in this exporter is a copy of the GroovePool
     template, whose `<Color Value="7" />` travelled with it into all thirty-odd
     clips of a set whose tracks were coloured 20, 7, 18 and 24.

     READ OUT OF THE DONORS, NOT DECIDED HERE. Live's own rule is visible in
     every file Paul saved: in Ableton2, Answers and Answers2 each of the seven
     clips carries EXACTLY the Color of the track it sits on (24/24, 16/16,
     12/12, 2/2, 1/1) — a clip inherits its track's colour at the moment Live
     makes it. So this is not a new convention, it is the donor's, and the only
     thing the exporter was doing wrong was carrying the template's. `color`
     absent leaves the clip exactly as it was, which is what a caller with no
     track to ask still gets. The FIRST `<Color>` is the clip's own: the
     template is the note block plus scalars and holds no device. */
  if (color != null) x = x.replace(/<Color Value="[^"]*" \/>/, '<Color Value="' + (color | 0) + '" />');
  // The template is the GROOVE pool's clip and it names its own groove
  // (GrooveId 4). A copy of it on a track would inherit Live's swing on top of
  // the swing nukernel has already baked into the note offsets — the same
  // groove counted twice. -1 is "no groove", which is what every ordinary clip
  // in a fresh set carries.
  //
  // 2026-08-28 — THE PREMISE ABOVE IS BACKWARDS; THE LINE BELOW STAYS. Measured
  // both ways: in Generic.als the ONLY GrooveId value in the entire document is
  // -1, and it is on the groove-pool clip — so this rewrite was replacing -1
  // with -1. In Ableton2.als it is the pool clip that carries -1 and the six
  // TRACK clips that carry GrooveId 4, pointing at the pool's "Swing 16ths 66".
  // A pool entry does not name itself; a track clip names the groove it was
  // assigned. So the rewrite was right for the wrong reason and is now MORE
  // clearly load-bearing, not less: a track clip is exactly where a live
  // GrooveId lands, and leaving one there is the double-swing bug.
  x = x.replace(/<GrooveId Value="[^"]*" \/>/, '<GrooveId Value="-1" />');
  // THE CLIP SAYS ITS OWN SIGNATURE (2026-08-30, the five-walls follow-up).
  // The donor clip carries `<RemoteableTimeSignature><Numerator Value="4"/>
  // <Denominator Value="4"/>` (Generic.xml:22565-22567) — explicit numbers,
  // Live's own element, no enum to infer — so a metered record's 3/4 or 6/8
  // goes in as those two values and nothing else changes. Absent = untouched,
  // byte for byte, which is every 4/4 record. (The MainTrack-level
  // `<TimeSignature><Manual Value="201"/>` is NOT written: 201 is an ENUM and
  // decoding it is inference — one observed pair, no second point — so the
  // set-wide signature stays the donor's until a metered donor lands; the ask
  // is in tools/ableton/donor/README.md. The clips and their loop lengths
  // carry the bar truth regardless.)
  if (sig) {
    x = x.replace(/<Numerator Value="[^"]*" \/>/, '<Numerator Value="' + (sig[0] | 0) + '" />');
    x = x.replace(/<Denominator Value="[^"]*" \/>/, '<Denominator Value="' + (sig[1] | 0) + '" />');
  }
  // strip the donor's notes and put ours in their place
  const old = elementAfter(x, "Notes");
  if (!old) throw new Error("clip template has no <Notes> block");
  return x.slice(0, old.start) + block + x.slice(old.end);
}

/* ---------- the two tables ---------- */

// WHICH DONOR TRACK A CHAIR CLONES.
//
// `main:docs/ABLETON-EXPORT.md` says "Simpler wins over cleverness". On THIS
// donor that rule is silence: the MultiSampler on `3-Sampler` has zero zones
// (0 MultiSamplePart, 0 SampleRef, 0 UserSample in the whole file), so a chair
// sent there makes no sound at all — the worst possible outcome, because the
// set opens and Paul hears nothing and cannot tell whether the exporter or the
// music is broken. So the table picks the tracks that sound with no samples,
// and it goes back to Simpler the day Ask #2 lands.
export const DONOR_TRACK = {
  bass: "2-Drift",        // Drift's default patch is audible and has glide, the `sld` target
  pad: "4-Operator",      // distinguishable from the leads at a glance
  drums: "2-Drift",       // and renamed loudly — see DRUM_TRACK_NAME
  "": "2-Drift",          // the default
};

/* ...AND THEN THE INSTRUMENT GETS A SAY, WHICH IT NEVER HAD (2026-08-31).
   Paul, opening the working export: "you're choosing instruments but just
   giving them default settings ... you're using only operator and drift.
   Obviously things could align better than that."

   He is right twice, and the second half is the interesting one. The table
   above is keyed on the CHAIR — lead, pad, bass — so a jazz guitar, a solo
   voice and a Rhodes all landed on the same two devices, and the exporter had
   the instrument the whole time: export/score.js has put `instr` on every lane
   since the fold was written, off `plan.cast()`. It was simply never read.
   That is this repo's most familiar bug (docs: "declared but never arriving"),
   and it is why four voices arrived as two synths.

   THE DONOR HAS FOUR INSTRUMENTS THAT SOUND, and they are genuinely different
   machines, so the mapping is by SYNTHESIS METHOD and not by taste:
     6-Tension   StringStudio, a physically modelled STRING — bowed and
                 plucked. Everything with a string in it goes here, which is
                 the biggest family we have (guitars, the bowed strings, harp,
                 sitar, koto, and the two plucked keyboards, harpsichord and
                 clavinet, which are strings a key plucks).
     4-Operator  FM. Struck and blown: pianos, electric pianos, organs, tuned
                 percussion, brass and reeds. FM is what an electric piano and
                 a bell ARE, so this is the least arbitrary edge here.
     5-Meld      two oscillators built for evolving sustain — pads, voices,
                 atmospheres, the chairs that hold.
     2-Drift     subtractive, with glide. The synths, and every bass, for the
                 reason the table above already gives: `sld` needs portamento.
   3-Sampler still takes nothing: its MultiSampler has zero zones, so a chair
   sent there is silent, and silence is the worst export there is.

   ORDER MATTERS AND IS TESTED: "steel_string_guitar" must meet the string row
   before the "steel_drums" word in the FM row, so strings are asked first. */
export const DONOR_BY_INSTR = [
  [/guitar|banjo|mandolin|sitar|koto|shamisen|dulcimer|harp|violin|viola|cello|contrabass|fiddle|erhu|strings|harpsichord|clavinet/, "6-Tension"],
  [/piano|grand|_ep|organ|vibraphone|marimba|glockenspiel|kalimba|music_box|tubular|steel_drums|timpani|trumpet|trombone|tuba|horn|brass|sax|clarinet|oboe|flute|recorder|whistle|shenai|harmonica|accordion|bandoneon/, "4-Operator"],
  [/vox|voice|choir|pad|atmosphere|fantasia|glass|sea_shore|space/, "5-Meld"],
];
export function donorFor(chair, instr) {
  if (chair === "drums") return DONOR_TRACK.drums;
  if (chair === "bass") return DONOR_TRACK.bass;   // glide outranks the family
  for (const [re, track] of DONOR_BY_INSTR) if (re.test(instr || "")) return track;
  return DONOR_TRACK[chair] || DONOR_TRACK[""];
}

/* ---- THE COLOUR OF A TRACK, AND SO OF ITS CLIPS (2026-09-03) -------------
   Paul: "all of the clips are the same color -- they should be the color of
   the track." The clip half is midiClip's, above. This is the other half, and
   it is a smaller change than it looks: the tracks were ALREADY coloured — a
   clone keeps the donor track's `<Color>`, so a funk export came out 20 / 7 /
   18 / 24. What was wrong is that those four numbers name the DONOR and not
   the part: `bass` and a plain synth line both clone `2-Drift` and so both
   came out 7, and two lines of the same family are indistinguishable from two
   lines of different ones.

   ONE CLASSIFICATION, READ TWICE. The family below is `donorFor`'s own answer
   plus the two special chairs it already special-cases, so there is no second
   table of instrument regexes to drift out of step with the first — the same
   move `columnNames` makes for names and gate M makes for the mix tables.

   EVERY INDEX IS ONE LIVE ITSELF WROTE, and each is taken from the donor track
   for that family's machine, so the mapping means "the colour Live gives this
   kind of instrument" rather than a taste:
     drums  24  the "1-DS Drum Rack" track in Ableton2 / Answers / Answers2
     bass   16  the Drift track in the same three (Generic's Drift is 7)
     keys   12  the Operator track in the same three (Generic's is 18)
     string 20  Generic's "6-Tension"
     pad     6  Generic's "5-Meld"
     synth   2  the Wavetable track in the same three — the remaining donor
                colour, and the only family with no donor machine of its own
   Six families, six distinct indices, none of them invented. The returns keep
   the 9 and 10 the donor gave them and the master keeps its own. */
export const TRACK_COLOR = { drums: 24, bass: 16, keys: 12, string: 20, pad: 6, synth: 2 };
const FAMILY_OF_DONOR = { "6-Tension": "string", "4-Operator": "keys", "5-Meld": "pad" };
export function familyOf(chair, instr) {
  if (chair === "drums") return "drums";
  if (chair === "bass") return "bass";
  return FAMILY_OF_DONOR[donorFor(chair, instr)] || "synth";
}
export const colorFor = (chair, instr) => TRACK_COLOR[familyOf(chair, instr)];
/** The colour this lane's track and clips take — the gate asks THIS, not a copy. */
export const colorOfLane = (boxes, laneName) => {
  const info = laneInfoOf(boxes, laneName);
  return colorFor(laneName === "drums" ? "drums" : info.chair, info.instr);
};

/* THE SECOND DONOR'S ONE TRACK, MADE FIT FOR THE FIRST DONOR'S SET.
   The drum rack comes out of Ableton2 (export/drumrack.js) and everything else
   in the file comes out of Generic, so the rack arrives with two things that
   belong to the set it was saved in, and both are silent failures rather than
   loud ones — which is the only reason they are worth this much comment.

   ONE: ITS SLOTS ARE NOT EMPTY. Ableton2's probe clip sits in slot 0 of every
   track. putSessionClip writes by REPLACING the empty inner
   `<ClipSlot><Value /></ClipSlot>`, so against a filled slot it matches
   nothing, changes nothing, throws nothing — box 1's drums would simply be
   missing, and the set would open looking fine. The slots are emptied first.

   TWO: IT HAS ONE SEND AND THIS SET HAS TWO RETURNS. Ableton2 has a single
   return track, so its tracks carry a single TrackSendHolder; Generic has
   A-Reverb and B-Delay. That is the same class of mismatch Live complained
   about out loud this morning ("more send knobs than set has return tracks"),
   pointing the other way, and the fix is the same shape as growSlots: clone the
   holder Live wrote and renumber it. */
function emptySlots(track) {
  const re = /<ClipSlot Id="(\d+)">/g;
  let m, out = "", cursor = 0;
  while ((m = re.exec(track))) {
    const [a, b] = balancedAt(track, m.index);
    let one = track.slice(a, b);
    const inner = one.indexOf("<ClipSlot>");
    if (inner >= 0) {
      const [ia, ib] = balancedAt(one, inner);
      one = one.slice(0, ia) + "<ClipSlot><Value /></ClipSlot>" + one.slice(ib);
    }
    out += track.slice(cursor, a) + one;
    cursor = b; re.lastIndex = b;
  }
  return out + track.slice(cursor);
}
function fitSends(track, want) {
  const holders = [...track.matchAll(/<TrackSendHolder Id="(\d+)">/g)];
  if (!holders.length || holders.length >= want) return track;
  const [a, b] = balancedAt(track, holders[0].index);
  const one = track.slice(a, b);
  let add = "", next = Math.max(...holders.map((h) => +h[1])) + 1;
  for (let i = holders.length; i < want; i++)
    add += "\n" + one.replace(/^<TrackSendHolder Id="\d+">/,
      '<TrackSendHolder Id="' + (next++) + '">');
  const last = balancedAt(track, holders[holders.length - 1].index)[1];
  return track.slice(0, last) + add + track.slice(last);
}
/** The Ableton2 drum-rack track, made ready to be a track in THIS set. */
export function rackTemplate(rackXml, returns) {
  return fitSends(emptySlots(rackXml), returns);
}

/* THE NAMES, IN ONE PLACE, BECAUSE TWO PLACES IS HOW THEY DRIFT.
   als-gate.js gate 1 rebuilds every clip name to look it up in the file, and
   when the naming changed here the gate reported "clip ... appears 0 times" —
   not a defect in the export, a second implementation of the same rule going
   stale. So the rule is exported and the gate asks for it.

   THE COLUMN IS THE CHAIR (Paul: "the column should be named 'drums'"). Two
   chairs of one role are told apart by a count, the same way boxes are.
   THE CLIP IS "intro drums 1" — Paul's own example: the section, the part,
   and which time round it is, so a clip dragged out on its own still says
   where it came from. A roleless box keeps its label, which carries the box
   number, so the name stays unique either way — which is what gate 1 counts
   by, and why the number was there in the first place. */
export function columnNames(boxes, laneNames) {
  const used = {}, out = {};
  for (const n of laneNames) {
    const c = laneInfoOf(boxes, n).chair || (n === "drums" ? "drums" : "voice");
    const k = used[c] = (used[c] || 0) + 1;
    out[n] = k > 1 ? c + " " + k : c;
  }
  return out;
}
export const clipNameOf = (box, col) =>
  (box.role ? box.role + " " + col + " " + (box.nth || 1) : box.name + " " + col);

/* THE STRIP THE DESK GAVE THIS CHANNEL, WRITTEN ONTO LIVE'S OWN MIXER.
   Paul: "Could you sculpt the sound more to be appropriate and then use the
   sends?" Every track shipped at unity with both sends at -inf, and the
   numbers to do better were already computed and already heard: audio/desk.js
   deskUnits sums `fader`, `rev`, `del` and `pan` per unit, and plan.js now
   hands them out per seat (stripOf). This writes those four onto the four
   controls Live has for them, so the exported mixer is a QUOTE of the desk
   rather than a second opinion about it.

   IT IS NOT A DOUBLE COUNT, and score-node.mjs's header is why: the velocities
   in this export are the WRITTEN 0..9, deliberately not barPlan's desk-
   multiplied `amp`, precisely so that the fader could be written here instead.
   The two halves finally meet.

   TWO HONEST LOSSES, said out loud rather than smoothed:
     · A SEND IS 0..1 IN LIVE and the engine's bus gain is not bounded — a
       drowned chair measures 2.26. It is clamped, so the wettest chairs arrive
       at Live's maximum rather than at their own number.
     · THE RIDE IS DROPPED. These are per-bar in the engine and one value on a
       Live track; box 0 is the answer (plan.js stripOf says why). Automation
       envelopes are P3.
   ABSENT IS UNITY: deskUnits omits a key it did not move, so a missing
   `fader` writes 1 and a missing `pan` writes 0 — the donor's own values. */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const SEND_FLOOR = 0.0003162277571;      // Live's -inf, the donor's own spelling
export function setStrip(track, strip, vol) {
  strip = strip || {};
  if (vol == null && !Object.keys(strip).length) return track;
  const mix = elementAfter(track, "Mixer");
  if (!mix) return track;
  let body = mix.text;
  // one <Manual> per named control, the FIRST inside that control's element
  const put = (tag, value) => {
    const i = body.indexOf("<" + tag + ">");
    if (i < 0) return;
    const j = body.indexOf("<Manual Value=", i);
    if (j < 0) return;
    const k = body.indexOf("/>", j) + 2;
    body = body.slice(0, j) + '<Manual Value="' + value + '" />' + body.slice(k);
  };
  const send = (n, value) => {
    const i = body.indexOf('<TrackSendHolder Id="' + n + '">');
    if (i < 0) return;
    const j = body.indexOf("<Manual Value=", i);
    if (j < 0) return;
    const k = body.indexOf("/>", j) + 2;
    body = body.slice(0, j) + '<Manual Value="' + value + '" />' + body.slice(k);
  };
  if (vol != null) put("Volume", clamp(vol, SEND_FLOOR, 1.99526238));
  if (strip.pan != null) put("Pan", clamp(strip.pan, -1, 1));
  // A-Reverb is send 0 and B-Delay is send 1 — the donor's own order, and the
  // two returns this splice has always shipped.
  if (strip.rev != null) send(0, clamp(strip.rev, SEND_FLOOR, 1));
  if (strip.del != null) send(1, clamp(strip.del, SEND_FLOOR, 1));
  return track.slice(0, mix.start) + body + track.slice(mix.end);
}

/* THE MIX IS MUDDY AND THE PADS ARE LOUD, AND BOTH ARE ONE OMISSION.
   Paul: "Pads are always too loud in Ableton" and "Always add basic EQ
   filtering on drums, bass, etc -- the mix is very muddy."

   WHY EVERY TRACK CAME OUT AT UNITY. I wrote the mixer from `strip.fader`
   last round — and there is no `fader` key on a unit. The gain the engine
   actually carries is `lvl`, and reading the wrong name meant every track got
   the donor's 1.0 and the pad sat exactly as loud as the voice. That is the
   whole of "pads are always too loud".

   ...AND WHY `lvl` IS STILL NOT WHAT SHIPS. Chasing it down, audio/desk.js
   says of that number: "lvl is read by sampled voices and drums AND BY
   NOTHING ELSE — nothing modelled reads lvl". So the engine's per-renderer
   gain is not one number, and worse, what differentiates the voices audibly is
   `dry`/`pageTrim` — a trim that compensates for OUR modules being quiet
   (voice_lead 4.11, voice_choir 7.52). Live's Meld is not our vocal model, so
   carrying that trim across would make the exported voices ~12 dB too loud.
   It is the wrong quantity by construction.

   WHAT SHIPS IS THE DESK'S WORD, which is device-independent by design:
   precompose CHAIRLVL says what a chair asks for and fields.js LEVELS says
   what the word is worth. Two independent routes agree on the pad: the table
   says `back` (0.7, -3.1 dB), and the engine's own balance with the module
   trim divided back out measures lead 0.273 against pad 0.193 — also -3 dB.
   A duplicated table is a drift risk, so gate M in als-gate.js reads the real
   precompose and fields tables and FAILS if these two disagree with them.
   (A row's own `mix[part].lvl` is NOT read here, and the REASON WAS WRONG.
   This said the word "does not reach the engine either — measured,
   `mix: {pad:{lvl:"hush"}}` and `{lvl:"fwd"}` both leave the unit at 0.2297".
   CORRECTED 2026-08-31: that measurement was my harness, not the engine.
   precompose MEMOIZES an anchor's document and I was mutating GENRES after it
   was already built, so nothing downstream ever saw either word. Measured
   properly — in the page, where the document exists — `mix: {riff:{lvl:"back"}}`
   on balearic puts `lvl: "back"` into `sec.parts.riff` and takes that unit
   to 0.100 against the lead vocal's 0.205. fields.js resolvePartMix has read
   `lvl` all along. The export still does not honour it, but now for the honest
   reason: the strip here is built from the CHAIR tables, and reading a second
   level source on top would count the same intent twice.) */
export const CHAIR_LEVEL = { lead: "fwd", pad: "back", drone: "back" };
export const LEVEL_GAIN = { hush: 0.4, back: 0.7, norm: 1, fwd: 1.35 };
export const chairGain = (chair, nth) =>
  LEVEL_GAIN[(nth > 0 && chair === "lead") ? "norm"          // CHAIRLVL2
             : (CHAIR_LEVEL[chair] || "norm")];

/* THE EQ, OUT OF THE DONOR'S OWN Eq8, AND NOT ONE FILTER TYPE IS GUESSED.
   The donor's Eq8 ships Live's default eight-band layout, measured:
       band 0  Mode 2 (low shelf)  30 Hz     band 4..7  off
       band 1  Mode 3 (bell)      200 Hz
       band 2  Mode 3 (bell)        1 kHz
       band 3  Mode 5 (high shelf)  5 kHz
   So this sets FREQ AND GAIN ONLY and never writes `Mode`. That matters: the
   Mode enum's meaning is not printed anywhere in the file, and a wrong guess
   would turn a shelf into a notch silently. Working inside the modes Live
   itself left there costs nothing and cannot be wrong.

   THE CURVES ARE THE ORDINARY ONES, which is what "basic EQ filtering" asks
   for: everything that is not the bass or the kick gets its bottom taken off
   so it stops competing down there, the 200 Hz mud is pulled on the parts that
   sit in it, and the top is opened a little on the parts that carry the tune.
   The pad gets the deepest low cut, because a sustained chord holding low
   energy under everything IS the muddiness being described. */
export const CHAIR_EQ = {
  //            low shelf (band 0)      200 Hz bell (1)     5 kHz shelf (3)
  bass:   [{ n: 0, f: 45,   g: 1.5 }, { n: 1, f: 220, g: -2.5 }, { n: 3, f: 5000, g: -4 }],
  drums:  [{ n: 0, f: 55,   g: 1.5 }, { n: 1, f: 300, g: -3 },   { n: 3, f: 6000, g: 2 }],
  pad:    [{ n: 0, f: 260,  g: -9 },  { n: 1, f: 420, g: -3 },   { n: 3, f: 6000, g: -1 }],
  drone:  [{ n: 0, f: 260,  g: -9 },  { n: 1, f: 420, g: -3 },   { n: 3, f: 6000, g: -1 }],
  lead:   [{ n: 0, f: 140,  g: -6 },  { n: 1, f: 300, g: -2 },   { n: 3, f: 6000, g: 2 }],
  riff:   [{ n: 0, f: 170,  g: -6 },  { n: 1, f: 350, g: -2 },   { n: 3, f: 6000, g: 1.5 }],
  counter:[{ n: 0, f: 170,  g: -6 },  { n: 1, f: 350, g: -2 },   { n: 3, f: 6000, g: 1 }],
  "":     [{ n: 0, f: 150,  g: -5 },  { n: 1, f: 320, g: -2 },   { n: 3, f: 6000, g: 1 }],
};
/** The donor's Eq8 device, lifted whole. */
export function eqTemplate(donor) {
  const t = donor.tracks.find((x) => x.name === "1-MIDI");
  if (!t) return null;
  const seg = donor.xml.slice(t.start, t.end);
  const i = seg.indexOf("<Eq8 Id=");
  if (i < 0) return null;
  const [a, b] = balancedAt(seg, i);
  return seg.slice(a, b);
}
/** Set Freq and Gain (never Mode) on the named bands, both channels. */
export function setEqBands(eq, bands) {
  let out = eq;
  for (const { n, f, g } of bands) {
    const s0 = out.indexOf("<Bands." + n + ">");
    if (s0 < 0) continue;
    const [a, b] = balancedAt(out, s0);
    let one = out.slice(a, b);
    // ParameterA and ParameterB are the two channels; both move together
    const put = (tag, value) => {
      let from = 0;
      for (;;) {
        const i = one.indexOf("<" + tag + ">", from);
        if (i < 0) break;
        const j = one.indexOf("<Manual Value=", i);
        if (j < 0 || j > i + 400) { from = i + 1; continue; }
        const k = one.indexOf("/>", j) + 2;
        one = one.slice(0, j) + '<Manual Value="' + value + '" />' + one.slice(k);
        from = j + 30;
      }
    };
    put("Freq", f);
    put("Gain", g);
    out = out.slice(0, a) + one + out.slice(b);
  }
  return out;
}
/**
 * The `Id="…"` of every DIRECT child of a list element's text.
 *
 * Direct, with a depth counter, because a drum track's `<Devices>` contains a
 * DrumGroupDevice which contains more `<Devices>` — and a rack's inner chain is
 * its own list with its own key space, so an id in there is not a neighbour.
 */
export function listIds(text) {
  const ids = [];
  TOKEN.lastIndex = 0;
  let m, depth = 0;
  while ((m = TOKEN.exec(text))) {
    const close = m[1] === "/", self = m[4] === "/";
    if (close) { depth--; continue; }
    if (depth === 1) {
      const id = /(?:^|\s)Id="(\d+)"/.exec(m[3]);
      if (id) ids.push(+id[1]);
    }
    if (!self) depth++;
  }
  return ids;
}

/**
 * THE ID ON A DEVICE IS THE KEY IN ITS CHAIN'S LIST, and Live refuses a set
 * whose list has two of the same one: "Non-unique list ids." (Paul, 2026-09-03,
 * on a v261 export.) Every device in this file is a PHOTOGRAPH of a device that
 * sat at some position in some donor's chain, and it arrives carrying THAT
 * chain's key — Generic's Eq8 is `Id="3"`, Answers' Limiter is `Id="3"`,
 * Answers2's PhaserNew is `Id="3"` — so as soon as two of them land in one
 * chain the file is a Live error and not a set. `renumber` never touched this:
 * it rewrites POINTEE_TAGS (AutomationTarget / Pointee / *ModulationTarget),
 * which is the automation key space, a different one.
 *
 * Measured on the six records this bug was reported against: two
 * `<AutoFilter2 Id="1">` in one chain (the `mot: rise` highpass cloned from the
 * lowpass template), `<PhaserNew Id="3">` beside `<Eq8 Id="3">` on a chip
 * track, and `<Eq8 Id="3">` beside `<Limiter Id="3">` on every master.
 *
 * The rule is UNIQUE, not sequential — Live's own files prove it: Answers'
 * MainTrack reads Saturator#4, GlueCompressor#0, Limiter#3 and Generic's return
 * B holds a lone Delay#7. So this takes the next id above the chain's highest
 * and leaves every device already in the list alone.
 */
function withListId(device, id) {
  return device.replace(/^<([A-Za-z0-9._]+) Id="\d+"/, '<$1 Id="' + id + '"');
}

/** Put a device at the END of a track's own device chain (after the instrument). */
export function addDevice(track, device) {
  const d = elementAfter(track, "Devices");
  if (!d) return track;
  const ids = listIds(d.text);
  device = withListId(device, ids.length ? Math.max(...ids) + 1 : 0);
  /* AND THE EMPTY CHAIN IS A DIFFERENT ELEMENT, which cost nothing here only
     because it was measured before it was written: every MIDI track in the
     donor holds `<Devices>…</Devices>` with an instrument in it, but the
     MainTrack — where the master chain goes — holds `<Devices />`,
     self-closing, because Live wrote no devices on it. Inserting before
     "</Devices>" in an eleven-character element would splice the device into
     the middle of the open tag and produce XML that is not well-formed. */
  if (/\/>$/.test(d.text))
    return track.slice(0, d.start) + "<Devices>" + device + "</Devices>" + track.slice(d.end);
  const at = d.end - "</Devices>".length;
  return track.slice(0, at) + device + track.slice(at);
}

/**
 * The record's master bus onto the donor's own MainTrack.
 *
 * ABSENT IS THE DONOR'S MAIN TRACK, UNTOUCHED — which for both older donors
 * means an empty `<Devices />`, and that is exactly what an unmastered record
 * should open as. Only words that ask for something build something
 * (live-devices.js masterDevices says which), so this returns the xml
 * unchanged for every Score folded before today.
 */
export function spliceMaster(xml, devices) {
  if (!devices || !devices.length) return xml;
  const mt = elementAfter(xml, "MainTrack");
  if (!mt) return xml;
  let track = mt.text;
  for (const d of devices) track = addDevice(track, d);
  return xml.slice(0, mt.start) + track + xml.slice(mt.end);
}

/* AND THE COLUMNS NOBODY PLAYS COME OUT. Paul: "Then kill the columns/
   instruments you don't actually use." The donor's six MIDI tracks are the
   TEMPLATES — every exported track is a clone of one of them — and once the
   clones exist the originals are six empty columns in the way, one of which
   (1-MIDI) also carries the Max for Live device whose absolute macOS path gate
   3 has warned about on every single run. Deleting them retires that warning
   as a side effect, which is the good kind of side effect: the hazard leaves
   because the thing carrying it was not being used.
   THE RETURNS AND THE MAIN STAY, obviously — the sends above land on them. */
export function dropDonorTracks(xml) {
  const te = elementAfter(xml, "Tracks");
  if (!te) return xml;
  let body = te.text, out = "", cursor = 0;
  // NO CLOSING ANGLE HERE, and it cost a round: a donor track opens
  // `<MidiTrack Id="12" SelectedToolPanel="7" ...>`, carrying view attributes,
  // so a pattern that demanded `Id="12">` matched nothing and this function
  // silently returned the file unchanged. Silently is the operative word — it
  // threw nothing and every gate passed, which is what gate C below is for.
  const open = /<MidiTrack Id="(\d+)"/g;
  let m;
  while ((m = open.exec(body))) {
    const [a, b] = balancedAt(body, m.index);
    const id = +m[1];
    // the clones are numbered from 900 (see trackId below); the donor's are 12..18
    if (id < 900) { out += body.slice(cursor, a); cursor = b; }
    open.lastIndex = b;
  }
  out += body.slice(cursor);
  return xml.slice(0, te.start) + out + xml.slice(te.end);
}
export const DRUM_TRACK_NAME = "DRUMS — load a Drum Rack";

// THE DRUM LANE LETTER -> GM NOTE.
//
// REVERSED FROM THE DESIGN NOTE, and the reason is worth keeping. Design 09 §4
// says "tomHi/tom/tomLo all arrive as drum:'tom' … all three export as GM 47",
// because to-engine.js:1211-1220 builds its drum event out of LANE and keeps
// `L.pitch` while dropping `L.tom`. That is true of the barPlan path and it is
// NOT true here: P0/P1 read plan.timeline(), whose hit events are the raw
// `{t,d,acc,vel,fill}` off derive.js with the lane LETTER still on them
// (to-engine.js:128-141 is the table those letters index). So `t`, `m` and `l`
// are three different toms in this exporter today, and the collapse only
// returns if a later phase switches to barPlan without adding `d.tom = L.tom`.
export const GM_DRUM = {
  k: 36,  // Bass Drum 1
  s: 38,  // Acoustic Snare
  p: 37,  // Side Stick
  c: 39,  // Hand Clap
  h: 42,  // Closed Hi-Hat
  o: 46,  // Open Hi-Hat
  f: 44,  // Pedal Hi-Hat
  r: 51,  // Ride Cymbal 1
  x: 49,  // Crash Cymbal 1
  t: 50,  // High Tom
  m: 47,  // Low-Mid Tom
  l: 43,  // High Floor Tom
};

/* ---------- the whole document ---------- */

/**
 * Splice `score` into `donorXml` and return the finished LiveSet XML.
 *
 * opts.all === false (P0): the first box's first lane only — one cloned track,
 * one Session clip in slot 0, one Arrangement clip at 0, the tempo. Nothing
 * else in the donor is touched.
 * opts.all === true (P1): every lane of every box, one track per lane, one
 * Session clip per box in slot i, one Arrangement clip per box at its beat0,
 * scene i renamed to the box's label.
 */
/* ---------- the paced view of a Score (2026-08-30, the five-walls follow-up) —
   ONE ARITHMETIC, TWO READERS (this file and als-gate.js gate 1, which must
   expect exactly what the splice writes). export/score.js scoreOf hands each
   box its measured stretch `k` (barSteps/steps — audio/plan.js paceTL's own
   footprint on the timeline). A record with any k ≠ 1 has a TEMPO MAP, and
   this exporter can finally say one: the notes go in UN-stretched (their
   written beat values) and the tempo moves instead — see spliceTempoMap. A
   record with every k = 1 takes NO branch: identity note transform, the box's
   own beat0/beats floats untouched, so every unpaced record is byte-identical. */
export function paceView(boxes) {
  const paced = boxes.some((b) => b.k > 0 && b.k !== 1);
  let tb = boxes.length ? boxes[0].beat0 : 0;
  return boxes.map((box) => {
    const k = paced && box.k > 0 ? box.k : 1;
    const v = { box, k, paced,
                beat0: paced ? tb : box.beat0,
                beats: paced ? box.beats / k : box.beats,
                notes: (ns) => (k === 1 ? ns
                  : ns.map((n) => ({ ...n, beat: n.beat / k, dur: n.dur / k }))) };
    tb += box.beats / k;
    return v;
  });
}

export function alsFromScore(donorXml, score, opts = {}) {
  const all = !!opts.all;
  // the drum-rack track XML, when the caller has one to give (export/drumrack.js)
  const rack = opts.drumRack || null;
  const donor = parseDonor(donorXml);
  const tpl = clipTemplate(donor);
  // the record's declared signature, if it declared one (scoreOf stamps
  // meterAbc off the timeline's own genre; the CLI resolves a word-meter
  // through the kernel it already shims — score-node.mjs loadScore)
  const sigM = /^(\d+)\/(\d+)$/.exec(opts.timesig || score.meterAbc || "");
  const sig = sigM ? [+sigM[1], +sigM[2]] : null;
  const notes = [];                                   // what the run did, for the CLI to print

  const boxes = all ? score.boxes : score.boxes.slice(0, 1);
  /* THE COUNT FENCE IS GONE, AND THE REASON IT EXISTED IS NOW SATISFIED
     RATHER THAN AVOIDED (2026-08-31, third pass — Paul hit all three of its
     shapes in a row). It read, in its last form: "song has N boxes and the
     donor track has 8 clip slots. Refusing: fabricating slot rows is a
     guess, and a wrong guess here opens as a broken set."
     What made it a guess was fabricating; nothing fabricates now. growScenes
     and growSlots CLONE elements Live itself wrote — a Scene and a ClipSlot
     are both self-contained (measured: nothing in either indexes a track or
     names a clip; the only per-instance field is an id), lifted with
     `balancedAt` so a nested empty slot cannot truncate the copy, renumbered
     in each list's own sequence, and passed through the pointee renumber so
     gate 0's duplicate probe covers them like every other spliced element.
     WHAT REMAINS A REAL REFUSAL is a donor with nothing to clone FROM, which
     is the honest floor and is checked below. And the note that outlived the
     fence: a longer song is more scenes, and Live's session view is happy
     with them — but this is still a shape only Live can confirm, so the
     twelve-scene set is the one to open for gate 4. */
  if (!donor.nSlots || !donor.nScenes)
    throw new Error("the donor has " + donor.nScenes + " scenes and " +
      donor.nSlots + " clip slots — there is nothing to clone from. " +
      "Save a donor with at least one scene.");

  // The lanes, in one order for the whole song, so track N is the same voice in
  // every box.
  const laneNames = [];
  for (const b of boxes) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
    if (!laneNames.includes(l.name)) laneNames.push(l.name);
  if (!laneNames.length) throw new Error("the score has no notes to export");

  let nextId = donor.nextPointeeId;
  const next = () => nextId++;
  let trackId = 900;                                  // clones sit above the donor's 12..18
  let clipId = 1;
  const views = paceView(boxes);

  /* THE COLUMN IS NAMED FOR WHAT IT DOES. Paul: "the column should be named
     'drums'". It used to read "v0 crunch_guitar" — the seat number and the
     patch, which is the exporter's own bookkeeping showing through. The chair
     IS the function, and two chairs of one role are told apart by a count
     ("lead", "lead 2"), the same way the boxes are. The instrument has not
     gone anywhere: it now shows as the DEVICE on the track, which is the
     thing a person opens the set to look at. */
  const colName = columnNames(boxes, laneNames);
  // how many chairs of this role we have already seen — CHAIRLVL2's `nth`
  const chairNth = {};
  {
    const used = {};
    for (const n of laneNames) {
      const c = laneInfoOf(boxes, n).chair || (n === "drums" ? "drums" : "");
      chairNth[n] = (used[c] = (used[c] || 0) + 1) - 1;
    }
  }
  const eqTpl = eqTemplate(donor);

  /* ================== P3: THE SOUND ==================================
     Everything from here to `putEnvelopes` below is 2026-09-03's answer to
     "it makes the mix so unexpressive": the chair's tone onto the donor
     instrument, the section's composed ride as real automation envelopes, and
     the box's `fx` chips as Live devices out of the donors' own chains. The
     translation tables and the parameter grammar are
     nukernel/export/live-devices.js — this is the wiring.

     ABSENT IS TODAY, AND IT IS THE DEFAULT ON EVERY CLAUSE. A Score with no
     `tone` (an unwarmed `--no-engine` run), no `auto` and no `fx` — which is
     every Score folded before today and every `--score` file on disk — takes
     none of these branches and comes out byte-identical to the last release.
     The gate proves it: gate E reports zeroes for such a record instead of
     failing it. */
  const lib = deviceLibrary(donorXml, opts.fxRack || "", opts.masterRack || "",
                           opts.fxRack2 || "");
  const beatsPerBar = sig ? (sig[0] * 4) / sig[1] : 4;
  const fxCtx = { bpm: Math.max(1, +score.bpm || 120), beatsPerBar };
  const laneFor = (box, param) => ((box.auto || []).find((a) => a.param === param) || null);
  /* THE CHIPS ARE THE UNION OVER THE SONG, IN FIRST-SEEN ORDER, and the wet
     knob rides an envelope. nukernel's chips are per SECTION and Live's
     devices are per TRACK — the same shape mismatch plan.js stripOf describes
     for the fader ("these are per-bar in the engine and one value on a Live
     track") — but where the strip had to pick box 0 and drop the ride, this
     does not have to: the device is spliced once and its DryWet is automated
     to 0 through every box that did not ask for it. So a record whose last
     two sections add a chorus gets a chorus that arrives in the last two
     sections, which is the thing itself and not a compromise. */
  const chips = [];
  for (const b of boxes) for (const k of (b.fx || [])) if (!chips.includes(k)) chips.push(k);
  const anyCut = boxes.some((b) => laneFor(b, "cutoff"));
  const anyHpf = boxes.some((b) => laneFor(b, "hpf"));
  const anyLevel = boxes.some((b) => laneFor(b, "level") || b.lvl);
  // what the run did to the SOUND, printed by the CLI beside the clip list
  const sound = { params: 0, envelopes: 0, devices: 0, unmapped: [], notes: [] };
  const sawUnmapped = new Set();
  /* THE LANE THAT USED TO HAVE NO HOME NOW HAS ONE (2026-09-03, the Answers
     round). This paragraph read, until today: "`mot: \"rise\"` compiles to a
     HIGHPASS sweep … getting there needs `Filter_Type`, whose 0..9 the donor
     prints no names for, and a wrong enum turns a rising sweep into a closing
     one. So it is named on every run that has one, which is what turns
     'should we decode that enum?' from a judgement call into a trigger." The
     trigger fired: donor/README.md asked, Paul saved `Answers.als` with one
     AutoFilter2 switched to highpass, and that device reads `Filter_Type` 1
     where every untouched one in every donor reads 0 (live-devices.js
     AF_HIGHPASS carries the line numbers). So the sweep is WRITTEN now, and
     this is the one place the exported file says more than the engine does —
     audio/desk.js renders `rise` to nothing, because "the parent's master
     stage has a lowpass ceiling and no floor". The old sentence is QUOTED
     rather than deleted, because this repo does not delete a claim it
     reverses. */
  if (anyHpf && lib.AutoFilter2)
    sound.notes.push('the "rise" sweep -> a second AutoFilter2 at Filter_Type ' + AF_HIGHPASS +
      " (HIGHPASS, decoded from donor/Answers.als)");

  const trackXml = laneNames.map((laneName) => {
    const info = laneInfoOf(boxes, laneName);
    const isDrums = laneName === "drums";
    const donorName = donorFor(isDrums ? "drums" : info.chair, info.instr);
    // the drums get the real rack when one was handed in; otherwise the old
    // placeholder, which is a Drift under a track name asking to be replaced
    let t = renumber(isDrums && rack
      ? rackTemplate(rack, donor.nReturns || 2)
      : trackTemplate(donor, donorName), next);
    /* THE ROWS GROW ON THE TEMPLATE, NOT ONLY ON THE ASSEMBLED FILE
       (2026-08-31, fourth pass). growSlots ran at the end, on `out` — but
       putSessionClip writes into THIS `t`, which was cloned from the donor
       before that, so a twelfth box still found an eight-slot track and threw
       "track has no ClipSlot 8". The clone has to be long enough at the
       moment it is filled. growSlots is idempotent (a list already at or past
       the want is returned untouched), so the later pass over `out` still
       covers any donor track that survives into the file. */
    t = growSlots(t, boxes.length);
    t = t.replace(/^<MidiTrack Id="\d+"/, '<MidiTrack Id="' + (trackId++) + '"');
    /* THE PLACEHOLDER NAME RETIRES WHEN THE RACK ARRIVES. "DRUMS — load a
       Drum Rack" was an exporter asking a person to finish its job, and it was
       honest while the drums lane cloned a Drift. With the real rack spliced
       there is nothing to load, so the column is named like every other one:
       for what it does. The old name stays reachable for a caller with no rack
       to give, because the request it makes is still true in that case. */
    const label = isDrums && !rack ? DRUM_TRACK_NAME : colName[laneName];
    t = t.replace(/<EffectiveName Value="[^"]*" \/>/, '<EffectiveName Value="' + esc(label) + '" />');
    t = t.replace(/<UserName Value="[^"]*" \/>/, '<UserName Value="' + esc(label) + '" />');
    /* ...AND ITS COLOUR, BEFORE ANY CLIP GOES IN. The track's own `<Color>` is
       the first one in the element — measured on every donor and on every
       export: it sits at offset ~510 where the `<DeviceChain>` starts at ~1140
       — so the first-match replace is the track's and never a device's or a
       clip's, and doing it here rather than after the splice keeps it that
       way. See colorFor above for where the six numbers come from. */
    const color = colorFor(isDrums ? "drums" : info.chair, info.instr);
    t = t.replace(/<Color Value="[^"]*" \/>/, '<Color Value="' + color + '" />');

    const arrangement = [];
    views.forEach((v, bi) => {
      const box = v.box;
      const lane = box.lanes.find((l) => l.name === laneName);
      if (!lane || !lane.notes.length) return;
      const clipName = clipNameOf(box, colName[laneName]);
      const laneNotes = v.notes(lane.notes);
      const session = midiClip(tpl, { name: clipName, beats: v.beats, time: 0,
                                      notes: laneNotes, id: clipId++, sig, color });
      t = putSessionClip(t, bi, session);
      arrangement.push(midiClip(tpl, { name: clipName, beats: v.beats,
                                       time: v.beat0, notes: laneNotes,
                                       id: clipId++, arrangement: true, sig, color }));
      notes.push(clipName + ": " + lane.notes.length + " notes over " + v.beats + " beats");
    });
    t = putArrangementClips(t, arrangement);

    /* ---- P3a: THE CHAIR'S TONE ONTO THE DONOR INSTRUMENT ---------------
       Paul, 2026-08-31, of the round before this one: "you're choosing
       instruments but just giving them default settings." donorFor() answered
       the first half a fortnight ago — four machines picked by synthesis
       method — and this is the second half. The instrument is found by TAG
       inside this track (not by which donor track it came from), so the drum
       rack falls through with an empty table rather than needing a special
       case, and a later change to donorFor cannot desynchronise the two. */
    if (!isDrums && (info.tone || info.syn)) {
      const tag = instrumentTagOf(t);
      const dev = tag ? deviceOf(t, tag) : null;
      if (dev) {
        const r = setInstrument(dev, tag, info.tone, info.syn);
        if (r.set) {
          const at = t.indexOf(dev);
          t = t.slice(0, at) + r.xml + t.slice(at + dev.length);
          sound.params += r.set;
          sound.notes.push(colName[laneName] + ": " + r.set + " " + tag + " params");
        }
      }
    }

    /* ---- P3c: THE BOX'S EFFECTS AS DEVICES ----------------------------
       The chips go on AFTER the instrument and BEFORE the motion filter and
       the EQ, which is the order a person builds a channel in: the character,
       then the movement, then the corrective EQ last. Every device is
       renumbered on the way in for the reason the EQ already is — five tracks
       carrying one donor device would be five copies of the same pointee ids,
       which is what gate 0 exists to catch.

       THE DRUMS TAKE ALL OF THEM BUT THREE, and that is the engine's own rule
       rather than taste: audio/desk.js hands a drum unit `kitless(asked)`,
       which drops `wah`, `fenv` and the filter sweep and passes everything
       else through. Paul wrote that rule this morning — "the reason the funk
       drums are low is the auto-wah is on them" — and a chorus or a tape echo
       across a kit is a real section treatment, so the export quotes the
       filter rather than inventing a stricter one of its own. */
    const fxWet = [];                       // [{ chip, wetPath, targetId }]
    for (const chip of chips) {
      if (isDrums && !kitTakes(chip)) continue;
      const built = buildFx(lib, chip, chipParams(chip), fxCtx);
      if (built.unmapped || built.missing) {
        const why = built.unmapped || ("the donor library has no " + built.missing);
        if (!sawUnmapped.has(chip)) { sawUnmapped.add(chip); sound.unmapped.push(chip + " — " + why); }
        continue;
      }
      const dev = renumber(built.xml, next);
      const wetPath = wetPathOf(built.device);
      const targetId = wetPath ? targetIdOf(dev, wetPath) : null;
      t = addDevice(t, dev);
      sound.devices++;
      if (targetId != null) fxWet.push({ chip, wetPath, targetId, dev });
      /* ...AND THE STAGES THAT CARRY NO KNOB. `crunch` is an Amp AND the
         speaker behind it: engine/faust/dsp/insert_higain.dsp's step 4 is a
         FIXED 4x12 cab with nothing the chip can say to it, so the Cabinet is
         spliced at the patch Live saved and nothing is written into it. It
         rides no wet envelope of its own — the Amp's DryWet is the chip's mix,
         and a cabinet behind a bypassed amp is a bypassed cabinet. */
      for (const ex of built.extra || []) {
        t = addDevice(t, renumber(ex.xml, next));
        sound.devices++;
        if (!sawUnmapped.has(chip + "+")) {
          sawUnmapped.add(chip + "+");
          sound.notes.push(chip + " -> " + built.device + " + " + ex.device +
            " (the DSP's own fixed stage; nothing written into it)");
        }
      }
      if (built.nearest && !sawUnmapped.has(chip + "~")) {
        sawUnmapped.add(chip + "~");
        sound.notes.push(chip + " -> " + built.device + " (" + built.nearest + ")");
      }
      if (built.synced != null && !sawUnmapped.has(chip + "#")) {
        sawUnmapped.add(chip + "#");
        sound.notes.push(chip + " -> " + built.device + " SYNCED (DelayLine_Sync on, " +
          "SyncedSixteenth " + built.synced + " = the button \"" +
          delaySixteenthsAt(built.synced) + "\" = " + delaySixteenthsAt(built.synced) +
          "/16 of the bar) — it follows Live's tempo");
      }
    }

    /* ---- P3b's carrier: ONE AutoFilter2 FOR THE COMPOSED FILTER MOTION --
       A `mot: open` / `mot: close` box and any hand-drawn `cutoff` lane is a
       lowpass walking across the section — in the engine it is the MASTER
       sweep (audio/desk.js deskSweeps), and per track the honest Live home is
       an AutoFilter of its own. It is deliberately NOT the instrument's own
       filter: that one is carrying the chair's tone.cut, and an envelope on a
       parameter overrides its manual value rather than multiplying it, so the
       two would fight and the tone would lose. Two knobs, two jobs.
       Only spliced when some box actually draws the lane. */
    let motionTarget = null;
    if (!isDrums && anyCut && lib.AutoFilter2) {
      /* IT ARRIVES WIDE OPEN. The donor's AutoFilter2 sits at 9,999 Hz, which
         is a real lowpass and would dull every track the envelope did not
         reach — and "the envelope did not reach it" is one flat-lane guard
         away at all times. So the Manual is opened to the device's own
         ceiling first and the envelope moves it from there: if the automation
         vanished tomorrow this device would be inaudible rather than wrong,
         which is the only safe resting state for a filter nobody asked for. */
      const dev = renumber(setParam(lib.AutoFilter2, "Filter_Frequency", FILTER_OPEN), next);
      motionTarget = targetIdOf(dev, "Filter_Frequency");
      t = addDevice(t, dev);
      sound.devices++;
    }
    /* ---- AND THE `rise` SWEEP, ON A SECOND AutoFilter2 SET TO HIGHPASS ----
       Two filters because they are two gestures: `mot: open`/`close` walks a
       LOWPASS down from the top and `mot: rise` walks a HIGHPASS up from the
       bottom, and one device cannot be both at once — Filter_Type is a single
       enum, so a track that does both in different sections would have to
       automate the TYPE, which is a step change in a filter and sounds like a
       fault. Two devices, two envelopes, each resting where it is inaudible.

       IT ARRIVES AT ITS FLOOR, which for a highpass is the bottom of the band
       rather than the top — the same "safe resting state" argument the lowpass
       above makes, pointed the other way, and the floor is READ OFF THE
       DEVICE'S OWN MidiControllerRange rather than typed. */
    let riseTarget = null, riseFloor = 0;
    if (!isDrums && anyHpf && lib.AutoFilter2) {
      const r = paramRange(lib.AutoFilter2, "Filter_Frequency");
      riseFloor = r ? r.min : 20;
      let hp = setParam(lib.AutoFilter2, "Filter_Frequency", riseFloor);
      hp = setParam(hp, "Filter_Type", AF_HIGHPASS);
      hp = renumber(hp, next);
      riseTarget = targetIdOf(hp, "Filter_Frequency");
      t = addDevice(t, hp);
      sound.devices++;
    }
    /* THE EQ GOES ON AFTER THE INSTRUMENT and is renumbered like any other
       clone — five tracks carrying one donor device would otherwise be five
       copies of the same pointee ids, which is precisely what gate 0 exists to
       catch and what would silently point an automation lane at the wrong
       knob. */
    const chair = isDrums ? "drums" : (info.chair || "");
    if (eqTpl)
      t = addDevice(t, renumber(setEqBands(eqTpl, CHAIR_EQ[chair] || CHAIR_EQ[""]), next));
    // ...and the desk, last, so nothing above can overwrite it
    const vol = chairGain(chair, chairNth[laneName] || 0);
    t = setStrip(t, (boxes[0].lanes.find((l) => l.name === laneName) || {}).strip, vol);

    /* ---- P3b: THE ENVELOPES, WRITTEN LAST ------------------------------
       Last because every PointeeId here has to name an AutomationTarget that
       EXISTS IN THIS TRACK AS IT WILL SHIP. The ids inside a device were
       rewritten by `renumber` on the way in, so the id read off the renumbered
       device string above IS the final one; the mixer's own ids were rewritten
       when the track was cloned. als-gate.js gate P proves the whole class:
       every PointeeId in the finished document resolves, and a probe that
       breaks one is caught.

       Three envelopes, each present only when the record has something to say
       with it:
         · TRACK VOLUME — the section's `lvl` shade and any composed `level`
           lane (which is what `mot: pump` compiles to), multiplied onto the
           static gain the desk just wrote. The header's double-count law is
           satisfied by construction: the velocities in this file are the
           WRITTEN 0..9 and carry no desk gain at all.
         · THE MOTION FILTER — the `cutoff` lane, in Hz, straight through.
           A box that draws nothing holds the filter WIDE OPEN rather than
           wherever the last box left it; audio/desk.js makes exactly this
           argument about the same parameter and it is the same bug either
           way ("a `close` box … would leave every box after it dark").
         · EACH EFFECT'S WET — 0 through the boxes that did not ask for that
           chip, its own mix through the boxes that did. */
    const envs = [];
    let envId = 0;
    const strip = (boxes[0].lanes.find((l) => l.name === laneName) || {}).strip || {};
    const mix = elementAfter(t, "Mixer");
    const mixTarget = (path) => (mix ? targetIdOf(mix.text, path) : null);
    const sendTarget = (n) => {
      if (!mix) return null;
      const i = mix.text.indexOf('<TrackSendHolder Id="' + n + '">');
      if (i < 0) return null;
      const [a, b] = balancedAt(mix.text, i);
      return targetIdOf(mix.text.slice(a, b), "Send");
    };
    /**
     * One envelope, from one lane name, across every box.
     * `hold` and `map` are asked PER BOX, because the level lane's multiplier
     * (the section's own `lvl` shade) is a per-box number and nothing else in
     * the record is allowed to be a special case just for it.
     */
    const ride = (target, param, hold, map) => {
      if (target == null) return;
      const evs = stitchEnvelope(views.map((v) => ({
        beat0: v.beat0, beats: v.beats, lane: laneFor(v.box, param),
        hold: hold(v.box), map: map(v.box) })));
      /* A FLAT ENVELOPE IS NOT AN ENVELOPE — it is the Manual value with extra
         steps, and it is worse than nothing: Live shows the lane as automated,
         greys the knob, and a person who moves the fader finds it snapping
         back. So an envelope whose every event carries the same number is not
         written at all, which is also what keeps a record that draws no lanes
         byte-identical to yesterday's export. */
      if (new Set(evs.map((e) => e.value)).size < 2) return;
      envs.push(automationEnvelope(envId++, target, evs));
      sound.envelopes++;
    };
    if (!isDrums && anyLevel)
      ride(mixTarget("Volume"), "level", () => 1, (box) => {
        const g = vol * (LEVEL_GAIN[box.lvl] == null ? 1 : LEVEL_GAIN[box.lvl]);
        return (x) => clamp(g * x, SEND_FLOOR, 1.99526238);
      });
    /* THE OTHER THREE LANES A BOX CAN DRAW, and they land on Live's own mixer
       because that is where they land in the engine too: audio/desk.js routes
       `pan` / `send.rev` / `send.echo` to "per-BAR values on the unit". Every
       range lines up without a conversion — fields.js AUTOPARAMS says pan is
       ±0.8 against Live's ±1, and both sends are 0.001..0.7 against Live's
       0..1 — so these are the most exact three translations in the whole
       round. A box that draws none holds the static strip value the desk just
       wrote, which is what "absent is unity" means one layer up. */
    if (!isDrums) {
      const panHold = strip.pan == null ? 0 : strip.pan;
      const revHold = strip.rev == null ? SEND_FLOOR : clamp(strip.rev, SEND_FLOOR, 1);
      const delHold = strip.del == null ? SEND_FLOOR : clamp(strip.del, SEND_FLOOR, 1);
      const toPan = () => (x) => clamp(x, -1, 1);
      const toSend = () => (x) => clamp(x, SEND_FLOOR, 1);
      ride(mixTarget("Pan"), "pan", () => panHold, toPan);
      ride(sendTarget(0), "send.rev", () => revHold, toSend);
      ride(sendTarget(1), "send.echo", () => delHold, toSend);
    }
    if (motionTarget != null)
      ride(motionTarget, "cutoff", () => FILTER_OPEN, () => (x) => clamp(x, 20, FILTER_OPEN));
    if (riseTarget != null)
      ride(riseTarget, "hpf", () => riseFloor, () => (x) => clamp(x, riseFloor, FILTER_OPEN));
    for (const w of fxWet) {
      // a chip every box asks for is a constant, and a constant is the Manual
      // value the device already carries — `ride`'s flat-envelope guard would
      // drop it anyway; this reads the wet off the device rather than the table
      const wet = +getParam(w.dev, w.wetPath);
      if (!isFinite(wet)) continue;
      const evs = stitchEnvelope(views.map((v) => ({
        beat0: v.beat0, beats: v.beats, lane: null,
        hold: (v.box.fx || []).includes(w.chip) ? wet : 0 })));
      if (new Set(evs.map((e) => e.value)).size < 2) continue;
      envs.push(automationEnvelope(envId++, w.targetId, evs));
      sound.envelopes++;
    }
    t = putEnvelopes(t, envs);
    return t;
  });

  let out = donorXml;
  out = setTempo(out, score.bpm);
  /* THE TEMPO MAP (2026-08-30, the five-walls follow-up). The donor DOES hold
     the shape, measured rather than remembered: the MainTrack carries
     `<AutomationEnvelope><EnvelopeTarget><PointeeId Value="8"/>` — the Tempo
     element's own AutomationTarget — with a `<FloatEvent Id Time Value/>`
     inside (Generic.xml:21613-21626, Ableton2.xml:91210-91223, both written
     by Live itself; Ableton2 also shows a THREE-event FloatEvent list at real
     times, Ableton2.xml:82095-82097). So a paced record writes its map as
     more FloatEvents in that envelope — same tag, same attribute set, Gate 2
     green by construction — and the scenes say it too: every donor scene
     already carries `<Tempo Value/><IsTempoEnabled Value/>`, so scene i of a
     paced box gets its own launch tempo, values only, no new element. */
  const tempoSegs = [];
  {
    let cur = null;
    for (const v of views) {
      const b = Math.max(1, +score.bpm || 120) / v.k;
      if (cur == null || b !== cur) { tempoSegs.push({ at: v.beat0, bpm: b }); cur = b; }
    }
  }
  const hasMap = tempoSegs.length > 1 ||
    (tempoSegs.length === 1 && views.length && views[0].k !== 1);
  if (hasMap) out = spliceTempoMap(out, tempoSegs);
  // GROW THE SCENE LIST FIRST — nameScenes walks the Scenes it finds, so a
  // clone that arrives after it would ship unnamed (2026-08-31).
  if (all) { out = growScenes(out, boxes.length); out = growSlots(out, boxes.length); }
  if (all) out = nameScenes(out, boxes.map((b) => b.name));
  if (all && hasMap)
    out = setSceneTempos(out, views.map((v) =>
      (v.k !== 1 ? Math.max(1, +score.bpm || 120) / v.k : null)));
  /* THE CLONES GO IN BEFORE THE FIRST RETURN, NOT AT THE END OF THE LIST.
     Live, opening a file whose tracks sat after the returns: "Track has more
     send knobs than set has return tracks" (2026-08-31, Paul's first report
     from inside Live itself). The counts were never wrong — two sends per
     track, two returns, in the export exactly as in the donor. The ORDER was:
     every .als Live writes puts ReturnTracks last in <Tracks>, and a track
     after them is read with the return list already closed, so its two send
     knobs point at nothing. Shape gates cannot see this — every element here
     was written by Live — which is why gate 2 passed a file Live refused.
     Donor tracks keep their places; ours land after the last of them and
     before A-Reverb, where a track Live added itself would go. */
  const tracksEl = elementAfter(out, "Tracks");
  const firstRet = out.indexOf("<ReturnTrack ", tracksEl.start);
  const at = (firstRet !== -1 && firstRet < tracksEl.end)
    ? out.lastIndexOf("\n", firstRet) + 1
    : tracksEl.end - "</Tracks>".length;
  out = out.slice(0, at) + trackXml.join("") + out.slice(at);
  out = dropDonorTracks(out);
  /* ---- THE MASTER CHAIN ONTO THE MAIN TRACK (2026-09-03, the Answers round)
     Last, and after the donor tracks are gone, so the ids it takes are above
     everything the clones took and `NextPointeeId` below still covers them.
     Three of the devices come out of the THIRD donor (masterrack.js, Paul's
     Answers.als) because neither of the first two had a single device on its
     MainTrack — which is why `main:docs/ABLETON-EXPORT.md`'s master row has
     shipped as nothing since the spec was written. The other two are out of
     GENERIC and always were: `width` on Live's Utility (the `<StereoGain>` tag,
     0..4 side gain) and `tilt` on an Eq8 shelf pair, both reported homeless for
     a fortnight on a claim that turned out to be a search for the wrong word.
     Renumbered like every other spliced device, for gate 0's reason. */
  const mstr = masterDevices(lib, score.master);
  if (mstr.devices.length) {
    out = spliceMaster(out, mstr.devices.map((d) => renumber(d.xml, next)));
    for (const d of mstr.devices) { sound.devices++; sound.params += d.set; }
  }
  sound.master = mstr.devices.map((d) => d.note);
  for (const u of mstr.unmapped) sound.unmapped.push(u);
  out = out.replace(/<NextPointeeId Value="\d+" \/>/, '<NextPointeeId Value="' + nextId + '" />');
  // `sound` is P3's own printout: how many instrument knobs were set, how many
  // automation envelopes were written and how many devices were spliced, plus
  // every chip that had no honest device to land on. A run that reports zeroes
  // is telling you the record composed no automation, which is different from
  // a run that reports nothing at all — and it is what als-gate.js gate E
  // checks its own counts against.
  return { xml: out, tracks: laneNames.length, clips: clipId - 1, notes, sound };
}

const laneInfoOf = (boxes, laneName) => {
  for (const b of boxes) for (const l of b.lanes)
    if (l.name === laneName) return { chair: l.chair || "", instr: l.instr || "",
                                      tone: l.tone || null, syn: l.syn || null };
  return { chair: "", instr: "", tone: null, syn: null };
};

/** The one `<Tempo>` element in the document (Generic.xml:21819). */
export function setTempo(xml, bpm) {
  const t = /<Tempo>/.exec(xml);
  if (!t) throw new Error("donor has no <Tempo> element");
  const [a, b] = balancedAt(xml, t.index);
  const body = xml.slice(a, b).replace(/<Manual Value="[^"]*" \/>/,
    '<Manual Value="' + num(bpm) + '" />');
  return xml.slice(0, a) + body + xml.slice(b);
}

/**
 * The MainTrack's tempo AUTOMATION envelope takes the record's map.
 *
 * WHERE IT LIVES, read off the donor and not off a spec: `<Tempo>` carries
 * `<AutomationTarget Id="8">`, and the MainTrack's `<AutomationEnvelopes>`
 * holds an `<AutomationEnvelope>` whose `<EnvelopeTarget><PointeeId Value="8"/>`
 * points back at it, with one `<FloatEvent Id="0" Time="-63072000"
 * Value="120"/>` inside — Live's own initial event, its sentinel Time meaning
 * "before the beginning". Both donors carry it; the id is READ, not assumed.
 *
 * THE STEP ENCODING IS THE ONE INFERRED THING HERE, and it is flagged the way
 * donor/README.md flags ReceivingNote's constant: automation between two
 * FloatEvents is a linear ramp, so a section-sized STEP (a pace is a ladder,
 * not a lean — audio/plan.js) is written as TWO events on the boundary tick,
 * the old value then the new, which is the double-point spelling step
 * automation is known to take in this schema. No donor holds a multi-point
 * TEMPO lane yet (Ableton2's three-event FloatEvent list is a device lane);
 * the 30-second ask in donor/README.md turns this from inference to ground
 * truth the day it lands.
 *
 * segs: [{ at, bpm }] — beat where a tempo takes effect, first at the top.
 */
export function spliceTempoMap(xml, segs) {
  if (!segs || !segs.length) return xml;
  const t = /<Tempo>/.exec(xml);
  if (!t) throw new Error("donor has no <Tempo> element");
  const [a, b] = balancedAt(xml, t.index);
  const idM = /<AutomationTarget Id="(\d+)"/.exec(xml.slice(a, b));
  if (!idM) throw new Error("donor <Tempo> has no AutomationTarget");
  // the envelope whose PointeeId is the Tempo's target — walk the envelopes
  const re = /<AutomationEnvelope Id="\d+">/g;
  let m, found = null;
  while ((m = re.exec(xml))) {
    const [ea, eb] = balancedAt(xml, m.index);
    const one = xml.slice(ea, eb);
    if (new RegExp('<PointeeId Value="' + idM[1] + '" />').test(one)) { found = [ea, eb, one]; break; }
    re.lastIndex = eb;
  }
  if (!found) throw new Error("donor has no tempo AutomationEnvelope (PointeeId " + idM[1] + ")");
  const [ea, eb, env] = found;
  let id = 0;
  const evs = ['<FloatEvent Id="' + (id++) + '" Time="-63072000" Value="' + num(segs[0].bpm) + '" />'];
  for (let i = 1; i < segs.length; i++) {
    evs.push('<FloatEvent Id="' + (id++) + '" Time="' + num(segs[i].at) + '" Value="' + num(segs[i - 1].bpm) + '" />');
    evs.push('<FloatEvent Id="' + (id++) + '" Time="' + num(segs[i].at) + '" Value="' + num(segs[i].bpm) + '" />');
  }
  const ev = elementAfter(env, "Events");
  if (!ev) throw new Error("tempo envelope has no <Events>");
  const body = env.slice(0, ev.start) + "<Events>" + evs.join("") + "</Events>" + env.slice(ev.end);
  return xml.slice(0, ea) + body + xml.slice(eb);
}

/**
 * Scene i takes its box's launch tempo — values only, on elements every donor
 * scene already carries (`<Tempo Value="120"/><IsTempoEnabled Value="false"/>`).
 * `tempos[i] = null` leaves scene i byte-identical; a number writes it and
 * flips the enable, so launching a paced box's scene in Session view runs at
 * the box's own clock.
 */
/* GROW THE SCENE LIST BY CLONING ONE OF LIVE'S OWN (2026-08-31).
   Paul, on a twelve-box song: "the splice failed... can't you splice".
   He is right and the refusal was over-cautious. It read "cloning a scene is
   a guess", and the donors say otherwise on both halves:
     · A <Scene> IS SELF-CONTAINED. Measured on Generic.als, scene 3 entire:
       a FollowAction block, Name "", Annotation "", Color -1, Tempo 120,
       IsTempoEnabled false, TimeSignatureId, IsTimeSignatureEnabled false,
       LomId 0, ClipSlotsListWrapper. Nothing in it indexes a track, names a
       clip, or points anywhere. The only thing that distinguishes one from
       the next is its `Id`.
     · THE SLOTS ARE ALREADY THERE. Every MidiTrack in both donors carries
       SIXTEEN ClipSlots against EIGHT Scenes — Live wrote the rows to hold
       twice what the scene list declares. Cloning up to that count is not
       inventing a shape; it is filling a table Live already sized.
   So the fence moves from 8 to nSlots and stays a real fence: past the slot
   count a clone WOULD be a guess, because the slot rows do not exist and
   fabricating those means writing ClipSlot elements per track in an order
   nothing observed. That refusal keeps its old words.
   Ids are taken above the donor's own maximum and the pointee renumber pass
   runs after, so gate 0's duplicate probe covers this exactly as it covers
   every other spliced element. */
/* AND THE ROWS TO HOLD THEM (2026-08-31, the same day and the same hour the
   scene clone shipped and failed). Cloning scenes without cloning slots is
   precisely the broken set the original refusal predicted — Paul got "track
   has no ClipSlot 8" one message after "can't you splice", and he was owed
   both halves. A ClipSlot is as self-contained as a Scene (an id, a LomId, an
   empty Value, HasStop, NeedRefreeze) and BOTH of a track's lists are
   scene-indexed, so both grow: the MainSequencer's grid is where a clip
   lands, and the FreezeSequencer's mirror must stay the same length or the
   two disagree about how many rows the track has. Ids continue the list's own
   sequence (0..7 -> 0..11), which is what Live's own numbering does — unlike
   Scenes, these ids are POSITIONAL and start from zero in each list. */
export function growSlots(xml, want) {
  let out = "", cursor = 0;
  const re = /<ClipSlotList>([\s\S]*?)<\/ClipSlotList>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const ids = [...body.matchAll(/<ClipSlot Id="(\d+)">/g)].map((x) => +x[1]);
    out += xml.slice(cursor, m.index);
    if (!ids.length || ids.length >= want) { out += m[0]; cursor = m.index + m[0].length; continue; }
    /* BALANCED, NOT NON-GREEDY — the first cut of this used
       /<ClipSlot Id="\d+">[\s\S]*?<\/ClipSlot>/ and it copied HALF an
       element: an empty session slot NESTS a second <ClipSlot> inside its
       own <Value>, so the lazy match closed on the inner tag. Measured: 104
       opens added against 52 closes. `balancedAt` is the file's own answer
       to exactly this and it is what putSessionClip already uses. */
    const at = body.search(/<ClipSlot Id="\d+">/);
    const [oa, ob] = balancedAt(body, at);
    const one = body.slice(oa, ob);
    let add = "", next = Math.max(...ids) + 1;
    for (let i = ids.length; i < want; i++)
      add += "\n\t\t\t\t\t\t" + one.replace(/^<ClipSlot Id="\d+">/,
        '<ClipSlot Id="' + (next++) + '">');
    out += "<ClipSlotList>" + body + add + "</ClipSlotList>";
    cursor = m.index + m[0].length;
  }
  return out + xml.slice(cursor);
}

export function growScenes(xml, want) {
  const scenes = elementAfter(xml, "Scenes");
  if (!scenes) return xml;
  const ids = [...scenes.text.matchAll(/<Scene Id="(\d+)"/g)].map((m) => +m[1]);
  if (!ids.length || ids.length >= want) return xml;
  const one = /<Scene Id="\d+"[\s\S]*?<\/Scene>/.exec(scenes.text);
  if (!one) return xml;
  let next = Math.max(...ids) + 1, add = "";
  for (let i = ids.length; i < want; i++)
    add += "\n\t\t\t" + one[0].replace(/^<Scene Id="\d+"/, '<Scene Id="' + (next++) + '"');
  const close = scenes.text.lastIndexOf("</Scene>") + "</Scene>".length;
  const grown = scenes.text.slice(0, close) + add + scenes.text.slice(close);
  return xml.slice(0, scenes.start) + grown + xml.slice(scenes.end);
}

export function setSceneTempos(xml, tempos) {
  const sc = elementAfter(xml, "Scenes");
  let body = sc.text, i = 0;
  const open = /<Scene Id="\d+">/g;
  let m, out = "", cursor = 0;
  while ((m = open.exec(body))) {
    const [a, b] = balancedAt(body, m.index);
    let one = body.slice(a, b);
    if (i < tempos.length && tempos[i] != null) {
      one = one.replace(/<Tempo Value="[^"]*" \/>/, '<Tempo Value="' + num(tempos[i]) + '" />');
      one = one.replace(/<IsTempoEnabled Value="[^"]*" \/>/, '<IsTempoEnabled Value="true" />');
    }
    out += body.slice(cursor, a) + one;
    cursor = b; open.lastIndex = b; i++;
  }
  out += body.slice(cursor);
  return xml.slice(0, sc.start) + out + xml.slice(sc.end);
}

/** Scene i takes box i's label. The donor's eight scenes are all `Name Value=""`. */
export function nameScenes(xml, labels) {
  const sc = elementAfter(xml, "Scenes");
  let body = sc.text, i = 0;
  const open = /<Scene Id="\d+">/g;
  let m, out = "";
  let cursor = 0;
  while ((m = open.exec(body))) {
    const [a, b] = balancedAt(body, m.index);
    let one = body.slice(a, b);
    if (i < labels.length)
      one = one.replace(/<Name Value="[^"]*" \/>/, '<Name Value="' + esc(labels[i]) + '" />');
    out += body.slice(cursor, a) + one;
    cursor = b; open.lastIndex = b; i++;
  }
  out += body.slice(cursor);
  return xml.slice(0, sc.start) + out + xml.slice(sc.end);
}

/** Put a clip into the n-th `<ClipSlot Id="n">` of a track. */
function putSessionClip(track, n, clip) {
  const re = /<ClipSlot Id="(\d+)">/g;
  let m;
  while ((m = re.exec(track))) {
    if (+m[1] !== n) continue;
    const [a, b] = balancedAt(track, m.index);
    const one = track.slice(a, b).replace(/<ClipSlot>\s*<Value \/>\s*<\/ClipSlot>/,
      "<ClipSlot><Value>" + clip + "</Value></ClipSlot>");
    return track.slice(0, a) + one + track.slice(b);
  }
  throw new Error("track has no ClipSlot " + n);
}

/** Fill the track's `<ClipTimeable><ArrangerAutomation><Events />`. */
function putArrangementClips(track, clips) {
  if (!clips.length) return track;
  const re = /<ClipTimeable>\s*<ArrangerAutomation>\s*<Events \/>/;
  if (!re.test(track)) throw new Error("track has no empty arrangement Events");
  return track.replace(re, "<ClipTimeable><ArrangerAutomation><Events>" +
    clips.join("") + "</Events>");
}

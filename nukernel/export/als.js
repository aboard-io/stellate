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
// VELOCITY, AND THE MIGRATION P3 MUST NOT FORGET. P0 reads plan.timeline(),
// whose events carry the WRITTEN velocity 0..9, so vel is the composer's mark
// and nothing else. P1+ read plan.barPlan(), whose `amp` is
// pitchAmp(vel,acc) x the desk's automation gain (plan.js:520-527,
// to-engine.js:97-99) and is therefore the HEARD loudness with the fader
// already in it. The day P3 writes real volume envelopes, velocity must go back
// to the written value or the fader ride is counted twice; the one-line move is
// exposing the pre-desk bar out of plan.js (`export const rawBar = (n) =>
// BARS[n]`). Written here because a comment in the gate would be read too late.

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
  const nSlots = drift ? (xml.slice(drift.start, drift.end).match(/<ClipSlot Id="\d+"/g) || []).length : 0;
  return { xml, nextPointeeId: np ? +np[1] : 0, tracks, nScenes, nSlots };
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
export function midiClip(tpl, { name, beats, time = 0, notes, id = 0, arrangement = false }) {
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
  // The template is the GROOVE pool's clip and it names its own groove
  // (GrooveId 4). A copy of it on a track would inherit Live's swing on top of
  // the swing nukernel has already baked into the note offsets — the same
  // groove counted twice. -1 is "no groove", which is what every ordinary clip
  // in a fresh set carries.
  x = x.replace(/<GrooveId Value="[^"]*" \/>/, '<GrooveId Value="-1" />');
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
export function alsFromScore(donorXml, score, opts = {}) {
  const all = !!opts.all;
  const donor = parseDonor(donorXml);
  const tpl = clipTemplate(donor);
  const notes = [];                                   // what the run did, for the CLI to print

  const boxes = all ? score.boxes : score.boxes.slice(0, 1);
  if (all && boxes.length > donor.nScenes)
    throw new Error("song has " + boxes.length + " boxes and the donor has " +
      donor.nScenes + " scenes. Refusing: cloning a scene is a guess, and a " +
      "wrong guess here opens as a broken set. Save a donor with more scenes.");
  if (boxes.length > donor.nSlots)
    throw new Error("song has " + boxes.length + " boxes and the donor track " +
      "has " + donor.nSlots + " clip slots.");

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

  const trackXml = laneNames.map((laneName) => {
    const info = laneInfoOf(boxes, laneName);
    const isDrums = laneName === "drums";
    const donorName = DONOR_TRACK[isDrums ? "drums" : info.chair] || DONOR_TRACK[""];
    let t = renumber(trackTemplate(donor, donorName), next);
    t = t.replace(/^<MidiTrack Id="\d+"/, '<MidiTrack Id="' + (trackId++) + '"');
    // `v0 electric_piano` when the engine was warmed and there is a cast to
    // ask; `v0 stab` when there is not. Either way the seat number leads, so
    // the track list reads in the order the score does.
    const label = isDrums ? DRUM_TRACK_NAME
                : laneName + " " + (info.instr || info.chair || "");
    t = t.replace(/<EffectiveName Value="[^"]*" \/>/, '<EffectiveName Value="' + esc(label) + '" />');
    t = t.replace(/<UserName Value="[^"]*" \/>/, '<UserName Value="' + esc(label) + '" />');

    const arrangement = [];
    boxes.forEach((box, bi) => {
      const lane = box.lanes.find((l) => l.name === laneName);
      if (!lane || !lane.notes.length) return;
      const clipName = box.name + " · " + laneName;
      const session = midiClip(tpl, { name: clipName, beats: box.beats, time: 0,
                                      notes: lane.notes, id: clipId++ });
      t = putSessionClip(t, bi, session);
      arrangement.push(midiClip(tpl, { name: clipName, beats: box.beats,
                                       time: box.beat0, notes: lane.notes,
                                       id: clipId++, arrangement: true }));
      notes.push(clipName + ": " + lane.notes.length + " notes over " + box.beats + " beats");
    });
    t = putArrangementClips(t, arrangement);
    return t;
  });

  let out = donorXml;
  out = setTempo(out, score.bpm);
  if (all) out = nameScenes(out, boxes.map((b) => b.name));
  // The clones go in before </Tracks>, after every donor track, so Live's own
  // six stay where Paul left them.
  const tracksEl = elementAfter(out, "Tracks");
  out = out.slice(0, tracksEl.end - "</Tracks>".length) + trackXml.join("") +
        out.slice(tracksEl.end - "</Tracks>".length);
  out = out.replace(/<NextPointeeId Value="\d+" \/>/, '<NextPointeeId Value="' + nextId + '" />');
  return { xml: out, tracks: laneNames.length, clips: clipId - 1, notes };
}

const laneInfoOf = (boxes, laneName) => {
  for (const b of boxes) for (const l of b.lanes)
    if (l.name === laneName) return { chair: l.chair || "", instr: l.instr || "" };
  return { chair: "", instr: "" };
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

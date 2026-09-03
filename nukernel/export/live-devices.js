// nukernel/export/live-devices.js — P3: THE SOUND, NOT JUST THE NOTES.
//
// Paul, 2026-09-03: "the midi shifts aren't showing up in ableton, like the
// envelope settings that would tweak the sound and filters and so forth. work
// on that for a while. it makes the mix so unexpressive … think about adding
// in more effects too i added plenty in the donor file."
//
// He is describing exactly what als.js's own header promised and deferred:
// "THE RIDE IS DROPPED … Automation envelopes are P3." Until this file, an
// exported track was a donor instrument at its FACTORY PATCH with a mixer
// setting and an EQ on it — every genre's `tone` (cut/q/atk/rel/glide), every
// signature `synth` block, every composed `mot`/`auto` lane and every `fx`
// chip stayed on this side of the wall. Three whole layers of the record's
// sound arrived as nothing. This file is the three of them.
//
// ================== THE ONE LAW THIS FILE OBEYS ===========================
// EVERY NUMBER IS READ OFF THE DONOR, NEVER REMEMBERED. A Live parameter
// carries its own range in the file — `<MidiControllerRange><Min/><Max/>` sits
// inside all but a handful of them — so `setParam` READS that range and clamps
// to it rather than trusting a table in this file to be right about what a
// device's units are. That is the same discipline donor/README.md applies to
// the sample grammar, and it is what makes a mapping here a translation rather
// than a guess. Where a parameter has no printed range or no printed units,
// this file either leaves it alone or says out loud that it is inferring —
// there are exactly THREE inferences below and each is flagged in place.
//
// And the standing law above that one, als-gate.js Gate 2: every element this
// emits must already exist in a donor. Nothing here writes an element. It sets
// `Value` attributes inside device subtrees Live itself wrote, and the one
// structure it does assemble — an `<AutomationEnvelope>` — is copied in shape
// from the MainTrack envelope BOTH donors carry (Generic.xml:21597-21628).
//
// ================== WHAT THE THREE LAYERS ARE =============================
//   P3a  the CHAIR'S TONE     `tone` {cut, q, atk, rel, gain, verb} and the
//                             genre's signature `synth` {dsp, set{…}} onto the
//                             donor instrument's own filter and envelope.
//                             421 of 421 genres carry a tone block, so this
//                             reaches every record there is.
//   P3b  the SECTION'S RIDE   the composed `mot`/`auto` lanes and the `lvl`
//                             shade as real `<AutomationEnvelope>`s in the
//                             Arrangement — the track volume and a motion
//                             filter, in song beats.
//   P3c  the BOX'S EFFECTS    the `fx` chips (fields.js FX) as Live devices
//                             spliced out of the donors' own chains, with
//                             their knobs set from the chip's parameters.
//
// ================== THE VELOCITY LAW, SETTLED =============================
// als.js's header has carried this warning since P0: "The day P3 writes real
// volume envelopes, velocity must go back to the written value or the fader
// ride is counted twice." IT NEVER MOVED — export/score.js still folds
// `plan.timeline()`, whose `vel` is the composer's written 0..9 and has no
// desk gain in it at all (plan.js barPlan's `amp` is the multiplied one and
// this exporter has never read it). So the volume envelope written here is the
// FIRST time the desk's ride reaches the file, and it is not a double count.
// The one-line migration that warning asked for is not needed and the warning
// retires with this sentence.
import { balancedAt, elementAfter } from "./als.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const num = (x) => String(x);

/* ================== THE PARAMETER GRAMMAR ==============================
   A Live device is a flat-ish tree of parameter elements, each of them:

       <Filter_Frequency>
         <LomId Value="0" />
         <Manual Value="19999.9961" />
         <MidiControllerRange><Min Value="19.9999981" /><Max Value="19999.9961" /></MidiControllerRange>
         <AutomationTarget Id="22194"><LockEnvelope Value="0" /></AutomationTarget>
         <ModulationTarget Id="22195"><LockEnvelope Value="0" /></ModulationTarget>
       </Filter_Frequency>

   — and that is the whole vocabulary this file needs: `Manual` is the knob,
   `MidiControllerRange` is the honest range, `AutomationTarget Id` is what an
   envelope points at. Some devices nest (Operator's `Filter/Frequency`,
   `Operator.0/Envelope/AttackTime`), so a path is slash-separated and walked
   one balanced element at a time. Some parameters are plain flags with no
   Manual at all (`<PortamentoOn Value="false" />`); `setFlag` is for those. */

/** [start,end) of the element at `path` ("A/B/C") inside `xml`, or null. */
export function paramAt(xml, path) {
  let lo = 0, hi = xml.length, found = null;
  // The lookahead is what keeps `Filter` off `Filter_Frequency` and
  // `FilterToggle`, and `AutomationEnvelopes` off `AutomationEnvelopesListWrapper`
  // — a prefix match here would set the wrong knob and say nothing about it.
  for (const seg of String(path).split("/")) {
    const re = new RegExp("<" + seg.replace(/\./g, "\\.") + "(?=[\\s/>])", "g");
    re.lastIndex = lo;
    const m = re.exec(xml);
    if (!m || m.index >= hi) return null;
    const [a, b] = balancedAt(xml, m.index);
    found = [a, b];
    lo = xml.indexOf(">", a) + 1;   // step INSIDE, so the next segment is a child
    hi = b;
  }
  return found;
}

/** The `<Manual Value>` of the parameter at `path`, as a string, or null. */
export function getParam(xml, path) {
  const at = paramAt(xml, path);
  if (!at) return null;
  const m = /<Manual Value="([^"]*)"/.exec(xml.slice(at[0], at[1]));
  return m ? m[1] : null;
}

/** {min,max} for the parameter at `path`, READ OFF THE FILE, or null. */
export function paramRange(xml, path) {
  const at = paramAt(xml, path);
  if (!at) return null;
  const m = /<MidiControllerRange>\s*<Min Value="([^"]*)" \/>\s*<Max Value="([^"]*)" \/>/
    .exec(xml.slice(at[0], at[1]));
  return m ? { min: +m[1], max: +m[2] } : null;
}

/**
 * Set the knob at `path`, CLAMPED TO THE RANGE THE FILE PRINTS.
 *
 * Absent parameter, absent Manual, or a value that is not a finite number:
 * returns the xml unchanged. That is deliberate and it is not silence — the
 * caller counts what it set (`setMany` below returns the count) and
 * als-gate.js's gate E fails a track that set nothing, so a path typo shows up
 * as a red gate rather than as a quietly default patch.
 */
export function setParam(xml, path, value) {
  if (value == null || !isFinite(value)) return xml;
  const at = paramAt(xml, path);
  if (!at) return xml;
  const one = xml.slice(at[0], at[1]);
  const j = one.indexOf("<Manual Value=");
  if (j < 0) return xml;
  const r = paramRange(xml, path);
  const v = r ? clamp(value, r.min, r.max) : value;
  const k = one.indexOf("/>", j) + 2;
  return xml.slice(0, at[0]) + one.slice(0, j) + '<Manual Value="' + num(v) + '" />' +
         one.slice(k) + xml.slice(at[1]);
}

/**
 * Set a switch (PortamentoOn, Stage2_On, Filter_On, DelayLine_SyncL…).
 *
 * A LIVE SWITCH IS A PARAMETER, NOT AN ATTRIBUTE, and that was worth measuring
 * rather than assuming: `<PortamentoOn><LomId/><Manual Value="false"/>
 * <AutomationTarget Id=…/><MidiCCOnOffThresholds><Min Value="64"/>
 * <Max Value="127"/></MidiCCOnOffThresholds></PortamentoOn>`. It is exactly a
 * float parameter with an on/off threshold instead of a range — which is also
 * why a switch can be automated, and why `MidiControllerRange` is absent on
 * every one of them (so `setParam` would write true/false unclamped and
 * `paramRange` correctly answers null). The plain `<Tag Value="…" />` form does
 * exist elsewhere in the schema (`<EnabledByUser Value="true" />`), so the
 * fallback below covers it rather than pretending it does not.
 */
export function setFlag(xml, path, on) {
  const at = paramAt(xml, path);
  const word = on ? "true" : "false";
  if (at) {
    const one = xml.slice(at[0], at[1]);
    const j = one.indexOf("<Manual Value=");
    if (j >= 0) {
      const k = one.indexOf("/>", j) + 2;
      return xml.slice(0, at[0]) + one.slice(0, j) + '<Manual Value="' + word + '" />' +
             one.slice(k) + xml.slice(at[1]);
    }
  }
  const leaf = String(path).split("/").pop().replace(/\./g, "\\.");
  const re = new RegExp("<" + leaf + ' Value="[^"]*" />');
  const m = re.exec(xml);
  if (!m) return xml;
  return xml.slice(0, m.index) + m[0].replace(/Value="[^"]*"/, 'Value="' + word + '"') +
         xml.slice(m.index + m[0].length);
}

/** The `<AutomationTarget Id>` of the parameter at `path` — what an envelope points at. */
export function targetIdOf(xml, path) {
  const at = paramAt(xml, path);
  if (!at) return null;
  const m = /<AutomationTarget Id="(\d+)"/.exec(xml.slice(at[0], at[1]));
  return m ? +m[1] : null;
}

/** Apply a `{path: value}` table; returns `{xml, set}` — set is how many landed. */
export function setMany(xml, table) {
  let out = xml, set = 0;
  for (const [path, v] of Object.entries(table)) {
    if (v == null || !isFinite(v)) continue;
    const next = setParam(out, path, v);
    if (next !== out) { out = next; set++; }
  }
  return { xml: out, set };
}

/* ================== THE DEVICE LIBRARY ================================== */

/** Lift the first `<Tag …>…</Tag>` device out of a document. */
export function deviceOf(xml, tag, from = 0) {
  const i = xml.indexOf("<" + tag + " Id=", from);
  if (i < 0) return null;
  const [a, b] = balancedAt(xml, i);
  return xml.slice(a, b);
}

/**
 * Every device this file can splice, keyed by tag.
 *
 * `donorXml` is Generic (the splice base, in the module graph via donor.js) and
 * `fxRackXml` is the six devices Ableton2 has that Generic does not
 * (fxrack.js, extracted by fxrack-extract.js). Both are optional: a caller
 * with no fx rack gets the Generic five and every chip that needs one of the
 * other six is reported as unmapped instead of faked.
 */
export function deviceLibrary(donorXml, fxRackXml = "") {
  const lib = {};
  // Generic's `1-MIDI` carries AutoFilter2, Eq8, Roar, StereoGain, Vocoder;
  // its returns carry Reverb and Delay. Taken from the whole document because
  // there is exactly one of each and Live wrote them all.
  for (const tag of ["AutoFilter2", "Roar", "StereoGain", "Vocoder", "Reverb", "Delay"]) {
    const d = deviceOf(donorXml, tag);
    if (d) lib[tag] = d;
  }
  /* ...and Paul's own chain, concatenated in fxrack.js in the donor's order
     and split apart here by walking balanced elements — no byte offsets are
     remembered anywhere.

     THE RACK WINS WHERE BOTH HAVE A DEVICE, and today that is exactly one:
     `Delay`. Generic's is the one on return B and it carries a stranger's
     home directory in its `LastPresetRef` (Gate 3 prints that path on every
     run); Ableton2's has no `<Path>` in it at all. Assigning after the
     Generic loop is what makes the clean one win, and it is deliberate rather
     than incidental — see fxrack-extract.js WANT for the measurement. */
  let p = 0;
  while (p < fxRackXml.length) {
    const m = /<([A-Za-z0-9._]+) Id="\d+"/.exec(fxRackXml.slice(p));
    if (!m) break;
    const i = p + m.index;
    const [a, b] = balancedAt(fxRackXml, i);
    lib[m[1]] = fxRackXml.slice(a, b);
    p = b;
  }
  return lib;
}

/* ================== P3a — THE CHAIR'S TONE ON THE INSTRUMENT ============
   FOUR INSTRUMENTS, FOUR DIFFERENT MACHINES, AND THE SAME FIVE NUMBERS.
   als.js donorFor() already picks the donor track by SYNTHESIS METHOD —
   strings to Tension, FM to Operator, sustain to Meld, subtractive and every
   bass to Drift. What it did not do is tell the machine anything once it got
   there. The genre's `tone` block is the same five dials in every case (cut,
   q, atk, rel, and the `glide` a bass wants), so the translation is one table
   per instrument and the arithmetic is shared.

   THE UNITS ARE NOT THE SAME AND THE FILE SAYS SO, which is the whole reason
   these are four tables and not one:

     device          filter freq         envelope times        resonance
     Drift           Hz    20 … 20000    SECONDS  0 … 60       0 … 1.01
     Operator        Hz    30 … 18500    MILLIsec 0.1 … 20000  0 … 1.25
     InstrumentMeld  Hz    20 … 20480    SECONDS  0 … 40       (macros only)
     StringStudio    NORMALISED 0 … 1    normalised 0 … 1      0 … 1

   Every one of those numbers is `MidiControllerRange` read off the donor, and
   `setParam` re-reads it at write time so a wrong row here is clamped rather
   than written out of range.

   THE ONE INFERENCE IN P3a, flagged the way donor/README.md flags
   ReceivingNote's constant: StringStudio prints its filter cutoff as 0..1 with
   NO UNITS ANYWHERE IN THE FILE. A log map from the audible band onto 0..1 is
   the obvious reading and it is still a reading, so it is (a) used only for
   Tension, (b) floored at 0.4 so the worst case is "a little darker than the
   donor" rather than a muted guitar, and (c) named here. CONFIRM IN LIVE.

   WHAT IS DELIBERATELY NOT WRITTEN, each for a printed reason:
     · Drift `Oscillator1_Type` from tone.wave — the range is 0..6 and the file
       prints no enum names, so "sawtooth" -> a number is a guess that would
       silently change the instrument. The wave the genre asked for is already
       audible in OUR render; in Live it stays the donor's.
     · Drift `Filter_ModAmount1` from a filter-envelope amount — the donor's
       `Filter_ModSource1` is unset, so an amount with no source moves nothing.
       An honest filter-envelope depth needs a modulation SOURCE enum, which is
       the same unprinted-enum problem.
     · StringStudio portamento and envelope — all 0..1, no units, and unlike
       the cutoff there is no floor that makes a wrong guess harmless.
     · The Drum Rack — untouched, on purpose. Its sixteen pads are Max devices
       with their own parameter space and the box has no per-pad tone to say. */

// The engine's OWN normalisation of `q`, quoted rather than re-invented:
// audio/to-engine.js toneRecipe is `res = clamp((q - 0.7) / 12, 0, 0.9)`.
// als-gate.js gate Q reads that line out of to-engine.js and fails if it moves.
export const resOfQ = (q) => clamp((q - 0.7) / 12, 0, 0.9);

// tone.cut (Hz) -> StringStudio's unitless 0..1. THE INFERENCE, floored.
const NORM_LO = 60, NORM_HI = 18000, NORM_FLOOR = 0.4;
export const normFreq = (hz) => clamp(
  NORM_FLOOR + (1 - NORM_FLOOR) *
    (Math.log(clamp(hz, NORM_LO, NORM_HI) / NORM_LO) / Math.log(NORM_HI / NORM_LO)),
  NORM_FLOOR, 1);

/**
 * The instrument parameters this chair asks for, as `{path: value}`.
 *
 * `tone` is the genre's tone block (audio/plan.js cast()'s `tone`); `syn` is
 * the genre's signature `synth` spec when it has one (`{dsp, set:{…}}`, off
 * plan.js seats()). The SYNTH BLOCK WINS where both speak, and that is the
 * engine's own order: to-engine.js recipeFor tries the signature synth first
 * and falls back to the patch the instrument photographs.
 */
export function instrumentParams(deviceTag, tone, syn) {
  const t = tone || {};
  const s = (syn && syn.set) || {};
  // the synth block's own spelling varies by dsp (tb303 says `resonance`, the
  // supersaw rows say `res`), so both names are read and neither is required
  const cut = s.cutoff != null ? s.cutoff : t.cut;
  const res = s.resonance != null ? s.resonance
            : s.res != null ? s.res
            : t.q != null ? resOfQ(t.q) : null;
  const atk = s.attack != null ? s.attack : s.envAttack != null ? s.envAttack : t.atk;
  const rel = s.release != null ? s.release : t.rel;
  const dec = s.decay != null ? s.decay : s.envDecay != null ? s.envDecay : null;
  const sus = s.sustain != null ? s.sustain : s.envSustain != null ? s.envSustain : null;
  const glide = s.glide != null ? s.glide : t.glide;
  const detune = s.detune != null ? s.detune : null;

  switch (deviceTag) {
    case "Drift": return {
      Filter_Frequency: cut,
      Filter_Resonance: res,
      Envelope1_Attack: atk, Envelope1_Release: rel,
      Envelope1_Decay: dec, Envelope1_Sustain: sus,
      // the AMP envelope is Envelope2 on Drift (Global_Envelope2Mode 0 = ADSR);
      // both move together so a short `rel` shortens the note and not only the
      // filter, which is what a genre means by a 0.1 s release
      Envelope2_Attack: atk, Envelope2_Release: rel,
      Global_Glide: glide,
      /* AND NOT `detune`, MEASURED RATHER THAN ASSUMED. The three genres that
         name one (bigroom 0.35, melodictechno 0.15, chiptune 0) say it as a
         NORMALISED supersaw spread; Drift's `Oscillator2_Detune` prints
         `MidiControllerRange -7 … 7` and is SEMITONES. Same word, two
         quantities — 0.35 would land as a third of a semitone, which is not
         what a supersaw means, and there is no printed conversion between
         them. Left alone rather than guessed. */
    };
    case "Operator": return {
      "Filter/Frequency": cut,
      "Filter/Resonance": res,
      // MILLIseconds here, seconds on the box side — the one unit conversion
      // in this table, and it is printed in the donor (0.1 … 20000)
      "Operator.0/Envelope/AttackTime": atk == null ? null : atk * 1000,
      "Operator.0/Envelope/ReleaseTime": rel == null ? null : rel * 1000,
      "Operator.0/Envelope/DecayTime": dec == null ? null : dec * 1000,
      "Globals/PortamentoTime": glide == null || glide <= 0 ? null : glide * 1000,
    };
    case "InstrumentMeld": return {
      // Meld is two engines and a pad is both of them; a value on A alone
      // would filter half the sound
      MeldVoice_EngineA_Filter_Frequency: cut,
      MeldVoice_EngineB_Filter_Frequency: cut,
      MeldVoice_EngineA_AmpEnvelope_Times_Attack: atk,
      MeldVoice_EngineB_AmpEnvelope_Times_Attack: atk,
      MeldVoice_EngineA_AmpEnvelope_Times_Release: rel,
      MeldVoice_EngineB_AmpEnvelope_Times_Release: rel,
      MeldVoice_EngineA_FilterEnvelope_Times_Attack: atk,
      MeldVoice_EngineB_FilterEnvelope_Times_Attack: atk,
    };
    case "StringStudio": return {
      FilterCutoffFrequency: cut == null ? null : normFreq(cut),
      FilterQFactor: res,
    };
    default: return {};
  }
}

/** Booleans that only make sense once a value is being written beside them. */
export function instrumentFlags(deviceTag, tone, syn) {
  const t = tone || {};
  const s = (syn && syn.set) || {};
  const glide = s.glide != null ? s.glide : t.glide;
  const out = {};
  if (deviceTag === "Operator" && glide > 0) out["Globals/PortamentoOn"] = true;
  if (deviceTag === "StringStudio" && t.cut != null) out.FilterToggle = true;
  return out;
}

/** Set a whole instrument from a chair. Returns `{xml, set}`. */
export function setInstrument(deviceXml, deviceTag, tone, syn) {
  let out = deviceXml, set = 0;
  const r = setMany(out, instrumentParams(deviceTag, tone, syn));
  out = r.xml; set += r.set;
  for (const [path, on] of Object.entries(instrumentFlags(deviceTag, tone, syn))) {
    const next = setFlag(out, path, on);
    if (next !== out) { out = next; set++; }
  }
  return { xml: out, set };
}

/** The instrument tag a donor track carries — the first one that is there. */
export const INSTRUMENT_TAGS = ["Drift", "Operator", "InstrumentMeld", "StringStudio",
                               "MultiSampler", "InstrumentVector", "DrumGroupDevice"];
export function instrumentTagOf(trackXml) {
  let best = null, at = Infinity;
  for (const tag of INSTRUMENT_TAGS) {
    const i = trackXml.indexOf("<" + tag + " Id=");
    if (i >= 0 && i < at) { at = i; best = tag; }
  }
  return best;
}

/* ================== P3c — THE BOX'S EFFECTS AS LIVE DEVICES =============
   THE CHIPS ARE THE BIG ENGINE'S OWN INSERTS and their parameters are already
   in the same units the Faust modules declare (fields.js FX says so of itself:
   "the PARAMS already match those modules name for name"). engine/faust/dist
   `insert_*-meta.json` prints every slider's min/max, and the Live side prints
   every knob's MidiControllerRange, so each row below is a translation between
   two ranges that were both read rather than remembered:

     chip      Live device   box param -> device param                 both ranges
     ────────────────────────────────────────────────────────────────────────────
     chorus    Chorus2       rate  0.01…8 Hz -> Rate 0.1…15 Hz
                             depth 0…1       -> Amount 0…1
                             mix   0…1       -> DryWet 0…1
     flanger   Chorus2       + feedback ±0.95 -> Feedback 0…0.99 (abs)
                             — the NEAREST HONEST DEVICE: neither donor has a
                             Flanger, and a chorus with feedback and a short
                             delay IS the comb a flanger is. Named, not faked.
     phaser    —             NEITHER DONOR HAS A PHASER. Reported, never
                             substituted: an all-pass cascade is not any of the
                             twelve devices in Ableton2 and picking the closest
                             would be the kind of quiet lie gate 2 exists for.
     tremolo   AutoPan2      rate 0.5…12 Hz -> Modulation_Frequency 0.1…60
                             depth 0…1      -> Modulation_Amount 0…1
                             AND Modulation_Phase = 0, which is what makes an
                             Auto Pan a TREMOLO: both channels move together
                             instead of against each other. 0 is inside the
                             printed 0…360 range — no enum is guessed.
     leslie    AutoPan2      Modulation_Phase = 180 (the donor's own value, L
                             against R = a rotating horn)
                             speed 0…1 -> 0.8 + speed×6.2 Hz, which is a real
                             rotor: chorale ≈ 0.8 Hz, tremolo ≈ 7 Hz
     wah       AutoFilter2   base 80…1200 Hz -> Filter_Frequency
                             q 0.5…12       -> Filter_Resonance 0…1
                             sens×range/4   -> Envelope_Amount 0…1 (the
                             envelope follower is what makes it an AUTO-wah)
     sweep     AutoFilter2   √(lo×hi)       -> Filter_Frequency (the geometric
                             centre of the sweep the box asked for)
                             Lfo_Amount = 1, and the RATE goes in as free-run
                             Hz = 1/(rateBars × barSeconds) rather than through
                             `Lfo_SyncedRate`, whose 0…21 enum the file does not
                             decode. Exact at the record's own tempo.
     fenv      AutoFilter2   base 60…12000  -> Filter_Frequency
                             amount ±4      -> Envelope_Amount ±1  (÷4 exactly)
                             decay 0.02…2 s -> Envelope_Release 0…3 s
                             attack 0.001…0.5 -> Envelope_Attack 0…0.1
     echo      Delay         timeBars × barSeconds -> DelayLine_TimeL/R 0.001…5 s,
                             with DelayLine_SyncL/R turned OFF. Live's sync uses
                             `DelayLine_SyncedSixteenth` 0…7, another undecoded
                             enum; seconds at the record's bpm is the SAME time
                             and needs no enum at all. Named because it means a
                             tempo change in Live will not drag the echo with it.
                             feedback 0…0.9 -> Feedback 0…0.95
                             tone 300…12000 -> Filter_Frequency 50…18000
     crunch    Roar          drive 0…1 -> Stage1_Shaper_Amount 0…1
                             mix   0…1 -> Output_DryWet 0…1
                             stages 1…3 -> Stage2_On / Stage3_On, which is the
                             one thing that actually made crunch "WAYYYY TOO
                             MUCH" in the parent: Roar defaults to three stages
                             and the chip asks for one.
     ringmod   Shifter       freq 20…4000 -> ModBasedShifting_RingMod_Coarse 1…10000
                             mix  0…1     -> Global_DryWet 0…1
                             AND Global_ShifterMode = 2. THIS IS THE SECOND
                             INFERENCE IN THIS FILE: the range is 0…2 and the
                             file prints no names, but the parameter GROUPS are
                             `Pitch_*`, `ModBasedShifting_FShift_*` and
                             `ModBasedShifting_RingMod_*` in that order, which
                             is also Live's own Pitch / Frequency / Ring Mod
                             order in the device UI. CONFIRM IN LIVE.

   WHAT ELSE IS IN PAUL'S CHAIN AND HAS NO CHIP TO ANSWER IT, said out loud:
     · Vocoder — needs a MODULATOR routed in from another track (`CarrierSource`
       is a routing id, not a knob). The box's "voice" chairs are a vocal MODEL,
       not a vocoder, so wiring one would be a different instrument wearing the
       name. Left in the library, spliced by nothing.
     · AutoShift — pitch/formant shifting per note. The box has no chip that
       shifts pitch (`ringmod` is amplitude), so nothing asks for it.
     · StereoGain / FilterEQ3 — this was the one the P3 brief expected to
       land ("the desk's EQ/shade/gain … → Eq8 or FilterEQ3 bands; the seat dB
       → StereoGain"), and it was MEASURED before it was refused. The gain
       half is already on Live's own mixer Volume, so a StereoGain would be
       the same intent counted twice — the exact mistake als.js's CHAIR_LEVEL
       comment argues against. The EQ half is emptier than that: the desk's
       per-unit EQ is `u.strip.eq`, and on a shipped record it is NULL —
       probed through plan.barPlan(0) on preset 2 ("Motown 45"), all twenty
       units answered `eq: null`, because that EQ only exists once a hand has
       moved the board's EQ row. So a FilterEQ3 spliced from it would carry
       three unity gains on every track. The corrective EQ Paul asked for by
       name ("the mix is very muddy") is already the Eq8 als.js splices with
       CHAIR_EQ. Nothing is left over for a second EQ device to say.
       WHAT WOULD CHANGE THIS: a record saved off the board with EQ words on
       it. `u.strip.eq` is the number to read and FilterEQ3's GainLo/GainMid/
       GainHi (0.0003..1.995, a linear gain) is where it goes.
     · FilterDelay — a three-band delay; `echo` is one band, and spreading one
       band across three is an arrangement decision the box never made. */

/* THE CHIP'S OWN KNOBS, COPIED FROM fields.js FX AND HELD TO IT BY A GATE.
   A section chip goes to the engine through `fxChain([...S.fx])`, which is
   `{...FX[k].params}` — the DECLARED defaults, untouched, because a section
   chip carries no slot knobs (audio/desk.js:1138 says so of itself: "neither
   carries slot knobs"). So these eleven rows are what a `fx: ["echo"]` box
   actually sounds like, and they are copied here for the same reason als.js
   copies CHAIR_LEVEL: this file is browser-safe and cannot import the UMD data
   tier. als-gate.js gate F reads the real fields.js FX and fails the moment the
   two disagree — duplicate the value if you must, never duplicate the
   authority. */
export const FX_PARAMS = {
  chorus:  { rate: 0.7, depth: 0.6, mix: 0.45 },
  phaser:  { rate: 0.35, depth: 0.8, mix: 0.7 },
  flanger: { rate: 0.3, depth: 0.9, feedback: 0.6, mix: 0.6 },
  tremolo: { rate: 5, depth: 0.8, mix: 0.9 },
  leslie:  { speed: 0.7, depth: 0.85, mix: 0.6 },
  wah:     { base: 320, range: 2.2, sens: 0.7, q: 4, mix: 0.9 },
  ringmod: { freq: 180, mix: 0.4 },
  sweep:   { lo: 400, hi: 5200, res: 0.35, rateBars: 4 },
  fenv:    { base: 380, amount: 2.4, sens: 0.7, res: 0.6, decay: 0.16, mix: 1 },
  echo:    { timeBars: 0.1875, feedback: 0.4, tone: 2800, mix: 0.35 },
  crunch:  { drive: 0.35, stages: 1, gate: 0.2, low: 0.55, mid: 0.4, high: 0.5,
             presence: 0.5, level: 0.6, mix: 0.55 },
};
export const chipParams = (chip) => FX_PARAMS[chip] || null;

/* THE THREE CHIPS A KIT DOES NOT GET, quoted from audio/desk.js `KIT_FILTER`
   and held to it by als-gate.js gate A. Paul, 2026-09-03, hours before the
   sentence this whole round answers: "the reason the funk drums are low is the
   auto-wah is on them." desk.js drops exactly these three from a drum unit's
   chain and passes everything else through, so the export does the same — a
   chorus or a tape echo across a kit IS what the section asked for; an
   envelope-following filter across a kit is what made the funk drums quiet.
   (The first cut of this gave the drums no chips at all, which was tidier and
   was not what the record sounds like.) */
export const KIT_FILTER = { wah: 1, fenv: 1, filtersweep: 1, sweep: 1 };
export const kitTakes = (chip) => !KIT_FILTER[chip];

/** Which knob is this device's WET — what an "is this chip on?" envelope rides. */
export function wetPathOf(deviceTag) {
  switch (deviceTag) {
    case "Chorus2": case "AutoFilter2": case "Delay": return "DryWet";
    case "Roar": return "Output_DryWet";
    case "Shifter": return "Global_DryWet";
    // AutoPan2 has no dry/wet at all — measured, its parameter list ends at
    // VintageMode — so the depth IS the wet, and 0 depth is 0 effect.
    case "AutoPan2": return "Modulation_Amount";
    default: return null;
  }
}

/** AutoFilter2's own ceiling, read off the donor: 19999.9961 Hz = no filter. */
export const FILTER_OPEN = 19999.9961;

const barSecondsOf = (bpm, beatsPerBar) => (60 / Math.max(1, bpm)) * (beatsPerBar || 4);

/** `{device, params, flags}` for one chip, or `{unmapped}` when no donor has it. */
export function fxDeviceFor(chip, params, ctx = {}) {
  const p = params || {};
  const barSec = barSecondsOf(ctx.bpm || 120, ctx.beatsPerBar || 4);
  const g = (k, d) => (p[k] == null ? d : p[k]);
  switch (chip) {
    case "chorus": return { device: "Chorus2", params: {
      Rate: g("rate", 0.7), Amount: g("depth", 0.6), DryWet: g("mix", 0.45) } };
    case "flanger": return { device: "Chorus2", nearest: "no Flanger in either donor", params: {
      Rate: g("rate", 0.3), Amount: g("depth", 0.9), DryWet: g("mix", 0.6),
      Feedback: Math.abs(g("feedback", 0.6)),
      // a flanger's comb is SHORT; Chorus2's ChorusDelayTime is 0..5 ms and the
      // donor sits at 3, which is chorus territory
      ChorusDelayTime: 0.8 },
      flags: { InvertFeedback: g("feedback", 0.6) < 0 } };
    case "phaser": return { unmapped: "neither donor carries a Phaser" };
    case "tremolo": return { device: "AutoPan2", params: {
      Modulation_Frequency: g("rate", 5), Modulation_Amount: g("depth", 0.8),
      Modulation_Phase: 0 } };
    case "leslie": return { device: "AutoPan2", params: {
      Modulation_Frequency: 0.8 + clamp(g("speed", 0.7), 0, 1) * 6.2,
      Modulation_Amount: g("depth", 0.85), Modulation_Phase: 180 } };
    case "wah": return { device: "AutoFilter2", params: {
      Filter_Frequency: g("base", 320),
      Filter_Resonance: clamp((g("q", 4) - 0.5) / 11.5, 0, 1),
      Envelope_Amount: clamp(g("sens", 0.7) * g("range", 2.2) / 4, 0, 1),
      DryWet: g("mix", 0.9) } };
    case "filtersweep": case "sweep": {
      const lo = g("lo", 400), hi = g("hi", 5200);
      const bars = Math.max(0.25, g("rateBars", 4));
      return { device: "AutoFilter2", params: {
        Filter_Frequency: Math.sqrt(Math.max(1, lo) * Math.max(1, hi)),
        Filter_Resonance: g("res", 0.35),
        Lfo_Amount: 1, Lfo_Frequency: 1 / (bars * barSec), DryWet: 1 } };
    }
    case "fenv": return { device: "AutoFilter2", params: {
      Filter_Frequency: g("base", 380),
      Filter_Resonance: g("res", 0.6),
      Envelope_Amount: g("amount", 2.4) / 4,
      Envelope_Attack: g("attack", 0.004),
      Envelope_Release: g("decay", 0.16),
      DryWet: g("mix", 1) } };
    case "echo": case "delay": {
      const t = Math.max(0.001, g("timeBars", 0.1875) * barSec);
      return { device: "Delay", params: {
        DelayLine_TimeL: t, DelayLine_TimeR: t,
        Feedback: g("feedback", 0.4), Filter_Frequency: g("tone", 2800),
        DryWet: g("mix", 0.35) },
        flags: { DelayLine_SyncL: false, DelayLine_SyncR: false, Filter_On: true } };
    }
    case "crunch": case "higain": {
      const stages = Math.round(g("stages", 1));
      return { device: "Roar", params: {
        Stage1_Shaper_Amount: g("drive", 0.35), Output_DryWet: g("mix", 0.55) },
        flags: { Stage2_On: stages >= 2, Stage3_On: stages >= 3 } };
    }
    case "ringmod": return { device: "Shifter", params: {
      Global_ShifterMode: 2, ModBasedShifting_RingMod_Coarse: g("freq", 180),
      Global_DryWet: g("mix", 0.4) } };
    default: return { unmapped: "no mapping for chip " + chip };
  }
}

/**
 * Build one chip's device, ready to splice. Returns
 * `{xml, device, set}` or `{unmapped}`; `missing` means the mapping exists but
 * the caller's library does not carry that device (no fx rack handed in).
 */
export function buildFx(lib, chip, params, ctx) {
  const spec = fxDeviceFor(chip, params, ctx);
  if (spec.unmapped) return spec;
  const base = lib[spec.device];
  if (!base) return { missing: spec.device };
  let xml = base, set = 0;
  const r = setMany(xml, spec.params);
  xml = r.xml; set = r.set;
  for (const [path, on] of Object.entries(spec.flags || {})) {
    const next = setFlag(xml, path, on);
    if (next !== xml) { xml = next; set++; }
  }
  return { xml, device: spec.device, set, nearest: spec.nearest || null };
}

/* ================== P3b — THE AUTOMATION ENVELOPES ======================
   WHERE THEY GO, read off the donor and not off a spec. Every track carries
   `<AutomationEnvelopes><Envelopes /></AutomationEnvelopes>` right after its
   `<Color>` (Generic.xml:25-27), empty on all eight tracks — and the MainTrack
   carries the SAME element with two real envelopes in it (Generic.xml:21597),
   one `EnumEvent` and one `FloatEvent`, each wrapped in

       <AutomationEnvelope Id="n">
         <EnvelopeTarget><PointeeId Value="…" /></EnvelopeTarget>
         <Automation>
           <Events> …events… </Events>
           <AutomationTransformViewState>
             <IsTransformPending Value="false" /><TimeAndValueTransforms />
           </AutomationTransformViewState>
         </Automation>
       </AutomationEnvelope>

   als.js spliceTempoMap has been writing into exactly that shape since the
   tempo-map round, so this is a proven path and not a new one. What is new is
   putting one on a REGULAR track, pointed at a device knob instead of at the
   Tempo.

   THE POINTEE MUST RESOLVE, and that is the whole risk. `PointeeId` names an
   `<AutomationTarget Id>` somewhere in the document, and als.js renumbers every
   pointee id in a cloned track — so the id has to be read AFTER the renumber,
   off the assembled track, which is what als.js does. als-gate.js gate P
   proves it for the finished file: every PointeeId in the output resolves to
   an id that exists, and a probe that breaks one is caught.

   TIME IS SONG BEATS. An Arrangement envelope is absolute, exactly like the
   arrangement clips als.js already places at `box.beat0`. The first event is
   Live's own "before the beginning" sentinel `Time="-63072000"` carrying the
   value at beat 0 — the donor writes its initial event that way and so does
   this.

   A CURVE IS SUBDIVIDED, NOT DECLARED. Live interpolates linearly between two
   FloatEvents and the shape in the file has nowhere to say otherwise, so an
   `exp` lane (which is what `mot: open` and every autoShape cutoff lane are)
   is written as `EXP_STEPS` straight segments through the real curve. Eight is
   enough that a 320 Hz -> 16 kHz sweep is within a semitone of the true curve
   everywhere, and it keeps a 16-bar lane under a hundred events. */
const EXP_STEPS = 8;

/** One `<AutomationEnvelope>`, from `[{time, value}]` in song beats. */
export function automationEnvelope(id, pointeeId, events) {
  let n = 0;
  const evs = events.map((e) =>
    '<FloatEvent Id="' + (n++) + '" Time="' + num(e.time) + '" Value="' + num(e.value) + '" />').join("");
  return '<AutomationEnvelope Id="' + id + '">' +
    "<EnvelopeTarget><PointeeId Value=\"" + pointeeId + "\" /></EnvelopeTarget>" +
    "<Automation><Events>" + evs + "</Events>" +
    "<AutomationTransformViewState><IsTransformPending Value=\"false\" />" +
    "<TimeAndValueTransforms /></AutomationTransformViewState></Automation>" +
    "</AutomationEnvelope>";
}

/** Replace a track's empty `<Envelopes />` with these envelopes. */
export function putEnvelopes(track, envelopes) {
  if (!envelopes.length) return track;
  const el = elementAfter(track, "AutomationEnvelopes");
  if (!el) return track;
  const body = "<AutomationEnvelopes><Envelopes>" + envelopes.join("") +
               "</Envelopes></AutomationEnvelopes>";
  return track.slice(0, el.start) + body + track.slice(el.end);
}

/**
 * A lane's breakpoints, mapped onto the song.
 *
 * `points` are `[position, value]` in the BOX'S OWN beats, exactly as
 * fields.js autoShape wrote them and as the section stores them — nothing is
 * recomputed here, which is why there is no second copy of the shape tables in
 * this file.
 *
 * THE LANE IS NOT STRETCHED TO FIT THE BOX, and that was measured rather than
 * chosen. audio/desk.js `laneAt` is the function that makes the sound —
 * `deskAmp` and `deskSweeps` both go through it — and it reads the lane in
 * BOX BEATS and CLAMPS past the end (`return p[p.length - 1][1]`). So a
 * sixteen-beat `pump` on a sixty-four-beat section pumps for sixteen beats and
 * then holds, and that is what the record sounds like. The first cut of this
 * function stretched the lane across the box instead — which is what
 * desk.js's OTHER reader, `deskLevelAt`, does for the board's fill — and it
 * turned a per-beat sidechain into a four-beat swell. Quoting the reader that
 * makes the sound is the whole of "test the artifact"; the lane beyond the
 * box's end is dropped for the same reason, because the ear never gets there.
 *
 * `scale` turns a lane value into the device's own units — identity for a
 * cutoff lane (both are Hz), the track's own static volume for a level lane
 * (see the volume law in als.js).
 */
export function laneEvents(lane, beat0, beats, scale = (v) => v) {
  const pts = (lane && lane.points) || [];
  if (!pts.length) return [];
  const out = [];
  const push = (t, v) => {
    const val = scale(v);
    if (!isFinite(val)) return;
    // a repeated (time, value) is noise in the file and a wobble in the editor
    const last = out[out.length - 1];
    if (last && Math.abs(last.time - (beat0 + t)) < 1e-9 &&
        Math.abs(last.value - val) < 1e-9) return;
    out.push({ time: beat0 + t, value: val });
  };
  const exp = lane.curve === "exp";
  push(Math.min(pts[0][0], beats), pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [t0, v0] = pts[i - 1];
    let [t1, v1] = pts[i];
    if (t0 >= beats) break;
    if (t1 > beats) {                       // the box ends mid-segment
      const x = t1 > t0 ? (beats - t0) / (t1 - t0) : 1;
      v1 = exp && v0 > 0 && v1 > 0 ? v0 * Math.pow(v1 / v0, x) : v0 + (v1 - v0) * x;
      t1 = beats;
    }
    /* HOW MANY STRAIGHT LINES AN EXPONENTIAL SEGMENT IS WORTH, and it has to
       be proportional or a pump explodes the file: `pump` writes two points a
       beat, and eight subdivisions on each of those put 1,599 breakpoints on a
       single envelope — correct, unreadable, and 460 KB. A segment shorter
       than half a beat is a straight line to any ear; a sixteen-bar sweep gets
       the full eight, which holds it inside a semitone of the true curve. */
    const steps = exp && v0 > 0 && v1 > 0 && t1 > t0
      ? Math.max(1, Math.min(EXP_STEPS, Math.round((t1 - t0) * 2))) : 1;
    for (let s = 1; s <= steps; s++) {
      const x = s / steps;
      push(t0 + (t1 - t0) * x,
           steps === 1 ? v1 : v0 * Math.pow(v1 / v0, x));
    }
    if (t1 >= beats) break;
  }
  return out;
}

/**
 * Stitch per-box lanes into ONE envelope's event list, with the sentinel.
 *
 * `boxes` is `[{beat0, beats, lane, hold, map}]` in song order: `lane` is the
 * lane that box draws (or null), `hold` is the value the parameter takes for a
 * box that draws nothing, and `map` turns a lane value into the device's own
 * units — per box, because the thing a level lane has to be multiplied by (the
 * section's own `lvl` shade) is a per-box number. A box that says nothing MUST
 * still say
 * something — audio/desk.js deskSweeps makes exactly this argument about the
 * master sweep ("a `close` box that ran 16 kHz down to 320 would leave every
 * box after it dark for the rest of the song"), and a Live envelope has the
 * same global-parameter problem: the last breakpoint holds forever.
 */
export function stitchEnvelope(boxes) {
  const out = [];
  for (const b of boxes) {
    const map = b.map || ((v) => v);
    const evs = b.lane ? laneEvents(b.lane, b.beat0, b.beats, map)
                       : [{ time: b.beat0, value: map(b.hold) }];
    if (!evs.length) continue;
    /* A BOX BOUNDARY IS A STEP, NOT A SLIDE, and it is written the same way
       als.js spliceTempoMap writes a tempo step: TWO events on the boundary
       beat, the outgoing value then the incoming one. Live ramps linearly
       between breakpoints, so without the first of those a `fwd` chorus
       following a `hush` verse would arrive as a sixteen-bar fade instead of
       as the section change it is. Inside a box the lane's own points ramp,
       which is what a sweep and a pump are. */
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.value - evs[0].value) > 1e-9 && prev.time < evs[0].time)
      out.push({ time: evs[0].time, value: prev.value });
    for (const e of evs) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.value - e.value) < 1e-9 &&
          Math.abs(last.time - e.time) < 1e-9) continue;
      out.push(e);
    }
  }
  if (!out.length) return [];
  // Live's own initial event: the value before the song starts, at its
  // "before the beginning" sentinel time (both donors write it this way)
  return [{ time: -63072000, value: out[0].value }, ...out];
}

// instruments.js — the SOUND SOURCES, as pure data. Classic UMD, node-loadable.
//
// What plays a note, per genre and per lane: the soundfont list, the bass
// instrument, the sampled drum kit files, the synth-bass specs and the mix
// strips. No AudioContext, no fetch — the loaders and players stay in the UI
// tier; this file only says WHICH, so the node gate can prove every genre
// names a real instrument without opening a browser.
//
// Place in the layer graph: kernel -> genres -> fields -> song -> THIS FILE ->
// compose -> presets -> UI.
(function (root) {
  "use strict";
  const NG = (typeof module !== "undefined" && module.exports)
    ? require("./genres.js") : root.NuGenres;
  const { GENRES } = NG;

  // WHICH INSTRUMENT a genre voice plays. The table itself lives in genres.js
  // as each genre's `instr` field — instrument is genre identity, exactly like
  // kit and tone, and keeping it in the UI file was how a new genre could ship
  // with a silent piano default and no gate to notice. A string is the whole
  // genre; an ARRAY is read per voice, with the last entry covering the rest —
  // that second form is what a band is: the Isley Brothers are a Rhodes and a
  // fuzz guitar at the same time.
  //
  // A genre with no `instr` THROWS. The old fallback (yamaha_grand_piano)
  // meant a misspelled id or a forgotten entry played politely wrong forever;
  // the coverage gate in test/unit/nukernel.test.js now fails instead.
  const instrOf = (gk, v) => {
    const g = GENRES[gk];
    const e = g && g.instr;
    if (!e) throw new Error("instruments: genre \"" + gk + "\" declares no instr");
    if (Array.isArray(e)) return e[Math.min(v || 0, e.length - 1)] || e[0];
    return e;
  };
  const BASS_INSTR = "acoustic_bass";

  // THE DRUM KIT IS SAMPLED TOO. found/samples/drums/<kit>/ is the same
  // extraction the big engine plays — and it has always carried TWELVE samples
  // per kit, of which this map named six. The other six were on disk, in all
  // six kits, unreachable: no ride, no crash, no toms, no pedal hat, which is
  // why kernel.js used to spell a crash "o" and why a tom fill could not be
  // written. One letter per lane, matching kernel.js LANES exactly — the gate
  // holds the two tables against each other, because a lane the kernel can
  // write and this map cannot name is a silent drum.
  //
  // IT IS A SECOND COPY, KNOWINGLY, AND HERE IS WHY IT STAYS. The parent's
  // genre-kernel DRUMKITS now names all twelve hits per kit (4ce6809), so this
  // table could in principle be derived rather than kept — but deriving it
  // would mean kernel-daw.html loading engine/genre-kernel.js and the ~800 KB
  // of genres-data/registry-data it merges at boot, for twelve filenames, on a
  // page whose whole design is that the data tier is small and classic. The two
  // are not even the same shape: DRUMKITS is PER KIT, and its `electronic` row
  // names one tom recording three times, while this page loads that kit's
  // tomLo/tomHi off disk (they are there, byte-identical). So the derivation is
  // a real thing to want and the wrong thing to buy at this price. What the
  // kit's OWN spec answers, this page already asks: audio/to-engine.js LANE
  // carries the hit name per lane (`tom: "tomHi"`, `pedal`), which is the half
  // that had actually drifted, and the half a wrong answer is audible in.
  const DRUMDIR = "../found/samples/drums/";
  const DRUMFILE = { k: "kick.wav", s: "snare.wav", h: "hatClosed.wav",
                     o: "hatOpen.wav", c: "clap.wav", p: "rim.wav",
                     f: "hatPedal.wav", r: "ride.wav", x: "crash.wav",
                     t: "tomHi.wav", m: "tomMid.wav", l: "tomLo.wav" };

  // ---- THE DRUM KIT'S OWN MIX ----------------------------------------------
  // WHERE EACH LANE SITS, AND HOW HARD IT HITS. Twelve lanes arrived and every
  // one of them was played at the same level, dead centre, into the same dry
  // channel — so a tom fill was a mono thump beside the snare rather than a
  // move across the kit, and "our drums sound really dry" was the whole kit
  // arriving at one point in space with no room around it.
  //
  // Four numbers per lane, and they are the four things a drum mix is:
  //   lvl    the lane's own trim, before the phrase's velocity
  //   pan    where it sits, AUDIENCE PERSPECTIVE — the parent's own placement
  //          (state-engine MASTER_PAN: hat +0.18, ride +0.22, rim −0.16,
  //          tom −0.10), so hats and ride are right of centre and the toms
  //          sweep left as they get lower. The crash takes the empty side: the
  //          ride already owns the right, and a real kit has cymbals on both.
  //   room   how much of it goes to the DRUM ROOM — a short ambience send that
  //          is NOT the section's reverb (the engine's own room). Kick
  //          barely, snare and toms plenty, hats a hint: that ratio IS the
  //          sound of a kit in a room rather than twelve samples in a line.
  //   punch/ TRANSIENT SHAPING, per hit, as a gain envelope on the sample
  //   sus    itself: `punch` is the attack multiplier for the first ~12 ms
  //          (>1 adds stick, <1 softens), `sus` the body level it settles to
  //          (<1 shortens the tail, which is what makes a room-mic'd kit tight
  //          instead of washy). A transient designer is exactly these two
  //          numbers; doing it per note costs nothing and needs no worklet.
  // The parent's drum strip (subsonic HPF + a whisper of glue saturation, NO
  // compressor) still sits under all of this on the drum bus — see DRUMBUS.
  //
  // THESE ROWS ARE THE SAMPLED KITS' TRUTH, and the machine kits ride them
  // through the per-machine overrides below (MACHINEMIX, merged by mixFor —
  // one merge, read by the desk and the player both).
  const DRUMMIX = {
    k: { lvl: 1.00, pan:  0.00, room: 0.10, punch: 1.45, sus: 1.00 },
    s: { lvl: 1.00, pan: -0.02, room: 0.55, punch: 1.35, sus: 0.94 },
    p: { lvl: 0.50, pan: -0.16, room: 0.45, punch: 1.30, sus: 0.90 },
    c: { lvl: 0.95, pan:  0.08, room: 0.60, punch: 1.15, sus: 1.00 },
    t: { lvl: 0.95, pan:  0.14, room: 0.50, punch: 1.30, sus: 0.92 },
    m: { lvl: 0.95, pan: -0.08, room: 0.52, punch: 1.28, sus: 0.92 },
    l: { lvl: 0.98, pan: -0.28, room: 0.54, punch: 1.25, sus: 0.94 },
    h: { lvl: 0.85, pan:  0.18, room: 0.18, punch: 1.20, sus: 0.85 },
    o: { lvl: 0.80, pan:  0.20, room: 0.30, punch: 1.10, sus: 0.95 },
    f: { lvl: 0.62, pan:  0.14, room: 0.16, punch: 1.15, sus: 0.85 },
    r: { lvl: 0.72, pan:  0.24, room: 0.35, punch: 1.10, sus: 1.00 },
    x: { lvl: 0.80, pan: -0.20, room: 0.45, punch: 1.05, sus: 1.00 },
  };
  // ---- THE MACHINES' PLACE IN THAT MIX -------------------------------------
  // Four kits are DRUM MACHINES — tr808, tr909, tr606, cr78 — and the parent
  // engine voices every one of them (audio/to-engine.js MACHINE_KIT is the
  // whole routing table, live and pressed). What is left for this file is the
  // half a machine changes about a MIX rather than about a sound, which is one
  // number: `room`. A drum machine is a line-out, not a kit in a room, and the
  // hats especially take far less of the ambience send than a recorded hat or
  // the machine stops sounding like a machine. Levels ride down with it where
  // the box was polite (the CR-78 sat behind an organ; every record that loved
  // it mixed it quietly).
  //
  // NO punch/sus HERE, and their absence is the point: transient shaping is a
  // gain envelope over a SAMPLE, and these lanes are not samples any more —
  // they are the parent's modules, triggered per hit with their own attacks. A
  // row that named a `punch` for them would be a number nobody reads.
  const MACHINEMIX = {
    tr808: { k: { room: 0.04 }, s: { room: 0.28 }, c: { room: 0.30 }, p: { room: 0.20 },
             h: { room: 0.06 }, o: { room: 0.10 }, f: { room: 0.05 },
             r: { room: 0.12, lvl: 0.6 }, x: { room: 0.18, lvl: 0.7 },
             t: { room: 0.20 }, m: { room: 0.20 }, l: { room: 0.22 } },
    tr909: { k: { room: 0.06 }, s: { room: 0.32 }, c: { room: 0.34 }, p: { room: 0.20 },
             h: { room: 0.07 }, o: { room: 0.12 }, f: { room: 0.06 },
             r: { room: 0.15, lvl: 0.62 }, x: { room: 0.20, lvl: 0.75 },
             t: { room: 0.22 }, m: { room: 0.22 }, l: { room: 0.24 } },
    tr606: { k: { room: 0.05 }, s: { room: 0.24 }, c: { room: 0.26, lvl: 0.8 }, p: { room: 0.18 },
             h: { room: 0.06 }, o: { room: 0.10 }, f: { room: 0.05 },
             r: { room: 0.12, lvl: 0.6 }, x: { room: 0.16, lvl: 0.7 },
             t: { room: 0.18 }, m: { room: 0.18 }, l: { room: 0.20 } },
    cr78:  { k: { room: 0.08, lvl: 0.9 }, s: { room: 0.30, lvl: 0.85 },
             c: { room: 0.28, lvl: 0.7 }, p: { room: 0.22, lvl: 0.45 },
             h: { room: 0.08, lvl: 0.7 }, o: { room: 0.12, lvl: 0.65 },
             f: { room: 0.06, lvl: 0.5 }, r: { room: 0.14, lvl: 0.5 },
             x: { room: 0.18, lvl: 0.6 }, t: { room: 0.22, lvl: 0.8 },
             m: { room: 0.22, lvl: 0.8 }, l: { room: 0.24, lvl: 0.82 } },
  };
  // THE ONE MERGE — the kit desk's lane strips and the drum player both read
  // this, so the table and the sound cannot drift apart. A sampled kit falls
  // straight through to DRUMMIX.
  const mixFor = (kit, lane) => {
    const o = kit && MACHINEMIX[kit] && MACHINEMIX[kit][lane];
    const base = DRUMMIX[lane];
    return o ? { ...base, ...o } : base;
  };
  // which strip a hit lands on: sampled kits share one strip per lane (the
  // original desk, node for node); a machine lane with its own row earns its own
  const laneKey = (kit, lane) =>
    (kit && MACHINEMIX[kit] && MACHINEMIX[kit][lane]) ? kit + "|" + lane : lane;

  // THE DRUM BUS. hpf/sat/satMix are the parent's transient-preserving drum
  // strip verbatim (state-engine STRIP_PROFILES.drum: no compressor, no dulling
  // filter — the attack IS the instrument). `room` is the bus trim on the whole
  // kit's ambience send, so a genre-level "less room" is one number, and
  // `punchMs` is how long a transient boost lasts before the body takes over.
  const DRUMBUS = { hpf: 28, sat: 0.15, satMix: 0.22, room: 0.9, punchMs: 0.012,
                    susMs: 0.09 };

  // ---- THE INSTRUMENT'S OWN RANGE ------------------------------------------
  // MIDI windows, C4 = 60, lifted from engine/faust/voices/state-engine.js
  // INSTRUMENT_RANGE — the parent's second-tier register law. A note outside
  // the window octave-folds into it (whole octaves, so the pitch class and the
  // key survive) rather than playing a zone stretched past the point where it
  // is still that instrument: measured on the shipped registry, sludge's
  // overdrive guitar asks for MIDI 12 against a bottom zone root of 40, which
  // is a guitar sample played two and a half octaves down — mud, not a guitar.
  //
  // EVERY id a genre can voice is listed — the 48 choosable ids (fields.js
  // INSTRCHOICES is the union of every genre's `instr`) plus the bass chair —
 // because the squeaky-ska-trumpet round showed what an absent
  // row costs: an unlisted instrument still passes through untouched (future
  // ids degrade to the zone window, the parent's law for the unlisted), but the
  // gate in test/unit/nukernel.test.js now proves nothing choosable is
  // unlisted. Where the parent's table carries the id, its values are borrowed
  // verbatim; where it does not (pianos, EPs, sections, the GM synth patches),
  // the bounds come from the instrument's real compass intersected with the
  // registry's zone extents (playWindow does the intersection).
  const RANGES = {
    // winds + reeds. The recorder is the estampie/pavane pipe — parent
    // values verbatim, same law as the viols below.
    flute: [60, 96], harmonica: [60, 96], tenor_sax: [44, 77],
    recorder: [60, 91],
    // brass. THE TROMBONE IS THE SKATALITES' FRONT LINE, and its ceiling is
    // 74 — ten semitones under the trumpet's, which is the point. Composed ska
    // writes its horn line as high as MIDI 100 and the register home folds it
    // back down; folding it into a trombone's window puts the horn a full
    // octave lower than folding it into a trumpet's, which is the difference
    // between Don Drummond and a squeak.
    trumpet: [54, 84], muted_trumpet: [54, 84], brass_section: [40, 86],
    trombone: [40, 74],
    // the romantic orchestra's answering voice — parent values verbatim
    french_horns: [34, 77],
    // bowed. Viola and cello joined with the old-world slate (pavane's viol,
    // romantic's tune-carrier) — values are the parent's INSTRUMENT_RANGE
    // verbatim, because the register-law gate holds any shared id to the
    // table that actually binds (state-engine.js foldToRange).
    violin: [55, 100], fiddle: [55, 100], viola: [48, 91], cello: [36, 84],
    // plucked + fretted (guitar tops around E6)
    nylon_string_guitar: [40, 88], steel_string_guitar: [40, 88],
    jazz_guitar: [40, 88], clean_guitar: [40, 88], palm_muted_guitar: [40, 86],
    crunch_guitar: [40, 88], distortion_guitar: [40, 88], overdrive_guitar: [40, 88],
    // ...and the DI, which is the same Fender the crunch tier is, with the amp
    // in the insert chain instead of in the recording. The parent already
    // carries [40, 88] for it and this row says the same, which is the law
    // above (a borrowed value must not drift).
    di_guitar: [40, 88],
    // `guitar_harmonics` HAS NO ROW HERE, ON PURPOSE, and the parent has none
    // either. Two catalog anchors cast it out of a `samplerPool`
    // (genres-data.js), so writing an INSTRUMENT_RANGE row for it upstream
    // would move their per-note fold and their renders — not a nukernel
    // decision to take. Its honest window is therefore the zones' own extent,
    // measured [16, 70.5]: wide at the bottom rather than wrong, and the
    // guitarist's own register keeps the hand where a harmonic lives. If the
    // parent ever gains a row, this table gains the same one.
    banjo: [48, 84],
    // keyed reeds + organs (the pedal board is the floor, not a rumble).
    // THREE ORGANS, WHERE THERE WAS ONE PLAYABLE ONE. `drawbarorgan` is a
    // SINGLE zone rooted at MIDI 96 — measured on the shipped registry — so a
    // hymn at MIDI 50 was one C7 sample dragged down three and a half octaves,
    // which is a breathy whistle and not a Hammond. It is nobody's cast any
    // more (church_organ for the pipes, percussive_organ for the B-3's
    // key-click) and the row stays only because the table is the compass.
    bandoneon: [41, 86], drawbarorgan: [36, 96], rock_organ: [36, 96],
    church_organ: [36, 96], percussive_organ: [36, 96],
    // struck + tuned percussion. The dulcimer (the estampie's struck
    // strings) and the harp (the salon's) carry the parent's own windows.
    marimba: [45, 91], harpsichord: [29, 89], clavinet: [36, 84],
    dulcimer: [43, 88], harp: [24, 103],
    // the Funk Brothers' vibes and a Highlife kalimba: two colours the table
    // could name and no genre had ever asked for
    vibraphone: [53, 89], kalimba: [60, 96],
    // music box: the parent's own window, RESTORED. It was deliberately absent
    // for one release because a bare per-note fold would have mangled trap's
    // melody — but the register home (audio/plan.js) now moves the WHOLE
    // line by octaves first, contour intact, so trap's plinks land in the
    // register a music box actually has tines for.
    music_box: [72, 100],
    // voices
    ahh_choir: [48, 84], ohh_voices: [48, 84], solo_vox: [50, 84],
    synth_voice: [48, 88],
    // pianos + EPs — genuinely wide, so the entry is the real compass (a
    // grand's 88 keys; a Rhodes 73's E1..E7 held to the zones' top root) and
    // the row exists so the table covers everything choosable rather than to
    // clamp: nothing the composer writes leaves these bounds today
    yamaha_grand_piano: [21, 108], bright_yamaha_grand: [21, 108],
    upright_piano: [21, 108], felt_piano: [21, 108],
    rhodes_ep: [28, 96], electric_piano: [28, 96], legend_ep_2: [28, 96],
    // string sections — contrabass bottom to violin-section top. `tremolo`
    // (GM 44, tremolo strings — the romantic climax's floor) is a section
    // like the other three; the parent's table does not list it, so the
    // bounds here are the section compass intersected with its zone span
    // (roots 31..83, top zone reaching 96), the file's own policy for the
    // parent-unlisted.
    strings: [28, 96], slow_strings: [28, 96], synth_strings_1: [28, 96],
    tremolo: [28, 96],
    // THE GM SYNTH PATCHES. The parent leaves real synths unclamped, but these
    // are one-zone SAMPLES of synths (warm_pad: a single zone rooted at 84),
    // exempt from the zone window by design (ROOT_SPAN_MIN in voices.js) — so
    // without a row here they had NO bounds at all, and boombap's warm pad was
    // being asked for MIDI 21: rate 0.026, a rumble where a pad should be.
    // Keyboard-honest windows; the pads reach a fourth lower than the leads.
    saw_wave: [36, 96], square_lead: [36, 96], charang: [36, 96],
    fifth_sawtooth_wave: [36, 96], echo_drops: [36, 96],
    polysynth: [36, 96], warm_pad: [33, 96], halo_pad: [36, 96],
    metal_pad: [36, 96], bowed_glass: [48, 96],
    // GM 88, "bass + lead": the one GM patch that IS a monosynth doing both
    // jobs at once, which is the 303's own job description (to-engine.js
    // PATCH_SYNTH routes it there). Its window is a bassline's — an octave
    // under the leads above, because that is where the box is played.
    bass_lead: [28, 84],
    // the bass chair — the upright, and the two electrics grebo needs. A
    // player fingering a low B and a player picking eighths are two different
    // recordings, and the joke only lands if they are two different players.
    acoustic_bass: [28, 60], picked_bass: [28, 62], finger_bass: [28, 62],
  };
  // How far past its own zone ROOTS a sample may be stretched and still be the
  // instrument — the parent's numbers (SAMPLER_STRETCH_ST / SAMPLER_FLOOR_ST).
  // Up-stretch shrieks sooner than down-stretch rumbles, hence the asymmetry.
  const STRETCH_UP = 6, STRETCH_DOWN = 12;

  // ---- FONTS, the main app's own logic ----
  // engine/faust/data/fonts.json lists fourteen. Eleven are SOUNDFONTS: a
  // font-<key>.json carries its own zones per instrument under its own media
  // base, and an instrument the font does not cover falls back to the default.
  // Two are SYNTH fonts — Pure FM and Pure Analog — and they are not a
  // different set of samples at all: they flip every pitched voice onto a
  // Faust synth and the sampler stops being used.
  const FONTS = [
    { key: "fluidr3", label: "Sampled", kind: "sample" },
    { key: "sgm", label: "SGM Pro" }, { key: "windows", label: "Seattle Glass" },
    { key: "montego", label: "Terrapin" }, { key: "sc55", label: "Oliphant" },
    { key: "gravis", label: "Gravitas" }, { key: "gba", label: "Pocket Lad" },
    { key: "emu_aps", label: "Rossum" }, { key: "diet_candy", label: "Diet Candy" },
    { key: "blackberry", label: "Thumbfruit" }, { key: "8bit", label: "8-bit" },
    { key: "dx7", label: "Pure FM", kind: "synth",
      synth: { dsp: "dx7_alg5", root: "DX7", preset: "E.PIANO 1", level: 0.9 } },
    { key: "analog", label: "Pure Analog", kind: "synth",
      synth: { dsp: "modeld", root: "modeld", level: 0.8,
               set: { cutoff: 2400, res: 0.28, envAmount: 1.6, envAttack: 0.006,
                      envDecay: 0.5, envSustain: 0.4, oscMix: 0.4, drive: 0.3,
                      glide: 0, drift: 6 } } },
  ];

  // SYNTH BASSES, offered as bass transforms: a reese IS its detuned beating
  // and a wobble IS its LFO, so neither can be a sample — the same law as the
  // 303 (see genres.js acid).
  const BASSSYNTH = {
    reese:  { dsp: "bass_reese",  root: "bass_reese",  level: 0.8,
              set: { cutoff: 900, fenvAmount: 1.2, fenvAttack: 0.005, fenvDecay: 0.35 } },
    wobble: { dsp: "bass_wobble", root: "bass_wobble", level: 0.8,
              set: { cutoff: 1200, res: 0.38, wobbleHz: 3.2, fenvAmount: 1.5,
                     fenvAttack: 0.004, fenvDecay: 0.4 } },
  };


  // ---- THE PATCH TABLES: what a GM id RESOLVES TO on the parent engine -----
  // Moved here from audio/to-engine.js (2026-08-20), because every row is an
  // INSTRUMENT-KEYED FACT — which parent voice a GM id names, and the listening
  // decision behind it — and the instrument-keyed facts live in this file,
  // beside RANGES and STRIPS, where a new id gets all of its rows in one
  // sitting. What did NOT move is the arithmetic that drives the rows: the
  // tone-block translations (the T and M objects the `set` closures receive,
  // with their measured floors and cabinet lifts) are keyed by parent DSP and
  // by the bridge's own conventions, so they stay in audio/to-engine.js
  // synthForInstr/modelForInstr/voiceForInstr/mouthForInstr, which are the four
  // readers of these tables.
  //
  // ---- THE TONE BLOCK IS A SYNTHESISER, and it always was ---------------------
  // Every one of the 110 genres carries a `tone` block, and under nukernel's own
  // WebAudio voice that block WAS the sound: two oscillators of `wave`, detuned a
  // few cents, into a resonant lowpass that opened at cut x 3.4 and shut to `cut`
  // across the note, under an atk/rel envelope at `gain`. A subtractive synth,
  // one per genre, written out in seven numbers.
  //
  // Crossing to the parent, the tone block became DECORATION — four recipe keys
  // riding on a sampled General MIDI patch — and only the 15 genres that also
  // declared a `synth` block reached a synthesiser at all. So a genre whose whole
  // identity was a saw through a filter played whatever GM instrument its `instr`
  // id happened to name, and the worst of those name synths: measured on the
  // shipped registry, `polysynth`, `warm_pad`, `halo_pad` and `metal_pad` are
  // ONE ZONE each, rooted at MIDI 84. A pad written at MIDI 45 is that single
  // high sample dragged down two and a half octaves, which is not a pad — it is
  // a breathy whistle. That is the "flute everywhere" Paul heard, and it is a
  // photograph of a synthesiser standing in for the synthesiser.
  //
  // THE FIX IS A RE-MAP, NOT NEW SYNTHESIS. The parent owns the real instruments
  // under their real names (engine/faust/dsp, VOICES.md), so a GM synth PATCH id
  // resolves to the analog voice it is a recording of, and the genre's own tone
  // block drives it. Everything else — a guitar, a piano, a choir, a horn
  // section, a gospel organ — is a RECORDED instrument and stays sampled, which
  // is the parent's default sound for good reason. The test is what the id names:
  // only the thirteen GM synth patches below are in here, and each row is that
  // patch's own instrument. (Twelve until the casting round — GM 88, "bass +
  // lead", is the 303 by another name and had no row, so the one machine this
  // whole table exists to defend was the one nobody could cast.)
  //
  // The sweep is the loudest thing the tone block ever said, and both spellings
  // of it are the SAME sweep: the parent's saw/fuzz voices take `fenv` as a
  // multiplier above cutoff (cut x (1 + fenv)), its analog fleet takes
  // `envAmount` in OCTAVES. 2.4 and log2(3.4) are cut x 3.4 said twice.
  const SWEEP = 2.4, SWEEP_OCT = 1.77;
  // the parent's oscillator alphabet (state-engine.js WAVES), spelled here
  // because one row below (bass_lead) reads its tone block's wave INDEX back as
  // a word — and this classic data tier deliberately loads no engine file.
  const WAVES = ["sine", "saw", "square", "pulse"];
  const PATCH_SYNTH = {
    // ---- the leads ----
    // GM 82 Lead 2 / GM 81 Lead 1: literally "a sawtooth" and "a square". Two
    // voices, four cents apart, because that is what the old tone block built.
    // `padDsp` is the SAME instrument seated differently: two detuned saws under a
    // chord are pad_saw and under a line are supersaw, which is precisely the pair
    // the old tone block collapsed into one WebAudio voice. Naming the real module
    // rather than the parent's role-resolved "stack" is what keeps this spec
    // loadable by BOTH readers — a recipe key can be abstract, a `dist/` fetch and
    // a `/root/param` address cannot. (One spec, two modules, so the attack floor
    // is pad_saw's 5 ms; four milliseconds is not a sound either way.)
    saw_wave:    { dsp: "supersaw", padDsp: "pad_saw", wave: "saw", set: (T) => ({
      wave: T.wave, voices: 2, detune: 0.004, octave: 0.12,
      cutoff: T.cut, res: T.res, fenv: SWEEP,
      attack: Math.max(0.006, T.atk), release: T.rel, sustain: 0.85 }) },
    square_lead: { dsp: "supersaw", padDsp: "pad_saw", wave: "square", set: (T) => ({
      wave: T.wave, voices: 2, detune: 0.004, octave: 0.12,
      cutoff: T.cut, res: T.res, fenv: SWEEP,
      attack: Math.max(0.006, T.atk), release: T.rel, sustain: 0.85 }) },
    // GM 85 Lead 5 (charang) — the buzzing guitar-synth lead. lead_fuzz is the
    // parent's tanh-driven voice and the buzz IS the drive.
    // (lead_fuzz's own resonance stops at 0.47 — its tanh drive is doing half the
    // work a ladder would, and a tone block screaming q 11 must not be written
    // onto the ceiling)
    charang:     { dsp: "lead_fuzz", wave: "saw", set: (T) => ({
      cutoff: T.cut, res: Math.min(0.45, T.res), drive: 0.5, fenv: SWEEP,
      attack: T.atk, release: T.rel, sustain: 0.7 }) },
    // GM 87 Lead 7 (fifths) — a saw and its fifth. synclead hard-syncs at
    // syncRatio, and 1.5 is that fifth: the interval is in the oscillator rather
    // than in a second sample, which is the whole difference.
    fifth_sawtooth_wave: { dsp: "synclead", wave: "saw", set: (T) => ({
      cutoff: T.cut, res: T.res, syncRatio: 1.5, syncSweep: 1.2, syncDecay: 0.18,
      envAmount: SWEEP_OCT, envDecay: 0.16, detune: 8, drive: 0.3,
      attack: T.atk, release: T.rel, sustain: 0.8 }) },
    // GM 103 (echoes / echo drops) — a struck metallic ping that rings away. The
    // parent's `bell` takes its decay from the note length, which is what a drop
    // does; dub's delay send does the echoing, as it always did.
    echo_drops:  { dsp: "bell", set: (T) => ({ cutoff: T.cut, res: T.res }) },
    // GM 88 Lead 8 (bass + lead) — the one GM patch whose NAME is a monosynth
    // playing the bassline and the tune with the same voice, which is the 303's
    // entire job. So the id routes to tb303 and the SQUELCH becomes castable:
    // acid declares the machine as its own signature synth, and this is how any
    // other chair in any other genre can hire one.
    // Its ceilings are the module's own and not the table's — tb303 declares
    // cutoff 60..6000 and decay 0.03..2.5, both narrower than the T bounds
    // above, and a value written ON a declared edge is the failure the bounds
    // paragraph exists to avoid. `waveform` is a 0..1 morph, not an index: 0 is
    // the saw every acid record is, and only a tone block that says "square"
    // gets one.
    bass_lead:   { dsp: "tb303", wave: "saw", set: (T) => ({
      cutoff: Math.min(5800, T.cut), resonance: Math.min(0.92, 0.3 + T.res),
      envmod: T.env != null ? T.env : Math.min(0.9, 0.25 + T.res),
      decay: Math.min(2.4, Math.max(0.1, T.rel)),
      waveform: WAVES[T.wave] === "square" || WAVES[T.wave] === "pulse" ? 1 : 0 }) },
    // ---- the pads ----
    // GM 91 Pad 3 (polysynth) — a poly analog. The Juno-60 is one, with its BBD
    // chorus, and the chorus is why a Juno pad sounds wide without a reverb.
    polysynth:   { dsp: "juno60", set: (T) => ({
      cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT,
      sawLevel: 0.7, pulseLevel: 0.5, subLevel: 0.2, pwmBase: 0.48, pwmLfo: 0.15,
      chorus: 1.2, spread: 0.8,
      attack: T.atk, decay: 0.6, sustain: 0.6, release: T.rel }) },
    // GM 90 Pad 2 (warm) and GM 93 Pad 5 (bowed glass) are the SAME instrument
    // arriving differently — a Prophet/SEM-class poly — so they share `oberheim`
    // and differ where they actually differ: the bow takes a second and a half to
    // speak and half the sweep, the warm pad speaks at the tone block's own
    // attack. Naming two models to make a table look varied would be the lie.
    warm_pad:    { dsp: "oberheim", set: (T) => ({
      cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT,
      envAttack: 0.6, envDecay: 1.4, envSustain: 0.7, detune: 9, drive: 0.12,
      attack: T.atk, release: T.rel, sustain: 0.8 }) },
    bowed_glass: { dsp: "oberheim", set: (T) => ({
      cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT * 0.5,
      envAttack: 1.6, envDecay: 2.4, envSustain: 0.85, detune: 6, drive: 0.06,
      attack: Math.max(T.atk, 0.25), release: T.rel, sustain: 0.9 }) },
    // GM 95 Pad 7 (halo) — the bright scanning wash. ppg's `scan` is a wavetable
    // position and sweeping it slowly is what a halo is.
    halo_pad:    { dsp: "ppg", set: (T) => ({
      cutoff: T.cut, res: T.res, scan: 0.3, scanEnv: 0.35, scanLfo: 0.08,
      scanRate: 0.22, envAmount: SWEEP_OCT * 0.6, sub: 0.2, drive: 0.1,
      attack: T.atk, release: T.rel, sustain: 0.9 }) },
    // GM 94 Pad 6 (metallic) — the CZ's phase distortion is where that clangy
    // digital edge comes from, and `dcw*` is the contour that makes it metal.
    metal_pad:   { dsp: "casiocz", set: (T) => ({
      cutoff: T.cut, wave: 0.75, index: 0.45,
      dcwAmount: 0.8, dcwAttack: 0.004, dcwDecay: 0.5, dcwSustain: 0.3, detune: 7,
      attack: T.atk, decay: 0.3, sustain: 0.8, release: T.rel }) },
    // GM 55 (synth voice) — the VP-330 IS the synthesised choir, vowel and all.
    // (a choir cannot speak in two milliseconds and the module says so: vp330's
    // attack floor is 5 ms, so the tone block's snappiest is held just off it
    // rather than written onto it)
    synth_voice: { dsp: "vp330", set: (T) => ({
      cutoff: T.cut, vowel: 0.35, breath: 0.18, ensemble: 0.7, detune: 0.45,
      attack: Math.max(0.006, T.atk), sustain: 0.9, release: T.rel }) },
    // GM 51 (synth strings) — the Solina/ARP string ensemble, which is what every
    // record meaning "synth strings" was actually playing. Its chorus is the
    // instrument, so the parent drops inserts on it and so should we.
    synth_strings_1: { dsp: "solina", set: (T) => ({
      tone: T.cut, octave: 0.55, ensemble: 0.85, chorusRate: 0.62, chorusDepth: 0.9,
      attack: T.atk, release: T.rel }) },
  };

  // ---- AND THE ONES THAT ARE INSTRUMENTS, NOT PHOTOGRAPHS OF THEM ------------
  // PATCH_SYNTH above is a rescue: those thirteen GM ids are recordings OF
  // synthesisers, so playing the synthesiser instead is simply telling the truth.
  // This table is a different claim, and a bigger one — that for a handful of
  // REAL instruments a physical model is BETTER than the recording, because the
  // thing those instruments do that a recording cannot is ANSWER THE PLAYER.
  //
  // The test is one question: is this instrument's character its DYNAMICS? Every
  // sampler in the library is one velocity layer — six zones across the keyboard
  // and one recording per zone — so on a sampled voice velocity is a fader and
  // nothing else. That is fine for a piano (whose sampled zones are ten deep and
  // whose character is its body) and it is a lie for the two families here:
  //
  //   THE ELECTRIC GUITAR is a string, a pickup and an AMPLIFIER, and the
  //   amplifier is the part that answers how hard you hit it. A sampled
  //   distortion guitar plays a quiet recording of a loud note; the model plays
  //   a quiet note, which comes out clean, on the same instrument that screams
  //   when you dig in. This is the "crunch" that was missing: not a fuzz box on
  //   the strip, a gain structure inside the voice.
  //   THE STRUCK BAR (marimba, vibraphone, kalimba tine) is nothing but its
  //   strike: a soft yarn mallet excites the fundamental and a hard plastic one
  //   rings the bar modes where the click lives. Measured on the tape at equal
  //   loudness, a ghosted note and a hammered one differ by a factor of two in
  //   spectral centroid; the sampled zone they replace differs by nothing.
  //
  // AND THE ACOUSTIC GUITARS ARE STILL NOT HERE, on purpose. A steel-string, a
  // nylon and a banjo are BODIES — a soundboard, a back, a membrane head — and a
  // recording of a body is exactly what a sample is good at. Neither the old
  // waveguide nor the toolkit's string has a body at all, so both would give up
  // the one thing that makes those three themselves. Same for the organs, whose
  // sound is a rank of pipes and not an excitation.
  //
  // THE PIANOS USED TO BE IN THAT SENTENCE AND THEY ARE NOT ANY MORE. The reason
  // given was "ten-deep zones", and it was wrong — counted, not remembered, the
  // deepest piano in the library has ONE recording per key range like everything
  // else. The piano rows below are what that correction bought.
  //
  // THREE MORE WERE TRIED AND MEASURED OUT, which is worth writing down because
  // "we did not get to it" and "we got to it and it was worse" are different
  // facts. Compiled against this repo's own libfaust and rendered:
  //   pm.brassModel   SILENT below 300 Hz — a trumpet's bottom octave produces
  //                   nothing at all — and it collapses above pressure 0.5 at
  //                   330 Hz, so its usable window is a fifth wide and the
  //                   failure mode outside it is silence. Its pitch also runs 5%
  //                   sharp. The parent's saw-stack `brass` (which already takes
  //                   its bite from the note's amp) keeps the horns.
  //   pm.violinModel  loudness is NOT monotone in bow force: at 262 Hz the middle
  //                   dynamic measured QUIETER than the softest one, and two of
  //                   six pitches came back an octave out. A bowed string whose
  //                   forte might be its pianissimo is not an instrument.
  //   pm.clarinetModel is the one that works — pitch exact from 147 to 587 Hz and
  //                   a reed that genuinely opens up (centroid 667 -> 1347 Hz
  //                   across its breath range) — and it is not here because
  //                   nothing in the catalogue casts a clarinet. A cylindrical
  //                   reed standing in for the conical tenor sax two genres DO
  //                   cast would be a different instrument wearing its name.
  //
  // AND THEN THE WHOLE FAUST SYNTHESIS TOOLKIT WAS MEASURED, 2026-08, because
  // three hand-rolled models is not a good answer when the reference
  // implementations exist. Nineteen faust-stk instruments, compiled against this
  // repo's own libfaust (2.85.8) and rendered offline in node — never a browser,
  // never a render farm, one note at a time through
  // engine/faust/build/measure-instrument.js. Four could not compile at all
  // (bass, harpsi, modalBar, voiceForm call C++ `ffunction` lookup tables, which
  // wasm has no way to link; porting their .h files to Faust `waveform` tables is
  // a day's work each and nobody has needed them yet). Of the fifteen that did:
  //
  //   ADOPTED
  //   NLFeks          in tune to 0.0 CENTS at 82/165/330/659 Hz with no
  //                   correction at all, and its own dynamic-level filter was
  //                   commented out in the published file. -> stk_guitar
  //   piano1          fundamental is the loudest partial, decay 1.0-1.4 s and it
  //                   varies with register and with velocity, and its per-key
  //                   soft/loud hammer tables were wired to the constant 1.
  //                   -> stk_piano
  //
  //   MEASURED OUT
  //   brass           the octave-and-a-fifth problem again, from the other
  //                   direction: asked for 165 Hz it produced 347, asked for 330
  //                   it produced 698, and at MIDI 76 it is silent below full
  //                   pressure. Non-monotone at MIDI 52. Same verdict as
  //                   pm.brassModel, now reached twice by two different codebases.
  //   fluteStk        +19 to +49 cents at full pressure and a different OCTAVE at
  //                   anything less; at 0.6 pressure a 262 Hz ask came back 574.
  //   sitar           -11 to -15 cents and an octave error at MIDI 76. The jawari
  //                   is a randomly modulated delay line and up top the modulation
  //                   is a larger fraction of the period than the period.
  //   tunedBar,       pitch is excellent (within 3 cents) and the bodies are pure,
  //   uniBar,         but all four peak at 1e-3 to 1e-4 — 60-80 dB down — and
  //   glassHarmonica, three of them are NON-MONOTONE in the strike at the top of
  //   tibetanBowl     their range. `mallet` beside them is louder, monotone and
  //                   already cast; these are colour nobody has asked for yet.
  //
  //   MEASURED GOOD AND PARKED, which is a third thing and worth writing down
  //   clarinet        pitch -5 to -21 cents, 86-96% of its energy in the
  //                   fundamental, monotone, and the reed genuinely opens.
  //   saxophony       pitch +2 to +10 cents from 116 to 466 Hz, up to 92% body,
  //                   monotone. tenor_sax is cast twice in this catalogue and
  //                   this would be an improvement on the zone.
  //                   BOTH have a hard speaking threshold — under about 0.75
  //                   pressure they do not sound at all, which is physically
  //                   correct for a reed and dangerous in a generative engine
  //                   that will hand a voice any velocity. Adopting either means
  //                   mapping velocity into a narrow band ABOVE the threshold and
  //                   letting the note's amp carry the rest, which is a design
  //                   decision and not a port. Next round.
  //   bowed           +5 to +17 cents (consistently sharp, so fittable) and this
  //                   time loudness IS monotone in bow force, unlike
  //                   pm.violinModel. But its body share jumps between 0.6% and
  //                   39% across three pitches at one bow pressure, which is the
  //                   bow slipping between regimes. Not until that is understood.
  //
  // The genre's own tone block drives these too — `cut` becomes the speaker
  // cabinet's corner (a guitar cab lives an octave or so above where a synth
  // filter sits, hence the lift), `rel` how long the hand lets the note ring,
  // `gain` the voice level — exactly as it drives the synth table above.
  const PATCH_MODEL = {
    // ---- the electrics ----
    // THE STRING UNDER ALL SIX IS THE TOOLKIT'S NOW (engine/faust/dsp/
    // stk_guitar.dsp — Julius Smith's extended Karplus-Strong out of faust-stk,
    // through the amp and cabinet this repo fitted against the sampled zones).
    // The waveguide these rows were written for is still in the tree and it was
    // measured out: at MIDI 40 its loudest partial was the SEVENTH and the
    // fundamental was 34.6 dB down — 0.0% of the note's energy inside a semitone
    // of 82 Hz — which is the "plinky" this whole family was named for. The EKS
    // is in tune to under one cent from MIDI 40 to 96 with no fitted correction,
    // and its spectral centroid moves x1.5 to x2.7 across the plectrum where the
    // waveguide's moved x1.05.
    //
    // The six recipes below are the SAME SIX GUITARS, translated: `damp` (a loop
    // coefficient) becomes `ring` (the string's -60 dB time in seconds), `stiff`
    // becomes `bright` (the damping filter's tilt, which is what string stiffness
    // audibly is), and `pluckPos` is measured from the nearer end so 0.78 and
    // 0.22 are the same pluck. Nothing about which guitar is which has moved.
    //
    // GM 28 (clean electric). The most-cast instrument in the table by a factor
    // of four, and the one whose sampled version has the least to say: a clean
    // electric IS its pick attack, and the sample has one.
    //
    // EVERY ELECTRIC DECLARES ITS OWN INSERTS (the de-jangle round,
    // 2026-08-21): a chording guitar rides the parent's `pad` strip
    // (CHAIR_ROLE stab -> pad, which keeps the body in the chord), and a
    // recipe with NO inserts gets defaultInserts' pad chain there — chorus at
    // mix 0.28 plus a leslie or phaser, which is the jangle. A NON-EMPTY
    // kernel inserts array overrides the default entirely (state-engine
    // insertChain law), so each amp names its own pedalboard: the cleans a
    // chorus an octave subtler than the pad default, the dirty three the
    // parent's own staged insert_higain (compiled all along, declared by
    // nobody until now) at three amounts of amp, the mute a tight gated one
    // with the presence up.
    clean_guitar:      { dsp: "stk_guitar",
      inserts: [{ type: "chorus", rate: 0.7, depth: 0.35, mix: 0.12 }],
      set: (M) => ({
      drive: 0.16, pluckPos: 0.22, pickup: 0.30, bright: 0.55, ring: 4.0,
      cutoff: M.cab, release: M.rel }) },
    // GM 27 (jazz electric) — neck pickup, no dirt, and the tone rolled off. The
    // pickup is the whole difference between this and the clean above.
    jazz_guitar:       { dsp: "stk_guitar",
      inserts: [{ type: "chorus", rate: 0.5, depth: 0.25, mix: 0.08 }],
      set: (M) => ({
      drive: 0.04, pluckPos: 0.38, pickup: 0.50, bright: 0.30, ring: 3.0,
      cutoff: Math.min(M.cab, 3200), release: M.rel }) },
    // GM 29 (palm muted) — the mute is the STRING's own decay and a short hand,
    // which is what a palm mute physically is, plus enough gain to chug. 0.23 s
    // of ring measures as a 140 ms chug on a real pluck; the old coefficient
    // spelling of the same idea left the string sustaining for a full second.
    palm_muted_guitar: { dsp: "stk_guitar",
      inserts: [{ type: "higain", gate: 0.6, drive: 0.55, stages: 2,
        low: 0.62, mid: 0.5, high: 0.45, presence: 0.6, level: 0.65, mix: 1 }],
      set: (M) => ({
      drive: 0.38, pluckPos: 0.10, pickup: 0.12, bright: 0.62, ring: 0.23,
      cutoff: M.cab, release: 0.06 }) },
    // crunch, overdrive, distortion: ONE instrument at three amounts of
    // amplifier, which is what those three words have always meant. The sampled
    // trio are three separate recordings pretending to be that, and none of them
    // can be played quietly.
    // ...RE-STAGED 2026-08-21 ("blues are very saturated almost like thrash"):
    // measured offline (4-note riff, A2 region, crest factor / spectral tilt),
    // the old crunch (string drive .55 into higain .32 level .7) played at
    // +14.3 dB over the jazz box and its crest collapsed to 9.5 dB at a hard
    // pick — overdrive territory (9.0), thrash to the ear. Crunch means the
    // EDGE of breakup: string drive .26, one stage at .14, level .42 measures
    // (at the page's true cab) crest 13.6 dB mid / 10.7 hard against jazz
    // 13.4/14.1 and overdrive 8.9/7.6 — the warm side of the fence — and
    // +6.5 dB over the jazz box instead of +16.4. Digging in still
    // compresses, which is what an amp on the edge does; it no longer
    // becomes a different amp.
    crunch_guitar:     { dsp: "stk_guitar",
      inserts: [{ type: "higain", gate: 0.3, drive: 0.14, stages: 1,
        low: 0.55, mid: 0.5, high: 0.44, presence: 0.4, level: 0.42, mix: 1 }],
      set: (M) => ({
      drive: 0.26, pluckPos: 0.16, pickup: 0.2, bright: 0.58, ring: 5.0,
      cutoff: M.cab, release: M.rel }) },
    // (the drive and the two stages ARE rock's sound and stay; only the
    // insert's output comes down 2.7 dB with the same measurement — the tier
    // sat +12.7 dB over the jazz box, level .5 lands it at +10)
    overdrive_guitar:  { dsp: "stk_guitar",
      inserts: [{ type: "higain", gate: 0.35, drive: 0.5, stages: 2,
        low: 0.55, mid: 0.48, high: 0.42, presence: 0.42, level: 0.5, mix: 1 }],
      set: (M) => ({
      drive: 0.58, pluckPos: 0.16, pickup: 0.22, bright: 0.58, ring: 5.5,
      cutoff: M.cab, release: M.rel }) },
    distortion_guitar: { dsp: "stk_guitar",
      inserts: [{ type: "higain", gate: 0.45, drive: 0.72, stages: 3,
        low: 0.6, mid: 0.42, high: 0.45, presence: 0.48, level: 0.62, mix: 1 }],
      set: (M) => ({
      drive: 0.82, pluckPos: 0.12, pickup: 0.16, bright: 0.64, ring: 6.0,
      cutoff: Math.min(M.cab, 4000), release: M.rel }) },
    // ---- the pianos ----
    // AND THE PIANOS ARE HERE NOW, on a measurement that overturns the reason
    // they were not. The note that used to sit below this table said pianos stay
    // sampled because their "zones are ten deep" — ten VELOCITY layers, which
    // would make a recording the better piano. Counted on the shipped registry:
    // yamaha_grand_piano and bright_yamaha_grand are 6 zones and upright_piano
    // and felt_piano are 10, and in every one of the four the zones tile the
    // KEYBOARD with exactly ONE recording per key range. There is not a second
    // dynamic anywhere in the library. A sampled fortissimo is a sampled
    // pianissimo turned up, on the instrument whose entire expressive range is
    // the hammer.
    //
    // What plays them now is the FAUST-STK commuted waveguide piano — a
    // noise-excited soundboard through a frequency-dependent hammer into three
    // coupled strings per note, with the hammer's soft and loud filter poles
    // MEASURED per key and crossfaded by velocity. Dumped partial by partial at
    // MIDI 52: soft, the fundamental leads and the fourth harmonic is 17.8 dB
    // down; hard, the fourth harmonic IS the loudest thing in the note. That is
    // the sound a piano makes when you lean on it, and no zone can make it.
    //
    // `hammer` is not set here — the note's own velocity writes it, through
    // the parent's own MODEL_DYN ranges (state-engine.js, read back by
    // audio/to-engine.js liveModel), the same way the plectrum is written on the
    // six guitars.
    // `bright`/`stiff`/`detune` are the four pianos' own characters.
    yamaha_grand_piano:  { dsp: "stk_piano", set: (M) => ({
      bright: 0.25, stiff: 0.28, detune: 0.10, cutoff: M.mcut, release: M.rel }) },
    bright_yamaha_grand: { dsp: "stk_piano", set: (M) => ({
      bright: 0.55, stiff: 0.34, detune: 0.12, cutoff: M.mcut, release: M.rel }) },
    // an upright is a shorter string in a smaller box: stiffer (more
    // inharmonicity per unit length), less unison spread, and it stops sooner.
    upright_piano:       { dsp: "stk_piano", set: (M) => ({
      bright: 0.32, stiff: 0.44, detune: 0.16, cutoff: Math.min(M.mcut, 7000),
      release: Math.min(M.rel, 0.4) }) },
    // felt is a strip of cloth between hammer and string — the top of the
    // spectrum simply does not happen, and the unisons drift because nobody
    // tunes a prepared piano twice.
    felt_piano:          { dsp: "stk_piano", set: (M) => ({
      bright: 0.0, stiff: 0.22, detune: 0.22, cutoff: Math.min(M.mcut, 4200),
      release: M.rel }) },
    // ---- the struck bars ----
    // GM 12 (marimba) — rosewood. `ring` is the T60 of the LOWEST bar mode and
    // the library's own 0.1 s is a bar that has stopped before the player's hand
    // has: measured against the sampled zone it stands in for, the model was 14 dB
    // down on the tape purely because the note was over. Half a second is a real
    // rosewood bar, and `tilt` still kills the upper modes first, which is what
    // makes it read short.
    marimba:    { dsp: "mallet", set: (M) => ({
      ring: 0.5, exPos: 1, tilt: 6, cutoff: M.mcut, release: 1.5 }) },
    // GM 11 (vibraphone) — aluminium bars and a pedal, so it rings for a second
    // and a half and note-off means something (the damper comes down).
    vibraphone: { dsp: "mallet", mul: 0.58, set: (M) => ({
      ring: 2.2, exPos: 1, tilt: 4, cutoff: M.mcut, release: 0.35 }) },
    // GM 108 (kalimba) — a plucked tine over a box: between the two, and softer
    // up top, because a thumb is the softest mallet there is.
    kalimba:    { dsp: "mallet", mul: 0.50, set: (M) => ({
      ring: 0.8, exPos: 1.4, tilt: 7, cutoff: Math.min(M.mcut, 7000), release: 1.5 }) },
    // AND NOT THE MUSIC BOX, which was in this table for a day. Every row here is
    // a bar over a RESONATOR TUBE, because that is what the model is; a music box
    // is a comb tooth screwed to a wooden case and has no tube at all, and the one
    // it was given pulled it down where a music box does not live — measured, a
    // centroid of 1145-2243 Hz against the sampled comb's 2788-3014. The zone
    // recording is the better music box and it keeps the job.
  };

  // ---- AND THE ONE INSTRUMENT EVERY LISTENER OWNS ----------------------------
  // A voice is the only thing in the catalogue the ear grades against something
  // it hears all day, and sampled it is the flattest sound in the library.
  // Measured on the shipped registry: `solo_vox`, `ahh_choir` and `ohh_voices`
  // are six zones and ONE recording each. So a sung line is that one held "aah"
  // transposed — one dynamic, one vowel it can never leave, and the take's own
  // vibrato baked in and beating against every other note in the chord. That is
  // the squeak Paul heard ("the vocals are just squeaky"), and unlike the pads it
  // is not even a bad recording: it is what a recording of a vowel IS.
  //
  // The parent grew a vocal tract for it (engine/faust/dsp/voice_tract.lib and
  // its two seatings), and the point of a tract is that the VOWEL IS A SIGNAL: a
  // line can move through it, a section can hold one, and the dynamic opens the
  // voice instead of turning it up. Same claim as the guitar amp and the struck
  // bar one table up, on the instrument where it matters most.
  //
  // WHICH ID IS WHICH SEATING is decided by what the id has always named:
  // GM 85 "Lead 6 (voice)" is a soloist and gets the LEAD; GM 52/53/91 are choir
  // aahs, voice oohs and a choir pad, and get the SECTION. GM 54 "synth voice" is
  // NOT here on purpose — it is a photograph of a VP-330, an actual machine the
  // parent owns, and PATCH_SYNTH already sends it there. A Roland string-choir is
  // not a person and should not be modelled as one.
  //
  // The `vowels` on each row are what the GM id itself means — aahs are open,
  // oohs are round — and they are what a genre with no mouth of its own sings.
  //
  // `phase` is what happens when a genre DOES have a mouth and casts two of these
  // at once, which four of them do (gospel and doowop take both the aahs and the
  // oohs). One mouth per genre is right — a group is one group — but two sections
  // singing the identical syllable at the identical moment is one section twice.
  // So the id ROTATES the genre's word: the aahs sing it from the top, the oohs a
  // syllable behind. Doowop's "ou" comes out as o-u against u-o, which is what
  // four men round a microphone actually do, and it costs no new vocabulary.
  // A LEAD IS SYNTHESISED; A CHORUS IS RECORDED. "Keep it a
  // soloist and use sampled choruses for choral arrangements."
  //
  // This reverses a judgement made the day before, and the reversal is right. The
  // lane that built voice_choir argued the sampled choirs are the flattest thing in
  // the catalogue — six zones, one recording, one dynamic, and the take's own
  // vibrato baked in and beating against every other note of the chord. All true,
  // and all of it matters on an EXPOSED LEAD, where one voice is naked and its one
  // vibrato is the only movement there is. It matters much less under a PAD, and a
  // recorded ensemble brings the two things four detuned formant voices cannot
  // synthesise: a room, and forty people not agreeing.
  //
  // The measurement agreed before the ear did. gregorian's choir read 0.998-1.000
  // L/R correlation at the master while its width demonstrably arrived at the unit
  // — so the synthesised chorus was not even delivering the spread it was chosen
  // for, and was paying four voices for a mono result.
  //
  // So solo_vox keeps voice_lead, which is where a formant model earns its place:
  // one voice, moving continuously through a vowel, in front. The three CHORAL ids
  // fall through to the sampled library again. Fourteen genres change back —
  // gregorian, spem, bulgarian, hymn, doowop, the Beatles' and the boy band's
  // backing stacks — and every one of them is a chorus, not a soloist.
  /* ---------- THE PEDALBOARD A SAMPLED VOICE MAY DECLARE ------------------
     Every electric in PATCH_MODEL names its own inserts (the de-jangle round,
     2026-08-21) because a recipe with none gets defaultInserts' pad chain.
     A SAMPLED voice is the other case: the parent gives it no default chain at
     all (state-engine's absent-law), so a recording arrives dry — which is
     right for a nylon-string and wrong for a DI.

     THE PARENT HAS HONOURED THIS ALL ALONG (state-engine
     INSERTS-ON-SAMPLED-VOICES: an explicit `inserts` array on a sampler unit is
     normalized by insertChain and run on the native PCM lane, in press and
     live both). Nothing in nukernel ever wrote one, so the one instrument in
     the registry that REQUIRES an amp was unclaimable: registry-data's own
     header says di_guitar — the FreePats FSBS direct pickup, -27 dB RMS by
     design — should be claimed "ONLY behind an insert_higain staged amp".
     This table is that amp, and audio/to-engine.js's sampler branch is where
     it is handed over.

     WHY THE STAGING DIFFERS FROM distortion_guitar's. The modelled electrics
     drive the STRING first (`drive: 0.82`) and the insert second; a recording
     has no string to lean on, so the whole gain structure lives in the insert
     — one more notch of drive, all three stages, the gate low enough not to
     swallow a signal that starts 27 dB down, and the level up to bring it back
     level with the rest of the rack. Measured against the modelled distortion
     in the same bar (see the round's report): a DIFFERENT amp, not a fourth
     amount of the same one — the cab tilt is the FSBS recording's, not the
     4x12 the model plays through.

     `heavyDriveOf` is NOT also fired: the parent's own note is that a sampled
     voice declaring higain must not carry heavy strip distortion too, because
     the amp IS the drive. Which is also why di_guitar stays in the plain
     `guitar` family below rather than joining `dirty`. */
  const SAMPLED_INSERTS = {
    di_guitar: [{ type: "higain", gate: 0.22, drive: 0.8, stages: 3,
      low: 0.58, mid: 0.46, high: 0.46, presence: 0.5, level: 0.85, mix: 1 }],
  };

  const PATCH_VOICE = {
    solo_vox:    { dsp: "voice_lead",  voice: "tenor", vowels: "ao", syll: 0.5, phase: 0 },
  };

  // ---- AND THE MOUTH THAT TALKS (the table half; the chair law that decides
  // WHO gets one lives with the dispatch, audio/to-engine.js mouthForInstr) ---
  // THERE ARE NO VOICE TYPES ON A TRACT, which is the other half of why this is
  // its own table rather than a fourth PATCH_VOICE row. The five singers each pick
  // a formant set and a compass because the CSOUND tables only tell the truth
  // inside one voice's range; the tube has one size, so it has one mouth and one
  // register, and what a genre says about it is not WHO is speaking but WHAT THE
  // MOUTH IS DOING.
  const PATCH_MOUTH = {
    // ONE ROW. Adding a second id here is adding a second way to buy the most
    // expensive voice in the fleet, so it should be an argument somebody makes.
    //
    // The defaults are what the ID itself means — a machine voice, pronouncing,
    // fairly dry-mouthed and only slightly nasal — and they are what a genre with
    // no mouth of its own gets, exactly as PATCH_VOICE's `vowels` are.
    //   talk   how much of the seeded syllable driver is steering. 0.82 is
    //          speech with the vowel axis still tinting it; 1 is the driver alone
    //          and 0 is a held vowel, which is not a tract's job and refuses.
    //   hiss   the fricative — the s and the sh, the part of a voice a formant
    //          bank simply does not have
    //   nasal  the velum, barely open: a machine voice with a little nose in it
    //   vowels the walk under the driver, and the three that keep a robot from
    //          sounding like a yawn
    synth_voice: { dsp: "tract_voice", vowels: "aeo", syll: 0.5,
                   talk: 0.82, hiss: 0.16, nasal: 0.06, air: 0.05, vib: 0.1 },
  };

  // ONE EXPORT, keyed by KIND first and id second — never one flat id-keyed
  // map, because `synth_voice` honestly appears twice: on a pad it is the
  // VP-330 photograph in `synth`, on a line it is the talking tract in
  // `mouth`, and the CHAIR (not this data) decides which a genre meant.
  // audio/to-engine.js destructures the four kinds back under their old names.
  const PATCHES = { synth: PATCH_SYNTH, model: PATCH_MODEL,
                    voice: PATCH_VOICE, mouth: PATCH_MOUTH };

  // CHANNEL STRIPS — STRIP_PROFILES lifted from engine/faust/voices/
  // state-engine.js and handed to SamplerLive as `strip`. sampler.js then
  // builds the real chain (HPF/LPF/EQ -> saturation -> compressor ->
  // chorus/phaser), which is why a bass sits under a lead instead of beside it.
  const STRIPS = {
    // BASS — kill subsonics, roll the top off, low-mid warmth, slow glue comp.
    bass: { hpf: 30, lpf: 5200, eq: { f: 110, gain: 2.5, q: 0.9 }, sat: 0.34, satMix: 0.42,
            comp: { thresh: 0.22, ratio: 3, atk: 0.02, rel: 0.18, makeup: 1.05 }, trim: 0.98 },
    // PAD — declutter the lows, scoop a little mud, wide ensemble chorus + a
    //   slow shallow phaser. The widest air: pads carry the space.
    pad: { hpf: 120, eq: { f: 300, gain: -1.5, q: 0.8 }, sat: 0.17, satMix: 0.3,
           comp: { thresh: 0.3, ratio: 2, atk: 0.03, rel: 0.28, makeup: 1.02 },
           chorus: { rate: 0.45, baseMs: 14, depthMs: 6, mix: 0.32 },
           phase: { rate: 0.22, lo: 300, hi: 1600, stages: 4, mix: 0.18 }, trim: 0.9 },
    // LEAD — clear the rumble, presence lift at 3 kHz, a touch of grit, fast comp.
    lead: { hpf: 200, eq: { f: 3000, gain: 3, q: 0.8 }, sat: 0.3, satMix: 0.44,
            comp: { thresh: 0.25, ratio: 3, atk: 0.008, rel: 0.12, makeup: 1.04 },
            chorus: { rate: 0.8, baseMs: 11, depthMs: 4, mix: 0.18 }, trim: 0.95 },

    // ---- THE FAMILY STRIPS, and why they exist -----------------------------
    // POST ROCK IS THE ONE THAT WORKS, so it is worth saying exactly why:
    // slow strings on the PAD strip holding MIDI ~47, a clean guitar on the
    // LEAD strip at ~63, a second clean guitar at ~77 — three voices, three
    // registers, twenty-nine semitones between the outer means, in a genre
    // that asks for verb 0.72. Nothing collides, so nothing needs carving, and
    // the reverb reads as depth rather than as fog. The transferable part is
    // NOT its instruments; it is that every voice got a strip written for the
    // instrument in it.
    //
    // THREE strips could not do that. Every non-pad pitched voice on the page
    // took `lead` whatever it was, so an upright piano, a Rhodes, a choir and a
    // marimba were all high-passed at 200 Hz and given a 3 dB lift at 3 kHz —
    // motown's piano lost its left hand, spem's choir lost its chest and gained
    // a hiss. These are the parent's own profiles re-cut per family
    // (state-engine STRIP_PROFILES + aggressiveStrip + samplerFamily); the
    // three above are untouched, so anything already sitting right still does.
    //
    // KEPT LEAN ON PURPOSE: sampler.js builds the strip PER NOTE, so a chorus
    // or a phaser is real nodes on every note. Only `pad` carries both (pads
    // play few, long notes). An organ leslie was written and dropped for the
    // same reason — the fugue is four organ voices in sixteenths.
    keys: { hpf: 40, eq: { f: 2600, gain: 1.5, q: 0.7 }, sat: 0.18, satMix: 0.3,
            comp: { thresh: 0.28, ratio: 2.6, atk: 0.005, rel: 0.16, makeup: 1.03 },
            trim: 0.95 },
    guitar: { hpf: 90, eq: { f: 2400, gain: 2, q: 0.8 }, sat: 0.26, satMix: 0.4,
              comp: { thresh: 0.26, ratio: 3, atk: 0.006, rel: 0.13, makeup: 1.04 },
              trim: 0.95 },
    // the parent's aggressiveStrip shape: scoop the mids, bite at 3.2 kHz, real
    // tanh fuzz. A crunch/overdrive/distortion sample is recorded clean-ish and
    // came out timid for exactly the reason the parent documents.
    dirty: { hpf: 95, eq: { f: 640, gain: -4, q: 0.9 }, eq2: { f: 3200, gain: 3, q: 0.7 },
             sat: 0.62, satDrive: 6, satMix: 0.8,
             comp: { thresh: 0.22, ratio: 3.5, atk: 0.008, rel: 0.12, makeup: 1.08 },
             trim: 0.94 },
    mallet: { hpf: 140, eq: { f: 4200, gain: 1.5, q: 0.8 }, sat: 0.14, satMix: 0.26,
              comp: { thresh: 0.3, ratio: 2.4, atk: 0.004, rel: 0.1, makeup: 1.02 },
              trim: 0.92 },
    organ: { hpf: 60, eq: { f: 1800, gain: 1.5, q: 0.7 }, sat: 0.24, satMix: 0.38,
             comp: { thresh: 0.28, ratio: 2.6, atk: 0.012, rel: 0.2, makeup: 1.03 },
             trim: 0.92 },
    // VOICES MUD FIRST. A sampled choir's energy sits right where every other
    // voice's fundamental is, so the dip at 400 is doing more work than the air
    // lift: this is the carve the parent applies to collisions, made standing
    // for a family that collides with everything.
    vox: { hpf: 110, eq: { f: 400, gain: -2.5, q: 0.9 }, eq2: { f: 6000, gain: 2, q: 0.7 },
           sat: 0.16, satMix: 0.28,
           comp: { thresh: 0.3, ratio: 2.6, atk: 0.02, rel: 0.24, makeup: 1.04 },
           trim: 0.92 },
    brass: { hpf: 150, eq: { f: 2500, gain: 2, q: 0.8 }, sat: 0.3, satMix: 0.42,
             comp: { thresh: 0.22, ratio: 3.5, atk: 0.006, rel: 0.14, makeup: 1.05 },
             trim: 0.92 },
    reed: { hpf: 130, eq: { f: 2200, gain: 1.5, q: 0.8 }, sat: 0.24, satMix: 0.36,
            comp: { thresh: 0.26, ratio: 3, atk: 0.008, rel: 0.16, makeup: 1.04 },
            trim: 0.93 },
    bowed: { hpf: 110, eq: { f: 3000, gain: 1.5, q: 0.9 }, sat: 0.16, satMix: 0.3,
             comp: { thresh: 0.3, ratio: 2.4, atk: 0.03, rel: 0.25, makeup: 1.03 },
             trim: 0.93 },
    // A SECTION IS NOT A LEAD. Sampled strings sit low and wide — vaporwave's
    // second voice averages MIDI 42, whose fundamental is 185 Hz, and the lead
    // strip's 200 Hz high-pass was deleting it. Pad-lite: keep the body, find
    // the bow at 3 kHz, no chorus (the pad strip's air costs nodes per note and
    // a section part plays plenty of them).
    strings: { hpf: 80, eq: { f: 3000, gain: 1.5, q: 0.8 }, sat: 0.15, satMix: 0.28,
               comp: { thresh: 0.3, ratio: 2.2, atk: 0.025, rel: 0.26, makeup: 1.03 },
               trim: 0.92 },
  };
  // WHICH FAMILY an id belongs to — the parent's samplerFamily, widened to the
  // families nukernel's genres actually name. Ordered most-specific first: a
  // "palm_muted_guitar" is a guitar before it is anything else, and the dirty
  // three are matched before the clean ones so `overdrive_guitar` never reads
  // as a plain guitar.
  const FAMILY = [
    [/crunch|distortion|overdrive/, "dirty"],
    [/guitar|banjo|sitar|koto|shamisen|harp$/, "guitar"],
    [/organ/, "organ"],
    [/choir|voices|vox|voice/, "vox"],
    [/trumpet|trombone|tuba|brass|horn/, "brass"],
    [/sax|clarinet|oboe|bassoon|flute|recorder|harmonica|whistle|pipe/, "reed"],
    [/violin|fiddle|viola|cello|contrabass/, "bowed"],
    // ...dulcimer is struck strings — a mallet instrument by mechanism, which
    // is also where the parent's own mallet test files it
    [/marimba|xylo|vibra|glock|kalimba|music_box|celesta|steel_drum|timpani|dulcimer/, "mallet"],
    // ...and `tremolo` is GM's tremolo STRINGS: a section, not a lead
    [/strings|orchestra|tremolo/, "strings"],
    // the soft synth patches that are pads by behaviour even when the genre
    // does not call the voice one (ambient's bowed glass, techno's metal pad)
    [/halo|_pad$|glass|atmosph|sweep|warm_pad/, "pad"],
    [/piano|grand|rhodes|_ep|_ep_\d|epiano|clav|harpsi|honky|legend|felt|bandoneon|accordion/, "keys"],
  ];
  // WHICH FAMILY A VOICE IS IN, as one answer. `pad` is a fact about the ROLE
  // (the genre says which voice is a pad) and wins outright — a pad is a pad
  // whatever is playing it, which is how postrock's slow strings get the widest
  // air in the page. Otherwise the regex table decides, and an id in no family
  // is `lead`, which is what every voice used to get.
  //
  // ONE walk, two readers: the mix strip below and the dynamic response after
  // it. Two copies of this loop is how a guitar ends up on the guitar strip and
  // the generic response, one edit at a time.
  const familyOf = (id, pad) => {
    if (pad) return "pad";
    for (const [re, fam] of FAMILY) if (re.test(id || "")) return fam;
    return "lead";
  };
  // THE STRIP A VOICE ACTUALLY GETS.
  const stripFor = (id, pad) => STRIPS[familyOf(id, pad)] || STRIPS.lead;

  // ---- THE SECOND KIND OF DYNAMICS -----------------------------------------
  // Velocity used to change one thing: LOUDNESS. The event tier now writes a
  // real range and a real shape into it (kernel.js stress/phrase/touch), and a
  // line whose only answer to being played harder is being played louder still
  // reads as "extremely synthesized and robotic", because that is not what a
  // struck or blown instrument does. A harder note is a BRIGHTER note with a
  // faster front edge; a soft one is dull and slow. That is timbre, not level.
  //
  // THE PARENT SOLVES THIS AND WE CANNOT USE ITS SOLUTION.
  // engine/faust/voices/sampler.js zoneFor(zones, midi, vel) takes a SELECTION
  // VELOCITY and picks a velocity LAYER — a genuinely differently-recorded
  // sample for a soft note — and its comment records the measured bug where a
  // mix-staged gain capped that velocity at 61 over 10,109 notes so every forte
  // layer was unreachable. the engine's own sampler passes velocity through to it
  // (correct the day a layered font lands, see there). But the precondition
  // fails here: measured on the shipped registry, 123 samplers / 629 zones,
  // zone keys are file,root,lo,hi,loop,ls,le — no vlo/vhi, ONE layer per
  // instrument. The parent gets timbre-from-velocity because its SoundFont has
  // layers. We have to synthesize the difference instead.
  //
  // WHAT SHAPE THE TREATMENT TAKES, and the measurement that chose it. The
  // first attempt was the obvious one — a lowpass per note, wide open at the
  // default velocity and closing as the note softens. It gates, it is cheap,
  // and it is INAUDIBLE: measured on rock's crunch guitar, offline, one note at
  // velocity 2 against the same note at velocity 9, the spectral-shape
  // correlation came out 0.988 against a level-only control of 0.991. The
  // reason is arithmetic. Byte-identity at the default velocity pins the curve
  // to "no filter" at neutral, a lowpass can only ever subtract, and a lowpass
  // anchored at bypass has nowhere to go on the loud half — so half the range
  // did nothing and the other half rolled off 6 kHz of a guitar that had almost
  // no energy up there.
  //
  // SO IT IS A TILT, not a corner: one HIGH SHELF whose gain in dB is
  // proportional to the distance from the default velocity. Negative below it,
  // positive above it, exactly 0 dB — a literal bypass — at it. That keeps the
  // skip law intact and gives the loud half somewhere to go.
  //
  // AND IT IS ASYMMETRIC, for the same reason the parent's velocity layer does
  // not exist here: THE SAMPLE IS ALREADY THE FIRM NOTE. A one-layer GM font was
  // captured at a confident level, so going DOWN from it is honest subtraction
  // (that top end really was not there when the note was played softly) and
  // going up is inventing high end the recording never had. So the soft side
  // gets the full tilt and the loud side gets DYN_BRIGHT of it, plus the one
  // thing a hard hit genuinely does add — a transient.
  //
  // FIVE NUMBERS PER FAMILY, and they are the five things dynamic response is:
  //   tilt   dB the shelf moves per unit of velocity distance. The big one, and
  //          the ordering is the physical one: brass is the extreme (a forte
  //          trumpet and a piano one are barely the same instrument), a string
  //          section is the mildest.
  //   corner Hz the shelf hinges at — where "brightness" starts for THIS
  //          instrument. A bass's is under a kilohertz; a marimba's is up where
  //          the mallet noise lives.
  //   bite   extra dB on the ONSET of a full-force note, decaying into the
  //          settled tilt. This is the strike itself, and it is the half of the
  //          treatment a static shelf cannot say.
  //   dec    seconds that onset takes to settle. A struck string is done in
  //          40 ms; a bowed one takes a sixth of a second.
  //   hand   0..1, how much of this sound IS the strike — it scales BOTH the
  //          amp-attack shortening and the sample-start offset (see
  //          the parent's STRIP stage). A plucked string is all hand; a string section
  //          has none.
  //
  // TWO FAMILIES ARE ABSENT ON PURPOSE, and absent means the old path exactly:
  //   organ  a drawbar organ has NO velocity response. The key is a contact,
  //          the footages are sines, and a hard-played Hammond is the same
  //          sound. Faking one would be the opposite of this whole round.
  //   pad    a pad is a wash, not a stroke: a per-note transient shelf chops
  //          the one voice whose job is not having an edge. It is also the
  //          worst cost on the page — STRIPS.pad already builds a chorus AND a
  //          phaser per note, on the voice that holds the longest notes.
  const DYN = {
    keys:    { tilt: 11, corner: 1600, bite: 4.0, dec: 0.050, hand: 1.00 },
    guitar:  { tilt: 10, corner: 1900, bite: 4.0, dec: 0.045, hand: 1.00 },
    // an overdriven amp COMPRESSES: less swing, and the bite is the pick rather
    // than the tone stack (the dirty strip's own tanh already squares the top off)
    dirty:   { tilt:  7, corner: 2200, bite: 3.0, dec: 0.040, hand: 0.80 },
    mallet:  { tilt: 12, corner: 2600, bite: 5.0, dec: 0.030, hand: 1.00 },
    brass:   { tilt: 13, corner: 1400, bite: 3.0, dec: 0.100, hand: 0.50 },
    reed:    { tilt:  9, corner: 1500, bite: 2.5, dec: 0.090, hand: 0.45 },
    bowed:   { tilt:  8, corner: 1800, bite: 2.0, dec: 0.140, hand: 0.25 },
    strings: { tilt:  6, corner: 2000, bite: 1.5, dec: 0.160, hand: 0.15 },
    vox:     { tilt:  6, corner: 2200, bite: 1.5, dec: 0.130, hand: 0.15 },
    // the bass chair, reached by id rather than by family (nothing in the
    // regex table claims acoustic_bass, and adding a rule would re-strip any
    // future *_bass voice) — a fingered bass is most of the way to a guitar,
    // hinged low because a bass's whole "brightness" lives under a kilohertz
    bass:    { tilt:  9, corner:  900, bite: 3.5, dec: 0.050, hand: 0.90 },
    // an id in no family: the same fallback stripFor makes, deliberately mild
    lead:    { tilt:  8, corner: 1900, bite: 3.0, dec: 0.050, hand: 0.70 },
  };
  // the share of the tilt a note ABOVE the default velocity gets. See the
  // asymmetry note above: the shipped one-layer font is already a firm note, so
  // subtracting its top is honest and adding to it is invention.
  const DYN_BRIGHT = 0.55;
  // the amp attack at the default velocity — today's number for every sampled
  // note — and how far a full-force note may halve it (in octaves of time).
  // 0.006 / 2^0.9 is 3.2 ms, a hair above sampler.js's own 3 ms floor, so the
  // hardest note this page can write still lands inside the parent's envelope.
  const DYN_ATK = 0.006, DYN_ATK_OCT = 0.9;
  // seconds of the sample's own head a full-force note skips. Small on purpose:
  // this is the soft ramp before the transient, not the transient.
  const DYN_SKIP = 0.004;
  const dynFor = (id, pad) => (id === BASS_INSTR ? DYN.bass : DYN[familyOf(id, pad)]) || null;
  // THE CURVE ITSELF, HERE RATHER THAN IN THE PLAYER. voices.js writes it onto
  // AudioParams and the gates check it as arithmetic; two copies of these four
  // lines is how the table and the sound drift apart one edit at a time. `u` is
  // the signed distance from the default velocity (voices.js velU): -1.25 at a
  // ghosted 0, 0 at the default 5, +1 at a hammered 9. EVERY TERM IS ZERO AT
  // u === 0 — that is the whole byte-identity claim, and it is why the player
  // can skip building anything at all there.
  const dynCurve = (u, d) => {
    const force = u > 0 ? u : 0;
    const db = d.tilt * (u < 0 ? u : u * DYN_BRIGHT);
    return { db, peakDb: db + d.bite * force,
             atk: DYN_ATK / Math.pow(2, DYN_ATK_OCT * d.hand * u),
             skip: DYN_SKIP * d.hand * force };
  };

  const api = { instrOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH, PATCHES, STRIPS,
                stripFor, familyOf, RANGES, SAMPLED_INSERTS, STRETCH_UP, STRETCH_DOWN, DRUMMIX, DRUMBUS,
                MACHINEMIX, mixFor, laneKey,
                // DYN_ATK is the one raw constant the player still needs (the
                // default attack for a note that asked for no treatment at all);
                // DYN_ATK_OCT and DYN_SKIP stay private to dynCurve, which is
                // the only thing that should ever be reading them
                DYN, dynFor, dynCurve, DYN_BRIGHT, DYN_ATK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuInstruments = api;
})(typeof window !== "undefined" ? window : globalThis);

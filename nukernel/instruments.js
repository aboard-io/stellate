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
  // ...and THE CHIPS, which are fields.js's (`FX`/`fxChain`). Not a copy of
  // them: the pedalboards below are built by calling that table's own chain
  // builder, so a chip whose params or module name move there move here too,
  // and nukernel keeps ONE list of what an effect is. fields.js sits one layer
  // under this file (kernel -> genres -> fields -> song -> THIS), which is the
  // direction this dependency runs.
  const NF = (typeof module !== "undefined" && module.exports)
    ? require("./fields.js") : root.NuFields;

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
  // `DRUMDIR` + `DRUMFILE` STOOD HERE AND ARE RETIRED, 2026-08-28. Twelve
  // filenames under ../found/samples/drums/, for a page that fetched its own
  // one-shots and played them on AudioContext buffers. Nothing has fetched them
  // since the one-engine round: the parent resolves a sampled kit through
  // K.drumKitSpec (audio/to-engine.js "---- 3. the kit ----"), which loads the
  // SAME recordings off the SAME directory through the parent's own kit overlay
  // and keymap. Two spellings of one directory, one of them read. The name a
  // lane still needs — which hit of the kit it is — lives in audio/to-engine.js
  // LANE (`tom: "tomHi"`, `pedal`), which is the half that had actually drifted.

  // ---- THE DRUM KIT'S OWN MIX ----------------------------------------------
  // ONE COLUMN SURVIVED, AND IT IS THE ONE THE PARENT COULD RECEIVE.
  //
  // WHAT THIS TABLE WAS. Twelve lanes, five numbers each — `lvl` the lane's own
  // trim, `pan` where it sat, `room` how much of it went to a drum ambience
  // send, `punch`/`sus` a per-hit gain envelope on the sample — written for
  // audio/voices.js, the WebAudio drum player, and tuned by ear against it.
  // The one-engine round deleted that player. MEASURED 2026-08-28: perturbing
  // every number in DRUMMIX (60) and MACHINEMIX (67) — x1.5 + 0.011 on every
  // leaf — left the engine handoff (plan.js parentState + desk.js masterState +
  // every barPlan) BIT-IDENTICAL on house, hymn and dub. 127 numbers, zero bits.
  //
  // `lvl` IS WIRED (2026-08-28). audio/to-engine.js multiplies it into the
  // HIT'S OWN `amp` — the courier pattern the family strip took the same day —
  // and it lands there rather than on the unit table for a reason the LANE table
  // states: twelve lanes resolve to NINE parent units (h/o/f are all `hat`,
  // t/m/l are all `tom`), so a per-lane fact on a per-unit row would cost three
  // of the twelve their own answer. `amp` is per event, which is the granularity
  // this column was written at. Measured after wiring, on the rendered handoff:
  // dub's rim −6.02 dB, house's ride −4.15 dB, the hats −1.9 dB, kick and snare
  // (lvl 1.00) untouched to the bit.
  //   AND IT HAD NO OWNER TO FIGHT. The parent's own per-voice level is per UNIT
  //   (state-engine voiceUnits: hat 0.7, ride/crash 0.9) and to-engine's `L.gain`
  //   has never been set by a single row — so a rim came out as loud as a snare,
  //   a pedal hat as loud as a closed one, and a CR-78 as loud as a 909. That gap
  //   is what this column is for.
  //
  // FOUR COLUMNS ARE RETIRED, and each has a different reason:
  //   pan    ONE OWNER PER FACT, and it is not this file. state-engine
  //          MASTER_PAN places every drum unit (hat +0.18, ride +0.22, rim
  //          −0.16, tom −0.10, clap +0.08, crash +0.12) and the renderer reads
  //          the UNIT's pan, not the event's — there is no per-hit pan port at
  //          all. Four of these rows were copies of MASTER_PAN's own numbers;
  //          the two that differed (the crash on the empty side, the toms
  //          sweeping left as they get lower) are per-LANE gestures a single
  //          `tom` channel cannot make. A second copy of a placement the parent
  //          already owns is the double this file exists to prevent.
  //   room   ITS BUS IS GONE. These were absolute sends into a short drum
  //          ambience that the WebAudio rack provided and the one engine does
  //          not; there is one reverb bus now, and audio/desk.js already folds a
  //          box's `room` and a part's into it ("a part asking for room and a
  //          box asking for it are both asking for more of the one reverb").
  //          The RATIO between the lanes (kick 0.10 against snare 0.55) is the
  //          real fact and it is genuinely lost — but a send is per UNIT, so
  //          six of twelve lanes could keep it at best, and re-scaling absolute
  //          sends tuned against a bus with its own 0.9 trim into a shared
  //          reverb needs a normalising constant nobody ever tuned. Inventing
  //          one to justify a table is the thing this round is against.
  //   punch  NO PORT, AT ANY GRANULARITY. A transient designer is a per-hit gain
  //   sus    envelope over a sample, and the parent's sampled drum event is
  //          `{ unit, beat, durB, sets: { freq, gain } }` — no attack, no
  //          sample-start offset, no envelope. What it does have is the drum
  //          strip (STRIP_PROFILES.drum: subsonic HPF, a whisper of saturation,
  //          NO compressor — "the attack IS the instrument"), which is the
  //          parent's answer to the same question, one stage lower.
  //
  // The retired numbers are in git, and the sentence that mattered — a kit is
  // twelve places in a room, not twelve samples in a line — is written here
  // rather than in a table nothing reads.
  const DRUMMIX = {
    k: { lvl: 1.00 }, s: { lvl: 1.00 }, p: { lvl: 0.50 }, c: { lvl: 0.95 },
    t: { lvl: 0.95 }, m: { lvl: 0.95 }, l: { lvl: 0.98 }, h: { lvl: 0.85 },
    o: { lvl: 0.80 }, f: { lvl: 0.62 }, r: { lvl: 0.72 }, x: { lvl: 0.80 },
  };
  // ---- THE MACHINES' PLACE IN THAT MIX -------------------------------------
  // Four kits are DRUM MACHINES — tr808, tr909, tr606, cr78 — and the parent
  // voices every one of them (audio/to-engine.js MACHINE_KIT is the whole
  // routing table, live and pressed). What a machine changes about a MIX rather
  // than about a sound used to be said here in two columns; `room` went out
  // with its bus (the DRUMMIX tombstone above has the argument) and what is
  // left is the half a machine really does change, which is how loud it sits.
  // A drum machine is a line-out, and the boxes that were polite were mixed
  // politely: the CR-78 sat behind an organ, and every record that loved it
  // kept it down.
  //
  // ONLY THE ROWS THAT DIFFER. An absent lane falls straight through to DRUMMIX
  // (mixFor below), so tr808's kick and snare are simply the kit's — the same
  // absent-is-today spelling the rest of this box uses. tr606 is the one machine
  // with no level of its own on any lane but the clap, which is what a 606 is.
  const MACHINEMIX = {
    tr808: { r: { lvl: 0.6 },  x: { lvl: 0.7 } },
    tr909: { r: { lvl: 0.62 }, x: { lvl: 0.75 } },
    tr606: { c: { lvl: 0.8 },  r: { lvl: 0.6 },  x: { lvl: 0.7 } },
    cr78:  { k: { lvl: 0.9 },  s: { lvl: 0.85 }, c: { lvl: 0.7 },  p: { lvl: 0.45 },
             h: { lvl: 0.7 },  o: { lvl: 0.65 }, f: { lvl: 0.5 },  r: { lvl: 0.5 },
             x: { lvl: 0.6 },  t: { lvl: 0.8 },  m: { lvl: 0.8 },  l: { lvl: 0.82 } },
  };
  // THE ONE MERGE — the machine's row over the kit's, so a sampled kit falls
  // straight through and a machine only overrides what it actually changes.
  // audio/to-engine.js is the reader, once per hit, and it is the only one:
  // there is no drum player on this page any more and no second copy of this
  // arithmetic anywhere. (`laneKey` stood beside this and is RETIRED, 2026-08-28
  // — it answered "which desk strip does this hit land on" for a desk of node
  // chains that no longer exists, and it looked used only because ui/derive.js
  // and kernel.js each define their own local `laneKey` and shadow it.)
  const mixFor = (kit, lane) => {
    const o = kit && MACHINEMIX[kit] && MACHINEMIX[kit][lane];
    const base = DRUMMIX[lane];
    return o ? { ...base, ...o } : base;
  };
  // `DRUMBUS` STOOD HERE AND IS RETIRED, 2026-08-28: { hpf, sat, satMix, room,
  // punchMs, susMs }, a second copy of the parent's own drum strip. The owner is
  // state-engine STRIP_PROFILES.drum — transient-preserving, HPF plus a whisper
  // of glue saturation and no compressor — which every drum unit already takes
  // through stripFor(role="drum"), on every path. `room` and the two envelope
  // times belonged to the same retired stages as DRUMMIX's own columns.

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
    // ...AND THE REST OF THE BASS RACK (2026-08-23, "give me all choices for
    // keys and all instruments and kits"). Six basses the registry has carried
    // with no word to reach them. Every window here that the parent also
    // carries is the PARENT'S, verbatim — the borrowed-value law above, which
    // test/unit/nukernel.test.js holds — and the two it does not carry are the
    // zones' own honest extent.
    fretless_bass: [28, 62], slap_bass: [28, 64], pop_bass: [28, 62],
    contrabass: [28, 67],
    // the two sampled synth basses: no parent row, so these are keyboard-
    // honest windows an octave under the leads, the same reasoning the GM
    // synth patches above are given.
    synth_bass_1: [28, 84], synth_bass_2: [28, 84],
    // ...AND THE REST OF THE KEYBOARD DEPARTMENT. reed_organ, accordion,
    // celesta, glockenspiel and pizzicato_strings are the parent's rows
    // verbatim; the four with no parent row are the instrument's own written
    // compass, which is also inside the zones the sampler actually has.
    reed_organ: [41, 89], accordion: [41, 89],
    celesta: [60, 103], glockenspiel: [79, 105],
    pizzicato_strings: [40, 91],
    // a xylophone is written F4..C8 and sounds where it is written here (the
    // registry's zones root above middle C); tubular bells are written C4..F5
    // and sound an octave up, which is the window the chime actually has.
    xylophone: [65, 108], tubular_bells: [60, 89],
    // the two remaining synth voices take the pads' window for the same reason
    // the one-zone GM patches above do. (`electric_piano` — the rack's "tine
    // piano" — needs no row here: it has carried the Rhodes' [28, 96] with the
    // other two EPs since the table was written.)
    synth_strings_2: [36, 96], space_voice: [48, 88],
  };
  // `STRETCH_UP = 6` / `STRETCH_DOWN = 12` STOOD HERE AND ARE RETIRED,
  // 2026-08-28: how far past its own zone ROOTS a sample may be stretched and
  // still be the instrument. They were a second spelling of the parent's
  // SAMPLER_STRETCH_ST / SAMPLER_FLOOR_ST, which is why nothing broke when this
  // copy went quiet — the parent applies its own two numbers to every zone fold
  // on every path, and a duplicate constant is a fact waiting to disagree.

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

  /* ---------- THE PEDALBOARD A PLAYER MAY NAME ---------------------------
     "…and give me all effects chains for each instrument" (the artist,
     2026-08-23, in the same breath as the racks).

     nukernel has had eleven real inserts since the day fields.js was written —
     chorus, phaser, flanger, tremolo, leslie, auto-wah, ring mod, a filter
     sweep, a squelch envelope, tape echo and a tempered crunch — each one a
     `{type, module, params}` row naming a module that ships in
     engine/faust/dist (insert_chorus … insert_higain), and each one already
     spent by the catalog: 30-odd genres in genres.js declare an `fx` chain and
     the box surface carries one. NO CHAIR COULD NAME ONE. The band page's four
     channel questions ("anything on the keys?") are the DESK — reverb and
     delay sends and the strip's tone bands — which is a different machine from
     a box on the floor, and the FX chips were reachable only as a section-wide
     `box.fx`. So a player could be handed a Rhodes and not a Leslie, a clav
     and not a wah, a guitar and not a chorus.

     THIS TABLE IS NOT A SECOND SET OF EFFECTS. Every chain is `NF.fxChain`
     over fields.js's own chip keys, so the params are that table's, the module
     names are that table's, and a chip that changes there changes here.

     WHO GETS WHICH. A board is per CHAIR, because the idiom is: a Leslie is an
     organ cabinet and not a bass pedal, a squelch envelope is a synth's filter
     and not a singer's, and a wah is a guitar and a clav and a bass and
     nothing else in this room. The words are the pedal's own name said the way
     a player says it, and the FIRST entry of every board is the dry word —
     which is what every record in this box recommends, and what it has always
     sounded like, so nothing moves until somebody says otherwise.

     WHERE IT LANDS. The chair writes the chain onto its own `tone.pedals`;
     audio/to-engine.js `recipeFor` appends it to whatever inserts the
     INSTRUMENT already declares (a modelled electric's amp, the DI's staged
     high-gain), so the board is an effects LOOP after the instrument's own
     voicing rather than a replacement for it. An instrument with no chain of
     its own gets the board and nothing else; a chair that named no pedal is
     byte-identical to before, because an absent key adds nothing to a recipe. */
  const PEDAL = {
    wah:      { w: "a wah", says: "an auto-wah, following the hand" },
    crunch:   { w: "some crunch", says: "one stage of grit over what is there" },
    chorus:   { w: "a chorus", says: "two of it, slightly apart" },
    phaser:   { w: "a phaser", says: "a sweep through the comb" },
    flanger:  { w: "a flanger", says: "a jet, with the feedback up" },
    tremolo:  { w: "a tremolo", says: "the amp's own shudder" },
    leslie:   { w: "a Leslie", says: "the cabinet, turning" },
    echo:     { w: "a tape echo", says: "a delay on the bar, dark repeats" },
    sweep:    { w: "a filter sweep", says: "a resonant lowpass, four bars long" },
    fenv:     { w: "a squelch", says: "the filter opening on every note" },
    ringmod:  { w: "a ring mod", says: "a second, inharmonic bell over it" },
  };
  // the dry word is FIRST in every board and carries no chain: "nothing on it"
  // said out loud, which is a decision and not a blank
  const BOARDS = {
    // a guitarist's floor. No Leslie (a cabinet, not a pedal) and no squelch
    // (a synth's filter envelope, and this chair's dirt is already an
    // instrument — guitar-kit's ten amps).
    guitar: { dry: "straight in",
              of: ["wah", "crunch", "chorus", "phaser", "flanger", "tremolo",
                   "echo", "ringmod"] },
    // the keyboard player gets the whole rack, because a keyboard is the one
    // chair that is sometimes an organ (Leslie), sometimes a Rhodes (tremolo),
    // sometimes a clav (wah) and sometimes a synth (sweep, squelch).
    keys:   { dry: "dry",
              of: ["leslie", "chorus", "phaser", "flanger", "tremolo", "wah",
                   "crunch", "echo", "sweep", "fenv", "ringmod"] },
    // a bass board is short on purpose: everything here is a box that exists
    // for a bass, and the ones that are not (a Leslie, a phaser on the low E)
    // are left out rather than sold.
    bass:   { dry: "dry",
              of: ["crunch", "wah", "fenv", "chorus", "flanger", "echo", "ringmod"] },
    // ...and the voice, where the chain IS the effect and there is no amp
    // under it: the four modulations a vocal booth has always had, the echo,
    // and the ring mod that makes it a machine.
    voice:  { dry: "close and dry",
              of: ["echo", "chorus", "flanger", "phaser", "tremolo", "ringmod"] },
  };
  // a chair's board, as the table pitchedChair's `pedals` spec wants: an
  // ordered map of key -> { w, says, chain }, the dry word first
  const boardOf = (seat) => {
    const B2 = BOARDS[seat];
    if (!B2) return null;
    const out = { none: { w: B2.dry, says: "nothing on it", chain: null } };
    for (const k of B2.of) {
      const p = PEDAL[k];
      if (!p) continue;
      const chain = NF.fxChain([k]);
      if (!chain.length) continue;          // a chip fields.js does not have
      out[k] = { w: p.w, says: p.says, chain };
    }
    return out;
  };

  /* THE IDS THAT NAME A PERSON — and, until this round, the one that named ONE.
     `voiceForInstr` has a whole second half for a SECTION: `choir = P.dsp ===
     "voice_choir"` picks a longer attack and release, a section's vibrato, and
     `blend` — "how ragged they are", which moves the detune, the entry stagger
     and the stereo width together (to-engine.js:596-604). genres.js MOUTHS
     writes `blend` on TEN mouths (plainchant, motet, hymnal, bulgar,
     gospelchoir, doowopstack, merseystack, boygroup, dreamchoir, backingroom)
     and documents it as "sections only". Measured 2026-08-26: not one of those
     ten numbers had ever been read, because this table had no row whose `dsp`
     was `voice_choir`, so the branch that reads them was unreachable and every
     held vocal in the catalogue — `ahh_choir` on 381 precomposed chairs,
     `ohh_voices` on 39 — came back `unrouted` and played the sampled "aah".
     That is the recording Paul hears as hiss: the breath is IN the sample and
     no `air` dial can take it out, where the model's is a parameter
     (`breath`, 0..0.6, defaulted 0.22 for a section).

     WHY A SECTION AND NOT A SINGER, said as a rule rather than a list: the
     plural is in the NAME. "aah choir" and "ooh voices" are a room full of
     people holding a vowel; "solo vox" is one person at a microphone. A
     formant bank with one glottis can be the second and cannot be the first —
     three detuned, staggered voices is what a section IS — and this is the
     same distinction the parent draws by giving `chorale` `pool: 3` and the
     singer one throat. It is also why the sampled choir stays honest for
     everything else: a violin section is people too, and there is no model
     of it here, so `slow_strings` keeps its recording.

     THE DEFAULTS ARE WHAT THE ID ITSELF MEANS and nothing more — an alto
     section (the module's own default voice type), the vowel the name spells,
     and a bar per syllable, which is the `chorale` case's own `vowelEvery`.
     Every genre that has an opinion already states it in its `mouth` block and
     that block still wins, exactly as it does for solo_vox.

     `phase` ROTATES THE VOWEL WALK, and this is the one place it earns its
     keep: `hymn` seats ahh / ohh / ahh against one `MOUTHS.hymnal` whose
     vowels are "ao", and without a rotation all three chairs would open their
     mouths on the same letter at the same time, which is a stack and not a
     choir. */
  const PATCH_VOICE = {
    solo_vox:    { dsp: "voice_lead",  voice: "tenor", vowels: "ao", syll: 0.5, phase: 0 },
    ahh_choir:   { dsp: "voice_choir", voice: "alto",  vowels: "a",  syll: 4, phase: 0 },
    ohh_voices:  { dsp: "voice_choir", voice: "alto",  vowels: "ou", syll: 4, phase: 1 },
  };

  // IS THIS ID A ROOM FULL OF PEOPLE? One owner for the question, because two
  // callers ask it and neither should re-list the ids: `audio/to-engine.js`
  // asks it as `P.dsp === "voice_choir"` to pick the section half of
  // `voiceForInstr`, and `precompose.js` asks it to decide whether a guest may
  // bring a second choir onto a record that already has one. A row added above
  // is answered by both without either being edited.
  const isSection = (id) => !!(PATCH_VOICE[id] && PATCH_VOICE[id].dsp === "voice_choir");

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
  // THREE OF THESE ROWS ARE READ-ONLY COPIES, AND SAYING SO IS THE POINT
  // (2026-08-28). `bass`, `pad` and `lead` below are transcriptions of the
  // parent's STRIP_PROFILES, and the wiring that finally handed this table to
  // the engine deliberately does NOT hand those three over: the parent picks
  // them from the ROLE, it owns them, and the copies have already drifted (its
  // `pad` chorus carries `two: true` and its phaser `fb: 0.3`; neither is here).
  // So editing bass/pad/lead in this file still changes nothing you can hear —
  // edit engine/faust/voices/state-engine.js STRIP_PROFILES. They stay because
  // `familyOf` must be able to answer "pad" and "lead" for the desk's FAM_EQ
  // walk and for anything reading a family's shape on the page.
  //
  // AND TWO ROWS STILL REACH NOTHING, for a different reason than the one this
  // round fixed. MEASURED 2026-08-28 over the whole shipped sampler library:
  // every `dirty` id (crunch/distortion/overdrive_guitar) and every `vox` id
  // but `space_voice` (ahh_choir, ohh_voices, solo_vox, synth_voice) is claimed
  // upstream by PATCH_MODEL/PATCH_VOICE — they resolve to stk_guitar, to
  // voice_choir, to a tract — and a modelled voice never enters the sampler's
  // strip at all. The other eight families do arrive: keys 53 chairs, guitar 53,
  // strings 47, brass 32, reed 28, organ 21, bowed 10, mallet 4, over 139 of the
  // 204 records. `dirty` and `vox` are still unheard, and still unjudged.
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
    // KEPT LEAN ON PURPOSE — half the reason retired 2026-08-27, kept in
    // writing: this said "sampler.js builds the strip PER NOTE, so a chorus or
    // a phaser is real nodes on every note", and that was true and was the F4
    // crackle (PROGRAM.md §4 item 2: 164 notes -> 164 compressors). SamplerLive
    // now builds ONE strip per voice and notes share it, so on the live graph a
    // chorus costs one chain per chair, not one per note. The lean profiles
    // STAY lean: the PCM press/stream lane (mixPCM) still runs the strip
    // per-note-stateful per sample (window parity law), so every stage here is
    // still paid per note per sample on the tape — and a strip is a register
    // carve, not a pedalboard. Only `pad` carries both mods (pads play few,
    // long notes). The dropped organ leslie could return behind a measurement.
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
  //
  // AND IT ACTUALLY GETS IT SINCE 2026-08-28 — the reversal, in writing. Every
  // word above this line was true about the TABLE and false about the SOUND:
  // measured 2026-08-27 (export/_satdrive.cjs --patch nstrip) zeroing every
  // `sat` in STRIPS rendered BIT-IDENTICAL, because nothing ever handed the
  // table to the engine. A sampled voice's strip is written by state-engine
  // `stripFor(role, id, state, m)` off the parent's four ROLE profiles, so the
  // harpsichord, the two guitars and the choir all played through `lead`.
  // audio/to-engine.js `recipeBase` now carries this answer over on the recipe
  // as `m.strip`, and the parent's stripFor takes it as the BASE (replacing the
  // role profile, keeping the drive fold and the hashed voice-FX on top).
  // Bass and drums decline it there — the role owns those two.
  const stripFor = (id, pad) => STRIPS[familyOf(id, pad)] || STRIPS.lead;

  // ---- THE SECOND KIND OF DYNAMICS: RETIRED, 2026-08-28 ---------------------
  // `DYN`, `dynFor`, `dynCurve`, `DYN_BRIGHT`, `DYN_ATK`, `DYN_ATK_OCT` and
  // `DYN_SKIP` stood here — eleven families x five numbers plus four constants,
  // 55 tuned values — and they are gone rather than left standing.
  //
  // WHAT THEY SAID, because it is the right idea and it should not be lost: a
  // harder note is not a louder note, it is a BRIGHTER note with a faster front
  // edge. Five numbers per family — `tilt` dB of high shelf per unit of velocity
  // distance (brass the extreme, a string section the mildest), `corner` where
  // brightness starts for that instrument, `bite` extra dB on the onset of a
  // full-force note, `dec` how long that onset takes to settle, `hand` how much
  // of the sound IS the strike — plus an ASYMMETRY that was the honest part: a
  // one-layer GM font was captured at a confident level, so subtracting its top
  // for a soft note is truthful and adding to it for a hard one is invention, so
  // the loud side got only DYN_BRIGHT (0.55) of the tilt. `organ` and `pad` were
  // absent on purpose — a drawbar organ has no velocity response, and a per-note
  // transient shelf chops the one voice whose job is not having an edge.
  //
  // WHY THEY ARE RETIRED AND NOT WIRED. MEASURED 2026-08-28: perturbing all 55
  // numbers (x1.5 + 0.011 on every leaf) left the engine handoff BIT-IDENTICAL
  // on house, hymn and dub — no reader, anywhere in nukernel/, engine/ or
  // tools/. And there is nowhere to put them. This is a PER-NOTE treatment and
  // the parent's sampled note is `{ tSec, durSec, freq, gain, vel, atk, rel,
  // zones, pan }` — where `atk` is the UNIT's, not the note's
  // (engine/faust/live/stream-renderer.js, the sampler branch). No per-note
  // filter, no per-note attack, no per-note sample-start offset: every term of
  // dynCurve except the level is a write with no port, at any granularity, and
  // opening one means a filter instance per voice per note.
  //
  // WHAT THE PARENT USES INSTEAD, which is why nothing broke when this went
  // quiet. Velocity on a SAMPLED voice picks a velocity LAYER (SP.selVelOf off
  // the musical amp) and scales the note's gain. Velocity on a MODELLED voice
  // drives the instrument's own physical control through state-engine MODEL_DYN
  // — stk_guitar's `pick` 0.12..1, stk_piano's `hammer` 0.3..1, mallet's `hard`
  // 0.05..1, voice_lead's `push` — which is the same idea done one layer down,
  // in the model rather than on a shelf after it, and measurably better: across
  // MIDI 67-79 a ghosted mallet note measures 2252 Hz of spectral centroid
  // against a hammered one's 3722, where the sampled zone it replaced moved 922
  // to 940. This table was the shelf you build when you cannot reach inside the
  // instrument. The parent can.

  // WHAT LEAVES THIS FILE. Fourteen names came off this line on 2026-08-28 —
  // DRUMDIR, DRUMFILE, STRETCH_UP, STRETCH_DOWN, DRUMBUS, laneKey, DYN, dynFor,
  // dynCurve, DYN_BRIGHT, DYN_ATK and the three private constants — because the
  // tables they named are retired above with their measurements. `DRUMMIX`,
  // `MACHINEMIX` and `mixFor` stay, and they are WIRED: audio/to-engine.js reads
  // the merge once per drum hit. An export is the only evidence most readers
  // ever get that a table is live, so nothing may be exported that nothing reads.
  const api = { instrOf, isSection, BASS_INSTR, FONTS, BASSSYNTH, PATCHES, STRIPS,
                stripFor, familyOf, RANGES, SAMPLED_INSERTS, PEDAL, BOARDS, boardOf,
                DRUMMIX, MACHINEMIX, mixFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuInstruments = api;
})(typeof window !== "undefined" ? window : globalThis);

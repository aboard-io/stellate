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
  //          is NOT the section's reverb (audio/graph.js buildRoomBus). Kick
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
  // because the squeaky-ska-trumpet round (2026-08-16) showed what an absent
  // row costs: an unlisted instrument still passes through untouched (future
  // ids degrade to the zone window, the parent's law for the unlisted), but the
  // gate in test/unit/nukernel.test.js now proves nothing choosable is
  // unlisted. Where the parent's table carries the id, its values are borrowed
  // verbatim; where it does not (pianos, EPs, sections, the GM synth patches),
  // the bounds come from the instrument's real compass intersected with the
  // registry's zone extents (playWindow does the intersection).
  const RANGES = {
    // winds + reeds
    flute: [60, 96], harmonica: [60, 96], tenor_sax: [44, 77],
    // brass. THE TROMBONE IS THE SKATALITES' FRONT LINE, and its ceiling is
    // 74 — ten semitones under the trumpet's, which is the point. Composed ska
    // writes its horn line as high as MIDI 100 and the register home folds it
    // back down; folding it into a trombone's window puts the horn a full
    // octave lower than folding it into a trumpet's, which is the difference
    // between Don Drummond and a squeak.
    trumpet: [54, 84], muted_trumpet: [54, 84], brass_section: [40, 86],
    trombone: [40, 74],
    // bowed
    violin: [55, 100], fiddle: [55, 100],
    // plucked + fretted (guitar tops around E6)
    nylon_string_guitar: [40, 88], steel_string_guitar: [40, 88],
    jazz_guitar: [40, 88], clean_guitar: [40, 88], palm_muted_guitar: [40, 86],
    crunch_guitar: [40, 88], distortion_guitar: [40, 88], overdrive_guitar: [40, 88],
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
    // struck + tuned percussion
    marimba: [45, 91], harpsichord: [29, 89], clavinet: [36, 84],
    // the Funk Brothers' vibes and a Highlife kalimba: two colours the table
    // could name and no genre had ever asked for
    vibraphone: [53, 89], kalimba: [60, 96],
    // music box: the parent's own window, RESTORED. It was deliberately absent
    // for one release because a bare per-note fold would have mangled trap's
    // melody — but the register home (audio/transport.js) now moves the WHOLE
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
    // string sections — contrabass bottom to violin-section top
    strings: [28, 96], slow_strings: [28, 96], synth_strings_1: [28, 96],
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
    [/marimba|xylo|vibra|glock|kalimba|music_box|celesta|steel_drum|timpani/, "mallet"],
    [/strings|orchestra/, "strings"],
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
  // layer was unreachable. audio/voices.js now passes velocity through to it
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
  //          audio/voices.js). A plucked string is all hand; a string section
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

  const api = { instrOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH, STRIPS,
                stripFor, familyOf, RANGES, STRETCH_UP, STRETCH_DOWN, DRUMMIX, DRUMBUS,
                MACHINEMIX, mixFor, laneKey,
                // DYN_ATK is the one raw constant the player still needs (the
                // default attack for a note that asked for no treatment at all);
                // DYN_ATK_OCT and DYN_SKIP stay private to dynCurve, which is
                // the only thing that should ever be reading them
                DYN, dynFor, dynCurve, DYN_BRIGHT, DYN_ATK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuInstruments = api;
})(typeof window !== "undefined" ? window : globalThis);

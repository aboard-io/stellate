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
  // Only instruments with an HONEST window are listed. Pianos, Rhodes, pads and
  // the synth patches are genuinely full-range and are deliberately absent: an
  // unlisted instrument passes through untouched, exactly as the parent does it.
  const RANGES = {
    // winds + reeds
    flute: [60, 96], harmonica: [60, 96], tenor_sax: [44, 77],
    // brass
    trumpet: [54, 84], muted_trumpet: [54, 84], brass_section: [40, 86],
    // bowed
    violin: [55, 100], fiddle: [55, 100],
    // plucked + fretted (guitar tops around E6)
    nylon_string_guitar: [40, 88], steel_string_guitar: [40, 88],
    jazz_guitar: [40, 88], clean_guitar: [40, 88], palm_muted_guitar: [40, 86],
    crunch_guitar: [40, 88], distortion_guitar: [40, 88], overdrive_guitar: [40, 88],
    banjo: [48, 84],
    // keyed reeds + organs (the pedal board is the floor, not a rumble)
    bandoneon: [41, 86], drawbarorgan: [36, 96], rock_organ: [36, 96],
    // struck + tuned percussion
    marimba: [45, 91], harpsichord: [29, 89], clavinet: [36, 84],
    // MUSIC BOX IS DELIBERATELY ABSENT, against the parent's own [72,100]. The
    // musical tier exists to stop shrieks and mud, and a music box an octave
    // low is neither — but the window would have moved trap's whole melody
    // (MIDI 56..72) up two octaves, which is a different genre, not a fixed one.
    // voices
    ahh_choir: [48, 84], ohh_voices: [48, 84], solo_vox: [50, 84],
    // the bass chair
    acoustic_bass: [28, 60],
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
  // THE STRIP A VOICE ACTUALLY GETS. `pad` is a fact about the ROLE (the genre
  // says which voice is a pad) and wins outright — a pad is a pad whatever is
  // playing it, which is how postrock's slow strings get the widest air in the
  // page. Otherwise the family decides, and an id in no family falls back to
  // `lead`, which is what every voice used to get.
  const stripFor = (id, pad) => {
    if (pad) return STRIPS.pad;
    for (const [re, fam] of FAMILY) if (re.test(id || "")) return STRIPS[fam];
    return STRIPS.lead;
  };

  const api = { instrOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH, STRIPS,
                stripFor, RANGES, STRETCH_UP, STRETCH_DOWN, DRUMMIX, DRUMBUS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuInstruments = api;
})(typeof window !== "undefined" ? window : globalThis);

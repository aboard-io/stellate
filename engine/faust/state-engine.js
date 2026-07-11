// faust/state-engine.js — Phase 2 core: kernel state -> Faust voice plan + schedule.
//
// Pure mapping, no audio. Consumed by:
//   - faust/press.js   (node offline render via faustwasm offline processors)
//   - faust/live.js    (browser AudioWorklet live engine, exploreLive facade)
//
// The contract: CsdEngine.buildEvents(state) gives {pitched,drums,found,sfx};
// this module maps every event onto a dist/ voice module + param sets, using
// exactly the recipe->param mappings documented in faust/VOICES.md (which were
// A/B-verified against the csound orchestra in ab-report.md).
//
// Times in the returned schedule are in BEATS (callers convert with spb and
// their own clock origin); param VALUES that are durations (decay, idxTime,
// sfx dur) are already in SECONDS because the modules take seconds.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustStateEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const WAVES = ["sine", "saw", "square", "pulse"];
  // SPEECH_RATE_CAP — the ceiling playback rate for kind:"speech" found clips, so
  // the espeak voice never plays too high to understand (see the mapEvents note).
  // 0.82 ≈ -3.4 semitones below rate 1; up-pitched placements drop to it, already-
  // low ones (buried recitals ~0.78) are unchanged.
  const SPEECH_RATE_CAP = 0.82;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const cpspch = (p) => { p = parseFloat(p); const o = Math.floor(p), st = Math.round((p - o) * 100); return 261.625565 * Math.pow(2, (o - 8) + st / 12); };

  // ---- SHRIEK GUARD (2026-07 audio-quality pass, Paul: "think about filtering
  // very high tones — things shriek a little when we're not being careful") ----
  // A GLOBAL taste ceiling at the mapping layer (like LEAD_FX_LIFT / BASS_TRIM:
  // pure + deterministic, state untouched, so verifier features — which read
  // ONLY state fields — and the confusion matrix cannot move). Two mechanisms:
  //
  // (1) RESONANT PEAK up top: a filter whose cutoff lands above ~9 kHz with high
  //     resonance is a whistle, not brightness. easeRes caps the resonance on a
  //     linear ramp — full res allowed at <=9 kHz, eased down to 0.35 by 14 kHz.
  //     cutMaxForRes is the same fence from the other side: a per-note cutoff
  //     sweep (pipes cutoffMul) may not push a high-res voice past it. MEASURED
  //     across the catalog (all anchors x seeds 1-5): ZERO current units trip
  //     either guard — anchors are disciplined — so this is byte-identical
  //     insurance for the blend/macro/pipes space where interpolation can land
  //     cutoff+res combinations no anchor declares.
  // (2) INSTRUMENT-REGISTER LAW (Paul: "you're playing a lot of instruments an
  //     octave or two high and they lose all of their characteristics"): the
  //     score brain's octave choices (9.xx lead voicings, soloOctave +12, arps)
  //     were tuned for synths, but zoneFor's top zone covers hi=127, so a
  //     sampled note far above the zone's root plays the sample at 2-6x rate —
  //     the chipmunk/aliasing shriek AND total loss of instrument character
  //     (measured: baritone-sax melodies at +23..+32 st over the top root in
  //     ~40 genres; a canawave tuba solo at +33.8 st; house pop_bass at +30 st).
  //     Every sampled voice now knows its natural window from its zones:
  //       ceiling = top zone root + SAMPLER_STRETCH_ST   (a few st of stretch)
  //       floor   = bottom zone root - SAMPLER_FLOOR_ST  (down-stretch is more
  //                 forgiving, but a slap_bass at -16 st is 16 Hz rumble and a
  //                 piccolo at -22 st is not a piccolo)
  //     mapEvents OCTAVE-FOLDS any pitched sampler note outside the window
  //     (freq/2 or *2 until inside) — stays in key and in the instrument's
  //     honest register instead of hard-clamping to a detuned pitch. The fold
  //     is PER NOTE (a pure function of the note): phrase-level folding was
  //     considered and rejected because live maps events through arbitrary
  //     beat windows (mapEvents opts.lo/hi) — a phrase group straddling a
  //     window boundary would compute a different fold live vs press and break
  //     segment parity. The window is always >= 18 st wide (ceiling-floor =
  //     zone span + 18), so the two folds can never oscillate. Sampled DRUMS
  //     are untouched (fixed-rate one-shots / tom repitch, separate branch).
  //     Renders drift only where a note actually left the window. sampler.js
  //     rateFor carries a +16 st hard backstop for any path that bypasses this
  //     mapping (mapping-folded notes and tom repitch, max +11 st, never
  //     reach it).
  const SHRIEK_HZ_LO = 9000;   // below this: never touched
  const SHRIEK_HZ_HI = 14000;  // at/above this: res fully eased to the floor
  const SHRIEK_RES_FLOOR = 0.35, SHRIEK_RES_TOP = 0.95;
  const SAMPLER_STRETCH_ST = 6;   // max semitones a zone plays ABOVE its top root (rate ~1.41)
  const SAMPLER_FLOOR_ST = 12;    // max semitones BELOW the bottom root (rate ~0.5)
  function easeRes(cutHz, res) {
    if (!(cutHz > SHRIEK_HZ_LO) || !(res > SHRIEK_RES_FLOOR)) return res;
    const t = Math.min(1, (cutHz - SHRIEK_HZ_LO) / (SHRIEK_HZ_HI - SHRIEK_HZ_LO));
    return Math.min(res, SHRIEK_RES_TOP + (SHRIEK_RES_FLOOR - SHRIEK_RES_TOP) * t);
  }
  function cutMaxForRes(res, hi) {
    if (!(res > SHRIEK_RES_FLOOR)) return hi;
    const t = Math.min(1, (res - SHRIEK_RES_FLOOR) / (SHRIEK_RES_TOP - SHRIEK_RES_FLOOR));
    return Math.min(hi, SHRIEK_HZ_HI + (SHRIEK_HZ_LO - SHRIEK_HZ_HI) * t);
  }

  // ---- SAMPLED DRUM KITS (additive to the Faust synth kits: kick boom/808/909
  //      · snare noise/crack/clap · hat noise/metal). A genre may select a real
  //      recorded kit (genre-kernel DRUMKITS -> instruments.drums.<x>Sampler);
  //      when present, the kick/snare/hat/tom voice UNIT carries a native sampler
  //      (faust/sampler.js) instead of a Faust module, and mapEvents emits each
  //      drum hit as a fixed-pitch (tom: pitched) UNLOOPED one-shot — the same
  //      native PCM path pitched instrument samplers ride, so it bakes in press
  //      (SP.mixPCM) and streams gaplessly (mustLive). A genre WITHOUT a sampled
  //      kit renders exactly as before (no .sampler on the drum unit).
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // fixed keymap the drum sampler zones are cut against (genre-kernel drumKitSpec):
  //   kick/snare  -> one zone root 60, played at midi 60 => rate 1 (natural pitch)
  //   hat         -> closed zone (root 60, keys 0-65) / open zone (root 72, 66-127)
  //   tom         -> one zone rooted at DRUM_TOM_ROOT; the hit's tom pitch (Hz) is
  //                  emitted as freq so the sample repitches (105Hz => rate 1)
  const DRUM_KS_FREQ = midiToFreq(60);      // kick/snare + closed-hat trigger
  const DRUM_HAT_OPEN_FREQ = midiToFreq(72); // open-hat trigger (selects the open zone)
  const DRUM_TOM_ROOT = 69 + 12 * Math.log2(105 / 440);   // ~44.2: tom base = synth tom default 105Hz
  // velocity->sample-gain calibration: press mixes at (u.lvl)*(sets.gain)*sampler
  // GAIN(1.35); real kit samples peak near full scale, so this lands a sampled
  // kick at ~-6dB for a typical kick level(~1.2)×amp(~0.65). Tune here.
  const DRUM_SAMP_GAIN = 0.5;

  // ---- per-voice band-appropriate CHANNEL STRIP (sampled voices) --------------
  // Sampled instruments are the DEFAULT sound (state.sampledOnly, ~105 GM
  // instruments). Real multisamples arrive dry/flat, so every sampled voice now
  // gets a channel strip keyed to its natural register: filter -> EQ -> gentle
  // saturation -> compressor -> chorus/phaser "air". Realized on the NATIVE path
  // (faust/sampler.js: makeStrip/stripStep in press + the wavOut stream, PER NOTE
  // so it stays window-independent and segment-parity byte-equal; buildStripNodes
  // in live). This table IS the tuning surface — Paul's knobs:
  //   hpf/lpf  Hz (0/undef = none)          eq {f,gain(dB),q}  one peaking band
  //   sat 0..1 tanh drive + satMix wet      comp {thresh(lin),ratio,atk,rel,makeup}
  //   chorus {rate,baseMs,depthMs,mix,two}  phase {rate,lo,hi,stages,fb,mix}
  //   trim  output gain — gain-staging: keep the strip ~loudness-neutral (the
  //         master soft-clip at 0.95 is the backstop, but we must not lean on it).
  // Increments, not transforms (Paul: "a little more"). All saturation is tanh —
  // it REDUCES peaks, so it doubles as clip insurance.
  // GRIT PASS (2026-07, Paul: "you're being very conservative … we need more grit
  // across the board"). The default channel strips carry MORE saturation now —
  // dry multisamples read as timid, so every sampled voice gets audible tanh
  // drive (still peak-reducing = clip insurance). Aggressive genres go far past
  // this via the heavy strip (heavyDriveOf/aggressiveStrip below).
  const STRIP_PROFILES = {
    // BASS — kill subsonics (30 Hz HPF), gentle 5 kHz top roll, low-mid warmth,
    //   slow glue comp; NO air (bass stays centered + tight).
    bass: { hpf: 30, lpf: 5200, eq: { f: 110, gain: 2.5, q: 0.9 },
            sat: 0.34, satMix: 0.42, comp: { thresh: 0.22, ratio: 3, atk: 0.02, rel: 0.18, makeup: 1.05 }, trim: 0.98 },
    // PAD — declutter lows (120 Hz HPF), scoop a little mud, wide ensemble chorus
    //   + a slow shallow phaser, gentle comp. The widest air (pads carry the space).
    pad: { hpf: 120, eq: { f: 300, gain: -1.5, q: 0.8 },
           sat: 0.17, satMix: 0.3, comp: { thresh: 0.3, ratio: 2, atk: 0.03, rel: 0.28, makeup: 1.02 },
           chorus: { rate: 0.45, baseMs: 14, depthMs: 6, mix: 0.32, two: true },
           phase: { rate: 0.22, lo: 300, hi: 1600, stages: 4, fb: 0.3, mix: 0.18 }, trim: 0.9 },
    // LEAD (melody/solo) — clear low rumble (200 Hz HPF), presence lift ~3 kHz, a
    //   touch of grit, faster comp, light single-voice chorus for width.
    lead: { hpf: 200, eq: { f: 3000, gain: 3, q: 0.8 },
            sat: 0.3, satMix: 0.44, comp: { thresh: 0.25, ratio: 3, atk: 0.008, rel: 0.12, makeup: 1.04 },
            chorus: { rate: 0.8, baseMs: 11, depthMs: 4, mix: 0.18 }, trim: 0.95 },
    // DRUMS — TRANSIENT-PRESERVING: a subsonic HPF + a whisper of glue saturation
    //   only. NO compressor and no dulling filters (keep the attack/punch).
    drum: { hpf: 28, sat: 0.15, satMix: 0.22, trim: 1.0 },
  };
  // ---- AGGRESSIVE (heavy) channel strip for sampled voices --------------------
  // Sampled voices DROP their Faust inserts (native PCM path). So a genre that
  // declares a distort insert on a sampled guitar/bass/pad — heavymetal, budstep,
  // sludge, gabber — would render CLEAN but for the mild default strip. That is
  // exactly why the metal/sludge genres came out timid. heavyDriveOf reads the
  // declared distortion off the recipe's `inserts` axis; when it's substantial we
  // FOLD it into a BOLD strip: big tanh fuzz (satDrive 4..12) + classic-metal
  // mid-scoop (~640 Hz) + presence bite (~3.2 kHz), subsonic HPF, glue comp. This
  // makes "aggressive genres specify BOLD explicit insert chains" reach the
  // default sampled backend — huge and dirty, but tanh-bounded (no hard clip).
  function heavyDriveOf(m) {
    if (!m || !Array.isArray(m.inserts)) return 0;
    let d = 0;
    for (const it of m.inserts) if (it && it.type === "distort") d = Math.max(d, it.drive != null ? it.drive : 0.3);
    return clamp(d, 0, 1);
  }
  const HEAVY_MIN = 0.5;   // drive at/above this => full metal strip; below => mild sat lift
  function aggressiveStrip(role, drive) {
    const sat = clamp(0.42 + 0.5 * drive, 0, 1);
    const satDrive = 4 + 8 * drive;               // 4..12 — the fuzz hardness
    const satMix = clamp(0.7 + 0.3 * drive, 0, 1);
    if (role === "bass")
      return { hpf: 28, lpf: 6500, eq: { f: 90, gain: 3.5, q: 0.8 },
        sat, satMix, satDrive,
        comp: { thresh: 0.2, ratio: 4, atk: 0.01, rel: 0.14, makeup: 1.12 }, trim: 1.0 };
    // guitar / lead / the power-chord pad wall: scoop mids, lift presence.
    return { hpf: role === "pad" ? 70 : 95, eq: { f: 640, gain: -(4 + 3 * drive), q: 0.9 },
      eq2: { f: 3200, gain: 3 + 2 * drive, q: 0.7 },
      sat, satMix, satDrive,
      comp: { thresh: 0.22, ratio: 3.5, atk: 0.008, rel: 0.12, makeup: 1.1 }, trim: 0.98 };
  }
  // sampled-instrument family from its id (for the per-song voice-FX augmentation)
  function samplerFamily(id) {
    id = id || "";
    if (/organ/.test(id)) return "organ";
    if (/guitar|nylon|steel|jazz|clean|overdrive|palm|harmonics/.test(id)) return "guitar";
    if (/piano|rhodes|_ep|honky|clav|harpsi|celesta|music_box/.test(id)) return "keys";
    if (/vibra|glock|marimba|xylo|kalimba|dulcimer|tinker|bell/.test(id)) return "mallet";
    return "other";
  }
  // TWO-PER-VOICE on the SAMPLED (default) path: sampled LEAD voices get ONE
  // deterministic extra strip stage on top of their base channel strip (which
  // already carries a chorus) — organ -> leslie, guitar -> flanger/delay, else a
  // tasteful beat-synced tape delay. Hashed on instrumentSeed (stable per song,
  // NOT per bar). Pads already carry chorus+phaser (two air stages); bass/drums
  // stay tight (no leslie/delay mud). LFOs ride global song time -> segment-parity
  // byte-equal, strip-fuzz finite.
  function voiceFxStage(role, id, state) {
    if (role !== "melody" && role !== "solo") return null;
    const fam = samplerFamily(id);
    const seed = state && state.instrumentSeed != null ? state.instrumentSeed : ((state && state.seed) || 0);
    const h = famHash("vfx|" + role + "|" + id + "|" + (seed >>> 0));
    const spb = 60 / (state && state.bpm ? state.bpm : 120);
    const delaySpec = { timeSec: clamp(0.75 * spb, 0.05, 1.4), feedback: 0.28, tone: 3200, mix: 0.2 };
    if (fam === "organ") return { leslie: { speed: (h & 1) ? 0.85 : 0.18, depth: 0.6, mix: 0.32 } };
    if (fam === "guitar") return (h & 1) ? { flanger: { rate: 0.3, depth: 0.7, feedback: 0.4, mix: 0.22 } } : { delay: delaySpec };
    return { delay: delaySpec };
  }
  const stripFor = (role, id, state, m, hasNativeInserts) => {
    const drive = role === "drum" ? 0 : heavyDriveOf(m);
    // INSERTS-ON-SAMPLED-VOICES (2026-07): when the unit carries its declared
    // insert chain NATIVELY (samplerUnit below), the hashed voiceFxStage extra
    // is skipped — the genre's own declared choice wins over the house default
    // (same law as defaultInserts: "a non-empty kernel array overrides").
    // Units without declared inserts keep the exact pre-existing strip.
    // BOLD path: a genre-declared distortion on a sampled voice becomes a real
    // heavy channel strip (distort stays strip-folded — see samplerUnit).
    if (drive >= HEAVY_MIN) {
      const heavy = aggressiveStrip(role, drive);
      const extra = hasNativeInserts ? null : voiceFxStage(role, id, state);   // leads keep their delay/leslie air on top
      return extra ? { ...heavy, ...extra } : heavy;
    }
    const base = role === "bass" ? STRIP_PROFILES.bass
      : role === "pad" ? STRIP_PROFILES.pad
      : (role === "melody" || role === "solo") ? STRIP_PROFILES.lead
      : STRIP_PROFILES.drum;
    // a SMALL declared drive (funk/acid touches, < HEAVY_MIN) just lifts the
    // base saturation a little (more grit, not a metal scoop).
    const gritted = drive > 0.01
      ? { ...base, sat: clamp((base.sat || 0) + 0.45 * drive, 0, 1), satMix: clamp((base.satMix != null ? base.satMix : 0.3) + 0.3 * drive, 0, 1) }
      : base;
    const extra = hasNativeInserts ? null : voiceFxStage(role, id, state);
    return extra ? { ...gritted, ...extra } : gritted;   // new object only when augmented
  };
  // AIR — modest reverb-send lift on sampled pads/leads (let them breathe). A
  // uniform scalar on top of the recipe send (relative wetness preserved); bass
  // and drums unaffected. Clamped like every send.
  const AIR_REV = { pad: 1.15, melody: 1.1, solo: 1.1 };

  // ==== THE MASTERING STAGE (2026-07-10, Paul: "a final mixing/balancing/
  // panning/gainstage/compression stage that does what a good DJ or live sound
  // engineer does. The sound of the fugue is very muddy in the final mix. We
  // may be using too much reverb overall.") ==================================
  // Three renderer-level mechanisms, all MATRIX-BLIND by construction (they
  // live on the resolved UNITS / master fx params; the symbolic verifier and
  // the confusion matrix read only state fields, which are untouched):
  //   1. STEREO PLACEMENT — per-voice constant-power pan at the unit level
  //      (bass/kick/snare/sfx stay center; lead slightly right, solos
  //      alternating left/right, pad slightly left with a per-note pitch
  //      spread on the sampled path, hats/rides/perc kit-spread). Realized by
  //      the offline renderers (press + the wavOut stream) on the existing
  //      wide buses; the live ring path ignores `pan` (mono placement there,
  //      documented) — a unit WITHOUT pan renders through the exact old
  //      mono-dry path, byte-identical.
  //   2. SAME-TIMBRE COLLISION CARVE — when two PITCHED voices resolve the
  //      SAME sampler id (fugue seed 3: church_organ on bass AND melody),
  //      they read as soup, not parts. The lead keeps its full range; every
  //      other voice in the collision gets an EQ carve on its channel strip:
  //      HPF ~300 Hz (pad/lead accompaniment) and/or a 300-600 Hz mud-band
  //      dip. Bass keeps its lows (it IS the bass) and takes only the dip.
  //   3. REVERB BUDGET — a density-aware scale on the MASTER reverb return:
  //      wetSum = (Σ voice sends) × state.reverb estimates the wash;
  //      beat DENSITY (share of sections with drums on) decides how much wash
  //      the mix can afford. Beatless drones (ambient/mallsoft/doomdrone —
  //      the wash IS the genre) keep cap ~capHi and never scale; driving
  //      drenched mixes scale down toward definition. Measured on the full
  //      catalog (seed 3): 11/228 genres trim (all reverb >= 0.7, all
  //      beat-carrying: dinosynth 0.67, vaporwave 0.74 … hvacbop 0.95);
  //      ambient/fugue/techno/gabber/jazz all scale 1.0 exactly.
  // Tunables (conservative defaults — Paul's knobs):
  const MASTER_PAN = {
    melody: 0.10,   // lead a touch right
    pad: -0.08,     // pad counterweights left (+ per-note spread below)
    hat: 0.18, ride: 0.22, rim: -0.16, crash: 0.12, clap: 0.08, perc: -0.18,
    tom: -0.10, stab: -0.10,
    // bass/kick/snare/sfx: CENTER (no entry => no pan field => old byte path)
  };
  const PAN_SOLO = 0.14;        // solos alternate ±this, in sorted key order
  const PAN_SPREAD_PAD = 0.28;  // sampled-pad per-note spread: ±this per octave off middle C
  const CARVE_HPF = 300;                              // Hz — accompaniment high-pass
  const CARVE_DIP = { f: 450, gain: -4, q: 0.9 };     // the 300-600 mud-band dip
  const REV_BUDGET = { capHi: 2.2, slope: 1.9, floor: 0.55 };
  // DRUM BALANCE (2026-07-10, Paul: "drums in the louder genres to the bottom
  // right are very hot — a limiter/compressor strategy to balance voices
  // everywhere"). The hottest kits (kick/snare lvl up to ~1.65 in thrash/metal/
  // gabber) dominate the sum and slam the live master limiter, ducking the
  // melodic voices. A gentle KIT-LEVEL pull toward `target` lets the voices sit
  // up without flattening the kit's character — only the OVERAGE above target is
  // trimmed, and only partway (`keep` = fraction of the overage retained). Kits
  // already at/under target are untouched => byte-identical there. Shared unit
  // choke point => press + stream + live-bake all inherit it (everywhere). Tune
  // here; Paul's ears are the calibration.
  const DRUM_BAL = { target: 1.1, keep: 0.6, floor: 0.72 };

  // constant-power pan gains, ×√2 so center ≈ the old dup-to-both-channels
  // level (pan 0 is never routed here — the old path handles it bit-exactly).
  function panGains(pan) {
    const th = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
    return { l: Math.SQRT2 * Math.cos(th), r: Math.SQRT2 * Math.sin(th) };
  }
  // per-NOTE pan for sampled voices: unit pan + (pad) pitch spread — higher
  // chord tones drift right, lower left, like a real ensemble seating. Pure
  // function of (unit, freq): window-independent => segment-parity safe.
  function notePan(u, freq) {
    const base = (u && u.pan) || 0;
    const spread = (u && u.panSpread) || 0;
    if (!spread) return base;
    const off = Math.log2(Math.max(20, freq || 261.63) / 261.63) * spread;
    return clamp(base + clamp(off, -spread, spread), -0.9, 0.9);
  }
  function applyMasterPan(units) {
    for (const [k, p] of Object.entries(MASTER_PAN)) if (units[k]) units[k].pan = p;
    const solos = Object.keys(units).filter((k) => k.startsWith("solo:")).sort();
    solos.forEach((k, i) => { units[k].pan = (i % 2 ? 1 : -1) * PAN_SOLO; });
    if (units.pad && units.pad.sampler) units.pad.panSpread = PAN_SPREAD_PAD;
  }
  // SAME-TIMBRE COLLISION CARVE — pitched units grouped by resolved sampler
  // id; in each group the most lead-like voice keeps its range, the rest get
  // the carve on a CLONED strip (STRIP_PROFILES are shared objects — never
  // mutate them). Returns the carved keys (test/debug surface).
  const CARVE_RANK = { melody: 0, solo: 1, pad: 2, bass: 3 };
  function collisionCarve(units) {
    const groups = {};
    for (const [k, u] of Object.entries(units)) {
      if (!u || u.__meta || u.drum || !u.sampler || !u.sampler.id) continue;
      if (!(u.role in CARVE_RANK)) continue;
      (groups[u.sampler.id] = groups[u.sampler.id] || []).push(k);
    }
    const carved = [];
    for (const [id, keys] of Object.entries(groups)) {
      if (keys.length < 2) continue;
      keys.sort((a, b) => (CARVE_RANK[units[a].role] - CARVE_RANK[units[b].role]) || (a < b ? -1 : 1));
      for (const k of keys.slice(1)) {
        const u = units[k];
        const strip = { ...(u.sampler.strip || {}) };
        if (u.role !== "bass") strip.hpf = Math.max(strip.hpf || 0, CARVE_HPF);
        if (!strip.eq2) strip.eq2 = { ...CARVE_DIP };   // aggressive strips already spend eq2 — keep theirs
        u.sampler = { ...u.sampler, strip };
        u.carve = id;
        carved.push(k);
      }
    }
    return carved;
  }
  // REVERB BUDGET — the density-aware master-return scale (1 = untouched).
  // Consumed by fxParams (internal zita rgain) + reverbColor (color rgain),
  // so press, the wavOut stream AND live all inherit it from this one point.
  function reverbScale(state) {
    const I = (state && state.instruments) || {};
    const s = (v, d) => (v && v.send != null ? v.send : d);
    const sendSum = s(I.pad, 0.55) + s(I.bass, 0.08) + s(I.melody, 0.45) + s(I.drums, 0.18);
    const rv = state && state.reverb != null ? state.reverb : 0.7;
    let dsum = 0, n = 0;
    for (const sec of ((state && state.sections) || [])) {
      n++;
      const d = sec.drums;
      dsum += (!d || d === "off") ? 0 : d === "full" ? 1 : 0.6;
    }
    const density = n ? dsum / n : 0;
    const wet = rv * sendSum;
    const cap = REV_BUDGET.capHi - REV_BUDGET.slope * density;
    return Math.max(REV_BUDGET.floor, Math.min(1, cap / Math.max(wet, 1e-6)));
  }
  // DRUM BALANCE — gentle kit-level pull for hot genres (see DRUM_BAL). Scales
  // the drum UNIT lvls (which carry the recipe kick/snare/hat/tom levels — the
  // drum event gain is u.lvl*amp) toward `target`; pure function of the resolved
  // units (zero rng — determinism-safe like the pan/carve/budget passes). Returns
  // the applied scale (1 = untouched) for the fxLabels/debug roster.
  function drumBalance(units) {
    const kit = ["kick", "snare", "hat", "tom", "ride", "crash", "perc", "clap", "rim"];
    let peak = 0;
    for (const k of kit) { const u = units[k]; if (u && u.lvl != null) peak = Math.max(peak, u.lvl); }
    if (peak <= DRUM_BAL.target) return 1;   // gentle kits untouched (byte-identical)
    const scale = Math.max(DRUM_BAL.floor,
      (DRUM_BAL.target + (peak - DRUM_BAL.target) * DRUM_BAL.keep) / peak);
    for (const k of kit) { const u = units[k]; if (u && u.lvl != null) u.lvl *= scale; }
    return scale;
  }
  // friendly reverb-character names for the fxLabels roster (viz metadata).
  const REVERB_LABELS = { dattorro: "plate", greyhole: "hall", fdn: "room", spring: "spring", shimmer: "shimmer" };
  const revLabel = (state) => REVERB_LABELS[state && state.reverbColor] || "reverb";

  // ---- fxLabels: compact human-readable effect descriptors for the on-screen
  // genre roster (metadata ONLY — never read by any render loop, must not move a
  // gate). `unit.fxLabels` summarizes a voice's channel strip + inserts + sends;
  // SE.fxLabels(state) summarizes the master/bus chain (the "master:" line).
  const INSERT_LABELS = { distort: "drive", phaser: "phaser", chorus: "chorus",
    filtersweep: "filter sweep", wah: "auto-wah", tremolo: "tremolo",
    leslie: "leslie", flanger: "flanger", delay: "tape echo", ringmod: "ring mod", granular: "granular" };
  function fxLabelsFor(key, u, state) {
    const L = [];
    if (u.sampler && u.sampler.strip) {
      const s = u.sampler.strip;
      if (s.hpf) L.push("HPF " + s.hpf);
      if (s.lpf) L.push("LPF " + (s.lpf >= 1000 ? s.lpf / 1000 + "k" : s.lpf));
      if (s.eq) L.push((s.eq.gain >= 0 ? "+" : "") + s.eq.gain + "dB@" + (s.eq.f >= 1000 ? Math.round(s.eq.f / 100) / 10 + "k" : s.eq.f));
      if (s.sat) L.push("saturate");
      if (s.comp) L.push("comp " + s.comp.ratio + ":1");
      if (s.chorus) L.push(s.chorus.two ? "ensemble" : "chorus");
      if (s.phase) L.push("phaser");
      if (s.leslie) L.push("leslie");
      if (s.delay) L.push("tape echo");
      if (s.flanger) L.push("flanger");
      // native-honored declared inserts (INSERTS-ON-SAMPLED-VOICES) ride on top
      if (u.inserts && u.inserts.length) for (const i of u.inserts) L.push(INSERT_LABELS[i.type] || i.type);
    } else if (u.inserts && u.inserts.length) {
      for (const i of u.inserts) L.push(INSERT_LABELS[i.type] || i.type);
    }
    if (u.rev > 0.02) L.push(revLabel(state) + " " + Math.round(Math.min(1, u.rev) * 100) + "%");
    if (u.del > 0.02) L.push("delay");
    return L;
  }
  function fxLabels(state) {
    const L = [];
    const rv = state.reverb != null ? state.reverb : 0.7, rl = revLabel(state);
    L.push((rl === "reverb" ? "reverb " : rl + " reverb ") + Math.round(rv * 100) + "%");
    const dl = state.delay || {};
    if (dl.beats || dl.feedback != null) L.push("delay");
    if (state.pingpong) L.push("ping-pong");
    L.push("voice saturation");        // broad per-voice tanh drive (channel strips)
    L.push("pad chorus + phaser");     // the default air on sampled pads/leads
    if ((state.grit || 0) > 0.01) L.push("master drive " + Math.round(state.grit * 100) + "%");
    if ((state.comp || 0) > 0.01) L.push("bus comp");
    if (masterMb(state)) L.push("multiband master comp");
    if ((state.pump || 0) > 0.01) L.push("sidechain pump");
    return L;
  }

  // ---- per-voice insert chain (state.instruments.<voice>.inserts contract) ----
  // 0-2 of {type, ...params}; type ∈ distort/phaser/chorus/filtersweep/wah/
  // tremolo/leslie/flanger/delay/ringmod/granular. Applied INSERT-style between
  // the voice and its layer tap / fx sends (per voice — pad/bass/melody and
  // solos, which inherit melody's recipe — never on the shared buses). Normalized
  // here so live/press share clamps + module names. filtersweep + delay are
  // tempo-synced: `barSec: true` tells the engine to set the module's barSec
  // param from state.bpm (4 beats/bar) and re-set it on glides. Per the kernel
  // contract (csd-engine defaultInstruments): rate is Hz, rateBars = sweep period
  // in bars, and filtersweep lo/hi are OCTAVES RELATIVE TO THE VOICE'S CUTOFF —
  // converted to Hz here (cutoffHz arg).
  //
  // TWO-PER-VOICE HOUSE STYLE (2026-07): when a recipe carries NO inserts (an
  // EMPTY or absent array) AND role/state are supplied, defaultInserts()
  // deterministically picks TWO role/model-appropriate inserts (hashed on
  // instrumentSeed — stable per song, NOT per bar, like the instrument pick).
  // A NON-EMPTY kernel array overrides the default entirely (the genre's own
  // choice wins). NOTE: csd-engine.defaultInstruments bakes `inserts:[]` onto
  // every voice, so an empty array is the framework "unset" — it CANNOT be told
  // apart from a deliberate opt-out, and Paul's directive is pervasive two-per-
  // voice FX, so empty => house-style default. A voice that must stay bone-dry
  // opts out downstream (solina overrides `inserts:[]` in pitchedUnit). Signature
  // synths get a restrained pool (a subtle delay — never a granulator/leslie/
  // heavy drive that would erase the moving filter / detune / hard-sync identity).
  // Sampled voices never reach here (they carry a channel STRIP instead).
  function insertChain(m, cutoffHz, role, state) {
    const explicit = Array.isArray(m.inserts) && m.inserts.length > 0;
    const list = explicit ? m.inserts
      : (role && state ? defaultInserts(role, m, state) : []);
    // SYNTHESIS-DEPTH Part C (tempo-synced LFOs): any Hz-rate LFO insert
    // (tremolo/chorus/phaser/flanger) may declare `rateBars` — the LFO period
    // as a fraction of a bar (house unit, like timeBars: 0.125 = an 1/8-note
    // wobble, 1/12 = 1/8-triplet, 2 = a two-bar sweep) — and the ENGINE
    // resolves it to Hz from state.bpm (filtersweep already has true barSec
    // sync in-module and stays the first-class bar-locked sweep). Baked at
    // chain build: a live bpm GLIDE keeps the old Hz until the chain rebuilds
    // (genre changes rebuild chains — documented, perceptual-twin class).
    // Absent rateBars => the Hz path, byte-identical.
    const syncHz = (bars, lo, hi) => clamp(1 / (Math.max(0.01, bars) * 4 * (60 / state.bpm)), lo, hi);
    const rateOf = (it, dflt, lo, hi) => (it.rateBars != null && state && state.bpm)
      ? syncHz(it.rateBars, lo, hi) : clamp(it.rate != null ? it.rate : dflt, lo, hi);
    const out = [];
    for (const it of list) {
      if (!it || out.length >= 2) break;
      switch (it.type) {
        case "distort": out.push({ type: "distort", module: "insert_distort", params: {
          drive: clamp(it.drive != null ? it.drive : 0.5, 0, 1),
          tone: clamp(it.tone != null ? it.tone : 4500, 500, 12000),
          mix: clamp(it.mix != null ? it.mix : 1, 0, 1) } }); break;
        // higain — the STAGED heavy amp (SYNTHESIS-DEPTH Part A): tightness
        // gate -> 3 cascaded waveshaper stages (inter-stage HP) -> 3-band tone
        // stack -> fixed 4x12 cab sim -> level comp + DC block. The proper
        // chain for the heavy genres; insert_distort stays the light dirt.
        // tone may arrive as {low,mid,high} (the recipe spelling) or flat
        // low/mid/high keys; 0.5 = flat, 0..1 = ±12 dB. mix 0 = bit-exact
        // bypass like every insert. NOTE for anchors: a SAMPLED voice
        // declaring higain should not also carry heavy strip distortion
        // (heavyDriveOf) — the amp IS the drive.
        case "higain": {
          const tn = it.tone && typeof it.tone === "object" ? it.tone : it;
          out.push({ type: "higain", module: "insert_higain", params: {
            gate: clamp(it.gate != null ? it.gate : 0.35, 0, 1),
            drive: clamp(it.drive != null ? it.drive : 0.65, 0, 1),
            stages: clamp(it.stages != null ? it.stages : 2, 1, 3),
            low: clamp(tn.low != null ? tn.low : 0.5, 0, 1),
            mid: clamp(tn.mid != null ? tn.mid : 0.5, 0, 1),
            high: clamp(tn.high != null ? tn.high : 0.5, 0, 1),
            presence: clamp(it.presence != null ? it.presence : 0.5, 0, 1),
            level: clamp(it.level != null ? it.level : 0.7, 0, 1),
            mix: clamp(it.mix != null ? it.mix : 1, 0, 1) } }); break;
        }
        // fenv — note-triggered FILTER ENVELOPE insert (SYNTHESIS-DEPTH Part
        // B): an amp-follower contour sweeps a resonant ladder `amount`
        // OCTAVES (signed) around `base` — the squelch for SAMPLED basses/
        // keys (synth models get the per-model fenv* params instead, see
        // FENV_MAP). base defaults to the voice's recipe cutoff; the swept
        // top is fenced by cutMaxForRes (SHRIEK GUARD, like filtersweep).
        case "fenv": {
          const fres = clamp(it.res != null ? it.res : 0.5, 0, 0.95);
          const fbase = clamp(it.base != null ? it.base : (cutoffHz || 800), 60, 12000);
          let famt = clamp(it.amount != null ? it.amount : 2, -4, 4);
          const fCap = cutMaxForRes(fres, 16000);
          if (famt > 0) famt = Math.min(famt, Math.max(0, Math.log2(Math.max(1, fCap / fbase))));
          out.push({ type: "fenv", module: "insert_fenv", params: {
            sens: clamp(it.sens != null ? it.sens : 0.6, 0, 1),
            amount: famt,
            attack: clamp(it.attack != null ? it.attack : 0.004, 0.001, 0.5),
            decay: clamp(it.decay != null ? it.decay : 0.18, 0.02, 2),
            base: fbase, res: fres,
            mix: clamp(it.mix != null ? it.mix : 1, 0, 1) } }); break;
        }
        // leslie — MONO rotary speaker (crossover + inertial horn/drum rotors,
        // AM + doppler FM). speed 0 chorale..1 tremolo. mix 0 = bit-exact bypass.
        case "leslie": out.push({ type: "leslie", module: "insert_leslie", params: {
          speed: clamp(it.speed != null ? it.speed : 0.5, 0, 1),
          depth: clamp(it.depth != null ? it.depth : 0.8, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.6, 0, 1) } }); break;
        // flanger — swept short delay + SIGNED feedback (the jet zip). mix 0 bypass.
        case "flanger": out.push({ type: "flanger", module: "insert_flanger", params: {
          rate: rateOf(it, 0.4, 0.01, 8),
          depth: clamp(it.depth != null ? it.depth : 0.8, 0, 1),
          feedback: clamp(it.feedback != null ? it.feedback : 0.5, -0.95, 0.95),
          mix: clamp(it.mix != null ? it.mix : 0.6, 0, 1) } }); break;
        // delay — per-voice TAPE echo (tempo-synced via timeBars*barSec; tone LP +
        // wow in the loop). Distinct from the global delay SEND. mix 0 bypass.
        case "delay": out.push({ type: "delay", module: "insert_delay", barSec: true, params: {
          timeBars: clamp(it.timeBars != null ? it.timeBars : 0.1875, 0.01, 4),
          feedback: clamp(it.feedback != null ? it.feedback : 0.35, 0, 0.9),
          tone: clamp(it.tone != null ? it.tone : 3000, 300, 12000),
          wow: clamp(it.wow != null ? it.wow : 0.2, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.35, 0, 1) } }); break;
        // ringmod — sine-carrier ring modulation (metallic clangor). mix 0 bypass.
        case "ringmod": out.push({ type: "ringmod", module: "insert_ringmod", params: {
          freq: clamp(it.freq != null ? it.freq : 220, 20, 4000),
          mix: clamp(it.mix != null ? it.mix : 0.4, 0, 1) } }); break;
        // granular — grain stutter/cloud (2-grain transpose + stutter gate). mix 0 bypass.
        case "granular": out.push({ type: "granular", module: "insert_granular", params: {
          pitch: clamp(it.pitch != null ? it.pitch : 0, -12, 12),
          density: clamp(it.density != null ? it.density : 0.5, 0, 1),
          rate: clamp(it.rate != null ? it.rate : 12, 1, 40),
          mix: clamp(it.mix != null ? it.mix : 0.5, 0, 1) } }); break;
        case "phaser": out.push({ type: "phaser", module: "insert_phaser", params: {
          rate: rateOf(it, 0.5, 0.01, 8),
          depth: clamp(it.depth != null ? it.depth : 0.7, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.7, 0, 1) } }); break;
        case "chorus": out.push({ type: "chorus", module: "insert_chorus", params: {
          rate: rateOf(it, 0.8, 0.01, 8),
          depth: clamp(it.depth != null ? it.depth : 0.5, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.5, 0, 1) } }); break;
        // wah — crybaby/Mutron AUTO-WAH (envelope-follower bandpass), for funk/
        // disco bass. sens = envelope drive, base = floor Hz, range = octaves of
        // sweep, q = resonance, mix = dry/wet (0 = bit-exact bypass). No clock.
        case "wah": out.push({ type: "wah", module: "insert_wah", params: {
          sens: clamp(it.sens != null ? it.sens : 0.6, 0, 1),
          base: clamp(it.base != null ? it.base : 320, 80, 1200),
          range: clamp(it.range != null ? it.range : 2.2, 0, 4),
          q: clamp(it.q != null ? it.q : 4, 0.5, 12),
          mix: clamp(it.mix != null ? it.mix : 0.85, 0, 1) } }); break;
        // tremolo — amp AM (surf's Fender bias/opto trem) with a shape morph
        // (0 sine -> 1 hard bias) and a wobble param (exotica's vibraphone-fan
        // cents-level pitch flutter). mix 0 = bit-exact bypass (insert law).
        case "tremolo": out.push({ type: "tremolo", module: "insert_tremolo", params: {
          rate: rateOf(it, 5, 0.5, 12),
          depth: clamp(it.depth != null ? it.depth : 0.7, 0, 1),
          shape: clamp(it.shape != null ? it.shape : 0, 0, 1),
          wobble: clamp(it.wobble != null ? it.wobble : 0, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.8, 0, 1) } }); break;
        case "filtersweep": {
          const base = clamp(cutoffHz || 2000, 60, 12000);
          const loHz = clamp(base * Math.pow(2, it.lo != null ? it.lo : -1), 40, 12000);
          // SHRIEK GUARD (1c): a RESONANT sweep's top is fenced by cutMaxForRes —
          // sweeping a res-0.5+ peak past ~12 kHz is a whistle. Catalog-measured
          // byte-identical (no anchor sweeps a res>0.35 peak above 10 kHz).
          const swRes = clamp(it.res != null ? it.res : 0.5, 0, 0.95);
          const swCap = cutMaxForRes(swRes, 16000);
          const loHz2 = Math.min(loHz, swCap / 1.05);   // keep lo<hi under the fence
          const hiHz = clamp(Math.max(base * Math.pow(2, it.hi != null ? it.hi : 1), loHz2 * 1.05), 60, swCap);
          out.push({ type: "filtersweep", module: "insert_filtersweep", barSec: true, params: {
            rateBars: clamp(it.rateBars != null ? it.rateBars : 4, 0.25, 64),
            lo: loHz, hi: hiHz,
            res: swRes } }); break;
        }
      }
    }
    return out;
  }

  // inserts whose PRESENCE is a voice's identity (never shed even in 2nd slot).
  // higain: a heavy genre's staged amp IS the genre — shedding it turns
  // sludgemetal into easy listening (fenv stays sheddable seasoning).
  const IDENTITY_INSERTS = new Set(["tremolo", "leslie", "granular", "higain"]);

  // ---- DEFAULT TWO-INSERT POLICY (2026-07 "two per voice" house style) --------
  // When a recipe carries no explicit `inserts`, pick TWO role/model-appropriate
  // inserts DETERMINISTICALLY (hashed on role/model/instrumentSeed — stable per
  // song like the instrument pick, NOT per bar). Returns recipe-style objects
  // (insertChain's switch clamps them). Kernel-supplied inserts always override;
  // an explicit `inserts:[]` opts out entirely (handled in insertChain).
  //   pad    -> chorus/ensemble + a slow leslie OR a slow phaser
  //   lead   -> tape delay + chorus OR flanger  (keys/organ family -> leslie + delay)
  //   bass   -> subtle drive + a slow filter sweep  (never chorus — no mud)
  //   SIGNATURE synths (tb303 etc.) keep identity: only a SUBTLE tape delay
  //   (a moving-filter/detune/sync signature can't survive a granulator).
  const KEYSY_MODELS = new Set(["organ", "hammond", "rhodes", "piano", "bell", "casiocz", "juno60"]);
  function defaultInserts(role, m, state) {
    const seed = state && state.instrumentSeed != null ? state.instrumentSeed : ((state && state.seed) || 0);
    const model = m.model || "";
    const h = famHash("ins|" + role + "|" + model + "|" + (seed >>> 0));
    const pick = (arr) => arr[h % arr.length];
    const pick2 = (arr) => arr[(h >>> 5) % arr.length];
    // SIGNATURE synths — restrained: a subtle tempo-synced delay, nothing that
    // erases the moving filter / detune-beat / hard-sync that IS the identity.
    if (SIGNATURE_MODELS.has(model)) {
      if (role === "bass") return [{ type: "delay", timeBars: 0.25, feedback: 0.22, tone: 2600, wow: 0.15, mix: 0.13 }];
      return [{ type: "delay", timeBars: 0.1875, feedback: 0.3, tone: 3200, wow: 0.2, mix: 0.19 },
              { type: "chorus", rate: 0.5, depth: 0.35, mix: 0.15 }];
    }
    if (role === "bass") {
      // never mud: subtle drive + a slow filter sweep; NO chorus on (sub-heavy) bass
      return [{ type: "distort", drive: 0.3, tone: 3200, mix: 0.5 },
              { type: "filtersweep", rateBars: 8, lo: -0.6, hi: 0.8, res: 0.35 }];
    }
    if (role === "pad") {
      const second = pick(["leslie", "phaser"]);
      return [{ type: "chorus", rate: 0.4, depth: 0.5, mix: 0.28 },
        second === "leslie" ? { type: "leslie", speed: 0.15, depth: 0.6, mix: 0.4 }
                            : { type: "phaser", rate: 0.18, depth: 0.7, mix: 0.3 }];
    }
    // lead (melody/solo)
    if (KEYSY_MODELS.has(model)) {
      return [{ type: "leslie", speed: pick2([0.2, 0.85]), depth: 0.7, mix: 0.42 },
              { type: "delay", timeBars: 0.1875, feedback: 0.32, tone: 3200, wow: 0.25, mix: 0.22 }];
    }
    const second = pick(["chorus", "flanger"]);
    return [{ type: "delay", timeBars: 0.1875, feedback: 0.3, tone: 3400, wow: 0.2, mix: 0.22 },
      second === "chorus" ? { type: "chorus", rate: 0.8, depth: 0.4, mix: 0.2 }
                          : { type: "flanger", rate: 0.3, depth: 0.7, feedback: 0.45, mix: 0.28 }];
  }

  function mergedInstruments(E, state) {
    const D = E.defaultInstruments(), s = state.instruments || {};
    return { pad: { ...D.pad, ...s.pad }, bass: { ...D.bass, ...s.bass },
             melody: { ...D.melody, ...s.melody }, drums: { ...D.drums, ...s.drums } };
  }

  // ---- pitched voice unit: recipe -> {module, static params, per-note flags} ----
  // rev/del gains divide out `level` because csound sends tap PRE-level
  // (instr 1/2/4: gaMix += asig*level but gaRev += asig*send) while the Faust
  // modules bake level into their output.
  // SHRIEK GUARD choke point: every pitched unit passes through here once, so
  // the resonance ease is applied to the RESOLVED static params (whatever model
  // clamps applied inside), covering all res-bearing models (res + tb303's
  // `resonance`) without touching the per-model mapping code.
  function pitchedUnit(role, m, state) {
    const u = pitchedUnitRaw(role, m, state);
    const P = u.params;
    if (P && P.cutoff != null) {
      if (P.res != null) P.res = easeRes(P.cutoff, P.res);
      if (P.resonance != null) P.resonance = easeRes(P.cutoff, P.resonance);
    }
    applyFenv(u, m);
    return u;
  }

  // ---- SYNTHESIS-DEPTH unified filter-envelope surface (2026-07) -----------
  // Recipe keys `fenvAmount` (cutoff env depth, OCTAVES, signed) /
  // `fenvAttack` / `fenvDecay` (seconds) drive the model's filter envelope
  // whatever its internal spelling: models with a NATIVE env keep their own
  // params (mapped + clamped to the DSP slider ranges below); every other
  // filter-bearing model gained uniform fenv* sliders this round (dsp/*.dsp,
  // fenvAmount default 0 = bit-exact off). ABSENT KEYS SET NOTHING — an
  // untouched recipe resolves byte-identical params (the absent-law).
  // Deliberate exclusions: juno60 maps only fenvAmount (its single ADSR
  // drives VCF+VCA together — fenvAttack/Decay would move the amp envelope);
  // tb303 keeps its envmod/decay signature contract; piano/bell/brass/
  // hammond/robot_choir have no filter env to drive (decay-shaped /
  // bite-driven / drawbars / vocoder). SAMPLED voices get the `fenv` INSERT
  // instead (insertChain above). The legacy `fenv` recipe key (the csound
  // multiplier zap) is untouched and coexists.
  const FENV_T2 = { amt: ["fenvAmount", -4, 4], atk: ["fenvAttack", 0.001, 2], dec: ["fenvDecay", 0.01, 3] };
  const FENV_MAP = {
    // native-env models
    modeld:   { amt: ["envAmount", 0, 5], atk: ["envAttack", 0.001, 0.5], dec: ["envDecay", 0.01, 2] },
    synclead: { amt: ["envAmount", 0, 5], dec: ["envDecay", 0.01, 2] },
    oberheim: { amt: ["envAmount", 0, 5], atk: ["envAttack", 0.001, 5], dec: ["envDecay", 0.01, 5] },
    juno60:   { amt: ["envAmount", -4, 6] },
    ppg:      { amt: ["envAmount", 0, 4] },
    // unified fenv* models (this round's dsp edits)
    pad_saw: FENV_T2, strings: FENV_T2, choir: FENV_T2, organ: FENV_T2, vp330: FENV_T2,
    solina: FENV_T2, bass_sub: FENV_T2, bass_reese: FENV_T2, bass_wobble: FENV_T2,
    supersaw: FENV_T2, lead_fuzz: FENV_T2, lead_pluck: FENV_T2, fm2op: FENV_T2,
    bass_saw: FENV_T2, bass_acid: FENV_T2, casiocz: FENV_T2, lead_guitar: FENV_T2,
    // lead_kpluck: DELIBERATELY absent — its brightness lowpass is a pure
    // control-rate expression; multiplying in a sample-rate fenvMul perturbs
    // the recursive waveguide's float rounding even at fenvMul==1.0 (measured
    // 1e-7, growing), so a bit-exact absent-law is impossible without
    // restructuring the voice. Its flanger evolution is its motion anyway.
  };
  function applyFenv(u, m) {
    const fm = FENV_MAP[u.module], P = u.params;
    if (!fm || !P) return;
    if (m.fenvAmount != null && fm.amt) {
      let amt = clamp(m.fenvAmount, fm.amt[1], fm.amt[2]);
      // SHRIEK GUARD: a positive env may not sweep a resonant peak past the
      // taste fence (the filtersweep / per-note cutoffMul law). Applied
      // against the RESOLVED static cutoff + eased res; non-resonant models
      // (no res param) need no fence.
      const res = P.res != null ? P.res : P.resonance;
      const base = P.cutoff != null ? P.cutoff : P.tone;
      if (amt > 0 && res != null && base > 0)
        amt = Math.min(amt, Math.max(0, Math.log2(Math.max(1, cutMaxForRes(res, 16000) / base))));
      P[fm.amt[0]] = amt;
    }
    if (m.fenvAttack != null && fm.atk) P[fm.atk[0]] = clamp(m.fenvAttack, fm.atk[1], fm.atk[2]);
    if (m.fenvDecay != null && fm.dec) P[fm.dec[0]] = clamp(m.fenvDecay, fm.dec[1], fm.dec[2]);
  }
  function pitchedUnitRaw(role, m, state) {
    // param-reader: clamp(m[k]!=null?m[k]:d,lo,hi) — the null-coalescing default
    // idiom. NOT for `m.x||d` sites (0-is-falsy glide/drive/vibrato keep that).
    const mp = (k, d, lo, hi) => clamp(m[k] != null ? m[k] : d, lo, hi);
    // BASS_TRIM — Paul 2026-07-04, global mix decision: "lower the bass 25%
    // everywhere by default." Applied at the SINGLE realization point (the bass
    // level), so it hits all genres identically in both press and live and
    // preserves every anchor's RELATIVE bass level (the per-anchor `level`
    // ranges are untouched — this is a uniform scalar on top).
    const BASS_TRIM = 0.75;
    const L = (m.level != null ? m.level : 0.6) * (role === "bass" ? BASS_TRIM : 1);
    const lvl = clamp(L, 0.001, 1);
    // LEAD_FX_LIFT — Paul 2026-07-07, on-device mix note: "a little more delay and
    // reverb for leads." Applied at the SINGLE mapping point for the melody voice
    // and its solos (which inherit the melody recipe), as a uniform scalar on both
    // sends — so every genre's RELATIVE lead wetness is preserved exactly (the 32
    // per-genre send/dsend vectors are untouched). Modest (+18%); the (0,6) clamp
    // still guards. pad/bass are unaffected (lift = 1).
    const LEAD_FX_LIFT = (role === "melody" || role === "solo") ? 1.18 : 1;
    const sends = { rev: clamp((m.send || 0) / lvl * LEAD_FX_LIFT, 0, 6), del: clamp((m.dsend || 0) / lvl * LEAD_FX_LIFT, 0, 6) };
    const c = m.cutoff || 2000, res = clamp(m.res != null ? m.res : 0.15, 0, 0.95);
    const base = { role, pool: role === "pad" ? 4 : role === "bass" ? 2 : 3,
      dry: 1, ...sends, lvl, gmul: Math.max(1, L), params: { level: lvl },
      freqMax: 4000, tail: role === "pad" ? 3 : 1, inserts: insertChain(m, c, role, state) };
    const atk = clamp(Math.max(role === "pad" ? 0.05 : 0.005, m.attack != null ? m.attack : (role === "pad" ? 1.5 : 0.05)), 0.005, 5);
    const model = m.model || (role === "pad" || role === "bass" ? "saw" : "stack");
    // csound instr-4 "plucky" opt-in: setting ANY of attack/release/fenv swaps
    // the legacy sustained env for attack -> 0.06 decay -> sustain -> release
    // plus an optional per-note filter zap (kcf expseg cutoff*(1+fenv) -> cutoff)
    const plucky = m.attack != null || m.release != null || !!m.fenv;
    const rel = clamp(m.release != null ? m.release : 0.3, 0.01, 3);
    const sus = clamp(m.sustain != null ? m.sustain : 0.85, 0, 1);
    const fev = clamp(m.fenv || 0, 0, 3);
    // per-recipe release/fenv on the bass modules (only when the recipe asks)
    const bassArt = {
      ...(m.release != null ? { release: clamp(m.release, 0.01, 3) } : {}),
      ...(m.fenv != null ? { fenv: clamp(m.fenv, 0, 4) } : {}),
    };

    // NEW CONTRACT — recipe carries {dx7:{algorithm:N, params:{...}}}: play the
    // per-algorithm dx7.lib module with those params. dx7.lib has no output
    // gain — the engine scales externally (GainNode live / PCM in press),
    // per NOTE via extGainPerAmp*amp (same calibration as the rhodes preset).
    if (m.dx7 && m.dx7.algorithm != null) {
      const alg = Math.round(clamp(m.dx7.algorithm, 1, 32));
      return { ...base, module: "dx7_alg" + alg, dx7: true, dx7Params: m.dx7.params || {},
        freqMax: 1000, extGainPerAmp: 1.333 * lvl, params: {} };
    }

    // native pitched sample zones (faust/sampler.js) — no Faust module. ALL
    // roles including bass (upright walking lines). Contract: m.sampler =
    // {id, sr, zones:[{srcId, root, lo, hi, loop, loopStart, loopEnd}]}
    // (kernel toState; zone wavs ride foundSources at vol 0 so both engines
    // decode them through the existing paths). Bass default envelope is
    // shorter/percussive so looped zones never smear a walking line.
    const samplerUnit = () => {
      const sp = m.sampler || {};
      // bass calibration: FluidR3 bass zones peak near full scale while bass
      // events run ~1.7x melody amp — an upright at lead calibration lands
      // ~+10dB over the Faust bass modules at equal recipe level. x0.5 keeps
      // the upright audibly forward (~+4.5dB vs the old piano bass) without
      // drowning the mids (A/B-measured against mix/track-0N band balance).
      // SWELL mode (neoclassical strings pads): attack may run seconds-long
      // (past the zone's loop start — looped zones sustain under it) with an
      // x²-shaped crescendo ramp (sampler.js renders it identically live +
      // press). Clamps widened to 5s/6s for it; every pre-existing sampler
      // recipe sits far below the old caps, so their output is bit-identical.
      // MELLOTRON mode (recipe.mellotron truthy): tape-machine character on the
      // native sampler — wow/flutter pitch modulation, an 8s tape-strip cap with
      // a tape-runs-out release, and gentle head-EQ. Params are morphable recipe
      // dims (wowDepth/flutterDepth/tapeCap/headEq + rates); the anchors set only
      // the boolean flag and take these modest defaults (a numeric recipe key
      // would draw rng — the flag alone keeps buildEvents/verifier byte-stable).
      // Absent => no `mello` field => sampler renders the exact pre-mellotron
      // path (regression-gated bit-identity).
      const mello = m.mellotron ? {
        wowDepth: mp("wowDepth", 0.035, 0, 0.5),        // semitones (slow undulation) — HALVED 2026-07-04 (Paul: tape wobble went too far); was 0.07
        flutterDepth: mp("flutterDepth", 0.0175, 0, 0.5),  // semitones (fast micro-variation) — HALVED 2026-07-04; was 0.035
        wowRate: mp("wowRate", 0.7, 0.1, 3),
        flutterRate: mp("flutterRate", 7, 3, 12),
        tapeCap: m.tapeCap === false ? 0 : clamp(m.tapeCap === true || m.tapeCap == null ? 8 : m.tapeCap, 0, 8),
        headEq: mp("headEq", 0.3, 0, 1),
      } : null;
      // AIR: modest reverb-send lift on sampled pad/lead (breathe), bass untouched.
      const airRev = clamp(base.rev * (AIR_REV[role] || 1), 0, 6);
      // INSERTS-ON-SAMPLED-VOICES (2026-07, the cb766a5 §blues-organ follow-up):
      // a genre's EXPLICIT resolved insert chain (the kernel's inserts axis,
      // state.instruments.<voice>.inserts — prob already fired kernel-side) is
      // HONORED on the native PCM lane. The unit carries the normalized chain
      // (insertChain clamps, same modules synth units run); press/stream process
      // the unit's pre-send PCM through the real dist/ insert modules (the
      // render-core ubuf law) and live builds Web Audio twins per unit. Two
      // deliberate exclusions:
      //   distort — already folded into the heavy/gritted channel strip
      //             (heavyDriveOf/aggressiveStrip, shipped + tuned); running
      //             insert_distort too would double the drive.
      //   the two-per-voice DEFAULT chain — sampled voices keep the channel
      //             STRIP as their house FX (defaultInserts never fires here:
      //             role/state are not passed, so an absent/empty declaration
      //             yields [] — byte-identical to the old drop, absent-law).
      // unitCost counts the chain automatically (measured: zero states cross
      // BUDGET), and trimToBudget's insert shed applies generically.
      // INSTRUMENT-REGISTER LAW: the zone roots bound honest playback — notes
      // above topRoot + SAMPLER_STRETCH_ST octave-fold DOWN, notes below
      // bottomRoot - SAMPLER_FLOOR_ST octave-fold UP (mapEvents).
      const declared = Array.isArray(m.inserts)
        ? m.inserts.filter((i) => i && i.type && i.type !== "distort") : [];
      // FILTER-ENV ON SAMPLES (2026-07-10, Paul: "filter envelopes on samples are
      // great esp when you want resonance and to mess with dynamics"). The recipe
      // `fenv` key was inert on the native sampler lane — only synth models read it
      // (FENV_MAP / the plucky path). Wire it to the amp-follower filter-env INSERT
      // (insert_fenv, already built for BOTH press and live): louder notes swing a
      // resonant ladder up to ~`fenv` octaves above the voice cutoff, then it
      // settles back — movement + resonance that tracks dynamics, WITHOUT dulling
      // sustain (base sits AT the cutoff; the sweep only adds brightness on
      // transients). Appended so authored inserts keep their slots (insertChain
      // caps the chain at 2). Absent m.fenv => no insert => byte-identical.
      const fenvIns = (m.fenv && !declared.some((i) => i.type === "fenv"))
        ? [{ type: "fenv", amount: clamp(m.fenv * 2.5, 0, 4),
             res: clamp(m.fenvRes != null ? m.fenvRes : 0.4, 0, 0.95), base: c, sens: 0.6,
             attack: 0.004, decay: clamp(m.fenvDecay != null ? m.fenvDecay : 0.18, 0.02, 2), mix: 1 }]
        : [];
      const declaredAll = declared.concat(fenvIns);
      // role/state deliberately NOT passed as role (no default chain on
      // samplers — absent-law); state rides along for rateBars tempo-sync.
      const nativeIns = declaredAll.length ? insertChain({ ...m, inserts: declaredAll }, c, null, state) : [];
      const zs = Array.isArray(sp.zones) ? sp.zones : [];
      const zRoots = zs.map((z) => z.root || 60);
      const topRoot = zRoots.length ? Math.max(...zRoots) : 0;
      const botRoot = zRoots.length ? Math.min(...zRoots) : 0;
      return { ...base, inserts: nativeIns, rev: airRev, gmul: base.gmul * (role === "bass" ? 0.5 : 1), module: null, sampler: {
          id: sp.id || "?", sr: sp.sr || 44100,
          zones: zs,
          ...(topRoot ? { stretchMaxHz: 440 * Math.pow(2, (topRoot + SAMPLER_STRETCH_ST - 69) / 12),
                          stretchMinHz: 440 * Math.pow(2, (botRoot - SAMPLER_FLOOR_ST - 69) / 12) } : {}),
          atk: mp("attack", role === "bass" ? 0.006 : 0.012, 0.003, 5),
          rel: mp("release", role === "bass" ? 0.07 : 0.09, 0.02, 6),
          swell: (m.swell || 0) >= 0.5,
          strip: stripFor(role, sp.id, state, m),   // channel strip + per-song voice-FX (leads); m carries the genre's declared distortion (heavy strip)
          ...(mello ? { mello } : {}),
        }, freqMax: 4000 };
    };

    // modeld — the Minimoog-Model-D-class MONO voice (3 osc + ladder + filter
    // env + glide; dsp/modeld.dsp). `mono:true` is the pool contract: the
    // engine routes ALL of this unit's notes to ONE voice instance and marks
    // legato notes (gap < legatoSec or overlapping) by HOLDING the gate across
    // the group — freq then slews inside the module (glide) and the envelopes
    // single-trigger. press.js implements it; live's generic pool still plays
    // every note (freq slew intact on reused nodes) but retriggers envelopes
    // until it honors mono (documented in VOICES.md).
    const modeldUnit = (isBassRole) => {
      const relD = mp("release", isBassRole ? 0.12 : 0.25, 0.01, 3);
      return { ...base, module: "modeld", mono: true, legatoSec: 0.03,
        pool: 1,   // MONO: one voice instance, ever (press honors it; live's generic pool doesn't yet — see VOICES.md)
        tail: Math.max(base.tail, relD + 0.4),
        freqMax: isBassRole ? 2000 : 4000,
        params: { ...base.params,
          cutoff: clamp(c, 60, 12000), res,
          envAmount: mp("envAmount", isBassRole ? 1.5 : 1.2, 0, 5),
          envDecay: mp("envDecay", isBassRole ? 0.14 : 0.2, 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: clamp(m.drive || 0.25, 0, 1),
          oscMix: mp("oscMix", 0.5, 0, 1),
          drift: mp("drift", 6, 0, 25),
          attack: mp("attack", 0.004, 0.001, 2),
          sustain: mp("sustain", isBassRole ? 0.8 : 0.9, 0, 1),
          release: relD } };
    };

    // tb303 — the TRUE Roland 303 (dsp/tb303.dsp): mono-legato, SUPERSEDES
    // bass_acid (the kernel switches acidhouse/psytrance to it). Works as bass OR
    // as the acid LEAD line. acid:true tags each note with accent/slide from the
    // event (mapEvents), set before its gate-on; slide holds the gate across the
    // legato group (pool 1, legatoSec 0.06). moog_vcf_2bn filter (diodeLadder is
    // the known-broken normalized-freq family — see VOICES.md).
    const tb303Unit = () => ({ ...base, module: "tb303", mono: true, legatoSec: 0.06, pool: 1, acid: true,
      tail: Math.max(base.tail, 0.4), freqMax: 2000,
      params: { ...base.params,
        cutoff: clamp(c, 60, 6000), resonance: mp("res", 0.7, 0, 1),
        envmod: mp("envmod", 0.55, 0, 1),
        decay: mp("decay", 0.4, 0.03, 2.5),
        waveform: mp("waveform", (m.wave === "square" ? 1 : m.wave === "pulse" ? 0.7 : 0), 0, 1) } });

    if (role === "bass") {
      switch (model) {
        case "modeld": return modeldUnit(true);
        case "tb303":  return tb303Unit();
        case "sub":    return { ...base, module: "bass_sub",   params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        case "acid":   return { ...base, module: "bass_acid",  params: { ...base.params, cutoff: clamp(c, 80, 12000), res,
          ...(m.release != null ? { release: clamp(m.release, 0.01, 3) } : {}),
          ...(m.fenv != null ? { fenv: clamp(m.fenv, 0, 6) } : {}) } };
        case "reese":  return { ...base, module: "bass_reese", params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        // wobble — recipe `wobbleBars` (LFO period as a bar fraction, e.g.
        // 0.125 = the dubstep 1/8 wobble) tempo-syncs the cutoff LFO from
        // state.bpm (SYNTHESIS-DEPTH Part C); absent => the free-running
        // wobbleHz path, byte-identical.
        case "wobble": return { ...base, module: "bass_wobble",params: { ...base.params, cutoff: clamp(c, 80, 12000), res,
          wobbleHz: clamp((m.wobbleBars != null && state && state.bpm)
            ? 1 / (Math.max(0.02, m.wobbleBars) * 4 * (60 / state.bpm))
            : (m.wobbleHz || 2.4), 0.1, 12) } };
        case "piano":  return { ...base, module: "piano", decayFromDur: true, params: { ...base.params, cutoff: clamp(Math.min(4000, c * 2.5), 200, 14000) } };
        case "sampler": return samplerUnit();   // the upright &co (native path)
        default:       return { ...base, module: "bass_saw",   params: { ...base.params, cutoff: clamp(c, 80, 12000), res, ...bassArt } };
      }
    }
    const isPad = role === "pad";
    switch (model) {
      case "modeld":  return modeldUnit(false);   // lead/solo only — mono voice, never a (chordal) pad; kernel pools respect that
      case "tb303":   return tb303Unit();          // the acid LEAD line (same mono 303; lead/solo only)
      case "organ":   return { ...base, module: "organ",   params: { ...base.params, cutoff: clamp(c, 80, 12000), attack: atk } };
      case "strings": return { ...base, module: "strings", params: { ...base.params, cutoff: clamp(c, 80, 12000), attack: atk } };
      case "choir":   return { ...base, module: "choir",   params: { ...base.params, cutoff: clamp(Math.min(isPad ? 8000 : 9000, c * 2.5), 200, 12000), attack: atk } };
      case "bell":    return { ...base, module: "bell", decayFromDur: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), res: clamp(res, 0, 0.95) } };
      case "piano":   return { ...base, module: "piano", decayFromDur: true, params: { ...base.params, cutoff: clamp(Math.min(isPad ? 8000 : 9000, c * 2), 200, 14000) } };
      case "brass":   return { ...base, module: "brass", biteFromAmp: true, params: { ...base.params, cutoff: clamp(Math.min(12000, c), 500, 12000), attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.08), 0.005, 3) } };
      case "fm":      return isPad
        ? { ...base, module: "fm2op", params: { ...base.params, cutoff: clamp(Math.min(8000, c * 1.7), 200, 14000), ratio: 2.001, idx0: 2.6, idx1: 0.9, idxTime: 1.1, attack: atk, vibrato: 0 } }
        : { ...base, module: "fm2op", fmLead: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), ratio: 1.4, idx0: 3.5, idx1: 1.0, attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 5), vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
            ...(plucky ? { decay: 0.06, sustain: sus, release: rel, fenv: fev } : {}) } };
      case "rhodes":  return { ...base, module: "dx7_alg5", dx7: true, dx7Preset: "E.PIANO 1", freqMax: 1000,
        // dx7.lib has no output gain; ab-render matched csound at raw*0.28 vs
        // csound amp 0.3 * level 0.7 => external scale = 1.333 * amp * level
        extGainPerAmp: 1.333 * lvl, params: {} };
      case "sampler": return samplerUnit();
      case "pluck":   return { ...base, module: "lead_pluck",  params: { ...base.params, cutoff: clamp(c, 200, 14000), res, damp: 2000,
        ...(plucky ? { release: rel, fenv: fev } : {}) } };
      case "kpluck":  return { ...base, module: "lead_kpluck", flangeFromTime: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), drive: clamp(m.drive || 0, 0, 1) } };
      case "fuzz":    return { ...base, module: "lead_fuzz",   params: { ...base.params, cutoff: clamp(c, 200, 14000), res, drive: clamp(m.drive || 0, 0, 1), vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
        ...(plucky ? { attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 5), sustain: sus, release: rel, fenv: fev } : {}) } };
      case "guitar":  return { ...base, module: "lead_guitar", params: { ...base.params, cutoff: clamp(c || 4500, 200, 14000), pluckPos: 0.75 } };
      case "vocoder": return { ...base, module: "robot_choir", vocoder: true, params: { ...base.params, cutoff: clamp(isPad ? Math.min(9000, c * 2) : c, 200, 14000), res, makeup: 5 } };
      // ---- synth fleet (2026-07): nine classic-synth voices (dsp/*.dsp) ----
      // juno60 — Roland Juno-60 poly pad/keys, STEREO (BBD chorus is the width).
      // One shared ADSR drives VCF+VCA (authentic); SIGNED envAmount (Juno
      // polarity); chorus 0..2 (off->I->II). chorusSpread is the stereo width
      // (distinct from supersaw's `spread` = detune, so the recipes don't collide).
      case "juno60":  return { ...base, module: "juno60", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          envAmount: mp("envAmount", isPad ? 1.4 : 1.0, -4, 6),
          keytrack: mp("keytrack", 0.3, 0, 1),
          lfoToFilter: mp("lfoToFilter", 0, 0, 3),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.02), 0.001, 5),
          decay: mp("decay", isPad ? 1.2 : 0.6, 0.005, 5),
          sustain: mp("sustain", isPad ? 0.7 : 0.4, 0, 1),
          release: mp("release", isPad ? 1.5 : 0.4, 0.005, 6),
          chorus: mp("chorus", isPad ? 1.4 : 1.0, 0, 2),
          spread: mp("chorusSpread", 0.9, 0, 1),
          sawLevel: mp("sawLevel", 0.6, 0, 1),
          pulseLevel: mp("pulseLevel", 0.5, 0, 1),
          subLevel: mp("subLevel", 0.3, 0, 1),
          noiseLevel: mp("noiseLevel", 0, 0, 1),
          pwmBase: mp("pwmBase", 0.5, 0.05, 0.5),
          pwmLfo: mp("pwmLfo", 0.15, 0, 0.45) } };
      // hammond — B-3 tonewheel organ + Leslie, STEREO. The nine drawbars are
      // THE morph dims; leslie 0 chorale..1 tremolo (rotor inertia in the module).
      case "hammond": return { ...base, module: "hammond", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params,
          bar16: mp("bar16", 8, 0, 8), bar513: mp("bar513", 3, 0, 8),
          bar8: mp("bar8", 8, 0, 8), bar4: mp("bar4", 6, 0, 8),
          bar223: mp("bar223", 0, 0, 8), bar2: mp("bar2", 0, 0, 8),
          bar135: mp("bar135", 0, 0, 8), bar113: mp("bar113", 0, 0, 8),
          bar1: mp("bar1", 0, 0, 8),
          leslie: mp("leslie", 0.85, 0, 1),
          perc: mp("perc", 0.5, 0, 1),
          percHarm: mp("percHarm", 0, 0, 1),
          percDecay: mp("percDecay", 0.35, 0.05, 2),
          click: mp("click", 0.25, 0, 1),
          leak: mp("leak", 0.35, 0, 1),
          drive: mp("drive", 0.15, 0, 1),
          attack: mp("attack", isPad ? 0.02 : 0.006, 0.001, 0.5),
          release: mp("release", 0.02, 0.005, 1) } };
      // vp330 — Roland VP-330 ghost-choir, STEREO. vowel + ensemble morph; a dark
      // instrument (cutoff mapped straight; it self-limits).
      case "vp330":   return { ...base, module: "vp330", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 300, 12000),
          vowel: mp("vowel", 0.3, 0, 1),
          breath: mp("breath", 0.15, 0, 1),
          ensemble: mp("ensemble", 0.6, 0, 1),
          detune: mp("vpDetune", 0.4, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.08), 0.005, 3),
          sustain: mp("sustain", 0.9, 0, 1),
          release: mp("release", 0.6, 0.02, 5) } };
      // solina — ARP/Eminent String Ensemble, MONO out. ensemble is the identity
      // dim; NO res param; cutoff->tone (<=12000). Ensemble chorus is built in —
      // NEVER stack an insert_chorus, so inserts are dropped for this voice.
      case "solina":  return { ...base, module: "solina", pool: isPad ? 6 : 4, inserts: [],
        params: { ...base.params, tone: clamp(Math.min(12000, c), 300, 12000),
          octave: mp("octave", 0.55, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.012), 0.002, 1.5),
          release: mp("release", 0.22, 0.02, 3),
          chorusRate: mp("chorusRate", 0.62, 0.05, 4),
          chorusDepth: mp("chorusDepth", 0.9, 0, 1),
          ensemble: mp("ensemble", 0.85, 0, 1) } };
      // synclead — hard-sync tearing lead, MONO-LEGATO (modeld's contract; melody/
      // solo only, never a pad). syncRatio + env-driven syncSweep are the signature
      // dims; filter env in OCTAVES like modeld. syncDetune = the 2nd pair, CENTS.
      case "synclead": return { ...base, module: "synclead", mono: true, legatoSec: 0.03, pool: 1,
        tail: Math.max(base.tail, (m.release != null ? m.release : 0.2) + 0.4), freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          syncRatio: mp("syncRatio", 1.5, 1, 4),
          syncSweep: mp("syncSweep", 1.5, 0, 4),
          syncDecay: mp("syncDecay", 0.18, 0.01, 1.5),
          detune: mp("syncDetune", 8, 0, 40),
          envAmount: mp("envAmount", 1.8, 0, 5),
          envDecay: mp("envDecay", 0.16, 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: mp("drive", 0.3, 0, 1),
          attack: mp("attack", 0.004, 0.001, 2),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.2, 0.01, 3) } };
      // casiocz — Casio CZ phase-distortion keys/lead, MONO out, per-note gate
      // (NOT legato). wave = the CZ index family morph; dcw* = the DCW contour
      // (identity). czWave/czDetune are dedicated keys (recipe `wave` is a string).
      case "casiocz": return { ...base, module: "casiocz", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 200, 16000),
          wave: mp("czWave", 0.5, 0, 1),
          index: mp("index", 0.25, 0, 1),
          dcwAmount: mp("dcwAmount", 0.6, 0, 1),
          dcwAttack: mp("dcwAttack", 0.005, 0.001, 2),
          dcwDecay: mp("dcwDecay", 0.35, 0.005, 3),
          dcwSustain: mp("dcwSustain", 0.35, 0, 1),
          detune: mp("czDetune", 4, 0, 40),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.005), 0.001, 3),
          decay: mp("decay", 0.12, 0.005, 3),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.3, 0.005, 4) } };
      // oberheim — Prophet-5/SEM poly pad, MONO out. Hand-rolled TPT SVF;
      // filterMode 0 LP .5 BP 1 HP; poly-mod (pmFM/pmFilt/osc2lfo) 0 = clean pad.
      case "oberheim": return { ...base, module: "oberheim", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 40, 16000), res: mp("res", 0.15, 0, 1),
          filterMode: mp("filterMode", 0, 0, 1),
          envAmount: mp("envAmount", 1.3, 0, 5),
          envAttack: mp("envAttack", 0.9, 0.001, 5),
          envDecay: mp("envDecay", 1.4, 0.01, 5),
          envSustain: mp("envSustain", 0.75, 0, 1),
          detune: mp("obDetune", 9, 0, 50),
          osc2tune: mp("osc2tune", 0, -36, 24),
          osc2lfo: mp("osc2lfo", 0, 0, 1),
          lfoRate: mp("lfoRate", 4, 0.02, 14),
          pmFM: mp("pmFM", 0, 0, 1),
          pmFilt: mp("pmFilt", 0, 0, 1),
          drive: mp("drive", 0.12, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.8), 0.002, 5),
          sustain: mp("sustain", 0.8, 0, 1),
          release: mp("release", 2.4, 0.01, 6) } };
      // ppg — PPG-Wave wavetable-scan poly pad+lead, MONO out. scan is the star
      // dim (a genre-space "wavetable spectral position"); scanEnv is SIGNED.
      case "ppg":     return { ...base, module: "ppg", pool: isPad ? 4 : 3,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          scan: mp("scan", 0.35, 0, 1),
          scanEnv: mp("scanEnv", 0.3, -1, 1),
          scanLfo: mp("scanLfo", 0, 0, 0.5),
          scanRate: mp("scanRate", 0.3, 0.01, 12),
          envAmount: mp("envAmount", 0.5, 0, 4),
          drive: mp("drive", 0.12, 0, 1),
          sub: mp("sub", 0.15, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.01), 0.001, 2),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.4, 0.01, 3) } };
      // hoover — the Alpha-Juno "WhatThe" rave stab (SIGNATURE model: never
      // sampled, see SIGNATURE_MODELS). Rendered on the supersaw voice with
      // hoover-shaped DEFAULTS: a big detuned saw stack, the octave layer well
      // up (the growl), and a standing pitch swirl (the hoover's chorus wobble).
      // Recipe keys override every default (voices/spread/octave/vibrato ride
      // through like any supersaw), so anchors tune the stab without a new dsp.
      case "hoover": {
        const hv = clamp(m.voices || 5, 1, 7);
        return { ...base, module: "supersaw", freqMax: 8000, params: { ...base.params,
          wave: Math.max(0, WAVES.indexOf(m.wave || "saw")), voices: hv,
          detune: clamp(m.spread != null ? m.spread : 0.012, 0, 0.05),
          octave: clamp(m.octave != null ? m.octave : 0.34, 0, 0.4),
          vibrato: clamp(m.vibrato != null ? m.vibrato : 0.012, 0, 0.03),
          vibRate: clamp(m.vibRate || 5.5, 0.1, 12),
          cutoff: clamp(c, 80, 18000), res,
          attack: clamp(m.attack != null ? m.attack : 0.008, 0.001, 2),
          release: rel, sustain: sus, fenv: fev } };
      }
      default: { // "stack"/"saw" -> pad_saw (pads) or supersaw (leads)
        if (isPad) return { ...base, module: "pad_saw", params: { ...base.params, cutoff: clamp(c, 80, 12000), res, detune: clamp(m.detune != null ? m.detune : 0.006, 0, 0.05), attack: atk } };
        const v = clamp(m.voices || 2, 1, 7);
        return { ...base, module: "supersaw", freqMax: 8000, params: { ...base.params,
          wave: Math.max(0, WAVES.indexOf(m.wave || "sine")), voices: v,
          detune: clamp(m.spread != null ? m.spread : 0.004, 0, 0.05),
          octave: clamp(m.octave != null ? m.octave : (v <= 2 ? 0.16 : 0.12), 0, 0.4),
          vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
          cutoff: clamp(c, 80, 18000), res,
          attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 2),
          release: rel, sustain: sus, fenv: fev } };
      }
    }
  }

  // ---- CPU COST MODEL (2026-07-04, FEEL+CPU-BUDGET round) ----------------------
  // Per-module render cost, MEASURED on this machine via an 8s offline-render
  // timing probe (faust/bench.js is the live cousin; the probe instantiated one
  // OfflineProcessor per module, gated a note / fed noise, timed min-of-3 passes),
  // normalized to pad_saw = 1.0. APPROXIMATIONS — the ORDER matters more than the
  // digits (a faster machine scales them all together). DX7 is the standout: the
  // 6-operator FM voice costs ~6.4x pad_saw, so a genre that stacks a dx7 melody
  // + dx7 solo licks (dinosynth) is by far the heaviest citizen in the space.
  // sfx (the riser/sweep synth) and fx_bus (always-on master) are the other big
  // ones. These doubles double as future-optimization targets (see the burn
  // table in the round's report).
  const COST = {
    // fleet pads
    pad_saw: 1, juno60: 1.76, vp330: 1.96, solina: 1.18, oberheim: 0.72, ppg: 1.32,
    organ: 0.4, strings: 0.64, choir: 0.29,
    // fleet leads
    supersaw: 2.47, fm2op: 0.53, lead_pluck: 1.3, lead_kpluck: 0.56, lead_fuzz: 1.43,
    lead_guitar: 0.55, synclead: 1.68, casiocz: 1.82, bell: 1.24, piano: 0.45,
    brass: 1.16, hammond: 0.89, robot_choir: 2.07,
    // bass
    bass_saw: 0.84, bass_sub: 0.47, bass_acid: 0.94, bass_reese: 0.5, bass_wobble: 1.15,
    // mono synths
    modeld: 1.48, tb303: 1.5,
    // drums / one-shots
    kick_boom: 0.28, kick_808: 0.3, kick909: 0.29, snare_noise: 0.09, snare_crack: 0.09,
    snare_clap: 0.07, hat_noise: 0.18, hat_metal: 0.41, tom: 0.45, stab: 0.15, sfx: 2.43,
    // inserts
    insert_distort: 1.01, insert_phaser: 0.62, insert_chorus: 0.18, insert_wah: 0.69,
    insert_tremolo: 0.51, insert_filtersweep: 1.47,
    // inserts (2026-07 expanded FX round — measured vs pad_saw, min-of-3 8s render)
    insert_leslie: 0.35, insert_flanger: 0.28, insert_delay: 0.42, insert_ringmod: 0.2, insert_granular: 0.5,
    // SYNTHESIS-DEPTH inserts (measured min-of-3 8s vs insert_distort=1.01):
    // higain is the heaviest insert (3 always-computed shaper taps + 6 EQ
    // biquads) — heavy genres budget it like a voice, not a seasoning
    insert_higain: 2.7, insert_fenv: 1.4,
    // reverb colors + master
    reverb_dattorro: 0.49, reverb_greyhole: 2.37, reverb_fdn: 0.75, reverb_spring: 0.61, reverb_shimmer: 0.75,
    fx_bus: 2.32, master_mb: 1.55, rev_bleed: 0.18,
  };
  const DX7_COST = 6.4;      // any dx7_algN — the 6-op FM voice (measured 6.2-6.7)
  const SAMPLER_COST = 0.3;  // native PCM zone playback (no worklet) — cheap per voice
  // live's effective pool table (mirrors live.js POOL_SIZE + the heavy/dx7/mono caps):
  // Faust worklets render EVERY block whether or not a note is gated, so the whole
  // pool is always-on cost. cost = effectivePool * moduleCost.
  const POOL_SIZE = { pad: 4, bass: 2, melody: 3, solo: 2 };
  const HEAVY_FLEET = ["juno60", "hammond", "vp330", "solina", "ppg"];
  function effectivePool(u) {
    if (u.drum || u.hold) return (u.pool > 1 ? 2 : 1);
    let n = POOL_SIZE[u.role] || u.pool || 2;
    if (u.dx7) n = Math.min(n, 2);
    if (HEAVY_FLEET.includes(u.module)) n = Math.min(n, 3);
    if (u.mono) n = 1;
    if (u.poolCap != null) n = Math.min(n, u.poolCap);   // trim-to-budget shed
    return n;
  }
  const moduleCost = (u) => u.sampler ? SAMPLER_COST : u.dx7 ? DX7_COST : (COST[u.module] != null ? COST[u.module] : 0.6);
  function unitCost(u) {
    let c = effectivePool(u) * moduleCost(u);
    for (const ins of (u.inserts || [])) c += (COST[ins.module] || 0.5);
    return c;
  }
  // total cost of a resolved state: the always-on fx_bus + every voice unit's
  // (pool x module) + inserts + the opt-in reverb color (one node + its bleed
  // twin) + the opt-in multiband master glue.
  function stateCost(units, state) {
    let total = COST.fx_bus;
    for (const u of Object.values(units)) if (u && !u.__meta) total += unitCost(u);
    const rc = reverbColor(state);
    if (rc) total += (COST[rc.module] || 0.6) + COST.rev_bleed;
    if (masterMb(state)) total += COST.master_mb;
    return total;
  }

  // ---- DETERMINISTIC TRIM-TO-BUDGET (2026-07-04) --------------------------------
  // A zero-rng guard, applied at unit-build time (so press + live shed identically).
  // BUDGET is a mobile-safety ceiling in cost units: the heaviest NORMAL genre
  // (house ~38, then newjack ~37, transitwave ~32 — the historical heaviest) sits
  // JUST under it, so MOST STATES TRIM NOTHING (measured: 0 of 63 genres trim on
  // any seed). It only bites when stacked blends + density/energy macros pile
  // SHEDDABLE extras on top (a dense blend+macros can reach ~41-54). dinosynth
  // (~64-70 when its melody+solos all roll dx7) is the lone genre over budget on
  // its own — but its weight IS its identity (dx7 protected below), so it sheds the
  // safe extras (a pad voice, a non-identity lick) and logs the irreducible rest.
  //
  // Shed order (each step re-checks cost; stops the instant we're under budget):
  //   1. 2nd+ inserts on any voice     (the 1st insert is kept — identity seasoning)
  //   2. pad pool -1, toward a floor of 2
  //   3. extra NON-IDENTITY solo/lick voices (the transition micro-licks & counters
  //      beyond the first) — never a dx7 / tb303 / tremolo-carrying solo
  // NEVER shed: reverbColor, masterComp, dx7 voices, tb303, IDENTITY inserts
  // (tremolo/leslie/granular — a voice defined by its rotary/stutter), the
  // primary pad/bass/melody voice itself, or any voice's FIRST insert.
  const BUDGET = 40;
  const isIdentitySolo = (u) => u.dx7 || u.module === "tb303" || (u.inserts || []).some((i) => IDENTITY_INSERTS.has(i.type));
  function trimToBudget(units, state) {
    const shed = [];
    let cost = stateCost(units, state);
    const budget = BUDGET;
    const under = () => stateCost(units, state) <= budget;
    if (cost > budget) {
      // 1. drop 2nd+ inserts, in a stable key order, heaviest state first only by
      //    fixed traversal (zero-rng): pad, bass, melody, then solos sorted by key.
      const keysInOrder = ["pad", "bass", "melody", ...Object.keys(units).filter((k) => k.startsWith("solo:")).sort()];
      for (const k of keysInOrder) {
        if (under()) break;
        const u = units[k];
        if (u && Array.isArray(u.inserts) && u.inserts.length > 1) {
          // keep the FIRST insert + any IDENTITY insert (tremolo/leslie/granular);
          // shed only the non-identity extras beyond the first.
          const keep = u.inserts.filter((ins, i) => i === 0 || IDENTITY_INSERTS.has(ins.type));
          const drop = u.inserts.filter((ins, i) => i !== 0 && !IDENTITY_INSERTS.has(ins.type));
          if (drop.length) {
            shed.push(k + ":inserts[" + drop.map((i) => i.type).join(",") + "]");
            u.inserts = keep;
          }
        }
      }
      // 2. pad pool -1 toward floor 2
      while (!under() && units.pad) {
        const cur = effectivePool(units.pad);
        if (cur <= 2) break;
        units.pad.poolCap = cur - 1;
        shed.push("pad:pool" + cur + "->" + (cur - 1));
      }
      // 3. drop extra non-identity solo voices (keep the first; keep any identity solo)
      const solos = Object.keys(units).filter((k) => k.startsWith("solo:")).sort();
      const droppable = solos.filter((k) => !isIdentitySolo(units[k]));
      // keep at least one solo overall — drop from the end of the droppable list
      for (let i = droppable.length - 1; i >= 0 && !under(); i--) {
        if (solos.length - shed.filter((s) => s.startsWith("solo-drop")).length <= 1) break;
        shed.push("solo-drop:" + droppable[i].slice(0, 24));
        delete units[droppable[i]];
      }
    }
    cost = stateCost(units, state);
    // debug field: press.js logs it; live could too. __meta so stateCost skips it.
    units.__budget = { __meta: true, budget, cost: +cost.toFixed(2),
      over: +(cost - budget).toFixed(2) > 0, shed,
      note: (cost > budget && shed.length) ? "over budget after safe sheds (identity floor)"
        : (cost > budget) ? "over budget; all excess is identity (nothing safe to shed)" : "within budget" };
    return units;
  }

  // ==== SAMPLED MODE (state.sampledOnly — DEFAULT ON since 2026-07) ============
  // "I want anything to go here and be sampled by default. It's much better."
  // (Paul, 2026-07). genre-kernel toState now applies applySampledOnly to EVERY
  // emitted state unless the caller opts out (opts.synth / opts.sampledOnly:false
  // -> pure-synth path, byte-for-byte the old default). When state.sampledOnly is
  // set (and state.samplerLib is present — applySampledOnly injects it + rides
  // every zone wav into foundSources), the PITCHED voices (pad/bass/melody/solo)
  // are remapped onto one of the 40 SF2-derived sampled instruments,
  // deterministically from (role, requested synth model family, state.seed). The
  // original unit's register/level/sends/cutoff/envelope are PRESERVED (spread
  // through) — only the SOUND SOURCE swaps to real samples, so the mix balance
  // the genres were tuned for survives. Drums are forced onto the sampled kits by
  // genre-kernel (D.*Sampler overlays -> the existing drumSamp path below).
  //
  // ONLY the pitched instrument SOURCE changes. Sampled mode is now the normal
  // FULL MIX — Paul: "I want the round[=found] layer and speech back":
  //   • found beds / chops            -> PLAY as usual (the genre's foundSource)
  //   • speech / vocoder layer         -> PLAYS (vocoder is signature-exempt below,
  //     so it stays a real vocoder and its live speech carrier is heard)
  //   • synth sfx (risers/sweeps) + synth stab -> PLAY as usual
  //
  // SIGNATURE SYNTHS — models whose SYNTHESIS *is* the genre's identity: sampling
  // them would be absurd (a moving filter / detune-beat / LFO wobble / hard-sync
  // sweep / live speech carrier no static multisample can reproduce). forceSampled
  // leaves these as pure synth even though sampled is the default. Keyed by the
  // RECIPE model string (state.instruments.<role>.model). TIGHT by design — Paul
  // wants sampling pervasive; prune/extend this ONE set to taste.
  const SIGNATURE_MODELS = new Set([
    "tb303",    // Roland TB-303 acid line — the whole point of acid house / psytrance acid
    "acid",     // bass_acid: resonant filter-swept squelch bass (acid house / EBM / gabber)
    "reese",    // bass_reese: detuned-osc beating bass (jungle / dnb / dubstep) — the beat IS the timbre
    "wobble",   // bass_wobble: LFO-swept dubstep bass — a sample literally cannot wobble
    "synclead", // hard-sync tearing lead: the envelope-driven sync sweep is the sound
    "modeld",   // Minimoog Model-D mono-legato hero: portamento/legato is performance, not a pitch
    "vocoder",  // robot_choir vocoder — needs the LIVE speech carrier (keeps "speech back")
    "hammond",  // B-3 tonewheel + SPINNING LESLIE (2026-07 audio-quality pass; Paul on
                // blues: "I don't hear ensemble or phaser on the organ. It's reedy and
                // distant."). Anchors that ask for hammond configure real drawbar
                // registrations + leslie speed + 3rd-harm percussion (blues comps
                // 888868468 with leslie .85-.95) — synthesis params no static GM zone
                // honors; the sampled remap was landing them on reed_organ / church_organ
                // / slow_strings / space_voice and the rotary motion vanished. Rotary
                // doppler IS the identity — same law as the moving filter / detune beat
                // above. (The generic "organ" model stays sampled; anchors that want the
                // GM organs say model "sampler" + samplerPool, like blues' own pad pool.)
    "hoover",   // the Alpha-Juno rave stab (gabber/happyhardcore/hardcore lineage) —
                // an octave-layered detuned-saw swirl whose PWM-beat motion is the
                // sound; the sampled remap was landing it on a wind/sampler fallback
                // and the card's "hoover stabs" never sounded (card-truth wave
                // 2026-07-10, NEXT.md §5 — the tb303/hammond law).
  ]);
  // Candidate pools per role/timbre-family, drawn from the FULL General MIDI set
  // (all 128 bank-0 FluidR3 presets extracted 2026-07, "all of GM please" — see
  // faust/extract-gm.js). Only multi-zone (playable) presets are listed; the 24
  // single-zone GM presets (SFX, one-note synth pads) are excluded — they pitch
  // badly across a keymap. pickFrom hashes (role, model, seed) into these, so a
  // wider pool = more instrument variety across the genre space (deterministic per
  // seed). Kept musically sane per family (no bagpipe/shenai in the default lead).
  const SAMPLED_BASSES = ["acoustic_bass", "fretless_bass", "finger_bass", "picked_bass", "pop_bass", "slap_bass", "contrabass"];
  const SAMPLED_PADS   = ["strings", "slow_strings", "ahh_choir", "ohh_voices", "church_organ", "french_horns", "cello", "bowed_glass", "synth_strings_1", "space_voice"];
  const SAMPLED_LEAD = {
    keys:   ["felt_piano", "yamaha_grand_piano", "bright_yamaha_grand", "honky_tonk", "rhodes_ep", "legend_ep_2", "electric_piano", "harpsichord", "clavinet"],
    mallet: ["vibraphone", "glockenspiel", "marimba", "celesta", "xylophone", "music_box", "kalimba", "dulcimer", "tinker_bell"],
    guitar: ["nylon_string_guitar", "steel_string_guitar", "jazz_guitar", "clean_guitar", "palm_muted_guitar", "overdrive_guitar", "guitar_harmonics"],
    brass:  ["trumpet", "muted_trumpet", "trombone", "tuba", "french_horns", "brass_section"],
    organ:  ["rock_organ", "percussive_organ", "church_organ", "reed_organ"],
    voice:  ["ahh_choir", "ohh_voices", "strings", "solo_vox", "synth_voice"],
    wind:   ["alto_sax", "tenor_sax", "soprano_sax", "baritone_sax", "flute", "clarinet", "oboe", "english_horn", "bassoon", "piccolo", "recorder", "pan_flute", "harmonica", "ocarina"],   // reeds/pipes: the vaporwave default lead
  };
  // requested synth model -> lead timbre family (anything unmapped -> reedy wind)
  const LEAD_FAMILY = { piano: "keys", rhodes: "keys", bell: "mallet", guitar: "guitar",
    pluck: "guitar", kpluck: "guitar", brass: "brass", organ: "organ", hammond: "organ",
    choir: "voice", vocoder: "voice", vp330: "voice", solina: "voice", strings: "voice" };
  const famHash = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pickFrom = (list, seed, role, model) => list[famHash(role + "|" + model + "|" + (seed >>> 0)) % list.length];
  // (role, model, seed) -> a sampled-instrument id. Pure + deterministic.
  function pickSampledId(role, model, seed) {
    if (role === "bass") return pickFrom(SAMPLED_BASSES, seed, role, model || "");
    if (role === "pad")  return pickFrom(SAMPLED_PADS, seed, role, model || "");
    const fam = LEAD_FAMILY[model] || "wind";
    return pickFrom(SAMPLED_LEAD[fam], seed, role, model || "");
  }
  // rewrite a pitched recipe into a sampler recipe (model "sampler" + zone spec)
  // so pitchedUnit's `case "sampler"` builds a native sampler unit. Register/
  // level/sends/cutoff/attack/release ride through the ...m spread. A recipe that
  // ALREADY resolved to a real sampled instrument (genre chose model "sampler")
  // is kept as-is (respect the genre's own acoustic choice). No library on the
  // state -> return unchanged (graceful fallback; genre-kernel always injects it).
  function forceSampled(role, m, state) {
    m = m || {};
    // signature synth: the synthesis IS the genre identity — never sample it
    if (m.model && SIGNATURE_MODELS.has(m.model)) return m;
    if (m.model === "sampler" && m.sampler && Array.isArray(m.sampler.zones) && m.sampler.zones.length) return m;
    const lib = state.samplerLib || {};
    // INSTRUMENT IDENTITY IS PER-SONG, NOT PER-BAR: the live walk reseeds each bar
    // (seed + serial*7919) for PATTERN variety, but feeding that churned seed into
    // the instrument pick made every voice swap instruments EVERY BAR (device audit
    // 2026-07-09: pad = french_horns→synth_strings→ohh_voices bar to bar — heard as
    // "two tracks at once", viz/name mismatches, and per-bar decode churn on iOS).
    // The walk stashes the pre-churn seed as instrumentSeed; the pick uses it, so
    // the band stays the band for the whole song. Fallback state.seed = unchanged
    // behavior for whole-song (press) states, which never churn.
    const spec = lib[pickSampledId(role, m.model, state.instrumentSeed != null ? state.instrumentSeed : state.seed)];
    if (!spec) return m;
    return { ...m, model: "sampler", sampler: spec, dx7: null };
  }

  // ---- the full unit table for a state ----
  function voiceUnits(E, state) {
    const I = mergedInstruments(E, state);
    const so = !!(state.sampledOnly && state.samplerLib);   // SAMPLED mode (default): remap pitched sources to samples
    const units = {};
    units.pad = pitchedUnit("pad", so ? forceSampled("pad", I.pad, state) : I.pad, state);
    units.bass = pitchedUnit("bass", so ? forceSampled("bass", I.bass, state) : I.bass, state);
    units.melody = pitchedUnit("melody", so ? forceSampled("melody", I.melody, state) : I.melody, state);
    for (const v of (E.soloVoices ? E.soloVoices(state, I.melody) : []))
      units["solo:" + v.key] = pitchedUnit("solo", so ? forceSampled("solo", v.recipe, state) : v.recipe, state);
    const D = I.drums;
    // DRUM_FX_LIFT — Paul 2026-07-07, on-device mix note: "a little more delay and
    // reverb for ... drums." Uniform scalar on every drum voice's reverb+delay
    // send. All genres derive their drum sends from the single D.send/D.dsend
    // scalars via these fixed per-drum ratios (kick .35, hat .3/.5, tom 1.4 …), so
    // one multiplier preserves the RELATIVE drum wetness across all 32 genres
    // exactly while lifting the absolute level modestly (+18%).
    const DRUM_FX_LIFT = 1.18;
    // drum sends are POST everything in csound (asig includes amp+kit level)
    units.kick = { module: { boom: "kick_boom", "808": "kick_808", "909": "kick909" }[D.kickModel] || "kick_boom",
      pool: 1, dry: 1, rev: (D.send || 0) * 0.35 * DRUM_FX_LIFT, del: 0, lvl: D.kick != null ? D.kick : 1, drum: true,
      params: { tune: clamp(D.tune != null ? D.tune : 1, 0.5, 2) }, tail: 0.6 };
    units.snare = { module: { noise: "snare_noise", crack: "snare_crack", clap: "snare_clap" }[D.snareModel] || "snare_noise",
      pool: 1, dry: 1, rev: (D.send || 0) * DRUM_FX_LIFT, del: (D.dsend || 0) * DRUM_FX_LIFT, lvl: D.snare != null ? D.snare : 1, drum: true, params: {}, tail: 0.4 };
    // csound instr 12 mixes hats at *0.7 — folded into level (ab-render did the same)
    units.hat = { module: { noise: "hat_noise", metal: "hat_metal" }[D.hatModel] || "hat_noise",
      pool: 1, dry: 1, rev: (D.send || 0) * 0.3 * DRUM_FX_LIFT, del: (D.dsend || 0) * 0.5 * DRUM_FX_LIFT, lvl: (D.hat != null ? D.hat : 1) * 0.7, drum: true, params: {}, tail: 0.4 };
    units.tom = { module: "tom", pool: 1, dry: 1, rev: (D.send || 0) * 1.4 * DRUM_FX_LIFT, del: (D.dsend || 0) * DRUM_FX_LIFT,
      lvl: D.tom != null ? D.tom : 1, drum: true, params: {}, tail: 0.6 };
    // SAMPLED KIT (additive): when instruments.drums carries per-drum sampler
    // specs (genre-kernel drumKitSpec, from a genre's drums.kit), overlay a
    // native sampler onto the matching voice UNIT. press/stream see u.sampler
    // FIRST (same branch pitched instrument samplers use) and render the
    // one-shots via SP.mixPCM; the Faust `module` stays as the metadata/fallback
    // (unused while .sampler is set). drum:true keeps it mustLive. atk tiny (keep
    // the transient), rel short declick. A kit that omits a drum leaves that
    // voice on its synth module.
    const drumSamp = (unit, spec) => {
      if (!spec || !Array.isArray(spec.zones) || !spec.zones.length) return;
      unit.sampler = { id: spec.id || "drumkit", sr: spec.sr || 44100, zones: spec.zones,
        atk: 0.0006, rel: 0.03, oneShotSec: spec.oneShotSec || 1, swell: false,
        strip: STRIP_PROFILES.drum };   // transient-preserving (HPF + whisper of drive)
    };
    drumSamp(units.kick, D.kickSampler);
    drumSamp(units.snare, D.snareSampler);
    drumSamp(units.hat, D.hatSampler);
    drumSamp(units.tom, D.tomSampler);
    // PERCUSSION LANE voices (2026-07) — clap/rim/ride/crash + the shared GM perc
    // bank, additive to kick/snare/hat/tom. ONLY built when the genre carries
    // state.perc (genre-kernel PERC_STYLES) so every non-perc genre's unit set,
    // cost and trim-to-budget stay byte-identical to baseline. Sampled from the
    // kit (D.<x>Sampler, real recorded hits) when present; synth fallback modules
    // otherwise (a synth-kit genre still claps — snare_clap — and rides —
    // hat_metal). perc is ONE multi-zone sampler (D.percSampler), zone-selected
    // per hit by GM note.
    if (state.perc) {
      units.clap  = { module: "snare_clap",  pool: 2, dry: 1, rev: (D.send || 0) * DRUM_FX_LIFT,       del: (D.dsend || 0) * DRUM_FX_LIFT, lvl: 1,   drum: true, params: {}, tail: 0.4 };
      units.rim   = { module: "snare_crack", pool: 2, dry: 1, rev: (D.send || 0) * 0.5 * DRUM_FX_LIFT, del: 0,                             lvl: 1,   drum: true, params: {}, tail: 0.3 };
      units.ride  = { module: "hat_metal",   pool: 2, dry: 1, rev: (D.send || 0) * 0.4 * DRUM_FX_LIFT, del: 0,                             lvl: 0.9, drum: true, params: {}, tail: 0.6 };
      units.crash = { module: "hat_metal",   pool: 2, dry: 1, rev: (D.send || 0) * 0.7 * DRUM_FX_LIFT, del: 0,                             lvl: 0.9, drum: true, params: {}, tail: 1.6 };
      units.perc  = { module: "tom",         pool: 4, dry: 1, rev: (D.send || 0) * 0.5 * DRUM_FX_LIFT, del: 0,                             lvl: 1,   drum: true, params: {}, tail: 0.6 };
      drumSamp(units.clap, D.clapSampler);
      drumSamp(units.rim, D.rimSampler);
      drumSamp(units.ride, D.rideSampler);
      drumSamp(units.crash, D.crashSampler);
      drumSamp(units.perc, D.percSampler);
    }
    // synth stab + synth sfx (risers/sweeps): always present. Sampled mode only
    // changes the pitched INSTRUMENT source — sfx/stab play in the full mix too.
    units.stab = { module: "stab", pool: 2, dry: 1, rev: 0.35, del: 0.3, lvl: 1, drum: true, params: { level: 1 }, tail: 0.6, freqMax: 2000 };
    units.sfx = { module: "sfx", pool: 2, dry: 1, rev: 0.3, del: 0, lvl: 1, hold: true, params: { level: 1 }, tail: 1.2 };
    // MASTERING STAGE at the unit choke point (shared by press + stream + live):
    // stereo placement, then the same-timbre collision carve. Before the trim
    // so fxLabels reflect the final strips; both are pure functions of the
    // resolved units (zero rng — determinism-gated like everything here).
    applyMasterPan(units);
    collisionCarve(units);
    drumBalance(units);   // gentle hot-kit level pull so voices sit up (Paul's "drums are hot")
    const out = trimToBudget(units, state);
    // fxLabels (viz roster metadata; computed post-trim so labels reflect the
    // final shed state). Pure metadata — ignored by every render loop.
    for (const [k, u] of Object.entries(out)) { if (!u || u.__meta) continue; u.fxLabels = fxLabelsFor(k, u, state); }
    return out;
  }

  // ---- ZERO-STATIC Stage 3: STEM CLASSING — which units the rolling stem
  // pre-render takes off the audio thread. CACHED = the heavy synthesis the
  // live worklets pay for every block (dx7 family ~12.8/unit, supersaw leads
  // ~7.4, juno60/vp330/hammond/solina/ppg/oberheim pads 2.7-5.9, lead_pluck
  // fleets 3.9 — R7's irreducible steady-state cost) PLUS their insert chains
  // (unitCost already includes them; a cached unit's inserts render in the
  // worker, render-core's whole-chain path). LIVE = everything rhythm-critical
  // or engine-native: bass, drums (kick/snare/hat/tom), stab, sfx, vocoder
  // (its looped speech feed is an AudioBufferSourceNode into the worklet —
  // no offline twin), sampler/native PCM, and MONO-LEGATO voices (a legato
  // group crossing a bar boundary can't withdraw an already-rendered gate-off
  // in the worker — modeld/tb303/synclead stay on the live pool where the
  // gate hold works; they all sit under the threshold anyway).
  //
  // STEM_COST_MIN is the tunable knob: a unit is worth shipping to the worker
  // when its LIVE cost (effectivePool x module COST + inserts — unitCost, the
  // same table the 2.3 awake ceiling enforces) is >= this many pad_saw units.
  // 2.0 ~= "anything heavier than a couple of organs"; raise it to cache less,
  // lower it to cache more. Module-level COST >= 2.0 alone would miss the
  // heavy-fleet pads (juno60 is 1.76/node but 3 nodes render every block),
  // which are exactly the R7 residue Stage 3 exists to remove — hence the
  // pool-weighted unit cost.
  const STEM_COST_MIN = 2.0;
  function stemClass(units) {
    const cached = [], live = [];
    for (const [key, u] of Object.entries(units)) {
      if (!u || u.__meta) continue;
      const mustLive = u.sampler || u.drum || u.hold || u.vocoder || u.mono ||
        u.role === "bass" || key === "bass" || key === "stab" || key === "sfx";
      if (!mustLive && unitCost(u) >= STEM_COST_MIN) cached.push(key);
      else live.push(key);
    }
    return { cached, live };
  }

  // ---- reverb COLOR (fx wings round) — a per-genre-selectable reverb node ----
  // state.reverbColor names an EXTERNAL reverb module (dist/reverb_*) that
  // replaces the fx_bus internal zita for that genre. Absent / "zita" / "default"
  // => the internal zita path (byte-identical to pre-wings renders). The color
  // modules share a uniform interface (rgain = reverb*3.2 like the default; a
  // baked TRIM equalizes their tail energy to the zita reference so a genre's
  // `reverb` scalar means the same wetness across colors). The callers (press +
  // live) build ONE external reverb node, feed it the (mono) reverb-send bus,
  // and mix its stereo wet back into the dry path so it flows through the master
  // chain; fxParams sets the internal rgain to 0 whenever a color is active.
  const REVERB_COLORS = { dattorro: "reverb_dattorro", greyhole: "reverb_greyhole",
    fdn: "reverb_fdn", spring: "reverb_spring", shimmer: "reverb_shimmer" };
  const REVERB_TONE = { dattorro: 5200, greyhole: 2600, fdn: 6000, spring: 3400, shimmer: 6000 };
  function reverbColor(state) {
    const module = REVERB_COLORS[state && state.reverbColor];
    if (!module) return null;   // default => fx_bus internal zita
    const rv = state.reverb != null ? state.reverb : 0.7;
    // MASTERING: the density-aware reverb BUDGET scales the color return the
    // same way fxParams scales the internal zita (scale 1 => byte-identical;
    // post-clamp so saturated returns still trim — see fxParams).
    return { name: state.reverbColor, module, rgain: clamp(rv * 3.2, 0, 3.5) * reverbScale(state), rtone: REVERB_TONE[state.reverbColor] };
  }

  // ---- AUTO-TUNE (fx wings stage 2) — snap found VOICE clips to the song scale ----
  // Returns {strength, pcs} or null. `pcs` = the set of scale pitch-classes (0-11)
  // the state actually harmonizes over: the pitch classes of the progression's
  // chord tones, transposed by keyOffset (the effective key). found-player uses it
  // to bend each voice clip's DETECTED median pitch onto the nearest scale tone,
  // scaled by state.autoTune. Absent/0 => null => no bend (byte-identical). Zero
  // rng, purely derived — mirrors reverbColor's "gain a field, change nothing else".
  // LIMITATION: uses the base key; per-section keyShift (the 3-minute rule) is not
  // tracked, so a shifted section snaps to the home scale (a near-enough aesthetic
  // auto-tune, not a transcription).
  function autoTune(E, state) {
    const strength = clamp(state && state.autoTune != null ? state.autoTune : 0, 0, 1);
    if (!(strength > 0)) return null;
    const prg = E && E.PROGRESSIONS && E.PROGRESSIONS[state.progression];
    const k = (state.keyOffset | 0), seen = new Set(), pcs = [];
    if (prg && prg.chords) for (const ch of prg.chords)
      for (const p of (ch.pads || [])) {
        const pc = ((parseInt(String(p).split(".")[1] || "0", 10) + k) % 12 + 12) % 12;
        if (!seen.has(pc)) { seen.add(pc); pcs.push(pc); }
      }
    if (!pcs.length) return null;
    return { strength, pcs };
  }

  // ---- fx_bus params from state (rgain = reverb*3.2 per A/B calibration; the
  // fx_bus rgain slider caps at 2, so reverb > 0.625 saturates the return) ----
  function fxParams(state) {
    const spb = 60 / state.bpm, dl = state.delay || {};
    const pp = state.pingpong || {};
    const colored = !!REVERB_COLORS[state && state.reverbColor];   // internal zita off when a color is active
    return {
      // MASTERING: reverbScale is the density-aware reverb BUDGET (see the
      // mastering block above) — 1 for most of the catalog (byte-identical),
      // < 1 only for drenched beat-carrying mixes. Applied AFTER the slider
      // clamp: the drenched genres saturate rgain at 2 (reverb > 0.625), so a
      // pre-clamp scale would never reach them — the budget scales the actual
      // RETURN.
      rgain: colored ? 0 : clamp((state.reverb != null ? state.reverb : 0.7) * 3.2, 0, 2) * reverbScale(state), dgain: 1,
      // SHIMMER LEAN — Paul 2026-07-07, on-device: "a little more shimmer reverb
      // would be good." The internal zita tail is lowpassed at rtone; opening it
      // from the legacy-dark 2 kHz to 2.6 kHz lets more HF air through the tail,
      // reading as shimmer. Uniform across every uncolored genre (a constant, so
      // relative identity is untouched) and shared by press + live via fxParams.
      // Colored genres already ride brighter plates (dattorro 5200, fdn 6000) and
      // keep their own tone. TRUE octave-up pitch-shift shimmer is future work
      // (see report: needs new DSP + live.js send wiring, and live.js is off-limits
      // to this workstream). live eco-3 still dulls rtone under load.
      rtone: 2600,

      dtime: clamp((dl.beats || 0.75) * spb, 0.02, 1.9),
      dfb: clamp(dl.feedback != null ? dl.feedback : 0.3, 0, 0.92),
      dcut: clamp(dl.cutoff || 2600, 300, 9000),
      pptime: clamp((pp.beats || 0.75) * spb, 0.05, 2.4),
      ppfb: clamp(pp.feedback || 0.66, 0, 0.85),
      pptone: clamp(pp.cutoff || 3000, 300, 9000),
      pump: clamp(state.pump || 0, 0, 0.9), bps: clamp(state.bpm / 60, 0.2, 8),
      crackle: clamp(state.crackle || 0, 0, 1), grit: clamp(state.grit || 0, 0, 1),
      comp: clamp(state.comp || 0, 0, 1),
      lowcut: clamp((state.tone && state.tone.lowcut) || 10, 10, 400),
      highcut: (state.tone && state.tone.highcut) ? clamp(state.tone.highcut, 1000, 20500) : 20500,
      mcut: 21000, scmix: 0,
    };
  }

  // ---- MULTIBAND MASTER COMP (fx wings stage 4) — an OPT-IN external node ----
  // Returns {module:"master_mb", mbdrive} or null. NOT baked into fx_bus: the
  // mband branch ran even at drive 0 (Faust computes both select paths — three
  // always-on stereo compressors) and cost EVERY genre ~0.01 live load ratio
  // (measured: live gate 0.977/0.973 PASS with committed fx_bus vs 0.969/0.967
  // FAIL with it baked in). As a separate module it exists only when a genre
  // opts in via state.masterComp (disco): press post-passes the fx_bus output
  // through it, live series-inserts it after fx_bus under a crossfade — the
  // reverb-color architecture. Absent/0 => null => committed fx_bus bytes.
  function masterMb(state) {
    const drive = clamp(state && state.masterComp != null ? state.masterComp : 0, 0, 1);
    if (!(drive > 0)) return null;
    return { module: "master_mb", mbdrive: drive };
  }

  // ---- MUSIC-MIND per-note annotation whitelist (pipes expression contract) --
  // CsdPipes' expression pipes write cutoffMul / vib:{depth,rate} / pw onto
  // PITCHED events (pipes.js header). mapEvents translates them into per-note
  // `sets` entries ONLY for modules whose DSP actually exposes the param —
  // this table, keyed by u.module, IS that whitelist, with each param's REAL
  // slider range from dsp/*.dsp (NOT pitchedUnit's looser static clamps: a
  // per-note set beyond the slider range would be pinned by Faust anyway, so
  // we clamp to the honest surface). Anything not listed — samplers (module
  // null, native PCM), dx7_algN (cartridge params only), hammond (drawbars,
  // no filter) — silently drops the annotation, per the MUSIC-MIND contract.
  // rsendMul/dsendMul are NOT translated: rev/del sends are POOL-LEVEL gains
  // in the unit graph (VOICES.md "pool-level dry/rev/del/pp sends"), not
  // per-note params — inventing plumbing is out of scope for this wiring.
  //   cut: [paramName, lo, hi]   vib: true (vibrato 0-0.03 + vibRate 0.1-12)
  //   pw:  [paramName, lo, hi]   (PWM-capable models only)
  //   fenvAmt: [paramName, lo, hi]  per-note filter-env DEPTH (SYNTHESIS-DEPTH:
  //     event field p.fenvAmount, octaves signed — the per-note squelch accent;
  //     bass/lead models where a per-note depth is musical; sticky like every
  //     per-note set, only annotated notes touch it)
  const NOTE_PARAMS = {
    pad_saw:  { cut: ["cutoff", 80, 12000] },
    supersaw: { cut: ["cutoff", 80, 18000], vib: true, fenvAmt: ["fenvAmount", -4, 4] },
    bass_saw: { cut: ["cutoff", 60, 6000], fenvAmt: ["fenvAmount", -4, 4] },
    bass_sub: { cut: ["cutoff", 60, 6000], fenvAmt: ["fenvAmount", -4, 4] },
    bass_acid:{ cut: ["cutoff", 60, 6000], fenvAmt: ["fenvAmount", -4, 4] },
    bass_reese: { cut: ["cutoff", 60, 6000], fenvAmt: ["fenvAmount", -4, 4] },
    bass_wobble: { cut: ["cutoff", 60, 6000], fenvAmt: ["fenvAmount", -4, 4] },
    organ:   { cut: ["cutoff", 80, 12000] }, strings: { cut: ["cutoff", 80, 12000] },
    choir:   { cut: ["cutoff", 200, 12000] }, bell: { cut: ["cutoff", 200, 14000] },
    piano:   { cut: ["cutoff", 200, 14000] }, brass: { cut: ["cutoff", 500, 12000] },
    fm2op:   { cut: ["cutoff", 200, 14000], vib: true, fenvAmt: ["fenvAmount", -4, 4] },
    lead_pluck:  { cut: ["cutoff", 200, 14000], fenvAmt: ["fenvAmount", -4, 4] },
    lead_kpluck: { cut: ["cutoff", 200, 14000] },
    lead_fuzz:   { cut: ["cutoff", 200, 12000], vib: true, fenvAmt: ["fenvAmount", -4, 4] },
    lead_guitar: { cut: ["cutoff", 200, 14000] },
    robot_choir: { cut: ["cutoff", 200, 14000] },
    modeld:  { cut: ["cutoff", 60, 16000], fenvAmt: ["envAmount", 0, 5] },
    tb303:   { cut: ["cutoff", 60, 6000] },   // per-note depth is ACCENT's job (the 303 contract)
    synclead:{ cut: ["cutoff", 60, 16000], fenvAmt: ["envAmount", 0, 5] },
    casiocz: { cut: ["cutoff", 200, 16000], fenvAmt: ["fenvAmount", -4, 4] },
    oberheim:{ cut: ["cutoff", 40, 16000] },
    ppg:     { cut: ["cutoff", 60, 16000], fenvAmt: ["envAmount", 0, 4] },
    juno60:  { cut: ["cutoff", 60, 16000], pw: ["pwmBase", 0.05, 0.5] },
    vp330:   { cut: ["cutoff", 300, 12000] },
    solina:  { cut: ["tone", 300, 12000] },   // solina's brightness param is `tone` (no res, no cutoff)
  };

  // ---- map a buildEvents result into unit events ----
  // opts.lo/hi: beat window (live chord-bar injection); opts.bedAll: include
  // bed events regardless of window (press) — live passes bedWin instead.
  function mapEvents(E, state, ev, opts) {
    opts = opts || {};
    const spb = 60 / state.bpm;
    const lo = opts.lo != null ? opts.lo : -1e9, hi = opts.hi != null ? opts.hi : 1e9;
    const win = (b) => b >= lo && b < hi;
    const units = opts.units || voiceUnits(E, state);
    // Sampled mode changes only the pitched INSTRUMENT source (voiceUnits/
    // forceSampled). Found beds/chops, speech/vocoder and synth sfx/stab all play
    // in the full mix here exactly as on the synth path — no suppression.
    const out = [], found = [], sweeps = [];
    const solos = E.soloVoices ? E.soloVoices(state, (state.instruments || {}).melody) : [];

    for (const p of ev.pitched) {
      if (!win(p.beat)) continue;
      let key = p.voice;
      if (p.voice === "melody" && p.solo) { const v = solos.find((x) => x.key === JSON.stringify(p.solo)); if (v) key = "solo:" + v.key; }
      const u = units[key]; if (!u) continue;
      const durB = Math.max(0.02, p.dur);
      // INSTRUMENT-REGISTER LAW: a pitched sampler note outside the zones'
      // honest window OCTAVE-FOLDS into it (in key, real register) instead of
      // playing the sample at chipmunk/rumble rate. The window is >= 18 st
      // wide, so the folds never fight. Fixed-rate sampled drums never come
      // here (their branch is in the drums loop below).
      let noteHz = clamp(cpspch(p.pch), 20, u.freqMax || 4000);
      if (u.sampler && u.sampler.stretchMaxHz) {
        while (noteHz > u.sampler.stretchMaxHz && noteHz > 40) noteHz /= 2;
        while (noteHz < u.sampler.stretchMinHz && noteHz < 8000) noteHz *= 2;
      }
      const sets = { freq: noteHz };
      if (!u.dx7) sets.gain = clamp(p.amp * u.gmul, 0, 2);
      if (u.decayFromDur) sets.decay = clamp(durB * spb, 0.1, u.module === "bell" ? 6 : 8);
      if (u.fmLead) sets.idxTime = clamp(durB * spb / 2, 0.01, 4);
      if (u.biteFromAmp) sets.bite = clamp(p.amp, 0, 1);
      if (u.flangeFromTime) sets.flangePos = clamp(p.beat * spb / 164, 0, 1);
      // tb303 per-note ACCENT/SLIDE (u.acid): buildEvents tags acid bass steps
      // with ev.accent/ev.slide (0..1); set on the voice BEFORE the note's
      // gate-on. slide>0 also asks the mono-legato scheduler to hold the gate
      // across the group (freq slews in the module). Default 0 = clean.
      if (u.acid) { sets.accent = clamp(p.accent || 0, 0, 1); sets.slide = clamp(p.slide || 0, 0, 1); }
      // MUSIC-MIND annotation fields (CsdPipes expression contract): translate
      // cutoffMul / vib / pw into per-note sets ONLY where the model's DSP
      // exposes the param (NOTE_PARAMS whitelist above); silently dropped
      // otherwise. Events WITHOUT annotations write nothing here — their sets
      // stay byte-identical to today (the absent-knob law, per event). Note:
      // a per-note set is STICKY on its pool voice until re-set — accepted:
      // only annotated notes may touch the param, by contract.
      const np = NOTE_PARAMS[u.module];
      if (np) {
        if (p.cutoffMul != null && np.cut) {
          const cbase = u.params ? u.params[np.cut[0]] : null;   // the voice's RESOLVED static cutoff/tone
          // SHRIEK GUARD (1b): a per-note cutoff sweep may not push a resonant
          // voice past the taste fence (cutMaxForRes) — the static res was
          // eased against the STATIC cutoff, but pipes' cutoffMul can multiply
          // past it (sweepArc hi reaches 2x). Non-resonant voices keep the
          // model's full range (res<=0.35 => hi unchanged, byte-identical).
          const ures = u.params ? (u.params.res != null ? u.params.res : u.params.resonance) : null;
          const hiCap = ures != null ? cutMaxForRes(ures, np.cut[2]) : np.cut[2];
          if (cbase != null) sets[np.cut[0]] = clamp(cbase * p.cutoffMul, np.cut[1], hiCap);
        }
        if (p.vib && np.vib) {   // pipes depth 0..1 -> the module's fractional-pitch slider (0..0.03 full-scale)
          sets.vibrato = clamp((p.vib.depth || 0) * 0.03, 0, 0.03);
          sets.vibRate = clamp(p.vib.rate != null ? p.vib.rate : 5.2, 0.1, 12);
        }
        if (p.pw != null && np.pw) sets[np.pw[0]] = clamp(p.pw, np.pw[1], np.pw[2]);
        // per-note filter-env depth (SYNTHESIS-DEPTH): the squelch accent —
        // events without the annotation write nothing (absent-law, per event)
        if (p.fenvAmount != null && np.fenvAmt) sets[np.fenvAmt[0]] = clamp(p.fenvAmount, np.fenvAmt[1], np.fenvAmt[2]);
      }
      // blue-note bend contract (VOICES.md): only sampler units render it;
      // Faust-module voices carry no matching param and simply ignore it.
      out.push({ unit: key, beat: p.beat, durB, sets, amp: p.amp,
        ...(p.bend ? { bend: p.bend } : {}) });
    }
    // SELF-CHOKE lanes (Paul 2026-07-10: "snares stumbling on top of each other —
    // it's not timing, it's the samples not cutting off fast enough"): a sampled
    // drum one-shot rings its full oneShotSec (~1s), so at fast tempos consecutive
    // hits on the same piece stack 3-4 deep into a smear (bebop's 220bpm ghost
    // snares). Real membranes re-damp when restruck; cymbals ring. So kick/snare/
    // clap/rim choke at the NEXT hit on the same lane (+55ms declick tail); hats
    // already use notated dur; toms keep their roll ring; ride/crash never choke.
    // Deterministic (the event list is known) and engine-shared (mapEvents feeds
    // both press and live); sparse patterns are untouched (gap > sample = no cut).
    const CHOKE_LANES = { kick: 1, snare: 1, clap: 1, rim: 1, stick: 1 };
    const chokeBeats = {};
    for (const d of ev.drums) if (CHOKE_LANES[d.drum]) (chokeBeats[d.drum] = chokeBeats[d.drum] || []).push(d.beat);
    for (const k of Object.keys(chokeBeats)) chokeBeats[k].sort((a, b) => a - b);
    const nextHit = (drum, beat) => {   // first hit strictly after beat (binary search)
      const L = chokeBeats[drum]; if (!L) return Infinity;
      let lo = 0, hi = L.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] <= beat + 1e-6) lo = m + 1; else hi = m; }
      return lo < L.length ? L[lo] : Infinity;
    };
    for (const d of ev.drums) {
      if (!win(d.beat)) continue;
      const u = units[d.drum]; if (!u) continue;
      // SAMPLED DRUM: the voice unit carries a native sampler (a genre's drums.kit).
      // Emit the hit as a one-shot for the shared sampler path (press/stream read
      // sets.freq/gain exactly like a pitched sampler note): fixed pitch for
      // kick/snare (rate 1), closed/open zone select for hats, real repitch for
      // toms (d.pitch Hz). Hold: kick/snare/tom play their FULL sample (body +
      // natural decay, release-declicked at the end); hats use the notated dur so
      // closed stays tight and open rings only as long as the pattern asks. amp ->
      // sample gain (velocity), calibrated by DRUM_SAMP_GAIN. Ping-pong (d.pp) is
      // not sent on sampled drums (the sampler mix has no pp bus).
      if (u.sampler) {
        let freq, durSec;
        if (d.drum === "tom") { freq = clamp(d.pitch || 105, 40, 400); }
        else if (d.drum === "hat") { freq = d.open ? DRUM_HAT_OPEN_FREQ : DRUM_KS_FREQ; }
        else if (d.drum === "perc") { freq = midiToFreq(d.note || 60); }   // GM-note zone select (natural pitch)
        else { freq = DRUM_KS_FREQ; }   // kick/snare/clap/rim/ride/crash: root-60 zone, rate 1
        if (d.drum === "hat") durSec = Math.max(0.02, d.dur * spb);
        else {
          durSec = Math.max(0.04, (u.sampler.oneShotSec || 1) - (u.sampler.rel || 0.03));
          if (CHOKE_LANES[d.drum]) {   // self-choke: cut at the next same-lane hit
            const gapSec = (nextHit(d.drum, d.beat) - d.beat) * spb + 0.055;
            if (gapSec < durSec) durSec = Math.max(0.06, gapSec);
          }
        }
        out.push({ unit: d.drum, beat: d.beat, durB: durSec / spb, drum: true,
          sets: { freq, gain: clamp(d.amp * DRUM_SAMP_GAIN, 0, 2) } });
        continue;
      }
      const sets = { level: clamp(u.lvl * d.amp, 0, 2), decay: clamp(d.dur * spb, 0.05, 2) };
      if (d.drum === "tom") sets.pitch = clamp(d.pitch || 105, 40, 400);
      // synth-fallback perc: repitch the membrane/metal to the GM note (a tuned
      // thud/bell) — the sampled bank is the real voice; this keeps pure-synth
      // mode (opts.synth) from dropping the lane silently.
      else if (d.drum === "perc") sets.pitch = clamp(midiToFreq(d.note || 60), 40, 500);
      // state.snarePP: buildEvents tags sparse snare hits with d.pp — a per-EVENT
      // ping-pong send (csound instr 11 p5 -> gaPPL += asig*ipp)
      out.push({ unit: d.drum, beat: d.beat, durB: d.dur, sets, drum: true, pp: clamp(d.pp || 0, 0, 2) });
    }
    for (const s of ev.sfx) {
      if (s.sweep) { if (win(s.beat)) sweeps.push({ beat: s.beat, durB: s.dur, from: s.from, to: s.to }); continue; }
      if (!win(s.beat)) continue;
      if (s.stab) out.push({ unit: "stab", beat: s.beat, durB: s.dur, drum: true,
        sets: { freq: clamp(cpspch(s.pch), 40, 2000), decay: clamp(s.dur * spb, 0.05, 2), gain: clamp(s.amp, 0, 2) } });
      else out.push({ unit: "sfx", beat: s.beat, durB: s.dur, hold: true,
        sets: { type: s.type, dur: clamp(s.dur * spb, 0.1, 16), amp: clamp(s.amp, 0, 1) } });
    }
    const srcOf = {}; for (const s of Object.values(ev.srcById || {})) srcOf[s.tableNum] = s;
    // AUTO-TUNE spec (fx wings stage 2): attach the same {strength,pcs} to
    // found events so found-player bends each clip's detected median pitch onto
    // the scale. Absent when state has no autoTune => events carry no field =>
    // byte-identical render (untouched genres, spokenword's explicit 0).
    // NEVER on tempo-synced sources (src.bpm set — breaks): their chop `pitch`
    // IS the beat-sync ratio, and a scale bend of up to several semitones would
    // wreck the tempo (a hogcore×jungle blend chops real breaks). Non-vocal
    // field recordings pass through detectMedianHz's voiced-frame gate (no
    // stable F0 -> 0 -> no bend), so no further source filtering is needed.
    const at = autoTune(E, state);
    for (const f of ev.found) {
      const src = srcOf[f.tableNum]; if (!src) continue;
      const tuned = at && !src.bpm ? { autoTune: at } : {};
      // SPEECH INTELLIGIBILITY (2026-07, Paul: "you're pitching the synth voice
      // too high to be intelligible wherever you use it"). espeak's robotic voice
      // sits high, and several placements play it at rate >= 1 (name-stab hits,
      // up-pitched hogcore) — the words blur. CAP the playback rate of any
      // kind:"speech" source to SPEECH_RATE_CAP so it always reads in a natural
      // spoken register. ONE shared point => every use (budstep strain names,
      // hogcore cast, transitwave PA, station names) drops together. Non-speech
      // found sources are untouched (byte-identical). ~-3.4 st from rate 1.
      const fp = (src.kind === "speech" && f.pitch != null) ? Math.min(f.pitch, SPEECH_RATE_CAP) : f.pitch;
      if (f.chop) {
        if (!win(f.beat)) continue;
        found.push({ type: "chop", srcId: src.id, beat: f.beat, durB: Math.max(0.02, f.dur), amp: f.amp,
          pitch: fp, offset: f.offset || 0, cutoff: f.cutoff || 3500,
          rsend: f.rsend != null ? f.rsend : 0.3, dsend: f.dsend != null ? f.dsend : 0.2,
          ppsend: f.ppsend || 0, fade: f.fade || 0, sqRate: f.sqRate || 0, sqDepth: f.sqDepth || 0,
          scratch: f.scratch || 0,   // OPT-IN turntablist scratch (found-player triangle fwd↔back read); 0 => identical
          ...tuned });
      } else {
        if (!(opts.bedAll || win(f.beat))) continue;
        found.push({ type: "bed", srcId: src.id, beat: f.beat, durB: f.dur, amp: f.amp,
          pitch: fp, stretch: f.stretch != null ? f.stretch : 0.45, cutoff: f.cutoff || 2600,
          ...tuned });
      }
    }
    return { events: out, found, sweeps, units, spb, totalBeats: ev.totalBeats };
  }

  // press path: whole song at once
  function buildSchedule(E, state) {
    const ev = E.buildEvents(state);
    return mapEvents(E, state, ev, { bedAll: true });
  }

  return { WAVES, clamp, cpspch, mergedInstruments, insertChain, pitchedUnit, voiceUnits, fxParams, fxLabels, reverbColor, REVERB_COLORS, autoTune, masterMb, mapEvents, buildSchedule, COST, unitCost, stateCost, effectivePool, BUDGET, trimToBudget, stemClass, STEM_COST_MIN, pickSampledId, STRIP_PROFILES,
    // MASTERING STAGE surface (renderers + test/mastering.test.js)
    panGains, notePan, reverbScale, collisionCarve, MASTER_PAN };
});

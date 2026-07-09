// genre-verifier.js — does this state actually sound like the genre it claims?
// The verifier half of the genre kernel's loop (catalog 12.33 genre-conformance).
//
// Features are extracted SYMBOLICALLY from buildEvents(state) — rhythm
// syncopation, snare/kick balance, hat density, harmonic motion, seventh-chord
// color, reverb wash, sub presence, break/chop usage, production scalars,
// per-chord variation — then scored against per-genre target ranges.
//
//   analyze(state)            -> {features, scores:{genre:0-100}, best}
//   report(state)             -> printable report
//   node genre-verifier.js matrix          confusion matrix over all anchors
//     [--serial] [--jobs N] [--no-cache]   sharded across cores by default;
//                                          cached in scratch/.verify-cache/
//   node genre-verifier.js <state.json>    score one state

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;

  // interlock (afrobeat's point — "Fela's arithmetic"): the ONE thing the
  // symbolic space couldn't see (KERNEL-V4 §1: "the verifier can't yet see
  // interlock — a v4 feature gap, not an anchor gap"). Rhythmic interlock =
  // multiple percussion lanes phase-locked in COMPLEMENTARY euclid patterns:
  // afrobeat renders E(3,16) tresillo kicks arguing with E(11,16) shekere hats
  // (two clocks rotating together). Computed per 8-beat window (16 sixteenths):
  //   kOff        = fraction of KICK onsets OFF the four-on-floor quarters
  //                 {0,4,8,12} — a euclid/tresillo kick vs a straight-four one;
  //   singleCov16 = fraction of the 16 grid slots covered by EXACTLY ONE active
  //                 lane (>=2 onsets) — the complementary tiling ("interlock"),
  //                 low when lanes collide (four-floor: kick lands ON hat slots).
  // interlock = mean over windows of kOff*singleCov16 (windows need >=2 active
  // lanes AND a kick, else 0). MEASURED across the catalog: afrobeat renders
  // .37-.41 (stable at natural AND targetSec:180 length — it is a per-window
  // MEAN, not window-count-sensitive like `variation`); every four-on-floor
  // genre scores near zero (disco .09, krautrock .07, house .01, techno .05,
  // gabber .04, edm/trance/minimal/deephouse/acidhouse all <.03) because their
  // kick sits on the quarters. The chopped-break/mutating genres (jungle .36,
  // breakcore .33, idm .32) score moderate — below afrobeat — but are fenced
  // off afrobeat's row by acoustic/swing/bpm anyway (they don't camp on it).
  // Added to afrobeat's target row (measured floor); it re-opens afrobeat's
  // margin over the four-on-floor cluster and lets it leave the solver's
  // MARGIN_FRAGILE exemption (see genre-kernel NO_AUTO_GENRE).
  const INTERLOCK_Q=new Set([0,4,8,12]);
  function interlock(drums){
    const wins={};
    drums.forEach(d=>{ const w=Math.floor(d.beat/8); const slot=((Math.round(d.beat*2)%16)+16)%16;
      (wins[w]=wins[w]||{}); (wins[w][d.drum]=wins[w][d.drum]||new Set()).add(slot); });
    const per=[];
    for(const w of Object.values(wins)){
      const lanes=Object.entries(w).filter(([l,s])=>s.size>=2);
      const kick=w.kick;
      if(lanes.length<2||!kick||kick.size<2){ per.push(0); continue; }
      const cover={}; for(const [l,s] of lanes) for(const slot of s) cover[slot]=(cover[slot]||0)+1;
      const single=Object.values(cover).filter(c=>c===1).length/16;
      const kOff=[...kick].filter(s=>!INTERLOCK_Q.has(s)).length/kick.size;
      per.push(kOff*single);
    }
    return per.length?per.reduce((a,b)=>a+b,0)/per.length:0;
  }

  function features(state){
    const ev=E.buildEvents(state);
    const beats=Math.max(1,ev.totalBeats);
    // CORE KIT ONLY: the decorative perc lane (clap/rim/ride/crash/perc — 2026-07)
    // is timbral color, not the symbolic rhythm fabric this verifier scores. The
    // drumDensity / variation / interlock / offgrid features measure the
    // kick/snare/hat/tom kit exactly as before, so adding perc to a genre never
    // moves any confusion-matrix cell (byte-identical to the pre-perc features).
    const CORE={kick:1,snare:1,hat:1,tom:1};
    const drums=ev.drums.filter(d=>CORE[d.drum]);
    const kicks=drums.filter(d=>d.drum==="kick"), snares=drums.filter(d=>d.drum==="snare"), hats=drums.filter(d=>d.drum==="hat");
    const Iv=(state.instruments&&state.instruments.drums)||{};
    const lev={kick:Iv.kick??1,snare:Iv.snare??1,hat:Iv.hat??1};
    const sum=(a)=>a.reduce((s,e)=>s+e.amp*(lev[e.drum]||1),0);   // what you HEAR: amp × kit level
    const offgrid=drums.length?drums.filter(d=>{const f=d.beat*2-Math.round(d.beat*2);return Math.abs(f)>0.08;}).length/drums.length:0;
    // per-8-beat-window drum signatures: how much does the pattern actually vary?
    const wins={};
    drums.forEach(d=>{const w=Math.floor(d.beat/8);(wins[w]=wins[w]||[]).push((Math.round((d.beat%8)*4)/4)+d.drum[0]+Math.round(d.amp*10));});
    const sigs=Object.values(wins).map(w=>w.sort().join(","));
    const variation=sigs.length?new Set(sigs).size/sigs.length:0;
    const I=state.instruments||E.defaultInstruments();
    const prog=E.getProgression(state.progression);
    const roots=new Set(prog.chords.map(c=>c.name.replace(/[^A-G#b]/g,"").slice(0,2)));
    const secs=state.sections||[];
    const role=(r)=>secs.filter(s=>s.found&&s.found.sourceId&&(s.found.role||"bed")===r).length/Math.max(1,secs.length);
    return {
      bpm: state.bpm,
      offgrid: +offgrid.toFixed(3),
      snareBalance: +(sum(snares)/(sum(kicks)+0.001)).toFixed(2),
      hatDensity: +(hats.length/beats).toFixed(2),
      drumDensity: +(drums.length/beats).toFixed(2),
      variation: +variation.toFixed(2),
      wash: +(((state.reverb||0)*(0.55*(I.pad.send||0)+0.45*(I.drums.send||0)))).toFixed(3),
      sub: I.bass.model==="sub"||I.bass.model==="reese" ? 1 : (I.bass.cutoff<550?0.6:0.2),
      motion: +(Math.min(1,(roots.size-1)/3)).toFixed(2),
      seventh: +(prog.chords.filter(c=>/7/.test(c.name)).length/prog.chords.length).toFixed(2),
      breakUse: +role("break").toFixed(2),
      chopUse: +role("chops").toFixed(2),
      bedUse: +(role("bed")+role("narration")).toFixed(2),
      crackle: state.crackle||0, pump: state.pump||0, comp: state.comp||0,
      swing: state.swing||0, humanize: state.humanize||0,
      // sampler = a REAL sampled instrument (sax/flute/guitar/strings…): acoustic
      // by construction — .8 on the melody (present but not felt-piano intimate),
      // pad sampler counts like an organ/piano pad. DX7 keys/organ/mallet PATCHES
      // (E.ORGAN, E.PIANO, CLAV, VIBE, MARIMBA…) keep the organ-grade .6 —
      // disco/krautrock resolving their organ pads to the real DX7 organs must
      // not fall off their own diagonals (2026-07 matrix regression).
      // PAD-side only: a dx7 lead stays synth (citypop's E.PIANO lead is its
      // dry-synth identity), but organ/mallet DX7 PADS keep organ-grade .6.
      // 2026-07 neoclassical deep pass: a SAMPLED PIANO lead (felt_piano) is
      // piano-grade 1, not sampler-grade .8 — the .8 tier was defined to mean
      // "real but not felt-piano intimate" (sax/flute/bandoneon), and the felt
      // piano is precisely the intimacy it excluded. Keeps neoclassical
      // honestly outside newage's acoustic hi-fence (.85, built to admit the
      // real flute while excluding the piano).
      // 2026-07 organ pass (Part B): HAMMOND counts as acoustic (organ-grade
      // .6). The B-3 is a tonewheel organ — electro-mechanical, genuinely an
      // organ — so it slots in with model "organ"; this re-opens disco's
      // hammond stab pad (a dominant B-3 pad no longer drops disco's acoustic
      // diagonal into acidhouse). MEASURED both ways: hammond-only keeps EVERY
      // existing genre's confusion-matrix margin byte-identical to baseline
      // (hammond only ever appears where organ-grade acoustic is already
      // present — blues/newjack/house/krautrock), matrix 63/63 (the full
      // roster at measurement time; 178 today). SOLINA is
      // deliberately NOT counted: it is an ANALOG STRING SYNTHESIZER (ARP/
      // Eminent), not an acoustic/electro-mechanical instrument, and its home
      // genres (italo, sovietwave) encode it AS synth via low acoustic targets
      // [0,.3]. Counting solina drew italo down to a knife-edge tie (self
      // 100->95, margin +1->0, because solina is italo's dominant pad on seeds
      // 1&3) — the measurement said don't. So solina stays synth.
      // 2026-07 (KERNEL-V4 §3.6): the acoustic membership grades now READ the
      // exported SOURCE_CLASS axis (SOURCE_CLASS[model].ac) instead of an inline
      // ACM list — the feature reads the dimension rather than re-deriving it.
      // Grades are byte-identical to the ACM era (piano 1, sampler .8,
      // organ/hammond .6; the analog string-synth fleet incl. solina stays 0).
      // The two things that AREN'T pure per-model classification stay local: a
      // DX7 pad is acoustic only when its loaded PATCH name is keyboard-ish
      // (KEYSY), and a sampled-PIANO melody grades a full 1 (not .8). Presence
      // is gated on melody OR pad; the grade is set by the melody voice (a bare
      // acoustic pad under a synth lead reads .6).
      acoustic: (()=>{ const KEYSY=/(ORGAN|PIANO|CLAV|VIBE|MARIMBA|XYLO|LOG DRUM|KOTO|HARP|GUIT|BANJO|SITAR|LUTE|HARMONICA|CELESTE|ACCORDION)/i;
        const ac=(m)=>(E.SOURCE_CLASS[m]&&E.SOURCE_CLASS[m].ac)||0;   // 0 for pure-synth sources (solina, saw, dx7, …)
        const dxPadAc=I.pad.model==="dx7"&&I.pad.dx7&&KEYSY.test(I.pad.dx7.name||"");
        const melAc=ac(I.melody.model)>0, padAc=ac(I.pad.model)>0||dxPadAc;
        const melSampPiano=I.melody.model==="sampler"&&/piano/i.test((I.melody.sampler&&I.melody.sampler.id)||"");
        return melAc ? (melSampPiano?1:ac(I.melody.model)) : (padAc?0.6:0); })(),
      // rubato: the time dimension (state.rubato.depth; 0 = clock-straight).
      // Symbolic and honest — buildEvents actually warps every event's beat by
      // it (the press breathes; engine.test renders it). Only genres that
      // OWN tempo-breathing (neoclassical always, tango/jazz sometimes) carry
      // it, so it fences neoclassical off the grid-locked ambient/newage/
      // vaporwave neighbors that share its bpm/wash/harmony ranges.
      rubato: state.rubato?+(state.rubato.depth||0).toFixed(3):0,
      leadVoices: I.melody.voices||2,
      softTop: state.tone&&state.tone.highcut>0?1:0,
      interlock: +interlock(drums).toFixed(3),   // Fela's arithmetic (see helper above)
    };
  }

  // per-genre target ranges: [lo, hi, weight]
  const TARGETS = {
    techno:   { bpm:[120,145,3], offgrid:[0,.3,1], snareBalance:[0,.6,2], wash:[0,.32,2], motion:[0,.4,2],
                pump:[.3,1,2], comp:[.4,1,1], drumDensity:[1.4,4.5,1], breakUse:[0,.15,1], variation:[.3,1,1],
                swing:[0,.07,2] },
    house:    { bpm:[117,128,3], offgrid:[.05,.5,1], snareBalance:[0,.7,2], pump:[.3,.6,2], comp:[.3,1,1],
                motion:[.15,.8,1], wash:[0,.4,1], hatDensity:[1.2,3,1], chopUse:[.2,1,1], swing:[.06,.18,2] },
    jungle:   { bpm:[150,180,3], offgrid:[.22,.75,2], snareBalance:[0,.95,2], sub:[.6,1,2], wash:[0,.35,2],
                breakUse:[.35,1,3], drumDensity:[1.8,6,1], variation:[.4,1,1] },
    triphop:  { bpm:[66,96,3], crackle:[.25,1,2], breakUse:[.15,1,2], offgrid:[.12,.65,1], wash:[.18,.6,1],
                swing:[.1,.4,1], snareBalance:[0,.9,1], softTop:[1,1,1] },
    vaporwave:{ bpm:[62,92,3], wash:[.28,.5,3], motion:[.5,1,2], seventh:[.5,1,2], breakUse:[0,.1,1],
                snareBalance:[0,.85,1], comp:[0,.25,1], bedUse:[.4,1,2], swing:[0,.08,1],
                rubato:[0,.008,1] },   // 2026-07 wash-trio deep pass: swing CAP [0,.08] added — vaporwave is machine-time (renders swing .03-.076, the slowed tape never grooves); this fences the newly-swung downtempo (renders .10-.20) off vaporwave's diagonal (downtempo was scoring 99 here — its own margin cap). MEASURED: vaporwave's own max swing .076 < .08, self unchanged. // vaporwave is MACHINE time — a slowed tape plays at constant (wrong) speed, it never breathes. Every vaporwave anchor seed sits at rubato 0; this fences the tempo-breathing neoclassical (rubato .02-.04) off vaporwave's diagonal (it was scoring 98 there on bpm/wash/7th overlap alone). 2026-07 mallsoft deep pass: bpm lo 58->62 and wash re-centered [.35,1]->[.28,.5] (weight 3). MEASURED: vaporwave renders bpm 64-87 (5-seed) and wash .308-.441 — its OWN home was always ~.3-.44, the old [.35,1] hi was pure slack that let the wetter/slower mallsoft (bpm 46-58, wash .54-.72) camp on this diagonal (mallsoft was scoring 98-100 here). Both fences are the anchor's own measured floor/cap; vaporwave self unchanged (still 99-100)
    synthwave:{ bpm:[84,120,3], leadVoices:[4,9,2], wash:[.25,.7,1], motion:[.3,1,1], pump:[.05,.6,1],
                snareBalance:[.4,1.4,1], sub:[0,.8,1], bedUse:[.3,1,1] },
    lofi:     { bpm:[66,92,3], crackle:[.4,1,3], swing:[.14,.4,2], seventh:[.5,1,1], softTop:[1,1,2],
                snareBalance:[0,.8,1], wash:[.1,.5,1], breakUse:[0,.1,2] },   // 2026-07 triphop deep pass: lofi is a PROGRAMMED boombap kit (renders breakUse 0 — no chopped-break role), while triphop's whole identity is THE SLOWED SAMPLED BREAK (renders breakUse .5, found role "break"). This cap is the oldest-confusion-pair fix: triphop was scoring 99 here (margin +1) because lofi's row — both are 80bpm/dusty/maj7/soft-top — never looked at whether the drums are a real chopped break. MEASURED: lofi self unchanged (its own breakUse is 0)
    downtempo:{ bpm:[60,82,3], wash:[.28,.8,2], drumDensity:[.35,2.2,3], motion:[.4,1,2], comp:[0,.4,1],
                snareBalance:[0,.8,1], bedUse:[.4,1,1], sub:[.5,1,2], seventh:[.5,1,1], swing:[.06,.28,2], crackle:[.08,.6,1] },   // warm EXTENDED harmony — wintersynth's bare frost triads stay off this diagonal. 2026-07 wash-trio deep pass: downtempo is the BEAT one. drumDensity lo .2->.35 (weight 2->3) fences the now-drumless ambient (renders 0) and newage (0); swing FLOOR [.06,.28] weight 2 is the groove signature — downtempo renders swing .08-.20, while the whole straight-time wash cluster (vaporwave .03-.08, witchhouse .02-.05, mallsoft .03-.06, doomdrone .01-.03, ambient/newage <.04) all fall below .06. Together: only a genre with a real SWUNG BACKBEAT scores as downtempo (self unchanged 100; ambient/newage/witchhouse all fenced off, was 99). motion lo .3->.4 weight 1->2: downtempo renders motion .67-1 (moving warm harmony), which fences the now-drone witchhouse (motion 0, drone_min-dominant) and static ambient (motion 0-.33) hard on this weight-2 axis. 2026-07 exotica/spacelounge split: bpm CAP 90->82 removed 10bpm of pure slack — downtempo's anchor is [62,80] (renders max 79, deliberately BELOW the 82 tiki floor per this same pass), so 82 is its own definitional ceiling; the slack let the mid-tempo spacelounge (87-100) camp on this diagonal at 97. downtempo self unchanged (its whole home is <82)
    ambient:  { bpm:[58,76,2], drumDensity:[0,.6,3], wash:[.4,1,3], motion:[0,.5,2], pump:[0,.1,1],
                snareBalance:[0,1,0.5], bedUse:[.6,1,2], comp:[0,.2,2] },   // 2026-07 mallsoft pass: ambient is STATIC drone harmony (renders motion 0-.33) at 59-72bpm. motion hi .9->.5 (weight 1->2) and bpm lo 52->58 are the honest structural fence vs the now-kitless-wetter mallsoft, whose muzak still CHANGES CHORDS (motion 1) at a stopped-escalator 45-56bpm — mallsoft was tying here at 98. ambient self unchanged (motion/bpm both inside its own measured home); the wash-cluster neighbors (downtempo/newage motion .33-1) also fall off this diagonal, widening ambient's own margin
    dinosynth:{ bpm:[68,98,2], drumDensity:[1.6,3.3,3], hatDensity:[1.2,2.3,2], snareBalance:[0,.45,2],
                swing:[0,.07,2], motion:[.5,1,1], wash:[.4,.78,2], crackle:[0,.2,1], bedUse:[.5,1,2],
                comp:[.35,.72,3], pump:[0,.08,1] },
    canawave: { bpm:[102,118,2], motion:[.5,1,2], leadVoices:[1,3,2], bedUse:[.3,1,2], hatDensity:[1,2.4,2],
                snareBalance:[.3,1.1,1], wash:[.15,.55,2], crackle:[0,.15,1], comp:[.2,.5,1], drumDensity:[1.2,3.3,1], swing:[0,.12,1], acoustic:[.4,.85,2] },   // acoustic = the picked kpluck guitar (vs transitwave's all-synth grit)
    transitwave:{ bpm:[108,120,3], swing:[.06,.22,2], acoustic:[0,.2,3], wash:[.12,.5,1], bedUse:[.45,1,3],
                hatDensity:[.65,3,1], leadVoices:[1,4,1], motion:[.25,1,1], pump:[0,.22,1], comp:[.25,.6,1],
                crackle:[0,.15,1], drumDensity:[1.2,3.8,1], snareBalance:[.3,1.2,1] },   // motorik rail: chugging swing, all-synth (acoustic≈0 — distinct from canawave's guitar), bed-heavy clatter
    neoclassical:{ bpm:[55,85,2], drumDensity:[0,.5,3], acoustic:[.8,1,3], humanize:[.28,.7,2],
                motion:[.5,1,1], wash:[.2,.6,1], pump:[0,.05,1], breakUse:[0,0,1],
                rubato:[.015,.05,2] },   // 2026-07 deep pass: acoustic lo .6->.8 (the voice IS a real/sampled piano now — organ pads are purged, .6-grade seeds no longer exist); drumDensity hi admits the whisper key-thunks (~.1-.3/beat, kit still off); wash re-centered on the dryer close-mic reverb; rubato REQUIRED — the one feature ambient/newage/vaporwave structurally lack
    dancepop: { bpm:[112,130,3], motion:[.6,1,2], leadVoices:[2,6,1], snareBalance:[.3,1.3,1],
                drumDensity:[1.2,3.2,1], swing:[0,.12,1], pump:[0,.35,1], breakUse:[0,.1,1], acoustic:[0,.3,1],
                seventh:[0,.6,2], crackle:[0,.15,2] },
    edm:      { bpm:[121,134,3], pump:[.5,1,3], comp:[.55,1,2], leadVoices:[5,9,2], wash:[.1,.5,1],
                motion:[0,.8,1], crackle:[0,.1,1], swing:[0,.07,1] },
    dubstep:  { bpm:[133,148,3], sub:[.6,1,2], drumDensity:[.4,2.2,2], snareBalance:[.3,1.3,1],
                pump:[0,.35,1], offgrid:[.05,.55,1], wash:[.15,.55,1], crackle:[0,.2,1], swing:[0,.12,2],
                leadVoices:[1,2,2], hatDensity:[.3,.7,2], softTop:[0,0,2] },   // 2026-07 darksynth deep pass: dubstep is LEAD-LESS bass music (the wobble is the hook — renders leadVoices 1-2) with SPARSE E(5,16) hats (renders hatDensity .40-.45). darksynth's whole identity is the hard-sync tear-lead supersaw (leadVoices 4-5) over a DRIVING pulse kit (hatDensity .49-1.04) — it was scoring 100 here (margin 0, the flagship failure) because dubstep's row never looked at the lead or the hat-drive. Three wedges split the work: leadVoices weight 2 (darksynth's 4-5 vs [1,2] is the wall); hatDensity weight 2 catches darksynth's driving hats; softTop[0,0] weight 2 is the CLEAN-vs-FILTHY axis — dubstep is bright (highcut off, softTop 0), and this fences the tape-rolled phonk (softTop 1), which at low-hat seeds otherwise slid into the sparse-hat band. Result: darksynth-vs-dubstep 100->81-90 (self 100, margin >=10), phonk stays home (self 93 > vs-dub 85), dubstep self unchanged (bright/lead-less/sparse-hat, all in-band)
    blues:    { bpm:[74,102,3], swing:[.22,.46,3], acoustic:[.4,1,2], seventh:[.85,1,3],
                motion:[.5,.7,2], crackle:[.2,.6,1], drumDensity:[.7,2.6,1], pump:[0,.05,1] },
    jazz:     { bpm:[96,148,2], swing:[.26,.52,3], acoustic:[.4,1,2], seventh:[.6,1,1],
                motion:[.55,1,2], snareBalance:[.6,1.3,2], hatDensity:[.42,.68,2], humanize:[.3,.7,1],
                crackle:[0,.42,1] },   // 2026-07 (blues acoustic pass): blues now rides shuffle+upright+organ and was TYING jazz at 100. Honest fences: bpm lo = the jazz anchor's own floor (96, was 92); crackle hi = the anchor's own cap (.4+margin) — blues IS the worn-record genre (.25-.55), jazz is merely dusty. 2026-07 jazz/blues acoustic-twin FENCE pass (the last negative column margin, jazz col -1): the two share swing/acoustic/7th/motion/crackle almost feature-for-feature, so the fence is the DRUM IDENTITY, measured over 8 seeds each. snareBalance flipped from a loose ceiling [0,.75] to a FLOOR [.6,1.3] weight 2: jazz is walking-swing with a STRONG comping backbeat snare (renders .67-.89), blues is a kick-forward triplet shuffle with a QUIET snare (renders .22-.59) — the old ceiling let blues pass fully AND jazz's own high-snare seeds partly failed it. hatDensity flipped from a loose floor [.7,2.6] (which jazz's OWN renders .51-.64 fell below!) to a CEILING [.42,.68] weight 2: jazz swings on a SPARSE ride cymbal (.51-.64), blues drives a FULLER shuffle kit (.67-1.39). Both corrections make the row describe jazz's actual renders, so jazz's own diagonal RISES 99->100 while blues drops 100->84 (rival becomes triphop 94, margin +6). Anchors untouched (pure verifier fence); no other column moved (jazz row scored against jazz only)
    dub:      { bpm:[64,86,3], sub:[.6,1,2], motion:[0,.4,2], crackle:[0,.1,2], swing:[0,.12,2],
                snareBalance:[.4,1.4,1], breakUse:[0,.1,1], drumDensity:[.5,2.4,1], pump:[0,.15,1], wash:[0,.34,2] },   // 2026-07 wash-trio pass: wash CEILING added — dub is DRY (the delay is the genre, not the reverb; renders wash .19-.26). This fences the drowned witchhouse (renders wash .46-.51, the cathedral-of-reverb) off dub's diagonal — the two are both slow/sub/dark/drone-minor, and wash was the missing separator (witchhouse was scoring 97 here). MEASURED: dub's own max wash .262 < .34, self unchanged
    trance:   { bpm:[128,146,3], leadVoices:[5,8,2], pump:[.3,.7,2], motion:[.5,1,2], wash:[.2,.6,1],
                crackle:[0,.05,1], swing:[0,.05,1], breakUse:[0,.05,1], sub:[0,.6,1] },
    disco:    { bpm:[106,124,3], swing:[.04,.14,2], acoustic:[.4,.7,2], seventh:[.8,1,2], chopUse:[0,.08,2],
                pump:[0,.2,2], hatDensity:[.7,1.8,1], breakUse:[0,.05,1], crackle:[0,.25,1] },
    italo:    { bpm:[106,122,3], leadVoices:[1,3,2], swing:[0,.1,2], motion:[.5,1,1], snareBalance:[.3,1.2,1],
                pump:[0,.35,1], crackle:[0,.1,1], breakUse:[0,.05,1], acoustic:[0,.3,1], sub:[0,.5,1] },
    bigbeat:  { bpm:[114,140,3], breakUse:[.3,1,3], comp:[.5,.9,2], pump:[.15,.6,1], crackle:[0,.25,1],
                swing:[0,.12,1], snareBalance:[.4,1.3,1], sub:[0,.7,1] },
    garage:   { bpm:[124,140,3], swing:[.16,.34,3], sub:[.6,1,2], snareBalance:[.4,1.4,2],
                crackle:[0,.1,1], breakUse:[0,.08,1], seventh:[.8,1,1] },
    doomdrone:{ bpm:[44,64,3], comp:[.4,.85,3], drumDensity:[0,1.2,2], wash:[.5,1,2], motion:[0,.7,1],
                pump:[0,.06,1], swing:[0,.05,1], crackle:[0,.15,1], snareBalance:[0,.5,1] },
    newage:   { bpm:[58,80,2], drumDensity:[0,.5,3], motion:[.5,1,3], wash:[.4,1,2], pump:[0,.05,1],
                crackle:[0,.1,2], comp:[0,.25,2], swing:[0,.06,1], bedUse:[.5,1,2], acoustic:[0,.85,2],
                seventh:[.4,1,2], rubato:[.006,.05,2] },   // luminous EXTENDED harmony — wintersynth's frost triads (seventh 0) stay off this diagonal; acoustic hi .85 admits the REAL flute lead (sampler .8) while still fencing off neoclassical's piano (1). 2026-07 wash-trio deep pass: newage is the MELODIC one. rubato FLOOR [.006,.05] weight 2 is its structural fence — newage renders rubato .008-.02 (the melody breathes) while ambient/downtempo/vaporwave/witchhouse all render rubato 0 (drone/machine/beat time); and motion lo .3->.5 (moving major-7 changes only now, renders motion 1) fences the static ambient (motion 0-.33). Together with the drum-less bed, only a genre with a BREATHING MELODY over MOVING harmony scores as newage (was tying downtempo/vaporwave 98-99)
    exotica:  { bpm:[82,108,3], swing:[.1,.26,2], acoustic:[.4,1,2], seventh:[.8,1,1], bedUse:[.4,1,1],
                crackle:[0,.2,1], drumDensity:[.65,1.3,2], snareBalance:[0,.8,1], softTop:[0,0,1], motion:[.5,1,1], wash:[0,.30,2] },   // 2026-07 exotica/spacelounge split — exotica is the DRY TIKI ROOM with a real brushed combo: wash CAP .30 (renders .21-.28, the intimate acoustic lounge) fences the wetter orbital spacelounge (.33-.37) and the washy downtempo (.39-.44); drumDensity BAND .65-1.3 weight 2 (renders .69-1.13, a full vibes-brushes-and-hand-perc combo) fences BOTH newjack's dense swingbeat kit (1.52-1.98, via the cap) AND the near-kitless spacelounge (.39-.73, via the floor — the orbital band is nearly gone). The birds-as-percussion identity is the sampleEvents aviary in the anchor (found layer, not a feature)
    industrial:{ bpm:[96,128,3], chopUse:[.25,1,2], pump:[0,.35,2], comp:[.4,.85,1], motion:[0,.7,2],
                sub:[.5,1,1], swing:[0,.06,1], crackle:[0,.12,1], snareBalance:[0,.7,1], hatDensity:[.8,2.6,1], humanize:[0,.18,2] },   // 2026-07 idm deep pass: industrial is QUANTIZED-TIGHT machine funk (renders humanize .04-.09) — this humanize CAP is the structural fence vs idm's whole thesis, "machine precision FAKING clumsiness" (idm renders humanize .35-.42, the drunk-but-precise contradiction). idm was scoring 99 here (margin +1) purely because industrial's row never read the timing feel that most separates them. MEASURED: industrial self unchanged (its own humanize far below .18)
    spokenword:{ bpm:[68,100,3], crackle:[.25,.55,2], acoustic:[.4,1,3], swing:[0,.16,2], snareBalance:[0,.5,2],
                softTop:[0,0,2], bedUse:[.4,1,2], seventh:[.8,1,1], pump:[0,.05,1], drumDensity:[.8,2.6,2] },
    chiptune: { bpm:[136,152,3], crackle:[0,.05,2], wash:[0,.28,2], leadVoices:[1,2,2], sub:[0,.5,2],
                breakUse:[0,.05,1], swing:[0,.04,2], drumDensity:[1.6,4,1], motion:[.5,1,1], pump:[0,.2,1] },
    chinawave:{ bpm:[92,120,3], snareBalance:[.55,1.5,3], crackle:[.1,.4,2], seventh:[0,.65,2], motion:[.5,1,1],
                bedUse:[.4,1,2], acoustic:[0,.3,1], swing:[0,.05,1], pump:[0,.1,1], sub:[0,.5,1], wash:[.1,.3,2] },   // march snare UP + shellac dust + triadic majors (vs sovietwave's minor 7ths, quiet snare). 2026-07 coldwave deep pass: snareBalance weight 2->3 (the forward march snare, renders .74-.90, is chinawave's spine) + wash FLOOR [.1,.3] weight 2 = the shellac-reverb sheen (chinawave renders wash .16-.22, a modest room). Both fence the bone-DRY bass-forward coldwave (wash .045, snareBalance .30-.45), which was tying chinawave at 100. MEASURED: chinawave self unchanged (its own snareBalance/wash both in-band)
    sovietwave:{ bpm:[86,116,2], crackle:[.15,.45,2], seventh:[.6,1,2], snareBalance:[0,.6,2], leadVoices:[1,4,2],
                bedUse:[.4,1,2], motion:[.5,1,1], wash:[.25,.7,1], swing:[0,.06,1], acoustic:[0,.3,1], pump:[0,.2,1] },   // minor-anthem 7ths + radio dust; few lead voices (vs synthwave supersaw)
    // ---- round 3 ----
    citypop:  { bpm:[90,108,3], seventh:[.8,1,2], swing:[.03,.14,2], wash:[0,.2,2], crackle:[0,.12,2],
                motion:[.5,1,1], acoustic:[0,.85,1], hatDensity:[.35,1.4,1], pump:[0,.12,1], comp:[.05,.3,1] },   // bright maj7 pop, DRY next to vaporwave, no disco organ, light master. 2026-07 boopy-fix: acoustic cap .3->.85 — half the seeds now lead on a REAL jazz-guitar/electric-grand/sax (.8) beside the DX7 e-piano gloss; the .85 cap admits them (excludes felt-piano's 1.0). The separator vs italo was never acoustic (both admit synth-0); italo unaffected (still passes citypop's widened cap as it passed .3)
    shibuyakei:{ bpm:[112,130,3], swing:[.12,.26,3], crackle:[0,.1,2], acoustic:[0,.85,1], leadVoices:[1,3,1],
                motion:[.6,1,1], pump:[0,.1,1], wash:[0,.25,1], snareBalance:[.3,1.1,1], breakUse:[0,.05,1] },   // twee SWING at pop tempo — dancepop can't swing, disco can't get this clean
    bossanova:{ bpm:[82,102,2], swing:[.06,.2,2], softTop:[1,1,2], acoustic:[.5,1,2], seventh:[.8,1,1],
                crackle:[.05,.3,1], drumDensity:[1.4,2.6,1], snareBalance:[0,.6,1], humanize:[.2,.5,1] },   // soft-top nylon whisper — exotica is brighter (softTop 0), jazz swings way harder
    idm:      { bpm:[84,120,2], humanize:[.28,.55,3], swing:[0,.06,2], crackle:[0,.12,2], chopUse:[.2,1,2],
                wash:[0,.25,1], variation:[.4,1,1], pump:[0,.15,1], comp:[.25,.55,1] },   // precise-but-drunk: high humanize with ZERO swing — the signature contradiction
    electro:  { bpm:[115,132,3], snareBalance:[.35,1.2,2], swing:[0,.07,2], chopUse:[.2,1,1], sub:[0,.7,1],
                pump:[0,.25,1], comp:[.35,.65,1], crackle:[0,.12,1], hatDensity:[1.5,2.8,1] },   // tresillo claps + dry machine funk — techno pumps, electro doesn't
    miamibass:{ bpm:[98,130,2], sub:[.6,1,3], hatDensity:[1.1,2.2,2], swing:[0,.08,2], snareBalance:[.3,1.1,1],
                crackle:[0,.1,1], pump:[0,.25,1], comp:[.2,.5,1], chopUse:[0,.1,1], acoustic:[0,.25,1] },   // the 808 sub + fast hats, all machine — electro's sub-light sibling
    phonk:    { bpm:[122,146,3], crackle:[.3,.7,3], sub:[.6,1,2], softTop:[1,1,2], swing:[0,.12,1],
                hatDensity:[1.6,3.2,1], motion:[0,.5,1], comp:[.3,.7,1] },   // tape filth at dubstep tempo — dubstep is CLEAN, lofi is SLOW
    witchhouse:{ bpm:[56,80,3], wash:[.35,.8,3], sub:[.6,1,2], drumDensity:[1,3.2,1], motion:[0,.7,1],
                swing:[0,.1,2], crackle:[0,.18,1], comp:[.15,.45,1], pump:[0,.12,1] },   // slowed 808s UNDER the cathedral — vaporwave majors, this drones minor
    mallsoft: { bpm:[42,60,3], drumDensity:[0,1.5,3], wash:[.5,1,2], seventh:[.5,1,1], motion:[.5,1,1],
                bedUse:[.4,1,2], comp:[0,.2,1], pump:[0,.05,1], crackle:[.05,.35,1] },   // 2026-07 deep pass — the DEAD MALL: escalator stopped (bpm 46-58, below vaporwave's 62 floor), and the WASH IS THE INSTRUMENT (wash .5-.72 in the wet dattorro atrium, above vaporwave's dry .28-.5). vaporwave is dry major tape; mallsoft is that tape drowned in the empty-atrium reverb, heard from two stores away — the two fences that finally break the mallsoft==vaporwave identity (was margin 0-2)
    wintersynth:{ bpm:[60,88,2], seventh:[0,.55,3], drumDensity:[.05,1,2], wash:[.4,1,2], acoustic:[0,.3,2],
                crackle:[0,.15,1], swing:[0,.06,1], motion:[.4,1,1], comp:[0,.35,1], pump:[0,.05,1] },   // FROST TRIADS (seventh≈0) — newage/ambient live in extended-harmony wash
    gabber:   { bpm:[150,190,3], offgrid:[0,.2,2], breakUse:[0,.08,2], comp:[.5,1,2], swing:[0,.05,2],
                pump:[.3,.8,1], crackle:[0,.08,1], drumDensity:[1.8,4.5,1], chopUse:[.2,1,1] },   // straight distorted four at jungle tempo — jungle breaks, gabber hammers
    psytrance:{ bpm:[136,150,3], motion:[0,.7,2], leadVoices:[1,4,2], pump:[.25,.7,2], swing:[0,.04,2],
                snareBalance:[0,.6,2], comp:[.4,.8,1], crackle:[0,.05,1], breakUse:[0,.05,1] },   // rolling acid line, FEW voices — trance needs the supersaw choir
    minimal:  { bpm:[117,131,3], drumDensity:[.5,2.2,2], wash:[0,.2,3], motion:[0,.4,2], snareBalance:[0,.65,2],
                pump:[.05,.3,1], swing:[0,.05,1], hatDensity:[.3,1.2,1], crackle:[0,.1,1], comp:[.2,.5,1] },   // techno with the air let out: SPARSE and DRY, master barely touched
    deephouse:{ bpm:[115,126,3], sub:[.6,1,3], swing:[.06,.18,2], snareBalance:[0,.6,2], pump:[.1,.4,1],
                seventh:[.8,1,1], hatDensity:[1.2,2.6,1], chopUse:[0,.1,1], wash:[.1,.4,1], crackle:[0,.25,1] },   // subby + quiet claps — house pumps harder and chops vocals
    coldwave: { bpm:[96,122,3], wash:[0,.15,3], crackle:[.1,.4,2], seventh:[0,.4,2], swing:[0,.07,2],
                snareBalance:[.2,1,2], pump:[0,.15,1], leadVoices:[1,3,1], acoustic:[0,.2,1] },   // dry triads + cassette hiss — italo sparkles, this shrugs. 2026-07 deep pass: coldwave is BASS-FORWARD post-punk — the drum machine sits BEHIND the lead bass, snare recessed (renders snareBalance .30-.45). Floor .4->.25 + weight 1->2 makes the recessed snare a real signature: chinawave's whole claim is the "march snare UP" ([.55,1.5], renders .74-.90), so this is the structural break of the coldwave==chinawave margin-0 tie (chinawave was scoring 100 off coldwave's tracks — the two shared 110bpm/dry/triad/crackle and only the snare mix separates them)
    ebm:      { bpm:[114,132,3], snareBalance:[.1,1.1,2], chopUse:[0,.1,2], comp:[.4,.8,2], drumDensity:[2.2,4.2,2],
                swing:[0,.05,2], sub:[.6,1,1], pump:[.1,.5,1], crackle:[0,.08,1], motion:[0,.7,1] },   // dense piston kit — industrial chops the factory, industrialmetal slams halftime
    krautrock:{ bpm:[98,120,3], acoustic:[.4,.8,3], swing:[0,.06,2], motion:[0,.7,2], pump:[0,.12,1],
                crackle:[.05,.3,1], drumDensity:[1.5,3.4,1], wash:[0,.25,1], leadVoices:[1,3,1] },   // ORGAN over the motorik pulse — transitwave is all-synth (acoustic 0)
    newjack:  { bpm:[96,118,3], swing:[.14,.3,3], snareBalance:[.5,1.4,2], seventh:[.8,1,1], crackle:[0,.15,1],
                pump:[0,.25,1], hatDensity:[.8,2,1], comp:[.3,.6,1], motion:[.3,1,1], acoustic:[.3,.8,1] },   // swingbeat at 108 — garage swings at 130, house barely swings at all
    breakcore:{ bpm:[166,200,3], breakUse:[.3,1,3], comp:[.5,.9,2], offgrid:[.2,.8,1], humanize:[.15,.45,1],
                drumDensity:[2,6,1], snareBalance:[.3,1.2,1], swing:[0,.07,1], pump:[0,.3,1] },   // the amen PAST jungle tempo, compressed to death
    acidhouse:{ bpm:[115,128,3], swing:[0,.09,2], crackle:[.05,.35,2], pump:[.2,.6,2], snareBalance:[.45,1.2,2],
                motion:[0,.7,2], seventh:[.8,1,1], chopUse:[0,.1,1], comp:[.3,.7,1] },   // loud claps + record dust — techno's snare is optional color, house chops vox
    surfrock: { bpm:[122,148,3], swing:[.05,.16,2], crackle:[.1,.4,2], seventh:[0,.6,2], acoustic:[.3,.8,1],
                leadVoices:[1,2,1], drumDensity:[1.6,3,1], hatDensity:[.9,1.8,1], pump:[0,.1,1], humanize:[.1,.4,1] },   // 45rpm twang — chiptune is bone-dry and swingless at this tempo
    spacelounge:{ bpm:[84,104,3], swing:[.08,.22,2], acoustic:[.4,.8,2], wash:[.30,.40,2], drumDensity:[.2,.9,2],
                hatDensity:[0,1,2], seventh:[.4,1,1], bedUse:[.4,1,1], crackle:[.05,.3,1], pump:[0,.05,1], leadVoices:[1,1,2] },   // theremin over organ, kit nearly gone — exotica keeps a real (brushed) kit. 2026-07 split: structural fences vs the tiki twin AND the slow-wet downtempo — leadVoices [1,1] weight 2 is the MONO theremin/ondes line (renders exactly 1; exotica's vibes/sax run 1-2, downtempo 1-2 — their 2-voice seeds fall off); wash BAND .30-.40 is the martini-bar orbit (renders .33-.37) — the FLOOR fences exotica's dry room (.21-.28), the CAP fences the washier downtempo/vaporwave (.39-.44); drumDensity CAP 1.4->.9 (renders .39-.73, the band is nearly gone) fences exotica's fuller brushed kit (up to 1.13); bpm floor 82->84 sharpens the real tempo gap to downtempo's slowed 64-79 (its own home min is 87). Orbit = electronics + width + no band; tiki = acoustic birds + a real combo
    arabpop:  { bpm:[92,118,2], seventh:[.3,.8,2], motion:[.4,1,2], drumDensity:[1.1,2.6,2], swing:[0,.12,1],
                hatDensity:[.5,1.6,1], snareBalance:[0,.6,1], crackle:[0,.25,1], humanize:[.1,.35,1], comp:[.2,.5,1], pump:[0,.12,1], leadVoices:[1,1,2] },   // hijaz color (mixed 7ths) + darbuka density at pop tempo — dinosynth is slower and washier. 2026-07 deep pass: leadVoices [1,1] weight 2 is the ORNAMENTED MONOPHONIC maqam line (renders exactly 1 — mizmar/oud is a single voice), which fences the polyphonic synth-pop rivals (sovietwave/coldwave/canawave all run 1-3+ supersaw/anthem voices) that shared arabpop's darbuka-density band
    tango:    { bpm:[96,126,2], acoustic:[.7,1,2], humanize:[.28,.6,2], drumDensity:[0,.8,3], crackle:[.1,.4,2],
                seventh:[.3,1,1], motion:[.5,1,1], swing:[0,.08,1], pump:[0,.05,1], wash:[0,.3,1] },   // sampled bandoneon + habanera piano, kitless, 78rpm dust, DRY (2026-07 ear-fix: pads nearly gone, reverb .3-.42)
    afrobeat: { bpm:[96,118,2], acoustic:[.4,.8,2], swing:[.02,.14,2], hatDensity:[1.3,2.6,2], drumDensity:[1.8,3.4,1],
                seventh:[.7,1,1], crackle:[.05,.3,1], comp:[.25,.55,1], pump:[0,.12,2], snareBalance:[.2,.9,1],
                interlock:[.30,1,3] },   // interlocking euclids + organ stabs — disco's hats are straighter and thinner. 2026-07 interlock pass: the new `interlock` feature (Fela's arithmetic, weight 3 — this IS afrobeat's identity) is the floor [.30,1]. afrobeat renders .37-.41 (E(3,16) kicks x E(11,16) shekere), the whole four-on-floor cluster scores <.09, so this widens afrobeat's column margin 3->8 over disco/krautrock and lets it LEAVE the solver's MARGIN_FRAGILE exemption (verified stable at targetSec:180: variation stays 1, interlock .37-.40)
    desertblues:{ bpm:[80,108,3], swing:[.04,.18,2], crackle:[.15,.5,2], softTop:[1,1,2], motion:[0,.7,2],
                acoustic:[.4,.8,1], sub:[.6,1,1], drumDensity:[.8,2.2,1], humanize:[.15,.45,1], pump:[0,.05,1] },   // modal vamp loops, tape-worn — blues needs the full 12-bar swing
    sludgemetal:{ bpm:[48,72,3], snareBalance:[.4,1.2,2], drumDensity:[.8,2,2], comp:[.4,.8,2], wash:[0,.35,2],
                sub:[.6,1,1], swing:[0,.07,1], crackle:[0,.25,1], pump:[0,.1,1], motion:[0,.7,1] },   // a BACKBEAT in the tar — doomdrone has no snare and lives in the wash
    industrialmetal:{ bpm:[96,130,3], snareBalance:[.45,1.3,2], comp:[.5,.9,2], drumDensity:[.9,2.3,2], chopUse:[0,.1,2],
                hatDensity:[.2,1.1,2], crackle:[0,.12,1], swing:[0,.06,1], pump:[0,.35,1], motion:[0,.8,1], sub:[.6,1,1],
                leadVoices:[1,2,2] },   // halftime SLAM, hats sparse — ebm's kit is twice as dense, miami's hats twice as fast, industrial chops the factory. 2026-07 darksynth pass: the riff-slam is lead-less (renders leadVoices 1-2); this fences darksynth's supersaw tear-lead (4-5) off industrialmetal's diagonal (darksynth was scoring 98 here, the other margin-2 sibling)
    darksynth:{ bpm:[118,138,3], snareBalance:[.25,1.2,2], pump:[0,.35,2], sub:[.6,1,2], leadVoices:[3,7,2],
                comp:[.4,.7,1], motion:[.4,1,1], crackle:[0,.08,1], swing:[0,.06,1], wash:[.1,.32,1], hatDensity:[.45,1.5,1] },   // gated snare + reese at 132 — dubstep starts at 133, trance/edm need the PUMP, synthwave is 30bpm slower. 2026-07 deep pass: the tear-lead supersaw (leadVoices weight 1->2, renders 4-5) and the DRIVING pulse-kit hats (hatDensity [.45,1.5]: renders .5-1.02) are darksynth's spine vs the lead-less/halftime siblings (dubstep+industrialmetal both render leadVoices 1-2, hats .40-.45); wash tightened .45->.32 (renders dry .198-.261 — it's a synthwave night-drive, not a dubstep cavern .30-.35)
    /* genre-tool:prelude:targets */
    prelude:  { bpm:[56,87,3], drumDensity:[0,0.4,3], acoustic:[0.66,1,3], humanize:[0,0.275,3], rubato:[0.001,0.035,2], motion:[0.487,1,1], wash:[0.026,0.359,1], swing:[0,0.071,1], leadVoices:[1,2,3] },
    /* /genre-tool:prelude:targets */
    // fugue — the "Prelude and Fugue" pair: same Bach room as prelude (drumless,
    // harpsichord/organ acoustic, slow-major harmony), but the FUGUE is imitative
    // COUNTERPOINT — 3-4 interweaving voices at a STEADY tempo. Three structural
    // fences hold it distinct from prelude (both directions, so the matrix stays
    // diagonal-dominant): leadVoices [3,5] weight 3 (fugue renders 3-4 vs prelude's
    // single 1-2 arpeggiating line — THE contrapuntal-density axis, mirrored by
    // prelude's new leadVoices [1,2] cap); bpm [88,106] (fugue is the quicker,
    // driving movement — renders ~90-104, above prelude's own 79 ceiling and its
    // [56,87] target); and rubato [0,0.005] (the fugue is METRONOMIC — renders 0,
    // while prelude always breathes at .01-.025, so prelude fails this cap hard).
    fugue:    { bpm:[88,106,3], leadVoices:[3,5,3], drumDensity:[0,0.4,3], acoustic:[0.66,1,3], rubato:[0,0.005,2], motion:[0.85,1,1], humanize:[0,0.12,1], swing:[0,0.05,1] },
    // ======== 2026-07 GENRE-EXPANSION targets (fences designed against measured renders; see genre-kernel) ========
    // dnb: the amen polished — sub + smooth pad wash at 172, breakUse LOW (no chopped-amen role), which is precisely what fences it off jungle's breakUse[.35,1] floor
    dnb:      { bpm:[168,178,3], sub:[.6,1,2], breakUse:[0,.12,2], wash:[.18,.34,2], hatDensity:[.7,1.25,1], drumDensity:[1.6,2.6,1], snareBalance:[.3,1,1], comp:[.25,.55,1], swing:[0,.06,1], pump:[0,.2,1] },
    // footwork: 808 sub + chopped vocal (chopUse) triplet at ~160, dry — chopUse floor + sub floor fence it off jungle/chickadeecore/towncrier
    footwork: { bpm:[153,164,3], chopUse:[.4,.8,2], sub:[.6,1,2], swing:[.05,.2,1], hatDensity:[.9,2,1], drumDensity:[1.8,3.2,1], wash:[0,.18,2], pump:[.05,.4,1], snareBalance:[.3,.95,1], breakUse:[0,.1,1] },
    // happyhardcore: euphoric 4/4 at 172 — high harmonic MOTION + supersaw leadVoices + pump, the axes gabber (drone/no-lead) structurally lacks
    happyhardcore:{ bpm:[166,178,3], motion:[.7,1,2], pump:[.35,.72,2], leadVoices:[3,7,2], comp:[.4,.75,1], snareBalance:[.2,.7,1], seventh:[0,1,1], chopUse:[0,.15,1], swing:[0,.07,1], hatDensity:[.6,1.85,1] },
    // hardstyle: the reverse-bass stomp at 150 — hard SUB + high PUMP in a 148-156 band; sub+pump floors fence chickadeecore/trance, bpm fences gabber's slower hammer
    hardstyle:{ bpm:[147,158,3], pump:[.45,.8,2], sub:[.6,1,2], leadVoices:[3,7,1], comp:[.45,.78,1], snareBalance:[.2,.6,1], motion:[.4,1,1], swing:[0,.05,2], crackle:[0,.08,1], seventh:[.4,1,1] },
    // eurodance: pop-rave at 140 — the M1 house-piano/organ pad reads ACOUSTIC (all-synth trance/edm cannot), and pump sits BELOW trance's .3 floor
    eurodance:{ bpm:[137,147,3], acoustic:[.4,.85,2], motion:[.6,1,2], pump:[.02,.3,2], leadVoices:[4,7,2], comp:[.3,.6,1], wash:[.05,.28,1], swing:[0,.07,1], sub:[0,.8,1], seventh:[0,.75,1] },   // leadVoices floor 4 (renders 4-6) is the fence vs surfrock's 1-2-voice twang at the top of surfrock's tempo range
    // singeli: 200+ BPM Tanzanian loop music — the bpm floor alone is nearly a fence (only breakcore reaches here, and it needs the amen); chopUse is the vocal loop
    singeli:  { bpm:[196,218,3], chopUse:[.4,.8,2], hatDensity:[.7,2,1], drumDensity:[1.4,2.8,1], sub:[0,.8,1], comp:[.35,.7,1], wash:[0,.2,1], pump:[.1,.5,1], swing:[0,.07,1], seventh:[.3,1,1], breakUse:[0,.1,1] },
    // bebop: 220bpm swung acoustic jazz — bpm floor 194 fences it clean off jazz's [96,148]; swing+acoustic+seventh fence the same-tempo electronic singeli/breakcore
    bebop:    { bpm:[194,222,3], swing:[.26,.5,3], acoustic:[.4,1,2], seventh:[.55,1,2], snareBalance:[.4,1.4,1], hatDensity:[.45,1,1], motion:[.5,1,1], crackle:[0,.45,1], pump:[0,.06,1] },
    // bluegrass: banjo+fiddle at 165 — acoustic(w3) + straight-major (seventh low, swing low) + bpm floor 155 fences surfrock (slower) and bebop (swung, 7th-high)
    bluegrass:{ bpm:[155,172,3], acoustic:[.5,1,3], crackle:[.1,.45,2], swing:[.02,.16,2], seventh:[0,.7,2], drumDensity:[1.1,2,1], hatDensity:[.4,1,1], comp:[.1,.4,1], pump:[0,.06,1], wash:[0,.2,1] },
    // ska: 2-tone brass skank at 152 — acoustic(w3) + a THINNER kit (lower drum/hat density) than surfrock's fuller twang, in a 146-158 band above surfrock's cap
    ska:      { bpm:[146,158,3], acoustic:[.5,.95,3], swing:[.03,.16,2], seventh:[0,.85,1], drumDensity:[.9,1.9,2], hatDensity:[.35,1,1], crackle:[.05,.3,1], motion:[.5,1,1], pump:[0,.12,1], leadVoices:[1,3,1] },
    // klezmer: clarinet freylekhs at 140 — acoustic(w3) + a single ORNAMENTED voice (leadVoices[1,1]) + crackle, in a 131-146 band above arabpop's slower hijaz
    klezmer:  { bpm:[131,146,3], acoustic:[.5,1,3], crackle:[.1,.4,2], seventh:[.3,1,1], swing:[.03,.16,2], leadVoices:[1,1,2], drumDensity:[.9,1.9,1], hatDensity:[.35,1.3,1], motion:[.4,1,1], pump:[0,.1,1] },
    // funk: clavinet + horn CHOPS at 108 — chopUse fences four-on-floor disco (which forbids chops), acoustic(w3) + DRY wash + seventh the rest of the identity
    funk:     { bpm:[100,116,3], acoustic:[.4,.9,3], chopUse:[.35,.65,2], seventh:[.6,1,2], swing:[.02,.16,1], wash:[0,.18,2], comp:[.25,.6,1], hatDensity:[.4,1.4,1], pump:[0,.2,1], snareBalance:[.3,1.1,1] },
    // boombap: hard dusty break at 92 — breakUse + FORWARD snare + crackle + BRIGHT (softTop 0) fence the slower tape-dark lofi/triphop and the drumless faxbossa/lunapolka
    boombap:  { bpm:[86,98,3], breakUse:[.3,.8,2], snareBalance:[.55,1.2,2], crackle:[.2,.5,2], swing:[.08,.28,1], seventh:[.5,1,1], sub:[.5,1,1], softTop:[0,0,1], drumDensity:[.8,1.8,1], wash:[.08,.3,1], motion:[.4,1,1] },
    // amapiano: log-drum sub + jazzy 7ths + shaker hats at 112 — the bpm CAP 116 fences it under deephouse's [118,124], and the rhodes reads acoustic (deephouse is synth)
    amapiano: { bpm:[106,116,3], sub:[.6,1,2], acoustic:[.4,1,2], seventh:[.8,1,1], swing:[.08,.22,2], hatDensity:[.7,1.9,1], snareBalance:[0,.6,1], pump:[.1,.4,1], wash:[.12,.35,1], motion:[.3,1,1], drumDensity:[1.3,2.9,1] },
    // reggae: one-drop organ skank at 75 — motion(w2) + acoustic organ + DRY wash fence dub's static dubbed-out drone; sub + bpm hold the low end
    reggae:   { bpm:[68,82,3], acoustic:[.4,.9,2], motion:[.5,1,2], sub:[.5,1,2], swing:[.02,.16,1], wash:[.05,.28,2], drumDensity:[.4,1.7,1], seventh:[0,1,1], crackle:[.05,.3,1], hatDensity:[.1,.9,1], pump:[0,.1,1] },
    // heavymetal: distorted electric-guitar wall — acoustic(w3, the guitar sampler) + high COMP at 140; the acoustic floor fences the all-synth dubstep/chiptune/gabber/industrialmetal, comp+bpm fence the clean surfrock
    heavymetal:{ bpm:[128,150,3], acoustic:[.5,.95,3], comp:[.45,.9,2], breakUse:[0,.15,2], drumDensity:[1,2.4,1], snareBalance:[.25,1.1,1], crackle:[0,.12,1], motion:[.4,1,1], seventh:[.3,1,1], swing:[0,.06,1], pump:[0,.35,1], sub:[.1,1,1] },   // breakUse cap fences the amen-carrying budstep (same guitar-acoustic, but budstep is a break genre)
    // budstep: amen breakUse(w3) + guitar-wall acoustic(w2) + sub drone(w2) at 140 — a triple no other genre carries (jungle/breakcore lack the guitar, dubstep lacks the break, sludgemetal lacks both)
    budstep:  { bpm:[136,148,3], breakUse:[.35,.9,3], acoustic:[.5,.95,2], sub:[.5,1,2], comp:[.4,.9,1], drumDensity:[1.4,3,1], crackle:[0,.28,1], swing:[0,.12,1], wash:[.08,.32,1], seventh:[.3,1,1] },
    // pixiewave: juno-family indie synth-rock — leadVoices(w2, the 2-4-voice juno, NOT synthwave's supersaw choir) + a WET chorus-verb wash + a 130s tempo above dancepop's cap
    pixiewave:{ bpm:[129,139,3], leadVoices:[2,4,2], wash:[.28,.46,2], pump:[0,.24,1], acoustic:[0,.3,1], comp:[.25,.6,1], motion:[.4,1,1], snareBalance:[.3,.95,1], sub:[0,1,1] },
    /* genre-tool:hogcore:targets */
    hogcore:  { bpm:[143,172,3], chopUse:[0.47,0.67,3], pump:[0.503,0.926,2], swing:[0,0.071,2], breakUse:[0,0.08,1], comp:[0.282,0.747,1], crackle:[0,0.1,1], seventh:[0,0.15,1] },
    /* /genre-tool:hogcore:targets */
    /* genre-tool:atlantidrone:targets */
    atlantidrone:{ bpm:[46,69,3], drumDensity:[0,0.4,3], wash:[0.173,0.549,3], motion:[0,0.513,2], sub:[0.41,1,1], acoustic:[0,0.78,1] },
    /* /genre-tool:atlantidrone:targets */
    /* genre-tool:sourdough:targets */
    sourdough:{ bpm:[49,71,3], drumDensity:[0,0.4,3], motion:[0,0.513,2], wash:[0.137,0.521,2], sub:[0.41,1,1], crackle:[0,0.283,1], bedUse:[0.88,1,3] },
    /* /genre-tool:sourdough:targets */
    /* genre-tool:crtwave:targets */
    crtwave:  { bpm:[53,80,3], drumDensity:[0,0.598,2], wash:[0.097,0.454,2], crackle:[0.039,0.404,2], sub:[0.41,1,1], motion:[0,0.513,1], bedUse:[0.88,1,3] },
    /* /genre-tool:crtwave:targets */
    /* genre-tool:whalejazz:targets */
    whalejazz:{ bpm:[53,80,3], acoustic:[0,0.78,3], swing:[0.072,0.224,2], seventh:[0.85,1,2], drumDensity:[0,1.144,1], wash:[0.114,0.459,1], bedUse:[0.88,1,3] },
    /* /genre-tool:whalejazz:targets */
    /* genre-tool:termswave:targets */
    termswave:{ bpm:[53,82,3], drumDensity:[0,0.4,3], motion:[0,1,2], wash:[0.122,0.487,2], sub:[0,1,1], acoustic:[0,0.12,1], humanize:[0,0.229,1], bedUse:[0.88,1,3] },
    /* /genre-tool:termswave:targets */
    /* genre-tool:microwave:targets */
    microwave:{ bpm:[59,86,3], drumDensity:[0,0.4,2], acoustic:[0,0.12,3], wash:[0.102,0.478,2], motion:[0.487,1,1], humanize:[0,0.239,1] },
    /* /genre-tool:microwave:targets */
    /* genre-tool:airtrafficdrone:targets */
    airtrafficdrone:{ bpm:[63,92,3], drumDensity:[0,0.609,3], wash:[0.097,0.454,2], motion:[0,1,2], sub:[0,1,1], humanize:[0,0.204,1], acoustic:[0,0.12,3], bedUse:[0.88,1,3] },
    /* /genre-tool:airtrafficdrone:targets */
    /* genre-tool:faxbossa:targets */
    faxbossa: { bpm:[67,94,3], acoustic:[0,0.78,3], swing:[0.032,0.184,2], seventh:[0.85,1,2], drumDensity:[0.809,2.341,1], motion:[0.487,1,1], softTop:[0,0,3] },
    /* /genre-tool:faxbossa:targets */
    /* genre-tool:crickettempo:targets */
    crickettempo:{ bpm:[69,98,3], acoustic:[0,0.12,2], drumDensity:[0,1.029,2], wash:[0.074,0.338,2], motion:[0.85,1,1], swing:[0,0.131,1], softTop:[0,0,3], bedUse:[0.88,1,2] },
    /* /genre-tool:crickettempo:targets */
    /* genre-tool:thermostatwave:targets */
    thermostatwave:{ bpm:[77,104,3], drumDensity:[0,0.587,3], motion:[0,0.513,2], wash:[0.052,0.384,2], sub:[0,1,1], humanize:[0,0.185,1] },
    /* /genre-tool:thermostatwave:targets */
    /* genre-tool:holdmusic:targets */
    holdmusic:{ bpm:[89,116,3], swing:[0.031,0.171,3], motion:[0.487,1,2], seventh:[0.85,1,2], drumDensity:[0,1.126,2], wash:[0.078,0.359,1], acoustic:[0,0.78,2], bedUse:[0.88,1,3] },
    /* /genre-tool:holdmusic:targets */
    /* genre-tool:lunapolka:targets */
    lunapolka:{ bpm:[89,116,3], swing:[0.032,0.184,2], acoustic:[0,0.12,2], wash:[0.112,0.399,2], motion:[0.85,1,1], drumDensity:[0.263,2.347,1] },
    /* /genre-tool:lunapolka:targets */
    /* genre-tool:elevatorcore:targets */
    elevatorcore:{ bpm:[93,120,3], swing:[0.051,0.191,2], acoustic:[0,0.12,3], seventh:[0,1,2], motion:[0.85,1,2], drumDensity:[0.857,2.053,1], bedUse:[0.51,0.75,3] },
    /* /genre-tool:elevatorcore:targets */
    /* genre-tool:hotsaucecore:targets */
    hotsaucecore:{ bpm:[93,123,3], motion:[0.113,1,2], snareBalance:[0,0.761,3], hatDensity:[0.025,1.725,1], chopUse:[0.4,0.6,1], seventh:[0.3,1,1], sub:[0.05,0.35,3], pump:[0.181,0.652,3] },
    /* /genre-tool:hotsaucecore:targets */
    /* genre-tool:ikeacore:targets */
    ikeacore: { bpm:[110,131,3], hatDensity:[0.232,1.848,2], motion:[0,0.887,2], chopUse:[0.53,0.73,2], drumDensity:[0.977,2.893,1], pump:[0.27,0.646,1], swing:[0,0.077,3] },
    /* /genre-tool:ikeacore:targets */
    /* genre-tool:zubrovia:targets */
    zubrovia: { bpm:[105,134,3], bedUse:[0.71,0.95,3], pump:[0,0.159,3], swing:[0,0.091,2], wash:[0.05,0.346,2], acoustic:[0,0.12,3] },
    /* /genre-tool:zubrovia:targets */
    /* genre-tool:dishwasherwave:targets */
    dishwasherwave:{ bpm:[114,133,3], chopUse:[0,0.1,3], bedUse:[0.63,0.87,3], pump:[0.374,0.775,2], hatDensity:[0.651,2.159,1], motion:[0,0.513,1] },
    /* /genre-tool:dishwasherwave:targets */
    /* genre-tool:surveywave:targets */
    surveywave:{ bpm:[112,133,3], pump:[0.343,0.725,2], chopUse:[0.4,0.6,2], snareBalance:[0.045,0.625,2], motion:[0.85,1,1], seventh:[0,1,1] },
    /* /genre-tool:surveywave:targets */
    /* genre-tool:aldente:targets */
    aldente:  { bpm:[116,135,3], motion:[0,0.513,3], pump:[0.322,0.715,3], snareBalance:[0,0.544,2], swing:[0,0.077,2], chopUse:[0,0.1,2], bedUse:[0.63,0.87,1], drumDensity:[1.32,2.6,3] },
    /* /genre-tool:aldente:targets */
    /* genre-tool:umpirehouse:targets */
    umpirehouse:{ bpm:[116,135,3], pump:[0.355,0.724,2], motion:[0.487,1,2], chopUse:[0.4,0.6,2], snareBalance:[0.114,0.586,1], seventh:[0,1,1] },
    /* /genre-tool:umpirehouse:targets */
    /* genre-tool:pigeonstep:targets */
    pigeonstep:{ bpm:[122,141,3], swing:[0.071,0.211,3], snareBalance:[0.039,0.931,2], hatDensity:[0.563,1.567,2], motion:[0.487,1,1], sub:[0.85,1,1], acoustic:[0.48,0.72,3] },
    /* /genre-tool:pigeonstep:targets */
    /* genre-tool:dmvstep:targets */
    dmvstep:  { bpm:[124,143,3], swing:[0.091,0.231,3], chopUse:[0.4,0.6,2], snareBalance:[0.083,0.807,2], hatDensity:[0.496,1.584,2], pump:[0.27,0.646,1], sub:[0,1,1] },
    /* /genre-tool:dmvstep:targets */
    /* genre-tool:towncrier:targets */
    towncrier:{ bpm:[132,153,3], sub:[0,1,2], snareBalance:[0.04,1.28,2], pump:[0.287,0.736,2], motion:[0,1,1], hatDensity:[0,1.662,1], chopUse:[0.47,0.67,3], acoustic:[0,0.12,3], swing:[0,0.091,3], leadVoices:[1,4,3] },
    /* /genre-tool:towncrier:targets */
    /* genre-tool:chickadeecore:targets */
    chickadeecore:{ bpm:[134,157,3], hatDensity:[0.235,1.935,2], snareBalance:[0.12,0.88,2], seventh:[0,1,1], motion:[0.85,1,1], pump:[0.188,0.615,1], crackle:[0,0.1,3] },
    /* /genre-tool:chickadeecore:targets */
    /* genre-tool:floppycore:targets */
    floppycore:{ bpm:[135,165,3], breakUse:[0.55,0.71,2], hatDensity:[0.351,2.219,2], chopUse:[0,0.1,2], snareBalance:[0.178,1.082,1], motion:[0.113,1,1], pump:[0.226,0.645,3] },
    /* /genre-tool:floppycore:targets */
    /* genre-tool:cerealwave:targets */
    cerealwave:{ bpm:[149,172,3], crackle:[0.282,0.822,3], pump:[0.449,0.855,2], chopUse:[0.47,0.67,2], hatDensity:[0,1.199,1], snareBalance:[0.026,0.594,1] },
    /* /genre-tool:cerealwave:targets */
    /* genre-tool:laundrycore:targets */
    laundrycore:{ bpm:[162,181,3], breakUse:[0.49,0.65,3], snareBalance:[0.109,1.121,2], sub:[0.85,1,2], chopUse:[0,0.1,1], hatDensity:[0.019,0.951,1], pump:[0.22,0.596,3] },
    /* /genre-tool:laundrycore:targets */
    /* genre-tool:auctioncore:targets */
    auctioncore:{ bpm:[162,185,3], breakUse:[0.49,0.65,3], snareBalance:[0.131,1.239,2], hatDensity:[0.039,0.971,1], chopUse:[0,0.1,1], pump:[0.276,0.695,1] },
    /* /genre-tool:auctioncore:targets */
    /* genre-tool:dialupgabber:targets */
    dialupgabber:{ bpm:[174,197,3], pump:[0.476,0.895,3], crackle:[0.039,0.404,2], chopUse:[0.47,0.67,2], snareBalance:[0.017,0.813,1], hatDensity:[0,1.291,1] },
    /* /genre-tool:dialupgabber:targets */
    /* genre-tool:picnicswing:targets */
    picnicswing:{ bpm:[139,160,3], softTop:[1,1,3], breakUse:[0,0.08,3], offgrid:[0.29,0.54,2], crackle:[0.079,0.456,2], wash:[0.034,0.371,1], acoustic:[0,1,1], swing:[0.161,0.295,1] },
    /* /genre-tool:picnicswing:targets */
    /* genre-tool:cerealboxwave:targets */
    cerealboxwave:{ bpm:[98,119,3], bedUse:[0.88,1,3], pump:[0.076,0.524,3], variation:[0,0.12,2], seventh:[0,1,2], wash:[0,0.226,1], acoustic:[0.48,0.72,1], swing:[0,0.081,1] },
    /* /genre-tool:cerealboxwave:targets */
    /* genre-tool:rosinamblelilt:targets */
    rosinamblelilt:{ bpm:[88,109,3], rubato:[0,0.029,3], variation:[0,1,3], softTop:[0,0,2], motion:[0.85,1,2], wash:[0.351,0.623,1], acoustic:[0.456,0.944,1], swing:[0.121,0.255,1] },
    /* /genre-tool:rosinamblelilt:targets */
    /* genre-tool:subwooferbalm:targets */
    subwooferbalm:{ bpm:[70,91,3], softTop:[1,1,3], drumDensity:[0,2.6,3], hatDensity:[0,1.857,2], motion:[0.52,0.82,2], wash:[0.198,0.575,1], acoustic:[0,1,1], swing:[0,0.084,1] },
    /* /genre-tool:subwooferbalm:targets */
    /* genre-tool:sepiadrive:targets */
    sepiadrive:{ bpm:[126,147,3], softTop:[1,1,3], chopUse:[0.4,0.6,3], acoustic:[0,1,2], humanize:[0,0.202,2], wash:[0.002,0.312,1], swing:[0,0.128,1] },
    /* /genre-tool:sepiadrive:targets */
    /* genre-tool:sparkbreak:targets */
    sparkbreak:{ bpm:[121,142,3], comp:[0.095,0.578,3], variation:[0.779,1,3], bedUse:[0.02,0.26,2], acoustic:[0,0.792,2], wash:[0.002,0.253,1], swing:[0,0.086,1], breakUse:[0.49,0.65,3] },
    /* /genre-tool:sparkbreak:targets */
    /* genre-tool:hopscotchwave:targets */
    hopscotchwave:{ bpm:[97,118,3], variation:[0.824,1,3], crackle:[0.249,0.598,3], softTop:[0,0,2], chopUse:[0,0.1,2], wash:[0.11,0.403,1], acoustic:[0,0.792,1], swing:[0,0.118,1] },
    /* /genre-tool:hopscotchwave:targets */
    /* genre-tool:moltenhouse:targets */
    moltenhouse:{ bpm:[109,130,3], chopUse:[0.53,0.73,3], variation:[0.824,1,3], snareBalance:[0.09,1.01,2], bedUse:[0.01,0.25,2], wash:[0.089,0.446,1], acoustic:[0,1,1], swing:[0,0.125,1], sub:[0.85,1,3] },
    /* /genre-tool:moltenhouse:targets */
    /* genre-tool:magmastrut:targets */
    magmastrut:{ bpm:[91,112,3], bedUse:[0.88,1,3], softTop:[1,1,3], chopUse:[0,0.1,2], drumDensity:[0,0.658,2], wash:[0.146,0.509,1], acoustic:[0,1,1], swing:[0,0.107,1] },
    /* /genre-tool:magmastrut:targets */
    /* genre-tool:hammerhouse:targets */
    hammerhouse:{ bpm:[113,134,3], rubato:[0,0.02,3], bedUse:[0.01,0.25,3], offgrid:[0,0.327,2], seventh:[0,1,2], wash:[0.016,0.326,1], acoustic:[0,0.792,1], swing:[0,0.094,1], pump:[0.262,0.636,3], chopUse:[0.4,0.6,3], drumDensity:[0,1.583,3] },
    /* /genre-tool:hammerhouse:targets */
    /* genre-tool:zestgallop:targets */
    zestgallop:{ bpm:[134,155,3], softTop:[0,0,3], crackle:[0,0.328,3], breakUse:[0.42,0.58,2], sub:[0.002,0.798,2], wash:[0.046,0.325,1], acoustic:[0,1,1], swing:[0.107,0.241,1] },
    /* /genre-tool:zestgallop:targets */
    /* genre-tool:whittlertrot:targets */
    whittlertrot:{ bpm:[89,110,3], rubato:[0,0.026,3], chopUse:[0,0.1,3], sub:[0.002,0.798,2], offgrid:[0,0.636,2], wash:[0.077,0.34,1], acoustic:[0.456,0.944,1], swing:[0,0.101,1], seventh:[0.85,1,3], softTop:[0,0,3], crackle:[0,0.293,3] },
    /* /genre-tool:whittlertrot:targets */
    /* genre-tool:bunkerthump:targets */
    bunkerthump:{ bpm:[117,138,3], bedUse:[0.01,0.25,3], breakUse:[0.55,0.71,3], leadVoices:[1,6,2], wash:[0.087,0.41,2], acoustic:[0,1,1], swing:[0,0.098,1], drumDensity:[2.146,4.334,3] },
    /* /genre-tool:bunkerthump:targets */
    /* genre-tool:gumballdrive:targets */
    gumballdrive:{ bpm:[113,134,3], breakUse:[0.42,0.58,3], chopUse:[0,0.1,3], variation:[0,1,2], bedUse:[0.01,0.25,2], wash:[0.09,0.425,1], acoustic:[0,0.792,1], swing:[0,0.125,1], comp:[0.086,0.45,3], sub:[0.402,1,3] },
    /* /genre-tool:gumballdrive:targets */
    /* genre-tool:kettlefunk:targets */
    kettlefunk:{ bpm:[94,115,3], softTop:[0,0,3], seventh:[0,1,3], offgrid:[0.057,0.37,2], motion:[0.85,1,2], wash:[0.326,0.667,1], acoustic:[0,1,1], swing:[0.13,0.264,1] },
    /* /genre-tool:kettlefunk:targets */
    /* genre-tool:glosspump:targets */
    glosspump:{ bpm:[118,139,3], crackle:[0.133,0.49,3], softTop:[0,0,3], bedUse:[0.02,0.26,2], breakUse:[0.49,0.65,2], wash:[0.049,0.366,1], acoustic:[0,1,1], swing:[0,0.116,1], sub:[0.85,1,3] },
    /* /genre-tool:glosspump:targets */
    /* genre-tool:refrigeratorfunk:targets */
    refrigeratorfunk:{ bpm:[98,119,3], pump:[0.088,0.524,3], variation:[0,0.12,3], bedUse:[0.88,1,2], chopUse:[0,0.1,2], wash:[0.306,0.631,1], acoustic:[0,1,1], swing:[0,0.088,1] },
    /* /genre-tool:refrigeratorfunk:targets */
    /* genre-tool:sherbetchop:targets */
    sherbetchop:{ bpm:[127,148,3], softTop:[0,0,3], chopUse:[0.4,0.6,3], breakUse:[0,0.08,2], acoustic:[0,0.792,2], wash:[0.042,0.304,1], swing:[0.05,0.184,1], crackle:[0.179,0.528,3] },
    /* /genre-tool:sherbetchop:targets */
    /* genre-tool:pinballchop:targets */
    pinballchop:{ bpm:[103,124,3], variation:[0.835,1,3], breakUse:[0.42,0.58,3], sub:[0.002,0.798,2], chopUse:[0,0.1,2], wash:[0.023,0.324,1], acoustic:[0,0.792,1], swing:[0,0.115,1] },
    /* /genre-tool:pinballchop:targets */
    /* genre-tool:idlingsplice:targets */
    idlingsplice:{ bpm:[84,105,3], breakUse:[0.55,0.71,3], softTop:[0,0,3], wash:[0.292,0.625,2], bedUse:[0.01,0.25,2], acoustic:[0,1,1], swing:[0,0.107,1] },
    /* /genre-tool:idlingsplice:targets */
    /* genre-tool:trenchsway:targets */
    trenchsway:{ bpm:[69,90,3], softTop:[0,0,3], variation:[0.746,1,3], motion:[0.85,1,2], rubato:[0,0.008,2], wash:[0.3,0.647,1], acoustic:[0,1,1], swing:[0,0.091,1] },
    /* /genre-tool:trenchsway:targets */
    /* genre-tool:tarbreak:targets */
    tarbreak: { bpm:[139,160,3], softTop:[1,1,3], bedUse:[0.01,0.25,3], chopUse:[0.4,0.6,2], hatDensity:[0.228,1.152,2], wash:[0.14,0.482,1], acoustic:[0,1,1], swing:[0,0.089,1] },
    /* /genre-tool:tarbreak:targets */
    /* genre-tool:cedarskank:targets */
    cedarskank:{ bpm:[112,133,3], seventh:[0,1,3], softTop:[1,1,3], acoustic:[0,1,2], motion:[0.85,1,2], wash:[0.006,0.267,1], swing:[0.148,0.282,1] },
    /* /genre-tool:cedarskank:targets */
    /* genre-tool:bramblestep:targets */
    bramblestep:{ bpm:[68,89,3], softTop:[1,1,3], snareBalance:[0.025,0.785,3], breakUse:[0,0.08,2], sub:[0.002,0.798,2], wash:[0.121,0.487,1], acoustic:[0,1,1], swing:[0.121,0.255,1] },
    /* /genre-tool:bramblestep:targets */
    /* genre-tool:toastercore:targets */
    toastercore:{ bpm:[181,202,3], softTop:[0,0,3], chopUse:[0.4,0.6,3], sub:[0.002,0.798,2], breakUse:[0,0.08,2], wash:[0.015,0.335,1], acoustic:[0,1,1], swing:[0.036,0.17,1] },
    /* /genre-tool:toastercore:targets */
    /* genre-tool:vendingmachinethump:targets */
    vendingmachinethump:{ bpm:[113,134,3], variation:[0,1,3], softTop:[0,0,3], chopUse:[0,0.1,2], sub:[0.002,0.798,2], wash:[0.008,0.299,1], acoustic:[0,1,1], swing:[0,0.083,1], drumDensity:[0,0.904,3], humanize:[0,0.208,3] },
    /* /genre-tool:vendingmachinethump:targets */
    /* genre-tool:boilercreep:targets */
    boilercreep:{ bpm:[59,80,3], variation:[0,1,3], softTop:[0,0,3], motion:[0.1,1,2], leadVoices:[1,4,2], wash:[0.032,0.304,1], acoustic:[0.48,0.72,1], swing:[0,0.123,1] },
    /* /genre-tool:boilercreep:targets */
    /* genre-tool:fluorescentstrut:targets */
    fluorescentstrut:{ bpm:[103,124,3], chopUse:[0.47,0.67,3], softTop:[0,0,3], sub:[0.002,0.798,2], bedUse:[0.02,0.26,2], wash:[0.215,0.597,1], acoustic:[0,0.792,1], swing:[0,0.089,1] },
    /* /genre-tool:fluorescentstrut:targets */
    /* genre-tool:dialtonehaze:targets */
    dialtonehaze:{ bpm:[63,84,3], bedUse:[0.656,1,3], softTop:[0,0,3], breakUse:[0,0.08,2], crackle:[0.119,0.468,2], wash:[0.163,0.483,1], acoustic:[0,0.792,1], swing:[0.041,0.175,1] },
    /* /genre-tool:dialtonehaze:targets */
    /* genre-tool:breadboxmince:targets */
    breadboxmince:{ bpm:[94,115,3], breakUse:[0,0.08,3], offgrid:[0,0.422,3], chopUse:[0,0.1,2], motion:[0.48,1,2], wash:[0.189,0.44,1], acoustic:[0.456,0.944,1], swing:[0.007,0.141,1], seventh:[0.85,1,3], softTop:[0,0,3] },
    /* /genre-tool:breadboxmince:targets */
    /* genre-tool:earthmoversplice:targets */
    earthmoversplice:{ bpm:[109,130,3], chopUse:[0,0.1,3], breakUse:[0.42,0.58,3], humanize:[0.065,0.346,2], seventh:[0.57,1,2], wash:[0,0.276,1], acoustic:[0,1,1], swing:[0,0.114,1], softTop:[1,1,3] },
    /* /genre-tool:earthmoversplice:targets */
    /* genre-tool:butterchurnbounce:targets */
    butterchurnbounce:{ bpm:[111,132,3], softTop:[1,1,3], variation:[0,1,3], hatDensity:[0,0.557,2], drumDensity:[0,0.904,2], wash:[0.06,0.343,1], acoustic:[0,1,1], swing:[0.151,0.285,1] },
    /* /genre-tool:butterchurnbounce:targets */
    /* genre-tool:furnacestrut:targets */
    furnacestrut:{ bpm:[86,107,3], variation:[0,1,3], breakUse:[0,0.08,3], bedUse:[0.88,1,2], rubato:[0,0.008,2], wash:[0.408,0.754,1], acoustic:[0,1,1], swing:[0,0.097,1] },
    /* /genre-tool:furnacestrut:targets */
    /* genre-tool:tectonicdash:targets */
    tectonicdash:{ bpm:[132,153,3], softTop:[0,0,3], sub:[0.85,1,3], bedUse:[0.51,0.75,2], chopUse:[0,0.1,2], wash:[0.076,0.428,1], acoustic:[0,1,1], swing:[0.187,0.321,1] },
    /* /genre-tool:tectonicdash:targets */
    /* genre-tool:tundradoom:targets */
    tundradoom:{ bpm:[45,66,3], rubato:[0,0.029,3], sub:[0.002,0.798,3], seventh:[0,1,2], wash:[0.179,0.554,2], acoustic:[0,1,1], swing:[0,0.108,1] },
    /* /genre-tool:tundradoom:targets */
    /* genre-tool:sodabop:targets */
    sodabop:  { bpm:[82,103,3], variation:[0,1,3], chopUse:[0,0.1,3], rubato:[0,0.008,2], sub:[0.002,0.798,2], wash:[0,0.228,1], acoustic:[0.456,0.944,1], swing:[0,0.083,1] },
    /* /genre-tool:sodabop:targets */
    /* genre-tool:citrushaze:targets */
    citrushaze:{ bpm:[78,99,3], bedUse:[0.88,1,3], softTop:[0,0,3], breakUse:[0,0.08,2], drumDensity:[0,0.579,2], wash:[0.125,0.482,1], acoustic:[0,0.792,1], swing:[0,0.097,1], seventh:[0.85,1,3], snareBalance:[0,0.525,3], comp:[0,0.252,3] },
    /* /genre-tool:citrushaze:targets */
    /* genre-tool:confettililt:targets */
    confettililt:{ bpm:[82,103,3], motion:[0,1,3], humanize:[0.17,0.451,3], softTop:[0,0,2], chopUse:[0,0.1,2], wash:[0.169,0.432,1], acoustic:[0,0.792,1], swing:[0.095,0.229,1], drumDensity:[0.843,2.127,3] },
    /* /genre-tool:confettililt:targets */
    /* genre-tool:willowmarch:targets */
    willowmarch:{ bpm:[111,132,3], chopUse:[0.4,0.6,3], softTop:[0,0,3], bedUse:[0.01,0.25,2], acoustic:[0,1,2], wash:[0.118,0.481,1], swing:[0.11,0.244,1] },
    /* /genre-tool:willowmarch:targets */
    /* genre-tool:standbylightdrive:targets */
    standbylightdrive:{ bpm:[124,145,3], variation:[0,0.12,3], bedUse:[0.88,1,3], chopUse:[0,0.1,2], acoustic:[0,0.792,2], wash:[0,0.231,1], swing:[0,0.083,1] },
    /* /genre-tool:standbylightdrive:targets */
    /* genre-tool:cairntrot:targets */
    cairntrot:{ bpm:[99,120,3], softTop:[0,0,3], pump:[0.145,0.588,3], seventh:[0,1,2], wash:[0.188,0.523,2], acoustic:[0,1,1], swing:[0.038,0.172,1], drumDensity:[0,0.87,3], bedUse:[0.51,0.75,3] },
    /* /genre-tool:cairntrot:targets */
    /* genre-tool:dumptruckdub:targets */
    dumptruckdub:{ bpm:[76,97,3], softTop:[1,1,3], chopUse:[0,0.1,3], acoustic:[0,1,2], humanize:[0,0.239,2], wash:[0.224,0.593,1], swing:[0,0.12,1], bedUse:[0.51,0.75,3], sub:[0.402,1,3] },
    /* /genre-tool:dumptruckdub:targets */
    /* genre-tool:tallowtrot:targets */
    tallowtrot:{ bpm:[106,127,3], sub:[0,1,3], breakUse:[0.42,0.58,3], softTop:[1,1,2], hatDensity:[0.086,1.544,2], wash:[0.182,0.548,1], acoustic:[0,1,1], swing:[0,0.097,1] },
    /* /genre-tool:tallowtrot:targets */
    /* genre-tool:fathomarch:targets */
    fathomarch:{ bpm:[125,146,3], seventh:[0.29,1,3], humanize:[0.054,0.335,3], wash:[0,0.219,2], softTop:[0,0,2], acoustic:[0,0.12,1], swing:[0,0.105,1], sub:[0.85,1,3], comp:[0.048,0.524,3] },
    /* /genre-tool:fathomarch:targets */
    /* genre-tool:masonshuffle:targets */
    masonshuffle:{ bpm:[89,110,3], softTop:[0,0,3], swing:[0.106,0.24,3], offgrid:[0,0.734,2], humanize:[0.127,0.408,2], wash:[0.006,0.26,1], acoustic:[0.68,0.92,1] },
    /* /genre-tool:masonshuffle:targets */
    /* genre-tool:boilerroomstomp:targets */
    boilerroomstomp:{ bpm:[118,139,3], softTop:[1,1,3], chopUse:[0,0.1,3], wash:[0.151,0.464,2], leadVoices:[1,6,2], acoustic:[0,1,1], swing:[0,0.084,1], crackle:[0,0.246,3] },
    /* /genre-tool:boilerroomstomp:targets */
    /* genre-tool:brinedub:targets */
    brinedub: { bpm:[75,96,3], seventh:[0,1,3], wash:[0.088,0.429,3], acoustic:[0,0.792,2], pump:[0,0.194,2], swing:[0,0.06,1], bedUse:[0.51,0.75,3], snareBalance:[0,0.581,3] },
    /* /genre-tool:brinedub:targets */
    /* genre-tool:attichouse:targets */
    attichouse:{ bpm:[110,131,3], softTop:[1,1,3], seventh:[0.32,0.93,3], breakUse:[0.42,0.58,2], wash:[0.095,0.44,2], acoustic:[0,1,1], swing:[0,0.092,1] },
    /* /genre-tool:attichouse:targets */
    /* genre-tool:driftrot:targets */
    driftrot: { bpm:[83,104,3], softTop:[0,0,3], snareBalance:[0.044,0.916,3], breakUse:[0,0.08,2], swing:[0.03,0.164,2], wash:[0.166,0.473,1], acoustic:[0,0.792,1], bedUse:[0.51,0.75,3], crackle:[0,0.298,3], offgrid:[0,0.382,3], sub:[0.002,0.798,3] },
    /* /genre-tool:driftrot:targets */
    /* genre-tool:ceilingfanchop:targets */
    ceilingfanchop:{ bpm:[153,174,3], drumDensity:[0.967,1.903,3], hatDensity:[0.26,1.16,3], motion:[0.48,1,2], pump:[0.442,0.9,2], wash:[0,0.242,1], acoustic:[0,0.12,1], swing:[0,0.068,1] },
    /* /genre-tool:ceilingfanchop:targets */
    /* genre-tool:strawdub:targets */
    strawdub: { bpm:[73,94,3], acoustic:[0.432,1,3], softTop:[1,1,3], variation:[0.79,1,2], drumDensity:[0,2.34,2], wash:[0.069,0.374,1], swing:[0,0.084,1] },
    /* /genre-tool:strawdub:targets */
    /* genre-tool:porchdice:targets */
    porchdice:{ bpm:[110,131,3], chopUse:[0.4,0.6,3], acoustic:[0.656,1,3], breakUse:[0,0.08,2], drumDensity:[0.85,1.86,2], wash:[0,0.234,1], swing:[0,0.081,1] },
    /* /genre-tool:porchdice:targets */
    /* genre-tool:shellacsplice:targets */
    shellacsplice:{ bpm:[117,138,3], softTop:[0,0,3], acoustic:[0,1,3], sub:[0,1,2], crackle:[0.203,0.56,2], wash:[0,0.288,1], swing:[0.037,0.171,1], breakUse:[0.42,0.58,3], motion:[0.85,1,3] },
    /* /genre-tool:shellacsplice:targets */
    /* genre-tool:gourdscuttle:targets */
    gourdscuttle:{ bpm:[151,172,3], softTop:[0,0,3], pump:[0.185,0.599,3], chopUse:[0,0.1,2], sub:[0.002,0.798,2], wash:[0,0.234,1], acoustic:[0,1,1], swing:[0.002,0.136,1] },
    /* /genre-tool:gourdscuttle:targets */
    /* genre-tool:auroragallop:targets */
    auroragallop:{ bpm:[138,159,3], softTop:[1,1,3], chopUse:[0.4,0.6,3], breakUse:[0,0.08,2], pump:[0.205,0.619,2], wash:[0.06,0.396,1], acoustic:[0,1,1], swing:[0,0.088,1] },
    /* /genre-tool:auroragallop:targets */
    /* genre-tool:atticfanthrashsplice:targets */
    atticfanthrashsplice:{ bpm:[145,166,3], breakUse:[0.42,0.58,3], sub:[0.002,0.798,3], softTop:[1,1,2], chopUse:[0,0.1,2], wash:[0.038,0.302,1], acoustic:[0,1,1], swing:[0.072,0.206,1] },
    /* /genre-tool:atticfanthrashsplice:targets */
    /* genre-tool:obelisktrot:targets */
    obelisktrot:{ bpm:[99,120,3], softTop:[1,1,3], variation:[0,1,3], sub:[0,1,2], drumDensity:[0,0.882,2], wash:[0.003,0.241,1], acoustic:[0.48,0.72,1], swing:[0.069,0.203,1] },
    /* /genre-tool:obelisktrot:targets */
    /* genre-tool:oakdublilt:targets */
    oakdublilt:{ bpm:[74,95,3], rubato:[0,0.028,3], softTop:[1,1,3], swing:[0.121,0.255,2], hatDensity:[0.191,1.599,2], wash:[0.015,0.276,1], acoustic:[0.432,1,1] },
    /* /genre-tool:oakdublilt:targets */
    /* genre-tool:duststrut:targets */
    duststrut:{ bpm:[90,111,3], softTop:[1,1,3], chopUse:[0.4,0.6,3], snareBalance:[0.374,1.976,2], breakUse:[0,0.08,2], wash:[0.03,0.285,1], acoustic:[0,0.792,1], swing:[0.115,0.249,1] },
    /* /genre-tool:duststrut:targets */
    /* genre-tool:reedrush:targets */
    reedrush: { bpm:[135,156,3], softTop:[1,1,3], bedUse:[0.01,0.25,3], chopUse:[0.4,0.6,2], offgrid:[0,0.299,2], wash:[0,0.18,1], acoustic:[0.48,0.72,1], swing:[0.043,0.177,1] },
    /* /genre-tool:reedrush:targets */
    /* genre-tool:hearthsway:targets */
    hearthsway:{ bpm:[60,81,3], softTop:[0,0,3], breakUse:[0,0.08,3], snareBalance:[0,0.924,2], rubato:[0,0.008,2], wash:[0.166,0.538,1], acoustic:[0,1,1], swing:[0.058,0.192,1], bedUse:[0.372,0.698,3], motion:[0.85,1,3] },
    /* /genre-tool:hearthsway:targets */
    /* genre-tool:graingroove:targets */
    graingroove:{ bpm:[90,111,3], softTop:[1,1,3], chopUse:[0.4,0.6,3], crackle:[0.169,0.546,2], bedUse:[0.01,0.25,2], wash:[0.026,0.367,1], acoustic:[0,1,1], swing:[0.068,0.202,1] },
    /* /genre-tool:graingroove:targets */
    /* genre-tool:hvacbop:targets */
    hvacbop:  { bpm:[96,117,3], softTop:[0,0,3], wash:[0.282,0.609,3], chopUse:[0,0.1,2], acoustic:[0,1,2], swing:[0.026,0.16,1], drumDensity:[0,0.904,3], bedUse:[0.51,0.75,3], pump:[0.089,0.536,3], crackle:[0.109,0.458,3] },
    /* /genre-tool:hvacbop:targets */
    /* genre-tool:moldcore:targets */
    moldcore: { bpm:[151,172,3], breakUse:[0,0.08,3], softTop:[1,1,3], crackle:[0.209,0.586,2], pump:[0.235,0.649,2], wash:[0.056,0.391,1], acoustic:[0,1,1], swing:[0.035,0.169,1] },
    /* /genre-tool:moldcore:targets */
    /* genre-tool:hydracore:targets */
    hydracore:{ bpm:[168,189,3], chopUse:[0.4,0.6,3], breakUse:[0,0.08,3], humanize:[0,0.182,2], acoustic:[0,0.792,2], wash:[0.126,0.469,1], swing:[0,0.107,1] },
    /* /genre-tool:hydracore:targets */
    /* genre-tool:ashfunk:targets */
    ashfunk:  { bpm:[89,110,3], softTop:[1,1,3], breakUse:[0.42,0.58,3], acoustic:[0,0.792,2], bedUse:[0.01,0.25,2], wash:[0.022,0.274,1], swing:[0.058,0.192,1] },
    /* /genre-tool:ashfunk:targets */
    /* genre-tool:steamdub:targets */
    steamdub: { bpm:[72,93,3], breakUse:[0,0.08,3], softTop:[1,1,3], bedUse:[0.51,0.75,2], humanize:[0.086,0.367,2], wash:[0.343,0.69,1], acoustic:[0,1,1], swing:[0,0.118,1], comp:[0.315,0.798,3] },
    /* /genre-tool:steamdub:targets */
    /* genre-tool:seraphswing:targets */
    seraphswing:{ bpm:[159,180,3], pump:[0,0.345,3], wash:[0.122,0.481,3], swing:[0.129,0.263,2], chopUse:[0,0.1,2], acoustic:[0,1,1] },
    /* /genre-tool:seraphswing:targets */
  };

  // the piecewise-linear target-row scorer — the shared primitive (genre-tool
  // imports THIS so the two scorers never drift). Returns the RAW 0..100 percent
  // (unrounded, so callers can average before rounding, like genre-tool's
  // meanScore); pushes below-0.65 dims into `notes` when an array is passed.
  function scoreRow(f, T, notes){
    let tw=0, ts=0;
    for(const [k,[lo,hi,w]] of Object.entries(T)){
      const v=f[k]; if(v==null) continue;
      let s;
      if(v>=lo&&v<=hi) s=1;
      else { const width=Math.max(hi-lo,0.001), d=v<lo?lo-v:v-hi; s=Math.max(0,1-d/width); }
      if(notes && s<0.65) notes.push(`${k}=${v} wants [${lo},${hi}]`);
      tw+=w; ts+=w*s;
    }
    return tw ? 100*ts/tw : 0;
  }
  function scoreAgainst(f, genre){
    const T=TARGETS[genre]; if(!T) return {score:0,notes:["unknown genre"]};
    const notes=[];
    return {score:Math.round(scoreRow(f, T, notes)), notes};
  }

  function analyze(state){
    const f=features(state);
    const scores={}; let best=null;
    for(const g of Object.keys(TARGETS)){ scores[g]=scoreAgainst(f,g).score; if(!best||scores[g]>scores[best]) best=g; }
    return {features:f, scores, best};
  }

  function report(state){
    const a=analyze(state);
    const claimed=(state.genreMeta&&state.genreMeta.genres)||[];
    const lines=["genre scores: "+Object.entries(a.scores).sort((x,y)=>y[1]-x[1]).slice(0,4).map(([g,s])=>`${g}:${s}`).join(" ")];
    for(const g of new Set(claimed)){
      const r=scoreAgainst(a.features,g);
      lines.push(`vs ${g}: ${r.score}` + (r.notes.length?`  — ${r.notes.slice(0,4).join("; ")}`:""));
    }
    return lines.join("\n");
  }

  const api={ features, scoreRow, scoreAgainst, analyze, report, TARGETS };
  if(isNode) module.exports=api; else root.GenreVerifier=api;

  if(isNode && require.main===module){
    const fs=require("fs");
    const cmd=process.argv[2];
    if(cmd==="matrix"){
      // matrix speed round (2026-07): features are computed ONCE per
      // (genre,seed) — they never depended on the target column, but the old
      // loop rebuilt track+features per cell (61x the work, ~23s). Rows are
      // sharded across cores via verify-lib fork workers (--serial for the
      // single-process path; both produce byte-identical tables), feature
      // vectors + the whole report are content-address cached under
      // scratch/.verify-cache/ (--no-cache recomputes).
      const L=require("./verify-lib.js");
      const K=require("./genre-kernel.js");
      const args=process.argv.slice(3);
      const genres=Object.keys(TARGETS);
      const SEEDS=[1,2,3];
      const shard=L.shardOf(args);
      const useCache=!args.includes("--no-cache");

      // one confusion-matrix row: mean score of g's tracks vs every target
      const rowOf=(g,feats,fresh)=>{
        const fv=SEEDS.map(seed=>{
          const key=g+":"+seed;
          if(!feats[key]){ feats[key]=features(K.track(g,{seed})); if(fresh) fresh[key]=feats[key]; }
          return feats[key];
        });
        return genres.map(tgt=>{ let s=0; for(const f of fv) s+=scoreAgainst(f,tgt).score; return Math.round(s/SEEDS.length); });
      };

      if(shard){   // worker: strided rows over IPC, no printing
        const feats=useCache?L.loadFeats():{};
        const fresh={}, cells={};
        genres.forEach((g,ix)=>{ if(ix%shard.n===shard.i) cells[g]=rowOf(g,feats,fresh); });
        process.send({cells,fresh},()=>process.exit(0));
      } else {
        if(useCache){ const hit=L.loadRun("matrix",args); if(hit) L.replayRun(hit); }
        const emit=L.tee();
        const printMatrix=(cellsByGenre)=>{
          const rows=[];
          emit("            "+genres.map(g=>g.slice(0,7).padStart(8)).join(""));
          let diagOk=0;
          for(const g of genres){
            const cells=cellsByGenre[g];
            const diag=cells[genres.indexOf(g)];
            const maxOff=Math.max(...cells.filter((_,i)=>i!==genres.indexOf(g)));
            if(diag>=maxOff) diagOk++;
            emit(g.padEnd(11)+(cells.map((c,i)=>String(c).padStart(8-(i===genres.indexOf(g)?1:0))+(i===genres.indexOf(g)?"*":"")).join("")));
            rows.push({g,cells,diag,maxOff});
          }
          emit(`\ndiagonal dominant: ${diagOk}/${genres.length}`);
          for(const r of rows) if(r.diag<r.maxOff)
            emit(`  ✗ ${r.g}: self=${r.diag} < best-other=${r.maxOff} (${genres[r.cells.indexOf(r.maxOff)]})`);
          const code=diagOk===genres.length?0:1;
          if(useCache) L.saveRun("matrix",args,null,{out:emit.text(),code});
          process.exit(code);
        };
        const nJobs=args.includes("--serial")?1:L.jobs(args,genres.length);
        if(nJobs<2){
          const feats=useCache?L.loadFeats():{};
          const fresh={}, cellsByGenre={};
          for(const g of genres) cellsByGenre[g]=rowOf(g,feats,fresh);
          if(useCache) L.saveFeats(fresh);
          printMatrix(cellsByGenre);
        } else {
          L.runShards(__filename,["matrix"].concat(args),nJobs).then(msgs=>{
            const cellsByGenre={}, fresh={};
            for(const m of msgs){ Object.assign(cellsByGenre,m.cells); Object.assign(fresh,m.fresh); }
            if(useCache) L.saveFeats(fresh);
            printMatrix(cellsByGenre);
          }).catch(e=>{ console.error("matrix shards failed: "+e.message); process.exit(1); });
        }
      }
    } else if(cmd){
      const state=JSON.parse(fs.readFileSync(cmd,"utf8"));
      console.log(report(state));
    } else {
      console.log("usage: genre-verifier.js matrix | <state.json>");
    }
  }
})(typeof window!=="undefined"?window:globalThis);

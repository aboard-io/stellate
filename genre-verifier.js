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

  function features(state){
    const ev=E.buildEvents(state);
    const beats=Math.max(1,ev.totalBeats);
    const drums=ev.drums;
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
      // present — blues/newjack/house/krautrock), matrix 63/63. SOLINA is
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
                snareBalance:[0,.85,1], comp:[0,.25,1], bedUse:[.4,1,2],
                rubato:[0,.008,1] },   // vaporwave is MACHINE time — a slowed tape plays at constant (wrong) speed, it never breathes. Every vaporwave anchor seed sits at rubato 0; this fences the tempo-breathing neoclassical (rubato .02-.04) off vaporwave's diagonal (it was scoring 98 there on bpm/wash/7th overlap alone). 2026-07 mallsoft deep pass: bpm lo 58->62 and wash re-centered [.35,1]->[.28,.5] (weight 3). MEASURED: vaporwave renders bpm 64-87 (5-seed) and wash .308-.441 — its OWN home was always ~.3-.44, the old [.35,1] hi was pure slack that let the wetter/slower mallsoft (bpm 46-58, wash .54-.72) camp on this diagonal (mallsoft was scoring 98-100 here). Both fences are the anchor's own measured floor/cap; vaporwave self unchanged (still 99-100)
    synthwave:{ bpm:[84,120,3], leadVoices:[4,9,2], wash:[.25,.7,1], motion:[.3,1,1], pump:[.05,.6,1],
                snareBalance:[.4,1.4,1], sub:[0,.8,1], bedUse:[.3,1,1] },
    lofi:     { bpm:[66,92,3], crackle:[.4,1,3], swing:[.14,.4,2], seventh:[.5,1,1], softTop:[1,1,2],
                snareBalance:[0,.8,1], wash:[.1,.5,1] },
    downtempo:{ bpm:[60,90,3], wash:[.28,.8,2], drumDensity:[.2,2.2,2], motion:[.3,1,1], comp:[0,.4,1],
                snareBalance:[0,.8,1], bedUse:[.4,1,1], sub:[.5,1,2], seventh:[.5,1,1] },   // warm EXTENDED harmony — wintersynth's bare frost triads stay off this diagonal
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
                motion:[.55,1,2], snareBalance:[0,.75,1], hatDensity:[.7,2.6,1], humanize:[.3,.7,1],
                crackle:[0,.42,1] },   // 2026-07 (blues acoustic pass): blues now rides shuffle+upright+organ and was TYING jazz at 100. Honest fences: bpm lo = the jazz anchor's own floor (96, was 92); crackle hi = the anchor's own cap (.4+margin) — blues IS the worn-record genre (.25-.55), jazz is merely dusty
    dub:      { bpm:[64,86,3], sub:[.6,1,2], motion:[0,.4,2], crackle:[0,.1,2], swing:[0,.12,2],
                snareBalance:[.4,1.4,1], breakUse:[0,.1,1], drumDensity:[.5,2.4,1], pump:[0,.15,1] },
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
    newage:   { bpm:[58,80,2], drumDensity:[0,.5,3], motion:[.3,1,3], wash:[.4,1,2], pump:[0,.05,1],
                crackle:[0,.1,2], comp:[0,.25,2], swing:[0,.06,1], bedUse:[.5,1,2], acoustic:[0,.85,2],
                seventh:[.4,1,2] },   // luminous EXTENDED harmony — wintersynth's frost triads (seventh 0) stay off this diagonal; acoustic hi .85 admits the REAL flute lead (sampler .8) while still fencing off neoclassical's piano (1)
    exotica:  { bpm:[82,108,3], swing:[.1,.26,2], acoustic:[.4,1,2], seventh:[.8,1,1], bedUse:[.4,1,1],
                crackle:[0,.2,1], drumDensity:[.6,2.4,1], snareBalance:[0,.8,1], softTop:[0,0,1], motion:[.5,1,1] },
    industrial:{ bpm:[96,128,3], chopUse:[.25,1,2], pump:[0,.35,2], comp:[.4,.85,1], motion:[0,.7,2],
                sub:[.5,1,1], swing:[0,.06,1], crackle:[0,.12,1], snareBalance:[0,.7,1], hatDensity:[.8,2.6,1] },
    spokenword:{ bpm:[68,100,3], crackle:[.25,.55,2], acoustic:[.4,1,3], swing:[0,.16,2], snareBalance:[0,.5,2],
                softTop:[0,0,2], bedUse:[.4,1,2], seventh:[.8,1,1], pump:[0,.05,1], drumDensity:[.8,2.6,2] },
    chiptune: { bpm:[136,152,3], crackle:[0,.05,2], wash:[0,.28,2], leadVoices:[1,2,2], sub:[0,.5,2],
                breakUse:[0,.05,1], swing:[0,.04,2], drumDensity:[1.6,4,1], motion:[.5,1,1], pump:[0,.2,1] },
    chinawave:{ bpm:[92,120,3], snareBalance:[.55,1.5,2], crackle:[.1,.4,2], seventh:[0,.65,2], motion:[.5,1,1],
                bedUse:[.4,1,2], acoustic:[0,.3,1], swing:[0,.05,1], pump:[0,.1,1], sub:[0,.5,1] },   // march snare UP + shellac dust + triadic majors (vs sovietwave's minor 7ths, quiet snare)
    sovietwave:{ bpm:[86,116,2], crackle:[.15,.45,2], seventh:[.6,1,2], snareBalance:[0,.6,2], leadVoices:[1,4,2],
                bedUse:[.4,1,2], motion:[.5,1,1], wash:[.25,.7,1], swing:[0,.06,1], acoustic:[0,.3,1], pump:[0,.2,1] },   // minor-anthem 7ths + radio dust; few lead voices (vs synthwave supersaw)
    // ---- round 3 ----
    citypop:  { bpm:[90,108,3], seventh:[.8,1,2], swing:[.03,.14,2], wash:[0,.2,2], crackle:[0,.12,2],
                motion:[.5,1,1], acoustic:[0,.3,1], hatDensity:[.35,1.4,1], pump:[0,.12,1], comp:[.05,.3,1] },   // bright maj7 pop, DRY next to vaporwave, no disco organ, light master
    shibuyakei:{ bpm:[112,130,3], swing:[.12,.26,3], crackle:[0,.1,2], acoustic:[0,.25,1], leadVoices:[1,3,1],
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
                snareBalance:[.4,1.2,1], pump:[0,.15,1], leadVoices:[1,3,1], acoustic:[0,.2,1] },   // dry triads + cassette hiss — italo sparkles, this shrugs
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
    spacelounge:{ bpm:[82,104,3], swing:[.08,.22,2], acoustic:[.4,.8,2], wash:[.25,.6,2], drumDensity:[.2,1.4,2],
                hatDensity:[0,1,2], seventh:[.4,1,1], bedUse:[.4,1,1], crackle:[.05,.3,1], pump:[0,.05,1] },   // theremin over organ, kit nearly gone — exotica keeps a real (brushed) kit
    arabpop:  { bpm:[92,118,2], seventh:[.3,.8,2], motion:[.4,1,2], drumDensity:[1.1,2.6,2], swing:[0,.12,1],
                hatDensity:[.5,1.6,1], snareBalance:[0,.6,1], crackle:[0,.25,1], humanize:[.1,.35,1], comp:[.2,.5,1], pump:[0,.12,1] },   // hijaz color (mixed 7ths) + darbuka density at pop tempo — dinosynth is slower and washier
    tango:    { bpm:[96,126,2], acoustic:[.7,1,2], humanize:[.28,.6,2], drumDensity:[0,.8,3], crackle:[.1,.4,2],
                seventh:[.3,1,1], motion:[.5,1,1], swing:[0,.08,1], pump:[0,.05,1], wash:[0,.3,1] },   // sampled bandoneon + habanera piano, kitless, 78rpm dust, DRY (2026-07 ear-fix: pads nearly gone, reverb .3-.42)
    afrobeat: { bpm:[96,118,2], acoustic:[.4,.8,2], swing:[.02,.14,2], hatDensity:[1.3,2.6,2], drumDensity:[1.8,3.4,1],
                seventh:[.7,1,1], crackle:[.05,.3,1], comp:[.25,.55,1], pump:[0,.12,2], snareBalance:[.2,.9,1] },   // interlocking euclids + organ stabs — disco's hats are straighter and thinner
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
    prelude:  { bpm:[56,87,3], drumDensity:[0,0.4,3], acoustic:[0.66,1,3], humanize:[0,0.275,3], rubato:[0.001,0.035,2], motion:[0.487,1,1], wash:[0.026,0.359,1], swing:[0,0.071,1] },
    /* /genre-tool:prelude:targets */
    /* genre-tool:hogcore:targets */
    hogcore:  { bpm:[143,172,3], chopUse:[0.47,0.67,3], pump:[0.503,0.926,2], swing:[0,0.071,2], breakUse:[0,0.08,1], comp:[0.282,0.747,1], crackle:[0,0.1,1], seventh:[0,0.15,1] },
    /* /genre-tool:hogcore:targets */
  };

  function scoreAgainst(f, genre){
    const T=TARGETS[genre]; if(!T) return {score:0,notes:["unknown genre"]};
    let tw=0, ts=0; const notes=[];
    for(const [k,[lo,hi,w]] of Object.entries(T)){
      const v=f[k]; if(v==null) continue;
      let s;
      if(v>=lo&&v<=hi) s=1;
      else { const width=Math.max(hi-lo,0.001), d=v<lo?lo-v:v-hi; s=Math.max(0,1-d/width); }
      if(s<0.65) notes.push(`${k}=${v} wants [${lo},${hi}]`);
      tw+=w; ts+=w*s;
    }
    return {score:Math.round(100*ts/tw), notes};
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

  const api={ features, scoreAgainst, analyze, report, TARGETS };
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

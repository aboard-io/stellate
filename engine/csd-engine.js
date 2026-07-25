// csd-engine.js — the score brain: pure event generator for the genre space.
// buildEvents(state) -> {pitched, drums, found, sfx, bpm, totalBeats}
// Every backend (the Faust engine in faust/, MIDI export) derives from
// buildEvents so they never drift. The csound codegen that used to live here
// (buildCsd/orchestra) is preserved on branch legacy-csound.

(function (root) {
  "use strict";

  // Pitch-string memos (ENGINE-AUDIT 2026-07 Tier 3): events carry pitch as
  // "8.04" strings and every pass re-split/re-parsed them (~5% of buildEvents).
  // The pch vocabulary is tiny (a few dozen distinct strings per song), so a
  // Map memo returns the IDENTICAL integers/strings — byte-identical output.
  // pchToMidi(s) == parsePch(s)-36 exactly ((o-3)*12+ss = o*12+ss-36, small ints).
  const _pchParse=new Map(), _pchStr=new Map();
  function parsePch(s){ s=String(s); let v=_pchParse.get(s);
    if(v===undefined){ const [o,ss]=s.split("."); v=parseInt(o,10)*12+parseInt(ss,10); _pchParse.set(s,v); }
    return v; }
  function toPch(abs){ let v=_pchStr.get(abs);
    if(v===undefined){ const o=Math.floor(abs/12), ss=abs%12; v=o+"."+String(ss).padStart(2,"0"); _pchStr.set(abs,v); }
    return v; }
  function pchAdd(s,semis){ return toPch(parsePch(s)+(semis|0)); }
  function pchToMidi(s){ return parsePch(s)-36; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  // blues call-and-response: one seeded stream per GLOBAL chord bar, shared by
  // the "blues" lead generator and the hits placer (pattern "response") so
  // "who takes the response bars" — the guitar's answer vs the 78rpm singer —
  // agrees across layers without coupling their rng order. Draw #1 < 0.42 =
  // the lead RESTS the response half and the vox hit is slotted there.
  function crStream(seed,gci){ return mulberry32((((seed??1)>>>0)^Math.imul(gci+1,2654435761))>>>0); }

  // MUSIC-MIND organs (engine/theory.js + engine/pipes.js), loaded the UMD way:
  // node gets a require, the browser/worker gets the global its <script>/import
  // set BEFORE this file (index.html + the faust workers load them first).
  // BOTH are OPTIONAL at runtime — a context that never loaded an organ still
  // runs every state WITHOUT the knobs byte-identically (the guards at the two
  // consumption sites), and a state WITH a knob degrades to the plain fabric
  // rather than throwing (never die over an expression organ).
  const CsdTheoryRef=(typeof module!=="undefined"&&module.exports)?require("./theory.js"):root.CsdTheory;
  const CsdPipesRef =(typeof module!=="undefined"&&module.exports)?require("./pipes.js") :root.CsdPipes;
  // COLUMNAR EVENTS (vector-kernel STEP 1 — docs/history/NEXT.md §5b): the groove +
  // voice-dynamics passes run their arithmetic on struct-of-arrays compute
  // views (engine/columns.js) while writing results back into the same event
  // objects — BYTE-IDENTICAL to the scalar loops (test/columns.test.js proves
  // it across all genres x seeds). Node requires the module; a browser reads
  // root.CsdColumns LAZILY at call time (loaders that don't ship columns.js
  // yet fall back to the identical scalar path — no load-order trap, no
  // behavior fork). CSD_SCALAR_PASSES=1 (node only) forces the scalar path —
  // the test's permanent columnar-vs-scalar A/B lever, never set in production.
  const CsdColumnsRef=(typeof module!=="undefined"&&module.exports)?require("./columns.js"):null;
  const SCALAR_PASSES=(typeof process!=="undefined"&&process.env&&process.env.CSD_SCALAR_PASSES==="1");
  function columnsRef(){ return SCALAR_PASSES?null:(CsdColumnsRef||root.CsdColumns||null); }

  const NOTE={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
  const QUAL={maj:[0,4,7],min:[0,3,7],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],m7b5:[0,3,6,10],sus4:[0,5,7],aug:[0,4,8]};   // aug added 2026-07-10 (REPERTOIRE wave 3): the whole_tone progression's planing triad — additive, no existing progression names it
  // build a chord voicing from root name + quality (consistent with the hand ones)
  function voicing(rootName, quality){
    const r=NOTE[rootName]||0;
    const iv=QUAL[quality]||QUAL.maj;
    const four=iv.length>=4?iv.slice(0,4):[iv[0],iv[1],iv[2],iv[0]+12];
    const pads=four.map(i=>pchAdd(toPch(84+r),i));      // octave 7 base
    const lead=four.map(i=>pchAdd(toPch(96+r),i));      // octave 8 base
    const bass={ r5:toPch(60+r), r6:toPch(72+r), f6:pchAdd(toPch(72+r),7) };
    return { name:rootName+quality, pads, bass, lead };
  }
  const prog=(label,specs)=>({ label, chords: specs.map(([r,q])=>voicing(r,q)) });

  const PROGRESSIONS = {
    royal_road:{ label:"Royal Road (IVΔ7-V7-iii7-vi7) — city pop / vaporwave", chords:[
      {name:"Fmaj7",pads:["7.05","7.09","8.00","8.04"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.04"]},
      {name:"G7",   pads:["7.07","7.11","8.02","8.05"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.05"]},
      {name:"Em7",  pads:["7.04","7.07","7.11","8.02"],bass:{r5:"5.04",r6:"6.04",f6:"5.11"},lead:["8.04","8.07","8.11","9.02"]},
      {name:"Am7",  pads:["7.09","8.00","8.04","8.07"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.07"]}],
      composed:[[0,1.5,"8.09"],[1.5,0.5,"8.07"],[2,1,"8.09"],[3,2,"9.00"],[5,1.5,"9.04"],[6.5,1.5,"9.02"],[8,1,"9.02"],[9,1,"8.11"],[10,2,"8.07"],[12,1,"8.09"],[13,1,"8.11"],[14,2,"9.02"],[16,1.5,"9.04"],[17.5,0.5,"9.02"],[18,2,"8.11"],[20,1.5,"8.07"],[21.5,0.5,"8.09"],[22,2,"8.11"],[24,1,"9.00"],[25,1,"8.11"],[26,2,"8.09"],[28,1.5,"9.04"],[29.5,0.5,"9.00"],[30,2,"8.09"]],
      composed2:[[0,1,"9.00"],[1,1,"9.04"],[2,1,"9.05"],[3,1,"9.04"],[4,2,"9.02"],[6,1,"9.00"],[7,1,"8.11"],[8,1.5,"9.02"],[9.5,0.5,"9.04"],[10,1,"9.05"],[11,1,"9.04"],[12,2,"9.02"],[14,2,"8.11"],[16,1,"9.04"],[17,1,"9.07"],[18,1,"9.04"],[19,1,"9.02"],[20,2,"8.11"],[22,2,"9.02"],[24,1,"9.00"],[25,1,"9.04"],[26,1.5,"9.07"],[27.5,0.5,"9.04"],[28,1,"9.00"],[29,1,"8.09"],[30,2,"8.09"]] },
    four_chords:{ label:"Four chords (I-V-vi-IV)", chords:[
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]},
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]}] },
    sad_pop:{ label:"Sad pop (vi-IV-I-V)", chords:[
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]},
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]}] },
    doo_wop:{ label:"'50s doo-wop (I-vi-IV-V)", chords:[
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]}] },
    ii_v_i:{ label:"Jazz ii-V-I turnaround", chords:[
      {name:"Dm7",  pads:["7.02","7.05","7.09","8.00"],bass:{r5:"5.02",r6:"6.02",f6:"6.09"},lead:["8.02","8.05","8.09","9.00"]},
      {name:"G7",   pads:["7.07","7.11","8.02","8.05"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.05"]},
      {name:"Cmaj7",pads:["7.00","7.04","7.07","7.11"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","8.11"]}] }
  };
  // generated additions (way more progressions)
  Object.assign(PROGRESSIONS, {
    pop_1625:   prog("Pop I-vi-ii-V",            [["C","maj7"],["A","min7"],["D","min7"],["G","dom7"]]),
    synthwave:  prog("Synthwave i-VI-III-VII",   [["A","min7"],["F","maj7"],["C","maj7"],["G","dom7"]]),
    andalusian: prog("Andalusian i-VII-VI-V",    [["A","min7"],["G","maj"],["F","maj7"],["E","dom7"]]),
    minor_run:  prog("Minor i-iv-VII-III",       [["A","min7"],["D","min7"],["G","dom7"],["C","maj7"]]),
    neosoul:    prog("Neo-soul descending",      [["F","maj7"],["E","min7"],["D","min7"],["C","maj7"]]),
    lofi:       prog("Lo-fi ii-V-I-vi",          [["D","min7"],["G","dom7"],["C","maj7"],["A","min7"]]),
    epic_min:   prog("Epic i-VI-VII",            [["A","min7"],["F","maj7"],["G","dom7"],["G","dom7"]]),
    house_min:  prog("House i-VII-VI-VII",       [["A","min7"],["G","maj"],["F","maj7"],["G","dom7"]]),
    dream:      prog("Dreamy IVΔ-Imaj7",         [["F","maj7"],["C","maj7"],["D","min7"],["G","dom7"]]),
    canon:      prog("Pachelbel canon",          [["C","maj"],["G","maj"],["A","min7"],["E","min7"],["F","maj7"],["C","maj"],["F","maj7"],["G","dom7"]]),
    // genre-kernel additions — low/zero harmonic motion for techno/dj forms
    drone_min:  prog("Drone (i, no motion)",     [["A","min7"]]),
    primeval:   prog("Primeval i-bVII-bIII-bVI",  [["A","min7"],["G","dom7"],["C","maj7"],["F","maj7"]]),   // cinematic lift — planetarium grandeur
    deep_two:   prog("Deep two-chord (i-VI)",    [["A","min7"],["F","maj7"]]),
    house_min7: prog("House stabs (i-i-iv-v)",   [["A","min7"],["A","min7"],["D","min7"],["E","min7"]]),
    // modal colors — the MODE dimension (tonic stays A/C-relative; keyOffset moves it)
    mode_dorian:    prog("Dorian i7-IV7 vamp",      [["A","min7"],["D","dom7"],["A","min7"],["G","maj7"]]),
    mode_phrygian:  prog("Phrygian i-bII",          [["A","min"],["Bb","maj7"],["A","min"],["G","min7"]]),
    mode_lydian:    prog("Lydian IΔ-II",            [["C","maj7"],["D","dom7"],["C","maj7"],["D","dom7"]]),
    mode_mixo:      prog("Mixolydian I7-bVII",      [["C","dom7"],["Bb","maj7"],["F","maj7"],["C","dom7"]]),
    // genre-kernel additions — trance lift + disco/funk vamp
    uplift:     prog("Uplift (i-VI-VII-i)",      [["A","min7"],["F","maj7"],["G","maj"],["A","min7"]]),
    funk_vamp:  prog("Funk vamp (i7-IV7)",       [["A","min7"],["D","dom7"]]),
    // round-3 genre-kernel additions — plain-triad minor (coldwave/wintersynth/tango:
    // the verifier's "seventh" feature needs a 0-seventh minor home) + phrygian
    // DOMINANT (arab pop's hijaz color: MAJOR tonic against bII)
    frost:      prog("Frost (i-VI-III-VII triads)", [["A","min"],["F","maj"],["C","maj"],["G","maj"]]),
    // MIDI-trove mined (2026-07-14, tools/mine-midi.js on the MIDIMAN dub rip,
    // 108 files): real dub harmony is TRIADIC (seventh-bar fraction .08 median
    // vs the engine's all-7ths pools) and lives on the tonic-subdominant axis —
    // root movement of a 4th/5th outnumbers everything else 2:1, chord roots
    // sit on 1^ (6908 bars) and 4^ (3679) far ahead of 5^ (1898). The i-iv
    // plain-triad vamp is that measurement as vocabulary.
    dub_vamp:   prog("Dub vamp (i-iv triads)",   [["A","min"],["D","min"]]),
    // MIDI-trove mined (2026-07-14, MIDIMAN ragtime rip, 236 files, 82% major):
    // ascending-4th root movement dominates (4788 vs 2789 for 5ths-down-the-
    // other-way), roots concentrate on 1^/5^/2^/6^ — the classic rag circle,
    // secondary dominants chaining home (VI7->II7->V7->I). Corpus seventh-bar
    // fraction .51: the tonic stays a plain triad, the cycle is all dom7s.
    rag_cycle:  prog("Rag cycle (I-VI7-II7-V7)", [["C","maj"],["A","dom7"],["D","dom7"],["G","dom7"]]),
    hijaz:      prog("Hijaz (I-bII, phrygian dominant)", [["A","maj"],["Bb","maj7"],["A","maj"],["G","min7"]]),
    blues_12:   prog("12-bar blues (all dom7)",  [["C","dom7"],["C","dom7"],["C","dom7"],["C","dom7"],
                                                  ["F","dom7"],["F","dom7"],["C","dom7"],["C","dom7"],
                                                  ["G","dom7"],["F","dom7"],["C","dom7"],["G","dom7"]]),
    // REPERTOIRE wave 3 (2026-07-10) — the author-wishlist de-clone additions
    // (minor_run carried 79 genres, deep_two 67; these give the catalog real
    // harmonic alternatives). Each has a distinct character no existing entry
    // covers; wiring into anchors is a per-genre card judgment (genre-kernel).
    whole_tone: prog("Whole tone (aug planing — Debussy dream)", [["C","aug"],["D","aug"],["E","aug"],["D","aug"]]),   // two whole-tone aug triads planed up and back: rootless shimmer, zero cadence gravity
    interchange:prog("Modal interchange (I-bVII-IV-iv)", [["C","maj7"],["Bb","maj7"],["F","maj7"],["F","min7"]]),      // the borrowed-iv heartstring: bright mixolydian lift, then the minor plagal fall home
    mediant:    prog("Chromatic mediant (I-III-I-bVI)",  [["C","maj"],["E","maj"],["C","maj"],["Ab","maj"]]),          // the film-score pivot: major thirds either side of home, wonder without a dominant
    blues_16:   prog("16-bar blues (Watermelon Man vein)", [["C","dom7"],["C","dom7"],["C","dom7"],["C","dom7"],
                                                  ["F","dom7"],["F","dom7"],["C","dom7"],["C","dom7"],
                                                  ["G","dom7"],["F","dom7"],["G","dom7"],["F","dom7"],
                                                  ["G","dom7"],["F","dom7"],["C","dom7"],["C","dom7"]]),               // the stretched turnaround — 128-beat cycles, so wire only into FAST genres (bebop) or it floors the duration solver
    quartal:    prog("Quartal/sus vamp (So What planing)", [["C","sus4"],["D","sus4"],["C","sus4"],["G","sus4"]]),     // suspended chords that never resolve — modal-jazz stasis, the hold-music truth
    epic_maj:   prog("Epic major (I-V-IV-V)",    [["C","maj"],["G","maj"],["F","maj"],["G","maj"]])                    // epic_min's daylight twin: the stadium major lift (authors' wishlist)
  });

  // (KERNEL-V4 §3.7) progression resolution is now HARD: gate 6 proves every
  // anchor's progression names resolve, so at runtime an unknown name is a bug,
  // not a reason to silently render royal_road city-pop harmony. Replaces the
  // four `PROGRESSIONS[x]||PROGRESSIONS.royal_road` fallbacks (engine + kernel +
  // verifier). Byte-stable: never fires on a valid state.
  function getProgression(name){
    const p=PROGRESSIONS[name];
    if(!p) throw new Error("csd-engine: unknown progression '"+name+"' (no royal_road fallback — see gate 6)");
    return p;
  }

  const CHORD_BEATS=8;
  const WAVES=["sine","saw","square","pulse"];
  // ODD-METER vocabulary (2026-07): oompahpah/waltzroot (3-beat cells),
  // siciliana (6-beat), kits waltz/waltzswing (3) + sixeight (6), melody
  // waltz/lilt6 — meant for state.meter genres (3/4, 6/8). Harmless additions
  // otherwise: a 4/4 state that requests them just gets the short cell tiled
  // over its 8-beat bar (a polymeter, never a crash).
  const BASS_PATTERNS=["off","root","simple","walking","octaves","sixteenths","dub","drive","rolling","sub","stab","melodic","habanera","syncopated","pedal","sludge","tresillo","son","hemiola","charleston","oompahpah","waltzroot","siciliana"];
  const MELODY_PATTERNS=["off","composed","composed2","arpup","arpdown","updown","pentaup","wander","sparse","double","hero","blues","canon","roar","anthem","arp16","motorik","motorik23","fugue","sludge","waltz","lilt6","folkline","jazzline","ragline","dubline","folkweave","jazzweave","guitarweave","classicalweave"];   // +4 mined cells (mine-melody.js) +4 mined WEAVE organs (mine-weave.js)
  const DRUM_PATTERNS=["off","kick","full","open","four","boombap","halftime","trap","pulse","techno","house","breaks","jungle","tribal","bossa","electro","newjack","shuffle","waltz","waltzswing","sixeight","onedrop"];
  // KERNEL-V4 Phase 5 (§3.5) — the form as a graph of TYPED NODES. Every
  // section, whatever a form names it, classifies to one of six node types:
  //   ground  arrival / low-energy opener   (intro, arrive, dawn, platform, warmup)
  //   build   rising groove / verse         (verse, build, theme, drift, board, plateau, transit…)
  //   peak    the payoff                     (chorus, drop, peak, lift, main, express, swell, solo-call…)
  //   release the drop-out / breakdown       (breakdown, break, recede, interchange, answer)
  //   exposed the stripped moment            (bridge, solo)
  //   cadence the ending                     (outro, depart, terminus, finale, coda)
  // This is the grammar's external contract: sample-event roles attach to
  // node types (Phase-4 handoff #1) so a renamed section keeps its layers, and
  // openers/cadences find natural attach points. Derived from the name (no
  // state field -> byte-stable; sec.tag, if a caller ever sets one, wins).
  function sectionTag(name){
    const n=String(name||"").toLowerCase();
    if(/intro|arrive|\bdawn|platform|warm/.test(n))                 return "ground";
    if(/outro|depart|terminus|finale|\bcoda\b/.test(n))             return "cadence";
    if(/breakdown|^break|recede|interchange|\banswer\b/.test(n))    return "release";
    if(/bridge|\bsolo\b|exposed/.test(n))                           return "exposed";
    if(/chorus|drop|\bpeak|\blift|shred|\bcall\b|\bmain\b|express|swell/.test(n)) return "peak";
    return "build";   // verse / build / theme / drift / rebuild / pre-chorus / plateau / transit / board
  }
  const SFX_NUM={riser:1,sweep:2,downlift:3,impact:4,reverse:5,noise:6};
  // the ⚡ transition control: what happens at the end of a section, into the next
  // (2026-07: + "snare roll" march-crescendo, "stutter" last-half-bar gate,
  //  "dropout" kick-drop silence beat — see buildEvents transition chain)
  // (2026-07 MUSICAL-transition round: + "micro lick" — a 1-2 bar seeded
  //  sax/trombone/flute/piano pickup phrase into the next downbeat, voiced by
  //  state.lickVoice; + "kit fill" — a half-bar mini-fill that QUOTES the
  //  section's own drum pattern. The noise/sweep/riser SFX are demoted -8dB
  //  and rationed by the kernel's auto-transition pass.)
  // (2026-07 VARIETY pass: + a batch of new named fills — "flam roll" (grace-note
  //  snare roll), "tom cascade" (melodic hi->lo tom run), "crash choke" (a hard
  //  choked stop-crash off a two-tom pickup), "tape stop" (a decelerating,
  //  pitch-dropping retrigger = a tape halt), "reverse crash" (reverse-cymbal
  //  suck-in resolving to crash+impact), "filter riser" (riser SFX under a hat
  //  rush), "build drop" (snare-roll+riser crescendo then a final-beat drop-out).
  //  All new options: a genre that does not pool them is byte-identical.)
  const TRANSITIONS=["off","drum fill","tom fill","break fill","hat rush","cut","riser","sweep","downlift","impact","reverse","noise","snare roll","stutter","dropout","micro lick","kit fill","flam roll","tom cascade","crash choke","tape stop","reverse crash","filter riser","build drop"];
  // ---------- PERCUSSION LANE (2026-07 "use the percussion" pass) ----------
  // Decorative percussion layered OVER the kick/snare/hat/tom kit: the real
  // recorded clap/rim/ride/crash (kit samples) + the wide GM perc bank
  // (congas/shaker/cowbell/tambourine/agogo/guiro/claves/woodblock/triangle).
  // Emitted by the PERC PASS in buildEvents from state.perc.lanes (genre-kernel
  // PERC_STYLES); NEW drum event types clap/rim/ride/crash/perc that the verifier
  // does NOT count (core-kit fabric only). Pattern -> voice + GM notes below.
  const PERC_PATTERNS=["clap24","crashDown","ride8","rideq","rim34","clave","shaker8","shaker16","conga","cowbell","tambourine","agogo","guiro","triangle","woodblock"];
  const PERC_VOICES=["clap","rim","ride","crash","perc"];
  // GM percussion notes (standard bank-128 map) for the shared perc voice.
  const PERC_NOTE={ shaker:82, cabasa:69, maracas:70, tambourine:54, cowbell:56,
    agogoHi:67, agogoLo:68, congaLo:64, congaOpenHi:63, congaMuteHi:62,
    bongoHi:60, bongoLo:61, timbaleHi:65, timbaleLo:66, claves:75,
    guiroLong:74, guiroShort:73, woodblockHi:76, woodblockLo:77,
    triangleOpen:81, triangleMute:80, vibraslap:58 };
  // one 8-unit bar (=CHORD_BEATS) of a named perc pattern, starting at beat S.
  // The cell is 4/4-authored; the PERC PASS tiles it by min(CBEATS,CHORD_BEATS)
  // and truncates/clips at the cell + span edge (see the pass) — the same
  // tile-or-truncate law drumEvents applies to the KITS cells.
  // dedicated voices carry no note (clap/rim/ride/crash); the shared "perc" voice
  // carries a GM note that selects its sample zone. ci = bar index (variation).
  function percBar(name, S, lvl, ci){
    const out=[];
    const V=(drum,off,amp,dur)=>out.push({drum,beat:S+off,dur:dur||0.12,amp});
    const P=(off,amp,note,dur)=>out.push({drum:"perc",beat:S+off,dur:dur||0.12,amp,note});
    switch(name){
      case "clap24": V("clap",2,lvl); V("clap",6,lvl); break;
      case "crashDown": V("crash",0,lvl,1.2); break;
      case "rideq": [0,2,4,6].forEach(o=>V("ride",o,lvl*(o%4===0?1:0.78))); break;
      case "ride8": for(let o=0;o<8;o++) V("ride",o,lvl*(o%2===0?1:0.68)); break;
      case "rim34": V("rim",2,lvl); V("rim",6,lvl); break;
      case "clave": [0,1.5,3,4,6].forEach(o=>P(o,lvl,PERC_NOTE.claves,0.1)); break;   // 3-2 son-ish clave
      case "shaker8": for(let o=0;o<8;o++) P(o,lvl*(o%2?0.68:1),PERC_NOTE.shaker,0.1); break;
      case "shaker16": for(let o=0;o<8;o+=0.5) P(o,lvl*(((o*2)%2)?0.6:1),PERC_NOTE.shaker,0.08); break;
      case "conga": [[0,PERC_NOTE.congaLo,1],[2.5,PERC_NOTE.congaMuteHi,0.7],[3,PERC_NOTE.congaOpenHi,0.9],[4,PERC_NOTE.congaLo,0.85],[6.5,PERC_NOTE.congaOpenHi,0.8],[7,PERC_NOTE.congaOpenHi,0.65]].forEach(([o,n,a])=>P(o,lvl*a,n,0.2)); break;
      case "cowbell": [0,2,3,4,6,7].forEach(o=>P(o,lvl*(o%2===0?1:0.7),PERC_NOTE.cowbell,0.1)); break;
      case "tambourine": [1,3,5,7].forEach(o=>P(o,lvl,PERC_NOTE.tambourine,0.12)); if(ci%2) P(4,lvl*0.7,PERC_NOTE.tambourine,0.12); break;
      case "agogo": [[0,PERC_NOTE.agogoHi],[1.5,PERC_NOTE.agogoLo],[3,PERC_NOTE.agogoHi],[4,PERC_NOTE.agogoLo],[5.5,PERC_NOTE.agogoHi],[7,PERC_NOTE.agogoLo]].forEach(([o,n])=>P(o,lvl,n,0.1)); break;
      case "guiro": P(0,lvl,PERC_NOTE.guiroLong,0.4); P(2,lvl*0.7,PERC_NOTE.guiroShort,0.1); P(4,lvl,PERC_NOTE.guiroLong,0.4); P(6,lvl*0.7,PERC_NOTE.guiroShort,0.1); break;
      case "triangle": P(0,lvl,PERC_NOTE.triangleOpen,0.5); if(ci%2===0) P(4,lvl*0.7,PERC_NOTE.triangleMute,0.2); break;
      case "woodblock": [1,3,5,7].forEach(o=>P(o,lvl,PERC_NOTE.woodblockHi,0.1)); break;
    }
    return out;
  }
  // synthesis-model vocabulary. FAUST-PORT: the voices themselves live in
  // faust/state-engine.js (pitchedUnit) + faust/dist/ modules; this predicate is
  // the engine-side canon anchors and validators check against — keep it in sync
  // when a new .dsp lands. (validate-genres scrapes these model==="…"
  // comparisons from source, exactly like the pattern tables above.)
  const isModel=(model)=>
    // pitched: pad/bass/lead
    model==="saw"||model==="stack"||model==="sine"||model==="sub"||model==="acid"||
    model==="reese"||model==="wobble"||model==="piano"||model==="organ"||model==="strings"||
    model==="choir"||model==="bell"||model==="brass"||model==="fm"||model==="rhodes"||
    model==="pluck"||model==="kpluck"||model==="fuzz"||model==="guitar"||model==="vocoder"||
    model==="modeld"||   // Minimoog-Model-D mono voice (dsp/modeld.dsp)
    // synth fleet (2026-07): nine classic-synth Faust voices (faust/dsp/*.dsp)
    model==="juno60"||model==="tb303"||model==="solina"||model==="hammond"||model==="synclead"||
    model==="casiocz"||model==="oberheim"||model==="ppg"||model==="vp330"||
    model==="hoover"||   // Alpha-Juno rave stab (SIGNATURE synth; supersaw voice with hoover defaults — state-engine)
    model==="dx7"||model==="sampler"||   // sampler: native pitched sample zones (found/samples/instruments/)
    // drums: kick boom|808|909 · snare noise|crack|clap · hat noise|metal
    model==="boom"||model==="808"||model==="909"||model==="noise"||model==="crack"||
    model==="clap"||model==="metal";

  // ---------- SOURCE-CLASS taxonomy (KERNEL-V4 §3.6 — the primary timbre axis) ----------
  // Every pitched model classified by its SYNTHESIS SOURCE CLASS — the first
  // choice §3.6 makes per voice, formerly implicit in each anchor's `model:[…]`
  // pool. Classes:
  //   analog       subtractive / analog-modelled oscillator voices (the space's
  //                default synth timbre) — incl. the emulation fleet (juno60,
  //                tb303, solina, oberheim, ppg, casiocz, synclead, modeld) and
  //                the additive/wavetable string/choir/brass/bell/vp330 pads,
  //                which are synths, not sampled instruments.
  //   fm           phase-modulation voices — the built-in `fm` and the DX7
  //                cartridge engine (`dx7`); a DX7's acoustic-ness is a property
  //                of the loaded PATCH name, not the class (see verifier).
  //   sampler      real recorded multisamples (found/samples/instruments/) —
  //                acoustic by construction.
  //   electromech  tonewheel/tine/pipe electro-mechanical instruments modelled
  //                as their own voices (hammond, organ, rhodes, piano) — the
  //                genuinely-acoustic-adjacent tier.
  //   mechanical   noise/distortion-defined voices (fuzz).
  // `ac` = the acoustic MEMBERSHIP grade this source contributes to the
  // verifier's `acoustic` feature (0 = pure synth). It lives HERE now so the
  // feature READS the axis rather than re-deriving it from an inline list
  // (piano 1, sampler .8, organ/hammond .6 — the historical grades, unchanged).
  // Silence ("off") is a first-class source the anchors already weight in-pool.
  const SOURCE_CLASS = {
    saw:{class:"analog",ac:0}, stack:{class:"analog",ac:0}, sine:{class:"analog",ac:0},
    sub:{class:"analog",ac:0}, acid:{class:"analog",ac:0}, reese:{class:"analog",ac:0},
    wobble:{class:"analog",ac:0}, pluck:{class:"analog",ac:0}, kpluck:{class:"analog",ac:0},
    modeld:{class:"analog",ac:0}, juno60:{class:"analog",ac:0}, tb303:{class:"analog",ac:0},
    solina:{class:"analog",ac:0}, synclead:{class:"analog",ac:0}, casiocz:{class:"analog",ac:0},
    oberheim:{class:"analog",ac:0}, ppg:{class:"analog",ac:0}, vp330:{class:"analog",ac:0},
    hoover:{class:"analog",ac:0},
    strings:{class:"analog",ac:0}, choir:{class:"analog",ac:0}, bell:{class:"analog",ac:0},
    brass:{class:"analog",ac:0}, vocoder:{class:"analog",ac:0}, guitar:{class:"analog",ac:0},
    fm:{class:"fm",ac:0}, dx7:{class:"fm",ac:0},
    sampler:{class:"sampler",ac:0.8},
    piano:{class:"electromech",ac:1}, rhodes:{class:"electromech",ac:0.6},
    organ:{class:"electromech",ac:0.6}, hammond:{class:"electromech",ac:0.6},
    fuzz:{class:"mechanical",ac:0},
  };
  const sourceClassOf=(model)=>(SOURCE_CLASS[model]&&SOURCE_CLASS[model].class)||null;

  // models: pad saw|organ|fm · bass saw|sub|acid|reese · melody stack|pluck|fm
  // · kick boom|808|909 · snare noise|crack|clap · hat noise|metal
  // `inserts` — per-voice insert-FX chain (0-2 entries), a first-class state
  // dimension resolved by the genre kernel. CONTRACT (Faust engine consumes):
  //   inserts: [{type:"distort",drive,mix} | {type:"phaser",rate,depth,mix} |
  //             {type:"chorus",rate,depth,mix} |
  //             {type:"filtersweep",rateBars,lo,hi,res}]
  //   rate in Hz; rateBars = sweep period in BARS; lo/hi = octaves relative to
  //   the voice's cutoff; drive/depth/mix/res in 0..1. Empty array = bypass.
  function defaultInstruments(){
    return {
      pad:    { model:"saw", wave:"saw",  cutoff:1400, res:0.15, detune:0.006, attack:1.5, level:0.7, send:0.55, dsend:0.15, inserts:[] },
      bass:   { model:"saw", wave:"saw",  cutoff:700,  res:0.15, level:1.0, send:0.08, dsend:0.0, inserts:[] },
      melody: { model:"stack", wave:"sine", cutoff:3400, res:0.05, vibrato:0.006, vibRate:5.2, level:0.6, send:0.45, dsend:0.25, voices:2, spread:0.004, inserts:[] },
      drums:  { kickModel:"boom", snareModel:"noise", hatModel:"noise", kick:1.0, snare:1.0, hat:1.0, tom:1.0, tune:1.0, send:0.18, dsend:0 }
    };
  }
  // (KERNEL-V4 §3.7 deletion) the STYLES whole-song presets AND generateSong
  // (the 2026-05 builder's whole-song codegen) are gone — the FORM GRAMMAR in
  // genre-kernel.js (buildSections/buildForm) is the one composer now. The only
  // survivor was defaultState's demo section list; it is inlined below as a
  // static royal-road pop song (value-identical to the old
  // generateSong({foundIds:["tokyo","tsukiji","asakusa"],bass:"simple",
  // drums:"full",melody:"composed"}) output — the committed default_song the
  // engine.test press and the legacy A/B harness render). The engine can't reach
  // the kernel grammar (kernel requires engine, not vice versa), so a literal
  // list is the honest form here; genre tracks come from genre-kernel.track().
  const DEFAULT_SONG=[
    { id:"s1", name:"intro",      cycles:1, pads:true, bass:"off",     drums:"off",  melody:"off",      found:{sourceId:"tokyo",  role:"bed"}, fill:"off" },
    { id:"s2", name:"verse",      cycles:1, pads:true, bass:"simple",  drums:"off",  melody:"off",      found:{sourceId:"tsukiji",role:"bed"}, fill:"off" },
    { id:"s3", name:"pre-chorus", cycles:1, pads:true, bass:"root",    drums:"kick", melody:"off",      found:{sourceId:null,     role:"bed"}, fill:"riser" },
    { id:"s4", name:"chorus",     cycles:1, pads:true, bass:"simple",  drums:"full", melody:"composed", found:{sourceId:null,     role:"bed"}, fill:"off" },
    { id:"s5", name:"verse 2",    cycles:1, pads:true, bass:"walking", drums:"full", melody:"off",      found:{sourceId:"asakusa",role:"bed"}, fill:"off" },
    { id:"s6", name:"bridge",     cycles:1, pads:true, bass:"root",    drums:"off",  melody:"composed", found:{sourceId:"tokyo",  role:"bed"}, fill:"drum fill" },
    { id:"s7", name:"chorus 2",   cycles:1, pads:true, bass:"walking", drums:"full", melody:"composed", found:{sourceId:null,     role:"bed"}, fill:"off" },
    { id:"s8", name:"outro",      cycles:1, pads:true, bass:"off",     drums:"off",  melody:"off",      found:{sourceId:"tsukiji",role:"bed"}, fill:"off" },
  ];

  function defaultState(){
    return {
      bpm:88, keyOffset:0, progression:"royal_road", reverb:0.85, seed:1, swing:0, humanize:0,
      delay:{ beats:0.75, feedback:0.30, cutoff:2600 },
      instruments: defaultInstruments(),
      foundSources:[
        { id:"tokyo",   label:"Tokyo Station",   url:"https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg", pitch:0.78, stretch:0.45 },
        { id:"tsukiji", label:"Tsukiji Market",  url:"https://archive.org/download/aporee_35166_40406/201714020750tsukijifishmarket01.mp3", pitch:0.8, stretch:0.5 },
        { id:"asakusa", label:"Asakusa Noodles", url:"https://archive.org/download/aporee_21091_24510/nov92013asakusaNoodleSoupRest1910.mp3", pitch:0.72, stretch:0.45 }
      ],
      // fresh deep-copy each call: callers (offline renderers, legacy A/B) mutate sections
      sections: JSON.parse(JSON.stringify(DEFAULT_SONG))
    };
  }

  // ---------- event generators ----------
  // bass patterns are 8-beat cells; chordEvery (cb) tiles them across the
  // chord bar (>8) or truncates (<8). cb=8 (every genre today) is one cell,
  // byte-identical to the pre-lane engine.
  // ODD-METER cells carry their OWN period (BASS_CELL_LEN) so a 3-beat oompah
  // tiles a 6- or 12-beat chord bar measure-by-measure instead of assuming the
  // 8-beat 4/4 cell; patterns not in the map keep the 8-beat stride verbatim.
  const BASS_CELL_LEN={oompahpah:6,waltzroot:3,siciliana:6};
  function bassEvents(kind,S,b,k,rng,cb){
    cb=cb||CHORD_BEATS;
    const r5=pchAdd(b.r5,k), r6=pchAdd(b.r6,k), f6=pchAdd(b.f6,k);
    const cell=()=>{
    let L;
    switch(kind){
      case "root":       L=[[0,7.5,r5]]; break;
      case "octaves":    L=[[0,1,r5],[1,1,r6],[2,1,r5],[3,1,r6],[4,1,r5],[5,1,r6],[6,1,r5],[7,1,r6]]; break;
      case "sixteenths": L=[]; for(let i=0;i<16;i++) L.push([i*0.5,0.45,[r5,r6,f6,r6][i%4]]); break;
      case "dub":        L=[[2.5,1.0,r5],[3.5,0.5,r6],[6.5,1.0,r5],[7.5,0.5,f6]]; break;
      case "drive":      L=[]; for(let i=0;i<16;i++) L.push([i*0.5,0.42,r5]); break;   // straight 8ths on the root — the night-drive pulse
      case "rolling":    L=[]; for(let i=0;i<8;i++)  L.push([i+0.5,0.4,r5]);  break;   // offbeat 8ths — house/techno roll
      case "sub":        L=[[0,3.8,pchAdd(r5,-12)],[4,3.8,pchAdd(r5,-12)]];   break;   // long sub pressure — jungle/dub
      case "sludge":     // SUNN O)))/SLEEP DOUBLED sub: the root AND an octave below it,
        // held long, twice per bar — big, thick and relentless (Paul: "big and doubled").
        L=[[0,3.9,pchAdd(r5,-12)],[0,3.9,r5],[4,3.9,pchAdd(r5,-12)],[4,3.9,r5]]; break;
      case "stab":       L=[[0,0.3,r5],[1.5,0.3,r6],[3,0.3,r5],[4.5,0.3,r6],[6,0.3,r5],[7,0.3,f6]]; break;   // syncopated stabs
      case "melodic": {  // generative: walks chord tones with approach/passing notes — never the same bar twice
        L=[]; const rr=rng||(()=>0.5); const tones=[r5,r6,f6,pchAdd(r5,3),pchAdd(r6,-2)];
        let t=0;
        while(t<7.5){
          const d=[0.5,0.5,1,1,1.5,2][Math.floor(rr()*6)];
          let p=tones[Math.floor(rr()*tones.length)];
          if(rr()<0.22) p=pchAdd(p, rr()<0.5?-1:2);
          if(rr()<0.12){ t+=d; continue; }                    // breathe
          L.push([t, Math.min(d,7.6-t)*0.9, p]); t+=d;
        } break; }
      case "walking":    L=[[0,1.0,r5],[1,0.5,r6],[1.5,0.5,f6],[2.5,0.5,r5],[3,1.0,r6],[4,0.5,r5],[4.5,0.5,f6],[5.5,0.5,r6],[6,1.0,r5],[7,0.5,r6],[7.5,0.5,f6]]; break;
      case "habanera":   L=[[0,1.4,r5],[1.5,0.5,f6],[2,1,r6],[3,1,r5],[4,1.4,r5],[5.5,0.5,f6],[6,1,r6],[7,1,f6]]; break;   // DUM..da-DUM-DUM ×2 — the tango/milonga cell IS the groove
      // ---- MUSIC-MIND clave/cell family (§"Rhythmic + chromatic exploration") ----
      // Same event shape + registers as every cell above; selectable via the
      // ordinary bass-pattern plumbing (harmless vocabulary until anchors adopt).
      case "tresillo":   // 3-3-2 ROOTS twice per bar — the Afro-Cuban/reggaeton backbone; long-long-short keeps the root anchored while the grid pulls
        L=[[0,1.4,r5],[1.5,1.4,r5],[3,0.9,r5],[4,1.4,r5],[5.5,1.4,r5],[7,0.9,r5]]; break;
      case "son":        // son-clave-LOCKED root/fifth: the 3-side states the root (0,1.5) and lifts to the fifth (3); the 2-side answers on octave+root (5,6)
        L=[[0,1.2,r5],[1.5,1.2,r5],[3,1.6,f6],[5,0.8,r6],[6,1.7,r5]]; break;
      case "hemiola":    // 3-against-4: dotted-quarter pulses tile the 8-beat bar (six hits) — the cross-rhythm reads against the kick's four
        L=[[0,1.35,r5],[1.5,1.35,r6],[3,1.35,r5],[4.5,1.35,r6],[6,1.35,r5],[7.5,0.45,f6]]; break;
      case "charleston": // beat 1 + the "and" of 2, SUSTAINED (the Charleston comp cell, twice per bar) — space is the groove here
        L=[[0,2.3,r5],[2.5,1.4,r6],[4,2.3,r5],[6.5,1.4,r6]]; break;
      case "syncopated": // push-pull funk line: downbeat anchor, then off-beat pushes that land early
        L=[[0,0.7,r5],[1.5,0.45,r5],[2.5,0.7,r6],[3.75,0.45,r5],[4.5,0.7,r5],[5.75,0.45,f6],[6.5,0.7,r6],[7.25,0.45,r5]]; break;
      // ---- ODD-METER cells (2026-07; see BASS_CELL_LEN above) ----
      case "oompahpah":  // OOM-pah-pah ×2 (a 6-beat cell = two 3/4 measures): tuba root on 1,
        // chord "chicks" on 2+3; the second measure OOMs the fifth BELOW — the
        // classic alternating cabaret/polka tuba. Fits chordEvery 6/12 exactly.
        L=[[0,0.9,r5],[1,0.4,f6],[2,0.4,f6],[3,0.9,pchAdd(r5,-5)],[4,0.4,f6],[5,0.4,f6]]; break;
      case "waltzroot":  // dotted-half roots — one long root per 3/4 measure (the slow-waltz floor)
        L=[[0,2.85,r5]]; break;
      case "siciliana":  // 6/8 lilt (one 6-beat compound measure; engine beat = the 8th note):
        // dotted-8th/16th/8th per dotted-quarter group, walking root-fifth-octave
        L=[[0,1.4,r5],[1.5,0.45,f6],[2,0.9,r6],[3,1.4,r5],[4.5,0.45,f6],[5,0.9,r6]]; break;
      case "pedal":      // pedal-octave 8ths with chromatic passing tones into the bar turns
        L=[[0,0.42,r5],[0.5,0.42,r5],[1,0.42,r6],[1.5,0.42,r5],[2,0.42,r5],[2.5,0.42,r6],[3,0.42,r5],[3.5,0.42,pchAdd(r5,2)],
           [4,0.42,r5],[4.5,0.42,r5],[5,0.42,r6],[5.5,0.42,r5],[6,0.42,r5],[6.5,0.42,pchAdd(r6,-1)],[7,0.42,r6],[7.5,0.42,pchAdd(r5,-1)]]; break;
      default:           L=[[0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]];
    }
    return L;
    };
    const out=[];
    const CELL=BASS_CELL_LEN[kind]||CHORD_BEATS;   // 8 for every legacy cell — byte-identical stride
    for(let t0=0;t0<cb;t0+=CELL)
      for(const [o,d,p] of cell()){ if(t0+o>cb) continue; out.push({voice:"bass",beat:S+t0+o,dur:d,pch:p,amp:0.22}); }
    return out;
  }
  // E(k,n,rot) — euclidean rhythm (Bjorklund/Toussaint): the Strudel bd(3,16)
  // notation as a KIT dimension (FAUST-PORT.md "Strudel borrowings"). Returns
  // beat offsets across the 8-beat chord bar. `rot` rotates by whole PULSES —
  // the downbeat always keeps a hit while the internal long/short spacing
  // shifts — so the placement evolves per chord, deterministically (no rng).
  function euclidBeats(k,n,rot,cb){
    n=Math.max(1,n|0); k=Math.max(1,Math.min(n,k|0));
    const steps=[]; for(let i=0;i<n;i++) if((i*k)%n < k) steps.push(i);
    const base=steps[(((rot||0)%steps.length)+steps.length)%steps.length];
    return steps.map(s=>((s-base+n)%n)*((cb||CHORD_BEATS)/n)).sort((a,b)=>a-b);
  }
  // ---------- pulse-set rhythm lanes (KERNEL-V4 Phase 1) ----------
  // The 18 procedural kit bodies are now DATA: each kit is an ordered list of
  // lane ops interpreted by drumEvents in op order. ORDER IS LAW: downstream
  // humanity/transform passes consume rng per event, so emission order and
  // rng-draw order are part of the deterministic contract — these tables
  // transcribe the old procedural kits hit-for-hit, draw-for-draw (pinned
  // byte-identical by fixtures.js). Euclid is no longer an overlay that fights
  // the kit: a state euclid spec is lane NOTATION that replaces the matching
  // lane inside the same interpreter (open hats survive as accent identity).
  //
  // Op vocabulary (d: kick|snare|hat; a hit is [offset, amp, dur?]; dur>0.2
  // voices a hat as OPEN, exactly like the old h() helper):
  //   hits:[...]            static hits
  //   alt:[A,B]             ci odd ? A : B      (the old ci%2 ternaries)
  //   cyc:[...]             hits list picked by ci % length
  //   last:[A,B]            last chord of the cycle ? A : B
  //   pick:[A,B]            ONE rng draw chooses A (r<.5) or B
  //   p:X                   whole-op gate: one rng draw, emit only if r<X
  //   grid:{n,step=.5,from=0,amps,opens,open,sp}
  //                         lane grid: offset=from+i*step, amp=amps[i%len];
  //                         opens:{offs,a,dur} re-voices those steps as open
  //                         hats; open:DUR makes EVERY step open; sp gates
  //                         each step on its own rng draw.
  //   ride:{n,amps,skipAmp} the shuffle pair-loop: h(i), h(i+skip) — the skip
  //                         lands ON the swung-triplet grid (see below)
  //   skip:true             every offset in this op adds the triplet skip
  // Kit flag turn:false suppresses the end-of-cycle snare turn (halftime/
  // tribal/bossa/shuffle keep their own cells clean, as before).
  const KITS={
    kick:{ ops:[
      {d:"kick",hits:[[0,.65],[4,.65]]},
      {d:"hat",hits:[[3.5,.1],[7.5,.1]]} ]},
    full:{ ops:[
      {d:"kick",hits:[[0,.65],[2.5,.38],[4,.65],[6.5,.38]]},
      {d:"snare",hits:[[2,.42],[6,.42]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13]}} ]},
    open:{ ops:[
      {d:"kick",hits:[[0,.65],[2.5,.38],[4,.65],[6.5,.38]]},
      {d:"snare",hits:[[2,.42],[6,.42],[3.5,.16],[7.5,.16]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13],opens:{offs:[3.5,7.5],a:.16,dur:.3}}} ]},
    four:{ ops:[
      {d:"kick",hits:[[0,.6],[2,.6],[4,.6],[6,.6]]},
      {d:"snare",hits:[[2,.4],[6,.4]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12]}} ]},
    boombap:{ ops:[
      {d:"kick",hits:[[0,.62],[3,.4],[4.5,.45]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12,.08]}} ]},
    halftime:{ turn:false, ops:[
      {d:"kick",hits:[[0,.66]]},
      {d:"snare",hits:[[4,.55]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12]}} ]},
    onedrop:{ turn:false, ops:[   // reggae ONE DROP: beat 1 EMPTY (the signature absence);
      // kick + cross-stick land TOGETHER on beat 3 of each measure (offsets 2/6
      // of the 8-beat two-bar cell) — "the drop"; hats chop the skank
      // off-eighths. Cross-stick = quiet snare voice (the bossa/shuffle rim
      // convention); turn:false keeps the cell clean like the other roots kits.
      {d:"kick",hits:[[2,.64],[6,.64]]},
      {d:"snare",hits:[[2,.32],[6,.32]]},                           // cross-stick ON the drop
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.14,.09]}},           // the skank off-eighths
      {d:"snare",p:.35,alt:[[[3.5,.11]],[[7.5,.11]]]},              // occasional rim ghost pickup
      {d:"hat",p:.3,hits:[[7.5,.15,.3]]} ]},                        // open let-ring into the next bar
    trap:{ ops:[
      {d:"kick",hits:[[0,.6],[2.5,.45],[5,.45]]},
      {d:"snare",hits:[[4,.5]]},
      {d:"hat",grid:{n:16,amps:[.1]}},
      {d:"hat",hits:[[6,.09],[6.25,.09],[6.5,.09],[6.75,.09]]} ]},
    pulse:{ ops:[   // driving four with ghost snares + wandering push-kick; varies per chord
      {d:"kick",hits:[[0,.62],[2,.62],[4,.62],[6,.62]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"snare",alt:[[[5.5,.14]],[[3.75,.14]]]},
      {d:"snare",last:[[[7.25,.11]],[[1.75,.11]]]},
      {d:"kick",alt:[[[7.75,.3]],[[3.5,.26]]]},
      {d:"hat",grid:{n:16,amps:[.13,.07],opens:{offs:[3.5,7.5],a:.16,dur:.3}}} ]},
    techno:{ ops:[   // machine four: offbeat opens, minimal snare, rotating ghost perc
      {d:"kick",hits:[[0,.66],[2,.66],[4,.66],[6,.66]]},
      {d:"hat",grid:{n:8,step:1,from:1,amps:[.17],open:.28}},       // offbeat open hats
      {d:"hat",grid:{n:16,amps:[.09,.05]}},                         // 16th ride bed
      {d:"snare",p:.7,hits:[[2,.22],[6,.22]]},                      // snare is optional color
      {d:"hat",cyc:[[[1.75,.2]],[[3.25,.2]],[[5.75,.2]],[[7.25,.2]]]},   // the rotating ghost
      {d:"kick",p:.35,hits:[[7.5,.3]]} ]},
    house:{ ops:[   // four + claps on 2/4, skipping hats
      {d:"kick",hits:[[0,.62],[2,.62],[4,.62],[6,.62]]},
      {d:"snare",hits:[[2,.46],[6,.46]]},                           // claps
      {d:"hat",grid:{n:16,amps:[.11,.06,.16,.06]}},
      {d:"hat",alt:[[[4.5,.18,.3]],[[0.5,.18,.3]]]},                // open hat skips around
      {d:"snare",alt:[[[7.75,.13]],[]]} ]},
    breaks:{ ops:[   // mid-tempo broken beat — displaced kicks, dragged snares
      {d:"kick",hits:[[0,.68]]},
      {d:"kick",alt:[[[2.75,.46]],[[2.5,.46]]]},
      {d:"kick",pick:[[[4.5,.5]],[[5,.5]]]},
      {d:"snare",hits:[[2,.38],[6,.38]]},
      {d:"snare",alt:[[[5.25,.13]],[[3.75,.13]]]},
      {d:"snare",p:.4,hits:[[7.5,.15]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13,.08]}},
      {d:"hat",alt:[[[6.5,.15,.3]],[[2.5,.15,.3]]]} ]},
    jungle:{ ops:[   // chopped-break feel: the pattern itself mutates every chord
      {d:"kick",hits:[[0,.68],[2.75,.5]]},
      {d:"kick",alt:[[[5.5,.52]],[[6.25,.46]]]},
      {d:"snare",hits:[[1.5,.32],[4,.35]]},                         // displaced backbeats
      {d:"snare",cyc:[[[3.25,.15],[3.5,.19]],[[5.75,.15],[6,.19]],[[7,.15],[7.25,.19]],[[2.25,.15],[6.75,.19]]]},   // double-hit chop pair
      {d:"snare",p:.5,hits:[[7.75,.22]]},                           // edge-of-bar push
      {d:"hat",grid:{n:16,amps:[.09,.05],sp:.55}},                  // broken 16th hats (sparser)
      {d:"hat",alt:[[[3.5,.13,.3]],[[7.5,.13,.3]]]} ]},
    tribal:{ turn:false, ops:[   // full ritual kit: galloping kicks, BUSY hand-hats + open-hat swells, quiet tom accents
      {d:"kick",hits:[[0,.66],[0.75,.32],[2,.5],[2.5,.28],[4,.62],[4.75,.32],[6,.5]]},   // dense galloping low toms
      {d:"snare",hits:[[1.5,.26],[5.5,.26]]},                       // toms = snare voice, kept QUIET
      {d:"snare",alt:[[[3.5,.18]],[[7,.18]]]},
      {d:"hat",grid:{n:16,amps:[.12,.05,.09,.05],opens:{offs:[3.5,7.5],a:.16,dur:.32}}},   // 16th hand-hat bed + open swells
      {d:"hat",cyc:[[[1.25,.13,.26]],[[3.25,.13,.26]],[[5.25,.13,.26]],[[7.25,.13,.26]]]},   // rotating ghost open-hat
      {d:"hat",alt:[[[2.75,.10]],[[6.25,.10]]]},                    // extra syncopated shaker
      {d:"kick",p:.5,hits:[[7.5,.32]]} ]},                          // occasional pickup kick
    bossa:{ turn:false, ops:[   // surdo-soft kick with pickups, rim-click clave, gentle 8th hats
      {d:"kick",hits:[[0,.55],[3.5,.28],[4,.55],[7.5,.28]]},
      {d:"snare",alt:[[[1,.2],[2.5,.2],[4,.2],[5.5,.2],[7,.2]],[[0.5,.2],[2,.2],[4.5,.2],[6,.2],[7.5,.2]]]},   // 3-2 / 2-3 rim clave flips per chord
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.11,.07]}},
      {d:"hat",p:.3,hits:[[6.5,.13,.28]]} ]},                       // occasional soft open shaker
    electro:{ ops:[   // 1982 machine boom-bap: syncopated 808 kicks, claps 2+4, crisp accented 16th hats
      {d:"kick",hits:[[0,.66],[3.5,.42],[6,.5]]},
      {d:"kick",alt:[[[7.5,.3]],[]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"snare",p:.35,hits:[[7.75,.14]]},                          // clap ghosts push the bar
      {d:"hat",grid:{n:16,amps:[.11,.06,.14,.06]}},
      {d:"hat",alt:[[[3.5,.15,.28]],[[7.5,.15,.28]]]} ]},           // the open accent flips per chord
    shuffle:{ turn:false, ops:[   // blues shuffle: swung-TRIPLET ride line, rimshot-light 2/4, sparse kick.
      // The skip lands ON the triplet grid (beat + 2/3) scaled by state.swing —
      // at blues swing (.24-.42) it sits .63-.667 into the beat, a true shuffle.
      // These offbeats are NOT at f=0.5, so applyGroove never double-swings them.
      {d:"hat",ride:{n:8,amps:[.14,.11],skipAmp:.07}},              // ding ... ding-a ride
      {d:"snare",hits:[[2,.3],[6,.3]]},                             // light rim backbeat (brushes-soft)
      {d:"snare",skip:true,alt:[[[3,.09]],[[7,.09]]]},              // ghost drag into the turn
      {d:"kick",hits:[[0,.55],[4,.5]]},
      {d:"kick",p:.4,alt:[[[6,.3]],[[2,.3]]]},                      // sparse kick, occasional push
      {d:"hat",p:.3,skip:true,hits:[[7,.13,.3]]} ]},                // open let-ring into the next bar
    newjack:{ ops:[   // swingbeat: bouncing kicks, HUGE claps on 2/4, skippy 16th hats
      {d:"kick",hits:[[0,.64],[2.75,.4],[4.5,.5]]},
      {d:"kick",alt:[[[6.75,.34]],[[5.75,.34]]]},
      {d:"snare",hits:[[2,.58],[6,.58]]},
      {d:"snare",alt:[[[3.75,.16]],[[7.25,.16]]]},                  // ghost clap skips around
      {d:"hat",grid:{n:16,amps:[.12,.07],sp:.8}},                   // hats drop pulses — the skip
      {d:"hat",alt:[[[2.5,.16,.3]],[[6.5,.16,.3]]]} ]},
    // ---- ODD-METER kits (2026-07). Kit flag cell:N — the kit's own tiling
    // period in beats (default CHORD_BEATS=8, the 4/4 law): drumEvents strides
    // the op loop by `cell`, so a 3-beat waltz cell fills a 6- or 12-beat
    // chord bar measure-by-measure. turn:false throughout — the end-of-cycle
    // snare turn is a 4/4 figure (offsets 6.5-7.75 of an 8-beat cell) and
    // would smear the waltz turnaround.
    waltz:{ cell:3, turn:false, ops:[   // boom-chick-chick: kick owns 1, brushed snare answers 2+3
      {d:"kick",hits:[[0,.6]]},
      {d:"snare",hits:[[1,.3],[2,.28]]},
      {d:"hat",grid:{n:6,step:.5,from:0,amps:[.11,.06]}},           // light 8th bed, downbeats accented
      {d:"hat",alt:[[[2.5,.13,.3]],[]]} ]},                         // let-ring open into the next bar, alternating
    waltzswing:{ cell:3, turn:false, ops:[   // jazz-waltz ride: ding, ding-A(swung), ding — the skip
      // lands ON the swung-triplet grid exactly like the blues shuffle kit,
      // scaled by state.swing, so applyGroove never double-swings it.
      {d:"hat",hits:[[0,.15],[1,.12],[2,.13]]},
      {d:"hat",skip:true,hits:[[1,.07]]},                           // the "a" after 2
      {d:"snare",alt:[[[1,.2]],[[2,.18]]]},                         // cross-stick wanders 2 <-> 3
      {d:"kick",hits:[[0,.45]]},
      {d:"kick",p:.35,hits:[[2,.22]]} ]},                           // feathered pickup, occasional
    sixeight:{ cell:6, turn:false, ops:[   // compound lilt (engine beat = the 8th): kick on 1+4,
      // hats in two groups of three (STRONG-weak-weak — the dotted-quarter pulse)
      {d:"kick",hits:[[0,.64],[3,.5]]},
      {d:"snare",alt:[[[3,.34]],[[3,.34],[5.5,.12]]]},              // backbeat on the 2nd dotted-quarter (+ pickup ghost)
      {d:"hat",grid:{n:6,step:1,from:0,amps:[.15,.07,.09]}},
      {d:"hat",cyc:[[[5,.14,.3]],[],[[2,.13,.3]],[]]} ]},           // the lilting open hat rotates
  };
  // Euclid lanes as DATA (KERNEL-V4 §3.1 — "euclid stops being an overlay that
  // fights the kit; it is the kit's notation"). A state.euclid spec
  // {kick:[k,n], hat:[k,n], snare:[k,n]} REPLACES that drum's kit lane with an
  // E(k,n) onset set (euclidBeats is the onset math). This table is the
  // notation: per euclid-able drum, the amp shape — `head` is the downbeat
  // accent (pulse j===0) when non-null, otherwise `amps` cycles by pulse index
  // j — and `keepOpen` says the kit's OPEN hats survive the replace (they're
  // the kit's accent identity; euclid re-places only the closed grid / the kick
  // / the clap line). Interpreted by the same k/s/h emit helpers as the kits.
  const EUCLID_LANES=[
    { drum:"kick",  keepOpen:false, head:.64, amps:[.48] },
    { drum:"hat",   keepOpen:true,  head:null, amps:[.12,.07] },   // closed 16th grid; opens survive
    { drum:"snare", keepOpen:false, head:.50, amps:[.36] },        // electro E(3,16) tresillo CLAPS
  ];
  const euclidAmp=(lane,j)=>(j===0&&lane.head!=null)?lane.head:lane.amps[j%lane.amps.length];
  // the ~40-line lane interpreter (replaces ~100 lines of per-kit JS).
  // cb = beats per chord bar (state.chordEvery; default CHORD_BEATS=8). Kits
  // are 8-beat cells: chordEvery>8 tiles the cell across the bar, <8 truncates
  // (draws still happen — determinism is draw-count law, emission is a filter).
  function drumEvents(kind,S,ci,nc,rng,eu,sw,cb){
    cb=cb||CHORD_BEATS;
    const R=rng||(()=>0.5);   // static kits never call R; conditional lanes vary per chord + seed
    const out=[];
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.35,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.30,amp:a});
    const h=(o,a,dur)=>out.push({drum:"hat",beat:S+o,dur:dur||0.10,amp:a,open:(dur||0)>0.2});
    const EM={kick:k,snare:s,hat:h};
    const kit=KITS[kind];
    if(kit){
      const skip=0.5+(2/3-0.5)*Math.max(0,Math.min(1,(sw||0)/0.3));
      const CELL=kit.cell||CHORD_BEATS;   // odd-meter kits tile by their own period; legacy kits keep the 8-beat stride byte-identically
      for(let t0=0;t0<cb;t0+=CELL){
        for(const op of kit.ops){
          if(op.p!=null && R()>=op.p) continue;                     // whole-op gate: exactly one draw
          const em=EM[op.d];
          const put=(o,a,d)=>{ if(op.skip)o+=skip; if(t0+o<=cb) em(t0+o,a,d); };   // <=: legacy cells spill onto the next downbeat (techno opens end at o=8)
          if(op.ride){ const rd=op.ride;
            for(let i=0;i<rd.n;i++){ if(t0+i<=cb) em(t0+i, rd.amps[i%rd.amps.length]);
              if(t0+i+skip<=cb) em(t0+i+skip, rd.skipAmp); }
            continue; }
          if(op.grid){ const g=op.grid, st=g.step!=null?g.step:0.5, fr=g.from||0;
            for(let i=0;i<g.n;i++){
              if(g.sp!=null && R()>=g.sp) continue;                 // per-step gate: one draw per step
              const o=fr+i*st;
              if(g.open) put(o,g.amps[i%g.amps.length],g.open);
              else if(g.opens && g.opens.offs.indexOf(o)>=0) put(o,g.opens.a,g.opens.dur);
              else put(o,g.amps[i%g.amps.length]);
            }
            continue; }
          const hs = op.alt ? op.alt[ci%2?0:1]
                   : op.cyc ? op.cyc[ci%op.cyc.length]
                   : op.last ? op.last[ci===nc-1?0:1]
                   : op.pick ? op.pick[R()<0.5?0:1]
                   : op.hits;
          for(const hh of hs) put(hh[0],hh[1],hh[2]);
        }
      }
    }
    // euclid = lane NOTATION over the kit, driven by the EUCLID_LANES data table.
    // WHY THIS STAYS A ONCE-PER-BAR POST-PASS AND NOT AN INLINE OP (the one
    // justified-procedural remnant of kit-as-data): a euclid spec REPLACES an
    // already-emitted kit lane, and byte-identity pins three things an inline op
    // can't give — (a) it must preserve every kit rng draw for the lane it
    // shadows (the kit's p/sp/pick gates already fired in the op loop above, and
    // their draws are law even when their hits get replaced); (b) it drops only
    // CLOSED hats while keeping OPEN ones, a per-EVENT distinction an op-level
    // skip can't see; (c) its onsets must land at the END of `out` in
    // kick→hat→snare order (array order = downstream rng-draw order). All three
    // are naturally a filter-then-append over the finished kit output. Rotation
    // advances per global chord (gci) — DETERMINISTIC, no rng draw.
    if(eu&&kind!=="off"){
      const gci=Math.round(S/cb);
      for(const lane of EUCLID_LANES){
        const spec=eu[lane.drum];
        if(!spec||!spec.length) continue;
        for(let i=out.length-1;i>=0;i--)
          if(out[i].drum===lane.drum&&(!lane.keepOpen||!out[i].open)) out.splice(i,1);
        euclidBeats(spec[0],spec[1],gci,cb).forEach((o,j)=>EM[lane.drum](o,euclidAmp(lane,j)));
      }
    }
    if(ci===nc-1 && kind!=="off" && (!kit || kit.turn!==false)){   // end-of-cycle snare turn
      const tb=cb-CHORD_BEATS;
      [[6.5,.3],[7,.34],[7.25,.38],[7.5,.42],[7.75,.46]].forEach(([o,a])=>{ if(tb+o>=0) s(tb+o,a); });
    }
    return out;
  }
  function fillEvents(S){
    return [{drum:"snare",beat:S+0,dur:0.25,amp:0.34},{drum:"snare",beat:S+0.5,dur:0.25,amp:0.36},
      {drum:"snare",beat:S+1,dur:0.22,amp:0.40},{drum:"snare",beat:S+1.25,dur:0.20,amp:0.42},
      {drum:"snare",beat:S+1.5,dur:0.20,amp:0.45},{drum:"snare",beat:S+1.75,dur:0.20,amp:0.48},
      {drum:"kick",beat:S+0,dur:0.30,amp:0.55}];
  }
  // the big one — four beats, halves into quarters into a crescendo roll
  // ("In the Air Tonight" energy; crank instruments.drums.send to gate-wash it).
  // rng varies the roll (straight 16ths vs triplets) and adds flams, so no two
  // fills in a song are identical.
  function bigFillEvents(S,rng){
    const r=rng||Math.random;
    const out=[];
    // dur is always < the spacing so toms never overlap/stumble
    const t=(o,a,p,d)=>out.push({drum:"tom",beat:S+o,dur:d,amp:a,pitch:p});
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.4,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.3,amp:a});
    const T=[152,130,112,95,80,66];                        // deep toms, hi -> lo
    k(0,.6);
    const v=Math.floor(r()*4);                             // four variants -> each fill differs
    if(v===0){                                             // LINEAR snare<->tom 16ths, descending (Peart-ish)
      const seq=[1,0,2,0, 0,3,4,0, 2,3,0,4, 5,5,0,5];      // 0 = snare, else tom index
      for(let i=0;i<16;i++){ const o=i*0.25, x=seq[i];
        if(x===0) s(o,.5+r()*0.18); else t(o,.76+r()*0.14,T[x],0.2); }
      k(2,.5);
    } else if(v===1){                                      // tom doubles answered by snare, syncopated
      s(0,.6); t(0.5,.8,T[1],0.22); t(0.75,.8,T[2],0.22);
      s(1.25,.58); t(1.75,.82,T[3],0.22); t(2,.84,T[3],0.22);
      s(2.5,.6); t(2.75,.84,T[4],0.22); t(3,.86,T[4],0.2); t(3.25,.86,T[5],0.2); s(3.5,.6); t(3.75,.9,T[5],0.2);
      k(2,.45);
    } else if(v===2){                                      // triplet tom roll w/ snare accents
      const tr=2.0/3;
      for(let i=0;i<6;i++){ const o=i*tr; (i%3===0)?s(o,.6):t(o,.8+r()*0.1,T[Math.min(1+i,5)],tr*0.8); }
      for(let i=0;i<3;i++){ const o=2+i*tr; t(o,.84,T[Math.min(3+i,5)],tr*0.8); }
      s(3.34,.6); t(3.67,.9,T[5],0.2);
    } else {                                               // snare buzz building into a deep tom tumble
      let o=0,a=.34; while(o<1.75){ s(o,a); a=Math.min(.62,a+0.03); o+=0.25; }
      t(2,.8,T[1],0.22); s(2.25,.55); t(2.5,.82,T[2],0.22); t(2.75,.84,T[3],0.22);
      s(3,.6); t(3.25,.86,T[4],0.2); t(3.5,.88,T[5],0.2); t(3.75,.9,T[5],0.2);
    }
    k(3.75,.62);
    return out;
  }
  // snare-roll crescendo — a full bar of straight 16ths swelling into the next
  // downbeat (the march/big-band build; rng breathes the individual hit levels)
  function snareRollEvents(S,rng){
    const r=rng||Math.random, out=[];
    out.push({drum:"kick",beat:S,dur:0.3,amp:0.5});
    for(let i=0;i<16;i++) out.push({drum:"snare",beat:S+i*0.25,dur:0.16,amp:0.1+(i/16)*0.38+r()*0.04});
    out.push({drum:"kick",beat:S+3.75,dur:0.3,amp:0.6});
    return out;
  }
  // transition MICRO-LICK — the musical alternative to the noise sweep: a
  // 1-2 bar seeded pickup phrase (pentatonic climb, chromatic approach run,
  // enclosure turn…) that lands ON the next section's downbeat root, played
  // by state.lickVoice (a tiny sax/trombone/trumpet/flute/piano/guitar solo
  // voice the kernel assigns per genre). kNext = the NEXT section's key
  // (keyShift-aware) so the run resolves into the new key, not the old one.
  // The landing note may carry a blue-note bend (sampler voices slide in;
  // Faust-module voices ignore `bend` per the VOICES.md contract).
  function lickEvents(endBeat, chord, kNext, rng, lickVoice){
    const out=[];
    const minor=/min/.test(chord.name)&&!/maj/.test(chord.name);
    const tgt=pchAdd(chord.lead[0],kNext);         // the next downbeat's root
    const third=minor?3:4;
    const RUNS=[
      [-12,third-12,-5,-3,-1],                     // pentatonic climb into the root
      [-5,-4,-3,-2,-1],                            // chromatic approach run
      [third-12,-5,2,1],                           // enclosure turn (under, over, in)
      [7,third,2,-2],                              // fall from the fifth, slip under, resolve
      [-12,-10,-8,-7,-5,-3,-2,-1],                 // the long two-bar walkup
    ];
    const run=RUNS[Math.floor(rng()*RUNS.length)];
    const step=run.length>5?0.5:[0.5,0.5,0.75][Math.floor(rng()*3)];
    const start=endBeat-run.length*step;
    run.forEach((semi,i)=>{
      if(rng()<0.08&&i>0) return;                                  // licks breathe too
      out.push({voice:"melody",beat:start+i*step,dur:step*0.92,pch:pchAdd(tgt,semi),
        amp:0.14+0.05*(i/run.length)+rng()*0.015,solo:lickVoice});
    });
    const land={voice:"melody",beat:endBeat,dur:1.4,pch:tgt,amp:0.19,solo:lickVoice};
    if(rng()<0.45) land.bend={from:-(0.5+rng()*0.5),ms:Math.round(70+rng()*70)};
    out.push(land);
    return out;
  }
  // transition KIT FILL — a half-bar mini-fill that QUOTES the section's own
  // drum pattern (not generic toms): the kit's final two beats crescendo and
  // each hit may gain a double (ply of the pattern's own hits) into the turn.
  function miniFillEvents(drums, endBeat, rng){
    const from=endBeat-2, out=[];
    const win=drums.filter(d=>d.beat>=from&&d.beat<endBeat);
    if(!win.length) return;   // beatless section: silence IS the transition (no generic snares here)
    for(const d of win){
      const pos=(d.beat-from)/2;
      d.amp=Math.min(1,d.amp*(1+0.32*pos));                      // crescendo the quote itself (gentle — the QUOTE is the fill)
      if(rng()<0.6&&d.beat+0.25<endBeat)
        out.push(Object.assign({},d,{beat:d.beat+0.25,dur:Math.min(d.dur,0.14),
          amp:Math.min(1,d.amp*(0.5+0.25*pos)),open:false}));    // the double-hit echo
    }
    if(rng()<0.7) out.push({drum:"kick",beat:endBeat-0.25,dur:0.3,amp:0.42});  // pickup into the downbeat
    out.forEach(e=>drums.push(e));
  }
  // jungle-style chop fill — two beats of 32nd-flavored snare stutter
  function breakFillEvents(S,rng){
    const r=rng||Math.random, out=[];
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.18,amp:a});
    out.push({drum:"kick",beat:S+0,dur:0.3,amp:0.6});
    let o=0,a=0.17;
    while(o<2){ s(o,a); a=Math.min(0.4,a+0.03); o+=(r()<0.4?0.125:0.25); }
    return out;
  }
  // ---------- VARIETY-PASS FILLS (2026-07) — all new named ⚡ options ----------
  // FLAM ROLL — a snappy 2-beat snare roll where each main hit carries a tight
  // grace-note "flam" (a quiet hit ~1/32 ahead), the whole thing crescendoing.
  function flamRollEvents(S,rng){
    const r=rng||Math.random, out=[];
    out.push({drum:"kick",beat:S,dur:0.3,amp:0.5});
    for(let i=0;i<8;i++){ const o=i*0.25, a=0.2+i*0.035+r()*0.03;
      out.push({drum:"snare",beat:S+o-0.06,dur:0.08,amp:a*0.45});     // the flam grace
      out.push({drum:"snare",beat:S+o,dur:0.16,amp:a}); }
    out.push({drum:"kick",beat:S+1.75,dur:0.3,amp:0.55});
    return out;
  }
  // TOM CASCADE — a melodic descending tom run down the whole kit (2 beats),
  // hi->lo, landing on a kick+low-tom slam (surf/prog energy, distinct from
  // bigFill's variant rolls).
  function tomCascadeEvents(S,rng){
    const r=rng||Math.random, out=[];
    const T=[150,132,116,102,90,80,70,62];
    for(let i=0;i<8;i++) out.push({drum:"tom",beat:S+i*0.25,dur:0.2,amp:0.62+r()*0.14,pitch:T[i]});
    out.push({drum:"kick",beat:S+2,dur:0.4,amp:0.6});
    out.push({drum:"tom",beat:S+2,dur:0.4,amp:0.7,pitch:58});
    return out;
  }
  // CRASH CHOKE — a hard crash on the (next) downbeat that is instantly CHOKED
  // (very short dur), set up by a quick two-tom pickup: the punctuating stop-hit
  // (metal/rock accents). S is the fill start; the crash lands on S+2.
  function crashChokeEvents(S,rng){
    const r=rng||Math.random, out=[];
    out.push({drum:"tom",beat:S+1,dur:0.22,amp:0.6+r()*0.1,pitch:120});
    out.push({drum:"tom",beat:S+1.5,dur:0.22,amp:0.66+r()*0.1,pitch:96});
    out.push({drum:"kick",beat:S+2,dur:0.4,amp:0.62});
    out.push({drum:"crash",beat:S+2,dur:0.18,amp:0.9});             // the choke: crash cut SHORT
    return out;
  }
  // TAPE STOP — a decelerating, pitch-dropping retrigger of the last hit that
  // approximates a tape halt: widening gaps + a descending tom pitch + a fade,
  // over the final 2 beats (doom/sludge/vaporwave gesture).
  function tapeStopEvents(S,rng){
    const r=rng||Math.random, out=[];
    let o=0, gap=0.16, pitch=150, a=0.5;
    while(o<2){ out.push({drum:"tom",beat:S+o,dur:Math.min(0.3,gap*0.9),amp:a,pitch});
      o+=gap; gap*=1.34; pitch*=0.86; a*=0.9; }                     // slowing + falling = the tape drag
    return out;
  }
  // generative melody phrases: [beatOffset, dur, leadIndex, octaveShift] over an
  // 8-beat chord — each style has a distinct rhythm + contour (not just chord arps).
  const MEL_PHRASES={
    arpup:   [[0,1,0,0],[1,0.5,1,0],[1.5,0.5,2,0],[2,1,3,0],[3,1,2,0],[4,1,3,0],[5,1,0,1],[6,2,2,1]],
    arpdown: [[0,1.5,3,1],[1.5,0.5,2,1],[2,1,3,0],[3,1,2,0],[4,1,1,0],[5,1,2,0],[6,2,0,0]],
    updown:  [[0,1,0,0],[1,1,2,0],[2,1,3,0],[3,1,2,1],[4,1,3,0],[5,1,2,0],[6,1,1,0],[7,1,0,0]],
    pentaup: [[0,0.5,0,0],[0.5,0.5,2,0],[1,1,3,0],[2,0.5,1,1],[2.5,0.5,3,0],[3,1,0,1],[4.5,0.5,2,0],[5,1,3,0],[6,2,0,1]],
    // "hero" — 16th-note runs, syncopation, octave leaps; A/B variants alternate
    // per chord so the line evolves across the progression (supersaw fuel)
    hero:  [[0,.5,0,0],[.5,.5,1,0],[1,.5,2,0],[1.5,.5,3,0],[2,.75,2,1],[2.75,.25,3,0],[3,.5,1,0],[3.5,.5,2,0],[4,.5,3,1],[4.5,.5,2,0],[5,.75,0,1],[5.75,.25,3,0],[6,.5,2,0],[6.5,.5,1,0],[7,1,0,1]],
    // blues lick: leans on the b7 (idx 3 of a dom7 voicing) with swung phrasing
    blues: [[0,.75,3,0],[1,.25,2,0],[1.5,.5,3,0],[2,1.5,0,1],[4,.75,3,0],[5,.25,2,0],[5.5,.5,1,0],[6,1.75,0,0]],
    hero2: [[0,.25,3,0],[.25,.25,2,0],[.5,.5,3,0],[1,.5,2,1],[1.5,.5,1,0],[2,.5,2,0],[2.5,.5,3,0],[3,1,2,1],[4,.25,0,1],[4.25,.25,1,0],[4.5,.5,2,0],[5,.5,3,0],[5.5,.5,2,1],[6,.5,1,0],[6.5,.5,3,0],[7,.5,2,0],[7.5,.5,0,1]],
    // anthemic, hymn-like: fewer notes that work harder — dotted/syncopated rhythm,
    // held notes, octave-leap payoff, space. A/B alternate per chord for variation.
    anthem:  [[0,1.5,0,0],[1.5,.5,1,0],[2,1.5,3,0],[3.5,.5,2,0],[4,2,3,1],[6,1.5,0,1],[7.5,.5,2,0]],
    anthem2: [[0,2,2,0],[2,1,3,0],[3,1,2,0],[4,1.5,0,1],[5.5,.5,1,0],[6,2,3,0]],
    // MIDI-trove MINED cells (tools/mine-melody.js, 2026-07-15): each is the
    // MEDOID real phrase of its corpus's MODAL 8-beat rhythm (typicality
    // selects against hooks; the 8-slot voicing quantization keeps it a
    // contour, not a quotation — SOURCES.md). A/B pairs alternate per chord
    // via the generic twin rule in melodyEvents.
    // folk (pdmusic, 5628 lines; fingerprint sync16 .08, step .49): quarters,
    // an arch that walks home — narrow, on-beat, singable
    folkline:  [[0,1,0,1],[1,1,2,1],[2,1,3,1],[3,1,3,1],[4,1,3,1],[5,1,3,1],[6,1,0,1],[7,1,0,0]],
    folkline2: [[0,.5,0,1],[.5,.5,0,0],[1,.5,1,0],[1.5,.5,2,0],[2,.5,1,1],[2.5,.5,0,1],[3,.5,0,1],[3.5,.5,3,1],[4,.5,0,1],[4.5,.5,0,1],[5,.5,1,1],[5.5,.5,0,1],[6,.5,0,1],[6.5,.5,0,0],[7,.5,1,0],[7.5,.5,0,0]],
    // jazz (thejazzpage, 307 lines; sync16 .66, step .48): A = the descending
    // 8th-note line; B = ENTIRELY off-beat 16th placements (the comping push)
    jazzline:  [[0,.5,2,1],[.5,.5,1,1],[1,.5,3,1],[1.5,.5,2,1],[2,.5,1,1],[2.5,.5,0,1],[3,.5,1,1],[3.5,.25,2,0],[4,.5,2,0],[4.5,.5,1,0],[5,.5,1,0],[5.5,.5,3,0],[6,.5,0,0],[6.5,.5,2,0],[7,.5,0,1],[7.5,.5,2,1]],
    jazzline2: [[.25,.5,0,0],[.75,.5,3,1],[1.25,.5,2,1],[1.75,.5,0,1],[2.25,.5,3,0],[2.75,.5,3,0],[3.25,.5,1,0],[3.75,.5,3,0],[4.25,.5,1,0],[4.75,.5,3,0],[5.25,.5,0,0],[5.75,.5,1,0],[6.25,.5,1,0],[6.75,.5,2,0],[7.25,.5,2,0],[7.75,.25,3,0]],
    // ragtime (rtpress, 225 skyline lines; sync16 .81, step .21): dense
    // syncopated 16th runs — the right hand of the rag (skyline caveat stated
    // in mine-melody.js; solo-piano corpus, the skyline IS the tune)
    ragline:   [[0,.25,1,0],[.25,.5,0,0],[.75,.25,0,1],[1,.25,0,1],[1.5,.25,1,1],[1.75,.25,2,1],[2.25,.25,1,0],[2.5,.25,2,1],[3,.25,1,0],[3.25,.5,2,1],[3.75,.25,1,0],[4,.25,2,1],[4.5,.25,1,0],[4.75,.25,3,1],[5.25,.25,1,0],[5.5,.25,3,1],[6,.25,1,0],[6.25,.25,2,1],[6.75,.25,1,0],[7,.25,2,1],[7.5,.25,0,1],[7.75,.25,2,1]],
    ragline2:  [[0,.25,0,0],[.5,.25,0,1],[.75,.5,1,0],[1.25,.25,1,1],[1.5,.5,2,0],[2,.25,2,1],[2.25,.5,3,0],[2.75,.25,2,1],[3,.5,0,1],[3.5,.25,3,1],[3.75,.5,3,0],[4.25,.25,2,1],[4.5,.5,2,0],[5,.25,2,1],[5.25,.5,1,0],[5.75,.25,1,1],[6,.25,0,0],[6.5,.25,0,1],[6.75,.5,1,0],[7.25,.25,1,1],[7.5,.5,2,0]],
    // dub (96 melodica-grade lines; sync16 .34, repeat .31, range 8): A = the
    // staccato repeated-note riff falling to a held root, with real SPACE
    // (beats 3-4.5 rest); B = near-silence, a 4-note answer at the bar's tail
    dubline:   [[0,.25,1,1],[.5,.25,3,1],[1,.25,3,1],[1.5,.25,3,1],[2,.25,3,1],[2.5,.25,3,1],[3,.25,3,1],[4.5,.25,0,1],[5,.25,0,0],[5.5,.25,0,1],[6,1,0,0]],
    dubline2:  [[5.5,.25,0,0],[6,.25,3,1],[6.25,.25,1,1],[6.5,.25,0,0]]
  };
  // ---- MINED-WEAVE BEGIN (tools/mine-weave.js — do not hand-edit) ----
  // The mined melody ORGAN (2026-07-15): per-family Markov walks in the engine's
  // own alphabet — pitch over the 8-slot voicing ladder (idx 0..3 × oct 0..1),
  // rhythm over quantized IOIs. Fit on the trove corpus, held-out-gated
  // against the wander baseline (the tool refuses a losing family). Opt-in
  // via lead pattern names (keys below); unwired states byte-identical.
  const MINED_WEAVE={"folkweave":{"start":[0.2519,0.0577,0.0814,0.095,0.1314,0.0958,0.0592,0.2276],"slot":[[0.2902,0.1412,0.1353,0.1029,0.1081,0.0613,0.0296,0.1313],[0.322,0.1835,0.1619,0.1026,0.1183,0.0236,0.0223,0.0658],[0.2468,0.1147,0.1891,0.1676,0.1374,0.0605,0.0186,0.0652],[0.1576,0.0728,0.1566,0.1888,0.198,0.0944,0.046,0.0859],[0.1074,0.0528,0.1099,0.1585,0.2197,0.1597,0.055,0.137],[0.0711,0.0095,0.0509,0.0989,0.2582,0.2255,0.1,0.1859],[0.053,0.0202,0.0178,0.063,0.1417,0.2267,0.2101,0.2674],[0.0941,0.0206,0.0321,0.041,0.1194,0.1937,0.2016,0.2976]],"ioiStart":[0.1946,0.4342,0.0687,0.1947,0.0551,0.0347,0.0141,0.0038],"ioi":[[0.5205,0.1905,0.1293,0.0894,0.0387,0.0194,0.0109,0.0012],[0.051,0.6517,0.0412,0.1483,0.0617,0.03,0.0144,0.0017],[0.9523,0.0229,0.0152,0.0054,0.0017,0.002,0.0005,0],[0.0352,0.2903,0.0887,0.4252,0.0711,0.0635,0.0231,0.0029],[0.0779,0.7954,0.0135,0.0613,0.0434,0.0063,0.0017,0.0004],[0.0459,0.336,0.0742,0.3839,0.0774,0.0773,0.005,0.0003],[0.0327,0.3377,0.1233,0.4248,0.0433,0.0282,0.0099,0.0001],[0.0306,0.1867,0.0453,0.3212,0.3178,0.0939,0.0043,0.0002]],"legato":0.875,"step":0.477},"jazzweave":{"start":[0.2427,0.0539,0.0751,0.0695,0.1205,0.0896,0.0864,0.2623],"slot":[[0.173,0.1947,0.1502,0.1064,0.1184,0.0698,0.058,0.1294],[0.2888,0.1571,0.2116,0.1254,0.0767,0.0384,0.043,0.0589],[0.1929,0.1684,0.1499,0.2044,0.1357,0.0664,0.0303,0.052],[0.1143,0.0917,0.1809,0.1608,0.2405,0.1059,0.0392,0.0666],[0.0996,0.0457,0.0987,0.178,0.2126,0.1832,0.0854,0.0968],[0.0669,0.023,0.0582,0.0948,0.2326,0.2022,0.1759,0.1464],[0.0579,0.0203,0.0276,0.0446,0.1432,0.2204,0.2325,0.2536],[0.1132,0.021,0.029,0.0361,0.0911,0.1465,0.2909,0.2721]],"ioiStart":[0.4382,0.2842,0.113,0.1042,0.0225,0.0215,0.0105,0.0059],"ioi":[[0.6527,0.1523,0.1283,0.0383,0.0127,0.0077,0.005,0.003],[0.2305,0.5817,0.0595,0.0814,0.0194,0.0147,0.0083,0.0045],[0.5065,0.1503,0.1117,0.1481,0.0138,0.0414,0.0234,0.0048],[0.178,0.2376,0.1841,0.2951,0.0363,0.0453,0.0183,0.0053],[0.3069,0.276,0.052,0.1971,0.0589,0.076,0.02,0.0131],[0.2432,0.2285,0.1196,0.2024,0.0992,0.0833,0.0187,0.0051],[0.4602,0.2471,0.0878,0.1651,0.0199,0.0105,0.0082,0.0012],[0.3951,0.2924,0.1362,0.1094,0.0379,0.0201,0.0067,0.0022]],"legato":0.833,"step":0.438},"guitarweave":{"start":[0.1885,0.0706,0.08,0.0877,0.1309,0.1207,0.1165,0.205],"slot":[[0.216,0.1536,0.1118,0.094,0.1132,0.0964,0.0889,0.1261],[0.2323,0.1797,0.1783,0.1075,0.101,0.0637,0.0685,0.0689],[0.1388,0.161,0.1757,0.1895,0.1373,0.0761,0.0533,0.0683],[0.0985,0.0773,0.1749,0.174,0.2296,0.1095,0.0672,0.0691],[0.0834,0.0498,0.0823,0.1679,0.2371,0.1972,0.0953,0.0871],[0.0735,0.0325,0.0471,0.0784,0.2237,0.2471,0.181,0.1168],[0.0697,0.0361,0.0327,0.0455,0.1009,0.2303,0.2859,0.1988],[0.1041,0.0369,0.0434,0.0485,0.0896,0.1225,0.2579,0.2972]],"ioiStart":[0.4856,0.3781,0.0221,0.0847,0.0146,0.0109,0.0031,0.0009],"ioi":[[0.838,0.104,0.023,0.0229,0.0062,0.0038,0.0016,0.0005],[0.1366,0.7543,0.0122,0.0705,0.016,0.0078,0.0022,0.0004],[0.832,0.0878,0.0263,0.0408,0.0074,0.004,0.0012,0.0005],[0.1146,0.3435,0.0463,0.4225,0.0269,0.0368,0.0076,0.0019],[0.2261,0.5436,0.0173,0.0894,0.1023,0.0153,0.0049,0.0011],[0.1515,0.3299,0.0525,0.2985,0.0415,0.1124,0.012,0.0016],[0.2641,0.2898,0.0554,0.2851,0.0454,0.0345,0.0254,0.0002],[0.2355,0.3466,0.0383,0.2653,0.0446,0.054,0.0149,0.0008]],"legato":1,"step":0.392},"classicalweave":{"start":[0.219,0.0699,0.0809,0.0818,0.1228,0.0988,0.0873,0.2396],"slot":[[0.2525,0.1753,0.1176,0.0832,0.0923,0.0678,0.0567,0.1545],[0.2576,0.2006,0.1918,0.0923,0.0893,0.0492,0.053,0.0662],[0.1459,0.1821,0.1871,0.1879,0.1216,0.0677,0.0431,0.0647],[0.0978,0.0791,0.2056,0.1768,0.226,0.0932,0.0545,0.067],[0.0788,0.0551,0.0912,0.1845,0.2346,0.1807,0.0806,0.0946],[0.0597,0.0332,0.0548,0.0847,0.2394,0.2345,0.169,0.1247],[0.0573,0.039,0.0377,0.0493,0.11,0.2287,0.2572,0.2209],[0.1289,0.0391,0.0484,0.0484,0.0977,0.1186,0.2107,0.3081]],"ioiStart":[0.5317,0.299,0.0266,0.0939,0.0203,0.0206,0.0058,0.0021],"ioi":[[0.8575,0.0883,0.0194,0.0205,0.0075,0.0047,0.0015,0.0007],[0.1552,0.7128,0.0224,0.0681,0.0222,0.0138,0.0042,0.0014],[0.633,0.1442,0.1039,0.0674,0.0209,0.0183,0.0087,0.0037],[0.1187,0.2299,0.0405,0.4884,0.0372,0.0645,0.0166,0.0043],[0.264,0.4814,0.0335,0.0773,0.1062,0.0246,0.01,0.0029],[0.1304,0.2403,0.0511,0.3273,0.0594,0.1686,0.02,0.0029],[0.1911,0.2407,0.0775,0.3464,0.0595,0.0571,0.0266,0.0011],[0.2556,0.3104,0.0726,0.2386,0.0747,0.0439,0.004,0.0003]],"legato":0.979,"step":0.445}};
  // ---- MINED-WEAVE END ----
  // ---- MUSIC-MIND melody rhythm cells (state.rhythm) ----
  // Named onset grids an existing phrase gets RE-TIMED onto — pitch material
  // untouched, rhythm only (the taste law: the notes are the genre's, the
  // groove is the knob's). Each cell is one 8-beat bar: `on` = allowed onsets,
  // `du` = the slot's natural duration (a note keeps min(its dur, slot dur) so
  // re-timing never smears across the next slot or the barline).
  const MM_CELLS=[
    { on:[0,1.5,2,3.5,4,5.5,6,7.5], du:[1.4,0.45,1.4,0.45,1.4,0.45,1.4,0.45] },  // dotted pairs (long-short lilt)
    { on:[0,1.5,3,4,5.5,7],         du:[1.4,1.4,0.9,1.4,1.4,0.9] },              // tresillo ×2 (3-3-2 at the 8th grid)
    { on:[0,3,6],                   du:[2.8,2.8,1.8] },                          // 3-3-2 in whole beats — per-bar it tiles to 3-3-2-3-3-2 across two bars
  ];
  // ODD-METER cell families (2026-07): measure-length grids the retime pass
  // uses INSTEAD of the 8-beat MM_CELLS when state.meter is present (same
  // single rng draw per fired bar — the meterless path is untouched). Cells
  // are ONE MEASURE long; mmTile tiles them to the chord bar so chordEvery
  // 6/12 both stay on the measure grid.
  const MM_CELLS_3=[   // one 3/4 measure
    { on:[0,1,2],   du:[0.9,0.9,0.9] },     // even quarters (the plain waltz bar)
    { on:[0,1.5,2], du:[1.4,0.45,0.9] },    // dotted lilt (long-short-medium)
    { on:[0,2],     du:[1.9,0.9] },         // minuet long-short
  ];
  const MM_CELLS_6=[   // one 6/8 measure (beat = the 8th)
    { on:[0,1,2,3,4,5],       du:[0.9,0.9,0.9,0.9,0.9,0.9] },        // running 8ths
    { on:[0,1.5,2,3,4.5,5],   du:[1.4,0.45,0.9,1.4,0.45,0.9] },      // siciliana lilt ×2
    { on:[0,3],               du:[2.8,2.8] },                        // the two dotted-quarter pulses
  ];
  function mmTile(cell,mlen,cb){
    const on=[],du=[];
    for(let t=0;t<cb;t+=mlen) for(let i=0;i<cell.on.length;i++){
      if(t+cell.on[i]>=cb) continue;
      on.push(t+cell.on[i]); du.push(cell.du[i]);
    }
    return {on,du};
  }
  // Snap a bar's melody notes onto a cell: each note (in onset order) takes its
  // NEAREST free grid slot, overflow walks forward to the next free slot (a
  // deterministic allocator — no rng in here; the CALLER draws fire+cell picks
  // on the dedicated seed+52200 stream). A phrase with more notes than slots
  // leaves the un-slottable remainder untouched rather than stacking unisons.
  function mmRetime(notes,b0,cell){
    const N=cell.on.length, taken=new Array(N).fill(false);
    const sorted=notes.slice().sort((a,b)=>a.beat-b.beat);
    for(const e of sorted){
      const rel=e.beat-b0; let bi=0,bd=Infinity;
      for(let i=0;i<N;i++){ const d=Math.abs(cell.on[i]-rel); if(d<bd){bd=d;bi=i;} }
      let j=bi,hop=0;
      while(taken[j]&&hop<N){ j=(j+1)%N; hop++; }
      if(taken[j]) continue;                       // grid full — the note keeps its own time
      taken[j]=true;
      e.beat=b0+cell.on[j];
      e.dur=Math.min(e.dur,cell.du[j]);
    }
  }
  // arpeggiation direction for the motorik sequencer — cycles as the song plays, advancing
  // each chord (gci). `random` is a deterministic shuffle seeded by gci so the main arp and
  // its counter (which plays the REVERSE = contrary motion) agree on the same base order.
  const ARP_DIRS=["up","down","updown","random","up","downup","down","random"];
  function arpDir(mode,gci){
    if(mode==="up") return [0,1,2,3];
    if(mode==="down") return [3,2,1,0];
    if(mode==="updown") return [0,1,2,3,2,1];
    if(mode==="downup") return [3,2,1,0,1,2];
    const s=mulberry32((0x9e3779b1 ^ (gci*2654435761))>>>0), a=[0,1,2,3];
    for(let i=3;i>0;i--){ const j=Math.floor(s()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; }
    return a;
  }
  // melody phrases are 8-beat cells too; with chordEvery (cb) ≠ 8 the phrase
  // takes the front of the chord bar (long harmony breathes) or truncates.
  // cb=8 (every genre today) is byte-identical to the pre-lane engine.
  function melodyEvents(style,base,prg,chords,k,rng,seed,cb,idiom){
    cb=cb||CHORD_BEATS;
    const out=[], cycleBeats=chords.length*cb;
    const comp = style==="composed"?prg.composed : style==="composed2"?prg.composed2 : null;
    if(comp && cycleBeats===32){
      comp.forEach(([o,d,p])=>{ if(rng()<0.06) return;            // composed lines breathe too
        out.push({voice:"melody",beat:base+o,dur:d,pch:pchAdd(p,k),amp:0.135+rng()*0.015}); });
      return out;
    }
    let gen=style; if(style==="composed"||style==="composed2") gen="arpup";
    chords.forEach((chord,ci)=>{
      const Sb=base+ci*cb, lead=chord.lead.map(p=>pchAdd(p,k));
        // humanity: every chord's phrase mutates a little — drops, pushes, octave color
      const note=(o,d,idx,oct,bd)=>{
        if(rng()<0.09) return;
        if(rng()<0.11 && o+0.5+d<=8) o+=0.5;
        if(rng()<0.09) oct=(oct||0)===0?1:0;
        if(o>=cb) return;                                          // chordEvery<8 truncation (never fires at cb=8)
        out.push({voice:"melody",beat:Sb+o,dur:d,pch:pchAdd(lead[idx],12*(oct||0)),amp:0.13+rng()*0.025,...(bd?{bend:bd}:{})});
      };
      if(gen==="canon"){
        // 2-voice counterpoint: the line + its echo two beats later, a chord tone lower
        const ph=MEL_PHRASES.updown;
        ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct));
        ph.forEach(([o,d,idx,oct])=>{ if(o+2+d<=8) note(o+2,d,Math.max(0,idx-1),(oct||0)-1); });
        return;
      }
      if(gen==="blues"){
        // CALL-AND-RESPONSE (2 bars call / 2 bars response across the 8-beat
        // chord): the call is the front half of the classic lick; the response
        // half either ANSWERS it — a seeded transposed/abbreviated variant, a
        // chord tone lower — or RESTS while the 78rpm singer takes those bars
        // (hits pattern "response" slots the vox there; the guitar answers the
        // singer on the next call). ~30-40% of notes gain a blue-note BEND
        // ({from:-(0.5..1) semitones, ms:60-140}), biased onto thirds/fifths —
        // only SAMPLER leads render the slide (VOICES.md contract).
        const gci=Math.round(Sb/cb);
        const cr=crStream(seed,gci);
        const rest=cr()<0.42;                              // draw #1 — the hits placer flips the same coin
        const bend=(idx)=>((idx===1||idx===2)?cr()<0.55:cr()<0.22)
          ? {from:-(0.5+cr()*0.5), ms:Math.round(60+cr()*80)} : null;
        const call=[[0,.75,3,0],[1,.25,2,0],[1.5,.5,3,0],[2,1.5,0,1]];
        call.forEach(([o,d,idx,oct])=>note(o,d,idx,oct,bend(idx)));
        if(!rest){                                         // (a) the answer: down a chord tone, abbreviated
          const drop=Math.floor(cr()*call.length);
          call.forEach(([o,d,idx,oct],j)=>{ if(j===drop) return;
            const ai=Math.max(0,idx-1);
            note(o+4,d*0.9,ai,0,bend(ai)); });
        }
        return;
      }
      if(gen==="solo"){
        // CsdTheory-driven IMPROVISATION over the changes (not a pattern table):
        // per chord bar, an idiomatic line built from the chord tones (lead[]) with
        // scale-STEP connectors and chromatic APPROACH notes into the next target,
        // an ascend-then-descend contour, call-and-response breaths, and a dynamic
        // arc. Deterministic on a DEDICATED per-bar stream (never touches the shared
        // rng), so any bar/genre without a solo section is byte-identical. Idiom
        // tunes density / chromaticism / bends: bop (eighth-note bop runs), blues
        // (sparser, bent), funk (syncopated 16ths), modal (leaping/scalar), roll
        // (bluegrass banjo/fiddle sixteenth rolls).
        const cfg=({ bop:{sub:.5,rest:.12,chrom:.5,leap:.22,bend:0},
                     blues:{sub:.5,rest:.28,chrom:.22,leap:.18,bend:.42},
                     funk:{sub:.25,rest:.34,chrom:.32,leap:.14,bend:0},
                     modal:{sub:.5,rest:.2,chrom:.14,leap:.36,bend:.12},
                     roll:{sub:.25,rest:.08,chrom:.1,leap:.3,bend:0} })[idiom||"bop"]
                   || {sub:.5,rest:.18,chrom:.35,leap:.24,bend:.1};
        const gci=Math.round(Sb/cb);
        const sr=mulberry32(((seed>>>0)^Math.imul(gci+1,0x9e3779b1)^0x50105)>>>0);
        const ct=lead.map(parsePch).slice().sort((a,b)=>a-b);   // chord tones, ascending semitones
        const root=ct[0];
        const clampReg=(m)=>{ while(m-root>16)m-=12; while(root-m>7)m+=12; return m; };
        const nearestCt=(m)=>ct.reduce((b,c)=>Math.abs(c-m)<Math.abs(b-m)?c:b,ct[0]);
        const nSlots=Math.max(1,Math.round(cb/cfg.sub));
        const breathe=(gci%2===1)&&sr()<0.55;                   // rest the tail every other bar (the response)
        let cur=ct[Math.floor(sr()*Math.min(2,ct.length))];
        for(let s=0;s<nSlots;s++){
          const o=s*cfg.sub; if(o>=cb) break;
          if(breathe && o>=cb*0.5) break;
          if(s>0 && sr()<cfg.rest) continue;                    // phrasing rest
          const pos=nSlots>1?s/(nSlots-1):0, strong=Math.abs(o-Math.round(o))<1e-6;
          let m;
          if(strong && sr()<0.72){                              // land on a chord tone along the contour arc
            const want=pos<0.6?pos/0.6:1-(pos-0.6)/0.4;
            m=ct[Math.min(ct.length-1,Math.round(want*(ct.length-1)))];
            if(sr()<cfg.leap) m=ct[Math.floor(sr()*ct.length)]+(sr()<0.3?12:0);
          } else {                                              // connect: chromatic approach or a scale step
            const target=nearestCt(cur+(sr()<0.5?2:-2));
            if(sr()<cfg.chrom) m=target-1;                      // leading tone from below (the bop enclosure)
            else { const dir=target>cur?1:-1; m=cur+dir*(sr()<0.45?2:1); }
          }
          m=clampReg(m); cur=m;
          const dur=cfg.sub*(sr()<0.18?1.7:(sr()<0.5?1:0.85));
          const amp=0.12+0.05*(pos<0.6?pos/0.6:1-(pos-0.6)/0.4)+sr()*0.02;
          const bend=cfg.bend&&sr()<cfg.bend?{from:-(0.5+sr()*0.5),ms:Math.round(60+sr()*90)}:null;
          out.push({voice:"melody",beat:Sb+o,dur,pch:toPch(m),amp,solo:true,...(bend?{bend}:{})});
        }
        return;
      }
      if(gen==="hero"){ (ci%2?MEL_PHRASES.hero2:MEL_PHRASES.hero).forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="anthem"){ (ci%2?MEL_PHRASES.anthem2:MEL_PHRASES.anthem).forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="sparse"){ note(0,3,2,0); note(4,3,3,0);
        if(rng()<0.3) note(7,0.75,1,0);                               // occasional pickup into the next bar — sparse breathes across cycles
        return; }
      if(gen==="roar"){   // a creature bellow: one long held low note, sometimes a second answering call
        out.push({voice:"melody",beat:Sb,dur:5.0,pch:pchAdd(lead[0],-12),amp:0.17});
        if(rng()<0.55&&5.4<cb) out.push({voice:"melody",beat:Sb+5.4,dur:2.3,pch:pchAdd(lead[2],-12),amp:0.14});
        return; }
      if(gen==="double"){ // 8th-note double-time riff — ROTATES per chord (verbatim loops were the arp fatigue) + humanity drops/octave pops
        const pat=[0,1,2,3,0,1,2,3,1,2,3,0,2,3,0,1];
        const rot=(Math.round(Sb/cb)%4)*4;                            // pattern phase advances each chord/cycle
        for(let i=0;i<Math.round(cb*2);i++){
          if(rng()<0.07) continue;                                    // breathe
          let p=lead[pat[(i+rot)%16]];
          if(rng()<0.06) p=pchAdd(p,12);                              // octave pop
          out.push({voice:"melody",beat:Sb+i*0.5,dur:0.45,pch:p,amp:0.115+rng()*0.01});
        } return; }
      if(gen==="motorik"||gen==="motorik23"){
        // Kraftwerk sequencer, octave-INTERLEAVED — each cell note is followed half a step
        // later by the same note an octave up (note, note+8ve, next…), a relentless weaving arp.
        // The arpeggiation DIRECTION cycles as the song plays (up, down, up-down, random),
        // advancing each chord. `motorik23` is the COUNTER: 2/3 the speed and the MIRROR of the
        // main's direction, so as one arp climbs the other descends (contrary motion).
        const slow=gen==="motorik23";
        const gci=Math.round(Sb/cb);                                            // global chord index — the direction varies across the whole song
        const base=arpDir(ARP_DIRS[gci%ARP_DIRS.length], gci);
        const cell=slow?base.slice().reverse():base;                            // the counter mirrors the main = contrary motion
        const step=slow?0.75:0.5, n=Math.floor(cb/step);                        // EIGHTH notes (main), dotted-8th (counter at 2/3 speed)
        for(let i=0;i<n;i++){
          let p=lead[cell[i%cell.length]];
          if(i%2===1) p=pchAdd(p,12);                                           // octave weave on alternate 8ths (the Kraftwerk weave, now at 8th-note rate)
          out.push({voice:"melody",beat:Sb+i*step,dur:step*0.45,pch:p,amp:0.12});   // staccato — more bite
        }
        return;
      }
      if(gen==="arp16"){   // 16th-note arp that traces a MELODIC contour (not just the chord) — Edge-style
        const ext=[lead[0],lead[1],lead[2],lead[3],pchAdd(lead[0],12),pchAdd(lead[1],12),pchAdd(lead[2],12)];
        const motif=[0,2,4,5, 4,3,2,4, 5,4,2,3, 1,2,4,0];   // a rising-to-a-peak melodic figure, resolves
        for(let i=0;i<Math.round(cb*4);i++){ const p=ext[motif[i%16]];
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.24,pch:pchAdd(p,-12),amp:0.12});   // melodic arp, octave lower (main)
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.22,pch:p,amp:0.05}); }              // octave doubling
        return; }
      if(gen==="fugue"){   // BAROQUE FUGUE: a running-SIXTEENTH subject stated in the upper
        // voice, then ANSWERED two beats later in a lower voice (imitation), so the ear
        // hears continuous semiquaver counterpoint — the Well-Tempered-Clavier engine.
        const ext=[lead[0],lead[1],lead[2],lead[3],pchAdd(lead[0],12),pchAdd(lead[1],12),pchAdd(lead[2],12)];
        const subject=[0,1,2,4, 3,2,4,3, 5,4,2,1, 2,3,1,0];   // stepwise turning subject, resolves to the root
        const n=Math.round(cb*4);                              // cb beats × 4 sixteenths
        for(let i=0;i<n;i++){ const p=ext[subject[i%16]];
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.23,pch:p,amp:0.11}); }              // dux — the subject in semiquavers
        const ans=8;                                           // comes (answer) enters 2 beats (8 sixteenths) later
        for(let i=0;i<n-ans;i++){ const p=ext[subject[i%16]];
          out.push({voice:"melody",beat:Sb+(i+ans)*0.25,dur:0.23,pch:pchAdd(p,-12),amp:0.075}); }   // answer, an octave below
        return; }
      if(gen==="sludge"){   // SUNN O)))/SLEEP SLUDGE-CHORD WALL: power chords (root+fifth,
        // NO third) played as CHORDS, DOUBLED an octave below, held long on a slow
        // half-note pulse — massive, anthemic, relentless. Changes only with the chord.
        const root=lead[0], fifth=lead[2];                       // idx 2 = the fifth of the voicing
        const stepB=2;                                           // half-note stomp
        for(let t=0;t<cb;t+=stepB){
          const dur=Math.min(stepB*0.98, cb-t);
          // the wall: root + fifth an octave down, plus the octave-below root double (the SLEEP sub-guitar)
          const stack=[[pchAdd(root,-12),0.11],[pchAdd(fifth,-12),0.085],[pchAdd(root,-24),0.075]];
          for(const [p,a] of stack) out.push({voice:"melody",beat:Sb+t,dur,pch:p,amp:a});
        }
        return; }
      if(gen==="waltz"){   // ODD-METER 3-beat phrase-cell family: A sings the downbeat and
        // holds, B answers with a stepping turn — alternating per MEASURE and tiled
        // across the chord bar (chordEvery 6 = two measures, 12 = four). Same
        // humanity draws per note as every phrase style (the note() helper).
        const A=[[0,1.9,2,0],[2,0.9,1,0]], B=[[0,0.9,0,0],[1,0.9,1,0],[2,0.9,3,0]];
        for(let m=0;m*3<cb;m++) (m%2?B:A).forEach(([o,d,idx,oct])=>note(m*3+o,d,idx,oct));
        return; }
      if(gen==="lilt6"){   // ODD-METER 6-beat compound phrase (6/8; beat = the 8th):
        // the siciliana lilt — dotted-8th/16th/8th per dotted-quarter group,
        // rising then falling through the voicing; tiles chordEvery 6/12.
        const ph6=[[0,1.4,0,0],[1.5,0.45,1,0],[2,0.9,2,0],[3,1.4,3,0],[4.5,0.45,2,0],[5,0.9,1,0]];
        for(let m=0;m*6<cb;m++) ph6.forEach(([o,d,idx,oct])=>note(m*6+o,d,idx,oct));
        return; }
      const wv=MINED_WEAVE[gen];
      if(wv){
        // the mined melody ORGAN (tools/mine-weave.js): two Markov walks on
        // the shared stream — rhythm over quantized IOIs, pitch over the
        // voicing ladder (idx 0..3 × oct 0..1: chord-safe by construction,
        // like wander but corpus-fit; wander scored WORSE THAN UNIFORM on
        // held-out corpus in both chains). Same note() humanity as every
        // sibling style; opt-in per anchor, unwired states untouched.
        const WIOI=[0.25,0.5,0.75,1,1.5,2,3,4];
        const pick=(probs)=>{ const r=rng(); let acc=0; for(let i=0;i<probs.length;i++){ acc+=probs[i]; if(r<acc) return i; } return probs.length-1; };
        let slot=pick(wv.start), ii=pick(wv.ioiStart), t=0;
        while(t<cb-1e-9){
          const gap=WIOI[ii];
          note(t, Math.max(0.2, Math.min(wv.legato*gap, cb-t)), slot%4, slot>>2);
          const nextSlot=pick(wv.slot[slot]);
          // v2 PASSING-TONE connectors (mined wv.step = the family's corpus
          // stepFrac): a wide ladder leap into the next landing tone fills
          // with 1-2 passing tones on IOI subdivisions, walked in even
          // semitone splits toward the target. Marked pass:1 (off-ladder by
          // design — the chord-safety gate exempts them); quieter than the
          // landings, direct-pushed (no note() humanity, like solo's runs)
          if(wv.step && gap>=0.5 && t+gap<cb-1e-9){
            const semis=(parsePch(lead[nextSlot%4])+12*(nextSlot>>2))-(parsePch(lead[slot%4])+12*(slot>>2));
            if(Math.abs(semis)>=3 && rng()<Math.min(0.82,wv.step*2.4)){
              const nPass=(Math.abs(semis)>=10&&gap>=1.5)?2:1, sub=gap/(nPass+1);   // ONE approach tone is the tasteful default; two only for octave-plus leaps with room
              const sgn=semis>0?1:-1;
              for(let k=1;k<=nPass;k++)   // APPROACH placement (not midpoint): the last tone sits a whole step shy of the target, so every connection guarantees a step interval — midpoints of wide leaps are just smaller leaps
                out.push({voice:"melody",beat:Sb+t+sub*k,dur:sub*0.85,pch:pchAdd(lead[slot%4],12*(slot>>2)+semis-sgn*2*(nPass+1-k)),amp:0.105+rng()*0.015,pass:1});
            }
          }
          t+=gap;
          ii=pick(wv.ioi[ii]);
          slot=nextSlot;
        }
        return;
      }
      // generic A/B twin rule (the hero/anthem alternation, generalized for
      // the mined cells): a cell with a "<name>2" sibling alternates per chord
      const ph=(MEL_PHRASES[gen+"2"]&&ci%2)?MEL_PHRASES[gen+"2"]:MEL_PHRASES[gen];
      if(ph){ ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      // wander: rhythmic random walk over chord tones, occasional octave leap
      const span=Math.min(8,cb);
      const rh=[1,0.5,0.5,1,1,2]; let t=0,i=0,prev=Math.floor(rng()*4);
      while(t<span){ const d=rh[i%rh.length]; prev=Math.max(0,Math.min(3,prev+(Math.floor(rng()*3)-1))); note(t,Math.min(d,span-t)*0.92,prev,rng()<0.18?1:0); t+=d; i++; }
    });
    return out;
  }
  // ---------- unified time-feel (KERNEL-V4 Phase 3) ----------
  // Swing / humanize / rubato / push-pull were three unintegrated timing
  // systems (applyGroove's global swing+humanize, the rubato beat-warp, and the
  // shuffle kit's own triplet placement). They are now ONE dimension family,
  // resolved to a single spec by resolveTimeFeel and applied through two engine
  // stages that share that spec:
  //   grid stage  (applyGroove, below): grid-swing + per-voice push-pull +
  //               per-event humanize — the per-note warp, at the pre-`thunk`
  //               position (thunk lands WITH the humanized strike).
  //   section stage (the rubato beat-warp near the end of buildEvents): the
  //               smooth monotonic tempo breathing, applied last so every
  //               layer (found/sfx included) inherits one musical clock.
  // Swing is grid-parameterised (SWING_GRIDS): "8th" is the historical default
  // (the "&" at f=0.5, +sw*0.16) — grid was previously HARDCODED, the one bit
  // of "applyGroove special-casing" this phase deletes; "16th" swings the e/a
  // 16th-offbeats, "triplet" slides the "&" toward 2/3 (the generalised shuffle
  // — which is why the blues shuffle kit, already placing on the triplet grid,
  // keeps grid "8th" and is left untouched: no double-swing, no bespoke dance).
  // ABSENT state.timeFeel => grid "8th", no push-pull, humanize timing==level==
  // state.humanize — draw-for-draw and value-for-value identical to the old
  // applyGroove (fixtures.js pins it).
  const SWING_GRIDS={
    "8th":     { at:(f)=>Math.abs(f-0.5)<0.001, push:0.16 },
    "16th":    { at:(f)=>Math.abs(f-0.25)<0.001||Math.abs(f-0.75)<0.001, push:0.08 },
    "triplet": { at:(f)=>Math.abs(f-0.5)<0.001, push:(2/3-0.5) },   // full swing lands the "&" on 2/3
  };
  function resolveTimeFeel(state){
    const tf=state.timeFeel||{};
    const hz=state.humanize||0;
    const hum=tf.humanize||null;   // new anchors may split timing vs level; legacy scalar drives both
    return {
      swing:{ amount:state.swing||0, grid:(tf.grid&&SWING_GRIDS[tf.grid])?tf.grid:"8th" },
      humanize:{ timing:hum&&hum.timing!=null?hum.timing:hz, level:hum&&hum.level!=null?hum.level:hz },
      pushPull:(tf.pushPull&&Object.keys(tf.pushPull).length)?tf.pushPull:null,   // { voice|drum : ±beats } — laid-back bass / on-top hats
      rubato:(state.rubato&&state.rubato.depth>0)?state.rubato:null,
    };
  }
  // grid stage: grid-swing (no draw), then humanize (timing draw always, amp
  // draw only when e.amp!=null — the historical draw shape), then push-pull
  // (drawless per-voice offset). Called once per lane (pitched, then drums),
  // sharing one rng stream — draw ORDER is the byte-stability contract.
  // COLUMNAR (vector-kernel STEP 1): the warp arithmetic runs elementwise on a
  // {beat, amp} compute view and writes back into the same event objects. The
  // rng TAPE is pre-drawn in the exact per-event order of the scalar loop
  // (timing draw always, amp draw only when the row has a numeric amp — the
  // historical draw shape), so draw order is byte-stable; every arithmetic
  // step keeps the scalar loop's left-to-right operation order, so the
  // doubles are bit-equal. Scalar twin below for column-less loaders.
  function applyGroove(events, tfeel, rng){
    const sw=tfeel.swing.amount, grid=SWING_GRIDS[tfeel.swing.grid];
    const ht=tfeel.humanize.timing, hl=tfeel.humanize.level, pp=tfeel.pushPull;
    if(!sw && !ht && !hl && !pp) return;
    const C=columnsRef();
    if(!C) return applyGrooveScalar(events, tfeel, rng);
    const cols=C.toColumns(events,["beat","amp"],{view:true});
    const n=cols.n, beat=cols.beat, amp=cols.amp, ampM=cols.mask.amp;
    if(sw){                     // grid swing (drawless) — masked on the ORIGINAL fractional beat
      const swM=C.where(beat, b=>grid.at(b-Math.floor(b)));
      C.shift(beat, sw*grid.push, swM);
    }
    if(ht||hl){                 // THE TAPE: rng consumed positionally, same sequence as the loop
      const tD=new Float64Array(n), aD=new Float64Array(n);
      for(let i=0;i<n;i++){ tD[i]=(rng()*2-1)*ht*0.04; if(ampM[i]) aD[i]=1+(rng()*2-1)*hl*0.25; }
      C.shift(beat, tD);
      C.scale(amp, aD, ampM);
      C.map(amp, a=>Math.max(0.01,a), ampM);
    }
    if(pp){                     // push-pull: drawless per-row offset by voice/drum lane
      const off=new Float64Array(n);
      for(let i=0;i<n;i++){ const o=pp[events[i].voice||events[i].drum]; if(o) off[i]=o; }
      C.shift(beat, off);
    }
    C.map(beat, b=>Math.max(0,b));
    C.writeBack(cols, events);
  }
  function applyGrooveScalar(events, tfeel, rng){   // the pre-columnar loop, byte-identical twin
    const sw=tfeel.swing.amount, grid=SWING_GRIDS[tfeel.swing.grid];
    const ht=tfeel.humanize.timing, hl=tfeel.humanize.level, pp=tfeel.pushPull;
    for(const e of events){
      let b=e.beat; const f=b-Math.floor(b);
      if(sw && grid.at(f)) b += sw*grid.push;
      if(ht||hl){ b += (rng()*2-1)*ht*0.04; if(e.amp!=null) e.amp=Math.max(0.01, e.amp*(1+(rng()*2-1)*hl*0.25)); }
      if(pp){ const o=pp[e.voice||e.drum]; if(o) b+=o; }
      e.beat=Math.max(0,b);
    }
  }

  // break-chop slice sequences: 16 8th-slots per chord, slice index 0-7 or -1 rest
  const BREAK_PATTERNS=[
    [0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7],
    [0,1,2,3,0,1,4,5,2,3,6,7,4,7,6,7],
    [0,2,1,3,4,4,6,7,0,2,1,3,7,6,5,4],
    [0,-1,2,-1,4,5,-1,7,0,-1,2,3,-1,5,6,7],
  ];
  // (2026-07 VARIETY pass: + fourfloor (a chord stab on every beat — disco/EDM),
  //  charleston (the syncopated dotted-quarter/eighth chord punch — disco/funk),
  //  gallop (triple 16th bursts — metal/energetic), clave (3-2 son rhythm as
  //  stabs), pushpull (anticipated pairs), stax (the backbeat 2-&-4 horn punch).
  //  New keys only: a genre whose stab pool does not reference them is byte-identical.)
  const STAB_PATTERNS={ offbeat:[1.5,3.5,5.5,7.5], rave:[0,1.5,3,4.5,6,7], sparse:[3.5,7],
    fourfloor:[0,2,4,6], charleston:[0,1.5,4,5.5], gallop:[0,0.5,0.75,4,4.5,4.75],
    clave:[0,1.5,3,4,6], pushpull:[1.5,2,5.5,6], stax:[2,6] };
  // ---------- STRUM / RHYTHM-GUITAR COMP (2026-07 variety pass) ----------
  // Opt-in via state.strum (a pattern NAME, or {pattern,spread}). When present,
  // a chord's pad is no longer a dead-flat 8-beat block held once: it is STRUCK
  // rhythmically. Each strum-hit RAKES the chord's notes in rapid succession —
  // the per-note time offset is the strum SPREAD; a down-stroke rakes low->high,
  // an up-stroke high->low — with a DEDICATED seeded stream (seed+53000)
  // humanizing each hit's timing and level. When state.strum is ABSENT the
  // stream is never created and the pad loop runs its exact legacy flat-block
  // branch => byte-identical for every genre that does not opt in (the law).
  // Cells TILE across the chord bar (CBEATS); a hit past the bar end is dropped,
  // so odd-meter chord bars (chordEvery 6) tile cleanly too. A down-stroke rings
  // (long release); an up-stroke chokes (short). Lots of idioms want this:
  // folk / country / rock / bossa / flamenco / reggae-skank / indie.
  //   hit = [beatInCell, dir(+1 down-stroke / -1 up-stroke), ampScale]
  const STRUM_PATTERNS={
    folk:    {cell:4, hits:[[0,1,1],[1,1,0.82],[1.5,-1,0.68],[2.5,-1,0.7],[3,1,0.88],[3.5,-1,0.72]]},  // the classic "D · D U · U D U"
    drive:   {cell:2, hits:[[0,1,1],[0.5,1,0.78],[1,1,0.9],[1.5,1,0.78]]},                              // steady down-eighths (rock / punk / indie)
    country: {cell:2, hits:[[0,1,0.6],[1,-1,0.92]]},                                                    // boom-chick: a bass beat then an up-chord
    skank:   {cell:1, hits:[[0.5,-1,1]]},                                                               // the offbeat up-CHOP on every "&" (ska / reggae)
    bossa:   {cell:4, hits:[[0,1,0.95],[1.5,-1,0.8],[2,1,0.85],[3.5,-1,0.82]]},                         // the nylon-guitar bossa syncope
    ballad:  {cell:4, hits:[[0,1,1],[2,-1,0.62]]},                                                      // slow: one soft down + a mid up
    flamenco:{cell:2, hits:[[0,1,1],[0.66,-1,0.7],[1.33,1,0.85]]},                                      // rasgueado triplet feel
    waltz3:  {cell:3, hits:[[0,1,1],[1,-1,0.7],[2,-1,0.72]]} };                                         // 3/4 down-up-up (meter genres)
  const HIT_PATTERNS={ sparse:[0], offbeat:[3.5], dub:[2.5,6.5], response:[4] };   // response: the vox takes the blues response bars the lead rests (crStream)

  // ---------- pattern-transform algebra (KERNEL-V4 Phase 2) ----------
  // The Strudel per-cycle transform pass is now a genre-addressable DIMENSION
  // (state.transforms) instead of a hardcoded switch. Each op is a lane-tagged
  // per-bar mutation over the {pitched, drums} fabric; a state's `transforms`
  // declares which ops are in the pool, how often they fire, and how they're
  // scheduled. buildEvents runs ONE generic pass (below); when state.transforms
  // is ABSENT it uses TF_DEFAULT_POOL at rate .25 — draw-for-draw identical to
  // the old switch (the 5 core ops in this exact order), pinned byte-stable by
  // fixtures.js. Blend (genre-kernel resolveMulti) = pool union + rate lerp.
  //   X = { b0, b1, cb, trng, pitched, drums, dropT }   (per-bar context)
  //   op.lane = the layer it touches (a genre's targets:{drums,melody,bass}
  //             gate can disable a lane; op body is skipped, draws still spent).
  const TRANSFORM_OPS={
    // rev: mirror the melody phrase in time within the bar (Strudel rev; solos exempt)
    rev:{ lane:"melody", fn(X){
      for(const e of X.pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=X.b0&&e.beat<X.b1)
        e.beat=X.b0+Math.max(0, X.cb-((e.beat-X.b0)+Math.min(e.dur,X.cb))); } },
    // ply: double-hit one seeded beat of drums (Strudel ply 2)
    ply:{ lane:"drums", fn(X){
      const at=X.b0+Math.floor(X.trng()*X.cb), extra=[];
      for(const d of X.drums) if(d.beat>=at&&d.beat<at+1&&d.drum!=="tom")
        extra.push(Object.assign({},d,{beat:d.beat+0.25,dur:Math.min(d.dur,0.2),amp:d.amp*0.75}));
      extra.forEach(x=>X.drums.push(x)); } },
    // degrade: hats thin out hard this bar (Strudel degradeBy)
    degrade:{ lane:"drums", fn(X){
      for(const d of X.drums) if(d.drum==="hat"&&d.beat>=X.b0&&d.beat<X.b1&&X.trng()<0.45) X.dropT.add(d); } },
    // octflip: the whole bass bar jumps an octave
    octflip:{ lane:"bass", fn(X){
      for(const e of X.pitched) if(e.voice==="bass"&&e.beat>=X.b0&&e.beat<X.b1) e.pch=pchAdd(e.pch,12); } },
    // rest: the melody sits this bar out (silence is a choice; solos exempt)
    rest:{ lane:"melody", fn(X){
      for(const e of X.pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=X.b0&&e.beat<X.b1) X.dropT.add(e); } },
    // --- Phase-2 additions: available to genres that opt into a richer pool ---
    // rot: rotate the CLOSED-hat lane within the bar by a seeded 1-3 beat shift
    //      (wrapping inside the bar) — displaces the ride, kick/snare stay put
    rot:{ lane:"drums", fn(X){
      const shift=1+Math.floor(X.trng()*3);
      for(const d of X.drums) if(d.drum==="hat"&&!d.open&&d.beat>=X.b0&&d.beat<X.b1)
        d.beat=X.b0+(((d.beat-X.b0)+shift)%X.cb); } },
    // stutter: retrigger the loudest drum of the bar's last beat as four 16ths
    //          (the braindance/breakcore machine-gun) — one seeded pick, ramped
    stutter:{ lane:"drums", fn(X){
      const from=X.b1-1; let proto=null;
      for(const d of X.drums) if(d.beat>=from&&d.beat<X.b1&&d.drum!=="tom"&&(!proto||d.amp>proto.amp)) proto=d;
      if(!proto) return;
      for(let i=0;i<4;i++) X.drums.push({drum:proto.drum,beat:from+i*0.25,dur:0.12,amp:Math.min(1,proto.amp*(0.6+0.12*i))}); } },
  };
  const TF_DEFAULT_POOL=["rev","ply","degrade","octflip","rest"];   // the historical global 5 (order = the old t=0..4 mapping)
  const STABLE_SECTION=/chorus|hook|drop|peak|refrain/i;            // formAware schedule: transforms rest on these (the section is the hook — leave it alone)

  // ---------- MUSICAL DYNAMICS: voices swell in and fade out, they don't snap ---
  // A harmonic/melodic voice (pad, bass, melody) that was SILENT in the previous
  // section and sounds in this one fades IN over the first bars of its RUN (the
  // maximal stretch of consecutive sections it's on for) instead of snapping to
  // full level; a voice about to go silent fades OUT over its last bars. Drums are
  // exempt — their fills / dropouts / drops ARE their dynamics, and a slammed drop
  // must stay slammed. Runs on the built EVENT list (renderer stage), so the
  // symbolic verifier + musicality never see it (matrix unmoved); only rendered
  // fixtures shift. It serves BOTH engines: press hands the whole multi-section
  // song, so runs are computed from state.sections + spans here; live's stepWalk
  // renders one section per bar and can't see the run, so it hands
  // state._voiceRun={voice:{i:barInRun,n:runBars}} and the SAME ramp curve applies
  // bar-by-bar. Per-genre opt-out: state.voiceDynamics===false. Tunables:
  const DYN_RAMP_BARS = 2;                                    // entrance/exit length in bars, capped at half the run
  const dynSmooth = t => t<=0 ? 0 : t>=1 ? 1 : t*t*(3-2*t);   // smoothstep ease (musical, not linear)
  // Per-voice [floorIn, floorExit]: the level a voice starts an entrance at and
  // ends an exit at. floorIn===1 means NO entrance ramp (the voice slams in). Pads
  // lowest — a swell from near-silence is their idiom; bass/melody stay present.
  const DYN_FLOOR = { pad: [0.12, 0.12], bass: [0.35, 0.35], melody: [0.30, 0.30] };
  // DRUMS get variable dynamics per voice (Paul: "different drum voices can have
  // variable dynamics"). The BACKBONE (kick/snare/clap/rim) slams in — floorIn 1
  // so a drop stays slammed — but still fades on the way OUT (into a breakdown).
  // The COLOR voices (hats/rides/toms/perc/shaker…) swell in AND out, so a kit's
  // texture breathes at its edges while the beat's spine keeps its punch. Fills
  // between two drum-on sections are mid-run (never in a ramp), so builds survive.
  const DYN_DRUM = {
    kick:[1,0.42], snare:[1,0.42], clap:[1,0.45], rim:[1,0.5], stick:[1,0.5],
    hat:[0.4,0.35], hatOpen:[0.4,0.35], ride:[0.45,0.38], crash:[0.55,0.42],
    tom:[0.5,0.4], perc:[0.4,0.35], shaker:[0.38,0.34], tamb:[0.4,0.35], cowbell:[0.5,0.4],
    _default:[0.5,0.4],
  };
  function rampScalar(floorIn, floorExit, barInRun, runBars){
    const rb = Math.min(DYN_RAMP_BARS, Math.floor(runBars/2));
    if(rb < 1) return 1;                                      // run too short to ramp — leave it
    let s = 1;
    if(floorIn < 1 && barInRun < rb)                          // fade IN over the first rb bars
      s = Math.min(s, floorIn + (1-floorIn)*dynSmooth((barInRun + 1) / (rb + 1)));
    const fromEnd = runBars - 1 - barInRun;
    if(floorExit < 1 && fromEnd < rb)                         // fade OUT over the last rb bars
      s = Math.min(s, floorExit + (1-floorExit)*dynSmooth((fromEnd + 1) / (rb + 1)));
    return s;
  }
  const DYN_VOICES = ["pad","bass","melody"];
  const dynActive = { pad:s=>!!s.pads, bass:s=>s.bass&&s.bass!=="off", melody:s=>s.melody&&s.melody!=="off", drums:s=>s.drums&&s.drums!=="off" };
  // walk a lane's active runs across the section list, calling ramp(barInRun,
  // runBars, secStart, secBar) for every bar of every run. Shared by press for
  // all lanes; live uses the walk's precomputed (i,n) instead.
  function dynRuns(on, barsOf, spans, ramp){
    let i = 0;
    while(i < on.length){
      if(!on[i]){ i++; continue; }
      let j = i; while(j+1 < on.length && on[j+1]) j++;       // run of active sections [i..j]
      let runBars = 0; for(let s=i;s<=j;s++) runBars += barsOf(s);
      // ENGINE-AUDIT 2026-07 Tier 3: rampScalar computes rb with this exact
      // formula and returns 1 for every INTERIOR bar (barInRun >= rb AND
      // fromEnd >= rb — both fade conditions false regardless of the floors),
      // so skipping the callback there is byte-identical and drops the
      // O(bars x events) full-array sweeps to the few edge bars of each run.
      const rb = Math.min(DYN_RAMP_BARS, Math.floor(runBars/2));
      let barBase = 0;
      for(let s=i;s<=j;s++){
        const secBars = barsOf(s), start = spans[s].start;
        for(let b=0;b<secBars;b++){
          const bir = barBase + b;
          if(bir >= rb && runBars - 1 - bir >= rb) continue;  // interior: scalar==1, provably no-op
          ramp(bir, runBars, start + b, b);
        }
        barBase += secBars;
      }
      i = j + 1;
    }
  }
  // COLUMNAR (vector-kernel STEP 1): the run-edge fades run as masked
  // elementwise scales over {beat, amp} compute views (no rng in this pass);
  // amp0 stamping and every multiply keep the scalar loop's order, so the
  // doubles are bit-equal. Scalar twin below for column-less loaders.
  function applyVoiceDynamics(pitched, drums, state, spans, CBEATS){
    if(state.voiceDynamics === false) return;
    const C=columnsRef();
    if(!C) return applyVoiceDynamicsScalar(pitched, drums, state, spans, CBEATS);
    const laneMask=(evs,n,v)=>{ const m=new Uint8Array(n);
      for(let i=0;i<n;i++) if(evs[i].voice===v && !evs[i].solo) m[i]=1; return m; };
    // LIVE: the walk supplies (barInRun, runBars) per lane for this single bar.
    if(state._voiceRun){
      const pc=C.toColumns(pitched,["amp"],{view:true});
      for(const v of DYN_VOICES){ const r = state._voiceRun[v]; if(!r || !(r.n > 0)) continue;
        // r.noIn (endless-loop entrance law, live walk): an established voice
        // re-entering the looping form returns at FULL — floorIn 1 disables the
        // swell-in while the exit fade is untouched. See faust/live.js makeWalk.
        if(v === "drums"){ for(const e of drums){ const f = DYN_DRUM[e.drum] || DYN_DRUM._default;
            const s = rampScalar(r.noIn ? 1 : f[0], f[1], r.i, r.n); if(s < 1){ if(e.amp0==null) e.amp0 = e.amp; e.amp *= s; } } }
        else { const fl = DYN_FLOOR[v]; const s = rampScalar(r.noIn ? 1 : fl[0], fl[1], r.i, r.n);
          if(s < 1) C.scale(pc.amp, s, laneMask(pitched, pc.n, v)); }
      }
      C.writeBack(pc, pitched);
      return;
    }
    // PRESS: compute each lane's active runs across the section list, ramp the edge
    // bars. A voice on for the WHOLE song still breathes in at the top and out at
    // the tail (a single play-through has a real beginning and end).
    const secs = state.sections || [];
    if(secs.length < 2 || spans.length !== secs.length) return;
    const barsOf = i => Math.max(1, Math.round(spans[i].beats / CBEATS));
    const pc=C.toColumns(pitched,["beat","amp"],{view:true});
    for(const v of ["pad","bass","melody"]){
      const fl = DYN_FLOOR[v], lm = laneMask(pitched, pc.n, v);
      dynRuns(secs.map(s => !!dynActive[v](s)), barsOf, spans, (barInRun, runBars, lo) => {
        const scal = rampScalar(fl[0], fl[1], barInRun, runBars);
        if(scal < 1) C.scale(pc.amp, scal, C.and(lm, C.where(pc.beat, b=>b>=lo && b<lo+CBEATS)));
      });
    }
    C.writeBack(pc, pitched, ["amp"]);
    const dc=C.toColumns(drums,["beat","amp"],{view:true});
    const fIn=new Float64Array(dc.n), fEx=new Float64Array(dc.n);
    for(let i=0;i<dc.n;i++){ const f=DYN_DRUM[drums[i].drum]||DYN_DRUM._default; fIn[i]=f[0]; fEx[i]=f[1]; }
    dynRuns(secs.map(s => !!dynActive.drums(s)), barsOf, spans, (barInRun, runBars, lo) => {
      const wM=C.where(dc.beat, b=>b>=lo && b<lo+CBEATS);
      const scal=new Float64Array(dc.n);
      C.map(scal, (_,i)=>rampScalar(fIn[i],fEx[i],barInRun,runBars), wM);
      const sM=C.and(wM, C.where(scal, s=>s<1));
      for(let i=0;i<dc.n;i++) if(sM[i] && drums[i].amp0==null) drums[i].amp0=drums[i].amp;   // amp0 = composed accent, for the snare-law re-check (loudness envelope ≠ accent identity)
      C.scale(dc.amp, scal, sM);
    });
    C.writeBack(dc, drums, ["amp"]);
  }
  function applyVoiceDynamicsScalar(pitched, drums, state, spans, CBEATS){   // the pre-columnar loop, byte-identical twin
    // LIVE: the walk supplies (barInRun, runBars) per lane for this single bar.
    if(state._voiceRun){
      for(const v of DYN_VOICES){ const r = state._voiceRun[v]; if(!r || !(r.n > 0)) continue;
        // r.noIn (endless-loop entrance law, live walk): an established voice
        // re-entering the looping form returns at FULL — floorIn 1 disables the
        // swell-in while the exit fade is untouched. See faust/live.js makeWalk.
        if(v === "drums"){ for(const e of drums){ const f = DYN_DRUM[e.drum] || DYN_DRUM._default;
            const s = rampScalar(r.noIn ? 1 : f[0], f[1], r.i, r.n); if(s < 1){ if(e.amp0==null) e.amp0 = e.amp; e.amp *= s; } } }
        else { const fl = DYN_FLOOR[v]; const s = rampScalar(r.noIn ? 1 : fl[0], fl[1], r.i, r.n);
          if(s < 1) for(const e of pitched) if(e.voice===v && !e.solo) e.amp *= s; }
      }
      return;
    }
    // PRESS: compute each lane's active runs across the section list, ramp the edge
    // bars. A voice on for the WHOLE song still breathes in at the top and out at
    // the tail (a single play-through has a real beginning and end).
    const secs = state.sections || [];
    if(secs.length < 2 || spans.length !== secs.length) return;
    const barsOf = i => Math.max(1, Math.round(spans[i].beats / CBEATS));
    for(const v of ["pad","bass","melody"]){
      const fl = DYN_FLOOR[v];
      dynRuns(secs.map(s => !!dynActive[v](s)), barsOf, spans, (barInRun, runBars, lo) => {
        const scal = rampScalar(fl[0], fl[1], barInRun, runBars);
        if(scal < 1) for(const e of pitched) if(e.voice===v && !e.solo && e.beat>=lo && e.beat<lo+CBEATS) e.amp *= scal;
      });
    }
    dynRuns(secs.map(s => !!dynActive.drums(s)), barsOf, spans, (barInRun, runBars, lo) => {
      for(const e of drums){ if(e.beat<lo || e.beat>=lo+CBEATS) continue;
        const f = DYN_DRUM[e.drum] || DYN_DRUM._default;
        const scal = rampScalar(f[0], f[1], barInRun, runBars);
        if(scal < 1){ if(e.amp0==null) e.amp0 = e.amp; e.amp *= scal; } }   // amp0 = composed accent, for the snare-law re-check (loudness envelope ≠ accent identity)
    });
  }

  function buildEvents(state){
    let prg=getProgression(state.progression);
    // MUSIC-MIND organ #1 (state.theory): when `reharm` is set the named
    // progression is only the SKELETON (key/mode/length inferred from it) —
    // CsdTheory regenerates the chords per song on its OWN stream (seed+40961,
    // the MUSIC-MIND contract), so the functional walk never touches the master
    // rng and a state WITHOUT the knob stays byte-identical. Object.assign over
    // the skeleton carries its non-chord fields (composed/composed2/label…)
    // so the hand melody tables still resolve against the reharmonized song.
    // Organ absent (a context that never loaded theory.js): fall back to the
    // plain progression — never throw over an expression organ.
    if(state.theory&&state.theory.reharm&&CsdTheoryRef&&CsdTheoryRef.reharmonize){
      const th=state.theory;
      prg=Object.assign({},prg,CsdTheoryRef.reharmonize(prg,{
        adventure:th.adventure, color:th.color, voicing:th.voicing,
        tables:th.tables,   // "corpus" opts into the MINED trove tables (theory.js)
        seed:(((state.seed??1)>>>0)+40961)>>>0 }));
    }
    // ---- ODD METER (2026-07): state.meter = {beats:3|6, unit:4|8} ----
    // 3/4 (beats:3, unit:4 — the engine beat is the quarter) and compound 6/8
    // (beats:6, unit:8 — the engine beat is the EIGHTH; the pulse is the
    // dotted quarter). The meter's ONLY structural job here is the chordEvery
    // DEFAULT: a meter state without chordEvery gets a meter-fitting chord
    // bar (6 = two 3/4 measures / one 6/8 measure) instead of the 4/4
    // CHORD_BEATS=8, plus the measure-length MM cell family below. Everything
    // else meter-shaped (waltz/sixeight kits, oompahpah/siciliana cells,
    // waltz/lilt6 phrases) is ordinary vocabulary the kernel pools for meter
    // anchors. ABSENT state.meter = null here = byte-identical output (no new
    // rng streams, no draw-count change — the standing law).
    const mtb=state.meter?(state.meter.beats|0):0;
    const meter=(mtb===3||mtb===6)?{beats:mtb,unit:(state.meter.unit|0)||(mtb===3?4:8)}:null;
    // KERNEL-V4 Phase 1: harmonic rhythm is a state dimension. chordEvery =
    // beats per chord bar (absent = the legacy CHORD_BEATS=8, byte-stable;
    // with meter the absent-default is the meter-fitting 6).
    const CBEATS=Math.max(2,Math.round(state.chordEvery||(meter?6:CHORD_BEATS)));
    const chords=prg.chords, k0=state.keyOffset|0, cycleBeats=chords.length*CBEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ const o={id:s.id,kind:s.kind,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".mp3"),pitch:s.pitch??0.78,stretch:s.stretch??0.45,vol:s.vol??0.22,cutoff:s.cutoff??2600,bpm:s.bpm,durSec:s.durSec,wet:!!s.wet,glitch:!!s.glitch,distant:!!s.distant}; if(s.scratch) o.scratch=s.scratch; srcById[s.id]=o; });
    const rng=mulberry32((state.seed??1)>>>0);
    // MUSIC-MIND rhythm knob (state.rhythm={complexity:0..1}): two DEDICATED
    // streams — bass-cell mutation (+52100) and melody rhythm cells (+52200) —
    // created only when the knob exists, so an absent knob draws ZERO numbers
    // anywhere (the byte-identity law) and a present knob never re-times any
    // other stream's draws.
    const rcx=state.rhythm?Math.min(1,Math.max(0,+state.rhythm.complexity||0)):0;
    const brng=state.rhythm?mulberry32((((state.seed??1)>>>0)+52100)>>>0):null;
    const mrng=state.rhythm?mulberry32((((state.seed??1)>>>0)+52200)>>>0):null;
    // STRUM / rhythm-guitar comp (state.strum): resolve the pattern + spread and
    // open a DEDICATED stream (seed+53000). strumSpec stays null (=> the pad
    // loop's legacy flat-block branch, zero draws on any stream) unless a valid
    // pattern name is present — so every non-strum genre is byte-identical.
    const strumSel=state.strum?(typeof state.strum==="string"?state.strum:state.strum.pattern):null;
    const strumSpec=strumSel?(STRUM_PATTERNS[strumSel]||null):null;
    const strumSpread=(state.strum&&typeof state.strum==="object"&&state.strum.spread!=null)?+state.strum.spread:0.03;
    const strumRng=strumSpec?mulberry32((((state.seed??1)>>>0)+53000)>>>0):null;
    // SCRATCH decorator stream (+7333): a DEDICATED rng so opting a turntablist
    // genre into scratches (fsrc.scratch>0) layers the fwd↔back read onto some
    // chop/break-stutter hits WITHOUT perturbing the section's chop-pattern rng —
    // the rhythm stays identical, only the read of a few hits turns to a scratch.
    // Drawn ONLY when fsrc.scratch is truthy => absent => zero draws => byte-identical.
    const scrng=mulberry32((((state.seed??1)>>>0)+7333)>>>0);
    let pitched=[], drums=[];
    let found=[], sfx=[];   // let: CsdPipes may hand back filtered arrays
    // FOUND-AT-90% (Paul 2026-07-11): the vocal/sampled-chop + found-sound-bed
    // layer only plays when a genre is DOMINANT (top blend weight >= 90%, i.e.
    // genreMeta.t <= 0.1) — so the weird found textures land when you're AT a
    // genre, not smeared across every transition. Single-genre states (t=0) and
    // states with no genreMeta keep the found layer => byte-identical (fixtures).
    const foundOK = !state.genreMeta || (state.genreMeta.t || 0) <= 0.1 + 1e-9;
    const spans=[];   // spans: section extents for the per-bar transform pool
    let cur=0, narrOffset=0;   // narration plays through the clip across sections (always playing)
    for(const sec of state.sections){
      // THE 3-MINUTE RULE (sec.keyShift): a section may carry a semitone
      // shift on top of the global keyOffset — the kernel's evolution pass
      // modulates long tracks at section boundaries. Every pitched voice
      // (pads/bass/melody/counter/solos/stabs — synth, dx7 AND sampler) goes
      // through this k, so the whole band transposes together.
      const k=k0+(sec.keyShift|0);
      const fsrc = sec.found&&sec.found.sourceId ? srcById[sec.found.sourceId] : null;
      const cycles=sec.cycles||1, secBeats=cycles*cycleBeats;
      if(fsrc){
        const role=sec.found.role||"bed";
        if(role==="chops"){
          // rhythmic slice hits on a seeded 8th grid instead of one long bed
          for(let b=0;b<secBeats;b++){
            if(rng()<0.55){ const ev={chop:1,beat:cur+b+(rng()<0.3?0.5:0),dur:0.35+rng()*0.5,
              amp:fsrc.vol*1.7,tableNum:fsrc.tableNum,pitch:fsrc.pitch,offset:rng(),cutoff:fsrc.cutoff};
              if(fsrc.scratch && scrng()<fsrc.scratch) ev.scratch=1;   // occasional turntablist scratch on the soul chop
              found.push(ev); }
          }
        } else if(role==="break"){
          // beat-synced break chopping: slice patterns rotate per chord, mutate per seed
          const sync=fsrc.bpm?state.bpm/fsrc.bpm:1;
          for(let cb=0;cb<secBeats/CBEATS;cb++){
            const pat=BREAK_PATTERNS[(cb+Math.floor(rng()*2))%BREAK_PATTERNS.length];
            for(let i8=0;i8<Math.round(CBEATS*2);i8++){
              let sl=pat[i8%16];
              if(sl<0||rng()<0.08) continue;
              if(rng()<0.1) sl=Math.floor(rng()*8);                  // surprise slice
              const beat=cur+cb*CBEATS+i8*0.5;
              found.push({chop:1,beat,dur:0.52,amp:fsrc.vol*2.1,tableNum:fsrc.tableNum,
                pitch:sync,offset:sl/8,cutoff:fsrc.cutoff||5000});
              if(rng()<0.07){ const st={chop:1,beat:beat+0.25,dur:0.26,amp:fsrc.vol*1.6,
                tableNum:fsrc.tableNum,pitch:sync,offset:sl/8,cutoff:fsrc.cutoff||5000};  // stutter
                if(fsrc.scratch && scrng()<fsrc.scratch) st.scratch=1;   // scratch the ornament, not the groove slices
                found.push(st); }
            }
          }
        } else if(role==="narration" && !sec.vox){
          // recognizable spoken Leacock — but NEVER over a synth voice (no overlay).
          // A chunk from a RANDOM point in the clip (picks more, varied), then glitched.
          const pit=0.94+(rng()*0.05-0.025);
          const cut=Math.round((fsrc.cutoff||3200)*(0.8+rng()*0.5));
          found.push({chop:1,beat:cur,dur:secBeats,amp:(fsrc.vol||0.3)*1.5,tableNum:fsrc.tableNum,
            pitch:pit,offset:rng()*0.5,cutoff:cut,rsend:0.4,dsend:0.3,fade:0.2});
          // glitch it: random stutter clusters across the section
          let gb=2+rng()*2;
          while(gb<secBeats-2){
            if(rng()<0.6){
              const off=rng(), n=2+Math.floor(rng()*4), step=[0.0625,0.125][Math.floor(rng()*2)];
              for(let j=0;j<n&&gb+j*step<secBeats-1;j++)
                found.push({chop:1,beat:cur+gb+j*step,dur:step*1.7,amp:(fsrc.vol||0.3)*1.3,tableNum:fsrc.tableNum,
                  pitch:[0.85,1,1,1.5][Math.floor(rng()*4)],offset:Math.min(0.98,off+j*0.03),cutoff:cut,rsend:0.4,dsend:0.45});
              gb+=n*step+1+rng()*2;
            } else gb+=1+rng()*1.5;
          }
        } else if(role==="narration"){
          // narration skipped here because a synth voice speaks this section
        } else {
          found.push({beat:cur,dur:secBeats,amp:fsrc.vol,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch,cutoff:fsrc.cutoff});
        }
      }
      // one-shot sample hits (stabs/shouts/vox) — separate layer from the bed/break
      if(sec.hits&&sec.hits.sourceId&&srcById[sec.hits.sourceId]){
        const hsrc=srcById[sec.hits.sourceId];
        if(hsrc.glitch){
          // the LOON, glitched a ton + faded in/out: long pitched swells (slow fade)
          // interleaved with rapid stutter clusters, all soaked in reverb + echo
          for(let cb=0;cb<secBeats/CBEATS;cb++){
            const base=cur+cb*CBEATS;
            if(rng()<0.6){                                            // a fading swell (gentle)
              found.push({chop:1,beat:base+rng()*3,dur:3+rng()*4,amp:(hsrc.vol||0.2)*1.4,tableNum:hsrc.tableNum,
                pitch:0.55+rng()*0.7,offset:rng(),cutoff:hsrc.cutoff||4500,rsend:0.32,dsend:0.3,fade:1+rng()*1.5});
            }
            if(rng()<0.6){                                           // a stutter cluster
              const off=rng(), n=2+Math.floor(rng()*4), step=[0.0625,0.125,0.1875][Math.floor(rng()*3)], sb=base+rng()*5;
              for(let j=0;j<n&&sb+j*step<base+CBEATS;j++)
                found.push({chop:1,beat:sb+j*step,dur:step*1.7,amp:(hsrc.vol||0.2)*1.3,tableNum:hsrc.tableNum,
                  pitch:[0.5,0.75,1,1.5,2][Math.floor(rng()*5)],offset:Math.min(0.98,off+j*0.05),cutoff:hsrc.cutoff||5500,rsend:0.3,dsend:0.3});
            }
          }
        } else {
        const pat=HIT_PATTERNS[sec.hits.pattern]||HIT_PATTERNS.sparse;
        const hdur=Math.min(4,(hsrc.durSec||1.2)*state.bpm/60);
        for(let cb=0;cb<secBeats/CBEATS;cb++){
          for(const o of pat){
            if(sec.hits.pattern==="response"){
              // response slotting: the singer ONLY takes the response bars the
              // blues lead rests (crStream draw #1 — the same seeded coin)
              if(crStream(state.seed,Math.round((cur+cb*CBEATS)/CBEATS))()>=0.42) continue;
            } else if(rng()<0.45) continue;                          // hits are events, not loops
            const ev={chop:1,beat:cur+cb*CBEATS+o,dur:hdur,amp:(hsrc.vol||0.2)*1.8,
              tableNum:hsrc.tableNum,pitch:1+(rng()*0.06-0.03),offset:0,cutoff:hsrc.cutoff||4500};
            if(hsrc.distant){ ev.amp*=0.32; ev.rsend=0.9; ev.dsend=0.72; ev.fade=0.4; }  // across the lake: way down, drenched, muffled
            else if(hsrc.wet){ ev.rsend=0.6; ev.dsend=0.45; }        // rides reverb + echo
            found.push(ev);
          }
        }
        }
      }
      // glitched paleontologist voiceover: the phrase plays, then gets stuttered /
      // pitch-jumped "like crazy" — instr 5 slice retriggers with random offset+rate.
      // RETAINED (found-handler retirement round): stations/horn/ding ported cleanly
      // to sampleEvents, but the glitched-narration idiom does NOT — its glitch is
      // an UPWARD-biased pitch set [.8,1,1,1.5] (not the downward stations/loon tail),
      // its burst count is gated by a per-line `clean` flag, each cluster lands at a
      // random in-section position, and the phrase length is min(secBeats-1,max(3,…))
      // not a chop cap. A faithful port would mean inventing a bespoke "narration"
      // placement that re-inlines this whole body — and, worse, this handler draws
      // the SHARED rng mid-section-loop, so removing it reshuffles the entire event
      // fabric of its three users (dinosynth/canawave/transitwave), all VIDEO_LOCKED
      // A-grade genres. Poor risk/reward; kept as the compat layer. (dinosynth also
      // has an ADDITIVE sampleEvents `response` layer over this — Phase 4.)
      if(sec.vox&&sec.vox.sourceId&&srcById[sec.vox.sourceId]){
        const vs=srcById[sec.vox.sourceId];
        const phraseBeats=Math.min(secBeats-1, Math.max(3,(vs.durSec||3)*state.bpm/60));
        // the phrase plays ONCE (no looping/double-speak), treated with reverb + delay
        found.push({chop:1,beat:cur+1,dur:phraseBeats,amp:(vs.vol||0.42),tableNum:vs.tableNum,
          pitch:vs.pitch||1,offset:0,cutoff:vs.cutoff||6500,rsend:0.32,dsend:0.26,fade:0.12});
        // glitch the voice: a couple of stutter clusters (more if it's the chopped poem)
        const nbursts=sec.vox.clean?1:2;
        for(let bi=0;bi<nbursts;bi++){
          if(rng()<0.85){
            const off=rng()*0.85, n=2+Math.floor(rng()*3), step=[0.0625,0.125][Math.floor(rng()*2)], b=1+rng()*Math.max(1,secBeats-4);
            for(let j=0;j<n&&b+j*step<secBeats-0.5;j++)
              found.push({chop:1,beat:cur+b+j*step,dur:step*1.6,amp:(vs.vol||0.42)*0.85,tableNum:vs.tableNum,
                pitch:[0.8,1,1,1.5][Math.floor(rng()*4)],offset:Math.min(0.98,off+j*0.03),cutoff:vs.cutoff||7000,rsend:0.35,dsend:0.4});
          }
        }
      }
      // the sung CHORUS: a pre-rendered WORLD-vocoder vocal (generated to match this bpm+key),
      // played once from the section downbeat at natural pitch, with space (reverb + delay).
      // RETAINED (found-handler retirement round): the PLACEMENT is a plain bed, but the
      // MECHANISM is three cross-cutting couplings the sampleEvents vocabulary can't hold:
      // (1) tw_vocal is a render-time SYNTHESIZED source (sing.py, generated per bpm+key),
      // carried as a foundSource with a `vocal:true` provider flag — not a pool id on disk;
      // (2) the kernel's evolution pass reads `s.vocal` to FORBID keyShift on the sung
      // section (canKey, genre-kernel ~L1997) — a fixed-pitch sample can't transpose with
      // the band; (3) the press guard strips tw_vocal + `s.vocal` when sing is unavailable.
      // Moving it to a spec would force the evolution pass + press guard to introspect
      // sampleEvents selectors to re-find the locked section — fragile, for no gain. Kept.
      if(sec.vocal&&srcById[sec.vocal]){
        const vc=srcById[sec.vocal], vdur=Math.min(secBeats-0.25,(vc.durSec||16)*state.bpm/60);
        found.push({chop:1,beat:cur+0.02,dur:vdur,amp:(vc.vol||0.5),tableNum:vc.tableNum,
          pitch:1,offset:0,cutoff:vc.cutoff||9000,rsend:0.34,dsend:0.2});
      }
      // (the bespoke door "ding ding" chime retired in the found-handler retirement
      //  round — now oneShot+cadence sampleEvents placements, see state.sampleEvents.)
      // synth stabs (rave chords on the chord root)
      if(sec.stab&&sec.stab!=="off"&&STAB_PATTERNS[sec.stab]){
        for(let cb=0;cb<secBeats/CBEATS;cb++){
          const chord=chords[cb%chords.length];
          for(const o of STAB_PATTERNS[sec.stab]){
            if(rng()<0.2) continue;
            sfx.push({stab:1,beat:cur+cb*CBEATS+o,dur:0.32,pch:pchAdd(chord.bass.r6,k+12),amp:0.16+rng()*0.05});
          }
        }
      }
      for(let c=0;c<cycles;c++){
        const cycleBase=cur+c*cycleBeats;
        let bassMut=0;   // MUSIC-MIND taste cap: at most 2 bass-cell mutations per cycle (no rng in the declaration)
        chords.forEach((chord,ci)=>{
          const Sp=cycleBase+ci*CBEATS;
          if(sec.pads){ const padAmp=(sec.swell ? 0.085*(0.5+1.9*((Sp-cur)/Math.max(1,secBeats))) : 0.085) * (sec.soloDuck?0.5:1);   // solo sections duck the comp so the improviser sits forward
            if(strumSpec){
              // RHYTHM-GUITAR STRUM (state.strum): the flat block becomes a
              // rhythmic comp — rake the chord's notes per strum-hit on the
              // dedicated strumRng stream (down-strokes low->high, ups high->low).
              const notes=chord.pads.map(p=>pchAdd(p,k));
              const ord=notes.map((_,i)=>i).sort((a,b)=>parsePch(notes[a])-parsePch(notes[b]));   // low->high indices
              const eff=Math.min(strumSpread,0.11/Math.max(1,notes.length-1));                    // keep the whole rake < ~0.11 beat
              const span=Math.max(0.5,strumSpec.cell);
              for(let t=0;t<CBEATS;t+=span) for(const[ho,dir,as]of strumSpec.hits){
                const hb=t+ho; if(hb>=CBEATS-0.001) continue;
                const jit=(strumRng()*2-1)*0.018;                                                 // per-hit timing humanize
                const hitAmp=padAmp*as*(0.85+strumRng()*0.28);                                    // per-hit level humanize
                const ring=dir>0?Math.min(CBEATS-hb,1.6):Math.min(CBEATS-hb,0.55);                // down-strokes ring, up-strokes choke
                for(let n=0;n<ord.length;n++){
                  const idx=dir>0?ord[n]:ord[ord.length-1-n];
                  const off=n*eff+(strumRng()*2-1)*0.003;
                  pitched.push({voice:"pad",beat:Sp+hb+jit+off,dur:Math.max(0.12,ring-off),pch:notes[idx],amp:hitAmp});
                }
              }
              if(state.padDouble) pitched.push({voice:"pad",beat:Sp,dur:CBEATS,pch:pchAdd(chord.pads[0],k-12),amp:padAmp*0.9});
            } else {
            chord.pads.forEach(p=>pitched.push({voice:"pad",beat:Sp,dur:CBEATS,pch:pchAdd(p,k),amp:padAmp}));
            // WALL OF SOUND (state.padDouble — heavymetal): thicken the power-chord
            // wall with an octave-below root double. One extra low voice per chord.
            if(state.padDouble) pitched.push({voice:"pad",beat:Sp,dur:CBEATS,pch:pchAdd(chord.pads[0],k-12),amp:padAmp*0.9}); } }
          if(sec.bass&&sec.bass!=="off"){
            const be=bassEvents(sec.bass,Sp,chord.bass,k,rng,CBEATS);
            const kept=brng?[]:null;   // rhythm knob only: collect survivors for the mutation pass (no draws, no byte drift)
            be.forEach(e=>{
              if(rng()<0.05) e.pch=pchAdd(e.pch,12);                  // octave pops
              if(rng()<0.06&&e.beat-Sp>0.4){ e.beat+=0.25; }          // lazy push
              if(rng()<0.05) return;                                  // rest
              pitched.push(e); if(kept) kept.push(e); });
            // MUSIC-MIND per-cycle bass-cell MUTATION (state.rhythm): the cell
            // breathes across cycles instead of looping — drop / anticipate /
            // octave-flip on the DEDICATED brng stream (seed+52100), per-note
            // gate ∝ complexity, hard-capped at 2 mutations per cycle (taste).
            // Runs only when the knob exists: zero draws otherwise (the law).
            if(kept) for(const e of kept){
              if(bassMut>=2) break;
              if(brng()>=0.10+0.20*rcx) continue;                     // gate ∝ complexity
              const kind=Math.floor(brng()*3);
              if(kind===0){ const i=pitched.indexOf(e); if(i>=0) pitched.splice(i,1); }  // drop a note (space is groove)
              else if(kind===1&&e.beat-Sp>=0.5) e.beat-=0.5;          // anticipate by half a beat (the push)
              else e.pch=pchAdd(e.pch,12);                            // octave flip (up — subs never go subterranean)
              bassMut++;
            }
          }
          if(sec.drums&&sec.drums!=="off"){
            let de=drumEvents(sec.drums,Sp,ci,chords.length,rng,state.euclid,state.swing,CBEATS);
            // humanity pass: hats drop out, levels breathe, ghost snares stay QUIET
            de=de.filter(e=>!(e.drum==="hat"&&rng()<0.09));
            de.forEach(e=>{ if(rng()<0.25) e.amp=Math.max(0.03,e.amp*(0.85+rng()*0.3)); });
            if(rng()<0.4) de.push({drum:"snare",beat:Sp+[1.75,3.25,5.75,6.75][Math.floor(rng()*4)],dur:0.15,amp:0.06+rng()*0.04});
            // evolution: later cycles of a section get busier (density rises with c)
            if(c>0&&rng()<Math.min(0.5,0.18*c)){
              de.push({drum:"hat",beat:Sp+Math.floor(rng()*16)*0.5,dur:0.08,amp:0.07+rng()*0.05});
              if(rng()<0.4) de.push({drum:"kick",beat:Sp+[3.5,7.5,5.75][Math.floor(rng()*3)],dur:0.3,amp:0.25+rng()*0.1});
            }
            de.forEach(e=>drums.push(e));
          }
        });
        if(sec.melody&&sec.melody!=="off"){
          const mel=melodyEvents(sec.melody,cycleBase,prg,chords,k,rng,state.seed,CBEATS,sec.soloIdiom);
          // MUSIC-MIND melody rhythm cells (state.rhythm): per sounding bar, on
          // the DEDICATED mrng stream (seed+52200), fire ∝ complexity and snap
          // the bar's phrase onto a named cell grid (MM_CELLS — dotted pairs /
          // tresillo / 3-3-2 over two bars). PITCH MATERIAL UNCHANGED — rhythm
          // only, applied AFTER melodyEvents so its internal rng draw order is
          // untouched. The hand-composed 32-beat tables are exempt (they are
          // signature lines, not generative phrases); composed styles that fell
          // back to a generative cell (cycleBeats!==32) do participate.
          if(mrng&&!((sec.melody==="composed"||sec.melody==="composed2")&&cycleBeats===32)){
            for(let bi=0;bi<Math.round(cycleBeats/CBEATS);bi++){
              const b0=cycleBase+bi*CBEATS;
              const ph=mel.filter(e=>e.beat>=b0&&e.beat<b0+CBEATS);
              if(!ph.length) continue;                             // silent bar: no draw (bar content is deterministic)
              if(mrng()>=rcx*0.4) continue;                        // fire ∝ complexity — one draw per sounding bar
              // ODD METER: a meter state retimes onto MEASURE-length cells
              // (tiled to the chord bar) instead of the 8-beat 4/4 grids —
              // same ONE cell draw either way, so the meterless path keeps
              // its exact draw sequence (byte-identity law).
              if(meter){ const fam=meter.beats===3?MM_CELLS_3:MM_CELLS_6;
                mmRetime(ph,b0,mmTile(fam[Math.floor(mrng()*fam.length)],meter.beats,CBEATS)); }
              else mmRetime(ph,b0,MM_CELLS[Math.floor(mrng()*MM_CELLS.length)]);
            }
          }
          if(sec.solo) mel.forEach(e=>{ e.solo=sec.solo; if(sec.soloOctave) e.pch=pchAdd(e.pch,12*sec.soloOctave); });
          // LEAD REGISTER (state.leadOctave, MUSICALITY balance loop 1): a
          // whole-track octave shift for the MAIN lead line, the anchor-level
          // fix for a genre whose score asks outside its sampler's natural
          // window (chalkvespers' plainchant choir asked up to midi 107 vs a
          // ceiling of 87 — the mapEvents fold saved the ear but bent the
          // contour; the SCORE should ask in range). Applied after
          // melodyEvents with zero rng, solo lines keep their own register
          // (soloOctave), so absent-key genres are byte-identical.
          if(state.leadOctave) mel.forEach(e=>{ if(!e.solo) e.pch=pchAdd(e.pch,12*(state.leadOctave|0)); });
          // BLUE-NOTE BEND (state.blueNote): when the resolved lead is a sampled
          // sax/guitar, held melody notes slide up into the blue note (b3/b7) —
          // the jazz-sax mirror of the "blues" pattern's bend. A dedicated stream
          // keyed by (seed, cycleBase) leaves every other event byte-identical;
          // only sampler voices render `bend` (VOICES.md), and it is not a
          // verifier feature (matrix-invisible).
          const lid=state.blueNote&&state.instruments.melody.sampler&&state.instruments.melody.sampler.id;
          if(lid&&/sax|guitar/.test(lid)){
            const br=mulberry32(((state.seed>>>0)^Math.imul(Math.round(cycleBase)+1,0x9e3779b1)^0x5b1c)>>>0);
            for(const e of mel){
              if(e.voice==="melody"&&!e.solo&&!e.bend&&e.dur>=0.6&&br()<state.blueNote)
                e.bend={from:-(0.5+br()*0.5), ms:Math.round(60+br()*80)};
            }
          }
          mel.forEach(e=>pitched.push(e));
        }
        if(sec.counter&&sec.counter.pattern){              // countermelody layer (e.g. a brass section) over the main melody
          const cm=melodyEvents(sec.counter.pattern,cycleBase,prg,chords,k,rng,state.seed,CBEATS);
          cm.forEach(e=>{ e.solo=sec.counter.solo; if(sec.counter.octave) e.pch=pchAdd(e.pch,12*sec.counter.octave);
            if(sec.swell) e.amp *= 0.3 + 1.9*((e.beat-cur)/Math.max(1,secBeats)); });   // crescendo build across the section
          cm.forEach(e=>pitched.push(e));
        }
      }
      // master filter sweep across this section
      if(sec.sweep==="open"){
        sfx.push({sweep:1,beat:cur,dur:secBeats,from:260,to:18000});
      } else if(sec.sweep==="close"){
        sfx.push({sweep:1,beat:cur,dur:secBeats,from:16000,to:380});
        sfx.push({sweep:1,beat:cur+secBeats,dur:0.05,from:21000,to:21000});   // the drop: snap open
      } else if(sec.sweep==="swell"){        // VARIETY: rise then fall — a filter "breath" across the section
        sfx.push({sweep:1,beat:cur,dur:secBeats*0.5,from:400,to:16000});
        sfx.push({sweep:1,beat:cur+secBeats*0.5,dur:secBeats*0.5,from:16000,to:500});
      } else if(sec.sweep==="dip"){          // VARIETY: fall then rise — a mid-section duck (the V)
        sfx.push({sweep:1,beat:cur,dur:secBeats*0.5,from:15000,to:700});
        sfx.push({sweep:1,beat:cur+secBeats*0.5,dur:secBeats*0.5,from:700,to:16000});
      } else if(sec.sweep==="openslow"){     // VARIETY: a gentler, higher-floored open (less dramatic than "open")
        sfx.push({sweep:1,beat:cur,dur:secBeats,from:900,to:14000});
      }
      // ⚡ transition into the next section
      const tr = sec.fill || (sec.fillInto ? "drum fill" : "off");
      if(tr==="drum fill"){
        fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));
      } else if(tr==="tom fill"){
        bigFillEvents(cur+secBeats-4,rng).forEach(e=>drums.push(e));
      } else if(tr==="break fill"){
        breakFillEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="hat rush"){
        let o=0,st=0.5;
        while(o<2){ drums.push({drum:"hat",beat:cur+secBeats-2+o,dur:0.08,amp:0.08+o*0.06}); o+=st; st=Math.max(0.125,st*0.8); }
      } else if(tr==="cut"){
        const cutFrom=cur+secBeats-2;        // the cut: drums vanish, the drop hits harder
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=cutFrom&&drums[i].beat<cur+secBeats) drums.splice(i,1);
      } else if(tr==="snare roll"){
        snareRollEvents(cur+secBeats-4,rng).forEach(e=>drums.push(e));
      } else if(tr==="stutter"){
        // stutter-gate the last half-bar: existing hits are replaced by a 16th-grid
        // retrigger of the loudest survivor, amp ramping up into the downbeat
        const from=cur+secBeats-2, upto=cur+secBeats;
        let proto=null;
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=from&&drums[i].beat<upto){
          if(!proto||drums[i].amp>proto.amp) proto=drums[i];
          drums.splice(i,1);
        }
        const dr=proto?proto.drum:"snare";
        for(let i=0;i<8;i++) drums.push({drum:dr,beat:from+i*0.25,dur:0.12,amp:0.14+i*0.045+rng()*0.02});
      } else if(tr==="dropout"){
        // kick-drop silence: the final beat empties completely (drums AND any
        // pitched note that starts inside it) so the next downbeat slams
        const from=cur+secBeats-1, upto=cur+secBeats;
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=from&&drums[i].beat<upto) drums.splice(i,1);
        pitched=pitched.filter(e=>!(e.beat>=from&&e.beat<upto&&!e.solo));
      } else if(tr==="micro lick"){
        // the tiny soloist takes the turn — resolve into the NEXT section's key
        const nx=state.sections[state.sections.indexOf(sec)+1];
        const kNext=k0+((nx?nx.keyShift:sec.keyShift)|0);
        if(state.lickVoice) lickEvents(cur+secBeats, chords[0], kNext, rng, state.lickVoice).forEach(e=>pitched.push(e));
        else fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));   // no lick voice in state: degrade musically
      } else if(tr==="kit fill"){
        miniFillEvents(drums, cur+secBeats, rng);
      } else if(tr==="flam roll"){
        flamRollEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="tom cascade"){
        tomCascadeEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="crash choke"){
        crashChokeEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="tape stop"){
        tapeStopEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="reverse crash"){
        // reverse-cymbal suck-in (quiet SFX build over the last bar) resolving to
        // a crash + impact slam on the next downbeat
        sfx.push({beat:Math.max(0,cur+secBeats-4),dur:4,type:SFX_NUM.reverse,amp:0.07});
        drums.push({drum:"crash",beat:cur+secBeats,dur:1.2,amp:0.85});
        sfx.push({beat:cur+secBeats,dur:1.5,type:SFX_NUM.impact,amp:0.34});
      } else if(tr==="filter riser"){
        // a riser SFX (type 1) UNDER an accelerating hat rush — a doubled build
        sfx.push({beat:Math.max(0,cur+secBeats-4),dur:4,type:SFX_NUM.riser,amp:0.06});
        let o=0,st=0.5;
        while(o<2){ drums.push({drum:"hat",beat:cur+secBeats-2+o,dur:0.08,amp:0.07+o*0.05}); o+=st; st=Math.max(0.125,st*0.82); }
      } else if(tr==="build drop"){
        // full-bar snare-roll crescendo + riser, THEN the final beat DROPS OUT
        // (drums + non-solo pitched cleared) so the next downbeat slams
        snareRollEvents(cur+secBeats-4,rng).forEach(e=>drums.push(e));
        sfx.push({beat:Math.max(0,cur+secBeats-4),dur:4,type:SFX_NUM.riser,amp:0.05});
        const dfrom=cur+secBeats-1, dupto=cur+secBeats;
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=dfrom&&drums[i].beat<dupto) drums.splice(i,1);
        pitched=pitched.filter(e=>!(e.beat>=dfrom&&e.beat<dupto&&!e.solo));
      } else if(SFX_NUM[tr]){
        const hit=(tr==="impact"||tr==="noise");
        const sbeat = hit ? cur+secBeats : cur+secBeats-4;   // hit on next downbeat; build in final bar
        // 2026-07: the sweep family is DEMOTED (-8dB; the loud noise build was
        // "very loud, very disruptive, overused") — impact keeps its slam.
        // 2026-07-04 human-calibrated law: "if you're going to use a filter
        // sweep over noise it must be much quieter and the filter must cut
        // very deeply" — a further ~-9dB here (0.16->0.055, 0.2->0.07) plus
        // the deep resonant filter ranges in faust/dsp/sfx.dsp.
        const amp = tr==="impact"?0.4 : (tr==="reverse"||tr==="downlift")?0.07 : 0.055;
        sfx.push({beat:Math.max(0,sbeat), dur:hit?1.5:4, type:SFX_NUM[tr], amp});
      }
      spans.push({start:cur,beats:secBeats,name:sec.name,kit:sec.drums});
      cur+=secBeats;
    }
    // ONE totalBeats, computed once — the value the final return uses AND the
    // window CsdPipes caps its emissions to (never let the two drift).
    const totalBeats=cur+8;
    // ---- pattern-transform algebra (KERNEL-V4 Phase 2) ----
    // ONE generic per-cycle pass over the transform pool (TRANSFORM_OPS above),
    // parameterised by state.transforms = { pool, rate, schedule, everyN,
    // targets }. Own rng stream (seed+31337) so the base fabric is untouched;
    // same seed -> same transforms. Applied ON TOP of the humanity rules, never
    // on the first bar of a section. ABSENT transforms = TF_DEFAULT_POOL @ .25,
    // the historical global switch draw-for-draw (fixtures.js pins it).
    //   schedule "prob"      (default): each non-first bar fires with prob `rate`
    //   schedule "everyN"    : fire on bars where bi % everyN === 0 (sparse, no
    //                          rate draw — minimal's "one mutation every 8 bars")
    //   schedule "formAware" : like prob, but STABLE sections (the hook/chorus)
    //                          are left untouched — mutate the verses, hold the drop
    {
      const tf=state.transforms;
      const pool=(tf&&tf.pool&&tf.pool.length)?tf.pool:TF_DEFAULT_POOL;
      const rate=(tf&&tf.rate!=null)?tf.rate:0.25;
      const sched=(tf&&tf.schedule)||"prob";
      const everyN=Math.max(1,(tf&&tf.everyN)||8);
      const targets=(tf&&tf.targets)||null;
      const trng=mulberry32(((state.seed??1)+31337)>>>0);
      const dropT=new Set();
      const X={ b0:0, b1:0, cb:CBEATS, trng, pitched, drums, dropT };
      for(const sp of spans){
        const nbars=Math.floor(sp.beats/CBEATS);
        const stable=sched==="formAware"&&STABLE_SECTION.test(sp.name||"");
        for(let bi=1;bi<nbars;bi++){
          if(sched==="everyN"){ if(bi%everyN!==0) continue; }
          else { if(stable) continue; if(trng()>=rate) continue; }
          X.b0=sp.start+bi*CBEATS; X.b1=X.b0+CBEATS;
          const op=TRANSFORM_OPS[pool[Math.floor(trng()*pool.length)]];
          if(op && (!targets || targets[op.lane]!==false)) op.fn(X);
        }
      }
      if(dropT.size){ pitched=pitched.filter(e=>!dropT.has(e)); drums=drums.filter(e=>!dropT.has(e)); }
    }
    // ---- jux stereo divergence (production dimension; state.jux in [0,1]) ----
    // Events gain a `pan` offset in [-1,1] (absent/0 = center; the SIGNED
    // convention every consumer must use — pipes.js mirrors with -pan, faust
    // panGains clamps to [-1,1]). Hats alternate L/R, toms spread by pitch,
    // melody alternates sides, pads scatter; kick/snare/bass stay center (the
    // low end never leaves the middle).
    //
    // HONEST STATUS (audit 2026-07-25 — do not restore the old claim that "the
    // Faust engine reads it"): NO backend consumes event.pan today. Faust
    // state-engine.mapEvents translates only cutoffMul/vib/pw; every per-note
    // pan in press/stream/live/sampler comes from SE.notePan(unit,freq), i.e.
    // the UNIT pan (MASTER_PAN + pad panSpread). So state.jux currently widens
    // nothing audible — the score-side stamping below is the half of the
    // feature that exists, kept (a) byte-identical, (b) correct, and (c) ready
    // for the mapEvents→note.pan wiring, which lives in engine/faust and must
    // be made there. Until that lands, treat jux as a SCORE annotation, not a
    // mix control (docs/MUSIC-MIND.md "The dead knob: jux").
    {
      const jux=Math.min(1,Math.max(0,state.jux||0));
      if(jux>0){
        const jrng=mulberry32(((state.seed??1)+424242)>>>0);
        let hi=0, mi=0;
        for(const d of drums){
          if(d.drum==="hat") d.pan=+(((hi++%2)?0.4:-0.4)*jux).toFixed(3);
          else if(d.drum==="tom") d.pan=+((((d.pitch||100)-100)/100)*jux).toFixed(3);
        }
        for(const e of pitched){
          if(e.voice==="melody") e.pan=+((((mi++%2)?0.35:-0.35)*(0.6+0.4*jrng()))*jux).toFixed(3);
          else if(e.voice==="pad") e.pan=+(((jrng()*2-1)*0.5)*jux).toFixed(3);
        }
      }
    }
    const grng=mulberry32(((state.seed??1)+777)>>>0);
    const tfeel=resolveTimeFeel(state);   // KERNEL-V4 Phase 3: one resolved time-feel spec for both stages
    applyGroove(pitched, tfeel, grng);
    applyGroove(drums,   tfeel, grng);
    // ---- MECHANICAL INTIMACY (state.thunk = {prob, amp}) ----
    // Soft key/pedal noise on a fraction of LEAD notes: a whisper-level tom
    // "thump" (pitch 90-160Hz, amp ~-30dB) exactly at the grooved note onset
    // (after applyGroove so the thunk lands WITH the humanized key strike).
    // Own rng stream; states without thunk skip entirely (zero change).
    if(state.thunk&&state.thunk.prob>0){
      const trng=mulberry32(((state.seed??1)+8181)>>>0);
      for(const e of pitched){
        if(e.voice!=="melody"||e.solo) continue;
        if(trng()<state.thunk.prob)
          drums.push({drum:"tom",beat:e.beat,dur:0.09,amp:(state.thunk.amp||0.03)*(0.8+0.4*trng()),pitch:90+Math.round(trng()*70)});
      }
    }
    // feed individual snare hits to the long ping-pong delay — the classic dusty
    // snare THROW that tails across the bar. Liberality scales with the send
    // amount: a genre that wants a wetter throw (snarePP>=.65) wants it thrown
    // MORE often and closer together (>=2 beats, prob .82 — most backbeats echo);
    // the moderate legacy send (transitwave .6, the sparse motorik ding under a
    // PA) keeps its untouched >=4-beat/.6 spacing. grng is TERMINAL here (no
    // downstream consumer — see line 1217), so the extra draws tag only WHICH
    // snares echo; no other rng stream shifts (only the snare pp field drifts).
    if(state.snarePP>0){ let last=-99;
      const lib=state.snarePP>=0.65, gap=lib?2:4, prob=lib?0.82:0.6;   // liberal throw for the high-send dusty genres; low users untouched
      for(const d of drums){ if(d.drum==="snare" && d.beat-last>=gap && grng()<prob){ d.pp=state.snarePP; last=d.beat; } } }
    // ---- ACID accent/slide (the tb303 voice) ----
    // The 303's two per-note behaviors, tagged onto the bass notes: ACCENT
    // (louder + squelchier — its own env in the module) and SLIDE (legato glide
    // INTO this note from the previous one; the mono-legato scheduler holds the
    // gate when the notes are close). ONLY the tb303 bass module reads accent/
    // slide — bass_acid and every other voice ignore them — so this tags nothing
    // audible elsewhere, and its OWN rng stream (seeded off state.seed) leaves
    // every existing render byte-identical.
    if((state.instruments&&state.instruments.bass&&state.instruments.bass.model)==="tb303"){
      const arng=mulberry32(((state.seed??1)+3030)>>>0);
      const bassN=pitched.filter(e=>e.voice==="bass").sort((a,b)=>a.beat-b.beat);
      for(let i=0;i<bassN.length;i++){
        const e=bassN[i], prev=bassN[i-1];
        e.accent = arng()<0.34 ? +(0.7+0.3*arng()).toFixed(3) : 0;            // ~1/3 of steps accented
        const gap = prev ? (e.beat-(prev.beat+(prev.dur||0))) : 99;           // note-off -> next-on, in beats
        e.slide = (prev && gap<0.3 && arng()<0.45) ? +(0.55+0.45*arng()).toFixed(3) : 0;  // glide into legato-close steps
      }
    }
    // (the bespoke every-measure `stationPool` litany retired in the found-handler
    //  retirement round — it is now a `buried` sampleEvents placement, below.)
    // ---- generalized SAMPLE-EVENT ROLES (KERNEL-V4 Phase 4) ----
    // bed/chops/break/hits/vox/horn/ding/stations/vocal were each a bespoke
    // SAMPLE placement wired through the whole stack (the handlers above +
    // stationPool). state.sampleEvents is the ONE dimension that generalizes
    // them: an array of role specs, each a POOL of source ids + a PLACEMENT
    // algorithm + a section filter + treatment. This pass emits the SAME
    // `found` event shapes the bed/chop handlers already emit (see
    // faust/state-engine.js §found — {chop,beat,dur,amp,tableNum,pitch,offset,
    // cutoff,rsend,dsend,ppsend,fade,sqRate,sqDepth} for hits/slices, and
    // {beat,dur,amp,tableNum,pitch,stretch,cutoff} for beds), so the Faust
    // voice layer renders them with ZERO engine-side change. Placed BEFORE the
    // rubato warp so its events inherit the same musical clock as every other
    // layer. Own rng stream (seed+9091) so an adopting genre perturbs nothing
    // but its own new layer; ABSENT/empty state.sampleEvents => the pass never
    // runs => byte-identical (fixtures.js pins it). The transitwave inventions
    // (opener horn, sectionEdge ding, buried station litany) are now
    // catalog-wide vocabulary any genre can request.
    //   spec = { pool:[srcId...], placement, sync, sections, treatment, gain, prob }
    //   placement  bed      one sustained source spanning each matching section
    //              slice    beat-synced chop hits across the section (chops role)
    //              oneShot  one chop at each matching section's downbeat
    //              opener   oneShot on the FIRST matching section only (goal horn)
    //              cadence  oneShot at each matching section's END (door "ding")
    //              buried   one source under every measure, rotating (stations)
    //              response one source on the ANSWER half of each chord bar (the
    //                       blues 78rpm call-and-response / thunk "answer the
    //                       lead" idea, generalized to bar granularity)
    //   sections   "all" | "first" | "quiet"(no drums) | <regex string on name>
    //   treatment  pitch,stretch,cutoff,rsend,dsend,ppsend,fade,sqRate,sqDepth,
    //              maxDur (one-shot length cap in beats; default 4),
    //              vol (amp base override, replaces the source's own vol),
    //              glitch(bool) — the narration/loon stutter-down tail — and
    //              glitchBursts (shot-glitch cluster count, the vox clean=1/
    //              chopped=2 idiom; buried glitch is the fixed stations tail)
    //   gain       amp multiplier over the source's vol; prob per-placement gate
    if(Array.isArray(state.sampleEvents) && state.sampleEvents.length){
      const serng=mulberry32(((state.seed??1)+9091)>>>0);
      const secs=state.sections||[];
      // per-spec section matcher: `sel` is spec.sections (constant per spec), so
      // the regex is compiled ONCE per spec here, not once per spec×section.
      const makeMatcher=(sel)=>{
        if(!sel||sel==="all") return ()=>true;
        if(sel==="first") return (i)=>i===0;
        if(sel==="quiet") return (i,sec)=>!sec.drums||sec.drums==="off";
        // typed-node selector (Phase 5): "tag:peak" or "tag:peak,cadence" —
        // matches the section's form-graph node type, resilient to renames.
        if(sel.slice(0,4)==="tag:"){
          const want=sel.slice(4).split(",").map(s=>s.trim()).filter(Boolean);
          return (i,sec)=>want.includes(sec.tag||sectionTag(sec.name));
        }
        let re=null; try{ re=new RegExp(sel,"i"); }catch(e){ re=null; }
        return (i,sec)=> re ? re.test(sec.name||"") : (sec.name||"")===sel;
      };
      for(const spec of state.sampleEvents){
        const pool=(spec.pool||[]).map(id=>srcById[id]).filter(Boolean);
        if(!pool.length) continue;
        const matchSec=makeMatcher(spec.sections);
        const tr=spec.treatment||{}, gain=spec.gain!=null?spec.gain:1, prob=spec.prob!=null?spec.prob:1;
        const place=spec.placement||"oneShot", sync=spec.sync||null;
        // treatment.vol OVERRIDES the source's own vol as the amp base (zero-rng;
        // absent => the source's vol, i.e. every pre-existing spec byte-identical).
        // Needed because sampleEvents pool ids ride foundSources at a generic vol
        // (toState); a station litany wants its own stationVol, a filtered horn its
        // own gain — expressed here rather than through a per-id foundSource vol.
        const vbase=(src,dflt)=>tr.vol!=null?tr.vol:(src.vol||dflt);
        // seeded pool rotation — each source used once before any repeat (stations law)
        const order=pool.slice();
        for(let i=order.length-1;i>0;i--){ const j=Math.floor(serng()*(i+1)); const t=order[i]; order[i]=order[j]; order[j]=t; }
        let pi=0; const nextSrc=()=>order[pi++%order.length];
        // one-shot length = the source clip in beats, capped (treatment.maxDur
        // shortens the cap for a tight chime like the door "ding"; default 4)
        const chopDur=(src)=>Math.min(tr.maxDur!=null?tr.maxDur:4,(src.durSec||1.2)*state.bpm/60);
        // dress a base found-event with the spec's treatment
        const dress=(ev,src)=>{
          ev.tableNum=src.tableNum;
          ev.cutoff=tr.cutoff!=null?tr.cutoff:(src.cutoff||3500);
          if(tr.rsend!=null) ev.rsend=tr.rsend;
          if(tr.dsend!=null) ev.dsend=tr.dsend;
          if(tr.ppsend!=null) ev.ppsend=tr.ppsend;
          if(tr.fade!=null) ev.fade=tr.fade;
          if(tr.sqRate!=null) ev.sqRate=tr.sqRate;
          if(tr.sqDepth!=null) ev.sqDepth=tr.sqDepth;
          return ev;
        };
        const shot=(src,beat)=>{
          found.push(dress({chop:1,beat,dur:chopDur(src),amp:vbase(src,0.3)*gain,
            pitch:tr.pitch!=null?tr.pitch:1,offset:0},src));
          if(tr.glitch){                                             // downward stutter tail (narration/loon idiom)
            // treatment.glitchBursts (default 1): the narration VO fires 1-2 stutter
            // CLUSTERS each ~85% (the old vox handler's clean=1 / chopped=2 shape);
            // a plain 1-burst glitch reproduces the loon/response tail unchanged.
            const bursts=tr.glitchBursts!=null?tr.glitchBursts:1;
            for(let bi=0;bi<bursts;bi++){
              if(bursts>1 && serng()>=0.85) continue;               // each cluster fires ~85% (vox idiom)
              const base=bursts>1 ? beat+serng()*Math.max(1,chopDur(src)) : beat+chopDur(src)*0.5;
              const n=2+Math.floor(serng()*3), step=0.125;
              for(let j=0;j<n;j++) found.push(dress({chop:1,beat:base+j*step,dur:step*1.6,
                amp:vbase(src,0.3)*gain*0.8,pitch:[0.5,0.6,0.7,0.8][Math.floor(serng()*4)],
                offset:Math.min(0.9,serng()*0.5)},src));
            }
          }
        };
        let firstDone=false;
        for(let si=0;si<spans.length;si++){
          const sp=spans[si], sec=secs[si]||{};
          if(!matchSec(si,sec)) continue;
          const S=sp.start, B=sp.beats;
          if(place==="bed"){
            if(prob>=1||serng()<prob){ const src=nextSrc();
              found.push(dress({beat:S,dur:B,amp:vbase(src,0.22)*gain,
                pitch:tr.pitch!=null?tr.pitch:(src.pitch??0.78),
                stretch:tr.stretch!=null?tr.stretch:(src.stretch??0.45)},src)); }
          } else if(place==="slice"){
            for(let b=0;b<B;b++){ if(serng()>=(prob<1?prob:0.55)) continue;
              const src=nextSrc();
              found.push(dress({chop:1,beat:S+b+(serng()<0.3?0.5:0),dur:0.35+serng()*0.5,
                amp:vbase(src,0.3)*1.6*gain,pitch:tr.pitch!=null?tr.pitch:(src.pitch??1),
                offset:serng()},src)); }
          } else if(place==="opener"){
            // LIVE gate (state._liveEdge, set only by faust/live.js stepWalk's
            // one-section-per-bar walk): an opener fires at a section START, so on
            // the live path emit it only on the bar that genuinely begins a section.
            // Absent (press / full-song state) => the original "first matching
            // section only" behavior, byte-identical.
            if(state._liveEdge && !state._liveEdge.start) continue;
            if(firstDone) continue; firstDone=true;
            if(prob>=1||serng()<prob) shot(nextSrc(),S+0.25);
          } else if(place==="oneShot"){
            // sectionEdge oneShot anchors to the section END, a plain oneShot to its
            // downbeat (START). Live-gate each to its real edge; press unaffected.
            if(state._liveEdge && (sync==="sectionEdge"?!state._liveEdge.end:!state._liveEdge.start)) continue;
            if(prob>=1||serng()<prob){ const src=nextSrc();
              shot(src, sync==="sectionEdge"?Math.max(S,S+B-chopDur(src)-0.5):S+0.25); }
          } else if(place==="cadence"){
            if(state._liveEdge && !state._liveEdge.end) continue;   // the door "ding": section END only (live)
            if(prob>=1||serng()<prob){ const src=nextSrc();
              shot(src, Math.max(S,S+B-chopDur(src)-0.5)); }
          } else if(place==="buried"){
            // the world-metro station litany: one name under every measure (4 beats),
            // rotating, square-LFO amplitude-gated at varying intensity; with
            // treatment.glitch the name is chased ~70% by a mostly-DOWNWARD stutter
            // tail (2-3 hits at .5-.8 pitch) — the exact bespoke `stations` shape.
            // treatment.every (measures between drops, default 1) and treatment.
            // maxDur (beat cap, default the historical 2.6) are zero-rng opt-ins:
            // absent => byte-identical. hogcore's full "<name> is trans" phrases
            // (up to 2.61s > one 150-164bpm bar) ride every:2 + maxDur:8 so the
            // whole phrase lands before the next name starts.
            for(let b=0;b<B-2;b+=4*(tr.every||1)){                   // one under every `every` measures
              if(prob<1&&serng()>=prob) continue;
              const src=nextSrc(), sqd=[0.3,0.55,0.75,0.92][Math.floor(serng()*4)], sqr=[3,5,8,12][Math.floor(serng()*4)];
              found.push(dress({chop:1,beat:S+b+0.5,dur:Math.min(tr.maxDur!=null?tr.maxDur:2.6,(src.durSec||1)*state.bpm/60),
                amp:vbase(src,0.26)*gain,pitch:tr.pitch!=null?tr.pitch:1,offset:0,
                rsend:tr.rsend!=null?tr.rsend:0.3,dsend:tr.dsend!=null?tr.dsend:0.22,
                sqRate:tr.sqRate!=null?tr.sqRate:sqr,sqDepth:tr.sqDepth!=null?tr.sqDepth:sqd},src));
              if(tr.glitch&&serng()<0.7){                            // glitch mostly DOWNWARD
                const nb=2+Math.floor(serng()*2), stp=0.125;
                for(let j=0;j<nb;j++) found.push(dress({chop:1,beat:S+b+0.85+j*stp,dur:stp*1.5,
                  amp:vbase(src,0.12)*gain*0.8,pitch:[0.5,0.6,0.7,0.8][Math.floor(serng()*4)],
                  offset:Math.min(0.9,serng()*0.5),rsend:0.3,dsend:0.3},src)); }
            }
          } else if(place==="response"){
            const nbars=Math.max(1,Math.round(B/CBEATS));
            for(let bar=0;bar<nbars;bar++){ if(prob<1&&serng()>=prob) continue;
              shot(nextSrc(), S+bar*CBEATS+CBEATS/2); }
          }
        }
      }
    }
    // ---- PERCUSSION LANE (2026-07) — decorative perc OVER the kit ----
    // Lays the genre's state.perc.lanes across every span that HAS a kit
    // (kit!=="off"): claps on 2&4, ride/rim for swing, crash on section downbeats,
    // congas/shaker/cowbell/… from the GM bank. Own rng stream (seed+61453) so an
    // adopting genre perturbs nothing but its own new layer (ABSENT state.perc =>
    // pass never runs => byte-identical). Grooved with the SAME time-feel as the
    // kit (isolated rng), then pushed into `drums` so the rubato warp below keeps
    // it sample-locked. NEW event types (clap/rim/ride/crash/perc) are ignored by
    // the snare-law (snare/hat only) and by the verifier (core-kit fabric only).
    // METER / chordEvery AWARENESS (audit 2026-07-25): the pass used to tile at
    // a hardcoded 8-beat stride with nbars=round(sp.beats/8) whatever the chord
    // bar was, so a span whose length is not a multiple of 8 (a 3-chord
    // progression on a 12-beat bar: 36 beats -> round(4.5)=5 bars) ran its last
    // perc bar up to 4 beats PAST the section end — clattering into the next
    // section even when that section's kit is "off" or a cut/dropout transition
    // just silenced everything (perc is added after the transition chain, so
    // nothing downstream clears it). Now the perc cell tiles exactly like
    // drumEvents' kit cells: stride PCELL=min(CBEATS,CHORD_BEATS) — a 6-beat
    // waltz bar or a 4-beat half-bar tiles by its OWN period and truncates the
    // 8-unit cell; a 12/16/32-beat bar keeps the 8-unit cell and tiles ceil()
    // of the span — and emission is a FILTER (nothing past the cell, nothing
    // past the span end). RNG DISCIPLINE: both prng draws happen before the
    // filter, exactly as before, so draw counts — and therefore every existing
    // genre's bytes — are untouched (verified: no catalog state pairs perc with
    // a non-8 chord bar, so the whole 274x3 build is byte-identical here).
    if(state.perc && Array.isArray(state.perc.lanes) && state.perc.lanes.length){
      const prng=mulberry32(((state.seed??1)+61453)>>>0);
      const percArr=[];
      const PCELL=Math.min(CHORD_BEATS,Math.max(1,CBEATS));
      for(const sp of spans){
        if(!sp.kit || sp.kit==="off") continue;
        const spEnd=sp.start+sp.beats;
        const nbars=Math.max(1,Math.ceil(sp.beats/PCELL));
        for(const lane of state.perc.lanes){
          const crash=lane.p==="crashDown", busy=/shaker|ride8/.test(lane.p);
          for(let bi=0;bi<nbars;bi++){
            if(crash && bi>0) continue;                          // crash only on the section downbeat
            const b0=sp.start+bi*PCELL;
            const ev=percBar(lane.p, b0, lane.lvl!=null?lane.lvl:0.2, bi);
            for(const e of ev){
              if(busy && prng()<0.12) continue;                  // thin the dense lanes (humanity)
              e.amp=Math.max(0.03, e.amp*(0.85+prng()*0.3));
              if(e.beat<b0+PCELL-1e-9 && e.beat<spEnd-1e-9) percArr.push(e);   // filter AFTER the draws
            }
          }
        }
      }
      applyGroove(percArr, tfeel, mulberry32(((state.seed??1)+61454)>>>0));
      for(const e of percArr) drums.push(e);
    }
    // ---- RUBATO — the SECTION stage of the unified time-feel (Phase 3) ----
    // (state.rubato = {depth, periodBars, phase}; resolved into tfeel.rubato)
    // Deterministic slow breathing of tempo, implemented ONCE here as a
    // smooth monotonic BEAT-WARP so every consumer (faust press, faust live,
    // midi-export — anything that maps beat -> time linearly with spb)
    // inherits the exact same musical clock and all layers stay sample-locked
    // BY CONSTRUCTION (the drift-gate invariant: same beat => same time).
    //   tempo(b)/tempo0 = 1 + depth·cos(2πb/P + φ)
    //   warp(b) = b + A·(sin(2πb/P + φ) − sin φ),  A = depth·P/2π
    // P = periodBars·4 beats; warp(0)=0 (the first downbeat holds), |Δ| ≤ 2A,
    // strictly monotonic for depth < 1. Durations warp as intervals so legato
    // stays legato. depth .02-.04 ≈ ±2-4% tempo sway over 2-4 bars.
    // Live note: the live engine rebuilds per chord-bar with cycle-local
    // beats, so the breathing phase restarts each section cycle — still
    // deterministic, still layer-locked (documented in faust/VOICES.md).
    // RUNS BEFORE the SNARE-LAW so the law measures/mutates the FINAL timeline —
    // the anti-repeat check can't be defeated by a sub-1/16 warp nudging a
    // displaced hit back across a quantization boundary (its own added events
    // inherit this same warp via `rubW`, so they stay layer-locked too).
    let rubW=(b)=>b;
    if(tfeel.rubato){
      const rb=tfeel.rubato;
      const dep=Math.min(0.2,rb.depth), P=Math.max(4,(rb.periodBars||3)*4);
      const ph=2*Math.PI*(rb.phase||0), A=dep*P/(2*Math.PI);
      rubW=(b)=>b + A*(Math.sin(2*Math.PI*b/P+ph)-Math.sin(ph));
      for(const arr of [pitched,drums,found,sfx]) for(const e of arr){
        const d0=e.dur||0, b1=rubW(e.beat+d0);
        e.beat=rubW(e.beat); if(d0) e.dur=Math.max(0.02,b1-e.beat);
      }
    }
    // ---- CsdPipes (MUSIC-MIND organ #2) — the one true choke point ----
    // The pipe chain runs on the whole bundle just BEFORE the snare-law pass,
    // so the law still runs DEAD LAST and measures/mutates the FINAL timeline
    // (pipes that add or drop drum events are inside its jurisdiction). Each
    // pipe draws only its own stream (seed+71000+i*97 — pipes.js); absent or
    // empty state.pipes never calls apply(): zero draws, the same arrays, the
    // byte-identity law. Organ not loaded in this context: the knob degrades
    // to the plain fabric rather than throwing.
    if(state.pipes&&state.pipes.length&&CsdPipesRef&&CsdPipesRef.apply){
      const bundle=CsdPipesRef.apply({bpm:state.bpm,totalBeats,pitched,drums,found,sfx},state);
      pitched=bundle.pitched; drums=bundle.drums; found=bundle.found; sfx=bundle.sfx;
    }
    // ---- SAMPLER REGISTER HOME (MUSICALITY balance loop 2) ----
    // THE REGISTER LAW, GUARANTEED AT THE SOURCE. Every progression's lead
    // voicing is written at pch octave 8-9 (midi 60-95) — the synth-lead
    // convention — and the bass cells reach r6/f6 octave tones. A sampled
    // wind/guitar/choir owns a LOWER window (zone roots -12..+6 st, the
    // mirror of faust/state-engine SAMPLER_FLOOR_ST/SAMPLER_STRETCH_ST), so
    // the same line that sits perfectly under a saw lead asks a tenor sax
    // for midi 88 (audit 2026-07: 54 genres, one template convention). The
    // mapping layer's per-note render fold saved the ear but bent phrase
    // contours — the climax note folded down an octave. This pass moves the
    // register decision into the SCORE, zero-rng, per RESOLVED instrument
    // (seeds whose pool draw landed on a synth are untouched). It runs
    // AFTER the pipes so harmonize/echoCanon copies ride the same decision.
    //
    //   1. WHOLE-LINE HOME (melody/pad either way; bass upward only): when
    //      less than REGISTER_FIT of a sampled slot's notes sit inside the
    //      natural window, shift the ENTIRE line by the whole octave that
    //      maximizes the in-window fraction — contour intact, the line in
    //      the register the instrument actually owns (a tenor-sax lead at
    //      median E5 lands at E4). Improvement must be strict; ties prefer
    //      the smaller shift, then the better-centered line. Bass never
    //      shifts DOWN: a high bass line (polygonforge's driving pick at
    //      A2) is an identity, not a misregistration — its overshoots are
    //      ornaments, handled by 2. The decision is measured ONCE per
    //      state: the kernel pins it as state.regHome at track resolve (one
    //      measurement build), and a pinned build applies the constant
    //      without re-measuring — so the live engine's per-bar rebuilds
    //      (reseeded, one section at a time) play the identical register
    //      every bar: no octave flapping, no live/press divergence (the
    //      same reasoning that keeps the render fold per-note — see
    //      faust/state-engine). Unpinned states (hand states) measure here
    //      per build.
    //   2. PER-NOTE ORNAMENT FOLD: bass cell octave tones (r6/f6 exceed the
    //      top zone only on high-rooted chords — a player folds those onto
    //      the neck) and pipe ornament copies (harm/echo — a parallel third
    //      that exceeds the instrument INVERTS to the sixth below; an
    //      octave echo folds to the unison: voice-leading idiom, not a
    //      contour break). Folded by octaves into the window — the SAME
    //      pitch the mapping layer's render fold produces for whatever the
    //      score leaves outside, so the audio is unchanged; the score now
    //      states it. Gated on the slot's event fit being under
    //      REGISTER_FIT so a slot that already fits stays byte-identical,
    //      ornaments and all (the gate is render-neutral either way).
    // The REGISTER law stays a live alarm for the melody/pad LINE, where a
    // fold is a contour break — line notes are never folded here.
    // state.leadOctave (the anchor-level taste override, applied at build)
    // is already in the measured events, so a line it homed passes the fit
    // test and is never double-shifted. All-fitting slots: zero decision,
    // zero pch change — byte-identity for every genre that was never
    // misregistered.
    const regHome={};   // the decision this build applied (kernel reads it off the bundle to pin)
    {
      const REGISTER_FIT=0.95;   // the musicality REGISTER threshold (docs/MUSICALITY.md)
      const I=state.instruments||{};
      const pin=state.regHome||null;   // kernel-pinned decision (whole-track constant)
      for(const [slot,voice] of [["melody","melody"],["pad","pad"],["bass","bass"]]){
        const m=I[slot];
        if(!m||m.model!=="sampler"||!m.sampler||!Array.isArray(m.sampler.zones)||!m.sampler.zones.length) continue;
        const roots=m.sampler.zones.map(z=>z.root).filter(r=>r!=null);
        if(!roots.length) continue;
        const lo=Math.min.apply(null,roots)-12, hi=Math.max.apply(null,roots)+6;   // SAMPLER_FLOOR_ST / SAMPLER_STRETCH_ST
        const evs=pitched.filter(e=>e.voice===voice&&!e.solo);
        if(!evs.length) continue;
        // 1. whole-line home: apply the pin, or measure (unpinned build)
        let best=0;
        if(pin) best=(pin[slot]|0);
        else {
          const mids=evs.map(e=>pchToMidi(e.pch));
          const frac=sh=>{ let n=0; for(const md of mids) if(md+sh>=lo&&md+sh<=hi) n++; return n/mids.length; };
          const f0=frac(0);
          if(f0<REGISTER_FIT){
            const cand=slot==="bass"?[12,24]:[-12,12,-24,24];
            const center=(lo+hi)/2, med=mids.slice().sort((a,b)=>a-b)[mids.length>>1];
            let bf=f0,bc=Infinity;
            for(const sh of cand){
              const f=frac(sh);
              if(f<=f0+1e-9) continue;                     // a shift must strictly improve the fit
              const c=Math.abs(med+sh-center);
              if(f>bf+1e-9
                 || (best!==0 && Math.abs(f-bf)<=1e-9
                     && (Math.abs(sh)<Math.abs(best) || (Math.abs(sh)===Math.abs(best)&&c<bc))))
                { best=sh; bf=f; bc=c; }
            }
          }
        }
        if(best){ for(const e of evs) e.pch=pchAdd(e.pch,best); regHome[slot]=best; }
        // 2. per-note ornament fold (bass cell tones; harm/echo pipe copies)
        let inW=0; for(const e of evs){ const md=pchToMidi(e.pch); if(md>=lo&&md<=hi) inW++; }
        if(inW/evs.length<REGISTER_FIT) for(const e of evs){
          if(slot!=="bass"&&!e.harm&&!e.echo) continue;    // melody/pad LINE notes stay the law's business
          let md=pchToMidi(e.pch), sh=0;
          while(md+sh>hi && md+sh-12>=lo) sh-=12;
          while(md+sh<lo && md+sh+12<=hi) sh+=12;
          if(sh) e.pch=pchAdd(e.pch,sh);
        }
      }
    }
    // ---------- SNARE-LAW (kernel default: no bar repeats thrice) ----------
    // Paul's mandate: "snare patterns repeat ad nauseum ... nothing should repeat
    // exactly the same more than twice." A kernel-wide DEFAULT over every genre's
    // drum fabric — not an opt-in dimension. Runs DEAD LAST (after sampleEvents
    // AND the rubato warp) on its OWN isolated stream (seed+5150): it consumes no
    // other stream's draws, so a bar the law never touches renders exactly as
    // before and a bar it DOES vary moves only its own snare/hat content — fully
    // deterministic per seed.
    //
    // THE HASH — per bar, per lane, a compact signature of PERCEIVED rhythm: each
    // onset quantized to the 1/16 grid (round·2/2, which absorbs the humanize
    // jitter applyGroove already stamped) paired with a 3-level accent bucket
    // (ghost/mid/accent), plus the open flag for hats. Micro amp jitter never
    // moves the signature; a real ghost/drop/accent/displacement always does.
    // When a bar's signature equals the previous TWO (the third identical bar),
    // the law forces a variation, recomputes the signature and re-checks — so the
    // forced bar can never itself start a fresh three-peat. Fills and the
    // transform pass have already reshaped THEIR bars (different signature) => the
    // repeat chain breaks there for free; the law never double-fires on them.
    //
    // FEEL-AWARE — a machineness M reads the bar's kit family and the genre's
    // humanize/swing anchors. Tight machine genres vary with MACHINE moves (hit
    // drop, accent migration, on-grid ½-note sync shift, syncopation substitute —
    // all offgrid-neutral, so techno's grid stays a grid); loose human genres vary
    // with HUMAN moves (ghost notes, drags/ruffs, ±1/16 drunk displacement). Each
    // fired bar then gets MANIPULATION flavor on top: per-hit decay jitter (a
    // noise snare's decay reads as filtering — tighter vs ringier) and, on
    // delay-capable genres, a ping-pong THROW on one hit so some snares ring out
    // wet and some stay dry (the "filtered, delayed" ask). Snares carry no per-hit
    // tune/cutoff param and the drum voices are NOT rebuilt, so decay+pp are the
    // honest levers. The same no-thrice machine rides the hat lane for near-free
    // (gentler vocabulary — open / drop — since hats repeat just as hard).
    {
      const MACHINE_KIT={four:1,techno:1,house:1,electro:1,trap:1,pulse:1,kick:1,full:1,open:1};
      const srng=mulberry32(((state.seed??1)+5150)>>>0);
      const hz=state.humanize||0, sw=state.swing||0;
      const Idr=(state.instruments&&state.instruments.drums)||{};
      const delayCap=(state.snarePP||0)>0 || (Idr.dsend||0)>0;
      const cl=(x,a,b)=>x<a?a:x>b?b:x;
      // measure at the KIT-CELL size, not the chord bar: the ad-nauseum repeat
      // lives at the 8-beat measure (CHORD_BEATS). A chordEvery>8 genre (mallsoft
      // 16, ambient 32) tiles the same 8-beat cell across the bar, so its snares
      // repeat every measure even though the chord holds — measure THAT.
      const BARLEN=Math.min(CBEATS,CHORD_BEATS);
      const q=(o)=>Math.round(o*2)/2, bk=(a)=>a<0.14?0:a<0.34?1:2;
      const inBar=(b,b0)=>b>=b0-1e-6 && b<b0+BARLEN-1e-6;
      const snSig=(l,b0)=>l.map(d=>q(d.beat-b0)+":"+bk(d.amp)).sort().join("|");
      const haSig=(l,b0)=>l.map(d=>q(d.beat-b0)+":"+bk(d.amp)+(d.open?"o":"")).sort().join("|");
      const loudest=(l)=>l.reduce((m,d)=>(!m||d.amp>m.amp)?d:m,null);
      const addD=[], dropD=new Set();
      // snare variation — every branch is guaranteed to move the signature.
      function vSnare(list,b0,M){
        let work=list.slice(); const rel=(d)=>d.beat-b0; const before=snSig(list,b0);
        if(srng()<M){                                        // MACHINE moves
          const pick=Math.floor(srng()*4);
          if(pick===0 && work.length){                       // hit DROP (the every-8th snare skip)
            const d=loudest(work); dropD.add(d); work=work.filter(x=>x!==d);
          } else if(pick===1 && work.length>=2){             // accent MIGRATION
            const lo=loudest(work), oth=work.filter(x=>x!==lo), up=oth[Math.floor(srng()*oth.length)];
            lo.amp=Math.max(0.06,lo.amp*0.38); up.amp=Math.min(0.95,Math.max(0.4,up.amp*1.9));
          } else if(pick===2 && work.length){                // on-grid ½-note SYNC shift (offgrid-neutral)
            const d=work[Math.floor(srng()*work.length)], dir=srng()<0.5?-0.5:0.5;
            d.beat=inBar(d.beat+dir,b0)?d.beat+dir:d.beat-dir;
          } else if(work.length){                            // syncopation SUBSTITUTE — push the whole lane late
            for(const d of work){ const nb=d.beat+0.5; if(inBar(nb,b0)) d.beat=nb; }
          }
        } else {                                             // HUMAN moves
          const pick=Math.floor(srng()*4);
          if(pick===0){                                      // GHOST-note insertion
            const slots=[1.5,3.5,5.5,7.5,3.75,7.25].filter(o=>o<BARLEN && !work.some(d=>Math.abs(rel(d)-o)<0.2));
            if(slots.length){ const g={drum:"snare",beat:rubW(b0+slots[Math.floor(srng()*slots.length)]),dur:0.16,amp:0.08+srng()*0.05};
              addD.push(g); work.push(g); }
            else if(work.length){ const d=loudest(work); dropD.add(d); work=work.filter(x=>x!==d); }
          } else if(pick===1 && work.length){                // DRAG / ruff — two low pre-hits into a backbeat
            const bbs=work.filter(d=>rel(d)>=1), bb=bbs[0]||loudest(work);
            for(const off of [0.25,0.125]){ const nb=bb.beat-off; if(nb>=b0){
              const g={drum:"snare",beat:nb,dur:0.12,amp:Math.min(bb.amp*0.5,0.14)}; addD.push(g); work.push(g); } }
          } else if(pick===2 && work.length){                // ±1/16 drunk DISPLACEMENT (human offgrid)
            const d=work[Math.floor(srng()*work.length)], dir=srng()<0.5?-0.25:0.25;
            d.beat=inBar(d.beat+dir,b0)?d.beat+dir:d.beat-dir;
          } else if(work.length>=2){                         // accent migration (shared)
            const lo=loudest(work), oth=work.filter(x=>x!==lo), up=oth[Math.floor(srng()*oth.length)];
            lo.amp=Math.max(0.06,lo.amp*0.4); up.amp=Math.min(0.9,Math.max(0.36,up.amp*1.8));
          } else if(work.length){                            // singleton: quieten it + add an answering ghost
            const d=work[0]; d.amp=Math.max(0.08,d.amp*0.6);
            const g={drum:"snare",beat:rubW(b0+((rel(d)+2)%BARLEN)),dur:0.14,amp:0.1}; addD.push(g); work.push(g);
          }
        }
        work=work.filter(d=>!dropD.has(d));
        // GUARANTEE the signature moved — some picks can round back to the same
        // 1/16 bucket (a -1/16 nudge off an integer beat), which would let the
        // three-peat survive. A +½-note shift always crosses a q-bucket.
        if(snSig(work,b0)===before){
          if(work.length){ const d=work[0];
            if(inBar(d.beat+0.5,b0)) d.beat+=0.5; else { dropD.add(d); work=work.filter(x=>x!==d); } }
          else { const g={drum:"snare",beat:rubW(b0+BARLEN/2),dur:0.16,amp:0.11}; addD.push(g); work.push(g); }
        }
        for(const d of work) d.dur=cl((d.dur||0.3)*(0.7+srng()*0.7),0.06,0.6);   // decay jitter = filtering read
        if(delayCap && work.length){ const d=work[Math.floor(srng()*work.length)];
          d.pp=Math.max(d.pp||0, +(0.5+srng()*0.4).toFixed(3)); }                 // delay throw = the wet ring
        return work;
      }
      // hat variation — gentle; open is feature-neutral, drop barely moves density.
      function vHat(list,b0){
        let work=list.slice(); const before=haSig(list,b0);
        if(srng()<2/3 && work.length){                       // OPEN one closed hat
          const clh=work.filter(d=>!d.open);
          if(clh.length){ const d=clh[Math.floor(srng()*clh.length)]; d.open=true; d.dur=Math.max(d.dur||0.1,0.3); }
          else { const d=work[Math.floor(srng()*work.length)]; dropD.add(d); }
        } else if(work.length){ const d=work[Math.floor(srng()*work.length)]; dropD.add(d); }  // DROP one hat
        work=work.filter(d=>!dropD.has(d));
        if(haSig(work,b0)===before && work.length){ const d=work[0]; dropD.add(d); work=work.filter(x=>x!==d); }
        return work;
      }
      // ONE global rolling window across the whole timeline (mandate is
      // kernel-wide — a new section restating the old groove for a third bar is
      // still a three-peat); it resets only on an empty bar (a real silence gap).
      let s1=null,s2=null,h1=null,h2=null;
      for(const sp of spans){
        const nbars=Math.max(1,Math.round(sp.beats/BARLEN));
        let M=MACHINE_KIT[sp.kit]?0.78:0.28;
        M=cl(M-Math.min(0.45,hz/0.12*0.22+sw/0.35*0.22),0.05,0.95);
        // ENGINE-AUDIT 2026-07 Tier 3: the per-bar double full-array filter was
        // O(bars x drums) — 40-53% of buildEvents. Bucket THIS span's snares/
        // hats in ONE O(drums) pass instead: same inBar predicate (tried on the
        // float-neighbor bar indices, so membership is decided by the exact
        // original test), drums-array order preserved, dropD applied at
        // consumption time. Buckets are rebuilt per span, so an overhang bar's
        // events (round() lets a span's last bar spill past sp.beats) are
        // re-read AFTER the previous span's mutations — exactly the old
        // per-bar rescan semantics. Beat mutations inside vSnare/vHat are
        // in-bar by construction, so bucket membership never goes stale.
        const snB=new Array(nbars), haB=new Array(nbars);
        for(let bi=0;bi<nbars;bi++){ snB[bi]=[]; haB[bi]=[]; }
        for(const d of drums){
          const lane=d.drum==="snare"?snB:d.drum==="hat"?haB:null;
          if(!lane) continue;
          const g=Math.floor((d.beat-sp.start)/BARLEN);
          for(let c=g-1;c<=g+1;c++)
            if(c>=0&&c<nbars&&inBar(d.beat,sp.start+c*BARLEN)){ lane[c].push(d); break; }
        }
        for(let bi=0;bi<nbars;bi++){
          const b0=sp.start+bi*BARLEN;
          const sn=snB[bi].filter(d=>!dropD.has(d));
          const ha=haB[bi].filter(d=>!dropD.has(d));
          let sSig=sn.length?snSig(sn,b0):null, hSig=ha.length?haSig(ha,b0):null;
          if(sSig!=null && sSig===s1 && s1===s2) sSig=snSig(vSnare(sn,b0,M),b0);
          if(hSig!=null && hSig===h1 && h1===h2) hSig=haSig(vHat(ha,b0),b0);
          if(sSig!=null){ s2=s1; s1=sSig; } else { s1=s2=null; }   // empty bar breaks the chain
          if(hSig!=null){ h2=h1; h1=hSig; } else { h1=h2=null; }
        }
      }
      if(addD.length) for(const d of addD) drums.push(d);
      if(dropD.size)  drums=drums.filter(d=>!dropD.has(d));
    }
    // MUSICAL DYNAMICS runs DEAD LAST, after the snare-law: the law dedups on the
    // COMPOSED accent pattern (its no-three-peat guarantee is about rhythm, not
    // loudness), and running dynamics first would shift its variation choices and
    // drift the verifier's drum features (validate's 2-seed dominance tipped on
    // sludgemetal). So the envelope is applied last; it stashes each drum's
    // pre-envelope amp as amp0 so the invariants prove re-check buckets on the
    // composed accent, not the faded loudness (a fade already varies the bars, so
    // pattern-identical bars under it are not ad-nauseam).
    applyVoiceDynamics(pitched, drums, state, spans, CBEATS);
    if(!foundOK) found=[];   // FOUND-AT-90%: drop the found layer in blends below the 90% threshold
    return { bpm:state.bpm, totalBeats, pitched, drums, found, sfx, srcById,
      ...(Object.keys(regHome).length?{regHome}:{}) };   // register-home decision (absent when no slot shifted — bundle shape unchanged)
  }

  // ---------- solo voices (deterministic per-section recipes) ----------
  // (The csound orchestra/codegen that used to live here — waveRHS through
  //  buildCsd/liveParts — is preserved on branch legacy-csound. The Faust
  //  engine consumes buildEvents + these solo-voice assignments directly.)
  // Per-section solo voices: any section with a `solo` recipe gets its own melody
  // instrument (instr 7,8,…) so different "dinosaurs" / a fuzz guitar can each take
  // a section. Deterministic from state.sections so codegen + score routing agree.
  function soloVoices(state, baseMel){
    const out=[], seen=new Map(); let num=7;
    baseMel = baseMel || (state.instruments&&state.instruments.melody) || defaultInstruments().melody;
    for(const s of (state.sections||[])){
      for(const recipe of [s.solo, s.counter&&s.counter.solo]){   // solo voices + countermelody voices
        if(!recipe) continue;
        const key=JSON.stringify(recipe);
        if(seen.has(key)) continue;
        seen.set(key,num);
        out.push({ key, num, recipe:Object.assign({}, baseMel, recipe) });
        num++;
      }
    }
    // the transition micro-lick soloist (state.lickVoice): a first-class solo
    // voice so every engine allocates it exactly like section solos. The
    // recipe should carry explicit model/sampler/dx7 keys — it merges over
    // the melody recipe, which may itself be a dx7/sampler voice.
    if(state.lickVoice){
      const key=JSON.stringify(state.lickVoice);
      if(!seen.has(key)) out.push({ key, num:num++, recipe:Object.assign({}, baseMel, state.lickVoice) });
    }
    return out;
  }
  const api={ buildEvents, defaultState, defaultInstruments, voicing, soloVoices, euclidBeats,
    KITS,   // pulse-set kit lanes (KERNEL-V4 Phase 1): kits are data; drumEvents is the one interpreter
    sectionTag,   // form-graph typed-node classifier (Phase 5)
    PROGRESSIONS, getProgression, WAVES, BASS_PATTERNS, MELODY_PATTERNS, DRUM_PATTERNS, TRANSITIONS,
    PERC_PATTERNS, PERC_VOICES, PERC_NOTE,
    isModel, SOURCE_CLASS, sourceClassOf, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);

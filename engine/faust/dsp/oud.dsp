// oud — THE FRETLESS COURSE, ON A DEEP WOODEN BOX, STRUCK WITH A QUILL.
//
// WHY THIS FILE EXISTS. scratch/genre-qa/AUDIT-2026-09.md finding 14: eleven
// rows — `qiyan`, `abbasid`, `andalusi`, `zajal`, `muwashshah`, `troubadour`,
// `nuba`, `pavane`, `modinha`, `lundu`, `pipaqu` — name an oud, a lute, a
// vihuela or a pipa and play `nylon_string_guitar`, because the library has
// none of them. That is a LIBRARY gap and it cannot be closed by sampling:
// every soundfont in this tree is GM bank 0, 128 presets, measured, and GM's
// nearest plucked lutes are the sitar (104), the shamisen (106) and the koto
// (107) — none of them closer to an oud than a nylon guitar is. The audit's
// decision was to NAME the gap rather than approximate it. Paul, on being
// shown it: "Do the Faust oud it's just a little code." So: a model, on the
// erhu's precedent, for the erhu's reason.
//
// EVERY STRUCTURAL FACT BELOW IS THE ZIM's (Wikipedia "Oud",
// wikipedia_en_all_maxi_2026-02, read from the local kiwix copy — the only
// evidence the offline law admits), and where a number is CHOSEN rather than
// read it says so and is a slider rather than a buried literal:
//
//   * "a Middle Eastern short-neck lute-type, pear-shaped, FRETLESS stringed
//     instrument … usually with 11 strings grouped in SIX COURSES". Two facts,
//     and they are the two this file is built on. Fretless means pitch is
//     continuous and a slide between notes is the ordinary articulation rather
//     than an ornament — so `glide` DEFAULTS NON-ZERO here where stk_guitar
//     defaults to 0, which is the single largest behavioural difference
//     between this module and the guitar it replaces. Courses mean every note
//     is TWO strings, and that is where the shimmer comes from.
//   * "Many current Arab players use this tuning: C2 F2 A2 D3 G3 C4". Six
//     courses in fourths; C2 is MIDI 36 and it is the floor — nothing exists
//     below the lowest course to be stopped, exactly as erhu.dsp's floor is
//     its own open D4. (11 strings over 6 courses is five doubled pairs and
//     one single: the bottom course is the single one. `course` below is
//     therefore the DEFAULT and a recipe can set it to 0 for a bass note.)
//   * "Arabian ouds have a SCALE LENGTH of between 61 cm and 62 cm in
//     comparison to the 58.5 cm scale length for Turkish", against a classical
//     guitar's 65. A shorter string at the same pitch is a SLACKER string.
//   * "Historically, oud strings were made of stretched and tightly wound
//     animal GUT, whereas modern strings are made with silk, NYLON, copper
//     and/or silver bound wire." Not steel. The damping filter's tilt is set
//     accordingly (`bright` below), under the nylon guitar's, never over it.
//   * "The instrument is played by plucking … with a RISHA, which means
//     feather in Arabic, that was traditionally made from an EAGLES FEATHER.
//     Although today, the risha is most commonly made from PLASTIC, and less
//     often from tortoise shell or filed down animal bone." A hard, thin
//     quill — not a fingertip. That is the `risha` slider and it is the reason
//     this instrument is BRIGHTER IN THE ATTACK than a fingerpicked nylon top
//     while being DARKER IN THE BODY.
//   * "Arabian ouds are normally larger … producing a FULLER, DEEPER sound,
//     whereas the sound of the Turkish oud is more TAUT AND SHRILL … Turkish
//     ouds tend to be more LIGHTLY CONSTRUCTED … higher pitched and have a
//     'brighter timbre'." That is one axis, and it is the `body` slider: where
//     the box's own air resonance sits. Arabian is low, Turkish is high.
//   * And the box is DEEP, on the article's own quoted geometry (the Ikhwan
//     al-Safa proportions): speaking length 30 fingers, "its width: fifteen
//     fingers", "its depth seven and a half fingers" — width = ½ the string
//     length, depth = ¼. A classical guitar is ~37 cm wide and ~10 cm deep on
//     a 65 cm scale: 0.57 and 0.154. So the oud's box is over HALF AGAIN as
//     deep in proportion to its string, which is why a shorter instrument
//     sounds lower: a bigger air volume behind the same soundhole is a lower
//     Helmholtz resonance.
//   * "the wooden SOUNDBOARD that distinguishes it from similar instruments
//     with SKIN-FACED bodies". So this is NOT erhu.dsp: there is no membrane
//     here and no Bessel series. The radiator is a wooden plate, and a plate's
//     low modes are what the resonators below are.
//
// THE STRING IS stk_guitar's, VERBATIM, AND THAT IS THE POINT. The extended
// Karplus-Strong out of the FAUST Synthesis ToolKit (NLFeks.dsp, Julius Smith
// and Romain Michon, STK-4.3 licence), with the dynamic-level filter this repo
// put back — measured in tune to 0.0 cents at 82, 165, 330 and 659 Hz, because
// its loop delay is an integer plus a LINEAR-PHASE FIR you can write down.
// stk_guitar's header argues all of that and none of it is re-argued here.
// What is NOT taken is the second half of that file: the magnetic pickup, the
// preamp and the speaker cabinet. instruments.js already carries the law —
// "a nylon top through a higain stage is an electric with a costume" — and an
// oud is the most acoustic instrument in this catalogue. There is no amp in
// this module and there is no insert on its recipe.
//
// WHAT IS DIFFERENT FROM stk_guitar, then, in one list:
//   1. TWO STRINGS, one plectrum (the course). ±`course`/2 cents, and the
//      risha reaches the second string ~0.7 ms after the first because it
//      sweeps ACROSS the pair. The two are driven by the SAME noise burst,
//      which is what one plectrum stroke physically is; the offset is what
//      keeps them from being one string at twice the gain.
//   2. `glide` DEFAULTS TO 90 ms, AND IT IS AN ARRIVAL TIME. Fretless — and
//      the number is the hand's, derived from the article's own scale
//      length. See the slider, and see `THE SLIDE, RE-ARGUED` below.
//   3. THE RISHA IS NOT THE ARM. On stk_guitar the pick-angle lowpass is
//      `0.88*(1 - pick)`, so a soft note is a round fingertip displacement.
//      A risha is a piece of plastic and its geometry does not soften when the
//      player plays quietly: what changes is how far the string is pulled, not
//      the shape of the thing pulling it. So the angle pole is set by `risha`
//      and only weakly by `pick`, AND `risha` raises the floor of the EKS
//      dynamic-level filter (the excitation's level at Nyquist) while narrowing
//      its span — a quill is bright at every dynamic and its timbral range
//      across velocity is smaller than a finger's, because the finger changes
//      shape with force and the plastic does not.
//   4. NO AMP, and a BODY instead: three resonators on a wooden plate over an
//      air volume, plus the direct radiation past it.
//   5. A DARKER STRING (`bright` 0.10 against the nylon recipe's 0.24) and a
//      SHORTER RING (2.8 s against 3.2): gut and nylon on a slack short scale
//      lose their top faster than a guitar's longer, tenser string. `bright`
//      damps the SUSTAIN and not the attack (the burst enters before the loop
//      has run once), which is what lets this instrument be dark and sharp at
//      the same time — measured, the body-window spectral centroid sits under
//      the shipped nylon chair's at MIDI 36/48/60 while the first 23 ms carry
//      8x the energy above 3 kHz that the same module with `risha` at 0 does.
//
// WHAT IS CHOSEN AND CANNOT BE READ ANYWHERE, said out loud because a physical
// model is exactly the kind of file that can pass for measured while being
// fitted by ear: the body's three frequencies and their Qs and gains, the
// direct/body balance, the risha's default hardness, and the course's default
// detuning in cents. There is no oud recording in this tree and the ZIM
// article has no acoustics section. Every one of them is a slider or a named
// constant, and test/oud.test.js measures the CONSEQUENCES — intonation, the
// centroid against the nylon guitar, the beat rate of the course, the bend —
// rather than the constants, because the consequences are what an ear hears.
//
// THE SLIDE, RE-ARGUED (2026-09-07). Paul, listening to the shipped module:
// *"The oud has a very 'laser beam' sound when it bends tones and I think
// maybe it's taking the note bends too slow? Or it's missing the scratch
// sound of a proper player."* Three hypotheses were measured before anything
// here moved — the interval a slide is asked to cross, the slide's own
// SHAPE and TIME, and whether the string is quiet while the hand travels —
// and ALL THREE WERE TRUE. The numbers, off this module and off the nine
// catalogue rows that seat it (test/oud.test.js O4a-O4d holds every one):
//
//   1. THE SLIDE WAS CROSSING INTERVALS NO HAND CROSSES. Measured over
//      `qiyan abbasid andalusi zajal muwashshah nuba troubadour pavane
//      taqsim` at seeds 1-3, on the notes AS THE PARENT FOLDS THEM into this
//      instrument's compass: 2,370 consecutive moves, of which 300 (12.7%)
//      are WIDER THAN A FOURTH and the widest is FOURTEEN SEMITONES. Every
//      one of them was slid, because — the second half of the same
//      measurement — **not one note in those 27 renders is marked `sld`**.
//      The `sld` gesture this file's own comment called "the engine's longer
//      slide, written on top" has never once fired on an oud row. What Paul
//      is hearing is 100% the ALWAYS-ON base, on every note, including a
//      re-plucked minor tenth. A synthesiser sweeping fourteen semitones is
//      the definition of a laser beam. The fence is a rule about a HAND and
//      it lives where the engine decides (state-engine.js mapEvents, and see
//      `THE HAND'S REACH` there), not here: this file cannot see the note
//      before.
//   2. THE SLIDE WAS FIVE TIMES SLOWER THAN THE NUMBER ON IT, and Paul's
//      "too slow" is literally right. `si.smooth(ba.tau2pole(glide))` makes
//      `glide` a TIME CONSTANT, not a travel time: one tau is 63% of the
//      way. Measured on the shipped wasm, a re-plucked octave with
//      `glide` 0.045 read -530 cents 5 ms in, -111 c at 70 ms, -59 c at
//      100 ms and did not come inside 20 cents until 150 ms; a fifth DOWN
//      took 200 ms. The file said "45 ms is a legato hand" and shipped a
//      quarter-second droop.
//   3. THE STRING WAS NOT QUIET DURING THE BEND — it was the LOUDEST thing
//      in the note. On a real instrument the pluck happens and THEN the hand
//      travels, so a slide is a dying string. Here every note is
//      re-articulated (there is no legato path to this module: press.js
//      groups legato only for `mono` units and this one is pooled), so the
//      quill strikes AT THE START of the sweep. Measured on the octave
//      above: 0-45 ms -34.8 dB, 135-400 ms -44.3 dB — the sweep carries
//      9.5 dB MORE than the note it arrives at. That half is NOT fixed by a
//      gain, because loud IS what a re-plucked slide is; it is fixed by
//      making the sweep short (2) and by making it sound like a finger (4).
//   4. AND THERE WAS NO NOISE IN IT AT ALL, which is Paul's second
//      hypothesis and the reason the artefact reads as a synthesiser rather
//      than as a hand. Nothing in the shipped module was a function of
//      d(pitch)/dt. `scratch` below is.
//
// WHAT THE OLD GATE MISSED, said out loud because it passed 9/9 the whole
// time Paul was hearing this. test/oud.test.js O4 rendered ONE note, held
// the gate, moved `freq` a FOURTH mid-note, and asserted the pitch was
// between the two and rising. Three things it never asked: whether the bend
// ARRIVES (there is no upper bound on the travel in it — a bend still 100
// cents flat at 120 ms passes), what happens at intervals the catalogue
// actually plays (it tested five semitones; the rows play fourteen), and
// whether the note is RE-PLUCKED (it tested a legato bend, and this engine
// never writes one). It measured the only case that does not occur.
declare name "oud";
declare author "Julius Smith and Romain Michon (string); stellate (course, risha, body)";
declare licence "STK-4.3"; // Synthesis ToolKit 4.3, MIT-style — see NOTICE
declare reference "https://ccrma.stanford.edu/~jos/pasp/vegf.html";
import("stdfaust.lib");
// instruments.lib IS NOT IMPORTED, for stk_guitar's reason: it declares
// `levelfilter` and re-imports the deprecated filter.lib, which declares it
// too, so a file that imports it cannot NAME the one function this module
// needs. The filter is written out below from Smith's own derivation.

freq   = hslider("freq", 220, 30, 1200, 0.01);
gate   = button("gate");
// glide: SECONDS FOR THE HAND TO ARRIVE. A waveguide's pitch IS its delay
// length, so this is a real portamento — the string bends, it does not
// crossfade. THE DEFAULT IS NOT ZERO AND THAT IS THE INSTRUMENT: there are no
// frets to arrive at, so a player's finger travels to the next note through
// every pitch between.
//
// IT IS AN ARRIVAL TIME AND NOT A TIME CONSTANT, which is the whole of
// finding 2 in the header. `si.smooth(ba.tau2pole(t))` is 63% of the way
// there after `t` and still 5% short after three of them, so the shipped
// 0.045 was a quarter-second droop wearing a 45 ms label. `sfreq` below
// divides, and the divisor is derived rather than tuned — see it.
//
// AND 0.09 IS THE TIME TO CROSS THE HAND'S REACH, off the article's own
// geometry rather than off an ear. The ZIM gives the Arabian scale length as
// 61 cm. A fourth up from a stopped note moves the stopping point by
// L(1 - 1/2^(5/12)) = 0.251 x 61 cm = 15.3 cm, and 15.3 cm at a musical
// hand's ~1.7 m/s is 90 ms. That is the number, and the ENGINE scales it by
// how far the note actually travels (state-engine mapEvents `THE HAND'S
// REACH`: a whole tone is 36 ms of it, a semitone 18, and anything past the
// reach is not a slide at all but a shift of position, which is a re-pluck).
// A recipe that writes its own — the `lute`, whose gut frets are glide 0 —
// still gets exactly what it asks for.
glide  = hslider("glide", 0.09, 0, 0.5, 0.001);
// scratch: THE SOUND OF THE FINGER ITSELF, 0 silent, 1 a dry hand on a wound
// string. This is Paul's "scratch sound of a proper player" and it is the one
// thing in this module that exists ONLY WHILE THE PITCH IS MOVING: its
// amplitude is d(pitch)/dt and nothing else, so a sustained note is sample-
// identical to the module without it and a fretted `lute` note — which
// arrives in one sample — gets a burst shorter than a millisecond, buried
// inside the quill's own attack. The default is MEASURED and not
// chosen: at 0.45, across the travel of a fourth, the share of the note's
// energy above 2 kHz goes from 5.7% to 13.0% and its RMS rises 1.49 dB —
// texture, not hiss — while the SETTLED note moves 0.00 dB. test/oud.test.js
// O4c holds all three; the sweep that chose it is beside `rasp` below.
scratch = hslider("scratch", 0.45, 0, 1, 0.01);
pick   = hslider("pick", 0.5, 0, 1, 0.01);        // how hard the string is pulled (velocity)
// risha: THE PLECTRUM ITSELF, 0 a fingertip, 1 a filed quill. This is a fact
// about the object in the hand, not about the arm — see note 3 above. The
// default is the article's own modern instrument: plastic, hard.
risha  = hslider("risha", 0.80, 0, 1, 0.01);
// where the risha lands, as a fraction of the string from the nearer end. An
// oud is struck between the soundhole and the bridge — nearer the bridge than
// a classical guitarist's hand — so the default sits well under the nylon
// recipe's 0.36. NOT 0.12, which was the first draft and is MEASURABLY WRONG:
// the feedforward comb one pluck-position down the string has |H(f)| =
// 2|sin(pi f d)|, so at d = 0.12P the fundamental sits 8.7 dB under the comb's
// own peak and the loudest partial of a C4 came out as the THIRD (measured:
// 0.9% of the note's energy inside a semitone of 261 Hz, against the nylon
// guitar's 10.1%). That is the exact shape of the "plinky" this repo caught in
// gtr_amp and it is not what an oud sounds like. 0.18 puts the comb's peak at
// the third partial instead of the fourth and the fundamental 5.4 dB under it.
pluckPos = hslider("pluckPos", 0.18, 0.02, 0.5, 0.01);
// course: the pair's detuning in CENTS, total (each string sits half of it off
// the written pitch). Courses are tuned in unison BY EAR and no ear is exact;
// what is left over is the beating that a doubled string is heard as. 0 is a
// single string, which is what the bottom course actually is (11 strings over
// six courses), so a bass line can ask for one.
course = hslider("course", 8, 0, 30, 0.1);
// ring: the string's own -60 dB time in SECONDS, which is what a T60 is. Gut
// and nylon on a short slack scale, so under the nylon guitar's 3.2.
ring   = hslider("ring", 2.8, 0.05, 12, 0.01);
bright = hslider("bright", 0.10, 0, 1, 0.01);     // the damping filter's tilt
// body: WHERE THE BOX SITS — the air (Helmholtz) resonance in Hz, and the
// plate modes ride on it at fixed ratios. The article's own axis: an Arabian
// oud is large, deep and "fuller, deeper"; a Turkish one is "more lightly
// constructed", "higher pitched", "brighter timbre". 100 Hz is the Arabian
// default and it is CHOSEN — see the header. For scale, this tree's own guitar
// body (lead_kpluck.dsp, ported from the csound engine) sits at 118 Hz.
body   = hslider("body", 100, 60, 260, 1);
// cutoff: the soundboard's own top. A wooden plate radiates nothing useful
// above a few kHz, and this is the knob a genre's `cut` reaches (the `M.cab`
// idiom), so it is named the way every other module names it.
cutoff = hslider("cutoff", 4200, 200, 14000, 1) : si.smoo;
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.3, 0, 2, 0.01);
release = hslider("release", 0.22, 0.02, 2, 0.005);
// mute: THE PALM, per note, 0..1 — stk_guitar's parameter, kept because the
// gesture is real on this instrument too (an oud player damps with the heel of
// the striking hand between phrases) and because keeping the name means the
// fleet's per-note `mute` door works unchanged. At 0 every multiply below is
// by exactly 1.0, sample-identical to the module without the knob.
mute   = hslider("mute", 0, 0, 1, 0.01);
ringEff    = ring*(1.0 - 0.94*mute);
brightEff  = bright*(1.0 - 0.5*mute);
cutoffEff  = cutoff*(1.0 - 0.55*mute);
releaseEff = max(0.03, release*(1.0 - 0.8*mute));

// ---- the string (faust-stk NLFeks, as stk_guitar carries it) --------------
// THE HAND TRAVELS AS A SECOND-ORDER MOVE, not a first-order one, and the
// reason is findings 2 and 4 together. A single pole starts at its MAXIMUM
// speed and decays away from it — a chirp with a tail, which is the literal
// shape of "laser beam" — while a critically damped PAIR starts at zero
// speed, peaks in the middle and stops, which is what an arm does. It also
// gives the scratch below something honest to be proportional to: a finger
// that accelerates and decelerates rather than one that teleports and coasts.
// Measured on the rendered wasm, an octave leap's peak pitch speed falls from
// 23 to 11 octaves a second across this one change.
// AND THE DIVISOR IS DERIVED, not fitted: the pair is inside 5 cents of a
// 500-cent travel — the reach, the widest interval the engine will ask of it —
// after 6.0 tau, so tau = glide/6 makes `glide` the moment the note ARRIVES,
// in tune to under the ~6-cent JND. At glide 0 the pair is two 17-microsecond
// poles and the note snaps, which is the `lute`.
glidePole = ba.tau2pole(max(glide, 0.0001)/6.0);
sfreq = freq : si.smooth(glidePole) : si.smooth(glidePole);
Pmax  = 4096;
// the WRITTEN pitch's period, used for the excitation burst and the squelch —
// both are one-per-note facts and both belong to the note, not to which string
// of the course is being fed.
P     = ma.SR/max(30.0, sfreq);
// and the two strings' own periods. `course` is the total spread in CENTS and
// the written pitch is the pair's CENTRE — string 0 sits half of it flat and
// string 1 half of it sharp — which is what tuning a course in unison by ear
// leaves behind. (The first draft wrote `s*course/2400`, putting the pair at 0
// and +8 cents, and the whole instrument measured 2.1 cents sharp. Intonation
// is the first thing test/oud.test.js checks and it caught it; the note stays
// because "the detuning is centred" is exactly the kind of fact that looks
// obviously true and was not.)
det(s) = pow(2.0, (2.0*s - 1.0)*course/2400.0);
Pd(s)  = ma.SR/max(30.0, sfreq*det(s));

noiseburst(g, n) = no.noise : *(g : trigger(n))
  with {
    diffgtz(x) = (x - x') > 0;
    decay(m, x) = x - (x > 0)/m;
    release(m) = + ~ decay(m);
    trigger(m) = diffgtz : release(m) : > (0.0);
  };

// THE RISHA'S ANGLE. si.smooth's pole is the plectrum's shape: a slow, round
// displacement is a low corner and a sharp release is a high one. On
// stk_guitar this is `0.88*(1 - pick)` — the fingertip that softens when you
// play quietly. A risha does not soften: it is plastic, and playing quietly
// pulls the string LESS FAR without changing the geometry of the thing pulling
// it. So `risha` sets it and `pick` only leans on it (a very soft stroke does
// let the quill roll off the string a little more slowly). At the default
// risha 0.8 the pole runs 0.124 down to 0.081 across the whole velocity range,
// against the guitar's 0.88 down to 0.0 — always sharp, which is the attack
// this instrument is known for.
pickPole = 0.62*(1.0 - risha)*(1.0 - 0.35*pick);
// DYNAMIC LEVEL, in dB at Nyquist — the EKS's own "how hard", and the place
// where the risha does most of its work. Smith's parameter is literally "the
// level wanted at Nyquist", which is to say HOW MUCH TOP THE EXCITATION HAS,
// and a hard quill puts more of it there for the same displacement than a
// fingertip does. So `risha` raises the FLOOR of the span and narrows it, and
// both halves are the physics:
//   the floor rises  — a plectrum's quietest stroke is still a hard, fast
//                      release, so it is still bright;
//   the span narrows — a fingertip changes SHAPE with force (the pad flattens,
//                      the nail engages) and a piece of plastic does not, so a
//                      plectrum's timbral range across velocity is genuinely
//                      smaller than a finger's. Velocity still moves the
//                      spectrum (16.8 dB at the default risha, measured as a
//                      centroid swing in test/oud.test.js), it just moves it
//                      less than on a fingerpicked string, which is what
//                      everyone who has played both reports.
// At risha = 0 this is stk_guitar's line character for character, so a recipe
// that asks for a fingertip gets exactly the guitar's excitation.
L = ba.db2linear(-42.0 + 24.0*risha + pick*(36.0 - 24.0*risha));
pickComb = fi.ffcombfilter(Pmax, pluckPos*P, -1);

// THE DYNAMIC LEVEL LOWPASS, from Smith's derivation (ccrma.stanford.edu/
// realsimple/faust_strings/Dynamic_Level_Lowpass_Filter.html, and
// instruments.lib `levelfilter`): a crossfade between the raw excitation and a
// one-pole lowpass cornered at the note's own fundamental, weighted by the
// level wanted at Nyquist.
levelfilter(lin, f0, x) = (lin*pow(lin, 1.0/3.0)*x) + ((1.0 - lin) * lp2out(x))
  with {
    Lw     = ma.PI*f0/ma.SR;
    Lgain  = Lw / (1.0 + Lw);
    Lpole2 = (1.0 - Lw) / (1.0 + Lw);
    lp2out = *(Lgain) : + ~ *(Lpole2);
  };

excitation = noiseburst(gate, P) : si.smooth(pickPole) : pickComb
           : levelfilter(L, max(30.0, sfreq));
// ONE PLECTRUM, TWO STRINGS. The risha sweeps ACROSS the course, so the second
// string of a pair is struck a fraction of a millisecond after the first — and
// it is struck by the same piece of plastic, so it gets the SAME burst rather
// than an independent one. That is the difference between a course and a
// chorus pedal: correlated excitation, two lengths. 0.7 ms is CHOSEN (a risha
// crossing two strings a few millimetres apart at playing speed) and it is
// small enough that the pair still reads as one attack.
sweep = 0.0007*ma.SR;
exc(0) = excitation;
exc(1) = excitation : de.fdelay(1024, sweep);

// the loop's -60 dB time, per string, at that string's own pitch.
rho(s) = pow(0.001, 1.0/(max(30.0, sfreq*det(s))*max(0.05, ringEff)));
// LINEAR-PHASE FIR3 damping — delay exactly one sample at every frequency,
// which is why this string needs no fitted pitch correction.
h0 = (1.0 + brightEff)/2.0;
h1 = (1.0 - brightEff)/4.0;
loopfilter(s, x) = rho(s) * (h0*x' + h1*(x + x''));

// A PLECTRUM TOUCHES THE STRING BEFORE IT SOUNDS IT — stk_guitar's squelch,
// kept for its reason: a pool voice stolen for a new pitch otherwise plays the
// OLD note bending to the new one, a gliss nobody wrote. Gate rise ONLY, never
// a freq edge, because on THIS instrument the freq edge is the articulation.
squelch(g, n) = g : diffgtz : release(n) : > (0.0)
  with {
    diffgtz(x) = (x - x') > 0;
    decay(m, x) = x - (x > 0)/m;
    release(m) = + ~ decay(m);
  };
damp = 1.0 - 0.88*squelch(gate, P);

// ---- THE FINGER ITSELF (2026-09-07, finding 4) ----------------------------
// A hand travelling on a wound gut or nylon string makes NOISE, and no
// waveguide has any unless somebody puts it there. It is the thing that makes
// a bend read as a player rather than as an oscillator, and it is the reason
// the artefact Paul heard appears ONLY on bends: every other cue this module
// has is the same whether the pitch is moving or not.
//
// THE AMPLITUDE IS THE SPEED OF THE HAND AND NOTHING ELSE. `travel` is
// d(pitch)/dt off the SMOOTHED pitch — the thing that actually moves — in
// octaves a second. A note that has arrived has travel exactly 0, so a
// sustained note is sample-identical to this module without the feature, and
// a `lute` note (glide 0, two 17-us poles) gets a burst under a millisecond
// long that lands inside the quill's own attack transient. That is the whole
// of the gate: there is no envelope here and no note logic, because a finger
// makes noise exactly while it is moving.
HAND   = 4.63;      // octaves a second: the reach (a fourth) in the derived 90 ms
// …AND A JUMP IS NOT A HAND, which is a fence on `glide` and not on the speed.
// At glide 0 the pitch arrives in two samples, so d(pitch)/dt there is ~10,000
// octaves a second: an ungated rasp put a tick at full note level on the front
// of EVERY fretted `lute` note (measured: worst sample 2.8e-2 against a 2.0e-2
// RMS note). A SPEED fence does not close it — the two-pole decay walks back
// down THROUGH any speed you name, so a jump passes the gate at full
// amplitude on its way to nothing. The honest fence is the one the caller
// already states: below 5 ms there is no travel for a finger to make noise on,
// because a 5 ms slide is a re-articulation. This is also how a note the
// engine has FENCED (a leap past the hand's reach, written as glide 0 — see
// state-engine mapEvents) arrives silent as well as in tune: one law, both
// halves.
NOHAND = 0.005;
// …and the speed is taken WITHOUT a logarithm, because d(log2 f)/dt has a
// closed form — (df/dt)/(f ln2) — so one divide says exactly what a `ma.log2`
// per sample says, and the log costs about a third of the module. Measured,
// best of fifteen interleaved runs on one machine (10 s of audio each): the
// `ma.log2` draft 350 ms, this line 261, and the module BEFORE this whole
// round 271. Same number, same fence, and the finger is free.
LN2    = 0.6931472;
travel = abs(sfreq - sfreq')*ma.SR/(max(30.0, sfreq)*LN2);
hand   = min(1.0, travel/HAND)*(glide > NOHAND);
// AND THE COLOUR IS THE WINDING, which is the one number here that is read
// rather than chosen. Near the playing position on the article's 61 cm scale
// the stopping point moves ~0.30 m per OCTAVE of pitch, and the turns of a
// wound string sit ~0.4 mm apart, so the winding passes under the finger at
// travel*0.30/0.0004 = travel*750 Hz. A slow hand (1 oct/s) rasps at 750 Hz
// and a full one at 3.5 kHz — which is why a fast slide squeaks and a slow
// one growls, and why this is a CROSSFADE between two fixed bands rather than
// one band with a swept centre: the two ends are the arithmetic's own, and a
// signal-rate `resonbp` would spend a tangent per sample to say the same
// thing. Q 1.1 is chosen and it is broad on purpose — a finger is not a
// resonator.
RASP_LO = 750.0;
RASP_HI = 3470.0;
rasp = no.noise <: fi.resonbp(RASP_LO, 1.1, 1)*(1.0 - hand),
                   fi.resonbp(RASP_HI, 1.1, 1)*hand
     :> *(scratch*hand);
// …AND IT ENTERS THE BOX, NOT THE STRING, which is not where the first draft
// put it and the difference is measured rather than argued. Summing the rasp
// into the waveguide's input is the obvious move — the noise is made on the
// string, so feed it to the string — and it is wrong twice. Physically the
// finger sits AT a termination of the speaking length, so it couples into the
// sounding string weakly and radiates mostly from the neck, from the dead
// length behind it and straight off the soundboard. Measurably, a waveguide
// with a 2.8 s T60 STORES whatever you put into it: at `scratch` 1 the string
// injection left the note 7.41 dB LOUDER 300 ms after the hand had stopped
// than the same note with the feature off — a slide that makes its own
// arrival louder, which is a second artefact in the shape of the first.
// Through the box the settled note measures 0.00 dB and 0.02% above 2 kHz
// either way: the scratch exists while the hand moves and not one sample
// longer. `process` at the foot of the file is where it is summed in.
str(s) = exc(s) : (+ : de.fdelay4(Pmax, Pd(s) - 2)) ~ (loopfilter(s) : *(damp));
// the pair, each half the gain so a course is not simply twice as loud as a
// single string. `course` at 0 makes det(0) == det(1) == 1 and the two become
// one string struck twice 0.7 ms apart, which is what a single course with a
// sweeping plectrum is.
pair = (str(0) + str(1))*0.5;

// ---- the box --------------------------------------------------------------
// A WOODEN PLATE OVER AN AIR VOLUME, not a membrane (the article: "the wooden
// soundboard that distinguishes it from similar instruments with skin-faced
// bodies"), so there is no Bessel series here and erhu.dsp's body is the wrong
// model on purpose.
//
// `body` is the air (Helmholtz) mode. The two plate modes ride on it at fixed
// ratios, and the ratios are THIS TREE'S OWN GUITAR BODY rather than an
// invention: lead_kpluck.dsp — the csound engine's body, ported — puts its two
// resonators at 118 and 230 Hz, a ratio of 1.95, and 3.1 is the next plate
// mode in the same family. What this file moves is not the ratios but WHERE
// THE PAIR SITS: a guitar's air mode is around 118 and the oud's box is over
// half again as deep in proportion to its string (the Ikhwan geometry in the
// header), and a bigger volume behind the same hole is a LOWER resonance. So
// the default is 100 and the Turkish end of the slider is up where the article
// puts it ("more lightly constructed … higher pitched … brighter timbre").
//
// The Qs fall with the mode number because a plate's higher modes are more
// heavily damped than the air's, and the gains fall with it for the same
// reason. All six are CHOSEN, and the header says so.
boxed = _ <: *(0.34),
        fi.resonbp(body,      2.4, 1)*0.62,
        fi.resonbp(body*1.95, 1.7, 1)*0.34,
        fi.resonbp(body*3.10, 1.2, 1)*0.20
      :> fi.lowpass(3, max(300.0, min(cutoffEff, 14000.0)));
// …and 0.34 of the string goes straight past the box. A soundboard is not a
// filter in series with the string: some of what you hear is the string
// itself, radiating, and a body with no direct path is a body playing a
// recording of a string down a pipe.

// note-off is A HAND ON THE STRINGS, not a switch.
env = en.asr(0.001, 1, releaseEff, gate);

// ONE TRIM, AND IT IS THE VELOCITY TRIM, not a level fit. The EKS excitation's
// own energy moves with `pick` on top of whatever the note's own amp is doing,
// and left alone that double-counting makes every soft note vanish.
// stk_guitar takes it back out downstream of its shaper for exactly this
// reason; the CURVE is refitted here rather than borrowed, because there is no
// preamp in front of this one and the risha narrows the dynamic-level span
// that produces the swing in the first place. MEASURED on this module at MIDI
// 48, seven values of `pick` from 0.12 to 1.0: the untrimmed energy moves
// 2.70:1 (against the guitar's 5.5:1 through its shaper), and least squares on
// `a + b*(1 - pick^2)` against a target that rises 2.4e-3 to 3.0e-3 RMS gives
// 0.601 and 0.781 with a worst residual of 0.20 dB. That target is not flat on
// purpose — a hard stroke stays about 1.7 dB louder after the trim, because a
// hard stroke IS louder — and it is where the shipped nylon chair sits
// (2.55e-3 to 2.98e-3 across the same span at the same pitch), so seating the
// oud on the eleven rows that were playing that chair is a change of
// instrument and not also a change of level. The swing is within 5% at
// risha 0, 0.4 and 1.0, so one curve covers the whole plectrum range.
// The instrument's level against the rest of the FLEET is not this number's
// job — that is audio/to-engine.js PAGE_TRIM, measured on the page.
makeup = 0.601 + 0.781*(1.0 - pick*pick);
// `rasp` joins the string HERE and not inside it — see THE FINGER ITSELF, and
// the 7.41 dB that decided it.
process = (pair + rasp) : boxed : *(gain*1.45) : *(env*level*2.0*makeup) : fi.dcblocker;

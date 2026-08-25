// compose.js — the ARRANGER. One button, one whole song.
//
// Kept out of the UI tier for the same reason genres.js is kept out of
// kernel.js: this is a POLICY, and the UI should not have opinions. It is pure —
// (genre, rnd) in, a song object out, no DOM and no audio — so the node gate can
// compose a thousand songs and check every one, which is the only way to know
// that a generator that runs once per click is not producing rubbish nine times
// in ten. Loads after genres.js, fields.js and song.js — it is written in
// their vocabulary — and before presets.js and the UI (see kernel-daw.html).
//
// WHAT IT EMITS is exactly the shape Save writes and Load reads, so it goes
// through applyState — the same validate-and-apply path as a file off somebody's
// desktop. The composer gets no privileged entrance. If it ever emits a song the
// loader would reject, the loader rejects it, and that is the correct outcome
// rather than a special case.
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const NG = isNode ? require("./genres.js") : root.NuGenres;
  const NF = isNode ? require("./fields.js") : root.NuFields;
  const NS = isNode ? require("./song.js") : root.NuSong;
  const { GENRES } = NG;

  // ---- SECTION ROLES -------------------------------------------------------
  // A role is a NAME, not a transform: setting a box to "chorus" does not
  // reach in and change the drums. That would be a nasty surprise — you would
  // relabel a section and lose the mix you had built on it. What the role does
  // is tell the composer what to BUILD, and tell you what you are looking at
  // afterwards. The table itself lives in fields.js with the rest of the
  // vocabulary; re-exported here so the composer's API did not move.
  const { ROLES } = NF;
  // The first three are the LAYERS OF AN INTRO, and they are separate names
  // rather than three sections all called "intro" for the same reason the roles
  // exist at all: a row of identically labelled boxes is a row of unlabelled
  // boxes. "drums · groove · intro · verse" is the arrangement, written down.
  const BEDS = { drums: 1, bass: 1, groove: 1 };

  // ---- THE PLANS -----------------------------------------------------------
  // Three shapes, because there are three kinds of thing in the genre table and
  // they do not arrange the same way. A song has verses and choruses; a dance
  // record has builds and drops and does not have a bridge; a piece of choral
  // counterpoint has neither and is a single arc with one climax.
  const PLANS = {
    // the PRECHORUS is the lift a radio song has and a loop does not — the
    // section whose whole job is to make the chorus an arrival. The dance plan
    // gets the same gesture under its own name: a BUILD before each drop run.
    song:  ["intro", "verse", "prechorus", "chorus", "verse", "prechorus", "chorus",
            "bridge", "solo", "chorus", "outro"],
    dance: ["intro", "verse", "build", "drop", "breakdown", "verse", "build",
            "drop", "drop", "outro"],
    arc:   ["intro", "verse", "verse", "bridge", "chorus", "solo", "verse", "outro"],
  };
  // The loader's role vocabulary lives in fields.js and this phase does not
  // touch the UI tier, so the two new plan words are STORED under their
  // nearest legal role and remembered in `cue` — a key the loader carries
  // through untouched. When the registry learns the words (the UX phase),
  // the alias comes out and nothing else moves.
  const ALIAS = { prechorus: "verse", build: "breakdown" };

  // ---- THE ARC -------------------------------------------------------------
  // One intensity curve over the whole plan, replacing per-role constants.
  // Per-role sizing is why every chorus in a song was the same size and the
  // last one indistinguishable from the first: a role cannot know where it
  // is. The LAST chorus (or drop) is the peak — 1.0 — and the peak is where
  // the composer spends the lift: level forward, a forced extra layer, and
  // sometimes the truck-driver key change.
  //
  // ...AND THE CURVE HAS A MEMORY, which is the fix for the second measured
  // complaint of this round: "today intensity is a lookup on the role —
  // verse=soft, chorus=big, every time". A role constant plus one peak bit is
  // still a lookup; it gave every verse in a song the same number and every
  // chorus but the last the same number, so a song's two verses were the same
  // size and its first two choruses were interchangeable. Three terms now, and
  // each is a thing a band actually does:
  //
  //   BASE   the role's own weight — a chorus is bigger than a verse.
  //   RAMP   +0.10 over the length of the record: the band walks in. The
  //          second half of a song is louder than the first in nearly every
  //          record ever made, and nothing here knew that.
  //   AGAIN  +0.07 each time a role comes round again (capped at two): the
  //          second verse is bigger than the first because there is more of
  //          the band on it, and the third chorus is the one you sing along to.
  //
  // The BRIDGE is the exception and takes no `again` bump: it is the place a
  // record goes quiet, so its base sits UNDER the verses (0.36 against 0.50)
  // and it stays there however late it falls.
  //
  // STEADY is the opt-out, and it is a decision rather than a shrug: two
  // anchors in the table are one idea held for the length of a record, and an
  // arranged crescendo over a drone is an arrangement happening to music that
  // asked for none. Those get the bare role constants — same role, same number,
  // deliberately flat — and the gate reads that back as a live exemption
  // rather than an untested branch.
  const STEADY = { drone: 1, ambient: 1 };
  function arcOf(words, steady) {
    const n = words.length;
    const peak = Math.max(words.lastIndexOf("chorus"), words.lastIndexOf("drop"));
    const V = { intro: 0.3, verse: 0.5, prechorus: 0.62, build: 0.58, chorus: 0.82,
                drop: 0.85, breakdown: 0.3, bridge: 0.36, solo: 0.7, outro: 0.25 };
    const seen = {};
    return words.map((w, i) => {
      const k = (seen[w] = (seen[w] || 0) + 1) - 1;
      if (i === peak) return 1;
      const base = V[w] == null ? 0.5 : V[w];
      if (steady) return base;
      const ramp = 0.1 * (i / Math.max(1, n - 1));
      const again = w === "bridge" ? 0 : 0.07 * Math.min(2, k);
      return Math.max(0.15, Math.min(0.97, base + ramp + again));
    });
  }
  // HOW MANY TIMES THIS ROLE HAS ALREADY BEEN, per position — the same count
  // the arc uses, exported to build() so a role can vary its OWN gesture on the
  // way round (the second prechorus does not fade in again; it pushes).
  const ordinals = words => {
    const seen = {};
    return words.map(w => (seen[w] = (seen[w] || 0) + 1) - 1);
  };
  // ...and the arc is what SIZE means. The curve above already knew that a
  // bridge is smaller than a chorus, and then spent that knowledge on exactly
  // one bit — `peak` — so every other section came out at the same dynamic and
  // the record had no shape between its fade-in and its fade-out. This turns
  // the whole curve into the box's `env`, which is the field that already means
  // "level over the section" (kernel.js SHAPES for why it is that field and not
  // a new one).
  //
  // It reads the NEXT section as well as this one, because a dynamic is
  // relative: a section pointed at something bigger crescendos into it, and one
  // coming down off the peak diminuendos away. That is the difference between a
  // song with an arrangement and a playlist of loops at the same level.
  //
  // Only where build() left `env` alone: the intro's fade up, the prechorus's
  // fade in and the outro's fade out are GESTURES the roles own, and a cold
  // open's flatness is the point of a cold open.
  // ORDER MATTERS, and the first line is why: a chorus is big because it is a
  // chorus, not because of what follows it. Testing "am I coming down?" first
  // put a diminuendo on every chorus in the table — the arrival fading away
  // from itself — because a verse does follow it.
  //
  // A section that is merely smaller gets `soft` and not a curve, on purpose:
  // the breathing INSIDE a quiet verse is the performance layer's job (the
  // genre's stress/phrase/touch), and the section's job is to be smaller than
  // the chorus. Two curves fighting over the same notes is how you get a mix
  // where nothing is anywhere.
  const dynOf = a => {
    if (!a || a.x == null) return null;
    const x = a.x, nx = a.next == null ? x : a.next;
    if (x >= 0.86) return "big";                              // the arrival sits up
    if (nx - x >= 0.15) return x <= 0.45 ? "cresc" : "lift";  // pointed at something bigger
    if (x - nx >= 0.25) return "dim";                         // coming down off it
    if (x <= 0.55) return "soft";                             // and the small parts are small
    return "arch";                                            // everything else breathes
  };
  // ---- ...AND NO TWO OF A KIND ARE THE SAME SIZE ---------------------------
  // The arc has resolution now, but `dynOf` is a step function over six words:
  // three choruses at 0.85 / 0.95 / 1.00 all land on "big", which is the
  // template complaint back in a smaller box. So the last pass over a composed
  // song walks each ROLE GROUP and forces the members apart.
  //
  // The ladder is ordered by the MEAN of the curve each word compiles to
  // (kernel.js SHAPES): soft 0.68, then the three that average 0.81 — dim
  // (coming down), cresc (arriving over) and lift (waiting, then climbing) —
  // then arch 0.885 and big 1.14. Ordering it that way is what makes the fix
  // musical rather than cosmetic: the group is walked from the LAST member
  // BACKWARDS, so the latest one keeps what it was dealt and the earlier ones
  // step DOWN to the first free rung. Three choruses come out lift → arch →
  // big, which is monotone, and the last chorus stays the loudest thing on the
  // record by construction rather than by luck.
  //
  // Values that are not on the ladder are left alone on purpose: `in` / `out`
  // are the FADES a role owns (an intro arrives, an outro leaves) and `drop` is
  // a STOP (a hole, not a size). Repeats of those are handled where they are
  // written — the second prechorus is dealt "lift" instead of a second "in",
  // and a stop kind is never placed twice in one record.
  //
  // (`dim` and `cresc` are the SAME size — 0.81 either way — and are adjacent
  // rungs on purpose: they are one loudness travelled in opposite directions,
  // which is a real distinction between two sections and no distinction at all
  // in average level. The ladder is non-decreasing rather than strictly
  // increasing for exactly that pair.)
  const DYNLADDER = ["soft", "dim", "cresc", "lift", "arch", "big"];
  // WHAT A SECTION IS CALLED, for the three passes that reason about position.
  // Not `cue || role`, which is what everything else in this file reads: the
  // head intro's `cue` carries its intro KIND (solo, quote, cold…) and a solo
  // break's carries "solobreak", so a raw cue read made the opening bar of a
  // bulgarian record look like a solo section and put a drum break on a box
  // whose whole job is to open the song. Only two cues NAME A PLAN ROLE, and
  // they are the two the ALIAS table stores under a different one.
  const PLANCUE = { prechorus: 1, build: 1 };
  const sectionWord = b => (PLANCUE[b.cue] ? b.cue : b.role);
  function spreadDynamics(song) {
    const by = {};
    for (const b of song) {
      if (BEDS[b.role]) continue;                 // a bed is a layer, not a section
      const k = sectionWord(b);
      (by[k] = by[k] || []).push(b);
    }
    for (const group of Object.values(by)) {
      if (group.length < 2) continue;
      const taken = new Set();
      for (let i = group.length - 1; i >= 0; i--) {
        const b = group[i], at = DYNLADDER.indexOf(b.env);
        if (!taken.has(b.env) || at < 0) { taken.add(b.env); continue; }
        let j = at - 1;
        while (j >= 0 && taken.has(DYNLADDER[j])) j--;
        if (j < 0) { j = at + 1; while (j < DYNLADDER.length && taken.has(DYNLADDER[j])) j++; }
        if (j < DYNLADDER.length) b.env = DYNLADDER[j];
        taken.add(b.env);
      }
    }
  }
  // ---- WHERE THE PLAN AND TEMPO TABLES WENT --------------------------------
  // Two 110-row genre-keyed tables lived here — PLAN_OF (dance|song|arc) and
  // BPM (70..160) — and both moved ONTO THE ANCHORS on 2026-08-20: every
  // GENRES row in genres.js now carries `plan:` and `bpm:` beside its label,
  // and each row's research note ("144 is medium-up bebop") moved with it. A
  // keyed table a file away from the genre it describes is how a new anchor
  // ships without a tempo; a field beside the label is one a reviewer cannot
  // miss, and compose() below throws BY NAME on a genre that lacks either.
  //
  // The framing the tables carried, kept here because it is the POLICY and
  // not any one row's note:
  //   - The split is one rule applied three times: a record that BUILDS and
  //     DROPS is a dance (the floor genres do not bridge), a record with a
  //     verse and a chorus is a song, and a record that is one shape end to
  //     end is an arc. Everything else was written to be sung twice — a
  //     synth is a fact about the instrument, never about the form.
  //   - Seven of the eight ancestors are songs, which is most of what an
  //     ancestor turns out to be: they wrote singles, whatever their
  //     children did with them. Electro is the one floor record; minimalism
  //     is the arc whose process actually goes somewhere.
  //   - The FUNCTION genres arrange as arcs, every one of them: a part on
  //     its own has no verse and no chorus — there is nothing for it to be
  //     the chorus OF — so what is left is one shape with a peak.
  //   - Tempo: the dial bottoms at 70 and tops at 160, and a composer that
  //     leaves everything at 126 has not arranged anything — half of what
  //     "sounds like sludge" means is the tempo. The genres at the ends
  //     (dnb, punk, darkrnb, spacerock, grebo) sit ON the fence rather than
  //     past it. One 2026-08-17 note did not survive the move because it
  //     matches no row: "148 is Joy Division's own rush, the same number
  //     skiffle already sits at" — postpunk's row is 138, and the only 148
  //     in that batch is grebo's. Recorded here rather than invented onto an
  //     anchor it does not describe.
  //
  // WHAT REMAINS BELOW is the derived view plus the PROMOTION SEAM. lab.js
  // (combineBpm) and the gates read compose's PLAN_OF/BPM exports by key, so
  // both are rebuilt from the anchors — the anchors are the source of truth;
  // these are views, never a place to write a genre's own row. And
  // promote-genre.js (the daw-first tool) splices a promoted genre's rows
  // above the two landmark comments, so each view keeps an override literal
  // whose last line IS the landmark: a promoted anchor lands in genres.js
  // without the fields, and its plan and tempo land here, winning by
  // Object.assign order. The BPM landmark keeps its sixteen-space indent —
  // the splicer anchors on the exact text, indent included.
  const PLAN_OF = {};
  for (const k of Object.keys(GENRES)) PLAN_OF[k] = GENRES[k].plan;
  Object.assign(PLAN_OF, {
    // PROMOTED PLANS GO ABOVE THIS LINE — a landmark for promote-genre.js,
    // which has to write a plan for every genre it promotes and can only
    // anchor on text that is already here. A landmark cannot stop being the
    // end of the thing it marks.
  });
  const BPM = {};
  for (const k of Object.keys(GENRES)) BPM[k] = GENRES[k].bpm;
  Object.assign(BPM, {
                // PROMOTED TEMPOS GO ABOVE THIS LINE — the same landmark
                // PLAN_OF carries, for the same reason.
              });

  // ---- HOW LONG A SECTION IS -----------------------------------------------
  // MEASURED, and backwards: a section was `G.bars` — the genre's own FORM
  // length, the length of the loop it repeats — so the Beatles anchor (bars 8)
  // arranged into 8-bar sections while citypop (bars 4) got 4-bar ones and dub
  // got 4. That is exactly the wrong way round. A form length is how long the
  // pattern takes to come back; a SECTION length is how long you stay in it,
  // and the two are different questions. Groove music needs the longer answer —
  // sixteen bars is where a one-drop or a house record starts to sit in the
  // pocket, and four bars of it is a transition — while the pop song is the one
  // that can afford to move: eight bars of verse and on to the lift.
  //
  // So the target is per FAMILY, in bar-equivalents at rate 1, and it is
  // rounded to a whole number of the genre's own form so a section never stops
  // the pattern half way through (blues is 12 and stays 12; a fugue gets two
  // statements of a four-bar subject, not one and a half).
  //
  // AND IT IS SCALED BY `rate`, which is the part a bar count alone cannot say:
  // a half-time bar lasts twice as long in seconds, so vaporwave's four bars
  // and rock's eight are the same amount of time. Without the scale, drone
  // (rate 0.25) would have been handed sixteen bars — sixty-four normal bars of
  // one chord.
  const SECTION_BARS = { club: 16, groove: 16, soul: 8, band: 8, studio: 8,
                         roots: 8, vox: 8, drift: 8, parts: 8, kernel: 8 };
  const fullLen = G => {
    const want = (SECTION_BARS[G.family] || 8) * G.rate;
    return Math.max(G.bars, Math.round(want / G.bars) * G.bars);
  };
  // the roles that are HALF a section by design — an intro, a lift, a
  // breakdown and an outro are approaches to a section rather than sections
  const halfLen = G => Math.max(2, Math.floor(fullLen(G) / 2));

  // ---- BREAKING THE CLOCK --------------------------------------------------
  // "Every Beatles chorus is 8 bars, every prechorus 4, every verse 8 — the
  // form reads as a template." It did, because the length was a pure function
  // of the genre and the role, so every section of a given kind was the same
  // size in every song at every seed. Real records break their own arithmetic,
  // and they break it in four particular places rather than at random:
  //
  //   early  −1 on the lift that points at a chorus. The chorus arrives a bar
  //          before you counted it — the seven-bar prechorus. This is the one
  //          irregularity a listener actually notices, so it gets the highest
  //          probability of the four.
  //   short  −2 on a LATER verse. The band has said this part already and cuts
  //          to the chorus; a first verse is never truncated, because there is
  //          nothing yet to be impatient with.
  //   turn   +2 on a chorus or solo that hands back to a verse — the
  //          turnaround, the two bars the band vamps while the singer finds
  //          the next line.
  //   long   +4 on the peak. The last chorus repeats and runs out, which is
  //          how most records in this vocabulary end.
  //
  // WHO MAY: the genres a BAND PLAYS A SONG on. The exclusions are not a
  // shrug — each is a family whose arithmetic is load-bearing. A club record is
  // mixed by somebody else and a seven-bar phrase makes it unmixable; a fugue's
  // section length IS the subject; a groove is the thing you are supposed to
  // stop counting, and a bar dropped out of a one-drop reads as a mistake
  // rather than a gesture; a lone part has nothing to be irregular AGAINST.
  // "A fugue keeps its arithmetic; a pop song does not."
  //
  // MEASURED at the fences the gate defends: 16% of the non-bed sections of a
  // breakable genre come out irregular, which is one or two a record — an
  // event, not a tic — and 0% of the square ones.
  const SQUARE = { club: 1, groove: 1, vox: 1, drift: 1, parts: 1 };
  const BENDS = { early: -1, short: -2, turn: 2, long: 4 };

  // ---- the random source ---------------------------------------------------
  // Seeded, so a seed is a song. mulberry32 — small, well-distributed, and the
  // point is reproducibility rather than cryptography.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, xs) => xs[Math.floor(r() * xs.length) % xs.length];
  const chance = (r, p) => r() < p;

  // ---- PHRASES -------------------------------------------------------------
  // NOT random. A phrase of sixteen independent random degrees is noise, and
  // noise is what the existing Random button makes — useful for finding out what
  // an operator does, useless as material. A tune is a WALK: mostly steps, the
  // occasional leap, and a leap answered by a step back the other way, which is
  // the one rule of melodic writing that survives every style. Everything below
  // is that walk with different parameters.
  const z = () => new Array(16).fill(0);
  // the one blank-phrase constructor lives in song.js — this used to be a
  // second copy of the same literal, which is how shapes drift
  const blank = NS.blank;

  // RHYTHM comes first and separately, because rhythm is what makes a phrase
  // recognizable — you can re-pitch a hook completely and still know it. Built
  // from the strong beats outwards, so a phrase always lands on 1.
  function rhythm(r, density, offbeat) {
    const g = z();
    g[0] = 1;
    const strong = [0, 4, 8, 12], weak = [2, 6, 10, 14], off = [1, 3, 5, 7, 9, 11, 13, 15];
    for (const i of strong) if (chance(r, 0.72 + density * 0.25)) g[i] = 1;
    for (const i of weak) if (chance(r, 0.28 + density * 0.5)) g[i] = 1;
    for (const i of off) if (chance(r, (offbeat ? 0.3 : 0.08) + density * 0.35)) g[i] = 1;
    // THE FORCED BREATH. A sung topline is defined by where it stops, and a
    // probabilistic gate never reliably stopped: the bar ends in silence (the
    // singer takes air before the next phrase) and there is one hole mid-bar.
    // With the kernel's maxHold cap the hole is real silence in the OUTPUT,
    // not just a zero in the vector.
    g[pick(r, [6, 7])] = 0;
    g[14] = 0; g[15] = 0;
    g[0] = 1;
    return g;
  }

  function walk(r, gate, span, start) {
    // a contour over the GATED steps only — a rest still carries a degree, but
    // the shape people hear is the shape of the notes
    const deg = z();
    let d = start, dir = chance(r, 0.5) ? 1 : -1, lastLeap = 0;
    for (let i = 0; i < 16; i++) {
      if (!gate[i]) { deg[i] = d; continue; }
      if (lastLeap) { d -= Math.sign(lastLeap); lastLeap = 0; }      // answer the leap
      else if (chance(r, 0.16)) { const L = dir * (2 + Math.floor(r() * 2)); d += L; lastLeap = L; }
      else if (chance(r, 0.72)) d += dir;
      if (d > start + span) { d = start + span; dir = -1; }
      else if (d < start - span) { d = start - span; dir = 1; }
      else if (chance(r, 0.22)) dir = -dir;
      deg[i] = d;
    }
    return deg;
  }

  // The five kinds of material a song is made of. They are different phrases,
  // not one phrase with different operators on it — the operators are the box's
  // job, and a song whose every part is a transform of one cell is a study.
  // `head` is the DEVELOPMENT hook, and it is optional: pass the first half of
  // an already-written topline and this phrase opens with it note for note and
  // then goes somewhere else. Absent — every existing caller — the function is
  // byte-identical to what it was, which is why the two independent phrase
  // gates below still measure the thing they were written for.
  function phrase(r, kind, head) {
    const p = blank();
    const D = { hook: 0.5, answer: 0.5, riff: 0.25, counter: 0.55,
                pad: 0.05, topline: 0.55, sparse: 0.0, climb: 0.7 }[kind];
    p.gate = rhythm(r, D, kind === "counter" || kind === "topline");
    if (kind === "pad") { p.gate = z(); p.gate[0] = 1; if (chance(r, 0.5)) p.gate[8] = 1; }
    if (kind === "sparse") { p.gate = z(); p.gate[0] = 1; p.gate[pick(r, [6, 8, 10, 12])] = 1; }
    // the TOPLINE is capped at a singable span — an octave and a bit in a
    // seven-note alphabet is what a voice actually covers
    const span = kind === "riff" ? 3 : kind === "pad" ? 2 : kind === "climb" ? 6
      : kind === "topline" ? 4 : 5;
    p.deg = walk(r, p.gate, span, kind === "riff" ? -1 : 0);
    for (let i = 0; i < 16; i++) {
      // OCTAVE LEAPS ARE PUNCTUATION. Scattering them makes a phrase sound
      // like a broken sequencer; one or two, on gated steps, is a gesture.
      p.oct[i] = p.gate[i] && chance(r, 0.055) ? (chance(r, 0.7) ? 1 : -1) : 0;
      // accents on the strong beats, which is where they mean something
      p.acc[i] = p.gate[i] && (i % 4 === 0 ? chance(r, 0.75) : chance(r, 0.12)) ? 1 : 0;
      p.sld[i] = p.gate[i] && !p.acc[i] && chance(r, 0.14) ? 1 : 0;
      p.vel[i] = p.acc[i] ? 8 + Math.floor(r() * 2)
        : i % 4 === 0 ? 6 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
    }
    // THE CLIMB is the one phrase that carries a ramp, and it carries exactly
    // one — a ramp on every step is a phrase that leaves the instrument.
    if (kind === "climb") {
      const at = [0, 4, 8].filter(i => p.gate[i]);
      if (at.length) p.inc[pick(r, at)] = chance(r, 0.7) ? 1 : -1;
      if (chance(r, 0.4)) p.stk[0] = 1;
    }
    // THE MOTIF. A hook is a repeated cell, and the walk could only produce
    // one by accident — sixteen independent decisions never come back. The
    // hook kinds are laid out A A B A': one four-step cell, restated, answered
    // by its own transposition, and brought home. The second quarter restates
    // the first EXACTLY (gate, degree and octave), which is what "the motif
    // returns" means in the rendered stream, not just in the vector.
    if (kind === "hook" || kind === "topline") {
      let d = 0;
      const cell = [0];
      for (let i = 1; i < 4; i++) {
        d = Math.max(-2, Math.min(3, d + pick(r, [-1, 1, 1])));
        cell.push(d);
      }
      const shiftB = pick(r, [1, -1, 2]);
      for (let i = 0; i < 16; i++)
        p.deg[i] = i < 8 ? cell[i % 4] : i < 12 ? cell[i % 4] + shiftB : cell[i % 4];
      // a sung line stays in one octave — the leap punctuation belongs to the
      // instrumental kinds, and the climax below must be the phrase's one peak
      for (let i = 0; i < 16; i++) p.oct[i] = 0;
      // THE DEVELOPMENT. "The same topline, developing" — so the verse's line
      // is not a second tune and not a transform of the first, it is the
      // chorus's own opening (its A A, eight steps of gate, degree, accent,
      // velocity and slide) followed by a different answer: its own B, its own
      // way home, its own climax. Written HERE, before the restatement and the
      // breath and the peak, so every law those enforce is enforced on the
      // developed phrase too rather than being stamped over afterwards.
      if (head) for (const k of ["gate", "deg", "oct", "acc", "vel", "sld"])
        for (let i = 0; i < 8; i++) p[k][i] = head[k][i];
      // the restatement restates the DYNAMICS too: same gates, same accents,
      // same velocities — that is what makes it the motif returning rather
      // than the same pitches happening again
      for (let i = 0; i < 4; i++) {
        p.gate[4 + i] = p.gate[i]; p.acc[4 + i] = p.acc[i]; p.vel[4 + i] = p.vel[i];
      }
      p.gate[14] = 0; p.gate[15] = 0;              // the breath survives the copy
      // A' comes home: the last gated step of the final quarter lands on the
      // tonic degree — a chord tone under every harmony this table writes
      const home = [13, 12].find(i => p.gate[i]);
      if (home != null) p.deg[home] = 0;
      // THE CLIMAX: exactly one note is both the highest and the loudest —
      // the note the chorus exists for. Raised over everything, velocity 9,
      // everyone else capped at 8 so it is unique in the output by construction.
      // If the dice left the second half empty, a peak is forced onto beat 3:
      // a hook without a high point is not a hook, so this is not optional.
      let cand = [8, 9, 10, 11, 12, 13].filter(i => p.gate[i]);
      if (!cand.length) { p.gate[8] = 1; cand = [8]; }
      let i0 = cand[0];
      for (const i of cand) if (p.deg[i] > p.deg[i0]) i0 = i;
      p.deg[i0] = Math.max(...p.deg) + 2;
      for (let i = 0; i < 16; i++) p.vel[i] = Math.min(8, p.vel[i]);
      p.vel[i0] = 9;
    }
    p.gate[0] = 1;
    return p;
  }

  // ---- the arrangement -----------------------------------------------------
  // One function per role, each answering the same question — what is different
  // about this section — and each allowed to say "nothing much", which is what
  // makes a verse a verse.
  //
  // The box literal itself comes from song.js — one skeleton, not two copies —
  // and only the composer's own opinion is added on top: a genre carrying `fx`
  // seeds the chain (sludge played clean is not sludge), and every box opens
  // in the SONG'S KEY (S.tonic, set once in compose() below) — a section only
  // departs from it where build() below decides that IS the gesture.
  const skeleton = (role, G, gk, S) =>
    Object.assign(NS.skeleton(gk, role), { fx: G.fx ? [...G.fx] : [], key: S.tonic });

  // ---- HOW A SONG STARTS ---------------------------------------------------
  // There are more ways to open a record than a drum hit, and for a while this
  // table did not know any of them: seven of its nine shapes were drum-led and
  // the other two got a count-in or a downbeat stamped on anyway, so every
  // composed song in every genre opened on percussion. The vocabulary now
  // matches the world's: the layered BEDS (drums, then bass, then the tune —
  // an ARRANGEMENT, one section per layer, which is why it could never be an
  // `intro` edge on one box) sit beside the kernel's one-bar edge kinds —
  // padin, bassin, riser, cold, stabs, fade, solo, swell, count, hit, kit.
  //
  // WHO CHOOSES: the genre's FAMILY (genres.js stamps `family` on every
  // anchor). Each family carries a weighted ballot — nine votes, repetition is
  // the weight — leaning where the tradition leans: the choral and drift
  // genres open on a pad or a lone line, the club genres on a riser or a cold
  // drop-in, the bands just start playing, soul walks in on the bass, the
  // groove genres count off or skank first. No family is a constant: two seeds
  // of one genre should often begin differently.
  //
  // ...AND ONE OF THEM PLAYS THE TUNE. "The intro never quotes anything: it
  // picks a texture and never plays the tune. The classic pop intro is the
  // chorus hook stated instrumentally — Day Tripper, A Hard Day's Night." That
  // is `quote`, and it is a kind of MATERIAL rather than a kind of gesture,
  // which is why nothing in the old eleven could express it: every one of them
  // was an answer to "how does the sound arrive", and none to "what does it
  // play". It goes on the ballots of the families that write songs with
  // choruses, and stays off the three that cannot mean it — a choir does not
  // state its own chorus on an instrument first, a drift record has no hook to
  // quote, and a lone part has no chorus to quote FROM.
  const INTRO_LEAN = {
    kernel: ["cold", "count", "solo", "padin", "fade", "hit", "stabs", "swell", "quote"],
    vox:    ["solo", "solo", "padin", "padin", "fade", "fade", "swell", "stabs", "cold"],
    drift:  ["padin", "padin", "padin", "fade", "fade", "solo", "swell", "stabs", "cold"],
    club:   ["riser", "riser", "riser", "kit", "kit", "cold", "cold", "drums", "fade"],
    band:   ["cold", "cold", "cold", "hit", "hit", "count", "count", "quote", "stabs"],
    // the studio records are where the gesture belongs twice over: the two
    // most-quoted intros in the vocabulary are both this family's
    studio: ["cold", "cold", "quote", "stabs", "padin", "fade", "hit", "quote", "count"],
    soul:   ["bassin", "bassin", "bassin", "stabs", "stabs", "drumbass", "hit", "count", "quote"],
    groove: ["bassin", "bassin", "stabs", "stabs", "count", "drums", "hit", "quote", "drumbass"],
    roots:  ["count", "count", "solo", "solo", "cold", "hit", "bassin", "quote", "stabs"],
    // a part has no rhythm section to walk in on: every vote here is about the
    // sound arriving, which is all a lone line can do
    parts:  ["solo", "solo", "solo", "fade", "fade", "padin", "swell", "cold", "stabs"],
  };
  // A DRUM-SHAPED OPENING NEEDS DRUMS. On a kitless genre each one degrades to
  // the nearest kind that is about the sound instead of the kit — and bassin
  // needs a bass, which every kitless anchor in the table happens to lack.
  const INTRO_NOKIT = { count: "solo", hit: "cold", kit: "padin", riser: "swell",
                        drums: "padin", drumbass: "padin", bassin: "solo" };
  // THE REGISTRY BRIDGE. The intro chip table (fields.js INLABEL) has not yet
  // learned the new kinds, and the loader enum-rejects what the registry does
  // not know — so a kind the table lacks is STORED as its nearest legal
  // neighbour, while `cue` keeps the honest name (the same trick ALIAS plays
  // with prechorus/build). When INLABEL learns the words this map goes quiet
  // on its own: every entry is guarded by a lookup, not a build flag.
  function introEdge(kind, kit, INLABEL) {
    if (INLABEL[kind] != null) return kind;
    return { padin: "solo", fade: "swell", riser: "swell",
             // a quote IS the melody alone, which the table already has a word
             // for — the honest name rides `cue` like every other bridged kind
             quote: "solo",
             stabs: kit ? "hit" : "swell", cold: null }[kind] || null;
  }
  // THE CHOOSER GETS ITS OWN, GENRE-SALTED STREAM. The phrase bank consumes
  // the same number of r() draws whatever the genre, so a chooser reading the
  // shared stream sat at the same position for every kit genre — at any fixed
  // seed the whole family opened identically, eight seeds gave eight openings
  // across forty-five genres, and the first measurement showed four pool
  // entries that could never win. FNV-1a over "genre/seed" decorrelates them;
  // still pure, still a function of (gk, seed) and nothing else.
  const ihash = s => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  function introSections(G, gk, r, S, rI) {
    const kit = Object.keys(G.kit || {}).length > 0;
    // THE ANCHOR'S SAY comes first: a genre whose identity dictates its
    // opening declares `intro` on the anchor (a fugue starts with the subject
    // alone; ambient fades up; dub walks in on the bass) and wins the coin a
    // little over half the time — often enough to read as the genre's own way
    // in, not so often that every seed opens alike. Absent = the family lean.
    let kind = G.intro && chance(rI, 0.55) ? G.intro
             : pick(rI, INTRO_LEAN[G.family] || INTRO_LEAN.kernel);
    if (!kit && INTRO_NOKIT[kind]) kind = INTRO_NOKIT[kind];
    // A KIT SCHEDULE OUTRANKS A KIT OP: drums() reads g.kits before g.kit, and
    // genreOf maps only g.kit — so "bass alone" cannot yet be said for a kits
    // genre; the bed would keep drumming under the label. Until the UI phase
    // teaches genreOf to map the schedule, a kits genre starts drums-first.
    if (kind === "bassin" && G.kits) kind = "drums";
    // four bars, or two in a half-time genre — four bars of vaporwave is
    // fifteen seconds of nothing but a kick, which is not an intro, it is a wait
    const n = Math.max(2, Math.min(4, G.rate < 1 ? 2 : 4));
    const bed = (extra) => {
      const b = skeleton("intro", G, gk, S);
      b.len = n; b.stack[0].slots = [];            // no phrase: kit and bass only
      // (no groove and no swing here: BOTH are the SONG's — compose's return)
      return Object.assign(b, extra);
    };
    const out = [];
    if (kind === "drums" || kind === "drumbass")
      out.push(bed({ role: "drums", bassop: "nobass",
                     intro: chance(r, 0.4) ? "hit" : null }));
    if (kind === "bassin") out.push(bed({ role: "bass", kit: "nodrums" }));
    if (kind === "drumbass" || kind === "bassin")
      out.push(bed({ role: "groove", outro: chance(r, 0.6) ? fillOf(S, G, true) : null }));
    // ...and then the section that actually introduces the tune. `cue` carries
    // the chosen kind whatever the stored realization looks like — the gates
    // count openings by it, and the UX phase can label the box with it.
    const head = build("intro", G, gk, r, S);
    head.cue = kind;
    if (kind === "quote") {
      // THE HOOK, STATED. The chorus's own melody — slot 5, the topline the
      // composer wrote for the chorus and nothing else — played by an
      // instrument, on its own, before the song proper. Two things make it a
      // QUOTE rather than an intro that happens to have notes in it, and both
      // are checkable on the rendered stream: it is the SAME PHRASE the chorus
      // later sings, and it is over the SAME CHANGES (a genre with a
      // per-role progression hands the intro the chorus's, not the intro's, so
      // the pitches the quote sounds are the pitches the chorus will sound).
      // Everything build() holds back for an arrival comes off — a quote does
      // not fade in, it states.
      // ONE PHRASE IS NOT ONE VOICE. A box deals its slots ACROSS the genre's
      // voices (derive.js: voice v reads phrase v % nP), so a single slot is
      // handed to EVERY voice — and with the band stripped off around it, "the
      // hook on its own" came out as the hook and its own octave, or two horns
      // on the same pitches a few milliseconds apart. That is a flanger, not a
      // statement. The second slot is `sparse` — two notes a bar, its own walk
      // — so the voice that is not stating the tune punctuates it instead of
      // copying it, while voice 0 still carries the quote (pi = 0).
      //
      // ...BUT ONLY WHERE THERE IS A VOICE TO SPARE, and the measurement that
      // forced the condition is worth keeping: a PAD voice takes its pitches
      // from the chord and only its rhythm from the phrase, so on a genre that
      // comps (toto, citypop, jodeci — `realize(0) === "pad"`, with one line
      // voice playing from bar 1) handing the second voice a companion left
      // the quoted MELODY nowhere at all. Twenty-five genre/seed pairs stopped
      // quoting. The doubling was never those genres' problem anyway: it comes
      // from two LINE voices reading the same phrase, so that is the test —
      // count the line voices that are actually in the box from the top, and
      // if only one of them can state the tune, let it have the whole deal.
      const spare = [];
      for (let v = 0; v < (G.voices || 1); v++)
        if ((G.realize ? G.realize(v) : "line") !== "pad" &&
            (G.entry ? G.entry(v) : 0) === 0) spare.push(v);
      head.stack[0].slots = spare.length > 1 ? [S.topline, S.sparse] : [S.topline];
      head.env = null; head.lvl = null; head.rev = null; head.mot = null;
      head.bassop = null;
      if (kit) head.kit = chance(r, 0.5) ? "sparse" : "nodrums";
      if (G.progFamily) head.prog = G.progFamily.chorus || G.progFamily.drop || head.prog;
      head.intro = introEdge(kind, kit, NF.INLABEL);
    } else if (kind === "cold") {
      // THE COLD OPEN: the whole band from beat one, playing real material —
      // the hook itself, or the riff under the pad. Everything build() holds
      // back for an arrival (the fade, the pulled level, the thinned kit)
      // comes off, because the not-arriving is the gesture.
      // A COLD OPEN IS LEFT ALONE, and it is worth writing down why, because
      // the obvious repair is to give the one-slot branch the pad its sibling
      // has. MEASURED over 348 composed songs, that makes it WORSE — cold
      // doubling 11 boxes → 13. Adding a slot does not remove the deal, it
      // re-partitions it: two phrases across four voices is two doubled pairs
      // where one phrase across four was one. What actually exposes a double is
      // having nothing else in the bar, and cold is the one opening that keeps
      // the whole kit and the bass (`head.kit = null` below is the FULL kit,
      // not none), so the band covers it. The naked opening is `quote`, and
      // that is the one that changed.
      head.stack[0].slots = chance(r, 0.5) ? [S.hook] : [S.riff, S.pad];
      head.env = null; head.lvl = null; head.rev = null; head.mot = null;
      head.kit = null; head.bassop = null;
      head.intro = introEdge("cold", kit, NF.INLABEL);
    } else if (out.length) {
      // the bed already did the arriving, so this one just plays
      head.env = null; head.lvl = null; head.intro = null;
      if (kit) head.kit = null;
    } else {
      head.intro = introEdge(kind, kit, NF.INLABEL);
    }
    out.push(head);
    return out;
  }

  // ---- HOW A SECTION STOPS -------------------------------------------------
  // The same argument the intros got, one round later, and the same measured
  // symptom: the arranger knew ONE fill — an accelerating snare into a cymbal —
  // at three densities, so every section of every song in every genre ended
  // alike. kernel.js outro() now has ten kinds, four of them not a snare fill
  // at all, and the choice is a FAMILY ballot drawn on its own genre-salted
  // stream, exactly like INTRO_LEAN: nine votes, repetition is the weight,
  // leaning where the tradition leans. A club record cuts or stutters its hats;
  // a band plays a tom fill; the drift genres just stop.
  const OUTRO_LEAN = {
    kernel: ["fill", "roll", "crash", "tomfill", "hush", "cut", "break", "hatrun", "doubles"],
    vox:    ["tail", "tail", "tail", "cut", "hush", "cut", "tail", "hush", "cut"],
    drift:  ["tail", "tail", "hush", "hush", "cut", "crash", "tail", "hush", "tail"],
    club:   ["hatrun", "hatrun", "cut", "cut", "hush", "doubles", "break", "roll", "crash"],
    band:   ["fill", "fill", "tomfill", "tomfill", "crash", "roll", "doubles", "hush", "cut"],
    studio: ["fill", "tomfill", "hatrun", "crash", "roll", "hush", "fill", "cut", "break"],
    soul:   ["fill", "fill", "tomfill", "roll", "break", "doubles", "crash", "hush", "tomfill"],
    groove: ["break", "break", "fill", "hush", "tomfill", "cut", "roll", "crash", "tail"],
    roots:  ["fill", "tomfill", "roll", "crash", "break", "tail", "hush", "fill", "cut"],
    // and it has no kit to end on either — a part stops, or it rings out
    parts:  ["tail", "tail", "tail", "hush", "hush", "cut", "cut", "tail", "hush"],
  };
  // A DRUM-SHAPED ENDING NEEDS DRUMS — the mirror of INTRO_NOKIT. On a kitless
  // genre every fill degrades to the two endings that are about the sound
  // rather than the kit.
  const OUTRO_NOKIT = { fill: "tail", roll: "tail", tomfill: "tail", hatrun: "cut",
                        doubles: "cut", break: "tail", crash: "hush" };
  // THE LIFT is a narrower question than the ending: a prechorus or a build is
  // not stopping, it is handing over, so only the four kinds that accelerate
  // into the downbeat are on this ballot.
  const LIFT = ["roll", "hatrun", "doubles", "tomfill"];
  const fillOf = (S, G, kit, pool) => {
    const k = pick(S.out, pool || OUTRO_LEAN[G.family] || OUTRO_LEAN.kernel);
    return kit ? k : (OUTRO_NOKIT[k] || k);
  };
  // ...and the same idea for the KIT ITSELF. There are sixty-eight kit
  // operators now (kernel.js KITOPS) and the arranger reached for eight of
  // them, all rearrangements of a six-lane kit: no ride, no toms, no ghosts,
  // no hand. These ballots are per family for the same reason the fills are —
  // a soul record's variation is a ghost snare, a band's is a crash.
  const KIT_LEAN = {
    kernel: ["four", "backbeat", "sparse", "busy"],
    vox:    ["sparse", "soft", "onthree", "four"],
    drift:  ["soft", "sparse", "tomtime", "h.half", "onthree", "ride"],
    club:   ["four", "offbeat", "maybe", "h.dbl", "linear", "busy", "k.dens", "chaos"],
    band:   ["crash", "ride", "kickdoubles", "flams", "loud", "tomfill", "opens"],
    studio: ["ghosts", "ride", "opens", "humanize", "accents", "s.thin", "crashback"],
    soul:   ["ghosts", "opens", "claps", "k.dens", "humanize", "shuffle", "tomroll"],
    groove: ["stickside", "clave", "pedal", "ghosts", "tomtime", "maybe", "ride"],
    roots:  ["shuffle", "stickside", "ride", "flams", "tomfill", "ghosts"],
  };
  const kitOf = (S, G) => pick(S.out, KIT_LEAN[G.family] || KIT_LEAN.kernel);

  // ---- WHO PLAYS THE SOLO --------------------------------------------------
  // "What is a Beatles song without a couple of solos." Until the FUNCTION
  // genres existed (genres.js, the `parts` family) the arranger could not
  // answer that, because a solo section was the host genre playing its own
  // line a bit louder — the same instruments, the same parts, a level chip.
  // A solo is a PART somebody else is playing, and now it is one: the section
  // stacks a `solo`/`vocal`/`riff`/`pad`/`backing` layer, which inherits the
  // host's key, harmony, tempo and groove (the layer law) and contributes
  // nothing but its own line.
  //
  // WHO, per family, and it is the producer's question rather than a random
  // draw: a band's solo is a guitar, a soul record's is the singer, the club
  // genres put a topline over the floor, the drift genres do not really solo
  // at all — a wash surfaces. Weighted like every other ballot in this file,
  // and drawn on the genre-salted drum stream so two genres at one seed do not
  // both call the same part.
  const SOLO_LEAN = {
    kernel: ["solo", "solo", "vocal", "riff"],
    // the choral genres have a CANTOR, not a soloist, and their answer to it
    // is another voice
    vox:    ["vocal", "vocal", "vocal", "backing"],
    club:   ["vocal", "vocal", "solo", "riff", "pad"],
    soul:   ["vocal", "vocal", "vocal", "solo", "backing"],
    groove: ["solo", "solo", "vocal", "riff"],
    band:   ["solo", "solo", "solo", "solo", "vocal"],
    studio: ["solo", "solo", "solo", "vocal", "backing"],
    drift:  ["pad", "pad", "vocal", "solo"],
    roots:  ["solo", "solo", "solo", "vocal", "riff"],
    // A FUNCTION GENRE HAS NOBODY TO CALL. It already IS the part, and a solo
    // over a solo is two soloists — so the ballot is deliberately empty and
    // every caller below is guarded on `length`. Empty is a DECISION here, the
    // same way `null` is one in the dynamics table.
    parts:  [],
  };
  // ...AND THE SAME ERA DOOR THE GUEST GOES THROUGH (2026-08-25). The audit
  // that found the organ on Aksum found this half of it too: SOLO_LEAN names
  // only FUNCTION genres, which carry no year in a label — and so the ballot
  // sailed past a law written to read labels, and handed a 1300 estampie an
  // `overdrive_guitar` soloist. A soloist is a player in the room like any
  // other. `parts` and `kernel` records have no year of their own and are
  // untouched (eraOK's null branch), and every caller here is already guarded
  // on `length`, which is what makes an emptied ballot a legal answer.
  const castOf = (G, gk) => (SOLO_LEAN[G.family] || SOLO_LEAN.kernel)
    .filter(w => eraOK(genreYear(gk), w, gk));
  // ...MINUS THE ONE PART A SOLO SECTION CANNOT BE. Backing vocals BACK
  // something, and a solo section is precisely the place where the thing they
  // would be backing has stopped playing. It is filtered at this call site
  // rather than kept off the ballot, because the chorus — which is where a
  // backing part belongs — wants it.
  // ...and an INSTRUMENTAL record's solo is never sung either (the same law
  // guestCast applies at its own door: "the lead should be 303, not vocal")
  const soloCast = (G, gk) => castOf(G, gk).filter(w => w !== "backing" &&
    !(INSTRUMENTAL[gk] && w === "vocal"));
  // WHICH PHRASE the part is handed. A singer gets the topline — the melody the
  // composer wrote to be sung, with its motif, its breath and its one climax
  // (phrase("topline") below) — and the instrumental parts get the material
  // their own name describes. Nothing else in the file knows this mapping, so
  // it lives beside the ballot rather than at each call site.
  // the five FUNCTION genres by name, because two questions below need to know
  // whether a stacked genre is a PART (it plays its own material) or a style
  // stacked as colour (it accompanies)
  const PARTS5 = ["solo", "vocal", "backing", "riff", "pad"];
  const partSlot = (who, S) => (who === "vocal" || who === "backing" ? S.topline
    : who === "riff" ? S.riff : who === "pad" ? S.pad : S.climb);
  const sings = who => who === "vocal" || who === "backing";

  // ---- THE SINGER ----------------------------------------------------------
  // "The vocal is a guest, and it should be the through-line." MEASURED on
  // beatles/5: the `vocal` layer appeared on the BRIDGE and nowhere else, while
  // every chorus carried a `solo`. That is backwards, and it was backwards for
  // a structural reason rather than a tuning one — there was no such thing as
  // the record's SINGER. A voice could only arrive the way a string quartet
  // arrives: as one draw of one per-section coin, from a ballot that also
  // contained the lead guitarist. A guest turns up; a singer is on the record.
  //
  // So the singer is cast ONCE, before a section exists, exactly like the
  // guest — and then placed on the sections a singer sings on: the verses and
  // the choruses first (that is what "through-line" means), the prechorus and
  // the bridge often, the breakdown where a floor record leaves the voice
  // alone, and the drop. Not the solo section: the whole point of a solo
  // section is that somebody else has it.
  //
  // WHO SINGS, by family, and the two override tables are the interesting part:
  //   INSTRUMENTAL  the anchors inside a singing family whose records have no
  //                 topline — techno, dnb, acid and dub are floor music that
  //                 uses a voice as a sample rather than a line; a fugue and a
  //                 species-counterpoint exercise are abstractions; a tango is
  //                 a bandoneón.
  //   SINGER_GENRE  and the one the other way: shoegaze is filed under `drift`
  //                 with the drones because that is what it sounds like, and it
  //                 is a genre of SONGS with a singer buried in them.
  const SINGS = { vox: "vocal", soul: "vocal", studio: "vocal", roots: "vocal",
                  band: "vocal", groove: "vocal", club: "vocal", kernel: "vocal",
                  drift: null, parts: null };
  // ...spem included (2026-08-19, "Spem should be choir samples not vocal
  // sim"): its every chair IS the sampled choir (the anchor's own ahh_choir),
  // and the singer this table blocks was a formant cantor composed over the
  // top of a forty-part motet that never had one.
  const INSTRUMENTAL = { techno: 1, dnb: 1, acid: 1, dub: 1,
                         fugue: 1, counterpoint: 1, tango: 1, spem: 1,
                         // THE OLD WORLD (2026-08-21). Two kinds of refusal:
                         // the truly instrumental records — a consort, a
                         // concerto, an orchestra, a nocturne have no singer
                         // to book — and organum/arsnova by spem's own law
                         // ("its every chair IS the sampled choir"): their
                         // cast is already the voices, and a formant topline
                         // over a Notre Dame organum is the composed cantor
                         // spem was rid of. troubadour/continuo/barcarolle/
                         // parlor stay OFF this list on crooner's precedent —
                         // they are SONG traditions and the singer layer
                         // taking the tune is what a song record is.
                         estampie: 1, pavane: 1, concerto: 1, classical: 1,
                         nocturne: 1, romantic: 1, organum: 1, arsnova: 1 };
  // ---- THE ERA LAW ("Why would Chicago 1932 have enormous amounts of
  // delay?", 2026-08-18). Every place-year anchor states its year in its own
  // label (ui/palette.js genreYear — the same trailing-digit parse, kept in
  // step by the era-law gate), and an effect cannot arrive on a record cut
  // before the effect existed. The table is each effect's arrival year —
  // tape echo 1950, the pedals their own decades — tuned no tighter than the
  // shipped anchors' own claims (drone's 1964 filter sweep, the Isleys' 1973
  // modulation are real records). Applied as a draw-free filter at the end
  // of build(), so no stream moves and ALL hundred-ten genres are swept.
  const genreYear = gk2 => {
    const m = /(\d{3,4})\s*$/.exec((GENRES[gk2] || {}).label || "");
    return m ? +m[1] : null;
  };
  const FX_YEAR = { echo: 1950, ringmod: 1956, sweep: 1964, flanger: 1966,
                    wah: 1966, phaser: 1968, chorus: 1968, fenv: 1972,
                    crunch: 1951, leslie: 1941, tremolo: 1938, vibrato: 1938 };
  // ...AND THE SAME LAW ABOUT THE PLAYERS, which is the half that was missing
  // (Paul, 2026-08-25: "fix the zema organ thing"). The era law swept the
  // PEDALS and left the ROOM alone, and the room is where the caricature was:
  // measured across 139 anchors x 3 seeds, 254 hires were out of period, in
  // 157 of the 417 records and 74 of the 139 anchors. The oldest record in the
  // catalog — Aksum 540, whose entry says out loud it is "NOT a child of Rome
  // 600 and must never be written as one" — drew a Leipzig church organ on two
  // seeds and a Vienna harpsichord on the third.
  // A guest is a PLAYER carrying an INSTRUMENT, so there are two dates to
  // check and neither may be later than the record's own.
  //
  // WHEN AN INSTRUMENT ARRIVES IS EXTRACTED, NEVER TYPED: the earliest year
  // any dated anchor claims the id. The catalog is the only honest source for
  // it — `church_organ` reads 1725 because Leipzig is the oldest record here
  // that plays one, `harpsichord` 1602, `overdrive_guitar` 1973, `warm_pad`
  // 1973 — and a table extracted from the anchors cannot drift from the
  // anchors the way a typed one would. It is a FLOOR over the catalog's own
  // claims, tuned no tighter than FX_YEAR above is, and an id no dated anchor
  // names carries no floor at all rather than a guessed one.
  const instrOf = gk2 => { const e = (GENRES[gk2] || {}).instr;
                           return e == null ? [] : Array.isArray(e) ? e : [e]; };
  // A VOICE HAS NO INVENTION DATE, and that is why the sung ids are exempt
  // below rather than floored with everything else. Extraction would put
  // `solo_vox` at 1200 — Paris is the oldest record here that names one — and
  // then zema's own `intro: "solo"` ("the mergéta gives the line out alone")
  // would be unsayable in 540, which is absurd: people sang before Notre Dame.
  // The regex is instruments.js FAMILY's own row (`/choir|voices|vox|voice/ ->
  // "vox"`) said again here rather than imported, because that file sits a
  // LAYER ABOVE this one in the graph — fields.js:1367 declines the same
  // import for the same reason — and the gate holds the two in step.
  const SUNG = /choir|voices|vox|voice/;
  const INSTR_YEAR = {};
  for (const k of Object.keys(GENRES)) {
    const y = genreYear(k); if (y == null) continue;
    for (const id of instrOf(k))
      if (!SUNG.test(id) && (INSTR_YEAR[id] == null || y < INSTR_YEAR[id]))
        INSTR_YEAR[id] = y;
  }
  // ...AND THE FLOOR IS WAIVED, AFTER 1950, FOR AN INSTRUMENT THE RECORD
  // ALREADY PLAYS — the clause that keeps the law honest rather than merely
  // strict. Extraction can only say when the CATALOG first hears an id, and that
  // is not when the instrument was invented: `overdrive_guitar` extracts to
  // 1973 because London 1969's `crunch_guitar` is the oldest dirty id any
  // anchor names, and applying that floor flatly took the guitar solo off
  // Chicago 1952, St. Louis 1955 and London 1969 — Chuck Berry with no lead
  // break, which is a worse lie than the one being fixed. So the anchor
  // answers for its own room: a record whose cast already holds that KIND of
  // instrument can hire another one, whatever the catalog's floor says. Blues
  // plays a `jazz_guitar`, so a guitar may visit; the Paris 1300 estampie
  // plays a recorder and a dulcimer, so one may not.
  //
  // THE WAIVER STARTS IN 1950, which is not a new number: it is FX_YEAR's own
  // `echo: 1950` and the `year < 1950` branch at the foot of build(), the line
  // this file already draws where the modern studio begins. Every id the
  // extraction floors late is an electric or a synthetic sound, and before
  // that line no record can have one however many instruments of the kind it
  // owns — a lute is a `guitar` by head noun, and without this clause Provence
  // 1210 and Antwerp 1551 hired a palm-muted electric off the back of theirs.
  //
  // THE KIND IS THE HEAD NOUN, derived rather than tabled: the last word of
  // the id with any trailing number dropped, so `overdrive_guitar`,
  // `palm_muted_guitar` and `jazz_guitar` are one kind, `felt_piano` and
  // `upright_piano` are one, and `synth_strings_2` files with `slow_strings`.
  // instruments.js's FAMILY table is the fuller version of this idea and the
  // one owner of it for MIXING; it is not imported for the reason SUNG above
  // is not, and this file needs only the coarse question.
  const kindOf = (id) => { const t = String(id).split("_").filter(x => !/^\d+$/.test(x));
                           return t[t.length - 1] || String(id); };
  const kindsOf = gk2 => new Set(instrOf(gk2).map(kindOf));
  const AMPLIFIED = 1950;
  // ONE EXPRESSION FOR "MAY THIS RECORD SEAT THAT SOUND", asked of an id, so
  // the two ballots below and the gate that holds them cannot drift into three
  // spellings of one rule — and the gate needs its own way in, because it
  // reads the DOCUMENT's seated instruments, which is a later artifact than
  // either ballot.
  const seatOK = (gk2, id) => {
    const year = genreYear(gk2);
    return !year || SUNG.test(id) || !(INSTR_YEAR[id] > year) ||
           (year >= AMPLIFIED && kindsOf(gk2).has(kindOf(id)));
  };
  // CAN THIS RECORD HIRE THAT PLAYER? Both dates at one door, so the guest
  // ballot and the solo ballot cannot answer it differently. `year` null (a
  // FUNCTION genre, which is a part and not a place) means no era test at all,
  // exactly as FX_YEAR's own `!year` branch already reads.
  const eraOK = (year, w, gk2) => !year ||
    (!(genreYear(w) > year) && instrOf(w).every(id => seatOK(gk2, id)));
  // WHOSE SOUND IS NOTHING BUT VOICES — asked of the anchor rather than listed,
  // because a list is the thing that went wrong. Three of the anchor's own
  // fields answer it: no kit, no bass, and every id in `instr` a sung one. It
  // finds gregorian, spem, organum, zema and mbube, which is exactly the set of
  // records whose entries say so in prose — "Zema is properly unaccompanied and
  // that is why `kit: {}` is the truest line in this entry", and mbube's
  // "letting the bass chair pick up its default upright would put an instrument
  // on a record that has none".
  // ...AND IT IS ASKED ONLY OF A PLACE AND A YEAR. `vocal` and `backing` pass
  // all three field tests — a bare part has no kit, no bass and one sung id —
  // but a part is not a tradition that sings unaccompanied, it is a line with
  // nobody around it yet, and the `parts` family's own lean exists to give it
  // somebody ("a part hosting a part: the pad under the solo, the second voice
  // against the first"). Measured: without this clause the two of them lost
  // all 11 of their layers across three seeds, which is the wrong genre paying
  // for zema's bill.
  const unaccompanied = gk2 => {
    const g2 = GENRES[gk2] || {}, ins = instrOf(gk2);
    return genreYear(gk2) != null &&
           !Object.keys(g2.kit || {}).length && !!g2.nobass &&
           ins.length > 0 && ins.every(id => SUNG.test(id));
  };
  const SINGER_GENRE = { shoegaze: "vocal" };
  const singerOf = (G, gk) => {
    if (INSTRUMENTAL[gk]) return null;
    const who = SINGER_GENRE[gk] || SINGS[G.family] || null;
    return who && who !== gk ? who : null;      // a `vocal` record does not book a singer
  };
  // The three kit operators that write a LEVEL onto every lane rather than
  // rearranging which lanes fire — the only ones whose dynamics survive the
  // melody being taken away. See the solo break below for why that matters.
  const BREAK_KIT = ["accents", "accents", "crescendo", "loud"];

  // THE SEQUENCER LINE — the machine genres' own material (Paul, on the
  // staged acid: "there's no real 16-step intense acid riff … I expect it to
  // really go"). A 303 pattern is not a topline: it RUNS — nearly every step
  // gated, no breath, a narrow cell bounced through octaves, slides
  // everywhere, and the accents on a rotating mask rather than the strong
  // beats. `steps` 16 or 32; the 32-step form is the two-bar line (the
  // composer's first pattern longer than one bar) whose second bar DEVELOPS
  // the first — cell shifted, one new rest, the accent mask rotated — so the
  // long pattern evolves instead of repeating.
  function seqPhrase(r, steps) {
    const p = blank();
    for (const k of ["gate", "deg", "oct", "vel", "inc", "stk", "acc", "sld"])
      p[k] = new Array(steps).fill(0);
    // the cell: four degrees around the root, mostly root — the acid alphabet
    const cell = [0, pick(r, [0, 1, -1]), pick(r, [0, 2, -2, 1]), pick(r, [-1, 1, 3, 0])];
    const shift = pick(r, [1, 2, -2, 4]);          // where bar two goes
    const rests = [pick(r, [3, 7, 11]), pick(r, [6, 10, 13])];
    // 4-5 accents per bar, offbeats included — the accent line IS the funk
    const accAt = [];
    { let i = pick(r, [0, 1, 2]); while (i < 16) { accAt.push(i); i += pick(r, [3, 3, 4, 5]); } }
    for (let i = 0; i < steps; i++) {
      const q = i % 16, two = i >= 16;
      p.gate[i] = (q === rests[0] || (two && q === rests[1])) ? 0 : 1;
      p.deg[i] = cell[q % 4] + (two ? shift : 0);
      p.acc[i] = p.gate[i] && accAt.includes((q + (two ? 2 : 0)) % 16) ? 1 : 0;
      p.sld[i] = p.gate[i] && !p.acc[i] && chance(r, 0.3) ? 1 : 0;
      p.vel[i] = p.acc[i] ? 9 : 5 + Math.floor(r() * 2);
    }
    // THE OCTAVE BOUNCE IS THE HOOK: three fixed slots per bar, the same
    // slots both bars, so the bounce reads as the pattern's identity
    for (const at of [pick(r, [2, 6]), pick(r, [8, 10]), pick(r, [12, 14])]) {
      const up = chance(r, 0.6) ? 1 : -1;
      for (let b = 0; b * 16 + at < steps; b++)
        if (p.gate[b * 16 + at]) p.oct[b * 16 + at] = up;
    }
    // QUESTION, ANSWER: bar one states from home, bar two speaks from the
    // shift — and its LAST gated step lands back on the root, so the two-bar
    // sentence resolves at its own seam instead of merely starting over.
    if (steps > 16)
      for (let i = steps - 1; i >= 16; i--)
        if (p.gate[i]) { p.deg[i] = 0; p.oct[i] = 0; break; }
    return p;
  }

  function build(role, G, gk, r, S, a) {
    const kit = Object.keys(G.kit || {}).length > 0;   // does this genre have drums at all
    const bars = G.bars;
    const peak = !!(a && a.peak);                       // the arc's 1.0 — the last chorus/drop
    const b = skeleton(ALIAS[role] || role, G, gk, S);
    if (ALIAS[role]) b.cue = role;                      // the honest name, kept for the UX phase
    // THE SECTION LENGTH, from the family's own answer rather than from the
    // genre's form length (fullLen above for why those are different questions)
    b.len = fullLen(G);
    const again = (a && a.again) || 0;                  // how many times this role has been
    const layer = (g2, slots) => b.stack.push({ g: g2, slots });
    // THE SINGER, PLACED. Same shape as `guest` below and drawn the same way —
    // unconditionally, on its own stream, so retuning where the voice sings
    // cannot move a drum, an effect or a guest. `as: "voice"` is the one thing
    // that distinguishes it in the saved file: the loader carries unknown keys
    // through untouched (the trick `cue` already plays), and it is what lets a
    // census tell the record's singer apart from a guest who dropped by. A
    // singer counted as a guest would have put the guest rate through the roof
    // and said nothing true about either.
    const voice = (p, slots) => {
      const yes = chance(S.voc, p);
      if (S.singer && yes) b.stack.push({ g: S.singer, slots, as: "voice" });
    };
    // THE GUEST, PLACED. The cast was drawn once for the whole song (guestCast
    // above); this is the per-section coin that decides whether they are on
    // this one. Drawn on the song's own guest stream so the placement policy
    // can change without moving a single drum or phrase decision, and drawn
    // UNCONDITIONALLY — a p of 1 still spends its number, because a stream
    // whose position depends on which branch was taken is a stream that
    // reshuffles the whole record every time a probability is edited.
    const guest = (p, slots, who) => {
      const g2 = who || (S.guest && S.guest.a);
      const yes = chance(S.gst, p);
      if (g2 && yes) layer(g2, slots);
    };
    // A genre with named progressions deals a DIFFERENT one per role — the
    // verse and the chorus finally disagree about harmony. The key is a name
    // into NuGenres.PROGS; it rides the save as data (the loader carries
    // unknown keys) and the render path picks it up when the section learns
    // to override the genre's prog.
    if (G.progFamily && G.progFamily[role]) b.prog = G.progFamily[role];

    if (role === "intro") {
      b.stack[0].slots = chance(r, 0.5) ? [S.pad] : [S.pad, S.sparse];
      b.env = "in"; b.lvl = "back"; b.rev = "wet";
      b.len = halfLen(G);
      // the intro EDGE is not decided here: introSections owns how the song
      // opens (family-weighted, anchor-first), and stamping count/hit on top
      // of it is exactly the every-song-opens-on-a-drum bug this replaced
      if (kit) b.kit = chance(r, 0.5) ? "sparse" : "nodrums";
      else b.mot = "open";
      b.bassop = kit && chance(r, 0.5) ? "pedal" : null;
    } else if (role === "verse") {
      // FOUR WAYS TO BE A VERSE. A song whose every verse deals the same one
      // phrase is a loop with a label on it — and, measured across 560 composed
      // songs, an arrangement that only ever reached for three of the eight
      // phrases it had just written. The variants are what spend the material.
      // a MACHINE song's verse is its sequencer line — the 303 runs from the
      // first bar (same single draw either way, so no stream shifts)
      b.stack[0].slots = pick(r, S.seq != null
        ? [[S.seq], [S.seq], [S.seq, S.pad], [S.seq, S.sparse]]
        : [[S.hook], [S.hook, S.answer],
           [S.hook, S.riff], [S.answer, S.counter]]);
      if (kit) b.bassop = pick(r, ["walk", "octaves", null, null]);
      if (chance(r, 0.35)) b.ops = [pick(r, ["rot4", "gat4", "pit4", "rev"])];
      // A VERSE VARIES ITS DRUMS TOO. It used to be the one role that never
      // touched the kit — every verse in every song was the anchor's bar
      // restated — and a ghost snare or a ride is exactly the small change
      // that makes verse 2 not verse 1.
      if (kit && chance(r, 0.4)) b.kit = kitOf(S, G);
      if (chance(r, 0.3)) b.outro = fillOf(S, G, kit);
      // A PAD GENRE UNDER A VERSE, now and then — and it is the pad PHRASE
      // whoever the guest is, because a verse's guest is a bed.
      guest(0.22, [S.pad]);
      // ...AND THE SINGER SINGS THE VERSE, which is the whole of the fourth
      // complaint. Not the chorus topline — that is the chorus's — but its
      // DEVELOPMENT: slot 8, which opens with the topline's own first half note
      // for note and then answers it differently (phrase(), the `head`
      // argument). One tune, two verses of it, and a chorus that is the same
      // tune arriving properly. 0.85 rather than 1 because a first verse with
      // the band alone under it and the voice entering on the second is a real
      // arrangement and this is the only place it can happen.
      voice(0.85, [S.verseline]);
    } else if (role === "prechorus") {
      // THE LIFT. Everything here points forward: the answer phrase (not the
      // hook — the hook is being saved), the kit filling in, a riser, a fade
      // up, and a snare roll into the downbeat. The cadence is the
      // anticipation — the last bar borrows the dominant's door so the chorus
      // is an ARRIVAL rather than the next thing that happens.
      b.stack[0].slots = chance(r, 0.5) ? [S.answer] : [S.answer, S.sparse];
      // A SECOND PRECHORUS DOES NOT FADE IN AGAIN. `in` is a fade — it starts
      // at zero — and a band that fades up twice in one record is a band with
      // a mixing desk problem. The second time round the same gesture is `lift`
      // (kernel.js SHAPES: held flat, then the last two fifths climb hard),
      // which is what a lift into a bigger chorus actually is. It is also what
      // keeps the two prechoruses of a song from carrying the identical
      // dynamic, which the ladder pass below cannot do for a fade.
      b.lvl = "back"; b.env = again ? "lift" : "in"; b.mot = "rise";
      if (kit) { b.kit = chance(r, 0.5) ? "busy" : kitOf(S, G); b.outro = fillOf(S, G, kit, LIFT); }
      voice(0.6, [S.answer]);
      // only where there is a progression for the dominant to be a door INTO
      // (the same guard the bridge carries) — on a modal genre the cadence
      // has no prog to land on and the render path correctly drops it
      if (G.progFamily || G.prog || (G.harmony === "cycle" && G.roots))
        b.cadence = { d: 4, q: "dom7" };
      b.len = halfLen(G);
    } else if (role === "build") {
      // the dance floor's prechorus: same gesture, different clothes —
      // a thinned phrase under a riser, everything held back for the drop
      b.stack[0].slots = chance(r, 0.5) ? [S.sparse] : [S.climb];
      b.lvl = "back"; b.env = again ? "lift" : "in"; b.mot = "rise"; b.echo = "touch";
      if (kit) { b.kit = chance(r, 0.5) ? "busy" : "nokick"; b.outro = fillOf(S, G, kit, LIFT); }
      b.len = halfLen(G);
    } else if (role === "chorus") {
      // THE CHORUS HAS ITS OWN MELODY — the topline, written for it, instead
      // of a re-deal of the verse's hook. The hook may come back as the third
      // line, which is a counter-hook, not a substitute.
      b.stack[0].slots = chance(r, 0.55) ? [S.topline, S.counter]
                                         : [S.topline, S.counter, S.hook];
      // AND THE SINGER SINGS IT — every time, not on a coin. The topline moves
      // OFF the band and onto the record's `vocal` layer and the host keeps the
      // parts, because a chorus sung by the guitar player AND the singer in
      // unison is one line twice. This used to be a per-section draw over a
      // ballot that also held the lead guitarist, which is how beatles/5 came
      // out with a solo on every chorus and the voice on the bridge only.
      //
      // WITHOUT A SINGER (techno, a fugue, a lone part) the band leads with the
      // topline and the odd chorus gets an instrumental part over it — and the
      // ballot is filtered of the two names that would contradict the record:
      // a singing part on a genre that declared it has no singer, and the
      // soloist, who is confined below.
      if (S.singer) {
        b.stack[0].slots = chance(r, 0.55) ? [S.counter] : [S.counter, S.hook];
        voice(1, [S.topline]);
      } else {
        const cast = castOf(G, gk).filter(w => w !== "solo" && !sings(w));
        const who = cast.length && chance(r, 0.5) ? pick(S.out, cast) : null;
        // ...but never on the soloist's own VISITING chorus: that box is
        // about to take the visit below and may draw the guest as well, and
        // three layers on one chorus is mush — the census caught exactly
        // this the day the first instrumental song-plan genre (classical,
        // Vienna 1785) joined the table and rolled cast + visit + guest at
        // once. The draws above still run so every other box's stream is
        // byte-identical; only the push is withheld.
        const visiting = a && a.i != null && a.i === S.visit;
        if (who && !visiting) layer(who, [partSlot(who, S)]);
      }
      // THE SOLOIST VISITS, ONCE. "The solo is what visits — one section, maybe
      // a chorus." So it is exactly one chorus of the record, chosen before any
      // section existed (S.visit) and never the peak, which belongs to the
      // singer and the colour that arrives with them. Everywhere else in this
      // file the `solo` part is unreachable by construction: it is off the
      // guest ballots and off the chorus cast, so the only two boxes in a
      // composed song that can carry one are the solo section and this.
      if (a && a.i != null && a.i === S.visit) {
        const cast = soloCast(G, gk);
        if (cast.length) layer(pick(S.out, cast), [S.climb]);
      }
      // the arc decides the size: only the PEAK chorus goes forward, so the
      // last one is bigger than the first by construction, not by accident
      b.lvl = peak ? "fwd" : null; b.rev = "some";
      if (kit) { b.kit = chance(r, 0.6) ? kitOf(S, G) : null; b.bassop = pick(r, ["octaves", "eighths"]); }
      b.outro = fillOf(S, G, kit);
      // a lift on bar 3 of every four — the bar schedule as a PRESET NAME now
      // (fields.js PERIODS."4bar" is the same [[],[],["dens3"],[]] this used
      // to write raw; the registry validates the name, the render resolves it)
      if (chance(r, 0.6)) b.period = "4bar";
      // the chorus is where a second genre earns its place — one more line,
      // its own phrase, which is what the stack was built for. At the peak it
      // is not offered, it is DUE — and sometimes the whole band goes up two:
      // the truck-driver modulation, the most recognizable radio gesture there
      // is, up a whole step off the SONG'S OWN key (S.tonic, wrapped back onto
      // the twelve fields.js actually offers rather than sailing past +5).
      // ONLY A "song"-PLAN GENRE EVER REACHES HERE — `chorus` is not a role the
      // dance or arc plans build (PLAN_OF above) — so the gesture is already
      // confined to the radio-song idiom that owns it, with no further filter
      // needed: a fugue or a drone never rolls this dice because it never asks.
      //
      // WHO the guest is stopped being a uniform draw over LAYERABLE here: the
      // pool is the family's own ballot and the name was chosen once for the
      // record (guestCast). The peak gets the SECOND name — a colour that has
      // not been heard yet, arriving in the last chorus, which is the oldest
      // gesture in pop and the one place this file allows two guests in a box.
      if (peak) {
        guest(1, [S.counter], S.guest && S.guest.b);
        if (chance(r, 0.4)) b.key = NF.wrapKey(S.tonic + 2);
      } else guest(0.45, [S.counter]);
    } else if (role === "bridge") {
      b.stack[0].slots = chance(r, 0.5) ? [S.counter] : [S.counter, S.sparse];
      b.mode = pick(r, ["dorian", "phrygian", "harmonic", "mixo"]);
      // THE RELATIVE-MINOR BRIDGE. A bridge already changes colour (b.mode,
      // just above); on a genre with real harmonic function it sometimes
      // changes CENTRE too — up or down a minor third off the song's own key,
      // the classic relative major/minor pair and the oldest way a middle
      // eight reads as "somewhere else". GATED ON FUNCTION: a genre that never
      // names a prog or a chord cycle (acid, simple, anything modal) has no
      // dominant to leave home from and nothing for a relative key to mean, so
      // it sits this one out — the same guard the cadence three lines down
      // already uses for the identical reason.
      if ((G.progFamily || G.prog || (G.harmony === "cycle" && G.roots)) && chance(r, 0.3))
        b.key = NF.wrapKey(S.tonic + (chance(r, 0.5) ? -3 : 3));
      b.ops = [pick(r, ["inv", "rev", "rot3", "gateflip"])];
      b.period = "2bar";                      // a two-bar period: the bridge sways
      if (G.progFamily || G.prog) b.cadence = { d: 4, q: "dom7" };
      if (kit) b.kit = pick(r, ["shift", "halftime", "swap", "onthree", "linear", "tomtime"]);
      b.mot = chance(r, 0.4) ? "close" : null;
      b.outro = fillOf(S, G, kit);
      // THE BRIDGE THAT GOES UNDERWATER — the section that is genuinely
      // somewhere else, which is the one place a per-box effect is a
      // production decision rather than a wash. Everything global went to the
      // master; this is what per-box fx are left holding.
      dress(b, S, G, AWAY_FX, 0.55);
      guest(0.3, [S.counter]);
      // the bridge is a place a singer sings — it just is not the ONLY one any
      // more, which was the measured complaint
      voice(0.55, [S.counter]);
    } else if (role === "breakdown") {
      b.stack[0].slots = [S.sparse];
      b.len = halfLen(G);
      b.lvl = "hush"; b.rev = "drown"; b.echo = "some";
      if (kit) b.kit = pick(r, ["nokick", "nodrums", "snareonly", "soft", "stickside", "h.half"]);
      addFx(b, pick(r, ["sweep", "echo", "phaser"]));
      b.mot = "rise"; b.env = "in";
      b.outro = pick(r, [fillOf(S, G, kit, LIFT), "cut"]);
      // the breakdown is the OTHER genuinely sectional place, and it already
      // had its one effect (the line above this block); what it did not have
      // was the thing a breakdown is usually for — the floor drops out and one
      // foreign voice is left holding the room
      guest(0.45, [S.sparse]);
      // ...and the other thing the floor drops out FOR: the voice on its own
      voice(0.4, [S.sparse]);
    } else if (role === "drop") {
      // the machine drop is the line at full intensity, the climb on top
      b.stack[0].slots = S.seq != null ? [S.seq, S.climb] : [S.riff, S.climb];
      b.lvl = "fwd";
      // the drop is the one place a NAMED pattern earns its keep: four on the
      // floor, or the break the whole floor knows, or the family's own move
      if (kit) { b.kit = pick(r, ["four", "four", "amen", kitOf(S, G), null]);
                 b.bassop = pick(r, ["reese", "wobble", "eighths"]); }
      b.ops = [pick(r, ["rep2", "rep4", "rot2"])];
      b.echo = chance(r, 0.4) ? "touch" : null;
      b.intro = chance(r, 0.4) ? "hit" : null;
      // THE PEAK DROP SPENDS THE NEW SURFACE: the arc's 1.0 either opens the
      // filter across the whole section or pumps the level on every beat —
      // written as the real point list the mixer arms and the bounce renders,
      // through the same validate-and-apply door as everything else
      if (peak) {
        const [ap, ash] = chance(r, 0.55) ? ["cutoff", "open"] : ["level", "pump"];
        b.auto = [NF.autoShape(ap, ash, (b.len || bars) * 4 / G.rate)];
      }
      // THE DROP IS WHERE A DANCE RECORD'S GUEST LIVES, and its absence here is
      // the whole reason eleven genres never stacked: the dance plan has no
      // chorus and no solo, so until this line acid, techno, house, garage,
      // dnb, trap, disco, dub, vaporwave, newwave and eurythmics had no role
      // that could call anybody. The peak drop is not a coin — a floor record's
      // last drop is exactly where the topline arrives.
      //
      // A function genre plays its OWN material over the floor (a singer sings
      // the topline, a pad pads); a style genre stacked as colour takes the
      // counter-line, because it is accompanying rather than fronting.
      {
        const who = peak ? (S.guest && S.guest.b) : (S.guest && S.guest.a);
        guest(peak ? 1 : 0.5, [PARTS5.includes(who) ? partSlot(who, S) : S.counter], who);
      }
      // a dance plan has no chorus, so this IS where the record's topline
      // lands, and at the peak it is not a coin: a floor record with a singer
      // on it states the tune over the last drop or it never states it at all,
      // and an intro that quotes a hook the record never plays is not a quote
      voice(peak ? 1 : 0.45, [S.topline]);
    } else if (role === "solo") {
      b.stack[0].slots = chance(r, 0.5) ? [S.climb] : [S.climb, S.riff];
      b.ops = [pick(r, ["rep3", "rep4", "wide"])];
      b.vox = { cut: "bright", res: "hot", emod: "mid", dec: "short" };
      b.lvl = "fwd"; b.echo = "touch";
      // THE PEDAL THE SOLOIST STEPS ON — the third and last sectional effect.
      // A solo is a different player with a different signal path, which is
      // exactly the departure a per-box chain is for.
      dress(b, S, G, SOLO_FX, 0.4);
      if (kit) b.kit = chance(r, 0.5) ? "busy" : kitOf(S, G);
      b.outro = fillOf(S, G, kit);
      // SOMEBODY TAKES IT. The section's whole job is that a part arrives which
      // was not there before, so the layer is not a coin — it is what the role
      // means. (Only the function genres themselves have nobody to call.)
      const cast = soloCast(G, gk);
      if (cast.length) {
        const who = pick(S.out, cast);
        layer(who, [partSlot(who, S)]);
        // ...AND THE BAND GETS OUT OF THE WAY. "A Beatles song where only the
        // drums remain, but the solo plays." Half the time, on a genre that
        // has a kit: the authority's phrase comes off entirely, the bass stops,
        // and what is left is the host's own drums under somebody else's line.
        // It is expressible because a box with an empty authority slot list is
        // already how the intro BEDS work — the kit and the bass are genre
        // data, not phrase data — and the layer is already independent of it.
        // `cue` carries the honest name the way it does for a prechorus.
        if (kit && chance(r, 0.5)) {
          b.stack[0].slots = [];
          b.bassop = "nobass";
          b.cue = "solobreak";
          b.ops = [];                       // there is no host phrase left to operate on
          // THE DRUMMER PLAYS UNDER IT, and the kit operator here is not
          // decoration — it is load-bearing. The kit's velocity chain
          // (kernel.js drums) falls through to the MELODY's velocity wherever a
          // lane's cell is the bare 1, and the melody is precisely what this
          // section just took away: measured, an unoperated kit plays a flat,
          // accent-less 5 for the whole break. Every op on this ballot writes
          // real levels onto every lane, so the break's drums carry their own
          // dynamics instead of borrowing a line that is not playing.
          b.kit = pick(S.out, BREAK_KIT);
        }
      }
    } else {                                            // outro
      b.stack[0].slots = chance(r, 0.6) ? [S.pad] : [S.pad, S.riff];
      b.env = "out"; b.rev = "wet"; b.mot = "close";
      b.len = halfLen(G);
      // the last bar of the record: a crash more often than not, but a tom
      // fill or a bar of silence with a cymbal in it is also how a song ends
      if (kit) { b.kit = "sparse"; b.outro = pick(r, ["crash", "crash", fillOf(S, G, kit)]); }
    }
    // (No groove and no swing stamped here: BOTH ride the song object now —
    // compose's return — the way the tempo does. Each was decided once and
    // STAMPED on every box, which was the tell that neither was ever a box
 // fact at all; the swing followed the groove up on 2026-08-16, "nothing
    // in a section tells time".)
    // THE ARC, SPENT. Where the role has not already claimed the field with a
    // fade of its own, the section gets the dynamic its place in the song asks
    // for — which is what makes the last chorus bigger than the first verse
    // without either of them being told what a chorus or a verse is.
    if (!b.env) b.env = dynOf(a);
    // THE ERA LAW, applied: chips from after the record's year drop, and a
    // pre-tape record sends nothing to the echo bus.
    const year = genreYear(gk);
    b.fx = b.fx.filter(Boolean).filter(f => !(year && FX_YEAR[f] > year));
    if (year && year < 1950) { b.echo = null; if (b.dtime) b.dtime = null; }
    // ...and motion arcs / automation lanes are DESK moves (a filter sweep,
    // a sidechain pump): a record from before them keeps its fades (`env`)
    // and loses the sweep, whichever role wrote it
    if (year && year < FX_YEAR.sweep) { b.mot = null; b.auto = []; }
    return b;
  }
  // the genres worth stacking UNDER something else — a line, no drums of its
  // own, and NO `prog`: the render path hands a layer the authority's roots
  // but not its progression, so a prog-carrying layer would follow its own
  // chords against the box's — half the band in a different song. The gate
  // holds this list prog-free until the layer path learns to inherit prog.
  // ...and the FUNCTION genres belong here by construction: no kit, no bass, no
  // prog, one part, written to be stacked. They are the reason the list stopped
  // being "the six genres that happen to be safe" and became a category.
  const LAYERABLE = ["fugue", "counterpoint", "gregorian", "simple", "drone", "neoclassical",
                     "solo", "vocal", "backing", "riff", "pad"];

  // ---- THE GUEST -----------------------------------------------------------
  // "You have stopped adding elements from other genres into the randomly
  // generated songs." Measured before this: 10.7% of boxes carried a second
  // genre and ELEVEN genres never stacked at all — acid, newwave, vaporwave,
  // eurythmics, trap, house, garage, dnb, disco, dub, techno. That list is not
  // a coincidence and it is not eleven separate bugs: every one of them
  // arranges on the DANCE plan, and the only two roles that ever called for a
  // layer were `chorus` and `solo`, neither of which a dance plan has. A
  // record with no chorus could not have a guest on it.
  //
  // Two things were wrong, and the second is the interesting one. Layering was
  // reachable from too few roles, AND where it was reachable the guest was
  // drawn UNIFORMLY from LAYERABLE — which is how a techno track ends up with
  // plainchant over it. A guest is a producer's decision, so it is a ballot
  // like every other decision in this file, and it leans on the FAMILY: the
  // club genres call a topline or a pad over the floor, a soul record calls
  // backing vocals, the studio records call the string quartet, the choral
  // genres answer themselves with another choir.
  //
  // NO BALLOT VOTES FOR `solo` ANY MORE, and that is the other half of "the
  // solo is what visits". A featured line that turns up under a verse is not a
  // guest, it is a second soloist — and a record with a lead break in every
  // section has no lead break. The name is reachable from exactly two places
  // now (the solo section, and the one chorus it visits), which is what makes
  // "confined" a fact about the output rather than a hope. Its votes went to
  // the colours the same family would actually call.
  const GUEST_LEAN = {
    kernel: ["pad", "vocal", "riff", "counterpoint", "backing", "drone"],
    // a choir's guest is another choir — the answering voice, the organ under
    // it, the cantor over the top. TRUE OF HALF THE FAMILY AND NEVER TRUE OF
    // THE OTHER HALF, which is the whole of "the zema organ thing": `vox` is a
    // cluster held together by TEXTURE (its own header: "unaccompanied
    // polyphony is this cluster's whole definition"), and it now runs Aksum
    // 540 → Johannesburg 1939 → Leipzig 1725. Every name below is European
    // because every choir in the table was European the day it was typed. The
    // row is LEFT AS IT IS on purpose rather than patched with exceptions: it
    // is a statement of TASTE — what a choral record calls for — and it is the
    // era door in guestCast, reading each anchor's own year and instruments,
    // that decides which of these the record in hand may actually hire. For
    // Boston 1831 that is the organ and the fugue; for Aksum 540 it is nobody.
    vox:    ["gregorian", "counterpoint", "fugue", "drone", "vocal", "vocal"],
    // the floor's guest is a LINE, because the floor already has everything
    // else: a topline over it, a pad under it, an acid riff across it
    club:   ["vocal", "vocal", "pad", "pad", "riff", "drone", "backing"],
    // "and the horns come in" — plus the thing the census will never show you,
    // which is three people singing behind the one who is singing
    soul:   ["backing", "backing", "vocal", "riff", "neoclassical", "pad"],
    groove: ["vocal", "riff", "pad", "backing", "simple", "drone"],
    band:   ["riff", "riff", "backing", "vocal", "pad", "simple"],
    // the studio records are where a genuinely foreign element belongs: the
    // string quartet on a pop single is `counterpoint`, and it is the most
    // Beatles thing in the table
    studio: ["backing", "vocal", "counterpoint", "pad", "riff", "neoclassical"],
    drift:  ["pad", "pad", "drone", "gregorian", "vocal", "neoclassical"],
    roots:  ["vocal", "backing", "simple", "riff", "neoclassical", "pad"],
    // a part hosting a part: the pad under the solo, the second voice against
    // the first. Not another style — two parts is an ensemble, a part plus a
    // style is a backing track, and this genre IS the part.
    parts:  ["pad", "drone", "backing", "counterpoint", "vocal", "simple"],
  };
  // A SONG HAS A GUEST, NOT A ROTATING CAST. Drawn ONCE, at the top, and used
  // all record long — because the musical event is the string quartet COMING
  // BACK, and a different foreign genre in every section is not an arrangement,
  // it is a shuffle. Two names, not one: the primary is who is on the record,
  // and the secondary is saved for the peak, where a colour arriving for the
  // first time in the last chorus is the oldest trick in pop.
  //
  // A genre may not guest on itself (a `pad` record does not book a pad), and
  // where the filter leaves one name the song has one guest, which is fine.
  //
  // ...and the SINGER is not a guest either, so the pool loses that name too.
  // The record's own voice turning up as its own visitor would stack `vocal`
  // twice in one chorus, which is one line played by two people.
  function guestCast(G, gk, rG, singer) {
    // AN UNACCOMPANIED RECORD HIRES NOBODY — the answer to "what is the guest
    // pool for a choir that sings alone", and it is NO POOL rather than a
    // narrower one. A group singing unaccompanied IS the style; a visitor is
    // the one thing it cannot have and stay itself. This is why zema and mbube
    // are not special cases here: the predicate reads `kit`, `nobass` and
    // `instr` off the anchor and finds all five records the catalog describes
    // that way, and the two that were named in the complaint fall out of it.
    if (unaccompanied(gk)) return null;
    const year = genreYear(gk);
    // THE ERA LAW, APPLIED TO THE ROOM. The family lean stays what it always
    // was — a PRODUCER'S PREFERENCE, "the club genres call a topline, a soul
    // record calls backing vocals" — and it is right about taste and silent
    // about time, which is how `vox` came to offer Leipzig 1725 to Aksum 540.
    // It was not a wrong list so much as a list written when every choir in
    // the table was European; the anchors have since stopped being. So the
    // lean proposes and the RECORD'S OWN YEAR disposes, and where a lean is
    // entirely inadmissible the song has no guest, which the caller already
    // handles because a filtered-empty pool was always reachable.
    // AN INSTRUMENTAL RECORD BOOKS NO SINGING GUESTS (Paul, on the staged
    // acid: "the lead should be 303, not vocal! Watch out for that across
    // genres") — the INSTRUMENTAL table already says these records have no
    // singer, and a vocal arriving as a guest was the same wrong lead
    // through the side door.
    const pool = (GUEST_LEAN[G.family] || GUEST_LEAN.kernel)
      .filter(w => w !== gk && w !== singer)
      .filter(w => !(INSTRUMENTAL[gk] && (w === "vocal" || w === "backing")))
      .filter(w => eraOK(year, w, gk));
    if (!pool.length) return null;
    const a = pick(rG, pool);
    const rest = pool.filter(w => w !== a);
    return { a, b: rest.length ? pick(rG, rest) : a };
  }

  // ---- SECTIONAL FX --------------------------------------------------------
  // "When you generate a song and there are global effects apply them globally
  // not per module." The other half of that sentence is what per-box fx are
  // FOR once the master exists: the section that genuinely departs. Three roles
  // qualify and the other eight get nothing — the bridge that goes underwater,
  // the breakdown (which already had one), and the pedal the soloist steps on.
  // A phaser on every box is not a production decision, it is a wash.
  const AWAY_FX = {                                  // the bridge leaves the room
    kernel: ["phaser", "chorus", "sweep"],
    vox:    ["chorus", "phaser", "sweep"],
    club:   ["sweep", "phaser", "ringmod", "flanger"],
    soul:   ["leslie", "phaser", "tremolo", "chorus"],
    groove: ["echo", "phaser", "sweep", "flanger"],
    band:   ["flanger", "phaser", "tremolo", "leslie"],
    studio: ["leslie", "chorus", "phaser", "flanger"],
    drift:  ["chorus", "sweep", "flanger", "echo"],
    roots:  ["tremolo", "chorus", "leslie", "phaser"],
    parts:  ["chorus", "echo", "phaser", "tremolo"],
  };
  const SOLO_FX = {                                  // and what the soloist steps on
    kernel: ["echo", "wah"], vox: ["chorus", "echo"], club: ["fenv", "wah", "echo"],
    soul:   ["wah", "leslie", "echo"], groove: ["echo", "wah", "phaser"],
    band:   ["crunch", "wah", "echo"], studio: ["leslie", "echo", "chorus"],
    drift:  ["echo", "chorus"], roots: ["tremolo", "echo"], parts: ["echo", "chorus"],
  };
  // ...and it is APPENDED, never assigned: a genre that carries `fx` on the
  // anchor is carrying its own sound (sludge played clean is not sludge), so
  // the section's departure joins that chain rather than deleting it — and
  // stops at the registry's own MAX_FX rather than being sliced by the loader.
  //
  // WHICH THE BREAKDOWN WAS NOT DOING. It is the one section that already had
  // an effect, and it wrote `b.fx = [one]` — deleting the anchor's chain, so a
  // dub or techno breakdown was the only bar of the record where the genre's
  // own sound came off. It goes through addFx now like everything else.
  const addFx = (b, k) => {
    if (b.fx.length < NF.MAX_FX && !b.fx.includes(k)) b.fx.push(k);
  };
  const dress = (b, S, G, table, p) => {
    if (chance(S.dress, p)) addFx(b, pick(S.dress, table[G.family] || table.kernel));
  };

  // ---- THE MASTER BUS: dressing the whole record ---------------------------
  // The composer used to hand back a song with `master` UNSET — every composed
  // record in every genre landed on the same default chain (glue at −22/2.2,
  // the brickwall at −1.5) because that is what absent means, and absent was
  // all it ever said. A record is MASTERED, and which way is a fact about the
  // genre: tape and glue on a soul record, a room on a choir, a ceiling on a
  // club track, wow and flutter on vaporwave.
  //
  // BALLOTS, per family, exactly like the intro and fill leans, and read in
  // fields.js MASTER's own order so the saved key order is the registry's. A
  // `null` vote is the knob LEFT ALONE — which is how restraint is written
  // here. Measured across the table at forty seeds: a mean of 4.5 globals move
  // and the rest stay at the desk's defaults, because a master with every knob
  // turned is not a master, it is a preset demo. Exactly one anchor asks for
  // the whole desk (shoegaze, whose row below adds drive to a family that
  // already spends space, width, tape, tilt, glue and ceiling) and that is the
  // genre it should be.
  //
  // A BALLOT WITH NO NULL IN IT IS A PROMISE, and the gate reads it as one:
  // soul always tapes, club always ceilings, drift and vox always carry a room,
  // a band always drives the bus. Those are the four "family-appropriate"
  // claims worth being held to; the rest is weather.
  const MASTER_LEAN = {
    // the zero of the table gets the desk it already had, said out loud
    // the zero of the table gets the desk it already had, said out loud — plus
    // a room, which is NOT decoration: `glue`/`open` ARE the stock chain under
    // their own names (fields.js GLUEDFLT/CEILDFLT), so a row that could draw
    // only those would resolve to exactly what absent resolves to, and the
    // composer would be right back to shipping an unmastered record with a
    // master key on it. Every row below therefore carries at least one ballot
    // that always moves something; the gate checks that structurally.
    kernel: { glue: ["glue", "glue", "soft"], space: ["touch", "touch", "room"],
              ceiling: ["open", "open", "safe"] },
    // voices in a building: the room IS the record, and nothing else is being
    // done to them
    vox:    { space: ["hall", "hall", "cavern", "room"], glue: ["soft", "soft", "glue"],
              width: ["wide", "wide", "huge", null], tilt: [null, "clear", "warm", null],
              ceiling: ["open", "open", "safe"] },
    // the floor is LOUD, and loud is a ceiling rather than a fader. Almost no
    // room — a club record's space is the club.
    club:   { ceiling: ["loud", "loud", "louder", "safe"],
              glue: ["pump", "pump", "tight", "squash"],
              drive: ["hair", "warm", null, null], tilt: ["bright", "clear", null, "clear"],
              width: ["wide", "wide", "huge", null], space: [null, null, "touch", null] },
    soul:   { tape: ["tape", "tape", "warm", "worn"], glue: ["glue", "glue", "tight", "soft"],
              tilt: ["warm", "warm", null, "clear"], space: ["room", "touch", null, "room"],
              ceiling: ["safe", "safe", "open", "loud"] },
    // a groove record is a SPACE record — the echo chamber is an instrument in
    // every one of these traditions, and in dub it is the lead
    groove: { space: ["room", "hall", "hall", "cavern"], glue: ["glue", "glue", "soft"],
              tape: ["tape", "warm", null, "worn"], tilt: ["warm", "dark", null, "clear"],
              ceiling: ["open", "safe", "safe"] },
    band:   { drive: ["warm", "dirt", "warm", "hair"], glue: ["tight", "glue", "tight", "pump"],
              ceiling: ["loud", "safe", "loud", "open"], tilt: ["clear", null, "bright", "warm"],
              space: ["room", "room", "touch", null] },
    // the clean end: a studio record is EDITED, not squashed, so the glue
    // ballot deliberately excludes the two settings that pump
    studio: { glue: ["soft", "glue", "soft", "tight"], tape: ["warm", "tape", null, "warm"],
              tilt: ["clear", "bright", "clear", "warm"], width: ["wide", null, "wide", "huge"],
              space: ["touch", "room", "room", null], ceiling: ["safe", "open", "safe"] },
    drift:  { space: ["hall", "cavern", "hall", "cavern"], width: ["wide", "huge", "huge", "wide"],
              tape: ["warm", "worn", null, "tape"], tilt: ["dark", "warm", "dark", null],
              glue: ["soft", "soft", "glue"], ceiling: ["open", "open", "safe"] },
    roots:  { tape: ["warm", "tape", "warm", "worn"], space: ["room", "room", "hall", "touch"],
              glue: ["soft", "glue", "glue"], tilt: ["warm", null, "clear", "warm"],
              ceiling: ["open", "safe", "safe"] },
    // A LONE PART IS NOT A RECORD and must not be mastered like one: a room to
    // stand in, the gentlest glue, and no ceiling work at all — there is one
    // line here and nothing for a limiter to be fighting.
    parts:  { space: ["room", "touch", "hall", "room"], glue: ["soft", "soft", "glue"],
              tilt: [null, "clear", null, "warm"], ceiling: ["open", "open", "safe"] },
  };
  // THE HANDFUL WHOSE MASTER IS THE SOUND. Same shape as the family rows and
  // read on top of them, key by key — the genres.js DYNAMICS/DYN_FAMILY split
  // one tier down, for its reason: temperament is a fact about a cluster first
  // and about the anchor second, and the exceptions are the ones that matter.
  // Vaporwave is a tape being played back; dub is an echo chamber; sludge and
  // death metal are the two ends of what a distorted bus sounds like.
  // ...WIDENED 2026-08-18 ("The drums are always kind of the same, the
  // synths always sound kind of the same. We've lost the sense of true pro
  // mixing per genre, those signature sounds"). Twenty-five records whose
  // MASTERING is part of their name, each row the character a mastering
  // engineer of that idiom would reach for: the SP-1200's dark squash on
  // boom bap, the pumped glue of a house record, Rudy Van Gelder's soft
  // hand on a jazz date, the Motown tape-and-brightness, dnb's loud clean
  // ceiling. Same ballot machinery as the family rows — a couple of options
  // per knob keeps seed-to-seed weather, but the CHARACTER is fixed by the
  // row, which is the whole point.
  const MASTER_GENRE = {
    vaporwave: { tape: ["wow", "wow", "worn"], space: ["hall", "cavern"],
                 tilt: ["dark", "dark", "warm"], ceiling: ["open"] },
    boombap:   { glue: ["squash", "pump", "squash"], tape: ["warm", "worn"],
                 tilt: ["dark", "dark", "warm"], drive: ["hair", "warm"],
                 // dry on purpose — and it keeps shoegaze the ONE genre that
                 // turns every knob (the full-desk gate's own law)
                 space: [null], width: [null] },
    trap:      { ceiling: ["louder", "louder", "loud"], glue: ["tight", "pump"],
                 tilt: ["bright", "clear"], space: ["touch", null] },
    jazz:      { glue: ["soft", "soft", "glue"], space: ["room", "room", "hall"],
                 tape: ["warm", "tape"], ceiling: ["open", "open", "safe"] },
    motown:    { tape: ["tape", "tape", "warm"], glue: ["glue", "tight"],
                 tilt: ["bright", "clear"], space: ["room", "touch"] },
    disco:     { glue: ["pump", "pump", "glue"], space: ["room", "hall"],
                 ceiling: ["loud", "loud", "safe"], tilt: ["bright", null] },
    funk:      { glue: ["tight", "tight", "pump"], drive: ["hair", "warm"],
                 space: ["touch", "room"], ceiling: ["loud", "safe"] },
    dnb:       { glue: ["pump", "squash"], ceiling: ["louder", "louder", "loud"],
                 tilt: ["bright", "clear"], space: ["touch", null] },
    bigbeat:   { drive: ["dirt", "dirt", "warm"], glue: ["squash", "pump"],
                 ceiling: ["louder", "loud"], tilt: ["bright", null] },
    ambient:   { glue: ["soft", "soft"], space: ["cavern", "hall", "cavern"],
                 ceiling: ["open", "open"], tape: ["warm", null] },
    gospel:    { space: ["hall", "hall", "room"], glue: ["soft", "glue"],
                 tape: ["warm", "tape"], ceiling: ["open", "safe"] },
    acid:      { glue: ["pump", "pump", "tight"], drive: ["hair", "warm"],
                 ceiling: ["loud", "louder"], space: ["touch", null] },
    house:     { glue: ["pump", "pump", "glue"], space: ["touch", "room"],
                 ceiling: ["loud", "loud", "louder"], tilt: [null, "bright"] },
    rnb:       { glue: ["glue", "glue", "soft"], tilt: ["warm", "warm", "clear"],
                 space: ["room", "room", "touch"], tape: ["warm", "warm", "tape"] },
    punk:      { drive: ["dirt", "dirt", "hair"], glue: ["tight", "pump"],
                 ceiling: ["loud", "loud"], space: [null, "touch"] },
    kraftwerk: { glue: ["tight", "tight"], space: ["touch", "touch", "room"],
                 tilt: ["clear", "clear", "bright"], width: ["wide", "wide", "huge"] },
    bossa:     { glue: ["soft", "soft"], tape: ["warm", "warm", "tape"],
                 space: ["room", "room", "touch"], ceiling: ["open", "safe"] },
    reggae:    { glue: ["glue", "soft"], tape: ["warm", "worn"],
                 tilt: ["warm", "dark"], space: ["room", "hall"] },
    motorik:   { glue: ["tight", "tight", "glue"], space: ["touch", "room"],
                 tilt: ["clear", null], ceiling: ["safe", "open"] },
    doowop:    { space: ["room", "hall", "room"], tape: ["tape", "tape", "warm"],
                 glue: ["soft", "glue"], tilt: ["warm", null] },
    garage:    { glue: ["pump", "tight"], ceiling: ["loud", "loud", "safe"],
                 tilt: ["bright", null], space: ["touch", "room"] },
    ebm:       { glue: ["tight", "squash"], drive: ["warm", "dirt"],
                 ceiling: ["loud", "louder"], tilt: ["clear", "bright"] },
    bleeptechno: { glue: ["tight", "pump"], space: ["touch", "touch", "room"],
                 tilt: ["clear", "dark"], ceiling: ["safe", "loud"] },
    citypop:   { glue: ["soft", "glue"], tape: ["warm", "tape"],
                 tilt: ["bright", "clear"], width: ["wide", "wide"], space: ["room", null] },
    dub:       { space: ["cavern", "cavern", "hall"], tape: ["worn", "tape"],
                 tilt: ["dark", "warm"] },
    shoegaze:  { width: ["huge", "huge", "wide"], space: ["cavern", "hall"],
                 drive: ["warm", "dirt", "hair"] },
    postrock:  { space: ["hall", "cavern", "hall"], ceiling: ["loud", "safe", "loud"] },
    sludge:    { drive: ["crush", "dirt", "crush"], tilt: ["dark", "dark", "warm"],
                 glue: ["squash", "pump", "tight"] },
    deathmetal:{ drive: ["dirt", "crush"], ceiling: ["louder", "loud"],
                 tilt: ["bright", "clear"] },
    techno:    { ceiling: ["louder", "loud", "louder"], glue: ["pump", "squash", "pump"] },
    gregorian: { space: ["cavern", "cavern", "hall"], width: ["huge", "wide"] },
  };
  function masterOf(G, gk, rM) {
    const fam = MASTER_LEAN[G.family] || MASTER_LEAN.kernel, own = MASTER_GENRE[gk];
    const out = {};
    for (const f of NF.MASTER) {
      const ballot = (own && own[f.key]) || fam[f.key];
      if (!ballot) continue;
      const v = pick(rM, ballot);
      if (v != null) out[f.key] = v;
    }
    return Object.keys(out).length ? out : null;
  }

  // ---- BENDING THE LENGTHS -------------------------------------------------
  // The four gestures of BENDS, placed. It runs over the finished song rather
  // than inside build() because every one of them is a fact about a section's
  // NEIGHBOURS — what it points at, whether it has been round before, whether
  // it is the peak — and build() sees one box at a time.
  //
  // ONE DRAW PER SECTION, always spent, whatever the branch: the same law the
  // guest coin follows, and for the same reason. A stream whose position
  // depends on which gesture was eligible would reshuffle every record in the
  // table the next time one of these probabilities is edited.
  function bendLengths(song, G, rB) {
    const square = !!SQUARE[G.family];
    let peak = -1;
    song.forEach((b, i) => {
      const w = sectionWord(b);
      if (w === "chorus" || w === "drop") peak = i;
    });
    let seenVerse = false;
    for (let i = 0; i < song.length; i++) {
      const b = song[i], w = sectionWord(b);
      const roll = rB();
      const skip = BEDS[b.role] || w === "intro" || w === "outro";
      const nx = song[i + 1] && sectionWord(song[i + 1]);
      let bend = null, p = 0;
      if (skip) { /* a bed and the two ends of the record keep their shape */ }
      else if ((w === "prechorus" || w === "build") && (nx === "chorus" || nx === "drop"))
        { bend = "early"; p = 0.4; }
      else if (i === peak) { bend = "long"; p = 0.35; }
      else if (w === "verse" && seenVerse) { bend = "short"; p = 0.3; }
      else if ((w === "chorus" || w === "solo") && nx === "verse")
        { bend = "turn"; p = 0.3; }
      if (w === "verse") seenVerse = true;
      if (square || !bend || roll >= p) continue;
      const len = b.len + BENDS[bend];
      if (len < 2 || len > NF.MAX_LEN) continue;
      b.len = len;
      // the honest name, carried the way `cue` is — the loader passes unknown
      // keys through, the census counts by it, and the UX phase can label it
      b.bend = bend;
    }
  }

  // ---- THE STOP ------------------------------------------------------------
  // "There are no stops. Nothing in a generated song ever stops — no 2-bar
  // break, no full-band drop before the last chorus, no bar of silence, no
  // stop-time. Those are the moments a listener remembers."
  //
  // The vocabulary is REUSED whole, not extended: `drop` is the envelope that
  // silences the last eighth of a section (kernel.js envelope — "the oldest
  // trick in dance music and still the loudest: what you hear is the bar that
  // follows"), and cut / break / tail / hush are four of the ten outro edges
  // (kernel.js outro), which between them cover the band stopping a beat
  // early, the band dropping out under the drums, the drums dropping out under
  // the band, and the bar of silence with one cymbal on its last sixteenth.
  // Nothing new was added to either table, and being exact about what was
  // missing matters: `drop` had genuinely never been written by this file, but
  // cut / break / tail / hush were already on the OUTRO_LEAN fill ballots, so
  // the arranger did occasionally deal a hole — at random, on whichever section
  // the dice landed on, meaning nothing. A stop is not a vocabulary item, it is
  // a PLACEMENT: what was missing was an arranger with an opinion about where
  // one goes, and a guarantee that it goes there rather than somewhere else.
  //
  // WHERE THEY GO, in the order the policy tries them:
  //   the hole before the peak    the section immediately before the last
  //                               chorus or drop, at 0.7 — the loudest silence
  //                               in pop music, and the one the brief names.
  //   the end of the bridge       at 0.55: the bridge stops and the last
  //                               chorus walks in over the top of the stop.
  //   and one more, somewhere     at 0.18 on a verse, chorus or solo, so a
  //                               record can have a hole in it that is not
  //                               structural — stop-time in the second verse.
  //
  // THREE RESTRAINTS, and they are what keeps this a gesture rather than a
  // texture: never twice in adjacent sections; never the SAME KIND twice in
  // one record (a remembered moment that happens three times is a groove); and
  // never on a bed, an intro or the outro, because the record's own ending is
  // not a stop, it is the end.
  //
  // A KITLESS GENRE GETS THE TWO THAT ARE ABOUT THE BAND. `break` and `tail`
  // are defined by what the DRUMS do, so on a choir they are silent no-ops —
  // the same argument OUTRO_NOKIT already makes one table up. `drop` and `cut`
  // delete real events whoever is playing, so those are the two on that ballot.
  const STOPS = {
    // AND THE FILL COMES OFF WITH IT. `env` runs before `edges` (ui/derive.js
    // says why: the curve must see the section as written), so a section that
    // silenced its last eighth and then played its drum fill wrote the fill
    // straight back into the hole — measured, 17 events inside a hole that is
    // the whole point of the gesture. The hole IS the ending; nothing else
    // ends it.
    drop:  b => { b.env = "drop"; b.outro = null; },
    hush:  b => { b.outro = "hush"; },      // silence, then one cymbal on the last 16th
    cut:   b => { b.outro = "cut"; },       // everything stops a beat before the bar
    break: b => { b.outro = "break"; },     // the band drops out, the drums play the bar
    tail:  b => { b.outro = "tail"; },      // the drums drop out, the band plays it
  };
  const STOP_KIT   = { peak: ["drop", "hush", "cut"], bridge: ["break", "tail", "cut"],
                       loose: ["hush", "tail", "break"] };
  const STOP_NOKIT = { peak: ["drop", "cut"], bridge: ["cut", "drop"],
                       loose: ["cut", "drop"] };
  // A FILL MARKS A TURN INTO SOMETHING, NOT THE END OF A BAR COUNT. Measured
  // after the songwriter pass landed: 64% of sections ended with a gesture —
  // tomfill, crash, roll, hatrun — because six build() sites deal one and only
  // the stops pass ever took one away. A drummer who fills into everything is
  // a drummer nobody notices, which is the same complaint as no fills at all.
  //
  // So the gesture survives on the strength of WHAT FOLLOWS IT: always into
  // the peak (the arrival the whole record is for), usually out of a lift or a
  // bridge or a solo (the three places a band audibly hands over), seldom
  // between two verses, and never at the very end (the outro has its own
  // ending). It is a THINNING pass rather than six edited call sites, because
  // "what comes next" is exactly the fact build() cannot see — the same reason
  // bendLengths and placeStops are passes. Stops are placed after this and are
  // untouched by it: a hush is not a fill.
  const TURN_INTO = { chorus: 0.62, drop: 0.62, solo: 0.5, bridge: 0.5, outro: 0.3 };
  function thinFills(song, rF) {
    const peak = song.reduce((best, b, i) =>
      (b.role === "chorus" || b.role === "drop") ? i : best, -1);
    for (let i = 0; i < song.length; i++) {
      const b = song[i], next = song[i + 1];
      if (!b.outro) continue;
      if (!next) { b.outro = null; continue; }        // the outro ends itself
      // the run-up to the biggest arrival keeps its gesture, always
      if (i + 1 === peak) continue;
      const lead = b.cue === "prechorus" || b.cue === "build" ||
                   b.role === "bridge" || b.role === "solo";
      const p = (TURN_INTO[next.role] || 0.18) * (lead ? 1.35 : 1);
      if (!chance(rF, Math.min(0.9, p))) b.outro = null;
    }
  }
  function placeStops(song, G, rS) {
    const kit = Object.keys(G.kit || {}).length > 0;
    const T = kit ? STOP_KIT : STOP_NOKIT;
    let peak = -1;
    song.forEach((b, i) => {
      const w = sectionWord(b);
      if (w === "chorus" || w === "drop") peak = i;
    });
    const used = new Set();
    let last = -9;
    for (let i = 0; i < song.length; i++) {
      const b = song[i], w = sectionWord(b);
      const roll = rS(), draw = rS();          // two numbers a section, always spent
      if (BEDS[b.role] || w === "intro" || w === "outro" || i === peak) continue;
      let pool = null, p = 0;
      if (i === peak - 1) { pool = T.peak; p = 0.7; }
      else if (w === "bridge") { pool = T.bridge; p = 0.55; }
      else if (w === "verse" || w === "chorus" || w === "solo") { pool = T.loose; p = 0.18; }
      if (!pool || roll >= p || i - last < 2) continue;
      const free = pool.filter(k => !used.has(k));
      if (!free.length) continue;
      const k = free[Math.floor(draw * free.length) % free.length];
      used.add(k); last = i;
      STOPS[k](b);
      b.stop = k;                              // the honest name, like `cue` and `bend`
    }
  }

  // ---- AN EDGE IS A GESTURE, NOT A GAP -------------------------------------
  // "Often halfway through a section the whole tone of the song just changes
  // and there's a pause." Every edge in the vocabulary is defensible on its
  // own — a drop that opens on a hit, a section that ends by hushing, a
  // breakdown that fades back in — and the trouble is entirely arithmetic:
  // a ten-box record deals ten of them, so one lands every thirty seconds, and
  // a near-empty bar between two full ones does not read as production. It
  // reads as the machine stopping.
  //
  // Two of the three repairs are in the gestures themselves (kernel.js: a hit
  // costs a beat and not a bar, a hush thins and falls instead of emptying, a
  // crash lands the band's own chord rather than switching it off). The third
  // is a fact about POSITION, which no gesture can know, so it is a pass like
  // the other three — and this is the pass.
  //
  // THE THINNING EDGES, by name. A kind is on these lists if the bar it writes
  // has LESS in it than the bar before. `fill` / `roll` / `tomfill` / `hatrun`
  // / `doubles` are edges too and are deliberately absent: they put MORE in the
  // bar, and two busy bars either side of a bar line is a drummer, not a hole.
  const THIN_OUT = { hush: 1, cut: 1, break: 1, tail: 1, crash: 1 };
  const THIN_IN = { hit: 1, count: 1, kit: 1, riser: 1, padin: 1, bassin: 1,
                    stabs: 1, solo: 1, swell: 1, fade: 1 };
  // ...and the two envelopes that start AT SILENCE. Every other shape in
  // kernel.js SHAPES has a floor you can hear; these two are fades, and a fade
  // is a thing a RECORD does at its ends, not a thing a section does in the
  // middle of one. The replacements are the same gesture with a floor — `in`
  // wants "arriving over what came before", which is `cresc` (0.5 climbing past
  // 1.1), and `out` wants "leaving", which is `dim`. A hushed breakdown still
  // has something moving through it.
  const FADE_ENV = { in: "cresc", out: "dim" };
  // the sections that ARE the record's ends: the opening run (the beds and the
  // head the intro pass wrote) and the closing run. `in` and `out` are theirs.
  const isHead = b => BEDS[b.role] || b.role === "intro";
  function easeEdges(song) {
    let head = 0, tail = song.length;
    while (head < song.length && isHead(song[head])) head++;
    while (tail > head && song[tail - 1].role === "outro") tail--;
    for (let i = 0; i < song.length; i++) {
      const b = song[i];
      // (a) a fade from silence, anywhere but the record's own ends
      if (FADE_ENV[b.env] && i >= head && i < tail) b.env = FADE_ENV[b.env];
      if (!i) continue;
      // (b) NO TWO EDGES BACK TO BACK, and the ending owns the seam. A verse
      // that stops on a hush has already said "something is about to change";
      // the drop then opening on a bare cymbal says it twice, with the bar
      // line in between, and what the ear gets is one long hole with a crash
      // in the middle of it. So the incoming section arrives WHOLE. It is the
      // ending that keeps its gesture because the ending was placed by a pass
      // that already reasoned about what follows it (thinFills, placeStops),
      // and undoing that work here would be two passes arguing.
      const p = song[i - 1];
      if (THIN_IN[b.intro] && (THIN_OUT[p.outro] || p.env === "drop" || p.env === "stutter"))
        b.intro = null;
      // ...and the same law inside ONE box: a section too short to put two
      // full bars between its edges is a section with one edge.
      if (THIN_IN[b.intro] && THIN_OUT[b.outro] && (b.len || 0) < 4) b.intro = null;
    }
  }

  // ---- the whole song ------------------------------------------------------
  function compose(gk, seed) {
    if (!GENRES[gk]) gk = "simple";
    const r = rng(seed == null ? 1 : seed), G = GENRES[gk];
    const kit = Object.keys(G.kit || {}).length > 0;
    // eight kinds of material, and every one of them is USED — a song that
    // fills three slots and leaves five blank has not composed anything, it
    // has made a phrase. The bank is sized to WHAT THE SONG NEEDS: exactly
    // these eight, no blank padding. The bank is variable now (1..NSLOTS,
    // song.js), so the old pad-to-the-registry loop would just ship inert
    // blanks a person then has to scroll past on the rail.
    // slot 5 is the TOPLINE — the chorus's own melody, written as a hook-kind
    // phrase (motif, breath, climax) in a singable span. It replaced "busy",
    // which was the one slot that was texture rather than material.
    //
    // AND SLOT 8 IS THE SAME TUNE, DEVELOPING — the line the singer takes
    // through the verses. It is written from the topline's own first half
    // (phrase(), the `head` argument) and answers it differently, so a record
    // has ONE melody with two continuations rather than a verse tune and a
    // chorus tune that have never met. That is what makes the voice a
    // through-line rather than a part that happens to be present twice, and it
    // is checkable: the two phrases render the same first half bar, note for
    // note, and diverge after it. Written LAST, so the eight that were here
    // before still draw the numbers they always drew.
    const slots = [phrase(r, "hook"), phrase(r, "answer"), phrase(r, "riff"),
                   phrase(r, "counter"), phrase(r, "pad"), phrase(r, "topline"),
                   phrase(r, "sparse"), phrase(r, "climb")];
    slots.push(phrase(r, "topline", slots[5]));
    // ...AND SLOT 9, MACHINES ONLY: the two-bar sequencer line (seqPhrase
    // above), dealt LAST and from its OWN genre-salted stream, so every
    // other genre's record — and every draw the nine slots above make — is
    // byte-identical to before this slot existed.
    const MACHINE_SEQ = { acid: 32, techno: 32, house: 32, bleeptechno: 32, ebm: 32 };
    const seqSteps = MACHINE_SEQ[gk] || 0;
    if (seqSteps)
      slots.push(seqPhrase(rng(ihash(gk + "/seq/" + (seed == null ? 1 : seed))), seqSteps));
    const S = { hook: 0, answer: 1, riff: 2, counter: 3, pad: 4,
                topline: 5, sparse: 6, climb: 7, verseline: 8,
                seq: seqSteps ? 9 : null,
                // the sixteen-bar law's own stream (the policy below), on the
                // same law as every stream here: retuning how a long section
                // evolves must not move a drum, a guest or a bar line
                evo: rng(ihash(gk + "/evolve/" + (seed == null ? 1 : seed))),
                // THE DRUM DECISIONS GET THEIR OWN, GENRE-SALTED STREAM, for
                // the reason the intro chooser needed one: the phrase bank
                // consumes the same number of draws whatever the genre, so a
                // chooser reading the shared stream sits at the same position
                // for every genre and the whole table ends its verses the same
                // way at any fixed seed. Still pure, still a function of
                // (gk, seed) — the same FNV-1a salt introSections uses.
                out: rng(ihash(gk + "/drums/" + (seed == null ? 1 : seed))),
                // ...and one each for the two decisions this stage added, on
                // the same law and for the same reason. They are SEPARATE
                // streams rather than one "arranging" stream because they are
                // separate policies: retuning how often a bridge goes
                // underwater must not re-cast the record's guest, and
                // re-casting the guest must not move a single effect.
                gst: rng(ihash(gk + "/guest/" + (seed == null ? 1 : seed))),
                dress: rng(ihash(gk + "/dress/" + (seed == null ? 1 : seed))),
                // ...and three more, on the same law: the voice's placement,
                // the irregular lengths and the stops are three separate
                // policies, so retuning where the singer sings must not move a
                // bar line, and moving a bar line must not move a hole.
                voc: rng(ihash(gk + "/voice/" + (seed == null ? 1 : seed))),
                bend: rng(ihash(gk + "/bend/" + (seed == null ? 1 : seed))),
                stop: rng(ihash(gk + "/stop/" + (seed == null ? 1 : seed))),
                // its own stream, like every other pass: thinning the fills
                // must not shift the dice the stops or the bends are drawing
                fill: rng(ihash(gk + "/thin/" + (seed == null ? 1 : seed))),
                groove: kit ? pick(r, [null, "backbeat", "push", "laidback", "funk", "dub"]) : null,
                swing: kit && chance(r, 0.3) ? pick(r, ["light", "swing", "shuffle"]) : null };
    // WHO IS ON THE RECORD, decided once, before a section exists — the singer
    // and the guest both, and the singer FIRST because the guest pool is
    // filtered of whoever is already on the payroll (guestCast).
    S.singer = singerOf(G, gk);
    S.guest = guestCast(G, gk, S.gst, S.singer);
    // THE SONG'S KEY (fields.js KEYS carries the law). genres.js declares no
    // tonic — every anchor is written in scale DEGREES, so there is nothing to
    // read off it — and until now that meant every composed record landed on
    // the same unlabelled pitch class, "why is everything A minor". `S.tonic`
    // is DERIVED instead: deterministic off the genre's own name, the same
    // FNV-1a salt every other genre-scoped stream in this file already keys
    // on, so two different genres reliably land on two different keys and one
    // genre always opens in the same one — a fact about the record, not a
    // coin toss, and stable across seeds the way BPM and PLAN_OF are. Not
    // salted by seed: skeleton() (below, per box) stamps it on every section
    // by default, and build()'s bridge/peak-chorus branches are the only
    // places that move off it — that IS the modulation, drawn on the seeded
    // stream like everything else a section decides.
    S.tonic = (ihash(gk + "/key") % 12) - 6;
    // NO SILENT DEFAULTS, and the law is EXPLICIT now instead of an accident
    // of table shape. Every genre must carry a plan and a tempo ON ITS ANCHOR
    // — the old `|| "song"` / `|| 120` fallbacks meant a new genre arranged
    // like pop at 120 and every gate passed, and the keyed tables that
    // replaced them could still rot to `undefined` for a genre added without
    // a row. Reading the anchor and throwing BY NAME means a genre added
    // without the fields dies the moment anyone presses WRITE, saying which
    // genre and which field — not `Cannot read properties of undefined`.
    const plan = PLANS[G.plan];
    if (!plan)
      throw new Error(`compose: genre "${gk}" declares no plan ` +
                      `(plan: "dance"|"song"|"arc" on its GENRES row)`);
    const bpm0 = G.bpm;
    if (!Number.isInteger(bpm0) || bpm0 < 70 || bpm0 > 160)
      throw new Error(`compose: genre "${gk}" declares no bpm ` +
                      `(bpm: an integer 70..160 on its GENRES row)`);
    const xs = arcOf(plan, !!STEADY[gk]);
    const ord = ordinals(plan);
    // THE ONE CHORUS THE SOLOIST VISITS, or none — drawn here, before a section
    // exists, for the reason the cast is: "one section, maybe a chorus" is a
    // fact about the record, and a per-chorus coin would put a lead break in
    // two of the three.
    {
      const peakAt = Math.max(plan.lastIndexOf("chorus"), plan.lastIndexOf("drop"));
      const spare = plan.map((w, i) => (w === "chorus" && i !== peakAt ? i : -1))
        .filter(i => i > 0);
      S.visit = spare.length && chance(S.out, 0.35) ? pick(S.out, spare) : -1;
    }
    // the plan's own "intro" is replaced by however this song decided to begin,
    // which may be one section or three
    const song = [...introSections(G, gk, r, S,
                                   rng(ihash(gk + "/" + (seed == null ? 1 : seed)))),
                  ...plan.slice(1).map((role, i) =>
                    build(role, G, gk, r, S,
                          { x: xs[i + 1], next: xs[i + 2], peak: xs[i + 1] === 1,
                            i: i + 1, again: ord[i + 1] }))];
    // ---- THE FOUR PASSES OVER THE FINISHED RECORD ---------------------------
    // Each of them is a fact about a section's NEIGHBOURS, which is exactly
    // what build() cannot see, and the ORDER between them is load-bearing:
    // lengths first (a bend changes nothing else), then the stops (which write
    // the one env value that is a hole rather than a size), then the seams —
    // which must see the stops placed to know where the record's holes already
    // are — and then the dynamics ladder, which must see BOTH so it treats
    // `drop` as a value that is taken and spreads the fades easeEdges turned
    // back into sizes.
    bendLengths(song, G, S.bend);
    // THE SIXTEEN-BAR LAW ("We shouldn't have 16-bar measures unless they
    // evolve in significant ways", 2026-08-18). AFTER the bends, because a
    // bend can stretch a section past sixteen and a law that ran inside
    // build() missed exactly those. A section keeps sixteen bars only by
    // SPENDING them on a long arc the ear can ride — a period sentence (the
    // notes evolve bar to bar), a motion arc or a filter automation (the mix
    // evolves) — and nearly half the time it draws a SECOND device of a
    // different kind, because one sweep over sixteen static bars is a
    // gesture, not an evolution. A section that draws the short straw gives
    // the length back instead. One unconditional draw-set per section (the
    // stream-position law), on the song's own /evolve stream.
    // ...and the ERA LAW binds the devices too: a motion arc and a cutoff
    // automation are FILTER moves (FX_YEAR's own 1964), so a record from
    // before them evolves in its NOTES — the period sentence — or gives the
    // length back. A 1570 motet with a filter sweep is the 1932 delay again.
    const evYear = genreYear(gk);
    const evArcOK = !evYear || evYear >= FX_YEAR.sweep;
    // ...and the law does not impose on the THROUGH-COMPOSED forms (pre-1900:
    // the motet, the fugue, the hymn) — their long sections evolve by
    // construction (subject entries, verses), and an imposed period sentence
    // measured as pushing spem INTO counterpoint on the confusion matrix:
    // homogenization wearing evolution's name.
    const evImpose = !evYear || evYear >= 1900;
    // ...AND THE ARC POINTS AT THE FORM (the tension/release read, 2026-08-19,
    // measured on acid seed 1: a DROP drew mot:close — a tension device spent
    // on the release section). The device kind stays the stream's draw; the
    // DIRECTION is the form's: a drop opens (the release), the section before
    // a drop closes (the tension into it), and only a section pointing at
    // nothing keeps the drawn coin.
    for (let bi = 0; bi < song.length; bi++) {
      const b = song[bi];
      const evDev0 = pick(S.evo, ["period", "period", "mot", "auto", "short"]);
      const evPer = pick(S.evo, ["4bar", "4bar", "2bar"]);
      const evArcDrawn = pick(S.evo, ["open", "close"]);
      const evTwo = chance(S.evo, 0.45);
      const evDev = evArcOK ? evDev0
        : (evDev0 === "mot" || evDev0 === "auto" ? "period" : evDev0);
      if (!evImpose) continue;
      if ((b.len || 0) < 16 || b.period || b.mot || (b.auto && b.auto.length)) continue;
      const next = song[bi + 1];
      const evArc = b.role === "drop" ? "open"
        : (next && next.role === "drop") ? "close" : evArcDrawn;
      if (evDev === "short") b.len = halfLen(G);
      else {
        if (evDev === "period") b.period = evPer;
        else if (evDev === "mot") b.mot = evArc;
        else b.auto = [NF.autoShape("cutoff", evArc, b.len * 4 / G.rate)];
        if (evTwo && evArcOK) { if (evDev === "period") b.mot = evArc; else b.period = evPer; }
      }
    }
    thinFills(song, S.fill);
    placeStops(song, G, S.stop);
    easeEdges(song);
    if (!STEADY[gk]) spreadDynamics(song);
    // NO SECTION RESTATES ITS NEIGHBOUR. Two drops in a row (the dance plan
    // has them on purpose) must be two different bars of music, not one bar
    // twice with two labels — so a repeated role is FORCED apart with an
    // operator, never left to the dice.
    for (let i = 1; i < song.length; i++) {
      const p2 = song[i - 1], b2 = song[i];
      if (b2.role !== p2.role || b2.cue !== p2.cue || BEDS[b2.role]) continue;
      const add = (b2.ops || []).includes("rot2") ? "rot3" : "rot2";
      b2.ops = [...(b2.ops || []), add];
    }
    return { v: NS.VERSION, slots, song,
             // AND THE RECORD IS MASTERED. Its own genre-salted stream, like
             // every other ballot here — a song-level decision drawn before any
             // section could have moved the position.
             master: masterOf(G, gk, rng(ihash(gk + "/master/" + (seed == null ? 1 : seed)))),
             // THE GROOVE IS A SONG FACT, like the tempo two lines down: one
             // drummer for the record, drawn once (S.groove, up with the cast)
             // and written HERE rather than stamped on every box.
             groove: S.groove,
             // ...AND SO IS THE SWING (the same move made twice): one feel for
             // the record, drawn once up with the cast, written HERE rather
             // than stamped on every box.
             swing: S.swing,
             bpm: Math.max(70, Math.min(160, bpm0 + Math.floor(r() * 9) - 4)),
             vol: 80 };
  }

  const api = { compose, ROLES, BEDS, PLANS, PLAN_OF, BPM, ALIAS, arcOf, dynOf, rng, phrase,
                INTRO_LEAN, INTRO_NOKIT, introEdge, SOLO_LEAN, LAYERABLE, partSlot, PARTS5,
                GUEST_LEAN, guestCast, AWAY_FX, SOLO_FX, MASTER_LEAN, MASTER_GENRE, masterOf,
                // the five tables and three helpers this round added, exported
                // for the gate the same way every other ballot is: a policy the
                // suite cannot read is a policy the suite can only measure
                // indirectly, and then it fails for the wrong reason
                SECTION_BARS, SQUARE, BENDS, fullLen, halfLen,
                STOPS, STOP_KIT, STOP_NOKIT, STEADY, DYNLADDER, spreadDynamics, sectionWord,
                // the seam pass and its two lists, exported for the same reason
                // the stop tables are: a policy the suite cannot read is a
                // policy the suite can only measure indirectly
                THIN_IN, THIN_OUT, FADE_ENV, easeEdges,
                SINGS, INSTRUMENTAL, SINGER_GENRE, singerOf, ordinals,
                // ...and the era-of-players tables (2026-08-25), exported on
                // the same law as every other ballot above: a policy the suite
                // cannot read is a policy the suite can only measure
                // indirectly, and the precompose gate now holds every anchor's
                // whole cast against THESE rather than against a grep of the
                // catalog, which was only ever a proxy for them.
                genreYear, instrOf, INSTR_YEAR, SUNG, kindOf, kindsOf, seatOK,
                eraOK, unaccompanied,
                castOf, soloCast,
                // ...and the SALT itself (2026-08-24, D5). Every genre-scoped
                // stream in this file is `rng(ihash(gk + "/" + policy + "/" +
                // seed))`, and precompose.js needs its own stream on that same
                // law — one that cannot move a bar line here. It asks for the
                // hash rather than copying the eight lines of FNV-1a, because
                // two copies of a hash is two hashes the day one of them is
                // tuned. `rng` was already out; `ihash` was the half that
                // was not.
                ihash };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuCompose = api;
})(typeof window !== "undefined" ? window : globalThis);

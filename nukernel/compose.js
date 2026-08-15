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
  function arcOf(words) {
    const peak = Math.max(words.lastIndexOf("chorus"), words.lastIndexOf("drop"));
    const V = { intro: 0.3, verse: 0.5, prechorus: 0.62, build: 0.58, chorus: 0.82,
                drop: 0.85, breakdown: 0.3, bridge: 0.45, solo: 0.7, outro: 0.25 };
    return words.map((w, i) => (i === peak ? 1 : (V[w] == null ? 0.5 : V[w])));
  }
  const PLAN_OF = {
    acid: "dance", vaporwave: "dance", newwave: "dance",
    rock: "song", blues: "song", sludge: "song", simple: "song",
    fugue: "arc", counterpoint: "arc", gregorian: "arc", spem: "arc",
    bulgarian: "arc", neoclassical: "arc", drone: "arc",
    // a tango is an arc and not a pop song; death metal, soul and the
    // Eurythmics all are songs, but the last one is a DANCE record first —
    // "Sweet Dreams" has a drop where a bridge would be
    tango: "arc", deathmetal: "song", isley: "song", eurythmics: "dance",
    // post rock is an arc by construction — it is one crescendo — and the four
    // studio records are songs, because that is what they are
    postrock: "arc", toto: "song", jodeci: "song", beatles: "song", steely: "song",
    // THE RADIO DIAL. The floor genres are dance records — they build and
    // drop, they do not bridge. The pop half are songs, verse-chorus by
    // birthright. Afrobeat and ambient are arcs: one is a groove you stay
    // inside while the horns arrive, the other is one long breath.
    boombap: "song", trap: "dance", house: "dance", garage: "dance",
    dnb: "dance", disco: "dance", techno: "dance", dub: "dance",
    funk: "song", motown: "song", rnb: "song", gospel: "song",
    reggae: "song", ska: "song", bossa: "song", countrypop: "song",
    synthpop: "song", shoegaze: "song", citypop: "song", punk: "song",
    afrobeat: "arc", ambient: "arc",
  };
  // Where a genre wants to sit, in bpm. The tempo control tops out at 160 and
  // bottoms at 70, and a composer that leaves everything at 126 has not arranged
  // anything — half of what "sounds like sludge" means is the tempo.
  const BPM = { acid: 130, vaporwave: 88, newwave: 138, rock: 132, blues: 104,
                sludge: 74, simple: 112, fugue: 108, counterpoint: 100,
                gregorian: 76, spem: 80, bulgarian: 96, neoclassical: 86, drone: 70,
                // 126 is not a guess: it is the tempo of "Sweet Dreams"
                tango: 118, deathmetal: 158, eurythmics: 126, isley: 96,
                toto: 92, jodeci: 74, beatles: 124, steely: 100, postrock: 72,
                // the dial tops out at 160, so dnb and punk sit ON the fence
                // rather than past it — the kit density says the rest
                boombap: 92, trap: 140, house: 122, garage: 132, dnb: 160,
                disco: 118, funk: 100, motown: 122, rnb: 72, gospel: 76,
                reggae: 76, dub: 74, ska: 156, afrobeat: 108, bossa: 132,
                countrypop: 120, synthpop: 118, shoegaze: 104, citypop: 108,
                punk: 160, ambient: 70, techno: 132 };

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
  function phrase(r, kind) {
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
  // seeds the chain (sludge played clean is not sludge).
  const skeleton = (role, G, gk) =>
    Object.assign(NS.skeleton(gk, role), { fx: G.fx ? [...G.fx] : [] });

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
  const INTRO_LEAN = {
    kernel: ["cold", "count", "solo", "padin", "fade", "hit", "stabs", "swell", "riser"],
    vox:    ["solo", "solo", "padin", "padin", "fade", "fade", "swell", "stabs", "cold"],
    drift:  ["padin", "padin", "padin", "fade", "fade", "solo", "swell", "stabs", "cold"],
    club:   ["riser", "riser", "riser", "kit", "kit", "cold", "cold", "drums", "fade"],
    band:   ["cold", "cold", "cold", "hit", "hit", "count", "count", "kit", "stabs"],
    studio: ["cold", "cold", "stabs", "stabs", "padin", "fade", "hit", "kit", "count"],
    soul:   ["bassin", "bassin", "bassin", "stabs", "stabs", "drumbass", "hit", "count", "padin"],
    groove: ["bassin", "bassin", "stabs", "stabs", "count", "drums", "hit", "solo", "drumbass"],
    roots:  ["count", "count", "solo", "solo", "cold", "hit", "bassin", "swell", "stabs"],
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
      const b = skeleton("intro", G, gk);
      b.len = n; b.stack[0].slots = [];            // no phrase: kit and bass only
      b.groove = S.groove; b.swing = S.swing;
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
    if (kind === "cold") {
      // THE COLD OPEN: the whole band from beat one, playing real material —
      // the hook itself, or the riff under the pad. Everything build() holds
      // back for an arrival (the fade, the pulled level, the thinned kit)
      // comes off, because the not-arriving is the gesture.
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

  function build(role, G, gk, r, S, a) {
    const kit = Object.keys(G.kit || {}).length > 0;   // does this genre have drums at all
    const bars = G.bars;
    const peak = !!(a && a.peak);                       // the arc's 1.0 — the last chorus/drop
    const b = skeleton(ALIAS[role] || role, G, gk);
    if (ALIAS[role]) b.cue = role;                      // the honest name, kept for the UX phase
    const layer = (g2, slots) => b.stack.push({ g: g2, slots });
    // A genre with named progressions deals a DIFFERENT one per role — the
    // verse and the chorus finally disagree about harmony. The key is a name
    // into NuGenres.PROGS; it rides the save as data (the loader carries
    // unknown keys) and the render path picks it up when the section learns
    // to override the genre's prog.
    if (G.progFamily && G.progFamily[role]) b.prog = G.progFamily[role];

    if (role === "intro") {
      b.stack[0].slots = chance(r, 0.5) ? [S.pad] : [S.pad, S.sparse];
      b.env = "in"; b.lvl = "back"; b.rev = "wet";
      b.len = Math.max(2, Math.floor(bars / 2));
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
      b.stack[0].slots = pick(r, [[S.hook], [S.hook, S.answer],
                                  [S.hook, S.riff], [S.answer, S.counter]]);
      if (kit) b.bassop = pick(r, ["walk", "octaves", null, null]);
      if (chance(r, 0.35)) b.ops = [pick(r, ["rot4", "gat4", "pit4", "rev"])];
      // A VERSE VARIES ITS DRUMS TOO. It used to be the one role that never
      // touched the kit — every verse in every song was the anchor's bar
      // restated — and a ghost snare or a ride is exactly the small change
      // that makes verse 2 not verse 1.
      if (kit && chance(r, 0.4)) b.kit = kitOf(S, G);
      if (chance(r, 0.3)) b.outro = fillOf(S, G, kit);
    } else if (role === "prechorus") {
      // THE LIFT. Everything here points forward: the answer phrase (not the
      // hook — the hook is being saved), the kit filling in, a riser, a fade
      // up, and a snare roll into the downbeat. The cadence is the
      // anticipation — the last bar borrows the dominant's door so the chorus
      // is an ARRIVAL rather than the next thing that happens.
      b.stack[0].slots = chance(r, 0.5) ? [S.answer] : [S.answer, S.sparse];
      b.lvl = "back"; b.env = "in"; b.mot = "rise";
      if (kit) { b.kit = chance(r, 0.5) ? "busy" : kitOf(S, G); b.outro = fillOf(S, G, kit, LIFT); }
      // only where there is a progression for the dominant to be a door INTO
      // (the same guard the bridge carries) — on a modal genre the cadence
      // has no prog to land on and the render path correctly drops it
      if (G.progFamily || G.prog || (G.harmony === "cycle" && G.roots))
        b.cadence = { d: 4, q: "dom7" };
      b.len = Math.max(2, Math.floor(bars / 2));
    } else if (role === "build") {
      // the dance floor's prechorus: same gesture, different clothes —
      // a thinned phrase under a riser, everything held back for the drop
      b.stack[0].slots = chance(r, 0.5) ? [S.sparse] : [S.climb];
      b.lvl = "back"; b.env = "in"; b.mot = "rise"; b.echo = "touch";
      if (kit) { b.kit = chance(r, 0.5) ? "busy" : "nokick"; b.outro = fillOf(S, G, kit, LIFT); }
      b.len = Math.max(2, Math.floor(bars / 2));
    } else if (role === "chorus") {
      // THE CHORUS HAS ITS OWN MELODY — the topline, written for it, instead
      // of a re-deal of the verse's hook. The hook may come back as the third
      // line, which is a counter-hook, not a substitute.
      b.stack[0].slots = chance(r, 0.55) ? [S.topline, S.counter]
                                         : [S.topline, S.counter, S.hook];
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
      // the truck-driver modulation, the most recognizable radio gesture there is.
      if (peak) {
        layer(pick(r, LAYERABLE), [S.counter]);
        if (chance(r, 0.4)) b.key = 2;
      } else if (chance(r, 0.45)) layer(pick(r, LAYERABLE), [S.counter]);
    } else if (role === "bridge") {
      b.stack[0].slots = chance(r, 0.5) ? [S.counter] : [S.counter, S.sparse];
      b.mode = pick(r, ["dorian", "phrygian", "harmonic", "mixo"]);
      b.ops = [pick(r, ["inv", "rev", "rot3", "gateflip"])];
      b.period = "2bar";                      // a two-bar period: the bridge sways
      if (G.progFamily || G.prog) b.cadence = { d: 4, q: "dom7" };
      if (kit) b.kit = pick(r, ["shift", "halftime", "swap", "onthree", "linear", "tomtime"]);
      b.mot = chance(r, 0.4) ? "close" : null;
      b.outro = fillOf(S, G, kit);
    } else if (role === "breakdown") {
      b.stack[0].slots = [S.sparse];
      b.len = Math.max(2, Math.floor(bars / 2));
      b.lvl = "hush"; b.rev = "drown"; b.echo = "some";
      if (kit) b.kit = pick(r, ["nokick", "nodrums", "snareonly", "soft", "stickside", "h.half"]);
      b.fx = [pick(r, ["sweep", "echo", "phaser"])];
      b.mot = "rise"; b.env = "in";
      b.outro = pick(r, [fillOf(S, G, kit, LIFT), "cut"]);
    } else if (role === "drop") {
      b.stack[0].slots = [S.riff, S.climb];
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
    } else if (role === "solo") {
      b.stack[0].slots = chance(r, 0.5) ? [S.climb] : [S.climb, S.riff];
      b.ops = [pick(r, ["rep3", "rep4", "wide"])];
      b.vox = { cut: "bright", res: "hot", emod: "mid", dec: "short" };
      b.lvl = "fwd"; b.echo = "touch";
      if (kit) b.kit = chance(r, 0.5) ? "busy" : kitOf(S, G);
      b.outro = fillOf(S, G, kit);
    } else {                                            // outro
      b.stack[0].slots = chance(r, 0.6) ? [S.pad] : [S.pad, S.riff];
      b.env = "out"; b.rev = "wet"; b.mot = "close";
      b.len = Math.max(2, Math.floor(bars / 2));
      // the last bar of the record: a crash more often than not, but a tom
      // fill or a bar of silence with a cymbal in it is also how a song ends
      if (kit) { b.kit = "sparse"; b.outro = pick(r, ["crash", "crash", fillOf(S, G, kit)]); }
    }
    // ONE GROOVE FOR THE WHOLE SONG, decided once by the caller and stamped on
    // every box. A groove that changed per section would not be a groove, it
    // would be several drummers.
    b.groove = S.groove; b.swing = S.swing;
    b.fx = b.fx.filter(Boolean);
    return b;
  }
  // the genres worth stacking UNDER something else — a line, no drums of its
  // own, and NO `prog`: the render path hands a layer the authority's roots
  // but not its progression, so a prog-carrying layer would follow its own
  // chords against the box's — half the band in a different song. The gate
  // holds this list prog-free until the layer path learns to inherit prog.
  const LAYERABLE = ["fugue", "counterpoint", "gregorian", "simple", "drone", "neoclassical"];

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
    const slots = [phrase(r, "hook"), phrase(r, "answer"), phrase(r, "riff"),
                   phrase(r, "counter"), phrase(r, "pad"), phrase(r, "topline"),
                   phrase(r, "sparse"), phrase(r, "climb")];
    const S = { hook: 0, answer: 1, riff: 2, counter: 3, pad: 4,
                topline: 5, sparse: 6, climb: 7,
                // THE DRUM DECISIONS GET THEIR OWN, GENRE-SALTED STREAM, for
                // the reason the intro chooser needed one: the phrase bank
                // consumes the same number of draws whatever the genre, so a
                // chooser reading the shared stream sits at the same position
                // for every genre and the whole table ends its verses the same
                // way at any fixed seed. Still pure, still a function of
                // (gk, seed) — the same FNV-1a salt introSections uses.
                out: rng(ihash(gk + "/drums/" + (seed == null ? 1 : seed))),
                groove: kit ? pick(r, [null, "backbeat", "push", "laidback", "funk", "dub"]) : null,
                swing: kit && chance(r, 0.3) ? pick(r, ["light", "swing", "shuffle"]) : null };
    // NO SILENT DEFAULTS. Every genre must carry a plan and a tempo — the old
    // `|| "song"` / `|| 120` fallbacks meant a new genre arranged like pop at
    // 120 and every gate passed. The coverage gate in test/unit/nukernel.test.js
    // fails loudly on a missing entry instead.
    const plan = PLANS[PLAN_OF[gk]];
    const xs = arcOf(plan);
    // the plan's own "intro" is replaced by however this song decided to begin,
    // which may be one section or three
    const song = [...introSections(G, gk, r, S,
                                   rng(ihash(gk + "/" + (seed == null ? 1 : seed)))),
                  ...plan.slice(1).map((role, i) =>
                    build(role, G, gk, r, S, { x: xs[i + 1], peak: xs[i + 1] === 1 }))];
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
             bpm: Math.max(70, Math.min(160, BPM[gk] + Math.floor(r() * 9) - 4)),
             vol: 80 };
  }

  const api = { compose, ROLES, BEDS, PLANS, PLAN_OF, BPM, ALIAS, arcOf, rng, phrase,
                INTRO_LEAN, INTRO_NOKIT, introEdge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuCompose = api;
})(typeof window !== "undefined" ? window : globalThis);

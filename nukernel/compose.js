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
    if (x >= 0.8) return "big";                               // the arrival sits up
    if (nx - x >= 0.15) return x <= 0.4 ? "cresc" : "lift";   // pointed at something bigger
    if (x - nx >= 0.25) return "dim";                         // coming down off it
    if (x <= 0.55) return "soft";                             // and the small parts are small
    return "arch";                                            // everything else breathes
  };
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
    // THE FUNCTION GENRES arrange as ARCS, every one of them, and it is not a
    // shrug. A part on its own has no verse and no chorus — there is nothing
    // for it to be the chorus OF — so what is left is one shape with a peak,
    // which is what an unaccompanied line is. (They are written to be STACKED;
    // a solo composing its own record is the degenerate case, and the plan
    // should say so rather than pretend it is a pop song.)
    solo: "arc", vocal: "arc", backing: "arc", riff: "arc", pad: "arc",
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
                punk: 160, ambient: 70, techno: 132,
                // the parts, at the tempo the part itself implies: a solo is
                // played over an up record, a singer is slower than the band
                // behind them, a riff is a mid-tempo thing and a pad has
                // nowhere to be
                solo: 128, vocal: 96, backing: 84, riff: 112, pad: 74 };

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
  const castOf = G => SOLO_LEAN[G.family] || SOLO_LEAN.kernel;
  // ...MINUS THE ONE PART A SOLO SECTION CANNOT BE. Backing vocals BACK
  // something, and a solo section is precisely the place where the thing they
  // would be backing has stopped playing. It is filtered at this call site
  // rather than kept off the ballot, because the chorus — which is where a
  // backing part belongs — wants it.
  const soloCast = G => castOf(G).filter(w => w !== "backing");
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
  // The three kit operators that write a LEVEL onto every lane rather than
  // rearranging which lanes fire — the only ones whose dynamics survive the
  // melody being taken away. See the solo break below for why that matters.
  const BREAK_KIT = ["accents", "accents", "crescendo", "loud"];

  function build(role, G, gk, r, S, a) {
    const kit = Object.keys(G.kit || {}).length > 0;   // does this genre have drums at all
    const bars = G.bars;
    const peak = !!(a && a.peak);                       // the arc's 1.0 — the last chorus/drop
    const b = skeleton(ALIAS[role] || role, G, gk);
    if (ALIAS[role]) b.cue = role;                      // the honest name, kept for the UX phase
    const layer = (g2, slots) => b.stack.push({ g: g2, slots });
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
      // A PAD GENRE UNDER A VERSE, now and then — and it is the pad PHRASE
      // whoever the guest is, because a verse's guest is a bed. The singer who
      // guests here is holding an "ooh" behind the line, not taking the tune
      // off it; that happens in the chorus, which is where it belongs.
      guest(0.22, [S.pad]);
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
      // AND SOMEBODY SINGS IT. Where the family has a singer on its ballot, the
      // topline moves OFF the band and onto a `vocal` layer, and the host keeps
      // the parts — which is what a record is. The band still leads with the
      // topline's own material where the layer is instrumental (a chorus is the
      // hook, whoever is playing it); only a SINGER takes the tune away, because
      // a chorus sung by the guitar player AND the singer in unison is one line
      // twice. "The odd chorus" gets the soloist instead — the answer between
      // the lines, which is the other thing that happens in a chorus.
      const cast = castOf(G);
      const who = cast.length && chance(r, 0.5) ? pick(S.out, cast) : null;
      if (sings(who)) {
        b.stack[0].slots = chance(r, 0.55) ? [S.counter] : [S.counter, S.hook];
        layer(who, [S.topline]);
      } else if (who) layer(who, [partSlot(who, S)]);
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
      //
      // WHO the guest is stopped being a uniform draw over LAYERABLE here: the
      // pool is the family's own ballot and the name was chosen once for the
      // record (guestCast). The peak gets the SECOND name — a colour that has
      // not been heard yet, arriving in the last chorus, which is the oldest
      // gesture in pop and the one place this file allows two guests in a box.
      if (peak) {
        guest(1, [S.counter], S.guest && S.guest.b);
        if (chance(r, 0.4)) b.key = 2;
      } else guest(0.45, [S.counter]);
    } else if (role === "bridge") {
      b.stack[0].slots = chance(r, 0.5) ? [S.counter] : [S.counter, S.sparse];
      b.mode = pick(r, ["dorian", "phrygian", "harmonic", "mixo"]);
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
    } else if (role === "breakdown") {
      b.stack[0].slots = [S.sparse];
      b.len = Math.max(2, Math.floor(bars / 2));
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
      const cast = soloCast(G);
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
      b.len = Math.max(2, Math.floor(bars / 2));
      // the last bar of the record: a crash more often than not, but a tom
      // fill or a bar of silence with a cymbal in it is also how a song ends
      if (kit) { b.kit = "sparse"; b.outro = pick(r, ["crash", "crash", fillOf(S, G, kit)]); }
    }
    // ONE GROOVE FOR THE WHOLE SONG, decided once by the caller and stamped on
    // every box. A groove that changed per section would not be a groove, it
    // would be several drummers.
    b.groove = S.groove; b.swing = S.swing;
    // THE ARC, SPENT. Where the role has not already claimed the field with a
    // fade of its own, the section gets the dynamic its place in the song asks
    // for — which is what makes the last chorus bigger than the first verse
    // without either of them being told what a chorus or a verse is.
    if (!b.env) b.env = dynOf(a);
    b.fx = b.fx.filter(Boolean);
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
  const GUEST_LEAN = {
    kernel: ["pad", "vocal", "riff", "counterpoint", "solo", "drone"],
    // a choir's guest is another choir — the answering voice, the organ under
    // it, the cantor over the top
    vox:    ["gregorian", "counterpoint", "fugue", "drone", "vocal", "vocal"],
    // the floor's guest is a LINE, because the floor already has everything
    // else: a topline over it, a pad under it, an acid riff across it
    club:   ["vocal", "vocal", "pad", "pad", "riff", "solo", "drone"],
    // "and the horns come in" — plus the thing the census will never show you,
    // which is three people singing behind the one who is singing
    soul:   ["backing", "backing", "vocal", "riff", "solo", "pad"],
    groove: ["vocal", "riff", "pad", "backing", "solo", "drone"],
    band:   ["solo", "solo", "riff", "vocal", "backing", "simple"],
    // the studio records are where a genuinely foreign element belongs: the
    // string quartet on a pop single is `counterpoint`, and it is the most
    // Beatles thing in the table
    studio: ["backing", "vocal", "counterpoint", "pad", "solo", "neoclassical"],
    drift:  ["pad", "pad", "drone", "gregorian", "vocal", "neoclassical"],
    roots:  ["vocal", "backing", "solo", "riff", "neoclassical", "pad"],
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
  function guestCast(G, gk, rG) {
    const pool = (GUEST_LEAN[G.family] || GUEST_LEAN.kernel).filter(w => w !== gk);
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
  const MASTER_GENRE = {
    vaporwave: { tape: ["wow", "wow", "worn"], space: ["hall", "cavern"],
                 tilt: ["dark", "dark", "warm"], ceiling: ["open"] },
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
                // ...and one each for the two decisions this stage added, on
                // the same law and for the same reason. They are SEPARATE
                // streams rather than one "arranging" stream because they are
                // separate policies: retuning how often a bridge goes
                // underwater must not re-cast the record's guest, and
                // re-casting the guest must not move a single effect.
                gst: rng(ihash(gk + "/guest/" + (seed == null ? 1 : seed))),
                dress: rng(ihash(gk + "/dress/" + (seed == null ? 1 : seed))),
                groove: kit ? pick(r, [null, "backbeat", "push", "laidback", "funk", "dub"]) : null,
                swing: kit && chance(r, 0.3) ? pick(r, ["light", "swing", "shuffle"]) : null };
    // WHO IS ON THE RECORD, decided once, before a section exists — see
    // guestCast: the musical event is the guest coming BACK, and a cast drawn
    // per section is a shuffle rather than an arrangement.
    S.guest = guestCast(G, gk, S.gst);
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
                    build(role, G, gk, r, S,
                          { x: xs[i + 1], next: xs[i + 2], peak: xs[i + 1] === 1 }))];
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
             bpm: Math.max(70, Math.min(160, BPM[gk] + Math.floor(r() * 9) - 4)),
             vol: 80 };
  }

  const api = { compose, ROLES, BEDS, PLANS, PLAN_OF, BPM, ALIAS, arcOf, dynOf, rng, phrase,
                INTRO_LEAN, INTRO_NOKIT, introEdge, SOLO_LEAN, LAYERABLE, partSlot, PARTS5,
                GUEST_LEAN, guestCast, AWAY_FX, SOLO_FX, MASTER_LEAN, MASTER_GENRE, masterOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuCompose = api;
})(typeof window !== "undefined" ? window : globalThis);

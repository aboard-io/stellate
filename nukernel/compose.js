// compose.js — the ARRANGER. One button, one whole song.
//
// Kept out of kernel-daw.js for the same reason genres.js is kept out of
// kernel.js: this is a POLICY, and the UI should not have opinions. It is pure —
// (genre, rnd) in, a song object out, no DOM and no audio — so the node gate can
// compose a thousand songs and check every one, which is the only way to know
// that a generator that runs once per click is not producing rubbish nine times
// in ten. Loads after genres.js, before kernel-daw.js (see kernel-daw.html).
//
// WHAT IT EMITS is exactly the shape Save writes and Load reads, so it goes
// through applyState — the same validate-and-apply path as a file off somebody's
// desktop. The composer gets no privileged entrance. If it ever emits a song the
// loader would reject, the loader rejects it, and that is the correct outcome
// rather than a special case.
(function (root) {
  "use strict";
  const NG = (typeof module !== "undefined" && module.exports)
    ? require("./genres.js") : root.NuGenres;
  const { GENRES } = NG;

  // ---- SECTION ROLES -------------------------------------------------------
  // A role is a NAME, not a transform: setting a box to "chorus" does not
  // reach in and change the drums. That would be a nasty surprise — you would
  // relabel a section and lose the mix you had built on it. What the role does
  // is tell the composer what to BUILD, and tell you what you are looking at
  // afterwards. It is the arrangement's vocabulary, and vocabulary is exactly
  // what a row of eleven identical grey boxes was missing.
  const ROLES = { drums: "drums", bass: "bass", groove: "groove",
                  intro: "intro", verse: "verse", chorus: "chorus",
                  bridge: "bridge", breakdown: "breakdown", drop: "drop",
                  solo: "solo", outro: "outro" };
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
    song:  ["intro", "verse", "chorus", "verse", "chorus", "bridge", "solo", "chorus", "outro"],
    dance: ["intro", "verse", "drop", "breakdown", "verse", "drop", "drop", "outro"],
    arc:   ["intro", "verse", "verse", "bridge", "chorus", "solo", "verse", "outro"],
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
  };
  // Where a genre wants to sit, in bpm. The tempo control tops out at 160 and
  // bottoms at 70, and a composer that leaves everything at 126 has not arranged
  // anything — half of what "sounds like sludge" means is the tempo.
  const BPM = { acid: 130, vaporwave: 88, newwave: 138, rock: 132, blues: 104,
                sludge: 74, simple: 112, fugue: 108, counterpoint: 100,
                gregorian: 76, spem: 80, bulgarian: 96, neoclassical: 86, drone: 70,
                // 126 is not a guess: it is the tempo of "Sweet Dreams"
                tango: 118, deathmetal: 158, eurythmics: 126, isley: 96,
                toto: 92, jodeci: 74, beatles: 124, steely: 100, postrock: 72 };

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
  const blank = () => ({ deg: z(), oct: z(), vel: new Array(16).fill(5),
                         inc: z(), stk: z(), gate: z(), acc: z(), sld: z() });

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
                pad: 0.05, busy: 0.9, sparse: 0.0, climb: 0.7 }[kind];
    p.gate = rhythm(r, D, kind === "counter" || kind === "busy");
    if (kind === "pad") { p.gate = z(); p.gate[0] = 1; if (chance(r, 0.5)) p.gate[8] = 1; }
    if (kind === "sparse") { p.gate = z(); p.gate[0] = 1; p.gate[pick(r, [6, 8, 10, 12])] = 1; }
    const span = kind === "riff" ? 3 : kind === "pad" ? 2 : kind === "climb" ? 6 : 5;
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
    p.gate[0] = 1;
    return p;
  }

  // ---- the arrangement -----------------------------------------------------
  // One function per role, each answering the same question — what is different
  // about this section — and each allowed to say "nothing much", which is what
  // makes a verse a verse.
  const skeleton = (role, G, gk) => ({
    stack: [{ g: gk, slots: [] }], len: G.bars, nudge: 0, ops: [], env: null,
    mode: null, rate: null, scale: null, kit: null, drumkit: null,
    bassop: null, clamp: null, cmode: null, artic: null, fx: G.fx ? [...G.fx] : [],
    rev: null, del: null, verb: null, dtime: null, lvl: null, pan: null,
    mot: null, intro: null, outro: null, swing: null, groove: null, role,
  });

  // ---- HOW A SONG STARTS ---------------------------------------------------
  // FOUR BARS OF DRUMS, THEN THE BASS COMES IN, THEN THE TUNE. That is how a
  // record starts, and it is not a fade — it is an ARRANGEMENT: one section per
  // layer arriving, which is precisely why it could not be an `intro` edge on a
  // single box. Edges rewrite one bar; this is three sections.
  //
  // It falls out of something the engine already did. A box with no phrase still
  // renders its kit and its bass, because both are GENRE data rather than phrase
  // data — so "drums alone" is a section with no phrase and no bass, "bass
  // alone" is one with no phrase and no kit, and "drums and bass" is one with no
  // phrase at all. Nothing new had to be built to say any of it.
  const INTROS = ["soft", "soft", "hit", "count", "drums", "drums", "drumbass",
                  "drumbass", "bassin"];
  function introSections(G, gk, r, S) {
    const kit = Object.keys(G.kit || {}).length > 0;
    // A genre with no drums has nothing to bring in one layer at a time, so it
    // gets the one intro that is about the sound rather than the arrangement.
    const shape = kit ? pick(r, INTROS) : "soft";
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
    if (shape === "drums" || shape === "drumbass")
      out.push(bed({ role: "drums", bassop: "nobass",
                     intro: chance(r, 0.4) ? "hit" : null }));
    if (shape === "bassin") out.push(bed({ role: "bass", kit: "nodrums" }));
    if (shape === "drumbass" || shape === "bassin")
      out.push(bed({ role: "groove", outro: chance(r, 0.6) ? "fill" : null }));
    // ...and then the section that actually introduces the tune
    const head = build("intro", G, gk, r, S);
    if (shape === "count") head.intro = "count";
    else if (shape === "hit") head.intro = "hit";
    else if (out.length) {
      // the bed already did the arriving, so this one just plays
      head.env = null; head.lvl = null; head.intro = null;
      if (kit) head.kit = null;
    }
    out.push(head);
    return out;
  }

  function build(role, G, gk, r, S) {
    const kit = Object.keys(G.kit || {}).length > 0;   // does this genre have drums at all
    const bars = G.bars;
    const b = skeleton(role, G, gk);
    const layer = (g2, slots) => b.stack.push({ g: g2, slots });

    if (role === "intro") {
      b.stack[0].slots = chance(r, 0.5) ? [S.pad] : [S.pad, S.sparse];
      b.env = "in"; b.lvl = "back"; b.rev = "wet";
      b.len = Math.max(2, Math.floor(bars / 2));
      if (kit) { b.kit = chance(r, 0.5) ? "sparse" : "nodrums"; b.intro = pick(r, ["count", "hit"]); }
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
      if (chance(r, 0.3)) b.outro = "fill";
    } else if (role === "chorus") {
      b.stack[0].slots = chance(r, 0.55) ? [S.hook, S.counter] : [S.hook, S.counter, S.busy];
      b.lvl = "fwd"; b.rev = "some";
      if (kit) { b.kit = chance(r, 0.6) ? "busy" : null; b.bassop = pick(r, ["octaves", "eighths"]); }
      b.outro = pick(r, ["fill", "roll", "crash"]);
      // the chorus is where a second genre earns its place — one more line,
      // its own phrase, which is what the stack was built for
      if (chance(r, 0.45)) layer(pick(r, LAYERABLE), [S.counter]);
    } else if (role === "bridge") {
      b.stack[0].slots = chance(r, 0.5) ? [S.counter] : [S.counter, S.sparse];
      b.mode = pick(r, ["dorian", "phrygian", "harmonic", "mixo"]);
      b.ops = [pick(r, ["inv", "rev", "rot3", "gateflip"])];
      if (kit) b.kit = pick(r, ["shift", "halftime", "swap"]);
      b.mot = chance(r, 0.4) ? "close" : null;
      b.outro = "fill";
    } else if (role === "breakdown") {
      b.stack[0].slots = [S.sparse];
      b.len = Math.max(2, Math.floor(bars / 2));
      b.lvl = "hush"; b.rev = "drown"; b.del = "some";
      if (kit) b.kit = pick(r, ["nokick", "nodrums", "snareonly"]);
      b.fx = [pick(r, ["sweep", "echo", "phaser"])];
      b.mot = "rise"; b.env = "in";
      b.outro = pick(r, ["roll", "cut"]);
    } else if (role === "drop") {
      b.stack[0].slots = [S.riff, S.climb];
      b.lvl = "fwd";
      if (kit) { b.kit = chance(r, 0.5) ? "four" : null; b.bassop = pick(r, ["reese", "wobble", "eighths"]); }
      b.ops = [pick(r, ["rep2", "rep4", "rot2"])];
      b.del = chance(r, 0.4) ? "touch" : null;
      b.intro = chance(r, 0.4) ? "hit" : null;
    } else if (role === "solo") {
      b.stack[0].slots = chance(r, 0.5) ? [S.climb] : [S.climb, S.busy];
      b.ops = [pick(r, ["rep3", "rep4", "wide"])];
      b.vox = { cut: "bright", res: "hot", emod: "mid", dec: "short" };
      b.lvl = "fwd"; b.del = "touch";
      if (kit) b.kit = chance(r, 0.5) ? "busy" : null;
      b.outro = "fill";
    } else {                                            // outro
      b.stack[0].slots = chance(r, 0.6) ? [S.pad] : [S.pad, S.riff];
      b.env = "out"; b.rev = "wet"; b.mot = "close";
      b.len = Math.max(2, Math.floor(bars / 2));
      if (kit) { b.kit = "sparse"; b.outro = "crash"; }
    }
    // ONE GROOVE FOR THE WHOLE SONG, decided once by the caller and stamped on
    // every box. A groove that changed per section would not be a groove, it
    // would be several drummers.
    b.groove = S.groove; b.swing = S.swing;
    b.fx = b.fx.filter(Boolean);
    return b;
  }
  // the genres worth stacking UNDER something else — a line, no drums of its own
  const LAYERABLE = ["fugue", "counterpoint", "gregorian", "simple", "drone", "neoclassical"];

  // ---- the whole song ------------------------------------------------------
  function compose(gk, seed) {
    if (!GENRES[gk]) gk = "simple";
    const r = rng(seed == null ? 1 : seed), G = GENRES[gk];
    const kit = Object.keys(G.kit || {}).length > 0;
    // eight slots, and every one of them is USED — a song that fills three and
    // leaves five blank has not composed anything, it has made a phrase
    const slots = [phrase(r, "hook"), phrase(r, "answer"), phrase(r, "riff"),
                   phrase(r, "counter"), phrase(r, "pad"), phrase(r, "busy"),
                   phrase(r, "sparse"), phrase(r, "climb")];
    const S = { hook: 0, answer: 1, riff: 2, counter: 3, pad: 4,
                busy: 5, sparse: 6, climb: 7,
                groove: kit ? pick(r, [null, "backbeat", "push", "laidback", "funk", "dub"]) : null,
                swing: kit && chance(r, 0.3) ? pick(r, ["light", "swing", "shuffle"]) : null };
    const plan = PLANS[PLAN_OF[gk] || "song"];
    // the plan's own "intro" is replaced by however this song decided to begin,
    // which may be one section or three
    const song = [...introSections(G, gk, r, S),
                  ...plan.slice(1).map(role => build(role, G, gk, r, S))];
    return { v: 1, slots, song,
             bpm: Math.max(70, Math.min(160, (BPM[gk] || 120) + Math.floor(r() * 9) - 4)),
             vol: 80 };
  }

  const api = { compose, ROLES, BEDS, PLANS, PLAN_OF, BPM, rng, phrase };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuCompose = api;
})(typeof window !== "undefined" ? window : globalThis);

// song.js — persistence, pure. Classic UMD, node-loadable, zero DOM.
//
// The one shape every song takes — localStorage, a file off the desktop, a
// shipped preset, the composer — and the ONE validate-and-apply path they all
// go through. The composer gets no privileged entrance: if it emits a song the
// loader would refuse, the loader refuses it, and that is the correct outcome.
//
// The loader is deliberately paranoid. This shape has changed repeatedly, and
// a half-understood old save is worse than no save: it would restore a song
// that silently plays nothing. But paranoia now comes with a DIAGNOSIS —
// validateSong returns typed errors {path, got, want} instead of one boolean,
// because "that file failed" on a 40-box song is the worst possible failure
// mode once saves multiply.
//
// Validity is defined by fields.js, the registry — never by a UI label table.
// That is what let this file leave kernel-daw.js and be gated in pure node.
//
// Place in the layer graph: kernel -> genres -> fields -> THIS FILE ->
// instruments -> compose -> presets -> UI.
(function (root) {
  "use strict";
  const NF = (typeof module !== "undefined" && module.exports)
    ? require("./fields.js") : root.NuFields;
  const NG = (typeof module !== "undefined" && module.exports)
    ? require("./genres.js") : root.NuGenres;
  // the kernel is below this file in the layer graph (kernel -> genres ->
  // fields -> THIS FILE); partOf is the one algebra call the INSTR LIFT needs
  // — which chair a genre voice sits in is the kernel's own assignment
  const K = (typeof module !== "undefined" && module.exports)
    ? require("./kernel.js") : root.NuKernel;
  const { FIELDS, OPS, FX, MAX_FX, NSLOTS, MAX_LEN, MAX_NUDGE, VOX,
          AUTOPARAMS, PERIODS, PARTMIX, okPartKey, MASTER, BUSES, faderDb,
          eqDb, GROOVELABEL, SWINGLABEL, INSTRCHOICES, POOLCHAIRS,
          PARTNAMES } = NF;
  const { GENRES } = NG;

  // The CURRENT schema version. v:2 = v:1 with the box field `del` renamed to
  // `echo` (it collided with the kernel's delete operator) and slots allowed to
  // arrive at any length 1..NSLOTS. Variable banks did not need a v:3: the
  // SHAPE never moved — old 8-slot saves are just one legal length among
  // sixteen, and they load byte-identically. Neither did the per-part desk
  // (`box.parts`) nor the master bus (`song.master`): both are OPTIONAL keys
  // whose absence is the whole of the previous behaviour, so a v:2 save from
  // before either one loads and sounds identically and there is nothing to
  // migrate. A version bump is for a shape that MOVED, not one that grew.
  // (`song.buses` — the rack's return trims — is optional on the same terms.)
  // The GROOVE MOVE (box field -> song fact) did not need a v:3 either: the
  // retired box field is unmistakable — no new writer emits it — so migrate()
  // lifts on its presence, exactly the period-interregnum idiom below. The
  // SWING MOVE (2026-08-16, "nothing in a section tells time") is the same
  // move made twice, and takes the same presence-keyed lift — as does the
  // INSTR MOVE ("the band is hired for the record"): the per-layer `instr`
  // override lifts, per chair, into the song's one INSTRUMENT POOL.
  const VERSION = 2;

  // THE FILTER RULE, written down at last: `ops` and `fx` are FILTERED on
  // load, everything else is REJECTED. The operator and effect tables change
  // as the palette does, and a song should lose an obsolete chip rather than
  // lose itself — but an unknown *setting* (a send level, a kit name) means
  // the file is from somewhere this build cannot honestly play, so it errors.
  const FILTERED = { ops: true, fx: true };

  // ---- THE SESSION NAMESPACE ------------------------------------------------
  // A genre invented in the LAB gets a key of its own that the catalog can
  // never hold: the prefix is the collision law, and it is a construction
  // rather than a check — `sessionKey` still walks a suffix if two coined names
  // reduce to the same slug, because two "Sheffield 1989"s in one song are a
  // person's business, not a crash.
  //
  // A DOT, because it cannot occur in a catalog key (they are bare
  // identifiers) and because it reads as an address rather than as decoration:
  // `lab.sheffield1989` says where the genre came from every time it is
  // printed in a save, a share URL or an error path.
  const SESSION_NS = "lab.";
  const isSessionKey = k => typeof k === "string" && k.indexOf(SESSION_NS) === 0;
  // the slug: a coined name down to the letters and digits that survive being
  // typed anywhere. `taken` is anything already spoken for — the catalog is
  // checked here too even though the prefix makes it impossible, because the
  // day someone adds a `lab.` anchor by hand is the day this is the only thing
  // standing between them and a silently shadowed genre.
  function sessionKey(label, taken) {
    const has = k => Object.prototype.hasOwnProperty.call(GENRES, k) ||
      (taken && (Array.isArray(taken) ? taken.indexOf(k) >= 0
                                      : Object.prototype.hasOwnProperty.call(taken, k)));
    const base = SESSION_NS +
      (String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "") || "genre");
    let k = base, n = 2;
    while (has(k)) k = base + "_" + n++;
    return k;
  }
  // the bench holds three parents at most (nukernel/ui/lab.js MAX_PARENTS) and
  // a roll key is pressed by a finger, not a loop: both caps are here so a
  // hand-written file cannot ask the loader to rebuild a genre from a thousand
  // parents or walk a seed a billion strides on load.
  const MAX_PARENTS = 3, MAX_ROLLS = 9999;
  // what a box plays when the genre it names is gone — the same genre a new box
  // is born with, so the degrade lands on the one anchor that is always there
  const FALLBACK_GENRE = "simple";

  /* ---------- constructors ---------- */
  // A PHRASE'S LENGTH IS NOT SIXTEEN ANY MORE, it is 1..PHRASE_MAX ("phrases
  // may be up to 128 steps" — ui/editor.js's own +/- grows and shrinks one in
  // place, doubling/halving so the tracker pages or scrolls rather than
  // shrinking its cells to nothing). There is no separate length FIELD: the
  // length lives in the arrays themselves, the way it always has, and
  // okPhrase below reads it off them rather than assuming. z()/blank() still
  // default to sixteen — every existing caller writes `blank()` with no
  // argument (compose.js, the bank pad, an old save's padding) and sixteen is
  // still the right size for those; a caller that wants a different length
  // (ui/editor.js resizing the OPEN phrase) passes one.
  const PHRASE_MIN = 1, PHRASE_MAX = 128;
  const z = (n) => new Array(n || 16).fill(0);
  const blank = (n) => { n = n || 16;
    return { deg: z(n), oct: z(n), vel: new Array(n).fill(5),
             inc: z(n), stk: z(n), gate: z(n), acc: z(n), sld: z(n) }; };

  // A DRUM PHRASE is a phrase of the SECOND kind (kernel.js DRUM_LANES/DMARK):
  // a lane grid rather than a line, always sixteen steps (a step sequencer's
  // own length, not the melodic phrase's variable 1..PHRASE_MAX — there is no
  // grow/shrink control for this kind). One vector per lane, every lane
  // always present at all-zero (silent) rather than grown lazily the way
  // `orn` was — a drum phrase's whole reason to exist is its lane grid, so
  // there is no "phrase nobody ever marks" case to keep cheap the way a
  // melodic phrase's ninth vector was.
  const blankDrum = () => { const o = { kind: "drum", swing: 0 };
    for (const d of K.DRUM_LANES) o[d] = z(16);
    return o; };
  const isDrumPhrase = p => !!(p && p.kind === "drum");

  // A BOX CARRIES A STACK OF GENRES, not one. The FIRST is the authority: it
  // owns the harmony, the rate and the drums, and everything layered on top
  // inherits them. Each entry in the stack carries ITS OWN phrases. A BOX IS
  // ALSO A MIXER CHANNEL: `fx` is its insert chain, `rev`/`echo` its two
  // sends, `verb`/`dtime` which reverb and which echo subdivision it is sent
  // TO, `lvl`/`pan` where it sits, `mot` its filter automation. Those are the
  // SECTION-WIDE treatment; `parts` is the desk under it — the same controls
  // per chair (lead/pad/bass/drums…), so an effect can land on one thing.
  //
  // Every default below comes from the registry, so emptyBox() and the
  // composer's skeleton can never disagree again — they used to be two object
  // literals in two files, and that is how `clamp` ended up defaulted and read
  // but never written or validated.
  function skeleton(gk, role) {
    const b = { stack: [{ g: gk, slots: [] }] };
    for (const f of FIELDS) {
      // the five voice knobs live together under `vox`, absent until touched —
      // they inherit knob-by-knob, so a null-filled object would read as "set"
      if (f.type === "vox") continue;
      b[f.key] = f.type === "list" ? [] : f.default;
    }
    b.len = GENRES[gk].bars;
    b.role = role || null;
    return b;
  }
  // A new box is SIMPLE — the phrase played as written. There is no empty
  // state any more: a box always makes a sound as soon as it has a phrase,
  // and the genres are legible as what they add to that.
  const emptyBox = () => skeleton("simple", null);

  /* ---------- migration ---------- */
  // Keyed on v, not on shape-sniffing. Every older save climbs to the current
  // schema here, ONCE, so validation only ever sees one shape. Deep-copies its
  // input: a shipped preset must survive being loaded twice.
  function migrate(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const r = JSON.parse(JSON.stringify(raw));
    // THE PERIOD INTERREGNUM. For a few hours between the P2b and P4 commits,
    // composed saves carried the bar schedule as a raw op-list array riding
    // an unknown key. The registry now speaks preset names, and okEnum would
    // refuse the array — so a recognized array becomes its preset name and an
    // unrecognized one comes off, rather than one evening's saves dying.
    for (const b of Array.isArray(r.song) ? r.song : []) {
      if (b && Array.isArray(b.period)) {
        const s = JSON.stringify(b.period);
        const hit = Object.keys(PERIODS).find(k => JSON.stringify(PERIODS[k]) === s);
        if (hit) b.period = hit; else delete b.period;
      }
    }
    // THE GROOVE LIFT (2026-08-16, "the groove belongs to the song"). `groove`
    // was a box field through every earlier save; it is a song fact now, like
    // the tempo. Keyed on the PRESENCE of the retired field rather than on v —
    // the period-interregnum precedent above — because both v:1 and v:2 saves
    // carry it and a new save never does, so the lift is exact and idempotent.
    // A song whose sections disagreed (only a hand-edit could) adopts the
    // groove most sections agree on; ties go to the section nearest the top,
    // which is the authority the box's own stack rule already names.
    // ...AND THE SWING LIFT beside it (2026-08-16, "nothing in a section tells
    // time"): the same move made twice, so it is the same code run twice —
    // presence-keyed, majority wins, ties to the section nearest the top (the
    // authority), the box field dies on the way through.
    for (const key of ["groove", "swing"]) {
      if (!Array.isArray(r.song) || !r.song.some(b => b && b[key] !== undefined))
        continue;
      if (r[key] === undefined) {
        const count = new Map();
        for (const b of r.song) {
          if (!b || b[key] == null) continue;
          if (!count.has(b[key])) count.set(b[key], 0);
          count.set(b[key], count.get(b[key]) + 1);
        }
        let best = null, bestN = 0;               // Map iterates in insertion
        for (const [g2, n] of count)              // order, so a tie keeps the
          if (n > bestN) { best = g2; bestN = n; } // FIRST section's value
        r[key] = best;
      }
      for (const b of r.song) if (b) delete b[key];
    }
    // THE INSTR LIFT (2026-08-16, "the band is hired for the record"). For one
    // release a stack entry could carry `instr` — a per-layer override of what
    // that layer's voices play. The band is the SONG's now: one INSTRUMENT
    // POOL, one pick per CHAIR (fields.js POOLCHAIRS), so the same lift the
    // groove and the swing took runs here, per chair. Presence-keyed like both
    // of them — no new writer emits the entry field, so the lift is exact and
    // idempotent. Each section casts ONE vote per chair (its first entry to
    // seat the chair — the authority first, the stack's own order); the
    // majority per chair wins, and ties go to the section nearest the top,
    // which is the authority the groove lift already named. The chair a voice
    // sits in is the kernel's own assignment (partOf), read exactly the way
    // the scheduler reads it: the layer's `part` chip first, else the box's,
    // else the genre's scheme, anything unnamed answering to `line`.
    if (Array.isArray(r.song) && r.song.some(b => b && Array.isArray(b.stack) &&
        b.stack.some(e => e && e.instr !== undefined))) {
      if (r.pool === undefined) {
        const chairAt = (b, e, g, v) => {
          const pt = e.part != null ? e.part : b.part;
          const p = pt && pt !== "auto" ? pt : K.partOf(g, v);
          return PARTNAMES[p] ? p : "line";
        };
        const votes = new Map();                  // chair -> Map(id -> n)
        for (const b of r.song) {
          if (!b || !Array.isArray(b.stack)) continue;
          const per = new Map();                  // this section's one vote per chair
          for (const e of b.stack) {
            if (!e || e.instr == null || !GENRES[e.g]) continue;
            const g = GENRES[e.g];
            for (let v = 0; v < g.voices; v++) {
              const c = chairAt(b, e, g, v);
              if (!per.has(c)) per.set(c, e.instr);
            }
          }
          for (const [c, id] of per) {
            let m = votes.get(c);
            if (!m) votes.set(c, m = new Map());
            m.set(id, (m.get(id) || 0) + 1);
          }
        }
        const pool = {};
        for (const [c, m] of votes) {
          let best = null, bestN = 0;             // insertion order again: a tie
          for (const [id, n] of m)                // keeps the FIRST section's pick
            if (n > bestN) { best = id; bestN = n; }
          if (best != null) pool[c] = best;
        }
        if (Object.keys(pool).length) r.pool = pool;
      }
      for (const b of r.song)
        if (b && Array.isArray(b.stack))
          for (const e of b.stack) if (e) delete e.instr;
    }
    if (r.v !== 1) return r;             // v:2 passes through; junk fails validate
    // genre -> genres -> stack: they shared one slot list before layers
    // carried their own phrases
    for (const b of Array.isArray(r.song) ? r.song : []) {
      if (!b) continue;
      if (!b.stack) {
        const gs = b.genres || (b.genre ? [b.genre] : ["simple"]);
        const sl = Array.isArray(b.slots) ? b.slots : [];
        b.stack = gs.map(g2 => ({ g: g2, slots: [...sl] }));
      }
      // del -> echo: the send was named after the delay bus it fed, which
      // collided with the kernel's `del` (delete every nth) operator
      if (b.del !== undefined) {
        if (b.echo === undefined) b.echo = b.del;
        delete b.del;
      }
    }
    // early saves predate the ramp vectors — and predate the drum kind
    // entirely, so a drum phrase (no `deg` at all) never had inc/stk to miss
    for (const p of Array.isArray(r.slots) ? r.slots : []) {
      if (p && p.kind === "drum") continue;
      // a phrase old enough to be missing inc/stk is always sixteen, but
      // reading its OWN length off deg (rather than assuming) is what keeps
      // this line honest now that phrases stop being sixteen going forward
      const n = p && Array.isArray(p.deg) ? p.deg.length : 16;
      if (p && !p.inc) p.inc = z(n);
      if (p && !p.stk) p.stk = z(n);
    }
    r.v = VERSION;
    return r;
  }

  /* ---------- validation ---------- */
  // validateSong(raw) -> { ok, song, errors: [{path, got, want}] }
  // `song` is a cleaned deep copy: ops/fx filtered, len/nudge clamped, short
  // slot banks padded with blanks. On !ok, errors[0] names the first field
  // that failed — show its path, do not shrug.
  // EVERY VECTOR THE SAME LENGTH, and that length 1..PHRASE_MAX rather than
  // pinned to sixteen. Read off `deg` (there is no separate length field to
  // disagree with it), then every other vector is held to that same count.
  const okPhrase = p => {
    if (!p || typeof p !== "object" || !Array.isArray(p.deg)) return false;
    const n = p.deg.length;
    if (!Number.isInteger(n) || n < PHRASE_MIN || n > PHRASE_MAX) return false;
    return ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"].every(k =>
      Array.isArray(p[k]) && p[k].length === n && p[k].every(Number.isFinite));
  };
  // THE DRUM KIND'S OWN CHECK, the same "every vector the same length" law at
  // sixteen fixed steps: every lane a sixteen-integer vector 0..DMARK.ROLL4,
  // and `swing` (absent = 0, straight) an index into kernel.js DRUM_SWING.
  const okDrumPhrase = p => {
    if (!isDrumPhrase(p)) return false;
    const okLane = v => Array.isArray(v) && v.length === 16 &&
      v.every(x => Number.isInteger(x) && x >= 0 && x <= K.DMARK.ROLL4);
    return K.DRUM_LANES.every(d => okLane(p[d])) &&
      (p.swing == null || (Number.isInteger(p.swing) &&
        p.swing >= 0 && p.swing < K.DRUM_SWING.length));
  };

  function validateSong(raw) {
    const errors = [];
    const err = (path, got, want) => errors.push({ path, got, want });
    // NOTES ARE NOT ERRORS. A note is something the loader CHOSE rather than
    // refused — a session genre whose recipe is gone, played as `simple` — and
    // it exists because "degrade honestly" means saying what you did, out loud,
    // where the UI can print it. errors[0] still names the first refusal; a
    // song with notes and no errors loaded, and is not what it was.
    const notes = [];
    const note = (path, got, chose, why) => notes.push({ path, got, chose, why });
    if (!raw || typeof raw !== "object") {
      err("", typeof raw, "a song object");
      return { ok: false, song: null, errors, notes };
    }
    const s = JSON.parse(JSON.stringify(raw));
    if (s.v !== VERSION) err("v", s.v, VERSION + " (run migrate first)");

    // ---- slots: 1..NSLOTS phrases, KEPT at their own length. The bank used
    // to demand exactly eight (then pad short ones up to eight), which meant
    // it could never change size without rejecting every existing save in
    // both directions. The bank is variable now: an 8-slot save loads as 8
    // slots, a 1-slot save as 1 — the one repair left is below, after the
    // boxes are read: a box referencing past the end grows the bank to cover
    // it, because a dangling index would render undefined mid-bar.
    if (!Array.isArray(s.slots) || !s.slots.length || s.slots.length > NSLOTS)
      err("slots", Array.isArray(s.slots) ? s.slots.length : typeof s.slots,
          "1.." + NSLOTS + " phrases");
    else
      s.slots.forEach((p, i) => { if (!okPhrase(p) && !okDrumPhrase(p))
        err("slots[" + i + "]", p, "eight finite vectors, " +
            PHRASE_MIN + ".." + PHRASE_MAX + " steps, all the same length, " +
            "or a sixteen-step drum pattern"); });

    // ---- one enum value against the registry. oct arrives as a number or a
    // string; the table is keyed on strings, so read it through String().
    const okEnum = (f, v) => v == null ||
      Object.prototype.hasOwnProperty.call(f.table, String(v));
    const okVox = v => v == null || (typeof v === "object" &&
      Object.keys(v).every(k => VOX[k] && (v[k] == null || VOX[k].t[v[k]] != null)));
    const filterList = (f, v) => (v || []).filter(k =>
      Object.prototype.hasOwnProperty.call(f.table, k))
      .slice(0, f.max || Infinity);
    // THE STRIP EQ, one door for its three homes (box, part entry, bus entry):
    // band KEYS filter against the given list (a band the strip lacks is an
    // obsolete chip, dropped), band VALUES take the fader's own policy —
    // garbage rejects, a wild number clamps (fields.js eqDb), and zero
    // normalizes away — so FLAT keeps exactly one spelling: absent.
    const cleanEq = (v, bands, path) => {
      if (typeof v !== "object" || Array.isArray(v)) {
        err(path, v, "a band -> dB map"); return null;
      }
      const o = {};
      for (const b of bands) {
        const x = v[b.key];
        if (x == null) continue;
        if (!Number.isFinite(x)) err(path + "." + b.key, x, "-12..12 dB");
        else { const n = eqDb(x); if (n) o[b.key] = n; }
      }
      return Object.keys(o).length ? o : null;
    };

    // ---- THE SONG'S OWN GENRES, read BEFORE the boxes because the boxes are
    // allowed to point at them. A genre invented in the LAB lives in the SONG:
    // it has to travel with the file or the song that uses it cannot be
    // reopened, which is the one failure that would lose somebody's record.
    //
    // WHAT IS STORED IS THE RECIPE, NOT THE GENRE. An anchor is half closures
    // (`entry`, `reg`, `realize`, `word`) and JSON drops a function silently, so
    // a saved candidate would come back as a genre with no behaviour at all.
    // The recipe is the four facts it takes to make it again — the parents and
    // their weights, the bench seed, how many times each material field was
    // rolled, and whatever a person wrote instead — and nukernel/lab.js
    // `rebuild` walks them back to the same anchor, deterministically, on any
    // machine. That is also what makes a shared song play the same genre: the
    // DNA is literally the parents, which are in this table already.
    //
    // THE FILTER RULE, at the level it belongs: an entry whose PARENTS this
    // build no longer holds is dropped with a note (a lineage is a claim about
    // the catalog, and the catalog grows and renames), while an entry that is
    // MALFORMED errors — a broken recipe means the file is from somewhere this
    // build cannot honestly play. Absent (`null`) is not the same as `{}`:
    // ui/state.js reads absent as "this producer knows nothing about session
    // genres, keep the ones already installed" and an empty map as "this
    // document states its set, and it is empty".
    const okWeights = p => p && typeof p === "object" && !Array.isArray(p) &&
      Object.keys(p).length >= 1 && Object.keys(p).length <= MAX_PARENTS &&
      Object.values(p).every(w => Number.isFinite(w) && w > 0);
    if (s.genres != null) {
      if (typeof s.genres !== "object" || Array.isArray(s.genres)) {
        err("genres", s.genres, "a map of session key -> recipe");
        s.genres = null;
      } else {
        const clean = {};
        for (const [k, r] of Object.entries(s.genres)) {
          const gp = "genres." + k;
          // THE NAMESPACE IS THE COLLISION LAW. A session key is prefixed, so
          // it cannot shadow a catalog anchor by construction rather than by a
          // check that has to be remembered — and the check is here anyway,
          // because a hand-edited file is a file.
          if (!isSessionKey(k)) { err(gp, k, "a key beginning \"" + SESSION_NS + "\""); continue; }
          if (Object.prototype.hasOwnProperty.call(GENRES, k))
            { err(gp, k, "a key the catalog does not already hold"); continue; }
          if (!r || typeof r !== "object" || Array.isArray(r))
            { err(gp, r, "a recipe object"); continue; }
          // the label must END IN A YEAR: an invented genre coins a speculative
          // place-year ("Lagos 2031"), and the year is what sorts it into the
          // genre menu's one chronological list beside the catalog. A yearless
          // label would drop it into the FUNCTION-genre bucket at the bottom,
          // which is a lie about what it is.
          if (typeof r.label !== "string" || !/\S/.test(r.label) || !/\d{3,4}\s*$/.test(r.label))
            { err(gp + ".label", r.label, "a place-year label ending in a year"); continue; }
          if (!okWeights(r.parents))
            { err(gp + ".parents", r.parents, "1.." + MAX_PARENTS + " parents with positive weights"); continue; }
          if (r.seed != null && !Number.isInteger(r.seed))
            { err(gp + ".seed", r.seed, "an integer seed"); continue; }
          const gone = Object.keys(r.parents).filter(p =>
            !Object.prototype.hasOwnProperty.call(GENRES, p));
          if (gone.length) {
            note(gp, k, null, "its parent" + (gone.length > 1 ? "s " : " ") +
                 gone.join(", ") + " left the catalog, so the bench cannot make it again");
            continue;
          }
          const e = { label: r.label, parents: { ...r.parents }, seed: r.seed | 0 };
          // the presses and the hand edits: both optional, both plain data.
          // A press count that is not a count is dropped rather than refused —
          // it moves a draft, it does not define the genre.
          if (r.rolls && typeof r.rolls === "object" && !Array.isArray(r.rolls)) {
            const n = {};
            for (const [f, c] of Object.entries(r.rolls))
              if (Number.isInteger(c) && c >= 0 && c <= MAX_ROLLS) n[f] = c;
            if (Object.keys(n).length) e.rolls = n;
          }
          if (r.mine && typeof r.mine === "object" && !Array.isArray(r.mine) &&
              Object.keys(r.mine).length) e.mine = r.mine;
          clean[k] = e;
        }
        s.genres = clean;
      }
    } else s.genres = null;
    const known = g => Object.prototype.hasOwnProperty.call(GENRES, g) ||
      (s.genres && Object.prototype.hasOwnProperty.call(s.genres, g));

    if (!Array.isArray(s.song) || !s.song.length)
      err("song", typeof s.song, "at least one box");
    else s.song.forEach((b, bi) => {
      const at = "song[" + bi + "]";
      if (!b || typeof b !== "object") { err(at, b, "a box"); return; }
      // the stack: non-empty, known genres, slot indices in range
      if (!Array.isArray(b.stack) || !b.stack.length) {
        err(at + ".stack", b.stack, "a non-empty genre stack");
      } else b.stack.forEach((e, ei) => {
        const ep = at + ".stack[" + ei + "]";
        // A SESSION KEY WITH NO RECIPE DEGRADES, IT DOES NOT REFUSE — and it
        // says what it chose. A song can arrive here having lost its own genre
        // set (a box pasted out of another file, a hand edit, a recipe whose
        // parents left the catalog above), and refusing the whole song over one
        // layer would lose the record to save the genre. Everything else keeps
        // the old law: an unknown CATALOG key means the file is from a build
        // this one cannot honestly play, and that still errors.
        if (e && typeof e === "object" && isSessionKey(e.g) && !known(e.g)) {
          note(ep + ".g", e.g, FALLBACK_GENRE,
               "this song does not carry the recipe for it, so it plays as " +
               GENRES[FALLBACK_GENRE].label);
          e.g = FALLBACK_GENRE;
        }
        if (!e || !known(e.g))
          { err(ep + ".g", e && e.g, "a known genre"); return; }
        if (!Array.isArray(e.slots) ||
            !e.slots.every(i => Number.isInteger(i) && i >= 0 && i < NSLOTS))
          err(ep + ".slots", e.slots, "phrase indices 0.." + (NSLOTS - 1));
        if (e.ops != null && !Array.isArray(e.ops))
          err(ep + ".ops", e.ops, "an array of operator keys");
        else if (e.ops) e.ops = filterList({ table: OPS }, e.ops);
        // the per-layer overrides, from the registry — including `clamp`,
        // which okBox never checked (the drift that argued for this file)
        for (const f of FIELDS) {
          if (f.scope !== "layer" || f.type === "list") continue;
          if (f.type === "vox") continue;          // handled whole, below
          if (!okEnum(f, e[f.key]))
            err(ep + "." + f.key, e[f.key], "one of " + Object.keys(f.table).join("|"));
        }
        if (!okVox(e.vox)) err(ep + ".vox", e.vox, "known voice knobs");
      });
      // focus is a UI cursor, not a musical fact — clamp, never reject
      if (b.focus != null && Array.isArray(b.stack) && b.stack.length)
        b.focus = Math.max(0, Math.min(b.stack.length - 1, b.focus | 0));
      // the window, clamped: a hand-edited len of 1e9 used to reach
      // sectionEvents and render a billion bars
      if (!Number.isFinite(b.len)) err(at + ".len", b.len, "1.." + MAX_LEN);
      else b.len = Math.max(1, Math.min(MAX_LEN, Math.round(b.len)));
      if (!Number.isFinite(b.nudge)) err(at + ".nudge", b.nudge, "0.." + MAX_NUDGE);
      else b.nudge = Math.max(0, Math.min(MAX_NUDGE, Math.round(b.nudge)));
      // box-level fields, from the registry. Layer-scope fields are also legal
      // at box level — that is what a layer inherits from.
      if (!Array.isArray(b.ops)) err(at + ".ops", b.ops, "an array of operator keys");
      else b.ops = filterList({ table: OPS }, b.ops);
      b.fx = filterList({ table: FX, max: MAX_FX }, b.fx);
      // AUTOMATION. Entries are {param, points, curve} objects (or a bare
      // param string, which is legal and inert — the registry's exhaustive
      // toggle writes those). The FILTER rule applies to the PARAM the way it
      // does to ops/fx — an unknown param is an obsolete chip, dropped — but
      // malformed POINTS are an error: garbage numbers mean the file is
      // broken, not old, and arming NaN on an AudioParam throws mid-bar.
      if (b.auto != null) {
        if (!Array.isArray(b.auto))
          err(at + ".auto", b.auto, "a list of {param, points, curve}");
        else {
          b.auto = b.auto.filter(a => {
            const p = typeof a === "string" ? a : a && a.param;
            return p != null && Object.prototype.hasOwnProperty.call(AUTOPARAMS, p);
          });
          b.auto.forEach((a, ai) => {
            if (typeof a === "string") return;
            if (a.points != null && !(Array.isArray(a.points) && a.points.every(pt =>
                Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite))))
              err(at + ".auto[" + ai + "].points", a.points, "[[beat,value],…] finite pairs");
            if (a.curve != null && a.curve !== "lin" && a.curve !== "exp")
              err(at + ".auto[" + ai + "].curve", a.curve, "lin|exp");
          });
        }
      }
      // THE PER-PART MIX. A map of chair key -> a small mix entry, and BOTH
      // halves of the filter rule apply, at their own level:
      //   the KEY is filtered. `pad2` is a perfectly legal address that this
      //     box may simply not have a chair for — swap the genre and it is
      //     back — so an address is dropped only when it is not an address at
      //     all. A key naming a chair the current stack lacks is KEPT: the
      //     the desk ignores it (audio/desk.js partsOf walks the box's real
      //     chairs), and losing it here would mean a genre A/B silently ate
      //     the mix you set on the way past.
      //   the VALUE is rejected, exactly like the box's own send or level —
      //     an unknown level means the file is from a build this one cannot
      //     honestly play. `fx` is the one list, and lists filter.
      // Normalized on the way through: an entry with nothing set, and a map
      // with no entries, come back as absent, so "all defaults" has one
      // spelling instead of three.
      if (b.parts != null) {
        if (typeof b.parts !== "object" || Array.isArray(b.parts))
          err(at + ".parts", b.parts, "a map of part key -> mix entry");
        else {
          const clean = {};
          for (const k of Object.keys(b.parts)) {
            if (!okPartKey(k)) continue;
            const e = b.parts[k], ep = at + ".parts." + k;
            if (!e || typeof e !== "object" || Array.isArray(e)) {
              err(ep, e, "a mix entry object"); continue;
            }
            const o = {};
            for (const f of PARTMIX) {
              const v = e[f.key];
              if (v == null) continue;
              if (f.type === "list") {
                const l = filterList(f, v);
                if (l.length) o[f.key] = l;
              } else if (f.type === "flag") {
                if (typeof v !== "boolean") err(ep + "." + f.key, v, "true|false");
                else if (v) o[f.key] = true;
              } else if (f.type === "num") {
                // the len/nudge policy: garbage rejects, a wild number clamps
                // (fields.js faderDb, the one clamp the mixer also applies) —
                // and 0 normalizes away, so "no offset" keeps one spelling
                if (!Number.isFinite(v)) err(ep + "." + f.key, v, f.min + ".." + f.max);
                else { const n = faderDb(v); if (n) o[f.key] = n; }
              } else if (f.type === "eq") {
                const n = cleanEq(v, f.bands, ep + "." + f.key);
                if (n) o[f.key] = n;
              } else if (!okEnum(f, v)) {
                err(ep + "." + f.key, v, "one of " + Object.keys(f.table).join("|"));
              } else o[f.key] = v;
            }
            if (Object.keys(o).length) clean[k] = o;
          }
          b.parts = Object.keys(clean).length ? clean : null;
        }
      }
      for (const f of FIELDS) {
        if (f.type === "list" || f.type === "int" || f.type === "vox") continue;
        if (f.type === "parts") continue;            // the map above, not an enum
        if (f.type === "eq") {                       // the section strip's EQ
          if (b[f.key] == null) { b[f.key] = null; continue; }
          b[f.key] = cleanEq(b[f.key], f.bands, at + "." + f.key);
          continue;
        }
        if (f.type === "num") {                      // the box fader: same policy
          const v = b[f.key];                        // as the part one above
          if (v == null) { b[f.key] = null; continue; }
          if (!Number.isFinite(v)) err(at + "." + f.key, v, f.min + ".." + f.max);
          else b[f.key] = faderDb(v) || null;
          continue;
        }
        if (!okEnum(f, b[f.key]))
          err(at + "." + f.key, b[f.key], "one of " + Object.keys(f.table).join("|"));
      }
      if (!okVox(b.vox)) err(at + ".vox", b.vox, "known voice knobs");
    });

    // ---- the bank covers every reference. Older builds padded every bank to
    // a fixed eight, so a short-banked save could legally point a box at a
    // slot the pad was about to create; those saves must keep loading. Grown
    // with blanks, never truncated — a blank phrase is silence, which is what
    // those references always played.
    if (Array.isArray(s.slots) && s.slots.length && Array.isArray(s.song)) {
      let top = s.slots.length - 1;
      for (const b of s.song)
        if (b && Array.isArray(b.stack))
          for (const e of b.stack)
            if (e && Array.isArray(e.slots))
              for (const i of e.slots)
                if (Number.isInteger(i) && i > top && i < NSLOTS) top = i;
      while (s.slots.length <= top) s.slots.push(blank());
    }

    // ---- THE MASTER BUS. A song-level object, not a box field, because it is
    // the one chain everything lands on — and it belongs to the SONG rather
    // than to the page for the reason the tempo does: a song somebody shares
    // should sound the way its author left it, and "why is this so much
    // brighter on your machine" is exactly the failure of keeping it beside
    // the song instead of in it.
    //
    // BOTH HALVES OF THE FILTER RULE, at their own level, the same split
    // `parts` uses one line up: the KEY is filtered (the master vocabulary will
    // grow and shrink, and a song should lose an obsolete global rather than
    // lose itself), the VALUE is REJECTED (an unknown ceiling means the file is
    // from a build this one cannot honestly play back). Normalized on the way
    // through, so "no master" has exactly one spelling — which is what lets
    // audio/desk.js key its absent-is-today branch on a null.
    if (s.master != null) {
      if (typeof s.master !== "object" || Array.isArray(s.master))
        err("master", s.master, "a map of global -> value");
      else {
        const clean = {};
        for (const f of MASTER) {
          const v = s.master[f.key];
          if (v == null) continue;
          if (!okEnum(f, v))
            err("master." + f.key, v, "one of " + Object.keys(f.table).join("|"));
          else clean[f.key] = v;
        }
        s.master = Object.keys(clean).length ? clean : null;
      }
    } else s.master = null;

    // ---- THE SHARED-BUS TRIMS: the master's law, one level down. A song-level
    // map of bus -> { knob: value } (fields.js BUSES), because the rack's
    // returns are part of how a song sounds and a shared song must sound the
    // way its author left it. Same filter split as master: an unknown BUS or
    // KNOB is dropped (that vocabulary will grow and shrink), an unknown VALUE
    // rejects. Normalized to null when nothing survives — absent keeps one
    // spelling, and audio/desk.js keys its as-built branch on it.
    if (s.buses != null) {
      if (typeof s.buses !== "object" || Array.isArray(s.buses))
        err("buses", s.buses, "a map of bus -> knob values");
      else {
        const clean = {};
        for (const b of BUSES) {
          const e = s.buses[b.bus];
          if (e == null) continue;
          if (typeof e !== "object" || Array.isArray(e)) {
            err("buses." + b.bus, e, "a knob-value object"); continue;
          }
          const o = {};
          for (const k of b.knobs) {
            const v = e[k.key];
            if (v == null) continue;
            if (!Object.prototype.hasOwnProperty.call(k.table, String(v)))
              err("buses." + b.bus + "." + k.key, v,
                  "one of " + Object.keys(k.table).join("|"));
            else o[k.key] = v;
          }
          // the return's EQ pair, the strip law at the bus's own band list
          if (e.eq != null) {
            const n = cleanEq(e.eq, b.eq, "buses." + b.bus + ".eq");
            if (n) o.eq = n;
          }
          if (Object.keys(o).length) clean[b.bus] = o;
        }
        s.buses = Object.keys(clean).length ? clean : null;
      }
    } else s.buses = null;

    // ---- THE MIX OFFSETS: the board's own layer. A song-level map of
    // channel -> offsets the mixer surface wrote OVER the composed mix
    // (audio/desk.js applies them last). Channels are part keys plus "drums"
    // and "master". Every field is a clamped number (a gesture, so out-of-range
    // clamps rather than rejects); unknown fields drop; empty normalizes to
    // null — absent is today.
    if (s.mix != null) {
      if (typeof s.mix !== "object" || Array.isArray(s.mix))
        err("mix", s.mix, "a map of channel -> offset values");
      else {
        const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v))
          ? Math.max(lo, Math.min(hi, Math.round(v * 100) / 100)) : null;
        const clean = {};
        for (const [chan, e] of Object.entries(s.mix)) {
          if (e == null) continue;
          if (typeof e !== "object" || Array.isArray(e)) {
            err("mix." + chan, e, "an offset object"); continue;
          }
          const o = {};
          const put = (k, lo, hi) => { const v = num(e[k], lo, hi); if (v) o[k] = v; };
          put("fader", -24, 12); put("pan", -1, 1);
          put("rev", -1, 1); put("del", -1, 1);
          if (chan === "master") { put("drive", -1, 1); put("glue", -1, 1);
                                   put("tape", -1, 1); put("space", -1, 1); }
          if (e.mute === true) o.mute = true;
          if (e.eq != null && typeof e.eq === "object" && !Array.isArray(e.eq)) {
            const q = {};
            for (const b of ["lo", "mid", "hi"]) {
              const v = num(e.eq[b], -12, 12); if (v) q[b] = v;
            }
            if (Object.keys(q).length) o.eq = q;
          }
          if (Object.keys(o).length) clean[chan] = o;
        }
        s.mix = Object.keys(clean).length ? clean : null;
      }
    } else s.mix = null;

    // ---- THE GROOVE, a song fact like the tempo (the box field it replaced
    // died at the registry; migrate() lifts old per-box saves). The tempo's own
    // policy: an unknown groove means "no groove", never "refuse the song" —
    // the vocabulary is small and stable, and null is the whole of the grid.
    s.groove = s.groove != null &&
      Object.prototype.hasOwnProperty.call(GROOVELABEL, String(s.groove))
      ? s.groove : null;
    // ...and THE SWING, the same policy against its own table: null means the
    // genre's own lean stands, "straight" is the explicit 0 that overrides it
    s.swing = s.swing != null &&
      Object.prototype.hasOwnProperty.call(SWINGLABEL, String(s.swing))
      ? s.swing : null;

    // ---- THE INSTRUMENT POOL, the third song fact in this family ("the band
    // is hired for the record"): a map of chair -> instrument id, one pick per
    // POOLCHAIRS seat, null (or an empty map) meaning every chair plays the
    // genre's own `instr`. The ops/fx FILTER rule at both levels: a key that
    // is not a chair is dropped (only the eight seats are read at all), and an
    // id INSTRCHOICES no longer names is dropped too — the instrument
    // vocabulary moves with the genre table, and a song should lose an
    // obsolete pick rather than lose itself. Normalized to null when nothing
    // survives, so "no pool" keeps one spelling.
    if (s.pool != null) {
      if (typeof s.pool !== "object" || Array.isArray(s.pool)) {
        err("pool", s.pool, "a map of chair -> instrument id");
        s.pool = null;
      } else {
        const clean = {};
        for (const c of POOLCHAIRS) {
          const v = s.pool[c];
          if (v == null) continue;
          if (Object.prototype.hasOwnProperty.call(INSTRCHOICES, String(v)))
            clean[c] = v;
        }
        s.pool = Object.keys(clean).length ? clean : null;
      }
    } else s.pool = null;

    // tempo and volume ride along; out-of-range means "keep what you had",
    // not "refuse the song" — same policy applyState always had
    s.bpm = Number.isFinite(s.bpm) && s.bpm >= 70 && s.bpm <= 160 ? s.bpm : null;
    s.vol = Number.isFinite(s.vol) && s.vol >= 0 && s.vol <= 100 ? s.vol : null;

    return { ok: !errors.length, song: errors.length ? null : s, errors, notes };
  }

  // the whole path in one call: any version in, {ok, song, errors, notes} out —
  // errors are refusals, notes are what it CHOSE (a session genre it could not
  // rebuild, played as `simple`), and a song can load with notes on it
  const load = raw => validateSong(migrate(raw));

  const api = { VERSION, FILTERED, blank, skeleton, emptyBox,
                PHRASE_MIN, PHRASE_MAX,
                blankDrum, isDrumPhrase, okDrumPhrase,
                SESSION_NS, isSessionKey, sessionKey, MAX_PARENTS, FALLBACK_GENRE,
                migrate, validateSong, load };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSong = api;
})(typeof window !== "undefined" ? window : globalThis);

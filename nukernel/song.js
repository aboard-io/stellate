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
  const { FIELDS, OPS, FX, MAX_FX, NSLOTS, MAX_LEN, MAX_NUDGE, VOX,
          AUTOPARAMS, PERIODS } = NF;
  const { GENRES } = NG;

  // The CURRENT schema version. v:2 = v:1 with the box field `del` renamed to
  // `echo` (it collided with the kernel's delete operator) and slots allowed to
  // arrive at any length 1..NSLOTS. Variable banks did not need a v:3: the
  // SHAPE never moved — old 8-slot saves are just one legal length among
  // sixteen, and they load byte-identically.
  const VERSION = 2;

  // THE FILTER RULE, written down at last: `ops` and `fx` are FILTERED on
  // load, everything else is REJECTED. The operator and effect tables change
  // as the palette does, and a song should lose an obsolete chip rather than
  // lose itself — but an unknown *setting* (a send level, a kit name) means
  // the file is from somewhere this build cannot honestly play, so it errors.
  const FILTERED = { ops: true, fx: true };

  /* ---------- constructors ---------- */
  const z = () => new Array(16).fill(0);
  const blank = () => ({ deg: z(), oct: z(), vel: new Array(16).fill(5),
                         inc: z(), stk: z(), gate: z(), acc: z(), sld: z() });

  // A BOX CARRIES A STACK OF GENRES, not one. The FIRST is the authority: it
  // owns the harmony, the rate and the drums, and everything layered on top
  // inherits them. Each entry in the stack carries ITS OWN phrases. A BOX IS
  // ALSO A MIXER CHANNEL: `fx` is its insert chain, `rev`/`echo` its two
  // sends, `verb`/`dtime` which reverb and which echo subdivision it is sent
  // TO, `lvl`/`pan` where it sits, `mot` its filter automation.
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
    // early saves predate the ramp vectors
    for (const p of Array.isArray(r.slots) ? r.slots : []) {
      if (p && !p.inc) p.inc = z();
      if (p && !p.stk) p.stk = z();
    }
    r.v = VERSION;
    return r;
  }

  /* ---------- validation ---------- */
  // validateSong(raw) -> { ok, song, errors: [{path, got, want}] }
  // `song` is a cleaned deep copy: ops/fx filtered, len/nudge clamped, short
  // slot banks padded with blanks. On !ok, errors[0] names the first field
  // that failed — show its path, do not shrug.
  const okPhrase = p => p && typeof p === "object" &&
    ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"].every(k =>
      Array.isArray(p[k]) && p[k].length === 16 && p[k].every(Number.isFinite));

  function validateSong(raw) {
    const errors = [];
    const err = (path, got, want) => errors.push({ path, got, want });
    if (!raw || typeof raw !== "object") {
      err("", typeof raw, "a song object");
      return { ok: false, song: null, errors };
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
      s.slots.forEach((p, i) => { if (!okPhrase(p))
        err("slots[" + i + "]", p, "eight 16-step finite vectors"); });

    // ---- one enum value against the registry. oct arrives as a number or a
    // string; the table is keyed on strings, so read it through String().
    const okEnum = (f, v) => v == null ||
      Object.prototype.hasOwnProperty.call(f.table, String(v));
    const okVox = v => v == null || (typeof v === "object" &&
      Object.keys(v).every(k => VOX[k] && (v[k] == null || VOX[k].t[v[k]] != null)));
    const filterList = (f, v) => (v || []).filter(k =>
      Object.prototype.hasOwnProperty.call(f.table, k))
      .slice(0, f.max || Infinity);

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
        if (!e || !Object.prototype.hasOwnProperty.call(GENRES, e.g))
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
      for (const f of FIELDS) {
        if (f.type === "list" || f.type === "int" || f.type === "vox") continue;
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

    // tempo and volume ride along; out-of-range means "keep what you had",
    // not "refuse the song" — same policy applyState always had
    s.bpm = Number.isFinite(s.bpm) && s.bpm >= 70 && s.bpm <= 160 ? s.bpm : null;
    s.vol = Number.isFinite(s.vol) && s.vol >= 0 && s.vol <= 100 ? s.vol : null;

    return { ok: !errors.length, song: errors.length ? null : s, errors };
  }

  // the whole path in one call: any version in, {ok, song, errors} out
  const load = raw => validateSong(migrate(raw));

  const api = { VERSION, FILTERED, blank, skeleton, emptyBox,
                migrate, validateSong, load };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSong = api;
})(typeof window !== "undefined" ? window : globalThis);

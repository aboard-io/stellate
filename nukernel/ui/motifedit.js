/* ui/motifedit.js — the motif, edited where it is drawn (2026-09-14).

   Paul: *"The motif editor seems very janky. I'd expect to see the motifs as
   sheet music or drum patterns and then I can just click on them to edit
   them."*

   WHAT IT REPLACES. An open line motif was an engraving you could only look at,
   stacked over a table of sixteen rows per measure — a kind button, a pitch
   bar, a weight bar and three mark buttons on every step — so the tune was in
   one place and every way of changing it was in another, a screen further
   down. A drum motif was its lanes turned on their side, steps running down
   the page. The bank drew each motif as a strip of bars.

   WHAT IT IS NOW. The engraving IS the editor: tap a note to select it, drag
   it up or down to move it through the scale, tap a rest to write a note that
   fills it. The selected note's facts and its handful of changes sit in one
   row under the staff (`noteBar`), and the keyboard does the same things. A
   drum motif is a drum pattern — a lane per row, steps across, the beat ruled —
   and a tap on a step walks it rest → ghost → hit → accent. The bank shows the
   same two pictures, and a tap on either opens the motif.

   THIS FILE OWNS THE GESTURES AND THE ARITHMETIC ON A CELL; ui/eight.js owns
   the document, the redraw and the words. Every write here is followed by the
   caller's `edited(name)`, which re-engraves the staff and the score in place,
   so nothing in this file rebuilds a page.

   THE CELL, as ui/eight.js's step bench wrote it and document.js reads it:
     play[i]  "n" a note starts, "h" the note before is held, "r" a rest
     deg[i]   scale degree of the note starting at i, -7..7
     vel[i]   0..9, present-only (absent reads as 0, which is what compiles)
     acc, art, sld, alt   the marks, per step, present-only */

export const DEG_MIN = -7;
export const DEG_MAX = 7;

const vec = (H, k) => (H[k] || (H[k] = H.deg.map(() => 0)));

/* ---------- THE ARITHMETIC ------------------------------------------------ */

/** The note sounding at step i — its start and its length in steps — or null
    when i is silent. A hold with nothing before it is silence. */
export function spanAt(H, i) {
  const n = H.play.length;
  if (i < 0 || i >= n) return null;
  let at = i;
  while (at >= 0 && H.play[at] === "h") at--;
  if (at < 0 || H.play[at] !== "n") return null;
  let len = 1;
  while (at + len < n && H.play[at + len] === "h") len++;
  return { at, len };
}

/** Every note in the cell, in order. */
export function noteList(H) {
  const out = [];
  for (let i = 0; i < H.play.length; i++) if (H.play[i] === "n") out.push(spanAt(H, i));
  return out;
}

export function nudgePitch(H, at, d) {
  if (H.play[at] !== "n") return false;
  const v = Math.max(DEG_MIN, Math.min(DEG_MAX, (H.deg[at] | 0) + d));
  if (v === (H.deg[at] | 0)) return false;
  H.deg[at] = v;
  return true;
}

/** One step longer, into a rest that follows. A note may not grow over the
    next note; that note would have to be deleted first, on purpose. */
export function lengthen(H, at) {
  const s = spanAt(H, at);
  if (!s || s.at !== at) return false;
  const j = at + s.len;
  if (j >= H.play.length || H.play[j] !== "r") return false;
  H.play[j] = "h";
  return true;
}

export function shorten(H, at) {
  const s = spanAt(H, at);
  if (!s || s.at !== at || s.len < 2) return false;
  H.play[at + s.len - 1] = "r";
  return true;
}

/** The note becomes silence, marks and all, so a rest carries nothing stale. */
export function toRest(H, at) {
  const s = spanAt(H, at);
  if (!s || s.at !== at) return false;
  for (let k = 0; k < s.len; k++) H.play[at + k] = "r";
  for (const key of ["acc", "art", "sld", "alt"]) if (H[key]) H[key][at] = 0;
  return true;
}

/** Write a note over `len` steps of rest starting at `at`, pitched and weighted
    like `like` (the nearest note before it, usually). Stops at anything that
    is not a rest, so it can never overwrite a note. */
export function writeNote(H, at, len, like) {
  if (H.play[at] !== "r") return false;
  let k = 0;
  while (k < len && at + k < H.play.length && H.play[at + k] === "r") k++;
  H.play[at] = "n";
  for (let j = 1; j < k; j++) H.play[at + j] = "h";
  H.deg[at] = like ? like.deg | 0 : 0;
  if (H.vel) H.vel[at] = like && like.vel ? like.vel : 5;
  return true;
}

/** The pitch and weight a new note at `at` should borrow: the last note that
    starts before it, else the first note after it, else the tonic at 5. */
export function likeAt(H, at) {
  let src = -1;
  for (let i = at - 1; i >= 0; i--) if (H.play[i] === "n") { src = i; break; }
  if (src < 0) src = H.play.indexOf("n");
  if (src < 0) return { deg: 0, vel: 5 };
  return { deg: H.deg[src] | 0, vel: H.vel ? (H.vel[src] | 0) || 5 : 5 };
}

export function markOf(H, at) {
  return H.sld && H.sld[at] ? 4 : H.art ? H.art[at] | 0 : 0;
}
export function setMark(H, at, v) {
  if (v === 4) { vec(H, "sld")[at] = 1; if (H.art) H.art[at] = 0; }
  else { vec(H, "art")[at] = v; if (H.sld) H.sld[at] = 0; }
}
export function setVec(H, key, at, v) { vec(H, key)[at] = v; }

/* ---------- THE STAFF AS THE EDITOR -------------------------------------- */

/* HOW A TAP FINDS ITS STEP. ui/abc.js returns, with every engraving, `glyphAt`
   (the step each pitched glyph starts on) and `rests` (the span each rest
   covers), in the order abcjs draws `.abcjs-note` and `.abcjs-rest`. A staff
   engraved from one measure of a longer cell passes that measure's first step
   as `offset`. */
function staffStep(svg) {
  // Half the distance between two staff lines, in screen pixels: the distance
  // a note moves for one step of the scale.
  const lines = [...svg.querySelectorAll(".abcjs-staff")];
  if (!lines.length) return 4;
  let lo = Infinity, hi = -Infinity;
  for (const l of lines) {
    const r = l.getBoundingClientRect();
    lo = Math.min(lo, r.top); hi = Math.max(hi, r.bottom);
  }
  return hi > lo ? (hi - lo) / 8 : 4;
}

/**
 * Make an engraved staff respond. `api`:
 *   selected()          the selected note's start step, or null
 *   pick(at)            a note was tapped
 *   rest(at, len)       a rest was tapped
 *   drag(at, steps)     a note was dragged `steps` scale steps (up is positive)
 */
export function wireStaff(host, eng, offset, api) {
  const svg = host.querySelector("svg");
  if (!svg || !eng) return;
  svg.classList.add("nu-editstaff");
  const heads = [...svg.querySelectorAll(".abcjs-note")];
  heads.forEach((g, k) => {
    const note = eng.notes[eng.glyphs[k]];
    if (!note) return;
    const at = offset + note.at;
    g.dataset.step = String(at);
    g.classList.toggle("nu-sel", api.selected() === at);
    let y0 = 0, moved = 0, px = 4, dragging = false;
    g.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true; y0 = e.clientY; moved = 0; px = staffStep(svg);
      try { g.setPointerCapture(e.pointerId); } catch (err) {}
    });
    g.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const steps = Math.round((y0 - e.clientY) / px);
      if (steps === moved) return;
      moved = steps;
      // the notehead follows the finger; the re-engrave on release spells it
      for (const piece of svg.querySelectorAll('.abcjs-note[data-step="' + at + '"]'))
        piece.style.transform = "translateY(" + (-steps * px) + "px)";
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) api.drag(at, moved);
      else api.pick(at);
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", () => { dragging = false; api.pick(at); });
  });
  const rests = [...svg.querySelectorAll(".abcjs-rest")];
  rests.forEach((r, k) => {
    const span = eng.rests && eng.rests[k];
    if (!span) return;
    r.dataset.rest = String(offset + span.at);
    r.addEventListener("click", () => api.rest(offset + span.at, span.len));
  });
}

/** Re-mark the selection on staves already drawn, without re-engraving. */
export function paintSelection(root, at) {
  for (const g of root.querySelectorAll(".nu-editstaff .abcjs-note"))
    g.classList.toggle("nu-sel", at != null && g.dataset.step === String(at));
}

/* ---------- THE SELECTED NOTE --------------------------------------------- */

function button(face, aria, onClick, cls) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "nu-nbb" + (cls ? " " + cls : "");
  b.textContent = face;
  b.setAttribute("aria-label", aria);
  b.title = aria;
  b.addEventListener("click", onClick);
  return b;
}

const lengthWord = (len, spb, pulse) => {
  if (spb === 16 && pulse === 4) {
    const w = { 1: "sixteenth", 2: "eighth", 3: "dotted eighth", 4: "quarter",
                6: "dotted quarter", 8: "half", 12: "dotted half", 16: "whole" }[len];
    if (w) return w;
  }
  return len + (len === 1 ? " step" : " steps");
};

/**
 * The row under the staff. `ctx`:
 *   cell()              the cell (a live reference into the document)
 *   selected()          selected start step, or null
 *   select(at)          change the selection (null clears)
 *   commit()            the cell changed: re-engrave, save
 *   degName(deg)        how the page names a degree ("5̂")
 *   spb, pulse          steps per bar and per beat
 *   marks, alts         [{v, g, key}] and a `say(key)` for their words
 */
export function noteBar(ctx) {
  const bar = document.createElement("div");
  bar.className = "nu-notebar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "the selected note");

  const act = (fn) => () => {
    const H = ctx.cell(), at = ctx.selected();
    if (at == null || !H) return;
    if (fn(H, at) !== false) ctx.commit();
    refresh();
  };
  const step = (dir) => () => {
    const H = ctx.cell(); if (!H) return;
    const list = noteList(H);
    if (!list.length) return;
    const at = ctx.selected();
    let idx = list.findIndex((s) => s.at === at);
    idx = idx < 0 ? (dir > 0 ? 0 : list.length - 1)
                  : (idx + dir + list.length) % list.length;
    ctx.select(list[idx].at);
    refresh();
  };
  const cycle = (list, get, set) => (H, at) => {
    const cur = get(H, at);
    const i = list.findIndex((m) => m.v === cur);
    set(H, at, list[(i + 1) % list.length].v);
  };

  const label = document.createElement("span");
  label.className = "nu-notelab";
  const prev = button("◀", "previous note", step(-1));
  const next = button("▶", "next note", step(1));
  const up = button("▲", "higher (↑)", act((H, at) => nudgePitch(H, at, 1)));
  const down = button("▼", "lower (↓)", act((H, at) => nudgePitch(H, at, -1)));
  const shorter = button("−", "shorter (−)", act(shorten));
  const longer = button("+", "longer (+)", act(lengthen));
  const acc = button(">", "accent (a)", act((H, at) => setVec(H, "acc", at, H.acc && H.acc[at] ? 0 : 1)), "nu-nbacc");
  const mark = button(ctx.marks[0].g, "articulation", act(cycle(ctx.marks, markOf, setMark)), "nu-nbmark");
  const alt = button(ctx.alts[0].g, "sharp or flat", act(cycle(ctx.alts,
    (H, at) => (H.alt ? H.alt[at] | 0 : 0), (H, at, v) => setVec(H, "alt", at, v))), "nu-nbalt");
  const softer = button("p", "softer", act((H, at) => {
    const v = (H.vel ? H.vel[at] | 0 : 0); if (v <= 1) return false;
    setVec(H, "vel", at, v - 1); }), "nu-nbvel");
  const louder = button("f", "louder", act((H, at) => {
    const v = (H.vel ? H.vel[at] | 0 : 0); if (v >= 9) return false;
    setVec(H, "vel", at, v + 1); }), "nu-nbvel");
  const del = button("×", "make it a rest (Delete)", act((H, at) => {
    const ok = toRest(H, at); if (ok) ctx.select(null); return ok; }), "nu-nbdel");

  const groups = [[prev, next], [up, down], [shorter, longer],
                  [softer, louder], [acc, mark, alt], [del]];
  const editing = [up, down, shorter, longer, acc, mark, alt, softer, louder, del];
  bar.append(label);
  for (const g of groups) {
    const span = document.createElement("span");
    span.className = "nu-nbg";
    span.append(...g);
    bar.append(span);
  }

  function refresh() {
    const H = ctx.cell(), at = ctx.selected();
    const s = H && at != null ? spanAt(H, at) : null;
    if (!s || s.at !== at) {
      label.textContent = "tap a note to change it, or a rest to write one";
      for (const b of editing) b.disabled = true;
      bar.classList.add("is-idle");
      return;
    }
    bar.classList.remove("is-idle");
    const vel = H.vel ? H.vel[at] | 0 : 0;
    label.textContent = ctx.degName(H.deg[at] | 0) + " · " +
      lengthWord(s.len, ctx.spb, ctx.pulse) + " · weight " + vel;
    for (const b of editing) b.disabled = false;
    up.disabled = (H.deg[at] | 0) >= DEG_MAX;
    down.disabled = (H.deg[at] | 0) <= DEG_MIN;
    shorter.disabled = s.len < 2;
    longer.disabled = !(at + s.len < H.play.length && H.play[at + s.len] === "r");
    softer.disabled = vel <= 1;
    louder.disabled = vel >= 9;
    acc.setAttribute("aria-pressed", String(!!(H.acc && H.acc[at])));
    const m = ctx.marks.find((x) => x.v === markOf(H, at)) || ctx.marks[0];
    mark.textContent = m.g;
    mark.setAttribute("aria-label", "articulation: " + ctx.say(m.key));
    mark.title = mark.getAttribute("aria-label");
    const a = ctx.alts.find((x) => x.v === (H.alt ? H.alt[at] | 0 : 0)) || ctx.alts[0];
    alt.textContent = a.g;
    alt.setAttribute("aria-label", "accidental: " + ctx.say(a.key));
    alt.title = alt.getAttribute("aria-label");
  }

  /** The keyboard, for whoever holds focus inside the editor. */
  function key(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const map = {
      ArrowUp: up, ArrowDown: down, ArrowLeft: prev, ArrowRight: next,
      Delete: del, Backspace: del, "+": longer, "=": longer, "-": shorter,
      a: acc,
    };
    const b = map[e.key];
    if (!b || b.disabled) return;
    e.preventDefault();
    b.click();
  }

  refresh();
  return { el: bar, refresh, key };
}

/* ---------- THE DRUM PATTERN ---------------------------------------------- */

/**
 * Lanes down, steps across. `ctx`:
 *   lanes        { letter: number[] } — live arrays in the document
 *   laneName(k)  the lane's word
 *   sidecar(k)   true for a lane that is not struck (drawn, not tappable)
 *   spb, pulse   steps per bar and per beat
 *   head(i)      a header cell for step i, which the playhead may light
 *   v7(d), v9(v) the document's 0..9 level <-> the 0..7 face
 *   edited()     after a change
 */
export function drumPattern(ctx) {
  const t = document.createElement("table");
  t.className = "nu-drumpat";
  const head = document.createElement("tr");
  head.append(document.createElement("th"));
  for (let i = 0; i < ctx.spb; i++) {
    // the caller's own count cell, because the playhead writes only into those
    const th = ctx.head(i);
    th.classList.add("nu-dpcount");
    if (i % ctx.pulse === 0) th.classList.add("nu-dpbeat");
    head.append(th);
  }
  t.append(head);
  // rest → hit → accent → ghost → rest: the first tap is the ordinary stroke
  const cycle = (v) => (v === 0 ? 4 : v >= 7 ? 1 : v <= 1 ? 0 : 7);
  for (const lane of Object.keys(ctx.lanes)) {
    const arr = ctx.lanes[lane];
    const tr = document.createElement("tr");
    tr.dataset.lane = lane;
    const name = document.createElement("th");
    name.className = "nu-dplane";
    name.textContent = ctx.laneName(lane);
    tr.append(name);
    for (let i = 0; i < ctx.spb; i++) {
      const td = document.createElement("td");
      td.className = i % ctx.pulse === 0 ? "nu-dpbeat" : "";
      if (i >= arr.length) { tr.append(td); continue; }
      if (ctx.sidecar(lane)) {
        td.textContent = arr[i] ? String(arr[i]) : "";
        td.classList.add("nu-hint");
        tr.append(td);
        continue;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nu-dp";
      b.dataset.k = "kit" + lane + i;
      const paint = () => {
        const v = ctx.v7(arr[i] | 0);
        b.dataset.v = String(v);
        b.classList.toggle("is-ghost", v > 0 && v <= 1);
        b.classList.toggle("is-hit", v > 1 && v < 7);
        b.classList.toggle("is-acc", v >= 7);
        const say = ctx.laneName(lane) + ", step " + (i + 1) + ": " +
          (v ? (v <= 1 ? "ghost" : v >= 7 ? "accent" : "hit") : "rest");
        b.setAttribute("aria-label", say);
        b.title = say;
      };
      b.addEventListener("click", () => {
        arr[i] = ctx.v9(cycle(ctx.v7(arr[i] | 0)));
        paint();
        ctx.edited();
      });
      paint();
      td.append(b);
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
}

/* ---------- THE BANK'S PICTURE OF A DRUM MOTIF ---------------------------- */

/** A small, still drum pattern: a dot per struck step, a lane per row. */
export function drumThumb(lanes, spb, pulse, sidecar, v7) {
  const box = document.createElement("span");
  box.className = "nu-dthumb";
  const keys = Object.keys(lanes).filter((k) => !sidecar(k));
  box.style.setProperty("--dt-cols", String(spb));
  for (const k of keys) {
    for (let i = 0; i < spb; i++) {
      const c = document.createElement("i");
      const v = v7(lanes[k][i] | 0);
      if (v) c.className = v >= 7 ? "is-acc" : v <= 1 ? "is-ghost" : "is-on";
      if (i % pulse === 0) c.classList.add("nu-dpbeat");
      box.append(c);
    }
  }
  return box;
}

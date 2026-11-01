// THE LILGUYS PAGE, FUZZED — the firmware's fuzzer (stellate-lilguys,
// web/emu/stellate_fuzz.mjs) brought into the page itself.
//
// The page is a graph. A STATE is what a hand would say it is doing (playing
// or stopped; looking at the band, writing a motif, or reading; whose part is
// muted; looping). The OPERATIONS are what a hand can do FROM that state, and
// only those: no clicking a button the layout hides, no typing into a roll that
// is not open. A walk starts from a fresh record and takes operations at
// random, half the time one it has not yet taken from the state it is in
// (coverage-guided), and after every one asks the page's own invariants
// (app.js check(): the document, the cells, the mute, the tempo, what is shown
// against what is held) and whether anything threw. Now and then it asks a
// PROPERTY instead, a little experiment with a known answer:
//
//   roll-twice   an empty step tapped is a note in the cell; tapped again, the
//                cell is as it was
//   mute-cuts    "I'll play this part" silences that chair and only that chair,
//                in the events the engine is handed; undone, everything is back
//   stop-stops   stop, and the clock stops with it
//   plays-on     playing, the beat moves forward (and a press of play makes a
//                sound within twenty seconds)
//   read-keeps   reading and coming back changes no motif
//   genre-clean  a new genre is a clean start: nothing chosen, nothing looped
//   staff-shows  the staff holds the part it is titled with, spaced as asked
//
// A failure is shrunk (delta debugging: the fewest operations that fail the
// same way) and given as a replay. Each walk starts again from `reset`, the
// page's own fresh state, so a walk and its replay need no reload — which is
// what lets it run ON A PHONE: open lilguys.html#fuzz (&walks=6&ops=60&seed=1)
// and the page fuzzes itself, a report in the corner. The node harness
// (test/lilguys-fuzz.browser.js) runs the same walks, adds the one thing a page
// cannot do to itself — turn the phone round — and writes the graph as DOT.

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

export function rng(seed) {                    // mulberry32: the same seed, the same walk
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

/* ---------- the graph's node ---------- */
export function state(L) {
  const where = L.READ ? "READ" : L.SEL >= 0 ? (L.SEL === 0 ? "EDIT-drums" : "EDIT-pitched") : "BAND";
  return `${L.playing ? "PLAY" : "STOP"} ${where}${L.MINE >= 0 ? " MINE" : ""}${L.loop != null ? " LOOP" : ""}`;
}

/* ---------- a hand ---------- */
const click = (el) => { if (el) el.click(); };
function pointer(type, target, x, y, shift) {
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y,
    button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 7, pointerType: "touch", isPrimary: true, shiftKey: !!shift });
  (type === "pointerdown" ? target : window).dispatchEvent(e);
}
// a point on the roll's grid: step s, row index ri (the roll scrolls; its own
// arithmetic is off the grid's rectangle, so the point needs no scrolling to)
function rollPoint(L, s, ri) {
  const g = L.roll().grid.getBoundingClientRect();
  return { x: g.left + 46 + (s + 0.5) * 34, y: g.top + (ri + 0.5) * 18 };
}
function tapRoll(L, s, ri, shift) {
  const R = L.roll(), p = rollPoint(L, s, ri);
  // the element under that point, as the roll would have it: a note there, else the grid
  const note = [...R.grid.querySelectorAll(".roll-note")].find((el) => {
    const b = el.getBoundingClientRect(); return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
  });
  pointer("pointerdown", note || R.grid, p.x, p.y, shift);
  pointer("pointerup", window, p.x, p.y);
}
function dragRoll(L, s0, r0, s1, r1, onEdge) {
  const R = L.roll(), a = rollPoint(L, s0, r0), b = rollPoint(L, s1, r1);
  let target = R.grid;
  if (onEdge) {
    const n = [...R.grid.querySelectorAll(".roll-edge")];
    if (!n.length) return false;
    target = n[0];
    const bb = target.getBoundingClientRect(); a.x = bb.left + 2; a.y = bb.top + 2;
  }
  pointer("pointerdown", target, a.x, a.y);
  pointer("pointermove", window, (a.x + b.x) / 2, (a.y + b.y) / 2);
  pointer("pointermove", window, b.x, b.y);
  pointer("pointerup", window, b.x, b.y);
  return true;
}
function setRange(el, v) {
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
// a key lands where a keyboard's would: on whatever has focus (the page, when nothing does)
const key = (code) => (document.activeElement || document.body)
  .dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));

/* ---------- the operations: [kind, weight, available(L), make(r, L) -> op] ---------- */
const editing = (L) => !L.READ && L.SEL >= 0;
export const OPS = [
  ["member", 14, (L) => !L.READ, (r) => ({ op: "member", m: Math.floor(r() * 4) })],
  ["tab", 6, editing, (r) => ({ op: "tab", i: Math.floor(r() * 6) })],
  ["roll-tap", 18, editing, (r) => ({ op: "roll-tap", s: r(), row: r(), shift: r() < 0.15 })],
  ["roll-drag", 8, editing, (r) => ({ op: "roll-drag", s: r(), row: r(), ds: Math.floor(r() * 6) - 1, dr: Math.floor(r() * 5) - 2, edge: r() < 0.3 })],
  ["mine", 6, editing, () => ({ op: "mine" })],
  ["close", 2, editing, () => ({ op: "close" })],
  ["play", 7, () => true, () => ({ op: "play" })],
  ["tempo", 5, (L) => !L.READ, (r) => ({ op: "tempo", bpm: 40 + Math.floor(r() * 181) })],
  ["tempo-back", 1, (L) => !L.READ, () => ({ op: "tempo-back" })],
  ["loop", 3, (L) => !L.READ, () => ({ op: "loop" })],
  ["genre", 2, (L) => !L.READ, (r) => ({ op: "genre", g: r() })],
  ["dice", 1, (L) => !L.READ, () => ({ op: "dice" })],
  ["read", 4, (L) => !L.READ, () => ({ op: "read" })],
  ["rail", 14, (L) => L.READ, (r) => ({ op: "rail", b: pick(r, ["rSlower", "rFaster", "rFaster", "rPart", "rNew", "rOpts", "rExit"]) })],
  ["read-opt", 5, (L) => L.READ, (r) => ({ op: "read-opt", o: pick(r, ["ahead1", "ahead2", "ahead4", "oNames", "oChords", "oMute", "sync"]), v: Math.round(r() * 60 - 30) * 10 })],
  ["read-member", 3, (L) => L.READ, (r) => ({ op: "member", m: Math.floor(r() * 4) })],
  ["key", 4, () => true, (r) => ({ op: "key", code: pick(r, ["Space", "Digit1", "Digit2", "Digit3", "Digit4", "Escape", "KeyR"]) })],
  ["wait", 6, () => true, (r) => ({ op: "wait", ms: 150 + Math.floor(r() * (r() < 0.8 ? 1500 : 6000)) })],
  ["rotate", 2, (L) => !!L.rotate, (r) => ({ op: "rotate", to: pick(r, ["landscape", "portrait", "desktop"]) })],
  ["prop", 7, () => true, (r) => ({ op: "prop", p: pick(r, ["roll-twice", "mute-cuts", "stop-stops", "plays-on", "read-keeps", "genre-clean", "staff-shows"]), x: r(), y: r() })],
];

async function apply(L, o) {
  switch (o.op) {
    case "member": click(document.querySelectorAll(".member")[o.m]); return null;
    case "tab": { const t = $("motifTabs").children; if (t.length) click(t[o.i % t.length]); return null; }
    case "roll-tap": {
      const R = L.roll(); if (!R.rows.length) return null;
      tapRoll(L, Math.floor(o.s * R.steps), Math.floor(o.row * R.rows.length), o.shift); return null;
    }
    case "roll-drag": {
      const R = L.roll(); if (!R.rows.length) return null;
      const s = Math.floor(o.s * R.steps), ri = Math.floor(o.row * R.rows.length);
      dragRoll(L, s, ri, Math.max(0, Math.min(R.steps - 1, s + o.ds)), Math.max(0, Math.min(R.rows.length - 1, ri + o.dr)), o.edge);
      return null;
    }
    case "mine": click($("mine")); return null;
    case "close": click($("closeDrawer")); return null;
    case "play": click(L.READ ? $("rPlay") : $("play")); return null;
    case "tempo": setRange($("tempo"), o.bpm); return null;
    case "tempo-back": click($("tempoBack")); return null;
    case "loop": click($("loopSec")); return null;
    case "genre": {
      const a = L.anchors; const g = a[Math.floor(o.g * a.length)];
      const opt = [...$("genres").options].find((x, i) => i === a.indexOf(g));
      const box = $("genre"); box.value = opt ? opt.value : g;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      await settleGenre(L); return null;
    }
    case "dice": click($("dice")); await settleGenre(L); return null;
    case "read": click($("readBtn")); return null;
    case "rail": click($(o.b)); if (o.b === "rNew") await settleGenre(L); return null;
    case "read-opt": {
      if ($("ropts").hidden) click($("rOpts"));
      if (o.o.startsWith("ahead")) click(document.querySelector(`#ropts input[name=ahead][value="${o.o.slice(5)}"]`));
      else if (o.o === "sync") setRange($("oSync"), o.v);
      else click($(o.o));
      return null;
    }
    case "key": key(o.code); return null;
    case "wait": await sleep(o.ms); return null;
    case "rotate": if (L.rotate) await L.rotate(o.to); return null;
    case "prop": return prop(L, o);
  }
  return null;
}
async function settleGenre(L) { for (let i = 0; i < 40 && !L.SCORE; i++) await sleep(25); await frame(); }

/* ---------- the properties ---------- */
function chairCounts(L) {                      // events the engine is handed, per desk chair
  const P = L.plan, TL = P.timeline(), out = {};
  for (let n = 0; n < TL.length; n++) {
    const bp = P.barPlan(n); if (!bp) continue;
    const A = P.addrOf(TL[n].si);
    for (const e of bp.ev.pitched) { const k = A[e.voice] || e.voice; out[k] = (out[k] || 0) + 1; }
    out.drums = (out.drums || 0) + bp.ev.drums.length;
  }
  return out;
}
const sameCounts = (a, b) => JSON.stringify(Object.entries(a).filter(([, v]) => v).sort()) === JSON.stringify(Object.entries(b).filter(([, v]) => v).sort());

async function prop(L, o) {
  switch (o.p) {
    case "roll-twice": {
      if (!editing(L) || !L.CELL) return null;
      const R = L.roll(), cell = L.DOC.material.cells[L.CELL];
      const before = JSON.stringify(cell);
      // a free step: no note starts on it, and none held over it (a tap there would cut a held note short)
      const busy = new Set();
      if (cell.kind !== "drum") for (const [at, len] of L.cellNotes(cell)) for (let i = at; i < at + len; i++) busy.add(i);
      const s0 = Math.floor(o.x * R.steps), ri = Math.floor(o.y * R.rows.length);
      let s = -1;
      for (let k = 0; k < R.steps; k++) {
        const c = (s0 + k) % R.steps;
        const row = R.rows[ri].key;
        if (cell.kind === "drum" ? !L.cellNotes(cell).some(([at, , rr]) => at === c && rr === row) : !busy.has(c)) { s = c; break; }
      }
      if (s < 0) return null;
      const row = R.rows[ri].key;
      tapRoll(L, s, ri); await frame();
      const cell2 = L.DOC.material.cells[L.CELL];
      if (!L.cellNotes(cell2).some(([at, , rr]) => at === s && rr === row)) return `roll-twice: a tap at step ${s}, row ${row} put no note in ${L.CELL}`;
      tapRoll(L, s, L.roll().rowIndex(row)); await frame();
      const after = JSON.stringify(L.DOC.material.cells[L.CELL]);
      // (vel/acc of an untouched note may be rewritten to the same values; compare what plays)
      if (JSON.stringify(L.cellNotes(JSON.parse(after))) !== JSON.stringify(L.cellNotes(JSON.parse(before))))
        return `roll-twice: step ${s}, row ${row} tapped twice and ${L.CELL} is not as it was`;
      return null;
    }
    case "mute-cuts": {
      if (L.READ) return null;
      const m = [3, 2, 1, 0].find((k) => L.members()[k] && L.SCORE && L.SCORE.parts[k].length) ?? -1;
      if (m < 0) return null;
      const was = L.MINE;
      if (was >= 0) L.setMine(was, false, true);
      const all = chairCounts(L);
      L.setMine(m, true, true);
      const cut = chairCounts(L);
      const gone = Object.keys(all).filter((k) => all[k] && !cut[k]);
      const moved = Object.keys(all).filter((k) => cut[k] && cut[k] !== all[k]);
      L.setMine(m, false, true);
      const back = chairCounts(L);
      if (was >= 0) L.setMine(was, true, true);
      if (gone.length !== 1) return `mute-cuts: muting member ${m} silenced ${gone.length} chairs (${gone.join(",") || "none"})`;
      if (moved.length) return `mute-cuts: muting member ${m} changed ${moved.join(",")}`;
      if (!sameCounts(all, back)) return `mute-cuts: unmuted, the band is not as it was`;
      return null;
    }
    case "stop-stops": {
      if (!L.playing) return null;
      click(L.READ ? $("rPlay") : $("play")); await frame();
      if (L.playing) return "stop-stops: stop pressed and still playing";
      if (L.songBeatNow() !== -1) return "stop-stops: stopped and the clock still runs";
      return null;
    }
    case "plays-on": {
      if (!L.playing) return null;
      const t0 = performance.now();
      while (L.playing && L.songBeatNow() < 0) {
        if (performance.now() - t0 > 20000) return "plays-on: pressed play, nothing heard in 20 s";
        await sleep(100);
      }
      if (!L.playing) return null;
      const b0 = L.songBeatNow(); await sleep(1200);
      if (!L.playing) return null;
      const b1 = L.songBeatNow();
      // (a looped section comes round: forward is forward modulo the loop)
      if (!(b1 > b0) && !(L.loop != null && b1 < b0)) return `plays-on: the beat did not move (${b0.toFixed(2)} -> ${b1.toFixed(2)})`;
      return null;
    }
    case "read-keeps": {
      if (L.READ) return null;
      const before = JSON.stringify(L.DOC.material.cells), sel = L.SEL;
      click($("readBtn")); await frame();
      if (!L.READ) return "read-keeps: read along did not open the reading view";
      click($("rExit")); await frame();
      if (L.READ) return "read-keeps: done did not leave the reading view";
      if (JSON.stringify(L.DOC.material.cells) !== before) return "read-keeps: reading changed a motif";
      if (sel >= 0 && L.SEL !== sel) return `read-keeps: member ${sel} was open, ${L.SEL} after`;
      return null;
    }
    case "genre-clean": {
      if (L.READ) return null;
      const a = L.anchors, g = a[Math.floor(o.x * a.length)];
      await L.loadGenre(g, 1 + Math.floor(o.y * 999)); await frame();
      if (L.GENRE !== g) return `genre-clean: asked for ${g}, got ${L.GENRE}`;
      if (L.SEL !== -1 || L.MINE !== -1 || L.loop != null) return `genre-clean: a new genre kept sel ${L.SEL}, mine ${L.MINE}, loop ${L.loop}`;
      return null;
    }
    case "staff-shows": {
      const S = L.staff(), part = L.READ ? L.PART : L.MINE >= 0 ? L.MINE : L.SEL;
      if (part < 0 || $("sheet").hidden || !L.SCORE) return null;
      await frame();
      const want = new Set(L.SCORE.parts[part].map((n) => n.midi + "@" + Math.round(n.beat * 48))).size;
      if (S.notes.length !== want) return `staff-shows: the staff holds ${S.notes.length} notes, member ${part} plays ${want}`;
      if (L.READ && S.opts.ahead !== L.prefs.ahead) return `staff-shows: look-ahead ${S.opts.ahead}, asked ${L.prefs.ahead}`;
      if (L.READ && S.ppb) {
        const W = S.W, head = Math.round(W * S.opts.head), bpb = (S.bars[0] && S.bars[0].beats) || 4;
        const want2 = Math.max(26, Math.min(140, (W - head - 12) / (S.opts.ahead * bpb)));
        if (Math.abs(S.ppb - want2) > 0.5) return `staff-shows: ${S.ppb.toFixed(1)} px a beat, ${want2.toFixed(1)} asked`;
      }
      return null;
    }
  }
  return null;
}

/* ---------- a fresh record ---------- */
const PREFS0 = { ahead: 2, names: false, chords: true, sync: 0, mute: true };
export async function reset(L, seed) {
  if (L.playing) click($("play"));
  if (L.READ) L.exitRead();
  L.resetPrefs(PREFS0);
  if (L.rotate) await L.rotate("desktop");
  const g = L.anchors[(seed * 7919) % L.anchors.length];
  await L.loadGenre(g, seed);
  await frame();
}

/* ---------- a walk ---------- */
const kindOf = (f) => f.replace(/[-\d.]+/g, "#");
function label(o) {
  return o.op === "prop" ? "prop " + o.p : o.op === "rail" ? "rail " + o.b : o.op === "key" ? "key " + o.code
    : o.op === "read-opt" ? "opt " + o.o : o.op;
}
export async function walk(L, { seed, n = 60, given = null, graph = null, errors = [], onStep = null }) {
  const r = rng(seed), done = [], tried = new Map();
  // the page's own dice (the "new song" button, a blink) drawn from the walk's,
  // so a replay rolls the same genres
  const realRandom = Math.random, rr = rng(seed ^ 0x9e3779b9);
  Math.random = rr;
  try {
    await reset(L, seed);
    errors.length = 0;
    const steps = given ? given.length : n;
    for (let i = 0; i < steps; i++) {
      let o;
      const from = state(L);
      if (given) o = given[i];
      else {
        const can = OPS.filter(([, , ok]) => ok(L));
        const t = tried.get(from) || new Set();
        const fresh = can.filter(([k]) => !t.has(k));
        const pool = fresh.length && r() < 0.5 ? fresh : can;
        let w = pool.reduce((a, x) => a + x[1], 0) * r();
        const kind = pool.find((x) => (w -= x[1]) < 0) || pool[0];
        o = kind[3](r, L);
        t.add(kind[0]); tried.set(from, t);
      }
      let fail = null;
      try { fail = await apply(L, o); } catch (e) { fail = `threw: ${e && e.message || e}`; }
      await frame(); await sleep(20);
      done.push(o);
      if (!fail && errors.length) fail = `page error: ${errors[0]}`;
      if (!fail) { const c = L.check(); if (c) fail = `invariant: ${c}`; }
      const to = state(L);
      if (graph) {
        graph.states.set(from, (graph.states.get(from) || 0) + 1);
        const k = `${from}\t${label(o)}\t${to}`;
        graph.edges.set(k, (graph.edges.get(k) || 0) + 1);
      }
      if (onStep) onStep(i, o, to, fail);
      if (fail) return { fail, ops: done, at: i };
    }
    return null;
  } finally {
    Math.random = realRandom;
  }
}

export async function shrink(L, seed, ops, fail, errors, budget = 40) {
  let cur = ops, chunk = Math.max(1, Math.floor(cur.length / 2)), tries = 0;
  while (chunk >= 1 && tries < budget) {
    let cut = false;
    for (let i = 0; i < cur.length && tries < budget; i += chunk) {
      const cand = cur.slice(0, i).concat(cur.slice(i + chunk));
      if (!cand.length) continue;
      tries++;
      const res = await walk(L, { seed, given: cand, errors });
      if (res && kindOf(res.fail) === kindOf(fail)) { cur = res.ops; cut = true; i -= chunk; }
    }
    if (!cut) chunk = Math.floor(chunk / 2);
  }
  return cur;
}

// the whole run: walks, the failures (one of each kind, shrunk), the graph
export async function run(L, { walks = 6, ops = 60, seed = 1, errors = [], onStep = null, onWalk = null } = {}) {
  const graph = { states: new Map(), edges: new Map() }, fails = new Map();
  let nops = 0;
  for (let w = 0; w < walks; w++) {
    const s = seed + w;
    const res = await walk(L, { seed: s, n: ops, graph, errors, onStep });
    nops += res ? res.at + 1 : ops;
    if (onWalk) onWalk(w, res);
    if (!res) continue;
    const k = kindOf(res.fail);
    if (fails.has(k)) { fails.get(k).count++; continue; }
    const small = await shrink(L, s, res.ops, res.fail, errors);
    fails.set(k, { fail: res.fail, seed: s, count: 1, replay: small });
  }
  await reset(L, seed);
  const edges = [...graph.edges].map(([k, n]) => { const [from, op, to] = k.split("\t"); return { from, op, to, n }; });
  return { walks, ops: nops, states: Object.fromEntries(graph.states), edges, fails: [...fails.values()] };
}

export function dot(res) {
  const ids = new Map(Object.keys(res.states).map((s, i) => [s, "s" + i]));
  return "digraph lilguys {\n  rankdir=LR; node [shape=box, fontsize=9]; edge [fontsize=7];\n" +
    Object.entries(res.states).map(([s, n]) => `  ${ids.get(s)} [label="${s}\\n${n}"];`).join("\n") + "\n" +
    res.edges.filter((e) => e.from !== e.to && ids.has(e.to)).map((e) => `  ${ids.get(e.from)} -> ${ids.get(e.to)} [label="${e.op} ${e.n}"];`).join("\n") + "\n}\n";
}

/* ---------- on the page itself (a phone): #fuzz ---------- */
export async function runInPage(L, opts) {
  const box = document.createElement("div");
  box.id = "fuzzbox";
  box.setAttribute("role", "status");
  box.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:50;max-width:min(520px,90vw);max-height:45vh;overflow:auto;" +
    "background:#0e0e14ee;color:#ececf0;border:1px solid #ffd24a;border-radius:10px;padding:10px 12px;font:12px/1.4 ui-monospace,monospace";
  document.body.appendChild(box);
  const errors = [];
  addEventListener("error", (e) => errors.push(String(e.message || e)));
  addEventListener("unhandledrejection", (e) => errors.push(String(e.reason && e.reason.message || e.reason)));
  let line = "";
  const paint = (extra) => { box.innerHTML = `<b>fuzzing this page</b> — ${opts.walks} walks of ${opts.ops}, seed ${opts.seed}<br>${line}${extra || ""}`; };
  paint("starting…");
  const res = await run(L, { ...opts, errors,
    onStep: (i, o, to) => { if (i % 3 === 0) { line = `step ${i + 1}: ${label(o)} → ${to}<br>`; paint(); } },
    onWalk: (w, r) => { line = `walk ${w + 1}: ${r ? "FAIL " + r.fail : "ok"}<br>`; paint(); } });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  line = `${res.walks} walks, ${res.ops} operations; ${Object.keys(res.states).length} states, ${res.edges.length} edges<br>`;
  paint(res.fails.length
    ? res.fails.map((f) => `<p style="color:#ff7a54">FAIL ${esc(f.fail)} (${f.count}×, seed ${f.seed}, shrunk to ${f.replay.length})<br>` +
        `<code style="user-select:all;word-break:break-all">${esc(JSON.stringify(f.replay))}</code></p>`).join("")
    : `<p style="color:#54d6be">all ok</p>`);
  window.__lilFuzz = res;
  return res;
}

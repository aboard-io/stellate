/* tools/genres/grammar.js — THE CLOSURE GRAMMAR, both directions.
 *
 * `entry`, `reg`, `realize` and `word` are functions on every genre row, and a
 * function does not survive JSON. The genre-QA closure census (2026-09-02)
 * measured what those functions actually ARE: 12 distinct shapes of `entry`
 * over 421 rows, 19 of `reg`, 5 of `realize`. They are not programs. They are a
 * handful of tiny arithmetic sentences said over and over, and this file is
 * those sentences written down as DATA — nine template kinds and one escape
 * hatch — with `match()` reading a closure into a template and `emit()`
 * writing a template back out as the same source text.
 *
 * The law both directions share: emit(match(f)) must BEHAVE like f, and the
 * migration proved it by calling every closure in the catalogue over v = 0..8
 * and s = 0..7 and comparing the outputs (tools/genres/extract.js --prove).
 *
 * A RESULT — what a template's value slots hold — is one of:
 *   a JSON number or string   the closure returns it literally
 *   { "$v": true }            the closure returns the voice index itself
 *   { "$src": "…" }           source text, emitted verbatim (this is how a
 *                             `word` returns [drop(2), transpose(-12)])
 *
 * A THIRD DIRECTION, 2026-09-07: `compile()`. `emit()` writes SOURCE, and the
 * only way to get a working closure back out of source is `eval` — which
 * `tools/remix.js resolveRow` did, and which a page under a strict CSP is
 * entitled to refuse. But a template is data, and data can be interpreted:
 * `compile(t)` builds the same closure by CONSTRUCTION, out of nine little
 * arrow functions written here once. It refuses `formula` by name (that kind
 * IS source text and there is nothing to interpret) and it refuses a `$src`
 * result slot it cannot resolve, which is exactly right — a caller that wants
 * `[drop(2)]` is asking for the WORDS scope and has to say so.
 *
 * The law compile shares with the other two: compile(t) must BEHAVE like
 * eval("(" + emit(t) + ")"), and test/genres-build.test.js proves it over
 * every closure in the catalogue.
 */
"use strict";
(function (root) {
"use strict";
/* The body below is NOT REINDENTED by the 2026-09-07 UMD wrap; the diff is the
   head, `compile` at the foot, and the export line. Nothing else moved. */

/* ---- reading: an acorn node -> a template ------------------------------- */

const isV = (n) => n && n.type === "Identifier" && n.name === "v";
const litNum = (n) =>
  n && n.type === "Literal" && typeof n.value === "number" ? n.value
  : n && n.type === "UnaryExpression" && n.operator === "-" &&
    n.argument.type === "Literal" && typeof n.argument.value === "number"
    ? -n.argument.value : null;

function resultOf(n, src) {
  if (isV(n)) return { $v: true };
  if (n.type === "Literal" && (typeof n.value === "number" || typeof n.value === "string"))
    return n.value;
  const num = litNum(n);
  if (num !== null) return num;
  return { $src: src.slice(n.start, n.end) };
}

/* `v === 0`, or `v === 0 || v === 3`, read as the list of matched indices */
function testOf(n) {
  if (n.type === "BinaryExpression" && n.operator === "===" && isV(n.left)) {
    const k = litNum(n.right);
    return k === null ? null : [k];
  }
  if (n.type === "LogicalExpression" && n.operator === "||") {
    const a = testOf(n.left), b = testOf(n.right);
    return a && b ? a.concat(b) : null;
  }
  return null;
}

function match(fn, src) {
  const formula = { kind: "formula", src: src.slice(fn.start, fn.end) };
  if (fn.type !== "ArrowFunctionExpression" || fn.async || fn.generator) return formula;
  const ps = fn.params;
  const body = fn.body;
  if (body.type === "BlockStatement") return formula;

  if (ps.length === 0) return { kind: "const", n: resultOf(body, src) };
  if (ps.length !== 1 || !isV(ps[0])) return formula;

  if (isV(body)) return { kind: "id" };

  if (body.type === "UnaryExpression" && body.operator === "-" && isV(body.argument))
    return { kind: "neg" };

  if (body.type === "BinaryExpression") {
    const { operator: op, left: L, right: R } = body;
    if (isV(L) && litNum(R) !== null) {
      if (op === "*") return { kind: "scale", n: litNum(R) };
      if (op === "+") return { kind: "plus",  n: litNum(R) };
      if (op === "-") return { kind: "minus", n: litNum(R) };
    }
    if (isV(R) && litNum(L) !== null) {
      if (op === "-") return { kind: "from", n: litNum(L) };
      /* `1 + v` is `v + 1` said the other way round — acid is the one row */
      if (op === "+") return { kind: "plus", n: litNum(L) };
    }
    return formula;
  }

  /* v => [a, b, c][v] */
  if (body.type === "MemberExpression" && body.computed && isV(body.property) &&
      body.object.type === "ArrayExpression" &&
      body.object.elements.every((e) => e && litNum(e) !== null))
    return { kind: "table", t: body.object.elements.map(litNum) };

  if (body.type === "ConditionalExpression") {
    const cases = [];
    let n = body;
    while (n.type === "ConditionalExpression") {
      const at = testOf(n.test);
      if (!at) return formula;
      cases.push({ at: at.length === 1 ? at[0] : at, then: resultOf(n.consequent, src) });
      n = n.alternate;
    }
    return { kind: "cases", cases, else: resultOf(n, src) };
  }
  return formula;
}

/* ---- writing: a template -> source text --------------------------------- */

const KINDS = ["id", "const", "scale", "plus", "minus", "neg", "from", "table",
               "cases", "formula"];

const num = (x) => (Object.is(x, -0) ? "-0" : String(x));
function res(r) {
  if (r && typeof r === "object") {
    if (r.$v) return "v";
    if (typeof r.$src === "string") return r.$src;
    throw new Error("bad result slot: " + JSON.stringify(r));
  }
  if (typeof r === "number") return num(r);
  if (typeof r === "string") return JSON.stringify(r);
  throw new Error("bad result slot: " + JSON.stringify(r));
}

function emit(t) {
  switch (t.kind) {
    case "id":      return "v => v";
    case "const":   return "() => " + res(t.n);
    case "scale":   return "v => v * " + num(t.n);
    case "plus":    return "v => v + " + num(t.n);
    case "minus":   return "v => v - " + num(t.n);
    case "neg":     return "v => -v";
    case "from":    return "v => " + num(t.n) + " - v";
    case "table":   return "v => [" + t.t.map(num).join(", ") + "][v]";
    case "cases": {
      const arms = t.cases.map((c) => {
        const at = Array.isArray(c.at) ? c.at.map((k) => "v === " + num(k)).join(" || ")
                                       : "v === " + num(c.at);
        return at + " ? " + res(c.then);
      });
      return "v => (" + arms.join(" : ") + " : " + res(t.else) + ")";
    }
    case "formula": return t.src;
    default: throw new Error("unknown template kind: " + t.kind);
  }
}

/* ---- checking: is this object a template at all? ------------------------ */

function validResult(r) {
  if (typeof r === "number" || typeof r === "string") return true;
  return !!(r && typeof r === "object" &&
            (r.$v === true || typeof r.$src === "string"));
}
function validate(t, where) {
  const bad = (m) => { throw new Error(where + ": " + m); };
  if (!t || typeof t !== "object") bad("not a template");
  if (!KINDS.includes(t.kind)) bad("unknown template kind " + JSON.stringify(t.kind));
  if (t.kind === "const" && !validResult(t.n)) bad("const needs a result in `n`");
  if (["scale", "plus", "minus", "from"].includes(t.kind) && typeof t.n !== "number")
    bad(t.kind + " needs a number in `n`");
  if (t.kind === "table" && (!Array.isArray(t.t) || !t.t.every((x) => typeof x === "number")))
    bad("table needs an array of numbers in `t`");
  if (t.kind === "cases") {
    if (!Array.isArray(t.cases) || !t.cases.length) bad("cases needs a non-empty `cases`");
    for (const c of t.cases) {
      const at = Array.isArray(c.at) ? c.at : [c.at];
      if (!at.length || !at.every((x) => typeof x === "number")) bad("a case needs numeric `at`");
      if (!validResult(c.then)) bad("a case needs a result in `then`");
    }
    if (!validResult(t.else)) bad("cases needs a result in `else`");
  }
  if (t.kind === "formula" && typeof t.src !== "string") bad("formula needs `src`");
  return true;
}

/* ---- interpreting: a template -> a real closure, with no `eval` ---------- *
 *
 * `resolveSrc` is the one door a `$src` result slot goes through. It knows the
 * two shapes the catalogue's own JSON actually uses in a result slot and
 * nothing more: `TABLE.key` against the tables the caller hands in, and a bare
 * JSON literal (`[]` is 219 of the 219 remix rows' `word`). Everything else —
 * `[drop(2)]`, `{ ...MOUTHS.hymnal }`, a whole arrow function — is SOURCE in
 * a scope this file does not have, and it says so by returning a miss rather
 * than by guessing.
 */
function resolveSrc(src, tables) {
  const m = /^(\w+)\.(\w+)$/.exec(src);
  if (m && tables && tables[m[1]] && tables[m[1]][m[2]] !== undefined)
    return { ok: true, v: tables[m[1]][m[2]] };
  const lit = src.trim();
  if (/^(\[[\s\d.,+-]*\]|-?\d+(\.\d+)?|"[^"\\]*"|true|false|null)$/.test(lit)) {
    try { return { ok: true, v: JSON.parse(lit) }; } catch (e) { /* fall through */ }
  }
  return { ok: false, why: src };
}

/** a result slot -> (v) => value. Throws by name on a `$src` it cannot read. */
function resFn(r, tables, where) {
  if (r && typeof r === "object") {
    if (r.$v === true) return (v) => v;
    if (typeof r.$src === "string") {
      const got = resolveSrc(r.$src, tables);
      if (!got.ok) throw new Error(where + ": compile cannot read $src " +
        JSON.stringify(r.$src) + " without eval — it names a scope this file does not have");
      return () => got.v;
    }
    throw new Error(where + ": bad result slot " + JSON.stringify(r));
  }
  if (typeof r === "number" || typeof r === "string") return () => r;
  throw new Error(where + ": bad result slot " + JSON.stringify(r));
}

/** compile(t, { tables, where }) -> the closure emit(t) would have described. */
function compile(t, opt) {
  opt = opt || {};
  const tables = opt.tables || null;
  const where = opt.where || "template";
  validate(t, where);
  switch (t.kind) {
    case "id":      return (v) => v;
    case "const":   { const f = resFn(t.n, tables, where); return () => f(undefined); }
    case "scale":   return (v) => v * t.n;
    case "plus":    return (v) => v + t.n;
    case "minus":   return (v) => v - t.n;
    case "neg":     return (v) => -v;
    case "from":    return (v) => t.n - v;
    case "table":   { const tt = t.t.slice(); return (v) => tt[v]; }
    case "cases": {
      const arms = t.cases.map((c) => ({
        at: Array.isArray(c.at) ? c.at.slice() : [c.at],
        then: resFn(c.then, tables, where) }));
      const els = resFn(t.else, tables, where);
      return (v) => {
        for (const a of arms) if (a.at.includes(v)) return a.then(v);
        return els(v);
      };
    }
    case "formula":
      throw new Error(where + ": compile refuses `formula` — that kind IS source " +
        "text (" + JSON.stringify(t.src.slice(0, 40)) + "), and interpreting it would " +
        "be writing a second JavaScript");
    default: throw new Error(where + ": unknown template kind " + JSON.stringify(t.kind));
  }
}

const api = { match, emit, compile, resolveSrc, validate, KINDS };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.NuGenreGrammar = api;
})(typeof window !== "undefined" ? window : globalThis);

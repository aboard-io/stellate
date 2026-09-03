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
 */
"use strict";

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

module.exports = { match, emit, validate, KINDS };

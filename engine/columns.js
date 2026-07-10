// columns.js — COLUMNAR EVENTS (vector-kernel STEP 1, docs/NEXT.md §5b).
// The event fabric as struct-of-arrays: numeric fields become Float64Array
// columns, everything else rides along per-row, and the array-of-objects can
// be rebuilt BYTE-IDENTICALLY (JSON.stringify-equal, key insertion order and
// absent-vs-undefined distinctions preserved). Engine passes use the columns
// as a COMPUTE VIEW over the live event objects — toColumns at entry,
// elementwise ops, writeBack into the same objects — so nothing downstream
// ever sees a re-materialized row. fromColumns exists for the round-trip
// proof and for future passes that want to own the materialization.
//
//   toColumns(events, fields[, opts]) -> cols
//     cols = { n, fields, <f>:Float64Array…, mask:{<f>:Uint8Array}, keys, rest }
//     A field lands in its column iff the row holds it as typeof "number"
//     (mask 1); every other key/value pair (strings, bend objects, solo
//     flags, undefined-valued keys, non-numeric field values) is kept in
//     rest[i] in encounter order. keys[i] is the row's full key order — the
//     byte-identity ledger. opts.view (the engine's hot path) skips keys/rest:
//     the columns are then a pure numeric view (writeBack works, fromColumns
//     doesn't).
//   fromColumns(cols) -> array of objects, JSON.stringify-identical to the
//     input rows: keys rebuilt in original insertion order, column fields
//     from the (possibly transformed) columns, everything else from rest —
//     a key that held undefined comes back present-with-undefined, an absent
//     key stays absent.
//   writeBack(cols, events[, fields]) -> assign column values back into the
//     ORIGINAL row objects (mask-gated: a row that never had the field never
//     grows it).
//   map(col, fn, mask?)    col[i] = fn(col[i], i)      — in place
//   scale(col, s, mask?)   col[i] *= s (scalar or per-row array)
//   shift(col, d, mask?)   col[i] += d (scalar or per-row array)
//   where(col, pred) -> Uint8Array   per-row predicate mask
//   and(a, b) -> Uint8Array          mask conjunction
//
// UMD like the other engine files: node module.exports + browser
// root.CsdColumns. No dependencies, no rng, no state.
(function (root) {
  "use strict";

  // cols carries its columns at the top level (the §5b sketch:
  // { n, beat:[], dur:[], amp:[], rest:[] }) — so field names that would
  // collide with the bookkeeping slots are refused loudly.
  const RESERVED = { n: 1, fields: 1, mask: 1, keys: 1, rest: 1 };

  function toColumns(events, fields, opts) {
    if (!Array.isArray(events)) throw new Error("toColumns: events array required");
    if (!Array.isArray(fields) || !fields.length) throw new Error("toColumns: fields array required");
    for (const f of fields) if (RESERVED[f]) throw new Error("toColumns: reserved field name: " + f);
    const view = !!(opts && opts.view);
    const n = events.length;
    const cols = { n, fields: fields.slice(), mask: {}, keys: view ? null : new Array(n), rest: view ? null : new Array(n) };
    const want = {};
    for (const f of fields) { want[f] = 1; cols[f] = new Float64Array(n); cols.mask[f] = new Uint8Array(n); }
    for (let i = 0; i < n; i++) {
      const e = events[i];
      if (view) {
        for (const f of fields) { const v = e[f]; if (typeof v === "number") { cols[f][i] = v; cols.mask[f][i] = 1; } }
        continue;
      }
      const keys = Object.keys(e);          // the row's true key order (JSON.stringify order)
      cols.keys[i] = keys;
      let rest = null;
      for (const k of keys) {
        const v = e[k];
        if (want[k] && typeof v === "number") { cols[k][i] = v; cols.mask[k][i] = 1; }
        else (rest || (rest = {}))[k] = v;  // incl. undefined values — present-with-undefined ≠ absent
      }
      cols.rest[i] = rest;
    }
    return cols;
  }

  function fromColumns(cols) {
    if (!cols || !cols.keys) throw new Error("fromColumns: needs full columns (not a {view:true} compute view)");
    const n = cols.n, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = {}, keys = cols.keys[i], rest = cols.rest[i];
      for (const k of keys) {
        const m = cols.mask[k];
        o[k] = (m && m[i]) ? cols[k][i] : rest[k];
      }
      out[i] = o;
    }
    return out;
  }

  function writeBack(cols, events, fields) {
    const fs = fields || cols.fields;
    for (const f of fs) {
      const col = cols[f], m = cols.mask[f];
      if (!col || !m) throw new Error("writeBack: no such column: " + f);
      for (let i = 0; i < cols.n; i++) if (m[i]) events[i][f] = col[i];
    }
    return events;
  }

  // ---- elementwise ops (Float64Array in, in place, optional mask) ----
  function map(col, fn, mask) {
    for (let i = 0; i < col.length; i++) if (!mask || mask[i]) col[i] = fn(col[i], i);
    return col;
  }
  function scale(col, s, mask) {
    if (typeof s === "number") { for (let i = 0; i < col.length; i++) if (!mask || mask[i]) col[i] *= s; }
    else { for (let i = 0; i < col.length; i++) if (!mask || mask[i]) col[i] *= s[i]; }
    return col;
  }
  function shift(col, d, mask) {
    if (typeof d === "number") { for (let i = 0; i < col.length; i++) if (!mask || mask[i]) col[i] += d; }
    else { for (let i = 0; i < col.length; i++) if (!mask || mask[i]) col[i] += d[i]; }
    return col;
  }
  function where(col, pred) {
    const m = new Uint8Array(col.length);
    for (let i = 0; i < col.length; i++) if (pred(col[i], i)) m[i] = 1;
    return m;
  }
  function and(a, b) {
    const m = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) if (a[i] && b[i]) m[i] = 1;
    return m;
  }

  const api = { toColumns, fromColumns, writeBack, map, scale, shift, where, and };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdColumns = api;
})(typeof window !== "undefined" ? window : globalThis);

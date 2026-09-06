/* tools/genres/emit.js — a genre row, written back out as JavaScript.
 *
 * The half of the round trip that turns `nukernel/genres/<key>.json` into the
 * text of `nukernel/genres.js`. Nothing here decides anything: every choice it
 * makes (one field to a line, this line width, this way of breaking a long
 * string) is a LAYOUT choice, and the only law layout has to keep is that it is
 * DETERMINISTIC — `test/genres-build.test.js` holds the shipped file to being
 * byte-for-byte what a fresh build says, the way gates.js and wiki.js are held.
 */
"use strict";
const { emit: emitTemplate } = require("./grammar.js");

const WIDTH = 96;               // the column the emitter tries to stay inside
// `throat` joined the four 2026-09-04 (the per-chair singer round): WHOSE
// THROAT each chair is, by chair index, in one of the five words
// `fields.js THROATS` publishes. Same grammar, same round trip; see
// GENRES.md §3.
const CLOSURES = ["entry", "reg", "realize", "word", "throat"];

const isSrc = (v) => v && typeof v === "object" && !Array.isArray(v) &&
                     typeof v.$src === "string" && Object.keys(v).length === 1;

const numTxt = (n) => (Object.is(n, -0) ? "-0" : String(n));

/* A long string is broken into a concatenation at spaces, so a 400-character
   `cannot` reads as prose in the file instead of running off the screen. The
   break points are a function of the string alone, so a rebuild lands them in
   the same places. */
function strTxt(s, indent, room) {
  const one = JSON.stringify(s);
  if (indent + one.length <= WIDTH || !s.includes(" ")) return one;
  const words = s.split(" ");
  const parts = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i] + (i === words.length - 1 ? "" : " ");
    if (cur && indent + JSON.stringify(cur + w).length > WIDTH) { parts.push(cur); cur = w; }
    else cur += w;
  }
  if (cur) parts.push(cur);
  const pad = " ".repeat(room);
  return parts.map(JSON.stringify).join(" +\n" + pad);
}

function valueTxt(v, indent, room) {
  if (v === null) return "null";
  if (typeof v === "number") return numTxt(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return strTxt(v, indent, room);
  if (isSrc(v)) return v.$src;
  if (Array.isArray(v)) {
    const flat = "[" + v.map((x) => valueTxt(x, 0, 0)).join(", ") + "]";
    if (indent + flat.length <= WIDTH && !flat.includes("\n")) return flat;
    const pad = " ".repeat(room + 2);
    return "[\n" + v.map((x) => pad + valueTxt(x, room + 2, room + 2)).join(",\n") +
           "\n" + " ".repeat(room) + "]";
  }
  const keys = Object.keys(v);
  if (!keys.length) return "{}";
  const pair = (k, at) => keyTxt(k) + ": " + valueTxt(v[k], at + keyTxt(k).length + 2, at);
  const flat = "{ " + keys.map((k) => pair(k, 0)).join(", ") + " }";
  if (indent + flat.length <= WIDTH && !flat.includes("\n")) return flat;
  const pad = " ".repeat(room + 2);
  return "{\n" + keys.map((k) => pad + pair(k, room + 2)).join(",\n") +
         "\n" + " ".repeat(room) + "}";
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const keyTxt = (k) => (IDENT.test(k) ? k : JSON.stringify(k));

/* the note, back out as the comment block it was */
function noteTxt(note, pad) {
  if (!note) return "";
  return note.split("\n")
    .map((L) => (L.trim() ? pad + "// " + L : pad + "//"))
    .join("\n") + "\n";
}

function rowTxt(key, row) {
  const pad = "    ", fpad = "      ";
  let out = noteTxt(row.note, pad);
  out += pad + keyTxt(key) + ": {\n";
  for (const f of Object.keys(row)) {
    /* `note` is the row's prose and comes out above the row, not inside it.
       `copyist` (2026-09-06, THEORY.md §2) is the other field that is ABOUT the
       row without being ON it: it leaves the module in its own COPYIST table,
       built by build.js, because a new key on GENRES.punk would move the
       pinned row-key baseline test/table.test.js T2b holds every anchor to. */
    if (f === "note" || f === "copyist") continue;
    const head = fpad + keyTxt(f) + ": ";
    const txt = CLOSURES.includes(f)
      ? emitTemplate(row[f])
      : valueTxt(row[f], head.length, fpad.length);
    out += head + txt + ",\n";
  }
  out += pad + "},\n";
  return out;
}

module.exports = { rowTxt, valueTxt, noteTxt, WIDTH, CLOSURES };

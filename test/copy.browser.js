#!/usr/bin/env node
/* test/copy.browser.js — EVERY WORD ON THE RENDERED PAGE CAME FROM THE
 * CATALOGUE, OR IT IS DATA.
 *
 * (nukernel/TABLE.md §11 "THE FUNCTIONAL TEXT PASS" and §12b; the voice is
 * nukernel/DESIGN.md §4.) Its twin, test/copy.test.js, reads the catalogue
 * itself — the budgets, the banned patterns, the duplicate meanings. THIS one
 * reads the ARTIFACT, and it exists because a source sweep cannot see the 477
 * strings this page composes at RUNTIME ([[test-the-artifact]]: three features
 * shipped broken while every check passed).
 *
 * WHAT IS ASSERTED, on every surface the copy audit walked
 *   B0  zero pageerror, zero console error, on every surface.
 *   B1  THE PAGE ASKED FOR NOTHING THE CATALOGUE DOES NOT HOLD. `COPY.missing()`
 *       is empty — a missing key prints as the key, which is a control with a
 *       machine name on it.
 *   B2  NO BANNED PATTERN IS PRINTED. The twenty families, required off
 *       test/copy.test.js so the two gates hold one copy of them.
 *   B3  NOTHING IS OVER BUDGET — a chip or a face ≤ 6 words, a sentence
 *       (title · aria-label · data-say · data-why · alt) ≤ 12, counted by the
 *       audit's `copyWords`.
 *   B4  EVERY PRINTED STRING WAS PRODUCED BY THE CATALOGUE, or is DATA. `t()`
 *       stamps every string it hands back (`COPY.produced()`), so a string
 *       with a filled placeholder is recognised whole; anything left over must
 *       match one of the carve-outs below, and the carve-outs are named,
 *       counted and printed on every run.
 *
 * THE CARVE-OUTS, and each is an argument rather than a silencer. Two are
 * about WHERE a string is and the rest about WHAT it is:
 *   · GENRE AND PLACE NAMES ARE DATA. `New wave of British heavy metal`,
 *     `Kingston 1969` are catalogue rows — the app's subject matter, not its
 *     copy. Skipped inside `#atlasIndexRows` and the globe's `#atlasMarks`.
 *   · A VALUE CONTROL PRINTS ITS VALUE. An `<option>`, or a control whose
 *     `data-v`/`data-k` ENDS IN THE WORD IT IS PRINTING, is showing the
 *     vocabulary, not saying something about it. So are the four faces that
 *     are the record itself: a column head's instrument, a row head's section
 *     name, a cell's own word, the bar's genre plate.
 *   · THE MUSICIAN'S VOCABULARY IS DATA, and it is read OFF THE PAGE'S OWN
 *     TABLES rather than listed here, so it cannot drift from what the app
 *     holds: the genres and their answers, the instruments, this record's
 *     sections and players and phrases, `fields.js`'s value tables, the genre
 *     tables, `askable.js`'s performance words and the ornament policies they
 *     name, `ideas-kit.js`'s contours and landings, `kernel.js`'s ornaments,
 *     and `compose.js`'s form plans. (`fields.js FIELDS` is NOT read: a
 *     field's LABEL is copy, and the catalogue owns it.)
 *   · A NUMBER WITH A UNIT, A TIME SIGNATURE, A NOTE OR CHORD NAME, AND AN
 *     ENUMERATED READOUT ARE DATA. `79 BPM`, `4/4`, `D natural minor`,
 *     `bass 1, groove 2, chorus 6`, `intro, verse, chorus`.
 *   · A READOUT IS A LIST OF WHOLE STRINGS. The page joins two catalogue
 *     sentences with " — " or " · " to make one face out of two facts; every
 *     SEGMENT must still be produced or data.
 *   · A SENTENCE WITH A CONTROL STANDING IN IT — the Rules deck's "Tempo 76
 *     BPM", which is `[name, the widget, its unit]` and not a sentence
 *     anybody typed — passes by COVERAGE: strike every produced string, then
 *     every value, and no letters may remain.
 *   · A SINGLE GLYPH or a run of punctuation is a mark, not a word.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/copy.browser.js
 *      …--page URL   walk a server you already have
 *      …--report     print the residue grouped, and every surface's counts
 */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const { BANNED, copyWords } = require("./copy.test.js");

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
const REPORT = argv.includes("--report");
const RECORD = "#at=Kingston&y=1969&s=1";      // the audit's own record, named
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"])
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  return path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };

const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* ===== THE COLLECTOR — the copy audit's own, unchanged =================
   Every visible text node plus every title / aria-label / data-say / data-why
   / placeholder / data-unit / alt, each with a short selector so a failure
   says WHERE. It runs in the page. */
const COLLECT = function () {
  const sel = (el) => { const p = []; let n = el, d = 0;
    while (n && n.nodeType === 1 && d < 5) {
      let s = n.tagName.toLowerCase();
      if (n.id) { p.unshift("#" + n.id); break; }
      const c = String(n.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      if (c) s += "." + c;
      p.unshift(s); n = n.parentElement; d++;
    }
    return p.join(">"); };
  const vis = (el) => { const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return false;
    const cs = getComputedStyle(el);
    return !(cs.visibility === "hidden" || cs.display === "none"); };
  const out = [];
  const push = (text, kind, el) => {
    if (text == null) return;
    text = String(text).replace(/\s+/g, " ").trim();
    if (!text) return;
    /* THE CARVE-OUTS THAT ARE ABOUT WHERE A STRING IS.
       1 · the genre index and the globe's marks are catalogue ROWS.
       2 · A VALUE CONTROL PRINTS ITS VALUE'S OWN NAME, and a value is the
           musician's vocabulary, not the app's copy: `dorian`, `laid back`,
           `clean guitar`, `hook`. The test is the ADDRESS — an <option>, or a
           control whose `data-v`/`data-k` ends in the very word being printed
           (slugged both sides). A control that prints something OTHER than its
           value is copy and stays in the residue, which is the line this round
           actually cares about. */
    const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "");
    const addr = el.closest("[data-v],[data-k]");
    const av = addr && (addr.getAttribute("data-v") ||
                        (addr.getAttribute("data-k") || "").split(/[|]/).pop());
    /* …AND FOUR PLACES THE RECORD ITSELF IS PRINTED, named by the class the
       page already uses for them: a column head's INSTRUMENT, a row head's
       SECTION name, a cell's own WORD, and the bar's GENRE plate. Those are
       the document — an instrument's name, a section a person named, a phrase
       out of the bank — and DESIGN.md §2.1 says a cell shows its value. The
       catalogue owns the words ABOUT them, never the names themselves. */
    const DOCFACE = ".nu-colinstr, .nu-srowname, .nu-cellword .nu-w, " +
                    /* A CHIP IS A WORD (DESIGN.md §2, component 7): the word
                       on a chip is the VALUE it writes, which is the
                       vocabulary's. A chip that printed copy would be a chip
                       that does not name what it does. */
                    ".nu-wchip, " +
                    /* ...AND A LOZENGE IS A CHIP THAT KNOWS ITS KIND
                       (2026-09-05, DESIGN.md §2 component 16). The same
                       argument one line up, on the widget that replaced the
                       native picker for the long vocabularies: the word on a
                       lozenge is the VALUE it writes — `the mode`, `harmonic
                       minor`, `tom fill` — and it is the musician's, not the
                       app's. It needs saying because the words used to be
                       `<option>`s, which the tag test above carved out; the
                       strings did not change, the element did. */
                    ".nu-lz, " +
                    "#nu-bar .nu-sub2, .nu-circ";
    const isValue = !!(av && slug(av) === slug(text)) ||
                    /^(option|optgroup)$/i.test(el.tagName) ||
                    !!el.closest(DOCFACE);
    const data = isValue || !!(el.closest("#atlasIndexRows") ||
                 el.closest("#atlasMarks") || el.closest("svg"));
    out.push({ text, kind, sel: sel(el), data });
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = w.nextNode())) {
    const s = t.nodeValue && t.nodeValue.replace(/\s+/g, " ").trim();
    if (!s) continue;
    const el = t.parentElement;
    if (!el) continue;
    if (/^(script|style|template|title)$/i.test(el.tagName)) continue;
    push(s, (!vis(el) || el.closest(".nu-vh")) ? "text-hidden" : "text", el);
  }
  for (const el of document.querySelectorAll(
      "[title],[aria-label],[data-say],[data-why],[placeholder],[data-unit],[alt]"))
    for (const a of ["title", "aria-label", "data-say", "data-why",
                     "placeholder", "data-unit", "alt"]) {
      const v = el.getAttribute(a);
      if (v) push(v, a, el);
    }
  return out;
};

/* WHAT THE APP ITSELF CALLS DATA, read off the page rather than listed here —
   the genres, the instruments, the note and chord names, the kits' op words,
   and the record's own section and player names. A list written in this file
   would be a second copy of a vocabulary that moves every round. */
const VOCAB = function () {
  const words = new Set();
  const add = (s) => { if (typeof s === "string") { const x = s.trim();
    if (x && x.length < 40) words.add(x); } };
  const G = globalThis;
  /* 1 · THE CATALOGUE OF GENRES — every row's key and its printed name. */
  try { const GEN = (G.NuGenres && G.NuGenres.GENRES) || G.GENRES || {};
    for (const k of Object.keys(GEN)) { add(k); const r = GEN[k] || {};
      add(r.label); add(r.name); add(r.place); add(r.word); } } catch (e) {}
  /* 2 · THE INSTRUMENTS — an instrument's name is the thing, not a word about
     it ("clean guitar", "yamaha grand piano"). */
  try { const IN = G.NuInstruments || {};
    const eat = (o, d) => { if (!o || d > 2) return;
      if (Array.isArray(o)) { for (const x of o) eat(x, d + 1); return; }
      if (typeof o === "string") { add(o); return; }
      if (typeof o === "object")
        for (const k of Object.keys(o)) { add(k); eat(o[k], d + 1); } };
    eat(IN.INSTRUMENTS || IN.NAMES || IN, 0); } catch (e) {}
  /* 3 · THIS RECORD'S OWN NAMES — its sections, its players, its phrases.
     They are the document, printed back; a person typed most of them. */
  try { const d = (G.__eightDoc && G.__eightDoc()) || null;
    if (d) {
      /* THE SECTIONS LIVE UNDER `form` — `d.sections` is undefined and the
         first version of this read it, which is how "prechorus" reached the
         residue while every other section name was covered by ROLES. */
      for (const s2 of ((d.form || {}).sections || []).concat(d.sections || []))
        { add(s2.name); add(s2.id); add(s2.role); }
      for (const v of d.voices || []) { add(v.name); add(v.id); add(v.inst);
        add(v.kind); add(v.part);
        for (const m of Object.values(v.material || {})) add(m); }
      for (const m of Object.keys((d.material || {}).prov || {})) add(m);
      for (const b of Object.keys(d.bank || {})) add(b);
    } } catch (e) {}
  /* 3b · THE ATLAS'S OWN NAMES — WHERE AND WHEN, WHICH ARE DATA (WAVE C,
     2026-09-06). `nukernel/atlas.js` is a committed table of places and of the
     era words those places' years fall in; `atlas.gate.js` G5b holds every one
     of those words to a REAL catalogue year, which is exactly the test that
     makes it data rather than prose. The globe prints the places on its marks,
     the index prints them in its rows, and the era chips print the era words —
     three surfaces, one table, and not one of the strings is a sentence about
     the app.
     IT WAS ADDED WHEN THE CHIPS ARRIVED and it covers what was already there:
     before wave C the only atlas words on a sampled surface were places, which
     rode in on the genres' own `label` ("Bristol 1991"); the chips print the
     era words on their own and had nowhere to ride. Read off the page's table,
     never listed here, for the reason the block at the top of `VOCAB` gives. */
  try { const A = G.NuAtlas || {};
    for (const n of Object.keys(A.PLACES || {})) add(n);
    for (const n of Object.keys(A.ALIAS || {})) add(n);
    for (const e of A.ERAS || []) add(e && e.w); } catch (e) {}
  /* 4 · THE VOCABULARY'S OWN WORDS — every value a menu can offer. They are
     the tables `nukernel/fields.js` exports whose NAME says they are words for
     values (`*LABEL`, `*NAMES`, `*WORDS`, `*CHOICES`): `SWINGLABEL`,
     `PARTNAMES`, `KEYNAMES`, `ORNLABEL` and their forty siblings. A value is
     the musician's vocabulary, not the app's copy, and reading it off the
     page's own tables is what stops this list from drifting. The FIELDS table
     itself is NOT read — a field's LABEL is copy and is held by the
     catalogue. */
  try { const NF = G.NuFields || {};
    const eat = (o, d) => { if (!o || d > 2) return;
      if (typeof o === "string") { add(o); return; }
      if (Array.isArray(o)) { for (const x of o) eat(x, d + 1); return; }
      if (typeof o === "object") for (const k of Object.keys(o)) eat(o[k], d + 1); };
    /* A VOCABULARY TABLE IS A FLAT TABLE OF SHORT WORDS — `{straight: "the
       grid", swung: "shuffle"}`, `["intro","verse","chorus"]`. That shape is
       what a menu offers; a table of OBJECTS is a registry (fields.js FIELDS)
       and its labels are copy, so those are not read here. */
    const flatWords = (o) => {
      if (!o || typeof o !== "object") return false;
      const vs = Object.values(o);
      if (!vs.length || vs.length > 200) return false;
      return vs.every((v) => typeof v === "string" && v.length < 32 &&
                             v.split(/\s+/).length <= 4);
    };
    for (const k of Object.keys(NF)) {
      if (/(LABEL|NAMES?|WORDS|CHOICES)$/.test(k)) { eat(NF[k], 0); continue; }
      let v; try { v = NF[k]; } catch (e) { continue; }
      if (flatWords(v)) { eat(v, 0); for (const kk of Object.keys(v)) add(kk); }
      /* …and a table of ROWS, each with its own word: `VOICINGS`,
         `PLAYMODES` — `{vox: {w: "sung", g: "◉"}}`. The `w` is the word the
         mark wears, and it is the value's name. */
      if (v && typeof v === "object" && !Array.isArray(v))
        for (const kk of Object.keys(v)) {
          const row = v[kk];
          if (row && typeof row === "object" && typeof row.w === "string")
            { add(row.w); add(kk); }
        }
    }
    /* the same tables on the GENRE side — the modes, the scales, the
       ornaments, the contours, the dynamics: `genres-tables.js`'s own
       vocabulary, which a genre row answers with. */
    const NG2 = G.NuGenres || {};
    for (const k of Object.keys(NG2)) {
      if (/(LABEL|NAMES?|WORDS|FAMILY|ORNAMENT|DYNAMICS|CONTOUR|MODES|SCALES)$/i.test(k)) {
        eat(NG2[k], 0); continue; }
      let v; try { v = NG2[k]; } catch (e) { continue; }
      if (flatWords(v)) { eat(v, 0); for (const kk of Object.keys(v)) add(kk); }
    } } catch (e) {}
  /* 5 · THE PERFORMANCE WORDS — `askable.js`'s own vocabulary (the ornament
     policies, the stresses, the phrasings), which the Rules deck offers as
     chips: `pass`, `approach`, `grace`, `flam`, `roll`. */
  try { const NA = G.NuAskable || {};
    for (const r of NA.ASKABLE || [])
      for (const o of r.opts || []) {
        add(Array.isArray(o) ? o[0] : o);
        /* an ornament answer is a POLICY — `{grace: .4, approach: .4,
           pass: .4}` — and its parameter names are the chips the deck
           offers: pass · approach · grace · flam · roll. */
        const v2 = Array.isArray(o) ? o[1] : null;
        if (v2 && typeof v2 === "object")
          for (const kk of Object.keys(v2)) add(kk);
      } } catch (e) {}
  /* 5b · A GENRE ROW'S OWN ANSWERS are data — the words a genre says about
     itself ("hovers", "lands on the root", "four bars"), which the Rules deck
     prints back beside the name of the rule. */
  try { const GEN = (G.NuGenres && G.NuGenres.GENRES) || {};
    const eat2 = (o, d) => { if (!o || d > 2) return;
      if (typeof o === "string") { if (o.split(/\s+/).length <= 4) add(o); return; }
      if (Array.isArray(o)) { for (const x of o) eat2(x, d + 1); return; }
      if (typeof o === "object") for (const k of Object.keys(o)) eat2(o[k], d + 1); };
    for (const k of Object.keys(GEN)) {
      const row = GEN[k] || {};
      for (const f of Object.keys(row)) {
        if (f === "note" || f === "why" || f === "plate") continue;
        eat2(row[f], 0);
      }
    } } catch (e) {}
  /* 5c · THE KITS' AND THE KERNEL'S OWN TABLES — the contours and landings a
     phrase can have (`ideas-kit.js` CONTOURS/LANDINGS, each row's `w`) and the
     ornament marks the kernel plays (`kernel.js` ORN: grace · flam · roll).
     A musician's words, and the audit keeps all 258 of them. */
  try { const KIT = G.NuIdeas || {};
    for (const k of Object.keys(KIT)) {
      let v; try { v = KIT[k]; } catch (e) { continue; }
      if (!v || typeof v !== "object") continue;
      for (const kk of Object.keys(v)) { const row = v[kk];
        if (typeof row === "string") add(row);
        else if (row && typeof row === "object") { add(kk); add(row.w); add(row.says); } }
    } } catch (e) {}
  try { const K = G.NuKernel || {};
    for (const t2 of ["ORN", "QMARK", "QUALFAM"])
      if (K[t2] && typeof K[t2] === "object")
        for (const kk of Object.keys(K[t2])) add(kk); } catch (e) {}
  /* 5c2 · THE BUSES' OWN NAMES — `fields.js BUSES` rows carry the name each
     bus is called by default ("genre fx", "delay") and `BUSNAMES` the names a
     hand can give one. A bus's name is the desk's vocabulary. */
  try { const NF2 = G.NuFields || {};
    for (const r of NF2.BUSES || []) { add(r.label); add(r.bus); } } catch (e) {}
  /* 5d · THE FORM PLANS — `compose.js PLANS` is the list of section roles a
     plan lays out (`intro, verse, prechorus, chorus, bridge, solo, outro`),
     and the Rules deck prints the record's own plan back beside the rule that
     chose it. The record's form is data. */
  try { const NC = G.NuCompose || {};
    for (const k of Object.keys(NC.PLANS || {})) { add(k);
      for (const r of NC.PLANS[k] || []) add(r); } } catch (e) {}
  /* 6 · THE PHRASE BANK's own names, wherever the host keeps them. */
  try { const bank = G.__eightBank && G.__eightBank();
    if (bank) for (const r of (Array.isArray(bank) ? bank : Object.keys(bank)))
      add(typeof r === "string" ? r : (r && (r.name || r.id))); } catch (e) {}
  return [...words];
};

/** Is this string DATA rather than copy? The carve-outs, in one place. */
function isData(text, vocab) {
  /* a leading or trailing separator is punctuation, not a word: the genre
     plate's second line arrives as "· Kingston 1969". */
  const s = text.replace(/^\s*[·|—–]\s*|\s*[·|—–]\s*$/g, "").trim();
  if (!s) return true;
  if (vocab.has(s) || vocab.has(s.toLowerCase())) return true;
  /* A LIST OF VALUES IS A VALUE. "intro, verse, prechorus, chorus" is the
     record's own form said back; every member has to be in the vocabulary. */
  if (s.indexOf(",") > 0) {
    const bits = s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
    if (bits.length > 1 && bits.every((x) => vocab.has(x) ||
        vocab.has(x.toLowerCase()) || /^[\d.]+$/.test(x))) return true;
  }
  /* a mark, a number, a number with a unit, a time signature, a key name */
  if (/^[^\w]+$/.test(s)) return true;
  if (s.length <= 2) return true;
  if (/^[−+-]?\d+(\.\d+)?\s?(BPM|dB|ms|s|%|×|st|Hz|kHz|bit|kbps|bars?|beats?|steps?)?$/i.test(s)) return true;
  if (/^\d+\/\d+$/.test(s)) return true;
  /* a `·`-joined readout: data if every segment is */
  if (/[·|]/.test(s)) {
    const segs = s.split(/\s*[·|]\s*/).filter(Boolean);
    if (segs.length > 1 && segs.every((x) => isData(x, vocab))) return true;
  }
  /* AN ENUMERATED READOUT — "verse 4, verse 7", "bass 1, groove 2, chorus 6":
     where a phrase is played, said as the record's own section names and bar
     numbers. Data, and the audit's `copyWords` counts it as one token for the
     same reason. */
  if (/^[a-z][\w' -]* \d+(, ?[a-z][\w' -]* \d+)+$/i.test(s)) return true;
  /* a note or chord name, a scale degree, a bar address */
  if (/^[A-G][#b♯♭]?( ?(major|minor|dorian|phrygian|lydian|mixolydian|aeolian|locrian|natural minor|harmonic minor|melodic minor))?$/i.test(s)) return true;
  if (/^[A-G][#b♯♭]?(maj|min|m|dim|aug|sus)?\d*(\/[A-G][#b♯♭]?)?$/.test(s)) return true;
  return false;
}

/** A readout's segments: the page joins whole strings with " · " and " — ". */
function segsOf(text) {
  return String(text).split(/\s+[·|]\s+|\s+[—–]\s+/)
    .map((x) => x.trim()).filter(Boolean);
}

/* the vocabulary, longest word first — computed once per run, not per string. */
let VOCAB_BY_LEN = null;
function byLen(vocab) {
  if (!VOCAB_BY_LEN) VOCAB_BY_LEN = [...vocab].filter((v) => v.length > 1)
    .sort((a, b) => b.length - a.length);
  return VOCAB_BY_LEN;
}

/* A STRIKE IS ON WHOLE WORDS, AND THIS IS NOT A REFINEMENT — IT IS THE BUG
   (2026-09-05). `rest.split(p).join(…)` struck a catalogue string ANYWHERE it
   appeared, including inside another word, and the catalogue holds two-letter
   strings: `row.ending.off` is "no". So striking it out of "mode natural
   minor" left "natural mi   r", the vocabulary's own "natural minor" no longer
   matched, and the residue reported was "natural" — a word nobody printed.
   Both residues this gate carried reduced to that one substitution ("key: D
   natural minor · meter: 4/4" lost the same three letters), and it was red on
   v281 too, so it is older than the design pass and is a fault in the STRIKE
   and not in the page. A letter-boundary is the whole fix: a needle that
   begins with a letter may not start in the middle of a word, and one that
   ends with a letter may not end in the middle of one. The same guard is put
   on the vocabulary strike below, which had the identical hole. */
const strike = (rest, needle) => {
  const headL = /[A-Za-z]/.test(needle[0]);
  const tailL = /[A-Za-z]/.test(needle[needle.length - 1]);
  let out = "", i = 0;
  for (;;) {
    const at = rest.indexOf(needle, i);
    if (at < 0) { out += rest.slice(i); return out; }
    const before = at > 0 ? rest[at - 1] : " ";
    const after = rest[at + needle.length] || " ";
    const ok = !(headL && /[A-Za-z]/.test(before)) &&
               !(tailL && /[A-Za-z]/.test(after));
    out += rest.slice(i, at) + (ok ? "   " : needle);
    i = at + needle.length;
  }
};

/** Strike every catalogue string, then every value, and see if letters remain. */
function covered(text, byLength, vocab) {
  let rest = " " + String(text) + " ";
  for (const p of byLength) {
    if (p.length < 2) continue;
    if (rest.indexOf(p) < 0) continue;
    rest = strike(rest, p);
    if (!/[A-Za-z]/.test(rest)) return true;
  }
  /* what a value looks like: a number, a number with a unit, a chord numeral,
     a note name, and any word the record's own vocabulary holds. */
  rest = rest.replace(/[−+-]?\d+(\.\d+)?\s?(BPM|dB|ms|s|%|×|st|Hz|kHz|bit|kbps|bars?|beats?|steps?|lanes?)?/gi, " ");
  /* LONGEST FIRST, or a short word eats a long one's middle: striking `root`
     out of "lands on the root" leaves "lands on the", which matches nothing
     and reads as copy. (Measured: the Landing rule's own line.) */
  for (const v of byLen(vocab)) if (rest.indexOf(v) >= 0)
    rest = strike(rest, v);
  rest = rest.replace(/\b[ivxIVX]+\b|\b[A-G][#b♯♭]?\b/g, " ");
  /* a one- or two-letter token left standing is a value's own short name
     (the touch curve's `t`), not a word of copy. */
  rest = rest.replace(/\b[A-Za-z]{1,2}\b/g, " ");
  return !/[A-Za-z]/.test(rest);
}

function budgetFor(kind) {
  if (kind === "data-unit") return 2;
  if (kind === "title" || kind === "aria-label" || kind === "data-say" ||
      kind === "data-why" || kind === "alt") return 12;
  return 6;
}

(async () => {
  console.log("\ncopy.browser — every word on the page came from the catalogue");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] });
  const errs = [];
  const seen = [];              // {surface, text, kind, sel, data}
  const surfaces = [];

  try {
    const p = await b.newPage({ viewport: { width: 430, height: 1600 }, hasTouch: true });
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|COOP|COEP/i.test(m.text()))
      errs.push("console: " + m.text()); });
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE + RECORD, { waitUntil: "load" });
    /* WAIT FOR THE RECORD, NOT FOR A CLOCK — the box boots on `silence` and the
       address lands the anchor a moment later. */
    await p.waitForFunction(() => document.querySelectorAll(
      "table.nu-sheetgrid tbody tr").length > 1, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);

    const snap = async (name) => {
      const items = await p.evaluate(COLLECT);
      for (const it of items) seen.push({ surface: name, ...it });
      surfaces.push({ name, n: items.length });
      if (REPORT) console.log("  … " + name.padEnd(28) + items.length);
    };
    const tap = async (sel, name, wait = 900) => {
      const el = await p.$(sel);
      if (!el) { if (REPORT) console.log("  … (no " + name + ")"); return false; }
      await el.click({ force: true, timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(wait);
      return true;
    };

    await snap("boot (the sheet at rest)");

    /* THE FIVE SPECIAL ROWS — time · rules · motifs · mix · produce. */
    const heads = await p.$$("tr.nu-sprow .nu-sphead, .nu-sprow button.nu-sphead");
    for (let i = 0; i < heads.length && i < 6; i++) {
      const nm = await heads[i].evaluate((e) =>
        (e.getAttribute("data-k") || e.getAttribute("aria-label") || e.textContent || "")
          .trim().slice(0, 20)).catch(() => "row " + i);
      await heads[i].click({ force: true, timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(1100);
      await snap("special row: " + nm);
      await p.keyboard.press("Escape").catch(() => {});
      await p.waitForTimeout(300);
    }

    /* A CELL: selected, then its editor. */
    const cells = await p.$$("table.nu-sheetgrid tbody tr td button");
    if (cells.length) {
      await cells[0].click({ force: true, timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(600);
      await snap("a cell selected");
      await cells[0].click({ force: true, timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(900);
      await snap("a cell in its editor");
      await p.keyboard.press("Escape").catch(() => {});
      await p.waitForTimeout(300);
    }

    /* A PLAYER (a column head) and its sheet, with the op bar's refusals. */
    if (await tap("th.nu-colhead button", "a player's sheet", 1400))
      await snap("a player's sheet");
    /* A SECTION (a row head). */
    if (await tap("tbody th button", "a section's sheet", 1200))
      await snap("a section's sheet");

    /* THE MIX BOARD AND ITS FIVE TABS. The board is the second-biggest page
       of the catalogue (104 keys) and every one of its strips, sends, plates
       and meters is drawn behind one of these tabs, so a walk that only
       opened the master row would be reporting on a tenth of it. */
    const master = await p.$('tr.nu-masterrow .nu-sphead, [data-k="tfoot|master"]');
    if (master) {
      await master.click({ force: true, timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(1400);
      await snap("the mix board");
      const tabs = await p.$$("#boardtabs button");
      for (let i = 0; i < tabs.length && i < 6; i++) {
        const nm = await tabs[i].evaluate((e) =>
          (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 18))
          .catch(() => "tab " + i);
        await tabs[i].click({ force: true, timeout: 4000 }).catch(() => {});
        await p.waitForTimeout(900);
        await snap("board tab: " + nm);
      }
      await p.keyboard.press("Escape").catch(() => {});
      await p.waitForTimeout(300);
    }

    /* THE TRANSPORT BAR AND THE HAMBURGER'S DECKS. */
    await snap("the transport bar");
    if (await tap("#burger", "the hamburger", 800)) {
      await snap("the hamburger");
      const decks = await p.$$("#nu-menu button");
      for (let i = 0; i < decks.length && i < 5; i++) {
        const nm = await decks[i].evaluate((e) =>
          (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 18))
          .catch(() => "deck " + i);
        await decks[i].click({ force: true, timeout: 4000 }).catch(() => {});
        await p.waitForTimeout(1400);
        await snap("deck: " + nm);
        await p.keyboard.press("Escape").catch(() => {});
        await p.waitForTimeout(300);
        await tap("#burger", "the hamburger", 500);
      }
      await p.keyboard.press("Escape").catch(() => {});
    }

    /* WHERE — the globe and the genre index. */
    await p.evaluate(() => { const a = document.getElementById("atlas");
      if (a) { a.hidden = false; a.classList.add("is-on"); } }).catch(() => {});
    await p.waitForTimeout(1800);
    await snap("WHERE");

    /* WHAT THE CATALOGUE PRODUCED, AND WHAT IT WAS ASKED FOR AND DID NOT HOLD. */
    const runtime = await p.evaluate(() => {
      const C = globalThis.COPY;
      return C ? { produced: C.produced(), missing: C.missing(),
                   keys: Object.keys(C.STRINGS).length }
               : null;
    });
    const vocab = new Set(await p.evaluate(VOCAB));
    await p.close();

    check(!!runtime, "B_ the catalogue is on the page (globalThis.COPY)");
    if (!runtime) throw new Error("no catalogue on the page");
    console.log("  … " + runtime.keys + " keys · " + runtime.produced.length +
      " strings produced · " + seen.length + " printed strings collected over " +
      surfaces.length + " surfaces");

    check(!errs.length, "B0 no page error on any surface" +
      (errs.length ? " — " + errs.length + ": " + errs.slice(0, 3).join(" · ") : ""));

    check(!runtime.missing.length, "B1 the page asked for no key the catalogue lacks" +
      (runtime.missing.length ? " — " + runtime.missing.slice(0, 8).join(", ") : ""));

    /* B2 — the banned patterns, on everything but the data surfaces. */
    const banned = [];
    for (const it of seen) {
      if (it.data) continue;
      for (const [name, re] of BANNED)
        if (re.test(it.text))
          banned.push(name + " · " + it.surface + " · " + it.kind + " · " +
                      JSON.stringify(it.text.slice(0, 90)));
    }
    const bannedU = [...new Set(banned)];
    check(!bannedU.length, "B2 no banned pattern is printed" +
      (bannedU.length ? " — " + bannedU.length + ": " + bannedU.slice(0, 6).join("\n         ") : ""));

    /* B3 — the budgets. */
    const over = [];
    for (const it of seen) {
      if (it.data || isData(it.text, vocab)) continue;
      /* A RENDERED READOUT IS MEASURED SEGMENT BY SEGMENT. A `data-say` on
         this page is often two whole facts a separator apart — "Set by the
         genre." and "Changes nothing that plays." — and each is a catalogue
         string inside its own budget. The budget is about how much a person
         reads at once in ONE claim, so the longest claim is what is held; the
         catalogue gate (C2) still holds every key whole. */
      const b2 = budgetFor(it.kind);
      const w = Math.max(...segsOf(it.text).map(copyWords));
      if (w > b2) over.push(it.kind + " " + w + ">" + b2 + " · " + it.surface + " · " +
        JSON.stringify(it.text.slice(0, 90)));
    }
    const overU = [...new Set(over)];
    check(!overU.length, "B3 nothing printed is over budget" +
      (overU.length ? " — " + overU.length + ": " + overU.slice(0, 6).join("\n         ") : ""));

    /* B4 — every printed string came from the catalogue, or is data. */
    const produced = new Set(runtime.produced);
    /* longest first, so "Tempo {n} BPM" is struck before "Tempo". */
    const byLength = [...produced].sort((a, b) => b.length - a.length);
    const residue = new Map();
    for (const it of seen) {
      if (it.data) continue;
      const s = it.text;
      if (produced.has(s)) continue;
      if (isData(s, vocab)) continue;
      /* …AND A READOUT IS A LIST OF THEM. The page joins whole catalogue
         sentences with " — " and " · " to make one face out of two facts (a
         refusal and its tier; a level and its tone). Every SEGMENT must still
         be a catalogue string or data — nothing new is being let through —
         but a caller is allowed to put two of them on one line, which is what
         a readout is. */
      const segs = segsOf(s);
      if (segs.length > 1 &&
          segs.every((x) => produced.has(x) || isData(x, vocab))) continue;
      /* …AND A SENTENCE WITH A CONTROL STANDING IN IT. The Rules deck draws
         each rule as PARTS — `[the name, the value, its unit]` — and puts the
         widget itself at the value's slot (`rules.js` `val(…, slot: true)`),
         so what a reader sees is "Tempo 76 BPM": three catalogue-and-data
         pieces on one line, not a sentence anybody typed. COVERAGE is the
         test: strike every string the catalogue produced out of the text,
         then every number, unit and vocabulary word, and what is left must
         hold no letters. Nothing new gets through — every WORD still has to
         come from the catalogue or be data — but a caller may stand a control
         inside its own label, which is what this surface is. */
      if (covered(s, byLength, vocab)) continue;
      const k = it.kind + " · " + JSON.stringify(s.slice(0, 100));
      if (!residue.has(k)) residue.set(k, it.surface + " " + it.sel);
    }
    check(!residue.size, "B4 every printed string came from the catalogue" +
      (residue.size ? " — " + residue.size + " not produced by t():\n         " +
        [...residue.entries()].slice(0, 25).map(([k, w]) => k + "   [" + w + "]")
          .join("\n         ") : ""));
    if (REPORT && residue.size) {
      const out = path.join(os.tmpdir(), "nu-copy-residue.json");
      fs.writeFileSync(out, JSON.stringify([...residue.entries()], null, 1));
      console.log("  … the whole residue is in " + out);
    }
  } finally {
    await b.close().catch(() => {});
    if (srv) srv.proc.kill();
  }

  console.log("\ncopy.browser: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// nukernel/desk-doc.js — WHERE THE DOCUMENT'S SOUND AXIS LANDS ON THE DESK.
//
// The model was never lost. `audio/desk.js` is 975 lines that answer what every
// control on a board is worth in the parent engine, `fields.js` PARTMIX/BUSES/
// MASTER is the vocabulary for saying it, and `ui/state.js` has held the stores
// since the one-engine round. What went missing was the WIRE: nothing read a
// document and wrote those stores, so the engineer had no surface and the rack
// had no reader (Paul, 2026-08-24: "we've lost the engineer entirely. we've lost
// buses and sending things to them and delay and reverb"). This file is that
// wire and nothing else — six functions, no DOM, no audio, no opinions.
//
// THE DOCUMENT SPEAKS THE REGISTRY'S OWN WORDS. A voice's `desk` entry IS a
// PARTMIX entry, `sound.master` IS a MASTER value, `sound.buses` IS a BUSES
// value — verbatim, no translation vocabulary anywhere. That is a rule, not a
// convenience: fields.js:643 records what a second spelling costs, which is
// that "touch" comes to mean 0.12 in one place and 0.15 in the other. desk-gate
// G3 asserts it by walking the registries rather than a hand-written list.
//
// ABSENT IS TODAY. No `voice.desk`, no `sound.buses` and no `sound.master`, and
// every function here answers null / null / null — which is
// exactly what ui/eight.js push() produced before this file existed, so
// `sec.parts` stays null, `deskUnits` takes the untouched branch and the audio
// is byte-identical. desk-gate G1 is the proof.
//
// UMD, the pattern songs.js / fields.js / document.js already use: node
// `require`s it, the page loads it as a classic <script> before the module tier
// runs, and ui/deps.js — the SOLE reader of window.* — is what hands it to a
// view.
(function (root, factory) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(isNode ? require("./fields.js") : root.NuFields);
  if (isNode) module.exports = api;
  else root.NuDeskDoc = api;
})(typeof self !== "undefined" ? self : this, function (F) {
  "use strict";

  const LINES = (doc) => (doc.voices || []).filter((v) => v.kind === "line");
  const BASSV = (doc) => (doc.voices || []).find((v) => v.kind === "bass");
  const DRUMV = (doc) => (doc.voices || []).find((v) => v.kind === "drums");
  const soundOf = (doc) => (doc && doc.sound) || {};

  /* ---------- THE ADDRESS -------------------------------------------------
     THE CHAIR KEY IS THE ADDRESS, AND IT IS THE DOCUMENT'S `cast.part`
     (2026-08-28, REVERSING what stood here). What stood here said the opposite,
     and said why: "ui/eight.js hands the kernel `realize`, never `part`, so
     partOf answers pad-or-line and a voice the document calls a `counter` is
     addressed `line2`. Adding `g.part` would fix the name and MOVE THE MUSIC,
     so the name stays wrong here." Both halves of that are now settled the
     other way. document.js toGenre hands the kernel `part: v =>
     lines[v].cast.part`, so the chair the document casts IS the chair the
     kernel plays — 421 of 1081 seated chairs were addressed as a role nobody
     was playing, and the wrap this file copied ("part[v % part.length]") was
     the fault, not the workaround. The music it would have moved has moved,
     deliberately, in the same round.

     So this reads the ONE owner of the fact and derives nothing: no anchor
     lookup, no wrap, no pad-or-line assumption. `GENRES` stays in the
     signature — every caller passes it and the parameter is part of the
     published shape — and is no longer consulted. desk-gate G2 still pins this
     walk to audio/desk.js voiceRoster's, because a drift between them silently
     re-addresses every stored entry. */
  function chairsOf(doc, GENRES) {          // eslint-disable-line no-unused-vars
    return F.chairKeys(LINES(doc).map((c) => (c.cast && c.cast.part) || "line"));
  }

  // THE ONE WALK. Every other function here reads it, so the board's columns,
  // the stored entries and the gate's address check cannot disagree about which
  // voice owns which channel — a drift there re-addresses every stored strip
  // silently, which is the failure mode `desk` lives ON THE VOICE to avoid.
  //
  // THE BASS CHAIR EXISTS WHENEVER A BASS VOICE DOES, style or no style —
  // because that is what the audio tier answers. document.js toGenre writes
  // `nobass: !bass` off the VOICE's existence, and audio/desk.js partKeysOf
  // pushes "bass" whenever `!genreOf(sec).nobass`. Gating this on `cast.style`
  // would have read better and failed G2.
  function channelVoicesOf(doc, GENRES) {
    const lines = LINES(doc);
    const keys = chairsOf(doc, GENRES);
    const out = lines.map((v, i) => ({ key: keys[i], voice: v }));
    const b = BASSV(doc);
    if (b) out.push({ key: "bass", voice: b });
    const d = DRUMV(doc);
    if (d && d.cast && d.cast.on) out.push({ key: "drums", voice: d });
    return out;
  }
  // one chair key per voice, in the order the board draws: lines, bass, drums
  const channelsOf = (doc, GENRES) =>
    channelVoicesOf(doc, GENRES).map((c) => c.key);

  /* ---------- THE STORES THE PAGE ALREADY HAD ----------------------------- */
  // sec.parts — the map audio/desk.js partsOf reads. Entries are copied by
  // REFERENCE onto every box, deliberately: the Sound axis is one statement for
  // the whole record. (This parenthesis said "a per-SECTION desk is not
  // expressible today … until somebody wants a chorus louder than a verse" —
  // 2026-08-27 met the until: Paul's "some voices raise and some fall" put a
  // word grid on the board, and `voice.desk.trim[<secId>]` — fields.js TRIMS —
  // overlays a per-box COPY at push time, ui/eight.js. This walk stays
  // record-wide and carries no trim: the overlay's writer is push(), so the
  // shared-reference law here still holds for a record with no trims.)
  // An entry with nothing in it is dropped, and a map with no entries
  // becomes null — absent is the only spelling of a default
  // (main:nukernel/ui/mixtbl.js:351 writeField, the same law).
  function deskPartsOf(doc, GENRES) {
    const out = {};
    for (const c of channelVoicesOf(doc, GENRES)) {
      const e = cleanEntry(c.voice.desk);
      if (e) out[c.key] = e;
    }
    return Object.keys(out).length ? out : null;
  }
  /* sec.cellauto — THE CELL LANES OF ONE SECTION, keyed by the same chair
     address `deskPartsOf` keys (TABLE.md wave 3, 2026-09-04).

     ¶A: "we still want per-section mix automation, with per-cell relative to
     that." The section's own lanes are `mot` -> `auto[]` one tier down
     (audio/desk.js compileAuto); THIS is the other half — what each VOICE says
     on top of them in THIS section, as an offset in the mix layer's own
     dialect (fields.js cellAutoOffset).

     IT IS THE SAME WALK AS EVERY OTHER ADDRESS IN THIS FILE, and that is the
     whole reason it lives here rather than in document.js `boxesOf`: a cell
     override is stored on the COLUMN (`voice.cells[secId]`, TABLE.md §2) and
     the desk addresses a CHANNEL, so somebody has to map voice -> chair key.
     `channelVoicesOf` is that map, desk-gate G2 pins it to audio/desk.js
     `voiceRoster`, and a second copy of it would silently re-address every
     lane — the exact failure mode the comment above it names.

     ABSENT IS TODAY: a record where no hand has written a cell lane answers
     null for every section, `ui/eight.js push()` writes no `cellauto` key, and
     audio/desk.js appends nothing to its offset list. Byte-identical.

     PER SECTION, unlike `deskPartsOf`, because that is what a cell IS. */
  function cellAutoOf(doc, GENRES, secId) {
    if (secId == null) return null;
    const out = {};
    for (const c of channelVoicesOf(doc, GENRES)) {
      const cells = c.voice && c.voice.cells;
      const cell = cells && cells[secId];
      const off = cell ? F.cellAutoOffset(cell.mixauto) : null;
      if (off) out[c.key] = off;
    }
    return Object.keys(out).length ? out : null;
  }

  // WHAT SURVIVES OF A STORED ENTRY: the PARTMIX keys and nothing else, with
  // every dead spelling of a default removed. Walked off the registry rather
  // than listed, so a field added to PARTMIX is carried here by existing.
  function cleanEntry(e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    const o = {};
    for (const f of F.PARTMIX) {
      const v = e[f.key];
      if (v == null || v === "" || v === false) continue;
      if (Array.isArray(v)) { if (v.length) o[f.key] = v.slice(); continue; }
      if (f.type === "num" && !v) continue;              // 0 dB is no offset
      if (f.type === "eq" && F.eqIsFlat(v, f.bands)) continue;
      o[f.key] = v;
    }
    return Object.keys(o).length ? o : null;
  }

  // the two song-level stores, normalized by the registry's own predicates so
  // there is one spelling of "the engine's default" on both sides of a save
  const masterOf = (doc) => {
    const m = soundOf(doc).master;
    return F.masterIsDefault(m) ? null : m;
  };
  const busesOf = (doc) => {
    const b = soundOf(doc).buses;
    return F.busesIsDefault(b) ? null : b;
  };
  /* `boxFxOf` AND `writeBoxFx` ARE GONE (2026-08-27). They read and wrote
     `sound.fx`, the record-wide Character chain, which audio/desk.js sectionOf
     handed to every seated voice's insert chain. Paul: *"We can get rid of
     Character right? We don't really use it any more do we?"* — FUTURE.md §5
     had already ruled it ("the multiselect dies … dealt, not embedded"), and
     it is dealt: nukernel/precompose.js `deskThe` writes the anchor's chips
     into each chair's own `desk.fx`, and document.js `normalize` folds any
     already-saved `sound.fx` the same way at the door. The reader was
     `(soundOf(doc).fx || []).filter(k => F.FX[k]).slice(0, F.MAX_FX)`; the
     writer was `writeBoxFx(doc, list)`, and `deskIsDefault` counted it as a
     fourth term. One fact, one owner, and the owner is the strip. */

  // THE ABSENT-IS-TODAY PREDICATE, one function so the gate and the view ask
  // the same question. True means: this document says nothing the desk can
  // hear, and pushing it must produce the byte-identical boxes it always did.
  const deskIsDefault = (doc, GENRES) =>
    deskPartsOf(doc, GENRES) == null && masterOf(doc) == null &&
    busesOf(doc) == null;

  /* ---------- ONE WRITER ---------------------------------------------------
     Every surface that edits a voice's strip goes through here, for the reason
     mixtbl.js:351 gives: a chip, a slider and a checkbox must not disagree
     about what "off" spells. null / "" / false / 0 / [] DELETES the key, an
     emptied entry deletes the voice's `desk`, and nothing else writes it. */
  function writeDesk(voice, key, v) {
    const f = F.PARTMIXBY[key];
    const dead = v == null || v === "" || v === false ||
      (Array.isArray(v) && !v.length) ||
      (f && f.type === "num" && !v) ||
      (f && f.type === "eq" && F.eqIsFlat(v, f.bands));
    if (dead) {
      if (voice.desk) {
        delete voice.desk[key];
        if (!Object.keys(voice.desk).length) delete voice.desk;
      }
      return;
    }
    if (!voice.desk) voice.desk = {};
    voice.desk[key] = v;
  }
  // the same law one level up, for `sound.buses.<bus>.<knob>` and
  // `sound.master.<key>`: an emptied row deletes itself, an emptied map
  // deletes the key, and `sound` never carries an object that means nothing.
  function writeBus(doc, bus, knob, v) {
    const S = (doc.sound = doc.sound || {});
    const B = S.buses || {};
    const row = { ...(B[bus] || {}) };
    if (v == null || v === "") delete row[knob]; else row[knob] = v;
    const next = { ...B };
    if (Object.keys(row).length) next[bus] = row; else delete next[bus];
    S.buses = F.busesIsDefault(next) ? undefined : next;
    if (S.buses === undefined) delete S.buses;
  }
  function writeMaster(doc, key, v) {
    const S = (doc.sound = doc.sound || {});
    const M = { ...(S.master || {}) };
    if (v == null || v === "") delete M[key]; else M[key] = v;
    S.master = F.masterIsDefault(M) ? undefined : M;
    if (S.master === undefined) delete S.master;
  }
  return { channelsOf, channelVoicesOf, chairsOf, deskPartsOf, cellAutoOf,
           masterOf, busesOf,
           deskIsDefault, writeDesk, writeBus, writeMaster };
});

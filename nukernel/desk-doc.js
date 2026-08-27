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
// ABSENT IS TODAY. No `voice.desk`, no `sound.buses`, no `sound.master`, no
// `sound.fx` and every function here answers null / null / null / [] — which is
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
     THE CHAIR KEY IS THE ADDRESS, and it is NOT the document's `cast.part`.
     ui/eight.js hands the kernel `realize`, never `part` (document.js toGenre),
     so kernel.js:1140 partOf answers "pad" or "line" and nothing else — a voice
     the document calls a `counter` is addressed `line2`. Adding `g.part` would
     fix the name and MOVE THE MUSIC (kernel.js:1387 applies PARTS' ctr ±12 and
     maxHold), so the name stays wrong here and the BOARD prints the voice's own
     name instead. desk-gate G2 pins this walk to audio/desk.js voiceRoster's,
     because a drift between them silently re-addresses every stored entry.

     `GENRES` is optional and is read for ONE thing: a basis genre that declares
     its own `part` scheme. toGenre spreads the whole anchor before it overrides
     `realize`, so partOf reads that scheme when there is one — reproducing it
     here is derivation; assuming "pad-or-line" would be a second source of
     truth that happens to agree on today's catalog. */
  function chairsOf(doc, GENRES) {
    const lines = LINES(doc);
    const g = (GENRES && GENRES[doc.basis]) || {};
    const partAt = (v) => (g.part
      ? (typeof g.part === "function" ? g.part(v) : g.part[v % g.part.length])
      : (lines[v].cast && lines[v].cast.part === "pad" ? "pad" : "line"));
    return F.chairKeys(lines.map((c, v) => partAt(v)));
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
  // the record-wide character chip -> every box's own `fx` (audio/desk.js
  // sectionOf S.fx, which reaches every seated voice)
  const boxFxOf = (doc) =>
    (soundOf(doc).fx || []).filter((k) => Object.prototype.hasOwnProperty.call(F.FX, k))
      .slice(0, F.MAX_FX);

  // THE ABSENT-IS-TODAY PREDICATE, one function so the gate and the view ask
  // the same question. True means: this document says nothing the desk can
  // hear, and pushing it must produce the byte-identical boxes it always did.
  const deskIsDefault = (doc, GENRES) =>
    deskPartsOf(doc, GENRES) == null && masterOf(doc) == null &&
    busesOf(doc) == null && boxFxOf(doc).length === 0;

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
  function writeBoxFx(doc, list) {
    const S = (doc.sound = doc.sound || {});
    const l = (list || []).filter((k) => Object.prototype.hasOwnProperty.call(F.FX, k))
      .slice(0, F.MAX_FX);
    if (l.length) S.fx = l; else delete S.fx;
  }

  return { channelsOf, channelVoicesOf, chairsOf, deskPartsOf, masterOf, busesOf, boxFxOf,
           deskIsDefault, writeDesk, writeBus, writeMaster, writeBoxFx };
});

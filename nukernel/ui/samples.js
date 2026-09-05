// nukernel/ui/samples.js — THE SAMPLE CRATE.
//
// Paul, 2026-09-01: *"I can't really access or organize samples used in, say,
// San Francisco 1996. They aren't accessible to the app in any way."* He is
// exactly right, and the measurement is the argument: San Francisco 1996
// (`instrumentalhiphop`) seats THREE chairs — an electric piano, a string
// section and `found:collage:break_75_95`, which is TWELVE recorded breaks cut
// one per semitone across the counter line — plus a sampled `electronic` kit.
// That record reaches somewhere north of thirty files on disk and until today
// the page could not name ONE of them, could not sound one of them alone, and
// could not put a different one in its place. The instrument menu said
// "found:collage:break 75 95" and stopped.
//
// COMPOSER.md §5.1 asks for a Samples child under Band and a facet on any
// member whose chair is sampled: every file the record reaches, with audition,
// the loop strip, and a way to swap one for another of the same class.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE OWNS, AND WHAT IT REFUSES TO OWN
//
// IT OWNS ONE READER — `samplesOf(doc)` — and that reader is an EXTRACTION,
// never a typed list. Every file it names is derived from the table that
// already owned it:
//
//   a ZONE      `__REGISTRY.SAMPLERS[id]` — the GM library's own {dir, zones},
//               resolved to `found/samples/instruments/<dir>/<file>` by the
//               same arithmetic engine/genre-kernel.js applySampledOnly writes
//               onto `state.foundSources` and audio/audition.js `zoneFilesFor`
//               fetches. Two readers of one table, not two tables.
//   a KIT LANE  audio/audition.js `kitFilesFor([lane], kit)` — the one place on
//               this page that says which recording a nukernel drum lane is.
//               (audio/to-engine.js LANE says which HIT a lane wants and
//               genre-kernel DRUMKITS says which file that hit is; the join of
//               the two lives in audition.js and is asked here rather than
//               spelled a third time. instruments.js's own header names this
//               same seam: "the name a lane still needs — which hit of the kit
//               it is — lives in audio/to-engine.js LANE".)
//   a FOUND ROW `__REGISTRY.SOURCES` / `.SAMPLES` / `.SOURCE_POOLS` — the
//               registries audio/to-engine.js `recipeBase` itself reads to seat
//               a `found:` chair, walked here in the same order and with the
//               same rules (a collage takes its POOL; a pool member whose url
//               has a scheme cannot decode under COEP and is marked remote
//               rather than listed as a file).
//
// IT DOES NOT OWN A WRITE. Every swap goes through the sheet that already owns
// the field — avail.js `sound.instrument`, `sound.bassinstrument`,
// `sound.drumkit` — handed in by the caller as a spec. This file narrows the
// OFFER to a class and does not invent one word of it.
//
// ---------------------------------------------------------------------------
// WHAT THE RECORD REACHES, AND WHAT IT DOES NOT (measured 2026-09-02)
//
// `SFX` and a genre's BED LAYER are in the vocabulary below and NO row can
// carry them today, which is worth writing down rather than leaving as a
// puzzle. audio/plan.js builds every bar with `found: []` and to-engine.js
// returns `ev.found: []`: nukernel plays a genre's found layer through CHAIRS
// and through nothing else. So the crate is the chairs' files, and the day the
// bed layer arrives it arrives here as another walk over the same registries.
//
// ---------------------------------------------------------------------------
// THE SECOND PLAYER ON THIS PAGE, SAID OUT LOUD
//
// audio/audition.js holds one AudioContext, a decode cache and a stop verb, and
// it plays A MOTIF: a note list against a zone MAP. What the crate needs is one
// FILE, whole, at its own speed — and audition.js exports no door for a raw
// href. So the player at the foot of this file is a second one, and the two are
// made mutually exclusive rather than merely coexisting: `playSample` calls
// audition.js's own `stopAudition` first, and ui/eight.js `auditionOff` calls
// `stopSample`. One sound in the room. If a third caller ever wants a file
// played whole, the merge is to give audition.js a `playFile(href)` and delete
// the twenty lines at the bottom of this file — named here so the debt is a
// decision rather than a discovery.

import { isMachine, LANE } from "../audio/to-engine.js";
import { kitFilesFor, auditionKit, stopAudition } from "../audio/audition.js";
/* THE CATALOGUE (nukernel/TABLE.md §12b): the crate's words are keys. */
import { t } from "./copy.js";

/* THE SITE ROOT, THE WAY audio/audition.js SPELLS IT. The engine's own strings
   are repo-relative with no leading slash ("found/samples/breaks/dl_82_10.wav")
   because `samplePath` is resolved against the SITE root by every decoder;
   nukernel is served FROM the root on staging and from /nukernel/ in a local
   tree, so a bare "found/…" in an href resolves to /nukernel/found/… and 404s
   (audio/to-engine.js carries the whole measurement, and ui/video-clips.js
   carries it again with a leading slash). Resolving against `import.meta.url`
   is the one spelling that is right in both trees, so a row carries BOTH: the
   engine's own string in `file`, and the fetchable address in `href`. */
const SITE = new URL("../../", import.meta.url).href;
const hrefOf = (file) => new URL(file, SITE).href;

const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls; return n; };

/* WHERE THE TABLES COME FROM, AND WHY THERE ARE TWO PLACES TO LOOK. Exactly
   audio/audition.js's `samplersNow` argument, restated because it applies to
   all four registries and not just to one: `window.GenreKernel` is the parent
   engine's own api and is the right answer, but it does not exist until the
   engine has been built (measured 2026-08-25: __REGISTRY at 505 ms,
   GenreKernel at 1.9 s) and this file is asked its question by a TAP. They are
   the SAME TABLES — genre-kernel.js does `const SAMPLERS = DATA.SAMPLERS` — so
   the fallback is not a second opinion. */
const REG = (name) => ((window.GenreKernel || {})[name]) ||
                      ((window.__REGISTRY || {})[name]) || {};
const NI = () => window.NuInstruments || {};

/* ---------- THE VOCABULARY OF KINDS ---------------------------------------
   Six words, and every one of them is a different thing to a composer: a lane
   of a kit, a zone of a pitched instrument, a one-shot, a bar of somebody's
   drums, a place, a noise. `sfx` has no reachable row today (see the header)
   and is here so that the day it does, it is not named a seventh time. */
const KINDWORD = { lane: "kit lane", zone: "zone", shot: "one-shot",
                   brk: "break", bed: "bed", sfx: "SFX" };
/* THE REGISTRY'S OWN `kind` COLUMN, TRANSLATED ONCE. genre-kernel SAMPLES rows
   carry break | chop | hit | vox; the first is its own word to a composer and
   the other three are all "a recording you fire once". */
const SAMPLEKIND = { break: "brk", chop: "shot", hit: "shot", vox: "shot" };

/* the file's human name: its basename, without the extension, with the
   underscores the extractors write turned back into spaces. Never a label
   typed here — a file that is renamed on disk is renamed on the page by
   existing, which is the same law the bus tabs read their words under. */
const humanFile = (file) => String(file || "").split("/").pop()
  .replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");

/* ---------- WHICH POOL, AND OF WHAT --------------------------------------
   A `found:collage:<pool>` id is the WHOLE POOL (to-engine.js recipeBase: "its
   `zones` is an array and has only ever held one entry … seat a chair on
   `found:collage:<pool>` and it holds the WHOLE POOL"). `poolOf` is that same
   read; `foundKind` is what a chair seated on it IS, for the swap's class. */
const poolOf = (fid) => {
  const m = /^collage(?::(.+))?$/.exec(String(fid || ""));
  return m ? (m[1] || "vocal_stab") : null;
};
function foundKind(id) {
  const fid = String(id || "").replace(/^found:/, "");
  const pool = poolOf(fid);
  if (pool) {
    const members = REG("SOURCE_POOLS")[pool] || [];
    const count = {};
    for (const mid of members) {
      const k = REG("SAMPLES")[mid] ? SAMPLEKIND[REG("SAMPLES")[mid].kind] || "shot"
              : REG("SOURCES")[mid] ? "bed" : null;
      if (k) count[k] = (count[k] || 0) + 1;
    }
    // THE POOL'S OWN MAJORITY, not its first row: `vocal_stab` is 4 hits and
    // one vox, and what that chair IS is a stab.
    let best = null;
    for (const k of Object.keys(count)) if (!best || count[k] > count[best]) best = k;
    return best;
  }
  if (REG("SOURCES")[fid]) return "bed";
  const s = REG("SAMPLES")[fid];
  return s ? (SAMPLEKIND[s.kind] || "shot") : null;
}

/* ---------- THE CLASS A SWAP IS ALLOWED WITHIN ----------------------------
   Three answers, one per kind of chair, and each is somebody else's table:
     a KIT      the recorded kits, which is `isMachine`'s complement — a drum
                machine is synthesised and has no file to trade.
     a FOUND ID the SAMPLES kind, because a break and a numbers station are not
                interchangeable however alike their addresses look.
     ANYTHING   instruments.js `familyOf`, which is the same grouping the
     ELSE       instrument menu is already drawn in (avail.js instrOptions sets
                `group: familyOf(n)`), so a swap offers the words that were
                already standing next to each other. */
export function classOf(id, kind) {
  const s = String(id || "");
  if (!s) return null;
  if (kind === "drums") return isMachine(s) ? "machine" : "kit";
  if (/^found:/.test(s)) { const k = foundKind(s); return k ? "found:" + k : "found"; }
  return "family:" + ((NI().familyOf && NI().familyOf(s)) || "other");
}

/* ---------- WHAT ONE CHAIR IS ON -----------------------------------------
   The kit reads `voice.instrument` because that is what document.js `toGenre`
   hands the compiler (`drumkit: drums.instrument`), with `cast.kit` behind it
   for the same reason ui/eight.js `playsWhat` reads it there: a record can
   still carry the older spelling.

   AND THE BASS IS THE ONE CHAIR THIS EXPRESSION CANNOT ANSWER FOR (measured
   2026-09-03 on San Francisco 1996: seven chairs, forty files, and the BASS —
   which is audibly there — contributed none). A bass voice may carry no
   `instrument` at all and still play: audio/plan.js `castOf` seats it at
   `bRow.bassInstr || (POOL && POOL.bass) || BASS_INSTR`, and the pool is a
   SESSION fact that is not in the document, so it cannot be read from here.
   The caller hands it in — `seat` — which is the same shape ui/eight.js
   `playsWhat` already resolves the same chair by (`poolBand()`, then
   `bassInstrOf(null)`). A caller that hands none gets the document's own
   answer for every chair, which is what every non-bass chair carries anyway. */
const instrOfVoice = (v) => (v.kind === "drums"
  ? (v.instrument || (v.cast || {}).kit || null)
  : (v.instrument || null));

/* WHICH DRUM LANES THE RECORD ACTUALLY STRIKES. `lanesUsed` in
   audio/to-engine.js `toEngine` is the same set said over the compiled bars:
   a lane with no hit in it costs no file. A lane key that audio/to-engine.js
   LANE does not name is a SIDECAR (`?k` how often, `~r` how late, `!p` how
   graced — read WITH a lane, never struck on its own), and asking LANE is how
   this file avoids keeping a second list of what a sidecar is. */
function lanesOfKit(doc, v) {
  const cells = doc.material && doc.material.cells || {};
  const m = v.material;
  const names = new Set();
  if (typeof m === "string") names.add(m);
  else if (m && typeof m === "object") for (const k of Object.keys(m)) if (m[k]) names.add(m[k]);
  if ((v.cast || {}).material) names.add(v.cast.material);
  const out = new Set();
  for (const n of names) {
    const H = cells[n];
    if (!H || H.kind !== "drum") continue;
    const lanes = H.lanes || {};
    for (const lane of Object.keys(lanes))
      if (LANEWORD(lane) && (lanes[lane] || []).some((x) => +x > 0)) out.add(lane);
  }
  return [...out].sort();
}
/* ...and the one question this file asks of that table, as a predicate, so
   nothing here can read a lane's duration or its unit and start deciding
   things about drums. */
const LANEWORD = (lane) => !!LANE[String(lane)];

/**
 * EVERY FILE THIS RECORD REACHES, one row each.
 *
 * `seat(voice)` is the caller's answer to "what is this chair actually on",
 * for the one chair the document cannot answer for (see `instrOfVoice`).
 *
 * Row:
 *   voice       the chair — a member's own name (nukernel plays no bed layer,
 *               so every file on this page belongs to somebody; see header)
 *   vi          that member's index in doc.voices, for the category colour
 *   instrument  the id the chair is seated on
 *   unit        the sampler id the compiled recipe gives that chair, so a gate
 *               can hold this list against `__nuMix().units[*].sampler`
 *   kind        one of KINDWORD
 *   file        the engine's own path ("found/samples/…"), or null when the
 *               row is a REMOTE address that cannot decode under COEP
 *   href        that path resolved against the site root — what a fetch takes
 *   name        the file's human name
 *   durSec / bpm / note / data   whatever the owning table actually knows
 *   label / url the SOURCES row's own, when there is one
 *   cls         the class a swap is allowed within
 */
export function samplesOf(doc, seat) {
  const out = [];
  const voices = (doc && doc.voices) || [];
  voices.forEach((v, vi) => {
    const id = (seat ? seat(v) : null) || instrOfVoice(v);
    if (!id) return;
    const cls = classOf(id, v.kind);
    const push = (r) => out.push({ voice: v.name, vi, instrument: id, cls, ...r });

    /* ---- THE KIT ------------------------------------------------------- */
    if (v.kind === "drums") {
      if (isMachine(id)) return;          // synthesised: there is no file
      const K = auditionKit(id);
      for (const lane of lanesOfKit(doc, v)) {
        const f = kitFilesFor([lane], id)[0];
        if (!f) continue;
        /* THE UNIT IS THE PARENT'S OWN NAME FOR THE DRUM, so this list can be
           held against `__nuMix().units[*].sampler` without a translation
           table in the gate: genre-kernel `drumKitSpec` builds every overlay
           id as `drum_<kit>_<hit>`, and `LANE[lane].unit` is which of the nine
           drums a nukernel lane is (twelve lanes, nine units — h/o/f are all
           `hat`, t/m/l are all `tom`, which is that table's own note). */
        push({ unit: "drum_" + K.dir + "_" + LANE[lane].unit,
               kind: KINDWORD.lane, file: f, href: hrefOf(f),
               name: humanFile(f), data: "lane " + lane });
      }
      return;
    }

    /* ---- A FOUND CHAIR ------------------------------------------------- */
    if (/^found:/.test(id)) {
      const fid = id.replace(/^found:/, "");
      const pool = poolOf(fid);
      const ids = pool ? (REG("SOURCE_POOLS")[pool] || []) : [fid];
      const unit = pool ? "found:collage:" + pool : "found:" + fid;
      for (const mid of ids) {
        const bedRow = REG("SOURCES")[mid], shotRow = REG("SAMPLES")[mid];
        const row = bedRow || shotRow;
        if (!row) continue;
        /* A LOCAL ROW OR AN ADDRESS, and the difference is the whole reason a
           chair sounds or does not. to-engine.js says it twice — "a SOURCES
           row whose url has no scheme is a file in this repo", and the collage
           branch drops the remote ones before it builds a zone because "a
           chair seated on twenty recordings that can never decode is a silent
           chair". Same test, same answer, and a remote row is LISTED with no
           file rather than listed with a file that 404s. */
        const localBed = bedRow && !row.file && /^[^:]*$/.test(row.url || ":");
        const file = row.file ? "found/samples/" + row.file : (localBed ? row.url : null);
        const kind = shotRow ? KINDWORD[SAMPLEKIND[shotRow.kind] || "shot"] : KINDWORD.bed;
        push({ unit, kind, file, href: file ? hrefOf(file) : null,
               name: row.file ? humanFile(row.file) : (row.label || mid),
               durSec: row.durSec != null ? row.durSec : null,
               bpm: row.bpm != null ? row.bpm : null,
               note: row.note != null ? row.note : null,
               label: bedRow ? (row.label || mid) : null,
               url: bedRow && !localBed ? (row.url || null) : null,
               remote: !file });
      }
      return;
    }

    /* ---- A SAMPLED INSTRUMENT, ZONE BY ZONE ----------------------------
       AND `SAMPLERS[id]` IS NOT THE TEST — that was the first build of this
       branch and the gate caught it the hour it shipped (S1b, 2026-09-03:
       *"the crate claims no pitched unit the engine does not play"* came back
       `["palm_muted_guitar","warm_pad"]`). Both ids have zones on disk and
       NEITHER is played from them: audio/to-engine.js `recipeBase` asks the
       four PATCH tables BEFORE it asks the library, so a guitar that resolves
       to `stk_guitar` and a pad that resolves to a synth reach a Faust model
       and the recordings sit there untouched. Listing them would be this box's
       characteristic bug pointed the other way — not a control that reaches no
       sound, but a SOUND the record never fetches — on the one surface whose
       entire subject is which files a record actually reaches.
       `sampledId` is the one predicate for "the sampler plays this id",
       measured against recipeFor's own routing (instruments.js's header), and
       it is the SAME predicate avail.js `sampledVoice` draws the loop strip
       behind — which is why those two chairs already had no loop strip while
       they still had rows here. One answer, three surfaces. */
    if (!(NI().sampledId && NI().sampledId(id))) return;
    const S = REG("SAMPLERS")[id];
    if (!S || !S.dir) return;             // a Faust model, a synth, a bad id
    (S.zones || []).forEach((z) => {
      const file = "found/samples/instruments/" + S.dir + "/" + z.file;
      push({ unit: id, kind: KINDWORD.zone, file, href: hrefOf(file),
             name: humanFile(z.file), label: S.label || null,
             /* THE ONE FACT A ZONE HAS AND NOTHING ELSE DOES: which keys it
                answers for and where it plays at its own speed. There is no
                `len` in this table (measured: 0 of 637 zones carry one), so a
                duration is honestly absent rather than computed from nothing. */
             data: "keys " + z.lo + "–" + z.hi + " · root " + z.root });
    });
  });
  return out;
}

/* ---------- THE SWAP'S OFFER ----------------------------------------------
   The caller hands in the SHEET — `sound.instrument`, `sound.bassinstrument`
   or `sound.drumkit`, already resolved by avail.js against this record — and
   this narrows it to the chair's own class. Nothing is minted: every word,
   every refusal and the `set` are the sheet's.

   THE STANDING ANSWER SURVIVES THE FILTER, always, because ui/selects.js's own
   law is that you can see the word you are on (and a value with no option is
   drawn as "not in this table", which would be a lie about a value the sheet
   itself offers).

   ONE OPTION IS A REFUSAL AND NOT A CONTROL. A combobox whose only word is the
   word you are already saying is furniture; it is disabled WITH the measured
   reason, which is what makes it legal on this page (no silent grey). It is a
   real state — `found:collage:break_75_95` is the only BREAK any genre in the
   catalogue seats, so INSTRCHOICES (which is derived from the catalogue) holds
   exactly one — and saying so is more use than five words from another class. */
export function swapSpec(sheet, chair, cls) {
  const drums = cls === "kit" || cls === "machine";
  const keep = (o) => {
    const v = String(o.value);
    // the word you are on, and the sheet's own EMPTY DETENT (the way back to
    // "the record's own"), always — ui/selects.js's law and avail.js's
    // absent-is-today, neither of which a filter may take away.
    if (v === String(sheet.value) || v === "") return true;
    if (classOf(v, drums ? "drums" : null) !== cls) return false;
    /* ...AND IT HAS TO BE A RECORDING. Measured 2026-09-03: the keys family's
       swap offered `stk_piano` at the top of its list, which is a FAUST MODEL
       the fleet plays — `familyOf` answers "keys" for it because that is what
       it sounds like, and it is a perfectly good thing to put on this chair
       from the instrument MENU. It is not a thing to put on it from the CRATE:
       choosing it empties this chair's crate, which is a swap that deletes the
       thing you were looking at. instruments.js `sampledId` is the one
       predicate for "the sampler plays this id" (measured against recipeFor's
       own routing, see its header) and it is asked here rather than a second
       list of models being kept. A kit answers this from the other side —
       `isMachine` inside `classOf` — because a kit name is not an
       INSTRCHOICES id at all. */
    return drums || !!(NI().sampledId && NI().sampledId(v));
  };
  const options = (sheet.options || []).filter(keep);
  const alt = options.filter((o) => String(o.value) !== String(sheet.value));
  const why = sheet.why ? sheet.why
    : !alt.length ? "the crate holds no other " + WORDFOR(cls) + " this chair can take"
    : null;
  return { key: "sample-swap|" + chair, label: "swap", options,
           value: sheet.value, set: sheet.set, ungated: sheet.ungated,
           ...(why ? { why } : {}) };
}
const WORDFOR = (cls) => {
  const s = String(cls || "");
  if (s === "kit") return "recorded kit";
  if (s.slice(0, 6) === "found:") return KINDWORD[s.slice(6)] || "recording";
  if (s.slice(0, 7) === "family:") return s.slice(7) + " instrument";
  return "recording";
};

/* ===========================================================================
   THE VIEW
   ===========================================================================
   ONE GROUP PER CHAIR, and that is why the two addresses in COMPOSER.md are
   shaped the way they are: `sample-play|<chair>|<i>` names a FILE (there are
   many per chair) and `sample-swap|<chair>` names the CHAIR (there is one
   field per chair, and it is the field the instrument menu already writes).
   A per-file swap is not expressible and the reason is worth stating: the
   membership of a collage pool is `SOURCE_POOLS`'s, dealt to the chair by the
   genre, and there is no document field for "the fourth break of the twelve".

   TEXT DIET: a label, a value, or a refusal. The kind chip and the file's name
   are values (they say WHICH file this is, which is the whole subject); the
   audition and the swap are controls; the "where it comes from" line is the
   source's own label, which is the only place a licence is ever said. */
/* WHERE A RECORDING COMES FROM — the source's own label, and its address as a
   DOOR. It is the one place a recording's provenance is said on this page, and
   `.nu-routelink` is the 44px chassis every other pointer on the page wears
   (the probe of 2026-09-02 on the board's own pointer: "a 261x15px link" is
   not a target on a page whose every other door is 44px). */
/* THE PRESS THAT COULD NOT SOUND, AND THE SAME PRESS ONCE IT CAN. Two halves
   of one fact, so the reason cannot be left on a button that would now work. */
const PLAYWHY = () => t("crate.busy.why");
function refuse(li, b, r) {
  b.dataset.why = PLAYWHY();
  b.setAttribute("aria-label", t("crate.hearBusy.aria", { name: r.name }));
  if (!li.querySelector(".nu-crefuse"))
    li.append(el("p", PLAYWHY(), "nu-why nu-crefuse"));
}
function unrefuse(li, b, r) {
  delete b.dataset.why;
  b.setAttribute("aria-label", t("crate.hear.aria", { name: r.name }));
  const p = li.querySelector(".nu-crefuse");
  if (p) p.remove();
}

function srcLine(r, chair, i) {
  const p = el("p", null, "nu-csrc");
  if (r.label) p.append(el("span", r.label, "nu-clabel"));
  if (r.url) {
    const a = document.createElement("a");
    a.href = r.url; a.textContent = r.url;
    a.className = "nu-routelink nu-curl";
    a.rel = "noreferrer";
    a.dataset.k = "sample-src|" + chair + "|" + i;
    p.append(a);
  }
  return p;
}

export function mountSamples(host, ctx) {
  /* THE ROWS ARE THE CALLER'S READING, not a second one. ui/eight.js already
     asks `samplesOf` twice — for the gutter's count and for whether a member
     has a crate at all — with the `seat` resolver only it can supply, so the
     view takes that same answer rather than calling the reader again without
     it (which is how the bass would have been in the count and missing from
     the panel). */
  const rows = (ctx.rows ? ctx.rows() : samplesOf(ctx.doc()))
    .filter((r) => !ctx.only || r.voice === ctx.only);
  const box = el("div", null, "nu-crate");

  const plate = el("h3", null, "nu-namebar");
  plate.append(document.createTextNode("the samples"),
               el("small", rows.length + (rows.length === 1 ? " file" : " files")));
  box.append(plate);

  if (!rows.length) {
    /* NOT AN EMPTY BOX. Every chair on this record is a modelled voice or a
       drum machine, which is a real answer and a different one from "the crate
       is broken". `.nu-why` so the diet counts it as the refusal it is. */
    box.append(el("p", ctx.only
      ? ctx.only + " is not played by a recording — nothing here to open"
      : "nothing on this record is played by a recording", "nu-why"));
    host.append(box);
    return;
  }

  const byChair = [];
  for (const r of rows) {
    let g = byChair.find((x) => x.voice === r.voice);
    if (!g) byChair.push(g = { voice: r.voice, vi: r.vi, instrument: r.instrument,
                               cls: r.cls, rows: [] });
    g.rows.push(r);
  }

  for (const g of byChair) {
    /* THE PLAYER'S COLOUR, THROUGH THE ONE THING ALLOWED TO WEAR IT. nu.css's
       category block says it in capitals — "WHAT PAINTS WITH THESE IS
       `.nu-vpaint` AND NOTHING ELSE" — so the group takes the roster's own
       quiet form (`.is-edge`: a 3px bar in the player's hue, no plate) rather
       than a second rule reaching for `--vpaint` on its own. `data-vi` is
       `vpaintOf`'s answer, handed in, so one player is one hue on the roster,
       on the board, on the roll and here. */
    const grp = el("div", null, "nu-crategrp nu-vpaint is-edge");
    grp.dataset.vi = String(ctx.slotOf(g.voice));

    const head = el("p", null, "nu-cratehead");
    head.append(el("b", g.voice, "nu-cratewho"));
    head.append(el("span", ctx.wordFor(g.instrument), "nu-crateis"));
    grp.append(head);

    /* WHERE THEY COME FROM, SAID ONCE WHERE IT IS ONE ANSWER. A GM instrument
       has ONE source line — "Electric Piano (FluidR3, MIT)" — and six zones,
       and the first build printed it on every one of them: six identical
       licences down a column, which is 174 characters of the page's whole text
       allowance saying a thing that is true of the chair rather than of the
       file. A COLLAGE is the other case and it is why this is a measurement
       and not a rule: twelve breaks, twelve different provenances, and the
       line has to be on the row. So the label is hoisted when the group agrees
       about it and stays on the row when it does not. */
    const labels = [...new Set(g.rows.map((r) => r.label || ""))];
    const common = labels.length === 1 && labels[0] &&
                   !g.rows.some((r) => r.url) ? labels[0] : null;
    if (common) grp.append(srcLine({ label: common }, g.voice, "grp"));

    /* THE SWAP, THROUGH THE FIELD THAT ALREADY OWNS IT. `ctx.sheet` returns
       ui/eight.js's own `shSpec` for whichever of the three sheets this chair
       answers to — so the write is avail.js's `set`, the recompile is
       `changed()`, and this file never touches `voice.instrument`. */
    const sheet = ctx.sheet(g.voice);
    if (sheet) ctx.field(grp, swapSpec(sheet, g.voice, g.cls));

    /* AND THE LOOP POINTS, on the chairs that have them — the SAME strip the
       instrument facet draws, from ui/eight.js, because a loop point is one
       fact and `sound.loopin`/`loopout`/`looping` are its one owner. Absent
       where avail.js `sampledVoice` says no, which is the no-silent-grey law's
       other half: a control that cannot exist is absent, not greyed. */
    const strip = ctx.loop(g.voice);
    if (strip) grp.append(strip);

    const list = el("ul", null, "nu-cratelist");
    g.rows.forEach((r, i) => {
      const li = el("li", null, "nu-crow");
      li.append(el("span", r.kind, "nu-ckind"));
      li.append(el("span", r.name, "nu-cname"));
      const data = [];
      if (r.durSec != null) data.push(r.durSec.toFixed(2) + "s");
      if (r.bpm != null) data.push(r.bpm + " bpm");
      if (r.note != null) data.push(String(r.note));
      if (r.data) data.push(r.data);
      if (data.length) li.append(el("span", data.join(" · "), "nu-cdata"));

      /* THE AUDITION. One button, two states, the same three-state discipline
         the motif's play button has: press it and this file sounds, press it
         again and it stops. It is `aria-pressed` because it IS a state. */
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nu-cplay";
      b.dataset.k = "sample-play|" + g.voice + "|" + i;
      b.append(el("span", t("act.play")));
      b.setAttribute("aria-pressed", "false");
      if (!r.href) {
        /* A ROW THE RECORD CANNOT REACH EITHER, and the reason is the engine's
           own: to-engine.js drops a remote row out of a collage before it
           builds a zone ("a chair seated on twenty recordings that can never
           decode is a silent chair") because this page is served
           cross-origin-isolated and a row without CORP cannot be fetched at
           all. It is LISTED — it is in the pool the genre dealt this chair —
           and it says why it is not one of the files you can hear. */
        b.disabled = true;
        b.dataset.why = t("crate.noFile.why");
        b.setAttribute("aria-label", t("crate.noFile.aria", { name: r.name }));
      } else {
        b.setAttribute("aria-label", t("crate.hear.aria", { name: r.name }));
        b.addEventListener("click", () => {
          /* NOT WHILE THE RECORD RUNS, and the refusal SAYS SO. It is the same
             law the motif audition holds (ui/eight.js: two musics at once is
             what the audition refuses, and the refusal has to hold both when a
             tap arrives during a record and when the record starts under a
             sounding file — the second half is `auditionOff`, which stops this
             player too). What it cannot borrow is where that refusal is
             PRINTED: the motif's sentence lives in a `[data-live]` element the
             clock owns, and this panel has none. So the reason is written onto
             the button BY THE PRESS — a gesture, never the clock, which is
             what keeps it legal inside #app — and it is written where every
             other refusal on this page is read from: `data-why`, the
             accessible name, and one `.nu-why` line under the row. */
          if (ctx.playing()) { refuse(li, b, r); return; }
          if (b.dataset.why) unrefuse(li, b, r);
          const key = b.dataset.k;
          if (sounding() === key) { stopSample(); paint(); return; }
          playSample(r.href, key, paint);
          paint();
        });
      }
      li.append(b);
      list.append(li);

      if (!common && (r.label || r.url)) li.append(srcLine(r, g.voice, i));
    });
    grp.append(list);
    box.append(grp);
  }
  host.append(box);

  function paint() {
    const on = sounding();
    for (const b of box.querySelectorAll('[data-k^="sample-play|"]'))
      b.setAttribute("aria-pressed", b.dataset.k === on ? "true" : "false");
  }
}

/* ===========================================================================
   ONE FILE, WHOLE, AT ITS OWN SPEED
   ===========================================================================
   See the header for why this is a second player and what would delete it. It
   is deliberately the smallest thing that can be true: one context made on the
   tap (which is the gesture the autoplay policy wants), one decode cache keyed
   by href, one node at a time. */
let actx = null;
let live = null;                       // { node, key }
const bufs = new Map();

export const sounding = () => (live ? live.key : null);

export function stopSample() {
  if (!live) return;
  const n = live.node;              // null while the file is still decoding —
  live = null;                      // clearing `live` is what stops THAT case
  if (!n) return;
  try { n.onended = null; n.stop(); } catch (e) {}
  try { n.disconnect(); } catch (e) {}
}

function playSample(href, key, onEnd) {
  stopSample();
  stopAudition();                      // one sound in the room (see header)
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
  }
  if (actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
  let p = bufs.get(href);
  if (!p) {
    p = fetch(href).then((r) => {
      if (!r.ok) throw new Error(href + " " + r.status);
      return r.arrayBuffer();
    }).then((ab) => actx.decodeAudioData(ab));
    p.catch(() => bufs.delete(href));  // a failed fetch retries on the next press
    bufs.set(href, p);
  }
  const mine = { node: null, key };
  live = mine;
  p.then((buf) => {
    if (live !== mine) return;         // stopped, or another file, while decoding
    const src = actx.createBufferSource();
    src.buffer = buf;
    const g = actx.createGain();
    g.gain.value = 0.8;
    src.connect(g); g.connect(actx.destination);
    src.onended = () => { if (live === mine) { live = null; if (onEnd) onEnd(); } };
    mine.node = src;
    src.start();
  }).catch(() => { if (live === mine) { live = null; if (onEnd) onEnd(); } });
  return true;
}

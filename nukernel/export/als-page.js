// nukernel/export/als-page.js — THE ⤓ BUTTON'S HALF OF THE ABLETON EXPORT.
//
// This is `tools/ableton/export-als.js` with the four node things taken out and
// the four browser things put in, and NOTHING ELSE. Read them side by side:
//
//     node CLI                              this file
//     readFileSync(donor/Generic.als)       import("./donor.js") + atob
//     gunzipSync                            DecompressionStream("gzip")
//     alsFromScore(donorXml, score, opts)   alsFromScore(donorXml, score, opts)   ← the same call
//     gzipSync                              CompressionStream("gzip")
//     writeFileSync                         the caller's Blob + <a download>
//
// The splice itself — every element, every id, every note — is
// nukernel/export/als.js, imported here and imported there, one file. The score
// fold is nukernel/export/score.js, likewise. So the page and the CLI are not
// two exporters that agree; they are one exporter with two ends, and
// test/als-page.browser.js holds them to that by demanding the DECOMPRESSED XML
// come out byte-identical for the same record.
//
// PAUL, 2026-08-29: "Why is any of it on the server just make it all browser."
// That is the governing constraint and it is why `./donor.js` exists rather
// than a fetch of donor/Generic.als. NOTHING HERE TOUCHES THE NETWORK — not a
// CDN, not our own origin. If the page opened, the .als can be written; there
// is no second path to deploy and no "did the rsync carry it" failure mode.
// (memory: "rsync WITHOUT --delete (pruned tree)" is exactly that failure mode,
// and this design cannot have it.)
import { alsFromScore } from "./als.js";
import { scoreOf } from "./score.js";
import * as state from "../ui/state.js";
import * as plan from "../audio/plan.js";

/** True when this engine can do both halves of gzip. */
export const canGzip = () =>
  typeof CompressionStream === "function" && typeof DecompressionStream === "function";

// THE REFUSAL TEXT IS ONE STRING WITH ONE OWNER — the card prints it, the gate
// reads it, and neither of them writes it out again. "Nothing greys silently":
// if this is what happened, this is what it says.
export const NO_GZIP =
  "this browser has no CompressionStream(\"gzip\") — an .als IS gzipped XML, so " +
  "there is nothing honest to hand you. Safari 16.4, Chrome 80 and Firefox 113 " +
  "and up can do it. The command line still can: node tools/ableton/export-als.js";

const through = async (bytes, stream) => {
  const r = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await r.arrayBuffer());
};

/** THE DONOR, out of the module graph. Never fetched — see ./donor-extract.js. */
export async function donorXml() {
  if (!canGzip()) throw new Error(NO_GZIP);
  const { DONOR_GZIP_B64, DONOR_BYTES, DONOR_SOURCE } = await import("./donor.js");
  const bin = atob(DONOR_GZIP_B64);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  // The embed CARRIES its own length, so a truncated base64 is caught here and
  // not four hundred lines later as "donor has no <Tempo> element".
  if (gz.length !== DONOR_BYTES)
    throw new Error("the embedded donor is " + gz.length + " bytes, not the " +
      DONOR_BYTES + " of " + DONOR_SOURCE + " — run node nukernel/export/donor-extract.js");
  const xml = await through(gz, new DecompressionStream("gzip"));
  return new TextDecoder().decode(xml);
}

/** The drum-rack track, same shape, out of the second donor. */
export async function drumRackXml() {
  if (!canGzip()) throw new Error(NO_GZIP);
  const { RACK_GZIP_B64, RACK_GZIP_BYTES, RACK_SOURCE, RACK_TRACK } =
    await import("./drumrack.js");
  const bin = atob(RACK_GZIP_B64);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  if (gz.length !== RACK_GZIP_BYTES)
    throw new Error("the embedded drum rack is " + gz.length + " bytes, not the " +
      RACK_GZIP_BYTES + " of " + RACK_TRACK + " in " + RACK_SOURCE +
      " — run node nukernel/export/drumrack-extract.js");
  return new TextDecoder().decode(await through(gz, new DecompressionStream("gzip")));
}

/**
 * The six audio devices Paul put in the second donor that the first one has
 * not got — Shifter, Chorus2, AutoShift, AutoPan2, FilterDelay, FilterEQ3.
 * Same door as the drum rack, same extractor pattern, 5 KB gzipped. P3's
 * effect chips land on them (nukernel/export/live-devices.js), and a caller
 * that hands nothing still exports: every chip that needs one of these six is
 * REPORTED as having no device rather than faked onto the nearest thing.
 */
export async function fxRackXml() {
  if (!canGzip()) throw new Error(NO_GZIP);
  const { FXRACK_GZIP_B64, FXRACK_GZIP_BYTES, FXRACK_SOURCE, FXRACK_TRACK } =
    await import("./fxrack.js");
  const bin = atob(FXRACK_GZIP_B64);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  if (gz.length !== FXRACK_GZIP_BYTES)
    throw new Error("the embedded fx rack is " + gz.length + " bytes, not the " +
      FXRACK_GZIP_BYTES + " of " + FXRACK_TRACK + " in " + FXRACK_SOURCE +
      " — run node nukernel/export/fxrack-extract.js");
  return new TextDecoder().decode(await through(gz, new DecompressionStream("gzip")));
}

/**
 * The master chain — Saturator, Glue Compressor, Limiter — out of the third
 * donor, which is the only one whose MainTrack has any device on it at all.
 * Same door as the other two racks, same extractor pattern, 2 KB gzipped. A
 * caller that hands nothing still exports: the record's master words are then
 * reported as having no device rather than faked onto the nearest thing, and
 * the donor's own Main track ships untouched.
 */
export async function masterRackXml() {
  if (!canGzip()) throw new Error(NO_GZIP);
  const { MASTERRACK_GZIP_B64, MASTERRACK_GZIP_BYTES, MASTERRACK_SOURCE, MASTERRACK_TRACK } =
    await import("./masterrack.js");
  const bin = atob(MASTERRACK_GZIP_B64);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  if (gz.length !== MASTERRACK_GZIP_BYTES)
    throw new Error("the embedded master rack is " + gz.length + " bytes, not the " +
      MASTERRACK_GZIP_BYTES + " of the " + MASTERRACK_TRACK + " in " + MASTERRACK_SOURCE +
      " — run node nukernel/export/masterrack-extract.js");
  return new TextDecoder().decode(await through(gz, new DecompressionStream("gzip")));
}

/**
 * THE RECORD ON SCREEN, FOLDED FOR THE EXPORTER.
 *
 * NOT a genre key re-derived, and not a second fold either: this is the very
 * `plan.timeline()` the audio plays from, so every edit Paul has made — the
 * cells, the producer's notes, the meter, the groove, the pool, the desk — is
 * in it by construction, because those edits are what `compile()` reads.
 *
 * WHY plan.timeline() AND NOT eight.js's `buildScore()`, which is what the .mid
 * button folds. They are two different true answers and the .als wants this
 * one. `buildScore()` is the NOTATED record — what the staff draws and what an
 * SMF should carry, at written pitch on a step grid. `plan.timeline()` is the
 * PLAYED record: register home applied, groove and swing and humanize already
 * warped into `off`, the cast seated so a track can be called "v0
 * electric_piano". A Live set is a session you press play on, so it takes the
 * played one — and taking it is also what makes the CLI a second opinion this
 * export can be checked against, because the CLI has no DOM and no staff.
 *
 * RUBATO GOES OFF FOR THE LENGTH OF THE FOLD, and it is put back in a `finally`.
 * The CLI's own note, measured: rubato gives bars of 15.927, 15.919, 15.991 and
 * 16.039 steps against Live's metric grid, so the set plays right and is
 * unreadable. Off gives 16,16,16,16 and the groove/humanize offsets SURVIVE
 * inside the bar — they are real tick offsets in the clip, not Live's groove
 * pool. The page is compiled back to Paul's own setting before this returns:
 * `compile()` is a pure walk over state (plan.js:397, "no fetch, no context, no
 * node") and it already runs on every musical edit, so running it twice more
 * leaves the timeline exactly where it found it.
 */
export async function pageScore({ grid = true, engine = true, say = () => {} } = {}) {
  if (engine) { say("warming the engine…"); await plan.warmEngine(); }
  const wasRubato = state.RUBATO;
  /* ...AND THE STORED KEY IS PUT BACK TOO, WHICH IS NOT THE SAME THING, and the
     gate is what found it. `setRubato` writes through to localStorage on every
     call (state.js:159-162), so a fresh page — where the key has NEVER been
     written, because rubato has always simply been on — came out of an export
     with `nukernel.rubato.v1 === "1"`. state.js reads absent as ON
     (`getItem(...) !== "0"`), so nothing behaves differently TODAY; what is
     wrong is that pressing ⤓ silently wrote a preference Paul never set, and it
     outlives the tab. There is no writer in state.js that can say "absent", so
     the raw key is restored here, beside the flag it belongs to. */
  let storedRubato = null, canStore = true;
  try { storedRubato = localStorage.getItem("nukernel.rubato.v1"); }
  catch (e) { canStore = false; }
  try {
    if (grid && wasRubato) state.setRubato(false);
    plan.compile();
    // `seats` and `sections` joined this call in the P3 round, and the CLI's
    // own loadScore passes exactly the same two — the tone and the signature
    // synth per chair, and the sections the `mot`/`auto` lanes and the `fx`
    // chips live on. See export/score.js for why cast() cannot answer either.
    return scoreOf({ timeline: plan.timeline(), cast: engine ? plan.cast() : [],
                     seats: engine ? plan.seats() : null, sections: state.SONG,
                     drums: engine ? plan.drumStrip() : null, master: state.MASTER,
                     bpm: state.bpm, grid, engine, title: "the record" });
  } finally {
    if (grid && wasRubato) {
      state.setRubato(true);
      if (canStore) try {
        if (storedRubato == null) localStorage.removeItem("nukernel.rubato.v1");
        else localStorage.setItem("nukernel.rubato.v1", storedRubato);
      } catch (e) { /* private mode — state.js swallows the same throw */ }
      plan.compile();
    }
  }
}

/**
 * Write the record on screen as an Ableton Live set.
 *
 * P1 AND NOT P0, AND PAUL PICKED IT: "Can I download Ableton yet" is a question
 * about HIS SONG, and P0 is one lane of one box — a single clip out of a
 * four-box band, which would land in Live as evidence that the exporter runs
 * rather than as the record. P1 is every lane of every box: one track per
 * voice, one Session clip per box in scene order, the same clips laid out in
 * the Arrangement, and the scenes named after the boxes. It is also the shape
 * the CLI's own `--all` has been gated on since it shipped (4 tracks, 32 clips,
 * 2,328 notes on `--genre beatgroup`), so the button is held to gates that have
 * actually been run rather than to a path nobody exercises.
 *
 * P1 REFUSES RATHER THAN GUESSES, and that refusal is inherited, not written
 * here: `alsFromScore` throws when the song has more boxes than the donor has
 * scenes or clip slots, because cloning a scene is a guess and a wrong guess
 * opens as a broken set. The card prints the throw. A song too big for the
 * donor gets a sentence, never a corrupt file.
 */
export async function pressAls(say = () => {}, opts = {}) {
  if (!canGzip()) throw new Error(NO_GZIP);
  const all = opts.all !== false;
  const grid = opts.grid !== false;
  const engine = opts.engine !== false;

  const score = await pageScore({ grid, engine, say });
  say("splicing the donor…");
  const donor = await donorXml();
  const res = alsFromScore(donor, score, { all, drumRack: await drumRackXml(),
                                           fxRack: await fxRackXml(),
                                           masterRack: await masterRackXml() });
  say("gzipping…");
  const bytes = await through(new TextEncoder().encode(res.xml), new CompressionStream("gzip"));
  // WHAT WENT IN, COUNTED THE WAY als-gate.js COUNTS IT: every note is written
  // TWICE, once into the Session clip and once into the Arrangement clip, and
  // the gate's `wantN` is `lane.notes.length * 2` for exactly that reason. A
  // count that said 1,164 where the gate says 2,328 would be a second opinion
  // about the same file, which is the one thing this slice is built not to have.
  const used = all ? score.boxes : score.boxes.slice(0, 1);
  let written = 0;
  for (const b of used) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
    written += l.notes.length * 2;
  return { bytes, xml: res.xml, tracks: res.tracks, clips: res.clips,
           notes: written, clipNotes: res.notes, score, all, grid, engine,
           bpm: score.bpm, boxes: used.length,
           // P3's own receipt — how many instrument knobs, envelopes and
           // effect devices went in. The card can say it the way the CLI does.
           sound: res.sound,
           folded: score.folded, skipped: score.skipped };
}

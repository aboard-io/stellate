// found-path.js — where a found source's BYTES are on disk, for the node gates.
// Shared, never executed as a gate.
//
// The engine owns this convention (engine/faust/voices/found-player.js
// localPathFor): a fetched source lives at `found/<id>.64.mp3` — the bitrate
// rides in the NAME because found/ is immutable-by-name, so re-encoding mints a
// new name rather than changing a file. Gates that spelled `found/<id>.mp3`
// themselves went red the day the beds were re-encoded and stayed red, blamed on
// "needs a fetch" when the fetch had happened and the name had moved. One
// resolver, tried in the same order the player's own fallbacks imply.
//
// The other half is the SPEECH organ: a source carrying `synthText` has NO file
// and never will — espeak synthesizes it per utterance (that is the artifact's
// determinism law). Asking the filesystem for `found/sp_pa_namebank.mp3` is not a
// missing-media error, it is a category error, and it is what made `all-sampled`
// look like an unfetched tree.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");

const EXTS = [".64.mp3", ".mp3", ".wav", ".ogg"];

// -> absolute path, or null when the source has no file BY DESIGN (synthText).
// Throws with a useful message when a source that SHOULD have bytes has none.
function foundPath(src) {
  if (!src) return null;
  if (src.synthText) return null;                       // synthesized, never fetched
  if (src.fsPath) return src.fsPath;
  if (src.samplePath) {
    const p = path.join(ROOT, src.samplePath);
    if (fs.existsSync(p)) return p;
    throw new Error(`missing ${src.samplePath} — run tools/fetch/fetch-found-samples.sh`);
  }
  for (const e of EXTS) {
    const p = path.join(ROOT, "found", src.id + e);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`missing found/${src.id}{${EXTS.join(",")}} — run tools/fetch/fetch-found-sound.sh`);
}

// Stamp fsPath on every source that has bytes; DROP the ones that are
// synthesized, since a press harness feeding PCM has nothing to feed for them.
// Returns the filtered list (callers assign it back onto the state).
function resolveFoundPaths(state, { dropSynth = true } = {}) {
  const out = [];
  for (const s of (state.foundSources || [])) {
    const p = foundPath(s);
    if (p === null) { if (!dropSynth) out.push(s); continue; }
    s.fsPath = p;
    out.push(s);
  }
  if (dropSynth) state.foundSources = out;
  return out;
}

// A named file under found/, resolved across the same extension list — for the
// gates that want one specific recording rather than a state's whole crate.
function foundFile(id) {
  for (const e of EXTS) {
    const p = path.join(ROOT, "found", id + e);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = { foundPath, resolveFoundPaths, foundFile, EXTS, ROOT };

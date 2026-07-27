// export.js — ⤓ download the CURRENT song as a Standard MIDI File.
//
// This is the MIDI half of a larger ⤓ cluster that was cut back to one button.
// Deliberately absent: the offline in-browser press (wav/mp3), the lamejs
// encode path, the stream-worker renderWav/renderLoop plumbing and the
// whole-path journey walk — that machinery is why the cluster was heavy.
//
// WHAT THE FILE IS. engine/midi-export.js builds the SMF from the SAME
// buildEvents() walk the audio path uses (pads ch1 / bass ch2 / melody ch3 /
// GM drums ch10, real tempo + time signature from the state), fed the EXACT
// state the engine is playing right now — S.playing, the blend the traveler's
// current position produced, carrying the session seed and the ±bpm delta. So
// the file is the music on screen: same state, same seed, same path position
// the ↗ share link would hand out. (Found sound doesn't appear: it's audio,
// not notes. And the live walk rotates the seed per bar — seed+serial*7919 —
// so what you hear at measure N is that bar of this song; the file is the
// whole song this state describes, the same one press.js renders.)
//
// The name carries the identity the share URL does: genre + seed + measure,
// ASCII-only so it survives every filesystem.
import { S, K, set, deep } from "./state.js";
import { currentMeasure } from "./share.js";   // the ONE measure law (buildShareUrl reads it too)

// ---------- naming ----------
// ASCII-safe slug: the genre LABEL is display copy (things like "Food Court
// Eternity") and may carry punctuation or non-ASCII,
// so fold to [a-z0-9-] and fall back to the genre id, then to "stellate".
function slug(s) {
  return String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 48);
}
export function midiFileName() {
  const g = (S.weights[0] || { g: "stellate" }).g;
  const label = (K.GENRES[g] && K.GENRES[g].label) || g;
  const name = slug(label) || slug(g) || "stellate";
  const m = currentMeasure();
  return "stellate-" + name + "-seed" + (S.seed | 0) + (m > 1 ? "-m" + m : "") + ".mid";
}

// ---------- download plumbing (the ↗ share / ⧉ copy-embed pattern: act, then toast) ----------
function saveBlob(blob, name) {
  EXPORT.lastName = name;                       // headless probe hook
  if (EXPORT.noDownload) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);   // IN the document: a detached anchor's click is
  a.click();                      // ignored by some engines (and by headless chromium)
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 30000);
}

// ---------- ⤓ midi ----------
// Synchronous by design: buildMidi is one buildEvents walk over one state (the
// walk the score brain already does every bar) — milliseconds, no worker, no
// progress bar. Returns the bytes so the gate can check them.
export function downloadMidi() {
  if (!S.playing || !window.MidiExport) { set({ status: "MIDI export unavailable" }); return null; }
  let bytes = null;
  const state = deep(S.playing);
  try { bytes = MidiExport.buildMidi(state); }
  catch (e) {
    console.error("MIDI export failed:", e);
    set({ status: "MIDI export failed: " + ((e && e.message) || e) });
    return null;
  }
  EXPORT.lastMidi = bytes;                      // headless probe hooks (SMF parse gate)
  EXPORT.lastState = state;
  const name = midiFileName();
  saveBlob(new Blob([bytes], { type: "audio/midi" }), name);
  set({ status: "MIDI saved — " + name + " (" + bytes.length + " bytes)" });
  return bytes;
}

// ---------- headless probe hooks (test/midi-export-run.js) ----------
export const EXPORT = { noDownload: false, lastMidi: null, lastState: null, lastName: null,
  downloadMidi, midiFileName };
window.__EXPORT = EXPORT;

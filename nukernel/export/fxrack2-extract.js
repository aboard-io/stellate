#!/usr/bin/env node
// nukernel/export/fxrack2-extract.js — THE THREE DEVICES PAUL PUT IN THE
// FOURTH DONOR THAT NO EARLIER DONOR HAS AND THIS EXPORTER CAN ACTUALLY USE,
// extracted the same way the fx rack is (fxrack-extract.js), the master rack is
// (masterrack-extract.js), the drum rack is (drumrack-extract.js) and the donor
// itself is (donor-extract.js).
//
// Paul, 2026-09-03: "So the Ableton number for delay is 'delay time in 16th
// notes,' so it should be 2. I added a zip with all the missing effects and
// many more."
//
// He did. `Answers2.als` track `1-DS Drum Rack` is a TWENTY-EIGHT device chain
// and most of it is a zoo rather than an ask: fourteen device tags in it appear
// in no earlier donor. This file photographs THREE of them, and the other
// eleven are refused in writing rather than hoarded, because a device in
// fxrack2.js is bytes in every page load whether or not a chip can reach it.
//
//     TAKEN        PhaserNew   the `phaser` chip, which has been reported as
//                              unmapped on every run since the chips landed —
//                              "neither donor carries a Phaser" — and is the
//                              one device Paul was asked for by name.
//                  Amp         the `crunch` chip. The box's insert is not a
//                              saturator and not a pedal: engine/faust/dsp/
//                              insert_higain.dsp says of itself "insert_distort
//                              is one waveshaper; this is the amp", and its five
//                              stages are a gate, a staged drive, a THREE-BAND
//                              TONE STACK, a PRESENCE peak and a CAB. Live's Amp
//                              has Gain / Bass / Middle / Treble / Presence /
//                              Volume on one 0..10 scale; Roar (what shipped)
//                              has a shaper amount and a dry/wet, so six of the
//                              chip's nine knobs were arriving nowhere.
//                  Cabinet     step 4 of that same DSP — "CAB SIM — fixed 4x12
//                              approximation" — is FIXED and carries no box
//                              knob, so a Live Cabinet at the patch Live saved
//                              is its exact translation and nothing is written
//                              into it at all.
//
//     REFUSED      Echo        Paul's is the preset `Hiss Tape Mode`, and it is
//                              not a delay with the extras off: noise ON at
//                              0.797, wobble ON, a 0.39 reverb, a gate at
//                              -16.9 dB, feedback INVERTED, +6.35 dB of input
//                              gain. No untouched Echo exists in any of the four
//                              donors, so splicing `echo` out of this one would
//                              mean writing twenty parameters to turn a tape
//                              emulation OFF — inventing a factory patch nobody
//                              sent us. The `echo` chip stays on Delay, which
//                              says all four of its knobs and now says its time
//                              correctly (see live-devices.js DELAY_SYNC_*).
//                  DrumBuss    the box has no drum-bus word. Its kit gets the
//                              section's chips and a mixer strip; there is no
//                              drive / crunch / boom / transient vocabulary
//                              anywhere in fields.js for a DrumBuss to say.
//                  Vinyl       tracing and pinch distortion plus crackle — NOT
//                              tape. The master's `tape` word is {wob, sat},
//                              wow-and-flutter and saturation, and Vinyl has
//                              neither: its CracleDensity/CracleVolume are
//                              surface noise and its Drive is a fixed-curve
//                              clipper. Calling it tape would be the quiet lie
//                              gate 2 exists for.
//                  Overdrive   a band-limited pedal (MidFreq 50..20000,
//                  Pedal       BandWidth 0.5..9) and a three-knob stompbox.
//                  Tube        A valve stage: PreDrive/PostDrive +-15 dB, Bias,
//                              a single +-1 Tone. All three are ONE stage of
//                              the five insert_higain has; Amp is the device
//                              that has the tone stack and the presence.
//                  Compressor2 no box word. The record's dynamics live on the
//                  MultibandDynamics  master (`glue` -> GlueCompressor, already
//                  Gate        shipped) and on the desk's own faders. A
//                              compressor spliced from nothing would be a
//                              device at its default doing something the record
//                              never asked for.
//                  Redux2      no box word (there is no bitcrush chip).
//                  Erosion2    no box word.
//                  Shifter     already in the library, out of Ableton2.
//                  AutoShift   still nobody: no chip shifts pitch.
//                  StereoGain  IN THE LIBRARY SINCE DONOR 1 — and see
//                              live-devices.js masterDevices, which as of this
//                              round finally reads its parameter list instead of
//                              its name.
//                  Vocoder     still needs a modulator ROUTED in.
//                  4x MxDeviceAudioEffect   Max for Live. A `<Path>` to a
//                              .amxd on Paul's disk and no parameters this file
//                              could set even if it wanted to.
//
// WHAT TRAVELS WITH THEM, said out loud because gate 3 will print it: the
// PhaserNew carries THREE `<Path>` elements naming
// `/Applications/Ableton Live 12 Suite.app/.../Audio Effects/Phaser-Flanger`,
// its own `LastPresetRef`. That is the same class as the drum rack's ten
// Suite paths — a factory device inside the application bundle, not a file on
// Paul's disk — and an unresolved LastPresetRef costs a preset NAME in the
// title bar, never the device. The Amp and the Cabinet carry two `<Path>`
// elements each and both are EMPTY strings. Nothing here names a user folder.
//
// WHY THE DEVICES AND NOT THE TRACK, and why a SECOND fx rack rather than more
// of the first: fxrack.js is a photograph of one named track of one named donor
// and its `--check` means "that track of that file still holds these devices".
// Widening it to two source files would make the check mean less; a second
// rack is what masterrack.js already is, for the same reason.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SRC = path.join(ROOT, "tools/ableton/donor/Answers2.als");
const OUT = path.join(HERE, "fxrack2.js");
const REL = "tools/ableton/donor/Answers2.als";
const TRACK = "1-DS Drum Rack";
// THE DONOR'S OWN CHAIN ORDER — PhaserNew is device 2 of the 28, Cabinet is 10
// and Amp is 14 — which is also the order they are written into fxrack2.js, so
// a diff of the generated file reads like the chain Paul built. (In HIS chain
// the Cabinet sits four devices BEFORE the Amp, which is backwards for a guitar
// rig; this file is a photo album and not a chain, and als.js splices the pair
// in its own order, amp then speaker.)
const WANT = ["PhaserNew", "Cabinet", "Amp"];
const CHUNK = 120;

/* The balanced-element scanner, copied from als.js for the reason
   fxrack-extract.js states: this file runs under node with no bundler, and
   twelve lines is cheaper than dragging the whole exporter in to read a donor. */
const TOKEN = /<(\/?)([A-Za-z0-9._]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
function balancedAt(xml, from) {
  TOKEN.lastIndex = from;
  const first = TOKEN.exec(xml);
  if (!first || first.index !== from) throw new Error("no tag at " + from);
  if (first[4] === "/") return [from, TOKEN.lastIndex];
  const name = first[2];
  let depth = 1, m;
  while ((m = TOKEN.exec(xml))) {
    if (m[2] !== name) continue;
    if (m[1] === "/") { if (--depth === 0) return [from, TOKEN.lastIndex]; }
    else if (m[4] !== "/") depth++;
  }
  throw new Error("unbalanced <" + name + "> from " + from);
}

function build() {
  const xml = gunzipSync(readFileSync(SRC)).toString("utf8");
  let a = -1;
  for (const m of xml.matchAll(/<MidiTrack Id="\d+"/g)) {
    const end = xml.indexOf("</MidiTrack>", m.index);
    if (xml.slice(m.index, end).includes('<EffectiveName Value="' + TRACK + '"')) { a = m.index; break; }
  }
  if (a < 0) throw new Error("no track named " + TRACK + " in " + REL);
  const track = xml.slice(a, xml.indexOf("</MidiTrack>", a));
  const devs = {};
  for (const tag of WANT) {
    const i = track.indexOf("<" + tag + " Id=");
    if (i < 0) throw new Error("track " + TRACK + " of " + REL + " has no <" + tag + ">");
    const [s, e] = balancedAt(track, i);
    devs[tag] = track.slice(s, e);
  }
  const blob = WANT.map((t) => devs[t]).join("");
  const gz = gzipSync(Buffer.from(blob, "utf8"));
  const b64 = gz.toString("base64");
  const lines = [];
  for (let i = 0; i < b64.length; i += CHUNK) lines.push(b64.slice(i, i + CHUNK));
  return { devs, blob, gz, b64, lines, sha: createHash("sha256").update(gz).digest("hex") };
}

const render = (r) => `// nukernel/export/fxrack2.js — GENERATED BY nukernel/export/fxrack2-extract.js — DO NOT EDIT.
//
// The ${WANT.length} audio devices of \`${TRACK}\` in ${REL}
// that no earlier donor carries and a chip can reach: ${WANT.join(", ")}.
// EXACTLY as committed, concatenated in the donor's own chain order and
// gzipped as one member. Split them apart again with \`deviceLibrary()\` in
// nukernel/export/live-devices.js — the boundaries are the balanced elements,
// so nothing here has to remember a byte offset.
//
// Re-derive with \`node nukernel/export/fxrack2-extract.js\`; \`--check\` fails if
// this file and the donor have drifted apart, and test/als-page.browser.js runs
// that check the same way it runs the other three.

export const FXRACK2_SOURCE = ${JSON.stringify(REL)};
export const FXRACK2_TRACK = ${JSON.stringify(TRACK)};
export const FXRACK2_DEVICES = ${JSON.stringify(WANT)};
export const FXRACK2_XML_BYTES = ${r.blob.length};
export const FXRACK2_GZIP_BYTES = ${r.gz.length};
export const FXRACK2_SHA256 = ${JSON.stringify(r.sha)};

/** The ${WANT.length} device subtrees, gzipped, base64. Feed to DecompressionStream("gzip"). */
export const FXRACK2_GZIP_B64 = [
${r.lines.map((l) => '"' + l + '",').join("\n")}
].join("");
`;

const r = build();
const argv = process.argv.slice(2);
if (argv.includes("--report")) {
  console.log("fx rack 2  " + WANT.length + " devices from " + TRACK + " in " + REL);
  for (const t of WANT) console.log("  " + t.padEnd(14) + r.devs[t].length + " bytes of XML");
  console.log("  xml    " + r.blob.length + " bytes");
  console.log("  gzip   " + r.gz.length + " bytes  ·  sha256 " + r.sha.slice(0, 16));
  console.log("  b64    " + r.b64.length + " chars over " + r.lines.length + " lines");
} else if (argv.includes("--check")) {
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (have !== render(r)) {
    console.error("fxrack2.js is STALE — re-run `node nukernel/export/fxrack2-extract.js`");
    process.exit(1);
  }
  console.log("fxrack2.js matches " + REL + " (" + WANT.join(", ") + ")");
} else {
  writeFileSync(OUT, render(r));
  console.log("wrote " + path.relative(ROOT, OUT) + "  (" + r.gz.length + " gzip bytes, " +
    WANT.length + " devices)");
}

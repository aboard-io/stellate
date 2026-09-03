#!/usr/bin/env node
// nukernel/export/fxrack-extract.js — THE SIX AUDIO DEVICES PAUL PUT IN THE
// SECOND DONOR THAT THE FIRST DONOR DOES NOT HAVE, extracted the same way the
// drum rack is (drumrack-extract.js) and the donor itself is (donor-extract.js).
//
// Paul, 2026-09-03: "the midi shifts aren't showing up in ableton, like the
// envelope settings that would tweak the sound and filters and so forth …
// think about adding in more effects too i added plenty in the donor file."
//
// He did: `Ableton2.als` track `6-MIDI` is a twelve-device audio chain —
// Vocoder, StereoGain, Shifter, Reverb, Delay, Chorus2, AutoShift, AutoPan2,
// AutoFilter2, FilterDelay, FilterEQ3, Eq8. SIX of those twelve already exist
// in `Generic.als`, which is the splice base and is already carried into the
// page, so taking them twice would be weight for nothing:
//
//     in Generic already        AutoFilter2, Eq8, Roar, StereoGain, Vocoder
//                               (track `1-MIDI`), Reverb (return A),
//                               Delay (return B)
//     ONLY in Ableton2          Chorus2, Shifter, AutoPan2, FilterDelay,
//                               FilterEQ3, AutoShift
//
// So this photographs the second list and nothing else. Every byte of it was
// written by Live 12.4.5 and als-gate.js Gate 2's corpus is already
// `Generic ∪ Ableton2`, so a device spliced out of here is an element the
// conformance check already accepts — nothing is invented, which is the whole
// bet of the splice strategy.
//
// WHY THE DEVICES AND NOT THE TRACK. drumrack.js takes a whole `<MidiTrack>`
// because the drums lane BECOMES that track. These are inserts: they are added
// to a track that already exists (als.js addDevice), so the unit is the
// `<Device>` subtree. One string per device, keyed by tag name, so a caller
// asks for `FX_DEVICES.Chorus2` and gets Live's own default patch of it.
//
// THE DEVICES ARE FOUND BY TAG INSIDE A NAMED TRACK, never by offset, so a
// re-save that moves them does not silently extract something else — and a
// device that has gone missing from the donor is a hard throw here rather than
// an empty string that would splice as nothing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SRC = path.join(ROOT, "tools/ableton/donor/Ableton2.als");
const OUT = path.join(HERE, "fxrack.js");
const REL = "tools/ableton/donor/Ableton2.als";
const TRACK = "6-MIDI";
// the six Generic does not carry. Order is the donor's own chain order, which
// is also the order they are written into fxrack.js, so a diff of the generated
// file reads like the chain Paul built.
const WANT = ["Shifter", "Delay", "Chorus2", "AutoShift", "AutoPan2", "FilterDelay", "FilterEQ3"];
/* `Delay` IS IN BOTH DONORS AND WE TAKE ABLETON2'S ANYWAY, for a reason that
   is measured and not aesthetic. Generic's Delay is the one on return B, and
   it carries a `LastPresetRef` naming
   `/Users/nsh/Library/Application Support/Ableton/Live 11 Core Library/…/
   Dotted Eighth Note.adv` — a Simple Delay preset saved by a DIFFERENT USER
   ACCOUNT, which donor/README.md has listed as a travelling hazard since the
   donor landed and which als-gate.js Gate 3 prints on every run. That path is
   harmless sitting on ONE return track. Splicing the `echo` chip out of it
   would put a stranger's home directory on every track of every export
   instead. Ableton2's `6-MIDI` Delay is the same device with ZERO `<Path>`
   elements in it (measured: `set()` against Generic's two), 15,194 bytes
   against 16,200, and 1.0 KB more of gzip here is a good trade for not
   multiplying a dead absolute path by the size of the band. */
const CHUNK = 120;

/* The balanced-element scanner, copied from als.js rather than imported: this
   file runs under node with no bundler and als.js is an ES module the extractor
   would otherwise drag the whole donor through. Twelve lines is cheaper than a
   dependency, and als-gate.js proves the two agree by round-tripping the output
   through als.js's own reader. */
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

const render = (r) => `// nukernel/export/fxrack.js — GENERATED BY nukernel/export/fxrack-extract.js — DO NOT EDIT.
//
// The ${WANT.length} audio devices of \`${TRACK}\` in ${REL}
// that \`Generic.als\` does not carry: ${WANT.join(", ")}.
// EXACTLY as committed, concatenated in the donor's own chain order and
// gzipped as one member. Split them apart again with \`fxDevices()\` in
// nukernel/export/live-devices.js — the boundaries are the balanced elements,
// so nothing here has to remember a byte offset.
//
// Re-derive with \`node nukernel/export/fxrack-extract.js\`; \`--check\` fails if
// this file and the donor have drifted apart, and test/als-page.browser.js runs
// that check the same way it runs the donor's.

export const FXRACK_SOURCE = ${JSON.stringify(REL)};
export const FXRACK_TRACK = ${JSON.stringify(TRACK)};
export const FXRACK_DEVICES = ${JSON.stringify(WANT)};
export const FXRACK_XML_BYTES = ${r.blob.length};
export const FXRACK_GZIP_BYTES = ${r.gz.length};
export const FXRACK_SHA256 = ${JSON.stringify(r.sha)};

/** The ${WANT.length} device subtrees, gzipped, base64. Feed to DecompressionStream("gzip"). */
export const FXRACK_GZIP_B64 = [
${r.lines.map((l) => '"' + l + '",').join("\n")}
].join("");
`;

const r = build();
const argv = process.argv.slice(2);
if (argv.includes("--report")) {
  console.log("fx rack  " + WANT.length + " devices from " + TRACK + " in " + REL);
  for (const t of WANT) console.log("  " + t.padEnd(14) + r.devs[t].length + " bytes of XML");
  console.log("  xml    " + r.blob.length + " bytes");
  console.log("  gzip   " + r.gz.length + " bytes  ·  sha256 " + r.sha.slice(0, 16));
  console.log("  b64    " + r.b64.length + " chars over " + r.lines.length + " lines");
} else if (argv.includes("--check")) {
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (have !== render(r)) {
    console.error("fxrack.js is STALE — re-run `node nukernel/export/fxrack-extract.js`");
    process.exit(1);
  }
  console.log("fxrack.js matches " + REL + " (" + WANT.join(", ") + ")");
} else {
  writeFileSync(OUT, render(r));
  console.log("wrote " + path.relative(ROOT, OUT) + "  (" + r.gz.length + " gzip bytes, " +
    WANT.length + " devices)");
}

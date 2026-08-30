#!/usr/bin/env node
/* test/sfx-shelf.test.js — THE EIGHT SFX WITH NO ROW, MEASURED (2026-08-30).
 *
 * The sampling round shipped ten crate ids and reported the gap in fields.js's
 * own comment: "gun_shot, helicopter, applause, telephone, bird_tweet,
 * reverse_cymbal, breath_noise and fret_noise have zones ON DISK
 * (found/samples/instruments/) and NO row in the parent's SAMPLERS registry —
 * recipeFor returns `unrouted` for all eight". This file is the proof the
 * registry lane closed it, and it TESTS THE ARTIFACT at every level: the row
 * against the zones.json it is a projection of, the routing through the real
 * samplerLibFor, the WAV BYTES ON DISK, and the RENDERED PCM out of the shipped
 * mixer. Nothing here reads the wiring and calls it a sound.
 *
 *   S1  every row is an EXTRACTION, not a typing. Each of the eight rows in
 *       engine/registry-data.js is re-derived from its own zones.json by
 *       engine/faust/build/samplers-row.js and must round-trip exactly — and
 *       the extractor itself is checked against the committed `sea_shore` row
 *       (the id the gap report named as the one that DOES work), whose source
 *       line it must reproduce byte for byte.
 *   S2  recipeFor routes each one `sampler:<id>` with an EMPTY unrouted list,
 *       through the same to-engine samplerLibFor the page plays. Before the
 *       rows landed this was `unrouted` eight times over.
 *   S3  the zone WAV decodes: canonical RIFF/WAVE, mono 16-bit 44100, its
 *       sample count equals the `len` zones.json recorded, and the decoded
 *       PCM is not silence (peak and RMS both > 0).
 *   S4  the RENDER is not silence. Every zone goes through sampler.js mixPCM —
 *       the shipped per-note PCM mixer, at the note gain stream-renderer.js
 *       builds sampled notes with — at its own zone root, and the dry bus
 *       comes back with real energy.
 *   S5  the LOOP FLAGS ARE THE SOUND'S OWN, measured not declared: rendered
 *       three seconds long, the two zones the font marks looping (helicopter,
 *       applause) still have energy in the last half second — after their own
 *       file has run out — and the six one-shots are silent there. A gunshot
 *       that sustained would be a bed wearing a hit's name.
 *   S6  ABSENT IS TODAY. The eight are APPENDED to SAMPLERS, so against the
 *       committed tree (`git show HEAD:engine/registry-data.js`) every
 *       pre-existing id keeps its exact position in Object.keys AND its exact
 *       row — which is what keeps applySampledOnly's foundSources list, and
 *       therefore every existing record, byte-for-byte where it was.
 *
 * RUN:  node test/sfx-shelf.test.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const R = (p) => path.join(ROOT, p);

const EIGHT = ["gun_shot", "helicopter", "applause", "telephone", "bird_tweet",
               "reverse_cymbal", "breath_noise", "fret_noise"];
const LOOPERS = new Set(["helicopter", "applause"]);   // asserted against the font in S5

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

/* ---- a minimal RIFF/WAVE reader (the zones are written by
   engine/faust/build/extract-gm.js: 44-byte canonical header, mono int16) ---- */
function readWav(file) {
  const b = fs.readFileSync(file);
  const head = { riff: b.toString("ascii", 0, 4), wave: b.toString("ascii", 8, 12),
                 fmt: b.readUInt16LE(20), ch: b.readUInt16LE(22),
                 sr: b.readUInt32LE(24), bits: b.readUInt16LE(34),
                 data: b.toString("ascii", 36, 40), bytes: b.readUInt32LE(40) };
  const n = (head.bytes / 2) | 0;
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = b.readInt16LE(44 + i * 2) / 32768;
  return { head, pcm };
}
const rms = (a, from, to) => { let s = 0, n = 0;
  for (let i = from | 0; i < Math.min(to, a.length); i++) { s += a[i] * a[i]; n++; }
  return n ? Math.sqrt(s / n) : 0; };
const peak = (a) => { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; };
const freqOfMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);

console.log("test/sfx-shelf.test.js — the eight SFX with no row\n");

const REG = require(R("engine/registry-data.js"));
const ROW = require(R("engine/faust/build/samplers-row.js"));
const SP = require(R("engine/faust/voices/sampler.js"));

/* ---- S1 the rows are extractions ---------------------------------------- */
ok("S1a the extractor reproduces the committed sea_shore row byte for byte", () => {
  const src = fs.readFileSync(R("engine/registry-data.js"), "utf8").split("\n");
  const line = src.find((l) => l.startsWith("    sea_shore: "));
  assert.ok(line, "no sea_shore row in registry-data.js");
  assert.strictEqual(ROW.rowText("sea_shore"), line);
});
ok("S1b each of the eight rows equals an extraction of its own zones.json", () => {
  const src = fs.readFileSync(R("engine/registry-data.js"), "utf8").split("\n");
  for (const id of EIGHT) {
    const line = src.find((l) => l.startsWith("    " + id + ": "));
    assert.ok(line, id + " has no row in registry-data.js");
    assert.strictEqual(line, ROW.rowText(id), id + " row is not what zones.json projects to");
  }
});

/* ---- S3 the wavs on disk decode ----------------------------------------- */
const WAV = {};
ok("S3 every zone wav decodes: canonical mono 16-bit 44100, len matches zones.json, not silence", () => {
  for (const id of EIGHT) {
    const row = REG.SAMPLERS[id];
    assert.ok(row, id + " has no SAMPLERS row");
    assert.strictEqual(row.zones.length, 1, id + " is not one zone (" + row.zones.length + ")");
    const z = row.zones[0];
    const meta = JSON.parse(fs.readFileSync(R("found/samples/instruments/" + row.dir + "/zones.json"), "utf8"));
    const w = readWav(R("found/samples/instruments/" + row.dir + "/" + z.file));
    WAV[id] = w.pcm;
    assert.ok(w.head.riff === "RIFF" && w.head.wave === "WAVE" && w.head.data === "data",
      id + " is not RIFF/WAVE");
    assert.ok(w.head.fmt === 1 && w.head.ch === 1 && w.head.sr === 44100 && w.head.bits === 16,
      id + " header " + JSON.stringify(w.head));
    assert.strictEqual(w.pcm.length, meta.zones[0].len,
      id + " decoded " + w.pcm.length + " samples, zones.json says " + meta.zones[0].len);
    assert.ok(peak(w.pcm) > 0.01 && rms(w.pcm, 0, w.pcm.length) > 1e-4,
      id + " decodes to silence (peak " + peak(w.pcm).toFixed(4) + ")");
    assert.ok(z.le <= w.pcm.length, id + " loop end " + z.le + " past the buffer " + w.pcm.length);
  }
});

/* ---- S4/S5 the render, through the shipped mixer ------------------------ */
// six seconds: the longest zone (applause, 2.91 s) has to END inside the
// window or the tail measurement below proves nothing — asserted, not assumed.
const SR = 44100, SECS = 6, N = SR * SECS;
function render(id) {
  const row = REG.SAMPLERS[id], z = row.zones[0];
  // the zone EXACTLY as genre-kernel's _sampledOnlySpec builds it for samplerLib
  const zone = { srcId: id, root: z.root, lo: z.lo, hi: z.hi, vlo: z.vlo, vhi: z.vhi,
                 loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: row.sr };
  const into = { dry: new Float32Array(N), rev: new Float32Array(N), del: new Float32Array(N) };
  // the note gain stream-renderer.js:649 builds a sampled note with, at the
  // default unit level and the default set gain (0.5 * 0.13)
  SP.mixPCM([{ freq: freqOfMidi(z.root), zones: [zone], tSec: 0, durSec: SECS - 0.2,
               gain: 0.5 * 0.13, atk: 0.001, rel: 0.01, sr: SR }],
            { [id]: WAV[id] }, SR, into, { dry: 1, rev: 0, del: 0 }, null, null);
  return into.dry;
}
const OUT = {};
ok("S4 every one of the eight RENDERS non-silence through sampler.js mixPCM", () => {
  const say = [];
  for (const id of EIGHT) {
    const dry = OUT[id] = render(id);
    const r = rms(dry, 0, N);
    say.push(id + " " + r.toFixed(5));
    assert.ok(r > 1e-4, id + " renders silence (RMS " + r + ")");
  }
  console.log("       dry RMS: " + say.join(", "));
});
ok("S5 the loop flags are the sound's own: the beds still sound past their own file, the hits do not", () => {
  const tail = (id) => rms(OUT[id], N - SR * 0.5, N);
  const say = [];
  for (const id of EIGHT) {
    const fileSec = WAV[id].length / SR;
    const t = tail(id);
    say.push(id + " file " + fileSec.toFixed(2) + "s tail " + t.toFixed(6));
    assert.ok(fileSec < SECS - 1, id + " file is longer than the render window — the test proves nothing");
    assert.strictEqual(!!REG.SAMPLERS[id].zones[0].loop, LOOPERS.has(id),
      id + " loop flag disagrees with what the font says");
    if (LOOPERS.has(id)) assert.ok(t > 1e-4, id + " is a bed but died at " + fileSec.toFixed(2) + "s (tail RMS " + t + ")");
    else assert.ok(t < 1e-6, id + " is a one-shot but is still sounding seconds past its file (tail RMS " + t + ")");
  }
  console.log("       " + say.join("\n       "));
});

/* ---- S6 absent is today -------------------------------------------------- */
ok("S6 nothing that existed moved: the committed table is a PREFIX of this one", () => {
  const before = execFileSync("git", ["show", "HEAD:engine/registry-data.js"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  const M = { exports: {} };
  new Function("module", "exports", "globalThis", before)(M, M.exports, {});
  const OLD = M.exports.SAMPLERS;
  const oldKeys = Object.keys(OLD), newKeys = Object.keys(REG.SAMPLERS);
  assert.deepStrictEqual(newKeys.slice(0, oldKeys.length), oldKeys,
    "the pre-existing ids are no longer the first " + oldKeys.length + " keys in order");
  for (const k of oldKeys)
    assert.deepStrictEqual(REG.SAMPLERS[k], OLD[k], k + "'s row changed");
  assert.deepStrictEqual(newKeys.slice(oldKeys.length), EIGHT,
    "the appended ids are not the eight");
  console.log("       " + oldKeys.length + " committed ids unmoved and unchanged; " +
              EIGHT.length + " appended");
});

/* ---- S2 the routing (last: it loads nukernel, which wants a window) ------ */
(async () => {
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = { visibilityState: "visible", body: { append() {} },
    createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
  window.NuKernel = require(R("nukernel/kernel.js"));
  window.NuGenres = require(R("nukernel/genres.js"));
  window.NuFields = require(R("nukernel/fields.js"));
  window.NuSong = require(R("nukernel/song.js"));
  window.NuInstruments = require(R("nukernel/instruments.js"));
  window.__REGISTRY = REG;
  const K = require(R("engine/genre-kernel.js"));
  const TE = await import(R("nukernel/audio/to-engine.js"));
  const lib = TE.samplerLibFor(K, 1).samplerLib || {};

  ok("S2 recipeFor routes all eight sampler:<id> with an empty unrouted list", () => {
    const bad = [];
    for (const id of EIGHT) {
      const u = [];
      const r = TE.recipeFor("line", { instr: id }, lib, u);
      if (r.source !== "sampler:" + id || u.length)
        bad.push(id + " -> " + r.source + (u.length ? " (" + u[0].why + ")" : ""));
    }
    assert.strictEqual(bad.length, 0, bad.join("; "));
  });
  ok("S2b the samplerLib the engine plays carries each zone with a decodable srcId", () => {
    for (const id of EIGHT) {
      const spec = lib[id];
      assert.ok(spec && spec.zones && spec.zones.length === 1, id + " has no lib spec");
      assert.strictEqual(spec.zones[0].srcId, "ins_" + id + "_0", id + " srcId " + spec.zones[0].srcId);
      const row = REG.SAMPLERS[id];
      assert.ok(fs.existsSync(R("found/samples/instruments/" + row.dir + "/" + row.zones[0].file)),
        id + " zone wav is not on disk");
    }
  });
  // the OFFERING is the catalogue lane's (fields.js INSTRCHOICES). Report where
  // it stands rather than assert it, so this gate is green on the engine's own
  // work and turns into a real check the day the ids are offered.
  const NF = window.NuFields, NI = window.NuInstruments;
  const offered = EIGHT.filter((id) => NF.INSTRCHOICES[id]);
  if (offered.length === EIGHT.length) {
    ok("S7 offered: sampledId agrees with the routing and each has a RANGES compass", () => {
      for (const id of EIGHT) {
        assert.strictEqual(NI.sampledId(id), true, id + " sampledId says no");
        assert.ok(NI.RANGES[id], id + " has no compass row");
      }
    });
  } else {
    console.log("  --   S7 offering: " + offered.length + "/8 in fields.js INSTRCHOICES" +
      " (routable now; the catalogue lane offers them)" +
      "\n       needs a RANGES row: " + EIGHT.filter((id) => !NI.RANGES[id]).join(" "));
  }

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

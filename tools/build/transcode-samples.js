#!/usr/bin/env node
// transcode-samples.js — the instrument-zone MP3 diet.
//
// The sampled layer ships 614 zone wavs (~103MB) that every listener must fetch
// before the first sampled note. Instrument zones are nearly bandlimited already
// — measured 0.254% of their energy above 11kHz — so mono/22.05k/48kbps mp3
// measures a HIGHER SNR (24.7dB) than 64k at 44.1k while being 25% smaller than
// that, and ~14x smaller than the wav. This tool converts in place and re-bakes
// the SAMPLERS metadata in engine/registry-data.js to match.
//
// Three things make the rebake load-bearing, not cosmetic:
//   * ls/le are ABSOLUTE SAMPLE INDICES at `sr`. Halving the rate without
//     halving them makes every looped zone (552 of 614) click or drift.
//   * `len` is NEW. Chromium and Firefox decode these mp3s sample-exact, but
//     WebKit prepends a CONSTANT 1105-sample (25ms) decoder lead-in and pads the
//     tail. The player detects that by comparing the decoded length against the
//     expected one — so the expected length has to be baked in, scaled by
//     decoded.sampleRate/zone.sr because decodeAudioData resamples to the ctx.
//   * sr moves per SAMPLER, not per zone, so a sampler converts all-or-nothing:
//     one failed zone leaves the whole instrument on wav.
//
// found/ is gitignored — the media is derived. THIS FILE and the regenerated
// SAMPLERS block are the committed deliverable.
//
// usage: node tools/build/transcode-samples.js [--dry] [--keep-wav] [--only id,id] [--jobs N]

const fs = require("fs"), path = require("path"), os = require("os");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
// SAMPLERS is READ through genre-kernel (which re-exports DATA.SAMPLERS) but
// SPLICED into registry-data, where the literal actually lives since the
// kernel/data split. Reading through the kernel keeps this tool honest about
// what the engine sees; writing to the kernel would find no literal at all.
const KERNEL = path.join(ROOT, "engine", "genre-kernel.js");
const REGISTRY = path.join(ROOT, "engine", "registry-data.js");
const BASE = path.join(ROOT, "found", "samples", "instruments");
const SR_OUT = 22050, BITRATE = "48k";
// A tag-honouring decoder (ffmpeg, chromium, firefox) reproduces the source
// length exactly — EXCEPT that ffmpeg's LAME tag understates the final frame's
// padding by a few samples when the tail lands within ~576 of a frame boundary,
// so a handful of zones decode a hair LONG. Slack that small is inaudible tail
// silence; anything larger (or ANY short decode = lost audio) is a broken file.
// `len` is always the MEASURED decode, which is what the browser compares
// against — WebKit's lead-in is 1105 samples, orders above this slack.
const SLACK_MAX = 64;

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = f => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };
const DRY = has("--dry"), KEEP = has("--keep-wav");
const ONLY = (val("--only") || "").split(",").filter(Boolean);
const JOBS = Math.max(1, +(val("--jobs") || os.cpus().length) || 4);

const run = (bin, args, opts = {}) => new Promise((res, rej) =>
  execFile(bin, args, { maxBuffer: 1 << 28, encoding: null, ...opts },
    (e, so, se) => e ? rej(new Error(bin + ": " + String(se || e.message).trim().split("\n").pop())) : res(so)));

// frames + rate of a PCM file, exactly: duration_ts counts time_base units and
// wav's time_base is 1/sr, so ts*(num/den)*sr is integer — no float rounding.
async function wavProbe(p) {
  const out = String(await run("ffprobe", ["-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=duration_ts,time_base,sample_rate", "-of", "default=nw=1", p]));
  const f = {};                                  // ffprobe prints stream order, not query order — key it
  out.trim().split("\n").forEach(l => { const i = l.indexOf("="); f[l.slice(0, i)] = l.slice(i + 1); });
  const [num, den] = f.time_base.split("/").map(Number);
  return { samples: Math.round(+f.duration_ts * (num / den) * +f.sample_rate), rate: +f.sample_rate };
}

// decode an mp3 to raw s16le at SR_OUT and count frames — the ONLY honest length
// check (mp3 headers lie about padding; ffmpeg strips it via the Xing header).
async function mp3Samples(p) {
  const pcm = await run("ffmpeg", ["-v", "error", "-i", p, "-ac", "1", "-ar", String(SR_OUT), "-f", "s16le", "-"]);
  return pcm.length / 2;
}

async function encode(src, dst) {
  await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-ac", "1", "-ar", String(SR_OUT),
    "-c:a", "libmp3lame", "-b:a", BITRATE, "-write_xing", "1", dst]);
}

const size = p => { try { return fs.statSync(p).size; } catch { return 0; } };

// ---------- pass 1: transcode + verify, sampler at a time ----------

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

async function main() {
  const K = require(KERNEL);
  const S = K.SAMPLERS;
  const ids = Object.keys(S).filter(id => !ONLY.length || ONLY.includes(id));
  const tmp = DRY ? fs.mkdtempSync(path.join(os.tmpdir(), "stellate-transcode-")) : null;

  const done = {};            // id -> [zone,…] rebaked
  const failures = [], loopWarn = [], skipped = [], slack = [], absent = [], retire = [];
  let bIn = 0, bOut = 0, nFiles = 0;

  for (const id of ids) {
    const s = S[id];
    const dir = path.join(BASE, s.dir);
    // idempotent: an already-converted sampler is complete metadata + files
    if (s.sr === SR_OUT && s.zones.every(z => /\.mp3$/.test(z.file) && z.len > 0
      && fs.existsSync(path.join(dir, z.file)))) {
      skipped.push(id);
      s.zones.forEach(z => { const b = size(path.join(dir, z.file)); bIn += b; bOut += b; nFiles++; });
      continue;
    }

    const zones = await pool(s.zones, JOBS, async z => {
      const stem = z.file.replace(/\.[^.]+$/, "");
      const src = path.join(dir, stem + ".wav");
      const dst = (DRY ? path.join(tmp, s.dir + "__" + stem) : path.join(dir, stem)) + ".mp3";
      if (!fs.existsSync(src)) return { absent: true, z, src };
      const w = await wavProbe(src);
      const want = Math.round(w.samples * SR_OUT / w.rate);
      if (DRY) fs.mkdirSync(tmp, { recursive: true });
      await encode(src, dst);
      const got = await mp3Samples(dst);
      if (got < want || got > want + SLACK_MAX)
        return { err: `decoded ${got} samples, expected ${want}`, z, src, dst };
      if (got !== want) slack.push(got - want);
      // ls/le ride the audio's scale — measured against the METADATA's declared
      // rate, not the wav's. On a re-fetch the wavs come back at 44.1k while the
      // committed indices are already at 22.05k; scaling off the wav would halve
      // them a second time and detune every loop.
      const k = SR_OUT / s.sr;
      const ls = Math.round(z.ls * k), le = Math.round(z.le * k);
      // le is an EXCLUSIVE end, so le == len (SF2 loop running to EOF) is legal
      // and pre-existing; le > len would mean the loop reads past the file.
      if (z.loop && le > got) loopWarn.push(`${id}/${z.file}: le ${le} > len ${got}`);
      return { ok: 1, src, dst, inBytes: size(src), outBytes: size(dst),
        zone: { ...z, file: stem + ".mp3", ls, le, len: got } };
    });

    const gone = zones.filter(z => z.absent);
    if (gone.length === zones.length) { absent.push(id); continue; }   // crate never fetched
    const bad = zones.filter(z => z.err || z.absent);
    if (bad.length) {
      // sr is per-SAMPLER: a partial conversion would need two rates in one
      // instrument. Roll the whole sampler back to wav and report it.
      bad.forEach(b => failures.push(`${id}/${b.z.file}: ${b.err}`));
      if (!DRY) zones.forEach(z => { if (z.ok) try { fs.unlinkSync(z.dst); } catch {} });
      continue;
    }
    zones.forEach(z => { bIn += z.inBytes; bOut += z.outBytes; nFiles++; });
    done[id] = zones.map(z => z.zone);
    retire.push(...zones.map(z => z.src));
  }

  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });

  // ---------- pass 2: splice the metadata, THEN retire the sources ----------
  // Order matters. The .wav is the only thing that can regenerate a zone, and the
  // kernel block is the only record of the new rate and loop indices — so
  // deleting sources per-sampler while the splice ran once at the very end left
  // an interrupt window with the media gone and nothing describing what replaced
  // it. Splice first; unlink only what the splice committed to.
  if (!DRY && Object.keys(done).length) spliceRegistry(done);
  if (!DRY && !KEEP) retire.forEach(f => { try { fs.unlinkSync(f); } catch {} });

  const pct = bIn ? (100 * bOut / bIn) : 0;
  const mb = b => (b / 1048576).toFixed(1) + "MB";
  console.log(`\n${DRY ? "[dry] " : ""}transcode-samples: ${Object.keys(done).length} samplers rebaked` +
    (skipped.length ? `, ${skipped.length} already mp3` : "") + `, ${nFiles} files`);
  console.log(`  before ${mb(bIn)}  after ${mb(bOut)}  ratio ${(bIn / (bOut || 1)).toFixed(1)}x  (${pct.toFixed(1)}% of original)`);
  if (slack.length) console.log(`  tail slack on ${slack.length} zones (max +${Math.max(...slack)} samples, baked into len)`);
  if (loopWarn.length) { console.log(`  LOOP SANITY (${loopWarn.length}):`); loopWarn.forEach(w => console.log("    " + w)); }
  if (failures.length) { console.log(`  FAILED, left on wav (${failures.length}):`); failures.forEach(f => console.log("    " + f)); }
  if (absent.length) console.log(`  not fetched, skipped (${absent.length}): ${absent.join(", ")}`);
  // Absent crates are not failures: a few samplers ship from a different fetch
  // script, and a nonzero exit here would abort fetch-found-samples.sh (set -e).
  process.exit(failures.length ? 1 : 0);
}

// Rewrite the SAMPLERS block in place. Each sampler is ONE line in house style;
// we edit only its `sr:` and `zones:[…]` so every comment, label, dir and the key
// order around them survive byte-identical.
function spliceRegistry(done) {
  const src = fs.readFileSync(REGISTRY, "utf8");
  const lines = src.split("\n");
  const start = lines.findIndex(l => /^\s*D\.SAMPLERS\s*=\s*\{/.test(l));
  if (start < 0) throw new Error("SAMPLERS block not found in " + path.basename(REGISTRY));
  const end = lines.findIndex((l, i) => i > start && /^\s{2}\};\s*$/.test(l));
  if (end < 0) throw new Error("SAMPLERS block end not found");

  const num = n => Number.isInteger(n) ? String(n) : String(+n.toFixed(6));
  const zoneTxt = z => "{" + ["file", "root", "lo", "hi", "loop", "ls", "le", "len"]
    .filter(k => z[k] !== undefined)
    .map(k => k + ":" + (k === "file" ? JSON.stringify(z[k]) : num(z[k]))).join(",") + "}";

  let hit = 0;
  for (let i = start; i < end; i++) {
    const m = lines[i].match(/^\s{4}([A-Za-z0-9_]+)\s*:\s*\{/);
    if (!m || !done[m[1]]) continue;
    const zs = lines[i].indexOf("zones:[");
    if (zs < 0) throw new Error("no zones array on " + m[1]);
    let d = 0, ze = -1;
    for (let j = zs + 6; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === "[") d++; else if (c === "]" && --d === 0) { ze = j; break; }
    }
    if (ze < 0) throw new Error("unterminated zones array on " + m[1]);
    lines[i] = lines[i].slice(0, zs) + "zones:[" + done[m[1]].map(zoneTxt).join(",") + "]" + lines[i].slice(ze + 1);
    lines[i] = lines[i].replace(/\bsr:\s*44100\b/, "sr:" + SR_OUT);
    hit++;
  }
  if (hit !== Object.keys(done).length) throw new Error(`spliced ${hit} of ${Object.keys(done).length} samplers`);
  fs.writeFileSync(REGISTRY, lines.join("\n"));
  console.log(`spliced ${hit} samplers into engine/registry-data.js`);
}

main().catch(e => { console.error(e.message); process.exit(1); });

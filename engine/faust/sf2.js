// faust/sf2.js — minimal zero-dep SoundFont 2 (RIFF) reader + zone extractor.
//
// WHY THIS EXISTS ("can Faust play soundfonts?"): no — Faust's `soundfile`
// primitive reads plain audio files and has no notion of SF2 preset/zone/
// loop-point structure, and per-algorithm WASM builds can't embed a 150MB
// font anyway. But the engine's NATIVE sampler path (AudioBufferSourceNode
// live / PCM mix in press — the same path found-sound uses per FAUST-PORT.md)
// plays extracted zones perfectly. So: parse the SF2 offline, extract the
// presets we want as wav zones + zones.json (root key, key range, loop
// points), and the sampler model consumes those. The font itself is never
// shipped; found/samples/instruments/ holds only the zones we use.
//
// Format notes (SoundFont 2.01 spec):
//   RIFF sfbk -> LIST INFO / LIST sdta (smpl: 16-bit LE PCM words)
//             -> LIST pdta: phdr(38B recs) pbag(4B) pmod(10B) pgen(4B)
//                           inst(22B)      ibag(4B) imod(10B) igen(4B)
//                           shdr(46B: name,start,end,loopStart,loopEnd,sr,
//                                origPitch,pitchCorr,link,type)
//   generators used: 41 instrument (pgen terminal), 53 sampleID (igen
//   terminal), 43 keyRange (lo|hi bytes), 44 velRange, 54 sampleModes
//   (1/3 = looping), 58 overridingRootKey, 51/52 coarse/fineTune.
//   Limitation (documented): preset-level relative generators are ignored —
//   we only extract instrument-level zones, which is exact for the pitch/
//   loop data we need from FluidR3-class fonts.
//
// CLI:
//   node faust/sf2.js list <font.sf2>
//   node faust/sf2.js extract <font.sf2> "/NAME/" <outDir> [--max-zones 6]
//     -> outDir/<slug>/zNN_r<root>.wav (mono 16-bit 44100) + zones.json
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.SF2 = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function parse(buf) { // buf: Uint8Array | Buffer | ArrayBuffer
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    const str = (o, n) => { let s = ""; for (let i = 0; i < n; i++) { const c = u8[o + i]; if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
    if (tag(0) !== "RIFF" || tag(8) !== "sfbk") throw new Error("not a SoundFont (RIFF sfbk)");
    // walk top-level LISTs, then pdta sub-chunks
    const chunks = {};   // pdta name -> {off,len}; plus smpl
    let o = 12;
    while (o + 8 <= u8.length) {
      const id = tag(o), len = dv.getUint32(o + 4, true);
      if (id === "LIST") {
        const kind = tag(o + 8);
        let p = o + 12;
        const end = o + 8 + len;
        while (p + 8 <= end) {
          const cid = tag(p), clen = dv.getUint32(p + 4, true);
          if (kind === "sdta" && cid === "smpl") chunks.smpl = { off: p + 8, len: clen };
          if (kind === "pdta") chunks[cid] = { off: p + 8, len: clen };
          p += 8 + clen + (clen & 1);
        }
      }
      o += 8 + len + (len & 1);
    }
    for (const need of ["phdr", "pbag", "pgen", "inst", "ibag", "igen", "shdr", "smpl"])
      if (!chunks[need]) throw new Error("missing chunk: " + need);
    const rec = (c, size, fn) => { const out = []; for (let p = c.off; p + size <= c.off + c.len; p += size) out.push(fn(p)); return out; };
    const phdr = rec(chunks.phdr, 38, (p) => ({ name: str(p, 20), preset: dv.getUint16(p + 20, true), bank: dv.getUint16(p + 22, true), bagNdx: dv.getUint16(p + 24, true) }));
    const pbag = rec(chunks.pbag, 4, (p) => ({ genNdx: dv.getUint16(p, true) }));
    const pgen = rec(chunks.pgen, 4, (p) => ({ oper: dv.getUint16(p, true), amount: dv.getUint16(p + 2, true) }));
    const inst = rec(chunks.inst, 22, (p) => ({ name: str(p, 20), bagNdx: dv.getUint16(p + 20, true) }));
    const ibag = rec(chunks.ibag, 4, (p) => ({ genNdx: dv.getUint16(p, true) }));
    const igen = rec(chunks.igen, 4, (p) => ({ oper: dv.getUint16(p, true), amount: dv.getUint16(p + 2, true) }));
    const shdr = rec(chunks.shdr, 46, (p) => ({ name: str(p, 20), start: dv.getUint32(p + 20, true), end: dv.getUint32(p + 24, true),
      loopStart: dv.getUint32(p + 28, true), loopEnd: dv.getUint32(p + 32, true), rate: dv.getUint32(p + 36, true),
      origPitch: u8[p + 40], pitchCorr: dv.getInt8(p + 41), type: dv.getUint16(p + 44, true) }));

    // resolve one preset's instrument zones (see limitation note above)
    function zonesOf(presetIx) {
      const P = phdr[presetIx];
      const bagEnd = (phdr[presetIx + 1] || { bagNdx: pbag.length - 1 }).bagNdx;
      const instIxs = [];
      for (let b = P.bagNdx; b < bagEnd; b++) {
        const g0 = pbag[b].genNdx, g1 = (pbag[b + 1] || { genNdx: pgen.length }).genNdx;
        for (let g = g0; g < g1; g++) if (pgen[g].oper === 41) instIxs.push(pgen[g].amount);
      }
      const zones = [];
      for (const ii of instIxs) {
        const I = inst[ii]; if (!I) continue;
        const iEnd = (inst[ii + 1] || { bagNdx: ibag.length - 1 }).bagNdx;
        let globals = {};
        for (let b = I.bagNdx; b < iEnd; b++) {
          const g0 = ibag[b].genNdx, g1 = (ibag[b + 1] || { genNdx: igen.length }).genNdx;
          const gens = Object.assign({}, globals);
          let hasSample = false;
          for (let g = g0; g < g1; g++) { gens[igen[g].oper] = igen[g].amount; if (igen[g].oper === 53) hasSample = true; }
          if (!hasSample) { if (b === I.bagNdx) globals = gens; continue; }   // global zone = defaults
          const s = shdr[gens[53]]; if (!s || s.type === 2) continue;         // skip right-channel halves
          const kr = gens[43] != null ? gens[43] : 0x7f00;
          const vr = gens[44] != null ? gens[44] : 0x7f00;
          const vLo = vr & 0xff, vHi = (vr >> 8) & 0xff;
          // FULL CAPTURE — extract everything:
          // keep EVERY velocity layer, not just the forte one, so the sampler picks
          // the layer by note velocity, so a soft note plays a softly-recorded
          // sample instead of a loud one turned down.
          const modes = gens[54] != null ? gens[54] : 0;
          zones.push({
            keyLo: kr & 0xff, keyHi: (kr >> 8) & 0xff,
            velLo: vLo, velHi: vHi,
            root: gens[58] != null ? gens[58] : s.origPitch,
            coarse: (gens[51] != null ? (gens[51] << 16 >> 16) : 0),
            fine: (gens[52] != null ? (gens[52] << 16 >> 16) : 0) + s.pitchCorr,
            loop: modes === 1 || modes === 3,
            sample: s,
          });
        }
      }
      return zones;
    }
    function pcmOf(s) { // shdr -> Float32Array (16-bit words from smpl)
      const n = s.end - s.start;
      const out = new Float32Array(Math.max(0, n));
      const base = chunks.smpl.off + s.start * 2;
      for (let i = 0; i < n; i++) out[i] = dv.getInt16(base + i * 2, true) / 32768;
      return out;
    }
    return { presets: phdr.slice(0, -1), zonesOf, pcmOf };
  }

  return { parse };
});

// ---------------------------------------------------------------- CLI (node)
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("fs");
  const path = require("path");
  const SF2 = module.exports;
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd === "list") {
    const sf = SF2.parse(fs.readFileSync(args[1]));
    for (const p of sf.presets) console.log(`bank ${String(p.bank).padStart(3)} prog ${String(p.preset).padStart(3)}  ${p.name}`);
  } else if (cmd === "extract") {
    const [, font, pick, outBase] = args;
    const maxZones = args.includes("--max-zones") ? +args[args.indexOf("--max-zones") + 1] : 0;   // 0 = FULL CAPTURE (every zone, every velocity layer)
    const OUT_SR = 44100;
    const sf = SF2.parse(fs.readFileSync(font));
    const want = pick.replace(/^\/|\/$/g, "").toUpperCase();
    // prefer bank 0 (GM); exact name beats substring ("Trumpet" != "Muted Trumpet")
    let ix = sf.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase() === want);
    if (ix < 0) ix = sf.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase().includes(want));
    if (ix < 0) { console.error("preset not found: " + pick); process.exit(1); }
    const P = sf.presets[ix];
    let zones = sf.zonesOf(ix);
    if (!zones.length) { console.error("no zones in preset " + P.name); process.exit(1); }
    zones.sort((a, b) => a.velLo - b.velLo || a.root - b.root || a.keyLo - b.keyLo);
    // dedupe EXACT twins (stereo R halves are already dropped in zonesOf; this
    // guards identical key+root+vel rows). FULL CAPTURE (--max-zones 0 / omitted):
    // keep every key-zone AND every velocity layer. If --max-zones N is given it
    // thins the KEY zones per velocity layer (so all layers survive the thin).
    const seen = new Set();
    zones = zones.filter((z) => { const k = z.keyLo + ":" + z.keyHi + ":" + z.root + ":" + z.velLo + ":" + z.velHi; if (seen.has(k)) return false; seen.add(k); return true; });
    if (maxZones && zones.length > maxZones) {
      const byVel = {};
      for (const z of zones) (byVel[z.velLo + ":" + z.velHi] = byVel[z.velLo + ":" + z.velHi] || []).push(z);
      const per = Math.max(2, Math.round(maxZones / Object.keys(byVel).length));
      const kept = [];
      for (const layer of Object.values(byVel)) {
        if (layer.length <= per) { kept.push(...layer); continue; }
        for (let i = 0; i < per; i++) kept.push(layer[Math.round(i * (layer.length - 1) / (per - 1))]);
      }
      zones = [...new Set(kept)].sort((a, b) => a.velLo - b.velLo || a.root - b.root || a.keyLo - b.keyLo);
    }
    const slug = P.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const dir = path.join(outBase, slug);
    fs.mkdirSync(dir, { recursive: true });
    const meta = { name: P.name, sr: OUT_SR, zones: [] };
    zones.forEach((z, i) => {
      let pcm = sf.pcmOf(z.sample);
      let ls = z.sample.loopStart - z.sample.start, le = z.sample.loopEnd - z.sample.start;
      if (z.sample.rate !== OUT_SR) {   // linear resample to the engine rate; scale loop points
        const k = OUT_SR / z.sample.rate, n = Math.floor(pcm.length * k), r = new Float32Array(n);
        for (let j = 0; j < n; j++) { const x = j / k, x0 = Math.floor(x), f = x - x0; r[j] = pcm[x0] + f * ((pcm[x0 + 1] || 0) - pcm[x0]); }
        pcm = r; ls = Math.round(ls * k); le = Math.round(le * k);
      }
      // clamp the loop end INSIDE the written buffer (see gen-font.js — the
      // Montego "short envelopes" off-by-one: le=len+1 made the loop one-shot).
      le = Math.min(le, pcm.length); ls = Math.min(ls, Math.max(0, le - 1));
      const file = `z${String(i).padStart(2, "0")}_r${z.root}.wav`;
      const data = Buffer.alloc(pcm.length * 2);
      for (let j = 0; j < pcm.length; j++) data.writeInt16LE(Math.max(-1, Math.min(1, pcm[j])) * 32767 | 0, j * 2);
      const h = Buffer.alloc(44);
      h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
      h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
      h.writeUInt32LE(OUT_SR, 24); h.writeUInt32LE(OUT_SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
      h.write("data", 36); h.writeUInt32LE(data.length, 40);
      fs.writeFileSync(path.join(dir, file), Buffer.concat([h, data]));
      // fine/coarse tune folded into an effective (possibly fractional) root
      const rootEff = z.root - z.coarse - z.fine / 100;
      // vlo/vhi are the names the PLAYER reads (faust/sampler.js zoneFor picks
      // the layer covering a note's velocity); velLo/velHi are kept for the
      // extractor's own vocabulary and for existing readers. Emitting both is
      // what makes a FULL CAPTURE multi-velocity extraction actually playable —
      // a zones.json carrying only velLo/velHi looks single-layer to zoneFor, so
      // its forte samples were unreachable no matter what velocity was fed in
      // (ENGINE-AUDIT Tier 2, the velocity-layer finding). JSON-only
      // change: no audio path reads zones.json at render time.
      meta.zones.push({ file, root: Math.round(rootEff * 100) / 100, lo: z.keyLo, hi: z.keyHi,
        velLo: z.velLo, velHi: z.velHi, vlo: z.velLo, vhi: z.velHi,
        loop: z.loop && le > ls + 8, loopStart: ls, loopEnd: le, len: pcm.length });
      console.log(`  ${file}  root=${rootEff} keys=${z.keyLo}-${z.keyHi} loop=${z.loop ? ls + ".." + le : "-"} ${(pcm.length / OUT_SR).toFixed(2)}s`);
    });
    fs.writeFileSync(path.join(dir, "zones.json"), JSON.stringify(meta, null, 1));
    console.log(`✓ ${dir}: ${meta.zones.length} zones (${P.name})`);
  } else if (cmd === "drumkit") {
    // DRUM KIT extraction — GM percussion (bank 128). Unlike melodic `extract`
    // (keymap of pitched zones), a drum kit is a set of ONE-SHOTS, one recorded
    // sample per GM drum note. We pull the specific notes the engine plays
    // (kick/snare/hats/toms + crash/ride/rim/clap for completeness) at NATURAL
    // pitch (the recorded sample, resampled to the engine rate — no per-zone
    // repitch: the sample IS the drum) into <slug>/<hit>.wav + a kit.json
    // manifest {hit -> {file, note, len}}. genre-kernel.js DRUMKITS mirrors it
    // and the native sampler (faust/sampler.js) plays each hit as a fixed-pitch
    // (tom: pitched) unlooped one-shot — the SAMPLED-DRUM path, additive to the
    // Faust synth kits (kick boom/808/909 …).
    //   node faust/sf2.js drumkit <font.sf2> "/Standard/" <outDir> [--slug acoustic]
    const [, font, pick, outBase] = args;
    const OUT_SR = 44100;
    // GM drum map -> engine hit name. One recorded note each.
    const HITS = { kick: 36, snare: 38, rim: 37, clap: 39, hatClosed: 42, hatPedal: 44,
      hatOpen: 46, tomLo: 41, tomMid: 47, tomHi: 50, crash: 49, ride: 51 };
    const sf = SF2.parse(fs.readFileSync(font));
    const want = pick.replace(/^\/|\/$/g, "").toUpperCase();
    let ix = sf.presets.findIndex((p) => p.bank === 128 && p.name.toUpperCase() === want);
    if (ix < 0) ix = sf.presets.findIndex((p) => p.bank === 128 && p.name.toUpperCase().includes(want));
    if (ix < 0) { console.error("percussion preset (bank 128) not found: " + pick); process.exit(1); }
    const P = sf.presets[ix];
    const zones = sf.zonesOf(ix);
    // one zone per note: the zone whose keyrange covers it (skip stereo R via zonesOf)
    const zoneForNote = (note) => zones.find((z) => note >= z.keyLo && note <= z.keyHi);
    const slug = (args.includes("--slug") ? args[args.indexOf("--slug") + 1]
      : P.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    const dir = path.join(outBase, slug);
    fs.mkdirSync(dir, { recursive: true });
    const writeMonoWav = (file, pcm) => {
      const data = Buffer.alloc(pcm.length * 2);
      for (let j = 0; j < pcm.length; j++) data.writeInt16LE(Math.max(-1, Math.min(1, pcm[j])) * 32767 | 0, j * 2);
      const h = Buffer.alloc(44);
      h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
      h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
      h.writeUInt32LE(OUT_SR, 24); h.writeUInt32LE(OUT_SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
      h.write("data", 36); h.writeUInt32LE(data.length, 40);
      fs.writeFileSync(path.join(dir, file), Buffer.concat([h, data]));
    };
    const meta = { name: P.name, sr: OUT_SR, hits: {} };
    for (const [hit, note] of Object.entries(HITS)) {
      const z = zoneForNote(note);
      if (!z) { console.log(`  (skip ${hit} note ${note}: no zone)`); continue; }
      let pcm = sf.pcmOf(z.sample);
      if (z.sample.rate !== OUT_SR) {   // linear resample to the engine rate
        const k = OUT_SR / z.sample.rate, n = Math.floor(pcm.length * k), r = new Float32Array(n);
        for (let j = 0; j < n; j++) { const x = j / k, x0 = Math.floor(x), f = x - x0; r[j] = pcm[x0] + f * ((pcm[x0 + 1] || 0) - pcm[x0]); }
        pcm = r;
      }
      const file = hit + ".wav";
      writeMonoWav(file, pcm);
      meta.hits[hit] = { file, note, len: pcm.length };
      console.log(`  ${file.padEnd(14)} note ${note}  ${(pcm.length / OUT_SR).toFixed(3)}s  "${z.sample.name}"`);
    }
    fs.writeFileSync(path.join(dir, "kit.json"), JSON.stringify(meta, null, 1));
    console.log(`✓ ${dir}: ${Object.keys(meta.hits).length} hits (${P.name} -> ${slug})`);
  } else if (cmd === "percbank") {
    // WIDE GM PERCUSSION bank — a million percussion elements.
    // `drumkit` pulls the kit backbone (kick/snare/hats/toms + clap/crash/ride/
    // rim); this pulls the rest of the GM bank-128 percussion map (hand
    // percussion, latin, sparkle) as ONE shared bank of natural-pitch one-shots
    // into <slug>/<name>.wav + perc.json {name -> {file, note, len}}. genre-kernel
    // PERCBANK mirrors it and the native sampler (faust/sampler.js) plays each as
    // a fixed-pitch (root==note => rate 1) unlooped one-shot, selected per event
    // by the element's GM note. Additive to the kit — feeds the per-genre PERC LANE.
    //   node faust/sf2.js percbank <font.sf2> "/Standard/" <outDir> [--slug standard]
    const [, font, pick, outBase] = args;
    const OUT_SR = 44100;
    // GM percussion note -> engine perc element name. The wider set beyond the kit
    // (clap/sideStick overlap the kit map on purpose — a genre may want the perc-
    // bank's shared hand-clap without opting into a full recorded kit).
    const PERC = { sideStick: 37, clap: 39, tambourine: 54, cowbell: 56, vibraslap: 58,
      bongoHi: 60, bongoLo: 61, congaMuteHi: 62, congaOpenHi: 63, congaLo: 64,
      timbaleHi: 65, timbaleLo: 66, agogoHi: 67, agogoLo: 68, cabasa: 69, maracas: 70,
      guiroShort: 73, guiroLong: 74, claves: 75, woodblockHi: 76, woodblockLo: 77,
      triangleMute: 80, triangleOpen: 81, shaker: 82 };
    const sf = SF2.parse(fs.readFileSync(font));
    const want = pick.replace(/^\/|\/$/g, "").toUpperCase();
    let ix = sf.presets.findIndex((p) => p.bank === 128 && p.name.toUpperCase() === want);
    if (ix < 0) ix = sf.presets.findIndex((p) => p.bank === 128 && p.name.toUpperCase().includes(want));
    if (ix < 0) { console.error("percussion preset (bank 128) not found: " + pick); process.exit(1); }
    const P = sf.presets[ix];
    const zones = sf.zonesOf(ix);
    const zoneForNote = (note) => zones.find((z) => note >= z.keyLo && note <= z.keyHi);
    const slug = (args.includes("--slug") ? args[args.indexOf("--slug") + 1]
      : P.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    const dir = path.join(outBase, slug);
    fs.mkdirSync(dir, { recursive: true });
    const writeMonoWav = (file, pcm) => {
      const data = Buffer.alloc(pcm.length * 2);
      for (let j = 0; j < pcm.length; j++) data.writeInt16LE(Math.max(-1, Math.min(1, pcm[j])) * 32767 | 0, j * 2);
      const h = Buffer.alloc(44);
      h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
      h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
      h.writeUInt32LE(OUT_SR, 24); h.writeUInt32LE(OUT_SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
      h.write("data", 36); h.writeUInt32LE(data.length, 40);
      fs.writeFileSync(path.join(dir, file), Buffer.concat([h, data]));
    };
    const meta = { name: P.name, sr: OUT_SR, hits: {} };
    let ok = 0, skipped = [];
    for (const [name, note] of Object.entries(PERC)) {
      const z = zoneForNote(note);
      if (!z) { skipped.push(name + "(" + note + "):no-zone"); continue; }
      let pcm = sf.pcmOf(z.sample);
      if (z.sample.rate !== OUT_SR) {
        const k = OUT_SR / z.sample.rate, n = Math.floor(pcm.length * k), r = new Float32Array(n);
        for (let j = 0; j < n; j++) { const x = j / k, x0 = Math.floor(x), f = x - x0; r[j] = pcm[x0] + f * ((pcm[x0 + 1] || 0) - pcm[x0]); }
        pcm = r;
      }
      // skip a hit that came out silent or a single-sample stub (bad zone)
      let peak = 0; for (let j = 0; j < pcm.length; j++) { const a = Math.abs(pcm[j]); if (a > peak) peak = a; }
      if (pcm.length < 64 || peak < 0.002) { skipped.push(name + "(" + note + "):silent"); continue; }
      const file = name + ".wav";
      writeMonoWav(file, pcm);
      meta.hits[name] = { file, note, len: pcm.length };
      ok++;
      console.log(`  ${file.padEnd(16)} note ${note}  ${(pcm.length / OUT_SR).toFixed(3)}s  peak ${peak.toFixed(3)}  "${z.sample.name}"`);
    }
    fs.writeFileSync(path.join(dir, "perc.json"), JSON.stringify(meta, null, 1));
    console.log(`✓ ${dir}: ${ok} perc hits (${P.name} -> ${slug})` + (skipped.length ? `  [skipped: ${skipped.join(", ")}]` : ""));
  } else {
    console.log("usage: sf2.js list <font.sf2> | extract <font.sf2> /NAME/ <outDir> [--max-zones N]\n" +
      "     | drumkit <font.sf2> /KitName/ <outDir> [--slug NAME]   (GM kit backbone, bank 128)\n" +
      "     | percbank <font.sf2> /KitName/ <outDir> [--slug NAME]  (wide GM percussion, bank 128)");
  }
}

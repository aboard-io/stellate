#!/usr/bin/env node
/* test/_voxtap.cjs — WHERE THE SINGER SITS, MEASURED TWICE.
   (2026-08-30, Paul: "Air (as a band) is good but the main vocals are 2x too
   loud and the other vocal line should be about 20% quieter" -> "Same all
   over. Voices just too loud everywhere. Portishead good example.")

   Two taps per record, because the two questions have two honest answers:

     RING  (export/_satpress.js pressFloat, mute-complement) — what a chair
           CONTRIBUTES. Deliberately upstream of the master make-up rider, for
           the reason _chairtap.cjs's header states: a difference taken at the
           ear reads the rider handing the cut back, not the chair.
     EAR   (live.js engineHandle().analyser, the last node before the ear) —
           what the whole mix DOES: rms, crest, and the 300 Hz-3 kHz share,
           which is the band a voice lives in and the number Paul's "hot" is.

   The law under test is applied as a DOCUMENT TRANSFORM before the document is
   set, so a before/after pair is one process and one page — no source edit, no
   second engine, nothing that could differ between the two halves but the word
   on the chair.

     node test/_voxtap.cjs --records air,portishead --vlaw off
     node test/_voxtap.cjs --records air --vlaw "fwd,back,back"
     node test/_voxtap.cjs --records air --vlaw "back,hush,back" --noear
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.indexOf("--" + k) >= 0;
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "portishead,air,doowop,gospel,iranpop,dub").split(",");
const SEED = +arg("seed", 1);
const BARS = +arg("bars", 8);
const SECS = +arg("secs", 14);
const SETTLE = +arg("settle", 8);
// the law: three words — first vocal LEAD chair, every LATER vocal lead chair,
// every other vocal chair (counter/line/riff/stab/pad choirs). "-" = leave the
// chair exactly as precompose wrote it; "off" as the whole law = baseline.
const LAWS = arg("vlaw", "off").split(";");
const NOEAR = has("noear");
// ...and its mirror. THE EAR PHASE IS REAL-TIME AND MUST RUN ALONE: five of
// these at once starved every analyser to silence (win 0, rms -999) while the
// ring phase beside them was byte-stable, because the ring press is offline and
// the ear is not. So the ring scans wide in parallel and the ear walks the
// records one at a time — `--noring` is that second walk.
const NORING = has("noring");
// THE MODULE TRIM, IN FLIGHT — `--trim voice_lead=4.1,voice_choir=7.5`. The
// guitar round's law: prove the lever moves exactly the chairs it claims to,
// served, BEFORE any row is edited in the tree.
const TRIM = (arg("trim", "") || "").split(",").filter(Boolean);
// THE INSTRUMENT ROUTE, IN FLIGHT — `--idtrim solo_vox=0.4,ahh_choir=0.4`.
// to-engine.js ID_ROUTE is keyed by INSTRUMENT ID and the overdrive-guitar row
// proved the seam this morning; this serves extra rows into it so the lever can
// be measured on the rendered artifact before a byte is written in the tree.
// A route trim reaches a SAMPLED voice only if the renderer multiplies `u.dry`
// for samplers too — which is exactly what this flag exists to prove, since
// every vocal chair but two is an SF2 sampler and not a modelled module.
const IDTRIM = (arg("idtrim", "") || "").split(",").filter(Boolean);
const JSONOUT = has("json");
// THE WHOLE CATALOGUE'S SEATED UNITS, COMPILED, NOT PRESSED (`--census`).
// A press is 30 s and a compile is 200 ms, and the question "where does the box
// SEAT a singer" is answered by the compiled unit table: `units[k].lvl` is the
// composed level the desk hands the parent (LEVELS[lvl] x SEAT_DB x the chair
// ordinal x the section) and `units[k].dry` carries the module's page trim.
// Their product is what the renderer multiplies into every sample the chair
// puts out, so it is the honest structural number to rank chairs by — and it is
// UNIT-level, which the document count is not: two `lead:solo_vox` chairs on one
// record collapse onto ONE kernel voice (iranpop, portishead), so a law written
// against document chairs would reach a seat nobody plays.
const CENSUS = has("census");
// PER-VOCAL-CHAIR, one press each (`--each`): the aggregate cannot tell a
// vocoder lead from the sung line beside it, and Paul's Air sentence names two
// different numbers for two different chairs. Costs one press per vocal unit.
const EACH = has("each");
// `--quick` drops the lead/back split presses (the `--each` pass supersedes
// them) so a wide scan costs three presses a record instead of five.
const QUICK = has("quick");

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  // SERVICE WORKERS BLOCKED — the page ships one and a SW-served response
  // bypasses page.route (the fifth harness lie documented in _livetap.cjs).
  const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx0.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  if (TRIM.length) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    let a = b;
    for (const t of TRIM) {
      const [dsp, v] = t.split("=");
      a = a.replace(new RegExp("(" + dsp + ": *)[0-9.]+"), "$1" + v);
    }
    console.log("   [trim " + TRIM.join(" ") + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  if (IDTRIM.length) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    const rows = IDTRIM.map((t) => { const [id, v] = t.split("="); return "  " + id + ": { trim: " + v + " },"; }).join("\n");
    const a = b.replace("const ID_ROUTE = {", "const ID_ROUTE = {\n" + rows);
    console.log("   [idtrim " + IDTRIM.join(" ") + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  // the shared half of both phases, installed once
  await page.evaluate(() => {
    window.__VOXID = { solo_vox: 1, ahh_choir: 1, ohh_voices: 1, synth_voice: 1, space_voice: 1 };
    window.__VOXMOD = { voice_lead: 1, voice_choir: 1, tract_voice: 1 };
    // THE LAW, AS A TRANSFORM. Returns the doc and the chair report.
    window.__applyLaw = (doc, law) => {
      const rep = [];
      let nLead = 0;
      for (const v of doc.voices || []) {
        if (!window.__VOXID[v.instrument]) continue;
        const part = (v.cast && v.cast.part) || "line";
        const was = (v.desk && v.desk.lvl) || null;
        let want = was, slot;
        if (part === "lead") { slot = (nLead++ === 0) ? 0 : 1; } else slot = 2;
        if (law && law !== "off") {
          const w = law.split(",")[slot];
          if (w && w !== "-") want = (w === "norm") ? null : w;
        }
        if (law && law !== "off") {
          if (want == null) { if (v.desk) delete v.desk.lvl; }
          else { v.desk = v.desk || {}; v.desk.lvl = want; }
        }
        rep.push({ part, instr: v.instrument, was: was || "norm", now: want || "norm", slot });
      }
      return rep;
    };
    // radix-2 FFT, in place, for the ring phase's band share
    window.__fft = (re, im) => {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
          let cr = 1, ci = 0;
          for (let k = 0; k < len / 2; k++) {
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
            const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
            re[i + k] = ur + vr; im[i + k] = ui + vi;
            re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
            const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
          }
        }
      }
    };
  });


  if (CENSUS) {
    const list = await page.evaluate(() => Object.keys(window.NuGenres.GENRES));
    const rows = [];
    for (const gk of list) {
      const r = await page.evaluate(async ([gk, seed]) => {
        const PL = await import("/nukernel/audio/plan.js");
        const ST = await import("/nukernel/ui/state.js");
        window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
        ST.clearMixOffsets();
        await PL.deps();
        for (let i = 0; i < 80; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 100)); }
        const p0 = PL.barPlan(0); const cast = PL.cast();
        const out = [];
        for (const [k, u] of Object.entries((p0 && p0.units) || {})) {
          if (!u || k.slice(0, 2) === "__") continue;
          const i = k[0] === "v" ? +k.slice(1) : NaN;
          const mid = (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "";
          const isVox = !!window.__VOXMOD[u.module] || !!window.__VOXID[mid];
          const g = (u.lvl == null ? 1 : u.lvl) * (u.dry == null ? 1 : u.dry);
          out.push({ k, chair: (cast[i] && cast[i].chair) || "?", mod: u.module || "-", id: mid,
                     vox: isVox, lvl: +(u.lvl == null ? 1 : u.lvl).toFixed(3),
                     dry: +(u.dry == null ? 1 : u.dry).toFixed(3),
                     db: +(20 * Math.log10(Math.max(1e-9, g))).toFixed(2) });
        }
        return { gk, out };
      }, [gk, SEED]).catch((e) => ({ gk, out: [], error: String(e && e.message || e) }));
      rows.push(r);
    }
    const vox = [], band = [];
    let multiFwd = 0, recs = 0;
    for (const r of rows) {
      const v = r.out.filter((x) => x.vox), b = r.out.filter((x) => !x.vox && x.chair !== "drums" && x.k !== "bass");
      if (v.length) recs++;
      if (v.filter((x) => x.lvl > 1.2).length > 1) multiFwd++;
      for (const x of v) vox.push({ gk: r.gk, ...x });
      for (const x of b) band.push({ gk: r.gk, ...x });
    }
    const pct = (a, q) => { const s2 = a.slice().sort((x, y) => x - y); return s2.length ? +s2[Math.min(s2.length - 1, Math.floor(q * s2.length))].toFixed(2) : null; };
    const dbs = (a) => a.map((x) => x.db);
    console.log("CENSUS  records " + rows.length + ", with a vocal unit " + recs +
      ", with 2+ FORWARD vocal units " + multiFwd);
    console.log("  vocal units  n=" + vox.length + "  db p10 " + pct(dbs(vox), 0.1) +
      "  med " + pct(dbs(vox), 0.5) + "  p90 " + pct(dbs(vox), 0.9));
    console.log("  band units   n=" + band.length + "  db p10 " + pct(dbs(band), 0.1) +
      "  med " + pct(dbs(band), 0.5) + "  p90 " + pct(dbs(band), 0.9));
    const byMod = {};
    for (const x of vox) (byMod[x.mod] = byMod[x.mod] || []).push(x.db);
    for (const [m, a] of Object.entries(byMod)) console.log("  " + m.padEnd(14) +
      "n=" + String(a.length).padStart(4) + "  med " + pct(a, 0.5) + "  p10 " + pct(a, 0.1) + "  p90 " + pct(a, 0.9));
    const byModB = {};
    for (const x of band) (byModB[x.mod] = byModB[x.mod] || []).push(x.db);
    console.log("  --- band modules, for the same scale ---");
    for (const [m, a] of Object.entries(byModB).sort((p1, p2) => p2[1].length - p1[1].length).slice(0, 8))
      console.log("  " + m.padEnd(14) + "n=" + String(a.length).padStart(4) + "  med " + pct(a, 0.5));
    for (const gk of RECORDS) {
      const r = rows.find((x) => x.gk === gk); if (!r) continue;
      console.log("  " + gk + ": " + r.out.map((x) => x.k + ":" + x.chair + ":" + (x.id || x.mod) + (x.vox ? "*" : "") + " " + x.db + "dB").join(" | "));
    }
    await browser.close();
    return;
  }

  const out = [];
  for (const gk of RECORDS) {
   for (const VLAW of LAWS) {
    const t0 = Date.now();
    // ---- PHASE 1 · THE RING: contribution by mute-complement ----
    const ring = NORING ? { gk, units: {}, chairs: [] } : await page.evaluate(async ([gk, seed, bars, law, each, quick]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      const doc = window.NuPrecompose.genreToDocument(gk, seed);
      const chairs = window.__applyLaw(doc, law);
      window.__satPut(doc);
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r) => setTimeout(r, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const cast = PL.cast();
      const p0 = PL.barPlan(0);
      // which UNITS are vocal, found from the compiled plan and never a name
      // list: the module the parent actually loaded, or the sampler id.
      const vox = [], others = [], lead = [], back = [], voxWhat = [], whatOf = {};
      for (const [k, u] of Object.entries(p0.units || {})) {
        if (!u || k.slice(0, 2) === "__") continue;
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        const mid = (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "";
        const isVox = !!window.__VOXMOD[u.module] || !!window.__VOXID[mid];
        if (isVox) {
          vox.push(k + "");
          whatOf[k] = (u.module || "-") + "/" + mid;
          voxWhat.push(k + ":" + (u.module || "-") + "/" + mid + " dry=" + (u.dry == null ? 1 : +u.dry.toFixed(3)));
          // A SOLO VOICE OR A ROOM OF PEOPLE — split by the MODULE the parent
          // loaded, not by the document's `cast.part`: the seating collapses
          // duplicate chairs (portishead's two `lead:solo_vox` chairs arrive
          // as ONE voice_lead unit), so a part-keyed split would name a chair
          // nobody plays. voice_lead/tract_voice sing the line; voice_choir is
          // the backing room.
          ((u.module === "voice_choir") ? back : lead).push(k);
        } else others.push(k);
      }
      const measure = async () => {
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
        let s = 0;
        const B = 2205, blocks = [];
        for (let b0 = 0; b0 + B <= frames; b0 += B) {
          let bs = 0;
          for (let i = b0; i < b0 + B; i++) { const m = (L[i] + R[i]) * 0.5; bs += m * m; }
          s += bs; blocks.push(Math.sqrt(bs / B));
        }
        const act = blocks.filter((x) => x > 3.16e-3);
        const actRms = act.length ? Math.sqrt(act.reduce((a, x) => a + x * x, 0) / act.length) : 0;
        // ...and the 300 Hz-3 kHz share of the same pressed audio, Hann-
        // windowed 4096 frames hopped by half, linear power, as a fraction of
        // 20 Hz-16 kHz. The band a voice lives in.
        const N = 4096, SR = 44100;
        const re = new Float64Array(N), im = new Float64Array(N);
        let voxP = 0, allP = 0;
        for (let b0 = 0; b0 + N <= frames; b0 += N / 2) {
          for (let i = 0; i < N; i++) {
            const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
            re[i] = (L[b0 + i] + R[b0 + i]) * 0.5 * w; im[i] = 0;
          }
          window.__fft(re, im);
          for (let i = 1; i < N / 2; i++) {
            const hz = i * SR / N;
            if (hz < 20 || hz > 16000) continue;
            const p = re[i] * re[i] + im[i] * im[i];
            allP += p; if (hz >= 300 && hz <= 3000) voxP += p;
          }
        }
        let pk = 0;
        for (let i = 0; i < frames; i++) { const m = Math.abs((L[i] + R[i]) * 0.5); if (m > pk) pk = m; }
        // A BYTE SIGNATURE OF THE PRESSED AUDIO — the control an instrumental
        // record has to pass. rms to a hundredth of a dB is not identity; this
        // is FNV-1a over the raw float bits of both channels, so one sample
        // moved by one bit changes it.
        let h = 2166136261 >>> 0;
        const dv = new DataView(new ArrayBuffer(4));
        for (let i = 0; i < frames; i++) {
          for (const ch of [L, R]) {
            dv.setFloat32(0, ch[i]);
            for (let b = 0; b < 4; b++) { h ^= dv.getUint8(b); h = Math.imul(h, 16777619) >>> 0; }
          }
        }
        const rms = Math.sqrt(s / Math.max(1, frames));
        return { sig: h.toString(16), frames,
                 db: 20 * Math.log10(rms || 1e-12),
                 peak: 20 * Math.log10(pk || 1e-12),
                 crest: 20 * Math.log10((pk || 1e-12) / (rms || 1e-12)),
                 act: 20 * Math.log10(actRms || 1e-12),
                 share: allP > 0 ? voxP / allP : 0 };
      };
      const mute = (keys, on) => { for (const k of keys) ST.setMixOffset("unit:" + k, "mute", on ? true : null); };
      const full = await measure();
      let noVox = null, soloVox = null, noLead = null, noBack = null;
      const perChair = [], keysAll = vox.concat(others);
      if (vox.length) {
        mute(vox, 1); PL.compile(); noVox = await measure(); mute(vox, 0);
        mute(others, 1); PL.compile(); soloVox = await measure(); mute(others, 0);
        if (lead.length && !quick) {
          mute(lead, 1); PL.compile(); noLead = await measure(); mute(lead, 0);
        }
        if (back.length && !quick) {
          mute(back, 1); PL.compile(); noBack = await measure(); mute(back, 0);
        }
        if (each) for (const k of vox) {
          mute([k], 1); PL.compile(); const wo = await measure(); mute([k], 0);
          mute(keysAll.filter((x) => x !== k), 1); PL.compile();
          const so = await measure(); mute(keysAll.filter((x) => x !== k), 0);
          perChair.push({ unit: k, what: whatOf[k],
            contrib: +(full.db - wo.db).toFixed(2), soloAct: +so.act.toFixed(2),
            vsRest: +(so.act - wo.db).toFixed(2), duty: so.duty });
        }
        PL.compile();
      }
      const r2 = (x) => (x == null ? null : +x.toFixed(2));
      return { gk, chairs, voxWhat, perChair,
               soloDb: soloVox ? r2(soloVox.db) : null,
               bandDb: noVox ? r2(noVox.db) : null,
               soloVsBandRms: (soloVox && noVox) ? r2(soloVox.db - noVox.db) : null,
               units: { vox: vox.length, lead: lead.length, back: back.length, band: others.length },
               sig: full.sig, frames: full.frames,
               rms: r2(full.db), peak: r2(full.peak), crest: r2(full.crest),
               share: +(full.share * 100).toFixed(1),
               noVoxShare: noVox ? +(noVox.share * 100).toFixed(1) : null,
               voxContrib: noVox ? r2(full.db - noVox.db) : null,
               voxSolo: soloVox ? r2(soloVox.act) : null,
               voxVsBand: (soloVox && noVox) ? r2(soloVox.act - noVox.db) : null,
               leadContrib: noLead ? r2(full.db - noLead.db) : null,
               backContrib: noBack ? r2(full.db - noBack.db) : null };
    }, [gk, SEED, BARS, VLAW, EACH, QUICK]).catch((e) => ({ gk, error: String((e && e.message) || e) }));

    // ---- PHASE 2 · THE EAR: the whole mix at the last node ----
    let ear = null;
    if (!NOEAR) ear = await page.evaluate(async ([gk, seed, secs, settle, law]) => {
      const LV = await import("/nukernel/audio/live.js");
      try { LV.stop(); } catch (e) {}
      const PL = await import("/nukernel/audio/plan.js");
      const doc = window.NuPrecompose.genreToDocument(gk, seed);
      window.__applyLaw(doc, law);
      window.__satPut(doc);
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r) => setTimeout(r, 250)); }
      await LV.startAt(0);
      const t0 = Date.now();
      while (!LV.playing && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 200));
      const h = LV.engineHandle();
      if (!h || !h.analyser) return { error: "no analyser (playing=" + LV.playing + ")" };
      const an = h.analyser, buf = new Float32Array(an.fftSize);
      const fbuf = new Float32Array(an.frequencyBinCount);
      const hzPerBin = h.ctx.sampleRate / an.fftSize;
      await new Promise((r) => setTimeout(r, settle * 1000));
      let peak = 0, sum = 0, n = 0, voxP = 0, allP = 0, fN = 0;
      const end = Date.now() + secs * 1000;
      while (Date.now() < end) {
        an.getFloatTimeDomainData(buf);
        an.getFloatFrequencyData(fbuf);
        let s = 0, p = 0;
        for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; s += buf[i] * buf[i]; }
        if (p > peak) peak = p;
        sum += s; n += buf.length;
        if (p >= 1e-6) {
          let vp = 0, ap = 0;
          for (let i = 1; i < fbuf.length; i++) {
            const hz = i * hzPerBin;
            if (hz < 20 || hz > 16000) continue;
            const pw = Math.pow(10, fbuf[i] / 10);
            ap += pw; if (hz >= 300 && hz <= 3000) vp += pw;
          }
          voxP += vp; allP += ap; fN++;
        }
        await new Promise((r) => setTimeout(r, 40));
      }
      try { LV.stop(); } catch (e) {}
      const rms = Math.sqrt(sum / Math.max(1, n));
      const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(2) : -999);
      return { rmsDb: db(rms), peakDb: db(peak), crest: +(db(peak) - db(rms)).toFixed(2),
               share: allP > 0 ? +(100 * voxP / allP).toFixed(1) : null, windows: fN };
    }, [gk, SEED, SECS, SETTLE, VLAW]).catch((e) => ({ error: String((e && e.message) || e) }));

    const row = { law: VLAW, trim: TRIM.join(",") || null, ...ring, ear };
    out.push(row);
    if (JSONOUT) console.log(JSON.stringify(row));
    else {
      if (ring.error) console.log((gk + " [" + VLAW + "]").padEnd(14), "RING ERROR", ring.error);
      else if (NORING) console.log((gk + " [" + VLAW + "]").padEnd(26), "(ring skipped)");
      else console.log((gk + " [" + VLAW + "]").padEnd(26),
        ["vox " + ring.units.vox + "(lead " + ring.units.lead + "/back " + ring.units.back + ")",
         "ringRms " + ring.rms, "crest " + ring.crest,
         "voxContrib " + ring.voxContrib, "lead " + ring.leadContrib, "back " + ring.backContrib,
         "voxVsBand(act) " + ring.voxVsBand, "vsBand(rms) " + ring.soloVsBandRms,
         "share " + ring.share + "% (band-only " + ring.noVoxShare + "%)",
         "sig " + ring.sig].join("  "));
      if (ear && !ear.error) console.log("".padEnd(14),
        ["EAR rms " + ear.rmsDb, "peak " + ear.peakDb, "crest " + ear.crest,
         "share " + ear.share + "%", "win " + ear.windows].join("  "));
      else if (ear) console.log("".padEnd(14), "EAR ERROR", ear.error);
      if (!ring.error && ring.perChair && ring.perChair.length)
        for (const c of ring.perChair) console.log("".padEnd(16),
          ("  " + c.unit + " " + c.what).padEnd(38) + "contrib " + String(c.contrib).padStart(6) +
          "   soloAct " + String(c.soloAct).padStart(7) + "   vsRest " + String(c.vsRest).padStart(7) +
          "   duty " + c.duty);
      if (!ring.error && ring.voxWhat) console.log("".padEnd(14), "voxUnits: " + ring.voxWhat.join(" | "));
      if (!ring.error && !NORING) console.log("".padEnd(14), "chairs: " +
        ring.chairs.map((c) => c.part + ":" + c.instr + " " + c.was + (c.was === c.now ? "" : "->" + c.now)).join(" | "));
    }
    console.log("".padEnd(14), "(" + Math.round((Date.now() - t0) / 1000) + "s)");
    await new Promise((r) => setTimeout(r, 300));
   }
  }
  await browser.close();
  if (errs.length) console.log("page errors:\n  " + errs.slice(0, 5).join("\n  "));
})().catch((e) => { console.error(e); process.exit(1); });

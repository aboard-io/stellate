#!/usr/bin/env node
/* tools/levels.js — HOW LOUD IS EVERY GENRE, MEASURED.
 *
 *   node tools/levels.js                          # the whole catalogue
 *   node tools/levels.js --records salsa,reggae   # a few
 *   node tools/levels.js --bars 8 --seed 1        # the press
 *   node tools/levels.js --json out.json          # for the fixer to read
 *   node tools/levels.js --write                  # …and into the trim table
 *
 * WHY IT EXISTS. Paul, 2026-09-08: *"Can you watch levels on genres? Everything
 * you added recently is super loud. Do a pass through all of the genres. Like
 * salsa is unlistenably loud. Should be totally possible to automate this."*
 * It is: the page already presses its own record to float PCM offline
 * (nukernel/export/_satpress.js `pressFloat`, the measurement press written so
 * that a peak over 1.0 can be SEEN rather than clamped away by an encoder), and
 * `NuPrecompose.genreToDocument(gk, seed)` is the one door that turns a
 * catalogue key into a record without touching the atlas. So: put a record on
 * the page, press eight bars, measure, next.
 *
 * WHAT IS MEASURED, and why these four:
 *   peak     the largest |sample| in the press. Over 1.0 is a record that
 *            CANNOT be exported without clipping and is already distorting in
 *            the ring's own output.
 *   rms      the whole press, in dBFS. This is the loudness a hand actually
 *            complains about — a record can peak politely and still be a wall.
 *   crest    peak over rms, in dB. A low crest on a loud record is the
 *            squashed-flat sound; a high crest with a high peak is one hit.
 *   clip     the share of samples at or over full scale. Nonzero is audible.
 *
 * IT MUTES THE BROWSER AND PLAYS NOTHING. The press is a Worker rendering to
 * memory; `--mute-audio` is belt and braces so a box running this does not
 * suddenly play 502 records.
 *
 * THE SERVER MUST BE CROSS-ORIGIN ISOLATED (serve.sh) or the streaming engine
 * refuses to open and every row comes back as an error — the press is the
 * parent's own stream worker and it needs SharedArrayBuffer.
 */
"use strict";
module.paths.push("/home/ford/ftrain-2025/node_modules");
const fs = require("fs");
const path = require("path");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://127.0.0.1:8791/nukernel/index.html");
const EXE = arg("chrome", process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const BARS = +arg("bars", 4);
const SEED = +arg("seed", 1);
const ONLY = arg("records", null);
const JSONOUT = arg("json", null);
const LIMIT = +arg("limit", 0);
const WRITE = process.argv.includes("--write");
/* `--from levels.json` writes the table out of a pass that ALREADY RAN. The
   measurement is an hour of pressing; re-spending it because the writer was
   added afterwards would be silly, and the JSON is the same object the run
   printed. */
const FROM = arg("from", null);

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fx = (x, n) => (Number.isFinite(x) ? x.toFixed(n) : "-inf");

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 },
                                         serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  /* THE ONE DOOR ONTO THE DOCUMENT, opened the way every press harness in
     test/ opens it: eight.js keeps `CTX` private, so the file is served with
     one line appended rather than edited. */
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res,
      body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.__satPut === "function",
                             null, { timeout: 60000 });

  const keys = ONLY ? ONLY.split(",")
    : await page.evaluate(() => Object.keys(window.NuGenres.GENRES));
  const list = LIMIT ? keys.slice(0, LIMIT) : keys;
  console.log("levels · " + list.length + " records · " + BARS + " bars · seed " + SEED);
  console.log("  record              peak    rms dB   loud 1s   crest dB   clip %   bars");

  const rows = [];
  for (const gk of list) {
    let r;
    try {
      r = await page.evaluate(async ([gk, seed, bars]) => {
        const PL = await import("/nukernel/audio/plan.js");
        const ST = await import("/nukernel/ui/state.js");
        /* ===== MEASURE THE SECTION THAT IS PLAYING, NOT THE INTRO =========
           A record is eleven sections and bar 0 is an intro — two bars of a
           hi-hat and a pad. Pressed from the top, four bars of Havana 1950
           read QUIETER than plainchant, which is the opposite of what an ear
           says about it; pressed far enough in to reach the band, the same
           record is 5 to 10 dB over everything around it. Pressing the whole
           song to be sure costs two minutes a record and 16 hours for the
           catalogue, which is not a pass anybody will run twice.
           SO THE RECORD IS TRIMMED TO ITS BUSIEST SECTION and four bars of
           THAT are pressed: `voices` per section is what the document already
           says about how much is playing, so the loudest moment is found by
           reading rather than by rendering. Ties go to the later section (a
           second chorus is fuller than the first). */
        const doc = window.NuPrecompose.genreToDocument(gk, seed);
        const secs = (doc.form && doc.form.sections) || [];
        if (secs.length > 1) {
          const busy = (s) => {
            let n = 0;
            for (const v of (doc.voices || []))
              if (v.cells && v.cells[s.id] !== undefined) n++;
            return n;
          };
          let best = 0, bn = -1;
          for (let i = 0; i < secs.length; i++) {
            const n = busy(secs[i]);
            if (n >= bn) { bn = n; best = i; }
          }
          doc.form = { ...doc.form, sections: [secs[best]] };
        }
        window.__satPut(doc);
        ST.clearMixOffsets();
        await PL.deps();
        for (let i = 0; i < 60; i++) {
          PL.compile();
          if (PL.barCount() > 0) break;
          await new Promise((res) => setTimeout(res, 200));
        }
        const SP = await import("/nukernel/export/_satpress.js");
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
        /* THE INTEGRATED LEVEL AND THE LOUDEST SECOND, because they answer
           different complaints. A record whose intro is two bars of hi-hat
           and whose chorus is a wall averages politely; what a hand calls
           unlistenable is the LOUDEST MOMENT, which is a short-term window —
           one second, the same width a broadcast meter's short-term reading
           uses. Both are reported and the fixer reads the second one. */
        let peak = 0, sum = 0, clip = 0;
        const win = 44100, wins = [];
        let wsum = 0, wn = 0;
        for (let i = 0; i < frames; i++) {
          const a = Math.abs(L[i]), b = Math.abs(R[i]);
          if (a > peak) peak = a;
          if (b > peak) peak = b;
          if (a >= 1) clip++;
          if (b >= 1) clip++;
          const e = L[i] * L[i] + R[i] * R[i];
          sum += e; wsum += e; wn += 2;
          if (wn >= win * 2) { wins.push(Math.sqrt(wsum / wn)); wsum = 0; wn = 0; }
        }
        if (wn > win / 2) wins.push(Math.sqrt(wsum / wn));
        return { peak, rms: Math.sqrt(sum / (2 * frames)),
                 loud: wins.length ? Math.max(...wins) : 0,
                 clip: clip / (2 * frames), frames,
                 bars: PL.barCount() };
      }, [gk, SEED, BARS]);
    } catch (e) {
      rows.push({ gk, err: String(e.message).split("\n")[0].slice(0, 90) });
      console.log("  " + gk.padEnd(20) + "ERROR " + rows[rows.length - 1].err);
      continue;
    }
    const row = { gk, peak: r.peak, rmsDb: db(r.rms), loudDb: db(r.loud),
                  peakDb: db(r.peak),
                  crest: db(r.peak) - db(r.rms), clipPct: r.clip * 100,
                  bars: r.bars };
    rows.push(row);
    console.log("  " + gk.padEnd(20) + fx(row.peak, 3).padStart(6) +
      fx(row.rmsDb, 1).padStart(9) + fx(row.loudDb, 1).padStart(10) +
      fx(row.crest, 1).padStart(11) +
      fx(row.clipPct, 3).padStart(9) + String(row.bars).padStart(7));
  }

  const ok = rows.filter((r) => !r.err);
  ok.sort((a, b) => b.loudDb - a.loudDb);
  const med = ok.length ? ok[Math.floor(ok.length / 2)].loudDb : 0;
  console.log("\nLOUDEST TWENTY (by the loudest second, which is what a hand hears):");
  for (const r of ok.slice(0, 20))
    console.log("  " + r.gk.padEnd(20) + fx(r.loudDb, 1).padStart(7) + " dB short-term · " +
      fx(r.rmsDb, 1) + " integrated · peak " + fx(r.peak, 3) +
      (r.clipPct > 0 ? " · CLIPPING " + fx(r.clipPct, 3) + "%" : ""));
  console.log("\nQUIETEST TEN:");
  for (const r of ok.slice(-10))
    console.log("  " + r.gk.padEnd(20) + fx(r.loudDb, 1).padStart(7) + " dB short-term · peak " + fx(r.peak, 3));
  const over = ok.filter((r) => r.peak > 1);
  console.log("\n" + ok.length + " measured · median " + fx(med, 1) + " dB short-term · " +
    over.length + " peak over full scale · " +
    ok.filter((r) => r.clipPct > 0).length + " with clipped samples");
  if (errs.length) console.log("page errors: " + errs.slice(0, 3).join(" | "));
  if (JSONOUT) { fs.writeFileSync(path.resolve(JSONOUT), JSON.stringify(rows, null, 1));
                 console.log("wrote " + JSONOUT); }
  /* ---- --write: the table nukernel/audio/loudness.js reads ------------
     THE MEASUREMENT IS THE SOURCE. loudness.js holds the LAW (a target, how
     much of the distance to take back, the rails) and this writes the FACTS
     between its two markers — the same shape wiki.js has: generated, headed
     DO NOT EDIT, re-derivable by one command. A partial run may not write:
     a table missing four hundred rows would silently leave them untrimmed
     and look like a finished pass. */
  if (WRITE) {
    if (FROM) {
      const prior = JSON.parse(fs.readFileSync(path.resolve(FROM), "utf8"));
      ok.length = 0;
      for (const r of prior) if (!r.err && Number.isFinite(r.loudDb)) ok.push(r);
      console.log("\n--write reading " + FROM + " — " + ok.length + " measured rows");
    }
    const whole = FROM || (!ONLY && !LIMIT);
    if (!whole) { console.log("\n--write refused: it takes a WHOLE pass " +
      "(no --records, no --limit) or the table would be a partial one."); }
    else {
      const f = path.join(__dirname, "..", "nukernel", "audio", "loudness.js");
      const src = fs.readFileSync(f, "utf8");
      const A = "/* ===== TRIM TABLE — GENERATED, DO NOT EDIT ===== */";
      const B = "/* ===== END TRIM TABLE ===== */";
      const i = src.indexOf(A), j = src.indexOf(B);
      if (i < 0 || j < 0) { console.log("--write: markers not found in " + f); }
      else {
        /* A SILENT ROW IS NOT A QUIET ONE. `silence` — the blank state — presses
           to nothing and measures -415 dB; taken as a measurement it would ask
           for the biggest lift the rails allow, which is a gain applied to
           nothing at best and to a hiss at worst. Anything under -80 dB is not
           a record whose level needs adjusting, so it is left out of the table
           entirely and `trimOf` answers 1 for it. */
        const body = ok.filter((r) => Number.isFinite(r.loudDb) && r.loudDb > -80)
          .sort((a, b) => (a.gk < b.gk ? -1 : 1))
          .map((r) => "  " + (/^[A-Za-z_$][\w$]*$/.test(r.gk) ? r.gk : JSON.stringify(r.gk)) +
                      ": [" + r.loudDb.toFixed(1) + ", " + r.peak.toFixed(3) + "],")
          .join("\n");
        const stamp = new Date().toISOString().slice(0, 10);
        const out = src.slice(0, i) + A + "\n" +
          "// " + ok.length + " rows — [the loudest second of the record's busiest\n" +
          "// section in dBFS, the peak of that press] — measured " + stamp + " with `node tools/levels.js\n" +
          "// --bars " + BARS + " --seed " + SEED + " --write`. Re-derive after any change to the\n" +
          "// engine, the desk or the catalogue: these are facts about a render.\n" +
          "export const MEASURED = {\n" + body + "\n};\n" + src.slice(j);
        fs.writeFileSync(f, out);
        console.log("\nwrote the trim table into nukernel/audio/loudness.js — " +
          ok.length + " rows");
      }
    }
  }
  await browser.close();
})();

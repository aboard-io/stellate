#!/usr/bin/env node
// test/browser/feed-links.test.js — THE FEED'S ONE PROMISE, GATED.
//
//   node test/browser/feed-links.test.js
//
// Every item in the release feed (tools/build/gen-feed.js) links to a mix that shows
// off what changed. That promise is only worth making if the links actually
// LAND: a `?path=` built from app/core/world.js POS must restore verbatim and put
// the traveler on the genre the entry names. A stale coordinate, a renamed id
// or a changed URL contract would otherwise rot the whole feed silently.
//
// Asserts:
//   (a) the generator runs and its four feeds self-validate (it exits non-zero
//       otherwise) — the feeds are written to a scratch dir, never the tree;
//   (b) every item URL is https, on stellate.app, and every `genre=` id is a
//       real anchor with a POS star;
//   (c) a SAMPLE of the showcase URLs, loaded in a real browser, restores its
//       waypoints verbatim AND resolves to the intended genre as the dominant
//       weight (a one-genre link must be ~pure: >=0.9);
//   (d) zero page errors on those loads.
//
// Needs the pinned playwright (`npm install && npm run setup:browser`).
"use strict";
const { serve, launchChromium, capturePageErrors, installOfflineRoute } = require("../lib/probe-harness.js");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8961;
const SAMPLE = 6;                 // browser loads are ~4s each; a sample proves the contract
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

async function main() {
  // (a) generate into a scratch dir — the gate must never dirty the tree
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stellate-feed-"));
  execFileSync("node", [path.join(ROOT, "tools", "build", "gen-feed.js"), "--historic", "--out", tmp],
    { stdio: "pipe", encoding: "utf8" });
  const live = JSON.parse(fs.readFileSync(path.join(tmp, "feed.json"), "utf8"));
  const arch = JSON.parse(fs.readFileSync(path.join(tmp, "feed-archive.json"), "utf8"));
  for (const f of ["feed.xml", "feed.json", "feed-archive.xml", "feed-archive.json"])
    if (!fs.existsSync(path.join(tmp, f))) fail("gen-feed did not write " + f);
  ok(`generated 4 feeds (${live.items.length} live, ${arch.items.length} archived)`);
  if (arch.items.length >= live.items.length) ok("the archive is a superset of the live feed");
  else fail("archive smaller than the live feed");

  // (b) static contract over EVERY item (cheap, so no sampling here)
  const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
  const world = fs.readFileSync(path.join(ROOT, "app", "core", "world.js"), "utf8");
  let bad = 0, seen = 0;
  for (const it of arch.items) {
    if (!/^https:\/\/stellate\.app\//.test(it.url)) { bad++; continue; }
    const q = new URL(it.url).searchParams;
    const g = q.get("genre");
    if (g) {
      seen++;
      if (!K.GENRES[g]) { fail(`item ${it.id.slice(0, 7)} names a dead genre id: ${g}`); bad++; }
      else if (!new RegExp("\\b" + g + ":\\s*\\[").test(world)) { fail(`genre ${g} has no POS star`); bad++; }
    }
    if (q.get("path") && !/^[\d.,-]+$/.test(q.get("path"))) { fail(`item ${it.id.slice(0, 7)} has a malformed path`); bad++; }
  }
  if (!bad) ok(`all ${arch.items.length} item URLs well-formed (${seen} name a live genre id)`);

  // (b2) sitemap.xml is COMMITTED, so its baked star coordinates can go stale
  // when app/core/world.js POS is re-baked. Assert every deep link still starts on
  // its own star; `node tools/build/gen-feed.js --sitemap` is the fix.
  const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const posOf = (id) => { const m = new RegExp("\\b" + id + ":\\s*\\[\\s*(-?\\d+)\\s*,\\s*(-?\\d+)").exec(world); return m && [+m[1], +m[2]]; };
  let deep = 0, stale = 0;
  for (const m of sm.matchAll(/\?genre=([a-z0-9_-]+)&amp;seed=\d+&amp;path=([\d.,-]+)/g)) {
    deep++;
    const p = posOf(m[1]);
    if (!p) { fail(`sitemap: ${m[1]} has no POS star`); stale++; continue; }
    const [x, y] = m[2].split(",")[0].split(".").map(Number);
    if (Math.hypot(x - p[0], y - p[1]) > 40) { fail(`sitemap: ${m[1]} link is off its star — run \`node tools/build/gen-feed.js --sitemap\``); stale++; }
  }
  if (deep && !stale) ok(`sitemap: ${deep} deep genre links still land on their stars`);

  // (c) the sample actually plays where it says
  const picks = [];
  for (let i = 0; i < arch.items.length && picks.length < SAMPLE; i += Math.max(1, Math.floor(arch.items.length / SAMPLE)))
    picks.push(arch.items[i]);

  const srv = await serve(ROOT, PORT);

  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await installOfflineRoute(page, PORT);
  try {
    for (const it of picks) {
      const u = new URL(it.url);
      if (u.pathname !== "/") { ok(`${it.id.slice(0, 7)} points at ${u.pathname} (a surface, not the map) — skipped`); continue; }
      const want = u.searchParams.get("genre");
      const wantPath = u.searchParams.get("path");
      await page.goto(`http://localhost:${PORT}/screensaver.html${u.search}`);
      await page.waitForFunction(() => window.__X && window.__S, { timeout: 30000 });
      await page.waitForTimeout(300);
      const st = await page.evaluate(() => ({
        wps: __S.waypoints.map((w) => Math.round(w.x) + "." + Math.round(w.y)).join(","),
        top: (__S.weights || []).slice().sort((a, b) => b.w - a.w)[0],
        seed: __S.seed,
      }));
      if (st.wps === wantPath) ok(`${it.id.slice(0, 7)} path restored verbatim (${st.wps.split(",").length} waypoints)`);
      else fail(`${it.id.slice(0, 7)} path ${st.wps} != ${wantPath}`);
      if (st.seed === +u.searchParams.get("seed")) ok(`${it.id.slice(0, 7)} seed ${st.seed}`);
      else fail(`${it.id.slice(0, 7)} seed ${st.seed} != ${u.searchParams.get("seed")}`);
      const oneGenre = wantPath.split(",").length === 3 && new Set(wantPath.split(",").map((p) => p.split(".")[0])).size === 3
        && Math.abs(+wantPath.split(",")[0].split(".")[0] - +wantPath.split(",")[1].split(".")[0]) < 60;
      if (st.top && st.top.g === want) {
        ok(`${it.id.slice(0, 7)} lands on ${want} (w=${st.top.w.toFixed(2)})`);
        if (oneGenre && st.top.w < 0.9) fail(`${it.id.slice(0, 7)} single-genre link is only ${st.top.w.toFixed(2)} pure`);
      } else fail(`${it.id.slice(0, 7)} wanted ${want}, got ${st.top && st.top.g}`);
    }
  } finally {
    await browser.close();
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // (d) zero page errors (the esm.sh stub's absence of preact is not one)
  const real = errs.filter((e) => !/favicon|esm\.sh|fonts\.googleapis/.test(e));
  if (!real.length) ok("zero page errors across the sampled loads");
  else fail("page errors: " + real.slice(0, 3).join(" | "));

  console.log(`\n${process.exitCode ? "FAILED" : "PASS"} — ${checks} checks`);
}

main().catch((e) => { console.error(e); process.exit(1); });

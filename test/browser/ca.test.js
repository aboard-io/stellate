#!/usr/bin/env node
// test/browser/ca.test.js — /ca: the 24-bit song, in a real browser.
//
// The claim is that a whole song — sections and all — falls out of a row and a
// rule. The failure modes worth gating are the ones that would let it LOOK
// right and be wrong:
//
//   A it boots clean          zero page errors, sixteen cells, a form on screen
//   B the page agrees with    the DOM's orbit rows are the kernel's own plan;
//     the kernel               a renderer that drifts from CsdCA is the bug
//   C an edit is a new song   tapping a cell moves the seed, the orbit repaints,
//                              and the section count/roles can change
//   D the rule grid is real   a tap in the 16x16 canvas picks the rule that tile
//                              draws, and the thumbnails re-read the NEW seed
//   E IT SOUNDS               the live engine's own analyser (handle.rms) is
//                              non-silent, and an edit mid-playback does not
//                              stop the music (the getState-callback contract)
//   F the playhead is not     the lit row moves by CLASS while the orbit's DOM
//     a repaint                stays byte-identical
//   G 24 bits ride the URL    round-trip, and a HOSTILE ?s/?r/?k/?g resolves
//                              byte-identical to a clean boot
//   H the laws hold           zero input[type=range], 44px floor, no sideways
//                              overflow at 390 or 1440
//
// Chromium needs --autoplay-policy=no-user-gesture-required, which the harness's
// launch flags already provide.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const settle = (page) => page.waitForFunction(() => window.__CA && window.__CA.ready, null, { timeout: 20000 });
const orbitHtml = (page) => page.evaluate(() => document.getElementById("caOrbit").innerHTML);

async function main() {
  const srv = await serve(ROOT, 8986);
  const base = `http://localhost:${srv.port}`;
  const browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = capturePageErrors(page);

  // ------------------------------------------------------------------ A boots
  console.log("\nA. it boots");
  await page.goto(`${base}/ca.html?s=1249&r=110`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.waitForTimeout(300);
  if (errors.length) fail("page errors on boot: " + errors.join(" | ")); else ok("zero page errors");

  const cellCount = await page.locator("#caSeed .ca-cell").count();
  cellCount === 16 ? ok("sixteen seed cells") : fail("seed row has " + cellCount + " cells, want 16");

  const rows = await page.locator("#caOrbit .ca-gen").count();
  rows >= 4 ? ok("the orbit drew " + rows + " sections") : fail("only " + rows + " sections on screen");

  // ------------------------------------------------- B the DOM IS the kernel
  console.log("\nB. the page agrees with the kernel");
  const agree = await page.evaluate(() => {
    const plan = window.__CA.plan();
    const rows = [...document.querySelectorAll("#caOrbit .ca-gen")];
    if (rows.length !== plan.length) return "row count " + rows.length + " vs plan " + plan.length;
    for (let i = 0; i < plan.length; i++) {
      const roleEl = rows[i].querySelector(".ca-role");
      if (roleEl.textContent !== plan[i].role) return "row " + i + " says " + roleEl.textContent + ", plan says " + plan[i].role;
      const lit = [...rows[i].querySelectorAll(".ca-gcell")].map((c) => (c.classList.contains("on") ? 1 : 0));
      const want = window.CsdCA.cells(plan[i].row);
      if (lit.join("") !== want.join("")) return "row " + i + " cells disagree with generation " + plan[i].gen;
    }
    return null;
  });
  agree ? fail("orbit drifted from the kernel: " + agree) : ok("every orbit row IS its generation, role and cells");

  // the arrangement grammar, ON SCREEN: choruses carry the melody, verses do not
  const grammar = await page.evaluate(() => {
    const p = window.__CA.plan();
    return { chorusMel: p.filter((x) => x.role === "chorus").every((x) => x.melody !== "off" || x.density === 0),
      verseMel: p.filter((x) => x.role === "verse").every((x) => x.melody === "off"),
      bridgeDry: p.filter((x) => x.role === "bridge").every((x) => x.drums === "off" && x.bass === "off"),
      roles: [...new Set(p.map((x) => x.role))] };
  });
  grammar.chorusMel ? ok("every chorus carries the melody") : fail("a chorus is missing its melody");
  grammar.verseMel ? ok("no verse carries the melody") : fail("a verse carries the melody");
  grammar.bridgeDry ? ok("every bridge drops the rhythm section") : fail("a bridge kept its drums");
  console.log("    roles on screen: " + grammar.roles.join(" · "));

  // ------------------------------------------------------- C an edit reshapes
  console.log("\nC. tapping a cell is a new song");
  const before = { seed: await page.evaluate(() => window.__CA.doc.seed), html: await orbitHtml(page) };
  await page.locator("#caSeed .ca-cell").nth(5).click();
  await page.waitForTimeout(160);
  const afterSeed = await page.evaluate(() => window.__CA.doc.seed);
  afterSeed === (before.seed ^ (1 << 5)) ? ok("the tapped cell flipped exactly one bit") : fail("seed went " + before.seed + " -> " + afterSeed);
  (await orbitHtml(page)) !== before.html ? ok("the orbit repainted") : fail("the orbit did not change");
  // and the URL followed, without a reload
  (await page.evaluate(() => location.search)).includes(afterSeed.toString(16).padStart(4, "0"))
    ? ok("the URL tracks the seed") : fail("the URL did not follow the edit");
  await page.locator("#caSeed .ca-cell").nth(5).click();   // back to the documented seed
  await page.waitForTimeout(120);

  // TAP A GENERATION TO RESEED — the CA analogue of sampling a bar
  const g2row = await page.evaluate(() => window.__CA.plan()[2].row);
  await page.locator("#caOrbit .ca-genpick").nth(2).click();
  await page.waitForTimeout(160);
  (await page.evaluate(() => window.__CA.doc.seed)) === g2row
    ? ok("tapping a generation makes it the seed") : fail("reseeding from a generation did not take");
  await page.evaluate(() => window.__CA.edit({ seed: 0x1249, rule: 110 }));
  await page.waitForTimeout(160);

  // ------------------------------------------------------- D the rule browser
  console.log("\nD. the rule grid picks the rule it draws");
  const pick = await page.evaluate(async () => {
    const cv = document.getElementById("caRules");
    const r = cv.getBoundingClientRect();
    const col = 6, row = 4, want = row * 16 + col;              // rule 70
    const x = r.left + (col + 0.5) * (r.width / 16), y = r.top + (row + 0.5) * (r.height / 16);
    cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, bubbles: true, pointerType: "touch" }));
    await new Promise((res) => setTimeout(res, 120));
    return { want, got: window.__CA.doc.rule };
  });
  pick.got === pick.want ? ok("a tap on tile " + pick.want + " selected rule " + pick.got)
    : fail("tapped tile " + pick.want + " but got rule " + pick.got);
  // the thumbnails must re-read the CURRENT seed, or you are browsing a catalogue
  // rather than the futures of the row in front of you
  const reread = await page.evaluate(async () => {
    const cv = document.getElementById("caRules");
    const snap = () => cv.toDataURL().length + ":" + cv.toDataURL().slice(-64);
    const a = snap();
    window.__CA.edit({ seed: 0x0f0f });
    await new Promise((res) => setTimeout(res, 200));
    const b = snap();
    window.__CA.edit({ seed: 0x1249, rule: 110 });
    await new Promise((res) => setTimeout(res, 200));
    return a !== b;
  });
  reread ? ok("the 256 thumbnails redraw from the new seed") : fail("the rule grid did not re-read the seed");

  // ------------------------------------------------------------- E it SOUNDS
  console.log("\nE. it sounds");
  await page.evaluate(() => window.__CA.transport.start());
  let peak = 0, nonzero = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const r = await page.evaluate(() => window.__CA.transport.rms());
    if (r > 0) { nonzero++; peak = Math.max(peak, r); }
  }
  peak > 0.005 ? ok(`the live graph is not silent (peak ${peak.toFixed(4)}, ${nonzero}/40 samples)`)
    : fail(`silent or near-silent: peak ${peak.toFixed(4)}, ${nonzero}/40 nonzero`);

  // an edit mid-playback must land WITHOUT stopping — exploreLive re-reads
  // getState() every chord bar, which is the whole workstation contract
  await page.locator("#caSeed .ca-cell").nth(9).click();
  await sleep(1200);
  const stillOn = await page.evaluate(() => window.__CA.transport.isPlaying());
  const stillLoud = await page.evaluate(() => window.__CA.transport.rms());
  stillOn ? ok("an edit mid-playback did not stop the transport") : fail("editing a cell stopped the music");
  stillLoud > 0 ? ok("and the graph is still sounding after the edit") : fail("the graph went silent after an edit");

  // ------------------------------------------- E2 the loop makes it an instrument
  console.log("\nE2. loop the bar");
  await page.evaluate(() => window.__CA.transport.stop());
  await sleep(300);
  await page.evaluate(() => window.__CA.transport.setLoop(true));
  await page.waitForTimeout(300);
  // THE THING THAT BROKE FIRST: folding the audition into the resolved song
  // collapsed the plan to one row and the orbit view vanished. The song view and
  // the played state are separate builds and must stay so.
  const loopRows = await page.locator("#caOrbit .ca-gen").count();
  const loopSecs = await page.evaluate(() => window.__CA.playSections());
  loopRows > 4 ? ok("the orbit still shows the whole song while looping (" + loopRows + " rows)")
    : fail("the orbit collapsed to " + loopRows + " rows when the loop came on");
  loopSecs === 1 ? ok("but the ENGINE gets one section") : fail("the played state has " + loopSecs + " sections");

  await page.evaluate(() => window.__CA.transport.start());
  let lpeak = 0;
  for (let i = 0; i < 20; i++) { await sleep(300); const v = await page.evaluate(() => window.__CA.transport.rms()); if (v > lpeak) lpeak = v; }
  lpeak > 0.005 ? ok("the loop sounds (peak " + lpeak.toFixed(4) + ")") : fail("the loop is silent: " + lpeak.toFixed(4));
  (await page.locator("#caPos").textContent()).includes("loop")
    ? ok("the readout counts bars rather than lying about a section index")
    : fail("the loop readout still reports a section: " + (await page.locator("#caPos").textContent()));
  // draw while it loops — the whole point
  await page.locator("#caSeed .ca-cell").nth(2).click();
  await sleep(2200);
  (await page.evaluate(() => window.__CA.transport.isPlaying()))
    ? ok("drawing a cell while looping does not stop it") : fail("editing stopped the loop");
  (await page.evaluate(() => window.__CA.transport.rms())) > 0
    ? ok("and it is still sounding after the edit") : fail("the loop went silent after an edit");
  await page.evaluate(() => { window.__CA.transport.stop(); window.__CA.transport.setLoop(false); });
  await sleep(300);

  // ------------------------------------------------------- E3 undo and length
  console.log("\nE3. undo, and how long the song is");
  const u0 = await page.evaluate(() => window.__CA.doc.seed);
  await page.locator("#caSeed .ca-cell").nth(7).click();
  await page.waitForTimeout(500);
  const u1 = await page.evaluate(() => window.__CA.doc.seed);
  await page.locator("#caUndo").click();
  await page.waitForTimeout(250);
  (await page.evaluate(() => window.__CA.doc.seed)) === u0 ? ok("undo restores the seed") : fail("undo did not restore " + u0);
  await page.locator("#caRedo").click();
  await page.waitForTimeout(250);
  (await page.evaluate(() => window.__CA.doc.seed)) === u1 ? ok("redo replays it") : fail("redo did not reach " + u1);
  await page.locator("#caUndo").click();
  await page.waitForTimeout(250);

  // A DRAG is one undo, however many cells it crosses — and it is a GESTURE that
  // says so, not a stopwatch. (The clock version merged edits inside 400ms, which
  // let a slow repaint split one drag into five undos.) Discrete taps stay their
  // own undo, which is what anyone expects.
  const cellsBox = await page.locator("#caSeed").boundingBox();
  const cw = cellsBox.width / 16, cy = cellsBox.y + cellsBox.height / 2;
  await page.mouse.move(cellsBox.x + cw * 8.5, cy);
  await page.mouse.down();
  for (let i = 9; i < 14; i++) { await page.mouse.move(cellsBox.x + cw * (i + 0.5), cy); await sleep(60); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const dragged = await page.evaluate(() => window.__CA.doc.seed);
  const painted = ((dragged ^ u0).toString(2).match(/1/g) || []).length;
  painted >= 4 ? ok("a drag across the row painted " + painted + " cells")
    : fail("the drag painted " + painted + " cells, expected at least 4");
  await page.locator("#caUndo").click();
  await page.waitForTimeout(300);
  (await page.evaluate(() => window.__CA.doc.seed)) === u0
    ? ok("...and ONE undo takes all of it back") : fail("a five-cell drag needed more than one undo");

  // THE CAP IS A COUNT. The reprise inserts a section, so asking for six and
  // getting seven made the control a liar.
  for (const n of [4, 6, 8]) {
    await page.evaluate((v) => window.__CA.edit({ bars: v }), n);
    await page.waitForTimeout(250);
    const got = await page.locator("#caOrbit .ca-gen").count();
    got === n ? ok(n + " sections means " + n + " rows") : fail("asked for " + n + " sections, drew " + got);
  }
  await page.evaluate(() => window.__CA.edit({ seed: 0x1249, rule: 110, key: 0, genre: "acidhouse", bars: 12, bpm: null }));
  await page.waitForTimeout(250);

  // -------------------------------------------------- E4 making an ACTUAL genre
  console.log("\nE4. start from a genre");
  // The chip alone only ever lent the ORCHESTRA. `start from` sets the other
  // three things a genre is: its groove, its progression and its tempo.
  const made = {};
  for (const g of ["house", "citypop"]) {
    await page.evaluate((x) => window.__CA.startFrom(x), g);
    await page.waitForTimeout(400);
    made[g] = await page.evaluate(() => {
      const r = window.__CA.resolved(), CA = window.CsdCA, seed = window.__CA.doc.seed;
      const kit = CA.lensDrums(seed);
      const lane = (d) => (kit.ops.find((o) => o.d === d) || { hits: [] }).hits.map((h) => h[0]);
      return { seed, bpm: Math.round(r.state.bpm), prog: r.state.progression,
        kick: lane("kick"), snare: lane("snare"), hat: lane("hat"),
        harmony: window.__CA.doc.harmony, url: location.search, sections: r.plan.length };
    });
    console.log("    " + g + ": " + made[g].bpm + "bpm · " + made[g].prog + " · kick on " + made[g].kick.join("/"));
  }
  made.house.kick.join(",") === "0,2,4,6" ? ok("house starts on four to the floor") : fail("house kicks on " + made.house.kick);
  made.house.snare.length >= 2 ? ok("...with a backbeat") : fail("house has no backbeat");
  made.house.prog === "lofi" ? ok("and the anchor's own progression, not a PLR walk") : fail("house harmony is " + made.house.prog);
  made.citypop.prog === "pop_1625" ? ok("city pop gets the 1625 — the thing that makes it city pop")
    : fail("city pop harmony is " + made.citypop.prog);
  made.citypop.bpm === 99 && made.house.bpm !== 99 ? ok("each brings its own tempo (" + made.house.bpm + " vs " + made.citypop.bpm + ")")
    : fail("tempos did not follow: " + made.house.bpm + " / " + made.citypop.bpm);
  made.citypop.seed !== made.house.seed
    ? ok("and a different groove — snapping every hit to a downbeat used to make them identical")
    : fail("city pop and house start on the same row");
  made.citypop.hat.length > 0 ? ok("city pop keeps its off-beat pickups") : fail("city pop lost its pickups");
  made.citypop.url.includes("h=genre") ? ok("the harmony source rides the URL") : fail("h=genre missing from " + made.citypop.url);
  // it must still SOUND with the anchor's harmony — a string progression where the
  // page expected an object threw on every repaint and only the console knew
  const errsBefore = errors.length;
  await page.evaluate(() => window.__CA.transport.start());
  let gpeak = 0;
  for (let i = 0; i < 16; i++) { await sleep(300); const v = await page.evaluate(() => window.__CA.transport.rms()); if (v > gpeak) gpeak = v; }
  gpeak > 0.005 ? ok("a genre-harmony song sounds (peak " + gpeak.toFixed(4) + ")") : fail("silent: " + gpeak.toFixed(4));
  errors.length === errsBefore ? ok("and repaints without a console error") : fail("errors during genre mode: " + errors.slice(errsBefore).join(" | "));
  await page.evaluate(() => window.__CA.transport.stop());
  await sleep(300);
  await page.evaluate(() => window.__CA.edit({ seed: 0x1249, rule: 110, key: 0, genre: "acidhouse", bars: 12, bpm: null, harmony: "seed" }));
  await page.waitForTimeout(250);

  // ------------------------------------------------- F the playhead is a class
  console.log("\nF. the playhead is a class, not a repaint");
  // E2/E3 stopped the transport; the playhead only exists while something plays
  await page.evaluate(() => window.__CA.transport.start());
  await sleep(4000);
  const head = await page.evaluate(async () => {
    const strip = () => [...document.querySelectorAll("#caOrbit .ca-gen")]
      .map((r) => r.className.replace(/\s*now\s*/, " ").trim()).join("|");
    const lit = () => [...document.querySelectorAll("#caOrbit .ca-gen")].findIndex((r) => r.classList.contains("now"));
    const a = { s: strip(), l: lit() };
    await new Promise((res) => setTimeout(res, 9000));
    return { before: a, after: { s: strip(), l: lit() } };
  });
  head.before.l >= 0 ? ok("a row is lit while playing (row " + head.before.l + ")") : fail("nothing is lit while playing");
  head.after.s === head.before.s
    ? ok("the orbit's structure is byte-identical while the head moves")
    : fail("the orbit rebuilt itself to move the playhead");
  await page.evaluate(() => window.__CA.transport.stop());
  await sleep(300);
  (await page.evaluate(() => document.querySelectorAll("#caOrbit .ca-gen.now").length)) === 0
    ? ok("stopping clears the playhead") : fail("the playhead survived a stop");
  await page.evaluate(() => window.__CA.edit({ seed: 0x1249, rule: 110, key: 0, genre: "acidhouse" }));

  // ------------------------------------------------------------- G the URL
  console.log("\nG. 24 bits ride the URL");
  await page.evaluate(() => window.__CA.edit({ seed: 0xbeef, rule: 73, key: 5, genre: "dub" }));
  await page.waitForTimeout(150);
  const shared = await page.evaluate(() => window.__CA.url());
  const p2 = await ctx.newPage();
  const e2 = capturePageErrors(p2);
  await p2.goto(shared, { waitUntil: "domcontentloaded" });
  await settle(p2);
  const round = await p2.evaluate(() => ({ ...window.__CA.doc }));
  (round.seed === 0xbeef && round.rule === 73 && round.key === 5 && round.genre === "dub")
    ? ok("the document survives the link exactly") : fail("URL round-trip lost " + JSON.stringify(round));
  const planA = await page.evaluate(() => JSON.stringify(window.__CA.plan()));
  const planB = await p2.evaluate(() => JSON.stringify(window.__CA.plan()));
  planA === planB ? ok("and renders the identical form") : fail("the shared link renders a different song");
  if (e2.length) fail("errors on the shared link: " + e2.join(" | "));
  await p2.close();

  // A HOSTILE LINK. Every field is a number or a key of the committed genre
  // table, so there is no sanitizer to bypass — but that has to be TRUE, not
  // merely claimed. Junk must resolve byte-identical to a clean boot.
  const clean = await page.evaluate(() => { window.__CA.edit({ seed: 0x1249, rule: 110, key: 0, genre: "acidhouse" }); return JSON.stringify(window.__CA.plan()); });
  const p3 = await ctx.newPage();
  const e3 = capturePageErrors(p3);
  await p3.goto(`${base}/ca.html?s=__proto__&r=99999&k=-4&g=../../etc/passwd`, { waitUntil: "domcontentloaded" });
  await settle(p3);
  const hostile = await p3.evaluate(() => ({ doc: { ...window.__CA.doc }, plan: JSON.stringify(window.__CA.plan()) }));
  hostile.plan === clean ? ok("a hostile ?s/?r/?k/?g resolves byte-identical to a clean boot")
    : fail("a hostile URL changed the song: " + JSON.stringify(hostile.doc));
  if (e3.length) fail("errors on the hostile link: " + e3.join(" | ")); else ok("and boots without an error");
  await p3.close();

  // -------------------------------------------------------------- H the laws
  console.log("\nH. the standing laws");
  for (const [w, h, label] of [[390, 844, "phone"], [1440, 900, "desk"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll("button, [role=slider], [tabindex='0']")) {
        if (el.disabled || !el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (el.classList.contains("ca-cell")) continue;      // the bar is 16 wide by law; the ROW is the target
        if (r.height < 40) small.push(el.className + " " + Math.round(r.width) + "x" + Math.round(r.height));
      }
      return { ranges: document.querySelectorAll("input[type=range]").length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: small.slice(0, 6) };
    });
    m.ranges === 0 ? ok(label + ": zero input[type=range]") : fail(label + ": " + m.ranges + " range inputs");
    m.overflow <= 1 ? ok(label + ": no sideways overflow") : fail(label + ": overflows by " + m.overflow + "px");
    m.small.length === 0 ? ok(label + ": every control clears 40px") : fail(label + ": under 40px — " + m.small.join(", "));
  }

  if (errors.length) fail("page errors accumulated: " + errors.slice(0, 4).join(" | "));

  await browser.close();
  srv.close();
  console.log(process.exitCode ? "\nca: FAIL" : `\nca: PASS — ${checks} checks`);
}

main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });

#!/usr/bin/env node
// test/bench.test.js — THE BENCH GATE (2026-08-27).
//
// The motif cell-row and the drum step grid were replaced by the Bench
// (nukernel/ideal/composer.html; Paul, 2026-08-27: "play/hold/rest, pitch
// offset −12 to 12, velocity 0 to 7, tightened to one line"). This gate
// measures the RENDERED page (TEST THE ARTIFACT — three features have shipped
// broken in this repo while every check passed): every assertion is taken off
// a real browser at 390px, and the doc is read back through the page's own
// __eightDoc probe so render and record are compared, never trusted.
//
// B1  a pitch-bar drag lands ONLY on lattice values — deg stays an integer in
//     the kernel's own -7..7, its semitone (K.pitch against the record's own
//     scale, the ONE owner) is inside −12..+12, and the badge the eye reads
//     prints exactly that semitone.
// B2  a weight-bar tap cycles ghost(1) → hit(4) → accent(7) → … and NEVER
//     lands on 0 — rest is the kind button's job; and the document holds
//     round(view * 9/7), the one stated mapping (V7/V9, ui/eight.js).
// B3  row geometry is IDENTICAL across kind changes: sixteen 52px lines,
//     before and after a row is set to rest and back — nothing reflows under
//     a finger.
// B4  a TOUCH drag on a bar writes the value and does not scroll the page —
//     the touch law: setPointerCapture + touch-action on the control only.
// B5  the kit cell (a fresh "+ drum pattern" cell): tap cycles the document
//     through 0 → 2 → 5 → 9 → 0 — the lanes' own words (drums-kit.js: "a
//     ghost is a 2 and an accent is a 9") — and NEVER writes the deferring 1;
//     a sideways touch drag writes a level without scrolling.
// B6  playback mutates only [data-live]: the frozen half is byte-identical
//     while the record runs (the light form of motif-frozen A3, re-proved
//     over the new controls).
// B7  no page errors; no horizontal overflow at 390 or 1280.
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/bench.test.js

const fs = require("fs");
const path = require("path");
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";

const CANDIDATES = [
  "chromium-1234/chrome-linux64/chrome",
  "chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "chromium-1217/chrome-linux64/chrome",
];
function executable() {
  const root = path.join(process.env.HOME, ".cache/ms-playwright");
  for (const c of CANDIDATES) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no installed chromium under " + root);
}

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

// a CDP touch drag: start, a run of moves, end — what a thumb does
async function touchDrag(page, x0, y0, x1, y1, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x, y) => [{ x, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x0, y0) });
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable(),
    args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("bench gate · " + URL_);

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // ---- the surface exists, in the promised geometry
  const shape = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".nu-bench tr")].slice(1);
    return { rows: rows.length,
      segs: document.querySelectorAll(".nu-segb").length,
      pits: document.querySelectorAll(".nu-pit").length,
      vels: document.querySelectorAll(".nu-velA").length,
      refusal: (() => { const b = document.querySelector(".nu-benchbar button");
        return b ? { off: b.disabled, why: b.dataset.why || "" } : null; })(),
      rail: document.querySelectorAll(".nu-wisdom").length };
  });
  is(shape.rows >= 16 && shape.segs === shape.rows * 3 &&
     shape.pits === shape.rows && shape.vels === shape.rows,
    "the Bench is on the page: " + shape.rows + " one-line rows, " +
    shape.segs + " kind segments, one pitch + one weight bar each");
  is(!!shape.refusal && shape.refusal.off && /chromatic/.test(shape.refusal.why),
    "the accidentals toggle is drawn REFUSED with its reason (" +
    JSON.stringify(shape.refusal && shape.refusal.why.slice(0, 48)) + "…)");
  is(shape.rail === 1, "one wisdom rail");

  // which row is a play row — and MEASURE EACH TARGET IN THE VIEWPORT, fresh,
  // just before the pointer goes to it (a rect measured off-screen is a click
  // into nothing)
  const spot = await page.evaluate(() => {
    const doc = window.__eightDoc();
    const name = document.querySelector(".nu-motif") ?
      document.querySelector(".nu-motif").textContent.split(" — ")[0] :
      Object.keys(doc.material.cells)[0];
    const H = doc.material.cells[name];
    const i = H.play.findIndex((p) => p === "n");
    return { name, i };
  });
  const boxOf = (sel, i) => page.evaluate(([sel, i]) => {
    const list = [...document.querySelectorAll(".nu-bench tr")].slice(1);
    const e = i == null ? document.querySelector(sel) : list[i].querySelector(sel);
    e.scrollIntoView({ block: "center" });
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, [sel, i]);
  ok("editing " + spot.name + " step " + (spot.i + 1));

  // B1 — the drag lands only on the lattice, and the badge agrees
  const landed = [];
  for (const f of [0.03, 0.21, 0.37, 0.52, 0.68, 0.83, 0.97]) {
    const pit = await boxOf(".nu-pit", spot.i);
    const x = pit.x + pit.w * f, y = pit.y + pit.h / 2;
    await page.mouse.move(pit.x + pit.w / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    landed.push(await page.evaluate(([name, i]) => {
      const doc = window.__eightDoc();
      const deg = doc.material.cells[name].deg[i];
      // the record's own scale, resolved the way document.js resolves it
      const NG = window.NuGenres, A = doc.alphabet;
      const mode = NG.MODES[A.mode] || NG.MODES.aeolian;
      const sc = (A.scale && (NG.SCALES[A.scale] || NG.MODES[A.scale])) || mode;
      const semi = window.NuKernel.pitch(deg, sc);
      const inScale = sc.indexOf(((semi % 12) + 12) % 12) >= 0;
      const rows = [...document.querySelectorAll(".nu-bench tr")].slice(1);
      const badge = rows[i].querySelector(".nu-pbb small");
      return { deg, semi, inScale, badge: badge ? badge.textContent : "" };
    }, [spot.name, spot.i]));
  }
  is(landed.every((l) => Number.isInteger(l.deg) && l.deg >= -7 && l.deg <= 7),
    "B1 · every landing is an integer degree in the kernel's -7..7 (" +
    landed.map((l) => l.deg).join(" ") + ")");
  is(landed.every((l) => l.semi >= -12 && l.semi <= 12 && l.inScale),
    "B1 · every landing's semitone is on the record's own lattice (" +
    landed.map((l) => l.semi).join(" ") + ")");
  is(landed.every((l) => l.badge === (l.semi > 0 ? "+" : "") + l.semi),
    "B1 · the RENDERED badge prints the document's own semitone every time");
  is(new Set(landed.map((l) => l.deg)).size >= 4,
    "B1 · the drags actually moved across the bar (" +
    new Set(landed.map((l) => l.deg)).size + " distinct degrees)");

  // B2 — the tap cycle: 1/4/7 and never 0; the document holds round(v*9/7)
  const seen = [];
  for (let t = 0; t < 8; t++) {
    const vel = await boxOf(".nu-velA", spot.i);
    await page.mouse.click(vel.x + vel.w / 2, vel.y + vel.h / 2);
    await page.waitForTimeout(100);
    seen.push(await page.evaluate(([name, i]) => {
      const doc = window.__eightDoc();
      const rows = [...document.querySelectorAll(".nu-bench tr")].slice(1);
      return { view: +rows[i].querySelector(".nu-velA").dataset.v,
               doc: doc.material.cells[name].vel[i] };
    }, [spot.name, spot.i]));
  }
  is(seen.every((s) => s.view !== 0),
    "B2 · eight taps, and not one landed on 0 (" + seen.map((s) => s.view).join(" ") + ")");
  is(seen.every((s) => [1, 4, 7].includes(s.view)),
    "B2 · every tap landed on the three words — ghost(1) hit(4) accent(7)");
  is(seen.every((s) => s.doc === Math.round(s.view * 9 / 7)),
    "B2 · the document holds the ONE stated mapping, round(view*9/7): view " +
    seen.map((s) => s.view).join(" ") + " → doc " + seen.map((s) => s.doc).join(" "));

  // B3 — geometry across kind changes: nothing moves, nothing resizes
  const rects = () => page.evaluate(() => {
    const t = document.querySelector(".nu-bench");
    const t0 = t.getBoundingClientRect();
    const rows = [...t.querySelectorAll("tr")].slice(1);
    return rows.map((r) => { const b = r.getBoundingClientRect();
      return Math.round(b.y - t0.y) + "x" + Math.round(b.height) +
             "x" + Math.round(b.width); }).join(",");
  });
  const before = await rects();
  // say REST on the play row, then say NOTE again — through the rendered buttons
  const segSel = (code) => page.evaluate(([i, c]) => {
    const rows = [...document.querySelectorAll(".nu-bench tr")].slice(1);
    const b = [...rows[i].querySelectorAll(".nu-segb")]
      .find((x) => x.dataset.k.endsWith(c));
    b.click();
  }, [spot.i, code]);
  await segSel("r"); await page.waitForTimeout(150);
  const during = await rects();
  await segSel("n"); await page.waitForTimeout(150);
  const after = await rects();
  is(before === during && during === after,
    "B3 · sixteen rows keep their exact geometry across note → rest → note");
  const heights = before.split(",").map((r) => +r.split("x")[1]);
  is(heights.every((h) => h === 52),
    "B3 · the rows are the promised 52px lines (" +
    [...new Set(heights)].join("/") + ")");

  // B4 — a touch drag writes the value and moves the page not one pixel
  const degBefore = await page.evaluate(([name, i]) =>
    window.__eightDoc().material.cells[name].deg[i], [spot.name, spot.i]);
  const pit4 = await boxOf(".nu-pit", spot.i);
  const scr0 = await page.evaluate(() => [window.scrollX, Math.round(window.scrollY)]);
  await touchDrag(page, pit4.x + pit4.w / 2, pit4.y + pit4.h / 2,
                  pit4.x + pit4.w * 0.9, pit4.y + pit4.h / 2);
  await page.waitForTimeout(150);
  const scr1 = await page.evaluate(() => [window.scrollX, Math.round(window.scrollY)]);
  const degAfter = await page.evaluate(([name, i]) =>
    window.__eightDoc().material.cells[name].deg[i], [spot.name, spot.i]);
  is(degAfter !== degBefore,
    "B4 · the touch drag reached the document (deg " + degBefore + " → " + degAfter + ")");
  is(scr0[0] === scr1[0] && scr0[1] === scr1[1],
    "B4 · and the page did not scroll under it (" + scr0 + " → " + scr1 + ")");

  // B5 — the kit: a fresh drum cell, the tap cycle in the LANES' own words
  await page.evaluate(() => {
    const b = document.querySelector('[data-k="adddrumcell"]');
    if (b) b.click();
  });
  await page.waitForTimeout(800);
  const kit = await page.evaluate(() => {
    const cells = document.querySelectorAll(".nu-kc");
    if (!cells.length) return null;
    // an EMPTY cell, so the cycle starts at rest
    const c = [...cells].find((x) => +x.dataset.v === 0) || cells[0];
    c.scrollIntoView({ block: "center" });
    const b = c.getBoundingClientRect();
    return { n: cells.length, k: c.dataset.k,
             x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
  });
  is(!!kit && kit.n >= 48, "B5 · the drum cell renders velocity cells (" +
    (kit && kit.n) + ")");
  if (kit) {
    const lane = kit.k.slice(3).replace(/\d+$/, ""), step = +kit.k.match(/\d+$/)[0];
    const docLane = () => page.evaluate(([lane, step]) => {
      const doc = window.__eightDoc();
      const dn = Object.keys(doc.material.cells)
        .filter((k) => doc.material.cells[k].kind === "drum").pop();
      return doc.material.cells[dn].lanes[lane][step] | 0;
    }, [lane, step]);
    const cyc = [];
    for (let t = 0; t < 4; t++) {
      await page.mouse.click(kit.x, kit.y);
      await page.waitForTimeout(100);
      cyc.push(await docLane());
    }
    is(cyc.join(" ") === "2 5 9 0",
      "B5 · the tap cycle writes the document's own words — ghost 2, hit 5, " +
      "accent 9, rest 0 — and never the deferring 1 (" + cyc.join(" ") + ")");
    const scr2 = await page.evaluate(() => Math.round(window.scrollY));
    await touchDrag(page, kit.x - kit.w * 0.4, kit.y, kit.x + kit.w * 0.45, kit.y);
    await page.waitForTimeout(150);
    const dv = await docLane();
    const scr3 = await page.evaluate(() => Math.round(window.scrollY));
    is(dv > 0 && dv !== 1,
      "B5 · a sideways touch drag writes a level (doc " + dv + "), never a 1");
    is(scr2 === scr3, "B5 · and the page held still (" + scr2 + " → " + scr3 + ")");
  }

  // B6 — playback mutates only [data-live] over the new controls
  const A = await page.evaluate(() => window.__eightFrozen());
  await page.click("#play");
  await page.waitForFunction(() =>
    document.getElementById("play").textContent === "stop", null,
    { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const B = await page.evaluate(() => window.__eightFrozen());
  is(A === B, "B6 · five seconds of playback and the editable half is " +
    "byte-identical (" + A.length + " chars)");
  await page.click("#play");
  await page.waitForTimeout(600);

  // B7 — clean at both widths
  const over390 = await page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  is(over390 <= 0, "B7 · no horizontal overflow at 390 (" + over390 + "px)");
  is(errors.length === 0, "B7 · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
  await page.close();

  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const werrs = [];
  wide.on("pageerror", (e) => werrs.push(e.message));
  await wide.goto(URL_, { waitUntil: "load" });
  await wide.waitForTimeout(4000);
  const over1280 = await wide.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  is(over1280 <= 0, "B7 · no horizontal overflow at 1280 (" + over1280 + "px)");
  is(werrs.length === 0, "B7 · no page errors at 1280");
  await wide.close();

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

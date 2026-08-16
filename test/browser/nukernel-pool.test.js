#!/usr/bin/env node
// test/browser/nukernel-pool.test.js — THE INSTRUMENT POOL PROBE.
//
//   node test/browser/nukernel-pool.test.js
//
// The instrument moved from the section's VOICE cell to ONE song-level
// INSTRUMENT POOL ("the band is hired for the record, not the scene",
// 2026-08-16), completing the globalization arc tempo → groove → swing → the
// band. test/unit/nukernel.test.js proves the model — the registry lost the
// per-layer `instr` field, the migration lifts old saves per chair, a pooled
// trumpet reaches every scheduled lead and respects the register fold — but
// the CONTROLS are DOM, and this is the one DOM probe the move gets, DOM-only
// on purpose (no play button, no analyser: the pool reaches the sound through
// the same buildTimeline the timing controls already gate).
//
//   (A) the POOL BANK exists on the SONG page: one labeled row per chair
//       (the kernel's roles plus the bass, no drums), the genre's default
//       dim-lit while a chair is uncast;
//   (B) a PICK commits: tapping a chair unfolds the twelve-family picker,
//       tapping an instrument reaches state (POOL), the one resolver
//       (derive.js instrIdOf), and the debounced save — at song level, with
//       no `instr` on any stack entry;
//   (C) NO SECTION SURFACE OFFERS AN INSTRUMENT: neither the parent row's
//       VOICE menu nor a layer sub-row's carries an instrument bank or a
//       single instr chip;
//   (D) THE DELETES WORK LIKE A FINGER WORKS ("I can't remove sections any
//       more", 2026-08-16): the PART menu's ✕ removes the section — row and
//       sub-rows leaving both SONG and the DOM — and the sub-row's own ✕
//       removes the layer; the last section cannot be deleted (it is replaced
//       by a fresh empty box, the model's law). Every tap here is HONEST — a
//       raw click at the key's current on-screen position, no helper scroll —
//       because that is exactly what broke: the menu's unconditional smooth
//       pin-scroll kept every key in motion under the finger, and gates that
//       re-aim after scrolling stayed green while thumbs missed.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8961;                 // a PREFERENCE — the harness walks past a busy port

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

const { POOLCHAIRS } = require("../../nukernel/fields.js");

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });
  // a fresh store, whatever an earlier run left behind
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });

  // (A) the bank exists, one row per chair, defaults dim-lit
  {
    const n = await page.locator("#poolbank").count();
    if (n !== 1) fail(`expected exactly one #poolbank, found ${n}`);
    else ok("the INSTRUMENTS bank exists on the song page, once");
    const chairs = await page.locator("#poolbank .poolpick")
      .evaluateAll(els => els.map(e => e.dataset.chair));
    if (chairs.join(",") !== POOLCHAIRS.join(","))
      fail(`the bank's chairs are [${chairs}], the registry says [${POOLCHAIRS}]`);
    else ok(`one labeled row per chair: ${chairs.join(", ")}`);
    // a fresh page casts nobody: every row shows the genre's own answer dim
    const dim = await page.locator("#poolbank .pv.dflt").count();
    if (dim !== POOLCHAIRS.length)
      fail(`${dim} of ${POOLCHAIRS.length} uncast rows read as default (.dflt)`);
    else ok("every uncast chair shows the genre's default, dim-lit");
    // the fresh default song seats a line chair, and its readout names a sound
    const lineTxt = await page.locator('#poolbank .poolpick[data-chair="line"] .pv')
      .textContent();
    if (!lineTxt || lineTxt.trim() === "—")
      fail(`the line chair's default readout is empty ("${lineTxt}")`);
    else ok(`the line chair reads its genre default: ${lineTxt.trim()}`);
  }

  // (B) a pick commits — state, resolver, and the save, at song level
  {
    await page.locator('#poolbank .poolpick[data-chair="line"]').click();
    await page.waitForSelector("#poolbank .poolmount:not([hidden])", { timeout: 10000 });
    const fams = await page.locator("#poolbank .poolmount .plabel").allTextContents();
    if (fams.filter(t => /^instrument · /.test(t)).length < 10)
      fail(`the picker offers only ${fams.length} family banks: ${fams.join(", ")}`);
    else ok(`the chair unfolds the family picker (${fams.length - 1} instrument families)`);
    const chip = page.locator('#poolbank .pchip[data-kind="pool"][data-value="trumpet"]');
    if (!(await chip.count())) { fail("no trumpet chip in the picker"); }
    else {
      await chip.click();
      await page.waitForTimeout(400);            // past the 250 ms save debounce
      const got = await page.evaluate(async () => {
        const stm = await import("/nukernel/ui/state.js");
        const D = await import("/nukernel/ui/derive.js");
        const sec = stm.SONG[0];
        const owner = sec.stack[0].g;
        const raw = JSON.parse(localStorage.getItem("nukernel.song.v1") || "null");
        return {
          pool: stm.POOL,
          resolved: D.instrIdOf(sec, owner, 0, stm.POOL),
          chair: D.chairOf(sec, sec.stack[0], 0),
          savedPool: raw && raw.pool,
          strayInstr: !!(raw && raw.song && raw.song.some(b => b && b.stack &&
            b.stack.some(e => e && e.instr != null))),
        };
      });
      if (!got.pool || got.pool.line !== "trumpet")
        fail(`state POOL is ${JSON.stringify(got.pool)}, not {line:"trumpet"}`);
      else ok("the pick reaches state: POOL.line = trumpet");
      if (got.chair !== "line" || got.resolved !== "trumpet")
        fail(`the resolver answers ${got.resolved} for the ${got.chair} chair, not trumpet`);
      else ok("the one resolver (instrIdOf) answers the pooled trumpet");
      if (!got.savedPool || got.savedPool.line !== "trumpet")
        fail(`the save carries pool ${JSON.stringify(got.savedPool)}, not the pick`);
      else ok("the pick commits to the save, at song level");
      if (got.strayInstr) fail("the save still carries a per-layer instr");
      else ok("no stack entry in the save carries an instr");
      // the row's readout is now the cast, lit rather than dim
      const cast = await page.locator('#poolbank .poolpick[data-chair="line"] .pv')
        .textContent();
      if (!/trumpet/.test(cast || "")) fail(`the row reads "${cast}", not the trumpet`);
      else ok("the chair's row reads its cast instrument");
    }
    await page.keyboard.press("Escape");
  }

  // (C) no section surface offers an instrument — parent VOICE menu first,
  // then a layer sub-row's, on a stacked box adopted through the front door
  {
    const noInstr = async (where) => {
      const pop = page.locator("#rowpop");
      const chips = await pop.locator('.pchip[data-kind="instr"]').count();
      const banks = (await pop.locator(".plabel").allTextContents())
        .filter(t => /instrument/i.test(t)).length;
      if (chips || banks)
        fail(`the ${where} VOICE menu still offers instruments ` +
             `(${chips} chips, ${banks} banks)`);
      else ok(`the ${where} VOICE menu offers no instrument bank`);
    };
    await page.locator(".box").first().locator('.bcell[data-cell="voice"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    await noInstr("parent row");
    await page.keyboard.press("Escape");
    // grow a layer through the GENRE menu, then open ITS voice cell
    await page.locator(".box").first().locator('.bcell[data-cell="genre"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    await page.locator('#rowpop .pchip[data-kind="genre"][data-value="ska"]').click();
    await page.locator('#rowpop .pchip[data-kind="genre"][data-value="fugue"]').click();
    await page.keyboard.press("Escape");
    const sub = page.locator(".lrow").first().locator('.bcell[data-cell="voice"]');
    if (!(await sub.count())) fail("no layer sub-row appeared to probe");
    else {
      await sub.click();
      await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
      await noInstr("layer sub-row");
      await page.keyboard.press("Escape");
    }
  }

  // (D) the deletes, tapped the way a finger taps
  {
    const st = () => page.evaluate(async () => {
      const stm = await import("/nukernel/ui/state.js");
      return { songs: stm.SONG.length,
               rows: document.querySelectorAll(".box").length,
               lrows: document.querySelectorAll(".lrow").length,
               stack0: stm.SONG[0].stack.map(e => e.g) };
    });
    // an HONEST tap: a raw click at the key's current centre, only if the
    // point really belongs to the key — a covered or off-glass key is the
    // regression this section exists to catch, reported by name
    const honestTap = async (sel, what) => {
      const info = await page.evaluate(s => {
        const el = document.querySelector(s);
        if (!el) return { missing: true };
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const at = document.elementFromPoint(cx, cy);
        return { cx, cy,
                 inView: cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth,
                 onTarget: !!(at && (at === el || el.contains(at))),
                 at: at ? (at.className || at.tagName) : "nothing" };
      }, sel);
      if (info.missing) { fail(`${what}: no ${sel} in the DOM`); return false; }
      if (!info.inView) { fail(`${what}: the key sits off the glass`); return false; }
      if (!info.onTarget) {
        fail(`${what}: the key is covered by "${info.at}" — a tap lands there instead`);
        return false;
      }
      await page.mouse.click(info.cx, info.cy);
      return true;
    };
    // box 1 still wears the ska+fugue stack from (C): deleting the parent
    // must take the whole family — the sub-row leaves with the row
    const before = await st();
    if (before.lrows < 1) fail("(C) left no layer sub-row for (D) to inherit");
    await page.locator(".box").first().locator('.bcell[data-cell="part"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    await page.waitForTimeout(120);            // the pin is INSTANT now; settle a frame
    if (await honestTap("#rowpop .rpdel", "section delete")) {
      await page.waitForTimeout(200);
      const after = await st();
      if (after.songs !== before.songs - 1 || after.rows !== after.songs)
        fail(`the section delete left SONG at ${after.songs} with ${after.rows} rows ` +
             `(was ${before.songs})`);
      else ok("the PART menu's ✕ removes the section — model and DOM together");
      if (after.lrows !== 0)
        fail(`${after.lrows} layer sub-row(s) survived their parent's delete`);
      else ok("the deleted section's sub-rows left with it");
    }
    // a fresh layer on the new first box, then the sub-row's own ✕
    await page.locator(".box").first().locator('.bcell[data-cell="genre"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    await page.locator('#rowpop .pchip[data-kind="genre"][data-value="ska"]').click();
    await page.locator('#rowpop .pchip[data-kind="genre"][data-value="fugue"]').click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    const layered = await st();
    if (layered.lrows !== 1 || layered.stack0.length !== 2)
      fail(`could not stage a layer to remove (lrows ${layered.lrows}, ` +
           `stack ${layered.stack0.join("+")})`);
    else if (await honestTap(".lrow .lrx", "layer remove")) {
      await page.waitForTimeout(200);
      const after = await st();
      if (after.lrows !== 0 || after.stack0.length !== 1)
        fail(`the layer ✕ left lrows ${after.lrows}, stack ${after.stack0.join("+")}`);
      else ok("the sub-row's ✕ removes the layer — stack shrinks, sub-row gone");
    }
    // the last-section law: delete down to one, then once more — the song
    // never empties, the final delete hands back a fresh empty box
    let guard = 12;
    while ((await st()).songs > 1 && guard--) {
      await page.locator(".box").first().locator('.bcell[data-cell="part"]').click();
      await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
      await page.waitForTimeout(120);
      if (!(await honestTap("#rowpop .rpdel", "section delete (drain)"))) break;
      await page.waitForTimeout(150);
    }
    const one = await st();
    if (one.songs !== 1) fail(`could not drain the song to one box (${one.songs})`);
    else {
      await page.locator(".box").first().locator('.bcell[data-cell="part"]').click();
      await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
      await page.waitForTimeout(120);
      if (await honestTap("#rowpop .rpdel", "last-section delete")) {
        await page.waitForTimeout(200);
        const last = await st();
        if (last.songs !== 1 || last.stack0.join() !== "simple")
          fail(`deleting the last box left ${last.songs} box(es), ` +
               `stack ${last.stack0.join("+")} — the fresh-box law broke`);
        else ok("the last section cannot be deleted — a fresh empty box takes its place");
      }
    }
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close();
  await srv.close();
  console.log(process.exitCode ? `\nFAILED (${checks} passed)` : `\nPASS (${checks} checks)`);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });

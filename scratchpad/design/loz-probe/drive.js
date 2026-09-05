const { chromium } = require("playwright");
const URL = "http://127.0.0.1:8777/scratchpad/design/loz-probe/index.html";
const EXE = require("os").homedir() +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const W of [320, 390, 1280]) {
    const ctx = await browser.newContext({
      viewport: { width: W, height: 844 },
      hasTouch: true, isMobile: W < 900,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-sel="probe.kit"] .nu-lz');

    const m = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.kit"]');
      const lz = [...f.querySelectorAll("button.nu-lz")];
      const rects = lz.map((b) => b.getBoundingClientRect());
      return {
        options: lz.length,
        visible: rects.filter((r) => r.width > 0 && r.height > 0).length,
        under44: rects.filter((r) => r.height < 44 || r.width < 44).length,
        minH: Math.min(...rects.map((r) => Math.round(r.height))),
        minW: Math.min(...rects.map((r) => Math.round(r.width))),
        clusters: f.querySelectorAll("section.nu-lzcluster").length,
        hues: [...f.querySelectorAll("section.nu-lzcluster")].map((s) => s.dataset.hue).join(","),
        counts: [...f.querySelectorAll(".nu-lzcount")].map((c) => c.textContent).join(","),
        refused: f.querySelectorAll("button.nu-lz[disabled]").length,
        printedWhy: f.querySelectorAll(".nu-lzwhy").length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fieldH: Math.round(f.getBoundingClientRect().height),
        fieldK: f.dataset.k, fieldSel: f.dataset.sel,
        sampleK: lz[5].dataset.k,
        wordSpans: f.querySelectorAll(".nu-lzword").length,
      };
    });

    /* ---- a tap writes, nothing dismisses, the field is the same node ---- */
    await page.evaluate(() => { window.__id = document.querySelector('[data-sel="probe.kit"]'); });
    const target = page.locator('[data-k="probe.kit|op7"]');
    await target.tap();
    await target.tap();               // twice in a row
    await page.locator('[data-k="probe.kit|op30"]').tap();
    const afterTap = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.kit"]');
      return {
        same: f === window.__id,
        stillThere: !!f && f.isConnected,
        options: f.querySelectorAll("button.nu-lz").length,
        openWraps: [...f.querySelectorAll(".nu-lzwrap")].filter((w) => !w.hidden).length,
        hot: [...f.querySelectorAll(".nu-lz.is-hot")].map((b) => b.dataset.v).join(","),
        pressed: [...f.querySelectorAll('.nu-lz[aria-pressed="true"]')].map((b) => b.dataset.v).join(","),
        dataV: f.dataset.v,
        log: window.__probe.log.slice(),
        say: f.querySelector(".nu-lzsay").textContent,
      };
    });

    /* ---- a 700ms press says and does not write ------------------------- */
    await page.evaluate(() => { window.__probe.log.length = 0; });
    const box = await page.locator('[data-k="probe.kit|op9"]').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // warm
    await page.evaluate(() => { window.__probe.log.length = 0; });
    const b2 = await page.locator('[data-k="probe.kit|op11"]').boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const afterHold = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.kit"]');
      return { say: f.querySelector(".nu-lzsay").textContent,
               wrote: window.__probe.log.slice(),
               hot: [...f.querySelectorAll(".nu-lz.is-hot")].map((b) => b.dataset.v).join(",") };
    });
    /* the refused one's sentence, on a hold */
    const b3 = await page.locator('[data-k="probe.kit|op3"]').boundingBox();

    /* ---- the ordered chain re-numbers on removal ----------------------- */
    await page.evaluate(() => { window.__probe.log.length = 0; });
    for (const v of ["transpose", "invert", "retrograde", "augment"])
      await page.locator('[data-k="probe.chain|' + v + '"]').tap();
    const chainA = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.chain"]');
      return { ns: [...f.querySelectorAll(".nu-lz.is-hot")].map((b) =>
                 b.dataset.v + "=" + (b.querySelector(".nu-lzn") || {}).textContent).join(" "),
               dataV: f.dataset.v, log: window.__probe.log.slice() };
    });
    await page.locator('[data-k="probe.chain|invert"]').tap();   // remove the 2nd
    const chainB = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.chain"]');
      return { ns: [...f.querySelectorAll(".nu-lz.is-hot")].map((b) =>
                 b.dataset.v + "=" + (b.querySelector(".nu-lzn") || {}).textContent).join(" "),
               dataV: f.dataset.v, log: window.__probe.log.slice(-1) };
    });

    /* ---- fold / unfold, and the keyboard ------------------------------- */
    await page.locator('[data-k="probe.kit|cluster|hats"]').tap();
    const folded = await page.evaluate(() => {
      const f = document.querySelector('[data-sel="probe.kit"]');
      const s = f.querySelector('[data-cluster="hats"]');
      return { cls: s.className, expanded: s.querySelector(".nu-lzhead").getAttribute("aria-expanded"),
               hidden: s.querySelector(".nu-lzwrap").hidden,
               inDom: f.querySelectorAll("button.nu-lz").length,
               visible: [...f.querySelectorAll("button.nu-lz")]
                 .filter((b) => b.getBoundingClientRect().height > 0).length,
               overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    await page.locator('[data-k="probe.kit|cluster|hats"]').tap();  // back open

    const kb = await page.evaluate(async () => {
      const f = document.querySelector('[data-sel="probe.kit"]');
      const first = f.querySelector('[data-k="probe.kit|op0"]');
      first.focus();
      const send = (key) => f.querySelector(":focus")
        .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      const out = [];
      send("ArrowRight"); out.push(document.activeElement.dataset.v);
      send("ArrowRight"); out.push(document.activeElement.dataset.v);  // skips op3 (refused)
      send("ArrowDown");  out.push(document.activeElement.dataset.v);
      send("ArrowUp");    out.push(document.activeElement.dataset.v);
      send("End");        out.push(document.activeElement.dataset.v);
      send("Home");       out.push(document.activeElement.dataset.v);
      const stops = [...f.querySelectorAll("button.nu-lz")].filter((b) => b.tabIndex === 0).length;
      const heads = [...f.querySelectorAll(".nu-lzhead")].length;
      return { walk: out.join(">"), lozengeTabStops: stops, headings: heads };
    });

    console.log("== " + W + "px ==");
    console.log(JSON.stringify({ ...m, afterTap, afterHold, chainA, chainB, folded, kb,
                                 pageErrors: errs }, null, 1));
    await ctx.close();
  }
  await browser.close();
})();

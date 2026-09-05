/* test/lib-combo.js — ONE DRIVER FOR A COMBO BOX, FOR EVERY BROWSER GATE.
 *
 * (2026-09-02, wave 4. Paul, after using the composer on staging: *"The combo
 * boxes just don't work and are confusing. I was expecting more of onfocus show
 * custom dropdown then filter based on input — one line instead of two."*)
 *
 * WHY THIS FILE EXISTS AND WHAT WENT WRONG WITHOUT IT. Every single-choice
 * control ui/selects.js draws is one widget now — an `<input role=combobox>`
 * carrying `data-sel` / `data-k` / `data-v`, with a `<ul role=listbox>` of
 * `<li role=option data-v>` beside it, `hidden` until a hand opens it. The
 * ADDRESSES did not move, which was the whole point of the reversal, but three
 * browser gates spelled their driver `select[data-sel="…"]` — and
 * `querySelector` on a tag that is no longer on the page returns null, so those
 * drivers SILENTLY DID NOTHING and the checks under them measured a document
 * nobody had touched. That is the same species of failure the standing law
 * "test the artifact" was written for, and the repair is not four copies of a
 * new query: it is one driver, in one file, that the gates share.
 *
 * WHAT A GATE MAY DO TO A MENU, AND IN WHICH ORDER IT TRIES.
 *   1. OPEN IT THE WAY A THUMB DOES. ui/selects.js opens the list on `focus`,
 *      and only if a GESTURE has happened since the control was built (its
 *      `gestures <= bornAt` guard: the page putting your thumb back after a
 *      redraw is never a request to open a list). A synthetic `.click()` fires
 *      no pointer events, so the driver dispatches a real `pointerdown` — the
 *      document's capture listener counts it, the field's own handler focuses
 *      itself, and the list opens exactly as it does under a finger.
 *   2. TAP THE OPTION. `li[data-v]` is clicked; `takeTap` in ui/selects.js
 *      listens on `click` as well as `pointerdown` precisely so a synthetic
 *      click is a real tap.
 *   3. AND, IF THE LIST NEVER OPENED, THE COMMIT ui/selects.js DOCUMENTS. Its
 *      `change` listener says so out loud: "A SYNTHETIC `change` IS A COMMIT …
 *      the field answers to the option's VALUE first and to its word second."
 *      That path is the fallback and not the first move, because a gate that
 *      only ever wrote `.value` would pass on a widget whose list was broken.
 * A REFUSAL IS STILL A REFUSAL. A disabled field, or an option carrying
 * `aria-disabled`, returns false without touching the record — which is what
 * lets "the sheet offers `arch` and takes a tap" fail when it should.
 *
 * IT ALSO STILL DRIVES A `<select>`, because ui/sheets.js's harness pages and
 * anything not yet converted still draw one, and a driver that could only see
 * one of the two widgets is the bug this file is repairing, one widget along.
 *
 * ...AND A STRIP OF CHIPS, SINCE 2026-09-06, WHICH IS THE THIRD WIDGET. Paul,
 * 2026-09-05: *"In general dropdowns barely work."* `nukernel/src/menus/` is
 * the one owner of every menu on the page now and it draws three things — chips
 * up to eight words, the native `<select>` above eight on a thumb, the typed
 * combo above eight with a keyboard (`src/menus/pick.ts`). All three carry the
 * SAME `data-sel` / `data-k` / `data-v`, and all three say which they are in
 * `data-widget`, so this driver reads the address and the widget and never the
 * tag. A gate that spelled its driver `select[data-sel=…]` is exactly the
 * silent no-op this file was written about; a gate that assumed `combobox` is
 * the same bug one widget along.
 *
 * The page-side half is installed as `window.__combo` — the GATE's helper and
 * not the page's: nothing in nukernel/ reads it. test/sheets.js installed the
 * first copy of it on 2026-09-02; this file is now that copy's only owner and
 * sheets.js requires it from here.
 */

/* THE PAGE-SIDE HALF, as a function so playwright can serialise it. It must
   stand entirely on its own: nothing outside its own body is in scope. */
function INSTALL() {
  const box = (n) => n && (n.closest(".nu-combo") || n.parentElement);
  const opts = (n) => {
    const b = box(n);
    return b ? [...b.querySelectorAll("li[role=option]")] : [];
  };
  /* WHICH OF THE THREE THIS IS, off the artifact. `data-widget` is stamped by
     nukernel/src/menus/index.ts on the addressed element; the two fallbacks
     read the shape, so a control drawn before that stamp existed (a harness
     page's own `<select>`) still answers. */
  const widget = (n) => {
    if (!n) return null;
    const w = n.dataset && n.dataset.widget;
    if (w) return w;
    if (n.getAttribute("role") === "combobox") return "combo";
    if (n.classList && n.classList.contains("nu-wchips")) return "chips";
    if (n.classList && n.classList.contains("nu-lzfield")) return "lozenge";
    return "native";
  };
  const chips = (n) => [...n.querySelectorAll(".nu-wchip")];
  /* ...AND THE FOURTH WIDGET, 2026-09-05 (DESIGN.md component 16). A lozenge
     field is a strip of chips that knows what KIND each of its words is and
     draws every one of them at once, under a heading per kind. It carries the
     same `data-sel` / `data-k` / `data-v` and says `data-widget="lozenge"`, so
     this driver reads it the way it reads the other three: by address and by
     widget, never by tag. A FOLDED CLUSTER'S WORDS ARE STILL WORDS — they are
     in the DOM, `hidden`, and `words()` is a census of what is OFFERED, not of
     what is on the glass this second (which is what the browser gates measure
     with a rect). `say()` unfolds first, because a thumb would. */
  const lozs = (n) => [...n.querySelectorAll(".nu-lz")];
  const unfold = (el) => {
    const sec = el && el.closest(".nu-lzcluster");
    const head = sec && sec.querySelector(".nu-lzhead");
    if (head && head.getAttribute("aria-expanded") === "false") head.click();
  };
  window.__combo = {
    widget,
    is: (n) => !!n && n.getAttribute("role") === "combobox",
    /* ONE ROW PER OFFERED WORD, in the shape the gates' checks already read —
       `{ v, w, off, quiet, why, on }` — whichever element it came off. `w` is
       the word the option prints, which is what a filter matches on; `quiet` is
       the softer refusal (`is-quiet`), which the NO SILENT GREY scans count
       beside the hard one. */
    words: (n) => {
      if (!n) return [];
      const kind = widget(n);
      if (kind === "lozenge")
        return lozs(n).map((c) => ({
          v: c.dataset.v == null ? "" : c.dataset.v,
          w: (c.querySelector(".nu-lzword") || c).textContent,
          off: c.disabled || c.getAttribute("aria-disabled") === "true",
          quiet: c.classList.contains("is-quiet"),
          why: c.dataset.why || "",
          ph: c.hasAttribute("data-placeholder"),
          on: c.getAttribute("aria-pressed") === "true" }));
      if (kind === "chips")
        return chips(n).map((c) => ({
          v: c.dataset.v == null ? "" : c.dataset.v,
          w: c.textContent, off: c.disabled ||
             c.getAttribute("aria-disabled") === "true",
          quiet: c.classList.contains("is-quiet"),
          why: c.dataset.why || "",
          ph: c.hasAttribute("data-placeholder"),
          on: c.getAttribute("aria-pressed") === "true" }));
      if (kind !== "combo")
        return [...n.querySelectorAll("option")].map((o) => ({
          v: o.dataset.v == null ? o.value : o.dataset.v,
          w: o.textContent, off: o.disabled,
          quiet: o.classList.contains("is-quiet"),
          why: o.dataset.why || "",
          ph: o.hasAttribute("data-placeholder"), on: o.selected }));
      return opts(n).map((o) => ({
        v: o.dataset.v == null ? "" : o.dataset.v,
        w: o.textContent,
        off: o.getAttribute("aria-disabled") === "true",
        quiet: o.classList.contains("is-quiet"),
        why: o.dataset.why || "",
        ph: o.hasAttribute("data-placeholder"),
        on: o.getAttribute("aria-selected") === "true" }));
    },
    /* WHETHER THE WORD IS REFUSED, without saying it — so a grey-out check
       does not have to write into the record to find out. */
    refused: (n, v) => {
      const r = window.__combo.words(n).find((x) => x.v === String(v));
      return !r || r.off;
    },
    /* SAY ONE. Returns true only if the value is standing afterwards. */
    say: (n, v) => {
      if (!n || n.disabled) return false;
      const want = String(v);
      const kind = widget(n);
      /* A STRIP IS SAID BY TAPPING ITS CHIP, which is the only gesture it has.
         There is no list to open and nothing to type, which is the whole of why
         a vocabulary of eight is drawn this way. */
      if (kind === "lozenge") {
        const c = lozs(n).find((x) => (x.dataset.v == null ? "" : x.dataset.v) === want);
        if (!c || c.disabled || c.getAttribute("aria-disabled") === "true") return false;
        unfold(c);
        c.click();
        return String(n.dataset.v) === want ||
               c.getAttribute("aria-pressed") === "true";
      }
      if (kind === "chips") {
        const c = chips(n).find((x) => (x.dataset.v == null ? "" : x.dataset.v) === want);
        if (!c || c.disabled || c.getAttribute("aria-disabled") === "true") return false;
        c.click();
        return String(n.dataset.v) === want;
      }
      if (kind !== "combo") {
        const o = [...n.options].find(
          (x) => (x.dataset.v == null ? x.value : x.dataset.v) === want);
        if (!o || o.disabled) return false;
        n.value = o.value;
        n.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      const li = opts(n).find((o) => (o.dataset.v == null ? "" : o.dataset.v) === want);
      if (!li || li.getAttribute("aria-disabled") === "true") return false;
      try {
        n.dispatchEvent(new PointerEvent("pointerdown",
          { bubbles: true, cancelable: true }));
      } catch (e) { /* a browser with no PointerEvent still has step 3 */ }
      if (n.getAttribute("aria-expanded") !== "true") { try { n.focus(); } catch (e) {} }
      li.click();
      if (String(n.dataset.v) !== want) {          // step 3, written down above
        n.value = want;
        n.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return String(n.dataset.v) === want;
    },
  };
}

/* ---- the node-side half ------------------------------------------------ */

/** Put `window.__combo` on the page. Idempotent; call it after every goto. */
async function installCombo(p) { await p.evaluate(INSTALL); }

/** The one query a menu is found by: its ADDRESS, never its tag. */
const AT = (sel) => '[data-sel="' + sel.replace(/"/g, '\\"') + '"]';

/** Say `v` at the menu whose `data-sel` is `sel`. Resolves to true if it took. */
async function sayCombo(p, sel, v, ms) {
  const hit = await p.evaluate(([s, val]) => {
    const n = document.querySelector('[data-sel="' + CSS.escape(s) + '"]');
    return n ? window.__combo.say(n, val) : false;
  }, [sel, v]);
  await p.waitForTimeout(ms == null ? 600 : ms);
  return hit;
}

/** The words a menu offers, read off the rendered page. */
async function comboWords(p, sel) {
  return p.evaluate((s) => {
    const n = document.querySelector('[data-sel="' + CSS.escape(s) + '"]');
    return n ? window.__combo.words(n) : [];
  }, sel);
}

module.exports = { INSTALL, installCombo, sayCombo, comboWords, AT };

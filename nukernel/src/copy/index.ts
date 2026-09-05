// nukernel/src/copy/index.ts — THE ENTRY. `node tools/ui/build.js` bundles
// this directory into the committed `nukernel/ui/copy.js`.
//
// TWO DOORS, ONE TABLE, because this page is half ES modules and half classic
// scripts and both print words:
//
//   · A MODULE imports it:            import { t, fmt } from "./copy.js";
//   · A CLASSIC SCRIPT reads it off the global the module sets:
//                                     COPY.t("cell.default")
//
// `nukernel/fields.js`, `avail.js`, `rules.js` and `atlas.js` are plain
// <script> files (index.html loads them before any module runs), so they hold
// KEYS in their tables and call `COPY.t` at the moment a value is printed —
// which is always after the modules have loaded. Nothing in this page prints a
// word before `ui/eight.js` has run.
//
// A BUNDLE (src/table, src/envelope, src/menus) reaches the SAME table through
// `./global.js` rather than importing this file, so the catalogue is bundled
// exactly once, into ui/copy.js, and never a second time into ui/table.js.

import { make, fmt, missing, produced } from "./api.js";
import { STRINGS } from "./strings.js";
export type { Params, Table } from "./api.js";

const { t, tn, has } = make(STRINGS);

export { t, tn, has, fmt, missing, produced, STRINGS };

/* ===== STAMPING THE DOCUMENT'S OWN WORDS ==============================
   nukernel/index.html ships three strings in its markup (a landmark's name, a
   panel heading, the log's name) and a plain document cannot call `t()`. So
   the element names its KEY and this fills it once, on load:

     <h2 id="atlasHead" data-copy="shell.where">Where &amp; when</h2>
     <nav id="nu-chrome" data-copy-aria="shell.chrome"></nav>

   The text stays in the HTML as the no-script reading; the catalogue is what
   the page actually shows, so a second language reaches the shell too. */
function stamp(): void {
  const d = globalThis.document;
  if (!d) return;
  const go = () => {
    for (const el of Array.from(d.querySelectorAll("[data-copy]")))
      el.textContent = t(el.getAttribute("data-copy") || "");
    for (const el of Array.from(d.querySelectorAll("[data-copy-aria]")))
      el.setAttribute("aria-label", t(el.getAttribute("data-copy-aria") || ""));
    for (const el of Array.from(d.querySelectorAll("[data-copy-title]")))
      el.setAttribute("title", t(el.getAttribute("data-copy-title") || ""));
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}

/* THE GLOBAL. One assignment, made when this module is evaluated; the classic
   scripts and the gates read it. `Object.freeze` on the table itself is the
   one-owner law said in the runtime: nothing patches a string in place. */
Object.freeze(STRINGS);
(globalThis as unknown as { COPY: unknown }).COPY =
  { t, tn, has, fmt, missing, produced, STRINGS };

stamp();

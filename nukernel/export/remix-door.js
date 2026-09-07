// nukernel/export/remix-door.js — THE PIPELINE, FETCHED ON THE FIRST PRESS.
//
// docs/REMIX.md §"The seam the UI door must implement" ends: *"A door loads
// twenty-five classic <script> tags and makes one call."* Seventeen of the
// twenty-five are already on the page — nukernel/index.html loads them at boot
// — so what is left is the EIGHT files of the pipeline plus the one app file
// index.html does not carry, and this module is the loader for those nine and
// nothing else. It exports `loadPipeline()`, which resolves to
// `window.NuRemix`, and that is its whole surface: the door in ui/eight.js
// owns the card, the copy, the status line and the landing.
//
// WHY CLASSIC <script> AND NOT `import()`. All nine are UMD IIFEs — they
// publish `window.NuMineMidi`, `window.NuRemix` and so on and export nothing
// — so `import()` gets an empty module namespace and a global that appeared by
// side effect. `<script src=…>` is what they are written for, and it is also
// the only loader that keeps them SHARED: two of them (tools/remix.js and
// tools/genealogy.js) both declare a top-level `sum`, and test/remix.browser.js
// B1 is the measurement that an IIFE per file is what makes that legal.
//
// WHY THEY ARE NOT LOADED AT BOOT. 449 KB — 217 of it nukernel/genres-tables.js
// — for a control most sessions never press. The precedent is the WAV card,
// which reaches for ../export/wav.js on the press and not before; this is the
// same move with the one difference the file format forces.
//
// WHY genres-tables.js IS IN THE LIST. It is the one app-tier file
// nukernel/index.html does NOT load, and `tools/remix.js` destructures it at
// LOAD time (`const T = root.NuGenreTables`), so the pipeline throws on the
// script tag rather than on the call without it. It is asked for by a URL
// relative to THIS FILE, so the page works at /nukernel/index.html and at the
// flat root copy tools/deploy/deploy-nukernel-staging.sh also ships.
//
// THE ORDER IS test/remix.browser.js `PIPE`'s ORDER, which is the reference
// implementation of this door. If a tenth file joins the pipeline it joins
// that list, this one, and the third rsync in the deploy script — three
// places, named in each of them, because a page cannot 404 quietly.

/** the nine, in load order, as URLs relative to this module */
export const SCRIPTS = [
  "../genres-tables.js",
  "../../tools/theory.js",
  "../../tools/genealogy.js",
  "../../tools/mine/mine-midi.js",
  "../../tools/mine/mine-melody.js",
  "../../tools/mine/mine-groove.js",
  "../../tools/genres/grammar.js",
  "../../tools/genres/emit.js",
  "../../tools/remix.js",
];

/** what each script must have published by the time it fires `load` — so a
 *  file that arrives as a 404 body, or an HTML error page with a 200 on it,
 *  is caught HERE and named, rather than surfacing three seconds later as
 *  `NuRemix is undefined` inside the call. */
const PUBLISHES = {
  "../genres-tables.js": "NuGenreTables",
  "../../tools/theory.js": "NuTheory",
  "../../tools/genealogy.js": "NuGenealogy",
  "../../tools/mine/mine-midi.js": "NuMineMidi",
  "../../tools/mine/mine-melody.js": "NuMineMelody",
  "../../tools/mine/mine-groove.js": "NuMineGroove",
  "../../tools/genres/grammar.js": "NuGenreGrammar",
  "../../tools/genres/emit.js": "NuGenreEmit",
  "../../tools/remix.js": "NuRemix",
};

const href = (rel) => new URL(rel, import.meta.url).href;

/* ONE TAG PER FILE, AND THE SAME TAG IF IT IS ALREADY THERE. A second press
   while the first is still fetching must not start a second download of
   449 KB, and a press after a finished load must not re-run nine IIFEs over
   the globals they already published. Both are the same rule — a script that
   has a node in the document is a script this door has already asked for —
   so the promise is cached on the element itself. */
const pending = new Map();

function inject(rel) {
  if (pending.has(rel)) return pending.get(rel);
  const src = href(rel);
  const want = PUBLISHES[rel];
  const p = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;                 // order matters: remix.js reads the rest
    s.addEventListener("load", () => {
      if (want && !window[want])
        rej(new Error(rel.replace(/^\.\.\//, "") + " loaded but published no " +
                      want + " — the file at " + src + " is not the one this " +
                      "door expects"));
      else res();
    });
    s.addEventListener("error", () =>
      rej(new Error("the remix pipeline is not on this server — " + src +
                    " could not be loaded")));
    document.head.appendChild(s);
  });
  pending.set(rel, p);
  return p;
}

/** Load the nine, in order, and hand back `window.NuRemix`. Idempotent: a
 *  second call after a finished load resolves on the globals already there
 *  without a request, and a second call DURING a load joins the first. */
export function loadPipeline() {
  if (window.NuRemix) return Promise.resolve(window.NuRemix);
  return SCRIPTS.reduce((chain, rel) => chain.then(() => inject(rel)),
                        Promise.resolve())
    .then(() => {
      if (!window.NuRemix)
        throw new Error("the remix pipeline loaded but published no NuRemix");
      return window.NuRemix;
    });
}

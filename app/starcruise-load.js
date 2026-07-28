// starcruise-load.js — THE DEFERRED LOADER for the aliens view.
//
// app/starcruise.js is ~48 KB gzipped, and its static data sibling
// app/starcruise/genre-clusters.js another ~9 KB — 57 KB that ONLY the aliens
// view needs. index.html therefore no longer carries the controller as a
// side-effecting <script type="module">; this ~1 KB module is the single place
// that pulls it in, on first entry to the view.
//
// THE CONTRACT
//   ensureStarcruise() -> Promise<window.__STARCRUISE | null>
// One in-flight import, cached forever after: cycling map → viz → aliens →
// map → … re-enters the view any number of times and the module is fetched and
// evaluated exactly once. A FAILED import clears the cache so a later attempt
// can retry rather than latching the view dead.
//
// TWO CALLERS
//   - app/panels.js, from the ✦ view cycle (the only production trigger).
//   - the headless gates, which await window.__ensureStarcruise() instead of
//     racing a click or polling for window.__STARCRUISE (test/probe-harness.js
//     ensureStarcruise(page) wraps it; gates that neutralise app/main.js never
//     evaluate panels.js, so they import THIS module directly).
// It deliberately imports nothing from the app (no state.js, hence no
// preact/htm) so it stays loadable in a bare headless page.
//
// embed.html never reaches the aliens view (its ✦ chip is hidden and inert), so
// an embed still never fetches a byte of the controller.

let pending = null;

export function ensureStarcruise() {
  if (pending) return pending;
  pending = import("./starcruise.js")
    .then(() => window.__STARCRUISE || null)
    .catch((e) => { pending = null; console.warn("[aliens] controller failed to load", e); return null; });
  return pending;
}

// starcruiseLoaded() — is the controller already resident? Lets a caller take
// the synchronous path (stop / isRunning on a view already running) without
// arming the import.
export function starcruiseLoaded() { return !!(window.__STARCRUISE && window.__STARCRUISE.start); }

window.__ensureStarcruise = ensureStarcruise;

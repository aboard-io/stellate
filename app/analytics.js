// analytics.js — GoatCounter settings shim (classic script, loads BEFORE
// vendor/goatcounter/count.js in index.html). Cookie-free, self-hosted,
// same-origin (/gc/ nginx proxy -> localhost GoatCounter; docs/HOSTING.md).
// ONLY the most basic stats (Paul 2026-07-25): pathname-only — the query
// string (seed/path/xdur/m) is both high-cardinality and someone's saved
// musical location; it never leaves the page.
window.goatcounter = {
  path: function () { return location.pathname; },
  allow_local: false
};

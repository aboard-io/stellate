// engine/genres-data.js — a 20-BYTE STUB WHERE 645 KB STOOD.
//
// Not an invention: nukernel/audio/plan.js:81 already says it in the browser,
// in the same words and for the same reason —
//   "genres-data.js (645 KB, the parent's 274 anchors) — zero reads anywhere in
//    nukernel; genre-kernel only walks it inside resolve/track/blend/deriveMind,
//    none of which this box calls. genre-kernel's init still wants the key to
//    exist, so a 20-byte stub stands where 645 KB stood."
// and does exactly this at plan.js:81 (`if (!W.__GENRES) W.__GENRES = { GENRES: {} }`).
//
// This file is that same line in the form CommonJS can see. engine/genre-kernel.js:26
// does `Object.assign({}, require("./genres-data.js"), require("./registry-data.js"))`
// EAGERLY under CJS — in a browser `module` is undefined so the require branch is
// never taken and the browser never noticed the file was pruned. A pure-node
// caller (tools/ableton/) takes that branch on the first import and dies with
// MODULE_NOT_FOUND before a note is exported. Twenty bytes ends that.
//
// If the parent's real 274-anchor table ever has to come back, it comes back
// from `git show main:engine/genres-data.js` and this comment is what tells you
// nothing in nukernel was reading it.
module.exports = { GENRES: {} };

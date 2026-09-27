// tools/move/schwung/entry.cjs — everything the on-Move tool needs, in one require tree, so
// esbuild can hand QuickJS a single file. The nukernel tier is required rather than imported
// because every file in it ends `module.exports = api` under CommonJS.
//
// `wiki` is NOT nukernel/wiki.js here. That file is 249 KB of citations for about 14 KB of
// names, and the whole bundle has to sit in a Schwung module, so build.js lifts just the
// names into genre-names.js and this wraps them in the same name(key) shape
// nukernel/export/move.js asks for.
"use strict";
const NAMES = require("./genre-names.js");
const M = require("../../../nukernel/export/move.js");
module.exports = {
  ns: {
    NG: require("../../../nukernel/genres.js"),
    K: require("../../../nukernel/kernel.js"),
    Doc: require("../../../nukernel/document.js"),
    P: require("../../../nukernel/precompose.js"),
    wiki: { name: (k) => NAMES[k] || null },
  },
  moveSet: M.moveSet, sections: M.sections, donorOk: M.donorOk, hasKit: M.hasKit,
};

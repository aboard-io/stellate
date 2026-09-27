// tools/move/nukernel-node.mjs — the ONE way this slice gets the nukernel tier without a
// browser. The CLI reads it and so does the gate, because a gate that re-derives its
// inputs its own way is checking two guesses against each other (the reason
// tools/ableton/score-node.mjs gives for existing).
//
// Every data file in nukernel/ ends `if (typeof module !== "undefined" && module.exports)
// module.exports = api; else root.NuX = api;`, so under CommonJS they publish to
// module.exports and never touch `window`. nukernel/export/move.js takes the tier as an
// argument rather than importing it, so unlike the .als side there is no window to fake:
// four requires and a `wiki` for the genre names is the whole bridge.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const NUKERNEL = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), "nukernel");

export function nukernel() {
  return {
    NG: require(path.join(NUKERNEL, "genres.js")),
    K: require(path.join(NUKERNEL, "kernel.js")),
    Doc: require(path.join(NUKERNEL, "document.js")),
    P: require(path.join(NUKERNEL, "precompose.js")),
    wiki: require(path.join(NUKERNEL, "wiki.js")),
  };
}

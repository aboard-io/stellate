
/* ---- the on-Move API, appended after the esbuild IIFE (__S) ----------------------------
 * ui.js talks to this and nothing else. It exists so the tool never reaches into nukernel
 * directly: everything below is one call into nukernel/export/move.js plus the bookkeeping
 * Move's Set list needs.
 */
const { ns: NS, moveSet: __moveSet, sections: __sections, donorOk, hasKit } = __S;

function genreList() { return __sections(NS).genreList(); }

/* index of Move's Track Presets: [{rel, name, cat}] (walk supplied by the caller) */
function indexPresets(files) {
  return files.filter((rel) => /\.json$/i.test(rel))
    .map((rel) => ({ rel, name: rel.split("/").pop().replace(/\.json$/i, ""), cat: rel.split("/").slice(0, -1).join("/") }));
}

/* base: a Set (JSON) whose tracks/mixer/master chain are the starting point
 * presets: null to keep base's instruments, or { index, load(rel) -> JSON|null } */
function makeSet(key, seed, base, presets) {
  const r = __moveSet(NS, base, key, seed, presets);
  return {
    name: r.name, abl: JSON.stringify(r.song, null, 2), songMode: JSON.stringify(r.songMode),
    sounds: r.sounds, picked: r.picked,
    scenes: r.plan.scenes.length, bpm: r.composed.bpm,
    bars: Math.round(r.plan.entries.reduce((n, e) => n + e.beats, 0) / 4),
  };
}

/* A Set is usable as the base when it has Move's 4 tracks x 8 slots with a kit on track 1. */
const templateOk = donorOk;

export { genreList, templateOk, indexPresets, makeSet };

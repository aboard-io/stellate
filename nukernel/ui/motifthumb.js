/* ui/motifthumb.js — a drum motif's picture in the bank (2026-09-14).

   Paul: *"I'd expect to see the motifs as sheet music or drum patterns."* The
   bank draws a line motif as its engraving (ui/eight.js `motifBank`, through
   the page's own `engrave`) and a drum motif as this: a small, still pattern,
   a row per struck lane and the steps across, the beat ruled. The editor an
   open motif shows is unchanged; this is only the picture you open it from. */

/** `lanes` { letter: 0..9[] }, `sidecar(k)` true for a lane that is not struck,
    `v7(d)` the document's level on the 0..7 face (ghost 1, accent 7). */
export function drumThumb(lanes, spb, pulse, sidecar, v7) {
  const box = document.createElement("span");
  box.className = "nu-dthumb";
  box.style.setProperty("--dt-cols", String(spb));
  for (const k of Object.keys(lanes).filter((l) => !sidecar(l))) {
    for (let i = 0; i < spb; i++) {
      const c = document.createElement("i");
      const v = v7(lanes[k][i] | 0);
      if (v) c.className = v >= 7 ? "is-acc" : v <= 1 ? "is-ghost" : "is-on";
      if (i % pulse === 0) c.classList.add("nu-dtbeat");
      box.append(c);
    }
  }
  return box;
}

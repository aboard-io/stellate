// nukernel/src/copy/ui.ts — THE WORDS THE DESIGN SYSTEM SAYS.
//
// Two small families and no third:
//   · `ui.*` — the strings the ELEMENTS themselves print or announce
//     (src/ui/**). An element's accessible name comes from the catalogue
//     (DESIGN.md §2), so a component that says anything at all says it from
//     here.
//   · `ui.gal.*` — the gallery's own headings (nukernel/design.html). A page
//     that is the design system may not be the one page on this site with its
//     words typed into it.
//
// THE VOICE IS DESIGN.md §4: plain, a musician's words, verbs for actions and
// nouns for things. A sentence beside a refused control is <= 12 words, which
// `test/copy.test.js` measures, and `ui.refused.*` is written to that limit.

import type { Table } from "./api.js";

export const UI: Table = {
  /* ---- what an element says ------------------------------------------
     A REFUSAL ALWAYS HAS WORDS. DESIGN.md component 14 says the reason has one
     owner and reaches a thumb; these two are what a control says when the
     caller gave it no sentence at all, so the silent grey is impossible even
     when a caller forgets. */
  "ui.refused.noReason": "Not available here.",
  "ui.refused.allRefused": "No other setting is available.",
  "ui.spin.prev": "{name}, step back",
  "ui.spin.next": "{name}, step forward",
  "ui.spin.now": "{name}: {value}, {n} of {of}",

  /* ---- the gallery --------------------------------------------------
     A HEADING IS A FACE (<= 6 words) AND A BLURB IS A SENTENCE (<= 12), which
     is DESIGN.md §4's own pair of numbers and `test/copy.test.js` C2's. The
     blurbs are keyed `.help` for the same reason `bar.play.aria` is keyed
     `.aria`: the suffix is what says which budget a string is held to. */
  "ui.gal.title": "Design system",
  "ui.gal.daylight": "Daylight",
  "ui.gal.palette": "The palette",
  "ui.gal.palette.help":
    "A panel and a screen. Only a lamp is saturated.",
  "ui.gal.grounds": "Grounds",
  "ui.gal.legends": "Legends",
  "ui.gal.lamps": "Lamps and the screen",
  "ui.gal.meanings": "Meanings",
  "ui.gal.greys": "Greys",
  /* "Players" alone is `rule.headPlayers`, a column of the rules deck. Two
     meanings a translator must be free to spell apart, so this one says which
     players it means: their hues. */
  "ui.gal.voices": "Player hues",
  "ui.gal.levels": "Level",
  "ui.gal.clusters": "Clusters",
  "ui.gal.contrast": "Contrast",
  "ui.gal.contrast.help":
    "Measured live. Text needs 4.5 to 1, an edge 3.",
  "ui.gal.foreground": "Colour",
  "ui.gal.asText": "As text — floor 4.5",
  "ui.gal.asEdge": "As an edge — floor 3",
  "ui.gal.scales": "The scales",
  "ui.gal.scales.help":
    "Six type steps, four weights, four radii, five steps of space.",
  "ui.gal.type": "Type",
  "ui.gal.weight": "Weight",
  "ui.gal.space": "Space",
  "ui.gal.space.help":
    "A hair, tight, a gap, air, a block. Nothing else.",
  "ui.gal.radius": "Radius",
  "ui.gal.geometry": "Geometry",
  "ui.gal.specimen": "Tempo 96 · key F minor",
  "ui.gal.elements": "The elements",
  "ui.gal.elements.help":
    "Every element in every state, from the table the code reads.",
  "ui.gal.keyboard": "Keyboard",
  "ui.gal.named": "Name",
  "ui.gal.refuses": "Refuses",
  "ui.gal.demo.why": "The record has no player to add this to.",
};

// starmap.js — the star chart, as five modules behind one import surface. This
// file IS the map's public API (app/main.js, app/panels/panels.js and
// app/entries/embed.js import it and nothing below it); the pieces are:
//
//   viewport.js  the #map <svg> handle + the ZOOM transform (k/pan, clamps, toXY)
//   layout.js    where the stars and paths go: ENERGY, REGIONS, computeGenreLayout,
//                autoPath, seedDefaultLoop — geometry, no input, no drawing
//   draw.js      drawMap(): the imperative SVG rebuild + the traveler's pulse rAF
//   gestures.js  the pointer state machine: drag/pan/pinch/scrub + waypoint editing
//   viz-zoom.js  the ⓘ panel's separate pinch/pan transform (side effects only)
//
// The dependency graph is acyclic and one-way — viewport ← layout ← draw ←
// gestures — so module evaluation order is fixed: viewport, layout, draw,
// gestures, viz-zoom. That is the same set of side effects the single file ran
// top-to-bottom (the svg handle, the pulse rAF, the resize/pointer/wheel
// listeners, window.__ZOOM/__VIZZOOM, the ENERGY table, the viz store sub); only
// the ENERGY table and window.__ZOOM now build a few statements earlier, and
// nothing reads either during evaluation.
export { ZOOM, clampZoom, zoomAround, centerView } from "./viewport.js";
export { drawMap, startPulse } from "./draw.js";
export { insertWaypoint } from "./gestures.js";
export { REGIONS, REGION_OF, computeRegions, computeGenreLayout, seedDefaultLoop, autoPath } from "./layout.js";
import "./viz-zoom.js";

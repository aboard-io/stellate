// ui/stepnav.js — RETIRED by the tracker rotation (Stage 2), kept as an
// import target so ui/main.js's layer-ordered import list stays true.
//
// The minimap existed because the UN-rotated phone editor could show only
// two or three of the eight lanes at once: it panned a fixed-height
// .lanesview over the lane stack with one translateY, and the map was both
// the overview and the pan control. The <560px editor is now a tracker TABLE
// — steps run top to bottom, the vectors are columns, and all sixteen rows
// live in one vertically scrolling view — so the table IS the overview, and
// a minimap of a plainly scrollable list is a second scrollbar with a
// second gesture. It retired rather than rotating; the viewport wrappers it
// panned (.lanesview/.lanes) left the DOM with it.
export {};

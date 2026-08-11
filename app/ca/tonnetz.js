// tonnetz.js — THE WALK: the seed's four nibbles read as a P·L·R word, drawn on
// the lattice where those moves are literally adjacent.
//
// WHY A TONNETZ AND NOT A LIST OF CHORD NAMES. "Em E Em E" tells you nothing
// about why those chords belong together. On the Tonnetz — the lattice where
// moving right is a fifth and moving up-right is a major third — every triad is
// a triangle, and P, L and R are the three ways of FLIPPING a triangle across
// one of its edges. The two triads keep two notes and move one. So a PLR word
// is a path of edge-adjacent triangles, and the picture says what the names
// cannot: this progression is smooth because it barely moves.
//
// The lattice is a torus, so every triad appears at many lattice positions. The
// drawing picks, for each chord, the occurrence NEAREST THE PREVIOUS ONE — which
// is what makes an adjacent move look adjacent instead of teleporting across the
// diagram. That choice is cosmetic; the harmony is the same either way.
import { DOC, edit, resolved, subs } from "./doc.js";

const CA = window.CsdCA;
const NS = "http://www.w3.org/2000/svg";
const U = -3, U2 = 3, V = -2, V2 = 2;          // lattice extent
const W = 46, H = 40;                          // node spacing

let host = null, keyHost = null;
const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
const px = (u, v) => [u * W + v * (W / 2), -v * H];
const mod12 = (n) => ((n % 12) + 12) % 12;
// the pitch class at lattice node (u,v): right is a fifth, up-right a major third
const pcAt = (u, v) => mod12(7 * u + 4 * v + DOC.key);

// An UP triangle {(u,v),(u+1,v),(u,v+1)} is the major triad rooted at (u,v);
// the DOWN triangle beside it is the minor triad rooted a major third above.
function tri(u, v, min) {
  const ns = min ? [[u + 1, v], [u, v + 1], [u + 1, v + 1]] : [[u, v], [u + 1, v], [u, v + 1]];
  const pts = ns.map(([a, b]) => px(a, b));
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  return { pts, cx, cy, root: min ? mod12(pcAt(u, v) + 4) : pcAt(u, v), min };
}

export function build(h, kh) {
  host = h; keyHost = kh;
  keyHost.textContent = "";
  for (let k = 0; k < 12; k++) {
    // twelve chips read as a KEYBOARD, which is why this row stays chips rather
    // than becoming a table (the /daw control vocabulary's own exception)
    const b = document.createElement("button");
    b.type = "button"; b.className = "ca-chip ca-keychip" + (CA.PC[k].length > 1 ? " sharp" : "");
    b.textContent = CA.PC[k];
    b.addEventListener("click", () => edit({ key: k }));
    keyHost.appendChild(b);
  }
}

export function paint() {
  if (!host) return;
  for (const b of keyHost.children) b.classList.toggle("on", b.textContent === CA.PC[DOC.key]);

  const word = CA.word(DOC.seed);
  const walk = CA.triads(DOC.seed, DOC.key);      // the four triads, in order

  const svg = el("svg", { viewBox: "-205 -105 410 210", class: "ca-ton", role: "img" });
  svg.setAttribute("aria-label", "Tonnetz: " + walk.map(CA.triadName).join(", ")
    + " via " + word.map((o) => CA.LETTER[o]).join(" "));

  // every triangle, faint — the space the walk moves through
  const gBg = el("g", { class: "ca-tbg" });
  for (let u = U; u < U2; u++) for (let v = V; v < V2; v++) for (const m of [false, true]) {
    const t = tri(u, v, m);
    gBg.appendChild(el("polygon", { points: t.pts.map((p) => p.join(",")).join(" ") }));
  }
  svg.appendChild(gBg);

  // CHOOSE THE OCCURRENCES: for each chord, the lattice triangle nearest the one
  // before it. The first is the one nearest the centre of the diagram.
  const chosen = [];
  let prev = { cx: 0, cy: 0 };
  for (const t of walk) {
    let best = null, bd = Infinity;
    for (let u = U; u < U2; u++) for (let v = V; v < V2; v++) {
      const c = tri(u, v, t.min);
      if (c.root !== t.pc) continue;
      const d = (c.cx - prev.cx) ** 2 + (c.cy - prev.cy) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { chosen.push(best); prev = best; }
  }

  // the path between centroids, then the triangles, then the step numbers
  if (chosen.length > 1) {
    svg.appendChild(el("polyline", { class: "ca-tpath",
      points: chosen.map((c) => c.cx.toFixed(1) + "," + c.cy.toFixed(1)).join(" ") }));
  }
  // DEDUPE BY TRIANGLE, not by step. A word like L P P P visits Em, E, Em, E —
  // two triangles, four steps — and drawing one marker per step stacked two
  // labels and two numbers in the same few pixels. A triangle is drawn once and
  // carries every step that lands on it ("1,3"), which also makes the shape of a
  // repeating walk legible: two triangles, four numbers.
  const byTri = new Map();
  chosen.forEach((c, i) => {
    const k = c.cx.toFixed(1) + "/" + c.cy.toFixed(1);
    if (!byTri.has(k)) byTri.set(k, { c, steps: [] });
    byTri.get(k).steps.push(i + 1);
  });
  for (const { c, steps } of byTri.values()) {
    const g = el("g", { class: "ca-tsel" + (c.min ? " min" : "") });
    g.appendChild(el("polygon", { points: c.pts.map((p) => p.join(",")).join(" ") }));
    const label = el("text", { x: c.cx.toFixed(1), y: (c.cy + 4).toFixed(1), class: "ca-tlab" });
    label.textContent = CA.PC[c.root] + (c.min ? "m" : "");
    g.appendChild(label);
    const num = el("text", { x: c.cx.toFixed(1), y: (c.cy - 8).toFixed(1), class: "ca-tnum" });
    num.textContent = steps.join(",");
    g.appendChild(num);
    svg.appendChild(g);
  }

  // the nodes last, so the pitch names sit on top of everything
  const gN = el("g", { class: "ca-tnode" });
  for (let u = U; u <= U2; u++) for (let v = V; v <= V2; v++) {
    const [x, y] = px(u, v);
    if (Math.abs(x) > 200) continue;
    gN.appendChild(el("circle", { cx: x, cy: y, r: 8 }));
    const t = el("text", { x, y: y + 3, class: "ca-tpc" });
    t.textContent = CA.PC[pcAt(u, v)];
    gN.appendChild(t);
  }
  svg.appendChild(gN);

  host.textContent = "";
  host.appendChild(svg);

  // the word, spelled out — and named when it is one of the three closures the
  // group is famous for, because "this one comes home in six" is the useful fact
  const w = word.map((o) => CA.LETTER[o]).join("");
  const NAMED = { LPLP: "hexatonic — home in 6", PLPL: "hexatonic — home in 6",
    PRPR: "octatonic — home in 8", RPRP: "octatonic — home in 8",
    RLRL: "descending fifths", LRLR: "ascending fifths" };
  const cap = document.createElement("p");
  cap.className = "ca-note";
  cap.textContent = word.map((o) => CA.LETTER[o]).join(" · ")
    + (NAMED[w] ? "  —  " + NAMED[w] : "")
    + (resolved().state.progression.caTriads.length ? "" : "");
  host.appendChild(cap);
}

subs.push(paint);

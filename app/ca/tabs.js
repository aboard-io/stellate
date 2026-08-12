// tabs.js — ONE SCREEN, FOUR SURFACES.
//
// The page had grown a header, a sticky seed block, an orbit, a section-count
// row, a footer, a 420px rail carrying four more panels, and a transport. On a
// desk that was a lot; on a phone it was a column you scrolled for ten seconds
// to reach the thing you wanted, which is the opposite of an instrument.
//
// So: the seed and what it makes are ALWAYS on top — that is the thing you play,
// and it must never leave the screen — and everything else takes turns in one
// pane below. Four tabs, one visible at a time, and the pane is the only element
// on the page that scrolls.
//
// PHONE AND DESK ARE THE SAME LAYOUT, just at different widths. The two-column
// rail is gone. It was a second arrangement to keep in sync with the first, and
// every fix had to be made twice — which is most of what "scattered" was.
//
// The tab is state in the URL (`?v=`) so a shared link opens on the surface you
// were using, and it is a real tablist: arrow keys move, Home/End jump.
const TABS = [
  ["song", "song", "the form the automaton grew"],
  ["rule", "rule", "how each cell decides to live"],
  ["harmony", "chords", "where the harmony comes from"],
  ["genre", "genre", "instruments, groove and progression"],
];

let host = null, panes = [], at = "song";
const subs = [];
export const onChange = (fn) => subs.push(fn);
export const current = () => at;

export function build(h) {
  host = h; host.textContent = "";
  panes = [...document.querySelectorAll("#caPane .ca-pane")];
  TABS.forEach(([id, label, hint], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ca-tab"; b.dataset.tab = id;
    b.setAttribute("role", "tab");
    b.title = hint;
    b.textContent = label;
    b.addEventListener("click", () => show(id));
    b.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d != null) { e.preventDefault(); show(TABS[(i + d + TABS.length) % TABS.length][0], true); }
      else if (e.key === "Home") { e.preventDefault(); show(TABS[0][0], true); }
      else if (e.key === "End") { e.preventDefault(); show(TABS[TABS.length - 1][0], true); }
    });
    host.appendChild(b);
  });
  const q = new URLSearchParams(location.search).get("v");
  show(TABS.some((t) => t[0] === q) ? q : "song");
}

export function show(id, focus) {
  at = id;
  for (const b of host.children) {
    const on = b.dataset.tab === id;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    // ROVING TABINDEX: one stop for the whole tablist, then arrows inside it —
    // otherwise a keyboard user tabs through four buttons to reach the pane
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  // `hidden` rather than display:none in CSS, so the pane is out of the
  // accessibility tree as well as off the screen — a screen reader should not
  // find three surfaces you are not looking at
  for (const p of panes) p.hidden = p.dataset.pane !== id;
  subs.forEach((f) => { try { f(id); } catch (e) {} });
}

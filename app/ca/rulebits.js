// rulebits.js — WHAT A RULE ACTUALLY IS: eight yes/no answers.
//
// "Rule 110" is a lottery ticket. 110 and 111 have nothing to do with each
// other, the number carries no meaning, and picking one from a wall of 256
// thumbnails is choosing a texture without ever learning what you chose.
//
// But an elementary CA rule is not mysterious. A cell looks at its LEFT
// neighbour, ITSELF and its RIGHT neighbour — three cells, so eight possible
// situations — and for each situation the rule says one thing: does this cell
// live or die next generation? Eight situations, eight answers, one bit each.
// That is the whole of it, and it is 256 rules because 2^8 = 256.
//
// So this draws the eight situations as pictures and lets you flip any answer.
// Tap one and the rule number changes to match; the thumbnails and the orbit
// redraw under it. You are no longer picking 110 out of a hat — you are saying
// "a cell with a neighbour on each side should die", and watching what that
// does to the song.
//
// The eight are printed 111 → 000, the conventional Wolfram order, because the
// rule NUMBER is exactly those eight bits read as binary — so the row of
// switches literally spells the number, and that stops being a coincidence you
// have to be told about.
import { DOC, edit, subs } from "./doc.js";

const $ = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let host = null;

export function build(h) {
  host = h; host.textContent = "";
  for (let nb = 7; nb >= 0; nb--) {
    const b = $("button", "ca-nbr");
    b.type = "button"; b.dataset.nb = String(nb);
    // the three cells it is looking at
    const top = $("span", "ca-nbrtop");
    for (const bit of [(nb >> 2) & 1, (nb >> 1) & 1, nb & 1]) top.appendChild($("i", "ca-nbc" + (bit ? " on" : "")));
    b.appendChild(top);
    b.appendChild($("span", "ca-nbrarrow", "↓"));
    b.appendChild($("i", "ca-nbrout"));
    b.addEventListener("click", () => edit({ rule: (DOC.rule ^ (1 << nb)) & 255 }));
    host.appendChild(b);
  }
}

export function paint() {
  if (!host) return;
  for (const b of host.children) {
    const nb = +b.dataset.nb, on = (DOC.rule >>> nb) & 1;
    b.classList.toggle("on", !!on);
    b.querySelector(".ca-nbrout").className = "ca-nbrout" + (on ? " on" : "");
    const nbs = ["off", "on"];
    b.title = `left ${nbs[(nb >> 2) & 1]}, self ${nbs[(nb >> 1) & 1]}, right ${nbs[nb & 1]} → ${on ? "lives" : "dies"}`;
    b.setAttribute("aria-label", b.title + ". Tap to flip.");
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

subs.push(paint);

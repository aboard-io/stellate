// pipepanel.js — the note-fx rack surface: which transforms run, in what order.
//
// Everything visible here comes from the engine's own registry, tooltips included
// (machines/pipes.js). The only judgement in this file is layout.
import { subs } from "./song.js";
import { makeVector } from "./vector.js";
import * as PIPES from "./machines/pipes.js";

let host = null;
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

export function buildPipes(root) {
  host = root;
  paintPipes();
  subs.push(paintPipes);
  return root;
}

export function paintPipes() {
  if (!host) return;
  host.textContent = "";

  const head = el("div", "dw-fhead");
  head.appendChild(el("span", "dw-fname", "note fx"));
  head.appendChild(el("span", "dw-fhint",
    "transforms on the notes, in order — order is audible: each one draws its own stream and sees what the last one left"));
  if (PIPES.isEdited()) {
    const rev = el("button", "dw-mini", "reset fx");
    rev.addEventListener("click", () => PIPES.revert());
    head.appendChild(rev);
  }
  host.appendChild(head);

  const body = el("div", "dw-pbody");
  const on = PIPES.active();

  // the CHAIN, in order
  const chain = el("div", "dw-pchain");
  if (!on.length) chain.appendChild(el("p", "dw-pnote", "No note fx on this song. Add one below."));
  on.forEach((spec, i) => {
    const card = el("div", "dw-pcard");
    const h = el("div", "dw-pcardhead");
    h.appendChild(el("span", "dw-pord", String(i + 1)));
    h.appendChild(el("span", "dw-pname", spec.id));
    const up = el("button", "dw-mini", "↑"); up.title = "earlier in the chain";
    up.addEventListener("click", () => PIPES.move(spec.id, -1));
    const dn = el("button", "dw-mini", "↓"); dn.title = "later in the chain";
    dn.addEventListener("click", () => PIPES.move(spec.id, 1));
    const off = el("button", "dw-mini", "remove");
    off.addEventListener("click", () => PIPES.toggle(spec.id));
    h.appendChild(up); h.appendChild(dn); h.appendChild(off);
    card.appendChild(h);

    const knobs = PIPES.knobsOf(spec);
    if (knobs.length) {
      const vh = el("div", "dw-opvec");
      card.appendChild(vh);
      const v = makeVector(vh, { size: 180, hue: 300,
        onCommit: (id, val) => PIPES.setParam(spec.id, id, val) });
      v.set(knobs);
      const leg = el("div", "dw-flegend");
      for (const k of knobs) {
        const r = el("div", "dw-fleg");
        r.innerHTML = `<span class="dw-flegname">${k.label}</span><span class="dw-flegval">${(+k.raw).toFixed(2)}</span>`;
        leg.appendChild(r);
      }
      card.appendChild(leg);
    }
    chain.appendChild(card);
  });
  body.appendChild(chain);

  // the SHELF: everything the registry offers, with the engine's own descriptions
  const shelf = el("div", "dw-pshelf");
  for (const r of PIPES.registry()) {
    const b = el("button", "dw-pchip" + (PIPES.isOn(r.id) ? " on" : ""), r.id);
    b.title = r.doc;
    b.setAttribute("aria-pressed", PIPES.isOn(r.id) ? "true" : "false");
    b.addEventListener("click", () => PIPES.toggle(r.id));
    shelf.appendChild(b);
  }
  body.appendChild(shelf);
  host.appendChild(body);
}

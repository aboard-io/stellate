// orbit.js — THE MULTILAYERED RADAR. Everything in one chart: genre at the
// centre, then chords · pad · drums · bass · melody · samples outward. Zoom in and
// out to move between layers; the focused ring is the one you edit.
//
// WHY CONCENTRIC RINGS RATHER THAN SEPARATE PANELS. A song is not seven unrelated
// settings pages, it is a genre with things made out of it. Nesting says that:
// the centre is what the music IS, and each ring out is a decision made inside the
// one before it. Zooming never navigates AWAY — the other rings stay on screen, so
// you always know where you are in the stack.
//
// THE FOCUS MODEL. Radius is shared out by weight: the focused ring takes most of
// it and shows labelled, draggable handles; the rest compress to thin rings that
// still draw their own shape, so you can see at a glance that the drums are busy
// while you are editing the bass. Zoom is the wheel, a pinch, the +/− keys, or a
// click/tap on any ring — four ways in because this has to work on a phone.
//
// Only the FOCUSED ring is interactive. A radar where every ring accepts a drag
// would be unusable with a thumb, and would make "which layer am I editing?"
// ambiguous at exactly the moment it matters.
const TAU = Math.PI * 2;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function makeOrbit(host, opts) {
  const o = Object.assign({ size: 460, onCommit: null, onFocus: null }, opts || {});
  let layers = [], focus = 0, dragging = -1, dragAxis = -1;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "dw-orbit");
  svg.setAttribute("viewBox", `0 0 ${o.size} ${o.size}`);
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Song layers — genre at the centre, tracks outward");
  host.appendChild(svg);

  const C = o.size / 2;
  const RMAX = C - 34;

  // radius bands: focused ring gets the lion's share, the rest a thin slice each
  function bands() {
    const w = layers.map((_, i) => (i === focus ? 1 : 0.16));
    const tot = w.reduce((a, b) => a + b, 0);
    const out = []; let at = 0.10;                 // a small hole in the middle
    for (let i = 0; i < layers.length; i++) {
      const h = (w[i] / tot) * (1 - 0.10);
      out.push({ r0: at * RMAX, r1: (at + h) * RMAX });
      at += h;
    }
    return out;
  }

  const ang = (i, n) => -Math.PI / 2 + (i * TAU) / n;
  const pt = (a, r) => [C + Math.cos(a) * r, C + Math.sin(a) * r];

  function draw() {
    if (!layers.length) { svg.textContent = ""; return; }
    const B = bands(), parts = [];

    layers.forEach((L, li) => {
      const b = B[li], mid = (b.r0 + b.r1) / 2, isF = li === focus;
      const axes = L.axes || [];
      const n = Math.max(3, axes.length);

      // the ring itself is the hit target for zooming to that layer
      parts.push(`<circle cx="${C}" cy="${C}" r="${b.r1.toFixed(1)}" class="dw-oring${isF ? " on" : ""}" ` +
        `data-layer="${li}" style="--hue:${L.hue}"/>`);

      if (!axes.length) return;
      // each layer draws its own shape, focused or not — a compressed ring you can
      // still read is the whole point of keeping them on screen
      const poly = axes.map((a, i) => {
        const r = b.r0 + (b.r1 - b.r0) * (isF ? c01(a.v) : 0.15 + 0.7 * c01(a.v));
        return pt(ang(i, n), r).map((v) => v.toFixed(1)).join(",");
      }).join(" ");
      parts.push(`<polygon points="${poly}" class="dw-opoly${isF ? " on" : ""}" style="--hue:${L.hue}"/>`);

      if (!isF) {
        // the layer's name rides its ring, small
        const p = pt(-Math.PI / 2, mid);
        parts.push(`<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" class="dw-olab" ` +
          `text-anchor="middle" style="--hue:${L.hue}">${L.label}</text>`);
        return;
      }

      // FOCUSED: spokes, wedge hit targets, handles, labels
      for (let i = 0; i < axes.length; i++) {
        const a0 = ang(i, axes.length) - Math.PI / axes.length, a1 = ang(i, axes.length) + Math.PI / axes.length;
        const q0 = pt(a0, b.r1), q1 = pt(a1, b.r1), i0 = pt(a0, b.r0), i1 = pt(a1, b.r0);
        parts.push(`<path class="dw-ohit" data-axis="${i}" d="M${i0[0].toFixed(1)} ${i0[1].toFixed(1)} ` +
          `L${q0[0].toFixed(1)} ${q0[1].toFixed(1)} A${b.r1.toFixed(1)} ${b.r1.toFixed(1)} 0 0 1 ${q1[0].toFixed(1)} ${q1[1].toFixed(1)} ` +
          `L${i1[0].toFixed(1)} ${i1[1].toFixed(1)} A${b.r0.toFixed(1)} ${b.r0.toFixed(1)} 0 0 0 ${i0[0].toFixed(1)} ${i0[1].toFixed(1)} Z"/>`);
        const s0 = pt(ang(i, axes.length), b.r0), s1 = pt(ang(i, axes.length), b.r1);
        parts.push(`<line x1="${s0[0].toFixed(1)}" y1="${s0[1].toFixed(1)}" x2="${s1[0].toFixed(1)}" y2="${s1[1].toFixed(1)}" class="dw-ospoke"/>`);
      }
      axes.forEach((a, i) => {
        const r = b.r0 + (b.r1 - b.r0) * c01(a.v);
        const p = pt(ang(i, axes.length), r);
        parts.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" class="dw-odot${dragAxis === i ? " live" : ""}" ` +
          `style="--hue:${L.hue}" data-axis="${i}" tabindex="0" role="slider" aria-label="${L.label} ${a.label}" ` +
          `aria-valuemin="0" aria-valuemax="1" aria-valuenow="${a.v.toFixed(2)}" aria-valuetext="${Math.round(a.v * 100)}%"/>`);
        const lp = pt(ang(i, axes.length), b.r1 + 16), cx = Math.cos(ang(i, axes.length));
        parts.push(`<text x="${lp[0].toFixed(1)}" y="${lp[1].toFixed(1)}" class="dw-oaxlab" ` +
          `text-anchor="${cx > 0.3 ? "start" : cx < -0.3 ? "end" : "middle"}">${a.label}</text>`);
      });
    });

    svg.innerHTML = parts.join("");
  }

  // ---------- interaction ----------
  const local = (ev) => {
    const r = svg.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * o.size, ((ev.clientY - r.top) / r.height) * o.size];
  };
  function axisAt(x, y, n) {
    let a = Math.atan2(y - C, x - C) + Math.PI / 2;
    while (a < 0) a += TAU;
    return Math.round((a / TAU) * n) % n;
  }
  function valueAt(x, y) {
    const b = bands()[focus];
    return c01((Math.hypot(x - C, y - C) - b.r0) / Math.max(1, b.r1 - b.r0));
  }

  svg.addEventListener("pointerdown", (ev) => {
    const [x, y] = local(ev);
    const b = bands(), d = Math.hypot(x - C, y - C);
    // outside the focused band? treat it as ZOOM TO THAT RING, not a drag
    const f = b[focus];
    if (d < f.r0 || d > f.r1) {
      const hit = b.findIndex((band) => d >= band.r0 && d <= band.r1);
      if (hit >= 0 && hit !== focus) setFocus(hit);
      return;
    }
    const L = layers[focus];
    if (!L || !L.axes.length) return;
    dragging = focus; dragAxis = axisAt(x, y, L.axes.length);
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
    L.axes[dragAxis].v = valueAt(x, y);
    draw();
  });
  svg.addEventListener("pointermove", (ev) => {
    if (dragging < 0) return;
    const [x, y] = local(ev);
    layers[focus].axes[dragAxis].v = valueAt(x, y);
    draw(); ev.preventDefault();
  });
  const end = (ev) => {
    if (dragging < 0) return;
    const L = layers[focus], a = L.axes[dragAxis];
    dragging = -1; dragAxis = -1; draw();
    o.onCommit && o.onCommit(L.id, a.id, a.v);
    try { svg.releasePointerCapture(ev.pointerId); } catch (e) {}
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);

  // wheel zooms through the stack — one layer per notch, not a continuous scale,
  // because there is nothing between layers to land on
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    setFocus(focus + (ev.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  svg.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (ev.key === "+" || ev.key === "=") { setFocus(focus + 1); ev.preventDefault(); return; }
    if (ev.key === "-" || ev.key === "_") { setFocus(focus - 1); ev.preventDefault(); return; }
    if (!t || t.dataset.axis == null) return;
    const i = +t.dataset.axis, L = layers[focus], a = L && L.axes[i];
    if (!a) return;
    const step = ev.shiftKey ? 0.1 : 0.02;
    let v = a.v;
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") v += step;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") v -= step;
    else if (ev.key === "Home") v = 0;
    else if (ev.key === "End") v = 1;
    else return;
    ev.preventDefault();
    a.v = c01(v); draw();
    const again = svg.querySelector(`.dw-odot[data-axis="${i}"]`);
    if (again && again.focus) again.focus();
    o.onCommit && o.onCommit(L.id, a.id, a.v);
  });

  function setFocus(i) {
    const n = layers.length;
    const next = Math.max(0, Math.min(n - 1, i));
    if (next === focus) return;
    focus = next; draw();
    o.onFocus && o.onFocus(layers[focus] && layers[focus].id, focus);
  }

  return {
    el: svg,
    set(next) { if (dragging < 0) { layers = next.map((l) => Object.assign({}, l, { axes: l.axes.map((a) => Object.assign({}, a)) })); draw(); } },
    focus: () => (layers[focus] && layers[focus].id) || null,
    focusIndex: () => focus,
    setFocus,
  };
}

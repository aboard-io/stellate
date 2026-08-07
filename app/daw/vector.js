// vector.js — THE EDITABLE VECTOR DISPLAY. A radar you drag, built touch-first.
//
// Reused by two surfaces: the feel editor (drag an axis, the song changes) and the
// genre sculptor (drag a target shape, the kernel finds the genres nearest it). It
// knows nothing about either — it draws a list of {id,label,v,kind} and reports
// drags back.
//
// MOBILE FIRST, and that is a real constraint rather than a slogan:
//   * POINTER EVENTS ONLY. One code path for touch, pen and mouse; setPointerCapture
//     keeps a drag alive when the finger leaves the small SVG, which is most drags
//     on a phone.
//   * touch-action:none on the surface, so a vertical drag EDITS instead of
//     scrolling the page — the single thing that makes or breaks a touch control.
//   * The whole wedge is the hit target, not the handle. A 44px-wide pie slice is
//     reachable with a thumb; an 8px dot is not. Grab-nearest-by-angle means you
//     never have to hit anything exactly.
//   * Drag maps to RADIUS from the centre, not to vertical travel, so the gesture
//     matches what you see and works at any rotation.
//   * No hover affordances anywhere — a phone has no hover. Labels are always on.

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function makeVector(host, opts) {
  const o = Object.assign({ size: 260, min: 0.06, hue: 190, onInput: null, onCommit: null }, opts || {});
  let axes = [], ghost = null, dragging = -1;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "dw-vec");
  svg.setAttribute("viewBox", `0 0 ${o.size} ${o.size}`);
  svg.setAttribute("role", "group");
  host.appendChild(svg);

  const C = o.size / 2, R = o.size / 2 - 30;
  const ang = (i, n) => -Math.PI / 2 + (i * TAU) / n;
  const pt = (i, n, r) => [C + Math.cos(ang(i, n)) * R * r, C + Math.sin(ang(i, n)) * R * r];

  function draw() {
    const n = axes.length;
    if (!n) { svg.textContent = ""; return; }
    const parts = [];
    // rings
    for (const r of [0.25, 0.5, 0.75, 1])
      parts.push(`<circle cx="${C}" cy="${C}" r="${(R * r).toFixed(1)}" class="dw-vring"/>`);
    // wedges: the HIT TARGETS, drawn first so everything else sits on top
    for (let i = 0; i < n; i++) {
      const a0 = ang(i, n) - Math.PI / n, a1 = ang(i, n) + Math.PI / n;
      const p0 = [C + Math.cos(a0) * R * 1.18, C + Math.sin(a0) * R * 1.18];
      const p1 = [C + Math.cos(a1) * R * 1.18, C + Math.sin(a1) * R * 1.18];
      parts.push(`<path class="dw-vhit${axes[i].kind === "indicator" ? " ind" : ""}" data-i="${i}" ` +
        `d="M${C} ${C} L${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${(R * 1.18).toFixed(1)} ${(R * 1.18).toFixed(1)} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z"/>`);
    }
    // spokes
    for (let i = 0; i < n; i++) {
      const e = pt(i, n, 1);
      parts.push(`<line x1="${C}" y1="${C}" x2="${e[0].toFixed(1)}" y2="${e[1].toFixed(1)}" class="dw-vspoke"/>`);
    }
    // THE GHOST: the shape you asked for. The solid polygon is the shape the
    // space actually gave you. They differ because you are navigating real
    // genres, not setting parameters — showing both is the honest way to say so.
    if (ghost && ghost.length === n) {
      const gp = ghost.map((v, i) => pt(i, n, Math.max(o.min, clamp01(v))).map((x) => x.toFixed(1)).join(",")).join(" ");
      parts.push(`<polygon points="${gp}" class="dw-vghost"/>`);
    }
    // the value polygon
    const poly = axes.map((a, i) => pt(i, n, Math.max(o.min, clamp01(a.v))).map((v) => v.toFixed(1)).join(",")).join(" ");
    parts.push(`<polygon points="${poly}" class="dw-vpoly"/>`);
    // handles + labels
    for (let i = 0; i < n; i++) {
      const a = axes[i], p = pt(i, n, Math.max(o.min, clamp01(a.v)));
      parts.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${a.kind === "indicator" ? 3 : 5}" ` +
        `class="dw-vdot${a.kind === "indicator" ? " ind" : ""}${dragging === i ? " live" : ""}"/>`);
      const lp = pt(i, n, 1.3), c = Math.cos(ang(i, n));
      parts.push(`<text x="${lp[0].toFixed(1)}" y="${lp[1].toFixed(1)}" class="dw-vlab${a.kind === "indicator" ? " ind" : ""}" ` +
        `text-anchor="${c > 0.3 ? "start" : c < -0.3 ? "end" : "middle"}">${a.label}</text>`);
    }
    svg.innerHTML = parts.join("");
  }

  // ---------- pointer handling ----------
  // Nearest axis BY ANGLE, so a thumb anywhere in the wedge grabs the right spoke.
  function axisAt(x, y) {
    const n = axes.length;
    let a = Math.atan2(y - C, x - C) + Math.PI / 2;
    while (a < 0) a += TAU;
    const i = Math.round((a / TAU) * n) % n;
    return i;
  }
  function local(ev) {
    const r = svg.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * o.size, ((ev.clientY - r.top) / r.height) * o.size];
  }
  function valueAt(x, y) {
    return clamp01(Math.hypot(x - C, y - C) / R);
  }

  svg.addEventListener("pointerdown", (ev) => {
    const [x, y] = local(ev);
    const i = axisAt(x, y);
    if (!axes[i] || axes[i].kind === "indicator") return;   // indicators refuse the drag, visibly
    dragging = i;
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
    axes[i].v = valueAt(x, y);
    draw();
    o.onInput && o.onInput(axes[i].id, axes[i].v);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (dragging < 0) return;
    const [x, y] = local(ev);
    axes[dragging].v = valueAt(x, y);
    draw();
    o.onInput && o.onInput(axes[dragging].id, axes[dragging].v);
    ev.preventDefault();
  });
  const end = (ev) => {
    if (dragging < 0) return;
    const id = axes[dragging].id, v = axes[dragging].v;
    dragging = -1; draw();
    o.onCommit && o.onCommit(id, v);
    try { svg.releasePointerCapture(ev.pointerId); } catch (e) {}
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);

  return {
    el: svg,
    set(next) { if (dragging < 0) { axes = next.map((a) => Object.assign({}, a)); draw(); } },
    setGhost(vals) { ghost = vals ? vals.slice() : null; if (dragging < 0) draw(); },
    values() { return axes.map((a) => a.v); },
    ids() { return axes.map((a) => a.id); },
    // keyboard/AT path: the radar is a picture, so the panel also renders real
    // inputs beside it (panel.js). This is here so both drive one code path.
    setAxis(id, v) { const a = axes.find((x) => x.id === id); if (a) { a.v = clamp01(v); draw(); } },
  };
}

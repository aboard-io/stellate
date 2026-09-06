// nukernel/ui/envelope.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/envelope/ by `node tools/ui/build.js`.
// An edit made here is an edit the next build throws away, and
// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails
// until it is gone. Edit the TypeScript source and rebuild.
//
// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain
// files, nothing is vendored and nothing is fetched, and the page plays
// with the wire cut. Minify is OFF so this stays a reviewable diff.

// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = (t3) => t3;
var s = t.trustedTypes;
var e = s ? s.createPolicy("lit-html", { createHTML: (t3) => t3 }) : void 0;
var h = "$lit$";
var o = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n = "?" + o;
var r = `<${n}>`;
var l = document;
var c = () => l.createComment("");
var a = (t3) => null === t3 || "object" != typeof t3 && "function" != typeof t3;
var u = Array.isArray;
var d = (t3) => u(t3) || "function" == typeof t3?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t3) => (i2, ...s2) => ({ _$litType$: t3, strings: i2, values: s2 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t3, i2) {
  if (!u(t3) || !t3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i2) : i2;
}
var N = (t3, i2) => {
  const s2 = t3.length - 1, e2 = [];
  let n2, l2 = 2 === i2 ? "<svg>" : 3 === i2 ? "<math>" : "", c2 = v;
  for (let i3 = 0; i3 < s2; i3++) {
    const s3 = t3[i3];
    let a2, u2, d2 = -1, f2 = 0;
    for (; f2 < s3.length && (c2.lastIndex = f2, u2 = c2.exec(s3), null !== u2); ) f2 = c2.lastIndex, c2 === v ? "!--" === u2[1] ? c2 = _ : void 0 !== u2[1] ? c2 = m : void 0 !== u2[2] ? (y.test(u2[2]) && (n2 = RegExp("</" + u2[2], "g")), c2 = p) : void 0 !== u2[3] && (c2 = p) : c2 === p ? ">" === u2[0] ? (c2 = n2 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c2.lastIndex - u2[2].length, a2 = u2[1], c2 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c2 === $ || c2 === g ? c2 = p : c2 === _ || c2 === m ? c2 = v : (c2 = p, n2 = void 0);
    const x2 = c2 === p && t3[i3 + 1].startsWith("/>") ? " " : "";
    l2 += c2 === v ? s3 + r : d2 >= 0 ? (e2.push(a2), s3.slice(0, d2) + h + s3.slice(d2) + o + x2) : s3 + o + (-2 === d2 ? i3 : x2);
  }
  return [V(t3, l2 + (t3[s2] || "<?>") + (2 === i2 ? "</svg>" : 3 === i2 ? "</math>" : "")), e2];
};
var S = class _S {
  constructor({ strings: t3, _$litType$: i2 }, e2) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t3.length - 1, d2 = this.parts, [f2, v2] = N(t3, i2);
    if (this.el = _S.createElement(f2, e2), P.currentNode = this.el.content, 2 === i2 || 3 === i2) {
      const t4 = this.el.content.firstChild;
      t4.replaceWith(...t4.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t4 of r2.getAttributeNames()) if (t4.endsWith(h)) {
          const i3 = v2[a2++], s2 = r2.getAttribute(t4).split(o), e3 = /([.?@])?(.*)/.exec(i3);
          d2.push({ type: 1, index: l2, name: e3[2], strings: s2, ctor: "." === e3[1] ? I : "?" === e3[1] ? L : "@" === e3[1] ? z : H }), r2.removeAttribute(t4);
        } else t4.startsWith(o) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t4));
        if (y.test(r2.tagName)) {
          const t4 = r2.textContent.split(o), i3 = t4.length - 1;
          if (i3 > 0) {
            r2.textContent = s ? s.emptyScript : "";
            for (let s2 = 0; s2 < i3; s2++) r2.append(t4[s2], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t4[i3], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n) d2.push({ type: 2, index: l2 });
      else {
        let t4 = -1;
        for (; -1 !== (t4 = r2.data.indexOf(o, t4 + 1)); ) d2.push({ type: 7, index: l2 }), t4 += o.length - 1;
      }
      l2++;
    }
  }
  static createElement(t3, i2) {
    const s2 = l.createElement("template");
    return s2.innerHTML = t3, s2;
  }
};
function M(t3, i2, s2 = t3, e2) {
  if (i2 === E) return i2;
  let h2 = void 0 !== e2 ? s2._$Co?.[e2] : s2._$Cl;
  const o2 = a(i2) ? void 0 : i2._$litDirective$;
  return h2?.constructor !== o2 && (h2?._$AO?.(false), void 0 === o2 ? h2 = void 0 : (h2 = new o2(t3), h2._$AT(t3, s2, e2)), void 0 !== e2 ? (s2._$Co ??= [])[e2] = h2 : s2._$Cl = h2), void 0 !== h2 && (i2 = M(t3, h2._$AS(t3, i2.values), h2, e2)), i2;
}
var R = class {
  constructor(t3, i2) {
    this._$AV = [], this._$AN = void 0, this._$AD = t3, this._$AM = i2;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t3) {
    const { el: { content: i2 }, parts: s2 } = this._$AD, e2 = (t3?.creationScope ?? l).importNode(i2, true);
    P.currentNode = e2;
    let h2 = P.nextNode(), o2 = 0, n2 = 0, r2 = s2[0];
    for (; void 0 !== r2; ) {
      if (o2 === r2.index) {
        let i3;
        2 === r2.type ? i3 = new k(h2, h2.nextSibling, this, t3) : 1 === r2.type ? i3 = new r2.ctor(h2, r2.name, r2.strings, this, t3) : 6 === r2.type && (i3 = new Z(h2, this, t3)), this._$AV.push(i3), r2 = s2[++n2];
      }
      o2 !== r2?.index && (h2 = P.nextNode(), o2++);
    }
    return P.currentNode = l, e2;
  }
  p(t3) {
    let i2 = 0;
    for (const s2 of this._$AV) void 0 !== s2 && (void 0 !== s2.strings ? (s2._$AI(t3, s2, i2), i2 += s2.strings.length - 2) : s2._$AI(t3[i2])), i2++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t3, i2, s2, e2) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t3, this._$AB = i2, this._$AM = s2, this.options = e2, this._$Cv = e2?.isConnected ?? true;
  }
  get parentNode() {
    let t3 = this._$AA.parentNode;
    const i2 = this._$AM;
    return void 0 !== i2 && 11 === t3?.nodeType && (t3 = i2.parentNode), t3;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t3, i2 = this) {
    t3 = M(this, t3, i2), a(t3) ? t3 === A || null == t3 || "" === t3 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t3 !== this._$AH && t3 !== E && this._(t3) : void 0 !== t3._$litType$ ? this.$(t3) : void 0 !== t3.nodeType ? this.T(t3) : d(t3) ? this.k(t3) : this._(t3);
  }
  O(t3) {
    return this._$AA.parentNode.insertBefore(t3, this._$AB);
  }
  T(t3) {
    this._$AH !== t3 && (this._$AR(), this._$AH = this.O(t3));
  }
  _(t3) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t3 : this.T(l.createTextNode(t3)), this._$AH = t3;
  }
  $(t3) {
    const { values: i2, _$litType$: s2 } = t3, e2 = "number" == typeof s2 ? this._$AC(t3) : (void 0 === s2.el && (s2.el = S.createElement(V(s2.h, s2.h[0]), this.options)), s2);
    if (this._$AH?._$AD === e2) this._$AH.p(i2);
    else {
      const t4 = new R(e2, this), s3 = t4.u(this.options);
      t4.p(i2), this.T(s3), this._$AH = t4;
    }
  }
  _$AC(t3) {
    let i2 = C.get(t3.strings);
    return void 0 === i2 && C.set(t3.strings, i2 = new S(t3)), i2;
  }
  k(t3) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i2 = this._$AH;
    let s2, e2 = 0;
    for (const h2 of t3) e2 === i2.length ? i2.push(s2 = new _k(this.O(c()), this.O(c()), this, this.options)) : s2 = i2[e2], s2._$AI(h2), e2++;
    e2 < i2.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i2.length = e2);
  }
  _$AR(t3 = this._$AA.nextSibling, s2) {
    for (this._$AP?.(false, true, s2); t3 !== this._$AB; ) {
      const s3 = i(t3).nextSibling;
      i(t3).remove(), t3 = s3;
    }
  }
  setConnected(t3) {
    void 0 === this._$AM && (this._$Cv = t3, this._$AP?.(t3));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t3, i2, s2, e2, h2) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t3, this.name = i2, this._$AM = e2, this.options = h2, s2.length > 2 || "" !== s2[0] || "" !== s2[1] ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = A;
  }
  _$AI(t3, i2 = this, s2, e2) {
    const h2 = this.strings;
    let o2 = false;
    if (void 0 === h2) t3 = M(this, t3, i2, 0), o2 = !a(t3) || t3 !== this._$AH && t3 !== E, o2 && (this._$AH = t3);
    else {
      const e3 = t3;
      let n2, r2;
      for (t3 = h2[0], n2 = 0; n2 < h2.length - 1; n2++) r2 = M(this, e3[s2 + n2], i2, n2), r2 === E && (r2 = this._$AH[n2]), o2 ||= !a(r2) || r2 !== this._$AH[n2], r2 === A ? t3 = A : t3 !== A && (t3 += (r2 ?? "") + h2[n2 + 1]), this._$AH[n2] = r2;
    }
    o2 && !e2 && this.j(t3);
  }
  j(t3) {
    t3 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t3 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t3) {
    this.element[this.name] = t3 === A ? void 0 : t3;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t3) {
    this.element.toggleAttribute(this.name, !!t3 && t3 !== A);
  }
};
var z = class extends H {
  constructor(t3, i2, s2, e2, h2) {
    super(t3, i2, s2, e2, h2), this.type = 5;
  }
  _$AI(t3, i2 = this) {
    if ((t3 = M(this, t3, i2, 0) ?? A) === E) return;
    const s2 = this._$AH, e2 = t3 === A && s2 !== A || t3.capture !== s2.capture || t3.once !== s2.once || t3.passive !== s2.passive, h2 = t3 !== A && (s2 === A || e2);
    e2 && this.element.removeEventListener(this.name, this, s2), h2 && this.element.addEventListener(this.name, this, t3), this._$AH = t3;
  }
  handleEvent(t3) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t3) : this._$AH.handleEvent(t3);
  }
};
var Z = class {
  constructor(t3, i2, s2) {
    this.element = t3, this.type = 6, this._$AN = void 0, this._$AM = i2, this.options = s2;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t3) {
    M(this, t3);
  }
};
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");
var D = (t3, i2, s2) => {
  const e2 = s2?.renderBefore ?? i2;
  let h2 = e2._$litPart$;
  if (void 0 === h2) {
    const t4 = s2?.renderBefore ?? null;
    e2._$litPart$ = h2 = new k(i2.insertBefore(c(), t4), t4, void 0, s2 ?? {});
  }
  return h2._$AI(t3), h2;
};

// nukernel/src/envelope/api.ts
var SEGS = ["delay", "attack", "hold", "decay", "sustain", "release"];
var ISLEVEL = { sustain: true };

// nukernel/src/copy/global.ts
var C2 = () => globalThis.COPY;
var t2 = (key, p2) => C2().t(key, p2);
var tn = (key, n2, p2) => C2().tn(key, n2, p2);
var fmt = (n2, unit) => C2().fmt(n2, unit);

// nukernel/src/envelope/plate.ts
var R2 = 22;
var HOLD_MS = 600;
function quantise(v2, min, max, step) {
  const s2 = step > 0 ? step : 1e-3;
  const q = Math.round((v2 - min) / s2) * s2 + min;
  const dp = Math.min(6, Math.max(0, Math.ceil(-Math.log10(s2)) + 1));
  return Math.min(max, Math.max(min, +q.toFixed(dp)));
}
function say(v2, unit) {
  if (unit === "s" && v2 < 0.1) return fmt(v2 * 1e3, "ms");
  if (unit === "Hz" && v2 >= 1e3) return fmt(v2 / 1e3, "kHz");
  return fmt(v2, unit);
}
var SAID = /* @__PURE__ */ new Map();
function sayLine(k2) {
  const w2 = SAID.get(k2) || "";
  return b`<p class="nu-wsay" role="status" aria-live="polite"
    data-k=${"say|" + k2} ?data-said=${!!w2}>${w2}</p>`;
}
function unsay(k2) {
  SAID.delete(k2);
}
function handle(o2, host) {
  const b2 = document.createElement("button");
  b2.type = "button";
  b2.className = "nu-envh" + (o2.why ? " is-refused" : "");
  b2.dataset.k = o2.k;
  b2.dataset.seg = o2.axis;
  b2.setAttribute("role", "slider");
  b2.setAttribute("aria-valuemin", String(o2.min));
  b2.setAttribute("aria-valuemax", String(o2.max));
  b2.setAttribute("aria-valuenow", String(o2.value));
  b2.setAttribute("aria-valuetext", o2.say);
  b2.setAttribute("aria-label", o2.why ? t2("env.handleWhy", { name: o2.label, value: o2.say, why: o2.why }) : t2("env.handle", { name: o2.label, value: o2.say }));
  if (o2.why) {
    b2.setAttribute("aria-disabled", "true");
    b2.dataset.why = o2.why;
    b2.dataset.say = o2.why;
  }
  b2.style.left = o2.x - R2 + "px";
  b2.style.top = o2.y - R2 + "px";
  const dot = document.createElement("span");
  dot.className = "nu-envdot";
  b2.append(dot);
  if (o2.why) {
    b2.addEventListener("click", (e2) => {
      e2.preventDefault();
      e2.stopPropagation();
      SAID.set(o2.sayK || o2.k, o2.why);
      if (host.onRefused) host.onRefused(o2.k);
    });
    return b2;
  }
  let held = null;
  let from = null;
  let moved = false;
  const cancelHold = () => {
    if (held != null) {
      clearTimeout(held);
      held = null;
    }
  };
  b2.addEventListener("pointerdown", (e2) => {
    try {
      b2.setPointerCapture(e2.pointerId);
    } catch (err) {
    }
    from = { x: e2.clientX, y: e2.clientY };
    moved = false;
    e2.preventDefault();
    held = window.setTimeout(
      () => {
        held = null;
        if (!moved) host.onHold(o2.k);
      },
      HOLD_MS
    );
  });
  b2.addEventListener("pointermove", (e2) => {
    if (!from) return;
    const dx = e2.clientX - from.x, dy = e2.clientY - from.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 3) {
      moved = true;
      cancelHold();
    }
    if (!moved) return;
    host.onMove(o2.k, dx, dy, e2);
  });
  const up = (e2) => {
    cancelHold();
    if (from && moved) host.onDrop(o2.k);
    from = null;
    moved = false;
    try {
      b2.releasePointerCapture(e2.pointerId);
    } catch (err) {
    }
  };
  b2.addEventListener("pointerup", up);
  b2.addEventListener("pointercancel", up);
  return b2;
}
function keyStep(e2, v2, min, max, step, axis) {
  const big = e2.shiftKey ? 10 : 1;
  const s2 = (step > 0 ? step : 1e-3) * big;
  switch (e2.key) {
    case "ArrowRight":
    case "ArrowUp":
      if (e2.key === "ArrowUp" && axis === "x") return null;
      if (e2.key === "ArrowRight" && axis === "y") return null;
      return quantise(v2 + s2, min, max, step);
    case "ArrowLeft":
    case "ArrowDown":
      if (e2.key === "ArrowDown" && axis === "x") return null;
      if (e2.key === "ArrowLeft" && axis === "y") return null;
      return quantise(v2 - s2, min, max, step);
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

// nukernel/src/envelope/adsr.ts
var segWord = (s2) => t2("env.seg." + s2);
var PLATE_H = 132;
function adsrEditor(host, spec0) {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env";
  host.append(node);
  let LIVE = {};
  let GRAB = {};
  const byseg = () => {
    const o2 = {};
    for (const f2 of spec.fields) o2[f2.seg] = f2;
    return o2;
  };
  const valOf = (f2) => LIVE[f2.seg] != null ? LIVE[f2.seg] : f2.value != null ? f2.value : f2.derived;
  const geometry = (w2) => {
    const F = byseg();
    const at = (s2) => {
      const f2 = F[s2];
      return f2 ? valOf(f2) : 0;
    };
    const sus = F.sustain ? valOf(F.sustain) : 1;
    const T2 = {
      d: at("delay"),
      a: at("attack"),
      h: at("hold"),
      dc: at("decay"),
      rl: at("release")
    };
    const total = T2.d + T2.a + T2.h + T2.dc + T2.rl;
    const plateau = Math.max(total, 1e-3) / 3;
    const span = total + plateau;
    const usable = Math.max(1, w2 - 2 * R2);
    const px = (t3) => R2 + t3 / span * usable;
    const top = R2, bot = PLATE_H - R2;
    const y2 = (lv) => bot - Math.min(1, Math.max(0, lv)) * (bot - top);
    const x0 = px(0);
    const xD = px(T2.d);
    const xA = px(T2.d + T2.a);
    const xH = px(T2.d + T2.a + T2.h);
    const xS = px(T2.d + T2.a + T2.h + T2.dc);
    const xP = px(T2.d + T2.a + T2.h + T2.dc + plateau);
    const xR = px(span);
    return { F, T: T2, sus, span, px, y: y2, top, bot, x0, xD, xA, xH, xS, xP, xR };
  };
  const path = (g2) => {
    const p2 = [];
    p2.push("M " + g2.x0.toFixed(1) + " " + g2.y(0).toFixed(1));
    if (g2.xD > g2.x0) p2.push("L " + g2.xD.toFixed(1) + " " + g2.y(0).toFixed(1));
    p2.push("L " + g2.xA.toFixed(1) + " " + g2.y(1).toFixed(1));
    if (g2.xH > g2.xA) p2.push("L " + g2.xH.toFixed(1) + " " + g2.y(1).toFixed(1));
    if (g2.F.decay) p2.push("Q " + (g2.xH + (g2.xS - g2.xH) * 0.35).toFixed(1) + " " + g2.y(g2.sus).toFixed(1) + " " + g2.xS.toFixed(1) + " " + g2.y(g2.sus).toFixed(1));
    else p2.push("L " + g2.xS.toFixed(1) + " " + g2.y(g2.sus).toFixed(1));
    p2.push("L " + g2.xP.toFixed(1) + " " + g2.y(g2.sus).toFixed(1));
    p2.push("Q " + (g2.xP + (g2.xR - g2.xP) * 0.35).toFixed(1) + " " + g2.y(g2.sus * 0.25).toFixed(1) + " " + g2.xR.toFixed(1) + " " + g2.y(0).toFixed(1));
    return p2.join(" ");
  };
  const seat = (g2, s2) => {
    switch (s2) {
      case "delay":
        return { x: g2.xD, y: g2.y(0) };
      case "attack":
        return { x: g2.xA, y: g2.y(1) };
      case "hold":
        return { x: g2.xH, y: g2.y(1) };
      case "decay":
        return { x: g2.xS, y: g2.y(g2.sus) };
      case "sustain":
        return { x: (g2.xS + g2.xP) / 2, y: g2.y(g2.sus) };
      case "release":
        return { x: g2.xR, y: g2.y(0) };
      default:
        return { x: g2.x0, y: g2.y(0) };
    }
  };
  const dragHost = {
    plate: node,
    onMove(k2, dx, dy) {
      const seg = k2.split("|").pop();
      const F = byseg();
      const f2 = F[seg];
      if (!f2) return;
      const w2 = plateWidth();
      const g0 = geometry(w2);
      const base = GRAB[seg] != null ? GRAB[seg] : f2.value != null ? f2.value : f2.derived;
      let v2;
      if (ISLEVEL[seg]) {
        const h2 = PLATE_H - R2 * 1.2;
        v2 = base - dy / h2 * (f2.max - f2.min);
      } else {
        const usable = Math.max(1, w2 - 2 * R2);
        v2 = base + dx / usable * g0.span;
      }
      LIVE[seg] = quantise(v2, f2.min, f2.max, f2.step);
      paintLive();
    },
    onDrop(k2) {
      const seg = k2.split("|").pop();
      const v2 = LIVE[seg];
      LIVE = {};
      GRAB = {};
      if (v2 == null) {
        draw();
        return;
      }
      unsay(spec.k);
      spec.set(seg, v2);
      draw();
    },
    onHold(k2) {
      const seg = k2.split("|").pop();
      LIVE = {};
      GRAB = {};
      unsay(spec.k);
      spec.clear(seg);
      draw();
    },
    /* A TAP ON A REFUSED HANDLE (§15 B5): plate.ts has already stored the
       reason under this plate's address; this is the redraw that prints it. */
    onRefused() {
      draw();
    }
  };
  const plateWidth = () => {
    const el = node.querySelector(".nu-envplate");
    const w2 = el ? el.getBoundingClientRect().width : 0;
    return w2 > 40 ? w2 : 320;
  };
  const view = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const F = byseg();
    const order = ["delay", "attack", "hold", "decay", "sustain", "release"];
    const live = order.filter((s2) => !!F[s2]);
    const anySet = spec.fields.some((f2) => f2.value != null);
    const ghostG = anySet ? (() => {
      const saveL = LIVE;
      LIVE = {};
      const saved = spec.fields.map((f2) => f2.value);
      spec.fields.forEach((f2) => {
        f2.value = null;
      });
      const gg = geometry(w2);
      spec.fields.forEach((f2, i2) => {
        f2.value = saved[i2];
      });
      LIVE = saveL;
      return gg;
    })() : null;
    return b`
      <div class="nu-envplate" data-k=${spec.k}
           aria-label=${t2("env.plate")}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w2 + " " + PLATE_H}
             width=${w2} height=${PLATE_H} aria-hidden="true"
             preserveAspectRatio="none">
          ${w`<line class="nu-envbase" x1="0" y1=${g2.y(0)} x2=${w2} y2=${g2.y(0)} />`}
          ${ghostG ? w`<path class="nu-envghost" d=${path(ghostG)} />` : A}
          ${w`<path class="nu-envcurve" d=${path(g2)} />`}
        </svg>
        ${live.map((s2) => {
      const f2 = F[s2];
      const pos = seat(g2, s2);
      const v2 = valOf(f2);
      const b2 = handle({
        k: spec.k + "|" + s2,
        label: segWord(s2),
        value: v2,
        min: f2.min,
        max: f2.max,
        step: f2.step,
        say: say(v2, f2.unit),
        axis: ISLEVEL[s2] ? "y" : "x",
        x: pos.x,
        y: pos.y,
        why: f2.why || null,
        sayK: spec.k
      }, dragHost);
      b2.addEventListener("keydown", (e2) => {
        const nv = keyStep(
          e2,
          valOf(f2),
          f2.min,
          f2.max,
          f2.step,
          ISLEVEL[s2] ? "y" : "x"
        );
        if (nv == null) {
          if (e2.key === "Backspace" || e2.key === "Delete") {
            e2.preventDefault();
            e2.stopPropagation();
            spec.clear(s2);
            draw();
          }
          return;
        }
        e2.preventDefault();
        e2.stopPropagation();
        spec.set(s2, nv);
        draw();
      });
      b2.addEventListener("pointerdown", () => {
        GRAB[s2] = valOf(f2);
      });
      return b2;
    })}
      </div>
      <div class="nu-envsays">
        ${live.map((s2) => {
      const f2 = F[s2];
      const set = f2.value != null;
      return b`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + spec.k + "|" + s2}
            ><b>${segWord(s2)}</b> <span>${say(valOf(f2), f2.unit)}</span>${set ? b` <button type="button" class="nu-clearback"
              data-k=${"clear|" + spec.k + "|" + s2}
              aria-label=${t2("env.clearBack", { name: segWord(s2) })}
              @click=${() => {
        unsay(spec.k);
        spec.clear(s2);
        draw();
      }}>${t2("act.clear")}</button>` : A}</span>`;
    })}
      </div>
      ${/* THE REFUSAL SAID OUT LOUD (§15 B5) — one line per plate, under it.
        The room is reserved whether or not there is a sentence, so a
        reason arriving under a thumb moves nothing. */
    sayLine(spec.k)}`;
  };
  const paintLive = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const F = byseg();
    const path2 = node.querySelector(".nu-envcurve");
    if (path2) path2.setAttribute("d", path(g2));
    for (const el of Array.from(node.querySelectorAll(".nu-envh"))) {
      const seg = (el.dataset.k || "").split("|").pop();
      const f2 = F[seg];
      if (!f2) continue;
      const pos = seat(g2, seg);
      el.style.left = pos.x - R2 + "px";
      el.style.top = pos.y - R2 + "px";
      const v2 = valOf(f2);
      el.setAttribute("aria-valuenow", String(v2));
      el.setAttribute("aria-valuetext", say(v2, f2.unit));
    }
    for (const el of Array.from(node.querySelectorAll(".nu-envsay"))) {
      const seg = (el.dataset.k || "").split("|").pop();
      const f2 = F[seg];
      if (!f2) continue;
      const out = el.querySelector("span");
      if (out) out.textContent = say(valOf(f2), f2.unit);
    }
  };
  const draw = () => {
    D(view(), node);
  };
  draw();
  requestAnimationFrame(() => {
    if (node.isConnected) draw();
  });
  return { node, update(next) {
    spec = next;
    LIVE = {};
    GRAB = {};
    draw();
  } };
}

// nukernel/src/envelope/curve.ts
var PLATE_H2 = 132;
function breakpointEditor(host, spec0) {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-envcurvebox";
  host.append(node);
  let LIVE = null;
  let GRAB = null;
  const pts = () => LIVE || spec.points;
  const plateWidth = () => {
    const el = node.querySelector(".nu-envplate");
    const w2 = el ? el.getBoundingClientRect().width : 0;
    return w2 > 40 ? w2 : 320;
  };
  const xGrid = () => typeof spec.grid === "number" && spec.grid > 0 ? spec.grid : spec.span / 64;
  const snapX = (x2) => Math.min(spec.span, Math.max(0, +(Math.round(x2 / xGrid()) * xGrid()).toFixed(6)));
  const geo = (w2) => {
    const usable = Math.max(1, w2 - 2 * R2);
    const top = R2, bot = PLATE_H2 - R2;
    const yspan = Math.max(1e-9, spec.hi - spec.lo);
    return {
      px: (x2) => R2 + Math.min(spec.span, Math.max(0, x2)) / Math.max(1e-9, spec.span) * usable,
      py: (y2) => bot - (Math.min(spec.hi, Math.max(spec.lo, y2)) - spec.lo) / yspan * (bot - top),
      vx: (dx) => dx / usable * spec.span,
      vy: (dy) => -(dy / (bot - top)) * yspan
    };
  };
  const dragHost = {
    plate: node,
    onMove(k2, dx, dy) {
      const i2 = +k2.split("|").pop();
      const base = GRAB || spec.points;
      const g2 = geo(plateWidth());
      const p2 = base[i2];
      if (!p2) return;
      const next = base.map((q, j) => j === i2 ? {
        x: snapX(p2.x + g2.vx(dx)),
        y: quantise(
          p2.y + g2.vy(dy),
          spec.lo,
          spec.hi,
          (spec.hi - spec.lo) / 100
        )
      } : { ...q });
      if (i2 === 0) next[0].x = 0;
      if (i2 === base.length - 1) next[i2].x = spec.span;
      next.sort((a2, b2) => a2.x - b2.x);
      LIVE = next;
      paintLive();
    },
    onDrop() {
      const v2 = LIVE;
      LIVE = null;
      GRAB = null;
      if (v2) spec.set(v2);
      draw();
    },
    onHold() {
      LIVE = null;
      GRAB = null;
      spec.clear();
      draw();
    }
  };
  const view = () => {
    const w2 = plateWidth();
    const g2 = geo(w2);
    const P2 = pts();
    const d2 = P2.map((p2, i2) => (i2 ? "L " : "M ") + g2.px(p2.x).toFixed(1) + " " + g2.py(p2.y).toFixed(1)).join(" ");
    return b`
      <div class="nu-envplate" data-k=${spec.k}
           aria-label=${tn(
      "env.lane",
      P2.length,
      { name: spec.label, span: fmt(spec.span, spec.xUnit) }
    )}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w2 + " " + PLATE_H2}
             width=${w2} height=${PLATE_H2} aria-hidden="true"
             preserveAspectRatio="none">
          ${w`<line class="nu-envbase" x1="0" y1=${g2.py(spec.lo)}
                      x2=${w2} y2=${g2.py(spec.lo)} />`}
          ${w`<path class="nu-envcurve" d=${d2} />`}
        </svg>
        ${P2.map((p2, i2) => {
      const b2 = handle({
        k: spec.k + "|" + i2,
        label: t2("env.point", { n: i2 + 1 }),
        value: p2.y,
        min: spec.lo,
        max: spec.hi,
        step: (spec.hi - spec.lo) / 100,
        say: t2("env.pointAt", {
          value: say(p2.y, spec.yUnit),
          at: say(p2.x, spec.xUnit)
        }),
        axis: "xy",
        x: g2.px(p2.x),
        y: g2.py(p2.y)
      }, dragHost);
      b2.addEventListener("keydown", (e2) => {
        const nv = keyStep(
          e2,
          p2.y,
          spec.lo,
          spec.hi,
          (spec.hi - spec.lo) / 100,
          "y"
        );
        if (nv == null) return;
        e2.preventDefault();
        e2.stopPropagation();
        spec.set(P2.map((q, j) => j === i2 ? { x: q.x, y: nv } : { ...q }));
        draw();
      });
      b2.addEventListener("pointerdown", () => {
        GRAB = P2.map((q) => ({ ...q }));
      });
      return b2;
    })}
      </div>
      <div class="nu-envsays">
        <span class="nu-envsay"><b>${spec.label}</b>
          <span>${tn(
      "env.points",
      P2.length,
      { span: fmt(spec.span, spec.xUnit) }
    )}</span>
          <button type="button" class="nu-clearback" data-k=${"clear|" + spec.k}
            aria-label=${t2("env.clearBack", { name: spec.label })}
            @click=${() => {
      spec.clear();
      draw();
    }}>${t2("act.clear")}</button></span>
      </div>`;
  };
  const paintLive = () => {
    const g2 = geo(plateWidth());
    const P2 = pts();
    const d2 = P2.map((q, i2) => (i2 ? "L " : "M ") + g2.px(q.x).toFixed(1) + " " + g2.py(q.y).toFixed(1)).join(" ");
    const path2 = node.querySelector(".nu-envcurve");
    if (path2) path2.setAttribute("d", d2);
    const hs = Array.from(node.querySelectorAll(".nu-envh"));
    hs.forEach((el, i2) => {
      const q = P2[i2];
      if (!q) return;
      el.style.left = g2.px(q.x) - R2 + "px";
      el.style.top = g2.py(q.y) - R2 + "px";
      el.setAttribute("aria-valuenow", String(q.y));
      el.setAttribute(
        "aria-valuetext",
        t2("env.pointAt", {
          value: say(q.y, spec.yUnit),
          at: say(q.x, spec.xUnit)
        })
      );
    });
  };
  const draw = () => {
    D(view(), node);
  };
  draw();
  requestAnimationFrame(() => {
    if (node.isConnected) draw();
  });
  return { node, update(next) {
    spec = next;
    LIVE = null;
    GRAB = null;
    draw();
  } };
}

// nukernel/src/envelope/bands.ts
var PLATE_H3 = 132;
var SR = 44100;
function biquad(kind, f0, gainDb, q) {
  const A2 = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f0 / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  if (kind === "peaking") {
    const al2 = sw / (2 * Math.max(1e-4, q));
    return [1 + al2 * A2, -2 * cw, 1 - al2 * A2, 1 + al2 / A2, -2 * cw, 1 - al2 / A2];
  }
  const al = sw / 2 * Math.SQRT2;
  const rt = 2 * Math.sqrt(A2) * al;
  if (kind === "lowshelf") {
    return [
      A2 * (A2 + 1 - (A2 - 1) * cw + rt),
      2 * A2 * (A2 - 1 - (A2 + 1) * cw),
      A2 * (A2 + 1 - (A2 - 1) * cw - rt),
      A2 + 1 + (A2 - 1) * cw + rt,
      -2 * (A2 - 1 + (A2 + 1) * cw),
      A2 + 1 + (A2 - 1) * cw - rt
    ];
  }
  return [
    A2 * (A2 + 1 + (A2 - 1) * cw + rt),
    -2 * A2 * (A2 - 1 + (A2 + 1) * cw),
    A2 * (A2 + 1 + (A2 - 1) * cw - rt),
    A2 + 1 - (A2 - 1) * cw + rt,
    2 * (A2 - 1 - (A2 + 1) * cw),
    A2 + 1 - (A2 - 1) * cw - rt
  ];
}
function bandDb(b2, gainDb, f2) {
  if (!gainDb) return 0;
  const [b0, b1, b22, a0, a1, a2] = biquad(b2.type, b2.freq, gainDb, b2.q || 1);
  const w2 = 2 * Math.PI * Math.min(f2, SR / 2 - 1) / SR;
  const c1 = Math.cos(w2), s1 = Math.sin(w2);
  const c2 = Math.cos(2 * w2), s2 = Math.sin(2 * w2);
  const nr = b0 + b1 * c1 + b22 * c2, ni = -(b1 * s1 + b22 * s2);
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  const den = dr * dr + di * di;
  if (!(den > 0)) return 0;
  return 10 * Math.log10((nr * nr + ni * ni) / den);
}
function eqEditor(host, spec0) {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-eqbox";
  host.append(node);
  let LIVE = {};
  let GRAB = {};
  const byKey = () => {
    const o2 = {};
    for (const b2 of spec.bands) o2[b2.key] = b2;
    return o2;
  };
  const valOf = (b2) => LIVE[b2.key] != null ? LIVE[b2.key] : b2.value != null ? b2.value : b2.derived;
  const plateWidth = () => {
    const el = node.querySelector(".nu-envplate");
    const w2 = el ? el.getBoundingClientRect().width : 0;
    return w2 > 40 ? w2 : 320;
  };
  const geometry = (w2) => {
    const usable = Math.max(1, w2 - 2 * R2);
    const top = R2, bot = PLATE_H3 - R2;
    const l0 = Math.log(Math.max(1, spec.fLo)), l1 = Math.log(Math.max(2, spec.fHi));
    const span = Math.max(1e-9, spec.hi - spec.lo);
    return {
      top,
      bot,
      usable,
      px: (f2) => R2 + (Math.log(Math.min(spec.fHi, Math.max(spec.fLo, f2))) - l0) / Math.max(1e-9, l1 - l0) * usable,
      fx: (px) => Math.exp(l0 + (px - R2) / usable * (l1 - l0)),
      py: (db) => bot - (Math.min(spec.hi, Math.max(spec.lo, db)) - spec.lo) / span * (bot - top),
      vy: (dy) => -(dy / (bot - top)) * span
    };
  };
  const path = (g2, w2, read) => {
    const p2 = [];
    for (let x2 = R2; x2 <= w2 - R2 + 0.01; x2 += 3) {
      const f2 = g2.fx(x2);
      let db = 0;
      for (const b2 of spec.bands) db += bandDb(b2, read(b2), f2);
      p2.push((p2.length ? "L " : "M ") + x2.toFixed(1) + " " + g2.py(db).toFixed(1));
    }
    return p2.join(" ");
  };
  const dragHost = {
    plate: node,
    onMove(k2, _dx, dy) {
      const b2 = spec.bands.find((x2) => x2.k === k2);
      if (!b2) return;
      const g2 = geometry(plateWidth());
      const base = GRAB[b2.key] != null ? GRAB[b2.key] : b2.value != null ? b2.value : b2.derived;
      LIVE[b2.key] = quantise(base + g2.vy(dy), spec.lo, spec.hi, spec.step);
      paintLive();
    },
    onDrop(k2) {
      const b2 = spec.bands.find((x2) => x2.k === k2);
      const v2 = b2 ? LIVE[b2.key] : void 0;
      LIVE = {};
      GRAB = {};
      if (!b2 || v2 == null) {
        draw();
        return;
      }
      spec.set(b2.key, v2);
      draw();
    },
    onHold(k2) {
      const b2 = spec.bands.find((x2) => x2.k === k2);
      LIVE = {};
      GRAB = {};
      if (b2) spec.clear(b2.key);
      draw();
    }
  };
  const view = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const anySet = spec.bands.some((b2) => b2.value != null);
    return b`
      <div class="nu-envplate nu-eqplate" data-k=${spec.k} aria-label=${spec.label}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w2 + " " + PLATE_H3}
             width=${w2} height=${PLATE_H3} aria-hidden="true"
             preserveAspectRatio="none">
          ${w`<line class="nu-envbase" x1="0" y1=${g2.py(0)} x2=${w2} y2=${g2.py(0)} />`}
          ${spec.bands.map((b2) => w`<line class="nu-eqrule"
              x1=${g2.px(b2.freq)} y1=${g2.top} x2=${g2.px(b2.freq)} y2=${g2.bot} />`)}
          ${anySet ? w`<path class="nu-envghost"
              d=${path(g2, w2, (b2) => b2.derived)} />` : A}
          ${w`<path class="nu-envcurve" d=${path(g2, w2, valOf)} />`}
        </svg>
        ${spec.bands.map((b2) => {
      const v2 = valOf(b2);
      const el = handle({
        k: b2.k,
        label: b2.label,
        value: v2,
        min: spec.lo,
        max: spec.hi,
        step: spec.step,
        say: say(v2, spec.unit),
        axis: "y",
        x: g2.px(b2.freq),
        y: g2.py(v2),
        why: b2.why || null
      }, dragHost);
      el.addEventListener("keydown", (e2) => {
        const nv = keyStep(e2, valOf(b2), spec.lo, spec.hi, spec.step, "y");
        if (nv == null) {
          if (e2.key === "Backspace" || e2.key === "Delete") {
            e2.preventDefault();
            e2.stopPropagation();
            spec.clear(b2.key);
            draw();
          }
          return;
        }
        e2.preventDefault();
        e2.stopPropagation();
        spec.set(b2.key, nv);
        draw();
      });
      el.addEventListener("pointerdown", () => {
        GRAB[b2.key] = valOf(b2);
      });
      return el;
    })}
      </div>
      ${says()}`;
  };
  const says = () => b`
      <div class="nu-envsays">
        ${spec.bands.map((b2) => {
    const set = b2.value != null;
    return b`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + b2.k}
            ><b>${b2.label}</b> <span>${say(valOf(b2), spec.unit)}</span>
            <button type="button" class="nu-clearback"
              data-k=${"clear|" + b2.k}
              aria-label=${t2("env.clearBack", { name: b2.label })}
              @click=${() => {
      spec.clear(b2.key);
      draw();
    }}>${t2("act.clear")}</button
            ></span>`;
  })}
      </div>`;
  const paintLive = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const B2 = byKey();
    const p2 = node.querySelector(".nu-envcurve");
    if (p2) p2.setAttribute("d", path(g2, w2, valOf));
    for (const el of Array.from(node.querySelectorAll(".nu-envh"))) {
      const b2 = spec.bands.find((x2) => x2.k === el.dataset.k);
      if (!b2) continue;
      const v2 = valOf(b2);
      el.style.left = g2.px(b2.freq) - R2 + "px";
      el.style.top = g2.py(v2) - R2 + "px";
      el.setAttribute("aria-valuenow", String(v2));
      el.setAttribute("aria-valuetext", say(v2, spec.unit));
    }
    for (const el of Array.from(node.querySelectorAll(".nu-envsay"))) {
      const key = (el.dataset.k || "").replace(/^envsay\|/, "");
      const b2 = spec.bands.find((x2) => x2.k === key) || B2[key];
      if (!b2) continue;
      const out = el.querySelector("span");
      if (out) out.textContent = say(valOf(b2), spec.unit);
    }
  };
  const draw = () => {
    D(view(), node);
  };
  draw();
  requestAnimationFrame(() => {
    if (node.isConnected) draw();
  });
  return { node, update(next) {
    spec = next;
    LIVE = {};
    GRAB = {};
    draw();
  } };
}
function xyEditor(host, spec0) {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-xybox";
  host.append(node);
  let LIVE = {};
  let GRAB = {};
  const axis = (a2) => a2 === "x" ? spec.x : spec.y;
  const valOf = (a2) => {
    const A2 = axis(a2);
    return LIVE[a2] != null ? LIVE[a2] : A2.value != null ? A2.value : A2.derived;
  };
  const plateWidth = () => {
    const el = node.querySelector(".nu-envplate");
    const w2 = el ? el.getBoundingClientRect().width : 0;
    return w2 > 40 ? w2 : 320;
  };
  const scale = (A2, px0, px1) => {
    const lg = !!A2.log && A2.min > 0;
    const f2 = (v2) => lg ? Math.log(Math.max(A2.min, v2)) : v2;
    const lo = f2(A2.min), hi = f2(A2.max);
    const sp = Math.max(1e-9, hi - lo);
    const rng = px1 - px0 || 1;
    const clamp = (v2) => Math.min(A2.max, Math.max(A2.min, v2));
    return {
      to: (v2) => px0 + (f2(clamp(v2)) - lo) / sp * rng,
      from: (px) => {
        const u2 = lo + (px - px0) / rng * sp;
        return lg ? Math.exp(u2) : u2;
      },
      /** how far `d` pixels moves this axis, from a value it started at. */
      by: (v0, d2) => {
        const u2 = f2(clamp(v0)) + d2 / rng * sp;
        return lg ? Math.exp(u2) : u2;
      }
    };
  };
  const geometry = (w2) => {
    const left = R2, right = w2 - R2, top = R2, bot = PLATE_H3 - R2;
    return {
      left,
      right,
      top,
      bot,
      X: scale(spec.x, left, right),
      /* UP IS MORE, so the y scale runs from the plate's floor to its
         ceiling and the pixel axis is inverted here rather than at four
         call sites. */
      Y: scale(spec.y, bot, top)
    };
  };
  const decades = (g2) => {
    if (!spec.x.log) return [];
    const out = [];
    for (let d2 = 1; d2 <= 1e5; d2 *= 10)
      if (d2 > spec.x.min && d2 < spec.x.max) out.push(d2);
    return out.map((d2) => g2.X.to(d2));
  };
  const dragHost = {
    plate: node,
    onMove(_k, dx, dy) {
      const g2 = geometry(plateWidth());
      const bx = GRAB.x != null ? GRAB.x : valOf("x");
      const by = GRAB.y != null ? GRAB.y : valOf("y");
      if (!spec.x.why)
        LIVE.x = quantise(g2.X.by(bx, dx), spec.x.min, spec.x.max, spec.x.step);
      if (!spec.y.why)
        LIVE.y = quantise(g2.Y.by(by, dy), spec.y.min, spec.y.max, spec.y.step);
      paintLive();
    },
    onDrop() {
      const v2 = LIVE;
      LIVE = {};
      GRAB = {};
      if (v2.x != null) spec.set("x", v2.x);
      if (v2.y != null) spec.set("y", v2.y);
      draw();
    },
    onHold() {
      LIVE = {};
      GRAB = {};
      spec.clear();
      draw();
    }
  };
  const view = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const xv = valOf("x"), yv = valOf("y");
    const hx = g2.X.to(xv), hy = g2.Y.to(yv);
    const why = spec.x.why || spec.y.why || null;
    return b`
      <div class="nu-envplate nu-xyplate" data-k=${spec.k} aria-label=${spec.label}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w2 + " " + PLATE_H3}
             width=${w2} height=${PLATE_H3} aria-hidden="true"
             preserveAspectRatio="none">
          ${decades(g2).map((x2) => w`<line class="nu-eqrule" x1=${x2} y1=${g2.top}
                                            x2=${x2} y2=${g2.bot} />`)}
          ${w`<line class="nu-envbase" x1="0" y1=${g2.bot} x2=${w2} y2=${g2.bot} />`}
          ${w`<line class="nu-xycross" x1=${hx} y1=${g2.top} x2=${hx} y2=${g2.bot} />`}
          ${w`<line class="nu-xycross" x1=${g2.left} y1=${hy} x2=${g2.right} y2=${hy} />`}
        </svg>
        ${(() => {
      const el = handle({
        k: spec.k,
        label: spec.label,
        value: xv,
        min: spec.x.min,
        max: spec.x.max,
        step: spec.x.step,
        /* THE HANDLE IS A POINT AT TWO NUMBERS, which is the string the
           lane already has for exactly this shape. */
        say: t2("env.pointAt", {
          value: say(xv, spec.x.unit),
          at: say(yv, spec.y.unit)
        }),
        axis: "xy",
        x: hx,
        y: hy,
        why
      }, dragHost);
      el.addEventListener("keydown", (e2) => {
        const horiz = e2.key === "ArrowLeft" || e2.key === "ArrowRight" || e2.key === "Home" || e2.key === "End";
        const vert = e2.key === "ArrowUp" || e2.key === "ArrowDown";
        if (horiz || vert) {
          const a2 = horiz ? "x" : "y";
          const A2 = axis(a2);
          if (A2.why) return;
          const g3 = geometry(plateWidth());
          const now = valOf(a2);
          const big = e2.shiftKey ? 10 : 1;
          let nv;
          if (e2.key === "Home") nv = A2.min;
          else if (e2.key === "End") nv = A2.max;
          else {
            const reach = horiz ? g3.right - g3.left : g3.top - g3.bot;
            const dir = e2.key === "ArrowRight" || e2.key === "ArrowUp" ? 1 : -1;
            const d2 = dir * (reach / 100) * big;
            nv = quantise((horiz ? g3.X : g3.Y).by(now, d2), A2.min, A2.max, A2.step);
            if (nv === now) nv = quantise(
              now + dir * A2.step * big,
              A2.min,
              A2.max,
              A2.step
            );
          }
          if (nv === now) return;
          e2.preventDefault();
          e2.stopPropagation();
          spec.set(a2, nv);
          draw();
          return;
        }
        if (e2.key === "Backspace" || e2.key === "Delete") {
          e2.preventDefault();
          e2.stopPropagation();
          spec.clear();
          draw();
        }
      });
      el.addEventListener("pointerdown", () => {
        GRAB = { x: valOf("x"), y: valOf("y") };
      });
      return el;
    })()}
      </div>
      <div class="nu-envsays">
        ${["x", "y"].map((a2) => {
      const A2 = axis(a2);
      const set = A2.value != null;
      return b`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + A2.k}
            ><b>${A2.label}</b> <span>${say(valOf(a2), A2.unit)}</span>
            <button type="button" class="nu-clearback"
              data-k=${"clear|" + A2.k}
              aria-label=${t2("env.clearBack", { name: A2.label })}
              @click=${() => {
        spec.clear(a2);
        draw();
      }}>${t2("act.clear")}</button
            >${A2.why ? b`<small class="nu-why">${A2.why}</small>` : A}</span>`;
    })}
      </div>`;
  };
  const paintLive = () => {
    const w2 = plateWidth();
    const g2 = geometry(w2);
    const xv = valOf("x"), yv = valOf("y");
    const hx = g2.X.to(xv), hy = g2.Y.to(yv);
    const cross = Array.from(node.querySelectorAll(".nu-xycross"));
    if (cross[0]) {
      cross[0].setAttribute("x1", String(hx));
      cross[0].setAttribute("x2", String(hx));
    }
    if (cross[1]) {
      cross[1].setAttribute("y1", String(hy));
      cross[1].setAttribute("y2", String(hy));
    }
    const el = node.querySelector(".nu-envh");
    if (el) {
      el.style.left = hx - R2 + "px";
      el.style.top = hy - R2 + "px";
      el.setAttribute("aria-valuenow", String(xv));
      el.setAttribute(
        "aria-valuetext",
        t2("env.pointAt", {
          value: say(xv, spec.x.unit),
          at: say(yv, spec.y.unit)
        })
      );
    }
    for (const s2 of Array.from(node.querySelectorAll(".nu-envsay"))) {
      const key = (s2.dataset.k || "").replace(/^envsay\|/, "");
      const a2 = key === spec.x.k ? "x" : key === spec.y.k ? "y" : null;
      if (!a2) continue;
      const out = s2.querySelector("span");
      if (out) out.textContent = say(valOf(a2), axis(a2).unit);
    }
  };
  const draw = () => {
    D(view(), node);
  };
  draw();
  requestAnimationFrame(() => {
    if (node.isConnected) draw();
  });
  return { node, update(next) {
    spec = next;
    LIVE = {};
    GRAB = {};
    draw();
  } };
}

// nukernel/src/envelope/editor.ts
function curveEditor(host, spec) {
  const mode = spec.mode || "adsr";
  if (mode === "adsr") return adsrEditor(host, spec);
  if (mode === "eq") return eqEditor(host, spec);
  if (mode === "xy") return xyEditor(host, spec);
  return breakpointEditor(host, spec);
}
var adsrEditor2 = (host, spec) => curveEditor(host, { ...spec, mode: "adsr" });
var breakpointEditor2 = (host, spec) => curveEditor(host, { ...spec, mode: spec.mode || "lane" });
var eqCurve = (host, spec) => curveEditor(host, { ...spec, mode: "eq" });
var xyPad = (host, spec) => curveEditor(host, { ...spec, mode: "xy" });
export {
  ISLEVEL,
  SEGS,
  adsrEditor2 as adsrEditor,
  breakpointEditor2 as breakpointEditor,
  curveEditor,
  eqCurve,
  xyPad
};

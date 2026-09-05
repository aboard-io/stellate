// nukernel/ui/menus.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/menus/ by `node tools/ui/build.js`.
// An edit made here is an edit the next build throws away, and
// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails
// until it is gone. Edit the TypeScript source and rebuild.
//
// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain
// files, nothing is vendored and nothing is fetched, and the page plays
// with the wire cut. Minify is OFF so this stays a reviewable diff.

// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = (t4) => t4;
var s = t.trustedTypes;
var e = s ? s.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var h = "$lit$";
var o = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n = "?" + o;
var r = `<${n}>`;
var l = document;
var c = () => l.createComment("");
var a = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var u = Array.isArray;
var d = (t4) => u(t4) || "function" == typeof t4?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t4) => (i3, ...s2) => ({ _$litType$: t4, strings: i3, values: s2 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t4, i3) {
  if (!u(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i3) : i3;
}
var N = (t4, i3) => {
  const s2 = t4.length - 1, e4 = [];
  let n2, l2 = 2 === i3 ? "<svg>" : 3 === i3 ? "<math>" : "", c2 = v;
  for (let i4 = 0; i4 < s2; i4++) {
    const s3 = t4[i4];
    let a2, u2, d2 = -1, f2 = 0;
    for (; f2 < s3.length && (c2.lastIndex = f2, u2 = c2.exec(s3), null !== u2); ) f2 = c2.lastIndex, c2 === v ? "!--" === u2[1] ? c2 = _ : void 0 !== u2[1] ? c2 = m : void 0 !== u2[2] ? (y.test(u2[2]) && (n2 = RegExp("</" + u2[2], "g")), c2 = p) : void 0 !== u2[3] && (c2 = p) : c2 === p ? ">" === u2[0] ? (c2 = n2 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c2.lastIndex - u2[2].length, a2 = u2[1], c2 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c2 === $ || c2 === g ? c2 = p : c2 === _ || c2 === m ? c2 = v : (c2 = p, n2 = void 0);
    const x2 = c2 === p && t4[i4 + 1].startsWith("/>") ? " " : "";
    l2 += c2 === v ? s3 + r : d2 >= 0 ? (e4.push(a2), s3.slice(0, d2) + h + s3.slice(d2) + o + x2) : s3 + o + (-2 === d2 ? i4 : x2);
  }
  return [V(t4, l2 + (t4[s2] || "<?>") + (2 === i3 ? "</svg>" : 3 === i3 ? "</math>" : "")), e4];
};
var S = class _S {
  constructor({ strings: t4, _$litType$: i3 }, e4) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t4.length - 1, d2 = this.parts, [f2, v2] = N(t4, i3);
    if (this.el = _S.createElement(f2, e4), P.currentNode = this.el.content, 2 === i3 || 3 === i3) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t5 of r2.getAttributeNames()) if (t5.endsWith(h)) {
          const i4 = v2[a2++], s2 = r2.getAttribute(t5).split(o), e5 = /([.?@])?(.*)/.exec(i4);
          d2.push({ type: 1, index: l2, name: e5[2], strings: s2, ctor: "." === e5[1] ? I : "?" === e5[1] ? L : "@" === e5[1] ? z : H }), r2.removeAttribute(t5);
        } else t5.startsWith(o) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t5));
        if (y.test(r2.tagName)) {
          const t5 = r2.textContent.split(o), i4 = t5.length - 1;
          if (i4 > 0) {
            r2.textContent = s ? s.emptyScript : "";
            for (let s2 = 0; s2 < i4; s2++) r2.append(t5[s2], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t5[i4], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n) d2.push({ type: 2, index: l2 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r2.data.indexOf(o, t5 + 1)); ) d2.push({ type: 7, index: l2 }), t5 += o.length - 1;
      }
      l2++;
    }
  }
  static createElement(t4, i3) {
    const s2 = l.createElement("template");
    return s2.innerHTML = t4, s2;
  }
};
function M(t4, i3, s2 = t4, e4) {
  if (i3 === E) return i3;
  let h2 = void 0 !== e4 ? s2._$Co?.[e4] : s2._$Cl;
  const o3 = a(i3) ? void 0 : i3._$litDirective$;
  return h2?.constructor !== o3 && (h2?._$AO?.(false), void 0 === o3 ? h2 = void 0 : (h2 = new o3(t4), h2._$AT(t4, s2, e4)), void 0 !== e4 ? (s2._$Co ??= [])[e4] = h2 : s2._$Cl = h2), void 0 !== h2 && (i3 = M(t4, h2._$AS(t4, i3.values), h2, e4)), i3;
}
var R = class {
  constructor(t4, i3) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i3;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i3 }, parts: s2 } = this._$AD, e4 = (t4?.creationScope ?? l).importNode(i3, true);
    P.currentNode = e4;
    let h2 = P.nextNode(), o3 = 0, n2 = 0, r2 = s2[0];
    for (; void 0 !== r2; ) {
      if (o3 === r2.index) {
        let i4;
        2 === r2.type ? i4 = new k(h2, h2.nextSibling, this, t4) : 1 === r2.type ? i4 = new r2.ctor(h2, r2.name, r2.strings, this, t4) : 6 === r2.type && (i4 = new Z(h2, this, t4)), this._$AV.push(i4), r2 = s2[++n2];
      }
      o3 !== r2?.index && (h2 = P.nextNode(), o3++);
    }
    return P.currentNode = l, e4;
  }
  p(t4) {
    let i3 = 0;
    for (const s2 of this._$AV) void 0 !== s2 && (void 0 !== s2.strings ? (s2._$AI(t4, s2, i3), i3 += s2.strings.length - 2) : s2._$AI(t4[i3])), i3++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i3, s2, e4) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i3, this._$AM = s2, this.options = e4, this._$Cv = e4?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i3 = this._$AM;
    return void 0 !== i3 && 11 === t4?.nodeType && (t4 = i3.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i3 = this) {
    t4 = M(this, t4, i3), a(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(l.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i3, _$litType$: s2 } = t4, e4 = "number" == typeof s2 ? this._$AC(t4) : (void 0 === s2.el && (s2.el = S.createElement(V(s2.h, s2.h[0]), this.options)), s2);
    if (this._$AH?._$AD === e4) this._$AH.p(i3);
    else {
      const t5 = new R(e4, this), s3 = t5.u(this.options);
      t5.p(i3), this.T(s3), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i3 = C.get(t4.strings);
    return void 0 === i3 && C.set(t4.strings, i3 = new S(t4)), i3;
  }
  k(t4) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i3 = this._$AH;
    let s2, e4 = 0;
    for (const h2 of t4) e4 === i3.length ? i3.push(s2 = new _k(this.O(c()), this.O(c()), this, this.options)) : s2 = i3[e4], s2._$AI(h2), e4++;
    e4 < i3.length && (this._$AR(s2 && s2._$AB.nextSibling, e4), i3.length = e4);
  }
  _$AR(t4 = this._$AA.nextSibling, s2) {
    for (this._$AP?.(false, true, s2); t4 !== this._$AB; ) {
      const s3 = i(t4).nextSibling;
      i(t4).remove(), t4 = s3;
    }
  }
  setConnected(t4) {
    void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t4, i3, s2, e4, h2) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i3, this._$AM = e4, this.options = h2, s2.length > 2 || "" !== s2[0] || "" !== s2[1] ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = A;
  }
  _$AI(t4, i3 = this, s2, e4) {
    const h2 = this.strings;
    let o3 = false;
    if (void 0 === h2) t4 = M(this, t4, i3, 0), o3 = !a(t4) || t4 !== this._$AH && t4 !== E, o3 && (this._$AH = t4);
    else {
      const e5 = t4;
      let n2, r2;
      for (t4 = h2[0], n2 = 0; n2 < h2.length - 1; n2++) r2 = M(this, e5[s2 + n2], i3, n2), r2 === E && (r2 = this._$AH[n2]), o3 ||= !a(r2) || r2 !== this._$AH[n2], r2 === A ? t4 = A : t4 !== A && (t4 += (r2 ?? "") + h2[n2 + 1]), this._$AH[n2] = r2;
    }
    o3 && !e4 && this.j(t4);
  }
  j(t4) {
    t4 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t4) {
    this.element[this.name] = t4 === A ? void 0 : t4;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t4) {
    this.element.toggleAttribute(this.name, !!t4 && t4 !== A);
  }
};
var z = class extends H {
  constructor(t4, i3, s2, e4, h2) {
    super(t4, i3, s2, e4, h2), this.type = 5;
  }
  _$AI(t4, i3 = this) {
    if ((t4 = M(this, t4, i3, 0) ?? A) === E) return;
    const s2 = this._$AH, e4 = t4 === A && s2 !== A || t4.capture !== s2.capture || t4.once !== s2.once || t4.passive !== s2.passive, h2 = t4 !== A && (s2 === A || e4);
    e4 && this.element.removeEventListener(this.name, this, s2), h2 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i3, s2) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i3, this.options = s2;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    M(this, t4);
  }
};
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");
var D = (t4, i3, s2) => {
  const e4 = s2?.renderBefore ?? i3;
  let h2 = e4._$litPart$;
  if (void 0 === h2) {
    const t5 = s2?.renderBefore ?? null;
    e4._$litPart$ = h2 = new k(i3.insertBefore(c(), t5), t5, void 0, s2 ?? {});
  }
  return h2._$AI(t4), h2;
};

// node_modules/lit-html/directive.js
var t2 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e2 = (t4) => (...e4) => ({ _$litDirective$: t4, values: e4 });
var i2 = class {
  constructor(t4) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t4, e4, i3) {
    this._$Ct = t4, this._$AM = e4, this._$Ci = i3;
  }
  _$AS(t4, e4) {
    return this.update(t4, e4);
  }
  update(t4, e4) {
    return this.render(...e4);
  }
};

// node_modules/lit-html/directives/class-map.js
var e3 = e2(class extends i2 {
  constructor(t4) {
    if (super(t4), t4.type !== t2.ATTRIBUTE || "class" !== t4.name || t4.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(t4) {
    return " " + Object.keys(t4).filter((s2) => t4[s2]).join(" ") + " ";
  }
  update(s2, [i3]) {
    if (void 0 === this.st) {
      this.st = /* @__PURE__ */ new Set(), void 0 !== s2.strings && (this.nt = new Set(s2.strings.join(" ").split(/\s/).filter((t4) => "" !== t4)));
      for (const t4 in i3) i3[t4] && !this.nt?.has(t4) && this.st.add(t4);
      return this.render(i3);
    }
    const r2 = s2.element.classList;
    for (const t4 of this.st) t4 in i3 || (r2.remove(t4), this.st.delete(t4));
    for (const t4 in i3) {
      const s3 = !!i3[t4];
      s3 === this.st.has(t4) || this.nt?.has(t4) || (s3 ? (r2.add(t4), this.st.add(t4)) : (r2.remove(t4), this.st.delete(t4)));
    }
    return E;
  }
});

// node_modules/lit-html/directives/if-defined.js
var o2 = (o3) => o3 ?? A;

// nukernel/src/menus/pick.ts
var CHIPMAX = 8;
var LONGSTRIP = 24;
var COARSE = null;
function coarse() {
  if (COARSE == null) {
    try {
      COARSE = !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    } catch (e4) {
      COARSE = false;
    }
  }
  return COARSE;
}
function forgetPointer() {
  COARSE = null;
}
function pickerFor(n2, opts) {
  if (opts && opts.tight) return coarse() ? "native" : "combo";
  if (n2 <= CHIPMAX) return "chips";
  if (opts && opts.clustered) return "lozenge";
  if (coarse()) return "native";
  if (opts && opts.strip) return "chips";
  return "combo";
}

// nukernel/src/copy/global.ts
var C2 = () => globalThis.COPY;
var t3 = (key, p2) => C2().t(key, p2);

// nukernel/src/menus/index.ts
var LOZ = () => globalThis.NuLozenge || null;
function clustered(words) {
  const seen = /* @__PURE__ */ new Set();
  for (const w2 of words || []) {
    const g2 = w2.group && String(w2.group).trim();
    if (g2) seen.add(g2);
  }
  return seen.size > 1;
}
function optionText(o3) {
  const label = o3.label == null ? String(o3.value) : String(o3.label);
  const why = o3.why && String(o3.why).trim();
  return why ? t3("menu.withWhy", { name: label, why }) : label;
}
var filterWord = (o3) => String(o3.label == null ? o3.value : o3.label);
var valOf = (o3) => String(o3.value == null ? "" : o3.value);
var gestures = 0;
if (typeof document !== "undefined" && document.addEventListener)
  for (const ev of ["pointerdown", "touchstart", "keydown"])
    document.addEventListener(
      ev,
      () => {
        gestures++;
      },
      { capture: true, passive: true }
    );
var listN = 0;
function esc(s2) {
  const C3 = globalThis.CSS;
  if (C3 && C3.escape) return C3.escape(s2);
  return String(s2).replace(/[^a-zA-Z0-9_-]/g, (c2) => "\\" + c2);
}
function defaultDetent(words) {
  for (const o3 of words || []) {
    const v2 = valOf(o3);
    const w2 = String(o3.label == null ? "" : o3.label).trim();
    if (v2 === "" || v2 === "default" || w2 === "—" || w2.toLowerCase() === "default")
      return v2;
  }
  return null;
}
function paintDetent(box, ctl, value, detent) {
  if (detent == null) return;
  const said = String(value) !== String(detent);
  for (const n2 of [box, ctl]) {
    n2.classList.toggle("is-said", said);
    n2.classList.toggle("is-seated", !said);
  }
}
function refuseSilentGrey(spec) {
  for (const o3 of spec.words || [])
    if ((o3.disabled || o3.quiet) && !(o3.why && String(o3.why).trim()))
      throw new Error('selects: "' + spec.key + '" / "' + valOf(o3) + '" is ' + (o3.disabled ? "disabled" : "quiet") + " with no `why`");
}
function uniqueKey(key0) {
  const doc = document;
  let key = String(key0);
  if (doc.querySelector('[data-sel="' + esc(key) + '"]')) {
    console.error("selects: duplicate select key " + key + " — two controls would share one data-k");
    let n2 = 2;
    while (doc.querySelector('[data-sel="' + esc(key + "#" + n2) + '"]')) n2++;
    key = key + "#" + n2;
  }
  return key;
}
function address(ctl, spec, key, widget, value) {
  ctl.dataset.sel = key;
  ctl.dataset.k = spec.k ? String(spec.k) : "sel|" + key;
  ctl.dataset.v = value;
  ctl.dataset.widget = widget;
  if (spec.ungated) ctl.dataset.ungated = "true";
}
function rowsOf(spec) {
  const now = String(spec.value == null ? "" : spec.value);
  const rows = (spec.words || []).map((o3) => ({ o: o3, value: valOf(o3), word: filterWord(o3) }));
  let matched = rows.find((r2) => r2.value === now);
  if (!matched) {
    const word = now === "" ? t3("menu.choose") : t3("menu.unknown", { name: now });
    matched = {
      o: { value: now, label: word, quiet: true, why: word },
      value: now,
      word,
      placeholder: true
    };
    rows.unshift(matched);
  }
  return { rows, now, matched };
}
function chips(spec, key, box) {
  const { rows, matched } = rowsOf(spec);
  const off = spec.why && String(spec.why).trim();
  const strip = document.createElement("div");
  strip.className = "nu-wchips nu-menu is-chips";
  strip.setAttribute("role", "group");
  strip.tabIndex = 0;
  const label = spec.label == null ? key : String(spec.label);
  strip.setAttribute(
    "aria-label",
    off ? t3("menu.withWhy", { name: label, why: off }) : label
  );
  if (off) {
    strip.dataset.why = off;
    strip.classList.add("is-off");
    strip.setAttribute("aria-disabled", "true");
  }
  address(strip, spec, key, "chips", matched.value);
  const detent = defaultDetent(spec.words || []);
  let cur = matched.value;
  const write = (v2) => {
    const r2 = rows.find((x2) => x2.value === v2);
    if (!r2 || off || r2.o.disabled) return;
    if (v2 !== cur) {
      cur = v2;
      strip.dataset.v = cur;
      paintDetent(box, strip, cur, detent);
      draw();
      strip.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof spec.onWrite === "function") spec.onWrite(cur);
    }
  };
  const draw = () => D(b`${rows.map((r2) => {
    const hard = !!off;
    const refused = hard || !!r2.o.disabled && r2.value !== cur;
    const own = r2.o.why ? String(r2.o.why).trim() : "";
    const why = hard ? off : own || null;
    const w2 = r2.o.label == null ? r2.value : String(r2.o.label);
    return b`<button type="button"
      class=${e3({ "nu-wchip": true, "is-quiet": !!r2.o.quiet })}
      data-k=${key + "|" + r2.value}
      data-v=${r2.value}
      data-placeholder=${o2(r2.placeholder ? "true" : void 0)}
      aria-pressed=${String(r2.value === cur)}
      ?disabled=${refused}
      aria-disabled=${o2(refused ? "true" : void 0)}
      data-why=${o2(why == null ? void 0 : why)}
      title=${o2(hard && off ? off : void 0)}
      aria-label=${why ? t3("menu.withWhy", { name: w2, why }) : w2}
      @click=${() => write(r2.value)}><span class="nu-chipword">${w2}</span
      >${own ? b`<small class="nu-why">${own}</small>` : A}</button> `;
  })}`, strip);
  draw();
  paintDetent(box, strip, cur, detent);
  return strip;
}
function native(spec, key, box) {
  const { rows, matched } = rowsOf(spec);
  const sel = document.createElement("select");
  sel.className = "nu-combofield nu-menu-native";
  const label = spec.label == null ? key : String(spec.label);
  const off = spec.why && String(spec.why).trim();
  sel.setAttribute(
    "aria-label",
    off ? t3("menu.withWhy", { name: label, why: off }) : label
  );
  if (off) {
    sel.disabled = true;
    sel.setAttribute("aria-disabled", "true");
    sel.dataset.why = off;
    box.classList.add("is-off");
  }
  address(sel, spec, key, "native", matched.value);
  let group = null;
  let bin = sel;
  for (const r2 of rows) {
    if (r2.o.group && r2.o.group !== group) {
      group = String(r2.o.group);
      const og = document.createElement("optgroup");
      og.label = group;
      sel.append(og);
      bin = og;
    } else if (!r2.o.group) {
      group = null;
      bin = sel;
    }
    const op = document.createElement("option");
    op.value = r2.value;
    op.textContent = optionText(r2.o);
    if (r2.o.disabled) op.disabled = true;
    if (r2.o.why) op.dataset.why = String(r2.o.why);
    if (r2.placeholder) op.dataset.placeholder = "true";
    if (r2 === matched) op.selected = true;
    bin.append(op);
  }
  sel.value = matched.value;
  const detent = defaultDetent(spec.words || []);
  paintDetent(box, sel, matched.value, detent);
  let cur = matched.value;
  sel.addEventListener("change", () => {
    const v2 = String(sel.value);
    if (v2 === cur) return;
    cur = v2;
    sel.dataset.v = cur;
    paintDetent(box, sel, cur, detent);
    if (typeof spec.onWrite === "function") spec.onWrite(cur);
  });
  return sel;
}
var OPENKEY = null;
function combo(spec, key, box) {
  const doc = document;
  const { rows, matched } = rowsOf(spec);
  const label = spec.label == null ? key : String(spec.label);
  const off = spec.why && String(spec.why).trim();
  const f2 = doc.createElement("input");
  f2.type = "text";
  f2.className = "nu-combofield";
  f2.setAttribute("role", "combobox");
  f2.setAttribute("aria-autocomplete", "list");
  f2.setAttribute("aria-expanded", "false");
  f2.autocomplete = "off";
  f2.spellcheck = false;
  f2.readOnly = true;
  address(f2, spec, key, "combo", matched.value);
  const list = doc.createElement("ul");
  list.className = "nu-combolist";
  list.id = "nu-combolist-" + ++listN;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);
  list.hidden = true;
  f2.setAttribute("aria-controls", list.id);
  if (off) {
    f2.disabled = true;
    f2.setAttribute("aria-disabled", "true");
    f2.dataset.why = off;
    box.classList.add("is-off");
  }
  f2.setAttribute(
    "aria-label",
    off ? t3("menu.withWhy", { name: label, why: off }) : label
  );
  const lis = [];
  let group = null;
  for (const r2 of rows) {
    if (r2.o.group && r2.o.group !== group) {
      group = String(r2.o.group);
      const h2 = doc.createElement("li");
      h2.className = "nu-combogrp";
      h2.textContent = group;
      h2.setAttribute("role", "presentation");
      h2.dataset.grp = group;
      list.append(h2);
    }
    if (!r2.o.group) group = null;
    const li = doc.createElement("li");
    li.className = "nu-comboopt" + (r2.o.quiet ? " is-quiet" : "");
    li.textContent = optionText(r2.o);
    li.id = list.id + "-o" + lis.length;
    li.setAttribute("role", "option");
    li.dataset.v = r2.value;
    if (r2.o.disabled) {
      li.classList.add("is-off");
      li.setAttribute("aria-disabled", "true");
    }
    if (r2.o.why) li.dataset.why = String(r2.o.why);
    if (r2.placeholder) li.dataset.placeholder = "true";
    const on = r2 === matched;
    li.setAttribute("aria-selected", on ? "true" : "false");
    if (on) li.classList.add("is-on");
    list.append(li);
    lis.push({ ...r2, li });
  }
  const none = doc.createElement("li");
  none.className = "nu-why nu-combonone";
  none.textContent = t3("menu.noMatch");
  none.setAttribute("role", "presentation");
  none.hidden = true;
  list.append(none);
  {
    let widest = 0;
    for (const r2 of lis) widest = Math.max(widest, r2.word.length);
    f2.size = Math.max(4, Math.min(30, widest));
  }
  box.append(f2, list);
  const bornAt = gestures;
  const detent = defaultDetent(spec.words || []);
  const rowOf = (v2) => lis.find((r2) => r2.value === String(v2)) || lis[0];
  let cur = matched.value;
  let open = false, active = -1, firing = false, typed = false;
  f2.value = rowOf(cur).word;
  paintDetent(box, f2, cur, detent);
  const showGroups = () => {
    let head = null, any = false;
    for (const n2 of Array.from(list.children)) {
      if (n2.classList.contains("nu-combogrp")) {
        if (head) head.hidden = !any;
        head = n2;
        any = false;
      } else if (!n2.hidden && n2.getAttribute("role") === "option") any = true;
    }
    if (head) head.hidden = !any;
  };
  const visible = () => lis.filter((r2) => !r2.li.hidden && !r2.o.disabled);
  const setActive = (i3) => {
    const was = active >= 0 ? lis[active] : null;
    if (was) was.li.classList.remove("is-active");
    active = i3;
    const now = i3 >= 0 ? lis[i3] : null;
    if (now) {
      now.li.classList.add("is-active");
      f2.setAttribute("aria-activedescendant", now.li.id);
      try {
        now.li.scrollIntoView({ block: "nearest" });
      } catch (e4) {
      }
    } else f2.removeAttribute("aria-activedescendant");
  };
  const openList = (selectAll) => {
    if (f2.disabled || open) return;
    open = true;
    typed = false;
    OPENKEY = key;
    for (const r2 of lis) r2.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = false;
    f2.setAttribute("aria-expanded", "true");
    box.classList.add("is-open");
    f2.readOnly = false;
    setActive(lis.indexOf(rowOf(cur)));
    if (selectAll !== false) {
      try {
        f2.select();
      } catch (e4) {
      }
    }
  };
  const closeList = (restore, byHand) => {
    open = false;
    typed = false;
    if (byHand !== false) OPENKEY = null;
    for (const r2 of lis) r2.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = true;
    f2.setAttribute("aria-expanded", "false");
    box.classList.remove("is-open");
    setActive(-1);
    f2.readOnly = true;
    if (restore !== false) f2.value = rowOf(cur).word;
  };
  const filter = (q0) => {
    const q = String(q0 == null ? "" : q0).trim().toLowerCase();
    for (const r2 of lis)
      r2.li.hidden = !!q && r2.word.toLowerCase().indexOf(q) < 0;
    showGroups();
    const vis = visible();
    setActive(vis[0] ? lis.indexOf(vis[0]) : -1);
    none.hidden = vis.length > 0;
  };
  const commit = (value) => {
    const r2 = lis.find((x2) => x2.value === String(value));
    if (!r2 || r2.o.disabled) return false;
    if (r2.value === cur) {
      closeList(true);
      return true;
    }
    cur = r2.value;
    f2.dataset.v = cur;
    f2.value = r2.word;
    for (const x2 of lis) {
      x2.li.setAttribute("aria-selected", x2 === r2 ? "true" : "false");
      x2.li.classList.toggle("is-on", x2 === r2);
    }
    paintDetent(box, f2, cur, detent);
    closeList(false);
    firing = true;
    try {
      f2.dispatchEvent(new Event("change", { bubbles: true }));
    } finally {
      firing = false;
    }
    if (typeof spec.onWrite === "function") spec.onWrite(cur);
    return true;
  };
  f2.addEventListener("pointerdown", (e4) => {
    if (f2.disabled) return;
    if (open) {
      closeList(true);
      f2.blur();
      return;
    }
    e4.preventDefault();
    f2.focus();
    if (doc.activeElement === f2 && !open) openList(true);
  });
  f2.addEventListener("focus", () => {
    if (f2.disabled || open) return;
    if (gestures <= bornAt && OPENKEY !== key) return;
    openList(true);
  });
  f2.addEventListener("blur", () => {
    if (open) closeList(true, false);
  });
  f2.addEventListener("input", () => {
    typed = true;
    if (!open) openList(false);
    typed = true;
    filter(f2.value);
  });
  f2.addEventListener("keydown", (e4) => {
    const k2 = e4.key;
    if (k2 === "Escape") {
      if (open) {
        e4.preventDefault();
        closeList(true);
      }
      return;
    }
    if (k2 === "ArrowDown" || k2 === "ArrowUp") {
      e4.preventDefault();
      if (!open) {
        openList(true);
        return;
      }
      const vis = visible();
      if (!vis.length) return;
      const d2 = k2 === "ArrowDown" ? 1 : -1;
      const on0 = active >= 0 ? lis[active] : null;
      let i3 = on0 ? vis.indexOf(on0) : -1;
      i3 = i3 < 0 ? d2 > 0 ? 0 : vis.length - 1 : (i3 + d2 + vis.length) % vis.length;
      const want = vis[i3];
      if (want) setActive(lis.indexOf(want));
      return;
    }
    if (k2 === "Enter") {
      if (!open) return;
      e4.preventDefault();
      const vis = visible();
      const on = active >= 0 ? lis[active] : null;
      const r2 = on && vis.indexOf(on) >= 0 ? on : vis.length === 1 ? vis[0] || null : null;
      if (r2) commit(r2.value);
      return;
    }
    if (k2 === "Tab") {
      if (open) closeList(true);
      return;
    }
    if (!open && k2.length === 1 && !e4.metaKey && !e4.ctrlKey && !e4.altKey) openList(true);
  });
  f2.addEventListener("change", () => {
    if (firing) return;
    if (typed) {
      f2.value = rowOf(cur).word;
      return;
    }
    const want = String(f2.value);
    const r2 = lis.find((x2) => x2.value === want) || lis.find((x2) => x2.word === want) || lis.find((x2) => optionText(x2.o) === want);
    if (r2) commit(r2.value);
    else f2.value = rowOf(cur).word;
  });
  const takeTap = (e4) => {
    const t4 = e4.target;
    const li = t4 && t4.closest ? t4.closest("li[role=option]") : null;
    if (!li || !list.contains(li)) return;
    e4.preventDefault();
    e4.stopPropagation();
    if (li.getAttribute("aria-disabled") === "true") return;
    const r2 = lis.find((x2) => x2.li === li);
    if (r2) commit(r2.value);
  };
  list.addEventListener("pointerdown", takeTap);
  list.addEventListener("click", takeTap);
  if (OPENKEY === key) setTimeout(() => {
    if (OPENKEY === key && !open) {
      try {
        f2.focus();
      } catch (e4) {
      }
      openList(true);
    }
  }, 0);
  return f2;
}
function menu(spec) {
  refuseSilentGrey(spec);
  const key = uniqueKey(spec.key);
  const box = document.createElement("span");
  box.className = "nu-combo" + (spec.compact ? " is-compact" : "");
  box.dataset.combo = key;
  const words = spec.words || [];
  if (!words.length) {
    const none = t3("menu.empty");
    const why = spec.why && String(spec.why).trim() || none;
    box.dataset.widget = "native";
    const empty = native({
      ...spec,
      why,
      words: [{ value: "", label: none, quiet: true, why: none }],
      value: ""
    }, key, box);
    empty.dataset.widget = "native";
    box.classList.add("is-off");
    box.append(empty);
    return box;
  }
  const pick = pickerFor(
    words.length,
    { tight: !!spec.compact, clustered: clustered(words) && !!LOZ() }
  );
  box.dataset.widget = pick;
  if (pick === "chips") box.append(chips(spec, key, box));
  else if (pick === "native") box.append(native(spec, key, box));
  else if (pick === "lozenge") box.append(lozenges(spec, key, box));
  else combo(spec, key, box);
  return box;
}
function lozenges(spec, key, box) {
  const door = LOZ();
  const { rows, matched } = rowsOf(spec);
  const off = spec.why && String(spec.why).trim();
  const el = door.lozengeField({
    key,
    label: spec.label == null ? key : String(spec.label),
    options: rows.map((r2) => ({
      value: r2.value,
      label: r2.o.label == null ? r2.value : String(r2.o.label),
      why: r2.o.why || null,
      disabled: !!r2.o.disabled,
      quiet: !!r2.o.quiet,
      cluster: r2.o.group || null
    })),
    value: matched.value,
    why: off || null,
    k: spec.k || null,
    ungated: spec.ungated,
    onWrite: (v2) => {
      if (off) return;
      box.dataset.v = v2;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof spec.onWrite === "function") spec.onWrite(v2);
    }
  });
  address(el, spec, key, "lozenge", matched.value);
  return el;
}
function menuField(parent, spec) {
  const p2 = document.createElement("p");
  p2.className = "nu-sel";
  const lab = document.createElement("label");
  const w2 = document.createElement("span");
  w2.className = "nu-w";
  w2.textContent = (spec.label == null ? String(spec.key) : String(spec.label)) + " ";
  lab.append(w2, menu(spec));
  p2.append(lab);
  if (spec.why) {
    p2.classList.add("is-off");
    const s2 = document.createElement("small");
    s2.className = "nu-why";
    s2.textContent = String(spec.why);
    p2.append(s2);
  }
  parent.append(p2);
  return p2;
}
function menuRow(parent, heading, specs) {
  const wrap = document.createElement("div");
  wrap.className = "nu-sels";
  if (heading) {
    const h2 = document.createElement("h3");
    h2.textContent = String(heading);
    wrap.append(h2);
  }
  for (const s2 of specs || []) menuField(wrap, s2);
  parent.append(wrap);
  return wrap;
}
function menuEl(spec) {
  return menu({ ...spec, compact: true });
}
export {
  CHIPMAX,
  LONGSTRIP,
  clustered,
  coarse,
  forgetPointer,
  menu,
  menuEl,
  menuField,
  menuRow,
  optionText,
  pickerFor
};

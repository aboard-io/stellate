// nukernel/ui/table.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/table/ by `node tools/ui/build.js`.
// An edit made here is an edit the next build throws away, and
// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails
// until it is gone. Edit the TypeScript source and rebuild.
//
// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain
// files, nothing is vendored and nothing is fetched, and the page plays
// with the wire cut. Minify is OFF so this stays a reviewable diff.

// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = (t5) => t5;
var s = t.trustedTypes;
var e = s ? s.createPolicy("lit-html", { createHTML: (t5) => t5 }) : void 0;
var h = "$lit$";
var o = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n = "?" + o;
var r = `<${n}>`;
var l = document;
var c = () => l.createComment("");
var a = (t5) => null === t5 || "object" != typeof t5 && "function" != typeof t5;
var u = Array.isArray;
var d = (t5) => u(t5) || "function" == typeof t5?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t5) => (i5, ...s3) => ({ _$litType$: t5, strings: i5, values: s3 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t5, i5) {
  if (!u(t5) || !t5.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i5) : i5;
}
var N = (t5, i5) => {
  const s3 = t5.length - 1, e4 = [];
  let n3, l2 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c3 = v;
  for (let i6 = 0; i6 < s3; i6++) {
    const s4 = t5[i6];
    let a2, u4, d2 = -1, f2 = 0;
    for (; f2 < s4.length && (c3.lastIndex = f2, u4 = c3.exec(s4), null !== u4); ) f2 = c3.lastIndex, c3 === v ? "!--" === u4[1] ? c3 = _ : void 0 !== u4[1] ? c3 = m : void 0 !== u4[2] ? (y.test(u4[2]) && (n3 = RegExp("</" + u4[2], "g")), c3 = p) : void 0 !== u4[3] && (c3 = p) : c3 === p ? ">" === u4[0] ? (c3 = n3 ?? v, d2 = -1) : void 0 === u4[1] ? d2 = -2 : (d2 = c3.lastIndex - u4[2].length, a2 = u4[1], c3 = void 0 === u4[3] ? p : '"' === u4[3] ? $ : g) : c3 === $ || c3 === g ? c3 = p : c3 === _ || c3 === m ? c3 = v : (c3 = p, n3 = void 0);
    const x2 = c3 === p && t5[i6 + 1].startsWith("/>") ? " " : "";
    l2 += c3 === v ? s4 + r : d2 >= 0 ? (e4.push(a2), s4.slice(0, d2) + h + s4.slice(d2) + o + x2) : s4 + o + (-2 === d2 ? i6 : x2);
  }
  return [V(t5, l2 + (t5[s3] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e4];
};
var S = class _S {
  constructor({ strings: t5, _$litType$: i5 }, e4) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u4 = t5.length - 1, d2 = this.parts, [f2, v3] = N(t5, i5);
    if (this.el = _S.createElement(f2, e4), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t6 = this.el.content.firstChild;
      t6.replaceWith(...t6.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u4; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t6 of r2.getAttributeNames()) if (t6.endsWith(h)) {
          const i6 = v3[a2++], s3 = r2.getAttribute(t6).split(o), e5 = /([.?@])?(.*)/.exec(i6);
          d2.push({ type: 1, index: l2, name: e5[2], strings: s3, ctor: "." === e5[1] ? I : "?" === e5[1] ? L : "@" === e5[1] ? z : H }), r2.removeAttribute(t6);
        } else t6.startsWith(o) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t6));
        if (y.test(r2.tagName)) {
          const t6 = r2.textContent.split(o), i6 = t6.length - 1;
          if (i6 > 0) {
            r2.textContent = s ? s.emptyScript : "";
            for (let s3 = 0; s3 < i6; s3++) r2.append(t6[s3], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t6[i6], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n) d2.push({ type: 2, index: l2 });
      else {
        let t6 = -1;
        for (; -1 !== (t6 = r2.data.indexOf(o, t6 + 1)); ) d2.push({ type: 7, index: l2 }), t6 += o.length - 1;
      }
      l2++;
    }
  }
  static createElement(t5, i5) {
    const s3 = l.createElement("template");
    return s3.innerHTML = t5, s3;
  }
};
function M(t5, i5, s3 = t5, e4) {
  if (i5 === E) return i5;
  let h3 = void 0 !== e4 ? s3._$Co?.[e4] : s3._$Cl;
  const o4 = a(i5) ? void 0 : i5._$litDirective$;
  return h3?.constructor !== o4 && (h3?._$AO?.(false), void 0 === o4 ? h3 = void 0 : (h3 = new o4(t5), h3._$AT(t5, s3, e4)), void 0 !== e4 ? (s3._$Co ??= [])[e4] = h3 : s3._$Cl = h3), void 0 !== h3 && (i5 = M(t5, h3._$AS(t5, i5.values), h3, e4)), i5;
}
var R = class {
  constructor(t5, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t5, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t5) {
    const { el: { content: i5 }, parts: s3 } = this._$AD, e4 = (t5?.creationScope ?? l).importNode(i5, true);
    P.currentNode = e4;
    let h3 = P.nextNode(), o4 = 0, n3 = 0, r2 = s3[0];
    for (; void 0 !== r2; ) {
      if (o4 === r2.index) {
        let i6;
        2 === r2.type ? i6 = new k(h3, h3.nextSibling, this, t5) : 1 === r2.type ? i6 = new r2.ctor(h3, r2.name, r2.strings, this, t5) : 6 === r2.type && (i6 = new Z(h3, this, t5)), this._$AV.push(i6), r2 = s3[++n3];
      }
      o4 !== r2?.index && (h3 = P.nextNode(), o4++);
    }
    return P.currentNode = l, e4;
  }
  p(t5) {
    let i5 = 0;
    for (const s3 of this._$AV) void 0 !== s3 && (void 0 !== s3.strings ? (s3._$AI(t5, s3, i5), i5 += s3.strings.length - 2) : s3._$AI(t5[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t5, i5, s3, e4) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t5, this._$AB = i5, this._$AM = s3, this.options = e4, this._$Cv = e4?.isConnected ?? true;
  }
  get parentNode() {
    let t5 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t5?.nodeType && (t5 = i5.parentNode), t5;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t5, i5 = this) {
    t5 = M(this, t5, i5), a(t5) ? t5 === A || null == t5 || "" === t5 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t5 !== this._$AH && t5 !== E && this._(t5) : void 0 !== t5._$litType$ ? this.$(t5) : void 0 !== t5.nodeType ? this.T(t5) : d(t5) ? this.k(t5) : this._(t5);
  }
  O(t5) {
    return this._$AA.parentNode.insertBefore(t5, this._$AB);
  }
  T(t5) {
    this._$AH !== t5 && (this._$AR(), this._$AH = this.O(t5));
  }
  _(t5) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t5 : this.T(l.createTextNode(t5)), this._$AH = t5;
  }
  $(t5) {
    const { values: i5, _$litType$: s3 } = t5, e4 = "number" == typeof s3 ? this._$AC(t5) : (void 0 === s3.el && (s3.el = S.createElement(V(s3.h, s3.h[0]), this.options)), s3);
    if (this._$AH?._$AD === e4) this._$AH.p(i5);
    else {
      const t6 = new R(e4, this), s4 = t6.u(this.options);
      t6.p(i5), this.T(s4), this._$AH = t6;
    }
  }
  _$AC(t5) {
    let i5 = C.get(t5.strings);
    return void 0 === i5 && C.set(t5.strings, i5 = new S(t5)), i5;
  }
  k(t5) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s3, e4 = 0;
    for (const h3 of t5) e4 === i5.length ? i5.push(s3 = new _k(this.O(c()), this.O(c()), this, this.options)) : s3 = i5[e4], s3._$AI(h3), e4++;
    e4 < i5.length && (this._$AR(s3 && s3._$AB.nextSibling, e4), i5.length = e4);
  }
  _$AR(t5 = this._$AA.nextSibling, s3) {
    for (this._$AP?.(false, true, s3); t5 !== this._$AB; ) {
      const s4 = i(t5).nextSibling;
      i(t5).remove(), t5 = s4;
    }
  }
  setConnected(t5) {
    void 0 === this._$AM && (this._$Cv = t5, this._$AP?.(t5));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t5, i5, s3, e4, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t5, this.name = i5, this._$AM = e4, this.options = h3, s3.length > 2 || "" !== s3[0] || "" !== s3[1] ? (this._$AH = Array(s3.length - 1).fill(new String()), this.strings = s3) : this._$AH = A;
  }
  _$AI(t5, i5 = this, s3, e4) {
    const h3 = this.strings;
    let o4 = false;
    if (void 0 === h3) t5 = M(this, t5, i5, 0), o4 = !a(t5) || t5 !== this._$AH && t5 !== E, o4 && (this._$AH = t5);
    else {
      const e5 = t5;
      let n3, r2;
      for (t5 = h3[0], n3 = 0; n3 < h3.length - 1; n3++) r2 = M(this, e5[s3 + n3], i5, n3), r2 === E && (r2 = this._$AH[n3]), o4 ||= !a(r2) || r2 !== this._$AH[n3], r2 === A ? t5 = A : t5 !== A && (t5 += (r2 ?? "") + h3[n3 + 1]), this._$AH[n3] = r2;
    }
    o4 && !e4 && this.j(t5);
  }
  j(t5) {
    t5 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t5 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t5) {
    this.element[this.name] = t5 === A ? void 0 : t5;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t5) {
    this.element.toggleAttribute(this.name, !!t5 && t5 !== A);
  }
};
var z = class extends H {
  constructor(t5, i5, s3, e4, h3) {
    super(t5, i5, s3, e4, h3), this.type = 5;
  }
  _$AI(t5, i5 = this) {
    if ((t5 = M(this, t5, i5, 0) ?? A) === E) return;
    const s3 = this._$AH, e4 = t5 === A && s3 !== A || t5.capture !== s3.capture || t5.once !== s3.once || t5.passive !== s3.passive, h3 = t5 !== A && (s3 === A || e4);
    e4 && this.element.removeEventListener(this.name, this, s3), h3 && this.element.addEventListener(this.name, this, t5), this._$AH = t5;
  }
  handleEvent(t5) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t5) : this._$AH.handleEvent(t5);
  }
};
var Z = class {
  constructor(t5, i5, s3) {
    this.element = t5, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s3;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t5) {
    M(this, t5);
  }
};
var j = { M: h, P: o, A: n, C: 1, L: N, R, D: d, V: M, I: k, H, N: L, U: z, B: I, F: Z };
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");
var D = (t5, i5, s3) => {
  const e4 = s3?.renderBefore ?? i5;
  let h3 = e4._$litPart$;
  if (void 0 === h3) {
    const t6 = s3?.renderBefore ?? null;
    e4._$litPart$ = h3 = new k(i5.insertBefore(c(), t6), t6, void 0, s3 ?? {});
  }
  return h3._$AI(t5), h3;
};

// node_modules/lit-html/directive.js
var t2 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e2 = (t5) => (...e4) => ({ _$litDirective$: t5, values: e4 });
var i2 = class {
  constructor(t5) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t5, e4, i5) {
    this._$Ct = t5, this._$AM = e4, this._$Ci = i5;
  }
  _$AS(t5, e4) {
    return this.update(t5, e4);
  }
  update(t5, e4) {
    return this.render(...e4);
  }
};

// node_modules/lit-html/directives/class-map.js
var e3 = e2(class extends i2 {
  constructor(t5) {
    if (super(t5), t5.type !== t2.ATTRIBUTE || "class" !== t5.name || t5.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(t5) {
    return " " + Object.keys(t5).filter((s3) => t5[s3]).join(" ") + " ";
  }
  update(s3, [i5]) {
    if (void 0 === this.st) {
      this.st = /* @__PURE__ */ new Set(), void 0 !== s3.strings && (this.nt = new Set(s3.strings.join(" ").split(/\s/).filter((t5) => "" !== t5)));
      for (const t5 in i5) i5[t5] && !this.nt?.has(t5) && this.st.add(t5);
      return this.render(i5);
    }
    const r2 = s3.element.classList;
    for (const t5 of this.st) t5 in i5 || (r2.remove(t5), this.st.delete(t5));
    for (const t5 in i5) {
      const s4 = !!i5[t5];
      s4 === this.st.has(t5) || this.nt?.has(t5) || (s4 ? (r2.add(t5), this.st.add(t5)) : (r2.remove(t5), this.st.delete(t5)));
    }
    return E;
  }
});

// node_modules/lit-html/directives/if-defined.js
var o2 = (o4) => o4 ?? A;

// node_modules/lit-html/directive-helpers.js
var { I: t3 } = j;
var i3 = (o4) => o4;
var s2 = () => document.createComment("");
var v2 = (o4, n3, e4) => {
  const l2 = o4._$AA.parentNode, d2 = void 0 === n3 ? o4._$AB : n3._$AA;
  if (void 0 === e4) {
    const i5 = l2.insertBefore(s2(), d2), n4 = l2.insertBefore(s2(), d2);
    e4 = new t3(i5, n4, o4, o4.options);
  } else {
    const t5 = e4._$AB.nextSibling, n4 = e4._$AM, c3 = n4 !== o4;
    if (c3) {
      let t6;
      e4._$AQ?.(o4), e4._$AM = o4, void 0 !== e4._$AP && (t6 = o4._$AU) !== n4._$AU && e4._$AP(t6);
    }
    if (t5 !== d2 || c3) {
      let o5 = e4._$AA;
      for (; o5 !== t5; ) {
        const t6 = i3(o5).nextSibling;
        i3(l2).insertBefore(o5, d2), o5 = t6;
      }
    }
  }
  return e4;
};
var u2 = (o4, t5, i5 = o4) => (o4._$AI(t5, i5), o4);
var m2 = {};
var p2 = (o4, t5 = m2) => o4._$AH = t5;
var M2 = (o4) => o4._$AH;
var h2 = (o4) => {
  o4._$AR(), o4._$AA.remove();
};

// node_modules/lit-html/directives/repeat.js
var u3 = (e4, s3, t5) => {
  const r2 = /* @__PURE__ */ new Map();
  for (let l2 = s3; l2 <= t5; l2++) r2.set(e4[l2], l2);
  return r2;
};
var c2 = e2(class extends i2 {
  constructor(e4) {
    if (super(e4), e4.type !== t2.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e4, s3, t5) {
    let r2;
    void 0 === t5 ? t5 = s3 : void 0 !== s3 && (r2 = s3);
    const l2 = [], o4 = [];
    let i5 = 0;
    for (const s4 of e4) l2[i5] = r2 ? r2(s4, i5) : i5, o4[i5] = t5(s4, i5), i5++;
    return { values: o4, keys: l2 };
  }
  render(e4, s3, t5) {
    return this.dt(e4, s3, t5).values;
  }
  update(s3, [t5, r2, c3]) {
    const d2 = M2(s3), { values: p3, keys: a2 } = this.dt(t5, r2, c3);
    if (!Array.isArray(d2)) return this.ut = a2, p3;
    const h3 = this.ut ??= [], v3 = [];
    let m3, y2, x2 = 0, j2 = d2.length - 1, k2 = 0, w2 = p3.length - 1;
    for (; x2 <= j2 && k2 <= w2; ) if (null === d2[x2]) x2++;
    else if (null === d2[j2]) j2--;
    else if (h3[x2] === a2[k2]) v3[k2] = u2(d2[x2], p3[k2]), x2++, k2++;
    else if (h3[j2] === a2[w2]) v3[w2] = u2(d2[j2], p3[w2]), j2--, w2--;
    else if (h3[x2] === a2[w2]) v3[w2] = u2(d2[x2], p3[w2]), v2(s3, v3[w2 + 1], d2[x2]), x2++, w2--;
    else if (h3[j2] === a2[k2]) v3[k2] = u2(d2[j2], p3[k2]), v2(s3, d2[x2], d2[j2]), j2--, k2++;
    else if (void 0 === m3 && (m3 = u3(a2, k2, w2), y2 = u3(h3, x2, j2)), m3.has(h3[x2])) if (m3.has(h3[j2])) {
      const e4 = y2.get(a2[k2]), t6 = void 0 !== e4 ? d2[e4] : null;
      if (null === t6) {
        const e5 = v2(s3, d2[x2]);
        u2(e5, p3[k2]), v3[k2] = e5;
      } else v3[k2] = u2(t6, p3[k2]), v2(s3, d2[x2], t6), d2[e4] = null;
      k2++;
    } else h2(d2[j2]), j2--;
    else h2(d2[x2]), x2++;
    for (; k2 <= w2; ) {
      const e4 = v2(s3, v3[w2 + 1]);
      u2(e4, p3[k2]), v3[k2++] = e4;
    }
    for (; x2 <= j2; ) {
      const e4 = d2[x2++];
      null !== e4 && h2(e4);
    }
    return this.ut = a2, p2(s3, v3), E;
  }
});

// node_modules/lit-html/directives/style-map.js
var n2 = "important";
var i4 = " !" + n2;
var o3 = e2(class extends i2 {
  constructor(t5) {
    if (super(t5), t5.type !== t2.ATTRIBUTE || "style" !== t5.name || t5.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
  }
  render(t5) {
    return Object.keys(t5).reduce((e4, r2) => {
      const s3 = t5[r2];
      return null == s3 ? e4 : e4 + `${r2 = r2.includes("-") ? r2 : r2.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, "-$&").toLowerCase()}:${s3};`;
    }, "");
  }
  update(e4, [r2]) {
    const { style: s3 } = e4.element;
    if (void 0 === this.ft) return this.ft = new Set(Object.keys(r2)), this.render(r2);
    for (const t5 of this.ft) null == r2[t5] && (this.ft.delete(t5), t5.includes("-") ? s3.removeProperty(t5) : s3[t5] = null);
    for (const t5 in r2) {
      const e5 = r2[t5];
      if (null != e5) {
        this.ft.add(t5);
        const r3 = "string" == typeof e5 && e5.endsWith(i4);
        t5.includes("-") || r3 ? s3.setProperty(t5, r3 ? e5.slice(0, -11) : e5, r3 ? n2 : "") : s3[t5] = e5;
      }
    }
    return E;
  }
});

// nukernel/src/copy/global.ts
var C2 = () => globalThis.COPY;
var t4 = (key, p3) => C2().t(key, p3);
var tn = (key, n3, p3) => C2().tn(key, n3, p3);
var fmt = (n3, unit) => C2().fmt(n3, unit);

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
function pickerFor(n3, opts) {
  if (opts && opts.tight) return coarse() ? "native" : "combo";
  if (n3 <= CHIPMAX) return "chips";
  if (coarse()) return "native";
  if (opts && opts.strip) return "chips";
  return "combo";
}

// nukernel/src/table/model.ts
var KITGROUPS = [
  ["kick", ["nokick", "kickdoubles", "four"]],
  ["snare", [
    "snareonly",
    "backbeat",
    "onthree",
    "stickside",
    "claps",
    "ghosts",
    "flams",
    "drags",
    "roll"
  ]],
  ["hats", ["nohats", "busy", "offbeat", "ride", "pedal", "opens", "shuffle"]],
  ["toms & fills", [
    "tomtime",
    "tomfill",
    "tomrun",
    "tomroll",
    "crash",
    "crashback"
  ]],
  ["dynamics", ["accents", "crescendo", "soft", "loud", "humanize"]],
  ["feel", []]
];
var LANEOF = { k: "kick", s: "snare", h: "hats" };
function groupOf(op) {
  const dot = String(op).indexOf(".");
  if (dot > 0) {
    const g2 = LANEOF[op.slice(0, dot)];
    if (g2) return g2;
  }
  for (const [name, list] of KITGROUPS) if (list.includes(op)) return name;
  return "feel";
}
var REGSTEPS = [-4, -3, -2, -1, 0, 1, 2, 3];
var BARSTEPS = [1, 2, 4, 8, 12, 16, 24, 32];
var REPEATS = [2, 3, 4];
var COMBOKEYS = /* @__PURE__ */ new Set([
  "cast.part",
  "sound.instrument",
  "sound.bassinstrument",
  "sound.drumkit",
  "form.role"
]);
var CHORDCHAIRS = /* @__PURE__ */ new Set(["pad", "stab"]);
function shField(A2, key, scope, label) {
  const sp = A2.sh(key, scope, null);
  if (!sp) return {
    kind: "say",
    label: label || key,
    word: "—",
    why: t4("sheet.noOwner.why")
  };
  const w2 = A2.wcell(sp);
  const base = {
    key: w2.key,
    label: label || sp.label,
    word: w2.label,
    value: w2.value == null ? "" : String(w2.value),
    derived: w2.derived,
    why: w2.why || null,
    options: w2.options,
    set: (v3) => w2.set(v3),
    clear: w2.derived ? null : () => w2.set("")
  };
  if (COMBOKEYS.has(key) || (sp.options || []).length > LONGSTRIP)
    return { ...base, node: A2.combo(sp) };
  return base;
}
function numField(A2, key, label, cur, steps, set, clearable, noneWord) {
  const has = cur !== "" && cur != null;
  const list = steps.slice();
  if (has && !list.includes(+cur)) list.push(+cur);
  list.sort((a2, b2) => a2 - b2);
  return {
    key,
    label,
    word: has ? String(cur) : noneWord || "—",
    value: has ? String(cur) : "",
    derived: !has,
    options: [
      ...clearable ? [{ v: "", w: noneWord || t4("value.none") }] : [],
      ...list.map((n3) => ({ v: String(n3), w: String(n3) }))
    ],
    /* ...AND IT IS A SLIDER (2026-09-05). Paul: *"When you redesign think
       sliders and other UI for data entry."* Every caller of this function
       hands it a QUANTITY on a run — a register from −4 to 3, a bar to come in
       at, a bar count — and the strip drew each one as a row of chips, which is
       a ruler cut into buttons. `options` stays, because the address and the
       vocabulary are what the inventory and T7 read; `num` is what
       `sheet.ts pickerFor` now answers "slider" to. The RANGE is the whole run
       and not just the offered steps, so the thumb can reach a number the
       chips never offered — which is what a slider is FOR. */
    num: {
      min: list.length ? list[0] : 0,
      max: list.length ? list[list.length - 1] : 1,
      step: 1,
      unit: "",
      derivedNum: has ? +cur : null
    },
    set,
    clear: clearable && has ? () => set("") : null
  };
}
var ENTRYBARS = 8;
function entryNum(A2, cur, ghost) {
  const B2 = A2.barBeats();
  const bpb = B2.beats > 0 ? B2.beats : 4;
  const toBeats = (bars) => Math.round(bars * bpb / B2.step) * B2.step;
  const top = Math.max(
    ENTRYBARS * bpb,
    ...[cur, ghost].filter((x2) => x2 != null).map(toBeats)
  );
  return { bpb, B: B2, top, toBeats };
}
function cellNum(A2, i5, vi, field, label, steps) {
  const own = A2.cellOf(i5, vi, field);
  const inh = A2.resolve(i5, vi, field);
  const has = own != null;
  const list = steps.slice();
  for (const n3 of [own, inh]) if (n3 != null && !list.includes(+n3)) list.push(+n3);
  list.sort((a2, b2) => a2 - b2);
  return {
    key: "tcellnum|" + field + "|" + vi + "|" + i5,
    label,
    word: has ? String(own) : inh == null ? "—" : String(inh),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : t4("value.defaultCap"),
    options: [
      { v: "", w: t4("value.default") },
      ...list.map((n3) => ({ v: String(n3), w: String(n3) }))
    ],
    /* THE CELL'S OVERRIDE IS A QUANTITY TOO, and the slider's ghost value is
       what the column deals — so pushing the thumb off the inherited number is
       visibly a departure from it. */
    num: {
      min: list.length ? list[0] : 0,
      max: list.length ? list[list.length - 1] : 1,
      step: 1,
      unit: "",
      derivedNum: inh == null ? null : +inh
    },
    set: (v3) => A2.putCell(i5, vi, field, v3 === "" ? null : +v3),
    clear: has ? () => A2.putCell(i5, vi, field, null) : null
  };
}
function cellEntry(A2, i5, vi) {
  const own = A2.cellOf(i5, vi, "entry");
  const inh = A2.resolve(i5, vi, "entry");
  const E2 = entryNum(A2, own, inh);
  const mine = own == null ? null : E2.toBeats(own);
  const ghost = inh == null ? 0 : E2.toBeats(inh);
  return {
    key: "tcellnum|entry|" + vi + "|" + i5,
    label: t4("col.entry"),
    word: String(mine == null ? ghost : mine),
    value: mine == null ? "" : String(mine),
    derived: mine == null,
    sub: mine == null ? t4("value.defaultCap") : null,
    options: [
      { v: "", w: t4("value.default") },
      ...[0, 1, 2, 4, 8].map((n3) => ({
        v: String(n3 * E2.bpb),
        w: String(n3 * E2.bpb)
      }))
    ],
    num: {
      min: 0,
      max: E2.top,
      step: E2.B.step,
      unit: t4("unit.beats"),
      derivedNum: ghost
    },
    set: (x2) => A2.putCell(i5, vi, "entry", x2 === "" ? null : +x2 / E2.bpb),
    clear: mine == null ? null : () => A2.putCell(i5, vi, "entry", null)
  };
}
function cellLane(A2, i5, vi, spec) {
  const read = () => A2.cellOf(i5, vi, "mixauto") || {};
  const now = read()[spec.key];
  const cur = now == null ? "" : String(now);
  const has = cur !== "";
  const put = (w2) => {
    const next = { ...read() };
    if (w2 === "") delete next[spec.key];
    else next[spec.key] = w2;
    A2.putCell(i5, vi, "mixauto", Object.keys(next).length ? next : null);
  };
  const words = Object.keys(spec.table).filter((k2) => spec.table[k2]);
  return {
    key: "tcellauto|" + spec.key + "|" + vi + "|" + i5,
    label: t4("cell.lane.label", { name: spec.label }),
    word: has ? spec.labels[cur] || cur : t4("value.default"),
    value: cur,
    derived: !has,
    /* NO CAPTION UNDER IT. The word IS "default" now, and a second line
       saying the same thing is the prose test/text-diet.test.js takes off. */
    sub: null,
    options: [
      { v: "", w: t4("value.default") },
      ...words.map((k2) => ({ v: k2, w: spec.labels[k2] || k2 }))
    ],
    set: (v3) => put(v3 || ""),
    clear: has ? () => put("") : null
  };
}
function cellVecField(A2, i5, vi, spec) {
  const own = A2.cellOf(i5, vi, spec.key);
  const row = A2.rowOf ? A2.rowOf(i5, spec.key) : null;
  const has = own != null && own !== "";
  const wordOf2 = (k2) => k2 == null || k2 === "" ? null : String(spec.labels[String(k2)] || k2);
  const words = Object.keys(spec.table).filter((k2) => k2 !== spec.neutral);
  return {
    key: "tcellvec|" + spec.key + "|" + vi + "|" + i5,
    label: spec.label,
    word: has ? wordOf2(own) : wordOf2(row) || t4("value.default"),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : spec.none || t4("value.defaultCap"),
    options: [
      { v: "", w: spec.none || t4("value.default") },
      ...words.map((k2) => ({ v: k2, w: String(spec.labels[k2] || k2) }))
    ],
    set: (v3) => A2.putCell(i5, vi, spec.key, v3 === "" ? null : v3),
    clear: has ? () => A2.putCell(i5, vi, spec.key, null) : null
  };
}
var rampWhy = () => t4("cell.ramp.why");
function cellVecSay(A2, i5, vi, spec, chordChair) {
  const own = A2.cellOf(i5, vi, spec.key);
  const row = A2.rowOf ? A2.rowOf(i5, spec.key) : null;
  const said = own != null ? own : row;
  return {
    kind: "say",
    label: spec.label,
    word: said == null ? t4("value.default") : String(spec.labels[String(said)] || said),
    why: chordChair ? t4("cell.chordPart.why") : rampWhy()
  };
}
function rowVecSay(A2, i5, spec) {
  const said = A2.rowOf ? A2.rowOf(i5, spec.key) : null;
  return {
    kind: "say",
    label: spec.label,
    word: said == null ? t4("value.default") : String(spec.labels[String(said)] || said),
    why: rampWhy()
  };
}
function groupsFor(options) {
  const by = /* @__PURE__ */ new Map();
  for (const o4 of options) {
    if (o4.v === "" || o4.v == null) continue;
    const g2 = groupOf(String(o4.v));
    if (!by.has(g2)) by.set(g2, []);
    by.get(g2).push(String(o4.v));
  }
  const out = [];
  for (const [name] of KITGROUPS) if (by.has(name)) out.push({ word: name, vals: by.get(name) });
  for (const [name, vals] of by) if (!out.find((x2) => x2.word === name)) out.push({ word: name, vals });
  return out;
}
function rowSheet(A2, i5) {
  const secs = A2.doc().form.sections;
  const s3 = secs[i5];
  const sid = s3.id;
  const f2 = [];
  f2.push({ kind: "ops", label: t4("row.ops"), ops: rowOps(A2, i5, s3) });
  f2.push(shField(A2, "form.role", { section: sid }, t4("row.type")));
  f2.push(numField(
    A2,
    "bars|" + sid,
    t4("row.bars"),
    s3.bars,
    BARSTEPS,
    (v3) => A2.putRow(i5, "bars", +v3),
    false
  ));
  for (const [key, lab] of [
    ["form.lvl", t4("field.level")],
    ["form.env", t4("field.dynamics")],
    ["form.intro", t4("field.intro")],
    ["form.outro", t4("field.outro")],
    ["form.mot", t4("noun.automation")],
    ["form.pace", t4("noun.feel")],
    ["development.period", t4("field.phraseStructure")],
    ["development.breath", t4("row.noteLimit")],
    ["development.pipe", t4("row.pipe")]
  ])
    f2.push(shField(A2, key, { section: sid }, lab));
  for (const key of [
    "form.key",
    "form.mode",
    "form.prog",
    "form.swing",
    "form.groove"
  ]) {
    f2.push(shField(A2, key, { section: sid }, null));
    if (key === "form.prog")
      f2.push({
        kind: "node",
        label: t4("row.chart"),
        node: A2.changesNode(sid)
      });
  }
  for (const key of [
    "form.fx",
    "form.rev",
    "form.echo",
    "form.dtime",
    "form.room",
    "form.pan"
  ])
    f2.push(shField(A2, key, { section: sid }, null));
  for (const spec of A2.CELLVEC || []) {
    if (spec.key === "clamp") {
      f2.push(rowVecSay(A2, i5, spec));
      continue;
    }
    if (A2.hasSheet("form." + spec.key, { section: sid }))
      f2.push(shField(A2, "form." + spec.key, { section: sid }, spec.label));
  }
  f2.push(numField(
    A2,
    "nudge|" + sid,
    t4("row.startsAt"),
    s3.nudge || 0,
    [0, 1, 2, 3, 4, 6, 8],
    (v3) => A2.putRow(i5, "nudge", +v3),
    true
  ));
  const auto = s3.auto || [];
  f2.push({
    kind: "say",
    label: t4("row.lanes"),
    word: auto.length ? tn("row.lanes", auto.length) : t4("value.none"),
    why: t4("row.lanes.why")
  });
  return f2;
}
function colSheet(A2, vi) {
  const v3 = A2.doc().voices[vi];
  const f2 = [];
  f2.push({ kind: "ops", label: t4("col.ops"), ops: colOps(A2, vi, v3) });
  if (v3.kind === "line") f2.push(shField(A2, "cast.part", { voice: v3.name }, t4("col.plays")));
  const ik = v3.kind === "bass" ? "sound.bassinstrument" : v3.kind === "drums" ? "sound.drumkit" : "sound.instrument";
  f2.push(shField(
    A2,
    ik,
    { voice: v3.name },
    v3.kind === "drums" ? t4("col.machine") : t4("noun.instrument")
  ));
  if (v3.kind === "drums") {
    const on = A2.castOf(vi, "on") !== false;
    f2.push({
      key: "drums",
      label: t4("col.drummer"),
      word: on ? t4("state.playing") : t4("col.drummer.off"),
      value: on ? "1" : "",
      derived: false,
      options: [
        { v: "1", w: t4("state.playing") },
        { v: "", w: t4("col.drummer.off") }
      ],
      set: (x2) => A2.putCast(vi, "on", !!x2)
    });
  }
  if (A2.hasCrate(v3.name))
    f2.push({ kind: "node", label: t4("col.files"), node: A2.voiceCrate(v3.name) });
  if (v3.kind === "line")
    f2.push(shField(A2, "cast.material", { voice: v3.name }, t4("col.material")));
  if (v3.kind === "bass")
    f2.push(shField(A2, "cast.bassStyle", { voice: v3.name }, t4("col.bassStyle")));
  const env = A2.voiceEnv(v3.name);
  if (env) f2.push({ kind: "node", label: env.label, node: env.node });
  for (const k2 of env ? ["sound.double", "sound.looping"] : ["sound.attack", "sound.release", "sound.double", "sound.looping"])
    if (A2.hasSheet(k2, { voice: v3.name })) f2.push(shField(A2, k2, { voice: v3.name }, null));
  const kn = A2.voiceKnobs(v3.name);
  if (kn) f2.push({ kind: "node", label: kn.label, node: kn.node });
  const th = A2.throat(vi);
  if (th) f2.push({
    key: "throat|" + v3.name,
    label: t4("col.throat"),
    word: th.word,
    value: th.own,
    derived: !th.own,
    options: [
      { v: "", w: t4("value.default") },
      ...th.words.map((w2) => ({ v: w2, w: w2 }))
    ],
    set: (x2) => A2.putCast(vi, "voice", x2 || null),
    clear: th.own ? () => A2.putCast(vi, "voice", null) : null
  });
  const reg = A2.castOf(vi, "reg");
  f2.push(numField(
    A2,
    "reg|" + v3.name,
    t4("col.register"),
    reg == null ? "" : reg,
    REGSTEPS,
    (x2) => A2.putCast(vi, "reg", x2 === "" ? null : +x2),
    true,
    t4("value.default")
  ));
  const en = A2.castOf(vi, "entry");
  {
    const E2 = entryNum(A2, en, null);
    const beats = en == null ? null : E2.toBeats(en);
    f2.push({
      key: "entry|" + v3.name,
      label: t4("col.entry"),
      word: beats == null ? t4("col.entry.none") : String(beats),
      value: beats == null ? "" : String(beats),
      derived: beats == null,
      options: [
        { v: "", w: t4("col.entry.none") },
        ...[0, 1, 2, 4, 8].map((n3) => ({
          v: String(n3 * E2.bpb),
          w: String(n3 * E2.bpb)
        }))
      ],
      num: {
        min: 0,
        max: E2.top,
        step: E2.B.step,
        unit: t4("unit.beats"),
        derivedNum: 0
      },
      set: (x2) => A2.putCast(
        vi,
        "entry",
        x2 === "" ? null : +x2 / E2.bpb
      ),
      clear: beats == null ? null : () => A2.putCast(vi, "entry", null)
    });
  }
  f2.push({ kind: "ops", label: t4("col.desk"), ops: [
    {
      k: "tseat|" + v3.name,
      word: t4("col.seat.word"),
      aria: t4("col.seat.aria", { name: v3.name }),
      act: () => A2.showSeat(v3.name)
    },
    {
      k: "tbuses|" + v3.name,
      word: t4("master.buses"),
      aria: t4("col.buses.aria", { name: v3.name }),
      act: () => A2.showBoard()
    }
  ] });
  return f2;
}
function cellSheet(A2, i5, vi) {
  const doc = A2.doc();
  const s3 = doc.form.sections[i5], v3 = doc.voices[vi];
  const sid = s3.id;
  const f2 = [];
  f2.push({ kind: "ops", label: t4("cell.ops"), ops: cellOps(A2, i5, vi) });
  if (v3.kind === "bass") {
    const b2 = A2.bassReads();
    f2.push({
      kind: "say",
      label: t4("special.phrases.word"),
      word: b2 && b2.cell ? t4("cell.bass.reads", { value: b2.cell, lead: b2.lead }) : t4("cell.bass.readsNone"),
      why: t4("cell.bass.why")
    });
  }
  const reads = v3.kind === "bass" ? null : A2.sh(
    "material.cell",
    { voice: v3.name, section: sid },
    t4("cell.sheet.plays", { name: v3.name, section: A2.secName(i5) })
  );
  if (reads) {
    const w2 = A2.wcell(reads);
    const options = w2.options.map((o4) => o4.v === "" || o4.v == null ? o4 : {
      ...o4,
      pv: A2.previewOf(String(o4.v)),
      prov: A2.provWord(String(o4.v))
    });
    f2.push({
      key: w2.key,
      label: t4("special.phrases.word"),
      word: w2.derived ? A2.cellWord(i5, vi) : w2.label,
      value: w2.value == null ? "" : String(w2.value),
      derived: w2.derived,
      options,
      set: (x2) => w2.set(x2),
      why: w2.why || null,
      clear: w2.derived ? null : () => w2.set("")
    });
  }
  const dev = A2.sh(
    A2.devSheetFor(v3.kind),
    { voice: v3.name, section: sid },
    t4("cell.sheet.variation", {
      name: v3.name,
      section: A2.secName(i5)
    })
  );
  if (dev) {
    const w2 = A2.wcell(dev);
    const fld = {
      key: w2.key,
      label: t4("noun.variation"),
      word: w2.label,
      value: w2.value == null ? "" : String(w2.value),
      derived: w2.derived,
      options: w2.options,
      set: (x2) => w2.set(x2),
      why: w2.why || null,
      clear: w2.derived ? null : () => w2.set("")
    };
    if (v3.kind === "drums") fld.groups = groupsFor(w2.options);
    f2.push(fld);
  }
  f2.push(cellEntry(A2, i5, vi));
  f2.push(cellNum(A2, i5, vi, "reg", t4("col.register"), REGSTEPS));
  f2.push({
    kind: "say",
    label: t4("cell.focus"),
    word: A2.cellOf(i5, vi, "focus") ? t4("cell.focus.on") : t4("cell.focus.off"),
    why: t4("cell.focus.why")
  });
  for (const spec of A2.CELLAUTO || []) f2.push(cellLane(A2, i5, vi, spec));
  if (v3.kind === "line") {
    const chordChair = CHORDCHAIRS.has(String(A2.castOf(vi, "part") || ""));
    for (const spec of A2.CELLVEC || [])
      f2.push(spec.key === "clamp" || chordChair && (spec.key === "artic" || spec.key === "scale") ? cellVecSay(A2, i5, vi, spec, chordChair && spec.key !== "clamp") : cellVecField(A2, i5, vi, spec));
  } else f2.push({
    kind: "say",
    label: t4("cell.pitchedOnly.label"),
    word: t4("cell.pitchedOnly.word"),
    why: t4("cell.pitchedOnly.why")
  });
  return f2;
}
function perfCells(A2) {
  return A2.PERFROWS.map((p3) => {
    const sp = A2.sh(p3.key, {}, p3.label);
    if (!sp) return { kind: "say", label: p3.label, word: "—" };
    const w2 = A2.wcell(sp);
    return {
      key: w2.key,
      label: p3.label,
      word: t4("perf.cell", { short: p3.short, value: w2.label }),
      value: w2.value == null ? "" : String(w2.value),
      derived: w2.derived,
      options: w2.options,
      set: (x2) => w2.set(x2),
      why: w2.why || null,
      clear: w2.derived ? null : () => w2.set("")
    };
  });
}
function perfSheet(A2) {
  return [
    /* A TAKE IS ONE WHEN NOTHING IS SAID, NOT NOUGHT (fixed 2026-09-04). It
       read `|| 0`, so an untouched record printed "0" and the strip grew a
       `take|0` chip — a word a hand could tap that writes a take the record
       cannot hold (`takeSeed` is `Math.max(1, take|0)`). */
    numField(
      A2,
      "take",
      t4("noun.take"),
      A2.perfOf("take") || 1,
      [1, 2, 3, 4, 5, 6, 8, 12],
      (v3) => A2.putPerf("take", +v3),
      false
    ),
    numField(
      A2,
      "humanize",
      t4("perf.humanize"),
      A2.perfOf("humanize") == null ? "" : A2.perfOf("humanize"),
      [0, 0.2, 0.4, 0.6, 0.8, 1],
      (v3) => A2.putPerf("humanize", v3 === "" ? null : +v3),
      true,
      t4("value.default")
    ),
    {
      key: "ontime",
      label: t4("perf.ontime"),
      word: A2.perfOf("ontime") ? t4("perf.ontime.on") : t4("perf.ontime.off"),
      value: A2.perfOf("ontime") ? "1" : "",
      derived: !A2.perfOf("ontime"),
      options: [
        { v: "", w: t4("perf.ontime.off") },
        { v: "1", w: t4("perf.ontime.on") }
      ],
      set: (v3) => A2.putPerf("ontime", v3 ? true : null),
      clear: A2.perfOf("ontime") ? () => A2.putPerf("ontime", null) : null
    }
  ];
}
function rowOps(A2, i5, s3) {
  const n3 = A2.doc().form.sections.length;
  return [
    /* PUT THE EAR HERE — Paul, B11: *"I need to be able to jump to a section
       somehow."* The five Structure grids answered that on their ROW HEADS and
       the head is a door on this table. `CTX.playFrom` is the one play door:
       cold it seeks, playing it QUEUES on the next box line. */
    {
      k: "trow-here|" + s3.id,
      word: t4("op.playFrom"),
      aria: t4("op.playFrom.aria"),
      act: () => A2.playFrom(i5)
    },
    {
      k: "trow-add",
      word: t4("op.addSection"),
      aria: t4("op.addSection.after"),
      act: () => A2.addSection(i5 + 1)
    },
    {
      k: "trow-up|" + s3.id,
      word: t4("op.up"),
      aria: t4("op.up.aria"),
      why: i5 === 0 ? t4("refuse.alreadyFirst") : null,
      act: () => A2.moveSection(i5, -1)
    },
    {
      k: "trow-down|" + s3.id,
      word: t4("op.down"),
      aria: t4("op.down.aria"),
      why: i5 === n3 - 1 ? t4("refuse.alreadyLast") : null,
      act: () => A2.moveSection(i5, 1)
    },
    {
      k: "trow-dup|" + s3.id,
      word: t4("op.duplicate"),
      aria: t4("op.duplicate.aria"),
      act: () => A2.dupSection(s3.id)
    },
    ...REPEATS.map((r2) => ({
      k: "trow-rep|" + s3.id + "|" + r2,
      word: t4("op.repeat", { n: r2 }),
      aria: t4("op.repeat.aria", { n: r2 }),
      act: () => A2.repeatSection(s3.id, r2)
    })),
    {
      k: "trow-deal|" + s3.id,
      word: t4("op.reset"),
      aria: t4("op.resetRow.aria"),
      act: () => A2.dealRow(i5)
    },
    {
      k: "trow-del|" + s3.id,
      word: t4("op.deleteSection"),
      aria: t4("op.deleteSection.aria"),
      why: n3 <= 1 ? t4("refuse.lastSection") : null,
      act: () => A2.dropSection(s3.id)
    }
  ];
}
function colOps(A2, vi, v3) {
  const n3 = A2.doc().voices.length;
  return [
    {
      k: "tcol-solo|" + v3.name,
      word: t4("op.solo"),
      aria: t4("op.solo.aria", { name: v3.name }),
      act: () => A2.soloVoice(v3.name)
    },
    {
      k: "tcol-add|line",
      word: t4("op.addLine"),
      aria: t4("op.addLine.aria"),
      act: () => A2.addVoice("line")
    },
    {
      k: "tcol-add|bass",
      word: t4("op.addBass"),
      aria: t4("op.addBass.aria"),
      why: A2.hasKind("bass") ? t4("refuse.haveBass") : null,
      act: () => A2.addVoice("bass")
    },
    {
      k: "tcol-add|drums",
      word: t4("op.addDrums"),
      aria: t4("op.addDrums.aria"),
      why: A2.hasKind("drums") ? t4("refuse.haveDrums") : null,
      act: () => A2.addVoice("drums")
    },
    {
      k: "tcol-left|" + v3.name,
      word: t4("op.left"),
      aria: t4("op.left.aria"),
      why: vi === 0 ? t4("refuse.alreadyFirst") : null,
      act: () => A2.moveVoice(vi, -1)
    },
    {
      k: "tcol-right|" + v3.name,
      word: t4("op.right"),
      aria: t4("op.right.aria"),
      why: vi === n3 - 1 ? t4("refuse.alreadyLast") : null,
      act: () => A2.moveVoice(vi, 1)
    },
    {
      k: "tcol-deal|" + v3.name,
      word: t4("op.reset"),
      aria: t4("op.resetCol.aria"),
      act: () => A2.dealCol(vi)
    },
    /* "MAKE X Y" IS A COLUMN OP NOW (5). ui/produce.js owns the verb and its
       qualities; what the table adds is the X — the column you opened is the
       subject, so the sentence is already half said when you get there. */
    ...A2.makeQualities(v3.name).map((q) => ({
      k: "tcol-make|" + v3.name + "|" + q.v,
      word: q.w,
      aria: t4("op.make.aria", { name: v3.name, quality: q.w }),
      why: q.why || null,
      act: () => A2.makeXY(v3.name, q.v)
    })),
    {
      k: "tcol-del|" + v3.name,
      word: t4("op.remove"),
      aria: t4("op.remove.aria", { name: v3.name }),
      why: n3 <= 1 ? t4("refuse.lastPlayer") : null,
      act: () => A2.dropVoice(v3.name)
    }
  ];
}
function cellOps(A2, i5, vi) {
  const doc = A2.doc();
  const v3 = doc.voices[vi], s3 = doc.form.sections[i5];
  return [
    {
      k: "tcell-clear|" + v3.name + "|" + s3.id,
      word: t4("op.clearCell"),
      aria: t4("op.clearCell.aria"),
      why: A2.written(i5, vi) ? null : t4("refuse.nothingToClear"),
      act: () => A2.clearCell(i5, vi)
    },
    /* FILL RIGHT AND FILL DOWN ARE 5's COPY-TO-ROW AND COPY-TO-COLUMN, said in
       a spreadsheet's own words (9a). One door each, unchanged. */
    {
      k: "tcell-copyrow|" + v3.name + "|" + s3.id,
      word: t4("op.fillRow"),
      aria: t4("op.fillRow.aria"),
      act: () => A2.copyCell(i5, vi, "row")
    },
    {
      k: "tcell-copycol|" + v3.name + "|" + s3.id,
      word: t4("op.fillCol"),
      aria: t4("op.fillCol.aria"),
      act: () => A2.copyCell(i5, vi, "col")
    }
  ];
}
function tableOps(A2, across) {
  return [
    {
      k: "ttab-fill",
      word: t4("op.fillGenre"),
      aria: t4("op.fillGenre.aria"),
      act: () => A2.fillFromGenre()
    },
    {
      k: "ttab-seed",
      word: t4("op.reseed"),
      aria: t4("op.reseed.aria"),
      act: () => A2.reseed()
    },
    {
      k: "ttab-transpose",
      word: across ? t4("op.transposeSections") : t4("op.transposePlayers"),
      aria: across ? t4("op.transposeSections.aria") : t4("op.transposePlayers.aria"),
      act: () => A2.setFacing(across ? "sections" : "voices")
    }
  ];
}
function playerOffers(A2) {
  return [
    {
      k: "tcol-add|line",
      word: t4("op.addLine"),
      aria: t4("op.addLine.aria"),
      act: () => A2.addVoice("line")
    },
    {
      k: "tcol-add|bass",
      word: t4("op.addBass"),
      aria: t4("op.addBass.aria"),
      why: A2.hasKind("bass") ? t4("refuse.haveBass") : null,
      act: () => A2.addVoice("bass")
    },
    {
      k: "tcol-add|drums",
      word: t4("op.addDrums"),
      aria: t4("op.addDrums.aria"),
      why: A2.hasKind("drums") ? t4("refuse.haveDrums") : null,
      act: () => A2.addVoice("drums")
    }
  ];
}
function sectionOffer(A2) {
  const n3 = A2.doc().form.sections.length;
  return [{
    k: "trow-add",
    word: t4("op.addSection"),
    aria: t4("op.addSection.end"),
    act: () => A2.addSection(n3)
  }];
}

// nukernel/src/table/sheet.ts
function pickerFor2(f2) {
  if (f2.node) return "combo";
  if (f2.num) return "slider";
  return pickerFor((f2.options || []).length, { strip: true });
}
var wordOf = (f2) => f2.word == null || f2.word === "" ? "—" : String(f2.word);
var valueAria = (value, derived) => derived ? t4("value.defaultAria", { value }) : value;
function chipAria(word, why, prov) {
  if (why && prov) return t4("sheet.chip.whyProv", { name: word, why, prov });
  if (why) return t4("sheet.refused", { name: word, why });
  if (prov) return t4("sheet.chip.prov", { name: word, prov });
  return word;
}
function chipStrip(f2, onWrite) {
  const cur = f2.value == null ? "" : String(f2.value);
  const chip = (o4) => {
    const v3 = String(o4.v == null ? "" : o4.v);
    const w2 = o4.w == null ? v3 : String(o4.w);
    const cellWhy = f2.why || null;
    const hard = !!cellWhy;
    const off = !hard && !!o4.off && v3 !== cur;
    const why = hard ? cellWhy : off ? o4.why || "" : o4.why || null;
    return b`<button type="button"
      class=${e3({ "nu-wchip": true, "is-quiet": !!o4.quiet })}
      data-k=${f2.key + "|" + v3}
      aria-pressed=${String(v3 === cur)}
      ?disabled=${hard || off}
      aria-disabled=${o2(hard || off ? "true" : void 0)}
      data-why=${o2(why == null ? void 0 : why)}
      title=${o2(why ? why : void 0)}
      aria-label=${chipAria(
      w2,
      hard ? cellWhy : off ? o4.why || null : null,
      o4.prov || null
    )}
      @click=${() => {
      if (hard || off) return;
      onWrite(v3);
    }}
      >${o4.pv ? o4.pv : A}<span class="nu-chipword">${w2}</span
      >${o4.prov ? b`<small class="nu-chipprov">${o4.prov}</small>` : A}</button> `;
  };
  const all = f2.options || [];
  if (!f2.groups || !f2.groups.length)
    return b`<div class="nu-wchips" role="group"
      aria-label=${f2.label}>${all.map(chip)}</div>`;
  const want = groupWords(f2, cur);
  const isPin = (o4) => {
    const v3 = String(o4.v == null ? "" : o4.v);
    return v3 === cur || v3 === "";
  };
  return b`<div class="nu-wgroups">
    <div class="nu-groupbar" role="group" aria-label=${t4("sheet.groups.aria")}>
      ${f2.groups.map((g2) => b`<button type="button" class="nu-groupbtn"
        data-g=${g2.word} data-k=${f2.key + "|group|" + g2.word}
        aria-pressed=${String(g2.word === want)}
        @click=${() => {
    GROUPOPEN.set(f2.key, g2.word === want ? "" : g2.word);
    if (REDRAW) REDRAW();
  }}>${g2.word}</button> `)}
    </div>
    <div class="nu-wchips nu-pinned" role="group"
      aria-label=${t4("sheet.pinned.aria")}>${all.filter(isPin).map(chip)}</div>
    <div class="nu-wchips" role="group" aria-label=${f2.label}>${all.filter((o4) => !isPin(o4)).map((o4) => {
    const v3 = String(o4.v == null ? "" : o4.v);
    const g2 = (f2.groups || []).find((gg) => gg.vals.includes(v3));
    const inGroup = !!want && !!g2 && g2.word === want;
    return b`<span style=${inGroup ? "" : "display:none"}>${chip(o4)}</span>`;
  })}</div>
  </div>`;
}
var GROUPOPEN = /* @__PURE__ */ new Map();
function groupWords(f2, cur) {
  const saved = GROUPOPEN.get(f2.key);
  if (saved != null) return saved;
  const g2 = (f2.groups || []).find((x2) => x2.vals.includes(cur));
  return (g2 || (f2.groups || [])[0] || { word: "" }).word;
}
var REDRAW = null;
function onRedraw(fn) {
  REDRAW = fn;
}
function sheetBody(fields, name, openField, setOpenField, after) {
  return b`<div class="nu-vsheet" role="group" aria-label=${name}>${fields.map((f2) => fieldRow(f2, openField, setOpenField, after))}</div>`;
}
function fieldRow(f2, openField, setOpenField, after) {
  if (f2.kind === "ops") {
    const o4 = f2;
    return b`<div class="nu-sheetrow nu-sheetops">
      ${o4.label ? b`<b class="nu-sheetlab">${o4.label}</b>` : A}
      <div class="nu-opbar">${o4.ops.map((op) => b`<button type="button"
        class="nu-opbtn" data-k=${op.k}
        ?disabled=${!!op.why}
        aria-disabled=${o2(op.why ? "true" : void 0)}
        data-why=${o2(op.why || void 0)}
        title=${o2(op.why || void 0)}
        aria-label=${op.why ? t4(
      "sheet.refused",
      { name: op.aria || op.word, why: op.why }
    ) : op.aria || op.word}
        @click=${() => {
      if (op.why || !op.act) return;
      try {
        op.act();
      } catch (e4) {
      }
    }}>${op.word}</button>`)}</div>
    </div>`;
  }
  if (f2.kind === "node") {
    const n3 = f2;
    return b`<div class="nu-sheetrow nu-noderow">
      ${n3.label ? b`<b class="nu-sheetlab">${n3.label}</b>` : A}
      ${n3.node ? n3.node : A}
    </div>`;
  }
  if (f2.kind === "say" || !f2.options || !f2.options.length) {
    const s3 = f2;
    return b`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${s3.label}</b>
      <span class=${e3({ "nu-sheetsay": true, "is-refused": !!s3.why })}
        data-why=${o2(s3.why || void 0)}
        title=${o2(s3.why || void 0)}
        aria-label=${s3.why ? t4("sheet.say.refused", { name: s3.label, value: wordOf(s3), why: s3.why }) : t4("sheet.field", { name: s3.label, value: wordOf(s3) })}>${wordOf(s3)}</span>
      ${s3.sub ? b`<small class="nu-sheetsub">${s3.sub}</small>` : A}
    </div>`;
  }
  const sf = f2;
  const pick = pickerFor2(sf);
  const open = openField === sf.key;
  const write = (v3) => {
    try {
      if (sf.set) sf.set(v3);
    } catch (e4) {
    }
    after();
  };
  const clearBack = sf.clear && !sf.derived ? b`<button type="button" class="nu-clearback" data-k=${"clear|" + sf.key}
        aria-label=${t4("sheet.clearBack.aria", { name: sf.label })}
        @click=${() => {
    try {
      sf.clear();
    } catch (e4) {
    }
    after();
  }}>${t4("act.clear")}</button>` : A;
  if (pick === "combo")
    return b`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>${sf.node}${clearBack}
      ${sf.sub ? b`<small class="nu-sheetsub">${sf.sub}</small>` : A}
    </div>`;
  if (pick === "slider") {
    const N2 = sf.num;
    const cur = sf.value === "" || sf.value == null ? null : +sf.value;
    const shown = cur != null ? cur : N2.derivedNum != null ? N2.derivedNum : N2.min;
    const slide = (v3) => {
      try {
        if (sf.set) sf.set(v3);
      } catch (e4) {
      }
      after();
    };
    return b`<div class="nu-sheetrow nu-numrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <input class="nu-numslide" type="range" data-k=${sf.key}
        min=${String(N2.min)} max=${String(N2.max)} step=${String(N2.step)}
        .value=${String(shown)}
        aria-label=${N2.unit ? t4(
      "sheet.slider.unit.aria",
      { name: sf.label, unit: N2.unit }
    ) : t4("head.name", { name: sf.label })}
        aria-valuetext=${valueAria(fmt(shown, N2.unit || void 0), cur == null)}
        @input=${(e4) => {
      const box = e4.target.parentElement?.querySelector(".nu-numbox");
      if (box) box.value = e4.target.value;
    }}
        @change=${(e4) => slide(e4.target.value)} />
      <input class=${e3({ "nu-numbox": true, "is-derived": cur == null })}
        type="number" data-k=${"num|" + sf.key}
        min=${String(N2.min)} max=${String(N2.max)} step=${String(N2.step)}
        .value=${String(shown)}
        aria-label=${t4("sheet.numbox.aria", { name: sf.label })}
        @change=${(e4) => slide(e4.target.value)} />
      ${N2.unit ? b`<small class="nu-numunit">${N2.unit}</small>` : A}
      ${clearBack}
      ${sf.sub ? b`<small class="nu-sheetsub">${sf.sub}</small>` : A}
    </div>`;
  }
  if (pick === "native")
    return b`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <select class="nu-wcell nu-trimbtn nu-nativepick" data-k=${sf.key}
        aria-label=${sf.label}
        .value=${sf.value == null ? "" : String(sf.value)}
        @change=${(e4) => write(e4.target.value)}>${(sf.options || []).map((o4) => b`<option
          value=${String(o4.v == null ? "" : o4.v)}
          ?disabled=${!!o4.off}>${o4.w == null ? String(o4.v) : o4.w}</option>`)}
      </select>${clearBack}
      ${sf.sub ? b`<small class="nu-sheetsub">${sf.sub}</small>` : A}
    </div>`;
  return b`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <button type="button"
        class=${e3({
    "nu-wcell": true,
    "nu-trimbtn": true,
    "is-derived": !!sf.derived,
    "is-refused": !!sf.why
  })}
        data-k=${sf.key}
        aria-expanded=${String(open)}
        aria-disabled=${o2(sf.why ? "true" : void 0)}
        data-why=${o2(sf.why || void 0)}
        title=${o2(sf.why || void 0)}
        aria-label=${sf.why ? t4("sheet.field.refused", { name: sf.label, why: sf.why }) : t4("sheet.field", {
    name: sf.label,
    value: valueAria(wordOf(sf), !!sf.derived)
  })}
        @click=${() => setOpenField(open ? null : sf.key)}>${wordOf(sf)}</button>
      ${clearBack}
      ${sf.sub ? b`<small class="nu-sheetsub">${sf.sub}</small>` : A}
    </div>${open ? chipStrip(sf, write) : A}`;
}

// nukernel/src/table/special.ts
var SEATED = /* @__PURE__ */ new Set([
  "time.meter",
  "time.swing",
  "time.groove",
  "alphabet.mode",
  "alphabet.scale",
  "alphabet.harmony"
]);
function seated(A2, key, label) {
  const f2 = shField(A2, key, {}, label);
  const s3 = f2;
  if (!s3.key || s3.node || !SEATED.has(key)) return f2;
  const sp = A2.sh(key, {}, null);
  return sp ? { ...s3, node: A2.menuWide(sp) } : f2;
}
function flagField(key, label, on, offWord, onWord, set, sub) {
  return {
    key,
    label,
    word: on ? onWord : offWord,
    value: on ? "1" : "",
    derived: false,
    sub: sub || null,
    options: [
      { v: "", w: offWord },
      { v: "1", w: onWord }
    ],
    set: (v3) => set(!!v3)
  };
}
function timeFace(A2) {
  const doc = A2.doc();
  const w2 = (key2) => {
    const sp = A2.sh(key2, {}, null);
    if (!sp) return "";
    const c3 = A2.wcell(sp);
    return c3.label == null ? "" : String(c3.label);
  };
  const bpm = doc.time && doc.time.bpm != null ? fmt(doc.time.bpm, "BPM") : "—";
  const key = [w2("alphabet.key"), w2("alphabet.mode")].filter(Boolean).join(" ");
  return [bpm, w2("time.meter"), key].filter(Boolean).join(" · ");
}
function timeSheet(A2) {
  const f2 = [];
  f2.push({ kind: "node", label: t4("field.tempo"), node: A2.bpmNode() });
  f2.push({ kind: "node", label: t4("time.byHand"), node: A2.tempoNode() });
  f2.push(seated(A2, "time.meter", t4("noun.meter")));
  f2.push({ kind: "node", label: t4("time.signature"), node: A2.meterNode() });
  f2.push(seated(A2, "time.swing", t4("field.swing")));
  f2.push(seated(A2, "time.groove", t4("field.groove")));
  f2.push(flagField(
    "rubato",
    t4("time.rubato"),
    A2.rubatoOn(),
    t4("time.rubato.off"),
    t4("time.rubato.on"),
    (on) => A2.setRubato(on),
    t4("time.rubato.sub")
  ));
  f2.push({ kind: "node", label: t4("field.key"), node: A2.keyNode() });
  const mode = seated(A2, "alphabet.mode", t4("field.mode"));
  const cap = A2.tuningSay();
  if (cap && mode.key) mode.sub = cap;
  f2.push(mode);
  f2.push(seated(A2, "alphabet.scale", t4("field.scale")));
  f2.push(seated(A2, "alphabet.harmony", t4("time.harmony")));
  f2.push(flagField(
    "diatonic",
    t4("field.melody"),
    !!A2.diatonicOn(),
    t4("time.melody.chords"),
    t4("time.melody.key"),
    (on) => A2.setDiatonic(on)
  ));
  f2.push({ kind: "node", label: t4("time.changes"), node: A2.changesNode() });
  f2.push({ kind: "node", label: t4("time.gain"), node: A2.boardNode() });
  return f2;
}
function rulesFace(A2) {
  return A2.rulesFace();
}
function rulesSheet(A2) {
  return [{ kind: "node", node: A2.rulesNode() }];
}
function motifsFace(A2) {
  return A2.motifsFace();
}
function motifsSheet(A2) {
  return [{ kind: "node", node: A2.motifsNode() }];
}
function produceFace(A2) {
  return A2.produceFace();
}
function produceSheet(A2) {
  return [{ kind: "node", node: A2.produceNode() }];
}
var SPECIALS = [
  {
    k: "ttime",
    id: "time",
    get word() {
      return t4("special.time.word");
    },
    get aria() {
      return t4("special.time.aria");
    },
    face: timeFace,
    sheet: timeSheet
  },
  {
    k: "trules",
    id: "rules",
    get word() {
      return t4("special.rules.word");
    },
    get aria() {
      return t4("special.rules.aria");
    },
    face: rulesFace,
    sheet: rulesSheet
  },
  {
    k: "tmotifs",
    id: "motifs",
    get word() {
      return t4("special.phrases.word");
    },
    get aria() {
      return t4("special.phrases.aria");
    },
    face: motifsFace,
    sheet: motifsSheet,
    lamp: (A2) => A2.motifLamp()
  }
];
var PRODUCE = {
  k: "tproduce",
  id: "produce",
  get word() {
    return t4("special.produce.word");
  },
  get aria() {
    return t4("special.produce.aria");
  },
  face: produceFace,
  sheet: produceSheet
};
function mixSheet(A2, name) {
  return [{ kind: "node", node: A2.voiceStrip(name) }];
}
function masterFace(A2) {
  const said = [];
  for (const m3 of A2.MASTERROWS) {
    const cur = A2.masterOf(m3.key);
    if (cur != null && cur !== "") said.push(m3.labels[cur] || String(cur));
  }
  return said.length ? said.join(" · ") : t4("value.default");
}
function masterMixSheet(A2) {
  return [{ kind: "node", label: t4("master.buses"), node: A2.boardRack() }];
}

// nukernel/src/table/undo.ts
var DEPTH = 25;
var DocUndo = class {
  constructor(A2) {
    this.back = [];
    this.fwd = [];
    /** what the last op was called, so the two buttons can say what they undo. */
    this.names = [];
    this.fwdNames = [];
    /** an undo is itself an evolve, and an evolve must not be snapshotted as a
     *  new op — that is how a stack eats its own tail. */
    this.inside = false;
    this.A = A2;
  }
  get canUndo() {
    return this.back.length > 0;
  }
  get canRedo() {
    return this.fwd.length > 0;
  }
  /** the word the button says, so "undo" is never a promise with no object. */
  get undoWord() {
    return this.back.length ? t4("undo.undoOf", { name: this.names[this.names.length - 1] || t4("undo.lastChange") }) : t4("act.undo");
  }
  get redoWord() {
    return this.fwd.length ? t4("undo.redoOf", { name: this.fwdNames[this.fwdNames.length - 1] || t4("undo.lastChange") }) : t4("act.redo");
  }
  /** Run `op` with the document remembered first. EVERY op the grid performs
   *  goes through here, which is what "for every op" in 9a means and what the
   *  gate counts. */
  run(name, op) {
    if (this.inside) {
      op();
      return;
    }
    let before = null;
    try {
      before = this.A.snapshot();
    } catch (e4) {
      before = null;
    }
    op();
    if (!before) return;
    let after;
    try {
      after = JSON.stringify(this.A.doc());
    } catch (e4) {
      return;
    }
    if (JSON.stringify(before) === after) return;
    this.back.push(before);
    this.names.push(name);
    if (this.back.length > DEPTH) {
      this.back.shift();
      this.names.shift();
    }
    this.fwd.length = 0;
    this.fwdNames.length = 0;
  }
  undo() {
    const prev = this.back.pop();
    const name = this.names.pop();
    if (!prev) return false;
    let now = null;
    try {
      now = this.A.snapshot();
    } catch (e4) {
      now = null;
    }
    if (now) {
      this.fwd.push(now);
      this.fwdNames.push(name || t4("undo.lastChange"));
    }
    this.inside = true;
    try {
      this.A.evolve(prev);
    } finally {
      this.inside = false;
    }
    return true;
  }
  redo() {
    const next = this.fwd.pop();
    const name = this.fwdNames.pop();
    if (!next) return false;
    let now = null;
    try {
      now = this.A.snapshot();
    } catch (e4) {
      now = null;
    }
    if (now) {
      this.back.push(now);
      this.names.push(name || t4("undo.lastChange"));
    }
    this.inside = true;
    try {
      this.A.evolve(next);
    } finally {
      this.inside = false;
    }
    return true;
  }
};
var STACK = null;
function undoStack(A2) {
  if (!STACK) STACK = new DocUndo(A2);
  return STACK;
}

// nukernel/src/table/grid.ts
var SEL = null;
var ANCHOR = null;
var OPEN = null;
var OPENFIELD = null;
var ARM = null;
var WIDTH = /* @__PURE__ */ new Map();
var CLIP = null;
var RO = null;
var OUT = null;
var STICK = null;
function shapeOf(A2) {
  const doc = A2.doc();
  const secs = (doc.form && doc.form.sections || []).map((s3, i5) => ({ id: s3.id, i: i5 }));
  const voices = (doc.voices || []).map((v3, vi) => ({ name: v3.name, vi }));
  return {
    across: A2.facing() === "voices",
    secs,
    voices,
    at() {
      if (!SEL) return null;
      const s3 = secs.find((x2) => x2.id === SEL.sec);
      const v3 = voices.find((x2) => x2.name === SEL.voice);
      return s3 && v3 ? { i: s3.i, vi: v3.vi } : null;
    }
  };
}
var STICKY = (k2) => !!k2 && k2 !== "corner";
var SPECIAL = (k2) => !!k2 && (k2.indexOf("sp|") === 0 || k2.indexOf("mix|") === 0);
function bandTable(host, A2) {
  const U = undoStack(A2);
  if (!STICKY(OPEN)) {
    OPEN = null;
    OPENFIELD = null;
  }
  const sh0 = shapeOf(A2);
  if (SEL && !sh0.at()) {
    SEL = null;
    ANCHOR = null;
    OPEN = null;
    OPENFIELD = null;
  }
  if (CLIP) {
    const s3 = sh0.secs.find((x2) => x2.id === CLIP.sec);
    const v3 = sh0.voices.find((x2) => x2.name === CLIP.voice);
    if (!s3 || !v3) CLIP = null;
  }
  let SHEETKEY = null;
  let SHEETFIELDS = null;
  const sheetFor = (key, build) => {
    if (SHEETKEY !== key || !SHEETFIELDS) {
      SHEETKEY = key;
      SHEETFIELDS = build();
    }
    return SHEETFIELDS;
  };
  const SPLAMPS = /* @__PURE__ */ new Map();
  const spLamp = (sp) => {
    if (!sp.lamp) return A;
    if (!SPLAMPS.has(sp.id)) SPLAMPS.set(sp.id, sp.lamp(A2));
    return SPLAMPS.get(sp.id) || A;
  };
  const LAMPS = /* @__PURE__ */ new Map();
  const lamp = (name) => {
    let n3 = LAMPS.get(name);
    if (!n3) {
      n3 = A2.lampFor(name);
      LAMPS.set(name, n3);
    }
    return n3;
  };
  const MIXLAMPS = /* @__PURE__ */ new Map();
  const mixLamp = (name) => {
    let n3 = MIXLAMPS.get(name);
    if (!n3) {
      n3 = A2.lampFor(name);
      MIXLAMPS.set(name, n3);
    }
    return n3;
  };
  const draw = () => {
    D(view(), host);
    stick();
  };
  const armResize = (paneEl2) => {
    STICK = stick;
    if (!paneEl2 || typeof ResizeObserver === "undefined") return;
    if (!RO) RO = new ResizeObserver(() => {
      if (STICK) STICK();
    });
    RO.disconnect();
    RO.observe(paneEl2);
  };
  function stick() {
    const t5 = host.querySelector("table.nu-sheetgrid");
    if (!t5) return;
    const pane2 = host.querySelector(".nu-pane");
    if (pane2) t5.style.setProperty(
      "--panew",
      pane2.clientWidth - 6 + "px"
    );
    const rows = Array.from(t5.querySelectorAll("thead > tr"));
    const cells = rows.map((tr) => Array.from(tr.children));
    for (const cs of cells) for (const c3 of cs) c3.style.insetBlockStart = "";
    const tRect = t5.getBoundingClientRect();
    const base = pane2 ? tRect.top - pane2.getBoundingClientRect().top + pane2.scrollTop : 0;
    const tops = rows.map((tr) => base + (tr.getBoundingClientRect().top - tRect.top));
    rows.forEach((_tr, i5) => {
      for (const c3 of cells[i5]) c3.style.insetBlockStart = tops[i5] + "px";
    });
  }
  onRedraw(draw);
  const op = (name, fn) => U.run(name, fn);
  const wrap = (name, fn) => () => op(name, fn);
  const view = () => {
    const S2 = shapeOf(A2);
    return b`<div class="nu-sheetwrap">${formulaHead(S2)}${pane(S2)}</div>`;
  };
  const formulaHead = (S2) => {
    const at = S2.at();
    const doc = A2.doc();
    const addr = at ? t4("bar.address", {
      section: A2.secName(at.i),
      player: doc.voices[at.vi]?.name || ""
    }) : t4("bar.noCell");
    const rangeN = rangeCells(S2).length;
    const shown = rangeN > 1 ? tn("bar.addrRange", rangeN, { addr }) : addr;
    return b`<div class="nu-formula" role="group"
        aria-label=${t4("bar.selection")}>
      <span class="nu-fadr" data-k="taddr" aria-live="polite">${shown}</span>
      <div class="nu-fops">
        ${barBtn(
      "tundo",
      t4("bar.undo"),
      U.undoWord,
      U.canUndo,
      t4("bar.undo.none"),
      () => {
        U.undo();
      }
    )}
        ${barBtn(
      "tredo",
      t4("bar.redo"),
      U.redoWord,
      U.canRedo,
      t4("bar.redo.none"),
      () => {
        U.redo();
      }
    )}
        ${barBtn(
      "tcopy",
      t4("bar.copy"),
      t4("act.copy"),
      !!at,
      t4("bar.noSel"),
      () => {
        if (!SEL) return;
        CLIP = { ...SEL };
        draw();
      }
    )}
        ${barBtn(
      "tpaste",
      t4("bar.paste"),
      t4("act.paste"),
      !!at && !!CLIP,
      !at ? t4("bar.noSel") : t4("bar.paste.none"),
      () => pasteHere(S2)
    )}
      </div>
    </div>`;
  };
  const barBtn = (k2, word, aria, on, why, act) => b`<button type="button" class="nu-opbtn" data-k=${k2}
      ?disabled=${!on}
      aria-disabled=${o2(on ? void 0 : "true")}
      data-why=${o2(on ? void 0 : why)}
      title=${o2(on ? void 0 : why)}
      aria-label=${on ? aria : t4("sheet.refused", { name: aria, why })}
      @click=${() => {
    if (!on) return;
    act();
  }}>${word}</button>`;
  const pane = (S2) => {
    const rows = S2.across ? S2.voices.map((v3) => v3.name) : S2.secs.map((s3) => s3.id);
    const cols = S2.across ? S2.secs.map((s3) => s3.id) : S2.voices.map((v3) => v3.name);
    return b`<div class="nu-pane" data-pane="table" tabindex="0"
        @keydown=${(e4) => onKey(e4, S2)}>
      <table class="nu-wordgrid nu-trims nu-sheetgrid"
        style=${o3({ "--cols": String(cols.length + 1) })}>
        <colgroup>
          <col />
          ${cols.map((c3) => b`<col style=${o3(
      WIDTH.has(c3) ? { inlineSize: WIDTH.get(c3) + "px" } : {}
    )} />`)}
          <col class="nu-addcol" />
        </colgroup>
        ${thead(S2, cols)}
        ${tbody(S2, rows, cols)}
        ${S2.across ? A : tfoot(S2, cols)}
      </table>
    </div>`;
  };
  const nCols = (S2) => (S2.across ? S2.secs.length : S2.voices.length) + 2;
  const specialRows = (S2) => SPECIALS.map((sp) => {
    const openKey = "sp|" + sp.id;
    const open = OPEN === openKey;
    let face2 = "";
    try {
      face2 = sp.face(A2);
    } catch (e4) {
      face2 = "";
    }
    return b`<tr class="nu-sprow" data-special=${sp.id}>
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S2)}>
        <button type="button" class="nu-sphead" data-k=${sp.k}
          aria-expanded=${String(open)}
          aria-label=${sp.aria}
          @click=${() => toggle(openKey)}
          @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle(openKey, true);
    }}
          ><b class="nu-spword">${sp.word}</b
          ><span class="nu-spface">${face2}</span></button>${spLamp(sp)}
      </th>
    </tr>`;
  });
  const thead = (S2, cols) => b`<thead>
    ${specialRows(S2)}
    <tr>
      <th class="nu-cornerh">${cornerBtn(S2)}</th>
      ${c2(cols, (c3) => c3, (c3) => S2.across ? secHead(S2, c3) : voiceHead(S2, c3))}
      <th class="nu-addhead" scope="col">
        <div class="nu-addbar">${(S2.across ? sectionOffer(A2) : playerOffers(A2)).map((o4) => addBtn(o4))}</div>
      </th>
    </tr>
  </thead>`;
  const cornerBtn = (S2) => b`<button type="button"
    class="nu-rowjump nu-corner" data-k="tcorner"
    aria-expanded=${String(OPEN === "corner")}
    aria-label=${t4("head.corner.aria")}
    @click=${() => toggle("corner")}
    @contextmenu=${(e4) => {
    e4.preventDefault();
    toggle("corner", true);
  }}
    >${S2.across ? t4("noun.player") : t4("noun.section")}</button>`;
  const voiceHead = (S2, name) => {
    const v3 = A2.doc().voices.find((x2) => x2.name === name);
    const vi = A2.doc().voices.indexOf(v3);
    const sub = A2.playsWhat(v3) || "";
    const cm = A2.colMark(vi);
    return b`<th class="nu-colhead" data-vi=${String(A2.vpaintOf(vi) ?? "")}
        scope="col">
      <button type="button" class="nu-colbtn nu-vpaint" data-k=${"tcol|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${t4(
      "head.player.aria",
      { name, instrument: sub || t4("head.player.none") }
    )}
        title=${sub ? t4("head.player.aria", { name, instrument: sub }) : t4("head.name", { name })}
        data-say=${o2(cm && cm.s ? cm.s : void 0)}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle("col|" + name, true);
    }}
        >${cm ? b`<span class="nu-g" aria-hidden="true">${cm.g}</span>` : A}<b class="nu-colname">${name}</b>${cm ? b`<span class="nu-vh">${cm.w}</span>` : A}${sub ? b`<span class="nu-colinstr">${sub}</span>` : A}</button>
      ${lamp(name)}
      ${grip(name, "tcol|" + name, name)}
    </th>`;
  };
  const secHead = (S2, sid) => {
    const i5 = A2.doc().form.sections.findIndex((s4) => s4.id === sid);
    const s3 = A2.doc().form.sections[i5];
    const sm = A2.rowMark(i5);
    return b`<th class="nu-colhead" scope="col">
      <button type="button" class="nu-colbtn" data-k=${"tcol|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${tn("head.section", s3.bars, { name: A2.secName(i5) })}
        @click=${() => toggle("row|" + sid)}
        data-say=${o2(sm && sm.s ? sm.s : void 0)}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle("row|" + sid, true);
    }}
        >${sm ? b`<span class="nu-g" aria-hidden="true">${sm.g}</span>` : A}<b class="nu-colname">${A2.roleWord(s3.role)}</b
        ><span class="nu-colinstr">${tn("count.bar", s3.bars)}</span>${sm ? b`<span class="nu-vh">${sm.w}</span>` : A}</button>
      ${grip(sid, "tcol|" + sid, A2.secName(i5))}
    </th>`;
  };
  const grip = (colId, addr, name) => b`<button type="button"
    class="nu-colgrip" data-k=${"tgrip|" + addr}
    aria-label=${t4("head.grip.aria", { name })}
    @keydown=${(e4) => {
    const d2 = e4.key === "ArrowRight" ? 12 : e4.key === "ArrowLeft" ? -12 : 0;
    if (!d2) return;
    e4.preventDefault();
    e4.stopPropagation();
    const th = e4.target.closest("th");
    const now = WIDTH.get(colId) ?? (th ? th.getBoundingClientRect().width : 96);
    WIDTH.set(colId, Math.max(56, now + d2));
    draw();
  }}
    @pointerdown=${(e4) => {
    const th = e4.target.closest("th");
    if (!th) return;
    e4.preventDefault();
    e4.stopPropagation();
    const x0 = e4.clientX, w0 = WIDTH.get(colId) ?? th.getBoundingClientRect().width;
    const move = (m3) => {
      WIDTH.set(colId, Math.max(56, w0 + (m3.clientX - x0)));
      draw();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }}></button>`;
  const addBtn = (o4) => b`<button type="button" class="nu-addbtn"
    data-k=${o4.k} ?disabled=${!!o4.why}
    aria-disabled=${o2(o4.why ? "true" : void 0)}
    data-why=${o2(o4.why || void 0)}
    title=${o2(o4.why || void 0)}
    aria-label=${o4.why ? t4(
    "sheet.refused",
    { name: o4.aria || o4.word, why: o4.why }
  ) : o4.aria || o4.word}
    @click=${() => {
    if (o4.why || !o4.act) return;
    op(o4.word, o4.act);
  }}
    >${o4.word}</button>`;
  const tbody = (S2, rows, cols) => b`<tbody>
      ${orphanSheet(S2)}
      ${c2(rows, (r2) => r2, (r2) => bodyRow(S2, r2, cols))}
      <tr class="nu-addrow">
        <th class="nu-addhead" scope="row">
          <div class="nu-addbar">${(S2.across ? playerOffers(A2) : sectionOffer(A2)).map((o4) => addBtn(o4))}</div>
        </th>
        <td colspan=${nCols(S2) - 1}></td>
      </tr>
    </tbody>`;
  const orphanSheet = (S2) => {
    if (!OPEN) return A;
    if (OPEN === "corner")
      return openRow(S2, sheetFor("corner", () => [{
        kind: "ops",
        label: t4("head.song"),
        ops: tableOps(A2, S2.across).map((x2) => x2.act ? { ...x2, act: () => op(x2.word, x2.act) } : x2)
      }]), t4("head.song"));
    for (const sp of SPECIALS)
      if (OPEN === "sp|" + sp.id)
        return openRow(S2, sheetFor(OPEN, () => wrapOps(sp.sheet(A2))), sp.word);
    if (OPEN.indexOf("col|") === 0 && !S2.across)
      return openRow(S2, sheetFor(OPEN, () => colSheetOf(OPEN.slice(4))), OPEN.slice(4));
    if (OPEN.indexOf("row|") === 0 && S2.across)
      return openRow(S2, sheetFor(OPEN, () => rowSheetOf(OPEN.slice(4))), OPEN.slice(4));
    return A;
  };
  const bodyRow = (S2, rid, cols) => {
    const head = S2.across ? voiceRowHead(rid) : secRowHead(rid);
    const at = S2.at();
    const here = !S2.across && at != null && A2.doc().form.sections[at.i]?.id === rid;
    const openKey = S2.across ? "col|" + rid : "row|" + rid;
    return b`<tr data-row=${rid}
        class=${e3({ "nu-here": !!here })}>
      ${head}
      ${c2(cols, (c3) => c3, (c3) => bodyCell(S2, rid, c3))}
      <td class="nu-addcell"></td>
    </tr>
    ${OPEN === openKey ? openRow(S2, sheetFor(
      openKey,
      () => S2.across ? colSheetOf(rid) : rowSheetOf(rid)
    ), rid) : A}
    ${cols.map((c3) => {
      const key = S2.across ? "cell|" + c3 + "|" + rid : "cell|" + rid + "|" + c3;
      return OPEN === key ? openRow(
        S2,
        sheetFor(key, () => cellSheetOf(S2, rid, c3)),
        t4(
          "cell.sheet.name",
          {
            name: S2.across ? rid : c3,
            section: S2.across ? c3 : rid
          }
        )
      ) : A;
    })}`;
  };
  const secRowHead = (sid) => {
    const i5 = A2.doc().form.sections.findIndex((s4) => s4.id === sid);
    const s3 = A2.doc().form.sections[i5];
    const rm = A2.rowMark(i5);
    return b`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${tn("head.section", s3.bars, { name: A2.secName(i5) })}
        @click=${() => toggle("row|" + sid)}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle("row|" + sid, true);
    }}
        data-say=${o2(rm && rm.s ? rm.s : void 0)}
        ><span class="nu-g" aria-hidden="true">${rm ? rm.g : ""}</span
        ><span data-live="count"><span>${i5 + 1}</span></span
        ><span class="nu-srowname"> ${A2.roleWord(s3.role)}</span>${rm ? b`<span class="nu-vh">${rm.w}</span>` : A}</button>
      <small> ${tn("count.bar", s3.bars)}</small>
    </th>`;
  };
  const voiceRowHead = (name) => {
    const doc = A2.doc();
    const v3 = doc.voices.find((x2) => x2.name === name);
    const vm = A2.colMark(doc.voices.indexOf(v3));
    return b`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${t4("head.name", { name })}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle("col|" + name, true);
    }}
        data-say=${o2(vm && vm.s ? vm.s : void 0)}
        ><span class="nu-g" aria-hidden="true">${vm ? vm.g : ""}</span
        ><span class="nu-srowname">${name}</span>${vm ? b`<span class="nu-vh">${vm.w}</span>` : A}</button>
      <small> ${A2.playsWhat(v3) || ""}</small>
    </th>`;
  };
  const face = (mark, word, num) => b`<span class="nu-ic"
      >${mark ? b`<span class="nu-g" aria-hidden="true">${mark.g}</span>` : A}${num != null && num !== "" ? b`<span class="nu-n">${num}</span>` : A}${word != null && word !== "" ? b`<span class="nu-w">${word}</span>` : A}${mark ? b`<span class="nu-vh">${mark.w}</span>` : A}</span>`;
  const bodyCell = (S2, rid, cid) => {
    const sid = S2.across ? cid : rid;
    const name = S2.across ? rid : cid;
    const doc = A2.doc();
    const i5 = doc.form.sections.findIndex((s3) => s3.id === sid);
    const vi = doc.voices.findIndex((v3) => v3.name === name);
    if (i5 < 0 || vi < 0) return b`<td><span>—</span></td>`;
    const key = "tcell|" + name + "|" + sid;
    const openKey = "cell|" + sid + "|" + name;
    const word = A2.cellWord(i5, vi);
    const mark = A2.cellMark(i5, vi);
    const hand = A2.written(i5, vi);
    const sel = !!SEL && SEL.sec === sid && SEL.voice === name;
    const inRange = rangeHas(S2, sid, name);
    return b`<td class=${e3({ "is-inrange": inRange })}>
      <button type="button"
        class=${e3({
      "nu-wcell": true,
      "nu-cellword": true,
      "is-derived": !hand,
      "is-sel": sel
    })}
        data-k=${key}
        aria-expanded=${String(OPEN === openKey)}
        aria-selected=${String(sel)}
        aria-label=${mark ? t4("cell.aria.mark", {
      name,
      section: A2.secName(i5),
      value: word,
      mark: mark.w
    }) : t4("cell.aria", { name, section: A2.secName(i5), value: word })}
        data-say=${o2(mark && mark.s ? mark.s : void 0)}
        @click=${(e4) => {
      if (e4.shiftKey && SEL) {
        ANCHOR = { sec: sid, voice: name };
        draw();
        return;
      }
      if (ARM) {
        const m3 = ARM;
        ARM = null;
        SEL = { sec: sid, voice: name };
        ANCHOR = null;
        A2.pointCell(i5, vi, m3);
        return;
      }
      ANCHOR = null;
      if (!sel) {
        select(sid, name);
        return;
      }
      toggle(openKey);
    }}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle(openKey, true);
    }}
        >${face(mark, word === "—" ? null : word)}</button>
    </td>`;
  };
  const tfoot = (S2, cols) => b`<tfoot>
    ${mixRow(S2, cols)}
    ${produceRow(S2)}
    ${footRow(
    S2,
    "perf",
    "tfoot|perf",
    t4("special.perf.word"),
    t4("axis.performance"),
    perfCells(A2),
    () => perfSheet(A2)
  )}
  </tfoot>`;
  const mixRow = (S2, cols) => {
    const master = "mix|master";
    const face2 = masterFace(A2);
    return b`<tr class="nu-footrow nu-mixrow" data-row="mix">
      <th class="nu-srowh" scope="row"><span class="nu-srowname">${t4("special.mix.word")}</span></th>
      ${c2(cols, (c3) => c3, (c3) => mixCell(c3))}
      <td class="nu-addcell"></td>
    </tr>
    <tr class="nu-footrow nu-masterrow" data-row="master">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S2)}>
        <button type="button" class="nu-sphead" data-k="tmix"
          aria-expanded=${String(OPEN === master)}
          aria-label=${t4("special.master.aria", { face: face2 })}
          @click=${() => toggle(master)}
          @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle(master, true);
    }}
          ><b class="nu-spword">${t4("special.master.word")}</b
          ><span class="nu-spface">${face2}</span></button>
      </th>
    </tr>
    ${OPEN === master ? openRow(
      S2,
      sheetFor(master, () => wrapOps(masterMixSheet(A2))),
      t4("special.master.word")
    ) : A}
    ${cols.map((c3) => OPEN === "mix|" + c3 ? openRow(S2, sheetFor(OPEN, () => wrapOps(mixSheet(A2, c3))), c3) : A)}`;
  };
  const produceRow = (S2) => {
    const openKey = "sp|" + PRODUCE.id;
    let face2 = "";
    try {
      face2 = PRODUCE.face(A2);
    } catch (e4) {
      face2 = "";
    }
    return b`<tr class="nu-footrow nu-prodrow" data-row="produce">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S2)}>
        <button type="button" class="nu-sphead" data-k=${PRODUCE.k}
          aria-expanded=${String(OPEN === openKey)}
          aria-label=${PRODUCE.aria}
          @click=${() => toggle(openKey)}
          @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle(openKey, true);
    }}
          ><b class="nu-spword">${PRODUCE.word}</b
          ><span class="nu-spface">${face2}</span></button>
      </th>
    </tr>
    ${OPEN === openKey ? openRow(S2, sheetFor(openKey, () => wrapOps(PRODUCE.sheet(A2))), PRODUCE.word) : A}`;
  };
  const mixCell = (name) => {
    const openKey = "mix|" + name;
    const word = A2.mixWord(name);
    const mk = A2.mixMark(name);
    return b`<td class="nu-mixcell">
      <button type="button"
        class=${e3({
      "nu-wcell": true,
      "nu-cellword": true,
      "is-derived": !A2.mixWritten(name)
    })}
        data-k=${"tmix|" + name}
        aria-expanded=${String(OPEN === openKey)}
        aria-label=${mk ? t4("mix.cell.aria.mark", { name, value: word, mark: mk.w }) : t4("mix.cell.aria", { name, value: word })}
        data-say=${o2(mk && mk.s ? mk.s : void 0)}
        @click=${() => toggle(openKey)}
        @contextmenu=${(e4) => {
      e4.preventDefault();
      toggle(openKey, true);
    }}
        >${face(mk, word === "—" ? null : word)}</button>
      ${mixLamp(name)}
    </td>`;
  };
  const footRow = (S2, id, k2, word, aria, cells, sheet) => {
    const openKey = "foot|" + id;
    return b`<tr class="nu-footrow" data-row=${id}>
      <th class="nu-srowh" scope="row">
        <button type="button" class="nu-rowjump" data-k=${k2}
          aria-expanded=${String(OPEN === openKey)} aria-label=${aria}
          @click=${() => toggle(openKey)}
          ><span class="nu-srowname">${word}</span></button>
      </th>
      <td colspan=${nCols(S2) - 1}>
        <div class="nu-footcells">${cells.map((c3) => b`<div
          class="nu-footcell">${footCell(c3)}</div>`)}</div>
      </td>
    </tr>
    ${OPEN === openKey ? openRow(S2, sheetFor(openKey, sheet), openKey) : A}`;
  };
  const footCell = (c3) => {
    const f2 = c3;
    if (!f2.key) return b`<span class="nu-sgsay">${f2.word ?? "—"}</span>`;
    return b`<button type="button"
      class=${e3({
      "nu-wcell": true,
      "nu-cellword": true,
      "is-derived": !!f2.derived
    })}
      data-k=${f2.key}
      aria-label=${t4("sheet.field", {
      name: f2.label || f2.key,
      value: f2.word ?? "—"
    })}
      @click=${() => {
      const row = "foot|perf";
      if (SHEETKEY !== row) {
        SHEETKEY = null;
        SHEETFIELDS = null;
      }
      OPEN = row;
      OPENFIELD = f2.key;
      draw();
    }}
      >${f2.label ?? f2.word ?? "—"}</button>`;
  };
  const openRow = (S2, fields, name) => b`<tr class="nu-wopen"><td colspan=${nCols(S2)}>${sheetBody(
    fields,
    name,
    OPENFIELD,
    (k2) => {
      OPENFIELD = k2;
      draw();
    },
    () => {
    }
  )}</td></tr>`;
  const rowSheetOf = (sid) => {
    const i5 = A2.doc().form.sections.findIndex((s3) => s3.id === sid);
    return i5 < 0 ? [] : wrapOps(rowSheet(A2, i5));
  };
  const colSheetOf = (name) => {
    const vi = A2.doc().voices.findIndex((v3) => v3.name === name);
    return vi < 0 ? [] : wrapOps(colSheet(A2, vi));
  };
  const cellSheetOf = (S2, rid, cid) => {
    const sid = S2.across ? cid : rid, name = S2.across ? rid : cid;
    const i5 = A2.doc().form.sections.findIndex((s3) => s3.id === sid);
    const vi = A2.doc().voices.findIndex((v3) => v3.name === name);
    if (i5 < 0 || vi < 0) return [];
    const f2 = wrapOps(cellSheet(A2, i5, vi));
    const ops = f2.find((x2) => x2.kind === "ops");
    if (ops) ops.ops.push(
      {
        k: "tcell-copy|" + A2.doc().voices[vi].name + "|" + sid,
        word: t4("bar.copy"),
        aria: t4("act.copy"),
        act: () => {
          CLIP = { sec: sid, voice: A2.doc().voices[vi].name };
          draw();
        }
      },
      {
        k: "tcell-paste|" + A2.doc().voices[vi].name + "|" + sid,
        word: t4("bar.paste"),
        aria: t4("act.paste"),
        why: CLIP ? null : t4("bar.paste.none"),
        act: () => pasteInto(i5, vi)
      }
    );
    return f2;
  };
  function wrapOps(fields) {
    for (const f2 of fields) {
      if (f2.kind !== "ops") continue;
      const o4 = f2;
      o4.ops = o4.ops.map((x2) => x2.act ? { ...x2, act: () => op(x2.word, x2.act) } : x2);
    }
    for (const f2 of fields) {
      const s3 = f2;
      if (s3.set) {
        const set = s3.set;
        s3.set = (v3) => op(s3.label || t4("op.change"), () => set(v3));
      }
      if (s3.clear) {
        const cl = s3.clear;
        s3.clear = () => op(t4("op.clearing", { name: s3.label || "" }), cl);
      }
    }
    return fields;
  }
  function select(sid, name) {
    SEL = { sec: sid, voice: name };
    ANCHOR = null;
    if (OPEN && OPEN.indexOf("cell|") === 0) {
      OPEN = null;
      SHEETKEY = null;
      SHEETFIELDS = null;
    }
    OPENFIELD = null;
    draw();
    const b2 = host.querySelector('[data-k="tcell|' + name + "|" + sid + '"]');
    if (b2 instanceof HTMLElement) b2.focus({ preventScroll: true });
  }
  function editSel() {
    if (!SEL) return;
    OPEN = "cell|" + SEL.sec + "|" + SEL.voice;
    OPENFIELD = null;
    SHEETKEY = null;
    SHEETFIELDS = null;
    draw();
    const first = host.querySelector(".nu-vsheet .nu-wcell");
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
  }
  function closeEdit() {
    OPEN = null;
    OPENFIELD = null;
    SHEETKEY = null;
    SHEETFIELDS = null;
    draw();
    if (!SEL) return;
    const b2 = host.querySelector('[data-k="tcell|' + SEL.voice + "|" + SEL.sec + '"]');
    if (b2 instanceof HTMLElement) b2.focus({ preventScroll: true });
  }
  function toggle(key, keepOpen = false) {
    if (SPECIAL(key) && (OPEN !== key || keepOpen)) {
      try {
        A2.leaveLanding();
      } catch (e4) {
      }
    }
    if (key.indexOf("cell|") === 0) {
      const p3 = key.split("|");
      SEL = { sec: p3[1], voice: p3[2] };
    }
    OPEN = OPEN === key && !keepOpen ? null : key;
    OPENFIELD = null;
    if (SHEETKEY !== OPEN) {
      SHEETKEY = null;
      SHEETFIELDS = null;
    }
    draw();
  }
  function rangeCells(S2) {
    const at = S2.at();
    if (!at || !SEL) return [];
    if (!ANCHOR) return [{ sid: SEL.sec, name: SEL.voice }];
    const si = S2.secs.findIndex((x2) => x2.id === SEL.sec);
    const ai = S2.secs.findIndex((x2) => x2.id === ANCHOR.sec);
    const sv = S2.voices.findIndex((x2) => x2.name === SEL.voice);
    const av = S2.voices.findIndex((x2) => x2.name === ANCHOR.voice);
    if (si < 0 || ai < 0 || sv < 0 || av < 0) return [{ sid: SEL.sec, name: SEL.voice }];
    const out = [];
    for (let a2 = Math.min(si, ai); a2 <= Math.max(si, ai); a2++)
      for (let b2 = Math.min(sv, av); b2 <= Math.max(sv, av); b2++)
        out.push({ sid: S2.secs[a2].id, name: S2.voices[b2].name });
    return out;
  }
  function rangeHas(S2, sid, name) {
    if (!ANCHOR) return false;
    return rangeCells(S2).some((c3) => c3.sid === sid && c3.name === name);
  }
  function pasteInto(i5, vi) {
    if (!CLIP) return;
    const doc = A2.doc();
    const fi = doc.form.sections.findIndex((s3) => s3.id === CLIP.sec);
    const fv = doc.voices.findIndex((v3) => v3.name === CLIP.voice);
    if (fi < 0 || fv < 0) return;
    op(t4("bar.paste"), () => A2.copyCellTo(fi, fv, i5, vi));
  }
  function pasteHere(S2) {
    const at = S2.at();
    if (at) pasteInto(at.i, at.vi);
  }
  function moveSel(S2, dr, dc, extend) {
    const at = S2.at();
    if (!at) {
      const s0 = S2.secs[0], v0 = S2.voices[0];
      if (s0 && v0) SEL = { sec: s0.id, voice: v0.name };
      ANCHOR = null;
      draw();
      return;
    }
    const rowsAre = S2.across ? S2.voices.length : S2.secs.length;
    const colsAre = S2.across ? S2.secs.length : S2.voices.length;
    let r2 = S2.across ? S2.voices.findIndex((x2) => x2.name === SEL.voice) : S2.secs.findIndex((x2) => x2.id === SEL.sec);
    let c3 = S2.across ? S2.secs.findIndex((x2) => x2.id === SEL.sec) : S2.voices.findIndex((x2) => x2.name === SEL.voice);
    r2 = Math.max(0, Math.min(rowsAre - 1, r2 + dr));
    c3 = Math.max(0, Math.min(colsAre - 1, c3 + dc));
    const next = S2.across ? { sec: S2.secs[c3].id, voice: S2.voices[r2].name } : { sec: S2.secs[r2].id, voice: S2.voices[c3].name };
    if (extend) {
      if (!ANCHOR) ANCHOR = { ...SEL };
    } else ANCHOR = null;
    SEL = next;
    if (OPEN && OPEN.indexOf("cell|") === 0) {
      OPEN = null;
      SHEETKEY = null;
      SHEETFIELDS = null;
    }
    OPENFIELD = null;
    draw();
    const b2 = host.querySelector('[data-k="tcell|' + SEL.voice + "|" + SEL.sec + '"]');
    if (b2 instanceof HTMLElement) b2.focus({ preventScroll: false });
  }
  function fill(S2, way) {
    const at = S2.at();
    if (!at) return;
    op(
      way === "row" ? t4("op.fillRow") : t4("op.fillCol"),
      () => A2.copyCell(at.i, at.vi, way)
    );
  }
  function onKey(e4, S2) {
    const meta = e4.ctrlKey || e4.metaKey;
    const tg = e4.target;
    const tag = tg?.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    const inSpecial = !!tg && (!!tg.closest(".nu-sprow") || !!tg.closest(".nu-mixrow") || !!tg.closest(".nu-masterrow") || !!tg.closest(".nu-prodrow") || SPECIAL(OPEN) && !!tg.closest(".nu-wopen"));
    if (inSpecial && e4.key !== "Escape") return;
    if (meta && (e4.key === "z" || e4.key === "Z")) {
      e4.preventDefault();
      if (e4.shiftKey) U.redo();
      else U.undo();
      return;
    }
    if (meta && (e4.key === "y" || e4.key === "Y")) {
      e4.preventDefault();
      U.redo();
      return;
    }
    if (meta && (e4.key === "c" || e4.key === "C")) {
      if (!SEL) return;
      e4.preventDefault();
      CLIP = { ...SEL };
      draw();
      return;
    }
    if (meta && (e4.key === "v" || e4.key === "V")) {
      e4.preventDefault();
      pasteHere(S2);
      return;
    }
    if (meta && (e4.key === "d" || e4.key === "D")) {
      e4.preventDefault();
      fill(S2, "col");
      return;
    }
    if (meta && (e4.key === "r" || e4.key === "R")) {
      e4.preventDefault();
      fill(S2, "row");
      return;
    }
    if (meta) return;
    switch (e4.key) {
      case "ArrowUp":
        e4.preventDefault();
        moveSel(S2, -1, 0, e4.shiftKey);
        return;
      case "ArrowDown":
        e4.preventDefault();
        moveSel(S2, 1, 0, e4.shiftKey);
        return;
      case "ArrowLeft":
        e4.preventDefault();
        moveSel(S2, 0, -1, e4.shiftKey);
        return;
      case "ArrowRight":
        e4.preventDefault();
        moveSel(S2, 0, 1, e4.shiftKey);
        return;
      case "Tab":
        if (!SEL) return;
        e4.preventDefault();
        moveSel(S2, 0, e4.shiftKey ? -1 : 1, false);
        return;
      /* ENTER AND F2 EDIT; ENTER AGAIN COMMITS AND STAYS. Every write on this
         page lands the moment a chip is tapped — there is no pending buffer to
         commit — so "commit and stay" is: the editor shuts, the ring does not
         move, and the focus goes back to the cell. */
      case "Enter":
      case "F2": {
        if (!SEL) return;
        e4.preventDefault();
        if (OPEN === "cell|" + SEL.sec + "|" + SEL.voice) {
          closeEdit();
          return;
        }
        editSel();
        return;
      }
      case "Escape":
        if (OPENFIELD) {
          OPENFIELD = null;
          draw();
          e4.stopPropagation();
          return;
        }
        if (OPEN && OPEN.indexOf("cell|") === 0) {
          closeEdit();
          e4.stopPropagation();
          return;
        }
        if (OPEN) {
          OPEN = null;
          SHEETKEY = null;
          SHEETFIELDS = null;
          draw();
          e4.stopPropagation();
          return;
        }
        if (ANCHOR) {
          ANCHOR = null;
          draw();
          e4.stopPropagation();
          return;
        }
        return;
      case "Delete":
      case "Backspace": {
        const at = S2.at();
        if (!at) return;
        e4.preventDefault();
        const cells = rangeCells(S2);
        op(
          cells.length > 1 ? tn("op.clearCells", cells.length) : t4("op.clearingCell"),
          () => {
            for (const c3 of cells) {
              const i5 = A2.doc().form.sections.findIndex((s3) => s3.id === c3.sid);
              const vi = A2.doc().voices.findIndex((v3) => v3.name === c3.name);
              if (i5 >= 0 && vi >= 0) A2.clearCell(i5, vi);
            }
          }
        );
        return;
      }
      /* A PRINTABLE KEY EDITS, which is the gesture every spreadsheet user
         already has in their hands: you do not reach for a menu, you start
         typing. What it opens today is the cell's own control (§11a's typed
         editor, where the letters would go on to FILTER the vocabulary, is a
         later round and this is the door it will be built behind). */
      default:
        if (!SEL) return;
        if (e4.altKey || e4.key.length !== 1) return;
        if (OPEN === "cell|" + SEL.sec + "|" + SEL.voice) return;
        e4.preventDefault();
        editSel();
        return;
    }
  }
  function armOutside() {
    if (OUT) document.removeEventListener("pointerdown", OUT, true);
    OUT = (e4) => {
      if (!OPEN) return;
      const t5 = e4.target;
      if (!t5 || !t5.closest) return;
      if (t5.closest(".nu-wopen")) return;
      if (t5.closest("button, a, input, select, textarea, [role=slider], label"))
        return;
      if (!host.isConnected) return;
      OPEN = null;
      OPENFIELD = null;
      SHEETKEY = null;
      SHEETFIELDS = null;
      draw();
    };
    document.addEventListener("pointerdown", OUT, true);
  }
  draw();
  const table = host.querySelector("table.nu-wordgrid");
  const paneEl = host.querySelector(".nu-pane");
  const rowHeads = /* @__PURE__ */ new Map();
  const colHeads = /* @__PURE__ */ new Map();
  const reindex = () => {
    rowHeads.clear();
    colHeads.clear();
    for (const th of Array.from(table.querySelectorAll("tbody th.nu-srowh"))) {
      const tr = th.closest("tr");
      const btn = th.querySelector("button");
      if (!tr || !btn) continue;
      const id = tr.dataset.row || "";
      const across = A2.facing() === "voices";
      rowHeads.set(
        across ? id : id,
        {
          th,
          btn,
          live: th.querySelector('[data-live="count"]')
        }
      );
    }
    for (const th of Array.from(table.querySelectorAll("thead th.nu-colhead"))) {
      const btn = th.querySelector("button");
      if (!btn) continue;
      colHeads.set(
        btn.dataset.k || "",
        { th, btn }
      );
    }
  };
  reindex();
  armResize(paneEl);
  armOutside();
  let litRow = null, litCols = "";
  const paint = (nowRowId, soundingColIds) => {
    if (nowRowId !== litRow) {
      litRow = nowRowId;
      for (const tr of Array.from(table.querySelectorAll("tbody tr[data-row]")))
        tr.classList.toggle("now", tr.dataset.row === nowRowId);
    }
    const want = new Set(soundingColIds || []);
    const sig = [...want].sort().join(",");
    if (sig === litCols) return;
    litCols = sig;
    for (const [id, h3] of colHeads) h3.th.classList.toggle("is-sounding", want.has(id));
  };
  return {
    table,
    pane: paneEl,
    rowHeads,
    colHeads,
    paint,
    close: () => {
      OPEN = null;
      OPENFIELD = null;
      SHEETKEY = null;
      SHEETFIELDS = null;
      draw();
    },
    openCorner: () => {
      toggle("corner");
    },
    /* A LANDING ONLY LANDS (2026-09-05). `tablePanel` ends every rebuild by
       opening the head an arrival asked for — the gutter's, the atlas's, a
       link's — and it did it by CLICKING, which is a TOGGLE. That was safe
       while a rebuild closed everything; the moment a sheet survives its own
       write (Paul: *"Don't dismiss things when I tap them to change values"*)
       the landing click began CLOSING the sheet it was meant to land on, once
       per write, and `toggle` clears the open field on its way past — measured
       as "the sheet is open and its strip of words is not". This is the same
       door with the other half of `toggle`'s own signature: `keepOpen`, which
       opens and never closes. §9d says the same sentence about the corner,
       which is the one door that must still forget. */
    land: (key) => {
      toggle(key, true);
    },
    /* THE WRITE IS `A.pointCell`, WHICH IS avail.js's OWN `material.cell`
       SHEET — not `putCell`. That sheet is the one owner of which cells a
       voice of this kind may read (a drum cell is lanes, a line cell is
       degrees: document.js:230), of the absent detent, and of the write; the
       cell sheet's `motifs` row asks the same question through the same door,
       so the bank and the sheet can never point a cell two different ways. */
    pointMotif: (name) => {
      const doc = A2.doc();
      if (SEL) {
        const i5 = doc.form.sections.findIndex((x2) => x2.id === SEL.sec);
        const vi = doc.voices.findIndex((x2) => x2.name === SEL.voice);
        if (i5 >= 0 && vi >= 0) {
          ARM = null;
          A2.pointCell(i5, vi, name);
          return true;
        }
      }
      ARM = name;
      return false;
    },
    armedMotif: () => ARM
  };
}
export {
  bandTable,
  undoStack
};

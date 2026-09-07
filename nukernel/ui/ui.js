// nukernel/ui/ui.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/ui/ by `node tools/ui/build.js`.
// An edit made here is an edit the next build throws away, and
// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails
// until it is gone. Edit the TypeScript source and rebuild.
//
// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain
// files, nothing is vendored and nothing is fetched, and the page plays
// with the wire cut. Minify is OFF so this stays a reviewable diff.

// node_modules/@lit/reactive-element/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = /* @__PURE__ */ Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t4, e4, o5) {
    if (this._$cssResult$ = true, o5 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t4, this.t = e4;
  }
  get styleSheet() {
    let t4 = this.o;
    const s4 = this.t;
    if (e && void 0 === t4) {
      const e4 = void 0 !== s4 && 1 === s4.length;
      e4 && (t4 = o.get(s4)), void 0 === t4 && ((this.o = t4 = new CSSStyleSheet()).replaceSync(this.cssText), e4 && o.set(s4, t4));
    }
    return t4;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t4) => new n("string" == typeof t4 ? t4 : t4 + "", void 0, s);
var S = (s4, o5) => {
  if (e) s4.adoptedStyleSheets = o5.map((t4) => t4 instanceof CSSStyleSheet ? t4 : t4.styleSheet);
  else for (const e4 of o5) {
    const o6 = document.createElement("style"), n4 = t.litNonce;
    void 0 !== n4 && o6.setAttribute("nonce", n4), o6.textContent = e4.cssText, s4.appendChild(o6);
  }
};
var c = e ? (t4) => t4 : (t4) => t4 instanceof CSSStyleSheet ? ((t5) => {
  let e4 = "";
  for (const s4 of t5.cssRules) e4 += s4.cssText;
  return r(e4);
})(t4) : t4;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t4, s4) => t4;
var u = { toAttribute(t4, s4) {
  switch (s4) {
    case Boolean:
      t4 = t4 ? l : null;
      break;
    case Object:
    case Array:
      t4 = null == t4 ? t4 : JSON.stringify(t4);
  }
  return t4;
}, fromAttribute(t4, s4) {
  let i5 = t4;
  switch (s4) {
    case Boolean:
      i5 = null !== t4;
      break;
    case Number:
      i5 = null === t4 ? null : Number(t4);
      break;
    case Object:
    case Array:
      try {
        i5 = JSON.parse(t4);
      } catch (t5) {
        i5 = null;
      }
  }
  return i5;
} };
var f = (t4, s4) => !i2(t4, s4);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y = class extends HTMLElement {
  static addInitializer(t4) {
    this._$Ei(), (this.l ??= []).push(t4);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t4, s4 = b) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t4) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t4, s4), !s4.noAccessor) {
      const i5 = /* @__PURE__ */ Symbol(), h3 = this.getPropertyDescriptor(t4, i5, s4);
      void 0 !== h3 && e2(this.prototype, t4, h3);
    }
  }
  static getPropertyDescriptor(t4, s4, i5) {
    const { get: e4, set: r4 } = h(this.prototype, t4) ?? { get() {
      return this[s4];
    }, set(t5) {
      this[s4] = t5;
    } };
    return { get: e4, set(s5) {
      const h3 = e4?.call(this);
      r4?.call(this, s5), this.requestUpdate(t4, h3, i5);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t4) {
    return this.elementProperties.get(t4) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t4 = n2(this);
    t4.finalize(), void 0 !== t4.l && (this.l = [...t4.l]), this.elementProperties = new Map(t4.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t5 = this.properties, s4 = [...r2(t5), ...o2(t5)];
      for (const i5 of s4) this.createProperty(i5, t5[i5]);
    }
    const t4 = this[Symbol.metadata];
    if (null !== t4) {
      const s4 = litPropertyMetadata.get(t4);
      if (void 0 !== s4) for (const [t5, i5] of s4) this.elementProperties.set(t5, i5);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t5, s4] of this.elementProperties) {
      const i5 = this._$Eu(t5, s4);
      void 0 !== i5 && this._$Eh.set(i5, t5);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s4) {
    const i5 = [];
    if (Array.isArray(s4)) {
      const e4 = new Set(s4.flat(1 / 0).reverse());
      for (const s5 of e4) i5.unshift(c(s5));
    } else void 0 !== s4 && i5.push(c(s4));
    return i5;
  }
  static _$Eu(t4, s4) {
    const i5 = s4.attribute;
    return false === i5 ? void 0 : "string" == typeof i5 ? i5 : "string" == typeof t4 ? t4.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t4) => this.enableUpdating = t4), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t4) => t4(this));
  }
  addController(t4) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t4), void 0 !== this.renderRoot && this.isConnected && t4.hostConnected?.();
  }
  removeController(t4) {
    this._$EO?.delete(t4);
  }
  _$E_() {
    const t4 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i5 of s4.keys()) this.hasOwnProperty(i5) && (t4.set(i5, this[i5]), delete this[i5]);
    t4.size > 0 && (this._$Ep = t4);
  }
  createRenderRoot() {
    const t4 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t4, this.constructor.elementStyles), t4;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t4) => t4.hostConnected?.());
  }
  enableUpdating(t4) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t4) => t4.hostDisconnected?.());
  }
  attributeChangedCallback(t4, s4, i5) {
    this._$AK(t4, i5);
  }
  _$ET(t4, s4) {
    const i5 = this.constructor.elementProperties.get(t4), e4 = this.constructor._$Eu(t4, i5);
    if (void 0 !== e4 && true === i5.reflect) {
      const h3 = (void 0 !== i5.converter?.toAttribute ? i5.converter : u).toAttribute(s4, i5.type);
      this._$Em = t4, null == h3 ? this.removeAttribute(e4) : this.setAttribute(e4, h3), this._$Em = null;
    }
  }
  _$AK(t4, s4) {
    const i5 = this.constructor, e4 = i5._$Eh.get(t4);
    if (void 0 !== e4 && this._$Em !== e4) {
      const t5 = i5.getPropertyOptions(e4), h3 = "function" == typeof t5.converter ? { fromAttribute: t5.converter } : void 0 !== t5.converter?.fromAttribute ? t5.converter : u;
      this._$Em = e4;
      const r4 = h3.fromAttribute(s4, t5.type);
      this[e4] = r4 ?? this._$Ej?.get(e4) ?? r4, this._$Em = null;
    }
  }
  requestUpdate(t4, s4, i5, e4 = false, h3) {
    if (void 0 !== t4) {
      const r4 = this.constructor;
      if (false === e4 && (h3 = this[t4]), i5 ??= r4.getPropertyOptions(t4), !((i5.hasChanged ?? f)(h3, s4) || i5.useDefault && i5.reflect && h3 === this._$Ej?.get(t4) && !this.hasAttribute(r4._$Eu(t4, i5)))) return;
      this.C(t4, s4, i5);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t4, s4, { useDefault: i5, reflect: e4, wrapped: h3 }, r4) {
    i5 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t4) && (this._$Ej.set(t4, r4 ?? s4 ?? this[t4]), true !== h3 || void 0 !== r4) || (this._$AL.has(t4) || (this.hasUpdated || i5 || (s4 = void 0), this._$AL.set(t4, s4)), true === e4 && this._$Em !== t4 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t4));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t5) {
      Promise.reject(t5);
    }
    const t4 = this.scheduleUpdate();
    return null != t4 && await t4, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t6, s5] of this._$Ep) this[t6] = s5;
        this._$Ep = void 0;
      }
      const t5 = this.constructor.elementProperties;
      if (t5.size > 0) for (const [s5, i5] of t5) {
        const { wrapped: t6 } = i5, e4 = this[s5];
        true !== t6 || this._$AL.has(s5) || void 0 === e4 || this.C(s5, void 0, i5, e4);
      }
    }
    let t4 = false;
    const s4 = this._$AL;
    try {
      t4 = this.shouldUpdate(s4), t4 ? (this.willUpdate(s4), this._$EO?.forEach((t5) => t5.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t4 = false, this._$EM(), s5;
    }
    t4 && this._$AE(s4);
  }
  willUpdate(t4) {
  }
  _$AE(t4) {
    this._$EO?.forEach((t5) => t5.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t4)), this.updated(t4);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t4) {
    return true;
  }
  update(t4) {
    this._$Eq &&= this._$Eq.forEach((t5) => this._$ET(t5, this[t5])), this._$EM();
  }
  updated(t4) {
  }
  firstUpdated(t4) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ??= []).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = (t4) => t4;
var s2 = t2.trustedTypes;
var e3 = s2 ? s2.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var u2 = Array.isArray;
var d2 = (t4) => u2(t4) || "function" == typeof t4?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t4) => (i5, ...s4) => ({ _$litType$: t4, strings: i5, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t4, i5) {
  if (!u2(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e3 ? e3.createHTML(i5) : i5;
}
var N = (t4, i5) => {
  const s4 = t4.length - 1, e4 = [];
  let n4, l3 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c4 = v;
  for (let i6 = 0; i6 < s4; i6++) {
    const s5 = t4[i6];
    let a3, u3, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u3 = c4.exec(s5), null !== u3); ) f3 = c4.lastIndex, c4 === v ? "!--" === u3[1] ? c4 = _ : void 0 !== u3[1] ? c4 = m : void 0 !== u3[2] ? (y2.test(u3[2]) && (n4 = RegExp("</" + u3[2], "g")), c4 = p2) : void 0 !== u3[3] && (c4 = p2) : c4 === p2 ? ">" === u3[0] ? (c4 = n4 ?? v, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? p2 : '"' === u3[3] ? $ : g) : c4 === $ || c4 === g ? c4 = p2 : c4 === _ || c4 === m ? c4 = v : (c4 = p2, n4 = void 0);
    const x2 = c4 === p2 && t4[i6 + 1].startsWith("/>") ? " " : "";
    l3 += c4 === v ? s5 + r3 : d3 >= 0 ? (e4.push(a3), s5.slice(0, d3) + h2 + s5.slice(d3) + o3 + x2) : s5 + o3 + (-2 === d3 ? i6 : x2);
  }
  return [V(t4, l3 + (t4[s4] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e4];
};
var S2 = class _S {
  constructor({ strings: t4, _$litType$: i5 }, e4) {
    let r4;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u3 = t4.length - 1, d3 = this.parts, [f3, v2] = N(t4, i5);
    if (this.el = _S.createElement(f3, e4), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r4 = P.nextNode()) && d3.length < u3; ) {
      if (1 === r4.nodeType) {
        if (r4.hasAttributes()) for (const t5 of r4.getAttributeNames()) if (t5.endsWith(h2)) {
          const i6 = v2[a3++], s4 = r4.getAttribute(t5).split(o3), e5 = /([.?@])?(.*)/.exec(i6);
          d3.push({ type: 1, index: l3, name: e5[2], strings: s4, ctor: "." === e5[1] ? I : "?" === e5[1] ? L : "@" === e5[1] ? z : H }), r4.removeAttribute(t5);
        } else t5.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r4.removeAttribute(t5));
        if (y2.test(r4.tagName)) {
          const t5 = r4.textContent.split(o3), i6 = t5.length - 1;
          if (i6 > 0) {
            r4.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i6; s4++) r4.append(t5[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r4.append(t5[i6], c3());
          }
        }
      } else if (8 === r4.nodeType) if (r4.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r4.data.indexOf(o3, t5 + 1)); ) d3.push({ type: 7, index: l3 }), t5 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t4, i5) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t4, s4;
  }
};
function M(t4, i5, s4 = t4, e4) {
  if (i5 === E) return i5;
  let h3 = void 0 !== e4 ? s4._$Co?.[e4] : s4._$Cl;
  const o5 = a2(i5) ? void 0 : i5._$litDirective$;
  return h3?.constructor !== o5 && (h3?._$AO?.(false), void 0 === o5 ? h3 = void 0 : (h3 = new o5(t4), h3._$AT(t4, s4, e4)), void 0 !== e4 ? (s4._$Co ??= [])[e4] = h3 : s4._$Cl = h3), void 0 !== h3 && (i5 = M(t4, h3._$AS(t4, i5.values), h3, e4)), i5;
}
var R = class {
  constructor(t4, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i5 }, parts: s4 } = this._$AD, e4 = (t4?.creationScope ?? l2).importNode(i5, true);
    P.currentNode = e4;
    let h3 = P.nextNode(), o5 = 0, n4 = 0, r4 = s4[0];
    for (; void 0 !== r4; ) {
      if (o5 === r4.index) {
        let i6;
        2 === r4.type ? i6 = new k(h3, h3.nextSibling, this, t4) : 1 === r4.type ? i6 = new r4.ctor(h3, r4.name, r4.strings, this, t4) : 6 === r4.type && (i6 = new Z(h3, this, t4)), this._$AV.push(i6), r4 = s4[++n4];
      }
      o5 !== r4?.index && (h3 = P.nextNode(), o5++);
    }
    return P.currentNode = l2, e4;
  }
  p(t4) {
    let i5 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t4[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i5, s4, e4) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i5, this._$AM = s4, this.options = e4, this._$Cv = e4?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t4?.nodeType && (t4 = i5.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i5 = this) {
    t4 = M(this, t4, i5), a2(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d2(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(l2.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i5, _$litType$: s4 } = t4, e4 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e4) this._$AH.p(i5);
    else {
      const t5 = new R(e4, this), s5 = t5.u(this.options);
      t5.p(i5), this.T(s5), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i5 = C.get(t4.strings);
    return void 0 === i5 && C.set(t4.strings, i5 = new S2(t4)), i5;
  }
  k(t4) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s4, e4 = 0;
    for (const h3 of t4) e4 === i5.length ? i5.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i5[e4], s4._$AI(h3), e4++;
    e4 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e4), i5.length = e4);
  }
  _$AR(t4 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t4 !== this._$AB; ) {
      const s5 = i3(t4).nextSibling;
      i3(t4).remove(), t4 = s5;
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
  constructor(t4, i5, s4, e4, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i5, this._$AM = e4, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t4, i5 = this, s4, e4) {
    const h3 = this.strings;
    let o5 = false;
    if (void 0 === h3) t4 = M(this, t4, i5, 0), o5 = !a2(t4) || t4 !== this._$AH && t4 !== E, o5 && (this._$AH = t4);
    else {
      const e5 = t4;
      let n4, r4;
      for (t4 = h3[0], n4 = 0; n4 < h3.length - 1; n4++) r4 = M(this, e5[s4 + n4], i5, n4), r4 === E && (r4 = this._$AH[n4]), o5 ||= !a2(r4) || r4 !== this._$AH[n4], r4 === A ? t4 = A : t4 !== A && (t4 += (r4 ?? "") + h3[n4 + 1]), this._$AH[n4] = r4;
    }
    o5 && !e4 && this.j(t4);
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
  constructor(t4, i5, s4, e4, h3) {
    super(t4, i5, s4, e4, h3), this.type = 5;
  }
  _$AI(t4, i5 = this) {
    if ((t4 = M(this, t4, i5, 0) ?? A) === E) return;
    const s4 = this._$AH, e4 = t4 === A && s4 !== A || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h3 = t4 !== A && (s4 === A || e4);
    e4 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i5, s4) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    M(this, t4);
  }
};
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ??= []).push("3.3.3");
var D = (t4, i5, s4) => {
  const e4 = s4?.renderBefore ?? i5;
  let h3 = e4._$litPart$;
  if (void 0 === h3) {
    const t5 = s4?.renderBefore ?? null;
    e4._$litPart$ = h3 = new k(i5.insertBefore(c3(), t5), t5, void 0, s4 ?? {});
  }
  return h3._$AI(t4), h3;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t4 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t4.firstChild, t4;
  }
  update(t4) {
    const r4 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t4), this._$Do = D(r4, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i4 });
(s3.litElementVersions ??= []).push("4.2.2");

// nukernel/src/copy/global.ts
var C2 = () => globalThis.COPY;
var t3 = (key, p3) => C2().t(key, p3);

// nukernel/src/ui/base.ts
function nameOf(el2, fallback) {
  if (el2.key) {
    try {
      return t3(el2.key);
    } catch (e4) {
      return el2.key;
    }
  }
  if (el2.label) return el2.label;
  return fallback || "";
}
var NuEl = class extends i4 {
  /* THE LIGHT DOM, AND THE WHOLE OF THE DECISION ABOVE IN ONE LINE. */
  createRenderRoot() {
    return this;
  }
  /* A HOST THAT SAYS WHAT IT IS. Every element in this directory carries
     `data-nu` with its own tag, so a gate, a stylesheet and a person reading
     the inspector can all ask the same question — "is this one of ours?" —
     without a class list to keep in step. */
  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute("data-nu"))
      this.setAttribute("data-nu", this.tagName.toLowerCase());
  }
  /* THE STATE A GATE READS. The seven states of DESIGN.md §2 are ATTRIBUTES on
     the host, not classes on a child, so `[selected]`, `[open]`, `[refused]`
     and `[busy]` are one selector each in nu.css and one query each in the
     gate. `hover` and `focus` are the browser's, and `data-demo` is the
     gallery's forced spelling of them — nu.css draws the two in the same rule
     (see THE ELEMENTS at the foot of that file), so the gallery cannot show a
     hover the live page does not have. */
  bool(name) {
    return this.hasAttribute(name);
  }
  /* WHY A CONTROL WILL NOT MOVE, SAID WHERE A THUMB CAN REACH IT (DESIGN.md
     component 14). ONE say line per widget, its room reserved so a sentence
     arriving under a thumb moves nothing, and `role="status"` so it is heard
     as well as seen. */
  sayNode() {
    return this.querySelector(":scope > .nu-elsay");
  }
  say(text) {
    const n4 = this.sayNode();
    if (n4) n4.textContent = text || "";
  }
  /* A REFUSED CONTROL TAKES THE PRESS AND ANSWERS IT. Returns true when the
       press was spent on the refusal, so every handler in this directory reads
       `if (this.refuse()) return;` and no element can forget.
  
       ===== AND SO DOES A BUSY ONE (2026-09-07) =========================
       THIS LINE READ `if (this.hasAttribute("busy")) return true;` AND SAID
       NOTHING — it spent the press and printed no reason, which is the silent
       grey with a different attribute on it. DESIGN.md component 14a states the
       law the MIDI door's round established: *"a control that is WORKING is
       `aria-disabled` and never `disabled`… so a busy control stays pressable
       and ANSWERS a second press with a sentence. Ignoring a press and refusing
       one look identical; only one of them says so."* A person who cannot tell
       "working" from "broken" presses it again, and then a third time.
  
       The caller's own `why` wins where there is one — a door that knows it is
       reading a named file can say so — and the catalogue's sentence stands in
       where there is not, so a busy control with a forgetful caller is still
       impossible to mistake for a dead one. `busy` is asked FIRST because a
       control that is both busy and refused is busy: what a hand needs to know
       is that pressing again will not help yet. */
  refuse() {
    if (this.hasAttribute("busy")) {
      this.say(this.getAttribute("why") || t3("ui.busy.working"));
      return true;
    }
    if (!this.hasAttribute("refused")) {
      this.say(null);
      return false;
    }
    this.say(this.getAttribute("why") || t3("ui.refused.noReason"));
    return true;
  }
  updated(ch) {
    super.updated(ch);
    if (!this.hasAttribute("refused") && !this.hasAttribute("busy"))
      this.say(null);
  }
};

// nukernel/src/ui/buttons.ts
var NuButtonBase = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      mark: { type: String },
      tone: { type: String },
      size: { type: String },
      selected: { type: Boolean, reflect: true },
      open: { type: Boolean, reflect: true },
      refused: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
      why: { type: String }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.mark = null;
    this.tone = null;
    this.size = null;
    this.why = null;
    this.selected = false;
    this.open = false;
    this.refused = false;
    this.busy = false;
  }
  /** THE WORD, drawn or only said. */
  word() {
    return nameOf(this, "");
  }
  /** THE ONE HANDLER. A refusal is answered here and nowhere else, so no
   *  caller can forget to answer one; a press that survives it becomes a
   *  `nu-press` event the host listens for. */
  press(e4) {
    if (this.refuse()) {
      e4.preventDefault();
      e4.stopPropagation();
      return;
    }
    this.dispatchEvent(new CustomEvent(
      "nu-press",
      { bubbles: true, composed: true, detail: { value: this.word() } }
    ));
  }
  /** THE INNER BUTTON. `aria-disabled` and never `disabled`; `tabindex` stays
   *  reachable when refused, because a reason a keyboard cannot get to is the
   *  same silent grey a thumb cannot get to. */
  shell(inside, cls) {
    const name = this.word();
    return b2`<button type="button" class=${cls}
      aria-pressed=${this.selected ? "true" : A}
      aria-expanded=${this.open ? "true" : A}
      aria-disabled=${this.refused || this.busy ? "true" : A}
      aria-busy=${this.busy ? "true" : A}
      aria-label=${name || A}
      @click=${(e4) => this.press(e4)}>${inside}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
};
var NuButton = class extends NuButtonBase {
  render() {
    const w2 = this.word();
    return this.shell(b2`${this.mark ? b2`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>` : A}<span class="nu-elword">${w2}</span>`, "nu-elbtn");
  }
};
var NuIconButton = class extends NuButtonBase {
  render() {
    const w2 = this.word();
    return this.shell(
      b2`<span class="nu-elmark" aria-hidden="true"
      >${this.mark || "▫"}</span><span class="nu-vh">${w2}</span>`,
      "nu-elbtn nu-elicon"
    );
  }
};

// nukernel/src/ui/readouts.ts
var NuLamp = class extends NuEl {
  static {
    this.properties = {
      on: { type: Boolean, reflect: true },
      means: { type: String, reflect: true },
      shape: { type: String, reflect: true },
      says: { type: Boolean },
      key: { type: String },
      label: { type: String }
    };
  }
  constructor() {
    super();
    this.on = false;
    this.means = "clock";
    this.shape = "dot";
    this.says = false;
    this.key = null;
    this.label = null;
  }
  render() {
    const name = nameOf(this, "");
    return this.says && name ? b2`<i class="nu-ellamp"></i><span class="nu-vh">${name}</span>` : b2`<i class="nu-ellamp" aria-hidden="true"></i>`;
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.says) this.setAttribute("aria-hidden", "true");
  }
};
var NuLegend = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      mark: { type: String },
      for: { type: String, attribute: "for" }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.mark = null;
    this.for = null;
  }
  render() {
    const w2 = nameOf(this, "");
    const inner = b2`${this.mark ? b2`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>` : A}<span class="nu-elword">${w2}</span>`;
    return this.for ? b2`<label class="nu-ellegend" for=${this.for}>${inner}</label>` : b2`<span class="nu-ellegend">${inner}</span>`;
  }
};
var NuValue = class extends NuEl {
  static {
    this.properties = {
      value: { type: String },
      unit: { type: String },
      placeholder: { type: String },
      derived: { type: Boolean, reflect: true },
      selected: { type: Boolean, reflect: true },
      means: { type: String, reflect: true },
      key: { type: String },
      label: { type: String }
    };
  }
  constructor() {
    super();
    this.value = null;
    this.unit = null;
    this.placeholder = null;
    this.derived = false;
    this.selected = false;
    this.means = "value";
    this.key = null;
    this.label = null;
  }
  render() {
    const blank = this.value == null || this.value === "";
    const said = blank ? this.placeholder || "" : this.value;
    const name = nameOf(this, "");
    return b2`<output class="nu-elval" aria-label=${name || A}
        ?data-blank=${blank}>${said}</output>${this.unit ? b2`<small class="nu-elunit">${this.unit}</small>` : A}`;
  }
};

// nukernel/src/ui/pick.ts
function parseOptions(s4) {
  if (!s4) return [];
  return s4.split("|").map((raw) => {
    const off = raw.startsWith("!");
    const body = off ? raw.slice(1) : raw;
    const i5 = body.indexOf(":");
    const v2 = i5 < 0 ? body : body.slice(0, i5);
    const w2 = i5 < 0 ? body : body.slice(i5 + 1);
    return { v: v2.trim(), w: w2.trim(), off };
  }).filter((o5) => o5.v !== "");
}
var NuPick = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      options: { type: String },
      value: { type: String, reflect: true },
      refused: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
      why: { type: String }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.options = null;
    this.value = null;
    this.why = null;
    this.refused = false;
    this.busy = false;
  }
  opts() {
    return parseOptions(this.options);
  }
  at() {
    const o5 = this.opts();
    const i5 = o5.findIndex((x2) => x2.v === this.value);
    return i5 < 0 ? 0 : i5;
  }
  /** THE ONE WRITE. Nothing in this file mutates the record: it sets its own
   *  `value` and says so, and the host decides what that means. */
  pick(v2) {
    if (v2 === this.value) return;
    this.value = v2;
    this.dispatchEvent(new CustomEvent(
      "nu-pick",
      { bubbles: true, composed: true, detail: { value: v2 } }
    ));
  }
};
var NuRail = class extends NuPick {
  static {
    this.properties = {
      ...NuPick.properties,
      exclusive: { type: Boolean, reflect: true }
    };
  }
  constructor() {
    super();
    this.exclusive = true;
  }
  step(d3) {
    if (this.refuse()) return;
    const o5 = this.opts();
    if (!o5.length) return;
    const n4 = o5.length;
    for (let i5 = 1; i5 <= n4; i5++) {
      const c4 = o5[(this.at() + d3 * i5 + n4 * n4) % n4];
      if (c4.off) continue;
      this.pick(c4.v);
      const el2 = this.querySelector(
        '.nu-elseg[data-v="' + CSS.escape(c4.v) + '"]'
      );
      if (el2) el2.focus();
      return;
    }
    this.say(this.why || t3("ui.refused.allRefused"));
  }
  end(last) {
    if (this.refuse()) return;
    const o5 = this.opts().filter((x2) => !x2.off);
    const c4 = last ? o5[o5.length - 1] : o5[0];
    if (c4) this.pick(c4.v);
  }
  keys(e4) {
    const k2 = e4.key;
    if (k2 === "ArrowRight" || k2 === "ArrowDown") {
      e4.preventDefault();
      this.step(1);
    } else if (k2 === "ArrowLeft" || k2 === "ArrowUp") {
      e4.preventDefault();
      this.step(-1);
    } else if (k2 === "Home") {
      e4.preventDefault();
      this.end(false);
    } else if (k2 === "End") {
      e4.preventDefault();
      this.end(true);
    }
  }
  render() {
    const name = nameOf(this, "");
    const o5 = this.opts();
    const cur = this.value;
    const hard = this.refused || this.busy;
    return b2`<div class="nu-elrail" role="group" aria-label=${name || A}
      data-exclusive=${String(!!this.exclusive)}
      @keydown=${(e4) => this.keys(e4)}
      >${o5.map((c4) => b2`<button type="button" class="nu-elseg"
        data-v=${c4.v}
        aria-pressed=${String(c4.v === cur)}
        aria-disabled=${hard || c4.off ? "true" : A}
        tabindex=${c4.v === cur || !cur && c4 === o5[0] ? "0" : "-1"}
        @click=${() => {
      if (this.refuse()) return;
      if (c4.off) {
        this.say(this.why || t3("ui.refused.noReason"));
        return;
      }
      this.say(null);
      this.pick(c4.v);
    }}>${c4.w}</button>`)}</div>
      <span class="nu-elsay" role="status"></span>`;
  }
};
var NuSpinner = class extends NuPick {
  static {
    this.properties = {
      ...NuPick.properties,
      position: { type: Boolean }
    };
  }
  constructor() {
    super();
    this.position = true;
  }
  step(d3) {
    if (this.refuse()) return;
    const o5 = this.opts();
    if (!o5.length) return;
    const n4 = o5.length;
    for (let i5 = 1; i5 <= n4; i5++) {
      const c4 = o5[(this.at() + d3 * i5 + n4 * n4) % n4];
      if (c4.off) continue;
      this.say(null);
      this.pick(c4.v);
      return;
    }
    this.say(this.why || t3("ui.refused.allRefused"));
  }
  keys(e4) {
    const k2 = e4.key;
    if (k2 === "ArrowRight" || k2 === "ArrowUp") {
      e4.preventDefault();
      this.step(1);
    } else if (k2 === "ArrowLeft" || k2 === "ArrowDown") {
      e4.preventDefault();
      this.step(-1);
    } else if (k2 === "Home") {
      e4.preventDefault();
      this.step(-this.at());
    } else if (k2 === "End") {
      e4.preventDefault();
      this.step(this.opts().length - 1 - this.at());
    }
  }
  render() {
    const name = nameOf(this, "");
    const o5 = this.opts();
    const i5 = this.at();
    const now = o5[i5];
    const hard = this.refused || this.busy;
    return b2`<button type="button" class="nu-elspin"
      aria-disabled=${hard ? "true" : A}
      aria-busy=${this.busy ? "true" : A}
      aria-label=${t3(
      "ui.spin.now",
      { name, value: now ? now.w : "", n: i5 + 1, of: o5.length }
    )}
      @keydown=${(e4) => this.keys(e4)}
      @click=${() => this.step(1)}
      ><span class="nu-elspinword">${now ? now.w : ""}</span>${this.position ? b2`<small class="nu-elpos" aria-hidden="true"
            >${i5 + 1}/${o5.length}</small>` : A}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
};

// nukernel/src/ui/cells.ts
function watch(el2, fn) {
  const o5 = new MutationObserver(() => fn());
  o5.observe(el2, { childList: true });
  return o5;
}
var NuTable = class extends NuEl {
  constructor() {
    super();
    this.obs = null;
    /** A REFUSED TABLE REFUSES EVERY PRESS IN IT, and answers each one. The
     *  listener is in the CAPTURE phase so the reason is printed BEFORE a cell
     *  or a heading can act on a press the table has already declined — which
     *  is the difference between a refusal and a warning.
     *
     *  AND A BUSY ONE ANSWERS TOO, IN THE RIGHT WORDS. This said
     *  `t("ui.refused.noReason")` for both, so a table that was merely WORKING
     *  told a reader "Not available here." — a sentence about a different state,
     *  which is worse than no sentence because it is wrong rather than missing.
     *  `NuEl.refuse()` is the one owner of which sentence a spent press gets
     *  (DESIGN.md component 14 and 14a), so this asks it rather than choosing
     *  again; the early return above stays, because a table that is neither is
     *  not in the business of swallowing anything. */
    this.guard = (e4) => {
      if (!this.refused && !this.busy) return;
      e4.preventDefault();
      e4.stopPropagation();
      this.refuse();
    };
    this.key = null;
    this.label = null;
    this.flow = "across";
    this.why = null;
    this.refused = false;
    this.busy = false;
  }
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      flow: { type: String, reflect: true },
      refused: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
      why: { type: String }
    };
  }
  /** THE TRACK, BUILT AND KEPT. Everything that is not the track and not the
   *  say line is a column and belongs inside the track. */
  hydrate() {
    let track = this.querySelector(":scope > .nu-eltrack");
    if (!track) {
      track = document.createElement("div");
      track.className = "nu-eltrack";
      track.setAttribute("role", "group");
      track.tabIndex = 0;
      this.insertBefore(track, this.firstChild);
    }
    const name = nameOf(this, "");
    if (name) track.setAttribute("aria-label", name);
    for (const c4 of Array.from(this.children)) {
      if (c4 === track) continue;
      if (c4.classList.contains("nu-elsay")) continue;
      if (!(c4 instanceof HTMLElement)) continue;
      track.appendChild(c4);
    }
  }
  connectedCallback() {
    super.connectedCallback();
    this.hydrate();
    this.addEventListener("click", this.guard, true);
    this.obs = watch(this, () => this.hydrate());
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.guard, true);
    if (this.obs) {
      this.obs.disconnect();
      this.obs = null;
    }
  }
  /** The say line, and nothing else: the columns are the author's children and
   *  lit-html appends this after them. */
  render() {
    return b2`<span class="nu-elsay" role="status"></span>`;
  }
  updated(ch) {
    super.updated(ch);
    this.hydrate();
  }
};
var NuHead = class extends NuEl {
  constructor() {
    super();
    this.obs = null;
    this.key = null;
    this.label = null;
    this.count = null;
    this.held = null;
    this.current = false;
  }
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      count: { type: Number },
      held: { type: String },
      current: { type: Boolean, reflect: true }
    };
  }
  /** A CHAIN'S LENGTH IS A FACT ABOUT THE COLUMN, so the column is what
   *  measures it: whenever the membership changes, every cell in it is asked
   *  to draw again, because whether a cell prints its `order` depends on how
   *  many ordered cells stand beside it. Without this the number would be
   *  right on the first paint and stale forever after — the tree's
   *  characteristic bug, declared and never arriving. */
  refresh() {
    for (const c4 of Array.from(this.querySelectorAll(":scope > nu-cell")))
      c4.requestUpdate?.();
  }
  connectedCallback() {
    super.connectedCallback();
    this.obs = watch(this, () => this.refresh());
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.obs) {
      this.obs.disconnect();
      this.obs = null;
    }
  }
  /** The accessible name, with the two things a heading may add to it. A count
   *  and a held word are drawn as their own quiet parts and marked
   *  `aria-hidden`, so a reader hears one sentence rather than three
   *  fragments. */
  headName() {
    const name = nameOf(this, "");
    const n4 = this.count;
    if (this.held && n4 != null)
      return t3("ui.col.holding", { name, n: n4, value: this.held });
    if (n4 != null) return t3("ui.col.count", { name, n: n4 });
    if (this.held) return t3("ui.col.held", { name, value: this.held });
    return name;
  }
  inside() {
    return b2`<span class="nu-elword">${nameOf(this, "")}</span>${this.count != null ? b2`<small class="nu-elcount" aria-hidden="true">${this.count}</small>` : A}${this.held ? b2`<span class="nu-elheld" aria-hidden="true">${this.held}</span>` : A}`;
  }
};
var NuColhead = class extends NuHead {
  static {
    this.properties = {
      ...NuHead.properties,
      open: { type: Boolean, reflect: true },
      continued: { type: Boolean, reflect: true }
    };
  }
  constructor() {
    super();
    this.open = false;
    this.continued = false;
  }
  press() {
    this.open = !this.open;
    this.dispatchEvent(new CustomEvent(
      "nu-fold",
      { bubbles: true, composed: true, detail: { open: this.open } }
    ));
  }
  render() {
    if (this.continued)
      return b2`<span class="nu-elcolhead is-cont" aria-hidden="true"
        >${this.inside()}</span>`;
    return b2`<button type="button" class="nu-elcolhead"
      aria-expanded=${String(!!this.open)}
      aria-current=${this.current ? "true" : A}
      aria-label=${this.headName()}
      @click=${() => this.press()}>${this.inside()}</button>`;
  }
};
var NuRowhead = class extends NuHead {
  render() {
    return b2`<button type="button" class="nu-elrowhead"
      aria-current=${this.current ? "true" : A}
      aria-label=${this.headName()}
      @click=${() => this.dispatchEvent(new CustomEvent(
      "nu-press",
      { bubbles: true, composed: true, detail: { value: nameOf(this, "") } }
    ))}
      >${this.inside()}</button>`;
  }
};
var NuCell = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      mark: { type: String },
      value: { type: String },
      order: { type: Number },
      selected: { type: Boolean, reflect: true },
      refused: { type: Boolean, reflect: true },
      quiet: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
      why: { type: String }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.mark = null;
    this.value = null;
    this.order = null;
    this.why = null;
    this.selected = false;
    this.refused = false;
    this.quiet = false;
    this.busy = false;
  }
  /** THE SAY LINE IS THE TABLE'S, WHEN THERE IS A TABLE. One sentence per
   *  track, at the foot of it, where a thumb already is — twelve cells each
   *  with a reserved line under it would push a column off the screen to hold
   *  room for a sentence that is almost never there. Standing alone (the
   *  gallery's own state grid, a cell used outside a table) it falls back to
   *  its own, so a refusal is never silent for want of a parent. */
  sayNode() {
    const tbl = this.closest("nu-table");
    const mine = tbl && tbl.querySelector(":scope > .nu-elsay");
    return mine || super.sayNode();
  }
  /** How many cells in this group carry an `order`. Below two, the number is
   *  not printed — see the note above. */
  chain() {
    const p3 = this.parentElement;
    if (!p3) return this.order != null ? 1 : 0;
    return p3.querySelectorAll(":scope > nu-cell[order]").length;
  }
  press(e4) {
    if (this.refuse()) {
      e4.preventDefault();
      e4.stopPropagation();
      return;
    }
    this.say(null);
    this.dispatchEvent(new CustomEvent("nu-pick", {
      bubbles: true,
      composed: true,
      detail: { value: this.value != null ? this.value : nameOf(this, "") }
    }));
  }
  render() {
    const w2 = nameOf(this, "");
    const showOrder = this.order != null && this.chain() > 1;
    const body = b2`${this.mark ? b2`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>` : A}<span class="nu-elword">${w2}</span>${showOrder ? b2`<small class="nu-elorder" aria-hidden="true">${this.order}</small>` : A}`;
    if (this.quiet)
      return b2`<span class="nu-elcell is-quiet">${body}</span>
        <span class="nu-elsay" role="status"></span>`;
    return b2`<button type="button" class="nu-elcell"
      aria-pressed=${this.selected ? "true" : A}
      aria-disabled=${this.refused || this.busy ? "true" : A}
      aria-busy=${this.busy ? "true" : A}
      aria-label=${(() => {
      const why = this.refused || this.busy ? this.why || t3("ui.refused.noReason") : null;
      const named = showOrder ? t3("ui.cell.order", { name: w2, n: this.order != null ? this.order : 0 }) : w2;
      if (why) return t3("menu.withWhy", { name: named || "", why });
      return named || A;
    })()}
      @click=${(e4) => this.press(e4)}>${body}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
};

// nukernel/src/ui/panels.ts
var NuPlate = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      anchor: { type: String, reflect: true },
      open: { type: Boolean, reflect: true }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.anchor = "start";
    this.open = false;
  }
  /** A PANEL WITH NO ACCESSIBLE NAME IS NOT A COMPONENT IN THIS SYSTEM. The
   *  role and the name go on the HOST rather than on an inner box, because the
   *  host is the scroll container and the thing a reader lands in; the rows
   *  are the author's own children and stand where they were written. */
  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    const name = nameOf(this, "");
    if (name && !this.hasAttribute("aria-label"))
      this.setAttribute("aria-label", name);
  }
  render() {
    return A;
  }
};
var NuMenuRow = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      mark: { type: String },
      count: { type: Number },
      current: { type: Boolean, reflect: true },
      selected: { type: Boolean, reflect: true },
      refused: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
      why: { type: String }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.mark = null;
    this.count = null;
    this.why = null;
    this.current = false;
    this.selected = false;
    this.refused = false;
    this.busy = false;
  }
  press(e4) {
    if (this.refuse()) {
      e4.preventDefault();
      e4.stopPropagation();
      return;
    }
    this.dispatchEvent(new CustomEvent(
      "nu-press",
      { bubbles: true, composed: true, detail: { value: nameOf(this, "") } }
    ));
  }
  render() {
    const w2 = nameOf(this, "");
    return b2`<button type="button" class="nu-elmenurow"
      aria-current=${this.current ? "page" : A}
      aria-pressed=${this.selected ? "true" : A}
      aria-disabled=${this.refused || this.busy ? "true" : A}
      aria-busy=${this.busy ? "true" : A}
      aria-label=${w2 || A}
      @click=${(e4) => this.press(e4)}
      ><span class="nu-elmark" aria-hidden="true">${this.mark || ""}</span
      ><span class="nu-elword">${w2}</span>${this.count != null ? b2`<small class="nu-elcount" aria-hidden="true">${this.count}</small>` : A}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
};

// nukernel/src/ui/atlas.ts
function fold(s4) {
  return String(s4).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function parseRows(s4) {
  if (!s4) return [];
  return s4.split(";").map((raw) => {
    const f3 = raw.split("|").map((x2) => x2.trim());
    return {
      year: f3[0] || "",
      name: f3[1] || "",
      place: f3[2] || "",
      k: f3[3] || (f3[1] || "").toLowerCase()
    };
  }).filter((r4) => r4.name !== "");
}
var NuIndex = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      rows: { type: String },
      query: { type: String, reflect: true },
      current: { type: String, reflect: true }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.rows = null;
    this.query = "";
    this.current = null;
  }
  /** The AND-fold, over name, key, place and year. */
  hit(r4) {
    const q = fold(this.query || "").split(/\s+/).filter(Boolean);
    if (!q.length) return true;
    const hay = fold(r4.name + " " + r4.k + " " + r4.place + " " + r4.year);
    return q.every((tok2) => hay.indexOf(tok2) >= 0);
  }
  type(e4) {
    this.query = e4.target.value;
  }
  render() {
    const all = parseRows(this.rows);
    const shown = all.filter((r4) => this.hit(r4));
    const q = this.query || "";
    return b2`<div class="nu-elixfind">
        <input class="nu-elixq" type="search" .value=${q}
          aria-label=${t3("atlas.find.aria")}
          @input=${(e4) => this.type(e4)}>
        <button type="button" class="nu-elixclear"
          aria-label=${t3("atlas.find.clear")}
          @click=${() => {
      this.query = "";
    }}>\u2715</button>
      </div>
      <ul class="nu-elixlist" aria-label=${nameOf(this, "") || A}
        >${all.map((r4) => b2`<li class="nu-elixli" data-k=${r4.k}
          ?hidden=${!this.hit(r4)}><button type="button" class="nu-elixrow"
          aria-current=${this.current && this.current === r4.k ? "true" : "false"}
          aria-label=${t3(
      "atlas.row.aria",
      { name: r4.name, place: r4.place, year: r4.year }
    )}
          @click=${() => {
      this.current = r4.k;
      this.dispatchEvent(new CustomEvent(
        "nu-pick",
        { bubbles: true, composed: true, detail: { value: r4.k } }
      ));
    }}><span class="nu-elixy">${r4.year}</span
          ><span class="nu-elixw">${r4.name}</span
          ><span class="nu-elixp">${r4.place}</span></button></li>`)}</ul>
      <p class="nu-elixnone" role="status"
        >${shown.length ? "" : t3("atlas.find.none", { q })}</p>`;
  }
  /** `empty` IS DERIVED AND IS REFLECTED, not passed. A caller cannot know
   *  whether a query matched until the filter has run, so the element that
   *  runs it is the one that says so — and it says so as an ATTRIBUTE, which
   *  is how every other state in this system is spelled and how the stylesheet
   *  reaches it. It is deliberately not a reactive property: nothing observes
   *  it, so writing it here cannot start a loop. */
  updated(ch) {
    super.updated(ch);
    const all = parseRows(this.rows);
    this.toggleAttribute("empty", all.length > 0 && !all.some((r4) => this.hit(r4)));
  }
};
function parseMarks(s4) {
  if (!s4) return [];
  return s4.split(";").map((raw) => {
    const f3 = raw.split("|").map((x2) => x2.trim());
    return {
      name: f3[0] || "",
      year: f3[1] || "",
      lat: parseFloat(f3[2] || "0") || 0,
      lon: parseFloat(f3[3] || "0") || 0,
      k: f3[4] || (f3[0] || "").toLowerCase()
    };
  }).filter((m2) => m2.name !== "");
}
var R2 = 60;
var C3 = 72;
var LON0 = -40;
var RAD = Math.PI / 180;
var NuGlobe = class extends NuEl {
  static {
    this.properties = {
      key: { type: String },
      label: { type: String },
      marks: { type: String },
      year: { type: String, reflect: true },
      at: { type: String, reflect: true }
    };
  }
  constructor() {
    super();
    this.key = null;
    this.label = null;
    this.marks = null;
    this.year = null;
    this.at = null;
  }
  /** x, y and the near-face test, all of it the orthographic projection with
   *  φ₀ = 0. Arithmetic; see the head of this file. */
  project(lat, lon) {
    const phi = lat * RAD, dl = (lon - LON0) * RAD;
    return {
      x: C3 + R2 * Math.cos(phi) * Math.sin(dl),
      y: C3 - R2 * Math.sin(phi),
      near: Math.cos(phi) * Math.cos(dl) > 0
    };
  }
  /** Which marks the swept year holds. No year set is no sweep, and every
   *  mark stands. */
  held(m2) {
    return !this.year || m2.year === this.year;
  }
  graticule() {
    const out = [];
    for (const lat of [-60, -30, 0, 30, 60]) {
      const half = R2 * Math.cos(lat * RAD);
      const y3 = C3 - R2 * Math.sin(lat * RAD);
      out.push(w`<line class="nu-elgratline" x1=${C3 - half} y1=${y3}
        x2=${C3 + half} y2=${y3}></line>`);
    }
    for (const d3 of [-60, -30, 0, 30, 60]) {
      const k2 = Math.sin(d3 * RAD);
      const rx = Math.abs(k2 * R2);
      const sweep = k2 >= 0 ? 1 : 0;
      out.push(w`<path class="nu-elgratline" d=${"M " + C3 + "," + (C3 - R2) + " A " + rx.toFixed(2) + "," + R2 + " 0 0 " + sweep + " " + C3 + "," + (C3 + R2)}></path>`);
    }
    return out;
  }
  render() {
    const name = nameOf(this, "");
    const ms = parseMarks(this.marks);
    return b2`<svg class="nu-elglobe" viewBox="0 0 144 144"
      role="application" tabindex="0" aria-label=${name || A}
      ><circle class="nu-elsea" cx=${C3} cy=${C3} r=${R2}></circle
      ><g class="nu-elgrat" aria-hidden="true">${this.graticule()}</g
      ><circle class="nu-ellimb" cx=${C3} cy=${C3} r=${R2}></circle
      >${this.year ? w`<text class="nu-elyear" x=${C3} y=${C3 + R2 + 12}
            aria-hidden="true">${this.year}</text>` : A}${ms.map((m2) => {
      const p3 = this.project(m2.lat, m2.lon);
      const on = p3.near && this.held(m2);
      return w`<g class="nu-elplace" data-when=${on ? "1" : "0"}
          role="button" tabindex=${on ? 0 : -1}
          aria-current=${this.at === m2.k ? "true" : A}
          aria-label=${t3(
        "atlas.mark.aria",
        { place: m2.name, year: m2.year, name: m2.k }
      )}
          @click=${() => {
        this.at = m2.k;
        this.dispatchEvent(new CustomEvent(
          "nu-pick",
          { bubbles: true, composed: true, detail: { value: m2.k } }
        ));
      }}><circle class="nu-elring" cx=${p3.x.toFixed(2)} cy=${p3.y.toFixed(2)}
            r="8"></circle><circle class="nu-elpin" cx=${p3.x.toFixed(2)}
            cy=${p3.y.toFixed(2)} r="3.5"></circle></g>`;
    })}</svg>`;
  }
  /** THE THREE DERIVED STATES, REFLECTED. `sweeping` is a year being held,
   *  `marked` is one of the marks being the record that is playing, and
   *  `empty` is a year that holds one mark or none — which is real and
   *  reachable, and on which the year stamp is the whole picture. None of the
   *  three is a reactive property, so writing them here observes nothing and
   *  schedules nothing: the element still paints once per change. */
  updated(ch) {
    super.updated(ch);
    const ms = parseMarks(this.marks);
    const on = ms.filter((m2) => {
      const p3 = this.project(m2.lat, m2.lon);
      return p3.near && this.held(m2);
    });
    this.toggleAttribute("sweeping", !!this.year);
    this.toggleAttribute("marked", !!this.at && on.some((m2) => m2.k === this.at));
    this.toggleAttribute("empty", !!this.year && on.length <= 1);
  }
};

// nukernel/src/ui/api.ts
var ALL_STATES = [
  "rest",
  "hover",
  "focus",
  "selected",
  "current",
  "open",
  "sweeping",
  "marked",
  "empty",
  "refused",
  "busy"
];
var PSEUDO_STATES = ["hover", "focus"];
var SELECTED = {
  name: "selected",
  type: "boolean",
  note: "the lamp is on — this is the standing answer; writes aria-pressed"
};
var OPEN = {
  name: "open",
  type: "boolean",
  note: "this control has something standing under it; writes aria-expanded"
};
var REFUSED = {
  name: "refused",
  type: "boolean",
  note: "aria-disabled and NEVER disabled, so a thumb still reaches the reason"
};
var WHY = {
  name: "why",
  type: "string",
  note: "the reason, <= 12 words; a press prints it in this widget's one say line"
};
var BUSY = {
  name: "busy",
  type: "boolean",
  note: "the box is working on it: aria-busy, still pressable, and a press says so"
};
var KEY = {
  name: "key",
  type: "string",
  note: "a catalogue key — the accessible name is t(key), never a literal in a caller"
};
var LABEL = {
  name: "label",
  type: "string",
  note: "the word, when it is the record's own and not the catalogue's"
};
var MARK = {
  name: "mark",
  type: "string",
  note: "one Unicode mark drawn in --sym; never an emoji, and never the only name"
};
var CURRENT = {
  name: "current",
  type: "boolean",
  note: "you are HERE — writes aria-current, never aria-pressed: a place is not a press"
};
var COUNT = {
  name: "count",
  type: "number",
  note: "how many are inside; a heading that can name a count must, or the fold hides a number"
};
var HELD = {
  name: "held",
  type: "string",
  note: "the standing word this group holds — a readout, drawn quiet and aria-hidden"
};
var SPEC = [
  {
    tag: "nu-button",
    title: "Button",
    from: "DESIGN.md §2 — the whole vocabulary's first entry",
    what: "a word you press: one thing happens, and the word says which",
    attrs: [
      KEY,
      LABEL,
      MARK,
      {
        name: "tone",
        type: "enum",
        values: ["plain", "lamp", "clip"],
        note: "plain is the panel's own; lamp is the one that is ON; clip is destruction and nothing else"
      },
      {
        name: "size",
        type: "enum",
        values: ["tap", "tight"],
        note: "tap is the 44px floor and the default; tight is a control seated inside another one"
      },
      SELECTED,
      OPEN,
      REFUSED,
      WHY,
      BUSY
    ],
    states: ALL_STATES,
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key), else label; a mark is decoration and is never the name",
    refuses: "a press prints why in the button's own say line and writes nothing",
    demo: { label: "Add player", mark: "⊕" }
  },
  {
    tag: "nu-icon-button",
    title: "Icon button",
    from: "DESIGN.md §2 (button) + §2/15 (glyph): every icon carries its word",
    what: "a mark you press, with its word said out loud and drawn nowhere",
    attrs: [
      MARK,
      KEY,
      LABEL,
      {
        name: "tone",
        type: "enum",
        values: ["plain", "lamp", "clip"],
        note: "as the button's, and for the same reason"
      },
      SELECTED,
      OPEN,
      REFUSED,
      WHY,
      BUSY
    ],
    states: ALL_STATES,
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key), else label — a mark with no word is a control with no name",
    refuses: "a press prints why in the button's own say line and writes nothing",
    demo: { mark: "≡", label: "Menu" }
  },
  {
    tag: "nu-lamp",
    title: "Lamp",
    from: "DESIGN.md §2 component 11",
    what: "the one place saturated colour is allowed: a thing that is doing something is LIT",
    attrs: [
      { name: "on", type: "boolean", note: "lit or dark; a lamp has no third position" },
      {
        name: "means",
        type: "enum",
        values: ["hand", "clock", "meter", "flag"],
        note: "which lamp: you set it / scheduled / measured / armed — never two meanings in one colour"
      },
      {
        name: "shape",
        type: "enum",
        values: ["dot", "bar"],
        note: "a dot beside a name, or a bar down the edge of the thing it belongs to"
      },
      LABEL,
      KEY,
      {
        name: "says",
        type: "boolean",
        note: "off by default: a lamp beside a named thing is decoration and is aria-hidden, because a light that follows the beat may not be announced all record long"
      }
    ],
    states: ["rest", "selected"],
    keys: "none — a lamp is a readout and takes no focus",
    named: "aria-hidden unless says is set, and then t(key) or label",
    refuses: "nothing to refuse: a lamp is never pressed",
    demo: { means: "clock", shape: "dot" }
  },
  {
    tag: "nu-legend",
    title: "Legend",
    from: "DESIGN.md §0 — legends printed on the panel, values on the screen",
    what: "a printed label: small caps, dim, fixed, and it never lights",
    attrs: [
      KEY,
      LABEL,
      MARK,
      {
        name: "for",
        type: "string",
        note: "the id of the control it names; with it this is a <label>, without it a <span>"
      }
    ],
    states: ["rest"],
    keys: "none of its own; a legend with for= passes a click to its control",
    named: "it IS the name — t(key), else label",
    refuses: "nothing: a legend has no state, which is the whole point of it",
    demo: { label: "Tempo" }
  },
  {
    tag: "nu-value",
    title: "Value",
    from: "DESIGN.md §0 — values live on the screen: phosphor, bright, and the only things that change",
    what: "a readout: what the machine currently says, in tabular numerals",
    attrs: [
      { name: "value", type: "string", note: "what it says; blank prints the placeholder" },
      { name: "unit", type: "string", note: "the unit, after the number, in the quiet register" },
      { name: "placeholder", type: "string", note: "what stands in when nothing is written" },
      {
        name: "derived",
        type: "boolean",
        note: "nobody set this — it was inherited or dealt, so it reads quiet; bold is a hand"
      },
      {
        name: "means",
        type: "enum",
        values: ["value", "meter", "clock", "flag"],
        note: "which register: the screen's own phosphor, or one of the three lamps when the number IS a state"
      },
      LABEL,
      KEY
    ],
    states: ["rest", "selected"],
    keys: "none — a value is read, not pressed; the control beside it is what a hand touches",
    named: "t(key) or label names the quantity; the value itself is its content",
    refuses: "nothing: a value that cannot be set is drawn derived, not refused",
    demo: { value: "96", unit: "bpm" }
  },
  {
    tag: "nu-rail",
    title: "Exclusive rail",
    from: "DESIGN.md §2 component 24 (shipped v302 as .nu-wchips.is-exclusive)",
    what: "one of a set, drawn as one of a set: joined segments, one hairline between, the standing word filled",
    attrs: [
      LABEL,
      KEY,
      {
        name: "options",
        type: "list",
        note: "value:word, separated by |; the word is what a hand reads, the value is what the record stores"
      },
      { name: "value", type: "string", note: "the standing answer; the segment wearing it is filled" },
      {
        name: "exclusive",
        type: "boolean",
        note: "on by default and drawn as data-exclusive, so a gate reads what a hand sees; off is a chain and the segments come apart"
      },
      REFUSED,
      WHY,
      BUSY
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "Left/Right step between segments and pick, Home/End take the ends; Enter and Space press one",
    named: "the group is t(key) or label; each segment is its own word",
    refuses: "a refused rail says its reason and does not move; a refused segment is stepped OVER, never into",
    demo: { label: "Feel", options: "straight:straight|swung:swung|loose:loose", value: "swung" }
  },
  {
    tag: "nu-spinner",
    title: "Spinner",
    from: "DESIGN.md §2 component 23 (shipped v302 as .nu-spin)",
    what: "a state of at most five positions: ONE button, and a press rotates it",
    attrs: [
      LABEL,
      KEY,
      { name: "options", type: "list", note: "value:word, separated by | — at most five, or it is a list you shop in" },
      { name: "value", type: "string", note: "the position it is standing on" },
      {
        name: "position",
        type: "boolean",
        note: "on by default: a control showing one of five has to say there are five"
      },
      REFUSED,
      WHY,
      BUSY
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "a press rotates forward and wraps; Right and Up step forward, Left and Down back, Home and End take the ends",
    named: "t(key) or label, said with the word and the position — ui.spin.now, on the one button",
    refuses: "a refused spinner says its reason and does not move; it steps OVER a refused word and never into one",
    demo: { label: "Attack", options: "hard:straight in|soft:soft|slow:slow|swell:swelling", value: "soft" }
  },
  {
    tag: "nu-table",
    title: "Table",
    from: "DESIGN.md §2 (table cell, column head, row head) — the shape .nu-lztrack already ships",
    what: "a sideways track of columns: the track scrolls, the page does not",
    attrs: [
      KEY,
      LABEL,
      {
        name: "flow",
        type: "enum",
        values: ["across", "down"],
        note: "across is columns side by side and the default; down is groups on the side and rows running out"
      },
      REFUSED,
      WHY,
      BUSY
    ],
    states: ["rest", "focus", "refused", "busy"],
    keys: "Tab reaches the track; the arrows and the wheel scroll it, and its columns take their own presses",
    named: "t(key) or label, on the track — a scroll region with no name is a room with no door",
    refuses: "a refused table takes every press inside it and prints one reason in its own say line",
    demo: { label: "Instruments" },
    demoChildren: [
      {
        tag: "nu-colhead",
        attrs: { label: "Strings", count: "4", open: "", current: "" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Violin", value: "violin", selected: "" } },
          { tag: "nu-cell", attrs: { label: "Viola", value: "viola" } },
          { tag: "nu-cell", attrs: { label: "Cello", value: "cello", mark: "◆" } },
          { tag: "nu-cell", attrs: { label: "Double bass", value: "contrabass", refused: "" } }
        ]
      },
      {
        tag: "nu-colhead",
        attrs: { label: "Reeds", count: "3", open: "", held: "clarinet" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Clarinet", value: "clarinet", order: "1" } },
          { tag: "nu-cell", attrs: { label: "Oboe", value: "oboe", order: "2" } },
          { tag: "nu-cell", attrs: { label: "Bassoon", value: "bassoon", quiet: "" } }
        ]
      },
      {
        tag: "nu-colhead",
        attrs: { label: "Reeds", continued: "", open: "" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Cor anglais", value: "corAnglais" } },
          { tag: "nu-cell", attrs: { label: "Contrabassoon", value: "contrabassoon" } }
        ]
      }
    ]
  },
  {
    tag: "nu-colhead",
    title: "Column head",
    from: "DESIGN.md §2 component 16 (column head) + .nu-lzhead / .nu-lzcont",
    what: "a column: its name, how many are in it, what it is holding, and whether it is folded",
    attrs: [
      KEY,
      LABEL,
      COUNT,
      HELD,
      CURRENT,
      {
        name: "open",
        type: "boolean",
        note: "unfolded — its cells are on the glass; writes aria-expanded, and the fold is one CSS rule"
      },
      {
        name: "continued",
        type: "boolean",
        note: "this column carries on the one before it, so it is a READOUT: aria-hidden, no count, no fold, no press"
      }
    ],
    states: ["rest", "hover", "focus", "current", "open"],
    keys: "Enter and Space fold and unfold it; a continuation takes no key, because it is not a control",
    named: "t(key) or label, said with its count and its held word — the two are drawn aria-hidden",
    refuses: "it does not: a heading that cannot fold is drawn continued, which is a readout and not a refusal",
    demo: { label: "Strings", count: "4", held: "violin" },
    demoChildren: [
      { tag: "nu-cell", attrs: { label: "Violin", value: "violin", selected: "" } },
      { tag: "nu-cell", attrs: { label: "Viola", value: "viola" } },
      { tag: "nu-cell", attrs: { label: "Cello", value: "cello" } }
    ]
  },
  {
    tag: "nu-rowhead",
    title: "Row head",
    from: "DESIGN.md §2 component 17 (row head)",
    what: "the same group with the axis turned: the name down the side, its cells running out across",
    attrs: [KEY, LABEL, COUNT, HELD, CURRENT],
    states: ["rest", "hover", "focus", "current"],
    keys: "Enter and Space press it; there is no fold, because a folded row collapses its own handle",
    named: "t(key) or label, said with its count and its held word",
    refuses: "it does not: a row head names a group and never withholds one",
    demo: { label: "Drums", count: "3" },
    demoChildren: [
      { tag: "nu-cell", attrs: { label: "Kick", value: "kick", selected: "" } },
      { tag: "nu-cell", attrs: { label: "Snare", value: "snare" } },
      { tag: "nu-cell", attrs: { label: "Hat", value: "hat" } }
    ]
  },
  {
    tag: "nu-cell",
    title: "Table cell",
    from: "DESIGN.md §2 component 15 (table cell) — Paul: “just list the items as cells”",
    what: "one option, drawn as a line and not a pill: full width, word at the start edge",
    attrs: [
      KEY,
      LABEL,
      MARK,
      { name: "value", type: "string", note: "what the record stores; the word is what a hand reads" },
      SELECTED,
      {
        name: "order",
        type: "number",
        note: "its place in a chain, printed only when a chain has more than one member"
      },
      {
        name: "quiet",
        type: "boolean",
        note: "INERT, which is NOT refused: no press was ever offered, so no button, no dash, no aria-disabled"
      },
      REFUSED,
      WHY,
      BUSY
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "Enter and Space press it; Tab reaches it, refused or not, because a reason a keyboard cannot reach is silent",
    named: "t(key) or label; with a printed order the name says the position too",
    refuses: "a press prints why in the TABLE's one say line, at the foot of the track where a thumb already is",
    demo: { label: "Cello", value: "cello" }
  },
  {
    tag: "nu-plate",
    title: "Plate",
    from: "DESIGN.md §2 component 18 (plate) — the app's #nu-menu, given a tag",
    what: "the panel that arrives: a column of rows, capped, scrolling inside itself",
    attrs: [
      KEY,
      LABEL,
      {
        name: "anchor",
        type: "enum",
        values: ["start", "end"],
        note: "which edge of the screen it hangs from; start, because the hamburger is on the left"
      },
      OPEN
    ],
    states: ["open"],
    keys: "Tab walks its rows; Escape is the page's to close it, not the plate's",
    named: "t(key) or label, on the panel itself — a plate with no name is a room with no door",
    refuses: "it does not; a row inside it refuses, and says so in its own say line",
    demo: { label: "Menu", open: "" },
    demoChildren: [
      { tag: "nu-menu-row", attrs: { label: "Master", mark: "⇅", current: "" } },
      { tag: "nu-menu-row", attrs: { label: "Sections", mark: "⌗", count: "4" } },
      { tag: "nu-menu-row", attrs: { label: "Players", mark: "⊙", count: "12" } },
      { tag: "nu-menu-row", attrs: { label: "Motifs", mark: "§" } },
      { tag: "nu-menu-row", attrs: { label: "Rules", mark: "≡" } },
      { tag: "nu-menu-row", attrs: { label: "Where", mark: "◉" } },
      { tag: "nu-menu-row", attrs: { label: "Export", mark: "⤓", refused: "" } }
    ]
  },
  {
    tag: "nu-menu-row",
    title: "Menu row",
    from: "DESIGN.md §2 component 19 (menu row) — Paul: “icons should all have same width”",
    what: "one line of a plate: a mark in a fixed advance, a name, and at most a count",
    attrs: [
      KEY,
      LABEL,
      MARK,
      COUNT,
      CURRENT,
      SELECTED,
      REFUSED,
      WHY,
      BUSY
    ],
    states: ["rest", "hover", "focus", "selected", "current", "refused", "busy"],
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key) or label; the mark is decoration and the count is drawn aria-hidden",
    refuses: "a press prints why in the row's own say line and goes nowhere",
    demo: { label: "Sections", mark: "⌗", count: "4" }
  },
  {
    tag: "nu-index",
    title: "Index",
    from: "DESIGN.md §2 (sheet row / label row) — the atlas's own #atlasIndex, 502 rows",
    what: "a searchable list of records: a year, a name, a place, and one row you are on",
    attrs: [
      KEY,
      LABEL,
      {
        name: "rows",
        type: "list",
        note: "year|name|place|key, rows separated by ; — a name may hold a comma and never a pipe"
      },
      {
        name: "query",
        type: "string",
        note: "the standing search; folded NFD and matched as AND-tokens over name, key, place and year"
      },
      {
        name: "current",
        type: "string",
        note: "the key of the row you are ON — aria-current on exactly one row, and never aria-selected"
      }
    ],
    states: ["rest", "hover", "focus", "current", "empty"],
    keys: "type in the field to filter; Tab walks the rows; Enter and Space open one",
    named: "t(key) or label names the list; each row says its name, its place and its year",
    refuses: "no row refuses; a query that matches nothing is answered by a sentence naming it",
    demo: {
      label: "Records",
      rows: "1888|Ragtime|Sedalia|ragtime; 1917|Stride|Harlem|stride; 1948|Mambo|Havana|mambo; 1962|Bossa nova|Rio|bossa; 1969|Reggae|Kingston|reggae; 1973|Dub|Kingston|dub; 1977|No wave|New York|nowave; 1982|Electro|Detroit|electro; 1988|Acid house|Chicago|acid; 1991|Trip hop|Bristol|triphop; 1994|Jungle|London|jungle; 2003|Grime|London|grime"
    },
    demoStates: {
      current: { current: "dub" },
      empty: { query: "zzzz" }
    }
  },
  {
    tag: "nu-globe",
    title: "Globe",
    from: "DESIGN.md §2 (the atlas map) — the app's #atlasMap, SVG and never canvas",
    what: "an orthographic sphere with a mark on every place a record was made",
    attrs: [
      KEY,
      LABEL,
      {
        name: "marks",
        type: "list",
        note: "name|year|lat|lon|key, marks separated by ; — the projection is arithmetic, the paint is CSS"
      },
      {
        name: "year",
        type: "string",
        note: "the year being swept: marks it does not hold leave the sphere, and the year is stamped on it"
      },
      {
        name: "at",
        type: "string",
        note: "the key of the mark that is playing — it wears the ring and aria-current"
      }
    ],
    states: ["rest", "focus", "sweeping", "marked", "empty"],
    keys: "Tab reaches the sphere and then each mark it is showing; Enter and Space open one",
    named: "t(key) or label on the sphere; each mark says its place, its year and its record",
    refuses: "nothing to refuse: a year holding no mark is empty, which is an answer and not a refusal",
    demo: {
      label: "Where the records are",
      marks: "Kingston|1973|18.0|-76.8|dub; Bristol|1991|51.5|-2.6|triphop; New York|1977|40.7|-74.0|nowave; Sedalia|1888|38.7|-93.2|ragtime"
    },
    demoStates: {
      sweeping: { year: "1973" },
      marked: { year: "1973", at: "dub" },
      empty: { year: "1888" }
    }
  }
];
function attrsOf(tag) {
  const s4 = SPEC.find((x2) => x2.tag === tag);
  return s4 ? s4.attrs.map((a3) => a3.name) : [];
}

// nukernel/src/ui/gallery.ts
var root = () => document.documentElement;
var tok = (n4) => getComputedStyle(root()).getPropertyValue(n4).trim();
function rgbOf(value) {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:-9999px;visibility:hidden";
  probe.style.color = value;
  document.body.appendChild(probe);
  const c4 = getComputedStyle(probe).color;
  probe.remove();
  const m2 = c4.match(/(\d+(?:\.\d+)?)/g);
  if (!m2 || m2.length < 3) return null;
  return [+m2[0], +m2[1], +m2[2]];
}
var lin = (c4) => {
  const x2 = c4 / 255;
  return x2 <= 0.03928 ? x2 / 12.92 : Math.pow((x2 + 0.055) / 1.055, 2.4);
};
var lum = (c4) => 0.2126 * lin(c4[0]) + 0.7152 * lin(c4[1]) + 0.0722 * lin(c4[2]);
function ratio(a3, b3) {
  const ca = rgbOf(a3), cb = rgbOf(b3);
  if (!ca || !cb) return null;
  const la = lum(ca), lb = lum(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
var GROUNDS = ["--deck", "--panel", "--well"];
var INKS = [
  "--legend",
  "--legend-dim",
  "--legend-faint",
  "--value",
  "--lamp",
  "--armed",
  "--clip",
  "--v0",
  "--v1",
  "--v2",
  "--v3",
  "--vb",
  "--drum"
];
var EDGES = ["--rule", "--rule-strong", "--lamp", "--armed", "--clip"];
var MEANINGS = ["--hand", "--clock", "--meter", "--flag"];
var CLUSTERS = [
  "--lz-h0",
  "--lz-h1",
  "--lz-h2",
  "--lz-h3",
  "--lz-h4",
  "--lz-h5",
  "--lz-h6",
  "--lz-h7"
];
var LEVELS = ["--q1", "--q2", "--q3", "--q4"];
var TYPE = ["--t0", "--t1", "--t2", "--t3", "--t4", "--t5"];
var WEIGHTS = ["--fw-body", "--fw-label", "--fw-block", "--fw-display"];
var RADII = ["--r0", "--r1", "--r2", "--r-pill"];
var SPACE = ["--s1", "--s2", "--s3", "--s4", "--s5"];
var SIZES = [
  "--tap",
  "--box",
  "--cell",
  "--ctl",
  "--bw",
  "--bw-hard",
  "--sl-trough",
  "--sl-cap",
  "--sl-grab",
  "--sl-line",
  "--env-h",
  "--env-dot",
  "--bar-h",
  "--top-h"
];
var TEXT_FLOOR = 4.5;
var EDGE_FLOOR = 3;
function el(tag, cls, text) {
  const n4 = document.createElement(tag);
  if (cls) n4.className = cls;
  if (text != null) n4.textContent = text;
  return n4;
}
function section(host, id, title, blurb) {
  const s4 = el("section", "dg-sec");
  s4.id = id;
  s4.appendChild(el("h2", "dg-h", title));
  s4.appendChild(el("p", "dg-blurb", blurb));
  host.appendChild(s4);
  return s4;
}
function palette(host) {
  const s4 = section(host, "palette", t3("ui.gal.palette"), t3("ui.gal.palette.help"));
  const swatches = (names, head) => {
    s4.appendChild(el("h3", "dg-h3", head));
    const grid = el("div", "dg-swatches");
    for (const n4 of names) {
      const v2 = tok(n4);
      if (!v2) continue;
      const cell = el("div", "dg-swatch");
      const chip = el("div", "dg-chip");
      chip.style.background = "var(" + n4 + ")";
      cell.appendChild(chip);
      cell.appendChild(el("code", "dg-tokname", n4));
      const val = el("small", "dg-tokval");
      val.setAttribute("data-tok", n4);
      cell.appendChild(val);
      grid.appendChild(cell);
    }
    s4.appendChild(grid);
  };
  swatches(GROUNDS, t3("ui.gal.grounds"));
  swatches(["--legend", "--legend-dim", "--legend-faint", "--on-fill"], t3("ui.gal.legends"));
  swatches(["--lamp", "--armed", "--clip", "--value", "--lamp-hot"], t3("ui.gal.lamps"));
  swatches(MEANINGS, t3("ui.gal.meanings"));
  swatches(["--grey1", "--grey2", "--grey3", "--grey4"], t3("ui.gal.greys"));
  swatches(["--v0", "--v1", "--v2", "--v3", "--vb", "--drum"], t3("ui.gal.voices"));
  swatches(LEVELS, t3("ui.gal.levels"));
  swatches(CLUSTERS, t3("ui.gal.clusters"));
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.contrast")));
  s4.appendChild(el("p", "dg-blurb", t3("ui.gal.contrast.help")));
  const table = el("table", "dg-matrix");
  table.id = "dg-contrast";
  const thead = el("thead");
  const hr = el("tr");
  hr.appendChild(el("th", "", t3("ui.gal.foreground")));
  for (const g2 of GROUNDS) hr.appendChild(el("th", "", g2));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tb = el("tbody");
  const row = (fg, floor) => {
    const tr = el("tr");
    tr.setAttribute("data-fg", fg);
    tr.setAttribute("data-floor", String(floor));
    const th = el("th", "dg-fg");
    const dot = el("i", "dg-dot");
    dot.style.background = "var(" + fg + ")";
    th.appendChild(dot);
    th.appendChild(el("code", "", fg));
    tr.appendChild(th);
    for (const g2 of GROUNDS) {
      const r4 = ratio("var(" + fg + ")", "var(" + g2 + ")");
      const td = el("td", "dg-num");
      td.setAttribute("data-ratio", r4 == null ? "" : r4.toFixed(2));
      td.setAttribute("data-pass", String(r4 != null && r4 >= floor));
      td.textContent = r4 == null ? "—" : r4.toFixed(2);
      if (r4 != null && r4 < floor) td.classList.add("is-under");
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  };
  const band = (label) => {
    const tr = el("tr", "dg-band");
    const td = el("td", "", label);
    td.setAttribute("colspan", String(GROUNDS.length + 1));
    tr.appendChild(td);
    tb.appendChild(tr);
  };
  band(t3("ui.gal.asText"));
  for (const f3 of INKS) row(f3, TEXT_FLOOR);
  band(t3("ui.gal.asEdge"));
  for (const f3 of EDGES) row(f3, EDGE_FLOOR);
  table.appendChild(tb);
  s4.appendChild(table);
}
function scales(host) {
  const s4 = section(host, "scales", t3("ui.gal.scales"), t3("ui.gal.scales.help"));
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.type")));
  const ty = el("div", "dg-stack");
  for (const n4 of TYPE) {
    const r4 = el("div", "dg-typerow");
    const w2 = el("span", "dg-typespec");
    w2.style.fontSize = "var(" + n4 + ")";
    w2.textContent = t3("ui.gal.specimen");
    r4.appendChild(w2);
    r4.appendChild(el("code", "dg-tokname", n4));
    r4.appendChild(el("small", "dg-tokval", tok(n4)));
    ty.appendChild(r4);
  }
  s4.appendChild(ty);
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.weight")));
  const wt = el("div", "dg-stack");
  for (const n4 of WEIGHTS) {
    const r4 = el("div", "dg-typerow");
    const w2 = el("span", "dg-typespec");
    w2.style.fontWeight = "var(" + n4 + ")";
    w2.textContent = t3("ui.gal.specimen");
    r4.appendChild(w2);
    r4.appendChild(el("code", "dg-tokname", n4));
    r4.appendChild(el("small", "dg-tokval", tok(n4)));
    wt.appendChild(r4);
  }
  s4.appendChild(wt);
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.space")));
  s4.appendChild(el("p", "dg-blurb", t3("ui.gal.space.help")));
  const sp = el("div", "dg-stack");
  sp.id = "dg-ramp";
  for (const n4 of SPACE) {
    const r4 = el("div", "dg-typerow");
    const bar = el("span", "dg-rampbar");
    bar.style.inlineSize = "var(" + n4 + ")";
    bar.setAttribute("data-step", n4);
    r4.appendChild(bar);
    r4.appendChild(el("code", "dg-tokname", n4));
    r4.appendChild(el("small", "dg-tokval", tok(n4)));
    sp.appendChild(r4);
  }
  s4.appendChild(sp);
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.radius")));
  const rd = el("div", "dg-swatches");
  for (const n4 of RADII) {
    const cell = el("div", "dg-swatch");
    const chip = el("div", "dg-chip dg-radchip");
    chip.style.borderRadius = "var(" + n4 + ")";
    cell.appendChild(chip);
    cell.appendChild(el("code", "dg-tokname", n4));
    cell.appendChild(el("small", "dg-tokval", tok(n4)));
    rd.appendChild(cell);
  }
  s4.appendChild(rd);
  s4.appendChild(el("h3", "dg-h3", t3("ui.gal.geometry")));
  const geo = el("table", "dg-matrix");
  const gb = el("tbody");
  for (const n4 of SIZES) {
    const tr = el("tr");
    tr.appendChild(el("th", "dg-fg", n4));
    const td = el("td", "dg-num", tok(n4));
    td.setAttribute("colspan", "3");
    tr.appendChild(td);
    gb.appendChild(tr);
  }
  geo.appendChild(gb);
  s4.appendChild(geo);
}
function kid(k2) {
  const n4 = document.createElement(k2.tag);
  for (const [a3, v2] of Object.entries(k2.attrs || {})) n4.setAttribute(a3, v2);
  if (n4.hasAttribute("refused") && !n4.hasAttribute("why"))
    n4.setAttribute("why", t3("ui.gal.demo.why"));
  for (const c4 of k2.kids || []) n4.appendChild(kid(c4));
  return n4;
}
function example(spec, state) {
  const n4 = document.createElement(spec.tag);
  for (const [k2, v2] of Object.entries(spec.demo)) n4.setAttribute(k2, v2);
  if (state === "selected" && spec.demo["options"]) {
    const opts = spec.demo["options"].split("|");
    const last = opts[opts.length - 1] || "";
    n4.setAttribute("value", (last.split(":")[0] || "").replace(/^!/, ""));
  } else if (spec.demoStates && spec.demoStates[state]) {
    for (const [k2, v2] of Object.entries(spec.demoStates[state]))
      n4.setAttribute(k2, v2);
  } else if (state !== "rest" && PSEUDO_STATES.indexOf(state) < 0) {
    n4.setAttribute(state, "");
  }
  if (state === "refused") n4.setAttribute("why", t3("ui.gal.demo.why"));
  if (PSEUDO_STATES.indexOf(state) >= 0) n4.setAttribute("data-demo", state);
  if (spec.tag === "nu-lamp" && state === "selected") n4.setAttribute("on", "");
  for (const k2 of spec.demoChildren || []) n4.appendChild(kid(k2));
  n4.setAttribute("data-state", state);
  if (state === "refused")
    requestAnimationFrame(() => {
      const b3 = n4.querySelector("button");
      if (b3) b3.click();
    });
  return n4;
}
function elements(host) {
  const s4 = section(host, "elements", t3("ui.gal.elements"), t3("ui.gal.elements.help"));
  for (const spec of SPEC) {
    const card = el("article", "dg-el");
    card.id = "el-" + spec.tag;
    card.setAttribute("data-tag", spec.tag);
    const head = el("header", "dg-elhead");
    head.appendChild(el("h3", "dg-h3", spec.title));
    head.appendChild(el("code", "dg-tag", "<" + spec.tag + ">"));
    card.appendChild(head);
    card.appendChild(el("p", "dg-what", spec.what));
    card.appendChild(el("p", "dg-from", spec.from));
    const states = el("div", "dg-states");
    states.setAttribute("data-count", String(spec.states.length));
    for (const st of ALL_STATES) {
      if (spec.states.indexOf(st) < 0) continue;
      const cell = el("div", "dg-state");
      cell.setAttribute("data-state", st);
      cell.appendChild(el("small", "dg-statename", st));
      const box = el("div", "dg-stagebox");
      box.appendChild(example(spec, st));
      cell.appendChild(box);
      states.appendChild(cell);
    }
    card.appendChild(states);
    const tbl = el("table", "dg-attrs");
    const tb = el("tbody");
    for (const a3 of spec.attrs) {
      const tr = el("tr");
      tr.appendChild(el("th", "dg-attr", a3.name));
      const ty = el(
        "td",
        "dg-attrtype",
        a3.type === "enum" ? (a3.values || []).join(" · ") : a3.type
      );
      tr.appendChild(ty);
      tr.appendChild(el("td", "dg-attrnote", a3.note));
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    card.appendChild(tbl);
    const laws = el("dl", "dg-laws");
    const law = (k2, v2) => {
      laws.appendChild(el("dt", "", k2));
      laws.appendChild(el("dd", "", v2));
    };
    law(t3("ui.gal.keyboard"), spec.keys);
    law(t3("ui.gal.named"), spec.named);
    law(t3("ui.gal.refuses"), spec.refuses);
    card.appendChild(laws);
    s4.appendChild(card);
  }
}
function chrome(host) {
  const bar = el("div", "dg-bar");
  const h1 = el("h1", "dg-title", t3("ui.gal.title"));
  bar.appendChild(h1);
  const btn = document.createElement("nu-button");
  btn.setAttribute("label", t3("ui.gal.daylight"));
  btn.setAttribute("mark", "☀");
  btn.id = "dg-theme";
  btn.addEventListener("nu-press", () => {
    const light = root().getAttribute("data-theme") === "light";
    if (light) root().removeAttribute("data-theme");
    else root().setAttribute("data-theme", "light");
    btn.toggleAttribute("selected", !light);
    remeasure();
  });
  bar.appendChild(btn);
  host.appendChild(bar);
}
function remeasure() {
  for (const n4 of Array.from(
    document.querySelectorAll(".dg-tokval[data-tok]")
  )) {
    const tk = n4.getAttribute("data-tok");
    const c4 = rgbOf("var(" + tk + ")");
    n4.textContent = c4 ? "rgb(" + c4.join(" ") + ")" : tok(tk);
  }
  const tbl = document.getElementById("dg-contrast");
  if (!tbl) return;
  for (const tr of Array.from(tbl.querySelectorAll("tr[data-fg]"))) {
    const fg = tr.getAttribute("data-fg");
    const floor = +(tr.getAttribute("data-floor") || "4.5");
    const tds = Array.from(tr.querySelectorAll("td"));
    GROUNDS.forEach((g2, i5) => {
      const td = tds[i5];
      if (!td) return;
      const r4 = ratio("var(" + fg + ")", "var(" + g2 + ")");
      td.setAttribute("data-ratio", r4 == null ? "" : r4.toFixed(2));
      td.setAttribute("data-pass", String(r4 != null && r4 >= floor));
      td.textContent = r4 == null ? "—" : r4.toFixed(2);
      td.classList.toggle("is-under", r4 != null && r4 < floor);
    });
  }
}
function gallery(host) {
  host.classList.add("dg");
  chrome(host);
  palette(host);
  scales(host);
  elements(host);
  remeasure();
  host.setAttribute("data-built", "1");
}

// nukernel/src/ui/index.ts
var TAGS = [
  ["nu-button", NuButton],
  ["nu-icon-button", NuIconButton],
  ["nu-lamp", NuLamp],
  ["nu-legend", NuLegend],
  ["nu-value", NuValue],
  ["nu-rail", NuRail],
  ["nu-spinner", NuSpinner],
  ["nu-table", NuTable],
  ["nu-colhead", NuColhead],
  ["nu-rowhead", NuRowhead],
  ["nu-cell", NuCell],
  ["nu-plate", NuPlate],
  ["nu-menu-row", NuMenuRow],
  ["nu-index", NuIndex],
  ["nu-globe", NuGlobe]
];
function define() {
  const declared = SPEC.map((s4) => s4.tag).sort().join(",");
  const defined = TAGS.map((r4) => r4[0]).sort().join(",");
  if (declared !== defined)
    throw new Error("ui: the spec and the tag table disagree — " + declared + " vs " + defined);
  for (const [tag, ctor] of TAGS)
    if (!customElements.get(tag)) customElements.define(tag, ctor);
}
define();
globalThis.NuUI = {
  SPEC,
  ALL_STATES,
  PSEUDO_STATES,
  attrsOf,
  gallery,
  ratio,
  TEXT_FLOOR,
  EDGE_FLOOR,
  define
};
export {
  ALL_STATES,
  EDGE_FLOOR,
  NuButton,
  NuCell,
  NuColhead,
  NuGlobe,
  NuIconButton,
  NuIndex,
  NuLamp,
  NuLegend,
  NuMenuRow,
  NuPlate,
  NuRail,
  NuRowhead,
  NuSpinner,
  NuTable,
  NuValue,
  PSEUDO_STATES,
  SPEC,
  TEXT_FLOOR,
  attrsOf,
  define,
  gallery,
  ratio
};

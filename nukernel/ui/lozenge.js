// nukernel/ui/lozenge.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/lozenge/ by `node tools/ui/build.js`.
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

// nukernel/src/copy/global.ts
var C2 = () => globalThis.COPY;
var t3 = (key, p2) => C2().t(key, p2);

// nukernel/src/lozenge/api.ts
var HUES = 8;
var HOLD_MS = 600;
var SLOP = 8;

// nukernel/src/lozenge/clusters.ts
function clustersFrom(options, other) {
  const by = /* @__PURE__ */ new Map();
  const loose = [];
  for (const o3 of options || []) {
    const v2 = String(o3.value == null ? "" : o3.value);
    const w2 = o3.cluster == null ? "" : String(o3.cluster).trim();
    if (!w2) {
      loose.push(v2);
      continue;
    }
    if (!by.has(w2)) by.set(w2, []);
    by.get(w2).push(v2);
  }
  const out = [];
  for (const [word, vals] of by) if (vals.length) out.push({ word, vals });
  if (loose.length) out.push({ word: other == null ? "" : String(other), vals: loose });
  return out;
}
function clustersOf(options, other) {
  return clustersFrom(options, other);
}
var NG = () => globalThis.NuGenres || {};
function scaleFamilyOf(key) {
  const g2 = NG();
  const fam = (g2.SCALEFAMILY || {})[key] || (g2.MODEFAMILY || {})[key];
  if (!fam) return null;
  const word = (g2.FAMILYLABEL || {})[fam];
  return word == null ? null : String(word);
}
function scaleFamilyWords() {
  return Object.values(NG().FAMILYLABEL || {}).map(String);
}
function checkScaleFamilies() {
  const g2 = NG();
  const sf = g2.SCALEFAMILY || {}, mf = g2.MODEFAMILY || {};
  const all = /* @__PURE__ */ new Set([...Object.keys(g2.SCALES || {}), ...Object.keys(g2.MODES || {})]);
  const loose = [], twice = [];
  let placed = 0;
  for (const k2 of all) {
    const a2 = sf[k2], b2 = mf[k2];
    if (a2 && b2 && a2 !== b2) twice.push(k2);
    if (scaleFamilyOf(k2)) placed++;
    else loose.push(k2);
  }
  return { keys: all.size, placed, loose, twice, families: scaleFamilyWords() };
}

// nukernel/src/lozenge/field.ts
function refuseSilentGrey(spec) {
  for (const o3 of spec.options || [])
    if ((o3.disabled || o3.quiet) && !(o3.why && String(o3.why).trim()))
      throw new Error('lozenge: "' + spec.key + '" / "' + String(o3.value) + '" is ' + (o3.disabled ? "disabled" : "quiet") + " with no `why`");
}
function bins(spec) {
  const opts = spec.options || [];
  const by = /* @__PURE__ */ new Map();
  for (const o3 of opts) if (!by.has(String(o3.value))) by.set(String(o3.value), o3);
  const declared = spec.clusters && spec.clusters.length ? spec.clusters : clustersFrom(
    opts.map((o3) => ({ value: String(o3.value), cluster: o3.cluster })),
    spec.other
  );
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const c2 of declared) {
    const list = [];
    for (const v0 of c2.vals || []) {
      const v2 = String(v0);
      const o3 = by.get(v2);
      if (!o3 || seen.has(v2)) continue;
      seen.add(v2);
      list.push(o3);
    }
    if (list.length) out.push({ word: c2.word == null ? "" : String(c2.word), opts: list });
  }
  const left = [];
  for (const [v2, o3] of by) if (!seen.has(v2)) left.push(o3);
  if (left.length) out.push({ word: "", opts: left });
  return out;
}
var FOLDS = /* @__PURE__ */ new Map();
function lozengeField(spec) {
  refuseSilentGrey(spec);
  const key = String(spec.key);
  const plan = bins(spec);
  const multi = !!spec.multi;
  const ordered = !!spec.ordered;
  const off = spec.why && String(spec.why).trim() || "";
  const label = spec.label == null ? key : String(spec.label);
  const host = document.createElement("div");
  host.className = "nu-lzfield" + (off ? " is-off" : "");
  host.setAttribute("role", "group");
  host.setAttribute(
    "aria-label",
    off ? t3("menu.withWhy", { name: label, why: off }) : label
  );
  host.dataset.sel = key;
  host.dataset.k = spec.k ? String(spec.k) : "lz|" + key;
  if (off) {
    host.dataset.why = off;
    host.setAttribute("aria-disabled", "true");
  }
  if (spec.ungated) host.dataset.ungated = "true";
  let cur = spec.value == null ? "" : String(spec.value);
  const chain = (spec.values || []).map(String).filter((v2, i3, a2) => a2.indexOf(v2) === i3);
  const folded = FOLDS.get(spec.key) || /* @__PURE__ */ new Set();
  FOLDS.set(spec.key, folded);
  let said = "";
  let focusK = null;
  const stands = (v2) => multi ? chain.indexOf(v2) >= 0 : v2 === cur;
  const paintV = () => {
    host.dataset.v = multi ? chain.join(",") : cur;
  };
  paintV();
  const lozenge = (o3, tabbable) => {
    const v2 = String(o3.value);
    const hot = stands(v2);
    const own = o3.why ? String(o3.why).trim() : "";
    const refused = !!off || !!o3.disabled;
    const why = off || own || "";
    const n2 = ordered && multi && hot ? chain.indexOf(v2) + 1 : 0;
    return b`<button type="button"
      class=${e3({ "nu-lz": true, "is-hot": hot, "is-quiet": !!o3.quiet })}
      data-k=${key + "|" + v2}
      data-v=${v2}
      tabindex=${tabbable && !refused ? "0" : "-1"}
      aria-pressed=${String(hot)}
      aria-disabled=${o2(refused ? "true" : void 0)}
      data-why=${o2(why ? why : void 0)}
      aria-label=${why ? t3("menu.withWhy", { name: o3.label, why }) : o3.label}
      ><span class="nu-lzword" data-w=${o3.label}>${o3.label}</span
      >${n2 ? b`<small class="nu-lzn">${n2}</small>` : A}</button> `;
  };
  const stopOf = (b2) => {
    const live = b2.opts.filter((o3) => !off && !o3.disabled);
    if (!live.length) return null;
    const mine = live.find((o3) => focusK === key + "|" + String(o3.value));
    if (mine) return String(mine.value);
    const hot = live.find((o3) => stands(String(o3.value)));
    return String((hot || live[0]).value);
  };
  const draw = () => D(b`${plan.map((b2, ci) => {
    const shut = folded.has(ci);
    const stop = stopOf(b2);
    return b`<section
      class=${e3({ "nu-lzcluster": true, "is-folded": shut })}
      data-cluster=${b2.word}
      data-hue=${ci % HUES}
      >${b2.word ? b`<button type="button" class="nu-lzhead"
          data-k=${key + "|cluster|" + b2.word}
          aria-expanded=${String(!shut)}
          ><span class="nu-lzheadword">${b2.word}</span
          ><small class="nu-lzcount">${b2.opts.length}</small></button>` : A}<div class="nu-lzwrap" ?hidden=${shut}
        >${b2.opts.map((o3) => lozenge(o3, stop === String(o3.value)))}</div
      ></section>`;
  })}${off ? b`<small class="nu-why">${off}</small>` : A}<p class="nu-lzsay" role="status" aria-live="polite"
      ?data-said=${!!said}>${said}</p>`, host);
  const write = (v2) => {
    if (off) return;
    const o3 = plan.flatMap((b2) => b2.opts).find((x2) => String(x2.value) === v2);
    if (!o3 || o3.disabled) return;
    if (multi) {
      const i3 = chain.indexOf(v2);
      const on = i3 < 0;
      if (on) chain.push(v2);
      else chain.splice(i3, 1);
      paintV();
      draw();
      if (typeof spec.onToggle === "function") spec.onToggle(v2, on, chain.slice());
    } else {
      if (v2 === cur) return;
      cur = v2;
      paintV();
      draw();
      if (typeof spec.onWrite === "function") spec.onWrite(cur);
    }
    host.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const speak = (el) => {
    const v2 = String(el.dataset.v || "");
    const o3 = plan.flatMap((b2) => b2.opts).find((x2) => String(x2.value) === v2);
    said = o3 && o3.why && String(o3.why).trim() || (o3 ? o3.label : v2);
    draw();
  };
  let timer = null;
  let from = null;
  let swallow = false;
  const disarm = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  host.addEventListener("pointerdown", (e4) => {
    const el = e4.target?.closest?.(".nu-lz");
    if (!el || !host.contains(el)) return;
    disarm();
    swallow = false;
    from = { x: e4.clientX, y: e4.clientY, el };
    timer = window.setTimeout(() => {
      timer = null;
      if (!from) return;
      swallow = true;
      speak(from.el);
    }, HOLD_MS);
  });
  host.addEventListener("pointermove", (e4) => {
    if (!from) return;
    if (Math.abs(e4.clientX - from.x) + Math.abs(e4.clientY - from.y) <= SLOP) return;
    disarm();
    from = null;
    swallow = true;
  });
  const lift = () => {
    disarm();
    from = null;
  };
  host.addEventListener("pointerup", lift);
  host.addEventListener("pointercancel", () => {
    disarm();
    from = null;
    swallow = true;
  });
  host.addEventListener("click", (e4) => {
    const tgt = e4.target;
    const head = tgt?.closest?.(".nu-lzhead");
    if (head && host.contains(head)) {
      const sec = head.closest("section.nu-lzcluster");
      const ci = sec ? Array.from(host.children).indexOf(sec) : -1;
      if (ci >= 0) {
        if (folded.has(ci)) folded.delete(ci);
        else folded.add(ci);
        draw();
      }
      return;
    }
    const el = tgt?.closest?.(".nu-lz");
    if (!el || !host.contains(el)) return;
    if (swallow) {
      swallow = false;
      return;
    }
    if (el.getAttribute("aria-disabled") === "true") {
      speak(el);
      return;
    }
    write(String(el.dataset.v || ""));
  });
  const walk = () => Array.from(host.querySelectorAll("section.nu-lzcluster")).map((sec) => {
    const w2 = sec.querySelector(".nu-lzwrap");
    if (!w2 || w2.hidden) return [];
    return Array.from(w2.querySelectorAll("button.nu-lz")).filter((b2) => !b2.disabled && b2.getAttribute("aria-disabled") !== "true");
  });
  const land = (b2) => {
    if (!b2) return;
    focusK = b2.dataset.k || null;
    draw();
    b2.focus();
  };
  host.addEventListener("keydown", (e4) => {
    const el = e4.target?.closest?.(".nu-lz");
    if (!el || !host.contains(el)) return;
    const k2 = e4.key;
    if (k2 === "Enter" || k2 === " " || k2 === "Spacebar") {
      swallow = false;
      return;
    }
    const groups = walk();
    const flat = groups.flat();
    const at = flat.indexOf(el);
    if (at < 0) return;
    if (k2 === "ArrowRight" || k2 === "ArrowLeft") {
      e4.preventDefault();
      land(flat[Math.min(flat.length - 1, Math.max(0, at + (k2 === "ArrowRight" ? 1 : -1)))]);
      return;
    }
    if (k2 === "ArrowDown" || k2 === "ArrowUp") {
      e4.preventDefault();
      const gi = groups.findIndex((g2) => g2.indexOf(el) >= 0);
      if (gi < 0) return;
      const pos = groups[gi].indexOf(el);
      const d2 = k2 === "ArrowDown" ? 1 : -1;
      for (let j = gi + d2; j >= 0 && j < groups.length; j += d2) {
        const g2 = groups[j];
        if (!g2.length) continue;
        land(g2[Math.min(g2.length - 1, pos)]);
        return;
      }
      return;
    }
    if (k2 === "Home") {
      e4.preventDefault();
      land(flat[0]);
      return;
    }
    if (k2 === "End") {
      e4.preventDefault();
      land(flat[flat.length - 1]);
      return;
    }
  });
  host.addEventListener("focusin", (e4) => {
    const el = e4.target?.closest?.(".nu-lz");
    if (el && host.contains(el)) focusK = el.dataset.k || null;
  });
  draw();
  return host;
}

// nukernel/src/lozenge/index.ts
globalThis.NuLozenge = {
  lozengeField,
  clustersFrom,
  clustersOf,
  scaleFamilyOf
};
export {
  HOLD_MS,
  HUES,
  SLOP,
  checkScaleFamilies,
  clustersFrom,
  clustersOf,
  lozengeField,
  scaleFamilyOf,
  scaleFamilyWords
};

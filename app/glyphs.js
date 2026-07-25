// glyphs.js — the FLOATING GLYPHS: faint alien "station idents" that drift behind
// the star map (2D DOM layer) and through the star-cruise atmosphere (3D sprites).
//
// ARCHAEOLOGY. These are a rebuild of the roaming glyphs that lived in the old
// laserdisc video-layer chaos deck (engine/video-layer.js, removed with the found-
// video layer 2026-07-25; see git 0c62df5 "bigger/livelier glyphs" + 9433eee
// "glyphs fade in and out"). Back then they were station idents composited THROUGH
// the footage: a fixed set of box-drawing / braille / rune / I-Ching / geometric
// clusters, teleported to random spots at wild sizes, drifting dust-mote slow with
// gentle rotation + scale breathing, born at opacity 0 and fading in/out. The old
// version ALSO random-flickered (opacity blinks); this rebuild DROPS the flicker to
// obey today's seizure/taste laws (the 2D layer was just slowed 10x + de-flashed):
// pure smooth fade-in / hold / fade-out, drift measured in single-digit px/sec.
//
// This is a standalone lightweight layer — no dependency on the (departed) video
// layer. main.js calls initGlyphMap() for the star map; starcruise.js calls
// makeGlyphAtmosphere(THREE, …) for the 3D view.

// THE SET — fleeting alien station idents (verbatim from the old video-layer GLYPHS):
// box-drawing, braille, runes, I-Ching trigrams, geometric + technical symbols. The
// E̸R̷R̸ cluster keeps its combining strike-throughs (a broadcast glitch ident).
export const GLYPHS = ["╬╪▚▞", "⠺⠵⣿⠋", "▟▙◈▛", "◭◮⊗⊘", "⋔⋕⊞⊟", "↯⇶↯↺", "ᛝᚦᛟᚱ",
  "▓▚E̸R̷R̸▞░", "☰☲☵☷", "◇⬡◇⬢", "∴∵∷⁂", "⌁⌇⌭⌗"];

const pick = (a) => a[(Math.random() * a.length) | 0];
const rnd = (a, b) => a + Math.random() * (b - a);
const reduceMotion = () => {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
};
const isMobile = () => {
  try { return /Mobi|iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4; }
  catch (e) { return false; }
};

// ============================ 2D — the star-map layer ============================
// A fixed layer at z-index:0: ABOVE the demoscene/video canvases (z-index:-1) and
// BELOW the star-map SVG (#map, z-index:1) + all UI. Glyphs are large, faint and
// slightly blurred (a backfloating watermark), each self-managing a slow drift +
// fade cycle via cheap COMPOSITOR-ONLY CSS transitions (transform + opacity — left/
// top are set once on teleport, never transitioned, so no layout thrash).
let mapInited = false;
export function initGlyphMap() {
  if (mapInited || typeof document === "undefined") return;
  mapInited = true;
  const layer = document.createElement("div");
  layer.id = "glyphmap";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const POOL = isMobile() ? 5 : 9;
  const RM = reduceMotion();
  for (let i = 0; i < POOL; i++) {
    const el = document.createElement("div");
    el.className = "glyph";
    layer.appendChild(el);
    // stagger the first spawn so the pool doesn't pulse in lockstep.
    setTimeout(() => cycleMapGlyph(el, RM), rnd(0, 9000));
  }
}
// ONE glyph life: teleport to a random spot at a random size, fade in over seconds,
// drift a few vmin over its whole (dust-mote slow) life, fade out, respawn. NO
// flicker — the opacity only ever ramps smoothly (seizure/taste law).
function cycleMapGlyph(el, RM) {
  if (!el.isConnected) return;
  el.textContent = pick(GLYPHS);
  const size = rnd(7, 32);                                   // vmin: ticker .. big faint watermark
  el.style.fontSize = size.toFixed(1) + "vmin";
  const inset = Math.min(40, 5 + size * 0.9);               // % safe margin scales with size
  const x0 = rnd(inset, 100 - inset), y0 = rnd(inset, 100 - inset);
  const rot0 = rnd(-6, 6);
  // huge watermarks stay faintest; small idents a touch brighter (still background-faint).
  const peak = Math.max(0.12, 0.34 - (size - 7) / (32 - 7) * 0.2);
  const life = RM ? rnd(30000, 46000) : rnd(24000, 40000);  // 24..46s of life
  const fade = 4200;                                        // fade-in / fade-out window (ms)
  // teleport (no transition), born invisible.
  el.style.transition = "none";
  el.style.left = x0.toFixed(1) + "%";
  el.style.top = y0.toFixed(1) + "%";
  el.style.transform = "translate(-50%,-50%) rotate(" + rot0.toFixed(1) + "deg)";
  el.style.opacity = "0";
  void el.offsetWidth;                                       // commit before arming the drift
  // reduced motion: hold still (no drift / rotation), just the slow crossfade.
  const ang = Math.random() * Math.PI * 2, dist = RM ? 0 : rnd(4, 11);   // vmin over the WHOLE life
  const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
  const rot1 = RM ? rot0 : rot0 + (Math.random() < 0.5 ? -1 : 1) * rnd(2, 9);
  const breath = RM ? 1 : (Math.random() < 0.5 ? rnd(1.04, 1.16) : rnd(0.88, 0.98));
  el.style.transition = "transform " + Math.round(life) + "ms linear, opacity " + fade + "ms ease";
  requestAnimationFrame(() => {
    el.style.opacity = peak.toFixed(3);
    el.style.transform = "translate(calc(-50% + " + dx.toFixed(1) + "vmin),calc(-50% + " + dy.toFixed(1) +
      "vmin)) rotate(" + rot1.toFixed(1) + "deg) scale(" + breath.toFixed(3) + ")";
  });
  // fade out over the last `fade` ms of life...
  setTimeout(() => { if (el.isConnected) el.style.opacity = "0"; }, Math.max(0, life - fade));
  // ...then respawn elsewhere after a short gap.
  setTimeout(() => cycleMapGlyph(el, RM), life + rnd(800, 3200));
}

// ======================== 3D — the star-cruise atmosphere =======================
// The SAME idents drifting through the star-cruise sky. THREE.Sprites (camera-facing
// billboards) on a shell that FOLLOWS the camera, so the glyphs surround the pilot
// like luminous motes in the atmosphere from every pose. Each glyph's texture is
// BAKED ONCE onto a canvas (no per-frame texture upload — respects the post-planet
// static fix). Additive + depthTest off so they read as faint superimposed idents;
// per-sprite opacity breathes on a slow sine (never snaps), the whole shell rotates
// dust-mote slow. ~8 sprites on mobile, ~12 on desktop.
//
// CONTRACT: makeGlyphAtmosphere(THREE, { coarse }) -> { group, update(dt, camera), dispose() }
export function makeGlyphAtmosphere(THREE, opts) {
  opts = opts || {};
  const group = new THREE.Object3D();
  group.name = "glyph-atmosphere";
  group.frustumCulled = false;
  group.renderOrder = 3;                          // after the sky dome (renderOrder 1)
  const N = opts.coarse ? 8 : 12;
  const RM = reduceMotion();
  const sprites = [];

  // bake one glyph string to a THREE.CanvasTexture (ONCE). Cyan ident on transparent,
  // VT323 if present else monospace, with a soft glow — the old glyphs' palette.
  function bakeTexture(str) {
    const S = 256;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, S, S);
    ctx.font = "108px 'VT323', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(120,255,255,0.85)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "rgba(210,255,250,0.92)";
    // draw twice so the glow builds up (idents read luminous under additive blend).
    ctx.fillText(str, S / 2, S / 2 + 4);
    ctx.fillText(str, S / 2, S / 2 + 4);
    const tex = new THREE.CanvasTexture(cv);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;                        // baked once; never touched again
    return tex;
  }

  for (let i = 0; i < N; i++) {
    const tex = bakeTexture(GLYPHS[i % GLYPHS.length]);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    if (mat.toneMapped !== undefined) mat.toneMapped = false;
    const sp = new THREE.Sprite(mat);
    // a shell around the (camera-followed) group origin: random direction, mid radius.
    const th = rnd(0, Math.PI * 2), ph = Math.acos(rnd(-1, 1)), r = rnd(38, 92);
    const dir = { x: Math.sin(ph) * Math.cos(th), y: Math.cos(ph) * 0.55, z: Math.sin(ph) * Math.sin(th) };
    sp.position.set(dir.x * r, dir.y * r, dir.z * r);
    const scl = rnd(9, 26);
    sp.scale.set(scl, scl, 1);
    sp.frustumCulled = false;
    sp.renderOrder = 3;
    group.add(sp);
    sprites.push({
      sp, mat,
      // faint peak; the bigger the glyph the fainter (background watermark law).
      peak: Math.max(0.05, 0.18 - (scl - 9) / (26 - 9) * 0.1),
      // a slow, seconds-long opacity breath (NEVER a snap): random period + phase.
      period: rnd(11, 22), phase: rnd(0, Math.PI * 2),
      // a gentle bob so they aren't rigidly fixed on the shell.
      bobAmp: RM ? 0 : rnd(1.2, 3.2), bobPer: rnd(9, 17), base: sp.position.clone ? sp.position.clone() : null,
    });
  }

  let clock = 0;
  return {
    group,
    // update(dt, camera): follow the camera (atmosphere surrounds the pilot), rotate the
    // shell dust-mote slow, breathe each sprite's opacity + bob. Cheap: only opacity +
    // position writes — no texture uploads, no allocations.
    update(dt, camera) {
      dt = dt > 0 ? dt : 0;
      clock += dt;
      if (camera && camera.position) group.position.copy(camera.position);
      if (!RM) group.rotation.y += dt * 0.01;         // slow atmospheric drift
      for (const g of sprites) {
        // opacity breath: a raised sine in [0,1], smooth — no flashing.
        const env = 0.5 - 0.5 * Math.cos((clock / g.period + g.phase / (Math.PI * 2)) * Math.PI * 2);
        g.mat.opacity = g.peak * env;
        if (g.bobAmp && g.base) {
          g.sp.position.y = g.base.y + Math.sin(clock / g.bobPer * Math.PI * 2 + g.phase) * g.bobAmp;
        }
      }
    },
    dispose() {
      for (const g of sprites) {
        try { if (g.mat.map) g.mat.map.dispose(); g.mat.dispose(); } catch (e) {}
      }
      try { if (group.parent) group.parent.remove(group); } catch (e) {}
      sprites.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// ALIEN TRANSLITERATION (Paul 2026-07-25: "add a function that adds random
// glyphs to the names of genres, replacing letters. One or two per genre/
// cluster name. It should be different every time.")
//
// Substitutes 1-2 letters per name with a visually-adjacent glyph, so the
// catalogue reads as the same words rendered in someone else's alphabet —
// legible, but not ours. The map is homoglyphic on purpose: swapping O for Ø
// keeps the word scannable where a random rune would just be noise.
//
// "Different every time" = different every SESSION, not every frame. The star
// map measures label widths to decide which names it can draw without
// overlapping (the LOD cull), so a name that re-rolled between frames would
// make labels flicker in and out. One roll per page load, memoized here: each
// visit is a different alphabet, and within a visit the chart holds still.
const HOMOGLYPH = {
  a:"ΛΔ∀", b:"ßЬ", c:"ϹƇ", d:"Ð", e:"ƎΣ€", f:"Ϝ", g:"Ǥ", h:"Ħ", i:"ǀƗ", j:"ĵ",
  k:"Ϗ", l:"Ł", m:"Ϻ", n:"ИͶ", o:"Ø⊙◉", p:"ÞϷ", q:"Ҩ", r:"ЯƦ", s:"§Ϩ", t:"†⊤",
  u:"Ʊ∪", v:"∨", w:"Ш", x:"✕", y:"Ψ", z:"Ƶ"
};
const glyphMemo = new Map();
// one shared roll per session — reseeded on load, never during it
const seedRoll = Math.floor(Math.random() * 0x7fffffff);
function hashStr(str){ let h=2166136261>>>0;
  for(const ch of String(str)) h=Math.imul(h^ch.charCodeAt(0),16777619);
  return h>>>0; }
export function alienize(name){
  if(!name) return name;
  if(glyphMemo.has(name)) return glyphMemo.get(name);
  const chars=[...String(name)];
  // candidate positions: letters we have a glyph for, never the first character
  // of the whole name (the eye needs one true letter to latch onto)
  const cand=[];
  for(let i=1;i<chars.length;i++){
    const lower=chars[i].toLowerCase();
    if(HOMOGLYPH[lower] && chars[i]!==" ") cand.push(i);
  }
  let out=name;
  if(cand.length){
    const r=hashStr(name+":"+seedRoll);
    const n=cand.length>4 ? 1+(r%2) : 1;                 // 1-2 swaps; short names get one
    const picked=new Set();
    for(let k=0;k<n;k++){
      const idx=cand[(r>>>(k*5+3))%cand.length];
      if(picked.has(idx)) continue;
      picked.add(idx);
      const set=HOMOGLYPH[chars[idx].toLowerCase()];
      chars[idx]=set[(r>>>(k*7+11))%set.length];
    }
    out=chars.join("");
  }
  glyphMemo.set(name,out);
  return out;
}

// The inverse, for anything that needs to match a drawn label back to its real
// name — the headless gates do (a test asserting "this genre's name is drawn"
// cannot know which letters this session swapped). Exposed on window for them.
const PLAIN = (() => { const m = {};
  for (const [letter, set] of Object.entries(HOMOGLYPH))
    for (const g of set) m[g] = letter;
  return m; })();
export function deglyph(str){
  return String(str||"").replace(/./gu, ch => {
    const lower = PLAIN[ch];
    if (!lower) return ch;
    return lower;                       // case is lost; compare case-insensitively
  });
}
try { window.__GLYPHS = { alienize, deglyph }; } catch(e){}

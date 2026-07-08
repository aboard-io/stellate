// demo-layer.js — DEMOSCENE background layer. Runs old-school size-coding
// assembly demos (WebAssembly fantasy-console carts) behind the star map and
// MIXES them with the found-video layer.
//
// Engine: MicroW8 (https://github.com/exoticorn/microw8, Unlicense / public
// domain). MicroW8 is a 320x240 / 256-colour / 60Hz WASM fantasy console; its
// carts are <256-byte demoscene effects (tunnels, plasma, fireworks…). We
// vendor its runtime under vendor/microw8/ (see SOURCES.md).
//
// CANVAS-EMBED, not iframe. We DON'T load the vendored microw8.html in an
// <iframe> — we replicate its minimal host directly (the whole host is ~40
// lines; mirrored from microw8.html's render loop). Why canvas over iframe:
//   * NO AudioContext. The iframe runtime always spins up an AudioWorklet and
//     plays the cart's chiptune — which would fight our generative music AND,
//     worse, stay stuck behind a "Click to start" gesture gate inside a
//     pointer-events:none background frame (it could never start). Our host
//     omits audio entirely: the cart's `snd`/`sndGes` is never called, so the
//     demo runs instantly with no gesture and no sound conflict.
//   * Real blend control. We own the <canvas>, so mix-blend-mode:screen +
//     tunable opacity composite the demo THROUGH the video (Paul: "mix them").
//   * Music-reactivity. We drive the cart's TIME register ourselves, so a
//     musical bar can nudge the effect's speed (see pulse()).
//
// How MicroW8 runs (mirrored from microw8.html):
//   loader.wasm   exports load_uw8(len) — decompresses a packed .uw8 cart (or
//                 the packed platform) that we place at offset 0 of a scratch
//                 memory, returning the standard-wasm length.
//   platform.uw8  the console's API module (packed) — provides cls/line/… +
//                 endFrame() as imports for carts; instantiated into the shared
//                 256KB runtime memory.
//   cart .uw8     the demo — exports upd() (per frame) and maybe start().
//   each frame:   write TIME(=mem[64]) / gamepad(mem[68]) / frame(mem[72]),
//                 call cart.upd(), platform.endFrame(), then blit the 320x240
//                 palettised framebuffer (bytes @120) through the 256-colour
//                 palette (@77824) into the canvas.
//
//   DemoLayer.init()          -> Promise<boolean> (runtime + carts available?)
//   DemoLayer.setEnabled(on)  -> show/hide (persisted in localStorage)
//   DemoLayer.enabled()       -> currently on AND ready
//   DemoLayer.available()     -> runtime loaded?
//   DemoLayer.next()          -> cycle to the next cart
//   DemoLayer.setCart(i)      -> switch to cart index i
//   DemoLayer.carts()         -> [{name,label,effect}]
//   DemoLayer.current()       -> current cart index
//   DemoLayer.pulse(info)     -> coarse musical nudge (speed/kick), call per bar
//   DemoLayer.note(ev)        -> fine per-note reaction (clock surge / flash /
//                                hue shift), call on each note onset; ev =
//                                {role,midi,freq,vel,durSec,section}
//   DemoLayer.setOpacity(o)   -> 0..1 mix strength
//   DemoLayer.setBlend(mode)  -> mix-blend-mode string

(function (root) {
  "use strict";

  // Locate the vendored runtime relative to THIS script's URL, not the host
  // page's — so the module works whether it's included from explorer.html (repo
  // root) or the gate harness (a subdirectory). Falls back to a root-relative path.
  const BASE = (function () {
    try {
      const s = document.currentScript && document.currentScript.src;
      if (s) return s.replace(/[^/]*$/, "") + "vendor/microw8/";
    } catch (e) {}
    return "vendor/microw8/";
  })();
  const LS_KEY = "vaporwave-demo-on";
  const LS_CART = "vaporwave-demo-cart";
  const MOBILE = /Mobi|iPhone|iPad|Android/.test(navigator.userAgent) ||
                 (navigator.hardwareConcurrency || 8) <= 4;
  const FPS = MOBILE ? 24 : 32;          // cap — a background layer must stay cheap
  const FRAME_MS = 1000 / FPS;
  const DEFAULT_OPACITY = 0.55;          // present but never drowns the footage
  const DEFAULT_BLEND = "screen";        // additive glow of light-on-dark demoscene over dark VHS

  // MicroW8 memory map (bytes) — mirrored from the runtime.
  const MEM_PAGES = 4;                   // 256KB, fixed
  const REG_TIME = 16;                   // u32 index (byte 64)
  const REG_GAMEPAD = 17;                // byte 68
  const REG_FRAME = 18;                  // byte 72
  const FB_OFFSET = 120;                 // framebuffer bytes 120..76919 (320*240)
  const PAL_OFFSET = 77824;              // 256 palette entries (u32) @ 0x13000
  const FB_PIXELS = 320 * 240;           // 76800

  // Demoscene carts — all confirmed full-frame animating in this host (node +
  // headless probe, see faust/demo-layer-test.js) and public domain. Eight are
  // MicroW8's own example prods (exoticorn, Unlicense); the rest are classic
  // size-coding effects authored for this project and compiled with the MicroW8
  // `uw8` tool (also Unlicense). See SOURCES.md.
  const CARTS = [
    // -- MicroW8 example prods (exoticorn) --
    { name: "technotunnel", label: "Techno Tunnel", effect: "raymarched checker tunnel" },
    { name: "tunnel",       label: "Tunnel",        effect: "classic plasma tunnel" },
    { name: "tunnel_opt",   label: "Tunnel (opt)",  effect: "optimised plasma tunnel" },
    { name: "xorscroll",    label: "XOR Scroll",    effect: "moiré / XOR plasma field" },
    { name: "fireworks",    label: "Fireworks",     effect: "particle fireworks" },
    { name: "trainride",    label: "Train Ride",    effect: "scener landscape flythrough" },
    { name: "skipahead",    label: "Skip Ahead",    effect: "byte-battle vector scene" },
    { name: "sprites",      label: "Sprites",       effect: "bouncing sprite swarm" },
    // -- classic effects authored for this project --
    { name: "plasma",       label: "Plasma",        effect: "four-sine rainbow plasma" },
    { name: "fire",         label: "Fire",          effect: "propagating flame buffer" },
    { name: "metaballs",    label: "Metaballs",     effect: "three roaming metaballs" },
    { name: "starfield",    label: "Starfield",     effect: "3D flying starfield" },
    { name: "rasterbars",   label: "Raster Bars",   effect: "copper / raster bars" },
    { name: "moire",        label: "Moiré",         effect: "twin-source interference" },
    { name: "twister",      label: "Twister",       effect: "rotating ribbon twister" },
    { name: "ripple",       label: "Ripple",        effect: "radial water ripples" },
    { name: "rotozoom",     label: "Rotozoom",      effect: "rotating zooming texture" },
    { name: "kaleido",      label: "Kaleidoscope",  effect: "angular kaleidoscope" },
    { name: "swirl",        label: "Swirl",         effect: "logarithmic vortex" },
    { name: "radialplasma", label: "Radial Plasma", effect: "polar rainbow plasma" },
    { name: "mandel",       label: "Mandelbrot",    effect: "zooming Mandelbrot set" },
    { name: "sinescroll",   label: "Sine Field",    effect: "stacked sine wavefronts" },
    { name: "wavefield",    label: "Wave Field",    effect: "warped sine lattice" },
    { name: "colorcycle",   label: "Colour Cycle",  effect: "XOR palette color-cycling" },
    { name: "hexgrid",      label: "Hex Plasma",    effect: "layered sine grid plasma" },
    { name: "tunnelc",      label: "Colour Tunnel", effect: "polar rainbow tunnel" },
    { name: "lissajous",    label: "Lissajous",     effect: "oscilloscope curve trail" },
    { name: "spiral",       label: "Spiral",        effect: "rotating arm spiral" },
    { name: "interference", label: "Interference",  effect: "four-axis interference" },
    { name: "bump",         label: "Bump Map",      effect: "moving-light bump map" },
    { name: "starburst",    label: "Starburst",     effect: "radial ray burst" },
    { name: "floor",        label: "Checker Floor", effect: "perspective checker floor" },
  ];

  // ---- runtime state ----
  let loaderBytes = null;                // Uint8Array of loader.wasm
  let platBytes = null;                  // Uint8Array of platform.uw8 (packed)
  let runMem = null, u8 = null, u32 = null, palView = null;   // shared runtime memory views
  let env = null;                        // import object env
  let platform = null;                   // platform instance
  let cart = null;                       // current cart instance
  let cartCache = new Map();             // name -> decoded standard-wasm Uint8Array
  let cur = 0;                           // current cart index
  let ready = false, on = false;

  // ---- DOM ----
  let wrap = null, canvas = null, ctx = null, imgData = null, imgU32 = null;
  let opacity = DEFAULT_OPACITY, blend = DEFAULT_BLEND;

  // ---- clock / reactivity ----
  let rafId = 0, lastTs = 0, acc = 0;
  let virtualTime = 0;                   // ms fed to the cart's TIME register
  let speed = 1;                         // steady time multiplier
  let kick = 0;                          // decaying speed bump from pulse()/note()
  let frameCount = 0;
  // Note-reactivity levers. These are CART-AGNOSTIC: `kick` surges the shared
  // TIME clock every effect reads; `flash` and `hueShift` are applied in the
  // host blit through a per-frame adjusted 256-entry palette LUT, so they colour
  // ANY cart without touching its code. All decay in renderFrame().
  let flash = 0;                         // additive brightness (0..~1.2), lead/drums flash
  let hueShift = 0;                      // palette-index rotation (float), pitch-class colour shift
  const MAX_FLASH = 0.42;   // brightness never approaches white-out — the effect must stay VISIBLE under the pulse
  // scratch LUT reused each frame so the reactive path allocates nothing
  const adjPal = new Uint32Array(256);

  // -------------------------------------------------------------------------
  // loading / wasm host
  // -------------------------------------------------------------------------
  async function fetchBytes(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("fetch " + url + " -> " + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }

  // Decompress a packed .uw8 (platform or cart) to a standard wasm module.
  // Uses a THROWAWAY loader+memory per call: load_uw8 works in-place at offset 0
  // and uses upper memory as its window, so a fresh memory avoids any clobber
  // from a previously-instantiated module's data segments (a bug we hit doing it
  // in the shared runtime memory — the platform's segments corrupted the window).
  async function decode(bytes) {
    if (bytes[0] === 0) return bytes.slice();   // already a raw wasm module (magic \0asm)
    const mem = new WebAssembly.Memory({ initial: MEM_PAGES, maximum: MEM_PAGES });
    const view = new Uint8Array(mem.buffer);
    const loader = (await WebAssembly.instantiate(
      loaderBytes.buffer.slice(loaderBytes.byteOffset, loaderBytes.byteOffset + loaderBytes.length),
      { env: { memory: mem } })).instance;
    view.set(bytes);
    const len = loader.exports.load_uw8(bytes.length);   // decompress in place @0, returns std-wasm length
    return view.slice(0, len);
  }

  // Build env exactly as the MicroW8 runtime does (Math + reserved stubs +
  // logChar + g_reserved globals), over the shared runtime memory.
  function buildEnv(mem) {
    const e = { memory: mem };
    for (const k of ["acos", "asin", "atan", "atan2", "cos", "exp", "log", "sin", "tan", "pow"]) e[k] = Math[k];
    for (let i = 9; i < 64; i++) e["reserved" + i] = () => {};
    e.logChar = () => {};
    for (let i = 0; i < 16; i++) e["g_reserved" + i] = 0;
    return e;
  }

  async function instantiatePlatform() {
    runMem = new WebAssembly.Memory({ initial: MEM_PAGES, maximum: MEM_PAGES });
    u8 = new Uint8Array(runMem.buffer);
    u32 = new Uint32Array(runMem.buffer);
    palView = new Uint32Array(runMem.buffer, PAL_OFFSET, 256);
    env = buildEnv(runMem);
    const platWasm = await decode(platBytes);
    platform = (await WebAssembly.instantiate(platWasm.buffer.slice(platWasm.byteOffset, platWasm.byteOffset + platWasm.length), { env })).instance;
    // merge platform exports into env so carts can import cls/line/… etc.
    for (const k in platform.exports) env[k] = platform.exports[k];
  }

  async function decodeCart(name) {
    if (cartCache.has(name)) return cartCache.get(name);
    const packed = await fetchBytes(BASE + "carts/" + name + ".uw8");
    const wasm = await decode(packed);
    cartCache.set(name, wasm);
    return wasm;
  }

  async function loadCart(i) {
    if (!ready && !platform) return;
    cur = ((i % CARTS.length) + CARTS.length) % CARTS.length;
    const name = CARTS[cur].name;
    const wasm = await decodeCart(name);
    // re-instantiate the platform per cart swap: a fresh runtime memory means a
    // new cart never inherits the previous effect's framebuffer/heap garbage.
    await instantiatePlatform();
    cart = (await WebAssembly.instantiate(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.length), { env })).instance;
    virtualTime = 0; frameCount = 0; kick = 0; flash = 0; hueShift = 0;
    if (cart.exports.start) { try { cart.exports.start(); } catch (e) {} }
    try { localStorage.setItem(LS_CART, String(cur)); } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // per-frame render
  // -------------------------------------------------------------------------
  function renderFrame(dt) {
    if (!cart || !ctx) return;
    // advance the virtual clock (steady speed + decaying musical kick)
    virtualTime += dt * (speed + kick);
    kick *= 0.9; if (kick < 0.002) kick = 0;
    u32[REG_TIME] = virtualTime & 0xffffffff;
    u32[REG_GAMEPAD] = 0;
    u32[REG_FRAME] = frameCount++;
    try { if (cart.exports.upd) cart.exports.upd(); } catch (e) {}
    try { if (platform.exports.endFrame) platform.exports.endFrame(); } catch (e) {}
    // decay the note-driven colour levers
    flash *= 0.85; if (flash < 0.004) flash = 0;
    hueShift *= 0.9; if (hueShift < 0.5 && hueShift > -0.5) hueShift = 0;
    // blit palettised framebuffer -> RGBA canvas. Fast path when no note colour
    // is active; otherwise blit through a per-frame adjusted palette LUT so the
    // flash (brightness) + hueShift (index rotation) tint EVERY cart uniformly.
    const fb = u8, out = imgU32;
    let pal = palView;
    if (flash > 0.004 || hueShift >= 0.5 || hueShift <= -0.5) {
      const rot = Math.round(hueShift) & 255;
      const br = flash;                     // 0..~1.3 brightness add
      for (let i = 0; i < 256; i++) {
        const src = palView[(i + rot) & 255];
        let r = src & 255, g = (src >> 8) & 255, b = (src >> 16) & 255;
        if (br) {
          r += (255 - r) * br; g += (255 - g) * br; b += (255 - b) * br;
          if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        }
        adjPal[i] = (b << 16) | (g << 8) | r;
      }
      pal = adjPal;
    }
    for (let e = 0; e < FB_PIXELS; e++) out[e] = 0xff000000 | pal[fb[e + FB_OFFSET]];
    ctx.putImageData(imgData, 0, 0);
  }

  function loop(ts) {
    if (!on) { rafId = 0; return; }
    rafId = requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    const elapsed = ts - lastTs; lastTs = ts;
    acc += elapsed;
    if (acc < FRAME_MS) return;        // FPS cap
    const dt = Math.min(acc, 100);     // clamp long stalls (tab-switch) to avoid time jumps
    acc = 0;
    renderFrame(dt);
  }

  function startLoop() { if (!rafId && on) { lastTs = 0; acc = 0; rafId = requestAnimationFrame(loop); } }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  // -------------------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------------------
  function makeDom() {
    if (wrap) return;
    wrap = document.createElement("div");
    wrap.id = "demolayer";
    wrap.setAttribute("aria-hidden", "true");
    // z-index:-1 matches VideoLayer's plane (behind the star-map UI). Appended
    // (not prepended) to body so among the two z-index:-1 layers this one paints
    // ON TOP of the prepended video — which is exactly what lets its
    // mix-blend-mode blend the demo THROUGH the footage.
    wrap.style.cssText = "position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none";
    canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;" +
      "image-rendering:pixelated;image-rendering:crisp-edges;" +
      "mix-blend-mode:" + blend + ";opacity:" + opacity + ";will-change:contents";
    ctx = canvas.getContext("2d", { alpha: true });
    imgData = ctx.createImageData(320, 240);
    imgU32 = new Uint32Array(imgData.data.buffer);
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else if (on) startLoop();
    });
  }

  // -------------------------------------------------------------------------
  // public API
  // -------------------------------------------------------------------------
  function setEnabled(want) {
    on = !!want;
    try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch (e) {}
    if (!wrap) return;
    wrap.style.display = on ? "block" : "none";
    if (on) startLoop(); else stopLoop();
  }

  async function init() {
    if (ready) return true;
    try {
      loaderBytes = await fetchBytes(BASE + "loader.wasm");
      platBytes = await fetchBytes(BASE + "platform.uw8");
      await instantiatePlatform();
      // restore last cart choice
      let savedCart = 0; try { savedCart = parseInt(localStorage.getItem(LS_CART) || "0", 10) || 0; } catch (e) {}
      await loadCart(savedCart);
    } catch (e) {
      if (root.console) console.warn("DemoLayer init failed:", e && e.message);
      return false;
    }
    makeDom();
    ready = true;
    let saved = null; try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    // DEFAULT OFF (mirrors VideoLayer): dark unless the user has turned it on.
    setEnabled(saved === "1");
    return true;
  }

  async function setCart(i) {
    if (!ready) { cur = i; return; }
    await loadCart(i);
  }
  function next() { return setCart(cur + 1); }

  // Musical nudge. Call per bar (or on section changes). `info` may carry
  // {energy:0..1} to scale the kick; anything truthy gives a default pulse.
  // We DON'T touch per-cart palette layout (fragile) — we speed the shared TIME
  // clock, which every time-driven effect reads, so the demo throbs on the beat.
  function pulse(info) {
    const energy = (info && typeof info.energy === "number") ? info.energy : 0.6;
    kick = Math.max(kick, 0.3 + energy * 0.6);   // brief speed surge, decays in renderFrame (gentle — no lurch)
  }

  // Per-NOTE reactivity. Called on every note ONSET during live playback with
  // ev = {role, midi, freq, vel, durSec, section}. Bar-level pulse() stays the
  // coarse hook; this is the fine one — many calls/second, so it must be cheap:
  // it only bumps a few scalar accumulators that decay in renderFrame(). No-op
  // when the layer is off. Levers are cart-agnostic (see renderFrame): `kick`
  // surges the shared TIME clock, `flash` brightens via the blit LUT, `hueShift`
  // rotates the palette by pitch class. Different roles pull different levers.
  function note(ev) {
    if (!on || !ready || !ev) return;
    const vel = (typeof ev.vel === "number") ? (ev.vel < 0 ? 0 : ev.vel > 1 ? 1 : ev.vel) : 0.8;
    const role = ev.role || "";
    const pc = (((ev.midi | 0) % 12) + 12) % 12;     // pitch class 0..11
    // pitch-class colour: low notes barely rotate, high notes rotate more
    const hue = (pc - 5.5) * (2 + vel * 4);
    // NOTE reaction is a SUBTLE pulse, not a strobe (Paul: "flashing way too much…
    // impossible to see the visualizations"). Small flash adds + a low ceiling keep
    // the underlying effect visible; the movement reads as a breath, not a flicker.
    if (role === "bass") {
      // slow low-frequency swell of the whole effect (mostly clock, little flash)
      kick = Math.max(kick, 0.3 + vel * 0.6);
      flash = Math.min(MAX_FLASH, flash + 0.015 + vel * 0.04);
    } else if (role === "drums" || role === "break" || role === "chops") {
      // sharp but small kick jolt + a faint brightness tick
      kick = Math.max(kick, 0.3 + vel * 0.4);
      flash = Math.min(MAX_FLASH, flash + 0.05 + vel * 0.08);
    } else if (role === "lead") {
      // gentle brightness + pitch-class hue drift
      flash = Math.min(MAX_FLASH, flash + 0.05 + vel * 0.08);
      hueShift += hue * 0.5;
      kick = Math.max(kick, 0.15 + vel * 0.3);
    } else if (role === "pad") {
      // soft glow + slow hue drift
      flash = Math.min(MAX_FLASH, flash + 0.025 + vel * 0.04);
      hueShift += hue * 0.35;
    } else {
      // bed / sample / narration / unknown — modest all-round nudge
      flash = Math.min(MAX_FLASH, flash + 0.025 + vel * 0.05);
      hueShift += hue * 0.4;
      kick = Math.max(kick, 0.15 + vel * 0.4);
    }
    if (hueShift > 255) hueShift = 255; else if (hueShift < -255) hueShift = -255;
  }

  function setOpacity(o) {
    opacity = Math.max(0, Math.min(1, +o));
    if (canvas) canvas.style.opacity = String(opacity);
  }
  function setBlend(mode) {
    blend = String(mode || DEFAULT_BLEND);
    if (canvas) canvas.style.mixBlendMode = blend;
  }

  root.DemoLayer = {
    init, setEnabled, next, setCart, pulse, note, setOpacity, setBlend,
    enabled: () => on && ready,
    available: () => ready,
    carts: () => CARTS.map(c => ({ name: c.name, label: c.label, effect: c.effect })),
    current: () => cur,
    currentName: () => CARTS[cur] && CARTS[cur].name,
    // gate/debug hooks
    _canvas: () => canvas,
    _running: () => !!rafId,
    // Dense frame fingerprint (samples every 4th RGBA byte = every pixel's red),
    // so even sparse effects (starfield, twister) and small note-driven colour
    // shifts register a hash change. Cheap enough for gate/debug use.
    _frameHash: () => {
      if (!ctx) return 0;
      const d = ctx.getImageData(0, 0, 320, 240).data; let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i]) | 0;
      return h;
    },
  };
})(window);

// faust/press/browser-env.js — the BROWSER half of press.js's environment.
//
// render-core.js and stream-renderer.js take everything environment-specific
// through `env`: mkProc, rootOf, SR, BS, dx7Presets. press.js supplies those
// from node — fs.readFileSync over dist/, WebAssembly.compile, a JSON file off
// disk — which is why press.js cannot be imported in a page: its very first
// lines require fs and child_process. This file is the same four answers given
// the way a browser can give them (fetch + faustwasm's own loadDSPFactory), so
// a page that wants the offline render walk imports THIS and then drives the
// parent's render-core/stream-renderer unchanged.
//
// It is not a second renderer and it holds no audio: it hands back processors.
// The recipe is the one live/stream-worker.js has been running in a Worker
// since the stream landed (initDeps) — lifted here so the next caller does not
// copy it a third time. stream-worker predates this file and still carries its
// own copy; adopting this one is a mechanical change on a path with its own
// gates, so it is left for whoever next touches that file.
//
// UMD like every other engine/faust module: `require()` in node (harmless — the
// browser APIs are only touched inside the returned closures), `FaustBrowserEnv`
// on the global when a page or a Worker imports it.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustBrowserEnv = factory();
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function () {
  "use strict";

  const SR = 44100, BS = 64;

  // makeBrowserEnv({ base }) -> Promise of { mkProc, rootOf, dx7Presets, SR, BS }
  //
  //   base — the engine/faust/ directory as an absolute URL (trailing slash).
  //          Everything below hangs off it: dist/<mod>-module.wasm + -meta.json,
  //          data/dx7-presets.json, node_modules/@grame/faustwasm.
  //
  // The factory cache is per-env and keyed on the module name, so a page that
  // opens many renders compiles each dsp once. Presets are fetched once and
  // degrade to {} — a missing cartridge bank leaves dx7 voices on their patch
  // defaults, which is audible and not fatal.
  async function makeBrowserEnv(opts) {
    const base = (opts && opts.base) || new URL("../", document.baseURI).href;
    const fw = await import(base + "node_modules/@grame/faustwasm/dist/esm/index.js");
    const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
    const gen = new FaustMonoDspGenerator();
    const pending = {};     // module -> Promise<factory>
    const resolved = {};    // module -> factory (rootOf reads its meta json)
    const factory = (mod) => pending[mod] || (pending[mod] =
      FaustWasmInstantiator.loadDSPFactory(base + "dist/" + mod + "-module.wasm",
                                           base + "dist/" + mod + "-meta.json")
        .then((f) => {
          if (!f) throw new Error("no faust factory for " + mod);
          resolved[mod] = f;
          return f;
        }));
    const mkProc = async (mod) => gen.createOfflineProcessor(SR, BS, await factory(mod));
    // PARAM ROOT off the UI tree, never the declared name — render-core.paramRoot
    // and its long note on why: dx7.lib wraps its interface in an hgroup called
    // "DX7", so every dx7_algN module answers to /DX7/... and a module-named path
    // is silently dropped (the pure-FM drone).
    const RC = (typeof self !== "undefined" && self.FaustRenderCore) ||
               (typeof window !== "undefined" && window.FaustRenderCore) || null;
    if (!RC) throw new Error("browser-env: load faust/press/render-core.js first (paramRoot)");
    const rootOf = (mod) => RC.paramRoot(resolved[mod].json);

    let dx7Presets = {};
    try { dx7Presets = await (await fetch(base + "data/dx7-presets.json")).json(); } catch (e) { dx7Presets = {}; }

    return { mkProc, rootOf, dx7Presets, SR, BS };
  }

  return { makeBrowserEnv, SR, BS };
});

// video-layer.js — LIVE laserdisc background, streamed straight from archive.org.
//
// New direction (2026-07): clips STREAM from the Internet Archive — no pre-bake.
//   <video src="https://archive.org/download/<item>/<file>#t=<in>"> plays a cue
//   window (found/video/stream-catalog.json = committed source); the browser does
//   the grading with CSS + SVG filters on top. The local found/video/*.mp4 clips
//   are now an OPTIONAL cache + the slow-network / archive-blocked FALLBACK tier.
//
// Streaming plays cross-origin WITHOUT `crossorigin` (like an <img>): archive's
// /download 302 carries `access-control-allow-origin:*` but the CDN node it
// redirects to does NOT — so a `crossorigin=anonymous` video (needed to sample
// into WebGL) would taint/fail. Hence effects are CSS + SVG-filter only
// (compositor-level, no pixel readback, no CORS, cheap on the audio thread).
//
// Two stacked <video> elements: the front plays; the back PRELOADS the next clip
// while it does. We crossfade only once the back is genuinely ready (readyState
// >= HAVE_FUTURE_DATA) — if the next stream isn't ready at switch time we HOLD
// the current clip (never black). A slow/failed remote falls back to the local
// cache clip when present. Clip advance is driven by the bar clock (explorer
// calls showFile every 8 measures); effects are keyed off the playing genre.
//
//   VideoLayer.init()            -> Promise<boolean> (any clips available?)
//   VideoLayer.setEnabled(on)    -> show/hide (persisted in localStorage)
//   VideoLayer.enabled()         -> current state
//   VideoLayer.available()       -> layer loaded?
//   VideoLayer.showFile(file)    -> stream/crossfade to clip "<name>.mp4"
//   VideoLayer.setGenre(genre)   -> ease the effect stack to a genre look
//   VideoLayer.idle()            -> resume slow ambient cycling
//   VideoLayer.makeBag()         -> shared no-repeat shuffle bag (explorer pools)
//   VideoLayer.credits()         -> [{file,credit}] for attribution UI

(function (root) {
  "use strict";

  const MOBILE = /Mobi|iPhone|iPad|Android/.test(navigator.userAgent) ||
                 (navigator.hardwareConcurrency || 8) <= 4;
  const FADE_MS = MOBILE ? 0 : 1600;   // phones: hard cuts — a second decoder + crossfade janks touch
  const IDLE_CYCLE_MS = 24000;   // ambient switch period when nothing is playing
  const RATE = 0.5;              // slowed playback — dreamier, more VHS
  const LS_KEY = "vaporwave-video-on";
  const REMOTE_READY_MS = 3800;  // archive.org latency budget before we fall back to the local cache clip
  // A PREFETCH (loading the next clip while the current one still has ~8 bars
  // to play) gives remote most of the window — capping it at REMOTE_READY_MS
  // meant a slow-but-reachable stream could never win, only fail earlier
  // (2026-07-06 re-verification finding). If the show arrives while remote is
  // still loading, loadBack's wantShow upgrade expedites to local in 800ms.
  const PREFETCH_REMOTE_MS = 12000;
  const LOCAL_READY_MS = 1200;   // local file should be near-instant
  // analog grain via an SVG turbulence tile, jittered by steps() animation
  const NOISE_URI = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"220\" height=\"220\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\"/></filter><rect width=\"220\" height=\"220\" filter=\"url(%23n)\" opacity=\"0.55\"/></svg>')";

  let catalog = new Map();       // name -> {name,item,file,in,out,tags,credit,local}
  let tagIndex = new Map();      // genre tag -> [clip names] (from catalog tags)
  let names = [];                // playable clip names (idle bag domain)
  let base = "https://archive.org/download";
  let localAvail = new Set();    // clip names that have a local cache file (found/video/<name>.mp4)
  let online = true;

  let wrap = null, vbox = null, tear = null, vids = [], front = 0;
  let osd = null, osdTimer = 0, glitchTimer = 0, idleTimer = 0, on = true, ready = false;
  let grain = null, dispEl = null, roEl = null, gbEl = null;   // SVG glitch knobs
  let curName = null, seq = 0, curGenre = "", profile = null;
  let catBag = [];               // shuffled bag over the whole catalog (idle/ambient)
  const reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fisher-Yates. Math.random is intentional: live presentation, not a render.
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function nextCatalog() {
    if (!names.length) return null;
    if (!catBag.length) { catBag = names.slice(); shuffle(catBag); }
    let n = catBag.pop();
    if (n === curName && catBag.length) { const m = catBag.pop(); catBag.unshift(n); n = m; }
    return n;
  }

  // reusable no-repeat shuffle bag over a CALLER-SUPPLIED pool (the explorer's
  // genre-affine clip pool changes as the mix travels). Unchanged mechanism —
  // shared so the layer + explorer don't drift. reset() clears it per session.
  function makeBag() {
    let bag = [], key = null, last = null;
    return {
      reset() { bag = []; key = null; last = null; },
      draw(pool) {
        if (!pool || !pool.length) return null;
        const k = pool.join(",");
        if (k !== key) { key = k; bag = shuffle(pool.slice()); }
        if (!bag.length) bag = shuffle(pool.slice());
        if (bag.length > 1 && bag[0] === last) bag.push(bag.shift());
        const c = bag.shift(); last = c;
        return c;
      },
    };
  }

  // ---------- genre-affine effect profiles (CSS look + glitch tier) ----------
  // Five families; every genre maps to one (default vhs — the house style).
  // filter = the base grade (CSS); glitch = burst intensity 0..1; tear = base
  // ms between tape wobbles; grain = analog-grain opacity; svg = attach the
  // RGB-split displacement filter (glitch family, desktop only — the one place
  // that wants real displacement). mfilter = the cheap phone grade.
  const FAMILIES = {
    neon:   { filter: "saturate(2.05) contrast(1.34) brightness(.83) hue-rotate(-12deg) blur(.4px)",
              mfilter: "saturate(1.7) contrast(1.2)", glitch: .5, tear: 5200, grain: .10, svg: false },
    vhs:    { filter: "saturate(1.85) contrast(1.22) brightness(.9) sepia(.12) hue-rotate(-4deg) blur(.45px)",
              mfilter: "saturate(1.5) contrast(1.15)", glitch: .3, tear: 6500, grain: .13, svg: false },
    dusty:  { filter: "saturate(.72) contrast(.96) brightness(.92) sepia(.3) blur(.5px)",
              mfilter: "saturate(.8) sepia(.25)", glitch: .18, tear: 9000, grain: .2, svg: false },
    glitch: { filter: "saturate(1.75) contrast(1.46) brightness(.85) hue-rotate(4deg)",
              mfilter: "saturate(1.6) contrast(1.35)", glitch: .95, tear: 2600, grain: .16, svg: true },
    clean:  { filter: "saturate(1.22) contrast(1.08) brightness(.95)",
              mfilter: "saturate(1.15)", glitch: .08, tear: 12000, grain: .06, svg: false },
  };
  const GENRE_FAMILY = {};
  const fam = (list, f) => list.forEach(g => GENRE_FAMILY[g] = f);
  fam(["synthwave","italo","disco","dancepop","edm","trance","house","techno","psytrance",
       "electro","acidhouse","miamibass","newjack","deephouse","garage","chiptune","hogcore",
       "hi-nrg","eurobeat"], "neon");
  fam(["vaporwave","mallsoft","citypop","shibuyakei","bossanova","exotica","surfrock",
       "spacelounge","arabpop","chinawave","sovietwave","canawave","dinosynth","prelude"], "vhs");
  fam(["lofi","triphop","blues","jazz","tango","spokenword","dub","phonk","afrobeat",
       "desertblues","krautrock","coldwave","minimal","transitwave","bigbeat"], "dusty");
  fam(["idm","breakcore","industrial","industrialmetal","ebm","witchhouse","sludgemetal",
       "doomdrone","jungle","gabber","dubstep","darksynth"], "glitch");
  fam(["ambient","downtempo","neoclassical","wintersynth","newage"], "clean");
  function profileFor(g) { return FAMILIES[GENRE_FAMILY[g]] || FAMILIES.vhs; }

  function makeDom() {
    wrap = document.createElement("div");
    wrap.id = "vidlayer";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none";
    vbox = document.createElement("div");
    vbox.style.cssText = "position:absolute;inset:0;transition:filter 850ms ease,transform 850ms ease";
    for (let i = 0; i < (MOBILE ? 1 : 2); i++) {
      const v = document.createElement("video");
      v.muted = true; v.loop = false; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.playbackRate = RATE;
      v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
        "opacity:0;transition:opacity " + FADE_MS + "ms ease";
      vbox.appendChild(v); vids.push(v);
    }
    wrap.appendChild(vbox);
    // SVG defs: the RGB-split displacement glitch filter (glitch-family only).
    // feDisplacementMap wobble + red/blue channel offset; scale & dx are the
    // knobs a burst animates. At rest (scale 0, dx 0) it's near-identity.
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0";
    svg.innerHTML =
      '<filter id="vidrgb" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.0008 0.0016" numOctaves="1" seed="7" result="t"/>' +
        '<feDisplacementMap id="viddisp" in="SourceGraphic" in2="t" scale="0" xChannelSelector="R" yChannelSelector="G" result="disp"/>' +
        '<feColorMatrix in="disp" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
        '<feOffset id="vidro" in="r" dx="0" dy="0" result="ro"/>' +
        '<feColorMatrix in="disp" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>' +
        '<feOffset id="vidgb" in="gb" dx="0" dy="0" result="gbo"/>' +
        '<feBlend in="ro" in2="gbo" mode="screen"/>' +
      '</filter>';
    wrap.appendChild(svg);
    dispEl = svg.querySelector("#viddisp"); roEl = svg.querySelector("#vidro"); gbEl = svg.querySelector("#vidgb");
    // readability veil + VHS scanlines + jittering grain over the footage, under the UI
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;" +
      "background:linear-gradient(rgba(12,10,26,.44),rgba(12,10,26,.26) 30%,rgba(12,10,26,.5))";
    const scan = document.createElement("div");
    scan.style.cssText = "position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 1px,transparent 1px 3px)";
    grain = document.createElement("div");
    if (MOBILE) grain.setAttribute("hidden", "");
    grain.style.cssText = "position:absolute;inset:-220px;opacity:.12;mix-blend-mode:screen;transition:opacity .8s;" +
      "background-image:" + NOISE_URI + ";animation:vhsgrain .42s steps(2) infinite";
    tear = document.createElement("div");
    tear.style.cssText = "position:absolute;left:-2%;right:-2%;height:16px;top:40%;opacity:0;" +
      "mix-blend-mode:screen;transition:opacity .06s;" +
      "background:linear-gradient(rgba(255,255,255,.22),rgba(140,255,255,.12) 60%,transparent)";
    osd = document.createElement("div");
    osd.style.cssText = "position:absolute;top:16px;left:22px;opacity:0;transition:opacity .25s;" +
      "font:26px 'VT323',ui-monospace,Menlo,monospace;color:rgba(235,255,240,.45);" +
      "letter-spacing:.06em;text-shadow:2px 2px 0 rgba(0,0,0,.35)";
    const st = document.createElement("style");
    st.textContent = "@keyframes vhsgrain{0%{transform:translate(0,0)}25%{transform:translate(-70px,40px)}" +
      "50%{transform:translate(45px,-90px)}75%{transform:translate(-30px,-35px)}100%{transform:translate(60px,70px)}}";
    wrap.append(veil, scan, grain, tear, osd, st);
    document.body.prepend(wrap);
    profile = profileFor("");   // default look
    applyLook(true);
  }

  // ---------- effect stack ----------
  function baseFilterStr() {
    if (!profile) return "none";
    const svg = profile.svg && !MOBILE && !reduced;
    return (svg ? "url(#vidrgb) " : "") + (MOBILE ? profile.mfilter : profile.filter);
  }
  function applyLook(immediate) {
    if (!vbox) return;
    if (immediate) vbox.style.transition = "none";
    vbox.style.filter = baseFilterStr();
    vbox.style.transform = "none";
    if (grain && !MOBILE) grain.style.opacity = String(profile ? profile.grain : .12);
    if (immediate) { void vbox.offsetWidth; vbox.style.transition = "filter 850ms ease,transform 850ms ease"; }
  }
  function setGenre(g) {
    if (!g || g === curGenre) return;
    curGenre = g; profile = profileFor(g);
    applyLook(false);
    glitchLoop();   // reschedule tape wobbles at the new cadence
  }

  function flashOsd(text) {
    if (!osd) return;
    osd.textContent = text;
    osd.style.opacity = "1";
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => { osd.style.opacity = "0"; }, 1900);
  }

  // one tape wobble: color/blur glide out and back, tear band drifts. Intensity
  // scales with the genre profile; glitch-family bursts also kick the SVG
  // RGB-split displacement (idm/darksynth/breakcore tear hard; ambient barely).
  function burst() {
    if (!ready || !on || reduced || MOBILE || !vbox || !profile) return;
    const g = profile.glitch;
    const dx = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 6) * (0.5 + g);
    const dur = 900 + Math.random() * 700;
    vbox.style.transition = "filter " + (dur / 2) + "ms ease-in-out, transform " + (dur / 2) + "ms ease-in-out";
    vbox.style.filter = baseFilterStr() + " saturate(" + (1.2 + g) + ") hue-rotate(" + (((Math.random() * 50 - 25) * g) | 0) + "deg) blur(" + (0.6 + g) + "px)";
    vbox.style.transform = "translateX(" + dx + "px) scaleY(" + (1 + .02 * g) + ")";
    if (profile.svg && dispEl) {
      const scale = (10 + Math.random() * 26) * g, off = (2 + Math.random() * 5) * g;
      dispEl.setAttribute("scale", scale.toFixed(1));
      if (roEl) roEl.setAttribute("dx", (-off).toFixed(1));
      if (gbEl) gbEl.setAttribute("dx", off.toFixed(1));
    }
    const top0 = 8 + Math.random() * 70;
    tear.style.transition = "opacity " + (dur / 2.2) + "ms ease-in-out, top " + dur + "ms linear";
    tear.style.top = top0 + "%";
    tear.style.opacity = String(.4 + .6 * g);
    requestAnimationFrame(() => { tear.style.top = (top0 + 12) + "%"; });
    setTimeout(() => {
      applyLook(false); tear.style.opacity = "0";
      if (dispEl) { dispEl.setAttribute("scale", "0"); if (roEl) roEl.setAttribute("dx", "0"); if (gbEl) gbEl.setAttribute("dx", "0"); }
    }, dur / 2);
  }
  function glitchLoop() {
    clearTimeout(glitchTimer);
    if (!ready || !on || reduced) return;
    const period = (profile ? profile.tear : 6000);
    glitchTimer = setTimeout(() => { burst(); glitchLoop(); }, period + Math.random() * period * 0.9);
  }

  // ---------- clip resolution + streaming ----------
  function playable(name) {
    const e = catalog.get(name); if (!e) return false;
    return (online && e.item && e.file) || localAvail.has(name);
  }
  // ordered source candidates for a clip: remote stream first (when online),
  // local cache clip as the slow-network / failure fallback.
  function candidates(name) {
    const e = catalog.get(name); const out = [];
    if (e && online && e.item && e.file)
      out.push({ kind: "remote", url: base + "/" + encodeURIComponent(e.item) + "/" + encodeURI(e.file), in: e.in || 0, out: e.out || 0 });
    if (localAvail.has(name)) out.push({ kind: "local", url: "found/video/" + name + ".mp4" });
    return out;
  }
  function shortLabel(name) {
    const e = catalog.get(name);
    return (e && e.title) ? e.title.slice(0, 28) : name;
  }

  function clearHandlers(v) { v.oncanplay = null; v.onerror = null; v.onloadedmetadata = null; v.ontimeupdate = null; }
  // remote clips play a cue WINDOW [in,out] of a full reel: loop within it.
  function attachWindowLoop(v, cue) {
    if (!cue) { v.ontimeupdate = null; return; }
    v.ontimeupdate = () => {
      if (v.currentTime >= cue.out - 0.06 || v.currentTime < cue.in - 0.5) {
        try { v.currentTime = cue.in; } catch (e) {}
      }
    };
  }

  // The BACK element (the one not currently shown) is a preload/crossfade state
  // machine: prefetch(name) primes it while the front plays; show(name) either
  // crossfades immediately (if the back already reached that clip) or arms it to
  // crossfade the moment it does. Because the next clip buffers for a whole
  // 8-measure window before it's shown, remote archive.org streams have real time
  // to reach `canplay` — and if a stream still isn't ready (or errors) we fall
  // back to the local cache clip, and failing that HOLD the front (never black).
  let backLoad = null;       // { name, token, cands, i, cue, kind, ready, wantShow }
  let queuedPrefetch = null;  // a next-clip prefetch deferred until the pending show crossfades
  function backIndex() { return vids.length > 1 ? 1 - front : 0; }

  function loadBack(name, wantShow) {
    if (!ready || !on || !name) return;
    if (wantShow) queuedPrefetch = null;          // a real show supersedes any deferred prefetch
    if (name === curName) { if (backLoad && backLoad.name === name) backLoad = null; return; }
    if (vids.length < 2 && !wantShow) return;      // mobile: 1 element, no room to prefetch
    // there is ONE back element: don't let a prefetch clobber a show that's still
    // waiting to become ready — defer it until that show has crossfaded.
    if (!wantShow && backLoad && backLoad.wantShow && !backLoad.ready) { queuedPrefetch = name; return; }
    if (backLoad && backLoad.name === name) {       // already priming this clip
      backLoad.wantShow = backLoad.wantShow || !!wantShow;
      if (backLoad.ready && backLoad.wantShow) crossfadeBack(backLoad);
      else if (backLoad.wantShow && backLoad.expedite) backLoad.expedite();   // show wants it NOW: give remote 800ms more, then local
      return;
    }
    const cands = candidates(name);
    if (!cands.length) { console.log("[vid] no source for", name, "(holding)"); return; }
    backLoad = { name, token: ++seq, cands, i: -1, ready: false, wantShow: !!wantShow };
    nextCand(backLoad);
  }

  function nextCand(bl) {
    bl.i++;
    if (bl.token !== seq) return;
    if (bl.i >= bl.cands.length) { console.log("[vid] all sources failed for", bl.name, "(holding)"); return; }
    const c = bl.cands[bl.i];
    const v = vids[backIndex()];
    clearHandlers(v);
    bl.cue = c.kind === "remote" && c.out ? { in: c.in, out: c.out } : null;
    bl.kind = c.kind;
    let settled = false;
    v.oncanplay = () => {                          // readyState >= HAVE_FUTURE_DATA
      if (settled || bl.token !== seq) return; settled = true; clearTimeout(to);
      bl.ready = true;
      if (bl.wantShow) crossfadeBack(bl);
    };
    v.onerror = () => {
      if (settled || bl.token !== seq) return; settled = true; clearTimeout(to);
      console.log("[vid]", c.kind, "failed for", bl.name, "->", bl.i + 1 < bl.cands.length ? "fallback" : "hold");
      nextCand(bl);
    };
    // slow archive.org: after the budget, drop to the local cache clip if there
    // is one; otherwise keep waiting (canplay may still land) — never black.
    // Prefetches get the long budget (the whole point of loading ahead).
    const budget = c.kind === "remote" ? (bl.wantShow ? REMOTE_READY_MS : PREFETCH_REMOTE_MS) : LOCAL_READY_MS;
    let to = setTimeout(() => {
      if (settled) return;
      if (bl.i + 1 < bl.cands.length) { settled = true; nextCand(bl); }
    }, budget);
    bl.expedite = () => {                            // a deferred show arrived mid-prefetch
      if (settled || c.kind !== "remote" || bl.i + 1 >= bl.cands.length) return;
      clearTimeout(to);
      to = setTimeout(() => { if (!settled) { settled = true; nextCand(bl); } }, 800);
    };
    v.loop = c.kind === "local";                   // local = pre-cut -> native loop; remote loops its window
    const frag = bl.cue ? "#t=" + bl.cue.in : (c.kind === "remote" && c.in ? "#t=" + c.in : "");
    v.src = c.url + frag;
    v.playbackRate = RATE;
    try { v.load(); } catch (e) {}
    v.play().catch(() => {});                       // muted: allowed, and buffers the window ahead
  }

  function crossfadeBack(bl) {
    if (bl.token !== seq) return;
    const back = backIndex(), vNew = vids[back], vOld = vids[front];
    vNew.playbackRate = RATE;
    if (bl.cue) { if (vNew.currentTime < bl.cue.in - 0.2 || vNew.currentTime > bl.cue.out) { try { vNew.currentTime = bl.cue.in; } catch (e) {} } }
    else if (bl.kind === "local" && isFinite(vNew.duration) && vNew.duration > 6) {
      try { vNew.currentTime = Math.random() * (vNew.duration - 3); } catch (e) {}   // vary the local loop start
    }
    attachWindowLoop(vNew, bl.cue);
    vNew.play().catch(() => {});
    flashOsd("▶ " + shortLabel(bl.name));
    burst();                                        // every switch tears a little
    vNew.style.opacity = "1";
    if (vOld !== vNew) {
      vOld.style.opacity = "0";
      setTimeout(() => { try { vOld.pause(); } catch (e) {} clearHandlers(vOld); }, FADE_MS + 120);
    }
    front = back; curName = bl.name; backLoad = null;
    if (queuedPrefetch) { const q = queuedPrefetch; queuedPrefetch = null; loadBack(q, false); }   // the back element is free now
  }

  // start buffering the next clip on the back element (no crossfade yet)
  function prefetch(name) { loadBack(name, false); }
  // show now: crossfade as soon as the clip is ready (immediately if prefetched)
  function show(name) { loadBack(name, true); }

  function stopIdle() { clearTimeout(idleTimer); idleTimer = 0; }
  function idle() {
    stopIdle();
    if (!ready || !on || reduced) return;
    idleTimer = setTimeout(() => { const n = nextCatalog(); if (n) show(n); idle(); }, IDLE_CYCLE_MS);
  }

  function setEnabled(want) {
    on = !!want;
    try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch (e) {}
    if (!wrap) return;
    wrap.style.display = on ? "block" : "none";
    if (on) {
      if (!curName) { const n = nextCatalog(); if (n) show(n); }
      else vids[front].play().catch(() => {});
      idle(); glitchLoop();
    } else {
      stopIdle(); clearTimeout(glitchTimer);
      backLoad = null; queuedPrefetch = null; ++seq;   // drop any in-flight preload
      vids.forEach(v => { try { v.pause(); } catch (e) {} });
    }
  }

  async function init() {
    online = navigator.onLine !== false;
    let cat = null, localList = null;
    try { const r = await fetch("found/video/stream-catalog.json", { cache: "no-cache" }); if (r.ok) cat = await r.json(); } catch (e) {}
    try { const r = await fetch("found/video/clips.json", { cache: "no-cache" }); if (r.ok) localList = await r.json(); } catch (e) {}
    localAvail = new Set((localList || []).map(c => c && c.file && c.file.replace(/\.mp4$/, "")).filter(Boolean));
    base = (cat && cat.base) || base;
    catalog = new Map();
    tagIndex = new Map();
    if (cat && Array.isArray(cat.clips)) {
      for (const e of cat.clips) if (e && e.name) {
        catalog.set(e.name, e);
        for (const t of (e.tags || [])) { if (!tagIndex.has(t)) tagIndex.set(t, []); tagIndex.get(t).push(e.name); }
      }
    }
    // no stream catalog -> synthesize a local-only catalog from clips.json (the
    // legacy/offline path: everything plays from the local cache)
    if (!catalog.size && localList) {
      for (const c of localList) { if (!c || !c.file) continue; const n = c.file.replace(/\.mp4$/, ""); catalog.set(n, { name: n, item: null, file: null, credit: c.credit, local: true, tags: [] }); }
    }
    if (!catalog.size) return false;
    names = [...catalog.keys()].filter(playable);
    // if nothing is playable (online but archive somehow unreachable AND no local
    // cache), still expose local-only names so a later retry / cache works
    if (!names.length) names = [...catalog.keys()].filter(n => localAvail.has(n));
    if (!names.length) return false;
    makeDom();
    ready = true;
    let saved = null; try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    setEnabled(saved == null ? !reduced : saved === "1");
    return true;
  }

  root.VideoLayer = {
    // catalog-tag lookup: the streaming catalog carries genre tags directly
    // (the sourced avant-garde/3D windows exist ONLY here — the kernel's
    // GENRE_CLIPS never learns them), so pool builders must union this in.
    namesForTag: (g) => (tagIndex.get(g) || []).filter(playable),
    init, setEnabled, idle, makeBag, setGenre,
    enabled: () => on && ready,
    available: () => ready,
    onSection: (idx) => { stopIdle(); const n = names[((idx % names.length) + names.length) % names.length]; if (n) show(n); },
    showFile: (file) => { stopIdle(); show(String(file).replace(/\.mp4$/, "")); },
    prefetch: (file) => { if (file) prefetch(String(file).replace(/\.mp4$/, "")); },
    credits: () => [...catalog.values()].map(e => ({ file: e.name + ".mp4", credit: e.credit })),
  };
})(window);

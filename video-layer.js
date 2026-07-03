// video-layer.js — laserdisc found-video background for the builder & player.
// Two stacked fullscreen <video> elements crossfade between curated clips
// (found/video/*.mp4 via fetch-found-video.sh + clips.json manifest).
// Switches on song-section changes while playing, and slow-cycles while idle.
// Muted + playsinline so mobile autoplay policies allow it; if the manifest is
// missing (recipe not run) the layer stays inert and the toggle hides itself.
//
//   VideoLayer.init()                -> Promise<boolean> (clips available?)
//   VideoLayer.setEnabled(on)        -> show/hide (persisted in localStorage)
//   VideoLayer.enabled()             -> current state
//   VideoLayer.onSection(idx)        -> crossfade to the clip for section idx
//   VideoLayer.idle()                -> resume slow ambient cycling
//   VideoLayer.credits()             -> [{file,credit}] for attribution UI

(function (root) {
  "use strict";

  const MOBILE = /Mobi|iPhone|iPad|Android/.test(navigator.userAgent) ||
                 (navigator.hardwareConcurrency || 8) <= 4;
  const FADE_MS = MOBILE ? 0 : 1600;   // phones: hard cuts — a second decoder + crossfade janks touch
  const IDLE_CYCLE_MS = 24000;   // ambient switch period when nothing is playing
  const RATE = 0.5;              // slowed playback — dreamier, more VHS
  const LS_KEY = "vaporwave-video-on";
  // analog grain via an SVG turbulence tile, jittered by steps() animation
  const NOISE_URI = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"220\" height=\"220\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\"/></filter><rect width=\"220\" height=\"220\" filter=\"url(%23n)\" opacity=\"0.55\"/></svg>')";

  let clips = [], wrap = null, vbox = null, tear = null, vids = [], front = 0, cur = -1;
  let osd = null, osdTimer = 0, glitchTimer = 0, idleTimer = 0, on = true, ready = false;
  const reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeDom() {
    wrap = document.createElement("div");
    wrap.id = "vidlayer";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none";
    // videos live in their own box so glitch bursts can shove/recolor them
    // without touching the veil/scanlines/OSD above
    vbox = document.createElement("div");
    vbox.style.cssText = "position:absolute;inset:0";
    for (let i = 0; i < (MOBILE ? 1 : 2); i++) {
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.playbackRate = RATE;
      v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
        "opacity:0;transition:opacity " + FADE_MS + "ms ease;" +
        (MOBILE ? "filter:saturate(1.4) contrast(1.15)"           // cheap grade — no blur on phone GPUs
                : "filter:saturate(1.9) contrast(1.28) brightness(.85) hue-rotate(-6deg) blur(.4px)");
      vbox.appendChild(v); vids.push(v);
    }
    wrap.appendChild(vbox);
    // readability veil + VHS scanlines + jittering grain over the footage, under the UI
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;" +
      "background:linear-gradient(rgba(12,10,26,.44),rgba(12,10,26,.26) 30%,rgba(12,10,26,.5))";
    const scan = document.createElement("div");
    scan.style.cssText = "position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 1px,transparent 1px 3px)";
    const grain = document.createElement("div");
    if (MOBILE) grain.setAttribute("hidden", "");
    grain.style.cssText = "position:absolute;inset:-220px;opacity:.1;mix-blend-mode:screen;" +
      "background-image:" + NOISE_URI + ";animation:vhsgrain .42s steps(2) infinite";
    // horizontal tracking-tear band, flashed during glitch bursts
    tear = document.createElement("div");
    tear.style.cssText = "position:absolute;left:-2%;right:-2%;height:16px;top:40%;opacity:0;" +
      "mix-blend-mode:screen;transition:opacity .06s;" +
      "background:linear-gradient(rgba(255,255,255,.22),rgba(140,255,255,.12) 60%,transparent)";
    // VCR on-screen display — flashes on clip switches
    osd = document.createElement("div");
    osd.style.cssText = "position:absolute;top:16px;left:22px;opacity:0;transition:opacity .25s;" +
      "font:26px 'VT323',ui-monospace,Menlo,monospace;color:rgba(235,255,240,.45);" +
      "letter-spacing:.06em;text-shadow:2px 2px 0 rgba(0,0,0,.35)";
    const st = document.createElement("style");
    st.textContent = "@keyframes vhsgrain{0%{transform:translate(0,0)}25%{transform:translate(-70px,40px)}" +
      "50%{transform:translate(45px,-90px)}75%{transform:translate(-30px,-35px)}100%{transform:translate(60px,70px)}}";
    wrap.append(veil, scan, grain, tear, osd, st);
    document.body.prepend(wrap);
  }

  function flashOsd(text) {
    if (!osd) return;
    osd.textContent = text;
    osd.style.opacity = "1";
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => { osd.style.opacity = "0"; }, 1900);
  }

  // one ~1-1.7s glitch smear: color/blur glide out and back, tear band drifts —
  // a slow tape wobble, not a snap
  function burst() {
    if (!ready || !on || reduced || MOBILE || !vbox) return;
    const dx = (Math.random() < .5 ? -1 : 1) * (4 + Math.random() * 7);
    const dur = 1000 + Math.random() * 700;
    vbox.style.transition = "filter " + (dur / 2) + "ms ease-in-out, transform " + (dur / 2) + "ms ease-in-out";
    vbox.style.filter = "saturate(2.4) contrast(1.4) hue-rotate(" + ((Math.random() * 50 - 25) | 0) + "deg) blur(1.3px)";
    vbox.style.transform = "translateX(" + dx + "px) scaleY(1.025)";
    const top0 = 8 + Math.random() * 70;
    tear.style.transition = "opacity " + (dur / 2.2) + "ms ease-in-out, top " + dur + "ms linear";
    tear.style.top = top0 + "%";
    tear.style.opacity = "1";
    requestAnimationFrame(() => { tear.style.top = (top0 + 12) + "%"; });   // slow roll downward
    setTimeout(() => {
      vbox.style.filter = "none"; vbox.style.transform = "none"; tear.style.opacity = "0";
    }, dur / 2);
  }
  function glitchLoop() {
    clearTimeout(glitchTimer);
    if (!ready || !on || reduced) return;
    glitchTimer = setTimeout(() => { burst(); glitchLoop(); }, 3500 + Math.random() * 4500);
  }

  function clipUrl(i) { return "found/video/" + clips[i].file; }

  // crossfade the hidden element to clip i (no-op if it's already showing)
  function show(i) {
    if (!ready || !on || !clips.length) return;
    i = ((i % clips.length) + clips.length) % clips.length;
    if (i === cur) return;
    cur = i;
    const back = vids.length > 1 ? 1 - front : 0, vNew = vids[back], vOld = vids[front];
    vNew.src = clipUrl(i);
    vNew.currentTime = 0;
    const go = () => {
      vNew.playbackRate = RATE;     // re-assert: resets when src changes
      vNew.play().catch(() => {});
      flashOsd("▶ PLAY");
      burst();                       // every switch tears a little
      vNew.style.opacity = "1";
      if (vOld !== vNew) { vOld.style.opacity = "0";
        setTimeout(() => { try { vOld.pause(); } catch (e) {} }, FADE_MS + 100); }
      front = back;
    };
    // wait for enough data so the fade lands on moving picture, not black
    if (vNew.readyState >= 2) go();
    else { vNew.oncanplay = () => { vNew.oncanplay = null; go(); }; vNew.load(); }
  }

  function stopIdle() { clearTimeout(idleTimer); idleTimer = 0; }
  function idle() {
    stopIdle();
    if (!ready || !on || reduced) return;
    idleTimer = setTimeout(() => { show(cur + 1); idle(); }, IDLE_CYCLE_MS);
  }

  function setEnabled(want) {
    on = !!want;
    try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch (e) {}
    if (!wrap) return;
    wrap.style.display = on ? "block" : "none";
    if (on) { if (cur < 0) show(0); else vids[front].play().catch(() => {}); idle(); glitchLoop(); }
    else { stopIdle(); clearTimeout(glitchTimer); vids.forEach(v => { try { v.pause(); } catch (e) {} }); }
  }

  async function init() {
    try {
      const r = await fetch("found/video/clips.json", { cache: "no-cache" });
      if (!r.ok) return false;
      clips = (await r.json()).filter(c => c && c.file);
    } catch (e) { return false; }
    if (!clips.length) return false;
    makeDom();
    ready = true;
    let saved = null; try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    setEnabled(saved == null ? !reduced : saved === "1");
    return true;
  }

  root.VideoLayer = {
    init, setEnabled, idle,
    enabled: () => on && ready,
    available: () => ready,
    onSection: (idx) => { stopIdle(); show(idx); },
    // crossfade to a specific clip by filename (genre-affine pools: the
    // explorer picks from GenreKernel.GENRE_CLIPS for the current mix)
    showFile: (file) => { const i = clips.findIndex(c => c.file === file); if (i >= 0) { stopIdle(); show(i); } },
    credits: () => clips.slice(),
  };
})(window);

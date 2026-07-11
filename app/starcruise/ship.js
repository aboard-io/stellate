// ship.js — the STAR-CRUISE transit set: the PILOT'S COCKPIT interior + the
// PLANET you're leaving/approaching + the genre DISPLAY on the console screen.
//
// When you DEPART a planet the controller lifts you off, fades the sky to space,
// and cuts to this cockpit: you sit at the console looking OUT the viewport at the
// planet receding below and the stars, with a big lit screen showing the GENRE MAP
// (names pulled from window.GenreKernel.GENRES / the travel weights, the target
// genre highlighted). On approach the next planet grows below and we descend.
//
// CONTRACT (both builders are asset-free, procedural, low-poly, PS1-flat):
//   makeCockpit(THREE, opts) -> { group, update(dt), setGenres(names, active) , screen }
//     The group is placed by the controller at the SPACE ANCHOR; the camera sits at
//     the group origin looking out -Z (three's forward) through the viewport, so the
//     frame + console read as the interior around the pilot. opts = { genres, active }.
//   makePlanet(THREE, traits, seed) -> { group, update(dt), setPalette(traits), body }
//     A unit-radius sphere (scaled/positioned by the controller from spaceProgress)
//     coloured from the genre palette; a thin ring on some seeds. Slowly spins.
//
// DETERMINISM: no Math.random — ring presence keys off the seed. The screen redraw
// is a pure function of (names, active).
//
// RENDER STYLE: the PLANET and the cockpit shell shade in the genre's visual
// LANGUAGE (traits.renderStyle.material — the same 'flat'|'cel'|'iridescent'|
// 'wireframe'|'glitch'|'matte' vocab the aliens + city use), so the whole world of a
// genre renders alike. The planet is the highlight: a banded gas-giant whose surface
// then renders cel-shaded / oil-iridescent / wire / glitched per genre. The screen +
// indicator dots stay UNLIT (always readable). Defaults to 'flat' when unsupplied.

// mulberry32 — tiny seeded PRNG (deterministic band layout; no Math.random).
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const IRID_GLSL = [
  "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
  "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
  "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.85);",
].join("\n");
const GLITCH_VERT = [
  "float _burst = step(0.86, fract(uTime * 0.7));",
  "transformed.x += sin(uTime * 13.0 + transformed.y * 20.0 + transformed.x * 7.0) * (0.01 + 0.05 * _burst);",
  "transformed.z += cos(uTime * 17.0 + transformed.y * 14.0) * (0.008 + 0.03 * _burst);",
].join("\n");
const GLITCH_FRAG = [
  "float _fl = step(0.8, fract(uTime * 0.7 + 0.3));",
  "outgoingLight.r += 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 40.0));",
  "outgoingLight.b -= 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 37.0));",
].join("\n");

// makeStyleKit — the shared surface factory. surface(o) builds ONE lit material in
// the active style (cel -> banded MeshToon; else Lambert + fresnel/glitch hook);
// tick(clock) drives the glitch uniform. Reused across the planet + cockpit shell.
function makeStyleKit(THREE, style) {
  const wire = style === "wireframe";
  const smooth = style === "matte";
  const glitchTime = { value: 0 };
  let celGrad = null;
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  function apply(m) {
    if (style === "iridescent") {
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>", IRID_GLSL + "\n#include <opaque_fragment>");
      };
      m.customProgramCacheKey = () => "sc_irid";
    } else if (style === "glitch") {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = glitchTime;
        shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace(
          "#include <begin_vertex>", "#include <begin_vertex>\n" + GLITCH_VERT);
        shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader.replace(
          "#include <opaque_fragment>", GLITCH_FRAG + "\n#include <opaque_fragment>");
      };
      m.customProgramCacheKey = () => "sc_glitch";
    }
    return m;
  }
  function surface(o) {
    const flat = o.flatShading !== false && !smooth;
    const emissive = o.emissive || new THREE.Color(0, 0, 0);
    let m;
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: o.color, emissive, gradientMap: celGrad, vertexColors: !!o.vertexColors });
      m.flatShading = true;
    } else {
      m = new THREE.MeshLambertMaterial({ color: o.color, emissive, vertexColors: !!o.vertexColors, flatShading: flat, wireframe: wire });
      if (smooth && o.color && o.color.clone) m.emissive = emissive.clone().add(o.color.clone().multiplyScalar(0.08));
    }
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    return apply(m);
  }
  return { surface, apply, tick: (c) => { glitchTime.value = c; }, wire, smooth };
}

// ---- COCKPIT INTERIOR -----------------------------------------------------------
export function makeCockpit(THREE, opts = {}) {
  const group = new THREE.Object3D();
  group.name = "cockpit";

  // The console ECHOES the genre's surface language (opts.renderStyle.material) so the
  // cockpit shares the planet's look — a wire cockpit over a wire planet, an iridescent
  // one that shimmers, a glitch one that jitters. Defaults to 'flat' (the original
  // flat-lit shell) so today's look is unchanged. Screen + dots stay UNLIT + readable.
  const kit = makeStyleKit(THREE, (opts.renderStyle && opts.renderStyle.material) || "flat");
  const shell = kit.surface({ color: new THREE.Color(0x140d20), flatShading: true });
  const trim = kit.surface({ color: new THREE.Color(0x33244a), emissive: new THREE.Color(0x140a24), flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: 0x66e0ff });   // unlit indicator dots

  // -- viewport frame: bars around a window at z = FZ. The camera looks out -Z, so
  // these sit just in front of the pilot and frame the planet/stars beyond.
  const FZ = -1.55, W = 3.0, H = 1.9, T = 0.22;
  const bar = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || trim);
    m.position.set(x, y, z); group.add(m); return m;
  };
  bar(W + T * 2, T, 0.3, 0, H / 2, FZ);          // top rail
  bar(T, H, 0.3, -W / 2, H * 0.12, FZ);          // left pillar
  bar(T, H, 0.3, W / 2, H * 0.12, FZ);           // right pillar
  // canopy struts (two diagonals across the top corners for a cockpit read).
  const strutGeo = new THREE.BoxGeometry(0.12, 0.12, 1.6);
  const sl = new THREE.Mesh(strutGeo, trim); sl.position.set(-W / 2 + 0.3, H / 2 - 0.25, FZ + 0.7); sl.rotation.z = 0.5; group.add(sl);
  const sr = new THREE.Mesh(strutGeo, trim); sr.position.set(W / 2 - 0.3, H / 2 - 0.25, FZ + 0.7); sr.rotation.z = -0.5; group.add(sr);

  // -- console housing below the sightline (the dashboard the screen sits on).
  const housing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.4), shell);
  housing.position.set(0, -1.05, -0.55); housing.rotation.x = -0.22; group.add(housing);
  // side consoles wrapping the pilot.
  const sideGeo = new THREE.BoxGeometry(0.7, 0.9, 1.8);
  const cl = new THREE.Mesh(sideGeo, shell); cl.position.set(-1.75, -0.6, -0.2); cl.rotation.y = 0.35; group.add(cl);
  const cr = new THREE.Mesh(sideGeo, shell); cr.position.set(1.75, -0.6, -0.2); cr.rotation.y = -0.35; group.add(cr);
  // blinking console indicator dots.
  const dots = [];
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), glow.clone());
    d.position.set(-0.9 + i * 0.36, -0.62, 0.05); d.rotation.x = -0.22; group.add(d); dots.push(d);
  }

  // -- the big GENRE DISPLAY screen on the console, tilted up toward the pilot.
  const cv = (typeof document !== "undefined") ? document.createElement("canvas") : null;
  let tex = null, screenMat;
  if (cv) {
    cv.width = 512; cv.height = 288;
    tex = new THREE.CanvasTexture(cv);
    screenMat = new THREE.MeshBasicMaterial({ map: tex });   // unlit -> always readable
  } else {
    screenMat = new THREE.MeshBasicMaterial({ color: 0x0a1430 });
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.46), screenMat);
  screen.position.set(0, -0.62, -0.02); screen.rotation.x = -0.72; group.add(screen);

  function drawGenres(names, active) {
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W2 = cv.width, H2 = cv.height;
    // panel background + border glow.
    ctx.fillStyle = "#070312"; ctx.fillRect(0, 0, W2, H2);
    const grd = ctx.createLinearGradient(0, 0, 0, H2);
    grd.addColorStop(0, "#0d0a26"); grd.addColorStop(1, "#060314");
    ctx.fillStyle = grd; ctx.fillRect(6, 6, W2 - 12, H2 - 12);
    ctx.strokeStyle = "#4de0ff"; ctx.lineWidth = 3; ctx.strokeRect(6, 6, W2 - 12, H2 - 12);
    // title.
    ctx.fillStyle = "#8ff0ff"; ctx.font = "bold 26px monospace";
    ctx.fillText("◈ GENRE MAP", 22, 40);
    ctx.fillStyle = "#5a7"; ctx.font = "13px monospace";
    ctx.fillText("NAV → " + String(active || "?").toUpperCase(), 22, 62);
    // genre list, two columns, active highlighted.
    const list = (names && names.length ? names : ["vaporwave"]).slice(0, 16);
    ctx.font = "16px monospace";
    const colX = [26, 270], rowY0 = 92, rowH = 24, perCol = 8;
    list.forEach((nm, i) => {
      const col = i < perCol ? 0 : 1, row = i % perCol;
      const x = colX[col], y = rowY0 + row * rowH;
      const on = active && String(nm).toLowerCase() === String(active).toLowerCase();
      if (on) {
        ctx.fillStyle = "#4de0ff"; ctx.fillRect(x - 6, y - 15, 232, 21);
        ctx.fillStyle = "#04121a";
      } else {
        ctx.fillStyle = "#7de";
      }
      const label = String(nm).slice(0, 20);
      ctx.fillText((on ? "▸ " : "  ") + label, x, y);
    });
    if (tex) tex.needsUpdate = true;
  }
  drawGenres(opts.genres, opts.active);

  let t = 0;
  function update(dt) {
    t += dt || 0;
    kit.tick(t);   // drives the 'glitch' style's shell jitter (uniform only)
    // console dots blink in a deterministic marquee.
    for (let i = 0; i < dots.length; i++) {
      const on = (Math.floor(t * 3) + i) % 3 === 0;
      dots[i].material.color.setHex(on ? 0x66e0ff : 0x123040);
    }
  }

  return {
    group, update, screen,
    setGenres: (names, active) => drawGenres(names, active),
  };
}

// ---- PLANET (unit sphere; controller scales + positions it from spaceProgress) --
// The planet is the render-style HIGHLIGHT: a banded gas-giant (latitude bands baked
// into vertex colours, deterministic off the seed) whose SURFACE then renders in the
// genre's material language — cel-banded, oil-iridescent, wireframe, glitched, matte
// or flat. setPalette re-tints the base colour; the bands (vertex colours) persist.
export function makePlanet(THREE, traits, seed) {
  const group = new THREE.Object3D();
  group.name = "planet";
  const style = (traits && traits.renderStyle && traits.renderStyle.material) || "flat";
  const kit = makeStyleKit(THREE, style);
  const geo = bandedSphere(THREE, traits, seed);
  const col = planetColor(THREE, traits);
  const body = new THREE.Mesh(geo, kit.surface({
    color: col, emissive: col.clone().multiplyScalar(0.18), vertexColors: true, flatShading: true,
  }));
  body.name = "planet-body";
  body.castShadow = false; body.receiveShadow = false;
  group.add(body);
  // a thin equatorial ring on ~half the seeds (deterministic off the seed parity).
  let ring = null;
  if (((seed | 0) & 1) === 0) {
    const rmat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 32), rmat);
    ring.rotation.x = Math.PI / 2 - 0.4; group.add(ring);
  }
  let t = 0;
  function update(dt) { t += dt || 0; body.rotation.y += (dt || 0) * 0.12; kit.tick(t); }
  function setPalette(tr) { body.material.color.copy(planetColor(THREE, tr)); }
  return { group, update, body, setPalette };
}

// a unit sphere with 4..7 latitude bands baked into vertex colours (gas-giant look).
// Deterministic: band count + hues key off (seed, palette) via mulberry32, no random.
function bandedSphere(THREE, traits, seed) {
  const geo = new THREE.SphereGeometry(1, 20, 14).toNonIndexed();
  const pos = geo.attributes.position, n = pos.count;
  const colors = new Float32Array(n * 3);
  const pal = (traits && traits.palette) || {};
  const sk = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  const ac = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const rnd = rng32((((seed | 0) || 1) ^ 0x51ced) >>> 0);
  const nBands = 4 + Math.floor(rnd() * 4);   // 4..7 bands
  const bands = [];
  for (let i = 0; i < nBands; i++) {
    const h = (rnd() < 0.5 ? sk.h : ac.h) + (rnd() - 0.5) * 44;
    const s = 0.35 + rnd() * 0.4, l = 0.32 + rnd() * 0.32;
    bands.push(new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), Math.min(1, s), Math.min(0.75, l)));
  }
  for (let i = 0; i < n; i++) {
    const lat = pos.getY(i) * 0.5 + 0.5;                          // 0..1 pole to pole
    const c = bands[Math.min(nBands - 1, Math.floor(lat * nBands))];
    const b = i * 3; colors[b] = c.r; colors[b + 1] = c.g; colors[b + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function planetColor(THREE, traits) {
  const pal = (traits && traits.palette) || {};
  const s = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  return new THREE.Color().setHSL(((s.h % 360) / 360), Math.min(1, (s.s || 0.5) + 0.15), Math.min(0.62, (s.l || 0.5) + 0.05));
}

export default { makeCockpit, makePlanet };

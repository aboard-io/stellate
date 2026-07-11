// postfx.js — the PS1 look. Renders the scene into a LOW-RES target, upscales it
// NEAREST to the display canvas with ordered dithering + 15-bit-ish colour
// quantisation, and provides a vertex-snapping material helper (the classic PS1
// vertex wobble + optional affine / perspective-incorrect texture mapping).
//
// CONTRACT
//   makePS1(THREE, renderer, lowResTarget)
//     -> { render(scene,camera), setSize(w,h), vertexSnapMaterial(base) }
//   lowResTarget = a THREE.WebGLRenderTarget (NEAREST filtered) the scene renders
//   into; the render()'s second pass upscales it nearest to the display canvas.
//
// Shaders are kept tiny: one vertex-snap injection (via onBeforeCompile, so the
// base material keeps its lighting/colour) and one full-screen dither pass.

export function makePS1(THREE, renderer, lowResTarget) {
  // --- snap grid: snapping post-projection NDC.xy to the low-res PIXEL grid is
  // what causes the PS1 vertex wobble. NDC spans -1..1 across `width` pixels, so
  // the grid density per NDC unit is width/2 (height/2 vertically).
  const gridX = Math.max(2, (lowResTarget.width || 256) * 0.5);
  const gridY = Math.max(2, (lowResTarget.height || 192) * 0.5);

  // --- full-screen pass: sample the low-res target (already NEAREST-filtered so
  // the upscale is blocky) and apply 4x4 ordered dithering + colour quantisation.
  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  // The full-screen pass is now driven by a per-genre renderStyle.post BAG (see
  // traits.js). Every effect scales by its 0..1 param so genres render in distinct
  // visual languages, yet it stays ONE fragment pass (mobile-cheap). setStyle(post)
  // below pushes a renderStyle.post into these uniforms. Defaults = a neutral clean
  // look until a genre is landed.
  const DITHER = { none: 0, ordered: 1, onebit: 2 };
  const uniforms = {
    uTex: { value: lowResTarget.texture },
    uResolution: { value: new THREE.Vector2(lowResTarget.width || 256, lowResTarget.height || 192) },
    uDither: { value: 1 },                                   // 0 none | 1 ordered | 2 onebit
    uPosterize: { value: 16.0 },                             // colour-step count 2..16
    uScan: { value: 0.0 },
    uAberr: { value: 0.0 },
    uHalftone: { value: 0.0 },
    uBloom: { value: 0.0 },
    uGrade: { value: new THREE.Vector3(1, 1, 1) },
    uVignette: { value: 0.12 },
    uCurve: { value: 0.0 },
  };
  const fsMat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D uTex;
      uniform vec2 uResolution;
      uniform int uDither;          // 0 none | 1 ordered | 2 onebit
      uniform float uPosterize;     // colour-step count (low = harsh)
      uniform float uScan;          // CRT scanline strength
      uniform float uAberr;         // chromatic aberration (RGB split)
      uniform float uHalftone;      // halftone dot strength
      uniform float uBloom;         // soft glow
      uniform vec3 uGrade;          // per-channel colour grade
      uniform float uVignette;
      uniform float uCurve;         // CRT barrel curvature
      varying vec2 vUv;
      // 4x4 Bayer ordered-dither threshold, returned in 0..1.
      float bayer4(vec2 p) {
        int x = int(mod(p.x, 4.0));
        int y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        float v = 0.0;
        if (i == 0)  v = 0.0;  else if (i == 1)  v = 8.0;  else if (i == 2)  v = 2.0;  else if (i == 3)  v = 10.0;
        else if (i == 4)  v = 12.0; else if (i == 5)  v = 4.0;  else if (i == 6)  v = 14.0; else if (i == 7)  v = 6.0;
        else if (i == 8)  v = 3.0;  else if (i == 9)  v = 11.0; else if (i == 10) v = 1.0;  else if (i == 11) v = 9.0;
        else if (i == 12) v = 15.0; else if (i == 13) v = 7.0;  else if (i == 14) v = 13.0; else               v = 5.0;
        return (v + 0.5) / 16.0;
      }
      void main() {
        // -- CRT barrel curvature: warp the sample UV outward from centre.
        vec2 uv = vUv;
        if (uCurve > 0.0) {
          vec2 cc = uv - 0.5;
          uv = uv + cc * dot(cc, cc) * uCurve * 0.35;
        }
        bool outside = (uCurve > 0.0) && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0);
        vec2 suv = clamp(uv, 0.0, 1.0);
        // -- chromatic aberration: split the R/B taps along the centre-radial dir.
        vec2 off = (suv - 0.5) * uAberr * 0.02;
        vec3 c;
        c.r = texture2D(uTex, clamp(suv + off, 0.0, 1.0)).r;
        c.g = texture2D(uTex, suv).g;
        c.b = texture2D(uTex, clamp(suv - off, 0.0, 1.0)).b;
        // -- cheap single-pass bloom: a 6-tap bright-pass blur added back additively.
        if (uBloom > 0.0) {
          vec2 px = 1.5 / uResolution;
          vec3 b = texture2D(uTex, suv + vec2(px.x, 0.0)).rgb
                 + texture2D(uTex, suv - vec2(px.x, 0.0)).rgb
                 + texture2D(uTex, suv + vec2(0.0, px.y)).rgb
                 + texture2D(uTex, suv - vec2(0.0, px.y)).rgb
                 + texture2D(uTex, suv + px).rgb
                 + texture2D(uTex, suv - px).rgb;
          b *= (1.0 / 6.0);
          float bl = max(0.0, dot(b, vec3(0.299, 0.587, 0.114)) - 0.5);
          c += b * bl * uBloom * 2.4;
        }
        // The scene renders into a LINEAR target; this raw pass gets NO output
        // encoding, so convert linear -> sRGB here (the darkness fix), then grade.
        c = clamp(c, 0.0, 1.0);
        c = pow(c, vec3(1.0 / 2.2));                 // linear -> sRGB
        c = clamp(c * uGrade, 0.0, 1.0);             // per-channel colour grade/tint
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(l), c, 1.28), 0.0, 1.0);  // punchy saturation
        // -- halftone: a dot grid that grows in the dark tones (newsprint look).
        if (uHalftone > 0.0) {
          vec2 hp = suv * uResolution / 3.0;
          float dd = length(fract(hp) - 0.5);
          float dotv = smoothstep(0.5, 0.12, dd + (0.5 - l) * 0.5);
          c = mix(c, c * (0.55 + 0.45 * dotv), uHalftone);
        }
        // -- dither + posterize in low-res texel space so it rides the crunchy pixels.
        vec2 texel = floor(suv * uResolution);
        if (uDither == 2) {
          // 1-bit: hard ordered threshold per channel (a stark, high-contrast look).
          float t = bayer4(texel);
          c = step(vec3(t), c);
        } else {
          float levels = max(2.0, uPosterize);
          float t = (uDither == 1) ? (bayer4(texel) - 0.5) : 0.0;
          c += t / levels;                            // ordered nudge before quantising
          c = floor(c * levels + 0.5) / levels;       // posterize (colour-step quantize)
        }
        // -- scanlines: darken every other display row.
        if (uScan > 0.0) {
          float s = 0.5 + 0.5 * sin(suv.y * uResolution.y * 3.14159);
          c *= 1.0 - uScan * 0.5 * (1.0 - s);
        }
        // -- vignette: fall off toward the corners.
        if (uVignette > 0.0) {
          c *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(suv - 0.5));
        }
        if (outside) c = vec3(0.0);                   // black border past the CRT curve
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }
    `,
  });
  // setStyle(post) — push a renderStyle.post bag (from traits.js) into the pass so
  // the ACTIVE planet's whole-screen render changes by genre. Missing fields fall
  // back to the neutral defaults; every value is clamped to its contract range.
  function setStyle(post) {
    if (!post) return;
    const cl = (x, lo, hi, d) => (typeof x === "number" && isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d);
    if (post.dither != null) uniforms.uDither.value = DITHER[post.dither] != null ? DITHER[post.dither] : 1;
    uniforms.uPosterize.value = cl(post.posterize, 2, 16, uniforms.uPosterize.value);
    uniforms.uScan.value = cl(post.scanlines, 0, 1, uniforms.uScan.value);
    uniforms.uAberr.value = cl(post.aberration, 0, 1, uniforms.uAberr.value);
    uniforms.uHalftone.value = cl(post.halftone, 0, 1, uniforms.uHalftone.value);
    uniforms.uBloom.value = cl(post.bloom, 0, 1, uniforms.uBloom.value);
    uniforms.uVignette.value = cl(post.vignette, 0, 1, uniforms.uVignette.value);
    uniforms.uCurve.value = cl(post.curvature, 0, 1, uniforms.uCurve.value);
    if (Array.isArray(post.grade) && post.grade.length === 3) {
      uniforms.uGrade.value.set(cl(post.grade[0], 0, 4, 1), cl(post.grade[1], 0, 4, 1), cl(post.grade[2], 0, 4, 1));
    }
  }
  // getStyle() — a plain numeric snapshot of the LIVE uniforms (headless-proof so the
  // probe can assert the active style differs by genre + updates on landing).
  function getStyle() {
    const g = uniforms.uGrade.value;
    return {
      dither: uniforms.uDither.value, posterize: uniforms.uPosterize.value,
      scanlines: uniforms.uScan.value, aberration: uniforms.uAberr.value,
      halftone: uniforms.uHalftone.value, bloom: uniforms.uBloom.value,
      vignette: uniforms.uVignette.value, curvature: uniforms.uCurve.value,
      grade: [g.x, g.y, g.z],
    };
  }
  const fsQuad = new THREE.Mesh(fsGeo, fsMat);
  fsQuad.frustumCulled = false;
  fsScene.add(fsQuad);

  function render(scene, camera) {
    // 1) scene -> low-res target (crunchy internal resolution).
    renderer.setRenderTarget(lowResTarget);
    renderer.clear();
    renderer.render(scene, camera);
    // 2) low-res target -> display canvas, nearest-upscaled + dithered.
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(fsScene, fsCam);
  }

  function setSize(w, h) {
    // sets the CANVAS backing store the blit writes into. It's driven to the same
    // near-native size as the low-res target so the final blit is ~1:1 (crisp), and
    // CSS stretches the canvas to fill the viewport.
    renderer.setSize(w, h, false);
  }

  // dispose the full-screen pass resources (called when the controller rebuilds the
  // render target on resize / DPR change so nothing leaks).
  function dispose() {
    try { fsGeo.dispose(); } catch (e) {}
    try { fsMat.dispose(); } catch (e) {}
  }

  // vertexSnapMaterial(base) -> the same material, patched so its vertices SNAP to
  // the low-res clip grid (PS1 wobble) and, when it carries a colour map, sampled
  // with AFFINE (perspective-incorrect) UVs — the classic warping texture crawl.
  // Uses onBeforeCompile so lighting/vertexColors/flatShading are all preserved.
  function vertexSnapMaterial(base) {
    const affine = !!base.map;                 // affine warp only meaningful with a texture
    const prev = base.onBeforeCompile;
    base.onBeforeCompile = function (shader, r) {
      if (prev) prev.call(this, shader, r);
      shader.uniforms.uSnapGrid = { value: new THREE.Vector2(gridX, gridY) };

      // -- vertex: snap NDC.xy to the grid, right after gl_Position is formed.
      let v = "uniform vec2 uSnapGrid;\n";
      if (affine) v += "varying vec2 vAffineUv;\nvarying float vAffineW;\n";
      v += shader.vertexShader;
      const inject = [
        "#include <project_vertex>",
        "gl_Position.xyz /= gl_Position.w;",
        "gl_Position.xy = floor(gl_Position.xy * uSnapGrid) / uSnapGrid;",
        "gl_Position.xyz *= gl_Position.w;",
        // premultiply uv by w so the fragment divide yields screen-linear (affine) uv.
        affine ? "vAffineUv = vMapUv * gl_Position.w;\nvAffineW = gl_Position.w;" : "",
      ].join("\n");
      shader.vertexShader = v.replace("#include <project_vertex>", inject);

      // -- fragment: sample the map with the affine (perspective-incorrect) uv.
      if (affine) {
        let f = "varying vec2 vAffineUv;\nvarying float vAffineW;\n" + shader.fragmentShader;
        f = f.replace(
          "#include <map_fragment>",
          [
            "#ifdef USE_MAP",
            "  vec4 sampledDiffuseColor = texture2D( map, vAffineUv / vAffineW );",
            "  diffuseColor *= sampledDiffuseColor;",
            "#endif",
          ].join("\n")
        );
        shader.fragmentShader = f;
      }
    };
    // distinct cache key so snapped variants don't collide with plain ones.
    base.customProgramCacheKey = function () { return "ps1snap" + (affine ? "A" : ""); };
    base.needsUpdate = true;
    return base;
  }

  return { render, setSize, vertexSnapMaterial, dispose, setStyle, getStyle };
}

export default { makePS1 };

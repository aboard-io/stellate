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
  const fsMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: lowResTarget.texture },
      uResolution: { value: new THREE.Vector2(lowResTarget.width || 256, lowResTarget.height || 192) },
      // The internal target is now near-native, so we EASE the crunch: finer colour
      // quantisation (64 levels ~6 bits vs the old 32) and a gentler dither, so the
      // higher resolution reads clean rather than heavily pixel-mashed.
      uLevels: { value: 64.0 },
    },
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
      uniform float uLevels;
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
        vec3 c = texture2D(uTex, vUv).rgb;
        // The scene renders into a LINEAR render target; this pass blits straight to
        // the canvas via a raw ShaderMaterial, so Three applies NO output encoding.
        // Writing linear values to an sRGB canvas crushes the midtones (murky/dark).
        // Convert linear -> sRGB here so the picture reads at its true brightness, and
        // give it a touch of extra saturation + lift for the punchy flat PS1 look.
        c = clamp(c, 0.0, 1.0);
        c = pow(c, vec3(1.0 / 2.2));              // linear -> sRGB (the darkness fix)
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(l), c, 1.28), 0.0, 1.0); // punchy saturation
        // dither in low-res texel space so the pattern rides the crunchy pixels.
        vec2 texel = floor(vUv * uResolution);
        float t = bayer4(texel) - 0.5;      // -0.5..0.5
        c += t / uLevels;                    // nudge before quantising
        c = floor(c * uLevels + 0.5) / uLevels;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }
    `,
  });
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

  return { render, setSize, vertexSnapMaterial, dispose };
}

export default { makePS1 };

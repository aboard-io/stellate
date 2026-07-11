// backdrop.js — Build phase. The procedural, seeded, low-poly world BEHIND the
// alien band: a CITY skyline or a FARM, chosen by traits.backdrop. Everything is
// asset-free and cheap — a handful of InstancedMeshes (few draw calls), flat /
// vertex-lit for the PS1 look; postfx adds the dither/warp.
//
// The CITY is a WILD skyline: a whole family of polyhedra — boxes, cylinders,
// cones, pyramids, triangular prisms, tetrahedra, octahedra, domes, spires,
// stepped ziggurats and tapered towers — one InstancedMesh per shape family, so
// the silhouette is varied while the draw-call count stays low. On top of it all
// sits a crowd of BLINKING beacon/window lights (a single instanced-color mesh
// whose per-light brightness is driven by seeded phases/periods in update(dt)),
// and low-poly FOLIAGE (trunks + canopies) is scattered through the scene. The
// FARM is the calm variant: varied crops (stalks, bushes, corn), silos with
// conical roofs, foliage tree-lines and a few blinking fireflies.
//
// CONTRACT
//   makeBackdrop(THREE, traits, seed) -> { group, update(dt) }
//     traits.backdrop = 'city' | 'farm' | ...   traits.palette/glow tint it.
//     seed = integer; same traits+seed -> identical layout (determinism law).

// mulberry32 — tiny seeded PRNG (same stream from the same seed).
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// integer hash for the per-cell window pattern (deterministic, no rng draw).
function ihash(x) {
  x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) | 0; x ^= x >>> 4;
  x = Math.imul(x, 0x27d4eb2d); x ^= x >>> 15; return x >>> 0;
}
function colHSL(THREE, h, s, l) {
  return new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), s < 0 ? 0 : s > 1 ? 1 : s, l < 0 ? 0 : l > 1 ? 1 : l);
}
const TAU = Math.PI * 2;

// ---- RENDER-STYLE GLSL (the shared visual LANGUAGE, same vocab as the aliens) ----
// IRIDESCENT: view-angle fresnel rim whose HUE cycles with the angle (glossy oil).
const IRID_GLSL = [
  "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
  "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
  "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.85);",
].join("\n");
// GLITCH: seeded vertex jitter (position+time, occasional bursts) + rgb-split flicker.
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

export function makeBackdrop(THREE, traits, seed) {
  seed = (seed | 0) || 1;
  traits = traits || {};
  const rand = rng32((seed ^ 0x1b8734) >>> 0);
  const kind = traits.backdrop === "farm" ? "farm" : "city";
  const glow = Math.max(0, Math.min(1, traits.glow || 0.3));
  const leafy = kind === "farm" || traits.skin === "organic";
  const acc = traits.palette && traits.palette.accent
    ? { h: traits.palette.accent.h || 40, s: traits.palette.accent.s != null ? traits.palette.accent.s : 0.85, l: traits.palette.accent.l != null ? traits.palette.accent.l : 0.6 }
    : { h: 40, s: 0.85, l: 0.6 };

  // ---- RENDER STYLE ---- the genre's surface LANGUAGE (traits.renderStyle.material).
  // The whole world — buildings, foliage, crops, silos — shades in ONE vocabulary so
  // a techno city reads glitched/wire while an ambient one reads cel/iridescent. Built
  // ONCE per style and reused across every InstancedMesh (mobile-cheap, no recompiles).
  // Defaults to 'flat' (the original flat-lit Lambert) so the world is never blank.
  const style = (traits.renderStyle && traits.renderStyle.material) || "flat";
  const wire = style === "wireframe";     // lit wire silhouette (buildings read as edges)
  const smooth = style === "matte";       // matte = soft SMOOTH shading (no low-poly facets)
  const glitchTime = { value: 0 };        // shared uniform, driven by update()'s clock
  let celGrad = null;                     // CEL: 3-band hard toon ramp (dark/mid/lit)
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  function applyStyleHook(m) {
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
  // styleMat — one lit + shadowed surface in the active style. cel -> banded MeshToon;
  // everything else -> Lambert (flat / matte-smooth / wireframe) + the fresnel/glitch
  // hook. Keeps emissive glow, vertex colours (baked windows), and light response.
  function styleMat(o) {
    const flat = o.flatShading !== false && !smooth;
    const emissive = o.emissive || new THREE.Color(0, 0, 0);
    let m;
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: o.color, emissive, gradientMap: celGrad, vertexColors: !!o.vertexColors });
      m.flatShading = true;
    } else {
      m = new THREE.MeshLambertMaterial({ color: o.color, emissive, vertexColors: !!o.vertexColors, flatShading: flat, wireframe: wire });
      if (smooth && o.color) m.emissive = emissive.clone().add(o.color.clone().multiplyScalar(0.08)); // soft ambient lift
    }
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    return applyStyleHook(m);
  }

  const group = new THREE.Object3D();
  // SHADOW law: the controller enables renderer.shadowMap + ONE key directional
  // light with a tight frustum; our job is to flag which meshes throw and catch
  // shadows so the skyline reads MODELLED, not flat. Solid forms cast; the ground
  // catches; tall buildings also catch (neighbour + self shadows add real depth).
  // Glowing light octahedra never cast (they'd punch black holes in the glow).
  function shadow(mesh, cast, receive) { mesh.castShadow = !!cast; mesh.receiveShadow = !!receive; return mesh; }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  const _c = new THREE.Color();
  const flicker = [];   // building materials the skyline breathes on update()
  const swayers = [];   // { mesh, sx, sz, px } gentle wind swayers (foliage/crops)
  let beacons = null;   // { mesh, meta[] } the blinking-light field
  let clock = 0;

  // reusable throwaway geometry -> unit-height, base at y=0 (see normGeo).
  function normGeo(geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h = bb.max.y - bb.min.y || 1;
    geo.translate(0, -bb.min.y, 0);
    geo.scale(1, 1 / h, 1);
    return geo;
  }
  // merge a list of (indexed or not) geometries' position+normal into one — a
  // hand-rolled replacement for BufferGeometryUtils (addons are off-limits).
  function mergeGeos(geos) {
    const ng = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let total = 0;
    for (const g of ng) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let o = 0;
    for (const g of ng) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return geo;
  }

  // ---- GROUND ----------------------------------------------------------
  const groundCol = kind === "farm"
    ? colHSL(THREE, 90 + rand() * 30, 0.4, 0.20)      // tilled green-brown soil
    : colHSL(THREE, 220 + rand() * 30, 0.15, 0.11);   // dark wet asphalt
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshLambertMaterial({ color: groundCol, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = "ground";
  ground.receiveShadow = true;   // the skyline throws real shadows across the floor
  group.add(ground);

  if (kind === "city") buildCity(); else buildFarm();

  // ============================ CITY ====================================
  // A WILD skyline: buildings drawn from a whole family of polyhedra, one
  // InstancedMesh per shape family (few draw calls), genre-tinted, plus a crowd
  // of blinking beacon/window lights and scattered foliage.
  function buildCity() {
    // ---- shape families. Each has a unit geometry (base at y=0, height 1) and a
    // profile that biases its footprint/height so spires are thin+tall, domes
    // squat+wide, gems short, ziggurats broad, etc.
    const fams = {
      // box towers carry BAKED WINDOW vertex colors and come in 3 hue variants,
      // so they are built specially below (not from this table).
      cyl:      { wMul: 1.0, hMul: 1.0, geo: () => normGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)) },
      cone:     { wMul: 1.15, hMul: 1.15, geo: () => normGeo(new THREE.ConeGeometry(0.5, 1, 7)) },
      pyramid:  { wMul: 1.2, hMul: 0.9, geo: () => normGeo(new THREE.ConeGeometry(0.5, 1, 4)) },
      prism:    { wMul: 1.0, hMul: 1.0, geo: () => normGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 3)) },
      tetra:    { wMul: 1.1, hMul: 0.75, geo: () => normGeo(new THREE.TetrahedronGeometry(0.62)) },
      octa:     { wMul: 1.0, hMul: 0.8, geo: () => normGeo(new THREE.OctahedronGeometry(0.58)) },
      dome:     { wMul: 1.7, hMul: 0.55, geo: () => normGeo(new THREE.SphereGeometry(0.5, 10, 6, 0, TAU, 0, Math.PI / 2)) },
      spire:    { wMul: 0.4, hMul: 1.7, geo: () => normGeo(new THREE.ConeGeometry(0.5, 1, 6)) },
      ziggurat: { wMul: 1.35, hMul: 1.0, geo: () => zigguratGeo() },
      taper:    { wMul: 1.0, hMul: 1.1, geo: () => normGeo(new THREE.CylinderGeometry(0.26, 0.5, 1, 5)) },
    };
    // weighted family draw (box handled separately, ~30% of the crowd).
    const wtable = [
      ["cyl", 0.14], ["taper", 0.11], ["spire", 0.11], ["ziggurat", 0.09],
      ["pyramid", 0.09], ["cone", 0.08], ["prism", 0.08], ["dome", 0.08],
      ["tetra", 0.06], ["octa", 0.06],
    ];
    const wsum = wtable.reduce((a, e) => a + e[1], 0);

    const TOTAL = 96;
    const boxSlots = [];               // -> baked-window towers
    const famSlots = {};               // key -> [slots]
    for (const k in fams) famSlots[k] = [];

    for (let i = 0; i < TOTAL; i++) {
      const slot = {
        x: -34 + rand() * 68,
        z: -6 - rand() * 40,
        w: 1.3 + rand() * 2.6,
        d: 1.3 + rand() * 2.6,
        h: 3 + rand() * 15,
        r: rand() * TAU,
      };
      // ~30% baked-window boxes; the rest picked from the polyhedra families.
      if (rand() < 0.30) { boxSlots.push(slot); continue; }
      let t = rand() * wsum, key = wtable[0][0];
      for (const [k, w] of wtable) { t -= w; if (t <= 0) { key = k; break; } }
      const pf = fams[key];
      slot.w *= pf.wMul; slot.d = slot.w * (0.7 + rand() * 0.6);
      slot.h *= pf.hMul;
      slot.family = key;
      famSlots[key].push(slot);
    }

    // ---- baked-window box towers (3 hue/pattern variants) --------------
    const boxVariants = 3, boxPer = Math.ceil(boxSlots.length / boxVariants);
    for (let v = 0; v < boxVariants; v++) {
      const list = boxSlots.slice(v * boxPer, (v + 1) * boxPer);
      if (!list.length) continue;
      const geo = towerGeo(v);
      const mat = buildingMat();
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.name = "buildings";
      mesh.userData.family = "box";
      shadow(mesh, true, true);
      for (let i = 0; i < list.length; i++) placeBuilding(mesh, i, list[i]);
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      flicker.push(mat);
    }

    // ---- one InstancedMesh per polyhedron family -----------------------
    for (const key in fams) {
      const list = famSlots[key];
      if (!list.length) continue;
      const geo = fams[key].geo();
      const hue = acc.h + hueJitter(key);
      const mat = buildingMat(hue);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.name = "buildings";
      mesh.userData.family = key;
      shadow(mesh, true, true);
      for (let i = 0; i < list.length; i++) placeBuilding(mesh, i, list[i]);
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      flicker.push(mat);
    }

    // ---- blinking beacon / window lights -------------------------------
    // A light field: roof beacons + facade "windows" on many buildings, plus a
    // low scatter of street lights. Each light gets a seeded blink profile.
    const lights = [];
    const allSlots = boxSlots.concat.apply(boxSlots, Object.keys(famSlots).map((k) => famSlots[k]));
    for (const b of allSlots) {
      const top = b.h;
      // a roof beacon on most tall-ish buildings.
      if (b.h > 4 && rand() < 0.85 && lights.length < 240) {
        lights.push(makeLight(b.x, top + 0.15 + rand() * 0.4, b.z, 0.18 + rand() * 0.12, "beacon"));
      }
      // facade windows: a few lit points climbing the front face.
      const nWin = Math.min(4, Math.floor(rand() * 5));
      for (let k = 0; k < nWin && lights.length < 240; k++) {
        const fy = 1 + rand() * (top - 1.2);
        const fx = b.x + (rand() - 0.5) * b.w * 0.8;
        const fz = b.z + (b.d * 0.5 + 0.05);
        lights.push(makeLight(fx, fy, fz, 0.1 + rand() * 0.08, "window"));
      }
    }
    // street-level scatter.
    for (let i = 0; i < 26 && lights.length < 240; i++) {
      lights.push(makeLight(-32 + rand() * 64, 0.4 + rand() * 0.6, -4 - rand() * 40, 0.12 + rand() * 0.08, "beacon"));
    }
    buildLights(lights);

    // ---- foliage (street trees / alien fronds) -------------------------
    buildFoliage(34, () => ({
      x: -40 + rand() * 80,
      z: (rand() < 0.5 ? -2 - rand() * 6 : -8 - rand() * 34),   // some near-front on the flanks
      s: 0.7 + rand() * 1.3,
    }));
  }

  // per-family hue offset so the polyhedra glow different tints from the accent.
  function hueJitter(key) {
    const T = { cyl: 8, cone: 40, pyramid: -30, prism: 70, tetra: 120, octa: 160, dome: -60, spire: 200, ziggurat: 25, taper: -15 };
    return (T[key] || 0) + (rand() - 0.5) * 20;
  }
  // a building material: dark genre-tinted wall with a faint emissive breath.
  function buildingMat(hue) {
    const h = hue == null ? acc.h : hue;
    return styleMat({
      vertexColors: true, flatShading: true,
      color: colHSL(THREE, h, 0.22, 0.30),
      emissive: colHSL(THREE, h, 0.55, 0.35),
      emissiveIntensity: 0.12 + glow * 0.22,
    });
    // (vertexColors on a geometry without a color attr just falls back to color.)
  }
  function placeBuilding(mesh, i, b) {
    _p.set(b.x, 0, b.z);                 // base sits on the ground (geo base at y=0)
    _q.setFromAxisAngle(YAX, b.r);
    _s.set(b.w, b.h, b.d || b.w);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  // stepped ziggurat: four shrinking stacked slabs merged into one geometry.
  function zigguratGeo() {
    const steps = 4, geos = [];
    for (let i = 0; i < steps; i++) {
      const w = 1 - i * 0.2;
      const g = new THREE.BoxGeometry(w, 1 / steps, w);
      g.translate(0, (i + 0.5) / steps, 0);
      geos.push(g);
    }
    return normGeo(mergeGeos(geos));
  }

  // a unit tower box (base at y=0) with a window grid baked into vertex colors.
  function towerGeo(salt) {
    const cols = 3, rows = 8;
    const geo = new THREE.BoxGeometry(1, 1, 1, cols, rows, cols).toNonIndexed();
    const pos = geo.attributes.position;
    const nTri = pos.count / 3;
    const colors = new Float32Array(pos.count * 3);
    const wallHue = 215 + salt * 25 + rand() * 20;
    const wall = colHSL(THREE, wallHue, 0.22, 0.16 + rand() * 0.05);
    const litPct = 42 + Math.floor(rand() * 22);
    const winWarm = glow < 0.5;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const N = new THREE.Vector3(), AB = new THREE.Vector3(), AC = new THREE.Vector3();
    for (let t = 0; t < nTri; t++) {
      const i0 = t * 3;
      A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i0 + 1); C.fromBufferAttribute(pos, i0 + 2);
      const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3;
      AB.subVectors(B, A); AC.subVectors(C, A); N.crossVectors(AB, AC).normalize();
      let col;
      if (Math.abs(N.y) > 0.5) {
        col = cy > 0 ? colHSL(THREE, acc.h, acc.s * 0.5, 0.22) : wall.clone().multiplyScalar(0.5);
      } else {
        const horiz = Math.abs(N.x) > Math.abs(N.z) ? cz : cx;
        const cCol = Math.min(cols - 1, Math.max(0, Math.floor((horiz + 0.5) * cols)));
        const cRow = Math.min(rows - 1, Math.max(0, Math.floor((cy + 0.5) * rows)));
        const sideId = N.x > 0 ? 0 : N.x < 0 ? 1 : N.z > 0 ? 2 : 3;
        const cell = ihash(((cRow * 73856093) ^ (cCol * 19349663) ^ (sideId * 83492791) ^ (salt * 2654435761)) | 0);
        if (cell % 100 < litPct) {
          const wl = 0.5 + ((cell >>> 8) % 40) / 100;
          col = winWarm ? colHSL(THREE, 44, 0.85, wl) : colHSL(THREE, (acc.h + 180) % 360, 0.8, wl * 0.85);
        } else {
          col = wall;
        }
      }
      for (let k = 0; k < 3; k++) { const b = (i0 + k) * 3; colors[b] = col.r; colors[b + 1] = col.g; colors[b + 2] = col.b; }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return normGeo(geo);
  }

  // ============================ FARM ====================================
  function buildFarm() {
    // ---- varied crops: three families over the tilled rows ------------
    const NX = 18, NZ = 7, rowGap = 2.6, colGap = 1.7;
    const cropCount = NX * NZ;
    const stalkGeo = normGeo(new THREE.ConeGeometry(0.34, 1, 5));     // bushy stalk
    const bushGeo = normGeo(new THREE.IcosahedronGeometry(0.5, 0));    // round bush
    const cornGeo = normGeo(new THREE.CylinderGeometry(0.12, 0.16, 1, 5)); // tall corn
    const mkCropMat = (h, s, l) => styleMat({
      color: colHSL(THREE, h, s, l),
      emissive: colHSL(THREE, h, 0.4, 0.12), emissiveIntensity: 0.2 + glow * 0.2,
    });
    const stalkMat = mkCropMat(95 + rand() * 25, 0.55, 0.34);
    const bushMat = mkCropMat(120 + rand() * 30, 0.5, 0.30);
    const cornMat = mkCropMat(70 + rand() * 20, 0.6, 0.38);
    const stalk = new THREE.InstancedMesh(stalkGeo, stalkMat, cropCount);
    const bush = new THREE.InstancedMesh(bushGeo, bushMat, cropCount);
    const corn = new THREE.InstancedMesh(cornGeo, cornMat, cropCount);
    stalk.name = "crops"; stalk.userData.family = "stalk";
    bush.name = "crops"; bush.userData.family = "bush";
    corn.name = "crops"; corn.userData.family = "corn";
    shadow(stalk, true, false); shadow(bush, true, true); shadow(corn, true, false);
    let si = 0, bi = 0, ni = 0;
    for (let r = 0; r < NZ; r++) {
      for (let c = 0; c < NX; c++) {
        const jx = (rand() - 0.5) * 0.4, jz = (rand() - 0.5) * 0.4;
        const x = (c - (NX - 1) / 2) * colGap + jx;
        const z = -5 - r * rowGap + jz;
        const pick = rand();
        _q.setFromAxisAngle(YAX, rand() * Math.PI);
        if (pick < 0.5) {
          const h = 0.7 + rand() * 0.9;
          _p.set(x, 0, z); _s.set(0.7 + rand() * 0.5, h, 0.7 + rand() * 0.5);
          _m.compose(_p, _q, _s); stalk.setMatrixAt(si++, _m);
        } else if (pick < 0.8) {
          const h = 0.6 + rand() * 0.6;
          _p.set(x, 0, z); _s.set(0.8 + rand() * 0.5, h, 0.8 + rand() * 0.5);
          _m.compose(_p, _q, _s); bush.setMatrixAt(bi++, _m);
        } else {
          const h = 1.4 + rand() * 1.1;
          _p.set(x, 0, z); _s.set(0.8 + rand() * 0.4, h, 0.8 + rand() * 0.4);
          _m.compose(_p, _q, _s); corn.setMatrixAt(ni++, _m);
        }
      }
    }
    stalk.count = si; bush.count = bi; corn.count = ni;
    for (const cm of [stalk, bush, corn]) {
      cm.instanceMatrix.needsUpdate = true;
      if (cm.count > 0) { group.add(cm); swayers.push({ mesh: cm, sx: 0.05, sz: 0.05, px: rand() * TAU }); }
    }

    // ---- silos with conical roofs -------------------------------------
    const NSILO = 5;
    const siloGeo = normGeo(new THREE.CylinderGeometry(0.9, 0.9, 1, 8));
    const roofGeo = normGeo(new THREE.ConeGeometry(1.05, 0.5, 8));
    const siloMat = styleMat({ color: colHSL(THREE, 30, 0.15, 0.55) });
    const roofMat = styleMat({ color: colHSL(THREE, acc.h, 0.5, 0.4) });
    const silos = new THREE.InstancedMesh(siloGeo, siloMat, NSILO);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, NSILO);
    silos.name = "silos"; roofs.name = "silo-roofs"; roofs.userData.family = "silo-roof";
    shadow(silos, true, true); shadow(roofs, true, false);
    for (let i = 0; i < NSILO; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 3 + rand() * 2.5, w = 1 + rand() * 0.4;
      const x = side * (12 + rand() * 8), z = -8 - rand() * 18;
      _q.identity();
      _p.set(x, 0, z); _s.set(w, h, w); _m.compose(_p, _q, _s); silos.setMatrixAt(i, _m);
      _p.set(x, h, z); _s.set(w, 1, w); _m.compose(_p, _q, _s); roofs.setMatrixAt(i, _m);
    }
    silos.instanceMatrix.needsUpdate = true; roofs.instanceMatrix.needsUpdate = true;
    group.add(silos); group.add(roofs);

    // ---- tree-lines along the field edges -----------------------------
    buildFoliage(26, () => {
      const side = rand() < 0.5 ? -1 : 1;
      return { x: side * (16 + rand() * 22), z: -2 - rand() * 40, s: 1.0 + rand() * 1.6 };
    });

    // ---- a few blinking fireflies / barn lights -----------------------
    const fireflies = [];
    for (let i = 0; i < 22; i++) {
      fireflies.push(makeLight(-30 + rand() * 60, 0.6 + rand() * 2.4, -4 - rand() * 34, 0.09 + rand() * 0.06, "firefly"));
    }
    buildLights(fireflies);
  }

  // ============================ FOLIAGE =================================
  // Low-poly plants: brown trunk cylinders + tinted canopy cones (leafy scenes)
  // or spiky alien fronds (electronic scenes). Two InstancedMeshes -> 2 draws.
  function buildFoliage(count, placer) {
    const trunkGeo = normGeo(new THREE.CylinderGeometry(0.08, 0.13, 1, 5));
    const canopyGeo = leafy
      ? normGeo(new THREE.ConeGeometry(0.5, 1, 6))            // rounded-ish leaf cone
      : normGeo(new THREE.ConeGeometry(0.4, 1, 4));           // sharp alien frond
    const trunkMat = styleMat({ color: colHSL(THREE, 28, 0.45, 0.22) });
    const canHue = leafy ? 110 + rand() * 30 : acc.h + 30;
    const canopyMat = styleMat({
      color: colHSL(THREE, canHue, leafy ? 0.55 : 0.6, leafy ? 0.32 : 0.42),
      emissive: colHSL(THREE, canHue, 0.5, leafy ? 0.08 : 0.2), emissiveIntensity: leafy ? 0.12 : 0.2 + glow * 0.2,
    });
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    trunk.name = "foliage-trunk"; trunk.userData.family = "foliage";
    canopy.name = "foliage-canopy"; canopy.userData.family = "foliage";
    shadow(trunk, true, false); shadow(canopy, true, true);   // canopies catch trunk/neighbour shade
    for (let i = 0; i < count; i++) {
      const P = placer();
      const th = (0.5 + rand() * 0.7) * P.s;               // trunk height
      const ch = (1.0 + rand() * 1.4) * P.s;               // canopy height
      const cw = (0.7 + rand() * 0.8) * P.s;               // canopy width
      _q.setFromAxisAngle(YAX, rand() * TAU);
      _p.set(P.x, 0, P.z); _s.set(0.7 * P.s, th, 0.7 * P.s);
      _m.compose(_p, _q, _s); trunk.setMatrixAt(i, _m);
      _p.set(P.x, th, P.z); _s.set(cw, ch, cw);
      _m.compose(_p, _q, _s); canopy.setMatrixAt(i, _m);
    }
    trunk.instanceMatrix.needsUpdate = true; canopy.instanceMatrix.needsUpdate = true;
    group.add(trunk); group.add(canopy);
    swayers.push({ mesh: canopy, sx: 0.04, sz: 0.06, px: rand() * TAU });
  }

  // ============================ LIGHTS ==================================
  // A single instanced-color mesh of small glowing octahedra. Each light carries
  // a seeded blink profile; update(dt) rewrites per-instance colors so the
  // skyline BLINKS (real animated emissive values, not a whole-material breath).
  function makeLight(x, y, z, scale, kind2) {
    // choose a neon-ish base colour.
    const roll = rand();
    let h;
    if (kind2 === "firefly") h = 70 + rand() * 30;                       // warm yellow-green
    else if (roll < 0.34) h = 44 + rand() * 10;                          // warm window amber
    else if (roll < 0.67) h = acc.h + (rand() - 0.5) * 20;               // accent neon
    else h = (acc.h + 180) % 360 + (rand() - 0.5) * 30;                  // complementary neon
    const base = colHSL(THREE, h, 0.9, 0.6);
    // blink profile: 0 steady, 1 hard blink (square), 2 soft pulse (sine).
    const tRoll = rand();
    const type = kind2 === "window" ? (tRoll < 0.55 ? 0 : tRoll < 0.85 ? 2 : 1)
      : kind2 === "firefly" ? 2
      : (tRoll < 0.4 ? 0 : tRoll < 0.75 ? 1 : 2);
    return {
      x, y, z, scale,
      r: base.r, g: base.g, b: base.b,
      type,
      phase: rand(),                       // 0..1 offset
      period: 0.4 + rand() * 2.2,          // seconds per blink cycle
      lo: 0.12 + rand() * 0.1,             // dim floor
      hi: 0.75 + rand() * 0.25,            // bright ceiling
    };
  }
  function buildLights(list) {
    if (!list.length) return;
    const geo = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.name = "beacons"; mesh.userData.family = "lights";
    for (let i = 0; i < list.length; i++) {
      const L = list[i];
      _p.set(L.x, L.y, L.z); _q.identity(); _s.set(L.scale, L.scale, L.scale);
      _m.compose(_p, _q, _s); mesh.setMatrixAt(i, _m);
      _c.setRGB(L.r * L.hi, L.g * L.hi, L.b * L.hi);
      mesh.setColorAt(i, _c);                 // seed instanceColor so it exists pre-update
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    beacons = { mesh, meta: list };
  }

  // ---- ANIMATION -------------------------------------------------------
  function update(dt) {
    clock += dt || 0;
    glitchTime.value = clock;   // drives the 'glitch' style's jitter+flicker (uniform only)
    // building skyline slow neon breath.
    if (flicker.length) {
      const f = 0.12 + glow * 0.22 + Math.sin(clock * 2.1) * 0.05;
      for (const m of flicker) m.emissiveIntensity = f;
    }
    // BLINK: rewrite each light's per-instance colour from its seeded profile.
    if (beacons) {
      const { mesh, meta } = beacons;
      for (let i = 0; i < meta.length; i++) {
        const L = meta[i];
        let b;
        if (L.type === 0) {
          b = L.hi;                                                    // steady
        } else if (L.type === 1) {
          const ph = (clock / L.period + L.phase) % 1;                 // hard blink
          b = ph < 0.5 ? L.hi : L.lo;
        } else {
          b = L.lo + (L.hi - L.lo) * (0.5 + 0.5 * Math.sin(clock * TAU / L.period + L.phase * TAU)); // soft pulse
        }
        _c.setRGB(L.r * b, L.g * b, L.b * b);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    // gentle wind sway across foliage / crops.
    for (const sw of swayers) {
      sw.mesh.rotation.z = Math.sin(clock * 1.3 + sw.px) * sw.sz;
      sw.mesh.rotation.x = Math.sin(clock * 0.9 + sw.px + 1) * sw.sx;
    }
  }

  return { group, update };
}

export default { makeBackdrop };

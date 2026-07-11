// backdrop.js — Build phase. The procedural, seeded, low-poly world BEHIND the
// alien band: a CITY skyline (instanced towers whose windows are baked into
// vertex colors) or a FARM (instanced crop rows + silos over a tilled field),
// chosen by traits.backdrop. Everything is asset-free and cheap — a handful of
// InstancedMeshes (few draw calls), flat/vertex-lit for the PS1 look; postfx
// adds the dither/warp. update(dt) gives the city a slow window flicker and the
// farm a wind sway.
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

export function makeBackdrop(THREE, traits, seed) {
  seed = (seed | 0) || 1;
  traits = traits || {};
  const rand = rng32((seed ^ 0x1b8734) >>> 0);
  const kind = traits.backdrop === "farm" ? "farm" : "city";
  const glow = Math.max(0, Math.min(1, traits.glow || 0.3));
  const acc = traits.palette && traits.palette.accent
    ? { h: traits.palette.accent.h || 40, s: traits.palette.accent.s != null ? traits.palette.accent.s : 0.85, l: traits.palette.accent.l != null ? traits.palette.accent.l : 0.6 }
    : { h: 40, s: 0.85, l: 0.6 };

  const group = new THREE.Object3D();
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  const flicker = [];   // materials the city breathes on update()
  let sway = null;      // the crop mesh the farm sways on update()
  let clock = 0;

  // ---- GROUND ----------------------------------------------------------
  // a flat field/asphalt slab so the band stands on a place, not in the void.
  const groundCol = kind === "farm"
    ? colHSL(THREE, 90 + rand() * 30, 0.4, 0.20)      // tilled green-brown soil
    : colHSL(THREE, 220 + rand() * 30, 0.15, 0.11);   // dark wet asphalt
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshLambertMaterial({ color: groundCol, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = "ground";
  group.add(ground);

  if (kind === "city") buildCity(); else buildFarm();

  // ============================ CITY ====================================
  function buildCity() {
    // A tower is a segmented box; every side cell is either a lit WINDOW or dark
    // wall, decided by a per-cell hash and baked into VERTEX COLORS (no textures).
    // We build a few tower VARIANTS (each its own window pattern + wall tint) and
    // hand each variant its own InstancedMesh, so the skyline has variety while
    // staying to a few draw calls.
    const VARIANTS = 3;
    const TOTAL = 60;                       // total towers across variants
    const per = Math.ceil(TOTAL / VARIANTS);

    // spread tower footprints across a band behind the aliens (leave the front
    // clear where they stand). Deterministic scatter.
    const slots = [];
    for (let i = 0; i < TOTAL; i++) {
      slots.push({
        x: -26 + rand() * 52,
        z: -6 - rand() * 30,
        w: 1.4 + rand() * 2.4,
        h: 3 + rand() * 12,
        r: Math.floor(rand() * 4) * (Math.PI / 2),
      });
    }

    for (let v = 0; v < VARIANTS; v++) {
      const geo = towerGeo(v);
      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true, flatShading: true,
        emissive: colHSL(THREE, acc.h, acc.s * 0.7, 0.5),
        emissiveIntensity: 0.15 + glow * 0.25,
      });
      const list = slots.slice(v * per, (v + 1) * per);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.name = "buildings";
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        _p.set(b.x, b.h * 0.5, b.z);
        _q.setFromAxisAngle(YAX, b.r);
        _s.set(b.w, b.h, b.w);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      flicker.push(mat);
    }
  }

  // a unit tower box (1x1x1) with a window grid baked into vertex colors. `salt`
  // gives each variant a different lit-window pattern + wall hue.
  function towerGeo(salt) {
    const cols = 3, rows = 8;               // window grid resolution per side
    const geo = new THREE.BoxGeometry(1, 1, 1, cols, rows, cols).toNonIndexed();
    const pos = geo.attributes.position;
    const nTri = pos.count / 3;
    const colors = new Float32Array(pos.count * 3);
    const wallHue = 215 + salt * 25 + rand() * 20;
    const wall = colHSL(THREE, wallHue, 0.22, 0.16 + rand() * 0.05);
    const litPct = 42 + Math.floor(rand() * 22);   // % of side cells lit
    const winWarm = glow < 0.5;                     // low-glow -> warm office windows
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const N = new THREE.Vector3(), AB = new THREE.Vector3(), AC = new THREE.Vector3();
    for (let t = 0; t < nTri; t++) {
      const i0 = t * 3;
      A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i0 + 1); C.fromBufferAttribute(pos, i0 + 2);
      const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3;
      AB.subVectors(B, A); AC.subVectors(C, A); N.crossVectors(AB, AC).normalize();
      let col;
      if (Math.abs(N.y) > 0.5) {
        // roof / underside: a dark cap (a lit accent lip on the very top).
        col = cy > 0 ? colHSL(THREE, acc.h, acc.s * 0.5, 0.22) : wall.clone().multiplyScalar(0.5);
      } else {
        const horiz = Math.abs(N.x) > Math.abs(N.z) ? cz : cx;
        const cCol = Math.min(cols - 1, Math.max(0, Math.floor((horiz + 0.5) * cols)));
        const cRow = Math.min(rows - 1, Math.max(0, Math.floor((cy + 0.5) * rows)));
        const sideId = N.x > 0 ? 0 : N.x < 0 ? 1 : N.z > 0 ? 2 : 3;
        const cell = ihash(((cRow * 73856093) ^ (cCol * 19349663) ^ (sideId * 83492791) ^ (salt * 2654435761)) | 0);
        if (cell % 100 < litPct) {
          const wl = 0.5 + ((cell >>> 8) % 40) / 100;   // per-window brightness jitter
          col = winWarm ? colHSL(THREE, 44, 0.85, wl) : colHSL(THREE, (acc.h + 180) % 360, 0.8, wl * 0.85);
        } else {
          col = wall;
        }
      }
      for (let k = 0; k < 3; k++) { const b = (i0 + k) * 3; colors[b] = col.r; colors[b + 1] = col.g; colors[b + 2] = col.b; }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  // ============================ FARM ====================================
  function buildFarm() {
    // Crops arranged in tidy ROWS (a grid with wide row-spacing), plus a few
    // silos at the field edge. Two InstancedMeshes -> two draw calls.
    const NX = 18, NZ = 7;                  // crops per row x number of rows
    const rowGap = 2.6, colGap = 1.7;
    const cropGeo = new THREE.ConeGeometry(0.34, 1, 5);   // low-poly bushy stalk
    const cropMat = new THREE.MeshLambertMaterial({
      color: colHSL(THREE, 95 + rand() * 25, 0.55, 0.34), flatShading: true,
      emissive: colHSL(THREE, 100, 0.4, 0.12), emissiveIntensity: 0.2 + glow * 0.2,
    });
    const crops = new THREE.InstancedMesh(cropGeo, cropMat, NX * NZ);
    crops.name = "crops";
    let ci = 0;
    for (let r = 0; r < NZ; r++) {
      for (let c = 0; c < NX; c++) {
        const jx = (rand() - 0.5) * 0.4, jz = (rand() - 0.5) * 0.4;
        const h = 0.7 + rand() * 0.9;
        const x = (c - (NX - 1) / 2) * colGap + jx;
        const z = -5 - r * rowGap + jz;
        _p.set(x, h * 0.5, z);
        _q.setFromAxisAngle(YAX, rand() * Math.PI);
        _s.set(0.7 + rand() * 0.5, h, 0.7 + rand() * 0.5);
        _m.compose(_p, _q, _s);
        crops.setMatrixAt(ci++, _m);
      }
    }
    crops.instanceMatrix.needsUpdate = true;
    group.add(crops);
    sway = crops;

    const NSILO = 5;
    const siloGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 8);
    const siloMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, 30, 0.15, 0.55), flatShading: true });
    const silos = new THREE.InstancedMesh(siloGeo, siloMat, NSILO);
    silos.name = "silos";
    for (let i = 0; i < NSILO; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 3 + rand() * 2.5;
      _p.set(side * (12 + rand() * 8), h * 0.5, -8 - rand() * 18);
      _q.identity();
      _s.set(1 + rand() * 0.4, h, 1 + rand() * 0.4);
      _m.compose(_p, _q, _s);
      silos.setMatrixAt(i, _m);
    }
    silos.instanceMatrix.needsUpdate = true;
    group.add(silos);
  }

  // ---- ANIMATION -------------------------------------------------------
  function update(dt) {
    clock += dt || 0;
    if (kind === "city") {
      // slow neon breathing so the skyline lives without rewriting instances.
      const f = 0.15 + glow * 0.25 + Math.sin(clock * 2.1) * 0.06;
      for (const m of flicker) m.emissiveIntensity = f;
    } else if (sway) {
      // gentle wind across the crop field.
      sway.rotation.z = Math.sin(clock * 1.3) * 0.05;
      sway.rotation.x = Math.sin(clock * 0.9 + 1) * 0.02;
    }
  }

  return { group, update };
}

export default { makeBackdrop };

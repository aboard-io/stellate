// props.js — THE THINGS AROUND THE BAND. Everything on the landed planet that is not
// a creature, not the terrain, and not the backdrop skyline: the band's SIGNAGE (a
// hand-painted banner carrying the name NameBank invented for them), the STAGE KIT
// (amps, a mic stand nobody uses, a folding chair, coiled cable), one TERRAIN LANDMARK
// per world archetype, and the SKY BODIES (a moon, sometimes a ring arc).
//
// WHY THIS EXISTS. The landed scene was band + bare ground + stars. Every planet in
// the catalog read the same because the only thing that varied was the creatures and
// the palette. Props are what make a band read as a BAND playing a GIG on a PLACE —
// scale references, a name to read, junk on the floor, something on the horizon.
//
// LAWS (the same ones the rest of star-cruise keeps):
//   • DETERMINISTIC — every draw flows through mulberry32(seed). NO Math.random, no
//     Date.now. Same (traits, seed) -> the same gig, down to which amp is dented.
//   • MOBILE-LIGHT — a handful of small meshes, geometry built once at spawn and never
//     per frame. Text is baked into ONE small CanvasTexture per sign and disposed with
//     the group (scene.js's disposeObj already disposes material.map).
//   • ASSET-FREE / CSP — no fetch, no CDN, no inline <script>. Canvas 2D + THREE only.
//   • CURVED-WORLD AWARE — every builder takes a `plant(x, z, yaw) -> {position,
//     quaternion}` callback from scene.js so props foot-plant on the little planet's
//     terrain exactly like the band does, instead of floating on a flat plane.
//
// CONTRACT
//   makeSignage(THREE, ident, traits, seed, plant)   -> { group, update(dt) }
//   makeStageKit(THREE, traits, seed, plant, opts)   -> { group, update(dt) }
//   makeLandmark(THREE, terrainType, traits, seed, plant) -> { group, update(dt) } | null
//   makeSkyBodies(THREE, traits, seed, radius)       -> { group, update(dt) }
//     ident = NameBank.identity(genre, seed) — { artist, title, album, year, label }
//     plant(x, z, yaw) -> { position: Vector3-ish, quaternion: Quaternion } | null
//       (null / absent => the flat fallback: position (x, 0, z), yaw about +Y)

// mulberry32 — the same tiny seeded PRNG every star-cruise module carries locally so
// none of them depend on each other just for randomness.
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
function colHSL(THREE, h, s, l) {
  return new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), clamp(s, 0, 1), clamp(l, 0, 1));
}
// css color string for the 2D canvas (the sign painter works in CSS, not THREE.Color).
const css = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${Math.round(clamp(s, 0, 1) * 100)}% ${Math.round(clamp(l, 0, 1) * 100)}%)`;

// place a built group onto the curved surface via the caller's plant() (or flat).
function place(obj, plant, x, z, yaw) {
  const p = plant && plant(x, z, yaw || 0);
  if (p && p.position) {
    obj.position.copy(p.position);
    if (p.quaternion) obj.quaternion.copy(p.quaternion);
  } else {
    obj.position.set(x, 0, z);
    obj.rotation.y = yaw || 0;
  }
  return obj;
}

// ---- THE SIGN PAINTER ---------------------------------------------------------
// Bake a line of text into a CanvasTexture. Deliberately CRUDE — a hand-lettered
// tour banner, not a typeset poster: the letters are stretched to fill the cloth and
// the paint is a flat accent colour on a dark ground, so it survives the PS1 pass's
// posterize + dither at the distance you actually read it from.
function textTexture(THREE, lines, opts) {
  opts = opts || {};
  const W = opts.w || 512, H = opts.h || 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return null;
  if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, W, H); }
  else g.clearRect(0, 0, W, H);
  // a slightly grubby cloth: two washes of a darker tone so the banner isn't a
  // perfectly flat rectangle under the flat-shaded light.
  if (opts.grime) {
    const r = rng32(opts.seed || 1);
    g.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i % 2 ? "#000" : "#fff";
      g.fillRect(r() * W, r() * H, 20 + r() * 120, 6 + r() * 40);
    }
    g.globalAlpha = 1;
  }
  const n = lines.length;
  for (let i = 0; i < n; i++) {
    const L = lines[i];
    if (!L || !L.text) continue;
    const size = Math.round(H * (L.size || 0.3));
    g.font = `${L.bold === false ? "" : "bold "}${size}px "VT323", "Courier New", monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = L.color || "#fff";
    const y = H * (L.y != null ? L.y : (i + 0.5) / n);
    // squeeze a long name to fit rather than letting it run off the cloth
    const m = g.measureText(L.text).width;
    const maxW = W * (L.maxW || 0.9);
    g.save();
    if (m > maxW) { g.translate(W / 2, y); g.scale(maxW / m, 1); g.translate(-W / 2, -y); }
    g.fillText(L.text, W / 2, y);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;   // stay in the PS1 look — no smooth upscaling
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---- THE BOARD: a LIVE sign, not a painted one --------------------------------
// The banner is a departure board / stadium matrix that never settles. Most of it is
// alien glyph noise churning at a few hertz; individual rows RESOLVE into a real
// word — the band's name, the record, the label, a player — hold for a couple of
// seconds, then scramble back into glyphs. The band name gets the big middle row and
// resolves most often, so the joke stays readable while the sign stays alive.
//
// HOW IT STAYS CHEAP. One 512x160 canvas, redrawn at BOARD_FPS (not per frame) and
// re-uploaded by flipping texture.needsUpdate. At 10 Hz on a 512x160 that is ~0.8 MP/s
// of 2D fill and one small upload — an order under the per-frame redraw the obvious
// implementation reaches for, and invisible next to the scene's own frame cost.
//
// HOW IT STAYS DETERMINISTIC. No Math.random and no clock: every cell reads a seeded
// hash of (seed, cell index, TICK), where tick is a counter the update loop advances
// off accumulated dt. Same seed + same tick = the same board, so two machines showing
// the same landing show the same sign.
const BOARD_FPS = 10;
// the alien alphabet the rest of the cruise uses (the floating idents, the HUD's
// station names) so the sign belongs to the same writing system.
const BOARD_GLYPHS = [..."╬╪▚▞⠺⠵⣿⠋▟▙◈▛◭◮⊗⊘⋔⋕⊞⊟↯⇶↺ᛝᚦᛟᚱ☰☲☵☷◇⬡⬢∴∵∷⁂⌁⌇⌭⌗▓░▒"];
// integer hash -> the per-cell noise. Pure, so a cell is a function of where and when.
function ihash(a, b, c) {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

// makeBoard(THREE, rows, opts) -> { texture, draw(tick), rows }
//   rows = [{ words:[…], size, y, color, hold, cols }]
//     words  the real strings this row cycles through (empty = pure glyph noise)
//     hold   how many ticks a resolved word stays up before scrambling
function makeBoard(THREE, rows, opts) {
  opts = opts || {};
  const W = opts.w || 512, H = opts.h || 160;
  const seed = (opts.seed | 0) || 1;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return null;
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  function draw(tick) {
    g.fillStyle = opts.bg || "#0b0a14";
    g.fillRect(0, 0, W, H);
    // the grubby cloth wash, fixed per sign (hashed off the seed, not the tick, so
    // the cloth does not crawl while the letters do)
    g.globalAlpha = 0.10;
    for (let i = 0; i < 14; i++) {
      const h = ihash(seed, i, 0);
      g.fillStyle = i % 2 ? "#000" : "#fff";
      g.fillRect((h % W), ((h >>> 9) % H), 20 + ((h >>> 17) % 120), 6 + ((h >>> 25) % 34));
    }
    g.globalAlpha = 1;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const size = Math.round(H * (row.size || 0.2));
      const y = H * (row.y != null ? row.y : (r + 0.5) / rows.length);
      const cols = row.cols || Math.max(8, Math.round(W / (size * 0.62)));
      const hold = row.hold || 24;
      // WHICH WORD, IF ANY. Each row runs a cycle `hold` ticks long; for the first
      // ~2/3 of it a word is up, for the rest the row is glyph noise. Different rows
      // get different phases off the hash so they never all flip together.
      const cyc = Math.floor(tick / hold);
      const phase = (tick % hold) / hold;
      const words = row.words && row.words.length ? row.words : null;
      const word = words ? String(words[ihash(seed, r + 31, cyc) % words.length] || "").toUpperCase() : null;
      // HOW LONG THE WORD STAYS UP is per row. The band's name is the one thing on
      // this sign somebody actually wants to read, so the top row holds it for most
      // of its cycle; the rows under it churn harder, which is what keeps the sign
      // from reading as three lines of static text with a shimmer.
      const up = row.up != null ? row.up : 0.68;      // fraction of the cycle a word is up
      const inTime = row.in != null ? row.in : 0.16;  // assemble over this much of it
      const showing = !!word && phase < up;
      // RESOLVE + DISSOLVE at the edges: a character is real only once its own hash
      // clears a threshold that rises as the word settles and falls as it breaks up,
      // so the word assembles and comes apart letter by letter rather than cutting.
      const outAt = up - inTime;
      const settle = showing ? Math.min(1, phase / inTime) : 0;
      const breakup = showing && phase > outAt ? (phase - outAt) / inTime : 0;
      const solidity = Math.max(0, Math.min(1, settle - breakup));

      g.font = `bold ${size}px "VT323", "Courier New", monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const cw = W / cols;
      const start = word ? Math.max(0, Math.floor((cols - word.length) / 2)) : 0;
      for (let c = 0; c < cols; c++) {
        const inWord = word && c >= start && c < start + word.length;
        const wch = inWord ? word[c - start] : null;
        const h = ihash(seed, r * 977 + c, tick);
        const real = inWord && wch !== " " && (h % 1000) / 1000 < solidity;
        let ch, col;
        if (real) { ch = wch; col = row.color || "#eaeaff"; }
        else if (inWord && wch === " ") { continue; }
        else {
          // glyph noise — dimmer, and it churns on its own slower clock so the whole
          // field doesn't strobe at the redraw rate
          ch = BOARD_GLYPHS[ihash(seed, r * 131 + c, tick >> 1) % BOARD_GLYPHS.length];
          col = row.dim || "rgba(150,160,220,0.34)";
        }
        g.fillStyle = col;
        g.fillText(ch, cw * (c + 0.5), y);
      }
    }
    tex.needsUpdate = true;
  }

  draw(0);
  return { texture: tex, draw, canvas: cv };
}

// ---- SIGNAGE ------------------------------------------------------------------
// The band's name, on the planet. A cloth banner slung between two crooked poles
// BEHIND the drummer, reading the artist NameBank invented for this genre + seed,
// with the album and year underneath in smaller paint. Plus a leaning bill-poster
// board off to one side carrying the record label — the detail that turns a lineup
// of creatures into a gig somebody booked.
export function makeSignage(THREE, ident, traits, seed, plant, opts) {
  opts = opts || {};
  const group = new THREE.Object3D();
  group.name = "signage";
  const r = rng32(((seed | 0) ^ 0x5bf03635) >>> 0);
  const pal = (traits && traits.palette) || {};
  const acc = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const cloth = pal.cloth || { h: 200, s: 0.5, l: 0.4 };
  ident = ident || {};
  const artist = String(ident.artist || "THE BAND").toUpperCase();
  const album = String(ident.album || "").toUpperCase();
  const title = String(ident.title || "").toUpperCase();
  const year = ident.year ? String(ident.year) : "";
  const label = String(ident.label || "").toUpperCase();

  const back = opts.back != null ? opts.back : -6.5;      // how far behind the arc
  const width = clamp(opts.width || 9, 5, 16);
  const height = width * 0.34;
  const poleH = height + 1.6;

  // --- the banner cloth: A LIVE BOARD ---
  // Three rows that never all settle at once. The big middle row is the band and
  // resolves most often; the others cycle the record, the year and label, the
  // players, and the odd bit of pure noise. Everything not currently resolved is
  // churning alien glyphs, so the sign reads as a working display rather than a
  // painted sheet — and on a planet you fly past, motion is what makes you look.
  const extra = (opts.words || []).filter(Boolean).map(String);
  const board = makeBoard(THREE, [
    { words: [artist, artist, artist, ...extra.slice(0, 2)], y: 0.30, size: 0.26, hold: 34,
      up: 0.86, in: 0.12,          // the name is readable most of the time
      color: css(acc.h, 0.95, 0.74), dim: `hsl(${acc.h} 40% 42% / 0.42)` },
    { words: [album, title].filter(Boolean), y: 0.60, size: 0.15, hold: 26,
      color: css(acc.h + 20, 0.5, 0.86), dim: `hsl(${acc.h + 20} 35% 40% / 0.34)` },
    { words: [year && label ? year + " " + label : (year || label), ...extra.slice(2)].filter(Boolean),
      y: 0.83, size: 0.10, hold: 21,
      color: css(acc.h + 20, 0.3, 0.72), dim: `hsl(${acc.h + 40} 30% 38% / 0.30)` },
  ], { w: 512, h: 160, bg: css(cloth.h, cloth.s * 0.8, 0.11), seed: (seed | 0) + 3 });
  const tex = board && board.texture;
  const clothMat = tex
    ? new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, transparent: false })
    : new THREE.MeshLambertMaterial({ color: colHSL(THREE, cloth.h, cloth.s, 0.2), side: THREE.DoubleSide });
  // a gently SAGGING cloth (a plane with its middle row pulled down) — a taut rectangle
  // reads as a screen; a sag reads as a bedsheet somebody nailed up an hour ago.
  const geo = new THREE.PlaneGeometry(width, height, 12, 3);
  {
    const p = geo.attributes.position, sag = height * (0.16 + r() * 0.12);
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) / width) + 0.5;                  // 0..1 across
      const v = (p.getY(i) / height) + 0.5;                 // 0..1 up
      const droop = Math.sin(Math.PI * u) * sag * (0.35 + v * 0.65);
      p.setY(i, p.getY(i) - droop);
      p.setZ(i, p.getZ(i) - Math.sin(Math.PI * u) * sag * 0.3);   // and bellies backward
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  }
  const banner = new THREE.Mesh(geo, clothMat);
  banner.position.y = poleH - height * 0.55;
  banner.castShadow = false; banner.receiveShadow = true;
  const rig = new THREE.Object3D();
  rig.add(banner);

  // --- two crooked poles ---
  // pale enough to read AGAINST THE NIGHT SKY — at 0.22 lightness the poles vanished
  // into black and the banner looked like a screen floating over the band.
  const poleMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h + 180, 0.18, 0.52), flatShading: true });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, poleH, 6), poleMat);
    pole.position.set(sx * width * 0.5, poleH * 0.5, 0);
    pole.rotation.z = sx * (0.03 + r() * 0.05);            // neither one is straight
    pole.castShadow = true; pole.receiveShadow = true;
    rig.add(pole);
  }
  // Yaw 0 IS facing the pilot: the landing frame puts the camera on +Z and a
  // PlaneGeometry's front face is its own +Z, so a Math.PI spin here turned the cloth
  // around and you read the band's name backwards through the back of the sheet.
  place(rig, plant, 0, back, 0);
  group.add(rig);

  // --- the label bill-board, leaning where somebody left it ---
  if (label) {
    const btex = textTexture(THREE, [
      { text: label, y: 0.36, size: 0.26, color: css(acc.h, 0.9, 0.7) },
      { text: "TONIGHT", y: 0.7, size: 0.16, color: css(acc.h, 0.25, 0.6) },
    ], { w: 256, h: 256, bg: css(cloth.h + 40, 0.3, 0.1), grime: true, seed: (seed | 0) + 11 });
    const bm = btex
      ? new THREE.MeshLambertMaterial({ map: btex, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h, 0.4, 0.25), side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), bm);
    board.position.y = 0.95;
    board.castShadow = true; board.receiveShadow = true;
    const stand = new THREE.Object3D();
    stand.add(board);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5), poleMat);
    leg.position.y = 0.5; stand.add(leg);
    const side = r() < 0.5 ? -1 : 1;
    place(stand, plant, side * (width * 0.5 + 1.6 + r()), back + 1.2 + r(), side * (0.5 + r() * 0.4));
    stand.rotateX(0.10 + r() * 0.10);                       // leaning, not planted
    group.add(stand);
  }

  // the banner BREATHES on a slow deterministic clock — cloth in a thin atmosphere —
  // and the BOARD churns on its own fixed-step tick, which is deliberately NOT the
  // frame rate: the sign has to look the same on a 30 fps phone and a 144 Hz monitor,
  // and redrawing a canvas every frame for a texture nobody reads that fast is waste.
  let t = 0, boardAcc = 0, tick = 0;
  const basePos = geo.attributes.position.array.slice();
  return {
    group,
    update(dt) {
      dt = dt || 0;
      t += dt;
      const p = geo.attributes.position;
      const amp = height * 0.03;
      for (let i = 0; i < p.count; i++) {
        const u = basePos[i * 3] / width + 0.5;
        p.array[i * 3 + 2] = basePos[i * 3 + 2] + Math.sin(t * 1.1 + u * 5.0) * amp * Math.sin(Math.PI * u);
      }
      p.needsUpdate = true;
      if (board) {
        boardAcc += dt;
        const step = 1 / BOARD_FPS;
        if (boardAcc >= step) {
          // advance ONE tick per redraw however far behind we are: a long stall
          // (a landing rebuild, a tab wake) must not fast-forward the sign through
          // fifty ticks of scramble in a single frame.
          boardAcc = boardAcc % step;
          board.draw(++tick);
        }
      }
    },
  };
}

// ---- THE STAGE KIT ------------------------------------------------------------
// Gear. Amp stacks scaled to the low end, monitor wedges pointed at the players, a
// mic stand no one is standing at, a folding chair, and a coil of cable somebody
// will trip over. None of it animates except the amp grille glow, and none of it is
// a creature — its entire job is to give the aliens a SCALE and a JOB.
export function makeStageKit(THREE, traits, seed, plant, opts) {
  opts = opts || {};
  const group = new THREE.Object3D();
  group.name = "stagekit";
  const r = rng32(((seed | 0) ^ 0x2c1b3a95) >>> 0);
  const pal = (traits && traits.palette) || {};
  const acc = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const f = (traits && traits._features) || {};
  const halfW = clamp(opts.halfW || 8, 4, 16);
  const glow = clamp((traits && traits.glow) || 0.3, 0, 1);

  const caseMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h + 190, 0.10, 0.13), flatShading: true });
  const metalMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h + 200, 0.06, 0.34), flatShading: true });
  const grilleMat = new THREE.MeshLambertMaterial({
    color: colHSL(THREE, acc.h, 0.35, 0.18), flatShading: true,
    emissive: colHSL(THREE, acc.h, 0.8, 0.22), emissiveIntensity: 0.5 + glow * 0.8,
  });

  // AMP STACKS — how many, and how tall, is the LOW END. A sub-heavy genre gets a
  // wall; a hushed one gets a single practice combo, which is its own joke.
  const sub = typeof f.sub === "number" ? clamp((f.sub - 0.2) / 0.8, 0, 1) : 0.5;
  const stackH = 1 + Math.round(sub * 2.2);                 // 1..3 cabinets high
  const nAmps = 1 + Math.round(sub * 2);                    // 1..3 stacks per side
  for (let s = -1; s <= 1; s += 2) {
    for (let a = 0; a < nAmps; a++) {
      const stack = new THREE.Object3D();
      const w = 1.25 + r() * 0.2, d = 0.75;
      for (let k = 0; k < stackH; k++) {
        const h = k === 0 ? 1.0 : 0.8;
        const y = k === 0 ? h / 2 : 1.0 + (k - 1) * 0.8 + h / 2;
        const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), caseMat);
        cab.position.y = y;
        cab.castShadow = true; cab.receiveShadow = true;
        stack.add(cab);
        const gr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.66), grilleMat);
        gr.position.set(0, y, d / 2 + 0.01);
        stack.add(gr);
      }
      place(stack, plant,
        s * (halfW * 0.62 + a * 1.7 + 0.8),
        -2.2 - r() * 1.2,
        s * (0.25 + r() * 0.25));                        // grilles face the band (+Z), angled in
      group.add(stack);
    }
  }

  // MONITOR WEDGES — tilted boxes on the floor line, pointed back at the players.
  const nWedge = 2 + Math.round(r() * 2);
  for (let i = 0; i < nWedge; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), caseMat);
    w.castShadow = true; w.receiveShadow = true;
    const holder = new THREE.Object3D();
    holder.add(w);
    w.position.y = 0.2; w.rotation.x = -0.42;
    // downstage of the players and tilted BACK at them, so yaw is the half-turn
    place(holder, plant, (i - (nWedge - 1) / 2) * 3.1 + (r() - 0.5), 3.3 + r() * 0.5, Math.PI);
    group.add(holder);
  }

  // THE MIC STAND NOBODY IS AT. A boom leaning over an empty spot at the front.
  {
    const st = new THREE.Object3D();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 12), metalMat);
    base.position.y = 0.03; st.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.55, 6), metalMat);
    shaft.position.y = 0.8; st.add(shaft);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), metalMat);
    boom.position.set(0.3, 1.5, 0.16); boom.rotation.z = -1.05; boom.rotation.y = 0.4;
    st.add(boom);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.075, 0.12, 3, 7)
      : new THREE.SphereGeometry(0.1, 8, 6), grilleMat);
    head.position.set(0.63, 1.62, 0.3); head.rotation.z = -0.9;
    st.add(head);
    st.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    place(st, plant, (r() - 0.5) * 2.4, 3.9 + r() * 0.6, Math.PI + (r() - 0.5) * 0.5);
    group.add(st);
  }

  // THE FOLDING CHAIR. Empty. Always empty.
  {
    const ch = new THREE.Object3D();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), metalMat);
    seat.position.y = 0.46; ch.add(seat);
    const backr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), metalMat);
    backr.position.set(0, 0.72, -0.23); backr.rotation.x = -0.14; ch.add(backr);
    for (const [lx, lz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 5), metalMat);
      leg.position.set(lx, 0.23, lz); ch.add(leg);
    }
    ch.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const side = r() < 0.5 ? -1 : 1;
    place(ch, plant, side * (halfW * 0.5 + 1.1), 2.6 + r(), r() * 6.28);
    group.add(ch);
  }

  // CABLE. Two loose coils and a run between the amps — a torus lying flat reads as
  // exactly the thing a roadie should have tidied.
  {
    const cableMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h + 200, 0.1, 0.09), flatShading: true });
    for (let i = 0; i < 2; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.42 + r() * 0.16, 0.045, 5, 14), cableMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.y = 0.05;
      const holder = new THREE.Object3D();
      holder.add(coil);
      holder.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      place(holder, plant, (r() - 0.5) * halfW * 1.5, 1.6 + r() * 2.2, r() * 6.28);
      group.add(holder);
    }
  }

  // the amp grilles PULSE faintly — the only moving part in the whole kit.
  let t = 0;
  return {
    group,
    update(dt) {
      t += dt || 0;
      grilleMat.emissiveIntensity = 0.5 + glow * 0.8 + Math.sin(t * 2.2) * 0.12;
    },
  };
}

// ---- THE LANDMARK -------------------------------------------------------------
// ONE big silhouette on the horizon, chosen by the ground planet's TERRAIN TYPE. The
// nine terrain archetypes are real — they shape the fBm and the colour ramp — but at
// the ~10-unit scale you actually stand at, a crater world and a canyon world both
// read as "a smooth coloured dome". A landmark is the cheap fix: you cannot see the
// crater field, but you can see the rim of ONE crater against the sky and know where
// you are. Returns null for terrain types whose character already reads underfoot.
export function makeLandmark(THREE, terrainType, traits, seed, plant) {
  const r = rng32(((seed | 0) ^ 0x7f4a7c15) >>> 0);
  const pal = (traits && traits.palette) || {};
  const acc = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const group = new THREE.Object3D();
  group.name = "landmark-" + (terrainType || "none");
  const rock = (h, s, l) => new THREE.MeshLambertMaterial({ color: colHSL(THREE, h, s, l), flatShading: true });
  // far enough out to sit ON the horizon of the little world, not in the band's lap
  const FAR = 15 + r() * 4;
  const ang = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.9);
  const lx = Math.sin(ang) * FAR, lz = -Math.cos(ang) * FAR;
  let t = 0, glowMat = null;

  const add = (mesh, x, z, yaw) => {
    const holder = new THREE.Object3D();
    holder.add(mesh);
    holder.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    place(holder, plant, x, z, yaw || 0);
    group.add(holder);
    return holder;
  };

  switch (terrainType) {
    case "volcanic": {
      // a cone with a lit throat + a lazy smoke stack of shrinking spheres
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 6.5, 7), rock(14, 0.35, 0.13));
      cone.position.y = 3.25;
      const h = add(cone, lx, lz, 0);
      glowMat = new THREE.MeshBasicMaterial({ color: colHSL(THREE, 18, 0.95, 0.55), transparent: true, opacity: 0.85 });
      const throat = new THREE.Mesh(new THREE.CircleGeometry(1.1, 10), glowMat);
      throat.rotation.x = -Math.PI / 2; throat.position.y = 6.4; h.add(throat);
      const smokeMat = new THREE.MeshBasicMaterial({ color: colHSL(THREE, 0, 0, 0.4), transparent: true, opacity: 0.22 });
      for (let i = 0; i < 5; i++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + i * 0.4, 0), smokeMat);
        puff.position.set((r() - 0.5) * 1.4, 7.2 + i * 1.5, (r() - 0.5) * 1.4);
        h.add(puff);
      }
      break;
    }
    case "craters": {
      // the RIM of one big crater, as an arc of tilted slabs
      const m = rock(40, 0.04, 0.34);
      for (let i = 0; i < 11; i++) {
        const a = -0.9 + (i / 10) * 1.8;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2 + r() * 1.6, 1.1), m);
        slab.position.y = 0.4;
        slab.rotation.z = -a * 0.5;
        add(slab, lx + Math.sin(a) * 7.5, lz + Math.cos(a) * 7.5 - 7.5, a);
      }
      break;
    }
    case "canyons": {
      // two mesa walls with a gap you could drive a van through
      const m = rock(16, 0.5, 0.24);
      for (const s of [-1, 1]) {
        const mesa = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 5.5 + r() * 2, 6), m);
        mesa.position.y = 3;
        add(mesa, lx + s * 5.5, lz + s * 1.5, r() * 3);
      }
      break;
    }
    case "ice": {
      // a single blue arch — an ice bridge that survived the shelf
      const mat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, 195, 0.35, 0.72), flatShading: true, transparent: true, opacity: 0.9 });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.75, 5, 14, Math.PI), mat);
      arch.position.y = 0.2;
      add(arch, lx, lz, r() * 1.2);
      break;
    }
    case "desert": {
      // three leaning monoliths — the only vertical thing for miles
      const m = rock(32, 0.35, 0.42);
      for (let i = 0; i < 3; i++) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(1.1 + r(), 5 + r() * 3, 0.9), m);
        sl.position.y = 2.8;
        const h = add(sl, lx + (i - 1) * 2.6 + r(), lz + (r() - 0.5) * 2.4, r() * 3);
        h.rotateX((r() - 0.5) * 0.22); h.rotateZ((r() - 0.5) * 0.22);
      }
      break;
    }
    case "seas":
    case "archipelago": {
      // an islet with one improbable tree on it, offshore
      const isl = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), rock(45, 0.4, 0.42));
      isl.scale.y = 0.42; isl.position.y = 0.1;
      const h = add(isl, lx, lz, 0);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 5), rock(28, 0.4, 0.24));
      trunk.position.set(0.3, 1.7, 0); trunk.rotation.z = 0.16; h.add(trunk);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), rock(120, 0.45, 0.34));
      top.position.set(0.6, 3.4, 0); h.add(top);
      break;
    }
    case "mountains": {
      // one peak that out-scales the whole world, with a snow cap
      const peak = new THREE.Mesh(new THREE.ConeGeometry(4.6, 9, 6), rock(25, 0.2, 0.3));
      peak.position.y = 4.5;
      const h = add(peak, lx, lz, r() * 3);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.6, 6), rock(0, 0, 0.94));
      cap.position.y = 7.7; h.add(cap);
      break;
    }
    case "hills": {
      // a lone tree-line: five bushy cones on a rise
      for (let i = 0; i < 5; i++) {
        const tr = new THREE.Mesh(new THREE.ConeGeometry(1.1 + r() * 0.5, 3 + r() * 2, 6), rock(105 + r() * 25, 0.45, 0.28));
        tr.position.y = 1.8;
        add(tr, lx + (i - 2) * 2.3 + (r() - 0.5), lz + (r() - 0.5) * 3, 0);
      }
      break;
    }
    default: return null;
  }

  return {
    group,
    update(dt) {
      t += dt || 0;
      if (glowMat) glowMat.opacity = 0.7 + Math.sin(t * 1.7) * 0.15;   // the lava breathes
    },
  };
}

// ---- SKY BODIES ---------------------------------------------------------------
// The landed sky was pure black plus the persistent starfield, which is why every
// planet's establishing shot looked like the same planet. A moon (sometimes two,
// sometimes ringed) fixes the sky to THIS world, costs three meshes, and gives the
// auto-camera's wide shots something to frame against. Parented high above the band
// and slowly rotating; never lit by the stage rig (MeshBasic — they are far away).
export function makeSkyBodies(THREE, traits, seed, radius) {
  const group = new THREE.Object3D();
  group.name = "skybodies";
  const r = rng32(((seed | 0) ^ 0x3b9aca07) >>> 0);
  const pal = (traits && traits.palette) || {};
  const skin = pal.skin || { h: 200, s: 0.5, l: 0.5 };
  const acc = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const D = clamp((radius || 20) * 3.4, 55, 150);           // well outside the sky dome's band
  const nMoons = 1 + (r() < 0.45 ? 1 : 0);

  for (let i = 0; i < nMoons; i++) {
    const moon = new THREE.Object3D();
    const rad = (i === 0 ? 5.5 + r() * 4 : 2.6 + r() * 2);
    const hue = i === 0 ? skin.h + 40 + r() * 60 : acc.h + r() * 40;
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rad, 1),
      new THREE.MeshBasicMaterial({ color: colHSL(THREE, hue, 0.22 + r() * 0.2, 0.42 + r() * 0.2) }));
    // a crescent read for free: a slightly larger black sphere offset behind it
    const shade = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rad * 1.02, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    shade.position.set(rad * (0.5 + r() * 0.5), rad * 0.2, -rad * 0.35);
    moon.add(body); moon.add(shade);
    // A RING, sometimes. A ringed moon over an alien band is worth three meshes.
    if (i === 0 && r() < 0.5) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rad * 1.5, rad * 2.3, 32),
        new THREE.MeshBasicMaterial({
          color: colHSL(THREE, hue + 30, 0.3, 0.55), side: THREE.DoubleSide,
          transparent: true, opacity: 0.42, depthWrite: false }));
      ring.rotation.x = Math.PI / 2 - (0.25 + r() * 0.35);
      ring.rotation.z = r() * 0.7;
      moon.add(ring);
    }
    const az = (i === 0 ? -0.7 : 1.1) + (r() - 0.5) * 0.8;
    const el = 0.34 + r() * 0.34;
    moon.position.set(Math.sin(az) * Math.cos(el) * D, Math.sin(el) * D, -Math.cos(az) * Math.cos(el) * D);
    moon.userData.spin = (r() - 0.5) * 0.05;
    group.add(moon);
  }

  return {
    group,
    update(dt) {
      for (const m of group.children) m.rotation.y += (m.userData.spin || 0) * (dt || 0);
    },
  };
}

export default { makeSignage, makeStageKit, makeLandmark, makeSkyBodies };

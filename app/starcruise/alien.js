// alien.js — Build phase. ONE band-member alien (or a background DANCER) as a
// THREE.Object3D + an update(dt, beatPhase) that grooves and, for players, lands
// its playing limb's contact ON the beat. Everything is procedural + asset-free:
// a low-poly segmented body with a real FACE (mouth that opens on the beat, brow,
// snout/nostrils/vents, eyes), gently WAVING eyestalks, THREE-SEGMENT arms
// (shoulder+elbow+wrist+hand) on a hand-rolled IK skeleton, a small procedural
// CanvasTexture skin motif chosen by genre, bold per-alien colour contrast, and a
// procedural INVENTED INSTRUMENT (member.instrument.family) held/faced by the
// alien. The designated member.appendage PLAYS the instrument in time — its hand
// tip snaps to the instrument's contact point at each beat sub-division
// (member.hitsPerBeat sub-hits per beat) — while the rest of the body grooves per
// traits.groove. All meshes are lit (Lambert) and cast/receive shadows so the
// controller's key light MODELS the forms (no more flat fill). Distinct playStyles
// read distinct (strike down, pluck a string, draw a bow, raise+blow a horn).
//
// CONTRACT
//   makeAlien(THREE, traits, member, seed) -> { group, update(dt, beatPhase) }
//     traits = the TRAITS object from traits.js
//     member = one entry of traits.band[] (role + instrument{family,playStyle,appendage,hitsPerBeat})
//              role may be 'drum'|'bass'|'lead'|'pad'|'perc'|'dancer'.
//              role 'dancer' == NO instrument, a full-body dancer that grooves.
//     seed   = integer; same inputs -> same alien
//     update(dt, beatPhase): beatPhase 0..1 within the current beat. hitsPerBeat
//       sub-hits divide the beat; the playing limb contacts the instrument at each
//       sub-division boundary (subPhase 0 == the hit), the rest grooves. Eyestalks
//       and antennae wave continuously (beat-independent); the mouth opens on the
//       pulse (widest for the 'lead' vocalist).
//   Also exposed for headless proof (not required by the contract):
//     .debug() -> { playStyle, hitsPerBeat, handTip, contact, dist } (alien-local)

// tiny seeded PRNG so the alien is deterministic without importing traits.
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function colHSL(THREE, c) {
  const col = new THREE.Color();
  col.setHSL((((((c && c.h) || 0) % 360) + 360) % 360) / 360,
    c && c.s != null ? c.s : 0.5, c && c.l != null ? c.l : 0.5);
  return col;
}

// A tiny, reused procedural skin texture keyed by traits.texture. 64x64, drawn on a
// CanvasTexture, tiled — cheap and shared across a single alien's body surfaces so
// forms aren't flat. Light base (keeps the alien bright) with a low-opacity motif.
// Deterministic: the only randomness (the 'static' motif) flows through `rand`.
function makeSkinTexture(THREE, kind, rand) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const S = 64;
  const cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d"); if (!g) return null;
  g.fillStyle = "#c9c9d2"; g.fillRect(0, 0, S, S);       // light base -> keeps colour bright
  const dk = "rgba(30,26,44,0.30)", lt = "rgba(255,255,255,0.22)";
  if (kind === "stripe") {
    g.fillStyle = dk; for (let x = 0; x < S; x += 12) g.fillRect(x, 0, 6, S);
  } else if (kind === "scale") {
    g.strokeStyle = dk; g.lineWidth = 2;
    for (let y = 0; y <= S; y += 12) for (let x = 0; x <= S; x += 14) {
      g.beginPath(); g.arc(x + (Math.floor(y / 12) % 2 ? 7 : 0), y, 7, 0, Math.PI); g.stroke();
    }
  } else if (kind === "spot") {
    g.fillStyle = dk;
    for (let y = 8; y < S; y += 16) for (let x = 8; x < S; x += 16) {
      g.beginPath(); g.arc(x + (Math.floor(y / 16) % 2 ? 8 : 0), y, 4, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === "gradient") {
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, lt); grd.addColorStop(1, dk);
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  } else if (kind === "static") {
    for (let i = 0; i < 520; i++) {
      g.fillStyle = rand() < 0.5 ? dk : lt;
      g.fillRect((rand() * S) | 0, (rand() * S) | 0, 2, 2);
    }
  } else {                                                 // "plate": subtle panel lines
    g.strokeStyle = "rgba(30,26,44,0.16)"; g.lineWidth = 1;
    for (let x = 0; x < S; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
    for (let y = 0; y < S; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export function makeAlien(THREE, traits, member, seed) {
  seed = (seed | 0) || 1;
  const rand = rng32(seed ^ 0xa53c9);

  traits = traits || {};
  member = member || { role: "perc", instrument: { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 } };
  const roleName = member.role || "perc";
  const isDancer = roleName === "dancer";
  const inst = member.instrument || { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 };
  const playStyle = isDancer ? "dance" : (inst.playStyle || "strike");
  const hitsPerBeat = Math.max(1, Math.round(inst.hitsPerBeat || 1));
  // how much this alien "sings" — the mouth gapes widest for the lead vocalist.
  const sing = roleName === "lead" ? 1.0 : isDancer ? 0.6 : roleName === "pad" ? 0.5 : 0.35;

  const pal = traits.palette || {};
  const body = Object.assign({
    massH: 1, height: 1.5, limbs: 4, eyes: 2, segments: 2,
    bodyShape: "segmented", armLength: 1, eyeStalk: 0.2, neck: 0.15,
    antennae: 1, crestType: "fin", asymmetry: 0.2,
  }, traits.body || {});
  const groove = Object.assign({ bounce: 0.4, sway: 0.3, headbob: 0.4, energy: 0.5 }, traits.groove || {});
  const face = Object.assign({ mouth: "maw", brow: "ridge", snout: "nostrils", teeth: false, mouthWide: 0.4 }, traits.face || {});
  const chrome = traits.skin === "chrome";
  const glow = Math.max(0, Math.min(1, traits.glow || 0));

  const H = Math.max(0.8, body.height);
  const massW = 0.55 * Math.max(0.5, body.massH);      // torso half-width scale
  const nArms = Math.max(2, Math.min(6, Math.round(body.limbs)));
  const nEyes = Math.max(1, Math.min(4, Math.round(body.eyes)));
  const nSeg = Math.max(1, Math.min(4, Math.round(body.segments)));
  // NEW morphology knobs (all deterministic, from traits.body).
  const bodyShape = body.bodyShape || "segmented";
  const armLenMul = Math.max(0.6, Math.min(3, body.armLength || 1));    // long-arm multiplier
  const eyeStalk = Math.max(0, Math.min(1, body.eyeStalk || 0));        // 0=flush, 1=long stalk
  const neckLen = Math.max(0, Math.min(1, body.neck || 0)) * H * 0.34;  // absolute neck length
  const nAnt = Math.max(0, Math.min(3, Math.round(body.antennae || 0)));
  const crestType = body.crestType || "none";
  const asym = Math.max(0, Math.min(1, body.asymmetry || 0));

  // ---- shared, LIT + shadowed materials (bold contrast) --------------------------
  // Bodies get the procedural texture map (so surfaces read modelled, not flat);
  // accents stay untextured so they POP. Limbs are a darker value than the torso,
  // and a COMPLEMENTARY accent2 (hue+180) trims teeth/beads for extra contrast.
  const skinTex = makeSkinTexture(THREE, traits.texture || "plate", rand);
  const mk = (col, textured) => new THREE.MeshLambertMaterial({
    color: col, flatShading: true, map: textured ? skinTex : null,
    emissive: (glow > 0.05 ? col.clone().multiplyScalar(0.16 * glow) : new THREE.Color(0, 0, 0)),
  });
  const skinCol = colHSL(THREE, pal.skin || { h: 200, s: 0.5, l: chrome ? 0.62 : 0.5 });
  const clothCol = colHSL(THREE, pal.cloth || { h: 340, s: 0.5, l: 0.45 });
  const accentCol = colHSL(THREE, pal.accent || { h: 40, s: 0.85, l: 0.6 });
  // push contrast: brighten the brights, darken the darks.
  const bodyCol = skinCol.clone().offsetHSL(0, 0.05, 0.08);        // torso a touch brighter
  const clothLit = clothCol.clone().offsetHSL(0, 0.05, 0.06);
  const limbCol = skinCol.clone().multiplyScalar(chrome ? 0.62 : 0.5);  // limbs noticeably darker
  const accentBright = accentCol.clone().offsetHSL(0, 0.05, 0.08);
  const accent2Col = accentCol.clone().offsetHSL(0.5, 0.0, 0.05);       // complementary trim
  const skinMat = mk(bodyCol, true);
  const clothMat = mk(clothLit, true);
  const limbMat = mk(limbCol, true);
  const accentMat = mk(accentBright, false);
  const accent2Mat = mk(accent2Col, false);
  const eyeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x07070d), emissive: accentBright.clone().multiplyScalar(0.6), flatShading: true });
  const mouthMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x18080f), flatShading: true });
  const bodyDark = skinCol.clone().multiplyScalar(chrome ? 0.7 : 0.55);
  const instBodyMat = mk(bodyDark, false);
  const materials = [skinMat, clothMat, limbMat, accentMat, accent2Mat, eyeMat, mouthMat, instBodyMat];

  const group = new THREE.Object3D();

  // ---- body proportions ---------------------------------------------------------
  const hipY = H * 0.42, shoulderY = H * 0.72;
  const torsoMidY = (hipY + shoulderY) / 2, torsoH = shoulderY - hipY;

  // TORSO — one of five feature-chosen silhouettes (traits.body.bodyShape). All
  // low-poly, flat-shaded and cheap; each alternates cloth/skin where it has parts.
  function buildTorso(shape) {
    if (shape === "triangle") {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(massW * 1.9, torsoH * 1.06, 5), clothMat);
      cone.position.y = torsoMidY; cone.rotation.x = Math.PI; cone.rotation.y = Math.PI / 5; group.add(cone);
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(massW * 3.2, torsoH * 0.22, massW * 1.2), skinMat);
      yoke.position.y = shoulderY - torsoH * 0.08; group.add(yoke);
    } else if (shape === "wedge") {
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(massW * 1.35, massW * 1.7, torsoH * 1.02, 3), clothMat);
      prism.position.y = torsoMidY; prism.rotation.y = Math.PI; group.add(prism);
      const chest = new THREE.Mesh(new THREE.CylinderGeometry(massW * 0.9, massW * 1.2, torsoH * 0.42, 3), skinMat);
      chest.position.y = shoulderY - torsoH * 0.2; group.add(chest);
    } else if (shape === "tower") {
      const segs = 3;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const y0 = hipY + torsoH * t0, y1 = hipY + torsoH * t1, w = massW * (1.15 - 0.15 * t0);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w, (y1 - y0) * 0.94, w * 0.8),
          s % 2 === 0 ? clothMat : skinMat);
        seg.position.y = (y0 + y1) / 2; group.add(seg);
      }
    } else if (shape === "blob") {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(massW * 1.3, 0), clothMat);
      blob.position.y = torsoMidY; blob.scale.set(1, (torsoH / (massW * 2.6)) * 1.6, 0.85); group.add(blob);
      const collar = new THREE.Mesh(new THREE.IcosahedronGeometry(massW * 0.7, 0), skinMat);
      collar.position.y = shoulderY - torsoH * 0.06; collar.scale.set(1, 0.6, 0.85); group.add(collar);
    } else {
      for (let s = 0; s < nSeg; s++) {
        const t0 = s / nSeg, t1 = (s + 1) / nSeg;
        const y0 = hipY + torsoH * t0, y1 = hipY + torsoH * t1, taper = 1 - 0.25 * t0;
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(massW * 2 * taper, (y1 - y0) * 0.98, massW * 1.3 * taper),
          s % 2 === 0 ? clothMat : skinMat);
        seg.position.y = (y0 + y1) / 2; group.add(seg);
      }
    }
  }
  buildTorso(bodyShape);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(massW * 2.1, H * 0.12, massW * 1.4), clothMat);
  hips.position.y = hipY; group.add(hips);

  // ---- neck + head (front = +Z, toward the cockpit camera) ----------------------
  const headSz = H * 0.24;
  const headY = shoulderY + neckLen + headSz * 0.5;
  if (neckLen > headSz * 0.12) {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(headSz * 0.2, headSz * 0.28, neckLen + headSz * 0.2, 5), skinMat);
    neck.position.y = shoulderY + neckLen * 0.5; group.add(neck);
  }
  const head = new THREE.Object3D(); head.position.y = headY; group.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(headSz, headSz, headSz), skinMat);
  head.add(skull);

  // things that wave CONTINUOUSLY (independent of the beat): eyestalks + antennae.
  const wobblers = [];

  // EYES — flush on the face, or on slim swaying EYESTALKS when body.eyeStalk is high.
  const stalkLen = eyeStalk * headSz * 2.4;
  const onStalks = stalkLen > headSz * 0.35;
  for (let e = 0; e < nEyes; e++) {
    const spread = nEyes === 1 ? 0 : (e / (nEyes - 1) - 0.5) * headSz * (onStalks ? 1.0 : 0.6);
    if (onStalks) {
      const stalk = new THREE.Object3D();
      stalk.position.set(spread, headSz * 0.35, headSz * 0.2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(headSz * 0.05, headSz * 0.06, stalkLen, 4), limbMat);
      rod.position.y = stalkLen * 0.5; stalk.add(rod);
      const ball = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.28, headSz * 0.28, headSz * 0.28), eyeMat);
      ball.position.y = stalkLen; stalk.add(ball);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.12, headSz * 0.12, headSz * 0.06), accentMat);
      pupil.position.set(0, stalkLen, headSz * 0.15); stalk.add(pupil);   // bright pupil -> pops
      const bz = (-spread * 0.9) / (headSz || 1), bx = -0.5 + asym * 0.5 * (e % 2 ? 1 : -1);
      stalk.rotation.z = bz; stalk.rotation.x = bx;
      head.add(stalk);
      wobblers.push({ obj: stalk, bx, bz, ph: rand() * 6.28, sp: 1.5 + rand() * 1.6, amp: 0.18 + rand() * 0.1 });
    } else {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.24, headSz * 0.24, headSz * 0.13), eyeMat);
      eye.position.set(spread, headSz * 0.1, headSz * 0.52);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.1, headSz * 0.1, headSz * 0.06), accentMat);
      pupil.position.set(spread, headSz * 0.1, headSz * 0.6); head.add(pupil);
    }
  }

  // ---- FACE: brow ridge, mouth (opens on the beat), snout/nostrils/vents ---------
  const faceZ = headSz * 0.5;   // the front plane of the skull
  // BROW — angular V (glitch), soft mound (washy), or a straight ridge.
  if (face.brow === "angular") {
    for (let s = -1; s <= 1; s += 2) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.42, headSz * 0.1, headSz * 0.12), accent2Mat);
      b.position.set(s * headSz * 0.2, headSz * 0.26, faceZ - headSz * 0.02);
      b.rotation.z = -s * 0.5; head.add(b);                 // meet in a downward V
    }
  } else if (face.brow === "soft") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.7, headSz * 0.12, headSz * 0.14), skinMat);
    b.position.set(0, headSz * 0.27, faceZ - headSz * 0.02); b.scale.y = 0.8; head.add(b);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.72, headSz * 0.1, headSz * 0.12), limbMat);
    b.position.set(0, headSz * 0.27, faceZ - headSz * 0.02); head.add(b);
  }

  // SNOUT / NOSTRILS / VENTS — the nose motif.
  if (face.snout === "snout") {
    const sn = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.18, headSz * 0.3, 4), skinMat);
    sn.rotation.x = Math.PI / 2; sn.position.set(0, headSz * 0.0, faceZ + headSz * 0.12); head.add(sn);
    for (let s = -1; s <= 1; s += 2) {
      const no = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.05, headSz * 0.05, headSz * 0.05), mouthMat);
      no.position.set(s * headSz * 0.06, headSz * 0.0, faceZ + headSz * 0.26); head.add(no);
    }
  } else if (face.snout === "nostrils") {
    for (let s = -1; s <= 1; s += 2) {
      const no = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.06, headSz * 0.09, headSz * 0.05), mouthMat);
      no.position.set(s * headSz * 0.08, headSz * 0.05, faceZ + headSz * 0.02); head.add(no);
    }
  } else {   // vents — angled accent slots (electronic)
    for (let s = -1; s <= 1; s += 2) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.04, headSz * 0.18, headSz * 0.04), accent2Mat);
      v.position.set(s * headSz * 0.14, headSz * 0.04, faceZ); v.rotation.z = s * 0.35; head.add(v);
    }
  }

  // MOUTH — an upper lip (fixed) + a lower JAW that DROPS on the beat. Three motifs:
  // maw (fleshy jaw), beak (two hinged cones), grille (barred plates). Optional fangs.
  const mouthY = -headSz * 0.2;
  const jaw = new THREE.Object3D(); jaw.position.set(0, mouthY, faceZ - headSz * 0.02); head.add(jaw);
  const jawBaseY = mouthY;
  if (face.mouth === "beak") {
    const up = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.2, headSz * 0.34, 4), accentMat);
    up.rotation.x = Math.PI / 2; up.position.set(0, headSz * 0.08, faceZ + headSz * 0.08); head.add(up);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.17, headSz * 0.26, 4), accentMat);
    lo.rotation.x = Math.PI / 2; lo.position.set(0, -headSz * 0.02, headSz * 0.08); jaw.add(lo);
  } else if (face.mouth === "grille") {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.5, headSz * 0.06, headSz * 0.06), accent2Mat);
    lip.position.set(0, headSz * 0.2, faceZ - headSz * 0.02); head.add(lip);
    for (let k = 0; k < 3; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.5, headSz * 0.03, headSz * 0.05), accent2Mat);
      bar.position.set(0, -headSz * (0.02 + k * 0.05), headSz * 0.0); jaw.add(bar);
    }
  } else {   // maw — a fleshy box jaw
    const lip = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.5, headSz * 0.06, headSz * 0.08), mouthMat);
    lip.position.set(0, headSz * 0.2, faceZ - headSz * 0.02); head.add(lip);
    const jbox = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.5, headSz * 0.14, headSz * 0.1), mouthMat);
    jbox.position.set(0, -headSz * 0.04, headSz * 0.0); jaw.add(jbox);
  }
  if (face.teeth) {
    for (let k = 0; k < 4; k++) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.03, headSz * 0.1, 3), accent2Mat);
      fang.position.set((k - 1.5) * headSz * 0.12, headSz * 0.12, faceZ + headSz * 0.02); fang.rotation.x = Math.PI; head.add(fang);
    }
  }

  // ANTENNAE — slim rods with an accent bead, fanned + gently swaying.
  for (let a = 0; a < nAnt; a++) {
    const ax = nAnt === 1 ? 0 : (a / (nAnt - 1) - 0.5) * headSz * 0.5;
    const antLen = headSz * (0.55 + rand() * 0.6);
    const ant = new THREE.Object3D();
    ant.position.set(ax, headSz * 0.5, -headSz * 0.05);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(headSz * 0.03, headSz * 0.04, antLen, 4), limbMat);
    rod.position.y = antLen * 0.5; ant.add(rod);
    const bead = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.13, headSz * 0.13, headSz * 0.13), accentMat);
    bead.position.y = antLen; ant.add(bead);
    const bz = (ax * 2.5) / (headSz || 1);
    ant.rotation.z = bz;
    head.add(ant);
    wobblers.push({ obj: ant, bx: 0, bz, ph: rand() * 6.28, sp: 2.0 + rand() * 1.6, amp: 0.08 + rand() * 0.06 });
  }
  // CREST — feature-chosen head ridge.
  if (crestType === "spikes") {
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.12, headSz * 0.5, 4), accentMat);
      sp.position.set((k - 1) * headSz * 0.22, headSz * 0.62, 0); head.add(sp);
    }
  } else if (crestType === "fin") {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.3, headSz * 0.72, 4), accentMat);
    fin.position.y = headSz * 0.72; fin.scale.z = 0.25; head.add(fin);
  } else if (crestType === "frill") {
    const frill = new THREE.Mesh(
      new THREE.CylinderGeometry(headSz * 0.62, headSz * 0.22, headSz * 0.12, 7, 1, true), accentMat);
    frill.position.set(0, headSz * 0.34, -headSz * 0.24); frill.rotation.x = 0.7; head.add(frill);
  }

  // ---- 3-SEGMENT IK limb factory ------------------------------------------------
  // A limb = upper bone (shoulder->elbow) + fore bone (elbow->wrist) + palm bone
  // (wrist->hand tip) + a hand/foot cap AT the tip. solve() runs a 2-bone law-of-
  // cosines IK to place the elbow + TIP from a target (the tip EQUALS the reachable
  // target — that is what keeps the playing hand exactly on the beat contact), then
  // inserts a WRIST joint a fixed fraction along the fore->tip run so the limb reads
  // as three articulated segments. The bend plane is fixed by a pole hint.
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _wrist = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  const WRIST_FRAC = 0.62;   // wrist sits 62% from elbow toward the hand tip
  function placeBone(mesh, a, b) {
    const dir = _v1.subVectors(b, a); const len = dir.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(YAX, _v2.copy(dir).multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }
  function makeLimb(rootPos, poleDir, L1, L2, width, mat, capMat) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(width, 1, width), mat);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 1, width * 0.82), mat);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 1, width * 0.7), mat);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, width * 1.15, width * 1.5), capMat || skinMat);
    group.add(upper); group.add(fore); group.add(palm); group.add(cap);
    const root = rootPos.clone(), pole = poleDir.clone().normalize();
    const elbow = new THREE.Vector3(), tip = new THREE.Vector3();
    function solve(target) {
      const toT = _v3.subVectors(target, root);
      let d = toT.length();
      const maxD = (L1 + L2) * 0.999, minD = Math.abs(L1 - L2) + 1e-3;
      d = Math.min(maxD, Math.max(minD, d));
      const n = _v4.copy(toT).setLength(d);        // clamped target offset
      tip.copy(root).add(n);                        // hand tip (== target when reachable)
      let c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      c = Math.min(1, Math.max(-1, c));
      const ang = Math.acos(c);
      const ndir = _v4.setLength(1);                // unit toward target
      let axis = _v5.crossVectors(ndir, pole);
      if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); else axis.normalize();
      const upperDir = _v1.copy(ndir).applyAxisAngle(axis, ang);
      elbow.copy(root).addScaledVector(upperDir, L1);
      _wrist.copy(elbow).lerp(tip, WRIST_FRAC);     // the third joint
      placeBone(upper, root, elbow);
      placeBone(fore, elbow, _wrist);
      placeBone(palm, _wrist, tip);
      cap.position.copy(tip);
      return tip;
    }
    return { root, solve, tip, upper, fore, palm, cap };
  }

  // LONG ARMS: bone lengths scale with body.armLength; the contact point below is
  // derived from this same armReach, so however long the arms get the playing hand
  // still lands ON the instrument on the beat. Arms slim as they lengthen.
  const armL1 = H * 0.2 * armLenMul, armL2 = H * 0.22 * armLenMul, armReach = armL1 + armL2;
  const armW = massW * 0.34 * Math.max(0.6, 1.15 - armLenMul * 0.18);
  const legL1 = H * 0.22, legL2 = H * 0.22, legW = massW * 0.42;

  const playerIdx = isDancer ? -1 : (((inst.appendage | 0) % nArms) + nArms) % nArms;
  const holderIdx = (!isDancer && nArms >= 2) ? (playerIdx + 1) % nArms : -1;
  const stringed = playStyle === "pluck" || playStyle === "bow";
  const arms = [];
  for (let i = 0; i < nArms; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const tier = Math.floor(i / 2);
    const sx = side * (massW + armW * 0.6) * (1 + asym * 0.18 * side);
    const sy = shoulderY - tier * armW * 1.6 - asym * armW * 0.9 * i;
    const pole = new THREE.Vector3(side * 0.4, 0.9, -0.6);   // elbow up/back
    const a = makeLimb(new THREE.Vector3(sx, sy, 0), pole, armL1, armL2, armW, limbMat, skinMat);
    a.side = side; a.shoulderY = sy;
    a.rest = new THREE.Vector3(sx * 1.05, sy - armReach * 0.7, massW * 0.4);   // relaxed hang
    arms.push(a);
  }
  const legs = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const hx = side * massW * 0.55;
    const pole = new THREE.Vector3(0, -0.2, 1);   // knees bend forward
    const l = makeLimb(new THREE.Vector3(hx, hipY, 0), pole, legL1, legL2, legW, limbMat, clothMat);
    l.side = side; l.hx = hx;
    legs.push(l);
  }

  // ---- procedural INVENTED INSTRUMENT (players only) ----------------------------
  function buildInstrument(family, style) {
    const g = new THREE.Object3D();
    const body2 = instBodyMat, acc = accentMat;
    if (family === "thumpdrum" || style === "drum") {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.16, H * 0.18, H * 0.28, 8), body2);
      drum.position.y = -H * 0.16; g.add(drum);
      const headTop = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.165, H * 0.165, H * 0.02, 8), acc);
      g.add(headTop);
    } else if (family === "clackshell" || style === "strike") {
      for (let k = 0; k < 3; k++) {
        const shell = new THREE.Mesh(new THREE.BoxGeometry(H * 0.1, H * 0.03, H * 0.14), k === 0 ? acc : body2);
        shell.position.set((k - 1) * H * 0.11, -k * H * 0.02, 0);
        shell.rotation.z = (k - 1) * 0.3; g.add(shell);
      }
    } else if (family === "buzzstring" || (stringed && style === "pluck")) {
      const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(H * 0.26, H * 0.34, H * 0.07), body2);
      bodyBox.position.set(0, -H * 0.16, 0); g.add(bodyBox);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(H * 0.05, H * 0.5, H * 0.05), instBodyMat);
      neck.position.set(H * 0.02, H * 0.22, 0); neck.rotation.z = -0.2; g.add(neck);
      for (let s = 0; s < 3; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.006, H * 0.5, H * 0.006), acc);
        str.position.set((s - 1) * H * 0.03, H * 0.08, H * 0.04); str.rotation.z = -0.2; g.add(str);
      }
    } else if (family === "bloopharp") {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(H * 0.22, H * 0.02, 4, 8, Math.PI), body2);
      frame.rotation.z = -Math.PI / 2; g.add(frame);
      for (let s = 0; s < 5; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.005, H * 0.36, H * 0.005), acc);
        str.position.set((s - 2) * H * 0.05, 0, 0); g.add(str);
      }
    } else if (family === "glasspad" || style === "bow") {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(H * 0.4, H * 0.24, H * 0.04), body2);
      slab.position.y = -H * 0.02; g.add(slab);
      for (let s = 0; s < 4; s++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(H * 0.02, H * 0.26, H * 0.05), acc);
        bar.position.set((s - 1.5) * H * 0.1, 0, H * 0.01); g.add(bar);
      }
      const bow = new THREE.Mesh(new THREE.BoxGeometry(H * 0.36, H * 0.012, H * 0.012), acc);
      bow.position.set(0, 0, H * 0.06); g.add(bow); g._bow = bow;
    } else if (family === "wailhorn" || style === "blow") {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.03, H * 0.03, H * 0.34, 6), instBodyMat);
      tube.rotation.z = Math.PI / 2; tube.position.set(H * 0.14, 0, 0); g.add(tube);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(H * 0.12, H * 0.16, 8, 1, true), acc);
      bell.rotation.z = -Math.PI / 2; bell.position.set(H * 0.34, 0, 0); g.add(bell);
      const valves = new THREE.Mesh(new THREE.BoxGeometry(H * 0.06, H * 0.08, H * 0.06), acc);
      g.add(valves);
    } else {
      const blob = new THREE.Mesh(new THREE.BoxGeometry(H * 0.2, H * 0.2, H * 0.2), acc);
      g.add(blob);
    }
    return g;
  }

  // contact point (alien-local) + the playing rig — PLAYERS ONLY.
  let contact = null, instrument = null, bow = null, holdPoint = null;
  const _tgt = new THREE.Vector3(), _rest = new THREE.Vector3();
  let windup = 0, bowAmp = 0;
  if (!isDancer) {
    const pShoulder = arms[playerIdx].root;
    contact = new THREE.Vector3();
    const instTilt = new THREE.Euler();
    const REACH = armReach * 0.8;
    const put = (dx, dy, dz) => { contact.set(dx, dy, dz).normalize().multiplyScalar(REACH).add(pShoulder); };
    if (playStyle === "strike" || playStyle === "drum") {
      put(-0.2, -0.75, 0.7);
    } else if (playStyle === "pluck") {
      put(-0.3, -0.45, 0.85); instTilt.set(0, 0, 0.15);
    } else if (playStyle === "bow") {
      put(-0.1, -0.3, 0.95);
    } else if (playStyle === "blow") {
      put(-0.1, 0.55, 0.6); instTilt.set(0, 0, -0.35);
    } else {
      put(-0.2, -0.4, 0.85);
    }
    instrument = buildInstrument(inst.family, playStyle);
    instrument.position.copy(contact);
    instrument.rotation.copy(instTilt);
    group.add(instrument);
    bow = instrument._bow || null;
    holdPoint = new THREE.Vector3(contact.x + massW * 0.2, contact.y + armReach * 0.4, contact.z);

    const baseReach = H * 0.42;
    windup = baseReach * 0.55 * (0.7 + 0.3 * armLenMul);
    bowAmp = baseReach * 0.42;
  }

  let clock = 0;

  // the player hand's target for a given sub-phase (0..1 within a sub-hit) — it
  // EQUALS `contact` at subPhase 0 (the HIT) and winds away between hits.
  function playerTarget(subPhase) {
    _tgt.copy(contact);
    const away = Math.sin(subPhase * Math.PI);
    if (playStyle === "strike" || playStyle === "drum") {
      _tgt.y += away * windup;
      _tgt.z -= away * windup * 0.25;
    } else if (playStyle === "pluck") {
      _tgt.x += arms[playerIdx].side * away * windup * 0.5;
      _tgt.z += away * windup * 0.35;
    } else if (playStyle === "bow") {
      const slide = Math.sin(subPhase * Math.PI * 2) * bowAmp;
      _tgt.x += slide; _tgt.y += slide * 0.12;
    } else if (playStyle === "blow") {
      _tgt.y -= away * windup * 0.35;
      _tgt.z += away * windup * 0.2;
    } else {
      _tgt.y += away * windup * 0.6;
    }
    return _tgt;
  }

  function update(dt, beatPhase) {
    dt = dt || 0; clock += dt;
    if (beatPhase == null) beatPhase = clock % 1;
    beatPhase = ((beatPhase % 1) + 1) % 1;
    const energy = groove.energy || 0.5;
    const bob = (1 - Math.cos(beatPhase * Math.PI * 2)) * 0.5;   // 0..1, min at the beat

    // WAVING STALKS + antennae — a soft continuous sine, independent of the beat.
    for (const w of wobblers) {
      w.obj.rotation.x = w.bx + Math.sin(clock * w.sp + w.ph) * w.amp;
      w.obj.rotation.z = w.bz + Math.cos(clock * w.sp * 0.8 + w.ph) * w.amp * 0.7;
    }

    // MOUTH — opens on the pulse (widest at the beat), biggest for the lead vocalist.
    const pulse = 0.5 + 0.5 * Math.cos(beatPhase * Math.PI * 2);
    const open = Math.min(1, (face.mouthWide || 0.4) * 0.3 + sing * 0.6 * pulse);
    jaw.position.y = jawBaseY - open * headSz * 0.22;
    jaw.rotation.x = open * 0.5;

    if (isDancer) {
      // DANCER — no instrument; a livelier full-body groove locked to the beat.
      group.position.y = -bob * 0.11 * (0.6 + (groove.bounce || 0.4)) * H;
      group.rotation.z = Math.sin(clock * (1.6 + energy)) * 0.14 * (0.6 + (groove.sway || 0.3));
      group.rotation.y = Math.sin(clock * 0.9) * 0.26;
      head.rotation.x = -0.1 + bob * 0.35 * (groove.headbob || 0.4);
      head.rotation.y = Math.sin(clock * 1.8) * 0.2;
      for (const l of legs) { _rest.set(l.hx, hipY - legL1 - legL2 + bob * 0.16 * H, massW * 0.15); l.solve(_rest); }
      for (let i = 0; i < arms.length; i++) {
        const a = arms[i]; _rest.copy(a.rest);
        const lift = 0.5 + 0.5 * Math.sin(clock * (2 + energy) + i * 1.7);
        _rest.y += lift * armReach * 0.7 + bob * 0.05 * H;
        _rest.x += a.side * (0.2 + 0.3 * lift) * H * 0.3 + Math.sin(clock * 2.2 + i) * 0.05 * H;
        _rest.z += 0.2 * H * lift;
        a.solve(_rest);
      }
      return;
    }

    // PLAYER GROOVE: musical bob locked to the beat + a slower idle sway.
    group.position.y = -bob * 0.09 * (groove.bounce || 0.4) * H;
    group.rotation.z = Math.sin(clock * (1.2 + energy)) * 0.05 * (groove.sway || 0.3);
    group.rotation.y = Math.sin(clock * 0.7) * 0.04 * (groove.sway || 0.3);
    head.rotation.x = -0.12 + bob * 0.3 * (groove.headbob || 0.4);
    head.rotation.y = Math.sin(clock * 1.6) * 0.12 * (groove.headbob || 0.4);

    for (const l of legs) { _rest.set(l.hx, hipY - legL1 - legL2 + bob * 0.12 * H, massW * 0.15); l.solve(_rest); }
    if (playStyle === "blow") group.rotation.x = -0.12 - bob * 0.05;

    // PLAYER ARM: hit ON the beat.
    const subPhase = (beatPhase * hitsPerBeat) % 1;
    const pArm = arms[playerIdx];
    const ptip = pArm.solve(playerTarget(subPhase));
    if (bow) { bow.position.x = (ptip.x - contact.x); bow.position.y = (ptip.y - contact.y); }
    if (stringed && holderIdx >= 0 && holderIdx !== playerIdx) arms[holderIdx].solve(holdPoint);

    for (let i = 0; i < arms.length; i++) {
      if (i === playerIdx) continue;
      if (stringed && i === holderIdx) continue;
      const a = arms[i];
      _rest.copy(a.rest);
      _rest.x += Math.sin(clock * (1.4 + energy) + i) * 0.05 * H;
      _rest.y += bob * 0.05 * H + Math.sin(clock * 2 + i) * 0.02 * H;
      a.solve(_rest);
    }
  }

  // headless-proof accessor: player hand tip vs the true contact (alien-local).
  function debug() {
    const t = (playerIdx >= 0 ? arms[playerIdx] : arms[0]).tip;
    const c = contact || t;
    return {
      playStyle, hitsPerBeat,
      handTip: { x: t.x, y: t.y, z: t.z },
      contact: { x: c.x, y: c.y, z: c.z },
      dist: contact ? t.distanceTo(contact) : 0,
    };
  }

  // SHADOWS + modelling: every mesh casts and receives the controller's key light
  // so forms show clear light-to-dark falloff instead of flat fill.
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  update(0, 0);   // pose once so the very first frame is non-blank.

  return { group, update, debug, materials, playStyle, hitsPerBeat };
}

export default { makeAlien };

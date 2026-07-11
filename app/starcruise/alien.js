// alien.js — Build phase. ONE band-member alien as a THREE.Object3D + an
// update(dt, beatPhase) that grooves and lands its playing limb's contact ON the
// beat. Everything is procedural + asset-free: a low-poly segmented body, arms,
// legs and eyes derived from traits.body, a hand-rolled 2-bone IK skeleton, and a
// procedural INVENTED INSTRUMENT (member.instrument.family) held/faced by the
// alien. The designated member.appendage PLAYS the instrument in time — its hand
// tip snaps to the instrument's contact point at each beat sub-division
// (member.hitsPerBeat sub-hits per beat) — while the rest of the body grooves per
// traits.groove. Distinct playStyles read distinct (strike down, pluck a string,
// draw a bow, raise+blow a horn). Flat/vertex-lit low-poly for the PS1 look;
// postfx adds the dither/warp.
//
// CONTRACT
//   makeAlien(THREE, traits, member, seed) -> { group, update(dt, beatPhase) }
//     traits = the TRAITS object from traits.js
//     member = one entry of traits.band[] (role + instrument{family,playStyle,appendage,hitsPerBeat})
//     seed   = integer; same inputs -> same alien
//     update(dt, beatPhase): beatPhase 0..1 within the current beat. hitsPerBeat
//       sub-hits divide the beat; the playing limb contacts the instrument at each
//       sub-division boundary (subPhase 0 == the hit), the rest grooves.
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

export function makeAlien(THREE, traits, member, seed) {
  seed = (seed | 0) || 1;
  const rand = rng32(seed ^ 0xa53c9);

  traits = traits || {};
  member = member || { role: "perc", instrument: { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 } };
  const inst = member.instrument || { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 };
  const playStyle = inst.playStyle || "strike";
  const hitsPerBeat = Math.max(1, Math.round(inst.hitsPerBeat || 1));

  const pal = traits.palette || {};
  const body = Object.assign({
    massH: 1, height: 1.5, limbs: 4, eyes: 2, segments: 2,
    bodyShape: "segmented", armLength: 1, eyeStalk: 0.2, neck: 0.15,
    antennae: 1, crestType: "fin", asymmetry: 0.2,
  }, traits.body || {});
  const groove = Object.assign({ bounce: 0.4, sway: 0.3, headbob: 0.4, energy: 0.5 }, traits.groove || {});
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

  // ---- shared flat materials (PS1 look) -----------------------------------------
  const mk = (col) => new THREE.MeshLambertMaterial({
    color: col, flatShading: true,
    emissive: (glow > 0.05 ? col.clone().multiplyScalar(0.18 * glow) : new THREE.Color(0, 0, 0)),
  });
  const skinCol = colHSL(THREE, pal.skin || { h: 200, s: 0.5, l: chrome ? 0.62 : 0.5 });
  const clothCol = colHSL(THREE, pal.cloth || { h: 340, s: 0.5, l: 0.45 });
  const accentCol = colHSL(THREE, pal.accent || { h: 40, s: 0.85, l: 0.6 });
  const skinMat = mk(skinCol);
  const clothMat = mk(clothCol);
  const accentMat = mk(accentCol);
  const eyeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x0a0a12), emissive: accentCol.clone().multiplyScalar(0.5), flatShading: true });
  const bodyDark = skinCol.clone().multiplyScalar(chrome ? 0.7 : 0.55);
  const instBodyMat = mk(bodyDark);
  const materials = [skinMat, clothMat, accentMat, eyeMat, instBodyMat];

  const group = new THREE.Object3D();

  // ---- body proportions ---------------------------------------------------------
  const hipY = H * 0.42, shoulderY = H * 0.72;
  const torsoMidY = (hipY + shoulderY) / 2, torsoH = shoulderY - hipY;

  // TORSO — one of five feature-chosen silhouettes (traits.body.bodyShape). All
  // low-poly, flat-shaded and cheap; each alternates cloth/skin where it has parts.
  function buildTorso(shape) {
    if (shape === "triangle") {
      // wide-shoulder inverted cone: apex DOWN at the waist, broad up top.
      const cone = new THREE.Mesh(new THREE.ConeGeometry(massW * 1.9, torsoH * 1.06, 5), clothMat);
      cone.position.y = torsoMidY; cone.rotation.x = Math.PI; cone.rotation.y = Math.PI / 5; group.add(cone);
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(massW * 3.2, torsoH * 0.22, massW * 1.2), skinMat);
      yoke.position.y = shoulderY - torsoH * 0.08; group.add(yoke);      // broad shoulder yoke
    } else if (shape === "wedge") {
      // angular 3-sided prism (a tapering wedge) — robotic / glitchy.
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(massW * 1.35, massW * 1.7, torsoH * 1.02, 3), clothMat);
      prism.position.y = torsoMidY; prism.rotation.y = Math.PI; group.add(prism);
      const chest = new THREE.Mesh(new THREE.CylinderGeometry(massW * 0.9, massW * 1.2, torsoH * 0.42, 3), skinMat);
      chest.position.y = shoulderY - torsoH * 0.2; group.add(chest);
    } else if (shape === "tower") {
      // spindly stacked slabs — tall and narrow.
      const segs = 3;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const y0 = hipY + torsoH * t0, y1 = hipY + torsoH * t1, w = massW * (1.15 - 0.15 * t0);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w, (y1 - y0) * 0.94, w * 0.8),
          s % 2 === 0 ? clothMat : skinMat);
        seg.position.y = (y0 + y1) / 2; group.add(seg);
      }
    } else if (shape === "blob") {
      // low-poly rounded body (icosahedron), squashed to a torso.
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(massW * 1.3, 0), clothMat);
      blob.position.y = torsoMidY; blob.scale.set(1, (torsoH / (massW * 2.6)) * 1.6, 0.85); group.add(blob);
      const collar = new THREE.Mesh(new THREE.IcosahedronGeometry(massW * 0.7, 0), skinMat);
      collar.position.y = shoulderY - torsoH * 0.06; collar.scale.set(1, 0.6, 0.85); group.add(collar);
    } else {
      // segmented (default): nSeg boxes stacked hip->shoulder, tapering + alternating cloth.
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
  // hips (shared across all shapes)
  const hips = new THREE.Mesh(new THREE.BoxGeometry(massW * 2.1, H * 0.12, massW * 1.4), clothMat);
  hips.position.y = hipY; group.add(hips);

  // ---- neck + head + eyes (front = +Z, toward the cockpit camera) ---------------
  const headSz = H * 0.24;
  const headY = shoulderY + neckLen + headSz * 0.5;
  // NECK — a slim column from the shoulders up to the head (long for slow/washy).
  if (neckLen > headSz * 0.12) {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(headSz * 0.2, headSz * 0.28, neckLen + headSz * 0.2, 5), skinMat);
    neck.position.y = shoulderY + neckLen * 0.5; group.add(neck);
  }
  const head = new THREE.Object3D(); head.position.y = headY; group.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(headSz, headSz, headSz), skinMat);
  head.add(skull);
  // EYES — flush on the face, or on slim EYESTALKS when body.eyeStalk is high.
  const stalkLen = eyeStalk * headSz * 2.4;
  const onStalks = stalkLen > headSz * 0.35;
  for (let e = 0; e < nEyes; e++) {
    const spread = nEyes === 1 ? 0 : (e / (nEyes - 1) - 0.5) * headSz * (onStalks ? 1.0 : 0.6);
    if (onStalks) {
      const stalk = new THREE.Object3D();
      stalk.position.set(spread, headSz * 0.35, headSz * 0.2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(headSz * 0.05, headSz * 0.06, stalkLen, 4), skinMat);
      rod.position.y = stalkLen * 0.5; stalk.add(rod);
      const ball = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.26, headSz * 0.26, headSz * 0.26), eyeMat);
      ball.position.y = stalkLen; stalk.add(ball);
      stalk.rotation.z = (-spread * 0.9) / (headSz || 1);                 // splay outward
      stalk.rotation.x = -0.5 + asym * 0.5 * (e % 2 ? 1 : -1);           // asym staggers stalk angle
      head.add(stalk);
    } else {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.22, headSz * 0.22, headSz * 0.12), eyeMat);
      eye.position.set(spread, headSz * 0.08, headSz * 0.52);
      head.add(eye);
    }
  }
  // ANTENNAE — slim rods with an accent bead, fanned from the crown.
  for (let a = 0; a < nAnt; a++) {
    const ax = nAnt === 1 ? 0 : (a / (nAnt - 1) - 0.5) * headSz * 0.5;
    const antLen = headSz * (0.55 + rand() * 0.6);
    const ant = new THREE.Object3D();
    ant.position.set(ax, headSz * 0.5, -headSz * 0.05);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(headSz * 0.03, headSz * 0.04, antLen, 4), skinMat);
    rod.position.y = antLen * 0.5; ant.add(rod);
    const bead = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.12, headSz * 0.12, headSz * 0.12), accentMat);
    bead.position.y = antLen; ant.add(bead);
    ant.rotation.z = (ax * 2.5) / (headSz || 1);                          // fan outward
    head.add(ant);
  }
  // CREST — feature-chosen head ridge (was a random cone; now driven by crestType).
  if (crestType === "spikes") {
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.12, headSz * 0.5, 4), accentMat);
      sp.position.set((k - 1) * headSz * 0.22, headSz * 0.62, 0); head.add(sp);
    }
  } else if (crestType === "fin") {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.3, headSz * 0.72, 4), accentMat);
    fin.position.y = headSz * 0.72; fin.scale.z = 0.25; head.add(fin);    // thin blade fin
  } else if (crestType === "frill") {
    const frill = new THREE.Mesh(
      new THREE.CylinderGeometry(headSz * 0.62, headSz * 0.22, headSz * 0.12, 7, 1, true), accentMat);
    frill.position.set(0, headSz * 0.34, -headSz * 0.24); frill.rotation.x = 0.7; head.add(frill);
  }

  // ---- 2-bone IK limb factory ---------------------------------------------------
  // A limb = upper bone (shoulder->elbow) + lower bone (elbow->hand) + a hand cap.
  // solve() writes the elbow/hand positions (alien-local) from a target, using the
  // law of cosines; the bend plane is fixed by a pole hint so the joint never flips.
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  function placeBone(mesh, a, b) {
    const dir = _v1.subVectors(b, a); const len = dir.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(YAX, _v2.copy(dir).multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }
  function makeLimb(rootPos, poleDir, L1, L2, width, mat) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(width, 1, width), mat);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 1, width * 0.82), mat);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, width * 1.2, width * 1.5), skinMat);
    group.add(upper); group.add(lower); group.add(hand);
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
      placeBone(upper, root, elbow);
      placeBone(lower, elbow, tip);
      hand.position.copy(tip);
      return tip;
    }
    return { root, solve, tip, upper, lower, hand };
  }

  // LONG ARMS: the bone lengths scale with body.armLength. The player's contact
  // point (below) is derived from this same armReach, so however long the arms get
  // the playing hand still lands ON the instrument on the beat. Arms slim as they
  // lengthen for a spindly reach.
  const armL1 = H * 0.2 * armLenMul, armL2 = H * 0.22 * armLenMul, armReach = armL1 + armL2;
  const armW = massW * 0.34 * Math.max(0.6, 1.15 - armLenMul * 0.18);
  const legL1 = H * 0.22, legL2 = H * 0.22, legW = massW * 0.42;

  // arms fan around the torso top; player arm reaches the instrument.
  const playerIdx = (((inst.appendage | 0) % nArms) + nArms) % nArms;
  const holderIdx = nArms >= 2 ? (playerIdx + 1) % nArms : -1;
  const stringed = playStyle === "pluck" || playStyle === "bow";
  const arms = [];
  for (let i = 0; i < nArms; i++) {
    const side = i % 2 === 0 ? 1 : -1;             // alternate right/left
    const tier = Math.floor(i / 2);
    // asymmetry lifts one side / staggers successive arms so limbs sit lopsided.
    const sx = side * (massW + armW * 0.6) * (1 + asym * 0.18 * side);
    const sy = shoulderY - tier * armW * 1.6 - asym * armW * 0.9 * i;
    const pole = new THREE.Vector3(side * 0.4, 0.9, -0.6);   // elbow up/back
    const a = makeLimb(new THREE.Vector3(sx, sy, 0), pole, armL1, armL2, armW, skinMat);
    a.side = side; a.shoulderY = sy;
    a.rest = new THREE.Vector3(sx * 1.05, sy - armReach * 0.7, massW * 0.4);   // relaxed hang
    arms.push(a);
  }
  // legs
  const legs = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const hx = side * massW * 0.55;
    const pole = new THREE.Vector3(0, -0.2, 1);   // knees bend forward
    const l = makeLimb(new THREE.Vector3(hx, hipY, 0), pole, legL1, legL2, legW, clothMat);
    l.side = side; l.hx = hx;
    legs.push(l);
  }

  // ---- procedural INVENTED INSTRUMENT (contact at the group's local origin) ------
  // buildInstrument returns a THREE.Object3D whose CONTACT point (where the playing
  // hand lands) sits at its local (0,0,0). The alien positions that origin at the
  // reachable contact point; IK then targets it.
  function buildInstrument(family, style) {
    const g = new THREE.Object3D();
    const body2 = instBodyMat, acc = accentMat;
    if (family === "thumpdrum" || style === "drum") {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.16, H * 0.18, H * 0.28, 8), body2);
      drum.position.y = -H * 0.16; g.add(drum);
      const headTop = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.165, H * 0.165, H * 0.02, 8), acc);
      g.add(headTop);                              // the struck head, at origin
    } else if (family === "clackshell" || style === "strike") {
      for (let k = 0; k < 3; k++) {
        const shell = new THREE.Mesh(new THREE.BoxGeometry(H * 0.1, H * 0.03, H * 0.14), k === 0 ? acc : body2);
        shell.position.set((k - 1) * H * 0.11, -k * H * 0.02, 0);
        shell.rotation.z = (k - 1) * 0.3; g.add(shell);
      }
    } else if (family === "buzzstring" || (stringed && style === "pluck")) {
      // a bass: teardrop body below, long neck up-back, strings at origin.
      const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(H * 0.26, H * 0.34, H * 0.07), body2);
      bodyBox.position.set(0, -H * 0.16, 0); g.add(bodyBox);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(H * 0.05, H * 0.5, H * 0.05), instBodyMat);
      neck.position.set(H * 0.02, H * 0.22, 0); neck.rotation.z = -0.2; g.add(neck);
      for (let s = 0; s < 3; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.006, H * 0.5, H * 0.006), acc);
        str.position.set((s - 1) * H * 0.03, H * 0.08, H * 0.04); str.rotation.z = -0.2; g.add(str);
      }
    } else if (family === "bloopharp") {
      // an arc frame with strings across it.
      const frame = new THREE.Mesh(new THREE.TorusGeometry(H * 0.22, H * 0.02, 4, 8, Math.PI), body2);
      frame.rotation.z = -Math.PI / 2; g.add(frame);
      for (let s = 0; s < 5; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.005, H * 0.36, H * 0.005), acc);
        str.position.set((s - 2) * H * 0.05, 0, 0); g.add(str);
      }
    } else if (family === "glasspad" || style === "bow") {
      // a slab of vertical bars you draw a bow across.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(H * 0.4, H * 0.24, H * 0.04), body2);
      slab.position.y = -H * 0.02; g.add(slab);
      for (let s = 0; s < 4; s++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(H * 0.02, H * 0.26, H * 0.05), acc);
        bar.position.set((s - 1.5) * H * 0.1, 0, H * 0.01); g.add(bar);
      }
      // the bow, held by the player hand at origin.
      const bow = new THREE.Mesh(new THREE.BoxGeometry(H * 0.36, H * 0.012, H * 0.012), acc);
      bow.position.set(0, 0, H * 0.06); g.add(bow); g._bow = bow;
    } else if (family === "wailhorn" || style === "blow") {
      // a bent tube flaring into a bell; valves (origin) held near the mouth.
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.03, H * 0.03, H * 0.34, 6), instBodyMat);
      tube.rotation.z = Math.PI / 2; tube.position.set(H * 0.14, 0, 0); g.add(tube);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(H * 0.12, H * 0.16, 8, 1, true), acc);
      bell.rotation.z = -Math.PI / 2; bell.position.set(H * 0.34, 0, 0); g.add(bell);
      const valves = new THREE.Mesh(new THREE.BoxGeometry(H * 0.06, H * 0.08, H * 0.06), acc);
      g.add(valves);                               // at origin = contact
    } else {
      const blob = new THREE.Mesh(new THREE.BoxGeometry(H * 0.2, H * 0.2, H * 0.2), acc);
      g.add(blob);
    }
    return g;
  }

  // contact point (alien-local) — placed at shoulder + a per-style unit direction
  // scaled to 0.8*reach so the hand can actually touch it (windup then clamps past
  // it, which is why the hand snaps to it only AT the hit). Front = +Z.
  const pShoulder = arms[playerIdx].root;
  const contact = new THREE.Vector3();
  const instTilt = new THREE.Euler();
  const REACH = armReach * 0.8;
  const put = (dx, dy, dz) => {
    contact.set(dx, dy, dz).normalize().multiplyScalar(REACH).add(pShoulder);
  };
  if (playStyle === "strike" || playStyle === "drum") {
    put(-0.2, -0.75, 0.7);                                  // drum low in front
  } else if (playStyle === "pluck") {
    put(-0.3, -0.45, 0.85); instTilt.set(0, 0, 0.15);       // bass across the body
  } else if (playStyle === "bow") {
    put(-0.1, -0.3, 0.95);                                  // slab out front
  } else if (playStyle === "blow") {
    put(-0.1, 0.55, 0.6); instTilt.set(0, 0, -0.35);        // horn raised toward the head
  } else {
    put(-0.2, -0.4, 0.85);
  }
  const instrument = buildInstrument(inst.family, playStyle);
  instrument.position.copy(contact);
  instrument.rotation.copy(instTilt);
  group.add(instrument);
  const bow = instrument._bow || null;

  // a neck-hold point for stringed instruments (up the neck from contact).
  const holdPoint = new THREE.Vector3(contact.x + massW * 0.2, contact.y + armReach * 0.4, contact.z);

  // windup distances are keyed to the BASE (unstretched) reach so the stroke stays
  // crisp however long the arms grow — the hand still lands exactly ON contact at
  // the sub-hit boundary, and the near-boundary error stays inside the beat-hit
  // tolerance for every genre. windup gains only a mild bonus from long arms; the
  // bow slide is body-scaled (it draws across the fixed-size slab, not the arm).
  const baseReach = H * 0.42;                                // reach at armLength==1
  const windup = baseReach * 0.55 * (0.7 + 0.3 * armLenMul);
  const bowAmp = baseReach * 0.42;

  // scratch for targets so update() allocates nothing.
  const _tgt = new THREE.Vector3(), _rest = new THREE.Vector3();
  let clock = 0;

  // the player hand's target for a given sub-phase (0..1 within a sub-hit) — it
  // EQUALS `contact` at subPhase 0 (the HIT) and winds away between hits, in a way
  // that reads distinct per playStyle.
  function playerTarget(subPhase) {
    _tgt.copy(contact);
    const away = Math.sin(subPhase * Math.PI);           // 0 at the hit, 1 mid-sub
    if (playStyle === "strike" || playStyle === "drum") {
      _tgt.y += away * windup;                            // raise up, snap down
      _tgt.z -= away * windup * 0.25;
    } else if (playStyle === "pluck") {
      _tgt.x += arms[playerIdx].side * away * windup * 0.5;   // pull off the string
      _tgt.z += away * windup * 0.35;
    } else if (playStyle === "bow") {
      const slide = Math.sin(subPhase * Math.PI * 2) * bowAmp;   // draw across (in contact)
      _tgt.x += slide; _tgt.y += slide * 0.12;
    } else if (playStyle === "blow") {
      _tgt.y -= away * windup * 0.35;                     // lower the horn between hits
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

    // GROOVE: musical bob locked to the beat + a slower idle sway.
    const bob = (1 - Math.cos(beatPhase * Math.PI * 2)) * 0.5;      // 0..1, min at the beat
    group.position.y = -bob * 0.09 * (groove.bounce || 0.4) * H;
    group.rotation.z = Math.sin(clock * (1.2 + energy)) * 0.05 * (groove.sway || 0.3);
    group.rotation.y = Math.sin(clock * 0.7) * 0.04 * (groove.sway || 0.3);
    head.rotation.x = -0.12 + bob * 0.3 * (groove.headbob || 0.4);
    head.rotation.y = Math.sin(clock * 1.6) * 0.12 * (groove.headbob || 0.4);

    // legs: knees flex with the bob so the body squats on the downbeat.
    for (const l of legs) {
      _rest.set(l.hx, hipY - legL1 - legL2 + bob * 0.12 * H, massW * 0.15);
      l.solve(_rest);
    }

    // horn players lean back a touch on the pulse.
    if (playStyle === "blow") group.rotation.x = -0.12 - bob * 0.05;

    // PLAYER ARM: hit ON the beat. Divide the beat into hitsPerBeat sub-hits; the
    // hand tip reaches `contact` at each sub-division boundary (subPhase 0).
    const subPhase = (beatPhase * hitsPerBeat) % 1;
    const pArm = arms[playerIdx];
    const ptip = pArm.solve(playerTarget(subPhase));

    // the bow mesh tracks the drawing hand so you see the stroke.
    if (bow) { bow.position.x = (ptip.x - contact.x); bow.position.y = (ptip.y - contact.y); }

    // HOLDER ARM (stringed): cradles the neck; adds a two-handed silhouette.
    if (stringed && holderIdx >= 0 && holderIdx !== playerIdx) arms[holderIdx].solve(holdPoint);

    // IDLE ARMS: relaxed sway so the whole body grooves, not just the player.
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

  // headless-proof accessor: player hand tip vs the true contact, in alien-local
  // space (both transform with the group, so local distance == world distance).
  function debug() {
    const t = arms[playerIdx].tip;
    return {
      playStyle, hitsPerBeat,
      handTip: { x: t.x, y: t.y, z: t.z },
      contact: { x: contact.x, y: contact.y, z: contact.z },
      dist: t.distanceTo(contact),
    };
  }

  update(0, 0);   // pose once so the very first frame is non-blank.

  return { group, update, debug, materials, playStyle, hitsPerBeat };
}

export default { makeAlien };

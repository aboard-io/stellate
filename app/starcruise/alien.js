// alien.js — Build phase. ONE band-member alien (or a background DANCER) as a
// THREE.Object3D + an update(dt, ctx) that PLAYS THE SCORE. Each alien is a
// genuinely NON-HUMAN creature — a radial N-fold star, a cephalopod tentacle-
// cluster, an insectoid, an amorphous blob, a stalk-cluster, a crystalline stack
// or a floating-gas sac — with 0..N appendages, a wild FACE family (one giant
// eye / a ring of eyes / a maw / mandibles) and an INVENTED organic INSTRUMENT
// (pulsing membrane-sac, coiled resonator, crystal chime-cluster, tendril-harp,
// bladder-horn) — NOT a realistic drum/guitar. Everything is procedural +
// asset-free + low-poly + mobile-cheap (reused materials, capped tendril segs).
//
// The designated appendage PLAYS its voice's REAL NOTES: update(dt, ctx) triggers
// a strike/pluck/bow/blow CONTACT on each note ONSET in ctx.notes (syncopation
// shows — contacts land at the actual note times, not a uniform beat). When the
// voice is silent / quiet / faded (no notes, or level <= ~0.05, or playing false)
// the alien RESTS: it lowers the instrument, idles and sways, and does NOT
// fake-strike. Note pitch biases the contact position along the instrument.
//
// CONTRACT
//   makeAlien(THREE, traits, member, seed) -> { group, update(dt, ctx), ... }
//     traits = the TRAITS object from traits.js
//              traits.body may be the NEW plan shape
//                { plan, symmetry, arms, legs, tentacles, eyes, face:{...}, ... }
//              OR the older { massH,height,limbs,eyes,segments,bodyShape,... }
//              shape — this module resolves a body plan from EITHER (deterministic).
//     member = one entry of traits.band[]:
//              { role, voice, instrument:{ family, playStyle, appendage, hitsPerBeat } }
//              role may be 'drum'|'bass'|'lead'|'pad'|'melody'|'perc'|'found'|'dancer'.
//              role 'dancer' == NO instrument, a full-body creature that grooves.
//     seed   = integer; same inputs -> same alien
//   update(dt, ctx):
//     ctx (SCORE MODE) = {
//        barPhase : 0..1 position within the CURRENT bar,
//        playing  : bool  — is member.voice sounding this bar,
//        level    : 0..1  — this voice's dynamics (fade/section level),
//        notes    : [{ t (0..1 in bar), pitch, dur, vel }] — onsets for this voice,
//     }
//     ctx as a NUMBER (or null) == the OLD beat-only FALLBACK: it is a beatPhase
//     0..1 within a beat, and the appendage hits on the hitsPerBeat sub-grid — so
//     the controller's legacy `a.update(dt, beatPhase)` path still animates.
//   Return: { group, update, debug, materials, playStyle, hitsPerBeat, voice }.
//
//   debug() -> { playStyle, contactness, handTip, contact, target, dist, reachDist }
//     (alien-local) — headless proof of onset-timed contact vs rest.

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
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const smooth01 = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

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

  // ---- PER-ALIEN morphology jitter (deterministic off THIS alien's OWN seed) ------
  // Two band members (or dancers) of the SAME genre share traits (the species
  // family) but must never be identical. These draws are consumed HERE — before any
  // dancer/player divergence — so a dancer & a player built from one seed stay
  // rand-aligned, yet every INDIVIDUAL nudges its PROPORTIONS, appendage/eye COUNTS,
  // orb count and accent hue so it reads unique — still inside the genre's family.
  const jSpan = (s) => 1 + (rand() * 2 - 1) * s;          // ~1 ± s multiplier
  const jPick = (p) => (rand() < p ? 1 : 0);              // deterministic 0/1 draw
  const morphH = jSpan(0.17), morphMass = jSpan(0.24), morphR = jSpan(0.12);
  const eyeJit = jPick(0.5) - jPick(0.35);                // -1..+1 eye-count nudge
  const armJit = jPick(0.45);                             // +0/+1 extra arm
  const appJit = jPick(0.5) - jPick(0.4);                 // -1..+1 legs/tentacles
  const accentSpin = (rand() * 2 - 1) * 22;               // per-alien accent hue shift °
  const orbJit = jPick(0.6) + jPick(0.35);                // +0..2 extra light-balls

  traits = traits || {};
  member = member || { role: "perc", voice: "perc", instrument: { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 } };
  const roleName = member.role || "perc";
  const isDancer = roleName === "dancer";
  const inst = member.instrument || { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 };
  const playStyle = isDancer ? "dance" : (inst.playStyle || "strike");
  const hitsPerBeat = Math.max(1, Math.round(inst.hitsPerBeat || 1));
  // voice id this alien "is in charge of" (drums/bass/lead/pad/melody/perc/found).
  // Prefer an explicit member.voice; else map the role to the engine voice family.
  const ROLE_VOICE = { drum: "drums", bass: "bass", lead: "lead", pad: "pad", melody: "melody", perc: "perc", found: "found" };
  const voice = member.voice || ROLE_VOICE[roleName] || roleName;
  // how much this alien "sings" — the mouth gapes widest for the lead vocalist.
  const sing = roleName === "lead" || roleName === "melody" ? 1.0 : isDancer ? 0.6 : roleName === "pad" ? 0.5 : 0.35;
  // sustained voices HOLD contact across a note (bow/blow/pad); impulse voices
  // strike a momentary contact then recoil (strike/drum/pluck).
  const sustained = playStyle === "bow" || playStyle === "blow";

  const pal = traits.palette || {};
  const bIn = traits.body || {};
  const groove = Object.assign({ bounce: 0.4, sway: 0.3, headbob: 0.4, energy: 0.5 }, traits.groove || {});
  const glow = clamp(traits.glow || 0, 0, 1);
  const chrome = traits.skin === "chrome";

  // ---- BODY PLAN resolution (NON-HUMAN) -----------------------------------------
  // The body plan is the top-level silhouette DECISION. Read traits.body.plan when
  // the traits agent supplies the new shape; otherwise DERIVE a plan from the older
  // body fields so this module works against either traits.js. Plans:
  //   radial      — N-fold star: a central core, N arms spoked radially, eye ring
  //   cephalopod  — a bulbous mantle over a cluster of long curling tentacles
  //   insectoid   — a segmented thorax on many thin splayed legs, mandible face
  //   blob        — an amorphous pulsing mass with stubby pseudopods, one maw
  //   stalk       — a cluster of tall swaying stalks, eyes on stalk-tips
  //   crystalline — a stack of angular glowing crystal prisms, shard limbs
  //   gas         — floating translucent sacs that bob, wispy tendrils
  function derivePlan(b) {
    const shape = b.bodyShape;
    if (shape === "blob") return "blob";
    if (shape === "tower") return "stalk";
    if (shape === "triangle") return "radial";
    if (shape === "wedge") return "crystalline";
    if (shape === "segmented") return (Math.round(b.limbs || 4) >= 5) ? "insectoid" : "cephalopod";
    // no legacy shape either — pick from massH/height so it is still deterministic.
    const h = b.height || 1.5, m = b.massH || 1;
    if (m > 1.5) return "radial";
    if (h > 2.4) return "stalk";
    return "cephalopod";
  }
  const PLANS = ["radial", "cephalopod", "insectoid", "blob", "stalk", "crystalline", "gas"];
  let plan = bIn.plan;
  if (!plan || PLANS.indexOf(plan) < 0) plan = derivePlan(bIn);

  const H = Math.max(0.9, (bIn.height || 1.5) * morphH);
  const massH = Math.max(0.5, (bIn.massH || 1) * morphMass);
  const coreR = 0.5 * H * (0.32 + massH * 0.14) * morphR; // core radius, girth from massH (+per-alien)
  // appendage counts — new fields first, else derive from legacy limbs/eyes.
  const legacyLimbs = Math.round(bIn.limbs != null ? bIn.limbs : 4);
  let nArms = Math.round(bIn.arms != null ? bIn.arms : legacyLimbs);
  nArms = clamp(nArms, 2, 6);
  const symMetry = clamp(Math.round(bIn.symmetry || (plan === "radial" ? nArms : 2)), 2, 8);
  if (plan === "radial") nArms = clamp(symMetry, 3, 6);
  else nArms = clamp(nArms + armJit, 2, 6);              // per-alien: maybe one extra arm
  let nLegs = Math.round(bIn.legs != null ? bIn.legs : (plan === "insectoid" ? 6 : plan === "stalk" ? 3 : plan === "crystalline" ? 3 : 0));
  let nTent = Math.round(bIn.tentacles != null ? bIn.tentacles : (plan === "cephalopod" ? Math.max(4, nArms + 2) : plan === "gas" ? 4 : plan === "blob" ? 3 : 0));
  // per-alien nudge on whichever sway-appendage this plan actually grows.
  nLegs = clamp(nLegs + (nTent === 0 ? appJit : 0), 0, 8);
  nTent = clamp(nTent + (nTent > 0 ? appJit : 0), 0, 8);
  if (nLegs + nTent > 8) nTent = Math.max(0, 8 - nLegs);   // mobile appendage cap
  const nEyes = clamp(Math.round(bIn.eyes != null ? bIn.eyes : 2) + eyeJit, 1, 8);
  const asym = clamp(bIn.asymmetry || 0, 0, 1);

  // FACE family — new body.face.type first, else derive a wild face from eye count
  // + the legacy mouth motif so a swing face still differs from a glitch face.
  const faceIn = bIn.face || traits.face || {};
  let faceKind = faceIn.type;
  if (!faceKind) {
    if (nEyes === 1) faceKind = "oneEye";
    else if (nEyes >= 4) faceKind = "eyeRing";
    else if ((traits.face && traits.face.mouth) === "beak") faceKind = "mandibles";
    else faceKind = "maw";
  }
  const faceWide = faceIn.mouthWide != null ? faceIn.mouthWide : (traits.face && traits.face.mouthWide) || 0.4;

  // ---- RENDER STYLE (the genre's visual LANGUAGE, from traits.renderStyle) --------
  // PRESERVED verbatim: traits.renderStyle.material picks how EVERY surface shades.
  // Defaults to 'flat' (flat-lit Lambert). All six treatments keep light response +
  // shadows. Materials are built ONCE per style and reused across the whole alien.
  const style = (traits.renderStyle && traits.renderStyle.material) || "flat";
  const wire = style === "wireframe";
  const smoothShade = style === "matte";
  const glitchTime = { value: 0 };

  let celGrad = null;
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  const IRID_GLSL = [
    "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
    "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
    "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.85);",
  ].join("\n");
  const GLITCH_VERT = [
    "float _burst = step(0.86, fract(uTime * 0.7));",
    "transformed.x += sin(uTime * 13.0 + transformed.y * 20.0 + transformed.x * 7.0) * (0.006 + 0.03 * _burst);",
    "transformed.z += cos(uTime * 17.0 + transformed.y * 14.0) * (0.004 + 0.02 * _burst);",
  ].join("\n");
  const GLITCH_FRAG = [
    "float _fl = step(0.8, fract(uTime * 0.7 + 0.3));",
    "outgoingLight.r += 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 40.0));",
    "outgoingLight.b -= 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 37.0));",
  ].join("\n");
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

  // ---- shared, LIT + shadowed materials (bold contrast) — PRESERVED --------------
  const skinTex = makeSkinTexture(THREE, traits.texture || "plate", rand);
  const mk = (col, textured) => {
    const emissive = (glow > 0.05 ? col.clone().multiplyScalar(0.16 * glow) : new THREE.Color(0, 0, 0));
    let m;
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: col, map: textured ? skinTex : null, emissive, gradientMap: celGrad });
      m.flatShading = true;
    } else {
      m = new THREE.MeshLambertMaterial({
        color: col, flatShading: !smoothShade, map: textured ? skinTex : null, wireframe: wire, emissive,
      });
      if (smoothShade) m.emissive = emissive.clone().add(col.clone().multiplyScalar(0.1));
    }
    return applyStyleHook(m);
  };
  const skinCol = colHSL(THREE, pal.skin || { h: 200, s: 0.5, l: chrome ? 0.62 : 0.5 });
  const clothCol = colHSL(THREE, pal.cloth || { h: 340, s: 0.5, l: 0.45 });
  // per-alien accent hue SPIN + a saturation push -> individual, saturated pop.
  const accentCol = colHSL(THREE, pal.accent || { h: 40, s: 0.85, l: 0.6 }).offsetHSL(accentSpin / 360, 0.06, 0);
  const bodyCol = skinCol.clone().offsetHSL(0, 0.05, 0.08);
  const clothLit = clothCol.clone().offsetHSL(0, 0.05, 0.06);
  const limbCol = skinCol.clone().multiplyScalar(chrome ? 0.62 : 0.5);
  const accentBright = accentCol.clone().offsetHSL(0, 0.05, 0.08);
  const accent2Col = accentCol.clone().offsetHSL(0.5, 0.0, 0.05);
  const skinMat = mk(bodyCol, true);
  const clothMat = mk(clothLit, true);
  const limbMat = mk(limbCol, true);
  const accentMat = mk(accentBright, false);
  const accent2Mat = mk(accent2Col, false);
  const eyeMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x07070d), emissive: accentBright.clone().multiplyScalar(0.9), flatShading: !smoothShade }));
  const mouthMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x18080f), flatShading: !smoothShade }));
  const bodyDark = skinCol.clone().multiplyScalar(chrome ? 0.7 : 0.55);
  const instBodyMat = mk(bodyDark, false);
  // GLOWING LIGHT-BALL material: a near-black core swamped by a bright saturated
  // emissive -> a ball of light. Deep-dark body vs blazing orb = bold contrast.
  const mkOrb = (col) => applyStyleHook(new THREE.MeshLambertMaterial({
    color: new THREE.Color(0x0a0a12), emissive: col.clone(), wireframe: wire, flatShading: !smoothShade,
  }));
  const orbMat = mkOrb(accentBright.clone().offsetHSL(0, 0.12, 0.14));
  const materials = [skinMat, clothMat, limbMat, accentMat, accent2Mat, eyeMat, mouthMat, instBodyMat, orbMat];

  const group = new THREE.Object3D();

  // continuously-waving parts (tentacles/stalks/cilia/antennae) — beat-independent.
  const tendrils = [];      // { joints:[Object3D], sp, amp, ph, curl, sway }
  const pulseCores = [];    // { mesh, base:Vector3(scale), amp } — blob/gas breathing
  const orbs = [];          // { mesh, base:Vector3, ph, amp } — floating light-balls
  const YAX = new THREE.Vector3(0, 1, 0);

  // ---- a soft multi-segment TENDRIL (nested rotation chain) ----------------------
  // Cheap organic appendage: a chain of tapering cylinders that WAVES via a
  // traveling sine on each joint. Used for tentacles, stalks, cilia, gas wisps —
  // and (curled at rest) idle NON-player arms. Capped segment count for mobile.
  function makeTendril(rootPos, dir, segLen, nSeg, width, mat, capMat, opts) {
    opts = opts || {};
    nSeg = clamp(Math.round(nSeg), 2, 4);
    const rootObj = new THREE.Object3D();
    rootObj.position.copy(rootPos);
    rootObj.quaternion.setFromUnitVectors(YAX, dir.clone().normalize());
    group.add(rootObj);
    const joints = [];
    let parent = rootObj;
    for (let s = 0; s < nSeg; s++) {
      const j = new THREE.Object3D();
      if (s > 0) j.position.y = segLen;
      parent.add(j);
      const w = width * (1 - 0.5 * (s / nSeg));
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.42, segLen, 5), mat);
      seg.position.y = segLen * 0.5; j.add(seg);
      joints.push(j); parent = j;
    }
    const capW = width * 0.55;
    // DE-SQUARE: tips are rounded knobs, eye-globes or claw-cones — never a cube.
    let capGeo;
    if (opts.tip === "eye") capGeo = new THREE.SphereGeometry(capW, 7, 6);
    else if (opts.tip === "claw") capGeo = new THREE.ConeGeometry(capW * 0.72, capW * 2.4, 5);
    else capGeo = new THREE.SphereGeometry(capW * 1.05, 6, 5);
    const cap = new THREE.Mesh(capGeo, capMat || mat);
    cap.position.y = segLen; parent.add(cap);
    if (opts.tip === "eye") {
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(capW * 0.34, 6, 5), accentMat);
      pupil.position.set(0, segLen, capW * 0.72); parent.add(pupil);
    }
    const t = {
      joints, cap,
      sp: 1.2 + rand() * 1.6, amp: opts.amp != null ? opts.amp : 0.16 + rand() * 0.12,
      ph: rand() * 6.28, curl: opts.curl != null ? opts.curl : 0.14, sway: 0.6 + rand() * 0.5,
    };
    tendrils.push(t);
    return t;
  }
  function waveTendrils(t) {
    for (const tn of tendrils) {
      for (let s = 0; s < tn.joints.length; s++) {
        tn.joints[s].rotation.z = tn.curl + Math.sin(t * tn.sp + s * 0.6 + tn.ph) * tn.amp;
        tn.joints[s].rotation.x = Math.cos(t * tn.sp * tn.sway + s * 0.5 + tn.ph) * tn.amp * 0.6;
      }
    }
  }

  // ---- 2-bone IK arm (the PLAYER manipulator — precise contact) -------------------
  // A limb = upper + fore + palm bones + a hand cap AT the tip. solve(target) runs a
  // law-of-cosines 2-bone IK so the TIP EQUALS the reachable target (that is what
  // lands the hand exactly on the note-onset contact), then inserts a wrist joint so
  // it reads as an articulated 3-segment appendage.
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _wrist = new THREE.Vector3();
  const WRIST_FRAC = 0.62;
  function placeBone(mesh, a, b) {
    const dir = _v1.subVectors(b, a); const len = dir.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(YAX, _v2.copy(dir).multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }
  function makeLimb(rootPos, poleDir, L1, L2, width, mat, capMat) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.5, width * 0.44, 1, 5), mat);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.42, width * 0.36, 1, 5), mat);
    const palm = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.36, width * 0.3, 1, 5), mat);
    // DE-SQUARE hand: a rounded palm-globe flanked by two curving PINCER claws.
    const cap = new THREE.Object3D();
    const hMat = capMat || skinMat;
    const palmBall = new THREE.Mesh(new THREE.SphereGeometry(width * 0.85, 7, 6), hMat);
    cap.add(palmBall);
    for (let s = -1; s <= 1; s += 2) {
      const pin = new THREE.Mesh(new THREE.ConeGeometry(width * 0.32, width * 1.9, 5), hMat);
      pin.position.set(s * width * 0.55, width * 0.75, 0); pin.rotation.z = -s * 0.55; cap.add(pin);
    }
    group.add(upper); group.add(fore); group.add(palm); group.add(cap);
    const root = rootPos.clone(), pole = poleDir.clone().normalize();
    const elbow = new THREE.Vector3(), tip = new THREE.Vector3();
    function solve(target) {
      const toT = _v3.subVectors(target, root);
      let d = toT.length();
      const maxD = (L1 + L2) * 0.999, minD = Math.abs(L1 - L2) + 1e-3;
      d = Math.min(maxD, Math.max(minD, d));
      const n = _v4.copy(toT).setLength(d);
      tip.copy(root).add(n);
      let c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      c = Math.min(1, Math.max(-1, c));
      const ang = Math.acos(c);
      const ndir = _v4.setLength(1);
      let axis = _v5.crossVectors(ndir, pole);
      if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); else axis.normalize();
      const upperDir = _v1.copy(ndir).applyAxisAngle(axis, ang);
      elbow.copy(root).addScaledVector(upperDir, L1);
      _wrist.copy(elbow).lerp(tip, WRIST_FRAC);
      placeBone(upper, root, elbow);
      placeBone(fore, elbow, _wrist);
      placeBone(palm, _wrist, tip);
      cap.position.copy(tip);
      return tip;
    }
    return { root, solve, tip, upper, fore, palm, cap };
  }

  // arm bone lengths (reach scales with H); the instrument contact below derives
  // from this reach so the hand lands ON the instrument.
  const armLenMul = clamp(bIn.armLength || 1, 0.6, 3);
  const armL1 = H * 0.2 * armLenMul, armL2 = H * 0.22 * armLenMul, armReach = armL1 + armL2;
  const armW = coreR * 0.34 * Math.max(0.6, 1.15 - armLenMul * 0.18);

  // vertical anchors used across plans.
  const coreMidY = H * 0.5, shoulderY = H * 0.66, baseY = H * 0.16;
  const headSz = H * 0.24;
  const head = new THREE.Object3D();      // face mount; y set per plan
  head.position.y = H * 0.86; group.add(head);

  // arm attach specs (filled per plan).
  const armRoots = [];   // { pos:Vector3, pole:Vector3, side }

  // ---- BUILD the CORE + appendage layout per PLAN --------------------------------
  function ringPos(i, count, r, y, zsq) {
    const ang = Math.PI / 2 - (i / count) * Math.PI * 2;   // i=0 -> front (+Z)
    return new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r * (zsq || 1));
  }
  function addPseudopods(count, ringR, y, len, downward) {
    for (let i = 0; i < count; i++) {
      const p = ringPos(i, Math.max(1, count), ringR, y, 0.9);
      const dir = downward
        ? new THREE.Vector3(p.x, -1.1, p.z).normalize()
        : new THREE.Vector3(p.x, 0.3, p.z).normalize();
      makeTendril(p, dir, len / 3.2, 3, coreR * 0.4, limbMat, skinMat, { curl: downward ? 0.5 : 0.2 });
    }
  }

  if (plan === "radial") {
    // N-fold star: a squat central hub with a spoke ring; arms are the spokes.
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 1.5, coreR * 1.7, H * 0.4, Math.max(5, symMetry)), clothMat);
    hub.position.y = coreMidY; group.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 0.7, coreR * 1.4, H * 0.22, Math.max(5, symMetry)), skinMat);
    cap.position.y = coreMidY + H * 0.28; group.add(cap);
    head.position.y = coreMidY + H * 0.34;
    for (let i = 0; i < nArms; i++) {
      const p = ringPos(i, nArms, coreR * 1.6, shoulderY - H * 0.06, 1);
      const pole = new THREE.Vector3(p.x, 0.7, p.z).normalize();
      armRoots.push({ pos: p, pole, side: p.x >= 0 ? 1 : -1 });
    }
    if (nLegs > 0) addPseudopods(nLegs, coreR * 1.2, baseY + H * 0.08, H * 0.4, true);
  } else if (plan === "cephalopod") {
    // a bulbous mantle over a skirt of long curling tentacles.
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(coreR * 1.5, 8, 6), clothMat);
    mantle.position.y = coreMidY + H * 0.16; mantle.scale.set(1, 1.35, 0.92); group.add(mantle);
    pulseCores.push({ mesh: mantle, base: mantle.scale.clone(), amp: 0.06 });
    head.position.y = coreMidY + H * 0.1;
    // tentacle skirt hangs from the mantle base.
    const skirtY = coreMidY - H * 0.02;
    for (let i = 0; i < nTent; i++) {
      const p = ringPos(i, nTent, coreR * 1.25, skirtY, 0.85);
      const dir = new THREE.Vector3(p.x * 0.5, -1.2, p.z * 0.5).normalize();
      makeTendril(p, dir, H * 0.16, 4, coreR * 0.5, limbMat, skinMat, { curl: 0.42, amp: 0.22 });
    }
    // two upper "arms" for playing, near the front of the mantle.
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 1.2, shoulderY - tier * armW * 1.6, coreR * 0.5);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.9, -0.6), side });
    }
  } else if (plan === "insectoid") {
    // a segmented thorax on many thin splayed legs.
    const nSegT = 3;
    for (let s = 0; s < nSegT; s++) {
      const t = s / (nSegT - 1);
      const seg = new THREE.Mesh(new THREE.SphereGeometry(coreR * (1.15 - 0.28 * s), 7, 6), s % 2 ? skinMat : clothMat);
      seg.position.set(0, coreMidY + (t - 0.4) * H * 0.34, -s * coreR * 0.5);
      seg.scale.set(1, 0.85, 1.1); group.add(seg);
    }
    head.position.y = coreMidY + H * 0.16;
    for (let i = 0; i < nLegs; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const row = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.9, coreMidY - H * 0.04 - row * coreR * 0.3, coreR * (0.5 - row * 0.5));
      const dir = new THREE.Vector3(side * 1.1, -0.15, 0.1).normalize();
      makeTendril(p, dir, H * 0.16, 3, armW * 1.1, limbMat, limbMat, { curl: side * 0.5, amp: 0.06 });
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 1.0, shoulderY - tier * armW * 1.4, coreR * 0.6);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.85, -0.5), side });
    }
  } else if (plan === "blob") {
    // amorphous pulsing mass with stubby pseudopods + a single maw.
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(coreR * 1.6, 0), clothMat);
    blob.position.y = coreMidY; blob.scale.set(1.05, 1.1, 0.95); group.add(blob);
    pulseCores.push({ mesh: blob, base: blob.scale.clone(), amp: 0.09 });
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(coreR * 0.9, 0), skinMat);
    lump.position.set(coreR * 0.4, coreMidY + coreR * 0.5, coreR * 0.3); group.add(lump);
    head.position.y = coreMidY + H * 0.06;
    if (nTent > 0) addPseudopods(nTent, coreR * 1.1, baseY + coreR * 0.4, H * 0.34, true);
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = new THREE.Vector3(side * coreR * 1.3, coreMidY + coreR * 0.2, coreR * 0.7);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.3, 0.2), side });
    }
  } else if (plan === "stalk") {
    // a cluster of tall swaying stalks rising from a base; eyes on stalk-tips.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 1.1, coreR * 1.5, H * 0.18, 6), clothMat);
    base.position.y = baseY; group.add(base);
    head.position.y = H * 0.7;
    const stalks = Math.max(2, nLegs || 3);
    for (let i = 0; i < stalks; i++) {
      const p = ringPos(i, stalks, coreR * 0.7, baseY + H * 0.08, 1);
      const withEye = i < nEyes;
      makeTendril(p, new THREE.Vector3(p.x * 0.15, 1, p.z * 0.15).normalize(), H * 0.2, 4, coreR * 0.34, skinMat, accentMat,
        { curl: 0.05, amp: 0.14, tip: withEye ? "eye" : "box" });
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.9, H * 0.5 - tier * armW * 1.5, coreR * 0.3);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.7, 0.1), side });
    }
  } else if (plan === "crystalline") {
    // a stack of angular glowing crystal prisms; rigid shard limbs.
    const nStack = 3;
    for (let s = 0; s < nStack; s++) {
      const t = s / nStack;
      const prism = new THREE.Mesh(new THREE.ConeGeometry(coreR * (1.3 - 0.3 * s), H * 0.3, 4), s % 2 ? accentMat : instBodyMat);
      prism.position.y = coreMidY - H * 0.12 + s * H * 0.22; prism.rotation.y = s * 0.5; group.add(prism);
    }
    head.position.y = coreMidY + H * 0.3;
    for (let i = 0; i < Math.max(2, nLegs); i++) {
      const p = ringPos(i, Math.max(2, nLegs), coreR * 1.0, baseY + coreR * 0.3, 1);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.28, H * 0.34, 4), accent2Mat);
      shard.position.copy(p); shard.rotation.z = p.x * 0.6; shard.rotation.x = -p.z * 0.6; group.add(shard);
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 1.15, shoulderY - tier * armW * 1.5, coreR * 0.4);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.6, 0.2), side });
    }
  } else { // gas
    // floating translucent sacs that bob; wispy tendrils below.
    const sacs = 3;
    for (let s = 0; s < sacs; s++) {
      const r = coreR * (1.2 - s * 0.22);
      const sac = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), s === 0 ? clothMat : skinMat);
      sac.position.set((s - 1) * coreR * 0.5, coreMidY + s * coreR * 0.4, (s % 2 ? 1 : -1) * coreR * 0.3);
      group.add(sac); pulseCores.push({ mesh: sac, base: sac.scale.clone(), amp: 0.1 + s * 0.02 });
    }
    head.position.y = coreMidY + coreR * 0.6;
    for (let i = 0; i < nTent; i++) {
      const p = ringPos(i, nTent, coreR * 0.8, coreMidY - coreR * 0.6, 1);
      makeTendril(p, new THREE.Vector3(p.x * 0.4, -1, p.z * 0.4).normalize(), H * 0.14, 3, coreR * 0.22, limbMat, accentMat,
        { curl: 0.2, amp: 0.28 });
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = new THREE.Vector3(side * coreR * 1.1, coreMidY, coreR * 0.6);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.4, 0.3), side });
    }
  }

  // ensure at least two arm roots exist (a player + a holder) for any plan.
  while (armRoots.length < 2) {
    const side = armRoots.length % 2 === 0 ? 1 : -1;
    armRoots.push({ pos: new THREE.Vector3(side * coreR * 1.1, shoulderY, coreR * 0.5), pole: new THREE.Vector3(side * 0.5, 0.8, -0.4), side });
  }
  nArms = armRoots.length;

  // ---- CONTRAST: floating LIGHT-BALLS — small bright emissive orbs orbiting the
  // core. Per-alien count + jitter so no two aliens carry the same halo; a deep-dark
  // body under blazing orbs is the value/colour contrast the scene asks for. Capped.
  const nOrbs = clamp(1 + orbJit, 1, 3);
  for (let i = 0; i < nOrbs; i++) {
    const oc = (i % 2 ? accentBright : accent2Col).clone().offsetHSL(0, 0.14, 0.16);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(coreR * (0.13 + rand() * 0.09), 7, 6), mkOrb(oc));
    const base = ringPos(i, Math.max(1, nOrbs), coreR * 1.75, coreMidY + (rand() - 0.3) * H * 0.32, 0.9);
    orb.position.copy(base); group.add(orb);
    orbs.push({ mesh: orb, base: base.clone(), ph: rand() * 6.28, amp: coreR * 0.28 });
  }

  // ---- FACE: a wild family on the head object ------------------------------------
  const faceZ = headSz * 0.5;
  const jaw = new THREE.Object3D();
  const jawBaseY = -headSz * 0.2;
  jaw.position.set(0, jawBaseY, faceZ - headSz * 0.02);
  function buildFace() {
    // a skull mass for maw/mandibles; a bare eye-cluster for the eye families.
    if (faceKind === "oneEye") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.6, 8, 7), skinMat);
      head.add(dome);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.42, 10, 9), eyeMat);
      eye.position.set(0, 0, headSz * 0.32); head.add(eye);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(headSz * 0.2, 12), accentMat);
      iris.position.set(0, 0, headSz * 0.72); head.add(iris);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(headSz * 0.09, 10), mouthMat);
      pupil.position.set(0, 0, headSz * 0.74); head.add(pupil);
      // a small slit maw below so the singer can still gape.
      const jbox = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.3, headSz * 0.08, headSz * 0.08), mouthMat);
      jbox.position.set(0, -headSz * 0.04, 0); jaw.add(jbox); head.add(jaw);
    } else if (faceKind === "eyeRing") {
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(headSz * 0.55, 0), skinMat);
      head.add(knob);
      const ring = Math.min(8, nEyes);
      for (let e = 0; e < ring; e++) {
        const p = ringPos(e, ring, headSz * 0.55, 0, 1);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.15, 7, 6), eyeMat);
        eye.position.set(p.x, p.y, Math.abs(p.z) * 0.4 + headSz * 0.2); head.add(eye);
        const pu = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.05, 6, 5), accentMat);
        pu.position.set(p.x, p.y, Math.abs(p.z) * 0.4 + headSz * 0.33); head.add(pu);
      }
      const maw = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.2, 7, 6), mouthMat);
      maw.position.set(0, -headSz * 0.1, headSz * 0.4); maw.scale.set(1, 0.6, 0.6); jaw.add(maw); head.add(jaw);
    } else {
      // maw / mandibles — a rounded skull with a jaw that drops, plus a couple of eyes.
      const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(headSz * 0.64, 0), skinMat);
      skull.scale.set(1, 1.06, 0.94); head.add(skull);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.4, 8, 5), limbMat);
      brow.scale.set(1, 0.26, 0.42);
      brow.position.set(0, headSz * 0.27, faceZ - headSz * 0.02); head.add(brow);
      const eyeN = Math.min(3, Math.max(2, nEyes));
      // per-alien vertical + spread jitter so faces read individual within the family.
      const eyeY = headSz * (0.06 + eyeJit * 0.03), eyeSpread = headSz * (0.55 + morphR * 0.12);
      for (let e = 0; e < eyeN; e++) {
        const sx = eyeN === 1 ? 0 : (e / (eyeN - 1) - 0.5) * eyeSpread;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.13, 8, 7), eyeMat);
        eye.position.set(sx, eyeY, faceZ); head.add(eye);
        const pu = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.055, 6, 5), accentMat);
        pu.position.set(sx, eyeY, faceZ + headSz * 0.08); head.add(pu);
      }
      if (faceKind === "mandibles") {
        for (let s = -1; s <= 1; s += 2) {
          const md = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.1, headSz * 0.4, 4), accent2Mat);
          md.position.set(s * headSz * 0.22, -headSz * 0.06, faceZ + headSz * 0.05);
          md.rotation.z = s * 1.4; md.rotation.x = Math.PI / 2; jaw.add(md);
        }
        const lip = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.4, headSz * 0.06, headSz * 0.08), mouthMat);
        lip.position.set(0, headSz * 0.18, faceZ - headSz * 0.02); head.add(lip);
      } else {
        const lip = new THREE.Mesh(new THREE.BoxGeometry(headSz * 0.5, headSz * 0.06, headSz * 0.08), mouthMat);
        lip.position.set(0, headSz * 0.2, faceZ - headSz * 0.02); head.add(lip);
        const jbox = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.28, 8, 6), mouthMat);
        jbox.scale.set(1, 0.5, 0.42);
        jbox.position.set(0, -headSz * 0.04, 0); jaw.add(jbox);
        for (let k = 0; k < 4; k++) {
          const fang = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.03, headSz * 0.1, 3), accent2Mat);
          fang.position.set((k - 1.5) * headSz * 0.12, headSz * 0.12, faceZ + headSz * 0.02); fang.rotation.x = Math.PI; head.add(fang);
        }
      }
      head.add(jaw);
    }
  }
  buildFace();

  // ---- build the ARMS from the plan's roots --------------------------------------
  // the player arm is the manipulator that plays the score; the holder braces the
  // instrument for stringed/blown styles; the rest idle.
  const playerIdx = isDancer ? -1 : (((inst.appendage | 0) % nArms) + nArms) % nArms;
  const holderIdx = (!isDancer && nArms >= 2) ? (playerIdx + 1) % nArms : -1;
  const stringed = playStyle === "pluck" || playStyle === "bow";
  const arms = [];
  for (let i = 0; i < nArms; i++) {
    const r = armRoots[i];
    const a = makeLimb(r.pos.clone(), r.pole.clone(), armL1, armL2, armW, limbMat, skinMat);
    a.side = r.side;
    a.rest = new THREE.Vector3(r.pos.x * 1.05, r.pos.y - armReach * 0.7, r.pos.z + coreR * 0.2); // relaxed hang
    arms.push(a);
  }

  // ---- procedural INVENTED (ALIEN) INSTRUMENT — players only ----------------------
  // Not a real drum/guitar. Six organic families, chosen by playStyle (refined by
  // the family label). Each exposes animation refs the update drives by contactness:
  //   membrane-sac  — a pulsing bladder that COMPRESSES on each strike (_sac)
  //   coiled resonator — a spiral coil that shivers when plucked (_coil)
  //   crystal chime-cluster — shards that ring/rotate when struck (_shards)
  //   tendril-harp  — a curved frame of strands that vibrate when plucked (_strings)
  //   bladder-horn  — a throat+bell that INFLATES while blown (_bladder)
  //   glass membrane-pane — a translucent pane a bow drags across (_pane,_bow)
  function instKindFor() {
    const f = (inst.family || "").toLowerCase();
    if (/sac|membrane|bladderdrum/.test(f)) return "sac";
    if (/coil|resonat|subwomp|synthbass|gutstring|bass/.test(f) && playStyle !== "strike") return playStyle === "bow" ? "pane" : "coil";
    if (/chime|crystal|clack|shaker/.test(f)) return "chime";
    if (/harp|tendril|bloop|twang|neon|shimmer/.test(f)) return "harp";
    if (/horn|wail|reed|bladder/.test(f)) return "horn";
    if (playStyle === "strike" || playStyle === "drum") return "sac";
    if (playStyle === "bow") return "pane";
    if (playStyle === "blow") return "horn";
    if (playStyle === "pluck") return "harp";
    return "chime";
  }
  const instKind = isDancer ? null : instKindFor();
  function buildInstrument(kind) {
    const g = new THREE.Object3D();
    const acc = accentMat, body2 = instBodyMat;
    if (kind === "sac") {                                  // pulsing membrane-sac (drum)
      const sac = new THREE.Mesh(new THREE.SphereGeometry(H * 0.17, 9, 7), body2);
      sac.scale.set(1, 0.8, 1); g.add(sac); g._sac = sac;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.17, H * 0.02, 5, 10), acc);
      ring.rotation.x = Math.PI / 2; ring.position.y = H * 0.02; g.add(ring);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(H * 0.04, 6, 5), acc);
      nub.position.y = H * 0.15; g.add(nub);
    } else if (kind === "coil") {                          // coiled resonator (bass)
      const strands = [];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, r = H * (0.06 + t * 0.12);
        const seg = new THREE.Mesh(new THREE.TorusGeometry(r, H * 0.018, 4, 8, Math.PI * 1.4), body2);
        seg.position.y = -H * 0.18 + t * H * 0.36; seg.rotation.y = t * 6.0; seg.rotation.x = Math.PI / 2;
        g.add(seg); strands.push(seg);
      }
      g._coil = strands;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.02, H * 0.02, H * 0.4, 5), acc);
      g.add(spine);
    } else if (kind === "chime") {                         // crystal chime-cluster (perc)
      const shards = [];
      for (let k = 0; k < 5; k++) {
        const len = H * (0.12 + (k % 3) * 0.05);
        const sh = new THREE.Mesh(new THREE.ConeGeometry(H * 0.03, len, 4), k % 2 ? acc : body2);
        sh.position.set((k - 2) * H * 0.06, -len * 0.3, (k % 2) * H * 0.03);
        sh.rotation.z = (k - 2) * 0.12; g.add(sh); shards.push(sh);
      }
      g._shards = shards;
    } else if (kind === "harp") {                          // tendril-harp (lead/pluck)
      const frame = new THREE.Mesh(new THREE.TorusGeometry(H * 0.2, H * 0.022, 5, 10, Math.PI * 1.15), body2);
      frame.rotation.z = -Math.PI / 2.2; g.add(frame);
      const strings = [];
      for (let s = 0; s < 6; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.006, H * 0.34 - s * H * 0.02, H * 0.006), acc);
        str.position.set((s - 2.5) * H * 0.045, H * 0.02, 0); g.add(str); strings.push(str);
      }
      g._strings = strings;
    } else if (kind === "horn") {                          // bladder-horn (blow)
      const bladder = new THREE.Mesh(new THREE.SphereGeometry(H * 0.1, 8, 7), body2);
      bladder.position.set(-H * 0.02, -H * 0.04, 0); g.add(bladder); g._bladder = bladder;
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.025, H * 0.05, H * 0.28, 6), body2);
      throat.rotation.z = -0.7; throat.position.set(H * 0.12, H * 0.1, 0); g.add(throat);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(H * 0.13, H * 0.18, 9, 1, true), acc);
      bell.rotation.z = -2.4; bell.position.set(H * 0.26, H * 0.24, 0); g.add(bell);
    } else {                                               // glass membrane-pane (bow)
      const pane = new THREE.Mesh(new THREE.BoxGeometry(H * 0.42, H * 0.26, H * 0.03), body2);
      pane.position.y = -H * 0.02; g.add(pane); g._pane = pane;
      for (let s = 0; s < 4; s++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(H * 0.02, H * 0.28, H * 0.05), acc);
        rib.position.set((s - 1.5) * H * 0.1, 0, H * 0.01); g.add(rib);
      }
      const bow = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.008, H * 0.008, H * 0.4, 4), acc);
      bow.rotation.z = Math.PI / 2; bow.position.set(0, 0, H * 0.07); g.add(bow); g._bow = bow;
    }
    return g;
  }

  // contact point (alien-local) + the playing rig — PLAYERS ONLY.
  let contact = null, instrument = null, holdPoint = null, instBaseY = 0;
  const _tgt = new THREE.Vector3(), _rest = new THREE.Vector3(), _lastTarget = new THREE.Vector3();
  let windup = 0, bowAmp = 0, loweredDrop = 0;
  const contactAxis = new THREE.Vector3();   // the along-instrument axis for pitch bias
  if (!isDancer) {
    const pShoulder = arms[playerIdx].root;
    contact = new THREE.Vector3();
    const instTilt = new THREE.Euler();
    const REACH = armReach * 0.8;
    const put = (dx, dy, dz) => { contact.set(dx, dy, dz).normalize().multiplyScalar(REACH).add(pShoulder); };
    if (playStyle === "strike" || playStyle === "drum") { put(-0.2, -0.75, 0.7); contactAxis.set(1, 0, 0.3); }
    else if (playStyle === "pluck") { put(-0.3, -0.45, 0.85); instTilt.set(0, 0, 0.15); contactAxis.set(0.6, 0.8, 0); }
    else if (playStyle === "bow") { put(-0.1, -0.3, 0.95); contactAxis.set(1, 0.15, 0); }
    else if (playStyle === "blow") { put(-0.1, 0.55, 0.6); instTilt.set(0, 0, -0.35); contactAxis.set(0.4, 0.9, 0); }
    else { put(-0.2, -0.4, 0.85); contactAxis.set(0.6, 0.6, 0); }
    contactAxis.normalize();
    instrument = buildInstrument(instKind);
    instrument.position.copy(contact);
    instrument.rotation.copy(instTilt);
    group.add(instrument);
    instBaseY = contact.y;
    holdPoint = new THREE.Vector3(contact.x + coreR * 0.2, contact.y + armReach * 0.4, contact.z);
    const baseReach = H * 0.42;
    windup = baseReach * 0.55 * (0.7 + 0.3 * armLenMul);
    bowAmp = baseReach * 0.42;
    loweredDrop = H * 0.34;    // how far the instrument sinks when the voice rests
  }

  let clock = 0;
  // rolling contact envelope (for the mouth + instrument animation + debug).
  let lastC = 0, lastEnergy = 0, lastRaise = 0;

  // --- contactness from the REAL note onsets (SCORE mode) --------------------------
  // Returns c in 0..1: 1 == the hand is AT the instrument (a hit landing NOW). For
  // impulse styles each onset is a momentary contact (approach->hit->recoil); for
  // sustained styles the contact is HELD across the note's duration. Wrap-safe at
  // the bar edges. Windows are short so sparse/syncopated onsets read as distinct
  // strikes; dense onsets overlap (busy playing).
  const APPROACH = 0.11, RECOIL = 0.07, ATTACK = 0.05, RELEASE = 0.08;
  let biasPitch = 0.5, haveBias = false;
  function noteContactness(barPhase, notes) {
    let c = 0; haveBias = false;
    for (let i = 0; i < notes.length; i++) {
      const nt = notes[i]; const t0 = nt.t;
      for (let off = -1; off <= 1; off++) {
        const d = barPhase - (t0 + off);
        let cc = 0;
        if (sustained) {
          const dur = Math.max(0.04, nt.dur || 0.12);
          if (d >= -ATTACK && d <= dur + RELEASE) {
            if (d < 0) cc = smooth01(1 + d / ATTACK);
            else if (d <= dur) cc = 1;
            else cc = smooth01(1 - (d - dur) / RELEASE);
          }
        } else {
          if (d >= -APPROACH && d <= RECOIL) {
            if (d <= 0) cc = smooth01(1 + d / APPROACH);
            else cc = smooth01(1 - d / RECOIL);
          }
        }
        if (cc > c) { c = cc; if (nt.pitch != null) { biasPitch = clamp((nt.pitch - 40) / 44, 0, 1); haveBias = true; } }
      }
    }
    return c;
  }
  // --- contactness from the beat sub-grid (legacy FALLBACK) ------------------------
  function beatContactness(beatPhase) {
    const sub = (beatPhase * hitsPerBeat) % 1;
    if (sustained) return 0.55 + 0.45 * Math.cos(sub * Math.PI * 2);
    return 0.5 + 0.5 * Math.cos(sub * Math.PI * 2);   // 1 at the sub-boundary, 0 at mid
  }

  // the player hand's target for a given contactness c (1 == striking) + pitch bias.
  function playerTarget(c, barPhase) {
    _tgt.copy(contact);
    if (haveBias) _tgt.addScaledVector(contactAxis, (biasPitch - 0.5) * H * 0.14);   // pitch -> position
    const away = 1 - c;
    if (playStyle === "strike" || playStyle === "drum") {
      _tgt.y += away * windup; _tgt.z -= away * windup * 0.25;
    } else if (playStyle === "pluck") {
      _tgt.x += arms[playerIdx].side * away * windup * 0.5; _tgt.z += away * windup * 0.35;
    } else if (playStyle === "bow") {
      const slide = Math.sin(clock * 6.0) * bowAmp * (0.3 + 0.7 * c);
      _tgt.x += slide; _tgt.y += slide * 0.12;
    } else if (playStyle === "blow") {
      _tgt.y -= away * windup * 0.3; _tgt.z += away * windup * 0.15;
    } else {
      _tgt.y += away * windup * 0.6;
    }
    return _tgt;
  }

  // drive the invented instrument's little animation from the current contact.
  function animateInstrument(c, vel) {
    if (!instrument) return;
    const k = c * (0.5 + 0.5 * vel);
    if (instrument._sac) instrument._sac.scale.set(1 + 0.14 * k, 0.8 - 0.2 * k, 1 + 0.14 * k);
    if (instrument._bladder) instrument._bladder.scale.setScalar(1 + 0.28 * k);
    if (instrument._pane) instrument._pane.rotation.z = Math.sin(clock * 6) * 0.05 * k;
    if (instrument._bow) { instrument._bow.position.x = Math.sin(clock * 6) * H * 0.16 * (0.3 + 0.7 * c); }
    if (instrument._strings) {
      const q = Math.sin(clock * 46) * 0.012 * k;
      for (let s = 0; s < instrument._strings.length; s++) instrument._strings[s].position.z = q * (s % 2 ? 1 : -1);
    }
    if (instrument._coil) { const q = 1 + Math.sin(clock * 40) * 0.04 * k; for (const s of instrument._coil) s.scale.x = q; }
    if (instrument._shards) instrument._shards.forEach((sh, s) => { sh.rotation.x = Math.sin(clock * 30 + s) * 0.1 * k; });
  }

  function update(dt, ctx) {
    dt = dt || 0; clock += dt;
    glitchTime.value = clock;

    // ---- parse ctx: SCORE object vs legacy beatPhase number vs null ---------------
    let barPhase, playing, level, notes, bobPhase;
    if (ctx != null && typeof ctx === "object") {
      barPhase = ((((ctx.barPhase || 0) % 1) + 1) % 1);
      playing = ctx.playing !== false;
      level = ctx.level == null ? 1 : clamp(ctx.level, 0, 1);
      notes = Array.isArray(ctx.notes) ? ctx.notes : null;
      bobPhase = (barPhase * 4) % 1;   // pseudo-beat for the whole-body groove
    } else {
      const beatPhase = ctx == null ? (clock % 1) : ((((ctx % 1) + 1) % 1));
      barPhase = beatPhase; playing = true; level = 1; notes = null; bobPhase = beatPhase;
    }
    const energyActive = (playing && level > 0.05) ? level : 0;   // 0 => REST
    lastEnergy = energyActive;

    const energy = groove.energy || 0.5;
    const bob = (1 - Math.cos(bobPhase * Math.PI * 2)) * 0.5;

    // idle WAVING (tentacles/stalks/cilia) — continuous, beat-independent.
    waveTendrils(clock);
    // breathing sacs (blob/gas).
    for (const pc of pulseCores) {
      const s = 1 + Math.sin(clock * 1.4 + pc.mesh.id * 0.3) * pc.amp;
      pc.mesh.scale.set(pc.base.x * s, pc.base.y * (2 - s), pc.base.z * s);
    }
    // floating light-balls drift; they surge a little more when the voice is loud.
    const orbDrive = 0.4 + 0.6 * (lastEnergy || 0);
    for (const o of orbs) {
      o.mesh.position.y = o.base.y + Math.sin(clock * 1.7 + o.ph) * o.amp * orbDrive;
      o.mesh.position.x = o.base.x + Math.cos(clock * 1.3 + o.ph) * o.amp * 0.5;
    }

    // contactness — from the SCORE when we have notes, else the beat sub-grid.
    let c;
    if (notes) c = noteContactness(barPhase, notes);
    else { c = beatContactness(barPhase); haveBias = false; biasPitch = 0.5; }
    c *= (energyActive > 0 ? 1 : 0);       // RESTING kills all contact
    lastC = c;
    const vel = haveBias ? 1 : 1;

    // MOUTH — the singer's jaw follows its own notes; others pulse gently.
    const open = clamp(faceWide * 0.25 + sing * 0.6 * Math.max(c, (isDancer ? bob : 0.15 * bob)), 0, 1);
    jaw.position.y = jawBaseY - open * headSz * 0.22;
    jaw.rotation.x = open * 0.5;

    if (isDancer) {
      // DANCER — no instrument; a full-body groove that scales as a SMOOTH CONTINUUM
      // with volume: barely a shimmer when the mix is quiet, a big sway when it's loud.
      const amp = 0.12 + 0.88 * level;
      group.position.y = -bob * 0.11 * (0.6 + (groove.bounce || 0.4)) * H * amp;
      group.rotation.z = Math.sin(clock * (1.6 + energy)) * 0.14 * (0.6 + (groove.sway || 0.3)) * amp;
      group.rotation.y = Math.sin(clock * 0.9) * 0.26 * amp;
      head.rotation.x = -0.1 + bob * 0.35 * (groove.headbob || 0.4) * amp;
      head.rotation.y = Math.sin(clock * 1.8) * 0.2 * amp;
      for (let i = 0; i < arms.length; i++) {
        const a = arms[i]; _rest.copy(a.rest);
        const lift = 0.5 + 0.5 * Math.sin(clock * (2 + energy) + i * 1.7);
        _rest.y += lift * armReach * 0.7 * amp;
        _rest.x += a.side * (0.2 + 0.3 * lift) * H * 0.3 + Math.sin(clock * 2.2 + i) * 0.05 * H;
        _rest.z += 0.2 * H * lift;
        a.solve(_rest);
        _lastTarget.copy(_rest);
      }
      return;
    }

    // PLAYER GROOVE: a musical bob + idle sway whose AMPLITUDE tracks this voice's
    // volume as a smooth continuum — subtle when the part is quiet, big when it's
    // loud (near-still at rest). The onset CONTACT below is independent (score law).
    const gAmp = 0.06 + 0.94 * energyActive;
    group.position.y = -bob * 0.09 * (groove.bounce || 0.4) * H * gAmp;
    group.rotation.z = Math.sin(clock * (1.2 + energy)) * 0.05 * (groove.sway || 0.3) * (0.15 + 0.85 * gAmp);
    group.rotation.y = Math.sin(clock * 0.7) * 0.04 * (groove.sway || 0.3) * (0.15 + 0.85 * gAmp);
    head.rotation.x = -0.12 + bob * 0.3 * (groove.headbob || 0.4) * gAmp;
    head.rotation.y = Math.sin(clock * 1.6) * 0.12 * (groove.headbob || 0.4) * (0.15 + 0.85 * gAmp);
    if (playStyle === "blow") group.rotation.x = -0.12 - bob * 0.05 * energyActive;

    // RAISE the instrument when playing; LOWER + drop it toward the lap when resting.
    const raise = smooth01((energyActive - 0.05) / 0.15);   // 0 rest -> 1 playing
    lastRaise = raise;
    if (instrument) {
      instrument.position.y = instBaseY - (1 - raise) * loweredDrop;
      instrument.rotation.z = (instrument.rotation.z || 0);
      instrument.scale.setScalar(0.9 + 0.1 * raise);
    }

    // PLAYER ARM: strike/pluck/bow/blow ON the real note onsets (or idle at rest).
    const pArm = arms[playerIdx];
    if (energyActive > 0.001) {
      pArm.solve(playerTarget(c, barPhase));
    } else {
      _rest.copy(pArm.rest); _rest.y -= 0.05 * H;   // hand lowered, instrument at rest
      pArm.solve(_rest);
    }
    _lastTarget.copy(_tgt);
    animateInstrument(c, vel);

    // holder braces the instrument for stringed/blown styles (when playing).
    if (stringed && holderIdx >= 0 && holderIdx !== playerIdx) {
      if (raise > 0.1) arms[holderIdx].solve(holdPoint);
      else { _rest.copy(arms[holderIdx].rest); arms[holderIdx].solve(_rest); }
    }

    // the remaining arms idle-sway.
    for (let i = 0; i < arms.length; i++) {
      if (i === playerIdx) continue;
      if (stringed && i === holderIdx) continue;
      const a = arms[i]; _rest.copy(a.rest);
      const idleAmp = 0.15 + 0.85 * gAmp;   // idle arms too calm down when the voice is quiet
      _rest.x += Math.sin(clock * (1.4 + energy) + i) * 0.05 * H * idleAmp;
      _rest.y += bob * 0.05 * H * gAmp + Math.sin(clock * 2 + i) * 0.02 * H * idleAmp;
      a.solve(_rest);
    }
  }

  // headless-proof accessor: player hand tip vs the true contact (alien-local).
  function debug() {
    const t = (playerIdx >= 0 ? arms[playerIdx] : arms[0]).tip;
    const c = contact || t;
    return {
      playStyle, contactness: +lastC.toFixed(4),
      handTip: { x: t.x, y: t.y, z: t.z },
      contact: { x: c.x, y: c.y, z: c.z },
      target: { x: _lastTarget.x, y: _lastTarget.y, z: _lastTarget.z },
      dist: contact ? t.distanceTo(contact) : 0,
      reachDist: t.distanceTo(_lastTarget),
    };
  }

  // SHADOWS + modelling: every mesh casts and receives the key light.
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  update(0, isDancer ? 0 : { barPhase: 0, playing: true, level: 1, notes: [] });   // pose once (non-blank)

  return { group, update, debug, materials, playStyle, hitsPerBeat, voice, plan };
}

export default { makeAlien };

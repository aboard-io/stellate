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

// ---- COCKPIT INTERIOR -----------------------------------------------------------
export function makeCockpit(THREE, opts = {}) {
  const group = new THREE.Object3D();
  group.name = "cockpit";

  const shell = new THREE.MeshLambertMaterial({ color: 0x140d20, flatShading: true });
  const trim = new THREE.MeshLambertMaterial({ color: 0x33244a, flatShading: true, emissive: 0x140a24 });
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
export function makePlanet(THREE, traits, seed) {
  const group = new THREE.Object3D();
  group.name = "planet";
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), planetMat(THREE, traits));
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
  function update(dt) { t += dt || 0; body.rotation.y += (dt || 0) * 0.12; }
  function setPalette(tr) { body.material.color.copy(planetColor(THREE, tr)); }
  return { group, update, body, setPalette };
}

function planetColor(THREE, traits) {
  const pal = (traits && traits.palette) || {};
  const s = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  return new THREE.Color().setHSL(((s.h % 360) / 360), Math.min(1, (s.s || 0.5) + 0.15), Math.min(0.62, (s.l || 0.5) + 0.05));
}
function planetMat(THREE, traits) {
  const col = planetColor(THREE, traits);
  return new THREE.MeshLambertMaterial({ color: col, flatShading: true, emissive: col.clone().multiplyScalar(0.18) });
}

export default { makeCockpit, makePlanet };

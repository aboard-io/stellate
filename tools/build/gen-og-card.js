#!/usr/bin/env node
// tools/build/gen-og-card.js — render STELLATE's social card + favicons from a recipe.
//
// WHY THIS EXISTS
// ---------------
// The repo's one rule is "source is committed; audio is derived and gitignored":
// the *capability* is the thing worth keeping, not its output. The same logic
// applies to branding art. This script IS the og-card — a deterministic recipe
// (seeded PRNG star field, the app's own palette + gradient, the app's own
// Orbitron/VT323 faces) rendered through the repo's existing headless chromium
// (test/lib/probe-harness.js). Nobody hand-tunes a PNG in a paint program; you edit
// the template below and re-run, and the star field lands in the same places
// because the PRNG is seeded and the fonts are inlined as base64 woff2 rather
// than raced off a CDN.
//
// The generated PNGs under assets/ ARE committed, and that is an INTENTIONAL
// exception to the "no derived binaries" rule: Slack, iMessage, Twitter,
// Mastodon, Discord and Google's crawler fetch `og:image` and `apple-touch-icon`
// as plain static bytes. A crawler cannot run a generator. So the bytes ship,
// but the recipe ships with them and remains the source of truth — regenerate,
// don't retouch.
//
// USAGE
//   node tools/build/gen-og-card.js           # everything
//   node tools/build/gen-og-card.js --card    # just assets/og-card.png (1200x630)
//   node tools/build/gen-og-card.js --icons   # just icon-32 / icon-180 / favicon.ico
//
// OUTPUTS
//   assets/og-card.png    1200x630 social card
//   assets/icon-180.png   apple-touch-icon
//   assets/icon-32.png    browser tab icon
//   assets/favicon.ico    ICONDIR + ICONDIRENTRY wrapping the 32x32 PNG verbatim
//                         (a .ico may carry a PNG payload; the 22 header bytes
//                         are written by hand here — zero new dependencies)
//
// FONTS: fetched once from Google Fonts (node 18+ global fetch, modern-browser
// User-Agent so we get woff2), then cached under tools/.font-cache/ and inlined
// as data: URIs. Re-runs work offline off the cache. With neither network nor
// cache the render still happens, on system fonts, with a loud warning.
"use strict";

const fs = require("fs");
const path = require("path");
const { launchChromium } = require("../../test/lib/probe-harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const ASSETS = path.join(ROOT, "assets");
const FONT_CACHE = path.join(__dirname, "..", ".font-cache");

const GF_CSS =
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=VT323&display=swap";
// Google Fonts serves woff2 only to UAs it believes support it.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// The app's palette, verbatim from app/app.css :root.
const PAL = {
  bg: "#0c0a1a", ink: "#ece9ff", dim: "#9b93c6",
  pink: "#ff6ec7", cyan: "#45e0ff", amber: "#ffd86b",
};

/* ------------------------------------------------------------------ fonts */

// Parse Google's css2 response into {family,weight,style,url,range} faces.
function parseFaces(css) {
  const faces = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  for (const b of blocks) {
    const pick = (k) => { const m = b.match(new RegExp(k + "\\s*:\\s*([^;]+);")); return m ? m[1].trim() : ""; };
    const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!url) continue;
    faces.push({
      family: pick("font-family").replace(/['"]/g, ""),
      weight: pick("font-weight") || "400",
      style: pick("font-style") || "normal",
      range: pick("unicode-range"),
      url,
    });
  }
  return faces;
}

async function fetchBytes(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// Returns a CSS string of @font-face rules with base64 woff2 payloads inline
// (empty string => caller falls back to system fonts).
async function fontCss() {
  fs.mkdirSync(FONT_CACHE, { recursive: true });
  const listPath = path.join(FONT_CACHE, "faces.json");
  let faces = null;

  try {
    const css = await fetchBytes(GF_CSS, { "User-Agent": UA }).then((b) => b.toString("utf8"));
    faces = parseFaces(css)
      // one subset per family/weight: the latin block is the only one this card needs
      .filter((f) => /U\+0000-00FF/.test(f.range) || !f.range);
    if (!faces.length) throw new Error("no latin woff2 faces in css2 response");
    fs.writeFileSync(listPath, JSON.stringify(faces, null, 2));
  } catch (e) {
    console.warn("  fonts: css2 fetch failed (" + e.message + ") — trying cache");
    if (fs.existsSync(listPath)) faces = JSON.parse(fs.readFileSync(listPath, "utf8"));
  }
  if (!faces) {
    console.warn("  !! WARNING: no Google Fonts CSS and no cache — rendering on SYSTEM FONTS.");
    console.warn("  !! The card will not match the app. Re-run with network to fix.");
    return "";
  }

  const rules = [];
  for (const f of faces) {
    const file = path.join(FONT_CACHE, path.basename(f.url));
    let buf = null;
    if (fs.existsSync(file)) buf = fs.readFileSync(file);
    else {
      try {
        buf = await fetchBytes(f.url, { "User-Agent": UA });
        fs.writeFileSync(file, buf);
      } catch (e) { console.warn("  fonts: " + path.basename(f.url) + " unavailable (" + e.message + ")"); }
    }
    if (!buf) continue;
    rules.push(
      `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};` +
      `font-display:block;src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}`
    );
  }
  if (!rules.length) {
    console.warn("  !! WARNING: font files unavailable — rendering on SYSTEM FONTS.");
    return "";
  }
  console.log(`  fonts: ${rules.length} face(s) inlined (cache: tools/.font-cache/)`);
  return rules.join("\n");
}

/* ------------------------------------------------- deterministic star field */

// mulberry32 — the same tiny seeded PRNG the kernel leans on. Fixed seed =>
// the star field is identical on every run, so re-generating the card produces
// a byte-similar PNG instead of a fresh sky.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The headline/tagline block, in card coordinates. Stars inside it are dimmed
// (deterministically, at generation time) instead of being hidden under a
// full-canvas scrim: a 1200x630 CSS gradient dithers into ~170KB of PNG noise,
// and the whole card has to stay under 300KB for the crawlers.
const TEXT_BOX = { x0: 0, y0: 96, x1: 1075, y1: 590 };

// Build the card's sky as SVG markup (run in node, not the page — the PRNG
// state never leaves this process, so the output is fully reproducible).
function cardSky(w, h) {
  const rnd = mulberry32(0x57e11a7e); // "stellate"
  const inText = (x, y) => x > TEXT_BOX.x0 && x < TEXT_BOX.x1 && y > TEXT_BOX.y0 && y < TEXT_BOX.y1;

  const faint = [];
  for (let i = 0; i < 230; i++) {
    const x = +(rnd() * w).toFixed(1), y = +(rnd() * h).toFixed(1);
    const r = +(0.5 + rnd() * 1.25).toFixed(2);
    let o = 0.16 + rnd() * 0.52;
    if (inText(x, y)) o *= 0.34;               // starlight behind the words, not through them
    // a few stars carry the palette; the rest are plain starlight
    const roll = rnd();
    const c = roll > 0.92 ? PAL.cyan : roll > 0.85 ? PAL.amber : roll > 0.8 ? PAL.pink : "#dcd8ff";
    faint.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o.toFixed(2)}"/>`);
  }

  // brighter stars with a soft halo, kept out of the text block
  const bright = [];
  for (let guard = 0; bright.length < 7 && guard < 400; guard++) {
    const x = +(w * 0.06 + rnd() * w * 0.9).toFixed(1);
    const y = +(h * 0.05 + rnd() * h * 0.9).toFixed(1);
    if (inText(x, y)) continue;
    bright.push({ x, y, r: +(1.8 + rnd() * 1.7).toFixed(2) });
  }

  // THE PATH — a drawn journey, exactly what the app's star map shows. Hand
  // placed across the open top-right sky so it never crosses a glyph.
  const pts = [{ x: 690, y: 96 }, { x: 872, y: 168 }, { x: 1052, y: 92 }, { x: 1136, y: 268 }];
  const anchors = pts.map((p) => ({ x: p.x, y: p.y, r: 2.6 }));

  const halo = bright.concat(anchors).map((s) =>
    `<circle cx="${s.x}" cy="${s.y}" r="${(s.r * 3.2).toFixed(2)}" fill="${PAL.cyan}" opacity=".12"/>` +
    `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#fffdf6" opacity=".95"/>`).join("");

  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const nodes = pts.map((p, i) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${i === 0 ? 11 : 8}" fill="none" stroke="${PAL.pink}" stroke-width="${i === 0 ? 2.4 : 1.7}" opacity="${i === 0 ? 0.95 : 0.72}"/>`
  ).join("");

  return `<svg class="sky" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <g>${faint.join("")}</g>
    <g class="glow">${halo}</g>
    <g class="path">
      <polyline points="${poly}" fill="none" stroke="${PAL.pink}" stroke-width="2" opacity=".62"
        stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="9 7"/>
      ${nodes}
    </g>
  </svg>`;
}

/* ------------------------------------------------------------- the templates */

function cardHtml(fonts) {
  const W = 1200, H = 630;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
:root{--bg:${PAL.bg};--ink:${PAL.ink};--dim:${PAL.dim};--pink:${PAL.pink};--cyan:${PAL.cyan};--amber:${PAL.amber}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg)}
.card{position:relative;width:${W}px;height:${H}px;background:var(--bg);
  overflow:hidden;font-synthesis:none;-webkit-font-smoothing:antialiased}
/* the one big smooth gradient we can afford: a nebula confined to the top-right
   sky. A full-canvas gradient dithers into ~170KB of incompressible PNG noise. */
.neb{position:absolute;right:-90px;top:-150px;width:640px;height:520px;
  background:radial-gradient(50% 50% at 50% 50%, rgba(70,52,150,.55) 0%, rgba(28,20,70,.22) 55%, rgba(12,10,26,0) 78%)}
.sky{position:absolute;inset:0}
.sky .glow{filter:drop-shadow(0 0 6px rgba(69,224,255,.5))}
.sky .path{filter:drop-shadow(0 0 6px rgba(255,110,199,.55))}
.fg{position:absolute;inset:0;padding:74px 84px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:'Orbitron',sans-serif;font-weight:500;font-size:20px;letter-spacing:.42em;
  text-transform:uppercase;color:var(--cyan);opacity:.8;margin-bottom:20px}
h1{font-family:'Orbitron',sans-serif;font-weight:700;font-size:148px;line-height:1;letter-spacing:.028em;
  background:linear-gradient(90deg,var(--amber),var(--pink) 52%,var(--cyan));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
  padding-bottom:.06em}
.rule{width:190px;height:2px;margin:26px 0 24px;
  background:linear-gradient(90deg,var(--pink),rgba(255,110,199,0))}
.tag{font-family:'VT323',ui-monospace,monospace;font-size:56px;line-height:1.05;color:var(--ink);letter-spacing:.012em}
.sub{font-family:'VT323',ui-monospace,monospace;font-size:32px;line-height:1.25;color:var(--dim);margin-top:12px;letter-spacing:.02em}
.credit{position:absolute;left:84px;bottom:56px;font-family:'VT323',ui-monospace,monospace;
  font-size:26px;color:var(--dim);opacity:.85;letter-spacing:.06em}
</style></head><body>
<div class="card">
  <div class="neb"></div>
  ${cardSky(W, H)}
  <div class="fg">
    <div class="eyebrow">generative genre space</div>
    <h1>STELLATE</h1>
    <div class="rule"></div>
    <div class="tag">draw a path through genre space</div>
    <div class="sub">274 genres &middot; generated live in your browser &middot; deterministic from a seed</div>
  </div>
  <div class="credit">by Paul Ford &middot; Aboard &middot; stellate.app</div>
</div></body></html>`;
}

// The mark: a constellation in a rounded dark field. Everything is drawn in a
// 0..100 viewBox so the SAME markup is crisp at 180px and legible at 32px —
// nodes stay ~6px across even in a tab strip. Deliberately no text: "STELLATE"
// in Orbitron is unreadable mush below ~64px, a 4-star path is not.
function iconHtml(size) {
  // Below ~64px every decorative pixel is a liability: at 32 the dust turns to
  // noise and a donut node fills in anyway. So the small mark sheds the dust,
  // fattens the stroke and draws solid nodes. Same shape, fewer lies.
  const small = size < 64;
  const rnd = mulberry32(0x1c04a5); // fixed seed; the dust never moves between runs
  const dust = [];
  for (let i = 0; small ? false : i < 22; i++) {
    const x = +(rnd() * 100).toFixed(1), y = +(rnd() * 100).toFixed(1);
    dust.push(`<circle cx="${x}" cy="${y}" r="${(0.9 + rnd() * 1.1).toFixed(2)}" fill="#dcd8ff" opacity="${(0.2 + rnd() * 0.45).toFixed(2)}"/>`);
  }
  // an S-shaped 4-node walk: reads as a path AND echoes the initial
  const pts = [[26, 24], [70, 36], [30, 64], [74, 78]];
  const poly = pts.map((p) => p.join(",")).join(" ");
  const nodes = pts.map((p, i) => {
    const c = i === 0 ? PAL.amber : PAL.pink;
    return small
      ? `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 11 : 9.5}" fill="${c}"/>`
      : `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 8.5 : 7}" fill="#0c0a1a" stroke="${c}" stroke-width="${i === 0 ? 5 : 4.4}"/>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}
html,body{width:${size}px;height:${size}px;overflow:hidden;background:transparent}
svg{display:block;width:${size}px;height:${size}px}
.glow{filter:drop-shadow(0 0 ${small ? "0.7" : "2.2"}px rgba(255,110,199,.85))}
</style></head><body>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="field" cx="72%" cy="20%" r="95%">
      <stop offset="0%" stop-color="#221a4d"/><stop offset="62%" stop-color="#0f0c22"/>
      <stop offset="100%" stop-color="#0c0a1a"/>
    </radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PAL.amber}"/><stop offset="52%" stop-color="${PAL.pink}"/>
      <stop offset="100%" stop-color="${PAL.cyan}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100" height="100" rx="${small ? 16 : 22}" fill="url(#field)"/>
  <rect x="${small ? 1.8 : 1.4}" y="${small ? 1.8 : 1.4}" width="${small ? 96.4 : 97.2}" height="${small ? 96.4 : 97.2}"
    rx="${small ? 15 : 21}" fill="none" stroke="url(#edge)" stroke-width="${small ? 3.6 : 2.8}" opacity=".92"/>
  <g>${dust.join("")}</g>
  <g class="glow">
    <polyline points="${poly}" fill="none" stroke="${PAL.pink}" stroke-width="${small ? 7.5 : 5.2}"
      stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>
    ${nodes}
  </g>
</svg></body></html>`;
}

/* ------------------------------------------------------------------ render */

async function shoot(browser, html, w, h, out, opts) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const buf = await page.screenshot({ type: "png", omitBackground: !!(opts && opts.transparent) });
  fs.writeFileSync(out, buf);
  await page.close();
  return buf;
}

/* ------------------------------------------------------------------- .ico */

// A .ico is a 6-byte ICONDIR + one 16-byte ICONDIRENTRY per image, then the
// payloads. Since Vista the payload may be a whole PNG file verbatim, which is
// what every modern browser prefers — so no BMP/DIB encoder is needed here.
function pngToIco(png) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);   // reserved
  dir.writeUInt16LE(1, 2);   // type 1 = icon
  dir.writeUInt16LE(1, 4);   // image count
  const ent = Buffer.alloc(16);
  ent.writeUInt8(32, 0);     // width  (32; 0 would mean 256)
  ent.writeUInt8(32, 1);     // height
  ent.writeUInt8(0, 2);      // palette colours (0 = truecolour)
  ent.writeUInt8(0, 3);      // reserved
  ent.writeUInt16LE(1, 4);   // colour planes
  ent.writeUInt16LE(32, 6);  // bits per pixel
  ent.writeUInt32LE(png.length, 8);  // payload size
  ent.writeUInt32LE(22, 12);         // payload offset (6 + 16)
  return Buffer.concat([dir, ent, png]);
}

// Re-read what we wrote and assert the 22 header bytes describe the file.
function verifyIco(file) {
  const b = fs.readFileSync(file);
  const problems = [];
  if (b.readUInt16LE(0) !== 0) problems.push("reserved != 0");
  if (b.readUInt16LE(2) !== 1) problems.push("type != 1");
  if (b.readUInt16LE(4) !== 1) problems.push("count != 1");
  const w = b.readUInt8(6) || 256, h = b.readUInt8(7) || 256;
  if (w !== 32 || h !== 32) problems.push(`dims ${w}x${h} != 32x32`);
  const len = b.readUInt32LE(14), off = b.readUInt32LE(18);
  if (off !== 22) problems.push(`offset ${off} != 22`);
  if (off + len !== b.length) problems.push(`size ${off}+${len} != file ${b.length}`);
  const sig = b.slice(off, off + 8);
  if (!sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) problems.push("payload is not a PNG");
  if (problems.length) throw new Error("favicon.ico malformed: " + problems.join("; "));
  return `${w}x${h} PNG payload, ${len}B at offset ${off}`;
}

/* -------------------------------------------------------------------- main */

function report(file) {
  const n = fs.statSync(file).size;
  const kb = (n / 1024).toFixed(1);
  console.log(`  ${file}  ${n} B (${kb} KB)`);
  return n;
}

async function main() {
  const args = process.argv.slice(2);
  const only = { card: args.includes("--card"), icons: args.includes("--icons") };
  const doCard = only.card || !only.icons;
  const doIcons = only.icons || !only.card;

  fs.mkdirSync(ASSETS, { recursive: true });
  const fonts = doCard ? await fontCss() : "";

  const browser = await launchChromium();
  try {
    if (doCard) {
      const out = path.join(ASSETS, "og-card.png");
      await shoot(browser, cardHtml(fonts), 1200, 630, out);
      const n = report(out);
      if (n > 300 * 1024)
        console.warn("  !! card is over 300KB — drop the star count or the glow blur (never add a dep)");
    }
    if (doIcons) {
      const p180 = path.join(ASSETS, "icon-180.png");
      await shoot(browser, iconHtml(180), 180, 180, p180);
      report(p180);

      // PWA install icons (manifest.webmanifest): 192 is the Android home
      // screen, 512 the splash/store size. Same 0..100 viewBox mark — it is
      // vector all the way down, so the big sizes are just as crisp.
      for (const n of [192, 512]) {
        const p = path.join(ASSETS, `icon-${n}.png`);
        await shoot(browser, iconHtml(n), n, n, p);
        report(p);
      }

      const p32 = path.join(ASSETS, "icon-32.png");
      const png32 = await shoot(browser, iconHtml(32), 32, 32, p32);
      report(p32);

      const ico = path.join(ASSETS, "favicon.ico");
      fs.writeFileSync(ico, pngToIco(png32));
      report(ico);
      console.log("  favicon.ico verified: " + verifyIco(ico));
    }
  } finally {
    await browser.close();
  }
  console.log("done.");
}

main().catch((e) => { console.error(e); process.exit(1); });

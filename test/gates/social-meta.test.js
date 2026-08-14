#!/usr/bin/env node
// social-meta.test.js — THE UNFURL CONTRACT (pure node, no browser, ~10ms).
//
//   node test/gates/social-meta.test.js
//
// A share card is invisible from inside the app: you only find out it broke when
// someone pastes a link into Slack and gets a grey rectangle. So the tags are
// gated like anything else. This asserts, per page:
//   - the basics: description, canonical, theme-color, author
//   - the full Open Graph set (title/description/type/url/site_name + image with
//     width/height/alt) — Slack/Discord/Facebook/LinkedIn read these
//   - the Twitter card (summary_large_image + title/description/image/creator)
//   - the oEmbed discovery <link> (Mastodon/WordPress/Discourse/Notion read it)
//   - the JSON-LD block PARSES and carries the required attribution:
//     author Person "Paul Ford", creator/publisher Organization "Aboard" at
//     aboard.com, MIT license, applicationCategory MusicApplication
//   - every referenced local asset (icons, og-card) EXISTS on disk — an og:image
//     that 404s is worse than no og:image, and these are generated files
//     (tools/build/gen-og-card.js), so a fresh clone that skipped the recipe fails here
//   - the HUMAN-VISIBLE attribution: a link to https://aboard.com in the page
//     body, not only in metadata (the whole point of the ask)
//   - /oembed.json is valid JSON with the required oEmbed 1.0 fields
//
// It also carries two cross-page contracts, because
// there is nowhere better and it is the gate that already reads every page:
//   - NO DRIFT. The head is duplicated on all five pages on purpose (no build
//     step for HTML). The tags that describe the SITE rather than the page
//     (SITE_WIDE below) must therefore be byte-identical everywhere.
//   - THE CSP INVARIANT. Zero inline <script>, zero on*= handler attributes and
//     zero javascript: URLs in the six committed pages, so the production
//     Content-Security-Policy can keep script-src WITHOUT 'unsafe-inline'.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");

const fails = [], notes = [];
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const has = (html, re, label, file) => { if (!re.test(html)) fails.push(`${file}: missing ${label}`); };
// <meta name|property="X" content="…"> in either attribute order
const meta = (k, kind) => new RegExp(`<meta[^>]*\\b${kind}\\s*=\\s*["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*\\bcontent\\s*=\\s*["'][^"']+["']|<meta[^>]*\\bcontent\\s*=\\s*["'][^"']+["'][^>]*\\b${kind}\\s*=\\s*["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
const contentOf = (html, k, kind) => {
  const m = new RegExp(`<meta[^>]*\\b${kind}\\s*=\\s*["']${k}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["']`, "i").exec(html);
  return m ? m[1] : null;
};

const OG = ["og:title", "og:description", "og:type", "og:url", "og:image", "og:image:type", "og:image:width", "og:image:height", "og:image:alt", "og:site_name"];
const TW = ["twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt", "twitter:creator", "twitter:site"];
const NAMED = ["description", "author", "theme-color"];

// THE DE-DUPLICATION CONTRACT. HTML has no include and
// this project has no build step for HTML, so the social head is DUPLICATED on
// purpose across five pages — the alternative was a generator that rewrites
// committed markup, which is a worse failure mode (edit the page, forget the
// tool). Duplication is fine; DRIFT is the bug, and drift is what this list
// gates: these tags describe the SITE, not the page, so their values must be
// byte-identical everywhere. (Per-page tags — title/description/url/type — are
// deliberately not here.) The last drift this caught by hand: colophon.html
// carried twitter:creator @ftrain while the other four said @aboard, and
// og:image:type / twitter:image:alt / twitter:site each existed on only one or
// two of the five.
const SITE_WIDE = [["og:site_name", "property"], ["og:image", "property"], ["og:image:type", "property"],
  ["og:image:width", "property"], ["og:image:height", "property"], ["og:image:alt", "property"],
  ["twitter:card", "name"], ["twitter:image", "name"], ["twitter:image:alt", "name"],
  ["twitter:site", "name"], ["twitter:creator", "name"]];

// og:image variants are page-specific; embed.html is intentionally noindex and
// canonicalises to the app root, so it is checked with the same tag set.
const PAGES = ["index.html", "access.html", "embed.html", "how.html", "colophon.html", "daw.html", "ca.html", "fugue.html", "spec.html"];
const NEEDS_OEMBED = new Set(["index.html", "access.html", "embed.html"]);
const NEEDS_JSONLD = new Set(["index.html", "access.html"]);

for (const f of PAGES) {
  let html;
  try { html = read(f); } catch (e) { fails.push(`${f}: not found`); continue; }
  for (const k of NAMED) has(html, meta(k, "name"), `<meta name="${k}">`, f);
  has(html, /<link[^>]*\brel\s*=\s*["']canonical["'][^>]*\bhref\s*=\s*["']https:\/\/stellate\.app\//i, 'rel="canonical" on https://stellate.app/', f);
  for (const k of OG) has(html, meta(k, "property"), `<meta property="${k}">`, f);
  for (const k of TW) has(html, meta(k, "name"), `<meta name="${k}">`, f);
  if (contentOf(html, "twitter:card", "name") !== "summary_large_image")
    fails.push(`${f}: twitter:card must be summary_large_image`);
  // og:image must be ABSOLUTE (a crawler resolves nothing) and 1200x630
  const img = contentOf(html, "og:image", "property");
  if (img && !/^https:\/\//.test(img)) fails.push(`${f}: og:image must be an absolute https URL (got ${img})`);
  if (contentOf(html, "og:image:width", "property") !== "1200" || contentOf(html, "og:image:height", "property") !== "630")
    fails.push(`${f}: og:image:width/height must be 1200/630 (the card tools/build/gen-og-card.js actually renders)`);
  // icons: relative (this tree is also served under a sub-path) and present
  for (const [re, want] of [[/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i, "rel=icon"],
                            [/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i, "apple-touch-icon"]]) {
    const m = re.exec(html);
    if (!m) { fails.push(`${f}: missing ${want}`); continue; }
    if (/^https?:|^\//.test(m[1])) fails.push(`${f}: ${want} href must be RELATIVE (${m[1]}) — the tree is also served at /projects/stellate/`);
    else if (!fs.existsSync(path.join(ROOT, m[1]))) fails.push(`${f}: ${want} points at ${m[1]}, which does not exist — run \`node tools/build/gen-og-card.js\``);
  }
  if (NEEDS_OEMBED.has(f))
    has(html, /<link[^>]*type\s*=\s*["']application\/json\+oembed["']/i, "oEmbed discovery <link>", f);
  if (NEEDS_JSONLD.has(f)) {
    const m = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!m) { fails.push(`${f}: no JSON-LD block`); }
    else {
      let ld; try { ld = JSON.parse(m[1]); } catch (e) { fails.push(`${f}: JSON-LD does not parse — ${e.message}`); }
      if (ld) {
        if (ld["@type"] !== "WebApplication") fails.push(`${f}: JSON-LD @type should be WebApplication (got ${ld["@type"]})`);
        if (ld.applicationCategory !== "MusicApplication") fails.push(`${f}: JSON-LD applicationCategory must be MusicApplication`);
        if (!(ld.author && ld.author.name === "Paul Ford")) fails.push(`${f}: JSON-LD author must be Person "Paul Ford"`);
        for (const k of ["creator", "publisher"]) {
          const o = ld[k];
          if (!(o && o.name === "Aboard" && /aboard\.com/.test(o.url || "")))
            fails.push(`${f}: JSON-LD ${k} must be Organization "Aboard" at aboard.com`);
        }
        if (!/MIT/i.test(String(ld.license || ""))) fails.push(`${f}: JSON-LD license must name MIT`);
      }
    }
  }
  // THE ASK: a human-visible link to aboard.com, in the body, not just metadata.
  const body = html.slice(html.search(/<body\b/i));
  if (!/href=["']https:\/\/aboard\.com/i.test(body))
    fails.push(`${f}: no VISIBLE link to https://aboard.com in the page body (metadata alone doesn't satisfy the attribution ask)`);
  if (!/Paul Ford/.test(body)) fails.push(`${f}: "Paul Ford" does not appear in the visible page`);
}

// ── the site-wide tags must not have drifted apart ──────────────────────────
{
  const html = Object.fromEntries(PAGES.map((f) => [f, read(f)]));
  for (const [k, kind] of SITE_WIDE) {
    const seen = new Map();
    for (const f of PAGES) {
      const v = contentOf(html[f], k, kind);
      if (v == null) continue;              // absence is already a failure above
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push(f);
    }
    if (seen.size > 1)
      fails.push(`${k} has drifted across the pages — it describes the SITE, so every page must agree: ` +
        [...seen].map(([v, fs_]) => `${JSON.stringify(v)} on ${fs_.join("+")}`).join("  vs  "));
  }
}

// ── THE CSP INVARIANT: no inline script anywhere in the committed pages ─────
// how.html's inline <script> was the SOLE reason the Content-Security-Policy
// still had to carry `script-src 'unsafe-inline'` (docs/HOSTING.md §4). It
// lives in app/entries/how.js and the token came out of the
// policy. One inline <script>, one on*= attribute or one javascript: URL added
// back here silently breaks that page IN PRODUCTION ONLY — the dev server sends
// no CSP, so nothing local would ever catch it. Hence this gate.
//
// `<script type="application/ld+json">` is DATA, not script: CSP never executes
// it and script-src does not apply. It is allowed, and only it.
let CSP_COUNT = 0;
{
  const CSP_PAGES = ["index.html", "access.html", "embed.html", "how.html", "colophon.html", "404.html", "daw.html",
                     "nukernel/kernel-daw.html"];
  CSP_COUNT = CSP_PAGES.length;
  const ON_ATTR = /\son[a-z]+\s*=\s*["']/gi;
  for (const f of CSP_PAGES) {
    const html = read(f);
    const scripts = html.match(/<script\b[^>]*>/gi) || [];
    for (const tag of scripts) {
      if (/\bsrc\s*=/i.test(tag)) continue;                       // external: fine
      if (/type\s*=\s*["']application\/ld\+json["']/i.test(tag)) continue;   // data, not script
      fails.push(`${f}: inline <script> (${tag.trim()}) — it would be blocked by the production CSP; ` +
        `move it to a file under app/ the way how.html's starfield became app/entries/how.js`);
    }
    const on = html.match(ON_ATTR);
    if (on) fails.push(`${f}: inline event handler attribute(s) ${[...new Set(on.map((s) => s.trim()))].join(", ")} — ` +
      `CSP script-src without 'unsafe-inline' blocks these; bind the listener in JS instead`);
    if (/["'(]\s*javascript:/i.test(html))
      fails.push(`${f}: a javascript: URL — blocked by the production CSP`);
  }
}

// ── /oembed.json ────────────────────────────────────────────────────────────
try {
  const o = JSON.parse(read("oembed.json"));
  for (const k of ["version", "type", "provider_name", "provider_url", "title", "author_name", "html", "width", "height"])
    if (o[k] == null) fails.push(`oembed.json: missing required field "${k}"`);
  if (o.version !== "1.0") fails.push("oembed.json: version must be the string \"1.0\"");
  if (o.type !== "rich") fails.push('oembed.json: type must be "rich" (we hand back an <iframe>)');
  if (!/<iframe/i.test(String(o.html))) fails.push("oembed.json: html must contain an <iframe>");
  for (const attr of ["title=", "loading=", "allow=", "referrerpolicy="])
    if (!String(o.html).includes(attr)) fails.push(`oembed.json: the iframe html is missing ${attr}`);
  if (o.thumbnail_url && !/^https:\/\//.test(o.thumbnail_url)) fails.push("oembed.json: thumbnail_url must be absolute");
} catch (e) { fails.push("oembed.json: " + e.message); }

// ── the generated art itself ────────────────────────────────────────────────
for (const a of ["assets/og-card.png", "assets/icon-32.png", "assets/icon-180.png", "assets/favicon.ico"]) {
  const p = path.join(ROOT, a);
  if (!fs.existsSync(p)) { fails.push(`${a} is missing — run \`node tools/build/gen-og-card.js\``); continue; }
  const n = fs.statSync(p).size;
  if (n < 400) fails.push(`${a} is only ${n} bytes — regenerate it`);
  if (a.endsWith("og-card.png") && n > 400000) notes.push(`${a} is ${(n / 1024) | 0}KB — crawlers are happier under ~300KB`);
}
if (!fs.existsSync(path.join(ROOT, "tools/build/gen-og-card.js")))
  fails.push("tools/build/gen-og-card.js is missing — the card/icons must stay REGENERABLE, not hand-made");

for (const n of notes) console.log("  *** NOTICE: " + n);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  console.log(`\nsocial-meta: FAIL — ${fails.length} problem(s)`);
  process.exit(1);
}
console.log(`social-meta: PASS — ${PAGES.length} pages carry a complete + non-drifted OG/Twitter/JSON-LD/oEmbed head, visible Paul Ford + Aboard attribution, every referenced asset exists, and ${CSP_COUNT} pages carry ZERO inline script (the CSP invariant)`);
process.exit(0);

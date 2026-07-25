#!/usr/bin/env node
// social-meta.test.js — THE UNFURL CONTRACT (pure node, no browser, ~10ms).
//
//   node test/social-meta.test.js
//
// A share card is invisible from inside the app: you only find out it broke when
// someone pastes a link into Slack and gets a grey rectangle. So the tags are
// gated like anything else. This asserts, per page:
//   - the basics: description, canonical, theme-color, author
//   - the full Open Graph set (title/description/type/url/site_name + image with
//     width/height/alt) — Slack/Discord/Facebook/LinkedIn read these
//   - the Twitter card (summary_large_image + title/description/image/creator)
//   - the oEmbed discovery <link> (Mastodon/WordPress/Discourse/Notion read it)
//   - the JSON-LD block PARSES and carries the attribution Paul asked for:
//     author Person "Paul Ford", creator/publisher Organization "Aboard" at
//     aboard.com, MIT license, applicationCategory MusicApplication
//   - every referenced local asset (icons, og-card) EXISTS on disk — an og:image
//     that 404s is worse than no og:image, and these are generated files
//     (tools/gen-og-card.js), so a fresh clone that skipped the recipe fails here
//   - the HUMAN-VISIBLE attribution: a link to https://aboard.com in the page
//     body, not only in metadata (the whole point of the ask)
//   - /oembed.json is valid JSON with the required oEmbed 1.0 fields
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const fails = [], notes = [];
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const has = (html, re, label, file) => { if (!re.test(html)) fails.push(`${file}: missing ${label}`); };
// <meta name|property="X" content="…"> in either attribute order
const meta = (k, kind) => new RegExp(`<meta[^>]*\\b${kind}\\s*=\\s*["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*\\bcontent\\s*=\\s*["'][^"']+["']|<meta[^>]*\\bcontent\\s*=\\s*["'][^"']+["'][^>]*\\b${kind}\\s*=\\s*["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
const contentOf = (html, k, kind) => {
  const m = new RegExp(`<meta[^>]*\\b${kind}\\s*=\\s*["']${k}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["']`, "i").exec(html);
  return m ? m[1] : null;
};

const OG = ["og:title", "og:description", "og:type", "og:url", "og:image", "og:image:width", "og:image:height", "og:image:alt", "og:site_name"];
const TW = ["twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:creator"];
const NAMED = ["description", "author", "theme-color"];

// og:image variants are page-specific; embed.html is intentionally noindex and
// canonicalises to the app root, so it is checked with the same tag set.
const PAGES = ["index.html", "access.html", "embed.html", "how.html"];
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
    fails.push(`${f}: og:image:width/height must be 1200/630 (the card tools/gen-og-card.js actually renders)`);
  // icons: relative (this tree is also served under a sub-path) and present
  for (const [re, want] of [[/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i, "rel=icon"],
                            [/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i, "apple-touch-icon"]]) {
    const m = re.exec(html);
    if (!m) { fails.push(`${f}: missing ${want}`); continue; }
    if (/^https?:|^\//.test(m[1])) fails.push(`${f}: ${want} href must be RELATIVE (${m[1]}) — the tree is also served at /projects/stellate/`);
    else if (!fs.existsSync(path.join(ROOT, m[1]))) fails.push(`${f}: ${want} points at ${m[1]}, which does not exist — run \`node tools/gen-og-card.js\``);
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
  if (!fs.existsSync(p)) { fails.push(`${a} is missing — run \`node tools/gen-og-card.js\``); continue; }
  const n = fs.statSync(p).size;
  if (n < 400) fails.push(`${a} is only ${n} bytes — regenerate it`);
  if (a.endsWith("og-card.png") && n > 400000) notes.push(`${a} is ${(n / 1024) | 0}KB — crawlers are happier under ~300KB`);
}
if (!fs.existsSync(path.join(ROOT, "tools/gen-og-card.js")))
  fails.push("tools/gen-og-card.js is missing — the card/icons must stay REGENERABLE, not hand-made");

for (const n of notes) console.log("  *** NOTICE: " + n);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  console.log(`\nsocial-meta: FAIL — ${fails.length} problem(s)`);
  process.exit(1);
}
console.log(`social-meta: PASS — ${PAGES.length} pages carry a complete OG/Twitter/JSON-LD/oEmbed head, visible Paul Ford + Aboard attribution, and every referenced asset exists`);
process.exit(0);

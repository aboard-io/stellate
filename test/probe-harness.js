#!/usr/bin/env node
// faust/probe-harness.js — shared headless-probe plumbing for the live/press
// verification probes (live-test-run.js + probe-*.js). One static file server +
// one chromium-borrow + one page-error tap, so the probes don't each re-carry
// the same ~30 lines. Playwright + chromium are borrowed the same way as always
// (NODE_PATH=/home/ford/ftrain-2025/node_modules, the pinned ms-playwright
// chromium-1217 build).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".wasm": "application/wasm", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };
  // ".css" added for the app/ CSS split (2026-07-08): index.html now loads app/app.css
  // via <link rel=stylesheet>. Chromium (standards mode) refuses a stylesheet served
  // as application/octet-stream, which would leave #map unsized and break the layout
  // gate. Real nginx serves .css as text/css already; this mirrors it for the probes.

// static file server rooted at `root`, listening on `port`; resolves the server.
function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(root, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { console.error("probe-harness 404:", req.url); rsp.writeHead(404); return rsp.end(); }
      // COOP/COEP: cross-origin isolation, required for the ring engine's
      // SharedArrayBuffer (mirrors serve.sh — the deployed nginx sends these too)
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, () => res(srv));
  });
}

// launch the pinned headless chromium (autoplay allowed, no sandbox).
// opts.requireChromium: when TRUE (live-test-run's strict gate), THROW if the
// pinned build is missing; when false/omitted (the probes), fall back to
// playwright's bundled browser instead.
async function launchChromium(opts) {
  opts = opts || {};
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const launchOpts = { headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] };
  if (fs.existsSync(exe)) launchOpts.executablePath = exe;
  else if (opts.requireChromium) throw new Error("chromium-1217 not found at " + exe);
  return chromium.launch(launchOpts);
}

// wire pageerror + console-error capture; returns the growing errors array.
function capturePageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  return errors;
}

module.exports = { MIME, serve, launchChromium, capturePageErrors };

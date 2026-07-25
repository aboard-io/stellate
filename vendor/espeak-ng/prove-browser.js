#!/usr/bin/env node
// prove-browser.js — headless-chromium proof that the trimmed espeak-ng
// artifact loads and synthesizes in a real browser page served with the
// production COOP/COEP headers (require-corp; see serve.sh / docs/HOSTING.md).
//
//   node vendor/espeak-ng/prove-browser.js
//
// Serves the repo root same-origin (so espeak-ng.data needs no CORP/ACAO),
// dynamically imports the ES-module glue, synthesizes the same phrase as
// prove.js, and checks the PCM sha256 matches the node-side hash — the
// fresh-instance determinism guarantee holds across runtimes.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

// same-text hash from prove.js ("Now arriving.", en-us voice, fresh instance)
const EXPECTED_A_SHA = "c110d8c3529ca7b574a859b861eda499cc79763ed963040e370c610043ade9f2";

const ROOT = path.join(__dirname, "..", "..");
const PAGE = "<!doctype html><title>espeak prove</title>";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".data": "application/octet-stream" };

function serve(port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const headers = {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      };
      if (url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      if (url === "/prove.html") {
        rsp.writeHead(200, { ...headers, "Content-Type": "text/html" });
        return rsp.end(PAGE);
      }
      const p = path.normalize(path.join(ROOT, url));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        rsp.writeHead(404);
        return rsp.end();
      }
      rsp.writeHead(200, { ...headers, "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, () => res(srv));
  });
}

async function main() {
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const launchOpts = { headless: true, args: ["--no-sandbox"] };
  if (fs.existsSync(exe)) launchOpts.executablePath = exe;

  const port = 8791;
  const srv = await serve(port);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${port}/prove.html`);

  const result = await page.evaluate(async () => {
    const t0 = performance.now();
    const { default: initEspeak } = await import("/vendor/espeak-ng/espeak-ng.js");
    const m = await initEspeak();
    const worker = new m.eSpeakNGWorker();
    const initMs = performance.now() - t0;
    const rc = worker.set_voice("en-us", "en", 0, 0);

    const chunks = [];
    const t1 = performance.now();
    worker.synthesize("Now arriving.", (samples) => {
      if (samples && samples.length > 0) chunks.push(samples.slice());
      return false;
    });
    const synthMs = performance.now() - t1;

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Int16Array(total);
    let o = 0;
    for (const c of chunks) { pcm.set(c, o); o += c.length; }

    const digest = await crypto.subtle.digest("SHA-256", pcm.buffer);
    const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return {
      crossOriginIsolated: self.crossOriginIsolated,
      setVoiceRc: rc,
      samplerate: worker.get_samplerate(),
      samples: pcm.length,
      sha,
      initMs: Math.round(initMs),
      synthMs: Math.round(synthMs),
    };
  });

  await browser.close();
  srv.close();

  console.log(JSON.stringify(result, null, 2));
  let pass = true;
  const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) pass = false; };
  check("page is cross-origin isolated (require-corp survives)", result.crossOriginIsolated === true);
  check("set_voice ok", result.setVoiceRc === 0);
  check("samplerate 22050", result.samplerate === 22050);
  check("browser PCM sha matches node fresh-instance sha", result.sha === EXPECTED_A_SHA);
  check("no page errors", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  console.log(pass ? "\nALL GREEN (browser)" : "\nFAILURES PRESENT (browser)");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

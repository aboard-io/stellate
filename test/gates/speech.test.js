// speech.test.js — pure-node gates for the SPEECH organ (engine/speech.js).
//   node test/gates/speech.test.js
//
// Gates: synthesis determinism (two synth() calls of the same text — each a
// FRESH espeak instance, the artifact's law — hash byte-equal), upsampler
// exactness (2x length, midpoint values, int16-domain math), cache-key
// canonicalization (the one key every consumer shares), available()'s false
// path (vendor/ temporarily hidden in a child process — never throws, resolves
// false), and the genre-kernel worked example (the transitwave PA announcement
// text is a pure function of the seed; absent for every other genre).
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const S = require("../../engine/speech.js");
const K = require("../../engine/genre-kernel.js");

const ROOT = path.join(__dirname, "..", "..");
let fails = 0;
async function gate(name, fn) {
  try { await fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sha = (f32) => crypto.createHash("sha256")
  .update(Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength)).digest("hex");

(async () => {

  // 1) determinism: same text twice -> byte-equal PCM (fresh instance per call)
  await gate("synth_determinism", async () => {
    const text = "Now arriving: The Commuters.";
    const opts = { voice: "en-us", variant: "f3", pitch: 60, speed: 165 };
    const a = await S.synth(text, opts);
    const b = await S.synth(text, opts);
    assert(a.sr === 44100 && b.sr === 44100, "sr must be 44100, got " + a.sr);
    assert(a.pcm.length > 44100 / 2, "suspiciously short: " + a.pcm.length + " samples");
    assert(a.pcm.length === b.pcm.length, "length drift: " + a.pcm.length + " vs " + b.pcm.length +
      " (same-instance reuse? the artifact law requires a FRESH worker per call)");
    assert(sha(a.pcm) === sha(b.pcm), "PCM not byte-identical across two synth() calls");
    let peak = 0; for (let i = 0; i < a.pcm.length; i++) { const v = Math.abs(a.pcm[i]); if (v > peak) peak = v; }
    assert(peak > 0.2 && peak <= 0.9001, "peak-normalize target off: peak=" + peak.toFixed(3));
  });

  // 2) upsampler exactness: 2x length, first-sample copy, exact midpoints, tail hold
  await gate("upsampler_exact", async () => {
    const x = new Int16Array([0, 100, -50, 32767, -32768]);
    const y = S._up2(x);
    assert(y.length === 2 * x.length, "length " + y.length + " != " + 2 * x.length);
    const want = [0, 50, 100, 25, -50, 16358.5, 32767, -0.5, -32768, -32768];
    for (let i = 0; i < want.length; i++)
      assert(y[i] === want[i], "y[" + i + "] = " + y[i] + " != " + want[i]);
    assert(S._up2(new Int16Array(0)).length === 0, "empty in, empty out");
    const one = S._up2(new Int16Array([7]));
    assert(one.length === 2 && one[0] === 7 && one[1] === 7, "single-sample hold");
  });

  // 3) cache-key canonicalization (the one key all consumers share)
  await gate("key_canonical", async () => {
    assert(S.key("hello") === "speech:v=en-us;p=50;s=175;hello", "defaults: " + S.key("hello"));
    assert(S.key("hello", {}) === S.key("hello"), "empty opts == defaults");
    assert(S.key("hello", { voice: "en-us", pitch: 50, speed: 175 }) === S.key("hello"),
      "explicit defaults must canonicalize to the same key");
    assert(S.key("hi", { variant: "f3", pitch: 60, speed: 165 }) === "speech:v=en-us+f3;p=60;s=165;hi",
      "variant/pitch/speed: " + S.key("hi", { variant: "f3", pitch: 60, speed: 165 }));
    assert(S.key("a") !== S.key("b"), "text must differentiate");
    assert(S.key("a", { pitch: 49.6 }) === S.key("a", { pitch: 50 }), "pitch rounds to int");
  });

  // 4) available(): true here (vendor/ committed), FALSE (not a throw) when
  // vendor/espeak-ng is hidden — probed in a CHILD process because this
  // process's organ has already cached its probe (and maybe the wasm).
  await gate("available_false_path", async () => {
    assert((await S.available()) === true, "vendor/ present but available() false");
    const dir = path.join(ROOT, "vendor", "espeak-ng");
    const hid = path.join(ROOT, "vendor", ".espeak-ng.hidden");
    fs.renameSync(dir, hid);
    try {
      const out = execFileSync(process.execPath, ["-e",
        "require(" + JSON.stringify(path.join(ROOT, "engine", "speech.js")) + ").available()" +
        ".then(v => console.log('AVAIL=' + v), e => console.log('THREW=' + e.message));"],
        { encoding: "utf8" });
      assert(out.includes("AVAIL=false"), "hidden vendor: expected AVAIL=false, got " + out.trim());
    } finally { fs.renameSync(hid, dir); }
  });

  // 5) worked example: the transitwave PA text is a pure function of the seed
  await gate("namebank_text_determinism", async () => {
    const pa = (seed) => K.track("transitwave", { seed }).foundSources.find((s) => s.id === "sp_pa_namebank");
    const a = pa(5), b = pa(5);
    assert(a && a.synthText && a.synthText.text, "transitwave s5 has no PA source");
    assert(a.synthText.text === b.synthText.text, "same seed, different text");
    assert(/^(Now arriving: .+\.|.+, with service to .+\.)$/.test(a.synthText.text),
      "unexpected announcement shape: " + a.synthText.text);
    assert(pa(5).synthText.text !== pa(6).synthText.text || pa(5).synthText.text !== pa(7).synthText.text,
      "text never varies with seed");
    assert(!a.samplePath && !a.url, "synthText source must carry no file path/url");
    // ABSENT = BYTE-IDENTICAL law: a genre that asks for no speech grows no
    // synthText source. The controls used to be techno/vaporwave/spokenword,
    // which stopped being silent when the IDENT tier shipped and stopped being
    // a fair test of this law: techno's form is `dj`, so it now speaks a station
    // ident by design, and vaporwave draws `sp_plaza`/`sp_shopping` — synthesized
    // one-shots — into its hits pool. Neither is a defect; the gate was asserting
    // a law the engine had deliberately superseded, and it has been failing on
    // techno ever since. The controls are now genres that genuinely say nothing
    // at any seed (108 of the 274 do): a pop/aaba form, no ident form, no
    // bespoke SPEAKERS entry, no spoken source in any pool they draw.
    for (const g of ["blues", "jazz", "bossanova"]) {
      const st = K.track(g, { seed: 5 });
      assert(!st.foundSources.some((s) => s.synthText), g + " grew a synthText source");
      assert(!(st.sampleEvents || []).some((e) => (e.pool || []).includes("sp_pa_namebank")),
        g + " grew the PA sample-event");
    }
    // …and the POSITIVE half, which is what `sp_pa_namebank` actually is: one
    // shared id for every spoken identity, bespoke speaker or derived ident (the
    // name is historical — it began as transitwave's PA). An ident-form genre
    // must grow it, and the line must be one of the four station FRAMES rather
    // than a discography entry recited. Every ident genre reaches an ARTIST-led
    // frame now that all 65 have a NameBank bank; before, a bankless genre was
    // restricted to the two label-led ones.
    const FRAME = /^(You're listening to .+\.|That was .+, right here on .+\.|Next up: .+\.|This is .+ radio\.)$/;
    let identGenres = 0, artistLed = 0;
    for (const g of Object.keys(K.GENRES)) {
      if (!["dj", "drop", "vamp"].includes(K.GENRES[g].form || "pop")) continue;
      for (const seed of [1, 3, 5, 7, 11, 13]) {
        const src = K.track(g, { seed }).foundSources.find((s) => s.id === "sp_pa_namebank");
        const t = src && src.synthText && src.synthText.text;
        if (!t || !FRAME.test(t)) continue;          // bespoke SPEAKERS genres say their own thing
        identGenres++;
        if (/^(You're listening to|That was |Next up: )/.test(t)) artistLed++;
        assert(!/\.\./.test(t), g + ": doubled sentence stop in " + JSON.stringify(t));
        assert(!/[A-Z]{4,}/.test(t.replace(/^(You're listening to|That was |Next up: |This is )/, "")),
          g + ": shouted name in a spoken frame — " + JSON.stringify(t));
        break;
      }
    }
    assert(identGenres >= 55, "only " + identGenres + " ident genres speak a station frame (want >=55)");
    assert(artistLed >= 40, "only " + artistLed + " ident genres reached an ARTIST-led frame (want >=40)");
  });

  console.log(fails ? "\nFAILURES" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();

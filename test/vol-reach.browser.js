#!/usr/bin/env node
/* test/vol-reach.browser.js — EVERY LEVEL CONTROL, DRAGGED FOR REAL, PROVED AT
 * THE SOUND (2026-08-30, the volume-census round).
 *
 * WHY THIS FILE EXISTS. Paul, 2026-08-30: "The volume slider no longer works
 * at all." The fader was proven innocent three times over — real touch drags
 * on staging in chromium AND webkit took RMS 0.073 -> 0.000 with the store
 * following — because every probe shared one thing the phone does not: the
 * audio ROUTE. iOS plays the rolling WAV/opus segments on a real <audio>
 * element and SILENTLY IGNORES element.volume (Apple reserves media volume
 * for the buttons), so the slider moved, the store followed, every gate
 * passed, and the phone played on at full level. The fix (06c6e5e, v200)
 * bakes `mvol` into the segments beside vapor. The LAW this gate enforces is
 * the memory's own: "writes the store" may never again masquerade as "works"
 * — so every check here ends at a MEASURED level (the analyser on the ring
 * route, the engine's own baked envelope on the media route, the sounding
 * bar's unit table for the desk), never at an input's value.
 *
 * THE HONEST BOUNDARY, STATED ONCE. The two room faders (#vol, #vol2) ride
 * the engine's master gain OUTSIDE the ring and must land within ~2s. Every
 * DESK control (voice fader, record gain, trim word, bus return) recompiles
 * the score and lands on the next bar the walk asks for — up to the runway
 * (8s deep + the bar in flight), so those checks poll the SOUNDING bar's own
 * unit table (__nuMix — live.js reads barPlan(lastBar), the thing the walk
 * feeds) and give the whole-mix RMS proof a 15s runway before measuring. On
 * the media route the boundary is the segment queue (~16s measured); V7
 * allows 45.
 *
 * WHAT EACH CHECK DRAGS AND WHERE IT LISTENS:
 *   V1 #vol (tray, via #playops): CDP touch to the bottom -> analyser RMS
 *      ~0 within 2s; back up -> sound returns. Store follows both ways.
 *   V2 #vol2 (Mix -> main plate "listening"): same drag, same law — the
 *      desk-gate round only ever proved this one WROTE THE STORE.
 *   V3 every channel voice's own fader (Band -> voice -> mix facet): drag to
 *      -24 dB -> the SOUNDING bar's unit carries x0.0631 on lvl within the
 *      runway; then ALL faders at -24 together -> whole-mix RMS down >= 8 dB
 *      (measured -19.7 on the shipped chant), because a unit table can lie
 *      about a renderer and rendered RMS cannot.
 *   V4 record gain (main plate `level` -> 0.5): a chair cast from the genre's
 *      tone halves its unit lvl (x0.5 +-10%). KNOWN LIMIT, measured this
 *      round and reported rather than hidden: a voice carrying its own native
 *      synth level (the chant's cantor, songs.js level: 0.15) bypasses
 *      tone.gain entirely — document.js toGenre nativeOf is the owner and is
 *      outside this round's fence; when that lands, add the cantor here.
 *   V5 reverb return (Mix -> rev, `bus|rev|ret` -> off): the engine's own
 *      report (__nuMix().master — audio/live.js engineReport, which reads
 *      getState() since 2026-08-30, the state the stream is opened with)
 *      drops its reverb stage, and the RMS delta is PRINTED as a note rather
 *      than gated: the shipped chant's sections swing +-2 dB bar to bar,
 *      which buries the ~2.3 dB wet (measured once, scratch/volcensus1.cjs:
 *      0.1445 -> 0.1110 after the runway). The wet WIRE at the sample level
 *      is tape-reach R5 (rendered offline, deterministic) and is not
 *      re-proved here — this check is that the LIVE state the walk reads per
 *      bar follows the knob, which is the half a live gate can hold without
 *      flaking.
 *   V6 a trim word (`out`) tapped on the SOUNDING section for one voice: the
 *      unit's lvl reaches 0 in the sounding bar while that section plays.
 *   V7 THE PHONE'S FADER (the bug this round was opened for): a second
 *      context wearing an iPhone UA with HTMLMediaElement.volume stubbed
 *      read-only-1 (Apple's own behavior) -> media route -> real drag of
 *      #vol -> the engine's baked envelope (handle.rms off the segments)
 *      reaches ~0 within 45s while element.volume still reads 1 — proof the
 *      level arrived THROUGH THE SEGMENTS, the only rail iOS leaves open.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/vol-reach.browser.js
 *       (stands up its own COOP/COEP server, serve.sh's handler, like gutter)
 */
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const { chromium } = require("playwright");
const path = require("path");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };
const dB = (a, b) => 20 * Math.log10(Math.max(1e-9, a) / Math.max(1e-9, b));

const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

(async () => {
  console.log("\nvol-reach — every level control, dragged for real, proved at the sound");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://localhost:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 },
    hasTouch: true })).newPage();
  p.on("pageerror", (e) => console.log("  pageerror: " + e.message));
  /* THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02, Paul: *"Add a 'silence'
     genre at the top of the genre list. This is a blank state."*) — zero
     voices, so there is no strip to drag and no chair to reach. This gate is
     about a record with a band in it, so it names one in the address: the
     shipped chant, at seed 1 because the boot draws a seed now. */
  await p.goto(PAGE, { waitUntil: "domcontentloaded" });
  /* ...AND THE FIXTURE IS THE SHIPPED CHANT ITSELF, BY NAME (2026-09-02).
     This gate's checks NAME the chant's own players (`cantor`, `schola`),
     and a COMPOSED anchor at Rome 600 names its players `voice`, `voice2`,
     `vocal` — so the address lands the right PLACE and the wrong ROSTER.
     `__eightShipped()` is `CTX.setDocument(a deep copy of songs.js TERMS)`,
     the same document door a link uses; it is the record this file
     inherited from the boot until the box began booting on the blank state
     (Paul: *"Add a 'silence' genre at the top of the genre list. This is a
     blank state."*), asked for by name instead of assumed. */
  await p.evaluate(() => window.__eightShipped && window.__eightShipped());
  await p.waitForTimeout(1200);
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(1500);
  const cdp = await p.context().newCDPSession(p);

  /* the two meters: the analyser (the ear on the ring/direct route) and the
     sounding bar's unit table (the desk's landing, __nuMix) */
  const rms1 = () => p.evaluate(() => {
    const h = window.FaustLive && FaustLive.lastHandle;
    if (h && h.analyser) { const a = h.analyser, buf = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x;
      return Math.sqrt(s / buf.length); }
    const e = window.__nuEngine && window.__nuEngine();
    return e ? +e.rms : 0;
  });
  const avg = async (n, gap) => { const r = []; for (let i = 0; i < n; i++) {
    r.push(await rms1()); await p.waitForTimeout(gap); }
    return r.reduce((a, x) => a + x, 0) / r.length; };
  const mixUnits = () => p.evaluate(() => {
    const m = window.__nuMix && window.__nuMix();
    if (!m) return null;
    const out = { si: m.si, bar: m.bar, units: {} };
    for (const [k, u] of Object.entries(m.units)) out.units[k] = { lvl: u.lvl, drum: u.drum };
    return out;
  });

  /* one real drag on a vchassis track (frac 0 = bottom of the range) */
  const dragTo = async (sel, frac) => {
    await p.evaluate((s) => { const i = document.querySelector(s);
      if (i) (i.closest(".nu-vs-track") || i.parentElement).scrollIntoView({ block: "center" }); }, sel);
    await p.waitForTimeout(300);
    const g = await p.evaluate((s) => { const i = document.querySelector(s);
      if (!i) return null;
      const t = i.closest(".nu-vs-track") || i.parentElement; const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, top: r.y + 12, bot: r.y + r.height - 12 }; }, sel);
    if (!g) return null;
    const yT = g.bot - frac * (g.bot - g.top), yS = (g.top + g.bot) / 2;
    const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? [] : [{ x: g.x, y, radiusX: 6, radiusY: 6 }] });
    await touch("touchStart", yS);
    for (let i = 1; i <= 10; i++) await touch("touchMove", yS + (yT - yS) * i / 10);
    await touch("touchEnd", 0);
    await p.waitForTimeout(200);
    return p.evaluate((s) => document.querySelector(s).value, sel);
  };
  /* restoring is not the thing under test, so it may go through the input's
     own listeners directly — same writer, no gesture */
  const setVal = (sel, v) => p.evaluate(({ s, val }) => {
    const i = document.querySelector(s); if (!i) return null;
    i.value = String(val);
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.dispatchEvent(new Event("change", { bubbles: true }));
    return i.value;
  }, { s: sel, val: v });
  const openBus = async (k) => { await p.evaluate(async (key) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__eightTab("Mix"); await wait(400);
    const t = document.querySelector('[data-k="boardtab|bus|' + key + '"]'); if (t) t.click();
  }, k); await p.waitForTimeout(500); };
  const openVoice = async (n) => { await p.evaluate(async (name) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    /* FOLD FIRST, THEN OPEN (2026-09-02). The gutter is a tree and a mark is a
       TOGGLE — this helper is called once per voice, and without a known
       starting shape the second call would tap a member that is already open
       and CLOSE it, taking `facet-mix` off the page. `__eightUp()` is "fold
       everything", the gesture a hand makes to get back to the tabs. */
    if (window.__eightUp) window.__eightUp();
    window.__eightTab("Band"); await wait(300);
    let btn = document.querySelector('[data-k="tab' + name + '"]');
    /* `[data-k="trayup"]` STOOD HERE AND THERE IS NO ↑ (2026-09-02). Paul:
       *"We should never need the 'up' icon because we can expand multiple
       levels of interface option."* What this fallback meant is "put the
       stripe back where the tabs are", which on a tree is FOLD EVERYTHING —
       `window.__eightUp()` is that gesture and is the shim the nine callers of
       the old walk keep working through. */
    if (!btn) { if (window.__eightUp) { window.__eightUp(); await wait(250); }
      btn = document.querySelector('[data-k="tab' + name + '"]'); }
    if (btn) btn.click(); await wait(300);
    /* THE STRIP IS THE COLUMN SHEET'S SINCE 2026-09-04 (TABLE.md wave 2c) —
       `facet-mix` is deleted with the pane; the head the mark opens carries
       `voiceMix` in its own sheet, opened on arrival. */
    const h = document.querySelector('#pan-band [data-k="tcol|' + name + '"]');
    if (h && h.getAttribute("aria-expanded") !== "true") h.click();
  }, n); await p.waitForTimeout(700); };
  /* THE DESK CHANNEL KEY IS NOT THE UNIT KEY. channelVoicesOf answers "line",
     "line2", "bass"…; the unit table answers "v0", "v1"… — audio/plan.js
     seats the LINE voices in cast order ("A['v' + e._seat]", plan.js:330), so
     a line's unit is v<its index among the lines>. Mapped here once, and
     verified per voice against the module the strip claims. */
  const voiceNames = await p.evaluate(() => {
    const doc = window.__eightDoc();
    const lines = doc.voices.filter((v) => v.kind === "line").map((v) => v.name);
    return window.NuDeskDoc.channelVoicesOf(doc, window.NuGenres.GENRES)
      .map((c) => ({ name: c.voice.name, key: c.key,
                     unit: lines.indexOf(c.voice.name) >= 0
                       ? "v" + lines.indexOf(c.voice.name) : null }));
  });

  /* ---- AND THE RECORD IS WAITED FOR, NOT SLEPT THROUGH (2026-09-02) -----
     `await p.waitForTimeout(9000)` stood after the play press and every check
     below it opens by measuring a BASE it needs to be above 0.01. Nine seconds
     is a bet about how long this machine takes to warm a rack, compile a cast
     and get a stream running, and under the full suite the bet loses: measured,
     V1 read `base 0.0000` and V2 `0.0071` in a run where every drag it went on
     to make worked perfectly (V3-V7 all green off the same page). The chant's
     first section also carries `env: "in"` — it fades in — so even a started
     record is quiet for a few seconds by design.
     SO THE GATE ASKS THE EAR WHEN THE RECORD IS UP. `0.02` is twice the premise
     every check states, so a base measured after this poll is a real reading
     and not a threshold the wait manufactured; the settle after it lets the
     fade finish. If the sound never comes the poll ends anyway and V1 fails
     with `base 0.0000`, which is the honest report of a box that did not play. */
  let upAt = null;
  for (let i = 0; i < 100 && upAt == null; i++) {
    if (await rms1() > 0.02) upAt = (i * 0.25).toFixed(2);
    else await p.waitForTimeout(250);
  }
  await p.waitForTimeout(1500);
  console.log("  note the ring came up at " + upAt + "s after the play press");

  /* ---- V1 #vol, the tray room fader ------------------------------------ */
  {
    const base = await avg(8, 200);
    await p.evaluate(() => document.getElementById("playops").click());
    await p.waitForTimeout(400);
    const v = await dragTo("#vol", 0.0);
    await p.waitForTimeout(1500);
    const low = await avg(6, 200);
    const store = await p.evaluate(() => localStorage.getItem("nukernel.vol.v1"));
    check(base > 0.01 && v === "0" && store === "0" && low < 0.005,
      "V1 #vol: real drag to 0 silences the ring (" + base.toFixed(4) + " -> " +
      low.toFixed(4) + "), store follows");
    await dragTo("#vol", 1.0);
    await p.waitForTimeout(1500);
    const back = await avg(6, 200);
    check(back > 0.01, "V1 #vol: dragged back up, sound returns (" + back.toFixed(4) + ")");
  }

  /* ---- V2 #vol2, the main plate's listening fader ----------------------- */
  {
    await openBus("main");
    const base = await avg(8, 200);
    const v = await dragTo("#vol2", 0.0);
    await p.waitForTimeout(1500);
    const low = await avg(6, 200);
    const store = await p.evaluate(() => localStorage.getItem("nukernel.vol.v1"));
    check(base > 0.01 && v === "0" && store === "0" && low < 0.005,
      "V2 #vol2: real drag to 0 silences the ring (" + base.toFixed(4) + " -> " +
      low.toFixed(4) + "), store follows");
    await dragTo("#vol2", 1.0);
    await p.waitForTimeout(1200);
  }

  /* ---- V3 the voice faders: score landing per voice, then RMS all-cut --- */
  {
    for (const v of voiceNames.filter((x) => x.unit)) {
      await openVoice(v.name);
      const before = await mixUnits();
      const b0 = before && before.units[v.unit] ? before.units[v.unit].lvl : null;
      const got = await dragTo('input[data-k="b|fader|' + v.name + '"]', 0.0);
      let landed = null;
      for (let i = 0; i < 20 && landed == null; i++) {
        await p.waitForTimeout(1000);
        const now = await mixUnits();
        const l = now && now.units[v.unit] ? now.units[v.unit].lvl : null;
        if (b0 && l != null && Math.abs(l / b0 - 0.0631) < 0.0631 * 0.15) landed = l;
      }
      check(got === "-24" && b0 > 0 && landed != null,
        "V3 " + v.name + " fader -24: the sounding bar's unit " + v.unit +
        " carries x0.063 (" + (b0 == null ? "?" : b0) + " -> " + landed +
        ") within the runway");
    }
    /* all cut together: the rendered proof. The unit-table landings above are
       instant (the plan recompiles under the sounding bar); the EAR waits out
       the runway — bars already baked carry the old levels for up to ~15s */
    await p.waitForTimeout(15000);
    const cut = await avg(16, 250);
    /* restore every fader, then let the runway carry the restore back out */
    for (const v of voiceNames) { await openVoice(v.name);
      await setVal('input[data-k="b|fader|' + v.name + '"]', 0); }
    const base = 0.02; /* the shipped chant idles well above this; the claim
      is the CUT, not the exact source level: -24 on every voice must leave
      almost nothing (drums are silent on the chant — 0 hits per bar) */
    check(cut < base, "V3 all faders at -24: whole mix nearly silent (rms " +
      cut.toFixed(4) + " < " + base + ")");
    await p.waitForTimeout(12000);
  }

  /* ---- V4 record gain -> 0.5: a tone-cast chair halves ------------------ */
  {
    await openBus("main");
    const before = await mixUnits();
    /* the chair that reads the genre's tone on the shipped chant is the
       schola (v1); the cantor carries its own native level — see the header */
    const b1 = before && before.units.v1 ? before.units.v1.lvl : null;
    const got = await dragTo('input[data-k="level"]', 0.0);
    let landed = null;
    for (let i = 0; i < 20 && landed == null; i++) {
      await p.waitForTimeout(1000);
      const now = await mixUnits();
      const l = now && now.units.v1 ? now.units.v1.lvl : null;
      if (b1 && l != null && Math.abs(l / b1 - 0.5) < 0.05) landed = l;
    }
    check(got === "0.5" && b1 > 0 && landed != null,
      "V4 record gain 0.5: the tone-cast chair's unit halves (" +
      (b1 == null ? "?" : b1) + " -> " + landed + ") within the runway");
    await setVal('input[data-k="level"]', 1);
    await p.waitForTimeout(10000);
  }

  /* ---- V5 the reverb return -> off: the state the walk reads follows ---- */
  {
    await openBus("rev");
    const base = await avg(12, 400);
    const beforeRep = await p.evaluate(() => {
      const m = window.__nuMix(); return m && m.master &&
        { rev: m.master.rev, stages: m.master.stages };
    });
    const got = await dragTo('input[data-k="bus|rev|ret"]', 0.0);
    await p.waitForTimeout(800);
    const afterRep = await p.evaluate(() => {
      const m = window.__nuMix(); return m && m.master &&
        { rev: m.master.rev, stages: m.master.stages };
    });
    /* the shipped chant colors no room, so the return is the internal zita's
       rgain (engineReport prints it since 2026-08-30); ret "hall" = 1.60,
       ret off = 0.00 */
    const b5 = beforeRep && beforeRep.rev && +Object.values(beforeRep.rev)[0];
    const a5 = afterRep && afterRep.rev && +Object.values(afterRep.rev)[0];
    check(got === "0" && b5 > 0 && a5 === 0,
      "V5 rev ret off: the engine's own report follows the knob (" +
      JSON.stringify(beforeRep && beforeRep.rev) + " -> " +
      JSON.stringify(afterRep && afterRep.rev) + ")");
    await p.waitForTimeout(14000);
    const dry = await avg(12, 400);
    console.log("  note V5 whole-mix RMS " + base.toFixed(4) + " -> " + dry.toFixed(4) +
      " (" + dB(dry, base).toFixed(1) + " dB) — reported, not gated: section swing" +
      " is +-2 dB on the chant and the sample-level wire is tape-reach R5");
    await setVal('input[data-k="bus|rev|ret"]', 4);
    await p.waitForTimeout(2000);
  }

  /* ---- V6 a trim word on the sounding section --------------------------- */
  {
    const si = await p.evaluate(() => window.__nuMix().si);
    const secId = await p.evaluate((i) => window.__eightDoc().form.sections[i].id, si);
    const first = voiceNames.find((x) => x.unit) || voiceNames[0];
    /* ...AND THE AUTOMATION GRID IS A PLATE NOW (2026-09-02). Paul:
       *"Instead of having four icons on top and section automation that should
       have been five subicons under the 'Mix' icon. One of them is section
       automation."* The grid used to be appended to the board's HOST — always
       on screen under whichever bus plate was open, and not a tab at all — so
       reaching the Mix tab was enough to find a `t|voice|section` cell. It is
       `PLATES.auto`, the fifth plate, so the plate has to be OPENED, which is
       one press of its own mark in the gutter (the nav drives the board through
       `showBoard`, and `#boardtabs` mirrors it until wave 2e). */
    await p.evaluate(() => window.__eightTab("Mix"));
    await p.waitForTimeout(500);
    await p.evaluate(() => { const a =
      document.querySelector('[data-k="boardtab|auto|auto"]'); if (a) a.click(); });
    await p.waitForTimeout(500);
    /* ...AND THE CELL IS A WORD GRID NOW (2026-09-02, wave 4). This clicked
       the plate up to eight times because the trim cell used to CYCLE its word
       on every tap. ui/wordgrid.js — the component that generalised this very
       grid — made the gesture two taps instead: the cell opens a strip of
       chips (`data-k = <cell key>|<word>`) and the chip is the write. Eight
       clicks on a cell now open and fold the same strip four times and touch
       the record not at all, which is why V6 went red on a board that works.
       ONE READ OF THE RECORD, AFTER THE TAP, because a chip's `set` runs
       `setDesk` and the answer is either in the document or the gesture did
       not land — there is nothing to loop over any more. */
    const say = ({ name, sid, word }) => {
      const cell = document.querySelector(
        'button[data-k="t|' + name + '|' + sid + '"]');
      if (!cell) return "no cell";
      cell.click();                                   // the strip unfolds
      const chip = document.querySelector(
        'button.nu-wchip[data-k="t|' + name + '|' + sid + '|' + word + '"]');
      if (!chip) return "no chip";
      if (chip.disabled) return "refused";
      chip.click();
      const d = window.__eightDoc();
      const c = window.NuDeskDoc.channelVoicesOf(d, window.NuGenres.GENRES)
        .find((x) => x.voice.name === name);
      const t = c.voice.desk && c.voice.desk.trim && c.voice.desk.trim[sid];
      return t || "";
    };
    const set = await p.evaluate(say, { name: first.name, sid: secId, word: "out" });
    let zero = false, stillHere = true;
    for (let i = 0; i < 20 && !zero; i++) {
      await p.waitForTimeout(1000);
      const now = await mixUnits();
      if (!now) break;
      if (now.si !== si) { stillHere = false; break; }
      const u = now.units[first.unit];
      if (u && u.lvl === 0) zero = true;
    }
    check(set === "out" && (zero || !stillHere),
      "V6 trim 'out' on " + first.name + "@" + secId + ": unit lvl -> 0 while the " +
      "section sounds" + (stillHere ? "" : " (section ended first — boundary honest, not re-armed)"));
    /* put the word back to absent — the empty chip, the one the grid prints a
       dash for because this section says nothing */
    await p.evaluate(say, { name: first.name, sid: secId, word: "" });
  }
  await p.context().close();

  /* ---- V7 the phone's fader: media route, volume property dead ---------- */
  {
    const ctx2 = await b.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
    const p2 = await ctx2.newPage();
    await p2.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, "volume", {
        configurable: true, get() { return 1; }, set() {} });
    });
    await p2.goto(PAGE + CHANT, { waitUntil: "domcontentloaded" });
    await p2.waitForTimeout(3000);
    await p2.evaluate(() => document.getElementById("play").click());
    /* WAIT FOR THE RECORD TO ARRIVE, AND THEN FOR IT TO COME UP — two waits,
       because they are two different unknowns (2026-09-02).
       This was one `waitForTimeout(14000)` and the base it measured went red in
       the full suite while passing alone: 0.0093, under the 0.01 the premise
       asks for. Measured on the media route, second by second, on this exact
       fixture: silence until 5s (the segment queue filling), then 0.0097,
       0.0108, 0.0428, 0.0497 … 0.07 from 24s on. The chant's first section
       carries `env: "in"` — it FADES IN — so a fixed clock is measuring two
       things at once, and the one that moves under load is the first: eight
       gates sharing a machine push the first segment out past 14s and the
       average lands inside the fade.
       SO THE START IS MEASURED AND THE FADE IS WAITED OUT. The poll below asks
       the engine when it is making sound at all, and the record is given a
       further 12 s from THERE to come up — which is the fade's own length,
       read off the measurement above. The premise is still a real assertion:
       a record whose fade never finished, or a route that never came up, still
       fails it. */
    const eng2 = () => p2.evaluate(() => { const e = window.__nuEngine(); return { route: e.route, rms: +e.rms }; });
    let started = 0;
    for (let i = 0; i < 60 && !started; i++) {
      await p2.waitForTimeout(500);
      if ((await eng2()).rms > 0.002) started = i * 0.5;
    }
    await p2.waitForTimeout(12000);
    const e0 = await eng2();
    const media = /^(mms|mse|segAB|media)/.test(e0.route || "");
    let base2 = 0; for (let i = 0; i < 8; i++) { base2 += (await eng2()).rms / 8; await p2.waitForTimeout(400); }
    await p2.evaluate(() => document.getElementById("playops").click());
    await p2.waitForTimeout(500);
    const g = await p2.evaluate(() => { const t = document.querySelector(".nu-trayvol .nu-vs-track");
      if (!t) return null; const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, top: r.y + 12, bot: r.y + r.height - 12 }; });
    const cdp2 = await ctx2.newCDPSession(p2);
    if (g) {
      const touch = (type, y) => cdp2.send("Input.dispatchTouchEvent", {
        type, touchPoints: type === "touchEnd" ? [] : [{ x: g.x, y, radiusX: 6, radiusY: 6 }] });
      await touch("touchStart", (g.top + g.bot) / 2);
      for (let i = 1; i <= 10; i++)
        await touch("touchMove", (g.top + g.bot) / 2 + (g.bot - (g.top + g.bot) / 2) * i / 10);
      await touch("touchEnd", 0);
    }
    const elvol = await p2.evaluate(() => { const h = window.FaustLive && FaustLive.lastHandle;
      const e = h && h.mediaEl; return e ? e.volume : null; });
    let silent = null;
    for (let i = 0; i < 15 && silent == null; i++) {
      await p2.waitForTimeout(3000);
      const e = await eng2();
      if (e.rms <= 0.002) silent = 3 * (i + 1);
    }
    check(media && base2 > 0.01 && g && elvol === 1 && silent != null,
      "V7 the phone's fader: media route (" + e0.route + "), element.volume dead at 1, " +
      "real drag -> baked envelope silent in " + silent + "s (base " + base2.toFixed(4) +
      ", sound at " + started + "s)");
    await ctx2.close();
  }

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nvol-reach: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("vol-reach: " + (e && e.message)); process.exit(1); });

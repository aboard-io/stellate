#!/usr/bin/env node
// test/embed.test.js — THE EMBEDDED RADIO, ON A FAKE CLOCK (2026-11-23).
//
//   node test/embed.test.js
//
// nukernel/embed/ is the box for somebody else's page: slow ambient records,
// one after another, with the engine started ONCE. This gate holds what that
// costs to get wrong, with no browser:
//
//   E1  slow ambient is a profile of the real composer: every slow row
//       composes, and a shaped record has no drums, nothing sung, nothing
//       faster than SLOW, its key within a tritone of C.
//   E2  the plan is a function of where it is asked, never the same row twice
//       running, and every row it names is one of the part of the day's.
//   E3  AN HOUR OF THE ALBUM STARTS THE ENGINE ONCE AND NEVER STOPS IT. Each
//       record round PASSES times, then the next goes in UNDER the engine and
//       lands on a bar line; no record is adopted as a new song while it plays
//       (that stops the engine, and a phone cannot start it again without a
//       touch); never a second without a position.
//   E4  the dip is never silence, and the rise begins when the new record's
//       first bar is HEARD.
//   E5  the transport is the engine's: stopped by itself (the lock screen),
//       the radio is off, says so, and nothing restarts it; a play after it
//       starts a record.
//   E6  the watchdog stops and starts only a transport that is silent while
//       the page is shown; never a hidden one.
//   E7  pause fades and stops; play inside the fade brings the record back.
//   E8  the touch is taken synchronously: `touch()` before anything is awaited.
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const P = require(path.join(ROOT, "nukernel/precompose.js"));

function fakeClock() {
  let now = 0, q = [], k = 0;
  const clock = { now: () => now, after: (ms, fn) => { q.push({ t: now + ms, fn, k: k++ }); } };
  async function run(until) {
    for (;;) {
      await new Promise((ok) => setImmediate(ok));
      q.sort((a, b) => a.t - b.t || a.k - b.k);
      const e = q[0];
      if (!e || e.t > until) { now = until; return; }
      q = q.slice(1); now = e.t; e.fn();
    }
  }
  return { clock, run };
}
// A box that plays a record of `bars` bars of four at its bpm: a position each
// second, a round at each pass's end, its engine ready 4.5 s after a cold
// start, its first sound `hearAfter` later. A record put UNDER it and started
// lands on the next bar line; one put any other way while it plays is counted.
function fakeBox(clock, { stallAt = Infinity, hearAfter = 0, warmMs = 0 } = {}) {
  const subs = {};
  const emit = (type, d) => { for (const fn of subs[type] || []) fn(d); };
  let playing = false, gen = 0, doc = null, pending = null, jump = false;
  const log = { puts: [], starts: [], stops: [], pos: [], rounds: [], volAt: [], warmed: [], lands: [],
                adoptedWhilePlaying: 0, touches: [], order: [] };
  const S = {
    touch() { log.touches.push(clock.now()); log.order.push("touch"); },
    record: (genre, seed) => ({ basis: genre, time: { bpm: 54 + (seed % 50) }, alphabet: { key: 0 },
      form: { sections: [{ id: "a", bars: 12 + (seed % 29) }] },
      voices: [{ kind: "line", instrument: seed % 3 ? "felt_piano" : "choir_aah" }, { kind: "drums" }] }),
    warm: () => { log.order.push("warm"); return new Promise((ok) => clock.after(warmMs, () => { log.warmed.push(clock.now()); ok(); })); },
    put(d, under) {
      if (playing && !under) log.adoptedWhilePlaying++;
      if (playing && under) pending = d; else doc = d;
      log.puts.push({ t: clock.now(), bpm: d.time.bpm, genre: d.basis, drums: d.voices.some((v) => v.kind === "drums"), sung: d.voices.some((v) => /choir/.test(v.instrument || "")) });
    },
    async start() {
      if (playing) { jump = true; return; }
      const g = ++gen;
      await new Promise((ok) => clock.after(4500, ok));
      if (g !== gen) return;
      playing = true; log.starts.push(clock.now());
      let d = doc, t0 = clock.now() + hearAfter, last = 0, ser = 0;
      const passOf = () => (d.form.sections[0].bars * 4 * 60000) / d.time.bpm;
      const tick = () => {
        if (g !== gen || !playing || clock.now() >= stallAt) return;
        if (jump && pending && Math.floor((((clock.now() - t0) / 60000) * d.time.bpm) / 4) !== last) {
          d = doc = pending; pending = null; jump = false; t0 = clock.now(); log.lands.push(clock.now()); ser++; last = 0;
        }
        const e = clock.now() - t0, beat = (e / 60000) * d.time.bpm;
        if (Math.floor(beat / 4) !== last) ser++;
        last = Math.floor(beat / 4);
        log.pos.push(clock.now());
        emit("pos", { bar: last % d.form.sections[0].bars, beat: beat % 4, beats: 4, bpm: d.time.bpm, si: 0, serial: ser });
        const pass = passOf(), passes = Math.floor(e / pass), before = Math.floor((e - 1000) / pass);
        if (e >= 1000 && passes > before) { log.rounds.push(clock.now()); emit("transport:round", { bar: 0, serial: ser }); }
        clock.after(1000, tick);
      };
      if (hearAfter) clock.after(hearAfter, tick); else tick();
    },
    stop() { playing = false; gen++; pending = null; jump = false; log.stops.push(clock.now()); },
    volume: (g) => { log.volAt.push([clock.now(), g]); },
    on: (type, fn) => { (subs[type] = subs[type] || []).push(fn); },
    report: () => ({ route: "fake" }),
  };
  const self = (on) => { playing = on; if (!on) gen++; emit("transport:state", { playing: on }); };
  return { S, log, self };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

(async () => {
  const slow = await import(path.join(ROOT, "nukernel/embed/slow.js"));
  const R = await import(path.join(ROOT, "nukernel/embed/radio.js"));
  const { makeRadio, gainOf, PASSES, FADE_MS, PAUSE_MS, WATCH_MS, DIP, DIP_MS, RISE_MS } = R;
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  test("E1 slow ambient is a profile of the real composer", () => {
    for (const g of slow.GENRES) for (const seed of [1, 7, 4242]) {
      const doc = slow.slowRecord(P.genreToDocument(g, seed), { key: 5, seats: [] });
      assert.ok(doc.voices.length > 0, g + ": a record with voices");
      assert.ok(!doc.voices.some((v) => v.kind === "drums" || v.kind === "kit"), g + ": no drums");
      assert.ok(!doc.voices.some((v) => v.instrument && slow.SINGS.test(v.instrument)), g + ": nothing sung");
      assert.ok(doc.time.bpm <= slow.SLOW, g + ": " + doc.time.bpm + " bpm");
      assert.ok(doc.alphabet.key >= -6 && doc.alphabet.key <= 6, g + ": key " + doc.alphabet.key);
    }
    for (const rows of Object.values(slow.PARTS)) for (const g of rows) assert.ok(slow.GENRES.includes(g));
  });

  test("E2 the plan is a function of where it is asked", () => {
    for (const part of Object.keys(slow.PARTS)) {
      let prev;
      for (let n = 0; n < 200; n++) {
        const a = slow.planAt(99, n, part, prev), b = slow.planAt(99, n, part, prev);
        assert.deepEqual(a, b);
        assert.ok(slow.PARTS[part].includes(a.genre)); assert.notEqual(a.genre, prev);
        assert.ok(a.seed >= 1 && a.seed <= 65535 && a.key >= -3 && a.key <= 3);
        prev = a.genre;
      }
    }
    assert.equal(slow.partOf(6), "morning"); assert.equal(slow.partOf(12), "day");
    assert.equal(slow.partOf(19), "evening"); assert.equal(slow.partOf(2), "night");
  });

  test("E3 an hour of the album starts the engine once and never stops it", async () => {
    const { clock, run } = fakeClock(), { S, log } = fakeBox(clock), lines = [];
    const r = makeRadio({ S, clock, seed: 5, part: () => "night", log: (l) => lines.push(l) });
    r.play(0.64);
    await run(60 * 60000);
    assert.equal(log.adoptedWhilePlaying, 0, "no record adopted as a new song while the engine plays");
    assert.ok(log.puts.length >= 8, log.puts.length + " records in an hour");
    assert.equal(log.starts.length, 1, "started once"); assert.equal(log.stops.length, 0, "never stopped");
    assert.ok(log.puts.length - 1 - log.lands.length <= 1);
    const begun = [log.starts[0], ...log.lands];
    for (let i = 1; i < begun.length; i++)
      assert.equal(log.rounds.filter((t) => t > begun[i - 1] && t <= begun[i]).length, PASSES, "record " + i);
    assert.equal(lines.filter((l) => l.startsWith("watchdog")).length, 0);
    let worst = 0;
    for (let i = 1; i < log.pos.length; i++) worst = Math.max(worst, log.pos[i] - log.pos[i - 1]);
    assert.ok(worst <= 1000, worst + " ms with no position");
    assert.ok(log.puts.every((p) => p.bpm <= slow.SLOW && !p.drums && !p.sung), "every record shaped");
    for (let i = 1; i < log.puts.length; i++) assert.notEqual(log.puts[i].genre, log.puts[i - 1].genre);
    r.pause();
  });

  test("E4 the dip is never silence, and the rise begins at the first bar heard", async () => {
    const { clock, run } = fakeClock(), { S, log } = fakeBox(clock, { hearAfter: 3500, warmMs: 5000 });
    const r = makeRadio({ S, clock, seed: 9, part: () => "night" });
    r.play(0.5); await run(20 * 60000);
    const full = gainOf(0.5), st = log.starts[0], first = log.pos.find((t) => t >= st);
    const top = log.volAt.find(([t, g]) => t > first && near(g, full))[0];
    assert.ok(log.volAt.filter(([t]) => t >= st && t <= first).every(([, g]) => g === 0), "silent until the first sound");
    assert.ok(top - first >= FADE_MS - 100 && top - first <= FADE_MS + 1100);
    assert.ok(log.lands.length >= 3);
    for (const land of log.lands) {
      const low = log.volAt.filter(([t]) => t <= land).at(-1)[1], up = log.volAt.find(([t, g]) => t > land && near(g, full))[0];
      assert.ok(near(low, DIP * full), "dipped, never silent, at " + land + ": " + low);
      assert.ok(up - land >= RISE_MS - 100 && up - land <= RISE_MS + 1100, "the rise from its first bar: " + (up - land));
    }
    for (let i = 1; i < log.volAt.length; i++)
      assert.ok(Math.abs(log.volAt[i][1] - log.volAt[i - 1][1]) <= full / 40 + 1e-9, "a fade goes in small steps");
    for (const put of log.puts.slice(1)) {
      const warmed = log.warmed.filter((t) => t <= put.t).at(-1);
      assert.ok(warmed <= put.t - DIP_MS + 50, "samples in before the dip");
    }
    r.pause();
  });

  test("E5 the transport is the engine's", async () => {
    const { clock, run } = fakeClock(), { S, log, self } = fakeBox(clock), lines = [], went = [];
    const r = makeRadio({ S, clock, seed: 3, part: () => "night", went: (on) => went.push(on), log: (l) => lines.push(l) });
    r.play(0.5); await run(30000);
    self(false); await run(10 * 60000);
    assert.deepEqual(went, [false]); assert.equal(r.playing(), false);
    assert.equal(lines.filter((l) => l.startsWith("watchdog")).length, 0);
    assert.equal(log.starts.length, 1); assert.equal(log.stops.length, 0); assert.equal(log.puts.length, 1);
    r.play(0.5); await run(10 * 60000 + 20000);
    assert.equal(log.starts.length, 2); assert.equal(log.puts.length, 2);
    self(false); self(true); await run(10 * 60000 + 21000);
    assert.deepEqual(went, [false, false, true]); assert.equal(r.playing(), true);
    r.pause();
  });

  test("E6 the watchdog, and never while hidden", async () => {
    const stall = 40000;
    { const { clock, run } = fakeClock(), { S, log } = fakeBox(clock, { stallAt: stall }), lines = [];
      const r = makeRadio({ S, clock, seed: 2, part: () => "day", log: (l) => lines.push(l) });
      r.play(0.5); await run(stall + WATCH_MS + FADE_MS + 7000);
      assert.equal(lines.filter((l) => l.startsWith("watchdog")).length, 1, lines.join("\n"));
      assert.equal(log.puts.length, 2); assert.equal(log.stops.length, 1); assert.equal(log.adoptedWhilePlaying, 0);
      const s = log.stops[0] - stall;
      assert.ok(s >= WATCH_MS && s <= WATCH_MS + 1000 + FADE_MS + 1, "stopped " + s + " ms after the stall");
      r.pause(); }
    { const { clock, run } = fakeClock(), { S, log } = fakeBox(clock, { stallAt: stall }), lines = [];
      const r = makeRadio({ S, clock, seed: 2, part: () => "day", hidden: () => true, log: (l) => lines.push(l) });
      r.play(0.5); await run(stall + 10 * WATCH_MS);
      assert.equal(lines.filter((l) => l.startsWith("watchdog")).length, 0);
      assert.equal(log.stops.length, 0); assert.equal(log.puts.length, 1);
      r.pause(); }
  });

  test("E7 pause fades and stops; play inside the fade brings the record back", async () => {
    const { clock, run } = fakeClock(), { S, log } = fakeBox(clock);
    const r = makeRadio({ S, clock, seed: 4, part: () => "evening" });
    r.play(0.8); await run(20000);
    const full = gainOf(0.8);
    r.pause(); await run(20000 + PAUSE_MS / 2);
    const mid = log.volAt.at(-1)[1];
    assert.ok(mid > 0 && mid < full); assert.equal(log.stops.length, 0, "not yet stopped");
    r.play(0.8); await run(20000 + PAUSE_MS / 2 + FADE_MS + 200);
    assert.ok(near(log.volAt.at(-1)[1], full), "back to its level"); assert.equal(log.stops.length, 0); assert.equal(log.puts.length, 1);
    r.pause(); await run(40000);
    assert.equal(log.volAt.at(-1)[1], 0); assert.equal(log.stops.length, 1, "stopped once faded");
    assert.equal(log.pos.filter((t) => t > 30000).length, 0, "silent once paused");
    r.play(0.8); await run(60000);
    assert.equal(log.puts.length, 2, "a new record"); assert.ok(log.pos.some((t) => t > 45000));
    r.pause();
  });

  test("E8 the touch is taken before anything is awaited", async () => {
    const { clock, run } = fakeClock(), { S, log } = fakeBox(clock);
    const r = makeRadio({ S, clock, seed: 6, part: () => "night" });
    r.play(0.5);
    assert.deepEqual(log.touches, [0], "synchronously, inside play()");
    await run(1000);
    assert.equal(log.order[0], "touch");
    r.pause();
  });

  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log("ok    " + name); }
    catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.stack || e).toString().split("\n").slice(0, 6).join("\n      ")); }
  }
  console.log(failed ? failed + " failed" : "embed: " + tests.length + " gates green");
  process.exit(failed ? 1 : 0);
})();

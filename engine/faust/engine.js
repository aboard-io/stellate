// faust/engine.js — browser module. Loads the PRECOMPILED WASM artifacts from
// faust/dist/ (no libfaust in the client), builds one small AudioWorkletNode
// per voice instance, and schedules faust/fixture.json (real buildEvents
// output) with a 100ms-tick / 1.5s-horizon lookahead scheduler driving the
// nodes' AudioParams (sample-block accurate: the Faust processor reads params
// once per 128-frame block, i.e. the same 2.9ms granularity as csound live
// ksmps=128 — but per-voice, on separate worklets, with NO orchestra
// recompiles ever).
//
// GOTCHA (faustwasm 0.16.5): must deep-import dist/esm/index.js — the package
// "main" points at an IIFE bundle exporting nothing.
import {
  FaustWasmInstantiator,
  FaustMonoDspGenerator,
} from "./node_modules/@grame/faustwasm/dist/esm/index.js";

const VOICE_DSP = {
  kick: "kick909", snare: "snare_crack", hat: "snare_crack",
  bass: "supersaw", melody: "supersaw", pad: "pad_saw", fx: "fx_bus",
  dx7: "dx7_alg5",   // full DX7 (dx7.lib), algorithm 5: E.PIANO 1 / TUB BELLS
};

export async function createEngine(ctx, fixture) {
  const factories = {};
  for (const dsp of [...new Set(Object.values(VOICE_DSP))]) {
    factories[dsp] = await FaustWasmInstantiator.loadDSPFactory(
      `dist/${dsp}-module.wasm`, `dist/${dsp}-meta.json`);
  }

  const master = ctx.createGain(); master.gain.value = 0.9;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  master.connect(analyser); analyser.connect(ctx.destination);

  const errors = [];
  async function mkNode(dsp, tag) {
    const gen = new FaustMonoDspGenerator();
    const node = await gen.createNode(ctx, dsp, factories[dsp]);
    node.onprocessorerror = (e) => errors.push(`${tag}: ${e.message || "processorerror"}`);
    return node;
  }
  const P = (node, name) => {
    // address = /<dspName>/<param>; look up by suffix to be robust
    for (const key of node.parameters.keys()) if (key.endsWith("/" + name)) return node.parameters.get(key);
    throw new Error(`no param ${name}`);
  };

  // ---- fx bus: 6 Faust inputs = ONE WebAudio input with 6 channels ----
  // (0 dryL, 1 dryR, 2 reverb send, 3 delay send, 4 ping-pong send, 5 sidechain;
  // dry stays on native GainNode routes here, so 0/1/4/5 are left silent)
  const fx = await mkNode("fx_bus", "fx");
  const fxMerge = ctx.createChannelMerger(6);
  fxMerge.connect(fx); fx.connect(master);
  const revBus = ctx.createGain(); revBus.connect(fxMerge, 0, 2); // ch2 = reverb send
  const delBus = ctx.createGain(); delBus.connect(fxMerge, 0, 3); // ch3 = delay send
  const R = fixture.recipes;
  const spb = 60 / fixture.bpm;
  P(fx, "dtime").value = Math.min(1.5, R.delayBeats * spb);
  P(fx, "dfb").value = R.delayFb;
  P(fx, "rgain").value = Math.min(2, R.reverb * 2.2);

  // ---- per-voice instances (mono voices; melody x2, pad x4 round-robin) ----
  const mk = async (tag, dsp, dry, rev, del, setup) => {
    const node = await mkNode(dsp, tag);
    const g = ctx.createGain(); g.gain.value = dry; node.connect(g); g.connect(master);
    const rs = ctx.createGain(); rs.gain.value = rev; node.connect(rs); rs.connect(revBus);
    const ds = ctx.createGain(); ds.gain.value = del; node.connect(ds); ds.connect(delBus);
    if (setup) setup(node);
    return node;
  };
  const D = R.drums;
  const voices = {
    kick: [await mk("kick", "kick909", 1, D.send * 0.35, 0, n => { P(n, "level").value = Math.min(2, D.kick); P(n, "tune").value = D.tune; })],
    snare: [await mk("snare", "snare_crack", 1, D.send, D.dsend, n => { P(n, "level").value = Math.min(2, D.snare); })],
    // no dedicated hat DSP (prototype has 4 voices): snare_crack retuned very
    // short and quiet reads as a workable synthetic hat placeholder
    hat: [await mk("hat", "snare_crack", 0.7, D.send * 0.3, D.dsend * 0.5, n => { P(n, "level").value = Math.min(2, D.hat * 0.45); P(n, "decay").value = 0.03; })],
    bass: [await mk("bass", "supersaw", 1, R.bass.send, R.bass.dsend, n => { P(n, "cutoff").value = R.bass.cutoff; P(n, "res").value = Math.min(0.95, R.bass.res); P(n, "detune").value = 0.004; P(n, "level").value = Math.min(1, R.bass.level * 0.5); })],
    melody: await Promise.all([0, 1].map(i => mk("mel" + i, "supersaw", 1, R.melody.send, R.melody.dsend, n => { P(n, "cutoff").value = R.melody.cutoff; P(n, "res").value = Math.min(0.95, R.melody.res); P(n, "level").value = Math.min(1, R.melody.level); }))),
    // DX7 E.PIANO 1 doubles every 3rd melody note (round-robin slot): a real
    // cartridge preset = 144 AudioParam sets, applied at RUNTIME, no recompile
    dx7: [await mk("dx7ep", "dx7_alg5", 0.5, R.melody.send, R.melody.dsend, n => { P(n, "gain").value = 0.35; })],
    pad: await Promise.all([0, 1, 2, 3].map(i => mk("pad" + i, "pad_saw", 1, R.pad.send, R.pad.dsend, n => { P(n, "cutoff").value = R.pad.cutoff; P(n, "attack").value = Math.min(4, R.pad.attack); P(n, "level").value = Math.min(1, R.pad.level); }))),
  };
  voices.melody.push(voices.dx7[0]); delete voices.dx7; // 3rd melody slot = the EP
  const rr = { melody: 0, pad: 0 };

  // runtime DX7 patch swap: ~144 param sets from decoded cartridge sysex.
  // Returns ms taken — the whole "timbre change" costs less than a frame.
  let presets = null;
  async function dx7Load(name) {
    presets = presets || await (await fetch("dx7-presets.json")).json();
    const pre = presets[name];
    if (!pre) throw new Error("no preset " + name);
    if (pre.alg !== 5) throw new Error(`preset needs dx7_alg${pre.alg} artifact`);
    const node = voices.melody[2];
    const t0 = performance.now();
    for (const [suffix, v] of Object.entries(pre.params)) {
      const p = node.parameters.get("/DX7" + suffix);
      if (p) p.value = v;
    }
    return performance.now() - t0;
  }

  function scheduleEvent(ev, t) {
    const pool = voices[ev.voice]; if (!pool) return;
    let node = pool[0];
    if (pool.length > 1) { node = pool[rr[ev.voice] % pool.length]; rr[ev.voice]++; }
    const gate = P(node, "gate");
    const dur = Math.max(0.012, ev.dur * spb);
    if (ev.freq != null) { const fp = P(node, "freq"); fp.setValueAtTime(Math.min(fp.maxValue, ev.freq), Math.max(0, t - 0.005)); } // dx7.lib freq slider caps at 1000
    const isDrum = ev.voice === "kick" || ev.voice === "snare" || ev.voice === "hat";
    const off = isDrum ? t + 0.012 : t + dur - 0.008;
    gate.setValueAtTime(1, t);
    gate.setValueAtTime(0, off);
  }

  // ---- lookahead scheduler: 100ms tick, 1.5s horizon, loops the 8 bars ----
  const sched = { timer: 0, t0: 0, idx: 0, loop: 0, running: false };
  function tick() {
    const horizon = ctx.currentTime + 1.5;
    for (;;) {
      const ev = fixture.events[sched.idx];
      const t = sched.t0 + (sched.loop * fixture.beats + ev.t) * spb;
      if (t > horizon) break;
      if (t > ctx.currentTime - 0.05) scheduleEvent(ev, Math.max(t, ctx.currentTime + 0.005));
      sched.idx++;
      if (sched.idx >= fixture.events.length) { sched.idx = 0; sched.loop++; }
    }
  }
  function play() {
    if (sched.running) return;
    sched.running = true; sched.t0 = ctx.currentTime + 0.25; sched.idx = 0; sched.loop = 0;
    tick(); sched.timer = setInterval(tick, 100);
  }
  function stop() {
    sched.running = false; clearInterval(sched.timer);
    for (const pool of Object.values(voices)) for (const n of pool) { const g = P(n, "gate"); g.cancelScheduledValues(0); g.value = 0; }
  }

  // ---- param-change storm: the "recompile-free timbre glide" proof --------
  // csound needs a compileOrc (which hitches) to change a baked cutoff;
  // here it's one setParamValue-equivalent per node per 50ms, forever.
  const storm = { timer: 0, n: 0 };
  function stormStart() {
    if (storm.timer) return;
    const swept = [...voices.bass, ...voices.melody, ...voices.pad];
    storm.timer = setInterval(() => {
      storm.n++;
      const ph = storm.n * 0.05;
      swept.forEach((n, i) => {
        const cut = [...n.parameters.keys()].find(k => k.endsWith("/cutoff"));
        if (cut) {
          const c = i < 3 ? 400 + 3200 * (0.5 + 0.5 * Math.sin(ph * 2.1 + i)) : 300 + 2000 * (0.5 + 0.5 * Math.sin(ph * 1.3 + i));
          n.parameters.get(cut).setValueAtTime(c, ctx.currentTime);
          if (i > 0 && i < 3) P(n, "detune").setValueAtTime(0.004 + 0.02 * (0.5 + 0.5 * Math.sin(ph * 0.7)), ctx.currentTime);
        } else {
          // DX7: sweep modulator (OP2) output level = FM brightness glide
          const p = n.parameters.get("/DX7/Operator_2/Level/Level");
          if (p) p.setValueAtTime(40 + 59 * (0.5 + 0.5 * Math.sin(ph * 1.7)), ctx.currentTime);
        }
      });
      P(fx, "dfb").setValueAtTime(0.2 + 0.3 * (0.5 + 0.5 * Math.sin(ph)), ctx.currentTime);
    }, 50);
  }
  function stormStop() { clearInterval(storm.timer); storm.timer = 0; }

  // ---- health metrics ------------------------------------------------------
  const buf = new Float32Array(analyser.fftSize);
  function rms() {
    analyser.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  const jank = { worstRafGapMs: 0, rafGapsOver50: 0, worstAudioStallMs: 0, lastRaf: 0, lastPerf: 0, lastAudio: 0 };
  function rafMon(ts) {
    if (jank.lastRaf) {
      const gap = ts - jank.lastRaf;
      if (gap > jank.worstRafGapMs) jank.worstRafGapMs = gap;
      if (gap > 50) jank.rafGapsOver50++;
    }
    jank.lastRaf = ts;
    requestAnimationFrame(rafMon);
  }
  requestAnimationFrame(rafMon);
  setInterval(() => {
    const p = performance.now(), a = ctx.currentTime;
    if (jank.lastPerf && ctx.state === "running") {
      const stall = (p - jank.lastPerf) / 1000 - (a - jank.lastAudio); // audio clock falling behind wall clock = underrun/starvation
      if (stall * 1000 > jank.worstAudioStallMs) jank.worstAudioStallMs = stall * 1000;
    }
    jank.lastPerf = p; jank.lastAudio = a;
  }, 250);

  await dx7Load("E.PIANO 1");

  return {
    ctx, voices, fx, play, stop, stormStart, stormStop, rms, errors, jank, dx7Load,
    nodeCount: 1 + Object.values(voices).reduce((s, p) => s + p.length, 0),
    resetJank() { jank.worstRafGapMs = 0; jank.rafGapsOver50 = 0; jank.worstAudioStallMs = 0; },
  };
}

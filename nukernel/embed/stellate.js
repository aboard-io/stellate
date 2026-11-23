// nukernel/embed/stellate.js — THE BOX, AS A FEW VERBS (2026-11-23).
//
// What ./radio.js is given in a page: the composer and the player this box
// already has, behind the few verbs an album needs. Every one of them is a
// door that exists — nothing here schedules a bar, owns a clock or opens an
// engine of its own:
//   touch()              a silent sound, synchronously, in the touch
//   record(genre, seed)  NuPrecompose.genreToDocument, whole
//   warm(doc)            the sampled instruments the record seats, fetched
//   put(doc, under)      the record's share of ui/eight.js `push()` — as a new
//                        song (`adoptSong`), or UNDER a running transport, as
//                        `evolve` does (no adopt: "song" stops the engine)
//   start()              audio/live.js `startAt(0)`: cold it opens the engine
//                        (so it must be called in a touch); playing, it queues
//                        a jump to the first box on the next bar line
//   stop()  volume(g)    audio/live.js `stop`, the master fader
//   on(type, fn)         ui/state.js's bus: `pos`, `transport:round`,
//                        `transport:state`, `transport:section`
//   report()             what the engine says of itself (audio/live.js health)
//
// The classic scripts (kernel.js … precompose.js) must already be on the page;
// ./index.js puts them there for a host that has none of them.
import { GENRES, NuDocument, NuDeskDoc, NuPrecompose, NuSong } from "../ui/deps.js";
import * as state from "../ui/state.js";
import * as live from "../audio/live.js";
import * as plan from "../audio/plan.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";

const GK = "lab.embed.";
const SITE = new URL("../../", import.meta.url).href;

/** The sampled instruments a slow record seats (found/samples/instruments/<id>/);
 *  every other seat is a Faust model and needs nothing fetched. A host that
 *  ships a different cut of the samples says so (`sampled`). */
export const SAMPLED = ["slow_strings", "church_organ", "flute", "harp", "contrabass", "acoustic_bass"];

let unlockEl = null;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export async function makeStellate(opts) {
  const sampled = (opts && opts.sampled) || SAMPLED;
  await plan.warmEngine();
  const NATIVE = SYNTH_NAMES();
  const get = (p) => fetch(SITE + p, { credentials: "same-origin" });
  return {
    /* IN THE TOUCH, BEFORE ANYTHING IS AWAITED. audio/live.js plays a silent
       wav at the top of `startAt` for the same reason (THE IN-GESTURE UNLOCK),
       but the radio composes and warms a record before it starts, and those
       awaits outlive the touch: so the page becomes one that has played media
       HERE, synchronously, and the engine's element is allowed its play()
       when it is born a second later. */
    touch() {
      try {
        if (!unlockEl) { unlockEl = new Audio(SILENT_WAV); unlockEl.setAttribute("playsinline", ""); }
        const pr = unlockEl.play(); if (pr && pr.catch) pr.catch(() => {});
      } catch (e) {}
    },
    record: (genre, seed) => NuPrecompose.genreToDocument(genre, seed),
    async warm(doc) {
      const ids = [...new Set(doc.voices.map((v) => v.instrument || "").filter((i) => sampled.includes(i)))];
      await Promise.all(ids.map((id) =>
        get("found/samples/instruments/" + id + "/zones.json").then((r) => r.json())
          .then((z) => Promise.all(z.zones.map((q) =>
            get("found/samples/instruments/" + id + "/" + q.file).then((r) => r.arrayBuffer()))))
          .catch(() => {})));
    },
    put(doc, under) {
      const secs = doc.form.sections;
      secs.forEach((_s, i) => { GENRES[GK + i] = NuDocument.toGenre(doc, i, GENRES, NATIVE); });
      for (let i = secs.length; i < 64; i++) delete GENRES[GK + i];
      state.setBasis(doc.basis || null);
      const lines = doc.voices.filter((v) => v.kind === "line");
      if (!under) state.adoptSong({ v: NuSong.VERSION, bpm: doc.time.bpm, genres: {},
        slots: [lines[0] ? NuDocument.toPhrase(doc, NuDocument.materialAt(lines[0], secs[0].id)) : NuSong.blank()],
        song: [{ ...NuSong.emptyBox(), stack: [{ g: GK + "0", slots: [0] }], len: secs[0].bars }] }, "embed");
      state.setBpm(doc.time.bpm);
      state.setSwing(doc.time.swing || null);
      state.setMeter(doc.time.meter || null);
      state.setGroove(doc.time.groove || null);
      NuDocument.slotsOf(doc).forEach((ph, i) => { if (ph) state.putPhrase(i, ph); });
      const boxes = NuDocument.boxesOf(doc, GK), parts = NuDeskDoc.deskPartsOf(doc, GENRES);
      boxes.forEach((b, i) => {
        b.parts = parts;
        const ca = NuDeskDoc.cellAutoOf(doc, GENRES, secs[i].id);
        if (ca) b.cellauto = ca;
      });
      state.setMaster(NuDeskDoc.masterOf(doc));
      state.setBuses(NuDeskDoc.busesOf(doc));
      state.SONG.length = 0;
      for (const b of boxes) state.SONG.push(b);
      state.commit("box"); state.commit("swing"); state.commit("transport");
      plan.compile();
    },
    start: () => live.startAt(0),
    stop: () => { live.stop(); },
    volume(g) {
      state.setVol(Math.round(g * 100));
      try { const h = live.engineHandle(); if (h) h.setMasterVol(g); } catch (e) {}
    },
    on: (type, fn) => { state.on(type, fn); },
    report() {
      const h = live.engineHandle();
      const call = (k) => { try { return h && typeof h[k] === "function" ? h[k]() : undefined; } catch (e) { return "! " + e; } };
      return { isolated: !!self.crossOriginIsolated, route: h && h.outputRoute,
               ctx: h && h.ctx && h.ctx.state, runway: call("runwaySec"),
               underruns: call("underruns"), wav: call("__wavState"),
               errors: h && Array.isArray(h.errors) ? h.errors.slice(-4) : undefined,
               line: (() => { try { return live.engineLine(); } catch (e) { return ""; } })() };
    },
  };
}

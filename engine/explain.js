// explain.js — READ A STATE, EMIT ITS SPEC SHEET. No LLM, no per-genre prose.
//
// Every line this produces comes from a TABLE keyed on an engine value — a
// bracket of a number, a kit id, a pattern name — never from a string written
// about a particular genre. That is the same law tools/genre/gen-genre-info.js
// holds for the 274 card blurbs, and for the same reason: hand-written prose
// beside live data is what rots first. Change the anchor and the sheet follows.
//
// The register is deliberately flat. This is a readout, not an essay: values,
// units, and the one sentence that says what the value does. A genre it has
// never seen still gets a correct sheet, because it is describing the STATE.
//
// It also produces the BUILD: an ordered list of layer-limited states, each with
// everything after it muted, so a page can play "drums only", then "drums and
// bass", and so on. That is what makes the sheet show how the song is built
// rather than merely listing what it contains.

(function (root) {
  "use strict";
  const engineRef = () => (typeof module !== "undefined" && module.exports)
    ? require("./csd-engine.js") : root.CsdEngine;

  // -------------------------------------------------------------- the tables
  const band = (v, table) => { for (const [lim, word] of table) if (v <= lim) return word; return table[table.length - 1][1]; };
  const TEMPO = [[70, "very slow"], [88, "slow"], [104, "walking"], [124, "mid"], [140, "fast"], [170, "very fast"], [999, "extreme"]];
  const AMOUNT = [[0.001, "none"], [0.12, "trace"], [0.3, "light"], [0.55, "moderate"], [0.8, "heavy"], [9, "extreme"]];
  const SWING = [[0.005, "straight"], [0.06, "a slight lean"], [0.16, "swung"], [9, "heavily swung"]];
  const KIT = { off: "silent", kick: "kick only", full: "kick, snare, eighth hats",
    open: "kick, snare, open hats", four: "four on the floor", boombap: "swung kick, hard backbeat",
    halftime: "one kick, one snare, half speed", trap: "sparse kick, rolling sixteenth hats",
    techno: "machine four, offbeat opens", house: "four on the floor, claps",
    breaks: "broken kick, syncopated snare", jungle: "chopped break", onedrop: "beat one empty",
    pulse: "driving four with ghost snares", tribal: "galloping kicks, busy hands",
    bossa: "rim and brush", electro: "electro kick pattern", newjack: "swung new jack",
    shuffle: "triplet shuffle", waltz: "three beats", waltzswing: "swung three", sixeight: "compound six" };
  const BASS = { off: "silent", root: "the root, held", simple: "root and fifth",
    walking: "a walking line", octaves: "octave jumps", sixteenths: "running sixteenths",
    dub: "sparse and deep", drive: "driving eighths", rolling: "rolling triplets", sub: "sub-bass, long",
    stab: "short stabs", melodic: "a melodic line", habanera: "habanera", syncopated: "syncopated",
    pedal: "one pedal note", sludge: "slow and heavy", tresillo: "tresillo", son: "son clave",
    hemiola: "hemiola", charleston: "charleston", oompahpah: "oom-pah-pah",
    waltzroot: "root on one", siciliana: "siciliana" };
  const MEL = { off: "silent", composed: "a written line", composed2: "a written line, second form",
    arpup: "arpeggio, rising", arpdown: "arpeggio, falling", updown: "arpeggio, up and down",
    pentaup: "pentatonic, rising", wander: "a random walk over chord tones", sparse: "few notes, long",
    double: "doubled octaves", hero: "sixteenth runs", blues: "a blues lick", canon: "a line and its echo",
    roar: "held and loud", anthem: "few notes, held", arp16: "sixteenth arpeggio",
    motorik: "motorik pulse", fugue: "imitative counterpoint", sludge: "power chords, held" };
  const FORM = { pop: "verse and chorus", dj: "build and drop", vamp: "one figure, repeated",
    drop: "build and drop", jazz: "head and solos", loop: "one loop", through: "through-composed" };

  const pct = (v) => Math.round((v || 0) * 100) + "%";
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + " kHz" : Math.round(v) + " Hz");

  // ------------------------------------------------------------ the spec sheet
  // Ordered the way the engine builds: the clock, then the harmony, then the
  // form, then each voice in the order it is generated, then the treatments that
  // run over all of it. Reading down is reading the pipeline.
  function sheet(st, E) {
    E = E || engineRef();
    const secs = st.sections || [];
    const used = (f) => [...new Set(secs.map((s) => s[f]).filter((v) => v && v !== "off"))];
    const prg = E.getProgression(st.progression);
    const kits = used("drums"), basses = used("bass"), mels = used("melody");
    const meta = st.genreMeta || {};
    const placed = [...new Set(secs.map((x) => x.found && x.found.sourceId).filter(Boolean)
      .concat((st.sampleEvents || []).map((x) => x.srcId).filter(Boolean)))];
    const byId = {};
    for (const f of st.foundSources || []) byId[f.id] = f.label || f.id;
    const rows = [];
    const R = (id, title, value, lines, data) => rows.push({ id, title, value, lines, data: data || null });

    // ORDER IS BY WHAT DEPENDS ON WHAT, not by when I happened to write it. THE
    // BED AND THE CLOCK ARE THE GROUND — neither depends on anything else in the
    // state, and on an anchor like vaporwave the field recording is the floor the
    // whole track sits on. Listing it fourth, after the form, described a song
    // nobody builds. Then harmony (depends on nothing), form (depends on
    // harmony), the four voices in the order the engine generates them, and last
    // the treatments, which run over everything above.

    R("found", "found sound", placed.length ? placed.length + (placed.length === 1 ? " source" : " sources") : "none",
      placed.length ? [placed.map((id) => byId[id] || id).join(" · "), "the bed — it plays under everything",
        "placed by the section's own rule"]
        : ["no field recordings placed"],
      { placed });

    R("clock", "clock", Math.round(st.bpm) + " bpm",
      [band(st.bpm, TEMPO), (st.chordEvery || 8) + " beats per chord",
        band(st.swing || 0, SWING), "timing spread " + pct(st.humanize || 0)]);

    R("harmony", "harmony", (prg.label || st.progression),
      [prg.chords.length + " chords", prg.chords.map((c) => c.name).join(" · "),
        "key offset " + (st.keyOffset || 0) + " semitones",
        st.theory && st.theory.reharm ? "reharmonised per cycle" : "fixed progression"],
      { chords: prg.chords.map((c) => c.name) });

    R("form", "form", secs.length + " sections",
      [FORM[meta.form] || "sectional",
        secs.map((s) => s.name).join(" · "),
        secs.reduce((n, s) => n + (s.cycles || 1), 0) + " cycles total"],
      { sections: secs.map((s) => ({ name: s.name, cycles: s.cycles || 1,
        on: ["drums", "bass", "melody"].filter((f) => s[f] && s[f] !== "off").concat(s.pads ? ["pads"] : []) })) });

    R("drums", "drums", kits.length ? kits.join(" / ") : "none",
      kits.length ? kits.map((k) => k + ": " + (KIT[k] || "a kit")).concat(
        [secs.filter((s) => s.drums && s.drums !== "off").length + " of " + secs.length + " sections"])
        : ["this genre uses no kit"],
      { kits });

    R("bass", "bass", basses.length ? basses.join(" / ") : "none",
      basses.length ? basses.map((b) => b + ": " + (BASS[b] || "a line")).concat(
        [st.rhythm && st.rhythm.complexity ? "variation " + pct(st.rhythm.complexity) : "no variation"])
        : ["this genre uses no bass"]);

    R("pads", "pads", secs.filter((s) => s.pads).length + " of " + secs.length + " sections",
      ["the chord, sustained", "reverb " + pct(st.reverb)]);

    // NOT `foundSources.length`. Every sampler zone rides that array at volume 0
    // (the kernel's own pitched-to-sampler rewrite), so a vaporwave anchor reports
    // 651 "sources" of which none are field recordings. What is actually PLACED is
    // what the sections name plus what the sample recipes emit.

    R("melody", "melody", mels.length ? mels.join(" / ") : "none",
      mels.length ? mels.map((m) => m + ": " + (MEL[m] || "a line")).concat(
        [secs.filter((s) => s.melody && s.melody !== "off").length + " of " + secs.length + " sections"])
        : ["this genre states no melody"]);

    R("texture", "texture",
      [["crackle", st.crackle], ["pump", st.pump], ["grit", st.grit], ["autotune", st.autoTune]]
        .filter(([, v]) => v > 0.01).map(([k]) => k).join(" · ") || "clean",
      [st.crackle > 0.01 ? "record crackle " + pct(st.crackle) : null,
        st.pump > 0.01 ? "sidechain pump " + pct(st.pump) : null,
        st.grit > 0.01 ? "saturation " + pct(st.grit) : null,
        st.autoTune > 0.01 ? "pitch correction " + pct(st.autoTune) : null,
        "compression " + band(st.comp || 0, AMOUNT)].filter(Boolean));

    R("space", "space", pct(st.reverb) + " reverb",
      ["delay " + (st.delay ? (+st.delay.beats).toFixed(2) + " beats, " + pct(st.delay.feedback) + " back" : "none"),
        "top cut at " + hz((st.tone && st.tone.highcut) || 20000),
        (st.tone && st.tone.lowcut) ? "bottom cut at " + hz(st.tone.lowcut) : "full bottom"]);

    const pipes = (st.pipes || []).map((p) => p.id || p);

    R("notefx", "note effects", pipes.length ? pipes.join(" · ") : "none",
      pipes.length ? ["applied in order, before the mix"] : ["the notes are played as generated"]);

    return rows;
  }

  // ------------------------------------------------------------------ the build
  // Cumulative layer states: index k plays layers 0..k and mutes the rest, so a
  // page can walk "drums only" → "drums and bass" → … and the reader HEARS the
  // song assemble. Muting is done on a deep copy; the source state is untouched.
  // FOUND IS NOT A SEPARABLE LAYER, so it is not offered as one. On a
  // `sampledOnly` anchor the drum kit is a sampler whose sources ride
  // `foundSources`, and the found player is what plays them — so muting the
  // found bed silences the drums too. Measured on vaporwave with every pitched
  // voice off: bed intact 0.166, sourceId nulled 0.0009, spec deleted 0.0009.
  // Keeping the key was not enough; the layer genuinely is not independent.
  //
  // Rather than ship a button that silences the thing it claims not to touch,
  // the build walks the four voices that ARE separable and leaves the anchor's
  // found layer exactly as it found it, in every step. The sheet says so.
  const LAYERS = ["drums", "bass", "pads", "melody"];
  function buildStates(st) {
    const out = [];
    for (let k = 0; k < LAYERS.length; k++) {
      const c = JSON.parse(JSON.stringify(st));
      const on = LAYERS.slice(0, k + 1);
      for (const s of c.sections || []) {
        if (on.indexOf("drums") < 0) s.drums = "off";
        if (on.indexOf("bass") < 0) s.bass = "off";
        if (on.indexOf("pads") < 0) s.pads = false;
        if (on.indexOf("melody") < 0) { s.melody = "off"; delete s.counter; }
        // EMPTY, NOT ABSENT — and the difference is the whole mix.
        //
        // `delete s.found` took vaporwave from 0.166 to 0.0009 while the event
        // stream stayed correct and loud (304 drum hits, kick at 0.99). On a
        // `sampledOnly` anchor the DRUM KIT is a sampler whose sources ride
        // `foundSources` (genre-kernel applySampledOnly), and the found layer is
        // what plays them — so removing the section's found spec removed the
        // thing that was making the drums. A section that plays no bed still
        // carries `{sourceId: null}`, exactly as csd-engine's own DEFAULT_SONG
        // does; that is the shape the engine expects and it is not optional.
        //
        // Measured, all pitched voices muted: keep the spec 0.1656 · delete it
        // 0.0009. Every mutation in isolation was fine, which is why a bisect
        // that never tried the COMBINATION found nothing.
      }
      out.push({ layer: LAYERS[k], on: on.slice(), state: c });
      // NOTE: muting a layer changes how many random numbers the remaining
      // generators draw, so the drum count shifts slightly between steps. That is
      // the engine being seeded per voice rather than per note, and it is honest:
      // these are five real states, not one state with tracks faded down.
    }
    return out;
  }

  // WHICH KNOBS BELONG TO WHICH ROW of the sheet, so the page can put a control
  // under the line that describes it rather than in a panel somewhere else.
  // Keyed on the knob's own `group`, which engine/knobs.js already declares.
  const ROW_KNOBS = { clock: "clock", space: "space", texture: "texture", drums: "edit" };

  const api = { sheet, buildStates, LAYERS, ROW_KNOBS, TEMPO, AMOUNT, SWING, KIT, BASS, MEL, FORM };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdExplain = api;
})(typeof window !== "undefined" ? window : globalThis);

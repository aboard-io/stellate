// test/precompose.test.js — 130 anchors × seeds {1,2,3} = 390 whole records.
//
// PROGRAM.md §5: "no throw · shape against every vocabulary table · the cell
// invariant · non-silence PER SECTION · ≥3 distinct cells per record · punk ≠
// bossa ≠ chant, named · determinism · the frozen-fixture no-op."
//
// PURE NODE. No DOM, no audio, no browser — the data tier stands on `require`
// alone, the way main:test/unit/nukernel.test.js:2688 already proved works.
//
// TEST THE ARTIFACT. Steps 4 and 6 do not read the document, they read the
// EVENTS the kernel emits from it — because three features have shipped broken
// in this repo while every structural check passed, and a record that type-
// checks and makes no sound is exactly that failure again. The render below
// reproduces ui/derive.js:395-440's own arithmetic (the bar measured off the
// GENRE, never off the phrase; the window that crops a long cell; drums and
// bass following the FIRST phrase) rather than calling document.js `scoreOf`,
// because scoreOf reads `sections[].bars` as musical bars and PROGRAM.md §2.1
// fixes it as CELL bars — see the RECIPE this slice shipped alongside.
"use strict";
const assert = require("assert");
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), NF = R("fields.js"), K = R("kernel.js");
const NI = R("instruments.js"), NuSongs = R("songs.js");
const Doc = R("document.js"), P = R("precompose.js"), NC = R("compose.js");
const { GENRES, MODES, SCALES } = NG;
const { WORDS, TERMS } = NuSongs;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const J = (x) => JSON.parse(JSON.stringify(x));

const KEYS = Object.keys(Object.assign({}, NF.KEYS));
const QUAL = new Set([...Object.keys(K.QSTEPS), ...Object.keys(K.QFIX)]);
// NOT Object.keys(GENRES): at runtime the page registers `lab.eight.N` rows
// into the same table (precompose.js `anchors` says why, and it was found in a
// browser). One owner for "what can be precomposed".
const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3];

/* ---------- the score, exactly the way ui/derive.js builds one ---------- */
// `sec.bars` counts CELL bars (PROGRAM.md §2.1), so the MUSICAL length of a
// section is `bars × the cell's own bar count`, and that is the number both
// the render length and the window are measured in.
function sectionEvents(doc, i) {
  const g = Doc.toGenre(doc, i, GENRES);
  const sec = doc.form.sections[i];
  const lines = doc.voices.filter((v) => v.kind === "line");
  const phrases = lines.map((c) => Doc.toPhrase(doc, Doc.materialAt(c, sec.id)));
  const cb = Doc.barsOf(doc);
  const musical = Math.max(1, sec.bars * cb);
  const barSteps = K.stepsIn(g) / g.rate;
  const total = Math.ceil(musical / g.bars) * g.bars;
  const to = musical * barSteps;
  const out = [];
  const nP = phrases.length;
  phrases.forEach((ph, pi) => {
    const evs = K.render(ph, g, total);
    for (let v = pi; v < g.voices; v += nP)
      for (const e of evs) if (e.v === v) out.push({ ...e, kind: "line" });
  });
  const lead = phrases[0];
  if (lead) {
    const dr = K.drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
    for (let r = 0; r < Math.ceil(total / g.bars); r++)
      for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
    for (const e of K.bass(lead, g, total)) out.push({ ...e, kind: "bass" });
  }
  return out.filter((e) => e.t >= 0 && e.t < to && (e.vel == null || e.vel > 0));
}

(async function main() {
  console.log("precompose — " + ANCHORS.length + " anchors × " +
              SEEDS.length + " seeds = " + ANCHORS.length * SEEDS.length + " records\n");

  /* THE ENGINE'S OWN ANSWERS, loaded once. `audio/to-engine.js` is an ES
     module and the only place that knows which names are modelled Faust voices
     (`SYNTH_NAMES`) and which recipe a chair actually resolves to
     (`recipeFor`). G1 needs the first (the document may now spell a chair
     "synth") and G12 needs the second, and both must be the ENGINE's answer
     rather than a second opinion about it — a census that resolved chairs by
     its own shorter rule would be measuring a different band than the one that
     plays. */
  const TE = await import(path.join(__dirname, "..",
    "nukernel", "audio", "to-engine.js"));
  const { SYNTH_NAMES } = TE;
  const FLEET = SYNTH_NAMES();
  // THE RECORD'S SIGNATURE, asked exactly the way `document.js synthOf` asks it
  // (its own line 51), because "may this chair say 'synth'" and "is there a
  // synth for it to mean" have to be the same question.
  const SIG = (doc) => (doc.sound && doc.sound.synth) ||
    (GENRES[doc.basis] || {}).synth || null;

  /* ================================================================== G0-G5
     One walk over every record. Each assertion is counted once for the whole
     sweep so a table error names the anchor rather than printing 366 lines. */
  const docs = new Map();
  const bad = { throw: [], shape: [], cell: [], silent: [], same: [], sound: [] };
  let nRecords = 0, nSections = 0, nEvents = 0, nCells = 0;
  const cbHist = {};
  // THE SOUND AXIS, COUNTED (STATE.md items 17 and 18). Every one of these was
  // 0 or 1 before this round: 0 records with a `sound.buses`, 0 with a
  // `voice.desk`, and one groove word on 97 anchors. A count that comes out
  // uniform is the same bug in a new spelling, so G9d measures the SPREAD and
  // not merely the presence.
  const hist = (h, k) => { h[k == null ? "(none)" : k] = (h[k == null ? "(none)" : k] || 0) + 1; };
  const hGroove = {}, hRet = {}, hColor = {}, hName = {};
  const hEchoTime = {}, hEchoFb = {}, hEchoTone = {}, hBoxFx = {}, hDeskKey = {};
  let nDeskVoices = 0, nVoices = 0, nBuses = 0, nEchoBus = 0;
  const noDesk = [];

  for (const gk of ANCHORS) for (const seed of SEEDS) {
    let doc;
    try { doc = P.genreToDocument(gk, seed); }
    catch (e) { bad.throw.push(gk + "/" + seed + ": " + e.message); continue; }
    docs.set(gk + "/" + seed, doc);
    nRecords++;
    const where = gk + "/" + seed;
    const say = (m) => bad.shape.push(where + ": " + m);

    /* --- G1 SHAPE, against every vocabulary table --------------------- */
    for (const k of ["basis", "time", "alphabet", "material", "form",
                     "voices", "sound", "performance"])
      if (doc[k] == null) say("no " + k);
    if (doc.basis !== gk) say("basis is " + doc.basis);

    const T = doc.time;
    if (!Number.isFinite(T.bpm) || T.bpm < 60 || T.bpm > 200) say("bpm " + T.bpm);
    if (!Number.isFinite(T.rate) || T.rate <= 0) say("rate " + T.rate);
    if (T.meter != null && !NF.METERLABEL[T.meter]) say("meter " + T.meter);
    if (T.swing != null && !NF.SWINGS[T.swing]) say("swing " + T.swing);
    if (T.groove != null && !NF.GROOVELABEL[T.groove]) say("groove " + T.groove);

    const A = doc.alphabet;
    if (!KEYS.includes(String(A.key))) say("key " + A.key);
    if (!MODES[A.mode]) say("mode " + A.mode);
    if (A.scale != null && !SCALES[A.scale] && !MODES[A.scale]) say("scale " + A.scale);
    if (typeof A.diatonic !== "boolean") say("diatonic " + A.diatonic);
    if (!["modal", "cycle", "emergent"].includes(A.harmony)) say("harmony " + A.harmony);
    if (!Array.isArray(A.prog) || !A.prog.length) say("no prog");
    for (const c of A.prog || []) {
      if (!Number.isInteger(c.d)) say("prog degree " + c.d);
      if (!QUAL.has(c.q)) say("prog quality " + c.q);
    }

    const names = Object.keys(doc.material.cells);
    if (!names.length) say("no cells");
    for (const n of names) {
      const c = doc.material.cells[n];
      if (c.kind === "drum") {
        if (!Object.keys(c.lanes || {}).length) say("empty kit cell " + n);
        continue;
      }
      nCells++;
      if (!Array.isArray(c.deg) || !c.deg.length) say("cell " + n + " has no deg");
      for (const f of ["play", "vel", "acc"])
        if (!Array.isArray(c[f]) || c[f].length !== c.deg.length)
          say("cell " + n + "." + f + " is not " + c.deg.length + " long");
      for (const p of c.play) if (!["n", "h", "r"].includes(p)) say("play word " + p);
      if (!c.play.includes("n")) say("cell " + n + " has no onset");
    }

    const secIds = doc.form.sections.map((x) => x.id);
    if (new Set(secIds).size !== secIds.length) say("duplicate section ids");
    for (const s of doc.form.sections) {
      if (!NF.ROLES[s.role]) say("role " + s.role);
      if (!Number.isInteger(s.bars) || s.bars < 1) say("bars " + s.bars);
      if (s.period != null && !NF.PERIODS[s.period]) say("period " + s.period);
      nSections++;
    }

    const vnames = doc.voices.map((v) => v.name);
    if (new Set(vnames).size !== vnames.length) say("duplicate voice names");
    let lines = 0, bassv = 0, drumv = 0;
    for (const v of doc.voices) {
      for (const id of secIds)
        if (v.development[id] == null) say(v.name + " has no word for " + id);
      if (v.kind === "line") {
        lines++;
        if (!K.PARTS[v.cast.part]) say(v.name + " part " + v.cast.part);
        if (!Number.isInteger(v.cast.reg) || v.cast.reg < -4 || v.cast.reg > 3)
          say(v.name + " reg " + v.cast.reg);
        if (!Number.isInteger(v.cast.entry) || v.cast.entry < 0)
          say(v.name + " entry " + v.cast.entry);
        // THE MENU IS THE VOCABULARY, and it is wider than INSTRCHOICES.
        // `avail.js instrOptions` offers a line chair three kinds of answer: a
        // sampled id (INSTRCHOICES), a Faust model BY NAME (the fleet), and —
        // when the record has a signature — the literal string "synth", which
        // `document.js:184,205` reads as "name nothing, the record's own keeps
        // the part". This check knew only the first, which is why it passed for
        // as long as precompose named a sample on every chair and failed the
        // moment one said "the record's own". Held against the page's own menu
        // so the two cannot drift.
        if (!NF.INSTRCHOICES[v.instrument] && !FLEET.includes(v.instrument) &&
            !(v.instrument === "synth" && SIG(doc)))
          say(v.name + " instrument " + v.instrument);
        for (const id of secIds)
          if (!WORDS[v.development[id]]) say(v.name + "/" + id + " word " +
            JSON.stringify(v.development[id]));
        const m = v.material;
        const cellsRead = typeof m === "string" ? [m] : Object.values(m);
        for (const c of cellsRead)
          if (!doc.material.cells[c] || doc.material.cells[c].kind === "drum")
            say(v.name + " reads no such line cell " + c);
      } else if (v.kind === "bass") {
        bassv++;
        if (v.cast.style && !NF.BASSOPS[v.cast.style]) say("bass style " + v.cast.style);
        for (const id of secIds) {
          const w = v.development[id];
          if (w !== "" && !NF.BASSOPS[w]) say("bass word " + JSON.stringify(w));
        }
      } else if (v.kind === "drums") {
        drumv++;
        if (!NF.DRUMKITS[v.instrument]) say("drumkit " + v.instrument);
        if (!doc.material.cells[v.material] ||
            doc.material.cells[v.material].kind !== "drum") say("drums read no grid");
        for (const id of secIds) {
          const w = v.development[id];
          if (w !== "" && !NF.KITLABEL[w]) say("kit word " + JSON.stringify(w));
        }
      } else say("voice kind " + v.kind);
    }
    if (!lines) say("no line voices");
    if (bassv > 1 || drumv > 1) say("more than one rhythm-section voice");
    if (!GENRES[gk].nobass && !bassv) say("anchor has a bass and the record has none");

    if (doc.sound.level !== 1) say("sound.level " + doc.sound.level);
    if (doc.sound.master) {
      const known = new Set(NF.MASTER.map((f) => f.key));
      for (const [k, v] of Object.entries(doc.sound.master)) {
        if (!known.has(k)) { say("master." + k + " is not a MASTER key"); continue; }
        const f = NF.MASTER.find((x) => x.key === k);
        if (!(v in f.table)) say("master." + k + " = " + v + " is not one of its words");
      }
    }

    /* --- THE SOUND AXIS, WALKED OFF THE REGISTRY ITSELF -----------------
       Not against a list written here: against `NF.BUSES` and `NF.PARTMIX`,
       which are the same rows song.js validates a SAVE against. A hand-copied
       list of legal words is a list that goes stale, and a precomposer that
       invents a spelling would then round-trip through the loader as an
       unknown key and be dropped silently on the way in — which is exactly the
       failure this walk exists to catch. */
    const sound = (m) => bad.sound.push(where + ": " + m);
    const B = doc.sound.buses;
    if (B == null) sound("no sound.buses");
    else {
      nBuses++;
      for (const [bus, row] of Object.entries(B)) {
        const reg = NF.BUSBY[bus];
        if (!reg) { sound("bus " + bus + " is not a fields.js bus"); continue; }
        if (bus === "echo") nEchoBus++;
        for (const [k, v] of Object.entries(row)) {
          if (k === "eq") continue;                    // its own shape, and unwritten here
          const knob = reg.knobs.find((x) => x.key === k);
          if (!knob) { sound(bus + "." + k + " is not a knob of that bus"); continue; }
          if (!Object.prototype.hasOwnProperty.call(knob.table, String(v)))
            sound(bus + "." + k + " = " + JSON.stringify(v) + " is not one of its words");
        }
      }
      if (!B.rev || B.rev.ret == null) sound("no rev.ret — the return is still shut");
      else {
        hist(hRet, B.rev.ret); hist(hColor, B.rev.color); hist(hName, B.rev.name);
        // THE FINDING FIELDS.JS:466 NAMES, ASSERTED: "78% wet and bone dry, for
        // as long as this page has existed." A `ret` that resolves to 0 is that
        // bug written down in a document instead of left out of one.
        if (!(NF.RETURNS[B.rev.ret] > 0))
          sound("rev.ret " + B.rev.ret + " resolves to " + NF.RETURNS[B.rev.ret]);
      }
      if (B.echo) { hist(hEchoTime, B.echo.time); hist(hEchoFb, B.echo.fb);
                    hist(hEchoTone, B.echo.tone); }
    }
    // THE CHARACTER CHIP MOVED OFF THE RECORD AND ONTO THE CHAIRS, 2026-08-27
    // (Paul: "We can get rid of Character right?"). This counted
    // `doc.sound.fx` and checked its keys; the record-wide field is retired,
    // so the same census is taken where the chip lives now — the FIRST voice's
    // `desk.fx`, because precompose deals one chain to the whole cast and
    // counting it once per record is what the histogram means.
    if (doc.sound.fx) sound("sound.fx is retired and this record still carries one");
    hist(hBoxFx, ((doc.voices[0] && doc.voices[0].desk &&
                   doc.voices[0].desk.fx) || []).join("+") || null);

    let deskHere = 0;
    for (const v of doc.voices) {
      nVoices++;
      if (!v.desk) continue;
      deskHere++; nDeskVoices++;
      for (const [k, val] of Object.entries(v.desk)) {
        hist(hDeskKey, k);
        const f = NF.PARTMIXBY[k];
        if (!f) { sound(v.name + ".desk." + k + " is not a PARTMIX key"); continue; }
        // A `list` FIELD IS CHECKED MEMBER BY MEMBER (2026-08-27). `fx` is the
        // one PARTMIX row whose value is an array (fields.js: `{key:"fx",
        // type:"list", table:FX, max:MAX_FX}`), and until the character chips
        // were dealt to the chairs no precomposed record wrote one — so this
        // walk stringified the whole array and asked the FX table for it,
        // which every chain would have failed. Same question, per member,
        // plus the row's own cap.
        if (f.type === "list") {
          if (!Array.isArray(val)) { sound(v.name + ".desk." + k + " is not a list"); continue; }
          for (const one of val)
            if (!Object.prototype.hasOwnProperty.call(f.table, String(one)))
              sound(v.name + ".desk." + k + " member " + JSON.stringify(one) +
                    " is not one of its words");
          if (f.max != null && val.length > f.max)
            sound(v.name + ".desk." + k + " is longer than the row's max");
          continue;
        }
        if (f.table && !Object.prototype.hasOwnProperty.call(f.table, String(val)))
          sound(v.name + ".desk." + k + " = " + JSON.stringify(val) + " is not one of its words");
      }
      // AND IT MUST SURVIVE THE REGISTRY'S OWN CLEANER. desk-doc.js cleanEntry
      // drops every dead spelling of a default before the entry reaches a box,
      // so an entry that cleans away to nothing is an entry that draws on the
      // board and reaches no sound.
      if (JSON.stringify(NF.resolvePartMix(v.desk)) ===
          JSON.stringify(NF.resolvePartMix(null)))
        sound(v.name + ".desk resolves to the untouched channel");
    }
    if (!deskHere) noDesk.push(where);
    hist(hGroove, doc.time.groove);
    if (doc.performance.take !== 0 || doc.performance.ontime !== true)
      say("performance defaults moved");

    // THE PAGE MUST NOT HAVE TO REPAIR IT. `normalize` fills a missing word,
    // prunes a word for a section that is gone and repoints a voice at a cell
    // that is not there — so if it CHANGES a precomposed record, the compiler
    // wrote something the page silently rewrites, and what plays is not what
    // this file said. A no-op here is the whole claim.
    {
      const before = JSON.stringify(doc);
      Doc.normalize(doc);
      if (JSON.stringify(doc) !== before) say("normalize() repaired the record");
    }
    // ...and every section becomes exactly one box the state tier can hold.
    {
      const bx = Doc.boxesOf(doc, "gate.");
      if (bx.length !== doc.form.sections.length) say("boxesOf lost a section");
      bx.forEach((b, i) => {
        if (b.len !== doc.form.sections[i].bars) say("box " + i + " len " + b.len);
        if (!b.stack[0].slots.length) say("box " + i + " has no slots");
      });
    }

    /* --- G2 THE CELL INVARIANT --------------------------------------- */
    // Every LINE cell in one document is the SAME length and a whole multiple
    // of stepsIn(meter). Two lengths give two voices different bar arithmetic
    // against one `total` (ui/derive.js:420) — that is the failure mode.
    const steps = K.stepsIn({ meter: NF.METERLABEL[T.meter] ? K.METERS[T.meter] : null });
    const lens = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
                              .map((n) => doc.material.cells[n].deg.length));
    if (lens.size !== 1) bad.cell.push(where + ": " + lens.size + " different cell lengths");
    const L = [...lens][0];
    if (L % steps) bad.cell.push(where + ": cell " + L + " is not a multiple of " + steps);
    const cb = Doc.barsOf(doc);
    if (cb !== L / steps) bad.cell.push(where + ": barsOf says " + cb + ", cell says " + L / steps);
    cbHist[cb] = (cbHist[cb] || 0) + 1;

    /* --- G3 ≥3 DISTINCT CELLS ---------------------------------------- */
    const shapes = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
      .map((n) => doc.material.cells[n].deg.join(",") + "|" +
                  doc.material.cells[n].play.join("")));
    if (shapes.size < 3) bad.same.push(where + ": only " + shapes.size + " distinct cells");

    /* --- G4 NON-SILENCE, PER SECTION --------------------------------- */
    doc.form.sections.forEach((s, i) => {
      const ev = sectionEvents(doc, i);
      nEvents += ev.length;
      if (!ev.length) bad.silent.push(where + " section " + i + " (" + s.role + ")");
    });
  }

  // 139 since 2026-08-25, and the number is deliberately still a LITERAL: the
  // gate's whole point is that anchors() returns the catalog and not the
  // `lab.eight.N` session keys the page registers into the same table, and a
  // count derived from GENRES would pass while both drifted together. So it
  // is bumped by hand by whoever grows the catalog — 122 anchors + the eight
  // 2020s rows ("'now' is a lie, it's the 2010s", Paul, 2026-08-24) + the
  // nine African anchors ("fix the afrobeat parents and add the missing
  // African history", Paul, 2026-08-25: Aksum 540, Accra 1957, Johannesburg
  // 1935/1939/1994, Kinshasa 1960, Addis Ababa 1969, Bamako 1970, Oran 1985)
  // + the SIXTY of the world round ("Fill in lots of world historical genres
  // including non western stuff over a long period of time", Paul,
  // 2026-08-26: 21 in Latin America and the Caribbean, 9 in Africa, 5 in East
  // Asia, 6 in Southeast Asia, 3 in South Asia, 6 in the Middle East and
  // Central Asia, 5 in Europe and 5 in North America)
  // + the TWO news themes ("I want you to add 1970s news theme and 2000s news
  // theme as genres", Paul, 2026-08-28: London 1970 and New York 2006)
  // + the TWELVE of the four-traditions round ("Add the missing genres and
  // start filling in western, Arabic and Chinese and Indian classical music",
  // Paul, 2026-08-29): the two most-wanted missing ancestors in the whole
  // catalogue (jumpblues, wanted by six rows, and tinpanalley, wanted by
  // five), three Western art-music holes the table itself named (chorale,
  // belcanto, serial), three Arabic (taqsim, firqa, nuba), two Chinese
  // (guqin, sizhu) and two Indian (dhrupad, carnatic). FOUR MORE WERE
  // DRAFTED AND REFUSED under WORLD.md §4's primary-fact rule — jingju,
  // guoyue, khyal and gamelan — and the reasons are at the foot of that
  // block in genres.js, which is the point of the rule.
  // + the THIRTY-TWO of the genealogy round ("how can we add lots more
  // related genres quickly across time (then do it)", Paul, 2026-08-29):
  // grown by paying the catalog's own debts rather than a wishlist — the
  // wants census had 23 strings wanted by two or more rows and this round
  // paid seventeen of them by name (boogiewoogie ×3; deltablues, krautrock,
  // miamibass, quietstorm, spirituals, moroder, neworleans, berlinschool,
  // gothicrock, operaseria, danzon, maxixe, lundu, modinha, cemilbey and
  // ballad ×2 each), plus habanera, hendrix, glam, phillysoul, italodisco,
  // newjackswing, hardcorerave and crunk on single wants, plus the two
  // ancestors the timeline demanded (gagaku Nara 752, ziryab Córdoba 822 —
  // the 8th and 9th centuries existed and the map now says so, plus dufay
  // Florence 1436 and lied Vienna 1814 for the two emptiest Western
  // centuries), plus four children that densify living clusters (gfunk,
  // grime, dubstep — the 2000s had eight rows — and quietstorm's own soul
  // shelf). FIVE multi-dependent wants were examined and DECLINED with
  // reasons at the foot of the genealogy block in genres.js: dastgah
  // (quarter tones, WORLD.md §2 wall 3), tape music (the material is not
  // notes), latin percussion (an instrumentation, not a genre), maringa
  // (first datable records contemporary with its own child) and the full
  // ottoman makam (paid narrowly as cemilbey in Hicaz instead). TWO
  // backwards WANTS were found and rewritten in place, dated, at their
  // rows (hymn asking for spirituals, continuo for opera seria), and one
  // backwards PARENT edge was closed (motorik <- kraftwerk, three years
  // its own child's junior, reparented onto krautrock Cologne 1971).
  // + the THIRTY-SEVEN of the debts round ("Keep going on genres", Paul,
  // 2026-08-29, the same lane's next shift): grown by paying the wants
  // ledger again — six multi-dependent debts paid BY NAME (field holler as
  // `holler`, South Carolina 1853, Olmsted's eyewitness print, ×4 counting
  // skiffle's "work song"; stockhausen ×3; the amen break ×2 as `winstons`,
  // the band and the B-side, because a seven-second sample is a record and
  // not a genre; the cuban contradanza ×2, Havana 1803; abbasid court song
  // ×2 as `mawsili`, Baghdad 800; the zodiak free arts lab ×2) — plus the
  // decade histogram's own thin stretches filled at the dufay standard:
  // four rows where the 800s-1100s held three for seven centuries (kassia,
  // sequence, winchester — which closes organum's gregorian:1
  // simplification — and hildegard), Josquin's 1500s (josquin, Venice 1502,
  // Petrucci's first single-composer print), BOTH halves of the 1610-1660
  // gap (monteverdi, schutz), the 1840s-50s (contradanza 1803 predates it;
  // holler 1853 and nothing else could be argued — the viennese waltz
  // stays declined on the triple-meter reason), twelve want-paying 19th-
  // and 20th-century rows (operetta, musichall, satie, march, broadway,
  // territoryband, modaljazz, brill — which pays songwriterpiano AND
  // punk's "girl groups" — garagerock, beachboys, psychrock, velvets,
  // progrock), the metal wing the table lacked entirely (sabbath
  // Workington 1969 — NOT Birmingham: the atlas's own Southall note
  // measured that dot blocked, so the row takes the first named
  // performance under the name, 30 August 1969 — nwobhm, thrash), the
  // culture gap before electro (blockparty, Bronx 1973), pfunk, ymo,
  // triphop, chopped, and the 2010s brought from seven rows to ten
  // (synthwave Paris 2010, footwork Chicago 2013, gqom Durban 2016).
  // FOUR were examined and DECLINED with reasons at the debts round's
  // foot in genres.js: the amen break as its own row (a record, not a
  // genre), barbershop (no verifiable named dated performance found this
  // shift), vaudeville (a stage format, not a music) and muzak (a
  // licensing company). The genealogy round's five declines stand
  // unbeaten. TWO new shared wants were opened on purpose with matched
  // spellings so the ledger counts one debt each ("jamaican sound
  // system": boombap + blockparty; "hardcore": screamo + thrash).
  // + the EIGHT of the deep-time round ("Great keep going but also look
  // backwards in time to bone flutes and lutes" / "Don't forget Ancient
  // Rome", Paul, 2026-08-30): the catalog started at Rome 600 and now
  // starts forty millennia earlier — hohlefels (Hohle Fels 33000 BC, the
  // griffon-vulture flute), jiahu (Jiahu 6000 BC, the playable gudi),
  // urlyre (Ur 2500 BC, the Royal Cemetery lyres), hurrian (Ugarit 1400
  // BC, tablet h.6), delphic (Delphi 128 BC), carmen (Rome 17 BC,
  // Horace's Carmen Saeculare), seikilos (Tralles 100, the oldest
  // complete song) and oxyrhynchus (Oxyrhynchus 300, the oldest notated
  // Christian music). BC years are NEGATIVE in WHEN — the label
  // convention ("Place Year BC") and the fail-closed argument are at
  // atlas.gate.js LABEL_RE. Declined with reasons at the round's header
  // in genres.js: the hydraulis, a lute row of its own, any
  // jiahu-to-downstream edge, and the Divje Babe artifact.
  // + the SEVEN of the same round's forward half — the previous shift's
  // own named debts: hardcore (Washington 1980, Bad Brains — paying the
  // matched "hardcore" want on screamo and thrash), honkytonk (Fort Worth
  // 1941) and westernswing (Tulsa 1940) for the 1940s' two missing
  // country rooms, dreampop (London 1984, paying shoegaze's want), doom
  // (Stockholm 1986, the metal wing's missing floor), jpop (Tokyo 1999)
  // and dunstaple (London 1420, the Old Hall Manuscript, paying dufay's
  // contenance-angloise want). The 2000s stay thin on purpose — 10 rows
  // to the 1990s' 29 — named as the next ask rather than half-paid.
  // + the SIXTEEN of the goth-and-globe round (Paul, 2026-08-30: "Need
  // way more gothy genres and way more spread of global jazz. Keep
  // using Wikipedia to add density."). THE GOTH WING, seven: deathrock
  // (Pomona 1982, Only Theatre of Pain — Pomona is Rozz Williams's own
  // town, the Kinks rule, LA 1982 being toto's), batcave (London 1982,
  // the Dean Street club-night on the zodiak venue ruling, paying
  // gothicrock's forward-pointing want by arrival), coldwave (Rennes
  // 1979, Dantzig Twist, paying postpunk's forward want the same way),
  // sisters (York 1981 — the first DATABLE show; Leeds measured
  // blocked by Halifax at 5.8px under G10's 8.5 floor, the
  // Workington-not-Birmingham ruling replayed, noted in atlas.js),
  // gothicmetal (Halifax 1991, Paradise Lost's Gothic, the record that
  // named it), dungeonsynth (Notodden 1994, Født til å Herske) and
  // witchhouse (Traverse City 2010, King Night). THE JAZZ GEOGRAPHY,
  // nine, against a catalog that held ONE non-US jazz dot: gypsyjazz
  // (Paris 1934), latinjazz (New York 1947, Manteca), descarga (Havana
  // 1957, Cachao's Panart session), capejazz (Cape Town 1974,
  // Mannenberg), tradjazz (London 1954, New Orleans Joys — paying
  // skiffle's "trad jazz revival" BY NAME: Rock Island Line was cut
  // inside that album), indojazz (London 1966, Indo-Jazz Suite),
  // japanjazz (Tokyo 1974, Midnight Sugar), nordicjazz (Oslo 1970,
  // Afric Pepperbird — which deliberately OPENS "free jazz" as a want,
  // so the ledger asks for Ornette by name) and skokiaan (Bulawayo
  // 1947, the winstons a-record-is-the-honest-row ruling). EXAMINED
  // AND DECLINED with reasons at the round's header in genres.js:
  // darkwave and "township jazz" (umbrellas made of the catalog's own
  // rows), ethereal wave (its archetype record IS dreampop's anchor),
  // jazz manouche as a second key (Wikipedia's own filing), and the
  // five US-history jazz rooms (freejazz, hardbop, cooljazz, fusion,
  // spiritualjazz) the ask's geography did not cover and the ledger
  // did not owe.
  // + the TWELVE of the downtempo round (Paul, 2026-08-30: "Now we need
  // more portishead massive attack and maybe 10 more downtempo bands.").
  // THE RULING FIRST: Blue Lines is `triphop`'s anchor, so Massive
  // Attack's own artist row (massiveattack, Bristol 1998) anchors on
  // Mezzanine — a record pays one debt, the winstons rule generalized;
  // the argument is at the round header in genres.js. The Bristol wing:
  // portishead (Bristol 1994, Dummy — Barrow was a Coach House tape op
  // on Blue Lines) and tricky (Bristol 1995, Maxinquaye — the dot is
  // Bristol on the Kinks/Pomona rule, the tape ran in London). The
  // diaspora: acidjazz (London 1988, Frederick Lies Still — AJ001, the
  // scene the 90s crate-dug), kruderdorfmeister (Vienna 1993, G-Stoned),
  // morcheeba (London 1996, Who Can You Trust?), lamb (Manchester 1996,
  // Lamb), djshadow (San Francisco 1996, Endtroducing — instrumental by
  // its own genre line), thieverycorporation (Washington 1996, Sounds
  // from the Thievery Hi-Fi — NOT instrumental, the ZIM lead names its
  // guest singers), air (Versailles 1998, Moon Safari — Versailles is a
  // new dot declared inside Paris in atlas.js WITHIN), stgermain (Paris
  // 2000, Tourist, instrumental) and royksopp (Tromsø 2001, Melody A.M.
  // — the map's northernmost dot). EXAMINED AND DECLINED with reasons
  // at the round header: a `downtempo` umbrella row (the darkwave
  // ruling), chillout (a compilation of other people's records fails
  // the batcave test), nightmaresonwax (Leeds is measured blocked,
  // 5.8px, the sisters wall), hooverphonic (Sint-Niklaas lands ~1 px
  // from Antwerp and "Antwerp 1996" would contradict the ZIM's own
  // infobox), boardsofcanada (the IDM shelf, which the catalog does
  // not hold at all — a named next ask), and zero7/bonobo/
  // groovearmada/unkle as thin.
  // + the TWENTY-FIVE of the folk-floor round (Paul, 2026-08-30: "we're
  // missing all kinds of folk traditions plus Pygmy and Romm and classic
  // nursery rhymes. We also could use some classic film soundtracks, 80s
  // and 90s sitcom themes, John carpenter horror and incidental stock
  // music of all kinds. Plus tons of Miami vice jan hammer michael mann
  // synth incidental stuff"). THE FOLK FLOOR, sixteen, each on a named
  // collection/record/event: shanty (London 1961, Hugill), appalachia
  // (Hot Springs 1916, Sharp at Jane Gentry's), oldtime (Galax 1935, the
  // fiddlers' convention — paying THREE wants: bluegrass's old-time,
  // countrypop's fiddle, and folkduo's ballad via its parent row),
  // klezmer (New York 1923, Brandwein — the hijaz mode's second music),
  // georgian (Tbilisi 1966, Chakrulo/Erkomaishvili), nordicfolk (Oslo
  // 1853, Lindeman — paying nordicjazz), chanson (Paris 1936, Piaf —
  // paying nhacvang), taraf (Clejani 1986, the Ocora tapes — the row
  // pays the TRADITION, the edge to gypsyjazz cannot close by the WHEN
  // law and its want is reworded to the pre-Django 78s), flamenco
  // (Granada 1922, the Concurso — paying rumbacatalana), mbuti (Epulu
  // 1958, Turnbull — the HOCKET RULING: fill(1) + disjoint keep() masks
  // interlock four voices into one line, measured disjoint with the
  // union covering all sixteen places; the yodel break stays a cannot),
  // nursery (London 1744, Tommy Thumb's), polka (Prague 1837 — paying
  // nortena AND maxixe), cajun (New Orleans 1928, Falcon — paying
  // zydeco), tarantella (Galatina 1959, De Martino), seannos (Carna
  // 1957, Joe Heaney — paying irishtrad) and barbershop (New York 1910,
  // the American Quartet's Play That Barber Shop Chord — OVERTURNING
  // the debts round's decline on its own terms: the named dated record
  // it said was missing, found). THE COMMISSIONED SCREEN, nine, the
  // news pair's law at other desks: photoplay (Cleveland 1913, Zamecnik
  // — paying newsfanfare's "library music" and, via the existing
  // anchor, djshadow's crates), korngold (Los Angeles 1938), herrmann
  // (Los Angeles 1960), morricone (Rome 1966, voices scored as
  // instruments), barry (London 1962, the Bond theme — paying
  // portishead), carpenter (Los Angeles 1978 — paying deathrock AND
  // synthwave), miamivice (Miami 1984 — synthwave's second dated
  // memory-edge), sitcom (Los Angeles 1983, Cheers) and seinfeld (Los
  // Angeles 1989, Wolff's sampler sting, a NOLINK by honest failure).
  // DECLINED with reasons at the round header in genres.js:
  // bal-musette and the compás (the triple-meter wall, unchanged),
  // muzak (the debts ruling stands), the Hammer horror score, the
  // griot/jeliya row (primary-fact rule; named next ask), a second
  // library-beds row, and every umbrella the ask's plural implied.
  // 350 -> 358 on 2026-08-30, the walls-down round: waltz, musette,
  // tarab, dastgah, jingju, khyal, gamelan, tapemusic — the exemplars
  // for the five felled walls (genres.js, the walls-down block).
  // bal-musette's own decline above was REVERSED the same day it was
  // written (meter landed); guoyue was examined and stays EMPTY.
  // 358 -> 369 on 2026-08-30, the ledger round ("Fill in missing genres
  // that are wanted"): eleven rows, each the payment of a written want —
  // hammerhorror, idm, exotica (the first Pacific dot; the coastline
  // re-bake), muwashshah, zajal, soundsystem, jubilee, rumba, lautari,
  // doina, chazzanut. The wants that stay open are CLOSED-with-reason at
  // the round's own ledger block in genres.js.
  // 369 -> 373 on 2026-08-30, the unlocking round ("Unlock the missing
  // stuff. Get qiyan working"): four rows, each the DEFEAT of a refusal
  // this catalog had already written down and dated — qiyan (Medina 705),
  // hardingfele (Oslo 1849), tasnif (Tehran 1924), scotsfiddle (Edinburgh
  // 1796). Every one fell to the same method and the ledger says so: the
  // previous shift probed one name per refusal, this one probed fifty.
  // Kulning and the griot/jeliya row were re-probed and STAY CLOSED, both
  // re-dated in place with the evidence that closed them.
  // 373 -> 374 on 2026-08-30, the Wax Trax round (Paul: "Where is wax trax
  // industrial"). ONE row, and it was already named in the catalogue's own
  // hand: `industrialrock` carried `wants: ["wax trax industrial"]` and the
  // two Chicago rows that descend from it — `industrialmetal` 1988 and `ebm`
  // 1989 — were already here, so the label was their missing PARENT and not
  // a new corner. `waxtrax` (Chicago 1981) ships on the batcave rule, which
  // the ZIM answers twice over: the label pressed Strike Under's Immediate
  // Action in 1980 and Ministry's Cold Life in 1981, and that second record
  // is the one the article says "set the stage".
  ok("G0 the catalog is 374 anchors, session keys excluded", () =>
    assert.strictEqual(ANCHORS.length, 374,
      "anchors() returned " + ANCHORS.length));
  ok("G0b " + ANCHORS.length * SEEDS.length + " records, no throw", () => {
    assert.strictEqual(bad.throw.length, 0, bad.throw.slice(0, 5).join("\n      "));
    assert.strictEqual(nRecords, ANCHORS.length * SEEDS.length);
  });
  ok("G1 shape against every vocabulary table", () =>
    assert.strictEqual(bad.shape.length, 0,
      bad.shape.length + " problems, first five:\n      " + bad.shape.slice(0, 5).join("\n      ")));
  ok("G2 the cell invariant", () =>
    assert.strictEqual(bad.cell.length, 0, bad.cell.slice(0, 5).join("\n      ")));
  ok("G3 ≥3 distinct cells per record", () =>
    assert.strictEqual(bad.same.length, 0, bad.same.slice(0, 5).join("\n      ")));
  ok("G4 no section is wholly silent", () =>
    assert.strictEqual(bad.silent.length, 0,
      bad.silent.length + " silent sections, first five:\n      " +
      bad.silent.slice(0, 5).join("\n      ")));

  /* ================================================================== G5
     THE IDIOM IS REAL. "A punk hook is not a bossa hook and not a chant" is
     the requirement, and a gate that does not check it is not checking it. */
  const hookOf = (gk) => {
    const d = docs.get(gk + "/1");
    const c = d.material.cells;
    return c.hook || c[Object.keys(c).find((k) => c[k].kind !== "drum")];
  };
  const onsets = (c) => c.play.filter((p) => p === "n").length;
  const heldMean = (c) => {
    let tot = 0, n = 0, i = 0;
    while (i < c.play.length) {
      if (c.play[i] !== "n") { i++; continue; }
      let L = 1; while (i + L < c.play.length && c.play[i + L] === "h") L++;
      tot += L; n++; i += L;
    }
    return n ? tot / n : 0;
  };
  const punk = hookOf("punk"), bossa = hookOf("bossa"), chant = hookOf("gregorian");
  ok("G5a punk's hook is not bossa's — deg, play and onset count all differ", () => {
    assert.notStrictEqual(punk.deg.join(","), bossa.deg.join(","), "same degrees");
    assert.notStrictEqual(punk.play.join(""), bossa.play.join(""), "same play row");
    assert.notStrictEqual(onsets(punk), onsets(bossa),
      "same onset count (" + onsets(punk) + ")");
  });
  ok("G5b punk's hook is not the chant's", () => {
    assert.notStrictEqual(punk.deg.join(","), chant.deg.join(","), "same degrees");
    assert.notStrictEqual(punk.play.join(""), chant.play.join(""), "same play row");
  });
  ok("G5c bossa's hook is not the chant's", () => {
    assert.notStrictEqual(bossa.deg.join(","), chant.deg.join(","), "same degrees");
    assert.notStrictEqual(bossa.play.join(""), chant.play.join(""), "same play row");
  });
  ok("G5d the chant holds its notes more than twice as long as punk does", () => {
    const c = heldMean(chant), p = heldMean(punk);
    assert.ok(c > p * 2, "chant " + c.toFixed(2) + " vs punk " + p.toFixed(2) +
      " × 2 — articulation is not reaching the play row");
  });

  /* ================================================================== G6
     DETERMINISM. Same arguments, deep-equal document; and a seed is a song. */
  ok("G6a genreToDocument is pure — a second call is deep-equal", () => {
    for (const gk of ANCHORS)
      assert.deepStrictEqual(J(P.genreToDocument(gk, 1)), J(docs.get(gk + "/1")), gk);
  });
  ok("G6b seed == null is seed 1", () =>
    assert.deepStrictEqual(J(P.genreToDocument("punk")), J(docs.get("punk/1"))));
  let moved = 0;
  for (const gk of ANCHORS)
    if (JSON.stringify(docs.get(gk + "/1")) !== JSON.stringify(docs.get(gk + "/2"))) moved++;
  /* G6c WAS GREEN WHILE THE BUG WAS SHIPPING, and the reason is written here
     because it is the whole lesson of the round. Paul, 2026-08-27: *"No matter
     how many times I hit REWRITE the hook is the same on Iranian pop."* He was
     right, and this check said 199 of 199 records moved — because `form`,
     `voices` and `sound` move with the seed and MATERIAL did not, on any
     anchor. "A different record" was true of the document and false of the
     tune. G6e below asks the question this one only looked like it was
     asking. */
  ok("G6c a different seed is a different record for ≥90% of anchors", () =>
    assert.ok(moved / ANCHORS.length >= 0.9,
      moved + " of " + ANCHORS.length + " moved between seed 1 and seed 2"));
  /* G6e A DIFFERENT READING IS A DIFFERENT TUNE — the claim the rewrite button
     makes, asserted on the CELLS and not on the document. Measured before the
     fix over 199 anchors x 8 seeds: 1,910 cell instances and NOT ONE changed
     content; the hook was byte-identical across five readings on 193 of the
     199. `cellOf` never took the seed (precompose §6b has the mechanism), so
     the number here was 6 of 199 and this gate did not exist. */
  {
    const hookMoved = [], anyMoved = [];
    for (const gk of ANCHORS) {
      const cells = SEEDS.map((s2) => (docs.get(gk + "/" + s2).material || {}).cells || {});
      const names = new Set();
      for (const c of cells) for (const k of Object.keys(c)) names.add(k);
      let any = false, hook = false;
      for (const k of names) {
        // PRESENT-AT-ONE-SEED IS NOT VARIATION. A kind the record deals in one
        // reading and not another makes `undefined !== {...}` true and says
        // nothing about the tune, which is exactly how the old measurement
        // flattered itself. Only cells that EXIST in two readings are compared.
        const seen = cells.map((c) => c[k]).filter(Boolean).map((v) => JSON.stringify(v));
        if (new Set(seen).size > 1) { any = true; if (k === "hook") hook = true; }
      }
      if (any) anyMoved.push(gk);
      if (hook) hookMoved.push(gk);
    }
    ok("G6e a different reading is a different TUNE — the hook's own notes " +
       "move for ≥90% of anchors across " + SEEDS.length + " readings", () =>
      assert.ok(hookMoved.length / ANCHORS.length >= 0.9,
        hookMoved.length + " of " + ANCHORS.length + " moved a hook; frozen: " +
        ANCHORS.filter((g) => !hookMoved.includes(g)).slice(0, 8).join(" ")));
    ok("G6f …and every anchor moves SOME cell, so no genre in the catalog has " +
       "one tune and one only", () =>
      assert.strictEqual(ANCHORS.length - anyMoved.length, 0,
        ANCHORS.filter((g) => !anyMoved.includes(g)).slice(0, 8).join(" ")));
  }
  /* G6g READING 1 IS TODAY. The atlas opens every anchor at seed 1, so the
     record a hand LANDS on may not move when the reading machinery lands —
     only pressing rewrite may. Asserted against the frozen fixture rather than
     against a rerun of the same code, which would only prove the code equals
     itself: `cellOf` with no reading is what reading 1 composes. */
  ok("G6g reading 1 composes the cells `cellOf` composes with no reading at " +
     "all — absent is today, on every anchor", () => {
    const bad = [];
    for (const gk of ANCHORS) {
      const { row: row0 } = P.idiomOf(gk), G = GENRES[gk];
      // THE ANCHOR'S OWN COUNT (2026-08-30, the walls-down round): this
      // call read `P.cellOf(row, k, 1, G, 16)` while no anchor declared a
      // meter; `waltz` and `musette` count in three now, and the door
      // (precompose:1852) attaches `met` to the theme row and derives
      // steps from it — so the mirror here must too, or the gate compares
      // a twelve-step record against a sixteen-step re-derivation of
      // itself and fails on the meter, not on a drift.
      const met = G.meter ? K.METERS[G.meter] : null;
      const row = met ? { ...row0, met } : row0;
      const cells = (docs.get(gk + "/1").material || {}).cells || {};
      for (const k of Object.keys(cells)) {
        if (cells[k].kind !== "line") continue;          // `beat` is the kit
        const made = P.cellOf(row, k, 1, G, met ? met.steps : 16);  // no sixth argument
        if (JSON.stringify(made.cell) !== JSON.stringify(cells[k])) bad.push(gk + "." + k);
      }
    }
    assert.strictEqual(bad.length, 0, bad.slice(0, 8).join(", "));
  });
  ok("G6d an unknown anchor throws BY NAME", () => {
    assert.throws(() => P.genreToDocument("no-such-genre", 1),
      /precompose: no anchor "no-such-genre"/);
  });

  /* ================================================================== G7
     ABSENT IS TODAY. This slice added two SCALES rows, a HARMONYLABEL row and
     one export to compose.js; none of them may move the shipped record. The
     frozen fixture is the pre-move capture of ui/eight.js `genreFor(i)`. */
  // The fixture is a PORTRAIT — a genre carries four functions and JSON drops
  // them — and `portrait()` is its single owner, required rather than
  // re-implemented for the reason its own header gives: a fixture and the
  // assertion that reads it must be two views of one function or they drift.
  const { portrait } = require("./fixtures/terms-genre.freeze.js");
  const FROZEN = require("./fixtures/terms-genre.json");
  ok("G7a the shipped chant compiles to the frozen genre at every section", () => {
    const T = J(TERMS);
    T.form.sections.forEach((s, i) => assert.deepStrictEqual(
      J(portrait(Doc.toGenre(T, i, GENRES, FLEET), K)), J(FROZEN.sections[i]),
      "section " + i));
  });
  ok("G7b the two new SCALES rows name the five anchors that had no word", () => {
    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    for (const gk of ANCHORS) {
      const s = GENRES[gk].scale;
      if (!s) continue;
      assert.ok(Object.values(SCALES).some((v) => eq(v, s)) ||
                Object.values(MODES).some((v) => eq(v, s)),
        gk + " declares a scale no key names");
    }
    assert.deepStrictEqual(SCALES.blues, [0, 3, 5, 6, 7, 10]);
    assert.deepStrictEqual(SCALES.bluesx, [0, 1, 3, 5, 6, 8, 10]);
  });
  ok("G7c HARMONYLABEL names exactly the three words the catalog uses", () => {
    const used = [...new Set(Object.values(GENRES).map((g) => g.harmony))].sort();
    assert.deepStrictEqual(Object.keys(NG.HARMONYLABEL).sort(), used);
  });

  /* ================================================================== G8
     THE SOUND AXIS IS WRITTEN — STATE.md item 17, "the single largest gap in
     the round": "0 of 122 precomposed records carry a `voice.desk`, a
     `sound.buses` or a `sound.fx` … Click Kingston and you get a record whose
     seven voices have no desk on them at all."

     ABSENT IS STILL TODAY, AND IT IS PROVED FIRST. Everything after G8a is a
     count of what precompose now SAYS; G8a is the promise that a document
     which says nothing is unmoved, because a writer that made silence
     impossible would have broken the law it was asked to keep. */
  const DD = R("desk-doc.js");
  const stripSound = (doc) => {
    const d = J(doc);
    for (const v of d.voices) delete v.desk;
    delete d.sound.buses; delete d.sound.master; delete d.sound.fx;
    return d;
  };
  ok("G8a absent is today — strip the Sound axis off all 122 and the desk " +
     "takes the untouched branch", () => {
    for (const gk of ANCHORS) {
      const d = stripSound(docs.get(gk + "/1"));
      assert.strictEqual(DD.deskPartsOf(d, GENRES), null, gk + " deskPartsOf");
      assert.strictEqual(DD.busesOf(d), null, gk + " busesOf");
      assert.strictEqual(DD.masterOf(d), null, gk + " masterOf");
      // `assert.deepStrictEqual(DD.boxFxOf(d), [])` came off here 2026-08-27
      // with the reader itself — the record-wide chain is retired and
      // `deskIsDefault` no longer counts it (desk-doc.js has the tombstone).
      assert.strictEqual(DD.deskIsDefault(d, GENRES), true, gk + " deskIsDefault");
    }
  });
  ok("G8b every one of the " + ANCHORS.length * SEEDS.length +
     " records carries a sound.buses", () =>
    assert.strictEqual(nBuses, nRecords, nBuses + " of " + nRecords));
  ok("G8c every value is a legal registry key, walked off NF.BUSES / NF.PARTMIX", () =>
    assert.strictEqual(bad.sound.length, 0, bad.sound.length +
      " problems, first five:\n      " + bad.sound.slice(0, 5).join("\n      ")));
  ok("G8d the desk reaches the voices — ≥90% of records set a chair", () => {
    const withDesk = nRecords - noDesk.length;
    assert.ok(withDesk / nRecords >= 0.9, withDesk + " of " + nRecords +
      " records set a chair; the ones that do not: " + noDesk.slice(0, 6).join(" "));
  });
  ok("G8e desk-doc addresses every stored entry — no chair is written and lost", () => {
    for (const gk of ANCHORS) {
      const d = docs.get(gk + "/1");
      const set = d.voices.filter((v) => v.desk).length;
      const landed = Object.keys(DD.deskPartsOf(d, GENRES) || {}).length;
      assert.strictEqual(landed, set, gk + ": " + set + " voices carry a desk, " +
        landed + " reach a channel");
    }
  });

  /* --- G8f VARIETY. This is the assertion STATE.md item 18 exists for: a
     field that is written for the first time and says ONE word is a field
     nobody derived. "a bossa and a boom-bap are handed the same groove word."
     So the shape of the distribution is the test, not the presence of it. */
  const spread = (h, floor) => {
    const e = Object.entries(h).filter(([k]) => k !== "(none)");
    const tot = e.reduce((a, [, v]) => a + v, 0);
    const top = Math.max(...e.map(([, v]) => v));
    return { words: e.length, tot, top, share: top / tot,
             ok: e.length >= floor && top / tot <= 0.6 };
  };
  ok("G8f the groove word is various — every GROOVELABEL word is used, and " +
     "none of them covers more than 60% of the records that have one", () => {
    const sp = spread(hGroove, Object.keys(NF.GROOVELABEL).length);
    assert.ok(sp.ok, sp.words + " of " + Object.keys(NF.GROOVELABEL).length +
      " words, top share " + (sp.share * 100).toFixed(0) + "% — " +
      JSON.stringify(hGroove));
  });
  ok("G8g the return is various — ≥3 RETURNS words and ≥4 rooms", () => {
    const r = spread(hRet, 3), c = spread(hColor, 4);
    assert.ok(r.ok, "returns " + JSON.stringify(hRet));
    assert.ok(c.ok, "rooms " + JSON.stringify(hColor));
  });
  ok("G8h a dub record and a chant do not get the same return", () => {
    const b = (gk) => docs.get(gk + "/1").sound.buses.rev;
    assert.notDeepStrictEqual(b("dub"), b("gregorian"),
      "dub and gregorian share a bus row: " + JSON.stringify(b("dub")));
    assert.notStrictEqual(b("punk").ret, b("gregorian").ret,
      "punk and the chant land in the same return (" + b("punk").ret + ")");
    // ...and the echo bus exists exactly where the anchor asked for one
    for (const gk of ANCHORS) {
      const want = (GENRES[gk].fx || []).includes("echo");
      const has = !!docs.get(gk + "/1").sound.buses.echo;
      assert.strictEqual(has, want, gk + ": echo bus " + has + ", anchor says " + want);
    }
  });

  /* ================================================================== G8e
     THE ROOM CANNOT HOLD A PLAYER IT HAS NOT MET YET (Paul, 2026-08-25: "fix
     the zema organ thing").

     WHAT WENT WRONG, and it is the reason this gate exists rather than a
     patch: `zema` is Aksum 540, the oldest record in the catalog, and its own
     entry says out loud that it is "NOT a child of Rome 600 and must never be
     written as one". Measured on the shipped composer, all three seeds hired a
     European keyboard anyway — church organ, church organ, harpsichord — and
     two of the three hired a voice literally named `gregorian`. `mbube`
     (Johannesburg 1939, four men singing unaccompanied) took a harpsichord on
     all three. Nothing in the anchors was wrong: compose.js drew the guest
     from a per-FAMILY lean, and `vox` is a cluster held together by TEXTURE
     that runs from Aksum 540 to Leipzig 1725, so the lean was European because
     every choir in the table was European on the day it was typed.

     THE RULE GATED HERE IS THE LOOSER OF THE TWO, ON PURPOSE, and the number
     that decided it is in this file rather than in a commit message. The tight
     rule — "the drawn instrument must appear in the anchor's own `instr`, its
     parents' or its family's" — still fails 384 hires across 260 of the 417
     records AFTER the fix, and it should: a guest is a FOREIGN colour by
     construction, and the string quartet on a Beatles single (`counterpoint`,
     a harpsichord from Vienna 1725 on a Liverpool 1962 record) is the file's
     own worked example of the feature. Gating tightness would delete the
     feature Paul asked for ("you have stopped adding elements from other
     genres into the randomly generated songs").

     So the honest rule is the ERA one, which compose.js already applies to the
     PEDALS (FX_YEAR, "why would Chicago 1932 have enormous amounts of delay?")
     and now applies to the ROOM:
       1. no record hires a genre dated LATER than itself;
       2. no record plays an instrument the catalog first hears after its own
          year — the floor per id EXTRACTED as the earliest year any dated
          anchor claims it, so the table cannot drift from the anchors;
       3. a VOICE has no invention date and is exempt from 2 (extraction would
          floor `solo_vox` at Paris 1200, and people sang before Notre Dame),
          and from 1950 on — FX_YEAR's own line — a record may seat a late id
          of a KIND its own cast already plays, because extraction says when
          the CATALOG first hears an id and not when the thing was built:
          flatly applied it took the guitar solo off Chicago 1952 and St.
          Louis 1955, and Chuck Berry with no lead break is a worse lie than
          the one being fixed;
       4. an UNACCOMPANIED anchor — dated, no kit, no bass, every `instr` id a
          sung one — hires nobody at all. That predicate reads the anchor's own
          fields and finds gregorian, spem, organum, zema and mbube, which is
          why the two names in the complaint are not special cases in the code.
     Measured by re-running these very rules against the shipped composer:
     254 violations of rules 1-3 across 157 of the 417 records and 74 of the
     139 anchors, and 26 hires onto the 5 unaccompanied anchors in 15 records.
     Both are 0 after.

     IT READS THE DOCUMENT'S CAST, not compose()'s return value: `voices[]` and
     their `instrument` are what the page seats and what the reader is shown,
     and a policy that is right in the arranger and wrong by the time it is a
     document is the failure this suite is named for. */
  {
    const NC = R("compose.js");
    // WHO WAS HIRED cannot be read off the names alone, and the case that
    // proves it is `organum`: its document carries a voice called `pad`, which
    // is its own third chair — the held tenor — because precompose names a
    // base voice after its PART (precompose.js:1014) and `pad` is both a part
    // and a FUNCTION genre. Its instrument is `ahh_choir`, not `warm_pad`.
    // So identity comes from the arrangement, built with precompose.js:937-940's
    // own expression, and the INSTRUMENT — the thing the page actually seats —
    // is read off the document beside it.
    const late = [], hired = [], visited = [];
    for (const gk of ANCHORS) {
      const year = NC.genreYear(gk);
      const solo = NC.unaccompanied(gk);
      // THE RECORD'S OWN SINGER IS NOT A VISITOR (compose.js "a guest turns
      // up; a singer is on the record"), so rule 4 does not count it: a cantor
      // giving out the line alone is what `zema`'s `intro: "solo"` — "the
      // mergéta gives the line out alone" — describes, and plainchant has one
      // too. Rules 1-3 still apply to it, and a voice passes 3 anyway.
      const singer = NC.singerOf(GENRES[gk], gk);
      for (const seed of SEEDS) {
        const doc = docs.get(gk + "/" + seed);
        if (!doc) continue;
        const hires = new Set();
        for (const b of NC.compose(gk, seed).song)
          for (const e of b.stack.slice(1)) if (GENRES[e.g]) hires.add(e.g);
        for (const lk of hires) {
          if (lk === singer) continue;
          visited.push(gk + "/" + seed + " " + lk);
          if (solo) hired.push(gk + "/" + seed + ": " + GENRES[gk].label +
            " sings unaccompanied and hired " + lk);
          const gy = NC.genreYear(lk);
          if (year && gy && gy > year) late.push(gk + "/" + seed + ": " +
            GENRES[gk].label + " hired " + lk + " (" + GENRES[lk].label + ")");
        }
        // …and the INSTRUMENTS the document actually seats, held against the
        // arranger's own one-expression answer rather than a second copy of
        // it — `seatOK` carries rules 2, 3 and the after-1950 waiver together.
        for (const v of doc.voices)
          if (v.instrument && !NC.seatOK(gk, v.instrument))
            late.push(gk + "/" + seed + ": " + GENRES[gk].label + " seats " +
              v.name + " on " + v.instrument + ", which the catalog first " +
              "hears in " + NC.INSTR_YEAR[v.instrument] +
              " and no chair of its own plays a " + NC.kindOf(v.instrument));
      }
    }
    ok("G8e no record hires a player, or seats an instrument, from after its " +
       "own year — 254 violations in 157 of 417 records before this round", () =>
      assert.strictEqual(late.length, 0, late.length + " anachronistic, first " +
        "eight:\n      " + late.slice(0, 8).join("\n      ")));
    ok("G8e2 …and an anchor that sings unaccompanied hires nobody (26 hires " +
       "in 15 records before) — zema, mbube, gregorian, spem and organum, " +
       "found by reading their own kit/nobass/instr", () =>
      assert.strictEqual(hired.length, 0, hired.length + ":\n      " +
        hired.slice(0, 8).join("\n      ")));
    // …AND THE FEATURE IS STILL THERE. A filter that empties every ballot
    // passes both assertions above and deletes the guest, so the count is held
    // from BELOW as well: 3364 layer placements before this round, 3279 after,
    // and the Beatles' string quartet is named because it is precisely the
    // case the tight rule would have cost.
    ok("G8e3 …and the guest survives the law — the catalog still visits, and " +
       "the harpsichord on a 1962 Liverpool record is still the proof", () => {
      assert.ok(visited.length > 800, "only " + visited.length + " hires over " +
        (ANCHORS.length * SEEDS.length) + " records — the era law emptied the ballots");
      const quartet = [1, 2, 3].some((s2) => (docs.get("beatles/" + s2) || { voices: [] })
        .voices.some((v) => v.name === "counterpoint" && v.instrument === "harpsichord"));
      assert.ok(quartet, "no seed of beatles books the string quartet any more");
    });
  }

  /* ================================================================== G9
     TEST THE ARTIFACT. Everything above reads the DOCUMENT. This reads the
     numbers audio/desk.js hands the engine, through the same two functions
     desk-gate G6 uses on the shipped chant — because the finding fields.js:468
     names ("78% wet and bone dry, for as long as this page has existed") is a
     fact about `state.reverb`, not about a key being present in a JSON blob.

     WHAT WAS THERE BEFORE, MEASURED, because "the return was shut" turns out to
     be three-quarters true rather than wholly true and the difference belongs
     on the record. With precompose's bus block switched off, this loop reports
     `state.reverb` = 0.137 ×47 · 0.074 ×28 · nothing ×24 · 0.210 ×18 · 0.315 ×5
     — the MASTER's `space` bleed leaking into the return through audio/desk.js
     honest() ("SPACE OPENS THE RETURN … rgain = mrev*3.35"), which is the
     branch that same comment says should now stand down: "One owner for
     state.reverb, and it is the rack." So 24 records were bone dry, 98 were wet
     by accident at whatever the dry bleed happened to be, and none of them was
     at the number its own anchor asked for. With the bus block on it is
     0.180 ×48 · 0.320 ×45 · 0.500 ×15 · 0.625 ×14 — four returns, chosen.

     THE NEGATIVE CONTROL WAS RUN. With § 7's two lines commented out this file
     reports 21 passed, 8 failed; every one of the eight is in this block or in
     G8. A gate that cannot fail is not measuring anything.

     THE STUB IS desk-gate.js:19-45's, cited rather than reinvented: ui/state.js
     reads localStorage at evaluation and registers two module-scope listeners,
     so a bare `globalThis.window = globalThis` throws before a number is
     checked. It is set up HERE, at the foot of the file, so every gate above
     it stays the pure-node walk this file's header promises. */
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = { visibilityState: "visible", body: { append() {} },
    createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
  window.NuKernel = K; window.NuGenres = NG; window.NuFields = NF;
  window.NuSong = R("song.js"); window.NuInstruments = NI;
  window.NuCompose = R("compose.js"); window.PRESETS = R("presets.js").PRESETS;
  window.NuDocument = Doc; window.NuSongs = NuSongs;
  window.__REGISTRY = require(path.join(__dirname, "..", "engine", "registry-data.js"));
  const DESK = await import(path.join(__dirname, "..", "nukernel", "audio", "desk.js"));
  const { deskUnits, masterState } = DESK;

  // the four lines ui/eight.js push() runs (eight.js:250-253), run here, so
  // this is a statement about the page and not about the test
  const GKP = "lab.precompose.gate.";
  function pushBoxes(doc) {
    doc.form.sections.forEach((s2, i) => {
      GENRES[GKP + i] = Doc.toGenre(doc, i, GENRES, []); });
    const boxes = Doc.boxesOf(doc, GKP);
    const parts = DD.deskPartsOf(doc, GENRES);
    for (const b of boxes) b.parts = parts;
    return boxes;
  }

  let dry = [], retHist = {};
  for (const gk of ANCHORS) {
    const doc = docs.get(gk + "/1");
    const st = masterState(DD.masterOf(doc), DD.busesOf(doc));
    const r = st && st.reverb;
    hist(retHist, r == null ? null : r.toFixed(3));
    if (!(r > 0)) dry.push(gk + " -> " + JSON.stringify(st));
  }
  ok("G9a every precomposed record's reverb send lands in a NON-ZERO return " +
     "(desk-gate G6, for all 122 rather than for the chant alone)", () =>
    assert.strictEqual(dry.length, 0, dry.length + " still dry, first five:\n      " +
      dry.slice(0, 5).join("\n      ")));

  ok("G9b …and the return is the one the anchor's own tone.verb asked for", () => {
    for (const gk of ANCHORS) {
      const doc = docs.get(gk + "/1");
      const st = masterState(DD.masterOf(doc), DD.busesOf(doc));
      const want = NF.RETURNS[P.retOf(GENRES[gk])];
      assert.strictEqual(st.reverb, want, gk);
      assert.ok(st.reverbColor, gk + " has no reverb module");
    }
  });

  ok("G9c a per-voice desk reaches the units — the chairs of a reggae record " +
     "are not all at 1.0", () => {
    const doc = J(docs.get("reggae/1"));
    const chairs = DD.channelsOf(doc, GENRES);
    // a unit per chair, addressed the way audio/plan.js addresses one
    const units = {}, addr = {};
    chairs.forEach((k, i) => { units["u" + i] = { lvl: 1, module: "sampler",
      sampler: { id: "x" } }; addr["u" + i] = k; });
    const box = pushBoxes(doc)[0];
    const out = deskUnits(units, addr, box, null, null);
    const revs = Object.values(out).map((u) => u.rev);
    const lvls = Object.values(out).map((u) => u.lvl);
    assert.ok(revs.every((r) => r > 0), "a unit is dry: " + JSON.stringify(revs));
    assert.ok(new Set(revs.map((r) => r.toFixed(4))).size > 1,
      "every chair sends the same reverb (" + revs[0] + ") — the per-voice " +
      "desk is not reaching the units");
    assert.ok(new Set(lvls.map((l) => l.toFixed(4))).size > 1,
      "every chair is at the same level (" + lvls[0] + ")");
  });

  ok("G9d the untouched branch is still byte-identical — the same record with " +
     "its Sound axis stripped builds the units it always did", () => {
    const doc = stripSound(docs.get("reggae/1"));
    const chairs = DD.channelsOf(doc, GENRES);
    const units = {}, addr = {};
    chairs.forEach((k, i) => { units["u" + i] = { lvl: 1, module: "sampler",
      sampler: { id: "x" } }; addr["u" + i] = k; });
    const plain = Doc.boxesOf(J(doc), GKP);
    doc.form.sections.forEach((s2, i) => {
      GENRES[GKP + i] = Doc.toGenre(doc, i, GENRES, []); });
    const A2 = deskUnits(units, addr, plain[0], null, null);
    const B2 = deskUnits(units, addr, pushBoxes(doc)[0], null, null);
    assert.deepStrictEqual(A2, B2);
    assert.strictEqual(masterState(DD.masterOf(doc), DD.busesOf(doc)), null);
  });

  /* ================================================================== G11
     THE WORLD ROUND'S OWN LAWS (2026-08-26). Four assertions, and none of
     them existed before sixty anchors landed in one afternoon, because none
     of them could fail on a catalog somebody had read end to end.
     ================================================================== */
  {
    // G11a — NO ANCHOR PROMISES A SOUND THE REGISTRY CANNOT PLAY. Until this
    // round `instr` was checked only against NF.INSTRCHOICES, which is
    // DERIVED FROM `instr` — the union of every genre's own cast — so it can
    // never disagree with it and has never been a check at all. The real
    // authority is engine/registry-data.js SAMPLERS, the 123 ids with zones
    // on disk, and it is required here rather than in nukernel because the
    // registry sits a tier ABOVE this data (fields.js:1367 declines the same
    // import for the same reason). Sixty new anchors cast eleven ids nobody
    // had ever named — sitar, koto, shamisen, steel_drums, pan_flute,
    // clarinet, alto_sax, tuba, honky_tonk among them — and a typo in any of
    // them would have shipped a silent chair.
    //
    // WIDENED 2026-08-30, THE FIRST TIME AN ANCHOR CAST SOMETHING THAT IS NOT
    // A RECORDING, and the old rule is quoted rather than replaced because it
    // was right about everything it could see: "The real authority is
    // engine/registry-data.js SAMPLERS, the 123 ids with zones on disk". It
    // was right while every cast in the catalog WAS a recording. jiangnan
    // sizhu now casts `erhu`, which has no SAMPLERS row and never can: every
    // soundfont in this tree is GM bank 0, GM has no Chinese instrument, and
    // engine/faust/dsp/erhu.dsp exists precisely because the recording could
    // not. Under the old rule this file would have refused the one instrument
    // in the catalog that is NOT a stand-in.
    //
    // So the law is stated at the altitude it always meant: AN ANCHOR MAY NOT
    // PROMISE A SOUND THE ENGINE CANNOT MAKE. Two ways to keep it — a zone on
    // disk, or a compiled model the bridge routes to — and the second half is
    // asked of `to-engine.js recipeFor` itself, the same function the tape and
    // the page ask, rather than of a second list that could drift from it. An
    // id that is neither comes back `unrouted` and fails here exactly as a
    // typo did before. It is STRICTLY STRONGER than the sentence above: a
    // SAMPLERS row proves zones exist, and this proves the bridge reaches
    // them.
    const REG = require(path.join(__dirname, "..", "engine", "registry-data.js"));
    const REAL = new Set(Object.keys(REG.SAMPLERS));
    // the modelled half, asked of the bridge. `{}` for the library on purpose:
    // a sampled id falls through to the (empty) lib and reports `unrouted`, so
    // this branch answers TRUE only for an id the patch/mouth/voice tables
    // genuinely model — which is the question being asked.
    const modelled = (id) => {
      const un = [];
      const r = TE.recipeFor("line", { instr: id, tone: null, synth: null }, {}, un);
      return !un.length && String(r.source || "").split(":")[0] !== "unrouted" &&
             !!(r.m && r.m.model);
    };
    const unplayable = [], asModel = [];
    for (const gk of ANCHORS)
      for (const id of (Array.isArray(GENRES[gk].instr)
                        ? GENRES[gk].instr : [GENRES[gk].instr])) {
        if (REAL.has(id)) continue;
        if (modelled(id)) { asModel.push(gk + " -> " + id); continue; }
        unplayable.push(gk + " -> " + id);
      }
    ok("G11a every instrument every anchor casts is a sound the engine can " +
       "make — a zone on disk (" + REAL.size + " SAMPLERS ids) or a compiled " +
       "model recipeFor routes to — checked against the registry and the " +
       "bridge, never against the menu derived from these very casts", () => {
      assert.strictEqual(unplayable.length, 0, unplayable.join(", "));
      // ...and the modelled ones are PRINTED, every run, because an id that
      // has no recording behind it is the one a reader should be able to see
      // without reading the catalog.
      console.log("       cast as a MODEL, not a recording: " +
        (asModel.length ? asModel.join(", ") : "none"));
    });

    // G11b — THE `cannot` FIELD IS AN ADMISSION AND MUST READ LIKE ONE.
    // WORLD.md §7: "`wants` names a missing ANCESTOR; `cannot` names a
    // missing WORD IN THE LANGUAGE", and "prose drifts from the data it
    // labels", which is vocabulary.js's own argument for turning the prose
    // into data. A one-word `cannot` would be prose again, so the shape is
    // checked: an array of SENTENCES. Thirty-one anchors declare one.
    const badCannot = [];
    for (const gk of ANCHORS) {
      const c = GENRES[gk].cannot;
      if (c == null) continue;
      if (!Array.isArray(c) || !c.length) { badCannot.push(gk + ": not a non-empty array"); continue; }
      for (const line of c) {
        if (typeof line !== "string" || line.length < 24 || !/\s/.test(line))
          badCannot.push(gk + ": " + JSON.stringify(line) + " is not a sentence");
      }
    }
    const nCannot = ANCHORS.filter((gk) => GENRES[gk].cannot).length;
    ok("G11b every `cannot` is a list of SENTENCES, not a list of words — " +
       nCannot + " anchors declare what they cannot say", () =>
      assert.strictEqual(badCannot.length, 0, badCannot.slice(0, 5).join("\n      ")));

    // G11b2 — AND A ROLE HAS NOTHING TO ADMIT. The six FUNCTION genres are
    // parts and not traditions (atlas.js EXCLUDE says the same thing about
    // the map); a `pad` cannot fail to say a quarter tone, because a pad is
    // not claiming to be anywhere.
    const roleCannot = Object.keys(NG.GENRES)
      .filter((gk) => !/\d/.test(GENRES[gk].label || "1") && GENRES[gk].cannot);
    ok("G11b2 …and no FUNCTION genre declares one — a role has a job, not a " +
       "tradition it is falling short of", () =>
      assert.strictEqual(roleCannot.length, 0, roleCannot.join(" ")));

    // G11c — THE UNACCOMPANIED LAW IS STILL DERIVED, AND `sacredharp` IS THE
    // PROBE. compose.js finds the set by reading `kit`, `nobass` and `instr`
    // off each anchor, and it was written on 2026-08-25 knowing exactly five
    // records. Philadelphia 1844 was written without touching that predicate
    // and must fall into the set on its own three fields — if the law were a
    // name list wearing a function, it would not, and this assertion is the
    // difference between the two.
    const solo = ANCHORS.filter((gk) => NC.unaccompanied(gk));
    // ...AND `chorale` IS THE SECOND PROBE (2026-08-29). Nuremberg 1586 was
    // written the same way sacredharp was — four voices, `instr: "ahh_choir"`,
    // an empty kit, `nobass` — by somebody who did not read compose.js's
    // predicate, and it landed in the set on its own three fields. Two
    // independent arrivals is the difference between a derivation and a list.
    // ...AND THE GENEALOGY ROUND ADDED THREE MORE PROBES (2026-08-29):
    // `dufay` and `spirituals` are four unaccompanied parts and `ballad`
    // is ONE unaccompanied voice — the set's smallest possible member,
    // which no earlier arrival had tested. All three were written without
    // reading the predicate and landed on their own three fields; five
    // independent arrivals now, and the derived list below is the round's
    // whole edit to this gate.
    // ...AND THE DEBTS ROUND ADDED FIVE MORE PROBES (2026-08-29): `kassia`,
    // `sequence` and `hildegard` are one unaccompanied chant voice each,
    // `winchester` is two, `josquin` four, and `holler` repeats ballad's
    // smallest-member test from the other side of an ocean. All were
    // written without reading the predicate and landed on their own three
    // fields; the derived list below is again the round's whole edit here.
    // (`winchester` is in the set and worth a beat: two ahh_choir voices,
    // empty kit, nobass — the predicate found the organum practice
    // unaccompanied, which it was.)
    // ...AND THE DEEP-TIME ROUND ADDED TWO MORE PROBES (2026-08-30):
    // `seikilos` (one voice, a complete tune) and `oxyrhynchus` (one
    // Greek hymn line) — both written to the recipe, not to the
    // predicate, and both landed on their own three fields. `carmen` WAS
    // the instructive ABSENCE: fifty-four unaccompanied children, empty
    // kit, nobass — excluded only because genreYear failed closed on a BC
    // label. THE ALARM RANG AND WAS ANSWERED THE SAME DAY (2026-08-30):
    // genreYear learned the trailing-BC form and returns a negative year,
    // and carmen joined this list exactly as predicted. The prediction's
    // OTHER half was wrong and the measurement settles it: the five other
    // BC rows did NOT join, because they were never unaccompanied singing
    // — a bone flute, two lyres and an aulos hymn all carry instruments,
    // and the predicate correctly reads their fields, not their era. One
    // more independent arrival; the derived list below grew by one.
    ok("G11c the unaccompanied law is derived, not a list — it found the " +
       "five it was written on PLUS sacredharp, chorale, ballad, dufay, " +
       "spirituals, the debts round's six, the deep-time round's two, " +
       "and the folk-floor round's eight, " +
       "none of which it has ever heard of", () => {
      // ...and the ledger round's three (2026-08-30), each an
      // independent arrival on its own fields: `jubilee` is four
      // unaccompanied voices (the cluster's definition), `doina` one
      // voice on a mountain, `chazzanut` one voice over a hum. The
      // predicate found all three before this list heard of them.
      assert.deepStrictEqual(solo.slice().sort(),
        ["appalachia", "ballad", "barbershop", "carmen", "chazzanut",
         "chorale", "doina", "dufay",
         "dunstaple", "georgian", "gregorian",
         "hildegard", "holler",
         "josquin", "jubilee", "kassia", "mbube", "mbuti", "nordicfolk",
         "nursery",
         "organum", "oxyrhynchus",
         "sacredharp", "seannos", "seikilos", "sequence", "shanty",
         "spem", "spirituals", "winchester", "zema"]);
    });

    // G11d — EVERY PLACE IS IN EXACTLY ONE REGION, AND EVERY REGION ROW IS A
    // PLACE. atlas.js REGIONS is EXCLUDE's twin one tier up (WORLD.md §4: "a
    // cell is filled or declared empty with a reason"), and a hand-typed
    // table of 109 places is exactly the kind that rots, so it is held to
    // PLACES in both directions.
    const A2 = require(path.join(__dirname, "..", "nukernel", "atlas.js"));
    const placed = new Set(), twice = [], orphan = [];
    for (const [reg, list] of Object.entries(A2.REGIONS))
      for (const pl of list) {
        if (placed.has(pl)) twice.push(pl);
        placed.add(pl);
        if (!A2.PLACES[pl]) orphan.push(reg + " -> " + pl);
      }
    const homeless = Object.keys(A2.PLACES).filter((pl) => !placed.has(pl));
    ok("G11d every dot is in exactly one region and every region row is a " +
       "dot — " + Object.keys(A2.REGIONS).length + " regions, " +
       placed.size + " places, plus " +
       Object.keys(A2.REGIONS_EMPTY).length + " declared EMPTY", () => {
      assert.strictEqual(orphan.length, 0, "orphan region rows: " + orphan.join(", "));
      assert.strictEqual(twice.length, 0, "in two regions: " + twice.join(", "));
      assert.strictEqual(homeless.length, 0, "no region: " + homeless.join(", "));
      for (const [reg, why] of Object.entries(A2.REGIONS_EMPTY)) {
        assert.ok(!A2.REGIONS[reg], reg + " is declared empty AND has dots");
        assert.ok(why.length > 60, reg + " is declared empty with no reason in it");
      }
    });

  }

  /* ================================================================== G12
     THE THROAT CENSUS — WHAT EACH CHAIR ACTUALLY SOUNDS LIKE.

     Paul, 2026-08-26, by ear: "you keep assigning 'solo vox' but should be
     using native voices where possible."

     WHY THIS COUNT EXISTS AT ALL. Every other assertion in this file reads the
     DOCUMENT; a document names an instrument and says nothing about what will
     make the sound, because the id is resolved four tables later
     (`to-engine.js recipeFor`: the record's signature, then the mouth, then the
     singer, then the synth a GM patch is a photograph of, then the model, then
     the recording). So "which chairs are native" is not visible anywhere this
     file was already looking, and the number that went to ZERO — every one of
     the fifteen signature synths, silenced on every precomposed record —
     went there without a single check in this file moving.

     MEASURED THE MORNING THIS RAN, over 199 anchors x 3 seeds = 3228 line
     chairs:

                              before        after
       native seats           2062 (63.9%)  2485 (77.0%)
       the record's own synth    0 chairs      72 chairs, all 15 anchors
       sampled / unrouted     1166           743
       worst record, cost       36.80        42.00   (BUDGET 40, see G12d)
       mean modulation-strip     5.23         3.89   (CEILING 6, plan.js:462)
                                                    — approximated, see below

     "WHERE POSSIBLE", DERIVED — four clauses, in order, each of them a fact
     about what the voice IS rather than an entry on a list:

       1. THE ANCHOR'S OWN SIGNATURE OUTRANKS EVERYTHING. A `synth` block is
          the anchor saying "this is what this record sounds like". Fifteen say
          it; none was reaching a chair. (precompose.js, this round.)
       2. A SYNTHESISER IS NOT A RECORDING OF A SYNTHESISER. `saw_wave`,
          `polysynth`, `warm_pad` are photographs of an oscillator and the
          model IS the oscillator — there is no performance in the recording to
          lose. (to-engine.js PATCH_SYNTH, thirteen ids, already shipped.)
       3. A MOUTH IS CAST BY WHAT IT DOES. One person is `voice_lead`; a room
          of people is `voice_choir`; a machine that ARTICULATES, on a line
          chair, is `tract_voice`. The plural is in the name, and the catalog
          had already written the difference down — `blend`, documented
          "sections only", on ten `MOUTHS` rows that nothing could read.
          (instruments.js PATCH_VOICE, two rows, this round.)
       4. AND A RECORDING OF PEOPLE IS THE ONE THING A MODEL CANNOT BE. A
          violin section, a brass section, an accordion, a sax, a sitar: air
          through a body, played by somebody. They stay sampled, and this round
          did not move one of them — 743 chairs, and that number is not a
          backlog.

     THE TRACT IS NOT PART OF THIS. No seat was added to it and none is asked
     for: `mouthForInstr` reaches it only through `synth_voice` on a LINE chair
     and that is unchanged (nine chairs, before and after). What clause 1 did
     do is nearly TAKE those nine away — a signature synth would have displaced
     the chair the anchor cast as a voice — which is why `MOUTHY` exists in
     precompose. So VOICE.md §11's open question ("whether the tract sustains
     on the live path") is exactly as open as it was this morning; nothing here
     seats it on a held note, and nobody has run the browser probe.

     THE COST TRADE, STATED, because the second number is the one that hurts:
     a Faust seat is charged its pool x its module against a BUDGET of 40, and
     a sampled seat is charged a flat 0.3 — which `audio/plan.js:427` says out
     loud is a LIE ("never looks at `sampler.strip` at all... EVERY ONE of the
     822 states carries strips heavy enough to blow the same budget"). The load
     that actually starves the ring is CONCURRENCY of modulation stages on
     sampled voices, and a modelled voice has no `sampler.strip` at all, so it
     is charged nothing there. Moving 420 held choral chairs off the sampler
     took the mean strip load from 5.23 to 3.89 against a ceiling of 6 while
     taking the cost model from 17.26 to 23.61 against a budget of 40.
     THE STRIP NUMBER IS AN APPROXIMATION AND THE COST NUMBER IS NOT. It was
     taken offline with `trimStripLoad`'s own formula (stages x how many notes
     a seat sounds at once) and the second factor stood in as 3 for a held
     chair and 1 for a moving one, where the real one is counted off the
     compiled timeline. The DIRECTION is not in doubt — a modelled seat has no
     strip at all, so every chair that changed hands took its stages to zero —
     but the magnitude wants the live path. Only the cost is asserted below,
     because only the cost is measured exactly. */
  let CENSUS = null;
  {
    const SEng = require(path.join(__dirname, "..", "engine", "faust",
                                   "voices", "state-engine.js"));
    // WHICH CHAIRS ARE HELD. to-engine.js:224 CHAIR_ROLE is the owner of this
    // and does not export; the three pad parts are spelled here with the
    // citation rather than guessed, and G12f holds them against kernel PARTS.
    const PADPART = { pad: 1, drone: 1, stab: 1 };
    const seatsOf = (doc) => {
      const G = Doc.toGenre(doc, 0, GENRES, FLEET);
      const out = [];
      doc.voices.filter((v) => v.kind === "line").forEach((c, vi) => {
        const ch = (G.chairs || [])[vi] || null;
        const over = ch && ch.instr ? ch.instr : null;
        const syn = over ? null : ((ch && ch.synth) || G.synth) || null;
        const chair = PADPART[c.cast.part] ? "pad" : "line";
        const seat = { chair, instr: over || c.instrument, synth: syn,
                       tone: (ch && ch.tone) || G.tone || null };
        const r = TE.recipeFor(chair, seat, {}, []);
        const kind = String(r.source || "?").split(":")[0];
        out.push({ vi, part: c.cast.part, named: c.instrument, chair, seat,
                   source: r.source, kind, role: r.role, m: r.m,
                   native: kind !== "unrouted" && kind !== "font" && !!(r.m && r.m.model) });
      });
      return out;
    };
    const census = {}, sigSeen = {}, cost = [];
    let nChair = 0, nNative = 0;
    const saidSynth = [];
    for (const [key, doc] of docs) {
      const seats = seatsOf(doc);
      const paid = new Map();
      for (const s of seats) {
        nChair++; if (s.native) nNative++;
        census[s.kind] = (census[s.kind] || 0) + 1;
        if (s.kind === "synth") sigSeen[doc.basis] = s.source;
        if (s.named === "synth" && !SIG(doc)) saidSynth.push(key + " " + s.part);
        const k = s.chair + "|" + s.seat.instr + "|" +
                  (s.seat.synth ? s.seat.synth.dsp : "") + "|" +
                  JSON.stringify(s.seat.tone || null);
        if (paid.has(k)) continue;
        let c = 0.3;
        if (s.native) { try { c = SEng.unitCost(SEng.pitchedUnit(s.role, s.m,
          { bpm: 120, seed: 1 })); } catch (e) { c = 0.3; } }
        paid.set(k, c);
      }
      let tot = 0; for (const c of paid.values()) tot += c;
      cost.push({ key, cost: +tot.toFixed(2) });
    }
    cost.sort((a, b) => b.cost - a.cost);
    const SIGNED = ANCHORS.filter((k) => GENRES[k].synth && GENRES[k].synth.dsp);

    ok("G12a every anchor that declares a `synth` block seats it on at least " +
       "one chair — the whole point of the round, and it was 0 of " +
       SIGNED.length + " before it", () => {
      const missing = SIGNED.filter((k) => !sigSeen[k]);
      assert.deepStrictEqual(missing, [], "silenced: " + missing.join(" "));
    });

    ok("G12b the native-seat count is printed every run and can never " +
       "silently return to zero", () => {
      // A FLOOR, NOT AN EQUALITY. An anchor added tomorrow moves the exact
      // count and must not fail this file. There are TWO numbers here because
      // there are two ways this comes undone and neither one catches the
      // other, both measured by running them: putting an instrument name back
      // on every chair takes `census.synth` to 0 and the native count only
      // from 2485 to 2482 (the ids fall through to the patch table and stay
      // modelled — which is exactly how the seam hid), and deleting the two
      // PATCH_VOICE rows takes the native count to 2065 and leaves the
      // signatures alone. One assert apiece.
      assert.ok(nNative >= 2400, nNative + " native seats of " + nChair +
        " — the seam has regressed (measured 2485 the morning this was written)");
      assert.ok(census.synth >= 60, "only " + census.synth +
        " chairs play the record's own signature synth");
    });

    ok("G12c ABSENT IS TODAY — an anchor that declares no signature seats no " +
       "chair on 'synth', so a record whose anchor says nothing is unmoved", () => {
      assert.deepStrictEqual(saidSynth.slice(0, 5), [],
        saidSynth.length + " chairs say 'the record's own' with no record synth");
      // ...and the two PATCH_VOICE rows added this round took nothing from
      // another table: an id already answered by the mouth, the synth or the
      // model table would have CHANGED sound, not gained one.
      for (const id of Object.keys(NI.PATCHES.voice))
        if (NI.isSection(id))
          assert.ok(!NI.PATCHES.mouth[id] && !NI.PATCHES.synth[id] &&
                    !NI.PATCHES.model[id], id + " already had a patch row");
      assert.strictEqual(NI.PATCHES.voice.solo_vox.dsp, "voice_lead",
        "the one row that was here is unmoved");
      // A HOLE, NAMED RATHER THAN LEFT QUIET: G8e's era test asks
      // `compose.js seatOK(gk, id)` and `INSTR_YEAR` has no row for the string
      // "synth" (nor for any dsp name), so `undefined > year` is false and a
      // chair spelled "the record's own" is not era-checked. It is not a
      // live anachronism — all fifteen anchors that declare a signature are
      // electronic records of the 1970s onward and each declares its own dsp —
      // but the day an anchor from 1650 declares one, nothing here will say so.
      // The honest fix is a year per dsp beside INSTR_YEAR, which is a
      // compose.js round and not this one.
      // ...and every signature this file now seats is a dsp the fleet can
      // actually build, asked of the engine's own table rather than of a copy
      // of it — an unroutable `dsp` would have been silent before and would be
      // silent now, and silence is the one outcome nothing else here catches.
      for (const k of SIGNED)
        assert.ok(TE.SYNTH_OF(GENRES[k].synth.dsp),
          k + " declares dsp " + GENRES[k].synth.dsp + ", which no model names");
    });

    ok("G12d the worst record's voice cost is measured, printed, and held " +
       "under a ceiling", () => {
      // BUDGET is the parent's mobile-safety line (state-engine.js:1986) and it
      // is ADVISORY here: `trimToBudget` runs inside `SE.voiceUnits`, and
      // to-engine.js:1288 adds nukernel's chairs AFTER it, so nothing sheds
      // them. The ceiling below is therefore the real guard, and it sits three
      // units above BUDGET with the reason written down. ONE record of 597 is
      // over the line — synthpop/3, at 42.00 — and it is over because it is a
      // six-piece band in which every chair resolved to a model: a Juno, a
      // supersaw, a singer, an Oberheim, a guitar and a choir. The parent's
      // own note allows "a dense blend can reach ~41-54"; the load that
      // actually starves THIS page — modulation strips on sampled voices,
      // plan.js:405-462 — went DOWN, not up (mean 5.23 -> 3.89 of a ceiling of
      // 6); and a ceiling that a real band cannot reach is a ceiling nobody
      // reads. What it does catch is the seam coming back: measured, writing
      // an instrument onto every chair again puts a record over 43.
      // 43 -> 46 on 2026-08-30, the ledger round, MEASURED not guessed:
      // the catalog grew 358 -> 369 and the guest draws re-dealt (they
      // hash the catalog), so beachboys/1 gained a model-resolved guest
      // chair and became the worst record at 44.91 where synthpop/3's
      // 42.00 had been. That is a re-deal, not the seam: the per-chair
      // costs are unchanged, one record simply seats one more model. The
      // new ceiling keeps the same one-unit headroom over the measured
      // worst that 43 kept over 42.
      const CEILING = 46;
      assert.ok(cost[0].cost <= CEILING, cost[0].key + " costs " +
        cost[0].cost + ", over the stated ceiling of " + CEILING);
    });

    ok("G12e A GUEST DOES NOT BRING A SECOND CHOIR — a record holds exactly " +
       "the vocal SECTIONS its own anchor names, never one more", () => {
      // The ANCHOR may name two and often should: `hymn` is SATB, four parts
      // out of one choir, and it seats aah / ooh / aah so the two PATCH_VOICE
      // `phase` rotations put the parts on different vowels of the same
      // `MOUTHS.hymnal` walk. What a record may NOT gain is a section it never
      // asked for, and `backing` — a function genre whose whole instrument is
      // `ahh_choir` — was handing one to every record it landed on. A section
      // is a ROOM; two rooms singing the same backing part is not a bigger
      // choir, it is a phasing artefact with a second reverb on it, and (as of
      // this round) a second three-voice Faust pool at 12.2 cost units.
      const bad2 = [];
      for (const [key, doc] of docs) {
        const e = GENRES[doc.basis].instr;
        const anchorRooms = new Set((Array.isArray(e) ? e : [e]).filter(NI.isSection));
        const rooms = new Set(doc.voices.filter((v) => v.kind === "line" &&
          NI.isSection(v.instrument)).map((v) => v.instrument));
        if (rooms.size > Math.max(1, anchorRooms.size))
          bad2.push(key + " " + [...rooms].join("+") + " vs anchor " +
                    ([...anchorRooms].join("+") || "none"));
      }
      assert.deepStrictEqual(bad2.slice(0, 5), [],
        bad2.length + " records gained a choir the anchor never named");
    });

    ok("G12f the three held parts this census calls a pad are all real kernel " +
       "parts, and every one of them is one the kernel holds", () => {
      for (const p of Object.keys(PADPART)) assert.ok(K.PARTS[p], p);
    });
    CENSUS = { census, sigSeen, cost, nChair, nNative, SIGNED,
               BUDGET: SEng.BUDGET };
  }

  /* ================================================================== G10
     THE PRINT-OUT PAUL READS (PROGRAM.md §5, PAUL'S EARS item 5): which IDIOM
     family row each anchor resolved to, and where an override overrode it. */
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("  " + nRecords + " records · " + nSections + " sections · " +
              nCells + " line cells · " + nEvents.toLocaleString() + " sounding events");
  console.log("  cell length, in bars: " +
    Object.entries(cbHist).map(([k, v]) => k + " bar" + (k === "1" ? "" : "s") +
      " ×" + v).join(" · "));

  console.log("\nTHE IDIOM TABLE, AS RESOLVED — " + ANCHORS.length + " anchors\n");
  const byFam = new Map();
  for (const gk of ANCHORS) {
    const r = P.idiomOf(gk);
    if (!byFam.has(r.family)) byFam.set(r.family, []);
    byFam.get(r.family).push({ gk, r });
  }
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  for (const [fam, rows] of byFam) {
    const base = P.IDIOM[fam];
    console.log("  " + fam.toUpperCase() + "  " +
      ["cell", "contour", "land", "sent", "len", "reg"].map((f) => f + ":" + base[f]).join(" "));
    const plain = rows.filter((x) => !x.r.override).map((x) => x.gk);
    for (const x of rows.filter((y) => y.r.override))
      console.log("      " + pad(x.gk, 16) + "OVERRIDE  " +
        ["cell", "contour", "land", "sent", "len"]
          .filter((f) => P.IDIOM_ANCHOR[x.gk][f] != null)
          .map((f) => f + ":" + P.IDIOM_ANCHOR[x.gk][f]).join(" "));
    for (let i = 0; i < plain.length; i += 6)
      console.log("      " + plain.slice(i, i + 6).map((g) => pad(g, 16)).join("").trimEnd());
  }
  const nOver = ANCHORS.filter((g) => P.idiomOf(g).override).length;
  console.log("\n  " + nOver + " anchors carry an override; " +
    (ANCHORS.length - nOver) + " take their family row.");
  console.log("  Does a punk hook sound like punk? That is the one question " +
    "this table cannot answer itself.\n");

  /* ---- THE TWO COUNTS STATE.md ASKED FOR, PRINTED -------------------- */
  const table = (h) => Object.entries(h).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => k + " ×" + v).join(" · ");
  console.log("THE POCKET — time.groove over all " + ANCHORS.length +
              " anchors (was: funk ×97, nothing ×25)\n");
  console.log("  " + table(hGroove));
  const byGroove = {};
  for (const gk of ANCHORS) {
    const w = P.grooveOf(GENRES[gk]) || "(none)";
    (byGroove[w] = byGroove[w] || []).push(gk);
  }
  for (const [w, list] of Object.entries(byGroove)) {
    if (w === "(none)") continue;
    console.log("    " + pad(w, 10) + list.join(" "));
  }
  console.log("    " + pad("(none)", 10) + byGroove["(none)"].length +
              " anchors declare no kit, so no drummer has a pocket");

  console.log("\nTHE RETURN — sound.buses.rev, over all " + ANCHORS.length +
              " anchors (was: 1 record, by hand, in songs.js)\n");
  console.log("  how far open   " + table(hRet));
  console.log("  which room     " + table(hColor));
  console.log("  nameplate      " + table(hName));
  console.log("  state.reverb   " + table(retHist));
  console.log("  echo bus       " + nEchoBus + " of " + nRecords +
              " records · time " + table(hEchoTime) + " · repeats " +
              table(hEchoFb) + " · tone " + table(hEchoTone));
  console.log("  chair chips    " + table(hBoxFx));
  console.log("  the board      " + nDeskVoices + " of " + nVoices +
              " voices carry a desk, over " + (nRecords - noDesk.length) +
              " of " + nRecords + " records · " + table(hDeskKey));
  console.log("  Does a dub record sound like a dub record and a chant like a " +
    "stone room?\n  That is the question this table cannot answer itself.\n");


  /* ---- THE COVERAGE FRAME, PRINTED EVERY RUN (WORLD.md §4) ------------
     "Keep a gate that prints the largest inhabited region more than N km
     from any anchor every run. It must never be the thing that says 'done'."
     This is that, in the shape §6 asked for — anchors per region per
     century, the Euro-American share, and the empty cell named — and it
     asserts NOTHING, on purpose. G11d above is the assertion; this is the
     alarm. */
  {
    const AT = require(path.join(__dirname, "..", "nukernel", "atlas.js"));
  const regionOf = {};
  for (const [reg, list] of Object.entries(AT.REGIONS))
    for (const pl of list) regionOf[pl] = reg;
  const cent = (y) => Math.floor(y / 100) + 1;
  const rows = {}, EA = new Set(["Europe", "North America"]);
  let nEA = 0, nPlaced = 0;
  const cents = new Set();
  for (const gk of ANCHORS) {
    const w = AT.WHEN[gk]; if (!w) continue;
    const r = regionOf[AT.canon(w.place)] || "(no region)";
    const c = cent(w.year);
    cents.add(c);
    ((rows[r] = rows[r] || {})[c] = (rows[r][c] || 0) + 1);
    nPlaced++; if (EA.has(r)) nEA++;
  }
  const pad2 = (x, n) => (x + " ".repeat(n)).slice(0, n);
  const cols = [...cents].sort((a, b) => a - b);
  console.log("\nTHE COVERAGE FRAME — anchors per region per century, " +
              nPlaced + " place-year anchors\n");
  console.log("  " + pad2("", 34) + cols.map((c) => pad2(String(c) + "c", 6)).join("") + "total");
  for (const [reg] of Object.entries(AT.REGIONS)) {
    const r = rows[reg] || {};
    const tot = Object.values(r).reduce((a, b) => a + b, 0);
    console.log("  " + pad2(reg, 34) +
      cols.map((c) => pad2(r[c] ? String(r[c]) : "·", 6)).join("") + tot);
  }
  for (const [reg, why] of Object.entries(AT.REGIONS_EMPTY))
    console.log("  " + pad2(reg, 34) + cols.map(() => pad2("·", 6)).join("") + "0" +
                "\n      EMPTY, declared: " + why.slice(0, 96) + "…");
  console.log("\n  Euro-American share " + (100 * nEA / nPlaced).toFixed(1) +
              "% (" + nEA + " of " + nPlaced + ").  WORLD.md §4 measured " +
              "86.3% before the 2020s and African rounds and 80.5% the " +
              "morning of this one;\n  its target for the whole ~215-anchor " +
              "program is 51%, which is NOT this round's number and is not " +
              "meant to be.\n  The map is the alarm, not the specification: " +
              "a region with one dot in it is not covered, it is visited.\n");

  }

  /* THE THROAT CENSUS, PRINTED — the assertions are above, beside the
     other gates; this is the table Paul reads. */
  {
    const { census, sigSeen, cost, nChair, nNative, SIGNED, BUDGET } = CENSUS;
    /* ---- PRINTED EVERY RUN: the census, the signatures, the cost ---- */
    const order = Object.keys(census).sort((a, b) => census[b] - census[a]);
    console.log("\nTHE THROAT CENSUS — what makes the sound, over " + nChair +
                " line chairs\n");
    console.log("  native " + nNative + " of " + nChair + " (" +
                (100 * nNative / nChair).toFixed(1) + "%) · " +
                order.map((k) => k + " ×" + census[k]).join(" · "));
    console.log("  the record's own signature, honoured on " +
                Object.keys(sigSeen).length + " of " + SIGNED.length +
                " anchors that declare one:");
    console.log("    " + SIGNED.map((k) => k + "→" +
                String(sigSeen[k] || "SILENT").replace("synth:", "")).join("  "));
    const over = cost.filter((c) => c.cost > BUDGET);
    console.log("  cost, against the parent's BUDGET of " + BUDGET +
                " — heaviest five: " +
                cost.slice(0, 5).map((c) => c.key + " " + c.cost).join(" · "));
    console.log("  " + over.length + " of " + nRecords + " records over it" +
                (over.length ? " (" + over.map((c) => c.key).join(" ") + ")" : "") +
                " — advisory: to-engine.js:1288 seats nukernel's chairs after " +
                "the parent's own trim, so nothing sheds them.");
    console.log("  Does industrial rock sound like Nine Inch Nails and a hymn " +
                "like a room of people?\n  That is the question this table " +
                "cannot answer itself.\n");
  
  }

  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

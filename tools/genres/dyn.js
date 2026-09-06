#!/usr/bin/env node
/* tools/genres/dyn.js — THE DYNAMICS FLOOD, SHIFT 1: which figure each row's
 * music actually has (2026-09-06, docs/DYNAMICS-FLOOD.md).
 *
 *   node tools/genres/dyn.js            report what each row would take
 *   node tools/genres/dyn.js --write    write `dyn` (and the row's own reason,
 *                                       where the anchor overrules its family)
 *                                       into nukernel/genres/<key>.json
 *   then: node tools/genres/build.js
 *
 * WHY A SCRIPT AND NOT 479 HAND EDITS. The flood's own law is that a flood is
 * DATA, not a default — but 479 hand decisions with no stated procedure is not
 * data either, it is 479 opinions nobody can re-derive. So the decision is
 * written down as three tiers, in this order, and every row's figure is the
 * first tier that answers:
 *
 *   HAND      a named row with a named reason. Where the music is the
 *             exception the tiers below cannot see — the funk record inside
 *             the soul family, the baroque suite inside the folk one.
 *   MEASURED  a rule over the row's OWN data (its kit, its swing, its stamped
 *             stress/phrase/touch). This is the anchor evidence the shift was
 *             told to follow where it disagrees with the family, and each rule
 *             carries the count it matched when it was written.
 *   FAMILY    the cluster's own figure. `genres-tables.js` argues the same
 *             shape for `stress`/`phrase`/`touch`: temperament is a fact about
 *             a CLUSTER first and an anchor second.
 *
 * AND TWO KINDS OF ROW TAKE NOTHING. `lean` is what an absent `dyn` renders (it is the
 * line `ideas-kit.js` held for every genre until today), so a row whose figure
 * IS `lean` writes no field — the catalogue's own "a row exists only where it
 * disagrees" law — and the fourteen `DYNAMICS: null` machines write no field
 * either, on purpose and by name: this shift may widen the catalogue but it may
 * not move a machine, and `flat` is not byte-identical to `lean`.
 *
 * RERUNNABLE. It reads the shipped `genres.js` for the evidence, writes only
 * the `dyn` field and its one dated note paragraph, and recognises its own
 * previous paragraph so a second run is a no-op.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const ROWS = path.join(ROOT, "nukernel/genres");
const NG = require(path.join(ROOT, "nukernel/genres.js"));
const { GENRES, DYNAMICS, FIGURES } = NG;

const MARK = "THE DYNAMIC FIGURE (2026-09-06, the dynamics flood, shift 1)";
const STRIP = new RegExp("\\n*" + MARK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                         "[\\s\\S]*?(?=\\n\\n|$)", "g");

/* ---- FAMILY: the cluster's own figure ------------------------------------ */
/* One line of argument each, and they are the arguments `genres-tables.js`
   already makes about these same clusters in prose. */
const FAMILY = {
  // the barline is a scribe's convenience and the shape of the line is the
  // music — so weight is a thing a sung phrase ARRIVES at
  vox:    ["agogic", "a sung line arrives at its weight rather than departing from it"],
  // the single most consequential fact about American popular music after 1945
  soul:   ["backbeat", "the line leans where the snare is"],
  band:   ["backbeat", "the line leans where the snare is"],
  // reggae, afrobeat, samba, ska: the beat is where the weight is NOT
  groove: ["syncope", "the beat is where the weight is not"],
  // a studio pop record's line arches — that is what a chorus IS
  studio: ["arch", "a pop record's line arches up and comes back down"],
  // ambient, drone and postrock all make the same slow gesture
  drift:  ["swell", "the gesture is the slow build, not the note"],
  // a folk tune, a fiddle reel, a raga line and a Vienna period all lean on
  // the note they start from — this is the figure the whole catalogue had
  roots:  ["lean", "the downbeat-heavy tune that decays is this cluster's own shape"],
  kernel: ["lean", "the blank state keeps the shape the box always had"],
  /* NO `club` ROW, and it is the same absence `DYN_FAMILY` has for the same
     reason, written down there at length: the floor is a machine by
     construction and its members disagree about it individually. Every club
     row is decided by the MEASURED tier below or by hand. */
  /* NO `parts` ROW: a function genre is a JOB, and the five jobs want five
     different shapes. All five are hands. */
};

/* ---- MEASURED: the row's own evidence ------------------------------------ */
/* Each rule states what it reads, what it means, and how many rows it matched
   the day it was written. They are tried in this order and the first wins. */
const back = (g) => {
  /* a backbeat IN THE KIT: snare, clap or rim on the second or fourth quarter
     of the bar. Read off the anchor's own `kit`, which is the only place the
     catalogue has ever said this out loud. */
  if (!g.kit) return false;
  const N = (g.kit.k || g.kit.s || []).length || 16;
  const hit = (i) => ["s", "c", "r"].some((l) => (g.kit[l] || [])[i]);
  return hit(Math.round(N / 4)) || hit(Math.round(3 * N / 4));
};
const RULES = [
  // 17 rows. NO BAR AT ALL: chant, a taqsim, an alap, a qin piece, a ballad
  // sung unaccompanied. The stamped pair says it — stress at or under .12 with
  // phrase at or over .8 is exactly the "there is no metre to feel" corner of
  // DYN_FAMILY — and a figure that leans on a barline is a figure about a
  // barline this music does not have.
  ["agogic", (g) => (g.stress || 0) <= 0.12 && (g.phrase || 0) >= 0.8,
   "the stamped pair (stress ≤ .12, phrase ≥ .8) says this line has no bar to lean on"],
  // 8 rows. FLAT BY CONVICTION, measured: a hand tighter than 15 thousandths
  // of a step with a phrase at or under .2 is not a player who happens to be
  // steady, it is a sequencer, a phase process or a gamelan — a music whose
  // discipline is that it does not lean.
  ["flat", (g) => g.touch && g.touch.t <= 0.015 && (g.phrase || 0) <= 0.2,
   "a hand under .015 with a phrase under .2 is a music whose discipline is not leaning"],
  // 37 rows, and it is the `club` cluster's own split, already argued in
  // DYN_FAMILY: the floors divide into MACHINES (the sequencer keeps the time)
  // and the SAMPLED CORNERS where a hand is in the loop (an MPC with the
  // quantise off, a garage shuffle, a baggy break). A machine is flat; a hand
  // on a floor is playing off the beat, which is why anybody sampled it.
  ["flat", (g) => g.family === "club" && g.touch && g.touch.t <= 0.02,
   "a club floor whose hand is under .02 of a step is the machine keeping time"],
  ["syncope", (g) => g.family === "club",
   "a club floor with a real hand on it is a hand playing off the beat"],
  // 36 rows. SWUNG MUSIC PUSHES. `swing` at or over .15 is a shuffle or a
  // triplet feel, and the whole of that idiom's phrasing is the run-up: the
  // last quarter of the bar is not the end of this bar, it is the approach to
  // the next one. Tried BEFORE the kit rule on purpose — a swing band has a
  // snare on two and four too, and the swing is the stronger claim.
  ["anacrusis", (g) => (g.swing || 0) >= 0.15,
   "the row's own swing (≥ .15) makes the last quarter a run-up, not an ending"],
  // 18 rows. THE BACKBEAT IS IN THE KIT and the family had not noticed —
  // marabi, mambo, norteña, bluegrass, the whole roots shelf that is a
  // backbeat music filed as a tradition. ASKED ONLY WHERE THE FAMILY SAYS
  // `lean` (or says nothing), and that restriction is the point: a cluster
  // that has already made a claim about its own shape — vox arrives, studio
  // arches, groove displaces — is not overruled by the presence of a snare,
  // because nearly every drummer in the catalogue hits two and four and a rule
  // that reads them all would hand 168 of 479 rows the same figure. The kit is
  // evidence where the family had none.
  ["backbeat", (g) => back(g) && (!FAMILY[g.family] || FAMILY[g.family][0] === "lean"),
   "the row's own kit hits two and four, so the line leans where the snare does"],
];

/* ---- HAND: the named exceptions ------------------------------------------ */
/* A row here is a row where the two tiers above are wrong about the music, and
   the reason is the whole entry. Grouped by the figure they take. */
const HAND = {};
const hand = (fig, why, keys) => { for (const k of keys) HAND[k] = [fig, why]; };

// TERRACED — the restatement a level down. Baroque dynamics have no hairpin
// (an organ changes manual, a concerto grosso alternates tutti and
// concertino), and the same device is the process music's three centuries
// later. Every one of these is a repeat with a marked level, not an arch.
hand("terraced", "baroque dynamics have no hairpin — the restatement is the level change",
  ["continuo", "concerto", "operaseria", "sacredconcerto", "secondapratica",
   "fugue", "counterpoint", "francoflemish", "isorhythm", "arsnova"]);
hand("terraced", "a variation set and a phase piece are both a figure restated a level away",
  ["variations", "minimalism", "furnituremusic"]);

// THE SWELL — the crescendo across the bar. Romantic concert music, the film
// cue and the gospel build are three ways of making one gesture, and none of
// them could say it before today.
hand("swell", "the romantic line builds across the bar rather than leaning on any note in it",
  ["romantic", "symphonicpoem", "grandopera", "musicdrama", "verismo", "ballet",
   "nationalism", "concertoverture", "nocturne", "requiem", "oratorio"]);
hand("swell", "a cue's whole job is the build, and the build is a bar-long crescendo",
  ["photoplay", "goldenagescore", "spaceopera", "epichybrid", "fantasyscore",
   "dramascore", "nordicscore", "frontierscore", "trailerscore", "horrorscore"]);
hand("swell", "the church build: the line rises into the arrival and the room rises with it",
  ["gospel", "spirituals", "jubilee", "worship", "ccm", "powerballad"]);

// SYNCOPE — the weight on the and. The rows whose FAMILY is wrong about them,
// each one the reason the family exists to be argued with.
hand("syncope", "the one-and, and everything after it: the figure itself is syncopated, not merely pushed",
  ["funk", "funkrock", "ragtime", "boogie", "minneapolissound", "maxixe",
   "habanera", "danzon", "contradanza", "hambone"]);

// ANACRUSIS — the pickup. The jazz rows the swing rule cannot see because
// their `swing` is written on the kit rather than on the row.
hand("anacrusis", "a horn section phrases into the bar, which is what a chart's ties across the barline are for",
  ["swing", "territoryband", "neworleans", "tradjazz", "crimejazz", "modaljazz",
   "jumpblues"]);

// ARCH — the sung shape at the scale of the bar.
hand("arch", "one voice shaping one line: up to the middle and back",
  ["belcanto", "lied", "chanson", "crooner", "fado", "barcarolle",
   "musichall", "parlor", "operetta", "broadway"]);

// AGOGIC — the rubato rows the stamped pair cannot reach, because they DO have
// a bar; they simply arrive late at it on purpose.
hand("agogic", "rubato is the signature: the line stretches and the band waits for the last note",
  ["tango", "rebetiko", "arabesk", "tarab", "firqa", "nuba", "qawwali", "filmi"]);

// FLAT — the machine wing that was never frozen. A level change here is a
// change somebody may hear and argue with, which is exactly why these get the
// figure and the fourteen `DYNAMICS: null` rows do not.
hand("flat", "a Kling Klang line does not arch, it recurs — this file's own words about the row next door",
  ["dusseldorfschool", "motorik", "roboticpop", "technopop", "chiptune"]);

// LEAN, SAID ON PURPOSE. Four rows where a tier above would have taken the
// figure away and the music says no.
hand("lean", "a march leans on ONE — the kit's two and four are the answering stroke, not the weight",
  ["march"]);
hand("lean", "the bar IS the genre: a waltz and a polka lean on the downbeat, and the second beat is the lift",
  ["waltz", "polka", "musette"]);
hand("lean", "a riff is the part that is NOT expressive — it states its first note and that is the whole job",
  ["riff"]);

// THE FIVE FUNCTION GENRES, which have no family row for the same reason
// DYN_FAMILY gives: a role has a job, not a history.
hand("swell", "a soloist builds — that is what a solo is for", ["solo"]);
hand("arch", "the singer is the most phrase and the least metre of anything in the table", ["vocal"]);
hand("backbeat", "the part stacked UNDER something keeps the weight where the drummer put it", ["backing"]);
hand("swell", "a pad has no metre and barely a hand; what is left is the slow level move", ["pad"]);

/* THE FIT TOOL'S OWN CORRECTIONS (2026-09-06). The genealogy fit was run over
   all 428 rows that declare parents, before and after, in a space widened by
   four features measured off the RENDERED record — mean level, level spread,
   accented fraction, and how much of the accent falls off the downbeat. Twelve
   rows' residue against their declared ancestors grew by more than .06, and
   reading them one at a time separated the INVENTIONS from the MISTAKES.
     The inventions stayed: `ragtime` takes `syncope` where its parents `march`
   and `parlor` lean and arch, and that is the row's whole historical claim;
   `honkytonk` takes the backbeat its old-time parent does not have, which is
   what happened in Fort Worth in 1941.
     The mistakes are these, and every one is the KIT RULE reading a drummer it
   should not have — a mridangam is not a snare, a conga is not a snare, and a
   jazz drummer's two and four is the thing his front line phrases ACROSS. */
hand("lean", "the tala's sam is the weight and a mridangam is not a snare — the kit rule read a South Indian drummer as a backbeat",
  ["kriti", "varnam"]);
hand("anacrusis", "a jazz row phrases into the bar like the parent it names; the ride's two and four is what the horn plays across",
  ["latinjazz", "capejazz", "indojazz", "nordicjazz"]);
hand("syncope", "clave, not backbeat: the weight is the off-beat stroke and the kit rule found the wrong quarter",
  ["son", "mambo", "descarga"]);
/* AND THE CORRECTION HAD TO GO ONE GENERATION FURTHER, which is the fit tool
   working: moving `andalusi` and `muwashshah` alone made THEM the out-of-family
   rows (their own ancestors `abbasid` and `qiyan` still leaned), so the whole
   Arab court line takes the figure together. That is what a maqam line does —
   it arrives — and a cluster where the child arrives and the parent leans is a
   claim nobody would make out loud. */
hand("agogic", "the Arab court line arrives at its phrase end, ancestor and descendant alike",
  ["andalusi", "muwashshah", "abbasid", "qiyan", "zajal", "nuba"]);
hand("agogic", "the oldest sung lines in the table have no bar to lean on, and the Roman ode that quotes them says so",
  ["delphic", "kabulpop"]);
hand("agogic", "a spiritual arrives where the hymn, the shape note and the holler it comes from arrive; the BUILD is gospel's invention a generation later",
  ["spirituals"]);
hand("backbeat", "a produced pop record with a hand on it, not a machine: the club rule's .02 threshold caught a song, and its four parents are all songs",
  ["kpop"]);
hand("syncope", "a sampled break with a hand in the loop, like the two parents it names — the club rule's .02 threshold read an editor as a sequencer",
  ["bristolsound"]);
hand("agogic", "a bolero is a SONG at the front of a Cuban band: the singer arrives at the phrase and the clave is behind her, not in the tune",
  ["bolero"]);

// THE THIRTEEN ROWS WITH NO FAMILY AT ALL, decided one at a time because
// nothing else can decide them.
hand("arch", "a studio pop record with a sung line at the top of it",
  ["ambientpop", "electropop", "artpop", "newpop", "softrock", "balearic"]);
hand("swell", "the slow build is the whole record", ["slowcore"]);
hand("backbeat", "a guitar band with a drummer behind it", ["artrock", "baggy"]);
hand("syncope", "the groove is the point and it is not on the beat", ["worldbeat", "hinrg"]);
hand("flat", "a sequencer and a distortion pedal, and neither of them leans", ["electroindustrial"]);
hand("agogic", "a takht waits for the singer, and the singer arrives at the last note", ["beiruttarab"]);

/* ---- the assignment ------------------------------------------------------ */

function assign() {
  /* A HAND NAMING NO ROW IS A TYPO, and a silent one: it would simply never
     match and the row it meant would quietly take its family's figure. Two
     were caught this way the day the table was written (`bigbandvocal`,
     `torchsong` — neither is a key in this catalogue), so it throws now. */
  const ghosts = Object.keys(HAND).filter((k) => !GENRES[k]);
  if (ghosts.length) throw new Error("dyn.js: hand names rows that do not exist: " +
    ghosts.join(", "));
  const out = {};
  for (const k of Object.keys(GENRES)) {
    const g = GENRES[k];
    if (Object.prototype.hasOwnProperty.call(DYNAMICS, k) && DYNAMICS[k] === null) {
      out[k] = { fig: null, tier: "machine",
                 why: "a frozen machine: `DYNAMICS: null` already says this row has no player in it, " +
                      "and `flat` is not byte-identical to what it renders today" };
      continue;
    }
    if (HAND[k]) { out[k] = { fig: HAND[k][0], tier: "hand", why: HAND[k][1] }; continue; }
    let done = false;
    for (const [fig, test, why] of RULES)
      if (test(g)) { out[k] = { fig, tier: "measured", why }; done = true; break; }
    if (done) continue;
    const fam = FAMILY[g.family];
    if (fam) { out[k] = { fig: fam[0], tier: "family", why: fam[1] }; continue; }
    out[k] = { fig: null, tier: "unassigned",
               why: "no hand, no rule and no family figure — this row keeps the leaning first note" };
  }
  return out;
}

/* the paragraph a row gets when its figure is NOT its family's — the shift was
   told to follow the anchor where the two disagree and to say so in the row's
   own comment, and this is that sentence. A row taking its family's figure
   gets no paragraph: the family IS the argument, and it is written down once
   in `tools/genres/dyn.js` and once in `genres-tables.js FIGURES`. */
/* wrapped to the catalogue's own comment width, because `emit.js` re-emits a
   note line for line as `//` prose and an unwrapped paragraph runs off the
   screen in `genres.js` the way the rescaled-weights notes do. */
const wrap = (s, w) => {
  const out = []; let cur = "";
  for (const word of s.split(" ")) {
    if (cur && (cur + " " + word).length > w) { out.push(cur); cur = word; }
    else cur = cur ? cur + " " + word : word;
  }
  if (cur) out.push(cur);
  return out.join("\n");
};
function para(k, a) {
  const g = GENRES[k];
  const fam = FAMILY[g.family];
  const F = FIGURES[a.fig];
  return wrap(MARK + ": `dyn: \"" + a.fig + "\"` — the line " + F.w + ". " +
    a.why.charAt(0).toUpperCase() + a.why.slice(1) + "." +
    (fam ? " The `" + g.family + "` cluster takes `" + fam[0] + "`; the anchor's own " +
      "evidence outranks it, which is the flood's rule (docs/DYNAMICS-FLOOD.md)." : ""), 72);
}

function write() {
  const A = assign();
  let wrote = 0, noted = 0;
  for (const k of Object.keys(A)) {
    const a = A[k];
    const f = path.join(ROWS, k + ".json");
    const row = JSON.parse(fs.readFileSync(f, "utf8"));
    /* RERUNNABLE, which means this has to be able to recognise its own last
       run: the paragraph is stripped by its dated MARK before a new one is
       written, so running the script twice leaves the file the way one run
       left it. Nothing else in the note is touched. */
    if (row.note && row.note.includes(MARK))
      row.note = row.note.replace(STRIP, "").replace(/\n{3,}/g, "\n\n").trim();
    delete row.dyn;
    if (a.fig && a.fig !== "lean" || (a.fig === "lean" && a.tier === "hand")) {
      row.dyn = a.fig; wrote++;
      if (a.tier !== "family") { row.note = (row.note ? row.note + "\n\n" : "") + para(k, a); noted++; }
    }
    fs.writeFileSync(f, JSON.stringify(row, null, 2) + "\n");
  }
  console.log("wrote `dyn` on " + wrote + " rows; " + noted + " carry the anchor's own reason");
}

function report() {
  const A = assign();
  const byFig = {}, byTier = {};
  for (const k of Object.keys(A)) {
    const f = A[k].fig || "(absent → lean)";
    (byFig[f] = byFig[f] || []).push(k);
    byTier[A[k].tier] = (byTier[A[k].tier] || 0) + 1;
  }
  for (const f of Object.keys(byFig).sort((a, b) => byFig[b].length - byFig[a].length))
    console.log(String(byFig[f].length).padStart(4) + "  " + f.padEnd(16) +
                byFig[f].slice(0, 8).join(" "));
  console.log("\ntiers: " + Object.entries(byTier).map(([t, n]) => t + " " + n).join("  "));
  const unused = Object.keys(FIGURES).filter((f) => !byFig[f]);
  if (unused.length) console.log("UNUSED FIGURES: " + unused.join(", "));
}

module.exports = { assign, FAMILY, RULES, HAND };
if (require.main === module) {
  if (process.argv.includes("--write")) write(); else report();
}

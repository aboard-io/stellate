// test/_arrival-sweep.cjs — DOES EVERY FIELD A GENRE DECLARES REACH A NOTE?
//
//   node test/_arrival-sweep.cjs        (~6 minutes, pure node, prints a table)
//
// A PROBE, NOT A GATE — the `_` prefix is this directory's own word for that.
// It is not in test/all.js and it asserts nothing; it prints columns and the
// reading is a human's.
//
// WHY IT EXISTS. STATE.md items 5 and 6 both claimed a field was "declared and
// never arriving" on the strength of "N anchors declare it and 0 precomposed
// records carry it" — and that sentence measures REPETITION, not arrival.
// `document.js toGenre` opens with `...GENRES[doc.basis]`, so every field an
// anchor declares is on the object the kernel is handed whether any record
// repeats it or not. Item 6 was innocent. Item 5 was guilty for a completely
// different reason (it lost a precedence). So the question is asked here the
// only way that answers it: DELETE the field and see whether a note moves.
//
// CORRECTED 2026-09-01, AND THE CORRECTION IS A SECOND COLUMN. The first
// build of this probe was itself the fifth harness lie (see
// nukernel-deploy-and-probe): it built PREP — document + phrase — ONCE with
// every field present, then deleted fields only from the KERNEL-TIME `g` and
// re-rendered the frozen phrase. A field whose reader runs at PRECOMPOSE
// time can never register there, and the probe convicted two innocents on
// that blindness: `seqArp` (13 declarers, reader precompose.js cellOf) and
// `arpAlways` (reader precompose.js §arp-guarantee) both printed 0 in
// moves-notes while deleting either one moves the precomposed DOCUMENT for
// every declaring anchor — measured 2026-09-01, seeds 1 and 5, thirteen of
// thirteen for seqArp; and at the rendered events balearic's arp chair
// plays three different note streams under arpclose / deleted / arpwide.
// So: `moves-doc` deletes the field from GENRES BEFORE genreToDocument, with
// a FRESH module graph per pass (precompose MEMOIZES an anchor's document —
// mutating GENRES after the build measures nothing; the balearic row's
// own mix-comment correction documents that exact trap). A field is only
// "declared and never arriving" if BOTH columns are zero.
//
// ITS LIMITS, WHICH ARE THE WHOLE OF HOW TO READ IT.
//   * moves-notes is SECTION 0 ONLY — the kernel's intro()/outro() run at
//     section EDGES, so `intro` and `instrumental` print 0 there.
//   * SEED 1 ONLY — a field that only bites on some dice prints low, not zero.
//   * moves-notes is NOTES ONLY — K.render / K.bass / K.drums. Sound, casting
//     and tempo fields (`tone`, `instr`, `synth`, `mix`, `fx`, `bpm`, `words`,
//     `plan`, `realize`, `family`, `near`, `wants`) print 0 there — but most
//     of those DO print in moves-doc, which reads the whole document.
//   * moves-doc reads the document JSON — functions (`word`, `entry` bodies)
//     are invisible to JSON.stringify, but their EFFECTS on the cast are not.
// A zero is a QUESTION. `bassGrid`'s 19-of-22 is the calibration at the low
// end and `orn`'s 92-of-115 the calibration at the high end: both were
// checked by hand first, and this sweep reproduces both.
const path=require("path"); const crypto=require("crypto");
const REPO="/home/ford/stellate/nukernel";
const fresh=()=>{ for (const k of Object.keys(require.cache)) delete require.cache[k];
  const R=(p)=>require(path.join(REPO,p));
  const NG=R("genres.js"); R("fields.js"); const K=R("kernel.js"); R("instruments.js"); R("songs.js");
  const Doc=R("document.js"); const P=R("precompose.js"); R("compose.js");
  return {NG,K,Doc,P}; };
const H=(o)=>crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex");
const sig=(o)=>JSON.stringify(o);

const first=fresh(); const {GENRES}=first.NG; const ANCH=first.P.anchors();
// which fields exist, and who declares them
const FIELDS={};
for (const a of ANCH){ const G=GENRES[a]; if(!G) continue;
  for (const k of Object.keys(G)) (FIELDS[k]=FIELDS[k]||[]).push(a); }
// baseline document hashes, one fresh graph
const DOC0={};
for (const a of ANCH){ try{ DOC0[a]=H(first.P.genreToDocument(a,1)); }catch(e){ DOC0[a]="THROW"; } }
// prepare per-anchor render inputs once (kernel-time deletion column)
const PREP={};
for (const a of ANCH){
  try{
    const d=first.P.genreToDocument(a,1);
    const lines=d.voices.filter(v=>v.kind==="line"); if(!lines.length) continue;
    const g=first.Doc.toGenre(d,0,GENRES);
    const ph=first.Doc.toPhrase(d, first.Doc.materialAt(lines[0], d.form.sections[0].id));
    const total=Math.ceil(Math.max(1,d.form.sections[0].bars*first.Doc.barsOf(d))/g.bars)*g.bars;
    PREP[a]={g,ph,total};
  }catch(e){}
}
const K0=first.K;
function renderAll(g,ph,total){
  const out={};
  try{ out.line=K0.render(ph,g,total).map(e=>[e.t,e.n,e.v,e.vel,e.dur,e.orn||0]);}catch(e){out.line="THROW:"+e.message;}
  try{ out.bass=K0.bass(ph,g,total).map(e=>[e.t,e.n,e.vel,e.dur,e.acc,e.sld]);}catch(e){out.bass="THROW:"+e.message;}
  try{ out.drums=K0.drums(ph,g,g.bars).map(e=>[e.t,e.d,e.vel]);}catch(e){out.drums="THROW:"+e.message;}
  return sig(out);
}
const SKIP=new Set(["label","anchor","place","year","era","parents","why","cite","note","links","wiki","desc","tags","region","country","city","cannot","tier","source"]);
const rows=[];
for (const f of Object.keys(FIELDS).sort()){
  if (SKIP.has(f)) continue;
  const who=FIELDS[f].filter(a=>PREP[a]);
  if (!who.length) continue;
  // column 1: kernel-time deletion against the frozen phrase (the old sweep)
  let movedOn=0, threwOn=0;
  for (const a of who){
    const {g,ph,total}=PREP[a];
    const base=renderAll(g,ph,total);
    const g2={...g}; delete g2[f];
    const alt=renderAll(g2,ph,total);
    if (/THROW/.test(alt) && !/THROW/.test(base)) { threwOn++; movedOn++; continue; }
    if (base!==alt) movedOn++;
  }
  // column 2: delete from GENRES BEFORE genreToDocument, fresh module graph,
  // hash the document — the precompose-time reader's honest measurement
  let movedDoc=0;
  {
    const w=fresh();
    for (const a of who) delete w.NG.GENRES[a][f];
    for (const a of who){
      let h; try{ h=H(w.P.genreToDocument(a,1)); }catch(e){ h="THROW"; }
      if (h!==DOC0[a]) movedDoc++;
    }
  }
  rows.push([f, who.length, movedOn, movedDoc, threwOn]);
}
console.log("field".padEnd(16), "declared-by".padStart(11), "moves-notes".padStart(12), "moves-doc".padStart(10), "throws".padStart(7));
const dead=[];
for (const r of rows.sort((a,b)=>(a[2]+a[3])-(b[2]+b[3])||b[1]-a[1])) {
  console.log(String(r[0]).padEnd(16), String(r[1]).padStart(11), String(r[2]).padStart(12), String(r[3]).padStart(10), String(r[4]).padStart(7));
  if (r[2]===0 && r[3]===0) dead.push(r[0]+" ("+r[1]+")");
}
console.log("\nFIELDS THAT MOVE NEITHER A NOTE NOR THE DOCUMENT:", dead.length);
console.log("  " + dead.join("\n  "));

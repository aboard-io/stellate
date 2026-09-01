// test/_arrival-sweep.cjs — DOES EVERY FIELD A GENRE DECLARES REACH A NOTE?
//
//   node test/_arrival-sweep.cjs        (~6 minutes, pure node, prints a table)
//
// A PROBE, NOT A GATE — the `_` prefix is this directory's own word for that.
// It is not in test/all.js and it asserts nothing; it prints a column and the
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
// ITS THREE LIMITS, WHICH ARE THE WHOLE OF HOW TO READ IT.
//   * SECTION 0 ONLY — the kernel's intro()/outro() run at section EDGES, so
//     `intro` and `instrumental` print 0 and are innocent.
//   * SEED 1 ONLY — a field that only bites on some dice prints low, not zero.
//   * NOTES ONLY — K.render / K.bass / K.drums. Every sound, casting and tempo
//     field (`tone`, `instr`, `synth`, `mix`, `fx`, `bpm`, `words`, `plan`,
//     `realize`, `family`, `near`, `wants`) prints 0 and is innocent.
// A zero is a QUESTION. `bassGrid`'s 19-of-22 is the calibration at the low end
// and `orn`'s 92-of-115 the calibration at the high end: both were checked by
// hand first, and this sweep reproduces both.
const path=require("path"); const R=(p)=>require(path.join("/home/ford/stellate/nukernel",p));
const NG=R("genres.js"); R("fields.js"); const K=R("kernel.js"); R("instruments.js"); R("songs.js");
const Doc=R("document.js"); const P=R("precompose.js"); R("compose.js"); const {GENRES}=NG;
const sig=(o)=>JSON.stringify(o);
const ANCH=P.anchors();
// which fields exist, and who declares them
const FIELDS={};
for (const a of ANCH){ const G=GENRES[a]; if(!G) continue;
  for (const k of Object.keys(G)) (FIELDS[k]=FIELDS[k]||[]).push(a); }
// prepare per-anchor render inputs once
const PREP={};
for (const a of ANCH){
  try{
    const d=P.genreToDocument(a,1);
    const lines=d.voices.filter(v=>v.kind==="line"); if(!lines.length) continue;
    const g=Doc.toGenre(d,0,GENRES);
    const ph=Doc.toPhrase(d, Doc.materialAt(lines[0], d.form.sections[0].id));
    const total=Math.ceil(Math.max(1,d.form.sections[0].bars*Doc.barsOf(d))/g.bars)*g.bars;
    PREP[a]={g,ph,total};
  }catch(e){}
}
function renderAll(g,ph,total){
  const out={};
  try{ out.line=K.render(ph,g,total).map(e=>[e.t,e.n,e.v,e.vel,e.dur,e.orn||0]);}catch(e){out.line="THROW:"+e.message;}
  try{ out.bass=K.bass(ph,g,total).map(e=>[e.t,e.n,e.vel,e.dur,e.acc,e.sld]);}catch(e){out.bass="THROW:"+e.message;}
  try{ out.drums=K.drums(ph,g,g.bars).map(e=>[e.t,e.d,e.vel]);}catch(e){out.drums="THROW:"+e.message;}
  return sig(out);
}
const SKIP=new Set(["label","anchor","place","year","era","parents","why","cite","note","links","wiki","desc","tags","region","country","city","cannot","tier","source"]);
const rows=[];
for (const f of Object.keys(FIELDS).sort()){
  if (SKIP.has(f)) continue;
  const who=FIELDS[f].filter(a=>PREP[a]);
  if (!who.length) continue;
  let movedOn=0, threwOn=0;
  for (const a of who){
    const {g,ph,total}=PREP[a];
    const base=renderAll(g,ph,total);
    const g2={...g}; delete g2[f];
    const alt=renderAll(g2,ph,total);
    if (/THROW/.test(alt) && !/THROW/.test(base)) { threwOn++; movedOn++; continue; }
    if (base!==alt) movedOn++;
  }
  rows.push([f, who.length, movedOn, threwOn]);
}
console.log("field".padEnd(16), "declared-by".padStart(11), "moves-notes".padStart(12), "throws".padStart(7));
const dead=[];
for (const r of rows.sort((a,b)=>a[2]-b[2]||b[1]-a[1])) {
  console.log(String(r[0]).padEnd(16), String(r[1]).padStart(11), String(r[2]).padStart(12), String(r[3]).padStart(7));
  if (r[2]===0) dead.push(r[0]+" ("+r[1]+")");
}
console.log("\nFIELDS THAT MOVE NO NOTE ANYWHERE:", dead.length);
console.log("  " + dead.join("\n  "));

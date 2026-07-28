// describe.js — THE NAMING LAYER of the ⓘ readout: every word the panel is
// allowed to say about a sound, plus the genre hue and the two 0..1
// normalisations the other ⓘ modules share.
//
// ---------- listener-facing DESCRIPTIONS — never name the source.
// Roster text describes ROLE + CHARACTER — never provenance. No "sampler"/"DX7"/
// soundfont/library names, no raw source ids, no real-vs-synth tells: the listener
// gets "round upright bass", not "sampler: acoustic_bass (FluidR3)". Resolution
// still mirrors the engine exactly (same pickSampledId); only the FORMATTING here
// changed — the state fields are untouched. `genre-viz.test.js` J1/J2 gate this:
// a lane name or modal line that leaks a source id or a hardware/library name
// fails the suite, so every new table entry belongs HERE, where the law is stated.
import { K } from "../../core/state.js";

const SIG_SYNTH={ tb303:"squelchy acid bass", acid:"rubbery acid bass", reese:"growling reese bass",
  wobble:"lurching wobble bass", synclead:"tearing sync lead", modeld:"fat mono lead", vocoder:"robot choir" };
const cleanLabel=s=>String(s||"").replace(/\s*\([^)]*\)/g,"").replace(/\s*—.*$/,"").replace(/\s*\+\d+dB.*$/,"").trim();
export const titleCase=s=>String(s||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()).trim();
// character phrase for a resolved sampled-instrument label (first regex wins);
// fallback = the cleaned label lowercased (an instrument noun, never a catalog id).
const VOICE_CHAR=[
  [/fretless/,"singing fretless bass"],[/acoustic bass|upright/,"round upright bass"],
  [/finger/,"warm fingered bass"],[/slap/,"popping slap bass"],[/synth bass|bass & lead/,"punchy synth bass"],
  [/percussive organ|drawbar/,"dusty organ"],[/rock organ/,"growling organ"],[/church organ/,"cathedral organ"],
  [/reed organ/,"parlor reed organ"],[/felt piano/,"soft felt piano"],[/honky/,"barroom piano"],
  [/electric piano|legend ep|e\.? ?piano/,"glassy electric piano"],[/bright grand|grand piano|piano/,"bright grand piano"],
  [/harpsichord/,"courtly harpsichord"],[/clavinet/,"funky clavinet"],[/celesta/,"twinkling celesta"],
  [/music box/,"tiny music box"],[/glocken/,"glittering bells"],[/tubular|bell/,"tolling bells"],
  [/vibraphone/,"shimmering vibes"],[/marimba/,"woody marimba"],[/kalimba/,"plucked thumb keys"],
  [/xylo/,"bright xylophone"],[/steel drum/,"island steel pans"],
  [/jazz guitar/,"mellow jazz guitar"],[/nylon/,"soft nylon guitar"],[/steel string/,"bright steel-string guitar"],
  [/clean guitar/,"chiming clean guitar"],[/distortion|overdriv/,"snarling electric guitar"],
  [/guitar harmonics/,"chiming harmonics"],[/guitar/,"picked guitar"],
  [/muted trumpet/,"whispering muted trumpet"],[/trumpet/,"brassy trumpet"],[/trombone/,"sliding trombone"],
  [/tuba/,"deep parade brass"],[/french horn/,"warm horn section"],[/brass/,"punchy brass section"],
  [/alto sax/,"smoky alto sax"],[/tenor sax/,"breathy tenor sax"],[/baritone sax/,"husky baritone sax"],[/sax/,"smoky sax"],
  [/english horn/,"plaintive reed"],[/oboe/,"reedy oboe"],[/bassoon/,"dark bassoon"],[/clarinet/,"woody clarinet"],
  [/pan flute/,"breathy pan pipes"],[/flute|piccolo/,"airy flute"],[/ocarina/,"hollow clay whistle"],
  [/recorder|whistle/,"reedy whistle"],[/harmonica/,"wailing harmonica"],[/accordion|bandoneon/,"breathing bellows"],
  [/bagpipe/,"droning pipes"],[/pizzicato/,"plucked strings"],[/contrabass/,"bowed low strings"],
  [/cello/,"singing cello"],[/fiddle|violin/,"reeling fiddle"],[/strings|orchestra/,"sweeping strings"],
  [/harp/,"rippling harp"],[/choir|voice|ahh|ohh/,"hovering voices"],[/sitar/,"droning sitar"],
  [/koto/,"plucked koto"],[/shamisen|banjo/,"twanging strings"],[/dulcimer/,"hammered strings"],
  [/atmosphere|fantasia|halo|sweep|soundtrack|new age|warm pad|polysynth|bowed glass|crystal|echo drops|ice rain|goblin|metal pad|charang|chiffer|fifth|square|sawtooth/,"glowing synth pad"],
];
function charOf(label){
  const l=cleanLabel(label).toLowerCase();
  for(const [re,phrase] of VOICE_CHAR) if(re.test(l)) return phrase;
  return l.replace(/_/g," ")||"synth voice";
}
// A SAMPLED VOICE SAYS ITS OWN NAME. The instrument is a General MIDI program and
// "Fretless Bass" is both what it is and what a musician would call it — the
// character phrase ("singing fretless bass") was the readout paraphrasing a fact it
// already had. Character phrases still carry the voices that have no GM name: the
// signature synths, the FM patches, the bare models.
// The lane-name gate forbids dx7/fluidr3/sampler/sf2 and underscores, so this must
// read SAMPLERS[id].label (the program name) and never the catalog id, and the
// cleaner strips the parenthetical/dB/em-dash tails the labels carry for humans.
const GM_STOP=/dx7|fluidr3|soundfont|\bsf2\b|sampler|_/i;
function gmName(label){
  const clean=cleanLabel(label);
  if(!clean||GM_STOP.test(clean)) return charOf(label);   // never leak a source name
  return clean.toLowerCase();
}
// FM patch names -> character (never say the hardware); default "glassy keys".
const DX7_CHAR=[
  [/piano|rhodes|\bep\b/,"glassy electric piano"],[/bell|tub|celest|glock|chime/,"glass bells"],
  [/shimmer/,"shimmering keys"],[/brass|horn/,"soft synth brass"],[/string|violin|cello/,"silky synth strings"],
  [/organ/,"breathing organ"],[/bass/,"punchy digital bass"],[/flute|wood|reed|clar|oboe|pipe/,"airy digital flute"],
  [/voice|choir|vox|aah/,"airy digital choir"],[/pluck|guitar|koto|harp|clav/,"plucked digital strings"],
  [/marimba|vibe|xylo|mallet/,"mallet keys"],[/pad|warm/,"warm digital pad"],
];
function dx7Char(name){
  const l=String(name||"").toLowerCase();
  for(const [re,phrase] of DX7_CHAR) if(re.test(l)) return phrase;
  return "glassy keys";
}
// pure-synth voice models -> character; fallback = a generic per-role phrase.
const MODEL_CHAR={ saw:"warm analog saw", stack:"stacked detuned synth", supersaw:"huge detuned saws",
  sine:"pure sine tone", fm:"glassy digital keys", pluck:"snappy synth pluck", kpluck:"metallic plucked string",
  fuzz:"fuzzy singing lead", guitar:"picked guitar", piano:"upright piano", bell:"glass bells",
  brass:"synth brass", organ:"breathing organ", strings:"silky string machine", choir:"hovering choir",
  rhodes:"glassy electric piano", juno60:"creamy analog polysynth", hammond:"greasy drawbar organ",
  vp330:"misty choir machine", solina:"silvery string ensemble", sub:"deep sub bass", square:"hollow square lead" };
const ROLE_GENERIC={ pad:"warm pad wash", bass:"round melodic bass", melody:"singing lead", solo:"answering lead" };
// drum kits -> character (kit ids are internal; the listener hears a feel).
const KIT_CHAR={ acoustic:"acoustic drum kit", brush:"brushed jazz drums", jazz:"loose jazz drums",
  room:"roomy live drums", power:"arena power drums", full:"full drum kit", open:"open drum groove",
  halftime:"heavy halftime drums", boombap:"dusty boom-bap drums", breaks:"dusty chopped breaks",
  jungle:"racing chopped breaks", techno:"driving machine drums", pulse:"pulsing machine drums",
  house:"four-on-the-floor machine", four:"four-on-the-floor machine" };
export const kitChar=kit=>KIT_CHAR[kit]||(titleCase(kit).toLowerCase()+" drums");
// found sources -> texture character by KIND only (never the recording's name/id).
const FOUND_CHAR={ speech:"cut-up announcer voice", vox:"vocal fragments", break:"chopped drum breaks", hit:"sampled stabs" };
// bed CHARACTER by id-class. "Tape atmosphere" was once the single fallback
// label for 48 different beds; name what KIND of air it is instead — still
// never the source, so the provenance law holds.
const BED_CHAR=[   // ordered: specific tokens fire before the broad city/road/water nets
  [/factory|industr|machine|furnace|mill\b|_press|turbine|grinding|pumping|silo/i, "machine room"],
  [/shortwave|vlf|_em$|interference|static/i,  "shortwave"],
  [/bell|village|brocante|carillon|calgary|tongluo/i, "smalltown"],
  [/station|shibuya|tokyo|plaza|tw_|metro|market|bazaar|souk|forge|arcade|casino|subway|escalator|schoolyard|playground|bart_/i, "city air"],
  [/hydro|whale|water|ocean|sea|surf|beach|glacier/i, "deep water"],
  [/highway|road|traffic|train|freight|tram\b/i, "road hum"],
  [/rain|thunder|storm|blizzard|_wind|wind_/i, "weather"],
  [/^vx_|voice|radio|conet|apollo|wwvh|_pa$|terrace|fans|choir/i, "voices on tape"],
  [/frog|cricket|bird|loon|chickadee|pigeon|nature|wind|coyote|owl|cicada|ibis|_dawn$|fox|mull_/i, "night air"],
  [/hum|hvac|drone|fan\b|thermo|office|fridge|boiler|vault|vent|elevator/i, "room tone"],
];
export const foundChar=s=>{ if(FOUND_CHAR[s&&s.kind]) return FOUND_CHAR[s.kind];
  const id=(s&&s.id)||""; for(const [re,c] of BED_CHAR) if(re.test(id)) return c;
  return "tape atmosphere"; };
// FOUND ROLE — the authored job of the found layer, read off the state instead
// of inferred from event shape. `bed` keeps the per-source texture character
// (the id-class read above is genuinely more specific than the word "bed");
// the three CHOPPING roles all emit identical chop events and are only
// distinguishable by role, which is exactly why the inference was wrong.
export const FOUND_ROLE_CHAR={ break:"chopped drum breaks", chops:"chopped sample slices",
  narration:"spoken narration" };                                    // bed → absent: the texture character wins
export const FOUND_ROLE_LABEL={ break:"breaks", chops:"chops", narration:"narration", bed:"found" };
// the two 0..1 normalisations every ⓘ module shares. num1 folds a range-shaped
// state field ([lo,hi]) to its midpoint, so the radar and the mind read the same
// number off the same field — the one definition is the point.
export const clamp01=v=>v<0?0:v>1?1:v;
export const num1=v=>Array.isArray(v)?clamp01(((+v[0]||0)+(+v[1]||0))/2):clamp01(+v||0);
// a stable neon hue per genre name (FNV hash → 0..360): a genre reads the same
// colour in the blend bar, the radar accents and the on-map glyph.
function genreHue(g){ let h=2166136261>>>0; const s=String(g);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0)%360; }
export const genreCol=(g,l)=>`hsl(${genreHue(g)} 78% ${l==null?62:l}%)`;
// resolved display name for a pitched voice — mirrors state-engine forceSampled:
// signature synths stay named as synths; everything else resolves to the SF2
// sampled instrument the engine will actually build for this (role,model,seed).
export function voiceName(role,m,st){
  m=m||{};
  if(m.model&&SIG_SYNTH[m.model]) return SIG_SYNTH[m.model];
  if(m.model==="sampler"&&m.sampler&&K.SAMPLERS[m.sampler.id]) return gmName(K.SAMPLERS[m.sampler.id].label);
  if(st.sampledOnly&&st.samplerLib&&window.FaustStateEngine&&FaustStateEngine.pickSampledId){
    try{ const id=FaustStateEngine.pickSampledId(role,m.model,st.seed);
      if(K.SAMPLERS[id]) return gmName(K.SAMPLERS[id].label); }catch(e){}
  }
  if(m.dx7) return dx7Char(m.dx7.name);
  return MODEL_CHAR[m.model]||ROLE_GENERIC[role]||titleCase(role).toLowerCase();
}

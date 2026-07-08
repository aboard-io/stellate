// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[201,218], neoclassical:[304,628], vaporwave:[591,411], lofi:[406,1000],
  downtempo:[754,739], blues:[518,1396], jazz:[972,1369], triphop:[832,947],
  synthwave:[1063,564], dancepop:[1292,189], edm:[1674,184], house:[1244,909],
  techno:[1683,523], dubstep:[1669,1147], jungle:[1673,1403], dinosynth:[216,1365],
  canawave:[893,183], transitwave:[1298,571], dub:[1135,1245], trance:[1784,367],
  disco:[1194,728], italo:[1369,384], bigbeat:[1607,923], garage:[1429,1299],
  doomdrone:[189,818], newage:[381,416], exotica:[626,1146], industrial:[1807,908],
  spokenword:[616,904], chiptune:[1889,196], chinawave:[773,354], sovietwave:[1099,187],
  citypop:[822,556], shibuyakei:[971,382], bossanova:[749,1383], idm:[1053,1004],
  electro:[1560,363], miamibass:[1660,727], phonk:[1273,1119], witchhouse:[425,793],
  mallsoft:[431,196], wintersynth:[189,1085], gabber:[1968,1056], psytrance:[1973,443],
  minimal:[1862,631], deephouse:[1451,1040], coldwave:[1175,381], ebm:[1871,1273],
  krautrock:[1496,576], newjack:[983,768], breakcore:[1953,1537], acidhouse:[1425,786],
  surfrock:[1210,1482], spacelounge:[563,622], arabpop:[869,1161], tango:[389,1218],
  desertblues:[435,1608], sludgemetal:[172,483], industrialmetal:[1996,791], darksynth:[1472,185],
  hogcore:[1432,1557], prelude:[658,185], atlantidrone:[2247,1516], sourdough:[263,1817],
  crtwave:[2539,1019], whalejazz:[2510,1543], termswave:[2313,203], microwave:[982,1593],
  airtrafficdrone:[2137,636], faxbossa:[2361,928], crickettempo:[2470,1792], thermostatwave:[721,1620],
  holdmusic:[2090,199], lunapolka:[2524,1290], elevatorcore:[2354,443], hotsaucecore:[595,1815],
  ikeacore:[1213,1776], zubrovia:[2311,1202], dishwasherwave:[192,1601], surveywave:[2530,210],
  aldente:[919,1814], umpirehouse:[2547,467], pigeonstep:[1501,1811], dmvstep:[2166,405],
  towncrier:[2541,734], chickadeecore:[1845,1804], floppycore:[2101,1281], cerealwave:[2149,1781],
  laundrycore:[1679,1634], auctioncore:[2336,688], dialupgabber:[2163,946]
};
// The star map lives in a LOGICAL coordinate space. POS above is only a SEED —
// a familiar starting shape. The AUTHORITATIVE layout is COMPUTED at load by
// computeGenreLayout() (down near boot): a deterministic force-directed / Lloyd
// relaxation that (a) covers EVERY genre in K.GENRES — deriving a position for
// any genre missing from the seed (e.g. fugue, afrobeat) near its most-similar
// seeded neighbour — and (b) pushes nodes apart until no two genre NAME LABELS
// overlap on screen at the default zoom (the boxes are measured in real pixels),
// with a hard minimum dot separation and a weak similarity spring for grouping.
// It mutates POS in place (same object, so window.__X.POS and weightsAt stay
// valid), then recomputeWorld() rebuilds the bounds. WORLD_W/WORLD_H are COMPUTED
// from the POS extents (+ margin), never hardcoded; drawMap fits
// [0..WORLD_W]×[0..WORLD_H] to the viewport at ZOOM.k===1, so the whole spread is
// visible un-zoomed and exceeds the screen only when you zoom IN (then you pan).
// MAP_CENTER is the centre of that space — waypoint 1 of the default loop always
// sits here. No Math.random touches the layout: it is byte-identical run to run.
export const WORLD_MARGIN=90;
export let WORLD_W, WORLD_H, MAP_CENTER;
const MIN_SEP_FLOOR=90;   // logical units; the relaxation lands well above this
// (re)compute the world bounds + centre + min-pair introspection from POS. Called
// once now (from the seed) and again after computeGenreLayout() rewrites POS.
export function recomputeWorld(){
  const xs=Object.values(POS).map(p=>p[0]), ys=Object.values(POS).map(p=>p[1]);
  const bb={minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)};
  WORLD_W=bb.maxx+WORLD_MARGIN; WORLD_H=bb.maxy+WORLD_MARGIN;
  MAP_CENTER={x:(bb.minx+bb.maxx)/2, y:(bb.miny+bb.maxy)/2};
  const gs=Object.keys(POS); let mn=Infinity,pr="";
  for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){
    const d=Math.hypot(POS[gs[i]][0]-POS[gs[j]][0],POS[gs[i]][1]-POS[gs[j]][1]);
    if(d<mn){mn=d;pr=gs[i]+"/"+gs[j];} }
  window.__MINSEP=mn;
  if(mn<MIN_SEP_FLOOR) console.warn("[POS] min pairwise "+mn.toFixed(1)+" ("+pr+") < floor "+MIN_SEP_FLOOR);
}
recomputeWorld();
// SNAP (snap-to-anchor gap) and CUTOFF (weight-falloff radius) are DISTANCES, so
// they scale with the coordinate space — bumped ~2.45x alongside the respread so
// the same handful of neighbours blend and being on a star still reads as pure.
export const SNAP=64, CUTOFF=430, BARS_PER_SEG=128;   // one path leg ≈ 128 bars — genres evolve slowly, almost imperceptibly
export const KEYS=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export const PROG_MODE={ royal_road:[0,"major · royal road"], four_chords:[0,"major"], sad_pop:[9,"minor"],
  doo_wop:[0,"major"], ii_v_i:[0,"major · ii-V-I"], pop_1625:[0,"major"], synthwave:[9,"minor"],
  andalusian:[9,"minor · andalusian"], minor_run:[9,"minor"], neosoul:[0,"major · lydian air"],
  lofi:[0,"major · jazzy"], epic_min:[9,"minor"], house_min:[9,"minor"], dream:[0,"major · dreamy"],
  canon:[0,"major · canon"], drone_min:[9,"minor · drone"], deep_two:[9,"minor"],
  house_min7:[9,"minor"], blues_12:[0,"blues · dom7 12-bar"], primeval:[9,"minor · primeval"],
  uplift:[9,"minor · uplift"], funk_vamp:[9,"dorian · funk vamp"],
  mode_dorian:[9,"dorian"], mode_phrygian:[9,"phrygian"], mode_lydian:[0,"lydian"], mode_mixo:[0,"mixolydian"],
  frost:[9,"minor · frost triads"], hijaz:[9,"phrygian dominant · hijaz"] };
export const MODE_LOCKS={ auto:null, major:"dream", minor:"minor_run", dorian:"mode_dorian",
  phrygian:"mode_phrygian", lydian:"mode_lydian", mixolydian:"mode_mixo", blues:"blues_12" };

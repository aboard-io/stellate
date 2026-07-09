// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[6147,2910], neoclassical:[772,607], vaporwave:[4570,784], lofi:[690,1657],
  downtempo:[2148,1296], blues:[2986,4208], jazz:[786,3021], triphop:[1838,1807],
  synthwave:[2795,277], dancepop:[4559,268], edm:[5243,1314], house:[3427,4036],
  techno:[5712,4080], dubstep:[4529,2929], jungle:[4590,3142], dinosynth:[90,2679],
  canawave:[4089,954], transitwave:[3622,1486], dub:[5287,4345], trance:[5578,1312],
  disco:[2993,1833], italo:[4885,613], bigbeat:[3830,2962], garage:[3670,4206],
  doomdrone:[3099,2002], newage:[1563,611], exotica:[1260,2335], industrial:[5013,2177],
  spokenword:[871,1828], chiptune:[5314,970], chinawave:[5382,1661], sovietwave:[2536,617],
  citypop:[4921,1140], shibuyakei:[6060,1315], bossanova:[2275,3522], idm:[2791,2466],
  electro:[4377,1937], miamibass:[3072,3345], phonk:[2902,2177], witchhouse:[2024,1466],
  mallsoft:[4896,1487], wintersynth:[1776,2149], gabber:[6499,2571], psytrance:[5347,2346],
  minimal:[5605,3905], deephouse:[3567,4381], coldwave:[5235,438], ebm:[5178,3031],
  krautrock:[5118,2004], newjack:[2800,1182], breakcore:[5508,3034], acidhouse:[3907,3693],
  surfrock:[3334,1124], spacelounge:[1091,954], arabpop:[1170,2959], tango:[675,2166],
  desertblues:[2906,3691], sludgemetal:[2383,787], industrialmetal:[3431,1834], darksynth:[5146,263],
  hogcore:[5426,2687], prelude:[1109,262], atlantidrone:[6286,3082], sourdough:[6686,2913],
  crtwave:[5962,2691], whalejazz:[1915,3177], termswave:[6502,2055], microwave:[2421,2659],
  airtrafficdrone:[7139,2055], faxbossa:[3125,2353], crickettempo:[2714,1636], thermostatwave:[6778,2739],
  holdmusic:[2556,2835], lunapolka:[7990,2397], elevatorcore:[2939,3005], hotsaucecore:[2086,3861],
  ikeacore:[5618,4256], zubrovia:[685,3193], dishwasherwave:[5615,4594], surveywave:[6753,1363],
  aldente:[5721,4426], umpirehouse:[5832,1875], pigeonstep:[4569,4035], dmvstep:[4551,3651],
  towncrier:[3731,2788], chickadeecore:[5362,3553], floppycore:[5077,3205], cerealwave:[6317,2397],
  laundrycore:[5262,3374], auctioncore:[5984,2229], dialupgabber:[5526,2514], afrobeat:[4114,2279],
  fugue:[1223,438], dnb:[4188,3135], footwork:[4674,3477], happyhardcore:[7005,2395],
  hardstyle:[4741,1656], eurodance:[6921,1540], singeli:[4477,2107], bebop:[1797,3349],
  bluegrass:[4677,959], ska:[4228,263], klezmer:[502,2336], funk:[2519,2149],
  boombap:[1075,1660], amapiano:[3864,4037], reggae:[2053,613], heavymetal:[1227,780],
  budstep:[3197,2712], pixiewave:[4708,2346], picnicswing:[3237,781], cerealboxwave:[2990,101],
  rosinamblelilt:[937,1130], subwooferbalm:[3065,3866], sepiadrive:[995,3362], sparkbreak:[3772,2448],
  hopscotchwave:[1951,1127], moltenhouse:[4461,3864], magmastrut:[3904,2619], hammerhouse:[5759,2056],
  zestgallop:[5462,1141], whittlertrot:[1155,1299], bunkerthump:[4597,2515], gumballdrive:[6127,1533],
  kettlefunk:[7517,2226], glosspump:[5203,3722], refrigeratorfunk:[3923,1127], sherbetchop:[4681,2692],
  pinballchop:[3339,2178], idlingsplice:[3582,3520], trenchsway:[1673,437], tarbreak:[5246,1832],
  cedarskank:[7893,2568], bramblestep:[1832,957], toastercore:[6023,1707], vendingmachinethump:[5215,783],
  boilercreep:[5069,2861], fluorescentstrut:[3436,438], dialtonehaze:[6726,2227], breadboxmince:[1901,2490],
  earthmoversplice:[3188,3176], butterchurnbounce:[562,1997], furnacestrut:[376,2851], tectonicdash:[3129,955],
  tundradoom:[8212,2226], sodabop:[3240,2523], citrushaze:[6689,1883], confettililt:[2829,1466],
  willowmarch:[2048,2322], standbylightdrive:[4024,1316], cairntrot:[6784,1709], dumptruckdub:[1613,1636],
  tallowtrot:[2646,447], fathomarch:[2385,3345], masonshuffle:[727,2681], boilerroomstomp:[3716,3345],
  brinedub:[3435,1296], attichouse:[2247,3007], driftrot:[2403,1807], ceilingfanchop:[1517,2789],
  strawdub:[2838,4037], porchdice:[3737,2006], shellacsplice:[5327,613], gourdscuttle:[4434,438],
  auroragallop:[1969,3690], atticfanthrashsplice:[3514,1657], obelisktrot:[1155,2505], oakdublilt:[2876,4384],
  duststrut:[4154,4205], reedrush:[1685,3520], hearthsway:[1335,1468], graingroove:[1993,1978],
  hvacbop:[619,2511], moldcore:[1324,3135], hydracore:[5488,1487], ashfunk:[1705,2958],
  steamdub:[3342,611], seraphswing:[5017,90]
};
// The star map lives in a LOGICAL coordinate space. POS above is BAKED — the
// full relaxed layout for every committed genre, precomputed once (headless boot
// at a 1200×850 reference viewport) and pasted here. It is a cache of
// computeGenreLayout()'s output, which is deterministic, so the bake is exact.
// WHY: that relaxation is O(N²)·(N·40 iterations); at 178 genres, running it on
// every load stalled boot for seconds. Baking it means the common boot has
// NOTHING to solve — computeGenreLayout early-returns when POS already covers
// K.GENRES, and pays the full force-directed / Lloyd relaxation ONLY when a genre
// is MISSING (a dev added one without re-baking): it then (a) covers EVERY genre —
// deriving a position for any missing one near its most-similar neighbour — and
// (b) pushes nodes apart until no two genre NAME LABELS overlap on screen at the
// default zoom (boxes measured in real px), with a hard min dot separation and a
// similarity spring for grouping. TO RE-BAKE after adding genres: boot the app,
// read window.__X.POS, paste it back here.
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

// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[2496,4270], neoclassical:[1049,775], vaporwave:[1971,1493], lofi:[384,2835],
  downtempo:[625,2381], blues:[1193,6778], jazz:[310,5139], triphop:[426,2604],
  synthwave:[1057,2608], dancepop:[2145,1264], edm:[1552,2610], house:[1277,6321],
  techno:[2415,7527], dubstep:[1679,5626], jungle:[2103,6674], dinosynth:[213,4215],
  canawave:[1795,1277], transitwave:[993,2834], dub:[2348,7997], trance:[1923,3323],
  disco:[1587,3791], italo:[2111,1727], bigbeat:[954,4719], garage:[1131,6319],
  doomdrone:[1882,4029], newage:[1287,818], exotica:[405,4207], industrial:[1980,4940],
  spokenword:[311,3301], chiptune:[1684,1735], chinawave:[2391,2834], sovietwave:[741,1925],
  citypop:[1860,1958], shibuyakei:[2111,2415], bossanova:[806,4025], idm:[1206,4006],
  electro:[1618,4959], miamibass:[1130,4716], phonk:[1508,3303], witchhouse:[1405,3074],
  mallsoft:[1970,3799], wintersynth:[1511,4256], gabber:[2156,5404], psytrance:[2060,4484],
  minimal:[2384,7301], deephouse:[1338,6777], coldwave:[2240,1725], ebm:[1943,5871],
  krautrock:[1413,4719], newjack:[1389,2616], breakcore:[2042,5871], acidhouse:[1675,6707],
  surfrock:[1648,1963], spacelounge:[363,1452], arabpop:[508,5134], tango:[212,3758],
  desertblues:[1090,4946], sludgemetal:[1425,1922], industrialmetal:[1639,3309], darksynth:[1257,1460],
  hogcore:[1995,5406], prelude:[1079,90], atlantidrone:[2528,4497], sourdough:[2533,4034],
  crtwave:[2455,3790], whalejazz:[512,2146], termswave:[2519,3561], microwave:[1315,3310],
  airtrafficdrone:[2630,2890], faxbossa:[803,3065], crickettempo:[754,2837], thermostatwave:[2616,3806],
  holdmusic:[631,3750], lunapolka:[2835,3578], elevatorcore:[822,3519], hotsaucecore:[699,5595],
  ikeacore:[2383,7760], zubrovia:[361,5368], dishwasherwave:[2440,8452], surveywave:[2318,2601],
  aldente:[2476,8218], umpirehouse:[2075,4026], pigeonstep:[1226,5632], dmvstep:[1157,5405],
  towncrier:[1076,4237], chickadeecore:[1587,5855], floppycore:[2059,6440], cerealwave:[2252,4494],
  laundrycore:[1875,6107], auctioncore:[2021,4710], dialupgabber:[1781,4487], afrobeat:[1450,5559],
  // fugue hand-nudged into the classical corner after the 212-genre re-bake (explorer gate D2e: fugue's 3 nearest must include prelude; the relaxation packed cloisterloom/submarinelullaby between fugue and prelude — placed at a roomy spot whose 3 nearest are cloisterloom/prelude/submarinelullaby, min pair sep stays 98.5)
  fugue:[600,80], dnb:[1659,6320], footwork:[2281,7072], happyhardcore:[2355,3329],
  hardstyle:[1607,3545], eurodance:[2438,3101], singeli:[1587,5187], bebop:[704,4670],
  bluegrass:[1917,1729], ska:[1860,591], klezmer:[158,3986], funk:[1242,3536],
  boombap:[275,3070], amapiano:[1434,6320], reggae:[586,1451], heavymetal:[404,1216],
  budstep:[1307,4025], pixiewave:[1750,4714], picnicswing:[1597,1046], cerealboxwave:[1156,1921],
  rosinamblelilt:[438,1917], subwooferbalm:[1178,6089], sepiadrive:[538,5368], sparkbreak:[998,4007],
  hopscotchwave:[519,3522], moltenhouse:[2459,7075], magmastrut:[1787,5398], hammerhouse:[1973,2884],
  zestgallop:[1799,3551], whittlertrot:[349,2374], bunkerthump:[1821,5169], gumballdrive:[2110,3338],
  kettlefunk:[2712,3352], glosspump:[1549,6091], refrigeratorfunk:[1616,1506], sherbetchop:[1841,5635],
  pinballchop:[1467,4018], idlingsplice:[1310,5862], trenchsway:[664,1004], tarbreak:[2069,3111],
  cedarskank:[2888,3812], bramblestep:[707,1696], toastercore:[2071,2645], vendingmachinethump:[1986,2186],
  boilercreep:[2305,4723], fluorescentstrut:[779,1232], dialtonehaze:[2661,3123], breadboxmince:[436,3071],
  earthmoversplice:[824,3777], butterchurnbounce:[90,3529], furnacestrut:[229,4910], tectonicdash:[1556,1275],
  tundradoom:[2921,3346], sodabop:[1382,4482], citrushaze:[2658,2658], confettililt:[818,2602],
  willowmarch:[500,2839], standbylightdrive:[1614,3071], cairntrot:[2246,3064], dumptruckdub:[705,2153],
  tallowtrot:[743,1468], fathomarch:[868,4253], masonshuffle:[260,4672], boilerroomstomp:[1097,4488],
  brinedub:[1125,3780], attichouse:[599,3978], driftrot:[692,3293], ceilingfanchop:[475,4906],
  strawdub:[1162,6549], wickershimmy:[1543,4488], shellacsplice:[2021,1957], gourdscuttle:[1840,1048],
  auroragallop:[748,5369], atticfanthrashsplice:[869,3291], obelisktrot:[406,3751], oakdublilt:[1161,7014],
  duststrut:[1467,6548], reedrush:[900,4489], hearthsway:[499,1687], graingroove:[588,2609],
  hvacbop:[337,4443], moldcore:[668,5142], hydracore:[2006,3565], ashfunk:[499,4639],
  steamdub:[943,2375], seraphswing:[1778,362], androidlament:[1736,4259], lasertemple:[1461,2845],
  oscillatorminuet:[1250,2380], cometwhistle:[2147,3797], chromepiston:[851,5136], patchcordmirage:[2446,7987],
  velourregatta:[1731,2192], sorcerercape:[1263,5176], wizardcape:[745,4906], meadowmellotron:[1302,3767],
  hexagonstampede:[1313,4946], crimsoncourt:[1270,4255], moonlagoon:[1398,3540], sliderule:[1395,1694],
  crumpetwhirl:[358,3978], polygonforge:[1730,3784], moptoprattle:[1894,819], meadowjangle:[1832,2656],
  strawberryfog:[2115,4256], octopusminuet:[1394,2150], walrusfuzz:[1185,2152], rooftopholler:[1652,2420],
  submarinelullaby:[1017,546], tangerinearcade:[2179,1496], chalkvespers:[2045,5177], salondawdle:[886,1004],
  candlegauze:[1373,1046], cloisterloom:[982,318], miasmarow:[1690,4020], greasepaintoompah:[1089,3064],
  urchinmatinee:[2277,1956], marblefury:[660,4440], perukelotto:[2200,3564], beakstampede:[566,4204]
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

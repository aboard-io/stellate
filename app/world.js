// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[8446,2909], neoclassical:[2031,265], vaporwave:[6064,1079], lofi:[1038,1263],
  downtempo:[1984,1542], blues:[3709,4455], jazz:[614,2766], triphop:[1229,1921],
  synthwave:[3294,528], dancepop:[6579,575], edm:[5439,1748], house:[4104,3952],
  techno:[8047,5242], dubstep:[5814,3267], jungle:[7121,4325], dinosynth:[187,2266],
  canawave:[5431,1079], transitwave:[3779,1597], dub:[7799,5583], trance:[6664,1751],
  disco:[4720,2099], italo:[6687,742], bigbeat:[3650,2939], garage:[3693,4120],
  doomdrone:[5978,2091], newage:[2771,530], exotica:[1037,2090], industrial:[5948,2425],
  spokenword:[478,1602], chiptune:[6183,1248], chinawave:[7182,1920], sovietwave:[2118,1036],
  citypop:[5868,1610], shibuyakei:[7004,1370], bossanova:[1919,3240], idm:[3528,2302],
  electro:[5158,2615], miamibass:[2842,3106], phonk:[4049,2105], witchhouse:[2797,1432],
  mallsoft:[6554,1924], wintersynth:[5184,2090], gabber:[7073,2941], psytrance:[6422,2594],
  minimal:[7935,5073], deephouse:[4340,4124], coldwave:[7149,749], ebm:[6387,3270],
  krautrock:[5256,2444], newjack:[4166,1429], breakcore:[6927,3557], acidhouse:[5507,3945],
  surfrock:[5221,1412], spacelounge:[794,765], arabpop:[840,2934], tango:[456,1933],
  desertblues:[3008,3284], sludgemetal:[4314,1091], industrialmetal:[4542,1924], darksynth:[4293,589],
  hogcore:[6431,2930], prelude:[1915,90], atlantidrone:[8554,3076], sourdough:[8555,2737],
  crtwave:[8364,2571], whalejazz:[1791,3068], termswave:[8097,2067], microwave:[3860,1938],
  airtrafficdrone:[8670,1893], faxbossa:[2603,2058], crickettempo:[2072,1717], thermostatwave:[8938,2434],
  holdmusic:[1960,2563], lunapolka:[9973,2270], elevatorcore:[2618,2395], hotsaucecore:[1857,3770],
  ikeacore:[7934,5411], zubrovia:[523,3100], dishwasherwave:[8132,5917], surveywave:[7743,1374],
  aldente:[8263,5745], umpirehouse:[7300,2086], pigeonstep:[4163,3447], dmvstep:[3811,3280],
  towncrier:[3999,2438], chickadeecore:[5397,3440], floppycore:[6836,3754], cerealwave:[7404,2763],
  laundrycore:[6419,3924], auctioncore:[7105,2596], dialupgabber:[6546,2762], afrobeat:[4899,2955],
  // fugue hand-nudged toward prelude after the 186-genre re-bake (explorer gate D2e: fugue's 3 nearest must include prelude; the relaxation left it 4th by ~30 units)
  fugue:[1500,170], dnb:[5385,3777], footwork:[7695,4736], happyhardcore:[7786,2405],
  hardstyle:[5562,1913], eurodance:[8038,1541], singeli:[5045,2787], bebop:[1457,3267],
  bluegrass:[6179,911], ska:[6219,572], klezmer:[310,2099], funk:[2412,2230],
  boombap:[665,1429], amapiano:[4655,3834], reggae:[1595,928], heavymetal:[1183,599],
  budstep:[3882,2273], pixiewave:[5732,2614], picnicswing:[4759,757], cerealboxwave:[3408,360],
  rosinamblelilt:[629,931], subwooferbalm:[3750,3784], sepiadrive:[1114,3436], sparkbreak:[3775,2605],
  hopscotchwave:[1505,1372], moltenhouse:[8144,4907], magmastrut:[5531,2955], hammerhouse:[6546,2257],
  zestgallop:[6447,1584], whittlertrot:[823,1097], bunkerthump:[5636,2786], gumballdrive:[7186,1541],
  kettlefunk:[9637,2098], glosspump:[5135,3608], refrigeratorfunk:[5112,1245], sherbetchop:[6277,3099],
  pinballchop:[4515,2266], idlingsplice:[4278,3616], trenchsway:[1346,432], tarbreak:[6671,2091],
  cedarskank:[10086,2439], bramblestep:[1724,1204], toastercore:[7873,1898], vendingmachinethump:[6750,1082],
  boilercreep:[7644,2930], fluorescentstrut:[2418,696], dialtonehaze:[8779,2060], breadboxmince:[1466,2394],
  earthmoversplice:[2699,2573], butterchurnbounce:[90,1767], furnacestrut:[179,2599], tectonicdash:[4581,925],
  tundradoom:[10377,2100], sodabop:[4683,2438], citrushaze:[8559,1721], confettililt:[2923,1601],
  willowmarch:[1613,2227], standbylightdrive:[4740,1580], cairntrot:[7874,1709], dumptruckdub:[1219,1726],
  tallowtrot:[2247,869], fathomarch:[2477,2941], masonshuffle:[309,2432], boilerroomstomp:[3523,2772],
  brinedub:[3536,1431], attichouse:[1994,2754], driftrot:[1926,1892], ceilingfanchop:[1034,2733],
  strawdub:[3577,4289], wickershimmy:[5311,2257], shellacsplice:[6871,916], gourdscuttle:[5815,744],
  auroragallop:[1970,3603], atticfanthrashsplice:[3039,1770], obelisktrot:[1164,2563], oakdublilt:[3593,4626],
  duststrut:[5024,4113], reedrush:[1856,3436], hearthsway:[1243,1538], graingroove:[1802,2059],
  hvacbop:[885,2258], moldcore:[1154,3102], hydracore:[7188,1730], ashfunk:[1412,2900],
  steamdub:[2653,1259], seraphswing:[6112,404], androidlament:[6692,2428], lasertemple:[4643,1752],
  oscillatorminuet:[4042,1258], cometwhistle:[8205,2234], chromepiston:[3530,3112], patchcordmirage:[8159,5576],
  velourregatta:[5868,1415], sorcerercape:[4467,3125]
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

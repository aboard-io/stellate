// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[5191,3869], neoclassical:[1109,480], vaporwave:[4028,1172], lofi:[656,1632],
  downtempo:[1241,1831], blues:[2540,5474], jazz:[457,3551], triphop:[744,2405],
  synthwave:[1912,1634], dancepop:[4422,978], edm:[3224,1760], house:[2825,5093],
  techno:[5537,6245], dubstep:[3809,4455], jungle:[4846,5379], dinosynth:[90,2973],
  canawave:[3670,987], transitwave:[1793,2088], dub:[5414,6641], trance:[3884,2338],
  disco:[3362,2752], italo:[4305,1373], bigbeat:[2087,3924], garage:[2529,5089],
  doomdrone:[3800,2913], newage:[1748,485], exotica:[594,2596], industrial:[4309,3873],
  spokenword:[495,2207], chiptune:[3366,1372], chinawave:[4478,2718], sovietwave:[1255,1059],
  citypop:[3764,1558], shibuyakei:[4407,1945], bossanova:[1172,3364], idm:[2470,3124],
  electro:[3468,3724], miamibass:[2449,3744], phonk:[3103,2553], witchhouse:[2674,2158],
  mallsoft:[4115,2720], wintersynth:[3521,3133], gabber:[4732,3965], psytrance:[4412,3684],
  minimal:[5474,6054], deephouse:[2941,5411], coldwave:[4569,1374], ebm:[4339,4460],
  krautrock:[3118,3527], newjack:[2897,1765], breakcore:[4406,4651], acidhouse:[3781,5448],
  surfrock:[3288,1570], spacelounge:[506,1057], arabpop:[740,3757], tango:[225,2594],
  desertblues:[2033,4132], sludgemetal:[2848,1185], industrialmetal:[3179,2340], darksynth:[2536,804],
  hogcore:[4404,4075], prelude:[973,90], atlantidrone:[5255,4066], sourdough:[5253,3677],
  crtwave:[5082,3485], whalejazz:[917,2024], termswave:[5018,2908], microwave:[2711,2365],
  airtrafficdrone:[5229,2516], faxbossa:[1527,2490], crickettempo:[1310,2020], thermostatwave:[5412,3300],
  holdmusic:[1176,2983], lunapolka:[5839,3095], elevatorcore:[1372,2686], hotsaucecore:[1054,4142],
  ikeacore:[5474,6437], zubrovia:[380,3751], dishwasherwave:[5606,7017], surveywave:[4831,2128],
  aldente:[5678,6820], umpirehouse:[4549,2915], pigeonstep:[2625,4513], dmvstep:[2454,4323],
  towncrier:[2275,3320], chickadeecore:[3427,4645], floppycore:[4672,5185], cerealwave:[4658,3482],
  laundrycore:[4102,4849], auctioncore:[4165,3492], dialupgabber:[3903,3683], afrobeat:[3250,4111],
  // fugue hand-nudged toward prelude after the 202-genre re-bake (explorer gate D2e: fugue's 3 nearest must include prelude; the relaxation left it 4th by ~50 units — slid 30% down the fugue->prelude line, min pair sep stays 312)
  fugue:[755,361], dnb:[3683,5028], footwork:[5289,5662], happyhardcore:[4833,3292],
  hardstyle:[3367,2530], eurodance:[4896,2324], singeli:[3396,3918], bebop:[1258,3555],
  bluegrass:[3914,1367], ska:[3842,418], klezmer:[156,2784], funk:[2743,2838],
  boombap:[491,1821], amapiano:[3112,5028], reggae:[959,1056], heavymetal:[636,864],
  budstep:[2737,3054], pixiewave:[3510,3516], picnicswing:[3254,796], cerealboxwave:[2116,997],
  rosinamblelilt:[412,1249], subwooferbalm:[2597,4898], sepiadrive:[678,3947], sparkbreak:[1720,3068],
  hopscotchwave:[888,1641], moltenhouse:[5619,5861], magmastrut:[3741,4265], hammerhouse:[3974,3111],
  zestgallop:[3756,2530], whittlertrot:[514,1440], bunkerthump:[3948,4067], gumballdrive:[4293,2136],
  kettlefunk:[5490,2903], glosspump:[3355,4836], refrigeratorfunk:[3299,1180], sherbetchop:[4161,4267],
  pinballchop:[3068,3135], idlingsplice:[2870,4706], trenchsway:[725,672], tarbreak:[4189,2912],
  cedarskank:[5958,3288], bramblestep:[1146,1247], toastercore:[4573,2523], vendingmachinethump:[4015,1753],
  boilercreep:[4801,3677], fluorescentstrut:[1394,676], dialtonehaze:[5386,2705], breadboxmince:[810,2793],
  earthmoversplice:[1659,2875], butterchurnbounce:[102,2398], furnacestrut:[98,3355], tectonicdash:[3187,987],
  tundradoom:[5911,2902], sodabop:[2791,3517], citrushaze:[5293,2323], confettililt:[1631,1826],
  willowmarch:[920,2603], standbylightdrive:[3096,2148], cairntrot:[4507,2327], dumptruckdub:[1067,1445],
  tallowtrot:[1323,868], fathomarch:[1521,3556], masonshuffle:[160,3164], boilerroomstomp:[2210,3518],
  brinedub:[2345,2934], attichouse:[1100,3174], driftrot:[1153,2215], ceilingfanchop:[691,3557],
  strawdub:[2464,5283], wickershimmy:[3168,3325], shellacsplice:[4095,1564], gourdscuttle:[3815,797],
  auroragallop:[1116,3951], atticfanthrashsplice:[1556,2278], obelisktrot:[644,2991], oakdublilt:[2474,5667],
  duststrut:[3178,5219], reedrush:[2086,3707], hearthsway:[820,1831], graingroove:[1071,2405],
  hvacbop:[482,2794], moldcore:[1068,3750], hydracore:[4181,2526], ashfunk:[647,3345],
  steamdub:[1552,1625], seraphswing:[3679,229], androidlament:[4044,3302], lasertemple:[2968,1957],
  oscillatorminuet:[2352,1574], cometwhistle:[5080,3102], chromepiston:[1602,3940], patchcordmirage:[5617,6627],
  velourregatta:[3429,1762], sorcerercape:[2782,4304], wizardcape:[1665,3747], meadowmellotron:[3217,2942],
  hexagonstampede:[2840,3724], crimsoncourt:[2667,3327], moonlagoon:[2680,2648], sliderule:[2784,995],
  crumpetwhirl:[334,2014], polygonforge:[3631,2723], moptoprattle:[3910,608], meadowjangle:[3808,2145],
  strawberryfog:[4868,2716], octopusminuet:[2756,1376], walrusfuzz:[2377,1187], rooftopholler:[3496,1954],
  submarinelullaby:[1236,282], tangerinearcade:[4488,1177]
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

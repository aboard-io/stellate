// world.js — the star map's LOGICAL coordinate space: the POS seed, the computed
// world bounds (WORLD_W/WORLD_H/MAP_CENTER, recomputed from POS extents), and the
// blend/space constants (SNAP/CUTOFF/BARS_PER_SEG) + progression vocabulary.
// No app imports: this is the geometric/constant foundation everything builds on.
export const POS={
  ambient:[2103,13302], neoclassical:[859,2784], vaporwave:[1691,4502], lofi:[263,9277],
  downtempo:[590,10667], blues:[1037,21967], jazz:[292,16726], triphop:[398,8037],
  synthwave:[859,9931], dancepop:[1826,3140], edm:[1209,9806], house:[1101,20620],
  techno:[1956,22436], dubstep:[1385,17832], jungle:[1718,20526], dinosynth:[289,14009],
  canawave:[1505,4099], transitwave:[749,12657], dub:[1887,23815], trance:[1581,9805],
  disco:[1355,12414], italo:[1784,5189], bigbeat:[880,15334], garage:[974,20620],
  doomdrone:[1568,12925], newage:[1064,2127], exotica:[396,12019], industrial:[1603,15773],
  spokenword:[217,12021], chiptune:[1347,7887], chinawave:[2097,8548], sovietwave:[648,7899],
  citypop:[1539,6465], shibuyakei:[1832,7198], bossanova:[554,12022], idm:[899,13312],
  electro:[1383,16167], miamibass:[1021,15336], phonk:[1384,8534], witchhouse:[1285,14109],
  mallsoft:[1873,8709], wintersynth:[1411,15469], gabber:[1809,17205], psytrance:[1691,14590],
  minimal:[1923,21823], deephouse:[1157,21320], coldwave:[1888,4502], ebm:[1605,18518],
  krautrock:[1186,15395], newjack:[1220,4767], breakcore:[1811,18518], acidhouse:[1405,21320],
  surfrock:[1315,6037], spacelounge:[315,4670], arabpop:[449,16719], tango:[142,12700],
  desertblues:[945,16032], sludgemetal:[1341,9213], industrialmetal:[1378,11043], darksynth:[1044,3450],
  hogcore:[1670,17170], prelude:[896,90], atlantidrone:[2133,13956], sourdough:[2138,12603],
  crtwave:[2067,11520], whalejazz:[430,7338], termswave:[2129,10842], microwave:[1276,5464],
  airtrafficdrone:[2191,9245], faxbossa:[623,11346], crickettempo:[748,8634], thermostatwave:[2205,11931],
  holdmusic:[555,13337], lunapolka:[2399,11263], elevatorcore:[618,9977], hotsaucecore:[673,18075],
  ikeacore:[1923,23134], zubrovia:[364,17425], dishwasherwave:[1968,25160], surveywave:[2011,7366],
  aldente:[2001,24486], umpirehouse:[1735,12741], pigeonstep:[1052,17952], dmvstep:[1014,17387],
  towncrier:[1026,13988], chickadeecore:[1355,18505], floppycore:[1681,19828], cerealwave:[1913,14117],
  laundrycore:[1556,19248], auctioncore:[1647,15288], dialupgabber:[1423,11742], afrobeat:[1232,17523],
  // fugue hand-nudged into the classical corner after the 228-genre re-bake (explorer gate D2e: fugue's 3 nearest must include prelude; the relaxation packed it out toward newage/picnicswing — grid-searched under the gate's own constraints to a spot whose 3 nearest are prelude/cloisterloom/submarinelullaby, min sep 700). breakcore/budstep/patchcordmirage each nudged ~120 units off their bake spots: the relaxation left them 86-89.5 from ebm/idm/dub, under MIN_SEP_FLOOR 90 (min pair after nudges: 106.6, funk/octopusminuet).
  fugue:[196,90], dnb:[1376,19860], footwork:[1838,21125], happyhardcore:[1992,10036],
  hardstyle:[1379,9806], eurodance:[2026,9339], singeli:[1267,16846], bebop:[694,14061],
  bluegrass:[1618,5199], ska:[1560,2064], klezmer:[113,13376], funk:[1030,7806],
  boombap:[205,10649], amapiano:[1223,19961], reggae:[508,4670], heavymetal:[430,3999],
  budstep:[1090,13377], pixiewave:[1470,14513], picnicswing:[1234,2088], cerealboxwave:[987,5821],
  rosinamblelilt:[361,5351], subwooferbalm:[1004,19962], sepiadrive:[517,17394], sparkbreak:[720,13301],
  hopscotchwave:[363,11293], moltenhouse:[1990,17867], magmastrut:[1491,17116], hammerhouse:[1674,12043],
  zestgallop:[1389,13071], whittlertrot:[317,6013], bunkerthump:[1526,16509], gumballdrive:[1737,9378],
  kettlefunk:[2296,10590], glosspump:[1325,19181], refrigeratorfunk:[1360,4736], sherbetchop:[1573,17887],
  pinballchop:[1187,11057], idlingsplice:[1118,18651], trenchsway:[611,2630], tarbreak:[1704,8505],
  cedarskank:[2439,11964], bramblestep:[593,5882], toastercore:[1738,7896], vendingmachinethump:[1712,6561],
  boilercreep:[1856,14797], fluorescentstrut:[669,4528], dialtonehaze:[2223,9892], breadboxmince:[362,8656],
  earthmoversplice:[829,11941], butterchurnbounce:[90,11320], furnacestrut:[261,16040], tectonicdash:[1248,3450],
  tundradoom:[2474,10565], sodabop:[1247,13557], citrushaze:[2262,8548], confettililt:[652,9278],
  willowmarch:[398,10681], standbylightdrive:[1107,11608], cairntrot:[1931,8010], dumptruckdub:[596,7260],
  tallowtrot:[637,5204], fathomarch:[805,14000], masonshuffle:[164,15342], boilerroomstomp:[991,14661],
  brinedub:[942,12636], attichouse:[636,14739], driftrot:[587,8616], ceilingfanchop:[467,15416],
  strawdub:[1004,21288], wickershimmy:[1247,14807], shellacsplice:[1678,5888], gourdscuttle:[1536,3401],
  auroragallop:[696,16784], atticfanthrashsplice:[794,11310], obelisktrot:[327,12666], oakdublilt:[1007,22664],
  duststrut:[1255,20605], reedrush:[838,14658], hearthsway:[370,6712], graingroove:[426,9354],
  hvacbop:[322,14708], moldcore:[588,16087], hydracore:[1706,10048], ashfunk:[496,14713],
  steamdub:[830,7917], seraphswing:[1438,1394], androidlament:[1653,10719], lasertemple:[1164,12307],
  oscillatorminuet:[1016,6498], cometwhistle:[1706,11390], chromepiston:[740,16094], patchcordmirage:[2077,23742],
  velourregatta:[1493,7121], sorcerercape:[1062,16689], wizardcape:[702,15407], meadowmellotron:[1089,8546],
  hexagonstampede:[1137,16093], crimsoncourt:[1124,12859], moonlagoon:[1463,10556], sliderule:[1180,4166],
  crumpetwhirl:[254,13365], polygonforge:[1468,12226], moptoprattle:[1590,2733], meadowjangle:[1532,7820],
  strawberryfog:[1884,13440], octopusminuet:[1128,7848], walrusfuzz:[801,7257], rooftopholler:[1275,6606],
  submarinelullaby:[879,1458], tangerinearcade:[1856,3839], chalkvespers:[1717,16539], salondawdle:[781,3854],
  candlegauze:[1097,2798], cloisterloom:[835,759], miasmarow:[1465,13769], greasepaintoompah:[1106,10359],
  urchinmatinee:[1896,5863], marblefury:[520,12691], perukelotto:[1871,10710], beakstampede:[760,10612],
  velvetconveyor:[1926,5200], talcumcasino:[1499,8484], capesnap:[1168,9107], chromeufo:[1159,19264],
  mirrorseven:[234,9946], sundialsyrup:[191,7990], sequinfreight:[1231,7273], rollerlacquer:[1289,2784],
  longshipwhip:[576,3328], bogironwallow:[767,6563], barrowwake:[1705,13421], ravensquall:[1544,9204],
  runeromp:[466,9962], meadhallbellow:[461,14061], valkyrieswoop:[549,6571], permafrostveil:[1635,14120]
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
export const SNAP=64, CUTOFF=430, BARS_PER_SEG=256;   // one path leg ≈ 256 bars — genres evolve slowly, almost imperceptibly
// (128 -> 256 on 2026-07-10: the blend-arrival fix made flips actually LAND —
// drums in 3 bars, identity in 7 — so the old pace suddenly read as "way too
// fast" (Paul). The default doubles and the pace slider now reaches 4096 for
// hours-long, nearly-geological journeys.)
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

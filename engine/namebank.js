// namebank.js — the fake-music-industry name generator, shared by the video
// credits (render-sample-video.js) and the CONSTELLATE chyron (explorer.html).
//
// Everything here is DETERMINISTIC from whatever seed you hand it: same
// seed + genre -> same band, same record, same touring lineup; change the
// lead-synth model mid-journey and only the player on that instrument
// changes (the lineup hash includes the instrument's model). No real
// artists were harmed: every name is invented.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.NameBank = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // ---- per-genre band/title banks (moved from render-sample-video.js) ----
  const NAMEBANK = {
    transitwave: {
      bands: ["The Commuters", "Northbound Express", "Third Rail", "The Brakemen", "Pantograph",
              "Night Service", "The Turnstiles", "Rolling Stock", "The Signalmen", "Interurban",
              "Catenary", "The Vestibules", "Penn Station", "The Sidings", "Standard Time"],
      titles: ["The 8 02 Local", "Last Train North", "Mind The Gap", "Standing Room Only",
               "Express To Nowhere", "Track Nine", "Now Departing", "The Overnight", "Delayed",
               "All Stations", "Regional Service", "Doors Closing", "The Last Connection"],
      albums: ["Timetable", "Off Peak", "The Fare Zone Sessions", "Terminal City", "Peak Service"],
      era: [1979, 1994],
    },
    canawave: {
      bands: ["The Loons", "True North", "The Maple Kings", "Northern Lights", "The Two-Fours",
              "The Zambonis", "Great White", "The Territories", "The Portage"],
      titles: ["True North", "Sorry Aboot That", "Centre Ice", "Coast To Coast", "The Overtime",
               "Out For A Rip", "The Long Weekend"],
      albums: ["Both Official Languages", "The Trans-Canada Tapes", "Loonie", "Shield Country"],
      era: [1988, 2004],
    },
    dinosynth: {
      bands: ["The Sauropods", "Tar Pit", "The Cretaceous", "Bone Valley", "Pangaea",
              "The Pterosaurs", "Amber", "The Rex", "Primordial"],
      titles: ["The Mesozoic", "Extinction Event", "Amber", "Bone Valley", "The Long Sleep", "Tar"],
      albums: ["Fossil Record", "Strata", "Before The Comet", "Jurassic Ballroom"],
      era: [1993, 1999],
    },
    synthwave: {
      bands: ["Night Drive", "Neon Voltage", "The Outrun", "Chrome", "Sunset Patrol", "Turbo",
              "Miami Nights", "Afterburner"],
      titles: ["Night Drive", "Neon Mirage", "Afterburner", "Midnight Run", "Outrun", "Chrome Heart"],
      albums: ["VHS Sunset", "Grand Prix", "Palm Grid", "Turbo City OST"],
      era: [1984, 1989],
    },
    vaporwave: {
      bands: ["The Atrium", "Plaza Level", "Marble", "Food Court", "Muzak", "The Fountain", "Escalator"],
      titles: ["Mall Hours", "Eternal Atrium", "Plaza Level", "Closing Time", "Free Sample", "Fountain"],
      albums: ["ＭＡＬＬ ＥＴＥＲＮＡＬ", "Directory Of Shops", "Water Feature", "Grand Opening 1987"],
      era: [1986, 1995],
    },
    techno: {
      bands: ["Model 909", "The Assembly Line", "Klangwerk", "Cold Storage", "Grid Reference",
              "Voltage Control", "Detroit Axis", "The Conveyor", "Ostbahnhof", "Sequencer Trust"],
      titles: ["Four To The Floor", "Machine Funk", "Warehouse District", "Pattern 33",
               "Motor City Transmission", "Concrete", "Sunday Morning Berlin", "Filter Sweep"],
      albums: ["Warehouse Findings", "Grid Reference EP", "Plant Two", "Axis Tooling"],
      era: [1991, 1999],
    },
    house: {
      bands: ["The Warehouse Deacons", "Jack Trax", "The Southside Preachers", "Piano Stab",
              "The Hydraulics", "Boiler Suit", "Deep Garden", "The 707s", "Sunday Congregation"],
      titles: ["Jack Your Body Gently", "Can You Feel It Still", "The Whistle Track",
               "Deep In My House", "Move To The Music", "House Nation Rising", "Promised Land Layover"],
      albums: ["Sermons Vol. 2", "The Basement Tapes", "Congregation", "Deep Garden Grooves"],
      era: [1987, 1996],
    },
    jungle: {
      bands: ["The Amen Brothers", "Pirate Signal", "Junglist Sound System", "Rewind Selecta",
              "MC Hologram", "The Breakbeat Kru", "Darkside Crew", "Tape Pack", "Babylon Timestretch"],
      titles: ["Chopped Amen", "Timestretch Riddim", "Babylon Falling", "Big Up The Massive",
               "Inna London Style", "Pirate Radio Skyline", "Dark Jungle Technique"],
      albums: ["Tape Pack 94", "Rewind Culture", "Signal Intrusion", "Junglist Manifesto"],
      era: [1993, 1997],
    },
    triphop: {
      bands: ["The Grey Harbour", "Bristol Fog", "Half Speed", "Slow Vinyl", "Smoke Signal",
              "The Wurlitzer Ghosts", "Rainy Docks", "Theremin Social Club"],
      titles: ["Cigarette Static", "Grey Skies Over Bristol", "Nicotine Rain", "The Comedown",
               "Vinyl Crackle Lullaby", "Harbour Lights At Three AM", "Undertow"],
      albums: ["Overcast", "The Docklands Sessions", "Half Speed", "Fog Warning"],
      era: [1994, 1999],
    },
    lofi: {
      bands: ["Bedroom Tapes", "Sleepy Cassette", "Rainy Window", "Tape Hiss Society",
              "Warm Static", "The Procrastinators", "Notebook Doodle", "Sunday Homework"],
      titles: ["Beats To Fail Exams To", "Raining On My Notes", "Coffee Gone Cold",
               "Missed Lecture", "Snooze Button", "Dusty Piano Loop", "Homework Forever"],
      albums: ["Study Guide", "Side B (Rainy)", "Overdue", "Warm Static Vol. 3"],
      era: [2015, 2024],
    },
    downtempo: {
      bands: ["The Chillout Tent", "Sunset Terrace", "Balearic Standard", "Horizontal Living",
              "Poolside Diplomats", "Velour", "The Lounge Correspondents", "Ambassadors Of Chill"],
      titles: ["Sunset Over The Marina", "Do Not Disturb", "Infinity Pool", "Second Mojito",
               "Horizontal By Noon", "Checkout Is At Eleven", "Frequent Flyer Lounge"],
      albums: ["Café Del Nowhere Vol. 7", "Late Checkout", "Terrace Hours", "Selected Sunsets"],
      era: [1996, 2004],
    },
    ambient: {
      bands: ["Discreet Systems", "Airport Chapel", "The Still Room", "Slow Light",
              "Tape Loop Garden", "North Of Silence", "Glacial Drift", "The Hum"],
      titles: ["An Hour Of Almost Nothing", "Stillness In Four Parts", "The Room Breathes",
               "Fog On Glass", "Nothing Happens Twice", "One Long Note"],
      albums: ["Music For Waiting Rooms", "Stilleben", "Slow Light II", "The Long Now"],
      era: [1978, 2002],
    },
    neoclassical: {
      bands: ["The Felt Piano", "Prepared Piano Society", "Rosin", "Cellophane Quartet",
              "The Una Corda Club", "Winter Recital", "Grand Salon", "The Metronomes"],
      titles: ["Etude For Falling Snow", "Variations On A Sigh", "The Felt Hammer",
               "Nocturne In Reverse", "Sonata For Empty Hall", "Piano And Rain", "String Quartet No 9"],
      albums: ["Recital", "The Winter Programme", "Felt & Ivory", "Salon Pieces"],
      era: [2008, 2022],
    },
    dancepop: {
      bands: ["Chart Position", "The Hook Factory", "Radio Edit", "Girl Group Theory",
              "Focus Group", "The Choreography", "Bubblegum Complex", "Stadium Crush"],
      titles: ["Call Me Back Tonight", "Dance Til The Radio Dies", "Heartbreak On Repeat",
               "One More Chorus", "Kiss Me On The Drop", "Love Song Formula"],
      albums: ["Now That's What We Call Us", "The Hits (So Far)", "Deluxe Edition", "Platinum"],
      era: [1998, 2012],
    },
    edm: {
      bands: ["The Drop Committee", "Festival Wristband", "Confetti Cannon", "Big Room Energy",
              "The Riser", "Hands Up Collective", "Neon Cathedral", "Mainstage Pilgrims"],
      titles: ["Put Your Hands Up Again", "The Drop Is Coming", "Festival Sunrise",
               "Ten Thousand Strobes", "Epic Build Forever", "Confetti At Dawn", "Headliner"],
      albums: ["Mainstage Anthems 4", "Festival Season", "ID (Unreleased)", "The Big Room"],
      era: [2010, 2016],
    },
    dubstep: {
      bands: ["Wobble Merchants", "The Bass Face", "Sub Frequency", "South London Pressure",
              "Speaker Damage", "The LFO Brothers", "Half Step Massive", "Filth Ltd"],
      titles: ["Face Melt Protocol", "The Wobble Function", "Sub Bass Sermon", "System Overload",
               "Speaker Cone Funeral", "Ten Ton Bass"],
      albums: ["Croydon Pressure Plates", "System Test", "140 & Rising", "Low End Theory Hour"],
      era: [2006, 2013],
    },
    blues: {
      bands: ["Crossroads Slim", "Delta Freight", "The Juke Joint Ramblers", "Catfish Johnson",
              "Reverend Dust", "Boxcar Lucille", "The 78 Sinners", "Mississippi Wire"],
      titles: ["Woke Up This Mornin Blues", "Crossroads At Midnight", "My Baby Done Left",
               "Dust Bowl Rag", "Levee Water Rising", "Broke Down Engine Blues", "Gravel Road Moan"],
      albums: ["Shellac Sides 1932-38", "Juke Joint Live", "The Field Recordings", "78 RPM"],
      era: [1932, 1958],
    },
    jazz: {
      bands: ["The Blue Note Irregulars", "Midnight Quintet", "The Flat Fifth", "Smoke Ring Trio",
              "The Chord Changers", "After Hours Ensemble", "The Uptown Sextet", "Half Diminished"],
      titles: ["Round About Two AM", "Take The B Train", "Blues For The Rent",
               "Solo Over The Changes", "Bebop Til Dawn", "The Last Set", "Flat Fifth Avenue"],
      albums: ["Live At The Half Note (Set Two)", "Blue Circuit", "The Lost Session", "Mono Masters"],
      era: [1955, 1967],
    },
    spokenword: {
      bands: ["The Typewriter Poets", "Third Rail Reading Series", "The Beat Cellar",
              "Mimeograph", "The Coffeehouse Prophets", "Loose Leaf", "The Open Mic Saints"],
      titles: ["Poem For The Rent", "Howl-Adjacent", "First Thought Best Thought",
               "Cigarettes & Semicolons", "The Reading Ran Long", "Snaps For The Poet"],
      albums: ["Live From The Basement Reading", "Uncollected Poems", "The Chapbook Tapes"],
      era: [1959, 1977],
    },
    // ---- genre expansion round 3 (29 additions) ----
    citypop: {
      bands: ["Plastic Harbor", "Midnight Skyline", "The Cassette Girls", "Tokyo Freeway", "Neon Marina", "Silk Sedan", "The Penthouse Band", "Airport Lounge", "Crystal City", "Magic Hour"],
      titles: ["Stay With Me Tonight", "Plastic Love Letter", "Midnight Coast Road", "Windward City", "Sparkling Avenue", "Summer Connection", "Harbor Lights"],
      era: [1979, 1988],
    },
    shibuyakei: {
      bands: ["The Sunday Swingers", "Petit Camera", "Bonjour Satellite", "The Marshmallow Set", "Cherry Typewriter", "Picnic Society", "The Go Go Kittens", "Soda Fountain Five", "Parasol Parade"],
      titles: ["Sweet Soda Pop", "A Picnic On The Moon", "Hello Hello Tokyo", "Sugar Cube Serenade", "The Cutest Getaway", "Bossa For Beginners", "Candy Coated Morning"],
      era: [1994, 2001],
    },
    bossanova: {
      bands: ["The Ipanema Set", "Sunset Quartet", "Copacabana Social Club", "The Nylon Strings", "Verao Trio", "The Quiet Tide", "Garota Moderna", "Saudade Society"],
      titles: ["One Note Sunset", "Quiet Waves", "The Girl From Nowhere", "Soft Sand Slow Day", "Saudade At Six", "Corcovado Evening"],
      era: [1959, 1968],
    },
    idm: {
      bands: ["Fax Arithmetic", "The Bedroom Scientists", "Pattern Buffer", "Aphelion Twin Systems", "Broken Grid Collective", "Windowlicker Union", "The Glitch Cartographers", "Stray Voltage", "Nonlinear Committee"],
      titles: ["Recursive Lullaby", "Error Corrected Heart", "Sixteen Bit Weather", "Polygon Garden", "Unstable Tables", "Drukqs For Beginners", "The Algorithm Dreams"],
      era: [1994, 2003],
    },
    electro: {
      bands: ["Robot Funk Council", "The Linn Dreamers", "Chrome Circuit", "Planet Patrol Unit", "Vocoder City", "The Breakdancers Union", "Kraft Signal", "Electric Boulevard", "Neon Linoleum"],
      titles: ["Robot Rock The Block", "Clear As Chrome", "Planet Bounce", "Electric Avenue 1982", "The Vocoder Speaks", "Breakin On Cardboard", "Signal To The Streets"],
      era: [1982, 1988],
    },
    miamibass: {
      bands: ["Trunk Rattle Crew", "The 808 Kings", "Ocean Drive Bass Club", "Booming System", "The Low End Boys", "Biscayne Bass Machine", "Subwoofer Society", "Magic City Shakers"],
      titles: ["Shake The Trunk", "Bass So Low", "Ocean Drive Cruise", "Turn Up The 808", "Whoomp Whoomp", "All The Way Down", "Biscayne Bounce"],
      era: [1986, 1994],
    },
    phonk: {
      bands: ["Graveyard Tape Club", "The Memphis Ghosts", "Cowbell Cult", "Slowed Cadillac", "Tape Hiss Mafia", "The Purple Static", "Devil Shift Drift", "Midnight Pallbearers"],
      titles: ["Ride Slow Tape One", "Cowbell At Midnight", "Ghost In The Chevy", "Hiss And Menace", "Drift All Night", "Memphis Fog"],
      era: [2015, 2023],
    },
    witchhouse: {
      bands: ["Drowned Choir", "The Salem Frequencies", "Cold Candles", "Glass Coffin Club", "Static Seance", "The Slow Cathedral", "Veiled Signal", "Midnight Triangle Society"],
      titles: ["Drowned Cathedral", "Slow Black Water", "Candles At The Tone", "A Seance On Tape", "Veil After Veil", "The Triangle Hums"],
      era: [2010, 2016],
    },
    mallsoft: {
      bands: ["The Fountain Court", "Atrium Eternal", "Escalator Music Ltd", "Food Court Dreams", "The Closed Wing", "Palm Planter Society", "Directory Kiosk", "The Empty Anchor Store"],
      titles: ["The Mall Will Close In Ten Minutes", "Fountain Level Two", "Empty Atrium Sunday", "Skylight Forever", "Last Escalator Home", "Directory Of Dreams"],
      era: [2012, 2020],
    },
    wintersynth: {
      bands: ["The Frost Court", "Pine Barrow", "Glacier Chapel", "The Long Snows", "Northwind Keep", "Icicle Choir", "The Silent Drifts", "Aurora Vault"],
      titles: ["Snow On The Old Road", "The Frost Court Sleeps", "Bells Under Ice", "A Lantern In The Pines", "First Thaw Never Comes", "White Silence"],
      era: [2014, 2022],
    },
    gabber: {
      bands: ["Rotterdam Wrecking Crew", "The Hammer Brigade", "Terror Kick Unit", "Distortion Cathedral", "The 909 Riot", "Hakken Machine", "Concrete Uppercut", "Total Kick Damage"],
      titles: ["Hammer Of Rotterdam", "Kick Drum Warfare", "Hakken Till Dawn", "Distort Everything", "One Hundred Eighty", "No Mercy Mainstage"],
      era: [1993, 1999],
    },
    psytrance: {
      bands: ["Goa Perimeter", "The Third Eye Engine", "Fractal Caravan", "Full Moon Circuit", "Serpent Frequency", "The Desert Portal", "Astral Plumbing", "Neon Shaman Collective"],
      titles: ["Full Moon At The Perimeter", "Serpent Bassline", "Portal Opens At Dawn", "Fractal Sunrise", "The Rolling Line", "Third Eye Traffic"],
      era: [1996, 2005],
    },
    minimal: {
      bands: ["Click And Cut", "The Empty Room", "Reduction Bureau", "Berghain Waiting Room", "One Kick Collective", "The Sparse Committee", "Grey Area Audio", "Less Than Less"],
      titles: ["Almost Nothing", "One Kick Is Enough", "The Space Between Hits", "Grey Room Groove", "Subtract Until True", "Four AM Restraint"],
      era: [2002, 2010],
    },
    deephouse: {
      bands: ["The Basement Congregation", "Deep Garden Society", "After Midnight Collective", "Velvet Sub Club", "The Low Lights", "Warm Vinyl Union", "Submerged Piano Trust", "The Quiet Groove"],
      titles: ["Deep In The Low Lights", "Warmth After Midnight", "Submerged Chords", "The Long Night In", "Velvet Pressure", "Basement Communion"],
      era: [1990, 1998],
    },
    coldwave: {
      bands: ["Grey Rain Bureau", "The Concrete Poets", "Minor Winter", "Cassette Silhouettes", "The Distant Party", "Iron Curtain Youth", "Palais Des Regrets", "The Unheated Room"],
      titles: ["Grey Rain On Grey Streets", "A Party In Another Room", "Winter Of The Mind", "Cassette From Nowhere", "The Heating Is Broken", "Distance Forever"],
      era: [1980, 1986],
    },
    ebm: {
      bands: ["Body Command", "The Piston Youth", "Assembly Required", "Front Line Circuit", "Muscle And Wire", "The Correction Facility", "Absolute Torque", "Discipline Unit Nine"],
      titles: ["Body To Body Work", "Piston Logic", "March Of The Sequencers", "Muscle Memory Machine", "Discipline And Bass", "Torque It Harder"],
      era: [1984, 1992],
    },
    krautrock: {
      bands: ["Autobahn Kilometer", "The Motorik Farmers", "Kosmische Kuriere", "Dingerland Express", "The Harmonium Barn", "Neu Perpetuum", "Kilometerstein 42", "The Endless A Side"],
      titles: ["Kilometer After Kilometer", "The Road Repeats Itself", "Harmonium Sunrise", "One Chord To Dusseldorf", "Perpetual Forward", "Exit Never Taken"],
      era: [1971, 1977],
    },
    newjack: {
      bands: ["The Swing Committee", "Teddy Bounce Machine", "New Attitude City", "The Clap Factory", "Uptown Remedy", "Smooth Criminal Division", "The Groove Professors", "Right On Time Crew"],
      titles: ["Clap On The Two", "New Attitude Bounce", "Right On Time Tonight", "Swing My Way Uptown", "The Remedy Groove", "Poison Antidote"],
      era: [1988, 1993],
    },
    breakcore: {
      bands: ["Amen Demolition Crew", "The Splice Terrorists", "Kernel Panic Sound", "Drill Sergeant Disco", "The Chopped Prophets", "Maximum Splinter", "Ragga Wreckage Unit", "Two Hundred And Rising"],
      titles: ["Two Hundred Beats Of Panic", "The Amen Shredder", "Splice Everything Twice", "Kernel Panic Riddim", "Maximum Chop Velocity", "Drill Till Dawn"],
      era: [1998, 2008],
    },
    acidhouse: {
      bands: ["The 303 Preservation Society", "Smiley Warehouse Crew", "Squelch Committee", "Second Summer Club", "The Resonance Peakers", "Roland Misuse Union", "Acid Ted And Friends", "The Wobble Knob"],
      titles: ["Squelch All Night", "Second Summer Of Love", "Turn The Silver Knob", "Warehouse Smiley Face", "Acid Tracks Revisited", "The Machine Misused"],
      era: [1988, 1992],
    },
    surfrock: {
      bands: ["The Reverb Tides", "Spring Tank Five", "The Woodie Wagons", "Point Break Trio", "The Tremolo Kings", "Pipeline Patrol", "The Wet Suits", "Miserlou Beach Club"],
      titles: ["Ride The Spring Tank", "Twang At The Point", "Wipeout Revisited", "Tremolo Tide", "The Big Curl", "Surfin The Third Reverb"],
      era: [1962, 1966],
    },
    spacelounge: {
      bands: ["The Theremin Bachelors", "Cocktail Orbit", "Velvet Cosmonauts", "The Martini Modulators", "Zero Gravity Trio", "Console And Coupe", "The Saturn Lounge Act", "Apollo After Hours"],
      titles: ["Martini In Orbit", "Theremin For Two", "Zero Gravity Cocktail", "The Bachelor Pad Nebula", "Softly To Saturn", "Houston Pour Me Another"],
      era: [1958, 1964],
    },
    arabpop: {
      bands: ["Cairo Nights Orchestra", "The Hijaz Line", "Nile Delta Strings", "Habibi Frequency", "The Oud Electric", "Casbah Modern", "Desert Rose Ensemble", "The Maqam Brothers"],
      titles: ["Habibi On The Radio", "Nights On The Nile", "The Hijaz Motorway", "Desert Rose Disco", "Casbah After Dark", "A Thousand And One Beats"],
      era: [1975, 1995],
    },
    tango: {
      bands: ["The Habanera Cell", "Milonga Del Norte", "The Sharp Lapels", "Boca Junction Quartet", "Duelo Y Compas", "The Buenos Aires Wire", "Salon Obsidian", "Cortina Club"],
      titles: ["The Habanera At Midnight", "Sharp Steps Sharp Suits", "A Duel In Three Minutes", "Salon Of Long Shadows", "The Last Cortina", "Dust On The Dance Floor"],
      era: [1935, 1955],
    },
    afrobeat: {
      bands: ["Lagos Traffic Authority", "The Interlock Orchestra", "Kalakuta Groove Republic", "Tenor Horn Assembly", "The Long Groove Party", "Shrine Frequency", "Afrika Seventy Postal", "The Polyrhythm Ministry"],
      titles: ["Traffic Jam Groove", "One Chord One Hour", "The Interlock Anthem", "Horns Of The Republic", "Shrine Night Session", "Water No Get Enemy Dub"],
      era: [1971, 1980],
    },
    desertblues: {
      bands: ["Sahara Wire Choir", "The Dune Guitars", "Tamasheq Circles", "Camel Train Electric", "The Oasis Amplifier", "Sandstorm Assembly", "The Turning Riff", "Blue Robes Band"],
      titles: ["The Riff Circles The Fire", "Electric Dune Song", "Water And Distance", "Blue Robes At Dusk", "The Long Sand Road", "One String Sunrise"],
      era: [2001, 2015],
    },
    sludgemetal: {
      bands: ["Tar Lung", "The Bog Kings", "Ninety Weight", "Swamp Amplifier Cult", "The Slow Crush", "Iron Molasses", "Bayou Furnace", "The Downtuned Congregation"],
      titles: ["Crawl Through The Tar", "Ninety Weight Riff", "The Amp Is Melting", "Molasses March", "Bog Water Baptism", "Slower Lower Louder"],
      era: [1992, 2002],
    },
    industrialmetal: {
      bands: ["The Quantized Fist", "Machine Shop Choir", "Piston Head Assembly", "The Grinding Floor", "Sheet Metal Prophets", "Downward Spiral Union", "The Riveters", "Factory Reset Nine"],
      titles: ["The Machine Slams Back", "Quantized Rage", "Sheet Metal Hymn", "Grind The Floor Down", "Head Like A Piston", "Factory Of Teeth"],
      era: [1992, 1999],
    },
    darksynth: {
      bands: ["Blood Circuit", "The Neon Executioners", "Perturbator Youth", "Chase Scene Cartel", "The Crimson Grid", "Night Stalker Division", "Carpenter Protocol", "The Violent Sunset"],
      titles: ["The Chase Never Ends", "Crimson Grid Lockdown", "Neon Blood Run", "Night Stalker Theme", "Protocol Midnight", "Sunset With Teeth"],
      era: [2014, 2021],
    },
  };
  const GENERIC = {
    bands: ["The Frequencies", "Analog", "Half Light", "The Reverbs", "Slow Motion", "The Phantoms",
            "Cassette", "The Drift"],
    titles: ["Untitled", "Slow Fade", "Reverie", "Night Loop", "The Long Way", "Drift"],
    albums: ["Self Titled", "Volume II", "The Archive Tapes", "Anthology", "Demos & Rarities"],
    era: [1971, 2024],
  };

  // fake imprints — the LABEL slot on the chyron
  const LABELS = ["ROYAL ROAD", "Atrium Recordings", "Found Sound Freight", "Laserdisc Ltd.",
    "Wurlitzer & Sons", "Grey Harbour Wax", "Interurban Records", "Plaza Level Music",
    "Tape Pack International", "The Reading Room", "Neon Cathedral Discs", "Discreet Systems Audio"];

  // ---- album-name generator: bank albums + per-mood constructions ----
  const ALBUM_PATTERNS = [
    (b, r) => pick(r, b.albums || GENERIC.albums),
    (b, r) => "Live At " + pick(r, ["The Atrium", "The Warehouse", "Track Nine", "The Half Note",
      "The Chillout Tent", "The Food Court", "The Terminal", "The Basement Reading"]),
    (b, r) => "The " + pick(r, ["Lost", "Late", "Long", "Second", "Quiet", "Borrowed"]) + " " +
              pick(r, ["Sessions", "Tapes", "Broadcasts", "Recordings", "Years"]),
    (b, r) => pick(r, b.titles) + " (Deluxe Reissue)",
    (b, r) => "Greatest Hits Vol. " + (1 + irnd(r, 4)),
  ];

  // ---- musicians: honorific/nickname/first/last pools + role flavor ----
  const FIRST = ["Lonnie", "Renata", "Dizzy", "Wanda", "Cornell", "Vernon", "Yuki", "Marisol",
    "Otis", "Sable", "Dmitri", "Coco", "Harlan", "Bix", "Ramona", "Cassius", "Twyla", "Jerome",
    "Astrid", "Rufus", "Kiki", "Mortimer", "Delia", "Percy", "Ingrid", "Roosevelt", "Fumiko",
    "Aldous", "Petra", "Wendell", "Zora", "Chet", "Odessa", "Gunnar", "Pearl"];
  const LAST = ["Fairchild", "Vandermeer", "Quintrell", "LaRue", "Delgado", "Moon", "Hobbes",
    "Petrov", "Marsh", "Okafor", "Tanaka", "Beaumont", "Ostrowski", "Callowhill", "Greaves",
    "Mercier", "Halliday", "Strand", "Okada", "Villanueva", "Thistlewood", "Kowalczyk",
    "Renfrew", "Abernathy", "Duval", "Sorensen"];
  const NICK = ["Slick", "Fingers", "Sleepy", "Static", "Velvet", "Two-Tone", "Sparky",
    "Midnight", "Butter", "Cricket", "Fog", "Half-Note", "Pockets", "Sputnik", "Tugboat",
    "Cinnamon", "Freight", "Tremolo"];
  const HONOR = ["The Rev.", "Dr.", "Professor", "Madame", "Old Man", "Lil'", "Sister", "Captain"];
  const DJ = ["DJ Cardboard", "DJ Fire Exit", "DJ Third Shift", "DJ Photocopy", "MC Hologram",
    "DJ Lost Luggage", "Selecta Ozone", "DJ Dial Tone", "MC Paperweight", "DJ Escalator"];
  const ROBOT = ["Unit 7", "The Chorus Engine", "VC-32 'The Congregation'", "Talkbox Tabernacle",
    "The Voltage Choir", "Automaton Nine"];

  // ---- deterministic helpers ----
  function hash(...parts) {
    let h = 2166136261 >>> 0;
    for (const p of parts) for (const c of String(p)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { let a = seed >>> 0; return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const irnd = (r, n) => Math.floor(r() * n);

  // ---- the algorithmic GENRE namer (used by tools/invent-genres.js) ----
  // A ridiculous-but-legible name that CORRELATES to a feature vector: a
  // TEXTURE/MOOD prefix (the dominant non-tempo trait) fused with a TEMPO/RHYTHM
  // suffix. Deterministic from (traits, seed). Two registers: "elemental" and
  // "mundane" (the appliance whimsy of dishwasherwave/thermostatwave/holdmusic).
  // traits = { texture, tempo, rhythm } string tags; the caller derives them
  // from the measured feature vector. Guessable: prefix says what it's MADE of,
  // suffix says how FAST/how it MOVES.
  const NAME_PREFIX = {
    elemental: {
      wash: ["fog","haze","mist","vapor","drift","cloud","steam","murk","brine"],
      dust: ["dust","shellac","attic","sepia","mold","grain","tallow","ash"],
      acoustic: ["oak","reed","rosin","gourd","cedar","hearth","straw","willow","bramble"],
      synth: ["chrome","neon","laser","plexi","xenon","argon","enamel","halogen"],
      sub: ["magma","trench","boiler","tectonic","bunker","fathom","tar","molten"],
      swarm: ["swarm","choir","seraph","hydra","prism","aurora","glass"],
      slam: ["anvil","piston","forge","thresh","slab","rivet","hammer","grind"],
      drone: ["monolith","glacier","tundra","stasis","obelisk","cairn","basalt"],
      bright: ["citrus","soda","sherbet","confetti","gloss","spark","zest"],
    },
    mundane: {
      wash: ["humidifier","aquarium","poolside","sprinkler","dishwasher","kettle"],
      dust: ["gramophone","fireplace","atticfan","chalkboard","mothball","cardigan"],
      acoustic: ["breadbox","porch","picnic","butterchurn","whittler","mason"],
      synth: ["photocopier","fluorescent","laminator","modem","screensaver","toner"],
      sub: ["furnace","subwoofer","boilerroom","earthmover","idling","dumptruck"],
      swarm: ["chandelier","greenhouse","planetarium","aviary","stainedglass"],
      slam: ["jackhammer","stapler","tumbledry","forklift","garbagedisposal"],
      drone: ["refrigerator","ceilingfan","dialtone","standbylight","thermostat","hvac"],
      bright: ["vendingmachine","pinball","cerealbox","toaster","hopscotch","gumball"],
    },
  };
  const NAME_SUFFIX = {
    crawl: ["drone","doom","sludge","void","dirge","tar","creep"],
    slow: ["lull","sway","dub","soul","haze","step","balm"],
    mid: ["groove","bop","strut","wave","funk","trot","amble"],
    drive: ["stomp","drive","pump","house","thump","march","chug"],
    fast: ["step","rush","core","thrash","dash","gallop","scuttle"],
    frantic: ["gabber","blast","frenzy","sprint","core","splatter","flurry"],
  };
  const NAME_RHYTHM = {
    chop: ["chop","splice","stutter","break","mince","dice"],
    swing: ["shuffle","skank","swing","bounce","lilt"],
  };
  // fuse prefix+suffix; elide a doubled boundary letter (fog+groove stays,
  // tar+rush -> tarush) so some come out as portmanteaus.
  function fuse(a, b) {
    if (a[a.length - 1] === b[0]) return a + b.slice(1);
    return a + b;
  }
  // every prefix root across both registers, longest first — so genreRoot can
  // find which root a name was built from (a flood must not reuse a root: four
  // vendingmachine* genres read as noise even when their vectors differ)
  const ALL_ROOTS = (() => {
    const s = new Set();
    for (const reg of Object.values(NAME_PREFIX)) for (const pool of Object.values(reg)) for (const p of pool) s.add(p);
    return [...s].sort((a, b) => b.length - a.length);
  })();
  // the prefix root a genre name was fused from, or null if it matches none
  function genreRoot(name) {
    const n = String(name).toLowerCase();
    for (const root of ALL_ROOTS) if (n.startsWith(root)) return root;
    return null;
  }
  // traits: {texture:key, tempo:key, rhythm:key|null, mundane?:bool}
  // seed: integer; taken: Set of names to avoid (existing + already-invented)
  // takenRoots: optional Set of prefix roots to avoid (root-uniqueness for floods)
  function inventGenreName(traits, seed, taken, takenRoots) {
    taken = taken || new Set();
    const reg = traits.mundane ? "mundane" : "elemental";
    const pfxPool = (NAME_PREFIX[reg][traits.texture]) || NAME_PREFIX.elemental.synth;
    for (let i = 0; i < 64; i++) {
      const r = rng(hash("genre-name", seed, traits.texture, traits.tempo, traits.rhythm || "-", i));
      const pfx = pick(r, pfxPool);
      if (takenRoots && takenRoots.has(pfx)) continue;   // root already spent
      // rhythm tag, when present, sometimes wins the suffix (the groove IS the id)
      const useRhythm = traits.rhythm && r() < 0.5;
      const sfx = useRhythm ? pick(r, NAME_RHYTHM[traits.rhythm]) : pick(r, NAME_SUFFIX[traits.tempo] || NAME_SUFFIX.mid);
      let name = fuse(pfx, sfx);
      // occasionally append a rhythm/tempo flourish for length + flavor
      if (!useRhythm && traits.rhythm && r() < 0.3) name = fuse(name, pick(r, NAME_RHYTHM[traits.rhythm]));
      name = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!/^[a-z][a-z0-9]*$/.test(name) || name.length < 4 || name.length > 22) continue;
      if (!taken.has(name)) return { name, label: name.charAt(0).toUpperCase() + name.slice(1), root: pfx };
    }
    // no root-unique name available in this texture — signal exhaustion so the
    // caller can reject rather than fall back into a colliding/permuted name
    if (takenRoots) return null;
    // deterministic fallback: prefix + tempo + numeric suffix
    const r = rng(hash("genre-name-fallback", seed, traits.texture));
    const pfx = pick(r, pfxPool);
    let base = fuse(pfx, traits.tempo);
    let n = base, k = 2;
    while (taken.has(n)) n = base + (k++);
    return { name: n, label: n.charAt(0).toUpperCase() + n.slice(1), root: pfx };
  }

  const bankOf = (genre) => NAMEBANK[genre] || GENERIC;

  // one "song" identity: title/artist/album/year/label, stable for (genre, seed)
  function identity(genre, seed) {
    const b = bankOf(genre), r = rng(hash("id", genre, seed));
    const era = b.era || GENERIC.era;
    return {
      artist: pick(r, b.bands),
      title: pick(r, b.titles).toUpperCase(),
      album: ALBUM_PATTERNS[irnd(r, ALBUM_PATTERNS.length)](b, r),
      year: era[0] + irnd(r, era[1] - era[0] + 1),
      label: pick(r, LABELS),
    };
  }

  // a musician for (role, instrument-model, seed): changes iff the model changes
  function musician(role, model, seed) {
    const r = rng(hash("mus", role, model, seed));
    if (/vocoder|robot/.test(model)) return pick(r, ROBOT);
    if (role === "drums" && /break|jungle|amen/.test(model)) return pick(r, DJ);
    if (role === "sample") return pick(r, DJ);
    const style = irnd(r, 3);
    const first = pick(r, FIRST), last = pick(r, LAST);
    if (style === 0) return `${first} "${pick(r, NICK)}" ${last}`;
    if (style === 1) return `${pick(r, HONOR)} ${first} ${last}`;
    return `${first} ${last}`;
  }

  // instrument display names from a kernel/engine state
  const PAD_NAMES = { saw: "Analog Pad", organ: "Drawbar Organ", strings: "Tape Strings",
    choir: "Ghost Choir", bell: "FM Bells", piano: "Grand Piano", fm: "FM Pad",
    rhodes: "DX7 E.PIANO 1", vocoder: "Vocoder Pad" };
  const BASS_NAMES = { saw: "Analog Bass", sub: "Sub Bass", acid: "TB-Acid Bass",
    reese: "Reese Bass", wobble: "Wobble Bass", piano: "Piano Bass" };
  const LEAD_NAMES = { stack: "Supersaw Lead", saw: "Saw Lead", pluck: "Pluck Synth",
    kpluck: "Karplus Guitar", fuzz: "Fuzz Lead", guitar: "Steel Guitar", brass: "Brass Section",
    strings: "Solo Strings", choir: "Lead Choir", bell: "Tubular Bells", piano: "Piano",
    fm: "FM Lead", vocoder: "Robot Choir", rhodes: "DX7 E.PIANO 1" };
  function instrumentNames(state) {
    const I = state.instruments || {}, out = [];
    const dx = (v) => v && v.dx7 && (v.dx7.name ? "DX7 " + v.dx7.name.trim() : "DX7 Patch");
    if (I.pad) out.push({ role: "pad", model: I.pad.model || "saw",
      name: dx(I.pad) || PAD_NAMES[I.pad.model] || "Mystery Pad" });
    if (I.bass) out.push({ role: "bass", model: I.bass.model || "saw",
      name: dx(I.bass) || BASS_NAMES[I.bass.model] || "Analog Bass" });
    if (I.melody) out.push({ role: "lead", model: I.melody.model || "stack",
      name: dx(I.melody) || LEAD_NAMES[I.melody.model] || "Lead Synth" });
    if (I.drums) {
      const kit = (state.genreMeta && state.genreMeta.kit) || "four";
      const breaks = /break|jungle/.test(kit);
      out.push({ role: "drums", model: breaks ? "breaks" : `${kit}/${I.drums.kickModel || "boom"}`,
        name: breaks ? "Amen Break" : `${kit[0].toUpperCase()}${kit.slice(1)} Kit (${I.drums.kickModel || "boom"} kick)` });
    }
    const srcs = (state.foundSources || []).filter((s) => (s.vol || 0) > 0.02).map((s) => s.id);
    if (srcs.length) out.push({ role: "sample", model: srcs[0], name: "The Crate (" + srcs.slice(0, 2).join(", ") + ")" });
    return out;
  }

  return { NAMEBANK, GENERIC, LABELS, hash, rng, identity, musician, instrumentNames, inventGenreName, genreRoot };
});

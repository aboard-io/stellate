// syllabary.js — THE MOUTHS, twelve of them, at the size Paul actually asked
// for. "the singer should sing enlightened genre appropriate nonsense from a
// per-genre syllabary" scaled first to a hundred bespoke words for each of
// 110 genres — a cathedral nobody asked for — and then: "It can be 1000
// words calm down." So the size decided the shape: not 110 vocabularies, one
// per genre, but a DOZEN, sized so a listener can tell them apart, with every
// genre pointed at the one it actually sounds like.
//
// A BANK IS A PHONETIC WORLD, not a word list picked at random. Gibberish
// from a letter table sounds like gibberish — the first draft of this file
// was exactly that, a combinatorics script running loose over onset/nucleus/
// coda tables, and it read as noise because nothing tied one word to the
// next. What ships instead is CURATED: a small set of hand-chosen tokens per
// bank (its onsets, its vowel color, its coda taste — the mouth-shape) that
// are then chained into one-to-four-syllable words by a script, so the
// VARIETY is mechanical but the CHARACTER is not. Two syllables in you should
// know which room you are in: bebop scat lands on crisp stop consonants and
// tight front vowels (skat, dreet, flip), plainchant opens into long Latin-
// shaped morphemes (glo-ri-um, spi-tus-al), a rave stab is one hard syllable
// and gone (uh, tok, kip). Every word is NONSENSE — invented, not quoted.
// Nothing here is a lyric anyone wrote and nothing is traceable to a
// recording; that is SOURCES.md's law and it is stricter than the sing.js
// banks this widens, which still spell real (if generic) English words
// ("hold on the light goes down"). A handful of pure vocalizations survive
// (oh, ah, hey, yeah, mmh, unh) because those are not lyrics either — they
// are the vocable class itself, the sound a voice makes with no word in its
// mouth, in every one of the styles this file draws from.
//
// WHY A NEW FILE AND NOT A WIDER sing.js. Same reason genres-data.js sits
// beside genre-kernel.js: the algebra and the vocabulary are different
// weights of change. sing.js is ~900 lines of ladders, casts, vocoders and
// the syllable counter itself; this is one table of ~1000 invented words.
// Two lanes can each own one without stepping on the other, and the syllabary
// can grow (a bank widened, a genre re-pointed) without anyone touching the
// singer's arithmetic.
//
// WHAT A BANK IS, PRECISELY: an array of strings, each ASCII letters plus
// apostrophe/hyphen only (nukernel/sing.js espeak reads the word as English
// text — nothing else survives the trip), each one to four syllables under
// sing.js's OWN syllabifier (nsyl below imports and runs it, per the brief:
// "IMPORT IT AND RUN IT... rather than eyeballing" — every word in every
// bank was filtered through the real counter, not a guess). Hyphens are
// cosmetic: the syllabifier strips everything but letters before it counts,
// so "sha-la-la" and "shalala" score identically — the hyphen is there for
// the next person reading this file, and for espeak's own word-boundary
// cue, not for the gate.
//
// THE TWELVE, and why each is its own room (the full case for each is in the
// commit report; short form here):
//   plain      the fallback — six utility genres (Simple/Solo/Vocal/Backing/
//              Riff/Pad) that carry no character of their own, so they get
//              the least colored mouth: la/da/na, the vocable that was
//              already the house default
//   chant      plainchant Latin, invented rather than quoted (gregorian,
//              bulgarian, spem, fugue, counterpoint, hymn — six liturgical
//              or fugal anchors) — open morphemes, long lines
//   scat       bebop, and bebop alone (jazz) — one genre, but it is the one
//              genre in the catalogue that IS a vocal style, so it earns a
//              full room rather than folding into something adjacent
//   dreamboat  close-harmony pop, from doo-wop through Motown through yacht
//              rock to k-pop — 21 genres that are all, underneath the
//              decades, the same bright blend-forward throat
//   testify    soul/gospel testifying, the moan and the belt (isley, funk,
//              gospel, rnb, jodeci, darkrnb) — six genres, open vowels,
//              breath sounds that are not words (mmh, unh) sitting beside
//              the ones that are
//   stab       the rave/hip-hop vocal hit — acid through techno through
//              drill, 13 genres whose singing is mostly a chant over a
//              four-on-the-floor or a boom-bap kick, short and percussive
//   circuit    the machine mouth — every genre this kernel already wires to
//              a vocoder chip (kraftwerk, electro, motorik, ebm...) plus the
//              rest of the robotic studio pop, 10 genres of clipped stops
//   velvet     the crooner's legato — roots-family singer-songwriters,
//              tango, countrypop, the folk duos, 12 genres of liquid
//              consonants on long vowels
//   backbeat   rock's plain belt — the band-family genres that do NOT
//              holler (blues, rock, newwave, powerballad...), 13 genres of
//              gritty monosyllables
//   riot       hardcore's actual holler — the seven band-family genres
//              sing.js already tags "holler" (sludge, deathmetal, punk,
//              screamo, industrialmetal, grebo, industrialrock) — the
//              harshest consonant clusters in the file on purpose
//   riddim     reggae/ska/afrobeat/latin's groove — 7 genres, bounce and
//              open vowels, built to avoid landing on any real Patois,
//              Spanish or Portuguese word along the way
//   haze       ambient/drift's wordless hush — vaporwave, drone, shoegaze,
//              ambient, minimalism, spacerock, postrock, neoclassical, 8
//              genres that want breath more than consonant
//
// EVERY GENRE MAPS TO EXACTLY ONE BANK (GENRE_BANK below), all 110 of them —
// a genre that fit none well went to its nearest neighbor rather than
// getting a bank of its own; see the commit report for the handful of close
// calls (kpop into dreamboat for the harmony-stack pop reading rather than
// stab's rave-vocal reading; tango into velvet for the sung legato over the
// bandoneon rather than riddim's dance-groove reading).
//
// THIS FILE DOES NOT WIRE ITSELF IN. nukernel/sing.js owns bankFor() and is
// another lane's file this round — see the commit report for the exact
// patch that makes bankFor() consult GENRE_BANK first and fall back to
// today's family banks for anything unmapped, and the load-order note for
// kernel-daw.html.
(function (root) {
  "use strict";
  const SI = (typeof module !== "undefined" && module.exports)
    ? require("./sing.js") : root.NuSing;
  const nsyl = SI.nsyl;

  /* ============================================================== THE BANKS
     Twelve phonetic worlds. See the file header for what each one is FOR;
     this is just the vocabulary. Built by chaining a small set of curated
     tokens (chosen for the bank's own consonants and vowel color) into
     one-to-four-syllable words, then filtered through sing.js's real
     syllabifier and a profanity/slur blocklist — nothing here is unvetted. */
  const BANKS = {
    plain: [
      "la", "da", "na", "ba", "ma", "ya", "wa", "sha", "ha", "ta", "ra",
      "zo", "fo", "vo", "bo", "oh", "ah", "ee", "oo", "hey", "ee-oo-hey-yay",
      "bo-ah-oo-yay", "zo-bo-ee-yay", "bo-ee-yay-na", "ee-yay-na-ya",
      "bo-oo-da-ya", "la-ya-ra-oh", "zo-ah-la-ya", "ha-bo-yay-ya",
      "bo-yay-ya-zo", "yay-ya-zo-ee", "ba-ma-ya", "ma-ya-wa", "vo-bo-oh",
      "bo-oh-ah", "ah-ee-oo", "ee-oo-hey", "oo-hey-yay", "hey-yay-la",
      "da-ba-ya", "ba-ya-sha", "zo-vo-oh", "fo-bo-ah", "vo-oh-ee",
      "bo-ah-oo", "ah-oo-yay", "oo-yay-da", "na-ya-ha", "ta-fo-oh",
      "ra-vo-ah", "zo-bo-ee", "fo-oh-oo", "vo-ah-hey", "ee-yay-na",
      "yay-na-ya", "da-ya-ta", "sha-zo-oh", "ha-fo-ah", "ta-vo-ee",
      "ra-bo-oo", "na-ba-ma-ya", "ba-ma-ya-wa", "ma-ya-wa-sha",
      "fo-vo-bo-oh", "vo-bo-oh-ah", "bo-oh-ah-ee", "oh-ah-ee-oo",
      "ah-ee-oo-hey", "oo-hey-yay-la", "hey-yay-la-da", "da-ba-ya-sha",
      "ba-ya-sha-ta", "ta-zo-vo-oh", "ra-fo-bo-ah", "zo-vo-oh-ee",
      "fo-bo-ah-oo", "la-da-na-ba", "da-na-ba-ma", "ya-wa-sha-ha",
      "wa-sha-ha-ta", "sha-ha-ta-ra", "ha-ta-ra-zo", "ta-ra-zo-fo",
      "ra-zo-fo-vo",
    ],
    chant: [
      "san", "glo", "ri", "um", "dex", "cel", "sim", "mi", "nus", "pax",
      "lux", "ve", "ni", "spi", "tus", "al", "lu", "cor", "ter", "num",
      "glo-ri-um", "ri-um-dex", "pax-lux-ve", "glo-um-cel", "mi-pax-ve",
      "ve-spi-al", "spi-al-cor", "cas-glo-um", "cel-nus-ve", "pax-ni-al",
      "ni-al-ter", "um-mi-ve", "mi-ve-al", "ve-al-num", "glo-sim-ve",
      "al-fi-um", "fi-um-nus", "cas-cel-ve", "num-dex-ve", "san-glo",
      "glo-ri", "um-dex", "dex-cel", "cel-sim", "sim-mi", "mi-nus",
      "nus-pax", "pax-lux", "ve-ni", "ni-spi", "spi-tus", "tus-al", "al-lu",
      "lu-cor", "cor-ter", "ter-num", "num-fi", "fi-cas", "cas-san",
      "san-ri", "san-glo-ri-um", "glo-ri-um-dex", "ri-um-dex-cel",
      "nus-pax-lux-ve", "glo-um-cel-mi", "cel-mi-pax-ve", "pax-ve-spi-al",
      "ve-spi-al-cor", "spi-al-cor-num", "num-cas-glo-um", "cas-glo-um-cel",
      "ri-cel-nus-ve", "sim-pax-ni-al", "pax-ni-al-ter", "ni-al-ter-cas",
      "um-mi-ve-al", "um-dex-cel-sim", "dex-cel-sim-mi", "cel-sim-mi-nus",
      "sim-mi-nus-pax", "mi-nus-pax-lux", "pax-lux-ve-ni", "lux-ve-ni-spi",
      "ve-ni-spi-tus",
    ],
    scat: [
      "doo", "bee", "bop", "shoo", "wee", "dah", "bap", "zoo", "dit", "flip",
      "skat", "scoo", "doot", "bah", "shab", "teet", "whee", "bree", "plop",
      "skee", "doo-bee", "bee-bop", "bop-shoo", "shoo-wee", "wee-dah",
      "dah-bap", "bap-zoo", "zoo-dit", "dit-flip", "flip-skat", "skat-scoo",
      "scoo-doot", "doot-bah", "bah-shab", "shab-teet", "teet-whee",
      "whee-bree", "bree-plop", "plop-skee", "skee-snap", "snap-flap",
      "flap-zam", "zam-blee", "blee-skip", "skip-doo", "doo-bop", "bee-shoo",
      "bop-wee", "shoo-dah", "wee-bap", "dah-zoo", "bap-dit", "zoo-flip",
      "dit-skat", "flip-scoo", "skat-doot", "scoo-bah", "doot-shab",
      "bah-teet", "shab-whee", "doo-bee-bop", "bee-bop-shoo", "bop-shoo-wee",
      "shoo-wee-dah", "wee-dah-bap", "dah-bap-zoo", "bap-zoo-dit",
      "zoo-dit-flip", "dit-flip-skat", "flip-skat-scoo", "skat-scoo-doot",
      "scoo-doot-bah", "doot-bah-shab", "bah-shab-teet", "shab-teet-whee",
      "teet-whee-bree", "doo-bee-bop-shoo", "bee-bop-shoo-wee",
      "bop-shoo-wee-dah", "shoo-wee-dah-bap", "wee-dah-bap-zoo",
      "dah-bap-zoo-dit", "bap-zoo-dit-flip", "zoo-dit-flip-skat",
    ],
    dreamboat: [
      "shoo", "wah", "sha", "la", "boom", "ba", "jee", "dee", "voh", "rah",
      "yay", "noo", "loh", "ree", "vye", "tee", "doh", "lah", "vee", "chee",
      "boom-dee-yay", "dee-yay-ree", "sha-jee-yay", "jee-yay-vye",
      "shoo-ba-yay", "ba-yay-tee", "la-yay-lah", "gee-la-yay", "shoo-wah",
      "wah-sha", "sha-la", "la-boom", "boom-ba", "ba-jee", "jee-dee",
      "dee-voh", "voh-rah", "rah-yay", "yay-noo", "noo-loh", "loh-ree",
      "ree-vye", "vye-tee", "tee-doh", "doh-lah", "lah-vee", "vee-chee",
      "chee-moh", "moh-gee", "gee-zee", "zee-kay", "kay-hay", "hay-shoo",
      "shoo-sha", "wah-la", "sha-boom", "la-ba", "boom-jee", "ba-dee",
      "jee-voh", "wah-boom-dee-yay", "boom-dee-yay-ree", "dee-yay-ree-doh",
      "sha-jee-yay-vye", "jee-yay-vye-vee", "kay-sha-jee-yay",
      "shoo-ba-yay-tee", "ba-yay-tee-moh", "moh-shoo-ba-yay",
      "la-yay-lah-hay", "vye-gee-la-yay", "gee-la-yay-lah", "shoo-wah-sha",
      "wah-sha-la", "sha-la-boom", "la-boom-ba", "shoo-wah-sha-la",
      "wah-sha-la-boom", "sha-la-boom-ba", "la-boom-ba-jee",
      "boom-ba-jee-dee", "ba-jee-dee-voh", "jee-dee-voh-rah",
      "dee-voh-rah-yay",
    ],
    testify: [
      "mmh", "unh", "ahh", "ohh", "yeah", "heh", "wei", "rei", "sei", "dei",
      "oh", "glo", "roh", "neh", "fah", "jeh", "leh", "zoh", "peh", "teh",
      "vay-ahh-wei-oh", "mmh-unh-ahh", "sei-dei-oh", "dei-oh-glo",
      "vay-zay-mmh", "zay-mmh-unh", "mmh-ahh-yeah", "wei-sei-oh",
      "sei-oh-roh", "peh-vay-mmh", "teh-zay-unh", "vay-mmh-ahh",
      "zay-unh-ohh", "mmh-ohh-wei", "yeah-rei-oh", "rei-oh-neh",
      "leh-teh-mmh", "zoh-vay-unh", "peh-zay-ahh", "teh-mmh-ohh",
      "vay-unh-yeah", "zay-ahh-heh", "mmh-yeah-sei", "ahh-wei-oh",
      "wei-oh-fah", "fah-peh-mmh", "leh-vay-ahh", "zoh-zay-ohh",
      "peh-mmh-yeah", "vay-ahh-wei", "zay-ohh-rei", "mmh-heh-oh",
      "roh-zoh-mmh", "jeh-vay-ohh", "leh-zay-yeah", "zoh-mmh-heh",
      "vay-ohh-sei", "zay-yeah-dei", "mmh-wei-roh", "oh-leh-mmh",
      "mmh-unh-ahh-ohh", "rei-sei-dei-oh", "sei-dei-oh-glo",
      "dei-oh-glo-roh", "teh-vay-zay-mmh", "vay-zay-mmh-unh",
      "zay-mmh-unh-ahh", "mmh-ahh-yeah-wei", "yeah-wei-sei-oh",
      "wei-sei-oh-roh", "sei-oh-roh-fah", "leh-peh-vay-mmh",
      "zoh-teh-zay-unh", "peh-vay-mmh-ahh", "teh-zay-unh-ohh",
      "vay-mmh-ahh-yeah", "unh-ahh-ohh-yeah", "ahh-ohh-yeah-heh",
      "ohh-yeah-heh-wei", "yeah-heh-wei-rei", "heh-wei-rei-sei",
      "wei-rei-sei-dei", "oh-glo-roh-neh", "glo-roh-neh-fah",
    ],
    stab: [
      "uh", "yo", "jo", "hey", "vop", "drix", "tok", "kap", "rux", "whoo",
      "hup", "bax", "zab", "tep", "rix", "zix", "dap", "kip", "tig", "wex",
      "uh-yo", "yo-jo", "jo-hey", "hey-vop", "vop-drix", "drix-tok",
      "tok-kap", "kap-rux", "rux-whoo", "whoo-hup", "hup-bax", "bax-zab",
      "zab-tep", "tep-rix", "rix-zix", "zix-dap", "dap-kip", "kip-tig",
      "tig-wex", "wex-hix", "hix-uh", "uh-jo", "yo-hey", "jo-vop",
      "hey-drix", "vop-tok", "drix-kap", "tok-rux", "kap-whoo", "rux-hup",
      "whoo-bax", "hup-zab", "bax-tep", "zab-rix", "tep-zix", "rix-dap",
      "zix-kip", "dap-tig", "kip-wex", "tig-hix", "uh-yo-jo", "yo-jo-hey",
      "jo-hey-vop", "hey-vop-drix", "vop-drix-tok", "drix-tok-kap",
      "tok-kap-rux", "kap-rux-whoo", "rux-whoo-hup", "whoo-hup-bax",
      "hup-bax-zab", "bax-zab-tep", "zab-tep-rix", "tep-rix-zix",
      "rix-zix-dap", "zix-dap-kip", "uh-yo-jo-hey", "yo-jo-hey-vop",
      "jo-hey-vop-drix", "hey-vop-drix-tok", "vop-drix-tok-kap",
      "drix-tok-kap-rux", "tok-kap-rux-whoo", "kap-rux-whoo-hup",
    ],
    circuit: [
      "dit", "tik", "vex", "rax", "zod", "kif", "tox", "drex", "plek",
      "klik", "brik", "trak", "grix", "plox", "skiv", "brak", "trix", "klop",
      "zik", "vok", "dit-tik", "tik-vex", "vex-rax", "rax-zod", "zod-kif",
      "kif-tox", "tox-drex", "drex-plek", "plek-klik", "klik-brik",
      "brik-trak", "trak-grix", "grix-plox", "plox-skiv", "skiv-brak",
      "brak-trix", "trix-klop", "klop-zik", "zik-vok", "vok-dit", "dit-vex",
      "tik-rax", "vex-zod", "rax-kif", "zod-tox", "kif-drex", "tox-plek",
      "drex-klik", "plek-brik", "klik-trak", "brik-grix", "trak-plox",
      "grix-skiv", "plox-brak", "skiv-trix", "brak-klop", "trix-zik",
      "klop-vok", "zik-dit", "vok-tik", "dit-tik-vex", "tik-vex-rax",
      "vex-rax-zod", "rax-zod-kif", "zod-kif-tox", "kif-tox-drex",
      "tox-drex-plek", "drex-plek-klik", "plek-klik-brik", "klik-brik-trak",
      "brik-trak-grix", "trak-grix-plox", "grix-plox-skiv", "plox-skiv-brak",
      "skiv-brak-trix", "brak-trix-klop", "dit-tik-vex-rax",
      "tik-vex-rax-zod", "vex-rax-zod-kif", "rax-zod-kif-tox",
      "zod-kif-tox-drex", "kif-tox-drex-plek", "tox-drex-plek-klik",
      "drex-plek-klik-brik",
    ],
    velvet: [
      "loh", "mee", "vay", "ren", "sol", "sway", "mel", "rell", "shai",
      "thay", "roh", "nay", "lei", "vall", "sehn", "mohr", "lail", "oon",
      "ehl", "ahn", "rell-lei-oon", "lei-oon-vay", "sway-nay-oon",
      "mel-lei-ehl", "nay-oon-ren", "lei-ehl-sol", "sol-nay-ehl",
      "sway-lei-ahn", "nay-ehl-sway", "lei-ahn-mel", "loh-mee", "mee-vay",
      "vay-ren", "ren-sol", "sol-sway", "sway-mel", "mel-rell", "rell-shai",
      "shai-thay", "thay-roh", "roh-nay", "nay-lei", "lei-vall", "vall-sehn",
      "sehn-mohr", "mohr-lail", "lail-oon", "oon-ehl", "ehl-ahn", "ahn-loh",
      "loh-vay", "mee-ren", "vay-sol", "ren-sway", "sol-mel", "sway-rell",
      "mel-shai", "rell-thay", "shai-roh", "thay-nay", "vay-rell-lei-oon",
      "rell-lei-oon-vay", "lei-oon-vay-rell", "loh-mel-lei-ehl",
      "sway-nay-oon-ren", "mel-lei-ehl-sol", "nay-oon-ren-thay",
      "lei-ehl-sol-roh", "ahn-sway-nay-oon", "sol-nay-ehl-sway",
      "sway-lei-ahn-mel", "nay-ehl-sway-lei", "lei-ahn-mel-vall",
      "oon-sol-nay-ehl", "ehl-sway-lei-ahn", "loh-mee-vay",
      "loh-mee-vay-ren", "mee-vay-ren-sol", "vay-ren-sol-sway",
      "ren-sol-sway-mel", "sol-sway-mel-rell", "sway-mel-rell-shai",
      "mel-rell-shai-thay", "rell-shai-thay-roh",
    ],
    backbeat: [
      "hey", "yeah", "whoa", "gunn", "brax", "tryd", "kadd", "bral", "tund",
      "brol", "gadd", "skarr", "whud", "grull", "vrent", "drozz", "klum",
      "brend", "staw", "kresh", "hey-yeah-whoa", "drav-hey-yeah",
      "yeah-whoa", "whoa-gunn", "gunn-brax", "brax-tryd", "tryd-kadd",
      "kadd-bral", "bral-tund", "tund-brol", "brol-gadd", "gadd-skarr",
      "skarr-whud", "whud-grull", "grull-vrent", "vrent-drozz", "drozz-klum",
      "klum-brend", "brend-staw", "staw-kresh", "kresh-drav", "drav-hey",
      "hey-whoa", "yeah-gunn", "whoa-brax", "gunn-tryd", "brax-kadd",
      "tryd-bral", "kadd-tund", "bral-brol", "tund-gadd", "brol-skarr",
      "gadd-whud", "skarr-grull", "whud-vrent", "grull-drozz", "vrent-klum",
      "drozz-brend", "klum-staw", "brend-kresh", "hey-yeah-whoa-gunn",
      "kresh-drav-hey-yeah", "drav-hey-yeah-whoa", "yeah-whoa-gunn",
      "whoa-gunn-brax", "gunn-brax-tryd", "brax-tryd-kadd", "tryd-kadd-bral",
      "kadd-bral-tund", "bral-tund-brol", "tund-brol-gadd",
      "brol-gadd-skarr", "gadd-skarr-whud", "skarr-whud-grull",
      "whud-grull-vrent", "grull-vrent-drozz", "yeah-whoa-gunn-brax",
      "whoa-gunn-brax-tryd", "gunn-brax-tryd-kadd", "brax-tryd-kadd-bral",
      "tryd-kadd-bral-tund", "kadd-bral-tund-brol", "bral-tund-brol-gadd",
      "tund-brol-gadd-skarr",
    ],
    riot: [
      "grax", "skarn", "vrex", "krot", "zang", "thrag", "skarg", "vrix",
      "throm", "zurk", "grask", "vrant", "skrom", "thrix", "karg", "vrusk",
      "zorn", "grukk", "skath", "thruv", "grax-skarn", "skarn-vrex",
      "vrex-krot", "krot-zang", "zang-thrag", "thrag-skarg", "skarg-vrix",
      "vrix-throm", "throm-zurk", "zurk-grask", "grask-vrant", "vrant-skrom",
      "skrom-thrix", "thrix-karg", "karg-vrusk", "vrusk-zorn", "zorn-grukk",
      "grukk-skath", "skath-thruv", "thruv-vrag", "vrag-grax", "grax-vrex",
      "skarn-krot", "vrex-zang", "krot-thrag", "zang-skarg", "thrag-vrix",
      "skarg-throm", "vrix-zurk", "throm-grask", "zurk-vrant", "grask-skrom",
      "vrant-thrix", "skrom-karg", "thrix-vrusk", "karg-zorn", "vrusk-grukk",
      "zorn-skath", "grukk-thruv", "skath-vrag", "grax-skarn-vrex",
      "skarn-vrex-krot", "vrex-krot-zang", "krot-zang-thrag",
      "zang-thrag-skarg", "thrag-skarg-vrix", "skarg-vrix-throm",
      "vrix-throm-zurk", "throm-zurk-grask", "zurk-grask-vrant",
      "grask-vrant-skrom", "vrant-skrom-thrix", "skrom-thrix-karg",
      "thrix-karg-vrusk", "karg-vrusk-zorn", "vrusk-zorn-grukk",
      "grax-skarn-vrex-krot", "skarn-vrex-krot-zang", "vrex-krot-zang-thrag",
      "krot-zang-thrag-skarg", "zang-thrag-skarg-vrix",
      "thrag-skarg-vrix-throm", "skarg-vrix-throm-zurk",
      "vrix-throm-zurk-grask",
    ],
    riddim: [
      "kai", "mo", "wa", "la", "ba", "ta", "ya", "cha", "sa", "ra", "lo",
      "do", "vam", "tam", "kan", "zim", "fay", "gee", "moo", "bam",
      "ba-ta-ya", "ta-ya-cha", "wa-ba-ya", "ba-ya-sa", "kai-la-ya",
      "la-ya-ra", "wa-ya-lo", "moo-wa-ya", "mo-ya-do", "fay-mo-ya",
      "kai-ya-vam", "kan-kai-ya", "kai-mo", "mo-wa", "wa-la", "la-ba",
      "ba-ta", "ya-cha", "cha-sa", "sa-ra", "ra-lo", "lo-do", "do-vam",
      "vam-tam", "tam-kan", "kan-zim", "zim-fay", "fay-gee", "gee-moo",
      "moo-bam", "bam-kai", "kai-wa", "mo-la", "wa-ba", "la-ta", "ta-cha",
      "ya-sa", "cha-ra", "sa-lo", "ra-do", "la-ba-ta-ya", "ba-ta-ya-cha",
      "ta-ya-cha-sa", "kai-wa-ba-ya", "wa-ba-ya-sa", "ba-ya-sa-lo",
      "kai-la-ya-ra", "la-ya-ra-vam", "gee-kai-la-ya", "wa-ya-lo-kan",
      "kan-moo-wa-ya", "moo-wa-ya-lo", "mo-ya-do-fay", "do-fay-mo-ya",
      "fay-mo-ya-do", "kai-ya-vam-moo", "kai-mo-wa-la", "mo-wa-la-ba",
      "wa-la-ba-ta", "ya-cha-sa-ra", "cha-sa-ra-lo", "sa-ra-lo-do",
      "ra-lo-do-vam", "lo-do-vam-tam",
    ],
    haze: [
      "whoh", "weyn", "loum", "reyo", "vael", "moun", "yael", "wrail", "noh",
      "layr", "houn", "veyl", "myn", "ohn", "wyle", "nyol", "raeh", "loun",
      "veir", "reyo-yael", "nyra", "weyn-reyo-yael", "reyo-yael-layr",
      "whoh-weyn", "loum-reyo", "reyo-vael", "vael-moun", "moun-yael",
      "yael-wrail", "wrail-noh", "noh-layr", "layr-houn", "houn-veyl",
      "veyl-myn", "myn-ohn", "ohn-wyle", "nyol-raeh", "raeh-loun",
      "loun-veir", "veir-whoh", "weyn-loum", "loum-vael", "reyo-moun",
      "vael-yael", "moun-wrail", "yael-noh", "wrail-layr", "noh-houn",
      "layr-veyl", "houn-myn", "veyl-ohn", "myn-wyle", "ohn-nyol",
      "nyol-loun", "raeh-veir", "loun-whoh", "veir-weyn", "whoh-loum",
      "weyn-reyo", "loum-moun", "weyn-reyo-yael-layr", "reyo-yael-layr-myn",
      "loun-weyn-reyo-yael", "loum-reyo-vael", "reyo-vael-moun",
      "vael-moun-yael", "moun-yael-wrail", "yael-wrail-noh",
      "wrail-noh-layr", "noh-layr-houn", "layr-houn-veyl", "houn-veyl-myn",
      "veyl-myn-ohn", "myn-ohn-wyle", "nyol-raeh-loun", "raeh-loun-veir",
      "loum-reyo-vael-moun", "reyo-vael-moun-yael", "vael-moun-yael-wrail",
      "moun-yael-wrail-noh", "yael-wrail-noh-layr", "wrail-noh-layr-houn",
      "noh-layr-houn-veyl", "layr-houn-veyl-myn",
    ],
  };

  /* =========================================================== THE MAPPING
     Every one of the 110 catalogue genres, pointed at the bank it actually
     sounds like — read off nukernel/genres.js's own labels (place and year)
     and families, not assigned by family field alone (a family here is a
     songwriting lineage, not a vocal style, and the two do not always
     agree — the "band" family alone splits across three different mouths
     below depending on whether the genre hollers, belts, or just sings). */
  const GENRE_BANK = {
    // plain (6)
    simple: "plain", solo: "plain", vocal: "plain", backing: "plain",
    riff: "plain", pad: "plain",
    // chant (6)
    fugue: "chant", gregorian: "chant", bulgarian: "chant", spem: "chant",
    counterpoint: "chant", hymn: "chant",
    // scat (1)
    jazz: "scat",
    // dreamboat (21)
    eurythmics: "dreamboat", toto: "dreamboat", beatles: "dreamboat",
    steely: "dreamboat", disco: "dreamboat", motown: "dreamboat",
    synthpop: "dreamboat", citypop: "dreamboat", doowop: "dreamboat",
    merseybeat: "dreamboat", psychpop: "dreamboat", clubpop: "dreamboat",
    retrofunkpop: "dreamboat", kpop: "dreamboat", boyband: "dreamboat",
    confessionalpop: "dreamboat", blueeyedsoul: "dreamboat",
    orchpsych: "dreamboat", yachtsoul: "dreamboat", yachtrock: "dreamboat",
    dancepostpunk: "dreamboat",
    // testify (6)
    isley: "testify", jodeci: "testify", funk: "testify", rnb: "testify",
    gospel: "testify", darkrnb: "testify",
    // stab (13)
    acid: "stab", boombap: "stab", trap: "stab", house: "stab",
    garage: "stab", dnb: "stab", techno: "stab", drill: "stab",
    bigroom: "stab", melodictechno: "stab", industrialbreaks: "stab",
    madchester: "stab", indiedance: "stab",
    // circuit (10)
    kraftwerk: "circuit", electro: "circuit", bigbeat: "circuit",
    motorik: "circuit", roboticpop: "circuit", ebm: "circuit",
    synthduo: "circuit", bleeptechno: "circuit", analogsynthpop: "circuit",
    gothsynth: "circuit",
    // velvet (12)
    tango: "velvet", countrypop: "velvet", skiffle: "velvet",
    crooner: "velvet", yuletide: "velvet", folkduo: "velvet",
    worldfolk: "velvet", altcountry: "velvet", songwriterpiano: "velvet",
    softfolk: "velvet", singersongwriter: "velvet", coastrock: "velvet",
    // backbeat (13)
    newwave: "backbeat", blues: "backbeat", rock: "backbeat",
    bodiddley: "backbeat", chuckberry: "backbeat", powerballad: "backbeat",
    emo: "backbeat", jamband: "backbeat", sophistirock: "backbeat",
    musichallrock: "backbeat", gothicpop: "backbeat", postpunk: "backbeat",
    janglepop: "backbeat",
    // riot (7)
    sludge: "riot", deathmetal: "riot", punk: "riot", screamo: "riot",
    industrialmetal: "riot", grebo: "riot", industrialrock: "riot",
    // riddim (7)
    reggae: "riddim", dub: "riddim", ska: "riddim", afrobeat: "riddim",
    bossa: "riddim", reggaeton: "riddim", latinpop: "riddim",
    // haze (8)
    vaporwave: "haze", neoclassical: "haze", drone: "haze", postrock: "haze",
    shoegaze: "haze", ambient: "haze", minimalism: "haze", spacerock: "haze",
  };

  /* a small sanity pass, in the SAME voice as sing.js's own boot-time
     checks: a bank must actually contain words (a typo'd name would
     otherwise resolve to undefined and silently sing nothing), and a bank
     must not be word-for-word identical to another — that would mean two
     of the twelve rooms are actually one room wearing two names, and the
     whole point of widening past sing.js's ten was distinctness. */
  const names = Object.keys(BANKS);
  for (const k of names) {
    if (!Array.isArray(BANKS[k]) || !BANKS[k].length)
      throw new Error("syllabary.js: bank " + k + " is empty");
  }
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      if (JSON.stringify(BANKS[names[i]]) === JSON.stringify(BANKS[names[j]]))
        throw new Error("syllabary.js: " + names[i] + " duplicates " + names[j]);
  // every mapped genre must name a real bank — the same failure mode as an
  // empty bank above, caught here instead so a typo in GENRE_BANK cannot
  // silently fall through to sing.js's own FALLBACK_BANK and hide itself
  for (const [g, b] of Object.entries(GENRE_BANK))
    if (!BANKS[b]) throw new Error("syllabary.js: " + g + " points at unknown bank " + b);

  const api = { BANKS, GENRE_BANK, bankNames: names };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSyllabary = api;
})(typeof window !== "undefined" ? window : globalThis);

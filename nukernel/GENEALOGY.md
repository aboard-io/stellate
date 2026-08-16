# GENEALOGY — the fit of the declared parentage

2026-08-16 — nukernel/genealogy.js over the 44 real anchors in nukernel/genres.js.

Each anchor's 27 features are read off the anchor data itself (the field-by-feature table is documented at the top of genealogy.js); each child is then fitted as a non-negative combination of its DECLARED parents' vectors. R² is how much of the child the parents explain; the residue is the invention.

## The children, best-explained first

| child | R² | residue (rms) | fitted weights (declared) |
|---|---|---|---|
| rock — London 1969 |  93.8% | 0.082 | blues 0.08 (0.65), beatles 0.92 (0.35) |
| newwave — London 1979 |  87.6% | 0.127 | punk 0.51 (0.40), beatles 0.31 (0.35), disco 0.18 (0.25) |
| neoclassical — Berlin 2011 |  84.9% | 0.135 | ambient 0.03 (0.45), drone 0.00 (0.30), postrock 0.97 (0.25) |
| beatles — Liverpool 1962 |  83.5% | 0.131 | blues 0.03 (0.30), motown 0.00 (0.25), countrypop 0.73 (0.25), counterpoint 0.24 (0.20) |
| rnb — Philadelphia 1994 |  83.0% | 0.143 | gospel 0.00 (0.35), motown 0.59 (0.35), jodeci 0.41 (0.30) |
| citypop — Tokyo 1984 |  80.8% | 0.150 | toto 0.04 (0.35), steely 0.21 (0.35), disco 0.76 (0.30) |
| eurythmics — London 1983 |  80.3% | 0.142 | synthpop 0.75 (0.55), motown 0.09 (0.30), funk 0.16 (0.15) |
| jodeci — Charlotte 1991 |  79.2% | 0.163 | gospel 0.50 (0.50), funk 0.00 (0.30), motown 0.50 (0.20) |
| disco — New York 1977 |  78.6% | 0.160 | funk 0.14 (0.45), motown 0.86 (0.35), gospel 0.00 (0.20) |
| synthpop — Basildon 1981 |  77.9% | 0.168 | newwave 0.95 (0.55), disco 0.05 (0.45) |
| boombap — New York 1994 |  76.3% | 0.143 | isley 0.48 (0.40), funk 0.07 (0.35), disco 0.45 (0.25) |
| deathmetal — Tampa 1990 |  76.2% | 0.191 | punk 0.85 (0.55), rock 0.15 (0.45) |
| toto — Los Angeles 1982 |  71.1% | 0.166 | steely 0.70 (0.45), rock 0.00 (0.30), funk 0.29 (0.25) |
| gospel — Chicago 1932 |  71.0% | 0.175 | blues 1.00 (1.00) |
| steely — Los Angeles 1977 |  67.9% | 0.177 | rock 0.61 (0.35), blues 0.25 (0.35), motown 0.13 (0.30) |
| postrock — Austin 2003 |  67.3% | 0.175 | ambient 0.37 (0.40), rock 0.41 (0.30), shoegaze 0.22 (0.30) |
| isley — Teaneck 1973 |  64.9% | 0.176 | gospel 0.65 (0.35), funk 0.00 (0.35), rock 0.35 (0.30) |
| shoegaze — London 1991 |  64.4% | 0.216 | punk 0.54 (0.40), drone 0.38 (0.30), beatles 0.08 (0.30) |
| counterpoint — Vienna 1725 |  63.6% | 0.184 | gregorian 1.00 (1.00) |
| reggae — Kingston 1969 |  63.1% | 0.194 | ska 1.00 (1.00) |
| house — Chicago 1986 |  61.5% | 0.233 | disco 0.78 (0.70), gospel 0.22 (0.15), funk 0.00 (0.15) |
| punk — New York 1976 |  61.0% | 0.221 | rock 0.44 (0.55), beatles 0.56 (0.45) |
| garage — London 1999 |  59.6% | 0.218 | house 0.52 (0.45), rnb 0.31 (0.30), dnb 0.17 (0.25) |
| motown — Detroit 1965 |  59.5% | 0.209 | gospel 0.72 (0.60), blues 0.28 (0.40) |
| techno — Detroit 1988 |  57.0% | 0.223 | house 0.23 (0.40), funk 0.47 (0.30), synthpop 0.30 (0.30) |
| afrobeat — Lagos 1971 |  56.1% | 0.205 | funk 1.00 (1.00) |
| vaporwave — Portland 2011 |  51.0% | 0.214 | citypop 0.06 (0.40), rnb 0.94 (0.30), ambient 0.00 (0.30) |
| sludge — New Orleans 1991 |  46.2% | 0.231 | punk 0.48 (0.40), rock 0.35 (0.35), blues 0.17 (0.25) |
| fugue — Leipzig 1725 |  40.4% | 0.238 | counterpoint 1.00 (0.70), gregorian 0.00 (0.30) |
| spem — London 1570 |  40.1% | 0.269 | counterpoint 0.40 (0.55), gregorian 0.60 (0.45) |
| dnb — London 1994 |  39.3% | 0.258 | dub 0.40 (0.35), funk 0.17 (0.25), house 0.10 (0.20), techno 0.34 (0.20) |
| acid — Chicago 1987 |  38.5% | 0.234 | house 0.30 (0.80), funk 0.70 (0.20) |
| dub — Kingston 1973 |  33.9% | 0.243 | reggae 1.00 (1.00) |
| countrypop — Nashville 1945 |  33.7% | 0.272 | gospel 0.62 (0.50), blues 0.38 (0.50) |
| trap — Atlanta 2003 |  23.2% | 0.329 | boombap 1.00 (1.00) |
| ska — Kingston 1962 |  14.2% | 0.323 | blues 1.00 (1.00) |
| funk — Cincinnati 1967 |   9.6% | 0.323 | gospel 0.43 (0.45), blues 0.35 (0.35), motown 0.22 (0.20) |
| ambient — London 1978 |   0.0% | 0.394 | drone 1.00 (1.00) |

## The roots (parents: {})

- **blues** — Chicago 1952 (root under protest; wants: delta blues, boogie-woogie, jump blues)
- **gregorian** — Rome 600 (true root)
- **bulgarian** — Sofia 1975 (root under protest; wants: village diaphony, orthodox chant)
- **drone** — New York 1964 (root under protest; wants: hindustani raga, gagaku, organum)
- **tango** — Buenos Aires 1935 (root under protest; wants: habanera, milonga, candombe, salon music)
- **bossa** — Rio de Janeiro 1958 (root under protest; wants: samba, jazz, choro)

## Phase 2's shopping order — the most-demanded missing ancestors

| ancestor | asked for by | residue left behind |
|---|---|---|
| jazz | 4 (steely, ska, afrobeat, bossa) | 1.048 |
| doo-wop | 4 (isley, beatles, motown, rnb) | 0.660 |
| kraftwerk | 4 (newwave, eurythmics, synthpop, techno) | 0.660 |
| minimalism | 3 (neoclassical, postrock, ambient) | 0.705 |
| electro | 3 (acid, boombap, techno) | 0.600 |
| chuck berry | 3 (rock, beatles, punk) | 0.434 |
| jump blues | 2 (blues, funk) | 0.669 |
| mento | 2 (reggae, ska) | 0.517 |
| organum | 2 (counterpoint, drone) | 0.492 |
| skiffle | 2 (rock, beatles) | 0.213 |
| satie | 1 (ambient) | 0.394 |
| tape music | 1 (ambient) | 0.394 |
| delta blues | 1 (blues) | 0.345 |
| boogie-woogie | 1 (blues) | 0.345 |
| samba | 1 (bossa) | 0.343 |
| choro | 1 (bossa) | 0.343 |
| habanera | 1 (tango) | 0.334 |
| milonga | 1 (tango) | 0.334 |
| candombe | 1 (tango) | 0.334 |
| salon music | 1 (tango) | 0.334 |
| miami bass | 1 (trap) | 0.329 |
| crunk | 1 (trap) | 0.329 |
| village diaphony | 1 (bulgarian) | 0.327 |
| orthodox chant | 1 (bulgarian) | 0.327 |
| calypso | 1 (ska) | 0.323 |
| new orleans second line | 1 (funk) | 0.323 |
| hindustani raga | 1 (drone) | 0.307 |
| gagaku | 1 (drone) | 0.307 |
| appalachian fiddle | 1 (countrypop) | 0.272 |
| anglo-celtic balladry | 1 (countrypop) | 0.272 |
| hardcore rave | 1 (dnb) | 0.258 |
| the amen break | 1 (dnb) | 0.258 |
| chorale | 1 (fugue) | 0.238 |
| italo disco | 1 (house) | 0.233 |
| doom | 1 (sludge) | 0.231 |
| garage rock | 1 (punk) | 0.221 |
| girl groups | 1 (punk) | 0.221 |
| velvet underground | 1 (shoegaze) | 0.216 |
| dream pop | 1 (shoegaze) | 0.216 |
| muzak | 1 (vaporwave) | 0.214 |
| chopped and screwed | 1 (vaporwave) | 0.214 |
| tin pan alley | 1 (motown) | 0.209 |
| highlife | 1 (afrobeat) | 0.205 |
| yoruba drumming | 1 (afrobeat) | 0.205 |
| rocksteady | 1 (reggae) | 0.194 |
| nyabinghi | 1 (reggae) | 0.194 |
| thrash metal | 1 (deathmetal) | 0.191 |
| nwobhm | 1 (deathmetal) | 0.191 |
| bacharach | 1 (steely) | 0.177 |
| hendrix | 1 (isley) | 0.176 |
| krautrock | 1 (postrock) | 0.175 |
| spirituals | 1 (gospel) | 0.175 |
| hymnody | 1 (gospel) | 0.175 |
| moroder | 1 (synthpop) | 0.168 |
| african percussion | 1 (toto) | 0.166 |
| yacht rock | 1 (toto) | 0.166 |
| new jack swing | 1 (jodeci) | 0.163 |
| hip-hop drum programming | 1 (jodeci) | 0.163 |
| philly soul | 1 (disco) | 0.160 |
| latin percussion | 1 (disco) | 0.160 |
| boogie | 1 (citypop) | 0.150 |
| quiet storm | 1 (rnb) | 0.143 |
| jamaican sound system | 1 (boombap) | 0.143 |
| romantic piano miniature | 1 (neoclassical) | 0.135 |
| bo diddley | 1 (beatles) | 0.131 |
| glam rock | 1 (newwave) | 0.127 |

## Headlines

- Most explained: **rock** (London 1969) — 93.8% its parents.
- Least explained among the fitted: **ambient** (London 1978) — 0.0%; the rest is what it invented.
- Biggest residue: **ambient** (rms 0.394).
- The founding example: **Liverpool 1962 is 83.5% its parents** (blues + motown + countrypop + counterpoint); 16.5% is what the Beatles invented — and the declared wants (skiffle, bo diddley, chuck berry, doo-wop) say where to look for the rest.


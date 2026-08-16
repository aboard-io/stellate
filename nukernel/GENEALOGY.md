# GENEALOGY — the fit of the declared parentage

2026-08-16 — nukernel/genealogy.js over the 52 real anchors in nukernel/genres.js.

Each anchor's 27 features are read off the anchor data itself (the field-by-feature table is documented at the top of genealogy.js); each child is then fitted as a non-negative combination of its DECLARED parents' vectors. R² is how much of the child the parents explain; the residue is the invention.

## The children, best-explained first

| child | R² | residue (rms) | fitted weights (declared) |
|---|---|---|---|
| rock — London 1969 |  93.8% | 0.081 | blues 0.07 (0.45), chuckberry 0.00 (0.20), beatles 0.89 (0.25), skiffle 0.03 (0.10) |
| newwave — London 1979 |  87.6% | 0.127 | punk 0.51 (0.40), beatles 0.31 (0.30), disco 0.18 (0.20), kraftwerk 0.00 (0.10) |
| beatles — Liverpool 1962 |  86.1% | 0.121 | skiffle 0.09 (0.18), chuckberry 0.11 (0.15), doowop 0.00 (0.12), bodiddley 0.09 (0.10), blues 0.00 (0.12), motown 0.00 (0.10), countrypop 0.51 (0.08), counterpoint 0.21 (0.15) |
| neoclassical — Berlin 2011 |  85.4% | 0.133 | ambient 0.04 (0.40), postrock 0.89 (0.25), minimalism 0.07 (0.20), drone 0.00 (0.15) |
| eurythmics — London 1983 |  84.9% | 0.124 | synthpop 0.57 (0.40), motown 0.05 (0.25), kraftwerk 0.35 (0.20), funk 0.03 (0.15) |
| rnb — Philadelphia 1994 |  83.0% | 0.143 | gospel 0.00 (0.30), motown 0.59 (0.25), jodeci 0.41 (0.25), doowop 0.00 (0.20) |
| citypop — Tokyo 1984 |  80.8% | 0.150 | toto 0.04 (0.35), steely 0.21 (0.35), disco 0.76 (0.30) |
| jodeci — Charlotte 1991 |  79.2% | 0.163 | gospel 0.50 (0.50), funk 0.00 (0.30), motown 0.50 (0.20) |
| disco — New York 1977 |  78.6% | 0.160 | funk 0.14 (0.45), motown 0.86 (0.35), gospel 0.00 (0.20) |
| synthpop — Basildon 1981 |  78.4% | 0.166 | newwave 0.87 (0.45), disco 0.00 (0.30), kraftwerk 0.13 (0.25) |
| boombap — New York 1994 |  76.3% | 0.143 | isley 0.48 (0.35), funk 0.07 (0.30), disco 0.44 (0.20), electro 0.02 (0.15) |
| deathmetal — Tampa 1990 |  76.2% | 0.191 | punk 0.85 (0.55), rock 0.15 (0.45) |
| kraftwerk — Düsseldorf 1977 |  76.0% | 0.166 | beatles 0.29 (0.45), drone 0.11 (0.30), minimalism 0.60 (0.25) |
| electro — New York 1982 |  74.1% | 0.184 | funk 0.00 (0.35), kraftwerk 0.72 (0.25), synthpop 0.16 (0.20), disco 0.12 (0.20) |
| bossa — Rio de Janeiro 1958 |  72.7% | 0.179 | jazz 1.00 (1.00) |
| toto — Los Angeles 1982 |  71.1% | 0.166 | steely 0.70 (0.45), rock 0.00 (0.30), funk 0.29 (0.25) |
| gospel — Chicago 1932 |  71.0% | 0.175 | blues 1.00 (1.00) |
| steely — Los Angeles 1977 |  69.1% | 0.174 | jazz 0.21 (0.35), rock 0.60 (0.30), motown 0.00 (0.25), blues 0.20 (0.10) |
| doowop — Harlem 1955 |  69.0% | 0.188 | gospel 0.80 (0.60), blues 0.20 (0.40) |
| isley — Teaneck 1973 |  68.2% | 0.168 | gospel 0.40 (0.30), funk 0.00 (0.30), rock 0.31 (0.25), doowop 0.29 (0.15) |
| postrock — Austin 2003 |  67.6% | 0.175 | ambient 0.38 (0.35), rock 0.36 (0.30), shoegaze 0.20 (0.20), minimalism 0.07 (0.15) |
| skiffle — London 1956 |  66.8% | 0.190 | countrypop 0.82 (0.40), blues 0.15 (0.40), gospel 0.04 (0.20) |
| chuckberry — St. Louis 1955 |  65.7% | 0.191 | blues 0.52 (0.60), countrypop 0.48 (0.40) |
| shoegaze — London 1991 |  64.4% | 0.216 | punk 0.54 (0.40), drone 0.38 (0.30), beatles 0.08 (0.30) |
| motown — Detroit 1965 |  63.8% | 0.198 | gospel 0.40 (0.40), blues 0.21 (0.25), doowop 0.39 (0.35) |
| counterpoint — Vienna 1725 |  63.6% | 0.184 | gregorian 1.00 (1.00) |
| reggae — Kingston 1969 |  63.1% | 0.194 | ska 1.00 (1.00) |
| punk — New York 1976 |  62.2% | 0.217 | rock 0.37 (0.45), beatles 0.48 (0.40), chuckberry 0.15 (0.15) |
| house — Chicago 1986 |  61.5% | 0.233 | disco 0.78 (0.70), gospel 0.22 (0.15), funk 0.00 (0.15) |
| afrobeat — Lagos 1971 |  60.0% | 0.196 | funk 0.85 (0.70), jazz 0.15 (0.30) |
| garage — London 1999 |  59.6% | 0.218 | house 0.52 (0.45), rnb 0.31 (0.30), dnb 0.17 (0.25) |
| techno — Detroit 1988 |  58.7% | 0.218 | house 0.15 (0.30), kraftwerk 0.27 (0.25), electro 0.00 (0.20), funk 0.37 (0.20), synthpop 0.22 (0.05) |
| vaporwave — Portland 2011 |  51.0% | 0.214 | citypop 0.06 (0.40), rnb 0.94 (0.30), ambient 0.00 (0.30) |
| acid — Chicago 1987 |  50.5% | 0.210 | house 0.00 (0.70), electro 0.58 (0.15), funk 0.42 (0.15) |
| ska — Kingston 1962 |  49.1% | 0.249 | jazz 1.00 (0.50), blues 0.00 (0.50) |
| jazz — New York 1945 |  48.0% | 0.241 | blues 1.00 (1.00) |
| sludge — New Orleans 1991 |  46.2% | 0.231 | punk 0.48 (0.40), rock 0.35 (0.35), blues 0.17 (0.25) |
| fugue — Leipzig 1725 |  40.4% | 0.238 | counterpoint 1.00 (0.70), gregorian 0.00 (0.30) |
| spem — London 1570 |  40.1% | 0.269 | counterpoint 0.40 (0.55), gregorian 0.60 (0.45) |
| dnb — London 1994 |  39.3% | 0.258 | dub 0.40 (0.35), funk 0.17 (0.25), house 0.10 (0.20), techno 0.34 (0.20) |
| dub — Kingston 1973 |  33.9% | 0.243 | reggae 1.00 (1.00) |
| countrypop — Nashville 1945 |  33.7% | 0.272 | gospel 0.62 (0.50), blues 0.38 (0.50) |
| trap — Atlanta 2003 |  23.2% | 0.329 | boombap 1.00 (1.00) |
| funk — Cincinnati 1967 |   9.6% | 0.323 | gospel 0.43 (0.45), blues 0.35 (0.35), motown 0.22 (0.20) |
| ambient — London 1978 |   0.0% | 0.371 | drone 0.72 (0.65), minimalism 0.28 (0.35) |
| bodiddley — Chicago 1955 |   0.0% | 0.311 | blues 0.48 (0.70), gospel 0.52 (0.30) |
| minimalism — New York 1967 |   0.0% | 0.436 | drone 0.27 (0.55), counterpoint 0.73 (0.45) |

## What phase 2 moved — the residues, before and after

| child | R² before | R² after | residue before | after | fell by |
|---|---|---|---|---|---|
| bossa | (root) |  72.7% | 0.343 | 0.179 | 0.164 |
| ska |  14.2% |  49.1% | 0.323 | 0.249 | 0.074 |
| acid |  38.5% |  50.5% | 0.234 | 0.210 | 0.024 |
| ambient |   0.0% |   0.0% | 0.394 | 0.371 | 0.023 |
| eurythmics |  80.3% |  84.9% | 0.142 | 0.124 | 0.018 |
| motown |  59.5% |  63.8% | 0.209 | 0.198 | 0.011 |
| beatles |  83.5% |  86.1% | 0.131 | 0.121 | 0.010 |
| afrobeat |  56.1% |  60.0% | 0.205 | 0.196 | 0.009 |
| isley |  64.9% |  68.2% | 0.176 | 0.168 | 0.008 |
| techno |  57.0% |  58.7% | 0.223 | 0.218 | 0.005 |
| punk |  61.0% |  62.2% | 0.221 | 0.217 | 0.004 |
| steely |  67.9% |  69.1% | 0.177 | 0.174 | 0.003 |
| synthpop |  77.9% |  78.4% | 0.168 | 0.166 | 0.002 |
| neoclassical |  84.9% |  85.4% | 0.135 | 0.133 | 0.002 |
| rock |  93.8% |  93.8% | 0.082 | 0.081 | 0.001 |

**15 children moved; 0.358 of residue (rms, summed) came off the table** — the ancestors the declarations were reaching for through proxies, built and wired in.

## The roots (parents: {})

- **blues** — Chicago 1952 (root under protest; wants: delta blues, boogie-woogie, jump blues)
- **gregorian** — Rome 600 (true root)
- **bulgarian** — Sofia 1975 (root under protest; wants: village diaphony, orthodox chant)
- **drone** — New York 1964 (root under protest; wants: hindustani raga, gagaku, organum)
- **tango** — Buenos Aires 1935 (root under protest; wants: habanera, milonga, candombe, salon music)

## Phase 2's shopping order — the most-demanded missing ancestors

| ancestor | asked for by | residue left behind |
|---|---|---|
| jump blues | 5 (blues, funk, bodiddley, chuckberry, doowop) | 1.359 |
| tin pan alley | 3 (motown, jazz, doowop) | 0.627 |
| tape music | 2 (ambient, minimalism) | 0.808 |
| boogie-woogie | 2 (blues, chuckberry) | 0.536 |
| delta blues | 2 (blues, skiffle) | 0.536 |
| organum | 2 (counterpoint, drone) | 0.492 |
| latin percussion | 2 (disco, bodiddley) | 0.471 |
| mento | 2 (reggae, ska) | 0.443 |
| moroder | 2 (synthpop, electro) | 0.350 |
| krautrock | 2 (postrock, kraftwerk) | 0.341 |
| modal jazz | 1 (minimalism) | 0.436 |
| west african drumming | 1 (minimalism) | 0.436 |
| satie | 1 (ambient) | 0.371 |
| habanera | 1 (tango) | 0.334 |
| milonga | 1 (tango) | 0.334 |
| candombe | 1 (tango) | 0.334 |
| salon music | 1 (tango) | 0.334 |
| miami bass | 1 (trap) | 0.329 |
| crunk | 1 (trap) | 0.329 |
| village diaphony | 1 (bulgarian) | 0.327 |
| orthodox chant | 1 (bulgarian) | 0.327 |
| new orleans second line | 1 (funk) | 0.323 |
| hambone | 1 (bodiddley) | 0.311 |
| hindustani raga | 1 (drone) | 0.307 |
| gagaku | 1 (drone) | 0.307 |
| appalachian fiddle | 1 (countrypop) | 0.272 |
| anglo-celtic balladry | 1 (countrypop) | 0.272 |
| hardcore rave | 1 (dnb) | 0.258 |
| the amen break | 1 (dnb) | 0.258 |
| calypso | 1 (ska) | 0.249 |
| swing | 1 (jazz) | 0.241 |
| ragtime | 1 (jazz) | 0.241 |
| new orleans jazz | 1 (jazz) | 0.241 |
| chorale | 1 (fugue) | 0.238 |
| italo disco | 1 (house) | 0.233 |
| doom | 1 (sludge) | 0.231 |
| garage rock | 1 (punk) | 0.217 |
| girl groups | 1 (punk) | 0.217 |
| velvet underground | 1 (shoegaze) | 0.216 |
| dream pop | 1 (shoegaze) | 0.216 |
| muzak | 1 (vaporwave) | 0.214 |
| chopped and screwed | 1 (vaporwave) | 0.214 |
| highlife | 1 (afrobeat) | 0.196 |
| yoruba drumming | 1 (afrobeat) | 0.196 |
| rocksteady | 1 (reggae) | 0.194 |
| nyabinghi | 1 (reggae) | 0.194 |
| t-bone walker | 1 (chuckberry) | 0.191 |
| thrash metal | 1 (deathmetal) | 0.191 |
| nwobhm | 1 (deathmetal) | 0.191 |
| trad jazz revival | 1 (skiffle) | 0.190 |
| work song | 1 (skiffle) | 0.190 |
| jubilee quartets | 1 (doowop) | 0.188 |
| barbershop | 1 (doowop) | 0.188 |
| yellow magic orchestra | 1 (electro) | 0.184 |
| hip-hop dj culture | 1 (electro) | 0.184 |
| samba | 1 (bossa) | 0.179 |
| choro | 1 (bossa) | 0.179 |
| spirituals | 1 (gospel) | 0.175 |
| hymnody | 1 (gospel) | 0.175 |
| bacharach | 1 (steely) | 0.174 |
| hendrix | 1 (isley) | 0.168 |
| stockhausen | 1 (kraftwerk) | 0.166 |
| schlager | 1 (kraftwerk) | 0.166 |
| african percussion | 1 (toto) | 0.166 |
| yacht rock | 1 (toto) | 0.166 |
| new jack swing | 1 (jodeci) | 0.163 |
| hip-hop drum programming | 1 (jodeci) | 0.163 |
| philly soul | 1 (disco) | 0.160 |
| boogie | 1 (citypop) | 0.150 |
| quiet storm | 1 (rnb) | 0.143 |
| jamaican sound system | 1 (boombap) | 0.143 |
| romantic piano miniature | 1 (neoclassical) | 0.133 |
| glam rock | 1 (newwave) | 0.127 |

## Headlines

- Most explained: **rock** (London 1969) — 93.8% its parents.
- Least explained among the fitted: **minimalism** (New York 1967) — 0.0%; the rest is what it invented.
- Biggest residue: **minimalism** (rms 0.436).
- The founding example: **Liverpool 1962 is 86.1% its parents** (skiffle + chuckberry + doowop + bodiddley + blues + motown + countrypop + counterpoint); 13.9% is what the Beatles invented — and it owes nothing further: every ancestor it once named is an anchor in the table, so what is left is the invention.


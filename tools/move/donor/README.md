# The donor

`Song.abl` is a Move Set saved by an Ableton Move running firmware 2.1, captured through
Schwung's test fixtures. `nukernel/export/move.js` rewrites it rather than writing a Set from
a specification, for the reason `nukernel/export/als.js` gives for the same choice on the
Live side: the format is undocumented but stable, so this converts "reverse engineer Move"
into "edit a file Move itself wrote".

What ships from the donor untouched: the four tracks' device chains and their grammar, the
mixer, the master chain, the groove pool, `melodicLayout`, `stepEditorResolution`, the scene
colours, and every key and JSON type the gate then checks the output against. What gets
replaced: the clips, the scene names, `tempo`, `rootNote`, `scale`, the track names, and
`timeSignature` — which this donor does not have at all, because schema 1.8.2 predates it.
Move writes 1.8.3 now and accepts the field; `move-gate.js` gate 0 allows that one addition
and nothing else.

It matters that track 1 carries a drum kit. `kitMap` reads the kit's own pads out of its
sample names to decide where a kick or a hat goes, so a donor without one cannot be used —
`hasKit` refuses it rather than writing drums onto pads that do not exist, and gate K checks
every drum note against the kit that ended up in the file.

Replacing this donor is legitimate — a Set from a newer firmware would let the writer follow
Move forward. Re-run `node tools/move/move-gate.js --sweep` afterwards: gate 0 compares
against whatever donor is here, so a new one silently changes what "matches the donor" means.

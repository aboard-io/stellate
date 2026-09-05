// nukernel/src/copy/produce.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the op bar and its refusals — ui/produce.js, producer.js: the subject tree, the adjectives, why a word is withheld
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// THE REFUSALS ARE THE POINT OF THIS PAGE (TABLE.md §12b names it by name).
// `ui/produce.js`'s WHY table was a SENTENCE ASSEMBLER: `spent: (w) => "it's
// as " + w + " as it's going to get"` printed "it's as brighter as it's going
// to get" in forty-eight rendered places, `notplaying` computed English
// subject-verb agreement from `/s$/.test(S.bare)`, and `dishonest` glued a
// subject onto "that is not an honest word about ". None of that survives
// translation, so every refusal below is ONE KEY holding ONE WHOLE SENTENCE.
//
// AND NO CALLER COMPUTES AGREEMENT. Where a refusal would have had to inflect
// with its subject ("the drums ARE not playing" / "the cantor IS not
// playing"), the subject is dropped instead of conjugated: the sentence sits
// BESIDE the control that already names it (DESIGN.md §2, component 14 — a
// refusal is never a missing control), so "Not playing on this record" is
// both shorter and true of every noun in every language. `{name}` is spent
// only where the sentence stands alone with nothing beside it.
//
// THE PAGE AND THE MOVER READ THE SAME KEYS. `ui/produce.js` greys a word
// before it is said and `producer.js speak` refuses it after — and the two
// have to say the same thing or the box lies to a thumb. That identity used
// to be kept by copying producer.js's sentences into ui/produce.js by hand;
// it is kept by the `refuse.` family now, read from both files.

import type { Table } from "./api.js";

export const PRODUCE: Table = {
  /* ===== WHY A WORD IS WITHHELD ==========================================
     Read by ui/produce.js (`subjects`, `targets`, the ceiling hint) and by
     producer.js (`speak`'s honest failures). Budget: 12 words. */
  "refuse.noDrums": "There are no drums on this record",
  "refuse.notPlaying": "Not playing on this record",
  "refuse.notHere": "Not on this record",
  "refuse.spent": "Already at the limit",
  "refuse.noMove": "Nothing here would change {name}",
  "refuse.noWords": "No words available for {name}",
  "refuse.notAWord": "Not available for {name}",
  "refuse.genreSilent": "{genre} does not change {name}",
  "refuse.ceiling": "That is {n} notes — take one off first",

  /* ===== THE CAST — the seventeen subjects a sentence can be about =======
     producer.js's SUBJ table holds these KEYS and reads them through a getter
     at print time (a classic script may not ask the catalogue at load). The
     chip's face and the sentence's object are the same string, so the row of
     chips and "make the drums harder" cannot spell one player two ways. */
  "produce.subj.record": "the sound",
  "produce.subj.drums": "the drums",
  "produce.subj.kick": "the kick",
  "produce.subj.snare": "the snare",
  "produce.subj.hats": "the hats",
  "produce.subj.toms": "the toms",
  "produce.subj.cymbals": "the cymbals",
  "produce.subj.perc": "the percussion",
  "produce.subj.bass": "the bass",
  "produce.subj.line": "the bass line",
  "produce.subj.bamp": "the bass sound",
  "produce.subj.keys": "the keys",
  "produce.subj.guitar": "the guitar",
  "produce.subj.amp": "the amp",
  "produce.subj.voice": "the voice",
  "produce.subj.tune": "the tune",
  "produce.subj.mix": "the mix",

  /* ===== THE SURFACE ===================================================== */
  "produce.name": "Producer",
  "produce.count": "{n} of {max} notes",

  /* THE SENTENCE THE TAPS BUILD, and producer.js `sentence` is its one
     assembler. Two keys rather than a ternary on the descriptor: a language
     that puts the quality first is a table edit here and nothing else. */
  "produce.sentence": "make {name} {quality}",
  "produce.sentenceBare": "make {name}",
  "produce.saying": "make {name} …",
  "produce.subject": "the {name}",
  "produce.thisNote": "this note",

  /* ===== THE NOTE STACK ================================================== */
  "produce.caption": "Applied in order",
  "produce.colNote": "Note",
  "produce.colAmount": "Amount",
  "produce.colResult": "Result",
  "produce.colChange": "Change",
  "produce.pushAgain": "Push this note further",
  "produce.onNote": "on {note}",
  "produce.takeOff": "Take off",
  "produce.clearAll": "Clear all notes",
  "produce.clearAll.title": "Remove every note from the record",
  "produce.orphan": "{name} is gone; its note too",

  /* WHAT ONE PRESS OF UNDO PUTS BACK — a whole sentence per move, because
     "Undo " + a fragment is the same bug the refusals had. */
  "produce.undo.note": "Undo — {note}",
  "produce.undo.more": "Undo more on {note}",
  "produce.undo.less": "Undo less on {note}",
  "produce.undo.off": "Undo removing {note}",
  "produce.undo.clear.one": "Undo clearing {n} note",
  "produce.undo.clear.other": "Undo clearing {n} notes",

  /* ===== THE TARGET SHEETS =============================================== */
  "produce.qualities": "Qualities",
  "produce.records": "Records",
  "produce.bareAdd.title": "Add {name} in this genre's style",
  "produce.hidden.one": "{n} more record this cannot change",
  "produce.hidden.other": "{n} more records this cannot change",

  /* HELD AS DATA BY producer.js's own verb row and printed by whoever draws
     it — the classic-script law: a table may carry a KEY, never a sentence. */
  "produce.makeSay": "Change the sound",
};

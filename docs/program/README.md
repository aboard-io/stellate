# The program documents

These nineteen files were `nukernel/*.md` until 2026-09-09. They moved here in
one motion, unchanged, because the deploy copies `nukernel/*` to the web root —
so every one of them was a page on the public site, and the tree a developer
opens first was four hundred kilobytes of prose before it was any code.

**Every citation in the source still points at the old path** (`nukernel/TABLE.md
§24`, `nukernel/GENRES.md`, and some hundreds more). They were not rewritten:
the citations are prose inside comments, a sed across them would be the largest
and least reviewable diff in this repository's history, and the section numbers —
which is what a reader actually follows — are unchanged. If a citation names
`nukernel/<NAME>.md`, it is `docs/program/<NAME>.md` now.

**What each one is**, in the order a new reader would want them:

| | |
|---|---|
| `TABLE.md` | the table's own design, §1–§25 — the document most citations point at |
| `DESIGN.md` | the design system: tokens, the fifteen components, the laws |
| `GENRES.md` | the contract for `nukernel/genres/*.json` and the build |
| `LAUNCH.md` | the 2026-09-08 launch: the plan, the runbook, the rollback |
| `KERNEL.md` `COMPOSER.md` `MOTIF.md` `VOICE.md` `EQ.md` | the engine and its parts |
| `WIKI.md` `WORLD.md` `GLOBE.md` `AFRICA.md` | the catalogue, its links and its map |
| `AXES.md` `STATE.md` `PROGRAM.md` `FUTURE.md` `INTERVIEW.md` | the vocabulary, the state, the plans |
| `BOARD-ROUTING.md` | the mixer's routing |

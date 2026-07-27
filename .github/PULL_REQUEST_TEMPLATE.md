## What changed

<!-- One subject per PR. What, and why it belongs in the genre space. -->

## Gates run

<!-- Machines verify structure; human ears verify taste. -->

- [ ] `./verify.sh` green
- [ ] `node test/theory.test.js && node test/pipes.test.js` green
- [ ] Browser gates (only if the UI changed — see CLAUDE.md)
- [ ] I listened to it (what, and how it sounded):

**Matrix status:** `node engine/genre-verifier.js matrix --no-cache` prints
`diagonal dominant: 274/274` → <!-- yes / n/a (no kernel/engine change) -->

## Media policy attestation

- [ ] No audio/video/SoundFont/model binaries committed — new material is
      recipe + manifest + registry entries only, with a SOURCES.md ledger
      entry (license + flags), wired matrix-safe (CONTRIBUTING.md)

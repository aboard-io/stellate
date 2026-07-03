# faust/legacy-tools

Dev tools that compare against the **legacy csound engine** — they need
`csound` on PATH and the csound codegen (`CsdEngine.buildCsd`), which was
removed from main in the FAUST-PORT phase-3 switchover.

To run `ab-render.js` (the per-voice A/B harness behind `../ab-report.md`),
check out branch `legacy-csound`, where the full csound side still exists.

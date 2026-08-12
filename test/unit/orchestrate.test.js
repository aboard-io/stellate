#!/usr/bin/env node
// orchestrate.test.js — choose an instrument by what the part needs.
//
// NOT WIRED TO ANYTHING YET. This gates the half that works — the hard
// constraint — and pins the two known flaws so they cannot be forgotten.
"use strict";
const O = require("../../engine/orchestrate.js"), E = require("../../engine/csd-engine.js"), K = require("../../engine/genre-kernel.js");
let f = 0, c = 0;
const ok = (x, m) => { c++; if (!x) { f++; console.log("  FAIL " + m); } };
const stOf = (g) => (function (t) { return t.state || t; })(K.track(g, { seed: 7 }));

console.log("\n1. capabilities come from the registry, not from opinion");
{
  const caps = O.capabilities(K);
  const ids = Object.keys(caps);
  ok(ids.length > 100, ids.length + " instruments have capability rows");
  ok(ids.every((i) => typeof caps[i].sustains === "boolean" && caps[i].ring >= 0), "every row has sustain and ring");
  const decay = ids.filter((i) => !caps[i].sustains);
  ok(decay.length > 5 && decay.length < 30, decay.length + " are decay-only — the thing brightness cannot see");
  ok(!caps.woodblock || !caps.woodblock.sustains, "a woodblock does not sustain");
  ok(!caps.strings || caps.strings.sustains, "strings do");
}

console.log("\n2. the hard constraint is hard");
{
  for (const g of ["vaporwave", "acidhouse", "citypop", "ambient"]) {
    const st = stOf(g), ev = E.buildEvents(st).pitched;
    for (const v of ["bass", "pad", "melody"]) {
      const d = O.demands(ev, v, st.bpm);
      if (!d) continue;
      ok(d.longest > 0 && d.n > 0, g + "/" + v + ": demands are read off real events");
      // NOTHING PROPOSED MAY BE UNABLE TO PLAY THE PART. A note held longer than
      // an instrument rings, on an instrument that cannot loop, is simply absent
      // for the rest of its length — so this disqualifies rather than ranks.
      const bad = O.rank(d, { slot: v }, K).filter((r) => !O.canHold(r.cap, d));
      ok(bad.length === 0, g + "/" + v + ": no candidate that cannot hold the part (" + bad.length + ")");
      const rej = O.rejected(d, K);
      ok(rej.every((r) => r.ring * 1.2 < d.longest), g + "/" + v + ": every rejection is justified by its ring time");
      if (d.longest > 3) ok(rej.length > 0, g + "/" + v + ": a " + d.longest.toFixed(1) + "s note rules something out");
    }
  }
}

console.log("\n3. the two known flaws, pinned so they cannot be forgotten");
{
  // FLAW ONE: it cannot propose a synth. capabilities() walks K.SAMPLERS, so
  // tb303 and saw are not candidates at all — for acid house the correct answer
  // is structurally unavailable.
  const caps = O.capabilities(K);
  ok(!caps.tb303, "KNOWN: no synth has a capability row — tb303 is not a candidate");
  ok(!caps.saw, "KNOWN: nor saw");

  // FLAW TWO: register is weighted 2.6 against differentiators near 0.2, so once
  // the slot is known the PART barely moves the ranking. Two very different bass
  // parts still rank identically.
  const a = stOf("vaporwave"), b = stOf("acidhouse");
  const da = O.demands(E.buildEvents(a).pitched, "bass", a.bpm);
  const db = O.demands(E.buildEvents(b).pitched, "bass", b.bpm);
  ok(Math.abs(da.longest - db.longest) > 0.4, "the two bass parts genuinely differ (" + da.longest.toFixed(2) + "s vs " + db.longest.toFixed(2) + "s)");
  const ta = O.rank(da, { slot: "bass" }, K).slice(0, 3).map((x) => x.id).join(",");
  const tb = O.rank(db, { slot: "bass" }, K).slice(0, 3).map((x) => x.id).join(",");
  ok(ta === tb, "KNOWN: and they still rank identically (" + ta + ") — register swamps the part");
}
console.log("\n" + (f ? "FAIL" : "PASS") + " — " + (c - f) + "/" + c + " checks");
process.exit(f ? 1 : 0);

# TIMING AUDIT — 2026-07-25

A measurement pass on scheduling, clock domains and groove, prompted by Paul:
*"drill in deeply on timing and scheduling. It seems fine but I'm paranoid. Am I
hearing tiny gaps? Are we scheduling the audio threads correctly? Isn't it
possible we missed something."*

Method: headless probes against the real engine (chromium + the pinned
playwright), an AudioWorklet tap that sees **every sample** of the master, the
engine's own sensors (`C_UNDER_CNT`, `runwaySec`, `clickMon`), a
`AudioBufferSourceNode.prototype.start` patch, `PerformanceObserver('longtask')`,
plus node-side census runs over all 274 genres. Companion work: the offline grid
measurement and the groove census (both summarised below).

Every claim is tagged **MEASURED** (a number from running the engine),
**INFERRED** (read from source, arithmetic follows), or **GUESS**.

**Nothing was changed.** No engine source, no gate, no data. This document and
the numbers in it are the whole deliverable.

Ordered by *what would actually change what he hears*.

---

## Finding 1 — The live engine drops about a quarter of its chord-bar downbeats

**MEASURED, in the real live engine, and reproduced offline across 205 genres.**
This is the biggest thing found and it was not previously known.

### The mechanism (INFERRED from code, then MEASURED)

`makeWalk` (`/home/ford/stellate/engine/faust/live.js:133-215`) regenerates the
**whole collapsed section** every chord bar, with a **different seed each bar**:

```js
const one = Object.assign({}, st, { sections: [sec],
  seed: ((st.seed || 1) + serial * 7919) >>> 0, … });   // live.js:186
…
const lo = ci * CBEATS, hi = lo + CBEATS;               // live.js:190
const m = SE.mapEvents(E, one, ev, { lo, hi, units });  // live.js:205
```

`mapEvents` windows **half-open on the post-groove beat**
(`/home/ford/stellate/engine/faust/state-engine.js:1795`):

```js
const win = (b) => b >= lo && b < hi;
```

and `applyGroove` has already jittered every beat by `±humanize·0.04` beats
(`/home/ford/stellate/engine/csd-engine.js:1273`).

So the event nominally **at** a chord-bar boundary `L` exists in *two different
generations* — bar k-1's (whose window is `[…, L)`) and bar k's (whose window is
`[L, …)`) — and each generation draws its jitter **independently**:

- bar k-1 plays it iff its copy jittered to `beat < L`
- bar k plays it iff its copy jittered to `beat >= L`

Independent symmetric draws ⇒ **25% nobody plays it, 25% both play it.**

### The numbers

**MEASURED in the browser**, real `FaustLive` ring path, `house`, 48 live bars,
`FaustStateEngine.mapEvents` instrumented in-page
(scratchpad `seam-live.js`):

| lane | seams | LOST | DOUBLED | OK |
|---|---|---|---|---|
| kick | 33 | **9 (27.3%)** | 5 (15.2%) | 19 |
| hat | 26 | **11 (42.3%)** | 8 (30.8%) | 7 |

**MEASURED offline over 205 genres × 24 bars** (same walk arithmetic replayed in
node, scratchpad `seam2.js`):

| lane | seams | LOST | DOUBLED |
|---|---|---|---|
| kick | 2680 | **642 (24.0%)** | 630 (23.5%) |
| hat | 804 | **186 (23.1%)** | 180 (22.4%) |

Pitched lanes, 7 genres × 24 bars (`seam3.js`):

| lane | seams | LOST | DOUBLED |
|---|---|---|---|
| pad | 92 | **20 (21.7%)** | 26 (28.3%) |
| bass | 64 | **17 (26.6%)** | 15 (23.4%) |
| melody | 25 | **5 (20.0%)** | 7 (28.0%) |

Corroboration of the mechanism from an independent direction: the genres that
measure **0%** are exactly the ones with a **positive `timeFeel.pushPull` on the
kick** — `sludgemetal` (+26 ms), `bogironwallow` (+42 ms), `barrowwake`
(+62 ms). A systematic positive offset pushes the event permanently into the
current bar's window, so it can never fall through the seam. That is the model
predicting a result before it was looked for.

### What it sounds like

- The lanes fail **independently**, so at any given chord-bar downbeat
  `P(at least one of kick/hat/pad/bass is missing) ≈ 1 − 0.76⁴ ≈ **67%**`.
  **INFERRED** from the four measured per-lane rates.
- Net event count is barely changed: **MEASURED** `house` over 96 bars, live vs
  a press-like single-generation walk — pad +0.4%, bass +0.5%, kick +0.3%,
  hat +0.2%; empty-bar counts identical. So this is **not** a general thinning.
  It is a coin-flip on the single most structurally important hit in the bar,
  re-flipped every chord change.
- "DOUBLED" is benign: the two copies land **0.0045 beats ≈ 2 ms** apart
  (MEASURED mean double-gap, house) — a thickened/comb-filtered hit, not a flam.
- At house tempo (125 bpm, 8-beat chord bars, 4 chords) the interior seams come
  **11.7 times a minute**, so ≈ **2.8 dropped downbeat kicks per minute**, and
  something missing from the downbeat about **8 times a minute**.

### Why it has never shown up

**This is LIVE-ONLY.** `press.js` generates the whole song in one pass — one
generation, no windows, no seam. So:

- everything Paul exports (WAV/MP3/MIDI, `sample.mp4`, journeys) is clean;
- everything he *hears in the app* has this;
- **the export does not match the live playback**, which is itself worth knowing.

### The gate hole

`test/segment-parity-test.js` proves worker-rendered segments equal the press
bytes **within one generation**. Nothing anywhere compares the *live per-bar
walk's event stream* to the *press event stream* over a boundary. This is the
same shape of hole as the crossfade one that let the tape-wobble lurch through:
**the gate tests inside a unit, never across the join.**

The gate that would have caught it: replay `makeWalk` for N bars in node,
concatenate the windowed event streams, and assert that every event the
press-path generation of the same section places within `±humanize·0.04` of a
chord-bar boundary appears **exactly once** in the concatenation. ~40 lines,
pure node, no browser.

### Fix sketch (NOT implemented — it changes audible output everywhere)

Ownership must be decided on a quantity both bars agree on. Options, cheapest
first:

1. **Window on the pre-groove nominal beat.** Have `applyGroove` stamp
   `e.beat0` (the un-jittered beat) and have `win()` test `beat0` while the
   event still *plays* at its jittered `beat`. Byte-identical for every event
   not on a seam; on seams it makes ownership deterministic. Cost: one field +
   one predicate.
2. **Generate once per progression cycle** and slice all `nch` bars from it.
   Kills the seam entirely but changes the per-bar variation law (`serial*7919`)
   that the whole catalog was tuned against.
3. **Guard band**: `win(b) = b >= lo - G && b < hi - G` with `G` above the
   maximum groove displacement. Cheapest, but `pushPull` is legal to ±0.25 beat
   (`engine/invariants.js:188`), so `G` cannot be a constant.

Option 1 is the one to price. It will trip `test/meter.test.js`
`head_byte_identity` (live-side only; press bytes unchanged) and wants a
`genre-verifier.js matrix --no-cache` re-run even though the verifier reads the
press path.

---

## Finding 2 — Every crossfade costs ~0.4 s of dry ring, and dumps the incoming genre's first ~0.45 s of drums in one clump

**MEASURED.** 8-minute headless ride, desktop ring path, 19 genre swaps at 25 s
intervals (`timing-probe.js --min 8 --swapEvery 25`).

### Ring underruns: every swap, no exceptions

`C_UNDER_CNT` rose **3437 quanta over 479 s**, and **100% of them were inside a
crossfade window**. Per swap:

```
after swap->house  @25s : +143 quanta (0.42 s)
after swap->dub    @50s : +131          (0.38 s)
after swap->ambient@75s : +140          (0.41 s)
after swap->jazz  @100s : +757          (2.20 s)   <- outlier
after swap->vapor @125s : +458          (1.33 s)   <- outlier
after swap->jungle@150s : +37           (0.11 s)
… 13 more, all 131-141 quanta (0.38-0.41 s)
```

`XFADE_MS = 400` (`live.js:52`) and one quantum is 2.9 ms → **138 quanta is
exactly one full ramp with the outgoing ring dry.** 16 of 19 swaps hit that
number within ±5%. This is the open audit finding
*"Fade with an empty playQueue anchors at fedEnd: the outgoing ring is dry for
the entire 400 ms ramp"* (ENGINE-AUDIT-2026-07 Tier 2), now measured: it is not
an edge case, it is **every steer**.

**Crucially, the runway was healthy throughout.** At every underrun burst,
`runwaySec` read **3.36–27.7 s** and `loadRatio` read **1.00**. The engine was
never behind. `TARGET_SEC = 3.0` is *not* the problem and raising it would not
help.

### The audible consequence, caught in the output tap

The tap (an AudioWorklet on `handle.analyser`, so it sees every sample
post-mastering):

- **A 13 184-sample run of exact zeros at t = 137.73 s — 299 ms of digital
  silence**, with the short-window RMS at 0.0227 immediately before it (i.e. the
  program was loud). Its edges register as sample-to-sample jumps of **0.923 and
  0.884** — near-full-scale clicks.
- A second zero-run of 55 samples (1.25 ms) at t = 459.06 s carrying the run's
  single biggest discontinuity, **0.975**.
- Near-silent 100 ms windows (`rms < 0.01`) cluster at t ≈ 80.1–80.5 (0.5 s),
  108.4–109.6 (1.3 s), 131.4–132.4 (1.0 s), 137.9–138.0, 200.7–201.7 —
  **4 of the 19 swaps produced a ≥0.5 s audible level collapse**, plus several
  single-window dips.

So: **yes, Paul is hearing gaps. They are at the steers.** About one steer in
five dips hard for half a second or more; one in nineteen went fully silent for
a third of a second.

### The other half: the incoming genre's first bar is ~450 ms overdue

**MEASURED** via `onBar`, computing `ctx.currentTime − when` *inside* `fireBar`
(this is exactly how late the bar's native scheduling anchor is):

| | value |
|---|---|
| n bars | 102 |
| p50 | 23.2 ms |
| p75 | 45.0 ms |
| **p90** | **433.9 ms** |
| p99 | 461.5 ms |
| max | 464.4 ms |
| bars > 300 ms late | **19 / 102** |

**19 bars over 300 ms late, 19 swaps.** One per crossfade, every time.

Mechanism (INFERRED, `live.js:815-826`): `commitFade` sets
`br.startGlobal = fadeStartCursor` — the anchor captured at *fade start* — then
`flushPending(br)` pushes the bridge's queued bars onto that origin. But by the
time commit runs, playback has advanced through the whole 400 ms ramp plus the
3 ms `waitSwap` poll. So the incoming stream's bar 0 is instantly ~400–460 ms
**overdue**, `drainDueBars` fires it immediately, and every native note inside
that first 460 ms gets `start(when)` with `when` in the past — i.e. they all
begin *now*, bunched together, instead of on their grid.

The ring's own (synth) content for that bar is correct and on time. So a steer
sounds like: new genre arrives, its drums/samples stutter and clump for the
first half-second, then lock. **That is the lurch.**

This one is **not** in ENGINE-AUDIT-2026-07 — the audit's fade findings are
about the hidden-tab timer clamp and the dry-ring level dip; the commit-anchor
overdue-bar bunching is new.

### The gate hole

`test/live-test-run.js` does one swap and asserts RMS non-zero and
`loadRatio >= 0.97`. Both of those pass through *all* of the above — the runway
is healthy during the dropout, and 300 ms of silence does not move a 500 ms-poll
RMS average enough to fail. There is no gate on: `C_UNDER_CNT`, output zero-runs,
or `ctx.currentTime − when`.

The gate that would have caught it: a steer probe that (a) asserts
`handle.underruns()` grows by less than one quantum per crossfade, and (b) taps
the master with a worklet and asserts **zero** runs of ≥64 zero samples while the
recent RMS is loud, and (c) asserts `onBar` lateness stays under one bar-drain
period. All three are cheap and all three fail today.

---

## Finding 3 — In steady state the native lane (92.6% of all notes) is anchored 0–45 ms late, re-randomised every bar

**MEASURED.**

### The lane census

`postOpenLive` ships `buffers: {}` on the ring path (`live.js:698`), and `sigOf`
skips sampler units (`live.js:126-131`) with the comment *"found/sampler are
native and don't affect stream topology"*. So on desktop the worker stream
carries **only** the Faust synth voices; every sampled voice and every found
sound is scheduled on the **main thread** by `scheduleNative`
(`live.js:971-1026`), fired from `drainDueBars` on a **30 ms `setInterval`**
(`live.js:958`).

Since the 2026-07-08 "sampled by default" change, that is nearly everything.
**MEASURED** over all 274 genres, whole form, every chord (`lane-split2.js`):

| | value |
|---|---|
| note events on the **NATIVE** (main-thread) lane | **155 431 — 92.6%** |
| note events in the **RING** (worker, sample-exact) | 12 367 — 7.4% |
| median genre's ring share | **0.9%** |
| genres whose whole drum kit is sampled ⇒ native | **254 / 274** |
| genres with **zero** ring events (ring silent) | 56 |
| genres with events on both lanes | 218 / 274 |

The engine's headline property — *"CLICK-FREE BY CONSTRUCTION … no per-bar
AudioBufferSourceNode seams to click"* (`live.js:10-14`) — is true of 7.4% of
the notes. The other 92.6% **are** per-bar `AudioBufferSourceNode`s.

### The lateness

`fireBar` computes the correct target
(`when = ctx.currentTime + (globalStart − pg)/SR`, `live.js:961`) — that maps the
ring frame to the ctx clock properly. The defect is that `drainDueBars` only
*discovers* the bar when its 30 ms poll next runs, and it uses **no lookahead
while visible**:

```js
const horizon = pg + (document.visibilityState === "hidden" ? BAR_LOOKAHEAD_FRAMES : 0);
```

`BAR_LOOKAHEAD_FRAMES` is 0.6 s — so **the hidden-tab path is sample-accurate and
the visible path is not.** The in-code comment says *"Visible drains stay exact,
as before"*; measured, they are not.

**MEASURED**, `ctx.currentTime − when` inside `fireBar`, three runs:

| run | n bars | p50 | p75 | p90 | max | >50 ms |
|---|---|---|---|---|---|---|
| bare engine page, **no steering**, 7 min | 110 | **17.4 ms** | 23.2 | 34.8 | 58.1 | 1 / 110 |
| bare engine page, 19 swaps, 8 min | 102 | 23.2 | 45.0 | 433.9 | 464.4 | 21 / 102 |
| **the real app** (`index.html`), 14 steers, 5 min | 67 | **40.6 ms** | 62.4 | 79.8 | 522.4 | 21 / 67 |

**MEASURED** consequence at the note level: **5.1–7.1% of all `start()` calls
landed in the past** — roughly one note per bar. That note is the one at
`beat == lo`: the downbeat. Everything scheduled ≥ `lateness` into the future is
sample-accurate.

So the audible signature is: **the downbeat cluster is 0–45 ms late relative to
the rest of its own bar, with the offset re-randomised every bar.** Not a
consistent feel — a random one. Combined with Finding 1 (the same downbeat is
also the one that goes missing a quarter of the time), the *"one"* is the least
reliable moment in the music.

### Fix sketch (NOT implemented)

Give the visible path the lookahead the hidden path already has. `when` is
absolute and `start(future)` is sample-accurate, so firing a bar ~100 ms early
makes the downbeat land **exactly** on the ring's grid instead of 0–45 ms late.
Cost: `opts.onBar` (and therefore the chyron playhead, the ⓘ timeline, the
background cart rotator) would lead the audio by the lookahead — which is why
this is a judgement call and not a drive-by fix. A smaller, side-effect-free
variant: keep the horizon at 0 for the `onBar` callback but use a lookahead for
`scheduleNative` only.

---

## Thread / clock map

**INFERRED** from source; the timer periods are quoted from the code.

| what | thread | clock | period |
|---|---|---|---|
| synth stream render | dedicated Worker (`stream-worker.js`), 2 of them ping-ponging | none — pure sample counting | per fed bar |
| ring read → output | **audio thread** (`ring-player.js` AudioWorklet) | sample clock, 1 ring sample per output sample | 128-frame quantum |
| feed pump `pumpOnce` | **main thread** | `setTimeout(pump, 25)` (`live.js:934`) + worker `tick` ~4 Hz | 25 ms |
| bar drain `drainDueBars` → **all sampled + found notes** | **main thread** | `setInterval(…, 30)` (`live.js:958`) + worker tick | **30 ms** |
| crossfade ramp `C_XFADE` | **main thread** | `setInterval(…, 5)` (`live.js:799`) | 5 ms (≥1 s when hidden) |
| swap commit `waitSwap` | **main thread** | `setInterval(…, 3)` (`live.js:809`) | 3 ms |
| load reporter | main thread | `setInterval(…, 250)` | 250 ms |
| native note *placement within* a bar | audio thread | absolute `ctx.currentTime`, sample-accurate | — |
| UI playhead `liveBeat()` | main thread | `ctx.currentTime` vs `barInfo.when` — **correct, single clock** (`app/inside.js:639-645`) | 100 ms |
| background cart rotator | main thread | musical (`onBar`) with a `Date.now()` backstop that stands down while bars flow (`app/background.js:80`) | 1 s |
| mobile WAV/append path | main thread + worker | **one baked timeline**; `el.currentTime` drives only UI | — |

### Clock domains — where two clocks actually meet

There is exactly **one** place where a musical event's timing depends on a
non-audio clock, and it is the important one:

> **`drainDueBars`' 30 ms page timer decides the anchor for 92.6% of the notes.**
> The anchor itself (`when`) is derived correctly from the ring cursor; it is the
> *discovery latency* that leaks the page clock into the music.

Everything else checks out:

- The score's own time is exact. `barLenFrames = round((hi−lo)·spb·SR / 64)·64`
  (`live.js:207`, mirrored at `stream-renderer.js:486`) quantises each bar to 64
  samples — at most **±0.73 ms per bar, same sign every bar at constant bpm**, so
  a constant tempo error of ≤0.03%, and the native lanes re-anchor to the ring
  every bar so it never accumulates. **INFERRED + arithmetic. Benign.**
- Within a bar, ring notes land at `base + floor((beat−lo)·spb·SR)`
  (`stream-renderer.js:145`) and native notes at `when + (beat−lo)·spb`
  (`live.js:983`) — the same grid to sub-millisecond.
- **The mobile WAV-first path has no split clock at all.** `openLiveSegs` ships
  `buffers` (`live.js:1803`) so found + sampler + synth are all **baked into the
  rendered PCM**; `el.currentTime` is used only for `rms()`/`onBar`/buffer
  hygiene, never to place a note. The compromise path is, on this axis, the more
  correct one.
- **App-side:** no musical event derives from `setTimeout`/`rAF`/wall-clock.
  `liveBeat()` uses `ctx.currentTime`; the cart rotator's wall clock only takes
  over when the musical clock has been dead for 8 s.

### A latent desync worth a sensor (INFERRED, not measured)

`read53()` counts **output** frames (`ring-player.js:154-157`, advances every
running quantum), but `playQueue[].globalStart` lives in the **producer's fed-
frame** ledger. On an underrun the reader emits silence and deliberately does
**not** advance `R_READ` — so the two ledgers diverge by the underrun length,
permanently, for the life of that stream. During a normal fade it is ring **A**
that runs dry (A is retired seconds later, so no harm). If ring **B** ever
underruns, the native lanes lead the stream audio by that amount **forever**.
The 757- and 458-quantum outlier bursts above (2.2 s and 1.3 s) are exactly the
shape that would do it, and there is no way to tell from outside: the handle
exposes `underruns()` but not the per-ring cursors. **Recommend a
`handle.ringDeficit()` = `read53() − R_READ(active)` readout** — it is two
`Atomics.load`s and it turns an unfalsifiable worry into a number.

---

## Main-thread jank — is 3 s of runway enough?

**MEASURED**, `PerformanceObserver('longtask')`.

Engine-only page (`test/live-test.html`, **no UI at all**), 8 min, 19 swaps:

| | value |
|---|---|
| long tasks (>50 ms) | 20 |
| p50 / p90 / max | 131 / 534 / **585 ms** |
| total blocked | 4.16 s over 479 s of audio |
| when | clustered at 27.5, 54.4, 54.8, 106.8, 107.3, 144.4 s — **at the swaps** |

So a genre swap costs up to **585 ms of blocked main thread on a page with no UI
whatsoever** — that is the worker open, `buildEvents`, the PCM structured clone
and the decode kickoff. Against `TARGET_SEC = 3.0` that is a 20% bite: adequate,
with real margin. **The runway is not the weak link.** But the same block also
delays `drainDueBars`, which is why the swap bar is ~450 ms late (Finding 2) —
the stall lands on the *scheduler*, not on the *buffer*.

The `deepRunway` hint (8 s while starcruise is up, `live.js:920-921`) is the
right shape of mitigation for GL stalls, but note that it protects the buffer
and does nothing for the scheduler.

### The real app roughly doubles the smear

**MEASURED**, same probe against `index.html` (star map, glyph layer, ⓘ panel,
readouts, background layer all live), 5 min, 14 steers:

| | bare engine page (7 min, idle) | **the real app** (5 min, steering) |
|---|---|---|
| long tasks >50 ms | **4** | **274** |
| p50 / p90 / max | 120 / 267 / 267 ms | 79 / 107 / **623 ms** |
| main thread blocked | 0.51 s of 419 s (0.1%) | **23.15 s of 300 s (7.7%)** |
| runway min | 2.99 s | 2.98 s — **unaffected** |
| ring underruns | **0** | 301 (14 steers) |
| **bar anchor lateness p50** | **17.4 ms** | **40.6 ms** |
| bar anchor lateness p90 | 34.8 ms | 79.8 ms |
| bars > 20 ms late | 42 / 110 | **59 / 67** |

The conclusion is clean and slightly counter-intuitive:

> **UI jank does not starve the audio buffer — it smears the drum timing.**

The runway is untouched (the pump is idempotent and the worker tick backstops
it), but `drainDueBars` shares the main thread with every `preact` render, every
`drawMap`, every glyph cycle — so 7.7% main-thread occupancy pushes the median
native-lane anchor from 17 ms to 41 ms late and the p90 from 35 ms to 80 ms.
**The busier the screen, the looser the drums.** Nothing in the gate wall would
show this, because every existing gate watches `loadRatio`, which stays at 1.00
throughout.

### The control: sitting still is clean

**MEASURED**, 7 minutes, bare engine page, **no steering**, `house`:

| | value |
|---|---|
| ring underruns | **0** |
| output zero-runs ≥32 samples | **0** (excluding the pre-boot silence) |
| gap events (≥64 zeros while loud) | **0** |
| `clickMon.gaps` | 0 |
| near-silent 100 ms windows | 16 of 4185, all at boot |
| runway min / p1 | 2.99 / 3.03 s |

**Every underrun, every zero-run and the only measured audible dropout in this
audit happened at a crossfade.** A stationary desktop ride is solid.



---

## Negative results — things that are fine, with numbers

These cost real effort to establish and are worth banking so nobody re-worries
about them.

### The grid does not drift. At all.

**MEASURED** (offline/press path). Groove disabled, tracks stretched to 3600 s:

| genre | bars | drum onsets | max deviation from the 1/96-beat grid | drift slope |
|---|---|---|---|---|
| jungle | 2474 | 21 619 | **0.000** | 0.00 ms/bar |
| honkytonk | 1538 | 7 198 | **0.000** | 0.00 |
| vaporwave | 1154 | 5 829 | **0.000** | 0.00 |
| house | 1850 | 13 852 | 0.4 (36 events — the deliberate hat-rush accelerando) | 9.1e-8 ms/bar |

The section clock (`csd-engine.js:1998`, `cur += secBeats`) *is* an accumulator,
but every addend is a small **integer**, so the IEEE-754 sum is exact. Beats→
seconds is a single multiply at the end. **Bar 2400 lands exactly where bar 1
says it should.**

### The render honours the score to a fraction of a millisecond

**MEASURED**: `house` seed 7, symbolic kick times vs low-band onsets detected in
the pressed WAV.

| render | matched | MAD about the median | drift over the track |
|---|---|---|---|
| drums-only, sampled | 172/172 | **0.04 ms** | −0.31 ms over 191 s |
| drums-only, `--synth` | 172/172 | 0.372 ms | +0.18 ms over 191 s |
| full mix, 316 s | 303/303 | — | −0.13 ms |

(The +7.56 ms constant on the sampled runs is the kick sample's own
attack-to-peak lag — detector bias, not engine error.)

### Render quantisation grain

- Faust synth voices fire on a 64-sample block boundary — **0–63 samples early,
  mean −0.73 ms** (`render-core.js:152-158`).
- Sampler (GM) voices are **sample-accurate** (`sampler.js:429`).
- So a genre mixing both carries a systematic ~0.7 ms synth-ahead-of-sample
  offset. Below audibility; noted for completeness.

---

## Groove — Paul's second question

*"Maybe things need more groove instead of less, or different tracks have
different groove too?"*

**MEASURED** across all 274 genres.

### Does every genre sit on the same rhythmic feel?

Substantially **yes, at the level of the bar grid.**

| lane | genres with drums | distinct modal patterns | top-1 share |
|---|---|---|---|
| kick | 238 | **19** | 29.0% |
| snare | 238 | **20** | **48.3%** (the bare backbeat) |
| hat | 236 | **33** | **47.0%** (the offbeat 8th) |

Joint kick|snare|hat signature: **83 distinct patterns over 238 drummed
genres**; the top 5 cover 46%. **67 genres (28% of everything with drums) share
one identical four-on-the-floor + backbeat skeleton spanning 83 to 191 bpm** —
within that cohort, tempo and the hat subdivision are the *only* rhythmic
difference.

### Is the swing knob audible?

Mostly **no.**

| | min | p25 | **median** | p75 | p90 | max |
|---|---|---|---|---|---|---|
| `swing` | 0.000 | 0.013 | **0.022** | 0.082 | 0.148 | 0.342 |
| `humanize` | 0.012 | 0.105 | **0.166** | 0.249 | 0.323 | 0.503 |

Swing 1.0 only moves the "&" by 0.16 beat (`csd-engine.js:1233`). So:

- median genre's "&" sits at **0.5051 — a 50.5 : 49.5 "swing"**, ≈2 ms at
  100 bpm. Musically zero.
- **180 of 274 genres are below swing 0.05.**
- the catalogue maximum (bebop, 0.369) buys **55.9 : 44.1**. A real jazz triplet
  is 66.7 : 33.3. **No genre in the space reaches a triplet via the global
  knob** — the knob physically cannot.
- bebop and jazz carry the two highest swing values *and never touch a shuffle
  kit*, so bebop at 209 bpm plays straight eighths.
- `garage` is the only genre with `timeFeel.grid:"16th"`, which is why its
  swing 0.241 produces a dead-straight 8th. `"triplet"` grid: zero genres.

### Do the lanes push and pull against each other?

**247 of 274 genres: no.** Mean per-lane on-beat offset, across 159 plain
genres: max−min p50 = **0.308 ms**, p95 = 3.5 ms. Bass sits on the kick to
within a third of a millisecond. There is no laid-back bass, no on-top hat, no
drummer-vs-bassist tension anywhere except:

- **26 genres** using `state.timeFeel.pushPull` — which **already exists**,
  resolved at `csd-engine.js:1244`, applied at `:1278-1282`, keyed on
  `e.voice || e.drum`, so every lane is addressable **today**. Measured accurate
  to <1 ms of its declaration. Lanes used: bass ×25, hat ×10, snare ×10,
  kick ×3.
- **19 genres** running a `shuffle`/`waltzswing` kit, where the hat rides a
  genuine 2/3 triplet while bass and melody stay near-straight — a **32–69 ms
  lane split** that reads as a mismatch, not a pocket.

The existing `pushPull` values span **2.0 ms → 100 ms** of actual displacement,
because the field is declared in **beats, not milliseconds**: the same `0.015`
is 10 ms at 87 bpm and 5 ms at 168 bpm, and the doom family's `0.08` at 48 bpm
is a whole **100 ms** — past "behind the beat" into "wrong".

### The accent organ is wired and unused

- `accentProfile` profiles defined: **1** (`dub`, `pipes.js:78-80`).
- Genres declaring it: **1** (`genre-kernel.js:6702`).
- It **does** reach rendered amplitude (proved end-to-end), and velocity is
  honoured on every backend — `state-engine.js:1846/1936/1939`,
  `stream-renderer.js:344/563`, `press.js:275`.
- But `pipes.js:254-258` iterates `ev.pitched` only and skips `pad` — **the one
  mined groove organ in the project never touches the drum kit**, which is where
  groove lives.
- Composed drum accent otherwise exists and is often strong (kick CV median
  0.21, snare 0.42, hat 0.30) — but where it is flat it is *stone* flat:
  disco / synthwave / citypop / dub hats measure a normalised per-slot profile
  of literally 1.00 … 1.00. And where it exists it is nearly always a two-value
  downbeat/offbeat alternation (1.20 / 0.70), not a 16-step human profile.
  `tom` is a single velocity in 42 of 53 genres.

### Proposal (measured, priced, NOT implemented)

**P0 — fix Findings 1 and 3 first.** No amount of groove authoring will be
audible while a quarter of the downbeats are missing and the rest arrive 0–45 ms
late at random. Micro-timing work on top of that noise floor is wasted.

**P1 — make the existing knob tempo-honest.** Accept `tf.pushPullMs` alongside
`tf.pushPull` in `resolveTimeFeel` (`csd-engine.js:1237-1247`) and fold to beats
with `state.bpm`. ~8 LOC, one choke point, absent field ⇒ byte-identical. This
is the prerequisite for any authoring pass and it retro-fixes the 60–100 ms
outliers.

**P2 — populate the families (data only, 0 engine LOC).** Budget **|offset| ≤
0.02 beat (≈8–14 ms across the catalogue's tempo range)**, which **MEASURED as
zero self-score change across 18 probed genres**, 14 of them carrying an
`offgrid` band in their target row. The verifier reads timing in only three
places (`genre-verifier.js:76` offgrid at a 0.04-beat threshold, `:79` the
per-window signature, `:102` swing/humanize as raw state scalars) and reads
`timeFeel.pushPull` **nowhere** — so at ≤0.02 beat the matrix is blind to it.
Measured sensitivity:

| offset (beats) | median Δoffgrid | Δ self-score |
|---|---|---|
| 0.02 | 0.000 | **0 for all 18** |
| 0.03 | +0.049 | — |
| 0.04 | +0.212 | gabber −13, techno −2 |

Grounded conventions mapped to families the census shows exist:

- **behind the beat** — reggae/dub/skank (`dub`, `cedarskank`, `oakdublilt`,
  `dumptruckdub`, `brinedub`): snare and rim late, one-drop kick late. The
  22-genre one-drop cluster is the obvious target.
- **bass ahead** — funk and descendants (`funk`, `kettlefunk`, `newjack`,
  `refrigeratorfunk`, `boombap`, `miamibass`). Note that **exactly one genre in
  the whole catalogue currently has a negative (ahead) bass** — the space has
  one direction of feel.
- **ride ahead of the snare** — `jazz`, `bebop`, `blues`, `bossanova`,
  `sodabop`: ride ≈ −8 ms against a snare at +5.
- **hats on top** — trip-hop/lofi already encode this (−3 to −5 ms); it is the
  working template.
- **machine-tight** — techno/gabber/EDM/vaporwave get **nothing**. Flat grid is
  their identity and vaporwave's verifier row explicitly fences on machine time.

**P3 — a drum accent organ.** Extend `accentProfile` to `ev.drums` behind a
`lanes:["hat","snare"]` param (~12 LOC in `pipes.js` + mined tables). Biggest
win for the stone-flat hat genres. **Matrix-visible** (amplitude feeds the
`variation` signature and `snareBalance`/`hatDensity`), so unlike P1/P2 this one
needs the full matrix gate.

**P4 — sub-lane predicates** (~15 LOC): `pushPull` cannot distinguish open vs
closed hat, and cannot lay the "&" back without moving the downbeat. A
`{lane, when:"offbeat"|"open"}` form unlocks the genuinely idiomatic moves.

**Live-path caveat for any *ahead-of-beat* work:** a systematic negative offset
increases the population of events sitting just below a chord-bar boundary —
which is precisely the seam of Finding 1. Fix the seam before pushing anything
early.

---

## Adjacent findings (not timing, found while measuring)

### The master output clips

**MEASURED** at `handle.analyser` (post `busComp → makeup ×2.6 → limiter`,
`live.js:419-422`), left channel:

| run | loud 100 ms windows containing a sample above ±1.0 | max peak |
|---|---|---|
| steady, 7 min | **11.5%** | 1.103 (+0.85 dBFS) |
| 19 swaps, 8 min | **16.0%** | 1.213 (+1.67 dBFS) |

`userGain` defaults to 1.0 and feeds `ctx.destination` directly, so those samples
are hard-clipped by the browser. The limiter is a `DynamicsCompressor`
(threshold −1.5 dB, ratio 20, **attack 2 ms**) — not a brickwall, so transients
walk straight through it. This is a plausible contributor to a "something's a
bit fizzy" impression that is easy to mistake for a timing artefact.

### The always-on click detector cannot see the clicks it exists to catch

`clickmon` is tapped at **`masterGain`** (`live.js:497`) — i.e. **before** the
+8 dB makeup and the limiter — with a fixed discontinuity threshold of **0.5**.

**MEASURED** over the 8-minute ride:

| | value |
|---|---|
| `clicks` counter | **0** — never fired |
| `peakjump` (running max at its tap) | 0.452 |
| `gaps` counter | 0 → **1** (it *did* catch the 299 ms dropout — this half works) |
| program RMS at that tap | p50 0.070, p95 0.182, max 0.317 |

The 299 ms dropout produced discontinuities of **0.92 and 0.88 at the output** —
which, divided back through the 2.6× makeup, read ≈0.35 at the clickmon tap:
**below its 0.5 threshold.** Meanwhile ordinary program at that tap already
reaches 0.45, so the threshold has only ~10% headroom against false positives.
The detector is simultaneously **too insensitive for real clicks and too close to
the program floor** — because it is tapped at the wrong point in the chain.
Moving the tap post-limiter (where the listener's signal actually is) would make
the same 0.5 threshold meaningful.

---

## Summary — what would change what he hears, in order

1. **Fix the chord-bar seam.** ~24% of downbeat events on every lane are
   dropped, ~24% doubled, live only. Two thirds of chord-bar downbeats are
   missing at least one voice that the exported file plays. *This is the thing.*
2. **Fix the crossfade.** Every steer: ~0.4 s of dry outgoing ring, and the
   incoming genre's first ~0.45 s of drums dumped in a clump. About one steer in
   five dips audibly for ≥0.5 s; one in nineteen went fully silent for ~300 ms.
3. **Give the visible bar-drain a lookahead.** 92.6% of the notes are anchored a
   random 0–45 ms late every bar on a bare page — **0–80 ms in the real app**,
   because the drum scheduler shares the main thread with the UI. The hidden-tab
   path already does this correctly.
4. **Then** consider groove. `pushPull` already exists and works; 247 genres
   don't use it; the swing knob is a rounding error in 180 of them; and the
   accent organ never touches the drums.
5. Adjacent: the master output goes over full scale in 11.5% (steady) to 16.0%
   (steering) of loud 100 ms windows, and the always-on click detector is tapped
   where it cannot see the clicks it exists to catch.

## What we still can't see

- Whether ring **B** ever underruns (which would permanently desync the native
  lanes from the stream). The handle exposes `underruns()` but not per-ring
  cursors. One `ringDeficit()` readout closes this.
- Real-device mobile behaviour. The WAV-first path's clock structure is sound on
  inspection, but nothing here was measured on a phone.
- Whether any of this is what Paul is actually hearing. These are the mechanisms
  and their magnitudes; the ears remain the verifier.

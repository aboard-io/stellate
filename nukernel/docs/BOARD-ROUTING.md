# BOARD-ROUTING — the fixed wires under the one board

Moved OFF the rendered page 2026-08-27 (FUTURE.md §2, the text diet: "The
board's 1,629-char routing essay moves to `docs/`; signal flow is drawn as
arrows, not narrated"). The board keeps a one-line pointer to this file; the
rack itself draws the series — genre → delay → reverb → main — as arrows,
which is the routing a hand can move. What lives here is the routing a hand
cannot: the edges that are the engine's own, and where the retired groups
went.

ONE OWNER PER FACT: every quoted sentence below is `audio/desk.js`'s
(`MAIN_TO_BUS1`, `FIXED_EDGES`) — this file quotes, it never restates.
`nukernel/desk-gate.js` G14 holds the join both ways: the rendered board must
carry the pointer to this file, and this file must carry each edge's own words
verbatim, so the essay can neither drift from the source nor quietly vanish.

## the one live bus-to-bus send

**main → bus 1**, set with the main strip's `space`:

> the main's dry feeds bus 1 at `0.5 * mrev` (fx_bus.dsp:221) and `mrev` IS
> the master's `space` — it is the one bus-to-bus send on this desk that
> reaches the engine, and its control is in the main strip above, not here

## the two edges inside the DSP

**bus 2 → bus 1** (amount 0.2):

> bus 2 feeds bus 1 at the delay plate's `bleed` knob — shipped at 20%
> (`d*bleed` in fx_bus.dsp, default 0.2, the old literal), 0 severs the feed,
> 1 pours the whole delay into the room

This edge was "a constant in the DSP" until the 2026-08-27 series-bus round
made the literal a slider; the word that moves it is the delay plate's own
`bleed` knob, drawn on the rack.

**the engine's pp bus → bus 1** (amount 0.12):

> the parent's ping-pong bus feeds bus 1 at a fixed 12% (`(ppl+ppr)*0.12`,
> fx_bus.dsp:221) — also a literal, and nothing on this page can put a signal
> into that bus in the first place

## where the groups went

bus 3 and bus 4 (the groups of 2026-08-26, "let me have up to four buses and
a way to direct them to each other") keep their saved sends and aims in the
record and in the engine (`fields.js busRoute`, `audio/desk.js feedSplit` —
an old save is untouched and still sounds), and draw no plate on the board:
the 2026-08-27 series — genre → delay → reverb → main — is the rack, on
Paul's word ("Have one bus for genre specific effects, into a delay bus, into
reverb, into main"). The board's refusal list prints the one-line version;
desk-gate G12 asserts it stays printed.

## the dry path

The dry path to the main is the fader — one owner per fact — so the strip's
MAIN send is parked, refused with that sentence on the control
(`ui/engineer.js MAINSEND_WHY`), never drawn as a second gain on the same
wire.

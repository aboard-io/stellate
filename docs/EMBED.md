# EMBED — putting STELLATE in someone else's page

STELLATE is embeddable. Paste one `<iframe>` and a reader gets the real
instrument — the star map, the traveler, live generated music — inside your
post, at whatever point in genre space you pointed it at.

The fastest path: open the app, get the mix you want on screen, open **⚙ →
embed**, and hit **⧉ copy embed**. That snippet already carries the seed, the
path, the measure, the speed multiple and the soundfont you were listening to.

---

## 1. The snippet

```html
<iframe src="https://stellate.app/embed.html?genre=vaporwave"
  title="STELLATE — draw a path through genre space"
  width="100%" height="480" loading="lazy"
  allow="autoplay; clipboard-write"
  referrerpolicy="strict-origin-when-cross-origin"
  style="border:0;width:100%;max-width:100%;height:480px;aspect-ratio:16/10;min-height:320px;border-radius:12px"></iframe>
```

Every attribute is doing a job:

| attribute | why |
|---|---|
| `title=` | the frame's accessible name. Screen readers announce it; without it the frame is "iframe". Non-negotiable. |
| `loading="lazy"` | an embed below the fold costs your reader nothing until they scroll to it — and this one downloads a WASM engine. |
| `allow="autoplay; clipboard-write"` | **we never autoplay** (see §3), but Chrome's autoplay policy treats a cross-origin frame as un-gestured *even after the user taps inside it* unless the parent delegates `autoplay`. Without this the play button does nothing. `clipboard-write` lets the framed ↗ share button copy a link. |
| `referrerpolicy` | send your origin, not your reader's full path. |
| `style="border:0;…"` | the modern `frameborder=0`. `aspect-ratio` + `min-height` make it responsive with no resize script. |

**Sizing.** It works from about 320×320 up. Below ~380px wide the map zooms in
further automatically so the genre labels stay legible. 16:10 is the shape it
was tuned for; anything from 4:3 to 2:1 looks right.

**Do not** add `sandbox` unless you know what you are doing — the embed needs
`allow-scripts allow-same-origin` (for its own origin's storage/worker) and
`allow-popups` for the "open ↗" link.

## 2. Pointing it somewhere

The embed reads the same URL grammar as the app, plus one addition:

| param | meaning |
|---|---|
| `?genre=<key>` | **embed-only.** Park on one genre and stay there — no path, no journey. Takes a kernel key (`vaporwave`, `jungle`, `ragtime`) or a genre's display label; case and punctuation are ignored. The map zooms to that star. |
| `?path=x.y,x.y,…` | a drawn path in world coordinates — the traveler walks it forever and the music morphs through every genre it crosses. This is what the ⚙ copy-embed button emits. |
| `?seed=N` | the whole piece is deterministic from this. Same seed ⇒ same music, always. |
| `?m=N` | drop in at measure N. |
| `?xdur=N` | the speed multiple (×1 = the path's own distance-derived duration). |
| `?sf=<font>` | soundfont. |
| `?bg=off` | (inert here — the demoscene backdrop is already off in embeds.) |

A `?path=` always wins over a `?genre=`: a journey is the richer instruction.

## 3. It will never autoplay

The embed opens with a play affordance covering the box and stays silent until
someone taps it. This is not a limitation we are working around — it is the
correct behaviour, and it is also the only thing browsers will permit. A page
that starts making music at a stranger is a page people close.

If playback stops, the affordance comes back, so the box always shows what it
wants from you.

## 4. oEmbed

`index.html`, `access.html` and `embed.html` all advertise an oEmbed endpoint:

```html
<link rel="alternate" type="application/json+oembed"
      href="https://stellate.app/oembed.json" title="STELLATE">
```

Mastodon, WordPress, Discourse and Notion discover this automatically: paste a
stellate.app link and you get the player, not a screenshot. It is a **static
JSON document** — it ignores the `?url=` a strict consumer sends, which means an
unfurled deep link embeds the app's front door rather than that exact mix. The
reasoning, and the nginx snippet for a parameterized endpoint if we ever want
one, are in **docs/HOSTING.md § Embedding**.

For an exact mix, use the ⚙ → embed snippet.

## 5. Talking to the embed

The frame posts two messages to its parent, if anyone is listening:

```js
window.addEventListener("message", (e) => {
  if (e.origin !== "https://stellate.app") return;
  if (e.data && e.data.source === "stellate") {
    // e.data.type is "play" or "stop"; e.data.genre / e.data.url describe where it is
  }
});
```

Useful for pausing your own video when the music starts. Nothing depends on
anyone listening.

## 6. How it works (and what it deliberately does not fork)

`embed.html` loads **the same** engine globals and **the same** `app/` modules
as `index.html`, in the same order. There is no second engine, no cut-down
build, nothing to keep in sync. It differs in exactly three ways:

1. **`<body class="embed">`** — see the *EMBED MODE* block in `app/app.css`.
   The settings/about/viz/aliens surfaces are suppressed; the brand, the ▶ chip
   and the credit line shrink. The modal DOM still exists (because
   `app/panels/panels.js` binds to it at load) and is simply never openable.
2. **`app/entries/embed.js`** — the play affordance, `?genre=`, and the `postMessage`
   plumbing. Nothing else.
3. **Three omissions**, each guarded at every call site so nothing breaks:
   `engine/demo-layer.js` (the MicroW8 demoscene backdrop — real CPU inside
   someone else's page), `app/entries/analytics.js` + the GoatCounter beacon (we do not
   fire a beacon from a third party's page), and `app/starcruise.js` (the 3D
   view is unreachable here anyway).

### The audio problem, and why the embed is not silent

This is the part worth knowing about. STELLATE's default live engine is a ring
of `SharedArrayBuffer`s read by an AudioWorklet, and a `SharedArrayBuffer` only
exists on a **cross-origin isolated** page (`COOP: same-origin` +
`COEP: require-corp`, all the way up the frame chain). stellate.app sends those
headers — but an iframe on *your* site inherits *your* isolation, so inside an
embed `SharedArrayBuffer` is undefined and the ring engine throws.

The app detects that and takes the **WAV-FIRST** route instead — a real
`<audio>` element fed rendered media segments, originally built so audio would
survive a phone going in a pocket (`docs/WAV-FIRST.md`). It needs no
`SharedArrayBuffer` at all. The switch is automatic (`app/audio/live.js`, the
NO-ISOLATION FALLBACK block); an explicit `?wavOut=0/1` still overrides it.

This is gated, because an embed that ships mute is worse than no embed:

```bash
node test/browser/embed-audio.test.js
```

Two servers on two origins — a bare host page with **no** COOP/COEP framing the
real repo — so the frame is genuinely un-isolated, exactly as in production. It
asserts the missing SAB, the automatic route switch, that nothing plays before
a real click, and then real RMS out of the engine. It also runs a control pass
on the top-level isolated page to prove desktop was not quietly demoted to the
mobile route.

## 7. Files

| path | what |
|---|---|
| `embed.html` | the embed entry |
| `app/entries/embed.js` | play affordance, `?genre=`, postMessage |
| `app/app.css` → *EMBED MODE* | everything visual |
| `oembed.json` | the static oEmbed document |
| `app/panels/panels.js` → `embedSnippet()` | the ⚙ panel's copy-embed snippet builder |
| `test/browser/embed-audio.test.js` | the gate that says the embed makes sound |
| `docs/HOSTING.md § Embedding` | nginx: what must not be added, and the parameterized-oEmbed snippet |

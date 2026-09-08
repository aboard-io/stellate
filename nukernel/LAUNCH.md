# LAUNCH — the box takes stellate.app, and the old site keeps its own door

Paul, 2026-09-08: *"figure out how to launch this to stellate.app but turn the
old version into old.stellate.app and then add a link to that in the hamburger
menu, make that plan and then we'll do the switch. maybe the current main
becomes the legacy branch and this one becomes main. but figure it out."*

**Nothing on the server has been touched.** This is the plan and the runbook,
and the switch is a separate word from Paul. Every number below was measured on
the droplet or in this tree today, and the commands are the ones that were
actually run to measure them.

**What HAS been done, in the tree** (Paul, 2026-09-08: *"we want to keep all the
robots and have a new sitemap, new feeds, and manifest, and add analytics using
the same system. Don't publish markdown. Erase and clean all of that up. Add the
guard and make things secure. Don't bother saying the old one is old."*): the
analytics beacon, `robots.txt`, `manifest.webmanifest` and the icons; the
sitemap and feed generators; the deploy excludes that stop publishing the source;
the guards on all four deploy scripts, on both branches. §4 and §9 record each
one. Everything in §7 that touches nginx, DNS or the live site is still ahead of
us.

---

## 0 · What is true today, measured

| | |
|---|---|
| droplet | `159.89.38.37`, one box, nginx, 24 GB disk, **4.1 GB used, 20 GB free** |
| DNS | `stellate.app` A → the droplet · `www` CNAME → @ · `test` A → the droplet. **No `old` record.** Managed by DigitalOcean; `doctl` works from this laptop and is authenticated. |
| prod | `stellate.app` → `/srv/stellate` — **786 MB**, the old app: the star map, `app/`, `assets/`, `docs/`, `daw.html`, `ca.html`, `fugue.html`, `how.html`, `embed.html`, the feeds, the manifest, `robots.txt`, `sitemap.xml`, and **`found/`, the shared media** |
| staging | `test.stellate.app` → `/srv/stellate-test` — 80 MB, this branch; `found` is a **symlink** to `/srv/stellate/found` |
| notes | `/srv/stellate-notes`, outside every web root |
| TLS | certbot, one cert per name: `stellate.app` (+www, expires 2026-12-06), `test.stellate.app` (2026-10-27) |
| vhosts | `/etc/nginx/sites-enabled/{stellate,stellate-test,goatcounter-tunnel}`; **not in the repo** — `docs/HOSTING.md` §5/§5b is the record they can be rebuilt from |
| analytics | GoatCounter on `127.0.0.1:8081`, proxied at `/stats` and `/gc/count`; staging returns 204 |
| branches | **`nukernel` is 555 commits ahead of `main` and 0 behind.** `git rev-list --left-right --count main...nukernel` → `0  555`. main is an ancestor: a fast-forward, never a force-push. |
| workers | prod `sw.js` is **v56** (2026-07-29); this branch is **v329**. Same lineage: `stellate-app-<VERSION>` + `stellate-media-v1` + a `LEGACY` sweep. |
| storage | old app keys are `vaporwave-*`; this box's are `nukernel.*` / `nu.*`. **No collision** — the new app cannot read the old app's saved state, and does not try. |

**The one thing the new tree needs from the old one: `/found/`.** The samplers,
the drum kits and the BBC beds are fetched from `found/samples/…` and
`found/bbc_*.mp3`. The media is immutable-by-name and is already shared with
staging by symlink; the new prod root will share it the same way.

---

## 1 · The shape of the switch: a `root` line, not a file move

**The new app gets its own web root and prod's vhost points at it.**

```
/srv/stellate       the OLD tree, byte-for-byte untouched   → stellate.app/old
  └ found/          the shared media, where it already is
/srv/stellate-nu    the NEW tree, deployed from this branch → stellate.app
  └ found → /srv/stellate/found      (symlink, exactly as staging does it)
/srv/stellate-test  staging, untouched
```

Three reasons this shape and not "copy the old site to `/srv/stellate-old` and
deploy over `/srv/stellate`":

1. **The switch is one line and so is the rollback.** `root /srv/stellate-nu;`
   → `nginx -t && systemctl reload nginx`. If anything is wrong, the same line
   goes back and prod is the old site again, in the time a reload takes. A file
   move is not reversible at that speed and is not atomic while it runs.
2. **Nothing moves on disk.** 786 MB stays where it is, the staging symlink
   keeps resolving, and `/old/` serves the exact bytes prod is serving today —
   which is the whole promise of "the old version is still there". It is reached
   by one more symlink, `/srv/stellate-nu/old` (§2).
3. **The two trees are never mixed.** The nukernel deploy rsyncs **without
   `--delete`** on purpose (the tree is pruned and the server holds files the
   branch does not). Deploying it *over* `/srv/stellate` would leave the old
   app's `app/`, `assets/`, `ca.html`, `daw.html` and `docs/` sitting under the
   new one forever, half-shadowed, with no way to tell which site a file
   belongs to. A fresh root makes that impossible.

Disk cost: the new root is ~80 MB (staging's size). 20 GB free.

---

## 2 · The archive lives at `stellate.app/old`

Paul, 2026-09-08: *"Could we do stellate.app/old instead?"* **Yes, and it is the
better shape.** No DNS record, no second certificate to renew, no second name to
explain — and one thing a subdomain cannot do at all, below.

**It needs no copy and no edit.** A symlink is the whole of it:

```bash
ln -s /srv/stellate /srv/stellate-nu/old
```

`/old/how.html` resolves to `/srv/stellate/how.html`, `/old/found/x.mp3` to the
shared media, and the archive tree stays byte-for-byte what it is.

**MEASURED, because "relative paths" is a claim and not a fact.** The old app
was stood up under a sub-path locally — a worktree of `main` behind a server
sending the same COOP/COEP headers prod sends — and loaded at
`/old/index.html`: **zero console errors, zero 4xx, `crossOriginIsolated: true`,
the star map drawn and labelled.** It uses not one absolute path in its HTML or
its JS (it has always also been served at `aboardresearch.com/projects/…`, which
is why), so nothing in the frozen tree has to change for this.

**The thing a subdomain could not do: the visitor's own saved state survives.**
The old app keeps its settings under `vaporwave-*` keys in `localStorage`, and
localStorage belongs to the ORIGIN. At `old.stellate.app` every one of those
would have been orphaned the moment we switched — the archive would open blank
for the people who used it most. At `stellate.app/old` the archive reads exactly
what it wrote. (The two apps' keys do not collide: `vaporwave-*` against
`nukernel.*`.)

### The one real conflict, and it is the service worker

Both trees ship a worker that names its caches the same way — `stellate-app-<VERSION>`
plus `stellate-media-v1` — and each one's `activate` deletes every
`stellate-app-*` cache that is not its own. On two origins that is fine. On ONE
origin it is a loop: open the box, it evicts the archive's shell; open the
archive, it evicts the box's. Nobody loses data, and everybody re-downloads
everything, forever.

Two lines fix it, both OUTSIDE the frozen tree:

1. **The archive installs no worker.** nginx serves the self-unregistering
   four-liner at `/old/sw.js` — the same one `test.stellate.app` already uses
   and for the same reason. The old app registers `sw.js` RELATIVELY
   (`serviceWorker.register("sw.js")`), so that is the exact file it asks for,
   and any worker a visitor already has at that scope tears itself down on the
   next update check. An archive does not need to work offline.
2. **Our worker does not touch `/old/`.** A path guard at the top of the fetch
   handler in `sw.js`: a request under `/old/` is not ours, so it goes to the
   network and never enters our cache. Without this the box's worker — scope
   `/` — would happily cache the whole archive under our key.

Neither of these is a change to `/srv/stellate`. The archive stays frozen, which
is the whole point of an archive.

### What else changes, all of it in our favour

- **Old links stay same-origin.** `/how.html` → `/old/how.html` is a redirect
  inside one site, not a hop to another name.
- **One analytics property.** `/old/*` counts as paths in the same GoatCounter
  site, so how much the archive is actually used becomes a number we have,
  rather than a second dashboard nobody opens.
- **Indexing.** `X-Robots-Tag: noindex, nofollow` on the `/old/` location, for
  the reason a subdomain would have needed it: two addresses serving two
  versions of one project should not compete for the same search.
- **One caveat, and it is cosmetic.** The archive's `index.html` carries an
  ABSOLUTE `og:image` and `canonical` pointing at `https://stellate.app/`, so an
  unfurl of an `/old/` link shows the new site's card. Fixing it means editing
  the frozen tree; D6 says don't dress the archive up, so it stays.

## 3 · The prod vhost after the switch

Four changes to `/etc/nginx/sites-enabled/stellate`, and only four:

1. **`root /srv/stellate-nu;`** in the `443` block (and in the `80` block, which
   only redirects but should not point at a tree that is no longer prod).
2. **The old paths keep working, by redirect.** The new app is one page; every
   URL the old site published — `/how.html`, `/ca.html`, `/fugue.html`,
   `/daw`, `/access.html`, `/colophon.html`, `/embed.html`, `/docs/…`,
   `/app/…`, `/assets/…` — would 404. Instead:

   ```nginx
   location / { try_files $uri $uri/ @old; }
   location @old { return 301 /old$request_uri; }

   location /old/     { alias /srv/stellate/;  # the archive, frozen
                        include /etc/nginx/snippets/stellate-isolation.conf;
                        add_header X-Robots-Tag "noindex, nofollow" always;
                        add_header Cache-Control "no-cache"; }
   location = /old/sw.js { default_type text/javascript;
                        add_header Cache-Control "no-store";
                        return 200 "<the self-unregistering worker>"; }
   location /nukernel/ { return 301 https://stellate.app/$is_args$args; }
   ```

   A path the new site has is served; a path only the old site has is handed to
   the archive with its query string intact, on the same origin. Hash fragments
   are never sent to a server, so a `#at=…&y=…` share link is untouched by this
   either way. (`alias` and not a symlink under the root would work too — the
   symlink in §2 is simpler and matches what staging already does with
   `found/`.)
3. **`/found/` needs no change at all** — the symlink means plain `root`
   resolution reaches the shared tree, which is the same trick and the same
   comment staging carries.
4. **The open-web layer** — §4, which is a decision and not a mechanic.

**What does NOT change:** the isolation snippet (COOP `same-origin` + COEP
`require-corp` — the new app needs them as much as the old one), the
server-wide `Cache-Control: no-cache`, the `/stats` and `/gc/count` proxies,
gzip, and the TLS block. The certificate already covers `stellate.app` and
`www`.

### The service worker, which is the one thing that can look broken

A visitor who has used the old site has **`sw.js` v56 installed at scope `/`**
and an app cache called `stellate-app-v56`. After the switch:

- nginx serves the new `index.html` (`no-cache`, always revalidated), but the
  **old worker is still controlling that page** and its strategy is
  stale-while-revalidate — so the first load after the switch can be **the old
  app, once**.
- The same navigation makes the browser fetch `/sw.js`, which is now v329's
  bytes. It differs, so it installs; v329 calls `skipWaiting()` on install and
  `clients.claim()` on activate, and its activate sweeps every cache that
  starts with `stellate-app-` and is not its own — **including
  `stellate-app-v56`**. `stellate-media-v1` is deliberately not swept and does
  not need to be: media is versioned by name and the two apps share it.
- So the worst case is one stale load, self-healing, and v329 already speaks to
  the open page on activation (`nukernel/audio/offline.js` reloads itself when
  a reload is free and otherwise offers a button).

**This is the reason the launch deploy must carry a VERSION bump** — which the
runbook does. It is also the reason the first thing to check after the switch is
a *second* reload, not the first.

---

## 4 · What the new tree does not carry — four decisions for Paul

The nukernel deploy ships `nukernel/ engine/ vendor/ sw.js` and eight named
files under `tools/`. It ships **none** of the following, all of which exist on
prod today:

| | today | after the switch, if nothing is decided |
|---|---|---|
| `robots.txt` | invites crawlers, names the sitemap | would 301 to `/old/robots.txt` — **wrong**, a host's robots.txt is the one at its root |
| `sitemap.xml` | the old site's pages | 301s away |
| `feed.xml` / `feed.json` (+ archives) | generated from git log on every prod deploy by `tools/build/gen-feed.js`, which lives on **main** and not on this branch | 301 to the old host; subscribers keep getting the archive, never anything new |
| `manifest.webmanifest` | the PWA install | 301s away; an installed PWA still opens `stellate.app/` and gets the new app |
| `assets/og-card.png` + `og:image` | a picture on every unfurl | the new `index.html` has **no `og:image` on purpose** ("a card with a broken picture is worse than a card with no picture") |
| GoatCounter beacon | `<script data-goatcounter="/gc/count" … src="vendor/goatcounter/count.js">` in the old `index.html` | **the new index.html has no beacon: prod analytics go to zero** |
| 17 internal design docs | not on prod | `TABLE.md`, `COMPOSER.md`, `DESIGN.md`, `GENRES.md`, `KERNEL.md` … **published at the web root**, because the deploy copies `nukernel/*` to the root |

**All four were decided by Paul on 2026-09-08, and three of them are done.**
*"we want to keep all the robots and have a new sitemap, new feeds, and
manifest, and add analytics using the same system. Don't publish markdown.
Erase and clean all of that up."*

**D1 · Analytics — SAME SYSTEM, DONE.** GoatCounter, self-hosted on this
droplet, proxied at `/gc/count`, `count.js` vendored so no request leaves the
origin (which is also what keeps the page inside its own COOP/COEP isolation
without a CORP question). Cookie-free and identifier-free: nothing to consent
to. `defer` and last in the document, because a beacon must never be in front
of the audio graph booting. Staging returns 204, so the line is safe to ship
before the switch — and `count.js` skips localhost by itself, which is why a
local load makes no request at all.

**D2 · The open-web layer — ALL NEW, WRITTEN FOR THIS APP.**
`robots.txt` keeps the old file's stance whole (everyone welcome, every AI
crawler named explicitly rather than left to guess, the source pointed at, the
`found/` licences flagged) with this app's facts and a line pointing at the
archive. `manifest.webmanifest` is the box's own: black ground, four icon
sizes, `display: standalone`. The **sitemap and the feeds are generated**, from
the catalogue and from git log — `tools/build/gen-sitemap.js` and
`tools/build/gen-feed.js` — and both run on the way out the door in
`deploy-nukernel-prod.sh`, which is the arrangement the old site used and the
reason its feeds were never stale. Every URL in either is a real share link in
this app's own grammar (`#at=<place>&y=<year>&s=<seed>`), so every entry
*plays*.

**D3 · The web root is not the working tree — DONE.** Both deploy scripts now
exclude `*.md`, `docs/`, `src/`, `ideal/`, `*-extract.js`, `package.json`,
`package-lock.json`, `tsconfig.json`, `serve.sh` and `verify.sh`. Seventeen
design documents, the TypeScript sources and the node-only extractors were
being served beside `index.html`. None of it is secret — the repo is public —
and none of it is a page: the source belongs on GitHub where it can be read
properly, and the site is the instrument.

**D4 · No `og:image`.** Unchanged, as decided 2026-09-08: a card with a broken
picture is worse than a card with no picture, and the copy carries it
("Infinite remixable music in many genres for free"). The app now has real
icons, so a tab, a bookmark and an installed app are no longer a grey square —
that was the part of "no icon" that was costing something.

## 5 · The link in the hamburger

A row at the foot of the plate, under `HOW IT PLAYS`, beside `Daylight`,
`Set seed` and the log:

> **⧉ The old Stellate** — opens `/old/` in a new tab.

Three constraints the implementation has to respect, all of them written into
gates already:

1. **It must not join `MENUROWS()`.** `test/gutter.js` T2 asserts
   `menu rows === __eightTabs()` mapped to `toptab-…` keys — the plate's row
   list is *derived*, and a typed row would break that check for a good reason.
   The new row is a plain button appended after the groups, the way `logger`,
   `themeswitch` and `seedmenu` already are.
2. **The visible word heads the accessible name** (T10, and it caught two real
   defects this week). `aria-label` reads "The old Stellate — opens in a new
   tab", not the URL.
3. **`target="_blank" rel="noopener noreferrer"`**, and the row says it opens a
   new tab, because a menu row that silently leaves the app is the one thing a
   plate of destinations must not do.

Copy goes in `nukernel/ui/copy.js` (and `src/copy/…` if the row is drawn by a
Lit element), the glyph in the same catalogue as the others. Gates to re-run:
`test/gutter.js` (the plate's inventory, T2/T3/T9/T10/T12) and
`test/table.browser.js` T13a.

**Build it and ship it to staging BEFORE the switch.** The target is a plain
`/old/` — a path on whatever host the page is served from — so it can be built
and gated now and needs nothing to exist first. On staging it will 404 until
`/old/` is wired, which is honest: the row is proven by the launch, not before.

---

## 6 · The branches

`nukernel` is a strict descendant of `main` (555 ahead, 0 behind), so this is
bookkeeping and not surgery:

```bash
git branch legacy main            # the marker: today's main tip, 9c2f327
git push origin legacy
git checkout main && git merge --ff-only nukernel
git push origin main
# then, on GitHub: default branch stays `main`; nothing to change
```

Three things that are true afterwards and should be said out loud:

1. **The old site's files leave `main`'s tip.** This branch pruned the root —
   `app/`, `assets/`, `index.html`, `daw.html`, `docs/` and `.github/` are not
   in it. They are in the history and on `legacy`, and `/old/` is served from a
   tree on disk, not from a branch — so nothing on the live site depends on
   this. But a `git checkout main` after the rename will not contain
   the old app, and anyone rebuilding the archive must check out `legacy`.
2. **CI disappears with it.** `.github/workflows/verify.yml` is on main and not
   on this branch. Decide: port it (it will need this branch's gate list, which
   is `test/all.js` + the browser gates) or delete it deliberately. A workflow
   that vanishes silently is the worst of the three options.
3. **The legacy branch's two deploy scripts are now guarded (done,
   2026-09-08, `main` 63edeba).** The danger was worse than the plan first said,
   and it was not `DEST`: both scripts hard-code their root and rsync with
   `--delete --delete-excluded`, which makes the SERVER match the checkout.
   `deploy-staging.sh` writes `/srv/stellate-test`, which is this branch's
   staging root — one run of it from a legacy checkout would delete the music
   box's staging site and replace it. And `deploy-stellate.sh` writes
   `/srv/stellate`, which after the switch is the archive AND the home of the
   786 MB `found/` tree now shared by all three sites; it is protected by a
   filter, so a change to those two lines stops being a mistake about one app
   and becomes an outage for three. Each script now asks for one typed word
   (`--yes-archive`, `--yes-replace-staging`), says what it is about to change,
   and points at the script the operator probably meant.

Sequence: **do the server switch first, verify it, then rename the branches.**
The rename buys nothing at launch time and, done first, it changes what
`deploy-*.sh` means while the switch is still in flight.

---

## 7 · The runbook

Each step verifies before the next one starts. Steps 1–4 are invisible to
anyone visiting stellate.app.

**1 · The archive gets its door — and it is a path, so there is no waiting.**
No DNS, no certificate. `ln -s /srv/stellate /srv/stellate-nu/old`, the three
`location` blocks in §3, `nginx -t`, reload.
*Verify:* `/old/` draws the star map and makes sound (that is
`SharedArrayBuffer`, so the isolation headers are proven through the alias),
`/old/found/…` is 200 and immutable, `/old/sw.js` is the unregistering worker
and not the archive's, and the response carries `X-Robots-Tag: noindex`.

**2 · The new root exists but nothing points at it.**
```bash
ssh root@stellate.app 'mkdir -p /srv/stellate-nu && ln -s /srv/stellate/found /srv/stellate-nu/found'
```

**3 · The launch build.**
On this branch, with a clean tree: apply the §4 decisions (beacon, robots,
sitemap, manifest, the `*.md` exclusion), run the gates, bump `sw.js` VERSION,
commit. `test/all.js` plus the browser gates; `node test/gutter.js` last,
because it is the one that reads the chrome.

**4 · Deploy into the new root, unswitched.**
```bash
DEST=root@stellate.app:/srv/stellate-nu/ tools/deploy/deploy-nukernel-staging.sh
```
(A `tools/deploy/deploy-nukernel-prod.sh` that requires `--yes-prod`, refuses a
dirty tree and smoke-tests afterwards is worth writing here rather than reusing
the staging script with an env var. Same body, one guard, one echo that says
which site it just changed.)
*Verify from the droplet:* the files are there and the symlink resolves —
`curl -I http://127.0.0.1/found/…` still answers from the OLD root, which is
correct, because nothing has switched yet.

**5 · The switch.** Edit `root` in both server blocks of the prod vhost, add the
`@old` fallback, `nginx -t`, `systemctl reload nginx`.
*Verify, in this order:* `stellate.app` serves the box · **reload a second
time** (the service-worker handover, §3) · sound plays (isolation headers) ·
`/found/samples/…` 200 immutable · `/how.html` 301s to `/old/how.html` ·
`/gc/count` still counts · `curl -I https://stellate.app/sw.js` shows v329.

**6 · Watch, with the rollback one line away.** §8.

**7 · The branches.** §6, after step 6 has held for as long as Paul wants.

---

## 8 · Rollback

**The switch:** put `root /srv/stellate;` back and drop the four location
blocks, `nginx -t && systemctl reload nginx`. The old site is prod again,
byte-for-byte, because it was never modified — the archive was only ever
reached through a symlink and a header.

**The workers, which are the only asymmetry.** A visitor who took the new
`sw.js` in the meantime has `stellate-app-v329` installed on this origin. After
a rollback, the old `sw.js` v56 is at `/sw.js` again, is a different file, and
installs the same way — but v56's activate sweeps by its own rules and this
should be checked rather than assumed if a rollback is ever real. The safety
valve, if a cache turns out to be wedged, is the one staging already uses: serve
a `location = /sw.js` that returns the four-line self-unregistering worker,
which deletes every cache and reloads every open page. It is in
`/etc/nginx/sites-enabled/stellate-test` today and can be pasted into the prod
vhost in thirty seconds.

**The branches:** `legacy` is a branch marker; nothing is deleted by any of it.

---

## 9 · Decided

| | | |
|---|---|---|
| **D1** | analytics, same system | **done** — beacon vendored and in the page |
| **D2** | robots kept, sitemap + feeds + manifest new | **done** — robots/manifest written; the two generators run on the way out |
| **D3** | no markdown, no sources in the web root | **done** — both deploy scripts exclude them |
| **D4** | no `og:image` | **stands**; real icons added |
| **D5** | `.github/workflows/verify.yml` | **decided: retired.** Paul: *"I don't care about verify.yml."* It is not ported; it stays on `legacy` with the tree it was written for and leaves `main`'s tip at the rename. The consequence, said once: after the rename GitHub runs no checks on push — the gates are `test/all.js` and the browser gates, run here, and that is the whole verification story. |
| **D6** | does the archive say it is the archive? | **decided: no.** Paul: *"Don't bother saying the old one is old."* The old tree stays byte-for-byte what it is; the only signposts are the hamburger link on the new site and the line in `robots.txt`. |

## 10 · Still to do before the switch

1. **The hamburger link** (§5) — build it, gate it, ship it to staging.
2. **`/old/`** (§2) — one symlink, three location blocks, no DNS and no
   certificate.
3. **The new root** (§7 step 2) and a prod deploy into it, unswitched.
4. **The switch** (§7 step 5), then the branches (§6).

### One door, and a redirect for the other (decided here, done at the switch)

The deploy writes the tree TWICE: once as `/nukernel/` and once, its contents,
at the root. That is history — the root became the front door on 2026-09-02
after a deploy refreshed only `/nukernel/` and Paul opened the site to
yesterday's build — and the cost is the whole app shipped twice, a 2.5 MB
`genres.js` included.

**On prod the root is the only door.** The first rsync drops `nukernel` from its
source list (it keeps shipping `engine`, `vendor` and `sw.js`), and the vhost
carries one more line so every bookmark and every link anyone has ever sent
still lands:

```nginx
location /nukernel/ { return 301 https://stellate.app/$is_args$args; }
```

`$is_args$args` because a `?at=…` link must survive the hop, and a fragment
survives it by itself — the browser re-applies it after a redirect, so
`/nukernel/index.html#at=Kingston&y=1969` opens Kingston 1969 at the root.

**Staging keeps both doors until the switch**, deliberately: `/nukernel/index.html`
is the address Paul has been testing at all week, and a rehearsal is worth less
than the thing being rehearsed.

# LAUNCH — the box takes stellate.app, and the old site keeps its own door

Paul, 2026-09-08: *"figure out how to launch this to stellate.app but turn the
old version into old.stellate.app and then add a link to that in the hamburger
menu, make that plan and then we'll do the switch. maybe the current main
becomes the legacy branch and this one becomes main. but figure it out."*

**Nothing in this document has been done.** It is the plan and the runbook; the
switch is a separate word from Paul. Every number below was measured on the
droplet or in this tree today, and the commands are the ones that were actually
run to measure them.

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
/srv/stellate       the OLD tree, byte-for-byte untouched   → old.stellate.app
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
   keeps resolving, and `old.stellate.app` serves the exact bytes prod is
   serving today — which is the whole promise of "the old version is still
   there".
3. **The two trees are never mixed.** The nukernel deploy rsyncs **without
   `--delete`** on purpose (the tree is pruned and the server holds files the
   branch does not). Deploying it *over* `/srv/stellate` would leave the old
   app's `app/`, `assets/`, `ca.html`, `daw.html` and `docs/` sitting under the
   new one forever, half-shadowed, with no way to tell which site a file
   belongs to. A fresh root makes that impossible.

Disk cost: the new root is ~80 MB (staging's size). 20 GB free.

---

## 2 · `old.stellate.app`

Three motions, none of which touch prod:

```bash
# 1 · DNS (from this laptop; doctl is authenticated)
doctl compute domain records create stellate.app \
  --record-type A --record-name old --record-data 159.89.38.37 --record-ttl 1800

# 2 · TLS, once the record resolves
ssh root@stellate.app 'certbot certonly --nginx -d old.stellate.app'

# 3 · the vhost: /etc/nginx/sites-available/stellate-old
```

The vhost is **the prod vhost with three edits**: `server_name old.stellate.app`,
its own certificate, and `X-Robots-Tag: noindex, nofollow` on every response.
Everything else — the isolation snippet, the `found/` immutable block, the
`engine/faust/dist/` no-cache block, the dx7 presets block — is copied
unchanged, because the old app needs exactly the headers it needs today.

**Why noindex.** Two sites serving the same catalogue under two names is a
duplicate-content problem and, worse, a chance that the thing someone finds in
a search is the version we retired. The old site stays reachable by every link
that already exists; it just stops competing.

**No `/stats` and no `/gc/count` proxy on the old vhost** — counting the
archive's traffic into the live site's numbers would corrupt them. `/gc/count`
returns 204 there, the way staging does.

**Verify before going on:** `old.stellate.app` loads the star map, plays sound
(that is `SharedArrayBuffer`, so the isolation headers are proven), a
`found/samples/…` file returns 200 with `Cache-Control: immutable`, and
`curl -I` shows `X-Robots-Tag`.

---

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
   location @old { return 301 https://old.stellate.app$request_uri; }
   ```

   A path the new site has is served; a path only the old site has is handed to
   the old site with its query string intact. Hash fragments are never sent to
   a server, so a `#at=…&y=…` share link is untouched by this either way.
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
| `robots.txt` | invites crawlers, names the sitemap | 301s to old.stellate.app — **wrong**, a robots.txt must be on its own host |
| `sitemap.xml` | the old site's pages | 301s away |
| `feed.xml` / `feed.json` (+ archives) | generated from git log on every prod deploy by `tools/build/gen-feed.js`, which lives on **main** and not on this branch | 301 to the old host; subscribers keep getting the archive, never anything new |
| `manifest.webmanifest` | the PWA install | 301s away; an installed PWA still opens `stellate.app/` and gets the new app |
| `assets/og-card.png` + `og:image` | a picture on every unfurl | the new `index.html` has **no `og:image` on purpose** ("a card with a broken picture is worse than a card with no picture") |
| GoatCounter beacon | `<script data-goatcounter="/gc/count" … src="vendor/goatcounter/count.js">` in the old `index.html` | **the new index.html has no beacon: prod analytics go to zero** |
| 17 internal design docs | not on prod | `TABLE.md`, `COMPOSER.md`, `DESIGN.md`, `GENRES.md`, `KERNEL.md` … **published at the web root**, because the deploy copies `nukernel/*` to the root |

**D1 · Analytics.** Recommend: add the four-line GoatCounter beacon to
`nukernel/index.html` before launch. It is cookie-free, vendored (no third-party
request), already proxied by the vhost, and without it the switch is also a
decision to stop measuring.

**D2 · The open-web layer.** Recommend: serve `robots.txt`, `sitemap.xml` and
`manifest.webmanifest` from the NEW root (three small files, written for the new
site), and let the feeds 301 to the old host until this branch has a feed
generator of its own. A feed that keeps working is better than a feed that 404s.

**D3 · The design docs at the web root.** Recommend: add
`--exclude '*.md'` to the prod deploy's root rsync. The repo is public and
nothing here is secret, but a web root is a published surface and `CLAUDE.md`
sitting beside `index.html` is an accident, not a choice. (They stay under
`/nukernel/` in the repo and on staging.)

**D4 · The og:image.** Recommend: leave it as it is for launch. The card says
"Stellate — Infinite remixable music in many genres for free" with no picture,
which is the deliberate decision from 2026-09-08 and reads cleanly.

---

## 5 · The link in the hamburger

A row at the foot of the plate, under `HOW IT PLAYS`, beside `Daylight`,
`Set seed` and the log:

> **⧉ The old Stellate** — opens `old.stellate.app` in a new tab.

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

**Build it and ship it to staging BEFORE the switch**, pointing at
`old.stellate.app` — the row can be verified there the day the DNS record
exists, and then the launch deploy carries a link that has already been proven.

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
   in it. They are in the history and on `legacy`, and `old.stellate.app` is
   served from a tree on disk, not from a branch — so nothing on the live site
   depends on this. But a `git checkout main` after the rename will not contain
   the old app, and anyone rebuilding the archive must check out `legacy`.
2. **CI disappears with it.** `.github/workflows/verify.yml` is on main and not
   on this branch. Decide: port it (it will need this branch's gate list, which
   is `test/all.js` + the browser gates) or delete it deliberately. A workflow
   that vanishes silently is the worst of the three options.
3. **`tools/deploy/deploy-staging.sh` on the legacy branch carries
   `--delete-excluded`** and defaults to a stellate.app path. Run from a legacy
   checkout after the switch it would **delete the new site**. Before the
   rename, either point it at `/srv/stellate` explicitly with a comment saying
   why, or make it refuse to run unless `DEST` is passed. This is the single
   most dangerous thing in this document.

Sequence: **do the server switch first, verify it, then rename the branches.**
The rename buys nothing at launch time and, done first, it changes what
`deploy-*.sh` means while the switch is still in flight.

---

## 7 · The runbook

Each step verifies before the next one starts. Steps 1–4 are invisible to
anyone visiting stellate.app.

**1 · The archive gets its door.**
`doctl` A record → `certbot certonly --nginx -d old.stellate.app` → write
`/etc/nginx/sites-available/stellate-old` (§2) → `nginx -t` → reload → enable.
*Verify:* the star map loads, it makes sound, `/found/` is immutable, the
response carries `X-Robots-Tag: noindex`.

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
`/found/samples/…` 200 immutable · `/how.html` 301s to old.stellate.app ·
`/gc/count` still counts · `curl -I https://stellate.app/sw.js` shows v329.

**6 · Watch, with the rollback one line away.** §8.

**7 · The branches.** §6, after step 6 has held for as long as Paul wants.

---

## 8 · Rollback

**The switch:** put `root /srv/stellate;` back, remove the `@old` fallback,
`nginx -t && systemctl reload nginx`. The old site is prod again, byte-for-byte,
because it was never modified. `old.stellate.app` can stay up alongside it; it
costs nothing and is a second door to the same tree.

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

## 9 · What Paul has to decide

| | |
|---|---|
| **D1** | Add the GoatCounter beacon to the new `index.html`? *(recommend yes — otherwise prod analytics stop)* |
| **D2** | `robots.txt` / `sitemap.xml` / `manifest.webmanifest` written for the new site, feeds 301'd to the archive until this branch generates its own? *(recommend yes)* |
| **D3** | Exclude `*.md` from the prod deploy so the design docs are not published at the web root? *(recommend yes)* |
| **D4** | Ship with no `og:image`? *(recommend yes, as decided 2026-09-08)* |
| **D5** | Port `.github/workflows/verify.yml` to this branch, or retire it deliberately? |
| **D6** | Does `old.stellate.app` say anywhere on its own glass that it is the old one, or is the hamburger link on the new site the only signpost? *(the old tree is currently planned to be byte-for-byte unchanged; a banner is a change to it)* |

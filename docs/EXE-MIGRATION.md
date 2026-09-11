# Migrating a site to an exe.dev box

Written 2026-09-11, immediately after moving Stellate onto one, from what
actually happened rather than from the documentation. Every number and every
trap below was measured on the live migration; where the docs and the box
disagreed, the box won and that is recorded.

**The shape of the thing.** exe.dev gives you an Ubuntu VM with root, a
persistent disk, and an HTTPS edge in front of it. The edge terminates TLS,
handles certificates, and proxies to ONE port on your VM. You are not on a
platform: you are on a computer, with `apt` and `systemd`, and everything you
know about nginx still applies. The CLI is `ssh exe.dev <command>` — it is not
a program you install.

---

## 1 · The sequence

```bash
ssh -i ~/.ssh/id_exe exe.dev ls                     # what VMs exist
ssh -i ~/.ssh/id_exe exe.dev new <name>             # …or make one
ssh -i ~/.ssh/id_exe <name>.exe.xyz                 # a normal shell, user `exedev`, sudo yes

ssh -i ~/.ssh/id_exe exe.dev share port <name> 80   # which port the edge proxies
ssh -i ~/.ssh/id_exe exe.dev share set-public <name>   # stop gating it behind the exe login
ssh -i ~/.ssh/id_exe exe.dev resize <name> …        # if the disk is tight
ssh -i ~/.ssh/id_exe exe.dev domain add <name> <domain>   # after DNS points at <name>.exe.xyz
ssh -i ~/.ssh/id_exe exe.dev doc <slug>             # the docs, in the terminal
```

`ssh exe.dev doc` lists every page; `doc proxy`, `doc cnames`, `doc sharing`
and `doc migrating-to-exe` are the four worth reading before a move.

**Measure the payload against the disk before anything else.** A default box is
**9.8 GB** with about **4.7 GB free**. Stellate needed 815 MB (765 MB of it
media) and fits with room; a site with a big media tree may not, and finding
that out halfway through an rsync is the wrong time.

---

## 2 · The traps, in the order they bit

### The edge terminates TLS, so nginx never sees `https`

**This is the one that matters.** The page loads over HTTPS, nginx answers a
redirect, and the `Location` comes back `http://<name>.exe.xyz/…` — because
nginx builds absolute URLs from the scheme *it* was spoken to on, and the edge
speaks plain HTTP to port 80. The browser refuses the downgrade as mixed
content, the app's own fetches fail with `ERR_FAILED`, and the page reloads for
ever. Reported as *"it keeps constantly reloading and saying a problem
occurred"*, and invisible to a headless check that never followed a redirect.

```nginx
absolute_redirect off;
port_in_redirect off;
```

Every redirect inside one site is same-origin, so a **relative** `Location` says
exactly what was meant and carries no scheme to get wrong. Reconstructing the
scheme from `X-Forwarded-Proto` is the other option and it is worse: a second
source of truth about a URL you already know is yours. For an app that builds
its own absolute URLs (an Express app that emails links, say), pass the header
through and set the framework's `trust proxy` instead.

### The isolation headers DO survive the edge

Measured, unauthenticated, on the live box:

```
cross-origin-opener-policy: same-origin
cross-origin-embedder-policy: require-corp
cache-control: public, max-age=31536000, immutable   (on media)
```

The proxy is transparent about response headers and only ADDS `X-Forwarded-*`.
For Stellate this was the go/no-go — `SharedArrayBuffer` needs cross-origin
isolation and the ring engine throws without it — so if you are moving anything
that needs COOP/COEP, this is settled and you can stop worrying about it.

### "It works for me" means you are logged in

A VM's HTTPS endpoint is **private by default**: strangers get `307` to
`/__exe.dev/login`, but *you* sail through on an exe.dev cookie. So the owner
sees a working site and everyone else sees a login screen, with no error
anywhere to tell you. Check with `curl` or a private window, never with the
browser you administer the box from.

### `share set-public` may need to be its own command

Bundled with another command in one shell line it can be refused by an agent
sandbox as an outward-facing action; alone it goes through. Worth knowing before
you conclude the platform is broken. It is idempotent — running it twice is
free.

### The graceful-reload race will lie to you three times

`systemctl reload nginx` keeps the OLD workers alive until their in-flight
requests finish, so a smoke test fired a second later is answered by the config
you just replaced. It cost three separate false diagnoses in one day — 404s on
every path, a "broken" sitemap, a site that looked half-deployed. **Sleep two
seconds, or retry each check, before believing a reload's first answer.**

### `add_header` does not inherit

A `location` that sets any `add_header` stops inheriting the server-level ones —
so an isolation header, a `Cache-Control`, or a `X-Robots-Tag` silently vanishes
from exactly the paths that set something else. Repeat the headers in every
block that adds one. This is nginx, not exe.dev, and it has cost this project an
evening on two separate hosts.

### There is no localhost backend you did not bring

The droplet proxied `/gc/count` to a GoatCounter on `127.0.0.1`; the new box has
none, so a vendored analytics beacon became a failed request on every load.
Either bring the service (it is a systemd unit and a binary) or answer the path
deliberately:

```nginx
location /gc/count { return 204; }   # counted nowhere, on purpose
location /gc/      { return 404; }
```

---

## 3 · Moving the bytes

Pull from the old host, push to the new one; two hops, because the new box has
no credentials for the old one and should not be given any.

```bash
rsync -a --info=stats1 root@oldhost:/srv/site/ /tmp/pull/          # 766 MB took ~15 s
rsync -a --delay-updates -e "ssh -i ~/.ssh/id_exe" /tmp/pull/ <name>.exe.xyz:/srv/site/
```

`--delay-updates` so a visitor never meets a half-written file. **Take the media
from the OLD HOST, not from the repo** — what is live is what is live, and a
repo's copy usually has more in it (Stellate's local `found/` is 1.4 GB against
prod's 765 MB, the difference being things the deploy excludes).

Keep media in its own directory and symlink it into each web root
(`/srv/media/found` → `/srv/site/found`). It survives a redeploy, it is shared
between the live site and an archive, and it is the one thing you do not want to
copy twice on a 9.8 GB disk.

---

## 4 · The checklist

1. `exe.dev ls` / `new`; SSH in; `df -h`; compare against the payload.
2. `apt install nginx` if it is not there (the `exeuntu` image has it).
3. Web roots, media symlinks, then **pull → push** the bytes.
4. nginx config: the old host's vhost, plus `absolute_redirect off`, minus any
   `listen 443` / `ssl_*` lines — the edge owns TLS. Keep every `add_header` in
   every location that sets one.
5. `nginx -t`, reload, **wait**, then smoke from INSIDE the VM (`curl
   127.0.0.1`) — that answers "is the site right" without involving the edge.
6. `share port <name> 80`, then `share set-public <name>`.
7. Smoke from OUTSIDE, unauthenticated: status, headers, a redirect, a media
   file. Then load it in a real browser and **reload it** — the reload is where
   the scheme bug lives.
8. Only then DNS: `CNAME` → `<name>.exe.xyz`, `domain add`, certificate is
   automatic. Until the domain is registered exe answers `421`.

---

## 5 · Next: ftrain.com

**It is not a static tree, which changes step 4 and nothing else.** Measured
today: `ftrain.com` answers `Server: nginx/1.24.0 (Ubuntu)` and
`X-Powered-By: Express`, and `~/ftrain-2025` is `ftrain-cms` — a Vite build
plus a `tsx` Express server (`npm run build` → `tsc && vite build`, with a
`dist/public` copy step).

So the shape is:

- **A systemd unit for the Express server**, listening on a high port bound to
  `127.0.0.1`, with `Restart=always` and the environment it needs.
- **nginx proxying to it** rather than serving a root: `proxy_pass`,
  `proxy_set_header Host $host`, and the `X-Forwarded-*` the edge already gave
  us passed through. Set Express's `trust proxy` so it believes the protocol —
  this is the same scheme trap as §2, one layer up, and an Express app that
  builds absolute URLs will get them wrong until you do.
- **Static assets** (`dist/public`) served by nginx directly, not through node.
- **The data.** Whatever the CMS persists — a database, an uploads directory —
  is the part a static-site runbook does not cover and the part that must be
  moved with the service stopped, or moved twice with the second pass taken
  during the cutover.
- Node itself: install the version the build expects, and check `npm run build`
  on the box before pointing anything at it. A 3.8 GB VM builds Vite fine.

Everything in §1–§4 applies unchanged.

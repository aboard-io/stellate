#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# switch-prod-vhost.sh — THE SWITCH. stellate.app stops serving the star map
# and starts serving the music box; the star map keeps every byte it has and
# answers at stellate.app/old. nukernel/LAUNCH.md is the plan and the reasoning.
#
# THIS IS THE ONE STEP THAT IS VISIBLE TO EVERYBODY, and it is four minutes of
# nginx: two `root` lines and five location blocks. Everything it depends on is
# already done and already verified —
#
#   · /srv/stellate-nu exists, holds the box (28 MB, one front door), and has
#     `found -> /srv/stellate/found` and `old -> /srv/stellate` beside it;
#   · the same arrangement has been running on test.stellate.app since v331:
#     the archive at /old draws, plays, is cross-origin isolated through the
#     symlink and registers ZERO service workers;
#   · /srv/stellate is untouched and stays untouched. It is the rollback.
#
# WHAT IT DOES, in order, refusing at the first thing that is not as expected:
#   1 · backs the vhost up to /root/stellate.bak-<stamp>
#   2 · swaps both `root /srv/stellate;` lines for `/srv/stellate-nu`
#       (it asserts there are exactly two; a third means the file moved on and
#        this script should be re-read before it is re-run)
#   3 · appends the five location blocks: the try_files fallback to the
#       archive, the archive itself with its own isolation headers and
#       noindex, the self-unregistering worker at /old/sw.js, and the
#       /nukernel/ redirect
#   4 · `nginx -t` — AND RESTORES THE BACKUP IF IT FAILS, before touching a
#       running server
#   5 · reloads, then smoke-tests the live name over the wire
#
#   tools/deploy/switch-prod-vhost.sh --yes-switch
#   tools/deploy/switch-prod-vhost.sh --rollback     # newest backup, reload
#
# ROLLBACK IS ONE LINE AND ALWAYS AVAILABLE. The archive was never modified, so
# putting the old vhost back makes stellate.app the star map again exactly as
# it was. The only asymmetry is service workers, and LAUNCH.md §8 says what to
# do about them (the same kill-switch this script installs at /old/sw.js can be
# pointed at /sw.js in thirty seconds).
# ---------------------------------------------------------------------------
set -euo pipefail

HOST="${HOST:-root@stellate.app}"
SITE="${SITE:-https://stellate.app}"
VHOST=/etc/nginx/sites-available/stellate
MODE=""
for a in "$@"; do
  case "$a" in
    --yes-switch) MODE=switch ;;
    --rollback)   MODE=rollback ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
if [ -z "$MODE" ]; then
  echo "refusing: this changes what stellate.app serves." >&2
  echo "  tools/deploy/switch-prod-vhost.sh --yes-switch" >&2
  echo "  tools/deploy/switch-prod-vhost.sh --rollback" >&2
  exit 2
fi

if [ "$MODE" = "rollback" ]; then
  ssh "$HOST" 'set -e
    b=$(ls -1t /root/stellate.bak-* 2>/dev/null | head -1)
    [ -n "$b" ] || { echo "no backup found in /root" >&2; exit 1; }
    cp "$b" /etc/nginx/sites-available/stellate
    nginx -t && systemctl reload nginx && echo "rolled back to $b"'
  curl -sI --max-time 20 "$SITE/" | head -1
  exit 0
fi

# ---- the fragment, built here so it is reviewable in the repo --------------
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<'CONF'

  # ===== THE SWITCH (2026-09-08, nukernel/LAUNCH.md) =======================
  # The root above is /srv/stellate-nu — the music box, deployed from the
  # nukernel branch. The star map that was this site until today is UNCHANGED
  # at /srv/stellate and is reached through a symlink, /srv/stellate-nu/old,
  # so it needs no second certificate and no second origin. localStorage
  # belongs to the ORIGIN, which is why it is a path and not a subdomain: the
  # archive still reads the settings its own visitors saved.

  # A path this site has is served; a path only the archive has is handed to
  # the archive, query string intact. Hash fragments never reach a server, so
  # a #at=…&y=… share link is untouched either way. No add_header in this
  # block ON PURPOSE — a location that sets one stops inheriting the
  # server-level isolation headers, and this one wants all of them.
  location / { try_files $uri $uri/ @old; }
  location @old { return 301 /old$request_uri; }

  # THE ARCHIVE. The isolation snippet is repeated because this block sets its
  # own headers and add_header does not inherit — and the star map THROWS
  # without cross-origin isolation (its SharedArrayBuffer ring engine).
  # noindex because two addresses serving two versions of one project should
  # not compete for the same search.
  location /old/ {
    include /etc/nginx/snippets/stellate-isolation.conf;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-cache";
  }

  # AND THE ARCHIVE INSTALLS NO WORKER. It registers RELATIVELY
  # (serviceWorker.register("sw.js")), so this is the exact file it asks for.
  # Both trees name their caches stellate-app-<VERSION> and each one's activate
  # deletes what is not its own — on ONE origin that is an eviction loop, each
  # app deleting the other's shell forever. So the archive gets a worker that
  # unregisters itself and runs from the network; the box's own worker ignores
  # /old/ from the other side (sw.js). An archive does not need to be offline.
  location = /old/sw.js {
    include /etc/nginx/snippets/stellate-isolation.conf;
    add_header Cache-Control "no-store";
    default_type text/javascript;
    return 200 "self.addEventListener('install',e=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('stellate-app-'))await caches.delete(k);await self.registration.unregister();const cs=await self.clients.matchAll({type:'window'});for(const c of cs)c.navigate(c.url);})()));\n";
  }

  # ONE FRONT DOOR. The tree is served at the root only; /nukernel/ was the
  # other door on staging and is a redirect here, carrying its query string so
  # a ?at= link survives the hop (a fragment survives it by itself).
  location /nukernel/ { return 301 https://stellate.app/$is_args$args; }
CONF

echo "== switching $SITE to /srv/stellate-nu =="
B64="$(base64 -w0 < "$TMP")"
ssh "$HOST" "set -e
  stamp=\$(date +%Y%m%d-%H%M%S)
  cp $VHOST /root/stellate.bak-\$stamp
  echo $B64 | base64 -d > /root/prod-add.conf
  python3 - <<'PY'
p = '$VHOST'
s = open(p).read()
n = s.count('root /srv/stellate;')
assert n == 2, 'expected 2 root lines, found %d — re-read the vhost' % n
assert 'stellate-nu' not in s, 'already switched'
s = s.replace('root /srv/stellate;', 'root /srv/stellate-nu;')
add = open('/root/prod-add.conf').read()
i = s.rindex('}')
open(p, 'w').write(s[:i] + add + '}\n')
print('  root swapped in 2 blocks, %d bytes of locations added' % len(add))
PY
  if ! nginx -t 2>&1 | tail -1; then
    echo '  nginx -t FAILED — restoring the backup, nothing was reloaded' >&2
    cp /root/stellate.bak-\$stamp $VHOST
    nginx -t >/dev/null 2>&1 && echo '  restored' >&2
    exit 1
  fi
  systemctl reload nginx
  echo \"  reloaded · backup at /root/stellate.bak-\$stamp\""

# ---- the smoke, over the wire ---------------------------------------------
echo "== smoke =="
fail=0
chk() {
  local label="$1" url="$2" want="$3" hdr="${4:-}"
  local out
  out="$(curl -fsS -D /tmp/.swhdr --max-time 25 "$url" 2>/dev/null || true)"
  if [ -z "$out" ]; then echo "   FAIL $label ($(head -1 /tmp/.swhdr 2>/dev/null | tr -d '\r'))"; fail=1; return; fi
  if [ "$want" != "-" ] && ! printf '%s' "$out" | grep -q "$want"; then
    echo "   FAIL $label — body has no '$want'"; fail=1; return; fi
  if [ -n "$hdr" ] && ! grep -qi "$hdr" /tmp/.swhdr; then
    echo "   FAIL $label — no header '$hdr'"; fail=1; return; fi
  echo "   ok   $label"
}
chk "the box at the root"   "$SITE/"                     "nu-topstrip"  "Cross-Origin-Opener-Policy"
chk "the worker"            "$SITE/sw.js"                "stellate-app-"
chk "the archive at /old"   "$SITE/old/"                 "STELLATE"     "X-Robots-Tag"
chk "the archive's worker"  "$SITE/old/sw.js"            "unregister"
chk "shared media"          "$SITE/found/bbc_anchor_locker.64.mp3" "-"  "immutable"
chk "robots"                "$SITE/robots.txt"           "Sitemap:"
chk "sitemap"               "$SITE/sitemap.xml"          "<urlset"
chk "feed"                  "$SITE/feed.xml"             "<rss"
chk "manifest"              "$SITE/manifest.webmanifest" "start_url"
echo -n "   old path /how.html -> "; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" --max-time 20 "$SITE/how.html"
echo -n "   old door /nukernel/ -> "; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" --max-time 20 "$SITE/nukernel/index.html"
rm -f /tmp/.swhdr
if [ "$fail" != "0" ]; then
  echo "SMOKE FAILED. Roll back with: tools/deploy/switch-prod-vhost.sh --rollback" >&2
  exit 1
fi
echo "done. $SITE is the box; $SITE/old is the star map, unchanged."

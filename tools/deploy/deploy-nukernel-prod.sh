#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-nukernel-prod.sh — this branch onto stellate.app. LAUNCH.md is the plan.
#
# THIS IS THE ONLY SCRIPT IN THIS TREE THAT MAY WRITE TO THE LIVE SITE, and it
# is deliberately harder to run than the staging one. Paul: *"Add the guard and
# make things secure."* The asymmetry is the point: a staging deploy is a
# keystroke and a prod deploy is a decision.
#
# WHAT MAKES A WRONG PROD DEPLOY DIFFERENT FROM A WRONG STAGING DEPLOY: this
# tree ships a SERVICE WORKER. A bad staging build is gone on the next rsync; a
# bad prod build is CACHED on every visitor's device under a version key and
# stays there until a bumped VERSION reaches them. So the four guards below are
# not ceremony — each one is a failure that has actually happened to somebody:
#
#   1 · `--yes-prod` REQUIRED. No default, no env var, no "it was the last
#       command in my history". The word is typed.
#   2 · THE TREE MUST BE CLEAN and the deploy is taken from a detached worktree
#       of HEAD — never from the working tree. A deploy of uncommitted work is a
#       deploy nobody can reproduce or roll back.
#   3 · THE VERSION MUST HAVE MOVED. If sw.js's VERSION is the same one the
#       live site is already serving, this refuses: that is the deploy that
#       reaches nobody, and it is the single most expensive mistake this
#       project has made (see sw.js, "THE DEPLOY HAS TO REACH THE EAR").
#       `--same-version` overrides it for a re-ship of identical bytes.
#   4 · THE DESTINATION IS A PROD ROOT AND IS NOT THE ARCHIVE. `/srv/stellate`
#       holds the OLD site, which `stellate.app/old` serves and which this branch
#       must never overwrite — the deploy rsyncs WITHOUT `--delete` (the tree is
#       pruned), so writing into it would interleave two sites permanently.
#
# AND IT SMOKE-TESTS AFTERWARDS, over the wire, against the real name: the page,
# the worker's version, a media file, the isolation headers and the open-web
# layer. A deploy that "worked" and left the site broken is not a deploy that
# worked, and the check costs six requests.
#
#   tools/deploy/deploy-nukernel-prod.sh --yes-prod
#   tools/deploy/deploy-nukernel-prod.sh --yes-prod --same-version
#   DEST=root@stellate.app:/srv/stellate-nu/ tools/deploy/…   (the default)
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="${DEST:-root@stellate.app:/srv/stellate-nu/}"
SITE="${SITE:-https://stellate.app}"
SW="$REPO/sw.js"
YES=0; SAMEVER=0; SMOKE=1
for a in "$@"; do
  case "$a" in
    --yes-prod)     YES=1 ;;
    --same-version) SAMEVER=1 ;;
    # THE LAUNCH DEPLOY ONLY. Before the switch the vhost still points at the
    # archive, so smoking $SITE would test the OLD site and fail on every
    # check — a red that means nothing. Deploy with --no-smoke, switch the
    # root, then run this script again with --same-version: the rsync is a
    # no-op and the smoke is the real one. Never use it for an ordinary deploy.
    --no-smoke)     SMOKE=0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

# ---- GUARD 1 · the word is typed ------------------------------------------
if [ "$YES" != "1" ]; then
  echo "refusing: this writes to the LIVE site ($SITE, $DEST)." >&2
  echo "  Re-run with --yes-prod if that is what you mean." >&2
  echo "  For test.stellate.app use tools/deploy/deploy-nukernel-staging.sh." >&2
  exit 2
fi

# ---- GUARD 4 · never the archive, never a staging root --------------------
case "$DEST" in
  */srv/stellate/|*/srv/stellate)
    echo "refusing: $DEST is the ARCHIVE (stellate.app/old) and must not be written." >&2
    exit 2 ;;
  *stellate-test*)
    echo "refusing: $DEST is staging. Use deploy-nukernel-staging.sh." >&2
    exit 2 ;;
  *stellate-nu*) ;;
  *) echo "refusing: $DEST is not a known prod root." >&2; exit 2 ;;
esac

# ---- GUARD 2 · a clean tree, and the deploy comes from HEAD ---------------
if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
  echo "refusing: the working tree is dirty. Commit or stash first." >&2
  git -C "$REPO" status --short >&2
  exit 2
fi

VER="$(grep -oE 'const VERSION = "v[0-9]+"' "$SW" | grep -oE 'v[0-9]+')"
HEADSHA="$(git -C "$REPO" rev-parse --short HEAD)"

# ---- GUARD 3 · the version has to have moved ------------------------------
LIVE="$(curl -fsS --max-time 15 "$SITE/sw.js" 2>/dev/null \
        | grep -oE 'const VERSION = "v[0-9]+"' | grep -oE 'v[0-9]+' || true)"
if [ -n "$LIVE" ] && [ "$LIVE" = "$VER" ] && [ "$SAMEVER" != "1" ]; then
  echo "refusing: the live site is already serving sw.js $LIVE." >&2
  echo "  Bump it (tools/deploy/deploy-nukernel-staging.sh --bump), commit, re-run." >&2
  echo "  Or pass --same-version to re-ship identical bytes on purpose." >&2
  exit 2
fi

echo "== prod deploy =="
echo "   commit   $HEADSHA"
echo "   worker   ${LIVE:-(none)} -> $VER"
echo "   dest     $DEST"
echo "   site     $SITE"

# THE FEEDS AND THE SITEMAP ARE GENERATED ON THE WAY OUT THE DOOR, which is the
# arrangement the old site used and the reason it worked: they are DERIVED from
# git log and from the catalogue, they are gitignored, and generating them here
# means a release note can never describe a build that was not shipped.
echo "== feeds + sitemap =="
node "$REPO/tools/build/gen-feed.js"
node "$REPO/tools/build/gen-sitemap.js"

# THE SOURCE IS A CLEAN WORKTREE OF HEAD — with the generated files copied in,
# because they are gitignored and a worktree of HEAD does not contain them.
TMP="$(mktemp -d)"
cleanup() { git -C "$REPO" worktree remove --force "$TMP/tree" >/dev/null 2>&1 || true
            rm -rf "$TMP"; }
trap cleanup EXIT
git -C "$REPO" worktree add --detach "$TMP/tree" HEAD >/dev/null
for f in feed.xml feed.json feed-archive.xml feed-archive.json sitemap.xml; do
  [ -f "$REPO/nukernel/$f" ] && cp "$REPO/nukernel/$f" "$TMP/tree/nukernel/$f"
done

cd "$TMP/tree"
# The exclude list is deploy-nukernel-staging.sh's, verbatim and for its
# reasons: no --delete (the tree is pruned), no markdown or sources in the web
# root (LAUNCH.md D3), vendor/ included (the screensaver imports three.js from
# /vendor/three at mount time).
EXCLUDES=(--exclude '.git' --exclude 'node_modules' --exclude '*.wav'
          --exclude '*.mp3' --exclude '*.md' --exclude 'docs/'
          --exclude 'src/' --exclude 'ideal/' --exclude '*-extract.js'
          --exclude 'package.json' --exclude 'package-lock.json'
          --exclude 'tsconfig.json' --exclude 'serve.sh' --exclude 'verify.sh')

# ONE FRONT DOOR ON PROD, WHICH IS THE DIFFERENCE FROM STAGING (LAUNCH.md §10).
# The staging script also ships `nukernel` as a DIRECTORY, so the tree is served
# twice — at /nukernel/ and, its contents, at the root. That is history (the
# root became the front door after a deploy refreshed only /nukernel/ and Paul
# opened the site to the previous evening's build) and it costs the whole app
# twice over, a 2.5 MB genres.js included. Here the root is the only door and
# the vhost 301s /nukernel/ to it, carrying $is_args$args so a ?at= link
# survives the hop and a fragment survives by itself.
rsync -a --delay-updates "${EXCLUDES[@]}" \
  engine vendor sw.js "$DEST"

rsync -aR --delay-updates \
  tools/theory.js tools/genealogy.js \
  tools/mine/mine-midi.js tools/mine/mine-melody.js tools/mine/mine-groove.js \
  tools/genres/grammar.js tools/genres/emit.js \
  tools/remix.js "$DEST"

rsync -a --delay-updates "${EXCLUDES[@]}" --exclude 'genres/' \
  nukernel/ "$DEST"

# ---- THE SMOKE TEST, over the wire, against the real name -----------------
if [ "$SMOKE" != "1" ]; then
  echo "== smoke skipped (--no-smoke) =="
  echo "done. files are in $DEST · commit $HEADSHA · worker $VER"
  echo "Nothing points at them yet. Switch the vhost root, then re-run with"
  echo "--yes-prod --same-version to deploy nothing and smoke everything."
  exit 0
fi
echo "== smoke =="
fail=0
chk() { # chk <label> <url> <grep-pattern|-> [header-pattern]
  local label="$1" url="$2" body="$3" hdr="${4:-}"
  local out code
  out="$(curl -fsS -D /tmp/.nuhdr --max-time 20 "$url" 2>/dev/null || true)"
  code="$(head -1 /tmp/.nuhdr 2>/dev/null | tr -d '\r')"
  if [ -z "$out" ]; then echo "   FAIL $label — no body ($code)"; fail=1; return; fi
  if [ "$body" != "-" ] && ! printf '%s' "$out" | grep -q "$body"; then
    echo "   FAIL $label — body does not carry '$body' ($code)"; fail=1; return; fi
  if [ -n "$hdr" ] && ! grep -qi "$hdr" /tmp/.nuhdr; then
    echo "   FAIL $label — no header '$hdr'"; fail=1; return; fi
  echo "   ok   $label"
}
chk "the page"        "$SITE/"                    "nu-topstrip" "Cross-Origin-Opener-Policy"
chk "the worker"      "$SITE/sw.js"               "$VER"
chk "isolation"       "$SITE/nu.css"              "-"           "Cross-Origin-Embedder-Policy"
chk "robots"          "$SITE/robots.txt"          "Sitemap:"
chk "sitemap"         "$SITE/sitemap.xml"         "<urlset"
chk "feed"            "$SITE/feed.xml"            "<rss"
chk "manifest"        "$SITE/manifest.webmanifest" "start_url"
chk "the archive"     "$SITE/old/"                "-"
rm -f /tmp/.nuhdr
if [ "$fail" != "0" ]; then
  echo "SMOKE FAILED. The site may be half-right — roll back by pointing the" >&2
  echo "prod vhost's root at /srv/stellate and reloading nginx (LAUNCH.md §8)." >&2
  exit 1
fi

echo "done. $SITE  · commit $HEADSHA · worker $VER"
echo "(a deploy lands one reload later: the service worker swaps on the next load.)"

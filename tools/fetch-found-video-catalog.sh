#!/usr/bin/env bash
# Cache the STREAM-CATALOG video clips locally — the catalog analog of
# fetch-found-video.sh. Where fetch-found-video.sh cuts a hand-curated clips()
# list and cut-lib-clips.sh cuts the local lib/ reels, THIS script is fully
# data-driven: it walks found/video/stream-catalog.json and fetches the cue
# window of every clip that has an archive.org `item` but no local cache yet
# (today that's the ~97 `av_*` avant-garde film reels the browser could not
# stream past CORS). This script IS the committed recipe; the mp4s it writes
# are NOT committed (gitignored, regenerable).
#
#   ./fetch-found-video.sh        # first: the curated disc clips + clips.json
#   ./cut-lib-clips.sh            # then:  cut local lib/ reels, MERGE into clips.json
#   ./fetch-found-video-catalog.sh   # then: fetch remaining catalog clips, MERGE
#
# Each window is range-seeked over HTTP (only the needed bytes are fetched, not
# the whole reel), scaled to 640px, stripped of audio, and re-encoded small with
# the SAME flags as fetch-found-video.sh, then MERGED into found/video/clips.json
# (dedup by file, idempotent) so video-layer.js's localAvail picks it up and
# plays it local-first. Server-side ffmpeg has no CORS, so items that failed to
# stream in the browser can succeed here; genuinely dead items (404/500) are
# skipped and listed at the end.
#
# Requires: ffmpeg (with https), node.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="found/video"
CATALOG="$OUT/stream-catalog.json"
[ -s "$CATALOG" ] || { echo "no $CATALOG — nothing to fetch"; exit 0; }

TIMEOUT="${CLIP_TIMEOUT:-180}"   # per-clip wall-clock cap (seconds)
fails="$(mktemp)"                # name|item|url|reason — printed as a summary at the end

# Emit one fetch row per catalog clip that has an archive.org item:
#   name<TAB>in(s)<TAB>dur(s)<TAB>encoded-url
# URL = base/item/encodeURI(file); base defaults to archive.org/download.
rows="$(mktemp)"
node - "$CATALOG" > "$rows" <<'NODE'
const fs = require("fs");
const cat = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const base = (cat.base || "https://archive.org/download").replace(/\/+$/, "");
for (const c of cat.clips || []) {
  if (!c.item || !c.file) continue;                // item:null => local-only, skip
  const dur = +(Number(c.out) - Number(c.in)).toFixed(3);
  if (!(dur > 0)) continue;
  const url = `${base}/${c.item}/${encodeURI(c.file)}`;
  process.stdout.write(`${c.name}\t${c.in}\t${dur}\t${url}\n`);
}
NODE

total=0; fetched=0; cached=0; failed=0
echo "→ fetching catalog clips into $OUT/ (timeout ${TIMEOUT}s each) …"
while IFS=$'\t' read -r name inS dur url; do
  [ -n "$name" ] || continue
  total=$((total+1))
  out="$OUT/${name}.mp4"
  if [ -s "$out" ]; then echo "  ✓ ${name} (cached)"; cached=$((cached+1)); continue; fi
  echo "  → ${name} (@${inS}s ${dur}s)"
  if timeout "$TIMEOUT" ffmpeg -y -loglevel error -ss "$inS" -i "$url" -t "$dur" \
        -an -vf "scale=640:-2,fps=30" -c:v libx264 -crf 27 -preset veryfast \
        -movflags +faststart "$out" </dev/null 2>/tmp/ffmpeg-catalog-err; then
    # a bad seek can leave a header-only file (ffmpeg rc=0 but no frames);
    # validate real video with ffprobe so a re-run retries it instead of caching junk.
    d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null || true)"
    if [ -s "$out" ] && awk "BEGIN{exit !(\"$d\"+0>0)}"; then
      fetched=$((fetched+1))
    else
      echo "    ✗ empty/no-frames output (dur=$d)"; rm -f "$out"; failed=$((failed+1))
      printf '%s\t%s\tempty-output\n' "$name" "$url" >> "$fails"
    fi
  else
    rc=$?
    reason="ffmpeg-rc-$rc"; [ "$rc" = "124" ] && reason="timeout-${TIMEOUT}s"
    echo "    ✗ ${reason}: $(tail -n1 /tmp/ffmpeg-catalog-err 2>/dev/null)"
    rm -f "$out"; failed=$((failed+1))
    printf '%s\t%s\t%s\n' "$name" "$url" "$reason" >> "$fails"
  fi
done < "$rows"
rm -f "$rows" /tmp/ffmpeg-catalog-err

# Merge every catalog clip that now has a local mp4 into clips.json (dedup by
# file, update credit) — same writer/format as cut-lib-clips.sh, so the disc,
# lib and catalog clips coexist idempotently.
node - "$OUT" "$CATALOG" <<'NODE'
const fs = require("fs"), path = require("path");
const [OUT, CATALOG] = process.argv.slice(2);
const cat = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const cj = path.join(OUT, "clips.json");
let clips = [];
try { clips = JSON.parse(fs.readFileSync(cj, "utf8")); } catch (e) {}
const have = new Set(clips.map(c => c.file));
let added = 0;
for (const c of cat.clips || []) {
  const file = c.name + ".mp4";
  if (!fs.existsSync(path.join(OUT, file))) continue;   // only cached clips
  const credit = c.credit || c.title || c.name;
  if (!have.has(file)) { clips.push({ file, credit }); have.add(file); added++; }
  else clips = clips.map(x => x.file === file ? { file, credit } : x);
}
fs.writeFileSync(cj, "[\n" + clips.map(c => `  ${JSON.stringify(c)}`).join(",\n") + "\n]\n");
console.log(`merged catalog clips into ${cj}: +${added} new, ${clips.length} total`);
NODE

echo ""
echo "Catalog fetch: ${fetched} fetched, ${cached} cached, ${failed} failed of ${total} clips."
if [ -s "$fails" ]; then
  echo "Failed (item/url unreachable — skipped, will retry on next run):"
  while IFS=$'\t' read -r name url reason; do
    echo "  ✗ ${name}  [${reason}]  ${url}"
  done < "$fails"
fi
rm -f "$fails"
echo "Done. $(ls "$OUT"/*.mp4 2>/dev/null | wc -l) clips in $OUT/ + clips.json"

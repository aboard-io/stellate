#!/usr/bin/env bash
# Cut the found-VIDEO *library* (found/video/lib/*.mp4) into short background
# clips — the lib analog of fetch-found-video.sh. Where fetch-found-video.sh
# range-seeks Internet Archive discs over HTTP, the lib sources are already-
# downloaded full reels (3D-graphics films, PD anime) that arrived without a
# cue manifest. This script IS the committed recipe: the reels themselves are
# NOT committed (gitignored, ~525MB), but the cue windows + genre affinities
# below make them recoverable.
#
#   ./fetch-found-video.sh   # first: the disc clips + clips.json
#   ./cut-lib-clips.sh       # then:  cut lib/ reels, MERGE into clips.json
#
# Each window is cut to a small, silent, 640px MP4 in found/video/ (same encode
# as fetch-found-video.sh) and merged into found/video/clips.json (dedup by
# file, so it coexists with the disc clips and is idempotent). It also writes
# found/video/lib/segments.json — a richer manifest (in/out + genre tags +
# provenance) for the genre-kernel clip-pool crew. See SOURCES.md for credits.
# Requires: ffmpeg, node.
set -euo pipefail
cd "$(dirname "$0")"
LIB="found/video/lib"
OUT="found/video"
[ -d "$LIB" ] || { echo "no $LIB — nothing to cut"; exit 0; }

# name|lib_basename|start(s)|dur(s)|cropBottomFrac|genres(csv)|credit
# cropBottomFrac trims burned-in subtitles off the PD anime before scaling.
data() { cat <<'EOF'
cmm_wireglobe|3dgfx_computer_made_movies|120|30|0|vaporwave,mallsoft,idm,minimal,darksynth,spacelounge|Computer-Made Movies — Bell Labs early CGI (E. Zajac, "Two-Gyro Gravity-Gradient Attitude Control", 1963) — wireframe globe on black
cmm_gyrobox|3dgfx_computer_made_movies|296|30|0|vaporwave,mallsoft,idm,minimal,electro|Computer-Made Movies — Bell Labs early CGI (1963) — rotating wireframe attitude box
cmm_crescent|3dgfx_computer_made_movies|384|24|0|vaporwave,mallsoft,ambient,spacelounge,darksynth|Computer-Made Movies — Bell Labs early CGI (1963) — crescent-lit wireframe globe
im_pixeltext|3dgfx_incredible_machine|324|18|0|chiptune,vaporwave,idm,electro,mallsoft|The Incredible Machine — Bell Labs (1968) — computer-generated pixel typography
im_paint|3dgfx_incredible_machine|408|22|0|vaporwave,mallsoft,lofi,neoclassical|The Incredible Machine — Bell Labs (1968) — computer-scanned pointillist painting
im_redroom|3dgfx_incredible_machine|508|22|0|industrial,darksynth,techno,coldwave,ebm|The Incredible Machine — Bell Labs (1968) — red monochrome machine room
im_scope|3dgfx_incredible_machine|600|24|0|idm,chiptune,minimal,electro,vaporwave|The Incredible Machine — Bell Labs (1968) — oscilloscope waveform
jm_dipole|3dgfx_jupiter_magnetosphere|40|30|0|darksynth,vaporwave,ambient,spacelounge,psytrance|Jupiter's Magnetosphere — The Movie — glowing dipole field lines
jm_axis|3dgfx_jupiter_magnetosphere|90|26|0|darksynth,vaporwave,psytrance,trance,ambient|Jupiter's Magnetosphere — The Movie — magnetic-axis field burst
jm_flux|3dgfx_jupiter_magnetosphere|116|22|0|darksynth,psytrance,edm,electro,spacelounge|Jupiter's Magnetosphere — The Movie — orange flux ropes
la_mesh1|3dgfx_losalamos_sims_1975|128|30|0|vaporwave,mallsoft,idm,electro,minimal|Los Alamos computer simulations (c.1975) — yellow 3D wireframe surface
la_meshvase|3dgfx_losalamos_sims_1975|205|26|0|vaporwave,mallsoft,idm,electro|Los Alamos computer simulations (c.1975) — yellow mesh surface of revolution
la_mesh2|3dgfx_losalamos_sims_1975|270|26|0|vaporwave,mallsoft,idm,minimal,darksynth|Los Alamos computer simulations (c.1975) — yellow 3D wireframe peaks
mo_singalong|anime_momotaro_shinpei|2210|30|0.12|chiptune,hogcore,shibuyakei|Momotaro: Umi no Shinpei (1945, PD, M. Seo) — animal chorus sing-along
mo_pastoral|anime_momotaro_shinpei|708|22|0.12|ambient,lofi,exotica,bossanova|Momotaro: Umi no Shinpei (1945, PD, M. Seo) — terraced-field landscape
mo_dance|anime_momotaro_shinpei|3208|26|0.12|witchhouse,triphop,ambient,chiptune|Momotaro: Umi no Shinpei (1945, PD, M. Seo) — backlit silhouette dance
EOF
}

echo "→ cutting lib clips into $OUT/ …"
data | while IFS='|' read -r name lib start dur crop genres credit; do
  src="$LIB/${lib}.mp4"
  out="$OUT/${name}.mp4"
  [ -s "$src" ] || { echo "  (skip $name — missing $src)"; continue; }
  if [ -s "$out" ]; then echo "  ✓ ${name} (cached)"; continue; fi
  if [ "$crop" != "0" ]; then
    vf="crop=iw:ih*(1-${crop}):0:0,scale=640:-2,fps=30"
  else
    vf="scale=640:-2,fps=30"
  fi
  echo "  → ${name} (${lib} @${start}s ${dur}s)"
  ffmpeg -y -loglevel error -ss "$start" -i "$src" -t "$dur" \
    -an -vf "$vf" -c:v libx264 -crf 27 -preset veryfast \
    -movflags +faststart "$out" </dev/null
done

# merge into clips.json (dedup by file) + write lib/segments.json (rich manifest)
tmp="$(mktemp)"; data > "$tmp"
LIB_DATA="$tmp" node - "$OUT" "$LIB" <<'NODE'
const fs = require("fs"), path = require("path"), cp = require("child_process");
const [OUT, LIB] = process.argv.slice(2);
const rows = fs.readFileSync(process.env.LIB_DATA, "utf8").trim().split("\n")
  .map(l => { const [name, lib, start, dur, crop, genres, credit] = l.split("|");
    return { name, lib, in: +start, out: +start + +dur, crop: +crop,
             genres: genres.split(","), credit }; })
  .filter(r => fs.existsSync(path.join(OUT, r.name + ".mp4")));

// --- merge clips.json (found/video/clips.json), dedup by file ---
const cj = path.join(OUT, "clips.json");
let clips = [];
try { clips = JSON.parse(fs.readFileSync(cj, "utf8")); } catch (e) {}
const have = new Set(clips.map(c => c.file));
for (const r of rows) {
  const file = r.name + ".mp4";
  if (!have.has(file)) { clips.push({ file, credit: r.credit }); have.add(file); }
  else clips = clips.map(c => c.file === file ? { file, credit: r.credit } : c);
}
fs.writeFileSync(cj, "[\n" + clips.map(c =>
  `  ${JSON.stringify(c)}`).join(",\n") + "\n]\n");
console.log(`merged ${rows.length} lib clips into ${cj} (${clips.length} total)`);

// --- rich manifest: found/video/lib/segments.json ---
// provenance: film identity is confident from frame inspection; exact archive.org
// item ids were NOT recoverable from the filenames or any committed recipe.
const PROV = {
  "3dgfx_computer_made_movies": { title: "Computer-Made Movies (Bell Labs early CGI compilation)", year: "c.1963-70", license: "PD-adjacent (US-gov/Bell Labs ephemeral; verify before redistribution)", note: "Contains Edward E. Zajac's 'Two-Gyro Gravity-Gradient Attitude Control System' (Bell Labs, 1963) — the first computer-generated film. Film identity confident; archive.org item id not recovered." },
  "3dgfx_incredible_machine": { title: "The Incredible Machine (Bell Telephone Laboratories)", year: "1968", license: "PD-adjacent (Bell Labs / AT&T promotional; verify before redistribution)", note: "Bell Labs documentary on computer graphics, computer music and computer-drawn art. Film identity confident; archive.org item id not recovered." },
  "3dgfx_jupiter_magnetosphere": { title: "Jupiter's Magnetosphere — The Movie", year: "1980s (est.)", license: "likely NASA/university viz — PD-if-gov; verify before redistribution", note: "Scientific field-line visualization. Title read from its own title card; archive.org item id not recovered." },
  "3dgfx_losalamos_sims_1975": { title: "Los Alamos computer simulations", year: "c.1975", license: "likely US-gov (LANL) PD; verify before redistribution", note: "Early 3D wireframe hydro/finite-element sim reel; card credits technical advisors J. Newell, R. Elliott, E. Pequette, R. Orr. Archive.org item id not recovered." },
  "anime_momotaro_shinpei": { title: "Momotaro: Umi no Shinpei (Momotaro's Divine Sea Warriors)", year: "1945", license: "public domain by age (Japan, dir. Mitsuyo Seo)", note: "First Japanese feature-length animated film. WWII-era production — cued windows deliberately avoid militaristic/flag/propaganda shots; burned-in English subtitles cropped off the bottom. Print carries burned-in subs throughout." },
};
// (anime_momotaro_umiwashi, 1943: DELETED 2026-07-04 at Paul's direction —
// explicit WWII air-raid propaganda + racial caricature, never cued. See the
// SOURCES.md tombstone; re-fetch from archive.org only if genuinely needed.)
const bySrc = {};
for (const r of rows) (bySrc[r.lib] ||= []).push(r);
const probe = f => { try {
  const o = JSON.parse(cp.execFileSync("ffprobe", ["-v","error","-select_streams","v:0",
    "-show_entries","stream=width,height,codec_name,r_frame_rate:format=duration",
    "-of","json", f]));
  const s = o.streams[0] || {};
  return { duration: +(+o.format.duration).toFixed(1), width: s.width, height: s.height,
           codec: s.codec_name, fps: s.r_frame_rate };
} catch (e) { return null; } };
const sources = Object.keys(PROV).map(lib => {
  const f = path.join(LIB, lib + ".mp4");
  return { file: lib + ".mp4", present: fs.existsSync(f),
           provenance: PROV[lib], probe: fs.existsSync(f) ? probe(f) : null,
           segments: (bySrc[lib] || []).map(r => ({
             clip: r.name + ".mp4", in: r.in, out: r.out,
             cropBottomFrac: r.crop, genres: r.genres, credit: r.credit })) };
});
const manifest = { _note: "Cue manifest for the found-video library (found/video/lib/). "
  + "Generated by ../../cut-lib-clips.sh. The video layer (video-layer.js) reads clips.json, "
  + "not this file; this is the crate-dig record + genre-affinity tags for the genre-kernel "
  + "GENRE_CLIPS pools. `genres` names are valid genre-kernel keys.",
  generated: new Date().toISOString().slice(0,10), sources };
const sj = path.join(LIB, "segments.json");
fs.writeFileSync(sj, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${sj} (${sources.filter(s=>s.segments.length).length} sources cued, `
  + `${rows.length} windows)`);
NODE
rm -f "$tmp"
echo "Done."

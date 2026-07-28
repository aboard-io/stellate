#!/usr/bin/env python3
# audio-verifier.py — the EMPIRICAL genre gate: does a rendered track actually
# sound like its genre, according to a model trained on real music?
#
# Uses Essentia's Discogs-EffNet embeddings + the genre_discogs400 head
# (400 Discogs styles, trained on real releases). The symbolic verifier
# (genre-verifier.js) checks the score; this checks the SOUND.
#
#   .venv-verify/bin/python audio-verifier.py track.mp3 [--expect jungle]
#   .venv-verify/bin/python audio-verifier.py track.mp3 --json
#
# Setup (one-time): python3 -m venv .venv-verify
#                   .venv-verify/bin/pip install essentia-tensorflow
#                   models/ downloaded from essentia.upf.edu (see CLAUDE.md)
# Exit code: 0 normally; 1 if --expect genre is not in the top 3 anchors.
import json, os, sys, warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)   # this script lives in tools/; models/ is at the repo root
EMB = os.path.join(ROOT, "models", "discogs-effnet-bs64-1.pb")
HEAD = os.path.join(ROOT, "models", "genre_discogs400-discogs-effnet-1.pb")
META = os.path.join(ROOT, "models", "genre_discogs400-discogs-effnet-1.json")

# Discogs styles -> our kernel anchors (max of mapped activations)
ANCHOR_MAP = {
    "techno":   ["Electronic---Techno", "Electronic---Minimal Techno", "Electronic---Deep Techno",
                 "Electronic---Hard Techno", "Electronic---Dub Techno"],
    "house":    ["Electronic---House", "Electronic---Deep House", "Electronic---Tech House",
                 "Electronic---Acid House", "Electronic---Garage House"],
    "jungle":   ["Electronic---Jungle", "Electronic---Drum n Bass", "Electronic---Breakbeat",
                 "Electronic---Breaks"],
    "triphop":  ["Electronic---Trip Hop", "Hip Hop---Trip Hop", "Electronic---Illbient"],
    "vaporwave":["Electronic---Vaporwave", "Electronic---Chillwave"],
    "synthwave":["Electronic---Synthwave", "Electronic---Italo-Disco"],
    "lofi":     ["Hip Hop---Instrumental", "Rock---Lo-Fi"],
    "downtempo":["Electronic---Downtempo", "Electronic---Chill-out", "Electronic---Future Jazz"],
    "ambient":  ["Electronic---Ambient", "Electronic---Dark Ambient", "Electronic---Drone",
                 "Electronic---New Age"],
    "transitwave":["Electronic---Synthwave", "Rock---Krautrock", "Electronic---Berlin-School",
                 "Electronic---Minimal", "Electronic---Electro", "Electronic---New Wave",
                 "Electronic---Leftfield"],
}

def analyze(path):
    from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D
    import numpy as np
    audio = MonoLoader(filename=path, sampleRate=16000, resampleQuality=4)()
    emb = TensorflowPredictEffnetDiscogs(graphFilename=EMB, output="PartitionedCall:1")(audio)
    acts = TensorflowPredict2D(graphFilename=HEAD,
        input="serving_default_model_Placeholder", output="PartitionedCall:0")(emb)
    mean = np.mean(acts, axis=0)
    classes = json.load(open(META))["classes"]
    byname = {c: float(mean[i]) for i, c in enumerate(classes)}
    anchors = {}
    for anchor, styles in ANCHOR_MAP.items():
        vals = [byname[s] for s in styles if s in byname]
        anchors[anchor] = round(max(vals), 4) if vals else 0.0
    top_styles = sorted(byname.items(), key=lambda kv: -kv[1])[:8]
    return anchors, top_styles

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    expect = sys.argv[sys.argv.index("--expect") + 1] if "--expect" in sys.argv else None
    as_json = "--json" in sys.argv
    if not args:
        print("usage: audio-verifier.py <audio file> [--expect genre] [--json]"); sys.exit(2)
    anchors, top = analyze(args[0])
    ranked = sorted(anchors.items(), key=lambda kv: -kv[1])
    if as_json:
        print(json.dumps({"anchors": dict(ranked), "top_styles": top}))
    else:
        print("anchor scores: " + "  ".join(f"{g}:{v:.3f}" for g, v in ranked[:5]))
        print("top styles:    " + "  ".join(f"{s.split('---')[-1]}:{v:.3f}" for s, v in top[:5]))
    if expect:
        rank = [g for g, _ in ranked].index(expect) + 1 if expect in anchors else 99
        print(f"expected {expect}: rank {rank} (score {anchors.get(expect, 0):.3f})")
        sys.exit(0 if rank <= 3 else 1)

if __name__ == "__main__":
    main()

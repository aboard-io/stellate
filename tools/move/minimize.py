#!/usr/bin/env python3
"""minimize.py — find which clips of a failing Song.abl Move rejects.

Reverts our clips to the template's (which Move accepts) for all but a candidate
subset, and binary-searches the subset that still fails.  Each step is one
tools/move/probe.sh call against the device.
"""
import json, copy, subprocess
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DONOR = os.path.join(HERE, "donor", "Song.abl")
PROBE = os.path.join(HERE, "probe.sh")
WORKROOT = os.path.join(HERE, "work")

BAD = sys.argv[1]
TPL = DONOR
WORK = os.path.join(WORKROOT, "min")
os.makedirs(WORK, exist_ok=True)
bad = json.load(open(BAD)); tpl = json.load(open(TPL))

def build(keep):
    """keep = set of (track, slot) clips taken from the failing Set; rest from template."""
    j = copy.deepcopy(tpl)
    for ti, t in enumerate(j["tracks"]):
        t["clipSlots"] = copy.deepcopy(tpl["tracks"][ti]["clipSlots"])
        for si, s in enumerate(t["clipSlots"]):
            if (ti, si) in keep:
                t["clipSlots"][si] = copy.deepcopy(bad["tracks"][ti]["clipSlots"][si])
            elif si > 0:
                s.pop("clip", None); s["clip"] = None
    return j

n = 0
def fails(keep, label):
    global n; n += 1
    p = f"{WORK}/m{n:03d}.abl"
    json.dump(build(keep), open(p, "w"))
    out = subprocess.run([PROBE, p, label], capture_output=True, text=True).stdout.strip()
    if out.startswith("????"):   # retry once on a flaky renderer
        out = subprocess.run([PROBE, p, label], capture_output=True, text=True).stdout.strip()
    print("   ", out, flush=True)
    return out.startswith("FAIL")

allclips = [(t, s) for t in range(4) for s in range(8)
            if bad["tracks"][t]["clipSlots"][s].get("clip")]
print(f"{len(allclips)} clips; confirming the whole set fails")
if not fails(set(allclips), "all"):
    print("the full clip set passes -- nothing to minimize"); sys.exit(0)

# which single track is enough to break it?
culprits = []
for t in range(4):
    sub = [c for c in allclips if c[0] == t]
    if sub and fails(set(sub), f"track{t}"):
        culprits.append(t)
print("tracks that fail on their own:", culprits or "none alone (interaction)")

# narrow to single clips within the first culprit track
target = [c for c in allclips if c[0] == culprits[0]] if culprits else allclips
singles = [c for c in target if fails({c}, f"t{c[0]}s{c[1]}")]
print("minimal failing clips:", singles)
json.dump({"singles": [list(c) for c in singles], "tracks": culprits}, open(f"{WORK}/result.json", "w"))

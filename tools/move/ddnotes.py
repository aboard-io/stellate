#!/usr/bin/env python3
"""ddnotes.py — delta-debug the notes of one clip down to a minimal set Move rejects.

  scripts/ddnotes.py <Song.abl> <track> <slot>

Puts the clip's notes (a subset at a time) into an otherwise-pristine template
Set and asks the device, via tools/move/probe.sh, whether it still fails.
"""
import json, copy, subprocess
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DONOR = os.path.join(HERE, "donor", "Song.abl")
PROBE = os.path.join(HERE, "probe.sh")
WORKROOT = os.path.join(HERE, "work")

SRC, TI, SI = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
os.makedirs(os.path.join(WORKROOT, "dd"), exist_ok=True)
src = json.load(open(SRC)); tpl = json.load(open(DONOR))
NOTES = src["tracks"][TI]["clipSlots"][SI]["clip"]["notes"]
REGION = src["tracks"][TI]["clipSlots"][SI]["clip"]["region"]

n = 0
cache = {}
def fails(idx):
    global n
    key = tuple(sorted(idx))
    if key in cache: return cache[key]
    n += 1
    j = copy.deepcopy(tpl)
    for t in j["tracks"]:
        for k, s in enumerate(t["clipSlots"]):
            if k > 0: s["clip"] = None
    c = j["tracks"][0]["clipSlots"][0]["clip"]
    c["region"] = copy.deepcopy(REGION)
    c["notes"] = [copy.deepcopy(NOTES[i]) for i in sorted(idx)]
    p = os.path.join(WORKROOT, "dd", f"d{n:03d}.abl")
    json.dump(j, open(p, "w"))
    out = subprocess.run([PROBE, p, f"{len(idx)} notes"], capture_output=True, text=True).stdout.strip()
    if out.startswith("????"):
        out = subprocess.run([PROBE, p, f"{len(idx)} notes"], capture_output=True, text=True).stdout.strip()
    r = out.startswith("FAIL")
    print(f"  [{n:3}] {'FAIL' if r else 'ok  '}  {len(idx):4} notes", flush=True)
    cache[key] = r
    return r

cur = list(range(len(NOTES)))
print(f"{len(cur)} notes in track{TI} slot{SI}")
if not fails(cur):
    print("this clip alone does not fail"); sys.exit(0)

# ddmin
gran = 2
while len(cur) > 1:
    chunks, size, i = [], len(cur) / gran, 0
    for g in range(gran):
        j2 = int(round((g + 1) * size)); chunks.append(cur[i:j2]); i = j2
    reduced = False
    for ch in chunks:                      # can we keep just one chunk?
        if ch and fails(ch): cur, gran, reduced = ch, 2, True; break
    if not reduced:
        for ch in chunks:                  # can we drop one chunk?
            rest = [x for x in cur if x not in set(ch)]
            if rest and fails(rest): cur, gran, reduced = rest, max(gran - 1, 2), True; break
    if not reduced:
        if gran >= len(cur): break
        gran = min(len(cur), gran * 2)

print("\nMINIMAL FAILING NOTE SET:")
for i in cur: print("  ", json.dumps(NOTES[i]))
print("region:", json.dumps(REGION))
json.dump({"notes": [NOTES[i] for i in cur], "region": REGION}, open(os.path.join(WORKROOT, "dd", "minimal.json"), "w"), indent=1)

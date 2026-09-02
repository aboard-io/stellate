#!/usr/bin/env python3
"""corpus.py — WHAT THE MIDI ARCHIVE SAYS ABOUT EACH GENRE ROW.

Called by tools/genre-qa/build.js; not usually run by hand.

    python3 tools/genre-qa/corpus.py --catalog scratch/genre-qa/catalog.jsonl \
        --corpus /mnt/sources/relocated/stellate-midi-corpus/corpus.db \
        --out scratch/genre-qa/corpus.jsonl

Reads corpus.db (120,652 parsed MIDI files, built by tools/mine/corpus-db.js)
with python3's stdlib sqlite3 — no better-sqlite3, no npm install.

METHOD, AND THE HONESTY RAILS
  1. ONE metadata scan of `files` (1 s for the whole table); the per-file
     feature JSON that tools/mine already computed rides along. Nothing here
     re-parses a .mid.
  2. MATCH. Each genre carries its own search terms and the STRATEGY that
     produced them (see build.js §4): `cited` is the row comment's own artist
     list, `rip` is one of the corpus's labelled directories, `word` is the
     genre key or the wiki title in a filename, `refused` is a key whose word
     means something else. A row's file set is capped at --cap files, sampled
     evenly across the matches so a 600-file Mario holding does not become a
     600-file decode.
  3. MEASURE. Tempo/meter/mode/swing/drum-density come off the metadata and
     tools/mine's feature vector. Everything else is decoded from the packed
     note blobs (11-byte records — tick, dur, pitch, vel, ch) in file-id order,
     which is sequential on disk and therefore fast.

WHAT IS AN ESTIMATE AND SAYS SO
  · NOTATION TEMPO IS A CONVENTION, not a truth — mine-midi.js's own caveat.
    Dub and reggae MIDI is written double-time; 2/4-notated ragtime reads half
    as fast as it feels. A bpm disagreement is a question, never a verdict.
  · CHORDS ARE ESTIMATED per bar from a bass-weighted pitch-class histogram
    against triad/seventh templates. The chord-cycle vote is the smallest
    period in {1,2,4,8} that explains the root sequence better than chance.
  · FORM is a SELF-SIMILARITY estimate: bars are fingerprinted by their onset
    mask and the reported section length is the lag that best repeats. It sees
    phrase length, not a chorus.
  · A PICKUP is counted as 1..3 melody onsets inside the beat before a
    downbeat, with the beat before THAT empty, resolving on a downbeat onset.
    That is an anacrusis by shape; the corpus carries no barline annotation
    beyond the time signature.
  · MELODY is corpus-db.js's extracted line, gated at mel_conf >= --min-conf.
    Files below the floor contribute drums and chords but no melodic number.
"""
import argparse, json, os, sqlite3, struct, sys
from collections import Counter, defaultdict

REC = 11
MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10]


def lane_for(p):
    """GM percussion -> the engine's drum lane names (tools/mine/mine-midi.js laneFor)."""
    if p in (35, 36): return "kick"
    if p in (38, 40): return "snare"
    if p == 37: return "rim"
    if p in (42, 44, 46): return "hat"
    if p in (41, 43, 45, 47, 48, 50): return "tom"
    if p in (49, 52, 55, 57): return "crash"
    if p in (51, 53, 59): return "ride"
    if p == 39: return "clap"
    return "perc"


def pct(xs, q):
    if not xs: return None
    s = sorted(xs)
    i = (len(s) - 1) * q
    lo, hi = int(i), min(int(i) + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (i - lo), 3)


def unpack(blob, ppq):
    out = []
    n = len(blob) // REC
    for o in range(0, n * REC, REC):
        tick, dur = struct.unpack_from("<II", blob, o)
        out.append((tick / ppq, dur / ppq, blob[o + 8], blob[o + 9], blob[o + 10]))
    return out   # (beat, durBeats, pitch, vel, ch)


# ---------------------------------------------------------------- chords
TEMPLATES = [
    ("triad", (0, 4, 7)), ("min", (0, 3, 7)), ("7", (0, 4, 7, 10)),
    ("maj7", (0, 4, 7, 11)), ("min7", (0, 3, 7, 10)), ("dim", (0, 3, 6)),
    ("sus4", (0, 5, 7)),
]


def bar_chords(notes, beats_per_bar):
    """one estimated (root, quality) per bar; bass-weighted pitch-class mass."""
    bars = defaultdict(lambda: [0.0] * 12)
    low = {}
    for beat, dur, pitch, vel, ch in notes:
        if ch == 9:
            continue
        b = int(beat // beats_per_bar)
        w = max(0.05, min(dur, beats_per_bar)) * (vel / 127.0)
        bars[b][pitch % 12] += w
        if b not in low or pitch < low[b]:
            low[b] = pitch
    out = []
    for b in sorted(bars):
        h = bars[b]
        if sum(h) <= 0:
            continue
        best, bestsc = None, -1
        for root in range(12):
            bonus = 1.25 if (b in low and low[b] % 12 == root) else 1.0
            for name, iv in TEMPLATES:
                sc = sum(h[(root + i) % 12] for i in iv) / (1 + 0.15 * len(iv)) * bonus
                if sc > bestsc:
                    bestsc, best = sc, (root, name)
        out.append(best)
    return out


def cycle_vote(roots):
    """the smallest period in {1,2,4,8} that explains the root sequence."""
    if len(roots) < 8:
        return None
    best, bestp = 0.0, None
    for p in (1, 2, 4, 8):
        hit = tot = 0
        for i in range(p, len(roots)):
            tot += 1
            if roots[i] == roots[i - p]:
                hit += 1
        if tot < 4:
            continue
        r = hit / tot
        # prefer the SHORTEST period that is clearly better; 0.04 is a margin,
        # not a threshold — a 4-bar cycle beats an 8-bar one at equal fit.
        if r > best + 0.04:
            best, bestp = r, p
    return bestp


def form_lag(bars):
    """the lag (in bars) whose bar fingerprints repeat best — a SECTION length.

    A bar's fingerprint is its set of (16th slot, pitch class) pairs, so two
    bars are 'the same bar' when the same notes land in the same places, and
    similarity is Jaccard. LAG 2 IS NOT OFFERED: a two-bar repeat is a riff,
    and every pop bar repeats at two — the first build of this measure voted 2
    for 108 of 131 genres, which is a measurement of nothing. The candidates
    start at 4 and the argmax wins, with a 0.03 margin toward the SHORTER lag
    so a 16-bar repeat that is really four fours reads as four."""
    n = len(bars)
    if n < 12:
        return None
    scores = {}
    for lag in (4, 8, 12, 16, 24, 32):
        if lag * 2 > n:
            break
        same = tot = 0.0
        for i in range(lag, n):
            a, b = bars[i], bars[i - lag]
            if not a and not b:
                continue
            tot += 1
            same += len(a & b) / max(1, len(a | b))
        if tot >= 4:
            scores[lag] = same / tot
    if not scores:
        return None
    top = max(scores.values())
    for lag in sorted(scores):
        if scores[lag] >= top - 0.03:
            return lag
    return None


def measure_file(ppq, tsig, notes_blob, mel_blob, mel_conf, min_conf):
    """everything the packed blobs can say about one file."""
    out = {}
    try:
        nn, dd = tsig.split("/") if tsig else ("4", "4")
        bpb = int(nn) * 4 / int(dd)
    except Exception:
        bpb = 4.0
    if bpb <= 0 or bpb > 16:
        bpb = 4.0
    notes = unpack(notes_blob, ppq) if notes_blob else []
    if not notes:
        return out

    # ---- drums: 16-slot histogram per lane over a 4-beat measure
    lanes = defaultdict(lambda: [0] * 16)
    ndrum = 0
    for beat, dur, pitch, vel, ch in notes:
        if ch != 9:
            continue
        ndrum += 1
        lanes[lane_for(pitch)][int(round((beat % 4) * 4)) % 16] += 1
    if ndrum:
        out["lanes"] = {k: v for k, v in lanes.items()}
        out["ndrum"] = ndrum

    # ---- chords + cycle
    ch_est = bar_chords(notes, bpb)
    if len(ch_est) >= 8:
        out["cycle"] = cycle_vote([r for r, _ in ch_est])
        out["qual"] = Counter(q for _, q in ch_est).most_common(1)[0][0]

    # ---- form: per-bar (slot, pitch class) fingerprints of the pitched notes
    seen = defaultdict(set)
    for beat, dur, pitch, vel, ch in notes:
        if ch == 9:
            continue
        b = int(beat // bpb)
        seen[b].add((int(round((beat % bpb) * 4)) % 16, pitch % 12))
    if seen:
        top = min(max(seen), 255)
        out["form"] = form_lag([seen.get(i, frozenset()) for i in range(top + 1)])

    # ---- melody: holds, intervals, syncopation, pickups
    mel = unpack(mel_blob, ppq) if (mel_blob and mel_conf is not None and mel_conf >= min_conf) else []
    if len(mel) >= 12:
        mel.sort()
        out["hold"] = [round(d * 4, 3) for _, d, _, _, _ in mel]          # in 16ths
        iv = [abs(mel[i + 1][2] - mel[i][2]) for i in range(len(mel) - 1)]
        out["iv_mean"] = round(sum(iv) / len(iv), 3)
        out["step_frac"] = round(sum(1 for x in iv if x <= 2) / len(iv), 3)
        off = sum(1 for b, *_ in mel if (int(round((b % 1) * 4)) % 4) not in (0, 2))
        out["sync"] = round(off / len(mel), 3)
        # pickups: 1..3 onsets in the beat before a downbeat, the beat before
        # that empty, and something landing ON the downbeat
        onsets = sorted(set(round(b, 3) for b, *_ in mel))
        downs = [b for b in onsets if abs(b % bpb) < 0.06]
        pk = 0
        for d in downs:
            run = [b for b in onsets if d - 1.0 <= b < d - 0.03]
            prev = [b for b in onsets if d - 2.0 <= b < d - 1.0]
            if 1 <= len(run) <= 3 and not prev:
                pk += 1
        if downs:
            out["pickup"] = round(pk / len(downs), 3)
    return out


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cap", type=int, default=140, help="files decoded per genre")
    ap.add_argument("--min-conf", type=float, default=0.55)
    a = ap.parse_args()

    genres = [json.loads(L) for L in open(a.catalog, encoding="utf8") if L.strip()]
    con = sqlite3.connect("file:%s?mode=ro" % a.corpus, uri=True)
    con.execute("PRAGMA mmap_size=1073741824")

    print("corpus: scanning file metadata…", flush=True)
    files = con.execute(
        "SELECT id, rip, path, ppq, bpm, tsig, key_mode, key_margin, total_beats, "
        "n_notes, mel_conf, feat FROM files").fetchall()
    print("corpus: %d files" % len(files), flush=True)
    lower = [(r[0], r[1], os.path.basename(r[2]).lower(), r) for r in files]
    by_rip = defaultdict(list)
    for fid, rip, base, r in lower:
        by_rip[rip].append((fid, base, r))

    # ---- match
    matched = {}
    for g in genres:
        strat = g["corpus_strategy"]
        terms = [t for t in (g["corpus_terms"] or "").split(" | ") if t]
        hits = []
        if strat == "rip":
            for t in terms:
                hits += [(fid, r, t) for fid, base, r in by_rip.get(t, [])]
        elif strat in ("cited", "word", "word+act", "act"):
            needles = [t.lower() for t in terms]
            for fid, rip, base, r in lower:
                for nd in needles:
                    if nd in base:
                        hits.append((fid, r, nd))
                        break
        seen, uniq = set(), []
        for fid, r, t in hits:
            if fid in seen:
                continue
            seen.add(fid)
            uniq.append((fid, r, t))
        matched[g["gk"]] = uniq

    # ---- the union to decode, evenly sampled per genre, in id order
    want = {}
    for gk, uniq in matched.items():
        if not uniq:
            continue
        if len(uniq) <= a.cap:
            take = uniq
        else:
            step = len(uniq) / a.cap
            take = [uniq[int(i * step)] for i in range(a.cap)]
        matched[gk] = take
        for fid, r, t in take:
            want[fid] = r
    print("corpus: %d distinct files to decode" % len(want), flush=True)

    per_file = {}
    ids = sorted(want)
    for n, fid in enumerate(ids):
        if n and n % 2000 == 0:
            print("   %d/%d" % (n, len(ids)), flush=True)
        r = want[fid]
        ppq = r[3] or 480
        nb = con.execute("SELECT blob FROM notes WHERE file_id=?", (fid,)).fetchone()
        mb = con.execute("SELECT blob FROM melody WHERE file_id=?", (fid,)).fetchone()
        try:
            per_file[fid] = measure_file(ppq, r[5], nb[0] if nb else None,
                                         mb[0] if mb else None, r[10], a.min_conf)
        except Exception as e:                       # a corrupt blob is one file, not the run
            per_file[fid] = {"err": str(e)[:120]}

    # ---- roll up per genre
    out = open(a.out, "w", encoding="utf8")
    for g in genres:
        gk = g["gk"]
        rows = matched.get(gk, [])
        rec = {"gk": gk, "strategy": g["corpus_strategy"], "n": len(rows),
               "refused_why": g.get("corpus_refused_why")}
        if not rows:
            out.write(json.dumps(rec) + "\n")
            continue
        bpms, meters, modes, swings, dd, holds, ivs, steps, syncs, pks = \
            [], Counter(), Counter(), [], [], [], [], [], [], []
        cycles, forms, quals = Counter(), Counter(), Counter()
        lanes = defaultdict(lambda: [0] * 16)
        rips = Counter()
        files_out = []
        for fid, r, term in rows:
            _, rip, path, ppq, bpm, tsig, key_mode, key_margin, tb, nn, mconf, feat = r
            rips[rip] += 1
            if bpm:
                bpms.append(bpm)
            if tsig:
                meters[tsig] += 1
            if key_mode:
                modes[key_mode] += 1
            try:
                f = json.loads(feat) if feat else {}
            except Exception:
                f = {}
            # EVERY file with the key, ZEROS INCLUDED. The first build kept
            # only truthy swing values and read trance at 1.04 — a triplet
            # feel on a four-on-the-floor record — because a straight file
            # measures 0 and dropping the zeros is dropping the straightness.
            if f.get("swing") is not None:
                swings.append(f["swing"])
            if f.get("drumDensity") is not None:
                dd.append(f["drumDensity"])
            m = per_file.get(fid, {})
            if m.get("hold"):
                holds += m["hold"]
            if m.get("iv_mean") is not None:
                ivs.append(m["iv_mean"])
                steps.append(m["step_frac"])
                syncs.append(m["sync"])
            if m.get("pickup") is not None:
                pks.append(m["pickup"])
            if m.get("cycle"):
                cycles[m["cycle"]] += 1
            if m.get("form"):
                forms[m["form"]] += 1
            if m.get("qual"):
                quals[m["qual"]] += 1
            for k, v in (m.get("lanes") or {}).items():
                for i in range(16):
                    lanes[k][i] += v[i]
            files_out.append({"file_id": fid, "path": path, "rip": rip, "bpm": bpm,
                              "tsig": tsig, "key_mode": key_mode, "term": term})
        rec.update({
            "rips": dict(rips),
            "bpm_p25": pct(bpms, .25), "bpm_med": pct(bpms, .5), "bpm_p75": pct(bpms, .75),
            "bpm_n": len(bpms),
            "meters": dict(meters.most_common(6)), "modes": dict(modes),
            "swing_med": pct(swings, .5), "swing_n": len(swings),
            "drum_density_med": pct(dd, .5),
            "hold_p50": pct(holds, .5), "hold_p90": pct(holds, .9), "hold_n": len(holds),
            "iv_mean": round(sum(ivs) / len(ivs), 3) if ivs else None,
            "step_frac": round(sum(steps) / len(steps), 3) if steps else None,
            "sync": round(sum(syncs) / len(syncs), 3) if syncs else None,
            "pickup": round(sum(pks) / len(pks), 3) if pks else None,
            "melodic_n": len(ivs),
            "cycle_vote": cycles.most_common(1)[0][0] if cycles else None,
            "cycle_tally": dict(cycles),
            "form_bars": forms.most_common(1)[0][0] if forms else None,
            "form_tally": dict(forms.most_common(5)),
            "chord_qual": quals.most_common(1)[0][0] if quals else None,
            "lanes": {k: v for k, v in lanes.items()},
            "files": files_out,
        })
        out.write(json.dumps(rec) + "\n")
    out.close()
    hit = sum(1 for g in genres if matched.get(g["gk"]))
    print("corpus: %d/%d genres matched at least one file -> %s" % (hit, len(genres), a.out))


if __name__ == "__main__":
    main()

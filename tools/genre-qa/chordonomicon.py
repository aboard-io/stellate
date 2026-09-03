#!/usr/bin/env python3
"""chordonomicon.py — 666,000 CHORD PROGRESSIONS, BESIDE OUR 417 ROWS.

    # fetch (off-repo, onto the corpus drive, like corpus.db)
    mkdir -p /mnt/sources/relocated/chordonomicon
    curl -sL -o /mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv \
      https://huggingface.co/datasets/ailsntua/Chordonomicon/resolve/main/chordonomicon_v2.csv

    # load + cross-walk (build.js does this for you when the CSV is there)
    python3 tools/genre-qa/chordonomicon.py --csv /mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv \
        --db scratch/genres.db

Chordonomicon (Kantarelis et al., arXiv:2410.22046; CC BY-NC 4.0) is a symbolic
chord dataset: one row per song, chords written as letter names inside section
tags, with Spotify's genre labels, an artist id and a release decade. It has no
audio and no melody — it is HARMONY AND LABELS, which is exactly the half of a
genre row our MIDI corpus is worst at and the half Paul asked about.

THE CSV IS 264 MB AND LIVES OFF-REPO, on the same drive as corpus.db and for
the same reason: found/ is rsynced to the droplet, so a multi-hundred-megabyte
derived artifact must never land in the tree.

WHAT IS DERIVED HERE, AND WHAT IS ESTIMATED
  · KEY IS ESTIMATED. The dataset ships no key. Each song's chord tones are
    histogrammed (root weight 1, third and fifth weight 0.5) and correlated
    against the Krumhansl-Schmuckler major and minor profiles; the winner is
    the tonic and the mode. It is right most of the time and wrong sometimes,
    and every roman numeral below inherits that.
  · ROMAN NUMERALS ARE TRANSPOSITION-NORMALISED against that estimate, so
    "C F G" in C and "G C D" in G are both `I IV V` and can be counted
    together. Case follows the CHORD's own quality, not the scale's.
  · THE MAIN SECTION is the first `<chorus_…>` block, or the first `<verse_…>`
    where a song has no chorus, or the whole song where it has neither.
  · A CYCLE is the main section's roman sequence with consecutive repeats
    collapsed, cut to four. Four is the catalogue's own unit (`prog` is four
    entries on 64 rows) and the comparison is only meaningful at one length.

TABLES WRITTEN (into scratch/genres.db, beside the mirror)
  chordonomicon        one row per song
  chordonomicon_genre  one row per (song, label) — the census is a GROUP BY
  genre_xwalk          one row per label: how many songs carry it, which of
                       our GENRES keys it maps to, and BY WHAT METHOD. A label
                       with no map keeps its row with gk NULL — the unmapped
                       list is the point, not the leftovers.
"""
import argparse, csv, json, math, os, re, sqlite3, sys
from collections import Counter, defaultdict

csv.field_size_limit(10 ** 8)

PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
# THE ACCIDENTAL IS `s` OR `b` IN THIS DATASET (no `#` appears in 666k rows:
# 142,545 `s` against 110,665 `b`) — SO `s` HAS TO STAY A SHARP, and the old
# regex ate the `s` of `sus` with it. The tell is the count: outside `sus`,
# `Es` and `Bs` never occur (E# and B# are enharmonic curiosities), while
# `Es|sus` occurs 2,007 times and `Bs|sus` 1,569 in the first 20k songs alone.
# So the accidental is consumed unless it is the `s` of `sus…`: `Dsus4` is a D,
# `Ds` and `Dsus`-less `Ds7` are a D#. 2026-09-03.
CHORD = re.compile(r"^([A-G])(?:(s)(?!us)|([fb#]))?(.*)$")
SECT = re.compile(r"^<([a-z]+)_?\d*>$")

ROMAN_MAJ = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"]
ROMAN_MIN = ["I", "bII", "II", "III", "#III", "IV", "bV", "V", "VI", "#VI", "VII", "#VII"]


def parse_chord(tok):
    """-> (pitch class, quality) or None. Slash bass is dropped: the bass note
    is a voicing, and a cycle counted with inversions is a different census."""
    tok = tok.split("/")[0]
    m = CHORD.match(tok)
    if not m:
        return None
    pc = PC[m.group(1)]
    if m.group(2):
        pc += 1
    elif m.group(3) in ("f", "b"):
        pc -= 1
    q = m.group(4)
    minor = q.startswith("min") or q.startswith("m") and not q.startswith("maj")
    dim = q.startswith("dim")
    # A SUS CHORD HAS NO THIRD, and saying it has a major one is how the key
    # estimator was told 19,552 lies per 20,000 songs. `sus` is its own kind:
    # roman case stays upper (it is not minor), and key_of adds root+fifth only.
    sus = "sus" in q and not minor and not dim
    kind = "dim" if dim else ("min" if minor else ("sus" if sus else "maj"))
    return (pc % 12, kind, q)


def key_of(chords):
    """Krumhansl-Schmuckler on the chord-tone histogram."""
    h = [0.0] * 12
    for pc, kind, _ in chords:
        h[pc] += 1.0
        fifth = 6 if kind == "dim" else 7
        h[(pc + fifth) % 12] += 0.5
        if kind != "sus":
            h[(pc + (3 if kind in ("min", "dim") else 4)) % 12] += 0.5
    tot = sum(h)
    if tot <= 0:
        return (0, "major")
    mean = tot / 12
    dev = [x - mean for x in h]
    den = math.sqrt(sum(d * d for d in dev)) or 1.0
    best, bestk = -2.0, (0, "major")
    for prof, name in ((KS_MAJ, "major"), (KS_MIN, "minor")):
        pm = sum(prof) / 12
        pdev = [x - pm for x in prof]
        pden = math.sqrt(sum(d * d for d in pdev)) or 1.0
        for t in range(12):
            r = sum(dev[(t + i) % 12] * pdev[i] for i in range(12)) / (den * pden)
            if r > best:
                best, bestk = r, (t, name)
    return bestk


def roman(pc, kind, tonic, mode):
    d = (pc - tonic) % 12
    r = (ROMAN_MAJ if mode == "major" else ROMAN_MIN)[d]
    if kind == "min":
        r = r.lower()
    elif kind == "dim":
        r = r.lower() + "o"
    return r


def main_section(tokens):
    """(section name, its chord tokens) — chorus, else verse, else all."""
    blocks, cur, name = [], [], None
    for t in tokens:
        m = SECT.match(t)
        if m:
            if cur:
                blocks.append((name, cur))
            name, cur = m.group(1), []
        else:
            cur.append(t)
    if cur:
        blocks.append((name, cur))
    for want in ("chorus", "verse"):
        for n, c in blocks:
            if n == want and len(c) >= 2:
                return (want, c)
    flat = [t for t in tokens if not t.startswith("<")]
    return ("all", flat)


SCHEMA = """
DROP TABLE IF EXISTS chordonomicon;
DROP TABLE IF EXISTS chordonomicon_genre;
DROP TABLE IF EXISTS genre_xwalk;
CREATE TABLE chordonomicon(
  song_id INT PRIMARY KEY, main_genre TEXT, rock_genre TEXT, labels TEXT,
  decade INT, year INT, key_root INT, key_mode TEXT, section TEXT,
  n_chords INT, chords_main TEXT, roman_main TEXT, roman_cycle TEXT);
CREATE TABLE chordonomicon_genre(song_id INT, label TEXT, kind TEXT);
CREATE TABLE genre_xwalk(label TEXT, kind TEXT, n_songs INT, gk TEXT,
                         method TEXT, note TEXT);
"""


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load(csv_path, con, limit=0):
    con.executescript(SCHEMA)
    ins = con.cursor()
    n = 0
    with open(csv_path, newline="", encoding="utf8") as f:
        for row in csv.DictReader(f):
            toks = (row.get("chords") or "").split()
            if not toks:
                continue
            sect, main = main_section(toks)
            parsed_all = [c for c in (parse_chord(t) for t in toks if not t.startswith("<")) if c]
            parsed = [c for c in (parse_chord(t) for t in main) if c]
            if len(parsed) < 2 or not parsed_all:
                continue
            tonic, mode = key_of(parsed_all)
            rm = [roman(pc, k, tonic, mode) for pc, k, _ in parsed]
            cyc = []
            for r in rm:
                if not cyc or cyc[-1] != r:
                    cyc.append(r)
            labels = re.findall(r"'([^']+)'", row.get("genres") or "")
            try:
                dec = int(float(row["decade"])) if row.get("decade") else None
            except ValueError:
                dec = None
            yr = None
            if row.get("release_date"):
                m = re.match(r"(\d{4})", row["release_date"])
                if m:
                    yr = int(m.group(1))
            sid = int(row["id"])
            ins.execute("INSERT OR REPLACE INTO chordonomicon VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (sid, row.get("main_genre") or None, row.get("rock_genre") or None,
                         " | ".join(labels) or None, dec, yr, tonic, mode, sect,
                         len(parsed_all), " ".join(main[:24])[:300],
                         " ".join(rm[:24])[:300], " ".join(cyc[:4])))
            seen = set()
            for L in labels:
                if L not in seen:
                    seen.add(L)
                    ins.execute("INSERT INTO chordonomicon_genre VALUES(?,?,?)", (sid, L, "sub"))
            for col, kind in (("main_genre", "main"), ("rock_genre", "rock")):
                v = row.get(col)
                if v and v not in seen:
                    seen.add(v)
                    ins.execute("INSERT INTO chordonomicon_genre VALUES(?,?,?)", (sid, v, kind))
            n += 1
            if n % 50000 == 0:
                con.commit()
                print("   %d songs" % n, flush=True)
            if limit and n >= limit:
                break
    con.commit()
    print("chordonomicon: %d songs loaded" % n)
    return n


def xwalk(con):
    """LABEL -> OUR KEY. Name first, then the decade, then nothing.

    The name pass is deliberately strict: normalised equality against the key,
    against the wiki title, and against the label with `music`/`music of`
    stripped. A near-miss is NOT a map — `alternative metal` is not our
    `metal` row and pretending it is would put 12,000 songs behind a chord
    census that describes a different music.

    The decade pass only ever CONFIRMS or REFUSES a name pass that already
    fired on a weaker form (all of our key's tokens present in their label);
    it never invents a mapping on a date alone, because two musics can share
    a decade and share nothing else."""
    ours = {}
    by_key, by_title = defaultdict(set), defaultdict(set)
    for gk, wiki, year, near in con.execute(
            "SELECT gk, wiki_title, year, near FROM genres"):
        title = norm((wiki or "").replace("_", " "))
        ours[gk] = {"gk": gk, "year": year, "near": near,
                    "names": {norm(gk)} | ({title} if title else set())}
        by_key[norm(gk)].add(gk)
        if title:
            by_title[title].add(gk)
    # THE KEY WINS OVER THE WIKI TITLE, and it has to: `confessionalpop`'s
    # article is "Country pop", which is also `countrypop`'s own key, so a
    # single flat index handed Spotify's `country pop` label to the wrong row.
    def by_name(nm):
        return by_key.get(nm) or by_title.get(nm) or set()

    rows = con.execute(
        "SELECT label, kind, COUNT(*) n FROM chordonomicon_genre "
        "GROUP BY label, kind ORDER BY n DESC").fetchall()
    out = []
    for label, kind, n in rows:
        nl = norm(label)
        alt = norm(re.sub(r"^music of |^music ", "", label.lower()))
        gks = by_name(nl) or by_name(alt)
        if gks:
            gk = sorted(gks)[0]
            out.append((label, kind, n, gk, "name", None))
            continue
        # weak form: every token of one of our keys' names is inside the label,
        # confirmed by the decade
        cand = []
        for gk, v in ours.items():
            if not v["year"] or v["year"] < 1900:
                continue
            for nm in v["names"]:
                if len(nm) >= 6 and nm in nl:
                    cand.append(gk)
                    break
        if len(cand) == 1:
            gk = cand[0]
            dec = con.execute(
                "SELECT c.decade FROM chordonomicon c JOIN chordonomicon_genre g "
                "ON g.song_id=c.song_id WHERE g.label=? AND c.decade IS NOT NULL "
                "GROUP BY c.decade ORDER BY COUNT(*) DESC LIMIT 1", (label,)).fetchone()
            yr = ours[gk]["year"]
            if dec and yr and abs(dec[0] - yr) <= 25:
                out.append((label, kind, n, gk, "token+decade",
                            "their modal decade %d vs our %d" % (dec[0], yr)))
                continue
            out.append((label, kind, n, None, None,
                        "token match on %s refused: their decade %s vs our %s"
                        % (gk, dec[0] if dec else "none", yr)))
            continue
        out.append((label, kind, n, None, None,
                    ("%d of our keys are inside this label" % len(cand)) if cand else None))
    con.executemany("INSERT INTO genre_xwalk VALUES(?,?,?,?,?,?)", out)
    con.commit()
    mapped = sum(1 for r in out if r[3])
    print("xwalk: %d labels, %d mapped to one of our keys" % (len(out), mapped))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    if not os.path.exists(a.csv):
        print("chordonomicon: no CSV at " + a.csv + " — skipping", file=sys.stderr)
        return 0
    con = sqlite3.connect(a.db)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    load(a.csv, con, a.limit)
    con.execute("CREATE INDEX IF NOT EXISTS cg_label ON chordonomicon_genre(label)")
    con.execute("CREATE INDEX IF NOT EXISTS cg_song ON chordonomicon_genre(song_id)")
    con.execute("CREATE INDEX IF NOT EXISTS xw_gk ON genre_xwalk(gk)")
    xwalk(con)
    con.commit()
    con.close()


if __name__ == "__main__":
    sys.exit(main() or 0)

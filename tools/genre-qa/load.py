#!/usr/bin/env python3
"""load.py — the JSON lines, into scratch/genres.db.

Called by tools/genre-qa/build.js; not usually run by hand.

    python3 tools/genre-qa/load.py --catalog scratch/genre-qa/catalog.jsonl \
        --corpus scratch/genre-qa/corpus.jsonl --db scratch/genres.db

SEVEN TABLES. The DB is DROPPED and rebuilt every run — it is a mirror, and a
mirror that accumulates is a second source of truth.

  genres        one row per GENRES key: the data half as columns, the composed
                record's summary, the atlas facts, the wiki row, the row's own
                comment, and `row_json` — EVERY field of the row including the
                four closures as their source text
  chairs        one row per seat in the composed record at seed 1, with its
                instrument id, its resolved Faust dsp where it has one, and its
                LANE (native / sampled / found / unknown)
  sections      the composed record's section roster: role, bars, period, level
  parents       declared parents with their weights, and `wants` as weightless
                rows of kind 'want'
  rules         nukernel/rules.js say(gk) — one sentence per editable field
  corpus_files  the corpus files matched to each genre and how they matched
  corpus_stats  one row per genre: what those files measure
  checks        written by report.js, not by this loader
"""
import argparse, json, sqlite3, os

SCHEMA = """
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS chairs;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS parents;
DROP TABLE IF EXISTS rules;
DROP TABLE IF EXISTS corpus_files;
DROP TABLE IF EXISTS corpus_stats;
DROP TABLE IF EXISTS checks;

CREATE TABLE genres(
  gk TEXT PRIMARY KEY,
  label TEXT, family TEXT, plan TEXT, bpm REAL, jitter REAL,
  voices INT, bars INT, rate REAL, harmony TEXT, near TEXT,
  artic TEXT, max_hold REAL, bass_style TEXT, swing REAL, drumkit TEXT,
  nobass INT, silent INT, instrumental INT, organic INT, diatonic INT, intro TEXT,
  prog_len INT, prog_quals TEXT, roots TEXT, fx TEXT, cannot TEXT,
  has_synth INT, synth_dsp TEXT,
  kit_lanes TEXT, kit_hits INT, kit_steps INT, kit_density REAL,
  words TEXT,
  comment TEXT, comment_lines INT,
  cited_n INT, cited_artists TEXT,
  place TEXT, year INT, year_word TEXT, era TEXT, region TEXT,
  wiki_title TEXT, wiki_kind TEXT, wiki_why TEXT, wiki_url TEXT, wiki_miss_why TEXT,
  doc_err TEXT, doc_bpm REAL, doc_meter TEXT, doc_swing REAL, doc_rate REAL,
  doc_mode TEXT, doc_scale TEXT, doc_harmony TEXT,
  doc_prog_len INT, doc_prog_quals TEXT, doc_prog_degs TEXT,
  doc_sections INT, doc_bars INT, doc_section_bars TEXT, doc_roles TEXT,
  doc_chairs INT, n_native INT, n_sampled INT, n_found INT, n_unknown INT,
  n_organic INT, dsps TEXT, rules_err TEXT,
  corpus_strategy TEXT, corpus_terms TEXT, corpus_refused_why TEXT,
  row_json TEXT
);
CREATE TABLE chairs(
  gk TEXT, idx INT, name TEXT, kind TEXT, part TEXT, reg INT, entry INT,
  style TEXT, instrument TEXT, lane TEXT, dsp TEXT, lane_why TEXT,
  organic INT, desk TEXT,
  PRIMARY KEY (gk, idx)
);
CREATE TABLE sections(
  gk TEXT, idx INT, id TEXT, role TEXT, bars INT, period TEXT, lvl TEXT, env TEXT,
  PRIMARY KEY (gk, idx)
);
CREATE TABLE parents(gk TEXT, parent TEXT, weight REAL, kind TEXT);
CREATE TABLE rules(gk TEXT, field TEXT, axis TEXT, head TEXT, declared INT,
                   tier TEXT, sentence TEXT, value TEXT);
CREATE TABLE corpus_files(gk TEXT, file_id INT, path TEXT, rip TEXT, bpm REAL,
                          tsig TEXT, key_mode TEXT, term TEXT);
CREATE TABLE corpus_stats(
  gk TEXT PRIMARY KEY, strategy TEXT, refused_why TEXT, n INT, rips TEXT,
  bpm_n INT, bpm_p25 REAL, bpm_med REAL, bpm_p75 REAL,
  meters TEXT, modes TEXT, swing_med REAL, swing_n INT, drum_density_med REAL,
  hold_p50 REAL, hold_p90 REAL, hold_n INT,
  iv_mean REAL, step_frac REAL, sync REAL, pickup REAL, melodic_n INT,
  cycle_vote INT, cycle_tally TEXT, form_bars INT, form_tally TEXT,
  chord_qual TEXT, lanes TEXT
);
CREATE TABLE checks(gk TEXT, name TEXT, score REAL, verdict TEXT, detail TEXT);

CREATE INDEX chairs_gk ON chairs(gk);
CREATE INDEX chairs_lane ON chairs(lane);
CREATE INDEX sections_gk ON sections(gk);
CREATE INDEX parents_gk ON parents(gk);
CREATE INDEX parents_p ON parents(parent);
CREATE INDEX rules_gk ON rules(gk);
CREATE INDEX cf_gk ON corpus_files(gk);
CREATE INDEX checks_gk ON checks(gk);
CREATE INDEX checks_name ON checks(name);
"""

GENRE_COLS = [
    "gk", "label", "family", "plan", "bpm", "jitter", "voices", "bars", "rate",
    "harmony", "near", "artic", "max_hold", "bass_style", "swing", "drumkit",
    "nobass", "silent", "instrumental", "organic", "diatonic", "intro", "prog_len",
    "prog_quals", "roots", "fx", "cannot", "has_synth", "synth_dsp",
    "kit_lanes", "kit_hits", "kit_steps", "kit_density", "words",
    "comment", "comment_lines", "cited_n", "cited_artists", "place", "year",
    "year_word", "era", "region", "wiki_title", "wiki_kind", "wiki_why",
    "wiki_url", "wiki_miss_why", "doc_err", "doc_bpm", "doc_meter", "doc_swing",
    "doc_rate", "doc_mode", "doc_scale", "doc_harmony", "doc_prog_len",
    "doc_prog_quals", "doc_prog_degs", "doc_sections", "doc_bars",
    "doc_section_bars", "doc_roles", "doc_chairs", "n_native", "n_sampled",
    "n_found", "n_unknown", "n_organic", "dsps", "rules_err",
    "corpus_strategy", "corpus_terms", "corpus_refused_why",
]

STAT_COLS = ["gk", "strategy", "refused_why", "n", "rips", "bpm_n", "bpm_p25",
             "bpm_med", "bpm_p75", "meters", "modes", "swing_med", "swing_n",
             "drum_density_med", "hold_p50", "hold_p90", "hold_n", "iv_mean",
             "step_frac", "sync", "pickup", "melodic_n", "cycle_vote",
             "cycle_tally", "form_bars", "form_tally", "chord_qual", "lanes"]
STAT_JSON = {"rips", "meters", "modes", "cycle_tally", "form_tally", "lanes"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--corpus", default="")
    ap.add_argument("--db", required=True)
    a = ap.parse_args()

    os.makedirs(os.path.dirname(a.db), exist_ok=True)
    con = sqlite3.connect(a.db)
    con.executescript(SCHEMA)

    ng = nch = nse = npa = nru = 0
    for line in open(a.catalog, encoding="utf8"):
        if not line.strip():
            continue
        g = json.loads(line)
        vals = [g.get(c) for c in GENRE_COLS] + [json.dumps(g["row"], sort_keys=True)]
        con.execute("INSERT INTO genres(%s,row_json) VALUES(%s)" %
                    (",".join(GENRE_COLS), ",".join("?" * (len(GENRE_COLS) + 1))), vals)
        ng += 1
        for c in g["chairs"]:
            con.execute("INSERT INTO chairs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [g["gk"], c["idx"], c["name"], c["kind"], c["part"], c["reg"],
                         c["entry"], c["style"], c["instrument"], c["lane"], c["dsp"],
                         c["lane_why"], c["organic"], c["desk"]])
            nch += 1
        for s in g["sections"]:
            con.execute("INSERT INTO sections VALUES(?,?,?,?,?,?,?,?)",
                        [g["gk"], s["idx"], s["id"], s["role"], s["bars"],
                         s["period"], s["lvl"], s["env"]])
            nse += 1
        for p in g["parents"]:
            con.execute("INSERT INTO parents VALUES(?,?,?,?)",
                        [g["gk"], p["parent"], p["weight"], p["kind"]])
            npa += 1
        for r in g["rules"]:
            con.execute("INSERT INTO rules VALUES(?,?,?,?,?,?,?,?)",
                        [g["gk"], r["field"], r["axis"], r["head"], r["declared"],
                         r["tier"], r["sentence"], r["value"]])
            nru += 1

    ncf = ncs = 0
    if a.corpus and os.path.exists(a.corpus):
        for line in open(a.corpus, encoding="utf8"):
            if not line.strip():
                continue
            c = json.loads(line)
            vals = []
            for col in STAT_COLS:
                v = c.get(col)
                vals.append(json.dumps(v, sort_keys=True) if col in STAT_JSON and v is not None else v)
            con.execute("INSERT INTO corpus_stats(%s) VALUES(%s)" %
                        (",".join(STAT_COLS), ",".join("?" * len(STAT_COLS))), vals)
            ncs += 1
            for f in c.get("files", []):
                con.execute("INSERT INTO corpus_files VALUES(?,?,?,?,?,?,?,?)",
                            [c["gk"], f["file_id"], f["path"], f["rip"], f["bpm"],
                             f["tsig"], f["key_mode"], f["term"]])
                ncf += 1
    con.commit()
    con.execute("VACUUM")
    con.close()
    print("load: %d genres · %d chairs · %d sections · %d parents · %d rules · "
          "%d corpus_files · %d corpus_stats" % (ng, nch, nse, npa, nru, ncf, ncs))


if __name__ == "__main__":
    main()

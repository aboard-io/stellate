#!/usr/bin/env python3
"""q.py — the one door between node and scratch/genres.db.

    python3 tools/genre-qa/q.py --db scratch/genres.db --sql "SELECT …"
    python3 tools/genre-qa/q.py --db scratch/genres.db --script FILE.sql
    python3 tools/genre-qa/q.py --db scratch/genres.db --checks FILE.jsonl

`--sql` / `--script` print ONE JSON array of row objects on stdout. `--checks`
replaces the `checks` table from a JSONL file of {gk,name,score,verdict,detail}.

report.js runs its checks THROUGH this — the questions are SQL against the
mirror, not a second walk of genres.js, which is the whole reason the mirror
exists.
"""
import argparse, json, sqlite3, sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--sql")
    ap.add_argument("--script")
    ap.add_argument("--checks")
    a = ap.parse_args()
    con = sqlite3.connect(a.db)
    con.row_factory = sqlite3.Row
    if a.checks:
        con.execute("DELETE FROM checks")
        rows = [json.loads(L) for L in open(a.checks, encoding="utf8") if L.strip()]
        con.executemany("INSERT INTO checks VALUES(?,?,?,?,?)",
                        [(r["gk"], r["name"], r.get("score"), r.get("verdict"),
                          r.get("detail")) for r in rows])
        con.commit()
        print(json.dumps({"inserted": len(rows)}))
        return
    sql = a.sql or open(a.script, encoding="utf8").read()
    try:
        cur = con.execute(sql)
    except sqlite3.Error as e:
        print(json.dumps({"__error": str(e)}), file=sys.stderr)
        sys.exit(3)
    json.dump([dict(r) for r in cur.fetchall()], sys.stdout)


if __name__ == "__main__":
    main()

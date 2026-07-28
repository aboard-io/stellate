# Security policy

STELLATE is a static, open-source, single-page instrument. There are no
accounts, no login, no database, and no cookies; nothing you do in the app is
stored server-side. The analytics beacon is self-hosted, cookie-free and
same-origin, and it reports the pathname only — the query string (seed, path,
duration, bar) is your musical location and never leaves the page
(`app/entries/analytics.js`).

That makes the attack surface small, but not empty. If you find something,
please tell us.

## How to report

- **Email `paul.ford@aboard.com`** — the preferred route for anything with an
  exploit path. Include what you did, what happened, and the URL or commit.
- **Open an issue** at <https://github.com/aboard-io/stellate/issues> if it is
  not sensitive (a missing header, a dependency advisory, a hardening idea).

The machine-readable version of this contact lives at
[`/.well-known/security.txt`](.well-known/security.txt) (RFC 9116) and must
stay in step with this file.

## What to expect

This is a one-person project, not a staffed security team, so the promises are
deliberately small and real:

- an acknowledgement of your report, usually within a week;
- a plain answer about whether it is a bug we will fix, a known trade-off, or
  out of scope;
- credit in [the colophon](https://stellate.app/colophon.html) if you want it.

There is no bounty program, and no fixed remediation clock — inventing one
would be inventing a promise the project cannot honour. Please give us a
reasonable chance to ship a fix before publishing; the whole codebase is
public, so a fix and its disclosure are the same commit.

## In scope

- The served site: `index.html`, the app modules under `app/`, the engine and
  its WASM voices under `engine/`, the service worker (`sw.js`).
- Third-party code vendored into the repo under `vendor/` — report an upstream
  advisory that reaches the served app, and we will pull the fix.
- The repo's own tooling: the fetch recipes, the gates, the deploy script —
  anything that would let a contributed PR execute code somewhere it shouldn't.
- Hosting configuration reachable from the public site (headers, redirects,
  the same-origin analytics proxy — see `docs/HOSTING.md`).

## Out of scope

- **Media licensing.** The audio under `found/` is fetched, not authored, and
  carries third-party licences; the ledger is `SOURCES.md`. A licensing
  concern is a real issue — mail the same address — but it is not a
  vulnerability report and it is not handled here.
- **Loud output, CPU load, or a browser tab that stutters.** This is a live
  audio engine; performance and mix complaints belong in an ordinary issue.
- Findings against third-party services this project merely links to.
- Reports produced by a scanner with no demonstrated impact on this site.

## Fixes

Security fixes follow the same contract as every other change
(`CONTRIBUTING.md`): one subject, gates green, and no media committed. If a
fix must land before a full gate run, say so in the PR and the reasoning goes
in the commit message.

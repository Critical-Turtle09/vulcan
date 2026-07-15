# VULCAN — NIGHT SHIFT 4 · MORNING REPORT

> DEEP FOUNDATIONS · 2026-07-14 → 07-15 · unattended · one push at the end (authorized).
> Nothing sent, nothing deployed, bonsai repos untouched, night3-bak preserved, spend within governor.

## TL;DR

Foundations, not features. VULCAN now has a **real automated test battery** (`npm test`,
81 tests, hermetic, loud failures) guarding the router, the write gate, the vault writer,
every skill's contract, and offline fail-soft. The vitals **sparklines now render from a
vault-persisted daily metrics history** instead of any fabricated series. HERMES drafted the
**full pilot outreach cadence** + a district one-pager + a teacher FAQ (all HELD). The **real
weekly-review + vault-clean skills** ran over the campaign week and filed their artifacts. And
there's now a single plain-English **STATE OF VULCAN** doc a stranger could read to understand
the whole machine.

## Task table

| Task | What | Verdict | Commit |
|---|---|---|---|
| 0 | Regression test battery — router · skills · vault · fail-soft, one `npm test` | ✅ 81/81 green, ~2.7s, hermetic | `T1` |
| 1 | Metrics history — daily snapshots to the vault, honest sparklines | ✅ Verified e2e (14 days seeded from git) | `P4` |
| 2 | Outreach sequence pack — cadence + district one-pager + teacher FAQ (held) | ✅ Filed, nothing sent | `I6` |
| 3 | Real WK REVIEW over the campaign week + VAULT CLEAN | ✅ 37 commits / 9 days rolled up; index refreshed | `I7` |
| 4 | STATE OF VULCAN + this report | ✅ This doc | `N4` |

## What shipped

### The test battery (T1)
`npm test` runs a real `node --test` suite — **76 core + 5 metrics = 81 tests**, ~2.7s, with
**loud (non-zero-exit) failures**. It's hermetic: no network, no spend, no touch to the real
vault or ledger.
- **router** — the full deterministic routing table pinned, crew-vs-mission priority,
  non-commands fall through to synthesis, and the write gate (only `repo.tag` is
  WRITE_CONFIRM; no deck phrase silently escalates to a machine-leaving write).
- **constitution** — READ free+silent, WRITE announces-then-runs, WRITE_CONFIRM runs only on
  explicit confirm (cancel/timeout abort), AWAY queues everything.
- **vault** — writeArtifact / writeDailyDoc / daily trace, and safePath rejects `..` / absolute
  / symlink escapes; waitlist + console state round-trip.
- **skills** — every action's class + run is well-formed; the offline-safe local reads honor
  the `{title, lines, speak}` panel contract.
- **fail-soft** — a keyless brain banks to REFLEX without throwing or spending, a SKILL still
  runs offline, the client banks NO_KEY, and the governor refuses an over-$2 call.
- Two guarded test seams added (harmless in production): `VULCAN_DISABLE_ENV=1` (keyless brain)
  and `VULCAN_VAULT_PATH` (throwaway vault).

### Honest sparklines (P4)
A **daily metrics snapshot** — `{ commits, spendUsd, waitlist, deploy }` — is now captured on
**boot and at midnight** (plus a light 10-min refresh) and persisted to the vault
(`state/metrics.json`). The commits + spend cards render their **sparklines from this real
multi-day history**. Past days backfill commits-per-day from actual git history; spend,
waitlist, and deploy are genuinely unknown before tracking, so they persist as `null` and
render as an honest zero baseline — never a fabricated trend. **Verified under CDP:** the boot
snapshot persisted 14 days seeded from git and both cards painted 14-point polylines.

### Outreach sequence pack (I6)
HERMES filed three HELD drafts to the vault (repo copies under `docs/outreach/`):
- **OUTREACH-SEQUENCE-PACK.md** — a timed 3-touch cadence to one recipient (Day 1 intro / Day 4
  follow-up / Day 10 close) with a "how to run it" note (fill brackets, send yourself, space
  ~3-4 business days, stop on any reply).
- **DISTRICT-ONE-PAGER.md** — a one-page, print-to-PDF-ready district leave-behind.
- **TEACHER-FAQ.md** — 11 plain Q&A pairs; honestly flags no formal compliance cert and marks
  not-yet-built items "planned".
No stats, pricing, or testimonials invented; no contacts sourced; nothing sent.

### Real week in review + vault tidy (I7)
Ran the actual skills over the campaign week (headless, same dispatch path the app uses):
- **WK REVIEW** — 37 commits across 9 active days, the real commit list (N2→I6), 8 recent vault
  artifacts, objectives reviewed. Filed to the vault; repo record at
  `docs/WEEK-IN-REVIEW-2026-07-15.md`.
- **VAULT CLEAN** — re-indexed `VULCAN/BONSAI/index.md` (23 outputs · 6 daily · 1 wiki · 0 raw);
  the front door + operator prose preserved, only the auto-section refreshed.

### State of VULCAN (N4)
`VULCAN/BONSAI/wiki/STATE-OF-VULCAN.md` (repo mirror `docs/STATE-OF-VULCAN.md`) — the single
plain-English document covering everything that exists, every law, the brain, the hands, the
crew, the vault, honest data, the test battery, what's deferred, and every open item.

## Awaiting operator

- **Repack to carry P4 to the installed app.** The metrics sparklines are in source + verified
  in dev, but reach `/Applications/VULCAN.app` only after `npm run pack` + reinstall (an
  operator-present step). Deferring costs nothing — the history seeds from git on the first
  P4-build boot. (P3 waitlist honesty is already live on the installed app from Night Shift 3.)
- **`/Applications/VULCAN.app.night3-bak`** left in place as instructed (not deleted).
- **Set the real waitlist number**, **set a Vercel token**, **keep `ollama serve` running**,
  and **send the outreach** when ready — all as before.
- **Bonsai email / bank** — still unknown to VULCAN; an operator task.

## Housekeeping

- The real WK REVIEW + VAULT CLEAN artifacts, today's daily trail, and `state/metrics.json` are
  **real deliverables** and were kept (not test residue). All T1 test runs were hermetic
  (temp vaults) and left the real vault untouched.
- New in-tree: `brain/metrics.js`, `electron/metrics-main.js`, `test/*.test.mjs` (6 files),
  and the `scripts/verify-metrics-night4.mjs` / `run-wkreview-night4.mjs` harnesses.
- `FLUIDITY-AUDIT-v2.md` left untouched (pre-existing, not mine).
- Spend within governor — the shift used no metered Claude calls of its own (skills ran local;
  the crew ran on Claude Code, not VULCAN's wallet).

*Filed by VULCAN · Night Shift 4 · the foundations are poured and tested.*

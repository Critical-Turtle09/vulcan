# Bonsai Morning Herald — CONTRACT (DRAFT · UNSIGNED)

**Proposal for the operator's review.** A companion to the Night Watchman: where the Watchman
wakes me only when something breaks, the Herald simply hands me a short start-of-day brief every
morning at **08:00** — one email, scannable in ten seconds, so I begin the day already oriented.

> **STATUS: UNSIGNED / INERT.** This contract does nothing. The generic runner refuses any
> unsigned contract, so `morning-herald.json` will not execute, compose, or send until the
> operator signs it (`node contracts/sign.mjs morning-herald`). This file is a proposal
> artifact, not an armed job. Leaving it here lets the operator read the charter and decide.

## What the Herald would send (one email, 08:00 daily)

- **Overnight watchman verdict** — PASS/FAIL per check and the last run time, read from the
  Watchman's own report (`logs/night-watchman-report.json`). Green most mornings; the one place
  a silent overnight failure would surface even if the alert cap was already spent.
- **Vitals snapshot** — Claude spend vs the $2 cap, GitHub commits this week, the Vercel deploy
  state, and the waitlist figure. One honest line each (a dash where a source isn't wired).
- **Wire highlights** — the top three headlines from the Bonsai wire feed.
- **Open directives** — the still-unchecked items from the console state.

## The same fences as the Watchman (egress law)

- **Sole recipient**, hard-scoped in code to **vishnumovva@icloud.com** — the mailer cannot
  address anyone else.
- **At most one send / 24h**, every attempt logged.
- **Signed-or-inert**: editing this contract's JSON breaks the signature; the runner refuses it
  until re-signed. Arming is always a deliberate, signed act.

## What arming requires (for the operator, when ready)

1. **Sign it:** `node contracts/sign.mjs morning-herald` (review this charter first).
2. **Build the herald composer:** the current runner is alert-shaped (run checks → mail on
   failure). The Herald is digest-shaped (compose the four sections above → send once at 08:00).
   That composer step is **not yet built** — signing approves the *contract*; a follow-up wires
   the digest builder into the runner behind the signature gate.
3. **Add an 08:00 LaunchAgent** (mirror `contracts/com.siliconforge.vulcan.night-watchman.plist`
   at `Hour 8`).
4. **Resolve the shared rate key:** the mailer's 1-send/24h cap is currently global across
   contracts, so an armed Herald and a Watchman alert on the same day would contend. The
   `mailer.rateKey` field above is the intended fix (per-contract rate state) and must be honored
   in the mailer before both run armed.

## SIGNATURE

This contract is intentionally UNSIGNED. There is no valid signature line below, so
`contracts/lib.js verify()` returns `signed: false` and the runner refuses to execute it.

```
contract: morning-herald.json
mode: log-only
signer: (none — awaiting operator signature)
signature: (none — run `node contracts/sign.mjs morning-herald` to sign)
```

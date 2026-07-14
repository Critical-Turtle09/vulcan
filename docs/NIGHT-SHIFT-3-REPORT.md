# VULCAN — NIGHT SHIFT 3 · MORNING REPORT

> POLISH THE ROAD RIG · 2026-07-13 → 07-14 · unattended · one push at the end (authorized).
> Nothing sent, nothing deployed, bonsai repos untouched, spend within governor.

## TL;DR

The road rig is **polished and the installed app is whole.** Full Disk Access is
effective — I **PROVED the packaged `/Applications/VULCAN.app` files an artifact into the
iCloud vault** (a real MISSION BRIEF landed on disk, then I cleaned it up), and proved it
**again after the reinstall**. The dishonest hardcoded waitlist number (`312`) is gone,
replaced with an **honest manual-entry workspace** — vault-persisted, `MANUAL · <date>`
stamped. The outreach drafts now point at the **live site**. The appliance was **repacked
and reinstalled** so the travel machine actually carries tonight's fixes, QA'd GREEN as both
a release build and as the installed app.

## Task table

| Task | What | Verdict | Commit |
|---|---|---|---|
| 0 | Verify packaged launch clean post-FDA · remove the night2 backup | ✅ GREEN · hooks live, wire 4 feeds, glyph, 0 errors; `night2-bak` removed | `Q3` |
| 1 | WAITLIST honesty — manual-entry workspace + honest default + source memo | ✅ GREEN · verified end-to-end (dev + release build) | `P3` |
| 2 | OUTREACH v2 — 4 emails + teacher blurb referencing the live site (held) | ✅ Filed · nothing sent | `I5` |
| + | THE PROOF — packaged app vault filing PROVEN (MISSION BRIEF filed + cleaned) | ✅ GREEN · FDA effective, survives reinstall | — |
| + | Appliance repacked + reinstalled with P3, QA'd (release + installed) | ✅ GREEN · old app backed up | — |
| 3 | Operator-guide update + this report + one push | ✅ This doc | `N3` |

## What shipped

### The installed app is whole — FDA proven
Ran one real `MISSION BRIEF` through the installed `/Applications/VULCAN.app` under CDP: it
filed `20260714-…-mission-brief.md` into `VULCAN/BONSAI/outputs/` **on disk**, then the
harness removed the test artifact. Vault filing works → **Full Disk Access is effective.**
Confirmed a second time on the freshly reinstalled binary — **the grant survived the
reinstall.** This is the moment the installed app became whole.

### WAITLIST honesty (P3)
- **Was:** a hardcoded fake `312` + a fake trend spark — an unsourced number presented as real.
- **Now:** the card reads an honest **`— / NO SOURCE`** until you enter a real figure. Click
  the WAITLIST card → type the count (+ an optional note) → **SAVE FIGURE**. The card then
  reads **`<n> · MANUAL · <date>`** so a hand figure is never mistaken for a live feed. It's
  saved to the vault (`state/waitlist.json`, inside the B3 containment) and **survives
  restarts**. **CLEAR** restores the honest default. The date is stamped from your **visible
  clock** (renderer-local; never a UTC off-by-one), validated main-side.
- **HERMES** filed a 3-option **live-source memo** (Google Form/Sheet export · webhook→local
  JSON · self-hosted endpoint) for when you want it live — `WAITLIST-LIVE-SOURCE-OPTIONS.md`.
- **Verified end-to-end under CDP:** honest default → save → card + vault reflect the figure →
  survives relaunch → clear restores default. Green in dev **and** in the packed release build.

### OUTREACH v2 (I5)
All four pilot emails (librarian · English head · charter director · follow-up) now weave in a
natural **"take a 2-minute look at bonsaicitations.vercel.app"** nudge — voice and ~150-word
length unchanged — plus a new **paste-ready teacher blurb** for staff newsletters / PTA notes /
Google Classroom. **HELD drafts only** — nothing sent, no addresses, `[brackets]` preserved.
Filed to the vault (`OUTREACH-v2-LIVE-SITE.md`); repo copy at `docs/outreach/`.

### The appliance was repacked + reinstalled
P3 lives in source, and the road machine runs a **bundled** copy — so I carried it across:
- `npm run pack` (GREEN) → **QA'd the release build** (waitlist workspace present, save + card
  + vault all correct) → **backed up the old app** → installed over `/Applications/VULCAN.app`
  → **smoke-tested the installed app GREEN** (clean launch, vault filing proven, honest
  `— / NO SOURCE` waitlist card).
- The previous appliance is preserved at **`/Applications/VULCAN.app.night3-bak`** — a safety
  net; delete it once you're happy.

### Guide updated (N3)
`docs/OPERATOR-GUIDE.md` gained: a **Full Disk Access** section (grant-once, click-by-click),
the **waitlist manual-entry** how-to, and the **installed-appliance** truth (menu-bar resident,
no Dock icon, repack-to-refresh). Synced to the vault wiki copy.

## Awaiting operator

- **Set the real waitlist number** — click the WAITLIST card and enter it; it'll read
  `MANUAL · <date>`. Until then it honestly shows `— / NO SOURCE`.
- **Pick a live waitlist source when ready** — three options are written up in
  `VULCAN/BONSAI/outputs/WAITLIST-LIVE-SOURCE-OPTIONS.md`.
- **Delete `/Applications/VULCAN.app.night3-bak`** once you've confirmed the reinstalled app is good.
- **Keep `ollama serve` running** on the travel machine — the offline local brain.
- **Send the outreach when you're ready** — the v2 drafts are held; fill the `[brackets]`, confirm
  the recipient, send from your own client.
- **Bonsai email / bank account:** logged as **OPEN / unconfirmed** — VULCAN has no signal either
  way and cannot create or verify it. That one's yours; say the word if you want HERMES to draft
  anything around it.

## Housekeeping

- **Every test artifact removed.** The two prove-filing MISSION BRIEFs and today's test daily
  file were deleted; `waitlist.json` is left at `null` (no test number on your card). The vault
  holds only real deliverables.
- **New in-tree harnesses:** `scripts/verify-launch-night3.mjs`, `verify-waitlist-night3.mjs`,
  `shot-waitlist-night3.mjs`, `prove-filing-night3.mjs`, `release-qa-night3.mjs`.
- **`FLUIDITY-AUDIT-v2.md`** left untouched (pre-existing, not mine).
- **Spend within governor** — a couple of metered MISSION BRIEF dispatches for the filing proof.
- **Note (pre-existing, out of scope):** the installed app reads `GH COMMITS /WK` as `0` — the
  packaged bundle isn't a git checkout, so its git read is empty. Honest (no fake), not a
  regression; flag for a later slice if you want live commit velocity on the appliance.

*Filed by VULCAN · Night Shift 3 · the rig is polished and the app is whole.*

# VULCAN — NIGHT SHIFT 2 · MORNING REPORT

> HARDEN FOR THE ROAD · 2026-07-12 · unattended · one push at the end (authorized).
> Nothing sent, nothing deployed, bonsai repo untouched, spend within governor.

## TL;DR

The road appliance is **hardened and reinstalled.** Full packaged QA came back **GREEN** — every organ works. Offline fail-soft **holds**, and two black-hole-network hang gaps were found and fixed. A build bug that was silently failing every repack was fixed, which let me **repack + reinstall `/Applications/VULCAN.app`** so the travel machine actually carries tonight's fixes. Pipeline thinking-docs for the trip are drafted. The spec now matches the shipped machine.

## Task table

| Task | What | Verdict | Commit |
|---|---|---|---|
| 0 | Packaged QA — full organ regression on `/Applications/VULCAN.app` | ✅ GREEN · 10/10 deck commands filed, persistence survives relaunch, no structural breaks | `Q1` |
| 1 | Offline mode — fail-soft verified end-to-end | ✅ HOLDS · 2 hang gaps fixed | `Q2` |
| 2 | Pipeline seeding — HERMES target criteria + shortlist (drafts, held) | ✅ Filed, nothing sent | `I4` |
| 3 | Truth pass — spec addendum so CLAUDE.md matches reality | ✅ Appended, no history edits | `D1` |
| 4 | Morning report + one push | ✅ This doc | `N2` |
| + | Build fix — repack was silently failing (malformed plist) → **appliance repacked & reinstalled** | ✅ Verified GREEN | `P1.3` |

## Fixes made (all in source; all verified)

1. **`brain/client.js` — hard timeout on the Anthropic brain.** Every `ask()` (router + synth) is now bounded by an `AbortController` (15 s), forwards external aborts, and banks a distinct `TIMEOUT`. Before: a captive-portal / black-hole network could hang a dispatch **forever**. After: it degrades to the local Ollama reflex and speaks. *(Q2)*
2. **`brain/voice.js` — hard timeout on cloud TTS.** ElevenLabs bounded at 8 s so the mouth fails over to the local Kokoro → `say` chain fast. VULCAN always speaks. *(Q2)*
3. **`src/stage/manual.js` — tour reopen race.** `close()` hid behind a fixed 240 ms timer a rapid reopen couldn't cancel; the pending hide is now stored and cancelled by `open()`. *(Q1)*
4. **`build/Info.plist` — malformed XML comment broke every repack.** A literal `--` inside the comment made xmldom throw during packaging, so the pack aborted **without merging LSUIElement and without producing an app**. Reworded; `npm run pack` now completes. This is what had been blocking the appliance from carrying new fixes. *(P1.3)*

## Offline verdict (Q2)

**Never silent, never hung, never crashed.**

- **Wifi off (fetch rejects):** synth questions fall to the **local Ollama reflex and answer aloud**; `DEPLOY CHECK` → "not connected", `WIRE SCAN` → "wire offline, no feeds reachable", `MISSION BRIEF` → local degraded brief. Every one **spoken + honest + filed** to the vault. No fabricated numbers.
- **Captive portal (fetch hangs):** the two unbounded fetches were the only wedge risk. Now bounded — `ask()` banks `TIMEOUT`, mission brief resolves in ~23 s to a local spoken brief instead of hanging.
- **Local chain confirmed present:** `llama3.2:1b` (Ollama) + Kokoro both installed and reachable.

Full detail: `NIGHT-SHIFT-2-OFFLINE-VERDICT.md`. QA detail: `NIGHT-SHIFT-2-QA-REPORT.md`.

## The appliance was repacked and reinstalled

Because the fixes above live in source and the road machine runs a **bundled** copy, I repacked and reinstalled so the travel appliance actually carries them:

- Built web bundle → `npm run pack` (now that P1.3 unblocked it) → **QA'd the `release/` build GREEN** → backed up the old app → installed the new one → **smoke-tested the installed `/Applications/VULCAN.app` GREEN** (ignite, glyph, tour both directions, a real filed dispatch).
- The previous appliance is preserved at **`/Applications/VULCAN.app.night2-bak`** (a safety net — delete it once you're happy).
- The installed brain carries the 15 s timeout (verified); the manual fix rides in the QA'd dist bundle.

## Awaiting operator

- **Keep `ollama serve` running on the travel machine.** The offline spoken answer depends on the local reflex. `llama3.2:1b` is installed; without Ollama, VULCAN still speaks — but only to say it has no local model.
- **Delete `/Applications/VULCAN.app.night2-bak`** once you've confirmed the reinstalled app is good (it's just the pre-tonight backup).
- **WAITLIST is still a labelled placeholder** — there is no live signup source wired. Point a real feed (form export / DB / manual value) at it when you have one; VULCAN will not present an unsourced number as real.
- **Vercel deploy reads "not connected"** — no `VULCAN_VERCEL_TOKEN` is set. Set it via the VERCEL workspace (writes locally, announced) to light up the deploy eye.
- **Pipeline is empty by design** — the trip drafts (`PITCH-TARGET-CRITERIA.md`, `CANDIDATE-SHORTLIST-TEMPLATE.md`) are thinking documents; fill the shortlist and promote rows into `VULCAN/Pipeline.md` to feed the PITCH DESK. No targets were invented, no contact info gathered, nothing sent.

## Housekeeping

- All QA/offline test runs filed real dispatch artifacts to the vault; **every test artifact was removed afterward** — the vault holds only real deliverables + the four Night-Shift-2 docs. The DIRECTIVES console was written during a persistence test and **restored** to its seed state.
- Regression harnesses kept in-tree: `scripts/qa-packaged-night2.mjs`, `scripts/verify-offline-night2.mjs`.
- One pre-existing modified file (`FLUIDITY-AUDIT-v2.md`) was left untouched — it wasn't mine and predates this shift.

*Filed by VULCAN · Night Shift 2 · the forge held through the night.*

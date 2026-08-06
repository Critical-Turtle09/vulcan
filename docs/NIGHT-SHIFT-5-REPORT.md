# NIGHT SHIFT 5 — THE VOICE AND THE WATCHMAN

**Date:** 2026-08-05 (overnight) · **Operator:** vishnumovva@icloud.com
**Mode:** unattended · one push at end · Bonsai repos untouched · spend within governor
**Egress this shift:** none sent. The only egress path (the Night Watchman mailer) ran
**LOG-ONLY** — it wrote what it *would* send and sent nothing (no SMTP credential yet).

---

## Task table

| Task | What shipped | Commit |
|---|---|---|
| **A · P5 THE VOICE PASS** | One global speech channel (new utterance cancels current — fixes tour overlap); universal STOP (contextual Esc + visible ■ on chips and the AUDIO panel); speech sanitizer; `voice-register.json` (E.V. register) applied to all fixed spoken strings; situational lines (attentive-only, 1/5min, dormant→transcript). +17 tests. | `0233667` |
| **B · C1 THE NIGHT WATCHMAN** | Signature-gated contract system (`contracts/`); generic runner executes only signed contracts; hard-scoped mailer (1/24h, every attempt logged); read-only checks; 03:00 LaunchAgent armed **log-only**; one full cycle run now (ALL CLEAR). +8 tests. | `c64d4cc` |
| **C · MORNING FINISH + report** | This document (morning 3-step, pre-flight decisions, P5 results) + the single end-of-shift push. | this commit |

Full battery after the shift: **106 tests green.** Renderer builds; zero console errors on the driven stage.

---

## ☀️ MORNING FINISH — 3 steps to arm the Watchman (do these when you wake)

The Night Watchman is armed at 03:00 but **log-only** — it will never email until you give it
an app-specific password and flip it on. Three steps:

### 1 · Generate the Apple app-specific password
- Go to **appleid.apple.com** → sign in → **Sign-In and Security** → **App-Specific Passwords**.
- Click **+ / Generate**, name it exactly **`vulcan-hermes`**, and copy the 16-character
  password (format `xxxx-xxxx-xxxx-xxxx`).

### 2 · Paste it into the session (`.env`, never committed)
Add these two lines to `/Users/vishnumovva/vulcan/.env` (it is gitignored):

```
VULCAN_SMTP_USER=vishnumovva@icloud.com
VULCAN_SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

(Use the password from step 1. Dashes are fine.)

### 3 · Live-fire one test alert, confirm receipt, then flip log-only OFF
From the repo (`cd /Users/vishnumovva/vulcan`):

```
# a) send ONE real test email (bypasses the 24h cap; needs the two vars above)
VULCAN_SMTP_USER=vishnumovva@icloud.com VULCAN_SMTP_PASS='xxxx-xxxx-xxxx-xxxx' \
  node contracts/runner.mjs --test-alert
```

- Check your inbox for **“[BONSAI WATCHMAN] Live-fire test alert.”** If it arrives, the pipe works.
- If it doesn’t send, the command prints the reason (e.g. wrong password) — fix and re-run.

```
# b) flip log-only OFF (sets mode=armed in the contract AND re-signs it)
node contracts/sign.mjs night-watchman --mode armed
```

That’s it. The 03:00 LaunchAgent’s wrapper (`contracts/run-nightly.sh`) reads
`VULCAN_SMTP_USER`/`VULCAN_SMTP_PASS` from `.env`, so once the password is in `.env` and the
contract is armed, the nightly run will email you (at most once per 24h) whenever a check fails.

**To put it back to safe/quiet at any time:** `node contracts/sign.mjs night-watchman --mode log-only`.

> Why re-signing? The contract is inert unless its `.md` signature matches the exact bytes of
> `night-watchman.json`. Changing the mode changes the JSON, so it must be re-signed — arming
> is always a deliberate, signed act. Editing the JSON by hand without re-signing makes the
> runner **refuse** it (fail-safe).

---

## Pre-flight decisions (Night Watchman — recorded for your review)

Probed both candidate hosts and every candidate path before writing the config:

- **Both hosts serve the site (200):** `https://bonsaicitations.com` and
  `https://bonsaicitations.vercel.app`.
- **`baseUrl` = `https://bonsaicitations.com`** — the canonical custom domain (Vercel-served),
  the address pilots actually visit. `.vercel.app` is kept as `fallbackUrl`.
- **Page set = the real `.html` pages linked from the homepage** (all 200): `/`, `/tool.html`,
  `/guides.html`, `/it.html`, `/privacy.html`, `/schools.html`, `/terms.html`.
- **Dropped `/it`** and the other extensionless clean-URLs. `/it` returns 200 via a Vercel
  clean-URL rewrite, but its siblings are inconsistent — `/guides`, `/schools`, `/privacy` all
  **404**. So the extensionless aliases are unreliable; the config uses the canonical linked
  page `it.html` instead. (This is the “drop `/it` if dead” instruction, resolved by evidence:
  `/it` isn’t dead, but it isn’t canonical either.)
- **No `/about` page** exists (404); never linked, not in the config.

**One full cycle run tonight (log-only): ALL CLEAR — 4/4 checks passed.**

```
✓ http200      — 7 paths, 0 bad
✓ consoleClean — 2 pages loaded headless (/, /tool.html), zero console errors
✓ linkCrawl    — crawled 12 same-origin pages from /, all 200
✓ engineSmoke  — citation engine controls present on /tool.html, clean load
```

---

## P5 THE VOICE PASS — results

- **One voice.** All speech funnels through a single channel (`voice.js` → `mouth.js`): the
  mouth tracks the live audio source and a generation guard, so a new utterance cancels the one
  in flight. **The tour-narration overlap is fixed** — verified by driving the tour and
  advancing rapidly: exactly one line is ever live.
- **Universal STOP.** `Esc` is contextual, one rung per press: overlay → close; intent line
  with text → blur; **SPEAKING → cut instantly**; **WORKING → cancel the job, honest `STOPPED`
  chip, one spoken line**; idle → bank. A visible **■** control mirrors this on every live chip
  and on the AUDIO panel (shown only while there is something to stop). All rungs verified in a
  browser drive.
- **Speech sanitizer.** No markdown, symbols, or paths ever reach the mouth; filenames are
  spoken as plain phrases (the exact name still shows on screen); money and percent are
  humanized (`$2.00`→“2 dollars”, `80%`→“80 percent”); thousands-commas dropped. URLs spoken as
  their host.
- **E.V. register.** `voice-register.json` is the single home for every fixed spoken string —
  short, second-person, answer-first, one-breath — applied across the loop, dispatch, the
  intent gate, and the workspaces.
- **Situational lines.** VULCAN volunteers one short line on a meaningful change (budget
  crossing 80%, deploy state flip): **attentive-only speech, hard cap 1 per 5 minutes**, and in
  hidden/dormant it records to the transcript only — never a voice from a dark screen.
- **Tests:** +17 P5 tests (sanitizer / register / situational). Renderer builds clean; zero
  console errors across the drive.

---

## Open items / notes for the operator

- **Repack owed.** These renderer changes (P5) are in the source + `dist/` build but a
  `npm run pack` is owed to carry them into the installed `/Applications/VULCAN.app`.
- **Watchman is log-only** until you complete the 3 morning steps above.
- **Global (unfocused) PTT** remains parked to v2.1 (needs a native event tap) — unchanged.
- The LaunchAgent is installed at `~/Library/LaunchAgents/com.siliconforge.vulcan.night-watchman.plist`
  (source of truth: `contracts/com.siliconforge.vulcan.night-watchman.plist`). To disable:
  `launchctl unload ~/Library/LaunchAgents/com.siliconforge.vulcan.night-watchman.plist`.

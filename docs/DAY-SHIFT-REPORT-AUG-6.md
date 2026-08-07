# DAY SHIFT — THE HANDOFF AND THE SOAK · 2026-08-06

Unattended day shift (~5h). Egress only via the signed night-watchman contract; Bonsai repos
read-only (never written); `.bak` backups untouched; no wake-word ear built; spend within the
governor. One push at the end.

## Task table

| Task | Result | Commit |
|---|---|---|
| **0 · HANDOFF** | `docs/HANDOFF-AUG-6.md` (mirrored to vault wiki) — full desk state for a fresh architect: what VULCAN is, every law, SHA chain by campaign, armed status, crew roster, open items A–F, verification commands | `6e5517c` |
| **1 · IDLE EFFICIENCY** | Banked stage now sleeps the render loop + polls + wire feed; resumes on summon (Doctrine-11 intact). Measured before/after (below) | `18994d4` |
| **2 · WATCHMAN SOAK** | 4 armed cycles ~75 min apart — **all 4 ALL CLEAR** (below). No defect found → no fix commit | — |
| **3 · MORNING HERALD (draft)** | `contracts/morning-herald.json` + `.md` — daily 08:00 digest proposal, **UNSIGNED & inert** (runner verified to refuse it until signed) | `c0e3734` |
| **4 · CREW REPORTS** | WARDEN extension re-audit + FRAMER live-site findings — read-only drafts filed to the vault, no edits anywhere | `882086e` |
| **5 · SHIFT REPORT** | this document | `N6` (this commit) |

Test battery: **107 → 108 green** across the shift. Renderer builds clean.

## Watchman soak results

Armed contract (`mode=armed`, sole recipient `vishnumovva@icloud.com`, 1 send/24h), run against
`https://bonsaicitations.com`. Each cycle: HTTP 200 ×7 · console-clean load of `/` + `/tool.html`
· same-origin crawl (12 pages) · citation-engine smoke on `/tool.html`.

| Cycle | Time (UTC) | http200 | consoleClean | linkCrawl | engineSmoke | Verdict |
|---|---|---|---|---|---|---|
| 1 | 2026-08-06 20:31 | ✓ 7/7 | ✓ | ✓ 12 | ✓ | **ALL CLEAR** |
| 2 | 2026-08-06 21:46 | ✓ 7/7 | ✓ | ✓ 12 | ✓ | **ALL CLEAR** |
| 3 | 2026-08-06 23:02 | ✓ 7/7 | ✓ | ✓ 12 | ✓ | **ALL CLEAR** |
| 4 | 2026-08-07 00:17 | ✓ 7/7 | ✓ | ✓ 12 | ✓ | **ALL CLEAR** |

**No alert mailed during the soak** — every cycle passed, so the contract correctly stayed
silent. (The only mail this machine has sent is the morning live-fire test on Aug 6; the mailer
fences held all shift.) Soak log: `logs/night-watchman.log` + `logs/soak-day-aug6.log`.

## Idle-efficiency numbers (P6)

Measured on the real Electron app (`scripts/measure-idle.mjs`, banked/hidden window, render loop
running vs paused, averaged over alternating rounds):

| Banked state | FPS | Renderer CPU | GPU | Renderer mem |
|---|---|---|---|---|
| **loop RUNNING** (pre-P6) | 60.0 | 1.06% | 1.96% | 136 MB |
| **loop PAUSED** (P6) | 0.0 | 0.21% | 0.16% | 135 MB |

While banked, the 60fps WebGL loop and all polls now stop: **renderer CPU −80%, GPU −92%**, no
background network. Memory is intentionally retained (~136 MB) so summon resumes instantly with
the Doctrine-11 resolve intact. Triggers are the authoritative session events (bank / force-hide
→ pause; summon `onIgnite` → resume), not the unreliable `visibilitychange` (with
`backgroundThrottling` off, `win.hide()` doesn't flip `document.hidden`). Verified the watchdog
heartbeat is a preload IPC pong, so pausing the loop never breaks it.

## Awaiting operator

**Pre-existing (carried from the handoff):**
- **A · Vercel token** — deploy eye reads "not connected" until a token is set (VERCEL workspace → SET TOKEN, writes local `.env`).
- **B · Waitlist number** — no live signup feed; card is a dash until hand-entered (stamped MANUAL).
- **C · Bonsai email + bank — UNKNOWN.** Blocks anything that would send *as* Bonsai.
- **D · Hermes inbox — blocked on C.** Drafts stay in the vault until a sending identity exists.
- **E · Wake-word ear — ruling pending.** Deliberately not built (no-open-mic law).
- **F · `.bak` deletion — ruling pending.** Backups preserved; do not delete until ruled.

**New this shift:**
- **Morning Herald — sign to arm.** Review `contracts/morning-herald.md`, then
  `node contracts/sign.mjs morning-herald`. Arming also needs: a digest composer (the runner is
  alert-shaped today), an 08:00 LaunchAgent, and a per-contract mailer rate key (so a herald
  digest and a watchman alert don't contend for the shared 1/24h cap).
- **WARDEN punch list (extension)** — verdict *consistent with zero-collection*; one LOW item:
  add a one-line `PRIVACY.md` disclosure for the "Open Google Docs" button (a user-initiated
  `window.open`, not an extension network request) so the "zero network requests" claim reads
  cleanly to a literal IT reviewer. No code change needed for compliance. Optional: a standalone
  `COMPLIANCE.md` mapping the architecture to COPPA/FERPA by name.
- **FRAMER punch list (live site)** — site is clean (no console errors, no broken links/anchors,
  complete meta/OG on all 7 pages, contrast ≥7.7:1 sampled). One real item: a ~24px horizontal
  overflow at 375px on every page from the grove SVG (currently clipped by `overflow-x: clip`, so
  no visible scrollbar) — suggest fitting the grove to `100vw` at ≤480px. All FRAMER output is a
  proposal; nothing was edited.
- **Repack owed** — P6 (and the earlier P4/P5) live in source + `dist/` but a `npm run pack` is
  owed to carry them into the installed `/Applications/VULCAN.app`.

## Verify (for the next desk)
```
cd ~/vulcan
git log --oneline -8                       # this shift's commits
npm test                                    # 108 green
node contracts/runner.mjs --contract night-watchman   # one watchman cycle by hand
node scripts/measure-idle.mjs               # reproduce the idle numbers
```

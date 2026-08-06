# VULCAN — ARCHITECT HANDOFF (2026-08-06)

Written for a stranger taking this desk cold. Read this top to bottom and you can operate,
extend, and verify VULCAN without any prior context. Repo: `~/vulcan` ·
`https://github.com/Critical-Turtle09/vulcan` (branch `master`).

---

## 1 · What VULCAN is

VULCAN is a Jarvis-style, full-screen intelligence terminal that runs resident on a Mac mini
and is summoned by hotkey (⌥⌘V) or wake phrase. Its **mission is RETRIEVAL + PRESENTATION, not
generation**: it routes spoken/typed intent to real tools (Obsidian vault, GitHub, Vercel,
Claude, the crew of subagents) and presents results on a blueprint "stage." It is an Electron +
WebGL app; the identity is the **a5 twin-helix orb** at center, framed by V.A.U.L.T. side
columns, a status strip, a command deck, and a typed intent line.

The **active mission is BONSAI** — Bonsai Instant Citation, a zero-collection browser citation
tool for students/educators (live at `https://bonsaicitations.com`). The `bonsai` profile is the
launch default; `semiconductor`/`political` profiles are archived to v3 (in-tree, off the switch).

**The design spec is LOCKED.** Canonical law lives in `CLAUDE.md` (v1.3 FORGE → v1.4 COMMAND
CENTER → v1.5 ATTENDANT → v1.5.1 TRIGGER → v1.6 THE STAGE, plus the TRUTH-PASS addendum and the
STANDING CONTRACTS law). When code and an older spec section disagree about *what exists*, the
SPEC ADDENDUM ("WHAT SHIPPED") is the current truth.

### How to run it
- `npm run dev` — vite renderer at `http://localhost:5273` (browser preview; voice is synthetic
  in `?voice=test`).
- `npm start` — vite + Electron together (the real app).
- `npm run pack` — package to `/Applications/VULCAN.app` (electron-packager, `asar=false`,
  LSUIElement so there's no Dock icon).
- `npm test` — the Node test battery (currently **107 green**).

---

## 2 · The laws (non-negotiable)

These gate every change. A change that violates one is a build-failing bug, not a style choice.

1. **The CONSTITUTION / WRITE GATE (absolute).** `brain/constitution.js` classes every action:
   **READ** and **DRAFT** run freely and silently; a **WRITE** that stays on the machine is
   announced then run; a **WRITE_CONFIRM** — anything that *leaves the machine or spends money*
   (git push/tag, deploy, send) — is **held until an explicit spoken/typed `confirm`**. Inference
   may trigger reads and drafts; it may never lower the gate. The only machine-leaving skill
   action is `repo.tag` (creates + pushes a tag), and it is confirm-gated. Pinned by
   `test/router.test.mjs`.
2. **STANDING CONTRACTS (egress law).** A contract (`contracts/<id>.json`) is INERT until the
   operator SIGNS it (`contracts/<id>.md` carries a sha256 over the canonical JSON, written by
   `contracts/sign.mjs`). The generic runner executes **only signed** contracts; editing the JSON
   breaks the signature (tamper-evident) and the runner refuses it. A contract's only egress is
   its declared, fenced channel (see §4). Pinned by `test/contracts.test.mjs`. Full text: the
   "STANDING CONTRACTS" section of `CLAUDE.md`.
3. **NEVER SILENT.** In a hot session every path speaks one line — no dead-ends, no silent
   failures. Offline/over-budget still ends in an honest spoken line AND a filed artifact.
4. **HONESTY / REAL-OR-LABELED-SIM.** Never present an unsourced number as real (the waitlist is
   hand-entered and stamped MANUAL; a missing feed shows a dash, never a fabricated figure).
5. **ONE VOICE + NO OPEN MIC.** All speech funnels through one channel (new utterance cancels the
   one in flight). Capture is **push-to-talk only** (`voice.capture_mode: "ptt"`, hold Space while
   focused) — the mic is provably closed at every resting moment. `fn` is reserved (operator's
   Wispr Flow) and must never be bound. **The wake-word ear is NOT built** (see open item E).
6. **MANUAL PERMANENCE.** THE MANUAL (spotlight tour) is a permanent organ: `?` key, the `tour`
   intent, and an always-visible `?` glyph must always open it. No slice may remove/gate them.
7. **TOKENS, NEVER HARDCODE.** Every visual value ships from `tokens.json` → CSS vars + Three.js
   uniforms. **DOCTRINE 11 (fluidity):** nothing pops; feedback <100ms, reveals resolve 240–700ms,
   backgrounds always move; a hard cut is a build-failing bug.
8. **VAULT CONTAINMENT.** All vault writes are confined to the `VULCAN/` subtree
   (`brain/skills/obsidian.js` `safePath`, symlink-escape rejected).

---

## 3 · The SHA chain, by campaign (oldest → newest)

Full history: `git log --oneline` (103 commits). Grouped by campaign:

**Design & red-lines** — `2ec29c2` v1.4 pack smoke · `3431fa6` RL-6 backdrop.
**Conductor spine (B-series)** — `f1357b7` B0 brainstem (conductor + constitution + $2 governor) ·
`b400356` B1 synapse (Haiku router, spoken answers) · `2499848` B2 repo hand + confirm gate ·
`fab61b7` B3 obsidian capture + containment · `080c9b3` B4 wire briefing · `f64bdf0` B5R first
mission (bonsai profile, mission brief, pitch desk, vercel read).
**Voice (V) + Ears** — `d830d74` ElevenLabs VULCAN 1 mouth + fail-soft chain · `a5cdd33` voice id ·
`41e43c4` speak-gate + watchdog.
**The Attendant / Trigger** — `59abacb`+`db59338`+`99b2055` v1.5 hot session + real-ears re-arm ·
`f58d48a` FX purity/never-silent · `83d49fb`+`24bee2d` v1.5.1 PTT + Wispr ears · `2e281c9` FX2 ·
`643d878` NS3 drill hardening · `b523370` FX3R · `4e23fd0` FX4 mid-think dormant drop.
**The Stage (G-series, v1.6)** — `88158fd` G0 lock spec · `b834b59` G1 shell · `c1cf8f7` G2 flanks ·
`fe760a8` G3 orb · `b799e2b` G4 lifecycle · `697032b` G5 intent line · `dd80d3a` G6 summon ·
`20a363d` G6.3 focus.
**Ledger & Crew (H/I)** — `5588075` H1 vault ledger · `93f5b51` I1 crew · `e4b5a82` I2 real skills ·
`b468cfd` I3 operator guide · `8235da8` I4 pipeline seed · `3573039` I5 outreach v2 · `2227df2` I6
outreach sequence · `eace631` I7 week-in-review.
**Console/Build/QA (P/Q)** — `c9086e3` P1.1 env · `58a2647` P2 console · `652cc49` P2.1 touch+manual ·
`96207dd` P2.2 manual permanence · `64dec77` P1.2 LSUIElement · `f8ff5c3` Q1 packaged QA · `36451dc`
Q2 offline · `cdcd544` P1.3 plist fix · `4a285fc` Q3 cleanup · `0354094` P3 waitlist · `9eddc69` P4
metrics history · `0233667` P5 the voice pass (one voice, universal stop, sanitizer, E.V. register).
**Tests** — `e174f38` T1 test battery.
**Night reports** — `1b2952e` N1 · `16847f5` N2 · `347bc19` N3 · `806c533` N4 · `57768f2` N5.
**Contracts (C-series, current)** — `c64d4cc` C1 night-watchman (system + armed log-only) ·
`da7d3ba` C1 mailer STARTTLS on 587 · `e5125e9` C1 arm (log-only → armed) · `612ab74` C1 isolate
the watchman log (tests → temp dir).

The **DAY SHIFT (Aug 6)** adds, on top: `D2` handoff (this doc), `P6` idle efficiency, `C2-DRAFT`
morning-herald, `I8` crew reports, `N6` day-shift report. Check `git log` for their SHAs.

---

## 4 · What's ARMED

**THE NIGHT WATCHMAN** — a signed, scheduled, read-only uptime sentinel over the Bonsai site.

- **Status:** SIGNED · **mode = `armed`** (verify: `node -e "import('./contracts/lib.mjs').then(({verify})=>console.log(verify('night-watchman')))"`).
- **Schedule:** `0 3 * * *` — 03:00 daily via user LaunchAgent
  `~/Library/LaunchAgents/com.siliconforge.vulcan.night-watchman.plist` (source of truth:
  `contracts/com.siliconforge.vulcan.night-watchman.plist`; wrapper `contracts/run-nightly.sh`
  loads SMTP creds from `.env`).
- **Checks (all read-only):** HTTP 200 over the 7 real linked pages; headless zero-console loads
  of `/` and `/tool.html`; same-origin link crawl (≤12 pages); citation-engine smoke test on
  `/tool.html`. baseUrl `https://bonsaicitations.com` (chose the canonical custom domain over
  `.vercel.app`; dropped the non-canonical `/it` clean-URL for `it.html` — recorded in the .md).
- **Egress fences (all in code, `contracts/mailer.mjs`):** recipient is the **compile-time
  constant `vishnumovva@icloud.com`** (not config/env/arg — a different recipient is refused);
  **max 1 send / 24h** (state file, gitignored); **every attempt logged** to
  `logs/night-watchman.log`. Transport: STARTTLS on `smtp.mail.me.com:587` (iCloud's implicit-TLS
  :465 is unreachable from here). Credentials from `.env` (`VULCAN_SMTP_USER`/`VULCAN_SMTP_PASS`,
  an Apple app-specific password named `vulcan-hermes`; **never committed**).
- **To quiet it:** `node contracts/sign.mjs night-watchman --mode log-only` (re-signs).
- **To disarm the schedule:** `launchctl unload ~/Library/LaunchAgents/com.siliconforge.vulcan.night-watchman.plist`.
- **Log hygiene:** the test battery redirects its log to a temp dir via
  `VULCAN_WATCHMAN_LOG_DIR`, so the real log is never polluted by tests.

A **second contract is DRAFTED but NOT armed** — see §7 (morning-herald), inert until signed.

---

## 5 · The crew (`.claude/agents/`, constitution-bound, DRAFT-ONLY)

All four are subagents that **only file drafts to the vault** — none sends, deploys, or pushes.

- **HERMES** — outreach/comms drafts (pilot emails, district follow-ups). Tools: Read/Grep/Glob/Write.
- **FRAMER** — Bonsai marketing-site frontend hand; proposes copy/layout as **diffs to the vault**,
  never edits the site. Tools: Read/Grep/Glob.
- **WARDEN** — COPPA/FERPA posture + Chrome-extension permissions auditor; files findings, never
  modifies. Tools: Read/Grep/Glob.
- **SMITH** — extension code hand; prepares patches in a **throwaway git worktree** only, never on
  the main checkout, never commits/pushes/publishes. Tools: Read/Grep/Glob/Bash.

---

## 6 · Open items (verbatim — awaiting the operator)

- **A · Vercel token** — the deploy eye reads "not connected" until a Vercel token is set (SET
  TOKEN in the VERCEL workspace writes `VULCAN_VERCEL_TOKEN` to the local `.env`).
- **B · Waitlist number** — no live signup feed; the waitlist card is a dash until the operator
  hand-enters the figure (stamped MANUAL + date). Live-source options memo is in the vault.
- **C · Bonsai email + bank — UNKNOWN.** The real Bonsai support/contact mailbox and its
  provider/bank are not confirmed. Everything downstream that would *send as Bonsai* is blocked on
  this.
- **D · Hermes inbox — blocked on C.** HERMES drafts outreach but there is no confirmed sending
  identity/inbox to send from; drafts stay in the vault until C is resolved.
- **E · Wake-word ear — ruling pending.** Whether to build an always-listening wake-word ear is
  UNDECIDED. It is deliberately **not built** (no-open-mic law). Do not build it without a ruling.
- **F · `.bak` deletion — ruling pending.** The `.bak` backups are preserved by standing order.
  **Do not delete them** until the operator rules.

---

## 7 · Proposals on the desk (drafted, not active)

- **MORNING HERALD** (`contracts/morning-herald.json` + `.md`) — a proposed daily **08:00**
  one-email digest (watchman verdict + vitals snapshot + wire highlights + open directives) to the
  same sole recipient. It is **UNSIGNED and inert**: the runner refuses it until the operator runs
  `node contracts/sign.mjs morning-herald`. Review the charter `.md`, then sign to arm (and add an
  08:00 LaunchAgent). This is a proposal artifact, not an armed job.

---

## 8 · How to verify (from anywhere, no local access needed)

**GitHub commit atom feed** (what changed, newest first):
```
curl -s "https://github.com/Critical-Turtle09/vulcan/commits/master.atom" | grep -E "<title>|<updated>" | head -40
```
**Raw fetch any file at HEAD** (read the actual shipped source/law):
```
curl -s "https://raw.githubusercontent.com/Critical-Turtle09/vulcan/master/CLAUDE.md"
curl -s "https://raw.githubusercontent.com/Critical-Turtle09/vulcan/master/contracts/night-watchman.json"
curl -s "https://raw.githubusercontent.com/Critical-Turtle09/vulcan/master/contracts/night-watchman.md"   # signature block
```
**Locally (on the Mac mini):**
```
cd ~/vulcan
git log --oneline -20                       # recent campaign SHAs
npm test                                     # the full battery (expect all green)
node contracts/runner.mjs --contract night-watchman     # run one watchman cycle by hand
node -e "import('./contracts/lib.mjs').then(({verify})=>console.log(verify('night-watchman')))"  # signed? mode?
tail -20 logs/night-watchman.log             # the sentinel's own log (gitignored, runtime)
launchctl list | grep night-watchman         # is the 03:00 agent registered
```
**Live site (read-only, allowed):**
```
curl -s -o /dev/null -w "%{http_code}\n" https://bonsaicitations.com/it
```

The signature is the trust anchor: recompute it and compare to the `.md`. If
`verify().signed` is false, the contract will NOT run — that is the system working, not a fault.

---

*Handoff written 2026-08-06. Mirrored to the vault wiki. For the plain-English machine overview
see `docs/STATE-OF-VULCAN.md`; for the running spec+truth see `CLAUDE.md`.*

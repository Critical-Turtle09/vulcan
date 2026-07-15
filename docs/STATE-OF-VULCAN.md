# STATE OF VULCAN

*The whole machine, in plain English. If you read one document to understand what VULCAN
is, how it works, what it will and won't do, and what's still open — this is it. Written
for a stranger, or for a tired founder at 2am. Canonical copy lives in the vault at
`VULCAN/BONSAI/wiki/STATE-OF-VULCAN.md`; the in-repo mirror is `docs/STATE-OF-VULCAN.md`.
Last brought current: 2026-07-15 (Night Shift 4).*

---

## 1 · What VULCAN is

VULCAN is a **command-center screen for the Bonsai Instant Citation launch.** It's a
full-screen app that lives on a Mac, summoned by a hotkey or a spoken phrase. Its job is
**retrieval and presentation** — it fetches what you ask for (deploy state, commits, the
vault, the news wire, outreach) and shows it beautifully, and it runs small jobs when you
ask, out loud or by typing. It does **not** write prose for you or invent content, and it
never acts on the outside world behind your back.

Think of it as a very calm assistant that files everything it does into a notebook (your
Obsidian vault) so there's always a paper trail, and that stops and asks before anything
leaves the machine.

The visual bar is "Territory Studio / FUI grade" — motion comes from the GPU (shaders),
not web animations. The look: a near-black stage, greyscale world, white data, and a
single molten-orange accent used only for meaning (events, active state), never decoration.

---

## 2 · The mission

VULCAN exists to help launch **Bonsai Instant Citation** — a browser extension that builds
correct MLA / APA / Chicago / IEEE citations for students, entirely **on the student's own
device** (no accounts, no network requests, nothing collected → COPPA/FERPA-friendly by
design). The marketing site is live at **bonsaicitations.vercel.app**.

VULCAN is **domain-blind under the hood** — everything about the domain lives in a profile
file (`profiles/*.json`). The active profile is `bonsai`. Two other profiles
(`semiconductor`, `political`) exist in the tree but are **archived to a future v3** and are
off the profile switch. This is "mission purity": VULCAN is the Bonsai command center, full
stop.

---

## 3 · How to run it

- **The installed appliance (normal use).** VULCAN is installed at `/Applications/VULCAN.app`.
  Launch it once from Applications; after that it lives in the menu bar (`◆ VULCAN`) and you
  summon it with the hotkey. It has **no Dock icon** by design. "Open at Login" is a toggle
  in its menu-bar menu (off by default).
- **Full Disk Access (grant once).** VULCAN files into your Obsidian vault, which sits inside
  a macOS-protected iCloud folder. The packaged app needs **Full Disk Access** (System
  Settings → Privacy & Security → Full Disk Access → add VULCAN.app → ON → quit + relaunch)
  before it can write there. This has been granted and proven.
- **From the project (development).** `cd ~/vulcan && npm start` runs the Vite dev server + the
  Electron stage together.
- **Keep `ollama serve` running** on the travel machine — it's the free local brain VULCAN
  falls back to when offline.

---

## 4 · The interface (the stage)

One screen, no scrolling, built from these zones:

- **The ORB (center).** VULCAN itself — a particle-matter "twin helix" sphere. It's a status
  light as much as a face: slow and quiet when idle, faster when working, brightest and
  swelling when speaking.
- **Status strip (top).** `CORE · <state> · WIRE · <state> · HANDS · <state>`. A dot turns
  ember when that part is active — your "is it busy?" glance.
- **Left flank — SYSTEM VITALS.** Four cards: WAITLIST, GH COMMITS/WK, VERCEL (deploy),
  CLAUDE SPEND (vs the daily cap). Below: DIRECTIVES (your top few) and DOCUMENTS (newest
  vault files). **Every card is clickable** — it opens a workspace with detail and, where it
  makes sense, an action.
- **Right flank — COMMAND DECK.** Ten commands you can click to run: MISSION BRIEF, DEPLOY
  CHECK, METRICS PULL, OUTREACH, WIRE SCAN, COMPLIANCE, PITCH DESK, VAULT CLEAN, PLAN TODAY,
  WK REVIEW. Below it, AUDIO I/O (the voice meter).
- **Corners** always show: wordmark + mission tag (top-left), clock + date (top-right),
  transcript + intent line (bottom-left), launch objectives (bottom-right).
- **THE MANUAL.** A guided tour of every zone, always reachable — press `?`, say/type `tour`,
  or click the small `?` glyph in the corner. It's a permanent fixture; no future change may
  remove it.

### Workspaces
When you run a deck command, a **task chip** appears near the orb with a timer; when the job
finishes, the chip becomes a **filename** you can click to read the result center-stage, with
an OPEN IN VAULT link. Everything it produces is also saved in the vault.

---

## 5 · How you talk to it

- **Push-to-talk.** Hold **Space** to talk, release when done. (Open-mic mode exists behind a
  config flag but push-to-talk is the default — it proved more reliable.) `fn` is deliberately
  never bound (it's your Wispr Flow key).
- **The wake phrase** "Fire and Forge" summons VULCAN from hidden. "Bank the fire" / "Stand
  down" (or `Esc`) dismisses it.
- **Session model — DORMANT ⇄ ATTENTIVE.** DORMANT listens only for the wake phrase.
  ATTENTIVE is a hot session: every utterance is a command, no re-wake between them, until you
  bank or it times out (auto-dormant after ~5 min of silence, announced before it drops).
- **The intent line** (bottom-left `>`): type a command instead of speaking. Typed and spoken
  commands go to the **exact same brain**.
- **Ears chain.** Speech-to-text is Wispr Flow's REST API when a key is set, falling back
  seamlessly to local whisper.cpp offline. Voice out is ElevenLabs, falling back to a local
  voice (Kokoro → macOS `say`). VULCAN **always speaks** — every job ends in a spoken answer
  or an honest spoken failure.

---

## 6 · The brain (how a command is answered)

`conduct(text)` routes any spoken or typed intent through this ladder:

1. **Deterministic skill match FIRST** — a local, keyless router. If the words clearly name a
   tool ("mission brief", "deploy status", "tag it v4"), the matching skill runs. This is the
   only path that can perform a write, so writes never come from a guess.
2. **The Haiku router** — if no skill matches, a cheap classifier decides REFLEX (trivial /
   greeting → answer locally) vs SYNTH (needs real synthesis).
3. **Sonnet synthesis** — the full answer path, for real questions.

Everything is **metered against a $2/day governor** (a ledger at `~/.vulcan/ledger.json`,
resets daily). If a call can't fit under the cap, or there's no key, or the network is down,
VULCAN **banks** to the **local Ollama reflex** and still answers. Nothing hangs (every network
call has a hard timeout), nothing goes silent, nothing is faked.

---

## 7 · The laws (non-negotiable)

- **The write gate (the constitution).** Every action is one of three kinds:
  - **READ** — looking things up. Free, silent, instant.
  - **WRITE** — writing into your own vault. Announced, then run. Stays on the machine.
  - **WRITE_CONFIRM** — the machine-leaving tier (push a git tag, deploy, send). VULCAN
    announces it and **waits for your explicit spoken/typed "confirm"** — it runs on nothing
    less. The only such action today is pushing a git tag.
- **AWAY mode.** If you set VULCAN to AWAY, it **never executes** a write or a confirm — it
  queues the request into a report for you to review on return.
- **Hard vault containment.** Every write is confined **in code** to a `VULCAN/` subtree inside
  the vault. Path escapes (`..`, absolute paths, symlinks) are rejected. VULCAN can read your
  vault but can only ever write inside its own corner of it.
- **Never silent, never file-less.** Every dispatch ends in a spoken line AND a filed vault
  artifact — even a failure files a real "this failed" note. VULCAN never fabricates a result;
  a not-yet-built feature files an honest note saying so.
- **Real data or labeled SIM.** Nothing on screen is a fake number. If it isn't live, it's
  labeled (e.g. the waitlist reads `MANUAL · <date>`, or `— / NO SOURCE`).
- **Tokens, never hardcode.** Every visual value (color, size, motion) comes from a single
  `tokens.json` design-token layer — nothing is hardcoded in a component.
- **Doctrine 11 — nothing arrives instantly.** Every state change resolves with a material
  transition (granular, per-glyph); a hard cut is a build-failing bug. Fluidity comes from
  continuity, never slowness — the terminal still feels instant.
- **The crew drafts; you send.** No specialist agent ever sends, pushes, or deploys.

---

## 8 · The hands (skills)

VULCAN's real, wired capabilities. Each is a bundle of actions under the write gate:

- **repo** — git/GitHub: status, recent log, diff summary (READ); create + push a tag
  (WRITE_CONFIRM). Rides the machine's existing `gh` credential; never embeds a token.
- **vault (obsidian)** — capture a note (WRITE), read recent/find notes (READ). Hard-contained
  to `VULCAN/`.
- **vercel** — a READ-only deploy eye (state + health). Reads a token from your local `.env`
  if set; otherwise honestly shows "not connected".
- **mission** — the launch brief (may synthesize) and the pitch desk / outreach board (local,
  free).
- **wire** — the ed-tech / citation news wire: headlines (local, keyless) and a briefing
  (one metered synthesis call).
- **crew** — the runtime hands for the crew (below): outreach drafts, follow-ups, commit
  digests, plan-today, weekly review, compliance audit, vault clean.

The ten deck commands route through these same skills, so the write gate and the ledger are
always in the loop.

---

## 9 · The crew (specialist drafters — Front I)

Four Claude Code subagents in `.claude/agents/`, constitution-bound and **draft-only** — every
output is HELD and filed to the vault; you send:

- **HERMES** — outreach & comms drafts (pilot emails, cadences, one-pagers, FAQs).
- **FRAMER** — Bonsai website frontend, as diffs to apply yourself (never deploys).
- **WARDEN** — COPPA/FERPA posture + Chrome-extension permission audits.
- **SMITH** — extension code patches, prepared in a throwaway git worktree (never your real
  checkout).

---

## 10 · The vault (the notebook)

Inside your Obsidian vault, under `VULCAN/BONSAI/`:

- `index.md` — the front door (your prose + an auto-generated inventory section refreshed by
  VAULT CLEAN, which never clobbers your writing).
- `outputs/` — every dispatch artifact (briefs, reviews, drafts, reports).
- `daily/` — one activity-trail file per active day; plan documents.
- `wiki/` — durable reference docs (the operator guide, this state document).
- `raw/` — raw captures.
- `state/` — VULCAN's own persisted state: `console.json` (directives/objectives),
  `waitlist.json` (the manual waitlist figure), `metrics.json` (the daily metrics history).

The `~/vulcan` git repo keeps mirror copies of the important docs under `docs/` so they're
version-controlled too.

---

## 11 · Honest data (what each number really is)

- **WAITLIST** — hand-entered. There's no live signup feed yet, so the card shows `— / NO
  SOURCE` until you type a real figure (click the card), after which it reads `<n> · MANUAL ·
  <date>`. Three ways to wire a live source are written up in the vault
  (`WAITLIST-LIVE-SOURCE-OPTIONS.md`).
- **GH COMMITS /WK** — real, from `git log` (last 7 days). *(In the packaged app this can read
  0 — the app bundle isn't a git checkout; it's honest, not a regression.)*
- **VERCEL** — real deploy state, or "N/C" until you set a Vercel token (via the VERCEL card).
- **CLAUDE SPEND** — real, from the $2/day governor ledger.
- **Sparklines** — the commits + spend sparklines render from a **vault-persisted daily
  metrics history** (`state/metrics.json`), snapshotted on boot and at midnight, seeded from
  real git history. Days before tracking existed show an honest zero baseline, never an
  invented trend.

---

## 12 · The test battery

`npm test` runs an automated regression suite (`node --test`, ~2.7s, no network / no spend /
no touch to the real vault or ledger). It covers the deterministic router + the write-gate
classes, the constitution gate (READ/WRITE/WRITE_CONFIRM + AWAY), the vault writer +
containment, every skill's artifact contract, the metrics history, and offline fail-soft.
Failures are loud (non-zero exit). Two guarded test seams exist: `VULCAN_DISABLE_ENV=1`
(force a keyless brain) and `VULCAN_VAULT_PATH` (point the vault at a throwaway dir).

---

## 13 · What's live vs deferred

- **Live:** the full stage (orb, flanks, deck, intent line, workspaces, manual), the conductor
  brain + governor + fail-soft, all the skills + the crew, the vault ledger, the installed
  appliance, the test battery, honest vitals + metrics history.
- **Deferred to a future v3:** the summonable scene library (map / device schematic / graph /
  timeline). The code is dormant in-tree; scene keyboard shortcuts are dev-only and off the HUD.
  The `semiconductor` and `political` profiles are archived out of scope.

---

## 14 · Open items (what's owed / awaiting the operator)

- **Set the real waitlist number** — click the WAITLIST card and enter it.
- **Pick a live waitlist source** when ready — see `WAITLIST-LIVE-SOURCE-OPTIONS.md`.
- **Set a Vercel token** (VERCEL card → SET TOKEN) to light up the deploy eye.
- **Keep `ollama serve` running** for offline answers.
- **Repack to carry the newest code to the installed app.** Source changes (e.g. the P4 metrics
  sparklines) reach the road appliance only after `npm run pack` + reinstall — an
  operator-present step. The waitlist honesty (P3) is already on the installed app.
- **`/Applications/VULCAN.app.night3-bak`** is a preserved backup — keep it until you've
  confirmed the current app is good, then delete.
- **Send the outreach** when ready — the drafts (cadence, one-pager, FAQ, cold emails) are all
  HELD in `VULCAN/BONSAI/outputs/`; nothing sends itself.
- **Bonsai email / bank account** — status unknown to VULCAN (it has no signal either way);
  that's an operator task.
- **Pipeline is empty by design** — no outreach targets have been invented or sourced; the
  `[bracket]` placeholders wait for real contacts you verify yourself.

---

## 15 · Keys & config (where the secrets live)

VULCAN reads a `.env` (never committed). Relevant keys:
- `VULCAN_ANTHROPIC_KEY` — the brain's wallet (deliberately separate from any Claude Code CLI
  key, so they never collide or cross-spend).
- `VULCAN_VERCEL_TOKEN` — the deploy eye (set via the VERCEL card, written locally).
- `VULCAN_WISPR_KEY` — Wispr Flow speech-to-text (falls back to local whisper without it).
- ElevenLabs key — nicer voice (falls back to local voice without it).

For the installed app, the writable `.env` lives in its per-user data folder; the SET-TOKEN
flows write there for you. None of these keys is ever logged, echoed, or committed.

---

*If anything here doesn't match what you see on screen, trust the screen and tell the forge —
this document follows the build.*

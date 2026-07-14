# VULCAN — Operator Guide

*Plain-English manual. Written for a tired person. Canonical copy lives in the vault
at `VULCAN/BONSAI/wiki/OPERATOR-GUIDE.md`; this is the in-repo mirror.*

---

## What VULCAN is

VULCAN is your command-center screen for the Bonsai Instant Citation launch. It sits
on the Mac, shows you the state of the launch (deploys, commits, the vault, the news
wire, outreach), and does small jobs when you ask — out loud or by typing. It reads
and presents; it does not act on the world behind your back. Anything that would
leave the machine (send an email, push code, deploy) it will **stop and ask first.**

Think of it as a very calm assistant that files everything it does into a notebook
(your Obsidian vault) so there's always a paper trail.

---

## Getting it on screen (summoning)

- **If it's already running:** press the summon hotkey, or click the **`◆ VULCAN`**
  item in the menu bar (top-right of the Mac screen). The stage appears over whatever
  you were doing.
- **Closing it** hides it back to the menu bar — it keeps running. It only truly quits
  if you pick **Quit** from that menu-bar menu.
- **Press `Esc`** to bank/dismiss the current thing and calm the screen.

(If it isn't running at all yet, see "Starting it up" at the bottom.)

---

## Talking to it (voice)

- **Hold `Space` to talk. Let go when you're done.** You'll see it listening. Release
  and it works on what you said, then speaks the answer back.
- The bottom strip shows `HOLD SPACE TO TALK · ESC TO STOP`. That's the whole contract.
- Every job ends in **spoken** words — either the answer or an honest "I couldn't do
  that." It never goes silent on you.

## Typing to it (the intent line)

- Bottom-left there's a `>` prompt — the **intent line.** Click it and type, press
  Enter. Typed commands go to the exact same brain as your voice.
- Use it when you can't talk, or when you want to be precise.

Examples you can type or say:
- `mission brief` — the whole launch picture, read aloud.
- `metrics pull` — Claude spend vs. the cap, commit count, deploy state.
- `deploy status` — is the site up.
- `plan today` — files today's plan into the vault.
- `outreach draft` — Hermes drafts three school-pilot emails (held, not sent).
- `compliance audit` — Warden checks the extension's privacy posture.
- `wire headlines` — the ed-tech / citation news wire.

---

## The screen, panel by panel

- **Center — the ORB.** VULCAN itself. Slow and quiet when idle; faster when working;
  brightest and swelling when speaking. It's a status light as much as a face.
- **Top strip (status).** `CORE · <state> · WIRE · <state> · HANDS · <state>`. A dot
  turns ember (orange) when that part is active. This is your "is it busy?" glance.
- **Left flank — SYSTEM VITALS.** Waitlist, commit velocity, deploy state, Claude
  spend against the daily cap. Below it: **DIRECTIVES** (your top few) and
  **DOCUMENTS** (the newest things filed to the vault — click one to open it).
  **Every card is clickable** — it opens a workspace with the detail and, where it
  makes sense, an action (set the Vercel token, edit directives, set the waitlist
  number).
- **Right flank — COMMAND DECK.** Ten labeled commands (MISSION BRIEF, DEPLOY CHECK,
  METRICS PULL, OUTREACH, WIRE SCAN, COMPLIANCE, PITCH DESK, VAULT CLEAN, PLAN TODAY,
  WK REVIEW). **Click any one to run it.** Below the deck is AUDIO I/O — the voice
  meter.
- **Bottom-center — PRIMARY DIRECTIVE.** The one big number that matters (waitlist),
  with the deploy line under it.
- **Corners** always show: wordmark + mission tag (top-left), clock + date
  (top-right), transcript + intent line (bottom-left), launch objectives
  (bottom-right).

### Workspaces

When you run a deck command, a small **task chip** appears near the orb with a timer.
When the job is done, the chip becomes a **filename** — click it and the result opens
**center-stage** as a readable page, with an **OPEN IN VAULT ↗** link. Close it to go
back. Everything it produces is also saved in the vault, so you never lose it.

### Setting the waitlist number (manual, honest)

There's no live signup feed wired yet, so VULCAN will **not** invent a waitlist
number — the card reads **`— / NO SOURCE`** until you give it a real figure.

- **Click the WAITLIST card** → a workspace opens. Type the real count (and an optional
  note, e.g. "from the signup sheet") and press **SAVE FIGURE.**
- The card then reads your number tagged **`MANUAL · <date>`** so it's never mistaken
  for a live feed. It's saved to the vault and **survives restarts.**
- **CLEAR** puts it back to `— / NO SOURCE`.
- When you later want it live, the three ways to wire a real source are written up in
  `VULCAN/BONSAI/outputs/WAITLIST-LIVE-SOURCE-OPTIONS.md` (Hermes memo).

---

## The crew (who does what)

VULCAN can hand specialist work to four crew members. **They all draft; none of them
send, push, or deploy.** Every crew output is a draft filed into
`VULCAN/BONSAI/outputs/` for you to review.

- **HERMES** — outreach. Drafts pilot/outreach emails. No addresses, no sending.
- **FRAMER** — the Bonsai website. Proposes copy/layout changes as diffs to apply
  yourself.
- **WARDEN** — compliance. Audits the extension's permissions against the
  zero-collection COPPA/FERPA posture and files findings.
- **SMITH** — extension code. Prepares patches in a throwaway worktree and hands you
  the diff; never touches your real checkout.

---

## The write gate (why it sometimes asks first)

VULCAN splits everything into three kinds:
- **Reads** — looking things up. Free, silent, instant. It just does them.
- **Drafts** — writing into your own vault. Also fine; nothing left the machine.
- **Machine-leaving** — sending, pushing, deploying, deleting, or anything that costs
  money. **These it announces and holds.** It tells you what it's about to do and
  waits for your explicit "yes." If you're in AWAY mode, it doesn't even ask — it
  queues the request into the report and does nothing.

So: it can never surprise you by emailing a school or deploying the site. That's the
whole point of the gate.

There's also a **spend cap** (a couple of dollars a day of Claude usage). When it's
near the cap, it quietly switches to the free local brain instead of spending more.

---

## When something looks frozen

Work through these in order — the early ones fix most things:

1. **Press `Esc`.** It banks whatever's happening and calms the screen.
2. **Wait a few seconds.** A job may be running (watch the top strip / orb — if the
   orb is in its "working" state, it's thinking, not stuck).
3. **Hide and re-summon.** Close the stage (it hides to the menu bar), then summon it
   again from the `◆ VULCAN` menu-bar item.
4. **Check the answer came back as text**, even if the voice didn't play — the panel
   and the vault file will still be there. Voice can fail soft while the work
   succeeds.
5. **Still stuck? Quit and relaunch.** Menu-bar item → **Quit**, then start it again
   (see below). Nothing is lost — everything it did is already in the vault.
6. If it won't start at all, it's a dev/setup issue, not a you problem — leave it for
   a hands-on session.

---

## Full Disk Access (do this once)

VULCAN files everything it does into your Obsidian vault, which lives inside a
macOS-protected iCloud folder. A packaged Mac app can't write there until you grant it
**Full Disk Access** — this is the one permission that makes the installed app whole.
Without it, dispatches may run but their artifacts won't land in the vault.

Grant it once:

1. **Apple menu  → System Settings → Privacy & Security → Full Disk Access.**
2. Click **`+`**, authenticate, and in the picker press **⌘⇧A** (Applications), pick
   **VULCAN.app**, **Open.**
3. Make sure VULCAN's toggle is **ON.**
4. **Quit VULCAN** from its menu-bar (`◆ VULCAN`) item, then **relaunch** it from
   `/Applications`. macOS only applies the new permission on a fresh launch.

You can confirm it worked: run **MISSION BRIEF**, then check the **DOCUMENTS** list on
the left flank — the new brief should appear there within a few seconds.

---

## Starting it up

**The installed appliance (normal use).** VULCAN is installed at
`/Applications/VULCAN.app`. Launch it once from Applications; after that it lives in the
menu bar (`◆ VULCAN`) and you summon it with the hotkey — no terminal needed. It has no
Dock icon by design. "Open at Login" is a toggle in its menu-bar menu (off by default).

**From the project (hands-on / development):**

```bash
cd ~/vulcan
npm start          # runs the dev server + the Electron stage together
```

- Voice needs keys in the `.env` (ElevenLabs for the nicer voice; a Wispr Flow key or
  local whisper for the ears). Without them it still runs and still drives the orb — it
  just falls back to the built-in Mac voice and text. For the **installed** app the
  writable `.env` lives in its per-user data folder; the SET-TOKEN flows (e.g. the
  Vercel card) write there for you.
- **Keep `ollama serve` running** on the travel machine — it's the free local brain
  VULCAN falls back to offline. Without it VULCAN still speaks, but only to say it has
  no local model.
- After code changes reach the source, the installed app is refreshed with a
  **repack + reinstall** (`npm run pack`) — an operator-present step.

---

*Filed by VULCAN · Front I · THE CREW. If anything here doesn't match what you see on
screen, trust the screen and tell the forge — the guide follows the build.*

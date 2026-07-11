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

## Starting it up (hands-on)

VULCAN currently runs from the project during development:

```bash
cd ~/vulcan
npm start          # runs the dev server + the Electron stage together
```

- Voice needs keys in `~/vulcan/.env` (ElevenLabs for the nicer voice; a Wispr Flow
  key or local whisper for the ears). Without them it still runs and still drives the
  orb — it just falls back to the built-in Mac voice and text.
- The packaged, install-to-Applications, launch-at-login version is a separate
  operator-present step (see the night-shift report). Once installed, you won't need
  the terminal — it just lives in the menu bar.

---

*Filed by VULCAN · Front I · THE CREW. If anything here doesn't match what you see on
screen, trust the screen and tell the forge — the guide follows the build.*

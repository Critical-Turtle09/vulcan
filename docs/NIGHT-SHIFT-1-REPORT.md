# NIGHT SHIFT 1 — Morning Report

*Filed 2026-07-11. Canonical copy in the vault at
`VULCAN/BONSAI/outputs/NIGHT-SHIFT-1-REPORT.md` (so it shows in the Z1 DOCUMENTS
trail); this is the in-repo mirror. Facts only, no gloss.*

---

## Task table

| Task | What | Status |
|------|------|--------|
| 0 | Audit true state of the P-series / project | **DONE** |
| 1 | Complete the P-series (appliance / console / touch) | **PARTIAL** |
| 2 | THE CREW — hermes / framer / warden / smith | **DONE** (I1) |
| 3 | Real skills — plan / review / outreach / compliance / vault-clean | **DONE** (I2) |
| 4 | Operator Guide in the vault | **DONE** (I3) |
| 5 | Morning report + single push attempt | **DONE** (N1) + push attempted last |

## Commits (this shift)

| SHA | Message |
|-----|---------|
| `93f5b51` | I1: THE CREW — hermes, framer, warden, smith as vault-drafting subagents |
| `e4b5a82` | I2: REAL SKILLS — plan, review, outreach drafts, compliance audit, vault clean |
| `b468cfd` | I3: OPERATOR GUIDE — plain-english manual in the vault |
| `N1` | N1: NIGHT SHIFT 1 — morning report *(this commit)* |

No `P1:`/`P2:`/`P2.1:` commit was made — see Task 1. Nothing was pushed until the
single end-of-shift attempt (bottom of this report).

---

## TASK 0 — Audit findings (the important correction)

The closing orders assumed the P-series (P1 THE APPLIANCE, P2 THE CONSOLE, P2.1 THE
TOUCH) might be "ran/committed" and only needed finishing. **It is not, and never
was, in this repo.** The true state:

- **P1 / P2 / P2.1 are ABSENT** — no commits under those names in `master` or any
  branch, no such code.
- **Real project state at shift start:** the **G-series** (`G0`…`G6.3`: the shell,
  flanks, orb, dispatch lifecycle, intent line, summon-from-hidden, focus polish)
  plus **`H1` THE LEDGER** (the `VULCAN/BONSAI/` vault + artifact filing). Tip was
  `5588075 H1`.
- **The locked spec is v1.6 "THE STAGE"** (CLAUDE.md). Its roadmap after the UI
  slices is **§6 Crew — Front I** (hermes/framer/warden/smith) and **§7 Front H —
  THE LEDGER** (done as H1). There is **no "P-series" in the locked spec** — the
  P-names are an overlay. The work that WAS spec'd next is exactly the crew, which
  this shift delivered (I1/I2).
- **`.claude/agents/` did not exist** (only `.claude/skills/`).
- **The vault exists** at the iCloud Obsidian path
  `…/Bonsai-Business/Agents/VULCAN/BONSAI/` with `index.md`, `daily/`, `outputs/`
  (3 prior mission briefs), `raw/`, `wiki/` (was empty).
- **Architecture:** the brain (`brain/`) is a clean conductor — `router.js`
  (Haiku REFLEX/SYNTH/SKILL classifier) → `conductor.js` spine → `skills/*` (an
  additive plugin contract) under `constitution.js` (the write gate:
  READ / WRITE / WRITE_CONFIRM × PRESENT/AWAY) and `governor.js` (≈$2/day cap).
- **No runtime subagent invocation exists** — the "crew" are Claude Code
  `.claude/agents/` used at the dev layer, so their runtime hand is a brain skill
  (built this shift), not a fabricated in-app agent runtime.
- **Deck commands:** five were honest stubs at shift start — `OUTREACH`,
  `COMPLIANCE`, `VAULT CLEAN`, `PLAN TODAY`, `WK REVIEW` (they filed real "standby"
  notes, never fake results). These are the "stubs" Task 3 replaced.
- **P1 appliance code already exists** in `electron/main.js`: `Tray`,
  `setLoginItemSettings({openAtLogin, openAsHidden})`, `globalShortcut`,
  `app.isPackaged` dist-loading, hidden-login boot, tray menu with "Open at Login".
  The `pack` npm script (electron-packager → `release/VULCAN-darwin-arm64/VULCAN.app`)
  exists. So P1 is largely BUILT; what's missing is packaging + install +
  hands-verification (below).

---

## TASK 1 — P-series closure (PARTIAL, honestly)

**Refusal stands and was upheld:** no unattended install to `/Applications`, no
`setLoginItemSettings`, no global-hotkey registration. Those are invasive,
hard-to-reverse, and — critically — **unverifiable without a human at the GUI**
(a tray app launching, a hotkey firing, TTS audio playing, PTT capturing a mic).
Reporting them "done" would be fabrication. What I could verify, I did:

- **Production web build: VERIFIED.** `npm run build:web` → `vite build` succeeds in
  ~107ms, emitting `dist/index.html` (39.7 KB) + `dist/assets/index-*.js`
  (594 KB / 160 KB gzip). The web layer packages cleanly.
- **P2 "actions everywhere / nothing inert": real progress, verified.** The five stub
  deck commands now run REAL hands (I1/I2), each producing a genuine vault artifact,
  all `$0`, routed through the conductor so the constitution + ledger stay in the
  loop. Tested via CLI and via `dispatch()` directly.

**Not done (deferred, NOT faked):**
- **Packaging + install + login-item + organ hands-verification** — operator-present
  (steps below).
- **P2 orb resize (~1.4×) and P2.1 micro-interaction vocabulary + THE MANUAL tutorial**
  — this is WebGL-stage UI work whose acceptance is *visual* (Doctrine 11: onset
  <100ms, reveals 240–700ms, zero jitter, ember-only). I have **no reliable way to
  screenshot the running Electron/WebGL stage unattended** to verify it, and adding
  unverified motion/JS to the operator's polished renderer risks regressing exactly
  the polish it's meant to add. Flagged for a stage-up session.
- **Two real code observations (not patched — unverifiable blind):**
  1. **No-Dock-icon not implemented.** No `LSUIElement` in the packaged Info.plist and
     no `app.dock.hide()` in `electron/main.js` — the packaged app will likely show a
     Dock icon, so the "no Dock icon" acceptance is unmet. Fix in a build session
     (Info.plist `LSUIElement=1`, or `app.dock?.hide()` on boot).
  2. **`.env` may ship inside the bundle.** `brain/env.js` resolves `ROOT` from
     `import.meta.url` and reads `ROOT/.env`; the `pack` `--ignore` list does not
     exclude `.env`, so keys could be packaged into `VULCAN.app`. Confirm intended
     key-resolution for the packaged app (and whether secrets should live outside the
     bundle).

### Exact operator-present install steps (run later today, hands on)

```bash
cd ~/vulcan
npm run pack        # vite build + electron-packager → release/VULCAN-darwin-arm64/VULCAN.app

# 1) smoke-test the packaged app before installing:
open release/VULCAN-darwin-arm64/VULCAN.app
#    (unsigned local build → Gatekeeper: right-click the .app → Open the first time)

# 2) install:
cp -R release/VULCAN-darwin-arm64/VULCAN.app /Applications/

# 3) launch from /Applications, then in the ◆ VULCAN menu-bar menu tick
#    "Open at Login" to set the login item.
```

Then hands-verify each organ in the PACKAGED app (not the dev server): summon
hotkey from a cold launch, voice PTT (hold Space), TTS speaks, a deck dispatch runs
and files to `VULCAN/BONSAI/outputs/`, the wire/vitals populate, the intent line
routes, and a machine-leaving intent (e.g. a push) announces + holds at the write
gate. Note anything that only works from the dev tree (env keys, vault path, whisper
binary) — that's the "robust packaged-app paths" check.

---

## TASK 2 — THE CREW (DONE · I1)

- `.claude/agents/{hermes,framer,warden,smith}.md` — constitution-bound subagent
  definitions. Every one is **draft-only**: output is filed to
  `VULCAN/BONSAI/outputs/`, nothing is sent/pushed/deployed, and deploy/send-class
  intents announce + hold at the write gate. `~/bonsai` is read-only to all of them;
  SMITH works only in a throwaway worktree.
- `brain/skills/crew.js` — the crew's **runtime hand** (there is no in-app subagent
  runtime, so the router reaches them through a normal skill). Registered in
  `skills/index.js` after `mission` so `outreach board` (mission's pitch desk) still
  wins over `outreach draft` (crew).
- Deck `OUTREACH` + intent phrases (`outreach draft`, `draft outreach`, `pilot
  email`, …) route to HERMES. **Verified:** intent routes `skill:crew` `$0`; the
  `OUTREACH` deck command files a real artifact (no longer a stub); `outreach board`
  still routes to `skill:mission` (no shadowing).

## TASK 3 — REAL SKILLS (DONE · I2)

All five are `$0` local, fail-soft, never-invent, and file to the vault (dispatch's
one Obsidian hand). The five dispatch stubs are replaced with real conductor routes.

- **PLAN TODAY** → composes today's plan from REAL sources (the three standing launch
  objectives, git commit velocity, the live vault trail) and writes it to
  `VULCAN/BONSAI/daily/`. It deliberately does **not** surface the profile's SIM
  tree-care "directives" as a plan.
- **WK REVIEW** → rolls up the week from commit history + the vault trail.
- **OUTREACH** (HERMES) → 3 school-pilot email drafts (librarian / English head /
  charter director) to `outputs/`, held — no addresses, no sending, under ~150 words
  each, no banned words.
- **COMPLIANCE** (WARDEN) → audits `~/bonsai/manifest.json` (read-only) against the
  zero-collection posture. **Verdict on the current manifest: CONSISTENT** — MV3,
  minimal `storage`/`activeTab`/`scripting`, no host permissions, no remote code, no
  accounts. Notes plainly that no formal COPPA/FERPA posture doc exists in-tree.
- **VAULT CLEAN** → re-indexes `index.md` via a managed auto-section between markers,
  preserving the H1 front-door prose and any operator edits.

**Verified:** each routes `skill:crew` `$0` via CLI; each files a real artifact via
`dispatch()`; VAULT CLEAN's WRITE announces itself and preserves the front door;
existing skills (`repo`, `mission`) still route correctly (no regressions).

## TASK 4 — OPERATOR GUIDE (DONE · I3)

`VULCAN/BONSAI/wiki/OPERATOR-GUIDE.md` (+ in-repo `docs/` mirror) — plain
tired-person English: what VULCAN is, summoning, talking (hold Space), typing (intent
line), every panel + the workspace flow, the crew, the write gate, and a
"when it looks frozen" checklist.

---

## Awaiting the operator

1. **The push.** One attempt was made at end of shift (see below). Awaiting your go.
2. **Packaged-app install** — the hands-on steps above (build + smoke-test + copy to
   `/Applications` + "Open at Login").
3. **Organ hands-verification in the packaged app** — the checklist above.
4. **Two build fixes** — (a) no-Dock-icon (`LSUIElement`/`app.dock.hide()`);
   (b) confirm `.env`/key resolution for the packaged app (secrets in bundle?).
5. **P2 orb resize + P2.1 micro-interactions + THE MANUAL** — needs a running stage +
   your visual sign-off against Doctrine 11; not doable/verifiable unattended.
6. **A formal COPPA/FERPA posture doc**, if you want one for schools — WARDEN can
   draft it from the compliance audit.
7. **Untouched:** `FLUIDITY-AUDIT-v2.md` was already modified in the working tree at
   shift start; I left it alone (not mine to commit).

---

## Governor / safety

No unattended machine-leaving actions. Every crew/skill run this shift was READ or a
contained DRAFT/WRITE inside `VULCAN/BONSAI/`; total metered spend added this shift:
`$0.00` (all hands are local). No deploys, nothing sent, `~/bonsai` never written.

*Filed by VULCAN · N1 · Night Shift 1.*

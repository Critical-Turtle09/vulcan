# VULCAN — NIGHT SHIFT REPORT

Unattended overnight run. Status per part: **DONE** / **DRAFT** (needs operator
taste review) / **PARTIAL** / **SKIPPED/BLOCKED** (with reason). Commits pushed
after every part.

Legend: 🟢 done · 🟡 draft/partial · 🔴 blocked/skipped

---

## Summary table

| Part | Title | Status | Notes |
|---|---|---|---|
| 1 | RL-4 signing pass (summon/bank/rings/ceremony) | 🟢 DONE (1a/1b need Electron visual confirm) | ceremony both dirs, rings×6, transparency via lighten+snapshot |
| 2 | Real geography | 🟡 DRAFT | real Natural Earth land/sea wired + rendering; relief derived (not DEM), legibility a morning tune |
| 3 | Molten ink + legends | 🟢 DONE | molten working-ink on scenes, ink.* tokens, per-scene legend, role labels |
| 4 | Scene library groundwork (schematic DRAFT) | 🟡 DRAFT | registry + device/schematic v0 (condense + explode), procedural |
| 5 | Local voice fallback | 🟢 DONE (Kokoro deferred: py3.9) | provider chain elevenlabs→kokoro→say; say fallback tested |
| 6 | Local reflexes (Ollama) | 🟢 DONE | regex reflexes verified; Ollama installed + llama3.2:1b + wired |
| 7 | Profile drafts | 🟡 DRAFT | bonsai fleshed out (map off), political drafted (map on); default unchanged; +crash fix |
| 8 | Regression harness | 🟢 DONE | `npm run audit` — 17 checks, frame-accurate, PASS; FLUIDITY-AUDIT-v2.md |
| 9 | Docs pass | 🟢 DONE | README front door, generated TOKENS.md, ARCHITECTURE.md, .env.example updated |
| 10 | Media capture | 🟢 DONE | 11 stills + ignition.mp4/.gif; MEDIA-INDEX.md committed, media gitignored |
| 11 | Website draft | 🟡 DRAFT | /site single page, house aesthetic; static, no deploy, waitlist front-end only |
| 12 | Skill scaffold | 🟢 DONE | 4 SKILL.md drafts (build-protocol, profile/wire/scene authoring), docs only |
| 13 | Close-out | 🟢 DONE | report finalized, all parts pushed |

---

## NIGHT II (final) — regressions first, then polish + non-design

### PART 1 — Space-switch bug, DIAGNOSTIC-FIRST 🟢 FIXED
- **Root cause (measured, not guessed):** `showOverlay()` called `win.show()`, which
  **activates** the app → macOS switches to the window's Space and steals frontmost.
- **Fix:** rebuilt the overlay as a **non-activating `type: 'panel'`** window shown
  via **`win.showInactive()`** (never `.show()`/`.focus()`), `setAlwaysOnTop
  'screen-saver'`, `visibleOnAllWorkspaces {visibleOnFullScreenScreen:true}`, sized
  to the active display, `fullscreenable:false`. Removed `app.hide()` on bank (no
  activation to undo).
- **Instrumentation:** `VULCAN_DIAG=1` runs a scripted self-test logging window
  state + macOS frontmost app around summon/bank → `ignition-diagnostic.log`.
- **Acceptance (log evidence):** frontmost app = **`Finder` at baseline, at summon,
  after-summon, and after-bank — never changed**; at summon the panel is
  `visible:true, focused:false`. **No app switch; non-activating panel ⇒ no Space
  switch.** Focus returns to the underlying app on bank automatically.
- **Operator eyes:** the panel shows without focus, so **keyboard** shortcuts
  (T/V/N/K, digits) need a click on the overlay first (`acceptFirstMouse` — makes it
  key without activating the app) or use voice/hotkey; the global `Esc` banks
  regardless of focus. Verify keyboard-after-click doesn't switch Spaces on your
  setup. (Voice is the primary driver, so this is a minor caveat.)

## Part log

### PART 1 — RL-4 signing pass 🟢
- **1a summon-on-current-Space + transparency:** overlay is borderless,
  `fullscreenable:false`, always-on-top `screen-saver`, `visibleOnAllWorkspaces`,
  sized to the active display each summon → joins current Space, no native
  fullscreen. Real screen shows beneath the sparks via a CSS `mix-blend-mode:
  lighten` canvas over an active-display `desktopCapturer` snapshot on `#backdrop`;
  `#void-over` opacity = presence fades the void floor in. **Transparency verified
  in-browser** (desktop-sim gradient shows beneath sparks, `p1-lighten.jpeg`).
  Needs **operator visual confirm in Electron** (desktopCapturer + active-Space
  can't be headless-tested; screen-recording permission required, fail-soft to
  void if denied).
- **1b bank restores app:** `hideOverlay()` calls `app.hide()` on darwin → macOS
  returns focus to the previously frontmost app (not the desktop). Dismiss accepts
  mishears: "bank the fire/forge", "stand down", "bake the fire", "bank fire".
  (Focus-restore not headless-verifiable — operator confirm.)
- **1c rings:** count 3→6, radii tightened toward the body (0.70–1.15, tighter
  spacing), displacement lowered (noiseAmp 0.12→0.085), opacity 0.5→0.42.
  `f5-idle2`/`p1-*` — calm undulation idle, surge under audio.
- **1d ceremony (spec amended):** IGNITION ~3.35s measured (kindle → molten
  hammer-on-anvil **shockwave ring** `p1-shock.jpeg` → condense/cool → **VULCAN
  title beat** `p1-title.jpeg` → orb+HUD). BANK ~1.8s quench (steam-grey drain).
  Fluidity: ignition maxStep 0.039, bank 0.056 — both fluid, no cuts.

### PART 2 — Real geography 🟡 DRAFT
- Fetched **Natural Earth 50m** land + coastline (**PUBLIC DOMAIN**; source/license
  in `data/topo/README.md`), cached in `data/topo/` (raw geojson gitignored,
  re-fetchable; processed per-region grids committed).
- `scripts/build-topo.mjs` rasterizes each region bbox (added to
  `profiles/…regions[*].topo`) → `data/topo/<region>.json` (land/sea mask, derived
  relief, coastline flags). Taiwan land=7084 coast=3048 cells, etc.
- `src/topo.js` + `theater.js` sample the real grid (bilinear height, bright
  coastline dots) instead of procedural noise; `main.js` passes the region id.
  `p2-taiwan-real`/`p2-korea-real`: real relief renders (raised peninsulas, sea).
- **DRAFT / morning tune:** the OUTLINE is real (Natural Earth mask); fine elevation
  is DERIVED (coast-low/interior-high proxy), not a sampled DEM. Map-shape
  legibility from the fixed low-oblique camera is subtle — a real DEM (ETOPO/SRTM)
  subset + a camera/contrast pass are the upgrades. World-strip not yet added.

### PART 3 — Molten ink + legends 🟢
- Site dots, route lines, and the traversal marker on summoned scenes are now
  **molten working-ink**; a wire HEAT event distinguishes by intensity (forge-hot),
  size, and pulse/propagation — not by being the only orange.
- `ink.*` tokens (`site.rest/heat`, `route.rest/heat/alpha`) expose resting
  restraint for the morning retune (`site.rest` 0.55→0.32). `p3-molten-ink`/`p3-ink2`.
- Per-scene **LEGEND** (bone mono-caps, theater only) + role-context labels
  ("TSMC · HSINCHU · FAB"). HUD swept — no orphan strings.
- CLAUDE.md §3 ink-doctrine amendment recorded. Equity quotes stay greyscale.

### PART 4 — Scene library groundwork 🟡 DRAFT
- `src/scenes/index.js`: scene-type **registry** (map=live, schematic=draft,
  graph/timeline=planned) the future brain routes into.
- `src/scenes/schematic.js`: procedural **GPU device** — board · GPU die · HBM×6 ·
  VRM×8, house-material dust that **condenses from scatter** on summon; **EXPLODE**
  (`E`) separates components along axes, die runs molten-hot. Tethered part labels
  with legend context. No external 3D — pure primitives. `scene.*` tokens.
- Summon with `X`; wired into the shared orb→scene crossflow (own reveal gate,
  fog off). `p4-assembled` / `p4-exploded` (die lifts, HBM out, VRM forward).
- **DRAFT:** dim house-material read + basic labels; brightness, per-part legend
  panels, and graph/timeline scenes are follow-ups.

### PART 5 — Local voice fallback 🟢 (Kokoro deferred)
- **Provider abstraction** in `voice-main.js` with auto-failover
  (`voice.providerChain`): **elevenlabs** (cloud) → **kokoro** (local, slots in via
  `$KOKORO_BIN`) → **say** (macOS, always available). ElevenLabs returning
  null on quota/auth/network fails over automatically. `VULCAN_TTS_PROVIDER` env
  forces one (for testing).
- **macOS `say`** fallback tested headless: produces valid RIFF/WAVE, base64
  round-trips cleanly, decodes through the SAME analyser → envelope drives orb +
  rings identically on every provider.
- HUD: local TTS surfaces as `LISTENING · LOCAL SAY` (molten) on the VOICE vitals
  line. `voice.status()` exposes `{provider, local}`.
- **Kokoro deferred (blocked):** system Python is **3.9.6** (< kokoro's 3.10+),
  and kokoro pulls heavy deps + a ~300MB model — impractical to install cleanly
  unattended. Wired to slot in when a `KOKORO_BIN` is configured. `say` is the
  shipped tested local path.

### PART 6 — Local reflexes 🟢
- `src/reflex.js`: short intents (mute/unmute, bank, summon «region|schematic»,
  status, profile, explode/assemble) classified **regex-first** (instant, zero-dep)
  then **Ollama** for fuzzy phrasing; non-commands fall through to the brain.
- Wired into the voice loop (after capture) — a reflex resolves + optionally speaks
  a confirmation and skips the brain. `main.js` `runCommand` maps intents to real
  actions + a spoken `statusLine`.
- **Ollama installed** (brew) + **`llama3.2:1b` pulled** + server up (Apple
  M4/Metal); `reflex:classify` IPC (JSON, few-shot, 2.5s timeout) — fail-soft to
  regex. reflex.* tokens.
- **Tested headless (regex):** 8 simulated transcripts all route correctly. Ollama
  path needs the server running (`brew services start ollama` — setup note).

### PART 7 — Profile drafts 🟡 DRAFT
- `bonsai.json` fleshed out: directives + HUD metrics, 4 specimen entities with
  dossiers (juniper/maple/pine/azalea), keyless horticulture feeds. Map OFF.
- `political.json` drafted (NEW): map ON with 3 theaters (Washington / Brussels /
  East Asia) — institutions as sites + dossiers + routes, keyless political feeds
  (sanctions / alliances / flashpoints) with region keywords. Sites render on
  procedural terrain (no topo grids yet). Both marked `"draft": true`.
- Registered in `profile.js` (cycle semi→bonsai→political→semi). **Launch default
  unchanged (semiconductor).** Verified cycle + political `eastasia` summon.
- **Bug fixed:** switching profile while a region was summoned crashed `paintHud`
  (`regions()[currentRegion].name` on a region absent from the new profile) —
  now guarded (+ shows "DEVICE" for the schematic scene).

### PART 8 — Regression harness 🟢
- `scripts/audit.mjs` (Playwright, wired as **`npm run audit`**) drives EVERY
  transition — both ceremonies, orb states + rings under sim audio, mute, summon,
  wire ignition, quotes, panels, return, profile switch, schematic condense +
  explode — and measures each for doctrine-11 fluidity (**maxStep < 0.5**).
- **Frame-accurate** sampling: each trace samples its value every
  `requestAnimationFrame` in-page (no multi-evaluate aliasing), panel triggers +
  traces in one evaluate, glyph getter hold-last so DOM removal isn't scored as a
  cut. Exits non-zero on any failure.
- **17/17 PASS** (ignition 0.017, bank 0.028, summon 0.05, panel open 0.257 /
  close 0.4, orb lerps <0.07). `FLUIDITY-AUDIT-v2.md` auto-generated + committed.
- Debugging note: an early coarse-sampling run false-flagged the panels — root
  cause was measurement aliasing (confirmed the panel lives its full ~408ms
  dissolve), fixed by frame-rate sampling. (Durations read short under headless
  rAF throttling; the maxStep fluidity metric is unaffected.)

### PART 9 — Docs pass 🟢
- **README.md** — real front door: what VULCAN is, the ceremony, orb, theaters,
  key map, setup, `.env` **field names only** (no values), commands, doc links.
- **TOKENS.md** — auto-generated from `tokens.json` by `scripts/gen-tokens.mjs`
  (`npm run tokens`); every token path + value, grouped + described.
- **ARCHITECTURE.md** — engine / organs / profiles / scenes with a system diagram.
- `.env.example` updated (VULCAN_TTS_PROVIDER, KOKORO_BIN, VULCAN_DEV_URL — names
  only). Added `npm run tokens` + `npm run topo` scripts.

### PART 10 — Media capture 🟢
- `scripts/capture-media.mjs` (**`npm run media`**) captures 11 money-shot stills
  (ignition kindle/strike/title, orb idle + speaking-rings, Taiwan summon, wire
  ignition, panel resolve, schematic assembled/exploded, quench) + a 22-frame
  ignition sequence, all at 1600×1000.
- ffmpeg builds `ignition.mp4` (660K, h264) + `ignition.gif` (2M) from the sequence.
- Heavy media **gitignored**; `MEDIA-INDEX.md` committed as the manifest with
  regenerate steps. Verified stills non-blank (wire-ignition spot-checked).

### PART 11 — Website draft 🟡 DRAFT
- `site/index.html` — single-page landing in the **house aesthetic** (void ·
  bone · molten · blueprint chrome · Martian Mono + Archivo): sticky nav, hero
  ("Your desk, at the anvil.") over a ceremony still, **capabilities triptych**
  (Voice / Summon / Scenes), scene split, **spec sheet**, **waitlist form
  (front-end only — no submit/store)**, persistent "DRAFT · FOR OPERATOR REVIEW".
- Committed hero/scene images as `.jpg` (downscaled from the money shots).
- **Static, no deploy, no payments.** Rendered + screenshot-verified
  (`http://localhost:5273/site/`).

### PART 12 — Skill scaffold 🟢
- `.claude/skills/` with 4 SKILL.md drafts (conductor prep), encoding what
  CLAUDE.md + repo history establish — **documentation only, no behavior change**:
  - `vulcan-build-protocol` — working rules, §7 acceptance, doctrine 11, cadence.
  - `profile-authoring` — the profile schema + rules (domain-blind engine).
  - `wire-feed-tuning` — the wire pipeline (score→ignite→propagate→decay) + levers.
  - `scene-authoring` — the condense-from-dust pattern + summon-machine wiring.

### PART 13 — Close-out 🟢
Report finalized; every part committed + pushed (one commit per part). See below.

---

## Needs operator eyes (couldn't be verified headless)

These are **implemented + syntax-clean** but are Electron-main visuals that a headless
Playwright run can't confirm — verify in the live app:

1. **§1a live transparency in Electron.** The transparency *mechanism* is verified in-browser
   (desktop-sim shows beneath the sparks via `mix-blend-mode: lighten`). In Electron it uses a
   `desktopCapturer` snapshot of the active display as the backdrop — confirm the real screen
   shows beneath the kindling sparks, and that screen-recording permission is granted (fail-soft
   to void if denied).
2. **§1a active-Space overlay / §1b focus restore.** Confirm summoning in Chrome/Mail resolves
   OVER that screen with **no Space swipe**, and banking returns focus to that app (via
   `app.hide()` on macOS) — not the desktop.
3. **Wake→ignition + voice dismiss live.** With the mic, confirm "Fire and Forge" from hidden
   plays the full ceremony and "Bank the fire" quenches.

## Open issues / follow-ups (morning)

- **Real geography legibility (PART 2, DRAFT).** Relief is real in outline but the map-shape
  reads subtly from the fixed low-oblique camera, and fine elevation is *derived*, not a sampled
  DEM. Upgrades: a real ETOPO/SRTM subset, a camera/contrast pass, the world strip.
- **Molten ink retune (PART 3).** `ink.*` tokens are exposed for a taste pass — resting scenes
  are calmer now (`site.rest 0.32`) but the resting-vs-heat gap is a judgement call.
- **Schematic polish (PART 4, DRAFT).** Dim house-material read; wants brightness, per-part
  panels, and the graph/timeline scenes.
- **Kokoro TTS (PART 5, deferred).** System Python is 3.9.6 (< 3.10) + heavy deps; the provider
  chain slots it in via `$KOKORO_BIN`. macOS `say` is the shipped tested local fallback.
- **Ollama reflex (PART 6).** Installed + `llama3.2:1b` pulled + wired; the fuzzy path needs the
  server running (`brew services start ollama`). The regex layer works without it (verified).
- **Profiles (PART 7, DRAFT).** `bonsai`/`political` are scaffolds; populate before live use.
- **Website (PART 11, DRAFT).** Static only; no deploy/payments; waitlist is front-end only.

## Questions for the operator

1. **Real DEM vs derived relief** — worth wiring a real ETOPO/SRTM subset (heavier data,
   real elevation) for the map, or is the real-coastline + derived-relief read enough?
2. **Ceremony length** — ignition ~3s / bank ~1.8s. Too long for a daily-driver summon, or right
   for the ceremony? (Own tokens — trivial to retune.)
3. **Molten-as-working-ink** — approve the ink-doctrine amendment (molten routes/sites at rest,
   heat = intensity), or keep summoned scenes greyscale with molten reserved strictly for events?
4. **Profiles to prioritize** — flesh out `political`, `bonsai`, or a different domain next?
5. **Wave-rings** — 6 rings at the tightened radii — keep, or fewer/looser?

## How to review

```bash
npm start          # resident overlay on the orb home (fixed build)
npm run audit      # re-run the fluidity harness (17 checks) -> FLUIDITY-AUDIT-v2.md
npm run media      # regenerate the money shots -> media/ (+ ffmpeg for clips)
open site/index.html   # the website draft
```
Live app: summon `T/V/N/K` (real terrain), click sites (dossiers), `X`+`E` (schematic),
`P` (profiles), say a command ("pull up korea", "status", "explode it"), `Esc` to bank.

## Ledger

13 parts · 13 commits · all pushed to `origin/master`. 🟢 8 done · 🟡 4 draft (2, 4, 7, 11)
· 1 partial-deferred (5 Kokoro). No part skipped/blocked outright.


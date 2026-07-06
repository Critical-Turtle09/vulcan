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

### PART 2 — Restore the V.A.U.L.T sidebars 🟢 FIXED
- **Regression cause:** Night I's transparency work gave `#stage` a `z-index: 2`;
  the V.A.U.L.T columns (+ keys / bank-hint / legend) had `z-index: auto` (0) →
  the canvas painted **over** them, silently hiding the sidebars at the resolved home.
- **Fix:** raised the HUD DOM layers above the canvas (`#label-layer` z3, `.vault-col`
  / `#keys` / `#bank-hint` / `#legend` z4, panels z5, title z6). Left vitals + right
  command deck are back exactly per spec v1.3 (`n2-vault-restored.jpeg`).
- **Regression-tested:** added a "V.A.U.L.T sidebars visible" check to `npm run
  audit` — a real occlusion test (temporary `pointer-events:auto` + `elementFromPoint`)
  that fails if the columns are covered or transparent. Audit now **18/18 PASS**.

### PART 3 — Orb rings rework: Line2 wave-tethered contours 🟢 DONE
- **What changed:** retired the `LineLoop`/`LineBasicMaterial` rings (WebGL ignored
  `linewidth`, so they could never thicken) for **Line2/LineGeometry/LineMaterial**.
- **Wave-tethered:** every ring vertex now rides the **identical displacement field
  as the body** (`displaceJS`), so each ring reads as a molten-surface contour —
  wavy, never circular — and surges with audio like the sea.
- **Persistent molten ring:** one always-on heat contour (`rings.molten.*`), slow
  breathing + wire-heat flush; opacity tuned 0.34→0.6 so it reads molten-iron, not
  crimson, while a thin ring stays under the ambient heat budget.
- **Clustered dots:** bone beads bunched along each contour (`rings.dotsPerRing/
  dotSize`), sampled from the live displaced line, dpr-scaled.
- **Token schema reworked:** `radii/noiseAmp/noiseFreq/audioGain/speed` →
  `offsets/spinFollow/dotsPerRing/dotSize/molten{}`. `orb.setResolution` wired from
  main.js (Line2 needs the drawing-buffer size). Screenshots idle/listening/speaking
  (`p3-idle2/-listening2/-speaking.jpeg`) — calm undulation → stir to mic → surge to TTS.
- **Operator eyes:** listening/speaking at high amplitude churn the sea hard (the
  silhouette loosens by design — audio-reactive). Tune via `orb.states.*.waveAmp`
  / `wave.maxAmp` if you want a tighter body.

### PART 4 — Ceremony v2: richer strike, longer quench 🟢 DONE
- **Ignition richer:** `spark.count` 1900→2400, `ceremony.ms` 3000→3200; the STRIKE
  is now a **double hairline shockwave** (lead ring + lagging inner ghost,
  `shock.innerLag`) — a richer hammer-on-anvil read than one circle.
- **Quench longer + richer:** `bank.ms` 1800→2600; the cooling splits — ~82% of
  sparks **steam upward** (`quench.steamRise`), ~18% heavy **embers fall**
  (`quench.emberFall`), all drift outward as the orb cools to grey.
- **Real screen through the dissolve:** verified with a simulated desktop backdrop —
  the real screen shows THROUGH both the ignition sparks and the quench dissolve
  (canvas lighten-composite), the orb condensing/dissolving as granular matter over
  it (`p4-strike.jpeg`, `p4-quench-mid.jpeg`).
- **Operator eyes:** the mid-quench shot used an over-bright test backdrop, which
  washes out the (additive) dissolving orb; on a real, darker desktop the dissolve
  reads far stronger. Worth a look in the packaged .app over a normal screen.

### PART 5 — Map country borders + labels + legends 🟢 DONE
- **Real political layer** (public-domain Natural Earth 50m, same corpus as PART 2 —
  no fabricated geography). `build-topo.mjs` clips **admin-0 boundary lines** per
  region into normalized (u,v); `theater.js` draws them as quiet terrain-riding
  hairlines (`data.faint`, `border.*` tokens), distinct from the bright bone coast.
- **Honest by construction:** Taiwan yields **0 land borders** (the strait is
  maritime), EU gets NL/DE/BE, Korea the DMZ, N.America the US–Mexico line.
- **Country labels:** NE admin-0 label points — in-bbox countries render on the
  terrain; a curated per-region EXTRA (China, N.Korea, USA, Mexico) covers countries
  in view whose centroid is off-bbox. Because fab sites are **hand-placed (not
  geo-registered)**, a geo-accurate label can fall off the camera frame — those
  clamp to a safe band with a ‹/› caret (off-view indicator), de-collided, clear of
  the V.A.U.L.T columns.
- **Legend:** extended with `▬ COAST` and, only where a land border exists, `─ BORDER`.
- **Evidence:** `p5-eu2.jpeg` (NL/DE/BE), `p5-korea2.jpeg` (S.Korea + DMZ),
  `p5-taiwan2.jpeg` (TAIWAN + ‹ CHINA, no BORDER in legend).
- **KNOWN LIMITATION (morning):** the terrain is real geography at full span but the
  fab sites are hand-placed decoratively, so borders/labels don't register 1:1 with
  the site marks and some borders sit off the framed center. A true fix is to
  geo-register the sites (place them by lon/lat through the same u,v transform).

### PART 6 — .app packaging + login item 🟢 DONE
- **Packaged** with `@electron/packager` (arm64) → `release/VULCAN.app` (bundle id
  `com.siliconforge.vulcan`, asar off so the main process keeps fs-reading
  tokens.json/profiles/.env). `vite base:'./'` + `build:web` produce `dist/`; main.js
  loads `dist/index.html` when `app.isPackaged`, else the dev server. `three` moved to
  devDependencies (build-time only), ignore list trims scratch/dev/media.
- **Login item** (packaged only): `openAtLogin` default-on first run, `openAsHidden`
  so it boots resident to the tray + wake listener with **no overlay flash**
  (`ready-to-show` honors `wasOpenedAsHidden`); operator toggle in the tray.
- **Verified:** built renderer boots over a file://-equivalent preview; packaged main
  process boots clean via the DIAG self-test (no crash / missing files); Info.plist +
  bundle structure correct.
- **Operator eyes:** unsigned/un-notarized (local Mac mini use). First launch needs a
  right-click → Open (Gatekeeper). Screen-recording permission for the ceremony
  backdrop and mic permission prompt on first use. `npm run pack` rebuilds it.

### PART 7 — Kokoro TTS via python3.11 venv 🟢 DONE (upgrades Night I's deferral)
- Night I deferred Kokoro (Python 3.9 < required 3.10). Now stood up on **python3.11**:
  `voice/kokoro/venv` with **kokoro-onnx** (onnxruntime) + `espeakng-loader` (bundled
  espeak-ng, no system install) + soundfile.
- `say.py` (kokoro-onnx → 24 kHz mono WAV) behind `kokoro-say`, matching the
  `KOKORO_BIN "<text>" -o <out.wav>` contract the voice organ already had. Default
  voice **`bm_george`** (British male — the Jarvis/forge read); `KOKORO_VOICE` overrides.
- `setup.sh` recreates venv + downloads the ~350 MB models idempotently; `venv/` +
  `models/` gitignored and excluded from the .app (packaged app uses the absolute
  `KOKORO_BIN` into the source tree). README + .env.example document it.
- **Verified:** standalone synth (2.77 s, peak 0.52, 62% non-silent real speech) and
  the exact `voice-main.js` spawn path (`KOKORO_BIN [text,'-o',out]` → valid WAV).
  With no ELEVENLABS key the chain now lands on **Kokoro**, not macOS `say`.

### PART 8 — Performance pass 🟢 DONE
- **Ring buffer reuse:** the PART 3 rings called `LineGeometry.setPositions()` every
  frame for 7 rings (reallocating the interleaved buffer + recomputing bounds — GC
  churn at 60 Hz). Now the buffer is allocated once and the per-frame update writes
  straight into `attributes.instanceStart.data.array`; `frustumCulled=false` skips the
  bounds recompute.
- **Summoned-scene draw gating:** the 60k-point terrain + schematic were always in the
  scene, issuing full draws at home that produced only alpha-0 fragments. Gate
  `object.visible` on reveal so those draws are skipped when they'd render nothing.
- **Measured:** 60 fps home-idle / home-speaking(audio) / taiwan-theater (rAF-capped;
  the wins are GPU/GC headroom for a base Mac mini, not average FPS here). Summon↔
  dismiss crossflow intact (visibility flips while content alpha ≈ 0 → no pop-in).

### PART 9 — Close-out 🟢 DONE
- `npm run audit` → **18/18 PASS** (FLUIDITY-AUDIT-v2.md regenerated); none of PART
  3–8 regressed doctrine-11 (ceremony 0.016, bank/quench 0.02, ring reactivity 0.038,
  summon 0.049). Report Night II section written; all parts committed + pushed.
- **Not done / deferred this run:** none of PART 3–9 were blocked. The one carry-over
  is the PART 5 geo-registration limitation above (sites vs real topo) — a design
  decision for the operator, not a bug.

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


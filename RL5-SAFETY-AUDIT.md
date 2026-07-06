# RL-5 v2 — SAFETY + MAP REBUILD · AUDIT

Fix, don't polish. One section per part; each part is audited against its own
acceptance criteria, then committed + pushed on its own.

---

## PART 1 — SYSTEM SAFETY  ✅

**The failure:** the resident overlay is a full-screen, always-on-top,
`screen-saver`-level panel. When the renderer hung while it was up, nothing was
reachable and the operator's Mac read as **frozen**. Root cause: every escape
(Esc → bank) routed *through the renderer*, so a wedged renderer had no way out.

**The fix — three renderer-independent escape hatches, all handled in `main`:**

| # | Requirement | Implementation | Where |
|---|---|---|---|
| 1 | Overlay must NEVER trap system input — drop window level as needed | `forceHide()` drops `setAlwaysOnTop(false)` + hides straight from main, so a zombie/hung window can't stay above the OS | `electron/main.js` `forceHide()` |
| 2 | All windows always escapable | Esc (graceful bank) **and** the emergency hotkey **and** the watchdog **and** tray Quit — Esc routes through the renderer, the other three bypass it | `main.js` |
| 3 | Global emergency hotkey (Cmd+Shift+Esc) force-hides everything instantly | `globalShortcut.register('CommandOrControl+Shift+Escape', forceHide)`, registered for the whole app lifetime, handled entirely in main (works even with a fully wedged renderer) | `main.js` whenReady |
| 4 | Watchdog auto-hides overlay if renderer hangs >2s | Heartbeat: main `wd:ping` → preload pongs on the renderer main thread; a hung thread can't pong, so >2000 ms of silence → `forceHide('watchdog')`. Armed only while visible | `main.js` `startWatchdog()`, `preload.cjs` |
| 5 | Open-at-login OFF by default (tray toggle remains) | Removed the auto-enable. One-time migration turns the prior forced-ON setting back OFF (marker-guarded so a later tray opt-in is respected). Tray checkbox unchanged | `main.js` whenReady |

**Why bypass-the-renderer matters:** `globalShortcut` and the watchdog interval
both run in the **main** process. The reported freeze is a *renderer* hang (heavy
WebGL / GC / shader-compile stall — see PART 3); main stays alive and can always
hide the window. If main itself were to hang, the window would still be gone on
process exit, and tray Quit / OS force-quit remain.

**Verification:**
- `node --check` on `main.js` (ESM) + `preload.cjs` — pass.
- `npm run build:web` — renderer builds with the `onForceHide` snap-to-hidden hook.
- `npm run audit` (fluidity regression harness) — **PASS, 18/18**, no transition
  regressed.
- Force-hide path re-read: `forceHide` stops the watchdog, releases the Esc grab,
  drops always-on-top, hides, and signals a responsive renderer to snap
  `presence=0 / ignMode='hidden'` so the next summon ignites clean.

**Known tradeoff (handed to PART 3):** the 2 s watchdog will also fire if a
*legitimate* first-summon shader compile blocks the main thread past 2 s. That is
the safe response (operator never trapped); PART 3 removes the underlying stall so
it won't trip in normal use.

---

## PART 2 — MIC COEXISTENCE  ✅

**The failure:** VULCAN's always-on wake listener broke the operator's Wispr Flow
dictation. Root cause: `getUserMedia({ echoCancellation:true, noiseSuppression:true })`.
On macOS those constraints route capture through Apple's **Voice-Processing I/O
unit (VPIO)**, which reconfigures the *shared* input device (sample rate, ducking,
exclusive-ish grab) and starves other capture clients. VULCAN holding the mic open
continuously then means no other app can dictate.

**The fix:**

| # | Requirement | Implementation |
|---|---|---|
| 1 | Shared, non-exclusive capture | Capture constraints now ship from `tokens.voice.capture` with `echoCancellation / noiseSuppression / autoGainControl = false` → plain shared HAL input, no VPIO. VAD + whisper don't need the processing. `src/voice/ears.js` reads the token |
| 2 | Fully releases the device on mute (M) | `setMuted(true)` now calls `ears.suspend()` in **any** state (was: only while listening-for-wake). `suspend()` aborts a pending wake **or** capture, stops all tracks, and closes the audio graph — the OS mic indicator goes off immediately. TTS already in flight still finishes (mute is input, not output). The loop re-parks cleanly (`if (muted) continue` after capture) |
| 3 | Never blocks other apps' dictation | Direct consequence of #1 — no VPIO means the mic is shared; other apps capture concurrently |

**Verification:**
- `npm run build:web` clean · `npm run audit` — **PASS 18/18** (mute-toggle flag included).
- Real-Chromium capture check (`--use-fake-device-for-media-stream`) driving the
  **exact tokenized constraints**: effective track settings report
  `echoCancellation=false, noiseSuppression=false, autoGainControl=false` →
  **no voice-processing engaged (PASS)**; `track.readyState === 'ended'` after
  `stop()` → **device released**.

**Operator-side confirmation (needs the real device — cannot be automated here):**
with VULCAN resident and listening, start Wispr Flow dictation → it should now
capture normally; press **M** in VULCAN → mic indicator drops instantly. The VPIO
root cause is removed, so this is expected to pass; please confirm on the Mac.

---

## PART 3 — PACKAGED-APP PERFORMANCE / GLITCH HUNT  ✅

**Method:** profiled the **packaged .app** (not dev) by launching the binary with
`--remote-debugging-port` and attaching over CDP (`scripts/profile-packaged.mjs`),
driving every state, and sampling real per-frame times.

**The finding (before):** the app was pinned to **~23 ms/frame (~42 fps) in EVERY
state** — a flat floor, not state-dependent spikes. Root cause: the full-screen
post chain (UnrealBloom multi-pass + grade + output) running at **devicePixelRatio
= 2** on the Retina/4K display — 4× the pixels through the most expensive passes,
every frame. Occasional 40–70 ms spikes came from per-frame DOM churn (`paintHud`
at 60 Hz, a per-frame `JSON.stringify` of the wire feed, constant style writes).

**The fixes (all token-driven, `tokens.perf.*`):**
1. **Cap render resolution** — `maxPixelRatio 1.5` (was uncapped→2). Fewer pixels
   through every pass; visually indistinguishable at this scale (screenshots).
2. **Adaptive resolution governor** — watches a rolling median frame time and scales
   render resolution between `minRenderScale`(0.66)…1 to hold `budgetMs`, recovering
   when there's headroom. This is the "degrade gracefully" path for heavier
   hardware/scenes. (It settled at scale 1.0 here — the 1.5 cap alone met budget.)
3. **Throttle HUD + feed DOM writes** to `hudHz` (6 Hz) instead of 60; drop the
   per-frame `JSON.stringify`; write ceremony-title / void-floor / chrome-gate styles
   **only when they change** (constant at rest). Kills the GC spikes.
4. **Boot-time shader warmup** (`renderer.compile`) so the first summon of any scene
   never stalls mid-ceremony (a stall would also trip the PART-1 watchdog).
5. **`perf()` probe** on `window.__vulcanHome` (frame-time percentiles + governor
   state) for this evidence and future audits.

**Evidence — packaged before/after (median frame time / worst-case):**

| State | BEFORE p50 | BEFORE p99 / max | AFTER p50 | AFTER p99 / max |
|---|---|---|---|---|
| ignition+resolve | 23.1 | 25.4 / 26.3 | **16.6** | 18.7 / 18.8 |
| idle | 23.1 | 31.1 / 69.1 | **16.6** | 18.5 / 18.8 |
| listening | 24.3 | 29.4 / 30.3 | **16.6** | 18.5 / 18.8 |
| thinking | 23.0 | **40.0 / 58.8** | **16.7** | 18.1 / 18.3 |
| speaking | 23.1 | 29.7 / **70.7** | **16.6** | 18.5 / 18.5 |
| summon-taiwan | 23.0 | 25.8 / 26.3 | **16.6** | 18.2 / 35.4¹ |
| theater-idle | 23.1 | 29.2 / 29.2 | **16.6** | 18.7 / 18.8 |
| wire-event | 23.8 | 31.5 / 33.1 | **16.7** | 18.5 / 18.8 |
| return-home | 22.9 | 26.9 / 27.7 | **16.7** | 18.1 / 18.4 |

- **Every state now vsync-locks at 16.67 ms = 60 fps** (was ~42 fps everywhere).
- Frames > 33 ms across the whole run: **5 → 1**. ¹the lone 35 ms is a single
  terrain-upload frame on first summon.
- Governor confirmed at `dpr 1.5 · renderScale 1 · 59.9 fps` idle & theater;
  screenshots `p3-after-idle.jpeg` / `p3-after-taiwan.jpeg` show no visual
  regression (wave-rings, particle field, site markers, HUD all intact).

**Fluidity regression:** `npm run audit` — **PASS 18/18** with all perf changes in.

---

## PART 4 — MAP REBUILD  ⟲ CANCELLED → replaced by v1.4 COMMAND CENTER PIVOT

Mid-campaign the operator issued a foundation change order (**SPEC v1.4 "COMMAND
CENTER PIVOT"**). PART 4 (map rebuild) is **cancelled** — the whole scene library
(map, device/schematic, graph, timeline) is **deferred to v3**, dormant in-tree.
Delivered instead:

| # | v1.4 requirement | Implementation |
|---|---|---|
| 1 | Mission = retrieval + presentation, not generation | Written into `CLAUDE.md` (v1.4 amendment block + current-state line) |
| 2 | Panels = primary answer surface, arbitrary content, summoned programmatically | `panels.present({eyebrow,title,rows,list,body})` in `src/map/panels.js` — untethered free panel, blueprint chrome + per-glyph resolve; exposed as `window.__vulcanHome.present()`. Exempt from the leaving-theater auto-close |
| 3 | Scene keys off the HUD legend (dev-only, undocumented) | `index.html` legend reduced to `M MUTE · P PROFILE`; scene shortcuts still work as dev overrides |
| 4 | Verify with one test panel from a static fixture | `data/present-fixture.json` + `presentTest()`; `scripts/verify-present.mjs` asserts DOM (title/eyebrow/4 rows/3 list items/body, 414/414 glyphs resolved), survives at home, toggles closed — **PASS**. Screenshot `v14-present-panel.jpeg` |
| 5 | Identity layer unchanged and protected | Orb / ignition-quench / wire heat / V.A.U.L.T / voice loop untouched; fluidity audit **PASS 18/18** |

**Safety/perf items (PARTS 1–3) were already complete before the pivot** and remain
in force.

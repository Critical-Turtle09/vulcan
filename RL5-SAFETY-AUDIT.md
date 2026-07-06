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

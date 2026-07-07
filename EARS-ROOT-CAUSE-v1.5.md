# S1 THE ATTENDANT — real-ears re-summon bug · ROOT CAUSE

**Operator report (live mic):** after one completed exchange, re-summon fails —
even after "Bank the fire." The prior harness passed because it used test-mode
ears (a `setTimeout` auto-wake) that bypassed the true wake path.

## Root cause (plainly)

**The ears hold ONE capture graph for the whole app lifetime; the first TTS
playback silently kills it, and nothing ever rebuilds it.**

Concretely, in `src/voice/ears.js` (live mode):

1. `init()` builds the capture graph **once** — `getUserMedia` stream →
   `AudioContext` → `ScriptProcessorNode` (`proc`) — and then short-circuits
   forever after on `if (ready) return true`. The only thing that tears it down
   is `suspend()`, which is called **only on mute**. So across a normal
   wake → capture → think → speak cycle the graph is never rebuilt; the loop
   re-arms `listenForWake()` on the **same** long-lived `proc`.

2. The mouth (`src/voice/mouth.js`) plays TTS through its **own, separate**
   `AudioContext` (`ensureCtx()` → `analyser` → `destination`).

3. On macOS, the first time the mouth opens that output context and plays audio,
   the shared Core Audio (HAL) device **reconfigures** — the same class of
   shared-device disturbance the codebase already fought in RL-5 v2 · PART 2
   (mic coexistence). That reconfiguration silently **stalls the ears'
   already-open `ScriptProcessorNode`**: `onaudioprocess` stops delivering
   frames. The mic stream object still exists, so `init()`'s `ready` guard keeps
   returning `true` — but no audio ever reaches the VAD/whisper path again.

So exchange 1 works end-to-end (wake → capture → answer). The **act of speaking
the answer is exactly what deafens the ear.** Every wake after that — including
after "Bank the fire," because banking only hides the window and re-arms the
same dead `listenForWake()` — is never heard. `backgroundThrottling:false` is
already set (`electron/main.js`), so this is **not** a hidden-window context
suspend; the trigger is the first playback, not the hide. That's why it dies
after *one* exchange specifically.

**Why it shipped:** `verify-ears.mjs` and every prior voice drill ran with
`VULCAN_VOICE_TEST=1` → test-mode ears, whose `listenForWake()`/`capture()` are
`setTimeout` timers. They never call `getUserMedia`, never open an
`AudioContext`, never run whisper, and never interact with the mouth's output
device — so the entire real capture lifecycle (and this failure mode) was
invisible to CI.

## Fix (S1) — robust to the exact HAL mechanism

1. **Re-acquire a clean capture graph each listen** (`voice.session.reacquireEars`).
   Tear down and rebuild stream + ctx + `proc` for each wake-listen and each
   capture, so a stalled / device-reconfigured graph is always replaced by a
   live one. Never trust one long-lived stream.
2. **Hard speak-gate.** Fully close the ears graph **before** the mouth speaks
   and re-acquire only after **true** playback completion (`onended` /
   gate-watchdog) plus a short `speakGateSettleMs`. This prevents self-hear AND
   moves the device reconfiguration to a moment when the ear is intentionally
   closed — it re-opens fresh afterward, so the race is gone.
3. **Hot ATTENTIVE session** (v1.5). No re-wake between exchanges: capture →
   conduct → speak → back to capture, each capture re-acquiring the mic. Re-arm
   never depends on a stale graph, and DORMANT wake re-acquires the same way.

// Bridge — the only surface the renderer sees into the main process. Exposes the
// two native capabilities (whisper transcription, ElevenLabs TTS) plus config.
// contextIsolation stays on; no Node reaches the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vulcan', {
  config: () => ipcRenderer.invoke('voice:config'),
  tts: (text) => ipcRenderer.invoke('voice:tts', text),
  transcribe: (wavBase64) => ipcRenderer.invoke('voice:transcribe', wavBase64),
  // ORGAN: THE WIRE — poll the active profile's RSS feeds (main-side, keyless)
  wirePoll: (feeds) => ipcRenderer.invoke('wire:poll', feeds),
  // ORGAN: QUOTES — poll the active profile's symbols (main-side, keyless)
  quotePoll: (symbols) => ipcRenderer.invoke('quotes:poll', symbols),
  // PART 6 — LOCAL REFLEXES: classify a short utterance via local Ollama
  reflex: (text, cfg) => ipcRenderer.invoke('reflex:classify', text, cfg),
  // B1 SYNAPSE — the conductor. Transcript in, rendered result out. The renderer
  // never sees the key or the ledger; both live entirely main-side.
  conduct: (text) => ipcRenderer.invoke('brain:conduct', text),
  confirm: (payload) => ipcRenderer.invoke('brain:confirm', payload),   // B2 — resolve a WRITE_CONFIRM
  testWrite: () => ipcRenderer.invoke('brain:test-write'),   // fire the mock WRITE action
  brainMode: () => ipcRenderer.invoke('brain:mode'),
  onSpeak: (cb) => ipcRenderer.on('brain:speak', (_e, text) => cb(text)),  // announce → voice
  // STAGE D — THE IGNITION (resident overlay control)
  requestSummon: () => ipcRenderer.send('ui:request-summon'), // wake-from-hidden -> summon + ignite
  requestShow: () => ipcRenderer.send('ui:request-show'),   // legacy alias
  requestHide: () => ipcRenderer.send('ui:request-hide'),   // bank complete -> hide
  onIgnite: (cb) => ipcRenderer.on('ui:ignite', () => cb()),
  onBank: (cb) => ipcRenderer.on('ui:bank', () => cb()),
  onMute: (cb) => ipcRenderer.on('ui:mute', () => cb()),
  onBackdrop: (cb) => ipcRenderer.on('ui:backdrop', (_e, url) => cb(url)),  // §1a active-display snapshot
  // RL-5 v2 · PART 1 — SAFETY. Main force-hid the overlay (emergency hotkey or the
  // watchdog); a responsive renderer snaps to its hidden state for a clean next summon.
  onForceHide: (cb) => ipcRenderer.on('ui:force-hide', () => cb()),
});

// PART 1 — WATCHDOG heartbeat. Main pings; we pong on the renderer's main thread. If
// the renderer is wedged this handler cannot run, so no pong arrives and main
// force-hides the overlay (>2s) — the operator is never trapped behind a frozen
// window. Registered outside the bridge so it needs no renderer-side wiring.
ipcRenderer.on('wd:ping', () => { try { ipcRenderer.send('wd:pong'); } catch (_) {} });

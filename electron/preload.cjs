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
  // STAGE D — THE IGNITION (resident overlay control)
  requestShow: () => ipcRenderer.send('ui:request-show'),   // wake-from-hidden
  requestHide: () => ipcRenderer.send('ui:request-hide'),   // bank complete -> hide
  onIgnite: (cb) => ipcRenderer.on('ui:ignite', () => cb()),
  onBank: (cb) => ipcRenderer.on('ui:bank', () => cb()),
  onMute: (cb) => ipcRenderer.on('ui:mute', () => cb()),
});

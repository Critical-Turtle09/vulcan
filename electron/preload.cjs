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
});

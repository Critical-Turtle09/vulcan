// Main-process side of ORGAN 1: loads .env (no dependency), and registers IPC
// handlers for the two capabilities the renderer can't reach — whisper.cpp
// transcription and ElevenLabs TTS. Both fail soft: a missing key/binary returns
// { ok:false } and the renderer degrades to VOICE OFFLINE.
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

// --- tiny .env loader (KEY=VALUE, # comments) — no external dep ---
export function loadEnv(root) {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val;
  }
}

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // stock ElevenLabs voice

// ORGAN 1.5 — TTS PROVIDER ABSTRACTION with auto-failover (voice.providerChain):
// elevenlabs (cloud) -> kokoro (local, if KOKORO_BIN configured) -> say (macOS,
// always available). Every provider returns WAV/MP3 base64 the renderer plays
// through the SAME analyser, so the envelope drives the orb + rings identically.
const kokoroAvailable = () => !!(process.env.KOKORO_BIN && fs.existsSync(process.env.KOKORO_BIN));

async function ttsElevenLabs(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.4, similarity_boost: 0.7 } }),
    });
    if (!res.ok) return null;   // quota / auth / rate -> fail over to local
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, audioBase64: buf.toString('base64'), mime: 'audio/mpeg', provider: 'elevenlabs', local: false };
  } catch (_) { return null; }   // network down -> fail over
}

// kokoro-onnx style local CLI: `$KOKORO_BIN "text" -o out.wav`. Scaffolded — slots
// in when a KOKORO_BIN is configured (not installed here; Python 3.9 < kokoro 3.10).
async function ttsKokoro(text) {
  const bin = process.env.KOKORO_BIN;
  if (!bin || !fs.existsSync(bin)) return null;
  const out = path.join(os.tmpdir(), `vulcan-kokoro-${process.pid}-${Date.now()}.wav`);
  try {
    await new Promise((resolve, reject) => {
      const p = spawn(bin, [text, '-o', out]); let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('close', (c) => (c === 0 && fs.existsSync(out)) ? resolve() : reject(new Error(err || `kokoro-${c}`)));
    });
    const b64 = fs.readFileSync(out).toString('base64'); fs.rmSync(out, { force: true });
    return { ok: true, audioBase64: b64, mime: 'audio/wav', provider: 'kokoro', local: true };
  } catch (_) { try { fs.rmSync(out, { force: true }); } catch (__) {} return null; }
}

// macOS `say` — the always-available tested local fallback (WAV, Chromium-decodable)
async function ttsSay(text) {
  if (process.platform !== 'darwin') return null;
  const out = path.join(os.tmpdir(), `vulcan-say-${process.pid}-${Date.now()}.wav`);
  try {
    await new Promise((resolve, reject) => {
      const p = spawn('say', ['--file-format=WAVE', '--data-format=LEI16@22050', '-o', out, text]); let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('close', (c) => (c === 0 && fs.existsSync(out)) ? resolve() : reject(new Error(err || `say-${c}`)));
    });
    const b64 = fs.readFileSync(out).toString('base64'); fs.rmSync(out, { force: true });
    return { ok: true, audioBase64: b64, mime: 'audio/wav', provider: 'say', local: true };
  } catch (_) { try { fs.rmSync(out, { force: true }); } catch (__) {} return null; }
}

const PROVIDERS = { elevenlabs: ttsElevenLabs, kokoro: ttsKokoro, say: ttsSay };

export function registerVoiceIpc() {
  ipcMain.handle('voice:config', () => ({
    hasKey: !!process.env.ELEVENLABS_API_KEY,
    hasWhisper: !!(process.env.WHISPER_BIN && process.env.WHISPER_MODEL
      && fs.existsSync(process.env.WHISPER_BIN) && fs.existsSync(process.env.WHISPER_MODEL)),
    providers: { elevenlabs: !!process.env.ELEVENLABS_API_KEY, kokoro: kokoroAvailable(), say: process.platform === 'darwin' },
    testMode: process.env.VULCAN_VOICE_TEST === '1',
  }));

  // chain: env VULCAN_TTS_PROVIDER forces one; else voice.providerChain order.
  ipcMain.handle('voice:tts', async (_e, text) => {
    let chain = ['elevenlabs', 'kokoro', 'say'];
    const forced = process.env.VULCAN_TTS_PROVIDER;
    if (forced && PROVIDERS[forced]) chain = [forced];
    for (const name of chain) {
      const fn = PROVIDERS[name]; if (!fn) continue;
      const r = await fn(text);
      if (r && r.ok) return r;
    }
    return { ok: false, reason: 'no-provider' };
  });

  // PART 6 — LOCAL REFLEXES: classify a short utterance into an intent via a small
  // local Ollama model. Fail-soft: no server / timeout / bad JSON -> null (the
  // renderer's regex layer already handled the common cases first).
  ipcMain.handle('reflex:classify', async (_e, text, cfg) => {
    const url = (cfg && cfg.url) || 'http://localhost:11434';
    const model = (cfg && cfg.model) || 'llama3.2:1b';
    const timeoutMs = (cfg && cfg.timeoutMs) || 2500;
    const sys = 'Route a terminal operator\'s short command into ONE intent. '
      + 'Reply ONLY compact JSON {"type":"...","arg":...}. '
      + 'type is exactly one of: mute, unmute, bank, summon, status, profile, explode, assemble, none. '
      + 'For summon, arg is one of taiwan, eu, namerica, korea, schematic, or null; otherwise arg is null. '
      + 'Not a short command -> {"type":"none","arg":null}. Examples: '
      + '"quiet down" -> {"type":"mute","arg":null}; '
      + '"pull up korea" -> {"type":"summon","arg":"korea"}; '
      + '"show me the gpu" -> {"type":"summon","arg":"schematic"}; '
      + '"stand down" -> {"type":"bank","arg":null}; '
      + '"how are we doing" -> {"type":"status","arg":null}; '
      + '"tell me a joke" -> {"type":"none","arg":null}.';
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${url}/api/generate`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, system: sys, prompt: text, stream: false, format: 'json', options: { temperature: 0 } }),
      });
      clearTimeout(to);
      if (!res.ok) return null;
      const j = await res.json();
      const parsed = JSON.parse(j.response || '{}');
      if (!parsed || !parsed.type) return null;
      return { type: parsed.type, arg: parsed.arg ?? null };
    } catch (_) { return null; }
  });

  ipcMain.handle('voice:transcribe', async (_e, wavBase64) => {
    const bin = process.env.WHISPER_BIN, model = process.env.WHISPER_MODEL;
    if (!bin || !model) return { ok: false, reason: 'no-whisper' };
    try {
      const tmp = path.join(os.tmpdir(), `vulcan-${process.pid}-${Date.now()}.wav`);
      fs.writeFileSync(tmp, Buffer.from(wavBase64, 'base64'));
      const text = await new Promise((resolve, reject) => {
        const p = spawn(bin, ['-m', model, '-f', tmp, '-nt', '-otxt', '-of', tmp]);
        let err = '';
        p.stderr.on('data', (d) => { err += d; });
        p.on('close', (code) => {
          try {
            const out = fs.existsSync(`${tmp}.txt`) ? fs.readFileSync(`${tmp}.txt`, 'utf8') : '';
            fs.rmSync(tmp, { force: true }); fs.rmSync(`${tmp}.txt`, { force: true });
            code === 0 ? resolve(out.trim()) : reject(new Error(err || `whisper-${code}`));
          } catch (e) { reject(e); }
        });
      });
      return { ok: true, text };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e) };
    }
  });
}

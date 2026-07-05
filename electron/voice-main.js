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

export function registerVoiceIpc() {
  ipcMain.handle('voice:config', () => ({
    hasKey: !!process.env.ELEVENLABS_API_KEY,
    hasWhisper: !!(process.env.WHISPER_BIN && process.env.WHISPER_MODEL
      && fs.existsSync(process.env.WHISPER_BIN) && fs.existsSync(process.env.WHISPER_MODEL)),
    testMode: process.env.VULCAN_VOICE_TEST === '1',
  }));

  ipcMain.handle('voice:tts', async (_e, text) => {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return { ok: false, reason: 'no-key' };
    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.4, similarity_boost: 0.7 } }),
      });
      if (!res.ok) return { ok: false, reason: `http-${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true, audioBase64: buf.toString('base64'), mime: 'audio/mpeg' };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e) };
    }
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

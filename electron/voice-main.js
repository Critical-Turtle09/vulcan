// Main-process side of ORGAN 1: loads .env (no dependency), and registers IPC
// handlers for the two capabilities the renderer can't reach — whisper.cpp
// transcription and ElevenLabs TTS. Both fail soft: a missing key/binary returns
// { ok:false } and the renderer degrades to VOICE OFFLINE.
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
// SLICE V — THE VOICE. The mouth engine (fail-soft chain + meter + cache) lives in
// one place; this main-process handler is a thin bridge to it. No parallel path.
import { synthesize, availability, prewarm } from '../brain/voice.js';
// S2 THE TRIGGER — the ears engine (Wispr Flow REST primary -> local whisper fallback).
import { transcribeChain, hasWispr } from '../brain/ears.js';

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

// P1.1 — packaged env resolution. Overlay a SECOND .env whose values OVERRIDE any
// already-loaded ones. In the packaged app the operator's keys live in a writable,
// per-user location (app.getPath('userData')/.env) that survives a reinstall and is
// NOT baked into the distributable — so the bundle's .env is only a fallback, and
// SET TOKEN writes land somewhere durable. `file` absent/missing is a silent no-op.
export function loadEnvOverride(file) {
  if (!file || !fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');   // override, last-write-wins
  }
}

export function registerVoiceIpc() {
  ipcMain.handle('voice:config', () => {
    const hasWhisper = !!(process.env.WHISPER_BIN && process.env.WHISPER_MODEL
      && fs.existsSync(process.env.WHISPER_BIN) && fs.existsSync(process.env.WHISPER_MODEL));
    return {
      hasKey: !!process.env.ELEVENLABS_API_KEY,
      hasWhisper,
      // S2 — an ear exists if EITHER the Wispr key OR local whisper is present. The voice
      // loop needs an ear to go live; the ears chain resolves which one per clip.
      hasWispr: hasWispr(),
      hasEars: hasWispr() || hasWhisper,
      providers: availability(),   // SLICE V — engine's own tier detection (elevenlabs/kokoro/say)
      testMode: process.env.VULCAN_VOICE_TEST === '1',
    };
  });

  // SLICE V — THE VOICE. Delegate to the mouth engine: fail-soft chain, char meter,
  // phrase cache, budget. Returns { ok, audioBase64, mime, provider, chars, cached,
  // latencyMs }. `local` is derived for the renderer's status read. Optional kind
  // (answer|announce|confirm) is intent/log only — the local chain guarantees
  // announce/confirm always speak regardless of budget.
  ipcMain.handle('voice:tts', async (_e, text, kind = 'answer') => {
    const r = await synthesize(text, { kind });
    if (r && r.ok) return { ...r, local: r.provider !== 'elevenlabs' };
    return r || { ok: false, reason: 'no-provider' };
  });

  // Pre-warm fixed announcements into the VULCAN-voice cache on startup (fire and
  // forget — never blocks app launch; failures leave phrases to speak locally).
  prewarm().catch(() => {});

  // PART 6 — LOCAL REFLEXES: classify a short utterance into an intent via a small
  // local Ollama model. Fail-soft: no server / timeout / bad JSON -> null (the
  // renderer's regex layer already handled the common cases first).
  ipcMain.handle('reflex:classify', async (_e, text, cfg) => {
    const url = (cfg && cfg.url) || 'http://localhost:11434';
    const model = (cfg && cfg.model) || 'llama3.2:1b';
    const timeoutMs = (cfg && cfg.timeoutMs) || 2500;
    // v1.5 MISSION PURITY · FX purge — LOCAL session controls ONLY. The semiconductor
    // scene intents (summon/region/schematic/explode/assemble/profile) are struck; the
    // renderer also rejects anything outside {mute,unmute,bank,status} and defers it to
    // the conductor's deterministic skill router. Keep this set in lockstep.
    const sys = 'Route a terminal operator\'s short command into ONE intent. '
      + 'Reply ONLY compact JSON {"type":"..."}. '
      + 'type is exactly one of: mute, unmute, bank, status, none. '
      + 'Anything that is not one of those (a question, a brief, a tag, a note, any other '
      + 'request) -> {"type":"none"}. Examples: '
      + '"quiet down" -> {"type":"mute"}; '
      + '"open the mic" -> {"type":"unmute"}; '
      + '"stand down" -> {"type":"bank"}; '
      + '"how are we doing" -> {"type":"status"}; '
      + '"mission brief" -> {"type":"none"}; '
      + '"tag the forge as v2 signed" -> {"type":"none"}; '
      + '"tell me a joke" -> {"type":"none"}.';
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

  // S2 THE TRIGGER — EARS CHAIN. Wispr Flow REST primary -> local whisper fallback.
  // The chain owns the decision + logging; this handler only supplies the local
  // whisper.cpp transcriber (main owns WHISPER_BIN/MODEL) and returns the result plus
  // { source, fellBack } so the renderer can tag [EARS·LOCAL] on a drop.
  ipcMain.handle('voice:transcribe', async (_e, wavBase64) => {
    return transcribeChain(wavBase64, { local: whisperLocal });
  });
}

// Local whisper.cpp transcription — the ears-chain fallback. { ok, text } only.
async function whisperLocal(wavBase64) {
  const bin = process.env.WHISPER_BIN, model = process.env.WHISPER_MODEL;
  if (!bin || !model) return { ok: false, reason: 'no-whisper' };
  try {
    const tmp = path.join(os.tmpdir(), `vulcan-${process.pid}-${Date.now()}.wav`);
    fs.writeFileSync(tmp, Buffer.from(wavBase64, 'base64'));
    const text = await new Promise((resolve, reject) => {
      // -np: no prints — whisper.cpp otherwise streams the recognized text to stdout,
      // which leaked raw transcripts into the drill tab. Result still goes to the -otxt file.
      const p = spawn(bin, ['-m', model, '-f', tmp, '-nt', '-np', '-otxt', '-of', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
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
}

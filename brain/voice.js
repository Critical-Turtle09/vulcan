// VULCAN v2 — SLICE V: THE VOICE — the mouth engine.
// The single implementation behind the renderer's voice.say()/announce interface.
// One speech path, reachable from the Electron `voice:tts` IPC handler AND from a
// headless verify harness (plain Node — no Electron), so drills produce transcripts.
//
// FAIL-SOFT CHAIN (never throws, never silent):
//   ElevenLabs "VULCAN 1" (cloud, metered) -> Kokoro bm_george (local, if KOKORO_BIN)
//   -> macOS `say` (local, always on darwin). Chain drops are LOGGED, never thrown.
//
// BUDGET: cloud TTS characters meter against the ~/.vulcan ledger (governor). Over
//   the daily cap, cloud is skipped and the LOCAL chain speaks — local voice is
//   never budget-gated, so announce + confirm (and every answer) always speak.
//
// PHRASE CACHE: ~/.vulcan/voice-cache keyed by hash(voice_id + text). Only the
//   cloud (VULCAN 1) voice is cached, so fixed announcements replay in the real
//   voice at ZERO character cost. Local output is already free and never cached
//   (caching it would lock in the wrong voice).
//
// The key is read from process.env.ELEVENLABS_API_KEY and NEVER logged.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadTokens } from './tokens.js';
import { meterTts, ttsCharsToday } from './governor.js';

const VULCAN_DIR = path.join(os.homedir(), '.vulcan');
const CACHE_DIR = path.join(VULCAN_DIR, 'voice-cache');
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';   // stock fallback if none configured

const log = (msg) => console.log(`[VOICE] ${msg}`);

// ---- config (from the merged token tree; voice id may fall back to env) -------
function voiceCfg() { const t = loadTokens(); return (t && t.voice) || {}; }
function resolveVoiceId(v) {
  return (v.id && String(v.id).trim()) || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}
function dailyCap(v) { return typeof v.daily_char_cap === 'number' ? v.daily_char_cap : 8000; }
function cacheOn(v) { return !(v.cache && v.cache.enabled === false); }
function kokoroBin() { const b = process.env.KOKORO_BIN; return b && fs.existsSync(b) ? b : null; }

// ---- phrase cache -------------------------------------------------------------
function cacheKey(voiceId, text) {
  return crypto.createHash('sha256').update(`${voiceId}\n${text}`).digest('hex').slice(0, 32);
}
function cachePaths(key) {
  return { audio: path.join(CACHE_DIR, `${key}.audio`), meta: path.join(CACHE_DIR, `${key}.json`) };
}
function readCache(key) {
  try {
    const { audio, meta } = cachePaths(key);
    if (!fs.existsSync(audio) || !fs.existsSync(meta)) return null;
    const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
    return { audioBase64: fs.readFileSync(audio).toString('base64'), mime: m.mime, provider: m.provider };
  } catch (_) { return null; }
}
function writeCache(key, audioBase64, mime, provider) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const { audio, meta } = cachePaths(key);
    fs.writeFileSync(audio, Buffer.from(audioBase64, 'base64'));
    fs.writeFileSync(meta, JSON.stringify({ mime, provider }));
  } catch (_) { /* cache is best-effort */ }
}

// ---- child-process runner -----------------------------------------------------
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args); let err = '';
    if (p.stderr) p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err.trim() || `${cmd} exit ${c}`))));
  });
}

// ---- providers (each returns { audioBase64, mime, provider } or null) ---------
async function elevenlabs(text, v) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const s = v.elevenlabs || {};
  // HARD TIMEOUT (offline hardening): bound the cloud TTS call so a black-hole network
  // fails over to the LOCAL chain (Kokoro → say) fast instead of stalling the mouth.
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolveVoiceId(v)}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: s.model_id || 'eleven_turbo_v2',
        voice_settings: {
          stability: s.stability ?? 0.4,
          similarity_boost: s.similarity_boost ?? 0.7,
          style: s.style ?? 0.0,
          use_speaker_boost: s.use_speaker_boost ?? true,
        },
      }),
    });
    if (!res.ok) { log(`elevenlabs http ${res.status} — failing over to local`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buf.toString('base64'), mime: 'audio/mpeg', provider: 'elevenlabs' };
  } catch (e) { log(`elevenlabs error (${e && e.message}) — failing over to local`); return null; }
  finally { clearTimeout(to); }
}

async function kokoro(text) {
  const bin = kokoroBin();
  if (!bin) return null;
  const out = path.join(os.tmpdir(), `vulcan-kokoro-${process.pid}-${Date.now()}.wav`);
  try {
    await run(bin, [text, '-o', out]);
    if (!fs.existsSync(out)) return null;
    const b64 = fs.readFileSync(out).toString('base64'); fs.rmSync(out, { force: true });
    return { audioBase64: b64, mime: 'audio/wav', provider: 'kokoro' };
  } catch (e) { try { fs.rmSync(out, { force: true }); } catch (_) {} log(`kokoro error (${e && e.message}) — failing over`); return null; }
}

async function macSay(text) {
  if (process.platform !== 'darwin') return null;
  const out = path.join(os.tmpdir(), `vulcan-say-${process.pid}-${Date.now()}.wav`);
  try {
    await run('say', ['--file-format=WAVE', '--data-format=LEI16@22050', '-o', out, text]);
    if (!fs.existsSync(out)) return null;
    const b64 = fs.readFileSync(out).toString('base64'); fs.rmSync(out, { force: true });
    return { audioBase64: b64, mime: 'audio/wav', provider: 'say' };
  } catch (e) { try { fs.rmSync(out, { force: true }); } catch (_) {} log(`say error (${e && e.message})`); return null; }
}

const PROV = { elevenlabs, kokoro, say: macSay };

// Which tiers can produce audio right now (for voice:config).
export function availability() {
  return { elevenlabs: !!process.env.ELEVENLABS_API_KEY, kokoro: !!kokoroBin(), say: process.platform === 'darwin' };
}

// ---- the mouth ----------------------------------------------------------------
// synthesize(text, { kind }) -> { ok, audioBase64, mime, provider, chars, cached,
//   latencyMs, kind } | { ok:false, reason }. kind ∈ answer|announce|confirm (log
//   + intent only — the local chain guarantees announce/confirm always speak).
export async function synthesize(text, { kind = 'answer' } = {}) {
  const t0 = Date.now();
  const clean = String(text || '').trim();
  if (!clean) return { ok: false, reason: 'empty' };
  const v = voiceCfg();
  const voiceId = resolveVoiceId(v);
  const chars = clean.length;
  const key = cacheOn(v) ? cacheKey(voiceId, clean) : null;

  // 1) CACHE HIT — the VULCAN voice, zero chars, zero network. Any budget, any kind.
  if (key) {
    const hit = readCache(key);
    if (hit) {
      log(`voice=${hit.provider} cached=true chars=0 latency=${Date.now() - t0}ms kind=${kind}`);
      return { ok: true, ...hit, chars: 0, cached: true, latencyMs: Date.now() - t0, kind };
    }
  }

  // 2) BUDGET — cloud only under the daily char cap. Over cap → LOCAL chain (never
  //    budget-gated), so announce/confirm/answers always speak. Nothing goes silent.
  const cap = dailyCap(v);
  const spent = ttsCharsToday();
  const underBudget = spent + chars <= cap;
  const chain = [];
  if (underBudget) chain.push('elevenlabs');
  else log(`char-cap reached (${spent}/${cap}) — local chain for kind=${kind}`);
  chain.push('kokoro', 'say');

  // env override forces a single provider (drills / ORGAN 1.5 compatibility).
  const forced = process.env.VULCAN_TTS_PROVIDER;
  const order = forced && PROV[forced] ? [forced] : chain;

  for (let i = 0; i < order.length; i++) {
    const name = order[i];
    const r = await PROV[name](clean, v);
    if (!r) { if (i < order.length - 1) log(`${name} unavailable — trying ${order[i + 1]}`); continue; }
    let metered = 0;
    if (name === 'elevenlabs') { metered = chars; meterTts(chars); }        // only cloud is metered
    if (key && name === 'elevenlabs') writeCache(key, r.audioBase64, r.mime, r.provider);   // cache the VULCAN voice only
    log(`voice=${r.provider} cached=false chars=${metered} latency=${Date.now() - t0}ms kind=${kind}`);
    return { ok: true, ...r, chars: metered, cached: false, latencyMs: Date.now() - t0, kind };
  }
  log(`no provider produced audio for kind=${kind} — VULCAN stays silent (should never happen on darwin)`);
  return { ok: false, reason: 'no-provider' };
}

// PRE-WARM fixed announcements into the cache in the VULCAN voice on first run, so
// they later replay at zero character cost. Best-effort: no key / over cap / cloud
// failure just leaves the phrase to speak locally each time (also zero char cost).
export async function prewarm() {
  const v = voiceCfg();
  const phrases = (Array.isArray(v.prewarm) ? v.prewarm : []).map((p) => String(p || '').trim()).filter(Boolean);
  if (!phrases.length) return { warmed: 0, skipped: 0 };
  if (!process.env.ELEVENLABS_API_KEY) {
    log(`prewarm skipped — no cloud key (${phrases.length} fixed phrase(s) speak locally, zero char cost)`);
    return { warmed: 0, skipped: phrases.length };
  }
  const voiceId = resolveVoiceId(v);
  const cap = dailyCap(v);
  let warmed = 0, skipped = 0;
  for (const clean of phrases) {
    const key = cacheKey(voiceId, clean);
    if (readCache(key)) { skipped++; continue; }                            // already warm
    if (ttsCharsToday() + clean.length > cap) { skipped++; continue; }      // don't blow the cap to warm
    const r = await elevenlabs(clean, v);
    if (r) { writeCache(key, r.audioBase64, r.mime, r.provider); meterTts(clean.length); warmed++; log(`prewarm cached "${clean}" (${clean.length} chars, one-time)`); }
    else skipped++;
  }
  return { warmed, skipped };
}

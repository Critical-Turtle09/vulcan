// VULCAN v2 — S2 THE TRIGGER: the ears engine (STT chain).
// The single implementation behind the renderer's bridge.transcribe(). One STT
// path, reachable from the Electron `voice:transcribe` IPC handler AND from a
// headless verify harness (plain Node — no Electron), so drills exercise the chain.
//
// FAIL-SOFT CHAIN (never throws, never silent):
//   Wispr Flow REST (cloud, VULCAN_WISPR_KEY) -> local whisper.cpp (WHISPER_BIN).
//   A drop is LOGGED and reported as { source:'local', fellBack:true } so the
//   renderer can tag panel chrome [EARS·LOCAL]; the transcript is never thrown.
//
//   - No VULCAN_WISPR_KEY        -> local is the primary (source:'local', fellBack:false)
//   - Wispr API error / offline  -> local fallback   (source:'local', fellBack:true)
//   - Wispr ok                   -> (source:'wispr')
//
// The key is read from process.env.VULCAN_WISPR_KEY and NEVER logged.
import { loadTokens } from './tokens.js';

const log = (msg) => console.log(`[EARS] ${msg}`);

function wisprCfg() {
  const t = loadTokens();
  const e = (t && t.voice && t.voice.ears) || {};
  return e.wispr || {};
}

export function hasWispr() { return !!process.env.VULCAN_WISPR_KEY; }

// POST a 16kHz-mono WAV (base64) to the Wispr Flow REST API. Resolves the transcript
// text on success; throws on any non-ok / network / timeout so the caller can drop to
// local. The key rides the Authorization header only — never argv, never logged.
export async function wisprTranscribe(wavBase64, { fetchImpl = fetch } = {}) {
  const key = process.env.VULCAN_WISPR_KEY;
  if (!key) throw new Error('no-wispr-key');
  const w = wisprCfg();
  const endpoint = w.endpoint || 'https://platform-api.wisprflow.ai/api/v1/dash/api';
  const language = Array.isArray(w.language) ? w.language : ['en'];
  const timeoutMs = w.timeoutMs || 8000;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        audio: wavBase64,
        language,
        // minimal context — VULCAN is a terminal, not an email box; empty textbox.
        context: { app: { type: 'other' }, dictionary_context: [], textbox_contents: { before_text: '', selected_text: '', after_text: '' } },
      }),
    });
    if (!res.ok) throw new Error(`wispr-http-${res.status}`);
    const j = await res.json();
    return typeof j.text === 'string' ? j.text.trim() : '';
  } finally {
    clearTimeout(to);
  }
}

// The chain. `local` is the caller-supplied local-whisper transcriber (main owns the
// WHISPER_BIN spawn); injectable `fetchImpl` keeps this unit-testable without network.
// Always resolves — a bare local failure returns { ok:false } but never throws.
export async function transcribeChain(wavBase64, { local, fetchImpl = fetch } = {}) {
  const runLocal = async (fellBack) => {
    try {
      const r = local ? await local(wavBase64) : { ok: false, reason: 'no-local' };
      return { ok: !!(r && r.ok), text: (r && r.text) || '', source: 'local', fellBack };
    } catch (e) {
      return { ok: false, text: '', source: 'local', fellBack, reason: String((e && e.message) || e) };
    }
  };
  if (!hasWispr()) return runLocal(false);            // no key -> local is primary, not a drop
  try {
    const text = await wisprTranscribe(wavBase64, { fetchImpl });
    return { ok: true, text, source: 'wispr', fellBack: false };
  } catch (e) {
    log(`wispr dropped (${String((e && e.message) || e)}) -> local`);   // logged, never thrown
    return runLocal(true);
  }
}

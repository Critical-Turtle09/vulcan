// VULCAN v2 CONDUCTOR — SLICE B0: the Anthropic Messages API client.
// Plain Node + native fetch (no SDK, no new deps). Fail-soft everywhere: a
// missing key or a network/API failure returns { banked:true, reason } rather
// than throwing, so the conductor can fall back to the local reflex path.
import { loadEnv } from './env.js';

// Model policy for the whole brain. ROUTER is the fast intent classifier wired
// in B1; SYNTH is the single answer path used by B0's conduct().
export const MODEL_POLICY = {
  ROUTER: 'claude-haiku-4-5-20251001',
  SYNTH: 'claude-sonnet-4-6',
};

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// The brain's wallet key. DELIBERATELY only VULCAN_ANTHROPIC_KEY — never
// ANTHROPIC_API_KEY, which is reserved so the Claude Code CLI never collides
// with (or spends) the brain's wallet. The key value is never logged or echoed.
function readKey() {
  loadEnv();
  return process.env.VULCAN_ANTHROPIC_KEY || '';
}

export function hasKey() {
  return !!readKey();
}

// Call the Messages API. On success returns
//   { text, model, input_tokens, output_tokens }
// parsed from the response usage block. On any failure returns
//   { banked:true, reason }   (reason: NO_KEY | OFFLINE | TIMEOUT | HTTP_<code>[_type] | BAD_JSON)
//
// HARD TIMEOUT (offline hardening — hotel/captive-portal): a black-hole network that
// accepts the connection but never answers would otherwise hang this fetch forever,
// freezing the conductor mid-dispatch. An AbortController bounds every call at
// `timeoutMs` (default 15s — ample for a real Sonnet answer, but never open-ended)
// and banks TIMEOUT so the caller degrades to the local reflex instead of wedging.
export async function ask({
  model = MODEL_POLICY.SYNTH,
  system,
  prompt,
  maxTokens = 1024,
  signal,
  timeoutMs = 15000,
} = {}) {
  const key = readKey();
  if (!key) return { banked: true, reason: 'NO_KEY' };

  // Own controller so we can enforce a deadline; forward an external abort into it too.
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (signal) { if (signal.aborted) ctrl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    // AbortError from our deadline → TIMEOUT; any other network failure → OFFLINE.
    const timedOut = (e && e.name === 'AbortError') && !(signal && signal.aborted);
    return { banked: true, reason: timedOut ? 'TIMEOUT' : 'OFFLINE' };
  } finally {
    clearTimeout(to);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    // Surface the API error TYPE (never headers — those carry the key).
    let type = '';
    try { type = (await res.json())?.error?.type || ''; } catch (_) { /* ignore */ }
    return { banked: true, reason: `HTTP_${res.status}${type ? `_${type}` : ''}` };
  }

  let j;
  try { j = await res.json(); } catch (_) { return { banked: true, reason: 'BAD_JSON' }; }

  const text = Array.isArray(j.content)
    ? j.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    : '';

  return {
    text,
    model: j.model || model,
    input_tokens: j.usage?.input_tokens ?? 0,
    output_tokens: j.usage?.output_tokens ?? 0,
  };
}

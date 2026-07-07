// VULCAN v2 CONDUCTOR — SLICE B0: the spine.
// conduct(text) routes a spoken/typed query: governor check → Claude (SYNTH) →
// charge the ledger. If the brain is banked (no key / cap / offline / API
// error) it falls back to the v1 local Ollama reflex and tags route:"REFLEX".
// Never crashes on network failure.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.js';
import { ask, MODEL_POLICY, hasKey } from './client.js';
import { allow, charge, status as ledgerStatus } from './governor.js';
import { route } from './router.js';   // B1 SYNAPSE — Haiku REFLEX/SYNTH classifier

// tokens.json drives the reflex endpoint (reflex.ollama.*), same as v1.
let rawTokens = {};
try {
  rawTokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8'));
} catch (_) { /* reflex uses defaults below */ }

const SYSTEM =
  'You are VULCAN, a command-center intelligence for GPU and semiconductor '
  + 'supply-chain operations. Answer tersely and factually in a retrieval-and-'
  + 'presentation voice: surface the fact, no filler, no preamble, no sign-off. '
  + 'If you do not know, say so plainly.';

// Local reflex fallback — the v1 Ollama endpoint. Terse local answer when the
// brain is banked or offline. Fail-soft: returns '' on any failure, never throws.
async function reflex(text) {
  const R = rawTokens.reflex || {};
  const url = R['ollama.url'] || 'http://localhost:11434';
  const model = R['ollama.model'] || 'llama3.2:1b';
  const timeoutMs = R['ollama.timeoutMs'] || 2500;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        system: SYSTEM,
        prompt: text,
        stream: false,
        options: { temperature: 0 },
      }),
    });
    clearTimeout(to);
    if (!res.ok) return '';
    const j = await res.json();
    return (j.response || '').trim();
  } catch (_) {
    return '';
  }
}

export async function conduct(text, { model = MODEL_POLICY.SYNTH } = {}) {
  const reflexModel = (rawTokens.reflex && rawTokens.reflex['ollama.model']) || 'ollama';

  const bank = async (reason) => {
    const answer = await reflex(text);
    return {
      text: answer || '(reflex offline — no local model reachable)',
      route: 'REFLEX',
      reason,
      model: reflexModel,
      cost_usd: 0,
      day_total_usd: ledgerStatus().total_usd,   // fresh — the router may have charged
    };
  };

  if (!hasKey()) return bank('NO_KEY');
  // Whole-answer budget gate FIRST — if a synthesis answer can't fit under the
  // cap we never even spend on the router (preserves the B0 cap drill exactly:
  // planted at $1.99 → REFLEX(CAP), ledger untouched).
  if (!allow(model)) return bank('CAP');

  // B1 SYNAPSE — the Haiku router decides REFLEX vs SYNTH before we spend on
  // synthesis. Trivial/greeting/offline-safe → local reflex.
  const decision = await route(text);
  if (decision === 'REFLEX') return bank('ROUTER');
  if (!allow(model)) return bank('CAP');    // router spend may have reached the cap

  const r = await ask({ model, system: SYSTEM, prompt: text });
  if (r.banked) return bank(r.reason);

  const { usd, total_usd } = charge(r.model, r.input_tokens, r.output_tokens);
  return {
    text: r.text,
    route: 'CLAUDE',
    model: r.model,
    input_tokens: r.input_tokens,
    output_tokens: r.output_tokens,
    cost_usd: usd,
    day_total_usd: total_usd,
  };
}

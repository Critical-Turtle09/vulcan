// VULCAN v2 CONDUCTOR — SLICE B1: the router.
// A cheap Haiku classifier that decides, per query, whether the answer needs
// real synthesis (SYNTH → sonnet, cloud) or is trivial/greeting/offline-safe
// (REFLEX → local Ollama). Governor-metered like every brain call. If the
// router itself is banked or errors, default to REFLEX (the cheap, local-safe
// side) — never spend on synthesis without a positive signal.
import { ask, MODEL_POLICY } from './client.js';
import { allow, charge } from './governor.js';

const ROUTER_SYSTEM =
  "You are VULCAN's router. Classify the operator's message into exactly one "
  + 'word. Reply SYNTH if answering needs knowledge, facts, reasoning, lookup, '
  + 'or synthesis. Reply REFLEX if it is a greeting, acknowledgement, small '
  + 'talk, or a trivial question answerable without any lookup. Output ONLY the '
  + 'single word SYNTH or REFLEX — nothing else.';

// Returns 'REFLEX' | 'SYNTH'. Charges the (tiny) Haiku call on success.
export async function route(text) {
  const model = MODEL_POLICY.ROUTER;
  if (!allow(model, 64)) return 'REFLEX';           // no budget for the router → local
  const r = await ask({ model, system: ROUTER_SYSTEM, prompt: text, maxTokens: 4 });
  if (r.banked) return 'REFLEX';                     // no key / offline / API error → local
  charge(r.model, r.input_tokens, r.output_tokens);
  return /synth/i.test(r.text) ? 'SYNTH' : 'REFLEX';
}

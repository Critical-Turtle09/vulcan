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
import { matchSkill, actionPrompt } from './skills/index.js';   // B2 HANDS — skills
import { execute, getMode, actionClass } from './constitution.js';

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

const logAnnounce = (t) => console.log(`[ANNOUNCE] ${t}`);

// B2 HANDS — run a matched skill action through the constitution and shape the
// result for the conductor: a blueprint panel ({title, lines}) + a one-line
// spoken summary. READS are free and silent.
async function runSkill(m, { confirm = null, announce = logAnnounce } = {}) {
  const klass = actionClass(m.action);
  const base = { route: 'SKILL', skill: m.skillId, action: m.action, cost_usd: 0, day_total_usd: ledgerStatus().total_usd };

  if (klass === 'READ') {
    const r = await execute(m.action, m.detail, { announce: () => {} });   // silent + free
    const res = r.result || {};
    return { ...base, text: res.speak || '', panel: { title: res.title, lines: res.lines } };
  }

  // WRITE / WRITE_CONFIRM in AWAY → queue to the report, never execute.
  if (getMode() === 'AWAY') {
    await execute(m.action, m.detail, { announce });
    return { ...base, queued: true, text: 'Away mode — queued to the report. Nothing left the machine.', panel: { title: 'REPO · QUEUED', lines: ['AWAY MODE', `${m.action} — QUEUED, NOT EXECUTED`] } };
  }

  if (klass === 'WRITE') {
    const r = await execute(m.action, m.detail, { announce });
    const res = r.result || {};
    return { ...base, text: res.speak || 'Done.', panel: { title: res.title, lines: res.lines } };
  }

  // WRITE_CONFIRM in PRESENT — with an inline decision (CLI/harness) resolve now;
  // otherwise return a needsConfirm result for the voice loop to speak + capture.
  if (confirm === 'confirm' || confirm === 'cancel') {
    return resolveConfirm({ skill: m.skillId, action: m.action, detail: m.detail, decision: confirm }, { announce });
  }
  const prompt = actionPrompt(m.skillId, m.action, m.detail);
  return { ...base, needsConfirm: true, detail: m.detail, confirmPrompt: prompt, text: prompt, panel: { title: 'REPO · CONFIRM', lines: [prompt] } };
}

// Resolve a WRITE_CONFIRM once the operator's spoken decision is known. The
// constitution enforces the gate — the action runs ONLY on 'confirm'. Re-checks
// AWAY (mode may have flipped between prompt and decision) → queue, never execute.
export async function resolveConfirm({ skill, action, detail, decision }, { announce = logAnnounce } = {}) {
  const base = { route: 'SKILL', skill, action, cost_usd: 0, day_total_usd: ledgerStatus().total_usd };
  if (getMode() === 'AWAY') {
    await execute(action, detail, { announce });
    return { ...base, queued: true, aborted: true, text: 'Away mode — queued to the report. Nothing left the machine.', panel: { title: 'REPO · TAG', lines: ['AWAY MODE', 'QUEUED — NOT EXECUTED'] } };
  }
  const r = await execute(action, detail, { announce, confirm: async () => (decision === 'confirm' ? 'confirm' : 'cancel') });
  if (r.confirmed) {
    const res = r.result || {};
    return { ...base, confirmed: true, text: res.speak || 'Done.', panel: { title: res.title, lines: res.lines } };
  }
  return { ...base, confirmed: false, aborted: true, text: 'Cancelled. No tag was created; nothing left the machine.', panel: { title: 'REPO · TAG', lines: ['CANCELLED', 'NO TAG CREATED'] } };
}

export async function conduct(text, { model = MODEL_POLICY.SYNTH, confirm = null, tag = null } = {}) {
  // B2 HANDS — deterministic skill match FIRST: local, no Anthropic key, no
  // router tokens. This is the ONLY path that can execute a WRITE_CONFIRM.
  const m = matchSkill(text);
  if (m) {
    if (tag && m.action === 'repo.tag') m.detail = { ...m.detail, tag };   // explicit tag override
    return runSkill(m, { confirm });
  }

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
  // A Haiku 'SKILL' with no deterministic match (checked above) falls through to
  // synthesis — writes never come from a fuzzy guess. SKILL and SYNTH both synth.
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

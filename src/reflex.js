// LOCAL REFLEXES (v1.5 MISSION PURITY · FX purge). Short LOCAL session controls that
// resolve instantly in the voice loop: mute, unmute, bank, status. Nothing else.
//
// PURITY PURGE (FX — ceremony autopsy): the semiconductor-era scene reflexes (summon,
// region/country pickers, device/schematic, explode/assemble, profile switch) are
// STRUCK from active routing — archived to v3 with the scene library (spec v1.5). They
// were what broke the signing ceremony: the fuzzy local Ollama model classified
// "mission brief" as `summon: taiwan` and spoke a country picker, preempting the
// conductor's deterministic skill router.
//
// TWO HARD GUARANTEES now:
//   1. SKILL DEFER — any skill-shaped utterance (brief/mission/deploy/tag/note/…) returns
//      null immediately, so it ALWAYS reaches the conductor's deterministic skill router
//      (mission/wire/repo/vault/vercel). The reflex may never preempt a skill.
//   2. ALLOWED-ONLY — the Ollama fallback is accepted ONLY if it names one of the four
//      local intents; any other/garbage type (e.g. a hallucinated "v2") is rejected and
//      deferred. The reflex can never emit a scene command again.
import rawTokens from '../tokens.json';

// the ONLY intents the reflex owns — pure local session controls, no conductor skill.
const ALLOWED = new Set(['mute', 'unmute', 'bank', 'status']);
// FX4 — the FUZZY Ollama fallback may ONLY emit the safe READ intent (status). The
// session/audio-MUTATING controls (bank/mute/unmute) must be DETERMINISTIC — the regex
// layer (explicit keywords) or the spoken dismiss phrase — never a 1b model's guess:
// llama3.2:1b classified "what can you do" as `bank` and silently dropped the hot
// session (FX4 mid-think dormant drop). status is safe to misfire — it speaks and stays.
const OLLAMA_ALLOWED = new Set(['status']);

// Skill-shaped utterances must reach the conductor's deterministic router — never the
// fuzzy reflex. This is the wall that keeps "mission brief" / "tag …" out of the reflex.
const SKILL_DEFER = /\b(brief|briefing|mission|deploy|deployment|vercel|prod|production|tag|release|note|jot|capture|remember|commit|diff|pipeline|pitch|vault|repo|repository|git|headlines?|wire|news)\b/;

// regex reflex — returns { type } for a local control, or null. Zero dependencies.
export function regexClassify(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  if (SKILL_DEFER.test(` ${t} `)) return null;                       // defer to the conductor
  if (/\b(unmute|un-mute|open mic|start listening)\b/.test(t)) return { type: 'unmute' };
  if (/\b(mute|silence|quiet|shush)\b/.test(t)) return { type: 'mute' };
  if (/\b(bank|stand down|dismiss|quench|hide|go away)\b/.test(t)) return { type: 'bank' };
  if (/\b(status|report|sitrep|how are|what.?s (up|happening)|state)\b/.test(t)) return { type: 'status' };
  return null;                                                        // not a local control → conductor
}

// full classify: SKILL DEFER first, then regex, then Ollama (validated to ALLOWED).
// Anything not a local control → null → the conductor's deterministic skill router.
export async function classify(text, bridge) {
  const t = (text || '').toLowerCase().trim();
  if (!t || SKILL_DEFER.test(` ${t} `)) return null;                 // skill utterance → conductor
  const rx = regexClassify(text);
  if (rx) return { ...rx, via: 'regex' };
  if (rawTokens.reflex.enabled && bridge && bridge.reflex) {
    try {
      const R = rawTokens.reflex;
      const r = await bridge.reflex(text, { url: R['ollama.url'], model: R['ollama.model'], timeoutMs: R['ollama.timeoutMs'] });
      // OLLAMA_ALLOWED-ONLY (FX4): accept ONLY the safe read intent from the fuzzy model;
      // a mutating control (bank/mute/unmute) or scene/garbage type is rejected → defer to
      // the conductor (which always speaks). The fuzzy layer can never drop/mute the session.
      if (r && r.type && OLLAMA_ALLOWED.has(r.type)) return { type: r.type, arg: null, via: 'ollama' };
    } catch (_) { /* fail-soft */ }
  }
  return null;   // not a short local command → the conductor handles it
}

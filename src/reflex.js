// PART 6 — LOCAL REFLEXES. Short operator intents (mute, bank, summon, status,
// mode/profile switch, explode) resolve LOCALLY and instantly: first a fast regex
// pass, then (optionally) a small local Ollama model via the main process for the
// fuzzy cases. Anything not a short command falls through to the brain. Fully
// fail-soft — no Ollama, no network, no problem: the regex layer still handles it.
import rawTokens from '../tokens.json';

const REGION_WORDS = {
  taiwan: /\b(taiwan|tsmc|hsinchu|strait)\b/,
  eu: /\b(europe|eu|veldhoven|asml|netherlands|dresden|rotterdam)\b/,
  namerica: /\b(america|us|arizona|nvidia|micron|boise|santa clara)\b/,
  korea: /\b(korea|samsung|hynix|busan)\b/,
};

// regex reflex — returns { type, arg? } or null. Runs with zero dependencies.
export function regexClassify(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  if (/\b(unmute|un-mute|open mic|start listening)\b/.test(t)) return { type: 'unmute' };
  if (/\b(mute|silence|quiet|shush)\b/.test(t)) return { type: 'mute' };
  if (/\b(bank|stand down|dismiss|quench|hide|go away)\b/.test(t)) return { type: 'bank' };
  if (/\b(explode|teardown|tear down|blow apart|separate)\b/.test(t)) return { type: 'explode' };
  if (/\b(assemble|reassemble|put.*back|collapse)\b/.test(t)) return { type: 'assemble' };
  if (/\b(status|report|sitrep|how are|what.?s (up|happening)|state)\b/.test(t)) return { type: 'status' };
  if (/\b(profile|mode|switch (profile|mode))\b/.test(t)) return { type: 'profile' };
  if (/\b(device|schematic|gpu board|teardown mode|show the chip)\b/.test(t)) return { type: 'summon', arg: 'schematic' };
  if (/\b(summon|show|open|pull up|bring up|go to|display)\b/.test(t)) {
    for (const [id, re] of Object.entries(REGION_WORDS)) if (re.test(t)) return { type: 'summon', arg: id };
    return { type: 'summon', arg: null };   // summon with no region -> caller may prompt
  }
  for (const [id, re] of Object.entries(REGION_WORDS)) if (re.test(t)) return { type: 'summon', arg: id };
  return null;
}

// full classify: regex first (instant), then Ollama (via bridge) for fuzzy cases.
// The known intent set is fixed, so Ollama only helps phrasing we didn't regex.
export async function classify(text, bridge) {
  const rx = regexClassify(text);
  if (rx) return { ...rx, via: 'regex' };
  if (rawTokens.reflex.enabled && bridge && bridge.reflex) {
    try {
      const R = rawTokens.reflex;
      const r = await bridge.reflex(text, { url: R['ollama.url'], model: R['ollama.model'], timeoutMs: R['ollama.timeoutMs'] });
      if (r && r.type && r.type !== 'none') return { ...r, via: 'ollama' };
    } catch (_) { /* fail-soft */ }
  }
  return null;   // not a short command -> brain handles it
}

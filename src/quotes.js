// ORGAN: QUOTES (STAGE C). Gently polls the ACTIVE PROFILE's symbols from a
// keyless public source (via the main process) and caches the last good value.
// Quotes render as thin GREYSCALE marks tethered near each org's site on the
// summoned terrain: value in bone, a tiny delta caret whose DIRECTION (not colour)
// encodes sign. Molten heat is NEVER used for price (§3). Fail-soft: no bridge /
// no data -> QUOTES OFFLINE.
import rawTokens from '../tokens.json';

const Q = rawTokens.quotes;

export function createQuotes({ bridge, getProfile }) {
  let online = false, offlineReason = 'STANDBY';
  const cache = new Map();     // sym -> { price, prev, pct, at }
  let lastAt = 0, pollTimer = null;

  function symDefs() { const p = getProfile(); return (p.quotes && p.quotes.symbols) || []; }
  function symList() { return symDefs().map((s) => s.sym); }

  async function poll() {
    if (!bridge || !bridge.quotePoll) { online = false; offlineReason = 'NO BRIDGE'; return; }
    const syms = symList();
    if (!syms.length) { online = false; offlineReason = 'NO SYMBOLS'; return; }
    try {
      const res = await bridge.quotePoll(syms);
      if (res && res.ok) {
        online = true; offlineReason = ''; lastAt = performance.now();
        for (const q of res.quotes) cache.set(q.sym, { price: q.price, prev: q.prev, pct: q.pct, at: lastAt });
      } else { online = false; offlineReason = 'NO DATA'; }
    } catch (_) { online = false; offlineReason = 'UNREACHABLE'; }
  }

  function boot() { poll(); pollTimer = setInterval(poll, Q.pollMs); return { online }; }

  // symbols tethered to sites in the given region, each with its cached quote
  function forRegion(regionId) {
    const out = [];
    for (const def of symDefs()) {
      const [rid, siteIdx] = def.site || [];
      if (rid !== regionId) continue;
      const q = cache.get(def.sym) || null;
      out.push({ sym: def.sym, label: def.label || def.sym, siteIdx, quote: q });
    }
    return out;
  }

  function reset() { cache.clear(); online = false; offlineReason = 'STANDBY'; poll(); }

  return {
    boot, poll, reset,
    status() {
      const stale = lastAt && (performance.now() - lastAt) > Q.cacheMs;
      return { online, offlineReason, count: cache.size, stale };
    },
    forRegion,
    // audit: seed a synthetic quote so the greyscale marks render with no network
    injectTest(sym, price, pct) { cache.set(sym, { price, prev: price / (1 + pct), pct, at: performance.now() }); online = true; offlineReason = ''; lastAt = performance.now(); },
    stop() { if (pollTimer) clearInterval(pollTimer); },
  };
}

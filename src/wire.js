// ORGAN: THE WIRE (STAGE B). Polls the ACTIVE PROFILE's keyless RSS feeds (via the
// main process — CORS), keyword-scores each item against the profile's regions /
// sites, and IGNITES molten heat at the matched site: seed ignition -> propagation
// hop-by-hop along the region's routes (Apes grammar) -> decay per wire.* tokens.
// Heat discipline: heat is bounded, cools to nothing, and is the ONLY molten on
// screen. Fail-soft: no bridge / no live feed -> WIRE OFFLINE (injectTest still
// exercises the heat model for the audit).
import rawTokens from '../tokens.json';

const W = rawTokens.wire;

export function createWire({ bridge, getProfile }) {
  let online = false, offlineReason = 'STANDBY', sources = 0;
  const heat = new Map();              // `${region}:${siteId}` -> { level, region, siteId, siteIdx }
  const seen = new Set();              // headline titles already ignited (no re-fire)
  let lines = [];                      // HUD wire feed lines {text, heat}
  const ignitions = [];               // drained by main for the no-map orb tick
  let pollTimer = null;

  function regionsOf() {
    const p = getProfile();
    return (p.map && p.map.enabled) ? (p.map.regions || {}) : {};
  }
  function keywordsOf() { const p = getProfile(); return (p.wire && p.wire.keywords) || {}; }
  function feedsOf() { const p = getProfile(); return (p.wire && p.wire.feeds) || []; }

  // score an item title against the profile -> { region, siteIdx } or null
  function classify(title) {
    const low = title.toLowerCase();
    const kw = keywordsOf(), regs = regionsOf();
    let best = null, bestScore = 0;
    for (const region of Object.keys(kw)) {
      if (!regs[region]) continue;
      let score = 0;
      for (const term of kw[region]) if (low.includes(term)) score++;
      if (score > bestScore) { bestScore = score; best = region; }
    }
    if (!best || bestScore < W.scoreThreshold) return null;
    // pick the site whose id / name token appears in the title, else the seed (0)
    const sites = regs[best].sites || [];
    let siteIdx = 0;
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      const toks = (s.id + ' ' + s.name).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3);
      if (toks.some((tk) => low.includes(tk))) { siteIdx = i; break; }
    }
    return { region: best, siteIdx };
  }

  function ignite(region, siteIdx, level, hops) {
    const regs = regionsOf();
    const reg = regs[region]; if (!reg) return;
    const sites = reg.sites || [];
    const site = sites[siteIdx]; if (!site) return;
    const key = `${region}:${site.id}`;
    const cur = heat.get(key) || { level: 0, region, siteId: site.id, siteIdx };
    cur.level = Math.min(1, Math.max(cur.level, level));
    heat.set(key, cur);
    ignitions.push({ region, siteId: site.id, siteIdx });
    enforceDiscipline();
    if (hops > 0) {
      // Apes grammar — heat hops along the region's routes to neighbours, hop by hop
      const routes = reg.routes || [];
      const hop = W['propagate.hop.ms'];
      for (const [a, b] of routes) {
        let nb = null;
        if (a === siteIdx) nb = b; else if (b === siteIdx) nb = a;
        if (nb === null) continue;
        const delay = hop[0] + Math.random() * (hop[1] - hop[0]);
        setTimeout(() => ignite(region, nb, level * 0.6, hops - 1), delay);
      }
    }
  }

  // keep at most 2-3 dominant heat signals alive (§8 discipline)
  function enforceDiscipline() {
    if (heat.size <= W['heat.max']) return;
    const sorted = [...heat.entries()].sort((a, b) => b[1].level - a[1].level);
    for (let i = W['heat.max']; i < sorted.length; i++) heat.delete(sorted[i][0]);
  }

  function applyItems(items) {
    let ignitedAny = false;
    const fresh = [];
    for (const it of items) {
      if (seen.has(it.title)) continue;
      seen.add(it.title);
      const hit = classify(it.title);
      const short = it.title.replace(/\s+-\s+[^-]*$/, '').slice(0, 40);
      fresh.push({ text: `${it.feed} · ${short}`.toUpperCase(), heat: !!hit });
      if (hit) { ignite(hit.region, hit.siteIdx, 1, W['propagate.hops']); ignitedAny = true; }
    }
    if (fresh.length) lines = [...fresh, ...lines].slice(0, W.maxItems);
    return ignitedAny;
  }

  async function poll() {
    if (!bridge || !bridge.wirePoll) { online = false; offlineReason = 'NO BRIDGE'; return; }
    const feeds = feedsOf();
    if (!feeds.length) { online = false; offlineReason = 'NO FEEDS'; return; }
    try {
      const res = await bridge.wirePoll(feeds);
      if (res && res.ok) { online = true; offlineReason = ''; sources = res.sources || 0; applyItems(res.items || []); }
      else { online = false; offlineReason = 'NO FEED'; }
    } catch (_) { online = false; offlineReason = 'UNREACHABLE'; }
  }

  function boot() {
    poll();
    pollTimer = setInterval(poll, W.pollMs);
    return { online };
  }

  // per-frame decay (dtMs). Heat cools to nothing over wire.cool.ms.
  function tick(dtMs) {
    for (const [k, h] of heat) {
      h.level -= dtMs / W['cool.ms'];
      if (h.level <= 0.02) heat.delete(k);
    }
  }

  function heatForRegion(regionId) {
    const out = {};
    for (const h of heat.values()) if (h.region === regionId) out[h.siteId] = h.level;
    return out;
  }
  function heatIndex() {
    let sum = 0; for (const h of heat.values()) sum += h.level;
    return Math.min(1, sum / W['heat.max']);
  }
  function drainIgnitions() { const out = ignitions.slice(); ignitions.length = 0; return out; }

  function reset() { heat.clear(); seen.clear(); lines = []; ignitions.length = 0; online = false; offlineReason = 'STANDBY'; poll(); }

  return {
    boot, poll, tick, reset,
    status() { return { online, offlineReason, sources }; },
    heatForRegion, heatIndex, drainIgnitions,
    hudLines() { return lines.slice(0, W['hud.lines']); },
    anyHot() { return heat.size > 0; },
    // audit / manual: ignite a synthetic event (drives the whole heat pipeline)
    injectTest(regionId, siteIdx = 0, title = 'SIM EVENT') {
      const fresh = [{ text: `SIM · ${title}`.toUpperCase(), heat: true }];
      lines = [...fresh, ...lines].slice(0, W.maxItems);
      ignite(regionId, siteIdx, 1, W['propagate.hops']);
    },
    stop() { if (pollTimer) clearInterval(pollTimer); },
  };
}

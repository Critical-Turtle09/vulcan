// VULCAN — THE WIRE, shared fetcher/parser. The ONE implementation that pulls and
// parses the active profile's keyless RSS feeds. Used by BOTH:
//   • electron/wire-main.js  — the renderer's `wire:poll` IPC (heat organ, v1)
//   • brain/skills/wire.js    — the spoken briefing (B4 HANDS III)
// so there is no forked/parallel fetcher. Native fetch, zero deps, fail-soft: any
// feed that errors is skipped and named in `down`; no key, no CORS, no crash.

export function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

// Parse an RSS <item> list. Each item carries { feed, title, link, pub, ts } where
// ts is the parsed pubDate epoch-ms (0 when absent/unparseable) — the recency key
// the briefing ranks on. Titles/links are entity-decoded and tag-stripped.
export function parseItems(xml, feedLabel) {
  const out = [];
  for (const m of String(xml).matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    if (!title) continue;
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const decodedPub = decodeEntities(pub);
    const ts = decodedPub ? (Date.parse(decodedPub) || 0) : 0;
    out.push({ feed: feedLabel, title: decodeEntities(title), link: decodeEntities(link), pub: decodedPub, ts });
  }
  return out;
}

// Poll a list of feeds ([{ label, url }]) concurrently. Returns
//   { ok, items, sources, total, down }
// where sources = feeds that yielded ≥1 item, total = feeds attempted, and down =
// the labels of feeds that errored or came back empty (so a caller can surface a
// degraded note without crashing). Every fetch is time-boxed and independently
// fail-soft — one unreachable feed never sinks the rest.
export async function pollFeeds(feeds, { timeoutMs = 8000, perFeed = 12 } = {}) {
  if (!Array.isArray(feeds) || !feeds.length) return { ok: false, items: [], sources: 0, total: 0, down: [], reason: 'no-feeds' };
  const items = [];
  const down = [];
  let live = 0;
  await Promise.all(feeds.map(async (f) => {
    const label = (f && f.label) || 'FEED';
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(f.url, { headers: { 'User-Agent': 'VULCAN/1.0 (+forge)' }, signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) { down.push(label); return; }
      const xml = await res.text();
      const parsed = parseItems(xml, label);
      if (parsed.length) { live++; items.push(...parsed.slice(0, perFeed)); }
      else down.push(label);
    } catch (_) { down.push(label); }   // unreachable / aborted / bad response — fail-soft
  }));
  return { ok: items.length > 0, items, sources: live, total: feeds.length, down };
}

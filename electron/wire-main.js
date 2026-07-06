// Main-process side of ORGAN: THE WIRE. The renderer can't fetch cross-origin RSS
// (CORS), so the main process polls the active profile's keyless feeds (semi:
// Google News RSS queries) and returns parsed items. No keys, fail-soft: any feed
// that errors is skipped; if none yield items the renderer shows WIRE OFFLINE.
import { ipcMain } from 'electron';

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

function parseItems(xml, feedLabel) {
  const out = [];
  for (const m of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    if (!title) continue;
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    out.push({ feed: feedLabel, title: decodeEntities(title), link: decodeEntities(link), pub: decodeEntities(pub) });
  }
  return out;
}

export function registerWireIpc() {
  // feeds: [{ label, url }] from the active profile. Returns { ok, items, sources }.
  ipcMain.handle('wire:poll', async (_e, feeds) => {
    if (!Array.isArray(feeds) || !feeds.length) return { ok: false, items: [], reason: 'no-feeds' };
    const items = [];
    let live = 0;
    await Promise.all(feeds.map(async (f) => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(f.url, { headers: { 'User-Agent': 'VULCAN/1.0 (+forge)' }, signal: ctrl.signal });
        clearTimeout(to);
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseItems(xml, f.label);
        if (parsed.length) { live++; items.push(...parsed.slice(0, 12)); }
      } catch (_) { /* skip this feed, fail-soft */ }
    }));
    return { ok: items.length > 0, items, sources: live };
  });
}

// Main-process side of ORGAN: QUOTES. Polls a keyless public source (Yahoo
// Finance chart endpoint) for the active profile's symbols. Cross-origin, so it
// must run here, not in the renderer. Gentle: one light request per symbol,
// short timeout, fail-soft (a symbol that errors is simply absent).
import { ipcMain } from 'electron';

async function fetchQuote(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (VULCAN/1.0)' }, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    const j = await res.json();
    const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    if (typeof price !== 'number' || typeof prev !== 'number' || !prev) return null;
    return { sym, price, prev, pct: (price - prev) / prev, currency: meta.currency || 'USD' };
  } catch (_) { clearTimeout(to); return null; }
}

export function registerQuotesIpc() {
  // symbols: string[] (Yahoo tickers). Returns { ok, quotes: [{sym,price,prev,pct}] }.
  ipcMain.handle('quotes:poll', async (_e, symbols) => {
    if (!Array.isArray(symbols) || !symbols.length) return { ok: false, quotes: [], reason: 'no-symbols' };
    const quotes = (await Promise.all(symbols.map(fetchQuote))).filter(Boolean);
    return { ok: quotes.length > 0, quotes };
  });
}

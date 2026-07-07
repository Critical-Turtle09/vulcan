// Main-process side of ORGAN: THE WIRE. The renderer can't fetch cross-origin RSS
// (CORS), so the main process polls the active profile's keyless feeds (semi:
// Google News RSS queries) and returns parsed items. No keys, fail-soft: any feed
// that errors is skipped; if none yield items the renderer shows WIRE OFFLINE.
//
// The fetch/parse itself lives in brain/wire-fetch.js — the ONE shared fetcher the
// spoken briefing (B4) reuses, so there is no parallel implementation.
import { ipcMain } from 'electron';
import { pollFeeds } from '../brain/wire-fetch.js';

export function registerWireIpc() {
  // feeds: [{ label, url }] from the active profile. Returns { ok, items, sources }.
  ipcMain.handle('wire:poll', async (_e, feeds) => {
    const { ok, items, sources } = await pollFeeds(feeds);
    return { ok, items, sources, ...(ok ? {} : { reason: 'no-items' }) };
  });
}

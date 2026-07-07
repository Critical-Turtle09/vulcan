// VULCAN v2 CONDUCTOR — SLICE B1: main-process brain bridge.
// The ONLY path the renderer has into the brain. The renderer never sees the
// key or the ledger — it sends a transcript and receives a rendered result.
//   brain:conduct    — transcript → conductor.conduct() → { text, route, ... }
//   brain:test-write — fire the mock WRITE action through the live announce hook
//   brain:mode       — read the persisted PRESENT/AWAY mode
import { ipcMain } from 'electron';
import { conduct } from '../brain/conductor.js';
import { execute, getMode } from '../brain/constitution.js';

// getWin: () => BrowserWindow | null — lets announce() reach the renderer voice.
export function registerBrainIpc(getWin) {
  // B1 announce hook. Keeps the B0 [ANNOUNCE] console log AND routes the spoken
  // announcement through the renderer's existing v1 voice output (brain:speak).
  // The renderer speaks it before the WRITE's effect is observed.
  const announce = (text) => {
    console.log(`[ANNOUNCE] ${text}`);
    const win = getWin && getWin();
    try { if (win && !win.isDestroyed()) win.webContents.send('brain:speak', text); } catch (_) { /* ignore */ }
  };

  ipcMain.handle('brain:conduct', async (_e, text) => {
    try {
      return await conduct(text);
    } catch (e) {
      // Never let a brain failure surface as an unhandled IPC rejection.
      return { text: '(brain error)', route: 'REFLEX', reason: 'ERR', model: 'none', cost_usd: 0, day_total_usd: 0 };
    }
  });

  ipcMain.handle('brain:test-write', async () => {
    const detail = { note: 'B1 announce drill', at: new Date().toISOString() };
    return execute('test.write', detail, { announce });
  });

  ipcMain.handle('brain:mode', () => getMode());
}

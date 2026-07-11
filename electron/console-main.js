// P2 THE CONSOLE — main-process hands for the clickable workspaces. Everything here is
// a READ or a CONTAINED, LOCAL write (never machine-leaving): the ledger detail, the
// recent-commit list, the SET TOKEN flow (writes VULCAN_VERCEL_TOKEN to the writable
// .env — a local file, announced aloud), the vault-persisted DIRECTIVES/OBJECTIVES,
// and reading a filed artifact for summarize-aloud. Fail-soft; never rejects an IPC.
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readLedger, DAILY_CAP_USD } from '../brain/governor.js';
import { readConsoleState, writeConsoleState, readArtifact } from '../brain/skills/obsidian.js';

const run = promisify(execFile);

// upsert KEY=value into a dotenv file (replace the line if present, else append). The
// value is the operator's local secret; it stays on this machine (.env is gitignored).
function upsertEnv(file, key, value) {
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch (_) { lines = []; }
  const re = new RegExp(`^\\s*${key}\\s*=`);
  let found = false;
  lines = lines.map((l) => { if (re.test(l)) { found = true; return `${key}=${value}`; } return l; });
  if (!found) { if (lines.length && lines[lines.length - 1].trim() !== '') lines.push(''); lines.push(`${key}=${value}`); }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n').replace(/\n{3,}/g, '\n\n'));
}

// DIRECTIVES + LAUNCH OBJECTIVES defaults — used only when the vault has no saved
// state yet (first run). Mirrors the seed rows in index.html so the console is never
// blank before the operator edits it.
const DEFAULT_STATE = {
  directives: [
    { text: 'COPPA/FERPA FILED', done: true },
    { text: 'PILOT OUTREACH ×10', done: false },
    { text: 'LAUNCH DISTRIBUTION', done: false },
  ],
  objectives: [
    { text: 'COPPA / FERPA POSTURE', done: true },
    { text: 'OUTREACH · 10 PILOTS', done: false },
    { text: 'LAUNCH · DISTRIBUTION', done: false },
  ],
};

export function registerConsoleIpc({ root, getWin, envWritePath }) {
  const announce = (text) => {
    try { const w = getWin && getWin(); if (w && !w.isDestroyed()) w.webContents.send('brain:speak', text); } catch (_) {}
  };

  // CLAUDE SPEND workspace — per-dispatch ledger detail + the cap.
  ipcMain.handle('console:ledger', () => {
    try {
      const led = readLedger();
      const calls = (led.calls || []).map((c) => ({ model: c.model || '—', usd: c.usd || 0, in: c.input_tokens || c.in || 0, out: c.output_tokens || c.out || 0 }));
      return { ok: true, total_usd: led.total_usd || 0, cap_usd: DAILY_CAP_USD, calls };
    } catch (_) { return { ok: false, total_usd: 0, cap_usd: DAILY_CAP_USD, calls: [] }; }
  });

  // GH COMMITS workspace — the recent commit list (hash · date · subject).
  ipcMain.handle('console:commitsList', async () => {
    try {
      const { stdout } = await run('git', ['log', '-15', '--pretty=%h|%cd|%s', '--date=format:%Y-%m-%d'], { cwd: root, timeout: 8000 });
      const list = stdout.split('\n').filter(Boolean).map((l) => { const [h, d, ...s] = l.split('|'); return { hash: h, date: d, subject: s.join('|') }; });
      return { ok: true, list };
    } catch (_) { return { ok: false, list: [] }; }
  });

  // VERCEL SET TOKEN — write VULCAN_VERCEL_TOKEN to the writable .env (local), refresh
  // the live process env, and ANNOUNCE it. Nothing leaves the machine.
  ipcMain.handle('console:setVercelToken', (_e, token) => {
    const t = String(token || '').trim();
    if (!t) return { ok: false, reason: 'EMPTY' };
    try {
      const file = envWritePath();
      upsertEnv(file, 'VULCAN_VERCEL_TOKEN', t);
      process.env.VULCAN_VERCEL_TOKEN = t;                 // live now, no restart
      announce('Vercel token set and saved locally. Nothing left the machine.');
      return { ok: true, path: file.replace(process.env.HOME || '', '~') };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  });

  // DIRECTIVES + LAUNCH OBJECTIVES — vault-persisted, editable, survive restarts.
  ipcMain.handle('console:objectivesRead', () => {
    const s = readConsoleState();
    return s && (s.directives || s.objectives) ? { ok: true, ...s } : { ok: true, ...DEFAULT_STATE };
  });
  ipcMain.handle('console:objectivesWrite', (_e, state) => {
    try {
      const clean = {
        directives: ((state && state.directives) || []).slice(0, 8).map((d) => ({ text: String(d.text || '').slice(0, 80), done: !!d.done })),
        objectives: ((state && state.objectives) || []).slice(0, 8).map((d) => ({ text: String(d.text || '').slice(0, 80), done: !!d.done })),
      };
      const r = writeConsoleState(clean);
      return { ok: true, rel: r.rel, ...clean };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  });

  // DOCUMENTS workspace — read a filed artifact's markdown (for summarize-aloud).
  ipcMain.handle('console:docRead', (_e, name) => {
    try { return readArtifact(name); } catch (_) { return { ok: false, name, text: '' }; }
  });
}

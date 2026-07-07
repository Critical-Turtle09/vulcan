// VULCAN v2 CONDUCTOR — SLICE B0: the constitution gate.
// Governs how actions run. READ actions are free and silent. WRITE actions are
// gated by MODE: in PRESENT they announce first, then run; in AWAY they never
// run — they queue to a daily report file for the operator to review on return.
import fs from 'node:fs';
import path from 'node:path';
import { VULCAN_DIR } from './governor.js';

export const MODE_FILE = path.join(VULCAN_DIR, 'mode');

function ensureDir() {
  try { fs.mkdirSync(VULCAN_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

// Persisted mode — PRESENT (default) or AWAY.
export function getMode() {
  try {
    const m = fs.readFileSync(MODE_FILE, 'utf8').trim().toUpperCase();
    if (m === 'AWAY' || m === 'PRESENT') return m;
  } catch (_) { /* default below */ }
  return 'PRESENT';
}

export function setMode(mode) {
  const m = String(mode).toUpperCase();
  if (m !== 'AWAY' && m !== 'PRESENT') throw new Error(`bad mode: ${mode}`);
  ensureDir();
  fs.writeFileSync(MODE_FILE, m + '\n');
  return m;
}

// Today's AWAY-mode report file (~/.vulcan/report-YYYY-MM-DD.md).
export function reportPath() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return path.join(VULCAN_DIR, `report-${day}.md`);
}

// B0 announcer: a console line. B1 swaps in the TTS hook. Never handles the key.
function defaultAnnounce(text) {
  console.log(`[ANNOUNCE] ${text}`);
}

const registry = new Map();

// Register an action. klass is "READ" | "WRITE". run(detail) does the work.
export function registerAction(name, klass, run) {
  const k = String(klass).toUpperCase();
  if (k !== 'READ' && k !== 'WRITE') throw new Error(`bad class: ${klass}`);
  registry.set(name, { name, klass: k, run: run || (async () => ({ ok: true })) });
  return name;
}

// Execute a registered action by name.
//   READ  → runs silently, returns its result.
//   WRITE + PRESENT → announce(text), then run.
//   WRITE + AWAY    → do NOT run; append { time, action, detail } to the report.
export async function execute(name, detail = {}, { announce = defaultAnnounce } = {}) {
  const action = registry.get(name);
  if (!action) throw new Error(`unknown action: ${name}`);

  if (action.klass === 'READ') {
    const result = await action.run(detail);
    return { ran: true, klass: 'READ', result };
  }

  // WRITE
  const mode = getMode();
  if (mode === 'AWAY') {
    ensureDir();
    const line = `- ${new Date().toISOString()} · **${name}** · ${JSON.stringify(detail)}\n`;
    fs.appendFileSync(reportPath(), line);
    return { ran: false, klass: 'WRITE', queued: true, mode, report: reportPath() };
  }

  announce(`WRITE · ${name} · ${JSON.stringify(detail)}`);
  const result = await action.run(detail);
  return { ran: true, klass: 'WRITE', announced: true, mode, result };
}

// A mock WRITE action, registered at load, to prove the AWAY queue end-to-end.
registerAction('test.write', 'WRITE', async (detail) => ({ ok: true, echoed: detail }));

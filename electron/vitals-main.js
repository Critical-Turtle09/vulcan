// SPEC v1.6 THE STAGE — G2 THE FLANKS. Main-process READ bridge for the Z1 SYSTEM
// VITALS cards. The renderer never touches the ledger, the Vercel token, or the shell
// — it asks for a compact reading and paints it. Every hand here is READ-ONLY and
// fail-soft: an error degrades to a not-available reading, never an IPC rejection.
//   vitals:spend   — the $2/day governor ledger (B0): percent of cap + cumulative spark
//   vitals:vercel  — the READ-only Vercel deploy eye (B5R): state · health (real)
//   vitals:commits — git commit velocity this week (B2 machinery): 7-day daily spark
import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readLedger, DAILY_CAP_USD } from '../brain/governor.js';
import { status as vercelStatus } from '../brain/skills/vercel.js';
import { vaultTrail } from '../brain/skills/obsidian.js';

const run = promisify(execFile);

// ---- CLAUDE SPEND — real, from the governor ledger (B0). Percent of the hard daily
// cap plus a cumulative-spend sparkline built from today's actual calls. ----
function spend() {
  try {
    const led = readLedger();
    const spentUsd = led.total_usd || 0;
    const pct = Math.min(100, Math.round((spentUsd / DAILY_CAP_USD) * 100));
    // cumulative USD after each metered call today — a real intraday spend curve.
    let acc = 0;
    const spark = (led.calls || []).map((c) => (acc += (c.usd || 0)));
    return { ok: true, pct, spentUsd, capUsd: DAILY_CAP_USD, calls: (led.calls || []).length, spark };
  } catch (_) {
    return { ok: false, pct: 0, spentUsd: 0, capUsd: DAILY_CAP_USD, calls: 0, spark: [] };
  }
}

// ---- VERCEL — real, from the READ-only deploy eye (B5R). Compacts the hand's result
// to a card reading. Not connected (no token/project) surfaces honestly as N/C. ----
async function vercel() {
  try {
    const r = await vercelStatus();
    if (!r || r.connected === false) return { ok: true, connected: false, primary: 'N/C', sub: 'SET TOKEN' };
    const state = (r.latest && r.latest.state) || (r.health && r.health.ok ? 'REACHABLE' : 'DEGRADED');
    const code = r.health && r.health.code ? `HTTP ${r.health.code}${r.health.ok ? '' : ' · DOWN'}` : 'UNREACHABLE';
    const url = (r.latest && r.latest.url) || (r.health && r.health.url) || '';
    return { ok: true, connected: true, primary: state.toUpperCase(), sub: code, url: String(url).replace(/^https?:\/\//, '') };
  } catch (_) {
    return { ok: false, connected: false, primary: 'N/C', sub: 'UNAVAILABLE' };
  }
}

// ---- GH COMMITS /WK — real, from the repo the GitHub hand (B2) already drives. Local
// git is the machine's mirror of origin; this is a trivial `git log` velocity read.
// Returns the 7-day total plus one bucket per day (oldest→newest) for the sparkline. ----
async function commits(root) {
  try {
    const { stdout } = await run('git', ['log', '--since=7 days ago', '--pretty=%cd', '--date=format:%Y-%m-%d'], { cwd: root, timeout: 8000 });
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const p = (n) => String(n).padStart(2, '0');
      days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    const bucket = Object.fromEntries(days.map((d) => [d, 0]));
    for (const line of stdout.split('\n')) { const k = line.trim(); if (k in bucket) bucket[k]++; }
    const spark = days.map((d) => bucket[d]);
    const total = spark.reduce((a, b) => a + b, 0);
    return { ok: true, total, spark };
  } catch (_) {
    return { ok: false, total: 0, spark: [] };
  }
}

// ---- DOCUMENTS · VAULT TRAIL — real, from the BONSAI ledger (H1). Newest artifacts
// from BONSAI/outputs/ + today's daily file, name + true age + obsidian:// open URI.
// Fail-soft: no vault / no artifacts surfaces as an empty trail, never an IPC reject. ----
function documents() {
  try { return { ok: true, docs: vaultTrail({ max: 6 }) }; }
  catch (e) { return { ok: false, docs: [], reason: String((e && e.message) || e) }; }
}

export function registerVitalsIpc(root) {
  ipcMain.handle('vitals:spend', () => spend());
  ipcMain.handle('vitals:vercel', () => vercel());
  ipcMain.handle('vitals:commits', () => commits(root));
  ipcMain.handle('vitals:documents', () => documents());   // H1 — Z1 DOCUMENTS live trail
}

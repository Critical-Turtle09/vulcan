// P4 METRICS HISTORY — main-process daily snapshotter for the Z1 vitals sparklines.
// Captures ONE row per local day — { date, commits, spendUsd, waitlist, deploy } —
// and persists it to the vault (VULCAN/BONSAI/state/metrics.json) so the sparklines
// render a REAL multi-day trend instead of a fabricated series. Snapshots run on BOOT
// and at MIDNIGHT (spec), plus a light local refresh so today's point stays current;
// the renderer's read IPC is fast + read-only. Everything is fail-soft: a git/vercel
// hiccup degrades a field to null (never a fabricated value), never rejects.
import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readLedger } from '../brain/governor.js';
import { status as vercelStatus } from '../brain/skills/vercel.js';
import { readMetrics, writeMetrics, readWaitlist } from '../brain/skills/obsidian.js';
import { upsertDay, mergeSeed } from '../brain/metrics.js';

const run = promisify(execFile);
const p2 = (n) => String(n).padStart(2, '0');
const dayStr = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// commits per LOCAL day over the last `days` days (real git; empty on any failure).
async function commitBuckets(root, days) {
  const bucket = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) bucket[dayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))] = 0;
  try {
    const { stdout } = await run('git', ['log', `--since=${days} days ago`, '--pretty=%cd', '--date=format:%Y-%m-%d'], { cwd: root, timeout: 8000 });
    for (const line of stdout.split('\n')) { const k = line.trim(); if (k in bucket) bucket[k]++; }
  } catch (_) { /* no git → all-zero buckets, honest */ }
  return bucket;
}

async function deployState() {
  try {
    const r = await vercelStatus();
    if (!r || r.connected === false) return 'N/C';
    const state = (r.latest && r.latest.state) || (r.health && r.health.ok ? 'REACHABLE' : 'DEGRADED');
    return String(state).toUpperCase();
  } catch (_) { return 'N/C'; }
}

// Take a snapshot: seed missing days from real git history, then overwrite today's row
// with the live reading. withDeploy=false skips the network Vercel read (fast path for
// the intraday refresh) and keeps the last recorded deploy state for today.
export async function snapshotMetrics(root, { withDeploy = true } = {}) {
  const store = readMetrics();
  let history = (store && Array.isArray(store.history)) ? store.history : [];

  // SEED — backfill commits-per-day from git for days we don't have yet (real data).
  // spend / waitlist / deploy are genuinely unknown for past days → null, never faked.
  const buckets = await commitBuckets(root, 14);
  const seed = Object.entries(buckets).map(([date, commits]) => ({ date, commits, spendUsd: null, waitlist: null, deploy: null }));
  history = mergeSeed(history, seed);

  // TODAY — the live snapshot (fully overwrites today's row).
  const today = dayStr(new Date());
  const prevToday = history.find((r) => r.date === today);
  let spendUsd = 0, waitlist = null;
  try { spendUsd = readLedger().total_usd || 0; } catch (_) { /* keep 0 */ }
  try { const w = readWaitlist(); waitlist = (w && w.value != null) ? w.value : null; } catch (_) { /* null */ }
  const deploy = withDeploy ? await deployState() : (prevToday ? prevToday.deploy : null);
  history = upsertDay(history, { date: today, commits: buckets[today] || 0, spendUsd, waitlist, deploy });

  try { writeMetrics({ history, updated: new Date().toISOString() }); } catch (_) { /* vault unreachable — keep in-memory */ }
  return history;
}

let midnightTimer = null;
let refreshTimer = null;
function scheduleMidnight(root) {
  try { if (midnightTimer) clearTimeout(midnightTimer); } catch (_) {}
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);   // 00:01 local
  midnightTimer = setTimeout(async () => {
    try { await snapshotMetrics(root, { withDeploy: true }); } catch (_) {}
    scheduleMidnight(root);   // re-arm for the next day
  }, Math.max(60000, next - now));
  try { midnightTimer.unref && midnightTimer.unref(); } catch (_) {}
}

export function registerMetricsIpc(root) {
  // BOOT snapshot (full, includes the network deploy read).
  snapshotMetrics(root, { withDeploy: true }).catch(() => {});
  scheduleMidnight(root);
  // Keep today's point current within a long session without hammering the vault or the
  // network: a light local refresh (git + ledger + waitlist) every 10 min.
  refreshTimer = setInterval(() => { snapshotMetrics(root, { withDeploy: false }).catch(() => {}); }, 10 * 60 * 1000);
  try { refreshTimer.unref && refreshTimer.unref(); } catch (_) {}

  // READ — fast, read-only; the renderer polls this for the sparklines.
  ipcMain.handle('metrics:history', () => {
    try { const s = readMetrics(); return { ok: true, history: (s && s.history) || [], updated: s && s.updated }; }
    catch (e) { return { ok: false, history: [], reason: String((e && e.message) || e) }; }
  });
}

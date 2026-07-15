// T1/P4 — the metrics history logic + its vault store.
// Pins the daily-snapshot invariants: one row per day, seed never clobbers a recorded
// live snapshot, the cap holds, and the sparkline series is numeric-with-honest-zeros
// (never a fabricated value). Vault I/O is redirected to a throwaway temp dir.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { upsertDay, mergeSeed, sparkFrom, MAX_HISTORY } from '../brain/metrics.js';

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-metrics-test-'));
process.env.VULCAN_VAULT_PATH = VAULT;
const { readMetrics, writeMetrics } = await import('../brain/skills/obsidian.js');
after(() => { try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (_) {} });

test('upsertDay keeps ONE row per day (today overwrites, not duplicates)', () => {
  let h = [];
  h = upsertDay(h, { date: '2026-07-14', commits: 3, spendUsd: 0.1 });
  h = upsertDay(h, { date: '2026-07-15', commits: 5, spendUsd: 0.2 });
  h = upsertDay(h, { date: '2026-07-15', commits: 9, spendUsd: 0.5 });   // same day again
  assert.equal(h.length, 2, 'still two days');
  assert.equal(h.find((r) => r.date === '2026-07-15').commits, 9, 'latest write wins');
  assert.deepEqual(h.map((r) => r.date), ['2026-07-14', '2026-07-15'], 'sorted ascending');
});

test('mergeSeed backfills ONLY missing days, never clobbers a live row', () => {
  const live = [{ date: '2026-07-15', commits: 9, spendUsd: 0.5, waitlist: 284, deploy: 'READY' }];
  const seed = [
    { date: '2026-07-13', commits: 2, spendUsd: null, waitlist: null, deploy: null },
    { date: '2026-07-15', commits: 0, spendUsd: null, waitlist: null, deploy: null },   // must NOT overwrite
  ];
  const m = mergeSeed(live, seed);
  assert.equal(m.length, 2);
  const kept = m.find((r) => r.date === '2026-07-15');
  assert.equal(kept.commits, 9, 'the live snapshot is preserved');
  assert.equal(kept.waitlist, 284);
  assert.equal(m.find((r) => r.date === '2026-07-13').commits, 2, 'the missing day was seeded');
});

test('history is capped at MAX_HISTORY days', () => {
  let h = [];
  for (let i = 0; i < MAX_HISTORY + 10; i++) {
    const d = new Date(2026, 0, 1 + i);
    const p = (n) => String(n).padStart(2, '0');
    h = upsertDay(h, { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, commits: i });
  }
  assert.equal(h.length, MAX_HISTORY, 'oldest days are dropped');
  assert.equal(h[h.length - 1].commits, MAX_HISTORY + 9, 'newest day retained');
});

test('sparkFrom yields a numeric series with honest zeros for missing values', () => {
  const h = [{ date: 'a', commits: 3, spendUsd: null }, { date: 'b', commits: 0, spendUsd: 0.4 }, { date: 'c', spendUsd: 1.2 }];
  assert.deepEqual(sparkFrom(h, 'commits'), [3, 0, 0], 'missing commits → 0, never invented');
  assert.deepEqual(sparkFrom(h, 'spendUsd'), [0, 0.4, 1.2], 'null spend → 0 baseline');
});

test('metrics store round-trips through the vault', () => {
  assert.equal(readMetrics(), null, 'unset before first write');
  const history = [{ date: '2026-07-15', commits: 5, spendUsd: 0.2, waitlist: 284, deploy: 'READY' }];
  writeMetrics({ history, updated: '2026-07-15T12:00:00Z' });
  const r = readMetrics();
  assert.deepEqual(r.history, history);
  assert.equal(r.updated, '2026-07-15T12:00:00Z');
});

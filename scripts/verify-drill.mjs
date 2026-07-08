// NS3 — DRILL HARNESS acceptance (node-side, no Electron). Proves the two safety
// guarantees that make tonight's orphaned-mic incident impossible:
//
//   (A) SINGLE-DRIVER LOCK — a second driver is refused while a live one holds the lock;
//       a stale lock (dead holder) is reclaimed; release only removes our OWN lock.
//   (B) CLEAN DETACH — the hold guard releases a held trigger EXACTLY ONCE on shutdown,
//       is idempotent + re-entrant (safe from repeated/concurrent signal handlers), and
//       never fires pttUp when nothing is held. Orphaned open mics are impossible.
//
//   run: node scripts/verify-drill.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireLock, releaseLock, createHoldGuard } from './lib/drill.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };
const LOCK = path.join(os.tmpdir(), `vulcan-drill-test-${process.pid}.lock`);
const clean = () => { try { fs.rmSync(LOCK, { force: true }); } catch (_) {} };
clean();

console.log('VULCAN · NS3 — drill harness · verification\n');

// ---- (A) SINGLE-DRIVER LOCK -------------------------------------------------
console.log('(A) single-driver lock');
const A = acquireLock({ lockPath: LOCK, pid: 1001, isAlive: () => true });
ok(A.ok, 'first driver acquires the lock');
const B = acquireLock({ lockPath: LOCK, pid: 2002, isAlive: () => true });
ok(!B.ok && B.holderPid === 1001, `second LIVE driver is refused (holderPid=${B.holderPid})`);
// release from the WRONG pid must NOT remove the lock (never clobber another driver)
releaseLock({ lockPath: LOCK, pid: 2002 });
ok(fs.existsSync(LOCK), 'release from a non-owner pid does not remove the lock');
// stale lock (holder pid dead) -> reclaimed
const C = acquireLock({ lockPath: LOCK, pid: 3003, isAlive: () => false });
ok(C.ok && String(fs.readFileSync(LOCK, 'utf8')).trim() === '3003', 'stale lock (dead holder) is reclaimed');
// owner releases -> gone
releaseLock({ lockPath: LOCK, pid: 3003 });
ok(!fs.existsSync(LOCK), 'owner release removes the lock');
clean();
console.log('');

// ---- (B) CLEAN DETACH — hold guard ------------------------------------------
console.log('(B) clean detach — hold guard releases on shutdown, exactly once');
{
  let downs = 0, ups = 0;
  const g = createHoldGuard({ pttDown: async () => { downs++; }, pttUp: async () => { ups++; } });
  ok(g.held === false, 'guard starts un-held');
  // release with nothing held -> no pttUp (never a spurious release)
  const r0 = await g.release();
  ok(r0 === false && ups === 0, 'release() with no hold does nothing (no spurious pttUp)');
  // a hold is opened…
  await g.down();
  ok(g.held === true && downs === 1, 'down() opens the hold (pttDown once)');
  // …and a shutdown (simulated signal) releases it exactly once
  const r1 = await g.release();
  ok(r1 === true && ups === 1 && g.held === false, 'release() closes the held mic exactly once (pttUp)');
  // a second release is a no-op (idempotent — safe from repeated handlers)
  const r2 = await g.release();
  ok(r2 === false && ups === 1, 'a second release() is a no-op (idempotent)');
}
{
  // concurrent releases (two signals racing) -> still exactly one pttUp
  let ups = 0;
  const g = createHoldGuard({ pttDown: async () => {}, pttUp: async () => { await new Promise((r) => setTimeout(r, 10)); ups++; } });
  await g.down();
  await Promise.all([g.release(), g.release(), g.release()]);
  ok(ups === 1 && g.held === false, 'concurrent releases collapse to a single pttUp (re-entrant)');
}
{
  // a normal up() then release() -> no extra pttUp (the completed clip is not re-released)
  let ups = 0;
  const g = createHoldGuard({ pttDown: async () => {}, pttUp: async () => { ups++; } });
  await g.down(); await g.up();
  ok(ups === 1, 'normal up() releases the mic once');
  await g.release();
  ok(ups === 1, 'release() after a normal up() adds no extra pttUp');
}
console.log('');

// ---- (C) REAL SIGNAL PATH — SIGINT mid-hold releases the mic, then exits -----
console.log('(C) real signal path — a held child released by SIGINT (orphan-proof)');
{
  const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'drill.mjs');
  const MARK = path.join(os.tmpdir(), `vulcan-drill-sig-${process.pid}.mark`);
  try { fs.rmSync(MARK, { force: true }); } catch (_) {}
  // child: opens a hold, then on SIGINT releases (writes 'released') and exits. This is
  // the exact wiring hear-vulcan uses (process.on('SIGINT') -> guard.release()).
  const child = `
    import { createHoldGuard } from ${JSON.stringify(LIB)};
    import fs from 'node:fs';
    const MARK = ${JSON.stringify(MARK)};
    const g = createHoldGuard({ pttDown: async () => { fs.writeFileSync(MARK, 'holding'); }, pttUp: async () => { fs.writeFileSync(MARK, 'released'); } });
    process.on('SIGINT', async () => { await g.release(); process.exit(0); });
    await g.down();
    setInterval(() => {}, 1000);
  `;
  const proc = spawn(process.execPath, ['--input-type=module', '-e', child], { stdio: 'ignore' });
  // wait for the child to open the hold
  let waited = 0;
  while (waited < 3000 && (!fs.existsSync(MARK) || fs.readFileSync(MARK, 'utf8') !== 'holding')) { await new Promise((r) => setTimeout(r, 50)); waited += 50; }
  const heldOk = fs.existsSync(MARK) && fs.readFileSync(MARK, 'utf8') === 'holding';
  ok(heldOk, 'child opened a hold (mic would be OPEN)');
  // send SIGINT (Ctrl-C) mid-hold
  proc.kill('SIGINT');
  const exitCode = await new Promise((r) => proc.on('exit', (c) => r(c)));
  const released = fs.existsSync(MARK) && fs.readFileSync(MARK, 'utf8') === 'released';
  ok(released, 'SIGINT mid-hold released the trigger (mic CLOSED) before exit');
  ok(exitCode === 0, `child exited cleanly after releasing (code ${exitCode})`);
  try { fs.rmSync(MARK, { force: true }); } catch (_) {}
}
console.log('');

console.log(`=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

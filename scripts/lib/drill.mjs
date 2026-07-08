// NS3 — DRILL HARNESS HARDENING. The reusable, testable core of the live drill:
//   • a SINGLE-DRIVER LOCK so a second driver can never attach and fight for the mic;
//   • a HOLD GUARD that guarantees the PTT trigger is released on shutdown, so a
//     Ctrl-C / SIGTERM / terminal loss can never orphan an open mic.
// Both take injected deps (fs path, pttDown/pttUp thunks) so they run headlessly with
// mocks — the clean-detach guarantee is proven without a real app or mic.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LOCK_PATH = path.join(os.tmpdir(), 'vulcan-hear-drill.lock');

// liveness: process.kill(pid,0) throws ESRCH if dead, EPERM if alive-but-not-ours.
function defaultAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === 'EPERM'; } }

// Acquire the single-driver lock. Refuses (ok:false, holderPid) if a LIVE driver already
// holds it; takes over a STALE lock (holder pid dead). Writes our pid on success.
export function acquireLock({ lockPath = LOCK_PATH, pid = process.pid, isAlive = defaultAlive } = {}) {
  try {
    if (fs.existsSync(lockPath)) {
      const held = parseInt(String(fs.readFileSync(lockPath, 'utf8')).trim(), 10);
      if (held && held !== pid && isAlive(held)) return { ok: false, holderPid: held };
      // else: our own pid, or a stale/dead holder -> reclaim
    }
    fs.writeFileSync(lockPath, String(pid));
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// Release the lock, but ONLY if we still own it (never clobber another driver's lock).
export function releaseLock({ lockPath = LOCK_PATH, pid = process.pid } = {}) {
  try {
    if (!fs.existsSync(lockPath)) return;
    if (parseInt(String(fs.readFileSync(lockPath, 'utf8')).trim(), 10) === pid) fs.rmSync(lockPath, { force: true });
  } catch (_) { /* best-effort */ }
}

// A PTT hold guard. down()/up() bound a clip; release() is the idempotent, shutdown-safe
// teardown that guarantees pttUp fires exactly once if a hold is still open. Never throws.
export function createHoldGuard({ pttDown, pttUp }) {
  let held = false, releasing = null;
  return {
    get held() { return held; },
    async down() { if (held) return; held = true; try { await pttDown(); } catch (_) {} },
    async up() { if (!held) return; held = false; try { await pttUp(); } catch (_) {} },
    // idempotent, re-entrant release for signal handlers: releases the trigger if (and
    // only if) one is held, at most once even under concurrent/repeated calls.
    async release() {
      if (!held) return false;
      if (releasing) return releasing;
      releasing = (async () => { try { await pttUp(); } finally { held = false; } })().then(() => true, () => true);
      const r = await releasing; releasing = null; return r;
    },
  };
}

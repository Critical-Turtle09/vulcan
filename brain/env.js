// VULCAN v2 CONDUCTOR — .env loader for the headless brain.
// Mirrors electron/voice-main.js loadEnv (KEY=VALUE, # comments, zero deps) so
// the brain reads the SAME .env the app does — but without importing electron,
// which the app-side loader pulls in and a plain-Node CLI can't.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// repo root — brain/ sits at the top level, so one directory up.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv(root = ROOT) {
  // Test/CI seam: VULCAN_DISABLE_ENV=1 skips reading .env entirely, so a suite can
  // force a keyless (offline / banked) brain deterministically regardless of what the
  // operator's real .env holds. Harmless in production (off unless explicitly set).
  if (process.env.VULCAN_DISABLE_ENV === '1') return;
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val;
  }
}

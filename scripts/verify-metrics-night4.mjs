// P4 — verify the metrics history end-to-end against a DEV electron under CDP:
// the boot snapshot persists a multi-day history to the vault, metrics:history reads
// it, and the renderer paints the commits + spend sparklines from it (a real multi-day
// polyline, not a fabricated series). Requires vite dev on 5273. JSON verdict to stdout.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '../..');
const ELECTRON = path.join(ROOT, 'node_modules', '.bin', 'electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ok: false };

const proc = spawn(ELECTRON, ['.', '--remote-debugging-port=9291'], { cwd: ROOT, stdio: 'ignore', detached: true, env: { ...process.env } });
proc.unref();
try {
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9291'); } catch (_) { await sleep(300); } }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('localhost') || u.includes('index.html')) page = p; } if (!page) await sleep(300); }
  await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
  await page.evaluate(() => window.__vulcanStage.ignite());
  await sleep(2500);   // let the boot snapshot land + the flanks refresh

  out.history = await page.evaluate(async () => {
    const r = await window.vulcan.metricsHistory();
    return { ok: r.ok, days: (r.history || []).length, updated: r.updated, sample: (r.history || []).slice(-3) };
  });
  // the commits card should now carry a multi-point sparkline polyline from history
  out.commitsSpark = await page.evaluate(() => {
    const n = document.getElementById('vc-commits'); if (!n) return null;
    const pl = n.querySelector('svg polyline'); if (!pl) return { points: 0 };
    return { points: (pl.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).length };
  });
  out.spendSpark = await page.evaluate(() => {
    const n = document.getElementById('vc-spend'); if (!n) return null;
    const pl = n.querySelector('svg polyline'); if (!pl) return { points: 0 };
    return { points: (pl.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).length };
  });
  await browser.close().catch(() => {});
  out.ok = !!(out.history && out.history.ok && out.history.days >= 2
    && out.commitsSpark && out.commitsSpark.points >= 2);
} catch (e) {
  out.error = String((e && e.stack) || e);
} finally {
  try { proc.kill('SIGKILL'); } catch (_) {}
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);

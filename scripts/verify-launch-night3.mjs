// NIGHT SHIFT 3 · TASK 0 — verify the PACKAGED /Applications/VULCAN.app launches CLEAN
// post-FDA. Launches under CDP, confirms the stage page + self-check hooks are present,
// ignites, confirms the orb is live and the manual glyph is present, screenshots, exits.
// READ-ONLY: no dispatch, no vault write — this only OBSERVES that launch is healthy.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = '/Applications/VULCAN.app/Contents/MacOS/VULCAN';
const PORT = 9241;
const SHOT = process.argv[2] || 'night3-launch.jpeg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ok: false, checks: {}, notes: [] };

async function launch(port) {
  const proc = spawn(APP, [`--remote-debugging-port=${port}`], { stdio: 'ignore', detached: true });
  proc.unref();
  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch (_) { await sleep(300); } }
  if (!browser) throw new Error('CDP connect failed');
  let page = null;
  for (let i = 0; i < 30 && !page; i++) {
    for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) page = p; }
    if (!page) await sleep(300);
  }
  if (!page) throw new Error('stage page not found');
  await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
  return { proc, browser, page };
}

try {
  const s = await launch(PORT);
  const S = (fn, ...a) => s.page.evaluate(fn, ...a);
  out.checks.hooks = await S(() => ({ stage: !!window.__vulcanStage, vulcan: !!window.vulcan, dispatch: typeof window.vulcan.dispatch }));
  await S(() => window.__vulcanStage.ignite());
  await sleep(3800);
  out.checks.live = await S(() => ({ core: window.__vulcanStage.core(), voice: window.__vulcanStage.voice(), wire: window.__vulcanStage.wire() }));
  out.checks.glyph = await S(() => {
    const g = document.getElementById('manual-glyph'); if (!g) return { present: false };
    const cs = getComputedStyle(g);
    return { present: true, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01 };
  });
  const errs = await S(() => (window.__vulcanErrors || []).slice(0, 5));
  out.checks.rendererErrors = errs;
  await s.page.screenshot({ path: SHOT, quality: 80, type: 'jpeg' });
  out.ok = !!out.checks.hooks.stage && !!out.checks.hooks.vulcan && !!out.checks.glyph.present;
  await s.browser.close().catch(() => {});
  try { s.proc.kill('SIGKILL'); } catch (_) {}
} catch (e) {
  out.error = String((e && e.message) || e);
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);

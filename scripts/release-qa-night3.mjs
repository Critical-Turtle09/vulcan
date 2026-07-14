// NIGHT SHIFT 3 — QA the freshly PACKED release build BEFORE installing it. Launches the
// release binary under CDP and confirms: (1) clean launch + hooks, (2) the P3 WAITLIST
// manual-entry workspace is present in the bundle (#ws-wl-num input), (3) SAVE writes the
// figure to the vault and the card reads "<n> · MANUAL · <date>", (4) honest default when
// cleared. Restores the vault to a cleared state afterward. Pass the .app path as arg[2].
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const APPDIR = process.argv[2] || 'release/VULCAN-darwin-arm64/VULCAN.app';
const APP = path.resolve(APPDIR, 'Contents/MacOS/VULCAN');
const SHOT = process.argv[3] || null;
const PORT = 9281;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { app: APP, steps: {}, ok: false };

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
const kill = (p) => { try { p.kill('SIGKILL'); } catch (_) {} };
const cardText = (page) => page.evaluate(() => {
  const n = document.getElementById('vc-waitlist'); if (!n) return null;
  return { num: (n.querySelector('.vnum') || {}).textContent, delta: (n.querySelector('.vdelta') || {}).textContent };
});

try {
  const s = await launch(PORT);
  const S = (fn, ...a) => s.page.evaluate(fn, ...a);
  // clean slate
  await S(() => window.vulcan.consoleWaitlistWrite({ value: null, note: '' }));
  out.steps.hooks = await S(() => ({ waitlistRead: typeof window.vulcan.consoleWaitlistRead, waitlistWrite: typeof window.vulcan.consoleWaitlistWrite }));
  await S(() => window.__vulcanStage.ignite());
  await sleep(1500);
  await S(() => window.__vulcanStage.refreshWaitlist ? null : null);   // no-op guard
  await S(() => window.__vulcanStage.openWorkspace('waitlist'));
  await sleep(500);
  out.steps.workspaceHasInput = await S(() => !!document.getElementById('ws-wl-num'));
  await s.page.fill('#ws-wl-num', '200');
  await s.page.fill('#ws-wl-note', 'release qa');
  if (SHOT) await s.page.screenshot({ path: SHOT, quality: 82, type: 'jpeg' });
  await s.page.locator('.ws-btn.primary', { hasText: /SAVE/ }).first().click();
  await sleep(700);
  out.steps.savedRead = await S(() => window.vulcan.consoleWaitlistRead());
  await s.page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
  out.steps.savedCard = await cardText(s.page);
  // clear + restore honest default
  await S(() => window.vulcan.consoleWaitlistWrite({ value: null, note: '' }));
  out.steps.clearedRead = await S(() => window.vulcan.consoleWaitlistRead());
  await s.browser.close().catch(() => {});
  kill(s.proc);

  const d = out.steps;
  out.ok = !!(d.hooks.waitlistRead === 'function' && d.workspaceHasInput
    && d.savedRead && d.savedRead.value === 200 && /\d{4}-\d{2}-\d{2}/.test(d.savedRead.at || '')
    && d.savedCard && /200/.test(d.savedCard.num || '') && /MANUAL/.test(d.savedCard.delta || '')
    && d.clearedRead && d.clearedRead.value === null);
} catch (e) {
  out.error = String((e && e.stack) || e);
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);

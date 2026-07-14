// NIGHT SHIFT 3 · TASK 1 — verify the WAITLIST manual-entry workspace end-to-end against
// a DEV electron (renderer from vite + main-process IPC from source), under CDP:
//   1) honest default: card reads "— / NO SOURCE" before any entry
//   2) SAVE: type a number + note → card resolves to the figure + "MANUAL · <date>"
//   3) vault: consoleWaitlistRead reflects the saved value/note/date
//   4) PERSIST: relaunch → the figure survives
//   5) CLEAR: restore the honest default so no test number is left on the operator's card
// Requires the vite dev server already running on 5273. Writes a JSON verdict to stdout.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '../..');
const ELECTRON = path.join(ROOT, 'node_modules', '.bin', 'electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: {}, ok: false };

async function launch(port) {
  const proc = spawn(ELECTRON, ['.', `--remote-debugging-port=${port}`], { cwd: ROOT, stdio: 'ignore', detached: true, env: { ...process.env } });
  proc.unref();
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch (_) { await sleep(300); } }
  if (!browser) throw new Error('CDP connect failed');
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('localhost') || u.includes('index.html')) page = p; }
    if (!page) await sleep(300);
  }
  if (!page) throw new Error('stage page not found');
  await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
  return { proc, browser, page };
}
const kill = (p) => { try { p.kill('SIGKILL'); } catch (_) {} };
const cardText = (page, k) => page.evaluate((key) => {
  const n = document.getElementById(`vc-${key}`); if (!n) return null;
  return { num: (n.querySelector('.vnum') || {}).textContent, delta: (n.querySelector('.vdelta') || {}).textContent };
}, k);

try {
  // clean slate: clear any prior manual value first
  const s0 = await launch(9251);
  await s0.page.evaluate(() => window.vulcan.consoleWaitlistWrite({ value: null, note: '' }));
  await s0.page.evaluate(() => window.__vulcanStage && window.__vulcanStage.ignite && window.__vulcanStage.ignite());
  await sleep(1200);
  // force a card refresh to the cleared state
  await s0.page.evaluate(() => window.__vulcanStage.openWorkspace('waitlist'));
  await sleep(300);
  await s0.page.keyboard.press('Escape').catch(() => {});
  await sleep(200);
  out.steps.defaultCard = await cardText(s0.page, 'waitlist');

  // OPEN + SAVE a figure
  await s0.page.evaluate(() => window.__vulcanStage.openWorkspace('waitlist'));
  await sleep(400);
  await s0.page.fill('#ws-wl-num', '284');
  await s0.page.fill('#ws-wl-note', 'from bonsai signup sheet');
  const saveBtn = await s0.page.locator('.ws-btn.primary', { hasText: /SAVE/ }).first();
  await saveBtn.click();
  await sleep(600);
  out.steps.savedButton = await saveBtn.textContent();
  await s0.page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
  out.steps.savedCard = await cardText(s0.page, 'waitlist');
  out.steps.savedRead = await s0.page.evaluate(() => window.vulcan.consoleWaitlistRead());
  await s0.browser.close().catch(() => {});
  kill(s0.proc);
  await sleep(1500);

  // RELAUNCH — prove persistence
  const s1 = await launch(9252);
  await s1.page.evaluate(() => window.__vulcanStage && window.__vulcanStage.ignite && window.__vulcanStage.ignite());
  await sleep(1500);
  out.steps.persistRead = await s1.page.evaluate(() => window.vulcan.consoleWaitlistRead());
  out.steps.persistCard = await cardText(s1.page, 'waitlist');
  // CLEAR — restore honest default, leave nothing behind
  await s1.page.evaluate(() => window.vulcan.consoleWaitlistWrite({ value: null, note: '' }));
  out.steps.clearedRead = await s1.page.evaluate(() => window.vulcan.consoleWaitlistRead());
  await s1.browser.close().catch(() => {});
  kill(s1.proc);

  const d = out.steps;
  out.ok = !!(d.defaultCard && /—/.test(d.defaultCard.num || '')
    && d.savedCard && /284/.test(d.savedCard.num || '') && /MANUAL/.test(d.savedCard.delta || '')
    && d.savedRead && d.savedRead.value === 284 && /\d{4}-\d{2}-\d{2}/.test(d.savedRead.at || '')
    && d.persistRead && d.persistRead.value === 284
    && d.clearedRead && d.clearedRead.value === null);
} catch (e) {
  out.error = String((e && e.stack) || e);
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);

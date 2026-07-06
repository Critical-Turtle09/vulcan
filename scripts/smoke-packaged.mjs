// Post-pack smoke test: confirm the packaged .app carries v1.4 (present surface,
// trimmed legend) and still holds 60fps.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const APP = path.resolve('release/VULCAN-darwin-arm64/VULCAN.app/Contents/MacOS/VULCAN');
const PORT = 9225;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(APP, [`--remote-debugging-port=${PORT}`], { stdio: 'ignore', detached: true }); proc.unref();
let browser;
for (let i = 0; i < 40 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (_) { await sleep(300); } }
let page = null;
for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) page = p; }
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 15000 });
await page.evaluate(() => window.__vulcanHome.ignite());
await sleep(3500);
await page.evaluate(() => window.__vulcanHome.setState('idle'));
await sleep(1500);
await page.evaluate(() => window.__vulcanHome.presentTest());
await sleep(1500);
const r = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  const keys = document.getElementById('keys')?.innerText.replace(/\s+/g, ' ').trim();
  return {
    present: !!el, free: window.__vulcanHome.panelFree(),
    title: el?.querySelector('.panel-title')?.textContent,
    rows: el?.querySelectorAll('.panel-row').length, list: el?.querySelectorAll('.panel-li').length,
    legend: keys, sceneKeysGone: !/SUMMON REGION|DEVICE|EXPLODE|ORB STATE/.test(keys || ''),
    perf: window.__vulcanHome.perf(),
  };
});
console.log(JSON.stringify(r, null, 2));
await page.screenshot({ path: 'v14-packaged-present.jpeg', quality: 82, type: 'jpeg' });
const pass = r.present && r.free && r.rows >= 4 && r.list >= 3 && r.sceneKeysGone && r.perf.fps >= 58;
console.log(pass ? 'PASS: packaged .app carries v1.4 + holds 60fps' : 'FAIL');
try { await page.evaluate(() => window.__vulcanHome.bank()); } catch (_) {}
await browser.close();
try { proc.kill('SIGKILL'); } catch (_) {}
await sleep(200); process.exit(pass ? 0 : 1);

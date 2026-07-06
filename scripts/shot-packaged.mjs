// PART 3 — quick packaged-app visual + perf check (dpr cap must not visibly degrade).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const APP = path.resolve('release/VULCAN-darwin-arm64/VULCAN.app/Contents/MacOS/VULCAN');
const PORT = 9224;
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
await sleep(2500);
console.log('idle perf:', JSON.stringify(await page.evaluate(() => window.__vulcanHome.perf())));
await page.screenshot({ path: 'p3-after-idle.jpeg', quality: 80, type: 'jpeg' });
await page.evaluate(() => window.__vulcanHome.summon('taiwan'));
await sleep(3500);
console.log('taiwan perf:', JSON.stringify(await page.evaluate(() => window.__vulcanHome.perf())));
await page.screenshot({ path: 'p3-after-taiwan.jpeg', quality: 80, type: 'jpeg' });
try { await page.evaluate(() => window.__vulcanHome.bank()); } catch (_) {}
await browser.close();
try { proc.kill('SIGKILL'); } catch (_) {}
await sleep(200); process.exit(0);

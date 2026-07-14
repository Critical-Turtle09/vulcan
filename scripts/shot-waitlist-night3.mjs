import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const ROOT = path.resolve(process.argv[1], '../..');
const ELECTRON = path.join(ROOT, 'node_modules', '.bin', 'electron');
const SHOT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(ELECTRON, ['.', '--remote-debugging-port=9260'], { cwd: ROOT, stdio: 'ignore', detached: true, env: { ...process.env } });
proc.unref();
let browser = null;
for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9260'); } catch (_) { await sleep(300); } }
let page = null;
for (let i = 0; i < 40 && !page; i++) { for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('localhost') || u.includes('index.html')) page = p; } if (!page) await sleep(300); }
await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
await page.evaluate(() => window.__vulcanStage.ignite());
await sleep(1500);
await page.evaluate(() => window.__vulcanStage.openWorkspace('waitlist'));
await sleep(600);
await page.fill('#ws-wl-num', '284');
await page.fill('#ws-wl-note', 'from bonsai signup sheet');
await sleep(400);
await page.screenshot({ path: SHOT, quality: 82, type: 'jpeg' });
await browser.close().catch(() => {});
try { proc.kill('SIGKILL'); } catch (_) {}
console.log('shot ->', SHOT);
process.exit(0);

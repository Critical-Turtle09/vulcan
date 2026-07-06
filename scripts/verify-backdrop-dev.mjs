// RL-6 visual — summon over a real Chrome-with-tabs window using the DEV electron
// binary (which holds Screen Recording permission), hold the ceremony mid-ignition,
// and screenshot the backdrop beneath the sparks. Requires vite running on :5273.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) a headed Chrome window with three visible tabs, on the display
const chrome = await chromium.launchPersistentContext('/tmp/rl6-chrome-profile', {
  headless: false, viewport: null, args: ['--new-window', '--window-position=100,90', '--window-size=1300,820'],
});
const p0 = chrome.pages()[0] || await chrome.newPage();
await p0.goto('data:text/html,<title>GITHUB</title><body style="background:#0d1117">');
for (const [t, c] of [['VERCEL', '#111'], ['OBSIDIAN', '#2b2233']]) { const p = await chrome.newPage(); await p.goto(`data:text/html,<title>${t}</title><body style="background:${c}">`); }
await sleep(1200);

// 2) launch DEV electron with remote debugging
const PORT = 9227;
const bin = path.resolve('node_modules/.bin/electron');
const proc = spawn(bin, ['.', `--remote-debugging-port=${PORT}`], { stdio: 'ignore', detached: true, env: { ...process.env } });
proc.unref();
let vb;
for (let i = 0; i < 50 && !vb; i++) { try { vb = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (_) { await sleep(300); } }
let vp = null;
for (let i = 0; i < 30 && !vp; i++) {
  for (const c of vb.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('5273') || u.includes('index.html')) vp = p; }
  if (!vp) await sleep(300);
}
await vp.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });

// 3) hide first, then summon FROM HIDDEN (so main captures the clean screen), hold low
await vp.evaluate(() => window.vulcan.requestHide());     // hide instantly (no animation) -> next summon is from-hidden
await sleep(900);
await vp.evaluate(() => window.vulcan.requestSummon());   // main summon(): capture-before-show + ignite
await sleep(1800);                                        // native-res JPEG capture + IPC + kindle
await vp.evaluate(() => window.__vulcanHome.__holdPresence(0.14));  // void-over transparent -> backdrop visible
await sleep(700);

const info = await vp.evaluate(async () => {
  const el = document.getElementById('backdrop'); const cs = getComputedStyle(el); const bg = cs.backgroundImage;
  const m = bg.match(/url\("?(data:[^")]+)"?\)/); let w = 0, h = 0;
  if (m) { const im = new Image(); await new Promise((r) => { im.onload = r; im.onerror = r; im.src = m[1]; }); w = im.naturalWidth; h = im.naturalHeight; }
  return { hasImage: bg !== 'none', urlCount: (bg.match(/url\(/g) || []).length, repeat: cs.backgroundRepeat, size: cs.backgroundSize,
    imgW: w, imgH: h, aspect: w && h ? +(w / h).toFixed(4) : 0, screenAspect: +(screen.width / screen.height).toFixed(4) };
});
console.log(JSON.stringify(info, null, 2));
await vp.screenshot({ path: 'rl6-backdrop-chrome.jpeg', quality: 90, type: 'jpeg' });
try { await vp.evaluate(() => window.__vulcanHome.bank()); } catch (_) {}
await vb.close(); await chrome.close();
try { proc.kill('SIGKILL'); } catch (_) {}
await sleep(200);
const pass = info.hasImage && info.urlCount === 1 && info.repeat === 'no-repeat' && info.size === '100% 100%' && Math.abs(info.aspect - info.screenAspect) < 0.02;
console.log(pass ? 'PASS: single coherent capture beneath the sparks (see rl6-backdrop-chrome.jpeg)' : (info.hasImage ? 'CHECK screenshot' : 'backdrop null'));
process.exit(0);

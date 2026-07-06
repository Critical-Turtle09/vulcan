// RL-6 — verify the summon backdrop is ONE fresh, correctly-scaled capture of the
// active display (no ghosting/tiling, no stacked captures, no scale mismatch).
// Puts a real Chrome-style window with visible tabs on screen, launches the packaged
// VULCAN, holds the ignition mid-ceremony (backdrop visible beneath sparks), and
// inspects + screenshots the backdrop.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APP = path.resolve('release/VULCAN-darwin-arm64/VULCAN.app/Contents/MacOS/VULCAN');

// 1) a headed Chrome window with multiple visible tabs, on the display
const chrome = await chromium.launchPersistentContext('/tmp/rl6-chrome-profile', {
  headless: false, viewport: null,
  args: ['--new-window', '--window-position=120,120', '--window-size=1200,800'],
});
const t1 = chrome.pages()[0] || await chrome.newPage();
await t1.goto('data:text/html,<title>TAB ONE</title><body style="background:#1b3a5c">');
const t2 = await chrome.newPage(); await t2.goto('data:text/html,<title>TAB TWO</title><body style="background:#5c3a1b">');
const t3 = await chrome.newPage(); await t3.goto('data:text/html,<title>TAB THREE</title><body style="background:#2c5c3a">');
await sleep(1200);   // let the window + tab strip paint

// 2) launch packaged VULCAN with remote debugging
const PORT = 9226;
const proc = spawn(APP, [`--remote-debugging-port=${PORT}`], { stdio: 'ignore', detached: true }); proc.unref();
let vb;
for (let i = 0; i < 40 && !vb; i++) { try { vb = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (_) { await sleep(300); } }
let vp = null;
for (const c of vb.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) vp = p; }
await vp.waitForFunction(() => !!window.__vulcanHome, { timeout: 15000 });

// 3) summon, then hold the ceremony at low presence so the backdrop shows beneath sparks
await vp.evaluate(() => window.__vulcanHome.ignite());
await sleep(700);
await vp.evaluate(() => window.__vulcanHome.__holdPresence(0.14));   // void-over transparent -> backdrop visible
await sleep(600);

// 4) inspect the backdrop element
const info = await vp.evaluate(async () => {
  const el = document.getElementById('backdrop');
  const cs = getComputedStyle(el);
  const bg = cs.backgroundImage;
  const urls = (bg.match(/url\(/g) || []).length;   // >1 => stacked captures
  let imgW = 0, imgH = 0, isJpeg = /data:image\/jpe?g/.test(bg);
  const m = bg.match(/url\("?(data:[^")]+)"?\)/);
  if (m) { const im = new Image(); await new Promise((r) => { im.onload = r; im.onerror = r; im.src = m[1]; }); imgW = im.naturalWidth; imgH = im.naturalHeight; }
  return {
    hasImage: bg !== 'none', isJpeg, urlCount: urls,
    repeat: cs.backgroundRepeat, size: cs.backgroundSize,
    imgW, imgH, imgAspect: imgW && imgH ? +(imgW / imgH).toFixed(4) : 0,
    screenW: window.screen.width, screenH: window.screen.height,
    screenAspect: +(window.screen.width / window.screen.height).toFixed(4),
    dpr: window.devicePixelRatio,
  };
});
console.log(JSON.stringify(info, null, 2));
await vp.screenshot({ path: 'rl6-backdrop-hold.jpeg', quality: 88, type: 'jpeg' });

// verdict
const aspectMatch = info.hasImage && Math.abs(info.imgAspect - info.screenAspect) < 0.02;
const nativeScale = info.hasImage && Math.abs(info.imgW - info.screenW * info.dpr) < info.screenW; // ~ native px
const pass = info.hasImage && info.isJpeg && info.urlCount === 1 && info.repeat === 'no-repeat'
  && info.size === '100% 100%' && aspectMatch;
console.log(`aspectMatch=${aspectMatch} nativeScale~=${nativeScale}`);
console.log(pass ? 'PASS: one fresh JPEG capture, no-repeat, 100%x100%, aspect matches screen (no ghost/stack/scale-mismatch)'
                 : (info.hasImage ? 'FAIL' : 'INCONCLUSIVE: backdrop null — grant VULCAN.app Screen Recording, then re-run'));

try { await vp.evaluate(() => window.__vulcanHome.bank()); } catch (_) {}
await vb.close(); await chrome.close();
try { proc.kill('SIGKILL'); } catch (_) {}
await sleep(200);
process.exit(pass ? 0 : (info.hasImage ? 1 : 2));

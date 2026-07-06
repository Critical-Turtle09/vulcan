// PART 10 — MEDIA CAPTURE. Playwright-captures the money shots post-amendments as
// PNG stills + an ignition PNG sequence (ffmpeg -> GIF/MP4 in a follow-up step).
// Heavy media is gitignored; MEDIA-INDEX.md is committed. Run: npm run media
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media');
const SEQ = path.join(MEDIA, 'seq-ignition');
fs.mkdirSync(SEQ, { recursive: true });
const URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const shot = (name) => page.screenshot({ path: path.join(MEDIA, `${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = (fn, ...a) => page.evaluate(([f, args]) => window.__vulcanHome[f](...args), [fn, a]);

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 10000 });
await sleep(1500);

// give the ceremony a desktop-sim backdrop so transparency reads in stills
await page.evaluate(() => { document.getElementById('backdrop').style.background = 'linear-gradient(135deg,#243b6b 0%,#5a2f6e 55%,#8a3a1b 100%)'; });

// --- ignition ceremony: still beats + a sequence for GIF/MP4 ---
await H('__holdPresence', 0.15); await sleep(200); await shot('01-ignition-kindle');
await H('__holdPresence', 0.24); await sleep(200); await shot('02-ignition-strike');
await H('__holdPresence', 0.63); await sleep(200); await shot('03-ignition-title');
// sequence 0.02 -> 1.0
let f = 0;
for (let p = 0.02; p <= 1.001; p += 0.045) {
  await H('__holdPresence', +p.toFixed(3)); await sleep(90);
  await page.screenshot({ path: path.join(SEQ, `f${String(f).padStart(3, '0')}.png`) }); f++;
}
// resolve, drop the sim backdrop
await H('ignite'); await sleep(3200);
await page.evaluate(() => { document.getElementById('backdrop').style.background = ''; });

// --- orb + rings under audio ---
await H('setState', 'idle'); await sleep(1200); await shot('04-orb-idle');
await H('setState', 'speaking'); await H('simAudio', true); await sleep(1100); await shot('05-orb-speaking-rings');
await H('simAudio', false); await H('setState', 'idle'); await sleep(300);

// --- Taiwan summon (real coast + molten routes) + wire ignition ---
await H('summon', 'taiwan'); await sleep(2000); await shot('06-taiwan-summon');
await H('wireInject', 'taiwan', 0, 'HSINCHU EXPORT CURB'); await sleep(800); await shot('07-wire-ignition');

// --- panel resolve ---
await H('openSite', 2); await sleep(750); await shot('08-panel-resolve');
await H('closePanel'); await sleep(500); await H('dismiss'); await sleep(1700);

// --- schematic condense + explode ---
await H('summonSchematic'); await sleep(1900); await shot('09-schematic-assembled');
await H('explode', true); await sleep(1200); await shot('10-schematic-exploded');
await H('dismiss'); await sleep(1700);

// --- quench (live bank, timed) ---
await H('setState', 'idle'); await sleep(200);
await page.evaluate(() => { document.getElementById('backdrop').style.background = 'linear-gradient(135deg,#243b6b 0%,#5a2f6e 55%,#8a3a1b 100%)'; });
await H('bank'); await sleep(700); await shot('11-quench');
await H('ignite'); await sleep(200);

await browser.close();
console.log('media capture complete:', fs.readdirSync(MEDIA).filter((x) => x.endsWith('.png')).length, 'stills,', fs.readdirSync(SEQ).length, 'sequence frames');

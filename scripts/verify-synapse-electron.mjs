// B1 SYNAPSE — end-to-end in the REAL Electron app: renderer → IPC → main-process
// brain → conductor (real key, real router, real ledger) → result over IPC →
// answer panel resolves + VULCAN speaks. Also exercises the announce→voice hook
// (test.write in PRESENT) and reads perf() for the 60fps spot-check.
//   prereqs: vite dev server on :5273 (npm run dev), Ollama serving llama3.2:1b.
//   run: node scripts/verify-synapse-electron.mjs
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });
const page = await app.firstWindow();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; console.error('PAGE ERROR:', e.message); });

await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
// confirm the real bridge is present (Electron, not the vite fallback)
const wired = await page.evaluate(() => ({ conduct: !!window.vulcan?.conduct, testWrite: !!window.vulcan?.testWrite, mode: window.vulcan?.brainMode ? 'ipc' : 'none' }));
console.log('bridge wired:', JSON.stringify(wired));

// ---- 1) real spoken question → real brain → panel + speak ----
const KNOWLEDGE = 'What lithography node does TSMC use for its most advanced chips?';
const r = await page.evaluate((q) => window.__vulcanHome.ask(q), KNOWLEDGE);
console.log('conduct result:', JSON.stringify({ route: r.route, model: r.model, cost_usd: r.cost_usd, day_total_usd: r.day_total_usd, text: (r.text || '').slice(0, 90) + '…' }));
await page.waitForTimeout(900);   // let the panel resolve
const panel = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  return el ? {
    free: window.__vulcanHome.panelFree(),
    eyebrow: el.querySelector('.panel-eyebrow')?.textContent || '',
    title: el.querySelector('.panel-title')?.textContent || '',
    body: (el.querySelector('.panel-note')?.textContent || '').slice(0, 90),
    speaking: window.__vulcanHome.voiceStatus().state,
  } : null;
});
console.log('panel:', JSON.stringify(panel, null, 2));
await page.screenshot({ path: 'b1-electron-answer.jpeg', quality: 82, type: 'jpeg' });

// ---- 2) announce → voice: test.write in PRESENT should emit brain:speak ----
let spokeAnnounce = false;
await page.exposeFunction('__onAnnounceSpeak', () => { spokeAnnounce = true; });
await page.evaluate(() => { const cb = window.__onAnnounceSpeak; if (window.vulcan?.onSpeak) window.vulcan.onSpeak((t) => { window.__lastSpoken = t; cb(); }); });
await page.evaluate(() => window.vulcan.brainMode()).then((m) => console.log('mode:', m));
const wrote = await page.evaluate(() => window.__vulcanHome.testWrite());
await page.waitForTimeout(600);
const lastSpoken = await page.evaluate(() => window.__lastSpoken || null);
console.log('testWrite result:', JSON.stringify(wrote), '| announce spoken:', spokeAnnounce, '| text:', lastSpoken);

// ---- 3) perf spot-check (verify e) ----
await page.waitForTimeout(500);
const perf = await page.evaluate(() => window.__vulcanHome.perf());
console.log('perf:', JSON.stringify(perf));

const routeOk = r.route === 'CLAUDE' || r.route === 'REFLEX';
const chromeOk = panel && (/CLAUDE/.test(panel.eyebrow) || /\[REFLEX\]/.test(panel.eyebrow));
const spokeOk = panel && panel.speaking === 'speaking';
const announceOk = spokeAnnounce && wrote && wrote.announced === true;
const fpsOk = perf && perf.fps >= 55;

console.log(`route=${r.route} panel=${!!panel} chrome=${chromeOk} speaking=${spokeOk} announceSpoke=${announceOk} fps=${perf?.fps}(>=55:${fpsOk})`);
const pass = !pageErr && routeOk && !!panel && panel.free && chromeOk && spokeOk && announceOk && fpsOk;
console.log(pass ? 'PASS: B1 full e2e — real brain over IPC → panel + speak, announce spoken, 60fps held' : 'FAIL');
await app.close();
process.exit(pass ? 0 : 1);

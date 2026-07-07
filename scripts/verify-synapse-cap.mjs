// B1 SYNAPSE — verify (c): the BANKED path in the real app. Plant the ledger at
// $1.99, ask a knowledge question through the live app, and confirm it comes
// back as a [REFLEX] answer panel while the ledger stays untouched (the router
// never even spends, because the whole-answer budget gate trips first).
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(os.homedir(), '.vulcan', 'ledger.json');
const BAK = LEDGER + '.capbak';

// snapshot + plant $1.99 for today
fs.copyFileSync(LEDGER, BAK);
const d = new Date(), z = (n) => String(n).padStart(2, '0');
const day = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
fs.writeFileSync(LEDGER, JSON.stringify({ date: day, calls: [], total_usd: 1.99 }, null, 2));
console.log('planted ledger:', JSON.parse(fs.readFileSync(LEDGER, 'utf8')));

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });
const page = await app.firstWindow();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });

const r = await page.evaluate((q) => window.__vulcanHome.ask(q), 'Give a detailed history of EUV lithography development.');
await page.waitForTimeout(800);
const panel = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  return el ? { eyebrow: el.querySelector('.panel-eyebrow')?.textContent || '', speaking: window.__vulcanHome.voiceStatus().state } : null;
});
await page.screenshot({ path: 'b1-electron-reflex-cap.jpeg', quality: 82, type: 'jpeg' });
await app.close();

const after = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
console.log('conduct route:', r.route, '| reason:', r.reason, '| panel eyebrow:', panel && panel.eyebrow, '| speaking:', panel && panel.speaking);
console.log('ledger after:', { total_usd: after.total_usd, calls: after.calls.length });

// restore the real ledger
fs.copyFileSync(BAK, LEDGER); fs.rmSync(BAK, { force: true });
console.log('ledger restored:', JSON.parse(fs.readFileSync(LEDGER, 'utf8')).total_usd);

const untouched = after.total_usd === 1.99 && after.calls.length === 0;
const reflexPanel = panel && /\[REFLEX\]/.test(panel.eyebrow);
const pass = !pageErr && r.route === 'REFLEX' && r.reason === 'CAP' && reflexPanel && untouched;
console.log(pass ? 'PASS: banked path — [REFLEX] panel at cap, ledger untouched' : 'FAIL');
process.exit(pass ? 0 : 1);

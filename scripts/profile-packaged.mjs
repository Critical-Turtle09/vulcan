// RL-5 v2 · PART 3 — PACKAGED-APP FRAME-TIME PROFILER.
// Launches the built .app with remote debugging, attaches over CDP (so we measure
// the REAL packaged renderer, not the dev server), drives it through every state,
// and reports frame-time percentiles + long-frame (jank) counts. Evidence for the
// before/after perf capture.
//
//   node scripts/profile-packaged.mjs [label]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const LABEL = process.argv[2] || 'run';
const APP = path.resolve('release/VULCAN-darwin-arm64/VULCAN.app/Contents/MacOS/VULCAN');
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(APP, [`--remote-debugging-port=${PORT}`], { stdio: 'ignore', detached: true });
proc.unref();

async function connect() {
  for (let i = 0; i < 40; i++) {
    try { return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); }
    catch (_) { await sleep(300); }
  }
  throw new Error('could not attach CDP to packaged app');
}

// install a rAF sampler in the page; returns {n,p50,p95,p99,max,long16,long33,mean}
const SAMPLER = () => {
  window.__frames = [];
  let last = performance.now();
  const tick = () => { const n = performance.now(); window.__frames.push(n - last); last = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__frameStats = (fromIdx) => {
    const a = window.__frames.slice(fromIdx).filter((x) => x > 0 && x < 500).sort((p, q) => p - q);
    if (!a.length) return null;
    const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
    return {
      n: a.length,
      mean: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2),
      p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +a[a.length - 1].toFixed(2),
      long16: a.filter((x) => x > 16.7).length, long33: a.filter((x) => x > 33).length,
    };
  };
  window.__frameLen = () => window.__frames.length;
};

const browser = await connect();
const ctxs = browser.contexts();
let page = null;
for (const c of ctxs) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) page = p; }
if (!page) { for (const c of ctxs) for (const p of c.pages()) page = p; }
if (!page) throw new Error('no renderer page found');

await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 15000 });
await page.evaluate(SAMPLER);

const phases = [];
async function phase(name, ms, setup) {
  if (setup) await page.evaluate(setup);
  const from = await page.evaluate(() => window.__frameLen());
  await sleep(ms);
  const stats = await page.evaluate((f) => window.__frameStats(f), from);
  phases.push({ name, ...stats });
  console.log(`  ${name.padEnd(22)} n=${String(stats.n).padStart(4)} mean=${String(stats.mean).padStart(6)}ms p50=${String(stats.p50).padStart(6)} p95=${String(stats.p95).padStart(6)} p99=${String(stats.p99).padStart(6)} max=${String(stats.max).padStart(7)} jank>16=${stats.long16} >33=${stats.long33}`);
}

console.log(`\n=== PACKAGED PROFILE [${LABEL}] ===`);
// ensure the overlay is up and orb resolved
await page.evaluate(() => { window.__vulcanHome.ignite && window.__vulcanHome.ignite(); });
await sleep(3200); // full ignition ceremony (shader compile stalls surface HERE)
await phase('ignition+resolve', 3200, () => { window.__vulcanHome.ignite && window.__vulcanHome.ignite(); });
await phase('idle', 4000, () => window.__vulcanHome.setState('idle'));
await phase('listening', 3000, () => { window.__vulcanHome.setState('listening'); window.__vulcanHome.simAudio(true); });
await phase('thinking', 3000, () => window.__vulcanHome.setState('thinking'));
await phase('speaking', 3000, () => window.__vulcanHome.setState('speaking'));
await phase('summon-taiwan', 4000, () => { window.__vulcanHome.simAudio(false); window.__vulcanHome.setState('idle'); window.__vulcanHome.summon('taiwan'); });
await phase('theater-idle', 3000, () => {});
await phase('wire-event', 3000, () => window.__vulcanHome.wireInject('taiwan', 0, 'SIM SUPPLY DISRUPTION'));
await phase('return-home', 3500, () => window.__vulcanHome.dismiss());

const all = phases.flatMap((p) => []);
const worst = phases.reduce((a, b) => (b.p99 > a.p99 ? b : a));
const totalJank16 = phases.reduce((s, p) => s + p.long16, 0);
const totalJank33 = phases.reduce((s, p) => s + p.long33, 0);
console.log(`  --- worst p99: ${worst.name} @ ${worst.p99}ms · total jank frames >16.7ms=${totalJank16} >33ms=${totalJank33}`);
console.log(JSON.stringify({ label: LABEL, phases, worst: worst.name, totalJank16, totalJank33 }));

try { await page.evaluate(() => { window.__vulcanHome.bank && window.__vulcanHome.bank(); }); } catch (_) {}
await browser.close();
try { process.kill(-proc.pid); } catch (_) {}
try { proc.kill('SIGKILL'); } catch (_) {}
await sleep(300);
process.exit(0);

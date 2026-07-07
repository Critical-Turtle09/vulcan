// B4 verify — launch the LIVE app, summon, run "brief me" through the real
// conduct→present→speak path, screenshot the [SKILL·WIRE] briefing panel, and
// prove VULCAN 1 speaks (metered) while the frame holds 60fps.  node scripts/verify-b4.mjs
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'b4-wire-briefing.jpeg');

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });
const voiceLog = [];
app.process().stdout.on('data', (d) => {
  for (const l of d.toString().split('\n')) {
    if (l.includes('[VOICE]')) { console.log(l.trim()); voiceLog.push(l.trim()); }
  }
});

const page = await app.firstWindow();
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
await page.waitForTimeout(2500);

console.log('voice status:', JSON.stringify(await page.evaluate(() => window.__vulcanHome.voiceStatus())));

// SUMMON — resolve the orb-home over the void floor.
await page.evaluate(() => window.__vulcanHome.simWake());
await page.waitForTimeout(3600);

// BRIEF — full mouth-to-screen path: conduct("brief me") → present panel → speak.
console.log('· conducting "brief me"…');
const r = await page.evaluate(() => window.__vulcanHome.ask('brief me'));
console.log('result:', JSON.stringify({ route: r.route, skill: r.skill, action: r.action, reflex: r.reflex, degraded: r.degraded, cost_usd: r.cost_usd, title: r.panel && r.panel.title, rows: r.panel && (r.panel.lines || []).length, hasBody: !!(r.panel && r.panel.body) }));

// let the panel resolve per-glyph, then screenshot mid-speech (perf sampled here).
await page.waitForTimeout(1800);
const perf = await page.evaluate(() => window.__vulcanHome.perf());
console.log('perf (during speech):', JSON.stringify(perf));
await page.screenshot({ path: OUT });
console.log('screenshot →', OUT);

// hold for the full line to play, sample perf again, then exit.
await page.waitForTimeout(7000);
console.log('perf (settled):', JSON.stringify(await page.evaluate(() => window.__vulcanHome.perf())));
console.log('VOICE lines seen:', voiceLog.length);
await app.close();

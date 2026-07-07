// B2 HANDS I — REPO COMMANDER — full e2e in the REAL Electron app.
//   (a) read: "what's the latest commit" → [SKILL·REPO] panel with the real
//       master tip, spoken, zero API spend.
//   (b) WRITE_CONFIRM: "tag the forge as v2-b2-drill" → CONFIRM panel + spoken
//       prompt → decision "confirm" → tag created + pushed → DONE panel.
//   (c) same, decision "cancel" → aborted, nothing created.
//   (d) AWAY: tag request → queued to the report, never executed; PRESENT restored.
//   (e) 60fps spot-check; mic path untouched (voice loop offline → no mic opened).
import { _electron as electron } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = path.join(os.homedir(), '.vulcan', 'mode');
const REPORT = path.join(os.homedir(), '.vulcan', `report-${new Date().toISOString().slice(0, 10)}.md`);
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT }).toString().trim(); } catch (_) { return ''; } };
const localTags = () => git('tag', '--list').split('\n').filter(Boolean);

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });
const page = await app.firstWindow();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; console.error('PAGE ERROR:', e.message); });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
const wired = await page.evaluate(() => ({ conduct: !!window.vulcan?.conduct, confirm: !!window.vulcan?.confirm }));
console.log('bridge:', JSON.stringify(wired));

const panelOf = () => page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  return el ? {
    eyebrow: el.querySelector('.panel-eyebrow')?.textContent || '',
    title: el.querySelector('.panel-title')?.textContent || '',
    lines: Array.from(el.querySelectorAll('.panel-li .pv')).map((x) => x.textContent),
    body: el.querySelector('.panel-note')?.textContent || '',
    speaking: window.__vulcanHome.voiceStatus().state,
  } : null;
});

// ---- (a) READ: latest commit ----
const realTip = git('rev-parse', '--short', 'HEAD');
const readR = await page.evaluate((t) => window.__vulcanHome.repoAsk(t), "what's the latest commit");
await page.waitForTimeout(900);
const readP = await panelOf();
await page.screenshot({ path: 'b2-read-status.jpeg', quality: 82, type: 'jpeg' });
console.log('(a) read:', JSON.stringify({ route: readR.route, cost: readR.cost_usd, eyebrow: readP?.eyebrow, tip: realTip, hasTip: JSON.stringify(readP?.lines).includes(realTip), speaking: readP?.speaking }));

// ---- (b) WRITE_CONFIRM confirm → create + push v2-b2-drill ----
const TAG = 'v2-b2-drill';
if (localTags().includes(TAG)) { git('tag', '-d', TAG); }   // clean slate locally
const pend = await page.evaluate((t) => window.__vulcanHome.repoAsk(t), `tag the forge as ${TAG}`);
await page.waitForTimeout(700);
const pendP = await panelOf();
await page.screenshot({ path: 'b2-tag-confirm-prompt.jpeg', quality: 82, type: 'jpeg' });
console.log('(b) prompt:', JSON.stringify({ needsConfirm: pend.needsConfirm, eyebrow: pendP?.eyebrow, speaking: pendP?.speaking, prompt: pend.confirmPrompt?.slice(0, 60) }));
const done = await page.evaluate((a) => window.__vulcanHome.repoConfirm(a, 'confirm'), pend);
await page.waitForTimeout(1000);
const doneP = await panelOf();
await page.screenshot({ path: 'b2-tag-confirmed.jpeg', quality: 82, type: 'jpeg' });
console.log('(b) done:', JSON.stringify({ confirmed: done.confirmed, eyebrow: doneP?.eyebrow, lines: doneP?.lines, speak: done.text }));

// ---- (c) WRITE_CONFIRM cancel → nothing created ----
const CANCEL_TAG = 'b2-cancel-check';
const pend2 = await page.evaluate((t) => window.__vulcanHome.repoAsk(t), `tag the forge as ${CANCEL_TAG}`);
await page.waitForTimeout(500);
const cancelled = await page.evaluate((a) => window.__vulcanHome.repoConfirm(a, 'cancel'), pend2);
await page.waitForTimeout(500);
console.log('(c) cancel:', JSON.stringify({ aborted: cancelled.aborted, text: cancelled.text, tagCreated: localTags().includes(CANCEL_TAG) }));

// ---- (d) AWAY: tag request queues, never executes ----
const AWAY_TAG = 'b2-away-check';
fs.writeFileSync(MODE, 'AWAY\n');
const awayR = await page.evaluate((t) => window.__vulcanHome.repoAsk(t), `tag the forge as ${AWAY_TAG}`);
await page.waitForTimeout(400);
const reportHasTag = fs.existsSync(REPORT) && /\*\*repo\.tag\*\*/.test(fs.readFileSync(REPORT, 'utf8'));
fs.writeFileSync(MODE, 'PRESENT\n');
console.log('(d) away:', JSON.stringify({ route: awayR.route, queued: awayR.queued, needsConfirm: !!awayR.needsConfirm, tagCreated: localTags().includes(AWAY_TAG), reportHasRepoTag: reportHasTag }));

// ---- (e) fps ----
await page.waitForTimeout(400);
const perf = await page.evaluate(() => window.__vulcanHome.perf());
console.log('(e) perf:', JSON.stringify(perf));
await app.close();

// ---- verdicts ----
const remoteHasTag = git('ls-remote', '--tags', 'origin').includes(`refs/tags/${TAG}`);
console.log(`remote has ${TAG}: ${remoteHasTag}`);
const pass = !pageErr
  && readR.route === 'SKILL' && readR.cost_usd === 0 && /\[SKILL·REPO\]/.test(readP?.eyebrow || '') && JSON.stringify(readP?.lines).includes(realTip)
  && pend.needsConfirm && /CONFIRM/.test(pendP?.eyebrow || '') && pendP?.speaking === 'speaking'
  && done.confirmed && /DONE/.test(doneP?.eyebrow || '') && JSON.stringify(doneP?.lines).includes(TAG) && remoteHasTag
  && cancelled.aborted && !localTags().includes(CANCEL_TAG)
  && awayR.queued && !awayR.needsConfirm && !localTags().includes(AWAY_TAG) && reportHasTag
  && perf && perf.fps >= 55;
console.log(pass ? `PASS: B2 repo commander — reads, spoken confirm→push (${TAG} on remote), cancel, away-queue, 60fps` : 'FAIL');
process.exit(pass ? 0 : 1);

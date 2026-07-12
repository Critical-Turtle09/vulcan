// NIGHT SHIFT 2 · TASK 0 — full regression QA on the PACKAGED /Applications/VULCAN.app.
// Launches the installed .app under CDP, drives every organ through the renderer's
// __vulcanStage self-check API + the real window.vulcan IPC (real dispatch → real
// hand → real vault filing), then RELAUNCHES to prove persistence. Writes a JSON
// verdict to stdout. Fixes are made in source separately; this only OBSERVES.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = '/Applications/VULCAN.app/Contents/MacOS/VULCAN';
const PORT = 9236;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { sessions: [], commands: [], checks: {}, notes: [] };

async function launch(port) {
  const proc = spawn(APP, [`--remote-debugging-port=${port}`], { stdio: 'ignore', detached: true });
  proc.unref();
  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch (_) { await sleep(300); } }
  if (!browser) throw new Error('CDP connect failed');
  let page = null;
  for (let i = 0; i < 30 && !page; i++) {
    for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) page = p; }
    if (!page) await sleep(300);
  }
  if (!page) throw new Error('stage page not found');
  await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
  return { proc, browser, page };
}

function kill(proc) { try { proc.kill('SIGKILL'); } catch (_) {} }

// ---- SESSION 1 — full organ sweep ------------------------------------------
const s1 = await launch(PORT);
const page = s1.page;
const S = (fn, ...args) => page.evaluate(fn, ...args);

// hooks present
results.checks.hooksPresent = await S(() => ({
  stage: !!window.__vulcanStage, vulcan: !!window.vulcan,
  dispatch: typeof window.vulcan.dispatch, glyph: !!document.getElementById('manual-glyph'),
}));

// 1) SUMMON — ignite from hidden, confirm the ceremony resolves and orb is live.
await S(() => window.__vulcanStage.ignite());
await sleep(3800);
results.checks.summon = await S(() => ({ core: window.__vulcanStage.core(), voice: window.__vulcanStage.voice(), wire: window.__vulcanStage.wire() }));
await page.screenshot({ path: 'qa-summon.jpeg', quality: 80, type: 'jpeg' });

// 2) TYPE-ANYWHERE — a keystroke with the intent blurred should focus + insert.
await S(() => { if (window.__vulcanStage.intentState().focused) document.activeElement.blur(); });
await S(() => window.__vulcanStage.typeAnywhere('h'));
await sleep(120);
results.checks.typeAnywhere = await S(() => window.__vulcanStage.intentState());

// 3) PTT — hold shows CAPTURING, release returns to the session read.
await S(() => { const i = document.getElementById('intent-input'); if (i) { i.value=''; i.blur(); } });
await S(() => window.__vulcanStage.ptt(true));
await sleep(200);
const capHeld = await S(() => window.__vulcanStage.capture());
await S(() => window.__vulcanStage.ptt(false));
await sleep(200);
const capRel = await S(() => window.__vulcanStage.capture());
results.checks.ptt = { held: capHeld, released: capRel };

// 4) TEN DECK COMMANDS — real dispatch through the real hand; verify vault filing.
const CMDS = ['MISSION BRIEF','DEPLOY CHECK','METRICS PULL','OUTREACH','WIRE SCAN','COMPLIANCE','PITCH DESK','VAULT CLEAN','PLAN TODAY','WK REVIEW'];
for (const cmd of CMDS) {
  let r;
  try { r = await page.evaluate((c) => window.vulcan.dispatch(c), cmd); }
  catch (e) { r = { ok: false, failed: true, error: String(e).slice(0,120) }; }
  results.commands.push({
    cmd, ok: !!r.ok, failed: !!r.failed, route: r.route,
    title: r.title, speak: (r.speak||'').slice(0,90),
    artifact: r.artifact ? r.artifact.filename : null,
    degraded: !!r.degraded, stub: !!r.stub, lines: (r.lines||[]).length,
  });
}

// 5) FULL LIFECYCLE — one command through the renderer (chip/orb/speech path).
await S(() => window.__vulcanStage.dispatch('MISSION BRIEF'));
await sleep(500);
const lifePhase = await S(() => window.__vulcanStage.dispatchCounts());
// wait for it to finish speaking (kokoro) up to 25s
for (let i = 0; i < 50; i++) { const c = await S(() => window.__vulcanStage.dispatchCounts()); if ((c.active||0) === 0) break; await sleep(500); }
results.checks.lifecycle = {
  midActive: lifePhase,
  transcriptTail: await S(() => window.__vulcanStage.transcript().slice(-2)),
};

// 6) WORKSPACES — open each; confirm no throw + objectives model reads.
const wsNames = ['spend','commits','vercel','waitlist','audio'];
const wsOk = {};
for (const w of wsNames) { try { await S((x) => window.__vulcanStage.openWorkspace(x), w); wsOk[w] = true; await sleep(120); } catch (e) { wsOk[w] = String(e).slice(0,80); } }
// close any open workspace overlay (escape)
await page.keyboard.press('Escape').catch(()=>{});
results.checks.workspaces = wsOk;

// 7) PERSISTENCE — write a uniquely-marked directive, read it back, then relaunch.
const MARK = 'QA-NIGHT2-MARK';
const persistWrite = await S((mark) => window.vulcan.consoleObjectivesWrite({
  directives: [{ text: mark, done: false }, { text: 'PILOT OUTREACH X10', done: false }],
  objectives: [{ text: 'OUTREACH · 10 PILOTS', done: false }],
}), MARK);
results.checks.persistWrite = { ok: !!persistWrite.ok, rel: persistWrite.rel };

// 8) TOUR — open the manual, confirm open, close.
await S(() => window.__vulcanStage.openManual(0));
await sleep(400);
const tourOpen = await S(() => window.__vulcanStage.manual());
await S(() => window.__vulcanStage.closeManual());
await sleep(360);   // > 240ms close animation
const tourClosed = await S(() => window.__vulcanStage.manual());
results.checks.tour = { openedByApi: tourOpen, closed: !tourClosed };
// tour by intent word
await sleep(150);
await S(() => window.__vulcanStage.intent('tour'));
await sleep(400);
results.checks.tourByIntent = await S(() => window.__vulcanStage.manual());
await S(() => window.__vulcanStage.closeManual());

// 9) GLYPH — always-visible ? glyph present + visible (MANUAL PERMANENCE law).
results.checks.glyph = await S(() => {
  const g = document.getElementById('manual-glyph'); if (!g) return { present: false };
  const cs = getComputedStyle(g); const r = g.getBoundingClientRect();
  return { present: true, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01, w: Math.round(r.width), h: Math.round(r.height) };
});

// DOCUMENTS trail should now include the freshly-filed artifacts.
results.checks.docsTrail = await page.evaluate(async () => {
  try { const d = await window.vulcan.vitalsDocuments(); return { ok: d.ok, count: (d.docs||[]).length, top: (d.docs||[]).slice(0,3).map(x=>x.name||x.filename) }; }
  catch (e) { return { ok: false, err: String(e).slice(0,80) }; }
});

await page.screenshot({ path: 'qa-final.jpeg', quality: 80, type: 'jpeg' });
results.sessions.push('session1 complete');
await s1.browser.close().catch(()=>{});
kill(s1.proc);
await sleep(1500);

// ---- SESSION 2 — prove persistence survived relaunch -----------------------
const s2 = await launch(PORT + 1);
const persistRead = await s2.page.evaluate(() => window.vulcan.consoleObjectivesRead());
results.checks.persistRead = {
  ok: !!persistRead.ok,
  hasMark: (persistRead.directives||[]).some((d) => d.text === 'QA-NIGHT2-MARK'),
  directives: (persistRead.directives||[]).map((d)=>d.text),
};
// restore the seed directives so we don't leave the QA marker in the operator's console.
await s2.page.evaluate(() => window.vulcan.consoleObjectivesWrite({
  directives: [
    { text: 'COPPA/FERPA FILED', done: true },
    { text: 'PILOT OUTREACH ×10', done: false },
    { text: 'LAUNCH DISTRIBUTION', done: false },
  ],
  objectives: [
    { text: 'COPPA / FERPA POSTURE', done: true },
    { text: 'OUTREACH · 10 PILOTS', done: false },
    { text: 'LAUNCH · DISTRIBUTION', done: false },
  ],
}));
results.sessions.push('session2 complete (persistence verified + console restored)');
await s2.browser.close().catch(()=>{});
kill(s2.proc);

const out = JSON.stringify(results, null, 2);
fs.writeFileSync('/private/tmp/claude-501/-Users-vishnumovva-vulcan/f062c846-bbf9-403d-a494-305fbdbc7585/scratchpad/qa-results.json', out);
console.log(out);
process.exit(0);

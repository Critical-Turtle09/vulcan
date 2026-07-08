// S2 THE TRIGGER — THE LIVE OPERATOR DRILL (v1.5.1, PTT · NS3-hardened). Drives the REAL
// app with REAL ears (Wispr Flow / whisper) + REAL mouth (ElevenLabs), prints exactly what
// to SAY, and asserts the hot-session cycle from the operator's ACTUAL VOICE under PTT:
//
//   MIC OPEN + say "Fire and Forge" → 2 spoken questions with NO re-wake →
//   MIC OPEN + "Bank the fire" → MIC OPEN + "Fire and Forge" (re-arm).
//
// The drill opens the mic for you (pttDown), gives you a COUNTDOWN to speak, then closes
// it (pttUp) → the clip transcribes + routes. You do not touch a key. Hold window:
// VULCAN_PTT_HOLD_MS (default 6000ms). Nothing is simulated.
//
// NS3 HARDENING (why tonight's TikTok incident can't recur):
//   • SINGLE-DRIVER LOCK — refuses to start if another driver is already attached.
//   • CLEAN DETACH — on Ctrl-C / SIGTERM / terminal loss the driver RELEASES any held
//     trigger (mic closes) and detaches. An orphaned open mic is impossible.
//   • OPERATOR-ONLY CUES — the countdown says ">>> MIC OPEN — SPEAK NOW <<<" (an
//     instruction to YOU), never a narration of the script's own actions.
//
// SINGLE-INSTANCE SAFETY: auto-ATTACHES to a running VULCAN over CDP (VULCAN_CDP, default
// 9222). Stage ONE clean instance with --remote-debugging-port=9222; the drill drives THAT
// one. If nothing is reachable it falls back to launching its own.
//
//   prereqs: ONE VULCAN on :5273 with CDP 9222, real .env (WHISPER_* + ELEVENLABS_API_KEY).
//   run: node scripts/hear-vulcan.mjs
import { _electron as electron, chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, releaseLock, createHoldGuard, LOCK_PATH } from './lib/drill.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CDP = process.env.VULCAN_CDP || '9222';
const HOLD_MS = +(process.env.VULCAN_PTT_HOLD_MS || 6000);   // NS3 — 6s bake-in default
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? '✅ PASS' : '❌ FAIL'} · ${m}`); c ? pass++ : fail++; return c; };
const say = (s) => console.log(`\n\x1b[1m\x1b[38;5;208m🗣  SAY:  “${s}”\x1b[0m`);
const note = (s) => console.log(`\x1b[2m   ${s}\x1b[0m`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- (1a) SINGLE-DRIVER LOCK — refuse to start if another driver is already attached ----
const lock = acquireLock();
if (!lock.ok) {
  if (lock.holderPid) console.error(`\n❌ Another hear-vulcan driver is already attached (pid ${lock.holderPid}).\n   Refusing to start — one driver only, so two never fight for the mic.\n   Lock: ${LOCK_PATH}  (kill the other driver, or remove the lock if it is stale.)`);
  else console.error(`\n❌ Could not acquire the driver lock: ${lock.error || 'unknown'}`);
  process.exit(3);
}

// ---- attach to a running instance over CDP (preferred) — else launch our own ----
let app = null, page = null, browser = null, attached = false;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`, { timeout: 3000 });
  const ctx = browser.contexts()[0];
  page = ctx.pages().find(Boolean) || await ctx.waitForEvent('page', { timeout: 3000 });
  await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 6000 });
  attached = true;
  console.log(`· attached to the running VULCAN instance over CDP :${CDP} (single-instance — no second app spawned)`);
} catch (_) {
  console.log('· no running instance on CDP — launching one (LIVE: real key + mic)');
  app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });
  app.process().stdout.on('data', (d) => { for (const l of d.toString().split('\n')) if (l.includes('[VOICE]') || l.includes('[GATE-WATCHDOG]')) console.log('\x1b[2m  ' + l.trim() + '\x1b[0m'); });
  page = await app.firstWindow();
}
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
await page.waitForTimeout(1500);

const status = () => page.evaluate(() => window.__vulcanHome.voiceStatus());

// ---- (1c) HOLD GUARD + CLEAN DETACH — a held trigger is ALWAYS released on shutdown ----
const guard = createHoldGuard({
  pttDown: () => page.evaluate(() => window.__vulcanHome.pttDown()),
  pttUp: () => page.evaluate(() => window.__vulcanHome.pttUp()),
});
let logTimer = null, shuttingDown = false;
async function shutdown(reason, code = 0) {
  if (shuttingDown) return; shuttingDown = true;
  try { if (logTimer) clearInterval(logTimer); } catch (_) {}
  console.log(`\n\x1b[2m· detaching (${reason}) — releasing any held trigger so the mic closes…\x1b[0m`);
  try { await guard.release(); } catch (_) {}          // mic closes even mid-hold
  try {
    if (app) await app.close();                        // we launched it -> close the app (mic fully released)
    else if (browser) await browser.close();           // attached -> disconnect CDP (do NOT kill the operator's instance)
  } catch (_) {}
  releaseLock();
  process.exit(code);
}
// Ctrl-C, kill, and terminal loss (SIGHUP) all release + detach. stdout close = pipe gone.
process.on('SIGINT', () => shutdown('SIGINT', 130));
process.on('SIGTERM', () => shutdown('SIGTERM', 143));
process.on('SIGHUP', () => shutdown('SIGHUP · terminal loss', 129));
process.stdout.on('error', () => shutdown('stdout closed', 0));

const cfg = await status();
console.log('\nVULCAN · S2 THE TRIGGER — LIVE OPERATOR DRILL (PTT)\n');
console.log('voice status:', JSON.stringify(cfg));
if (!cfg.online || cfg.mode !== 'live') {
  console.error(`\n❌ Voice is not LIVE (mode=${cfg.mode}, reason=${cfg.offlineReason || 'n/a'}).`);
  console.error('   The live drill needs a real ear (VULCAN_WISPR_KEY or WHISPER_BIN/MODEL) AND ELEVENLABS_API_KEY in .env.');
  await shutdown('not-live', 2);
}

// live session/state transition logger — prints every change as it happens
let lastKey = '';
logTimer = setInterval(async () => {
  try { const s = await status(); const k = `${s.session}:${s.state}`; if (k !== lastKey) { lastKey = k; console.log(`\x1b[36m      · ${s.session.toUpperCase()} / ${s.state}\x1b[0m`); } } catch (_) {}
}, 120);

async function waitFor(fn, arg, timeoutMs, label) {
  try { await page.waitForFunction(fn, arg, { timeout: timeoutMs, polling: 120 }); return true; }
  catch (_) { console.log(`\x1b[31m      (timed out waiting for ${label})\x1b[0m`); return false; }
}
const waitSession = (s, ms, label) => waitFor((x) => window.__vulcanHome.voiceStatus().session === x, s, ms, label);
const waitState = (s, ms, label) => waitFor((x) => window.__vulcanHome.voiceStatus().state === x, s, ms, label);

// bracket ONE spoken clip: open the mic, count the operator down, close it -> transcribe.
// (1b) The cue is an INSTRUCTION to the operator, with a live countdown — never narration.
async function hold(prompt) {
  say(prompt);
  await guard.down();                                   // mic opens
  const secs = Math.max(1, Math.round(HOLD_MS / 1000));
  for (let s = secs; s > 0; s--) {
    process.stdout.write(`\r\x1b[1m\x1b[38;5;208m   >>> MIC OPEN — SPEAK NOW <<<   ${s}s \x1b[0m   `);
    await sleep(1000);
  }
  process.stdout.write('\r\x1b[2m   (mic closed — VULCAN is transcribing…)                 \x1b[0m\n');
  await guard.up();                                     // mic closes -> clip routes
}

async function exchange(prompt, n) {
  await hold(prompt);
  const spoke = await waitState('speaking', 40000, 'VULCAN to speak');
  const back = await waitState('listening', 60000, 'VULCAN to return to listening');
  const s = await status();
  return ok(spoke && back && s.session === 'attentive', `exchange ${n}: answered and returned to LISTENING, still ATTENDING (no re-wake)`);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(' PUSH-TO-TALK. The drill opens the mic for you. When you see');
console.log(' ">>> MIC OPEN — SPEAK NOW <<<", speak the line above it clearly.');
console.log(' VULCAN answers aloud. (Ctrl-C any time — the mic closes cleanly.)');
console.log('──────────────────────────────────────────────────────────────');

// 1) SUMMON (spoken wake phrase)
await hold('Fire and Forge');
note('(the full ignition should play, and VULCAN should enter the hot session)');
ok(await waitSession('attentive', 45000, 'ATTENTIVE after the wake phrase'), 'spoken "Fire and Forge" → ATTENTIVE (hot session)');
await waitState('listening', 20000, 'listening');

// 2) TWO EXCHANGES, NO RE-WAKE
await exchange('What is our status?', 1);
await exchange('What can you do?', 2);

// 3) BANK → DORMANT (spoken dismiss phrase)
await hold('Bank the fire');
note('(the quench should play and VULCAN should go dormant — wake phrase only)');
ok(await waitSession('dormant', 30000, 'DORMANT after "Bank the fire"'), 'bank → DORMANT');

// 4) RE-SUMMON — THE RE-ARM
console.log('\n\x1b[1m--- RE-ARM: summon again ---\x1b[0m');
await hold('Fire and Forge');
ok(await waitSession('attentive', 45000, 'ATTENTIVE on re-summon'), 're-summon after bank → ATTENTIVE (RE-ARM WORKS)');
await waitState('listening', 20000, 'listening');

// close out
await hold('Bank the fire');
await waitSession('dormant', 30000, 'DORMANT');

clearInterval(logTimer); logTimer = null;
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`\n=== ${fail === 0 ? '✅ LIVE DRILL PASSED' : '❌ LIVE DRILL FAILED'} · ${pass} pass · ${fail} fail ===`);
// Clean, deterministic exit: never leave the driver (or a held mic) resident. If we
// launched the app, close it; if attached, disconnect. The lock is released either way.
await shutdown(attached ? 'drill complete · detach' : 'drill complete · close', fail === 0 ? 0 : 1);

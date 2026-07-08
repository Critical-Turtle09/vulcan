// S1 THE ATTENDANT — THE LIVE OPERATOR DRILL (v1.5). Launches the REAL app with
// REAL ears (whisper) + REAL mouth (ElevenLabs), prints exactly what to SAY, watches
// the live session/state log, and asserts the full hot-session cycle from the
// operator's ACTUAL VOICE:
//
//   summon ("Fire and Forge") → 3 exchanges with NO re-wake → bank ("Bank the fire")
//   → re-summon ("Fire and Forge") → 2 more exchanges.
//
// This is the acceptance test-mode ears may NOT carry (the v1.4 re-summon defect only
// reproduces on the real mic + real TTS playback). Nothing is simulated here.
//
// SINGLE-INSTANCE SAFETY: this drill AUTO-ATTACHES to an already-running VULCAN over
// CDP (VULCAN_CDP port, default 9222) instead of spawning a second app. That is how it
// is meant to run — the operator (or the setup step) launches ONE clean instance with
// `--remote-debugging-port=9222`; the drill drives THAT one. If nothing is reachable it
// falls back to launching its own. (A stale second instance was what corrupted the
// first run — never drive with two apps fighting for the mic.)
//
//   prereqs: ONE VULCAN on :5273 with CDP 9222, real .env (WHISPER_* + ELEVENLABS_API_KEY).
//   run: node scripts/hear-vulcan.mjs
import { _electron as electron, chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CDP = process.env.VULCAN_CDP || '9222';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? '✅ PASS' : '❌ FAIL'} · ${m}`); c ? pass++ : fail++; return c; };
const say = (s) => console.log(`\n\x1b[1m\x1b[38;5;208m🗣  SAY:  “${s}”\x1b[0m`);
const note = (s) => console.log(`\x1b[2m   ${s}\x1b[0m`);

// attach to a running instance over CDP (preferred) — else launch our own.
let app = null, page = null, attached = false;
try {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`, { timeout: 3000 });
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
const cfg = await status();
console.log('\nVULCAN · S1 THE ATTENDANT — LIVE OPERATOR DRILL\n');
console.log('voice status:', JSON.stringify(cfg));
if (!cfg.online || cfg.mode !== 'live') {
  console.error(`\n❌ Voice is not LIVE (mode=${cfg.mode}, reason=${cfg.offlineReason || 'n/a'}).`);
  console.error('   The live drill needs a real mic (WHISPER_BIN/WHISPER_MODEL) AND ELEVENLABS_API_KEY in .env.');
  await app.close(); process.exit(2);
}

// live session/state transition logger — prints every change as it happens
let lastKey = '';
const logTimer = setInterval(async () => {
  try { const s = await status(); const k = `${s.session}:${s.state}`; if (k !== lastKey) { lastKey = k; console.log(`\x1b[36m      · ${s.session.toUpperCase()} / ${s.state}\x1b[0m`); } } catch (_) {}
}, 120);

// wait until a predicate on the live status holds (operator-paced — generous timeout)
async function waitFor(fn, arg, timeoutMs, label) {
  try { await page.waitForFunction(fn, arg, { timeout: timeoutMs, polling: 120 }); return true; }
  catch (_) { console.log(`\x1b[31m      (timed out waiting for ${label})\x1b[0m`); return false; }
}
const waitSession = (s, ms, label) => waitFor((x) => window.__vulcanHome.voiceStatus().session === x, s, ms, label);
const waitState = (s, ms, label) => waitFor((x) => window.__vulcanHome.voiceStatus().state === x, s, ms, label);

// one operator exchange: prompt, ride thinking/speaking, require RETURN TO LISTENING
// while STAYING ATTENTIVE (the no-re-wake proof — the operator does NOT say the wake
// phrase again).
async function exchange(prompt, n) {
  say(prompt);
  note(`(exchange ${n} — do NOT say "Fire and Forge"; just ask)`);
  // Reflex answers (e.g. "status") pass through THINKING in <1ms — it is never
  // observable, so assert only the phases that ARE: VULCAN SPEAKS, then RETURNS TO
  // LISTENING while STILL ATTENTIVE (the no-re-wake proof). If it drops out of
  // ATTENTIVE without a bank, that is a real failure and we report it.
  const spoke = await waitState('speaking', 40000, 'VULCAN to speak');
  const back = await waitState('listening', 60000, 'VULCAN to return to listening');
  const s = await status();
  return ok(spoke && back && s.session === 'attentive', `exchange ${n}: answered and returned to LISTENING, still ATTENDING (no re-wake)`);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(' Follow the prompts. Speak clearly. VULCAN will answer aloud.');
console.log('──────────────────────────────────────────────────────────────');

// 1) SUMMON
say('Fire and Forge');
note('(the full ignition should play, and VULCAN should enter the hot session)');
ok(await waitSession('attentive', 45000, 'ATTENTIVE after the wake phrase'), 'summon → ATTENTIVE (hot session)');
await waitState('listening', 20000, 'listening');

// 2) THREE EXCHANGES, NO RE-WAKE
await exchange('What is our status?', 1);
await exchange('What can you do?', 2);
await exchange('Tell me the time.', 3);

// 3) BANK → DORMANT
say('Bank the fire');
note('(the quench should play and VULCAN should go dormant — wake-word only)');
ok(await waitSession('dormant', 30000, 'DORMANT after "Bank the fire"'), 'bank → DORMANT');

// 4) RE-SUMMON — THE RE-ARM (this is what failed in v1.4)
console.log('\n\x1b[1m--- RE-ARM: the v1.4 bug was that this second summon never worked ---\x1b[0m');
say('Fire and Forge');
ok(await waitSession('attentive', 45000, 'ATTENTIVE on re-summon'), 're-summon after bank → ATTENTIVE (RE-ARM WORKS)');
await waitState('listening', 20000, 'listening');

// 5) TWO MORE EXCHANGES
await exchange('What is our status?', 4);
await exchange('Anything on the wire?', 5);

// close out
say('Bank the fire');
await waitSession('dormant', 30000, 'DORMANT');

clearInterval(logTimer);
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`\n=== ${fail === 0 ? '✅ LIVE DRILL PASSED' : '❌ LIVE DRILL FAILED'} · ${pass} pass · ${fail} fail ===`);
if (attached) {
  // the app is a separate, still-running instance — detach and return the prompt.
  console.log('   (detached; VULCAN keeps running.)');
  process.exit(fail === 0 ? 0 : 1);
} else {
  console.log('   (Ctrl-C to exit; VULCAN stays resident + listening.)');
  await new Promise(() => {});   // keep our launched app alive
}

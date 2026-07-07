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
//   prereqs: vite dev server on :5273 (npm run dev) + .env with WHISPER_BIN/
//            WHISPER_MODEL and ELEVENLABS_API_KEY.
//   run: npm run dev   (one terminal)
//        node scripts/hear-vulcan.mjs   (another)
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? '✅ PASS' : '❌ FAIL'} · ${m}`); c ? pass++ : fail++; return c; };
const say = (s) => console.log(`\n\x1b[1m\x1b[38;5;208m🗣  SAY:  “${s}”\x1b[0m`);
const note = (s) => console.log(`\x1b[2m   ${s}\x1b[0m`);

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env } });  // LIVE — real key + mic
app.process().stdout.on('data', (d) => { for (const l of d.toString().split('\n')) if (l.includes('[VOICE]') || l.includes('[GATE-WATCHDOG]')) console.log('\x1b[2m  ' + l.trim() + '\x1b[0m'); });

const page = await app.firstWindow();
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
await page.waitForTimeout(2000);

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
  const heard = await waitState('thinking', 30000, 'VULCAN to start thinking') || await waitState('speaking', 30000, 'VULCAN to speak');
  const spoke = await waitState('speaking', 30000, 'VULCAN to speak');
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
console.log('   (Ctrl-C to exit; VULCAN stays resident + listening.)');
await new Promise(() => {});   // keep the app alive so the operator can keep using it

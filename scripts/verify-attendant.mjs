// S1 THE ATTENDANT — session-machine acceptance (v1.5). Runs the REAL Electron app
// (test-mode ears so the loop is deterministic) and asserts the DORMANT⇄ATTENTIVE
// hot session from live state logs — NOT from internal flags.
//
//   (A) HOT SESSION — summon → 3 exchanges with NO re-wake → bank → re-summon → 2
//       more. Asserts: session is ATTENTIVE across all exchanges; the orb cycles
//       listening→thinking→speaking→listening WITHOUT dropping to idle/dormant between
//       exchanges (that would mean a re-wake); exactly TWO dormant→attentive
//       transitions (the two summons), not one per utterance.
//   (B) SELF-HEAR GATE — an utterance fired DURING VULCAN's speech is not consumed
//       mid-speech; it is captured only after playback completes and the ear re-opens.
//   (C) AUTO-DORMANT — after idle_to_dormant (test: 4s) of silence in ATTENTIVE,
//       VULCAN speaks one line, then drops to DORMANT on its own.
//   (D) TEN CYCLES — summon → exchange → bank, ten times, no degradation.
//
// NOTE: test-mode ears drive the STATE MACHINE deterministically. The REAL mic re-arm
// fix (a live TTS playback must not deafen the wake listener) is proven by the LIVE
// operator drill (scripts/hear-vulcan.mjs) — test-mode does not carry that acceptance.
//
//   run: node scripts/verify-attendant.mjs
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env, VULCAN_VOICE_TEST: '1' } });
const page = await app.firstWindow();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; console.error('PAGE ERROR:', e.message); });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
await page.waitForTimeout(1500);

console.log('VULCAN · S1 THE ATTENDANT — session machine · verification\n');

const st = () => page.evaluate(() => window.__vulcanHome.voiceStatus());
const call = (fn, ...a) => page.evaluate(([f, args]) => window.__vulcanHome[f](...args), [fn, a]);
const waitState = (s, to = 9000) => page.waitForFunction((x) => window.__vulcanHome.voiceStatus().state === x, s, { timeout: to });
const waitSession = (s, to = 9000) => page.waitForFunction((x) => window.__vulcanHome.voiceStatus().session === x, s, { timeout: to });

// in-page recorder: sample session:state at 40ms so we can prove sequencing from a trace
await page.evaluate(() => {
  window.__rec = [];
  window.__recOn = true;
  window.__recTimer = setInterval(() => { if (!window.__recOn) return; const s = window.__vulcanHome.voiceStatus(); window.__rec.push(`${s.session}:${s.state}`); }, 40);
});
const readRec = () => page.evaluate(() => window.__rec.length);
const dumpRec = (from, to) => page.evaluate(([a, b]) => window.__rec.slice(a, b), [from, to]);

// deterministic control: wake ONLY via triggerWake, captures ONLY via triggerUtterance
await call('setAutoWake', false);
await call('setAutoCapture', false);
await call('voiceGoDormant');            // leave any ATTENTIVE from the boot auto-wake
await waitSession('dormant', 9000);
await page.waitForTimeout(300);          // let the recorder log a DORMANT sample first

// a fast, side-effect-free spoken exchange: "profile" is a local reflex that speaks a
// short line ("Profile bonsai.") and — under mission purity's single-profile ORDER —
// does not actually switch anything. Keeps each exchange ~1.2s.
const EX = 'profile';

// one spoken exchange: from LISTENING, feed an utterance, ride thinking→speaking, and
// require the loop to RETURN TO LISTENING (proof the session stayed hot — no re-wake).
async function exchange(text = EX) {
  try {
    await waitState('listening', 9000);
    await call('triggerUtterance', text);
    await waitState('speaking', 9000);
    await waitState('listening', 12000);   // back to listening WITHOUT a wake
    return true;
  } catch (_) { return false; }
}

// ---- (A) HOT SESSION -------------------------------------------------------
console.log('(A) hot session — summon → 3 exchanges (no re-wake) → bank → re-summon → 2 more');
// summon #1 (test-ears wake proxy for "Fire and Forge")
await call('triggerWake');
await waitSession('attentive', 6000);
const mark1 = await readRec();
ok((await st()).session === 'attentive', 'summon → ATTENTIVE');

let exA = 0;
for (let i = 0; i < 3; i++) if (await exchange()) exA++;
const mark2 = await readRec();

// between the two marks the session must never leave ATTENTIVE and never hit idle
const segA = await dumpRec(mark1, mark2);
const staysHot = segA.every((s) => s.startsWith('attentive:'));
const noIdle = !segA.some((s) => s.endsWith(':idle'));
ok(exA === 3, `3 exchanges completed with NO re-wake (each returned listening→speaking→listening)`);
ok(staysHot, `session stayed ATTENTIVE the whole time (${segA.length} samples, all attentive)`);
ok(noIdle, 'orb never dropped to idle between exchanges (no re-wake)');

// bank via the spoken dismiss phrase → DORMANT
await call('triggerUtterance', 'bank the fire');
await waitSession('dormant', 8000);
ok((await st()).session === 'dormant', 'spoken "bank the fire" → DORMANT');
await page.waitForTimeout(150);   // let the 40ms sampler log a DORMANT sample before re-summon

// re-summon → ATTENTIVE (the re-arm), then 2 more exchanges
await call('triggerWake');
await waitSession('attentive', 6000);
ok((await st()).session === 'attentive', 're-summon after bank → ATTENTIVE (re-arm)');
const mark3 = await readRec();
let exB = 0;
for (let i = 0; i < 2; i++) if (await exchange()) exB++;
ok(exB === 2, '2 post-re-summon exchanges completed');
const mark4 = await readRec();
const segB = await dumpRec(mark3, mark4);
ok(segB.every((s) => s.startsWith('attentive:')) && !segB.some((s) => s.endsWith(':idle')),
  '2 post-re-summon exchanges stayed ATTENTIVE (no re-wake)');

// count dormant→attentive transitions across the whole run so far: exactly 2 summons
const full1 = await dumpRec(0, mark4);
let wakes = 0;
for (let i = 1; i < full1.length; i++) {
  if (full1[i].startsWith('attentive:') && full1[i - 1].startsWith('dormant:')) wakes++;
}
ok(wakes === 2, `exactly 2 dormant→attentive transitions (the 2 summons), not one per exchange (saw ${wakes})`);
console.log('');

// ---- (B) SELF-HEAR GATE ----------------------------------------------------
console.log('(B) self-hear gate — an utterance fired during speech is not consumed mid-speech');
// get into a fresh exchange and, the instant we see SPEAKING, fire an utterance. It
// must NOT be consumed while speaking (no thinking transition during the speak); it is
// only captured after the ear re-opens (next listening).
await call('triggerWake');
await waitSession('attentive', 6000);
await waitState('listening', 9000);
await call('triggerUtterance', EX);
await waitState('speaking', 9000);
const selfHear = await page.evaluate(async () => {
  const H = window.__vulcanHome;
  // fire an utterance the instant VULCAN is speaking. The ear is hard-closed
  // (closeForSpeech), so this cannot be captured/consumed mid-speech.
  H.triggerUtterance('what is our status');
  const seen = [];
  for (let i = 0; i < 8; i++) { seen.push(H.voiceStatus().state); await new Promise((r) => setTimeout(r, 55)); }
  return { seen };
});
// while VULCAN is still speaking, the state must stay 'speaking' — the mid-speech
// utterance did NOT trip a new thinking/capture cycle (self-hear forbidden).
const heldDuringSpeech = selfHear.seen.every((s) => s === 'speaking');
ok(heldDuringSpeech, `stayed speaking; the mid-speech utterance was not consumed (states=[${selfHear.seen.join(',')}])`);
// recover to DORMANT — drop the queued probe utterance first so it can't leak into (C)
await call('clearUtterances');
await call('triggerUtterance', 'bank the fire');
await waitSession('dormant', 12000).catch(() => {});
await call('clearUtterances');
console.log('');

// ---- (C) AUTO-DORMANT ------------------------------------------------------
console.log('(C) auto-dormant — silence in ATTENTIVE speaks one line, then drops to DORMANT');
await call('triggerWake');
await waitSession('attentive', 6000);
await waitState('listening', 9000);
const cMark = await readRec();
// no utterance; the idle timer (test: 4s) must fire → a spoken line → DORMANT
await waitSession('dormant', 12000);
const cSeg = await dumpRec(cMark, await readRec());
const spokeBeforeDormant = cSeg.some((s) => s.endsWith(':speaking'));
ok(spokeBeforeDormant, 'auto-dormant announced with one spoken line before dropping');
ok((await st()).session === 'dormant', 'auto-dormant → DORMANT on its own (no operator action)');
console.log('');

// ---- (D) TEN CYCLES --------------------------------------------------------
console.log('(D) ten cycles — summon → exchange → bank, ×10, no degradation');
let cyclesOk = 0;
for (let c = 0; c < 10; c++) {
  await call('triggerWake');
  await waitSession('attentive', 6000);
  await exchange('what is our status');
  await call('triggerUtterance', 'bank the fire');
  await waitSession('dormant', 9000);
  cyclesOk++;
}
ok(cyclesOk === 10, `completed ${cyclesOk}/10 summon→exchange→bank cycles with no degradation`);
console.log('');

ok(!pageErr, `no renderer page error (${pageErr || 'none'})`);
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
await app.close();
process.exit(fail === 0 ? 0 : 1);

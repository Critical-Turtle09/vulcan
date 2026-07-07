// SLICE V — THE VOICE — drill (e) in the REAL Electron app (test-mode ears so the
// loop is deterministic; the mouth engine still hits real ElevenLabs over IPC).
//   e1) real mouth over the real IPC: window.vulcan.tts → engine → ElevenLabs;
//       main logs voice=elevenlabs; 60fps holds while the orb is SPEAKING.
//   e2) SELF-HEAR gate: while VULCAN is mid-speech, a wake signal ("fire and forge")
//       does NOT re-trigger the loop — the wake listener isn't armed during speech.
//   e3) MIC COEXISTENCE: capture constraints (AEC/NS/AGC) stay FALSE (shared HAL).
//   prereqs: vite dev server on :5273 (npm run dev).
//   run: node scripts/verify-voice-electron.mjs
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };

const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env, VULCAN_VOICE_TEST: '1' } });
const voiceLog = [];
app.process().stdout.on('data', (d) => { for (const l of d.toString().split('\n')) if (l.includes('[VOICE]')) voiceLog.push(l.trim()); });

const page = await app.firstWindow();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; console.error('PAGE ERROR:', e.message); });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
await page.waitForTimeout(2500);                 // let any initial overlay/backdrop cycle settle
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
console.log('bridge wired:', JSON.stringify(await page.evaluate(() => ({ tts: !!window.vulcan?.tts, conduct: !!window.vulcan?.conduct }))), '\n');

// ---- e1) real ElevenLabs mouth over the real IPC --------------------------
console.log('(e1) real ElevenLabs mouth over IPC + 60fps while SPEAKING');
const phrase = `Slice V voice check over I P C, run ${Date.now()}.`;   // unique → forces a fresh cloud call
const ttsRes = await page.evaluate((t) => window.vulcan.tts(t, 'answer'), phrase);
ok(ttsRes && ttsRes.ok && ttsRes.provider === 'elevenlabs', `IPC voice:tts → provider=${ttsRes && ttsRes.provider}, chars=${ttsRes && ttsRes.chars}, cached=${ttsRes && ttsRes.cached}, latency=${ttsRes && ttsRes.latencyMs}ms`);
ok(ttsRes && ttsRes.audioBase64 && ttsRes.audioBase64.length > 1000, 'real audio bytes returned over IPC');
ok(voiceLog.some((l) => /voice=elevenlabs/.test(l)), `main engine logged: "${voiceLog.find((l) => /elevenlabs/.test(l)) || 'NONE'}"`);

// drive a full synthetic voice loop; sample fps while the orb is SPEAKING.
await page.evaluate(() => window.__vulcanHome.triggerWake());
let sawSpeaking = false, minFps = 999;
for (let i = 0; i < 70; i++) {
  const snap = await page.evaluate(() => ({ state: window.__vulcanHome.voiceStatus().state, perf: window.__vulcanHome.perf() }));
  if (snap.state === 'speaking') { sawSpeaking = true; if (snap.perf) minFps = Math.min(minFps, snap.perf.fps); }
  await page.waitForTimeout(100);
}
ok(sawSpeaking, 'orb reached SPEAKING through the loop');
ok(minFps >= 55, `fps held while speaking (min ${minFps === 999 ? 'n/a' : minFps})`);
await page.screenshot({ path: 'v-voice-speaking.jpeg', quality: 82, type: 'jpeg' });
console.log('');

// ---- e2) self-hear gate: wake during speech is a no-op --------------------
console.log('(e2) self-hear — a wake signal while speaking cannot re-trigger the loop');
const selfHear = await page.evaluate(async () => {
  const H = window.__vulcanHome;
  const states = [];
  H.triggerWake();                                   // start a fresh cycle
  // wait until the loop is genuinely SPEAKING
  for (let i = 0; i < 60; i++) { const s = H.voiceStatus().state; if (s === 'speaking') break; await new Promise((r) => setTimeout(r, 100)); }
  const during = H.voiceStatus().state;
  H.triggerWake();                                   // VULCAN "hears" the wake phrase mid-speech
  for (let i = 0; i < 8; i++) { states.push(H.voiceStatus().state); await new Promise((r) => setTimeout(r, 80)); }
  return { during, states };
});
const noReenter = selfHear.during === 'speaking' && !selfHear.states.includes('listening');
ok(noReenter, `stayed speaking, never re-entered listening (during=${selfHear.during}, after=[${selfHear.states.join(',')}])`);
console.log('');

// ---- e3) mic coexistence (Apple VP I/O stays off) -------------------------
console.log('(e3) mic coexistence — AEC/NS/AGC false (raw shared HAL)');
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8')).voice.capture;
ok(cap.echoCancellation === false && cap.noiseSuppression === false && cap.autoGainControl === false,
  `AEC/NS/AGC all false (${JSON.stringify({ ec: cap.echoCancellation, ns: cap.noiseSuppression, agc: cap.autoGainControl })})`);
console.log('');

ok(!pageErr, `no renderer page error (${pageErr || 'none'})`);
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
await app.close();
process.exit(fail === 0 ? 0 : 1);

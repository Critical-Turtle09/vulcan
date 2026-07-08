// S2 THE TRIGGER — push-to-talk acceptance (v1.5.1). Runs the REAL Electron app and:
//
//   (A) THE CORE PROMISE — LIVE ears headless. Import createEars in-page with a MOCKED
//       mic (getUserMedia + AudioContext) and a mocked bridge.transcribe. Prove the mic
//       is CLOSED when the trigger is not held, OPENS only between pttDown/pttUp, and the
//       released clip resolves the parked listenForWake/capture. wake-clip classification
//       (wake / dismiss / other) and crisp boundaries are asserted here.
//   (B) DORMANT REDIRECT — a held DORMANT clip that is neither wake nor dismiss speaks ONE
//       line (never silent) and stays DORMANT (test-app loop).
//   (C) CONFIRM GATE under PTT — a 'confirm'/'cancel' decision is captured via the held
//       trigger (pttUp) and the B2 gate (classifyConfirm) routes it correctly.
//   (D) CAPTURING CUE — voice.pttDown()/pttUp() toggle status.capturing and the HUD SESSION
//       mark reads CAPTURING while held (Doctrine 11 in-place repaint).
//
//   prereqs: vite dev server on :5273 (npm run dev).
//   run: node scripts/verify-ptt.mjs
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
await page.waitForTimeout(1200);

console.log('VULCAN · S2 THE TRIGGER — push-to-talk · verification\n');

const st = () => page.evaluate(() => window.__vulcanHome.voiceStatus());
const call = (fn, ...a) => page.evaluate(([f, args]) => window.__vulcanHome[f](...args), [fn, a]);
const waitState = (s, to = 9000) => page.waitForFunction((x) => window.__vulcanHome.voiceStatus().state === x, s, { timeout: to });
const waitSession = (s, to = 9000) => page.waitForFunction((x) => window.__vulcanHome.voiceStatus().session === x, s, { timeout: to });

// ---- (A) THE CORE PROMISE — LIVE ears, mocked mic ---------------------------
console.log('(A) core promise — LIVE ears: mic CLOSED unless held; clip boundaries resolve the consumer');
const A = await page.evaluate(async () => {
  const { createEars } = await import('/src/voice/ears.js');
  // mock the capture graph: getUserMedia hands back a stoppable track; AudioContext
  // exposes createMediaStreamSource + createScriptProcessor so onFrame can be driven.
  let openTracks = 0, lastProc = null;
  const RealAC = window.AudioContext, RealGUM = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async () => { openTracks++; return { getTracks: () => [{ stop() { openTracks--; } }] }; };
  window.AudioContext = class {
    constructor() { this.sampleRate = 48000; this.state = 'running'; this.destination = {}; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { const p = { onaudioprocess: null, connect() {}, disconnect() {} }; lastProc = p; return p; }
    close() { return Promise.resolve(); }
  };
  // mocked ears chain: returns whatever text we stage next.
  let nextText = '', lastWav = null;
  const bridge = { transcribe: async (wav) => { lastWav = wav; return { ok: true, text: nextText, source: 'wispr', fellBack: false }; } };
  const ears = createEars({ bridge, mode: 'live' });

  const feed = (n = 6) => { for (let i = 0; i < n; i++) lastProc && lastProc.onaudioprocess && lastProc.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.12) } }); };
  const out = { mode: ears.mode, captureMode: ears.earsInfo().captureMode };

  // 1) a capture: mic must be CLOSED while merely parked (nothing held).
  const capP = ears.capture();
  await new Promise((r) => setTimeout(r, 60));
  out.closedWhileParked = ears.micOpen() === false && openTracks === 0;
  // 2) hold: pttDown opens the mic.
  nextText = 'what is our heat index';
  await ears.pttDown();
  out.openWhileHeld = ears.micOpen() === true && openTracks === 1;
  feed(8);
  // 3) release: pttUp closes the mic and resolves the capture with the clip transcript.
  await ears.pttUp();
  const cap = await capP;
  out.closedAfterRelease = ears.micOpen() === false && openTracks === 0;
  out.capTranscript = cap.transcript;
  out.wavSent = typeof lastWav === 'string' && lastWav.length > 0;

  // 4) wake-clip classification through the held trigger, on POLISHED transcripts (FX2):
  // capitalized + punctuated the way whisper actually returns them (the comma after
  // "Fire" is the exact case that failed the live drill — it must still ignite).
  const holdSay = async (text) => { nextText = text; const p = ears.listenForWake(); await ears.pttDown(); feed(8); await ears.pttUp(); return p; };
  out.wakeComma = await holdSay('Fire, and Forge.');       // the live-drill failure case
  out.wakePeriod = await holdSay('Fire and Forge.');
  out.dismissIntent = await holdSay('Bank the fire.');
  out.otherIntent = await holdSay('What time is it?');

  // 5) a tapped trigger with no real speech still resolves (never wedges) — empty clip.
  nextText = '';
  const capP2 = ears.capture(); await ears.pttDown(); await ears.pttUp();
  out.emptyResolves = (await capP2).transcript === '';

  // 6) ALIGNMENT (FX2) — two back-to-back holds resolve to two SEPARATE transcripts, in
  // order, never merged (the live-drill merge bug: fire-and-forget carried audio across).
  const cA = ears.capture(); nextText = 'alpha one'; await ears.pttDown(); feed(4); await ears.pttUp(); const rA = await cA;
  const cB = ears.capture(); nextText = 'bravo two'; await ears.pttDown(); feed(4); await ears.pttUp(); const rB = await cB;
  out.aligned = rA.transcript === 'alpha one' && rB.transcript === 'bravo two';

  ears.stop();
  navigator.mediaDevices.getUserMedia = RealGUM; window.AudioContext = RealAC;
  return out;
});
ok(A.captureMode === 'ptt', `LIVE ears default to PTT capture mode (${A.captureMode})`);
ok(A.closedWhileParked, 'mic CLOSED while capture is parked and nothing is held (the core promise)');
ok(A.openWhileHeld, 'mic OPENS only on pttDown (getUserMedia, one live track)');
ok(A.closedAfterRelease, 'mic CLOSED again on pttUp (track stopped, graph torn down)');
ok(A.capTranscript === 'what is our heat index' && A.wavSent, `held clip resolved the capture with its transcript ("${A.capTranscript}")`);
ok(A.wakeComma === 'wake', `polished "Fire, and Forge." (comma) -> intent 'wake' — the live-drill fix (${A.wakeComma})`);
ok(A.wakePeriod === 'wake', `polished "Fire and Forge." (period) -> intent 'wake' (${A.wakePeriod})`);
ok(A.dismissIntent === 'dismiss', `polished "Bank the fire." -> intent 'dismiss' (${A.dismissIntent})`);
ok(A.otherIntent === 'other', `non-wake clip -> intent 'other' (redirect) (${A.otherIntent})`);
ok(A.emptyResolves, 'a tapped trigger with no speech resolves empty (never wedges)');
ok(A.aligned, 'two back-to-back holds -> two SEPARATE transcripts in order (1:1, no merge/carry-over)');
console.log('');

// ---- (B) DORMANT REDIRECT ---------------------------------------------------
console.log('(B) dormant redirect — held non-wake speech speaks one line, stays DORMANT');
await call('setAutoWake', false);
await call('setAutoCapture', false);
await call('voiceGoDormant');
await waitSession('dormant', 9000);
await page.waitForTimeout(200);
// a held DORMANT clip that is neither wake nor dismiss -> the loop speaks the redirect.
await call('triggerWakeOther');
const spokeRedirect = await waitState('speaking', 9000).then(() => true).catch(() => false);
// after the redirect it returns to DORMANT (never entered ATTENTIVE).
await waitState('idle', 9000).catch(() => {});
const stayedDormant = (await st()).session === 'dormant';
ok(spokeRedirect, 'held non-wake DORMANT clip spoke one redirect line (never silent)');
ok(stayedDormant, 'stayed DORMANT — a non-wake clip does not enter the hot session');
console.log('');

// ---- (C) CONFIRM GATE under PTT --------------------------------------------
console.log('(C) confirm gate — Confirm/Cancel captured via the held trigger, B2 gate routes it');
const C = await page.evaluate(async () => {
  const { createEars } = await import('/src/voice/ears.js');
  const { classifyConfirm } = await import('/src/voice/voice.js');
  let lastProc = null;
  const RealAC = window.AudioContext, RealGUM = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  window.AudioContext = class {
    constructor() { this.sampleRate = 48000; this.state = 'running'; this.destination = {}; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { const p = { onaudioprocess: null, connect() {}, disconnect() {} }; lastProc = p; return p; }
    close() { return Promise.resolve(); }
  };
  let nextText = '';
  const bridge = { transcribe: async () => ({ ok: true, text: nextText, source: 'wispr', fellBack: false }) };
  const ears = createEars({ bridge, mode: 'live' });
  const feed = () => { for (let i = 0; i < 6; i++) lastProc.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.1) } }); };
  const decide = async (say) => { nextText = say; const p = ears.capture(); await ears.pttDown(); feed(); await ears.pttUp(); const c = await p; return { transcript: c.transcript, gate: classifyConfirm(c.transcript) }; };
  const yes = await decide('confirm it');
  const no = await decide('no cancel that');
  ears.stop();
  navigator.mediaDevices.getUserMedia = RealGUM; window.AudioContext = RealAC;
  return { yes, no };
});
ok(C.yes.transcript === 'confirm it' && C.yes.gate === 'confirm', `held "confirm" clip -> gate 'confirm'`);
ok(C.no.transcript === 'no cancel that' && C.no.gate === 'cancel', `held "cancel" clip -> gate 'cancel' (anything but an explicit yes aborts)`);
console.log('');

// ---- (D) CAPTURING CUE ------------------------------------------------------
console.log('(D) capturing cue — pttDown/pttUp toggle status.capturing + HUD SESSION mark');
const hudSession = () => page.evaluate(() => document.getElementById('vt-session')?.textContent || '');
await call('pttDown');
await page.waitForTimeout(120);
const capOn = (await st()).capturing === true;
const hudOn = (await hudSession()) === 'CAPTURING';
await call('pttUp');
await page.waitForTimeout(120);
const capOff = (await st()).capturing === false;
ok(capOn, 'pttDown -> status.capturing true');
ok(hudOn, 'HUD SESSION reads CAPTURING while held');
ok(capOff, 'pttUp -> status.capturing false');
console.log('');

ok(!pageErr, `no renderer page error (${pageErr || 'none'})`);
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
await app.close();
process.exit(fail === 0 ? 0 : 1);

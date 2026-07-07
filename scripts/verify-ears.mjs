// EARS — hearing triage verification (v2 FIX ORDER · EARS AFTER SPEECH).
// Three drills, in the REAL Electron app (test-mode ears so the loop is deterministic):
//
//   (A) GATE-WATCHDOG — the speak gate the voice loop awaits is BufferSource.onended.
//       Stub an AudioContext whose source NEVER fires onended (a stalled/suspended ctx)
//       and confirm speak() STILL resolves (force-released) within clip-duration + grace,
//       logs [GATE-WATCHDOG], and drops mouth.playing. Control: onended fires → fast
//       resolve, no watchdog. This is the fix that stops the loop hanging deaf mid-speech.
//
//   (B) RE-SUMMON AFTER SPEECH — the operator's report: after one exchange, nothing
//       further. Drive multiple wake→speak cycles and confirm the loop returns to the
//       wake listener every time (≥3 SPEAKING episodes, each followed by IDLE) — never
//       wedges at SPEAKING. This is the behavioural guard for "re-summon is flawless".
//
//   (C) SELF-HEAR GATE (drill e2 parity) — a wake signal mid-speech cannot re-enter the
//       loop: the wake listener is armed only at idle, never during speech.
//
//   prereqs: vite dev server on :5273 (npm run dev).
//   run: node scripts/verify-ears.mjs
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
await page.waitForTimeout(2000);

console.log('VULCAN · EARS — hearing triage · verification\n');

// ---- (A) GATE-WATCHDOG ------------------------------------------------------
console.log('(A) speak-gate watchdog — force-release when playback-end never fires');
const wd = await page.evaluate(async () => {
  const { createMouth } = await import('/src/voice/mouth.js');
  const RealCtx = window.AudioContext;
  const warns = [];
  const realWarn = console.warn;
  console.warn = (...a) => { warns.push(a.join(' ')); realWarn.apply(console, a); };

  // a fake AudioContext whose BufferSource behaviour is controllable: fireEnded
  // false → onended NEVER fires (a stalled/suspended context — the hang condition).
  function makeCtx(fireEnded) {
    return class {
      constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createAnalyser() { return { fftSize: 1024, smoothingTimeConstant: 0.8, connect() {}, getFloatTimeDomainData() {} }; }
      createBuffer(ch, len, sr) { const d = new Float32Array(len); return { duration: len / sr, sampleRate: sr, length: len, numberOfChannels: ch, getChannelData() { return d; } }; }
      createBufferSource() { const s = { buffer: null, onended: null, connect() {}, stop() {}, start() { if (fireEnded) setTimeout(() => { if (s.onended) s.onended(); }, 20); } }; return s; }
    };
  }

  const run = async (fireEnded) => {
    window.AudioContext = makeCtx(fireEnded);
    const m = createMouth({ bridge: {} });
    const t0 = performance.now();
    await m.speak('gate watchdog probe line', { synthetic: true });   // synthetic → play(synth) path
    const ms = performance.now() - t0;
    return { ms, playing: m.playing };
  };

  const stall = await run(false);      // onended never fires → watchdog must force-release
  const wdWarns = warns.filter((w) => w.includes('[GATE-WATCHDOG]'));
  warns.length = 0;
  const normal = await run(true);      // onended fires → fast, no watchdog

  console.warn = realWarn;
  window.AudioContext = RealCtx;
  return { stall, normal, wdWarns, normalWarns: warns.filter((w) => w.includes('[GATE-WATCHDOG]')).length };
});
// synth clip for this text is ~1.2s → watchdog at ~1.2s + 2s grace ≈ 3.2s.
ok(wd.stall.ms >= 2800 && wd.stall.ms <= 4500, `stalled playback force-released at ${Math.round(wd.stall.ms)}ms (clip ~1.2s + 2s grace)`);
ok(wd.stall.playing === false, 'gate released — mouth.playing dropped to false after force-release');
ok(wd.wdWarns.length === 1, `[GATE-WATCHDOG] logged once (${wd.wdWarns[0] || 'NONE'})`);
ok(wd.normal.ms < 800, `normal onended resolves fast (${Math.round(wd.normal.ms)}ms) — watchdog not needed`);
ok(wd.normalWarns === 0, 'no watchdog log when playback completes normally');
console.log('');

// NOTE (v1.5 THE ATTENDANT): the old (B) re-summon-after-speech and (C) self-hear
// drills assumed the one-utterance-per-wake auto-cycle, which is STRUCK. Those
// behaviours now live at the SESSION level (DORMANT⇄ATTENTIVE, no re-wake between
// exchanges, hard speak-gate) and are asserted by scripts/verify-attendant.mjs.
// This file keeps the model-independent GATE-WATCHDOG unit above — the mouth-side
// speak gate the whole session machine depends on.

ok(!pageErr, `no renderer page error (${pageErr || 'none'})`);
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
await app.close();
process.exit(fail === 0 ? 0 : 1);

// run-length compress a state trace for a readable one-liner
function compress(arr) {
  const out = []; let cur = null, n = 0;
  for (const s of arr) { if (s === cur) n++; else { if (cur) out.push(`${cur}×${n}`); cur = s; n = 1; } }
  if (cur) out.push(`${cur}×${n}`);
  return out.join(' → ');
}

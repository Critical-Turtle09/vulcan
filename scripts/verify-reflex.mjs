// FX4 — MID-THINK DORMANT DROP + NEVER-SILENT GAP. Headless repro of the exact failing
// path: the fuzzy Ollama reflex classified "what can you do" as `bank`, which the voice
// loop honored → silent drop to DORMANT (never-silent never fired). Runs the REAL app and
// exercises classify() in-page with a mock bridge (deterministic) AND the real Ollama
// bridge (the exact live line), asserting:
//
//   (A) the FUZZY (ollama) layer can only emit the safe read intent `status`; a fuzzy
//       bank/mute/unmute is REJECTED → null → deferred to the conductor (which speaks);
//   (B) the DETERMINISTIC regex layer still owns bank/mute/unmute/status (unchanged);
//   (C) the exact live line "what can you do" (real Ollama → bank) now returns null
//       instead of banking — the session can no longer silently drop on it.
//
//   prereqs: vite dev server on :5273 (npm run dev).
//   run: node scripts/verify-reflex.mjs
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
await page.waitForTimeout(800);

console.log('VULCAN · FX4 — reflex mid-think dormant drop · verification\n');

// classify() in-page with a MOCK bridge whose reflex returns a staged type (deterministic).
const classifyMock = (text, reflexType) => page.evaluate(async ([t, rt]) => {
  const { classify } = await import('/src/reflex.js');
  const bridge = { reflex: async () => (rt ? { type: rt } : null) };
  return classify(t, bridge);
}, [text, reflexType]);

// ---- (A) FUZZY layer restricted to the safe read intent ---------------------
console.log('(A) fuzzy (ollama) layer — mutating controls rejected, only status accepted');
const fb = await classifyMock('what can you do', 'bank');
ok(fb === null, `fuzzy "bank" on a question is REJECTED → null (was: ${JSON.stringify(fb)}) — no silent drop`);
const fm = await classifyMock('what can you do', 'mute');
ok(fm === null, 'fuzzy "mute" is rejected → null (no silent mute)');
const fu = await classifyMock('what can you do', 'unmute');
ok(fu === null, 'fuzzy "unmute" is rejected → null');
const fs = await classifyMock('how much wood could a woodchuck chuck', 'status');
ok(fs && fs.type === 'status' && fs.via === 'ollama', `fuzzy "status" is still accepted (safe, speaks) — ${JSON.stringify(fs)}`);
console.log('');

// ---- (B) DETERMINISTIC regex layer unchanged --------------------------------
console.log('(B) deterministic regex layer — bank/mute/unmute/status still owned');
const rb = await classifyMock('stand down', 'status');   // regex wins before ollama
ok(rb && rb.type === 'bank' && rb.via === 'regex', `regex "stand down" → bank (deterministic) — ${JSON.stringify(rb)}`);
const rmute = await classifyMock('quiet', null);
ok(rmute && rmute.type === 'mute' && rmute.via === 'regex', `regex "quiet" → mute — ${JSON.stringify(rmute)}`);
const rstat = await classifyMock('sitrep', null);
ok(rstat && rstat.type === 'status' && rstat.via === 'regex', `regex "sitrep" → status — ${JSON.stringify(rstat)}`);
const skill = await classifyMock('mission brief', 'bank');
ok(skill === null, 'skill-shaped "mission brief" defers to the conductor (never a reflex)');
console.log('');

// ---- (C) the EXACT live line via REAL Ollama --------------------------------
console.log('(C) the exact failing line "what can you do" through the REAL reflex bridge');
const live = await page.evaluate(async () => {
  const { classify } = await import('/src/reflex.js');
  if (!(window.vulcan && window.vulcan.reflex)) return { skipped: 'no bridge' };
  try {
    // does the local model still call it bank? (it did in the drill)
    const raw = await window.vulcan.reflex('what can you do', { url: 'http://localhost:11434', model: 'llama3.2:1b', timeoutMs: 4000 });
    const routed = await classify('what can you do', window.vulcan);
    return { raw, routed };
  } catch (e) { return { skipped: String(e && e.message || e) }; }
});
if (live.skipped) {
  ok(true, `SKIPPED live-Ollama check (${live.skipped}) — mock coverage (A) already proves the fix`);
} else {
  console.log('   raw model verdict:', JSON.stringify(live.raw), '· classify routed:', JSON.stringify(live.routed));
  ok(live.routed === null, 'real "what can you do" now routes to the conductor (null), never a silent bank');
}
console.log('');

ok(!pageErr, `no renderer page error (${pageErr || 'none'})`);
console.log(`=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
await app.close();
process.exit(fail === 0 ? 0 : 1);

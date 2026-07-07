// SLICE V — THE VOICE — headless verification harness.
// Drives the mouth engine directly (no Electron) so every drill leaves a transcript.
//   a) ElevenLabs answer — voice=elevenlabs, chars metered, latency, ledger entry
//   b) cache hit — same fixed phrase twice → second is cached, zero chars
//   c) key absent — speech continues via kokoro/say, tagged, no crash
//   d) char-cap drill — answer + a full WRITE_CONFIRM flow (announce → confirm →
//      mock run → acknowledgment) all speak on the LOCAL voice
//   f) hygiene — no /Users in committed tokens.json; local overlay works; vault reads resolve
import { loadEnv } from '../brain/env.js';
loadEnv();
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../brain/env.js';
import { synthesize, prewarm } from '../brain/voice.js';
import { ttsCharsToday, setTtsChars } from '../brain/governor.js';
import { loadTokens } from '../brain/tokens.js';
import { registerAction, execute } from '../brain/constitution.js';

const V = loadTokens().voice || {};
const CAP = typeof V.daily_char_cap === 'number' ? V.daily_char_cap : 8000;
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };

// audio sanity: real MP3 (ID3 tag or frame sync) or real WAV (RIFF) with bytes.
function audioValid(r) {
  if (!r || !r.ok || !r.audioBase64) return false;
  const b = Buffer.from(r.audioBase64, 'base64');
  if (b.length < 64) return false;
  if (r.mime === 'audio/mpeg') return (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  if (r.mime === 'audio/wav') return b.slice(0, 4).toString('ascii') === 'RIFF';
  return true;
}

async function main() {
  console.log('VULCAN · SLICE V — THE VOICE · verification\n');
  console.log(`voice id (tokens.voice.id | env fallback): ${V.id || '(empty → ELEVENLABS_VOICE_ID)'}`);
  console.log(`daily_char_cap: ${CAP} · tts_chars at start: ${ttsCharsToday()}\n`);

  // pre-warm the fixed announcements (populates the cache in the VULCAN voice).
  console.log('· pre-warm fixed announcements');
  const warm = await prewarm();
  console.log(`   warmed=${warm.warmed} skipped=${warm.skipped}\n`);

  // ---- (a) ElevenLabs answer ------------------------------------------------
  console.log('(a) ElevenLabs answer');
  const before = ttsCharsToday();
  const ans = `Taiwan fabs nominal. Two heat events cooling. Run ${Date.now()}.`;   // unique → fresh cloud call
  const ra = await synthesize(ans, { kind: 'answer' });
  ok(ra.provider === 'elevenlabs', `provider=elevenlabs (got ${ra.provider})`);
  ok(ra.chars === ans.length && ra.chars > 0, `chars metered = ${ra.chars}`);
  ok(typeof ra.latencyMs === 'number', `latency = ${ra.latencyMs}ms`);
  ok(audioValid(ra), `real ${ra.mime} audio (${Buffer.from(ra.audioBase64, 'base64').length} bytes)`);
  ok(ttsCharsToday() === before + ans.length, `ledger tts_chars ${before} → ${ttsCharsToday()}`);
  console.log('');

  // ---- (b) cache hit --------------------------------------------------------
  console.log('(b) cache hit — fixed announcement replays at zero chars');
  const fixed = (V.prewarm && V.prewarm[0]) || 'Capturing to the vault.';
  const b1 = await synthesize(fixed, { kind: 'announce' });   // warmed above → already cached
  const preB = ttsCharsToday();
  const b2 = await synthesize(fixed, { kind: 'announce' });
  ok(b2.cached === true, `second play cached=true (provider ${b2.provider})`);
  ok(b2.chars === 0, 'zero chars metered on cache hit');
  ok(ttsCharsToday() === preB, `ledger unchanged across cache hit (${preB})`);
  ok(audioValid(b2), 'cached audio is playable');
  console.log('');

  // ---- (c) key absent → local chain ----------------------------------------
  console.log('(c) key absent (simulating a commented ELEVENLABS_API_KEY) → local chain');
  const savedKey = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const preC = ttsCharsToday();
  let rc;
  try { rc = await synthesize('Fallback check. Local voice online.', { kind: 'answer' }); }
  catch (e) { rc = { ok: false, err: e.message }; }
  process.env.ELEVENLABS_API_KEY = savedKey;   // restore
  ok(rc.ok === true, `no crash, spoke via ${rc.provider}`);
  ok(rc.provider === 'kokoro' || rc.provider === 'say', `local tier (${rc.provider})`);
  ok(rc.chars === 0 && ttsCharsToday() === preC, 'local speech metered zero chars');
  ok(audioValid(rc), `real ${rc.mime} audio`);
  console.log('');

  // ---- (d) char-cap drill + full confirm flow on the local voice -----------
  console.log('(d) char-cap drill — plant tts_chars at cap');
  const snapshot = ttsCharsToday();
  setTtsChars(CAP);
  console.log(`   tts_chars planted at ${ttsCharsToday()} (cap ${CAP})`);

  const rd = await synthesize('Over budget. This answer still speaks.', { kind: 'answer' });
  ok(rd.provider !== 'elevenlabs' && rd.ok, `answer speaks on local chain (${rd.provider})`);
  ok(rd.chars === 0, 'over-budget answer meters zero chars');

  console.log('   — full WRITE_CONFIRM flow (mock tag) on the local voice —');
  registerAction('drill.tag', 'WRITE_CONFIRM', async (d) => ({ ok: true, title: 'REPO · TAG', speak: `Tag ${d.tag} created and pushed to origin.` }),
    { announceText: (d) => `Create and push annotated tag ${d.tag} to origin. Say confirm to proceed, or cancel.` });
  const detail = { tag: 'forge-drill' };
  const spoken = [];
  const speakLocal = async (text, kind) => { const r = await synthesize(text, { kind }); spoken.push({ kind, provider: r.provider, chars: r.chars }); return r; };

  // announce (spoken) → decision "confirm" (spoken) → mock run → acknowledgment (spoken)
  const prompt = `Create and push annotated tag ${detail.tag} to origin. Say confirm to proceed, or cancel.`;
  await speakLocal(prompt, 'confirm');
  await speakLocal('confirm', 'confirm');
  const res = await execute('drill.tag', detail, { announce: () => {}, confirm: async () => 'confirm' });
  await speakLocal(res.result.speak, 'confirm');

  ok(res.confirmed === true, 'mock tag confirmed + ran (no real push)');
  ok(spoken.every((s) => s.provider !== 'elevenlabs'), `every confirm-flow line on local voice (${spoken.map((s) => s.provider).join(', ')})`);
  ok(spoken.every((s) => s.chars === 0), 'entire confirm flow metered zero chars over budget');
  ok(ttsCharsToday() === CAP, 'cap not exceeded by local speech');

  setTtsChars(snapshot);   // restore the real meter
  console.log(`   tts_chars restored → ${ttsCharsToday()}\n`);

  // ---- (f) hygiene ----------------------------------------------------------
  console.log('(f) token hygiene');
  const committed = fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8');
  ok(!committed.includes('/Users/'), 'committed tokens.json carries no /Users path');
  const merged = loadTokens();
  const vp = merged.obsidian && merged.obsidian.vault_path;
  ok(!!vp && vp.includes('/Users/'), 'vault_path resolves from the local overlay');
  ok(!!vp && fs.existsSync(vp), 'resolved vault path exists on disk (reads resolve)');
  const localIgnored = fs.existsSync(path.join(ROOT, 'tokens.local.json'));
  ok(localIgnored, 'tokens.local.json present (and gitignored — checked separately)');
  console.log('');

  console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('verify-voice error:', e); process.exit(1); });

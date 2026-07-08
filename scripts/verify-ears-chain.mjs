// S2 THE TRIGGER — EARS CHAIN acceptance (node-side, no Electron). Drives the Wispr
// Flow REST -> local whisper fallback decision + logging with an injected fetch + local,
// so no network or real whisper is needed:
//
//   (a) NO KEY            -> local is primary (source:'local', fellBack:false)
//   (b) BAD KEY / API err -> graceful drop to local, logged (source:'local', fellBack:true)
//   (c) WISPR OK          -> source:'wispr', transcript from the response `text`
//   (d) request shape     -> POST, Bearer auth, { audio, language }, endpoint from tokens
//
//   run: node scripts/verify-ears-chain.mjs
import { transcribeChain, wisprTranscribe } from '../brain/ears.js';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };

console.log('VULCAN · S2 THE TRIGGER — ears chain · verification\n');

const WAV = 'AAAA';                                   // stand-in base64 clip
const local = async () => ({ ok: true, text: 'local heard this' });

// ---- (a) NO KEY -> local primary -------------------------------------------
delete process.env.VULCAN_WISPR_KEY;
const a = await transcribeChain(WAV, { local, fetchImpl: async () => { throw new Error('should-not-be-called'); } });
ok(a.ok && a.text === 'local heard this' && a.source === 'local' && a.fellBack === false,
  `no key -> local primary, not a drop (${JSON.stringify(a)})`);

// ---- (b) BAD KEY / API error -> drop to local, logged -----------------------
process.env.VULCAN_WISPR_KEY = 'bad-key';
let logged = false;
const realLog = console.log;
console.log = (...x) => { if (String(x[0]).includes('[EARS]') && String(x[0]).includes('dropped')) logged = true; realLog(...x); };
const b = await transcribeChain(WAV, { local, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
console.log = realLog;
ok(b.ok && b.text === 'local heard this' && b.source === 'local' && b.fellBack === true,
  `bad key -> graceful drop to local (${JSON.stringify(b)})`);
ok(logged, 'the drop was logged ([EARS] ... dropped -> local)');

// ---- (c) WISPR OK -> cloud transcript --------------------------------------
process.env.VULCAN_WISPR_KEY = 'good-key';
const c = await transcribeChain(WAV, { local, fetchImpl: async () => ({ ok: true, json: async () => ({ text: 'wispr heard this', detected_language: 'en' }) }) });
ok(c.ok && c.text === 'wispr heard this' && c.source === 'wispr' && c.fellBack === false,
  `wispr ok -> cloud transcript (${JSON.stringify(c)})`);

// ---- (d) request shape ------------------------------------------------------
let seen = null;
await wisprTranscribe(WAV, { fetchImpl: async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ text: 'x' }) }; } });
const body = JSON.parse(seen.opts.body);
ok(seen.opts.method === 'POST', 'POST method');
ok(seen.opts.headers.Authorization === 'Bearer good-key', 'Bearer auth header carries the key (never argv)');
ok(seen.url.includes('platform-api.wisprflow.ai'), `endpoint from tokens (${seen.url})`);
ok(body.audio === WAV && Array.isArray(body.language), 'body carries { audio (base64 wav), language }');

// ---- (e) local also fails -> ok:false, never throws ------------------------
delete process.env.VULCAN_WISPR_KEY;
const e = await transcribeChain(WAV, { local: async () => ({ ok: false, reason: 'no-whisper' }) });
ok(e.ok === false && e.source === 'local' && !e.fellBack, 'no key + no local -> ok:false, never throws');

console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

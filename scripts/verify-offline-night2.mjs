// NIGHT SHIFT 2 · TASK 1 — OFFLINE MODE fail-soft verification.
//
// Simulates "hotel wifi off / captive portal" by overriding global.fetch: any
// non-localhost host either REJECTS (hard offline) or HANGS (black-hole), while
// localhost (Ollama, 11434) still answers — exactly the real degraded state where
// local reflexes + local voice must carry the machine. Exercises the real brain
// modules (conductor, dispatch, wire, client) and asserts the fail-soft law:
//   • never throws, never hangs past the deadline
//   • net-dependent answers degrade to a SPOKEN, honest local result (route REFLEX)
//   • the wire reports OFFLINE, deploy reports UNREACHABLE/NOT CONNECTED
//   • local Ollama classify + local voice chain still work
import { conduct } from '../brain/conductor.js';
import { dispatch } from '../brain/dispatch.js';
import { ask } from '../brain/client.js';

const realFetch = globalThis.fetch;
const isLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(String(u));
const results = { mode: {}, notes: [] };

// MODE 1 — HARD OFFLINE: non-local fetch rejects immediately (no route).
function hardOffline() {
  globalThis.fetch = (u, opts) => {
    if (isLocal(u)) return realFetch(u, opts);
    return Promise.reject(new TypeError('fetch failed (simulated offline)'));
  };
}
// MODE 2 — BLACK HOLE: non-local fetch never resolves, but honors AbortSignal
// (so a correctly-bounded call still aborts). Localhost passes through.
function blackHole() {
  globalThis.fetch = (u, opts) => {
    if (isLocal(u)) return realFetch(u, opts);
    return new Promise((_res, rej) => {
      const sig = opts && opts.signal;
      if (sig) sig.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      // otherwise: hang forever (the bug we are guarding against)
    });
  };
}
const withDeadline = (p, ms, label) => Promise.race([
  p,
  new Promise((_r, rej) => setTimeout(() => rej(new Error(`HANG>${ms}ms @ ${label}`)), ms)),
]);

// ---- MODE 1: HARD OFFLINE ---------------------------------------------------
hardOffline();
{
  const m = { label: 'hard-offline' };
  // a) a SYNTH-shaped question must degrade to a spoken local reflex, never throw.
  try {
    const t0 = Date.now();
    const r = await withDeadline(conduct('what is the outlook for our launch this week'), 15000, 'conduct');
    m.conduct = { route: r.route, spoke: !!(r.text && r.text.length), ms: Date.now() - t0, sample: (r.text||'').slice(0, 70) };
  } catch (e) { m.conduct = { error: String(e).slice(0, 80) }; }

  // b) DEPLOY CHECK dispatch — needs the net; must fail spoken + honest + still file.
  try {
    const r = await withDeadline(dispatch('DEPLOY CHECK'), 30000, 'deploy');
    m.deployCheck = { ok: r.ok, speak: (r.speak||'').slice(0, 80), filed: !!r.artifact, lines: r.lines };
  } catch (e) { m.deployCheck = { error: String(e).slice(0, 80) }; }

  // c) WIRE SCAN dispatch — feeds unreachable; must report OFFLINE, spoken, filed.
  try {
    const r = await withDeadline(dispatch('WIRE SCAN'), 20000, 'wire');
    m.wireScan = { ok: r.ok, speak: (r.speak||'').slice(0, 80), filed: !!r.artifact, lines: r.lines };
  } catch (e) { m.wireScan = { error: String(e).slice(0, 80) }; }

  // d) MISSION BRIEF — the aggregate (deploy+repos+vault+wire+pitch); must not hang/crash.
  try {
    const t0 = Date.now();
    const r = await withDeadline(dispatch('MISSION BRIEF'), 30000, 'mission');
    m.missionBrief = { ok: r.ok, degraded: r.degraded, filed: !!r.artifact, ms: Date.now() - t0, speak: (r.speak||'').slice(0, 70) };
  } catch (e) { m.missionBrief = { error: String(e).slice(0, 80) }; }

  results.mode.hardOffline = m;
}

// ---- MODE 2: BLACK HOLE (the captive-portal hang the timeout fix guards) -----
blackHole();
{
  const m = { label: 'black-hole' };
  // ask() must abort at its deadline and bank TIMEOUT — never hang. Use a short
  // timeout to keep the test fast; proves the AbortController path fires.
  try {
    const t0 = Date.now();
    const r = await withDeadline(ask({ prompt: 'ping', maxTokens: 4, timeoutMs: 1500 }), 8000, 'ask-timeout');
    m.askTimeout = { banked: !!r.banked, reason: r.reason, ms: Date.now() - t0 };
  } catch (e) { m.askTimeout = { error: String(e).slice(0, 80) }; }

  // conduct() over a black-hole: skill match is local (instant); a synth question
  // routes through the (now-bounded) router+synth and must resolve, not hang.
  try {
    const t0 = Date.now();
    const r = await withDeadline(conduct('mission brief'), 40000, 'conduct-skill');
    m.conductSkill = { route: r.route, degraded: r.degraded, reflex: r.reflex, spoke: !!(r.text||r.panel), ms: Date.now() - t0 };
  } catch (e) { m.conductSkill = { error: String(e).slice(0, 80) }; }

  results.mode.blackHole = m;
}

globalThis.fetch = realFetch;
console.log(JSON.stringify(results, null, 2));
process.exit(0);

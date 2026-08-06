// P5 THE VOICE PASS — SITUATIONAL LINES. VULCAN may volunteer ONE short unprompted line
// when something meaningful changes (budget crossing, a deploy flipping state, fresh
// heat on the wire). The discipline is strict, so it never becomes chatter:
//
//   • ATTENTIVE-ONLY speech.  A line is SPOKEN only while the session is ATTENTIVE
//     (a hot mic, the operator present). Hidden or DORMANT, the same line is written
//     to the transcript ONLY — a quiet record, never a voice from a dark screen.
//   • HARD CAP — one spoken line per `minGapMs` (default 5 minutes). Within the gap a
//     new situational line is dropped, not queued (an unprompted line is never worth
//     interrupting the operator for twice in five minutes).
//   • CHANGE-DRIVEN.  Callers gate on a real state CHANGE before offering; `once(key,…)`
//     is a helper that fires only when a tracked value actually changed.
//
// Pure of the DOM: it takes `speak`, `transcript`, `isAttentive`, and `now` callbacks so
// it is unit-testable with a fake clock. offer() returns what it did, for tests + telemetry.
export function createSituational({ speak, transcript, isAttentive, now = () => Date.now(), minGapMs = 5 * 60 * 1000 } = {}) {
  let lastSpokenAt = -Infinity;
  const seen = new Map();          // key → last value, for once()

  // offer(text): speak it if ATTENTIVE and the cap allows; otherwise log to transcript
  // only (dormant/hidden) or drop (attentive but inside the gap). Returns:
  //   'spoke'      — spoken aloud (+ transcript), cap timer reset
  //   'logged'     — dormant/hidden: written to transcript only, never spoken
  //   'suppressed' — attentive but within the 1-per-gap cap: dropped
  //   'empty'      — no text
  function offer(text) {
    const t = String(text || '').trim();
    if (!t) return 'empty';
    if (!isAttentive || !isAttentive()) { if (transcript) transcript(t); return 'logged'; }
    const ts = now();
    if (ts - lastSpokenAt < minGapMs) return 'suppressed';
    lastSpokenAt = ts;
    if (transcript) transcript(t);
    if (speak) speak(t);
    return 'spoke';
  }

  // once(key, value, textFn): offer a line ONLY when `value` differs from the last time
  // this key was seen. The first observation seeds the baseline silently (no line for the
  // value that was already true when VULCAN woke). textFn(value, prev) builds the line.
  function once(key, value, textFn) {
    const had = seen.has(key);
    const prev = seen.get(key);
    seen.set(key, value);
    if (!had) return 'seeded';        // first read — baseline only, never announced
    if (value === prev) return 'same';
    return offer(textFn(value, prev));
  }

  function reset() { lastSpokenAt = -Infinity; seen.clear(); }

  return { offer, once, reset, get lastSpokenAt() { return lastSpokenAt; } };
}

export default createSituational;

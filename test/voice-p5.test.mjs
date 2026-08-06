// P5 THE VOICE PASS — the regression battery for the voice pass. Pins the three pure
// organs of the pass: the speech SANITIZER (no symbols/markdown/paths/raw numbers ever
// reach the mouth), the E.V. REGISTER (fixed lines by key, interpolated), and SITUATIONAL
// LINES (attentive-only speech, 1-per-gap cap, change-driven). No DOM, no AudioContext —
// the DOM-bound pieces (one-voice cancel, universal STOP) are exercised by the Playwright
// drive; these lock the logic a regression would silently break.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForSpeech } from '../src/voice/sanitize.js';
import { line, hasLine } from '../src/voice/register.js';
import { createSituational } from '../src/voice/situational.js';
import register from '../voice-register.json' with { type: 'json' };

// ---- THE SANITIZER ----------------------------------------------------------
test('sanitizer: markdown emphasis + inline code markers are dropped, words kept', () => {
  assert.equal(sanitizeForSpeech('You are **done** with the `build`.'), 'You are done with the build.');
});

test('sanitizer: a path/filename becomes a plain spoken phrase', () => {
  assert.equal(sanitizeForSpeech('Filed to `VULCAN/BONSAI/outputs/night-shift-5-report.md`.'),
    'Filed to night shift 5 report.');
  assert.equal(sanitizeForSpeech('See outreach-sequence.md'), 'See outreach sequence');
});

test('sanitizer: money + percent are humanized, thousands-commas dropped', () => {
  assert.equal(sanitizeForSpeech('80%'), '80 percent');
  assert.equal(sanitizeForSpeech('$2.00 cap'), '2 dollars cap');
  assert.equal(sanitizeForSpeech('$12.50'), '12 dollars 50 cents');
  assert.equal(sanitizeForSpeech('waitlist 1,234'), 'waitlist 1234');
});

test('sanitizer: a URL is spoken as its host, path/query dropped', () => {
  assert.equal(sanitizeForSpeech('live at https://bonsaicitations.com/tool.html now'),
    'live at bonsaicitations dot com now');
});

test('sanitizer: no unspeakable symbol survives', () => {
  const out = sanitizeForSpeech('a*b_c#d>e|f<g^h{i}j[k]l\\m/n=o+p~q`r');
  assert.equal(/[*_#>|<^{}[\]\\/=+~`]/.test(out), false, `symbols leaked: ${out}`);
});

test('sanitizer: prosody punctuation is preserved', () => {
  assert.equal(sanitizeForSpeech("Stopped. That job's cancelled — nothing left the machine."),
    "Stopped. That job's cancelled — nothing left the machine.");
});

test('sanitizer: clean prose is (near) unchanged', () => {
  const s = 'I did not catch that. Say it again, or ask me for the mission brief.';
  assert.equal(sanitizeForSpeech(s), s);
});

test('sanitizer: null/empty is safe', () => {
  assert.equal(sanitizeForSpeech(null), '');
  assert.equal(sanitizeForSpeech(''), '');
});

// ---- THE E.V. REGISTER ------------------------------------------------------
test('register: known key returns its line', () => {
  assert.equal(line('stopped'), 'Stopped.');
  assert.equal(hasLine('muted'), true);
});

test('register: interpolates {vars}', () => {
  assert.equal(line('dispatchFailed', { cmd: 'DEPLOY CHECK' }), "DEPLOY CHECK couldn't run. Nothing left the machine.");
  assert.equal(line('status', { voice: 'online', wire: 'live' }), "Here's the read. Voice is online, and the wire is live.");
});

test('register: an unknown key returns empty string (never throws / never dead-ends)', () => {
  assert.equal(line('no-such-key'), '');
  assert.equal(hasLine('no-such-key'), false);
});

test('register: every fixed line obeys the E.V. rules — short, sayable, no leaked markup', () => {
  for (const [key, raw] of Object.entries(register.lines)) {
    const spoken = sanitizeForSpeech(raw.replace(/\{[^}]+\}/g, 'X'));   // fill vars with a token
    assert.ok(spoken.length > 0, `${key} is empty`);
    assert.ok(spoken.length <= 140, `${key} is too long for one breath: "${spoken}"`);
    // the sanitizer must not have to strip anything from a fixed line (they're born clean)
    assert.equal(sanitizeForSpeech(spoken), spoken, `${key} carries unspeakable characters`);
    assert.equal(/[*_`#>|]/.test(raw), false, `${key} carries markdown`);
  }
});

// ---- SITUATIONAL LINES ------------------------------------------------------
function harness({ attentive = true } = {}) {
  const spoken = [], logged = [];
  let clock = 0;
  const s = createSituational({
    speak: (t) => spoken.push(t),
    transcript: (t) => logged.push(t),
    isAttentive: () => attentive,
    now: () => clock,
    minGapMs: 5 * 60 * 1000,
  });
  return { s, spoken, logged, advance: (ms) => { clock += ms; }, setAttentive: (v) => { attentive = v; } };
}

test('situational: ATTENTIVE speaks the line and records it to the transcript', () => {
  const h = harness({ attentive: true });
  assert.equal(h.s.offer('Heads up.'), 'spoke');
  assert.deepEqual(h.spoken, ['Heads up.']);
  assert.deepEqual(h.logged, ['Heads up.']);
});

test('situational: the 1-per-gap cap suppresses a second line inside 5 minutes', () => {
  const h = harness({ attentive: true });
  assert.equal(h.s.offer('first'), 'spoke');
  assert.equal(h.s.offer('second'), 'suppressed');
  h.advance(4 * 60 * 1000);
  assert.equal(h.s.offer('still capped'), 'suppressed');
  h.advance(1 * 60 * 1000 + 1);           // now past the 5-min gap
  assert.equal(h.s.offer('third'), 'spoke');
  assert.deepEqual(h.spoken, ['first', 'third']);
});

test('situational: hidden/DORMANT records to the transcript ONLY, never spoken', () => {
  const h = harness({ attentive: false });
  assert.equal(h.s.offer('quiet record'), 'logged');
  assert.deepEqual(h.spoken, []);
  assert.deepEqual(h.logged, ['quiet record']);
});

test('situational: once() seeds silently on first read, fires only on a real change', () => {
  const h = harness({ attentive: true });
  assert.equal(h.s.once('spend', true, () => 'crossed'), 'seeded');   // baseline — no line
  assert.deepEqual(h.spoken, []);
  assert.equal(h.s.once('spend', true, () => 'crossed'), 'same');     // unchanged — no line
  h.advance(6 * 60 * 1000);
  assert.equal(h.s.once('spend', false, () => 'back under'), 'spoke');
  assert.deepEqual(h.spoken, ['back under']);
});

test('situational: empty text is a no-op', () => {
  const h = harness({ attentive: true });
  assert.equal(h.s.offer(''), 'empty');
  assert.equal(h.s.offer('   '), 'empty');
  assert.deepEqual(h.spoken, []);
});

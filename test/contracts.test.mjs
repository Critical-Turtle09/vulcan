// C1 THE NIGHT WATCHMAN — the contract-system battery. Pins the two invariants a
// regression must never quietly break: (1) the SIGNATURE GATE — only a signed contract
// verifies, any edit to the JSON invalidates it; (2) the MAILER FENCES — the recipient is
// immovable and log-only never opens a socket. No network, no real send.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, signatureFor, verify, parseSignedMd, loadContract } from '../contracts/lib.mjs';
import { send, HARD_TO } from '../contracts/mailer.mjs';

// ---- canonicalization + signing --------------------------------------------
test('canonicalJson is key-order independent', () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(canonicalJson({ a: { y: 1, x: 2 } }), '{"a":{"x":2,"y":1}}');
});

test('signatureFor is deterministic and changes when the contract changes', () => {
  const c = loadContract('night-watchman');
  const s1 = signatureFor(c);
  const s2 = signatureFor(JSON.parse(JSON.stringify(c)));
  assert.equal(s1, s2);
  const tampered = { ...c, baseUrl: 'https://evil.example.com' };
  assert.notEqual(signatureFor(tampered), s1);
});

// ---- the signature gate -----------------------------------------------------
test('the night-watchman contract is SIGNED and verifies', () => {
  const v = verify('night-watchman');
  assert.equal(v.signed, true, v.reason);
  // mode is operator-controlled (log-only until deliberately armed) — both are valid so
  // long as the signature is valid; the point is the runner only runs a SIGNED contract.
  assert.ok(['log-only', 'armed'].includes(v.contract.mode), `unexpected mode ${v.contract.mode}`);
  assert.equal(v.contract.mailer.to, HARD_TO);
});

test('the .md signature matches the current canonical JSON', () => {
  const md = parseSignedMd('night-watchman');
  assert.ok(md.present && md.sig, 'signature block present');
  assert.equal(md.sig, signatureFor(loadContract('night-watchman')));
});

test('an unknown contract does not verify (never throws)', () => {
  const v = verify('no-such-contract');
  assert.equal(v.signed, false);
});

// ---- the mailer fences ------------------------------------------------------
test('mailer: the recipient is hard-scoped and immovable', async () => {
  const r = await send({ to: 'attacker@evil.com', subject: 's', body: 'b', mode: 'armed', force: true, nowMs: 1, iso: '2026-01-01T00:00:00.000Z' });
  assert.equal(r.status, 'refused');
  assert.equal(HARD_TO, 'vishnumovva@icloud.com');
});

test('mailer: log-only never opens a socket (suppressed, not sent)', async () => {
  const r = await send({ subject: 's', body: 'b', mode: 'log-only', force: true, nowMs: 2, iso: '2026-01-01T00:00:00.000Z' });
  assert.equal(r.status, 'suppressed');
  assert.equal(r.reason, 'log-only mode');
});

test('mailer: armed but no credential is suppressed honestly (no crash, no send)', async () => {
  const saved = process.env.VULCAN_SMTP_PASS;
  delete process.env.VULCAN_SMTP_PASS;
  const r = await send({ subject: 's', body: 'b', mode: 'armed', force: true, nowMs: 3, iso: '2026-01-01T00:00:00.000Z' });
  assert.equal(r.status, 'suppressed');
  assert.equal(r.reason, 'no VULCAN_SMTP_PASS');
  if (saved !== undefined) process.env.VULCAN_SMTP_PASS = saved;
});

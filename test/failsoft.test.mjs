// T1 THE TEST BATTERY — offline fail-soft + the governor cap.
// The brain must NEVER throw or spend when it has no key / no network / no budget: it
// banks to the local reflex and still answers. This suite forces a keyless brain
// (VULCAN_DISABLE_ENV=1 + the key deleted) and a throwaway vault, then proves conduct()
// degrades to REFLEX without throwing, that a SKILL still runs offline (no key needed),
// that the client banks NO_KEY, and that the governor cap math refuses an over-budget call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// keyless + contained BEFORE importing the brain.
process.env.VULCAN_DISABLE_ENV = '1';
delete process.env.VULCAN_ANTHROPIC_KEY;
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-failsoft-test-'));
process.env.VULCAN_VAULT_PATH = VAULT;

const { conduct } = await import('../brain/conductor.js');
const { hasKey, ask } = await import('../brain/client.js');
const { allow, costOf, DAILY_CAP_USD } = await import('../brain/governor.js');

test('the brain is keyless under the test seam', () => {
  assert.equal(hasKey(), false, 'VULCAN_DISABLE_ENV + deleted key → no wallet');
});

test('client.ask() banks NO_KEY instead of calling the API', async () => {
  const r = await ask({ prompt: 'hello' });
  assert.equal(r.banked, true);
  assert.equal(r.reason, 'NO_KEY');
  assert.equal(r.text, undefined, 'a banked call produces no text (no spend, no network)');
});

test('conduct() on a synthesis question degrades to REFLEX and never throws', async () => {
  const r = await conduct('summarize the state of quantum computing in one paragraph');
  assert.equal(r.route, 'REFLEX', 'no key → local reflex, never CLAUDE');
  assert.equal(r.reason, 'NO_KEY');
  assert.equal(typeof r.text, 'string', 'still returns a spoken string (answer or honest offline note)');
  assert.equal(r.cost_usd, 0, 'a banked answer spends nothing');
});

test('conduct() runs a SKILL fully OFFLINE (no key required for the hands)', async () => {
  const r = await conduct('repo status');
  assert.equal(r.route, 'SKILL', 'deterministic skill match works with no key');
  assert.equal(r.cost_usd, 0, 'a READ skill is free');
  assert.ok(r.panel && typeof r.panel.title === 'string', 'returns a panel');
});

test('conduct() never throws across a spread of inputs while offline', async () => {
  for (const t of ['', 'hi', 'what changed', 'deploy status', 'note that offline works',
    'plan today', 'tell me about the weather on mars']) {
    const r = await conduct(t);
    assert.ok(r && typeof r === 'object', `conduct("${t}") returned a result`);
    assert.ok(typeof r.route === 'string', `conduct("${t}") tagged a route`);
  }
});

// ---- the governor cap — deterministic, no ledger mutation --------------------
test('governor cost math matches the published pricing', () => {
  assert.equal(costOf('claude-haiku-4-5-20251001', 1_000_000, 0), 1.0, 'haiku input $1/M');
  assert.equal(costOf('claude-haiku-4-5-20251001', 0, 1_000_000), 5.0, 'haiku output $5/M');
  assert.equal(costOf('claude-opus-4-8', 1_000_000, 0), 5.0, 'opus input $5/M');
});

test('governor REFUSES a call that would breach the $2 cap', () => {
  // a 100M-token answer costs far more than $2 regardless of today's ledger → never allowed
  assert.equal(allow('claude-opus-4-8', 100_000_000), false, 'over-budget call is refused');
  assert.equal(DAILY_CAP_USD, 2.0, 'the cap is $2/day');
});

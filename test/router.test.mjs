// T1 THE TEST BATTERY — the deterministic router + the write gate.
// matchSkill() is the local, keyless intent router that runs BEFORE any Claude
// spend and is the ONLY path that can execute a WRITE. These tests pin its routing
// table so a regression (a moved prefix, a broadened regex) fails loudly. No network,
// no vault writes, no spend — pure routing + class lookups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSkill } from '../brain/skills/index.js';
import { actionClass } from '../brain/constitution.js';

// [ utterance, expected skillId, expected action ] — the canonical routing table.
const ROUTES = [
  // mission (registered before wire/crew — its prefixes win)
  ['mission brief', 'mission', 'mission.brief'],
  ['morning brief', 'mission', 'mission.brief'],
  ['bonsai brief', 'mission', 'mission.brief'],
  ['pitch desk', 'mission', 'mission.pitch'],
  ['outreach board', 'mission', 'mission.pitch'],
  // wire
  ['wire headlines', 'wire', 'wire.headlines'],
  ['headlines', 'wire', 'wire.headlines'],
  ['brief me', 'wire', 'wire.brief'],
  ["what's on the wire", 'wire', 'wire.brief'],
  ['any news', 'wire', 'wire.brief'],
  // vercel / deploy
  ['deploy status', 'vercel', 'vercel.status'],
  ['is it live', 'vercel', 'vercel.status'],
  ['vercel', 'vercel', 'vercel.status'],
  // repo / git
  ['repo status', 'repo', 'repo.status'],
  ['latest commit', 'repo', 'repo.status'],
  ['commit log', 'repo', 'repo.log'],
  ['recent commits', 'repo', 'repo.log'],
  ['what changed', 'repo', 'repo.diffsum'],
  // crew (registered after mission — "outreach draft" DRAFTS, "outreach board" READS)
  ['outreach draft', 'crew', 'crew.outreach'],
  ['draft the pilot emails', 'crew', 'crew.outreach'],
  ['plan today', 'crew', 'crew.plan'],
  ['wk review', 'crew', 'crew.review'],
  ['weekly review', 'crew', 'crew.review'],
  ['compliance audit', 'crew', 'crew.compliance'],
  ['vault clean', 'crew', 'crew.vaultclean'],
  ['commit digest', 'crew', 'crew.commitdigest'],
  // vault (obsidian)
  ['note that the pilot call went well', 'vault', 'note.capture'],
  ['recent notes', 'vault', 'vault.recent'],
  ['find note about coppa', 'vault', 'vault.find'],
];

for (const [text, skillId, action] of ROUTES) {
  test(`routes "${text}" → ${skillId}/${action}`, () => {
    const m = matchSkill(text);
    assert.ok(m, `expected a match for "${text}", got null`);
    assert.equal(m.skillId, skillId, `skill for "${text}"`);
    assert.equal(m.action, action, `action for "${text}"`);
  });
}

test('crew vs mission priority — "outreach board" READS, "outreach draft" DRAFTS', () => {
  assert.equal(matchSkill('outreach board').action, 'mission.pitch');
  assert.equal(matchSkill('outreach draft').action, 'crew.outreach');
});

test('non-command utterances do NOT match a skill (fall through to synthesis)', () => {
  for (const t of ['what is the capital of france', 'how are you today', 'tell me a joke', '']) {
    assert.equal(matchSkill(t), null, `"${t}" should not route to a skill`);
  }
});

test('a skill match carries a detail object', () => {
  const m = matchSkill('tag it v4-signed');
  assert.ok(m);
  assert.equal(m.skillId, 'repo');
  assert.equal(m.action, 'repo.tag');
  assert.equal(typeof m.detail, 'object');
});

// ---- THE WRITE GATE — every action's class is pinned -------------------------
test('write-gate classes: machine-leaving = WRITE_CONFIRM, local writes = WRITE, rest READ', () => {
  // the ONLY machine-leaving action (creates + pushes a git tag) must be confirm-gated
  assert.equal(actionClass('repo.tag'), 'WRITE_CONFIRM');
  // local, contained writes — announced then run, but never leave the machine
  assert.equal(actionClass('note.capture'), 'WRITE');
  assert.equal(actionClass('crew.vaultclean'), 'WRITE');
  // reads are free + silent
  for (const a of ['repo.status', 'repo.log', 'repo.diffsum', 'mission.brief', 'mission.pitch',
    'wire.brief', 'wire.headlines', 'vercel.status', 'vault.recent', 'vault.find',
    'crew.outreach', 'crew.followup', 'crew.commitdigest', 'crew.plan', 'crew.review', 'crew.compliance']) {
    assert.equal(actionClass(a), 'READ', `${a} should be READ`);
  }
});

test('write gate: NO deck-routable command silently escalates to a machine-leaving write', () => {
  // Every deterministic route except an explicit tag must resolve to READ or WRITE
  // (contained) — never WRITE_CONFIRM. Guards against a future prefix accidentally
  // wiring a spoken phrase to a push/deploy without the confirm tier.
  for (const [text] of ROUTES) {
    const m = matchSkill(text);
    if (!m) continue;
    if (m.action === 'repo.tag') continue;   // the one legitimate confirm-gated action
    assert.notEqual(actionClass(m.action), 'WRITE_CONFIRM', `"${text}" → ${m.action} must not be confirm-gated`);
  }
});

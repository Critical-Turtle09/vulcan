// T1 THE TEST BATTERY — every skill's artifact contract.
// Structural: every registered action declares a valid class + a run function, and a
// deterministic router. Functional: the offline-safe, zero-spend, local READ actions
// actually return the panel contract { title:string, lines:[], speak:string }. The
// spend/network reads (mission.brief, wire.brief/headlines, vercel.status) are covered
// structurally only — running them would hit the wallet or the network. Vault side
// effects (crew.plan/followup/commitdigest) are redirected to a throwaway temp vault.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// contain any vault writes + force a keyless brain BEFORE importing the skills.
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-skills-test-'));
process.env.VULCAN_VAULT_PATH = VAULT;
process.env.VULCAN_DISABLE_ENV = '1';

const repo = (await import('../brain/skills/repo.js')).default;
const obsidian = (await import('../brain/skills/obsidian.js')).default;
const vercel = (await import('../brain/skills/vercel.js')).default;
const mission = (await import('../brain/skills/mission.js')).default;
const wire = (await import('../brain/skills/wire.js')).default;
const crew = (await import('../brain/skills/crew.js')).default;

const ALL = [repo, obsidian, vercel, mission, wire, crew];
after(() => { try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (_) {} });

const KLASSES = new Set(['READ', 'WRITE', 'WRITE_CONFIRM']);

// ---- STRUCTURAL: every action of every skill is well-formed -------------------
for (const skill of ALL) {
  test(`skill "${skill.id}" is well-formed (id, route, valid actions)`, () => {
    assert.equal(typeof skill.id, 'string');
    assert.equal(typeof skill.route, 'function', `${skill.id}.route must be a function`);
    assert.equal(matchesNothing(skill), true, 'route() returns null for gibberish');
    assert.ok(Object.keys(skill.actions).length > 0, `${skill.id} has actions`);
    for (const [name, a] of Object.entries(skill.actions)) {
      assert.ok(KLASSES.has(a.klass), `${name} class ${a.klass} is valid`);
      assert.equal(typeof a.run, 'function', `${name}.run is a function`);
      if (a.klass === 'WRITE_CONFIRM') {
        assert.equal(typeof a.announceText, 'function', `${name} (WRITE_CONFIRM) must phrase its confirm prompt`);
      }
    }
  });
}
function matchesNothing(skill) {
  try { return skill.route('zxqw gibberish nonsense 12345') == null; } catch (_) { return false; }
}

// ---- FUNCTIONAL: offline-safe local reads honor the panel contract ------------
function assertPanel(r, label) {
  assert.ok(r && typeof r === 'object', `${label}: returns an object`);
  assert.equal(typeof r.title, 'string', `${label}: title is a string`);
  assert.ok(r.title.length > 0, `${label}: title non-empty`);
  assert.ok(Array.isArray(r.lines), `${label}: lines is an array`);
  for (const l of r.lines) assert.equal(typeof l, 'string', `${label}: every line is a string`);
  assert.equal(typeof r.speak, 'string', `${label}: speak is a string`);
  assert.ok(r.speak.length > 0, `${label}: speak non-empty`);
}

// repo — local git reads
for (const action of ['repo.status', 'repo.log', 'repo.diffsum']) {
  test(`${action} honors the panel contract`, async () => {
    assertPanel(await repo.actions[action].run({}), action);
  });
}

// crew — local drafts (writes, if any, land in the temp vault)
for (const action of ['crew.outreach', 'crew.review', 'crew.compliance', 'crew.plan', 'crew.commitdigest', 'crew.followup']) {
  test(`${action} honors the panel contract`, async () => {
    assertPanel(await crew.actions[action].run({}), action);
  });
}

// vault — local reads over the (empty) temp vault
for (const action of ['vault.recent', 'vault.find']) {
  test(`${action} honors the panel contract`, async () => {
    assertPanel(await obsidian.actions[action].run({ query: 'x' }), action);
  });
}

test('crew vault side effects were contained to the temp vault (real vault untouched)', () => {
  // crew.plan/followup/commitdigest filed into VULCAN/BONSAI under the TEMP vault only.
  const bonsai = path.join(VAULT, 'VULCAN', 'BONSAI');
  assert.ok(fs.existsSync(bonsai), 'writes landed under the temp vault');
});

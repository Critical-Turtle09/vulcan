// T1 THE TEST BATTERY — the constitution gate (execute()).
// The gate is enforced HERE, not by callers: READ runs free; WRITE announces then
// runs; WRITE_CONFIRM runs ONLY on an explicit 'confirm'; and in AWAY mode NOTHING
// machine-affecting runs — it queues to the report. These tests use mock actions so
// no real hand fires. The persisted MODE file is saved and restored around the suite.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  registerAction, execute, actionClass, getMode, setMode, MODE_FILE, reportPath,
} from '../brain/constitution.js';

let savedMode = null;
let savedReport = null;   // the AWAY tests append to the real ~/.vulcan report — save + restore it
before(() => {
  try { savedMode = fs.readFileSync(MODE_FILE, 'utf8'); } catch (_) { savedMode = null; }
  try { savedReport = fs.readFileSync(reportPath(), 'utf8'); } catch (_) { savedReport = null; }
  // register mock hands that record whether they actually RAN
  registerAction('t.read', 'READ', async (d) => ({ ok: true, ran: 'read', echoed: d }));
  registerAction('t.write', 'WRITE', async (d) => ({ ok: true, ran: 'write', echoed: d }));
  registerAction('t.confirm', 'WRITE_CONFIRM', async (d) => ({ ok: true, ran: 'confirm', echoed: d }));
});
after(() => {
  if (savedMode !== null) { try { fs.writeFileSync(MODE_FILE, savedMode); } catch (_) {} }
  else { try { fs.unlinkSync(MODE_FILE); } catch (_) {} }
  // leave the operator's AWAY report exactly as we found it (remove our test markers)
  if (savedReport !== null) { try { fs.writeFileSync(reportPath(), savedReport); } catch (_) {} }
  else { try { fs.unlinkSync(reportPath()); } catch (_) {} }
});

test('registerAction rejects an unknown class', () => {
  assert.throws(() => registerAction('t.bad', 'PUSH', async () => ({})), /bad class/);
});

test('READ runs free + silent (no announce needed)', async () => {
  setMode('PRESENT');
  let announced = false;
  const r = await execute('t.read', { x: 1 }, { announce: () => { announced = true; } });
  assert.equal(r.ran, true);
  assert.equal(r.result.ran, 'read');
  assert.equal(announced, false, 'a READ must not announce');
});

test('WRITE in PRESENT announces THEN runs', async () => {
  setMode('PRESENT');
  let announced = false;
  const r = await execute('t.write', { x: 2 }, { announce: () => { announced = true; } });
  assert.equal(r.ran, true);
  assert.equal(r.announced, true);
  assert.equal(announced, true, 'a WRITE must announce');
  assert.equal(r.result.ran, 'write');
});

test('WRITE_CONFIRM runs ONLY on explicit confirm', async () => {
  setMode('PRESENT');
  const yes = await execute('t.confirm', { x: 3 }, { confirm: async () => 'confirm' });
  assert.equal(yes.ran, true);
  assert.equal(yes.confirmed, true);
  assert.equal(yes.result.ran, 'confirm');
});

test('WRITE_CONFIRM ABORTS on cancel — the hand never fires', async () => {
  setMode('PRESENT');
  const no = await execute('t.confirm', { x: 4 }, { confirm: async () => 'cancel' });
  assert.equal(no.ran, false);
  assert.equal(no.confirmed, false);
  assert.equal(no.aborted, true);
  assert.equal(no.result, undefined, 'cancelled confirm must not produce a result');
});

test('WRITE_CONFIRM with NO confirm hook times out → aborts (never fires by default)', async () => {
  setMode('PRESENT');
  const r = await execute('t.confirm', { x: 5 });
  assert.equal(r.ran, false);
  assert.equal(r.confirmed, false);
  assert.equal(r.decision, 'timeout');
});

test('AWAY mode: a WRITE is QUEUED to the report, never executed', async () => {
  setMode('AWAY');
  let announced = false;
  const before = fs.existsSync(reportPath()) ? fs.readFileSync(reportPath(), 'utf8') : '';
  const r = await execute('t.write', { marker: 'AWAY-QUEUE-TEST' }, { announce: () => { announced = true; } });
  assert.equal(r.ran, false, 'AWAY must not run a WRITE');
  assert.equal(r.queued, true);
  assert.equal(announced, false, 'AWAY queues silently — no announce, no run');
  const after = fs.readFileSync(reportPath(), 'utf8');
  assert.ok(after.length > before.length, 'the report should have grown');
  assert.match(after, /AWAY-QUEUE-TEST/, 'the queued action + detail is written to the report');
  setMode('PRESENT');
});

test('AWAY mode: a WRITE_CONFIRM is also queued, never executed', async () => {
  setMode('AWAY');
  const r = await execute('t.confirm', { marker: 'AWAY-CONFIRM' }, { confirm: async () => 'confirm' });
  assert.equal(r.ran, false, 'even a confirmed WRITE_CONFIRM must not run in AWAY');
  assert.equal(r.queued, true);
  setMode('PRESENT');
});

test('unknown action throws (no silent no-op)', async () => {
  await assert.rejects(() => execute('t.nope', {}), /unknown action/);
});

test('actionClass reports the registered class', () => {
  assert.equal(actionClass('t.read'), 'READ');
  assert.equal(actionClass('t.write'), 'WRITE');
  assert.equal(actionClass('t.confirm'), 'WRITE_CONFIRM');
  assert.equal(actionClass('t.missing'), null);
});

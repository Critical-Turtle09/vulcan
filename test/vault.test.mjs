// T1 THE TEST BATTERY — the vault writer + hard containment.
// Every VULCAN write is confined to a VULCAN/ subtree inside the vault; path escapes
// (absolute, .., symlink) are rejected IN CODE. This suite points the vault at a
// throwaway temp dir (VULCAN_VAULT_PATH seam) so nothing touches the operator's real
// vault, then exercises the real writers + the containment guard end-to-end.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// point the vault at a fresh temp dir BEFORE importing the vault module (it caches).
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-vault-test-'));
process.env.VULCAN_VAULT_PATH = VAULT;

const {
  resolveVault, safePath, writeArtifact, writeDailyDoc,
  readWaitlist, writeWaitlist, readConsoleState, writeConsoleState, WRITE_DIR,
} = await import('../brain/skills/obsidian.js');

after(() => { try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (_) {} });

test('the VULCAN_VAULT_PATH seam is honored', () => {
  assert.equal(resolveVault(), VAULT);
});

test('writeArtifact files a real artifact + a daily trace, contained under VULCAN/BONSAI', () => {
  const md = '# TEST ARTIFACT\n\nbody line\n';
  const h = writeArtifact('MISSION BRIEF', md);
  assert.match(h.filename, /^\d{8}-\d{6}-mission-brief\.md$/, 'stamped, slugged filename');
  assert.ok(fs.existsSync(h.vaultPath), 'artifact exists on disk');
  assert.equal(fs.readFileSync(h.vaultPath, 'utf8'), md, 'content is written verbatim');
  assert.ok(h.rel.startsWith(path.join(WRITE_DIR, 'BONSAI', 'outputs')), `contained: ${h.rel}`);
  assert.ok(h.obsidianUri.startsWith('obsidian://'), 'carries an obsidian:// handoff');
  // the daily trace was appended
  const dailyDir = path.join(VAULT, WRITE_DIR, 'BONSAI', 'daily');
  const dailyFiles = fs.readdirSync(dailyDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  assert.ok(dailyFiles.length >= 1, 'a daily trace file exists');
  assert.match(fs.readFileSync(path.join(dailyDir, dailyFiles[0]), 'utf8'), /MISSION BRIEF · .+\.md/);
});

test('writeDailyDoc writes a date-stamped day document (idempotent per day)', () => {
  const a = writeDailyDoc('plan', '# plan v1');
  const b = writeDailyDoc('plan', '# plan v2');
  assert.equal(a.filename, b.filename, 'same day → same filename (overwrite, not pile up)');
  assert.equal(fs.readFileSync(b.vaultPath, 'utf8'), '# plan v2', 'latest write wins');
});

test('safePath CONFINES writes to the VULCAN/ subtree and REJECTS escapes', () => {
  // a legit contained path resolves inside VULCAN/
  const ok = safePath(VAULT, 'BONSAI/outputs/x.md', { confine: true });
  assert.ok(ok.startsWith(path.join(VAULT, WRITE_DIR)), 'stays inside VULCAN/');
  // escapes are thrown, not silently allowed
  assert.throws(() => safePath(VAULT, '../escape.md', { confine: true }), /escapes|ContainmentError/i);
  assert.throws(() => safePath(VAULT, '../../etc/evil.md', { confine: true }), /escapes|ContainmentError/i);
  assert.throws(() => safePath(VAULT, '/etc/passwd', { confine: true }), /absolute/i);
  assert.throws(() => safePath(VAULT, '', { confine: true }), /empty/i);
});

test('safePath symlink escape is rejected', () => {
  // plant a symlink inside VULCAN/ that points OUT of the vault, then try to write through it
  const vulcanDir = path.join(VAULT, WRITE_DIR);
  fs.mkdirSync(vulcanDir, { recursive: true });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-escape-'));
  const link = path.join(vulcanDir, 'BONSAI-link');
  try { fs.symlinkSync(outside, link); } catch (_) { return; }   // skip if symlinks unavailable
  assert.throws(() => safePath(VAULT, 'BONSAI-link/evil.md', { confine: true }), /symlink escapes/i);
  try { fs.rmSync(outside, { recursive: true, force: true }); } catch (_) {}
});

test('waitlist state round-trips (honest, hand-entered, vault-persisted)', () => {
  assert.equal(readWaitlist(), null, 'unset before first write');
  writeWaitlist({ value: 284, note: 'signup sheet', at: '2026-07-15' });
  const w = readWaitlist();
  assert.equal(w.value, 284);
  assert.equal(w.note, 'signup sheet');
  assert.equal(w.at, '2026-07-15');
});

test('console state (directives/objectives) round-trips', () => {
  const state = { directives: [{ text: 'A', done: false }], objectives: [{ text: 'B', done: true }] };
  writeConsoleState(state);
  const r = readConsoleState();
  assert.deepEqual(r.directives, state.directives);
  assert.deepEqual(r.objectives, state.objectives);
});

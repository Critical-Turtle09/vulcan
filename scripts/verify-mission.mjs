// B5R FIRST MISSION — headless verification of the mission composer.
// Covers what can be proven without the mic/live SYNTH: routing, the vercel read
// hand, pipeline parsing + containment, the banked ([REFLEX], $0) brief, the pitch
// desk (rotate + assert pitched ⊆ file), and wire feed degrade. The LIVE
// one-SYNTH-charge ATTENTIVE brief (verify a) is the operator drill.
//
// It forces the BANKED path by planting the $ ledger near the cap (verify c's own
// design) — so every composition test is $0 and makes no Anthropic call — and points
// the vault at a throwaway temp dir (backup/restore of tokens.local.json + ledger).
//
//   run: node scripts/verify-mission.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; return c; };

const LOCAL = path.join(ROOT, 'tokens.local.json');
const BONSAI = path.join(ROOT, 'profiles', 'bonsai.json');
const LEDGER = path.join(os.homedir(), '.vulcan', 'ledger.json');
const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

const backup = { local: fs.existsSync(LOCAL) ? fs.readFileSync(LOCAL, 'utf8') : null, bonsai: fs.readFileSync(BONSAI, 'utf8'), ledger: fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : null };
// realpath so macOS's /var→/private/var symlink doesn't false-trip the B3 containment
// check (a real vault under /Users is already canonical; this is a temp-dir artifact).
const tmpVault = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vulcan-vault-')));

// point the vault at the temp dir; plant the ledger at $1.99 (forces the banked path)
fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
fs.writeFileSync(LEDGER, JSON.stringify({ date: today, calls: [], total_usd: 1.99, tts_chars: 0 }, null, 2));
fs.writeFileSync(LOCAL, JSON.stringify({ obsidian: { vault_path: tmpVault } }, null, 2));

console.log('VULCAN · B5R FIRST MISSION — mission composer · verification\n');

try {
  // ---- (A) ROUTING -----------------------------------------------------------
  console.log('(A) routing — mission-brief prefixes → mission; "brief me" stays wire');
  const { matchSkill } = await import('../brain/skills/index.js');
  const route = (s) => { const m = matchSkill(s); return m ? `${m.skillId}.${m.action.split('.')[1]}` : '(synth)'; };
  ok(route('mission brief') === 'mission.brief', '"mission brief" → mission.brief');
  ok(route('morning brief') === 'mission.brief', '"morning brief" → mission.brief');
  ok(route('bonsai brief') === 'mission.brief', '"bonsai brief" → mission.brief');
  ok(route('brief me') === 'wire.brief', '"brief me" → wire.brief (unchanged)');
  ok(route('deploy status') === 'vercel.status', '"deploy status" → vercel.status');
  ok(route('what is the repo status') === 'repo.status', '"repo status" → repo.status (regression)');
  console.log('');

  // ---- (B) VERCEL — not connected -------------------------------------------
  console.log('(B) vercel deploy eye — not connected → {connected:false} + hint, $0');
  const { status: vstat } = await import('../brain/skills/vercel.js');
  const v = await vstat();
  ok(v.connected === false, 'no token/project → connected:false');
  ok(!!v.hint && v.cost_usd === 0, `one-line fix hint, $0 (${v.hint})`);
  console.log('');

  // ---- (C) PIPELINE PARSING --------------------------------------------------
  console.log('(C) pipeline parsing — commented template reads EMPTY; only "- [ ]" is a target');
  const mission = await import('../brain/skills/mission.js');
  ok(mission.parsePipeline(mission.pipelineTemplate()).length === 0, 'fresh template parses as EMPTY (commented examples ignored)');
  const parsed = mission.parsePipeline('## Targets\n- [ ] Retraction Watch — citation integrity angle\n- [x] Already Contacted Co');
  ok(parsed.length === 1 && parsed[0].name === 'Retraction Watch', `live "- [ ]" parsed, "- [x]" ignored (${parsed.map((p) => p.name).join(',') || 'none'})`);
  console.log('');

  const skill = mission.default;
  const brief = () => skill.actions['mission.brief'].run({});

  // ---- (D) BANKED BRIEF + PIPELINE ABSENT → template + "empty" ---------------
  console.log('(D) banked brief — pipeline absent → template created + "pipeline empty", [REFLEX] $0');
  const r1 = await brief();
  ok(r1.reflex === true && r1.cost_usd === 0, 'banked → [REFLEX], $0 (ledger at cap)');
  const pipeFile = path.join(tmpVault, 'VULCAN', 'Pipeline.md');
  ok(fs.existsSync(pipeFile), 'pipeline template created inside VULCAN/ containment');
  ok(r1.lines.includes('PIPELINE EMPTY — ADD "- [ ]" TARGETS'), 'pitch desk reports pipeline empty');
  ok(['— DEPLOY —', '— REPO —', '— VAULT —', '— WIRE —', '— PITCH —'].every((h) => r1.lines.includes(h)), 'sectioned panel: DEPLOY·REPO·VAULT·WIRE·PITCH');
  ok(r1.speak && r1.speak.trim().split(/\s+/).length <= WORDS_MAX(), `spoken brief within the ${WORDS_MAX()}-word band (${r1.speak.trim().split(/\s+/).length}w)`);
  console.log('');

  // ---- (E) PITCH DESK — add a target → pitched, assert ⊆ file -----------------
  console.log('(E) pitch desk — add a "- [ ]" target → next brief pitches it; pitched ⊆ file');
  fs.appendFileSync(pipeFile, '\n- [ ] Placeholder Target — reach out re: instant citations\n');
  const r2 = await brief();
  const fileText = fs.readFileSync(pipeFile, 'utf8');
  const pitchIdx = r2.lines.indexOf('— PITCH —');
  const pitched = r2.lines.slice(pitchIdx + 1).filter((l) => !/^PIPELINE/.test(l));
  ok(pitched.some((l) => l.includes('Placeholder Target')), `brief pitches the added target (${pitched.join(' | ') || 'none'})`);
  ok(pitched.length > 0 && pitched.every((l) => fileText.includes(l.split(' — ')[0])), 'ASSERT: every pitched name appears verbatim in Pipeline.md');
  console.log('');

  // ---- (F) FEED DEGRADE — one unreachable feed → composed from the rest -------
  console.log('(F) feed degrade — one dead feed → brief composes from the rest + degraded note');
  const bonsai = JSON.parse(backup.bonsai);
  bonsai.wire.feeds = [bonsai.wire.feeds[0], { label: 'DEADFEED', url: 'https://invalid.invalid.vulcan-nope/feed' }];
  fs.writeFileSync(BONSAI, JSON.stringify(bonsai, null, 2));
  const r3 = await brief();
  ok(r3.degraded === true, 'brief flags degraded when a feed is down');
  ok(r3.lines.some((l) => /FEEDS DOWN · .*DEADFEED/.test(l)), 'panel names the down feed (FEEDS DOWN · DEADFEED)');
  ok(r3.lines.some((l) => l.startsWith('EDSURGE ')), 'still composed from the reachable feed (EdSurge rows present)');
  console.log('');

  ok(true, 'no crash across the composer surface');
} catch (e) {
  console.error('TEST ERROR:', e && e.stack || e); fail++;
} finally {
  // restore everything we touched
  if (backup.local === null) { try { fs.unlinkSync(LOCAL); } catch (_) {} } else fs.writeFileSync(LOCAL, backup.local);
  fs.writeFileSync(BONSAI, backup.bonsai);
  if (backup.ledger === null) { try { fs.unlinkSync(LEDGER); } catch (_) {} } else fs.writeFileSync(LEDGER, backup.ledger);
  try { fs.rmSync(tmpVault, { recursive: true, force: true }); } catch (_) {}
}

function WORDS_MAX() { return 180; }
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

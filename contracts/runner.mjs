// C1 THE NIGHT WATCHMAN — the generic contract runner. It knows nothing about Bonsai; it
// runs whatever SIGNED contracts live in contracts/*.json. The LaunchAgent invokes it at
// 03:00; it is also the "run one cycle now" entry. Flow per contract:
//   1. verify the signature (STANDING CONTRACTS §). Unsigned → logged refusal, SKIP.
//   2. run the contract's read-only checks.
//   3. if anything failed, hand a single digest to the hard-scoped mailer (log-only tonight
//      → the alert is written to the log, never sent, until an app password exists + armed).
//   4. write a run line + a JSON report to logs/, and print a human summary.
// It NEVER throws out — a sentinel that crashes is a sentinel that stops watching.
//
// Usage:
//   node contracts/runner.mjs                 run every signed contract
//   node contracts/runner.mjs --contract ID   run one
//   node contracts/runner.mjs --test-alert    live-fire ONE mail (morning receipt test)
import fs from 'node:fs';
import path from 'node:path';
import { CONTRACTS_DIR, logsDir, ensureLogsDir, appendLog, verify } from './lib.mjs';
import { runChecks } from './checks.mjs';
import { send, HARD_TO } from './mailer.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const nowIso = () => new Date().toISOString();

function listContractIds() {
  return fs.readdirSync(CONTRACTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

async function runOne(id) {
  const iso = nowIso();
  const v = verify(id);
  if (!v.signed) {
    appendLog(iso, `[${id}] REFUSED — ${v.reason}. Not executed.`);
    console.log(`✗ ${id}: REFUSED — ${v.reason}`);
    return { id, signed: false, reason: v.reason };
  }
  const contract = v.contract;
  const mode = contract.mode || 'log-only';
  appendLog(iso, `[${id}] RUN — signed by ${v.signer || 'operator'} · mode=${mode} · base=${contract.baseUrl}`);
  console.log(`▸ ${id}: signed (${v.signer || 'operator'}) · mode=${mode} · ${contract.baseUrl}`);

  let results = [];
  try { results = await runChecks(contract); }
  catch (e) { appendLog(iso, `[${id}] CHECK-HARNESS ERROR — ${e.message}`); results = [{ name: 'harness', ok: false, detail: e.message, failures: [] }]; }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`   ${mark} ${r.name} — ${r.detail}`);
    if (!r.ok) console.log(`      ${JSON.stringify(r.failures)}`);
    appendLog(iso, `[${id}] ${r.ok ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}${r.ok ? '' : ' :: ' + JSON.stringify(r.failures)}`);
  }

  let mail = null;
  if (failed.length) {
    const subject = `${(contract.mailer && contract.mailer.subjectPrefix) || '[BONSAI WATCHMAN]'} ${failed.length} check(s) failed`;
    const body = alertBody(contract, results, failed);
    mail = await send({ to: (contract.mailer && contract.mailer.to) || HARD_TO, subject, body, mode, iso });
    console.log(`   ✉ mail: ${mail.status} (${mail.reason})`);
  } else {
    appendLog(iso, `[${id}] ALL CLEAR — ${results.length} checks passed, no alert`);
    console.log(`   ✓ ALL CLEAR — ${results.length} checks passed`);
  }

  // persist the machine-readable report (latest wins).
  ensureLogsDir();
  const report = { id, iso, signed: true, signer: v.signer, mode, baseUrl: contract.baseUrl, results, failed: failed.length, mail };
  fs.writeFileSync(path.join(logsDir(), `${id}-report.json`), JSON.stringify(report, null, 2));
  return report;
}

function alertBody(contract, results, failed) {
  const lines = [
    `VULCAN Night Watchman — ${failed.length} check(s) failed on ${contract.baseUrl}`,
    `Time: ${nowIso()}`,
    ``,
    `FAILURES:`,
  ];
  for (const r of failed) {
    lines.push(`  • ${r.name} — ${r.detail}`);
    for (const f of (r.failures || [])) lines.push(`      ${JSON.stringify(f)}`);
  }
  lines.push('', 'ALL CHECKS:');
  for (const r of results) lines.push(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
  lines.push('', 'This is an automated read-only uptime check. Reply not monitored.');
  return lines.join('\n');
}

async function testAlert() {
  const iso = nowIso();
  const subject = '[BONSAI WATCHMAN] Live-fire test alert';
  const body = [
    'This is the VULCAN Night Watchman live-fire test.',
    `Sent ${iso}.`,
    'If you are reading this, the alert path is armed and the app-specific password works.',
    'The Watchman runs read-only checks at 03:00 and will mail you here only when something fails (max one message per 24h).',
  ].join('\n');
  // forced (bypasses the 24h cap) and armed (bypasses log-only) — this is the deliberate test.
  const r = await send({ to: HARD_TO, subject, body, mode: 'armed', iso, force: true });
  appendLog(iso, `[test-alert] result=${r.status} (${r.reason})`);
  console.log(`✉ test-alert → ${r.status} (${r.reason})`);
  if (r.status !== 'sent') console.log('   (set VULCAN_SMTP_USER + VULCAN_SMTP_PASS in the environment, then re-run)');
  return r;
}

(async () => {
  ensureLogsDir();
  if (flag('test-alert')) { await testAlert(); return; }
  const only = opt('contract');
  const ids = only ? [only] : listContractIds();
  appendLog(nowIso(), `=== WATCHMAN CYCLE START — ${ids.length} contract(s): ${ids.join(', ')} ===`);
  console.log(`\n▲ VULCAN NIGHT WATCHMAN — ${ids.length} contract(s)\n`);
  for (const id of ids) { try { await runOne(id); } catch (e) { appendLog(nowIso(), `[${id}] FATAL ${e.message}`); console.log(`✗ ${id}: FATAL ${e.message}`); } }
  appendLog(nowIso(), `=== WATCHMAN CYCLE END ===`);
  console.log('');
})();

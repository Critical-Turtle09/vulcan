// SPEC v1.6 THE STAGE — G4 THE LIFECYCLE. The DISPATCH ENGINE (main side).
//
// A deck command is dispatched here: a runner gathers the answer, an artifact is
// filed through the ONE Obsidian hand (VULCAN/outputs/, inside B3 containment), and
// a uniform result + a spoken line come back to the renderer, which drives the chip /
// orb / audio lifecycle (§5). The renderer owns the ceremony; this owns the WORK.
//
// CONSTITUTION (absolute, unchanged): every runner here is a READ or a DRAFT. Nothing
// pushes, deploys, deletes outside VULCAN/, or spends beyond the governor. Skill-backed
// commands route through the SAME conductor path as a spoken query, so the WRITE_CONFIRM
// gate and the ledger are untouched. Honest STUB runners (Front H/I not yet built) still
// produce a REAL markdown artifact that says so — they never fake a result.
//
// NEVER-SILENT / NO-FILE-LESS DISPATCH: a runner that throws still returns a spoken
// failure AND still files a failure-report artifact, so every dispatch ends in both a
// spoken line and a vault file (unless the vault itself is unreachable — reported plainly).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './env.js';
import { conduct } from './conductor.js';
import { readLedger, DAILY_CAP_USD } from './governor.js';
import { status as vercelStatus } from './skills/vercel.js';
import { writeArtifact } from './skills/obsidian.js';

const run = promisify(execFile);
const p2 = (n) => String(n).padStart(2, '0');

// ---- shape a conductor skill result into the uniform dispatch shape -----------
// A deterministic skill match returns { text, panel:{title,lines,body}, reflex,
// degraded, cost_usd, ... }. Defensive: if the phrase ever missed the skill and
// synthesized (no panel), fall back to the spoken text as the whole result.
function fromConduct(cmd, r) {
  const panel = r.panel || {};
  return {
    title: panel.title || cmd,
    lines: panel.lines || (r.text ? [r.text] : []),
    body: panel.body || '',
    speak: r.text || 'Done.',
    reflex: !!r.reflex,
    degraded: !!r.degraded,
    cost_usd: typeof r.cost_usd === 'number' ? r.cost_usd : 0,
    route: r.route || 'SKILL',
  };
}

// ---- METRICS PULL — governor ledger + GH velocity + Vercel deploy (all READ) --
async function gitVelocity() {
  try {
    const { stdout } = await run('git', ['log', '--since=7 days ago', '--pretty=%cd', '--date=format:%Y-%m-%d'], { cwd: ROOT, timeout: 8000 });
    const lines = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    return { total: lines.length, ok: true };
  } catch (_) { return { total: 0, ok: false }; }
}
async function metricsPull() {
  // CLAUDE SPEND — real, from the governor ledger.
  let spendLine = 'SPEND · UNAVAILABLE';
  let pct = 0, spentUsd = 0, calls = 0;
  try {
    const led = readLedger();
    spentUsd = led.total_usd || 0; calls = (led.calls || []).length;
    pct = Math.min(100, Math.round((spentUsd / DAILY_CAP_USD) * 100));
    spendLine = `SPEND · $${spentUsd.toFixed(2)} / $${DAILY_CAP_USD.toFixed(0)} CAP · ${pct}% · ${calls} CALL${calls === 1 ? '' : 'S'}`;
  } catch (_) { /* keep placeholder */ }

  // GH velocity — real git log.
  const gv = await gitVelocity();
  const commitLine = gv.ok ? `COMMITS · ${gv.total} IN LAST 7 DAYS` : 'COMMITS · GIT UNAVAILABLE';

  // Vercel deploy — real READ-only eye.
  let deployLine = 'DEPLOY · UNAVAILABLE';
  try {
    const v = await vercelStatus();
    if (!v || v.connected === false) deployLine = 'DEPLOY · NOT CONNECTED';
    else {
      const state = (v.latest && v.latest.state) || (v.health && v.health.ok ? 'REACHABLE' : 'DEGRADED');
      const code = v.health && v.health.code ? `HTTP ${v.health.code}${v.health.ok ? '' : ' · DOWN'}` : '';
      deployLine = `DEPLOY · ${String(state).toUpperCase()}${code ? ` · ${code}` : ''}`;
    }
  } catch (_) { /* keep placeholder */ }

  const lines = [spendLine, commitLine, deployLine];
  const body = `- **Claude spend:** $${spentUsd.toFixed(2)} of $${DAILY_CAP_USD.toFixed(0)} daily cap (${pct}%), ${calls} metered call${calls === 1 ? '' : 's'} today.\n`
    + `- **Commit velocity:** ${gv.total} commit${gv.total === 1 ? '' : 's'} in the last 7 days.\n`
    + `- **Deploy:** ${deployLine.replace(/^DEPLOY · /, '')}.`;
  const speak = `Metrics. Claude spend ${pct} percent of cap across ${calls} call${calls === 1 ? '' : 's'}. ${gv.total} commit${gv.total === 1 ? '' : 's'} this week. ${deployLine.replace('DEPLOY · ', 'Deploy ').toLowerCase()}.`;
  return { title: 'METRICS · PULL', lines, body, speak, cost_usd: 0, route: 'READ' };
}

// ---- honest STUB runner — a REAL artifact that states the skill's arrival ------
// The command is not yet a live hand; its crew (Front I) and ledger (Front H) land
// later. The stub NEVER fabricates a result — it files a real note saying exactly
// what will run here and what it will read/produce, and speaks that plainly.
function stub(cmd, { arrives, will, speak }) {
  const body = `**${cmd}** is a scaffolded dispatch. The live hand is not built yet.\n\n`
    + `- **Arrives with:** ${arrives}\n`
    + `- **Will:** ${will}\n\n`
    + `This artifact is a real, filed placeholder — VULCAN never fabricates a result. `
    + `When the hand lands, this dispatch will produce its true output here.`;
  return {
    title: `${cmd} · STANDBY`,
    lines: [`ARRIVES WITH · ${arrives.toUpperCase()}`, `WILL · ${will.toUpperCase()}`, 'STUB — REAL ARTIFACT, NO FABRICATED RESULT'],
    body, speak, stub: true, cost_usd: 0, route: 'STUB',
  };
}

// ---- the command registry — deck label → runner -------------------------------
// Real hands where they exist (routed through the conductor so the constitution +
// ledger stay in the loop); honest stubs elsewhere. Keys are the EXACT deck labels.
const RUNNERS = {
  'MISSION BRIEF': () => conduct('mission brief').then((r) => fromConduct('MISSION BRIEF', r)),
  'WIRE SCAN':     () => conduct('wire headlines').then((r) => fromConduct('WIRE SCAN', r)),
  'DEPLOY CHECK':  () => conduct('deploy status').then((r) => fromConduct('DEPLOY CHECK', r)),
  'PITCH DESK':    () => conduct('pitch desk').then((r) => fromConduct('PITCH DESK', r)),
  'METRICS PULL':  () => metricsPull(),
  'OUTREACH':      () => conduct('outreach draft').then((r) => fromConduct('OUTREACH', r)),
  'COMPLIANCE':    () => stub('COMPLIANCE', { arrives: 'Front I · WARDEN', will: 'audit COPPA / FERPA posture and extension permissions', speak: 'The compliance audit arrives with Warden. I filed the standby note.' }),
  'VAULT CLEAN':   () => stub('VAULT CLEAN', { arrives: 'Front H · THE LEDGER', will: 'tidy and re-file the VULCAN vault trail', speak: 'Vault cleanup arrives with the Ledger. I filed the standby note.' }),
  'PLAN TODAY':    () => stub('PLAN TODAY', { arrives: 'Front H · THE LEDGER', will: 'compose today\'s plan from directives and the daily notes', speak: 'The daily plan arrives with the Ledger. I filed the standby note.' }),
  'WK REVIEW':     () => stub('WK REVIEW', { arrives: 'Front H · THE LEDGER', will: 'roll up the week from the vault and commit history', speak: 'The weekly review arrives with the Ledger. I filed the standby note.' }),
};

export function knownCommands() { return Object.keys(RUNNERS); }

// ---- build the markdown artifact from a dispatch result -----------------------
function nowStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function tagChrome(res) {
  const tags = new Set();
  if (res.route) tags.add(res.route);
  if (res.reflex) tags.add('REFLEX');
  if (res.degraded) tags.add('DEGRADED');
  if (res.stub) tags.add('STUB');
  if (res.failed) tags.add('FAILED');
  return [...tags];
}
function toMarkdown(cmd, res) {
  const tags = tagChrome(res);
  const L = [];
  L.push(`# ${res.title || cmd}`, '');
  L.push(`> ${cmd} · ${nowStamp()}${tags.length ? ` · [${tags.join(' · ')}]` : ''}`, '');
  if (res.body) { L.push(res.body, ''); }
  if (res.lines && res.lines.length) {
    L.push('## Detail', '');
    for (const line of res.lines) L.push(`- ${line}`);
    L.push('');
  }
  L.push('---', '', `*Filed by VULCAN · dispatch · ${cmd}*`, '');
  return L.join('\n');
}

// ---- dispatch(cmd) — run the command, file the artifact, return the result ----
export async function dispatch(cmd) {
  const runner = RUNNERS[cmd];
  if (!runner) {
    return { ok: false, failed: true, cmd, title: `${cmd} · UNKNOWN`, lines: ['NO SUCH COMMAND'], speak: `${cmd} is not a known command.`, artifact: null };
  }

  // 1) run the runner — a throw becomes an honest failure result (still files below).
  let res;
  try {
    res = await runner();
  } catch (e) {
    const msg = String((e && e.message) || e);
    res = { failed: true, route: 'FAILED', title: `${cmd} · FAILED`, lines: ['DISPATCH FAILED', msg.slice(0, 120).toUpperCase()], body: `Dispatch failed while running **${cmd}**.\n\n\`\`\`\n${msg}\n\`\`\``, speak: `${cmd} failed. ${msg.slice(0, 90)}. Nothing left the machine.`, cost_usd: 0 };
  }

  // 2) file the artifact through the ONE Obsidian hand (VULCAN/outputs/, contained).
  //    A vault failure here is the only way a dispatch ends with no file — reported plainly.
  let artifact = null;
  const markdown = toMarkdown(cmd, res);
  try {
    artifact = writeArtifact(cmd, markdown);
  } catch (e) {
    const msg = String((e && e.message) || e);
    res.lines = [...(res.lines || []), `ARTIFACT NOT FILED · ${msg.slice(0, 60).toUpperCase()}`];
    if (!res.failed) res.speak = `${res.speak} But I could not file the artifact — the vault is unreachable.`;
  }

  return {
    ok: !res.failed,
    failed: !!res.failed,
    cmd,
    title: res.title || cmd,
    lines: res.lines || [],
    body: res.body || '',
    markdown,
    speak: res.speak || 'Done.',
    reflex: !!res.reflex,
    degraded: !!res.degraded,
    stub: !!res.stub,
    cost_usd: typeof res.cost_usd === 'number' ? res.cost_usd : 0,
    day_total_usd: (() => { try { return readLedger().total_usd || 0; } catch (_) { return 0; } })(),
    artifact,   // { filename, rel, vaultPath, obsidianUri, vaultName } | null
  };
}

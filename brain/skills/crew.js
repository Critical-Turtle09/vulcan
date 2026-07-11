// VULCAN v2 CONDUCTOR — FRONT I: THE CREW (skill-side hands).
// The crew (.claude/agents/{hermes,framer,warden,smith}.md) are Claude Code
// subagents used at the development layer. This skill is their RUNTIME hand inside
// the brain: the deterministic, $0-local actions VULCAN itself can run for a crew
// intent, each producing a REAL artifact filed to the vault (VULCAN/BONSAI/outputs/,
// via dispatch's ONE Obsidian hand). It never sends, pushes, deploys, or invents.
//
// CONSTITUTION (absolute): every action here is a READ or a contained DRAFT/WRITE.
// Nothing leaves the machine. A draft filed to the local vault is not "sending" —
// anything that WOULD leave (send an email, push, deploy) stops at the write gate
// and is HELD for the operator. Banned words never appear in drafts:
// AI-powered, revolutionary, seamlessly, leverage.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../env.js';
import { vaultTrail, writeDailyDoc, reindexVault } from './obsidian.js';

const run = promisify(execFile);
const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

// The three standing launch objectives (spec §1 · Z BR corner). Real, stable pillars
// of the Bonsai Instant Citation launch — NOT the profile's SIM tree-care directives.
const LAUNCH_OBJECTIVES = [
  'OUTREACH — school pilots (librarians, English heads, charter networks)',
  'COMPLIANCE — hold the COPPA/FERPA zero-collection posture',
  'DISTRIBUTION — Chrome Web Store + force-install deployment',
];

const ago = (ms) => {
  const s = Math.max(0, ms / 1000);
  if (s < 90) return 'JUST NOW';
  const m = s / 60; if (m < 60) return `${Math.round(m)}M AGO`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}H AGO`;
  return `${Math.round(h / 24)}D AGO`;
};

// ---- HERMES · outreach.draft --------------------------------------------------
// Three school-pilot email templates, composed LOCALLY ($0, no SYNTH, deterministic).
// DRAFTS ONLY: no recipient addresses, no sending. The operator fills [brackets] and
// sends from their own client — that is their key, their call, their write gate.
const HELD_BANNER = '> **HELD — DRAFTS, NOT SENT.** HERMES drafts; the operator sends. '
  + 'No addresses are filled and nothing has left the machine.';

function outreachDrafts() {
  const body = [
    '# HERMES — School-Pilot Outreach Drafts',
    '',
    HELD_BANNER,
    '',
    'Three cold-email templates for the Bonsai Instant Citation school pilot. Each is'
      + ' under ~150 words, with a subject line and a `[recipient — fill in]` placeholder.'
      + ' Personalize the `[brackets]`, then send from your own client.',
    '',
    '---',
    '',
    '## 1 · School librarian',
    '',
    '**Subject:** A citation tool for [School] students — nothing to FERPA-review',
    '',
    'Hi [Name],',
    '',
    "I built Bonsai, a browser citation tool for students — MLA, APA, Chicago, and IEEE"
      + " in a couple of clicks, right while they're reading a source.",
    '',
    'The part I think you\'ll care about: no student accounts, no network requests. Every'
      + ' citation is built on the student\'s own device, so there\'s no data collected and'
      + ' nothing to put through a privacy review.',
    '',
    'It force-installs through Google Admin in an afternoon. I\'d love to set up a free'
      + ' 60-day pilot for [School] — one call with your IT, then it\'s live for your students.',
    '',
    'Worth a 20-minute look?',
    '',
    'Thanks, [Your name]',
    '',
    '---',
    '',
    '## 2 · English / writing department head',
    '',
    '**Subject:** Fewer mangled Works Cited pages in [School] papers',
    '',
    'Hi [Name],',
    '',
    "Quick one from a student who got tired of clunky citation sites. Bonsai gives"
      + ' students a correct MLA / APA / Chicago / IEEE citation in a couple of clicks, with'
      + ' the in-text version right beside it.',
    '',
    'It lives in the browser, so students cite the page they\'re actually reading instead'
      + ' of retyping details into a form. No accounts, no ads, nothing collected.',
    '',
    'I can turn it on for every student at [School] through your IT in one afternoon, free'
      + ' for 60 days. A citation video course for your team lands this fall.',
    '',
    'Could I show you what a student sees? 15 minutes.',
    '',
    'Best, [Your name]',
    '',
    '---',
    '',
    '## 3 · Charter-network academic director',
    '',
    '**Subject:** One citation tool across all [Network] campuses',
    '',
    'Hi [Name],',
    '',
    'Bonsai is a browser citation tool for students (MLA, APA, Chicago, IEEE). For a'
      + ' network with central IT it\'s a strong fit: one Google Admin force-install push'
      + ' covers every campus at once.',
    '',
    'Pricing is public and flat by enrollment — no per-seat math, no quote-request maze.'
      + ' It collects zero student data (no accounts, no network requests), so it clears'
      + ' privacy review fast across all your schools at once.',
    '',
    'I\'d like to run a free 60-day pilot on one or two campuses, then show you the usage'
      + ' before you commit network-wide. Open to a short call?',
    '',
    'Thanks, [Your name]',
    '',
    '---',
    '',
    '### To actually send',
    'These are drafts. Fill each `[bracket]`, confirm the recipient yourself, and send'
      + ' from your own email. VULCAN does not send, and holds anything that would leave'
      + ' the machine until you say go.',
    '',
    '*Drafted by HERMES · Front I · THE CREW.*',
  ].join('\n');

  return {
    title: 'HERMES · OUTREACH DRAFTS',
    lines: [
      'CREW · HERMES',
      'DRAFTS · 3 (LIBRARIAN · ENGLISH HEAD · CHARTER DIRECTOR)',
      'HELD — NOT SENT · NO ADDRESSES · UNDER ~150 WORDS EACH',
    ],
    body,
    speak: 'Hermes drafted three school-pilot emails — librarian, English head, and charter'
      + ' director. They are held as drafts in the vault; nothing was sent.',
    cost_usd: 0,
    route: 'DRAFT',
  };
}

// ---- git helpers (fail-soft; $0) ----------------------------------------------
async function gitLines(args) {
  try { return (await run('git', args, { cwd: ROOT, timeout: 8000 })).stdout.split('\n').map((s) => s.trim()).filter(Boolean); }
  catch (_) { return null; }
}

// ---- PLAN TODAY · plan.today (READ; files the plan into daily/) ----------------
// Compose today's plan LOCALLY ($0) from what is REAL: the standing launch
// objectives, this week's commit velocity, and the live vault trail. Never surfaces
// SIM profile data as a plan. Writes the plan to VULCAN/BONSAI/daily/; dispatch also
// files the receipt to outputs/.
async function planToday() {
  const today = new Date().toISOString().slice(0, 10);
  const week = await gitLines(['log', '--since=7 days ago', '--pretty=%h %s']);
  const todayCommits = await gitLines(['log', '--since=midnight', '--pretty=%h %s']);
  let trail = [];
  try { trail = vaultTrail({ max: 6 }); } catch (_) { /* vault trail optional */ }

  const body = [
    `# Plan · ${today}`,
    '',
    '> Composed locally by VULCAN from real sources — launch objectives, commit velocity,'
      + ' and the vault trail. No SIM data, nothing invented.',
    '',
    '## Standing objectives',
    ...LAUNCH_OBJECTIVES.map((o) => `- ${o}`),
    '',
    '## Signal',
    `- Commits in the last 7 days: **${week ? week.length : 'git unavailable'}**`
      + `${todayCommits ? ` (${todayCommits.length} today)` : ''}.`,
    `- Vault: ${trail.length ? `${trail.length} recent artifact${trail.length === 1 ? '' : 's'}, latest \`${trail[0].name}\` (${ago(trail[0].ageMs)})` : 'no recent artifacts'}.`,
    '',
    '## Suggested focus for today',
    '- **Outreach:** work the pitch desk — draft or send one pilot email (HERMES has templates).',
    '- **Compliance:** confirm the extension manifest still matches the zero-collection posture (WARDEN).',
    '- **Distribution:** check deploy health and the Web Store listing status.',
    '',
    '_This plan is a starting frame, not a mandate — adjust to the day._',
    '',
    '*Filed by VULCAN · PLAN TODAY · Front I.*',
  ].join('\n');

  let filed = null;
  try { filed = writeDailyDoc('plan', body); } catch (_) { /* dispatch still files the receipt to outputs/ */ }

  return {
    title: 'PLAN · TODAY',
    lines: [
      `DATE · ${today}`,
      `COMMITS · ${week ? week.length : '—'} / 7D${todayCommits ? ` · ${todayCommits.length} TODAY` : ''}`,
      filed ? `FILED · ${filed.rel}` : 'DAILY FILE · VAULT UNREACHABLE (receipt still in outputs/)',
      'OBJECTIVES · OUTREACH · COMPLIANCE · DISTRIBUTION',
    ],
    body,
    speak: `Today's plan is filed. ${week ? week.length : 'no'} commits this week. Focus:`
      + ' outreach, compliance, distribution.',
    cost_usd: 0,
    route: 'DRAFT',
  };
}

// ---- WK REVIEW · review.week (READ) -------------------------------------------
// Roll up the week LOCALLY ($0) from the commit history and the vault's daily trail.
async function reviewWeek() {
  const commits = await gitLines(['log', '--since=7 days ago', '--pretty=%h %s']);
  const byDay = await gitLines(['log', '--since=7 days ago', '--pretty=%cd', '--date=format:%Y-%m-%d']);
  const dayCount = {};
  for (const d of (byDay || [])) dayCount[d] = (dayCount[d] || 0) + 1;
  const activeDays = Object.keys(dayCount).length;
  let trail = [];
  try { trail = vaultTrail({ max: 8 }); } catch (_) { /* optional */ }

  const topCommits = (commits || []).slice(0, 8);
  const body = [
    `# Weekly Review · ${new Date().toISOString().slice(0, 10)}`,
    '',
    '> Rolled up locally from commit history and the vault trail. Facts only.',
    '',
    '## By the numbers',
    `- **${commits ? commits.length : 'git unavailable'}** commit${commits && commits.length === 1 ? '' : 's'} across **${activeDays}** active day${activeDays === 1 ? '' : 's'} (last 7 days).`,
    `- Vault: ${trail.length ? `${trail.length} recent artifact${trail.length === 1 ? '' : 's'}` : 'no recent artifacts'}.`,
    '',
    '## What landed (recent commits)',
    ...(topCommits.length ? topCommits.map((c) => `- ${c}`) : ['- (no commits in range)']),
    '',
    '## Vault activity',
    ...(trail.length ? trail.map((r) => `- \`${r.name}\`${r.daily ? ' (daily trail)' : ''} — ${ago(r.ageMs)}`) : ['- (nothing filed)']),
    '',
    '## Against the objectives',
    ...LAUNCH_OBJECTIVES.map((o) => `- ${o.split(' — ')[0]}: _reviewed — see commits/vault above._`),
    '',
    '*Filed by VULCAN · WK REVIEW · Front I.*',
  ].join('\n');

  return {
    title: 'WK · REVIEW',
    lines: [
      `COMMITS · ${commits ? commits.length : '—'} / 7D · ${activeDays} ACTIVE DAY${activeDays === 1 ? '' : 'S'}`,
      `VAULT · ${trail.length} RECENT`,
      'ROLLUP · COMMITS + VAULT TRAIL',
    ],
    body,
    speak: `Weekly review filed. ${commits ? commits.length : 'no'} commits across ${activeDays} active`
      + ` day${activeDays === 1 ? '' : 's'}, ${trail.length} vault artifact${trail.length === 1 ? '' : 's'}.`,
    cost_usd: 0,
    route: 'READ',
  };
}

// ---- COMPLIANCE · compliance.audit (WARDEN; READ) -----------------------------
// Audit the Bonsai extension manifest (READ-ONLY on ~/bonsai) against the standing
// zero-collection COPPA/FERPA posture. Never invents findings; a missing manifest or
// posture doc is itself reported plainly.
const RISKY_PERMS = new Set(['tabs', 'webRequest', 'webRequestBlocking', 'cookies', 'history', 'management', 'bookmarks', 'downloads', 'debugger', 'proxy', 'declarativeNetRequest', '<all_urls>']);
async function complianceAudit() {
  const manifestPath = expandHome('~/bonsai/manifest.json');
  let mf = null, readErr = null;
  try { mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { readErr = String((e && e.message) || e); }

  // no formal posture doc exists in-tree — state that, audit against the standing posture.
  const postureNote = 'No formal COPPA/FERPA posture document found in ~/bonsai; audited against'
    + ' the standing zero-collection posture (no accounts, no network requests, on-device only).';

  if (!mf) {
    const body = [
      '# Compliance Audit · Bonsai Extension',
      '', '> **VERDICT: SOURCE MISSING.**', '',
      `Could not read \`~/bonsai/manifest.json\` — ${readErr}.`,
      '', postureNote, '',
      '## Awaiting operator', '- Confirm the extension manifest path so WARDEN can audit permissions.',
      '', '*Filed by WARDEN · Front I · THE CREW.*',
    ].join('\n');
    return { title: 'COMPLIANCE · SOURCE MISSING', lines: ['VERDICT · SOURCE MISSING', 'MANIFEST · UNREADABLE'], body, speak: 'Compliance audit: the extension manifest could not be read. I filed the finding; nothing was changed.', cost_usd: 0, route: 'READ' };
  }

  const perms = [].concat(mf.permissions || []);
  const hostPerms = [].concat(mf.host_permissions || []);
  const findings = [];
  for (const p of perms) if (RISKY_PERMS.has(p)) findings.push(`Permission \`${p}\` is broad for a citation tool — justify or drop.`);
  if (hostPerms.length) findings.push(`Declares host_permissions (${hostPerms.join(', ')}) — a citation tool that reads only the active tab should not need standing host access.`);
  if (mf.externally_connectable) findings.push('Declares `externally_connectable` — opens a message channel from web pages; review against zero-collection.');
  const csp = JSON.stringify(mf.content_security_policy || '');
  if (/https?:\/\//.test(csp)) findings.push('CSP references a remote origin — flag any remote code/CDN (posture is on-device only).');
  if (mf.oauth2 || /identity/.test(JSON.stringify(perms))) findings.push('References identity/oauth — accounts are a COPPA/FERPA escalation.');

  const clean = findings.length === 0 && hostPerms.length === 0;
  const verdict = clean ? 'CONSISTENT WITH ZERO-COLLECTION POSTURE' : 'RISKS FOUND';
  const permRows = perms.length ? perms.map((p) => `| \`${p}\` | ${RISKY_PERMS.has(p) ? '⚠ review' : 'ok — minimal'} |`) : ['| (none) | — |'];

  const body = [
    '# Compliance Audit · Bonsai Extension',
    '', `> **VERDICT: ${verdict}.**`, '',
    `Manifest v${mf.manifest_version} · ${mf.name} v${mf.version}.`,
    '', postureNote, '',
    '## Permissions',
    '', '| Permission | Assessment |', '| --- | --- |', ...permRows,
    hostPerms.length ? `\nhost_permissions: ${hostPerms.join(', ')}` : '\nhost_permissions: none (good — active-tab only).',
    '', '## Findings',
    ...(findings.length ? findings.map((f, i) => `${i + 1}. ${f}`) : ['- None. Permissions are minimal (storage/activeTab/scripting), no host permissions, no remote code, no accounts — consistent with the zero-collection posture.']),
    '', '## Awaiting operator',
    '- If a formal COPPA/FERPA posture doc is desired for schools, WARDEN can draft one from this audit.',
    '', '*Filed by WARDEN · Front I · THE CREW.*',
  ].join('\n');

  return {
    title: `COMPLIANCE · ${clean ? 'CLEAN' : 'RISKS'}`,
    lines: [`VERDICT · ${verdict}`, `PERMISSIONS · ${perms.join(', ') || 'none'}`, `HOST PERMS · ${hostPerms.length || 'NONE'}`, `FINDINGS · ${findings.length}`],
    body,
    speak: clean
      ? 'Compliance audit: the extension manifest is consistent with the zero-collection posture — minimal permissions, no host access, no accounts. Filed.'
      : `Compliance audit: ${findings.length} posture risk${findings.length === 1 ? '' : 's'} found. Filed for review; nothing was changed.`,
    cost_usd: 0,
    route: 'READ',
  };
}

// ---- VAULT CLEAN · vault.clean (WRITE — contained; re-indexes index.md) --------
function vaultClean() {
  const r = reindexVault({ apply: true });
  const body = [
    '# Vault Clean · Re-index',
    '', '> Re-indexed the VULCAN vault. Only the auto-generated index section in',
    '> `index.md` was touched; the front-door prose and any operator edits are preserved.',
    '',
    '## Inventory',
    `- outputs/: **${r.outputs}**`,
    `- daily/: **${r.daily}**`,
    `- wiki/: **${r.wiki}**`,
    `- raw/: **${r.raw}**`,
    '',
    `Index updated: \`${r.indexRel}\`.`,
    '', '*Filed by VULCAN · VAULT CLEAN · Front I.*',
  ].join('\n');
  return {
    title: 'VAULT · CLEAN',
    lines: [`INDEX · ${r.indexRel}`, `OUTPUTS · ${r.outputs} · DAILY · ${r.daily} · WIKI · ${r.wiki} · RAW · ${r.raw}`, 'AUTO-SECTION REFRESHED · FRONT DOOR PRESERVED'],
    body,
    speak: `Vault cleaned and re-indexed: ${r.outputs} output${r.outputs === 1 ? '' : 's'}, ${r.daily} day file${r.daily === 1 ? '' : 's'}. The front door is preserved.`,
    cost_usd: 0,
    route: 'WRITE',
  };
}

// ---- skill definition ---------------------------------------------------------
export default {
  id: 'crew',
  actions: {
    'crew.outreach': { klass: 'READ', run: outreachDrafts },
    'crew.plan': { klass: 'READ', run: planToday },
    'crew.review': { klass: 'READ', run: reviewWeek },
    'crew.compliance': { klass: 'READ', run: complianceAudit },
    'crew.vaultclean': { klass: 'WRITE', run: vaultClean },
  },
  // Deterministic router — crew intents. Disjoint from mission's "outreach board" /
  // "pitch desk" (those read the pipeline; these DRAFT). The OUTREACH deck command
  // dispatches the phrase "outreach draft" (see dispatch.js), which lands here.
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    if (/\b(outreach draft|draft outreach|draft (the )?outreach|pilot email|pilot emails|draft (the )?pilot|write (the )?outreach|outreach email)\b/.test(t)) {
      return { action: 'crew.outreach', detail: {} };
    }
    if (/\b(plan today|today'?s plan|daily plan|plan (for|my) (today|the day)|make (a|the|my) plan)\b/.test(t)) {
      return { action: 'crew.plan', detail: {} };
    }
    if (/\b(wk review|week review|weekly review|review (the|my|this) week|week in review)\b/.test(t)) {
      return { action: 'crew.review', detail: {} };
    }
    if (/\b(compliance|coppa|ferpa|permissions audit|audit (the )?permissions|posture audit|extension audit)\b/.test(t)) {
      return { action: 'crew.compliance', detail: {} };
    }
    if (/\b(vault clean|clean (the|my) vault|tidy (the|my) vault|re-?index (the )?vault)\b/.test(t)) {
      return { action: 'crew.vaultclean', detail: {} };
    }
    return null;
  },
};

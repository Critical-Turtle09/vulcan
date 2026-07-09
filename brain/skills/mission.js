// VULCAN v2 CONDUCTOR — SLICE B5R: FIRST MISSION — the MISSION COMPOSER.
// VULCAN's job, made concrete: the Bonsai Instant Citation launch. "Mission brief"
// gathers the whole launch picture LOCALLY ($0) — DEPLOY (vercel), REPO (git per
// mission repo), VAULT (captures + pipeline), WIRE (mission feeds), PITCH (outreach
// board) — then spends EXACTLY ONE governor-metered SYNTH call to compose the spoken
// command brief (hard 120-180 word band) plus one outreach angle per pitch target.
//
// FAIL-SOFT / MISSION-PURE:
//   • Every section is gathered independently and fail-soft — a dead repo, an
//     unreachable feed, or an unconnected deploy degrades that section, never the brief.
//   • Banked (no key / over cap / API error) → a locally-composed brief from the same
//     facts, tagged [REFLEX], $0, ledger untouched.
//   • PITCH DESK reads the pipeline (VULCAN/Pipeline.md, inside B3 containment). Only
//     lines that begin "- [ ]" are uncontacted targets. Targets are NEVER invented:
//     every pitched name is asserted (in code) to appear verbatim in the file. The
//     model only writes the ANGLE for a name VULCAN selected from the file.
//   • Pipeline absent → a commented template is created inside VULCAN/ containment and
//     the pitch desk reports "pipeline empty."
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../env.js';
import { loadTokens } from '../tokens.js';
import { pollFeeds } from '../wire-fetch.js';
import { ask, hasKey, MODEL_POLICY } from '../client.js';
import { allow, charge, status as ledgerStatus, VULCAN_DIR } from '../governor.js';
import { getMode } from '../constitution.js';
import { resolveVault, safePath } from './obsidian.js';
import { status as vercelStatus } from './vercel.js';
import { clampWords } from './wire.js';

const run = promisify(execFile);

// ---- behaviour caps -----------------------------------------------------------
const WORDS_MIN = 120, WORDS_MAX = 180;   // hard spoken-brief band
const PITCH_MAX = 3;                        // targets rotated per brief (2-3)
const WIRE_ITEMS = 5;                       // mission-feed items carried into a brief
const PITCH_STATE = path.join(VULCAN_DIR, 'mission-pitch.json');   // rotation cursor

// ---- helpers (small, local — no coupling to the wire skill) -------------------
const clip = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const cleanTitle = (t) => String(t).replace(/\s+-\s+[^-]{2,40}$/, '').trim();
const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function ago(ts) {
  if (!ts) return 'RECENT';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'JUST NOW';
  const m = s / 60; if (m < 60) return `${Math.round(m)}M AGO`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}H AGO`;
  return `${Math.round(h / 24)}D AGO`;
}
function rank(items) {
  const byTitle = new Map();
  for (const it of items) {
    const key = cleanTitle(it.title).toLowerCase();
    if (!key) continue;
    const prev = byTitle.get(key);
    if (!prev || (it.ts || 0) > (prev.ts || 0)) byTitle.set(key, it);
  }
  return [...byTitle.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
const storyRow = (it) => `${String(it.feed).toUpperCase()} · ${ago(it.ts)} · ${clip(cleanTitle(it.title), 48)}`;

function mission() { const tk = loadTokens(); return tk.mission || {}; }
function missionFeeds() {
  const tk = loadTokens();
  const id = (tk.profile && tk.profile.default) || 'bonsai';
  let prof = {};
  try { prof = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles', `${id}.json`), 'utf8')); } catch (_) { /* none */ }
  return (prof.wire && prof.wire.feeds) || [];
}

// ---- DEPLOY -------------------------------------------------------------------
async function deploySection() {
  try { return await vercelStatus(); }
  catch (_) { return { connected: false, lines: ['DEPLOY UNAVAILABLE'], speak: 'Deploy status unavailable.' }; }
}

// ---- REPO (git status per mission repo, fail-soft each) -----------------------
async function repoStatus(repoPath) {
  const dir = expandHome(repoPath);
  const name = path.basename(dir || repoPath);
  if (!dir || !fs.existsSync(dir)) return { name, ok: false, line: `${name} · NOT FOUND`, speak: `${name} not found` };
  if (!fs.existsSync(path.join(dir, '.git'))) return { name, ok: false, line: `${name} · NOT A REPO`, speak: `${name} not a repo` };
  try {
    const g = async (a) => (await run('git', ['-C', dir, ...a], { timeout: 8000 })).stdout.trim();
    const branch = await g(['rev-parse', '--abbrev-ref', 'HEAD']);
    const head = await g(['log', '-1', '--pretty=%h %s']);
    const porcelain = await g(['status', '--porcelain']);
    const dirty = porcelain ? porcelain.split('\n').length : 0;
    return { name, ok: true, branch, dirty, line: `${name} · ${branch} · ${dirty ? `${dirty} UNCOMMITTED` : 'CLEAN'} · ${clip(head, 30)}`, speak: `${name} ${branch}, ${dirty ? `${dirty} uncommitted` : 'clean'}` };
  } catch (_) { return { name, ok: false, line: `${name} · GIT UNAVAILABLE`, speak: `${name} unavailable` }; }
}
async function repoSection() {
  const repos = mission().repos || [];
  if (!repos.length) return [{ name: '—', ok: false, line: 'NO REPOS CONFIGURED', speak: 'no repos configured' }];
  return Promise.all(repos.map(repoStatus));
}

// ---- VAULT (recent captures + pipeline) + PIPELINE containment ----------------
function pipelinePaths(vault) {
  const rel = (mission().pipeline || 'VULCAN/Pipeline.md');
  const inVulcan = rel.replace(/^VULCAN[\\/]/, '');        // path INSIDE VULCAN/
  const abs = safePath(vault, inVulcan, { confine: true }); // B3 containment (throws on escape)
  return { abs, rel };
}
// Uncontacted targets are lines that begin "- [ ]". Commented example lines (inside
// <!-- -->) start with "<!--" and are correctly ignored — so a fresh template reads
// as EMPTY. The angle text after " — " / " - " / ": " is a note, not the name.
export function parsePipeline(text) {
  const open = [];
  for (const raw of String(text).split('\n')) {
    const m = raw.trim().match(/^- \[ \]\s+(.+?)\s*$/);
    if (!m) continue;
    const full = m[1];
    const cut = full.search(/\s+—\s+|\s+-\s+|:\s+/);
    const nm = (cut >= 0 ? full.slice(0, cut) : full).trim();
    const note = cut >= 0 ? full.slice(cut).replace(/^\s*[—:-]\s*/, '').trim() : '';
    if (nm) open.push({ name: nm, note });
  }
  return open;
}
export function pipelineTemplate() {
  return '# Pipeline · Bonsai Instant Citation — outreach board\n\n'
    + '<!-- VULCAN reads this file for the PITCH DESK. An UNCONTACTED target is a line\n'
    + '     that begins "- [ ]". Change it to "- [x]" once you have reached out. Add\n'
    + '     real targets under Targets (uncomment / replace the examples). VULCAN never\n'
    + '     invents a target — it only pitches names that appear verbatim in this file. -->\n\n'
    + '## Targets\n\n'
    + '<!-- - [ ] Example Educator — angle: instant citations inside their LMS workflow -->\n'
    + '<!-- - [ ] Example Ed-Tech Newsletter — angle: review citation accuracy vs. incumbents -->\n';
}
async function vaultSection() {
  let vault;
  try { vault = resolveVault(); } catch (e) { return { ok: false, lines: ['VAULT UNAVAILABLE'], speak: 'Vault unavailable.', open: [], text: '', created: false }; }

  // recent captures — day files under VULCAN/Captures
  let capFiles = [];
  try { capFiles = fs.readdirSync(path.join(vault, 'VULCAN', 'Captures')).filter((f) => f.toLowerCase().endsWith('.md')).sort().reverse(); } catch (_) { /* none */ }

  // pipeline (contained). Absent + PRESENT → create a commented template. The
  // containment root (VULCAN/) must exist BEFORE safePath runs — its symlink check
  // realpaths the nearest existing ancestor, so an un-created root would false-reject
  // (this mirrors obsidian.ensureWriteDir, which mkdirs before safePath).
  let created = false, text = '', rel = 'VULCAN/Pipeline.md';
  try {
    fs.mkdirSync(path.join(vault, 'VULCAN'), { recursive: true });
    const { abs, rel: r } = pipelinePaths(vault); rel = r;
    if (!fs.existsSync(abs)) {
      if (getMode() !== 'AWAY') {
        try { fs.writeFileSync(abs, pipelineTemplate()); created = true; text = pipelineTemplate(); } catch (_) { /* best-effort */ }
      }
    } else {
      text = fs.readFileSync(abs, 'utf8');
    }
  } catch (_) { /* containment error or read fail → empty pipeline */ }

  const open = parsePipeline(text);
  const capLine = capFiles.length ? `CAPTURES · ${capFiles.length} DAY FILE${capFiles.length === 1 ? '' : 'S'} · LATEST ${capFiles[0].replace(/\.md$/i, '')}` : 'CAPTURES · NONE';
  const pipeLine = created ? `PIPELINE · CREATED · ${rel}` : `PIPELINE · ${open.length} OPEN`;
  return {
    ok: true, vault, open, text, created, rel,
    lines: [capLine, pipeLine],
    speak: `Vault: ${capFiles.length} capture file${capFiles.length === 1 ? '' : 's'}, pipeline ${created ? 'empty, template created' : `${open.length} open`}.`,
  };
}

// ---- WIRE (mission feeds) -----------------------------------------------------
async function wireSection() {
  const feeds = missionFeeds();
  if (!feeds.length) return { ok: false, items: [], rows: ['NO FEEDS CONFIGURED'], down: [], degraded: false };
  const res = await pollFeeds(feeds);
  if (!res.ok) return { ok: false, items: [], rows: ['WIRE OFFLINE'], down: res.down || [], degraded: true };
  const top = rank(res.items).slice(0, WIRE_ITEMS);
  return { ok: true, items: top, rows: top.map(storyRow), down: res.down || [], degraded: (res.down || []).length > 0 };
}

// ---- PITCH DESK — rotate 2-3 uncontacted targets from the pipeline ------------
function readPitchIdx() { try { return JSON.parse(fs.readFileSync(PITCH_STATE, 'utf8')).idx || 0; } catch (_) { return 0; } }
function writePitchIdx(idx) { try { fs.mkdirSync(VULCAN_DIR, { recursive: true }); fs.writeFileSync(PITCH_STATE, JSON.stringify({ idx })); } catch (_) { /* best-effort */ } }
function rotatePitch(open) {
  if (!open.length) return [];
  const n = Math.min(PITCH_MAX, open.length);
  const start = readPitchIdx() % open.length;
  const picked = [];
  for (let i = 0; i < n; i++) picked.push(open[(start + i) % open.length]);
  writePitchIdx((start + n) % open.length);
  return picked;
}

// ---- the ONE SYNTH call: spoken brief + one angle per target ------------------
const MISSION_SYSTEM =
  'You are VULCAN, the command-center intelligence for the Bonsai Instant Citation '
  + 'launch, delivering a spoken command brief. Synthesize the supplied launch state '
  + `(deploy, repos, vault, wire, pitch) into ONE terse brief of ${WORDS_MIN}-${WORDS_MAX} words in a `
  + 'flat command-center voice: lead with what needs attention, cover the ed-tech and '
  + 'citation wire, then hand off to the pitch priorities. Then write ONE outreach angle '
  + 'per pitch target — a single concrete sentence, using the EXACT target name given. '
  + 'Plain spoken prose, no markdown, no headings, no preamble ("here is"), no sign-off. '
  + 'State only what the data supports; never invent facts, numbers, deploy states, or targets.';

function missionPrompt(sec, targets) {
  const L = [];
  L.push(`DEPLOY: ${sec.deploy.speak || (sec.deploy.connected ? 'connected' : 'not connected')}`);
  L.push(`REPOS: ${sec.repos.map((r) => r.line).join(' | ')}`);
  L.push(`VAULT: ${sec.vault.lines.join(' · ')}`);
  L.push('WIRE (most recent first):');
  sec.wire.items.forEach((it, i) => L.push(`  ${i + 1}. [${it.feed}] ${cleanTitle(it.title)}`));
  if (!sec.wire.items.length) L.push('  (wire offline)');
  L.push('PITCH TARGETS (compose one angle each; use these EXACT names):');
  targets.forEach((t) => L.push(`  - ${t.name}${t.note ? ` (note: ${t.note})` : ''}`));
  if (!targets.length) L.push('  (pipeline empty — no targets)');
  return `Launch state:\n${L.join('\n')}\n\n`
    + `Output EXACTLY this shape:\nBRIEF:\n<the ${WORDS_MIN}-${WORDS_MAX} word spoken brief>\n\nPITCH:\n`
    + (targets.length ? targets.map((t) => `- ${t.name}: <one concrete outreach angle>`).join('\n') : '- (none)');
}

function parseSynth(text, targets) {
  const t = String(text || '');
  const pi = t.search(/(^|\n)\s*PITCH\s*:/i);
  const brief = (pi >= 0 ? t.slice(0, pi) : t).replace(/^\s*BRIEF\s*:/i, '').trim();
  const angles = {};
  if (pi >= 0) {
    for (const line of t.slice(pi).split('\n')) {
      const m = line.match(/^\s*[-*]?\s*(.+?)\s*(?:[:—]|\s-\s)\s*(.+)$/);
      if (m && m[2]) angles[m[1].trim().toLowerCase()] = m[2].trim();
    }
  }
  const withAngles = targets.map((tg) => {
    const key = Object.keys(angles).find((k) => k.includes(tg.name.toLowerCase()) || tg.name.toLowerCase().includes(k));
    return { ...tg, angle: (key && angles[key]) || tg.note || 'Reach out re: the Bonsai Instant Citation launch.' };
  });
  return { brief, withAngles };
}

// ---- panel line assembly (one [SKILL·MISSION] panel: lead brief + sections) ---
function sectionLines(sec, pitchLines, { pipeEmpty, created, rel }) {
  const L = [];
  L.push('— DEPLOY —', ...sec.deploy.lines);
  L.push('— REPO —', ...sec.repos.map((r) => r.line));
  L.push('— VAULT —', ...sec.vault.lines);
  L.push('— WIRE —', ...sec.wire.rows);
  if (sec.wire.degraded && sec.wire.down.length) L.push(`FEEDS DOWN · ${sec.wire.down.map((d) => String(d).toUpperCase()).join(', ')}`);
  L.push('— PITCH —');
  if (created) L.push(`PIPELINE CREATED · ${rel}`);
  if (pipeEmpty) L.push('PIPELINE EMPTY — ADD "- [ ]" TARGETS');
  else pitchLines.forEach((p) => L.push(p));
  return L;
}

function localBrief(sec, targets, { pipeEmpty, created }) {
  const parts = ['Mission brief, local.'];
  parts.push(sec.deploy.speak || (sec.deploy.connected ? 'Deploy connected.' : 'Deploy not connected.'));
  parts.push(`Repos: ${sec.repos.map((r) => r.speak).join('; ')}.`);
  parts.push(sec.vault.speak);
  parts.push(sec.wire.items.length ? `Wire: ${sec.wire.items.slice(0, 3).map((it) => cleanTitle(it.title)).join('; ')}.` : 'Wire offline.');
  if (created) parts.push('Pipeline was empty; I created a template.');
  else if (pipeEmpty) parts.push('Pitch desk: pipeline empty.');
  else parts.push(`Pitch: ${targets.map((t) => t.name).join(', ')}.`);
  return clampWords(parts.filter(Boolean).join(' '), WORDS_MAX);
}

// ---- THE READ: mission.brief --------------------------------------------------
async function brief() {
  const model = MODEL_POLICY.SYNTH;

  // gather every section locally, $0 (each independently fail-soft)
  const [deploy, repos, vault, wire] = await Promise.all([deploySection(), repoSection(), vaultSection(), wireSection()]);
  const sec = { deploy, repos, vault, wire };

  // PITCH DESK — rotate targets from the pipeline, then ASSERT each pitched name
  // appears verbatim in the file (targets are never invented). Names come from the
  // file, so this holds by construction; the filter is the belt-and-suspenders proof.
  const rotated = rotatePitch(vault.open || []);
  const targets = rotated.filter((t) => (vault.text || '').includes(t.name));
  const pipeEmpty = (vault.open || []).length === 0;
  const meta = { pipeEmpty, created: !!vault.created, rel: vault.rel };

  // banked (no key / over cap) → locally-composed brief, [REFLEX], $0, ledger untouched.
  if (!hasKey() || !allow(model)) {
    const spoken = localBrief(sec, targets, meta);
    const pitchLines = targets.map((t) => `${t.name} — ${clip(t.note || '(reach out)', 52)}`);
    return { title: 'MISSION · BRIEF', body: spoken, speak: spoken, lines: sectionLines(sec, pitchLines, meta), reflex: true, degraded: wire.degraded, cost_usd: 0 };
  }

  // EXACTLY ONE metered SYNTH call composes the spoken brief + the pitch angles.
  const r = await ask({ model, system: MISSION_SYSTEM, prompt: missionPrompt(sec, targets), maxTokens: 500 });
  if (r.banked || !r.text) {
    const spoken = localBrief(sec, targets, meta);
    const pitchLines = targets.map((t) => `${t.name} — ${clip(t.note || '(reach out)', 52)}`);
    return { title: 'MISSION · BRIEF', body: spoken, speak: spoken, lines: sectionLines(sec, pitchLines, meta), reflex: true, degraded: wire.degraded, cost_usd: 0 };
  }

  const { usd } = charge(r.model, r.input_tokens, r.output_tokens);
  const { brief: composed, withAngles } = parseSynth(r.text, targets);
  const spoken = clampWords(composed, WORDS_MAX);
  const pitchLines = withAngles.map((t) => `${t.name} — ${clip(t.angle, 60)}`);

  return {
    title: 'MISSION · BRIEF',
    body: spoken,                                   // lead brief (panel body)
    speak: spoken,                                  // spoken in VULCAN 1 — dynamic, metered
    lines: sectionLines(sec, pitchLines, meta),     // per-section rows beneath the lead
    degraded: wire.degraded,
    cost_usd: usd,
  };
}

// ---- THE READ: mission.pitch — the PITCH DESK alone ---------------------------
// The outreach board, read LOCALLY ($0, no SYNTH call): rotate the next 2-3
// uncontacted targets from VULCAN/Pipeline.md and surface them with their existing
// notes. Same containment + never-invent guarantee as the brief's pitch section
// (every pitched name is asserted to appear verbatim in the file). Fail-soft: a
// missing pipeline reports empty (a template is created in PRESENT mode) — never throws.
async function pitch() {
  const vault = await vaultSection();
  const targets = rotatePitch(vault.open || []).filter((t) => (vault.text || '').includes(t.name));
  const pipeEmpty = (vault.open || []).length === 0;

  if (!vault.ok) return { title: 'PITCH · DESK', lines: ['VAULT UNAVAILABLE'], speak: 'The vault is unavailable, so the pitch desk is empty.' };
  if (vault.created) return { title: 'PITCH · DESK', lines: [`PIPELINE CREATED · ${vault.rel}`, 'ADD "- [ ]" TARGETS'], speak: 'The outreach pipeline was empty — I created a template. Add targets and I will work the desk.' };
  if (pipeEmpty || !targets.length) return { title: 'PITCH · DESK', lines: ['PIPELINE EMPTY — ADD "- [ ]" TARGETS'], speak: 'The outreach pipeline has no uncontacted targets.' };

  const lines = targets.map((t) => `${t.name} — ${clip(t.note || '(reach out)', 60)}`);
  const speak = `Pitch desk: ${targets.length} target${targets.length === 1 ? '' : 's'} up — ${targets.map((t) => t.name).join(', ')}.`;
  return { title: 'PITCH · DESK', body: targets.map((t) => `**${t.name}** — ${t.note || 'reach out re: the Bonsai Instant Citation launch.'}`).join('\n\n'), lines, speak, cost_usd: 0 };
}

// ---- skill definition ---------------------------------------------------------
export default {
  id: 'mission',
  actions: {
    'mission.brief': { klass: 'READ', run: brief },
    'mission.pitch': { klass: 'READ', run: pitch },
  },
  // Deterministic router — the mission-brief PREFIXES only. "brief me" stays with the
  // wire skill (registered after this one), so plain briefs are unaffected. "pitch
  // desk" / "outreach board" route to the local $0 pitch read.
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    if (/\b(pitch desk|outreach board|pitch board|work the desk)\b/.test(t)) {
      return { action: 'mission.pitch', detail: {} };
    }
    if (/\b(mission brief|morning brief|bonsai brief|launch brief|command brief)\b/.test(t)) {
      return { action: 'mission.brief', detail: {} };
    }
    return null;
  },
};

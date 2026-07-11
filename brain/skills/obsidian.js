// VULCAN v2 CONDUCTOR — SLICE B3: HANDS II — the OBSIDIAN VAULT — VULCAN's second hand.
// Spoken note capture + vault reads under the constitution.
//   READ   — vault.recent · vault.find                  (free, silent, roam the vault)
//   WRITE  — note.capture (append a timestamped entry)   (announce → run; stays on the
//            machine and costs nothing → PLAIN WRITE, no confirmation tier)
//
// HARD CONTAINMENT (enforced in code, not convention): every WRITE is confined to a
// VULCAN/ folder inside the vault. READs may roam the vault; nothing outside VULCAN/
// is ever created or modified. Path escapes (.., absolute, symlink) are rejected.
//
// Every action returns { title, lines[], speak } — structured for a [SKILL·VAULT]
// blueprint panel plus a one-line spoken summary.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadTokens, writeLocalTokens } from '../tokens.js';

// The local Obsidian registry — the app records every vault it has opened here.
const REGISTRY = path.join(os.homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json');

export const WRITE_DIR = 'VULCAN';        // the ONLY writable subtree inside the vault
const CAPTURE_DIR = 'Captures';    // day files live in VULCAN/Captures/

// H1 THE LEDGER — the Bonsai mission vault, inside the VULCAN/ containment.
//   VULCAN/BONSAI/ ── index.md (front door) · raw/ · wiki/ · outputs/ · daily/
// Dispatch artifacts file to BONSAI/outputs/; every dispatch also appends a one-line
// trace to BONSAI/daily/YYYY-MM-DD.md. All paths stay inside WRITE_DIR (contained).
const BONSAI_DIR = 'BONSAI';
const BONSAI_SUBDIRS = ['raw', 'wiki', 'outputs', 'daily'];

// scan/answer caps — the vault can be large; never let a read run unbounded.
const MAX_SCAN = 4000;             // notes walked per read
const MAX_RECENT = 8;              // rows in a vault.recent panel
const MAX_FIND = 6;                // rows in a vault.find panel
const MAX_READ_BYTES = 512 * 1024; // skip content search on files larger than this

const SKIP_DIRS = new Set(['.obsidian', '.trash', '.git', 'node_modules']);

class ContainmentError extends Error {}
class VaultError extends Error {}

// ---- vault discovery --------------------------------------------------------
// Resolve the vault path from tokens.json (obsidian.vault_path) if present; else
// read the local Obsidian registry — exactly one vault → use it and RECORD it in
// tokens.json; zero or several → stop and ask the operator to choose. Never
// hardcodes a path. Cached per process.
let cachedVault = null;

function readTokens() {
  return loadTokens();   // committed tokens.json + the gitignored local overlay (vault_path)
}

// exported for the mission composer (B5R) — locate the vault + confine writes to
// VULCAN/ exactly like this skill does. One containment implementation, reused.
export function resolveVault() {
  if (cachedVault) return cachedVault;
  const tk = readTokens();
  const fromTokens = tk.obsidian && tk.obsidian.vault_path;
  if (fromTokens && fs.existsSync(fromTokens)) { cachedVault = fromTokens; return cachedVault; }

  let reg;
  try { reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); }
  catch (_) { throw new VaultError('No Obsidian registry found. Set obsidian.vault_path in tokens.json.'); }
  const vaults = Object.values(reg.vaults || {}).map((v) => v && v.path).filter((p) => p && fs.existsSync(p));
  if (vaults.length === 0) throw new VaultError('No Obsidian vault found. Set obsidian.vault_path in tokens.json.');
  if (vaults.length > 1) throw new VaultError(`Found ${vaults.length} Obsidian vaults. Set obsidian.vault_path in tokens.json to choose one.`);
  cachedVault = vaults[0];
  recordVault(cachedVault);
  return cachedVault;
}

// Persist the single discovered vault into the LOCAL overlay (tokens.local.json,
// gitignored) so the choice survives restarts WITHOUT writing a /Users path into
// the committed tokens.json. Best-effort — the path is already cached in-process.
function recordVault(p) {
  writeLocalTokens({ obsidian: { vault_path: p } });
}

// ---- write containment ------------------------------------------------------
// Resolve a relative path INSIDE the vault. confine=true → it must stay within the
// VULCAN/ subtree. Rejects absolute inputs, .. escapes, and symlink escapes
// (realpath the nearest existing ancestor and re-check). Enforced in code.
export function safePath(vault, rel, { confine = true } = {}) {
  const root = confine ? path.join(vault, WRITE_DIR) : vault;
  if (typeof rel !== 'string' || rel === '') throw new ContainmentError('empty path');
  if (path.isAbsolute(rel)) throw new ContainmentError(`absolute path rejected: ${rel}`);
  const within = (base, p) => { const r = path.relative(base, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

  const target = path.resolve(root, rel);
  if (!within(root, target)) throw new ContainmentError(`escapes ${confine ? WRITE_DIR : 'vault'}: ${rel}`);

  // symlink escape: realpath the deepest ancestor that actually exists.
  let probe = target;
  while (!fs.existsSync(probe)) { const up = path.dirname(probe); if (up === probe) break; probe = up; }
  const realProbe = fs.realpathSync(probe);
  const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
  if (!within(realRoot, realProbe)) throw new ContainmentError(`symlink escapes ${confine ? WRITE_DIR : 'vault'}: ${rel}`);
  return target;
}

function ensureWriteDir(vault) {
  const dir = path.join(vault, WRITE_DIR, CAPTURE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---- helpers ----------------------------------------------------------------
const clip = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const noteName = (f) => f.replace(/\.md$/i, '');

const p2 = (n) => String(n).padStart(2, '0');
function dayStamp(d = new Date()) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function snippetAround(txt, idx, len) {
  const a = Math.max(0, idx - 24), b = Math.min(txt.length, idx + len + 24);
  return `${a > 0 ? '…' : ''}${txt.slice(a, b).replace(/\s+/g, ' ').trim()}${b < txt.length ? '…' : ''}`;
}

function errResult(title, e) {
  const msg = String((e && e.message) || e);
  return { title, lines: ['VAULT UNAVAILABLE', clip(msg, 72).toUpperCase()], speak: msg };
}

// Walk the vault for markdown notes, skipping app/system dirs and dotfiles.
// Stays within the vault (reads may roam it) and never follows a directory
// symlink out. Capped so a huge vault can't stall a read.
function walkNotes(vault) {
  const out = [];
  const stack = [vault];
  while (stack.length && out.length < MAX_SCAN) {
    const dir = stack.pop();
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        let mtime = 0, size = 0;
        try { const st = fs.statSync(full); mtime = st.mtimeMs; size = st.size; } catch (_) { /* skip */ }
        out.push({ path: full, name: e.name, mtime, size });
      }
    }
  }
  return out;
}

// ---- READ actions -----------------------------------------------------------
async function recent() {
  let vault;
  try { vault = resolveVault(); } catch (e) { return errResult('VAULT · RECENT', e); }
  const files = walkNotes(vault).sort((a, b) => b.mtime - a.mtime).slice(0, MAX_RECENT);
  if (!files.length) return { title: 'VAULT · RECENT', lines: ['NO NOTES FOUND'], speak: 'The vault has no notes yet.' };
  return {
    title: 'VAULT · RECENT',
    lines: files.map((f) => `${clip(noteName(f.name), 40)} · ${ago(f.mtime)}`),
    speak: `Most recent in the vault: ${files.slice(0, 3).map((f) => noteName(f.name)).join(', ')}.`,
  };
}

async function find(detail = {}) {
  let vault;
  try { vault = resolveVault(); } catch (e) { return errResult('VAULT · FIND', e); }
  const query = String(detail.query || '').trim();
  const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (!terms.length) return { title: 'VAULT · FIND', lines: ['NO SEARCH TERMS'], speak: 'What should I search the vault for?' };

  const hits = [];
  for (const f of walkNotes(vault)) {
    const nameL = f.name.toLowerCase();
    const nameHit = terms.every((tm) => nameL.includes(tm));
    let contentHit = false, snippet = '';
    if (!nameHit && f.size <= MAX_READ_BYTES) {
      try {
        const txt = fs.readFileSync(f.path, 'utf8');
        const low = txt.toLowerCase();
        contentHit = terms.every((tm) => low.includes(tm));
        if (contentHit) snippet = snippetAround(txt, low.indexOf(terms[0]), terms[0].length);
      } catch (_) { /* unreadable → skip */ }
    }
    if (nameHit || contentHit) hits.push({ ...f, nameHit, snippet });
  }
  hits.sort((a, b) => (b.nameHit - a.nameHit) || (b.mtime - a.mtime));
  const top = hits.slice(0, MAX_FIND);
  if (!top.length) return { title: 'VAULT · FIND', lines: [`NO MATCH · ${clip(query, 40).toUpperCase()}`], speak: `No notes match ${query}.` };
  return {
    title: 'VAULT · FIND',
    lines: top.map((h) => (h.nameHit ? `${clip(noteName(h.name), 40)} · [NAME]` : `${clip(noteName(h.name), 26)} · ${clip(h.snippet, 40)}`)),
    speak: `${top.length} match${top.length > 1 ? 'es' : ''} for ${query}. Top: ${noteName(top[0].name)}.`,
  };
}

// ---- WRITE action -----------------------------------------------------------
// Append a timestamped entry (one block, ISO time, the spoken content) to
// VULCAN/Captures/YYYY-MM-DD.md, creating the day file as needed. detail.file is
// the containment seam — an override target that is still forced inside VULCAN/.
async function capture(detail = {}) {
  const content = String(detail.content || '').trim();
  let vault;
  try { vault = resolveVault(); } catch (e) { return errResult('VAULT · CAPTURE', e); }
  if (!content) return { title: 'VAULT · CAPTURE', lines: ['NOTHING TO CAPTURE'], speak: 'I did not catch the note — nothing was captured.' };
  ensureWriteDir(vault);

  const rel = detail.file ? String(detail.file) : path.join(CAPTURE_DIR, `${dayStamp()}.md`);
  let file;
  try { file = safePath(vault, rel, { confine: true }); }
  catch (e) {
    return { title: 'VAULT · CAPTURE', lines: ['BLOCKED — CONTAINMENT', clip(String(e.message), 60).toUpperCase()], speak: 'Blocked. That path escapes the vault sandbox; nothing was written.' };
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const iso = new Date().toISOString();
  const header = fs.existsSync(file) ? '' : `# Captures · ${dayStamp()}\n\n`;
  fs.appendFileSync(file, `${header}- ${iso} · ${content}\n`);

  const dest = path.relative(vault, file);
  return {
    title: 'VAULT · CAPTURE',
    lines: [`DEST · ${dest}`, `TIME · ${iso}`, `ENTRY · ${clip(content, 64)}`],
    speak: `Captured to the vault, under ${CAPTURE_DIR} for today.`,
  };
}

// ---- ARTIFACT WRITE (G4 THE LIFECYCLE) --------------------------------------
// Every dispatch files a rendered markdown artifact through this ONE hand, so the
// containment guarantee is identical to note.capture: writes are forced inside the
// VULCAN/ subtree (here VULCAN/outputs/, the pre-LEDGER path — Front H restructures
// later). Returns the vault-relative path + an obsidian:// open URI so the renderer
// overlay's "OPEN IN VAULT ↗" handoff needs no path logic of its own. Throws only on
// a genuine containment/vault failure (the dispatch reports that honestly).
const ARTIFACT_DIR = path.join(BONSAI_DIR, 'outputs');   // VULCAN/BONSAI/outputs/ — dispatch artifacts
const DAILY_DIR = path.join(BONSAI_DIR, 'daily');        // VULCAN/BONSAI/daily/  — the activity trail

function slugify(s) {
  return String(s || 'artifact').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'artifact';
}
function stamp(d = new Date()) {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}
function timeStamp(d = new Date()) { return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }

// Obsidian keys vaults by the vault folder's basename; the file arg drops the .md.
function obsidianUriFor(vault, vaultRel) {
  return `obsidian://open?vault=${encodeURIComponent(path.basename(vault))}&file=${encodeURIComponent(vaultRel.replace(/\.md$/i, ''))}`;
}

// H1 THE LEDGER — the front-door README for VULCAN/BONSAI/index.md. Written once on
// first scaffold; never clobbered thereafter (operator edits survive).
const BONSAI_INDEX_MD = `# BONSAI — VULCAN Vault

VULCAN's working vault for the Bonsai Instant Citation launch. Everything VULCAN files
for the mission lands here, inside the \`VULCAN/\` containment — nothing is ever written
outside this subtree.

## What lives where

- **outputs/** — dispatch artifacts. Every command VULCAN runs (mission brief, metrics
  pull, outreach, …) writes its rendered result here as a timestamped markdown file.
- **daily/** — the activity trail. One file per day (\`YYYY-MM-DD.md\`); every dispatch
  appends a one-line trace: \`time · command · artifact\`.
- **raw/** — unprocessed source material (pulls, dumps, captures) awaiting refinement.
- **wiki/** — durable, curated notes: the distilled mission knowledge base.

## Front door

This index is the door. The Z1 DOCUMENTS panel on the VULCAN stage reads the newest
\`outputs/\` plus today's \`daily/\` file as the live vault trail.

*Filed by VULCAN · Front H · THE LEDGER.*
`;

// Scaffold VULCAN/BONSAI/ (dirs + index front door) and, once, migrate any legacy
// dispatch artifacts from the pre-LEDGER VULCAN/outputs/ into BONSAI/outputs/. All
// inside WRITE_DIR containment; idempotent; best-effort migration never blocks filing.
let bonsaiReady = false;
function ensureBonsai(vault) {
  if (bonsaiReady) return;
  const root = path.join(vault, WRITE_DIR, BONSAI_DIR);
  for (const sub of BONSAI_SUBDIRS) fs.mkdirSync(path.join(root, sub), { recursive: true });
  const index = path.join(root, 'index.md');
  if (!fs.existsSync(index)) fs.writeFileSync(index, BONSAI_INDEX_MD);
  try {
    const oldDir = path.join(vault, WRITE_DIR, 'outputs');            // pre-LEDGER location
    const newDir = path.join(vault, WRITE_DIR, ARTIFACT_DIR);
    if (fs.existsSync(oldDir) && path.resolve(oldDir) !== path.resolve(newDir)) {
      for (const e of fs.readdirSync(oldDir, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.toLowerCase().endsWith('.md')) continue;
        const to = path.join(newDir, e.name);
        if (!fs.existsSync(to)) fs.renameSync(path.join(oldDir, e.name), to);
      }
      try { if (fs.readdirSync(oldDir).length === 0) fs.rmdirSync(oldDir); } catch (_) { /* leave non-empty dir */ }
    }
  } catch (_) { /* migration is best-effort */ }
  bonsaiReady = true;
}

// The daily trail: one line per dispatch — time · command · artifact filename — appended
// to VULCAN/BONSAI/daily/YYYY-MM-DD.md, the day file created on the first write each day.
function appendDailyTrace(vault, name, filename, d = new Date()) {
  const file = safePath(vault, path.join(DAILY_DIR, `${dayStamp(d)}.md`), { confine: true });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = fs.existsSync(file) ? '' : `# Daily · ${dayStamp(d)}\n\n`;
  fs.appendFileSync(file, `${header}- ${timeStamp(d)} · ${name} · ${filename}\n`);
  return file;
}

// name: a human command label ("MISSION BRIEF"); markdown: the full artifact body.
// Writes VULCAN/BONSAI/outputs/<stamp>-<slug>.md, appends the daily trace, and returns
// the handle (obsidian:// URI included so the renderer's OPEN IN VAULT needs no path logic).
export function writeArtifact(name, markdown) {
  const vault = resolveVault();                              // throws → dispatch reports it
  ensureBonsai(vault);                                       // BONSAI structure + one-time migration
  const dir = path.join(vault, WRITE_DIR, ARTIFACT_DIR);
  fs.mkdirSync(dir, { recursive: true });                    // containment root must exist before safePath
  const filename = `${stamp()}-${slugify(name)}.md`;
  const file = safePath(vault, path.join(ARTIFACT_DIR, filename), { confine: true });   // throws on any escape
  fs.writeFileSync(file, String(markdown));
  // the daily trail rides the same dispatch; a trace hiccup never voids the filed artifact.
  try { appendDailyTrace(vault, name, filename); } catch (_) { /* trace is non-fatal */ }
  const vaultRel = path.relative(vault, file);               // e.g. VULCAN/BONSAI/outputs/…md
  return { filename, rel: vaultRel, vaultPath: file, obsidianUri: obsidianUriFor(vault, vaultRel), vaultName: path.basename(vault) };
}

// I2 THE CREW — write a durable day document to VULCAN/BONSAI/daily/ (the plan lives
// here, per spec §7). Same containment as writeArtifact; filename is date-stamped +
// slugged (e.g. 2026-07-11-plan.md), so re-running a plan the same day overwrites it
// rather than piling up. Returns the same handle shape as writeArtifact.
export function writeDailyDoc(name, markdown) {
  const vault = resolveVault();
  ensureBonsai(vault);
  const dir = path.join(vault, WRITE_DIR, DAILY_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${dayStamp()}-${slugify(name)}.md`;
  const file = safePath(vault, path.join(DAILY_DIR, filename), { confine: true });
  fs.writeFileSync(file, String(markdown));
  const vaultRel = path.relative(vault, file);
  return { filename, rel: vaultRel, vaultPath: file, obsidianUri: obsidianUriFor(vault, vaultRel), vaultName: path.basename(vault) };
}

// I2 THE CREW — VAULT CLEAN re-index. Refresh a managed, auto-generated inventory
// section inside VULCAN/BONSAI/index.md WITHOUT clobbering the H1 front-door prose or
// any operator edits: everything between the two markers is replaced; the rest is left
// exactly as-is. If the markers are absent (first clean), the block is appended once.
const INDEX_BEGIN = '<!-- VULCAN:INDEX:BEGIN — auto-generated by VAULT CLEAN; edits here are overwritten -->';
const INDEX_END = '<!-- VULCAN:INDEX:END -->';
export function reindexVault({ apply = true } = {}) {
  const vault = resolveVault();
  ensureBonsai(vault);
  const root = path.join(vault, WRITE_DIR, BONSAI_DIR);
  const count = (sub) => { try { return fs.readdirSync(path.join(root, sub)).filter((f) => f.toLowerCase().endsWith('.md')).length; } catch (_) { return 0; } };
  const outputs = count('outputs'), daily = count('daily'), wiki = count('wiki'), raw = count('raw');
  const trail = vaultTrail({ max: 8 });
  const lines = [
    INDEX_BEGIN,
    '',
    '## Vault index (auto)',
    '',
    `_Last re-indexed by VAULT CLEAN · ${new Date().toISOString().replace('T', ' ').slice(0, 19)}_`,
    '',
    `- **outputs/** — ${outputs} artifact${outputs === 1 ? '' : 's'}`,
    `- **daily/** — ${daily} day file${daily === 1 ? '' : 's'}`,
    `- **wiki/** — ${wiki} note${wiki === 1 ? '' : 's'}`,
    `- **raw/** — ${raw} file${raw === 1 ? '' : 's'}`,
    '',
    '### Most recent',
    '',
    ...(trail.length ? trail.map((r) => `- \`${r.name}\`${r.daily ? ' (daily trail)' : ''}`) : ['- (nothing filed yet)']),
    '',
    INDEX_END,
  ].join('\n');

  const indexFile = path.join(root, 'index.md');
  let existing = '';
  try { existing = fs.readFileSync(indexFile, 'utf8'); } catch (_) { existing = BONSAI_INDEX_MD; }
  let next;
  const bi = existing.indexOf(INDEX_BEGIN);
  const ei = existing.indexOf(INDEX_END);
  if (bi >= 0 && ei > bi) next = existing.slice(0, bi) + lines + existing.slice(ei + INDEX_END.length);
  else next = existing.replace(/\s*$/, '') + '\n\n' + lines + '\n';
  if (apply) fs.writeFileSync(indexFile, next);
  return { outputs, daily, wiki, raw, trail, applied: !!apply, indexRel: path.relative(vault, indexFile) };
}

// H1 — the LIVE VAULT TRAIL for the Z1 DOCUMENTS panel: newest files from BONSAI/outputs/
// plus today's daily file, each with its true mtime + an obsidian:// open URI. READ-only,
// contained, capped. Throws only on vault-resolve failure (the IPC reports it fail-soft).
export function vaultTrail({ max = 6 } = {}) {
  const vault = resolveVault();
  ensureBonsai(vault);
  const rows = [];
  const push = (full, daily = false) => {
    let mtimeMs = 0; try { mtimeMs = fs.statSync(full).mtimeMs; } catch (_) { return; }
    rows.push({ name: path.basename(full), mtimeMs, daily, obsidianUri: obsidianUriFor(vault, path.relative(vault, full)) });
  };
  const outDir = path.join(vault, WRITE_DIR, ARTIFACT_DIR);
  try {
    for (const e of fs.readdirSync(outDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.md')) push(path.join(outDir, e.name));
    }
  } catch (_) { /* no outputs yet */ }
  const todayDaily = path.join(vault, WRITE_DIR, DAILY_DIR, `${dayStamp()}.md`);
  if (fs.existsSync(todayDaily)) push(todayDaily, true);
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return rows.slice(0, max).map((r) => ({ name: r.name, mtimeMs: r.mtimeMs, ageMs: Date.now() - r.mtimeMs, daily: r.daily, obsidianUri: r.obsidianUri }));
}

// pull the search phrase out of a find/search utterance
function extractQuery(raw) {
  return String(raw)
    .replace(/^\s*(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?/i, '')
    .replace(/\b(find|search|look\s+up|look\s+for|pull\s+up|dig\s+up)\b/gi, ' ')
    .replace(/\b(in|from|of|inside)?\s*(my|our|the|a)?\s*vault\b/gi, ' ')
    .replace(/\b(my|our|the|a|any|some)\b/gi, ' ')
    .replace(/\b(notes?|captures?)\b/gi, ' ')
    .replace(/\b(for|about|on|regarding|re)\b/gi, ' ')
    .replace(/[?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- skill definition -------------------------------------------------------
export default {
  id: 'vault',
  actions: {
    'vault.recent': { klass: 'READ', run: recent },
    'vault.find': { klass: 'READ', run: find },
    'note.capture': {
      klass: 'WRITE',
      run: capture,
      announceText: () => 'Capturing to the vault.',
    },
  },
  // Deterministic router — reads first (questions ABOUT notes), then capture
  // PREFIXES. Writes NEVER come from a fuzzy guess; they must open with an explicit
  // capture verb. Fuzzy Haiku fallback (conductor) can only reach the free reads.
  route(text) {
    const raw = String(text).trim();
    const t = ` ${raw.toLowerCase()} `;
    const has = (re) => re.test(t);

    // READS — interrogating existing notes.
    if (has(/\bwhat did i (note|jot|capture|write down)\b/) || has(/\bwhat have i noted\b/)
        || (has(/\b(recent|recently|latest|last)\b/) && has(/\b(notes?|captures?)\b/))
        || (has(/\b(my|any|recent)\b/) && has(/\bcaptures?\b/))) {
      return { action: 'vault.recent', detail: {} };
    }
    if (has(/\bsearch the vault\b/)
        || (has(/\b(find|search|look up|look for|pull up|dig up)\b/) && has(/\b(note|notes|vault)\b/))) {
      return { action: 'vault.find', detail: { query: extractQuery(raw) } };
    }

    // WRITES — capture prefixes only.
    const cap = raw.match(/^\s*(?:please\s+)?(?:note that|note down|note|capture|jot(?:\s+down)?|remember(?:\s+this(?:\s+that)?)?|take\s+a\s+note(?:\s+that)?|log(?:\s+that)?)\b[:,\-\s]*(.*)$/i);
    if (cap) {
      const content = cap[1].trim();
      if (content) return { action: 'note.capture', detail: { content } };
    }
    return null;
  },
};

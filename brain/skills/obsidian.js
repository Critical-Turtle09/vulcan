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

const WRITE_DIR = 'VULCAN';        // the ONLY writable subtree inside the vault
const CAPTURE_DIR = 'Captures';    // day files live in VULCAN/Captures/

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

function resolveVault() {
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
function safePath(vault, rel, { confine = true } = {}) {
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

// VULCAN v2 CONDUCTOR — SLICE B2: the REPO COMMANDER — VULCAN's first hand.
// Built on git + the gh CLI already authenticated on this machine (osxkeychain
// credential helper). NEVER reads the API key, NEVER embeds a token: the tag
// push rides the machine's existing gh credential.
//   READ           — repo.status · repo.log · repo.diffsum   (free, silent)
//   WRITE_CONFIRM   — repo.tag (create + push annotated tag) — leaves the machine,
//                     so it requires a SPOKEN confirmation.
// Every action returns { title, lines[], speak } — structured for a blueprint
// panel plus a one-line spoken summary.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../env.js';

const run = promisify(execFile);
const SEP = '§';   // record separator for --pretty formats

async function git(args, { timeout = 8000 } = {}) {
  const { stdout } = await run('git', args, { cwd: ROOT, timeout });
  return stdout.replace(/\s+$/, '');
}

const stamp = () => {
  const d = new Date(); const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
};

// FX SIGNATURE PATH — normalize spoken tag-name variants so live speech reliably
// reaches the same tag. Whisper renders "v2-signed" as "v2 signed", "V two signed",
// "version two signed", etc. This collapses number-words + version cues to a hyphen
// slug WITHOUT destroying semver dots: "v2 signed" / "v two signed" / "V two signed"
// / "v2-signed" all → "v2-signed"; "v1.4.0" stays "v1.4.0".
const NUMWORDS = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
function normalizeTag(phrase) {
  let t = String(phrase).toLowerCase().trim();
  t = t.replace(/^\s*(?:it\s+|as\s+|to\s+|the\s+|named\s+|call(?:ed)?\s+)+/i, '');   // strip leaked leading cues
  t = t.replace(/\b(please|now|thanks?|thank you|to origin|on (?:the )?remote)\b.*$/i, '').trim();   // drop filler tail
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (m) => NUMWORDS[m]); // number words → digits
  t = t.replace(/\bver(?:sion)?\s*\.?\s*(\d)/g, 'v$1');   // "version 2" / "ver 2" → "v2"
  t = t.replace(/\bv\s+(\d)/g, 'v$1');                     // "v 2" → "v2"
  t = t.replace(/[^a-z0-9./-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');   // slug; keep . / -
  return t;
}

// pull an explicit tag name out of the utterance; else a stamped default
function parseTag(text) {
  const raw = String(text);
  const m = raw.match(/\b(?:as|named|call(?:ed)?|tag(?:ged)?(?:\s+it)?|release(?:d)?(?:\s+as)?|version)\s+(?:the\s+\w+\s+(?:as\s+)?)?(.+)$/i);
  if (m) {
    const norm = normalizeTag(m[1]);
    if (norm && !/^(the|forge|repo|it|this|current|latest|origin)$/.test(norm)) return norm;
  }
  const v = raw.toLowerCase().match(/\b(?:v|ver|version)\s*\.?\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\w.\- ]*/);
  if (v) { const norm = normalizeTag(v[0]); if (norm) return norm; }
  return `forge-${stamp()}`;
}

// ---- READ actions ----------------------------------------------------------
async function status() {
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const [hash, subject, when] = (await git(['log', '-1', `--pretty=format:%h${SEP}%s${SEP}%cr`])).split(SEP);
  const porcelain = await git(['status', '--porcelain']);
  const dirty = porcelain ? porcelain.split('\n').length : 0;
  let remote = '—';
  try { remote = (await git(['rev-parse', '--short', `origin/${branch}`])).trim(); } catch (_) { /* no remote ref */ }
  return {
    title: 'REPO · STATUS',
    lines: [
      `BRANCH · ${branch}`,
      `HEAD · ${hash} · ${subject}`,
      `WHEN · ${when}`,
      `TREE · ${dirty ? `${dirty} UNCOMMITTED` : 'CLEAN'}`,
      `REMOTE · origin/${branch} · ${remote}`,
    ],
    speak: `On ${branch}. Head ${hash}, ${subject}. Tree ${dirty ? `${dirty} uncommitted` : 'clean'}.`,
  };
}

async function log() {
  const raw = await git(['log', '-6', `--pretty=format:%h${SEP}%s`]);
  const rows = raw.split('\n').map((l) => l.split(SEP));
  return {
    title: 'REPO · LOG',
    lines: rows.map(([h, s]) => `${h} · ${s}`),
    speak: `Recent commits: ${rows.slice(0, 3).map(([h, s]) => `${h} ${s}`).join('; ')}.`,
  };
}

async function diffsum() {
  const [hash, subject] = (await git(['log', '-1', `--pretty=format:%h${SEP}%s`])).split(SEP);
  const stat = await git(['show', 'HEAD', '--stat', '--pretty=format:']);
  const lines = stat.split('\n').map((l) => l.trim()).filter(Boolean);
  const files = lines.filter((l) => l.includes('|')).slice(0, 6);
  const summary = lines.find((l) => /changed/.test(l)) || `${files.length} files changed`;
  return {
    title: 'REPO · DIFFSUM',
    lines: [`COMMIT · ${hash} · ${subject}`, ...files.map((f) => `· ${f.replace(/\s+/g, ' ')}`), `SUMMARY · ${summary}`],
    speak: `Last commit ${hash}: ${summary}.`,
  };
}

// ---- WRITE_CONFIRM action ---------------------------------------------------
async function tag(detail = {}) {
  const name = detail.tag || `forge-${stamp()}`;
  const message = detail.message || `VULCAN forge tag ${name}`;
  const [hash, subject] = (await git(['log', '-1', `--pretty=format:%h${SEP}%s`])).split(SEP);
  try {
    await git(['tag', '-a', name, '-m', message]);
    await git(['push', 'origin', name], { timeout: 25000 });   // rides gh's osxkeychain credential
    return {
      title: 'REPO · TAG',
      lines: [`TAG · ${name}`, `AT · ${hash} · ${subject}`, `PUSHED · origin`],
      speak: `Tag ${name} created and pushed to origin, at ${hash}.`,
    };
  } catch (e) {
    const msg = String(e && e.message || e).split('\n').find((l) => /error|fatal|rejected|exists/i.test(l)) || 'failed';
    return {
      title: 'REPO · TAG',
      lines: [`TAG · ${name}`, `ERROR · ${msg.trim().slice(0, 80)}`],
      speak: `Tag ${name} failed: ${msg.trim().slice(0, 80)}.`,
    };
  }
}

// ---- skill definition -------------------------------------------------------
export default {
  id: 'repo',
  actions: {
    'repo.status': { klass: 'READ', run: status },
    'repo.log': { klass: 'READ', run: log },
    'repo.diffsum': { klass: 'READ', run: diffsum },
    'repo.tag': {
      klass: 'WRITE_CONFIRM',
      run: tag,
      announceText: (d) => `Create and push annotated tag ${d.tag || 'a new tag'} to origin. Say confirm to proceed, or cancel.`,
    },
  },
  // deterministic router — repo/git/tag vocabulary only. Writes NEVER come from a
  // fuzzy guess; they must match this explicit lexicon.
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    const has = (re) => re.test(t);
    if (has(/\b(tag|release)\b/) && !has(/\bpackage\b/)) return { action: 'repo.tag', detail: { tag: parseTag(text) } };
    if (has(/\b(diff|diffsum)\b/) || has(/what('?s| has| did)?\s+chang/)) return { action: 'repo.diffsum', detail: {} };
    if (has(/\b(commit log|git log|repo log|commit history|recent commits|last few commits|commits)\b/) || (has(/\blog\b/) && has(/\b(commit|git|repo)\b/))) return { action: 'repo.log', detail: {} };
    if (has(/\b(latest|last|current|most recent)\s+commit\b/) || has(/\b(head|tip)\b/)
        || has(/\b(repo|repository|git) status\b/)
        || (has(/\b(repo|repository|git|codebase|branch|forge)\b/) && has(/\b(status|state|sitrep|clean|dirty|standing)\b/))) return { action: 'repo.status', detail: {} };
    return null;
  },
};

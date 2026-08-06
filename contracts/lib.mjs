// C1 THE NIGHT WATCHMAN — the contract library. Shared spine for the generic runner:
// canonicalization, signing, and signature verification. The one law it enforces is
// STANDING CONTRACTS §: a contract file (contracts/<id>.json) is INERT until an operator
// has SIGNED it (contracts/<id>.md carries a signature over the canonical JSON). The
// runner executes ONLY signed contracts, so no config can drive a check — or, once armed,
// an egress — unless the operator put their signature on it. Editing the JSON breaks the
// signature (tamper-evident); the operator re-signs deliberately with contracts/sign.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CONTRACTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_DIR = path.dirname(CONTRACTS_DIR);
export const LOGS_DIR = path.join(REPO_DIR, 'logs');

// stable, key-sorted JSON — the exact bytes the signature is computed over, so two
// machines (signer + runner) agree regardless of key order or incidental whitespace.
export function canonicalJson(obj) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((o, k) => { o[k] = sort(v[k]); return o; }, {});
    }
    return v;
  };
  return JSON.stringify(sort(obj));
}

export function sha256Hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

// the signature a contract JSON must carry to be considered signed.
export function signatureFor(contractObj) { return `sha256:${sha256Hex(canonicalJson(contractObj))}`; }

export function contractPath(id) { return path.join(CONTRACTS_DIR, `${id}.json`); }
export function signaturePath(id) { return path.join(CONTRACTS_DIR, `${id}.md`); }

export function loadContract(id) {
  return JSON.parse(fs.readFileSync(contractPath(id), 'utf8'));
}

// parse the `signature:` and `signer:` lines out of a signed .md (frontmatter-ish; we
// scan the whole file so the charter body can be free prose beneath).
export function parseSignedMd(id) {
  const p = signaturePath(id);
  if (!fs.existsSync(p)) return { present: false };
  const md = fs.readFileSync(p, 'utf8');
  const sig = (md.match(/^\s*signature:\s*(sha256:[0-9a-f]{64})\s*$/mi) || [])[1] || null;
  const signer = (md.match(/^\s*signer:\s*(.+?)\s*$/mi) || [])[1] || null;
  const signedAt = (md.match(/^\s*signed-at:\s*(.+?)\s*$/mi) || [])[1] || null;
  return { present: true, sig, signer, signedAt };
}

// verify(id) → { signed, reason, signer }. signed=true ONLY when a .md exists AND its
// signature equals the signature of the current canonical JSON.
export function verify(id) {
  let contract;
  try { contract = loadContract(id); } catch (e) { return { signed: false, reason: `no contract json (${e.code || e.message})` }; }
  const md = parseSignedMd(id);
  if (!md.present) return { signed: false, reason: 'no signature file (unsigned)', contract };
  if (!md.sig) return { signed: false, reason: 'signature file carries no signature line', contract };
  const expected = signatureFor(contract);
  if (md.sig !== expected) return { signed: false, reason: 'signature does not match contract (tampered or unsigned edit)', contract, signer: md.signer };
  return { signed: true, reason: 'signature valid', contract, signer: md.signer, signedAt: md.signedAt };
}

export function ensureLogsDir() { fs.mkdirSync(LOGS_DIR, { recursive: true }); }

// append one line to logs/night-watchman.log with a caller-supplied ISO timestamp
// (callers pass the time so this stays pure of wall-clock policy).
export function appendLog(iso, message) {
  ensureLogsDir();
  fs.appendFileSync(path.join(LOGS_DIR, 'night-watchman.log'), `${iso}  ${message}\n`);
}

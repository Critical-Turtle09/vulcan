// VULCAN — node-side token loader with a gitignored local overlay.
// tokens.json (committed, the single visual+config source) is deep-merged UNDER
// tokens.local.json (gitignored) so machine-specific values — secrets-adjacent
// paths like obsidian.vault_path — stay OUT of the committed tree. No /Users path
// ever lands in a committed file.
//
// This is the node/fs reader (brain + electron main). The renderer bundles
// tokens.json statically via Vite and never needs the local overlay (it holds no
// visual values — only machine paths).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.js';

export const TOKENS_PATH = path.join(ROOT, 'tokens.json');
export const LOCAL_TOKENS_PATH = path.join(ROOT, 'tokens.local.json');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// deep-merge: objects recurse, everything else (scalars, arrays) is overwritten.
function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

// The merged token tree: committed tokens.json with the local overlay on top.
export function loadTokens() {
  const base = readJson(TOKENS_PATH) || {};
  const local = readJson(LOCAL_TOKENS_PATH);
  return local ? deepMerge(base, local) : base;
}

// Persist a partial overlay into tokens.local.json (deep-merged over what's there).
// Records machine-specific values (e.g. a discovered vault) WITHOUT ever touching
// the committed tokens.json. Best-effort — callers cache in-process regardless.
export function writeLocalTokens(partial) {
  const cur = readJson(LOCAL_TOKENS_PATH) || {};
  const next = deepMerge(cur, partial);
  try { fs.writeFileSync(LOCAL_TOKENS_PATH, JSON.stringify(next, null, 2) + '\n'); } catch (_) { /* best-effort */ }
  return next;
}

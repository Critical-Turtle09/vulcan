// PART 9 — auto-generate TOKENS.md from tokens.json (the single source of visual
// truth). Every color, duration, size, and easing in VULCAN resolves through
// tokens; this doc is generated so it never drifts. Run: npm run tokens
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8'));

const fmt = (v) => Array.isArray(v) ? `\`[${v.join(', ')}]\`` : (typeof v === 'object' && v !== null) ? `\`${JSON.stringify(v)}\`` : `\`${v}\``;

function rows(obj, prefix = '') {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) out += rows(v, key);
    else out += `| \`${key}\` | ${fmt(v)} |\n`;
  }
  return out;
}

const SECTION_DESC = {
  palette: 'The rationed palette. Greyscale world · bone data · molten heat. Never pure #000/#FFF.',
  motion: 'Motion-physics tokens (§5): idle drift, granular transitions, propagation, post grade, reveal band.',
  type: 'Type tokens — Martian Mono (data) · Archivo (UI). No stock sci-fi faces.',
  scene: 'Slice-0 material-test scene + the device/schematic scene (`scene.schematic.*`).',
  orb: 'The orb: particle-field body, audio-reactive waves, hairline wave-rings, per-state machine.',
  hud: 'V.A.U.L.T HUD geometry (side columns, blueprint chrome).',
  voice: 'Voice organ: wake/dismiss phrases, provider chain, VAD, envelope, test timings.',
  reflex: 'Local reflexes — Ollama endpoint/model + enable flag.',
  profile: 'Mode system — default profile, switch key, crossflow.',
  ignition: 'The ignition ceremony (kindle → strike → title → resolve) + the quench, spark field, hotkey.',
  map: 'Summoned theater — sites, routes, terrain, summon crossflow, real-topo.',
  ink: 'Molten working-ink intensities on summoned scenes (resting restraint for retune).',
  panel: 'Tethered blueprint panels — geometry, granular glyph resolve/dissolve.',
  wire: 'The wire organ — poll cadence, keyword scoring, ignition/propagation/decay, heat discipline.',
  quotes: 'The quotes organ — poll/cache cadence, greyscale mark geometry.',
};

let md = `# VULCAN — TOKENS

> **Auto-generated** from \`tokens.json\` by \`npm run tokens\` (\`scripts/gen-tokens.mjs\`).
> Do not edit by hand. Every color, duration, easing, and size in VULCAN resolves
> through these tokens (doctrine 10 — tokens, never hardcode). Restyling from an
> operator reference is a token edit, not a code change.

`;

for (const [section, val] of Object.entries(tokens)) {
  md += `## \`${section}\`\n\n`;
  if (SECTION_DESC[section]) md += `${SECTION_DESC[section]}\n\n`;
  md += `| Token | Value |\n|---|---|\n${rows(val, section === 'palette' ? '' : section)}\n`;
}

fs.writeFileSync(path.join(ROOT, 'TOKENS.md'), md);
console.log('TOKENS.md written');

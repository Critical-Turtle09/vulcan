// Single source of visual truth. Every color, duration, easing, and size in the
// scene resolves through here — doctrine 10 (tokens, never hardcode). Nothing
// downstream is allowed to invent a literal.
import * as THREE from 'three';
import raw from '../tokens.json';

export const TOKENS = raw;

// hex -> THREE.Color (linear-correct for shader use)
export function color(path) {
  const hex = raw.palette[path];
  if (!hex) throw new Error(`token: unknown palette key "${path}"`);
  return new THREE.Color(hex).convertSRGBToLinear();
}

// hex string straight through (for DOM / CSS)
export function hex(path) {
  const h = raw.palette[path];
  if (!h) throw new Error(`token: unknown palette key "${path}"`);
  return h;
}

export function motion(path) {
  const v = raw.motion[path];
  if (v === undefined) throw new Error(`token: unknown motion key "${path}"`);
  return v;
}

export function scene(path) {
  const v = raw.scene[path];
  if (v === undefined) throw new Error(`token: unknown scene key "${path}"`);
  return v;
}

// Publish the whole palette + type as CSS custom properties so the DOM label
// layer draws from the same token source as shader space — no parallel literals.
export function injectCSSVars() {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(raw.palette)) {
    root.setProperty(`--${k.replace(/\./g, '-')}`, v);
  }
  root.setProperty('--type-mono', raw.type.mono);
  root.setProperty('--type-ui', raw.type.ui);
  root.setProperty('--label-px', `${raw.type['label.px']}px`);
  root.setProperty('--label-track', `${raw.type['label.trackEm']}em`);
  // V.A.U.L.T HUD (§6-D) — publish so the DOM columns draw from the same tokens
  const h = raw.hud;
  root.setProperty('--hud-margin-x', `${h['margin.x']}px`);
  root.setProperty('--hud-margin-y', `${h['margin.y']}px`);
  root.setProperty('--hud-col-w', `${h['col.width']}px`);
  root.setProperty('--hud-block-gap', `${h['block.gap']}px`);
  root.setProperty('--hud-eyebrow-px', `${h['eyebrow.px']}px`);
  root.setProperty('--hud-label-px', `${h['label.px']}px`);
  root.setProperty('--hud-value-px', `${h['value.px']}px`);
  root.setProperty('--hud-feed-px', `${h['feed.px']}px`);
  root.setProperty('--hud-reg', `${h['reg.size']}px`);
  root.setProperty('--hud-reveal-ms', `${h['reveal.ms']}ms`);
  // STAGE A — tethered blueprint panels
  const pn = raw.panel;
  root.setProperty('--panel-w', `${pn.width}px`);
  root.setProperty('--panel-pad', `${pn.pad}px`);
  root.setProperty('--panel-title-px', `${pn['title.px']}px`);
  root.setProperty('--panel-label-px', `${pn['label.px']}px`);
  root.setProperty('--panel-value-px', `${pn['value.px']}px`);
  root.setProperty('--panel-row-gap', `${pn['row.gap']}px`);
  root.setProperty('--glyph-ms', `${pn.glyphMs}ms`);
  // STAGE C — tethered quote marks
  root.setProperty('--quote-px', `${raw.quotes['mark.px']}px`);
}

// deterministic pick within a [min,max] token range, seeded so it never uses
// Math.random at module load (keeps renders reproducible for the audit)
export function lerpRange(range, t) {
  return range[0] + (range[1] - range[0]) * t;
}

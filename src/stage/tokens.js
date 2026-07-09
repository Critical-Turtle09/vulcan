// SPEC v1.6 THE STAGE — the v2.1 shell token layer (doctrine 10: tokens, never
// hardcode). Publishes the `stage` block from tokens.json as CSS custom properties so
// the shell DOM draws from the single source of truth. The adaptive-scale ramps ship
// as [minPx, prefVw, maxPx] and resolve to clamp() vars — every zone's type and
// spacing is viewport-scaled and bounded (§0 adaptive scale law).
import raw from '../../tokens.json';

export const stage = raw.stage;

// [min, pref, max] -> clamp(<min>px, <pref>vw, <max>px)
const clampRamp = ([min, pref, max]) => `clamp(${min}px, ${pref}vw, ${max}px)`;

export function injectStageVars() {
  const r = document.documentElement.style;
  // flat colour / scalar tokens -> --st-*  (dots become dashes)
  for (const [k, v] of Object.entries(stage)) {
    if (k.startsWith('_') || k === 'type' || k === 'space') continue;
    if (typeof v === 'object') continue;
    r.setProperty(`--st-${k.replace(/\./g, '-')}`, String(v));
  }
  // px + ms conveniences (numeric tokens the CSS wants with units)
  r.setProperty('--st-reg', `${stage['reg.size']}px`);
  r.setProperty('--st-resolve-ms', `${stage['resolve.ms']}ms`);
  // adaptive type ramp -> --fs-*
  for (const [k, v] of Object.entries(stage.type)) r.setProperty(`--fs-${k}`, clampRamp(v));
  // adaptive spacing ramp -> --sp-*
  for (const [k, v] of Object.entries(stage.space)) r.setProperty(`--sp-${k}`, clampRamp(v));
  // shared type faces (same source as the v1.x organs)
  r.setProperty('--type-mono', raw.type.mono);
  r.setProperty('--type-ui', raw.type.ui);
}

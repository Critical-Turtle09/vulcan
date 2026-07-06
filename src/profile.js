// The MODE SYSTEM (spec v1.3). The engine is domain-blind: every organ (map,
// wire, quotes, HUD, panels) reads the ACTIVE PROFILE, never a hardcoded domain.
// Profiles live in /profiles/*.json. semiconductor is the launch default; bonsai
// is a scaffolded starter. Switching crossflows (subscribers re-form granularly).
import rawTokens from '../tokens.json';
import semiconductor from '../profiles/semiconductor.json';
import bonsai from '../profiles/bonsai.json';

const PROFILES = { semiconductor, bonsai };
const ORDER = ['semiconductor', 'bonsai'];

let activeId = rawTokens.profile.default;
const subs = new Set();

export function listProfiles() { return ORDER.slice(); }
export function getProfile(id = activeId) { return PROFILES[id]; }
export function activeProfileId() { return activeId; }
export function activeProfile() { return PROFILES[activeId]; }

// regions of the active profile, keyed by id, plus a key->id map. When the
// profile disables the map (map.enabled === false) this is empty — summon keys
// no-op and the theater never forms.
export function regions() {
  const p = PROFILES[activeId];
  return (p.map && p.map.enabled) ? (p.map.regions || {}) : {};
}
export function regionByKey() {
  const r = regions();
  return Object.fromEntries(Object.entries(r).map(([id, reg]) => [reg.key, id]));
}
export function mapEnabled() {
  const p = PROFILES[activeId];
  return !!(p.map && p.map.enabled);
}

export function setActive(id) {
  if (!PROFILES[id] || id === activeId) return false;
  activeId = id;
  for (const fn of subs) fn(PROFILES[activeId]);
  return true;
}
export function nextProfile() {
  const i = ORDER.indexOf(activeId);
  return ORDER[(i + 1) % ORDER.length];
}
export function onProfileChange(fn) { subs.add(fn); return () => subs.delete(fn); }

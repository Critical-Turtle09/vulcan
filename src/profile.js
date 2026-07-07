// The MODE SYSTEM (spec v1.3 · MISSION PURITY v1.5). The engine is domain-blind:
// every organ (map, wire, quotes, HUD, panels) reads the ACTIVE PROFILE, never a
// hardcoded domain. Profiles live in /profiles/*.json.
//   v1.5 THE ATTENDANT — MISSION PURITY: VULCAN is the Bonsai command center.
//   `bonsai` is the launch + active default and the ONLY profile in active scope
//   (ORDER). `semiconductor` and `political` are ARCHIVED to v3 — kept in-tree and
//   importable (dev/v3 only, via setActive) but OUT of ORDER, so the `P` switch and
//   nextProfile() never surface them. Switching crossflows (subscribers re-form).
import rawTokens from '../tokens.json';
import bonsai from '../profiles/bonsai.json';
// ARCHIVED to v3 (out of active scope; importable for dev/v3 only) —
import semiconductor from '../profiles/semiconductor.json';
import political from '../profiles/political.json';

const PROFILES = { bonsai, semiconductor, political };
const ORDER = ['bonsai'];   // v1.5 MISSION PURITY — bonsai is the only active profile

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

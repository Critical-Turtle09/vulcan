// VULCAN v2 CONDUCTOR — SLICE B2: skill architecture.
// A skill is a named bundle of actions that VULCAN can wield. Registering a
// skill registers each of its actions with the constitution (READ | WRITE |
// WRITE_CONFIRM), so every hand answers to the same gate. A skill also owns its
// own deterministic router — route(text) → { action, detail } | null — so
// obvious commands never spend a router token.
//
// Action shape:
//   { klass, run(detail) -> { title, lines[], speak }, announceText?(detail) }
// run() returns structured content for a blueprint panel ({title, lines}) plus a
// one-line spoken summary (speak). announceText phrases the spoken WRITE_CONFIRM
// prompt.
import { registerAction } from '../constitution.js';
import repo from './repo.js';
import obsidian from './obsidian.js';
import vercel from './vercel.js';
import mission from './mission.js';
import wire from './wire.js';
import crew from './crew.js';   // FRONT I — the crew's runtime hands (outreach drafts, …)

const skills = new Map();

export function registerSkill(skill) {
  skills.set(skill.id, skill);
  for (const [name, a] of Object.entries(skill.actions)) {
    registerAction(name, a.klass, a.run, { announceText: a.announceText });
  }
  return skill.id;
}

// Deterministic match — ask each skill to route the text; first concrete hit
// wins. Returns { skillId, action, detail } | null. Never throws.
export function matchSkill(text) {
  for (const skill of skills.values()) {
    let m = null;
    try { m = skill.route(text); } catch (_) { /* skill router must never break conduct */ }
    if (m && m.action) return { skillId: skill.id, action: m.action, detail: m.detail || {} };
  }
  return null;
}

// The spoken WRITE_CONFIRM prompt for an action (delegates to its announceText).
export function actionPrompt(skillId, action, detail) {
  const skill = skills.get(skillId);
  const a = skill && skill.actions[action];
  return (a && a.announceText) ? a.announceText(detail) : `Confirm ${action}?`;
}

// register the built-in hands (order = deterministic-match priority; the lexicons
// are disjoint — repo/git vs note/vault vs deploy/vercel vs brief — so first-hit is
// unambiguous). B5R: mission is registered BEFORE wire so the mission-brief prefixes
// ("mission brief" / "morning brief" / "bonsai brief") win, while "brief me" falls
// through to the wire skill unchanged.
registerSkill(repo);
registerSkill(obsidian);
registerSkill(vercel);
registerSkill(mission);
registerSkill(wire);
registerSkill(crew);   // FRONT I — after mission so "outreach board" (mission) still wins over "outreach draft" (crew)
